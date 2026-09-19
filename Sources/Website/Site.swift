import Elementary
import Foundation

@main
struct WebsiteApp {
    static func main() throws {
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        try Website.publish(at: root)
        print("Built dist — serve with: python3 -m http.server 5173 --directory dist")
    }
}

struct Website {
    static func publish(at root: URL) throws {
        let files = FileManager.default
        let output = root.appendingPathComponent("dist", isDirectory: true)
        let assets = root.appendingPathComponent("Assets", isDirectory: true)
        // Validate inputs before replacing the generated directory.
        _ = try files.contentsOfDirectory(at: assets, includingPropertiesForKeys: nil)
        if files.fileExists(atPath: output.path) { try files.removeItem(at: output) }
        try files.copyItem(at: assets, to: output)
        try MainLayout(page: Home()).render().write(to: output.appendingPathComponent("index.html"), atomically: true, encoding: .utf8)
        try """
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://olbo.dev/</loc></url></urlset>
        """.write(to: output.appendingPathComponent("sitemap.xml"), atomically: true, encoding: .utf8)
        try "User-agent: *\nAllow: /\nSitemap: https://olbo.dev/sitemap.xml\n".write(to: output.appendingPathComponent("robots.txt"), atomically: true, encoding: .utf8)
        try "".write(to: output.appendingPathComponent(".nojekyll"), atomically: true, encoding: .utf8)
    }
}
