package com.tarven.plus

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import com.tarven.plus.runtime.RuntimePaths
import com.tarven.plus.runtime.RuntimeFileUtils
import com.tarven.plus.runtime.TarvenProcessRunner
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var webView: WebView
    private lateinit var statusText: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var runner: TarvenProcessRunner
    private var serverStarted = false

    companion object {
        private const val TAG = "Tarven++"
        // Release URL for server-source.zip (with pre-installed node_modules)
        private const val SERVER_SOURCE_URL =
            "https://github.com/YOUR_USER/TarvenPlus/releases/latest/download/server-source.zip"
        private val MATCH_PARENT = ViewGroup.LayoutParams.MATCH_PARENT
        private val WRAP_CONTENT = ViewGroup.LayoutParams.WRAP_CONTENT
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        runner = TarvenProcessRunner()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.BLACK)
        }

        statusText = TextView(this).apply {
            setTextColor(Color.parseColor("#CCCCCC"))
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(32, 12, 32, 12)
            text = "Tarven++"
        }

        progressBar = ProgressBar(this).apply {
            isIndeterminate = true
        }

        val loadingPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            addView(statusText, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
            addView(progressBar, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
        }

        webView = WebView(this).apply {
            visibility = View.GONE
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = false
                databaseEnabled = true
                setSupportZoom(true)
                builtInZoomControls = true
                displayZoomControls = false
                loadWithOverviewMode = true
                useWideViewPort = true
                mediaPlaybackRequiresUserGesture = false
            }
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    progressBar.visibility = View.GONE
                    statusText.visibility = View.GONE
                    webView.visibility = View.VISIBLE
                }
            }
        }

        root.addView(loadingPanel, LinearLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT, 1f))
        root.addView(webView, LinearLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT, 1f))
        setContentView(root)

        startChain()
    }

    private fun startChain() {
        android.util.Log.i(TAG, "startChain: begin")
        Thread {
            val paths = RuntimePaths.from(this)
            paths.ensureDirs()

            // Step 1: Extract runtime libs from assets
            setStatus("Preparing runtime...")
            android.util.Log.i(TAG, "Extracting runtime libs...")
            try {
                RuntimeFileUtils.unzipAsset(this, "bootstrap/rootfs/rootfs-libs.zip", paths.usrDir)
                RuntimeFileUtils.copyAsset(this, "bootstrap/scripts/start-server.sh",
                    File(paths.scriptsDir, "start-server.sh"))
                RuntimeFileUtils.chmodExecutable(File(paths.scriptsDir, "start-server.sh"))
            } catch (e: Exception) {
                // Runtime already extracted, continue
            }

            // Step 2: Check if server already downloaded
            val serverJs = File(paths.serverDir, "server.js")
            val serverZip = File(paths.tarvenHome, "server-source.zip")

            if (!serverJs.isFile) {
                setStatus("Downloading SillyTavern...")
                val ok = downloadServer(serverZip)
                if (!ok) {
                    post { setStatus("Download failed. Check connection and restart.") }
                    return@Thread
                }

                setStatus("Extracting SillyTavern...")
                try {
                    RuntimeFileUtils.unzipStream(serverZip.inputStream(), paths.serverDir)
                    serverZip.delete()
                } catch (e: Exception) {
                    post { setStatus("Extraction failed: " + e.message) }
                    return@Thread
                }
            }

            if (!serverJs.isFile) {
                post { setStatus("server.js not found after extraction.") }
                return@Thread
            }

            // Write config
            setStatus("Configuring...")
            try {
                File(paths.serverDir, "config.yaml").writeText(
                    "listen: false\nprotocol:\n  ipv4: true\n  ipv6: false\n" +
                    "whitelistMode: false\nbrowserLaunch:\n  enabled: false\n" +
                    "dataRoot: ./data\nport: 8000\n"
                )
            } catch (_: Exception) {}

            // Step 3: Start server
            setStatus("Starting server...")
            if (!startServer(paths)) {
                post { setStatus("Server failed to start. Restart app.") }
                return@Thread
            }
            serverStarted = true

            // Step 6: Poll and load
            setStatus("Waiting for server...")
            pollUntilReady()
        }.start()
    }

    private fun downloadServer(dest: File): Boolean {
        android.util.Log.i(TAG, "Downloading from $SERVER_SOURCE_URL")
        return try {
            val conn = URL(SERVER_SOURCE_URL).openConnection() as HttpURLConnection
            conn.connectTimeout = 15000
            conn.readTimeout = 30000
            conn.setRequestProperty("User-Agent", "Tarven++/0.2")

            val total = conn.contentLengthLong
            android.util.Log.i(TAG, "Content-Length: $total")
            val input = BufferedInputStream(conn.inputStream)
            val output = FileOutputStream(dest)
            val buf = ByteArray(65536)
            var downloaded = 0L
            var len: Int

            while (input.read(buf).also { len = it } != -1) {
                output.write(buf, 0, len)
                downloaded += len
                if (total > 0 && downloaded % (5 * 1024 * 1024) < buf.size) {
                    val pct = downloaded * 100 / total
                    android.util.Log.i(TAG, "Download progress: $pct%")
                    post { setStatus("Downloading SillyTavern... $pct%") }
                }
            }
            output.close()
            input.close()
            conn.disconnect()
            android.util.Log.i(TAG, "Download complete: ${dest.length()} bytes")
            true
        } catch (e: Exception) {
            dest.delete()
            android.util.Log.e(TAG, "Download failed", e)
            false
        }
    }



    private fun startServer(paths: RuntimePaths): Boolean {
        val startScript = File(paths.scriptsDir, "start-server.sh")
        if (!paths.nodeBin.exists() || !startScript.exists()) return false

        val logFile = File(paths.logsDir, "server.log")
        logFile.parentFile?.mkdirs()

        try {
            val pb = ProcessBuilder("/system/bin/sh", startScript.absolutePath)
            pb.directory(paths.serverDir)
            pb.redirectErrorStream(true)
            pb.redirectOutput(ProcessBuilder.Redirect.appendTo(logFile))

            val env = pb.environment()
            env["TARVEN_HOME"] = paths.tarvenHome.absolutePath
            env["TARVEN_BOOTSTRAP"] = paths.bootstrapDir.absolutePath
            env["TARVEN_SERVER_DIR"] = paths.serverDir.absolutePath
            env["TARVEN_USR"] = paths.usrDir.absolutePath
            env["TARVEN_TMP"] = paths.tmpDir.absolutePath
            env["TARVEN_NATIVE_LIB_DIR"] = paths.nativeLibDir.absolutePath
            env["TARVEN_NODE"] = paths.nodeBin.absolutePath
            env["HOST"] = "127.0.0.1"
            env["PORT"] = "8000"

            pb.start()
            return true
        } catch (_: Exception) {
            return false
        }
    }

    private fun pollUntilReady() {
        val url = "http://127.0.0.1:8000/"
        var attempts = 0
        while (attempts < 120) {
            if (tryConnect(url)) {
                post {
                    setStatus("Loading...")
                    webView.loadUrl(url)
                }
                return
            }
            attempts++
            try { Thread.sleep(1000) } catch (_: Exception) { break }
        }
        post { setStatus("Server did not respond. Restart app.") }
    }

    private fun tryConnect(url: String): Boolean {
        return try {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 3000
            conn.readTimeout = 3000
            conn.requestMethod = "GET"
            conn.responseCode in 200..499
        } catch (_: Exception) { false }
    }

    private fun setStatus(text: String) {
        mainHandler.post { statusText.text = text }
    }

    private fun post(r: Runnable) { mainHandler.post(r) }

    override fun onDestroy() {
        if (serverStarted) runner.stop()
        webView.destroy()
        super.onDestroy()
    }
}
