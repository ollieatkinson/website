(() => {
  const assetVersion = "20260529-browser-runtime";
  const canvas = document.querySelector("#swarm-field");

  if (!canvas) {
    return;
  }

  const preferenceKey = "olbo.background.preference";
  const slowUntilKey = "olbo.background.slowUntil";
  const slowOptOutDuration = 7 * 24 * 60 * 60 * 1000;
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get("background");
  const requestedCSS = requestedMode === "off" || requestedMode === "css" || requestedMode === "0";
  const requestedAnimated = requestedMode === "on" || requestedMode === "wasm" || requestedMode === "metal" || requestedMode === "1";
  const bootstrapSlowThreshold = requestedAnimated ? 8000 : 3200;
  let activePreview = null;

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore private browsing and storage policy failures.
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore private browsing and storage policy failures.
    }
  }

  function revealCanvas(expectedRendering) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!expectedRendering || canvas.dataset.rendering === expectedRendering) {
          canvas.dataset.reveal = "visible";
        }
      });
    });
  }

  function useLoading() {
    canvas.dataset.rendering = "loading";
    canvas.dataset.renderingReason = "loading";
    canvas.dataset.reveal = "pending";
  }

  function useCSS(reason) {
    activePreview?.dispose();
    activePreview = null;
    canvas.dataset.rendering = "css";
    canvas.dataset.renderingReason = reason;
    canvas.dataset.reveal = "pending";
    revealCanvas("css");
  }

  if ("MutationObserver" in window) {
    const renderingObserver = new MutationObserver(() => {
      if (canvas.dataset.rendering === "css" && canvas.dataset.reveal !== "visible") {
        canvas.dataset.reveal = "pending";
        revealCanvas("css");
      }
    });
    renderingObserver.observe(canvas, {
      attributes: true,
      attributeFilter: ["data-rendering"],
    });
  }

  function markSlow(reason) {
    window.olboAnimatedBackgroundDisabled = true;
    storageSet(slowUntilKey, String(Date.now() + slowOptOutDuration));
    useCSS(reason);
  }

  function isSlowOptOutActive() {
    const slowUntil = Number(storageGet(slowUntilKey) || 0);
    return Number.isFinite(slowUntil) && slowUntil > Date.now();
  }

  function connection() {
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  }

  function isLikelyConstrainedDevice() {
    const activeConnection = connection();

    if (activeConnection?.saveData) {
      return true;
    }

    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
      return true;
    }

    if (navigator.deviceMemory && navigator.deviceMemory <= 2) {
      return true;
    }

    return false;
  }

  function scheduleBackgroundStart(start) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(start, { timeout: 1600 });
        } else {
          window.setTimeout(start, 700);
        }
      });
    });
  }

  async function loadBackgroundSource(signal) {
    const response = await fetch(`/background.metal?v=${assetVersion}`, {
      cache: "force-cache",
      signal,
    });

    if (!response.ok) {
      throw new Error(`Could not load background shader (${response.status}).`);
    }

    return response.text();
  }

  function compileBackgroundShader(bridge, source) {
    const compiled = bridge.transpile(source);

    if (!compiled.ok) {
      const diagnostics = compiled.diagnostics
        .map((diagnostic) => `${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`)
        .join("\n");
      throw new Error(compiled.error || diagnostics || "Background shader did not compile.");
    }

    return compiled.wgsl;
  }

  async function startMetalBackground(signal) {
    if (typeof globalThis.loadMetalCompiler !== "function" || typeof globalThis.createMetalPreview !== "function") {
      throw new Error("Metal runtime is not loaded.");
    }

    const [bridge, source] = await Promise.all([
      globalThis.loadMetalCompiler(),
      loadBackgroundSource(signal),
    ]);

    if (signal.aborted) {
      return;
    }

    const wgsl = compileBackgroundShader(bridge, source);
    const preview = globalThis.createMetalPreview({ canvas });
    const ready = await preview.init();

    if (!ready) {
      preview.dispose();
      throw new Error("WebGPU is unavailable.");
    }

    if (signal.aborted) {
      preview.dispose();
      return;
    }

    await preview.load(wgsl);
    if (signal.aborted) {
      preview.dispose();
      return;
    }

    canvas.dataset.rendering = "metal";
    canvas.dataset.renderingReason = "metal";
    canvas.dataset.reveal = "pending";
    revealCanvas("metal");
    activePreview = preview;
  }

  useLoading();

  if (requestedCSS) {
    window.olboAnimatedBackgroundDisabled = true;
    storageSet(preferenceKey, "css");
    useCSS("manual");
    return;
  }

  if (requestedAnimated) {
    window.olboAnimatedBackgroundDisabled = false;
    storageRemove(preferenceKey);
    storageRemove(slowUntilKey);
  }

  if (storageGet(preferenceKey) === "css") {
    window.olboAnimatedBackgroundDisabled = true;
    useCSS("manual");
    return;
  }

  if (isSlowOptOutActive()) {
    window.olboAnimatedBackgroundDisabled = true;
    useCSS("slow-device");
    return;
  }

  if (!("gpu" in navigator)) {
    useCSS("unsupported");
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    useCSS("reduced-motion");
    return;
  }

  if (!requestedAnimated && isLikelyConstrainedDevice()) {
    useCSS("constrained-device");
    return;
  }

  scheduleBackgroundStart(() => {
    const controller = new AbortController();
    let settled = false;

    const slowTimer = window.setTimeout(() => {
      if (!settled) {
        controller.abort();
        markSlow("slow-bootstrap");
      }
    }, bootstrapSlowThreshold);

    startMetalBackground(controller.signal)
      .then(() => {
        settled = true;
        window.clearTimeout(slowTimer);
      })
      .catch((error) => {
        settled = true;
        window.clearTimeout(slowTimer);

        if (error?.name !== "AbortError") {
          useCSS("unavailable");
          console.warn("Metal background unavailable.", error);
        }
      });
  });
})();
