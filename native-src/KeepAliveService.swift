import AVFoundation
import UIKit

/**
 * 后台防休眠服务 (KeepAliveService)
 *
 * 通过合规的轻量静音音频循环驱动 AVAudioSession，
 * 采用 mixWithOthers 选项，完全不打扰用户听歌看视频，
 * 保证本地 SillyTavern 服务在用户切后台、回复微信或锁屏时持续运行。
 */
public class KeepAliveService {
    
    public static let shared = KeepAliveService()
    
    private var audioPlayer: AVAudioPlayer?
    private var isRunning = false
    
    private init() {}
    
    public func start() {
        guard !isRunning else { return }
        isRunning = true
        
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
            
            // 动态生成一段极短的静音 WAV 数据 (44.1kHz, 16bit, 0.5s 单声道 PCM)
            if let silentData = createSilentWAVData() {
                audioPlayer = try AVAudioPlayer(data: silentData)
                audioPlayer?.numberOfLoops = -1 // 无限循环
                audioPlayer?.volume = 0.01 // 极微弱音量
                audioPlayer?.play()
                NSLog("[KeepAliveService] 后台保活服务已启动 (mixWithOthers 启用)")
            }
        } catch {
            NSLog("[KeepAliveService] 启动后台保活失败: \(error.localizedDescription)")
            isRunning = false
        }
    }
    
    public func stop() {
        guard isRunning else { return }
        audioPlayer?.stop()
        audioPlayer = nil
        isRunning = false
        
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        NSLog("[KeepAliveService] 后台保活服务已停止")
    }
    
    /**
     * 生成合法格式的超轻量静音 WAV 音频二进制
     */
    private func createSilentWAVData() -> Data? {
        let sampleRate: Int32 = 8000
        let numChannels: Int16 = 1
        let bitsPerSample: Int16 = 16
        let durationSeconds: Int = 1
        let numSamples = sampleRate * Int32(durationSeconds)
        let subChunk2Size = numSamples * Int32(numChannels * bitsPerSample / 8)
        let chunkSize = 36 + subChunk2Size
        
        var data = Data()
        // RIFF header
        data.append(contentsOf: "RIFF".utf8)
        data.append(contentsOf: withUnsafeBytes(of: chunkSize.littleEndian) { Data($0) })
        data.append(contentsOf: "WAVE".utf8)
        // fmt subchunk
        data.append(contentsOf: "fmt ".utf8)
        var subchunk1Size: Int32 = 16
        data.append(contentsOf: withUnsafeBytes(of: subchunk1Size.littleEndian) { Data($0) })
        var audioFormat: Int16 = 1 // PCM
        data.append(contentsOf: withUnsafeBytes(of: audioFormat.littleEndian) { Data($0) })
        data.append(contentsOf: withUnsafeBytes(of: numChannels.littleEndian) { Data($0) })
        data.append(contentsOf: withUnsafeBytes(of: sampleRate.littleEndian) { Data($0) })
        let byteRate = sampleRate * Int32(numChannels * bitsPerSample / 8)
        data.append(contentsOf: withUnsafeBytes(of: byteRate.littleEndian) { Data($0) })
        let blockAlign = numChannels * bitsPerSample / 8
        data.append(contentsOf: withUnsafeBytes(of: blockAlign.littleEndian) { Data($0) })
        data.append(contentsOf: withUnsafeBytes(of: bitsPerSample.littleEndian) { Data($0) })
        // data subchunk
        data.append(contentsOf: "data".utf8)
        data.append(contentsOf: withUnsafeBytes(of: subChunk2Size.littleEndian) { Data($0) })
        // 填充静音 0 字节
        data.append(Data(repeating: 0, count: Int(subChunk2Size)))
        
        return data
    }
}
