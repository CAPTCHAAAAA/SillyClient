import React, { useState } from "react";
import {
  X,
  Search,
  SlidersHorizontal,
  History,
  HardDrive,
  Terminal,
  Info,
  Eraser,
  Play,
  MoreHorizontal,
} from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import type { InstanceConfig } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { ToggleSwitch } from "../common/ToggleSwitch";
import type { TavernInstance, InstanceSnapshot, ManageTab } from "../../types";

export interface ManageInstanceModalProps {
  instance: TavernInstance | null;
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  isWindows: boolean;
  allInstances: TavernInstance[];
  onSelectInstance: (instance: TavernInstance) => void;
  onOpenNewInstanceWizard: () => void;
  onLaunchInstance: (instance: TavernInstance) => void;
  launchingId: string | null;
  onTriggerRename: (instance: TavernInstance) => void;
  onTriggerDelete: (instance: TavernInstance) => void;
  onPickCover: (instance: TavernInstance) => void;
  // 快照管理
  snapshots: Record<string, InstanceSnapshot[]>;
  onCreateSnapshot: () => void;
  onRestoreSnapshot: (snapshot: InstanceSnapshot) => void;
  onDeleteSnapshot: (instanceId: string, snapshotId: string) => void;
  // 实例关于信息
  aboutInfo?: { path?: string; version?: string; status?: string; createdAt?: string; sizeBytes?: number } | null;
  // 保存与草稿状态
  draftConfig: InstanceConfig;
  setDraftConfig: React.Dispatch<React.SetStateAction<InstanceConfig>>;
  draftPort: number;
  setDraftPort: (p: number) => void;
  draftRemoteAuthEnabled: boolean;
  setDraftRemoteAuthEnabled: (v: boolean) => void;
  draftRemoteAuthUsername: string;
  setDraftRemoteAuthUsername: (v: string) => void;
  draftRemoteAuthPassword: string;
  setDraftRemoteAuthPassword: (v: string) => void;
  isSavingManagePanel: boolean;
  manageSaveError: string | null;
  onSaveManagedInstance: () => Promise<void>;
  // 终端日志
  terminalLogs: { msg: string; level?: string }[];
  setTerminalLogs: React.Dispatch<React.SetStateAction<{ msg: string; level?: string }[]>>;
  terminalDisplayPrompt: string;
  terminalPlaceholder: string;
}

function ManageItem({
  label,
  desc,
  isLight,
  children,
}: {
  label: string;
  desc?: string;
  isLight: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3 border-b last:border-b-0",
        isLight ? "border-black/[0.04]" : "border-white/[0.04]"
      )}
    >
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-xs font-medium mb-0.5",
            isLight ? "text-[#1a1625]/70" : "text-white/70"
          )}
        >
          {label}
        </div>
        <div
          className={cn(
            "text-[10px] leading-snug",
            isLight ? "text-[#1a1625]/30" : "text-white/30"
          )}
        >
          {desc}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ManageDetailRow({
  label,
  value,
  isLight,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  isLight: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <span
        className={cn(
          "text-xs font-medium",
          isLight ? "text-[#1a1625]/70" : "text-white/70"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-right text-xs break-all",
          mono && "font-mono",
          isLight ? "text-[#1a1625]/85" : "text-white/85"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function getStatusText(status: TavernInstance["status"]) {
  switch (status) {
    case "running":
      return "运行中";
    case "online":
      return "在线";
    case "offline":
      return "离线";
    case "error":
      return "异常";
    default:
      return "已停止";
  }
}

/**
 * 实例管理高级控制面板 (ManageInstanceModal)
 * 涵盖：启动参数配置、配置快照、存储信息与插图更换、实时终端、关于版本详情。
 */
export const ManageInstanceModal: React.FC<ManageInstanceModalProps> = ({
  instance,
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  allInstances,
  onSelectInstance,
  onOpenNewInstanceWizard,
  onLaunchInstance,
  launchingId,
  onTriggerRename,
  onTriggerDelete,
  onPickCover,
  snapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  aboutInfo,
  draftConfig,
  setDraftConfig,
  draftPort,
  setDraftPort,
  draftRemoteAuthEnabled,
  setDraftRemoteAuthEnabled,
  draftRemoteAuthUsername,
  setDraftRemoteAuthUsername,
  draftRemoteAuthPassword,
  setDraftRemoteAuthPassword,
  isSavingManagePanel,
  manageSaveError,
  onSaveManagedInstance,
  terminalLogs,
  setTerminalLogs,
  terminalDisplayPrompt,
  terminalPlaceholder,
}) => {
  const [manageTab, setManageTab] = useState<ManageTab>("launch");
  const [manageSearchQuery, setManageSearchQuery] = useState("");
  const [manageFilter, setManageFilter] = useState<"all" | "local" | "remote">("all");
  const [manageMoreOpen, setManageMoreOpen] = useState(false);
  const [terminalInput, setTerminalInput] = useState("");

  if (!instance || (!isOpen && !isClosing)) return null;

  const mp = instance;

  const filteredManageInstances = allInstances.filter((inst) => {
    if (manageFilter === "local" && inst.type !== "local") return false;
    if (manageFilter === "remote" && inst.type !== "remote") return false;
    if (!manageSearchQuery.trim()) return true;
    const query = manageSearchQuery.trim().toLowerCase();
    return (
      inst.name.toLowerCase().includes(query) ||
      (inst.subtitle || "").toLowerCase().includes(query) ||
      (inst.url || "").toLowerCase().includes(query)
    );
  });

  return (
    <div
      className={cn(
        "ios-task-surface manage-panel-surface fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[28px] saturate-180",
        glassBg,
        isLight && "is-light",
        isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
      )}
      style={{
        zIndex: LAYERS.MODAL_SURFACE,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(900px, calc(100vw - 2rem))",
        height: "min(680px, calc(100vh - 2rem))",
        maxHeight: "calc(100vh - 2rem)",
      }}
    >
      {/* 头部 */}
      <div
        className={cn(
          "flex items-center justify-between px-5 h-12 flex-shrink-0 border-b",
          isLight ? "border-black/[0.06]" : "border-white/[0.06]"
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-semibold",
              isLight ? "text-[#1a1625]" : "text-white"
            )}
          >
            {mp.subtitle || mp.name}
          </span>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-md",
              isLight
                ? "bg-black/[0.05] text-[#1a1625]/35"
                : "bg-white/[0.06] text-white/35"
            )}
          >
            {mp.version || "—"}
          </span>
        </div>
        <button
          onClick={onClose}
          className={cn(
            "motion-control p-1.5 rounded-lg",
            isLight
              ? "hover:bg-black/5 text-[#1a1625]/30 hover:text-[#1a1625]/60"
              : "hover:bg-white/5 text-white/30 hover:text-white/60"
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 搜索与筛选 */}
      <div
        className={cn(
          "flex-shrink-0 border-b px-5 pt-4 pb-3",
          isLight ? "border-black/[0.06]" : "border-white/[0.06]"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 h-10 rounded-xl px-3",
            isLight ? "bg-black/[0.03]" : "bg-white/[0.035]"
          )}
        >
          <Search
            className={cn(
              "h-4 w-4 flex-shrink-0",
              isLight ? "text-[#1a1625]/35" : "text-white/35"
            )}
          />
          <input
            type="search"
            value={manageSearchQuery}
            onChange={(e) => setManageSearchQuery(e.target.value)}
            placeholder="搜索并切换实例"
            className={cn(
              "min-w-0 flex-1 bg-transparent text-xs outline-none",
              isLight
                ? "text-[#1a1625] placeholder:text-[#1a1625]/30"
                : "text-white placeholder:text-white/30"
            )}
          />
          {manageSearchQuery && (
            <button
              type="button"
              onClick={() => setManageSearchQuery("")}
              className={cn(
                "p-1",
                isLight ? "text-[#1a1625]/30" : "text-white/30"
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {(
            [
              { id: "all", label: "全部" },
              { id: "local", label: "本地" },
              { id: "remote", label: "云端" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setManageFilter(filter.id)}
              aria-pressed={manageFilter === filter.id}
              className={cn(
                "ios-choice-control motion-control rounded-full px-3 py-1 text-[11px] font-medium",
                manageFilter === filter.id
                  ? isLight
                    ? "bg-[#1a1625]/10 text-[#1a1625]"
                    : "bg-white/10 text-white"
                  : isLight
                  ? "text-[#1a1625]/40 hover:text-[#1a1625]/65"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* 左侧实例快速切换列表 */}
        <aside
          className={cn(
            "flex max-h-36 flex-shrink-0 flex-col border-b sm:max-h-none sm:w-52 sm:border-b-0 sm:border-r",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}
        >
          <div
            className={cn(
              "px-4 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em]",
              isLight ? "text-[#1a1625]/30" : "text-white/30"
            )}
          >
            实例列表
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 scrollbar-subtle">
            {filteredManageInstances.map((item) => {
              const selected = item.id === mp.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onSelectInstance(item);
                    setManageMoreOpen(false);
                  }}
                  className={cn(
                    "motion-control mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left",
                    selected
                      ? isLight
                        ? "bg-black/[0.07]"
                        : "bg-white/[0.08]"
                      : isLight
                      ? "hover:bg-black/[0.035]"
                      : "hover:bg-white/[0.04]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center",
                      selected
                        ? isLight
                          ? "text-[#1a1625]/75"
                          : "text-white/80"
                        : isLight
                        ? "text-[#1a1625]/35"
                        : "text-white/35"
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-xs font-medium",
                        selected
                          ? isLight
                            ? "text-[#1a1625]/85"
                            : "text-white/85"
                          : isLight
                          ? "text-[#1a1625]/55"
                          : "text-white/55"
                      )}
                    >
                      {item.subtitle || item.name}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[10px]",
                        isLight ? "text-[#1a1625]/28" : "text-white/28"
                      )}
                    >
                      {item.type === "local"
                        ? "本地实例"
                        : item.url || "远程实例"}
                    </span>
                  </span>
                </button>
              );
            })}
            {filteredManageInstances.length === 0 && (
              <div
                className={cn(
                  "px-3 py-6 text-center text-[11px]",
                  isLight ? "text-[#1a1625]/30" : "text-white/30"
                )}
              >
                没有匹配的实例
              </div>
            )}
          </div>
        </aside>

        {/* 右侧主 Tab 区域 */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b px-4 py-2 scrollbar-subtle",
              isLight ? "border-black/[0.06]" : "border-white/[0.06]"
            )}
          >
            {(
              [
                {
                  id: "launch",
                  label: "启动参数",
                  icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
                },
                {
                  id: "snapshots",
                  label: "快照",
                  icon: <History className="h-3.5 w-3.5" />,
                },
                {
                  id: "storage",
                  label: "存储",
                  icon: <HardDrive className="h-3.5 w-3.5" />,
                },
                {
                  id: "terminal",
                  label: "终端",
                  icon: <Terminal className="h-3.5 w-3.5" />,
                },
                {
                  id: "about",
                  label: "关于",
                  icon: <Info className="h-3.5 w-3.5" />,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={manageTab === tab.id}
                onClick={() => {
                  setManageTab(tab.id);
                  setManageMoreOpen(false);
                }}
                className={cn(
                  "ios-choice-control motion-control flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium",
                  manageTab === tab.id
                    ? isLight
                      ? "bg-black/[0.07] text-[#1a1625]/80"
                      : "bg-white/[0.08] text-white/80"
                    : isLight
                    ? "text-[#1a1625]/35 hover:text-[#1a1625]/60"
                    : "text-white/35 hover:text-white/60"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 内容区 */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-subtle">
            <div
              key={`${mp.id}-${manageTab}`}
              className="motion-tab-content space-y-4"
            >
              {manageTab === "launch" && (
                <>
                  {mp.type === "local" ? (
                    <>
                      <ManageItem
                        label="启动端口"
                        desc="宿主 WebView 和本地服务都会使用这个端口"
                        isLight={isLight}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={draftPort}
                          onChange={(e) => {
                            setDraftPort(parseInt(e.target.value) || 8000);
                          }}
                          className={cn(
                            "w-20 h-7 px-2 rounded-lg text-xs text-center border focus:outline-none focus:ring-0 transition-colors",
                            isLight
                              ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625]"
                              : "bg-white/[0.04] border-white/[0.08] text-white"
                          )}
                        />
                      </ManageItem>
                      <ManageItem
                        label="允许外部监听"
                        desc="移动宿主默认建议关闭，只在明确需要局域网访问时开启"
                        isLight={isLight}
                      >
                        <ToggleSwitch
                          on={draftConfig.listen}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, listen: v }))
                          }
                          isLight={isLight}
                        />
                      </ManageItem>
                      <ManageItem
                        label="启用 IPv4"
                        desc="至少要保留一个网络协议可用"
                        isLight={isLight}
                      >
                        <ToggleSwitch
                          on={draftConfig.ipv4}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, ipv4: v }))
                          }
                          isLight={isLight}
                        />
                      </ManageItem>
                      <ManageItem
                        label="启用 IPv6"
                        desc="如果网络环境稳定支持 IPv6，可以开启"
                        isLight={isLight}
                      >
                        <ToggleSwitch
                          on={draftConfig.ipv6}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, ipv6: v }))
                          }
                          isLight={isLight}
                        />
                      </ManageItem>
                      <ManageItem
                        label="优先使用 IPv6 DNS"
                        desc="在 IPv6 网络质量足够好时再开启"
                        isLight={isLight}
                      >
                        <ToggleSwitch
                          on={draftConfig.dnsIpv6}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, dnsIpv6: v }))
                          }
                          isLight={isLight}
                        />
                      </ManageItem>
                      <ManageItem
                        label="心跳写入间隔"
                        desc="单位秒，填 0 关闭心跳文件"
                        isLight={isLight}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={draftConfig.heartbeat}
                          onChange={(e) => {
                            const heartbeat = parseInt(e.target.value) || 0;
                            setDraftConfig((prev) => ({ ...prev, heartbeat }));
                          }}
                          className={cn(
                            "w-20 h-7 px-2 rounded-lg text-xs text-center border focus:outline-none focus:ring-0 transition-colors",
                            isLight
                              ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625]"
                              : "bg-white/[0.04] border-white/[0.08] text-white"
                          )}
                        />
                      </ManageItem>
                      <ManageItem
                        label="启用 HTTP Keep-Alive"
                        desc="网络波动大时可临时关闭"
                        isLight={isLight}
                      >
                        <ToggleSwitch
                          on={draftConfig.keepAlive}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, keepAlive: v }))
                          }
                          isLight={isLight}
                        />
                      </ManageItem>
                    </>
                  ) : (
                    <div>
                      <ManageItem
                        label="Basic Auth"
                        desc="为受 HTTP 基本认证保护的远程地址提供凭据"
                        isLight={isLight}
                      >
                        <ToggleSwitch
                          on={draftRemoteAuthEnabled}
                          onChange={setDraftRemoteAuthEnabled}
                          isLight={isLight}
                        />
                      </ManageItem>
                      <div
                        className={cn(
                          "motion-accordion",
                          draftRemoteAuthEnabled && "is-open"
                        )}
                        aria-hidden={!draftRemoteAuthEnabled}
                      >
                        <div className="motion-accordion-inner">
                          <div className="pt-3 space-y-2">
                            <input
                              type="text"
                              disabled={!draftRemoteAuthEnabled}
                              value={draftRemoteAuthUsername}
                              onChange={(e) =>
                                setDraftRemoteAuthUsername(e.target.value)
                              }
                              placeholder="用户名"
                              autoCapitalize="none"
                              autoCorrect="off"
                              autoComplete="username"
                              className={cn(
                                "w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                                isLight
                                  ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                                  : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                              )}
                            />
                            <input
                              type="password"
                              disabled={!draftRemoteAuthEnabled}
                              value={draftRemoteAuthPassword}
                              onChange={(e) =>
                                setDraftRemoteAuthPassword(e.target.value)
                              }
                              placeholder={
                                mp.basicAuth ? "留空则保留现有密码" : "密码"
                              }
                              autoComplete="current-password"
                              className={cn(
                                "w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                                isLight
                                  ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                                  : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                              )}
                            />
                            <p
                              className={cn(
                                "text-[10px] leading-relaxed",
                                isLight ? "text-[#1a1625]/35" : "text-white/35"
                              )}
                            >
                              密码由系统安全存储保管。保存时会立即验证当前连接。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {manageTab === "snapshots" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div
                        className={cn(
                          "text-sm font-semibold",
                          isLight ? "text-[#1a1625]/80" : "text-white/80"
                        )}
                      >
                        配置快照
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-[10px]",
                          isLight ? "text-[#1a1625]/35" : "text-white/35"
                        )}
                      >
                        保存并恢复当前实例的启动参数。
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={mp.type !== "local"}
                      onClick={onCreateSnapshot}
                      className={cn(
                        "motion-control h-8 rounded-xl px-3 text-[11px] font-medium disabled:pointer-events-none disabled:opacity-35",
                        isLight
                          ? "bg-black/[0.06] text-[#1a1625]/65 hover:bg-black/[0.09]"
                          : "bg-white/[0.07] text-white/65 hover:bg-white/[0.11]"
                      )}
                    >
                      创建快照
                    </button>
                  </div>
                  {mp.type !== "local" ? (
                    <div
                      className={cn(
                        "rounded-xl px-4 py-8 text-center text-xs",
                        isLight
                          ? "bg-black/[0.025] text-[#1a1625]/35"
                          : "bg-white/[0.025] text-white/35"
                      )}
                    >
                      远程实例不保存本地启动参数快照
                    </div>
                  ) : (snapshots[mp.id] || []).length === 0 ? (
                    <div
                      className={cn(
                        "rounded-xl px-4 py-8 text-center text-xs",
                        isLight
                          ? "bg-black/[0.025] text-[#1a1625]/35"
                          : "bg-white/[0.025] text-white/35"
                      )}
                    >
                      暂无快照
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(snapshots[mp.id] || []).map((snapshot) => (
                        <div
                          key={snapshot.id}
                          className={cn(
                            "flex items-center justify-between gap-4 rounded-xl px-4 py-3",
                            isLight ? "bg-black/[0.035]" : "bg-white/[0.035]"
                          )}
                        >
                          <div className="min-w-0">
                            <div
                              className={cn(
                                "truncate text-xs font-medium",
                                isLight
                                  ? "text-[#1a1625]/70"
                                  : "text-white/70"
                              )}
                            >
                              {snapshot.label}
                            </div>
                            <div
                              className={cn(
                                "mt-1 text-[10px] tabular-nums",
                                isLight
                                  ? "text-[#1a1625]/30"
                                  : "text-white/30"
                              )}
                            >
                              {new Date(snapshot.createdAt).toLocaleString(
                                "zh-CN"
                              )}{" "}
                              · 端口 {snapshot.port}
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onRestoreSnapshot(snapshot);
                                setManageTab("launch");
                              }}
                              className={cn(
                                "motion-control rounded-lg px-2.5 py-1.5 text-[10px] font-medium",
                                isLight
                                  ? "text-[#1a1625]/55 hover:text-[#1a1625]/80"
                                  : "text-white/55 hover:text-white/80"
                              )}
                            >
                              恢复
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onDeleteSnapshot(mp.id, snapshot.id)
                              }
                              className={cn(
                                "motion-control rounded-lg px-2.5 py-1.5 text-[10px] font-medium",
                                isLight
                                  ? "text-red-900/45 hover:text-red-900/75"
                                  : "text-red-300/45 hover:text-red-200/75"
                              )}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {manageTab === "storage" && (
                <div className="space-y-4">
                  <div
                    className={cn(
                      "rounded-xl px-4",
                      isLight ? "bg-black/[0.025]" : "bg-white/[0.025]"
                    )}
                  >
                    <ManageDetailRow
                      label={mp.type === "local" ? "实例位置" : "连接地址"}
                      value={
                        mp.type === "local"
                          ? aboutInfo?.path || mp.installDir || "—"
                          : mp.url || "—"
                      }
                      isLight={isLight}
                      mono
                    />
                    <ManageDetailRow
                      label="占用空间"
                      value={
                        mp.type === "local" &&
                        aboutInfo?.sizeBytes !== undefined
                          ? `${(aboutInfo.sizeBytes / 1024 / 1024).toFixed(
                              1
                            )} MB`
                          : "—"
                      }
                      isLight={isLight}
                    />
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-xl px-4 py-3",
                      isLight ? "bg-black/[0.025]" : "bg-white/[0.025]"
                    )}
                  >
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "text-xs font-medium",
                          isLight ? "text-[#1a1625]/70" : "text-white/70"
                        )}
                      >
                        实例插图
                      </div>
                      <div
                        className={cn(
                          "mt-1 truncate text-[10px]",
                          isLight ? "text-[#1a1625]/30" : "text-white/30"
                        )}
                      >
                        {mp.cover ? "已使用自定义插图" : "使用默认插图"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPickCover(mp)}
                      className={cn(
                        "motion-control h-8 rounded-xl px-3 text-[11px] font-medium",
                        isLight
                          ? "bg-black/[0.06] text-[#1a1625]/60 hover:bg-black/[0.09]"
                          : "bg-white/[0.07] text-white/60 hover:bg-white/[0.11]"
                      )}
                    >
                      更换插图
                    </button>
                  </div>
                </div>
              )}

              {manageTab === "terminal" &&
                (mp.type === "remote" ? (
                  <div
                    className={cn(
                      "rounded-xl px-4 py-8 text-center text-xs",
                      isLight
                        ? "bg-black/[0.025] text-[#1a1625]/35"
                        : "bg-white/[0.025] text-white/35"
                    )}
                  >
                    远程实例不支持本地终端
                  </div>
                ) : (
                  <div className="flex h-full min-h-[260px] flex-col overflow-hidden rounded-xl bg-[#101016]/95 text-[#d7d5df] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)]">
                    <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-white/[0.055] px-4">
                      <span className="text-[10px] font-medium text-white/40">
                        {mp.subtitle || mp.name} · 实例终端
                      </span>
                      <button
                        type="button"
                        onClick={() => setTerminalLogs([])}
                        className="motion-control p-1.5 text-white/30 hover:text-white/55"
                        title="清空终端"
                      >
                        <Eraser className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 font-sans text-[11.5px] leading-relaxed scrollbar-subtle">
                      {terminalLogs.map((log, index) => (
                        <div
                          key={index}
                          className={cn(
                            "mb-0.5 whitespace-pre-wrap break-all",
                            log.level === "error"
                              ? "text-red-300/85"
                              : log.level === "success"
                              ? "text-white/85"
                              : "text-white/60"
                          )}
                        >
                          {log.msg}
                        </div>
                      ))}
                      <div className="mt-1 flex gap-2">
                        <span className="select-none text-white/35">
                          {terminalDisplayPrompt}
                        </span>
                        <input
                          type="text"
                          value={terminalInput}
                          onChange={(event) =>
                            setTerminalInput(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key !== "Enter" ||
                              !terminalInput.trim()
                            )
                              return;
                            const command = terminalInput.trim();
                            const instanceId = mp.installDir || mp.id;
                            setTerminalLogs((previous) => [
                              ...previous,
                              {
                                msg: `${terminalDisplayPrompt} ${command}`,
                                level: "info",
                              },
                            ]);
                            TarvenEnv.sendCommand({
                              text: command,
                              instanceId,
                            }).catch(() => {});
                            setTerminalInput("");
                          }}
                          className="min-w-0 flex-1 border-none bg-transparent text-white/75 outline-none placeholder:text-white/20"
                          placeholder={terminalPlaceholder}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  </div>
                ))}

              {manageTab === "about" && (
                <div
                  className={cn(
                    "rounded-xl px-4",
                    isLight ? "bg-black/[0.025]" : "bg-white/[0.025]"
                  )}
                >
                  <ManageDetailRow
                    label="实例名称"
                    value={mp.subtitle || mp.name}
                    isLight={isLight}
                  />
                  <ManageDetailRow
                    label="版本"
                    value={
                      mp.type === "local" &&
                      aboutInfo?.version &&
                      aboutInfo.version !== "unknown"
                        ? `v${aboutInfo.version}`
                        : mp.version || "—"
                    }
                    isLight={isLight}
                  />
                  <ManageDetailRow
                    label="类型"
                    value={mp.type === "local" ? "本地实例" : "远程实例"}
                    isLight={isLight}
                  />
                  <ManageDetailRow
                    label="状态"
                    value={
                      mp.type === "local"
                        ? aboutInfo?.status || getStatusText(mp.status)
                        : getStatusText(mp.status)
                    }
                    isLight={isLight}
                  />
                  <ManageDetailRow
                    label="创建时间"
                    value={
                      mp.type === "local" && aboutInfo?.createdAt
                        ? aboutInfo.createdAt
                        : mp.createdAt || "—"
                    }
                    isLight={isLight}
                  />
                  {mp.type === "remote" && (
                    <ManageDetailRow
                      label="Basic Auth"
                      value={mp.basicAuth?.username || "未配置"}
                      isLight={isLight}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* 底部按钮栏 */}
      <div
        className={cn(
          "relative flex flex-shrink-0 items-center gap-2 border-t px-4 py-3",
          isLight ? "border-black/[0.06]" : "border-white/[0.06]"
        )}
      >
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenNewInstanceWizard();
          }}
          className={cn(
            "motion-control h-8 rounded-xl px-3 text-[11px] font-medium",
            isLight
              ? "bg-black/[0.05] text-[#1a1625]/50 hover:bg-black/[0.08]"
              : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10]"
          )}
        >
          新建实例
        </button>
        {manageSaveError && (
          <span
            className={cn(
              "ml-auto max-w-[38%] text-[10px] leading-snug",
              isLight ? "text-red-900/65" : "text-red-300/75"
            )}
          >
            {manageSaveError}
          </span>
        )}
        <div
          className={cn("flex items-center gap-2", !manageSaveError && "ml-auto")}
        >
          {manageTab === "launch" && (
            <button
              disabled={isSavingManagePanel}
              onClick={onSaveManagedInstance}
              className={cn(
                "motion-control h-8 rounded-xl px-3 text-[11px] font-medium disabled:pointer-events-none disabled:opacity-50",
                isLight
                  ? "bg-black/[0.05] text-[#1a1625]/55 hover:bg-black/[0.08]"
                  : "bg-white/[0.06] text-white/55 hover:bg-white/[0.10]"
              )}
            >
              {isSavingManagePanel ? "验证中" : "保存"}
            </button>
          )}
          <button
            type="button"
            disabled={Boolean(launchingId)}
            onClick={() => {
              onClose();
              onLaunchInstance(mp);
            }}
            className="motion-control flex h-8 min-w-28 items-center justify-center gap-1.5 rounded-xl bg-white/90 px-4 text-[11px] font-semibold text-[#1a1625] hover:bg-white disabled:pointer-events-none disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            {launchingId === mp.id ? "启动中" : "启动"}
          </button>
          <div className="relative">
            <button
              type="button"
              aria-expanded={manageMoreOpen}
              onClick={() => setManageMoreOpen((open) => !open)}
              className={cn(
                "motion-control flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11px] font-medium",
                isLight
                  ? "bg-black/[0.05] text-[#1a1625]/50 hover:bg-black/[0.08]"
                  : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10]"
              )}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              更多
            </button>
            {manageMoreOpen && (
              <div
                className={cn(
                  "ios-floating-menu absolute bottom-10 right-0 z-10 w-32 overflow-hidden rounded-xl py-1 backdrop-blur-[32px]",
                  glassBg,
                  isLight && "is-light"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setManageMoreOpen(false);
                    onClose();
                    onTriggerRename(mp);
                  }}
                  className={cn(
                    "motion-menu-item w-full px-3 py-2 text-left text-[11px]",
                    isLight
                      ? "text-[#1a1625]/55 hover:text-[#1a1625]/80"
                      : "text-white/55 hover:text-white/80"
                  )}
                >
                  重命名
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManageMoreOpen(false);
                    onPickCover(mp);
                  }}
                  className={cn(
                    "motion-menu-item w-full px-3 py-2 text-left text-[11px]",
                    isLight
                      ? "text-[#1a1625]/55 hover:text-[#1a1625]/80"
                      : "text-white/55 hover:text-white/80"
                  )}
                >
                  更换插图
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManageMoreOpen(false);
                    onClose();
                    onTriggerDelete(mp);
                  }}
                  className={cn(
                    "motion-menu-item w-full px-3 py-2 text-left text-[11px]",
                    isLight
                      ? "text-red-900/50 hover:text-red-900/75"
                      : "text-red-300/50 hover:text-red-200/75"
                  )}
                >
                  删除实例
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
