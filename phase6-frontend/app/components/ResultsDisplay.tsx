'use client';

import { AlertTriangle, CheckCircle2, Shield, Zap, Clock, Terminal, Activity, ArrowUpRight, Lock } from 'lucide-react';
import { AnalysisResponse } from '@/types';

interface ResultsDisplayProps {
  result: AnalysisResponse | null;
}

export default function ResultsDisplay({ result }: ResultsDisplayProps) {
  if (!result) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center border border-dashed border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-cyber-grid opacity-30"></div>
        <div className="relative z-10 max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-600 shadow-inner">
            <Shield className="w-8 h-8 text-slate-500" />
          </div>
          <h4 className="text-base font-semibold text-slate-300 mb-1">Awaiting Traffic Vector</h4>
          <p className="text-xs text-slate-500">
            Submit packet attributes above or click one of the quick test vector presets to generate real-time AI security analysis.
          </p>
        </div>
      </div>
    );
  }

  const getRiskDetails = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return {
          bannerBg: 'bg-rose-950/40 border-rose-500/40',
          textColor: 'text-rose-400',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          progressBg: 'bg-rose-500',
          glow: 'glow-rose',
          icon: <AlertTriangle className="w-6 h-6 text-rose-400" />,
          title: 'CRITICAL THREAT DETECTED'
        };
      case 'HIGH':
        return {
          bannerBg: 'bg-orange-950/40 border-orange-500/40',
          textColor: 'text-orange-400',
          badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
          progressBg: 'bg-orange-500',
          glow: 'glow-orange',
          icon: <AlertTriangle className="w-6 h-6 text-orange-400" />,
          title: 'HIGH RISK TRAFFIC'
        };
      case 'MEDIUM':
        return {
          bannerBg: 'bg-amber-950/40 border-amber-500/40',
          textColor: 'text-amber-400',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          progressBg: 'bg-amber-500',
          glow: 'glow-amber',
          icon: <Zap className="w-6 h-6 text-amber-400" />,
          title: 'SUSPICIOUS TRAFFIC PATTERN'
        };
      default:
        return {
          bannerBg: 'bg-emerald-950/40 border-emerald-500/40',
          textColor: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          progressBg: 'bg-emerald-500',
          glow: 'glow-emerald',
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
          title: 'BENIGN / NORMAL TRAFFIC'
        };
    }
  };

  const risk = getRiskDetails(result.risk_level);

  return (
    <div className="glass-panel rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden border border-slate-800/80">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Inference Telemetry Report
          </h3>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Main Alert Banner */}
      <div className={`p-5 rounded-2xl border ${risk.bannerBg} ${risk.glow} mb-6 transition-all`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              {risk.icon}
            </div>
            <div>
              <div className="text-xs font-mono tracking-widest text-slate-400 uppercase">
                Classification Output
              </div>
              <h4 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                {result.attack_type.toUpperCase()}
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${risk.badgeBg}`}>
                  {result.risk_level}
                </span>
              </h4>
            </div>
          </div>

          {/* Confidence Meter */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 sm:w-48">
            <div className="flex justify-between items-center text-xs font-mono mb-1">
              <span className="text-slate-400">Confidence</span>
              <span className={`font-bold ${risk.textColor}`}>{(result.confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className={`h-full ${risk.progressBg} transition-all duration-700`}
                style={{ width: `${result.confidence * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Extracted Vector Features Grid */}
      <div className="mb-6">
        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          Evaluated Packet Telemetry
        </h5>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Source Port</span>
            <div className="text-sm font-bold text-white font-mono mt-0.5">{result.features.src_port}</div>
          </div>
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Destination Port</span>
            <div className="text-sm font-bold text-white font-mono mt-0.5">{result.features.dst_port}</div>
          </div>
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Protocol ID</span>
            <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
              {result.features.protocol} ({result.features.protocol === 17 ? 'UDP' : result.features.protocol === 6 ? 'TCP' : 'IP'})
            </div>
          </div>
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Packet Length</span>
            <div className="text-sm font-bold text-white font-mono mt-0.5">{result.features.length} Bytes</div>
          </div>
        </div>
      </div>

      {/* Security Action Recommendations */}
      {result.recommendations && result.recommendations.length > 0 && (
        <div className="bg-slate-950/70 rounded-xl p-5 border border-slate-800">
          <div className="text-xs font-bold tracking-wider text-slate-300 uppercase mb-3 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            Recommended Countermeasures
          </div>
          <ul className="space-y-2">
            {result.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start space-x-2.5 text-xs text-slate-300">
                <span className="text-cyan-400 font-mono mt-0.5">›</span>
                <span className="leading-relaxed font-medium">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

