'use client';

import { ShieldCheck, AlertTriangle, ShieldAlert, Cpu, Gauge, Zap } from 'lucide-react';

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
      color: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      glow: 'glow-emerald',
      stroke: 'stroke-emerald-400',
      label: 'SECURE POSTURE',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />
    };
    if (score >= 50) return {
      color: 'text-amber-400',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      glow: 'glow-amber',
      stroke: 'stroke-amber-400',
      label: 'MODERATE RISK',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />
    };
    return {
      color: 'text-rose-400',
      border: 'border-rose-500/30',
      bg: 'bg-rose-500/10',
      glow: 'glow-rose',
      stroke: 'stroke-rose-500',
      label: 'CRITICAL ALERT',
      icon: <ShieldAlert className="w-4 h-4 text-rose-400" />
    };
  };

  const theme = getScoreTheme(score);

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-2xl relative overflow-hidden border border-slate-800/80">
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Gauge className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Security Index</h3>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider flex items-center space-x-1.5 ${theme.bg} ${theme.border} border ${theme.color}`}>
          {theme.icon}
          <span>{theme.label}</span>
        </div>
      </div>

      {/* SVG Score Circle */}
      <div className="flex items-center justify-center my-4 relative">
        <svg className="w-36 h-36 transform -rotate-90">
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-slate-800"
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
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Center Score Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-black font-mono text-white tracking-tight">
            {score}
          </span>
          <span className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">
            / 100 POSTURE
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800/80">
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Model Status</div>
          <div className="text-xs font-bold text-slate-200 mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Decision Tree
          </div>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Inference Speed</div>
          <div className="text-xs font-bold text-cyan-400 font-mono mt-0.5 flex items-center gap-1">
            <Zap className="w-3 h-3 text-cyan-400" />
            &lt; 3.2 ms
          </div>
        </div>
      </div>
    </div>
  );
}

