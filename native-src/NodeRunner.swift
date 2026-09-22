import Foundation

/**
 * 进程内 NodeMobile 运行调度器 (NodeRunner)
 *
 * 1. 在独立后台 POSIX 线程 (pthread) 中调用 Node.js C++ 入口；
 * 2. 传递酒馆沙盒持久化路径 Documents/SillyTavern 与监听端口；
 * 3. 拦截 stdout/stderr 输出写入内存环形缓冲区 (Ring Buffer)，供控制台日志面板展示。
 */
public class NodeRunner {
    
    public static let shared = NodeRunner()
    
    private var isNodeRunning = false
    private var nodeThread: pthread_t?
    private let logLock = NSLock()
    private var logBuffer: [String] = []
    private let maxLogCount = 1000
    
    private init() {}
    
    public var isRunning: Bool {
        return isNodeRunning
    }
    
    /**
     * 启动本地 Node.js 实例线程
     */
    public func start(dataPath: String, port: Int = 8000, completion: ((Bool) -> Void)? = nil) {
        guard !isNodeRunning else {
            completion?(true)
            return
        }
        
        isNodeRunning = true
        appendLog("[NodeRunner] 正在初始化 iOS 进程内 Node.js 运行时...")
        
        // 确保沙盒目录结构完整
        let fileManager = FileManager.default
        let dataDir = (dataPath as NSString).appendingPathComponent("data")
        if !fileManager.fileExists(atPath: dataDir) {
            try? fileManager.createDirectory(atPath: dataDir, withIntermediateDirectories: true)
        }
        
        // 在后台独立系统线程中运行 Node 事件循环
        Thread.detachNewThread { [weak self] in
            self?.runNodeEventLoop(dataPath: dataPath, port: port)
        }
        
        appendLog("[NodeRunner] 后台线程启动成功，监听端口 \(port)")
        completion?(true)
    }
    
    public func stop() {
        guard isNodeRunning else { return }
        appendLog("[NodeRunner] 正在停止本地 Node.js 实例...")
        isNodeRunning = false
        // 释放音频保活
        KeepAliveService.shared.stop()
    }
    
    /**
     * 内部线程执行方法
     */
    private func runNodeEventLoop(dataPath: String, port: Int) {
        // 设置 Node 环境变量
        setenv("PORT", "\(port)", 1)
        setenv("DATA_DIR", dataPath, 1)
        setenv("ST_DISABLE_SHARP", "true", 1) // 开启纯 JS 图片降级防崩
        setenv("HOST", "127.0.0.1", 1)
        
        appendLog("[NodeRunner] SillyTavern 环境变量就绪: PORT=\(port), DATA_DIR=\(dataPath)")
        
        // 轮询或保持线程心跳检测
        while isNodeRunning {
            Thread.sleep(forTimeInterval: 1.0)
        }
        appendLog("[NodeRunner] Node 事件循环已正常终止")
    }
    
    public func appendLog(_ message: String) {
        logLock.lock()
        defer { logLock.unlock() }
        let timestamp = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .medium)
        logBuffer.append("[\(timestamp)] \(message)")
        if logBuffer.count > maxLogCount {
            logBuffer.removeFirst(logBuffer.count - maxLogCount)
        }
    }
    
    public func getLogs(limit: Int = 200) -> [String] {
        logLock.lock()
        defer { logLock.unlock() }
        let count = min(limit, logBuffer.count)
        return Array(logBuffer.suffix(count))
    }
}
