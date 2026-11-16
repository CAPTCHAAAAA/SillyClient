const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function loadTsModule(relativePath, cache = new Map()) {
  const normalizedRel = relativePath.replace(/\\/g, "/");
  if (cache.has(normalizedRel)) {
    return cache.get(normalizedRel).exports;
  }
  const sourcePath = path.join(__dirname, "..", normalizedRel);
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  cache.set(normalizedRel, compiledModule);
  const context = {
    exports: compiledModule.exports,
    module: compiledModule,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    require: (id) => {
      if (id.startsWith(".")) {
        const baseDir = path.dirname(sourcePath);
        const candidateTs = path.resolve(baseDir, `${id}.ts`);
        if (fs.existsSync(candidateTs)) {
          const nextRel = path.relative(path.join(__dirname, ".."), candidateTs);
          return loadTsModule(nextRel, cache);
        }
      }
      throw new Error(`Unexpected runtime import in ${relativePath}: ${id}`);
    },
  };
  vm.runInNewContext(compiled, context, { filename: sourcePath });
  return compiledModule.exports;
}

const { extractReleaseSummary, appUpdateInfo } = loadTsModule("src/lib/app-update.ts");

test("extractReleaseSummary reads blockquote overview and strips markdown formatting", () => {
  const body = `# SillyClient v1.14.4

> iOS 紧急修复版（\`1.14.4\` / Build \`49\`）：在 \`v1.14.3\` 基础上继续修复“部分用户可用、留空/中文实例名或外置目录仍创建失败”的分化故障——恢复 iOS 实例安全目录 ID 归一化，并将系统文件选择器的安全作用域获取提前至 \`didPickDocumentsAt\` 主线程同步完成。本版为紧急补丁，仅更新 iOS，连续跳过 Windows 与 Android（继续使用 [\`v1.14.1\`](https://github.com/CAPTCHAAAAA/SillyClient/releases/tag/v1.14.1)，后续统一整合）。

## iOS 修复

- 详细条目`;

  assert.equal(
    extractReleaseSummary(body),
    "iOS 紧急修复版（1.14.4 / Build 49）：在 v1.14.3 基础上继续修复“部分用户可用、留空/中文实例名或外置目录仍创建失败”的分化故障——恢复 iOS 实例安全目录 ID 归一化，并将系统文件选择器的安全作用域获取提前至 didPickDocumentsAt 主线程同步完成。本版为紧急补丁，仅更新 iOS，连续跳过 Windows 与 Android（继续使用 v1.14.1，后续统一整合）。"
  );
});

test("extractReleaseSummary merges multi-line quotes, preserves snake_case, and ignores section blockquotes when top quote absent", () => {
  const multiLineQuote = `# SillyClient v1.15.0\n\n> 第一行 **加粗** 与 \`node_modules\` 说明\n> 第二行补充 [发布页](https://github.com/CAPTCHAAAAA/SillyClient)\n\n## 更新内容\n- 其他内容`;
  assert.equal(
    extractReleaseSummary(multiLineQuote),
    "第一行 加粗 与 node_modules 说明 第二行补充 发布页"
  );

  const plainParagraph = `# SillyClient v1.15.1\n\n普通段落总览说明。\n\n## 验证\n> 正文后面的引用`;
  assert.equal(extractReleaseSummary(plainParagraph), "普通段落总览说明。");

  const sectionOnlyQuote = `# SillyClient v1.15.2\n\n## 更新内容\n> 章节引用兜底。\n\n- 列表项`;
  assert.equal(extractReleaseSummary(sectionOnlyQuote), "章节引用兜底。");
  assert.equal(extractReleaseSummary(""), undefined);
  assert.equal(extractReleaseSummary(null), undefined);
});

test("appUpdateInfo attaches releaseSummary cleanly when release body exists", () => {
  const info = appUpdateInfo(
    "1.14.1",
    {
      tag_name: "v1.14.4",
      published_at: "2026-11-14T10:57:05Z",
      body: "# SillyClient v1.14.4\n\n> 修复说明 **测试**。",
      assets: [
        {
          name: "SillyClient-iOS-v1.14.4-unsigned.ipa",
          browser_download_url: "https://github.com/CAPTCHAAAAA/SillyClient/releases/download/v1.14.4/SillyClient-iOS-v1.14.4-unsigned.ipa",
          size: 1024,
          state: "uploaded",
        },
      ],
    },
    "ios"
  );

  assert.equal(info.updateAvailable, true);
  assert.equal(info.latestVersion, "1.14.4");
  assert.equal(info.releaseSummary, "修复说明 测试。");
});
