'use client';

import { useState, useEffect } from 'react';
import { Shield, Activity, Server, AlertTriangle, Terminal, Sparkles, Lock, Cpu } from 'lucide-react';
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
        setError('FastAPI Backend offline. Launch backend on http://localhost:8000.');
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
      setError('Analysis error: Unable to connect to backend inference endpoint.');
      console.error('Prediction error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSecurityScore = () => {
    if (!result) return 88;
    return result.risk_level === 'CRITICAL' ? 20 :
           result.risk_level === 'HIGH' ? 40 :
           result.risk_level === 'MEDIUM' ? 65 : 95;
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 bg-tactical-grid relative overflow-x-hidden">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">
        {/* Connection Error Banner */}
        {error && (
          <div className="tactical-panel border border-rose-500/50 rounded-lg p-4 glow-rose animate-pulse font-mono">
            <div className="flex items-center space-x-3 text-rose-400 text-xs sm:text-sm font-bold">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Hero Command Header */}
        <div className="tactical-panel rounded-xl p-6 md:p-8 border border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded bg-zinc-950 border border-zinc-800 text-[#00ff87] text-xs font-mono">
                <Terminal className="w-3.5 h-3.5" />
                <span>TACTICAL SECURITY COMMAND CENTER</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white uppercase">
                IPsec VPN Assessment & <br />
                <span className="text-[#00ff87]">
                  Predictive Attack Intelligence
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 font-mono leading-relaxed">
                Automated VPN cryptographic strength inspector combined with real-time machine learning attack forecasting. Evaluates IPsec packet attributes, classifies threat vectors, and outputs actionable countermeasures.
              </p>
            </div>

            {/* Metrics HUD */}
            <div className="grid grid-cols-2 gap-3 font-mono sm:w-auto">
              <div className="bg-zinc-950 p-3.5 rounded border border-zinc-800">
                <div className="text-[10px] text-zinc-500 uppercase">INFERENCE ENGINE</div>
                <div className="text-xs font-bold text-[#00ff87] flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-[#00ff87] animate-ping"></span>
                  {health ? '8000 ONLINE' : 'DISCONNECTED'}
                </div>
              </div>
              <div className="bg-zinc-950 p-3.5 rounded border border-zinc-800">
                <div className="text-[10px] text-zinc-500 uppercase">PARSER CORE</div>
                <div className="text-xs font-bold text-white mt-1">
                  Rust IPsec Parser
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Evaluator Form & Results */}
          <div className="lg:col-span-2 space-y-6">
            <PredictionForm onPredict={handlePredict} loading={loading} />
            <ResultsDisplay result={result} />
          </div>

          {/* Right Column: Security Gauge & Telemetry Info */}
          <div className="space-y-6">
            <SecurityScore score={getSecurityScore()} />

            {/* Active Node Card */}
            <div className="tactical-panel rounded-xl p-6 border border-zinc-800 space-y-4 font-mono">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                <Server className="w-4 h-4 text-[#00ff87]" />
                VPN_TESTBED_PARAMETERS
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-500">VPN Gateway</span>
                  <span className="text-white font-bold">StrongSwan 5.9</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-500">IKE Suite</span>
                  <span className="text-[#00ff87] font-bold">AES-256-GCM</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-500">Authentication</span>
                  <span className="text-white">SHA-256 / PFS</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-zinc-500">Telemetry Stream</span>
                  <span className="text-emerald-400 font-bold">Active Socket</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        <ThreatAnalytics />

        {/* Tactical Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-800 text-center text-xs text-zinc-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#00ff87]" />
            <span className="font-bold text-zinc-300">ARGUS ENTERPRISE CYBER DEFENSE</span>
          </div>
          <div>High-Assurance Security Assessment & Machine Learning Intelligence</div>
          <div className="text-zinc-600">FastAPI // Next.js Turbopack</div>
        </footer>
      </main>
    </div>
  );
}
