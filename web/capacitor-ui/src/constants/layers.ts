/**
 * SillyClient 前端统一 Z-Index 语义分层规范
 *
 * 彻底治理分散魔数（55, 56, 58, 60, 61, 62, 70, 72, 73, 74, 99）
 * 规范为语义层级与配套 Backdrop：
 *
 * - HUD (50): 顶部控制栏
 * - DRAWER (56/58): 侧滑/下滑设置面板（背景设置抽屉、APP设置抽屉）
 * - MODAL (62/64/66): 核心业务模态窗（向导、启动控制台、实例管理、终端、版本更新）
 * - DIALOG (70/72/74): 阻断级二次确认对话框（删除确认、垃圾清理确认、目录迁移、密码解锁）
 * - POPOVER (80): 卡片悬浮右键菜单（需置于同级或 Dialog 之上）
 * - GLOBAL_ALERT (1100/1102): 全局置顶虚化问题反馈浮层
 */

export const LAYERS = {
  BASE: 0,
  CONTENT: 10,
  STICKY_HEADER: 20,

  // 1. HUD 悬浮层 (50) — 顶部控制栏
  HUD: 50,

  // 2. 抽屉层 (58)
  DRAWER_BACKDROP: 56,
  DRAWER: 58,

  // 3. 模态窗口层 (64)
  MODAL_BACKDROP: 62,
  MODAL: 64,
  MODAL_SURFACE: 66,

  // 4. 阻断确认对话框 (72)
  DIALOG_BACKDROP: 70,
  DIALOG: 72,
  DIALOG_SURFACE: 74,

  // 5. 悬浮菜单 (80)
  POPOVER_MENU: 80,

  // 6. 全局置顶虚化反馈浮层（高于 Onboarding 1002 与 Dev 调试条 99）
  GLOBAL_ALERT_BACKDROP: 1100,
  GLOBAL_ALERT_SURFACE: 1102,
} as const;

export type LayerLevel = keyof typeof LAYERS;
