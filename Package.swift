// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "Website",
    platforms: [.macOS("26.0")],
    products: [
        .executable(name: "Website", targets: ["Website"])
    ],
    dependencies: [
        .package(
            url: "https://github.com/raptor-build/raptor.git",
            from: "0.1.2"
        )
    ],
    targets: [
        .executableTarget(
            name: "Website",
            dependencies: [
                .product(name: "Raptor", package: "Raptor")
            ]
        )
    ]
)
