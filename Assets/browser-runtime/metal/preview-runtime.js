/* ─────────────────────────────────────────────────────────────────────────
   preview-runtime.js — WebGPU "ShaderToy"-style live preview for transpiled
   WGSL fragment shaders.

   Adapted from metal-shading-language-vscode-extension/vscode-metal/src/preview.ts
   for browser (no postMessage; talked to directly).

   Uniforms layout (32 bytes, matches the VSCode extension's preview):
     time:       f32     // 0
     pointer:    f32     // 4, used by olbo.dev background; padding for older shaders
     resolution: vec2f   // 8
     mouse:      vec2f   // 16
     frame:      u32     // 24

   API:
     const preview = createMetalPreview({ canvas, statusEl?, errorEl? });
     await preview.init();
     preview.load(wgsl);          // (re)build pipeline + start RAF loop
     preview.error('title', 'msg');// surface a string error in the overlay
     preview.dispose();           // stop loop, release device resources
   ───────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  const VS_NAME = 'ms_preview_fullscreen_vs';
  const VS_SOURCE = [
    '@vertex',
    'fn ' + VS_NAME + '(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4f {',
    '  var pos = array<vec2f, 3>(',
    '    vec2f(-1.0, -1.0),',
    '    vec2f( 3.0, -1.0),',
    '    vec2f(-1.0,  3.0),',
    '  );',
    '  return vec4f(pos[vid], 0.0, 1.0);',
    '}',
  ].join('\n');

  function _extractFragmentEntry(wgsl) {
    const m = wgsl.match(/@fragment\s+fn\s+([A-Za-z_][A-Za-z0-9_]*)/);
    return m ? m[1] : null;
  }

  function createMetalPreview(opts) {
    const canvas   = opts.canvas;
    const setStatus = (t) => { if (opts.statusEl) opts.statusEl.textContent = t; };
    const showError = (title, body) => {
      if (!opts.errorEl) return;
      opts.errorEl.innerHTML = '';
      const t = document.createElement('div');
      t.className = 'mp-err-title';
      t.textContent = title;
      const b = document.createElement('div');
      b.className = 'mp-err-body';
      b.textContent = body;
      opts.errorEl.appendChild(t);
      opts.errorEl.appendChild(b);
      opts.errorEl.classList.add('visible');
    };
    const clearError = () => { if (opts.errorEl) opts.errorEl.classList.remove('visible'); };

    let device, ctx, format, pipeline, bindGroup, uniformBuf;
    let startTime = performance.now();
    let frame = 0;
    let mouseX = -1, mouseY = -1;
    let pointerEnergy = 0;
    let lastFrameTime = performance.now();
    let rafId = 0;
    let disposed = false;
    const usesPointerEvents = 'PointerEvent' in window;

    function isVisible() {
      return !document.hidden;
    }

    function canRender() {
      return !disposed && pipeline && device && isVisible();
    }

    function stopScheduledFrame() {
      if (!rafId) return;
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function scheduleFrame() {
      if (rafId || !canRender()) return;
      rafId = requestAnimationFrame(renderLoop);
    }

    function handleVisibilityChange() {
      if (!isVisible()) {
        stopScheduledFrame();
        return;
      }

      lastFrameTime = performance.now();
      scheduleFrame();
    }

    async function init() {
      if (device) return true;
      if (!navigator.gpu) {
        showError('WebGPU unavailable',
          'Your browser does not expose navigator.gpu. Try Chrome / Edge 113+, Safari 18+ on macOS, or Firefox Nightly.');
        return false;
      }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          showError('No GPU adapter', 'navigator.gpu.requestAdapter() returned null.');
          return false;
        }
        device = await adapter.requestDevice();
        device.lost.then((info) => {
          showError('GPU device lost', info.message || '(no reason)');
          device = null;
          pipeline = null;
        });

        ctx = canvas.getContext('webgpu');
        format = navigator.gpu.getPreferredCanvasFormat();
        ctx.configure({ device, format, alphaMode: 'opaque' });

        uniformBuf = device.createBuffer({
          size: 32,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        return true;
      } catch (err) {
        showError('GPU init failed', String(err && err.message ? err.message : err));
        return false;
      }
    }

    async function load(wgsl) {
      if (disposed) return;
      if (!await init()) return;

      const fsName = _extractFragmentEntry(wgsl);
      if (!fsName) {
        showError('No fragment entry point',
          'Preview needs a @fragment function. Did the shader emit only a kernel or vertex stage?');
        pipeline = null;
        return;
      }

      const combined = wgsl + '\n\n' + VS_SOURCE + '\n';

      device.pushErrorScope('validation');
      const module = device.createShaderModule({ code: combined });

      let newPipeline, pipelineErr;
      try {
        newPipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex:   { module, entryPoint: VS_NAME },
          fragment: { module, entryPoint: fsName, targets: [{ format }] },
          primitive: { topology: 'triangle-list' },
        });
      } catch (err) {
        pipelineErr = err;
      }

      const err = await device.popErrorScope();
      if (pipelineErr || err) {
        const msg = (pipelineErr && pipelineErr.message) ? pipelineErr.message
                   : (err && err.message) ? err.message
                   : 'unknown pipeline validation error';
        showError('Pipeline failed to compile', msg);
        pipeline = null;
        return;
      }

      bindGroup = null;
      try {
        const layout = newPipeline.getBindGroupLayout(0);
        bindGroup = device.createBindGroup({
          layout,
          entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
        });
      } catch (_) {
        // Shader doesn't declare any bind group — ignore.
      }

      pipeline = newPipeline;
      clearError();
      frame = 0;
      startTime = performance.now();
      lastFrameTime = startTime;
      scheduleFrame();
      setStatus('running · @fragment ' + fsName);
    }

    function renderLoop() {
      rafId = 0;
      if (!canRender()) return;

      const rect = canvas.getBoundingClientRect();
      const dpr  = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width  * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
      }

      const now = performance.now();
      const delta = Math.min(0.08, Math.max(0, (now - lastFrameTime) / 1000)) || 1 / 60;
      lastFrameTime = now;

      const t = (now - startTime) / 1000;
      const u = new ArrayBuffer(32);
      const f32 = new Float32Array(u);
      const u32 = new Uint32Array(u);
      f32[0] = t;
      f32[1] = pointerEnergy;
      f32[2] = canvas.width;
      f32[3] = canvas.height;
      f32[4] = mouseX;
      f32[5] = mouseY;
      u32[6] = frame;
      device.queue.writeBuffer(uniformBuf, 0, u);
      pointerEnergy = Math.max(0, pointerEnergy - delta * 0.34);

      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [{
          view: ctx.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp:  'clear',
          storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      if (bindGroup) pass.setBindGroup(0, bindGroup);
      pass.draw(3, 1, 0, 0);
      pass.end();
      device.queue.submit([enc.finish()]);

      frame++;
      scheduleFrame();
    }

    function movePointer(e) {
      const r = canvas.getBoundingClientRect();
      mouseX = (e.clientX - r.left) * (canvas.width  / r.width);
      mouseY = (e.clientY - r.top)  * (canvas.height / r.height);
      pointerEnergy = 1;
    }

    function leavePointer() {
      mouseX = -1;
      mouseY = -1;
      pointerEnergy = 0;
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (usesPointerEvents) {
      canvas.addEventListener('pointermove', movePointer);
      canvas.addEventListener('pointerdown', movePointer);
      canvas.addEventListener('pointerleave', leavePointer);
    } else {
      canvas.addEventListener('mousemove', movePointer);
      canvas.addEventListener('mouseleave', leavePointer);
    }

    function dispose() {
      disposed = true;
      stopScheduledFrame();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (usesPointerEvents) {
        canvas.removeEventListener('pointermove', movePointer);
        canvas.removeEventListener('pointerdown', movePointer);
        canvas.removeEventListener('pointerleave', leavePointer);
      } else {
        canvas.removeEventListener('mousemove', movePointer);
        canvas.removeEventListener('mouseleave', leavePointer);
      }
      pipeline = null;
      bindGroup = null;
      // Buffer release happens implicitly when device is GC'd. Don't try
      // to destroy the device — the user might still be in the playground.
    }

    return {
      init,
      load,
      error: showError,
      clearError,
      dispose,
    };
  }

  global.createMetalPreview = createMetalPreview;
})(typeof window !== 'undefined' ? window : globalThis);
