'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Building2,
  TrendingUp,
  Award,
  Video,
  FileCheck2,
  FileDown,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { generateExecutiveBiPdf } from '@/lib/pdfGenerator';

interface BiData {
  period: string;
  kpis: {
    totalMeetings: number;
    remoteMeetings: number;
    presentialMeetings: number;
    liveMeetings: number;
    endedMeetings: number;
    totalAttendees: number;
    avgAttendeesPerMeeting: number;
    totalQuizzes: number;
    publishedQuizzes: number;
    totalAttempts: number;
    passedAttempts: number;
    avgScore: number;
    approvalRate: number;
  };
  levelDistribution: Record<string, number>;
  monthlyEvolution: Array<{
    month: string;
    ddsTotal: number;
    remote: number;
    presential: number;
  }>;
  companyComparison: Array<{
    id: string;
    name: string;
    status: string;
    usersCount: number;
    meetingsCount: number;
    attendeesCount: number;
    quizzesCount: number;
  }>;
}

export default function BiModule() {
  const [data, setData] = useState<BiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const fetchBiData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('period', period);
      if (selectedCompanyId) params.set('companyId', selectedCompanyId);

      const res = await fetch(`/api/master/bi?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Erro ao carregar BI:', err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedCompanyId]);

  useEffect(() => {
    fetchBiData();
  }, [fetchBiData]);

  const handleExportBiPdf = () => {
    if (!data) return;

    generateExecutiveBiPdf({
      period,
      generatedBy: 'SuperAdmin Alexandre Machado',
      totalCompanies: data.companyComparison.length,
      activeCompanies: data.companyComparison.filter((c) => c.status === 'ACTIVE').length,
      totalUsers: data.companyComparison.reduce((acc, c) => acc + c.usersCount, 0),
      totalMeetings: data.kpis.totalMeetings,
      totalAttendees: data.kpis.totalAttendees,
      totalQuizzes: data.kpis.totalQuizzes,
      totalAttempts: data.kpis.totalAttempts,
      avgScore: data.kpis.avgScore,
      approvalRate: data.kpis.approvalRate,
      companyComparison: data.companyComparison
    });
  };

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      {/* Top Header & Filtros */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <BarChart3 className="text-emerald-400" size={22} /> BI & Indicadores Consolidados
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inteligência operacional agregada do ecossistema DDS-ON com métricas em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBiPdf}
              disabled={loading || !data}
              className="px-3.5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shrink-0 disabled:opacity-50"
            >
              <FileDown size={14} />
              <span>Exportar Relatório BI PDF</span>
            </button>

            <button
              onClick={fetchBiData}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors flex items-center shrink-0"
              title="Atualizar Indicadores"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filtros de Período e Empresa */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {['7d', '30d', '90d', '12m', 'all'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === p
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p === '7d' ? '7 Dias' : p === '30d' ? '30 Dias' : p === '90d' ? '90 Dias' : p === '12m' ? '1 Ano' : 'Histórico Completo'}
              </button>
            ))}
          </div>

          {data && data.companyComparison.length > 0 && (
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todas as Empresas</option>
              {data.companyComparison.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="py-24 text-center text-slate-500 flex flex-col items-center gap-2">
          <Loader2 size={28} className="animate-spin text-emerald-400" />
          <p className="text-xs">Processando agregações do banco de dados...</p>
        </div>
      ) : !data ? null : (
        <>
          {/* Grid de KPIs Consolidado */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                <Video size={15} className="text-emerald-400" /> Total de DDSs
              </span>
              <p className="text-3xl font-black text-white">{kpis?.totalMeetings}</p>
              <p className="text-[11px] text-slate-500">
                {kpis?.presentialMeetings} presenciais • {kpis?.remoteMeetings} ao vivo
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                <FileCheck2 size={15} className="text-green-400" /> Presenças Totais
              </span>
              <p className="text-3xl font-black text-green-400">{kpis?.totalAttendees}</p>
              <p className="text-[11px] text-slate-500">
                Média de {kpis?.avgAttendeesPerMeeting} participantes/DDS
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                <Award size={15} className="text-amber-400" /> Média de Aproveitamento
              </span>
              <p className="text-3xl font-black text-amber-400">{kpis?.avgScore} pts</p>
              <p className="text-[11px] text-slate-500">
                Taxa de aprovação: <strong className="text-emerald-400">{kpis?.approvalRate}%</strong>
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                <TrendingUp size={15} className="text-blue-400" /> Respostas de Avaliações
              </span>
              <p className="text-3xl font-black text-white">{kpis?.totalAttempts}</p>
              <p className="text-[11px] text-slate-500">
                {kpis?.totalQuizzes} questionários publicados
              </p>
            </div>
          </div>

          {/* Gráfico de Evolução Mensal e Níveis de Desempenho */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Gráfico de Barras CSS: Evolução Mensal de DDSs */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" /> Evolução de Treinamentos por Período
              </h3>

              {data.monthlyEvolution.length === 0 ? (
                <p className="text-xs text-slate-500 py-12 text-center">Nenhum dado temporal disponível.</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {data.monthlyEvolution.map((item, idx) => {
                    const maxMonthly = Math.max(...data.monthlyEvolution.map((m) => m.ddsTotal), 1);
                    const pct = Math.round((item.ddsTotal / maxMonthly) * 100);

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-bold">{item.month}</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {item.ddsTotal} reuniões ({item.presential} presenciais, {item.remote} ao vivo)
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Distribuição por Nível de Desempenho */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award size={16} className="text-amber-400" /> Distribuição de Níveis
                </h3>
                <p className="text-xs text-slate-400">Classificação das tentativas dos colaboradores</p>
              </div>

              <div className="space-y-2.5">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-400 block">EXCELENTE (90-100)</span>
                    <span className="text-[10px] text-slate-500">Desempenho máximo</span>
                  </div>
                  <span className="text-xl font-black text-white">
                    {data.levelDistribution['EXCELLENT'] || 0}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-green-400 block">APROVADO (70-89)</span>
                    <span className="text-[10px] text-slate-500">Atingiu média satisfatória</span>
                  </div>
                  <span className="text-xl font-black text-white">
                    {data.levelDistribution['PASS'] || 0}
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-red-400 block">CRÍTICO (&lt;40)</span>
                    <span className="text-[10px] text-slate-500">Necessita reforço de capacitação</span>
                  </div>
                  <span className="text-xl font-black text-white">
                    {data.levelDistribution['CRITICAL'] || 0}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 text-center">
                Total de {kpis?.totalAttempts} avaliações processadas
              </div>
            </div>
          </div>

          {/* Tabela Comparativa de Utilização por Empresa */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 size={16} className="text-blue-400" /> Comparativo de Utilização Multi-Tenant
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="pb-3 font-semibold">Empresa / Fazenda</th>
                    <th className="pb-3 font-semibold text-center">Situação</th>
                    <th className="pb-3 font-semibold text-center">Técnicos</th>
                    <th className="pb-3 font-semibold text-center">DDSs Realizados</th>
                    <th className="pb-3 font-semibold text-center">Presenças</th>
                    <th className="pb-3 font-semibold text-center">Avaliações</th>
                    <th className="pb-3 font-semibold text-right">Média Presenças/DDS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.companyComparison.map((comp) => {
                    const avg = comp.meetingsCount > 0 ? (comp.attendeesCount / comp.meetingsCount).toFixed(1) : '0';

                    return (
                      <tr key={comp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 font-bold text-white">
                          {comp.name}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              comp.status === 'ACTIVE'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {comp.status === 'ACTIVE' ? 'ATIVA' : 'SUSPENSA'}
                          </span>
                        </td>
                        <td className="py-3 text-center text-slate-300 font-bold">
                          {comp.usersCount}
                        </td>
                        <td className="py-3 text-center text-emerald-400 font-bold">
                          {comp.meetingsCount}
                        </td>
                        <td className="py-3 text-center text-green-400 font-bold">
                          {comp.attendeesCount}
                        </td>
                        <td className="py-3 text-center text-amber-400 font-bold">
                          {comp.quizzesCount}
                        </td>
                        <td className="py-3 text-right font-mono text-slate-300 font-bold">
                          {avg}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
