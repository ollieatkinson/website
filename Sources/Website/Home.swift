import Foundation
import Raptor

struct Home: Page {
    private let content = HomeContent.oliver

    var path = "/"
    var title = "olbo / Oliver Atkinson"
    var description = "Oliver Atkinson writes Swift for macOS, system extensions, and security tools."
    var image: URL? { URL(static: "https://olbo.dev/og-image.png") }

    var body: some HTML {
        HomeScreen(content: content)
    }
}
