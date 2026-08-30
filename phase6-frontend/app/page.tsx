'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, Terminal, Radio, WifiOff } from 'lucide-react';
import Navbar from './components/Navbar';
import ResultsDisplay from './components/ResultsDisplay';
import SecurityScore from './components/SecurityScore';
import ThreatAnalytics from './components/ThreatAnalytics';
import LiveStream, { LiveStatus } from './components/LiveStream';
import AISecurityAnalyst from './components/AISecurityAnalyst';
import { healthCheck } from '../lib/api';
import { AnalysisResponse, HealthResponse } from '../types';

export default function Home() {
  const [result,      setResult]      = useState<AnalysisResponse | null>(null);
  const [health,      setHealth]      = useState<HealthResponse | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [liveStatus,  setLiveStatus]  = useState<LiveStatus>('disconnected');

  // Shared inference state — fed entirely from the live WebSocket stream
  const [history,   setHistory]   = useState<AnalysisResponse[]>([]);
  const [liveStats, setLiveStats] = useState({
    normalCount: 0, ddosCount: 0, portScanCount: 0, vpnExploitCount: 0,
    udpCount: 0, tcpCount: 0, otherProtoCount: 0,
  });

  // Health poll
  useEffect(() => {
    const check = async () => {
      try { const d = await healthCheck(); setHealth(d); setError(null); }
      catch { setHealth(null); }
    };
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, []);

  // Every live packet calls this
  const handleResult = useCallback((data: AnalysisResponse) => {
    setResult(data);
    setHistory(prev => [...prev.slice(-99), data]);  // keep last 100

    setLiveStats(prev => {
      const u = { ...prev };
      const t = data.attack_type.toLowerCase();
      if (data.prediction === 0) {
        u.normalCount += 1;
      } else if (t.includes('ddos')) {
        u.ddosCount += 1;
      } else if (t.includes('scan')) {
        u.portScanCount += 1;
      } else if (t.includes('vpn') || t.includes('exfil') || t.includes('c2')) {
        u.vpnExploitCount += 1;
      } else {
        u.vpnExploitCount += 1;
      }
      const protoRaw = data.features?.protocol ?? ((data as unknown) as Record<string, unknown>).protocol;
      const proto = typeof protoRaw === 'number' ? protoRaw : 0;
      if      (proto === 17) u.udpCount       += 1;
      else if (proto === 6)  u.tcpCount       += 1;
      else if (proto > 0)    u.otherProtoCount += 1;
      // proto === 0 means unknown — don't count it, avoids polluting the pie
      return u;
    });
  }, []);

  const resetStats = () => {
    setLiveStats({ normalCount: 0, ddosCount: 0, portScanCount: 0, vpnExploitCount: 0, udpCount: 0, tcpCount: 0, otherProtoCount: 0 });
    setHistory([]);
    setResult(null);
  };

  // Score: exponentially weighted over full history — changes slowly, not per-packet
  const getSecurityScore = () => {
    if (history.length < 3) return 100;
    // Use all history but weight recent flows more
    const total   = history.length;
    let   wSum    = 0;
    let   wCount  = 0;
    history.forEach((h, i) => {
      const w = Math.pow(1.02, i); // recent packets count slightly more
      wSum   += h.prediction * w;
      wCount += w;
    });
    const weightedThreatRate = wSum / wCount;
    // Map to score — thresholds are realistic for home WiFi
    if (weightedThreatRate > 0.60) return 15;
    if (weightedThreatRate > 0.40) return 35;
    if (weightedThreatRate > 0.20) return 55;
    if (weightedThreatRate > 0.08) return 72;
    if (weightedThreatRate > 0.02) return 85;
    return 96;
  };

  const liveConnected = liveStatus === 'live';

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 relative overflow-x-hidden">
      <div className="cyber-orb-1" />
      <div className="cyber-orb-2" />
      <div className="cyber-orb-3" />
      <div className="cyber-scanline" />

      <Navbar />

      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-6 lg:px-8 py-6 relative z-10 space-y-6">

        {/* Backend offline error */}
        {error && (
          <div className="border border-rose-500/50 rounded-lg p-4 font-mono bg-rose-950/20">
            <div className="flex items-center space-x-3 text-rose-400 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Hero */}
        <div className="tactical-panel rounded-xl p-5 md:p-7 border border-zinc-800 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded bg-zinc-950/80 border border-zinc-800 text-[#00ff87] text-xs font-mono">
                <Terminal className="w-3.5 h-3.5" />
                <span>ARGUS // LIVE NIC CAPTURE → ML INFERENCE → REAL-TIME DASHBOARD</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white uppercase">
                Network Threat Intelligence <br />
                <span className="text-[#00ff87]">Live Packet Analysis</span>
              </h1>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                Real WiFi packets captured from your NIC → 10-feature flow extraction →
                Random Forest ML classification → WebSocket → live dashboard.
              </p>

              {/* 1-Click Terminal Agent Command Box */}
              <div className="pt-2">
                <div className="bg-black/80 border border-emerald-500/40 hover:border-emerald-400 rounded-lg p-3 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg group">
                  <div className="flex items-center space-x-2 overflow-x-auto">
                    <span className="text-emerald-400 font-bold">$</span>
                    <code className="text-slate-200 select-all font-semibold">
                      curl -sSL https://raw.githubusercontent.com/atuljha-tech/Argus/main/argus-agent/agent.py -o agent.py && sudo python3 agent.py
                    </code>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('curl -sSL https://raw.githubusercontent.com/atuljha-tech/Argus/main/argus-agent/agent.py -o agent.py && sudo python3 agent.py');
                      const btn = document.getElementById('copy-cmd-btn');
                      if (btn) btn.innerText = 'COPIED! ✓';
                      setTimeout(() => { if (btn) btn.innerText = 'COPY COMMAND 📋'; }, 2000);
                    }}
                    id="copy-cmd-btn"
                    className="flex-shrink-0 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-[#00ff87] border border-emerald-500/50 rounded font-bold transition-all text-[11px] tracking-wider active:scale-95"
                  >
                    COPY COMMAND 📋
                  </button>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono mt-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Run this single command on any Mac/Linux laptop to stream real WiFi interface packets live.</span>
                </div>
              </div>
            </div>

            {/* Live status HUD */}
            <div className="grid grid-cols-3 gap-3 font-mono">
              <div className="bg-zinc-950/90 p-3 rounded border border-zinc-800">
                <div className="text-[10px] text-zinc-500 uppercase">Backend</div>
                <div className={`text-xs font-bold mt-1 flex items-center gap-1 ${health ? 'text-[#00ff87]' : 'text-zinc-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${health ? 'bg-[#00ff87] animate-ping' : 'bg-zinc-600'}`} />
                  {health ? 'ONLINE' : 'OFFLINE'}
                </div>
              </div>
              <div className="bg-zinc-950/90 p-3 rounded border border-zinc-800">
                <div className="text-[10px] text-zinc-500 uppercase">Stream</div>
                <div className={`text-xs font-bold mt-1 flex items-center gap-1 ${liveConnected ? 'text-[#00ff87]' : 'text-zinc-500'}`}>
                  {liveConnected
                    ? <><Radio className="w-3 h-3 animate-pulse" /> LIVE</>
                    : <><WifiOff className="w-3 h-3" /> OFFLINE</>}
                </div>
              </div>
              <div className="bg-zinc-950/90 p-3 rounded border border-zinc-800">
                <div className="text-[10px] text-zinc-500 uppercase">Flows</div>
                <div className="text-xs font-bold mt-1 text-white">{history.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left: live stream + last result */}
          <div className="lg:col-span-2 space-y-6">
            <LiveStream onPacket={handleResult} onStatusChange={setLiveStatus} />
            <ResultsDisplay result={result} />
          </div>

          {/* Right: security score only — real data driven */}
          <div>
            <SecurityScore score={getSecurityScore()} />
          </div>
        </div>

        {/* Analytics — all real, fed by live stream */}
        <ThreatAnalytics
          history={history}
          liveStats={liveStats}
          onResetStats={resetStats}
        />

        <footer className="mt-12 pt-6 border-t border-zinc-800/80 text-xs text-zinc-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#00ff87]" />
            <span className="font-bold text-zinc-300">ARGUS CYBER INTELLIGENCE PLATFORM</span>
          </div>
          <div>Real NIC · scapy · Random Forest · FastAPI · WebSocket · Next.js</div>
        </footer>
      </main>

      {/* AI Security Analyst — floating, always available */}
      <AISecurityAnalyst history={history} liveStats={liveStats} />
    </div>
  );
}
