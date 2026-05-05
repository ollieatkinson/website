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
        PlaygroundWindow()
    }
}

struct PlaygroundWindow: HTML {
    var body: some HTML {
        Tag("div") {
            Tag("section") {
                Tag("div") {
                    toolbar

                    Tag("div") {
                        PlaygroundEditorPanel()
                        PlaygroundOutputPanel()
                    }
                    .class("swift-playground")
                }
                .class("playground-window")
            }
            .class("playground-float")
            .attribute("data-playground-window", "")
            .attribute("hidden", "")

            Tag("nav") {
                Tag("button") {
                    Tag("span") {
                        Tag("span") { "" }
                            .class("dock-terminal-bar")
                        Tag("span") { ">_" }
                            .class("dock-terminal-prompt")
                    }
                    .class("dock-icon dock-terminal")
                    .attribute("aria-hidden", "true")

                    Tag("span") { "Swift Playground" }
                        .class("dock-label")
                }
                .class("dock-item")
                .attribute("type", "button")
                .attribute("data-playground-dock", "")
                .attribute("aria-label", "Open Swift Playground")
            }
            .class("playground-dock")
            .attribute("aria-label", "Dock")
        }
        .class("playground-shell")
        .attribute("data-swift-playground", "")
    }

    private var toolbar: some HTML {
        Tag("div") {
            Tag("div") {
                Tag("button") { "" }
                    .class("window-dot window-dot-close")
                    .attribute("type", "button")
                    .attribute("aria-label", "Close playground")
                    .attribute("data-playground-close", "")

                Tag("button") { "" }
                    .class("window-dot window-dot-minimize")
                    .attribute("type", "button")
                    .attribute("aria-label", "Collapse playground")
                    .attribute("data-playground-collapse", "")

                Tag("button") { "" }
                    .class("window-dot window-dot-zoom")
                    .attribute("type", "button")
                    .attribute("aria-label", "Expand playground")
                    .attribute("data-playground-expand", "")
            }
            .class("window-dots")

            Tag("span") { "Swift Playground" }
                .class("window-title")
        }
        .class("editor-toolbar playground-window-toolbar")
    }
}

struct PlaygroundEditorPanel: HTML {
    var body: some HTML {
        Tag("div") {
            toolbar
            editor
        }
        .class("code-panel")
    }

    private var toolbar: some HTML {
        Tag("div") {
            Tag("span") { "Playground.swift" }
                .class("editor-title")

            Tag("div") {
                Tag("button") { "" }
                    .class("editor-button run-button")
                    .attribute("type", "button")
                    .attribute("data-run", "")
                    .attribute("aria-label", "Run")
            }
            .class("editor-actions")
        }
        .class("editor-toolbar")
    }

    private var editor: some HTML {
        Tag("div") {
            Tag("pre") {
                Tag("code") { "" }
                    .attribute("data-line-numbers", "")
            }
            .class("line-numbers")
            .attribute("aria-hidden", "true")

            Tag("pre") { "" }
                .class("editor-input")
                .attribute("data-editor-input", "")
                .attribute("contenteditable", "true")
                .attribute("role", "textbox")
                .attribute("aria-label", "Swift source editor")
                .attribute("aria-multiline", "true")
                .attribute("spellcheck", "false")
                .attribute("autocomplete", "off")
                .attribute("autocapitalize", "off")
        }
        .class("editor-pane")
    }
}

struct PlaygroundOutputPanel: HTML {
    var body: some HTML {
        Tag("aside") {
            Tag("div") {
                Tag("span") { "Output" }
                    .class("editor-title")

                Tag("span") { "Loads on first run" }
                    .class("run-status")
                    .attribute("data-status", "")
            }
            .class("editor-toolbar")

            Tag("pre") {
                Tag("code") { "Press Run to execute the snippet locally." }
                    .attribute("data-output", "")
            }
            .class("output-pane")

            Tag("pre") {
                Tag("code") { "" }
                    .attribute("data-result", "")
            }
            .class("diagnostics-pane")
        }
        .class("output-panel")
    }
}
