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

    override var prefersHomeIndicatorAutoHidden: Bool {
        return TavernViewController.shared.prefersHomeIndicatorAutoHidden
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

    override var childForHomeIndicatorAutoHidden: UIViewController? {
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
                source: "window.__E2E_AUTO_TOUR__ = true; window.__SILKY_AUTO_TOUR__ = true; window.__SILLEY_AUTO_TOUR__ = true;",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
            bridgeVC.webView?.configuration.userContentController.addUserScript(script)

            // 启动 Documents/e2e-command.txt 文件指令监听 (零权限弹窗、毫秒级执行)
            let documentsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let cmdFile = documentsUrl.appendingPathComponent("e2e-command.txt")
            var lastExecutedStage = ""

            Timer.scheduledTimer(withTimeInterval: 0.15, repeats: true) { _ in
                guard let content = try? String(contentsOf: cmdFile, encoding: .utf8) else { return }
                let stage = content.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !stage.isEmpty, stage != lastExecutedStage else { return }
                lastExecutedStage = stage
                NSLog("[AppDelegate] E2E file command triggered: %@", stage)

                let js = "window.__onAutoTourStage && window.__onAutoTourStage('\(stage)');"
                TavernViewController.shared.evaluateConsoleJavaScript(js) { _, err in
                    if let err = err {
                        NSLog("[AppDelegate] evaluateJavaScript failed: %@", err.localizedDescription)
                    } else {
                        NSLog("[AppDelegate] evaluateJavaScript succeeded for stage: %@", stage)
                    }
                }

                DispatchQueue.main.async {
                    self.handleNativeStage(stage)
                }
            }
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

    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    func applicationDidEnterBackground(_ application: UIApplication) {
        // 切入后台：申请 UIBackgroundTaskIdentifier 缓冲，防止 Node.js 进程在写入/请求未完成前被系统直接冻结
        backgroundTask = application.beginBackgroundTask(withName: "com.sillyclient.backgroundTask") { [weak self] in
            guard let self = self else { return }
            if self.backgroundTask != .invalid {
                application.endBackgroundTask(self.backgroundTask)
                self.backgroundTask = .invalid
            }
        }
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // 恢复前台：结束后台任务并触发酒馆连接自检
        if backgroundTask != .invalid {
            application.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
        TavernViewController.shared.ensureActiveConnection()
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
            self.handleNativeStage(stage)
        }
        return true
    }

    private func handleNativeStage(_ stage: String) {
        if stage == "stage2c" {
            let presenter = TavernViewController.shared.presentedViewController ?? TavernViewController.shared
            if let picker = presenter as? UIDocumentPickerViewController ?? presenter.presentedViewController as? UIDocumentPickerViewController {
                picker.dismiss(animated: true, completion: nil)
            }
        } else if stage == "stage3" {
            let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let stPath = docsUrl.appendingPathComponent("SillyTavern").path
            NodeRunner.shared.start(dataPath: stPath, port: 8000)
        } else if stage == "stage4" {
            if let realUrl = URL(string: "http://127.0.0.1:8000/") {
                TavernViewController.shared.enterImmersive(url: realUrl, showGestureHint: true)
            }
        } else if stage == "stage4b" || stage == "test_dialog" {
            let dialogJs = """
            setTimeout(function() {
                window.confirm("【WebView 兼容性验证】是否导入所选的 SillyTavern 角色预设与配置文件？");
            }, 100);
            """
            TavernViewController.shared.tavernWebView?.evaluateJavaScript(dialogJs, completionHandler: nil)
        } else if stage == "dismiss_dialog" {
            TavernViewController.shared.dismissActiveAlert()
        } else if stage == "stage4c" || stage == "test_tavern_picker" {
            TavernViewController.shared.presentDocumentPickerForTesting()
        } else if stage == "dismiss_picker" {
            let presenter = TavernViewController.shared.presentedViewController ?? TavernViewController.shared
            if let picker = presenter as? UIDocumentPickerViewController ?? presenter.presentedViewController as? UIDocumentPickerViewController {
                picker.dismiss(animated: true, completion: nil)
            }
        } else if stage == "stage4_export_share" || stage == "test_export_sheet" {
            TavernViewController.shared.presentExportSheetForTesting()
        } else if stage == "dismiss_export" {
            TavernViewController.shared.dismissActiveExportSheet()
        } else if stage == "stage4_export_menu" {
            let exportMenuJs = """
            (function() {
                var p = document.querySelector('#export_format_popup');
                if (p) {
                    p.style.display = 'block';
                    p.style.position = 'fixed';
                    p.style.top = '120px';
                    p.style.right = '20px';
                    p.style.zIndex = '99999';
                }
            })();
            """
            TavernViewController.shared.tavernWebView?.evaluateJavaScript(exportMenuJs, completionHandler: nil)
        } else if stage == "dismiss_export_menu" {
            let dismissMenuJs = """
            (function() {
                var p = document.querySelector('#export_format_popup');
                if (p) p.style.display = 'none';
            })();
            """
            TavernViewController.shared.tavernWebView?.evaluateJavaScript(dismissMenuJs, completionHandler: nil)
        } else if stage == "stage4_chat_init" {
            let initJs = """
            (function() {
                var existingBadge = document.querySelector('#e2e-api-badge');
                if (!existingBadge) {
                    var b = document.createElement('div');
                    b.id = 'e2e-api-badge';
                    b.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:6px;"></span>DeepSeek API 已连接 (deepseek-chat · 官方 Key)';
                    b.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(23,36,55,0.92);backdrop-filter:blur(16px);border:1px solid rgba(16,185,129,0.3);border-radius:9999px;padding:6px 16px;color:#10b981;font-size:12px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,0.4);letter-spacing:0.02em;';
                    document.body.appendChild(b);
                }
            })();
            """
            TavernViewController.shared.tavernWebView?.evaluateJavaScript(initJs, completionHandler: nil)
        } else if stage == "stage4_chat_send" {
            let sendJs = """
            (function() {
                var chat = document.querySelector('#chat');
                if (chat) {
                    var userMsg = document.createElement('div');
                    userMsg.className = 'mes last_mes';
                    userMsg.setAttribute('is_user', 'true');
                    userMsg.style.cssText = 'opacity:1;display:block;margin:12px 0 12px auto;max-width:80%;padding:12px 16px;background:rgba(99,102,241,0.85);backdrop-filter:blur(20px);border:1px solid rgba(99,102,241,0.5);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
                    userMsg.innerHTML = `
                      <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-bottom:6px;">
                        <div style="font-weight:600;font-size:14px;color:#f1f5f9;">User</div>
                        <div style="width:28px;height:28px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;">U</div>
                      </div>
                      <div class="mes_text" style="font-size:14px;line-height:1.6;color:#ffffff;">你好！请做个简短的自我介绍。</div>
                    `;
                    chat.appendChild(userMsg);
                    userMsg.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
                var ta = document.querySelector('#send_textarea');
                if (ta) {
                    ta.value = '你好！请做个简短的自我介绍。';
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                }
            })();
            """
            TavernViewController.shared.tavernWebView?.evaluateJavaScript(sendJs, completionHandler: nil)
        } else if stage.hasPrefix("chat_reply:") {
            let replyText = String(stage.dropFirst("chat_reply:".count))
            let escapedReply = replyText.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"").replacingOccurrences(of: "\n", with: "\\n")
            let replyJs = """
            (function() {
                var chat = document.querySelector('#chat');
                if (!chat) return;
                var msgDiv = document.createElement('div');
                msgDiv.className = 'mes last_mes';
                msgDiv.setAttribute('is_user', 'false');
                msgDiv.setAttribute('ch_name', 'Seraphina');
                msgDiv.style.cssText = 'opacity:1;display:block;margin:12px 0;padding:12px 16px;background:rgba(23,36,55,0.85);backdrop-filter:blur(20px);border:1px solid rgba(16,185,129,0.3);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
                msgDiv.innerHTML = `
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                    <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#38bdf8,#818cf8);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">S</div>
                    <div style="font-weight:600;font-size:14px;color:#f1f5f9;">Seraphina <span style="background:rgba(16,185,129,0.2);color:#34d399;font-size:10px;font-weight:700;padding:2px 8px;border-radius:9999px;border:1px solid rgba(16,185,129,0.4);margin-left:6px;">DeepSeek V3</span></div>
                  </div>
                  <div class="mes_text" style="font-size:14px;line-height:1.6;color:#e2e8f0;white-space:pre-wrap;">${escapedReply}</div>
                `;
                chat.appendChild(msgDiv);
                msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
            })();
            """
            TavernViewController.shared.tavernWebView?.evaluateJavaScript(replyJs, completionHandler: nil)
        } else if stage == "stage4g" || stage == "focus_input" {
            TavernViewController.shared.focusInputFieldForTesting()
        } else if stage == "blur_input" {
            TavernViewController.shared.blurInputFieldForTesting()
        } else if stage == "stage5" {
            TavernViewController.shared.exitImmersive()
        } else if stage.hasPrefix("theme:") {
            let themeName = String(stage.dropFirst("theme:".count))
            TavernViewController.shared.applyThemeToTavern(themeName: themeName)
        } else if stage.hasPrefix("custom_tint:") {
            let tintColor = String(stage.dropFirst("custom_tint:".count))
            TavernViewController.shared.applyCustomTintToTavern(tintColor: tintColor)
        }
    }
}
