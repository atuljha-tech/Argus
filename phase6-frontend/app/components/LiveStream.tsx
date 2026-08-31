'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Wifi, WifiOff, Radio, Shield, AlertTriangle,
  Activity, Database,
  Network, Hash, Clock, BarChart2,
} from 'lucide-react';
import { AnalysisResponse } from '@/types';
import { API_BASE_URL, getRecentPackets, RecentResponse } from '@/lib/api';

// ── WebSocket URL ─────────────────────────────────────────────────────────────
// Robust construction using URL API — no regex hacks.
//   NEXT_PUBLIC_API_URL like "https://host/api/v1"
//   => WS URL        like "wss://host/api/v1/ws"
function buildWsUrl(): string {
  try {
    const u = new URL(API_BASE_URL);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    // Strip any trailing /api/v1 suffix from pathname to avoid double-stacking
    let p = u.pathname.replace(/\/api\/v1\/*$/, '/');
    if (!p.endsWith('/')) p += '/';
    u.pathname = `${p}api/v1/ws`;
    const out = u.toString();
    console.info('[LiveStream] WS_URL =', out, '  (from API_BASE_URL =', API_BASE_URL, ')');
    return out;
  } catch (e) {
    // Fallback to simple string concatenation if URL API fails for any reason
    const fallback = API_BASE_URL
      .replace(/^http/, 'ws')
      .replace(/\/api\/v1\/?$/, '')
      .concat('/api/v1/ws');
    console.warn('[LiveStream] URL API failed, fallback WS_URL =', fallback, e);
    return fallback;
  }
}
const WS_URL = buildWsUrl();

// Polling interval for HTTP /recent fallback — runs alongside WebSocket
// so that even if Render's proxy routes POST and WS to different processes
// we still receive all packets within a few seconds.
const POLL_INTERVAL_MS = 3000;

export type LiveStatus = 'connecting' | 'live' | 'disconnected' | 'error';

interface LiveStreamProps {
  onPacket: (result: AnalysisResponse) => void;
  onStatusChange: (s: LiveStatus) => void;
}

// ── Extended packet type includes raw capture metadata ───────────────────────
type LivePacket = AnalysisResponse & {
  src_ip?: string;
  dst_ip?: string;
};

// ── Per-source aggregation for the stats table ───────────────────────────────
interface SourceStat {
  src_ip:   string;
  packets:  number;
  bytes:    number;
  threats:  number;
  lastSeen: string;
  proto:    Set<number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtBytes(b: number): string {
  if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + ' MB';
  if (b >= 1_024)     return (b / 1_024).toFixed(1)     + ' KB';
  return b + ' B';
}
function protoLabel(p: number): string {
  return p === 6 ? 'TCP' : p === 17 ? 'UDP' : p === 50 ? 'ESP' : `${p}`;
}

/**
 * Stable dedup key — combination of timestamp + src_ip:src_port + dst_ip:dst_port.
 * WebSocket + HTTP polling can both deliver the same packet; this key prevents
 * double-counting flows received on both channels.
 */
function dedupKey(pkt: LivePacket | AnalysisResponse & { src_ip?: string; dst_ip?: string }): string {
  const f = (pkt as LivePacket).features;
  const src = pkt.src_ip ?? '?';
  const dst = pkt.dst_ip ?? '?';
  const sp = f?.src_port ?? 0;
  const dp = f?.dst_port ?? 0;
  const proto = f?.protocol ?? 0;
  return `${pkt.timestamp}|${src}:${sp}|${dst}:${dp}|${proto}|${pkt.prediction}`;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LiveStatus }) {
  const cfg = {
    connecting:   { color: 'text-amber-400 border-amber-800 bg-amber-950',     icon: <Activity  className="w-3 h-3 animate-pulse" />, label: 'CONNECTING'  },
    live:         { color: 'text-[#00ff87] border-emerald-800 bg-emerald-950', icon: <Radio     className="w-3 h-3 animate-pulse" />, label: 'LIVE STREAM' },
    disconnected: { color: 'text-zinc-400  border-zinc-700   bg-zinc-900',     icon: <WifiOff   className="w-3 h-3" />,               label: 'DISCONNECTED'},
    error:        { color: 'text-rose-400  border-rose-800   bg-rose-950',     icon: <AlertTriangle className="w-3 h-3" />,           label: 'ERROR'       },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold tracking-widest ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ── Single packet log row ─────────────────────────────────────────────────────
function PacketRow({ pkt }: { pkt: LivePacket }) {
  const threat = pkt.prediction === 1;
  const ts = new Date(pkt.timestamp).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  return (
    <div className={`grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto] items-center gap-x-3 px-3 py-1.5 rounded text-[11px] font-mono border ${
      threat ? 'border-rose-900/60 bg-rose-950/20 text-rose-300'
             : 'border-zinc-800/50 bg-zinc-950/40 text-zinc-300'}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${threat ? 'bg-rose-500' : 'bg-[#00ff87]'}`} />
      <span className="text-zinc-500 truncate">{ts}</span>
      <span className="text-zinc-400 truncate">
        {pkt.src_ip ?? '—'} <span className="text-zinc-600">→</span> {pkt.dst_ip ?? '—'}
      </span>
      <span className="text-zinc-500 flex-shrink-0">
        <span className="text-zinc-600">proto</span> <strong className="text-white">{protoLabel(pkt.features.protocol)}</strong>
      </span>
      <span className="text-zinc-500 flex-shrink-0">
        <span className="text-zinc-600">p</span><strong className="text-white">{pkt.features.src_port}</strong>
        <span className="text-zinc-600">→</span>
        <strong className="text-white">{pkt.features.dst_port}</strong>
      </span>
      <span className="text-zinc-500 flex-shrink-0">
        <strong className="text-white">{fmtBytes(pkt.features.length)}</strong>
      </span>
      <span className={`flex-shrink-0 font-bold ${threat ? 'text-rose-400' : 'text-[#00ff87]'}`}>
        {pkt.attack_type.toUpperCase()} <span className="text-zinc-500 font-normal">{(pkt.confidence * 100).toFixed(0)}%</span>
      </span>
    </div>
  );
}

// ── Source stats table row ────────────────────────────────────────────────────
function SourceRow({ s, rank }: { s: SourceStat; rank: number }) {
  const threatPct = s.packets > 0 ? Math.round((s.threats / s.packets) * 100) : 0;
  return (
    <tr className="border-b border-zinc-800/60 hover:bg-zinc-800/20 transition-colors text-[11px] font-mono">
      <td className="py-2 px-3 text-zinc-500">#{rank}</td>
      <td className="py-2 px-3 text-white font-bold">{s.src_ip}</td>
      <td className="py-2 px-3 text-zinc-300">{s.packets.toLocaleString()}</td>
      <td className="py-2 px-3 text-zinc-300">{fmtBytes(s.bytes)}</td>
      <td className="py-2 px-3">
        <span className={`font-bold ${threatPct > 20 ? 'text-rose-400' : 'text-[#00ff87]'}`}>
          {threatPct}%
        </span>
        <span className="text-zinc-600 ml-1">({s.threats})</span>
      </td>
      <td className="py-2 px-3 text-zinc-400">
        {Array.from(s.proto).map(p => protoLabel(p)).join(' / ')}
      </td>
      <td className="py-2 px-3 text-zinc-500">{s.lastSeen}</td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveStream({ onPacket, onStatusChange }: LiveStreamProps) {
  const [status,       setStatus]     = useState<LiveStatus>('disconnected');
  const [log,          setLog]        = useState<LivePacket[]>([]);
  const [packetCount,  setCount]      = useState(0);
  const [threatCount,  setThreats]    = useState(0);
  const [totalBytes,   setBytes]      = useState(0);
  const [sourceStats,  setSrcStats]   = useState<Map<string, SourceStat>>(new Map());
  const [activeTab,    setTab]        = useState<'log' | 'stats'>('log');

  const wsRef        = useRef<WebSocket | null>(null);
  const pingRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollSinceRef = useRef<string | null>(null);
  const seenRef      = useRef<Set<string>>(new Set());
  const onPacketRef  = useRef(onPacket);

  useEffect(() => { onPacketRef.current = onPacket; }, [onPacket]);

  const updateStatus = useCallback((s: LiveStatus) => {
    setStatus(s);
    onStatusChange(s);
  }, [onStatusChange]);

  // ── Ingest a single packet (called from both WS and HTTP-polling paths) ────
  const ingestPacket = useCallback((data: any, source: 'ws' | 'poll') => {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'pong' || data.type === 'connected') return;
    if (data.type !== 'live_packet' && data.type !== 'analysis') return;
    if (!data.features) return;

    const pkt: LivePacket = {
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

    // ── Deduplicate ────────────────────────────────────────────────────────
    const key = dedupKey(pkt);
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    // Keep the dedup set bounded (it will naturally grow to a few thousand at worst)
    if (seenRef.current.size > 5000) {
      const arr = Array.from(seenRef.current);
      seenRef.current = new Set(arr.slice(-3000));
    }

    const bytes = pkt.features?.length ?? 0;
    const srcIp = pkt.src_ip || 'unknown';
    const ts    = new Date(pkt.timestamp).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });

    if (source === 'poll') {
      console.debug('[LiveStream] NEW via HTTP poll  ts=', pkt.timestamp, 'src=', srcIp, 'pred=', pkt.prediction);
    }

    setLog(prev => [pkt, ...prev].slice(0, 100));
    setCount(c  => c + 1);
    setBytes(b  => b + bytes);
    if (pkt.prediction === 1) setThreats(t => t + 1);

    setSrcStats(prev => {
      const next = new Map(prev);
      const existing = next.get(srcIp) ?? {
        src_ip: srcIp, packets: 0, bytes: 0,
        threats: 0, lastSeen: ts, proto: new Set<number>(),
      };
      existing.packets  += 1;
      existing.bytes    += bytes;
      existing.lastSeen  = ts;
      existing.proto.add(pkt.features?.protocol ?? 0);
      if (pkt.prediction === 1) existing.threats += 1;
      next.set(srcIp, existing);
      return next;
    });

    try {
      onPacketRef.current(pkt);
    } catch (e) {
      console.error('[LiveStream] onPacket callback threw:', e);
    }
  }, []);

  // ── HTTP /recent short-poll fallback ───────────────────────────────────────
  const runPollOnce = useCallback(async (): Promise<void> => {
    try {
      const resp: RecentResponse = await getRecentPackets(pollSinceRef.current, 100);
      if (resp && resp.packets && resp.packets.length) {
        console.debug(
          `[LiveStream] poll GET /recent -> ${resp.returned} new packets  ` +
          `(buffer=${resp.buffer_size}  since=${pollSinceRef.current ?? '—'})`
        );
        for (const p of resp.packets) {
          ingestPacket(p, 'poll');
        }
      } else if (resp) {
        console.debug(
          `[LiveStream] poll /recent -> 0 new  buffer=${resp.buffer_size}  ` +
          `since=${pollSinceRef.current ?? '—'}`
        );
      }
      // Advance cursor so the next poll only asks for newer packets
      if (resp?.next_since) pollSinceRef.current = resp.next_since;
    } catch (e: any) {
      // Only log once every ~5 errors to avoid spam
      const anyErr = e as any;
      const msg = anyErr?.message || anyErr?.code || String(e);
      console.warn('[LiveStream] poll /recent failed (will retry):', msg);
    }
  }, [ingestPacket]);

  // ── WebSocket connect ───────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.info('[LiveStream] connect() skipped — already open');
      return;
    }
    updateStatus('connecting');
    console.info('[LiveStream] WebSocket connecting to', WS_URL);

    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      console.error('[LiveStream] WebSocket constructor threw:', e);
      updateStatus('error');
      // Reconnect after delay; polling fallback is already active anyway
      setTimeout(connect, 8_000);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      console.info('[LiveStream] WebSocket OPEN');
      updateStatus('live');
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'ping' })); } catch { /* ignore */ }
        }
      }, 25_000);
    };

    ws.onmessage = (e) => {
      let data: any = null;
      try {
        data = JSON.parse(e.data);
      } catch (parseErr) {
        console.warn('[LiveStream] WS received non-JSON frame, skipping:', e.data);
        return;
      }
      // connected / pong / non-live-packet frames are silently dropped in ingestPacket's first filter
      if (data.type === 'connected') {
        console.info('[LiveStream] WS received "connected" ack frame');
        return;
      }
      if (data.type === 'pong') return;
      ingestPacket(data, 'ws');
    };

    ws.onerror  = (ev) => {
      console.error('[LiveStream] WebSocket ERROR  readyState=', ws.readyState, ' event=', ev);
      updateStatus('error');
    };

    ws.onclose  = (ev) => {
      console.warn(
        `[LiveStream] WebSocket CLOSED  code=${ev.code}  reason=${ev.reason}  ` +
        `wasClean=${ev.wasClean}. Will reconnect in 4s…`
      );
      updateStatus('disconnected');
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      setTimeout(connect, 4_000);
    };
  }, [updateStatus, ingestPacket]);

  // ── On mount: open WS + start HTTP polling fallback ─────────────────────────
  useEffect(() => {
    console.info('[LiveStream] mounting');
    connect();
    // Kick off one poll immediately so even if WS takes 30+s to deliver,
    // data shows up within a few seconds of opening the page.
    runPollOnce();
    pollRef.current = setInterval(runPollOnce, POLL_INTERVAL_MS);
    console.info('[LiveStream] HTTP poll fallback started  interval=', POLL_INTERVAL_MS, 'ms');

    return () => {
      console.info('[LiveStream] unmounting — closing WS + poll interval');
      if (pingRef.current) clearInterval(pingRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threatPct  = packetCount > 0 ? Math.round((threatCount / packetCount) * 100) : 0;
  const sortedSrcs = Array.from(sourceStats.values()).sort((a, b) => b.packets - a.packets);

  return (
    <div className="tactical-panel rounded-xl border border-zinc-800 shadow-2xl overflow-hidden font-mono">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-[#00ff87]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-200">LIVE_PACKET_STREAM</h3>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-4 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> <strong className="text-white">{packetCount.toLocaleString()}</strong> pkts</span>
          <span className="flex items-center gap-1"><Database className="w-3 h-3" /> <strong className="text-white">{fmtBytes(totalBytes)}</strong></span>
          <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />
            <strong className={threatCount > 0 ? 'text-rose-400' : 'text-[#00ff87]'}>{threatCount}</strong>
            <span className="text-zinc-600 ml-0.5">threats ({threatPct}%)</span>
          </span>
        </div>
      </div>

      {/* ── Agent offline banner ────────────────────────────────────────────── */}
      {status !== 'live' && (
        <div className="mx-6 mt-4 rounded border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-[11px] text-zinc-400 flex items-center gap-3">
          <Radio className="w-4 h-4 text-zinc-600 animate-pulse flex-shrink-0" />
          <span>
            {status === 'connecting'
              ? 'Connecting to live packet stream (HTTP fallback already active)…'
              : 'Stream offline — HTTP fallback polling every 3 s for buffered packets.'}
          </span>
        </div>
      )}

      {/* ── Summary stat cards ─────────────────────────────────────────────── */}
      {packetCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pt-4">
          {[
            { icon: <Hash className="w-3.5 h-3.5 text-[#00ff87]" />,     label: 'TOTAL PACKETS', value: packetCount.toLocaleString(),                      sub: 'captured & classified'            },
            { icon: <Database className="w-3.5 h-3.5 text-sky-400" />,   label: 'TOTAL BYTES',   value: fmtBytes(totalBytes),                               sub: `avg ${fmtBytes(Math.round(totalBytes / packetCount))} / pkt` },
            { icon: <Network className="w-3.5 h-3.5 text-purple-400" />, label: 'UNIQUE SOURCES', value: sortedSrcs.length.toString(),                      sub: 'distinct src IPs'                 },
            { icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />, label: 'THREAT RATE', value: threatPct + '%',                                   sub: `${threatCount} flagged packets`   },
          ].map(c => (
            <div key={c.label} className="bg-zinc-950/70 border border-zinc-800 rounded-lg px-4 py-3 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-widest">
                {c.icon}{c.label}
              </div>
              <div className="text-lg font-black text-white">{c.value}</div>
              <div className="text-[10px] text-zinc-600">{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 px-6 pt-4 border-b border-zinc-800">
        {(['log', 'stats'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setTab(tab)}
            className={`px-4 py-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${
              activeTab === tab
                ? 'border-[#00ff87] text-[#00ff87]'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab === 'log' ? '📋 Packet Log' : '📊 Source Stats'}
          </button>
        ))}
      </div>

      {/* ── Packet log ─────────────────────────────────────────────────────── */}
      {activeTab === 'log' && (
        <div className="px-6 py-3 space-y-1 max-h-72 overflow-y-auto">
          {log.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-600 gap-2">
              <Radio className="w-6 h-6 animate-pulse" />
              <span className="text-[11px] uppercase tracking-widest">
                {packetCount > 0 ? 'Buffering…' :
                 status === 'live'    ? 'Waiting for packets from agent…' :
                                         'Stream offline — polling for buffered packets…'}
              </span>
              <span className="text-[9px] text-zinc-700 font-mono normal-case tracking-normal">
                Tip: open browser DevTools → Console for WS/poll diagnostics tagged [LiveStream]
              </span>
            </div>
          ) : (
            log.map((pkt, i) => <PacketRow key={`${dedupKey(pkt)}-${i}`} pkt={pkt} />)
          )}
        </div>
      )}

      {/* ── Source stats table ─────────────────────────────────────────────── */}
      {activeTab === 'stats' && (
        <div className="px-6 py-3 overflow-x-auto max-h-72 overflow-y-auto">
          {sortedSrcs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-600 gap-2">
              <BarChart2 className="w-6 h-6" />
              <span className="text-[11px] uppercase tracking-widest">No data yet</span>
            </div>
          ) : (
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                  <th className="py-2 px-3 text-left font-bold">#</th>
                  <th className="py-2 px-3 text-left font-bold">↑ Source IP</th>
                  <th className="py-2 px-3 text-left font-bold">Packets</th>
                  <th className="py-2 px-3 text-left font-bold">Total Size</th>
                  <th className="py-2 px-3 text-left font-bold">Threat %</th>
                  <th className="py-2 px-3 text-left font-bold">Protocols</th>
                  <th className="py-2 px-3 text-left font-bold">⏱ Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {sortedSrcs.map((s, i) => <SourceRow key={s.src_ip} s={s} rank={i + 1} />)}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-2 border-t border-zinc-800/60 flex items-center gap-2 text-[10px] text-zinc-600">
        <Shield className="w-3 h-3 text-[#00ff87]" />
        <span>Real NIC packets · Random Forest ML · WebSocket + HTTP fallback poll</span>
      </div>
    </div>
  );
}
