import { useEffect, useState } from "react";
import type { DiagnosticArea } from "../capacitor-plugin";
import {
  createDiagnosticContext,
  extractErrorMessage,
  humanizeNativeError,
  isUserCancellationError,
  type DiagnosticContext,
} from "./native-errors";

export interface GlobalErrorEntry {
  id: number;
  message: string;
  diagnostic: DiagnosticContext;
  extraSecrets?: Array<string | null | undefined>;
}

export interface ReportGlobalErrorOptions {
  area?: DiagnosticArea;
  stage?: string;
  platform?: string;
  userMessage?: string;
  diagnostic?: DiagnosticContext | null;
  extraSecrets?: Array<string | null | undefined>;
  force?: boolean;
}

const BENIGN_GLOBAL_ERROR_RE =
  /ResizeObserver loop|Script error\.?$|Non-Error promise rejection captured/i;

const AREA_LABELS: Record<DiagnosticArea, string> = {
  picker: "目录权限",
  create: "创建实例",
  launch: "启动运行",
  manage: "实例管理",
  relocate: "目录迁移",
  import: "导入备份",
  export: "导出备份",
  maintenance: "实例维护",
  cleanup: "临时清理",
  rename: "实例改名",
  terminal: "终端命令",
  auth: "安全验证",
  settings: "应用设置",
  update: "版本更新",
  onboarding: "使用引导",
  runtime: "运行异常",
};

export function getDiagnosticAreaLabel(area?: DiagnosticArea): string {
  if (!area) return "问题反馈";
  return AREA_LABELS[area] ?? "问题反馈";
}

let currentError: GlobalErrorEntry | null = null;
let nextErrorId = 1;
let lastFingerprint = "";
let lastReportedAt = 0;
let listenersInstalled = false;
const subscribers = new Set<() => void>();

function notify() {
  for (const listener of subscribers) {
    listener();
  }
}

export function getActiveGlobalError(): GlobalErrorEntry | null {
  return currentError;
}

export function dismissGlobalError(id?: number) {
  if (!currentError) return;
  if (id !== undefined && currentError.id !== id) return;
  currentError = null;
  lastFingerprint = "";
  lastReportedAt = 0;
  notify();
}

export function reportGlobalError(
  error: unknown,
  options: ReportGlobalErrorOptions = {}
): GlobalErrorEntry | null {
  if (!error && !options.diagnostic && !options.userMessage) return null;
  if (
    error instanceof Error &&
    error.name === "OperationCancelledError"
  ) {
    return null;
  }
  if (isUserCancellationError(error)) {
    return null;
  }

  const rawText = extractErrorMessage(error);
  if (rawText && BENIGN_GLOBAL_ERROR_RE.test(rawText)) {
    return null;
  }

  const message =
    options.userMessage?.trim() ||
    options.diagnostic?.userMessage?.trim() ||
    humanizeNativeError(error);

  const diagnostic =
    options.diagnostic ??
    createDiagnosticContext(error || message, {
      area: options.area ?? "runtime",
      stage: options.stage,
      platform: options.platform,
      userMessage: message,
      extraSecrets: options.extraSecrets,
    });

  const now = Date.now();
  if (
    !options.force &&
    diagnostic.fingerprint === lastFingerprint &&
    now - lastReportedAt < 3000
  ) {
    return currentError;
  }
  lastFingerprint = diagnostic.fingerprint;
  lastReportedAt = now;

  currentError = {
    id: nextErrorId++,
    message,
    diagnostic,
    extraSecrets: options.extraSecrets,
  };
  notify();
  return currentError;
}

export function installGlobalErrorListeners() {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;

  window.addEventListener("error", (event) => {
    const payload = event.error ?? event.message;
    if (!payload) return;
    reportGlobalError(payload, {
      area: "runtime",
      stage: "window-error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!event.reason) return;
    reportGlobalError(event.reason, {
      area: "runtime",
      stage: "unhandled-rejection",
    });
  });
}

export function useGlobalError(): GlobalErrorEntry | null {
  const [entry, setEntry] = useState<GlobalErrorEntry | null>(() => currentError);

  useEffect(() => {
    setEntry(currentError);
    const update = () => setEntry(currentError);
    subscribers.add(update);
    return () => {
      subscribers.delete(update);
    };
  }, []);

  return entry;
}
