 'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, Building2, Users, Video, BarChart3, 
  Lock, Unlock, RefreshCw, PlusCircle, 
  Flame, TrendingUp, CheckCircle2, AlertTriangle, Check, X, ExternalLink, LogOut, Info, Loader2, KeyRound, Trash2, UserX, Link2,
  Menu, Settings, Database, ShieldCheck, HelpCircle, Layers
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

interface UnlinkedUser {
  id: string;
  name: string;
  email: string;
  position: string | null;
  company: string | null;
  status: string;
  createdAt: string;
  _count?: { meetings: number };
}

export default function MasterDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'COMPANIES' | 'APPROVALS' | 'UNLINKED' | 'SETTINGS'>('ANALYTICS');
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const [unlinkedUsers, setUnlinkedUsers] = useState<UnlinkedUser[]>([]);
  const [selectedCompanyForUser, setSelectedCompanyForUser] = useState<Record<string, string>>({});

  // Formulário de Nova Empresa
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDoc, setNewCompanyDoc] = useState('');
  const [newCompanyKey, setNewCompanyKey] = useState('');
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  // Notificações e Diálogos
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
        setUnlinkedUsers(data.unlinkedUsers || []);
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

  const handleLinkUserToCompany = async (userId: string) => {
    const targetCompanyId = selectedCompanyForUser[userId];
    if (!targetCompanyId) {
      showToast('Selecione uma empresa na lista para vincular.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/master', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_user_company',
          userId,
          targetCompanyId
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Técnico vinculado à empresa com sucesso!', 'success');
        loadDashboardData();
      } else {
        showToast(data.error || 'Erro ao vincular empresa.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao vincular.', 'error');
    }
  };

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

  const navItems = [
    {
      id: 'ANALYTICS',
      label: 'BI & Analytics',
      icon: BarChart3,
      badge: null
    },
    {
      id: 'COMPANIES',
      label: 'Empresas Clientes',
      icon: Building2,
      badge: companies.length
    },
    {
      id: 'APPROVALS',
      label: 'Fila de Aprovação',
      icon: Users,
      badge: pendingUsers.length > 0 ? pendingUsers.length : null,
      badgeColor: 'bg-amber-500 text-slate-950'
    },
    {
      id: 'UNLINKED',
      label: 'Usuários Sem Empresa',
      icon: UserX,
      badge: unlinkedUsers.length > 0 ? unlinkedUsers.length : null,
      badgeColor: 'bg-blue-500 text-white'
    },
    {
      id: 'SETTINGS',
      label: 'Configurações Master',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row relative">
      
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

      {/* ========================================================================= */}
      {/* 1. BARRA DE MENU LATERAL (SIDEBAR) */}
      {/* ========================================================================= */}
      <aside className={`
        fixed md:sticky top-0 z-40 h-screen w-72 bg-slate-900/95 border-r border-slate-800 backdrop-blur-xl p-5 flex flex-col justify-between transition-transform duration-300
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-6">
          
          {/* Logo e Cabeçalho da Sidebar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-500/10 text-green-400 rounded-2xl border border-green-500/20">
                <ShieldAlert size={26} />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1">
                  DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span> <span className="text-slate-400 text-xs font-bold">MASTER</span>
                </h1>
                <span className="text-[9px] bg-green-500/20 text-green-300 border border-green-500/30 font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
            </div>

            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-white p-1"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navegação Principal */}
          <nav className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
              Menu Administrativo
            </p>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-600/20' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== null && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : (item.badgeColor || 'bg-slate-800 text-slate-300')
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></div>
              <div>
                <p className="text-[11px] font-bold text-white">Banco Supabase</p>
                <p className="text-[9px] text-green-400">Conexão Ativa & Segura</p>
              </div>
            </div>
            <Database size={15} className="text-slate-500" />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleManualRefresh}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
              title="Recarregar Dados"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Sincronizar</span>
            </button>

            <button
              onClick={handleLogout}
              className="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center border border-red-500/30 transition-colors"
              title="Sair do Painel"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay para fechar menu no mobile */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 z-30 md:hidden backdrop-blur-sm"
        />
      )}

      {/* ========================================================================= */}
      {/* 2. ÁREA DE CONTEÚDO PRINCIPAL (MAIN CONTENT) */}
      {/* ========================================================================= */}
      <main className="flex-1 min-h-screen p-4 md:p-8 flex flex-col justify-between overflow-x-hidden">
        
        <div className="space-y-6 max-w-6xl w-full mx-auto">
          
          {/* Barra Superior Mobile e Título da Seção */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300 md:hidden"
              >
                <Menu size={20} />
              </button>
              
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white">
                  {navItems.find(i => i.id === activeTab)?.label}
                </h2>
                <p className="text-xs text-slate-400">
                  Painel de Controle Central • AM TST
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-medium">
                Última sincronização: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Cards de Métricas Globais (Sempre visíveis no topo) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Building2 size={15} className="text-blue-400" /> Empresas Clientes
              </span>
              <p className="text-3xl font-black text-white">{metrics.totalCompanies}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Video size={15} className="text-emerald-400" /> DDSs Realizados
              </span>
              <p className="text-3xl font-black text-white">{metrics.totalMeetings}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Users size={15} className="text-green-400" /> Presenças Auditadas
              </span>
              <p className="text-3xl font-black text-green-400">{metrics.totalAttendees}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1 shadow-lg">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-amber-400" /> Fila de Pendentes
              </span>
              <p className="text-3xl font-black text-amber-400">{metrics.pendingApprovals}</p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO 1: BI & ANALYTICS */}
          {/* ========================================================================= */}
          {activeTab === 'ANALYTICS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-5 shadow-xl">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Flame size={18} className="text-amber-500" /> Temas Mais Debatidos no Campo
                  </h3>
                  <p className="text-xs text-slate-400">Assuntos mais frequentes nos treinamentos</p>
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
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp size={18} className="text-green-400" /> Empresas com Maior Engajamento
                  </h3>
                  <p className="text-xs text-slate-400">Clientes que mais realizam treinamentos</p>
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

          {/* ========================================================================= */}
          {/* SEÇÃO 2: EMPRESAS */}
          {/* ========================================================================= */}
          {activeTab === 'COMPANIES' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PlusCircle size={18} className="text-green-500" /> Cadastrar Empresa Cliente e Gerar Chave Mágica
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
                <h3 className="text-base font-bold text-white">Empresas Cadastradas ({companies.length})</h3>

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

          {/* ========================================================================= */}
          {/* SEÇÃO 3: FILA DE APROVAÇÃO */}
          {/* ========================================================================= */}
          {activeTab === 'APPROVALS' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users size={18} className="text-amber-400" /> Aprovação Manual de Organizadores ({pendingUsers.length})
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

          {/* ========================================================================= */}
          {/* SEÇÃO 4: USUÁRIOS SEM EMPRESA */}
          {/* ========================================================================= */}
          {activeTab === 'UNLINKED' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserX size={18} className="text-blue-400" /> Usuários Sem Empresa Vinculada ({unlinkedUsers.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Técnicos que possuem cadastro mas não foram formalmente vinculados a uma empresa cliente.
                </p>
              </div>

              {unlinkedUsers.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <CheckCircle2 size={36} className="mx-auto opacity-30 text-blue-500" />
                  <p className="text-sm font-semibold text-slate-300">Tudo Organizado!</p>
                  <p className="text-xs">Todos os usuários cadastrados estão vinculados a empresas oficiais.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Técnico / Usuário</th>
                        <th className="pb-3 font-semibold">Empresa Informada (Texto)</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">DDSs Criados</th>
                        <th className="pb-3 font-semibold">Vincular a Empresa Oficial</th>
                        <th className="pb-3 font-semibold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {unlinkedUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-4">
                            <p className="font-bold text-white text-sm">{user.name}</p>
                            <p className="text-[11px] text-slate-500">{user.email} • {user.position || 'Técnico'}</p>
                            <span className="text-[10px] text-slate-600">
                              Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </td>

                          <td className="py-4">
                            <span className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 text-amber-400 font-semibold">
                              {user.company || 'Não informado'}
                            </span>
                          </td>

                          <td className="py-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              user.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                              user.status === 'PENDING_APPROVAL' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {user.status === 'ACTIVE' ? '🟢 ATIVO' :
                               user.status === 'PENDING_APPROVAL' ? '🟡 PENDENTE' : '🔴 BLOQUEADO'}
                            </span>
                          </td>

                          <td className="py-4 font-bold text-slate-300">
                            {user._count?.meetings || 0} reuniões
                          </td>

                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedCompanyForUser[user.id] || ''}
                                onChange={(e) => setSelectedCompanyForUser({
                                  ...selectedCompanyForUser,
                                  [user.id]: e.target.value
                                })}
                                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 max-w-[200px]"
                              >
                                <option value="">Selecione uma empresa...</option>
                                {companies.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                onClick={() => handleLinkUserToCompany(user.id)}
                                disabled={!selectedCompanyForUser[user.id]}
                                className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                                  selectedCompanyForUser[user.id]
                                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white shadow-md cursor-pointer'
                                    : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50'
                                }`}
                                title="Vincular usuário à empresa selecionada"
                              >
                                <Link2 size={13} /> Vincular
                              </button>
                            </div>
                          </td>

                          <td className="py-4 text-right">
                            <button
                              onClick={() => handleDeleteUser(user.id, user.name)}
                              className="p-2 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all border border-red-500/30"
                              title="Excluir este usuário"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SEÇÃO 5: CONFIGURAÇÕES MASTER & SEGURANÇA */}
          {/* ========================================================================= */}
          {activeTab === 'SETTINGS' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Settings size={18} className="text-green-400" /> Parâmetros da Plataforma DDS ON
                  </h3>
                  <p className="text-xs text-slate-400">Configurações globais de conformidade jurídica, LGPD e banco de dados.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Card Supabase Database */}
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-2">
                        <Database size={16} className="text-green-400" /> Infraestrutura do Banco
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                        Supabase PostgreSQL
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Conexão em nuvem ativa com Transaction Pooler (PgBouncer) configurado para alta concorrência.
                    </p>
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-900 space-y-1">
                      <p>• Schema: <strong>4 Tabelas Principais (Company, User, Meeting, Attendance)</strong></p>
                      <p>• Validação anti-duplicação e FK constraints ativas</p>
                    </div>
                  </div>

                  {/* Card Segurança e Kill-Switch */}
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-400" /> Sistema Kill-Switch
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Ativado & Operante
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Ao suspender uma empresa cliente, todos os logins e presenças são bloqueados instantaneamente no DDS ON.
                    </p>
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-900 space-y-1">
                      <p>• Bloqueio na rota de autenticação (/api/auth)</p>
                      <p>• Bloqueio na emissão de presenças (/api/presenca)</p>
                    </div>
                  </div>

                </div>

                {/* Card AM TST */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">Auditoria e Propriedade Intelectual</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Desenvolvido e Gerenciado com exclusividade por <strong>AM TST (Alexandre Machado)</strong>.
                    </p>
                  </div>

                  <a
                    href="https://amtst.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Portal AM TST</span>
                    <ExternalLink size={13} />
                  </a>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Rodapé da Página Principal */}
        <footer className="mt-12 pt-6 border-t border-slate-900 text-center space-y-1.5 max-w-6xl w-full mx-auto">
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
    </div>
  );
}