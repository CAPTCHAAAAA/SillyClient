import { pathToFileURL } from "node:url";

const DEFAULT_SENTRY_BASE_URL = "https://us.sentry.io";
const DEFAULT_SENTRY_ORG_SLUG = "sillyclient";
const DEFAULT_SENTRY_PROJECT_SLUG = "sillyclient-console";
const DEFAULT_MAX_ISSUES_PER_RUN = 10;

const SENTRY_ISSUE_MARKER_PREFIX = "sentry-issue-id:";
const SENTRY_COUNT_MARKER_PREFIX = "sentry-synced-count:";

function stripControlAndComments(text) {
  return String(text ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/<!--/g, "<\\!--")
    .replace(/-->/g, "--\\>");
}

function redactPotentialSecrets(text) {
  return String(text ?? "")
    .replace(/\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{8,}\b/g, "[REDACTED_TOKEN]")
    .replace(/\bsntry[us]_[A-Za-z0-9_+/=]{12,}\b/g, "[REDACTED_SENTRY_TOKEN]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/\b(?:sk|rk|pk)-(?:live|test|proj)?-?[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_KEY]")
    .replace(/(https?:\/\/)([^\s:@/]+):([^\s@/]+)@/gi, "$1[REDACTED]@");
}

export function sanitizeExternalText(value, maxLength = 800) {
  const cleaned = redactPotentialSecrets(stripControlAndComments(value))
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!cleaned) return "";
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned;
}

function sanitizeSingleLine(value, maxLength = 120) {
  return sanitizeExternalText(value, maxLength)
    .replace(/```+/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeMarkdownFence(value) {
  return String(value ?? "").replace(/```+/g, (match) => match.replace(/`/g, "\\`"));
}

function extractTagMap(event) {
  const tags = {};
  if (Array.isArray(event?.tags)) {
    for (const item of event.tags) {
      if (item && typeof item.key === "string" && typeof item.value === "string") {
        tags[item.key] = sanitizeSingleLine(item.value, 80);
      }
    }
  }
  return tags;
}

export function extractHighestSyncedCount(comments) {
  let highest = 0;
  for (const comment of comments || []) {
    const body = typeof comment?.body === "string" ? comment.body : "";
    const regex = /<!--\s*sentry-synced-count:(\d+)\s*-->/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > highest) {
        highest = value;
      }
    }
  }
  return highest;
}

export function extractInitialSyncedCount(issueBody) {
  const match = /<!--\s*sentry-synced-count:(\d+)\s*-->/.exec(String(issueBody ?? ""));
  if (!match) return 0;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 0;
}

export function buildGitHubIssueFromSentry(sentryIssue, latestEvent, userReports = []) {
  const tags = extractTagMap(latestEvent);
  const context = latestEvent?.context && typeof latestEvent.context === "object" ? latestEvent.context : {};

  const areaLabel = tags.area_label || tags.area || "运行时";
  const platform = tags.client_platform || tags.environment || "unknown";
  const release = sanitizeSingleLine(latestEvent?.release?.version || tags.release || "unknown", 64);
  const stage = sanitizeSingleLine(context.stage || tags.stage || "未标注", 80);
  const errorCode = sanitizeSingleLine(context.error_code || tags.error_code || "未提供", 80);
  const fingerprint = sanitizeSingleLine(context.fingerprint || "untracked", 64);
  const count = Number.parseInt(String(sentryIssue?.count ?? "1"), 10) || 1;
  const permalink = sanitizeSingleLine(sentryIssue?.permalink || "", 260);
  const shortId = sanitizeSingleLine(sentryIssue?.shortId || sentryIssue?.id || "", 48);

  const rawHeadline = sanitizeSingleLine(sentryIssue?.title || context.summary || "未命名异常", 110);
  const cleanHeadline = rawHeadline.replace(/^\[[^\]]+\]\s*/, "").trim() || rawHeadline;
  const prefix = `[Sentry][${areaLabel}] `;
  const maxBodyHeadline = Math.max(24, 120 - prefix.length);
  const clippedHeadline =
    cleanHeadline.length > maxBodyHeadline
      ? `${cleanHeadline.slice(0, maxBodyHeadline - 3)}...`
      : cleanHeadline;
  const title = `${prefix}${clippedHeadline}`;

  const rawSummary = sanitizeExternalText(
    context.summary || latestEvent?.message || sentryIssue?.title || "(无摘要)",
    1200
  );
  const reportComment = Array.isArray(userReports)
    ? userReports.find((item) => typeof item?.comments === "string" && item.comments.trim())?.comments
    : "";
  const rawUserNote = sanitizeExternalText(context.user_note || reportComment || "", 600);

  const lines = [
    `<!-- ${SENTRY_ISSUE_MARKER_PREFIX}${sentryIssue.id} -->`,
    `<!-- ${SENTRY_COUNT_MARKER_PREFIX}${count} -->`,
    "## 来自 Sentry 的脱敏异常同步",
    `- **Sentry 编号**：\`${shortId}\`（当前累计上报 \`${count}\` 次）`,
    `- **所属模块**：${areaLabel}（\`${tags.area || "unknown"}\`）`,
    `- **阶段 / 错误码**：\`${stage}\` · \`${errorCode}\``,
    `- **端环境 / 版本**：\`${platform}\` · \`${release}\``,
    `- **诊断指纹**：\`${fingerprint}\``,
  ];
  if (permalink && /^https:\/\/[a-z0-9.-]+\.sentry\.io\//i.test(permalink)) {
    lines.push(`- **Sentry 链接**：${permalink}`);
  }

  lines.push("", "## 脱敏摘要", "```text", escapeMarkdownFence(rawSummary), "```");
  if (rawUserNote) {
    lines.push("", "## 用户补充说明", "```text", escapeMarkdownFence(rawUserNote), "```");
  }

  lines.push(
    "",
    "---",
    "_由 `sync-sentry-issues` 过渡期工作流自动同步（仅含客户端前置脱敏字段，不含 IP 与本机路径）。_"
  );

  return { title, body: lines.join("\n"), count };
}

export function buildDeltaComment(sentryIssue) {
  const count = Number.parseInt(String(sentryIssue?.count ?? "1"), 10) || 1;
  const lastSeen = sanitizeSingleLine(sentryIssue?.lastSeen || "", 40);
  const shortId = sanitizeSingleLine(sentryIssue?.shortId || sentryIssue?.id || "", 48);
  const parts = [
    `<!-- ${SENTRY_COUNT_MARKER_PREFIX}${count} -->`,
    `Sentry 同步更新（\`${shortId}\`）：累计触发次数已升至 **${count}** 次。`,
  ];
  if (lastSeen) {
    parts.push(`最近一次上报时间：\`${lastSeen}\``);
  }
  return parts.join("\n");
}

async function fetchJson(url, options, fetchImpl) {
  const response = await fetchImpl(url, options);
  const rawText = await response.text();
  let json = null;
  if (rawText.trim()) {
    try {
      json = JSON.parse(rawText);
    } catch {
      json = null;
    }
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${new URL(url).pathname}: ${rawText.slice(0, 200)}`);
  }
  return json;
}

function buildSentryHeaders(sentryToken) {
  return {
    Authorization: `Bearer ${sentryToken}`,
    Accept: "application/json",
  };
}

function buildGitHubHeaders(githubToken) {
  return {
    Authorization: `Bearer ${githubToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "sillyclient-sentry-sync",
    "Content-Type": "application/json",
  };
}

export async function syncSentryIssues(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const log = options.log ?? console.log;
  const sentryToken = String(options.sentryToken ?? process.env.SENTRY_AUTH_TOKEN ?? "").trim();
  const githubToken = String(options.githubToken ?? process.env.GITHUB_TOKEN ?? "").trim();
  const repository = String(
    options.repository ?? process.env.GITHUB_REPOSITORY ?? "CAPTCHAAAAA/SillyClient"
  ).trim();
  const sentryBaseUrl = String(
    options.sentryBaseUrl ?? process.env.SENTRY_BASE_URL ?? DEFAULT_SENTRY_BASE_URL
  )
    .trim()
    .replace(/\/+$/, "");
  const orgSlug = String(
    options.orgSlug ?? process.env.SENTRY_ORG_SLUG ?? DEFAULT_SENTRY_ORG_SLUG
  ).trim();
  const projectSlug = String(
    options.projectSlug ?? process.env.SENTRY_PROJECT_SLUG ?? DEFAULT_SENTRY_PROJECT_SLUG
  ).trim();
  const maxIssues = Math.max(
    1,
    Math.min(25, Number(options.maxIssues ?? process.env.MAX_ISSUES_PER_RUN ?? DEFAULT_MAX_ISSUES_PER_RUN) || DEFAULT_MAX_ISSUES_PER_RUN)
  );
  const dryRun = Boolean(
    options.dryRun ??
      (process.env.SYNC_DRY_RUN === "1" || process.env.SYNC_DRY_RUN === "true")
  );

  if (!sentryToken) {
    log("[sync-sentry-issues] SENTRY_AUTH_TOKEN is not configured; skipping run cleanly.");
    return { skipped: true, created: 0, updated: 0, unchanged: 0 };
  }
  if (!githubToken && !dryRun) {
    throw new Error("GITHUB_TOKEN is required unless SYNC_DRY_RUN=true");
  }
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`);
  }

  const sentryHeaders = buildSentryHeaders(sentryToken);
  const projectMeta = await fetchJson(
    `${sentryBaseUrl}/api/0/projects/${encodeURIComponent(orgSlug)}/${encodeURIComponent(projectSlug)}/`,
    { headers: sentryHeaders },
    fetchImpl
  );
  const projectId = String(projectMeta?.id || "").trim();
  if (!projectId) {
    throw new Error(`Could not resolve numeric project ID for ${orgSlug}/${projectSlug}`);
  }

  const issuesUrl =
    `${sentryBaseUrl}/api/0/organizations/${encodeURIComponent(orgSlug)}/issues/` +
    `?project=${encodeURIComponent(projectId)}&query=${encodeURIComponent("is:unresolved")}`;
  const unresolvedIssues = await fetchJson(issuesUrl, { headers: sentryHeaders }, fetchImpl);
  if (!Array.isArray(unresolvedIssues) || unresolvedIssues.length === 0) {
    log("[sync-sentry-issues] No unresolved Sentry issues found.");
    return { skipped: false, created: 0, updated: 0, unchanged: 0 };
  }

  const targetIssues = unresolvedIssues.slice(0, maxIssues);
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const sentryIssue of targetIssues) {
    const marker = `${SENTRY_ISSUE_MARKER_PREFIX}${sentryIssue.id}`;
    const ghHeaders = buildGitHubHeaders(githubToken);

    let existing = null;
    if (githubToken) {
      const searchUrl =
        `https://api.github.com/search/issues?q=` +
        encodeURIComponent(`repo:${owner}/${repo} is:issue "${marker}"`);
      const searchResult = await fetchJson(searchUrl, { headers: ghHeaders }, fetchImpl);
      existing = Array.isArray(searchResult?.items)
        ? searchResult.items.find((item) => !item.pull_request && String(item.body || "").includes(marker)) ?? null
        : null;
    }

    if (existing) {
      const currentCount = Number.parseInt(String(sentryIssue?.count ?? "1"), 10) || 1;
      let highestSynced = extractInitialSyncedCount(existing.body);
      if (existing.state === "open" && githubToken) {
        const commentsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${existing.number}/comments?per_page=100`;
        const comments = await fetchJson(commentsUrl, { headers: ghHeaders }, fetchImpl);
        highestSynced = Math.max(highestSynced, extractHighestSyncedCount(comments));
      }

      if (existing.state === "open" && currentCount > highestSynced) {
        const deltaBody = buildDeltaComment(sentryIssue);
        if (!dryRun) {
          await fetchJson(
            `https://api.github.com/repos/${owner}/${repo}/issues/${existing.number}/comments`,
            {
              method: "POST",
              headers: ghHeaders,
              body: JSON.stringify({ body: deltaBody }),
            },
            fetchImpl
          );
        }
        updated += 1;
        log(`[sync-sentry-issues] Updated #${existing.number} with count=${currentCount}`);
      } else {
        unchanged += 1;
      }
      continue;
    }

    const latestEvent = await fetchJson(
      `${sentryBaseUrl}/api/0/issues/${encodeURIComponent(sentryIssue.id)}/events/latest/`,
      { headers: sentryHeaders },
      fetchImpl
    ).catch(() => null);

    const userReports = await fetchJson(
      `${sentryBaseUrl}/api/0/issues/${encodeURIComponent(sentryIssue.id)}/user-reports/`,
      { headers: sentryHeaders },
      fetchImpl
    ).catch(() => []);

    const draft = buildGitHubIssueFromSentry(sentryIssue, latestEvent, userReports);
    const syncLabel = String(options.syncLabel ?? process.env.SENTRY_SYNC_LABEL ?? "").trim();
    const issuePayload = {
      title: draft.title,
      body: draft.body,
      ...(syncLabel ? { labels: [syncLabel] } : {}),
    };
    if (!dryRun) {
      await fetchJson(
        `https://api.github.com/repos/${owner}/${repo}/issues`,
        {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify(issuePayload),
        },
        fetchImpl
      );
    }
    created += 1;
    log(`[sync-sentry-issues] Created issue for Sentry ${sentryIssue.shortId || sentryIssue.id}`);
  }

  return { skipped: false, created, updated, unchanged };
}

const isEntrypoint =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  syncSentryIssues().catch((error) => {
    console.error("[sync-sentry-issues] Failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
