(() => {
  const root = document.querySelector("[data-swift-playground]");

  if (!root) {
    return;
  }

  const assetVersion = "20260505-swift-script";
  const windowElement = root.querySelector("[data-playground-window]");

  if (!windowElement) {
    return;
  }

  const editor = root.querySelector("[data-editor-input]");
  const lineNumbers = root.querySelector("[data-line-numbers]");
  const runButton = root.querySelector("[data-run]");
  const status = root.querySelector("[data-status]");
  const output = root.querySelector("[data-output]");
  const result = root.querySelector("[data-result]");
  const openButton = document.querySelector("[data-playground-open]");
  const dockButton = root.querySelector("[data-playground-dock]");
  const minimizeButtons = root.querySelectorAll("[data-playground-collapse]");
  const closeButtons = root.querySelectorAll("[data-playground-close]");
  const expandButton = root.querySelector("[data-playground-expand]");
  const dragHandle = root.querySelector(".playground-window-toolbar");

  const sample = `let numbers = [1, 1, 2, 3, 5, 8, 13]

func describe(_ value: Int) -> String {
    if value % 2 == 0 {
        return "\\(value) is even"
    }

    return "\\(value) is odd"
}

for number in numbers {
    print(describe(number))
}

var total = 0
for number in numbers {
    total = total + number
}

total`;

  let runtimePromise = null;
  let isPositionedByDrag = false;
  let sourceText = sample;
  let undoStack = [];
  let redoStack = [];
  const maxHistoryDepth = 100;

  function escapeHTML(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlightSwift(source) {
    const escaped = escapeHTML(source);
    const pattern =
      /(\/\/.*)|("(?:\\.|[^"\\])*")|\b(actor|as|associatedtype|async|await|break|case|catch|class|continue|default|defer|do|else|enum|extension|false|for|func|guard|if|import|in|init|inout|let|mutating|nil|private|public|return|self|static|struct|switch|throw|throws|true|try|typealias|var|where|while)\b|\b(Array|Bool|Character|Dictionary|Double|Float|Int|Optional|Set|String|Void)\b|\b(\d+(?:\.\d+)?)\b/g;

    return escaped.replace(pattern, (match, comment, string, keyword, type, number) => {
      if (comment) {
        return `<span class="syntax-comment">${comment}</span>`;
      }

      if (string) {
        return `<span class="syntax-string">${string}</span>`;
      }

      if (keyword) {
        return `<span class="syntax-keyword">${keyword}</span>`;
      }

      if (type) {
        return `<span class="syntax-type">${type}</span>`;
      }

      if (number) {
        return `<span class="syntax-number">${number}</span>`;
      }

      return match;
    });
  }

  function getSource() {
    return sourceText;
  }

  function getSelectionOffsets() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const startRange = range.cloneRange();
    const endRange = range.cloneRange();
    startRange.selectNodeContents(editor);
    endRange.selectNodeContents(editor);
    startRange.setEnd(range.startContainer, range.startOffset);
    endRange.setEnd(range.endContainer, range.endOffset);

    return {
      start: Math.min(startRange.toString().length, sourceText.length),
      end: Math.min(endRange.toString().length, sourceText.length),
    };
  }

  function setSelectionOffsets(start, end = start) {
    const selection = window.getSelection();

    if (!selection) {
      return;
    }

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node = walker.nextNode();
    let remainingStart = start;
    let remainingEnd = end;
    let didSetStart = false;

    while (node) {
      const length = node.nodeValue.length;

      if (!didSetStart && remainingStart <= length) {
        range.setStart(node, remainingStart);
        didSetStart = true;
      }

      if (remainingEnd <= length) {
        range.setEnd(node, remainingEnd);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }

      remainingStart -= length;
      remainingEnd -= length;
      node = walker.nextNode();
    }

    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function ensureSelectionVisible(offset = null) {
    requestAnimationFrame(() => {
      const scrollContainer = editor.parentElement;
      const caretOffset = offset ?? getSelectionOffsets()?.start ?? 0;
      const beforeCaret = sourceText.slice(0, caretOffset);
      const lineIndex = beforeCaret.split("\n").length - 1;
      const styles = getComputedStyle(editor);
      const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
      const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
      const targetTop = paddingTop + lineIndex * lineHeight;
      const margin = lineHeight * 2;

      if (targetTop < scrollContainer.scrollTop + margin) {
        scrollContainer.scrollTop = Math.max(0, targetTop - margin);
      } else if (targetTop + lineHeight > scrollContainer.scrollTop + scrollContainer.clientHeight - margin) {
        scrollContainer.scrollTop = targetTop + lineHeight - scrollContainer.clientHeight + margin;
      }
    });
  }

  function currentLineIndent(source, offset) {
    const lineStart = source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
    const match = source.slice(lineStart, offset).match(/^\s*/);
    return match ? match[0] : "";
  }

  function currentEditorState() {
    return {
      source: sourceText,
      selection: getSelectionOffsets() || { start: sourceText.length, end: sourceText.length },
    };
  }

  function rememberUndoState() {
    const state = currentEditorState();
    const previous = undoStack.at(-1);

    if (
      previous &&
      previous.source === state.source &&
      previous.selection.start === state.selection.start &&
      previous.selection.end === state.selection.end
    ) {
      return;
    }

    undoStack.push(state);

    if (undoStack.length > maxHistoryDepth) {
      undoStack.shift();
    }

    redoStack = [];
  }

  function restoreEditorState(state) {
    renderSource(state.source, { selection: state.selection });
  }

  function resetHistory() {
    undoStack = [];
    redoStack = [];
  }

  function renderSource(source, { selection = null } = {}) {
    sourceText = source;
    const lineCount = Math.max(1, source.split("\n").length);
    editor.innerHTML = source ? highlightSwift(source) : "<br>";

    if (source.endsWith("\n")) {
      editor.insertAdjacentHTML("beforeend", '<span data-editor-caret-anchor="">&#8203;</span>');
    }

    lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");

    if (selection) {
      setSelectionOffsets(selection.start, selection.end);
      ensureSelectionVisible(selection.end);
    }
  }

  function replaceSelection(insertedText, { recordHistory = true } = {}) {
    const selection = getSelectionOffsets();

    if (!selection) {
      return;
    }

    if (!insertedText && selection.start === selection.end) {
      return;
    }

    if (recordHistory) {
      rememberUndoState();
    }

    const source = sourceText;
    const nextSource = `${source.slice(0, selection.start)}${insertedText}${source.slice(selection.end)}`;
    const nextOffset = selection.start + insertedText.length;
    renderSource(nextSource, { selection: { start: nextOffset, end: nextOffset } });
  }

  function deleteSelection({ direction }) {
    const selection = getSelectionOffsets();

    if (!selection) {
      return;
    }

    let start = selection.start;
    let end = selection.end;

    if (start === end) {
      if (direction === "backward" && start > 0) {
        start -= 1;
      } else if (direction === "forward" && end < sourceText.length) {
        end += 1;
      }
    }

    if (start === end) {
      return;
    }

    rememberUndoState();
    const nextSource = `${sourceText.slice(0, start)}${sourceText.slice(end)}`;
    renderSource(nextSource, { selection: { start, end: start } });
  }

  function setSource(source) {
    renderSource(source);
  }

  function undoEdit() {
    const previous = undoStack.pop();

    if (!previous) {
      return;
    }

    redoStack.push(currentEditorState());
    restoreEditorState(previous);
  }

  function redoEdit() {
    const next = redoStack.pop();

    if (!next) {
      return;
    }

    undoStack.push(currentEditorState());
    restoreEditorState(next);
  }

  function selectedSourceText() {
    const selection = getSelectionOffsets();

    if (!selection || selection.start === selection.end) {
      return "";
    }

    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    return sourceText.slice(start, end);
  }

  function updateEditor() {
    const selection = getSelectionOffsets();
    renderSource(getSource(), { selection });
  }

  function syncScroll() {
    return;
  }

  function focusEditor() {
    requestAnimationFrame(() => {
      editor.focus();
      setSelectionOffsets(0);
      editor.parentElement.scrollTop = 0;
      editor.parentElement.scrollLeft = 0;
      syncScroll();
    });
  }

  function resetPlayground({ focus = false } = {}) {
    setSource(sample);
    output.textContent = "Press Run to execute the snippet locally.";
    result.textContent = "";
    status.textContent = "Loading on first run";
    runButton.disabled = false;
    editor.parentElement.scrollTop = 0;
    editor.parentElement.scrollLeft = 0;
    resetHistory();
    syncScroll();

    if (focus) {
      focusEditor();
    }
  }

  function centerWindow() {
    isPositionedByDrag = false;
    windowElement.dataset.fullscreen = "false";
    windowElement.style.top = "50%";
    windowElement.style.left = "50%";
    windowElement.style.right = "";
    windowElement.style.bottom = "";
    windowElement.style.transform = "translate(-50%, -50%)";
  }

  function openWindow() {
    windowElement.hidden = false;
    root.dataset.open = "true";
    root.dataset.minimized = "false";
    centerWindow();
    updateEditor();
    syncScroll();
  }

  function closeWindow() {
    windowElement.hidden = true;
    root.dataset.open = "false";
    root.dataset.minimized = "false";
    windowElement.dataset.fullscreen = "false";
    resetPlayground();
  }

  function minimizeWindow() {
    windowElement.hidden = true;
    root.dataset.open = "true";
    root.dataset.minimized = "true";
    windowElement.dataset.fullscreen = "false";
  }

  function toggleDockWindow() {
    if (root.dataset.open === "true" && !windowElement.hidden) {
      minimizeWindow();
      return;
    }

    openWindow();
  }

  function toggleFullscreen() {
    if (windowElement.hidden) {
      windowElement.hidden = false;
      root.dataset.open = "true";
      root.dataset.minimized = "false";
    }

    const shouldFillScreen = windowElement.dataset.fullscreen !== "true";
    windowElement.dataset.fullscreen = String(shouldFillScreen);
    isPositionedByDrag = false;

    if (shouldFillScreen) {
      windowElement.style.top = "18px";
      windowElement.style.left = "18px";
      windowElement.style.right = "18px";
      windowElement.style.bottom = "18px";
      windowElement.style.transform = "none";
    } else {
      centerWindow();
    }

    requestAnimationFrame(syncScroll);
  }

  function clampWindow(left, top) {
    const bounds = windowElement.getBoundingClientRect();
    const margin = 10;
    const maxLeft = window.innerWidth - bounds.width - margin;
    const maxTop = window.innerHeight - bounds.height - margin;

    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, maxLeft)),
      top: Math.min(Math.max(margin, top), Math.max(margin, maxTop)),
    };
  }

  function beginDrag(event) {
    if (event.button !== 0 || event.target.closest("button") || windowElement.dataset.fullscreen === "true") {
      return;
    }

    const bounds = windowElement.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left;
    const offsetY = event.clientY - bounds.top;

    isPositionedByDrag = true;
    windowElement.dataset.dragging = "true";
    windowElement.style.transform = "none";
    windowElement.style.left = `${bounds.left}px`;
    windowElement.style.top = `${bounds.top}px`;
    windowElement.style.right = "";
    windowElement.style.bottom = "";
    dragHandle.setPointerCapture(event.pointerId);

    function move(pointerEvent) {
      const next = clampWindow(pointerEvent.clientX - offsetX, pointerEvent.clientY - offsetY);
      windowElement.style.left = `${next.left}px`;
      windowElement.style.top = `${next.top}px`;
    }

    function endDrag() {
      windowElement.dataset.dragging = "false";
      dragHandle.removeEventListener("pointermove", move);
      dragHandle.removeEventListener("pointerup", endDrag);
      dragHandle.removeEventListener("pointercancel", endDrag);
    }

    dragHandle.addEventListener("pointermove", move);
    dragHandle.addEventListener("pointerup", endDrag);
    dragHandle.addEventListener("pointercancel", endDrag);
  }

  async function loadRuntime() {
    if (globalThis.swiftScriptEvaluate) {
      return;
    }

    if (!runtimePromise) {
      runtimePromise = import(`/swift-script/index.js?v=${assetVersion}`).then(({ init }) =>
        init({
          module: fetch(`/swift-script/WASMSwiftScriptRunner.wasm?v=${assetVersion}`),
        }),
      );
    }

    await runtimePromise;

    if (!globalThis.swiftScriptEvaluate) {
      throw new Error("SwiftScript runtime did not expose an evaluator.");
    }
  }

  function evaluate(source) {
    return new Promise((resolve) => {
      globalThis.swiftScriptEvaluate(source, resolve);
    });
  }

  async function run() {
    runButton.disabled = true;
    status.textContent = "Running";
    output.textContent = "";
    result.textContent = "";

    try {
      await loadRuntime();
      const response = await evaluate(getSource());
      const elapsed = Number(response.elapsedMilliseconds || 0).toFixed(1);
      status.textContent = response.ok ? `Finished in ${elapsed}ms` : `Stopped in ${elapsed}ms`;

      const chunks = [];
      if (response.output) {
        chunks.push(response.output);
      }

      if (response.result && response.result !== "()") {
        chunks.push(`=> ${response.result}`);
      }

      output.textContent = chunks.join("\n") || "(no output)";
      result.textContent = response.diagnostics || "";
    } catch (error) {
      status.textContent = "Runtime unavailable";
      output.textContent = "The SwiftScript WebAssembly bundle is not available in this build.";
      result.textContent = String(error?.message || error);
    } finally {
      runButton.disabled = false;
    }
  }

  editor.addEventListener("beforeinput", (event) => {
    const selection = getSelectionOffsets();

    if (!selection) {
      return;
    }

    switch (event.inputType) {
      case "insertText":
      case "insertCompositionText":
        event.preventDefault();
        replaceSelection(event.data || "");
        return;
      case "historyUndo":
        event.preventDefault();
        undoEdit();
        return;
      case "historyRedo":
        event.preventDefault();
        redoEdit();
        return;
      case "insertParagraph":
      case "insertLineBreak":
        event.preventDefault();
        replaceSelection(`\n${currentLineIndent(sourceText, selection.start)}`);
        return;
      case "deleteContentBackward":
        event.preventDefault();
        deleteSelection({ direction: "backward" });
        return;
      case "deleteContentForward":
        event.preventDefault();
        deleteSelection({ direction: "forward" });
        return;
      default:
        break;
    }
  });
  editor.addEventListener("copy", (event) => {
    const text = selectedSourceText();

    if (!text || !event.clipboardData) {
      return;
    }

    event.preventDefault();
    event.clipboardData.setData("text/plain", text);
  });
  editor.addEventListener("cut", (event) => {
    const text = selectedSourceText();

    if (!text || !event.clipboardData) {
      return;
    }

    event.preventDefault();
    event.clipboardData.setData("text/plain", text);
    replaceSelection("");
  });
  editor.addEventListener("input", updateEditor);
  editor.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") || "";
    replaceSelection(text);
  });
  editor.addEventListener("keydown", (event) => {
    const isShortcut = event.metaKey || event.ctrlKey;

    if (isShortcut && event.key.toLowerCase() === "z") {
      event.preventDefault();

      if (event.shiftKey) {
        redoEdit();
      } else {
        undoEdit();
      }

      return;
    }

    if (isShortcut && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redoEdit();
      return;
    }

    if (event.key !== "Tab" && event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const selection = getSelectionOffsets();

    if (!selection) {
      return;
    }

    const insertedText = event.key === "Tab" ? "    " : `\n${currentLineIndent(sourceText, selection.start)}`;
    replaceSelection(insertedText);
  });
  openButton?.addEventListener("click", openWindow);
  dockButton?.addEventListener("click", toggleDockWindow);
  minimizeButtons.forEach((button) => {
    button.addEventListener("click", minimizeWindow);
  });
  expandButton?.addEventListener("click", toggleFullscreen);
  closeButtons.forEach((button) => {
    button.addEventListener("click", closeWindow);
  });
  dragHandle?.addEventListener("pointerdown", beginDrag);
  window.addEventListener("resize", () => {
    if (!windowElement.hidden && !isPositionedByDrag && windowElement.dataset.fullscreen !== "true") {
      centerWindow();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !windowElement.hidden) {
      closeWindow();
    }
  });
  runButton.addEventListener("click", run);

  root.dataset.open = "false";
  root.dataset.minimized = "false";
  centerWindow();
  setSource(sample);
})();
