const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function loadTsModule(relativePath, cache = new Map()) {
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
    require: (id) => {
      if (id === "react") {
        return { useEffect: () => {}, useState: (init) => [typeof init === "function" ? init() : init, () => {}] };
      }
      if (id.startsWith(".")) {
        const baseDir = path.dirname(sourcePath);
        if (id.endsWith(".json")) {
          const jsonPath = path.resolve(baseDir, id);
          if (fs.existsSync(jsonPath)) {
            const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
            return { __esModule: true, default: parsed, ...parsed };
          }
        }
        const candidateTs = path.resolve(baseDir, `${id}.ts`);
        if (fs.existsSync(candidateTs)) {
          const nextRel = path.relative(path.join(__dirname, ".."), candidateTs);
          return loadTsModule(nextRel, cache);
        }
      }
      throw new Error(`Unexpected runtime import in ${relativePath}: ${id}`);
    },
  };
  vm.runInNewContext(compiled, context, { filename: sourcePath });
  return compiledModule.exports;
}

const nativeErrors = loadTsModule("src/lib/native-errors.ts");
const installLocation = loadTsModule("src/lib/install-location.ts");
const renderSettings = loadTsModule("src/lib/render-settings.ts");
const globalErrorStore = loadTsModule("src/lib/global-error-store.ts");

test("humanizeNativeError preserves raw technical domains, stages, and NS/POSIX details verbatim", () => {
  const err = new Error(
    "无法打开所选目录（NSCocoaErrorDomain:257） [NSCocoaErrorDomain:257] at coordinate-selected-directory"
  );
  assert.equal(
    nativeErrors.humanizeNativeError(err),
    "无法打开所选目录（NSCocoaErrorDomain:257） [NSCocoaErrorDomain:257] at coordinate-selected-directory"
  );

  const posix = new Error("NSURLErrorDomain -1009 NSPOSIXErrorDomain:45 NSError timed out");
  assert.equal(
    nativeErrors.humanizeNativeError(posix),
    "NSURLErrorDomain -1009 NSPOSIXErrorDomain:45 NSError timed out"
  );

  const invariant = new Error("Default installations must be direct children of the instance root");
  assert.equal(
    nativeErrors.humanizeNativeError(invariant),
    "Default installations must be direct children of the instance root"
  );

  assert.equal(
    nativeErrors.humanizeNativeError(new TypeError("Failed to fetch")),
    "TypeError: Failed to fetch"
  );
  assert.equal(
    nativeErrors.humanizeNativeError({ error: "RAW_IPC_REJECTED" }),
    "RAW_IPC_REJECTED"
  );
  assert.equal(nativeErrors.humanizeNativeError(""), "Unknown error");
});

test("isUserCancellationError and shouldShowDirectoryPickerError separate cancel from abnormal close", () => {
  assert.equal(nativeErrors.isUserCancellationError(new Error("PICKER_CANCELLED"), false), true);
  assert.equal(nativeErrors.isUserCancellationError(new Error("PICKER_CANCELLED"), true), true);
  assert.equal(nativeErrors.isUserCancellationError(new Error("user cancelled"), false), true);
  assert.equal(
    nativeErrors.isUserCancellationError(new Error("PICKER_ABNORMAL_DISMISS"), true),
    false
  );
  assert.equal(
    nativeErrors.isUserCancellationError(
      new Error("NSFileProviderErrorDomain code=-1000 user cancelled"),
      true
    ),
    false
  );

  assert.equal(
    installLocation.shouldShowDirectoryPickerError(new Error("PICKER_CANCELLED"), true),
    false
  );
  assert.equal(
    installLocation.shouldShowDirectoryPickerError(new Error("PICKER_ABNORMAL_DISMISS"), true),
    true
  );
  assert.equal(
    installLocation.shouldShowDirectoryPickerError(new Error("NSCocoaErrorDomain:257"), true),
    true
  );
});

test("sanitizeDiagnosticText and toDiagnosticReportInput redact paths, secrets, and extraSecrets", () => {
  const raw =
    "Failed reading C:\\Users\\Alice\\Secrets\\st.json and /Users/bob/Library/Application Support/SillyTavern " +
    "and /var/mobile/Containers/Data/Application/UUID-123/Documents/MySecretTavern " +
    "via https://user:supersecret@tavern.example.com:8443/api Bearer ghp_1234567890abcdef1234567890abcdef " +
    "email alice@example.com";
  const redacted = nativeErrors.sanitizeDiagnosticText(raw, [
    "MySecretTavern",
    "supersecret",
  ]);
  assert.equal(redacted.includes("Alice"), false);
  assert.equal(redacted.includes("bob"), false);
  assert.equal(redacted.includes("MySecretTavern"), false);
  assert.equal(redacted.includes("supersecret"), false);
  assert.equal(redacted.includes("ghp_"), false);
  assert.equal(redacted.includes("alice@example.com"), false);

  const ctx = nativeErrors.createDiagnosticContext(
    new Error("NSCocoaErrorDomain:257 reading /Users/bob/Docs/SecretCard at pick-dir"),
    {
      area: "picker",
      platform: "ios",
      userMessage: "无法访问所选文件夹，请改选其他目录或重启应用后重试。",
      extraSecrets: ["SecretCard", "/Users/bob/Docs"],
    }
  );
  const input = nativeErrors.toDiagnosticReportInput(
    ctx,
    "在 C:\\Users\\Alice\\Test 点选择后闪退，联系 alice@example.com",
    ["SecretCard"]
  );
  assert.equal(input.platform, "ios");
  assert.equal(input.area, "picker");
  assert.equal(JSON.stringify(input).includes("SecretCard"), false);
  assert.equal(JSON.stringify(input).includes("Alice"), false);
  assert.equal(JSON.stringify(input).includes("bob"), false);
  assert.equal(JSON.stringify(input).includes("alice@example.com"), false);
});

test("sanitizeDiagnosticText preserves common product nouns so instance names like 酒馆 do not split fingerprints", () => {
  const msg = "酒馆启动超时，请检查实例日志";
  const withGenericName = nativeErrors.createDiagnosticContext(new Error(msg), {
    area: "create",
    platform: "android",
    extraSecrets: ["酒馆", "SillyTavern", "新实例"],
  });
  const withoutGenericName = nativeErrors.createDiagnosticContext(new Error(msg), {
    area: "create",
    platform: "android",
    extraSecrets: ["MyPrivatePersona"],
  });
  assert.equal(withGenericName.summary, msg);
  assert.equal(withGenericName.fingerprint, withoutGenericName.fingerprint);

  const customNameMsg = nativeErrors.sanitizeDiagnosticText(
    "实例 MyPrivatePersona 启动失败于 /storage/emulated/0/MyPrivatePersona",
    ["MyPrivatePersona"]
  );
  assert.equal(customNameMsg.includes("MyPrivatePersona"), false);
  assert.equal(customNameMsg.includes("/storage/emulated/0"), false);
});

test("install-location and render-settings cross-platform helpers stay consistent", () => {
  const id = installLocation.normalizeInstanceIdentity("  我的 酒馆 / Test  ");
  assert.ok(id.length > 0);
  assert.equal(/[\\/]/.test(id), false);

  assert.equal(
    installLocation.relocationTargetInParent(
      "/var/mobile/Containers/Apps",
      "/var/mobile/OldRoot/tavern-1"
    ),
    "/var/mobile/Containers/Apps/tavern-1"
  );

  const normalized = renderSettings.normalizeRenderEngineSettings({ performancePreset: true });
  assert.equal(normalized.performancePreset, true);
});

test("global-error-store filters cancellations/benign errors, supports force, and maps area labels", () => {
  globalErrorStore.dismissGlobalError();
  assert.equal(globalErrorStore.getDiagnosticAreaLabel("picker"), "目录权限");
  assert.equal(globalErrorStore.getDiagnosticAreaLabel("runtime"), "运行异常");

  assert.equal(globalErrorStore.reportGlobalError(new Error("PICKER_CANCELLED")), null);
  assert.equal(globalErrorStore.reportGlobalError(new Error("ResizeObserver loop limit exceeded")), null);
  assert.equal(globalErrorStore.getActiveGlobalError(), null);

  const first = globalErrorStore.reportGlobalError(
    new Error("ETIMEDOUT: failed to fetch archive"),
    { area: "launch", stage: "provision" }
  );
  assert.ok(first);
  assert.equal(first.diagnostic.area, "launch");

  const dupIgnored = globalErrorStore.reportGlobalError(
    new Error("ETIMEDOUT: failed to fetch archive"),
    { area: "launch", stage: "provision" }
  );
  assert.equal(dupIgnored.id, first.id);

  const forced = globalErrorStore.reportGlobalError(
    new Error("ETIMEDOUT: failed to fetch archive"),
    { area: "launch", stage: "provision", force: true }
  );
  assert.notEqual(forced.id, first.id);

  globalErrorStore.dismissGlobalError(forced.id);
  assert.equal(globalErrorStore.getActiveGlobalError(), null);

  const reopenedAfterDismiss = globalErrorStore.reportGlobalError(
    new TypeError("Cannot read properties of undefined (reading 'session')"),
    { area: "runtime", stage: "window-error" }
  );
  assert.ok(reopenedAfterDismiss);
  assert.match(reopenedAfterDismiss.diagnostic.summary, /^TypeError: Cannot read properties/);

  const reopenedSameImmediately = (() => {
    const id = reopenedAfterDismiss.id;
    globalErrorStore.dismissGlobalError(id);
    return globalErrorStore.reportGlobalError(
      new TypeError("Cannot read properties of undefined (reading 'session')"),
      { area: "runtime", stage: "window-error" }
    );
  })();
  assert.ok(reopenedSameImmediately);
  assert.notEqual(reopenedSameImmediately.id, reopenedAfterDismiss.id);
  globalErrorStore.dismissGlobalError(reopenedSameImmediately.id);
});
