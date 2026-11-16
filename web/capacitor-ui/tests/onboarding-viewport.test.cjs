const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const sourcePath = path.join(__dirname, "../src/components/onboarding/onboarding-viewport.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const compiledModule = { exports: {} };
const context = { exports: compiledModule.exports, module: compiledModule };
vm.runInNewContext(compiled, context, { filename: sourcePath });
const viewport = context.module.exports;

test("visual viewport offsets and keyboard-reduced dimensions define the visible bounds", () => {
  assert.deepEqual(
    { ...viewport.getViewportBounds({ offsetLeft: 12, offsetTop: 284, width: 360, height: 388 }, 800, 900) },
    { left: 12, top: 284, right: 372, bottom: 672 },
  );
  assert.deepEqual(
    { ...viewport.getViewportBounds(null, 800, 900) },
    { left: 0, top: 0, right: 800, bottom: 900 },
  );
});

test("nested scrollports request reveal until the target fits each visible region", () => {
  const nested = { left: 20, top: 100, right: 340, bottom: 300 };
  const visual = { left: 0, top: 0, right: 360, bottom: 640 };
  const target = { left: 40, top: 380, right: 220, bottom: 420 };
  assert.deepEqual({ ...viewport.getRevealPlan(target, [visual, nested]) }, {
    needed: true,
    block: "nearest",
    inline: "nearest",
  });

  const revealed = { left: 40, top: 252, right: 220, bottom: 292 };
  assert.equal(viewport.getRevealPlan(revealed, [visual, nested]).needed, false);
});

test("inner scrollport reveal includes clipping from outer non-scrollable ancestors", () => {
  const visual = { left: 0, top: 0, right: 400, bottom: 800 };
  const innerScrollport = { left: 20, top: 200, right: 380, bottom: 600 };
  const outerClip = { left: 100, top: 100, right: 300, bottom: 700 };
  const target = { left: 40, top: 320, right: 80, bottom: 360 };
  const clipping = viewport.resolveTargetClipping(visual, [
    { bounds: innerScrollport, scrollable: true },
    { bounds: outerClip, scrollable: false },
  ]);

  assert.deepEqual(
    clipping.scrollports.map((bounds) => ({ ...bounds })),
    [{ left: 100, top: 200, right: 300, bottom: 600 }],
  );
  assert.equal(
    viewport.getRevealPlan(target, [visual, ...clipping.scrollports]).needed,
    true,
  );
});

test("oversized targets align to their leading edge and do not oscillate", () => {
  const viewportBounds = { left: 0, top: 0, right: 360, bottom: 220 };
  const tallTarget = { left: 20, top: 90, right: 280, bottom: 620 };
  assert.deepEqual({ ...viewport.getRevealPlan(tallTarget, [viewportBounds]) }, {
    needed: true,
    block: "start",
    inline: "nearest",
  });

  const alignedTarget = { left: 20, top: 8, right: 280, bottom: 538 };
  assert.equal(viewport.getRevealPlan(alignedTarget, [viewportBounds]).needed, false);
});

test("callout stays inside an offset visual viewport and moves above when needed", () => {
  const viewportBounds = { left: 18, top: 260, right: 378, bottom: 650 };
  const target = { left: 290, top: 570, right: 340, bottom: 610 };
  const position = viewport.getCalloutPosition(target, 292, 150, viewportBounds);
  assert.deepEqual({ ...position }, { left: 70, top: 402, width: 292 });
  assert.ok(position.left >= viewportBounds.left + 16);
  assert.ok(position.left + position.width <= viewportBounds.right - 16);
  assert.ok(position.top >= viewportBounds.top + 16);
});

test("callout width shrinks to the visual viewport rather than the layout viewport", () => {
  const viewportBounds = { left: 40, top: 0, right: 260, bottom: 400 };
  const position = viewport.getCalloutPosition(
    { left: 200, top: 100, right: 240, bottom: 140 },
    292,
    132,
    viewportBounds,
  );
  assert.deepEqual({ ...position }, { left: 56, top: 158, width: 188 });
});
