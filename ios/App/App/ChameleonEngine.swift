import UIKit
import WebKit

/**
 * 变色龙实时取色引擎 (ChameleonEngine)
 *
 * 通过硬件加速的 WKWebView.takeSnapshot 极速微采样酒馆顶栏像素，
 * 计算平均色彩并提取背景明暗（Luminance），
 * 实时驱动顶部 Scrim 遮罩变色以及文字/图标明暗反差自适应。
 */
public class ChameleonEngine {
    
    public typealias ColorCallback = (_ topColor: UIColor, _ isDark: Bool) -> Void
    
    private weak var webView: WKWebView?
    private var lastSampledColor: UIColor?
    private var isSampling = false
    private var pollTimer: Timer?
    
    public init(webView: WKWebView) {
        self.webView = webView
    }
    
    deinit {
        stopPolling()
    }
    
    /**
     * 开启酒馆内 1.5 秒低频探针周期轮询
     */
    public func startPolling(callback: @escaping ColorCallback) {
        stopPolling()
        // 立即采样一次
        sample(callback: callback)
        
        pollTimer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { [weak self] _ in
            self?.sample(callback: callback)
        }
    }
    
    public func stopPolling() {
        pollTimer?.invalidate()
        pollTimer = nil
    }
    
    /**
     * 单次微采样：截取顶部 100x2 像素
     */
    public func sample(callback: @escaping ColorCallback) {
        guard let webView = webView, !isSampling else { return }
        isSampling = true
        
        let config = WKSnapshotConfiguration()
        // WebView 已经排布在固定顶条带下方，自身顶部 y=1.0 处即为酒馆首行真实渲染像素 (采样 100x3)
        let midX = webView.bounds.midX > 50.0 ? webView.bounds.midX : 150.0
        config.rect = CGRect(x: midX - 50.0, y: 1.0, width: 100.0, height: 3.0)
        
        webView.takeSnapshot(with: config) { [weak self] image, error in
            guard let self = self else { return }
            self.isSampling = false
            
            guard let image = image, error == nil, let cgImage = image.cgImage else { return }
            
            DispatchQueue.global(qos: .userInteractive).async {
                if let (color, isDark) = self.extractAverageColor(from: cgImage) {
                    DispatchQueue.main.async {
                        self.lastSampledColor = color
                        callback(color, isDark)
                    }
                }
            }
        }
    }
    
    /**
     * 从 CGImage 提取平均 RGB 并按 Rec.601 计算明暗
     */
    private func extractAverageColor(from cgImage: CGImage) -> (UIColor, Bool)? {
        let width = cgImage.width
        let height = cgImage.height
        guard width > 0 && height > 0 else { return nil }
        
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bytesPerPixel = 4
        let bytesPerRow = bytesPerPixel * width
        let bitsPerComponent = 8
        var rawData = [UInt8](repeating: 0, count: width * height * bytesPerPixel)
        
        guard let context = CGContext(
            data: &rawData,
            width: width,
            height: height,
            bitsPerComponent: bitsPerComponent,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        ) else { return nil }
        
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        
        var totalR: Int = 0
        var totalG: Int = 0
        var totalB: Int = 0
        let count = width * height
        
        for i in 0..<count {
            let offset = i * bytesPerPixel
            totalR += Int(rawData[offset])
            totalG += Int(rawData[offset + 1])
            totalB += Int(rawData[offset + 2])
        }
        
        let avgR = CGFloat(totalR / count) / 255.0
        let avgG = CGFloat(totalG / count) / 255.0
        let avgB = CGFloat(totalB / count) / 255.0
        
        // 感知亮度 Rec. 601
        let luminance = 0.299 * (avgR * 255.0) + 0.587 * (avgG * 255.0) + 0.114 * (avgB * 255.0)
        let isDark = luminance < 128.0
        
        let color = UIColor(red: avgR, green: avgG, blue: avgB, alpha: 1.0)
        return (color, isDark)
    }
}
