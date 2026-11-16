import type { DiagnosticArea, DiagnosticReportInput } from "../capacitor-plugin";
import { APP_VERSION } from "../constants/app-version";

export interface DiagnosticContext {
  area: DiagnosticArea;
  stage?: string;
  errorCode?: string;
  summary: string;
  userMessage: string;
  platform: string;
  appVersion: string;
  elapsedMs?: number;
  fingerprint: string;
  timestamp: number;
}

export interface CreateDiagnosticOptions {
  area: DiagnosticArea;
  stage?: string;
  elapsedMs?: number;
  platform?: string;
  appVersion?: string;
  userMessage?: string;
  extraSecrets?: Array<string | null | undefined>;
}

const SELECTION_FAILURE_RE =
  /Installation folder selection failed at ([^\s:]+)(?:\s*\[([^\]]+)\])?:\s*(.+)/i;

export function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim();
  }
  if (
    typeof error === "number" ||
    typeof error === "boolean" ||
    typeof error === "bigint"
  ) {
    return String(error);
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    for (const key of [
      "message",
      "errorMessage",
      "error",
      "reason",
      "detail",
      "localizedDescription",
    ]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        const msg = value.trim();
        if (
          key === "message" &&
          name &&
          name !== "Error" &&
          !msg.startsWith(`${name}:`)
        ) {
          return `${name}: ${msg}`;
        }
        return msg;
      }
    }
    if (error instanceof Error && name) {
      return name;
    }
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // Ignore circular/unserializable objects.
    }
  }
  return "";
}

export function extractErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const rawCode = record.code;
    if (typeof rawCode === "string" && rawCode.trim()) {
      return rawCode.trim();
    }
    if (typeof rawCode === "number" && Number.isFinite(rawCode)) {
      return String(rawCode);
    }
  }

  const raw = extractErrorMessage(error);
  if (!raw) return undefined;

  const selectionMatch = raw.match(SELECTION_FAILURE_RE);
  if (selectionMatch?.[2]) {
    return selectionMatch[2].trim();
  }

  const bracketDomain = raw.match(/\[([A-Za-z0-9_.]+:\d+)\]/);
  if (bracketDomain?.[1]) {
    return bracketDomain[1];
  }

  const posixOrNodeCode = raw.match(
    /\b(PICKER_CANCELLED|PICKER_ABNORMAL_DISMISS|EACCES|EPERM|ENOENT|ENOSPC|EADDRINUSE|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|ENOTSUP|EROFS)\b/i
  );
  if (posixOrNodeCode?.[1]) {
    return posixOrNodeCode[1].toUpperCase();
  }

  return undefined;
}

export function extractErrorStage(error: unknown): string | undefined {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.stage === "string" && record.stage.trim()) {
      return record.stage.trim();
    }
  }
  const raw = extractErrorMessage(error);
  const selectionMatch = raw.match(SELECTION_FAILURE_RE);
  return selectionMatch?.[1]?.trim() || undefined;
}

export function isUserCancellationError(error: unknown, isIOS = false): boolean {
  if (!error) return false;
  const code =
    typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code.trim()
      : "";
  const message = extractErrorMessage(error);

  if (code === "PICKER_CANCELLED" || /PICKER_CANCELLED/.test(message)) {
    return true;
  }

  if (isIOS) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("cancel") || message.includes("取消") || normalized.includes("aborted");
}

/**
 * 保留原始报错信息，不做预设文案映射或隐藏原生错误码/域细节。
 */
export function humanizeNativeError(error: unknown): string {
  return extractErrorMessage(error) || "Unknown error";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RESERVED_SHORT_TOKENS = new Set([
  "ios",
  "mac",
  "win",
  "url",
  "zip",
  "api",
  "app",
  "log",
  "err",
  "src",
  "tmp",
  "var",
  "etc",
]);

export function sanitizeDiagnosticText(
  text: string,
  extraSecrets: Array<string | null | undefined> = []
): string {
  if (!text) return "";
  let sanitized = String(text);

  const uniqueSecrets = Array.from(
    new Set(
      extraSecrets
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => {
          if (item.length < 2) return false;
          if (/^[a-z0-9]{1,3}$/i.test(item) && RESERVED_SHORT_TOKENS.has(item.toLowerCase())) {
            return false;
          }
          return true;
        })
    )
  ).sort((a, b) => b.length - a.length);

  for (const secret of uniqueSecrets) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(secret), "gi"), "[已脱敏]");
  }

  // Credentials, auth headers, and API keys
  sanitized = sanitized
    .replace(/(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{6,}/gi, "$1 [已脱敏]")
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,})\b/g,
      "[已脱敏凭据]"
    )
    .replace(
      /\b(password|passwd|pwd|secret|token|api[-_]?key|authorization|cookie|session(?:id)?)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1=[已脱敏]"
    );

  // URLs, emails, IPs
  sanitized = sanitized
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>")
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, "<url>")
    .replace(/\bfile:\/\/[^\s"'<>]+/gi, "<file-url>")
    .replace(/\bcontent:\/\/[^\s"'<>]+/gi, "<content-uri>")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "<ip>");

  // Device / OS filesystem paths (Windows, iOS, macOS, Android, Unix)
  sanitized = sanitized
    .replace(/[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\s"';<>|]+/gi, "<win-user-path>")
    .replace(/[A-Za-z]:\\[^\s"';<>|]+/g, "<win-path>")
    .replace(/\\\\[^\s"';<>|]+/g, "<unc-path>")
    .replace(/\/private\/var\/[^\s"';<>|]+/gi, "<ios-var-path>")
    .replace(/\/var\/mobile\/[^\s"';<>|]+/gi, "<mobile-path>")
    .replace(/\/var\/folders\/[^\s"';<>|]+/gi, "<tmp-path>")
    .replace(/\/Users\/[^\s"';<>|]+/gi, "<user-path>")
    .replace(/\/data\/(?:user\/\d+|data)\/[^\s"';<>|]+/gi, "<android-data-path>")
    .replace(/\/storage\/emulated\/\d+\/[^\s"';<>|]+/gi, "<android-storage-path>")
    .replace(/\/sdcard\/[^\s"';<>|]+/gi, "<android-storage-path>")
    .replace(/\/(?:home|mnt|media|Volumes)\/[^\s"';<>|]+/gi, "<path>");

  return sanitized.replace(/\s+/g, " ").trim();
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function detectDefaultPlatform(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows/i.test(ua)) return "windows";
  if (/mac os/i.test(ua)) return "macos";
  return "web";
}

export function createDiagnosticContext(
  error: unknown,
  options: CreateDiagnosticOptions
): DiagnosticContext {
  const extraSecrets = options.extraSecrets ?? [];
  const rawMessage = extractErrorMessage(error) || options.userMessage || "Unknown error";
  const stage = options.stage || extractErrorStage(error);
  const errorCode = extractErrorCode(error);
  const userMessage = sanitizeDiagnosticText(
    options.userMessage || rawMessage,
    extraSecrets
  ).slice(0, 300);
  const summary = sanitizeDiagnosticText(rawMessage, extraSecrets).slice(0, 500);
  const elapsedMs =
    typeof options.elapsedMs === "number" && Number.isFinite(options.elapsedMs) && options.elapsedMs >= 0
      ? Math.round(options.elapsedMs)
      : undefined;
  const platform = (options.platform || detectDefaultPlatform()).trim() || "unknown";
  const appVersion = (options.appVersion || APP_VERSION).trim() || APP_VERSION;
  const fingerprint = `SC-${fnv1aHex(
    `${options.area}|${stage ?? ""}|${errorCode ?? ""}|${summary}`
  )}`;

  return {
    area: options.area,
    ...(stage ? { stage } : {}),
    ...(errorCode ? { errorCode } : {}),
    summary,
    userMessage,
    platform,
    appVersion,
    ...(elapsedMs !== undefined ? { elapsedMs } : {}),
    fingerprint,
    timestamp: Date.now(),
  };
}

export function toDiagnosticReportInput(
  context: DiagnosticContext,
  userNote?: string,
  extraSecrets: Array<string | null | undefined> = []
): DiagnosticReportInput {
  const cleanNote = userNote ? sanitizeDiagnosticText(userNote, extraSecrets).slice(0, 200) : "";
  return {
    area: context.area,
    ...(context.stage ? { stage: context.stage } : {}),
    ...(context.errorCode ? { errorCode: context.errorCode } : {}),
    summary: sanitizeDiagnosticText(context.summary, extraSecrets).slice(0, 500),
    userMessage: sanitizeDiagnosticText(context.userMessage, extraSecrets).slice(0, 300),
    ...(cleanNote ? { userNote: cleanNote } : {}),
    platform: context.platform,
    appVersion: context.appVersion,
    ...(context.elapsedMs !== undefined ? { elapsedMs: context.elapsedMs } : {}),
    fingerprint: context.fingerprint,
  };
}
