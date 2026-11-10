'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Video,
  Search,
  MapPin,
  Calendar,
  Building2,
  Users,
  RefreshCw,
  Loader2,
  FileText,
  FileDown,
  StopCircle,
  Clock
} from 'lucide-react';
import { generateDdsPdf } from '@/lib/pdfGenerator';

// DDS aberto há mais que isso é destacado como provavelmente esquecido
const FORGOTTEN_AFTER_HOURS = 12;

function formatOpenDuration(createdAt: string): { label: string; hours: number } {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hours < 1) return { label: `${Math.max(1, Math.round(hours * 60))} min`, hours };
  if (hours < 48) return { label: `${Math.floor(hours)} h`, hours };
  return { label: `${Math.floor(hours / 24)} dias`, hours };
}

interface MeetingItem {
  id: string;
  topic: string;
  farm: string;
  status: string;
  type: string;
  objective: string | null;
  instructorName: string;
  createdAt: string;
  endedAt: string | null;
  company: { id: string; name: string } | null;
  organizer: { id: string; name: string; email: string } | null;
  attendeesCount: number;
  attachmentsCount: number;
  quizzesCount: number;
}

export default function MeetingsModule() {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [endingId, setEndingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);

      const res = await fetch(`/api/master/dds?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setMeetings(data.meetings || []);
      }
    } catch (err) {
      console.error('Erro ao carregar reuniões:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleEndMeeting = async (m: MeetingItem) => {
    if (endingId) return;
    const organizer = m.organizer?.name || m.instructorName;
    const ok = window.confirm(
      `Encerrar o DDS "${m.topic}"?\n\n` +
        `Empresa: ${m.company?.name || 'não vinculada'}\n` +
        `Organizador: ${organizer}\n` +
        `Aberto há: ${formatOpenDuration(m.createdAt).label}\n` +
        `Presentes: ${m.attendeesCount}\n\n` +
        'A lista de presença será fechada e ninguém mais poderá assinar. A ata continua disponível no histórico.'
    );
    if (!ok) return;

    setEndingId(m.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/master/dds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: m.id, action: 'end_meeting' })
      });
      const data = await res.json().catch(() => ({ success: false, error: 'Resposta inválida do servidor.' }));
      if (res.ok && data.success) {
        setMeetings((prev) =>
          prev.map((x) =>
            x.id === m.id ? { ...x, status: 'ENDED', endedAt: data.meeting?.endedAt || new Date().toISOString() } : x
          )
        );
        setFeedback({ type: 'success', text: data.message || 'DDS encerrado.' });
      } else {
        setFeedback({ type: 'error', text: data.error || 'Não foi possível encerrar o DDS.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Falha de conexão ao encerrar o DDS.' });
    } finally {
      setEndingId(null);
    }
  };

  const handleDownloadAta = (m: MeetingItem) => {
    generateDdsPdf({
      topic: m.topic,
      farm: m.farm,
      type: m.type,
      objective: m.objective || undefined,
      createdAt: m.createdAt,
      attendees: [],
      organizer: {
        name: m.organizer?.name || m.instructorName,
        company: m.company?.name || undefined
      },
      company: m.company ? { name: m.company.name } : undefined
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Video className="text-emerald-400" size={22} /> Monitoramento Global de DDS
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Supervisão de todos os treinamentos presenciais e remotos realizados pelas empresas clientes.
            </p>
          </div>

          <button
            onClick={fetchMeetings}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por tema, local/fazenda, empresa ou instrutor..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[42px]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[42px] flex-1 sm:flex-none"
            >
              <option value="ALL">Todos os Status</option>
              <option value="LIVE">Em Andamento (Ao Vivo)</option>
              <option value="ENDED">Encerrados</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[42px] flex-1 sm:flex-none"
            >
              <option value="ALL">Todas Modalidades</option>
              <option value="PRESENTIAL">Presencial (Campo)</option>
              <option value="REMOTE">Remoto (Ao Vivo)</option>
            </select>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-bold border ${
            feedback.type === 'success'
              ? 'bg-green-500/10 text-green-300 border-green-500/30'
              : 'bg-red-500/10 text-red-300 border-red-500/30'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Listagem */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-emerald-500" />
            <p className="text-xs">Carregando treinamentos DDS...</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="py-20 text-center text-slate-500 space-y-2">
            <Video size={36} className="mx-auto opacity-30 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-300">Nenhum treinamento encontrado</p>
            <p className="text-xs">Altere os filtros de busca para visualizar outros registros.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-emerald-400 font-bold">
                      {m.company?.name || 'Empresa não vinculada'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                        m.status === 'LIVE'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {m.status === 'LIVE' ? 'EM ANDAMENTO' : 'ENCERRADO'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {m.type === 'REMOTE' ? '📹 AO VIVO' : '👥 CAMPO'}
                    </span>
                    {m.status === 'LIVE' && (() => {
                      const open = formatOpenDuration(m.createdAt);
                      const forgotten = open.hours >= FORGOTTEN_AFTER_HOURS;
                      return (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] font-bold flex items-center gap-1 ${
                            forgotten
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                          title={forgotten ? 'Aberto há muito tempo: provavelmente esquecido' : undefined}
                        >
                          <Clock size={10} /> ABERTO HÁ {open.label.toUpperCase()}
                        </span>
                      );
                    })()}
                  </div>

                  <h3 className="font-bold text-white text-sm truncate">{m.topic}</h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-slate-500" /> {m.farm}
                    </span>
                    <span>•</span>
                    <span>Instrutor: <strong className="text-slate-200">{m.instructorName}</strong></span>
                    <span>•</span>
                    <span className="text-slate-500">
                      {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-900">
                  <div className="text-left md:text-right">
                    <span className="font-black text-green-400 text-sm block">
                      {m.attendeesCount} presentes
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {m.quizzesCount > 0 ? `${m.quizzesCount} avaliação vinculada` : 'Sem questionário'}
                    </span>
                  </div>

                  {m.status === 'LIVE' && (
                    <button
                      onClick={() => handleEndMeeting(m)}
                      disabled={endingId !== null}
                      className="px-3.5 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Encerrar este DDS e fechar a lista de presença"
                    >
                      {endingId === m.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <StopCircle size={14} />
                      )}
                      <span>Encerrar</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDownloadAta(m)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    title="Baixar Ata Oficial de DDS"
                  >
                    <FileDown size={14} className="text-green-400" />
                    <span>Ata PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
