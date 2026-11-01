// 陀螺仪 → 相机微视差。
// iOS 13+ 的 DeviceOrientationEvent.requestPermission 只能在用户手势内调用：
// 首次触摸页面时自动请求；Android 直接可用。拒绝 / 无传感器 / 非安全上下文
// 一律静默回退，现有纯触摸交互零改变。
// 输出 -1..1 的倾斜归一值（启用瞬间记零点 = 当前握持姿势为居中），
// 由舞台阻尼后叠加为相机偏移；屏幕旋转时以新姿势重新校零。
export function createGyroMotion({ THREE, maxTiltDeg = 14, invalidate = () => {} } = {}) {
  const state = {
    phase: 'idle', // idle → requesting → active / off
    zero: { beta: 0, gamma: 0 },
    tx: 0,
    ty: 0
  };
  let zeroed = false;

  function handle(event) {
    if (event.beta == null || event.gamma == null) return;
    if (!zeroed) {
      state.zero.beta = event.beta;
      state.zero.gamma = event.gamma;
      zeroed = true;
      state.phase = 'active';
      document.documentElement.dataset.gyroState = 'active';
    }
    state.tx = THREE.MathUtils.clamp((event.beta - state.zero.beta) / maxTiltDeg, -1, 1);
    state.ty = THREE.MathUtils.clamp((event.gamma - state.zero.gamma) / maxTiltDeg, -1, 1);
    // 真机诊断口：dataset 可在控制台/调试器直接读
    document.documentElement.dataset.gyroTilt = `${state.tx.toFixed(3)},${state.ty.toFixed(3)}`;
    invalidate(300);
  }

  function rezero() {
    zeroed = false;
  }

  async function attach() {
    if (state.phase !== 'idle') return state.phase === 'active';
    if (typeof DeviceOrientationEvent === 'undefined') {
      state.phase = 'off';
      document.documentElement.dataset.gyroState = 'unsupported';
      return false;
    }
    state.phase = 'requesting';
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          state.phase = 'off';
          document.documentElement.dataset.gyroState = 'denied';
          return false;
        }
      }
      addEventListener('deviceorientation', handle, true);
      window.addEventListener('orientationchange', rezero, { passive: true });
      document.documentElement.dataset.gyroState = 'listening';
      return true;
    } catch {
      state.phase = 'off';
      document.documentElement.dataset.gyroState = 'off';
      return false;
    }
  }

  function bindGesture() {
    // iOS 要求 requestPermission 在用户手势回调内同步发起，pointerdown 满足
    const request = () => {
      document.removeEventListener('pointerdown', request);
      attach();
    };
    document.addEventListener('pointerdown', request, { once: true, passive: true });
  }

  return { attach, bindGesture, state };
}
