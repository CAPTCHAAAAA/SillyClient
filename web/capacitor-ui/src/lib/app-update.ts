import type { AppUpdateInfo } from "../capacitor-plugin";

export type UpdatePlatform = "android" | "windows" | "ios" | "web";
interface Release {
  tag_name?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  body?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: { name?: unknown; browser_download_url?: unknown; size?: unknown; state?: unknown }[];
}
const REPOSITORY = "CAPTCHAAAAA/SillyClient";
const RETIRED = new Set(["2.0.0", "2.0.1", "2.0.2"]);

function version(value: string): number[] | null {
  const clean = value.trim().replace(/^v/i, "");
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(clean)) return null;
  const parts = clean.split(".").map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
export function isAppUpgrade(current: string, candidate: string, assetVerified: boolean): boolean {
  const left = version(current);
  const right = version(candidate);
  if (!left || !right || !assetVerified) return false;
  const from = left.join(".");
  const to = right.join(".");
  if (RETIRED.has(to)) return false;
  if (RETIRED.has(from) && to === "1.10.0") return true;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index];
  }
  return false;
}
export function hasReleaseAsset(release: Release, platform: UpdatePlatform): boolean {
  const tag = typeof release.tag_name === "string" ? release.tag_name.trim() : "";
  const parsed = version(tag);
  if (!parsed || release.draft === true || release.prerelease === true || !Array.isArray(release.assets)) return false;
  const clean = parsed.join(".");
  const versionInName = new RegExp(`(?:^|[-_ ])v?${clean.replace(/\./g, "\\.")}(?=[-_ ]|\\.(?:apk|exe|ipa)$)`, "i");
  return release.assets.some(asset => {
    if (typeof asset.name !== "string" || typeof asset.browser_download_url !== "string"
      || typeof asset.size !== "number" || asset.size <= 0 || (asset.state !== undefined && asset.state !== "uploaded")) return false;
    if (!/^SillyClient(?:[ -])/i.test(asset.name) || !versionInName.test(asset.name) || /[\\/\x00-\x1f]/.test(asset.name)) return false;
    const matches = {
      android: /android.*\.apk$/i,
      windows: /(?:windows|setup).*\.exe$/i,
      ios: /ios.*\.ipa$/i,
      web: /\.(?:apk|exe|ipa)$/i,
    }[platform];
    if (!matches.test(asset.name)) return false;
    try {
      const url = new URL(asset.browser_download_url);
      return url.protocol === "https:" && url.hostname === "github.com" && !url.username && !url.password
        && (!url.port || url.port === "443") && !url.search && !url.hash
        && decodeURIComponent(url.pathname) === `/${REPOSITORY}/releases/download/${tag}/${asset.name}`;
    } catch { return false; }
  });
}
function cleanReleaseMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)\s]+(?:\s+"[^"]*")?\)/g, "$1")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/|#)[^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?=[^\w]|$)/g, "$1$2")
    .replace(/(^|[^\w])\*([^*\s][^*]*?)\*(?=[^\w]|$)/g, "$1$2")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 从 GitHub Release Markdown 正文中提取版本总览摘要：
 * 1. 优先取正文顶部 `>` 引用块（SillyClient 标准发布摘要段落）；
 * 2. 若缺失引用块，则兜底提取首个非标题/非代码块的普通段落；
 * 3. 清洗链接、行内代码等 Markdown 标记，便于桌面/移动端直接排版展示。
 */
export function extractReleaseSummary(body: unknown): string | undefined {
  if (typeof body !== "string") return undefined;
  const lines = body.replace(/\r\n?/g, "\n").split("\n");

  const collectBlockquote = (stopAtSectionHeading: boolean): string[] => {
    const collected: string[] = [];
    let inFence = false;
    let capturing = false;
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (/^(?:```|~~~)/.test(trimmed)) {
        if (capturing) break;
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      if (stopAtSectionHeading && /^#{2,6}\s+/.test(trimmed)) break;
      const quoteMatch = /^\s*>\s?(.*)$/.exec(rawLine);
      if (quoteMatch) {
        const cleanedLine = quoteMatch[1].trim();
        if (!cleanedLine) {
          if (capturing) break;
          continue;
        }
        capturing = true;
        collected.push(cleanedLine);
        continue;
      }
      if (capturing) break;
    }
    return collected;
  };

  const collectParagraph = (stopAtSectionHeading: boolean): string[] => {
    const collected: string[] = [];
    let inFence = false;
    let capturing = false;
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (/^(?:```|~~~)/.test(trimmed)) {
        if (capturing) break;
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      if (stopAtSectionHeading && /^#{2,6}\s+/.test(trimmed)) break;
      if (!trimmed) {
        if (capturing) break;
        continue;
      }
      if (/^(?:#{1,6}\s|<!--|[-*_]{3,}$|\||>)/.test(trimmed)) {
        if (capturing) break;
        continue;
      }
      const strippedBullet = trimmed.replace(/^(?:[-*+]\s+|\d+\.\s+)/, "");
      capturing = true;
      collected.push(strippedBullet);
    }
    return collected;
  };

  // Prefer intro blockquote before section headings, then intro paragraph, then anywhere in body.
  const candidates = [
    collectBlockquote(true),
    collectParagraph(true),
    collectBlockquote(false),
    collectParagraph(false),
  ];
  for (const part of candidates) {
    if (part.length === 0) continue;
    const cleaned = cleanReleaseMarkdown(part.join(" "));
    if (cleaned) return cleaned;
  }

  return undefined;
}

export function appUpdateInfo(currentVersion: string, raw: Release, platform: UpdatePlatform): AppUpdateInfo {
  const latestVersion = typeof raw.tag_name === "string" ? raw.tag_name.replace(/^v/i, "").trim() : "";
  if (!version(latestVersion)) throw new Error("Release version is invalid");
  const releaseSummary = extractReleaseSummary(raw.body);
  return {
    currentVersion, latestVersion,
    updateAvailable: isAppUpgrade(currentVersion, latestVersion, hasReleaseAsset(raw, platform)),
    releaseUrl: `https://github.com/${REPOSITORY}/releases/tag/${encodeURIComponent(String(raw.tag_name))}`,
    ...(typeof raw.published_at === "string" ? { publishedAt: raw.published_at } : {}),
    ...(releaseSummary ? { releaseSummary } : {}),
  };
}
async function timedRequest(url: string, request: typeof fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await request(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
export async function fetchAppUpdate(currentVersion: string, platform: UpdatePlatform, request: typeof fetch = fetch): Promise<AppUpdateInfo> {
  const api = `https://api.github.com/repos/${REPOSITORY}/releases`;
  let failure: unknown;
  for (const url of [`${api}/latest`, `https://gh-proxy.com/${api}/latest`]) {
    try { return appUpdateInfo(currentVersion, await timedRequest(url, request), platform); }
    catch (error) { failure = error; }
  }
  try {
    const tags = await timedRequest(`https://data.jsdelivr.com/v1/package/gh/${REPOSITORY}`, request);
    const candidate = Array.isArray(tags?.versions)
      ? tags.versions.find((tag: unknown) => typeof tag === "string" && version(tag) && !RETIRED.has(tag.replace(/^v/i, ""))) : undefined;
    if (!candidate) throw new Error("No verified application release");
    // A Git tag alone cannot prove that a platform installer was published.
    const release = await timedRequest(`${api}/tags/${encodeURIComponent(`v${candidate.replace(/^v/i, "")}`)}`, request);
    return appUpdateInfo(currentVersion, release, platform);
  } catch (error) { failure = error; }
  throw new Error(failure instanceof Error ? failure.message : String(failure));
}
