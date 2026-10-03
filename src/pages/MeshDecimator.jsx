import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Hexagon, Sparkles, Terminal, Circle } from 'lucide-react';
import FileUploader from '@/components/mesh/FileUploader';
import QualityControls from '@/components/mesh/QualityControls';
import ModelPreview from '@/components/mesh/ModelPreview';
import { parseSTL, parseOBJ, exportSTL, exportOBJ } from '@/components/mesh/meshUtils';
import { getWorker, simplifyMesh } from '@/components/mesh/SimplifyWorker';

export default function MeshDecimator() {
  const [file, setFile] = useState(null);
  const [rawFile, setRawFile] = useState(null); // original File object for WASM
  const [meshData, setMeshData] = useState(null);
  const [decimatedData, setDecimatedData] = useState(null);
  const [quality, setQuality] = useState(50);
  const [outputFormat, setOutputFormat] = useState('stl');
  const [isProcessing, setIsProcessing] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [downloadBlob, setDownloadBlob] = useState(null);
  const logEndRef = useRef(null);

  const addLog = useCallback((text) => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), text }]);
  }, []);

  useEffect(() => {
    getWorker(
      () => { setWasmReady(true); addLog('WASM engine ready.'); },
      (text) => addLog(text),
      (blob) => {
        // Parse the result blob to update the 3D preview
        const reader = new FileReader();
        reader.onloadend = async (e) => {
          const buf = e.target.result;
          const parsed = parseSTL(buf); // WASM always outputs STL binary
          setDecimatedData(parsed);
          setDownloadBlob(blob);
          setIsProcessing(false);
          setShowOriginal(false);
        };
        reader.readAsArrayBuffer(blob);
      },
      (msg) => { addLog('Error: ' + msg); setIsProcessing(false); }
    );
  }, [addLog]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleFileLoaded = useCallback((fileInfo, originalFile) => {
    setFile(fileInfo);
    setRawFile(originalFile);
    let parsed;
    if (fileInfo.type === 'stl') {
      parsed = parseSTL(fileInfo.data);
    } else {
      parsed = parseOBJ(fileInfo.data);
    }
    setMeshData(parsed);
    setDecimatedData(null);
    setDownloadBlob(null);
    setOutputFormat(fileInfo.type);
    setShowOriginal(false);
    setLogs([]);
    addLog(`Loaded: ${fileInfo.name} (${parsed.faces.length.toLocaleString()} triangles, ${parsed.vertices.length.toLocaleString()} vertices)`);
  }, [addLog]);

  const handleClear = useCallback(() => {
    setFile(null);
    setRawFile(null);
    setMeshData(null);
    setDecimatedData(null);
    setDownloadBlob(null);
    setLogs([]);
  }, []);

  const handleDecimate = useCallback(() => {
    if (!rawFile || !wasmReady) return;
    setIsProcessing(true);
    setDecimatedData(null);
    setDownloadBlob(null);
    const ratio = quality / 100;
    addLog(`Starting simplification to ${quality}% quality (ratio: ${ratio.toFixed(2)})…`);
    // Output is always STL from the WASM; we convert on download if user wants OBJ
    simplifyMesh(rawFile, ratio, 'stl');
  }, [rawFile, wasmReady, quality, addLog]);

  const handleDownload = useCallback(() => {
    if (!downloadBlob) return;
    const baseName = file.name.replace(/\.[^.]+$/, '');

    let blobToSave = downloadBlob;
    let filename;

    if (outputFormat === 'obj' && decimatedData) {
      // Convert the WASM STL result back to OBJ
      const text = exportOBJ(decimatedData.vertices, decimatedData.faces);
      blobToSave = new Blob([text], { type: 'text/plain' });
      filename = `${baseName}_simplified.obj`;
    } else {
      filename = `${baseName}_simplified.stl`;
    }

    const url = URL.createObjectURL(blobToSave);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [downloadBlob, decimatedData, outputFormat, file]);

  const previewData = showOriginal ? meshData : (decimatedData || meshData);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Mr Myers Educational Simplifier</h1>
              <p className="text-[10px] text-white/30 uppercase tracking-widest">3D Simplification Tool · Fast Quadric Method</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Circle className={`h-2 w-2 ${wasmReady ? 'text-emerald-400 fill-emerald-400' : 'text-amber-400 fill-amber-400'}`} />
            <span className="text-xs text-white/30">{wasmReady ? 'Engine ready' : 'Loading engine…'}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel */}
          <div className="lg:col-span-4 space-y-6">
            <div>
              <h2 className="text-xs text-white/30 uppercase tracking-widest mb-3 font-medium">Import</h2>
              <FileUploader
                onFileLoaded={handleFileLoaded}
                currentFile={file}
                onClear={handleClear}
              />
            </div>

            {meshData && (
              <>
                <div>
                  <h2 className="text-xs text-white/30 uppercase tracking-widest mb-3 font-medium">Simplification</h2>
                  <QualityControls
                    quality={quality}
                    onQualityChange={setQuality}
                    originalSize={file.size}
                    originalTriangles={meshData.faces.length}
                  />
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleDecimate}
                    disabled={isProcessing || !wasmReady}
                    className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isProcessing ? 'Simplifying…' : !wasmReady ? 'Loading engine…' : 'Simplify Mesh'}
                  </Button>

                  {downloadBlob && (
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-xs text-white/30 uppercase tracking-widest mb-3 font-medium">Export</h2>
                        <Select value={outputFormat} onValueChange={setOutputFormat}>
                          <SelectTrigger className="bg-white/[0.04] border-white/10 text-white h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stl">STL (Binary)</SelectItem>
                            <SelectItem value="obj">OBJ (Text)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={handleDownload}
                        variant="outline"
                        className="w-full h-11 border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-white rounded-xl"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Process Log */}
            {logs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="h-3.5 w-3.5 text-white/30" />
                  <h2 className="text-xs text-white/30 uppercase tracking-widest font-medium">Process Log</h2>
                </div>
                <div className="bg-black/40 border border-white/[0.06] rounded-xl p-4 max-h-52 overflow-y-auto font-mono text-[11px] space-y-1">
                  {logs.map((entry) => (
                    <div key={entry.id} className="text-white/50 leading-relaxed">
                      <span className="text-cyan-500/50 mr-1.5">›</span>
                      {entry.text}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - 3D Preview */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-white/30 uppercase tracking-widest font-medium">Preview</h2>
              {decimatedData && (
                <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5">
                  <button
                    onClick={() => setShowOriginal(false)}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      !showOriginal ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    Simplified ({decimatedData.faces.length.toLocaleString()})
                  </button>
                  <button
                    onClick={() => setShowOriginal(true)}
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      showOriginal ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    Original ({meshData.faces.length.toLocaleString()})
                  </button>
                </div>
              )}
            </div>
            <div className="aspect-[4/3] lg:aspect-auto lg:h-[calc(100vh-12rem)] rounded-2xl border border-white/[0.06] overflow-hidden">
              <ModelPreview
                vertices={previewData?.vertices}
                faces={previewData?.faces}
                isProcessing={isProcessing}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}