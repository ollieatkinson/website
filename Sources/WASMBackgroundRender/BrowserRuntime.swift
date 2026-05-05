import JavaScriptKit

struct BrowserRuntime {
    let global = JSObject.global

    var document: JSObject { global.document.object! }
    var window: JSObject { global.window.object! }
    var navigator: JSObject { global.navigator.object! }
    var console: JSObject { global.console.object! }

    var supportsWebGPU: Bool {
        navigator.gpu.object != nil
    }

    var animatedBackgroundDisabled: Bool {
        global.olboAnimatedBackgroundDisabled.boolean == true
    }

    var isDocumentHidden: Bool {
        document.hidden.boolean == true
    }

    var nowMilliseconds: Double {
        global.performance.now().number ?? 0
    }

    var nowSeconds: Double {
        nowMilliseconds * 0.001
    }

    func warn(_ message: String, _ detail: String) {
        _ = console.warn!(message, detail)
    }

    func dispatchWindowEvent(_ name: String, reason: String) {
        guard let customEvent = global.CustomEvent.object else {
            return
        }

        let detail = makeObject()
        detail.reason = .string(reason)

        let options = makeObject()
        options.detail = .object(detail)

        let event = customEvent.new(name, options)
        _ = window.dispatchEvent!(event)
    }

    func makeObject() -> JSObject {
        global.Object.object!.new()
    }
}

struct Viewport {
    var width: Double
    var height: Double
    var pixelRatio: Double

    static func current(in window: JSObject) -> Viewport {
        Viewport(
            width: max(1.0, window.innerWidth.number ?? 1.0),
            height: max(1.0, window.innerHeight.number ?? 1.0),
            pixelRatio: pixelRatio(
                width: max(1.0, window.innerWidth.number ?? 1.0),
                height: max(1.0, window.innerHeight.number ?? 1.0),
                devicePixelRatio: window.devicePixelRatio.number ?? 1.0
            )
        )
    }

    private static func pixelRatio(width: Double, height: Double, devicePixelRatio: Double) -> Double {
        let cappedRatio = min(1.5, max(1.0, devicePixelRatio))
        let targetPixelBudget = 1_600_000.0
        let cssPixelArea = width * height
        let cappedPixelArea = cssPixelArea * cappedRatio * cappedRatio

        guard cappedPixelArea > targetPixelBudget else {
            return cappedRatio
        }

        return min(cappedRatio, max(0.7, (targetPixelBudget / cssPixelArea).squareRoot()))
    }

    var pixelWidth: Double {
        (width * pixelRatio).rounded(.down)
    }

    var pixelHeight: Double {
        (height * pixelRatio).rounded(.down)
    }

    func apply(to canvas: JSObject) {
        if canvas.width.number != pixelWidth {
            canvas.width = .number(pixelWidth)
        }

        if canvas.height.number != pixelHeight {
            canvas.height = .number(pixelHeight)
        }

        canvas.style.width = .string("\(Int(width))px")
        canvas.style.height = .string("\(Int(height))px")
    }
}

struct UnitPoint {
    var x: Double
    var y: Double

    static let center = UnitPoint(x: 0.5, y: 0.5)
}

struct PointerState {
    var position = UnitPoint.center
    var energy = 0.0

    mutating func move(to event: JSObject, in viewport: Viewport) {
        position = UnitPoint(
            x: (event.clientX.number ?? viewport.width * 0.5) / viewport.width,
            y: (event.clientY.number ?? viewport.height * 0.5) / viewport.height
        )
        energy = 1.0
    }

    mutating func press(at event: JSObject, in viewport: Viewport) {
        move(to: event, in: viewport)
        energy = 1.0
    }

    mutating func leave() {
        energy = 0.0
    }

    mutating func decay(over delta: Double) {
        energy = max(0, energy - delta * 0.34)
    }
}

struct FrameClock {
    private var lastFrame = 0.0

    mutating func tick(at time: Double) -> Double {
        let delta = lastFrame == 0
            ? 1.0 / 60.0
            : min(0.08, max(0.0, time - lastFrame))

        lastFrame = time
        return delta
    }
}
