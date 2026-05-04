import Foundation
import Raptor

@main
struct WebsiteApp {
    static func main() async {
        var site = Website()

        do {
            try await site.publish(buildDirectoryPath: "dist")
            try normalizeRootSitemap()
        } catch {
            FileHandle.standardError.write(Data("Build failed: \(error)\n".utf8))
            Foundation.exit(1)
        }
    }

    private static func normalizeRootSitemap() throws {
        let sitemapURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("dist/sitemap.xml")

        guard var sitemap = try? String(contentsOf: sitemapURL, encoding: .utf8) else {
            return
        }

        sitemap = sitemap.replacingOccurrences(
            of: "https://olbo.dev//",
            with: "https://olbo.dev/"
        )

        try sitemap.write(to: sitemapURL, atomically: true, encoding: .utf8)
    }
}

struct Website: Site {
    var name = "olbo.dev"
    var titleSuffix = ""
    var url = URL(static: "https://olbo.dev")
    var author = "Oliver Atkinson"
    var description: String? = "Oliver Atkinson writes Swift for macOS, system extensions, and security tools."
    var homePage = Home()
    var layout = MainLayout()
    var colorScheme: Scheme { .dark }
    var feedConfiguration: FeedConfiguration? { nil }
}
