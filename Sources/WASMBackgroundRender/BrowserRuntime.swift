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

    func warn(_ message: String, _ detail: String) {
        _ = console.warn!(message, detail)
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
            pixelRatio: min(2.0, max(1.0, window.devicePixelRatio.number ?? 1.0))
        )
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
