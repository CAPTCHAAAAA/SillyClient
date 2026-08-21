/**
 * TanStack Router 实例。
 *
 * 路由约定：
 * - 页面文件放 src/routes/，用 createFileRoute 定义
 * - 新建路由文件后跑 pnpm run dev，让 src/routeTree.gen.ts 自动更新（勿手改）
 * - 根布局见 src/routes/__root.tsx；首页占位见 src/routes/index.tsx（须整体替换）
 */
import { QueryClient } from '@tanstack/react-query';
import { createRouter, createHashHistory } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    history: createHashHistory(),
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
