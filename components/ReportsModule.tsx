'use client';

import React, { useState } from 'react';
import {
  FileDown,
  FileText,
  BarChart3,
  Building2,
  Users,
  Video,
  Award,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { generateConsolidatedDdsPdf, generateExecutiveBiPdf } from '@/lib/pdfGenerator';

interface ReportsModuleProps {
  companies: any[];
  metrics: any;
}

export default function ReportsModule({ companies, metrics }: ReportsModuleProps) {
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  const handleGenerateDossieDds = async () => {
    setIsGenerating('DDS_DOSSIE');
    try {
      const res = await fetch('/api/master/dds?limit=200', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        generateConsolidatedDdsPdf({
          organizerName: 'SuperAdmin Alexandre Machado',
          organizerRole: 'Administrador Master DDS-ON',
          companyName: 'Todas as Empresas Clientes',
          meetings: (data.meetings || []).map((m: any) => ({
            topic: m.topic,
            farm: m.farm,
            type: m.type,
            createdAt: m.createdAt,
            attendees: Array.from({ length: m.attendeesCount }),
            company: m.company,
            organizer: m.organizer
          }))
        });
      }
    } catch (err) {
      console.error('Erro ao gerar dossiê DDS:', err);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleGenerateBiDossie = async () => {
    setIsGenerating('BI_DOSSIE');
    try {
      const res = await fetch('/api/master/bi?period=all', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        generateExecutiveBiPdf({
          period: 'Histórico Completo Consolidado',
          generatedBy: 'SuperAdmin Alexandre Machado',
          totalCompanies: data.companyComparison.length,
          activeCompanies: data.companyComparison.filter((c: any) => c.status === 'ACTIVE').length,
          totalUsers: data.companyComparison.reduce((acc: number, c: any) => acc + c.usersCount, 0),
          totalMeetings: data.kpis.totalMeetings,
          totalAttendees: data.kpis.totalAttendees,
          totalQuizzes: data.kpis.totalQuizzes,
          totalAttempts: data.kpis.totalAttempts,
          avgScore: data.kpis.avgScore,
          approvalRate: data.kpis.approvalRate,
          companyComparison: data.companyComparison
        });
      }
    } catch (err) {
      console.error('Erro ao gerar dossiê BI:', err);
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-2">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <FileDown className="text-green-400" size={22} /> Central de Relatórios Administrativos
        </h2>
        <p className="text-xs text-slate-400">
          Geração e exportação instantânea de dossiês gerenciais oficiais em PDF com dados auditados.
        </p>
      </div>

      {/* Grid de Relatórios Disponíveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Relatório Executivo de BI */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl w-fit border border-emerald-500/20">
              <BarChart3 size={24} />
            </div>
            <h3 className="text-base font-bold text-white">Relatório Executivo de BI & Indicadores</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dossiê completo contendo visão macro de todas as empresas, volumetria de DDSs, total de presenças auditadas, médias de aproveitamento e ranking de utilização por cliente.
            </p>
            <div className="text-[11px] text-slate-500 space-y-1 pt-1">
              <p>• Formato: Documento PDF gerencial com paginação</p>
              <p>• Dados: Agrupamento consolidado multi-tenant</p>
            </div>
          </div>

          <button
            onClick={handleGenerateBiDossie}
            disabled={isGenerating === 'BI_DOSSIE'}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 disabled:opacity-50"
          >
            {isGenerating === 'BI_DOSSIE' ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Gerando Relatório...</span>
              </>
            ) : (
              <>
                <FileDown size={15} />
                <span>Exportar Dossiê de BI PDF</span>
              </>
            )}
          </button>
        </div>

        {/* Card 2: Dossiê de Treinamentos DDS */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="p-3 bg-green-500/10 text-green-400 rounded-2xl w-fit border border-green-500/20">
              <Video size={24} />
            </div>
            <h3 className="text-base font-bold text-white">Dossiê Consolidado de DDS e Presenças</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Relação detalhada de todos os diálogos de segurança realizados no período, com identificação das fazendas/locais, técnicos organizadores, modalidades e contagem de presenças.
            </p>
            <div className="text-[11px] text-slate-500 space-y-1 pt-1">
              <p>• Formato: Tabela analítica completa com cabeçalho oficial</p>
              <p>• Conformidade: Auditoria de Segurança do Trabalho (SST)</p>
            </div>
          </div>

          <button
            onClick={handleGenerateDossieDds}
            disabled={isGenerating === 'DDS_DOSSIE'}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isGenerating === 'DDS_DOSSIE' ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Compilando Dossiê...</span>
              </>
            ) : (
              <>
                <FileDown size={15} className="text-green-400" />
                <span>Exportar Dossiê de DDS PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
