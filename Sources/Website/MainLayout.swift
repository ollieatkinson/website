struct MainLayout {
    static func render(body: String) -> String {
        """
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>olbo / Oliver Atkinson</title>
          <meta name="description" content="Oliver Atkinson writes Swift for macOS, system extensions, and security tools.">
          <meta name="theme-color" content="#191c1b">
          <link rel="canonical" href="https://olbo.dev/">
          <meta property="og:type" content="website">
          <meta property="og:title" content="olbo / Oliver Atkinson">
          <meta property="og:description" content="Swift, systems &amp; small experiments.">
          <meta property="og:url" content="https://olbo.dev/">
          <meta property="og:image" content="https://olbo.dev/og-image.png">
          <link rel="icon" href="/favicon.svg" type="image/svg+xml">
          <link rel="stylesheet" href="/styles.css?v=20260919-garden">
          <script defer src="/background-world.js?v=20260919-garden"></script>
          <script defer src="/background.js?v=20260919-garden"></script>
          <script defer src="/msf-playground.js?v=20260919"></script>
          <script defer src="https://cloud.umami.is/script.js" data-website-id="aac5108f-59d9-434f-96a1-0dd3b0376b15"></script>
        </head>
        <body>\(body)</body>
        </html>
        """
    }
}
