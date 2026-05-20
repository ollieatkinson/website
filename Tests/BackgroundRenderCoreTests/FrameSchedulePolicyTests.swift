import BackgroundRenderCore
import XCTest

final class FrameSchedulePolicyTests: XCTestCase {
    private let policy = FrameSchedulePolicy()

    func testUsesActiveCadenceImmediatelyAfterInteraction() {
        XCTAssertEqual(
            policy.nextFrameDelayMilliseconds(
                isDocumentHidden: false,
                pointerEnergy: 0,
                idleDuration: 1
            ),
            1_000.0 / 30.0,
            accuracy: 0.001
        )
    }

    func testUsesActiveCadenceWhilePointerEnergyIsDecaying() {
        XCTAssertEqual(
            policy.nextFrameDelayMilliseconds(
                isDocumentHidden: false,
                pointerEnergy: 0.02,
                idleDuration: 120
            ),
            1_000.0 / 30.0,
            accuracy: 0.001
        )
    }

    func testDropsToAmbientCadenceAfterActiveWindow() {
        XCTAssertEqual(
            policy.nextFrameDelayMilliseconds(
                isDocumentHidden: false,
                pointerEnergy: 0,
                idleDuration: 10
            ),
            1_000.0 / 12.0,
            accuracy: 0.001
        )
    }

    func testDropsToLongIdleCadenceAfterAmbientWindow() {
        XCTAssertEqual(
            policy.nextFrameDelayMilliseconds(
                isDocumentHidden: false,
                pointerEnergy: 0,
                idleDuration: 60
            ),
            2_500,
            accuracy: 0.001
        )
    }

    func testHiddenDocumentUsesLowestCadence() {
        XCTAssertEqual(
            policy.nextFrameDelayMilliseconds(
                isDocumentHidden: true,
                pointerEnergy: 1,
                idleDuration: 0
            ),
            5_000,
            accuracy: 0.001
        )
    }

    func testAnimationRunsAtFullSpeedDuringActiveWindow() {
        XCTAssertEqual(
            policy.animationTimeScale(
                isDocumentHidden: false,
                pointerEnergy: 0,
                idleDuration: 4
            ),
            1,
            accuracy: 0.001
        )
    }

    func testAnimationSlowsDuringAmbientCadence() {
        XCTAssertLessThan(
            policy.animationTimeScale(
                isDocumentHidden: false,
                pointerEnergy: 0,
                idleDuration: 14
            ),
            1
        )
    }

    func testAnimationBarelyAdvancesDuringLongIdle() {
        XCTAssertEqual(
            policy.animationTimeScale(
                isDocumentHidden: false,
                pointerEnergy: 0,
                idleDuration: 60
            ),
            0.04,
            accuracy: 0.001
        )
    }

    func testOneHourIdleFrameBudgetStaysBelowOnePercentOfContinuousRaf() {
        let idleFrameCount = policy.estimatedIdleFrameCount(over: 60 * 60)
        let continuousAnimationFrameCount = 60 * 60 * 60

        XCTAssertLessThanOrEqual(idleFrameCount, continuousAnimationFrameCount / 100)
    }

    func testIdleFrameBudgetSimulationPerformance() {
        measure {
            _ = policy.estimatedIdleFrameCount(over: 24 * 60 * 60)
        }
    }
}
