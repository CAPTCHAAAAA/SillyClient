import type { InstanceConfig } from "../capacitor-plugin";
import type { TavernInstance } from "../types";
import { normalizeStoredVersion } from "./utils";

export type StoredInstance = Omit<TavernInstance, "icon">;

const MAX_INSTANCES = 2000;
const MAX_BACKUP_LENGTH = 5 * 1024 * 1024;
const MAX_HEARTBEAT = 2_147_483_647;
const STATUSES = new Set(["running", "stopped", "error", "online", "offline"]);
const PREINSTALL_IDS = new Set(["tavern-helper", "littlewhitebox", "prompt-template", "dice"]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown, maxLength = 512): string | undefined {
  if (typeof value !== "string" || value.length > maxLength) return undefined;
  return value;
}

function filePath(value: unknown): string | undefined {
  const path = text(value, 8192)?.trim().replace(/^["']|["']$/g, "").trim();
  return path || undefined;
}

function httpUrl(value: unknown): string | undefined {
  const candidate = text(value, 8192)?.trim();
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return undefined;
    }
    return candidate;
  } catch {
    return undefined;
  }
}

function config(value: unknown): InstanceConfig | undefined {
  const input = record(value);
  if (!input) return undefined;
  const boolean = (key: string, fallback: boolean) =>
    typeof input[key] === "boolean" ? input[key] as boolean : fallback;
  return {
    listen: boolean("listen", false),
    ipv4: boolean("ipv4", true),
    ipv6: boolean("ipv6", false),
    dnsIpv6: boolean("dnsIpv6", false),
    heartbeat: typeof input.heartbeat === "number"
      && Number.isFinite(input.heartbeat)
      && input.heartbeat >= 0
      && input.heartbeat <= MAX_HEARTBEAT
      ? Math.floor(input.heartbeat)
      : 0,
    keepAlive: boolean("keepAlive", false),
  };
}

function normalizeInstance(value: unknown, resetStatus: boolean): StoredInstance | undefined {
  const input = record(value);
  if (!input || (input.type !== "local" && input.type !== "remote")) return undefined;
  const id = text(input.id, 160)?.trim();
  const name = text(input.name, 256)?.trim();
  if (!id || !name || /[\u0000-\u001f]/.test(id)) return undefined;

  const status = typeof input.status === "string" && STATUSES.has(input.status)
    ? input.status as StoredInstance["status"]
    : input.type === "local" ? "stopped" : "offline";
  const result: StoredInstance = {
    id,
    name,
    type: input.type,
    status: resetStatus ? (input.type === "local" ? "stopped" : "offline") : status,
    color: text(input.color, 128) || "#a3e635",
  };

  for (const key of ["subtitle", "createdAt", "lastUsed", "totalUsage"] as const) {
    const value = text(input[key]);
    if (value !== undefined) result[key] = value;
  }
  const version = text(input.version, 128);
  if (version) result.version = normalizeStoredVersion(version);
  const cover = text(input.cover, 2 * 1024 * 1024);
  if (cover && !cover.startsWith("?")) {
    // Credential-bearing URLs must not reach browser storage through any field.
    if (!/^https?:/i.test(cover) || httpUrl(cover)) result.cover = cover;
  }
  if (input.type === "remote") {
    const url = httpUrl(input.url);
    if (!url) return undefined;
    result.url = url;
    const auth = record(input.basicAuth);
    const username = auth && text(auth.username, 1024);
    if (username !== undefined) result.basicAuth = { username };
  } else {
    const port = input.port;
    if (typeof port === "number" && Number.isInteger(port) && port > 0 && port <= 65535) {
      result.port = port;
    }
    const installDir = text(input.installDir, 160)?.trim();
    if (installDir && !/[\u0000-\u001f\\/]/.test(installDir)) result.installDir = installDir;
    const installPath = filePath(input.installPath);
    if (installPath) result.installPath = installPath;
    if (installPath && (input.installPathMode === "root" || input.installPathMode === "exact")) {
      result.installPathMode = input.installPathMode;
    }
    const localZipPath = filePath(input.localZipPath);
    if (localZipPath) result.localZipPath = localZipPath;
    const zipballUrl = httpUrl(input.zipballUrl);
    if (zipballUrl) result.zipballUrl = zipballUrl;
    const normalizedConfig = config(input.config);
    if (normalizedConfig) result.config = normalizedConfig;
    const preset = record(input.companionPreset);
    if (preset?.bundleId === "sc-bordeaux"
      && typeof preset.revision === "number"
      && Number.isInteger(preset.revision)
      && preset.revision >= 0) {
      result.companionPreset = { bundleId: "sc-bordeaux", revision: preset.revision };
    }
    const preinstall = record(input.preinstall);
    if (preinstall?.revision === 1 && Array.isArray(preinstall.extensionIds)) {
      const extensionIds = [...new Set(preinstall.extensionIds.filter(
        (id): id is NonNullable<StoredInstance["preinstall"]>["extensionIds"][number] =>
          typeof id === "string" && PREINSTALL_IDS.has(id),
      ))];
      if (extensionIds.length) result.preinstall = { revision: 1, extensionIds };
    }
    if (!resetStatus && input.pendingTavernGestureHint === true) {
      result.pendingTavernGestureHint = true;
    }
  }
  if (typeof input.hasPassword === "boolean") {
    result.hasPassword = input.hasPassword;
  }
  return result;
}

/** Persist and import through the same whitelist; never spread external records. */
export function normalizeStoredInstances(
  value: unknown,
  options: { resetStatus?: boolean } = {},
): StoredInstance[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_INSTANCES) throw new Error("Instance list is too large");
  const instances = new Map<string, StoredInstance>();
  for (const input of value) {
    const instance = normalizeInstance(input, options.resetStatus === true);
    if (instance) instances.set(instance.id, instance);
  }
  return [...instances.values()];
}

export function serializeInstanceRecords(instances: readonly unknown[]): StoredInstance[] {
  return normalizeStoredInstances(instances);
}

export function parseInstanceBackup(content: string): StoredInstance[] {
  if (content.length > MAX_BACKUP_LENGTH) throw new Error("Instance backup is too large");
  const backup = record(JSON.parse(content));
  if (!backup || !Array.isArray(backup.instances)) throw new Error("Invalid instance backup");
  if (backup.version !== undefined && backup.version !== 1 && backup.version !== 2) {
    throw new Error("Unsupported instance backup version");
  }
  const instances = normalizeStoredInstances(backup.instances, { resetStatus: true });
  if (backup.instances.length > 0 && instances.length === 0) {
    throw new Error("Instance backup contains no valid records");
  }
  return instances;
}

export function createInstanceBackup(instances: readonly unknown[]): string {
  const content = JSON.stringify({
    version: 2,
    instances: normalizeStoredInstances(instances, { resetStatus: true }),
    exportedAt: new Date().toISOString(),
  }, null, 2);
  if (content.length > MAX_BACKUP_LENGTH) throw new Error("Instance backup is too large");
  return content;
}
