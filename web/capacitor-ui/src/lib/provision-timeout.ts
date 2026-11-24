import type { ProvisionAndStartResult } from "../capacitor-plugin";

export const PROVISION_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export const PROVISION_MAX_TOTAL_MS = 25 * 60 * 1000;

export type ProvisionTimeoutStatus = "active" | "idle-timeout" | "total-timeout";

/**
 * 基于后端活跃事件（progress / log）续期的创建/启动超时追踪器。
 * 既避免后端仍在正常推进（下载 / npm / 首次冷启动）时被固定 10 分钟墙钟误杀，
 * 也能在真正卡死无输出或超过总预算上限时可靠收口。
 */
export class ProvisionTimeoutTracker {
  private readonly startedAt: number;
  private lastActivityAt: number;
  private readonly idleTimeoutMs: number;
  private readonly maxTotalMs: number;

  constructor(
    now = Date.now(),
    idleTimeoutMs = PROVISION_IDLE_TIMEOUT_MS,
    maxTotalMs = PROVISION_MAX_TOTAL_MS
  ) {
    this.startedAt = now;
    this.lastActivityAt = now;
    this.idleTimeoutMs = idleTimeoutMs;
    this.maxTotalMs = maxTotalMs;
  }

  touch(now = Date.now()): void {
    if (now > this.lastActivityAt) {
      this.lastActivityAt = now;
    }
  }

  check(now = Date.now()): ProvisionTimeoutStatus {
    if (now - this.startedAt >= this.maxTotalMs) {
      return "total-timeout";
    }
    if (now - this.lastActivityAt >= this.idleTimeoutMs) {
      return "idle-timeout";
    }
    return "active";
  }
}

export function formatProvisionTimeoutError(
  reason: Exclude<ProvisionTimeoutStatus, "active">
): string {
  if (reason === "total-timeout") {
    return "超时：下载/安装总耗时过长，请检查网络后重试";
  }
  return "超时：下载/安装长时间无进展，请检查网络或实例日志后重试";
}

export type ProvisionFailureResolution =
  | { kind: "continue" }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

/**
 * 统一消解 provisionAndStart 返回值与异步 error 事件的优先级：
 * 优先消费返回值直带的 error，杜绝 IPC 异步事件竞态或 instanceId 规范化差异导致真实报错被吞。
 */
export function resolveProvisionFailure(
  result: ProvisionAndStartResult | null | undefined,
  eventError: string | null | undefined
): ProvisionFailureResolution {
  if (result?.cancelled === true) {
    return { kind: "cancelled" };
  }
  if (result?.ready === false) {
    const directError = typeof result.error === "string" ? result.error.trim() : "";
    const fallbackError = typeof eventError === "string" ? eventError.trim() : "";
    return {
      kind: "error",
      message: directError || fallbackError || "实例未能启动，请检查安装日志",
    };
  }
  return { kind: "continue" };
}
