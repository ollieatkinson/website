(() => {
  const playground = document.querySelector('#playground');
  const editor = document.querySelector('#source');
  const runButton = document.querySelector('#run');
  const stopButton = document.querySelector('#stop');
  const output = document.querySelector('#output');
  const status = document.querySelector('#run-status');
  if (!playground) return;
  if (!window.Worker || !window.WebAssembly) {
    status.textContent = 'Swift needs WebAssembly and Web Workers.';
    return;
  }
  let worker = null;
  let timeout;
  let outputText = '';
  let started = 0;

  function finish(message) {
    worker?.terminate();
    worker = null;
    clearTimeout(timeout);
    runButton.disabled = false;
    stopButton.disabled = true;
    status.textContent = message;
  }

  function run() {
    if (worker) return;
    outputText = '';
    output.textContent = '';
    output.dataset.error = 'false';
    started = performance.now();
    runButton.disabled = true;
    stopButton.disabled = false;
    status.textContent = 'Loading Swift…';
    try {
      worker = new Worker('/swift-worker.js?v=20260919');
      worker.onmessage = ({data}) => {
        if (data.type === 'output') {
          outputText += data.text + '\n';
          output.textContent = outputText;
        } else if (data.type === 'status') {
          status.textContent = data.text;
        } else if (data.type === 'error') {
          output.dataset.error = 'true';
          output.textContent = outputText + data.text;
          finish('Stopped with an error');
        } else if (data.type === 'done') {
          if (!outputText) output.textContent = '(no output)';
          finish(`Finished in ${((performance.now() - started) / 1000).toFixed(2)}s`);
        }
      };
      worker.onerror = () => {
        output.dataset.error = 'true';
        output.textContent = 'Could not load the Swift runtime. Check your connection and try Run again.';
        finish('Swift unavailable');
      };
      worker.postMessage({source: editor.value});
      timeout = setTimeout(() => {
        output.textContent += '\nStopped after 15 seconds. Try a smaller loop.';
        finish('Time limit reached');
      }, 15000);
    } catch (error) {
      output.textContent = error.message;
      finish('Swift unavailable');
    }
  }

  runButton.disabled = false;
  runButton.addEventListener('click', run);
  stopButton.addEventListener('click', () => finish('Stopped'));
  editor.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      run();
    }
  });
  function openFromHash() {
    if (location.hash === '#playground') playground.open = true;
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
  window.addEventListener('pagehide', () => finish('Stopped'));
})();
