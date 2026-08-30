'use client';

import { Shield, Cpu, Radio, Lock, Terminal } from 'lucide-react';
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
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/90 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Tactical Branding */}
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 text-emerald-400 shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-black font-mono tracking-widest text-white uppercase">
                  ARGUS<span className="text-[#00ff87]">//</span>DEFENSE
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 rounded uppercase">
                  ENTERPRISE SOC
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono hidden sm:block tracking-tight">
                High-Assurance VPN Assessment & AI Attack Forecasting System
              </p>
            </div>
          </div>

          {/* Telemetry & Status Badges */}
          <div className="flex items-center space-x-3 sm:space-x-4 font-mono text-xs">
            {/* UTC Clock */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
              <Radio className="w-3.5 h-3.5 text-[#00ff87] animate-pulse" />
              <span>{time || 'TELEMETRY LIVE'}</span>
            </div>

            {/* AI Engine Status */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
              <Cpu className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline text-zinc-300 font-medium">DecisionTree v1.0</span>
            </div>

            {/* Tactical Status Pill */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded bg-emerald-950/80 border border-emerald-600/60 text-emerald-400 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff87] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff87]"></span>
              </span>
              <span>SYSTEM ON-LINE</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}


