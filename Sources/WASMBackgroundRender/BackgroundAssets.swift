enum BackgroundAssets {
    static let canvasID = "swarm-field"
    static let version = "20260504-pointer-y"
    static let shaderURL = "/background.wgsl?v=\(version)"
}

enum BackgroundError: Error {
    case webGPUNotAvailable
    case shaderLoadFailed
}
