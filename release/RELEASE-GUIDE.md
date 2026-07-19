# 发版流程

SillyClient 的 Tag、Release 和安装包只发布在主仓库。Android 与 Windows 仓库保留用于构建的源码提交，不单独创建 Release。

## 1. 固定版本

1. 确认 Android `versionName`、Windows `package.json` 和目标 Tag 一致。
2. 记录 Android、Windows 与主仓库提交哈希。
3. 构建一次共享前端，并同步到 Android assets、Windows `frontend-dist/` 和主仓库 `docs/app/`。

## 2. 验证源码

Android：

```bash
pnpm --dir web/capacitor-ui install --frozen-lockfile
pnpm --dir web/capacitor-ui run build
./gradlew testDebugUnitTest :app:assembleRelease
```

Windows：

```powershell
npm ci
npm run check
npm run build
npm run pack
```

主仓库：

```bash
node scripts/validate-pages.mjs
```

## 3. 安装验证

- APK 覆盖安装到 arm64 实机，完成创建、启动、返回控制台、停止和删除流程。
- EXE 通过 NSIS 安装到测试目录，不从源码目录直接运行；确认内置 Node.js、前端资源和独立 SillyTavern 窗口可用。
- 两个平台分别确认终端提示、失败清理和重启后的实例状态。

## 4. 生成发布文件

安装包命名：

```text
SillyClient-Android-v<version>.apk
SillyClient-Windows-v<version>.exe
```

为最终文件生成 `SHA256SUMS.txt`，将校验值写入 `release/v<version>.md`。不要用调试包或源码目录中的临时构建物替换已经验证的文件。

## 5. 发布

1. 先推送三个仓库的对应提交并确认 CI 通过。
2. 在主仓库创建 `v<version>` Tag。
3. 用 `release/v<version>.md` 创建 Release，上传 APK、EXE 和 `SHA256SUMS.txt`。
4. 检查 Pages、Release 下载链接和安装包校验值。
