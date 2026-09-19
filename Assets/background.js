(() => {
  let canvas = document.querySelector('#pixel-field');
  const motion = document.querySelector('#motion');
  const note = document.querySelector('#pattern-note');
  const buttons = [...document.querySelectorAll('[data-pattern]')];
  if (!canvas) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const query = new URLSearchParams(location.search).get('background');
  let paused = reducedMotion.matches || ['off', '0', 'css'].includes(query);
  let pattern = 0;
  let time = 0;
  let pointerX = -1;
  let frameID = 0;
  let previous = 0;
  let renderer;
  let visible = true;
  let disposed = false;
  let destroyGPU = () => {};

  function size() {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }
  function draw() {
    size();
    renderer?.();
  }
  function animate(now) {
    frameID = 0;
    if (paused || document.hidden || !visible || disposed) return;
    if (!previous) previous = now;
    if (now - previous >= 100) {
      time += Math.min((now - previous) / 1000, 0.25);
      previous = now;
      draw();
    }
    frameID = requestAnimationFrame(animate);
  }
  function schedule() {
    cancelAnimationFrame(frameID);
    frameID = 0;
    previous = 0;
    motion.textContent = paused ? 'Play' : 'Pause';
    motion.setAttribute('aria-label', paused ? 'Play pattern animation' : 'Pause pattern animation');
    if (!paused && !document.hidden && visible && !disposed) frameID = requestAnimationFrame(animate);
  }

  // Same integer construction as background.metal, for browsers without WebGPU.
  function useCanvas() {
    if (disposed) return;
    // A canvas cannot change context types after getContext('webgpu').
    const replacement = canvas.cloneNode();
    canvas.replaceWith(replacement);
    canvas = replacement;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.dataset.renderer = 'canvas';
    renderer = () => {
      context.fillStyle = '#191c1b';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const offset = pointerX < 0 ? 0 : Math.floor((pointerX - canvas.width / 2) / 16);
      for (let y = 0; y < canvas.height; y += 4) {
        const row = (y / 4 + Math.floor(time * 5)) % 128;
        const band = Math.floor(row / 16) % 3;
        context.fillStyle = ['#a8bf8a', '#c6b483', '#e3a97e'][band];
        for (let x = 0; x < canvas.width; x += 4) {
          const column = x / 4 - Math.floor(canvas.width / 8) + offset;
          const k = (column + row) / 2;
          const alive = pattern === 0
            ? k >= 0 && k <= row && Number.isInteger(k) && (k & row) === k
            : ((Math.abs(column) ^ row) % 16) < 5;
          if (alive) context.fillRect(x, y, 4, 4);
        }
      }
    };
    draw();
  }

  async function useGPU() {
    if (!navigator.gpu) return;
    let device;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter || disposed) return;
      device = await adapter.requestDevice();
      if (disposed) { device.destroy(); return; }
      const response = await fetch('/background.wgsl?v=20260919');
      if (!response.ok) throw new Error('Shader unavailable');
      const source = await response.text();
      if (disposed) { device.destroy(); return; }
      const module = device.createShaderModule({code: source + `
        @vertex fn fullscreen(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
          let points = array<vec2f, 3>(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
          return vec4f(points[i], 0, 1);
        }`});
      const format = navigator.gpu.getPreferredCanvasFormat();
      const pipeline = await device.createRenderPipelineAsync({
        layout: 'auto', vertex: {module, entryPoint: 'fullscreen'},
        fragment: {module, entryPoint: 'fs_main', targets: [{format}]},
        primitive: {topology: 'triangle-list'},
      });
      if (disposed) { device.destroy(); return; }
      const replacement = canvas.cloneNode();
      const context = replacement.getContext('webgpu');
      if (!context) throw new Error('WebGPU context unavailable');
      context.configure({device, format, alphaMode: 'opaque'});
      const buffer = device.createBuffer({size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
      const group = device.createBindGroup({layout: pipeline.getBindGroupLayout(0), entries: [{binding: 0, resource: {buffer}}]});
      canvas.replaceWith(replacement);
      canvas = replacement;
      canvas.dataset.renderer = 'webgpu';
      const uniforms = new Float32Array(8);
      renderer = () => {
        uniforms.set([time, pattern, canvas.width, canvas.height, pointerX, -1]);
        device.queue.writeBuffer(buffer, 0, uniforms);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({colorAttachments: [{
          view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store',
          clearValue: {r: .098, g: .11, b: .106, a: 1},
        }]});
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
      };
      destroyGPU = () => { buffer.destroy(); device.destroy(); };
      device.lost.then(info => { if (!disposed) { useCanvas(); canvas.dataset.gpuError ||= info.message || info.reason; } });
      device.addEventListener('uncapturederror', event => {
        canvas.dataset.gpuError = event.error.message;
        destroyGPU();
        useCanvas();
      }, {once: true});
      draw();
    } catch (error) {
      device?.destroy();
      useCanvas();
      canvas.dataset.gpuError = error.message;
    }
  }

  useCanvas();
  motion.hidden = false;
  motion.addEventListener('click', () => { paused = !paused; schedule(); });
  for (const button of buttons) {
    button.disabled = false;
    button.addEventListener('click', () => {
      pattern = Number(button.dataset.pattern);
      for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
      note.textContent = pattern === 0 ? 'Pascal’s triangle, modulo 2.' : '(x XOR y) mod 16 < 5.';
      canvas.setAttribute('aria-label', pattern === 0 ? 'Sierpiński triangle, generated from Pascal’s triangle modulo two' : 'Pixel quilt generated by bitwise exclusive OR');
      draw();
    });
  }
  const wrapper = document.querySelector('.canvas-wrap');
  wrapper.addEventListener('pointermove', event => {
    pointerX = event.clientX - canvas.getBoundingClientRect().left;
    draw();
  });
  wrapper.addEventListener('pointerleave', () => { pointerX = -1; draw(); });
  reducedMotion.addEventListener('change', event => { if (event.matches) { paused = true; schedule(); } });
  document.addEventListener('visibilitychange', schedule);
  new ResizeObserver(draw).observe(wrapper);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }).observe(wrapper);
  window.addEventListener('pagehide', () => { disposed = true; cancelAnimationFrame(frameID); destroyGPU(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; useCanvas(); useGPU(); schedule(); } });
  schedule();
  useGPU();
})();
