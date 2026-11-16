// 根布局：Provider 放这里；页面路由在 src/routes/ 下单独建文件，勿堆进 index.tsx
import { useEffect, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  Navigate,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { ActionButton } from '@/components/common/ActionButton';
import { DiagnosticReportPrompt } from '@/components/common/DiagnosticReportPrompt';
import { installGlobalErrorListeners } from '@/lib/global-error-store';
import { createDiagnosticContext, humanizeNativeError } from '@/lib/native-errors';

function NotFoundComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === '/') return null;
  return <Navigate to="/" replace />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const message = useMemo(() => humanizeNativeError(error), [error]);
  const diagnostic = useMemo(
    () =>
      createDiagnosticContext(error, {
        area: 'runtime',
        stage: 'route-error-boundary',
        userMessage: message,
      }),
    [error, message]
  );

  return (
    <div className="min-h-screen bg-[#1a1625] text-white flex items-center justify-center p-6">
      <div className="ios-task-surface reading-flat-surface w-full max-w-md rounded-2xl border-0 bg-[#221927]/85 p-5 backdrop-blur-[40px] saturate-180 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">界面加载遇到意外异常</h2>
          <p className="mt-1 text-xs text-white/55">
            可尝试重新加载界面；若问题反复出现，可直接提交脱敏诊断信息帮助排查。
          </p>
        </div>

        <div
          role="alert"
          className="rounded-xl border-0 bg-white/[0.045] px-3 py-2 text-[11px] leading-relaxed text-[#e8a2b5]/85"
        >
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{message}</span>
          </div>
          <DiagnosticReportPrompt diagnostic={diagnostic} isLight={false} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <ActionButton
            onClick={() => window.location.reload()}
            className="!h-8 px-4 text-xs text-white/65 hover:text-white"
          >
            刷新应用
          </ActionButton>
          <ActionButton
            onClick={reset}
            className="!h-8 px-4 text-xs font-medium text-white/85 hover:text-white"
          >
            重试渲染
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    installGlobalErrorListeners();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
