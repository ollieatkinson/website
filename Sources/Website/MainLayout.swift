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
        .pageResource("/styles.css?v=20260529-browser-runtime", relationship: .stylesheet)
        .pageResource("/favicon.svg", relationship: .icon)
        .script("https://cloud.umami.is/script.js") { script in
            script
                .defer()
                .attribute("data-website-id", "aac5108f-59d9-434f-96a1-0dd3b0376b15")
        }
        .script("/browser-runtime/metal/msl_compiler.js?v=20260529-browser-runtime") { script in
            script.defer()
        }
        .script("/browser-runtime/metal/metal-bridge.js?v=20260529-browser-runtime") { script in
            script.defer()
        }
        .script("/browser-runtime/metal/preview-runtime.js?v=20260529-browser-runtime") { script in
            script.defer()
        }
        .script("/background.js?v=20260529-browser-runtime") { script in
            script.defer()
        }
        .script("/browser-runtime/swift-runtime.js?v=20260529-browser-runtime") { script in
            script.defer()
        }
        .script("/browser-runtime/swiftui.min.js?v=20260529-browser-runtime") { script in
            script.defer()
        }
        .script("/msf-playground.js?v=20260529-browser-runtime") { script in
            script.defer()
        }
        .ignorePageGutters()
    }
}
