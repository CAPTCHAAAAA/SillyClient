// 设备舞台按需渲染调度器。
// 策略：任何会改变画面的输入先 wake() 打开脏窗口并唤醒循环；每帧渲染结束后，
// 若脏窗口已关且姿态快照收敛即停止 rAF。输出帧序列与连续渲染完全一致，
// 仅去掉静止画面的 GPU 空转。调度机制在此，"哪些值代表画面"的策略归装配文件。
const STAGE_SETTLE_EPSILON = 0.005;

export function createRenderScheduler({ renderFrame, isSchedulingEnabled }) {
  let scheduled = false;
  let pendingRaf = 0;
  let dirtyUntil = 0;
  let settleValid = false;
  let settleState = [];

  function schedule() {
    if (scheduled || !isSchedulingEnabled()) return;
    scheduled = true;
    pendingRaf = requestAnimationFrame((now) => {
      scheduled = false;
      renderFrame(now);
    });
  }

  return {
    /** 输入事件入口：打开脏窗口并确保循环在跑 */
    wake(windowMs = 250) {
      dirtyUntil = Math.max(dirtyUntil, performance.now() + windowMs);
      settleValid = false;
      schedule();
    },
    /** 循环帧被消费时由 renderFrame 开头调用 */
    consumeSchedule() {
      scheduled = false;
    },
    /** 未到最低帧间隔的空转帧：原样续排，不重绘 */
    reschedule() {
      schedule();
    },
    isDirty(now = performance.now()) {
      return now < dirtyUntil;
    },
    /** 传入本帧全部决定画面的数值；与上帧快照逐项比对，未超阈值即收敛 */
    settled(next) {
      if (!next || next.length === 0) return false;
      if (!settleValid) {
        settleState = next.slice();
        settleValid = true;
        return false;
      }
      let moved = false;
      for (let i = 0; i < next.length; i++) {
        if (Math.abs(next[i] - settleState[i]) > STAGE_SETTLE_EPSILON) {
          moved = true;
          break;
        }
      }
      settleState = next.slice();
      return !moved;
    },
    /** 产品帧导出等场景需要独占循环时停掉调度帧 */
    stop() {
      if (pendingRaf) cancelAnimationFrame(pendingRaf);
      pendingRaf = 0;
      scheduled = false;
    }
  };
}
