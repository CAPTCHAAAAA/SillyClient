export type CoverTone = "light" | "dynamic" | "dark";

export function coverTone(isLight: boolean, isDynamic = false): CoverTone {
  if (isLight) return "light";
  return isDynamic ? "dynamic" : "dark";
}

/** 白天白雾不动。暗色不再铺色雾，只留一层很薄的高光。 */
export function coverWash(tone: CoverTone): string {
  if (tone === "light") {
    return "linear-gradient(135deg, oklch(1 0 0 / 0.40) 0%, oklch(1 0 0 / 0.25) 100%)";
  }
  return "linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 36%, transparent 62%)";
}

/**
 * 透明像素底下的实色底板。不透明封面盖住它。
 * 黑夜沿界面墨色。动态壁纸在紫和酒红之间流动，底板取这条色带的中段。
 * 不落在暗紫一端，也不落在酒红一端，明度仍按黑夜那层。
 */
export function coverPlate(tone: CoverTone): string {
  if (tone === "light") return "#fbfafc";
  if (tone === "dynamic") {
    return "linear-gradient(168deg, #281824 0%, #241621 52%, #21141e 100%)";
  }
  return "linear-gradient(168deg, #1f1c2a 0%, #1c1926 52%, #1a1723 100%)";
}
