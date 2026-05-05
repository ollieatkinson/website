public struct FrameSchedulePolicy: Sendable, Equatable {
    public var activeFrameDelayMilliseconds: Double
    public var ambientFrameDelayMilliseconds: Double
    public var longIdleFrameDelayMilliseconds: Double
    public var hiddenFrameDelayMilliseconds: Double
    public var activeInteractionWindow: Double
    public var ambientInteractionWindow: Double

    public init(
        activeFrameDelayMilliseconds: Double = 1_000.0 / 30.0,
        ambientFrameDelayMilliseconds: Double = 1_000.0 / 6.0,
        longIdleFrameDelayMilliseconds: Double = 2_000.0,
        hiddenFrameDelayMilliseconds: Double = 5_000.0,
        activeInteractionWindow: Double = 4.0,
        ambientInteractionWindow: Double = 30.0
    ) {
        self.activeFrameDelayMilliseconds = activeFrameDelayMilliseconds
        self.ambientFrameDelayMilliseconds = ambientFrameDelayMilliseconds
        self.longIdleFrameDelayMilliseconds = longIdleFrameDelayMilliseconds
        self.hiddenFrameDelayMilliseconds = hiddenFrameDelayMilliseconds
        self.activeInteractionWindow = activeInteractionWindow
        self.ambientInteractionWindow = ambientInteractionWindow
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
}
