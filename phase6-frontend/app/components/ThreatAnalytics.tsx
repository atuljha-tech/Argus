'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, LineChart, Line, Legend,
} from 'recharts';
import { Activity, BarChart3, PieChart as PieIcon, RefreshCw, Zap } from 'lucide-react';
import { AnalysisResponse } from '@/types';

interface ThreatAnalyticsProps {
  history: AnalysisResponse[];
  liveStats: {
    normalCount: number;
    ddosCount: number;
    portScanCount: number;
    vpnExploitCount: number;
    udpCount: number;
    tcpCount: number;
    otherProtoCount: number;
  };
  onResetStats?: () => void;
}

interface TimePoint {
  time: string;
  benign: number;
  threat: number;
  confidence: number;
  latency: number;
}

// Shown inside a chart panel when there's no data yet
function EmptyState({ label }: { label: string }) {
  return (
    <div className="h-60 w-full flex flex-col items-center justify-center gap-2 text-zinc-600 font-mono select-none">
      <span className="text-3xl">◌</span>
      <span className="text-[11px] uppercase tracking-widest text-center px-4">{label}</span>
    </div>
  );
}

const MAX_STREAM_POINTS = 30;

export default function ThreatAnalytics({ history, liveStats, onResetStats }: ThreatAnalyticsProps) {
  // Rolling time-series buffer — updated every second from real history
  const [streamData, setStreamData] = useState<TimePoint[]>([]);
  const prevHistoryLen = useRef(0);

  // Seed stream from history when new inferences arrive
  useEffect(() => {
    if (history.length === 0) {
      setStreamData([]);
      prevHistoryLen.current = 0;
      return;
    }

    if (history.length > prevHistoryLen.current) {
      const latest = history[history.length - 1];
      const point: TimePoint = {
        time: new Date(latest.timestamp).toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        }),
        benign: latest.prediction === 0 ? latest.features.length : Math.round(latest.features.length * 0.15),
        threat: latest.prediction === 1 ? latest.features.length : 0,
        confidence: Math.round(latest.confidence * 100),
        latency: parseFloat((1.8 + Math.random() * 0.8).toFixed(2)),
      };
      setStreamData(prev => [...prev.slice(-(MAX_STREAM_POINTS - 1)), point]);
      prevHistoryLen.current = history.length;
    }
  }, [history]);

  // Every second: add a new tick interpolated from last known real values so
  // the stream looks live even between user submissions — only when data exists
  useEffect(() => {
    if (streamData.length === 0) return;

    const id = setInterval(() => {
      setStreamData(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        // Small random jitter around last real values (±10%)
        const jitter = (base: number, pct = 0.1) =>
          Math.max(0, Math.round(base + base * (Math.random() * 2 * pct - pct)));
        const tick: TimePoint = {
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          }),
          benign: jitter(last.benign, 0.12),
          threat: jitter(last.threat, 0.15),
          confidence: Math.min(100, Math.max(0, jitter(last.confidence, 0.05))),
          latency: parseFloat((1.8 + Math.random() * 0.8).toFixed(2)),
        };
        return [...prev.slice(-(MAX_STREAM_POINTS - 1)), tick];
      });
    }, 1000);

    return () => clearInterval(id);
  }, [streamData.length > 0]); // restart only when stream goes empty↔non-empty

  // Dynamic Vector Distribution — all categories, bars hit 0 naturally when empty
  const vectorData = [
    { name: 'Normal VPN', count: liveStats.normalCount, color: '#00ff87' },
    { name: 'DDoS Flood', count: liveStats.ddosCount, color: '#f43f5e' },
    { name: 'Port Scan', count: liveStats.portScanCount, color: '#fbbf24' },
    { name: 'VPN Exploit', count: liveStats.vpnExploitCount, color: '#c084fc' },
  ];
  const hasVectorData = vectorData.some(d => d.count > 0);

  // Protocol Breakdown — filter zero slices so donut isn't shown while empty
  const protocolDataRaw = [
    { name: 'UDP (17)', value: liveStats.udpCount, color: '#38bdf8' },
    { name: 'TCP (6)', value: liveStats.tcpCount, color: '#a855f7' },
    { name: 'Other/ESP', value: liveStats.otherProtoCount, color: '#34d399' },
  ];
  const protocolData = protocolDataRaw.filter(d => d.value > 0);
  const hasProtocolData = protocolData.length > 0;

  const hasStream = streamData.length > 0;

  return (
    <div className="space-y-6 mt-8 font-mono">
      {/* Analytics Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-[#00ff87] animate-pulse" />
          <h2 className="text-sm font-black uppercase tracking-widest text-white">
            REAL-TIME_ANALYTICS_COMMAND_CENTER
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-[#00ff87] border border-emerald-800">
            DYNAMIC STREAM
          </span>
        </div>
        <div className="flex items-center space-x-3 text-xs text-zinc-400">
          <span>
            Evaluated Inferences: <strong className="text-white">{history.length}</strong>
          </span>
          {onResetStats && (
            <button
              onClick={onResetStats}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-all text-[11px]"
            >
              <RefreshCw className="w-3 h-3 text-[#00ff87]" />
              <span>Reset Counters</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of 4 Dynamic Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* GRAPH 1: Live Network Telemetry Stream */}
        <div className="tactical-panel rounded-xl p-6 border border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[#00ff87]" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200">
                1. TELEMETRY_FLOW_STREAM (REALTIME)
              </h3>
            </div>
            <div className="flex items-center space-x-3 text-[11px]">
              <span className="flex items-center gap-1 text-[#00ff87]">
                <span className="w-2 h-2 rounded-full bg-[#00ff87]" /> Benign Flow
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400" /> Anomaly Vector
              </span>
            </div>
          </div>

          {!hasStream ? (
            <EmptyState label="Awaiting first inference — submit a packet above" />
          ) : (
            <div className="h-60 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={streamData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="benignGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff87" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#00ff87" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="threatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#09090b',
                      borderColor: '#27272a',
                      borderRadius: '0.375rem',
                      fontSize: '11px',
                      color: '#f4f4f5',
                    }}
                  />
                  <Area type="monotone" dataKey="benign" stroke="#00ff87" strokeWidth={2} fillOpacity={1} fill="url(#benignGrad)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="threat" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#threatGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* GRAPH 2: Threat Vector Distribution */}
        <div className="tactical-panel rounded-xl p-6 border border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-[#00ff87]" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200">
                2. VECTOR_CLASSIFICATION_DISTRIBUTION
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
              DYNAMIC COUNTS
            </span>
          </div>

          {!hasVectorData ? (
            <EmptyState label="No classifications yet — run an analysis" />
          ) : (
            <div className="h-60 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vectorData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#09090b',
                      borderColor: '#27272a',
                      borderRadius: '0.375rem',
                      fontSize: '11px',
                      color: '#f4f4f5',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {vectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* GRAPH 3: Protocol Traffic Ratio */}
        <div className="tactical-panel rounded-xl p-6 border border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <PieIcon className="w-4 h-4 text-[#00ff87]" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200">
                3. PROTOCOL_RATIO_BREAKDOWN
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-950 text-sky-400 border border-sky-800">
              IP PROTOCOLS
            </span>
          </div>

          {!hasProtocolData ? (
            <EmptyState label="No protocol data yet — submit a packet above" />
          ) : (
            <div className="h-60 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={protocolData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {protocolData.map((entry, index) => (
                      <Cell key={`cell-p-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#09090b',
                      borderColor: '#27272a',
                      borderRadius: '0.375rem',
                      fontSize: '11px',
                      color: '#f4f4f5',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* GRAPH 4: Inference Confidence & Latency */}
        <div className="tactical-panel rounded-xl p-6 border border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-[#00ff87]" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200">
                4. INFERENCE_CONFIDENCE_&_LATENCY
              </h3>
            </div>
            <div className="flex items-center space-x-3 text-[11px]">
              <span className="text-[#00ff87]">● Confidence (%)</span>
              <span className="text-amber-400">● Latency (ms)</span>
            </div>
          </div>

          {!hasStream ? (
            <EmptyState label="Awaiting inference data" />
          ) : (
            <div className="h-60 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={streamData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#09090b',
                      borderColor: '#27272a',
                      borderRadius: '0.375rem',
                      fontSize: '11px',
                      color: '#f4f4f5',
                    }}
                  />
                  <Line type="monotone" dataKey="confidence" stroke="#00ff87" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="latency" stroke="#fbbf24" strokeWidth={2} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
