struct Home {
    let content = HomeContent.oliver

    var html: String {
        """
        <a class="skip-link" href="#content">Skip to content</a>
        <div class="site-shell">
          <header class="topbar">
            <a class="brand" href="/" aria-label="olbo.dev home">olbo<span>.dev</span></a>
            <nav aria-label="Profile links">
              \(content.links.map { "<a href=\"\(escapeHTML($0.href))\" rel=\"me\">\($0.title) ↗</a>" }.joined(separator: "\n"))
            </nav>
          </header>
          <main id="content">
            <section class="intro" aria-labelledby="name">
              <p class="eyebrow"><span class="pixel-dot" aria-hidden="true"></span> Swift, systems &amp; small experiments</p>
              <h1 id="name">\(content.name)</h1>
              <p class="lede">\(content.description)</p>
              <a class="play-link" href="#playground">Play with some Swift <span aria-hidden="true">↓</span></a>
            </section>
            <figure class="sketch" aria-labelledby="sketch-title">
              <div class="sketch-toolbar">
                <span id="sketch-title">001 / A little order from bits</span>
                <button id="motion" type="button" hidden>Pause</button>
              </div>
              <div class="canvas-wrap">
                <img class="pattern-fallback" src="/pattern.svg" alt="" width="880" height="320">
                <canvas id="pixel-field" width="880" height="320" role="img" aria-label="Animated Sierpiński triangle, generated from Pascal’s triangle modulo two"></canvas>
              </div>
              <figcaption>
                <div class="pattern-controls" aria-label="Pattern">
                  <button type="button" data-pattern="0" aria-pressed="true" disabled>Sierpiński</button>
                  <button type="button" data-pattern="1" aria-pressed="false" disabled>XOR quilt</button>
                </div>
                <span id="pattern-note">Pascal’s triangle, modulo 2.</span>
              </figcaption>
            </figure>
            <details id="playground" class="playground">
              <summary>A small Swift playground <span aria-hidden="true">↗</span></summary>
              <div class="playground-body">
                <p>Edit, run, print, repeat. Your code stays in this browser.</p>
                <div class="editor-toolbar">
                  <label for="source">main.swift</label>
                  <div class="editor-actions">
                    <button id="run" type="button" disabled>Run ↵</button>
                    <button id="stop" type="button" disabled>Stop</button>
                  </div>
                </div>
                <textarea id="source" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="editor-hint">\(escapeHTML(Self.sample))</textarea>
                <div class="output-toolbar">
                  <label for="output">Output</label>
                  <span id="run-status" role="status">Ready when you are</span>
                </div>
                <pre id="output" tabindex="0" aria-label="Program output">Press Run to see what happens.</pre>
                <p id="editor-hint" class="editor-hint">⌘ / Ctrl + Enter to run. Use print() to inspect values. <a href="https://miniswift.run/studio/">Full debugger ↗</a></p>
                <noscript><p>Enable JavaScript to run Swift here.</p></noscript>
              </div>
            </details>
          </main>
          <footer><span>UK · Built with Swift &amp; a little Metal</span><a href="https://github.com/ollieatkinson/website">View source ↗</a></footer>
        </div>
        """
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
