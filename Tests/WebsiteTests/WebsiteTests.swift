import Elementary
import Foundation
import Testing
@testable import Website

@Test func rendersSourceAsTextInsteadOfMarkup() {
    let source = "</textarea><script>alert(\"hello & goodbye\")</script>"
    let html = SwiftPlayground(source: source).render()
    #expect(html.contains("&lt;/textarea&gt;&lt;script&gt;"))
    #expect(html.contains("hello &amp; goodbye"))
    #expect(!html.contains("<script>"))
    #expect(Home().render().contains("steps &lt; 200"))
}

@Test func escapesAttributeValues() {
    let value = "\" autofocus onfocus=\"alert(1)&"
    let html = MainLayout(page: a(.href(value)) { "Profile" }).render()
    #expect(html.contains("href=\"&quot; autofocus onfocus=&quot;alert(1)&amp;\""))
    #expect(!html.contains("href=\"\" autofocus"))
}

@Test func publishesStandaloneSiteAndReplacesStaleOutput() throws {
    let files = FileManager.default
    let root = files.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? files.removeItem(at: root) }
    let assets = root.appendingPathComponent("Assets")
    try files.createDirectory(at: assets, withIntermediateDirectories: true)
    try "olbo.dev".write(to: assets.appendingPathComponent("CNAME"), atomically: true, encoding: .utf8)
    try Website.publish(at: root)
    let output = root.appendingPathComponent("dist")
    try "old page".write(to: output.appendingPathComponent("stale.html"), atomically: true, encoding: .utf8)
    try Website.publish(at: root)
    #expect(!files.fileExists(atPath: output.appendingPathComponent("stale.html").path))
    #expect(try String(contentsOf: output.appendingPathComponent("CNAME"), encoding: .utf8) == "olbo.dev")
    let html = try String(contentsOf: output.appendingPathComponent("index.html"), encoding: .utf8)
    #expect(html.hasPrefix("<!DOCTYPE html>"))
    #expect(html.contains("<html lang=\"en\">"))
    #expect(html.contains("<main id=\"content\">"))
    #expect(html.contains("id=\"source\""))
    #expect(html.contains("https://github.com/ollieatkinson"))
    let sitemap = try String(contentsOf: output.appendingPathComponent("sitemap.xml"), encoding: .utf8)
    #expect(sitemap.contains("<loc>https://olbo.dev/</loc>"))
    #expect(files.fileExists(atPath: output.appendingPathComponent(".nojekyll").path))
}

@Test func missingAssetsDoesNotRemoveExistingSite() throws {
    let files = FileManager.default
    let root = files.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? files.removeItem(at: root) }
    let output = root.appendingPathComponent("dist")
    try files.createDirectory(at: output, withIntermediateDirectories: true)
    let existing = output.appendingPathComponent("index.html")
    try "existing".write(to: existing, atomically: true, encoding: .utf8)
    #expect(throws: (any Error).self) { try Website.publish(at: root) }
    #expect(try String(contentsOf: existing, encoding: .utf8) == "existing")
}
