import { useCallback, useSyncExternalStore } from "react";
import { EMPTY_LOGS, GLOBAL_LOG_KEY, instanceLogs } from "../lib/log-store";

const inactiveSubscribe = () => () => {};
const inactiveSnapshot = () => EMPTY_LOGS;

export function useInstanceLogs(key: string | null | undefined, active: boolean) {
  const logKey = key || GLOBAL_LOG_KEY;
  const subscribe = useCallback((listener: () => void) => instanceLogs.subscribe(logKey, listener), [logKey]);
  const getSnapshot = useCallback(() => instanceLogs.getSnapshot(logKey), [logKey]);
  return useSyncExternalStore(
    active ? subscribe : inactiveSubscribe,
    active ? getSnapshot : inactiveSnapshot,
    inactiveSnapshot,
  );
}
