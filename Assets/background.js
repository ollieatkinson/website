(() => {
  const assetVersion = "20260504-idle-throttle";
  const canvas = document.querySelector("#swarm-field");

  if (!canvas) {
    return;
  }

  if (!("gpu" in navigator)) {
    canvas.dataset.rendering = "css";
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    canvas.dataset.rendering = "css";
    return;
  }

  import(`/wasm/index.js?v=${assetVersion}`)
    .then(({ init }) =>
      init({
        module: fetch(`/wasm/WASMBackgroundRender.wasm?v=${assetVersion}`),
      }),
    )
    .catch((error) => {
      canvas.dataset.rendering = "css";
      console.warn("SwiftWasm WebGPU background unavailable.", error);
    });
})();
