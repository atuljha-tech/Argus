'use client';

import { useState } from 'react';
import { Brain, Loader2, Sparkles, Network, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';

interface PredictionFormProps {
  onPredict: (features: {
    src_port: number;
    dst_port: number;
    protocol: number;
    length: number;
  }) => void;
  loading: boolean;
}

export default function PredictionForm({ onPredict, loading }: PredictionFormProps) {
  const [srcPort, setSrcPort] = useState('500');
  const [dstPort, setDstPort] = useState('4500');
  const [protocol, setProtocol] = useState('17');
  const [length, setLength] = useState('120');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (srcPort && dstPort && protocol && length) {
      onPredict({
        src_port: parseInt(srcPort),
        dst_port: parseInt(dstPort),
        protocol: parseInt(protocol),
        length: parseInt(length),
      });
    }
  };

  const applyPreset = (preset: { src: number; dst: number; proto: number; len: number }) => {
    setSrcPort(preset.src.toString());
    setDstPort(preset.dst.toString());
    setProtocol(preset.proto.toString());
    setLength(preset.len.toString());
    onPredict({
      src_port: preset.src,
      dst_port: preset.dst,
      protocol: preset.proto,
      length: preset.len,
    });
  };

  return (
    <div className="glass-panel rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden border border-slate-800/80">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Cyber Traffic Analyzer
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800/50 font-mono">
                Realtime Inference
              </span>
            </h3>
            <p className="text-xs text-slate-400">Input network packet telemetry parameters for ML model risk classification</p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Feature Dim: [4x1]</span>
        </div>
      </div>

      {/* Attack Vector Presets */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Quick Test Vectors (Presets)
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => applyPreset({ src: 500, dst: 4500, proto: 17, len: 120 })}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group"
          >
            <div>
              <div className="text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">Normal VPN</div>
              <div className="text-[10px] text-slate-500 font-mono">UDP:500 len:120</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset({ src: 80, dst: 80, proto: 6, len: 1460 })}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/40 text-left transition-all group"
          >
            <div>
              <div className="text-xs font-semibold text-rose-400 group-hover:text-rose-300">DDoS Flood</div>
              <div className="text-[10px] text-slate-500 font-mono">TCP:80 len:1460</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset({ src: 443, dst: 22, proto: 6, len: 64 })}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-left transition-all group"
          >
            <div>
              <div className="text-xs font-semibold text-amber-400 group-hover:text-amber-300">Port Recon</div>
              <div className="text-[10px] text-slate-500 font-mono">TCP:22 len:64</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset({ src: 500, dst: 500, proto: 17, len: 850 })}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-left transition-all group"
          >
            <div>
              <div className="text-xs font-semibold text-purple-400 group-hover:text-purple-300">VPN Exploit</div>
              <div className="text-[10px] text-slate-500 font-mono">UDP:500 len:850</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"></span>
          </button>
        </div>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Source Port */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Source Port <span className="text-slate-500 font-mono">(src_port)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={srcPort}
                onChange={(e) => setSrcPort(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all"
                placeholder="e.g. 500"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">PORT</span>
            </div>
          </div>

          {/* Destination Port */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Destination Port <span className="text-slate-500 font-mono">(dst_port)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={dstPort}
                onChange={(e) => setDstPort(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all"
                placeholder="e.g. 4500"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">PORT</span>
            </div>
          </div>

          {/* Protocol */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              IP Protocol <span className="text-slate-500 font-mono">(6: TCP, 17: UDP, 50: ESP)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all"
                placeholder="e.g. 17"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                {protocol === '6' ? 'TCP' : protocol === '17' ? 'UDP' : protocol === '50' ? 'ESP' : 'PROTO'}
              </span>
            </div>
          </div>

          {/* Packet Length */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Packet Length <span className="text-slate-500 font-mono">(length in bytes)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all"
                placeholder="e.g. 120"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">BYTES</span>
            </div>
          </div>
        </div>

        {/* Submit CTA */}
        <button
          type="submit"
          disabled={loading}
          className={`mt-6 w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center space-x-2 ${
            loading
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white border border-blue-400/30 shadow-blue-500/20 glow-blue active:scale-[0.99]'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <span>Running ML Model Inference...</span>
            </>
          ) : (
            <>
              <Network className="w-4 h-4 text-cyan-300" />
              <span>ANALYZE TRAFFIC VECTOR</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

