declare global {
  interface Window {
    SillyClientCarouselSnap: {
      set(track: HTMLElement, owner: "drag" | "tilt", locked: boolean): void;
      has(track: HTMLElement, owner: "drag" | "tilt"): boolean;
    };
  }
}

export function setCarouselSnapLock(track: HTMLElement, owner: "drag" | "tilt", locked: boolean) {
  window.SillyClientCarouselSnap.set(track, owner, locked);
}
