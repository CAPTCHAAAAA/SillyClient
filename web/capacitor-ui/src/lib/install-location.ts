import type { InstallPathMode } from "../capacitor-plugin";

export function cleanInstallPath(value: string): string | undefined {
  return value.trim().replace(/^["']|["']$/g, "").trim() || undefined;
}

export function validateInstallPathInput(rawValue: string, options?: { isIOS?: boolean }): string | null {
  const clean = cleanInstallPath(rawValue);
  if (!clean) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(clean)) {
    return "安装目录必须是可执行的本地路径，不要粘贴网址或文件链接；请点击「浏览」选择文件夹";
  }
  if (options?.isIOS) {
    if (/[▸›]/.test(clean) || !clean.startsWith("/")) {
      return "请点击右侧「浏览」按钮选择文件夹，不要直接填写或粘贴「我的 iPhone ▸ ...」显示名称";
    }
    if (/(?:^|\/)\.\.(?:\/|$)/.test(clean)) {
      return "安装路径不能包含上级目录跳转（..），请点击「浏览」重新选择文件夹";
    }
  } else {
    if (/[▸›]/.test(clean)) {
      return "请点击「浏览」选择文件夹，不要直接粘贴界面显示名称";
    }
    if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(clean)) {
      return "安装路径不能包含上级目录跳转（..），请重新选择完整目录";
    }
  }
  return null;
}

function executablePath(value: string): string | undefined {
  const path = cleanInstallPath(value);
  if (path && /^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
    throw new Error("安装目录必须是可执行的本地路径，文档提供器位置只能用于导入");
  }
  return path;
}

export function installationSelection(selection: { path?: string; installPathMode?: InstallPathMode }) {
  const path = executablePath(selection.path || "");
  if (!path) throw new Error("目录选择器未返回实际路径");
  const mode = selection.installPathMode ?? "exact";
  if (mode !== "root" && mode !== "exact") throw new Error("目录选择器返回了无效的路径模式");
  return { path, mode };
}

export function shouldShowDirectoryPickerError(error: unknown, isIOS: boolean): boolean {
  if (isIOS) {
    return !(typeof error === "object" && error !== null && (
      ("code" in error && error.code === "PICKER_CANCELLED")
      || ("message" in error && error.message === "PICKER_CANCELLED")
    ));
  }
  const message = error instanceof Error ? error.message : String(error);
  return !/cancel|取消/i.test(message);
}

export function instanceParentPath(value: string): string | undefined {
  return executablePath(value);
}

/** Relocation selects a parent, even when it has the same name as the instance. */
export function relocationTargetInParent(parentPath: string, instancePath: string): string {
  const parent = executablePath(parentPath);
  const source = executablePath(instancePath);
  const name = source?.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  if (!parent || !name || name === "." || name === "..") {
    throw new Error("无法确认实例目录，请重新打开存储迁移");
  }
  const separator = parent.includes("\\") || /^[a-z]:/i.test(parent) ? "\\" : "/";
  return `${parent.replace(/[\\/]+$/, "")}${separator}${name}`;
}

/** Migration targets are exact; the native installer owns root resolution for new installs. */
export function exactInstallTarget(value: string, mode: InstallPathMode, instanceIdOrName: string): string | undefined {
  const path = executablePath(value);
  if (!path) return undefined;
  if (mode === "exact") return path;
  return buildInstanceSubfolder(path, instanceIdOrName);
}

export function sanitizeFolderName(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 100) || "instance";
}

/** The selected directory is always a parent, never the instance itself. */
export function buildInstanceSubfolder(parentDir: string, instanceName: string): string {
  const clean = parentDir.trim().replace(/^["']|["']$/g, "").trim().replace(/[\\/]+$/, "");
  const separator = clean.includes("\\") || /^[a-z]:/i.test(clean) ? "\\" : "/";
  const safeName = sanitizeFolderName(instanceName);
  return `${clean}${separator}${safeName}`;
}

/**
 * Normalizes a raw instance display name or user input into an ASCII-safe native instance identity.
 * Strictly adheres to `^[A-Za-z0-9_-]{1,128}$` required by native runtimes.
 */
export function normalizeInstanceIdentity(name: string, fallback?: string): string {
  const asciiSlug = name
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (asciiSlug && /^[A-Za-z0-9_-]{1,128}$/.test(asciiSlug)) {
    return asciiSlug;
  }
  const defaultFallback = fallback && /^[A-Za-z0-9_-]{1,128}$/.test(fallback)
    ? fallback
    : `inst-${Date.now().toString(36)}`;
  return defaultFallback;
}
