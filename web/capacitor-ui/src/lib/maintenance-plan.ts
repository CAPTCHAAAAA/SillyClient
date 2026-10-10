import type { MaintenanceScan, MaintenanceApplyResult } from "../capacitor-plugin";

export function defaultMaintenanceSelection(scan: MaintenanceScan): Set<string> {
  return new Set(scan.items.filter(item => item.kind === "download_cache"
    && item.confidence === "owned" && item.defaultSelected).map(item => item.id));
}

export function maintenanceSelection(scan: MaintenanceScan, selected: ReadonlySet<string>, now = Date.now()) {
  if (scan.expiresAt <= now) throw new Error("维护扫描已过期，请重新扫描");
  const items = scan.items.filter(item => selected.has(item.id));
  if (items.length !== selected.size || items.some(item => !item.token)) {
    throw new Error("维护项目已变化，请重新扫描");
  }
  return items.map(({ id, token }) => ({ id, token }));
}

export function maintenanceRemaining(scan: MaintenanceScan, result: MaintenanceApplyResult) {
  const completed = new Set(result.results.filter(item => item.success).map(item => item.id));
  return scan.items.filter(item => !completed.has(item.id));
}

/** A scope switch or a newer request makes every earlier response inert. */
export class MaintenanceSession {
  private generation = 0;
  private instanceId: string | null = null;

  switchTo(instanceId: string | null) {
    this.instanceId = instanceId;
    this.generation += 1;
  }
  next() {
    return { generation: ++this.generation, instanceId: this.instanceId };
  }
  current(ticket: ReturnType<MaintenanceSession["next"]>) {
    return this.instanceId !== null && ticket.generation === this.generation
      && ticket.instanceId === this.instanceId;
  }
}
