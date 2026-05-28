// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "Website",
    platforms: [.macOS("26.0")],
    products: [
        .executable(name: "Website", targets: ["Website"]),
        .executable(name: "WASMBackgroundRender", targets: ["WASMBackgroundRender"])
    ],
    dependencies: [
        .package(
            url: "https://github.com/raptor-build/raptor.git",
            from: "0.1.2"
        ),
        .package(
            url: "https://github.com/swiftwasm/JavaScriptKit.git",
            from: "0.50.2"
        )
    ],
    targets: [
        .target(
            name: "BackgroundRenderCore"
        ),
        .executableTarget(
            name: "Website",
            dependencies: [
                .product(name: "Raptor", package: "Raptor")
            ]
        ),
        .executableTarget(
            name: "WASMBackgroundRender",
            dependencies: [
                "BackgroundRenderCore",
                .product(name: "JavaScriptKit", package: "JavaScriptKit"),
                .product(name: "JavaScriptEventLoop", package: "JavaScriptKit")
            ]
        ),
        .testTarget(
            name: "BackgroundRenderCoreTests",
            dependencies: [
                "BackgroundRenderCore"
            ]
        )
    ]
)
