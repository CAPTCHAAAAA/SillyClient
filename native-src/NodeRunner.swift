import Foundation

private typealias NodeStartFunc = @convention(c) (Int32, UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?) -> Int32

/**
 * 进程内 NodeMobile 运行调度器 (NodeRunner)
 *
 * 1. 在独立后台系统线程 (NSThread, 4MB Stack) 中调用 NodeMobile C++ 入口 node_start；
 * 2. 调度前自动执行 chdir(serverDir)，确保 SillyTavern 内部相对路径与模块解析精准就绪；
 * 3. 拦截 STDOUT (fd 1) 输出至沙盒 server.log 与内存 Ring Buffer，绝不劫持 STDERR 杜绝 NSLog 死锁；
 * 4. 忽略 SIGPIPE 信号，防止管道或网络异常触发 iOS 系统默认终止；
 * 5. 采用 HTTP 轮询探测，确认 SillyTavern 官方服务真正监听就绪后回调通知。
 */
public class NodeRunner {
    
    public static let shared = NodeRunner()
    
    private var isNodeRunning = false
    private let logLock = NSLock()
    private var logBuffer: [String] = []
    private let maxLogCount = 1000
    private var isOutputRedirected = false
    private var pipeReadSource: DispatchSourceRead?
    private var serverLogUrl: URL?
    
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
        
        // 忽略 SIGPIPE，防止 iOS 在管道写入或套接字断开时杀掉进程
        signal(SIGPIPE, SIG_IGN)
        
        appendLog("[NodeRunner] 正在初始化 iOS 进程内 Node.js 运行时 (NodeMobile)...")
        
        // 1. 定位 SillyTavern 核心源码目录与数据目录
        let fileManager = FileManager.default
        let serverDir = resolveServerDirectory(dataPath: dataPath)
        let dataDir = (dataPath as NSString).appendingPathComponent("data")
        
        // 确保沙盒数据目录存在 (持久化角色卡、聊天记录、设置)
        if !fileManager.fileExists(atPath: dataDir) {
            try? fileManager.createDirectory(atPath: dataDir, withIntermediateDirectories: true)
        }
        
        // 2. 初始化标准输出管道重定向 (捕获 Node.js console.log 到 server.log 与日志面板)
        setupStdoutRedirection(dataDir: dataDir)
        
        appendLog("[NodeRunner] 源码目录: \(serverDir)")
        appendLog("[NodeRunner] 数据目录: \(dataDir)")
        
        // 确保 loader 脚本存在
        let loaderPath = ensureLoaderScript(in: serverDir)
        appendLog("[NodeRunner] 引导入口: \(loaderPath)")
        
        // 3. 预置 config.yaml (禁用浏览器自启与 LAN 暴露)
        ensureServerConfig(serverDir: serverDir)
        let failureFile = URL(fileURLWithPath: serverDir).deletingLastPathComponent()
            .appendingPathComponent("server-failed.json")
        try? fileManager.removeItem(at: failureFile)
        
        // 4. 在独立系统线程中拉起 Node 事件循环 (显式分配 4MB 栈空间，防止 V8 栈溢出)
        let nodeThread = Thread { [weak self] in
            self?.runNodeEventLoop(serverDir: serverDir, dataDir: dataDir, loaderPath: loaderPath, port: port)
        }
        nodeThread.stackSize = 4 * 1024 * 1024 // 4 MB 栈大小
        nodeThread.name = "com.sillyclient.nodejs"
        nodeThread.start()
        
        // 5. 轮询探测 http://127.0.0.1:port 是否已真正就绪
        pollUntilReady(port: port, timeout: 90.0, failureFile: failureFile) { [weak self] success in
            if success {
                self?.isNodeRunning = true
                self?.appendLog("[NodeRunner] SillyTavern 完整服务监听就绪: http://127.0.0.1:\(port)/")
                
                // 写入沙盒 server-ready.txt 信号文件，通知 E2E 驱动脚本与前台
                let docsUrl = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
                let readyFile = docsUrl.appendingPathComponent("server-ready.txt")
                try? "ready".write(to: readyFile, atomically: true, encoding: .utf8)
                
                completion?(true)
            } else {
                self?.appendLog("[NodeRunner] 本地服务启动失败，请查看上方错误日志")
                completion?(false)
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
     * 重定向 stdout 管道至沙盒 server.log 与内存缓冲区
     * 注意：严格只重定向 STDOUT_FILENO (fd 1)，绝不重定向 STDERR_FILENO (fd 2)！
     * 避免系统日志 (NSLog / os_log) 发生无限递归与死锁。
     */
    private func setupStdoutRedirection(dataDir: String) {
        guard !isOutputRedirected else { return }
        isOutputRedirected = true
        
        let logPath = (dataDir as NSString).appendingPathComponent("server.log")
        if !FileManager.default.fileExists(atPath: logPath) {
            FileManager.default.createFile(atPath: logPath, contents: nil, attributes: nil)
        }
        self.serverLogUrl = URL(fileURLWithPath: logPath)
        
        var fds = [Int32](repeating: 0, count: 2)
        guard pipe(&fds) == 0 else {
            NSLog("[NodeRunner] Failed to create stdout pipe")
            return
        }
        
        let readFd = fds[0]
        let writeFd = fds[1]
        
        dup2(writeFd, STDOUT_FILENO)
        
        let queue = DispatchQueue(label: "com.sillyclient.nodepipe", qos: .utility)
        let source = DispatchSource.makeReadSource(fileDescriptor: readFd, queue: queue)
        
        source.setEventHandler { [weak self] in
            var buffer = [UInt8](repeating: 0, count: 4096)
            let bytesRead = read(readFd, &buffer, buffer.count - 1)
            if bytesRead > 0 {
                buffer[bytesRead] = 0
                let output = String(cString: buffer)
                
                // 写入沙盒日志文件
                if let logUrl = self?.serverLogUrl, let data = output.data(using: .utf8) {
                    if let handle = try? FileHandle(forWritingTo: logUrl) {
                        handle.seekToEndOfFile()
                        handle.write(data)
                        try? handle.close()
                    }
                }
                
                // 写入内存日志缓冲区 (绝不在内部调用 NSLog)
                let lines = output.components(separatedBy: .newlines)
                self?.appendNodeLogsWithoutNSLog(lines)
            }
        }
        
        self.pipeReadSource = source
        source.resume()
    }
    
    private func appendNodeLogsWithoutNSLog(_ lines: [String]) {
        logLock.lock()
        defer { logLock.unlock() }
        let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if !trimmed.isEmpty {
                logBuffer.append("[\(timestamp)] \(trimmed)")
            }
        }
        if logBuffer.count > maxLogCount {
            logBuffer.removeFirst(logBuffer.count - maxLogCount)
        }
    }
    
    /**
     * 解析酒馆服务端目录
     * 优先: 用户沙盒 Documents/SillyTavern (支持自定义热更)
     * 其次: App Bundle 内置预装的 sillytavern
     */
    public func resolveServerDirectory(dataPath: String) -> String {
        let fm = FileManager.default
        let customServerJs = (dataPath as NSString).appendingPathComponent("server.js")
        if fm.fileExists(atPath: customServerJs) {
            return dataPath
        }
        
        let bundlePaths = [
            Bundle.main.bundleURL.appendingPathComponent("sillytavern").path,
            Bundle.main.resourceURL?.appendingPathComponent("sillytavern").path ?? "",
            Bundle.main.bundleURL.appendingPathComponent("Resources/sillytavern").path,
            (Bundle.main.resourcePath ?? "") + "/sillytavern"
        ]
        
        for path in bundlePaths {
            if !path.isEmpty && fm.fileExists(atPath: (path as NSString).appendingPathComponent("server.js")) {
                appendLog("[NodeRunner] 发现内置酒馆服务包: \(path)")
                appendLog("[NodeRunner] 正在初始化部署至用户沙盒 (Documents/SillyTavern)...")
                let parentDir = (dataPath as NSString).deletingLastPathComponent
                try? fm.createDirectory(atPath: parentDir, withIntermediateDirectories: true)
                do {
                    try fm.copyItem(atPath: path, toPath: dataPath)
                    appendLog("[NodeRunner] 成功将酒馆服务部署至 Documents/SillyTavern (APFS 秒级克隆)")
                    return dataPath
                } catch {
                    appendLog("[NodeRunner] 部署至沙盒失败: \(error.localizedDescription)，回退至 Bundle 运行")
                    return path
                }
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
     * 预置 config.yaml，禁用浏览器启动并锁定端口与监听
     */
    private func ensureServerConfig(serverDir: String) {
        let fm = FileManager.default
        let configPath = (serverDir as NSString).appendingPathComponent("config.yaml")
        if !fm.fileExists(atPath: configPath) {
            let minimalConfig = """
            port: 8000
            listen: false
            whitelistMode: false
            browserLaunch:
              enabled: false
            """
            try? minimalConfig.write(toFile: configPath, atomically: true, encoding: .utf8)
        }
    }
    
    /**
     * 动态解析并调用 NodeMobile node_start
     */
    private func invokeNodeStart(arguments: [String]) -> Int32 {
        var sym = dlsym(dlopen(nil, RTLD_NOW), "node_start")
        
        if sym == nil {
            let candidates = [
                Bundle.main.bundleURL.appendingPathComponent("Frameworks/NodeMobile.framework/NodeMobile").path,
                (Bundle.main.privateFrameworksPath ?? "") + "/NodeMobile.framework/NodeMobile",
                Bundle.main.bundleURL.appendingPathComponent("Frameworks/NodeMobile.framework").path
            ]
            for path in candidates {
                if let handle = dlopen(path, RTLD_NOW) {
                    sym = dlsym(handle, "node_start")
                    if sym != nil {
                        NSLog("[NodeRunner] 成功通过 dlopen 加载 NodeMobile: %@", path)
                        break
                    }
                }
            }
        }
        
        guard let nodeStartPtr = sym else {
            NSLog("[NodeRunner] 严重错误: 未能在运行时符号表中找到 node_start C 入口")
            return -1
        }
        
        let nodeStart = unsafeBitCast(nodeStartPtr, to: NodeStartFunc.self)
        
        var cArgs: [UnsafeMutablePointer<CChar>?] = arguments.map { strdup($0) }
        cArgs.append(nil)
        
        let exitCode = cArgs.withUnsafeMutableBufferPointer { ptr in
            nodeStart(Int32(arguments.count), ptr.baseAddress)
        }
        
        for p in cArgs where p != nil {
            free(p)
        }
        return exitCode
    }
    
    /**
     * 内部后台线程执行方法
     */
    private func runNodeEventLoop(serverDir: String, dataDir: String, loaderPath: String, port: Int) {
        signal(SIGPIPE, SIG_IGN)
        
        setenv("PORT", "\(port)", 1)
        setenv("HOST", "127.0.0.1", 1)
        setenv("DATA_DIR", dataDir, 1)
        setenv("ST_DISABLE_SHARP", "true", 1)
        setenv("NODE_ENV", "production", 1)
        setenv("AUTO_LAUNCH", "false", 1)
        setenv("NO_BROWSER", "true", 1)
        setenv("BROWSER", "none", 1)
        setenv("TARVEN_SERVER_DIR", serverDir, 1)
        
        appendLog("[NodeRunner] 环境变量配置完毕: PORT=\(port), DATA_DIR=\(dataDir)")
        
        // 关键：切换工作目录至 serverDir，确保 SillyTavern 内部相对路径与模块正确解析
        chdir(serverDir)
        appendLog("[NodeRunner] 工作目录已切换至: \(serverDir)")
        
        let args = [
            "node",
            loaderPath,
            "--port=\(port)",
            "--dataRoot=\(dataDir)",
            "--listen=false",
            "--browserLaunchEnabled=false"
        ]
        
        appendLog("[NodeRunner] 正在拉起 NodeMobile node_start 事件循环: \(args.joined(separator: " "))")
        let exitCode = invokeNodeStart(arguments: args)
        
        appendLog("[NodeRunner] Node 事件循环已退出，退出码: \(exitCode)")
        isNodeRunning = false
    }
    
    /**
     * 轮询探测 http://127.0.0.1:port 是否响应
     */
    private func pollUntilReady(port: Int, timeout: TimeInterval, failureFile: URL, completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: "http://127.0.0.1:\(port)/") else {
            completion(false)
            return
        }
        
        let startTime = Date()
        var request = URLRequest(url: url)
        request.timeoutInterval = 1.0
        
        func check() {
            if let data = try? Data(contentsOf: failureFile),
               let failure = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
                appendLog("[NodeRunner] Startup failed: \(failure["message"] ?? "Unknown error")")
                completion(false)
                return
            }
            let session = URLSession(configuration: .ephemeral)
            let task = session.dataTask(with: request) { [weak self] _, response, error in
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    self?.appendLog("[NodeRunner] 探测成功: HTTP \(httpResponse.statusCode)")
                    completion(true)
                } else {
                    if Date().timeIntervalSince(startTime) > timeout {
                        completion(false)
                    } else {
                        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
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
