'use client';

import { useState } from 'react';
import { Brain, Loader2, Sparkles, Network, ArrowRight, Terminal, Cpu } from 'lucide-react';

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
    <div className="tactical-panel rounded-xl p-6 md:p-8 shadow-2xl relative overflow-hidden border border-zinc-800">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-emerald-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold font-mono text-white flex items-center gap-2 uppercase tracking-wide">
              TRAFFIC_VECTOR_EVALUATOR
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-emerald-400 border border-emerald-800 font-mono">
                ML INFERENCE
              </span>
            </h3>
            <p className="text-xs text-zinc-400 font-mono">Input network packet telemetry parameters for ML model risk classification</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400 bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span>DIM: [4x1]</span>
        </div>
      </div>

      {/* Preset Vectors */}
      <div className="mb-6">
        <label className="block text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          TEST VECTOR PRESETS
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => applyPreset({ src: 500, dst: 4500, proto: 17, len: 120 })}
            className="flex items-center justify-between px-3 py-2.5 rounded bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500/60 text-left transition-all group font-mono"
          >
            <div>
              <div className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300">BENIGN VPN</div>
              <div className="text-[10px] text-zinc-500">UDP:500 len:120</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset({ src: 80, dst: 80, proto: 6, len: 1460 })}
            className="flex items-center justify-between px-3 py-2.5 rounded bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-rose-500/60 text-left transition-all group font-mono"
          >
            <div>
              <div className="text-xs font-bold text-rose-400 group-hover:text-rose-300">DDoS ATTACK</div>
              <div className="text-[10px] text-zinc-500">TCP:80 len:1460</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset({ src: 443, dst: 22, proto: 6, len: 64 })}
            className="flex items-center justify-between px-3 py-2.5 rounded bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/60 text-left transition-all group font-mono"
          >
            <div>
              <div className="text-xs font-bold text-amber-400 group-hover:text-amber-300">PORT SCAN</div>
              <div className="text-[10px] text-zinc-500">TCP:22 len:64</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
          </button>

          <button
            type="button"
            onClick={() => applyPreset({ src: 500, dst: 500, proto: 17, len: 850 })}
            className="flex items-center justify-between px-3 py-2.5 rounded bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-purple-500/60 text-left transition-all group font-mono"
          >
            <div>
              <div className="text-xs font-bold text-purple-400 group-hover:text-purple-300">VPN EXPLOIT</div>
              <div className="text-[10px] text-zinc-500">UDP:500 len:850</div>
            </div>
            <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50"></span>
          </button>
        </div>
      </div>

      {/* Form Fields */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-300 uppercase">
              Source Port <span className="text-zinc-500">(src_port)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={srcPort}
                onChange={(e) => setSrcPort(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-2.5 text-sm text-white font-mono placeholder-zinc-700 focus:border-emerald-400 focus:outline-none transition-all"
                placeholder="500"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-zinc-500">PORT</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-300 uppercase">
              Destination Port <span className="text-zinc-500">(dst_port)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={dstPort}
                onChange={(e) => setDstPort(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-2.5 text-sm text-white font-mono placeholder-zinc-700 focus:border-emerald-400 focus:outline-none transition-all"
                placeholder="4500"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-zinc-500">PORT</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-300 uppercase">
              Protocol ID <span className="text-zinc-500">(6: TCP, 17: UDP)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-2.5 text-sm text-white font-mono placeholder-zinc-700 focus:border-emerald-400 focus:outline-none transition-all"
                placeholder="17"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-zinc-500">
                {protocol === '6' ? 'TCP' : protocol === '17' ? 'UDP' : 'PROTO'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-300 uppercase">
              Packet Length <span className="text-zinc-500">(bytes)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-2.5 text-sm text-white font-mono placeholder-zinc-700 focus:border-emerald-400 focus:outline-none transition-all"
                placeholder="120"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-zinc-500">BYTES</span>
            </div>
          </div>
        </div>

        {/* Action CTA Button */}
        <button
          type="submit"
          disabled={loading}
          className={`mt-6 w-full py-3.5 px-6 rounded font-mono font-bold text-sm tracking-widest uppercase transition-all shadow-lg flex items-center justify-center space-x-2 ${
            loading
              ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800'
              : 'bg-zinc-900 hover:bg-emerald-950 text-white hover:text-emerald-400 border border-zinc-700 hover:border-emerald-500 shadow-emerald-500/20 active:scale-[0.99]'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span>EXECUTING_MODEL_INFERENCE...</span>
            </>
          ) : (
            <>
              <Network className="w-4 h-4 text-emerald-400" />
              <span>EVALUATE_TRAFFIC_VECTOR</span>
              <ArrowRight className="w-4 h-4 text-emerald-400 ml-1" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}


