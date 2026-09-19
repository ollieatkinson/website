(() => {
  let canvas = document.querySelector('#pixel-field');
  const motion = document.querySelector('#motion');
  const reseed = document.querySelector('#reseed');
  if (!canvas || !globalThis.PixelWorld) return;
  const world = globalThis.PixelWorld;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const query = new URLSearchParams(location.search).get('background');
  let paused = reducedMotion.matches || ['off', '0', 'css'].includes(query);
  let width, height, cellSize, cells, nextCells, context;
  let seed = 7, generation = 0, pointer = null;
  let gpu = null, epoch = 0, disposed = false;
  let frameID = 0, previous = 0;
  const palette = Array.from({length: 512}, (_, state) => `rgb(${world.color(state).join(',')})`);

  function replaceCanvas(kind) {
    const replacement = canvas.cloneNode();
    canvas.replaceWith(replacement);
    canvas = replacement;
    context = canvas.getContext(kind);
    canvas.dataset.renderer = kind === 'webgpu' ? 'webgpu' : 'canvas';
  }
  function describe() {
    canvas.dataset.generation = generation;
    canvas.dataset.seed = seed;
    canvas.dataset.columns = width;
    canvas.dataset.rows = height;
    canvas.dataset.cellSize = cellSize;
  }
  function reset() {
    generation = 0;
    pointer = null;
    cells = world.seed(width, height, seed);
    nextCells = new Uint32Array(cells.length);
    gpu?.reset();
    draw();
  }
  function resize() {
    const pixelWidth = Math.max(1, canvas.parentElement.clientWidth);
    const pixelHeight = Math.max(1, canvas.parentElement.clientHeight);
    const nextSize = Math.max(7, Math.ceil(pixelWidth / 240), Math.ceil(pixelHeight / 160));
    const columns = Math.ceil(pixelWidth / nextSize);
    const rows = Math.ceil(pixelHeight / nextSize);
    const changed = width !== columns || height !== rows || cellSize !== nextSize;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    width = columns; height = rows; cellSize = nextSize;
    if (changed || !cells) reset();
    else draw();
  }
  function drawCPU() {
    if (!context) return;
    context.fillStyle = 'rgb(16,21,20)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const state = cells[y * width + x];
        if (!state) continue;
        context.fillStyle = palette[state];
        context.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 1, cellSize - 1);
      }
    }
  }
  function draw() {
    if (disposed) return;
    if (gpu) gpu.render(false);
    else drawCPU();
    describe();
  }
  function step() {
    if (gpu) gpu.render(true);
    else {
      world.evolve(cells, nextCells, width, height, generation, seed, pointer);
      [cells, nextCells] = [nextCells, cells];
      drawCPU();
    }
    generation++;
    pointer = null;
    describe();
  }
  function animate(now) {
    frameID = 0;
    if (paused || document.hidden || disposed) return;
    if (!previous) previous = now;
    if (now - previous >= 100) {
      previous = now;
      step();
    }
    frameID = requestAnimationFrame(animate);
  }
  function schedule() {
    cancelAnimationFrame(frameID);
    frameID = 0; previous = 0; pointer = null;
    motion.textContent = paused ? 'Play' : 'Pause';
    motion.setAttribute('aria-label', paused ? 'Play background animation' : 'Pause background animation');
    if (!paused && !document.hidden && !disposed) frameID = requestAnimationFrame(animate);
  }
  function fallback(reason) {
    const old = gpu;
    gpu = null;
    old?.destroy();
    if (disposed) return;
    replaceCanvas('2d');
    canvas.dataset.gpuError = reason;
    // A lost device cannot be read back; begin a fresh deterministic garden.
    reset();
  }

  async function useGPU() {
    if (!navigator.gpu) return;
    const ticket = ++epoch;
    let device;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter || disposed || ticket !== epoch) return;
      device = await adapter.requestDevice();
      const sources = await Promise.all(['background', 'background-display'].map(async name => {
        const response = await fetch(`/${name}.wgsl?v=20260919-garden`);
        if (!response.ok) throw new Error('Background shader unavailable');
        return response.text();
      }));
      if (disposed || ticket !== epoch) { device.destroy(); return; }
      const computeModule = device.createShaderModule({code: sources[0]});
      const displayModule = device.createShaderModule({code: sources[1] + `
        @vertex fn fullscreen(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
          let points = array<vec2f, 3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
          return vec4f(points[i], 0, 1);
        }`});
      const format = navigator.gpu.getPreferredCanvasFormat();
      const [compute, display] = await Promise.all([
        device.createComputePipelineAsync({layout: 'auto', compute: {module: computeModule, entryPoint: 'evolve'}}),
        device.createRenderPipelineAsync({layout: 'auto', vertex: {module: displayModule, entryPoint: 'fullscreen'},
          fragment: {module: displayModule, entryPoint: 'fs_main', targets: [{format}]}, primitive: {topology: 'triangle-list'}}),
      ]);
      if (disposed || ticket !== epoch) { device.destroy(); return; }
      const uniform = device.createBuffer({size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
      const data = new ArrayBuffer(32), integers = new Uint32Array(data), floats = new Float32Array(data);
      let buffers = [], computeGroups = [], displayGroups = [], current = 0;
      replaceCanvas('webgpu');
      if (!context) throw new Error('WebGPU canvas unavailable');
      context.configure({device, format, alphaMode: 'opaque'});
      const gpuContext = context;
      const owned = {
        reset() {
          for (const buffer of buffers) buffer.destroy();
          buffers = [0, 1].map(index => device.createBuffer({label: `garden-state-${index}`, size: cells.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC}));
          for (const buffer of buffers) device.queue.writeBuffer(buffer, 0, cells);
          current = 0;
          computeGroups = buffers.map((buffer, index) => device.createBindGroup({layout: compute.getBindGroupLayout(0), entries: [
            {binding: 0, resource: {buffer}}, {binding: 1, resource: {buffer: buffers[1 - index]}}, {binding: 2, resource: {buffer: uniform}},
          ]}));
          displayGroups = buffers.map(buffer => device.createBindGroup({layout: display.getBindGroupLayout(0), entries: [
            {binding: 0, resource: {buffer}}, {binding: 1, resource: {buffer: uniform}},
          ]}));
        },
        render(advance) {
          integers.set([width, height, generation, seed]);
          floats[4] = pointer?.x ?? -100; floats[5] = pointer?.y ?? -100;
          integers[6] = advance && pointer ? 1 : 0; integers[7] = cellSize;
          device.queue.writeBuffer(uniform, 0, data);
          const encoder = device.createCommandEncoder();
          if (advance) {
            const pass = encoder.beginComputePass();
            pass.setPipeline(compute);
            pass.setBindGroup(0, computeGroups[current]);
            pass.dispatchWorkgroups(Math.ceil(width / 64), height);
            pass.end();
            current = 1 - current;
          }
          const pass = encoder.beginRenderPass({colorAttachments: [{
            view: gpuContext.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store',
            clearValue: {r: .063, g: .082, b: .078, a: 1},
          }]});
          pass.setPipeline(display);
          pass.setBindGroup(0, displayGroups[current]);
          pass.draw(3);
          pass.end();
          device.queue.submit([encoder.finish()]);
        },
        destroy() { for (const buffer of buffers) buffer.destroy(); uniform.destroy(); device.destroy(); },
      };
      gpu = owned;
      owned.reset();
      device.lost.then(info => { if (gpu === owned) fallback(info.message || 'GPU device lost'); });
      device.addEventListener('uncapturederror', event => { if (gpu === owned) fallback(event.error.message); }, {once: true});
      draw();
    } catch (error) {
      device?.destroy();
      if (!disposed && ticket === epoch) fallback(error.message);
    }
  }

  replaceCanvas('2d');
  resize();
  motion.hidden = false;
  reseed.hidden = false;
  motion.addEventListener('click', () => { paused = !paused; schedule(); });
  reseed.addEventListener('click', () => { seed = (seed + 1) % 65536; reset(); });
  // Capture on the window, so text, links, and the editor all share the field.
  // The canvas has pointer-events:none and never intercepts page interaction.
  window.addEventListener('pointermove', event => {
    if (paused || document.hidden || event.pointerType === 'touch') return;
    pointer = {x: event.clientX / cellSize, y: event.clientY / cellSize};
  }, {passive: true, capture: true});
  document.addEventListener('pointerleave', () => { pointer = null; });
  window.addEventListener('blur', () => { pointer = null; });
  new ResizeObserver(resize).observe(canvas.parentElement);
  reducedMotion.addEventListener('change', event => { if (event.matches) { paused = true; schedule(); } });
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pagehide', () => { disposed = true; epoch++; cancelAnimationFrame(frameID); gpu?.destroy(); gpu = null; });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { disposed = false; replaceCanvas('2d'); reset(); useGPU(); schedule(); }
  });
  schedule();
  useGPU();
})();
