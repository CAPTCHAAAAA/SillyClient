/**
 * SillyClient 前端统一 Z-Index 语义分层规范
 * 
 * 彻底治理分散魔数（55, 56, 58, 60, 61, 62, 70, 72, 73, 74, 99）
 * 规范为 4 级语义层级与配套 Backdrop：
 * 
 * - HUD (40): 顶部状态条、右下角调试板、后台活动胶囊 (Activity Capsule)
 * - DRAWER (50): 侧滑/下滑设置面板（背景设置抽屉、APP设置抽屉）
 * - MODAL (60): 核心业务模态窗（向导、启动控制台、实例管理、终端、版本更新）
 * - DIALOG (70): 阻断级二次确认对话框（删除确认、垃圾清理确认）
 * - POPOVER (75): 卡片悬浮右键菜单（需置于同级或 Dialog 之上）
 */

export const LAYERS = {
  BASE: 0,
  CONTENT: 10,
  STICKY_HEADER: 20,
  
  // 1. HUD 悬浮层 (50) — 顶部控制栏及活动胶囊
  HUD: 50,
  ACTIVITY_CAPSULE: 52,

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
} as const;

export type LayerLevel = keyof typeof LAYERS;
