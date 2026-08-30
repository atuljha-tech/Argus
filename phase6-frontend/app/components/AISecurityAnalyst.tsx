'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, RefreshCw, ChevronDown, Shield, AlertTriangle, Zap } from 'lucide-react';
import { AnalysisResponse } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SessionStats {
  totalFlows:      number;
  threatCount:     number;
  benignCount:     number;
  threatPct:       number;
  normalCount:     number;
  ddosCount:       number;
  portScanCount:   number;
  vpnExploitCount: number;
  udpCount:        number;
  tcpCount:        number;
  otherProtoCount: number;
  avgConfidence:   number;
  topSrcIps:       string[];
  recentAttackTypes: string[];
}

interface AISecurityAnalystProps {
  history:    AnalysisResponse[];
  liveStats: {
    normalCount:     number;
    ddosCount:       number;
    portScanCount:   number;
    vpnExploitCount: number;
    udpCount:        number;
    tcpCount:        number;
    otherProtoCount: number;
  };
}

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = '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';
const GROQ_MODEL = 'openai/gpt-oss-20b';

// ── Build stats summary from live history ─────────────────────────────────────
function buildStats(
  history: AnalysisResponse[],
  liveStats: AISecurityAnalystProps['liveStats'],
): SessionStats {
  const totalFlows  = history.length;
  const threatCount = history.filter(h => h.prediction === 1).length;
  const benignCount = totalFlows - threatCount;
  const threatPct   = totalFlows > 0 ? Math.round((threatCount / totalFlows) * 100) : 0;
  const avgConf     = totalFlows > 0
    ? Math.round(history.reduce((s, h) => s + h.confidence, 0) / totalFlows * 100)
    : 0;

  // Collect unique src IPs (from extended type)
  const ipCounts: Record<string, number> = {};
  for (const h of history) {
    const ip = (h as AnalysisResponse & { src_ip?: string }).src_ip;
    if (ip) ipCounts[ip] = (ipCounts[ip] ?? 0) + 1;
  }
  const topSrcIps = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ip, cnt]) => `${ip} (${cnt} flows)`);

  // Recent distinct attack types
  const recentAttackTypes = Array.from(
    new Set(history.slice(-30).map(h => h.attack_type).filter(t => t !== 'benign' && t !== 'Normal Traffic'))
  ).slice(0, 6);

  return {
    totalFlows, threatCount, benignCount, threatPct,
    ...liveStats,
    avgConfidence:     avgConf,
    topSrcIps,
    recentAttackTypes,
  };
}

// ── Build the Groq prompt ─────────────────────────────────────────────────────
function buildPrompt(stats: SessionStats): string {
  return `You are ARGUS — an expert network security AI analyst. Analyse the following real-time network session data captured directly from the user's WiFi NIC and provide a comprehensive security assessment.

SESSION STATISTICS:
- Total flow-windows analysed: ${stats.totalFlows}
- Benign flows: ${stats.benignCount} (${100 - stats.threatPct}%)
- Threat flows: ${stats.threatCount} (${stats.threatPct}%)
- ML model average confidence: ${stats.avgConfidence}%

PROTOCOL BREAKDOWN:
- TCP flows: ${stats.tcpCount}
- UDP flows: ${stats.udpCount}
- ESP/Other: ${stats.otherProtoCount}

ATTACK CLASSIFICATION DISTRIBUTION:
- Normal/Benign: ${stats.normalCount}
- DDoS Flood: ${stats.ddosCount}
- Port Scan: ${stats.portScanCount}
- VPN Exploit / Exfil / C2: ${stats.vpnExploitCount}

${stats.recentAttackTypes.length > 0 ? `RECENT ATTACK TYPES DETECTED:\n${stats.recentAttackTypes.map(t => `- ${t}`).join('\n')}\n` : ''}
${stats.topSrcIps.length > 0 ? `TOP SOURCE IPs:\n${stats.topSrcIps.map(ip => `- ${ip}`).join('\n')}\n` : ''}

Provide a structured security report with these exact sections:
1. **OVERALL SECURITY POSTURE** — One clear sentence verdict with a risk score /100
2. **THREAT ANALYSIS** — What threats were detected, their severity, and what they mean for this network
3. **PROTOCOL SECURITY** — Assessment of the protocol mix and what it reveals
4. **TOP SOURCE IP ANALYSIS** — If IPs are provided, assess which look suspicious vs normal
5. **VPN SECURITY ASSESSMENT** — Based on ESP/VPN traffic patterns, rate the VPN security configuration
6. **IMMEDIATE RECOMMENDATIONS** — 3-5 specific, actionable steps ranked by priority
7. **CONCLUSION** — 2-3 sentence plain-English summary a non-technical user can understand

Keep each section concise but meaningful. Use real numbers from the data. Do not make up data.`;
}

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function renderMarkdown(text: string) {
  return text
    .split('\n')
    .map((line, i) => {
      // Bold headers like **SECTION**
      if (/^\d+\.\s\*\*/.test(line)) {
        const clean = line.replace(/\*\*/g, '');
        return <p key={i} className="text-[#00ff87] font-bold text-[12px] mt-4 mb-1 uppercase tracking-wider">{clean}</p>;
      }
      // Bullet points
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <p key={i} className="flex gap-2 text-[11px] text-zinc-300 leading-relaxed">
            <span className="text-[#00ff87] flex-shrink-0 mt-0.5">›</span>
            <span>{line.slice(2).replace(/\*\*/g, '')}</span>
          </p>
        );
      }
      // Bold inline
      if (line.includes('**')) {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} className="text-[11px] text-zinc-300 leading-relaxed">
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-white">{p}</strong> : p)}
          </p>
        );
      }
      if (line.trim() === '') return <div key={i} className="h-1" />;
      return <p key={i} className="text-[11px] text-zinc-300 leading-relaxed">{line}</p>;
    });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AISecurityAnalyst({ history, liveStats }: AISecurityAnalystProps) {
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [response,  setResponse]  = useState('');
  const [error,     setError]     = useState('');
  const [lastStats, setLastStats] = useState<SessionStats | null>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const analyseRef  = useRef<() => void>(() => {});

  // Auto-scroll as text streams in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [response]);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const analyse = useCallback(async () => {
    if (history.length === 0) {
      setError('No data yet — wait for packets to arrive then try again.');
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const stats = buildStats(history, liveStats);
    setLastStats(stats);
    setResponse('');
    setError('');
    setLoading(true);

    try {
      const res = await fetch(GROQ_API, {
        method: 'POST',
        signal: abortRef.current.signal,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model:       GROQ_MODEL,
          temperature: 0.3,
          max_tokens:  1500,
          stream:      true,
          messages: [
            { role: 'system', content: 'You are ARGUS, a precise network security analyst. Be concise, use real numbers, never hallucinate data.' },
            { role: 'user',   content: buildPrompt(stats) },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq API ${res.status}: ${err}`);
      }

      // Stream SSE chunks
      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   buf     = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.replace(/^data: /, '').trim();
          if (!trimmed || trimmed === '[DONE]') continue;
          try {
            const chunk = JSON.parse(trimmed);
            const delta = chunk.choices?.[0]?.delta?.content ?? '';
            if (delta) setResponse(prev => prev + delta);
          } catch { /* partial JSON — skip */ }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message ?? 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }, [history, liveStats]);

  // Keep ref in sync so the open-effect below always sees the latest analyse
  useEffect(() => { analyseRef.current = analyse; }, [analyse]);

  // Auto-run when drawer opens and we have real data
  useEffect(() => {
    if (open && history.length > 0 && !response && !loading) {
      analyseRef.current();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasData   = history.length > 0;
  const threatPct = hasData
    ? Math.round((history.filter(h => h.prediction === 1).length / history.length) * 100)
    : 0;

  const pulseColor = !hasData      ? 'bg-zinc-700'
    : threatPct > 30               ? 'bg-rose-500'
    : threatPct > 10               ? 'bg-amber-400'
    :                                'bg-[#00ff87]';

  return (
    <>
      {/* ── Floating trigger button ──────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl
          bg-zinc-900 border border-zinc-700 hover:border-[#00ff87]/60 hover:bg-zinc-800
          text-white font-mono text-xs font-bold shadow-2xl shadow-black/60
          transition-all duration-200 group"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pulseColor} ${hasData ? 'animate-pulse' : ''}`} />
        <Sparkles className="w-4 h-4 text-[#00ff87] group-hover:rotate-12 transition-transform" />
        <span className="hidden sm:inline">AI SECURITY ANALYSIS</span>
        <span className="sm:hidden">AI ANALYSIS</span>
        {hasData && (
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
            threatPct > 30 ? 'bg-rose-900 text-rose-300' :
            threatPct > 10 ? 'bg-amber-900 text-amber-300' :
            'bg-emerald-900 text-[#00ff87]'
          }`}>
            {threatPct}% threat
          </span>
        )}
      </button>

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Drawer panel ─────────────────────────────────────────────────── */}
      <div className={`fixed bottom-0 right-0 z-50 h-[85vh] w-full sm:w-[560px] lg:w-[620px]
        flex flex-col bg-zinc-950 border-l border-t border-zinc-800 shadow-2xl
        font-mono transition-transform duration-300 ease-out rounded-tl-2xl
        ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-800">
              <Sparkles className="w-4 h-4 text-[#00ff87]" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white">
                AI SECURITY ANALYST
              </h2>
              <p className="text-[10px] text-zinc-500">
                Groq · LLaMA 3 · powered by your real traffic data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasData && (
              <button
                onClick={analyse}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900
                  hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px]
                  transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-[#00ff87]' : ''}`} />
                {loading ? 'Analysing…' : 'Re-analyse'}
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats snapshot bar */}
        {lastStats && (
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-zinc-800/60
            bg-zinc-900/40 text-[10px] text-zinc-500 flex-shrink-0 flex-wrap">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-[#00ff87]" />
              <strong className="text-white">{lastStats.totalFlows}</strong> flows
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <strong className={lastStats.threatCount > 0 ? 'text-rose-400' : 'text-[#00ff87]'}>
                {lastStats.threatCount}
              </strong> threats ({lastStats.threatPct}%)
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <strong className="text-white">{lastStats.avgConfidence}%</strong> avg confidence
            </span>
            <span className="text-zinc-600">
              TCP:{lastStats.tcpCount} UDP:{lastStats.udpCount} ESP:{lastStats.otherProtoCount}
            </span>
          </div>
        )}

        {/* Content area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {!hasData && !loading && !response && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-600">
              <Sparkles className="w-10 h-10 opacity-30" />
              <p className="text-[12px] uppercase tracking-widest text-center">
                Waiting for live packet data
              </p>
              <p className="text-[11px] text-zinc-700 text-center max-w-xs">
                The AI analyst will automatically run once your network packets start flowing in.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded border border-rose-800 bg-rose-950/30 px-4 py-3 text-[11px] text-rose-300">
              <strong>Error:</strong> {error}
            </div>
          )}

          {loading && !response && (
            <div className="flex items-center gap-3 text-[11px] text-zinc-500 pt-4">
              <span className="w-2 h-2 rounded-full bg-[#00ff87] animate-ping" />
              Analysing your real traffic data with Groq LLaMA 3…
            </div>
          )}

          {response && (
            <div className="space-y-0.5">
              {renderMarkdown(response)}
              {loading && (
                <span className="inline-block w-2 h-3 bg-[#00ff87] animate-pulse ml-1 align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800/60 flex-shrink-0 flex items-center
          justify-between text-[9px] text-zinc-700">
          <span>Analysis based on {history.length} real captured flows · Updates on re-analyse</span>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <ChevronDown className="w-3 h-3" /> Close
          </button>
        </div>
      </div>
    </>
  );
}
