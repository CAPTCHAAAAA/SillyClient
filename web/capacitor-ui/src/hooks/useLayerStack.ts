import { useEffect, useRef, useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { TarvenEnv } from "../capacitor-plugin";

export interface LayerItem {
  id: string;
  onClose: () => void;
}

/**
 * 统一浮层管理器 (Layer Stack Manager)
 * 
 * 1. 维护浮层进入/退出的栈结构（后开先关）；
 * 2. 统一监听 ESC 键与 Android 原生物理返回键，按栈序优雅退出；
 * 3. 提供统一的带退场动画关闭辅助方法（closeWithTransition），废除分散的定时器样板代码。
 */
export function useLayerStack() {
  const stackRef = useRef<LayerItem[]>([]);
  const [, setVersion] = useState(0);

  // 注册浮层到栈顶
  const registerLayer = useCallback((id: string, onClose: () => void) => {
    // 避免重复注册
    stackRef.current = stackRef.current.filter((item) => item.id !== id);
    stackRef.current.push({ id, onClose });
    setVersion((v) => v + 1);

    return () => {
      stackRef.current = stackRef.current.filter((item) => item.id !== id);
      setVersion((v) => v + 1);
    };
  }, []);

  // 注销浮层
  const unregisterLayer = useCallback((id: string) => {
    stackRef.current = stackRef.current.filter((item) => item.id !== id);
    setVersion((v) => v + 1);
  }, []);

  // 关闭栈顶浮层
  const popTopLayer = useCallback(() => {
    if (stackRef.current.length === 0) return false;
    const topItem = stackRef.current[stackRef.current.length - 1];
    topItem.onClose();
    return true;
  }, []);

  // 检查某个浮层是否在栈顶
  const isTopLayer = useCallback((id: string) => {
    if (stackRef.current.length === 0) return false;
    return stackRef.current[stackRef.current.length - 1].id === id;
  }, []);

  // 监听 ESC 键与物理返回键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (stackRef.current.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          popTopLayer();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    // 适配 Android / 宿主物理返回键 (仅在原生端执行)
    let backButtonHandle: any = null;
    let isCancelled = false;
    try {
      if (Capacitor.isNativePlatform() && typeof (TarvenEnv as any)?.addListener === "function") {
        void (TarvenEnv as any).addListener("backButton", () => {
          if (stackRef.current.length > 0) {
            popTopLayer();
          }
        }).then((handle: any) => {
          if (isCancelled) {
            handle?.remove?.();
          } else {
            backButtonHandle = handle;
          }
        }).catch(() => {});
      }
    } catch {
      // 浏览器环境忽略
    }

    return () => {
      isCancelled = true;
      window.removeEventListener("keydown", handleKeyDown, true);
      if (backButtonHandle?.remove) {
        backButtonHandle.remove();
      }
    };
  }, [popTopLayer]);

  /**
   * 带退场动画的关闭包装器
   * 触发 exit 动画 class，在 duration 毫秒后真正执行 unmount 回调
   */
  const useAnimatedClose = (
    isOpen: boolean,
    onCloseReal: () => void,
    duration = 200
  ) => {
    const [isClosing, setIsClosing] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerClose = useCallback(() => {
      if (isClosing) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsClosing(true);
      timerRef.current = setTimeout(() => {
        setIsClosing(false);
        onCloseReal();
        timerRef.current = null;
      }, duration);
    }, [isClosing, onCloseReal, duration]);

    useEffect(() => {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []);

    return {
      isClosing,
      triggerClose,
      shouldRender: isOpen || isClosing,
    };
  };

  return {
    registerLayer,
    unregisterLayer,
    popTopLayer,
    isTopLayer,
    useAnimatedClose,
    stackDepth: stackRef.current.length,
  };
}
