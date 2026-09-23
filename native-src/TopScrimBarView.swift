import UIKit

/**
 * 酒馆顶部自适应原生 Scrim 条带 (TopScrimBarView)
 *
 * 100% 镜像 Android 端 com.sillyclient.ui.TopScrimBar：
 * 1. 纯视觉独立顶栏：占据屏幕顶部 [0, 0, width, statusBarHeight]；
 * 2. Scrim 三段垂直渐变：[顶 45% / 中 80% / 底 100% 页面色]；
 *    顶部压暗掩映灵动岛黑区，底部满色 100% 与下方 WebView 顶端首行像素无缝平滑熔接；
 * 3. Gloss 独立白色光泽：顶部 30% 范围，轻触时触发 2400ms 优雅扫光波纹；
 * 4. 色波动画：当酒馆换色时，三段 Stops 自平滑渐变过渡。
 */
public class TopScrimBarView: UIView {
    
    private let scrimGradientLayer = CAGradientLayer()
    private let glossView = UIView()
    private let glossGradientLayer = CAGradientLayer()
    
    // 默认起始基线暗色 [顶 45%, 中 80%, 底 100%]
    private var currentTargetColor: UIColor = UIColor(red: 25/255.0, green: 27/255.0, blue: 33/255.0, alpha: 1.0)
    
    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupLayers()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupLayers()
    }
    
    private func setupLayers() {
        isUserInteractionEnabled = true
        backgroundColor = .clear
        
        // 1. 三段垂直渐变层
        scrimGradientLayer.startPoint = CGPoint(x: 0.5, y: 0.0)
        scrimGradientLayer.endPoint = CGPoint(x: 0.5, y: 1.0)
        scrimGradientLayer.locations = [0.0, 0.5, 1.0]
        
        let initialStops = TopColor.scrimStops(for: currentTargetColor)
        scrimGradientLayer.colors = initialStops.map { $0.cgColor }
        layer.addSublayer(scrimGradientLayer)
        
        // 2. 顶部 30% 白色扫光层 (Gloss)
        glossView.isUserInteractionEnabled = false
        glossView.alpha = 0.0
        glossView.backgroundColor = .clear
        
        glossGradientLayer.startPoint = CGPoint(x: 0.5, y: 0.0)
        glossGradientLayer.endPoint = CGPoint(x: 0.5, y: 1.0)
        glossGradientLayer.colors = [
            UIColor(white: 1.0, alpha: 0.12).cgColor,
            UIColor(white: 1.0, alpha: 0.0).cgColor
        ]
        glossView.layer.addSublayer(glossGradientLayer)
        addSubview(glossView)
    }
    
    public override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        
        scrimGradientLayer.frame = bounds
        
        let glossH = max(1.0, bounds.height * 0.30)
        glossView.frame = CGRect(x: 0, y: 0, width: bounds.width, height: glossH)
        glossGradientLayer.frame = glossView.bounds
        
        CATransaction.commit()
    }
    
    /**
     * 响应变色龙取色：应用新页面色驱动自下而上色波
     */
    public func setColor(_ color: UIColor, animated: Bool = true) {
        self.currentTargetColor = color
        let stops = TopColor.scrimStops(for: color)
        let newCGColors = stops.map { $0.cgColor }
        
        if animated {
            let animation = CABasicAnimation(keyPath: "colors")
            animation.fromValue = scrimGradientLayer.colors
            animation.toValue = newCGColors
            animation.duration = 1.2
            animation.timingFunction = CAMediaTimingFunction(controlPoints: 0.2, 0.0, 0.2, 1.0)
            animation.fillMode = .forwards
            animation.isRemovedOnCompletion = false
            scrimGradientLayer.add(animation, forKey: "colorTransition")
            scrimGradientLayer.colors = newCGColors
        } else {
            scrimGradientLayer.colors = newCGColors
        }
    }
    
    /**
     * 点击触发 2400ms 渐显/保持/渐隐的白色光波（镜像 Android TopScrimBar.sweepGloss）
     */
    public func sweepGloss() {
        glossView.layer.removeAllAnimations()
        glossView.alpha = 0.0
        
        UIView.animateKeyframes(withDuration: 2.4, delay: 0, options: [.calculationModeCubic], animations: {
            UIView.addKeyframe(withRelativeStartTime: 0.0, relativeDuration: 0.25) {
                self.glossView.alpha = 1.0
            }
            UIView.addKeyframe(withRelativeStartTime: 0.25, relativeDuration: 0.40) {
                self.glossView.alpha = 1.0
            }
            UIView.addKeyframe(withRelativeStartTime: 0.65, relativeDuration: 0.35) {
                self.glossView.alpha = 0.0
            }
        }, completion: nil)
    }
}
