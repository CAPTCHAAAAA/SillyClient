package com.tarven.plus.runtime

import android.content.Context
import java.io.File

class AssetExtractor(private val context: Context) {

    fun extractOwnBootstrap(paths: RuntimePaths, log: (String) -> Unit) {
        paths.ensureDirs()

        log("准备 Tarven++ 自有 bootstrap 文件")
        copyAssetIfExists("bootstrap/scripts/start-server.sh", File(paths.scriptsDir, "start-server.sh"), log)

        val startScript = File(paths.scriptsDir, "start-server.sh")
        RuntimeFileUtils.chmodExecutable(startScript)

        unzipAssetIfExists("server-source.zip", paths.serverDir, log)
        unzipAssetIfExists("bootstrap/rootfs/rootfs-fs.zip", paths.rootfsDir, log)
        unzipAssetIfExists("bootstrap/rootfs/rootfs-usr.zip", paths.usrDir, log)
        unzipAssetIfExists("bootstrap/rootfs/rootfs-libs.zip", paths.usrDir, log)

        extractDependencyPacks(paths, log)
    }

    private fun extractDependencyPacks(paths: RuntimePaths, log: (String) -> Unit) {
        val list = try {
            context.assets.list("bootstrap/server/dependency-packs") ?: emptyArray()
        } catch (_: Throwable) {
            emptyArray()
        }

        list.filter { it.endsWith(".zip") }.forEach { name ->
            unzipAssetIfExists("bootstrap/server/dependency-packs/$name", paths.usrDir, log)
        }
    }

    private fun copyAssetIfExists(assetPath: String, target: File, log: (String) -> Unit) {
        try {
            context.assets.open(assetPath).use { input -> RuntimeFileUtils.copyStream(input, target) }
            log("已复制 asset: $assetPath")
        } catch (_: Throwable) {
            log("未放入 asset，跳过: $assetPath")
        }
    }

    private fun unzipAssetIfExists(assetPath: String, targetDir: File, log: (String) -> Unit) {
        try {
            context.assets.open(assetPath).use { input -> RuntimeFileUtils.unzipStream(input, targetDir) }
            log("已解压 asset: $assetPath")
        } catch (_: Throwable) {
            log("未放入 asset，跳过: $assetPath")
        }
    }
}
