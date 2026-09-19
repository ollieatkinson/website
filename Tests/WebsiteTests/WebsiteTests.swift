import Foundation
import Testing
@testable import Website

@Test func escapesSourceAndAttributeCharacters() {
    #expect(escapeHTML("<&\"'>") == "&lt;&amp;&quot;&#39;&gt;")
    #expect(Home().html.contains("steps &lt; 200"))
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
    #expect(html.hasPrefix("<!doctype html>"))
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
