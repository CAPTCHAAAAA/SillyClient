import type {
  DiagnosticReportInput,
  DiagnosticReportResult,
} from "../capacitor-plugin";

export const SENTRY_DSN_STORAGE_KEY = "sillyclient.sentryDsn";

export interface ParsedSentryDsn {
  raw: string;
  publicKey: string;
  projectId: string;
  origin: string;
  pathPrefix: string;
  envelopeUrl: string;
}

export interface SentrySubmissionOptions {
  dsn: ParsedSentryDsn;
  payload: DiagnosticReportInput;
  areaLabel?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  nowMs?: number;
  generateEventId?: () => string;
}

const SHARED_TEXT_ENCODER =
  typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

function utf8ByteLength(text: string): number {
  if (SHARED_TEXT_ENCODER) {
    return SHARED_TEXT_ENCODER.encode(text).byteLength;
  }
  return encodeURIComponent(text).replace(/%[A-F\d]{2}/g, "U").length;
}

function isLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === "localhost" || lower === "127.0.0.1" || lower === "[::1]" || lower === "::1";
}

/**
 * Parses a public Sentry DSN without requiring any server-side secrets.
 */
export function parseSentryDsn(rawDsn: string | null | undefined): ParsedSentryDsn | null {
  if (typeof rawDsn !== "string") return null;
  const trimmed = rawDsn.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const isHttps = parsed.protocol === "https:";
  const isLocalHttp = parsed.protocol === "http:" && isLoopbackHost(parsed.hostname);
  if (!isHttps && !isLocalHttp) return null;

  // Client bundles must only embed Sentry public keys (never secret passwords).
  if (parsed.password) return null;
  const publicKey = parsed.username.trim();
  if (!/^[A-Za-z0-9]{8,64}$/.test(publicKey)) return null;

  const segments = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const projectId = segments[segments.length - 1];
  if (!/^\d+$/.test(projectId) || Number(projectId) <= 0) return null;

  const prefixSegments = segments.slice(0, -1);
  const pathPrefix = prefixSegments.length > 0 ? `/${prefixSegments.join("/")}` : "";
  const origin = `${parsed.protocol}//${parsed.host}`;
  const envelopeUrl =
    `${origin}${pathPrefix}/api/${projectId}/envelope/` +
    `?sentry_key=${encodeURIComponent(publicKey)}&sentry_version=7`;

  return {
    raw: trimmed,
    publicKey,
    projectId,
    origin,
    pathPrefix,
    envelopeUrl,
  };
}

/**
 * Resolves the active Sentry DSN from explicit override, localStorage, or build env.
 * Throws if a non-empty DSN candidate is syntactically invalid so misconfigurations surface immediately.
 */
export function resolveSentryDsn(options?: {
  sentryDsnOverride?: string | null;
  configuredSentryDsn?: string | null;
  storage?: Pick<Storage, "getItem"> | null;
}): ParsedSentryDsn | null {
  let storedRaw: string | null = null;
  if (options?.storage !== null) {
    const storage =
      options?.storage ??
      (typeof window !== "undefined" ? window.localStorage : undefined);
    if (storage) {
      try {
        storedRaw = storage.getItem(SENTRY_DSN_STORAGE_KEY);
      } catch {
        storedRaw = null;
      }
    }
  }

  const candidates = [
    options?.sentryDsnOverride,
    storedRaw,
    options?.configuredSentryDsn,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const parsed = parseSentryDsn(trimmed);
    if (!parsed) {
      throw new Error("Sentry DSN 配置格式无效，请检查 VITE_SENTRY_DSN 或本地调试覆盖值。");
    }
    return parsed;
  }

  return null;
}

export function generateSentryEventId(): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.randomUUID) {
    const hex = cryptoObj.randomUUID().replace(/-/g, "").toLowerCase();
    if (/^[0-9a-f]{32}$/.test(hex)) return hex;
  }
  const bytes = new Uint8Array(16);
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function formatSentryReportId(eventId: string): string {
  const clean = eventId.replace(/[^a-f0-9]/gi, "").slice(0, 8).toUpperCase();
  return clean ? `SC-${clean}` : "SC-PENDING";
}

function buildDiagnosticTags(
  sanitized: DiagnosticReportInput,
  areaLabel?: string
): Record<string, string> {
  const tags: Record<string, string> = {
    area: sanitized.area,
    area_label: areaLabel?.trim() || sanitized.area,
    client_platform: sanitized.platform || "web",
  };
  if (sanitized.stage) {
    tags.stage = sanitized.stage;
  }
  if (sanitized.errorCode) {
    tags.error_code = sanitized.errorCode;
  }
  return tags;
}

function serializeEnvelope(
  envelopeHeader: Record<string, unknown>,
  items: Array<{ header: Record<string, unknown>; payload: Record<string, unknown> }>
): string {
  const lines = [JSON.stringify(envelopeHeader)];
  for (const item of items) {
    const payloadJson = JSON.stringify(item.payload);
    const itemHeaderJson = JSON.stringify({
      ...item.header,
      length: utf8ByteLength(payloadJson),
    });
    lines.push(itemHeaderJson, payloadJson);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Serializes a sanitized diagnostic report into Sentry's NDJSON Event Envelope.
 */
export function buildSentryEventEnvelope(
  sanitized: DiagnosticReportInput,
  options: {
    dsn: ParsedSentryDsn;
    eventId: string;
    nowMs: number;
    areaLabel?: string;
  }
): string {
  const areaLabel = options.areaLabel?.trim() || sanitized.area;
  const firstLine =
    sanitized.summary
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ||
    sanitized.userMessage ||
    "Unknown diagnostic failure";
  const clippedHeadline =
    firstLine.length > 140 ? `${firstLine.slice(0, 137)}...` : firstLine;

  const extra: Record<string, unknown> = {
    summary: sanitized.summary,
  };
  if (sanitized.userMessage) extra.user_message = sanitized.userMessage;
  if (sanitized.userNote) extra.user_note = sanitized.userNote;
  if (sanitized.stage) extra.stage = sanitized.stage;
  if (sanitized.errorCode) extra.error_code = sanitized.errorCode;
  if (typeof sanitized.elapsedMs === "number") extra.elapsed_ms = sanitized.elapsedMs;
  if (sanitized.fingerprint) extra.fingerprint = sanitized.fingerprint;

  const fingerprint = sanitized.fingerprint
    ? [sanitized.fingerprint, sanitized.area, sanitized.errorCode || "generic"]
    : [
        "sillyclient",
        sanitized.area,
        sanitized.stage || "unknown",
        sanitized.errorCode || "generic",
      ];

  const eventPayload: Record<string, unknown> = {
    event_id: options.eventId,
    timestamp: options.nowMs / 1000,
    platform: "javascript",
    level: "error",
    logger: "sillyclient.diagnostic",
    release: `sillyclient@${sanitized.appVersion || "unknown"}`,
    environment: sanitized.platform || "web",
    fingerprint,
    tags: buildDiagnosticTags(sanitized, areaLabel),
    message: {
      formatted: `[${areaLabel}] ${clippedHeadline}`,
    },
    contexts: {
      app: {
        app_name: "SillyClient",
        app_version: sanitized.appVersion || "unknown",
      },
      os: {
        name: sanitized.platform || "web",
      },
    },
    extra,
  };

  return serializeEnvelope(
    {
      event_id: options.eventId,
      sent_at: new Date(options.nowMs).toISOString(),
      dsn: options.dsn.raw,
    },
    [{ header: { type: "event" }, payload: eventPayload }]
  );
}

/**
 * Serializes an anonymous User Feedback item linked to an existing Sentry event ID.
 */
export function buildSentryFeedbackEnvelope(
  sanitized: DiagnosticReportInput,
  options: {
    dsn: ParsedSentryDsn;
    feedbackEventId: string;
    associatedEventId: string;
    nowMs: number;
    areaLabel?: string;
  }
): string {
  const feedbackPayload: Record<string, unknown> = {
    event_id: options.feedbackEventId,
    timestamp: options.nowMs / 1000,
    type: "feedback",
    level: "info",
    platform: "javascript",
    release: `sillyclient@${sanitized.appVersion || "unknown"}`,
    environment: sanitized.platform || "web",
    tags: buildDiagnosticTags(sanitized, options.areaLabel),
    contexts: {
      feedback: {
        message: sanitized.userNote || "",
        source: "sillyclient-overlay",
        associated_event_id: options.associatedEventId,
      },
    },
  };

  return serializeEnvelope(
    {
      event_id: options.feedbackEventId,
      sent_at: new Date(options.nowMs).toISOString(),
      dsn: options.dsn.raw,
    },
    [{ header: { type: "feedback" }, payload: feedbackPayload }]
  );
}

async function postSentryEnvelope(
  envelopeUrl: string,
  envelopeBody: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<{ acceptedId?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    // Passing a plain string without custom headers selects text/plain;charset=UTF-8,
    // which qualifies as a CORS simple request and avoids unnecessary OPTIONS preflights.
    response = await fetchImpl(envelopeUrl, {
      method: "POST",
      body: envelopeBody,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "连接云端诊断服务（Sentry）超时，请检查网络或开启代理/梯子后重试，或点击「打开草稿」手动提交。"
      );
    }
    throw new Error(
      "无法连接云端诊断服务（Sentry），请检查网络或开启代理/梯子后重试，或点击「打开草稿」手动提交。"
    );
  } finally {
    clearTimeout(timer);
  }

  const rawText = await response.text().catch(() => "");
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "云端诊断服务当前请求过于频繁（HTTP 429），请稍后重试或点击「打开草稿」手动提交。"
      );
    }
    throw new Error(
      `云端诊断服务拒绝了本次上报（HTTP ${response.status}），请重试或点击「打开草稿」手动提交。`
    );
  }

  if (rawText.trim()) {
    try {
      const parsed = JSON.parse(rawText) as { id?: unknown };
      if (typeof parsed.id === "string" && /^[0-9a-f]{32}$/i.test(parsed.id.trim())) {
        return { acceptedId: parsed.id.trim().toLowerCase() };
      }
    } catch {
      // Sentry occasionally returns empty body or non-JSON acknowledgment on 200/202.
    }
  }
  return {};
}

/**
 * Submits a sanitized diagnostic report directly to Sentry's Envelope ingestion endpoint,
 * plus an associated User Feedback item when the user wrote a supplemental note.
 */
export async function submitSentryDiagnosticReport(
  options: SentrySubmissionOptions
): Promise<DiagnosticReportResult> {
  const fetchImpl =
    options.fetchImpl ??
    (typeof fetch === "function" ? fetch.bind(globalThis) : undefined);
  if (!fetchImpl) {
    throw new Error("Fetch API is unavailable in this environment");
  }

  const nextId = options.generateEventId ?? generateSentryEventId;
  const nowMs = options.nowMs ?? Date.now();
  const timeoutMs = options.timeoutMs ?? 15000;
  const eventId = nextId();

  const eventEnvelope = buildSentryEventEnvelope(options.payload, {
    dsn: options.dsn,
    eventId,
    nowMs,
    areaLabel: options.areaLabel,
  });
  const receipt = await postSentryEnvelope(
    options.dsn.envelopeUrl,
    eventEnvelope,
    fetchImpl,
    timeoutMs
  );
  const acceptedEventId = receipt.acceptedId || eventId;

  if (options.payload.userNote) {
    const feedbackEventId = nextId();
    const feedbackEnvelope = buildSentryFeedbackEnvelope(options.payload, {
      dsn: options.dsn,
      feedbackEventId,
      associatedEventId: acceptedEventId,
      nowMs,
      areaLabel: options.areaLabel,
    });
    try {
      await postSentryEnvelope(
        options.dsn.envelopeUrl,
        feedbackEnvelope,
        fetchImpl,
        Math.min(timeoutMs, 8000)
      );
    } catch {
      // Non-fatal: userNote is already preserved inside event.extra.user_note.
    }
  }

  return {
    ok: true,
    reportId: formatSentryReportId(acceptedEventId),
    deliveryMode: "sentry",
    message: "已加密上传至云端诊断服务（Sentry）",
  };
}
