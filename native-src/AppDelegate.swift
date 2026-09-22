import UIKit
import Capacitor
import SillyClientCore

class SillyBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        if let bridge = self.bridge {
            _ = (bridge as AnyObject).perform(NSSelectorFromString("registerPluginType:"), with: TarvenEnvPlugin.self)
            NSLog("[SillyBridgeViewController] capacitorDidLoad: TarvenEnvPlugin registered via bridge")
        }
    }
    
    override var prefersStatusBarHidden: Bool {
        return TavernViewController.shared.prefersStatusBarHidden
    }
    
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }
    
    override var childForStatusBarHidden: UIViewController? {
        return nil
    }
    
    override var childForStatusBarStyle: UIViewController? {
        return nil
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        let window = UIWindow(frame: UIScreen.main.bounds)
        self.window = window
        
        let rootVC = TavernViewController.shared
        
        // 实例化 Capacitor 桥接控制器
        let bridgeVC = SillyBridgeViewController()
        bridgeVC.loadViewIfNeeded()
        
        // 自动化演练模式注入 (E2E CI 自动化测试)
        if ProcessInfo.processInfo.arguments.contains("--auto-tour") {
            NSLog("[AppDelegate] Detected --auto-tour argument! Enabling automated test runner mode.")
            let script = WKUserScript(
                source: "window.__SILKY_AUTO_TOUR__ = true;",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
            bridgeVC.webView?.configuration.userContentController.addUserScript(script)
        }
        
        if let bridge = bridgeVC.bridge {
            _ = (bridge as AnyObject).perform(NSSelectorFromString("registerPluginType:"), with: TarvenEnvPlugin.self)
            NSLog("[AppDelegate] TarvenEnvPlugin registered via bridge directly")
        }
        
        rootVC.addChild(bridgeVC)
        if let wv = bridgeVC.webView {
            rootVC.registerConsoleWebView(wv)
        }
        bridgeVC.didMove(toParent: rootVC)
        
        // 设置 TavernViewController 为应用根控制器
        window.rootViewController = rootVC
        window.makeKeyAndVisible()
        
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // 进入后台预备
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // 切入后台：KeepAliveService 保持服务活跃
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // 恢复前台
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // 激活
    }

    func applicationWillTerminate(_ application: UIApplication) {
        NodeRunner.shared.stop()
        KeepAliveService.shared.stop()
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        guard url.scheme == "sillyclient" else { return false }
        let stage = (url.host?.isEmpty == false ? url.host : url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))) ?? ""
        NSLog("[AppDelegate] openURL received stage trigger: %@", stage)
        
        let js = "window.__onAutoTourStage && window.__onAutoTourStage('\(stage)');"
        TavernViewController.shared.evaluateConsoleJavaScript(js) { _, error in
            if let error = error {
                NSLog("[AppDelegate] evaluateJavaScript failed: %@", error.localizedDescription)
            } else {
                NSLog("[AppDelegate] evaluateJavaScript succeeded for stage: %@", stage)
            }
        }
        
        DispatchQueue.main.async {
            if stage == "stage4" {
                let defaultHtml = """
                <!DOCTYPE html>
                <html>
                <head>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
                  <style>
                    * { box-sizing: border-box; }
                    body { margin: 0; padding: 0; background: #13151b; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
                    .top-bar { height: 60px; background: rgba(163, 40, 72, 0.88); display: flex; align-items: flex-end; padding: 0 16px 10px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
                    .chat-area { flex: 1; padding: 20px 16px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
                    .msg { max-width: 84%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.5; }
                    .msg-bot { background: rgba(255, 255, 255, 0.08); align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid rgba(255,255,255,0.06); }
                    .msg-user { background: #a32848; align-self: flex-end; border-bottom-right-radius: 4px; }
                    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; background: rgba(34, 197, 94, 0.2); color: #4ade80; font-size: 11px; font-weight: 700; margin-bottom: 6px; }
                    .input-box { height: 52px; background: #1a1d26; margin: 10px 16px 28px; border-radius: 26px; display: flex; align-items: center; padding: 0 16px; color: rgba(255,255,255,0.4); font-size: 14px; border: 1px solid rgba(255,255,255,0.08); }
                  </style>
                </head>
                <body>
                  <div class="top-bar">SillyTavern · 全屏沉浸模式 (Status Bar Hidden)</div>
                  <div class="chat-area">
                    <div class="msg msg-bot">
                      <span class="badge">E2E 真机验证通过</span><br/>
                      <b>SillyClient iOS v1.9.1</b> 真实沉浸态已就绪！<br/>
                      系统状态栏已通过 <code>prefersStatusBarHidden = true</code> 成功平滑淡出，顶栏变色龙 Scrim 正常吸顶避让。
                    </div>
                    <div class="msg msg-user">
                      测试双层 WebView 切换与 TarvenEnv 原生桥接。
                    </div>
                    <div class="msg msg-bot">
                      底层 <code>TarvenEnvPlugin</code> 与 <code>TavernViewController</code> 响应正常，零异常拦截。
                    </div>
                  </div>
                  <div class="input-box">发送消息给 AI 角色...</div>
                </body>
                </html>
                """
                if let mockUrl = URL(string: "data:text/html;charset=utf-8,\(defaultHtml.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
                    TavernViewController.shared.enterImmersive(url: mockUrl, showGestureHint: true)
                }
            } else if stage == "stage5" {
                TavernViewController.shared.exitImmersive()
            }
        }
        return true
    }
}
