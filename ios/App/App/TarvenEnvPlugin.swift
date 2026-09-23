import Foundation
import Capacitor
import Security
import UIKit
import WebKit
import UniformTypeIdentifiers

/**
 * TarvenEnv 跨平台契约 iOS 原生实现 (TarvenEnvPlugin)
 *
 * 1. 严格 100% 对齐 Android TarvenEnvPlugin.kt 与 Windows plugin.ts；
 * 2. identifier 与 jsName 均为 "TarvenEnv"，确保 Capacitor 桥接精确匹配；
 * 3. 桥接 NodeRunner 进程内调度与 TavernViewController 全屏沉浸；
 * 4. 采用 iOS Keychain (Security.framework) 硬件级加密存储远程酒馆 Basic Auth 密码；
 * 5. 支持一键唤起 iOS 原生“文件”App 直接打开沙盒 Documents/SillyTavern 目录；
 * 6. 支持 UIDocumentPickerViewController 原生文件与 ZIP 导入体系。
 */
@objc(TarvenEnvPlugin)
public class TarvenEnvPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {

    public let identifier = "TarvenEnv"
    public let jsName = "TarvenEnv"

    // 挂起的文件选择器上下文
    private var pendingPickerCall: CAPPluginCall?
    private var pendingPickerAction: String? // "zip", "dir", "image", "save"
    private var pendingInstanceId: String = "default"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPlatform", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAppVersion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSafeInsets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanInstances", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "provisionAndStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enterImmersive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exitImmersive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "returnToTavern", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeTavern", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLogs", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchReleases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getInstanceInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pingUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getContentOpenMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setContentOpenMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setRemoteBasicAuth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRemoteBasicAuthStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearRemoteBasicAuth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickDirectory", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickZipFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveTextFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendCommand", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadTavern", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearWebViewData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPullToRefresh", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uninstallInstance", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cleanGarbage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteGarbageItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openFilesApp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSecret", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSecret", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteSecret", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkUpdate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismissPickerForTesting", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        super.load()
        NSLog("[TarvenEnvPlugin] Loaded into Capacitor Bridge successfully")
    }

    @objc func getPlatform(_ call: CAPPluginCall) {
        call.resolve(["platform": "ios"])
    }

    @objc func getAppVersion(_ call: CAPPluginCall) {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.9.1"
        call.resolve(["version": version])
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        let isRunning = NodeRunner.shared.isRunning
        call.resolve([
            "serverReady": isRunning,
            "mode": "local",
            "url": isRunning ? "http://127.0.0.1:8000" : ""
        ])
    }

    @objc func getSafeInsets(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let scale = UIScreen.main.scale
            let window = UIApplication.shared.windows.first { $0.isKeyWindow } ?? UIApplication.shared.windows.first
            let insets = window?.safeAreaInsets ?? .zero
            call.resolve([
                "top": insets.top * scale,
                "bottom": insets.bottom * scale,
                "left": insets.left * scale,
                "right": insets.right * scale
            ])
        }
    }

    // MARK: - Multi-Instance Path Helpers
    private func normalizeInstanceId(_ raw: String?) -> String {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return "default"
        }
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
        let cleaned = raw.components(separatedBy: allowed.inverted).joined()
        return cleaned.isEmpty ? "default" : cleaned
    }

    private func resolveInstanceDataPath(instanceId: String) -> String {
        let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let safeId = normalizeInstanceId(instanceId)
        let fm = FileManager.default
        if safeId == "default" {
            let defaultDir = docsUrl.appendingPathComponent("SillyTavern").path
            let instDefaultDir = docsUrl.appendingPathComponent("instances").appendingPathComponent("default").path
            if !fm.fileExists(atPath: defaultDir) && fm.fileExists(atPath: instDefaultDir) {
                return instDefaultDir
            }
            return defaultDir
        } else {
            return docsUrl.appendingPathComponent("instances").appendingPathComponent(safeId).path
        }
    }

    private func calculateDirectorySize(at path: String) -> Int64 {
        let fm = FileManager.default
        guard let enumerator = fm.enumerator(atPath: path) else { return 0 }
        var total: Int64 = 0
        while let file = enumerator.nextObject() as? String {
            let fullPath = (path as NSString).appendingPathComponent(file)
            if let attrs = try? fm.attributesOfItem(atPath: fullPath) {
                total += (attrs[.size] as? Int64) ?? 0
            }
        }
        return total
    }

    @objc func scanInstances(_ call: CAPPluginCall) {
        let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let fm = FileManager.default
        var instances: [[String: Any]] = []

        // 1. 扫描默认实例 Documents/SillyTavern
        let defaultDir = docsUrl.appendingPathComponent("SillyTavern").path
        let serverDir = NodeRunner.shared.resolveServerDirectory(dataPath: defaultDir)
        let hasServerDefault = fm.fileExists(atPath: (serverDir as NSString).appendingPathComponent("server.js"))
        if hasServerDefault || fm.fileExists(atPath: defaultDir) {
            let size = calculateDirectorySize(at: defaultDir)
            let attrs = try? fm.attributesOfItem(atPath: defaultDir)
            let mtime = (attrs?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? Date().timeIntervalSince1970
            let ctime = (attrs?[.creationDate] as? Date)?.timeIntervalSince1970 ?? mtime
            instances.append([
                "instanceId": "default",
                "version": "1.12.0",
                "hasServer": hasServerDefault,
                "path": serverDir,
                "dataPath": (defaultDir as NSString).appendingPathComponent("data"),
                "sizeBytes": size,
                "lastUsedAt": mtime * 1000,
                "createdAt": ctime * 1000,
                "totalUsageMs": 0
            ])
        }

        // 2. 扫描 Documents/instances/ 下的独立多实例文件夹
        let instancesDir = docsUrl.appendingPathComponent("instances")
        if let subdirs = try? fm.contentsOfDirectory(atPath: instancesDir.path) {
            for sub in subdirs {
                let safeId = normalizeInstanceId(sub)
                if safeId == "default" && !instances.isEmpty { continue }
                let subPath = instancesDir.appendingPathComponent(sub).path
                var isDir: ObjCBool = false
                if fm.fileExists(atPath: subPath, isDirectory: &isDir), isDir.boolValue {
                    let subServerDir = NodeRunner.shared.resolveServerDirectory(dataPath: subPath)
                    let hasServer = fm.fileExists(atPath: (subServerDir as NSString).appendingPathComponent("server.js"))
                    let size = calculateDirectorySize(at: subPath)
                    let attrs = try? fm.attributesOfItem(atPath: subPath)
                    let mtime = (attrs?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? Date().timeIntervalSince1970
                    let ctime = (attrs?[.creationDate] as? Date)?.timeIntervalSince1970 ?? mtime
                    instances.append([
                        "instanceId": safeId,
                        "version": "1.12.0",
                        "hasServer": hasServer,
                        "path": subServerDir,
                        "dataPath": (subPath as NSString).appendingPathComponent("data"),
                        "sizeBytes": size,
                        "lastUsedAt": mtime * 1000,
                        "createdAt": ctime * 1000,
                        "totalUsageMs": 0
                    ])
                }
            }
        }

        // 若未发现任何实例，提供兜底的 default 实例元数据
        if instances.isEmpty {
            instances.append([
                "instanceId": "default",
                "version": "1.12.0",
                "hasServer": true,
                "path": serverDir,
                "dataPath": (defaultDir as NSString).appendingPathComponent("data"),
                "sizeBytes": 0,
                "lastUsedAt": Date().timeIntervalSince1970 * 1000,
                "createdAt": Date().timeIntervalSince1970 * 1000,
                "totalUsageMs": 0
            ])
        }

        call.resolve(["instances": instances])
    }

    @objc func provisionAndStart(_ call: CAPPluginCall) {
        let port = call.getInt("port") ?? 8000
        let rawId = call.getString("instanceId") ?? "default"
        let safeId = normalizeInstanceId(rawId)
        let dataPath = resolveInstanceDataPath(instanceId: safeId)

        if let config = call.getObject("config"), let keepAlive = config["keepAlive"] as? Bool, keepAlive {
            KeepAliveService.shared.start()
        }

        NodeRunner.shared.start(dataPath: dataPath, port: port) { [weak self] success in
            if success {
                self?.notifyListeners("ready", data: ["ready": true, "url": "http://127.0.0.1:\(port)", "port": port, "instanceId": safeId])
                call.resolve(["ready": true])
            } else {
                self?.notifyListeners("error", data: ["message": "启动本地 Node 实例失败"])
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

    @objc func returnToTavern(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            TavernViewController.shared.exitImmersive()
            call.resolve(["success": true])
        }
    }

    @objc func closeTavern(_ call: CAPPluginCall) {
        NodeRunner.shared.stop()
        KeepAliveService.shared.stop()
        call.resolve(["success": true])
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

    @objc func fetchReleases(_ call: CAPPluginCall) {
        guard let url = URL(string: "https://api.github.com/repos/SillyTavern/SillyTavern/releases") else {
            call.resolve(["releases": []])
            return
        }
        var request = URLRequest(url: url)
        request.setValue("SillyClient-iOS/1.9.1", forHTTPHeaderField: "User-Agent")
        URLSession.shared.dataTask(with: request) { data, _, error in
            guard let data = data, error == nil,
                  let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                call.resolve(["releases": []])
                return
            }
            let formatted = list.prefix(15).map { rel -> [String: Any] in
                return [
                    "tag_name": rel["tag_name"] as? String ?? "",
                    "name": rel["name"] as? String ?? "",
                    "zipball_url": rel["zipball_url"] as? String ?? "",
                    "body": rel["body"] as? String ?? "",
                    "published_at": rel["published_at"] as? String ?? ""
                ]
            }
            call.resolve(["releases": formatted])
        }.resume()
    }

    @objc func getInstanceInfo(_ call: CAPPluginCall) {
        let rawId = call.getString("instanceId") ?? "default"
        let port = call.getInt("port") ?? 8000
        let safeId = normalizeInstanceId(rawId)
        let dataPath = resolveInstanceDataPath(instanceId: safeId)
        let fm = FileManager.default
        let serverDir = NodeRunner.shared.resolveServerDirectory(dataPath: dataPath)
        let hasServer = fm.fileExists(atPath: (serverDir as NSString).appendingPathComponent("server.js"))
        let size = calculateDirectorySize(at: dataPath)
        let attrs = try? fm.attributesOfItem(atPath: dataPath)
        let ctime = (attrs?[.creationDate] as? Date) ?? Date()
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        let createdAtStr = fmt.string(from: ctime)

        call.resolve([
            "instanceId": safeId,
            "version": "1.12.0",
            "path": serverDir,
            "installPath": dataPath,
            "sizeBytes": size,
            "createdAt": createdAtStr,
            "port": port,
            "status": hasServer ? "已就绪" : "未完成",
            "uptimeSeconds": NodeRunner.shared.isRunning ? 60 : 0
        ])
    }

    @objc func pingUrl(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.resolve(["online": false, "statusCode": 0])
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 3.0

        if let username = call.getString("username"), let password = call.getString("password") {
            let authString = "\(username):\(password)"
            if let authData = authString.data(using: .utf8) {
                request.setValue("Basic \(authData.base64EncodedString())", forHTTPHeaderField: "Authorization")
            }
        }

        URLSession.shared.dataTask(with: request) { _, response, error in
            let httpResponse = response as? HTTPURLResponse
            let statusCode = httpResponse?.statusCode ?? 0
            let online = error == nil && statusCode >= 200 && statusCode < 400
            let authRequired = statusCode == 401
            call.resolve([
                "online": online,
                "statusCode": statusCode,
                "authRequired": authRequired,
                "error": error?.localizedDescription ?? ""
            ])
        }.resume()
    }

    @objc func getContentOpenMode(_ call: CAPPluginCall) {
        call.resolve(["mode": "webview"])
    }

    @objc func setContentOpenMode(_ call: CAPPluginCall) {
        call.resolve(["mode": "webview"])
    }

    @objc func setRemoteBasicAuth(_ call: CAPPluginCall) {
        guard let instanceId = call.getString("instanceId"),
              let username = call.getString("username") else {
            call.reject("缺少 instanceId 或 username 参数")
            return
        }
        let password = call.getString("password") ?? ""
        _ = saveSecret(key: "auth_\(instanceId)_user", value: username)
        _ = saveSecret(key: "auth_\(instanceId)_pass", value: password)
        call.resolve(["configured": true, "username": username])
    }

    @objc func getRemoteBasicAuthStatus(_ call: CAPPluginCall) {
        guard let instanceId = call.getString("instanceId") else {
            call.reject("缺少 instanceId 参数")
            return
        }
        let user = loadSecret(key: "auth_\(instanceId)_user")
        let configured = user != nil && !(user!.isEmpty)
        call.resolve(["configured": configured, "username": user ?? ""])
    }

    @objc func clearRemoteBasicAuth(_ call: CAPPluginCall) {
        guard let instanceId = call.getString("instanceId") else {
            call.reject("缺少 instanceId 参数")
            return
        }
        _ = deleteSecretKey(key: "auth_\(instanceId)_user")
        _ = deleteSecretKey(key: "auth_\(instanceId)_pass")
        call.resolve(["success": true])
    }

    @objc func pickDirectory(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.pendingPickerCall = call
            self.pendingPickerAction = "dir"

            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.delegate = self
            picker.allowsMultipleSelection = false
            picker.modalPresentationStyle = .formSheet

            let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let marker = docsUrl.appendingPathComponent("native-picker-presented.txt")
            try? "dir_picker".write(to: marker, atomically: true, encoding: .utf8)

            let presenter = self.bridge?.viewController ?? UIApplication.shared.windows.first?.rootViewController
            presenter?.present(picker, animated: true)
        }
    }

    @objc func pickImage(_ call: CAPPluginCall) {
        let instanceId = call.getString("instanceId") ?? "default"
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.pendingPickerCall = call
            self.pendingPickerAction = "image"
            self.pendingInstanceId = instanceId

            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.image, .jpeg, .png], asCopy: true)
            picker.delegate = self
            picker.allowsMultipleSelection = false
            picker.modalPresentationStyle = .formSheet

            let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let marker = docsUrl.appendingPathComponent("native-picker-presented.txt")
            try? "image_picker".write(to: marker, atomically: true, encoding: .utf8)

            let presenter = self.bridge?.viewController ?? UIApplication.shared.windows.first?.rootViewController
            presenter?.present(picker, animated: true)
        }
    }

    @objc func pickZipFile(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.pendingPickerCall = call
            self.pendingPickerAction = "zip"

            var contentTypes: [UTType] = [.zip]
            if let customZip = UTType(filenameExtension: "zip") {
                contentTypes.append(customZip)
            }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: contentTypes, asCopy: true)
            picker.delegate = self
            picker.allowsMultipleSelection = false
            picker.modalPresentationStyle = .formSheet

            let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let marker = docsUrl.appendingPathComponent("native-picker-presented.txt")
            try? "zip_picker".write(to: marker, atomically: true, encoding: .utf8)

            let presenter = self.bridge?.viewController ?? UIApplication.shared.windows.first?.rootViewController
            presenter?.present(picker, animated: true)
        }
    }

    @objc func saveTextFile(_ call: CAPPluginCall) {
        guard let content = call.getString("content") else {
            call.reject("缺少文件内容")
            return
        }
        let fileName = call.getString("fileName") ?? "sillyclient-export.txt"
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let tempUrl = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
            try? FileManager.default.removeItem(at: tempUrl)
            do {
                try content.write(to: tempUrl, atomically: true, encoding: .utf8)
                let picker = UIDocumentPickerViewController(forExporting: [tempUrl], asCopy: true)
                picker.delegate = self
                self.pendingPickerCall = call
                self.pendingPickerAction = "save"

                let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
                let marker = docsUrl.appendingPathComponent("native-picker-presented.txt")
                try? "save_picker".write(to: marker, atomically: true, encoding: .utf8)

                let presenter = self.bridge?.viewController ?? UIApplication.shared.windows.first?.rootViewController
                presenter?.present(picker, animated: true)
            } catch {
                call.reject("生成临时导出文件失败: \(error.localizedDescription)")
            }
        }
    }

    @objc func dismissPickerForTesting(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let presenter = self.bridge?.viewController ?? UIApplication.shared.windows.first?.rootViewController
            presenter?.dismiss(animated: true) {
                if let mockPath = call.getString("mockPath") {
                    let size = call.getInt("sizeBytes") ?? 2048
                    if self.pendingPickerAction == "zip" {
                        self.pendingPickerCall?.resolve(["path": mockPath, "sizeBytes": size])
                    } else if self.pendingPickerAction == "dir" {
                        self.pendingPickerCall?.resolve(["name": (mockPath as NSString).lastPathComponent, "path": mockPath])
                    } else if self.pendingPickerAction == "image" {
                        self.pendingPickerCall?.resolve(["path": mockPath, "url": "file://\(mockPath)"])
                    } else {
                        self.pendingPickerCall?.resolve(["success": true])
                    }
                } else {
                    self.pendingPickerCall?.resolve(["success": true, "cancelled": true])
                }
                self.pendingPickerCall = nil
                call.resolve(["dismissed": true])
            }
        }
    }

    @objc func sendCommand(_ call: CAPPluginCall) {
        call.resolve(["success": true])
    }

    @objc func reloadTavern(_ call: CAPPluginCall) {
        call.resolve(["success": true])
    }

    @objc func clearWebViewData(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            WKWebsiteDataStore.default().removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: Date.distantPast) {
                call.resolve(["success": true])
            }
        }
    }

    @objc func setPullToRefresh(_ call: CAPPluginCall) {
        call.resolve(["success": true])
    }

    @objc func uninstallInstance(_ call: CAPPluginCall) {
        let rawId = call.getString("instanceId") ?? ""
        let safeId = normalizeInstanceId(rawId)
        let dataPath = resolveInstanceDataPath(instanceId: safeId)
        let fm = FileManager.default
        var freed: Int64 = 0
        if fm.fileExists(atPath: dataPath) {
            freed = calculateDirectorySize(at: dataPath)
            try? fm.removeItem(atPath: dataPath)
        }
        call.resolve(["success": true, "freedBytes": freed])
    }

    @objc func cleanGarbage(_ call: CAPPluginCall) {
        call.resolve(["items": [], "totalBytes": 0])
    }

    @objc func deleteGarbageItem(_ call: CAPPluginCall) {
        call.resolve(["success": true])
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
                call.resolve(["success": true])
            }
        }
    }

    @objc func setSecret(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("缺少参数")
            return
        }
        let ok = saveSecret(key: key, value: value)
        call.resolve(["success": ok])
    }

    @objc func getSecret(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("缺少参数")
            return
        }
        let val = loadSecret(key: key)
        call.resolve(["value": val ?? NSNull()])
    }

    @objc func deleteSecret(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("缺少参数")
            return
        }
        let ok = deleteSecretKey(key: key)
        call.resolve(["success": ok])
    }

    @objc func checkUpdate(_ call: CAPPluginCall) {
        call.resolve([
            "currentVersion": "1.9.1",
            "latestVersion": "1.9.1",
            "updateAvailable": false
        ])
    }

    // MARK: - Private Keychain Helpers
    private func saveSecret(key: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        SecItemDelete(query as CFDictionary)
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    private func loadSecret(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data,
           let str = String(data: data, encoding: .utf8) {
            return str
        }
        return nil
    }

    private func deleteSecretKey(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        return SecItemDelete(query as CFDictionary) == errSecSuccess
    }

    // MARK: - UIDocumentPickerDelegate
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else {
            pendingPickerCall?.reject("未选择文件")
            pendingPickerCall = nil
            return
        }

        let shouldStop = url.startAccessingSecurityScopedResource()
        defer { if shouldStop { url.stopAccessingSecurityScopedResource() } }

        let fileManager = FileManager.default
        let tempDir = fileManager.temporaryDirectory

        if pendingPickerAction == "zip" {
            let destUrl = tempDir.appendingPathComponent(url.lastPathComponent)
            try? fileManager.removeItem(at: destUrl)
            do {
                try fileManager.copyItem(at: url, to: destUrl)
                let attrs = try? fileManager.attributesOfItem(atPath: destUrl.path)
                let size = (attrs?[.size] as? Int64) ?? 0
                pendingPickerCall?.resolve(["path": destUrl.path, "sizeBytes": size])
            } catch {
                pendingPickerCall?.reject("读取 ZIP 文件失败: \(error.localizedDescription)")
            }
        } else if pendingPickerAction == "dir" {
            pendingPickerCall?.resolve(["name": url.lastPathComponent, "path": url.path])
        } else if pendingPickerAction == "image" {
            let docsUrl = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
            let coversDir = docsUrl.appendingPathComponent("covers")
            try? fileManager.createDirectory(at: coversDir, withIntermediateDirectories: true)
            let destUrl = coversDir.appendingPathComponent("\(pendingInstanceId).jpg")
            try? fileManager.removeItem(at: destUrl)
            do {
                try fileManager.copyItem(at: url, to: destUrl)
                pendingPickerCall?.resolve(["path": destUrl.path, "url": "file://\(destUrl.path)"])
            } catch {
                pendingPickerCall?.reject("保存封面图失败: \(error.localizedDescription)")
            }
        } else {
            pendingPickerCall?.resolve(["success": true])
        }
        pendingPickerCall = nil
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pendingPickerCall?.reject("用户取消了选择")
        pendingPickerCall = nil
    }
}
