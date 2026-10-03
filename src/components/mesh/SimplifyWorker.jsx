// Creates a Blob-based Web Worker that loads the MyMiniFactory
// Fast-Quadric-Mesh-Simplification WASM and runs simplification.

const WASM_BASE = 'https://myminifactory.github.io/Fast-Quadric-Mesh-Simplification/';

const WORKER_SCRIPT = `
var wasmReady = false;
var pendingJob = null;

var Module = {
  print: function(text) { self.postMessage({ type: 'log', text: text }); },
  printErr: function(text) { self.postMessage({ type: 'log', text: text }); },
  locateFile: function(path) { return '${WASM_BASE}' + path; },
  onRuntimeInitialized: function() {
    wasmReady = true;
    self.postMessage({ type: 'ready' });
    if (pendingJob) {
      var job = pendingJob;
      pendingJob = null;
      runJob(job);
    }
  }
};

self.importScripts('${WASM_BASE}a.out.js');

var lastFileName = null;

self.addEventListener('message', function(e) {
  var job = e.data;
  if (wasmReady) {
    runJob(job);
  } else {
    pendingJob = job;
  }
});

function runJob(job) {
  var file = job.file;
  var ratio = job.ratio;
  var outputExt = job.outputExt || 'stl';
  var inputName = file.name;
  var outputName = 'output.' + outputExt;

  function doSimplify() {
    try { Module.FS_unlink(outputName); } catch(ex) {}
    try {
      Module.ccall('simplify', undefined, ['string', 'number', 'string'], [inputName, ratio, outputName]);
      var outBin = Module.FS_readFile(outputName);
      var blob = new Blob([outBin], { type: 'application/octet-stream' });
      self.postMessage({ type: 'result', blob: blob });
    } catch(ex) {
      self.postMessage({ type: 'error', message: ex.toString() });
    }
  }

  if (inputName === lastFileName) {
    doSimplify();
    return;
  }

  if (lastFileName !== null) {
    try { Module.FS_unlink(lastFileName); } catch(ex) {}
  }
  lastFileName = inputName;

  var reader = new FileReader();
  reader.readAsArrayBuffer(file);
  reader.onloadend = function() {
    var data = new Uint8Array(reader.result);
    try { Module.FS_createDataFile('.', inputName, data, true, true); } catch(ex) {}
    doSimplify();
  };
}
`;

let workerInstance = null;
let callbacks = {};

export function getWorker(onReady, onLog, onResult, onError) {
  if (workerInstance) {
    // Update callbacks
    callbacks = { onReady, onLog, onResult, onError };
    return workerInstance;
  }

  const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  workerInstance = worker;

  callbacks = { onReady, onLog, onResult, onError };

  worker.onmessage = function(e) {
    const { type, text, blob, message } = e.data;
    if (type === 'ready') {
      callbacks.onReady && callbacks.onReady();
    } else if (type === 'log') {
      callbacks.onLog && callbacks.onLog(text);
    } else if (type === 'result') {
      callbacks.onResult && callbacks.onResult(blob);
    } else if (type === 'error') {
      callbacks.onError && callbacks.onError(message);
    }
  };

  worker.onerror = function(e) {
    callbacks.onError && callbacks.onError(e.message || 'Worker error');
  };

  return worker;
}

export function simplifyMesh(file, ratio, outputExt) {
  if (!workerInstance) return;
  workerInstance.postMessage({ file, ratio, outputExt });
}