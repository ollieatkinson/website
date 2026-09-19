import Elementary

struct Home: HTML {
    let content = HomeContent.oliver

    var body: some HTML {
        div(.class("pixel-background"), .custom(name: "aria-hidden", value: "true")) {
            canvas(.id("pixel-field"), .width(1280), .height(900)) {}
        }
        a(.class("skip-link"), .href("#content")) { "Skip to content" }
        div(.class("site-shell")) {
            SiteHeader(content: content)
            main(.id("content")) {
                Introduction(content: content)
                GardenControls()
                SwiftPlayground()
            }
            footer {
                span { "UK · Built with Swift & a little Metal" }
                a(.href("https://github.com/ollieatkinson/website")) { "View source ↗" }
            }
        }
    }
}

private struct SiteHeader: HTML {
    let content: HomeContent

    var body: some HTML {
        header(.class("topbar")) {
            a(.class("brand"), .href("/"), .custom(name: "aria-label", value: "olbo.dev home")) {
                "olbo"
                span { ".dev" }
            }
            nav(.custom(name: "aria-label", value: "Profile links")) {
                for link in content.links {
                    a(.href(link.href), .rel("me")) { "\(link.title) ↗" }
                }
            }
        }
    }
}

private struct Introduction: HTML {
    let content: HomeContent

    var body: some HTML {
        section(.class("intro"), .custom(name: "aria-labelledby", value: "name")) {
            p(.class("eyebrow")) {
                span(.class("pixel-dot"), .custom(name: "aria-hidden", value: "true")) {}
                " Swift, systems & small experiments"
            }
            h1(.id("name")) { content.name }
            p(.class("lede")) { content.description }
            a(.class("play-link"), .href("#playground")) {
                "Play with some Swift "
                span(.custom(name: "aria-hidden", value: "true")) { "↓" }
            }
        }
    }
}

private struct GardenControls: HTML {
    var body: some HTML {
        div(.class("garden-note")) {
            div {
                p(.class("garden-title")) { "A little digital ecosystem" }
                p(.class("garden-description")) {
                    span(.class("life-key")) { "Life" }
                    " grows. "
                    span(.class("pascal-key")) { "Pascal" }
                    " plants. "
                    span(.class("spark-key")) { "Sparks" }
                    " wander."
                }
                p(.class("garden-hint")) { "Move anywhere to leave a little life behind." }
            }
            div(.class("garden-controls"), .custom(name: "aria-label", value: "Background controls")) {
                button(.id("motion"), .type(.button), .hidden) { "Pause" }
                button(.id("reseed"), .type(.button), .hidden) { "Reseed" }
            }
        }
    }
}
