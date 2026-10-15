'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Building2,
  Users,
  Video,
  BarChart3,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Check,
  X,
  ExternalLink,
  LogOut,
  Info,
  Loader2,
  KeyRound,
  Trash2,
  UserX,
  Link2,
  Menu,
  Settings,
  Database,
  ShieldCheck,
  Search,
  FileDown,
  WifiOff,
  ArrowRight,
  HelpCircle,
  History,
  Activity,
  FileCheck2,
  Lock,
  Unlock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Componentes Modulares
import Sidebar, { NavTab } from '@/components/Sidebar';
import DashboardOverview from '@/components/DashboardOverview';
import QuizzesModule from '@/components/QuizzesModule';
import BiModule from '@/components/BiModule';
import MeetingsModule from '@/components/MeetingsModule';
import AttendancesModule from '@/components/AttendancesModule';
import HistoryModule from '@/components/HistoryModule';
import MonitoringModule from '@/components/MonitoringModule';
import ReportsModule from '@/components/ReportsModule';
import { generateConsolidatedDdsPdf } from '@/lib/pdfGenerator';

interface MetricData {
  totalCompanies: number;
  activeCompanies?: number;
  suspendedCompanies?: number;
  totalUsers?: number;
  totalMeetings: number;
  liveMeetings?: number;
  endedMeetings?: number;
  totalAttendees: number;
  pendingApprovals: number;
  totalQuizzes?: number;
  publishedQuizzes?: number;
  totalAttempts?: number;
  passedAttempts?: number;
  overallAvgScore?: number;
  passRate?: number;
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
  totalQuizzes?: number;
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
  const [activeTab, setActiveTab] = useState<NavTab>('DASHBOARD');
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Estados dos Dados Centrais
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

  // Sub-abas de Usuários
  const [userSubTab, setUserSubTab] = useState<'PENDING' | 'UNLINKED'>('PENDING');

  // Filtros de busca
  const [companySearch, setCompanySearch] = useState('');
  const [approvalSearch, setApprovalSearch] = useState('');
  const [unlinkedSearch, setUnlinkedSearch] = useState('');

  // Ações em processamento
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal de Nova Empresa
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyDoc, setNewCompanyDoc] = useState('');
  const [newCompanyKey, setNewCompanyKey] = useState('');
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  // Notificações e Diálogos
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'info'
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ show: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: '', type: 'info' });
    }, 4500);
  }, []);

  // Monitoramento Online/Offline
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

  // Polling inteligente a cada 15s
  useEffect(() => {
    loadDashboardData();

    let intervalId: NodeJS.Timeout | null = null;
    const startPolling = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && !isOffline) {
          loadDashboardData(false);
        }
      }, 15000);
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
    showToast('Dados consolidados atualizados com sucesso.', 'success');
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
      ? 'Deseja SUSPENDER esta empresa? O acesso de todos os técnicos e reuniões dela será bloqueado imediatamente.'
      : 'Deseja REATIVAR o acesso desta empresa?';

    setConfirmDialog({
      title: nextStatus === 'SUSPENDED' ? 'Bloquear Empresa (Kill-Switch)' : 'Reativar Empresa',
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
      showToast('Erro de conexão ao comunicar com o servidor.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // 4. Excluir Usuário em Cascata
  const handleDeleteUser = (userId: string, userName: string) => {
    if (processingId === userId) return;

    setConfirmDialog({
      title: 'Excluir Usuário Permanentemente',
      message: `Tem certeza que deseja excluir o usuário "${userName}"? Todos os seus registros associados serão removidos definitivamente.`,
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
            showToast('Usuário excluído definitivamente.', 'success');
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
    if (!newCompanyName.trim() || !newCompanyKey.trim()) {
      showToast('Nome da empresa e Palavra-Chave Mágica são obrigatórios.', 'error');
      return;
    }

    setIsCreatingCompany(true);
    try {
      const res = await fetch('/api/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCompanyName.trim(),
          document: newCompanyDoc.trim() || null,
          secretKey: newCompanyKey.trim().toUpperCase()
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Empresa cadastrada e chave mágica ativada com sucesso!', 'success');
        setNewCompanyName('');
        setNewCompanyDoc('');
        setNewCompanyKey('');
        setIsCreateCompanyOpen(false);
        await loadDashboardData(false);
      } else {
        showToast(data.error || 'Erro ao criar empresa.', 'error');
      }
    } catch {
      showToast('Erro de conexão com o servidor ao cadastrar empresa.', 'error');
    } finally {
      setIsCreatingCompany(false);
    }
  };

  // Filtragens
  const filteredCompanies = useMemo(() => {
    if (!companySearch) return companies;
    const q = companySearch.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.document && c.document.includes(q)) ||
        (c.secretKey && c.secretKey.toLowerCase().includes(q))
    );
  }, [companies, companySearch]);

  const filteredPendingUsers = useMemo(() => {
    if (!approvalSearch) return pendingUsers;
    const q = approvalSearch.toLowerCase();
    return pendingUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company && u.company.toLowerCase().includes(q))
    );
  }, [pendingUsers, approvalSearch]);

  const filteredUnlinkedUsers = useMemo(() => {
    if (!unlinkedSearch) return unlinkedUsers;
    const q = unlinkedSearch.toLowerCase();
    return unlinkedUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company && u.company.toLowerCase().includes(q))
    );
  }, [unlinkedUsers, unlinkedSearch]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col lg:flex-row relative selection:bg-green-500 selection:text-slate-950">
      {/* Banner Offline */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[70] bg-amber-600 text-slate-950 font-bold px-3 py-2 text-xs text-center flex items-center justify-center gap-2 shadow-md">
          <WifiOff size={16} />
          <span>Modo Offline: Sem conexão à internet. Exibindo dados locais preservados.</span>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed bottom-4 left-3 right-3 sm:bottom-auto sm:top-6 sm:left-auto sm:right-6 z-[60] max-w-md mx-auto sm:mx-0 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-green-950/95 border-green-500/50 text-green-100'
              : toast.type === 'error'
              ? 'bg-red-950/95 border-red-500/50 text-red-100'
              : 'bg-slate-900/95 border-slate-700 text-slate-100'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 size={20} className="text-green-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle size={20} className="text-red-400 shrink-0" />}
          {toast.type === 'info' && <Info size={20} className="text-blue-400 shrink-0" />}
          <p className="text-xs sm:text-sm font-semibold leading-snug">{toast.message}</p>
        </div>
      )}

      {/* Modal Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle size={22} className="shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-white">{confirmDialog.title}</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="w-full sm:flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="w-full sm:flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all text-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro de Empresa */}
      {isCreateCompanyOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4 relative">
            <button
              onClick={() => setIsCreateCompanyOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/50"
            >
              <X size={16} />
            </button>

            <div className="space-y-1">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Building2 className="text-green-400" size={20} /> Cadastrar Nova Empresa
              </h2>
              <p className="text-xs text-slate-400">
                Crie a empresa e defina a chave mágica para auto-aprovação de técnicos.
              </p>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Nome da Empresa ou Fazenda *</label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Ex: Fazenda Santa Maria Agro"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">CNPJ ou Documento (Opcional)</label>
                <input
                  type="text"
                  value={newCompanyDoc}
                  onChange={(e) => setNewCompanyDoc(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Palavra-Chave Mágica *</label>
                <input
                  type="text"
                  required
                  value={newCompanyKey}
                  onChange={(e) => setNewCompanyKey(e.target.value.toUpperCase())}
                  placeholder="Ex: AGRO2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-green-400 font-mono font-bold placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 uppercase tracking-wider"
                />
                <span className="text-[10px] text-slate-500 block">
                  Técnicos que informarem esta chave no cadastro serão aprovados automaticamente.
                </span>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateCompanyOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCompany}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isCreatingCompany ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Salvar Empresa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. SIDEBAR LATERAL PROFISSIONAL */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingApprovalsCount={pendingUsers.length}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onLogout={handleLogout}
      />

      {/* 2. ÁREA DE CONTEÚDO PRINCIPAL (COM PADDING LATERAL PARA ACOMODAR A SIDEBAR) */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        {/* Top Header Barra Superior */}
        <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800"
              title="Abrir Menu"
            >
              <Menu size={20} />
            </button>

            <div>
              <span className="text-[10px] uppercase font-black text-green-400 tracking-wider block">
                Painel Central Multi-Tenant
              </span>
              <h1 className="text-base font-black text-white capitalize">
                {activeTab === 'DASHBOARD' && 'Dashboard Executivo'}
                {activeTab === 'COMPANIES' && 'Gestão de Empresas'}
                {activeTab === 'USERS' && 'Usuários & Permissões'}
                {activeTab === 'DDS' && 'Treinamentos DDS'}
                {activeTab === 'ATTENDANCES' && 'Auditoria de Presenças'}
                {activeTab === 'QUIZZES' && 'Questionários & Avaliações'}
                {activeTab === 'BI' && 'BI Consolidado'}
                {activeTab === 'HISTORY' && 'Histórico de Atividades'}
                {activeTab === 'REPORTS' && 'Central de Relatórios'}
                {activeTab === 'MONITORING' && 'Diagnóstico & Saúde'}
                {activeTab === 'SETTINGS' && 'Configurações Master'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Neon Active</span>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 sm:px-3 sm:py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-all flex items-center gap-1.5 text-xs font-bold"
              title="Sincronizar dados"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-green-400' : ''} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
          </div>
        </header>

        {/* Conteúdo Dinâmico por Aba */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'DASHBOARD' && (
            <DashboardOverview
              metrics={metrics}
              topTopics={topTopics}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenCreateCompany={() => setIsCreateCompanyOpen(true)}
              onExportReport={() => {
                generateConsolidatedDdsPdf({
                  organizerName: 'Alexandre Machado',
                  organizerRole: 'SuperAdmin DDS-ON',
                  companyName: 'Todas as Empresas',
                  meetings: []
                });
              }}
            />
          )}

          {/* TAB 2: GESTÃO DE EMPRESAS */}
          {activeTab === 'COMPANIES' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Building2 size={18} className="text-green-400 shrink-0" /> Empresas e Fazendas Cadastradas ({filteredCompanies.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Controle de acesso multi-tenant, chaves mágicas e ativação do Kill-Switch.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:max-w-xs">
                    <Search size={15} className="absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      placeholder="Buscar empresa ou documento..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 min-h-[40px]"
                    />
                  </div>

                  <button
                    onClick={() => setIsCreateCompanyOpen(true)}
                    className="px-3.5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md"
                  >
                    <PlusCircle size={14} />
                    <span className="hidden sm:inline">Nova Empresa</span>
                  </button>
                </div>
              </div>

              {filteredCompanies.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <Building2 size={36} className="mx-auto opacity-30 text-green-500" />
                  <p className="text-sm font-semibold text-slate-300">Nenhuma empresa encontrada</p>
                  <p className="text-xs">Cadastre uma nova empresa ou altere o termo de busca.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCompanies.map((comp) => {
                    const isSuspended = comp.status === 'SUSPENDED';

                    return (
                      <div
                        key={comp.id}
                        className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/companies/${comp.id}`}
                              className="font-bold text-white text-sm hover:text-green-400 transition-colors truncate"
                            >
                              {comp.name}
                            </Link>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${
                                isSuspended
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                  : 'bg-green-500/20 text-green-300 border-green-500/30'
                              }`}
                            >
                              {isSuspended ? '🔴 SUSPENSA' : '🟢 ATIVA'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span>CNPJ: <strong className="text-slate-200">{comp.document || 'Não informado'}</strong></span>
                            <span>•</span>
                            <span className="font-mono text-green-400 font-bold">
                              Chave: {comp.secretKey || 'SEM CHAVE'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                            <span>{comp.totalUsers} técnicos vinculados</span>
                            <span>•</span>
                            <span>{comp.totalMeetings} treinamentos DDS</span>
                            <span>•</span>
                            <span className="text-green-400 font-semibold">{comp.totalAttendees} presenças</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-900 shrink-0">
                          <button
                            onClick={() => handleToggleCompanyStatus(comp.id, comp.status)}
                            disabled={processingId === comp.id}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                              isSuspended
                                ? 'bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/30'
                                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {isSuspended ? <Unlock size={14} /> : <Lock size={14} />}
                            <span>{isSuspended ? 'Reativar' : 'Suspender (Kill-Switch)'}</span>
                          </button>

                          <Link
                            href={`/companies/${comp.id}`}
                            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <span>Detalhes</span>
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GESTÃO DE USUÁRIOS E FILA DE APROVAÇÃO */}
          {activeTab === 'USERS' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users size={18} className="text-blue-400 shrink-0" /> Gestão de Usuários e Permissões
                  </h3>
                  <p className="text-xs text-slate-400">
                    Aprovação de novos cadastros de técnicos e vinculação de organizadores às empresas.
                  </p>
                </div>

                {/* Sub-abas de Usuários */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setUserSubTab('PENDING')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      userSubTab === 'PENDING'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Fila Pendente</span>
                    {pendingUsers.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black">
                        {pendingUsers.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setUserSubTab('UNLINKED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      userSubTab === 'UNLINKED'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Sem Empresa</span>
                    {unlinkedUsers.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-blue-400 text-slate-950 rounded-full text-[10px] font-black">
                        {unlinkedUsers.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Seção Fila Pendente */}
              {userSubTab === 'PENDING' && (
                <div className="space-y-3 pt-2">
                  {filteredPendingUsers.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 space-y-2">
                      <CheckCircle2 size={36} className="mx-auto opacity-30 text-green-500" />
                      <p className="text-sm font-semibold text-slate-300">Fila 100% Limpa!</p>
                      <p className="text-xs">Nenhum técnico aguardando aprovação no momento.</p>
                    </div>
                  ) : (
                    filteredPendingUsers.map((user) => {
                      const isProcessing = processingId === user.id;

                      return (
                        <div
                          key={user.id}
                          className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-white text-sm truncate">{user.name}</p>
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">
                                PENDENTE
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 break-all">{user.email} • {user.position || 'Técnico em Segurança'}</p>
                            <p className="text-[11px] text-slate-500">
                              Empresa declarada: <strong className="text-amber-400">{user.company || 'Não vinculada'}</strong>
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 lg:pt-0">
                            <select
                              value={selectedCompanyForApproval[user.id] || ''}
                              onChange={(e) => setSelectedCompanyForApproval({
                                ...selectedCompanyForApproval,
                                [user.id]: e.target.value
                              })}
                              disabled={isProcessing}
                              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
                            >
                              <option value="">Vincular a Empresa...</option>
                              {companies.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                disabled={isProcessing}
                                className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-colors"
                                title="Excluir cadastro"
                              >
                                <Trash2 size={15} />
                              </button>

                              <button
                                onClick={() => handleUserApproval(user.id, 'BLOCKED')}
                                disabled={isProcessing}
                                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                              >
                                Bloquear
                              </button>

                              <button
                                onClick={() => handleUserApproval(user.id, 'ACTIVE', selectedCompanyForApproval[user.id])}
                                disabled={isProcessing}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                              >
                                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Liberar Acesso</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Seção Usuários Sem Empresa */}
              {userSubTab === 'UNLINKED' && (
                <div className="space-y-3 pt-2">
                  {filteredUnlinkedUsers.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 space-y-2">
                      <CheckCircle2 size={36} className="mx-auto opacity-30 text-blue-500" />
                      <p className="text-sm font-semibold text-slate-300">Tudo Vinculado!</p>
                      <p className="text-xs">Nenhum técnico órfão ou desvinculado no banco.</p>
                    </div>
                  ) : (
                    filteredUnlinkedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{user.name}</p>
                          <p className="text-xs text-slate-400 break-all">{user.email} • {user.position || 'Técnico'}</p>
                          <p className="text-[11px] text-slate-500">
                            Empresa informada: <strong className="text-amber-400">{user.company || 'Não informado'}</strong> • {user._count?.meetings || 0} DDSs criados
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 lg:pt-0">
                          <select
                            value={selectedCompanyForUser[user.id] || ''}
                            onChange={(e) => setSelectedCompanyForUser({
                              ...selectedCompanyForUser,
                              [user.id]: e.target.value
                            })}
                            disabled={processingId === user.id}
                            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Selecione uma empresa oficial...</option>
                            {companies.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => handleLinkUserToCompany(user.id)}
                            disabled={!selectedCompanyForUser[user.id] || processingId === user.id}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Link2 size={14} />
                            <span>Vincular</span>
                          </button>

                          <button
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            disabled={processingId === user.id}
                            className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MONITORAMENTO DE DDS */}
          {activeTab === 'DDS' && <MeetingsModule />}

          {/* TAB 5: LISTAS DE PRESENÇA E AUDITORIA */}
          {activeTab === 'ATTENDANCES' && <AttendancesModule />}

          {/* TAB 6: GESTÃO DE QUESTIONÁRIOS */}
          {activeTab === 'QUIZZES' && <QuizzesModule />}

          {/* TAB 7: BI CONSOLIDADO */}
          {activeTab === 'BI' && <BiModule />}

          {/* TAB 8: HISTÓRICO GLOBAL & AUDITORIA */}
          {activeTab === 'HISTORY' && <HistoryModule />}

          {/* TAB 9: CENTRAL DE RELATÓRIOS */}
          {activeTab === 'REPORTS' && <ReportsModule companies={companies} metrics={metrics} />}

          {/* TAB 10: DIAGNÓSTICO E SAÚDE */}
          {activeTab === 'MONITORING' && <MonitoringModule />}

          {/* TAB 11: CONFIGURAÇÕES MASTER */}
          {activeTab === 'SETTINGS' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings size={18} className="text-green-400 shrink-0" /> Parâmetros Operacionais da Plataforma
                </h3>
                <p className="text-xs text-slate-400">Configurações globais de infraestrutura, segurança e integridade.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Database size={16} className="text-green-400" /> Banco de Dados Neon
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                      Conexão Centralizada
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Instância PostgreSQL gerenciada com pooler PgBouncer ativo, prevenindo esgotamento de conexões sob concorrência intensa.
                  </p>
                  <p className="text-[11px] text-slate-500 pt-1">
                    • Modelos operacionais sincronizados com o DDS-ON (Quiz, Attendance, Meeting, User, Company).
                  </p>
                </div>

                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <ShieldCheck size={16} className="text-emerald-400" /> Sistema Kill-Switch
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Operante
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Bloqueia instantaneamente emissão de presenças e criação de reuniões para qualquer empresa com conta suspensa.
                  </p>
                  <p className="text-[11px] text-slate-500 pt-1">
                    • Cada mudança de status é registrada na tabela permanente AuditLog com carimbo temporal e operador.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white">Desenvolvimento & Auditoria Técnica</h4>
                  <p className="text-xs text-slate-400">
                    Gerenciado com exclusividade por <strong>AM TST (Alexandre Machado)</strong>.
                  </p>
                </div>

                <a
                  href="https://amtst.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                >
                  <span>Portal AM TST</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}
        </main>

        {/* Rodapé Consolidado */}
        <footer className="mt-auto border-t border-slate-900 py-6 px-4 text-center text-[11px] text-slate-500 space-y-1">
          <p>© {new Date().getFullYear()} <strong>DDS ON MASTER</strong> • Gestão Centralizada SuperAdmin</p>
          <p>
            Desenvolvido por{' '}
            <a
              href="https://amtst.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:underline font-bold"
            >
              AM TST
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}