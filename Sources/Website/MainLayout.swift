import Elementary

struct MainLayout<Page: HTML>: HTMLDocument {
    let page: Page
    let title = "olbo / Oliver Atkinson"
    let lang = "en"

    var head: some HTML {
        meta(.name(.viewport), .content("width=device-width, initial-scale=1"))
        meta(.name(.description), .content("Oliver Atkinson writes Swift for macOS, system extensions, and security tools."))
        meta(.name("theme-color"), .content("#191c1b"))
        link(.rel(.canonical), .href("https://olbo.dev/"))
        meta(.property("og:type"), .content("website"))
        meta(.property("og:title"), .content(title))
        meta(.property("og:description"), .content("Swift, systems & small experiments."))
        meta(.property("og:url"), .content("https://olbo.dev/"))
        meta(.property("og:image"), .content("https://olbo.dev/og-image.png"))
        link(.rel(.icon), .href("/favicon.svg"), .custom(name: "type", value: "image/svg+xml"))
        link(.rel(.stylesheet), .href("/styles.css?v=20260920-swift"))
        script(.defer, .src("/background-world.js?v=20260919-seeds")) {}
        script(.defer, .src("/background.js?v=20260919-seeds")) {}
        script(.defer, .src("/highlighter/prism-core.min.js?v=1.30.0"), .data("manual", value: "")) {}
        script(.defer, .src("/highlighter/prism-swift.min.js?v=1.30.0")) {}
        script(.defer, .src("/swift-highlight.js?v=20260920")) {}
        script(.defer, .src("/msf-playground.js?v=20260919")) {}
        script(.defer, .src("https://cloud.umami.is/script.js"), .data("website-id", value: "aac5108f-59d9-434f-96a1-0dd3b0376b15")) {}
    }

    var body: some HTML { page }
}
