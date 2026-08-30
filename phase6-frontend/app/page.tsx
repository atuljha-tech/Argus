'use client';

import { useState, useEffect } from 'react';
import { Shield, Activity, Server, AlertTriangle, ShieldCheck, Zap, Lock, Database, Radio, Sparkles } from 'lucide-react';
import Navbar from './components/Navbar';
import PredictionForm from './components/PredictionForm';
import ResultsDisplay from './components/ResultsDisplay';
import SecurityScore from './components/SecurityScore';
import ThreatAnalytics from './components/ThreatAnalytics';
import { healthCheck, analyze } from '../lib/api';
import { AnalysisResponse, HealthResponse } from '../types';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await healthCheck();
        setHealth(data);
      } catch (err) {
        setError('FastAPI Backend connection failed. Ensure backend server is running on port 8000.');
        console.error('Health check failed:', err);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handlePredict = async (features: {
    src_port: number;
    dst_port: number;
    protocol: number;
    length: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyze(features);
      setResult(data);
    } catch (err) {
      setError('Analysis failed. Unable to reach FastAPI backend server.');
      console.error('Prediction error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSecurityScore = () => {
    if (!result) return 85;
    return result.risk_level === 'CRITICAL' ? 20 :
           result.risk_level === 'HIGH' ? 40 :
           result.risk_level === 'MEDIUM' ? 65 : 95;
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 bg-cyber-grid relative overflow-x-hidden selection:bg-cyan-500 selection:text-black">
      {/* Background Ambient Spotlights */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px] pointer-events-none"></div>

      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">
        {/* Connection Status Banner */}
        {error && (
          <div className="glass-panel border border-rose-500/40 rounded-2xl p-4 glow-rose animate-pulse">
            <div className="flex items-center space-x-3 text-rose-400 text-xs sm:text-sm font-medium">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Hero Command Header */}
        <div className="glass-panel rounded-3xl p-6 md:p-8 border border-slate-800/80 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 text-xs font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                <span>SIH 2026 AI-Powered Defense Command</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                AI Cyber Threat Intelligence & <br />
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  IPsec VPN Assessment Matrix
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Real-time machine learning threat classification engine. Evaluates VPN packet telemetry vectors, predicts attack patterns, and enforces automated countermeasure recommendations.
              </p>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                <div className="text-[10px] text-slate-500 font-mono uppercase">API Status</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  {health ? '8000 ONLINE' : 'CONNECTING'}
                </div>
              </div>
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                <div className="text-[10px] text-slate-500 font-mono uppercase">ML Model</div>
                <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
                  {health?.model_loaded ? 'DECISION TREE' : 'STANDBY'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Form & Result Output */}
          <div className="lg:col-span-2 space-y-6">
            <PredictionForm onPredict={handlePredict} loading={loading} />
            <ResultsDisplay result={result} />
          </div>

          {/* Right Column: Security Gauge & Telemetry Status */}
          <div className="space-y-6">
            <SecurityScore score={getSecurityScore()} />

            {/* Platform Node Info Card */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                Active Node Parameters
              </h4>
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-500">VPN Testbed Node</span>
                  <span className="text-slate-200 font-bold">StrongSwan 5.9</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-500">Encryption Suite</span>
                  <span className="text-cyan-400 font-bold">AES-256-GCM</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-500">Authentication</span>
                  <span className="text-slate-200">SHA-256 / PFS</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">Packet Parser</span>
                  <span className="text-emerald-400 font-bold">Rust pcap-parser</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        <ThreatAnalytics />

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-800/80 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-400">ARGUS Cyber Intelligence Platform</span>
          </div>
          <div>Smart India Hackathon 2026 — Problem Statements SIH26160 & SIH26153</div>
          <div className="font-mono text-slate-600">FastAPI + Next.js Turbopack</div>
        </footer>
      </main>
    </div>
  );
}

