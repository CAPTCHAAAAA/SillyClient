/**
 * 跨平台界面缩放工具 (ui-scale)
 * 通过根元素 CSS zoom 与 --ui-scale / --ui-vw / --ui-vh 变量提供一致的全局缩放与坐标换算。
 */

export const UI_SCALE_STORAGE_KEY = "sillyclient.uiScale";
export const DEFAULT_UI_SCALE = 1;
export const UI_SCALE_MIN = 0.9;
export const UI_SCALE_MAX = 1.5;
export const UI_SCALE_STEP = 0.05;
export const UI_SCALE_OPTIONS = [0.9, 1, 1.1, 1.25, 1.5] as const;

export type UiScaleOption = number;

/**
 * 将任意输入规整为安全范围内的界面缩放倍率（0.9–1.5，步进 0.05），无效输入回退默认值 1。
 */
export function normalizeUiScale(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_UI_SCALE;
  }

  let parsed = Number.NaN;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return DEFAULT_UI_SCALE;
    if (trimmed.endsWith("%")) {
      parsed = Number(trimmed.slice(0, -1).trim()) / 100;
    } else {
      parsed = Number(trimmed);
    }
  }

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_UI_SCALE;
  }

  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, parsed));
  const stepped = Math.round(clamped / UI_SCALE_STEP) * UI_SCALE_STEP;
  return Math.round(stepped * 100) / 100;
}

/**
 * 将缩放倍率格式化为百分比显示文本。
 */
export function formatUiScaleLabel(scale: number): string {
  return `${Math.round(normalizeUiScale(scale) * 100)}%`;
}

/**
 * 从 localStorage 读取界面缩放偏好（兼容隐私模式与隔离沙箱）。
 */
export function loadUiScale(
  storage: Pick<Storage, "getItem"> | null = typeof window !== "undefined" ? window.localStorage : null
): number {
  try {
    if (!storage) return DEFAULT_UI_SCALE;
    return normalizeUiScale(storage.getItem(UI_SCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_UI_SCALE;
  }
}

/**
 * 将界面缩放偏好写入 localStorage，默认倍率移除持久化键保持干净。
 */
export function saveUiScale(
  scale: unknown,
  storage: Pick<Storage, "setItem" | "removeItem"> | null = typeof window !== "undefined" ? window.localStorage : null
): number {
  const normalized = normalizeUiScale(scale);
  try {
    if (storage) {
      if (normalized === DEFAULT_UI_SCALE) {
        storage.removeItem(UI_SCALE_STORAGE_KEY);
      } else {
        storage.setItem(UI_SCALE_STORAGE_KEY, String(normalized));
      }
    }
  } catch {
    // 忽略沙箱或隐私浏览模式下的存储异常
  }
  return normalized;
}

/**
 * 将缩放倍率应用到根文档；100% 时清理内联属性以零副作用还原默认态。
 */
export function applyUiScale(
  scale: unknown,
  doc: Document | null = typeof document !== "undefined" ? document : null
): number {
  const normalized = normalizeUiScale(scale);
  const root = doc?.documentElement;
  if (root) {
    if (normalized === DEFAULT_UI_SCALE) {
      root.style.zoom = "";
      root.style.removeProperty("--ui-scale");
      root.removeAttribute("data-ui-scaled");
    } else {
      root.style.zoom = String(normalized);
      root.style.setProperty("--ui-scale", String(normalized));
      root.setAttribute("data-ui-scaled", "true");
    }
  }
  return normalized;
}

/**
 * 读取当前文档生效的界面缩放倍率。
 */
export function getAppliedUiScale(
  doc: Document | null = typeof document !== "undefined" ? document : null
): number {
  const root = doc?.documentElement;
  if (!root) return DEFAULT_UI_SCALE;

  const varRaw = root.style.getPropertyValue("--ui-scale").trim();
  if (varRaw) {
    const parsedVar = Number(varRaw);
    if (Number.isFinite(parsedVar) && parsedVar > 0) {
      return parsedVar;
    }
  }

  const zoomRaw = String(root.style.zoom || "").trim();
  if (zoomRaw) {
    const parsedZoom = Number(zoomRaw);
    if (Number.isFinite(parsedZoom) && parsedZoom > 0) {
      return parsedZoom;
    }
  }

  return DEFAULT_UI_SCALE;
}

/**
 * 将浏览器视口坐标或尺寸换算为根缩放坐标系下的 CSS 像素值。
 */
export function toUnscaledPx(
  visualPx: number,
  doc: Document | null = typeof document !== "undefined" ? document : null
): number {
  const scale = getAppliedUiScale(doc);
  if (!Number.isFinite(visualPx) || scale === 1) return visualPx;
  return visualPx / scale;
}

/**
 * 获取已按当前 UI 缩放倍率折算的视口尺寸与偏移（供浮窗与管理面板布局使用）。
 */
export function getScaledViewportMetrics(
  win: Window | null = typeof window !== "undefined" ? window : null,
  doc: Document | null = typeof document !== "undefined" ? document : null,
  useVisualViewport = false
): { width: number; height: number; left: number; top: number } {
  if (!win) return { width: 0, height: 0, left: 0, top: 0 };
  const scale = getAppliedUiScale(doc);
  const viewport = useVisualViewport ? win.visualViewport : null;
  if (viewport) {
    return {
      width: Math.round(viewport.width / scale),
      height: Math.round(viewport.height / scale),
      left: Math.round(viewport.offsetLeft / scale),
      top: Math.round(viewport.offsetTop / scale),
    };
  }
  return {
    width: Math.round(win.innerWidth / scale),
    height: Math.round(win.innerHeight / scale),
    left: 0,
    top: 0,
  };
}
