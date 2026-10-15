'use client';

import React from 'react';
import {
  Building2,
  Users,
  Video,
  ShieldCheck,
  HelpCircle,
  BarChart3,
  Flame,
  ArrowRight,
  TrendingUp,
  Activity,
  Award,
  CheckCircle2,
  Clock,
  PlusCircle,
  FileDown
} from 'lucide-react';

interface MetricData {
  totalCompanies: number;
  activeCompanies?: number;
  suspendedCompanies?: number;
  totalUsers?: number;
  totalMeetings: number;
  liveMeetings?: number;
  endedMeetings?: number;
  totalAttendees: number;
  pendingApprovals: number;
  totalQuizzes?: number;
  publishedQuizzes?: number;
  totalAttempts?: number;
  passedAttempts?: number;
  overallAvgScore?: number;
  passRate?: number;
}

interface TopTopic {
  topic: string;
  count: number;
}

interface DashboardOverviewProps {
  metrics: MetricData;
  topTopics: TopTopic[];
  onNavigate: (tab: any) => void;
  onOpenCreateCompany: () => void;
  onExportReport: () => void;
}

export default function DashboardOverview({
  metrics,
  topTopics,
  onNavigate,
  onOpenCreateCompany,
  onExportReport
}: DashboardOverviewProps) {
  const activeCompanies = metrics.activeCompanies ?? metrics.totalCompanies;
  const liveMeetings = metrics.liveMeetings ?? 0;
  const totalQuizzes = metrics.totalQuizzes ?? 0;
  const totalAttempts = metrics.totalAttempts ?? 0;
  const avgScore = metrics.overallAvgScore ?? 0;
  const passRate = metrics.passRate ?? 0;

  return (
    <div className="space-y-6">
      {/* Banner de Boas-Vindas e Ações Rápidas */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
              OPERACIONAL ATIVO
            </span>
            <span className="text-xs text-slate-400">• PostgreSQL Neon Conectado</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Painel Executivo de Gestão Mestre
          </h2>
          <p className="text-xs text-slate-400 max-w-xl">
            Monitoramento consolidado e tempo real de todas as empresas, DDSs, presenças e avaliações de eficácia do ecossistema DDS-ON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onOpenCreateCompany}
            className="flex-1 md:flex-none px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle size={15} />
            <span>Nova Empresa</span>
          </button>

          <button
            onClick={onExportReport}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <FileDown size={15} className="text-green-400" />
            <span>Dossiê Geral PDF</span>
          </button>
        </div>
      </div>

      {/* Grid de Métricas Principais (100% dados reais) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Empresas */}
        <div
          onClick={() => onNavigate('COMPANIES')}
          className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800/80 p-4 sm:p-5 rounded-2xl cursor-pointer transition-all hover:border-slate-700 space-y-1 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <Building2 size={15} className="text-blue-400 shrink-0" /> Empresas Cadastradas
            </span>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {metrics.totalCompanies}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
            <span className="text-green-400 font-bold">{activeCompanies} ativas</span>
            <span>•</span>
            <span>{metrics.suspendedCompanies || 0} suspensas</span>
          </div>
        </div>

        {/* Card 2: DDSs */}
        <div
          onClick={() => onNavigate('DDS')}
          className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800/80 p-4 sm:p-5 rounded-2xl cursor-pointer transition-all hover:border-slate-700 space-y-1 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <Video size={15} className="text-emerald-400 shrink-0" /> Treinamentos DDS
            </span>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {metrics.totalMeetings}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
            <span className={liveMeetings > 0 ? "text-amber-400 font-bold animate-pulse" : "text-slate-400 font-bold"}>
              {liveMeetings} ao vivo
            </span>
            <span>•</span>
            <span>{metrics.endedMeetings ?? (metrics.totalMeetings - liveMeetings)} encerrados</span>
          </div>
        </div>

        {/* Card 3: Presenças Auditadas */}
        <div
          onClick={() => onNavigate('ATTENDANCES')}
          className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800/80 p-4 sm:p-5 rounded-2xl cursor-pointer transition-all hover:border-slate-700 space-y-1 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-green-400 shrink-0" /> Presenças Auditadas
            </span>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-green-400 transition-colors" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-green-400 tracking-tight">
            {metrics.totalAttendees}
          </p>
          <div className="text-[10px] text-slate-500 pt-0.5 truncate">
            Biometria facial e assinatura digital
          </div>
        </div>

        {/* Card 4: Fila de Usuários Pendentes */}
        <div
          onClick={() => onNavigate('USERS')}
          className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800/80 p-4 sm:p-5 rounded-2xl cursor-pointer transition-all hover:border-slate-700 space-y-1 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <Users size={15} className="text-amber-400 shrink-0" /> Fila de Liberação
            </span>
            <ArrowRight size={13} className="text-slate-600 group-hover:text-amber-400 transition-colors" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {metrics.pendingApprovals}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
            <span className={metrics.pendingApprovals > 0 ? "text-amber-400 font-bold" : "text-green-400"}>
              {metrics.pendingApprovals > 0 ? "Aguardando aprovação" : "Fila 100% limpa"}
            </span>
          </div>
        </div>
      </div>

      {/* Grid de Novas Funcionalidades: Questionários e Avaliações de Eficácia */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Card Questionários */}
        <div
          onClick={() => onNavigate('QUIZZES')}
          className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 p-5 rounded-2xl cursor-pointer transition-all hover:border-slate-700 space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <HelpCircle size={16} className="text-green-400" /> Avaliações Criadas
            </span>
            <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded-md text-[10px] font-bold">
              {metrics.publishedQuizzes ?? 0} publicadas
            </span>
          </div>
          <p className="text-3xl font-black text-white">{totalQuizzes}</p>
          <p className="text-xs text-slate-400">
            {totalAttempts} respostas de colaboradores registradas no ecossistema.
          </p>
        </div>

        {/* Card Aproveitamento */}
        <div
          onClick={() => onNavigate('BI')}
          className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 p-5 rounded-2xl cursor-pointer transition-all hover:border-slate-700 space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Award size={16} className="text-amber-400" /> Aproveitamento Médio
            </span>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-md text-[10px] font-bold">
              {passRate}% Aprovados
            </span>
          </div>
          <p className="text-3xl font-black text-amber-400">{avgScore} <span className="text-sm text-slate-400">pts</span></p>
          <p className="text-xs text-slate-400">
            Média consolidada de todas as avaliações respondidas pelos colaboradores.
          </p>
        </div>

        {/* Card BI Global */}
        <div
          onClick={() => onNavigate('BI')}
          className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 p-5 rounded-2xl cursor-pointer transition-all hover:border-slate-700 space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-400" /> BI Administrativo
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md text-[10px] font-bold">
              Analytics
            </span>
          </div>
          <p className="text-3xl font-black text-white">Consolidado</p>
          <p className="text-xs text-slate-400">
            Evolução temporal, gráficos de aproveitamento e ranking multi-tenant.
          </p>
        </div>
      </div>

      {/* Seção Inferior: Temas em Alta e Saúde do Sistema */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Temas Mais Frequentes */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flame size={16} className="text-amber-400" /> Temas de Treinamentos Mais Frequentes
              </h3>
              <p className="text-xs text-slate-400">Baseado nas atas registradas pelos técnicos em campo</p>
            </div>
            <button
              onClick={() => onNavigate('DDS')}
              className="text-xs text-green-400 hover:text-green-300 font-bold flex items-center gap-1"
            >
              Ver todos <ArrowRight size={12} />
            </button>
          </div>

          {topTopics.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Nenhum treinamento realizado ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {topTopics.map((item, idx) => {
                const maxCount = topTopics[0]?.count || 1;
                const percentage = Math.round((item.count / maxCount) * 100);

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate pr-2">
                        #{idx + 1} {item.topic}
                      </span>
                      <span className="font-mono text-green-400 font-bold shrink-0">
                        {item.count} {item.count === 1 ? 'DDS' : 'DDSs'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Diagnóstico Rápido de Saúde */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity size={16} className="text-green-400" /> Integridade do Sistema
            </h3>
            <p className="text-xs text-slate-400">
              Estado operacional das conexões e dados da infraestrutura.
            </p>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Banco de Dados</span>
                <span className="text-green-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> PostgreSQL Neon
                </span>
              </div>
              <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Kill-Switch Empresas</span>
                <span className="text-emerald-400 font-bold">Ativo & Operante</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Trilha de Auditoria</span>
                <span className="text-green-400 font-bold">AuditLog Persistido</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('MONITORING')}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <span>Ver Diagnóstico Completo</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
