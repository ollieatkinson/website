import Foundation

struct HomeContent {
    let name = "Oliver Atkinson"
    let description = "I make things in Swift, mostly on macOS. System extensions, security tooling, and the rough edges where software meets the OS. Previously, iOS apps."
    let links = [
        (title: "GitHub", href: "https://github.com/ollieatkinson"),
        (title: "LinkedIn", href: "https://www.linkedin.com/in/oliveratkinson/")
    ]
    static let oliver = HomeContent()
}

func escapeHTML(_ value: String) -> String {
    value.replacingOccurrences(of: "&", with: "&amp;")
        .replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;")
        .replacingOccurrences(of: "\"", with: "&quot;")
        .replacingOccurrences(of: "'", with: "&#39;")
}
