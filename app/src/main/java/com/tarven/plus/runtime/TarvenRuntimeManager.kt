package com.tarven.plus.runtime

import android.content.Context
import java.io.File

class TarvenRuntimeManager(private val context: Context) {

    private val runner = TarvenProcessRunner()

    fun extractAll(paths: RuntimePaths, log: (String) -> Unit) {
        paths.ensureDirs()
        val extractor = AssetExtractor(context)
        extractor.extractOwnBootstrap(paths, log)
    }

    fun startServer(paths: RuntimePaths, log: (String) -> Unit): Boolean {
        val startScript = File(paths.scriptsDir, "start-server.sh")
        val serverJs = File(paths.serverDir, "server.js")

        if (!paths.nodeBin.exists()) {
            log("Missing node: " + paths.nodeBin.absolutePath)
            return false
        }
        if (!startScript.exists()) {
            log("Missing start script: " + startScript.absolutePath)
            return false
        }
        if (!serverJs.exists()) {
            log("Missing server.js: " + serverJs.absolutePath)
            return false
        }

        return runner.startIfReady(paths, log)
    }

    fun prepareAndProbe(log: (String) -> Unit) {
        val paths = RuntimePaths.from(context)
        try {
            log("Tarven++ runtime host")
            log("nativeLibDir = " + paths.nativeLibDir.absolutePath)
            extractAll(paths, log)

            log("Native libs:")
            log("  node: " + RuntimeFileUtils.existsText(paths.nodeBin))
            log("")

            if (paths.nodeBin.exists()) {
                log("Smoke test: node --version")
                val result = runner.smokeTestNode(paths)
                log(result.diagnosticBlock())
            } else {
                log("node not found in nativeLibraryDir")
            }
        } catch (t: Throwable) {
            log("Error: " + t.javaClass.simpleName + ": " + t.message)
        }
    }

    fun stop() {
        runner.stop()
    }
}
