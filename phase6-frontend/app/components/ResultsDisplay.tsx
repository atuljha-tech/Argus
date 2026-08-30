'use client';

import { AlertTriangle, CheckCircle2, Shield, Zap, Clock, Terminal, Activity, Lock } from 'lucide-react';
import { AnalysisResponse } from '@/types';

interface ResultsDisplayProps {
  result: AnalysisResponse | null;
}

export default function ResultsDisplay({ result }: ResultsDisplayProps) {
  if (!result) {
    return (
      <div className="tactical-panel rounded-xl p-10 text-center border border-dashed border-zinc-800 relative overflow-hidden font-mono">
        <div className="relative z-10 max-w-sm mx-auto">
          <div className="w-14 h-14 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-600 shadow-inner">
            <Shield className="w-7 h-7 text-zinc-500" />
          </div>
          <h4 className="text-sm font-bold text-zinc-300 mb-1 uppercase tracking-wider">AWAITING_TRAFFIC_VECTOR</h4>
          <p className="text-xs text-zinc-500">
            Execute model inference above to view classified threat matrix outputs and actionable countermeasures.
          </p>
        </div>
      </div>
    );
  }

  const getRiskDetails = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return {
          bannerBg: 'bg-rose-950/50 border-rose-500/50',
          textColor: 'text-rose-400',
          badgeBg: 'bg-rose-950 text-rose-300 border-rose-600/50',
          progressBg: 'bg-rose-500',
          icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
          title: 'CRITICAL THREAT DETECTED'
        };
      case 'HIGH':
        return {
          bannerBg: 'bg-orange-950/50 border-orange-500/50',
          textColor: 'text-orange-400',
          badgeBg: 'bg-orange-950 text-orange-300 border-orange-600/50',
          progressBg: 'bg-orange-500',
          icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
          title: 'HIGH RISK TRAFFIC'
        };
      case 'MEDIUM':
        return {
          bannerBg: 'bg-amber-950/50 border-amber-500/50',
          textColor: 'text-amber-400',
          badgeBg: 'bg-amber-950 text-amber-300 border-amber-600/50',
          progressBg: 'bg-amber-400',
          icon: <Zap className="w-5 h-5 text-amber-400" />,
          title: 'SUSPICIOUS PATTERN'
        };
      default:
        return {
          bannerBg: 'bg-emerald-950/50 border-emerald-500/50',
          textColor: 'text-[#00ff87]',
          badgeBg: 'bg-emerald-950 text-[#00ff87] border-emerald-600/50',
          progressBg: 'bg-[#00ff87]',
          icon: <CheckCircle2 className="w-5 h-5 text-[#00ff87]" />,
          title: 'BENIGN / NORMAL TRAFFIC'
        };
    }
  };

  const risk = getRiskDetails(result.risk_level);

  return (
    <div className="tactical-panel rounded-xl p-6 md:p-8 shadow-2xl relative overflow-hidden border border-zinc-800 font-mono">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-[#00ff87]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">
            INFERENCE_TELEMETRY_REPORT
          </h3>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400 bg-zinc-950 px-3 py-1 rounded border border-zinc-800">
          <Clock className="w-3.5 h-3.5 text-[#00ff87]" />
          <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Main Alert Banner */}
      <div className={`p-4 sm:p-5 rounded border ${risk.bannerBg} mb-6 transition-all`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded bg-black border border-zinc-800">
              {risk.icon}
            </div>
            <div>
              <div className="text-[10px] tracking-widest text-zinc-400 uppercase">
                CLASSIFICATION_OUTPUT
              </div>
              <h4 className="text-base sm:text-lg font-black text-white tracking-wider flex items-center gap-2">
                {result.attack_type.toUpperCase()}
                <span className={`text-[10px] px-2 py-0.5 rounded border ${risk.badgeBg}`}>
                  {result.risk_level}
                </span>
              </h4>
            </div>
          </div>

          {/* Confidence Meter */}
          <div className="bg-black p-3 rounded border border-zinc-800 sm:w-48">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-zinc-400">Confidence</span>
              <span className={`font-bold ${risk.textColor}`}>{(result.confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full ${risk.progressBg} transition-all duration-700`}
                style={{ width: `${result.confidence * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="mb-6">
        <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#00ff87]" />
          EVALUATED_PACKET_TELEMETRY
        </h5>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Source Port</span>
            <div className="text-sm font-bold text-white mt-0.5">{result.features.src_port}</div>
          </div>
          <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Dst Port</span>
            <div className="text-sm font-bold text-white mt-0.5">{result.features.dst_port}</div>
          </div>
          <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Protocol</span>
            <div className="text-sm font-bold text-[#00ff87] mt-0.5">
              {result.features.protocol} ({result.features.protocol === 17 ? 'UDP' : result.features.protocol === 6 ? 'TCP' : result.features.protocol === 50 ? 'ESP' : 'IP'})
            </div>
          </div>
          <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Length</span>
            <div className="text-sm font-bold text-white mt-0.5">{result.features.length} B</div>
          </div>
        </div>
      </div>

      {/* Action Recommendations */}
      {result.recommendations && result.recommendations.length > 0 && (
        <div className="bg-zinc-950 rounded p-4 border border-zinc-800">
          <div className="text-xs font-bold tracking-widest text-zinc-300 uppercase mb-2.5 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#00ff87]" />
            RECOMMENDED_COUNTERMEASURES
          </div>
          <ul className="space-y-1.5">
            {result.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start space-x-2 text-xs text-zinc-300">
                <span className="text-[#00ff87] font-bold">›</span>
                <span className="leading-relaxed font-medium">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


