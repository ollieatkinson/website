import JavaScriptKit

final class BackgroundSceneLoader {
    private let canvas: JSObject
    private let runtime: BrowserRuntime
    private var shaderSource: String?
    private var promise: JSPromise?

    init(canvas: JSObject, runtime: BrowserRuntime) {
        self.canvas = canvas
        self.runtime = runtime
    }

    func load(
        success: @escaping (BackgroundScene) -> Void,
        failure: @escaping (String) -> Void
    ) {
        let fetch = runtime.global.fetch.object!

        promise = JSPromise(fetch(BackgroundAssets.shaderURL).object!)?
            .then { shaderResponse in
                guard let response = shaderResponse.object else {
                    return Self.reject("Shader response was not an object.")
                }

                return response.text!()
            }
            .then { [weak self] shaderText in
                guard
                    let self,
                    let shaderSource = shaderText.string
                else {
                    return Self.reject("Shader source could not be decoded.")
                }

                self.shaderSource = shaderSource
                return self.runtime.navigator.gpu.object!.requestAdapter!()
            }
            .then { adapterValue in
                guard let adapter = adapterValue.object else {
                    return Self.reject("WebGPU adapter is unavailable.")
                }

                return adapter.requestDevice!()
            }
            .then(
                success: { [weak self] deviceValue in
                    guard
                        let self,
                        let shaderSource = self.shaderSource,
                        let device = deviceValue.object
                    else {
                        failure("WebGPU device is unavailable.")
                        return .undefined
                    }

                    do {
                        let scene = try BackgroundScene.make(
                            canvas: self.canvas,
                            runtime: self.runtime,
                            shaderSource: shaderSource,
                            device: device
                        )
                        success(scene)
                    } catch {
                        failure("\(error)")
                    }

                    return .undefined
                },
                failure: { error in
                    failure(error.string ?? "WebGPU setup failed.")
                    return .undefined
                }
            )
    }

    private static func reject(_ message: String) -> JSValue {
        JSPromise.reject(message).jsValue()
    }
}
