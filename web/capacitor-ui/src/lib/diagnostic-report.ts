import type {
  DiagnosticArea,
  DiagnosticDeliveryMode,
  DiagnosticReportInput,
  DiagnosticReportResult,
} from "../capacitor-plugin";
import { sanitizeDiagnosticText } from "./native-errors";
import {
  resolveSentryDsn,
  SENTRY_DSN_STORAGE_KEY,
  submitSentryDiagnosticReport,
} from "./sentry-diagnostic";

export { SENTRY_DSN_STORAGE_KEY };

export const DIAGNOSTIC_GITHUB_REPOSITORY = "CAPTCHAAAAA/SillyClient";
export const DIAGNOSTIC_GITHUB_ISSUES_NEW_URL =
  `https://github.com/${DIAGNOSTIC_GITHUB_REPOSITORY}/issues/new`;
export const DIAGNOSTIC_LOCAL_DEV_ENDPOINT = "/__dev/diagnostic-report";
export const DIAGNOSTIC_ENDPOINT_STORAGE_KEY = "sillyclient.diagnosticEndpoint";

const AREA_DISPLAY_LABELS: Record<DiagnosticArea, string> = {
  picker: "目录选择",
  create: "创建实例",
  launch: "启动",
  relocate: "迁移路径",
  import: "导入备份",
  export: "导出备份",
  manage: "实例管理",
  settings: "设置",
  maintenance: "维护",
  cleanup: "清理",
  rename: "重命名",
  terminal: "终端",
  auth: "认证与凭据",
  update: "应用更新",
  onboarding: "引导",
  runtime: "运行时",
};

function sanitizeDiagnosticString(value: string): string {
  return sanitizeDiagnosticText(value).replace(
    /\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{8,}\b/g,
    "[已脱敏凭据]"
  );
}

function sanitizeCompactField(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = sanitizeDiagnosticString(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return undefined;
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned;
}

function sanitizeMultilineField(value: string | undefined, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = sanitizeDiagnosticString(value).replace(/\r\n?/g, "\n").trim();
  if (!cleaned) return undefined;
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned;
}

function sanitizeFingerprint(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return clean ? clean.slice(0, 32) : undefined;
}

export function getDiagnosticAreaDisplay(area: DiagnosticArea): string {
  return AREA_DISPLAY_LABELS[area] || AREA_DISPLAY_LABELS.runtime;
}

export function sanitizeDiagnosticReportInput(
  input: DiagnosticReportInput
): DiagnosticReportInput {
  const area: DiagnosticArea =
    input.area in AREA_DISPLAY_LABELS ? input.area : "runtime";
  const summary =
    sanitizeMultilineField(input.summary, 600) ||
    sanitizeCompactField(input.userMessage, 300) ||
    "Unknown error";
  const userMessage = sanitizeCompactField(input.userMessage, 300);
  const userNote = sanitizeMultilineField(input.userNote, 300);
  const stage = sanitizeCompactField(input.stage, 80);
  const errorCode = sanitizeCompactField(input.errorCode, 80);
  const platform = sanitizeCompactField(input.platform, 40) || "web";
  const appVersion = sanitizeCompactField(input.appVersion, 40) || "unknown";
  const fingerprint = sanitizeFingerprint(input.fingerprint);
  const elapsedMs =
    typeof input.elapsedMs === "number" &&
    Number.isFinite(input.elapsedMs) &&
    input.elapsedMs > 0
      ? Math.round(input.elapsedMs)
      : undefined;

  return {
    area,
    stage,
    errorCode,
    summary,
    userMessage,
    userNote,
    platform,
    appVersion,
    elapsedMs,
    fingerprint,
  };
}

export function buildDiagnosticIssueTitle(input: DiagnosticReportInput): string {
  const clean = sanitizeDiagnosticReportInput(input);
  const areaLabel = getDiagnosticAreaDisplay(clean.area);
  const singleLineSummary = clean.summary
    .replace(/```+/g, "'")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const prefix = `[异常反馈][${areaLabel}] `;
  const maxSummaryChars = Math.max(24, 110 - prefix.length);
  const clipped =
    singleLineSummary.length > maxSummaryChars
      ? `${singleLineSummary.slice(0, maxSummaryChars - 3)}...`
      : singleLineSummary;
  return `${prefix}${clipped || "未命名异常"}`;
}

function escapeMarkdownFence(value: string): string {
  return value.replace(/```+/g, (match) => match.replace(/`/g, "\\`"));
}

function formatFingerprintTag(fingerprint: string | undefined): string {
  const clean = sanitizeFingerprint(fingerprint);
  if (!clean || clean === "untracked") return "sc:untracked";
  const bare = clean.startsWith("sc-") ? clean.slice(3) : clean;
  return `sc:${bare || clean}`;
}

export function buildDiagnosticIssueBody(
  input: DiagnosticReportInput,
  options?: { summaryPreviewLimit?: number; extraFooterNote?: string }
): string {
  const clean = sanitizeDiagnosticReportInput(input);
  const areaLabel = getDiagnosticAreaDisplay(clean.area);
  const fingerprint = clean.fingerprint || "untracked";
  const fingerprintTag = formatFingerprintTag(fingerprint);
  const summaryPreviewLimit = options?.summaryPreviewLimit;
  const rawSummaryText =
    typeof summaryPreviewLimit === "number" &&
    summaryPreviewLimit > 40 &&
    clean.summary.length > summaryPreviewLimit
      ? `${clean.summary.slice(0, summaryPreviewLimit - 3)}...`
      : clean.summary;

  const metaLines = [
    `- **模块**：${areaLabel} (\`${clean.area}\`)`,
    `- **阶段**：\`${clean.stage || "未标注"}\``,
    `- **错误码**：\`${clean.errorCode || "未提供"}\``,
    `- **运行环境**：\`${clean.platform || "web"}\` · \`${clean.appVersion || "unknown"}\``,
  ];
  if (typeof clean.elapsedMs === "number" && clean.elapsedMs > 0) {
    metaLines.push(`- **耗时**：\`${clean.elapsedMs} ms\``);
  }
  metaLines.push(`- **诊断指纹**：\`${fingerprintTag}\``);

  const noteText = clean.userNote ? clean.userNote : "（用户未填写补充说明）";
  const parts = [
    "## 异常摘要",
    metaLines.join("\n"),
    "",
    "## 捕获错误（已脱敏）",
    "```text",
    escapeMarkdownFence(rawSummaryText),
    "```",
    "",
    "## 用户补充说明",
    noteText,
  ];
  if (options?.extraFooterNote) {
    parts.push("", options.extraFooterNote);
  }
  parts.push(
    "",
    `<!-- sillyclient-diagnostic: fingerprint=${fingerprint} tag=${fingerprintTag} area=${clean.area} platform=${clean.platform || "web"} version=${clean.appVersion || "unknown"} -->`
  );
  return parts.join("\n");
}

export function buildDiagnosticFollowUpComment(input: DiagnosticReportInput): string {
  const clean = sanitizeDiagnosticReportInput(input);
  const fingerprint = clean.fingerprint || "untracked";
  const fingerprintTag = formatFingerprintTag(fingerprint);
  const lines = [
    "### 新增同指纹反馈记录",
    `- **运行环境**：\`${clean.platform || "web"}\` · \`${clean.appVersion || "unknown"}\``,
    `- **阶段 / 错误码**：\`${clean.stage || "未标注"}\` / \`${clean.errorCode || "未提供"}\``,
    `- **诊断指纹**：\`${fingerprintTag}\``,
    "",
    "```text",
    escapeMarkdownFence(clean.summary),
    "```",
    clean.userNote ? `\n**用户补充说明**：${clean.userNote}` : "",
    `\n<!-- sillyclient-diagnostic-followup: fingerprint=${fingerprint} -->`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildPrefilledGitHubIssueUrl(
  input: DiagnosticReportInput,
  maxUrlLength = 7000
): { url: string; fullBody: string; title: string; truncated: boolean } {
  const title = buildDiagnosticIssueTitle(input);
  const fullBody = buildDiagnosticIssueBody(input);

  const encodeIssueUrl = (bodyText: string) => {
    const params = new URLSearchParams({
      labels: "bug",
      title,
      body: bodyText,
    });
    return `${DIAGNOSTIC_GITHUB_ISSUES_NEW_URL}?${params.toString()}`;
  };

  let url = encodeIssueUrl(fullBody);
  if (url.length <= maxUrlLength) {
    return { url, fullBody, title, truncated: false };
  }

  for (const limit of [320, 180, 90, 45]) {
    const compactBody = buildDiagnosticIssueBody(input, {
      summaryPreviewLimit: limit,
      extraFooterNote:
        "> 提示：部分长日志因浏览器链接长度限制已省略，完整脱敏报告已尝试复制到剪贴板，可直接粘贴补充。",
    });
    const candidate = encodeIssueUrl(compactBody);
    if (candidate.length <= maxUrlLength) {
      return { url: candidate, fullBody, title, truncated: true };
    }
    url = candidate;
  }

  const clean = sanitizeDiagnosticReportInput(input);
  const minimalBody = [
    `sc:${clean.fingerprint || "untracked"} | ${clean.platform || "web"} ${clean.appVersion || ""}`,
    "完整脱敏诊断报告已尝试复制到剪贴板，请在此处粘贴。",
  ].join("\n\n");
  const minimalCandidate = encodeIssueUrl(minimalBody);
  if (minimalCandidate.length <= url.length) {
    url = minimalCandidate;
  }

  return { url, fullBody, title, truncated: true };
}

export function normalizeDiagnosticEndpointUrl(raw?: string | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const isHttps = parsed.protocol === "https:";
    const isLoopbackHttp =
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "[::1]");
    if (!isHttps && !isLoopbackHttp) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeDiagnosticReportUrl(raw?: string | null): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost"))
    ) {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function resolveDiagnosticEndpoints(options?: {
  endpointOverride?: string | null;
  configuredEndpoint?: string | null;
  configuredFallbackEndpoint?: string | null;
  storage?: Pick<Storage, "getItem"> | null;
}): string[] {
  const collected: string[] = [];
  const seen = new Set<string>();

  const pushRaw = (raw: string | null | undefined) => {
    if (typeof raw !== "string") return;
    for (const part of raw.split(/[\s,;]+/)) {
      const normalized = normalizeDiagnosticEndpointUrl(part);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        collected.push(normalized);
      }
    }
  };

  pushRaw(options?.endpointOverride);

  if (options?.storage !== null) {
    const storage =
      options?.storage ??
      (typeof window !== "undefined" ? window.localStorage : undefined);
    if (storage) {
      try {
        pushRaw(storage.getItem(DIAGNOSTIC_ENDPOINT_STORAGE_KEY));
      } catch {
        // Ignore inaccessible storage (sandboxed frames / privacy modes).
      }
    }
  }

  pushRaw(options?.configuredEndpoint);
  pushRaw(options?.configuredFallbackEndpoint);
  return collected;
}

export function resolveDiagnosticEndpoint(options?: {
  endpointOverride?: string | null;
  configuredEndpoint?: string | null;
  configuredFallbackEndpoint?: string | null;
  storage?: Pick<Storage, "getItem"> | null;
}): string | null {
  return resolveDiagnosticEndpoints(options)[0] ?? null;
}

export function isNativeUnimplementedError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "").trim().toUpperCase()
      : "";
  if (code === "UNIMPLEMENTED") return true;
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "");
  return /(?:not implemented(?:\s+on\s+(?:web|android|ios|windows))?|unimplemented|does not implement|未知方法)/i.test(
    message
  );
}

async function postJsonWithTimeout(
  url: string,
  payload: unknown,
  options: {
    fetchImpl: typeof fetch;
    timeoutMs: number;
  }
): Promise<{ status: number; ok: boolean; json: Record<string, unknown> | null; rawText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await options.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const rawText = await response.text();
    let json: Record<string, unknown> | null = null;
    if (rawText.trim()) {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === "object") {
          json = parsed as Record<string, unknown>;
        }
      } catch {
        json = null;
      }
    }
    return {
      status: response.status,
      ok: response.ok,
      json,
      rawText,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${options.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isPlainWebhookAck(status: number, rawText: string): boolean {
  if (status < 200 || status >= 300) return false;
  const trimmed = rawText.trim();
  if (!trimmed) return true;
  if (/^<!doctype\b|^<html\b/i.test(trimmed)) return false;
  return (
    /^(?:ok|success!?|accepted)$/i.test(trimmed) ||
    /^<p>\s*<b>\s*Success!\s*<\/b>\s*<\/p>/i.test(trimmed)
  );
}

function parseServerResponse(
  json: Record<string, unknown> | null,
  status: number,
  rawText: string,
  fallbackMode: DiagnosticDeliveryMode
): DiagnosticReportResult {
  if (!json) {
    if (isPlainWebhookAck(status, rawText)) {
      return {
        ok: true,
        reportId: "SC-QUEUED",
        deliveryMode: fallbackMode,
        message: "已由云端工作流接收并排队创建 Issue",
      };
    }
    const snippet = rawText.trim().slice(0, 180);
    throw new Error(
      snippet ? `HTTP ${status}: ${snippet}` : `HTTP ${status}: Empty response`
    );
  }
  const errorText =
    typeof json.error === "string" && json.error.trim()
      ? json.error.trim()
      : typeof json.message === "string" && json.message.trim()
        ? json.message.trim()
        : "";
  const explicitRejected =
    json.ok === false ||
    json.success === false ||
    (typeof json.error === "string" && json.error.trim().length > 0);
  const accepted = json.ok === true || json.success === true;
  if (explicitRejected || !accepted) {
    throw new Error(errorText || `HTTP ${status}: Submission rejected`);
  }
  const issueNum =
    typeof json.issueNumber === "number"
      ? json.issueNumber
      : typeof json.number === "number"
        ? json.number
        : undefined;
  const reportIdRaw =
    typeof json.reportId === "string" && json.reportId.trim()
      ? json.reportId.trim()
      : issueNum !== undefined
        ? `#${issueNum}`
        : "SC-QUEUED";
  const reportUrl =
    normalizeDiagnosticReportUrl(
      typeof json.reportUrl === "string" ? json.reportUrl : undefined
    ) ||
    normalizeDiagnosticReportUrl(
      typeof json.htmlUrl === "string" ? json.htmlUrl : undefined
    ) ||
    normalizeDiagnosticReportUrl(
      typeof json.html_url === "string" ? json.html_url : undefined
    );
  const deliveryMode: DiagnosticDeliveryMode =
    json.deliveryMode === "native" ||
    json.deliveryMode === "sentry" ||
    json.deliveryMode === "relay" ||
    json.deliveryMode === "local-gh" ||
    json.deliveryMode === "github-prefill"
      ? json.deliveryMode
      : fallbackMode;

  return {
    ok: true,
    reportId: reportIdRaw,
    reportUrl,
    deliveryMode,
    deduplicated: json.deduplicated === true,
    message: typeof json.message === "string" ? json.message.trim() : undefined,
  };
}

export function formatDiagnosticReportIdDisplay(
  reportId: string | null | undefined,
  deliveryMode?: DiagnosticDeliveryMode
): string {
  const clean = (reportId || "").trim().replace(/^#+/, "");
  if (!clean) return "#SC-PENDING";
  if (deliveryMode === "github-prefill" || clean === "GITHUB-DRAFT") {
    return "GitHub 预填草稿";
  }
  if (deliveryMode === "sentry" || /^SC-[A-Z0-9]+$/i.test(clean)) {
    return clean;
  }
  return `#${clean}`;
}

export interface DeliverDiagnosticReportOptions {
  payload: DiagnosticReportInput;
  nativeSubmit?: (
    input: DiagnosticReportInput
  ) => Promise<DiagnosticReportResult>;
  isDev?: boolean;
  isNativePlatform?: boolean;
  configuredSentryDsn?: string | null;
  sentryDsnOverride?: string | null;
  configuredEndpoint?: string | null;
  configuredFallbackEndpoint?: string | null;
  endpointOverride?: string | null;
  localDevEndpoint?: string;
  storage?: Pick<Storage, "getItem"> | null;
  fetchImpl?: typeof fetch;
  openUrl: (url: string) => Promise<void>;
  copyText?: (text: string) => Promise<void>;
}

const NON_RETRYABLE_RELAY_STATUSES = new Set([400, 401, 403, 413, 415, 422, 429]);

class RelayRejectedError extends Error {
  readonly nonRetryable = true;
}

function extractServerErrorMessage(
  res: { status: number; json: Record<string, unknown> | null; rawText: string },
  maxRawLen = 180
): string {
  return (
    (typeof res.json?.error === "string" && res.json.error.trim()) ||
    (typeof res.json?.message === "string" && res.json.message.trim()) ||
    res.rawText.trim().slice(0, maxRawLen) ||
    `HTTP ${res.status}`
  );
}

export async function openDiagnosticPrefillDraft(options: {
  payload: DiagnosticReportInput;
  openUrl: (url: string) => Promise<void>;
  copyText?: (text: string) => Promise<void>;
}): Promise<DiagnosticReportResult> {
  const sanitized = sanitizeDiagnosticReportInput(options.payload);
  const prefilled = buildPrefilledGitHubIssueUrl(sanitized);
  if (options.copyText) {
    try {
      await options.copyText(prefilled.fullBody);
    } catch {
      // Clipboard write requires user-gesture permission on some platforms; non-fatal.
    }
  }
  await options.openUrl(prefilled.url);

  return {
    ok: true,
    reportId: "GITHUB-DRAFT",
    reportUrl: prefilled.url,
    deliveryMode: "github-prefill",
    message: "已在浏览器打开预填好脱敏日志的 GitHub Issue 草稿，核对后点击 Submit new issue 即可提交。",
  };
}

export async function deliverDiagnosticReport(
  options: DeliverDiagnosticReportOptions
): Promise<DiagnosticReportResult> {
  const sanitized = sanitizeDiagnosticReportInput(options.payload);

  // 1. Native bridge (also captures onboarding sandbox mock automatically)
  if (options.nativeSubmit) {
    try {
      const nativeResult = await options.nativeSubmit(sanitized);
      if (nativeResult && typeof nativeResult === "object") {
        if (!nativeResult.ok) {
          return {
            ok: false,
            message: nativeResult.message?.trim() || "Native diagnostic submission failed",
          };
        }
        return {
          ...nativeResult,
          reportUrl: normalizeDiagnosticReportUrl(nativeResult.reportUrl),
          deliveryMode: nativeResult.deliveryMode || "native",
        };
      }
    } catch (error) {
      if (!isNativeUnimplementedError(error)) {
        throw error;
      }
    }
  }

  const fetchImpl =
    options.fetchImpl ??
    (typeof fetch === "function" ? fetch.bind(globalThis) : undefined);

  // 2. Commercial SaaS ingestion (Sentry public DSN — zero self-hosted backend or GitHub Token needed)
  const sentryDsn = resolveSentryDsn({
    sentryDsnOverride: options.sentryDsnOverride,
    configuredSentryDsn: options.configuredSentryDsn,
    storage: options.storage,
  });
  if (sentryDsn) {
    return submitSentryDiagnosticReport({
      dsn: sentryDsn,
      payload: sanitized,
      areaLabel: getDiagnosticAreaDisplay(sanitized.area),
      fetchImpl,
    });
  }

  const wireBody = {
    schemaVersion: 1,
    repository: DIAGNOSTIC_GITHUB_REPOSITORY,
    title: buildDiagnosticIssueTitle(sanitized),
    body: buildDiagnosticIssueBody(sanitized),
    commentBody: buildDiagnosticFollowUpComment(sanitized),
    report: sanitized,
  };

  // 3. Optional HTTP relay endpoints (primary -> backup failover across custom domain / Workers)
  const relayEndpoints = resolveDiagnosticEndpoints({
    endpointOverride: options.endpointOverride,
    configuredEndpoint: options.configuredEndpoint,
    configuredFallbackEndpoint: options.configuredFallbackEndpoint,
    storage: options.storage,
  });
  if (relayEndpoints.length > 0) {
    if (!fetchImpl) {
      throw new Error("Fetch API is unavailable in this environment");
    }
    const timeoutMs = relayEndpoints.length > 1 ? 12000 : 15000;
    let lastError: Error | null = null;
    for (const relayEndpoint of relayEndpoints) {
      try {
        const relayRes = await postJsonWithTimeout(relayEndpoint, wireBody, {
          fetchImpl,
          timeoutMs,
        });
        if (!relayRes.ok) {
          const message = extractServerErrorMessage(relayRes, 180);
          if (NON_RETRYABLE_RELAY_STATUSES.has(relayRes.status)) {
            throw new RelayRejectedError(message);
          }
          lastError = new Error(message);
          continue;
        }
        return parseServerResponse(relayRes.json, relayRes.status, relayRes.rawText, "relay");
      } catch (error) {
        if (error instanceof RelayRejectedError) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error ?? "Relay request failed"));
      }
    }
    throw lastError ?? new Error("Relay request failed");
  }

  // 3. Vite dev server real GitHub middleware (active only during local vite dev)
  if (options.isDev && !options.isNativePlatform && fetchImpl) {
    const devEndpoint = options.localDevEndpoint || DIAGNOSTIC_LOCAL_DEV_ENDPOINT;
    const devRes = await postJsonWithTimeout(devEndpoint, wireBody, {
      fetchImpl,
      timeoutMs: 25000,
    });
    if (devRes.status !== 404 && devRes.status !== 405) {
      if (!devRes.ok) {
        throw new Error(extractServerErrorMessage(devRes, 220));
      }
      return parseServerResponse(
        devRes.json,
        devRes.status,
        devRes.rawText,
        "local-gh"
      );
    }
  }

  // 4. Zero-backend production fallback: open prefilled GitHub New Issue page
  return openDiagnosticPrefillDraft({
    payload: sanitized,
    openUrl: options.openUrl,
    copyText: options.copyText,
  });
}
