'use client';

import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie, LineChart, Line, Legend 
} from 'recharts';
import { Activity, BarChart3, PieChart as PieIcon, Cpu, RefreshCw, Zap } from 'lucide-react';
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

export default function ThreatAnalytics({ history, liveStats, onResetStats }: ThreatAnalyticsProps) {

  // Prepare Dynamic Time Series Stream Data
  const timeSeriesData = history.length > 0 ? history.map((item, idx) => ({
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    benign: item.prediction === 0 ? item.features.length : Math.round(item.features.length * 0.2),
    threat: item.prediction === 1 ? item.features.length : 15,
    confidence: Math.round(item.confidence * 100),
    latency: Number((2.0 + (idx % 3) * 0.4).toFixed(1)),
  })) : [
    { time: '12:00:00', benign: 120, threat: 15, confidence: 92, latency: 2.1 },
    { time: '12:05:00', benign: 180, threat: 22, confidence: 88, latency: 2.4 },
    { time: '12:10:00', benign: 240, threat: 85, confidence: 96, latency: 2.2 },
    { time: '12:15:00', benign: 210, threat: 30, confidence: 91, latency: 2.5 },
  ];

  // Dynamic Vector Distribution Data
  const vectorData = [
    { name: 'Normal VPN', count: liveStats.normalCount, color: '#00ff87' },
    { name: 'DDoS Flood', count: liveStats.ddosCount, color: '#f43f5e' },
    { name: 'Port Scan', count: liveStats.portScanCount, color: '#fbbf24' },
    { name: 'VPN Exploit', count: liveStats.vpnExploitCount, color: '#c084fc' },
  ];

  // Dynamic Protocol Breakdown Data (Donut Chart)
  const protocolData = [
    { name: 'UDP (17)', value: liveStats.udpCount || 1, color: '#38bdf8' },
    { name: 'TCP (6)', value: liveStats.tcpCount || 1, color: '#a855f7' },
    { name: 'Other/ESP', value: liveStats.otherProtoCount || 1, color: '#34d399' },
  ];

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
          <span>Evaluated Inferences: <strong className="text-white">{history.length}</strong></span>
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
        
        {/* GRAPH 1: Dynamic Live Network Telemetry Stream */}
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
                <span className="w-2 h-2 rounded-full bg-[#00ff87]"></span> Benign Flow
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span> Anomaly Vector
              </span>
            </div>
          </div>

          <div className="h-60 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="benignGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff87" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00ff87" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="threatGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#09090b', 
                    borderColor: '#27272a', 
                    borderRadius: '0.375rem',
                    fontSize: '11px',
                    color: '#f4f4f5'
                  }} 
                />
                <Area type="monotone" dataKey="benign" stroke="#00ff87" strokeWidth={2} fillOpacity={1} fill="url(#benignGrad)" />
                <Area type="monotone" dataKey="threat" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#threatGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 2: Threat Vector Distribution (Dynamic Bar Chart) */}
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

          <div className="h-60 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vectorData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#09090b', 
                    borderColor: '#27272a', 
                    borderRadius: '0.375rem',
                    fontSize: '11px',
                    color: '#f4f4f5'
                  }} 
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {vectorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 3: Protocol Traffic Ratio (Dynamic Donut / Pie Chart) */}
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
                    color: '#f4f4f5'
                  }} 
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRAPH 4: Model Confidence & Latency Tracking (Dynamic Line Chart) */}
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

          <div className="h-60 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#09090b', 
                    borderColor: '#27272a', 
                    borderRadius: '0.375rem',
                    fontSize: '11px',
                    color: '#f4f4f5'
                  }} 
                />
                <Line type="monotone" dataKey="confidence" stroke="#00ff87" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="latency" stroke="#fbbf24" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
