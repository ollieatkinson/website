public struct FrameSchedulePolicy: Sendable, Equatable {
    public var activeFrameDelayMilliseconds: Double
    public var ambientFrameDelayMilliseconds: Double
    public var longIdleFrameDelayMilliseconds: Double
    public var hiddenFrameDelayMilliseconds: Double
    public var activeInteractionWindow: Double
    public var ambientInteractionWindow: Double
    public var ambientAnimationTimeScale: Double
    public var longIdleAnimationTimeScale: Double

    public init(
        activeFrameDelayMilliseconds: Double = 1_000.0 / 30.0,
        ambientFrameDelayMilliseconds: Double = 1_000.0 / 12.0,
        longIdleFrameDelayMilliseconds: Double = 2_500.0,
        hiddenFrameDelayMilliseconds: Double = 5_000.0,
        activeInteractionWindow: Double = 8.0,
        ambientInteractionWindow: Double = 45.0,
        ambientAnimationTimeScale: Double = 0.35,
        longIdleAnimationTimeScale: Double = 0.04
    ) {
        self.activeFrameDelayMilliseconds = activeFrameDelayMilliseconds
        self.ambientFrameDelayMilliseconds = ambientFrameDelayMilliseconds
        self.longIdleFrameDelayMilliseconds = longIdleFrameDelayMilliseconds
        self.hiddenFrameDelayMilliseconds = hiddenFrameDelayMilliseconds
        self.activeInteractionWindow = activeInteractionWindow
        self.ambientInteractionWindow = ambientInteractionWindow
        self.ambientAnimationTimeScale = ambientAnimationTimeScale
        self.longIdleAnimationTimeScale = longIdleAnimationTimeScale
    }

    public func nextFrameDelayMilliseconds(
        isDocumentHidden: Bool,
        pointerEnergy: Double,
        idleDuration: Double
    ) -> Double {
        if isDocumentHidden {
            return hiddenFrameDelayMilliseconds
        }

        if pointerEnergy > 0.01 || idleDuration < activeInteractionWindow {
            return activeFrameDelayMilliseconds
        }

        if idleDuration < ambientInteractionWindow {
            return ambientFrameDelayMilliseconds
        }

        return longIdleFrameDelayMilliseconds
    }

    public func animationTimeScale(
        isDocumentHidden: Bool,
        pointerEnergy: Double,
        idleDuration: Double
    ) -> Double {
        if isDocumentHidden {
            return 0
        }

        if pointerEnergy > 0.01 || idleDuration < activeInteractionWindow {
            return 1
        }

        if idleDuration < ambientInteractionWindow {
            let progress = smoothstep(
                min: activeInteractionWindow,
                max: ambientInteractionWindow,
                value: idleDuration
            )
            return mix(1, ambientAnimationTimeScale, progress)
        }

        return longIdleAnimationTimeScale
    }

    public func estimatedIdleFrameCount(over duration: Double) -> Int {
        var frameCount = 0
        var elapsed = 0.0

        while elapsed < duration {
            let delay = nextFrameDelayMilliseconds(
                isDocumentHidden: false,
                pointerEnergy: 0,
                idleDuration: elapsed
            ) / 1_000.0

            elapsed += delay
            frameCount += 1
        }

        return frameCount
    }

    private func mix(_ a: Double, _ b: Double, _ progress: Double) -> Double {
        a + (b - a) * progress
    }

    private func smoothstep(min: Double, max: Double, value: Double) -> Double {
        guard max > min else {
            return value >= max ? 1 : 0
        }

        let x = Swift.max(0, Swift.min(1, (value - min) / (max - min)))
        return x * x * (3 - 2 * x)
    }
}
