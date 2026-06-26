package com.tarven.plus

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PorterDuff
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.PixelCopy
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.tarven.plus.runtime.RuntimePaths
import com.tarven.plus.runtime.RuntimeFileUtils
import com.tarven.plus.runtime.TarvenProcessRunner
import com.tarven.plus.ui.FloatingControlCenter
import com.tarven.plus.ui.SplashOverlay
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {

    private val handler = Handler(Looper.getMainLooper())

    // ---- Views ----
    private lateinit var root: FrameLayout
    private lateinit var homeScroll: android.widget.ScrollView
    private lateinit var homeScreen: LinearLayout
    private lateinit var webViewScreen: FrameLayout
    private lateinit var webView: WebView

    // Dashboard card indicators
    private lateinit var nodeDot: View
    private lateinit var nodeLabel: TextView
    private lateinit var libsDot: View
    private lateinit var libsLabel: TextView
    private lateinit var serverDot: View
    private lateinit var serverLabel: TextView
    private lateinit var versionLabel: TextView

    private lateinit var statusText: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var startButton: TextView
    private lateinit var fixButton: TextView

    private lateinit var splash: SplashOverlay
    private lateinit var floatingControl: FloatingControlCenter

    // ---- State ----
    private lateinit var runner: TarvenProcessRunner
    private var serverReady = false
    private var isWebViewVisible = false
    private var statusBarFixedPx = 0  // fixed physical pixels, never changes

    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

    companion object {
        private const val TAG = "Tarven++"
        private const val SERVER_SOURCE_URL =
            "https://github.com/CAPTCHAAAAA/TarvenPlus/releases/download/v0.2/server-source.zip"
        private const val TAVERN_URL = "http://127.0.0.1:8000/"
        private val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
        private val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT

        // Premium dark/pink palette (Tarven++ brand)
        private const val BG = 0xFF070408.toInt()
        private const val SURFACE = 0xFF1A1418.toInt()
        private const val PINK = 0xFFFF4FA9.toInt()
        private const val PINK_DIM = 0xFFFF87C8.toInt()
        private const val GOLD = 0xFFC8A96E.toInt()
        private const val TEXT = 0xFFFFF3FB.toInt()
        private const val TEXT_MUTED = 0xFFB7A7B6.toInt()
        private const val TEXT_DIM = 0xFF6B5E55.toInt()
        private const val GREEN = 0xFF72EFBE.toInt()
        private const val LINE = 0x1AFFFFFF
        private const val STATE_SERVER_READY = "server_ready"
        private const val STATE_WEBVIEW_VISIBLE = "webview_visible"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // ╔══════════════════════════════════════════════════════════════╗
        // ║  DO NOT CHANGE — Fullscreen immersion foundation.           ║
        // ║  These 4 lines are the result of 2 weeks of trial-and-error ║
        // ║  against MIUI/HyperOS window state machines.                ║
        // ║  - setDecorFitsSystemWindows(false): content behind bars    ║
        // ║  - SHORT_EDGES: tell MIUI "we own the cutout, don't push"  ║
        // ║  - statusBarFixedPx: from hardware DisplayCutout (116px),   ║
        // ║    NEVER from software insets (they lie).                   ║
        // ║  - CONSUMED insets: WebView never sees layout shifts.        ║
        // ╚══════════════════════════════════════════════════════════════╝
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        runner = TarvenProcessRunner()
        statusBarFixedPx = readStatusBarFixedPx() // hardware truth, never 0

        val wasServerReady = savedInstanceState?.getBoolean(STATE_SERVER_READY, false) ?: false
        val wasWebViewVisible = savedInstanceState?.getBoolean(STATE_WEBVIEW_VISIBLE, false) ?: false

        // ---- Root ----
        root = FrameLayout(this).apply { setBackgroundColor(BG) }

        // ---- Ambient orbs (decorative, safe to modify) ----
        addOrb(root, 0xFF4FA9, 0.28f, -18f, -14f, 46f)
        addOrb(root, 0x8D5CFF, 0.16f, 82f, 18f, 40f)

        // ╔══════════════════════════════════════════════════════════════╗
        // ║  DO NOT CHANGE — Inset sterilization.                       ║
        // ║  Consuming insets here prevents the WebView from ever       ║
        // ║  seeing a layout shift when MIUI hides/shows system bars.   ║
        // ║  Without this, Chromium re-renders on every bar toggle.     ║
        // ╚══════════════════════════════════════════════════════════════╝
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val navBars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            homeScreen.setPadding(dp(28), dp(36) + statusBarFixedPx, dp(28), dp(36) + navBars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        // ============================================
        // HOME SCREEN
        // ============================================
        homeScreen = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(28), dp(36), dp(28), dp(36))
        }

        // Spacer top
        homeScreen.addView(spacer(dp(40)))

        // Logo mark
        val logoSize = dp(88)
        val logoDrawable = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(22).toFloat()
            colors = intArrayOf(PINK, 0xFF8D5CFF.toInt())
            orientation = GradientDrawable.Orientation.TL_BR
        }
        val logoView = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_compass)
            setColorFilter(GOLD, PorterDuff.Mode.SRC_IN)
            val p = dp(22)
            setPadding(p, p, p, p)
            background = logoDrawable
            val lp = LinearLayout.LayoutParams(logoSize, logoSize)
            lp.gravity = Gravity.CENTER
            layoutParams = lp
        }
        homeScreen.addView(logoView)

        // Title
        homeScreen.addView(textView("Tarven++", dp(28), TEXT, true).apply {
            setPadding(0, dp(22), 0, dp(4))
        })
        // Subtitle
        homeScreen.addView(textView("SillyTavern for Android", dp(13), TEXT_MUTED, false).apply {
            setPadding(0, 0, 0, dp(36))
        })

        // ═══════════════════════════════════════════
        // DASHBOARD CARDS
        // ═══════════════════════════════════════════

        // Node.js Runtime card
        val nodeCard = infoCard(
            "Node.js Runtime", "Checking...",
            "libtarven-node.so", PINK_DIM
        ).also { (card, dot, label) ->
            nodeDot = dot; nodeLabel = label; homeScreen.addView(card)
        }
        homeScreen.addView(spacer(dp(10)))

        // Bionic Libraries card
        val libsCard = infoCard(
            "Bionic Libraries", "Checking...",
            "usr/lib/", PINK_DIM
        ).also { (card, dot, label) ->
            libsDot = dot; libsLabel = label; homeScreen.addView(card)
        }
        homeScreen.addView(spacer(dp(10)))

        // SillyTavern Server card
        val serverCard = infoCard(
            "SillyTavern Server", "Not started",
            "127.0.0.1:8000", PINK_DIM
        ).also { (card, dot, label) ->
            serverDot = dot; serverLabel = label; homeScreen.addView(card)
        }
        homeScreen.addView(spacer(dp(10)))

        // Version info card
        versionLabel = textView("Tarven++ v0.5  |  Node v24.17.0", dp(11), TEXT_DIM, false).apply {
            gravity = Gravity.START
            setPadding(dp(18), dp(10), dp(18), dp(4))
        }
        val verCard = card().apply {
            addView(versionLabel)
        }
        homeScreen.addView(verCard)
        homeScreen.addView(spacer(dp(16)))

        // Progress bar
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            progressTintList = android.content.res.ColorStateList.valueOf(PINK)
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.argb(18, 255, 255, 255))
            isIndeterminate = false
            max = 100
            progress = 0
            val lp = LinearLayout.LayoutParams(MATCH, dp(3))
            lp.setMargins(dp(18), 0, dp(18), dp(8))
            layoutParams = lp
        }
        homeScreen.addView(progressBar)

        statusText = textView("Ready", dp(12), TEXT_MUTED, false).apply {
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(6))
        }
        homeScreen.addView(statusText)

        // Fix & Enter buttons row
        val btnRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(12), 0, dp(12), 0)
        }
        fixButton = pillButton("DIAGNOSE & FIX", GOLD, TEXT).apply {
            setOnClickListener { runDiagnostics() }
            val lp = LinearLayout.LayoutParams(0, WRAP, 1f)
            lp.rightMargin = dp(8)
            layoutParams = lp
        }
        btnRow.addView(fixButton)

        startButton = pillButton("ENTER", PINK, TEXT).apply {
            isEnabled = false
            alpha = 0.45f
            setOnClickListener { enterTavern() }
            val lp = LinearLayout.LayoutParams(0, WRAP, 1f)
            lp.leftMargin = dp(8)
            layoutParams = lp
        }
        btnRow.addView(startButton)
        homeScreen.addView(btnRow)

        // Version
        homeScreen.addView(textView("v0.5-dev", dp(11), TEXT_DIM, false).apply {
            setPadding(0, dp(12), 0, 0)
        })

        homeScroll = android.widget.ScrollView(this).apply {
            addView(homeScreen, FrameLayout.LayoutParams(MATCH, WRAP))
            setVerticalScrollBarEnabled(false)
        }
        root.addView(homeScroll, FrameLayout.LayoutParams(MATCH, MATCH))

        // ============================================
        // WEBVIEW SCREEN
        // ============================================
        webViewScreen = FrameLayout(this).apply {
            visibility = View.GONE
            setBackgroundColor(BG)
        }

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                settings.forceDark = android.webkit.WebSettings.FORCE_DARK_AUTO
            }
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(v: WebView?, url: String?) {
                    super.onPageFinished(v, url)
                    android.util.Log.i(TAG, "Page loaded: $url")
                    installChameleonProbes()
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowCustomView(v: View?, cb: CustomViewCallback?) {
                    fullscreenView?.let { root.removeView(it) }
                    fullscreenView = v
                    fullscreenCallback = cb
                    v?.let {
                        root.addView(it, FrameLayout.LayoutParams(MATCH, MATCH))
                        webViewScreen.visibility = View.GONE
                    }
                }
                override fun onHideCustomView() {
                    exitFullscreen()
                }
            }
        }

        webViewScreen.addView(webView, FrameLayout.LayoutParams(MATCH, MATCH))
        root.addView(webViewScreen, FrameLayout.LayoutParams(MATCH, MATCH))

        setContentView(root)

        // ---- Splash (minimal: dark + LED + progress) ----
        splash = SplashOverlay(this)
        splash.attachTo(root)
        splash.setLedColor(SplashOverlay.LED_CHECKING)

        // ---- Floating control center ----
        floatingControl = FloatingControlCenter(this)
        floatingControl.setCallback(object : FloatingControlCenter.Callback {
            override fun onRefresh() { webView.reload() }
            override fun onSettings() { /* TODO: open settings */ }
            override fun onExit() { exitTavern() }
        })

        // Codex++ entrance: fade + micro-scale
        homeScroll.alpha = 0f
        homeScroll.translationY = dp(10).toFloat()
        homeScroll.scaleX = 0.992f
        homeScroll.scaleY = 0.992f
        homeScreen.scaleY = 0.992f

        // Restore or init
        if (wasWebViewVisible && wasServerReady) {
            serverReady = true
            webView.loadUrl(TAVERN_URL)
            splash.fadeOut {
                switchToWebView(false)
                homeScroll.visibility = View.GONE
                enterImmersive()
                floatingControl.attach(root, statusBarFixedPx)
                floatingControl.setStatus(FloatingControlCenter.LED_OK)
            }
            setStatus("Ready")
            setStatusDot(GREEN)
            startButton.isEnabled = true
            startButton.alpha = 1f
        } else if (wasServerReady) {
            serverReady = true
            splash.fadeOut {
                homeScroll.animate().alpha(1f).translationY(0f).scaleX(1f).scaleY(1f)
                    .setDuration(260).setInterpolator(OvershootInterpolator(0.9f)).start()
            }
            updateHomeReady()
        } else {
            provisionAndStart(wasServerReady)
        }
    }

    override fun onResume() {
        super.onResume()
        if (!isWebViewVisible) showSystemBars()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(STATE_SERVER_READY, serverReady)
        outState.putBoolean(STATE_WEBVIEW_VISIBLE, isWebViewVisible)
    }

    private fun provisionAndStart(skipIfExists: Boolean) {
        Thread {
            val paths = RuntimePaths.from(this)
            paths.ensureDirs()

            val serverJs = File(paths.serverDir, "server.js")
            val hasServer = serverJs.exists()

            if (!hasServer) {
                setStatus("Provisioning...")
                setProgress(0)
                splash.setStatus("Provisioning...")
                splash.setLedColor(SplashOverlay.LED_PREP)

                // Extract native libs from APK
                extractNativeLibs(paths)
                updateProgress(15)

                // Download server source
                val ok = downloadAndExtractServer(paths)
                updateProgress(100)
                if (!ok) {
                    setStatus("Download failed")
                    splash.setStatus("Download failed")
                    splash.setLedColor(SplashOverlay.LED_FAILED)
                    return@Thread
                }
                splash.setLedColor(SplashOverlay.LED_OK)
                setStatusDot(GREEN)
            } else {
                splash.setLedColor(SplashOverlay.LED_OK)
                setStatusDot(GREEN)
            }

            // Start server
            setStatus("Starting server...")
            splash.setStatus("Starting server...")
            splash.setLedColor(SplashOverlay.LED_CHECKING)
            val started = startServer(paths)
            if (!started) {
                setStatus("Start failed")
                splash.setStatus("Start failed")
                splash.setLedColor(SplashOverlay.LED_FAILED)
                return@Thread
            }

            pollUntilReady()
        }.start()
    }

    private fun updateHomeReady() {
        post {
            setStatus("Ready")
            setStatusDot(GREEN)
            progressBar.progress = 100
            startButton.apply {
                isEnabled = true
                alpha = 1f
                if (text != "ENTER TAVERN") text = "ENTER TAVERN"
            }
        }
    }

    /**
     * ╔══════════════════════════════════════════════════════════════════╗
     * ║  DO NOT CHANGE the layout strategy.                              ║
     * ║  We manually push WebView down by statusBarHeight so the top    ║
     * ║  band is free for our info bar. This is intentional — we do NOT ║
     * ║  rely on system insets (they change to 0 in immersive and break ║
     * ║  everything on MIUI). The fixed topMargin + consumed insets     ║
     * ║  combo is the only stable approach found for HyperOS.           ║
     * ╚══════════════════════════════════════════════════════════════════╝
     */
    private fun runDiagnostics() {
        setStatus("Running diagnostics...")
        progressBar.progress = 0
        Thread {
            val paths = RuntimePaths.from(this)
            // 1. Node binary
            val nodeOk = paths.nodeBin.exists()
            post { setDot(nodeDot, if (nodeOk) GREEN else 0xFFEF4444.toInt())
                nodeLabel.text = if (nodeOk) "Node v24.17.0 ready" else "Binary missing!" }
            updateProgress(30)
            // 2. Bionic libs
            val libCount = paths.usrLibDir.listFiles()?.size ?: 0
            post { val ok = libCount > 50; setDot(libsDot, if (ok) GREEN else 0xFFEF4444.toInt())
                libsLabel.text = if (ok) "$libCount libs loaded" else "$libCount libs — need rootfs" }
            updateProgress(60)
            // 3. Server source
            val serverJs = File(paths.serverDir, "server.js")
            val serverOk = serverJs.exists() && File(paths.serverDir, "node_modules").isDirectory
            post { setDot(serverDot, if (serverOk) GREEN else 0xFFEF4444.toInt())
                serverLabel.text = if (serverOk) "Server source ready" else "Server source missing!" }
            updateProgress(80)
            // 4. Fix if needed
            if (!nodeOk || libCount < 50 || !serverOk) {
                post { setStatus("Issues found — fixing...") }
                if (libCount < 50) try {
                    paths.usrDir.mkdirs()
                    assets.open("bootstrap/rootfs/rootfs-libs.zip").use { RuntimeFileUtils.unzipStream(it, paths.usrDir) }
                    val n = paths.usrLibDir.listFiles()?.size ?: 0
                    post { setDot(libsDot, if (n > 50) GREEN else 0xFFEF4444.toInt())
                        libsLabel.text = "$n libs (re-extracted)" }
                } catch (_: Exception) { post { libsLabel.text = "Extraction failed" } }
            }
            // 5. HTTP check
            val httpOk = tryConnect(TAVERN_URL)
            post {
                if (httpOk) { setDot(serverDot, GREEN); serverLabel.text = "127.0.0.1:8000 — online" }
                setStatus(if (httpOk) "All systems ready" else "Check complete — tap ENTER to start")
                if (httpOk) { serverReady = true; startButton.isEnabled = true; startButton.alpha = 1f }
                progressBar.progress = 100
            }
        }.start()
    }

    private fun enterTavern() {
        if (!serverReady || isWebViewVisible) return
        if (webView.url == null || webView.url.isNullOrBlank()) {
            webView.loadUrl(TAVERN_URL)
        }
        val h = statusBarFixedPx
        val lp = webViewScreen.layoutParams as FrameLayout.LayoutParams
        lp.topMargin = h
        webViewScreen.layoutParams = lp
        enterImmersive()
        switchToWebView(true)
        // Exclude left + right edges from system back gesture (API 29+)
        excludeSystemGestures()
        handler.postDelayed({
            floatingControl.attach(root, h)
            floatingControl.setStatus(FloatingControlCenter.LED_OK, "Tavern")
        }, 500)
    }

    private fun exitTavern() {
        if (!isWebViewVisible) return
        floatingControl.hide()
        showSystemBars()
        // Restore system gesture handling
        clearSystemGestureExclusions()
        val lp = webViewScreen.layoutParams as FrameLayout.LayoutParams
        lp.topMargin = 0
        webViewScreen.layoutParams = lp
        switchToHome(true)
    }

    /** Prevent system back gesture from intercepting edge touches inside the WebView. */
    private fun excludeSystemGestures() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        webView.post {
            val w = webView.width; if (w <= 0) return@post
            val h = webView.height; if (h <= 0) return@post
            val band = dp(36) // exclude ~36dp from each vertical edge
            webView.systemGestureExclusionRects = listOf(
                Rect(0, 0, band, h),            // left edge
                Rect(w - band, 0, w, h)         // right edge
            )
        }
    }

    private fun clearSystemGestureExclusions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            webView.systemGestureExclusionRects = emptyList()
        }
    }

    private fun switchToWebView(animate: Boolean) {
        isWebViewVisible = true
        if (animate) {
            homeScroll.animate().alpha(0f).setDuration(200).withEndAction {
                homeScroll.visibility = View.GONE
                webViewScreen.visibility = View.VISIBLE
                webViewScreen.alpha = 0f
                webViewScreen.animate().alpha(1f).setDuration(220).start()
            }.start()
        } else {
            homeScroll.visibility = View.GONE
            webViewScreen.visibility = View.VISIBLE
            webViewScreen.alpha = 1f
        }
    }

    private fun switchToHome(animate: Boolean) {
        isWebViewVisible = false
        if (animate) {
            webViewScreen.animate().alpha(0f).setDuration(200).withEndAction {
                webViewScreen.visibility = View.GONE
                homeScroll.visibility = View.VISIBLE
                homeScroll.alpha = 0f
                homeScroll.animate().alpha(1f).setDuration(220).start()
            }.start()
        } else {
            webViewScreen.visibility = View.GONE
            homeScroll.visibility = View.VISIBLE
            homeScroll.alpha = 1f
        }
    }

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  DO NOT CHANGE — Immersive hide/show.                           ║
    // ║  API 30+: WindowInsetsController (modern, clean).                ║
    // ║  API 26-29: SYSTEM_UI_FLAG_IMMERSIVE_STICKY (proven fallback).  ║
    // ║  DO NOT mix old and new APIs — Android 15+ has a concurrency    ║
    // ║  bug in ClientWindowFrames when both are active simultaneously. ║
    // ╚══════════════════════════════════════════════════════════════════╝
    @Suppress("DEPRECATION")
    private fun enterImmersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                controller.hide(WindowInsets.Type.systemBars())
            }
        } else {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        }
    }

    @Suppress("DEPRECATION")
    private fun showSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.show(WindowInsets.Type.systemBars())
        } else {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
        }
    }

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  DO NOT REMOVE — MIUI re-immersive guard.                       ║
    // ║  MIUI forcibly shows system bars after notification shade pull,  ║
    // ║  recents, or screen rotation. This callback re-hides them.      ║
    // ╚══════════════════════════════════════════════════════════════════╝
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && isWebViewVisible) {
            enterImmersive()
        }
    }

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  DO NOT CHANGE — Adaptive color extraction (Route A: PixelCopy). ║
    // ║  Reads 1px from GPU framebuffer 1px below WebView top edge.      ║
    // ╚══════════════════════════════════════════════════════════════════╝
    private fun samplePixelColor(onResult: (Int?) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) { onResult(null); return }
        val loc = IntArray(2)
        webView.getLocationInWindow(loc)
        val sampleX = loc[0] + webView.width / 2
        val sampleY = loc[1] + 1
        val srcRect = Rect(sampleX, sampleY, sampleX + 1, sampleY + 1)
        val bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
        PixelCopy.request(window, srcRect, bitmap, { result ->
            if (result == PixelCopy.SUCCESS) {
                val pixel = bitmap.getPixel(0, 0)
                bitmap.recycle()
                if (pixel != Color.TRANSPARENT && android.graphics.Color.alpha(pixel) > 200) {
                    onResult(pixel)
                } else {
                    onResult(null)
                }
            } else {
                bitmap.recycle()
                onResult(null)
            }
        }, handler)
    }

    /** Delayed probe: 1s after page load, then on every touch-up. */
    private fun installChameleonProbes() {
        handler.postDelayed({
            samplePixelColor { hwColor ->
                if (hwColor != null) floatingControl.setScrimColor(hwColor)
            }
            floatingControl.sweepGlossOver()
        }, 0)
        webView.setOnTouchListener { _, event ->
            if (event.action == MotionEvent.ACTION_UP) {
                handler.postDelayed({
                    samplePixelColor { hwColor ->
                        if (hwColor != null) floatingControl.setScrimColor(hwColor)
                    }
                    floatingControl.sweepGlossOver()
                }, 200)
            }
            false
        }
    }

    private fun exitFullscreen() {
        fullscreenView?.let { root.removeView(it) }
        fullscreenView = null
        fullscreenCallback?.onCustomViewHidden()
        fullscreenCallback = null
        webViewScreen.visibility = View.VISIBLE
    }

    // ============================================
    // SERVER PROVISIONING
    // ============================================

    private fun extractNativeLibs(paths: RuntimePaths) {
        setStatus("Extracting runtime...")
        val nativeDir = paths.nativeLibDir
        val bootstrapDir = paths.bootstrapDir
        bootstrapDir.mkdirs()

        // Extract Bionic system libraries (libz, libssl, libicu etc.) from APK assets
        try {
            paths.usrDir.mkdirs()
            val assetPath = "bootstrap/rootfs/rootfs-libs.zip"
            assets.open(assetPath).use { input ->
                RuntimeFileUtils.unzipStream(input, paths.usrDir)
            }
            android.util.Log.i(TAG, "Rootfs extracted to ${paths.usrDir}")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Rootfs extraction failed", e)
        }

        // Copy native SO files from lib dir to bootstrap for scripts
        val soFiles = listOf(
            "libtarven-sh.so",
            "libtarven-git.so",
            "libtarven-git-remote-http.so",
            "libtarven-curl.so"
        )
        for (so in soFiles) {
            val src = File(nativeDir, so)
            val dst = File(bootstrapDir, so)
            if (src.exists() && !dst.exists()) {
                src.copyTo(dst)
                RuntimeFileUtils.chmodExecutable(dst)
            }
        }
    }

    private fun downloadAndExtractServer(paths: RuntimePaths): Boolean {
        val destZip = File(paths.tarvenHome, "server-source.zip")
        val serverDir = paths.serverDir
        serverDir.mkdirs()

        if (!downloadFile(SERVER_SOURCE_URL, destZip)) return false

        setStatus("Extracting server...")
        splash.setStatus("Extracting server...")
        try {
            destZip.inputStream().use { input ->
                RuntimeFileUtils.unzipStream(input, serverDir)
            }
            destZip.delete()
            return true
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Extract failed", e)
            setStatus("Extract failed")
            splash.setStatus("Extract failed")
            return false
        }
    }

    private fun downloadFile(urlStr: String, dest: File): Boolean {
        return try {
            val conn = URL(urlStr).openConnection() as HttpURLConnection
            conn.connectTimeout = 15000
            conn.readTimeout = 60000
            conn.setRequestProperty("User-Agent", "Tarven++/0.4")
            conn.connect()
            if (conn.responseCode != 200) {
                android.util.Log.e(TAG, "Download HTTP ${conn.responseCode}")
                return false
            }
            val total = conn.contentLengthLong
            val input = BufferedInputStream(conn.inputStream)
            val output = FileOutputStream(dest)
            val buf = ByteArray(65536)
            var dl = 0L
            var len: Int
            while (input.read(buf).also { len = it } != -1) {
                output.write(buf, 0, len)
                dl += len
                if (total > 0 && dl % (5 * 1024 * 1024) < buf.size) {
                    val pct = (dl * 100 / total).toInt()
                    post { progressBar.progress = 15 + (pct * 80 / 100) }
                    val pct2 = pct
                    setStatus("Downloading... $pct2%")
                    splash.setProgress(15 + (pct2 * 80 / 100))
                    splash.setStatus("Downloading... $pct2%")
                }
            }
            output.close()
            input.close()
            conn.disconnect()
            android.util.Log.i(TAG, "Downloaded: ${dest.length()} bytes")
            true
        } catch (e: Exception) {
            dest.delete()
            android.util.Log.e(TAG, "Download failed", e)
            false
        }
    }

    private fun startServer(paths: RuntimePaths): Boolean {
        paths.logsDir.mkdirs()
        // Ensure local xdg-open from open package is executable
        val localXdgOpen = File(paths.serverDir, "node_modules/open/xdg-open")
        if (localXdgOpen.exists()) RuntimeFileUtils.chmodExecutable(localXdgOpen)
        // Create fake xdg-open that exits cleanly — open npm pkg forces system xdg-open on Android
        val fakeXdgDir = File(paths.tmpDir, "bin")
        fakeXdgDir.mkdirs()
        val fakeXdg = File(fakeXdgDir, "xdg-open")
        if (!fakeXdg.exists()) {
            fakeXdg.writeText("#!/system/bin/sh\nexit 0\n")
            RuntimeFileUtils.chmodExecutable(fakeXdg)
        }
        // Patch open package: on Android, use /system/bin/true instead of xdg-open
        val openIndex = File(paths.serverDir, "node_modules/open/index.js")
        if (openIndex.exists()) {
            var patched = openIndex.readText()
            patched = patched.replace(
                "platform === 'android' || isBundled || ",
                "isBundled || ")
            // Force command = '/system/bin/true' on Android
            patched = patched.replace(
                "command = useSystemXdgOpen ? 'xdg-open' : localXdgOpenPath;",
                "command = '/system/bin/true';")
            openIndex.writeText(patched)
        }
        try {
            // Launch directly: node server.js (skip npm install — node_modules is pre-bundled)
            val pb = ProcessBuilder(paths.nodeBin.absolutePath, "server.js")
            pb.directory(paths.serverDir)
            pb.redirectErrorStream(true)
            pb.redirectOutput(ProcessBuilder.Redirect.appendTo(File(paths.logsDir, "server.log")))
            val env = pb.environment()
            env["TARVEN_HOME"] = paths.tarvenHome.absolutePath
            env["TARVEN_USR"] = paths.usrDir.absolutePath
            env["TARVEN_SERVER_DIR"] = paths.serverDir.absolutePath
            env["TARVEN_NODE"] = paths.nodeBin.absolutePath
            env["TARVEN_NATIVE_LIB_DIR"] = paths.nativeLibDir.absolutePath
            env["TARVEN_TMP"] = paths.tmpDir.absolutePath
            env["TARVEN_BOOTSTRAP"] = paths.bootstrapDir.absolutePath
            env["LD_LIBRARY_PATH"] = "${paths.usrDir.absolutePath}/lib:${paths.nativeLibDir.absolutePath}"
            env["AUTO_LAUNCH"] = "false"
            env["NO_BROWSER"] = "true"
            env["BROWSER"] = "/system/bin/true"
            env["PATH"] = "${paths.tmpDir.absolutePath}/bin:/system/bin:${System.getenv("PATH") ?: ""}"
            env["HOST"] = "127.0.0.1"
            env["PORT"] = "8000"
            pb.start()
            return true
        } catch (_: Exception) {
            return false
        }
    }

    private fun pollUntilReady() {
        var a = 0
        while (a < 120) {
            if (tryConnect(TAVERN_URL)) {
                serverReady = true
                splash.setLedColor(SplashOverlay.LED_OK)
                updateHomeReady()
                // Fade splash → reveal home with entrance animation
                post {
                    splash.fadeOut {
                        homeScroll.animate().alpha(1f).translationY(0f).scaleX(1f).scaleY(1f)
                            .setDuration(260).setInterpolator(OvershootInterpolator(0.9f)).start()
                    }
                }
                return
            }
            a++
            try { Thread.sleep(1000) } catch (_: Exception) { break }
        }
        setStatus("No response")
        splash.setStatus("No response")
        splash.setLedColor(SplashOverlay.LED_FAILED)
    }

    private fun tryConnect(url: String) = try {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 3000
        c.readTimeout = 3000
        c.responseCode in 200..499
    } catch (_: Exception) { false }

    // ============================================
    // HELPERS
    // ============================================

    private fun setDot(dot: View, color: Int) {
        post { (dot.background as GradientDrawable).setColor(color) }
    }

    private fun setStatus(t: String) { post { statusText.text = t } }
    private fun setStatusDot(color: Int) { setDot(serverDot, color) }

    // ---- Dashboard card builder ----
    private fun infoCard(
        title: String, subtitle: String, path: String, dotColor: Int
    ): Triple<FrameLayout, View, TextView> {
        val c = card()
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(12))
        }
        // dot + title row
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val dot = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL; setSize(dp(8), dp(8)); setColor(dotColor)
            }
            val lp = LinearLayout.LayoutParams(dp(8), dp(8)); lp.rightMargin = dp(8)
            layoutParams = lp
        }
        row.addView(dot)
        val titleTv = textView(title, dp(13), TEXT, true).apply {
            gravity = Gravity.START or Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, WRAP, 1f)
        }
        row.addView(titleTv)
        layout.addView(row)
        // subtitle
        val subTv = textView(subtitle, dp(10), TEXT_MUTED, false).apply {
            gravity = Gravity.START
            setPadding(dp(16), dp(2), 0, 0)
        }
        layout.addView(subTv)
        // path
        val pathTv = textView(path, dp(9), TEXT_DIM, false).apply {
            gravity = Gravity.START
            setPadding(dp(16), dp(1), 0, 0)
            maxLines = 1
        }
        layout.addView(pathTv)
        c.addView(layout)
        return Triple(c, dot, subTv)
    }
    private fun updateProgress(pct: Int) { post { progressBar.progress = pct } }
    private fun post(r: Runnable) { handler.post(r) }
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    /**
     * Hardware radar: read the physical camera cutout height — never lies, never changes.
     * Fallback: system status_bar_height resource → 24dp absolute last-resort.
     */
    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  DO NOT CHANGE this read chain.                                 ║
    // ║  Priority: DisplayCutout (hardware, burned at factory) →         ║
    // ║  status_bar_height resource → 24dp fallback.                     ║
    // ║  NEVER use WindowInsets for status bar height — they report 0   ║
    // ║  when the bar is hidden, breaking all layout calculations.       ║
    // ║  The camera cutout is part of the phone glass. It doesn't care  ║
    // ║  whether Android thinks the status bar is visible.               ║
    // ╚══════════════════════════════════════════════════════════════════╝
    private fun readStatusBarFixedPx(): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val cutout = window.decorView.rootWindowInsets?.displayCutout
            if (cutout != null) {
                val h = cutout.safeInsetTop
                if (h > 0) return h
            }
        }
        val id = resources.getIdentifier("status_bar_height", "dimen", "android")
        if (id > 0) return resources.getDimensionPixelSize(id)
        return dp(24)
    }

    private fun statusBarHeight() = statusBarFixedPx

    private fun textView(t: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        text = t
        textSize = size.toFloat()
        setTextColor(color)
        gravity = Gravity.CENTER
        if (bold) paint.isFakeBoldText = true
    }

    private fun pillButton(t: String, borderColor: Int, textColor: Int) = TextView(this).apply {
        text = t
        textSize = 15f
        setTextColor(textColor)
        gravity = Gravity.CENTER
        setPadding(dp(52), dp(14), dp(52), dp(14))
        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(26).toFloat()
            setStroke(dp(2), borderColor)
            setColor(0x0DFFFFFF)
        }
        val lp = LinearLayout.LayoutParams(WRAP, WRAP)
        lp.gravity = Gravity.CENTER
        layoutParams = lp
    }

    private fun spacer(h: Int) = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(MATCH, h)
    }

    private fun card() = FrameLayout(this).apply {
        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(24).toFloat()
            setColor(SURFACE)
            setStroke(dp(1), LINE)
        }
        val lp = LinearLayout.LayoutParams(MATCH, WRAP)
        lp.setMargins(0, 0, 0, 0)
        layoutParams = lp
    }

    private fun addOrb(root: FrameLayout, colorHex: Int, opacity: Float, xPct: Float, yPct: Float, sizePct: Float) {
        val orb = View(this).apply {
            val orbColor = Color.argb(
                (255 * opacity).toInt(),
                Color.red(colorHex),
                Color.green(colorHex),
                Color.blue(colorHex)
            )
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(orbColor)
            }
        }
        val screenW = resources.displayMetrics.widthPixels
        val screenH = resources.displayMetrics.heightPixels
        val size = ((screenW.coerceAtLeast(screenH) * sizePct) / 100).toInt()
        val lp = FrameLayout.LayoutParams(size, size)
        lp.gravity = Gravity.TOP or Gravity.START
        lp.leftMargin = ((screenW * xPct) / 100).toInt()
        lp.topMargin = ((screenH * yPct) / 100).toInt()
        orb.layoutParams = lp
        root.addView(orb)
    }

    override fun onBackPressed() {
        if (fullscreenView != null) exitFullscreen()
        else if (isWebViewVisible) {
            if (webView.canGoBack()) webView.goBack() else exitTavern()
        } else super.onBackPressed()
    }

    override fun onDestroy() {
        if (serverReady) runner.stop()
        webView.destroy()
        super.onDestroy()
    }
}
