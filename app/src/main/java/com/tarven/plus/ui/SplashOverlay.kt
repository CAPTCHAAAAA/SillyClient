package com.tarven.plus.ui

import android.animation.ObjectAnimator
import android.app.Activity
import android.graphics.Color
import android.graphics.PorterDuff
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Minimal splash overlay: dark bg + centered status LED (with glow) + progress + status text.
 * Codex++ aesthetic — flat dark fills, hairline borders, soft shadows, no blur.
 */
class SplashOverlay(private val activity: Activity) {

    private val density = activity.resources.displayMetrics.density
    private fun dp(v: Int) = (v * density).toInt()

    private lateinit var overlay: FrameLayout
    private lateinit var ledContainer: FrameLayout
    private lateinit var ledGlow: View
    private lateinit var led: View
    private lateinit var progressBar: ProgressBar
    private lateinit var statusText: TextView

    // Codex++ status LED colors
    companion object {
        const val LED_CHECKING = 0xFFFBBF24.toInt()   // amber, flat
        const val LED_OK = 0xFF34D399.toInt()         // emerald, glow
        const val LED_FAILED = 0xFFEF4444.toInt()     // red, glow
        const val LED_PREP = 0xFFFF87C8.toInt()       // pink (Tarven brand), flat
    }

    fun build(): View {
        overlay = FrameLayout(activity).apply {
            setBackgroundColor(0xFF070408.toInt())
            isClickable = true
            isFocusable = true
        }

        val center = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }

        // ---- Status LED with glow (glow = larger same-color low-alpha circle behind) ----
        ledContainer = FrameLayout(activity).apply {
            val size = dp(64)
            layoutParams = FrameLayout.LayoutParams(size, size).apply {
                gravity = Gravity.CENTER
                bottomMargin = dp(28)
            }
        }
        ledGlow = View(activity).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.argb(40, 0x34, 0xD3, 0x99)) // default emerald glow
            }
            val glowSize = dp(64)
            layoutParams = FrameLayout.LayoutParams(glowSize, glowSize).apply {
                gravity = Gravity.CENTER
            }
        }
        led = View(activity).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(LED_CHECKING)
            }
            val ledSize = dp(12)
            layoutParams = FrameLayout.LayoutParams(ledSize, ledSize).apply {
                gravity = Gravity.CENTER
            }
        }
        ledContainer.addView(ledGlow)
        ledContainer.addView(led)
        center.addView(ledContainer)

        // ---- Progress bar ----
        progressBar = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal).apply {
            val lp = LinearLayout.LayoutParams(dp(220), dp(3))
            lp.gravity = Gravity.CENTER
            lp.topMargin = dp(8)
            layoutParams = lp
            progressTintList = android.content.res.ColorStateList.valueOf(0xFFFF4FA9.toInt())
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.argb(22, 255, 255, 255))
            max = 100
            progress = 0
        }
        center.addView(progressBar)

        // ---- Status text ----
        statusText = TextView(activity).apply {
            text = "Preparing..."
            textSize = 13f
            setTextColor(0xFFB7A7B6.toInt())
            gravity = Gravity.CENTER
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            lp.gravity = Gravity.CENTER
            lp.topMargin = dp(16)
            layoutParams = lp
        }
        center.addView(statusText)

        val centerLp = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { gravity = Gravity.CENTER }
        overlay.addView(center, centerLp)
        return overlay
    }

    fun attachTo(root: ViewGroup) {
        root.addView(build(), ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))
    }

    fun setProgress(pct: Int) {
        activity.runOnUiThread { progressBar.progress = pct }
    }

    fun setStatus(t: String) {
        activity.runOnUiThread { statusText.text = t }
    }

    fun setLedColor(color: Int) {
        activity.runOnUiThread {
            (led.background as GradientDrawable).setColor(color)
            // glow tint follows: amber/prep → subtle, green/red → strong
            val r = Color.red(color); val g = Color.green(color); val b = Color.blue(color)
            val alpha = when (color) {
                LED_OK, LED_FAILED -> 60
                else -> 26
            }
            (ledGlow.background as GradientDrawable).setColor(Color.argb(alpha, r, g, b))
        }
    }

    fun fadeOut(onDone: Runnable) {
        activity.runOnUiThread {
            overlay.animate()
                .alpha(0f)
                .setDuration(260)
                .withEndAction {
                    (overlay.parent as? ViewGroup)?.removeView(overlay)
                    onDone.run()
                }
                .start()
        }
    }
}
