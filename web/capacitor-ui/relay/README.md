# SillyClient 诊断上报无服务器中转（Cloudflare Worker）

前端发布包中**严禁**内置任何 GitHub Token（会在公开包中被提取泄露并被 GitHub 自动吊销）。
正式发版采用 **服务端中转（Cloudflare Worker）**：客户端只提交脱敏结构化诊断字段（`schemaVersion: 1` + `report`），由 Worker 在服务端校验、过滤注入、按指纹查重并调用 GitHub REST API 建单或追加评论。

## 四级投递链路优先级

1. **原生宿主通道**（预留扩展）：`TarvenEnv.submitDiagnosticReport(payload)`
2. **HTTPS 中转接口**（生产一键提交主通道）：`VITE_DIAGNOSTIC_REPORT_ENDPOINT`（支持主备多地址，如 `主地址,备用地址` 或 `VITE_DIAGNOSTIC_REPORT_FALLBACK_ENDPOINT`；也可用 `localStorage["sillyclient.diagnosticEndpoint"]` 本地覆盖）
3. **本地 Vite 开发联调中转**：`POST /__dev/diagnostic-report`（仅 `vite` dev server 生效，调用本机 `gh api`，不进生产产物）
4. **零服务端与失败兜底**：自动整理脱敏 Markdown、复制到剪贴板并拉起 GitHub `/issues/new` 预填草稿；若中转网络异常，错误态也提供「打开草稿」切换入口

## Cloudflare Worker 已内置的防护能力

- **服务端强校验与重构**：忽略调用方自拼 Markdown，仅接收合法的 16 个 `area` 模块及结构化脱敏字段，在服务端重新渲染标题与正文，转义 HTML、`@mention` 与外链。
- **混合去重（突破前 50 条限制并排除 PR）**：先查最近 30 条开放 Issue（规避 Search API 索引延迟），未命中再查 GitHub Search API（`is:issue is:open "sc:<fingerprint>"`）。
- **防刷限流与同指纹冷却**：利用 Edge Cache API 按 IP 限制每小时次数（默认 `10`），并对同 IP + 同指纹在 `600s` 内重复提交直接返回已有 Issue 关联回执，不重复刷评论。

## 部署步骤

1. 在 GitHub 生成一个仅授予 `CAPTCHAAAAA/SillyClient` 仓库 **`Issues: Read and write`** 权限的 Fine-grained PAT（建议用专职 bot 账号或后续迁移为 GitHub App）。
2. 进入本目录并登录 Wrangler：
   ```bash
   cd web/capacitor-ui/relay
   pnpm dlx wrangler login
   ```
3. 写入机密凭据并部署 Worker：
   ```bash
   pnpm dlx wrangler secret put GITHUB_TOKEN
   pnpm dlx wrangler deploy
   ```
4. **国内可达性建议**：Cloudflare 默认 `*.workers.dev` 在国内部分网络可能存在 DNS 污染或阻断，建议在 Cloudflare Dashboard 中为该 Worker **绑定自定义域名**（如 `https://report.your-domain.com`），再配合备用地址实现主备故障转移。
5. **健康检查**：部署后访问 `GET https://<你的域名>/health` 确认返回 `ok: true`。
6. **在构建四端前端时注入端点**（无需放在客户端代码秘密库中）：
   ```bash
   VITE_DIAGNOSTIC_REPORT_ENDPOINT=https://report.your-domain.com pnpm build
   ```
   多端均可通过主/备形式配置：
   ```bash
   VITE_DIAGNOSTIC_REPORT_ENDPOINT=https://report.your-domain.com,https://your-worker.workers.dev
   ```
