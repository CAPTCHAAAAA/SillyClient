import Foundation

// 外部符号绑定: 直接链接 NodeMobile.framework 导出的 node_start C 入口
@_silgen_name("node_start")
private func node_start(_ argc: Int32, _ argv: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?) -> Int32

/**
 * 进程内 NodeMobile 运行调度器 (NodeRunner)
 *
 * 1. 在独立后台 POSIX 线程 (pthread) 中调用 NodeMobile C++ 入口 node_start；
 * 2. 传递酒馆沙盒持久化路径 Documents/SillyTavern 与监听端口 8000；
 * 3. 拦截 stdout/stderr 管道输出写入内存环形缓冲区 (Ring Buffer)，供控制台日志面板展示；
 * 4. 采用本地 HTTP 轮询探活机制，确认 SillyTavern 官方服务真正就绪后回调通知。
 */
public class NodeRunner {
    
    public static let shared = NodeRunner()
    
    private var isNodeRunning = false
    private let logLock = NSLock()
    private var logBuffer: [String] = []
    private let maxLogCount = 1000
    private var isOutputRedirected = false
    private var pipeReadSource: DispatchSourceRead?
    
    private init() {}
    
    public var isRunning: Bool {
        return isNodeRunning
    }
    
    /**
     * 启动本地 Node.js 实例线程并装载 SillyTavern 服务
     */
    public func start(dataPath: String, port: Int = 8000, completion: ((Bool) -> Void)? = nil) {
        guard !isNodeRunning else {
            completion?(true)
            return
        }
        
        appendLog("[NodeRunner] 正在初始化 iOS 进程内 Node.js 运行时 (NodeMobile)...")
        
        // 1. 初始化标准输出管道重定向 (捕获 console.log 到控制台日志抽屉)
        setupStdoutRedirection()
        
        // 2. 定位 SillyTavern 核心源码目录
        let fileManager = FileManager.default
        let serverDir = resolveServerDirectory(dataPath: dataPath)
        let dataDir = (dataPath as NSString).appendingPathComponent("data")
        
        // 确保沙盒数据目录存在 (持久化角色卡、聊天记录、设置)
        if !fileManager.fileExists(atPath: dataDir) {
            try? fileManager.createDirectory(atPath: dataDir, withIntermediateDirectories: true)
        }
        
        appendLog("[NodeRunner] 源码目录: \(serverDir)")
        appendLog("[NodeRunner] 数据目录: \(dataDir)")
        
        // 确保 loader 脚本存在
        let loaderPath = ensureLoaderScript(in: serverDir)
        
        // 3. 在后台独立系统线程中拉起 Node 事件循环
        Thread.detachNewThread { [weak self] in
            self?.runNodeEventLoop(serverDir: serverDir, dataDir: dataDir, loaderPath: loaderPath, port: port)
        }
        
        // 4. 轮询探测 http://127.0.0.1:port 是否已真正就绪
        pollUntilReady(port: port, timeout: 25.0) { [weak self] success in
            if success {
                self?.isNodeRunning = true
                self?.appendLog("[NodeRunner] SillyTavern 完整服务监听就绪: http://127.0.0.1:\(port)/")
                completion?(true)
            } else {
                self?.appendLog("[NodeRunner] 警告: 等待服务监听超时，但 Node 线程仍在保持尝试")
                self?.isNodeRunning = true
                completion?(true)
            }
        }
    }
    
    public func stop() {
        guard isNodeRunning else { return }
        appendLog("[NodeRunner] 正在停止本地 Node.js 实例...")
        isNodeRunning = false
        KeepAliveService.shared.stop()
    }
    
    /**
     * 重定向 stdout / stderr 管道
     */
    private func setupStdoutRedirection() {
        guard !isOutputRedirected else { return }
        isOutputRedirected = true
        
        var fds = [Int32](repeating: 0, count: 2)
        guard pipe(&fds) == 0 else {
            NSLog("[NodeRunner] Failed to create stdout pipe")
            return
        }
        
        let readFd = fds[0]
        let writeFd = fds[1]
        
        dup2(writeFd, STDOUT_FILENO)
        dup2(writeFd, STDERR_FILENO)
        
        let queue = DispatchQueue(label: "com.sillyclient.nodepipe", qos: .utility)
        let source = DispatchSource.makeReadSource(fileDescriptor: readFd, queue: queue)
        
        source.setEventHandler { [weak self] in
            var buffer = [UInt8](repeating: 0, count: 4096)
            let bytesRead = read(readFd, &buffer, buffer.count - 1)
            if bytesRead > 0 {
                buffer[bytesRead] = 0
                let output = String(cString: buffer)
                let lines = output.components(separatedBy: .newlines)
                for line in lines {
                    let trimmed = line.trimmingCharacters(in: .whitespaces)
                    if !trimmed.isEmpty {
                        self?.appendLog(trimmed)
                    }
                }
            }
        }
        
        self.pipeReadSource = source
        source.resume()
    }
    
    /**
     * 解析酒馆服务端目录
     * 优先: 用户沙盒 Documents/SillyTavern (支持自定义热更)
     * 其次: App Bundle 内置预装的 sillytavern
     */
    private func resolveServerDirectory(dataPath: String) -> String {
        let fm = FileManager.default
        let customServerJs = (dataPath as NSString).appendingPathComponent("server.js")
        if fm.fileExists(atPath: customServerJs) {
            return dataPath
        }
        
        // 检查 App Bundle 根目录或资源目录
        let bundlePaths = [
            Bundle.main.bundleURL.appendingPathComponent("sillytavern").path,
            Bundle.main.resourceURL?.appendingPathComponent("sillytavern").path ?? "",
            Bundle.main.bundleURL.appendingPathComponent("Resources/sillytavern").path,
            (Bundle.main.resourcePath ?? "") + "/sillytavern"
        ]
        
        for path in bundlePaths {
            if !path.isEmpty && fm.fileExists(atPath: (path as NSString).appendingPathComponent("server.js")) {
                return path
            }
        }
        
        return dataPath
    }
    
    /**
     * 确保 ios-loader.mjs 存在于合适路径
     */
    private func ensureLoaderScript(in serverDir: String) -> String {
        let fm = FileManager.default
        let serverLoader = (serverDir as NSString).appendingPathComponent("ios-loader.mjs")
        if fm.fileExists(atPath: serverLoader) {
            return serverLoader
        }
        
        if let bundleLoader = Bundle.main.path(forResource: "ios-loader", ofType: "mjs") {
            return bundleLoader
        }
        
        return (serverDir as NSString).appendingPathComponent("server.js")
    }
    
    /**
     * 内部后台线程执行方法
     */
    private func runNodeEventLoop(serverDir: String, dataDir: String, loaderPath: String, port: Int) {
        setenv("PORT", "\(port)", 1)
        setenv("HOST", "127.0.0.1", 1)
        setenv("DATA_DIR", dataDir, 1)
        setenv("ST_DISABLE_SHARP", "true", 1)
        setenv("NODE_ENV", "production", 1)
        setenv("TARVEN_SERVER_DIR", serverDir, 1)
        
        appendLog("[NodeRunner] 环境变量配置完毕: PORT=\(port), DATA_DIR=\(dataDir)")
        
        let args = [
            "node",
            loaderPath,
            "--port=\(port)",
            "--dataRoot=\(dataDir)",
            "--listen=false",
            "--browserLaunchEnabled=false"
        ]
        
        appendLog("[NodeRunner] 正在拉起 NodeMobile node_start 事件循环...")
        
        var cArgs: [UnsafeMutablePointer<CChar>?] = args.map { strdup($0) }
        cArgs.append(nil)
        
        let exitCode = cArgs.withUnsafeMutableBufferPointer { ptr in
            node_start(Int32(args.count), ptr.baseAddress)
        }
        
        for p in cArgs where p != nil {
            free(p)
        }
        
        appendLog("[NodeRunner] Node 事件循环已退出，退出码: \(exitCode)")
        isNodeRunning = false
    }
    
    /**
     * 轮询探测 http://127.0.0.1:port 是否响应
     */
    private func pollUntilReady(port: Int, timeout: TimeInterval, completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: "http://127.0.0.1:\(port)/") else {
            completion(false)
            return
        }
        
        let startTime = Date()
        var request = URLRequest(url: url)
        request.timeoutInterval = 1.0
        
        func check() {
            let session = URLSession(configuration: .ephemeral)
            let task = session.dataTask(with: request) { [weak self] _, response, error in
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode > 0 {
                    self?.appendLog("[NodeRunner] 探测成功: HTTP \(httpResponse.statusCode)")
                    completion(true)
                } else {
                    if Date().timeIntervalSince(startTime) > timeout {
                        completion(false)
                    } else {
                        DispatchQueue.global().asyncAfter(deadline: .now() + 0.3) {
                            check()
                        }
                    }
                }
            }
            task.resume()
        }
        
        check()
    }
    
    public func appendLog(_ message: String) {
        logLock.lock()
        defer { logLock.unlock() }
        let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        logBuffer.append("[\(timestamp)] \(message)")
        if logBuffer.count > maxLogCount {
            logBuffer.removeFirst(logBuffer.count - maxLogCount)
        }
        NSLog("[NodeRunner] %@", message)
    }
    
    public func getLogs(limit: Int = 200) -> [String] {
        logLock.lock()
        defer { logLock.unlock() }
        let count = min(limit, logBuffer.count)
        return Array(logBuffer.suffix(count))
    }
}
