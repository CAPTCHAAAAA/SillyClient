/**
 * Cloudflare Worker relay for SillyClient diagnostic reports -> GitHub Issues.
 *
 * Self-contained ESM module (zero npm dependencies) compatible with both
 * `wrangler deploy` and single-file Cloudflare Dashboard paste.
 *
 * Required Worker Secret:
 *   - GITHUB_TOKEN: Fine-grained PAT scoped ONLY to Issues (Read & Write) on target repo.
 *
 * Optional Worker Variables:
 *   - GITHUB_REPOSITORY: Defaults to "CAPTCHAAAAA/SillyClient"
 *   - ALLOWED_ORIGIN: Comma-separated allowed origins (defaults to "*")
 *   - RATE_LIMIT_MAX_PER_HOUR: Per-IP submissions per hour via Cache API (defaults to "10", "0" disables)
 *   - FINGERPRINT_COOLDOWN_SECONDS: Same-IP same-fingerprint cooldown (defaults to "600", "0" disables)
 *   - TURNSTILE_SECRET_KEY: Optional Cloudflare Turnstile secret for captcha verification
 *   - RELAY_APP_KEY: Optional shared header secret checked against X-SillyClient-Key
 *   - DIAGNOSTIC_RATE_LIMITER: Optional Cloudflare native Rate Limiting binding
 */

const DEFAULT_REPO = "CAPTCHAAAAA/SillyClient";
const GITHUB_API_BASE = "https://api.github.com";
const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_RATE_LIMIT_MAX_PER_HOUR = 10;
const DEFAULT_FINGERPRINT_COOLDOWN_SECONDS = 600;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const AREA_DISPLAY_LABELS = {
  picker: "目录选择",
  create: "创建实例",
  launch: "启动",
  relocate: "迁移路径",
  import: "导入备份",
  export: "导出备份",
  manage: "实例管理",
  settings: "设置",
  maintenance: "维护",
  cleanup: "清理",
  rename: "重命名",
  terminal: "终端",
  auth: "认证与凭据",
  update: "应用更新",
  onboarding: "引导",
  runtime: "运行时",
};

function redactSecrets(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/(https?:\/\/)([^/\s:@]+):([^@\s]+)@/gi, "$1[redacted]:[redacted]@")
    .replace(/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{6,}/gi, "$1 [redacted]")
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|sk-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
      "[redacted-key]"
    )
    .replace(
      /\b(password|passwd|pwd|secret|token|api[-_]?key|authorization|cookie|session(?:id)?)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1=[redacted]"
    )
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>")
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, "<url>")
    .replace(/\bfile:\/\/[^\s"'<>]+/gi, "<file-url>")
    .replace(/\bcontent:\/\/[^\s"'<>]+/gi, "<content-uri>")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "<ip>")
    .replace(/[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\s"';<>|]+/gi, "<win-user-path>")
    .replace(/[A-Za-z]:\\[^\s"';<>|]+/g, "<win-path>")
    .replace(/\\\\[^\s"';<>|]+/g, "<unc-path>")
    .replace(/\/private\/var\/[^\s"';<>|]+/gi, "<ios-var-path>")
    .replace(/\/var\/mobile\/[^\s"';<>|]+/gi, "<mobile-path>")
    .replace(/\/var\/folders\/[^\s"';<>|]+/gi, "<tmp-path>")
    .replace(/\/Users\/[^\s"';<>|]+/gi, "<user-path>")
    .replace(/\/data\/(?:user\/\d+|data)\/[^\s"';<>|]+/gi, "<android-data-path>")
    .replace(/\/storage\/emulated\/\d+\/[^\s"';<>|]+/gi, "<android-storage-path>")
    .replace(/\/sdcard\/[^\s"';<>|]+/gi, "<android-storage-path>")
    .replace(/\/(?:home|mnt|media|Volumes)\/[^\s"';<>|]+/gi, "<path>");
}

function escapeMarkdownFence(value) {
  return String(value || "").replace(/```+/g, (match) => match.replace(/`/g, "\\`"));
}

function neutralizeMarkdownProse(value) {
  return String(value || "")
    .replace(/```+/g, "'")
    .replace(/!\[/g, "![\u200b")
    .replace(/\]\s*\(/g, "] (")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/@([A-Za-z0-9][A-Za-z0-9-]*)/g, "@\u200b$1")
    .trim();
}

function cleanCompactToken(value, maxLength) {
  if (typeof value !== "string") return "";
  return neutralizeMarkdownProse(
    redactSecrets(value)
      .replace(/[\r\n\t`]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ).slice(0, maxLength);
}

function fnv1aHex(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeFingerprint(raw) {
  if (typeof raw !== "string") return "";
  const clean = raw.trim().toLowerCase();
  if (!clean || clean === "untracked") return "";
  return /^[a-z0-9_-]{4,32}$/.test(clean) ? clean : "";
}

function formatFingerprintTag(fingerprint) {
  const clean = normalizeFingerprint(fingerprint);
  if (!clean) return "sc:untracked";
  const bare = clean.startsWith("sc-") ? clean.slice(3) : clean;
  return `sc:${bare || clean}`;
}

function validateAndRenderPayload(payload, targetRepo) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, status: 400, error: "Request JSON body must be an object" };
  }

  if (payload.schemaVersion !== undefined && payload.schemaVersion !== 1) {
    return { ok: false, status: 400, error: "Unsupported diagnostic schemaVersion" };
  }

  if (typeof payload.repository === "string" && payload.repository.trim()) {
    if (payload.repository.trim().toLowerCase() !== targetRepo.toLowerCase()) {
      return { ok: false, status: 400, error: "Target repository mismatch" };
    }
  }

  const rawReport = payload.report;
  if (!rawReport || typeof rawReport !== "object" || Array.isArray(rawReport)) {
    return { ok: false, status: 400, error: "Structured diagnostic report object is required" };
  }

  const area = typeof rawReport.area === "string" ? rawReport.area.trim() : "";
  if (!(area in AREA_DISPLAY_LABELS)) {
    return { ok: false, status: 400, error: "Invalid or missing diagnostic area" };
  }
  const areaLabel = AREA_DISPLAY_LABELS[area];

  const userMessage = cleanCompactToken(rawReport.userMessage, 300);
  const rawSummary = redactSecrets(String(rawReport.summary || ""))
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, 600);
  const summary = rawSummary || userMessage;
  if (!summary) {
    return { ok: false, status: 400, error: "Diagnostic summary is required" };
  }

  const stage = cleanCompactToken(rawReport.stage, 80);
  const errorCode = cleanCompactToken(rawReport.errorCode, 80);
  const platform = cleanCompactToken(rawReport.platform, 40) || "web";
  const appVersion = cleanCompactToken(rawReport.appVersion, 40) || "unknown";
  const rawUserNote = redactSecrets(String(rawReport.userNote || ""))
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, 300);
  const safeUserNote = neutralizeMarkdownProse(rawUserNote);

  const rawElapsed = rawReport.elapsedMs;
  const elapsedMs =
    typeof rawElapsed === "number" &&
    Number.isFinite(rawElapsed) &&
    rawElapsed > 0 &&
    rawElapsed <= 86_400_000
      ? Math.round(rawElapsed)
      : undefined;

  const clientFingerprint = normalizeFingerprint(rawReport.fingerprint);
  const fingerprint =
    clientFingerprint ||
    `sc-${fnv1aHex(`${area}|${stage}|${errorCode}|${summary}`)}`;
  const fingerprintTag = formatFingerprintTag(fingerprint);

  const singleLineSummary = neutralizeMarkdownProse(
    summary.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim()
  );
  const prefix = `[异常反馈][${areaLabel}] `;
  const maxSummaryChars = Math.max(24, 110 - prefix.length);
  const clippedSummary =
    singleLineSummary.length > maxSummaryChars
      ? `${singleLineSummary.slice(0, maxSummaryChars - 3)}...`
      : singleLineSummary;
  const title = `${prefix}${clippedSummary || "未命名异常"}`.slice(0, 140);

  const metaLines = [
    `- **模块**：${areaLabel} (\`${area}\`)`,
    `- **阶段**：\`${stage || "未标注"}\``,
    `- **错误码**：\`${errorCode || "未提供"}\``,
    `- **运行环境**：\`${platform}\` · \`${appVersion}\``,
  ];
  if (elapsedMs !== undefined) {
    metaLines.push(`- **耗时**：\`${elapsedMs} ms\``);
  }
  metaLines.push(`- **诊断指纹**：\`${fingerprintTag}\``);

  const body = [
    "## 异常摘要",
    metaLines.join("\n"),
    "",
    "## 捕获错误（已脱敏）",
    "```text",
    escapeMarkdownFence(summary),
    "```",
    "",
    "## 用户补充说明",
    safeUserNote || "（用户未填写补充说明）",
    "",
    `<!-- sillyclient-diagnostic: fingerprint=${fingerprint} tag=${fingerprintTag} area=${area} platform=${platform} version=${appVersion} -->`,
  ].join("\n");

  const commentLines = [
    "### 新增同指纹反馈记录",
    `- **运行环境**：\`${platform}\` · \`${appVersion}\``,
    `- **阶段 / 错误码**：\`${stage || "未标注"}\` / \`${errorCode || "未提供"}\``,
    `- **诊断指纹**：\`${fingerprintTag}\``,
    "",
    "```text",
    escapeMarkdownFence(summary),
    "```",
    safeUserNote ? `\n**用户补充说明**：${safeUserNote}` : "",
    `\n<!-- sillyclient-diagnostic-followup: fingerprint=${fingerprint} -->`,
  ].filter(Boolean);

  return {
    ok: true,
    area,
    fingerprint,
    fingerprintTag,
    title,
    body,
    commentBody: commentLines.join("\n"),
  };
}

function buildCorsContext(request, env) {
  const reqOrigin = String(request.headers.get("Origin") || "").trim();
  const allowedRaw = String(env?.ALLOWED_ORIGIN || "*").trim();
  const baseHeaders = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, X-SillyClient-Key",
    "Cache-Control": "no-store",
  };

  if (!allowedRaw || allowedRaw === "*") {
    return {
      allowed: true,
      headers: {
        ...baseHeaders,
        "Access-Control-Allow-Origin": "*",
      },
    };
  }

  const allowList = allowedRaw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const normalizedReqOrigin = reqOrigin.replace(/\/+$/, "").toLowerCase();
  const matchedOrigin = allowList.find(
    (entry) => entry.toLowerCase() === normalizedReqOrigin
  );

  // Native clients without a browser Origin header pass origin check unless RELAY_APP_KEY is required.
  const allowed = !reqOrigin || Boolean(matchedOrigin);
  return {
    allowed,
    headers: {
      ...baseHeaders,
      Vary: "Origin",
      "Access-Control-Allow-Origin": matchedOrigin || allowList[0] || "null",
    },
  };
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function constantTimeEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function parsePositiveIntEnv(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.floor(num);
}

function getClientIp(request) {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp && cfIp.trim()) return cfIp.trim();
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded && forwarded.trim()) {
    return forwarded.split(",")[0].trim() || "unknown";
  }
  return "unknown";
}

function getEdgeCache(env) {
  if (env?.CACHE) return env.CACHE;
  if (typeof caches !== "undefined" && caches?.default) return caches.default;
  return null;
}

async function readCacheJson(cache, keyUrl) {
  if (!cache) return null;
  try {
    const match = await cache.match(keyUrl);
    if (!match) return null;
    return await match.json();
  } catch {
    return null;
  }
}

async function writeCacheJson(cache, keyUrl, value, ttlSeconds) {
  if (!cache || ttlSeconds <= 0) return;
  try {
    await cache.put(
      keyUrl,
      new Response(JSON.stringify(value), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${ttlSeconds}`,
        },
      })
    );
  } catch {
    // Cache failures must never break diagnostic delivery.
  }
}

async function checkRateLimits(request, env, clientIp, fingerprintTag) {
  if (env?.DIAGNOSTIC_RATE_LIMITER && typeof env.DIAGNOSTIC_RATE_LIMITER.limit === "function") {
    try {
      const outcome = await env.DIAGNOSTIC_RATE_LIMITER.limit({ key: clientIp });
      if (outcome && outcome.success === false) {
        return { blocked: true, retryAfter: 60 };
      }
    } catch {
      // Fall back cleanly if binding temporarily errors.
    }
  }

  const cache = getEdgeCache(env);
  if (!cache) {
    return { blocked: false, cooldownHit: null };
  }

  const cooldownSeconds = parsePositiveIntEnv(
    env?.FINGERPRINT_COOLDOWN_SECONDS,
    DEFAULT_FINGERPRINT_COOLDOWN_SECONDS
  );
  if (cooldownSeconds > 0 && fingerprintTag && fingerprintTag !== "sc:untracked") {
    const fpKey = `https://sillyclient-relay.internal/fp/${encodeURIComponent(clientIp)}/${encodeURIComponent(fingerprintTag)}`;
    const cachedIssue = await readCacheJson(cache, fpKey);
    if (cachedIssue && cachedIssue.reportId) {
      return { blocked: false, cooldownHit: cachedIssue };
    }
  }

  const maxPerHour = parsePositiveIntEnv(
    env?.RATE_LIMIT_MAX_PER_HOUR,
    DEFAULT_RATE_LIMIT_MAX_PER_HOUR
  );
  if (maxPerHour > 0) {
    const now = Date.now();
    const rateKey = `https://sillyclient-relay.internal/rate/${encodeURIComponent(clientIp)}`;
    const current = await readCacheJson(cache, rateKey);
    if (
      current &&
      typeof current.count === "number" &&
      typeof current.resetAt === "number" &&
      current.resetAt > now
    ) {
      if (current.count >= maxPerHour) {
        const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
        return { blocked: true, retryAfter };
      }
      const remainingSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      await writeCacheJson(
        cache,
        rateKey,
        { count: current.count + 1, resetAt: current.resetAt },
        remainingSeconds
      );
    } else {
      await writeCacheJson(
        cache,
        rateKey,
        { count: 1, resetAt: now + 3600 * 1000 },
        3600
      );
    }
  }

  return { blocked: false, cooldownHit: null };
}

async function rememberFingerprintCooldown(env, clientIp, fingerprintTag, issueData) {
  const cache = getEdgeCache(env);
  const cooldownSeconds = parsePositiveIntEnv(
    env?.FINGERPRINT_COOLDOWN_SECONDS,
    DEFAULT_FINGERPRINT_COOLDOWN_SECONDS
  );
  if (!cache || cooldownSeconds <= 0 || !fingerprintTag || fingerprintTag === "sc:untracked") {
    return;
  }
  const fpKey = `https://sillyclient-relay.internal/fp/${encodeURIComponent(clientIp)}/${encodeURIComponent(fingerprintTag)}`;
  await writeCacheJson(cache, fpKey, issueData, cooldownSeconds);
}

async function verifyTurnstileIfConfigured(payload, env, clientIp, fetchImpl) {
  const secret = String(env?.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) return { ok: true };
  const token = String(payload?.turnstileToken || payload?.["cf-turnstile-response"] || "").trim();
  if (!token) {
    return { ok: false, error: "Turnstile verification token required" };
  }
  const form = new URLSearchParams({ secret, response: token });
  if (clientIp && clientIp !== "unknown") {
    form.set("remoteip", clientIp);
  }
  const res = await fetchImpl(TURNSTILE_VERIFY_URL, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.success !== true) {
    return { ok: false, error: "Turnstile verification failed" };
  }
  return { ok: true };
}

async function githubFetch(path, token, fetchImpl, init = {}) {
  const response = await fetchImpl(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "SillyClient-Diagnostic-Relay/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!response.ok) {
    const msg =
      (data && typeof data.message === "string" && data.message) ||
      `GitHub API error HTTP ${response.status}`;
    const err = new Error(redactSecrets(msg));
    err.statusCode = response.status;
    throw err;
  }
  return data;
}

function issueMatchesMarkers(item, markers, area) {
  if (!item || item.pull_request) return false;
  if (typeof item.number !== "number" || typeof item.body !== "string") return false;
  if (!markers.some((m) => item.body.includes(m))) return false;
  const areaMetaMatch = /<!--\s*sillyclient-diagnostic:[^>]*\barea=([a-z0-9_-]+)/i.exec(item.body);
  if (areaMetaMatch && areaMetaMatch[1] !== area) return false;
  return true;
}

async function findMatchingOpenIssue(repo, token, fetchImpl, fingerprint, fingerprintTag, area) {
  if (!fingerprint || fingerprint === "untracked") return null;
  const bareHex = fingerprint.startsWith("sc-") ? fingerprint.slice(3) : fingerprint;
  const markers = Array.from(
    new Set([fingerprintTag, `sc:${bareHex}`, `sc:${fingerprint}`, `fingerprint=${fingerprint}`])
  );

  // 1. Inspect recent open issues directly (zero search-index lag for brand new reports).
  const recentOpen = await githubFetch(
    `/repos/${repo}/issues?state=open&per_page=30`,
    token,
    fetchImpl
  );
  if (Array.isArray(recentOpen)) {
    const matchedRecent = recentOpen.find((item) => issueMatchesMarkers(item, markers, area));
    if (matchedRecent) return matchedRecent;
  }

  // 2. Fallback to GitHub Search API when repo has >30 open items or PRs crowd page 1.
  try {
    const query = `repo:${repo} is:issue is:open "${fingerprintTag}"`;
    const searchData = await githubFetch(
      `/search/issues?q=${encodeURIComponent(query)}&per_page=5`,
      token,
      fetchImpl
    );
    if (Array.isArray(searchData?.items)) {
      return searchData.items.find((item) => issueMatchesMarkers(item, markers, area)) || null;
    }
  } catch {
    // Search API secondary rate limits should never block submitting a fresh issue.
  }

  return null;
}

export async function handleDiagnosticRelayRequest(request, env = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const url = new URL(request.url);
  const { allowed: originAllowed, headers } = buildCorsContext(request, env);

  const repo = String(env?.GITHUB_REPOSITORY || DEFAULT_REPO).trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    return jsonResponse({ ok: false, error: "Relay misconfigured: invalid GITHUB_REPOSITORY" }, 500, headers);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return jsonResponse(
      {
        ok: true,
        service: "sillyclient-diagnostic-relay",
        repository: repo,
        schemaVersion: 1,
      },
      200,
      headers
    );
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method Not Allowed" }, 405, headers);
  }

  if (!originAllowed) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403, headers);
  }

  const requiredAppKey = String(env?.RELAY_APP_KEY || "").trim();
  if (requiredAppKey) {
    const suppliedKey = String(request.headers.get("X-SillyClient-Key") || "").trim();
    if (!constantTimeEquals(suppliedKey, requiredAppKey)) {
      return jsonResponse({ ok: false, error: "Unauthorized relay key" }, 403, headers);
    }
  }

  const token = env?.GITHUB_TOKEN;
  if (!token) {
    return jsonResponse(
      { ok: false, error: "Relay misconfigured: GITHUB_TOKEN secret missing" },
      500,
      headers
    );
  }

  const rawText = await request.text();
  if (new TextEncoder().encode(rawText).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "Payload too large" }, 413, headers);
  }

  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON payload" }, 400, headers);
  }

  const clientIp = getClientIp(request);
  const turnstileCheck = await verifyTurnstileIfConfigured(payload, env, clientIp, fetchImpl);
  if (!turnstileCheck.ok) {
    return jsonResponse({ ok: false, error: turnstileCheck.error }, 403, headers);
  }

  const rendered = validateAndRenderPayload(payload, repo);
  if (!rendered.ok) {
    return jsonResponse({ ok: false, error: rendered.error }, rendered.status, headers);
  }

  const rateStatus = await checkRateLimits(request, env, clientIp, rendered.fingerprintTag);
  if (rateStatus.cooldownHit) {
    return jsonResponse(
      {
        ok: true,
        reportId: rateStatus.cooldownHit.reportId,
        issueNumber: rateStatus.cooldownHit.issueNumber,
        reportUrl: rateStatus.cooldownHit.reportUrl,
        deliveryMode: "relay",
        deduplicated: true,
        suppressedDuplicate: true,
        message: "相同异常近期已反馈，已关联原问题单",
      },
      200,
      headers
    );
  }
  if (rateStatus.blocked) {
    return jsonResponse(
      { ok: false, error: "提交过于频繁，请稍后再试" },
      429,
      { ...headers, "Retry-After": String(rateStatus.retryAfter || 60) }
    );
  }

  try {
    const matched = await findMatchingOpenIssue(
      repo,
      token,
      fetchImpl,
      rendered.fingerprint,
      rendered.fingerprintTag,
      rendered.area
    );

    if (matched) {
      await githubFetch(`/repos/${repo}/issues/${matched.number}/comments`, token, fetchImpl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: rendered.commentBody }),
      });
      const resultData = {
        ok: true,
        reportId: `#${matched.number}`,
        issueNumber: matched.number,
        reportUrl: matched.html_url,
        deliveryMode: "relay",
        deduplicated: true,
        message: `已关联到同指纹活跃 Issue #${matched.number} 并追加记录`,
      };
      await rememberFingerprintCooldown(env, clientIp, rendered.fingerprintTag, {
        reportId: resultData.reportId,
        issueNumber: resultData.issueNumber,
        reportUrl: resultData.reportUrl,
      });
      return jsonResponse(resultData, 200, headers);
    }

    const created = await githubFetch(`/repos/${repo}/issues`, token, fetchImpl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: rendered.title,
        body: rendered.body,
        labels: ["bug"],
      }),
    });

    if (!created || typeof created.number !== "number" || typeof created.html_url !== "string") {
      throw new Error("GitHub API did not return created issue metadata");
    }

    const resultData = {
      ok: true,
      reportId: `#${created.number}`,
      issueNumber: created.number,
      reportUrl: created.html_url,
      deliveryMode: "relay",
      deduplicated: false,
      message: `已在 GitHub 创建问题单 #${created.number}`,
    };
    await rememberFingerprintCooldown(env, clientIp, rendered.fingerprintTag, {
      reportId: resultData.reportId,
      issueNumber: resultData.issueNumber,
      reportUrl: resultData.reportUrl,
    });
    return jsonResponse(resultData, 201, headers);
  } catch (error) {
    return jsonResponse(
      { ok: false, error: redactSecrets(error?.message || "Relay request failed") },
      502,
      headers
    );
  }
}

export default {
  fetch(request, env) {
    return handleDiagnosticRelayRequest(request, env);
  },
};
