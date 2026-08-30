'use client';

import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { Activity, BarChart3 } from 'lucide-react';

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
  { name: 'Normal VPN', count: 450, color: '#00ff87' },
  { name: 'DDoS Flood', count: 180, color: '#f43f5e' },
  { name: 'Port Scan', count: 120, color: '#fbbf24' },
  { name: 'VPN Exploit', count: 65, color: '#c084fc' },
];

export default function ThreatAnalytics() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8 font-mono">
      {/* Time Series Area Chart */}
      <div className="lg:col-span-2 tactical-panel rounded-xl p-6 border border-zinc-800 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-[#00ff87]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200">
              NETWORK_TELEMETRY_STREAM
            </h3>
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <span className="flex items-center gap-1.5 text-[#00ff87]">
              <span className="w-2 h-2 rounded-full bg-[#00ff87]"></span> Benign Flow
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span> Threat Anomaly
            </span>
          </div>
        </div>

        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockTimeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="normalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff87" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#00ff87" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="threatGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#52525b" fontSize={11} tickLine={false} />
              <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#09090b', 
                  borderColor: '#27272a', 
                  borderRadius: '0.375rem',
                  fontSize: '12px',
                  color: '#f4f4f5'
                }} 
              />
              <Area type="monotone" dataKey="normal" stroke="#00ff87" strokeWidth={2} fillOpacity={1} fill="url(#normalGradient)" />
              <Area type="monotone" dataKey="threats" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#threatGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Threat Distribution Bar Chart */}
      <div className="tactical-panel rounded-xl p-6 border border-zinc-800 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-[#00ff87]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200">
              VECTOR_DISTRIBUTION
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
            24H
          </span>
        </div>

        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockDistributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
              <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#09090b', 
                  borderColor: '#27272a', 
                  borderRadius: '0.375rem',
                  fontSize: '12px',
                  color: '#f4f4f5'
                }} 
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
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
