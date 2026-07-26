export function loadPhoneDevice({ THREE, loader, scene, heroScene }) {
  return new Promise((resolve, reject) => {
    loader.load('./models/iphone_17_air.glb', gltf => {
      const phoneModel = gltf.scene;
      let bodyMaterial = null;
      let screenMesh = null;
      const logoMeshes = [];

      phoneModel.traverse(child => {
        if (!child.isMesh) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const materialNames = materials.map(material => material?.name || '').join(' ');

        if (/^Cube(?:$|_)/.test(child.name)) {
          child.visible = false;
          return;
        }
        if (/17Air_color1/i.test(materialNames)) bodyMaterial = materials[0] || bodyMaterial;
        if (/logo/i.test(materialNames) || /^Object_8(?:$|_)/.test(child.name)) {
          logoMeshes.push(child);
          return;
        }
        if (/17Air_(color[123]|logo|12)/.test(materialNames)) {
          materials.forEach(material => {
            if (!material) return;
            material.metalness = Math.max(material.metalness ?? 0, 0.94);
            material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.21, 0.16, 0.24);
            material.envMapIntensity = 0.64;
            if (/17Air_color[123]/.test(material.name || '')) material.color.multiplyScalar(0.7);
            material.needsUpdate = true;
          });
        }
        if (materialNames.includes('17Air_Screen')) {
          screenMesh = child;
          child.material = new THREE.MeshStandardMaterial({
            color: 0x010102,
            metalness: 0,
            roughness: 1,
            envMapIntensity: 0.05,
            depthWrite: true,
            side: THREE.DoubleSide
          });
        }
        if (materialNames.includes('17Air_Glass')) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0x9eb4c9,
            transparent: true,
            opacity: 0.07,
            roughness: 0.22,
            metalness: 0.05,
            transmission: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.12,
            depthWrite: false,
            side: THREE.DoubleSide
          });
        }
      });

      logoMeshes.forEach(mesh => {
        if (bodyMaterial) mesh.material = bodyMaterial;
      });

      const box = new THREE.Box3().setFromObject(phoneModel);
      const size = box.getSize(new THREE.Vector3());
      phoneModel.scale.setScalar(3.2 / size.y);
      const normalizedBox = new THREE.Box3().setFromObject(phoneModel);
      phoneModel.position.sub(normalizedBox.getCenter(new THREE.Vector3()));

      const root = new THREE.Group();
      root.add(phoneModel);
      scene.add(root);
      root.updateMatrixWorld(true);

      let screenPlaneZ = 0;
      if (screenMesh) {
        screenMesh.geometry.computeBoundingBox();
        const screenBox = screenMesh.geometry.boundingBox;
        screenPlaneZ = (screenBox.min.z + screenBox.max.z) / 2;
        root.rotation.fromArray(heroScene.phone.rotation);
        root.position.fromArray(heroScene.phone.position);
        root.scale.setScalar(heroScene.phone.scale);
        root.updateMatrixWorld(true);
      }

      resolve({
        root,
        screenMesh,
        screenPlaneZ,
        baseRotationY: Math.PI
      });
    }, undefined, reject);
  });
}
