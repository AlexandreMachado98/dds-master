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
  Square,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { generateDdsPdf } from '@/lib/pdfGenerator';

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
  /** DDS Semanal (link fixo): encerra sozinho no fim do tema. */
  isWeekly?: boolean;
}

/** DDS ao vivo há mais que isso é tratado como "esquecido aberto". */
const STALE_HOURS = 12;

function hoursOpen(createdAt: string): number {
  return (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
}

function openForLabel(createdAt: string): string {
  const h = hoursOpen(createdAt);
  if (h < 1) return 'aberto há menos de 1 h';
  if (h < 48) return `aberto há ${Math.floor(h)} h`;
  return `aberto há ${Math.floor(h / 24)} dias`;
}

export default function MeetingsModule() {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [ending, setEnding] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

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

  const staleMeetings = meetings.filter(
    (m) => m.status === 'LIVE' && !m.isWeekly && hoursOpen(m.createdAt) >= STALE_HOURS
  );

  // Encerra pelo Master DDS que ficaram abertos à toa (mesmo efeito do botão do organizador).
  const endMeetings = async (ids: string[], question: string, key: string) => {
    if (ids.length === 0 || !window.confirm(question)) return;
    setEnding(key);
    setNotice(null);
    try {
      const res = await fetch('/api/master/dds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', meetingIds: ids })
      });
      const data = await res.json().catch(() => ({}));
      setNotice({ ok: Boolean(data.success), text: data.message || data.error || 'Não foi possível encerrar.' });
      await fetchMeetings();
    } catch {
      setNotice({ ok: false, text: 'Erro de conexão com o servidor.' });
    } finally {
      setEnding(null);
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

      {notice && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            notice.ok ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {notice.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notice.text}</span>
        </div>
      )}

      {staleMeetings.length > 0 && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-px" />
            <span>
              <strong>{staleMeetings.length} DDS {staleMeetings.length === 1 ? 'está aberto' : 'estão abertos'} há mais de {STALE_HOURS} h</strong>
              {' '}e ainda {staleMeetings.length === 1 ? 'aceita' : 'aceitam'} assinaturas. Encerrar fecha a lista e gera a ata com quem já assinou.
            </span>
          </p>
          <button
            type="button"
            onClick={() => endMeetings(
              staleMeetings.map((m) => m.id),
              `Encerrar ${staleMeetings.length} DDS abertos há mais de ${STALE_HOURS} h?\n\nA lista de presença deles fecha e a ata fica com quem já assinou. O organizador ainda pode reabrir a coleta no DDS-ON.`,
              'bulk'
            )}
            disabled={ending !== null}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-60"
          >
            {ending === 'bulk' ? <Loader2 size={14} className="animate-spin" /> : <Square size={13} />}
            <span>Encerrar todos ({staleMeetings.length})</span>
          </button>
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
                    {m.status === 'LIVE' && (
                      <>
                        <span>•</span>
                        <span className={hoursOpen(m.createdAt) >= STALE_HOURS && !m.isWeekly ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                          {m.isWeekly ? 'DDS Semanal (encerra sozinho)' : openForLabel(m.createdAt)}
                        </span>
                      </>
                    )}
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

                  {m.status === 'LIVE' && !m.isWeekly && (
                    <button
                      type="button"
                      onClick={() => endMeetings(
                        [m.id],
                        `Encerrar o DDS "${m.topic}"${m.company ? ` (${m.company.name})` : ''}?\n\nA lista de presença fecha e a ata fica com os ${m.attendeesCount} que já assinaram. O organizador ainda pode reabrir a coleta no DDS-ON.`,
                        m.id
                      )}
                      disabled={ending !== null}
                      className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-60"
                      title="Encerrar este DDS"
                    >
                      {ending === m.id ? <Loader2 size={14} className="animate-spin" /> : <Square size={13} />}
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
