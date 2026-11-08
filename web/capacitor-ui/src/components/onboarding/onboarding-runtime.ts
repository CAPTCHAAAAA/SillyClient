import { Capacitor } from "@capacitor/core";
import type { TarvenEnvPlugin, TarvenEvent } from "../../capacitor-plugin";
import { normalizeRenderEngineSettings } from "../../lib/render-settings";
import { ONBOARDING_CHANNEL, onboardingSessionId, postOnboardingMessage, type OnboardingSeed } from "../../lib/onboarding-mode";

type EventName = Parameters<TarvenEnvPlugin["addListener"]>[0];
type ProvisionOptions = Parameters<TarvenEnvPlugin["provisionAndStart"]>[0];

const listeners = new Map<EventName, Set<(event: TarvenEvent) => void>>();
const instances = new Map<string, { path: string; version: string; running: boolean }>();
let seed: OnboardingSeed;
let renderSettings = normalizeRenderEngineSettings(null);
let activeOperation: { options: ProvisionOptions; resolve: (value: { ready: boolean }) => void } | null = null;
let started = false;

export function notifyOnboardingStarted() {
  started = true;
  postOnboardingMessage("started");
}

function emit(name: EventName, event: TarvenEvent) {
  listeners.get(name)?.forEach((listener) => listener(event));
}

export function completeOnboardingOperation() {
  const operation = activeOperation;
  if (!operation) return;
  activeOperation = null;
  const { instanceId, operationId, port, installPath, version } = operation.options;
  instances.set(instanceId, {
    path: installPath || `${localStorage.getItem("sillyclient.onboarding.instancesRoot")}/${instanceId}`,
    version,
    running: true,
  });
  const event = { instanceId, operationId, port, url: `http://127.0.0.1:${port}/`, ready: true };
  emit("progress", { ...event, percent: 100, stage: "ready" });
  emit("log", { ...event, message: "SillyTavern 已就绪", level: "success" });
  emit("ready", event);
  operation.resolve({ ready: true });
}

const methods = {
  async addListener(name, listener) {
    const group = listeners.get(name) || new Set();
    group.add(listener);
    listeners.set(name, group);
    return { remove: async () => { group.delete(listener); } };
  },
  async scanInstances() {
    return {
      instances: [...instances].map(([instanceId, value]) => ({
        instanceId, version: value.version, path: value.path, sizeBytes: 134217728, hasServer: true,
      })),
    };
  },
  async getStatus() {
    const running = [...instances].find(([, value]) => value.running);
    return { mode: "launcher", serverReady: Boolean(running), instanceId: running?.[0] };
  },
  async getInstanceInfo({ instanceId }) {
    const instance = instances.get(instanceId);
    return {
      instanceId, path: instance?.path || instanceId, version: instance?.version || "1.14.1",
      sizeBytes: 134217728, createdAt: "2026-11-08T00:00:00Z",
      status: instance?.running ? "running" : "stopped", totalUsageMs: 3600000,
    };
  },
  async provisionAndStart(options) {
    if (activeOperation) throw new Error("请先完成当前练习");
    return new Promise<{ ready: boolean }>((resolve) => {
      activeOperation = { options, resolve };
      emit("log", {
        instanceId: options.instanceId, operationId: options.operationId,
        message: options.createIntent ? "正在准备实例文件" : "正在启动 SillyTavern", level: "info",
      });
      emit("progress", {
        instanceId: options.instanceId, operationId: options.operationId,
        percent: 68, stage: options.createIntent ? "download" : "waiting",
      });
    });
  },
  async closeTavern(options) {
    if (activeOperation && (!options?.instanceId || options.instanceId === activeOperation.options.instanceId)) {
      const pending = activeOperation;
      activeOperation = null;
      pending.resolve({ ready: false });
    }
    for (const [instanceId, value] of instances) {
      if (!options?.instanceId || options.instanceId === instanceId) value.running = false;
    }
  },
  async enterImmersive() {},
  async exitImmersive() {},
  async returnToTavern() {},
  async openExternalUrl() {},
  async reloadTavern() {},
  async clearWebViewData() {},
  async setPullToRefresh() {},
  async getSafeInsets() {
    return { top: seed.safeInsetTop * window.devicePixelRatio, bottom: 0, left: 0, right: 0 };
  },
  async getRenderEngineSettings() { return renderSettings; },
  async setRenderEngineSettings(options) { renderSettings = normalizeRenderEngineSettings(options); },
  async getContentOpenMode() { return { mode: "webview" as const }; },
  async setContentOpenMode({ mode }) { return { mode }; },
  async getAppSettings() {
    const root = localStorage.getItem("sillyclient.onboarding.instancesRoot")!;
    return { instancesRoot: root, defaultInstancesRoot: root };
  },
  async setInstancesRoot({ path } = {}) {
    return { instancesRoot: path || localStorage.getItem("sillyclient.onboarding.instancesRoot")!, configured: Boolean(path) };
  },
  async fetchReleases() {
    return { releases: [{ tag: "1.14.1", name: "1.14.1", zipballUrl: "https://example.invalid/tutorial.zip", prerelease: false }] };
  },
  async pickDirectory() {
    return { name: "练习目录", path: localStorage.getItem("sillyclient.onboarding.instancesRoot")!, installPathMode: "root" as const };
  },
  async pickZipFile() { return { path: "练习备份.zip", sizeBytes: 4096 }; },
  async inspectImportArchive() {
    return { importEntries: 12, importBytes: 4096, skippedEntries: 2, skippedBytes: 1024, hasSecrets: false, hasConfig: false, importable: true };
  },
  async importInstanceData() { return { imported: 12, bytes: 4096, skipped: 2 }; },
  async listInstancePasswordStatus() { return {}; },
  async getRemoteBasicAuthStatus() { return { configured: false }; },
  async sendCommand({ instanceId, text }) {
    emit("log", { instanceId, message: `练习模式：未执行命令 ${text}`, source: "command", level: "info" });
  },
} satisfies Partial<TarvenEnvPlugin>;

export const onboardingEnvironment = new Proxy({} as TarvenEnvPlugin, {
  get(_target, property) {
    if (property === "then") return undefined;
    const method = methods[property as keyof typeof methods];
    return method || (() => Promise.reject(new Error("此操作不在演练范围内，不会调用后端")));
  },
});

export async function installOnboardingSandbox() {
  seed = await new Promise<OnboardingSeed>((resolve) => {
    let initialized = false;
    const initialize = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (event.data?.channel !== ONBOARDING_CHANNEL || event.data.type !== "initialize") return;
      const next = event.data.seed as OnboardingSeed | undefined;
      if (!next || next.sessionId !== onboardingSessionId
        || !["web", "windows", "android", "ios"].includes(next.platform)
        || !["dynamic", "custom"].includes(next.bgMode)
        || !["light", "dark"].includes(next.themeStyle)
        || !Number.isFinite(next.safeInsetTop)) return;
      if (!initialized) {
        initialized = true;
        resolve(next);
      } else if (started) {
        postOnboardingMessage("started");
      }
    };
    window.addEventListener("message", initialize);
    window.addEventListener("pagehide", () => {
      window.removeEventListener("message", initialize);
    }, { once: true });
    postOnboardingMessage("ready");
  });

  const root = seed.platform === "windows" ? "C:\\Tutorial\\Instances" : "/tutorial/instances";
  localStorage.setItem("sillyclient.bgMode", seed.bgMode);
  localStorage.setItem("sillyclient.themeStyle", seed.themeStyle);
  localStorage.setItem("sillyclient.instances.version", "2");
  localStorage.setItem("sillyclient.createCardPinned", "true");
  localStorage.setItem("sillyclient.onboarding.instancesRoot", root);
  const records = ["onboarding-stopped", "onboarding-second"].map((id, index) => {
    const path = `${root}${seed.platform === "windows" ? "\\" : "/"}${id}`;
    instances.set(id, { path, version: "1.14.1", running: false });
    return {
      id, name: "SillyTavern", subtitle: index === 0 ? "练习酒馆" : "备用酒馆", version: "1.14.1",
      type: "local", status: "stopped", installDir: id, installPath: path, installPathMode: "exact",
      port: 8000 + index, createdAt: "2026-11-08", lastUsed: "刚刚", totalUsage: "1h", color: "#a3e635",
    };
  });
  localStorage.setItem("sillyclient.instances", JSON.stringify(records));
  Capacitor.isNativePlatform = () => true;
  Capacitor.getPlatform = () => seed.platform;
  if (seed.platform === "windows") {
    (window as typeof window & { __SILLYCLIENT_PLATFORM__?: string }).__SILLYCLIENT_PLATFORM__ = "windows";
  }
}

export function finishOnboardingSandbox() {
  postOnboardingMessage("finish");
}
