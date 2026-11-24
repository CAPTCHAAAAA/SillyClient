const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function loadTsModule(relativePath, mocks = {}, cache = new Map()) {
  const normalizedRel = relativePath.replace(/\\/g, "/");
  if (cache.has(normalizedRel)) {
    return cache.get(normalizedRel).exports;
  }
  const sourcePath = path.join(__dirname, "..", normalizedRel);
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  cache.set(normalizedRel, compiledModule);
  const context = {
    exports: compiledModule.exports,
    module: compiledModule,
    URL,
    URLSearchParams,
    TextEncoder,
    AbortController,
    setTimeout,
    clearTimeout,
    require: (id) => {
      if (id in mocks) return mocks[id];
      if (id.startsWith(".")) {
        const baseDir = path.dirname(sourcePath);
        const candidateTs = path.resolve(baseDir, `${id}.ts`);
        if (fs.existsSync(candidateTs)) {
          const nextRel = path.relative(path.join(__dirname, ".."), candidateTs);
          return loadTsModule(nextRel, mocks, cache);
        }
      }
      throw new Error(`Unexpected runtime import in ${relativePath}: ${id}`);
    },
  };
  vm.runInNewContext(compiled, context, { filename: sourcePath });
  return compiledModule.exports;
}

const {
  PROVISION_IDLE_TIMEOUT_MS,
  PROVISION_MAX_TOTAL_MS,
  ProvisionTimeoutTracker,
  formatProvisionTimeoutError,
  resolveProvisionFailure,
} = loadTsModule("src/lib/provision-timeout.ts");

const {
  DEFAULT_PUBLIC_SENTRY_DSN,
  resolveDefaultSentryDsn,
} = loadTsModule("src/lib/sentry-diagnostic.ts");

test("ProvisionTimeoutTracker extends across active heartbeats past 10 minutes up to max total cap", () => {
  const t0 = 1_000_000;
  const tracker = new ProvisionTimeoutTracker(t0);

  // Active heartbeats every 2 minutes keep provisioning alive past the old 10-minute fixed wall clock
  for (let minutes = 2; minutes <= 16; minutes += 2) {
    const now = t0 + minutes * 60 * 1000;
    assert.equal(tracker.check(now), "active");
    tracker.touch(now);
  }

  // Without new activity, fires idle-timeout after PROVISION_IDLE_TIMEOUT_MS
  const lastTouch = t0 + 16 * 60 * 1000;
  assert.equal(tracker.check(lastTouch + PROVISION_IDLE_TIMEOUT_MS - 1), "active");
  assert.equal(tracker.check(lastTouch + PROVISION_IDLE_TIMEOUT_MS), "idle-timeout");
  assert.match(formatProvisionTimeoutError("idle-timeout"), /长时间无进展/);

  // Continuous heartbeats still respect the hard upper bound
  tracker.touch(t0 + PROVISION_MAX_TOTAL_MS - 1000);
  assert.equal(tracker.check(t0 + PROVISION_MAX_TOTAL_MS - 1), "active");
  assert.equal(tracker.check(t0 + PROVISION_MAX_TOTAL_MS), "total-timeout");
  assert.match(formatProvisionTimeoutError("total-timeout"), /总耗时过长/);
});

test("resolveProvisionFailure prefers direct invoke error over async event race and respects cancellation", () => {
  assert.deepEqual({ ...resolveProvisionFailure({ ready: true }, null) }, { kind: "continue" });
  assert.deepEqual(
    { ...resolveProvisionFailure({ ready: false, cancelled: true }, "ignored") },
    { kind: "cancelled" }
  );
  assert.deepEqual(
    {
      ...resolveProvisionFailure(
        { ready: false, error: "Node.js 进程已退出 (code=1)" },
        "older event"
      ),
    },
    { kind: "error", message: "Node.js 进程已退出 (code=1)" }
  );
  assert.deepEqual(
    { ...resolveProvisionFailure({ ready: false }, "端口 8000 已被占用") },
    { kind: "error", message: "端口 8000 已被占用" }
  );
  assert.deepEqual(
    { ...resolveProvisionFailure({ ready: false }, null) },
    { kind: "error", message: "实例未能启动，请检查安装日志" }
  );
});

test("resolveDefaultSentryDsn isolates web demo and dev mode from production Sentry", () => {
  // Web demo / GitHub Pages must never send to built-in production Sentry by default
  assert.equal(resolveDefaultSentryDsn({ isNativePlatform: false, isDev: false }), undefined);
  // Local dev (native or web) must never send to built-in production Sentry by default
  assert.equal(resolveDefaultSentryDsn({ isNativePlatform: true, isDev: true }), undefined);
  assert.equal(resolveDefaultSentryDsn({ isNativePlatform: false, isDev: true }), undefined);
  // Production native builds enable the built-in public Sentry DSN
  assert.equal(
    resolveDefaultSentryDsn({ isNativePlatform: true, isDev: false }),
    DEFAULT_PUBLIC_SENTRY_DSN
  );
  // Explicit VITE_SENTRY_DSN override is always honored (and blank disables)
  assert.equal(
    resolveDefaultSentryDsn({
      isNativePlatform: false,
      isDev: true,
      envSentryDsn: "https://abcdef1234567890@o1.ingest.us.sentry.io/1",
    }),
    "https://abcdef1234567890@o1.ingest.us.sentry.io/1"
  );
  assert.equal(
    resolveDefaultSentryDsn({ isNativePlatform: true, isDev: false, envSentryDsn: "   " }),
    undefined
  );
});

test("routes/index.tsx guards launchTavernDirect and handleStopInstance against unimplemented web TarvenEnv calls", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/routes/index.tsx"), "utf8");
  assert.match(source, /const result = await doLaunch\(instance, operation\);\s+if \(isWeb\)/);
  assert.match(source, /const handleReturnToTavern = useCallback\(async \(instance: TavernInstance\) => \{\s+if \(isWeb\) return;/);
  assert.match(source, /if \(!isWeb\) \{\s+try \{\s+await TarvenEnv\.closeTavern/);
});
