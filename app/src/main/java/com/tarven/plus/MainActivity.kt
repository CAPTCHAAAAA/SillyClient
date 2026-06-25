package com.tarven.plus

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.PorterDuff
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.animation.AccelerateDecelerateInterpolator
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
import android.widget.Toast
import com.tarven.plus.runtime.RuntimePaths
import com.tarven.plus.runtime.RuntimeFileUtils
import com.tarven.plus.runtime.TarvenProcessRunner
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {

    private val handler = Handler(Looper.getMainLooper())

    // ©¤©¤ Views ©¤©¤
    private lateinit var homeScreen: LinearLayout
    private lateinit var webViewScreen: FrameLayout
    private lateinit var webView: WebView
    private lateinit var statusText: TextView
    private lateinit var statusDot: View
    private lateinit var progressBar: ProgressBar
    private lateinit var startButton: TextView
    private lateinit var controlBall: FrameLayout
    private lateinit var controlBallInner: ImageView
    private lateinit var controlPanel: LinearLayout

    // ©¤©¤ State ©¤©¤
    private lateinit var runner: TarvenProcessRunner
    private var serverReady = false
    private var isWebViewVisible = false
    private var panelVisible = false
    private var ballX = 0f
    private var ballY = 0f
    private var ballSnappedRight = true
    private var hideBallRunnable: Runnable? = null

    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

    companion object {
        private const val TAG = "Tarven++"
        private const val SERVER_SOURCE_URL =
            "https://github.com/CAPTCHAAAAA/TarvenPlus/releases/download/v0.3/server-source.zip"
        private const val TAVERN_URL = "http://127.0.0.1:8000/"
        private val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
        private val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT

        // Colors
        private const val BG = 0xFF0D0B0C.toInt()
        private const val SURFACE = 0xFF1A1418.toInt()
        private const val PINK = 0xFFE8A0BF.toInt()
        private const val PINK_DIM = 0xFF8B6B7A.toInt()
        private const val GOLD = 0xFFC8A96E.toInt()
        private const val TEXT = 0xFFD4C8BC.toInt()
        private const val TEXT_DIM = 0xFF6B5E55.toInt()
        private const val GREEN = 0xFF7DBA8A.toInt()
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        runner = TarvenProcessRunner()
        val dp = resources.displayMetrics.density

        val root = FrameLayout(this).apply { setBackgroundColor(BG.toInt()) }

        // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
        // HOME SCREEN
        // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
        homeScreen = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(32), dp(32), dp(32))
        }

        val logoRing = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setStroke(dp(2), PINK.toInt())
            setSize(dp(100), dp(100))
        }
        val logoView = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_compass)
            setColorFilter(GOLD.toInt(), PorterDuff.Mode.SRC_IN)
            val p = dp(25)
            setPadding(p, p, p, p)
            background = logoRing
        }

        val title = textView("Tarven++", dp(30), TEXT.toInt(), true).apply {
            setPadding(0, dp(20), 0, dp(4))
        }
        val subtitle = textView("SillyTavern for Android", dp(13), TEXT_DIM.toInt(), false)
            .apply { setPadding(0, 0, 0, dp(48)) }

        val statusRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(20))
        }
        statusDot = View(this).apply {
            val s = dp(8)
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(TEXT_DIM.toInt()); setSize(s, s) }
            val p = LinearLayout.LayoutParams(s, s).apply { gravity = Gravity.CENTER_VERTICAL; setMargins(0, 0, dp(8), 0) }
            layoutParams = p
        }
        statusText = textView("Preparing...", dp(13), TEXT_DIM.toInt(), false)
        statusRow.addView(statusDot)
        statusRow.addView(statusText)

        progressBar = ProgressBar(this).apply {
            isIndeterminate = true; visibility = View.GONE
            indeterminateDrawable.setColorFilter(GOLD.toInt(), PorterDuff.Mode.SRC_IN)
        }

        startButton = pillButton("LAUNCH TAVERN", PINK.toInt(), BG.toInt()).apply { isEnabled = false; alpha = 0.5f }

        homeScreen.addView(logoView)
        homeScreen.addView(title)
        homeScreen.addView(subtitle)
        homeScreen.addView(statusRow)
        homeScreen.addView(progressBar)
        homeScreen.addView(startButton)

        // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
        // WEBVIEW SCREEN
        // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
        webViewScreen = FrameLayout(this).apply { visibility = View.GONE; setBackgroundColor(BG.toInt()) }

        webView = WebView(this).apply {
            setBackgroundColor(BG.toInt())
            settings.apply {
                javaScriptEnabled = true; domStorageEnabled = true; allowFileAccess = false
                databaseEnabled = true; setSupportZoom(true); builtInZoomControls = true
                displayZoomControls = false; loadWithOverviewMode = true; useWideViewPort = true
                mediaPlaybackRequiresUserGesture = false
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) isForceDarkAllowed = false
            }
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            overScrollMode = View.OVER_SCROLL_NEVER
            webChromeClient = object : WebChromeClient() {
                override fun onShowCustomView(v: View?, cb: CustomViewCallback?) { v?.let { goFullscreen(it, cb) } }
                override fun onHideCustomView() { exitFullscreen() }
            }
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(v: WebView, url: String) { progressBar.visibility = View.GONE }
                override fun shouldOverrideUrlLoading(v: WebView, url: String): Boolean {
                    if (url.contains("127.0.0.1")) return false
                    try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {}
                    return true
                }
            }
        }
        webViewScreen.addView(webView, FrameLayout.LayoutParams(MATCH, MATCH))

        // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
        // DRAGGABLE CONTROL BALL
        // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
        controlBall = FrameLayout(this).apply {
            val size = dp(52)
            layoutParams = FrameLayout.LayoutParams(size, size).apply {
                gravity = Gravity.TOP or Gravity.START
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.argb(220, 20, 16, 18))
                setStroke(dp(1.5f), PINK_DIM.toInt())
            }
            elevation = dp(8).toFloat()
            setOnTouchListener(BallTouchListener())
        }
        controlBallInner = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_more)
            setColorFilter(PINK.toInt(), PorterDuff.Mode.SRC_IN)
            setPadding(dp(12), dp(12), dp(12), dp(12))
            layoutParams = FrameLayout.LayoutParams(MATCH, MATCH)
        }
        controlBall.addView(controlBallInner)
        controlBall.setOnClickListener { togglePanel() }

        // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
        // CONTROL PANEL (flies out from ball)
        // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
        controlPanel = LinearLayout(this).apply {
            visibility = View.GONE; alpha = 0f; scaleX = 0.5f; scaleY = 0.5f
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE; cornerRadius = dp(12).toFloat()
                setColor(Color.argb(235, 18, 14, 16))
                setStroke(dp(1), PINK_DIM.toInt())
            }
            setPadding(dp(4), dp(4), dp(4), dp(4))
            elevation = dp(12).toFloat()
        }

        data class PanelAction(val icon: Int, val label: String, val action: () -> Unit)
        listOf(
            PanelAction(android.R.drawable.ic_menu_rotate, "Refresh") { webView.reload() },
            PanelAction(android.R.drawable.ic_menu_preferences, "Settings") { webView.loadUrl("$TAVERN_URL#/settings") },
            PanelAction(android.R.drawable.ic_menu_close_clear_cancel, "Exit") { exitTavern() },
        ).forEach { act ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(12), dp(8), dp(16), dp(8))
                setOnClickListener { act.action(); hidePanel() }
            }
            val icon = ImageView(this).apply {
                setImageResource(act.icon); setColorFilter(GOLD.toInt(), PorterDuff.Mode.SRC_IN)
                layoutParams = LinearLayout.LayoutParams(dp(20), dp(20)).apply { setMargins(0, 0, dp(10), 0) }
            }
            row.addView(icon)
            row.addView(textView(act.label, dp(13), TEXT.toInt(), false))
            controlPanel.addView(row)
        }

        webViewScreen.addView(controlPanel)
        webViewScreen.addView(controlBall)

        // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
        // ASSEMBLE
        // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
        root.addView(homeScreen, FrameLayout.LayoutParams(MATCH, MATCH))
        root.addView(webViewScreen, FrameLayout.LayoutParams(MATCH, MATCH))
        setContentView(root)

        prepareServer()
        root.post { snapBallToEdge(true) }
    }

    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    // BALL TOUCH ¡ª drag + snap + semi-hide
    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    private inner class BallTouchListener : View.OnTouchListener {
        private var dx = 0f; private var dy = 0f; private var startX = 0f; private var startY = 0f
        private var dragging = false

        override fun onTouch(v: View, event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    dx = event.rawX - v.x; dy = event.rawY - v.y
                    startX = event.rawX; startY = event.rawY; dragging = false
                    cancelHideBall()
                    unHideBall()
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val moved = Math.abs(event.rawX - startX) + Math.abs(event.rawY - startY)
                    if (moved > dp(8)) dragging = true
                    if (dragging) {
                        val nx = event.rawX - dx
                        val ny = (event.rawY - dy).coerceIn(0f, (webViewScreen.height - v.height).toFloat())
                        v.x = nx; v.y = ny
                        updatePanelPosition()
                    }
                    return true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (!dragging) return false
                    snapBallToEdge(false)
                    scheduleHideBall()
                    return true
                }
            }
            return false
        }
    }

    private fun snapBallToEdge(immediate: Boolean) {
        val b = controlBall
        val cx = b.x + b.width / 2f
        val screenW = webViewScreen.width.toFloat()
        val targetX = if (cx < screenW / 2) {
            ballSnappedRight = false
            -b.width * 0.3f
        } else {
            ballSnappedRight = true
            screenW - b.width * 0.7f
        }
        if (immediate) {
            b.x = targetX
            b.y = webViewScreen.height * 0.6f
            updatePanelPosition()
        } else {
            b.animate().x(targetX).setDuration(250).setInterpolator(AccelerateDecelerateInterpolator()).start()
            handler.postDelayed({ updatePanelPosition() }, 260)
        }
    }

    private fun scheduleHideBall() {
        cancelHideBall()
        hideBallRunnable = Runnable {
            val b = controlBall
            val screenW = webViewScreen.width.toFloat()
            val target = if (ballSnappedRight) screenW + b.width * 0.1f else -b.width * 0.85f
            b.animate().x(target).setDuration(400).setInterpolator(AccelerateDecelerateInterpolator()).start()
        }
        handler.postDelayed(hideBallRunnable!!, 3000)
    }

    private fun cancelHideBall() = hideBallRunnable?.let { handler.removeCallbacks(it) }

    private fun unHideBall() {
        val b = controlBall
        val screenW = webViewScreen.width.toFloat()
        val target = if (ballSnappedRight) screenW - b.width * 0.7f else -b.width * 0.3f
        b.animate().x(target).setDuration(200).start()
    }

    private fun updatePanelPosition() {
        if (!panelVisible) return
        val b = controlBall
        val panelW = controlPanel.width.coerceAtLeast(dp(140))
        val screenW = webViewScreen.width
        val px = if (ballSnappedRight) (b.x - panelW + b.width).coerceAtLeast(dp(8).toFloat())
                  else (b.x + b.width + dp(8).toFloat())
        val py = (b.y + b.height / 2f - controlPanel.height / 2f)
            .coerceIn(dp(8).toFloat(), (webViewScreen.height - controlPanel.height - dp(8)).toFloat())
        controlPanel.x = px; controlPanel.y = py
    }

    private fun togglePanel() = if (panelVisible) hidePanel() else showPanel()

    private fun showPanel() {
        cancelHideBall()
        updatePanelPosition()
        controlPanel.visibility = View.VISIBLE
        controlPanel.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(200)
            .setInterpolator(OvershootInterpolator(1.1f)).start()
        panelVisible = true
    }

    private fun hidePanel() {
        controlPanel.animate().alpha(0f).scaleX(0.5f).scaleY(0.5f).setDuration(150).withEndAction {
            controlPanel.visibility = View.GONE
        }.start()
        panelVisible = false
        scheduleHideBall()
    }

    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    // TAVERN ENTER / EXIT
    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    private fun enterTavern() {
        hideSystemBars()
        progressBar.visibility = View.VISIBLE
        webView.loadUrl(TAVERN_URL)
        handler.postDelayed({
            homeScreen.visibility = View.GONE
            webViewScreen.visibility = View.VISIBLE
            controlBall.visibility = View.VISIBLE
            controlBall.alpha = 1f
            isWebViewVisible = true
            scheduleHideBall()
        }, 600)
    }

    private fun exitTavern() {
        hidePanel()
        showSystemBars()
        controlBall.visibility = View.GONE
        webViewScreen.visibility = View.GONE
        homeScreen.visibility = View.VISIBLE
        startButton.text = "ENTER TAVERN"
        startButton.isEnabled = true; startButton.alpha = 1f
        isWebViewVisible = false
        cancelHideBall()
        statusText.text = "Server running on port 8000"
        setStatusDot(GREEN.toInt())
    }

    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    // FULLSCREEN (videos etc)
    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    private fun goFullscreen(v: View, cb: WebChromeClient.CustomViewCallback?) {
        fullscreenView = v; fullscreenCallback = cb
        webView.visibility = View.GONE; controlBall.visibility = View.GONE; hidePanel()
        webViewScreen.addView(v, FrameLayout.LayoutParams(MATCH, MATCH))
        hideSystemBars()
    }

    private fun exitFullscreen() {
        fullscreenView?.let { webViewScreen.removeView(it) }
        fullscreenView = null; fullscreenCallback?.onCustomViewHidden(); fullscreenCallback = null
        webView.visibility = View.VISIBLE; controlBall.visibility = View.VISIBLE
    }

    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    // SYSTEM BARS
    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.apply {
                hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
        }
    }

    private fun showSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
            window.insetsController?.show(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        else @Suppress("DEPRECATION") window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
    }

    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    // SERVER LIFECYCLE
    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    private fun prepareServer() {
        Thread {
            val paths = RuntimePaths.from(this)
            paths.ensureDirs()

            try {
                RuntimeFileUtils.unzipAsset(this, "bootstrap/rootfs/rootfs-libs.zip", paths.usrDir)
                RuntimeFileUtils.copyAsset(this, "bootstrap/scripts/start-server.sh", File(paths.scriptsDir, "start-server.sh"))
                RuntimeFileUtils.chmodExecutable(File(paths.scriptsDir, "start-server.sh"))
            } catch (_: Exception) {}

            val serverJs = File(paths.serverDir, "server.js")
            val serverZip = File(paths.tarvenHome, "server-source.zip")

            if (!serverJs.isFile) {
                setStatus("Downloading tavern...")
                if (!downloadServer(serverZip)) { setStatus("Download failed"); return@Thread }
                setStatus("Extracting...")
                try { RuntimeFileUtils.unzipStream(serverZip.inputStream(), paths.serverDir); serverZip.delete() }
                catch (_: Exception) { setStatus("Extraction failed"); return@Thread }
            }
            if (!serverJs.isFile) { setStatus("server.js not found"); return@Thread }

            try { File(paths.serverDir, "config.yaml").writeText("listen: false\nprotocol:\n  ipv4: true\n  ipv6: false\nwhitelistMode: false\nbrowserLaunch:\n  enabled: false\ndataRoot: ./data\nport: 8000\n") } catch (_: Exception) {}

            setStatus("Starting server...")
            if (!startServer(paths)) { setStatus("Server failed"); return@Thread }
            setStatus("Waiting...")
            pollUntilReady()
        }.start()
    }

    private fun downloadServer(dest: File): Boolean {
        android.util.Log.i(TAG, "Download: $SERVER_SOURCE_URL")
        return try {
            val conn = URL(SERVER_SOURCE_URL).openConnection() as HttpURLConnection
            conn.connectTimeout = 15000; conn.readTimeout = 60000
            conn.setRequestProperty("User-Agent", "Tarven++/0.2")
            val total = conn.contentLengthLong
            val input = BufferedInputStream(conn.inputStream)
            val output = FileOutputStream(dest)
            val buf = ByteArray(65536); var dl = 0L; var len: Int
            while (input.read(buf).also { len = it } != -1) {
                output.write(buf, 0, len); dl += len
                if (total > 0 && dl % (10 * 1024 * 1024) < buf.size) setStatus("Downloading... ${dl * 100 / total}%")
            }
            output.close(); input.close(); conn.disconnect()
            android.util.Log.i(TAG, "Downloaded: ${dest.length()} bytes")
            true
        } catch (e: Exception) { dest.delete(); android.util.Log.e(TAG, "Download failed", e); false }
    }

    private fun startServer(paths: RuntimePaths): Boolean {
        val script = File(paths.scriptsDir, "start-server.sh")
        if (!paths.nodeBin.exists() || !script.exists()) return false
        paths.logsDir.mkdirs()
        try {
            val pb = ProcessBuilder("/system/bin/sh", script.absolutePath)
            pb.directory(paths.serverDir); pb.redirectErrorStream(true)
            pb.redirectOutput(ProcessBuilder.Redirect.appendTo(File(paths.logsDir, "server.log")))
            val env = pb.environment()
            env["TARVEN_HOME"] = paths.tarvenHome.absolutePath
            env["TARVEN_USR"] = paths.usrDir.absolutePath
            env["TARVEN_SERVER_DIR"] = paths.serverDir.absolutePath
            env["TARVEN_NODE"] = paths.nodeBin.absolutePath
            env["TARVEN_NATIVE_LIB_DIR"] = paths.nativeLibDir.absolutePath
            env["TARVEN_TMP"] = paths.tmpDir.absolutePath; env["TARVEN_BOOTSTRAP"] = paths.bootstrapDir.absolutePath; env["HOST"] = "127.0.0.1"; env["PORT"] = "8000"
            pb.start(); return true
        } catch (_: Exception) { return false }
    }

    private fun pollUntilReady() {
        var a = 0
        while (a < 120) {
            if (tryConnect(TAVERN_URL)) {
                serverReady = true
                setStatus("Ready")
                setStatusDot(GREEN.toInt())
                post { startButton.apply { isEnabled = true; alpha = 1f; text = "ENTER TAVERN"
                    setOnClickListener { enterTavern() } } }
                return
            }
            a++; try { Thread.sleep(1000) } catch (_: Exception) { break }
        }
        setStatus("No response")
    }

    private fun tryConnect(url: String) = try {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 3000; c.readTimeout = 3000; c.responseCode in 200..499
    } catch (_: Exception) { false }

    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    // HELPERS
    // ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
    private fun setStatus(t: String) { post { statusText.text = t } }
    private fun setStatusDot(color: Int) {
        post { (statusDot.background as GradientDrawable).setColor(color) }
    }
    private fun post(r: Runnable) { handler.post(r) }
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()

    private fun textView(t: String, size: Int, color: Int, bold: Boolean) = TextView(this).apply {
        text = t; textSize = size.toFloat(); setTextColor(color); gravity = Gravity.CENTER
        if (bold) paint.isFakeBoldText = true
    }

    private fun pillButton(t: String, borderColor: Int, textColor: Int) = TextView(this).apply {
        text = t; textSize = 16f; setTextColor(textColor); gravity = Gravity.CENTER
        setPadding(dp(48), dp(14), dp(48), dp(14))
        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE; cornerRadius = dp(24).toFloat()
            setStroke(dp(1.5f), borderColor); setColor(Color.TRANSPARENT)
        }
    }

    override fun onBackPressed() {
        if (fullscreenView != null) exitFullscreen()
        else if (panelVisible) hidePanel()
        else if (isWebViewVisible) { if (webView.canGoBack()) webView.goBack() else exitTavern() }
        else super.onBackPressed()
    }

    override fun onDestroy() {
        if (serverReady) runner.stop()
        webView.destroy(); super.onDestroy()
    }
}