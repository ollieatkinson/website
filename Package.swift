// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "Website",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "Website", targets: ["Website"])],
    dependencies: [
        .package(url: "https://github.com/elementary-swift/elementary.git", exact: "0.8.1")
    ],
    targets: [
        .executableTarget(name: "Website", dependencies: [.product(name: "Elementary", package: "elementary")]),
        .testTarget(name: "WebsiteTests", dependencies: ["Website"])
    ]
)
