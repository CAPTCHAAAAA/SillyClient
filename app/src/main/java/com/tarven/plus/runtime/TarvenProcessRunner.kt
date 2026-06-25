package com.tarven.plus.runtime

import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit

data class NativeCommandResult(
    val command: List<String>,
    val exitCode: Int,
    val durationMs: Long,
    val stdout: String,
    val stderr: String,
    val exceptionText: String? = null
) {
    val isSuccess: Boolean get() = exitCode == 0

    fun diagnosticBlock(): String = buildString {
        appendLine("command: $command")
        appendLine("exitCode: $exitCode")
        appendLine("durationMs: $durationMs")
        val out = stdout.trim()
        val err = stderr.trim()
        appendLine(if (out.isEmpty()) "stdout: <empty>" else "stdout: $out")
        appendLine(if (err.isEmpty()) "stderr: <empty>" else "stderr: $err")
        if (exceptionText != null) appendLine("exception: $exceptionText")
    }
}

class TarvenProcessRunner {

    private var serverProcess: Process? = null

    fun executeNative(
        executable: File,
        args: List<String> = emptyList(),
        env: Map<String, String> = emptyMap(),
        workDir: File? = null,
        timeoutSeconds: Long = 10L
    ): NativeCommandResult {
        val startTime = System.currentTimeMillis()
        val fullCommand = mutableListOf(executable.absolutePath)
        fullCommand.addAll(args)

        val builder = ProcessBuilder(fullCommand).redirectErrorStream(false)
        workDir?.let { builder.directory(it) }

        val processEnv = builder.environment()
        env.forEach { (k, v) -> processEnv[k] = v }
        val nativeDir = executable.parentFile?.absolutePath ?: ""
        processEnv["LD_LIBRARY_PATH"] = listOfNotNull(
            nativeDir, processEnv["LD_LIBRARY_PATH"]
        ).filter { it.isNotEmpty() }.joinToString(":")

        var exitCode = Int.MIN_VALUE
        var stdout = ""
        var stderr = ""
        var exceptionText: String? = null

        try {
            val process = builder.start()
            val stdoutCollector = StreamCollector(process.inputStream)
            val stderrCollector = StreamCollector(process.errorStream)
            val stdoutThread = Thread(stdoutCollector, "tarven-stdout").apply { start() }
            val stderrThread = Thread(stderrCollector, "tarven-stderr").apply { start() }

            val finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS)
            if (!finished) {
                process.destroyForcibly()
                process.waitFor(2, TimeUnit.SECONDS)
                exceptionText = "Process timed out after ${timeoutSeconds}s"
            }

            stdoutThread.join(2000)
            stderrThread.join(2000)

            exitCode = if (finished) process.exitValue() else Int.MIN_VALUE
            stdout = stdoutCollector.getText()
            stderr = stderrCollector.getText()
        } catch (e: Exception) {
            exceptionText = "${e.javaClass.simpleName}: ${e.message}"
        }

        val durationMs = System.currentTimeMillis() - startTime
        return NativeCommandResult(
            command = fullCommand,
            exitCode = exitCode,
            durationMs = durationMs,
            stdout = stdout,
            stderr = stderr,
            exceptionText = exceptionText
        )
    }

    fun smokeTestNode(paths: RuntimePaths): NativeCommandResult {
        return executeNative(
            executable = paths.nodeBin,
            args = listOf("--version"),
            env = mapOf("LD_LIBRARY_PATH" to (paths.usrLibDir.absolutePath + ":" + paths.nativeLibDir.absolutePath)),
            timeoutSeconds = 10L
        )
    }

    fun smokeTestShell(paths: RuntimePaths): NativeCommandResult {
        return executeNative(
            executable = paths.shBin,
            args = listOf("-c", "echo ok"),
            env = mapOf("LD_LIBRARY_PATH" to (paths.usrLibDir.absolutePath + ":" + paths.nativeLibDir.absolutePath)),
            timeoutSeconds = 10L
        )
    }

    fun startIfReady(paths: RuntimePaths, log: (String) -> Unit): Boolean {
        val startScript = File(paths.scriptsDir, "start-server.sh")
        val serverJs = File(paths.serverDir, "server.js")

        if (!paths.nodeBin.exists()) {
            log("Not starting: missing Node runtime: " + paths.nodeBin.absolutePath)
            return false
        }
        if (!startScript.exists()) {
            log("Not starting: missing start script: " + startScript.absolutePath)
            return false
        }
        if (!serverJs.exists()) {
            log("Not starting: missing server.js: " + serverJs.absolutePath)
            return false
        }

        val logFile = File(paths.logsDir, "server.log")
        logFile.parentFile?.mkdirs()

        val builder = ProcessBuilder("/system/bin/sh", startScript.absolutePath)
            .directory(paths.serverDir)
            .redirectErrorStream(true)
            .redirectOutput(ProcessBuilder.Redirect.appendTo(logFile))

        val env = builder.environment()
        env["TARVEN_HOME"] = paths.tarvenHome.absolutePath
        env["TARVEN_BOOTSTRAP"] = paths.bootstrapDir.absolutePath
        env["TARVEN_SERVER_DIR"] = paths.serverDir.absolutePath
        env["TARVEN_USR"] = paths.usrDir.absolutePath
        env["TARVEN_TMP"] = paths.tmpDir.absolutePath
        env["TARVEN_NATIVE_LIB_DIR"] = paths.nativeLibDir.absolutePath
        env["TARVEN_NODE"] = paths.nodeBin.absolutePath
        env["TARVEN_SH"] = paths.shBin.absolutePath
        env["TARVEN_GIT"] = paths.gitBin.absolutePath
        env["TARVEN_GIT_REMOTE_HTTP"] = paths.gitRemoteHttpBin.absolutePath
        env["TARVEN_CURL"] = paths.curlBin.absolutePath
        env["HOST"] = "127.0.0.1"
        env["PORT"] = "8000"

        log("Starting server, log: " + logFile.absolutePath)
        serverProcess = builder.start()
        return true
    }

    fun stop() {
        serverProcess?.destroy()
        serverProcess = null
    }

    private class StreamCollector(private val inputStream: java.io.InputStream) : Runnable {
        private val builder = StringBuilder()

        override fun run() {
            try {
                BufferedReader(InputStreamReader(inputStream, StandardCharsets.UTF_8)).use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        if (builder.length < 24 * 1024) {
                            builder.append(line).append(System.lineSeparator())
                        }
                    }
                }
            } catch (_: Exception) {
                // Stream closed
            }
        }

        fun getText(): String = builder.toString()
    }
}
