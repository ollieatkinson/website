// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "Website",
    products: [.executable(name: "Website", targets: ["Website"])],
    targets: [
        .executableTarget(name: "Website"),
        .testTarget(name: "WebsiteTests", dependencies: ["Website"])
    ]
)
