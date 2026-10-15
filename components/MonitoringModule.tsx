'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Database,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  ShieldCheck,
  Loader2
} from 'lucide-react';

interface HealthData {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  timestamp: string;
  database: {
    provider: string;
    connected: boolean;
    latencyMs: number;
    pooler: string;
    error?: string;
  };
  counts: {
    companies: { total: number; active: number; suspended: number };
    users: { total: number };
    meetings: { total: number; live: number; ended: number };
    attendances: { total: number };
    quizzes: { total: number; published: number };
    attempts: { total: number };
    auditLogs: { total: number };
  };
}

export default function MonitoringModule() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const checkHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/master/health', { cache: 'no-store' });
      const data = await res.json();
      setHealth(data);
      setLastCheck(new Date());
    } catch (err) {
      console.error('Erro no diagnóstico de saúde:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Diagnóstico periódico a cada 30s
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <div className="space-y-6">
      {/* Top Banner de Diagnóstico */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  health?.status === 'HEALTHY'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : health?.status === 'DEGRADED'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}
              >
                {health?.status === 'HEALTHY' ? 'SISTEMA 100% OPERACIONAL' : health?.status || 'VERIFICANDO'}
              </span>
              <span className="text-xs text-slate-400">
                • Última verificação: {lastCheck.toLocaleTimeString('pt-BR')}
              </span>
            </div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Activity className="text-green-400" size={22} /> Diagnóstico Operacional & Monitoramento
            </h2>
            <p className="text-xs text-slate-400">
              Verificações ativas de conectividade, latência real do banco de dados e volumetria das tabelas.
            </p>
          </div>

          <button
            onClick={checkHealth}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Executar Diagnóstico</span>
          </button>
        </div>
      </div>

      {loading && !health ? (
        <div className="py-24 text-center text-slate-500 flex flex-col items-center gap-2">
          <Loader2 size={28} className="animate-spin text-green-500" />
          <p className="text-xs">Medindo latência do PostgreSQL Neon...</p>
        </div>
      ) : !health ? null : (
        <>
          {/* Métricas de Conexão e Latência */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <Database size={16} className="text-green-400" /> PostgreSQL Neon
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              </div>
              <p className="text-xl font-black text-white">
                {health.database.connected ? 'Conexão Ativa' : 'Desconectado'}
              </p>
              <p className="text-xs text-slate-400">
                {health.database.pooler} • Serverless AWS
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <Zap size={16} className="text-amber-400" /> Latência Real (RTT)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Round-Trip</span>
              </div>
              <p className="text-2xl font-black text-amber-400">
                {health.database.latencyMs} <span className="text-sm text-slate-400">ms</span>
              </p>
              <p className="text-xs text-slate-400">
                {health.database.latencyMs < 500 ? 'Velocidade excelente' : 'Latência aceitável'}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-400" /> Integridade e Auditoria
                </span>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <p className="text-xl font-black text-white">Trilha Ativa</p>
              <p className="text-xs text-slate-400">
                {health.counts.auditLogs.total} eventos registrados no AuditLog
              </p>
            </div>
          </div>

          {/* Volumetria Real de Tabelas do Banco */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers size={16} className="text-green-400" /> Volumetria Consolidada das Tabelas (PostgreSQL)
            </h3>
            <p className="text-xs text-slate-400">
              Contagem instantânea e real dos registros compartilhados com a aplicação DDS-ON.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Empresas</span>
                <p className="text-xl font-black text-white">{health.counts.companies.total}</p>
                <span className="text-[10px] text-green-400 block">{health.counts.companies.active} ativas</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Usuários</span>
                <p className="text-xl font-black text-white">{health.counts.users.total}</p>
                <span className="text-[10px] text-slate-400 block">Técnicos/Admins</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Reuniões DDS</span>
                <p className="text-xl font-black text-emerald-400">{health.counts.meetings.total}</p>
                <span className="text-[10px] text-slate-400 block">{health.counts.meetings.live} ao vivo</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Presenças</span>
                <p className="text-xl font-black text-green-400">{health.counts.attendances.total}</p>
                <span className="text-[10px] text-slate-400 block">Biometrias</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Questionários</span>
                <p className="text-xl font-black text-amber-400">{health.counts.quizzes.total}</p>
                <span className="text-[10px] text-slate-400 block">{health.counts.quizzes.published} publicados</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Tentativas</span>
                <p className="text-xl font-black text-blue-400">{health.counts.attempts.total}</p>
                <span className="text-[10px] text-slate-400 block">Respostas</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
