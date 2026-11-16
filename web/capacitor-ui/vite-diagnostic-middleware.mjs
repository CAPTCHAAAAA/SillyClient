import { spawn } from "node:child_process";

const TARGET_REPOSITORY = "CAPTCHAAAAA/SillyClient";
const ENDPOINT_PATH = "/__dev/diagnostic-report";
const MAX_BODY_BYTES = 64 * 1024;
const GH_TIMEOUT_MS = 20000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

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
    .replace(/\\\\[^\s"';<>|]+/gi, "<unc-path>")
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
    .replace(/\]\s*\[/g, "] [")
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

function validateFingerprint(raw) {
  if (typeof raw !== "string") return "";
  const clean = raw.trim().toLowerCase();
  if (!clean || clean === "untracked") return "";
  return /^[a-z0-9_-]{4,32}$/.test(clean) ? clean : "";
}

function formatFingerprintTag(fingerprint) {
  const clean = validateFingerprint(fingerprint);
  if (!clean) return "sc:untracked";
  const bare = clean.startsWith("sc-") ? clean.slice(3) : clean;
  return `sc:${bare || clean}`;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function isLoopbackOriginAllowed(req) {
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") {
    return false;
  }
  const originHeader = req.headers.origin;
  if (originHeader) {
    try {
      const originUrl = new URL(originHeader);
      if (!LOOPBACK_HOSTS.has(originUrl.hostname.toLowerCase())) {
        return false;
      }
    } catch {
      return false;
    }
  }
  const hostHeader = String(req.headers.host || "").split(":")[0].toLowerCase();
  if (hostHeader && !LOOPBACK_HOSTS.has(hostHeader)) {
    return false;
  }
  return true;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks = [];
    let settled = false;

    const fail = (statusCode, message) => {
      if (settled) return;
      settled = true;
      const err = new Error(message);
      err.statusCode = statusCode;
      reject(err);
    };

    req.on("data", (chunk) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        fail(413, `Payload exceeds ${MAX_BODY_BYTES} bytes limit`);
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          const err = new Error("Request JSON body must be an object");
          err.statusCode = 400;
          reject(err);
          return;
        }
        resolve(parsed);
      } catch {
        const err = new Error("Invalid JSON body");
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on("error", (err) => {
      fail(400, err?.message || "Failed reading request body");
    });
  });
}

function runGhApi(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const args = ["api", endpoint];
    if (options.method) {
      args.push("--method", options.method);
    }
    if (options.inputJson !== undefined) {
      args.push("--input", "-");
    }

    const child = spawn("gh", args, {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, GH_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(redactSecrets(error?.message || "Failed to execute gh CLI")));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`gh api timed out after ${GH_TIMEOUT_MS}ms`));
        return;
      }
      if (code !== 0) {
        const detail = redactSecrets(stderr || stdout || `gh api exited with code ${code}`).trim();
        reject(new Error(detail.slice(0, 320)));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Unexpected non-JSON response from GitHub API"));
      }
    });

    if (options.inputJson !== undefined) {
      child.stdin.write(JSON.stringify(options.inputJson), "utf8");
    }
    child.stdin.end();
  });
}

export function renderDevDiagnosticIssue(payload) {
  const rawReport = payload?.report;
  if (rawReport && typeof rawReport === "object" && !Array.isArray(rawReport)) {
    const area = typeof rawReport.area === "string" ? rawReport.area.trim() : "";
    if (!(area in AREA_DISPLAY_LABELS)) {
      const err = new Error("Invalid diagnostic area");
      err.statusCode = 400;
      throw err;
    }
    const areaLabel = AREA_DISPLAY_LABELS[area];
    const userMessage = cleanCompactToken(rawReport.userMessage, 300);
    const summary =
      redactSecrets(String(rawReport.summary || ""))
        .replace(/\r\n?/g, "\n")
        .trim()
        .slice(0, 600) || userMessage;
    if (!summary) {
      const err = new Error("Diagnostic summary is required");
      err.statusCode = 400;
      throw err;
    }
    const stage = cleanCompactToken(rawReport.stage, 80);
    const errorCode = cleanCompactToken(rawReport.errorCode, 80);
    const platform = cleanCompactToken(rawReport.platform, 40) || "web";
    const appVersion = cleanCompactToken(rawReport.appVersion, 40) || "unknown";
    const safeUserNote = neutralizeMarkdownProse(
      redactSecrets(String(rawReport.userNote || ""))
        .replace(/\r\n?/g, "\n")
        .trim()
        .slice(0, 300)
    );
    const elapsedMs =
      typeof rawReport.elapsedMs === "number" &&
      Number.isFinite(rawReport.elapsedMs) &&
      rawReport.elapsedMs > 0
        ? Math.round(rawReport.elapsedMs)
        : undefined;
    const fingerprint = validateFingerprint(rawReport.fingerprint);
    const fingerprintTag = formatFingerprintTag(fingerprint);

    const singleLine = neutralizeMarkdownProse(
      summary.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim()
    );
    const prefix = `[异常反馈][${areaLabel}] `;
    const maxSummaryChars = Math.max(24, 110 - prefix.length);
    const clipped =
      singleLine.length > maxSummaryChars
        ? `${singleLine.slice(0, maxSummaryChars - 3)}...`
        : singleLine;
    const safeTitle = `${prefix}${clipped || "未命名异常"}`.slice(0, 140);

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

    const safeBody = [
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
      `<!-- sillyclient-diagnostic: fingerprint=${fingerprint || "untracked"} tag=${fingerprintTag} area=${area} platform=${platform} version=${appVersion} -->`,
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
      `\n<!-- sillyclient-diagnostic-followup: fingerprint=${fingerprint || "untracked"} -->`,
    ].filter(Boolean);

    return {
      area,
      fingerprint,
      fingerprintTag,
      safeTitle,
      safeBody,
      safeComment: commentLines.join("\n"),
    };
  }

  const err = new Error("Structured diagnostic report object is required");
  err.statusCode = 400;
  throw err;
}

function issueMatchesMarkers(item, markers, area) {
  if (!item || item.pull_request) return false;
  if (typeof item.number !== "number" || typeof item.body !== "string") return false;
  if (!markers.some((m) => item.body.includes(m))) return false;
  const areaMetaMatch = /<!--\s*sillyclient-diagnostic:[^>]*\barea=([a-z0-9_-]+)/i.exec(item.body);
  if (areaMetaMatch && areaMetaMatch[1] !== area) return false;
  return true;
}

async function findMatchingOpenIssueViaGh(ghApiFn, fingerprint, fingerprintTag, area) {
  if (!fingerprint) return null;
  const bareHex = fingerprint.startsWith("sc-") ? fingerprint.slice(3) : fingerprint;
  const markers = Array.from(
    new Set([fingerprintTag, `sc:${bareHex}`, `sc:${fingerprint}`, `fingerprint=${fingerprint}`])
  );

  const openIssues = await ghApiFn(`repos/${TARGET_REPOSITORY}/issues?state=open&per_page=30`);
  if (Array.isArray(openIssues)) {
    const matched = openIssues.find((item) => issueMatchesMarkers(item, markers, area));
    if (matched) return matched;
  }

  try {
    const query = `repo:${TARGET_REPOSITORY} is:issue is:open "${fingerprintTag}"`;
    const searchRes = await ghApiFn(
      `search/issues?q=${encodeURIComponent(query)}&per_page=5`
    );
    if (Array.isArray(searchRes?.items)) {
      return searchRes.items.find((item) => issueMatchesMarkers(item, markers, area)) || null;
    }
  } catch {
    // Search API lag or rate limiting should not block creating the issue cleanly.
  }

  return null;
}

export async function submitToGitHubViaGh(payload, ghApiFn = runGhApi) {
  const rendered = renderDevDiagnosticIssue(payload);
  const matched = await findMatchingOpenIssueViaGh(
    ghApiFn,
    rendered.fingerprint,
    rendered.fingerprintTag,
    rendered.area
  );

  if (matched) {
    await ghApiFn(`repos/${TARGET_REPOSITORY}/issues/${matched.number}/comments`, {
      method: "POST",
      inputJson: { body: rendered.safeComment },
    });
    return {
      statusCode: 200,
      ok: true,
      reportId: `#${matched.number}`,
      issueNumber: matched.number,
      reportUrl: matched.html_url,
      deliveryMode: "local-gh",
      deduplicated: true,
      message: `已关联到同指纹活跃 Issue #${matched.number} 并追加记录`,
    };
  }

  const created = await ghApiFn(`repos/${TARGET_REPOSITORY}/issues`, {
    method: "POST",
    inputJson: {
      title: rendered.safeTitle,
      body: rendered.safeBody,
      labels: ["bug"],
    },
  });

  if (!created || typeof created.number !== "number" || typeof created.html_url !== "string") {
    throw new Error("GitHub API did not return created issue number");
  }

  return {
    statusCode: 201,
    ok: true,
    reportId: `#${created.number}`,
    issueNumber: created.number,
    reportUrl: created.html_url,
    deliveryMode: "local-gh",
    deduplicated: false,
    message: `已在 GitHub 创建问题单 #${created.number}`,
  };
}

export function createDiagnosticDevPlugin() {
  return {
    name: "sillyclient-diagnostic-dev-relay",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(ENDPOINT_PATH, async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        if (!isLoopbackOriginAllowed(req)) {
          sendJson(res, 403, {
            ok: false,
            error: "Forbidden: cross-origin or non-loopback request rejected",
          });
          return;
        }

        const contentType = String(req.headers["content-type"] || "").toLowerCase();
        if (!contentType.includes("application/json")) {
          sendJson(res, 415, {
            ok: false,
            error: "Unsupported Media Type: expected application/json",
          });
          return;
        }

        try {
          const payload = await readJsonBody(req);
          const result = await submitToGitHubViaGh(payload);
          const { statusCode, ...jsonPayload } = result;
          sendJson(res, statusCode, jsonPayload);
        } catch (error) {
          const statusCode =
            error && typeof error.statusCode === "number" ? error.statusCode : 502;
          const message = redactSecrets(error?.message || "Local diagnostic relay failed");
          sendJson(res, statusCode, { ok: false, error: message });
        }
      });
    },
  };
}
