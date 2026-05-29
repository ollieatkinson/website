(() => {
  const root = document.querySelector("[data-swift-playground]");

  if (!root) {
    return;
  }

  const assetVersion = "20260529-browser-runtime";
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
  const outputPanel = root.querySelector(".output-panel");
  const outputPane = output?.closest(".output-pane");
  const diagnosticsPane = result?.closest(".diagnostics-pane");
  const previewPane = root.querySelector("[data-preview-pane]");
  const swiftUIPreview = root.querySelector("[data-swiftui-preview]");
  const metalPreviewElement = root.querySelector("[data-metal-preview]");
  const metalCanvas = root.querySelector("[data-metal-canvas]");
  const metalError = root.querySelector("[data-metal-error]");
  const metalStatus = root.querySelector("[data-metal-status]");
  const title = root.querySelector("[data-editor-title]");
  const modeButtons = root.querySelectorAll("[data-mode]");
  const openButton = document.querySelector("[data-playground-open]");
  const dockButton = root.querySelector("[data-playground-dock]");
  const swiftUIDockButton = root.querySelector("[data-swiftui-dock]");
  const metalDockButton = root.querySelector("[data-metal-dock]");
  const minimizeButtons = root.querySelectorAll("[data-playground-collapse]");
  const closeButtons = root.querySelectorAll("[data-playground-close]");
  const expandButton = root.querySelector("[data-playground-expand]");
  const dragHandle = root.querySelector(".playground-window-toolbar");

  const swiftScriptSample = `let numbers = [1, 1, 2, 3, 5, 8, 13]

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

total
`;

  const swiftUISample = `import SwiftUI

struct ContentView: View {
    @State var count = 0

    var body: some View {
        VStack(spacing: 20) {
            Text("Count: \\(count)")
                .font(.largeTitle)
                .foregroundColor(.blue)

            HStack(spacing: 16) {
                Button("-") {
                    count -= 1
                    print(count)
                }
                .font(.headline)
                .foregroundColor(.blue)
                .padding()
                .frame(width: 54, height: 44)
                .background(.systemFill)
                .cornerRadius(12)

                Button("+") {
                    count += 1
                    print(count)
                }
                .font(.headline)
                .foregroundColor(.blue)
                .padding()
                .frame(width: 54, height: 44)
                .background(.systemFill)
                .cornerRadius(12)
            }
        }
        .padding()
    }
}
`;

  const metalSample = `#include <metal_stdlib>
using namespace metal;

struct Uniforms {
    float time;
    float2 resolution;
    float2 mouse;
    uint frame;
};

fragment float4 fs_main(float4 pos [[position]],
                        constant Uniforms& u [[buffer(0)]]) {
    float2 uv = pos.xy / u.resolution;
    float t = u.time;

    float v = 0.0;
    v += sin((uv.x + t) * 10.0);
    v += sin((uv.y + t) * 10.0);
    v += sin((uv.x + uv.y + t) * 10.0);
    v += sin(sqrt(uv.x * uv.x + uv.y * uv.y + 1.0) * 20.0 + t);
    v *= 0.25;

    float3 color = float3(
        0.5 + 0.5 * sin(v * 3.14159 + 0.0),
        0.5 + 0.5 * sin(v * 3.14159 + 2.094),
        0.5 + 0.5 * sin(v * 3.14159 + 4.188)
    );

    return float4(color, 1.0);
}
`;

  const samples = {
    script: swiftScriptSample,
    swiftui: swiftUISample,
    metal: metalSample,
  };

  let activeMode = "swift";
  let activeSwiftMode = "script";
  let isPositionedByDrag = false;
  let sourceText = samples.script;
  let undoStack = [];
  let redoStack = [];
  const maxHistoryDepth = 100;
  let runtimeState = "idle";
  let runtimeWarmupTimer = 0;
  let isRunActive = false;
  let liveRunTimer = 0;
  let needsLiveRunAfterActive = false;
  let swiftCompilerPromise = null;
  let hasLoadedSwiftCompiler = false;
  let metalBridgePromise = null;
  let metalBridge = null;
  let metalPreview = null;
  let lastSwiftUIIR = null;
  let outputLines = [];

  function escapeHTML(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlightSwift(source) {
    const escaped = escapeHTML(source);
    const pattern =
      /(\/\/.*)|("(?:\\.|[^"\\])*")|\b(actor|as|associatedtype|async|await|break|case|catch|class|continue|default|defer|do|else|enum|extension|false|for|func|guard|if|import|in|init|inout|let|mutating|nil|private|public|return|self|some|static|struct|switch|throw|throws|true|try|typealias|var|where|while)\b|\b(Array|Bool|Character|Dictionary|Double|Float|Int|Optional|Set|String|SwiftUI|View|Void)\b|\b(\d+(?:\.\d+)?)\b/g;

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

  function highlightMetal(source) {
    const escaped = escapeHTML(source);
    const pattern =
      /(\/\/.*)|("(?:\\.|[^"\\])*")|\b(fragment|vertex|kernel|constant|device|thread|threadgroup|return|struct|using|namespace|if|else|for|while|switch|case|break|continue|discard_fragment)\b|\b(float|float2|float3|float4|half|half2|half3|half4|int|int2|int3|int4|uint|uint2|uint3|uint4|bool|void|texture2d|sampler)\b|\b(\d+(?:\.\d+)?)\b/g;

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

  function highlightSource(source) {
    return activeMode === "metal" ? highlightMetal(source) : highlightSwift(source);
  }

  function getSource() {
    return sourceText;
  }

  function activeConnection() {
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  }

  function canWarmRuntime() {
    const connection = activeConnection();

    if (connection?.saveData) {
      return false;
    }

    return connection?.effectiveType !== "slow-2g" && connection?.effectiveType !== "2g";
  }

  function swiftSampleKey() {
    return activeSwiftMode === "swiftui" ? "swiftui" : "script";
  }

  function activeSampleKey() {
    return activeMode === "metal" ? "metal" : swiftSampleKey();
  }

  function activeTitle() {
    if (activeMode === "metal") {
      return "Shader.metal";
    }

    return activeSwiftMode === "swiftui" ? "ContentView.swift" : "Playground.swift";
  }

  function defaultConsoleMessage() {
    if (activeMode === "metal") {
      return "Press Run to compile the Metal shader.";
    }

    return activeSwiftMode === "swiftui"
      ? "Press Run to render the SwiftUI preview locally."
      : "Press Run to execute the snippet locally.";
  }

  function runtimeStatusText() {
    if (activeMode === "metal") {
      if (metalBridge) {
        return "Metal ready";
      }

      if (runtimeState === "loading") {
        return "Preparing Metal";
      }

      if (runtimeState === "failed") {
        return "Metal unavailable";
      }

      return "Loads on first run";
    }

    if (hasLoadedSwiftCompiler) {
      return "Swift ready";
    }

    if (runtimeState === "loading") {
      return "Preparing Swift";
    }

    if (runtimeState === "failed") {
      return "Swift unavailable";
    }

    return "Loads on first run";
  }

  function setRuntimeStatus() {
    if (!isRunActive) {
      status.textContent = runtimeStatusText();
    }
  }

  function liveRunDelay() {
    return activeMode === "metal" ? 260 : 650;
  }

  function cancelLiveRun() {
    if (liveRunTimer) {
      window.clearTimeout(liveRunTimer);
      liveRunTimer = 0;
    }
  }

  function scheduleLiveRun({ delay = liveRunDelay() } = {}) {
    if (windowElement.hidden || !sourceText.trim()) {
      return;
    }

    cancelLiveRun();
    liveRunTimer = window.setTimeout(() => {
      liveRunTimer = 0;
      void run({ live: true });
    }, delay);
  }

  function didEditSource() {
    scheduleLiveRun();
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
    editor.innerHTML = source ? highlightSource(source) : "<br>";

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
    didEditSource();
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
    didEditSource();
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
    didEditSource();
  }

  function redoEdit() {
    const next = redoStack.pop();

    if (!next) {
      return;
    }

    undoStack.push(currentEditorState());
    restoreEditorState(next);
    didEditSource();
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
    didEditSource();
  }

  function syncScroll() {
    return;
  }

  function clearOutput() {
    outputLines = [];
    setOutputText("");
    setDiagnosticsText("");
  }

  function scrollPaneToLatest(pane) {
    if (!pane) {
      return;
    }

    requestAnimationFrame(() => {
      pane.scrollTop = pane.scrollHeight;
    });
  }

  function setOutputText(text) {
    output.textContent = text;
    scrollPaneToLatest(outputPane);
  }

  function setDiagnosticsText(text) {
    result.textContent = text;
    scrollPaneToLatest(diagnosticsPane);
  }

  function appendOutput(line) {
    outputLines.push(line);
    setOutputText(outputLines.join("\n") || "(no output)");
  }

  globalThis.__swiftPlaygroundPrint = (value) => {
    appendOutput(String(value));
  };

  function showConsole(message = "") {
    outputPanel.dataset.view = "console";
    lastSwiftUIIR = null;
    previewPane.hidden = true;
    outputPane.hidden = false;
    diagnosticsPane.hidden = false;
    swiftUIPreview.innerHTML = "";
    metalPreviewElement.hidden = true;
    setOutputText(message);
  }

  function fitSwiftUIPreview() {
    const paneBounds = previewPane.getBoundingClientRect();
    const width = Math.max(0, paneBounds.width - 30);
    const height = Math.max(0, paneBounds.height - 30 - 48);
    const zoom = Math.min(1, width / 280, height / 580);
    swiftUIPreview.dataset.zoom = Math.max(0.68, zoom).toFixed(2);
  }

  function showSwiftUIPreview(uiir) {
    outputPanel.dataset.view = "swift-preview";
    lastSwiftUIIR = uiir;
    previewPane.hidden = false;
    outputPane.hidden = false;
    diagnosticsPane.hidden = true;
    metalPreviewElement.hidden = true;
    swiftUIPreview.hidden = false;
    swiftUIPreview.innerHTML = "";

    if (typeof globalThis.renderUIIR !== "function") {
      swiftUIPreview.textContent = JSON.stringify(uiir, null, 2);
      return;
    }

    fitSwiftUIPreview();
    globalThis.renderUIIR(uiir, swiftUIPreview);
  }

  function showMetalPreview() {
    outputPanel.dataset.view = "metal-preview";
    lastSwiftUIIR = null;
    previewPane.hidden = false;
    outputPane.hidden = true;
    diagnosticsPane.hidden = false;
    swiftUIPreview.innerHTML = "";
    swiftUIPreview.hidden = true;
    metalPreviewElement.hidden = false;
  }

  function resetPlayground({ focus = false } = {}) {
    setSource(samples[activeSampleKey()]);
    clearOutput();
    showConsole(defaultConsoleMessage());
    setRuntimeStatus();
    runButton.disabled = false;
    editor.parentElement.scrollTop = 0;
    editor.parentElement.scrollLeft = 0;
    resetHistory();
    syncScroll();

    if (focus) {
      focusEditor();
    }
  }

  function setMode(nextMode, { replaceSource = true } = {}) {
    if (nextMode !== "swift" && nextMode !== "metal") {
      return;
    }

    activeMode = nextMode;
    root.dataset.mode = nextMode;
    root.dataset.swiftMode = activeSwiftMode;

    modeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === nextMode));
    });

    if (title) {
      title.textContent = activeTitle();
    }

    if (replaceSource) {
      resetPlayground({ focus: true });
      scheduleLiveRun({ delay: 0 });
    } else {
      renderSource(sourceText);
      setRuntimeStatus();
    }
  }

  function setSwiftMode(nextSwiftMode, { replaceSource = true } = {}) {
    if (nextSwiftMode !== "script" && nextSwiftMode !== "swiftui") {
      return;
    }

    activeSwiftMode = nextSwiftMode;
    root.dataset.swiftMode = activeSwiftMode;

    if (activeMode !== "swift") {
      setMode("swift", { replaceSource });
      return;
    }

    root.dataset.mode = "swift";

    if (title) {
      title.textContent = activeTitle();
    }

    if (replaceSource) {
      resetPlayground({ focus: true });
      scheduleLiveRun({ delay: 0 });
    } else {
      renderSource(sourceText);
      setRuntimeStatus();
    }
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

  function centerWindow() {
    isPositionedByDrag = false;
    windowElement.dataset.fullscreen = "false";
    windowElement.style.top = "var(--playground-window-margin)";
    windowElement.style.left = "50%";
    windowElement.style.right = "";
    windowElement.style.bottom = "var(--playground-dock-reserve)";
    windowElement.style.height = "";
    windowElement.style.transform = "translateX(-50%)";
  }

  function openWindow() {
    const wasHidden = windowElement.hidden;
    windowElement.hidden = false;
    root.dataset.open = "true";
    root.dataset.minimized = "false";
    centerWindow();
    updateEditor();
    syncScroll();

    if (wasHidden) {
      void run();
    }
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

  function openDockMode(mode) {
    if (root.dataset.open === "true" && !windowElement.hidden && activeMode === mode) {
      minimizeWindow();
      return;
    }

    if (activeMode !== mode) {
      setMode(mode);
    }

    openWindow();
  }

  function openSwiftDockMode(swiftMode) {
    if (
      root.dataset.open === "true" &&
      !windowElement.hidden &&
      activeMode === "swift" &&
      activeSwiftMode === swiftMode
    ) {
      minimizeWindow();
      return;
    }

    if (activeMode !== "swift" || activeSwiftMode !== swiftMode) {
      setSwiftMode(swiftMode);
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
      windowElement.style.top = "var(--playground-window-margin)";
      windowElement.style.left = "var(--playground-window-margin)";
      windowElement.style.right = "var(--playground-window-margin)";
      windowElement.style.bottom = "var(--playground-dock-reserve)";
      windowElement.style.height = "";
      windowElement.style.transform = "none";
    } else {
      centerWindow();
    }

    requestAnimationFrame(syncScroll);
  }

  function clampWindow(left, top) {
    const bounds = windowElement.getBoundingClientRect();
    const margin = 10;
    const dockReserve = Number.parseFloat(getComputedStyle(root).getPropertyValue("--playground-dock-reserve")) || 108;
    const maxLeft = window.innerWidth - bounds.width - margin;
    const maxTop = window.innerHeight - dockReserve - bounds.height;

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
    windowElement.style.height = `${bounds.height}px`;
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

  function createSwiftCompiler() {
    runtimeState = "loading";
    setRuntimeStatus();

    return globalThis["Mini" + "Swift" + "Wasm"]({
      locateFile: (path) => {
        if (path === "mini" + "swift.wasm") {
          return `/browser-runtime/swift-runtime.wasm?v=${assetVersion}`;
        }

        return `/browser-runtime/${path}?v=${assetVersion}`;
      },
      print: (line) => appendOutput(line),
      printErr: (line) => appendOutput(line),
    })
      .then((module) => {
        hasLoadedSwiftCompiler = true;
        runtimeState = "ready";
        setRuntimeStatus();
        return module;
      })
      .catch((error) => {
        runtimeState = "failed";
        setRuntimeStatus();
        throw error;
      });
  }

  function prepareSwiftCompiler() {
    if (!swiftCompilerPromise) {
      swiftCompilerPromise = createSwiftCompiler().catch((error) => {
        swiftCompilerPromise = null;
        throw error;
      });
    }

    return swiftCompilerPromise;
  }

  async function takeSwiftCompiler() {
    const compilerPromise = prepareSwiftCompiler();

    try {
      return await compilerPromise;
    } finally {
      if (swiftCompilerPromise === compilerPromise) {
        swiftCompilerPromise = null;
      }
    }
  }

  async function loadMetalBridge() {
    if (metalBridge) {
      return metalBridge;
    }

    if (!metalBridgePromise) {
      runtimeState = "loading";
      setRuntimeStatus();

      metalBridgePromise = globalThis.loadMetalCompiler()
        .then((bridge) => {
          metalBridge = bridge;
          runtimeState = "ready";
          setRuntimeStatus();
          return bridge;
        })
        .catch((error) => {
          runtimeState = "failed";
          metalBridgePromise = null;
          setRuntimeStatus();
          throw error;
        });
    }

    return metalBridgePromise;
  }

  function warmRuntime({ delay = 0 } = {}) {
    if (runtimeState !== "idle" || !canWarmRuntime()) {
      return;
    }

    window.clearTimeout(runtimeWarmupTimer);

    runtimeWarmupTimer = window.setTimeout(() => {
      const warm = activeMode === "metal" ? loadMetalBridge : prepareSwiftCompiler;
      warm().catch(() => {
        // The run path renders the actionable failure message if the user tries again.
      });
    }, delay);
  }

  function writeSourceToSwiftCompiler(module, source) {
    const sourceBuffer = module._ms_get_src_buf();
    const encoded = new TextEncoder().encode(source);
    const maxLength = module._ms_src_buf_size() - 1;

    if (encoded.length > maxLength) {
      throw new Error(`Source exceeds Swift input buffer (${maxLength} bytes).`);
    }

    module.HEAPU8.set(encoded, sourceBuffer);
    module.HEAPU8[sourceBuffer + encoded.length] = 0;
    module._ms_compile(encoded.length);
  }

  function collectSwiftErrors(module) {
    const errors = [];
    const count = module._ms_error_count();

    for (let index = 0; index < count; index += 1) {
      const messagePointer = module._ms_error_message(index);
      const message = messagePointer ? module.UTF8ToString(messagePointer) : "Unknown error";
      errors.push(`line ${module._ms_error_line(index)}:${module._ms_error_col(index)} - ${message}`);
    }

    return errors;
  }

  function readSwiftUIIR(module) {
    const pointer = module._ms_get_uiir_json?.();

    if (!pointer) {
      return null;
    }

    const text = module.UTF8ToString(pointer);
    return text ? JSON.parse(text) : null;
  }

  async function runSwift(source) {
    const startedAt = performance.now();
    clearOutput();
    showConsole("");
    status.textContent = swiftCompilerPromise ? "Compiling" : "Loading Swift";

    const module = await takeSwiftCompiler();
    writeSourceToSwiftCompiler(module, source);

    const errors = collectSwiftErrors(module);
    if (errors.length > 0) {
      setDiagnosticsText(errors.join("\n"));
      status.textContent = `Stopped in ${elapsed(startedAt)}ms`;
      setOutputText("(no output)");
      return;
    }

    const viewCount = module._ms_view_count ? module._ms_view_count() : 0;
    if (viewCount > 0) {
      const uiir = readSwiftUIIR(module);
      if (uiir?.views?.length > 0) {
        showSwiftUIPreview(uiir);
        setDiagnosticsText("");
        status.textContent = `Rendered ${viewCount} view${viewCount === 1 ? "" : "s"} in ${elapsed(startedAt)}ms`;
        return;
      }
    }

    const wasmPointer = module._ms_emit_wasm(0);
    const wasmSize = module._ms_wasm_size();

    if (!wasmPointer || wasmSize <= 0) {
      throw new Error("Swift did not emit a runnable WebAssembly module.");
    }

    const wasmBytes = module.HEAPU8.slice(wasmPointer, wasmPointer + wasmSize);
    status.textContent = "Running";
    await runGeneratedWasm(wasmBytes);

    if (outputLines.length === 0) {
      setOutputText("(no output)");
    }

    status.textContent = `Finished in ${elapsed(startedAt)}ms`;
  }

  function ensureMetalPreview() {
    if (metalPreview) {
      return metalPreview;
    }

    if (typeof globalThis.createMetalPreview !== "function") {
      throw new Error("Metal preview runtime is not loaded.");
    }

    metalPreview = globalThis.createMetalPreview({
      canvas: metalCanvas,
      errorEl: metalError,
      statusEl: metalStatus,
    });
    return metalPreview;
  }

  function normalizeMetalWGSL(wgsl) {
    return wgsl.replaceAll("Mini" + "Swift Metal Compiler", "Metal Compiler");
  }

  async function runMetal(source) {
    const startedAt = performance.now();
    clearOutput();
    showConsole("");
    status.textContent = metalBridge ? "Compiling Metal" : "Loading Metal compiler";

    const bridge = await loadMetalBridge();
    const compiled = bridge.transpile(source);
    const diagnostics = compiled.diagnostics
      .map((diagnostic) => {
        const labels = ["error", "warning", "info", "hint"];
        return `${labels[diagnostic.severity - 1] || "note"} ${diagnostic.line}:${diagnostic.column} - ${diagnostic.message}`;
      });

    if (!compiled.ok || compiled.entryPoints.length === 0) {
      setOutputText(compiled.error || "The source did not produce a Metal fragment, vertex, or kernel entry point.");
      setDiagnosticsText(diagnostics.join("\n"));
      status.textContent = `Stopped in ${elapsed(startedAt)}ms`;
      return;
    }

    const wgsl = normalizeMetalWGSL(compiled.wgsl);
    showMetalPreview();
    setDiagnosticsText([
      `entry points: ${compiled.entryPoints.map((entry) => `${entry.qualifier}:${entry.name}`).join(", ")}`,
      "",
      wgsl,
      diagnostics.length ? `\n${diagnostics.join("\n")}` : "",
    ].join("\n"));

    await ensureMetalPreview().load(wgsl);
    status.textContent = `Shader running in ${elapsed(startedAt)}ms`;
  }

  function elapsed(startedAt) {
    return (performance.now() - startedAt).toFixed(1);
  }

  function isRuntimeUnavailableError(error) {
    const message = String(error?.message || error);
    return (
      message.includes("not loaded") ||
      message.includes("not available") ||
      message.includes("Failed to fetch") ||
      message.includes("Could not load") ||
      message.includes("is not a function")
    );
  }

  function renderRunError(error, runMode, live) {
    const message = String(error?.message || error);

    if (isRuntimeUnavailableError(error)) {
      status.textContent = runMode === "metal" ? "Metal unavailable" : "Swift unavailable";
      showConsole(runMode === "metal" ? "The Metal runtime is not available in this build." : "The Swift runtime is not available in this build.");
      setDiagnosticsText(message);
      return;
    }

    status.textContent = "Stopped";
    showConsole(runMode === "metal" ? "Could not compile the Metal shader." : "Could not compile the Swift source.");
    setDiagnosticsText(live && runMode === "swift" && message.startsWith("Aborted()") ? "" : message);
  }

  async function run({ live = false } = {}) {
    if (!live) {
      cancelLiveRun();
    }

    if (isRunActive) {
      needsLiveRunAfterActive = true;
      return;
    }

    const runMode = activeMode;
    const runSource = getSource();

    isRunActive = true;
    runButton.disabled = true;
    setDiagnosticsText("");

    try {
      if (runMode === "metal") {
        await runMetal(runSource);
      } else {
        await runSwift(runSource);
      }
    } catch (error) {
      if (runMode === activeMode) {
        renderRunError(error, runMode, live);
      }
    } finally {
      isRunActive = false;
      runButton.disabled = false;

      if (needsLiveRunAfterActive) {
        needsLiveRunAfterActive = false;
        scheduleLiveRun({ delay: 0 });
      }
    }
  }

  async function runGeneratedWasm(wasmBytes) {
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 32768 });
    let heap = new Uint8Array(memory.buffer);
    const view = () => new DataView(memory.buffer);
    const refreshHeap = () => {
      heap = new Uint8Array(memory.buffer);
    };
    let pendingText = "";

    const imports = {
      wasi_snapshot_preview1: {
        fd_write(_fd, iov, iovCount, writtenPointer) {
          refreshHeap();
          const dataView = view();
          let written = 0;
          let chunk = "";

          for (let index = 0; index < iovCount; index += 1) {
            const pointer = dataView.getUint32(iov + index * 8, true);
            const length = dataView.getUint32(iov + index * 8 + 4, true);
            const bytes = new Uint8Array(memory.buffer, pointer, length);
            chunk += new TextDecoder().decode(bytes.filter((byte) => byte !== 0));
            written += length;
          }

          pendingText += chunk;
          let newlineIndex = pendingText.indexOf("\n");
          while (newlineIndex !== -1) {
            appendOutput(pendingText.slice(0, newlineIndex));
            pendingText = pendingText.slice(newlineIndex + 1);
            newlineIndex = pendingText.indexOf("\n");
          }

          dataView.setUint32(writtenPointer, written, true);
          return 0;
        },
        proc_exit(code) {
          if (code !== 0) {
            appendOutput(`exit(${code})`);
          }
        },
        clock_time_get() {
          return 0;
        },
        random_get(bufferPointer, length) {
          refreshHeap();
          const bytes = heap.subarray(bufferPointer, bufferPointer + length);

          if (globalThis.crypto?.getRandomValues) {
            for (let offset = 0; offset < bytes.length; offset += 65536) {
              globalThis.crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65536, bytes.length)));
            }
          } else {
            for (let index = 0; index < bytes.length; index += 1) {
              bytes[index] = Math.floor(Math.random() * 256);
            }
          }

          return 0;
        },
      },
      env: {
        memory,
        __ms_step() {},
        __date_now() {
          return 0;
        },
        __uuid_new() {
          return 0n;
        },
        __dec_is_letter() {
          return 0;
        },
        __dec_is_digit() {
          return 0;
        },
        __dec_is_whitespace() {
          return 0;
        },
        __dec_to_upper() {
          return 0;
        },
        __dec_to_lower() {
          return 0;
        },
      },
      stdlib: {},
      Foundation: {},
    };

    const stdlibResponse = await fetch(`/browser-runtime/stdlib.wasm?v=${assetVersion}`, {
      cache: "force-cache",
    });
    if (!stdlibResponse.ok) {
      throw new Error(`Could not load Swift stdlib (${stdlibResponse.status}).`);
    }

    const stdlibModule = await WebAssembly.compile(await stdlibResponse.arrayBuffer());
    const stdlibInstance = await WebAssembly.instantiate(stdlibModule, {
      env: {
        memory,
        emscripten_notify_memory_growth() {},
      },
      wasi_snapshot_preview1: imports.wasi_snapshot_preview1,
    });
    installStdlibExports(stdlibInstance.exports, imports);

    const generatedModule = await WebAssembly.compile(wasmBytes);
    WebAssembly.Module.imports(generatedModule).forEach((entry) => {
      if (entry.kind !== "function") {
        return;
      }

      if (entry.module === "env" && !(entry.name in imports.env)) {
        imports.env[entry.name] = () => 0n;
      }

      if (entry.module === "stdlib" && !(entry.name in imports.stdlib)) {
        imports.stdlib[entry.name] = () => 0n;
      }

      if (entry.module === "Foundation" && !(entry.name in imports.Foundation)) {
        imports.Foundation[entry.name] = () => 0n;
      }
    });

    const generatedInstance = await WebAssembly.instantiate(generatedModule, imports);
    try {
      if (generatedInstance.exports._start) {
        generatedInstance.exports._start();
      } else if (generatedInstance.exports.main) {
        generatedInstance.exports.main();
      }
    } catch (error) {
      if (pendingText.length > 0) {
        appendOutput(pendingText);
        pendingText = "";
      }
      throw new Error(`Runtime trap: ${error?.message || error}`);
    }

    if (pendingText.length > 0) {
      appendOutput(pendingText);
    }
  }

  function installStdlibExports(exports, imports) {
    const booleanReturnNames = new Set([
      "__dict_contains",
      "__dict_eq",
      "__set_contains",
      "__set_is_subset",
      "__set_is_superset",
      "__set_is_disjoint",
      "__array_insert",
      "__array_remove_at",
      "__array_elements_equal",
      "__array_starts_with",
      "__array_lex_precedes",
      "__str_eq",
      "__str_neq",
      "__str_has_prefix",
      "__str_has_suffix",
    ]);

    Object.keys(exports).forEach((exportName) => {
      if (typeof exports[exportName] !== "function") {
        return;
      }

      const targetName = normalizedExportName(exportName);
      const exported = exports[exportName];

      if (targetName.startsWith("__dec_")) {
        imports.env[targetName] = exported;
        return;
      }

      if (isDirectStdlibExport(targetName)) {
        imports.stdlib[targetName] = exported;
        return;
      }

      imports.stdlib[targetName] = makeSignatureAdaptiveExport(
        targetName,
        exported,
        booleanReturnNames.has(targetName)
      );
    });

    Object.keys(imports.stdlib).forEach((name) => {
      if (name.startsWith("__date_") || name.startsWith("__calendar_")) {
        imports.Foundation[name] = imports.stdlib[name];
      }
    });
  }

  function normalizedExportName(name) {
    if (name.startsWith("___") || (name.startsWith("_") && !name.startsWith("__"))) {
      return name.slice(1);
    }

    return name;
  }

  function isDirectStdlibExport(name) {
    return (
      name.startsWith("__print_") ||
      name.startsWith("__math_") ||
      name.startsWith("__url_") ||
      name.startsWith("__calendar_") ||
      name === "__swift_max_f64" ||
      name === "__swift_min_f64" ||
      name === "__swift_abs_f64" ||
      name === "__swift_abs_i64" ||
      name === "malloc" ||
      name === "free" ||
      name === "__str_concat" ||
      name === "__str_len" ||
      name === "__str_eq" ||
      name === "__str_neq" ||
      name === "__str_has_prefix" ||
      name === "__str_has_suffix" ||
      name === "__str_unicode_upper" ||
      name === "__str_unicode_lower"
    );
  }

  function makeSignatureAdaptiveExport(name, exported, returnsNumber) {
    let signatureMask = -1;

    return (...args) => {
      if (signatureMask === -1) {
        if (args.length === 0) {
          const value = exported();
          return value === undefined ? undefined : normalizeWasmReturn(value, returnsNumber);
        }

        for (let mask = 0; mask < 1 << args.length; mask += 1) {
          const convertedArgs = args.map((value, index) =>
            mask & (1 << index) ? Number(value) : typeof value === "bigint" ? value : BigInt(value)
          );

          try {
            const value = exported(...convertedArgs);
            signatureMask = mask;
            return value === undefined ? undefined : normalizeWasmReturn(value, returnsNumber);
          } catch (error) {
            if (error instanceof TypeError) {
              continue;
            }

            signatureMask = mask;
            throw error;
          }
        }

        throw new Error(`Failed to resolve WASM signature for ${name}`);
      }

      const convertedArgs = args.map((value, index) =>
        signatureMask & (1 << index) ? Number(value) : typeof value === "bigint" ? value : BigInt(value)
      );
      const value = exported(...convertedArgs);
      return value === undefined ? undefined : normalizeWasmReturn(value, returnsNumber);
    };
  }

  function normalizeWasmReturn(value, returnsNumber) {
    if (typeof value === "bigint" || returnsNumber) {
      return value;
    }

    return BigInt(value >>> 0);
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

    if (isShortcut && event.key === "Enter") {
      event.preventDefault();
      void run();
      return;
    }

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
  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setMode(button.dataset.mode);
    });
  });
  openButton?.addEventListener("click", () => openSwiftDockMode("script"));
  dockButton?.addEventListener("click", () => openSwiftDockMode("script"));
  swiftUIDockButton?.addEventListener("click", () => openSwiftDockMode("swiftui"));
  metalDockButton?.addEventListener("click", () => openDockMode("metal"));
  dockButton?.addEventListener("pointerenter", () => warmRuntime({ delay: 0 }));
  dockButton?.addEventListener("focus", () => warmRuntime({ delay: 0 }));
  dockButton?.addEventListener("touchstart", () => warmRuntime({ delay: 0 }), { passive: true });
  swiftUIDockButton?.addEventListener("pointerenter", () => warmRuntime({ delay: 0 }));
  swiftUIDockButton?.addEventListener("focus", () => warmRuntime({ delay: 0 }));
  swiftUIDockButton?.addEventListener("touchstart", () => warmRuntime({ delay: 0 }), { passive: true });
  metalDockButton?.addEventListener("pointerenter", () => {
    if (activeMode !== "metal") {
      return;
    }
    warmRuntime({ delay: 0 });
  });
  metalDockButton?.addEventListener("focus", () => {
    if (activeMode !== "metal") {
      return;
    }
    warmRuntime({ delay: 0 });
  });
  editor.addEventListener("focus", () => warmRuntime({ delay: 0 }));
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

    if (!windowElement.hidden && activeMode === "swift" && lastSwiftUIIR && typeof globalThis.renderUIIR === "function") {
      requestAnimationFrame(() => {
        if (!windowElement.hidden && activeMode === "swift" && lastSwiftUIIR) {
          fitSwiftUIPreview();
          globalThis.renderUIIR(lastSwiftUIIR, swiftUIPreview);
        }
      });
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
  root.dataset.swiftMode = activeSwiftMode;
  centerWindow();
  setMode("swift", { replaceSource: false });
  setSource(samples[activeSampleKey()]);
  showConsole(defaultConsoleMessage());
  setRuntimeStatus();
})();
