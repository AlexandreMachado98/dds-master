'use client';

import React, { useState } from 'react';
import { Users, Trash2, AlertTriangle, CheckCircle2, Info, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserItem {
  id: string;
  name: string;
  email: string;
  position?: string | null;
  role?: string;
  status: string;
  createdAt: string;
  _count?: { meetings: number };
}

export default function CompanyUserTable({ initialUsers }: { initialUsers: UserItem[] }) {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'info' });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (processingUserId === userId) return;

    setConfirmDialog({
      title: 'Excluir Técnico da Plataforma',
      message: `Tem certeza que deseja excluir permanentemente o técnico "${userName}"? Ele perderá imediatamente o acesso e todos os seus registros de DDS serão removidos.`,
      onConfirm: async () => {
        setProcessingUserId(userId);
        try {
          const res = await fetch('/api/master', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          });
          const data = await res.json();
          if (data.success) {
            setUsers((prev) => prev.filter((u) => u.id !== userId));
            showToast('Técnico e registros excluídos com sucesso!', 'success');
            router.refresh();
          } else {
            showToast(data.error || 'Erro ao excluir.', 'error');
          }
        } catch {
          showToast('Erro de conexão com o servidor.', 'error');
        } finally {
          setProcessingUserId(null);
        }
        setConfirmDialog(null);
      }
    });
  };

  return (
    <>
      {/* TOAST NOTIFICATION RESPONSIVO */}
      {toast.show && (
        <div className={`fixed bottom-4 left-3 right-3 sm:bottom-auto sm:top-6 sm:left-auto sm:right-6 z-[60] max-w-md mx-auto sm:mx-0 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 sm:slide-in-from-top-5 duration-300 backdrop-blur-md ${
          toast.type === 'success' ? 'bg-green-950/95 border-green-500/50 text-green-100' :
          toast.type === 'error' ? 'bg-red-950/95 border-red-500/50 text-red-100' :
          'bg-slate-900/95 border-slate-700 text-slate-100'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={20} className="text-green-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle size={20} className="text-red-400 shrink-0" />}
          {toast.type === 'info' && <Info size={20} className="text-blue-400 shrink-0" />}
          <p className="text-xs sm:text-sm font-semibold">{toast.message}</p>
        </div>
      )}

      {/* MODAL CONFIRM RESPONSIVO */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] max-h-[90dvh] overflow-y-auto my-auto">
            <div className="flex items-center gap-3 mb-3 text-amber-400">
              <AlertTriangle size={22} className="shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-white">{confirmDialog.title}</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
              <button 
                onClick={() => setConfirmDialog(null)} 
                className="w-full sm:flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-xs sm:text-sm min-h-[44px]"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDialog.onConfirm} 
                className="w-full sm:flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all text-xs sm:text-sm min-h-[44px]"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users size={18} className="text-green-400 shrink-0" /> Técnicos e Organizadores ({users.length})
            </h2>
            <p className="text-xs text-slate-400">Profissionais autorizados a conduzir treinamentos e coletar presenças nesta empresa</p>
          </div>
        </div>

        {/* 1. VISUALIZAÇÃO MOBILE EM CARDS (< 768px) */}
        <div className="block md:hidden space-y-3">
          {users.length === 0 ? (
            <p className="py-8 text-center text-slate-500 text-xs">
              Nenhum técnico vinculado a esta empresa até o momento.
            </p>
          ) : (
            users.map((user) => {
              const isProcessing = processingUserId === user.id;

              return (
                <div key={user.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-500 break-all">{user.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 border ${
                      user.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      user.status === 'PENDING_APPROVAL' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {user.status === 'ACTIVE' ? '🟢 ATIVO' :
                       user.status === 'PENDING_APPROVAL' ? '🟡 PENDENTE' : '🔴 BLOQUEADO'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-900">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Cargo / Função</span>
                      <span className="text-slate-200 font-medium text-xs truncate block">{user.position || user.role || 'Técnico'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">DDSs Ministrados</span>
                      <span className="font-bold text-green-400 text-xs">{user._count?.meetings || 0} reuniões</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                    <span>Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}</span>
                    <button
                      onClick={() => handleDeleteUser(user.id, user.name)}
                      disabled={isProcessing}
                      className="p-2.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all border border-red-500/30 min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
                      title="Excluir técnico"
                    >
                      {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. VISUALIZAÇÃO TABULAR DESKTOP (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Nome do Profissional</th>
                <th className="pb-3 font-semibold">Função / Cargo</th>
                <th className="pb-3 font-semibold">DDSs Ministrados</th>
                <th className="pb-3 font-semibold">Status de Acesso</th>
                <th className="pb-3 font-semibold">Data de Cadastro</th>
                <th className="pb-3 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Nenhum técnico vinculado a esta empresa até o momento.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isProcessing = processingUserId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4">
                        <p className="font-bold text-white text-sm">{user.name}</p>
                        <p className="text-[11px] text-slate-500">{user.email}</p>
                      </td>
                      <td className="py-4 text-slate-300">
                        <span className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 font-medium">
                          {user.position || user.role || 'Técnico'}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className="font-bold text-green-400 text-sm">
                          {user._count?.meetings || 0}
                        </span>
                        <span className="text-[10px] text-slate-500 block">reuniões criadas</span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          user.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          user.status === 'PENDING_APPROVAL' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {user.status === 'ACTIVE' ? '🟢 ATIVO' :
                           user.status === 'PENDING_APPROVAL' ? '🟡 PENDENTE' : '🔴 BLOQUEADO'}
                        </span>
                      </td>
                      <td className="py-4 text-slate-400 font-mono text-[11px]">
                        {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          disabled={isProcessing}
                          className="p-2 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all border border-red-500/30 shadow-sm disabled:opacity-50 min-h-[36px] min-w-[36px]"
                          title="Excluir técnico permanentemente"
                        >
                          {isProcessing ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}