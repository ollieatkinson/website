import Elementary

struct SwiftPlayground: HTML {
    var source = Self.sample

    var body: some HTML {
        details(.id("playground"), .class("playground")) {
            summary {
                "A small Swift playground "
                span(.custom(name: "aria-hidden", value: "true")) { "↗" }
            }
            div(.class("playground-body")) {
                p { "Edit, run, print, repeat. Your code stays in this browser." }
                div(.class("editor-toolbar")) {
                    label(.for("source")) { "main.swift" }
                    div(.class("editor-actions")) {
                        button(.id("run"), .type(.button), .disabled) { "Run ↵" }
                        button(.id("stop"), .type(.button), .disabled) { "Stop" }
                    }
                }
                textarea(
                    .id("source"),
                    .custom(name: "spellcheck", value: "false"),
                    .custom(name: "autocapitalize", value: "off"),
                    .autocomplete(.off),
                    .custom(name: "aria-describedby", value: "editor-hint")
                ) { source }
                div(.class("output-toolbar")) {
                    label(.for("output")) { "Output" }
                    span(.id("run-status"), .role("status")) { "Ready when you are" }
                }
                pre(.id("output"), .tabindex(0), .custom(name: "aria-label", value: "Program output")) {
                    "Press Run to see what happens."
                }
                p(.id("editor-hint"), .class("editor-hint")) {
                    "⌘ / Ctrl + Enter to run. Use print() to inspect values. "
                    a(.href("https://miniswift.run/studio/")) { "Full debugger ↗" }
                }
                noscript { p { "Enable JavaScript to run Swift here." } }
            }
        }
    }

    static let sample = #"""
    // A tiny Collatz experiment. Try another starting number.
    var n = 27
    var steps = 0

    while n != 1 && steps < 200 {
        if n % 2 == 0 {
            n = n / 2
        } else {
            n = 3 * n + 1
        }
        steps += 1
        print("\(steps): \(n)")
    }
    print("Reached \(n) in \(steps) steps.")
    """#
}
