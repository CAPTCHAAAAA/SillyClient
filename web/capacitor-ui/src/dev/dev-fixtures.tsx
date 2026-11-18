import { AlertTriangle, Folder } from "lucide-react";
import type { AppUpdateInfo } from "../capacitor-plugin";
import { APP_VERSION } from "../constants/app-version";
import { extractReleaseSummary } from "../lib/app-update";
import { createDiagnosticContext } from "../lib/native-errors";
import type { LauncherPreviewConsoleOptions, TavernInstance } from "../types";

export const DEV_FAULT_TEST_INSTANCE_ID = "__dev-fault-test-card__";

const BASE_DEMO_INSTANCE: TavernInstance = {
  id: "demo-instance",
  name: "演示实例",
  subtitle: "主酒馆 · 运行中",
  version: "1.12.4",
  status: "running",
  type: "local",
  createdAt: "2026-08-22",
  lastUsed: "刚刚",
  totalUsage: "3 小时",
  color: "#a3e635",
  port: 8000,
  icon: <Folder className="w-5 h-5" />,
};

export const DEV_DEMO_RUNNING_INSTANCES: readonly TavernInstance[] = [
  BASE_DEMO_INSTANCE,
  {
    ...BASE_DEMO_INSTANCE,
    id: "demo-running-second",
    name: "SillyTavern",
    subtitle: "测试酒馆 · 运行中",
    version: "1.19.0",
    port: 8001,
  },
  {
    ...BASE_DEMO_INSTANCE,
    id: "demo-running-third",
    name: "SillyTavern",
    subtitle: "备用酒馆 · 运行中",
    version: "stable",
    port: 8002,
  },
];

export const DEV_FAULT_TEST_INSTANCE: TavernInstance = {
  id: DEV_FAULT_TEST_INSTANCE_ID,
  name: "异常自动捕获测试",
  subtitle: "点击展开 · 点启动必报错",
  version: "dev",
  status: "error",
  type: "remote",
  url: "http://127.0.0.1:59999",
  createdAt: "测试卡片",
  lastUsed: "点开后点击启动",
  totalUsage: "0s",
  color: "#8b3a52",
  port: 59999,
  icon: <AlertTriangle className="w-5 h-5" />,
};

export const DEV_ALL_PREVIEW_INSTANCE_IDS = new Set([
  DEV_FAULT_TEST_INSTANCE_ID,
  ...DEV_DEMO_RUNNING_INSTANCES.map((item) => item.id),
]);

export function createMockAppUpdate(): AppUpdateInfo {
  return {
    currentVersion: APP_VERSION,
    latestVersion: "1.14.4",
    updateAvailable: true,
    releaseUrl: "https://github.com/CAPTCHAAAAA/SillyClient/releases/latest",
    releaseSummary: extractReleaseSummary(
      "# SillyClient v1.14.4\n\n> DEV 本地预览更新横幅：用于验证新版本提示与摘要折行排版，仅开发环境可见，生产包构建自动剔除。"
    ),
  };
}

export function createPreviewLaunchOptions(
  mode: "progress" | "complete" | "failure",
): LauncherPreviewConsoleOptions {
  if (mode === "failure") {
    const err = Object.assign(
      new Error("ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:59999 at openRemoteInstance"),
      { stage: "pingUrl", code: "ECONNREFUSED" },
    );
    const diagnostic = createDiagnosticContext(err, {
      area: "launch",
      stage: "pingUrl",
      elapsedMs: 1200,
      platform: "web",
      userMessage: err.message,
    });
    return {
      purpose: "launch",
      instance: DEV_FAULT_TEST_INSTANCE,
      progress: null,
      logs: [
        { msg: `检查 ${DEV_FAULT_TEST_INSTANCE.url}`, level: "info" },
        { msg: `失败: ${err.message}`, level: "error" },
      ],
      error: err.message,
      diagnostic,
    };
  }

  const demoInstance: TavernInstance = {
    ...BASE_DEMO_INSTANCE,
    id: "demo-test",
    name: "体验新实例",
    subtitle: "体验新实例",
    type: "local",
  };

  if (mode === "complete") {
    return {
      purpose: "create",
      instance: demoInstance,
      progress: { pct: 100, text: "创建完成，可以运行" },
      logs: [{ msg: "服务可访问，实例创建完成", level: "success" }],
      error: null,
      diagnostic: null,
    };
  }

  return {
    purpose: "create",
    instance: demoInstance,
    progress: { pct: 45, text: "正在下载运行环境..." },
    logs: [
      { msg: "开始创建 体验新实例", level: "info" },
      { msg: "解压运行时与核心组件...", level: "info" },
    ],
    error: null,
    diagnostic: null,
  };
}

export function createSampleRuntimeReportError() {
  const previewError = Object.assign(
    new Error("TypeError: Cannot read properties of undefined (reading 'servicePort') at startTavernRuntime"),
    { stage: "runtimeInit", code: "ERR_UNHANDLED_RUNTIME" },
  );
  const diagnostic = createDiagnosticContext(previewError, {
    area: "runtime",
    stage: "runtimeInit",
    elapsedMs: 1420,
    platform: "windows",
  });
  return { previewError, diagnostic };
}
