import { Capacitor } from "@capacitor/core";
import type { TarvenEnvPlugin, TarvenEvent, GarbageItem, MaintenanceItem, MaintenanceScan, MaintenanceRecovery } from "../capacitor-plugin";
import { exactInstallTarget } from "../lib/install-location";
import { validateExternalUrl } from "../lib/external-url";
import { APP_VERSION } from "../constants/app-version";

type EventName = Parameters<TarvenEnvPlugin["addListener"]>[0];
const listeners = new Map<EventName, Set<(event: TarvenEvent) => void>>();
const calls: { method: string; options?: unknown }[] = [];
const pending = new Map<string, { instanceId: string; port: number; path: string; resolve: (value: { ready: boolean }) => void }>();
const credentials = new Map<string, string>();
let listenerDelay = 0;
let manualProvision = false;
let failDeletes = new Set<string>();
let failMigration = false;
let failCommands = false;
let status: Awaited<ReturnType<TarvenEnvPlugin["getStatus"]>> = { serverReady: false, mode: "launcher" };
let openMode: "webview" | "browser" = "webview";
let migrated = new Map<string, string>();
let scannedInstanceIds = ["preview-local", "preview-second"];
type DirectorySelection = Awaited<ReturnType<TarvenEnvPlugin["pickDirectory"]>>;
let platform: "windows" | "android" | "ios" = "windows";
let directorySelection: DirectorySelection | null | undefined;
let directoryDelay = 0;

function syntheticRoot() {
  return platform === "windows" ? "D:\\Synthetic" : platform === "android"
    ? "/data/user/0/com.sillyclient/files/tarven/installations" : "/private/Synthetic/Documents/Installations";
}
interface MaintenanceFixture {
  failIds?: string[];
  expired?: boolean;
  delayByInstance?: Record<string, number>;
  restoreConflict?: boolean;
}
let maintenanceFixture: MaintenanceFixture = {};
let maintenanceCounter = 0;
const maintenanceItems = new Map<string, MaintenanceItem[]>();
const maintenanceScans = new Map<string, MaintenanceScan>();
const maintenanceRecoveries = new Map<string, MaintenanceRecovery[]>();
const garbage: GarbageItem[] = [
  { path: "synthetic/cache-a", token: "preview-token-a", type: "cache", sizeBytes: 1024, description: "合成缓存 A" },
  { path: "synthetic/cache-b", token: "preview-token-b", type: "cache", sizeBytes: 2048, description: "合成缓存 B" },
];

function emit(name: EventName, event: TarvenEvent) {
  for (const listener of listeners.get(name) || []) listener(event);
}

function complete(operationId: string, ready = true) {
  const operation = pending.get(operationId);
  if (!operation) return;
  pending.delete(operationId);
  if (ready) migrated.set(operation.instanceId, operation.path);
  const event = {
    instanceId: operation.instanceId, operationId, ready, port: operation.port,
    url: `http://127.0.0.1:${operation.port}/`,
  };
  if (status.operationId === operationId) status = { ...status, serverReady: ready, url: event.url };
  emit("ready", event);
  operation.resolve({ ready });
}

function record(method: string, options?: unknown) {
  calls.push({ method, options });
}

function scopedMaintenance(instanceId: string): MaintenanceItem[] {
  const existing = maintenanceItems.get(instanceId);
  if (existing) return existing;
  const items: MaintenanceItem[] = [
    { id: `${instanceId}-cache`, token: "", kind: "download_cache", relativePath: ".sillyclient-maintenance/download-cache/synthetic",
      sizeBytes: 4096, description: "已核验的过期下载缓存", confidence: "owned", defaultSelected: true, action: "delete_cache" },
    { id: `${instanceId}-extension`, token: "", kind: "broken_extension", relativePath: `data/default-user/extensions/${instanceId}-incomplete`,
      sizeBytes: 2048, description: `${instanceId}-incomplete · 缺少 manifest.json`, confidence: "suspected", defaultSelected: false, action: "quarantine" },
    { id: `${instanceId}-reference`, token: "", kind: "stale_extension_reference", relativePath: "data/default-user/settings.json#third-party/synthetic-missing",
      sizeBytes: 512, description: "synthetic-missing · 无对应目录的禁用记录", confidence: "suspected", defaultSelected: false, action: "remove_disabled_reference" },
  ];
  maintenanceItems.set(instanceId, items);
  return items;
}
function maintenanceStopped() {
  if (status.serverReady || status.operationId) throw new Error("Synthetic runtime is busy");
}

export const nativePreview: TarvenEnvPlugin = {
  async addListener(name, callback) {
    if (listenerDelay) await new Promise(resolve => setTimeout(resolve, listenerDelay));
    const group = listeners.get(name) || new Set();
    listeners.set(name, group);
    group.add(callback);
    return { remove: async () => { group.delete(callback); } };
  },
  async provisionAndStart(options) {
    record("provisionAndStart", options);
    const operationId = options.operationId || "legacy-preview";
    status = { serverReady: false, mode: "launcher", instanceId: options.instanceId, operationId };
    emit("log", { instanceId: options.instanceId, operationId, message: "合成运行时：准备启动", level: "info" });
    const result = new Promise<{ ready: boolean }>(resolve => {
      pending.set(operationId, {
        instanceId: options.instanceId, port: options.port, resolve,
        path: exactInstallTarget(options.installPath || syntheticRoot(), options.installPath ? options.installPathMode || "exact" : "root", options.instanceId)!,
      });
    });
    if (!manualProvision) setTimeout(() => complete(operationId), 150);
    return result;
  },
  async closeTavern(options) {
    record("closeTavern", options);
    if (options?.instanceId && status.instanceId && options.instanceId !== status.instanceId) return;
    const stopped = status;
    status = { serverReady: false, mode: "launcher" };
    emit("ready", { ready: false, instanceId: stopped.instanceId, operationId: stopped.operationId });
    emit("mode", { mode: "launcher", tavernRunning: false, instanceId: stopped.instanceId, operationId: stopped.operationId });
  },
  async enterImmersive(options) {
    record("enterImmersive", options);
    const url = validateExternalUrl(options.url);
    if (!options.instanceId?.trim()) {
      await nativePreview.openExternalUrl({ url });
      return;
    }
    const target = new URL(url);
    if (["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
      && status.serverReady && options.instanceId !== status.instanceId) {
      throw new Error("Synthetic native instance mismatch");
    }
    status = { ...status, mode: "tavern" };
  },
  async openExternalUrl(options) {
    const url = validateExternalUrl(options.url);
    record("openExternalUrl", { url });
  },
  async exitImmersive() { record("exitImmersive"); status = { ...status, mode: "launcher" }; },
  async returnToTavern() { record("returnToTavern"); },
  async getStatus() { record("getStatus"); return { ...status }; },
  async fetchReleases() { return { releases: [{ tag: "1.19.0", zipballUrl: "https://example.test/synthetic.zip", prerelease: false }] }; },
  async getAppSettings() {
    record("getAppSettings", {});
    const instancesRoot = syntheticRoot();
    return { instancesRoot, defaultInstancesRoot: instancesRoot };
  },
  async setInstancesRoot(options) {
    record("setInstancesRoot", options ?? {});
    const instancesRoot = options?.path || syntheticRoot();
    return { instancesRoot, configured: Boolean(options?.path) };
  },
  async pickDirectory(options) {
    record("pickDirectory", options);
    const selection = directorySelection === undefined ? {
      name: "Synthetic", path: platform === "windows" ? "D:\\Synthetic\\Tavern" : syntheticRoot(),
      ...(options?.purpose === "installation" ? { installPathMode: "root" as const } : {}),
    } : directorySelection;
    if (directoryDelay) await new Promise(resolve => setTimeout(resolve, directoryDelay));
    if (selection === null) throw new Error("cancelled");
    return { ...selection };
  },
  async pickImage() { return { path: "" }; },
  async pickZipFile() { return { path: "D:\\Synthetic\\backup.zip", sizeBytes: 1 }; },
  async saveTextFile(options) { record("saveTextFile", options); },
  async readTextFile() { return { content: '{"version":2,"instances":[]}', fileName: "synthetic.json" }; },
  async scanInstances() {
    return { instances: scannedInstanceIds.map(instanceId => ({
      instanceId, version: "1.19.0", sizeBytes: 1, hasServer: true,
      path: migrated.get(instanceId) || exactInstallTarget(syntheticRoot(), "root", instanceId),
    })) };
  },
  async getInstanceInfo(options) {
    record("getInstanceInfo", options);
    return {
      instanceId: options.instanceId, version: "1.19.0", sizeBytes: 1,
      path: migrated.get(options.instanceId) || options.installPath || exactInstallTarget(syntheticRoot(), "root", options.instanceId)!,
      createdAt: "2026-10-03", status: status.serverReady ? "running" : "stopped",
    };
  },
  async sendCommand(options) {
    record("sendCommand", options);
    if (failCommands) throw new Error("Synthetic command failure");
    emit("log", {
      instanceId: options.instanceId, operationId: status.operationId,
      message: `合成命令已接收: ${options.text}`, level: "info", source: "command",
    });
  },
  async reloadTavern() { record("reloadTavern"); },
  async clearWebViewData() { record("clearWebViewData"); },
  async getSafeInsets() { return { top: 0, bottom: 0, left: 0, right: 0 }; },
  async setPullToRefresh() {},
  async getContentOpenMode() { return { mode: openMode }; },
  async setContentOpenMode(options) { openMode = options.mode; return options; },
  async setRemoteBasicAuth(options) {
    credentials.set(options.instanceId, options.username);
    return { configured: true, username: options.username };
  },
  async getRemoteBasicAuthStatus(options) {
    const username = credentials.get(options.instanceId);
    return { configured: !!username, username };
  },
  async clearRemoteBasicAuth(options) { credentials.delete(options.instanceId); return { success: true }; },
  async pingUrl() { return { online: true }; },
  async uninstallInstance(options) { record("uninstallInstance", options); return { success: true, freedBytes: 1 }; },
  async cleanGarbage(options) { record("cleanGarbage", options); return { items: garbage.map(item => ({ ...item })), totalBytes: 3072 }; },
  async deleteGarbageItem(options) {
    record("deleteGarbageItem", options);
    if (failDeletes.has(options.path)) return { success: false, error: "Synthetic deletion refusal" };
    if (!garbage.some(item => item.path === options.path && item.token === options.token)) throw new Error("Invalid scan token");
    return { success: true };
  },
  async scanInstanceMaintenance(options) {
    record("scanInstanceMaintenance", options);
    maintenanceStopped();
    const delay = maintenanceFixture.delayByInstance?.[options.instanceId] || 0;
    const expired = maintenanceFixture.expired;
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const scanId = `preview-scan-${++maintenanceCounter}`;
    const scan: MaintenanceScan = {
      instanceId: options.instanceId, scanId, expiresAt: Date.now() + (expired ? -1 : 5 * 60_000),
      items: scopedMaintenance(options.instanceId).map(item => ({ ...item, token: `${scanId}-${item.id}` })),
      warnings: ["合成维护数据，不读写真实实例"],
    };
    maintenanceScans.set(options.instanceId, scan);
    return scan;
  },
  async applyInstanceMaintenance(options) {
    record("applyInstanceMaintenance", options);
    maintenanceStopped();
    const scan = maintenanceScans.get(options.instanceId);
    if (!scan || scan.scanId !== options.scanId || scan.expiresAt <= Date.now()) throw new Error("维护扫描已过期");
    if (options.items.some(selection => !scan.items.some(item => item.id === selection.id && item.token === selection.token))) {
      throw new Error("Invalid synthetic maintenance token");
    }
    const results = options.items.map(selection => {
      const item = scan.items.find(candidate => candidate.id === selection.id)!;
      if (maintenanceFixture.failIds?.includes(item.id)) return {
        id: item.id, success: false, action: item.action, error: "Synthetic item changed; preserved",
        freedBytes: 0, quarantinedBytes: 0,
      };
      const recoveryId = `preview-recovery-${++maintenanceCounter}`;
      const recovery: MaintenanceRecovery = {
        recoveryId, token: `restore-${recoveryId}`, createdAt: Date.now(), description: item.description,
        relativePath: item.relativePath, kind: item.kind, action: item.action, sizeBytes: item.sizeBytes, canRestore: true,
      };
      maintenanceRecoveries.set(options.instanceId, [...(maintenanceRecoveries.get(options.instanceId) || []), recovery]);
      return { id: item.id, success: true, action: item.action, freedBytes: 0,
        quarantinedBytes: item.kind === "stale_extension_reference" ? 0 : item.sizeBytes, recoveryId };
    });
    maintenanceScans.delete(options.instanceId);
    const completed = new Set(results.filter(result => result.success).map(result => result.id));
    maintenanceItems.set(options.instanceId, scopedMaintenance(options.instanceId).filter(item => !completed.has(item.id)));
    return { success: results.every(result => result.success), results, freedBytes: 0,
      quarantinedBytes: results.reduce((total, result) => total + result.quarantinedBytes, 0),
      recoveryIds: results.flatMap(result => result.recoveryId ? [result.recoveryId] : []) };
  },
  async listInstanceMaintenanceRecovery(options) {
    record("listInstanceMaintenanceRecovery", options);
    maintenanceStopped();
    return { items: (maintenanceRecoveries.get(options.instanceId) || []).map(item => maintenanceFixture.restoreConflict
      ? { ...item, canRestore: false, token: "", conflict: "同名目录已存在，不能覆盖" } : { ...item }), warnings: [] };
  },
  async restoreInstanceMaintenance(options) {
    record("restoreInstanceMaintenance", options);
    maintenanceStopped();
    const item = maintenanceRecoveries.get(options.instanceId)?.find(candidate => candidate.recoveryId === options.recoveryId);
    if (!item || !options.token || item.token !== options.token || maintenanceFixture.restoreConflict) {
      return { success: false, error: "Synthetic restore refused; destination preserved" };
    }
    maintenanceRecoveries.set(options.instanceId,
      maintenanceRecoveries.get(options.instanceId)!.filter(candidate => candidate.recoveryId !== options.recoveryId));
    return { success: true, recoveryId: options.recoveryId, relativePath: item.relativePath };
  },
  async migrateInstance(options) {
    record("migrateInstance", options);
    if (failMigration) return { success: false, instanceId: options.instanceId };
    const targetPath = options.mode === "takeover" ? options.sourcePath : options.targetPath || exactInstallTarget(syntheticRoot(), "root", options.instanceId)!;
    migrated.set(options.instanceId, targetPath);
    return { success: true, instanceId: options.instanceId, targetPath };
  },
  async checkLegacyInstances() {
    record("checkLegacyInstances", {});
    return { instances: [] };
  },
  async relocateInstance(options) {
    record("relocateInstance", options);
    const newPath = options.targetPath || exactInstallTarget(syntheticRoot(), "root", options.instanceId)!;
    return { success: true, instanceId: options.instanceId, oldPath: "C:\\AppData\\Legacy", newPath };
  },
  async migrateLegacyInstances(options = {}) {
    record("migrateLegacyInstances", options);
    return { success: true, results: [] };
  },
  async renameInstance(options) {
    record("renameInstance", options);
    const newId = options.newName.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").slice(0, 100) || "instance";
    return {
      success: true,
      oldId: options.instanceId,
      newId,
      oldPath: options.installPath || `D:\\Software\\AI\\Entertainment\\SillyClient\\instances\\${options.instanceId}`,
      newPath: `D:\\Software\\AI\\Entertainment\\SillyClient\\instances\\${newId}`,
    };
  },
  async setInstancePassword(options) {
    record("setInstancePassword", options);
    const existing = credentials.get(`pwd:${options.instanceId}`);
    if (existing && options.oldPassword && options.oldPassword !== existing) {
      throw new Error("原访问密码错误，无法更改或解除");
    }
    if (!options.password || !options.password.trim()) {
      credentials.delete(`pwd:${options.instanceId}`);
      return { success: true, hasPassword: false };
    }
    credentials.set(`pwd:${options.instanceId}`, options.password.trim());
    return { success: true, hasPassword: true };
  },
  async verifyInstancePassword(options) {
    record("verifyInstancePassword", options);
    const existing = credentials.get(`pwd:${options.instanceId}`);
    if (!existing) return { valid: true };
    return { valid: options.password === existing };
  },
  async hasInstancePassword(options) {
    record("hasInstancePassword", options);
    return { hasPassword: credentials.has(`pwd:${options.instanceId}`) };
  },
  async clearInstancePassword(options) {
    record("clearInstancePassword", options);
    const existing = credentials.get(`pwd:${options.instanceId}`);
    if (existing && options.oldPassword && options.oldPassword !== existing) {
      throw new Error("原访问密码错误，无法解除密码保护");
    }
    credentials.delete(`pwd:${options.instanceId}`);
    return { success: true };
  },
  async listInstancePasswordStatus() {
    record("listInstancePasswordStatus", {});
    const result: Record<string, boolean> = {};
    for (const key of credentials.keys()) {
      if (key.startsWith("pwd:")) {
        result[key.slice(4)] = true;
      }
    }
    return result;
  },
};

export function installNativePreview() {
  const global = window as typeof window & {
    __SILLYCLIENT_PLATFORM__?: string;
    __SILLYCLIENT_TEST__?: unknown;
    __SILLYCLIENT_PREVIEW_FIXTURE__?: {
      scannedInstanceIds?: string[];
      status?: Awaited<ReturnType<TarvenEnvPlugin["getStatus"]>>;
      contentOpenMode?: "webview" | "browser";
      maintenance?: MaintenanceFixture;
      platform?: "windows" | "android" | "ios";
      directorySelection?: DirectorySelection | null;
      directoryDelay?: number;
    };
  };
  if (global.__SILLYCLIENT_PREVIEW_FIXTURE__?.scannedInstanceIds) {
    scannedInstanceIds = [...global.__SILLYCLIENT_PREVIEW_FIXTURE__.scannedInstanceIds];
  }
  if (global.__SILLYCLIENT_PREVIEW_FIXTURE__?.status) {
    status = { ...global.__SILLYCLIENT_PREVIEW_FIXTURE__.status };
  }
  if (global.__SILLYCLIENT_PREVIEW_FIXTURE__?.contentOpenMode) {
    openMode = global.__SILLYCLIENT_PREVIEW_FIXTURE__.contentOpenMode;
  }
  if (global.__SILLYCLIENT_PREVIEW_FIXTURE__?.maintenance) {
    maintenanceFixture = { ...global.__SILLYCLIENT_PREVIEW_FIXTURE__.maintenance };
  }
  platform = global.__SILLYCLIENT_PREVIEW_FIXTURE__?.platform || "windows";
  directorySelection = global.__SILLYCLIENT_PREVIEW_FIXTURE__?.directorySelection;
  directoryDelay = global.__SILLYCLIENT_PREVIEW_FIXTURE__?.directoryDelay || 0;
  global.__SILLYCLIENT_PLATFORM__ = platform;
  Capacitor.isNativePlatform = () => true;
  Capacitor.getPlatform = () => platform;
  global.__SILLYCLIENT_TEST__ = {
    calls, emit, complete,
    configure(options: {
      manualProvision?: boolean; listenerDelay?: number; failDeletes?: string[];
      failMigration?: boolean; failCommands?: boolean;
      scannedInstanceIds?: string[];
      maintenance?: MaintenanceFixture;
      status?: Awaited<ReturnType<TarvenEnvPlugin["getStatus"]>>;
      directorySelection?: DirectorySelection | null;
      directoryDelay?: number;
    }) {
      manualProvision = options.manualProvision ?? manualProvision;
      listenerDelay = options.listenerDelay ?? listenerDelay;
      if (options.failDeletes) failDeletes = new Set(options.failDeletes);
      failMigration = options.failMigration ?? failMigration;
      failCommands = options.failCommands ?? failCommands;
      if (options.scannedInstanceIds) scannedInstanceIds = [...options.scannedInstanceIds];
      if (options.maintenance) maintenanceFixture = { ...maintenanceFixture, ...options.maintenance };
      if (options.status) status = { ...options.status };
      if ("directorySelection" in options) directorySelection = options.directorySelection;
      if (options.directoryDelay !== undefined) directoryDelay = options.directoryDelay;
    },
    pending: () => Array.from(pending.keys()),
    listeners: () => Object.fromEntries(Array.from(listeners, ([name, group]) => [name, group.size])),
  };
  localStorage.setItem("sillyclient.onboarding.version", "3");
  localStorage.setItem("sillyclient.whatsnew.version", APP_VERSION);
  localStorage.setItem("sillyclient.instances.version", "2");
  if (!localStorage.getItem("sillyclient.instances")) {
    localStorage.setItem("sillyclient.instances", JSON.stringify(["preview-local", "preview-second"].map((id, index) => ({
      id, installDir: id, name: "SillyTavern", subtitle: `合成实例 ${index + 1}`, type: "local",
      status: "stopped", color: "#6366f1", version: "1.19.0", port: 8000 + index,
      createdAt: "2026-10-03", lastUsed: "—", totalUsage: "0s",
    }))));
  }
}
