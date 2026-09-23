import UIKit

/**
 * 流光文字指引与手势提示组件 (ShimmerHintView)
 *
 * 完整对齐 Android TavernStatusHint：
 * 1. 采用 CAGradientLayer 硬件加速实现无卡顿 5 秒循环流光动效；
 * 2. 依托 IslandHardwareRadar 动态约束在灵动岛左侧安全翼区，绝无遮挡；
 * 3. 随变色龙取色实时自适应文字明暗反差；
 * 4. 首次成功滑动返回后记入 UserDefaults，优雅淡出不再打扰。
 */
public class ShimmerHintView: UIView {

    private static let userDefaultsKey = "sillyclient_ios_gesture_hint_used"
    private static let hintText = "左右滑动返回"

    private let label = UILabel()
    private let gradientLayer = CAGradientLayer()
    private var isDarkTone = true

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupViews()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupViews()
    }

    private func setupViews() {
        isUserInteractionEnabled = false
        backgroundColor = .clear

        label.text = ShimmerHintView.hintText
        label.font = UIFont.systemFont(ofSize: 12.5, weight: .medium)
        label.textAlignment = .center
        label.adjustsFontSizeToFitWidth = true
        label.minimumScaleFactor = 0.75
        label.lineBreakMode = .byClipping
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)

        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: leadingAnchor),
            label.trailingAnchor.constraint(equalTo: trailingAnchor),
            label.topAnchor.constraint(equalTo: topAnchor),
            label.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])

        // CAGradientLayer 流光遮罩
        gradientLayer.startPoint = CGPoint(x: 0.0, y: 0.5)
        gradientLayer.endPoint = CGPoint(x: 1.0, y: 0.5)
        updateGradientColors()

        layer.mask = gradientLayer
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        gradientLayer.frame = CGRect(x: -bounds.width, y: 0, width: bounds.width * 3, height: bounds.height)
        startShimmer()
    }

    public func startShimmer() {
        gradientLayer.removeAnimation(forKey: "shimmerAnimation")

        let animation = CABasicAnimation(keyPath: "transform.translation.x")
        animation.fromValue = -bounds.width
        animation.toValue = bounds.width
        animation.duration = 4.5
        animation.repeatCount = .infinity
        animation.timingFunction = CAMediaTimingFunction(name: .linear)

        gradientLayer.add(animation, forKey: "shimmerAnimation")
    }

    public func stopShimmer() {
        gradientLayer.removeAnimation(forKey: "shimmerAnimation")
    }

    /**
     * 变色龙取色变化时调整文字明暗
     */
    public func updateTone(isDarkScrim: Bool) {
        guard isDarkTone != isDarkScrim else { return }
        isDarkTone = isDarkScrim
        updateGradientColors()
    }

    private func updateGradientColors() {
        if isDarkTone {
            label.textColor = UIColor(white: 0.95, alpha: 1.0)
            gradientLayer.colors = [
                UIColor(white: 1.0, alpha: 0.35).cgColor,
                UIColor(white: 1.0, alpha: 1.0).cgColor,
                UIColor(white: 1.0, alpha: 0.35).cgColor
            ]
        } else {
            label.textColor = UIColor(white: 0.15, alpha: 1.0)
            gradientLayer.colors = [
                UIColor(white: 0.0, alpha: 0.35).cgColor,
                UIColor(white: 0.0, alpha: 1.0).cgColor,
                UIColor(white: 0.0, alpha: 0.35).cgColor
            ]
        }
        gradientLayer.locations = [0.0, 0.5, 1.0]
    }

    /**
     * 检查用户是否已经掌握手势
     */
    public static var isUsed: Bool {
        return UserDefaults.standard.bool(forKey: userDefaultsKey)
    }

    /**
     * 标记已学会，永久淡出
     */
    public static func markUsed() {
        UserDefaults.standard.set(true, forKey: userDefaultsKey)
    }

    public func dismiss(animated: Bool = true) {
        if animated {
            UIView.animate(withDuration: 0.25, animations: {
                self.alpha = 0.0
            }) { _ in
                self.stopShimmer()
                self.removeFromSuperview()
            }
        } else {
            stopShimmer()
            removeFromSuperview()
        }
    }
}
