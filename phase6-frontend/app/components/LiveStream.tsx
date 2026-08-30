'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Wifi, WifiOff, Radio, Shield, AlertTriangle, Activity, Cpu } from 'lucide-react';
import { AnalysisResponse } from '@/types';

const WS_URL =
  (process.env.NEXT_PUBLIC_API_URL || 'https://argus-backend-kbg6.onrender.com/api/v1')
    .replace(/^http/, 'ws')          // http→ws, https→wss
    .replace(/\/api\/v1\/?$/, '')    // strip path — we append /api/v1/ws below
  + '/api/v1/ws';

export type LiveStatus = 'connecting' | 'live' | 'disconnected' | 'error';

interface LiveStreamProps {
  onPacket: (result: AnalysisResponse) => void;
  onStatusChange: (s: LiveStatus) => void;
}

// ── small status badge ────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LiveStatus }) {
  const cfg = {
    connecting:   { color: 'text-amber-400 border-amber-800 bg-amber-950',  icon: <Activity className="w-3 h-3 animate-pulse" />, label: 'CONNECTING' },
    live:         { color: 'text-[#00ff87] border-emerald-800 bg-emerald-950', icon: <Radio className="w-3 h-3 animate-pulse" />,   label: 'LIVE STREAM' },
    disconnected: { color: 'text-zinc-400 border-zinc-700 bg-zinc-900',     icon: <WifiOff className="w-3 h-3" />,                 label: 'DISCONNECTED' },
    error:        { color: 'text-rose-400 border-rose-800 bg-rose-950',     icon: <AlertTriangle className="w-3 h-3" />,           label: 'ERROR' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold tracking-widest ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ── scrolling packet log row ──────────────────────────────────────────────────
function PacketRow({ pkt }: { pkt: AnalysisResponse & { src_ip?: string; dst_ip?: string } }) {
  const isThreat = pkt.prediction === 1;
  return (
    <div className={`flex items-center gap-3 px-3 py-1.5 rounded text-[11px] font-mono border ${
      isThreat
        ? 'border-rose-900/60 bg-rose-950/20 text-rose-300'
        : 'border-zinc-800/60 bg-zinc-950/40 text-zinc-300'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isThreat ? 'bg-rose-500' : 'bg-[#00ff87]'}`} />
      <span className="text-zinc-500 w-20 flex-shrink-0">
        {new Date(pkt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      {pkt.src_ip && (
        <span className="text-zinc-400 flex-shrink-0">{pkt.src_ip} → {pkt.dst_ip}</span>
      )}
      <span className="flex-shrink-0">
        proto <strong className="text-white">{pkt.features.protocol}</strong>
      </span>
      <span className="flex-shrink-0">
        len <strong className="text-white">{pkt.features.length}B</strong>
      </span>
      <span className={`ml-auto flex-shrink-0 font-bold ${isThreat ? 'text-rose-400' : 'text-[#00ff87]'}`}>
        {pkt.attack_type.toUpperCase()}
      </span>
      <span className="text-zinc-500 flex-shrink-0">
        {(pkt.confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function LiveStream({ onPacket, onStatusChange }: LiveStreamProps) {
  const [status, setStatus]       = useState<LiveStatus>('disconnected');
  const [log, setLog]             = useState<(AnalysisResponse & { src_ip?: string; dst_ip?: string })[]>([]);
  const [packetCount, setCount]   = useState(0);
  const [threatCount, setThreats] = useState(0);
  const wsRef  = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateStatus = useCallback((s: LiveStatus) => {
    setStatus(s);
    onStatusChange(s);
  }, [onStatusChange]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    updateStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      updateStatus('live');
      // heartbeat every 25 s to keep Render's free tier alive
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25_000);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'pong' || data.type === 'connected') return;
        if (data.type !== 'live_packet' && data.type !== 'analysis') return;

        // Shape into AnalysisResponse
        const result: AnalysisResponse & { src_ip?: string; dst_ip?: string } = {
          prediction:      data.prediction,
          attack_type:     data.attack_type,
          confidence:      data.confidence,
          risk_level:      data.risk_level,
          features:        data.features,
          timestamp:       data.timestamp,
          recommendations: data.recommendations ?? [],
          src_ip:          data.src_ip,
          dst_ip:          data.dst_ip,
        };

        setLog(prev => [result, ...prev].slice(0, 60));   // keep last 60
        setCount(c => c + 1);
        if (data.prediction === 1) setThreats(t => t + 1);
        onPacket(result);
      } catch {
        // malformed frame — ignore
      }
    };

    ws.onerror = () => updateStatus('error');

    ws.onclose = () => {
      updateStatus('disconnected');
      if (pingRef.current) clearInterval(pingRef.current);
      // auto-reconnect after 4 s
      setTimeout(connect, 4_000);
    };
  }, [onPacket, updateStatus]);

  // connect on mount, clean up on unmount
  useEffect(() => {
    connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const threatPct = packetCount > 0 ? Math.round((threatCount / packetCount) * 100) : 0;

  return (
    <div className="tactical-panel rounded-xl border border-zinc-800 shadow-2xl overflow-hidden font-mono">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-[#00ff87]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200">
            LIVE_PACKET_STREAM
          </h3>
          <StatusBadge status={status} />
        </div>

        {/* Stats HUD */}
        <div className="flex items-center gap-4 text-[11px] text-zinc-400">
          <span>
            Packets: <strong className="text-white">{packetCount}</strong>
          </span>
          <span>
            Threats: <strong className={threatCount > 0 ? 'text-rose-400' : 'text-[#00ff87]'}>{threatCount}</strong>
          </span>
          <span>
            Threat rate:{' '}
            <strong className={threatPct > 20 ? 'text-rose-400' : 'text-[#00ff87]'}>
              {threatPct}%
            </strong>
          </span>
        </div>
      </div>

      {/* Agent instructions banner — shown when not live */}
      {status !== 'live' && (
        <div className="mx-6 mt-4 rounded border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-[11px] text-amber-300 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <Cpu className="w-3.5 h-3.5" /> AGENT NOT CONNECTED
          </div>
          <p>Start the local capture agent on your Mac to stream real packets:</p>
          <code className="block mt-1 bg-zinc-950 rounded px-3 py-1.5 text-[#00ff87] select-all">
            cd argus-agent &amp;&amp; sudo python3 agent.py --iface en0
          </code>
          <p className="text-zinc-500">
            (Replace <code>en0</code> with your WiFi interface —{' '}
            <code>networksetup -listallhardwareports</code>)
          </p>
        </div>
      )}

      {/* Scrolling packet log */}
      <div className="px-6 py-4 space-y-1.5 max-h-72 overflow-y-auto custom-scroll">
        {log.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-600 gap-2">
            <Radio className="w-6 h-6 animate-pulse" />
            <span className="text-[11px] uppercase tracking-widest">
              {status === 'live'
                ? 'Waiting for packets from agent…'
                : 'Stream offline — start argus-agent'}
            </span>
          </div>
        ) : (
          log.map((pkt, i) => <PacketRow key={i} pkt={pkt} />)
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-2 border-t border-zinc-800/60 flex items-center gap-2 text-[10px] text-zinc-600">
        <Shield className="w-3 h-3 text-[#00ff87]" />
        <span>Real packets · ML classification · WebSocket push from {WS_URL}</span>
      </div>
    </div>
  );
}
