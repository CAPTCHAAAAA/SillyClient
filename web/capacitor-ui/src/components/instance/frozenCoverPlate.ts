const alphaCache = new Map<string, boolean>();

export function coverIsTransparent(img: HTMLImageElement): boolean {
  const key = img.currentSrc || img.src;
  if (!key) return false;
  const cached = alphaCache.get(key);
  if (cached != null) return cached;
  if (/cover-clear-|tavern-logo/i.test(key)) {
    alphaCache.set(key, true);
    return true;
  }
  if (!img.complete || img.naturalWidth < 1) return false;
  try {
    const canvas = document.createElement("canvas");
    const width = 24;
    const height = 32;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(img, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let clear = 0;
    const total = pixels.length / 4;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 240) clear += 1;
    }
    const transparent = clear / total > 0.04;
    alphaCache.set(key, transparent);
    return transparent;
  } catch {
    alphaCache.set(key, false);
    return false;
  }
}

export interface FrozenPlateBaseMetrics {
  left: number;
  top: number;
  width: number;
  height: number;
  world: HTMLElement;
}

export function measureFrozenPlateBase(slotEl: HTMLElement): FrozenPlateBaseMetrics | null {
  const world = slotEl.querySelector<HTMLElement>(".cover-frozen-plate__world");
  if (!world) return null;
  const rect = slotEl.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    world,
  };
}

export function applyFrozenPlateTransformFromBase(
  base: FrozenPlateBaseMetrics,
  offsetX: number,
  lift: number
) {
  const s = 1 + lift * 0.052;
  const invS = 1 / s;
  const curLeft = base.left + offsetX - (s - 1) * 0.5 * base.width;
  const curTop = base.top - lift * 18 - (s - 1) * 0.5 * base.height;
  base.world.style.transform = `scale(${invS.toFixed(5)}) translate3d(${-curLeft.toFixed(2)}px, ${-curTop.toFixed(2)}px, 0)`;
}

export function syncFrozenPlatePosition(card: HTMLElement) {
  const world = card.querySelector<HTMLElement>(".cover-frozen-plate__world");
  if (!world) return;
  const rect = card.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return;
  const baseW = card.offsetWidth || rect.width;
  const baseH = card.offsetHeight || rect.height;
  const scaleX = baseW > 0 ? rect.width / baseW : 1;
  const scaleY = baseH > 0 ? rect.height / baseH : 1;
  const invX = scaleX > 0.01 ? 1 / scaleX : 1;
  const invY = scaleY > 0.01 ? 1 / scaleY : 1;
  world.style.transform = `scale(${invX.toFixed(5)}, ${invY.toFixed(5)}) translate3d(${-rect.left.toFixed(2)}px, ${-rect.top.toFixed(2)}px, 0)`;
}

function syncAmbientAnimations(ambient: HTMLElement, world: HTMLElement) {
  const ambientWrap = world.querySelector<HTMLElement>(".cover-frozen-plate__ambient");
  if (ambientWrap) {
    ambientWrap.classList.toggle("ambient-paused", ambient.classList.contains("ambient-paused"));
  }
  const srcGlows = Array.from(ambient.querySelectorAll<HTMLElement>(".ambient-glow"));
  const dstGlows = Array.from(world.querySelectorAll<HTMLElement>(".ambient-glow"));
  srcGlows.forEach((src, idx) => {
    const dst = dstGlows[idx];
    if (!dst) return;
    const srcAnim = src.getAnimations?.()[0];
    const dstAnim = dst.getAnimations?.()[0];
    if (srcAnim && dstAnim) {
      try {
        dstAnim.startTime = srcAnim.startTime;
      } catch {
        try {
          dstAnim.currentTime = srcAnim.currentTime;
        } catch {}
      }
    }
  });
}

export function fillFrozenPlate(host: HTMLElement, card: HTMLElement, allowWhileReordering = false) {
  if (!allowWhileReordering && card.closest("[data-reordering='true'], [data-dropping='true'], [data-reorder-committing='true']")) return;
  const rect = card.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return;

  const page = card.closest(".min-h-screen");
  const isLight = document.body.hasAttribute("data-preview-light") || card.classList.contains("is-light");
  const fallbackBase = isLight ? "#f4f0ed" : "#1a1625";
  const rawBase = page ? getComputedStyle(page).backgroundColor : fallbackBase;
  const base = !rawBase || rawBase === "rgba(0, 0, 0, 0)" || rawBase === "transparent" ? fallbackBase : rawBase;

  const wall = document.querySelector<HTMLElement>("[data-app-backdrop='image'], [data-preview-wallpaper]");
  const ambient = document.querySelector<HTMLElement>("[data-app-backdrop='ambient'], .ambient-glow-container");
  const wallBg = wall
    ? (() => {
        const computedBg = getComputedStyle(wall).backgroundImage;
        const varBg = getComputedStyle(wall).getPropertyValue("--preview-wallpaper-image").trim();
        return computedBg && computedBg !== "none" ? computedBg : varBg || "none";
      })()
    : "";
  const modeKey = wall ? `wall:${wallBg}` : ambient ? "ambient" : "solid";

  host.style.setProperty("--plate-base", base);
  card.style.setProperty("--plate-base", base);

  const existingWorld = host.querySelector<HTMLElement>(".cover-frozen-plate__world");
  if (existingWorld && host.dataset.plateMode === modeKey) {
    if (ambient) syncAmbientAnimations(ambient, existingWorld);
    syncFrozenPlatePosition(card);
    return;
  }

  host.dataset.plateMode = modeKey;
  host.replaceChildren();

  const stage = document.createElement("div");
  stage.className = "cover-frozen-plate__stage";

  const world = document.createElement("div");
  world.className = "cover-frozen-plate__world";

  if (wall) {
    const wallLayer = document.createElement("div");
    wallLayer.className = "cover-frozen-plate__wall";
    wallLayer.style.backgroundImage = wallBg;
    world.appendChild(wallLayer);
  } else if (ambient) {
    const ambientWrap = document.createElement("div");
    ambientWrap.className = "cover-frozen-plate__ambient";
    if (ambient.classList.contains("ambient-paused")) {
      ambientWrap.classList.add("ambient-paused");
    }
    const srcGlows = Array.from(ambient.querySelectorAll<HTMLElement>(".ambient-glow"));
    srcGlows.forEach((glow) => {
      const copy = document.createElement("div");
      copy.className = glow.className;
      ambientWrap.appendChild(copy);
    });
    world.appendChild(ambientWrap);
  }

  stage.appendChild(world);
  host.appendChild(stage);
  const veil = document.createElement("div");
  veil.className = "cover-frozen-plate__veil";
  host.appendChild(veil);

  if (ambient) {
    syncAmbientAnimations(ambient, world);
  }

  syncFrozenPlatePosition(card);
}
