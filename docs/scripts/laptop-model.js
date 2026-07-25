const LID_NAME = 'VCQqxpxkUlzqcJI_62';
const SCREEN_NAME = 'Object_123';
const DECK_NAME = 'Object_52';
const LOGO_NAMES = new Set(['Object_54', 'Object_82', 'Object_125']);
const HINGE_Y = -12.38;

function findLargestDisplayMesh(THREE, model) {
  let candidate = null;
  let candidateArea = 0;

  model.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    object.geometry.computeBoundingBox();
    const size = object.geometry.boundingBox.getSize(new THREE.Vector3());
    const area = size.x * size.y;
    const isDisplayPlane = area > candidateArea && size.z < Math.max(size.x, size.y) * 0.02;
    if (isDisplayPlane) {
      candidate = object;
      candidateArea = area;
    }
  });

  return candidate;
}

function prepareMaterials(THREE, model, screenMesh) {
  const preparedMaterials = new Set();
  model.traverse((object) => {
    if (!object.isMesh) return;

    if (LOGO_NAMES.has(object.name)) {
      object.visible = false;
      return;
    }

    if (object === screenMesh) {
      object.material = new THREE.MeshStandardMaterial({
        color: 0x010102,
        metalness: 0,
        roughness: 1,
        envMapIntensity: 0.05,
        side: THREE.DoubleSide,
        depthWrite: true
      });
      return;
    }

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material?.isMeshStandardMaterial || preparedMaterials.has(material)) return;
      preparedMaterials.add(material);
      material.envMapIntensity = 0.64;
      if ((material.metalness ?? 0) > 0.22) {
        material.metalness = Math.max(material.metalness, 0.92);
        material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.21, 0.17, 0.25);
      }
      material.needsUpdate = true;
    });
  });
}

function geometryNormal(THREE, mesh) {
  const geometry = mesh.geometry;
  const positions = geometry?.attributes?.position;
  if (!positions || positions.count < 3) return null;

  const index = geometry.index;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();

  const normal = new THREE.Vector3();
  const largestNormal = new THREE.Vector3();
  let largestAreaSquared = 0;
  for (let offset = 0; offset + 2 < (index ? index.count : positions.count); offset += 3) {
    const ia = index ? index.getX(offset) : offset;
    const ib = index ? index.getX(offset + 1) : offset + 1;
    const ic = index ? index.getX(offset + 2) : offset + 2;
    a.fromBufferAttribute(positions, ia);
    b.fromBufferAttribute(positions, ib);
    c.fromBufferAttribute(positions, ic);
    edgeA.subVectors(b, a);
    edgeB.subVectors(c, a);
    normal.copy(edgeA).cross(edgeB);
    const areaSquared = normal.lengthSq();
    if (areaSquared > largestAreaSquared) {
      largestAreaSquared = areaSquared;
      largestNormal.copy(normal);
    }
  }

  return largestAreaSquared > 1e-8 ? largestNormal.normalize() : null;
}

function computePlanarCorners(THREE, mesh) {
  const positions = mesh.geometry?.attributes?.position;
  const normal = geometryNormal(THREE, mesh);
  if (!positions || !normal) return null;

  mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
  const candidates = [
    { axis: new THREE.Vector3(1, 0, 0), extent: size.x },
    { axis: new THREE.Vector3(0, 1, 0), extent: size.y },
    { axis: new THREE.Vector3(0, 0, 1), extent: size.z }
  ].sort((a, b) => b.extent - a.extent);

  let horizontal = null;
  for (const candidate of candidates) {
    const projected = candidate.axis.clone().addScaledVector(normal, -candidate.axis.dot(normal));
    if (projected.lengthSq() > 0.25) {
      horizontal = projected.normalize();
      break;
    }
  }
  if (!horizontal) return null;

  const vertical = new THREE.Vector3().crossVectors(normal, horizontal).normalize();
  const center = new THREE.Vector3();
  const point = new THREE.Vector3();
  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index);
    center.add(point);
  }
  center.multiplyScalar(1 / positions.count);

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index).sub(center);
    const u = point.dot(horizontal);
    const v = point.dot(vertical);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }

  const at = (u, v) => center.clone()
    .addScaledVector(horizontal, u)
    .addScaledVector(vertical, v);
  return {
    corners: [at(minU, minV), at(maxU, minV), at(maxU, maxV), at(minU, maxV)],
    aspect: (maxU - minU) / Math.max(maxV - minV, 1e-6)
  };
}

function findDeckMesh(THREE, model, lid, screenMesh) {
  const namedDeck = model.getObjectByName(DECK_NAME);
  if (namedDeck?.isMesh) return namedDeck;

  let candidate = null;
  let candidateArea = 0;
  model.traverse((object) => {
    if (!object.isMesh || object === screenMesh || lid?.getObjectById(object.id)) return;
    object.geometry.computeBoundingBox();
    const size = object.geometry.boundingBox.getSize(new THREE.Vector3());
    const dimensions = [size.x, size.y, size.z].sort((a, b) => a - b);
    const area = dimensions[1] * dimensions[2];
    if (dimensions[0] / Math.max(dimensions[2], 1e-6) < 0.08 && area > candidateArea) {
      candidate = object;
      candidateArea = area;
    }
  });
  return candidate;
}

function calibratePerpendicularLid(THREE, root, lidPivot, screenMesh, deckMesh) {
  if (!lidPivot) return { angle: 0.58, error: 1 };
  const screenLocalNormal = geometryNormal(THREE, screenMesh);
  const deckLocalNormal = geometryNormal(THREE, deckMesh);
  if (!screenLocalNormal || !deckLocalNormal) return { angle: 0.58, error: 1 };

  const screenNormal = new THREE.Vector3();
  const deckNormal = new THREE.Vector3();
  const screenNormalMatrix = new THREE.Matrix3();
  const deckNormalMatrix = new THREE.Matrix3();
  let bestAngle = 0.58;
  let bestAlignment = Infinity;

  function alignmentAt(angle) {
    lidPivot.rotation.x = angle;
    root.updateMatrixWorld(true);
    screenNormalMatrix.getNormalMatrix(screenMesh.matrixWorld);
    deckNormalMatrix.getNormalMatrix(deckMesh.matrixWorld);
    screenNormal.copy(screenLocalNormal).applyMatrix3(screenNormalMatrix).normalize();
    deckNormal.copy(deckLocalNormal).applyMatrix3(deckNormalMatrix).normalize();
    return Math.abs(screenNormal.dot(deckNormal));
  }

  for (let step = 0; step <= 160; step += 1) {
    const angle = step / 160 * 1.7;
    const alignment = alignmentAt(angle);
    if (alignment < bestAlignment) {
      bestAlignment = alignment;
      bestAngle = angle;
    }
  }

  let low = Math.max(0, bestAngle - 0.02);
  let high = Math.min(1.7, bestAngle + 0.02);
  for (let iteration = 0; iteration < 26; iteration += 1) {
    const left = low + (high - low) / 3;
    const right = high - (high - low) / 3;
    if (alignmentAt(left) <= alignmentAt(right)) high = right;
    else low = left;
  }
  bestAngle = (low + high) / 2;
  bestAlignment = alignmentAt(bestAngle);

  lidPivot.rotation.x = bestAngle;
  root.updateMatrixWorld(true);
  return { angle: bestAngle, error: bestAlignment };
}

function createLidPivot(THREE, model, lid) {
  if (!lid?.parent) return null;

  const parent = lid.parent;
  model.updateMatrixWorld(true);

  const pivot = new THREE.Group();
  pivot.name = 'SillyClientLaptopLidPivot';
  pivot.position.set(0, HINGE_Y, 0);
  parent.add(pivot);
  pivot.updateMatrixWorld(true);
  pivot.attach(lid);
  return pivot;
}

export function loadLaptopModel({ THREE, loader, scene }) {
  return new Promise((resolve, reject) => {
    loader.load('./models/macbook_pro_m3_16_inch_2024.glb', (gltf) => {
      const model = gltf.scene;
      const lid = model.getObjectByName(LID_NAME);
      const screenMesh = model.getObjectByName(SCREEN_NAME) || findLargestDisplayMesh(THREE, model);
      const deckMesh = findDeckMesh(THREE, model, lid, screenMesh);

      if (!screenMesh?.isMesh || !deckMesh?.isMesh) {
        reject(new Error('MacBook display or keyboard plane mesh was not found'));
        return;
      }

      prepareMaterials(THREE, model, screenMesh);
      const lidPivot = createLidPivot(THREE, model, lid);

      const sourceBounds = new THREE.Box3().setFromObject(model);
      const sourceSize = sourceBounds.getSize(new THREE.Vector3());
      const modelScale = 5.6 / sourceSize.x;
      model.scale.setScalar(modelScale);

      const scaledBounds = new THREE.Box3().setFromObject(model);
      const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
      model.position.sub(scaledCenter);

      const root = new THREE.Group();
      root.name = 'SillyClientLaptop';
      root.add(model);
      scene.add(root);
      const authoredLidAngle = 0;
      const perpendicular = calibratePerpendicularLid(THREE, root, lidPivot, screenMesh, deckMesh);
      if (lidPivot) lidPivot.rotation.x = authoredLidAngle;

      const displayPlane = computePlanarCorners(THREE, screenMesh);
      if (!displayPlane) {
        reject(new Error('MacBook display plane could not be calibrated'));
        return;
      }
      const screenCenter = displayPlane.corners
        .reduce((center, corner) => center.add(corner), new THREE.Vector3())
        .multiplyScalar(1 / displayPlane.corners.length);
      const expandedScreenCorners = displayPlane.corners.map((corner) => corner.clone()
        .sub(screenCenter)
        .multiplyScalar(1.012)
        .add(screenCenter));

      root.updateMatrixWorld(true);
      resolve({
        root,
        lidPivot,
        screenMesh,
        deckMesh,
        screenCorners: expandedScreenCorners,
        screenAspect: displayPlane.aspect,
        authoredLidAngle,
        perpendicularLidAngle: perpendicular.angle,
        perpendicularError: perpendicular.error
      });
    }, undefined, reject);
  });
}
