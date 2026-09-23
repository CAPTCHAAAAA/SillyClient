import UIKit

/**
 * 顶框变色龙色彩数学引擎 (TopColor)
 *
 * 彻底解决 iOS 顶栏色差核心方案：
 * 1. 淘汰老旧 45%/80% 暴力压暗导致的死黑断层色差；
 * 2. 提供 100% 满色无缝熔接 stops [color, color, color]；
 * 3. 顶端、中端、底端与 WebView 首行像素实现完全一致的纯正色彩，
 *    使酒馆顶栏与变色龙顶条带视觉上融为一体，硬件灵动岛自然嵌于统一背景中；
 * 4. Rec. 601 亮度判定：驱动流光手势提示文字智能适配黑白底色。
 */
public enum TopColor {
    
    public static let lumaThreshold: CGFloat = 0.6
    
    /**
     * 按系数微调亮度（RGB *= factor，保持 alpha 1.0）
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
     * 变色龙零色差无缝熔接 stops：[100% 页面色, 100% 页面色, 100% 页面色]
     * 顶底全宽满色，彻底杜绝断层色差，与 WebView 首行 0 误差像素熔接
     */
    public static func scrimStops(for color: UIColor) -> [UIColor] {
        let full = color.withAlphaComponent(1.0)
        return [
            full,
            full,
            full
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
