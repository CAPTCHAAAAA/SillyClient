import UIKit

/**
 * 顶框 scrim 取色数学算法 (TopColor)
 *
 * 100% 镜像 Android 端 com.sillyclient.ui.TopColor：
 * 1. 渐变三段（自上而下）：顶 45% / 中 80% / 底 100% 页面色 ——
 *    顶部压暗藏系统灵动岛/前摄黑区，底部满色无缝衔接 WebView；
 * 2. 换色时自下而上色波平滑过渡；
 * 3. 亮度判定基于 Rec.601，驱动流光指引文字明暗自适应。
 */
public enum TopColor {
    
    public static let lumaThreshold: CGFloat = 0.6
    
    /**
     * 按系数压暗（RGB *= factor，保持 alpha 1.0）
     */
    public static func darken(color: UIColor, factor: CGFloat) -> UIColor {
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        
        if color.getRed(&r, green: &g, blue: &b, alpha: &a) {
            let f = max(0.0, min(1.0, factor))
            return UIColor(
                red: max(0.0, min(1.0, r * f)),
                green: max(0.0, min(1.0, g * f)),
                blue: max(0.0, min(1.0, b * f)),
                alpha: 1.0
            )
        }
        return color
    }
    
    /**
     * 两色线性插值 (lerp)
     */
    public static func lerp(from: UIColor, to: UIColor, t: CGFloat) -> UIColor {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        
        from.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        to.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        
        let clampedT = max(0.0, min(1.0, t))
        return UIColor(
            red: r1 + (r2 - r1) * clampedT,
            green: g1 + (g2 - g1) * clampedT,
            blue: b1 + (b2 - b1) * clampedT,
            alpha: 1.0
        )
    }
    
    /**
     * scrim 三段渐变 stops：[顶 45%, 中 80%, 底 100%]
     */
    public static func scrimStops(for color: UIColor) -> [UIColor] {
        return [
            darken(color: color, factor: 0.45),
            darken(color: color, factor: 0.80),
            color.withAlphaComponent(1.0)
        ]
    }
    
    /**
     * Rec. 601 亮度判定：是否为暗色
     */
    public static func isDark(color: UIColor) -> Bool {
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        
        if color.getRed(&r, green: &g, blue: &b, alpha: &a) {
            let luma = 0.299 * r + 0.587 * g + 0.114 * b
            return luma < lumaThreshold
        }
        return true
    }
}
