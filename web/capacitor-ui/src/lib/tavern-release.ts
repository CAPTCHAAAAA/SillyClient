import type { GithubRelease } from "../capacitor-plugin";

export function selectTavernRelease(releases: GithubRelease[], selectedVersion: string): GithubRelease {
  const selected = selectedVersion === "stable"
    ? releases.find(release => !release.prerelease && !release.isBranch)
      || releases.find(release => !release.prerelease)
    : releases.find(release => release.tag === selectedVersion);
  if (!selected) {
    throw new Error(selectedVersion === "stable"
      ? "暂无可用的 SillyTavern 正式版本，请重新获取版本列表或导入本地 ZIP"
      : `所选 SillyTavern 版本 ${selectedVersion} 已不在列表中，请重新选择`);
  }
  return selected;
}
