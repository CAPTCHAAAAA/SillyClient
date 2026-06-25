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
import android.view.PixelCopy
import android.view.Gravity
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
    private lateinit var homeScreen: LinearLayout
    private lateinit var webViewScreen: FrameLayout
    private lateinit var webView: WebView
    private lateinit var statusText: TextView
    private lateinit var statusDot: View
    private lateinit var progressBar: ProgressBar
    private lateinit var startButton: TextView

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

        // Status card (glass-style)
        val statusCard = card()
        val statusCardLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(16))
        }

        // Status row: dot + text
        val statusRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        statusDot = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setSize(dp(9), dp(9))
                setColor(PINK_DIM)
            }
            val lp = LinearLayout.LayoutParams(dp(9), dp(9))
            lp.rightMargin = dp(10)
            layoutParams = lp
        }
        statusRow.addView(statusDot)

        statusText = textView("Preparing...", dp(14), TEXT_MUTED, false).apply {
            gravity = Gravity.START or Gravity.CENTER_VERTICAL
        }
        statusRow.addView(statusText)
        statusCardLayout.addView(statusRow)

        // Progress bar
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            progressDrawable = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(3).toFloat()
                setColor(PINK)
            }.let { it }
            isIndeterminate = false
            max = 100
            progress = 0
            setPadding(0, dp(12), 0, dp(8))
        }
        // Override progress color
        progressBar.progressTintList = android.content.res.ColorStateList.valueOf(PINK)
        progressBar.progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.argb(18, 255, 255, 255))
        statusCardLayout.addView(progressBar)

        statusCard.addView(statusCardLayout)
        homeScreen.addView(statusCard)

        // Spacer
        homeScreen.addView(spacer(dp(28)))

        // ENTER TAVERN button
        startButton = pillButton("ENTER TAVERN", PINK, TEXT).apply {
            isEnabled = false
            alpha = 0.45f
            setOnClickListener { enterTavern() }
        }
        homeScreen.addView(startButton)

        // Version
        homeScreen.addView(textView("v0.4", dp(11), TEXT_DIM, false).apply {
            setPadding(0, dp(16), 0, 0)
        })

        root.addView(homeScreen, FrameLayout.LayoutParams(MATCH, MATCH))

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

            // ╔══════════════════════════════════════════════════════════╗
            // ║  TarvenThemeBridge — JS→Kotlin color push. DO NOT RENAME.║
            // ║  Route B (JS sentinel) pushes via pushThemeColor().      ║
            // ║  If color is null/transparent → Route A (PixelCopy).     ║
            // ╚══════════════════════════════════════════════════════════╝
            addJavascriptInterface(object : Any() {
                @android.webkit.JavascriptInterface
                fun pushThemeColor(cssColor: String) {
                    runOnUiThread {
                        val c = parseThemeColor(cssColor)
                        // If JS failed (empty/transparent), fall back to PixelCopy hardware sample
                        if (c != null) {
                            floatingControl.setScrimColor(c)
                        } else {
                            samplePixelColor { hwColor ->
                                if (hwColor != null) floatingControl.setScrimColor(hwColor)
                            }
                        }
                    }
                }
            }, "TarvenThemeBridge")

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(v: WebView?, url: String?) {
                    super.onPageFinished(v, url)
                    android.util.Log.i(TAG, "Page loaded: $url")
                    injectThemeSentinel()
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
        homeScreen.alpha = 0f
        homeScreen.translationY = dp(10).toFloat()
        homeScreen.scaleX = 0.992f
        homeScreen.scaleY = 0.992f

        // Restore or init
        if (wasWebViewVisible && wasServerReady) {
            serverReady = true
            webView.loadUrl(TAVERN_URL)
            splash.fadeOut {
                switchToWebView(false)
                homeScreen.visibility = View.GONE
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
                homeScreen.animate().alpha(1f).translationY(0f).scaleX(1f).scaleY(1f)
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
        handler.postDelayed({
            floatingControl.attach(root, h)
            floatingControl.setStatus(FloatingControlCenter.LED_OK, "Tavern")
        }, 500)
    }

    private fun exitTavern() {
        if (!isWebViewVisible) return
        floatingControl.hide()
        showSystemBars()
        val lp = webViewScreen.layoutParams as FrameLayout.LayoutParams
        lp.topMargin = 0
        webViewScreen.layoutParams = lp
        switchToHome(true)
    }

    private fun switchToWebView(animate: Boolean) {
        isWebViewVisible = true
        if (animate) {
            homeScreen.animate().alpha(0f).setDuration(200).withEndAction {
                homeScreen.visibility = View.GONE
                webViewScreen.visibility = View.VISIBLE
                webViewScreen.alpha = 0f
                webViewScreen.animate().alpha(1f).setDuration(220).start()
            }.start()
        } else {
            homeScreen.visibility = View.GONE
            webViewScreen.visibility = View.VISIBLE
            webViewScreen.alpha = 1f
        }
    }

    private fun switchToHome(animate: Boolean) {
        isWebViewVisible = false
        if (animate) {
            webViewScreen.animate().alpha(0f).setDuration(200).withEndAction {
                webViewScreen.visibility = View.GONE
                homeScreen.visibility = View.VISIBLE
                homeScreen.alpha = 0f
                homeScreen.animate().alpha(1f).setDuration(220).start()
            }.start()
        } else {
            webViewScreen.visibility = View.GONE
            homeScreen.visibility = View.VISIBLE
            homeScreen.alpha = 1f
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
    // ║  DO NOT CHANGE — Adaptive color fallback (Route A: hardware).   ║
    // ║  PixelCopy reads 1 pixel from the GPU framebuffer directly.     ║
    // ║  This works even when the WebView has a custom background image ║
    // ║  (which JS can never detect). API 26+ only; <26 skips silently. ║
    // ╚══════════════════════════════════════════════════════════════════╝
    private fun samplePixelColor(onResult: (Int?) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) { onResult(null); return }
        val loc = IntArray(2)
        webView.getLocationInWindow(loc)
        val sampleX = loc[0] + webView.width / 2
        val sampleY = loc[1] + dp(30)
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

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  DO NOT CHANGE — Adaptive color extraction (Route B: JS).       ║
    // ║  elementFromPoint ray-traces the first non-transparent element  ║
    // ║  at (center, 60px). MutationObserver catches theme switches.    ║
    // ║  This survives webpack SPA hydration (onPageFinished is a liar— ║
    // ║  the real DOM isn't there yet; we wait 600ms + observe).        ║
    // ║  Falls back to CSS variables (--body-background-color etc.)     ║
    // ║  for SillyTavern specifically.                                  ║
    // ╚══════════════════════════════════════════════════════════════════╝
    private fun injectThemeSentinel() {
        webView.evaluateJavascript("""
            (function(){
                if (window.__tarvenSentinel) return;
                window.__tarvenSentinel = true;

                function getVisualTopColor() {
                    var x = window.innerWidth / 2;
                    var y = 60;
                    var el = document.elementFromPoint(x, y);
                    while (el && el !== document) {
                        try {
                            var bg = window.getComputedStyle(el).backgroundColor;
                            if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                                var m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                                if (m) {
                                    var a = m[4] === undefined ? 1 : parseFloat(m[4]);
                                    if (a > 0.1) return bg;
                                }
                            }
                        } catch(e) {}
                        el = el.parentElement;
                    }
                    var root = window.getComputedStyle(document.documentElement);
                    return root.getPropertyValue('--body-background-color') ||
                           root.getPropertyValue('--SmartThemeBodyColor') || '';
                }

                function notifyNative() {
                    var c = getVisualTopColor();
                    if (c && window.TarvenThemeBridge) {
                        window.TarvenThemeBridge.pushThemeColor(c.trim());
                    }
                }

                new MutationObserver(function() { notifyNative(); })
                    .observe(document.documentElement, {
                        attributes: true, subtree: true,
                        attributeFilter: ['style', 'class']
                    });

                setTimeout(notifyNative, 600);
            })();
        """.trimIndent(), null)
    }

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  CSS color parser: handles #hex, rgb(), rgba().                 ║
    // ║  Returns null for transparent/empty — caller falls back to      ║
    // ║  PixelCopy (Route A) or brand black.                            ║
    // ╚══════════════════════════════════════════════════════════════════╝
    private fun parseThemeColor(raw: String?): Int? {
        val s = raw?.trim()?.trim('"')?.trim('\'') ?: return null
        if (s.isBlank() || s == "rgba(0, 0, 0, 0)" || s == "transparent") return null
        return try {
            android.graphics.Color.parseColor(s)
        } catch (_: Exception) {
            val nums = Regex("\\d+").findAll(s).map { it.value.toIntOrNull() ?: 0 }.toList()
            if (nums.size >= 3) android.graphics.Color.rgb(nums[0], nums[1], nums[2])
            else null
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
        val script = File(paths.scriptsDir, "start-server.sh")
        paths.logsDir.mkdirs()
        try {
            val pb = ProcessBuilder("/system/bin/sh", script.absolutePath)
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
                        homeScreen.animate().alpha(1f).translationY(0f).scaleX(1f).scaleY(1f)
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

    private fun setStatus(t: String) { post { statusText.text = t } }
    private fun setStatusDot(color: Int) {
        post { (statusDot.background as GradientDrawable).setColor(color) }
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
