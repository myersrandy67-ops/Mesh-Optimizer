import React from 'react';
import { Slider } from "@/components/ui/slider";
import { Gauge, HardDrive, Triangle, ArrowDown } from 'lucide-react';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function QualityControls({ quality, onQualityChange, originalSize, originalTriangles }) {
  const ratio = quality / 100;
  const estimatedTriangles = Math.max(4, Math.round(originalTriangles * ratio));
  const estimatedSize = Math.max(100, Math.round(originalSize * ratio));
  const reduction = ((1 - ratio) * 100).toFixed(0);

  return (
    <div className="space-y-6">
      {/* Slider */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-white/80">Quality</span>
          </div>
          <span className="text-sm font-mono text-cyan-400">{quality}%</span>
        </div>
        <Slider
          value={[quality]}
          onValueChange={(v) => onQualityChange(v[0])}
          min={1}
          max={100}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-white/20 uppercase tracking-wider">Maximum reduction</span>
          <span className="text-[10px] text-white/20 uppercase tracking-wider">Original quality</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Triangle className="h-3 w-3 text-white/30" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Triangles</span>
          </div>
          <p className="text-lg font-semibold text-white font-mono">
            {estimatedTriangles.toLocaleString()}
          </p>
          <p className="text-[10px] text-white/20 mt-0.5">
            from {originalTriangles.toLocaleString()}
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <HardDrive className="h-3 w-3 text-white/30" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Est. Size</span>
          </div>
          <p className="text-lg font-semibold text-white font-mono">
            {formatSize(estimatedSize)}
          </p>
          <p className="text-[10px] text-white/20 mt-0.5">
            from {formatSize(originalSize)}
          </p>
        </div>

        <div className="col-span-2 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border border-cyan-500/10 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDown className="h-4 w-4 text-cyan-400" />
            <span className="text-sm text-white/60">Size reduction</span>
          </div>
          <span className="text-2xl font-bold text-cyan-400 font-mono">{reduction}%</span>
        </div>
      </div>
    </div>
  );
}