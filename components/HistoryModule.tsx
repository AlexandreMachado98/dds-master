'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  ShieldCheck,
  Building2,
  Users,
  Video,
  HelpCircle,
  RefreshCw,
  Loader2,
  Filter
} from 'lucide-react';

interface TimelineItem {
  id: string;
  type: 'AUDIT' | 'COMPANY' | 'USER' | 'MEETING' | 'QUIZ';
  action: string;
  title: string;
  description: string;
  actor: string;
  createdAt: string;
  metadata?: any;
}

export default function HistoryModule() {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);

      const res = await fetch(`/api/master/historico?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setTimeline(data.timeline || []);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredTimeline = timeline.filter((item) => {
    if (typeFilter === 'ALL') return true;
    return item.type === typeFilter;
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <History className="text-emerald-400" size={22} /> Histórico Global & Trilha de Auditoria
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro persistido de eventos operacionais, cadastros e ações administrativas executadas na plataforma.
            </p>
          </div>

          <button
            onClick={fetchHistory}
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
              placeholder="Buscar por ação, operador, valor alterado ou descrição..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[42px]"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto w-full sm:w-auto">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'AUDIT', label: 'Auditoria SuperAdmin' },
              { id: 'MEETING', label: 'DDS' },
              { id: 'QUIZ', label: 'Questionários' },
              { id: 'COMPANY', label: 'Empresas' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  typeFilter === tab.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline de Atividades */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-emerald-500" />
            <p className="text-xs">Consultando trilha de auditoria...</p>
          </div>
        ) : filteredTimeline.length === 0 ? (
          <div className="py-20 text-center text-slate-500 space-y-2">
            <History size={36} className="mx-auto opacity-30 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-300">Nenhum evento registrado</p>
            <p className="text-xs">Não foram encontradas atividades recentes para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTimeline.map((item) => {
              const iconMap = {
                AUDIT: <ShieldCheck size={16} className="text-amber-400" />,
                COMPANY: <Building2 size={16} className="text-blue-400" />,
                USER: <Users size={16} className="text-emerald-400" />,
                MEETING: <Video size={16} className="text-green-400" />,
                QUIZ: <HelpCircle size={16} className="text-purple-400" />
              };

              return (
                <div
                  key={item.id}
                  className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 shrink-0 mt-0.5">
                      {iconMap[item.type] || <History size={16} className="text-slate-400" />}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">{item.title}</span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-800 text-slate-300">
                          {item.type}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 break-words">{item.description}</p>

                      <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                        <span>Operador: <strong className="text-slate-300">{item.actor}</strong></span>
                        {item.metadata?.ipAddress && (
                          <span>• IP: {item.metadata.ipAddress}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-slate-500 text-[11px] block">
                      {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="font-mono text-slate-600 text-[10px] block">
                      {new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
