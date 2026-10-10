export function validateExternalUrl(value: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^https?:\/\/[^/?#]/i.test(raw) || /[\u0000-\u0020\u007f\\]/.test(raw)) {
    throw new Error("Only absolute HTTP(S) web addresses are supported");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid web address");
  }
  if (!url.hostname || url.username || url.password || /^https?:\/\/[^/?#]*@/i.test(raw)) {
    throw new Error("Web addresses must have a host and cannot contain credentials");
  }
  return url.href;
}
