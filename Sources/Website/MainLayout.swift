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
        .pageMetadata("theme-color", "#05070a")
        .pageResource("/styles.css?v=20260505-background-reveal", relationship: .stylesheet)
        .pageResource("/favicon.svg", relationship: .icon)
        .script("/background.js?v=20260505-background-reveal") { script in
            script.defer()
        }
        .script("/swift-script-editor.js?v=20260505-runtime-warmup") { script in
            script.defer()
        }
        .ignorePageGutters()
    }
}
