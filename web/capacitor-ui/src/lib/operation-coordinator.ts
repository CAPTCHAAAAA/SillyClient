export interface OperationEvent {
  instanceId?: string;
  operationId?: string;
}

export class OperationCancelledError extends Error {
  constructor() {
    super("Operation cancelled");
    this.name = "OperationCancelledError";
  }
}

type Removable = { remove: () => void | Promise<void> };

export class OperationContext {
  readonly controller = new AbortController();
  readonly logKey: string;
  busy = true;
  private cleanups = new Set<() => void>();
  private scheduledCleanups = new Set<() => void>();

  constructor(
    readonly id: string,
    public instanceId: string,
    readonly purpose: string,
    readonly allowLegacyEvents: boolean,
    private readonly coordinator: OperationCoordinator,
  ) {
    this.logKey = `operation:${id}`;
  }

  get isCurrent() {
    return !this.controller.signal.aborted && this.coordinator.current === this;
  }

  assertCurrent() {
    if (!this.isCurrent) throw new OperationCancelledError();
  }

  accepts(event: OperationEvent) {
    if (!this.isCurrent) return false;
    if (event.operationId && event.operationId !== this.id) return false;
    if (event.instanceId && event.instanceId !== this.instanceId) return false;
    return !!event.operationId || this.allowLegacyEvents;
  }

  addCleanup(cleanup: () => void) {
    if (!this.isCurrent || !this.busy) {
      cleanup();
      return () => {};
    }
    this.cleanups.add(cleanup);
    return () => { this.cleanups.delete(cleanup); };
  }

  async listen(registration: Promise<Removable>) {
    const tracked = registration.then(handle => {
      this.addCleanup(() => {
        try { Promise.resolve(handle.remove()).catch(() => {}); } catch {}
      });
      return handle;
    });
    return this.wait(tracked);
  }

  async wait<T>(pending: Promise<T>): Promise<T> {
    if (!this.isCurrent) {
      void pending.catch(() => {});
      throw new OperationCancelledError();
    }
    const signal = this.controller.signal;
    return new Promise<T>((resolve, reject) => {
      const abort = () => { reject(new OperationCancelledError()); };
      signal.addEventListener("abort", abort, { once: true });
      pending.then(value => {
        signal.removeEventListener("abort", abort);
        if (this.isCurrent) resolve(value);
        else reject(new OperationCancelledError());
      }, error => {
        signal.removeEventListener("abort", abort);
        reject(this.isCurrent ? error : new OperationCancelledError());
      });
    });
  }

  delay(ms: number) {
    return this.wait(new Promise<void>(resolve => {
      const timer = setTimeout(resolve, ms);
      this.addCleanup(() => clearTimeout(timer));
    }));
  }

  schedule(callback: () => void, ms: number) {
    const timer = setTimeout(() => {
      this.scheduledCleanups.delete(cleanup);
      if (this.isCurrent) callback();
    }, ms);
    const cleanup = () => clearTimeout(timer);
    // Closing animations can outlive the native call but not their operation.
    if (this.isCurrent) this.scheduledCleanups.add(cleanup);
    else cleanup();
  }

  private release() {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.clear();
  }

  finish() {
    this.busy = false;
    this.release();
  }

  cancel() {
    this.busy = false;
    this.controller.abort();
    this.release();
    for (const cleanup of this.scheduledCleanups) cleanup();
    this.scheduledCleanups.clear();
  }
}

export class OperationCoordinator {
  current: OperationContext | null = null;
  private sequence = 0;
  private cancelledIds = new Set<string>();
  private legacySafe = true;

  get busy() { return this.current?.busy === true; }

  begin(instanceId: string, purpose: string) {
    if (this.current) this.cancel();
    const operation = new OperationContext(
      `op-${Date.now()}-${++this.sequence}`,
      instanceId,
      purpose,
      this.legacySafe,
      this,
    );
    this.current = operation;
    return operation;
  }

  cancel(instanceId?: string) {
    const operation = this.current;
    if (!operation || (instanceId && operation.instanceId !== instanceId)) return null;
    this.cancelledIds.add(operation.id);
    if (this.cancelledIds.size > 64) this.cancelledIds.delete(this.cancelledIds.values().next().value!);
    this.legacySafe = false;
    operation.cancel();
    this.current = null;
    return operation;
  }

  acceptsGlobal(event: OperationEvent) {
    if (event.operationId && this.cancelledIds.has(event.operationId)) return false;
    if (event.operationId) return this.current?.accepts(event) ?? false;
    return this.legacySafe;
  }
}
