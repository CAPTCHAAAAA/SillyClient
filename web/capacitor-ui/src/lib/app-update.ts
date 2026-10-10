import type { AppUpdateInfo } from "../capacitor-plugin";

export type UpdatePlatform = "android" | "windows" | "ios" | "web";
interface Release {
  tag_name?: unknown;
  html_url?: unknown;
  published_at?: unknown;
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
export function appUpdateInfo(currentVersion: string, raw: Release, platform: UpdatePlatform): AppUpdateInfo {
  const latestVersion = typeof raw.tag_name === "string" ? raw.tag_name.replace(/^v/i, "").trim() : "";
  if (!version(latestVersion)) throw new Error("Release version is invalid");
  return {
    currentVersion, latestVersion,
    updateAvailable: isAppUpgrade(currentVersion, latestVersion, hasReleaseAsset(raw, platform)),
    releaseUrl: `https://github.com/${REPOSITORY}/releases/tag/${encodeURIComponent(String(raw.tag_name))}`,
    ...(typeof raw.published_at === "string" ? { publishedAt: raw.published_at } : {}),
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
