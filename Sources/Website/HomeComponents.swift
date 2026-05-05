import Raptor

struct HomeScreen: HTML {
    var content: HomeContent

    var body: some HTML {
        BackgroundCanvas(id: content.canvasID)
        SiteShell(content: content)
    }
}

private struct BackgroundCanvas: HTML {
    var id: String

    var body: some HTML {
        Tag("canvas")
            .id(id)
            .class("swarm-field")
            .attribute("data-rendering", "loading")
            .attribute("data-reveal", "pending")
            .attribute("aria-hidden", "true")
    }
}

private struct SiteShell: HTML {
    var content: HomeContent

    var body: some HTML {
        Tag("div") {
            TopBar(brand: content.brand, links: content.profileLinks)
            Hero(content: content)
            SiteNotes(items: content.notes)
        }
        .class("site-shell")
    }
}

private struct TopBar: HTML {
    var brand: Brand
    var links: [ProfileLink]

    var body: some HTML {
        Tag("header") {
            BrandLink(brand: brand)
            ProfileNavigation(links: links)
        }
        .class("topbar")
    }
}

private struct BrandLink: HTML {
    var brand: Brand

    var body: some HTML {
        Tag("a") {
            Tag("span") { brand.mark }
                .class("brand-mark")
                .attribute("aria-hidden", "true")

            Tag("span") { brand.title }
        }
        .class("brand")
        .attribute("href", brand.href)
        .attribute("aria-label", "\(brand.title) home")
    }
}

private struct ProfileNavigation: HTML {
    var links: [ProfileLink]

    var body: some HTML {
        Tag("nav") {
            ForEach(links) { link in
                ProfileAnchor(link: link)
            }
        }
        .class("profile-nav")
        .attribute("aria-label", "Profile links")
    }
}

private struct ProfileAnchor: HTML {
    var link: ProfileLink

    var body: some HTML {
        Tag("a") {
            Tag("span") {
                if let icon = link.icon {
                    Tag("img")
                        .attribute("src", icon)
                        .attribute("alt", "")
                        .attribute("role", "presentation")
                } else {
                    link.mark
                }
            }
                .class(markClass)
                .attribute("aria-hidden", "true")

            Tag("span") { link.title }
        }
        .class("profile-link")
        .attribute("aria-label", link.title)
        .attribute("href", link.href.absoluteString)
        .attribute("rel", "me noreferrer")
        .attribute("target", "_blank")
    }

    private var markClass: String {
        ["profile-mark", link.markClass]
            .compactMap(\.self)
            .joined(separator: " ")
    }
}

private struct Hero: HTML {
    var content: HomeContent

    var body: some HTML {
        Tag("main") {
            Tag("p") { content.eyebrow }
                .class("kicker")

            Tag("h1") { content.title }

            Tag("p") { content.lede }
                .class("lede")

            FocusList(items: content.focusAreas)
        }
        .class("hero")
        .attribute("id", "content")
    }
}

private struct FocusList: HTML {
    var items: [String]

    var body: some HTML {
        Tag("ul") {
            ForEach(items) { item in
                Tag("li") { item }
            }
        }
        .class("focus-list")
        .attribute("aria-label", "Focus areas")
    }
}

private struct SiteNotes: HTML {
    var items: [String]

    var body: some HTML {
        Tag("footer") {
            ForEach(items) { item in
                Tag("span") { item }
            }
        }
        .class("signal-row")
        .attribute("aria-label", "Site notes")
    }
}
