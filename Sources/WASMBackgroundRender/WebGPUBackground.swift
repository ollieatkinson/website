import JavaScriptKit

final class WebGPUBackground {
    private let runtime = BrowserRuntime()
    private let canvas: JSObject
    private var pointer = PointerState()
    private var clock = FrameClock()
    private var scene: BackgroundScene?
    private var sceneLoader: BackgroundSceneLoader?
    private var animationFrame: JSClosure?
    private var pointerMove: JSClosure?
    private var pointerDown: JSClosure?
    private var pointerLeave: JSClosure?

    init?(canvasID: String) {
        guard let canvas = runtime.document.getElementById!(canvasID).object else {
            return nil
        }

        self.canvas = canvas
    }

    func start() {
        guard runtime.supportsWebGPU else {
            fallBackToCSS()
            return
        }

        installInputHandlers()
        sceneLoader = BackgroundSceneLoader(canvas: canvas, runtime: runtime)
        sceneLoader?.load(
            success: { [weak self] scene in
                self?.scene = scene
                self?.sceneLoader = nil
                self?.canvas.dataset.rendering = .string("webgpu")
                self?.installRenderLoop()
            },
            failure: { [weak self] message in
                self?.sceneLoader = nil
                self?.fallBackToCSS()
                self?.runtime.warn("SwiftWasm WebGPU background failed:", message)
            }
        )
    }

    private func installInputHandlers() {
        pointerMove = pointerHandler { background, event in
            background.pointer.move(
                to: event,
                in: Viewport.current(in: background.runtime.window)
            )
        }

        pointerDown = pointerHandler { background, event in
            background.pointer.press(
                at: event,
                in: Viewport.current(in: background.runtime.window)
            )
        }

        pointerLeave = JSClosure { [weak self] _ in
            self?.pointer.leave()
            return .undefined
        }

        addWindowListener(.move, pointerMove)
        addWindowListener(.down, pointerDown)
        addWindowListener(.leave, pointerLeave)
    }

    private func pointerHandler(
        _ update: @escaping (WebGPUBackground, JSObject) -> Void
    ) -> JSClosure {
        JSClosure { [weak self] arguments in
            guard
                let self,
                let event = arguments.first?.object
            else {
                return .undefined
            }

            update(self, event)
            return .undefined
        }
    }

    private func addWindowListener(_ event: PointerEvent, _ closure: JSClosure?) {
        guard let closure else {
            return
        }

        _ = runtime.window.addEventListener!(event.rawValue, closure)
    }

    private func installRenderLoop() {
        animationFrame = JSClosure { [weak self] arguments in
            self?.render(arguments)
            return .undefined
        }

        requestNextFrame()
    }

    private func render(_ arguments: [JSValue]) {
        guard let scene else {
            return
        }

        let time = (arguments.first?.number ?? 0) * 0.001
        let delta = clock.tick(at: time)
        pointer.decay(over: delta)

        let viewport = Viewport.current(in: runtime.window)
        viewport.apply(to: canvas)

        scene.draw(time: time, viewport: viewport, pointer: pointer)
        requestNextFrame()
    }

    private func requestNextFrame() {
        guard let animationFrame else {
            return
        }

        _ = runtime.window.requestAnimationFrame!(animationFrame)
    }

    private func fallBackToCSS() {
        canvas.dataset.rendering = .string("css")
    }
}

private enum PointerEvent: String {
    case move = "pointermove"
    case down = "pointerdown"
    case leave = "pointerleave"
}
