const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const uiRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(uiRoot, "src");
const devRoot = path.join(srcRoot, "dev");
const distAssetsRoot = path.join(uiRoot, "dist", "assets");

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

const BANNED_PRODUCTION_PATTERNS = [
  /DEV_FAULT_TEST/,
  /__dev-fault-test-card__/,
  /异常自动捕获测试/,
  /DEMO_RUNNING_INSTANCES/,
  /DEMO_INSTANCE/,
  /DEBUG_LAUNCH_LOG_KEY/,
  /DEBUG_OPEN_INSTANCE/,
  /DEBUG_CREATE_INSTANCE/,
  /openIssueReportPreview/,
  /openLaunchConsolePreview/,
  /logoDebugPressTimerRef/,
  /terminalDebugPressTimerRef/,
  /middleDebugPressTimerRef/,
  /调试板/,
  /window\.location\.port\s*===\s*["']8768["']/,
];

const DEV_IMPORT_RE = /(?:from|import\s*\()\s*["'](?:\.\.?\/|@\/)*dev\/[^"']+["']/;

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("production source files remain strictly isolated from src/dev and synthetic preview artifacts", () => {
  const productionFiles = walkFiles(srcRoot).filter(
    (filePath) => !filePath.startsWith(devRoot + path.sep) && /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(filePath),
  );

  assert.ok(productionFiles.length > 0, "Expected production source files to exist");

  for (const filePath of productionFiles) {
    const relative = path.relative(srcRoot, filePath).split(path.sep).join("/");
    const content = fs.readFileSync(filePath, "utf8");
    const codeOnly = stripComments(content);

    for (const pattern of BANNED_PRODUCTION_PATTERNS) {
      assert.equal(
        pattern.test(codeOnly),
        false,
        `${relative} must not embed inline preview/fault test code matching ${pattern}`,
      );
    }

    if (DEV_IMPORT_RE.test(codeOnly)) {
      assert.ok(
        relative === "main.tsx" || relative === "capacitor-plugin.ts",
        `${relative} must not import from src/dev/ directly`,
      );
      assert.match(
        codeOnly,
        /import\.meta\.env\.DEV/,
        `${relative} may only lazy-load src/dev/ under import.meta.env.DEV`,
      );
    }
  }
});

test("isLocalPreview guards against native desktop/mobile hosts", () => {
  const routeSource = fs.readFileSync(path.join(srcRoot, "routes", "index.tsx"), "utf8");
  assert.match(
    routeSource,
    /const\s+isLocalPreview\s*=\s*isWeb\s*&&\s*!isWindows\s*&&\s*\/\^\(127\\\.0\\\.0\\\.1\|localhost\)\$\/\.test\(window\.location\.hostname\)/,
  );
});

test("production dist bundle contains zero bytes from src/dev or synthetic test fixtures", () => {
  if (!fs.existsSync(distAssetsRoot)) return;
  const jsFiles = walkFiles(distAssetsRoot).filter((filePath) => filePath.endsWith(".js"));
  assert.ok(jsFiles.length > 0, "Expected built JS assets inside dist/assets");

  const bannedBundleStrings = [
    "__dev-fault-test-card__",
    "异常自动捕获测试",
    "DEV 调试板",
    "ERR_SYNTHETIC_FAULT_INSTANCE",
    "dev-fixtures",
    "DevDebugOverlay",
  ];

  for (const jsFile of jsFiles) {
    const bundle = fs.readFileSync(jsFile, "utf8");
    for (const token of bannedBundleStrings) {
      assert.equal(
        bundle.includes(token),
        false,
        `Production bundle ${path.basename(jsFile)} leaked dev-only token "${token}"`,
      );
    }
  }
});
