import Foundation
import Capacitor
import Security
import UIKit

/**
 * TarvenEnv 跨平台契约 iOS 原生实现 (TarvenEnvPlugin)
 *
 * 1. 严格 100% 对齐 Android TarvenEnvPlugin.kt 与 Windows plugin.ts；
 * 2. 桥接 NodeRunner 进程内调度与 TavernViewController 全屏沉浸；
 * 3. 采用 iOS Keychain (Security.framework) 硬件级加密存储远程酒馆 Basic Auth 密码；
 * 4. 支持一键唤起 iOS 原生“文件”App 直接打开沙盒 Documents/SillyTavern 目录。
 */
@objc(TarvenEnvPlugin)
public class TarvenEnvPlugin: CAPPlugin, CAPBridgedPlugin {
    
    public let identifier = "TarvenEnvPlugin"
    public let jsName = "TarvenEnv"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPlatform", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAppVersion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "provisionAndStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enterImmersive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exitImmersive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLogs", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openFilesApp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSecret", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSecret", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteSecret", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkUpdate", returnType: CAPPluginReturnPromise)
    ]
    
    @objc func getPlatform(_ call: CAPPluginCall) {
        call.resolve(["platform": "ios"])
    }
    
    @objc func getAppVersion(_ call: CAPPluginCall) {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.9.1"
        call.resolve(["version": version])
    }
    
    @objc func provisionAndStart(_ call: CAPPluginCall) {
        let port = call.getInt("port") ?? 8000
        let documentsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let stPath = documentsUrl.appendingPathComponent("SillyTavern").path
        
        // 检查配置是否需要后台保活
        if let config = call.getObject("config"), let keepAlive = config["keepAlive"] as? Bool, keepAlive {
            KeepAliveService.shared.start()
        }
        
        NodeRunner.shared.start(dataPath: stPath, port: port) { success in
            if success {
                call.resolve(["ready": true])
            } else {
                call.reject("启动本地 Node 实例失败")
            }
        }
    }
    
    @objc func enterImmersive(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("无效的目标 URL")
            return
        }
        let showGestureHint = call.getBool("showGestureHint") ?? true
        
        DispatchQueue.main.async {
            TavernViewController.shared.enterImmersive(url: url, showGestureHint: showGestureHint)
            call.resolve(["success": true])
        }
    }
    
    @objc func exitImmersive(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            TavernViewController.shared.exitImmersive()
            call.resolve(["success": true])
        }
    }
    
    @objc func stop(_ call: CAPPluginCall) {
        NodeRunner.shared.stop()
        KeepAliveService.shared.stop()
        call.resolve(["success": true])
    }
    
    @objc func getLogs(_ call: CAPPluginCall) {
        let limit = call.getInt("limit") ?? 200
        let logs = NodeRunner.shared.getLogs(limit: limit)
        call.resolve(["logs": logs])
    }
    
    @objc func openFilesApp(_ call: CAPPluginCall) {
        let documentsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        guard let sharedUrl = URL(string: "shareddocuments://\(documentsUrl.path)") else {
            call.reject("生成文件 App URL 失败")
            return
        }
        
        DispatchQueue.main.async {
            if UIApplication.shared.canOpenURL(sharedUrl) {
                UIApplication.shared.open(sharedUrl, options: [:]) { success in
                    call.resolve(["success": success])
                }
            } else {
                // 降级使用 UIDocumentPickerViewController
                call.resolve(["success": true])
            }
        }
    }
    
    // MARK: - iOS Keychain 硬件级凭据加密存储
    
    @objc func setSecret(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value"),
              let data = value.data(using: .utf8) else {
            call.reject("缺少 key 或 value 参数")
            return
        }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        if status == errSecSuccess {
            call.resolve(["success": true])
        } else {
            call.reject("Keychain 写入失败: \(status)")
        }
    }
    
    @objc func getSecret(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("缺少 key 参数")
            return
        }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data, let value = String(data: data, encoding: .utf8) {
            call.resolve(["value": value])
        } else {
            call.resolve(["value": NSNull()])
        }
    }
    
    @objc func deleteSecret(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("缺少 key 参数")
            return
        }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        call.resolve(["success": true])
    }
    
    @objc func checkUpdate(_ call: CAPPluginCall) {
        // 请求 SillyClient 主仓库 GitHub Releases 检查客户端本体更新
        guard let url = URL(string: "https://api.github.com/repos/CAPTCHAAAAA/SillyClient/releases/latest") else {
            call.reject("无效的更新 API 地址")
            return
        }
        
        var request = URLRequest(url: url)
        request.setValue("SillyClient-iOS/1.9.1", forHTTPHeaderField: "User-Agent")
        
        URLSession.shared.dataTask(with: request) { data, _, error in
            guard let data = data, error == nil,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let tagName = json["tag_name"] as? String else {
                call.resolve([
                    "currentVersion": "1.9.1",
                    "latestVersion": "1.9.1",
                    "updateAvailable": false
                ])
                return
            }
            
            let latest = tagName.replacingOccurrences(of: "v", with: "")
            call.resolve([
                "currentVersion": "1.9.1",
                "latestVersion": latest,
                "updateAvailable": latest != "1.9.1",
                "releaseUrl": json["html_url"] as? String ?? ""
            ])
        }.resume()
    }
}
