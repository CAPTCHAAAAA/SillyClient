import type { TavernInstance } from "../types";

type AccessTarget = Pick<TavernInstance, "id" | "installDir" | "installPath" | "type" | "url">;

export function instanceAccessIdentity(instance: AccessTarget): string {
  return instance.installDir || instance.id;
}

export function instanceAccessTarget(instance: AccessTarget): string {
  return JSON.stringify([instance.id, instanceAccessIdentity(instance), instance.type,
    instance.installPath || "", instance.url || ""]);
}

export async function readInstancePasswordStatus(
  instance: AccessTarget,
  read: (options: { instanceId: string }) => Promise<{ hasPassword: boolean }>,
): Promise<boolean> {
  const result = await read({ instanceId: instanceAccessIdentity(instance) });
  if (typeof result?.hasPassword !== "boolean") throw new Error("无法确认实例密码状态，请重试");
  return result.hasPassword;
}

export function requireUnlockedRemoteDeletion(hasPassword: boolean): void {
  if (hasPassword) throw new Error("请先在实例管理的启动参数中输入原密码并解除访问密码保护，再删除远程实例。");
}

/** A response belongs to one visible target; closing or changing it revokes pending UI work. */
export class InstanceAccessScope {
  private target: string | null = null;
  private revision = 0;
  private pending = false;

  select(target: string | null): void {
    if (target === this.target) return;
    this.target = target;
    this.revision++;
    this.pending = false;
  }

  begin() {
    if (!this.target || this.pending) return null;
    const revision = ++this.revision;
    this.pending = true;
    return {
      isCurrent: () => this.revision === revision && this.target !== null,
      finish: () => { if (this.revision === revision) this.pending = false; },
    };
  }
}
