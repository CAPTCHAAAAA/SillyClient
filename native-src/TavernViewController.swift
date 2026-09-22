import UIKit
import WebKit

/**
 * 酒馆主视图控制器 (TavernViewController)
 *
 * 核心调度器：
 * 1. 管理双层 WebView (Capacitor 控制台 vs 全屏 SillyTavern 交互)；
 * 2. 调度 prefersStatusBarHidden 实现进入酒馆时系统状态栏优雅淡出；
 * 3. 挂载变色龙 Scrim 遮罩顶栏与 IslandHardwareRadar 避让雷达；
 * 4. 挂载流光指引 ShimmerHintView 并绑定左右滑动返回手势。
 */
public class TavernViewController: UIViewController, WKNavigationDelegate, UIGestureRecognizerDelegate {
    
    public static let shared = TavernViewController()
    
    // 双层视图
    private var consoleWebView: WKWebView?
    private var tavernWebView: WKWebView?
    
    // 沉浸顶栏与交互
    private let topScrimBar = UIView()
    private let sweepGlossView = UIView()
    private var chameleonEngine: ChameleonEngine?
    private var shimmerHint: ShimmerHintView?
    
    // 状态
    private var isTavernActive = false
    private var currentTavernUrl: URL?
    
    public override var prefersStatusBarHidden: Bool {
        return isTavernActive
    }
    
    public override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation {
        return .fade
    }
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 15/255.0, green: 17/255.0, blue: 23/255.0, alpha: 1.0)
        setupTavernWebView()
        setupTopScrimBar()
    }
    
    public func registerConsoleWebView(_ webView: WKWebView) {
        self.consoleWebView = webView
        view.insertSubview(webView, at: 0)
        webView.frame = view.bounds
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    }
    
    private func setupTavernWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        
        let wv = WKWebView(frame: view.bounds, configuration: config)
        wv.navigationDelegate = self
        wv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.alpha = 0.0
        wv.isHidden = true
        view.addSubview(wv)
        self.tavernWebView = wv
        
        self.chameleonEngine = ChameleonEngine(webView: wv)
        
        // 绑定触控抬手变色龙采样
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTavernTap))
        tapGesture.delegate = self
        wv.addGestureRecognizer(tapGesture)
    }
    
    private func setupTopScrimBar() {
        topScrimBar.backgroundColor = UIColor(red: 163/255.0, green: 40/255.0, blue: 72/255.0, alpha: 0.7) // SC Bordeaux
        topScrimBar.alpha = 0.0
        topScrimBar.isHidden = true
        view.addSubview(topScrimBar)
        
        // 点击微光动画层
        sweepGlossView.backgroundColor = UIColor(white: 1.0, alpha: 0.2)
        sweepGlossView.alpha = 0.0
        topScrimBar.addSubview(sweepGlossView)
        
        // 滑动手势返回控制台
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handleScrimPan(_:)))
        topScrimBar.addGestureRecognizer(panGesture)
        
        // 顶栏点击波纹
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleScrimTap))
        topScrimBar.addGestureRecognizer(tap)
    }
    
    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        
        let safeTop = view.safeAreaInsets.top > 0 ? view.safeAreaInsets.top : 44.0
        let barHeight: CGFloat = safeTop + 16.0
        topScrimBar.frame = CGRect(x: 0, y: 0, width: view.bounds.width, height: barHeight)
        sweepGlossView.frame = topScrimBar.bounds
        
        // 布局流光指引：通过硬件雷达计算避让区
        if let hint = shimmerHint {
            let flanks = IslandHardwareRadar.shared.calculateFlanks(for: view)
            hint.frame = flanks.leftFlank
        }
    }
    
    /**
     * 进入酒馆全沉浸态 (由 TarvenEnvPlugin.enterImmersive 调用)
     */
    public func enterImmersive(url: URL, showGestureHint: Bool = true) {
        guard let wv = tavernWebView else { return }
        currentTavernUrl = url
        isTavernActive = true
        
        wv.load(URLRequest(url: url))
        wv.isHidden = false
        topScrimBar.isHidden = false
        
        // 优雅隐藏系统状态栏并淡入酒馆
        UIView.animate(withDuration: 0.25, animations: {
            self.setNeedsStatusBarAppearanceUpdate()
            wv.alpha = 1.0
            self.topScrimBar.alpha = 1.0
            self.consoleWebView?.alpha = 0.0
        }) { _ in
            self.consoleWebView?.isHidden = true
            self.startChameleon()
            
            // 首次进入挂载流光文字指引
            if showGestureHint && !ShimmerHintView.isUsed {
                self.showGestureHint()
            }
        }
    }
    
    /**
     * 退出沉浸态返回控制台
     */
    public func exitImmersive() {
        guard isTavernActive else { return }
        isTavernActive = false
        
        consoleWebView?.isHidden = false
        chameleonEngine?.stopPolling()
        shimmerHint?.dismiss(animated: false)
        
        UIView.animate(withDuration: 0.25, animations: {
            self.setNeedsStatusBarAppearanceUpdate()
            self.consoleWebView?.alpha = 1.0
            self.tavernWebView?.alpha = 0.0
            self.topScrimBar.alpha = 0.0
        }) { _ in
            self.tavernWebView?.isHidden = true
            self.topScrimBar.isHidden = true
        }
    }
    
    private func showGestureHint() {
        shimmerHint?.removeFromSuperview()
        
        let flanks = IslandHardwareRadar.shared.calculateFlanks(for: view)
        let hint = ShimmerHintView(frame: flanks.leftFlank)
        hint.alpha = 0.0
        view.addSubview(hint)
        self.shimmerHint = hint
        
        UIView.animate(withDuration: 0.3) {
            hint.alpha = 0.85
        }
    }
    
    private func startChameleon() {
        chameleonEngine?.startPolling { [weak self] color, isDark in
            guard let self = self else { return }
            UIView.animate(withDuration: 0.25) {
                self.topScrimBar.backgroundColor = color.withAlphaComponent(0.72)
                self.shimmerHint?.updateTone(isDarkScrim: isDark)
            }
        }
    }
    
    @objc private func handleTavernTap() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            self?.chameleonEngine?.sample { color, isDark in
                UIView.animate(withDuration: 0.2) {
                    self?.topScrimBar.backgroundColor = color.withAlphaComponent(0.72)
                    self?.shimmerHint?.updateTone(isDarkScrim: isDark)
                }
            }
        }
    }
    
    @objc private func handleScrimTap() {
        // 白色扫光动效
        sweepGlossView.alpha = 1.0
        UIView.animate(withDuration: 0.35, animations: {
            self.sweepGlossView.alpha = 0.0
        })
    }
    
    @objc private func handleScrimPan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: topScrimBar)
        if gesture.state == .ended || gesture.state == .cancelled {
            if abs(translation.x) > 60.0 {
                // 左右滑动触发返回
                ShimmerHintView.markUsed()
                shimmerHint?.dismiss()
                exitImmersive()
            }
        }
    }
    
    public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        return true
    }
}
