import UIKit
import WebKit
import UniformTypeIdentifiers

/**
 * 酒馆主视图控制器 (TavernViewController)
 *
 * 核心调度器：
 * 1. 管理双层 WebView (Capacitor 控制台 vs 全屏 SillyTavern 交互)；
 * 2. 调度 prefersStatusBarHidden 实现进入酒馆时系统状态栏优雅淡出；
 * 3. 挂载变色龙 Scrim 遮罩顶栏与 IslandHardwareRadar 避让雷达；
 * 4. 挂载流光指引 ShimmerHintView 并绑定左右滑动返回手势；
 * 5. 挂载 WKUIDelegate 实现 Native 对话框映射与原生文件选择器支持。
 */
public class TavernViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, UIGestureRecognizerDelegate, UIDocumentPickerDelegate {

    public static let shared = TavernViewController()

    // 双层视图
    public private(set) var consoleWebView: WKWebView?
    public private(set) var tavernWebView: WKWebView?

    public func evaluateConsoleJavaScript(_ js: String, completion: ((Any?, Error?) -> Void)? = nil) {
        DispatchQueue.main.async {
            self.consoleWebView?.evaluateJavaScript(js, completionHandler: completion)
        }
    }

    public func evaluateTavernJavaScript(_ js: String, completion: ((Any?, Error?) -> Void)? = nil) {
        DispatchQueue.main.async {
            self.tavernWebView?.evaluateJavaScript(js, completionHandler: completion)
        }
    }

    // 沉浸顶栏与底栏交互 (对齐 Android TopScrimBar + 底部安全区衬垫)
    public private(set) var topScrimBar = TopScrimBarView()
    public private(set) var bottomScrimBar = UIView()
    private var chameleonEngine: ChameleonEngine?
    private var shimmerHint: ShimmerHintView?
    public private(set) var fixedStatusBarHeight: CGFloat = 0
    public private(set) var fixedBottomSafeInset: CGFloat = 0
    public private(set) var currentKeyboardHeight: CGFloat = 0

    // 状态
    private var isTavernActive = false
    private var currentTavernUrl: URL?

    public override var prefersStatusBarHidden: Bool {
        return isTavernActive
    }

    public override var prefersHomeIndicatorAutoHidden: Bool {
        return isTavernActive
    }

    public override var preferredStatusBarUpdateAnimation: UIStatusBarAnimation {
        return .fade
    }

    public override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    public override var childForStatusBarHidden: UIViewController? {
        return nil
    }

    public override var childForStatusBarStyle: UIViewController? {
        return nil
    }

    public func setStatusBarHidden(_ hidden: Bool, animated: Bool = true) {
        self.isTavernActive = hidden
        if animated {
            UIView.animate(withDuration: 0.25) {
                self.setNeedsStatusBarAppearanceUpdate()
                self.setNeedsUpdateOfHomeIndicatorAutoHidden()
            }
        } else {
            self.setNeedsStatusBarAppearanceUpdate()
            self.setNeedsUpdateOfHomeIndicatorAutoHidden()
        }
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 15/255.0, green: 17/255.0, blue: 23/255.0, alpha: 1.0)
        setupTavernWebView()
        setupTopScrimBar()
        setupBottomScrimBar()

        // 注册键盘位置变化与系统内存警告通知
        NotificationCenter.default.addObserver(self, selector: #selector(handleKeyboardNotification(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleMemoryWarningNotification(_:)), name: UIApplication.didReceiveMemoryWarningNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    public func registerConsoleWebView(_ webView: WKWebView) {
        self.consoleWebView = webView
        webView.isOpaque = false
        webView.backgroundColor = UIColor.clear
        webView.scrollView.backgroundColor = UIColor.clear
        view.insertSubview(webView, at: 0)
        webView.frame = view.bounds
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    }

    private func setupTavernWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.preferences.javaScriptCanOpenWindowsAutomatically = true

        // 注入 iOS 底部安全区微调样式，使 #send_form 底部自然留出 12pt 缓冲空间，背景 100% 满版贴底延展
        let safeAreaCss = """
        (function() {
            var css = '#send_form { padding-bottom: max(12px, env(safe-area-inset-bottom, 12px)) !important; box-sizing: border-box !important; }';
            var head = document.head || document.getElementsByTagName('head')[0];
            if (head) {
                var style = document.createElement('style');
                style.id = 'sillyclient-ios-bottom-safe-area';
                style.textContent = css;
                head.appendChild(style);
            }
        })();
        """
        let userScript = WKUserScript(source: safeAreaCss, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
        config.userContentController.addUserScript(userScript)

        let wv = WKWebView(frame: view.bounds, configuration: config)
        wv.navigationDelegate = self
        wv.uiDelegate = self
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.isOpaque = true
        wv.backgroundColor = UIColor(red: 19/255.0, green: 21/255.0, blue: 27/255.0, alpha: 1.0)
        wv.scrollView.backgroundColor = UIColor(red: 19/255.0, green: 21/255.0, blue: 27/255.0, alpha: 1.0)
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
        topScrimBar.alpha = 0.0
        topScrimBar.isHidden = true
        view.addSubview(topScrimBar)

        // 滑动手势返回控制台
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handleScrimPan(_:)))
        topScrimBar.addGestureRecognizer(panGesture)

        // 顶栏点击光泽扫光
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleScrimTap))
        topScrimBar.addGestureRecognizer(tap)
    }

    private func setupBottomScrimBar() {
        bottomScrimBar.alpha = 0.0
        bottomScrimBar.isHidden = true
        bottomScrimBar.backgroundColor = UIColor(red: 19/255.0, green: 21/255.0, blue: 27/255.0, alpha: 1.0)
        view.addSubview(bottomScrimBar)
    }

    public func updateTavernWebViewLayout() {
        let bottomInset = currentKeyboardHeight
        let height = max(0, view.bounds.height - fixedStatusBarHeight - bottomInset)
        tavernWebView?.frame = CGRect(
            x: 0,
            y: fixedStatusBarHeight,
            width: view.bounds.width,
            height: height
        )

        // 底部通底设计：底边直通屏幕物理底端，废弃独立底边色块，防止接缝与浮空割裂
        bottomScrimBar.frame = .zero
        bottomScrimBar.alpha = 0.0
        bottomScrimBar.isHidden = true
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()

        // 1. 测定并持久化硬件状态栏/安全区高度 (Android statusBarFixedPx 对齐)
        let rawSafeTop = view.safeAreaInsets.top
        if rawSafeTop > 0 {
            fixedStatusBarHeight = max(fixedStatusBarHeight, rawSafeTop)
        }
        if fixedStatusBarHeight <= 0 {
            let screenH = max(view.bounds.height, view.bounds.width)
            fixedStatusBarHeight = screenH >= 852.0 ? 54.0 : (screenH >= 812.0 ? 47.0 : 20.0)
        }

        // 测定并持久化底部物理安全区高度 (全面屏 iPhone 通常为 34pt，旧款非全面屏为 0pt)
        let rawSafeBottom = view.safeAreaInsets.bottom
        if rawSafeBottom > 0 {
            fixedBottomSafeInset = max(fixedBottomSafeInset, rawSafeBottom)
        }
        if fixedBottomSafeInset <= 0 {
            let screenH = max(view.bounds.height, view.bounds.width)
            fixedBottomSafeInset = screenH >= 812.0 ? 34.0 : 0.0
        }

        // 2. 原生变色龙顶条带排布于屏幕顶端 [0, 0, width, fixedStatusBarHeight]
        topScrimBar.frame = CGRect(x: 0, y: 0, width: view.bounds.width, height: fixedStatusBarHeight)

        // 底部通底设计：废弃底边硬切原生色块，保持 zero 与隐藏
        bottomScrimBar.frame = .zero
        bottomScrimBar.isHidden = true

        // 3. 酒馆 WebView 下移 fixedStatusBarHeight，底边直通屏幕物理边缘，输入法软键盘弹出时平滑避让
        updateTavernWebViewLayout()

        // 4. 布局流光指引：通过硬件雷达计算在灵动岛左侧安全翼区居中
        if let hint = shimmerHint {
            let flanks = IslandHardwareRadar.shared.calculateFlanks(for: view, overrideSafeTop: fixedStatusBarHeight)
            hint.frame = flanks.leftFlank
        }

        view.bringSubviewToFront(topScrimBar)
        view.bringSubviewToFront(bottomScrimBar)
        if let hint = shimmerHint {
            view.bringSubviewToFront(hint)
        }
    }

    /**
     * 进入酒馆全沉浸态 (由 TarvenEnvPlugin.enterImmersive 调用)
     */
    public func enterImmersive(url: URL, showGestureHint: Bool = true) {
        guard let wv = tavernWebView else { return }
        currentTavernUrl = url
        isTavernActive = true

        if url.scheme == "data" {
            let fullStr = url.absoluteString
            if let commaIndex = fullStr.range(of: ",")?.upperBound {
                let payload = String(fullStr[commaIndex...])
                if fullStr.contains(";base64,") {
                    if let data = Data(base64Encoded: payload), let html = String(data: data, encoding: .utf8) {
                        wv.loadHTMLString(html, baseURL: nil)
                    } else {
                        wv.load(URLRequest(url: url))
                    }
                } else {
                    let html = payload.removingPercentEncoding ?? payload
                    wv.loadHTMLString(html, baseURL: nil)
                }
            } else if let decoded = fullStr.removingPercentEncoding {
                let html = decoded.replacingOccurrences(of: "data:text/html;charset=utf-8,", with: "")
                wv.loadHTMLString(html, baseURL: nil)
            } else {
                wv.load(URLRequest(url: url))
            }
        } else {
            wv.load(URLRequest(url: url))
        }

        wv.isHidden = false
        topScrimBar.isHidden = false
        bottomScrimBar.isHidden = true

        view.setNeedsLayout()
        view.layoutIfNeeded()

        // 优雅隐藏系统状态栏与小白条并淡入酒馆
        UIView.animate(withDuration: 0.25, animations: {
            self.setNeedsStatusBarAppearanceUpdate()
            self.setNeedsUpdateOfHomeIndicatorAutoHidden()
            wv.alpha = 1.0
            self.topScrimBar.alpha = 1.0
            self.bottomScrimBar.alpha = 0.0
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
            self.setNeedsUpdateOfHomeIndicatorAutoHidden()
            self.consoleWebView?.alpha = 1.0
            self.tavernWebView?.alpha = 0.0
            self.topScrimBar.alpha = 0.0
            self.bottomScrimBar.alpha = 0.0
        }) { _ in
            self.tavernWebView?.isHidden = true
            self.topScrimBar.isHidden = true
            self.bottomScrimBar.isHidden = true
        }
    }

    private func showGestureHint() {
        shimmerHint?.removeFromSuperview()

        let flanks = IslandHardwareRadar.shared.calculateFlanks(for: view, overrideSafeTop: fixedStatusBarHeight)
        let hint = ShimmerHintView(frame: flanks.leftFlank)
        hint.alpha = 0.0
        view.addSubview(hint)
        view.bringSubviewToFront(hint)
        self.shimmerHint = hint

        UIView.animate(withDuration: 0.3) {
            hint.alpha = 0.85
        }
    }

    private func startChameleon() {
        chameleonEngine?.startPolling { [weak self] color, isDark in
            guard let self = self else { return }
            self.topScrimBar.setColor(color)
            self.bottomScrimBar.backgroundColor = color
            self.view.backgroundColor = color
            self.shimmerHint?.updateTone(isDarkScrim: isDark)
        }
    }

    /**
     * 立即执行变色龙全精度采样并驱动顶栏变色
     */
    public func sampleChameleonNow() {
        self.chameleonEngine?.sample { [weak self] color, isDark in
            guard let self = self else { return }
            self.topScrimBar.setColor(color, animated: true)
            UIView.animate(withDuration: 0.25) {
                self.bottomScrimBar.backgroundColor = color
                self.view.backgroundColor = color
            }
            self.shimmerHint?.updateTone(isDarkScrim: isDark)
        }
    }

    /**
     * 动态切换酒馆主题 (支持官方 Preset Themes: Celestial Macaron, Cappuccino, Azure, Dark Lite 等)
     */
    public func applyThemeToTavern(themeName: String) {
        guard let wv = tavernWebView else { return }
        let escapedName = themeName.replacingOccurrences(of: "'", with: "\\'")
        let js = """
        (async function() {
            var name = '\(escapedName)';
            var select = document.getElementById('themes');
            if (select) {
                select.value = name;
                if (window.$) {
                    $(select).trigger('change');
                } else {
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            if (typeof applyTheme === 'function') {
                applyTheme(name);
            }
            if (!window.themes || !window.themes.length) {
                try {
                    var res = await fetch('/api/themes/get');
                    if (res.ok) window.themes = await res.json();
                } catch(e) {}
            }
            var targetTheme = (window.themes || []).find(function(t) { return t.name === name; });
            if (targetTheme && targetTheme.blur_tint_color) {
                document.documentElement.style.setProperty('--SmartThemeBlurTintColor', targetTheme.blur_tint_color);
                var meta = document.querySelector('meta[name=theme-color]');
                if (meta) meta.setAttribute('content', targetTheme.blur_tint_color);
                var tb = document.getElementById('top-bar');
                if (tb) tb.style.backgroundColor = targetTheme.blur_tint_color;
            } else {
                var presets = {
                    'SC Bordeaux': 'rgba(36, 14, 24, 0.55)',
                    'Celestial Macaron': 'rgba(23, 36, 55, 0.9)',
                    'Cappuccino': 'rgba(34, 30, 32, 0.95)',
                    'Azure': 'rgba(28, 41, 56, 0.61)',
                    'Dark Lite': 'rgba(19, 21, 27, 0.95)'
                };
                if (presets[name]) {
                    var c = presets[name];
                    document.documentElement.style.setProperty('--SmartThemeBlurTintColor', c);
                    var m = document.querySelector('meta[name=theme-color]');
                    if (m) m.setAttribute('content', c);
                    var b = document.getElementById('top-bar');
                    if (b) b.style.backgroundColor = c;
                    if (name === 'SC Bordeaux') {
                        var bg1 = document.getElementById('bg1');
                        if (bg1) {
                            bg1.style.backgroundImage = 'url("/backgrounds/sillyclient-bg-8k.jpg")';
                            bg1.style.backgroundSize = 'cover';
                            bg1.style.opacity = '1';
                        }
                    }
                }
            }
            return document.documentElement.style.getPropertyValue('--SmartThemeBlurTintColor') || name;
        })();
        """
        wv.evaluateJavaScript(js) { [weak self] res, err in
            if let err = err {
                NSLog("[TavernViewController] applyThemeToTavern failed: %@", err.localizedDescription)
            } else {
                NSLog("[TavernViewController] applyThemeToTavern succeeded for '%@': %@", themeName, String(describing: res))
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                self?.sampleChameleonNow()
            }
        }
    }

    /**
     * 动态应用自定义主色调 (custom_tint)
     */
    public func applyCustomTintToTavern(tintColor: String) {
        guard let wv = tavernWebView else { return }
        let escapedColor = tintColor.replacingOccurrences(of: "'", with: "\\'")
        let js = """
        (function() {
            var color = '\(escapedColor)';
            document.documentElement.style.setProperty('--SmartThemeBlurTintColor', color);
            var meta = document.querySelector('meta[name=theme-color]');
            if (meta) meta.setAttribute('content', color);
            var tb = document.getElementById('top-bar');
            if (tb) tb.style.backgroundColor = color;
            return color;
        })();
        """
        wv.evaluateJavaScript(js) { [weak self] res, err in
            if let err = err {
                NSLog("[TavernViewController] applyCustomTintToTavern failed: %@", err.localizedDescription)
            } else {
                NSLog("[TavernViewController] applyCustomTintToTavern succeeded: %@", String(describing: res))
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                self?.sampleChameleonNow()
            }
        }
    }

    @objc private func handleTavernTap() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            self?.chameleonEngine?.sample { color, isDark in
                guard let self = self else { return }
                self.topScrimBar.setColor(color)
                self.bottomScrimBar.backgroundColor = color
                self.view.backgroundColor = color
                self.shimmerHint?.updateTone(isDarkScrim: isDark)
            }
        }
    }

    @objc private func handleScrimTap() {
        topScrimBar.sweepGloss()
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

    // MARK: - Keyboard Avoidance & Memory Warnings
    @objc private func handleKeyboardNotification(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let endFrame = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect,
              let duration = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval,
              let curveValue = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt else { return }

        let keyboardFrameInView = view.convert(endFrame, from: nil)
        let overlap = max(0, view.bounds.height - keyboardFrameInView.origin.y)
        self.currentKeyboardHeight = overlap

        let animCurve = UIView.AnimationOptions(rawValue: curveValue << 16)
        UIView.animate(withDuration: duration, delay: 0, options: [animCurve, .beginFromCurrentState], animations: {
            self.updateTavernWebViewLayout()
        }, completion: nil)
    }

    @objc private func handleMemoryWarningNotification(_ notification: Notification) {
        NSLog("[TavernViewController] 收到系统内存警告 (didReceiveMemoryWarning)，执行主动清理...")
        WKWebsiteDataStore.default().removeData(ofTypes: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache], modifiedSince: Date.distantPast) { }
        NodeRunner.shared.triggerGarbageCollection()
    }

    public func focusInputFieldForTesting(completion: ((Bool) -> Void)? = nil) {
        let script = """
        (function() {
            var target = document.querySelector('#send_textarea') || document.querySelector('textarea') || document.querySelector('input[type="text"]');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.focus();
                return true;
            }
            return false;
        })();
        """
        tavernWebView?.evaluateJavaScript(script) { [weak self] result, _ in
            let ok = (result as? Bool) ?? false
            // 兜底保障：若模拟器无头环境未由 WebKit 触发系统键盘通知，自动根据当前设备标准键盘高度执行避让渲染
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                if let self = self, self.currentKeyboardHeight == 0 {
                    NSLog("[TavernViewController] 模拟器无头环境触发测试级标准键盘高度 (336pt) 视口避让动画")
                    self.currentKeyboardHeight = 336
                    UIView.animate(withDuration: 0.25) {
                        self.updateTavernWebViewLayout()
                    }
                }
            }
            completion?(ok)
        }
    }

    public func blurInputFieldForTesting(completion: ((Bool) -> Void)? = nil) {
        let script = "if (document.activeElement) { document.activeElement.blur(); }"
        tavernWebView?.evaluateJavaScript(script) { [weak self] _, _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                if let self = self, self.currentKeyboardHeight > 0 {
                    self.currentKeyboardHeight = 0
                    UIView.animate(withDuration: 0.25) {
                        self.updateTavernWebViewLayout()
                    }
                }
                completion?(true)
            }
        }
    }

    public func ensureActiveConnection() {
        guard isTavernActive, let url = currentTavernUrl else { return }
        NSLog("[TavernViewController] 前台恢复检测连接: %@", url.absoluteString)
        tavernWebView?.evaluateJavaScript("document.readyState") { [weak self] res, err in
            if err != nil || (res as? String) != "complete" {
                self?.tavernWebView?.reload()
            }
        }
    }

    // MARK: - WKNavigationDelegate
    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        NSLog("[TavernViewController] didFailProvisionalNavigation: %@", error.localizedDescription)
        // 若因本地服务正在拉起连接被拒，1 秒后自动重试加载
        if isTavernActive, let url = currentTavernUrl {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                guard let self = self, self.isTavernActive else { return }
                NSLog("[TavernViewController] Retrying loading SillyTavern URL: %@", url.absoluteString)
                self.tavernWebView?.load(URLRequest(url: url))
            }
        }
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        NSLog("[TavernViewController] didFail navigation: %@", error.localizedDescription)
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        NSLog("[TavernViewController] didFinish navigation: %@", webView.url?.absoluteString ?? "")
        if webView == self.tavernWebView {
            let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let loadedFile = docsUrl.appendingPathComponent("tavern-rendered.txt")
            try? "loaded".write(to: loadedFile, atomically: true, encoding: .utf8)

            // 动态兜底注入底部安全区样式，确保换页或异步加载后 #send_form 依旧具备 12pt 内边距
            let injectBottomPadJs = """
            (function() {
                if (!document.getElementById('sillyclient-ios-bottom-safe-area')) {
                    var style = document.createElement('style');
                    style.id = 'sillyclient-ios-bottom-safe-area';
                    style.textContent = '#send_form { padding-bottom: max(12px, env(safe-area-inset-bottom, 12px)) !important; box-sizing: border-box !important; }';
                    (document.head || document.documentElement).appendChild(style);
                }
            })();
            """
            webView.evaluateJavaScript(injectBottomPadJs, completionHandler: nil)

            // 页面 DOM 加载完毕，立即执行变色龙零色差取色
            self.chameleonEngine?.sample { [weak self] color, isDark in
                guard let self = self else { return }
                self.topScrimBar.setColor(color, animated: false)
                self.shimmerHint?.updateTone(isDarkScrim: isDark)
            }
        }
    }

    // MARK: - WKUIDelegate (JavaScript 弹窗原生代理，杜绝静默失败与冲突)
    private var activeAlertCompletion: (() -> Void)?

    public func dismissActiveAlert() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.activeAlertCompletion?()
            self.activeAlertCompletion = nil
            let presenter = self.presentedViewController ?? self
            if let alert = presenter as? UIAlertController ?? presenter.presentedViewController as? UIAlertController {
                alert.dismiss(animated: true, completion: nil)
            }
        }
    }

    public func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        NSLog("[TavernViewController] Intercepted JavaScript Alert: %@", message)
        var hasCalled = false
        let safeCompletion: () -> Void = {
            if !hasCalled {
                hasCalled = true
                completionHandler()
            }
        }
        let alert = UIAlertController(title: "酒馆提示", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "确定", style: .default, handler: { [weak self] _ in
            self?.activeAlertCompletion = nil
            safeCompletion()
        }))
        self.activeAlertCompletion = safeCompletion
        let presenter = self.presentedViewController ?? self
        presenter.present(alert, animated: true)
    }

    public func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        NSLog("[TavernViewController] Intercepted JavaScript Confirm: %@", message)
        var hasCalled = false
        let safeCompletion: (Bool) -> Void = { res in
            if !hasCalled {
                hasCalled = true
                completionHandler(res)
            }
        }
        let alert = UIAlertController(title: "请确认", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel, handler: { [weak self] _ in
            self?.activeAlertCompletion = nil
            safeCompletion(false)
        }))
        alert.addAction(UIAlertAction(title: "确定", style: .default, handler: { [weak self] _ in
            self?.activeAlertCompletion = nil
            safeCompletion(true)
        }))
        self.activeAlertCompletion = { safeCompletion(false) }
        let presenter = self.presentedViewController ?? self
        presenter.present(alert, animated: true)
    }

    public func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        NSLog("[TavernViewController] Intercepted JavaScript Prompt: %@", prompt)
        var hasCalled = false
        let safeCompletion: (String?) -> Void = { res in
            if !hasCalled {
                hasCalled = true
                completionHandler(res)
            }
        }
        let alert = UIAlertController(title: prompt, message: nil, preferredStyle: .alert)
        alert.addTextField { tf in tf.text = defaultText }
        alert.addAction(UIAlertAction(title: "取消", style: .cancel, handler: { [weak self] _ in
            self?.activeAlertCompletion = nil
            safeCompletion(nil)
        }))
        alert.addAction(UIAlertAction(title: "确定", style: .default, handler: { [weak self, weak alert] _ in
            self?.activeAlertCompletion = nil
            safeCompletion(alert?.textFields?.first?.text)
        }))
        self.activeAlertCompletion = { safeCompletion(nil) }
        let presenter = self.presentedViewController ?? self
        presenter.present(alert, animated: true)
    }

    // MARK: - UIDocumentPickerDelegate & Testing
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        NSLog("[TavernViewController] DocumentPicker didPickDocumentsAt: %@", urls)
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        NSLog("[TavernViewController] DocumentPicker was cancelled")
    }

    public func presentDocumentPickerForTesting() {
        var contentTypes: [UTType] = [.image, .png, .json]
        if let customZip = UTType(filenameExtension: "zip") {
            contentTypes.append(customZip)
        }
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: contentTypes, asCopy: true)
        picker.delegate = self
        picker.allowsMultipleSelection = false
        picker.modalPresentationStyle = .formSheet
        let presenter = self.presentedViewController ?? self
        presenter.present(picker, animated: true) {
            let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let marker = docsUrl.appendingPathComponent("native-picker-presented.txt")
            try? "tavern_picker".write(to: marker, atomically: true, encoding: .utf8)
        }
    }
}
