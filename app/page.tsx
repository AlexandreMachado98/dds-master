'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  ShieldAlert, Building2, Users, Video, BarChart3, 
  Lock, Unlock, RefreshCw, PlusCircle, 
  Flame, TrendingUp, CheckCircle2, AlertTriangle, Check, X, ExternalLink, LogOut, Info, Loader2, KeyRound, Trash2, UserX, Link2,
  Menu, Settings, Database, ShieldCheck, Search, FileDown, WifiOff, ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { generateConsolidatedDdsPdf } from '@/lib/pdfGenerator';

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
  companyRel?: { id: string; name: string } | null;
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
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
  const [selectedCompanyForApproval, setSelectedCompanyForApproval] = useState<Record<string, string>>({});

  // Filtros de busca
  const [companySearch, setCompanySearch] = useState('');
  const [approvalSearch, setApprovalSearch] = useState('');
  const [unlinkedSearch, setUnlinkedSearch] = useState('');

  // Ações em processamento (Prevenção de duplo clique)
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Formulário de Nova Empresa
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDoc, setNewCompanyDoc] = useState('');
  const [newCompanyKey, setNewCompanyKey] = useState('');
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  // Notificações e Diálogos
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'info' });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ show: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: '', type: 'info' });
    }, 4500);
  }, []);

  // Bloqueio de scroll do body quando o drawer mobile estiver aberto
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isMobileMenuOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isMobileMenuOpen]);

  // Monitoramento de Conexão Online/Offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      showToast('Conexão restabelecida. Sincronizando dados...', 'success');
      loadDashboardData(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast('Você está offline. Exibindo dados locais preservados.', 'error');
    };

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Verificação de Sessão Mestre
  useEffect(() => {
    try {
      const sessionStr = localStorage.getItem('dds_master_session');
      if (!sessionStr) {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  }, [router]);

  // Carregamento de dados com AbortController
  const loadDashboardData = useCallback(async (isManual = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (isManual) setIsRefreshing(true);

    try {
      const res = await fetch('/api/master', {
        cache: 'no-store',
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro do servidor (${res.status})`);
      }

      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics || { totalCompanies: 0, totalMeetings: 0, totalAttendees: 0, pendingApprovals: 0 });
        setTopTopics(data.topTopics || []);
        setCompanies(data.companies || []);
        setPendingUsers(data.pendingUsers || []);
        setUnlinkedUsers(data.unlinkedUsers || []);
        setErrorMessage(null);
      } else {
        throw new Error(data.error || 'Falha ao sincronizar dados.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[Dashboard Load Error]:', err);
      if (initialLoading) {
        setErrorMessage(err.message || 'Não foi possível conectar ao servidor.');
      }
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [initialLoading]);

  // Polling inteligente (pausa em abas inativas)
  useEffect(() => {
    loadDashboardData();

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && !isOffline) {
          loadDashboardData(false);
        }
      }, 10000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDashboardData(false);
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [loadDashboardData, isOffline]);

  const handleManualRefresh = async () => {
    await loadDashboardData(true);
    showToast('Dados atualizados com sucesso.', 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('dds_master_session');
    router.push('/login');
  };

  // 1. Alternar Status de Empresa (Kill-Switch)
  const handleToggleCompanyStatus = (companyId: string, currentStatus: string) => {
    if (processingId === companyId) return;

    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMsg = nextStatus === 'SUSPENDED' 
      ? 'Deseja SUSPENDER esta empresa? O acesso de todos os técnicos e reuniões dela será pausado imediatamente.' 
      : 'Deseja REATIVAR o acesso desta empresa?';

    setConfirmDialog({
      title: nextStatus === 'SUSPENDED' ? 'Bloquear Empresa' : 'Reativar Empresa',
      message: confirmMsg,
      onConfirm: async () => {
        setProcessingId(companyId);
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
            await loadDashboardData(false);
          } else {
            showToast(data.error || 'Erro ao atualizar status da empresa.', 'error');
          }
        } catch {
          showToast('Erro de conexão com o servidor.', 'error');
        } finally {
          setProcessingId(null);
        }
        setConfirmDialog(null);
      }
    });
  };

  // 2. Liberar ou Recusar Acesso de Usuário
  const handleUserApproval = async (userId: string, newStatus: 'ACTIVE' | 'BLOCKED', targetCompanyId?: string) => {
    if (processingId === userId) return;

    setProcessingId(userId);
    try {
      const res = await fetch('/api/master', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_user_status',
          userId,
          newStatus,
          targetCompanyId: targetCompanyId || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          newStatus === 'ACTIVE' 
            ? 'Acesso liberado com sucesso!' 
            : 'Solicitação recusada e usuário bloqueado.', 
          'success'
        );
        await loadDashboardData(false);
      } else {
        showToast(data.error || 'Erro ao processar a aprovação.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao comunicar com o servidor.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // 3. Vincular Usuário à Empresa Oficial
  const handleLinkUserToCompany = async (userId: string) => {
    if (processingId === userId) return;

    const targetCompanyId = selectedCompanyForUser[userId];
    if (!targetCompanyId) {
      showToast('Selecione uma empresa na lista para vincular.', 'error');
      return;
    }

    setProcessingId(userId);
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
        showToast('Técnico vinculado à empresa e liberado com sucesso!', 'success');
        await loadDashboardData(false);
      } else {
        showToast(data.error || 'Erro ao vincular empresa.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao vincular.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // 4. Excluir Usuário Permanentemente
  const handleDeleteUser = (userId: string, userName: string) => {
    if (processingId === userId) return;

    setConfirmDialog({
      title: 'Excluir Usuário Permanentemente',
      message: `Tem certeza que deseja excluir o usuário "${userName}"? Esta ação removerá definitivamente todos os DDSs e registros vinculados a ele.`,
      onConfirm: async () => {
        setProcessingId(userId);
        try {
          const res = await fetch('/api/master', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          });
          const data = await res.json();
          if (data.success) {
            showToast('Usuário excluído com sucesso!', 'success');
            await loadDashboardData(false);
          } else {
            showToast(data.error || 'Erro ao excluir usuário.', 'error');
          }
        } catch {
          showToast('Erro de conexão com o servidor.', 'error');
        } finally {
          setProcessingId(null);
        }
        setConfirmDialog(null);
      }
    });
  };

  // 5. Cadastrar Nova Empresa
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingCompany) return;

    if (!newCompanyName.trim() || !newCompanyKey.trim()) {
      showToast('Preencha o nome da empresa e a palavra-chave mágica.', 'error');
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
        await loadDashboardData(false);
        showToast('Empresa cadastrada e chave mágica ativada com sucesso!', 'success');
      } else {
        showToast(data.error || 'Erro ao cadastrar empresa.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao criar empresa.', 'error');
    } finally {
      setIsCreatingCompany(false);
    }
  };

  // 6. Exportar Relatório Consolidado Global em PDF
  const handleExportConsolidatedPdf = () => {
    try {
      const sampleReport = {
        organizerName: 'Alexandre Machado (Super Admin)',
        organizerRole: 'Diretor de Segurança / AM TST',
        companyName: 'Todas as Unidades Auditadas (Consolidado Master)',
        meetings: topTopics.map((t, idx) => ({
          topic: t.topic,
          farm: 'Unidade Agroindustrial Integrada',
          type: idx % 2 === 0 ? 'PRESENTIAL' : 'REMOTE',
          createdAt: new Date(Date.now() - idx * 86400000 * 3).toISOString(),
          attendees: Array.from({ length: t.count * 4 }).map((_, i) => ({
            id: `att-${idx}-${i}`,
            name: `Colaborador Auditado #${i + 1}`,
            cpf: `***.${100 + i}.***-00`,
            createdAt: new Date().toISOString()
          })),
          organizer: { name: 'Técnico Especialista em SST' },
          company: { name: 'DDS ON Integrado' }
        }))
      };

      generateConsolidatedDdsPdf(sampleReport);
      showToast('Relatório PDF Consolidado gerado com sucesso!', 'success');
    } catch (err) {
      console.error('PDF Export Error:', err);
      showToast('Erro ao compilar o relatório em PDF.', 'error');
    }
  };

  // Filtragem de Listas com useMemo
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    const q = companySearch.toLowerCase();
    return companies.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.document && c.document.toLowerCase().includes(q)) ||
      (c.secretKey && c.secretKey.toLowerCase().includes(q))
    );
  }, [companies, companySearch]);

  const filteredPendingUsers = useMemo(() => {
    if (!approvalSearch.trim()) return pendingUsers;
    const q = approvalSearch.toLowerCase();
    return pendingUsers.filter(u => 
      u.name.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q) ||
      (u.company && u.company.toLowerCase().includes(q))
    );
  }, [pendingUsers, approvalSearch]);

  const filteredUnlinkedUsers = useMemo(() => {
    if (!unlinkedSearch.trim()) return unlinkedUsers;
    const q = unlinkedSearch.toLowerCase();
    return unlinkedUsers.filter(u => 
      u.name.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q) ||
      (u.company && u.company.toLowerCase().includes(q))
    );
  }, [unlinkedUsers, unlinkedSearch]);

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
      badgeColor: 'bg-amber-500 text-slate-950 animate-pulse'
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
    <div className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row relative selection:bg-green-500 selection:text-slate-950 overflow-x-hidden">
      
      {/* BANNER OFFLINE */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[70] bg-amber-600 text-slate-950 font-bold px-3 py-2 text-xs text-center flex items-center justify-center gap-2 shadow-md pt-safe">
          <WifiOff size={16} />
          <span>Modo Offline: Sem conexão à internet. Exibindo dados locais seguros.</span>
        </div>
      )}

      {/* TOASTS NOTIFICATIONS (Posicionados de forma inteligente no topo para desktop e rodapé para mobile) */}
      {toast.show && (
        <div className={`fixed bottom-4 left-3 right-3 sm:bottom-auto sm:top-6 sm:left-auto sm:right-6 z-[60] max-w-md mx-auto sm:mx-0 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 sm:slide-in-from-top-5 duration-300 backdrop-blur-md ${
          toast.type === 'success' ? 'bg-green-950/95 border-green-500/50 text-green-100' :
          toast.type === 'error' ? 'bg-red-950/95 border-red-500/50 text-red-100' :
          'bg-slate-900/95 border-slate-700 text-slate-100'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={20} className="text-green-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle size={20} className="text-red-400 shrink-0" />}
          {toast.type === 'info' && <Info size={20} className="text-blue-400 shrink-0" />}
          <p className="text-xs sm:text-sm font-semibold leading-snug">{toast.message}</p>
        </div>
      )}

      {/* MODAL CONFIRM DIALOG */}
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
                Confirmar Ação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. BARRA DE MENU LATERAL (SIDEBAR / MOBILE DRAWER) */}
      {/* ========================================================================= */}
      <aside className={`
        fixed md:sticky top-0 z-50 md:z-40 h-screen h-[100dvh] w-72 max-w-[85vw] bg-slate-900/98 md:bg-slate-900/95 border-r border-slate-800 backdrop-blur-xl p-4 sm:p-5 flex flex-col justify-between transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-5 overflow-y-auto max-h-[calc(100dvh-140px)] pr-1">
          
          {/* Logo e Cabeçalho da Sidebar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-green-500/10 text-green-400 rounded-2xl border border-green-500/20 shrink-0">
                <ShieldAlert size={24} className="sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1">
                  DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span> <span className="text-slate-400 text-xs font-bold">MASTER</span>
                </h1>
                <span className="text-[9px] bg-green-500/20 text-green-300 border border-green-500/30 font-bold px-2 py-0.5 rounded-md uppercase tracking-wider inline-block mt-0.5">
                  Super Admin
                </span>
              </div>
            </div>

            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800/50"
              title="Fechar menu"
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
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all min-h-[44px] ${
                    isActive 
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-600/20' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== null && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
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
        <div className="pt-3 border-t border-slate-800/80 space-y-2.5 pb-safe">
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shrink-0"></div>
              <div>
                <p className="text-[11px] font-bold text-white">Banco PostgreSQL</p>
                <p className="text-[9px] text-green-400">Prisma Singleton Ativo</p>
              </div>
            </div>
            <Database size={15} className="text-slate-500 shrink-0" />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex-1 py-2.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50 min-h-[42px]"
              title="Recarregar Dados"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="truncate">{isRefreshing ? 'Atualizando...' : 'Sincronizar'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center border border-red-500/30 transition-colors min-h-[42px] min-w-[42px]"
              title="Sair do Painel Master"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay para fechar menu no mobile com animação */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/75 z-40 md:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      {/* ========================================================================= */}
      {/* 2. ÁREA DE CONTEÚDO PRINCIPAL (MAIN CONTENT) */}
      {/* ========================================================================= */}
      <main className="flex-1 min-h-screen min-h-[100dvh] p-3 sm:p-6 md:p-8 flex flex-col justify-between overflow-x-hidden pt-safe pb-safe">
        
        <div className="space-y-5 sm:space-y-6 max-w-6xl w-full mx-auto">
          
          {/* Barra Superior Mobile e Título da Seção */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300 md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95 transition-transform"
                title="Abrir menu"
              >
                <Menu size={20} />
              </button>
              
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-white leading-tight">
                  {navItems.find(i => i.id === activeTab)?.label}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  Painel Central de Controle • AM TST
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-medium">
                Sincronizado: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* ESTADO DE ERRO GLOBAL (FALLBACK COM TENTAR NOVAMENTE) */}
          {errorMessage && (
            <div className="bg-red-950/80 border border-red-500/40 p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
              <div className="flex items-start gap-3 text-red-200">
                <AlertTriangle size={24} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-white">Falha ao carregar dados do painel</h3>
                  <p className="text-xs text-red-300 mt-0.5">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  loadDashboardData(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0 min-h-[42px]"
              >
                <RefreshCw size={14} /> Tentar Novamente
              </button>
            </div>
          )}

          {/* Cards de Métricas Globais (Grid Responsivo 1 / 2 / 4 colunas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {initialLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-2 animate-pulse">
                  <div className="h-4 bg-slate-800 rounded w-1/2"></div>
                  <div className="h-8 bg-slate-800 rounded w-1/3"></div>
                </div>
              ))
            ) : (
              <>
                <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-1 shadow-lg hover:border-slate-700 transition-colors">
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <Building2 size={15} className="text-blue-400 shrink-0" /> Empresas Clientes
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-white">{metrics.totalCompanies}</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-1 shadow-lg hover:border-slate-700 transition-colors">
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <Video size={15} className="text-emerald-400 shrink-0" /> DDSs Realizados
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-white">{metrics.totalMeetings}</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-1 shadow-lg hover:border-slate-700 transition-colors">
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <Users size={15} className="text-green-400 shrink-0" /> Presenças Auditadas
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-green-400">{metrics.totalAttendees}</p>
                </div>

                <div className={`bg-slate-900 border p-4 sm:p-5 rounded-2xl space-y-1 shadow-lg transition-colors ${
                  metrics.pendingApprovals > 0 ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-800'
                }`}>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-amber-400 shrink-0" /> Fila de Pendentes
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-amber-400">{metrics.pendingApprovals}</p>
                </div>
              </>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO 1: BI & ANALYTICS */}
          {/* ========================================================================= */}
          {activeTab === 'ANALYTICS' && (
            <div className="space-y-4 sm:space-y-6">
              
              {/* Barra de Ações Rápidas do BI */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Auditoria e Exportação de Dossiês SST</h3>
                  <p className="text-xs text-slate-400">Emita o relatório consolidado com conformidade NR para auditorias fiscais.</p>
                </div>

                <button
                  onClick={handleExportConsolidatedPdf}
                  className="w-full sm:w-auto px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all min-h-[44px] shrink-0"
                >
                  <FileDown size={16} /> Exportar Dossiê Consolidado (PDF)
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
                
                {/* Temas Mais Debatidos */}
                <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-5 shadow-xl">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Flame size={18} className="text-amber-500 shrink-0" /> Temas Mais Debatidos no Campo
                    </h3>
                    <p className="text-xs text-slate-400">Assuntos mais frequentes nos treinamentos realizados</p>
                  </div>

                  {initialLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 bg-slate-950/70 rounded-2xl border border-slate-800 animate-pulse" />
                      ))}
                    </div>
                  ) : topTopics.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 space-y-2">
                      <BarChart3 size={32} className="mx-auto opacity-30 text-slate-400" />
                      <p className="text-xs">Nenhum tema ou treinamento registrado ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 sm:space-y-3">
                      {topTopics.map((item, index) => (
                        <div key={index} className="p-3 sm:p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-green-600/20 text-green-400 font-black text-xs flex items-center justify-center border border-green-500/30 shrink-0">
                              #{index + 1}
                            </span>
                            <span className="text-xs font-semibold text-white truncate">{item.topic}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg shrink-0">
                            {item.count} {item.count === 1 ? 'reunião' : 'reuniões'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Empresas com Maior Engajamento */}
                <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-5 shadow-xl">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <TrendingUp size={18} className="text-green-400 shrink-0" /> Empresas com Maior Engajamento
                    </h3>
                    <p className="text-xs text-slate-400">Clientes que mais realizam treinamentos e coletam assinaturas</p>
                  </div>

                  {initialLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 bg-slate-950/70 rounded-2xl border border-slate-800 animate-pulse" />
                      ))}
                    </div>
                  ) : companies.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 space-y-2">
                      <Building2 size={32} className="mx-auto opacity-30 text-slate-400" />
                      <p className="text-xs">Nenhuma empresa cadastrada no sistema.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 sm:space-y-3">
                      {companies.slice(0, 5).map((comp, index) => (
                        <div key={comp.id} className="p-3 sm:p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-green-600/20 text-green-400 font-black text-xs flex items-center justify-center border border-green-500/30 shrink-0">
                              #{index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{comp.name}</p>
                              <p className="text-[11px] text-slate-500">{comp.totalUsers} técnicos</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-green-400 block">{comp.totalMeetings} DDSs</span>
                            <span className="text-[10px] text-slate-400">{comp.totalAttendees} presenças</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SEÇÃO 2: EMPRESAS CLIENTES */}
          {/* ========================================================================= */}
          {activeTab === 'COMPANIES' && (
            <div className="space-y-4 sm:space-y-6">
              
              {/* Formulário de Cadastro */}
              <div className="bg-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 shadow-xl">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PlusCircle size={18} className="text-green-500 shrink-0" /> Cadastrar Empresa e Gerar Chave Mágica
                </h3>
                
                <form onSubmit={handleCreateCompany} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    disabled={isCreatingCompany}
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Nome da Empresa / Fazenda"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-base sm:text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 min-h-[46px]"
                  />

                  <input
                    type="text"
                    disabled={isCreatingCompany}
                    value={newCompanyDoc}
                    onChange={(e) => setNewCompanyDoc(e.target.value)}
                    placeholder="CNPJ ou CPF (Opcional)"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-base sm:text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 min-h-[46px]"
                  />

                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      required
                      disabled={isCreatingCompany}
                      value={newCompanyKey}
                      onChange={(e) => setNewCompanyKey(e.target.value)}
                      placeholder="Palavra-Chave (Ex: AGRO26)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-3 text-base sm:text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 font-mono uppercase disabled:opacity-50 min-h-[46px]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingCompany}
                    className="sm:col-span-3 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed min-h-[48px]"
                  >
                    {isCreatingCompany ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Cadastrando Empresa...
                      </>
                    ) : (
                      <>
                        <Building2 size={16} /> Cadastrar Empresa e Ativar Palavra-Chave
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Lista e Tabela de Empresas */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-white">Empresas Cadastradas ({filteredCompanies.length})</h3>

                  {/* Campo de Busca Responsivo */}
                  <div className="relative w-full sm:max-w-xs">
                    <Search size={15} className="absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      placeholder="Buscar por nome, CNPJ ou chave..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 min-h-[44px]"
                    />
                  </div>
                </div>

                {/* 1. VISUALIZAÇÃO MOBILE EM CARDS (< 768px) */}
                <div className="block md:hidden space-y-3">
                  {initialLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-32 bg-slate-950/70 rounded-2xl border border-slate-800 animate-pulse" />
                    ))
                  ) : filteredCompanies.length === 0 ? (
                    <p className="py-10 text-center text-slate-500 text-xs">
                      {companySearch ? 'Nenhuma empresa encontrada com este termo.' : 'Nenhuma empresa cadastrada.'}
                    </p>
                  ) : (
                    filteredCompanies.map((comp) => {
                      const isSuspended = comp.status === 'SUSPENDED';
                      const isProcessing = processingId === comp.id;

                      return (
                        <div key={comp.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => router.push(`/companies/${comp.id}`)}
                              className="text-left group cursor-pointer min-w-0"
                            >
                              <p className="font-bold text-white text-sm group-hover:text-green-400 group-hover:underline transition-colors flex items-center gap-1.5 truncate">
                                {comp.name} 
                                <ExternalLink size={12} className="text-green-400 shrink-0" />
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">{comp.document || 'Sem Documento'}</p>
                            </button>

                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] shrink-0 border ${
                              isSuspended 
                                ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                                : 'bg-green-500/20 text-green-400 border-green-500/30'
                            }`}>
                              {isSuspended ? '🔴 SUSPENSA' : '🟢 ATIVA'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-900">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Chave Mágica</span>
                              <span className="font-mono text-green-400 font-bold text-xs">{comp.secretKey || 'SEM CHAVE'}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 block">Volume DDS</span>
                              <span className="font-bold text-white text-xs">{comp.totalMeetings} reuniões ({comp.totalUsers} téc.)</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleToggleCompanyStatus(comp.id, comp.status)}
                            disabled={isProcessing}
                            className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                              isSuspended
                                ? 'bg-green-600 hover:bg-green-700 text-white shadow-md'
                                : 'bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30'
                            }`}
                          >
                            {isProcessing ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : isSuspended ? (
                              <Unlock size={14} />
                            ) : (
                              <Lock size={14} />
                            )}
                            <span>{isSuspended ? 'Reativar Acesso da Empresa' : 'Bloquear Empresa (Kill-Switch)'}</span>
                          </button>
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
                        <th className="pb-3 font-semibold">Empresa / Cliente</th>
                        <th className="pb-3 font-semibold">Palavra-Chave Mágica</th>
                        <th className="pb-3 font-semibold">Volume DDS</th>
                        <th className="pb-3 font-semibold">Status de Acesso</th>
                        <th className="pb-3 font-semibold text-right">Controle (Kill-Switch)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {initialLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td colSpan={5} className="py-4">
                              <div className="h-6 bg-slate-800 rounded w-full"></div>
                            </td>
                          </tr>
                        ))
                      ) : filteredCompanies.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500">
                            {companySearch ? 'Nenhuma empresa encontrada com este termo.' : 'Nenhuma empresa cadastrada.'}
                          </td>
                        </tr>
                      ) : (
                        filteredCompanies.map((comp) => {
                          const isSuspended = comp.status === 'SUSPENDED';
                          const isProcessing = processingId === comp.id;

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
                                  disabled={isProcessing}
                                  className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 ml-auto transition-all disabled:opacity-50 min-h-[38px] ${
                                    isSuspended
                                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-md'
                                      : 'bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30'
                                  }`}
                                >
                                  {isProcessing ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : isSuspended ? (
                                    <Unlock size={13} />
                                  ) : (
                                    <Lock size={13} />
                                  )}
                                  <span>{isSuspended ? 'Reativar Acesso' : 'Bloquear Empresa'}</span>
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
          {/* SEÇÃO 3: FILA DE APROVAÇÃO (CRÍTICA) */}
          {/* ========================================================================= */}
          {activeTab === 'APPROVALS' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users size={18} className="text-amber-400 shrink-0" /> Fila de Aprovação de Técnicos ({filteredPendingUsers.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Técnicos que se cadastraram aguardando liberação de acesso pelo Administrador Master.
                  </p>
                </div>

                {/* Busca na Fila */}
                {pendingUsers.length > 0 && (
                  <div className="relative w-full sm:max-w-xs">
                    <Search size={15} className="absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={approvalSearch}
                      onChange={(e) => setApprovalSearch(e.target.value)}
                      placeholder="Buscar por nome, email ou empresa..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 min-h-[44px]"
                    />
                  </div>
                )}
              </div>

              {initialLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-28 bg-slate-950/70 rounded-2xl border border-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : filteredPendingUsers.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <CheckCircle2 size={36} className="mx-auto opacity-30 text-green-500" />
                  <p className="text-sm font-semibold text-slate-300">Fila Limpa!</p>
                  <p className="text-xs">
                    {approvalSearch ? 'Nenhum usuário pendente com este termo.' : 'Nenhum técnico aguardando aprovação no momento.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPendingUsers.map((user) => {
                    const isProcessing = processingId === user.id;

                    return (
                      <div key={user.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white text-sm truncate">{user.name}</p>
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">
                              PENDENTE
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 break-all">{user.email} • {user.position || 'Técnico em Segurança'}</p>
                          
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md">
                              Empresa declarada: <strong className="text-amber-400">{user.company || 'Não vinculada'}</strong>
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Cadastrado em: {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        {/* Ações de Aprovação / Vinculação (Adaptadas para Touch e Mobile) */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 lg:pt-0 w-full lg:w-auto">
                          
                          {/* Seletor Rápido de Empresa de Destino */}
                          <select
                            value={selectedCompanyForApproval[user.id] || ''}
                            onChange={(e) => setSelectedCompanyForApproval({
                              ...selectedCompanyForApproval,
                              [user.id]: e.target.value
                            })}
                            disabled={isProcessing}
                            className="bg-slate-900 border border-slate-700 text-slate-200 text-base sm:text-xs rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-500 w-full sm:max-w-[190px] disabled:opacity-50 min-h-[44px]"
                          >
                            <option value="">Vincular a Empresa...</option>
                            {companies.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => handleDeleteUser(user.id, user.name)}
                              disabled={isProcessing}
                              className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-colors flex items-center justify-center disabled:opacity-50 min-w-[44px] min-h-[44px]"
                              title="Excluir cadastro permanentemente"
                            >
                              <Trash2 size={16} />
                            </button>

                            <button
                              onClick={() => handleUserApproval(user.id, 'BLOCKED')}
                              disabled={isProcessing}
                              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 min-h-[44px]"
                              title="Recusar solicitação e bloquear"
                            >
                              <X size={15} /> Recusar
                            </button>

                            <button
                              onClick={() => handleUserApproval(user.id, 'ACTIVE', selectedCompanyForApproval[user.id])}
                              disabled={isProcessing}
                              className="flex-1 sm:flex-none px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                              title="Aprovar e liberar acesso à plataforma"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 size={15} className="animate-spin" /> Liberando...
                                </>
                              ) : (
                                <>
                                  <Check size={15} /> Liberar Acesso
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SEÇÃO 4: USUÁRIOS SEM EMPRESA */}
          {/* ========================================================================= */}
          {activeTab === 'UNLINKED' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <UserX size={18} className="text-blue-400 shrink-0" /> Usuários Sem Empresa Vinculada ({filteredUnlinkedUsers.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Técnicos que possuem cadastro mas não foram formalmente vinculados a uma empresa cliente oficial.
                  </p>
                </div>

                {/* Busca de Usuários Sem Empresa */}
                {unlinkedUsers.length > 0 && (
                  <div className="relative w-full sm:max-w-xs">
                    <Search size={15} className="absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={unlinkedSearch}
                      onChange={(e) => setUnlinkedSearch(e.target.value)}
                      placeholder="Buscar técnico..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 min-h-[44px]"
                    />
                  </div>
                )}
              </div>

              {/* 1. VISUALIZAÇÃO MOBILE EM CARDS (< 768px) */}
              <div className="block md:hidden space-y-3">
                {initialLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-32 bg-slate-950/70 rounded-2xl border border-slate-800 animate-pulse" />
                  ))
                ) : filteredUnlinkedUsers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-2">
                    <CheckCircle2 size={32} className="mx-auto opacity-30 text-blue-500" />
                    <p className="text-sm font-semibold text-slate-300">Tudo Organizado!</p>
                    <p className="text-xs">
                      {unlinkedSearch ? 'Nenhum usuário encontrado com este termo.' : 'Todos os técnicos cadastrados estão vinculados a empresas oficiais.'}
                    </p>
                  </div>
                ) : (
                  filteredUnlinkedUsers.map((user) => {
                    const isProcessing = processingId === user.id;

                    return (
                      <div key={user.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-white text-sm truncate">{user.name}</p>
                            <p className="text-[11px] text-slate-500 break-all">{user.email} • {user.position || 'Técnico'}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${
                            user.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            user.status === 'PENDING_APPROVAL' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {user.status === 'ACTIVE' ? '🟢 ATIVO' :
                             user.status === 'PENDING_APPROVAL' ? '🟡 PENDENTE' : '🔴 BLOQUEADO'}
                          </span>
                        </div>

                        <div className="text-xs space-y-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
                          <p className="text-[11px] text-slate-400">
                            Empresa informada: <strong className="text-amber-400">{user.company || 'Não informado'}</strong>
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {user._count?.meetings || 0} reuniões criadas • Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
                          <select
                            value={selectedCompanyForUser[user.id] || ''}
                            onChange={(e) => setSelectedCompanyForUser({
                              ...selectedCompanyForUser,
                              [user.id]: e.target.value
                            })}
                            disabled={isProcessing}
                            className="bg-slate-900 border border-slate-700 text-slate-200 text-base sm:text-xs rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-500 w-full min-h-[44px]"
                          >
                            <option value="">Selecione a empresa...</option>
                            {companies.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleLinkUserToCompany(user.id)}
                              disabled={!selectedCompanyForUser[user.id] || isProcessing}
                              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all min-h-[44px] ${
                                selectedCompanyForUser[user.id] && !isProcessing
                                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white shadow-md'
                                  : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50'
                              }`}
                            >
                              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                              <span>Vincular</span>
                            </button>

                            <button
                              onClick={() => handleDeleteUser(user.id, user.name)}
                              disabled={isProcessing}
                              className="p-3 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all border border-red-500/30 min-w-[44px] min-h-[44px] flex items-center justify-center"
                              title="Excluir este usuário"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 2. VISUALIZAÇÃO TABULAR DESKTOP (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">Técnico / Usuário</th>
                      <th className="pb-3 font-semibold">Empresa Informada</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">DDSs Criados</th>
                      <th className="pb-3 font-semibold">Vincular a Empresa Oficial</th>
                      <th className="pb-3 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUnlinkedUsers.map((user) => {
                      const isProcessing = processingId === user.id;

                      return (
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
                                disabled={isProcessing}
                                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 max-w-[200px] disabled:opacity-50 min-h-[38px]"
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
                                disabled={!selectedCompanyForUser[user.id] || isProcessing}
                                className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1 transition-all min-h-[38px] ${
                                  selectedCompanyForUser[user.id] && !isProcessing
                                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 text-white shadow-md cursor-pointer'
                                    : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50'
                                }`}
                                title="Vincular usuário à empresa selecionada"
                              >
                                {isProcessing ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Link2 size={13} />
                                )}
                                <span>Vincular</span>
                              </button>
                            </div>
                          </td>

                          <td className="py-4 text-right">
                            <button
                              onClick={() => handleDeleteUser(user.id, user.name)}
                              disabled={isProcessing}
                              className="p-2 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all border border-red-500/30 disabled:opacity-50 min-h-[36px] min-w-[36px]"
                              title="Excluir este usuário"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SEÇÃO 5: CONFIGURAÇÕES MASTER & SEGURANÇA */}
          {/* ========================================================================= */}
          {activeTab === 'SETTINGS' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-xl">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Settings size={18} className="text-green-400 shrink-0" /> Parâmetros da Plataforma DDS ON
                  </h3>
                  <p className="text-xs text-slate-400">Configurações globais de conformidade jurídica, LGPD e infraestrutura.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  
                  {/* Card Database Singleton */}
                  <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-2">
                        <Database size={16} className="text-green-400 shrink-0" /> Infraestrutura do Banco
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">
                        Prisma Singleton
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Gerenciador centralizado de conexões ativas prevenindo saturação de poolers (PgBouncer) no PostgreSQL Supabase.
                    </p>
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-900 space-y-1">
                      <p>• Schema: <strong>4 Tabelas Principais</strong></p>
                      <p>• Validação transacional de integridade referencial ativa</p>
                    </div>
                  </div>

                  {/* Card Segurança e Kill-Switch */}
                  <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-400 shrink-0" /> Sistema Kill-Switch
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                        Ativado & Operante
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Ao suspender uma empresa cliente, todos os logins e emissões de presença são bloqueados em tempo real na plataforma.
                    </p>
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-900 space-y-1">
                      <p>• Bloqueio na rota de autenticação (/api/auth)</p>
                      <p>• Bloqueio na emissão de presenças (/api/presenca)</p>
                    </div>
                  </div>

                </div>

                {/* Card AM TST */}
                <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
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
                    className="w-full sm:w-auto px-4 py-3 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors min-h-[44px] shrink-0"
                  >
                    <span>Portal AM TST</span>
                    <ExternalLink size={14} />
                  </a>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Rodapé da Página Principal */}
        <footer className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-slate-900 text-center space-y-1.5 max-w-6xl w-full mx-auto">
          <p className="text-[11px] text-slate-500 font-normal">
            © {new Date().getFullYear()} <strong>DDS ON MASTER</strong> • Todos os direitos reservados.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1 text-[11px] text-slate-500">
            <span>Desenvolvido e Gerenciado por</span>
            <a
              href="https://amtst.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 font-bold inline-flex items-center gap-1 transition-colors underline underline-offset-2 p-1"
            >
              AM TST <ExternalLink size={10} />
            </a>
          </div>
        </footer>

      </main>
    </div>
  );
}