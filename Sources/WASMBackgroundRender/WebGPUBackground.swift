import BackgroundRenderCore
import JavaScriptKit

final class WebGPUBackground {
    private let runtime = BrowserRuntime()
    private let schedulePolicy = FrameSchedulePolicy()
    private let canvas: JSObject
    private var pointer = PointerState()
    private var clock = FrameClock()
    private var scene: BackgroundScene?
    private var sceneLoader: BackgroundSceneLoader?
    private var animationFrame: JSClosure?
    private var revealFrame: JSClosure?
    private var timeoutFrame: JSClosure?
    private var timeoutHandle: JSValue?
    private var pointerMove: JSClosure?
    private var pointerDown: JSClosure?
    private var pointerLeave: JSClosure?
    private var visibilityChange: JSClosure?
    private var isRunning = false
    private var isAnimationFrameScheduled = false
    private var lastInteractionTime = 0.0
    private var lastRenderTime = 0.0
    private var lastScheduledDelayMilliseconds = 0.0
    private var frameSampleCount = 0
    private var slowFrameCount = 0
    private var hasRevealed = false

    init?(canvasID: String) {
        guard let canvas = runtime.document.getElementById!(canvasID).object else {
            return nil
        }

        self.canvas = canvas
    }

    func start() {
        guard !runtime.animatedBackgroundDisabled else {
            fallBackToCSS()
            return
        }

        guard runtime.supportsWebGPU else {
            fallBackToCSS()
            return
        }

        isRunning = true
        installInputHandlers()
        installVisibilityHandler()
        sceneLoader = BackgroundSceneLoader(canvas: canvas, runtime: runtime)
        sceneLoader?.load(
            success: { [weak self] scene in
                guard let self else {
                    return
                }

                guard self.isRunning, !self.runtime.animatedBackgroundDisabled else {
                    self.fallBackToCSS()
                    return
                }

                self.scene = scene
                self.sceneLoader = nil
                self.canvas.dataset.rendering = .string("webgpu")
                self.canvas.dataset.reveal = .string("pending")
                self.installRenderLoop()
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
            background.markInteraction()
        }

        pointerDown = pointerHandler { background, event in
            background.pointer.press(
                at: event,
                in: Viewport.current(in: background.runtime.window)
            )
            background.markInteraction()
        }

        pointerLeave = JSClosure { [weak self] _ in
            self?.pointer.leave()
            return .undefined
        }

        addWindowListener(.move, pointerMove)
        addWindowListener(.down, pointerDown)
        addWindowListener(.leave, pointerLeave)
    }

    private func installVisibilityHandler() {
        visibilityChange = JSClosure { [weak self] _ in
            guard let self else {
                return .undefined
            }

            if !self.runtime.isDocumentHidden {
                self.markInteraction()
            }

            return .undefined
        }

        guard let visibilityChange else {
            return
        }

        _ = runtime.document.addEventListener!("visibilitychange", visibilityChange)
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

        let options = runtime.makeObject()
        options.passive = .boolean(true)
        _ = runtime.window.addEventListener!(event.rawValue, closure, options)
    }

    private func markInteraction() {
        lastInteractionTime = runtime.nowSeconds
        requestNextFrame(after: 0, replacingExisting: true)
    }

    private func installRenderLoop() {
        animationFrame = JSClosure { [weak self] arguments in
            self?.render(arguments)
            return .undefined
        }

        timeoutFrame = JSClosure { [weak self] _ in
            self?.timeoutHandle = nil
            self?.requestAnimationFrame()
            return .undefined
        }

        requestNextFrame(after: 0)
    }

    private func render(_ arguments: [JSValue]) {
        isAnimationFrameScheduled = false

        guard isRunning else {
            return
        }

        guard !runtime.animatedBackgroundDisabled else {
            fallBackToCSS()
            return
        }

        guard let scene else {
            return
        }

        let time = (arguments.first?.number ?? 0) * 0.001
        if lastInteractionTime == 0 {
            lastInteractionTime = time
        }

        let frameIntervalMilliseconds = lastRenderTime == 0
            ? 0
            : (time - lastRenderTime) * 1_000.0
        lastRenderTime = time

        let delta = clock.tick(at: time)
        pointer.decay(over: delta)

        let viewport = Viewport.current(in: runtime.window)
        viewport.apply(to: canvas)

        let drawStartedAt = runtime.nowMilliseconds
        scene.draw(time: time, viewport: viewport, pointer: pointer)
        let drawDurationMilliseconds = runtime.nowMilliseconds - drawStartedAt
        revealAfterFirstDraw()

        if shouldDisableForSlowPerformance(
            frameIntervalMilliseconds: frameIntervalMilliseconds,
            drawDurationMilliseconds: drawDurationMilliseconds
        ) {
            disableForSlowPerformance(reason: "slow-frame")
            return
        }

        requestNextFrame(after: nextFrameDelay(at: time))
    }

    private func nextFrameDelay(at time: Double) -> Double {
        schedulePolicy.nextFrameDelayMilliseconds(
            isDocumentHidden: runtime.isDocumentHidden,
            pointerEnergy: pointer.energy,
            idleDuration: max(0, time - lastInteractionTime)
        )
    }

    private func requestNextFrame(after delay: Double, replacingExisting: Bool = false) {
        guard isRunning else {
            return
        }

        if replacingExisting {
            cancelTimeout()
        }

        guard timeoutHandle == nil, !isAnimationFrameScheduled else {
            return
        }

        lastScheduledDelayMilliseconds = delay

        if delay <= 0 {
            requestAnimationFrame()
            return
        }

        guard let timeoutFrame else {
            return
        }

        timeoutHandle = runtime.window.setTimeout!(timeoutFrame, delay)
    }

    private func requestAnimationFrame() {
        guard isRunning, let animationFrame, !isAnimationFrameScheduled else {
            return
        }

        isAnimationFrameScheduled = true
        _ = runtime.window.requestAnimationFrame!(animationFrame)
    }

    private func revealAfterFirstDraw() {
        guard !hasRevealed else {
            return
        }

        hasRevealed = true
        revealFrame = JSClosure { [weak self] _ in
            guard let self, self.isRunning else {
                return .undefined
            }

            self.canvas.dataset.reveal = .string("visible")
            return .undefined
        }

        guard let revealFrame else {
            return
        }

        _ = runtime.window.requestAnimationFrame!(revealFrame)
    }

    private func cancelTimeout() {
        guard let timeoutHandle else {
            return
        }

        _ = runtime.window.clearTimeout!(timeoutHandle)
        self.timeoutHandle = nil
    }

    private func shouldDisableForSlowPerformance(
        frameIntervalMilliseconds: Double,
        drawDurationMilliseconds: Double
    ) -> Bool {
        guard
            !runtime.isDocumentHidden,
            frameIntervalMilliseconds > 0,
            lastScheduledDelayMilliseconds <= schedulePolicy.ambientFrameDelayMilliseconds
        else {
            return false
        }

        frameSampleCount += 1

        let expectedInterval = max(16.7, lastScheduledDelayMilliseconds)
        if drawDurationMilliseconds > 18 || frameIntervalMilliseconds > expectedInterval + 70 {
            slowFrameCount += 1
        }

        guard frameSampleCount >= 18 else {
            return false
        }

        let shouldDisable = slowFrameCount >= 6
        frameSampleCount = 0
        slowFrameCount = 0
        return shouldDisable
    }

    private func disableForSlowPerformance(reason: String) {
        fallBackToCSS()
        runtime.dispatchWindowEvent("olbo-background-slow", reason: reason)
    }

    private func fallBackToCSS() {
        isRunning = false
        hasRevealed = false
        cancelTimeout()
        canvas.dataset.rendering = .string("css")
        _ = canvas.removeAttribute!("data-reveal")
    }
}

private enum PointerEvent: String {
    case move = "pointermove"
    case down = "pointerdown"
    case leave = "pointerleave"
}
