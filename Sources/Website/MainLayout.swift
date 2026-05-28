import Raptor

struct MainLayout: Layout {
    var body: some Document {
        Main {
            content
        }
        .standardHeadersDisabled()
        .canonicalURL("https://olbo.dev/")
        .shareLinkTitle("olbo / Oliver Atkinson")
        .shareLinkDescription("Swift for macOS, system extensions, and small security tools.")
        .shareLinkImage("https://olbo.dev/og-image.png")
        .pageMetadata("theme-color", "#030805")
        .pageResource("/styles.css?v=20260528-msf-metal", relationship: .stylesheet)
        .pageResource("/favicon.svg", relationship: .icon)
        .script("https://cloud.umami.is/script.js") { script in
            script
                .defer()
                .attribute("data-website-id", "aac5108f-59d9-434f-96a1-0dd3b0376b15")
        }
        .script("/background.js?v=20260528-msf-metal") { script in
            script.defer()
        }
        .script("/miniswift/metal/msl_compiler.js?v=20260528-msf-metal") { script in
            script.defer()
        }
        .script("/miniswift/metal/metal-bridge.js?v=20260528-msf-metal") { script in
            script.defer()
        }
        .script("/miniswift/metal/preview-runtime.js?v=20260528-msf-metal") { script in
            script.defer()
        }
        .script("/miniswift/miniswift.js?v=20260528-msf-metal") { script in
            script.defer()
        }
        .script("/miniswift/swiftui.min.js?v=20260528-msf-metal") { script in
            script.defer()
        }
        .script("/msf-playground.js?v=20260528-msf-metal") { script in
            script.defer()
        }
        .ignorePageGutters()
    }
}
