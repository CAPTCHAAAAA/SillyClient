const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function loadInstallLocationModule() {
  const sourcePath = path.join(__dirname, "..", "src", "lib", "install-location.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: compiledModule.exports,
    module: compiledModule,
    require: () => {
      throw new Error("Unexpected require in install-location.ts");
    },
  });
  return compiledModule.exports;
}

test("validateInstallPathInput rejects URIs, breadcrumb labels, relative iOS paths, and parent traversals", () => {
  const { validateInstallPathInput, normalizeInstanceIdentity } = loadInstallLocationModule();

  assert.equal(validateInstallPathInput("", { isIOS: true }), null);
  assert.equal(validateInstallPathInput("/var/mobile/Containers/Data/SillyClient", { isIOS: true }), null);
  assert.match(
    validateInstallPathInput("我的 iPhone ▸ SillyClient", { isIOS: true }),
    /浏览/
  );
  assert.match(
    validateInstallPathInput("relative/path", { isIOS: true }),
    /浏览/
  );
  assert.match(
    validateInstallPathInput("/var/mobile/../escape", { isIOS: true }),
    /\.\./
  );
  assert.match(
    validateInstallPathInput("content://com.android.externalstorage/tree", { isIOS: false }),
    /本地路径/
  );
  assert.match(
    validateInstallPathInput("C:\\Users\\test\\..\\escape", { isIOS: false }),
    /\.\./
  );
  assert.equal(validateInstallPathInput("D:\\Tavern\\Instances\\demo", { isIOS: false }), null);

  assert.equal(normalizeInstanceIdentity("测试中文", "fallback-id"), "fallback-id");
  assert.equal(normalizeInstanceIdentity("My Instance 01"), "My-Instance-01");
});
