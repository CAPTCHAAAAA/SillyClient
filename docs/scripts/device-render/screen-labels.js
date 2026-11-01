// 手机浮动标签（标题/CTA）：把 3D 包围盒角点投影到屏幕并驱动 DOM 样式。
// 从装配文件抽出，让投影 DOM 写入保持单一职责；数学与阈值原样保留。
export function createScreenLabels({ THREE, screenProjection, title, cta, reduced }) {
  let titleW = 0;
  let titleH = 0;
  let ctaW = 0;
  let ctaH = 0;

  return function updateScreenLabels({ phoneGroup, phoneVisible, journeyEase, journeyProgress }) {
    if (!phoneGroup || !phoneVisible || !title || !cta || reduced) return;

    const labelVisible = journeyEase < 0.6 && journeyProgress > 0.02;
    title.classList.toggle('is-visible', labelVisible);
    cta.classList.toggle('is-visible', labelVisible);
    if (!labelVisible) return;

    phoneGroup.updateMatrixWorld(true);
    titleW = title.offsetWidth || 0;
    titleH = title.offsetHeight || 0;
    ctaW = cta.offsetWidth || 0;
    ctaH = cta.offsetHeight || 0;
    const box3 = new THREE.Box3().setFromObject(phoneGroup);
    const labelAlpha = THREE.MathUtils.smoothstep(journeyEase, 0, 0.3) * THREE.MathUtils.smoothstep(journeyEase, 0.6, 0.35);
    title.style.opacity = labelAlpha.toFixed(3);
    cta.style.opacity = labelAlpha.toFixed(3);

    // Title label: top-right corner of phone bounding box, offset outward
    const topRightWorld = new THREE.Vector3(box3.max.x + 0.18, box3.max.y + 0.08, box3.min.z);
    const topRightScreen = screenProjection.project(topRightWorld);
    if (Number.isFinite(topRightScreen.x) && Math.abs(topRightScreen.z) < 1) {
      title.style.transform = `translate(${topRightScreen.x - titleW}px, ${topRightScreen.y}px)`;
    }
    // CTA label: bottom-left corner, offset outward
    const bottomLeftWorld = new THREE.Vector3(box3.min.x - 0.08, box3.min.y - 0.22, box3.min.z);
    const bottomLeftScreen = screenProjection.project(bottomLeftWorld);
    if (Number.isFinite(bottomLeftScreen.x) && Math.abs(bottomLeftScreen.z) < 1) {
      cta.style.transform = `translate(${bottomLeftScreen.x}px, ${bottomLeftScreen.y - ctaH}px)`;
    }
  };
}
