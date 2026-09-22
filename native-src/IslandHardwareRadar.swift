import UIKit

/**
 * 物理硬件雷达避让算法 (IslandHardwareRadar)
 *
 * 专门负责计算灵动岛 (Dynamic Island) 与刘海屏 (Notch) 的物理阻挡黑区，
 * 动态输出中心对称的「安全左翼区」与「安全右翼区」，
 * 保证控制岛提示文字与操作手柄 100% 避让相机和传感器，实现零像素遮挡。
 */
public struct IslandFlanks {
    public let leftFlank: CGRect
    public let rightFlank: CGRect
    public let isIsland: Bool
    public let safeTop: CGFloat
}

public class IslandHardwareRadar {
    
    public static let shared = IslandHardwareRadar()
    
    // iPhone 灵动岛静止状态物理尺寸 (约 124.67pt x 36.67pt)
    private let islandWidth: CGFloat = 125.0
    private let islandHeight: CGFloat = 37.0
    
    // iPhone 经典刘海屏物理尺寸 (约 160pt x 32pt)
    private let notchWidth: CGFloat = 160.0
    private let notchHeight: CGFloat = 32.0
    
    private let sideMargin: CGFloat = 14.0
    private let paddingToCutout: CGFloat = 8.0
    
    private init() {}
    
    /**
     * 计算指定视图宿主内的安全避让双翼区域
     */
    public func calculateFlanks(for view: UIView) -> IslandFlanks {
        let screenWidth = view.bounds.width > 0 ? view.bounds.width : UIScreen.main.bounds.width
        let safeTop = view.safeAreaInsets.top > 0 ? view.safeAreaInsets.top : 47.0
        
        let center = screenWidth / 2.0
        
        // 灵动岛通常 safeTop >= 54pt (如 iPhone 14 Pro / 15 / 16)
        let isIsland = safeTop >= 54.0
        let cutoutWidth = isIsland ? islandWidth : (safeTop > 24.0 ? notchWidth : 0.0)
        
        if cutoutWidth > 0 {
            let leftEnd = floor(center - (cutoutWidth / 2.0) - paddingToCutout)
            let rightStart = ceil(center + (cutoutWidth / 2.0) + paddingToCutout)
            
            let leftWidth = max(0, leftEnd - sideMargin)
            let rightWidth = max(0, screenWidth - rightStart - sideMargin)
            
            let barHeight: CGFloat = isIsland ? 38.0 : 32.0
            let barTop: CGFloat = isIsland ? 11.0 : (safeTop - barHeight)
            
            let leftRect = CGRect(x: sideMargin, y: barTop, width: leftWidth, height: barHeight)
            let rightRect = CGRect(x: rightStart, y: barTop, width: rightWidth, height: barHeight)
            
            return IslandFlanks(leftFlank: leftRect, rightFlank: rightRect, isIsland: isIsland, safeTop: safeTop)
        } else {
            // 无刘海设备 (如 iPhone SE)
            let fullRect = CGRect(x: sideMargin, y: 0, width: screenWidth - sideMargin * 2, height: safeTop)
            return IslandFlanks(leftFlank: fullRect, rightFlank: fullRect, isIsland: false, safeTop: safeTop)
        }
    }
}
