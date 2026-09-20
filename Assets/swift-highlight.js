(() => {
  const editor = document.querySelector('#source');
  const container = editor?.closest('.source-editor');
  const mirror = container?.querySelector('.source-highlight');
  const code = mirror?.querySelector('code');
  if (!editor || !mirror || !code || !globalThis.Prism?.languages.swift) return;
  let composing = false;

  function syncScroll() {
    mirror.scrollTop = editor.scrollTop;
    mirror.scrollLeft = editor.scrollLeft;
  }
  function fit() {
    // Match the text viewport, excluding native scrollbars, including after resize.
    mirror.style.width = `${editor.clientWidth}px`;
    mirror.style.height = `${editor.clientHeight}px`;
    syncScroll();
  }
  function highlight() {
    // Large pastes stay editable without running a regex grammar on the UI thread.
    if (composing || editor.value.length > 20000) {
      container.classList.remove('highlighted');
      return;
    }
    try {
      // Prism escapes source before producing token spans. Never insert raw code.
      code.innerHTML = Prism.highlight(editor.value, Prism.languages.swift, 'swift')
        + (editor.value.endsWith('\n') ? ' ' : '');
      fit();
      container.classList.add('highlighted');
    } catch {
      container.classList.remove('highlighted');
    }
  }
  editor.addEventListener('input', highlight);
  editor.addEventListener('scroll', syncScroll, {passive: true});
  editor.addEventListener('compositionstart', () => { composing = true; highlight(); });
  editor.addEventListener('compositionend', () => { composing = false; highlight(); });
  new ResizeObserver(fit).observe(editor);
  window.addEventListener('pageshow', highlight);
  highlight();
})();
