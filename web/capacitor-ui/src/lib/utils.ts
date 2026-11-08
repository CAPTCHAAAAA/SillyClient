import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 清洗并规范化保存在数据层中的版本字符串。
 * 剥离任何可能混入的前导 v/V，保留纯净的版本号或标识（例如 "1.19.0"、"stable"、"local"）。
 */
export function normalizeStoredVersion(ver?: string): string {
  if (ver === undefined || ver === null) return "1.12.4";
  const trimmed = ver.trim();
  if (!trimmed || trimmed === "unknown" || trimmed === "—") return "—";
  const clean = trimmed.replace(/^v+/i, "").trim();
  return clean || "—";
}

/**
 * 格式化用于界面展示的版本标签。
 * - 纯数字 SemVer（例如 "1.19.0"、"v1.19.0"、"vv1.19.0"）统一呈现为规范的 "v1.19.0"；
 * - 英文标识或别名（例如 "stable"、"vstable"、"local"、"dev"）绝不强加 v，统一呈现为 "stable"、"local"、"dev"；
 * - 占位符或未知返回 "—"。
 */
export function formatDisplayVersion(ver?: string): string {
  const clean = normalizeStoredVersion(ver);
  return /^\d/.test(clean) ? `v${clean}` : clean;
}
