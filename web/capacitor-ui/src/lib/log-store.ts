export interface LogLine {
  msg: string;
  level?: string;
}

export const EMPTY_LOGS: readonly LogLine[] = Object.freeze([]);
export const GLOBAL_LOG_KEY = "launcher";

interface Bucket {
  lines: LogLine[];
  start: number;
  snapshot: readonly LogLine[];
  listeners: Set<() => void>;
  dirty: boolean;
}

/** Native output is buffered outside React and published once per batch. */
export class InstanceLogStore {
  private buckets = new Map<string, Bucket>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly maxLines = 2000,
    readonly maxLineLength = 4096,
    private readonly batchMs = 50,
    private readonly maxBuckets = 24,
  ) {}

  private bucket(key: string): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { lines: [], start: 0, snapshot: EMPTY_LOGS, listeners: new Set(), dirty: false };
      this.buckets.set(key, bucket);
      for (const [oldKey, oldBucket] of this.buckets) {
        if (this.buckets.size <= this.maxBuckets) break;
        if (oldKey !== key && oldBucket.listeners.size === 0) this.buckets.delete(oldKey);
      }
    }
    return bucket;
  }

  private sanitize(line: LogLine): LogLine {
    return Object.freeze({
      msg: String(line.msg ?? "").slice(0, this.maxLineLength),
      ...(line.level ? { level: String(line.level).slice(0, 32) } : {}),
    });
  }

  private current(bucket: Bucket): LogLine[] {
    return bucket.start === 0
      ? bucket.lines.slice()
      : [...bucket.lines.slice(bucket.start), ...bucket.lines.slice(0, bucket.start)];
  }

  private changed(bucket: Bucket) {
    bucket.dirty = true;
    if (this.timer === undefined) this.timer = setTimeout(() => this.flush(), this.batchMs);
  }

  append(key: string, line: LogLine, mergeProgress = false) {
    const bucket = this.bucket(key);
    const value = this.sanitize(line);
    const lastIndex = (bucket.start + bucket.lines.length - 1) % this.maxLines;
    const last = bucket.lines[lastIndex];
    if (mergeProgress && last?.level === "info" && /\d+%$/.test(last.msg)) {
      bucket.lines[lastIndex] = value;
    } else if (bucket.lines.length < this.maxLines) {
      bucket.lines.push(value);
    } else {
      bucket.lines[bucket.start] = value;
      bucket.start = (bucket.start + 1) % this.maxLines;
    }
    this.changed(bucket);
  }

  update(key: string, value: LogLine[] | ((previous: LogLine[]) => LogLine[])) {
    const bucket = this.bucket(key);
    const next = typeof value === "function" ? value(this.current(bucket)) : value;
    bucket.lines = next.slice(-this.maxLines).map(line => this.sanitize(line));
    bucket.start = 0;
    this.changed(bucket);
  }

  getSnapshot = (key: string): readonly LogLine[] => this.bucket(key).snapshot;

  subscribe(key: string, listener: () => void): () => void {
    const bucket = this.bucket(key);
    bucket.listeners.add(listener);
    return () => { bucket.listeners.delete(listener); };
  }

  flush() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    for (const bucket of this.buckets.values()) {
      if (!bucket.dirty) continue;
      bucket.dirty = false;
      bucket.snapshot = Object.freeze(this.current(bucket));
      for (const listener of bucket.listeners) listener();
    }
  }

  dispose() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.buckets.clear();
  }
}

export const instanceLogs = new InstanceLogStore();
