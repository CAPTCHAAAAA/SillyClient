export interface FolderTabShapeInput {
  width: number;
  height: number;
  tabHeight: number;
  tabLeft: number;
  tabWidth: number;
  paneRadius: number;
  tabRadius: number;
  filletRadius: number;
  collapseRatio?: number;
  inset?: number;
}

export interface FolderTabRadii {
  activeVisible: boolean;
  effTabHeight: number;
  tabLeft: number;
  tabRight: number;
  rCornerL: number;
  rConcaveL: number;
  rTopL: number;
  rTopR: number;
  rConcaveR: number;
  rCornerR: number;
  rBotL: number;
  rBotR: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/**
 * 计算一体连通页签轮廓在任意横向位置（含靠边、贴边与溢出折叠态）下的严格相切圆角半径。
 * 所有半径遵循 `R_corner + R_concave <= gap` 与 `R_top + R_concave <= effTabHeight` 约束，避免出现尖角或跳变。
 */
export function computeFolderTabRadii(input: FolderTabShapeInput): FolderTabRadii {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  const tabHeight = clamp(input.tabHeight, 0, Math.max(0, height - 4));
  const collapseRatio = clamp(input.collapseRatio ?? 1, 0, 1);
  const effTabHeight = tabHeight * collapseRatio;
  const inset = Math.max(0, input.inset ?? 0);

  const paneBase = clamp(input.paneRadius, 0, Math.min(width / 2, Math.max(0, height - tabHeight) / 2));
  const rBotL = Math.max(0, paneBase - inset);
  const rBotR = Math.max(0, paneBase - inset);

  const rawL = clamp(input.tabLeft, 0, width);
  const rawR = clamp(input.tabLeft + input.tabWidth, rawL, width);
  const rawW = rawR - rawL;

  if (collapseRatio <= 0.02 || effTabHeight <= 1 || rawW <= 2 + inset * 2) {
    return {
      activeVisible: false,
      effTabHeight: 0,
      tabLeft: rawL,
      tabRight: rawR,
      rCornerL: rBotL,
      rConcaveL: 0,
      rTopL: 0,
      rTopR: 0,
      rConcaveR: 0,
      rCornerR: rBotR,
      rBotL,
      rBotR,
    };
  }

  const gapL = rawL;
  const gapR = Math.max(0, width - rawR);
  const maxVertFillet = Math.max(0, effTabHeight * 0.48);
  const baseFillet = Math.min(Math.max(0, input.filletRadius), maxVertFillet);

  const leftSpan = paneBase + baseFillet;
  const scaleL = leftSpan > 0 ? Math.min(1, gapL / leftSpan) : 0;
  const rawCornerL = paneBase * scaleL;
  const rawConcaveL = baseFillet * scaleL;

  const rightSpan = paneBase + baseFillet;
  const scaleR = rightSpan > 0 ? Math.min(1, gapR / rightSpan) : 0;
  const rawCornerR = paneBase * scaleR;
  const rawConcaveR = baseFillet * scaleR;

  const rCornerL = rawCornerL > 0.2 ? Math.max(0, rawCornerL - inset) : 0;
  const rCornerR = rawCornerR > 0.2 ? Math.max(0, rawCornerR - inset) : 0;

  // 内缩 d 时，外凸圆角减 d，内凹圆角加 d 才能保持 1:1 平行等距轮廓。
  const rConcaveL = rawConcaveL > 0.2
    ? clamp(rawConcaveL + inset, 0, Math.max(0, gapL - rCornerL))
    : 0;
  const rConcaveR = rawConcaveR > 0.2
    ? clamp(rawConcaveR + inset, 0, Math.max(0, gapR - rCornerR))
    : 0;

  const innerTabW = Math.max(0, rawW - inset * 2);
  const topDesired = Math.max(0, input.tabRadius - inset);
  const rTopL = clamp(topDesired, 0, Math.min(innerTabW / 2, Math.max(0, effTabHeight - rConcaveL)));
  const rTopR = clamp(topDesired, 0, Math.min(innerTabW / 2, Math.max(0, effTabHeight - rConcaveR)));

  return {
    activeVisible: true,
    effTabHeight,
    tabLeft: rawL,
    tabRight: rawR,
    rCornerL,
    rConcaveL,
    rTopL,
    rTopR,
    rConcaveR,
    rCornerR,
    rBotL,
    rBotR,
  };
}

/**
 * 生成单条闭合 SVG 路径（顺时针）包裹上方伸出页签与下方内容区。
 */
export function buildFolderTabSvgPath(input: FolderTabShapeInput): string {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  if (width <= 1 || height <= 1) return "";

  const inset = Math.max(0, input.inset ?? 0);
  const tabHeight = clamp(input.tabHeight, 0, Math.max(0, height - 4));
  const left = inset;
  const right = Math.max(left + 1, width - inset);
  const bottom = Math.max(tabHeight + inset + 1, height - inset);
  const bodyTop = tabHeight + inset;

  const radii = computeFolderTabRadii(input);
  if (!radii.activeVisible) {
    const r = radii.rBotL;
    if (r <= 0.1) {
      return `M ${fmt(left)} ${fmt(bodyTop)} L ${fmt(right)} ${fmt(bodyTop)} L ${fmt(right)} ${fmt(bottom)} L ${fmt(left)} ${fmt(bottom)} Z`;
    }
    return [
      `M ${fmt(left)} ${fmt(bodyTop + r)}`,
      `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(left + r)} ${fmt(bodyTop)}`,
      `L ${fmt(right - r)} ${fmt(bodyTop)}`,
      `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(right)} ${fmt(bodyTop + r)}`,
      `L ${fmt(right)} ${fmt(bottom - r)}`,
      `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(right - r)} ${fmt(bottom)}`,
      `L ${fmt(left + r)} ${fmt(bottom)}`,
      `A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(left)} ${fmt(bottom - r)}`,
      "Z",
    ].join(" ");
  }

  const topY = tabHeight - radii.effTabHeight + inset;
  const xL = radii.tabLeft + inset;
  const xR = radii.tabRight - inset;
  const { rCornerL, rConcaveL, rTopL, rTopR, rConcaveR, rCornerR, rBotL, rBotR } = radii;

  const commands: string[] = [];
  commands.push(`M ${fmt(left)} ${fmt(bodyTop + rCornerL)}`);

  if (rCornerL > 0.1) {
    commands.push(`A ${fmt(rCornerL)} ${fmt(rCornerL)} 0 0 1 ${fmt(left + rCornerL)} ${fmt(bodyTop)}`);
  }

  const leftJoinX = xL - rConcaveL;
  if (leftJoinX > left + rCornerL + 0.05) {
    commands.push(`L ${fmt(leftJoinX)} ${fmt(bodyTop)}`);
  }

  if (rConcaveL > 0.1) {
    commands.push(`A ${fmt(rConcaveL)} ${fmt(rConcaveL)} 0 0 0 ${fmt(xL)} ${fmt(bodyTop - rConcaveL)}`);
  }

  if (topY + rTopL < bodyTop - rConcaveL - 0.05) {
    commands.push(`L ${fmt(xL)} ${fmt(topY + rTopL)}`);
  }

  if (rTopL > 0.1) {
    commands.push(`A ${fmt(rTopL)} ${fmt(rTopL)} 0 0 1 ${fmt(xL + rTopL)} ${fmt(topY)}`);
  }

  if (xR - rTopR > xL + rTopL + 0.05) {
    commands.push(`L ${fmt(xR - rTopR)} ${fmt(topY)}`);
  }

  if (rTopR > 0.1) {
    commands.push(`A ${fmt(rTopR)} ${fmt(rTopR)} 0 0 1 ${fmt(xR)} ${fmt(topY + rTopR)}`);
  }

  if (bodyTop - rConcaveR > topY + rTopR + 0.05) {
    commands.push(`L ${fmt(xR)} ${fmt(bodyTop - rConcaveR)}`);
  }

  if (rConcaveR > 0.1) {
    commands.push(`A ${fmt(rConcaveR)} ${fmt(rConcaveR)} 0 0 0 ${fmt(xR + rConcaveR)} ${fmt(bodyTop)}`);
  }

  const rightBridgeEnd = right - rCornerR;
  if (rightBridgeEnd > xR + rConcaveR + 0.05) {
    commands.push(`L ${fmt(rightBridgeEnd)} ${fmt(bodyTop)}`);
  }

  if (rCornerR > 0.1) {
    commands.push(`A ${fmt(rCornerR)} ${fmt(rCornerR)} 0 0 1 ${fmt(right)} ${fmt(bodyTop + rCornerR)}`);
  }

  if (bottom - rBotR > bodyTop + rCornerR + 0.05) {
    commands.push(`L ${fmt(right)} ${fmt(bottom - rBotR)}`);
  }

  if (rBotR > 0.1) {
    commands.push(`A ${fmt(rBotR)} ${fmt(rBotR)} 0 0 1 ${fmt(right - rBotR)} ${fmt(bottom)}`);
  }

  if (left + rBotL < right - rBotR - 0.05) {
    commands.push(`L ${fmt(left + rBotL)} ${fmt(bottom)}`);
  }

  if (rBotL > 0.1) {
    commands.push(`A ${fmt(rBotL)} ${fmt(rBotL)} 0 0 1 ${fmt(left)} ${fmt(bottom - rBotL)}`);
  }

  commands.push("Z");
  return commands.join(" ");
}

/**
 * 将标签轨道内的平滑矩形投影到外层裁切视口 `[clipLeft, clipRight]`，超出部分按收缩比例优雅回收，避免突兀压穿箭头按钮。
 */
export function projectTabToClipViewport(
  tabOffsetLeft: number,
  tabWidth: number,
  scrollLeft: number,
  viewportLeft: number,
  viewportRight: number
): { tabLeft: number; tabWidth: number; collapseRatio: number } {
  const rawL = viewportLeft + tabOffsetLeft - scrollLeft;
  const rawR = rawL + Math.max(0, tabWidth);
  const clampedL = clamp(rawL, viewportLeft, viewportRight);
  const clampedR = clamp(rawR, clampedL, viewportRight);
  const visibleW = Math.max(0, clampedR - clampedL);
  const clipL = Math.max(0, viewportLeft - rawL);
  const clipR = Math.max(0, rawR - viewportRight);
  const maxClip = Math.max(clipL, clipR);
  // 留出 4px 容差，超出即在文字触碰圆角前平滑回收凸耳高度
  const clipRatio = maxClip <= 4 ? 1 : clamp(1 - (maxClip - 4) / 14, 0, 1);
  const visibilityRatio = visibleW <= 0.5 ? 0 : clamp(visibleW / 24, 0, 1);
  const collapseRatio = Math.min(clipRatio, visibilityRatio);
  return {
    tabLeft: clampedL,
    tabWidth: visibleW,
    collapseRatio,
  };
}
