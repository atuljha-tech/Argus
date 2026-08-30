'use client';

import { Shield, Cpu, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://argus-backend-kbg6.onrender.com/api/v1';

export default function Navbar() {
  const [time,      setTime]      = useState('');
  const [modelName, setModelName] = useState('');

  useEffect(() => {
    // Clock — 24h, client-only to avoid hydration mismatch
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour12: false }) + ' UTC');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Fetch real model name from backend
    fetch(`${API}/model-info`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.model_name) setModelName(d.model_name); })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/90 border-b border-zinc-800">
      <div className="max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 text-emerald-400 shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-black font-mono tracking-widest text-white uppercase">
                  ARGUS<span className="text-[#00ff87]">{'//'}</span>DEFENSE
                </span>
                <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 rounded uppercase">
                  LIVE SOC
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono hidden sm:block tracking-tight">
                Real-Time NIC Capture · ML Threat Classification · AI Analysis
              </p>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center space-x-2 sm:space-x-3 font-mono text-xs">

            {/* Clock */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
              <Radio className="w-3.5 h-3.5 text-[#00ff87] animate-pulse" />
              <span>{time || '——:——:—— UTC'}</span>
            </div>

            {/* Real model name — fetched from backend */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
              <Cpu className="w-3.5 h-3.5 text-[#00ff87]" />
              <span className="hidden sm:inline text-zinc-300 font-medium">
                {modelName || 'ML Engine'}
              </span>
            </div>

            {/* Live indicator */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded bg-emerald-950/80 border border-emerald-600/60 text-emerald-400 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff87] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff87]" />
              </span>
              <span className="hidden sm:inline">SYSTEM ONLINE</span>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
