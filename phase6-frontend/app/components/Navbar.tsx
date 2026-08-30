'use client';

import { Shield, Activity, Cpu, Radio, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#090d16]/80 border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-wider bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  ARGUS
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider text-cyan-300 bg-cyan-950/80 border border-cyan-800/50 rounded-full uppercase">
                  v1.0 SOC
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Unified Cyber Defense & Attack Forecasting System
              </p>
            </div>
          </div>

          {/* Telemetry & Badges */}
          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Live Clock */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>{time || 'LIVE TELEMETRY'}</span>
            </div>

            {/* AI Engine Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/50 text-xs text-indigo-300">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline font-medium">DecisionTree ML Engine</span>
            </div>

            {/* Live Status Indicator */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/50 text-xs font-medium text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>DEFENSE ACTIVE</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

