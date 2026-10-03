import React, { useCallback, useState } from 'react';
import { Upload, FileBox, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function FileUploader({ onFileLoaded, currentFile, onClear }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((rawFile) => {
    if (!rawFile) return;
    const ext = rawFile.name.split('.').pop().toLowerCase();
    // On iPadOS, STL files may be handed off with a generic MIME type or no
    // recognised extension, so also accept files whose name ends in .stl even
    // if the browser reports an unrecognised MIME type.
    const isSTL = ext === 'stl' || rawFile.type === 'model/stl' || rawFile.type === 'application/sla' || rawFile.type === 'application/vnd.ms-pki.stl';
    const isOBJ = ext === 'obj' || rawFile.type === 'model/obj';
    if (!isSTL && !isOBJ) {
      alert('Please upload an STL or OBJ file.');
      return;
    }
    const resolvedExt = isOBJ ? 'obj' : 'stl';
    const reader = new FileReader();
    reader.onload = (e) => {
      onFileLoaded({
        name: rawFile.name,
        size: rawFile.size,
        type: resolvedExt,
        data: e.target.result,
      }, rawFile);
    };
    if (resolvedExt === 'stl') {
      reader.readAsArrayBuffer(rawFile);
    } else {
      reader.readAsText(rawFile);
    }
  }, [onFileLoaded]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e) => {
    handleFile(e.target.files[0]);
    e.target.value = '';
  };

  if (currentFile) {
    return (
      <div className="relative border border-white/10 bg-white/[0.03] rounded-2xl p-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
          <FileBox className="h-6 w-6 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{currentFile.name}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {(currentFile.size / 1024 / 1024).toFixed(2)} MB · {currentFile.type.toUpperCase()}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="text-white/30 hover:text-white hover:bg-white/10 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer group",
        isDragging
          ? "border-cyan-400 bg-cyan-500/5"
          : "border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04]"
      )}
      onClick={() => document.getElementById('file-input').click()}
    >
      <input
        id="file-input"
        type="file"
        accept="*/*"
        onChange={onInputChange}
        className="hidden"
      />
      <div className={cn(
        "mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300",
        isDragging ? "bg-cyan-500/20" : "bg-white/[0.05] group-hover:bg-white/[0.08]"
      )}>
        <Upload className={cn(
          "h-7 w-7 transition-colors duration-300",
          isDragging ? "text-cyan-400" : "text-white/30 group-hover:text-white/50"
        )} />
      </div>
      <p className="text-sm font-medium text-white/70">
        Drop your 3D file here, or <span className="text-cyan-400">browse</span>
      </p>
      <p className="text-xs text-white/30 mt-2">
        Supports STL and OBJ files
      </p>
    </div>
  );
}