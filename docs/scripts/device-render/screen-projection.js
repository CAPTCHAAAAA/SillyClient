function solveLinearSystem(matrix, values) {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index]]);

  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-10) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];

    const divisor = rows[column][column];
    for (let index = column; index <= size; index++) rows[column][index] /= divisor;

    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= size; index++) {
        rows[row][index] -= factor * rows[column][index];
      }
    }
  }
  return rows.map(row => row[size]);
}

function quadToMatrix3d(points, width, height) {
  const source = [[0, 0], [width, 0], [width, height], [0, height]];
  const matrix = [];
  const values = [];

  source.forEach(([x, y], index) => {
    const { x: targetX, y: targetY } = points[index];
    matrix.push([x, 0, y, 0, 1, 0, -targetX * x, -targetX * y]);
    values.push(targetX);
    matrix.push([0, x, 0, y, 0, 1, -targetY * x, -targetY * y]);
    values.push(targetY);
  });

  const result = solveLinearSystem(matrix, values);
  if (!result) return null;
  const [a, b, c, d, e, f, g, h] = result;
  return `matrix3d(${a},${b},0,${g},${c},${d},0,${h},0,0,1,0,${e},${f},0,1)`;
}

export function createScreenProjection({ THREE, camera, canvas, section, isStageVisible }) {
  const transforms = new WeakMap();

  function toScreen(worldPosition) {
    const projected = worldPosition.clone().project(camera);
    const canvasRect = canvas.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    return {
      x: canvasRect.left - sectionRect.left + (projected.x + 1) / 2 * canvasRect.width,
      y: canvasRect.top - sectionRect.top + (1 - projected.y) / 2 * canvasRect.height,
      z: projected.z
    };
  }

  function stabilize(point) {
    const precision = Math.max(1, window.devicePixelRatio || 1) * 32;
    return {
      x: Math.round(point.x * precision) / precision,
      y: Math.round(point.y * precision) / precision,
      z: point.z
    };
  }

  function update({
    frame,
    mesh,
    planeZ,
    localCorners,
    insetXRatio,
    insetYRatio,
    fallbackWidth,
    fallbackHeight
  }) {
    if (!frame || !mesh || !isStageVisible()) {
      if (frame) frame.style.display = 'none';
      return;
    }

    mesh.updateMatrixWorld(true);
    const box = mesh.geometry.boundingBox;
    const insetX = (box.max.x - box.min.x) * (insetXRatio || 0);
    const insetY = (box.max.y - box.min.y) * (insetYRatio || 0);
    const overlayCorners = localCorners || [
      new THREE.Vector3(box.min.x + insetX, box.max.y - insetY, planeZ),
      new THREE.Vector3(box.max.x - insetX, box.max.y - insetY, planeZ),
      new THREE.Vector3(box.max.x - insetX, box.min.y + insetY, planeZ),
      new THREE.Vector3(box.min.x + insetX, box.min.y + insetY, planeZ)
    ];
    const projected = overlayCorners.map(sourceCorner => {
      const corner = sourceCorner.clone();
      mesh.localToWorld(corner);
      return stabilize(toScreen(corner));
    });

    if (projected.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.z) > 1)) {
      frame.style.display = 'none';
      return;
    }

    const byY = [...projected].sort((a, b) => a.y - b.y);
    const top = byY.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottom = byY.slice(2).sort((a, b) => a.x - b.x);
    const visualCorners = [top[0], top[1], bottom[1], bottom[0]];
    const transform = quadToMatrix3d(visualCorners, fallbackWidth, fallbackHeight);
    if (!transform) {
      frame.style.display = 'none';
      return;
    }

    frame.style.display = 'block';
    if (transforms.get(frame) !== transform) {
      frame.style.transform = transform;
      transforms.set(frame, transform);
    }
  }

  return {
    project: toScreen,
    update
  };
}
