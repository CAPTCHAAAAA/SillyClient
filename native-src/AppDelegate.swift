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
    
    override var childViewControllerForStatusBarHidden: UIViewController? {
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
}
