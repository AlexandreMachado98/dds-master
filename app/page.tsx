 'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, Building2, Users, Video, BarChart3, 
  Lock, Unlock, RefreshCw, PlusCircle, 
  Flame, TrendingUp, CheckCircle2, AlertTriangle, Check, X, ExternalLink, LogOut, Info, Loader2, KeyRound, Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MetricData {
  totalCompanies: number;
  totalMeetings: number;
  totalAttendees: number;
  pendingApprovals: number;
}

interface TopTopic {
  topic: string;
  count: number;
}

interface CompanyData {
  id: string;
  name: string;
  document: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'PENDING_APPROVAL';
  secretKey: string | null;
  totalMeetings: number;
  totalUsers: number;
  totalAttendees: number;
}

interface PendingUser {
  id: string;
  name: string;
  email: string;
  position: string | null;
  company: string | null;
  companyRel?: { name: string } | null;
  createdAt: string;
}

export default function MasterDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'COMPANIES' | 'APPROVALS'>('ANALYTICS');
  const [loading, setLoading] = useState(true);

  // Estados dos Dados
  const [metrics, setMetrics] = useState<MetricData>({
    totalCompanies: 0,
    totalMeetings: 0,
    totalAttendees: 0,
    pendingApprovals: 0
  });
  const [topTopics, setTopTopics] = useState<TopTopic[]>([]);
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);

  // Formulário de Nova Empresa
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDoc, setNewCompanyDoc] = useState('');
  const [newCompanyKey, setNewCompanyKey] = useState('');
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  // Sistema de Notificações
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'info' });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  useEffect(() => {
    const session = localStorage.getItem('dds_master_session');
    if (!session) {
      router.push('/login');
    }
  }, [router]);

  const loadDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/master', { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        setTopTopics(data.topTopics || []);
        setCompanies(data.companies || []);
        setPendingUsers(data.pendingUsers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadDashboardData();
    const timer = setInterval(() => {
      if (isMounted) loadDashboardData();
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [loadDashboardData]);

  const handleManualRefresh = async () => {
    setLoading(true);
    await loadDashboardData();
    showToast('Dados atualizados com sucesso.', 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('dds_master_session');
    router.push('/login');
  };

  const handleToggleCompanyStatus = (companyId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMsg = nextStatus === 'SUSPENDED' 
      ? 'Deseja SUSPENDER esta empresa? O acesso de todos os técnicos e reuniões dela será pausado imediatamente.' 
      : 'Deseja REATIVAR o acesso desta empresa?';

    setConfirmDialog({
      title: nextStatus === 'SUSPENDED' ? 'Bloquear Empresa' : 'Reativar Empresa',
      message: confirmMsg,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/master', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_company_status',
              companyId,
              newStatus: nextStatus
            })
          });
          const data = await res.json();
          if (data.success) {
            showToast(nextStatus === 'SUSPENDED' ? 'Empresa suspensa com sucesso!' : 'Empresa reativada com sucesso!', 'success');
            loadDashboardData();
          } else {
            showToast('Erro ao atualizar status da empresa.', 'error');
          }
        } catch {
          showToast('Erro de conexão com o servidor.', 'error');
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleUserApproval = async (userId: string, newStatus: 'ACTIVE' | 'BLOCKED') => {
    try {
      const res = await fetch('/api/master', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_user_status',
          userId,
          newStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(newStatus === 'ACTIVE' ? 'Técnico aprovado com sucesso!' : 'Solicitação recusada e bloqueada.', 'success');
        loadDashboardData();
      } else {
        showToast('Erro ao processar a aprovação.', 'error');
      }
    } catch {
      showToast('Erro de conexão.', 'error');
    }
  };

  // =========================================================================
  // FUNÇÃO DE EXCLUSÃO DEFINITIVA DE USUÁRIO
  // =========================================================================
  const handleDeleteUser = (userId: string, userName: string) => {
    setConfirmDialog({
      title: 'Excluir Usuário Permanentemente',
      message: `Tem certeza que deseja excluir o usuário "${userName}"? Esta ação removerá o acesso definitivamente da plataforma.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/master', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          });
          const data = await res.json();
          if (data.success) {
            showToast('Usuário excluído com sucesso!', 'success');
            loadDashboardData();
          } else {
            showToast(data.error || 'Erro ao excluir usuário.', 'error');
          }
        } catch {
          showToast('Erro de conexão com o servidor.', 'error');
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newCompanyKey.trim()) {
      showToast('Preencha o nome da empresa e a palavra-chave.', 'error');
      return;
    }

    setIsCreatingCompany(true);
    try {
      const res = await fetch('/api/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCompanyName,
          document: newCompanyDoc,
          secretKey: newCompanyKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewCompanyName('');
        setNewCompanyDoc('');
        setNewCompanyKey('');
        loadDashboardData();
        showToast('Empresa cadastrada com sucesso!', 'success');
      } else {
        showToast(data.error || 'Erro ao cadastrar empresa.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao criar empresa.', 'error');
    } finally {
      setIsCreatingCompany(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 flex flex-col justify-between relative">
      
      {/* TOASTS */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[9999] px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-top-5 duration-300 ${
          toast.type === 'success' ? 'bg-green-950/90 border-green-500/50 text-green-100' :
          toast.type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-100' :
          'bg-slate-900 border-slate-700 text-slate-100'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={20} className="text-green-400" />}
          {toast.type === 'error' && <AlertTriangle size={20} className="text-red-400" />}
          {toast.type === 'info' && <Info size={20} className="text-blue-400" />}
          <p className="text-sm font-semibold">{toast.message}</p>
        </div>
      )}

      {/* MODAL CONFIRM */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <AlertTriangle size={24} />
              <h2 className="text-lg font-bold text-white">{confirmDialog.title}</h2>
            </div>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors">Cancelar</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl w-full mx-auto space-y-8">
        
        {/* Topo */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 bg-green-500/10 text-green-400 rounded-2xl border border-green-500/20">
              <ShieldAlert size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span> <span className="text-slate-400 text-lg font-bold">MASTER</span>
                </h1>
                <span className="text-[10px] bg-green-500/20 text-green-300 border border-green-500/30 font-bold px-2 py-0.5 rounded-md uppercase">
                  Super Admin
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">Centro de Controle Multi-Tenant & Inteligência de Dados</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleManualRefresh}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-slate-700"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar Dados
            </button>

            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-red-500/30"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </header>

        {/* Métricas Globais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Building2 size={15} className="text-blue-400" /> Empresas Clientes
            </span>
            <p className="text-3xl font-black text-white">{metrics.totalCompanies}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Video size={15} className="text-emerald-400" /> Total de DDSs Realizados
            </span>
            <p className="text-3xl font-black text-white">{metrics.totalMeetings}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Users size={15} className="text-green-400" /> Presenças Auditadas
            </span>
            <p className="text-3xl font-black text-green-400">{metrics.totalAttendees}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <AlertTriangle size={15} className="text-amber-400" /> Aprovações Pendentes
            </span>
            <p className="text-3xl font-black text-amber-400">{metrics.pendingApprovals}</p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl max-w-xl mx-auto">
          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'ANALYTICS' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 size={15} /> BI & Analytics
          </button>

          <button
            onClick={() => setActiveTab('COMPANIES')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'COMPANIES' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 size={15} /> Empresas ({companies.length})
          </button>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'APPROVALS' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={15} /> Fila de Aprovação
            {pendingUsers.length > 0 && (
              <span className="bg-amber-500 text-slate-950 px-1.5 rounded-full text-[10px] ml-1">{pendingUsers.length}</span>
            )}
          </button>
        </div>

        {/* ABA 1: BI & ANALYTICS */}
        {activeTab === 'ANALYTICS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Flame size={18} className="text-amber-500" /> Temas Mais Debatidos
                  </h3>
                  <p className="text-xs text-slate-400">Assuntos mais frequentes nos treinamentos</p>
                </div>
              </div>

              {topTopics.length === 0 ? (
                <p className="text-xs text-slate-500 py-10 text-center">Nenhum tema registrado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {topTopics.map((item, index) => (
                    <div key={index} className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-green-600/20 text-green-400 font-black text-xs flex items-center justify-center border border-green-500/30">
                          #{index + 1}
                        </span>
                        <span className="text-xs font-semibold text-white">{item.topic}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg">
                        {item.count} {item.count === 1 ? 'reunião' : 'reuniões'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp size={18} className="text-green-400" /> Empresas com Maior Engajamento
                  </h3>
                  <p className="text-xs text-slate-400">Clientes que mais realizam treinamentos</p>
                </div>
              </div>

              {companies.length === 0 ? (
                <p className="text-xs text-slate-500 py-10 text-center">Nenhuma empresa cadastrada.</p>
              ) : (
                <div className="space-y-3">
                  {companies.slice(0, 5).map((comp, index) => (
                    <div key={comp.id} className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-green-600/20 text-green-400 font-black text-xs flex items-center justify-center border border-green-500/30">
                          #{index + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white">{comp.name}</p>
                          <p className="text-[11px] text-slate-500">{comp.totalUsers} técnicos vinculados</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-green-400 block">{comp.totalMeetings} DDSs</span>
                        <span className="text-[10px] text-slate-400">{comp.totalAttendees} presenças</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 2: EMPRESAS */}
        {activeTab === 'COMPANIES' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle size={18} className="text-green-500" /> Cadastrar Empresa Cliente e Gerar Chave
              </h3>
              
              <form onSubmit={handleCreateCompany} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Nome da Empresa / Fazenda"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500"
                />

                <input
                  type="text"
                  value={newCompanyDoc}
                  onChange={(e) => setNewCompanyDoc(e.target.value)}
                  placeholder="CNPJ ou CPF (Opcional)"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500"
                />

                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={newCompanyKey}
                    onChange={(e) => setNewCompanyKey(e.target.value)}
                    placeholder="Palavra-Chave (Ex: AGRO26)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 font-mono uppercase"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingCompany}
                  className="sm:col-span-3 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  {isCreatingCompany ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />}
                  Cadastrar Empresa e Ativar Palavra-Chave
                </button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-bold text-white">Empresas Cadastradas</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">Empresa / Cliente</th>
                      <th className="pb-3 font-semibold">Palavra-Chave Mágica</th>
                      <th className="pb-3 font-semibold">Volume DDS</th>
                      <th className="pb-3 font-semibold">Status de Acesso</th>
                      <th className="pb-3 font-semibold text-right">Controle (Kill-Switch)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {companies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Nenhuma empresa cadastrada.
                        </td>
                      </tr>
                    ) : (
                      companies.map((comp) => {
                        const isSuspended = comp.status === 'SUSPENDED';
                        return (
                          <tr key={comp.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-4">
                              <button
                                onClick={() => router.push(`/companies/${comp.id}`)}
                                className="text-left group cursor-pointer"
                                title="Ver detalhes da empresa e técnicos"
                              >
                                <p className="font-bold text-white text-sm group-hover:text-green-400 group-hover:underline transition-colors flex items-center gap-1.5">
                                  {comp.name} 
                                  <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-green-400" />
                                </p>
                                <p className="text-[11px] text-slate-500">{comp.document || 'Sem Documento'}</p>
                              </button>
                            </td>
                            <td className="py-4">
                              <span className="font-mono bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-green-400 font-bold">
                                {comp.secretKey || 'NÃO CONFIGURADA'}
                              </span>
                            </td>
                            <td className="py-4 font-bold text-slate-300">
                              {comp.totalMeetings} reuniões<br/>
                              <span className="text-[10px] font-normal text-slate-500">{comp.totalUsers} técnicos</span>
                            </td>
                            <td className="py-4">
                              <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                                isSuspended 
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
                              }`}>
                                {isSuspended ? '🔴 SUSPENSA' : '🟢 ATIVA'}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => handleToggleCompanyStatus(comp.id, comp.status)}
                                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ml-auto transition-all ${
                                  isSuspended
                                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-md'
                                    : 'bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30'
                                }`}
                              >
                                {isSuspended ? <><Unlock size={13} /> Reativar Acesso</> : <><Lock size={13} /> Bloquear Empresa</>}
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
          </div>
        )}

        {/* ABA 3: FILA DE APROVAÇÃO (COM BOTÃO DE EXCLUIR) */}
        {activeTab === 'APPROVALS' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-amber-400" /> Aprovação Manual de Organizadores
              </h3>
              <p className="text-xs text-slate-400">Técnicos que se cadastraram sem utilizar a palavra-chave mágica da empresa.</p>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="text-center py-16 text-slate-500 space-y-2">
                <CheckCircle2 size={36} className="mx-auto opacity-30 text-green-500" />
                <p className="text-sm font-semibold text-slate-300">Fila Limpa!</p>
                <p className="text-xs">Nenhum técnico aguardando aprovação no momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-white text-sm">{user.name}</p>
                      <p className="text-xs text-slate-400">{user.email} • {user.position || 'Técnico'}</p>
                      
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                          Empresa informada: <strong className="text-amber-400">{user.company || 'Não vinculada'}</strong>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                        title="Excluir cadastro permanentemente"
                      >
                        <Trash2 size={15} />
                      </button>

                      <button
                        onClick={() => handleUserApproval(user.id, 'BLOCKED')}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <X size={14} /> Recusar
                      </button>

                      <button
                        onClick={() => handleUserApproval(user.id, 'ACTIVE')}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-md"
                      >
                        <Check size={14} /> Aprovar Acesso
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* FOOTER */}
      <footer className="mt-12 pt-6 border-t border-slate-900 text-center space-y-1.5 max-w-7xl w-full mx-auto">
        <p className="text-[11px] text-slate-500 font-normal">
          © {new Date().getFullYear()} <strong>DDS ON MASTER</strong> • Todos os direitos reservados.
        </p>
        <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
          <span>Desenvolvido e Gerenciado por</span>
          <a
            href="https://amtst.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 hover:text-green-300 font-bold inline-flex items-center gap-1 transition-colors underline underline-offset-2"
          >
            AM TST <ExternalLink size={10} />
          </a>
        </div>
      </footer>
    </main>
  );
}