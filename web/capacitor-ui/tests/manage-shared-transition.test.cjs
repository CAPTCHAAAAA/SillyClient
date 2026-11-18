const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function loadManageTransitionModule() {
  const sourcePath = path.join(__dirname, "..", "src", "lib", "manage-shared-transition.ts");
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
  easeSharedTransition,
  computeDirectionalSlideFrame,
  buildLinearFeatherMask,
  buildStationarySlideMask,
} = loadManageTransitionModule();

test("easeSharedTransition matches global 780ms cubic-bezier(0.5, 0, 0.2, 1) curve with exact endpoints", () => {
  assert.equal(easeSharedTransition(-0.2), 0);
  assert.equal(easeSharedTransition(0), 0);
  assert.equal(easeSharedTransition(1), 1);
  assert.equal(easeSharedTransition(1.5), 1);
  assert.ok(easeSharedTransition(0.2) < 0.18);

  let prev = 0;
  for (let i = 1; i <= 20; i += 1) {
    const val = easeSharedTransition(i / 20);
    assert.ok(val > prev, `expected monotonic increase at step ${i}`);
    prev = val;
  }
});

test("computeDirectionalSlideFrame rides global 780ms curve 1:1 without early quick-cut snaps", () => {
  const start = computeDirectionalSlideFrame(0, 1, 40, 44);
  const early = computeDirectionalSlideFrame(0.25, 1, 40, 44);
  const mid = computeDirectionalSlideFrame(0.55, 1, 40, 44);
  const cleared = computeDirectionalSlideFrame(0.70, 1, 40, 44);
  const end = computeDirectionalSlideFrame(1, 1, 40, 44);

  assert.equal(start.outOpacity, 1);
  assert.equal(start.outBlurPx, 0);
  assert.equal(start.inOpacity, 0);
  assert.equal(start.inShiftPx, 40);
  assert.equal(start.featherPx, 0);

  // Incoming & outgoing stay coupled to linear phase `p` (`inShiftPx = 40 * (1 - p)`) instead of early fast-cutting
  assert.ok(Math.abs(early.inShiftPx - 30) < 1e-6);
  assert.ok(early.outOpacity > 0.65);
  assert.ok(early.inOpacity > 0 && early.inOpacity < 0.15);

  // Mid-flight glides smoothly through soft optical focus & wide edge feathering
  assert.ok(Math.abs(mid.inShiftPx - 18) < 1e-6);
  assert.ok(mid.inOpacity > 0.45 && mid.inOpacity < 0.65);
  assert.ok(mid.outOpacity > 0 && mid.outOpacity < 0.15);
  assert.ok(mid.inBlurPx > 1.5 && mid.inBlurPx < 2.2);
  assert.ok(mid.featherPx > 40);

  // Outgoing completes cleanly by p = 0.68 while incoming continues gentle tail deceleration to p = 1.0
  assert.equal(cleared.outOpacity, 0);
  assert.ok(Math.abs(cleared.inShiftPx - 12) < 1e-6);
  assert.ok(cleared.inOpacity > 0.7);

  // Settled state zeroes shift, blur, and feathering completely
  assert.equal(end.outOpacity, 0);
  assert.equal(end.inOpacity, 1);
  assert.equal(end.inShiftPx, 0);
  assert.equal(end.inBlurPx, 0);
  assert.equal(end.featherPx, 0);

  // Reverse direction flips horizontal slide direction cleanly
  const rev = computeDirectionalSlideFrame(0.5, -1, 40, 44);
  assert.ok(rev.inShiftPx < 0);
  assert.ok(rev.outShiftPx > 0);
});

test("buildLinearFeatherMask builds smooth multi-stop edge feather only during motion", () => {
  assert.equal(buildLinearFeatherMask("x", 0.3), "");
  const xMask = buildLinearFeatherMask("x", 44);
  assert.match(xMask, /^linear-gradient\(to right, transparent 0px,/);
  assert.match(xMask, /rgba\(0, 0, 0, 0\.14\)/);
  assert.match(xMask, /44\.0px/);
  const yMask = buildLinearFeatherMask("y", 32);
  assert.match(yMask, /^linear-gradient\(to bottom, transparent 0px,/);
});

test("buildStationarySlideMask counter-shifts edge feather and composes bottom clip feather", () => {
  const idle = buildStationarySlideMask({
    axis: "x",
    spanPx: 420,
    bleedPx: 20,
    shiftPx: 18,
    featherPx: 0.2,
  });
  assert.equal(idle.maskImage, "");
  assert.equal(idle.composite, false);

  // Incoming right-shifted (+18px) element counter-shifts mask -18px so aperture right edge (440px -> local 422px) stays fixed
  const incoming = buildStationarySlideMask({
    axis: "x",
    spanPx: 420,
    bleedPx: 20,
    shiftPx: 18,
    featherPx: 28,
  });
  assert.equal(incoming.composite, false);
  assert.match(incoming.maskImage, /transparent -38\.0px/);
  assert.match(incoming.maskImage, /transparent 422\.0px/);

  // Shrinking panel adds vertical bottom feather layer cleanly via intersect compositing
  const shrinking = buildStationarySlideMask({
    axis: "x",
    spanPx: 256,
    bleedPx: 16,
    shiftPx: -10,
    featherPx: 24,
    bottomClipPx: 140,
    bottomFeatherPx: 22,
  });
  assert.equal(shrinking.composite, true);
  assert.match(shrinking.maskImage, /transparent -6\.0px/);
  assert.match(shrinking.maskImage, /to bottom, #000 0px, #000 118\.0px,/);
  assert.match(shrinking.maskImage, /transparent 140\.0px\)$/);
});
