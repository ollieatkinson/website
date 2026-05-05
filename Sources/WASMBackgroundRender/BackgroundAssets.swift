enum BackgroundAssets {
    static let canvasID = "swarm-field"
    static let version = "20260505-background-fade"
    static let shaderURL = "/background.wgsl?v=\(version)"
}

enum BackgroundError: Error {
    case webGPUNotAvailable
    case shaderLoadFailed
}
