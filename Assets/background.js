(() => {
  const assetVersion = "20260520-background-idle-smooth";
  const canvas = document.querySelector("#swarm-field");

  if (!canvas) {
    return;
  }

  const preferenceKey = "olbo.background.preference";
  const slowUntilKey = "olbo.background.slowUntil";
  const slowOptOutDuration = 7 * 24 * 60 * 60 * 1000;
  const bootstrapSlowThreshold = 3200;
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get("background");
  const requestedCSS = requestedMode === "off" || requestedMode === "css" || requestedMode === "0";
  const requestedWebGPU = requestedMode === "on" || requestedMode === "webgpu" || requestedMode === "1";

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

  useLoading();

  if (requestedCSS) {
    window.olboAnimatedBackgroundDisabled = true;
    storageSet(preferenceKey, "css");
    useCSS("manual");
    return;
  }

  if (requestedWebGPU) {
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

  if (!requestedWebGPU && isLikelyConstrainedDevice()) {
    useCSS("constrained-device");
    return;
  }

  window.addEventListener(
    "olbo-background-slow",
    (event) => {
      markSlow(event.detail?.reason || "slow-frame");
    },
    { once: true },
  );

  scheduleBackgroundStart(() => {
    const startedAt = performance.now();
    const controller = new AbortController();
    let settled = false;

    const slowTimer = window.setTimeout(() => {
      if (!settled) {
        markSlow("slow-bootstrap");
        controller.abort();
      }
    }, bootstrapSlowThreshold);

    import(`/wasm/index.js?v=${assetVersion}`)
      .then(({ init }) =>
        init({
          module: fetch(`/wasm/WASMBackgroundRender.wasm?v=${assetVersion}`, {
            cache: "force-cache",
            signal: controller.signal,
          }),
        }),
      )
      .then(() => {
        settled = true;
        window.clearTimeout(slowTimer);

        if (performance.now() - startedAt > bootstrapSlowThreshold) {
          markSlow("slow-bootstrap");
        }
      })
      .catch((error) => {
        settled = true;
        window.clearTimeout(slowTimer);

        if (error?.name !== "AbortError") {
          useCSS("unavailable");
          console.warn("SwiftWasm WebGPU background unavailable.", error);
        }
      });
  });
})();
