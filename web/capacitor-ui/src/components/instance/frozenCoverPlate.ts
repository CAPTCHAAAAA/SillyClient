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

interface FrozenPlateRefresh {
  host: HTMLElement;
  card: HTMLElement;
  allowWhileReordering: boolean;
}

function readBackdropScene(page: Element | null, isLight: boolean) {
  const fallbackBase = isLight ? "#f4f0ed" : "#1a1625";
  const rawBase = page ? getComputedStyle(page).backgroundColor : fallbackBase;
  const base = !rawBase || rawBase === "rgba(0, 0, 0, 0)" || rawBase === "transparent" ? fallbackBase : rawBase;
  const wall = document.querySelector<HTMLElement>("[data-app-backdrop='image'], [data-preview-wallpaper]");
  const ambient = document.querySelector<HTMLElement>("[data-app-backdrop='ambient'], .ambient-glow-container");
  const wallStyle = wall ? getComputedStyle(wall) : null;
  const wallBg = wallStyle
    ? wallStyle.backgroundImage && wallStyle.backgroundImage !== "none"
      ? wallStyle.backgroundImage
      : wallStyle.getPropertyValue("--preview-wallpaper-image").trim() || "none"
    : "";
  const modeKey = wall ? `wall:${wallBg}` : ambient ? "ambient" : "solid";
  const glows = !wall && ambient
    ? Array.from(ambient.querySelectorAll<HTMLElement>(".ambient-glow")).map(glow => {
        const animation = glow.getAnimations?.()[0];
        return {
          className: glow.className,
          animation,
          startTime: animation?.startTime ?? null,
          currentTime: animation?.currentTime ?? null,
        };
      })
    : [];
  return { base, wall, wallBg, ambient, modeKey, glows, paused: ambient?.classList.contains("ambient-paused") ?? false };
}

function refreshFrozenPlates(targets: FrozenPlateRefresh[]) {
  const scenes = new Map<Element, ReturnType<typeof readBackdropScene>>();
  const snapshots = targets.flatMap(target => {
    const { card, host, allowWhileReordering } = target;
    if (!card.isConnected || !host.isConnected) return [];
    if (!allowWhileReordering && card.closest("[data-reordering='true'], [data-dropping='true'], [data-reorder-committing='true']")) return [];
    const rect = card.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return [];
    const page = card.closest(".min-h-screen");
    const sceneKey = page || card;
    let scene = scenes.get(sceneKey);
    if (!scene) {
      scene = readBackdropScene(page, document.body.hasAttribute("data-preview-light") || card.classList.contains("is-light"));
      scenes.set(sceneKey, scene);
    }
    return [{
      ...target, scene, rect,
      width: card.offsetWidth || rect.width,
      height: card.offsetHeight || rect.height,
      world: host.querySelector<HTMLElement>(".cover-frozen-plate__world"),
    }];
  });

  for (const snapshot of snapshots) {
    const { host, card, scene } = snapshot;
    for (const node of [host, card]) {
      if (node.style.getPropertyValue("--plate-base") !== scene.base) {
        node.style.setProperty("--plate-base", scene.base);
      }
    }
    if (!snapshot.world || host.dataset.plateMode !== scene.modeKey) {
      host.dataset.plateMode = scene.modeKey;
      const stage = document.createElement("div");
      stage.className = "cover-frozen-plate__stage";
      const world = document.createElement("div");
      world.className = "cover-frozen-plate__world";
      if (scene.wall) {
        const wallLayer = document.createElement("div");
        wallLayer.className = "cover-frozen-plate__wall";
        wallLayer.style.backgroundImage = scene.wallBg;
        world.appendChild(wallLayer);
      } else if (scene.ambient) {
        const ambientWrap = document.createElement("div");
        ambientWrap.className = "cover-frozen-plate__ambient";
        if (scene.paused) ambientWrap.classList.add("ambient-paused");
        for (const glow of scene.glows) {
          const copy = document.createElement("div");
          copy.className = glow.className;
          ambientWrap.appendChild(copy);
        }
        world.appendChild(ambientWrap);
      }
      stage.appendChild(world);
      const veil = document.createElement("div");
      veil.className = "cover-frozen-plate__veil";
      host.replaceChildren(stage, veil);
      snapshot.world = world;
    }
    const world = snapshot.world;
    const ambientWrap = world.querySelector<HTMLElement>(".cover-frozen-plate__ambient");
    if (scene.ambient && ambientWrap?.classList.contains("ambient-paused") !== scene.paused) {
      ambientWrap?.classList.toggle("ambient-paused", scene.paused);
    }
    const scaleX = snapshot.rect.width / snapshot.width;
    const scaleY = snapshot.rect.height / snapshot.height;
    const invX = scaleX > 0.01 ? 1 / scaleX : 1;
    const invY = scaleY > 0.01 ? 1 / scaleY : 1;
    world.style.transform = `scale(${invX.toFixed(5)}, ${invY.toFixed(5)}) translate3d(${-snapshot.rect.left.toFixed(2)}px, ${-snapshot.rect.top.toFixed(2)}px, 0)`;
  }

  const animationUpdates = snapshots.flatMap(({ world, scene }) => {
    if (!world || !scene.ambient) return [];
    return Array.from(world.querySelectorAll<HTMLElement>(".ambient-glow")).flatMap((glow, index) => {
      const source = scene.glows[index];
      const animation = glow.getAnimations?.()[0];
      return source?.animation && animation ? [{ animation, source }] : [];
    });
  });
  for (const { animation, source } of animationUpdates) {
    try {
      animation.startTime = source.startTime;
    } catch {
      try {
        animation.currentTime = source.currentTime;
      } catch {}
    }
  }
}

const pendingRefreshes = new Map<HTMLElement, FrozenPlateRefresh>();
let refreshQueued = false;

export function queueFrozenPlate(host: HTMLElement, card: HTMLElement, allowWhileReordering = false) {
  const target = { host, card, allowWhileReordering };
  pendingRefreshes.set(host, target);
  if (!refreshQueued) {
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      const targets = [...pendingRefreshes.values()];
      pendingRefreshes.clear();
      refreshFrozenPlates(targets);
    });
  }
  return () => {
    if (pendingRefreshes.get(host) === target) pendingRefreshes.delete(host);
  };
}

export function fillFrozenPlate(host: HTMLElement, card: HTMLElement, allowWhileReordering = false) {
  pendingRefreshes.delete(host);
  refreshFrozenPlates([{ host, card, allowWhileReordering }]);
}
