export function createInputMotion({ THREE, section, appScreen, isStageVisible }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const compactInput = matchMedia('(max-aspect-ratio: 999 / 1000) and (pointer: coarse)');
  const deviceOrientationType = window.DeviceOrientationEvent;
  const orientationMotion = {
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    baselineBeta: 0,
    baselineGamma: 0,
    hasBaseline: false,
    active: false,
    listening: false,
    permissionSettled: false,
    permissionPending: false,
    lastSample: 0
  };

  function normalizeAngleDelta(value) {
    return ((value + 180) % 360 + 360) % 360 - 180;
  }

  function resetOrientationBaseline() {
    orientationMotion.hasBaseline = false;
    orientationMotion.active = false;
    orientationMotion.tx = 0;
    orientationMotion.ty = 0;
  }

  function updateOrientationMotion(event) {
    if (!compactInput.matches || reduced || !isStageVisible()) return;
    if (event.beta == null || event.gamma == null) return;
    const beta = Number(event.beta);
    const gamma = Number(event.gamma);
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;

    if (!orientationMotion.hasBaseline) {
      orientationMotion.baselineBeta = beta;
      orientationMotion.baselineGamma = gamma;
      orientationMotion.hasBaseline = true;
      orientationMotion.lastSample = performance.now();
      return;
    }

    const betaDelta = normalizeAngleDelta(beta - orientationMotion.baselineBeta);
    const gammaDelta = normalizeAngleDelta(gamma - orientationMotion.baselineGamma);
    const screenAngle = Number(screen.orientation?.angle ?? window.orientation ?? 0);
    let yaw = gammaDelta;
    let pitch = betaDelta;

    if (screenAngle === 90 || screenAngle === -270) {
      yaw = betaDelta;
      pitch = -gammaDelta;
    } else if (screenAngle === -90 || screenAngle === 270) {
      yaw = -betaDelta;
      pitch = gammaDelta;
    } else if (Math.abs(screenAngle) === 180) {
      yaw = -gammaDelta;
      pitch = -betaDelta;
    }

    orientationMotion.tx = THREE.MathUtils.clamp(yaw / 28, -1, 1);
    orientationMotion.ty = THREE.MathUtils.clamp(pitch / 24, -1, 1);
    orientationMotion.active = true;
    orientationMotion.lastSample = performance.now();
  }

  function attachDeviceOrientation() {
    if (!deviceOrientationType || orientationMotion.listening || reduced) return;
    window.addEventListener('deviceorientation', updateOrientationMotion, { passive: true });
    orientationMotion.listening = true;
  }

  async function requestDeviceOrientationAccess() {
    if (
      !compactInput.matches
      || reduced
      || !deviceOrientationType
      || orientationMotion.permissionSettled
      || orientationMotion.permissionPending
    ) return;

    const requestPermission = deviceOrientationType.requestPermission;
    if (typeof requestPermission !== 'function') {
      orientationMotion.permissionSettled = true;
      attachDeviceOrientation();
      return;
    }

    orientationMotion.permissionPending = true;
    try {
      const permission = await requestPermission.call(deviceOrientationType);
      orientationMotion.permissionSettled = true;
      if (permission === 'granted') attachDeviceOrientation();
    } catch {
      orientationMotion.permissionSettled = true;
    } finally {
      orientationMotion.permissionPending = false;
    }
  }

  function setPointerFromViewport(clientX, clientY) {
    if (!finePointer.matches || !isStageVisible()) return;
    const rect = section.getBoundingClientRect();
    pointer.tx = THREE.MathUtils.clamp(((clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
    pointer.ty = THREE.MathUtils.clamp(((clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
  }

  if (finePointer.matches) {
    window.addEventListener('pointermove', event => {
      setPointerFromViewport(event.clientX, event.clientY);
    }, { passive: true });
  }

  if (compactInput.matches && deviceOrientationType) {
    if (typeof deviceOrientationType.requestPermission === 'function') {
      section.addEventListener('click', requestDeviceOrientationAccess, { passive: true });
    } else {
      orientationMotion.permissionSettled = true;
      attachDeviceOrientation();
    }
  }

  const orientationTarget = screen.orientation || window;
  orientationTarget.addEventListener('change', resetOrientationBaseline, { passive: true });
  window.addEventListener('orientationchange', resetOrientationBaseline, { passive: true });
  compactInput.addEventListener('change', event => {
    resetOrientationBaseline();
    if (event.matches && deviceOrientationType && typeof deviceOrientationType.requestPermission !== 'function') {
      orientationMotion.permissionSettled = true;
      attachDeviceOrientation();
    }
  });

  let trackedFrameWindow = null;
  function attachIframePointerTracking() {
    try {
      const frameWindow = appScreen.contentWindow;
      if (!frameWindow || frameWindow === trackedFrameWindow) return;
      if (finePointer.matches) {
        frameWindow.addEventListener('pointermove', event => {
          if (!isStageVisible()) return;
          const frameWidth = appScreen.clientWidth || 390;
          const frameHeight = appScreen.clientHeight || 844;
          pointer.tx = THREE.MathUtils.clamp((event.clientX / frameWidth - 0.5) * 2, -1, 1);
          pointer.ty = THREE.MathUtils.clamp((event.clientY / frameHeight - 0.5) * 2, -1, 1);
        }, { passive: true });
      }
      if (compactInput.matches && typeof deviceOrientationType?.requestPermission === 'function') {
        frameWindow.addEventListener('click', requestDeviceOrientationAccess, { passive: true });
      }
      trackedFrameWindow = frameWindow;
    } catch {
      // Cross-origin screens remain visible; only pointer tracking inside the iframe is unavailable.
    }
  }

  appScreen.addEventListener('load', attachIframePointerTracking);
  if (appScreen.contentDocument?.readyState !== 'loading') attachIframePointerTracking();

  return {
    compactInput,
    orientationMotion,
    pointer,
    reduced,
    resetOrientation: resetOrientationBaseline,
    reset() {
      pointer.x = 0;
      pointer.y = 0;
      pointer.tx = 0;
      pointer.ty = 0;
      orientationMotion.x = 0;
      orientationMotion.y = 0;
      orientationMotion.tx = 0;
      orientationMotion.ty = 0;
      orientationMotion.active = false;
    }
  };
}
