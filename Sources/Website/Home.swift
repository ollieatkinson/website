import Foundation
import Raptor

struct Home: Page {
    var path = "/"
    var title = "olbo / Oliver Atkinson"
    var description = "Oliver Atkinson writes Swift for macOS, system extensions, and security tooling."
    var image: URL? { URL(static: "https://olbo.dev/og-image.png") }

    var body: some HTML {
        Tag("canvas")
            .id("swarm-field")
            .class("swarm-field")
            .attribute("aria-hidden", "true")

        Tag("div") {
            Tag("header") {
                Tag("a") {
                    Tag("span") { "ol" }
                        .class("brand-mark")
                        .attribute("aria-hidden", "true")

                    Tag("span") { "olbo.dev" }
                }
                .class("brand")
                .attribute("href", "/")
                .attribute("aria-label", "olbo.dev home")

                Tag("nav") {
                    Tag("a") {
                        Tag("span") { "GH" }
                            .class("profile-mark")
                            .attribute("aria-hidden", "true")
                        Tag("span") { "GitHub" }
                    }
                    .class("profile-link")
                    .attribute("aria-label", "GitHub")
                    .attribute("href", "https://github.com/ollieatkinson")
                    .attribute("rel", "me noreferrer")
                    .attribute("target", "_blank")

                    Tag("a") {
                        Tag("span") { "in" }
                            .class("profile-mark linkedin-mark")
                            .attribute("aria-hidden", "true")
                        Tag("span") { "LinkedIn" }
                    }
                    .class("profile-link")
                    .attribute("aria-label", "LinkedIn")
                    .attribute("href", "https://www.linkedin.com/in/oliveratkinson/")
                    .attribute("rel", "me noreferrer")
                    .attribute("target", "_blank")
                }
                .class("profile-nav")
                .attribute("aria-label", "Profile links")
            }
            .class("topbar")

            Tag("main") {
                Tag("p") { "olbo.dev" }
                    .class("kicker")

                Tag("h1") { "Oliver Atkinson" }

                Tag("p") {
                    "I write Swift for macOS: system extensions, security tooling, and the small interface details around them. I still have an iOS reflex, but these days I am happiest nearer the kernel."
                }
                .class("lede")

                Tag("ul") {
                    Tag("li") { "Swift" }
                    Tag("li") { "macOS" }
                    Tag("li") { "System Extensions" }
                    Tag("li") { "Security tooling" }
                }
                .class("focus-list")
                .attribute("aria-label", "Focus areas")
            }
            .class("hero")
            .attribute("id", "content")

            Tag("footer") {
                Tag("span") { "UK" }
                Tag("span") { "Apple platforms" }
                Tag("span") { "olbo.dev" }
            }
            .class("signal-row")
            .attribute("aria-label", "Site notes")
        }
        .class("site-shell")
    }
}
