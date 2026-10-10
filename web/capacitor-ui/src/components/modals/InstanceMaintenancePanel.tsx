import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, RotateCcw, X } from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import type { MaintenanceScan, MaintenanceRecovery } from "../../capacitor-plugin";
import type { TavernInstance } from "../../types";
import { cn } from "../../lib/utils";
import { defaultMaintenanceSelection, maintenanceRemaining, maintenanceSelection, MaintenanceSession } from "../../lib/maintenance-plan";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";

interface Props {
  instance: TavernInstance | null;
  isOpen: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  registerLayer: (id: string, onClose: () => void) => () => void;
}

function size(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function InstanceMaintenancePanel({ instance, isOpen, onClose, isLight, glassBg, registerLayer }: Props) {
  const instanceId = instance?.installDir || instance?.id || null;
  const session = useRef(new MaintenanceSession());
  const [tab, setTab] = useState<"scan" | "recovery">("scan");
  const [scan, setScan] = useState<MaintenanceScan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recoveries, setRecoveries] = useState<MaintenanceRecovery[]>([]);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<Awaited<ReturnType<typeof TarvenEnv.getStatus>> | null>(null);
  const text = isLight ? "text-[#1a1625]/70" : "text-white/70";
  const subtle = isLight ? "text-[#1a1625]/40" : "text-white/40";
  const control = cn("motion-control h-8 rounded-xl px-3 text-[11px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
    isLight ? "bg-black/[0.05] text-[#1a1625]/60 hover:text-[#1a1625]" : "bg-white/[0.06] text-white/60 hover:text-white");

  const requestClose = useCallback(() => {
    if (busy || closing) return;
    session.current.switchTo(null);
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 300);
  }, [busy, closing, onClose]);

  useEffect(() => {
    if (isOpen) return registerLayer("instance_maintenance", requestClose);
  }, [isOpen, registerLayer, requestClose]);

  const refresh = useCallback(async (view: "scan" | "recovery" = "scan") => {
    if (!instanceId || instance?.type !== "local") return;
    const ticket = session.current.next();
    setBusy(true);
    setError(null);
    setSummary(null);
    setWarnings([]);
    setScan(null);
    setSelected(new Set());
    setRecoveries([]);
    setExpired(false);
    try {
      const status = await TarvenEnv.getStatus();
      if (!session.current.current(ticket)) return;
      const running = status.serverReady || !!status.operationId;
      setActiveRun(running ? status : null);
      if (running) throw new Error("存在运行中的实例或任务，维护暂不可用");
      if (view === "recovery") {
        const result = await TarvenEnv.listInstanceMaintenanceRecovery({ instanceId, installPath: instance?.installPath });
        if (!session.current.current(ticket)) return;
        setRecoveries(result.items);
        setWarnings(result.warnings);
      } else {
        const result = await TarvenEnv.scanInstanceMaintenance({ instanceId, installPath: instance?.installPath });
        if (!session.current.current(ticket) || result.instanceId !== instanceId) return;
        setScan(result);
        setSelected(defaultMaintenanceSelection(result));
        setWarnings(result.warnings);
        setExpired(result.expiresAt <= Date.now());
      }
    } catch (failure) {
      if (session.current.current(ticket)) setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (session.current.current(ticket)) setBusy(false);
    }
  }, [instanceId, instance?.type]);

  useEffect(() => {
    session.current.switchTo(isOpen && instance?.type === "local" ? instanceId : null);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setClosing(false);
    setTab("scan");
    setActiveRun(null);
    if (isOpen && instance?.type === "local") void refresh("scan");
    return () => {
      session.current.switchTo(null);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [instanceId, instance?.type, isOpen, refresh]);

  useEffect(() => {
    if (!scan) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, scan.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [scan]);

  if (!isOpen || !instance) return null;

  return <>
    <LayerBackdrop onClick={requestClose} isClosing={closing} zIndex={LAYERS.DIALOG_BACKDROP} blur />
    <section role="dialog" aria-modal="true" aria-label="实例维护"
      inert={closing}
      className={cn("ios-task-surface fixed rounded-2xl flex flex-col backdrop-blur-[40px] saturate-180",
        closing ? "animate-clone-panel-exit" : "animate-clone-panel", glassBg, isLight && "is-light")}
      style={{ zIndex: LAYERS.DIALOG_SURFACE, top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(460px, calc(100vw - 2rem))", maxHeight: "min(84vh, calc(100dvh - 3rem))" }}>
      <header className="flex items-center justify-between gap-3 px-5 h-14 flex-shrink-0">
        <div className="min-w-0">
          <h2 className={cn("text-sm font-semibold", text)}>实例维护</h2>
          <div className={cn("text-[10px] truncate", subtle)}>{instance.subtitle || instance.name}</div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={busy} title="刷新" aria-label="刷新" className={cn(control, "px-2")}
            onClick={() => void refresh(tab)}><RefreshCw className="h-3.5 w-3.5" /></button>
          <button type="button" disabled={busy} title="关闭" aria-label="关闭实例维护" className={cn(control, "px-2")}
            onClick={requestClose}><X className="h-3.5 w-3.5" /></button>
        </div>
      </header>
      <div className="flex justify-center px-5 pb-3 flex-shrink-0">
        <div className="ios-choice-control flex gap-1">
          {(["scan", "recovery"] as const).map(view => <button key={view} type="button" disabled={busy}
            aria-pressed={tab === view} className={cn(control, tab === view && (isLight ? "bg-black/10" : "bg-white/10"))}
            onClick={() => { setTab(view); void refresh(view); }}>{view === "scan" ? "待处理" : "恢复记录"}</button>)}
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto px-5 pb-4 scrollbar-subtle" style={{ scrollbarGutter: "stable" }}>
        {error && <div role="alert" className="text-xs text-red-400 whitespace-pre-wrap break-words mb-3">{error}</div>}
        {summary && <div role="status" className={cn("text-xs mb-3", text)}>{summary}</div>}
        {warnings.map((warning, index) => <div key={index} className={cn("text-[10px] break-words mb-2", subtle)}>{warning}</div>)}
        {expired && tab === "scan" && <div role="status" className={cn("text-[11px] mb-3", subtle)}>扫描已过期</div>}
        {activeRun?.instanceId === instanceId && <button type="button" disabled={busy} className={cn(control, "mb-3")}
          onClick={async () => {
            if (!instanceId) return;
            const ticket = session.current.next();
            setBusy(true);
            try {
              await TarvenEnv.closeTavern({ instanceId, operationId: activeRun.operationId });
              if (session.current.current(ticket)) await refresh(tab);
            } catch (failure) {
              if (session.current.current(ticket)) setError(failure instanceof Error ? failure.message : String(failure));
            } finally { if (session.current.current(ticket)) setBusy(false); }
          }}>停止实例</button>}
        {busy && <div role="status" className={cn("text-xs py-5 text-center", subtle)}>处理中...</div>}
        {!busy && !error && tab === "scan" && scan?.items.length === 0
          && <div className={cn("text-xs py-5 text-center", subtle)}>未发现待处理项目</div>}
        {!busy && !error && tab === "recovery" && recoveries.length === 0
          && <div className={cn("text-xs py-5 text-center", subtle)}>暂无恢复记录</div>}
        {tab === "scan" && scan?.items.map(item => <label key={item.id}
          className={cn("flex items-start gap-3 py-3", text)}>
          <input type="checkbox" checked={selected.has(item.id)} disabled={busy || expired}
            aria-label={item.description} className="mt-0.5 flex-shrink-0 accent-current"
            onChange={event => setSelected(previous => {
              const next = new Set(previous);
              if (event.target.checked) next.add(item.id); else next.delete(item.id);
              return next;
            })} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium break-words">{item.description}</div>
            <div className={cn("text-[10px] break-all mt-1", subtle)}>{item.relativePath}</div>
            <div className={cn("flex gap-3 text-[10px] mt-1", subtle)}>
              <span>{item.confidence === "suspected" ? "疑似异常" : "归属已核验"}</span>
              <span>{size(item.sizeBytes)}</span>
              <span>{item.kind === "stale_extension_reference" ? "移除引用" : "隔离"}</span>
            </div>
          </div>
        </label>)}
        {tab === "recovery" && recoveries.map(item => <div key={item.recoveryId} className={cn("flex items-start gap-3 py-3", text)}>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium break-words">{item.description}</div>
            <div className={cn("text-[10px] break-all mt-1", subtle)}>{item.relativePath}</div>
            <div className={cn("text-[10px] mt-1", subtle)}>{size(item.sizeBytes)} · {new Date(item.createdAt).toLocaleString()}</div>
            {item.conflict && <div className="text-[10px] text-red-400 mt-1 break-words">{item.conflict}</div>}
          </div>
          <button type="button" title="恢复" aria-label={`恢复 ${item.description}`}
            disabled={busy || !item.canRestore || !item.token} className={cn(control, "px-2")}
            onClick={async () => {
              if (!instanceId) return;
              const ticket = session.current.next();
              setBusy(true);
              setError(null);
              try {
                const result = await TarvenEnv.restoreInstanceMaintenance({
                  instanceId, recoveryId: item.recoveryId, token: item.token, installPath: instance?.installPath,
                });
                if (!session.current.current(ticket)) return;
                if (!result.success) throw new Error(result.error || "恢复未完成");
                const records = await TarvenEnv.listInstanceMaintenanceRecovery({ instanceId, installPath: instance?.installPath });
                if (!session.current.current(ticket)) return;
                setRecoveries(records.items);
                setWarnings(records.warnings);
                setSummary("已恢复");
              } catch (failure) {
                if (session.current.current(ticket)) setError(failure instanceof Error ? failure.message : String(failure));
              } finally { if (session.current.current(ticket)) setBusy(false); }
            }}><RotateCcw className="h-3.5 w-3.5" /></button>
        </div>)}
      </div>
      <footer className="flex items-center justify-end gap-2 px-5 py-3 flex-shrink-0">
        <button type="button" disabled={busy} className={control} onClick={requestClose}>关闭</button>
        {tab === "scan" && <button type="button" disabled={busy || expired || !scan || selected.size === 0}
          className={control} onClick={async () => {
            if (!scan || !instanceId || scan.instanceId !== instanceId) return;
            const ticket = session.current.next();
            setBusy(true);
            setError(null);
            try {
              const result = await TarvenEnv.applyInstanceMaintenance({
                instanceId, scanId: scan.scanId, items: maintenanceSelection(scan, selected),
                installPath: instance?.installPath,
              });
              if (!session.current.current(ticket)) return;
              const remaining = maintenanceRemaining(scan, result);
              setScan({ ...scan, items: remaining, expiresAt: 0 });
              setSelected(new Set());
              setExpired(true);
              const errors = result.results.filter(item => !item.success).map(item => item.error || "项目未处理");
              if (errors.length) setError(errors.join("\n"));
              const completed = result.results.filter(item => item.success).length;
              setSummary(`已处理 ${completed} 项 · 已隔离 ${size(result.quarantinedBytes)}`);
            } catch (failure) {
              if (session.current.current(ticket)) {
                setError(failure instanceof Error ? failure.message : String(failure));
                setSelected(new Set());
                setExpired(true);
              }
            } finally { if (session.current.current(ticket)) setBusy(false); }
          }}>处理所选</button>}
      </footer>
    </section>
  </>;
}
