import React from "react";
import type {
  AppUpdateInfo,
  CompanionPresetSelection,
  ContentOpenMode,
  InstanceConfig,
  GithubRelease,
} from "../capacitor-plugin";

export interface TavernInstance {
  id: string;
  name: string;
  subtitle?: string;
  version?: string;
  status: "running" | "stopped" | "error" | "online" | "offline";
  type: "local" | "remote";
  lastUsed?: string;
  createdAt?: string;
  totalUsage?: string;
  icon: React.ReactNode;
  color: string;
  /** 本地实例监听端口(type=local 时有效),默认 8000 */
  port?: number;
  /** 远程实例地址(type=remote 时有效) */
  url?: string;
  /** 远程实例的 Basic Auth 元数据；密码只保存在平台安全存储中。 */
  basicAuth?: {
    username: string;
  };
  /** 安装目录标识(本地实例,用于多实例隔离) */
  installDir?: string;
  /** Windows 本地实例实际安装目录。 */
  installPath?: string;
  /** GitHub release zipball 下载地址(本地实例首次安装时下载) */
  zipballUrl?: string;
  /** 本地 zip 文件路径(从本地导入) */
  localZipPath?: string;
  /** 自定义封面图片路径(更换插图) */
  cover?: string;
  /** 本地实例运行配置(映射管理面板设置) */
  config?: InstanceConfig;
  /** 创建实例时选用的内置主题预设；宿主通过一次性标记避免后续启动重复覆盖。 */
  companionPreset?: CompanionPresetSelection;
  /** Android 新建实例首次进入酒馆时显示状态栏返回提示；仅在用户实际滑动返回后清除。 */
  pendingTavernGestureHint?: boolean;
}

export type ManageTab = "launch" | "snapshots" | "storage" | "terminal" | "about";

export interface InstanceSnapshot {
  id: string;
  createdAt: string;
  label: string;
  port: number;
  config: InstanceConfig;
}

export type BgMode = "dynamic" | "custom";
export type ThemeStyle = "dark" | "light";
export type OperationPurpose = "launch" | "create";
