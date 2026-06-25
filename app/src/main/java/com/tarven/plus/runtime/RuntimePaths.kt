package com.tarven.plus.runtime

import android.content.Context
import java.io.File

data class RuntimePaths(
    val appFilesDir: File,
    val tarvenHome: File,
    val bootstrapDir: File,
    val scriptsDir: File,
    val serverDir: File,
    val rootfsDir: File,
    val usrDir: File,
    val usrLibDir: File,
    val tmpDir: File,
    val logsDir: File,
    val nativeLibDir: File,
    val nodeBin: File,
    val shBin: File,
    val gitBin: File,
    val gitRemoteHttpBin: File,
    val curlBin: File
) {
    companion object {
        fun from(context: Context): RuntimePaths {
            val files = context.filesDir
            val home = File(files, "tarven")
            val bootstrap = File(home, "bootstrap")
            val usr = File(home, "usr")
            val native = File(context.applicationInfo.nativeLibraryDir)

            return RuntimePaths(
                appFilesDir = files,
                tarvenHome = home,
                bootstrapDir = bootstrap,
                scriptsDir = File(bootstrap, "scripts"),
                serverDir = File(bootstrap, "server"),
                rootfsDir = File(bootstrap, "rootfs"),
                usrDir = usr,
                usrLibDir = File(usr, "lib"),
                tmpDir = File(home, "tmp"),
                logsDir = File(home, "logs"),
                nativeLibDir = native,
                nodeBin = File(native, "libtarven-node.so"),
                shBin = File(native, "libtarven-sh.so"),
                gitBin = File(native, "libtarven-git.so"),
                gitRemoteHttpBin = File(native, "libtarven-git-remote-http.so"),
                curlBin = File(native, "libtarven-curl.so")
            )
        }
    }

    fun ensureDirs() {
        listOf(
            tarvenHome,
            bootstrapDir,
            scriptsDir,
            serverDir,
            rootfsDir,
            usrDir,
            tmpDir,
            logsDir
        ).forEach { it.mkdirs() }
    }
}
