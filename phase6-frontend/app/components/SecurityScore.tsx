'use client';

import { ShieldCheck, AlertTriangle, ShieldAlert, Gauge, Zap } from 'lucide-react';

interface SecurityScoreProps {
  score: number;
}

export default function SecurityScore({ score }: SecurityScoreProps) {
  // SVG Ring Calculations
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreTheme = (score: number) => {
    if (score >= 80) return {
      color: 'text-[#00ff87]',
      border: 'border-emerald-500/40',
      bg: 'bg-emerald-950/60',
      stroke: 'stroke-[#00ff87]',
      label: 'SECURE_POSTURE',
      icon: <ShieldCheck className="w-4 h-4 text-[#00ff87]" />
    };
    if (score >= 50) return {
      color: 'text-amber-400',
      border: 'border-amber-500/40',
      bg: 'bg-amber-950/60',
      stroke: 'stroke-amber-400',
      label: 'MODERATE_RISK',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />
    };
    return {
      color: 'text-rose-400',
      border: 'border-rose-500/40',
      bg: 'bg-rose-950/60',
      stroke: 'stroke-rose-500',
      label: 'CRITICAL_ALERT',
      icon: <ShieldAlert className="w-4 h-4 text-rose-400" />
    };
  };

  const theme = getScoreTheme(score);

  return (
    <div className="tactical-panel rounded-xl p-6 shadow-2xl relative overflow-hidden border border-zinc-800">
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
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-zinc-800"
            strokeWidth="10"
            fill="transparent"
          />
          <circle
            cx="72"
            cy="72"
            r={radius}
            className={`${theme.stroke} transition-all duration-1000 ease-out`}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="square"
            fill="transparent"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center font-mono">
          <span className="text-3xl font-black text-white tracking-tight">
            {score}
          </span>
          <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
            / 100 POSTURE
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-2.5 mt-4 pt-4 border-t border-zinc-800 font-mono">
        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">MODEL_ENGINE</div>
          <div className="text-xs font-bold text-zinc-200 mt-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-pulse"></span>
            Decision Tree
          </div>
        </div>

        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
          <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">LATENCY</div>
          <div className="text-xs font-bold text-[#00ff87] mt-0.5 flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#00ff87]" />
            &lt; 2.8 ms
          </div>
        </div>
      </div>
    </div>
  );
}


