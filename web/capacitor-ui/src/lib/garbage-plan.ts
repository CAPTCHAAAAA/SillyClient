import type { GarbageItem } from "../capacitor-plugin";

export async function executeGarbagePlan(
  items: readonly GarbageItem[],
  remove: (options: { path: string; token?: string }) => Promise<{ success: boolean; error?: string }>,
) {
  const plan = items.map(item => ({ ...item }));
  const failed: GarbageItem[] = [];
  const errors: string[] = [];
  for (const item of plan) {
    try {
      if (!item.token) throw new Error("Missing scan token; scan again before deleting");
      const result = await remove({ path: item.path, token: item.token });
      if (result?.success !== true) throw new Error(result?.error || "Deletion was not confirmed");
    } catch (error) {
      failed.push(item);
      errors.push(`${item.description}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { failed, errors };
}
