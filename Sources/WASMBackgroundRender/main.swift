import JavaScriptEventLoop

JavaScriptEventLoop.installGlobalExecutor()

private let renderer = WebGPUBackground(canvasID: BackgroundAssets.canvasID)
renderer?.start()
