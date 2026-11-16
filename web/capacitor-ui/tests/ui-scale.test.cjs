const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function loadUiScaleModule() {
  const sourcePath = path.join(__dirname, "..", "src", "lib", "ui-scale.ts");
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
      throw new Error("Unexpected require in ui-scale.ts");
    },
  });
  return compiledModule.exports;
}

function createFakeDocument() {
  const props = new Map();
  const attrs = new Map();
  const root = {
    style: {
      zoom: "",
      setProperty(name, value) {
        props.set(name, String(value));
      },
      removeProperty(name) {
        props.delete(name);
      },
      getPropertyValue(name) {
        return props.get(name) ?? "";
      },
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    removeAttribute(name) {
      attrs.delete(name);
    },
    getAttribute(name) {
      return attrs.get(name) ?? null;
    },
  };
  return { documentElement: root, _attrs: attrs, _props: props };
}

test("normalizeUiScale clamps, parses percentages, and guards invalid inputs", () => {
  const { normalizeUiScale, formatUiScaleLabel, UI_SCALE_MIN, UI_SCALE_MAX, UI_SCALE_STEP, DEFAULT_UI_SCALE } =
    loadUiScaleModule();
  assert.equal(UI_SCALE_MIN, 0.9);
  assert.equal(UI_SCALE_MAX, 1.5);
  assert.equal(UI_SCALE_STEP, 0.05);
  assert.equal(normalizeUiScale(null), DEFAULT_UI_SCALE);
  assert.equal(normalizeUiScale(""), DEFAULT_UI_SCALE);
  assert.equal(normalizeUiScale("not-a-number"), DEFAULT_UI_SCALE);
  assert.equal(normalizeUiScale(-2), DEFAULT_UI_SCALE);
  assert.equal(normalizeUiScale(Number.NaN), DEFAULT_UI_SCALE);

  assert.equal(normalizeUiScale(0.9), 0.9);
  assert.equal(normalizeUiScale(1.05), 1.05);
  assert.equal(normalizeUiScale(1.18), 1.2);
  assert.equal(normalizeUiScale("1.25"), 1.25);
  assert.equal(normalizeUiScale("135%"), 1.35);
  assert.equal(normalizeUiScale("150%"), 1.5);
  assert.equal(normalizeUiScale(0.4), 0.9);
  assert.equal(normalizeUiScale(2.5), 1.5);
  assert.equal(formatUiScaleLabel(0.9), "90%");
  assert.equal(formatUiScaleLabel(1.05), "105%");
  assert.equal(formatUiScaleLabel(1.25), "125%");
});

test("saveUiScale and loadUiScale persist safely across storage implementations", () => {
  const { saveUiScale, loadUiScale, UI_SCALE_STORAGE_KEY } = loadUiScaleModule();
  const backing = new Map();
  const storage = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, String(v)),
    removeItem: (k) => backing.delete(k),
  };

  assert.equal(loadUiScale(storage), 1);
  assert.equal(saveUiScale(1.25, storage), 1.25);
  assert.equal(backing.get(UI_SCALE_STORAGE_KEY), "1.25");
  assert.equal(loadUiScale(storage), 1.25);

  assert.equal(saveUiScale(1, storage), 1);
  assert.equal(backing.has(UI_SCALE_STORAGE_KEY), false);
  assert.equal(loadUiScale(storage), 1);

  const throwingStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(loadUiScale(throwingStorage), 1);
  assert.equal(saveUiScale(1.5, throwingStorage), 1.5);
});

test("applyUiScale configures root zoom, CSS var, unscaled coordinate helpers, and resets cleanly", () => {
  const { applyUiScale, getAppliedUiScale, toUnscaledPx, getScaledViewportMetrics } = loadUiScaleModule();
  const doc = createFakeDocument();
  const fakeWin = {
    innerWidth: 1280,
    innerHeight: 800,
    visualViewport: { width: 390, height: 844, offsetLeft: 0, offsetTop: 15 },
  };

  assert.equal(applyUiScale(1.25, doc), 1.25);
  assert.equal(doc.documentElement.style.zoom, "1.25");
  assert.equal(doc._props.get("--ui-scale"), "1.25");
  assert.equal(doc._attrs.get("data-ui-scaled"), "true");
  assert.equal(getAppliedUiScale(doc), 1.25);
  assert.equal(toUnscaledPx(250, doc), 200);
  assert.deepEqual({ ...getScaledViewportMetrics(fakeWin, doc, false) }, {
    width: 1024,
    height: 640,
    left: 0,
    top: 0,
  });
  assert.deepEqual({ ...getScaledViewportMetrics(fakeWin, doc, true) }, {
    width: 312,
    height: 675,
    left: 0,
    top: 12,
  });

  assert.equal(applyUiScale(1, doc), 1);
  assert.equal(doc.documentElement.style.zoom, "");
  assert.equal(doc._props.has("--ui-scale"), false);
  assert.equal(doc._attrs.has("data-ui-scaled"), false);
  assert.equal(getAppliedUiScale(doc), 1);
  assert.equal(toUnscaledPx(250, doc), 250);
});
