'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, Gauge, Zap, Cpu, Database } from 'lucide-react';

interface SecurityScoreProps {
  score: number;
}

interface ModelInfo {
  model_name:   string;
  n_features:   number;
  accuracy:     number | null;
  trained_on:   string | null;
  n_samples:    number | null;
  attack_types: string[];
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://argus-backend-kbg6.onrender.com/api/v1';

export default function SecurityScore({ score }: SecurityScoreProps) {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [latency,   setLatency]   = useState<number | null>(null);

  // Fetch model-info once on mount, then refresh every 60 s
  useEffect(() => {
    const fetchInfo = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch(`${API}/model-info`);
        const ms  = performance.now() - t0;
        if (res.ok) {
          const data = await res.json();
          setModelInfo(data);
          setLatency(Math.round(ms));
        }
      } catch { /* backend offline — keep previous value */ }
    };
    fetchInfo();
    const id = setInterval(fetchInfo, 60_000);
    return () => clearInterval(id);
  }, []);

  // SVG ring
  const radius        = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset    = circumference - (score / 100) * circumference;

  const theme = score >= 80
    ? { color: 'text-[#00ff87]', border: 'border-emerald-500/40', bg: 'bg-emerald-950/60', stroke: 'stroke-[#00ff87]', label: 'SECURE_POSTURE',  icon: <ShieldCheck  className="w-4 h-4 text-[#00ff87]" /> }
    : score >= 50
    ? { color: 'text-amber-400',  border: 'border-amber-500/40',   bg: 'bg-amber-950/60',   stroke: 'stroke-amber-400',   label: 'MODERATE_RISK',   icon: <AlertTriangle className="w-4 h-4 text-amber-400" /> }
    : { color: 'text-rose-400',   border: 'border-rose-500/40',    bg: 'bg-rose-950/60',    stroke: 'stroke-rose-500',    label: 'CRITICAL_ALERT',  icon: <ShieldAlert   className="w-4 h-4 text-rose-400"  /> };

  const trainedDate = modelInfo?.trained_on
    ? new Date(modelInfo.trained_on).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="tactical-panel rounded-xl p-6 shadow-2xl relative overflow-hidden border border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 font-mono">
        <div className="flex items-center space-x-2">
          <Gauge className="w-4 h-4 text-[#00ff87]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">SYSTEM_SECURITY_INDEX</h3>
        </div>
        <div className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider flex items-center space-x-1.5 ${theme.bg} ${theme.border} border ${theme.color}`}>
          {theme.icon}
          <span>{theme.label}</span>
        </div>
      </div>

      {/* SVG Score Ring */}
      <div className="flex items-center justify-center my-4 relative font-mono">
        <svg className="w-36 h-36 transform -rotate-90">
          <circle cx="72" cy="72" r={radius} className="stroke-zinc-800" strokeWidth="10" fill="transparent" />
          <circle
            cx="72" cy="72" r={radius}
            className={`${theme.stroke} transition-all duration-1000 ease-out`}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="square"
            fill="transparent"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center font-mono">
          <span className="text-3xl font-black text-white tracking-tight">{score}</span>
          <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">/ 100 POSTURE</span>
        </div>
      </div>

      {/* Metric Cards — all real, from /model-info */}
      <div className="grid grid-cols-2 gap-2.5 mt-4 pt-4 border-t border-zinc-800 font-mono">
        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5" /> MODEL
          </div>
          <div className="text-xs font-bold text-zinc-200 mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-pulse" />
            {modelInfo?.model_name ?? '…'}
          </div>
        </div>

        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" /> LATENCY
          </div>
          <div className="text-xs font-bold text-[#00ff87] mt-0.5">
            {latency !== null ? `${latency} ms` : '…'}
          </div>
        </div>

        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider flex items-center gap-1">
            <Database className="w-2.5 h-2.5" /> ACCURACY
          </div>
          <div className="text-xs font-bold text-zinc-200 mt-0.5">
            {modelInfo?.accuracy != null
              ? `${(modelInfo.accuracy * 100).toFixed(1)}%`
              : '—'}
          </div>
        </div>

        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">FEATURES</div>
          <div className="text-xs font-bold text-zinc-200 mt-0.5">
            {modelInfo?.n_features ?? '—'}
          </div>
        </div>
      </div>

      {/* Training provenance */}
      {trainedDate && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60 text-[10px] text-zinc-600 font-mono flex justify-between">
          <span>Trained on real traffic</span>
          <span className="text-zinc-500">{trainedDate}</span>
        </div>
      )}

      {/* Attack types the model knows */}
      {modelInfo?.attack_types && modelInfo.attack_types.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {modelInfo.attack_types.map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
