/**
 * 原生注册表/安装器的报错是英文内部不变量（例如
 * "Default installations must be direct children of the instance root"）。
 * 它们会直接显示在向导与迁移面板里，所以在这里翻译成可执行的中文提示；
 * 未命中映射的消息原样返回。
 */
const NATIVE_ERROR_HINTS: Array<[RegExp, string]> = [
  [
    /Default installations must be direct children of the instance root/i,
    "该位置在实例存放文件夹的子文件夹里；请选择存放文件夹本身，或实例之外的文件夹",
  ],
  [
    /Custom installation destinations must be new or empty/i,
    "该文件夹已存在且不为空；请选择一个新文件夹",
  ],
  [
    /Installation locations cannot overlap another registered instance/i,
    "该位置与已有实例目录重叠；请换一个文件夹",
  ],
  [
    /must be within an approved root/i,
    "该路径不在允许的存储范围内；请用「浏览」选择内部存储里的文件夹",
  ],
  [
    /An installation root cannot be used as a relocation destination/i,
    "不能把实例存放文件夹本身当作迁移目标；请选择它下面的新文件夹",
  ],
  [
    /only the application-private area and shared storage are available/i,
    "该磁盘位置不可用；请选择内部存储里的文件夹",
  ],
];

export function humanizeNativeError(message: string | null | undefined): string {
  const text = (message ?? "").trim();
  if (!text) return "操作未完成，请重试";
  for (const [pattern, hint] of NATIVE_ERROR_HINTS) {
    if (pattern.test(text)) return hint;
  }
  return text;
}
