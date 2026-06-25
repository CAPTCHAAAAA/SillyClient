package com.tarven.plus.runtime

import android.content.Context
import java.io.File
import java.io.InputStream
import java.util.zip.ZipInputStream

object RuntimeFileUtils {

    fun copyStream(input: InputStream, target: File) {
        target.parentFile?.mkdirs()
        target.outputStream().use { output -> input.copyTo(output) }
    }

    fun unzipStream(input: InputStream, targetDir: File) {
        targetDir.mkdirs()
        ZipInputStream(input).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val outFile = File(targetDir, entry.name).canonicalFile
                val canonicalRoot = targetDir.canonicalFile

                if (!outFile.path.startsWith(canonicalRoot.path)) {
                    throw IllegalStateException("Zip entry escapes target dir: ${entry.name}")
                }

                if (entry.isDirectory) {
                    outFile.mkdirs()
                } else {
                    outFile.parentFile?.mkdirs()
                    outFile.outputStream().use { output -> zip.copyTo(output) }
                }
                zip.closeEntry()
            }
        }
    }

    fun copyAsset(context: Context, assetPath: String, target: File) {
        context.assets.open(assetPath).use { input -> copyStream(input, target) }
    }

    fun unzipAsset(context: Context, assetPath: String, targetDir: File) {
        context.assets.open(assetPath).use { input -> unzipStream(input, targetDir) }
    }

    fun chmodExecutable(file: File) {
        if (file.exists()) {
            file.setReadable(true, false)
            file.setExecutable(true, false)
        }
    }

    fun existsText(file: File): String {
        return if (file.exists()) "OK" else "MISSING"
    }
}
