'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Activity, Server, AlertTriangle,
  Terminal, Lock, Cpu, Radio, Wifi, WifiOff, ToggleLeft, ToggleRight,
} from 'lucide-react';
import Navbar from './components/Navbar';
import PredictionForm from './components/PredictionForm';
import ResultsDisplay from './components/ResultsDisplay';
import SecurityScore from './components/SecurityScore';
import ThreatAnalytics from './components/ThreatAnalytics';
import LiveStream, { LiveStatus } from './components/LiveStream';
import { healthCheck, analyze } from '../lib/api';
import { AnalysisResponse, HealthResponse } from '../types';

export default function Home() {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<AnalysisResponse | null>(null);
  const [health, setHealth]     = useState<HealthResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);

  // ── Mode toggle: 'live' = WebSocket stream from agent | 'manual' = form ──
  const [mode, setMode] = useState<'live' | 'manual'>('live');
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('disconnected');

  // ── Shared inference history & live stats (fed by BOTH modes) ─────────────
  const [history, setHistory] = useState<AnalysisResponse[]>([]);
  const [liveStats, setLiveStats] = useState({
    normalCount:    0,
    ddosCount:      0,
    portScanCount:  0,
    vpnExploitCount: 0,
    udpCount:       0,
    tcpCount:       0,
    otherProtoCount: 0,
  });

  // ── Health-check polling ──────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const data = await healthCheck();
        setHealth(data);
        setError(null);
      } catch {
        setHealth(null);
        setError('FastAPI backend offline — unable to reach inference API.');
      }
    };
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, []);

  // ── Shared handler: called whenever any inference result arrives ───────────
  const handleResult = useCallback((data: AnalysisResponse) => {
    setResult(data);
    setHistory(prev => [...prev.slice(-49), data]);   // keep last 50

    setLiveStats(prev => {
      const u = { ...prev };
      if (data.prediction === 0) {
        u.normalCount += 1;
      } else {
        const t = data.attack_type.toLowerCase();
        if (t.includes('ddos'))       u.ddosCount      += 1;
        else if (t.includes('scan'))  u.portScanCount  += 1;
        else                          u.vpnExploitCount += 1;
      }
      const proto = data.features.protocol;
      if (proto === 17)      u.udpCount       += 1;
      else if (proto === 6)  u.tcpCount       += 1;
      else                   u.otherProtoCount += 1;
      return u;
    });
  }, []);

  // ── Manual form submission ────────────────────────────────────────────────
  const handlePredict = async (features: {
    src_port: number; dst_port: number; protocol: number; length: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyze(features);
      handleResult(data);
    } catch {
      setError('Analysis error: unable to connect to backend inference endpoint.');
    } finally {
      setLoading(false);
    }
  };

  const resetStats = () => {
    setLiveStats({ normalCount: 0, ddosCount: 0, portScanCount: 0, vpnExploitCount: 0, udpCount: 0, tcpCount: 0, otherProtoCount: 0 });
    setHistory([]);
  };

  const getSecurityScore = () => {
    if (!result) return 88;
    return result.risk_level === 'CRITICAL' ? 20 :
           result.risk_level === 'HIGH'     ? 40 :
           result.risk_level === 'MEDIUM'   ? 65 : 95;
  };

  const liveConnected = liveStatus === 'live';

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 bg-animated-cyber-blue bg-tactical-grid relative overflow-x-hidden">
      <div className="cyber-orb-1" />
      <div className="cyber-orb-2" />
      <div className="cyber-orb-3" />
      <div className="cyber-scanline" />

      <Navbar />

      <main className="w-full max-w-[98%] mx-auto px-3 sm:px-6 lg:px-8 py-6 relative z-10 space-y-6">

        {/* Error banner */}
        {error && (
          <div className="tactical-panel border border-rose-500/50 rounded-lg p-4 animate-pulse font-mono">
            <div className="flex items-center space-x-3 text-rose-400 text-xs sm:text-sm font-bold">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Hero header */}
        <div className="tactical-panel rounded-xl p-5 md:p-7 border border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded bg-zinc-950/80 border border-zinc-800 text-[#00ff87] text-xs font-mono">
                <Terminal className="w-3.5 h-3.5" />
                <span>TACTICAL SECURITY COMMAND CENTER // LIVE NIC STREAM</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white uppercase">
                IPsec VPN Assessment &amp; <br />
                <span className="text-[#00ff87]">Predictive Attack Intelligence</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono leading-relaxed">
                Real packets captured from your NIC → ML classification → live dashboard.
                Run <code className="text-[#00ff87]">sudo python3 argus-agent/agent.py</code> on your Mac to start streaming.
              </p>
            </div>

            {/* HUD */}
            <div className="grid grid-cols-2 gap-3 font-mono sm:w-auto">
              <div className="bg-zinc-950/90 p-3.5 rounded border border-zinc-800">
                <div className="text-[10px] text-zinc-500 uppercase">INFERENCE ENGINE</div>
                <div className="text-xs font-bold text-[#00ff87] flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-[#00ff87] animate-ping" />
                  {health ? 'ONLINE' : 'DISCONNECTED'}
                </div>
              </div>
              <div className="bg-zinc-950/90 p-3.5 rounded border border-zinc-800">
                <div className="text-[10px] text-zinc-500 uppercase">AGENT STREAM</div>
                <div className={`text-xs font-bold mt-1 flex items-center gap-1.5 ${liveConnected ? 'text-[#00ff87]' : 'text-zinc-500'}`}>
                  {liveConnected
                    ? <><Radio className="w-3 h-3 animate-pulse" /> LIVE</>
                    : <><WifiOff className="w-3 h-3" /> OFFLINE</>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mode toggle ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 font-mono">
          <span className="text-xs text-zinc-400 uppercase tracking-widest">Input mode:</span>

          <button
            onClick={() => setMode('live')}
            className={`flex items-center gap-2 px-4 py-2 rounded border text-xs font-bold transition-all ${
              mode === 'live'
                ? 'border-emerald-600 bg-emerald-950 text-[#00ff87]'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            LIVE AGENT STREAM
            {liveConnected && <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-ping" />}
          </button>

          <button
            onClick={() => setMode('manual')}
            className={`flex items-center gap-2 px-4 py-2 rounded border text-xs font-bold transition-all ${
              mode === 'manual'
                ? 'border-zinc-500 bg-zinc-800 text-white'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            MANUAL FORM
          </button>

          {mode === 'live' && !liveConnected && (
            <span className="text-[11px] text-amber-400 font-mono">
              ⚠ Run <code className="text-[#00ff87]">sudo python3 argus-agent/agent.py</code> to connect
            </span>
          )}
        </div>

        {/* ── Main workspace grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left: live stream OR manual form + results */}
          <div className="lg:col-span-2 space-y-6">
            {mode === 'live' ? (
              <LiveStream
                onPacket={handleResult}
                onStatusChange={setLiveStatus}
              />
            ) : (
              <PredictionForm onPredict={handlePredict} loading={loading} />
            )}
            <ResultsDisplay result={result} />
          </div>

          {/* Right: security gauge + node info */}
          <div className="space-y-6">
            <SecurityScore score={getSecurityScore()} />

            <div className="tactical-panel rounded-xl p-6 border border-zinc-800 space-y-4 font-mono">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                <Server className="w-4 h-4 text-[#00ff87]" />
                VPN_TESTBED_PARAMETERS
              </h4>
              <div className="space-y-2.5 text-xs">
                {[
                  ['VPN Gateway',      'StrongSwan 5.9',         'text-white'],
                  ['IKE Suite',        'AES-256-GCM',            'text-[#00ff87]'],
                  ['Authentication',   'SHA-256 / PFS',          'text-white'],
                  ['Capture Mode',     mode === 'live' ? 'Real NIC / scapy' : 'Manual Entry', 'text-emerald-400'],
                  ['Telemetry Stream', mode === 'live' && liveConnected ? 'Live WebSocket' : 'Idle', liveConnected ? 'text-emerald-400' : 'text-zinc-500'],
                ].map(([label, value, cls]) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-zinc-800 last:border-0">
                    <span className="text-zinc-500">{label}</span>
                    <span className={`font-bold ${cls}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Analytics section — fed by both modes */}
        <ThreatAnalytics
          history={history}
          liveStats={liveStats}
          onResetStats={resetStats}
        />

        <footer className="mt-12 pt-6 border-t border-zinc-800/80 text-center text-xs text-zinc-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#00ff87]" />
            <span className="font-bold text-zinc-300">ARGUS ENTERPRISE CYBER DEFENSE</span>
          </div>
          <div>Real NIC Capture // FastAPI WebSocket // Next.js Live Stream</div>
          <div className="text-zinc-600">argus-agent · phase5-backend · phase6-frontend</div>
        </footer>
      </main>
    </div>
  );
}
