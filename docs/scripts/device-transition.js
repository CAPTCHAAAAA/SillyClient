function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function smootherStep(value) {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function shortestAngleDelta(from, to) {
  const fullTurn = Math.PI * 2;
  return ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function interpolatePose(from, to, amount) {
  return {
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
    z: lerp(from.z, to.z, amount),
    scale: lerp(from.scale, to.scale, amount),
    yaw: lerp(from.yaw, to.yaw, amount),
    pitch: lerp(from.pitch, to.pitch, amount),
    roll: lerp(from.roll, to.roll, amount)
  };
}

function lidBlend(state) {
  return state.lidMode === 'perpendicular' ? 1 : 0;
}

function composeDeviceOrbit(phoneStates, laptopStates, fromIndex, toIndex, amount) {
  const fromPhone = phoneStates[fromIndex] || phoneStates[0];
  const toPhone = phoneStates[toIndex] || phoneStates[0];
  const fromLaptop = laptopStates[fromIndex] || laptopStates[0];
  const toLaptop = laptopStates[toIndex] || laptopStates[0];
  const phone = interpolatePose(fromPhone, toPhone, amount);
  const laptop = interpolatePose(fromLaptop, toLaptop, amount);

  const fromCenterX = (fromPhone.x + fromLaptop.x) * 0.5;
  const fromCenterZ = (fromPhone.z + fromLaptop.z) * 0.5;
  const toCenterX = (toPhone.x + toLaptop.x) * 0.5;
  const toCenterZ = (toPhone.z + toLaptop.z) * 0.5;
  const centerX = lerp(fromCenterX, toCenterX, amount);
  const centerZ = lerp(fromCenterZ, toCenterZ, amount);

  const fromDeltaX = fromPhone.x - fromLaptop.x;
  const fromDeltaZ = fromPhone.z - fromLaptop.z;
  const toDeltaX = toPhone.x - toLaptop.x;
  const toDeltaZ = toPhone.z - toLaptop.z;
  const fromRadius = Math.hypot(fromDeltaX, fromDeltaZ);
  const toRadius = Math.hypot(toDeltaX, toDeltaZ);
  const fromAngle = Math.atan2(fromDeltaZ, fromDeltaX);
  const angleDelta = shortestAngleDelta(fromAngle, Math.atan2(toDeltaZ, toDeltaX));
  const orbitAngle = fromAngle + angleDelta * amount;
  const orbitRadius = lerp(fromRadius, toRadius, amount);
  const separationX = Math.cos(orbitAngle) * orbitRadius;
  const separationZ = Math.sin(orbitAngle) * orbitRadius;
  const arc = Math.sin(Math.PI * amount);
  const turnDirection = Math.sign(angleDelta) || 1;

  phone.x = centerX + separationX * 0.5;
  phone.z = centerZ + separationZ * 0.5;
  phone.y += arc * 0.17;
  phone.yaw += turnDirection * arc * 0.72;
  phone.pitch -= arc * 0.045;
  phone.roll += turnDirection * arc * 0.055;

  laptop.x = centerX - separationX * 0.5;
  laptop.z = centerZ - separationZ * 0.5;
  laptop.y -= arc * 0.07;
  laptop.yaw += turnDirection * arc * 0.48;
  laptop.pitch += arc * 0.028;
  laptop.roll -= turnDirection * arc * 0.035;
  laptop.lidBlend = lerp(lidBlend(fromLaptop), lidBlend(toLaptop), amount);

  return { phone, laptop, arc, turnDirection };
}

function composeCameraOrbit(cameraStates, fromIndex, toIndex, amount, arc, turnDirection) {
  const from = cameraStates[fromIndex] || cameraStates[0];
  const to = cameraStates[toIndex] || cameraStates[0];
  const orbitSide = -turnDirection;

  return {
    x: lerp(from.x, to.x, amount) + orbitSide * arc * 2.15,
    y: lerp(from.y, to.y, amount) + arc * 0.28,
    z: lerp(from.z, to.z, amount) - arc * 0.82,
    lookX: lerp(from.lookX, to.lookX, amount) + orbitSide * arc * 0.34,
    lookY: lerp(from.lookY, to.lookY, amount) + arc * 0.08,
    lookZ: lerp(from.lookZ, to.lookZ, amount)
  };
}

export function composeShowcaseTransition({
  phoneStates,
  laptopStates,
  cameraStates,
  fromIndex,
  toIndex,
  progress
}) {
  const amount = smootherStep(progress);
  const deviceOrbit = composeDeviceOrbit(phoneStates, laptopStates, fromIndex, toIndex, amount);

  return {
    phone: deviceOrbit.phone,
    laptop: deviceOrbit.laptop,
    camera: composeCameraOrbit(
      cameraStates,
      fromIndex,
      toIndex,
      amount,
      deviceOrbit.arc,
      deviceOrbit.turnDirection
    )
  };
}
