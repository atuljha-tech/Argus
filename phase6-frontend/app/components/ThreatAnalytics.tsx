'use client';

import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { Activity, ShieldAlert, BarChart3, Radio } from 'lucide-react';

const mockTimeSeriesData = [
  { time: '12:00', normal: 120, threats: 14 },
  { time: '12:05', normal: 140, threats: 18 },
  { time: '12:10', normal: 190, threats: 42 },
  { time: '12:15', normal: 170, threats: 25 },
  { time: '12:20', normal: 220, threats: 60 },
  { time: '12:25', normal: 250, threats: 32 },
  { time: '12:30', normal: 210, threats: 15 },
];

const mockDistributionData = [
  { name: 'Normal VPN', count: 450, color: '#10b981' },
  { name: 'DDoS Traffic', count: 180, color: '#f43f5e' },
  { name: 'Port Scan', count: 120, color: '#f59e0b' },
  { name: 'VPN Exploit', count: 65, color: '#a855f7' },
];

export default function ThreatAnalytics() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
      {/* Time Series Area Chart */}
      <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Live Network Telemetry Flow
            </h3>
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Normal Traffic
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span> Detected Anomalies
            </span>
          </div>
        </div>

        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockTimeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="normalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="threatGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  borderColor: '#334155', 
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  color: '#f8fafc'
                }} 
              />
              <Area type="monotone" dataKey="normal" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#normalGradient)" />
              <Area type="monotone" dataKey="threats" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#threatGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Threat Category Bar Chart */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Threat Vector Distribution
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
            24h Window
          </span>
        </div>

        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockDistributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  borderColor: '#334155', 
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  color: '#f8fafc'
                }} 
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {mockDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
