const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function loadFolderTabGeometry() {
  const sourcePath = path.join(__dirname, "..", "src", "lib", "folder-tab-geometry.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: mod.exports,
    module: mod,
  });
  return mod.exports;
}

const {
  computeFolderTabRadii,
  buildFolderTabSvgPath,
  projectTabToClipViewport,
} = loadFolderTabGeometry();

test("centered tab keeps full pane corner and bottom concave fillet radii", () => {
  const radii = computeFolderTabRadii({
    width: 588,
    height: 600,
    tabHeight: 56,
    tabLeft: 140,
    tabWidth: 108,
    paneRadius: 30,
    tabRadius: 15,
    filletRadius: 14,
  });
  assert.equal(radii.activeVisible, true);
  assert.equal(radii.rCornerL, 30);
  assert.equal(radii.rConcaveL, 14);
  assert.equal(radii.rTopL, 15);
  assert.equal(radii.rTopR, 15);
  assert.equal(radii.rConcaveR, 14);
  assert.equal(radii.rCornerR, 30);
});

test("approaching container edge shrinks shoulder and concave fillet proportionally without overlap", () => {
  for (let gap = 0; gap <= 50; gap += 0.5) {
    const radii = computeFolderTabRadii({
      width: 500,
      height: 400,
      tabHeight: 56,
      tabLeft: gap,
      tabWidth: 108,
      paneRadius: 30,
      tabRadius: 15,
      filletRadius: 14,
      inset: 0.5,
    });
    assert.ok(radii.rCornerL + radii.rConcaveL <= gap + 1e-6, `gap=${gap} overflowed left radii`);
    assert.ok(radii.rConcaveL + radii.rTopL <= radii.effTabHeight + 1e-6, `gap=${gap} overflowed vertical stem`);
  }
});

test("flush left or right tab collapses outer shoulder and concave fillet cleanly to zero", () => {
  const flushLeft = computeFolderTabRadii({
    width: 400,
    height: 360,
    tabHeight: 42,
    tabLeft: 0,
    tabWidth: 96,
    paneRadius: 22,
    tabRadius: 12,
    filletRadius: 12,
  });
  assert.equal(flushLeft.rCornerL, 0);
  assert.equal(flushLeft.rConcaveL, 0);
  assert.equal(flushLeft.rTopL, 12);
  assert.equal(flushLeft.rConcaveR, 12);
  assert.equal(flushLeft.rCornerR, 22);

  const flushRight = computeFolderTabRadii({
    width: 400,
    height: 360,
    tabHeight: 42,
    tabLeft: 304,
    tabWidth: 96,
    paneRadius: 22,
    tabRadius: 12,
    filletRadius: 12,
  });
  assert.equal(flushRight.rCornerR, 0);
  assert.equal(flushRight.rConcaveR, 0);
  assert.equal(flushRight.rTopR, 12);
});

test("generated SVG path stays valid closed geometry across fill, inset stroke, and collapsed scroll states", () => {
  const cases = [
    { tabLeft: 0, tabWidth: 108, collapseRatio: 1, inset: 0 },
    { tabLeft: 13, tabWidth: 108, collapseRatio: 1, inset: 0.5 },
    { tabLeft: 260, tabWidth: 108, collapseRatio: 1, inset: 0.5 },
    { tabLeft: 0, tabWidth: 10, collapseRatio: 0.4, inset: 0.5 },
    { tabLeft: 0, tabWidth: 0, collapseRatio: 0, inset: 0 },
  ];
  for (const c of cases) {
    const d = buildFolderTabSvgPath({
      width: 480,
      height: 520,
      tabHeight: 56,
      paneRadius: 30,
      tabRadius: 15,
      filletRadius: 14,
      ...c,
    });
    assert.ok(d.startsWith("M ") && d.endsWith(" Z"), `invalid path endpoints: ${d}`);
    assert.ok(!/NaN|Infinity|undefined/.test(d), `invalid number in path: ${d}`);
  }
});

test("projectTabToClipViewport clamps and collapses smoothly when scrolled out of bounds", () => {
  const full = projectTabToClipViewport(120, 100, 20, 28, 360);
  assert.deepEqual({ ...full }, { tabLeft: 128, tabWidth: 100, collapseRatio: 1 });

  const slightlyClippedLeft = projectTabToClipViewport(10, 100, 21, 28, 360);
  assert.equal(slightlyClippedLeft.tabLeft, 28);
  assert.ok(Math.abs(slightlyClippedLeft.tabWidth - 89) < 1e-6);
  assert.ok(Math.abs(slightlyClippedLeft.collapseRatio - 0.5) < 1e-6);

  const deeplyClippedLeft = projectTabToClipViewport(10, 100, 102, 28, 360);
  assert.equal(deeplyClippedLeft.tabLeft, 28);
  assert.ok(Math.abs(deeplyClippedLeft.tabWidth - 8) < 1e-6);
  assert.equal(deeplyClippedLeft.collapseRatio, 0);

  const clippedRight = projectTabToClipViewport(250, 100, 10, 28, 360);
  assert.equal(clippedRight.tabLeft, 268);
  assert.ok(Math.abs(clippedRight.tabWidth - 92) < 1e-6);
  assert.ok(clippedRight.collapseRatio > 0.5 && clippedRight.collapseRatio < 1);

  const scrolledOff = projectTabToClipViewport(0, 96, 140, 28, 360);
  assert.equal(scrolledOff.tabWidth, 0);
  assert.equal(scrolledOff.collapseRatio, 0);
});
