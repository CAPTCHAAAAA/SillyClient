package com.tarven.plus.ui

import android.animation.ValueAnimator
import android.app.Activity
import android.graphics.Color
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.ShapeDrawable
import android.graphics.drawable.shapes.OvalShape
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Floating control bar anchored at the top status-bar region.
 *
 * - Background: gradient scrim that adapts to the WebView below — dark at top, transparent below.
 * - Left: glowing status LED (radial-glow layer + sharp dot) + label.
 * - Right: control handle (tap → menu).
 * - Always visible (no idle fade) since it occupies the dead status-bar space.
 */
class FloatingControlCenter(private val activity: Activity) {

    interface Callback {
        fun onRefresh()
        fun onSettings()
        fun onExit()
    }

    private val density = activity.resources.displayMetrics.density
    private fun dp(v: Int) = (v * density).toInt()
    private val touchSlop = ViewConfiguration.get(activity).scaledTouchSlop
    private val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
    private val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT

    private lateinit var scrim: View            // gradient background
    private lateinit var gloss: View            // white gloss sweep overlay (top 30%)
    private lateinit var leftCluster: LinearLayout // glow + dot + label
    private lateinit var ledGlow: View          // radial blur glow layer
    private lateinit var ledDot: View           // sharp core dot
    private lateinit var statusLabel: TextView
    private lateinit var rightHandle: View

    private lateinit var menuCard: LinearLayout
    private var menuOpen = false

    private var root: FrameLayout? = null
    private var barBand = 0

    private var callback: Callback? = null

    companion object {
        const val LED_CHECKING = 0xFFFBBF24.toInt()
        const val LED_OK     = 0xFF34D399.toInt()
        const val LED_FAILED = 0xFFEF4444.toInt()
        const val LED_PREP   = 0xFFFF87C8.toInt()
        private const val PADDING_H = 16  // dp from screen edges
    }

    fun setCallback(cb: Callback) { callback = cb }

    /** Attach the blended-status-bar. [statusBarHeight] = physical cutout / status-bar band. */
    fun attach(root: FrameLayout, statusBarHeight: Int) {
        this.root = root
        this.barBand = statusBarHeight
        buildScrim()
        buildGloss()
        buildLeftCluster()
        buildRightHandle()
        buildMenu()
        root.addView(scrim)
        root.addView(gloss)
        root.addView(leftCluster)
        root.addView(rightHandle)
        scrim.alpha = 0f; gloss.alpha = 0f; leftCluster.alpha = 0f; rightHandle.alpha = 0f
        scrim.animate().alpha(1f).setDuration(280).start()
        gloss.animate().alpha(1f).setDuration(280).start()
        leftCluster.animate().alpha(1f).setDuration(280).start()
        rightHandle.animate().alpha(1f).setDuration(280).start()
    }

    private fun buildScrim() {
        // Light neutral gray — doesn't clash with any page theme during transition
        val gradient = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(
                0xFF2A2A2A.toInt(),
                0xFF1E1E1E.toInt(),
                0xFF181818.toInt(),
            )
        )
        scrim = View(activity).apply {
            background = gradient
            val lp = FrameLayout.LayoutParams(MATCH, barBand).apply {
                gravity = Gravity.TOP or Gravity.START
                topMargin = 0
            }
            layoutParams = lp
            isClickable = false
        }
    }

    private fun buildGloss() {
        val h = (barBand * 0.3f).toInt()
        // Uniform white glow on top 30% — breathes with color changes
        val gradient = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(
                0x18FFFFFF.toInt(),  // soft white
                0x00FFFFFF.toInt()   // fade to transparent at bottom
            )
        )
        gloss = View(activity).apply {
            background = gradient
            alpha = 0f
            val lp = FrameLayout.LayoutParams(MATCH, h).apply {
                gravity = Gravity.TOP or Gravity.START
                topMargin = 0
            }
            layoutParams = lp
            isClickable = false
        }
    }

    fun sweepGlossOver() {
        if (!::gloss.isInitialized) return
        // One-shot breath — 2400ms, pure white, sync with color wave
        ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 2400
            interpolator = android.view.animation.DecelerateInterpolator(2f)
            addUpdateListener { va ->
                val t = va.animatedFraction
                gloss.alpha = when {
                    t < 0.2f -> t / 0.2f * 0.55f
                    t < 0.7f -> 0.55f
                    else     -> (1f - t) / 0.3f * 0.55f
                }
            }
            start()
        }
    }

    private fun buildLeftCluster() {
        // Now on the RIGHT side: LED glow + dot + label
        leftCluster = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val lp = FrameLayout.LayoutParams(WRAP, WRAP).apply {
                gravity = Gravity.TOP or Gravity.END
                topMargin = (barBand - dp(24)) / 2
                rightMargin = dp(PADDING_H)
            }
            layoutParams = lp
            isClickable = true
            setOnClickListener { openMenu() }
        }

        // ---- Glow layer: large radial-gradient circle behind the dot ----
        ledGlow = View(activity).apply {
            val glowSize = dp(28)
            background = makeRadialGlow(LED_OK, glowSize)
            layoutParams = LinearLayout.LayoutParams(glowSize, glowSize).apply {
                rightMargin = dp(2)
            }
        }
        // ---- Sharp green core dot ----
        ledDot = View(activity).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(LED_CHECKING)
            }
            val dotSize = dp(8)
            // overlay the dot inside the glow container
            val container = FrameLayout(activity).apply {
                val s = dp(28)
                layoutParams = LinearLayout.LayoutParams(s, s).apply { rightMargin = dp(6) }
            }
            container.addView(ledGlow, FrameLayout.LayoutParams(dp(28), dp(28)).apply {
                gravity = Gravity.CENTER
            })
            container.addView(this, FrameLayout.LayoutParams(dotSize, dotSize).apply {
                gravity = Gravity.CENTER
            })
            leftCluster.addView(container)
        }
        // ---- Label ----
        statusLabel = TextView(activity).apply {
            text = "Tarven"
            setTextColor(0xFFF3F4F6.toInt())
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            paint.isFakeBoldText = true
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(WRAP, WRAP)
        }
        leftCluster.addView(statusLabel)
    }

    /** Create a radial-gradient glow: large soft circle with faded edges. */
    private fun makeRadialGlow(color: Int, sizePx: Int): ShapeDrawable {
        val half = sizePx / 2f
        val r = Color.red(color); val g = Color.green(color); val b = Color.blue(color)
        // radial gradient from center (full alpha) to edge (zero alpha)
        val shader = RadialGradient(
            half, half, half,
            intArrayOf(
                Color.argb(100, r, g, b),  // center: bright but soft
                Color.argb(12,  r, g, b),  // edge: nearly transparent
                Color.argb(0,   r, g, b)   // outer: fully transparent
            ),
            floatArrayOf(0.0f, 0.6f, 1.0f),
            Shader.TileMode.CLAMP
        )
        return ShapeDrawable(OvalShape()).apply {
            paint.shader = shader
            paint.isAntiAlias = true
        }
    }

    private fun buildRightHandle() {
        // Now on the LEFT side
        rightHandle = View(activity).apply {
            val w = dp(28); val h = dp(14)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(7).toFloat()
                setColor(Color.argb(80, 255, 255, 255))
                setStroke(dp(1), Color.argb(30, 255, 255, 255))
            }
            val lp = FrameLayout.LayoutParams(w, h).apply {
                gravity = Gravity.TOP or Gravity.START
                topMargin = (barBand - h) / 2
                leftMargin = dp(PADDING_H)
            }
            layoutParams = lp
            isClickable = true
            setOnTouchListener(HandleTouchListener())
        }
    }

    private fun buildMenu() {
        menuCard = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(16).toFloat()
                setColor(0xFF2B2B2B.toInt())
                setStroke(dp(1), Color.argb(28, 255, 255, 255))
            }
            setPadding(dp(6), dp(8), dp(6), dp(8))
            elevation = dp(20).toFloat()
        }
        menuCard.addView(menuItem("Refresh")  { callback?.onRefresh();  closeMenu() })
        menuCard.addView(menuDivider())
        menuCard.addView(menuItem("Settings") { callback?.onSettings(); closeMenu() })
        menuCard.addView(menuDivider())
        menuCard.addView(menuItem("Exit Tavern") { callback?.onExit(); closeMenu() })
    }

    private fun menuItem(label: String, onClick: () -> Unit): TextView {
        return TextView(activity).apply {
            text = label
            setTextColor(0xFFF3F4F6.toInt())
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(11), dp(28), dp(11))
            layoutParams = LinearLayout.LayoutParams(MATCH, WRAP)
            setOnTouchListener(ItemTouchListener(this, onClick))
        }
    }

    private fun menuDivider(): View {
        return View(activity).apply {
            setBackgroundColor(Color.argb(20, 255, 255, 255))
            layoutParams = LinearLayout.LayoutParams(MATCH, dp(1)).apply {
                setMargins(dp(8), dp(2), dp(8), dp(2))
            }
        }
    }

    fun setStatus(color: Int, label: String? = null) {
        activity.runOnUiThread {
            if (!::ledDot.isInitialized) return@runOnUiThread
            (ledDot.background as GradientDrawable).setColor(color)
            // rebuild glow for the new color
            val glowSize = dp(28)
            ledGlow.background = makeRadialGlow(color, glowSize)
            if (label != null) statusLabel.text = label
        }
    }

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  DO NOT CHANGE — Adaptive scrim gradient.                       ║
    // ║  Top: 45% of page color (soft darkening, hides system icons).   ║
    // ║  Mid: 80% of page color (compressed transition).                ║
    // ║  Body: 100% page color (blends seamlessly into WebView).        ║
    // ║  Called from JS bridge (Route B) or PixelCopy (Route A).        ║
    // ╚══════════════════════════════════════════════════════════════════╝
    fun setScrimColor(baseColor: Int) {
        activity.runOnUiThread {
            if (!::scrim.isInitialized) return@runOnUiThread
            val currentDrawable = scrim.background as? GradientDrawable
            val currentBody = currentDrawable?.let { d ->
                val cs = d.colors; if (cs != null && cs.isNotEmpty()) cs.last() else baseColor
            } ?: baseColor

            val fromR = android.graphics.Color.red(currentBody)
            val fromG = android.graphics.Color.green(currentBody)
            val fromB = android.graphics.Color.blue(currentBody)
            val toR = android.graphics.Color.red(baseColor)
            val toG = android.graphics.Color.green(baseColor)
            val toB = android.graphics.Color.blue(baseColor)

            // Bottom-up wave: new color sweeps from bottom → top, 2400ms
            ValueAnimator.ofFloat(0f, 1f).apply {
                duration = 2400
                interpolator = android.view.animation.DecelerateInterpolator(1.8f)
                addUpdateListener { va ->
                    val t = va.animatedValue as Float
                    // Wave position: t=0 at bottom, t=1 at top
                    // bottom (t < 0.33): bottom=new, mid+top=old
                    // middle (t < 0.66): bottom+mid=new, top=old  
                    // top (t < 1.0): all=new

                    fun lerp(a: Int, b: Int, f: Float) = (a + (b - a) * f).toInt()

                    val topMix: Float
                    val midMix: Float
                    val botMix: Float
                    if (t < 0.33f) {
                        // Wave entering bottom
                        botMix = t / 0.33f
                        midMix = 0f
                        topMix = 0f
                    } else if (t < 0.66f) {
                        // Wave at middle
                        botMix = 1f
                        midMix = (t - 0.33f) / 0.33f
                        topMix = 0f
                    } else {
                        // Wave at top
                        botMix = 1f
                        midMix = 1f
                        topMix = (t - 0.66f) / 0.34f
                    }

                    val tr = lerp(fromR, toR, topMix)
                    val tg = lerp(fromG, toG, topMix)
                    val tb = lerp(fromB, toB, topMix)
                    val mr = lerp(fromR, toR, midMix)
                    val mg = lerp(fromG, toG, midMix)
                    val mb = lerp(fromB, toB, midMix)
                    val br = lerp(fromR, toR, botMix)
                    val bg = lerp(fromG, toG, botMix)
                    val bb = lerp(fromB, toB, botMix)

                    scrim.background = GradientDrawable(
                        GradientDrawable.Orientation.TOP_BOTTOM,
                        intArrayOf(
                            android.graphics.Color.rgb(tr, tg, tb),
                            android.graphics.Color.rgb(mr, mg, mb),
                            android.graphics.Color.rgb(br, bg, bb)
                        )
                    )
                }
                start()
            }
        }
    }

    fun show() {
        activity.runOnUiThread {
            if (!::leftCluster.isInitialized) return@runOnUiThread
            if (leftCluster.parent == null && root != null) root!!.addView(leftCluster)
            if (rightHandle.parent == null && root != null) root!!.addView(rightHandle)
            leftCluster.animate().alpha(1f).setDuration(180).start()
            rightHandle.animate().alpha(1f).setDuration(180).start()
            scrim.animate().alpha(1f).setDuration(180).start()
        }
    }

    fun hide() {
        activity.runOnUiThread {
            if (!::leftCluster.isInitialized) return@runOnUiThread
            closeMenu()
            leftCluster.animate().alpha(0f).setDuration(180).start()
            rightHandle.animate().alpha(0f).setDuration(180).start()
            scrim.animate().alpha(0f).setDuration(180).start()
        }
    }

    // ---- menu logic ----

    private fun openMenu() {
        if (menuOpen) { closeMenu(); return }
        menuOpen = true
        val screenW = activity.resources.displayMetrics.widthPixels
        val cardW = dp(168)
        val lp = FrameLayout.LayoutParams(cardW, WRAP).apply {
            topMargin = barBand + dp(4)
            leftMargin = (screenW - cardW - dp(PADDING_H)).coerceAtLeast(dp(PADDING_H))
            gravity = Gravity.TOP or Gravity.START
        }
        if (menuCard.parent == null) root?.addView(menuCard, lp)
        else menuCard.layoutParams = lp
        menuCard.visibility = View.VISIBLE
        menuCard.alpha = 0f; menuCard.scaleX = 0.92f; menuCard.scaleY = 0.92f
        menuCard.pivotX = cardW.toFloat(); menuCard.pivotY = 0f
        menuCard.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(200)
            .setInterpolator(OvershootInterpolator(1.2f)).start()
    }

    private fun closeMenu() {
        if (!menuOpen) return
        menuOpen = false
        menuCard.animate().alpha(0f).scaleX(0.92f).scaleY(0.92f).setDuration(140)
            .withEndAction { menuCard.visibility = View.GONE }.start()
    }

    // ---- touch ----

    private inner class HandleTouchListener : View.OnTouchListener {
        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.action) {
                MotionEvent.ACTION_DOWN -> return true
                MotionEvent.ACTION_UP -> { openMenu(); return true }
            }
            return false
        }
    }

    private inner class ItemTouchListener(
        private val tv: TextView,
        private val onClick: () -> Unit
    ) : View.OnTouchListener {
        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.action) {
                MotionEvent.ACTION_DOWN -> { tv.setBackgroundColor(Color.argb(20, 255, 255, 255)); return true }
                MotionEvent.ACTION_UP -> { tv.setBackgroundColor(Color.TRANSPARENT); onClick(); return true }
                MotionEvent.ACTION_CANCEL -> { tv.setBackgroundColor(Color.TRANSPARENT); return true }
            }
            return false
        }
    }
}
