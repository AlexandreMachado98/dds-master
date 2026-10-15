'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Search,
  ShieldCheck,
  Camera,
  PenTool,
  Clock,
  RefreshCw,
  Loader2,
  UserCheck,
  AlertCircle
} from 'lucide-react';

interface AttendanceItem {
  id: string;
  name: string;
  cpf: string;
  hasSelfie: boolean;
  hasSignature: boolean;
  hasExitSignature: boolean;
  exitReason: string | null;
  leftAt: string | null;
  createdAt: string;
  quizAttemptsCount: number;
  meeting: {
    id: string;
    topic: string;
    farm: string;
    status: string;
    companyName: string;
  } | null;
}

export default function AttendancesModule() {
  const [attendances, setAttendances] = useState<AttendanceItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAttendances = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);

      const res = await fetch(`/api/master/presencas?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setAttendances(data.attendances || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Erro ao buscar presenças:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchAttendances();
  }, [fetchAttendances]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <FileCheck2 className="text-green-400" size={22} /> Auditoria de Presenças e Assinaturas
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Registros de participação auditados com biometria facial, assinatura digital e conformidade LGPD.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-green-400">
              {totalCount} presenças auditadas
            </span>
            <button
              onClick={fetchAttendances}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors flex items-center"
              title="Atualizar"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Barra de Busca */}
        <div className="relative w-full pt-2">
          <Search size={15} className="absolute left-3.5 top-5.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do colaborador, CPF mascarado ou tema do DDS..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 min-h-[42px]"
          />
        </div>
      </div>

      {/* Listagem */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-green-500" />
            <p className="text-xs">Consultando presenças auditadas...</p>
          </div>
        ) : attendances.length === 0 ? (
          <div className="py-20 text-center text-slate-500 space-y-2">
            <UserCheck size={36} className="mx-auto opacity-30 text-green-500" />
            <p className="text-sm font-semibold text-slate-300">Nenhum registro de presença encontrado</p>
            <p className="text-xs">Não foram encontrados participantes correspondentes aos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="pb-3 font-semibold">Colaborador / CPF</th>
                  <th className="pb-3 font-semibold">Empresa & Treinamento DDS</th>
                  <th className="pb-3 font-semibold text-center">Biometria Facial</th>
                  <th className="pb-3 font-semibold text-center">Assinatura Digital</th>
                  <th className="pb-3 font-semibold text-center">Avaliação Eficácia</th>
                  <th className="pb-3 font-semibold text-right">Data & Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {attendances.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5">
                      <p className="font-bold text-white text-sm">{att.name}</p>
                      <p className="font-mono text-slate-400 text-[11px]">{att.cpf}</p>
                    </td>

                    <td className="py-3.5">
                      <p className="font-semibold text-green-400 text-xs">
                        {att.meeting?.companyName || 'Empresa Geral'}
                      </p>
                      <p className="text-slate-300 text-xs truncate max-w-xs">
                        {att.meeting?.topic || 'DDS Presencial'}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {att.meeting?.farm}
                      </span>
                    </td>

                    <td className="py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          att.hasSelfie
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        <Camera size={11} /> {att.hasSelfie ? 'Auditada' : 'Pendente'}
                      </span>
                    </td>

                    <td className="py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          att.hasSignature
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        <PenTool size={11} /> {att.hasSignature ? 'Registrada' : 'Ausente'}
                      </span>
                    </td>

                    <td className="py-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          att.quizAttemptsCount > 0
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {att.quizAttemptsCount > 0 ? `${att.quizAttemptsCount} tentativa(s)` : 'Não respondeu'}
                      </span>
                    </td>

                    <td className="py-3.5 text-right font-mono text-slate-400 text-[11px]">
                      {new Date(att.createdAt).toLocaleDateString('pt-BR')} {new Date(att.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
