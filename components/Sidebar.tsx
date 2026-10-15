'use client';

import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Video,
  FileCheck2,
  HelpCircle,
  BarChart3,
  History,
  FileDown,
  Activity,
  Settings,
  LogOut,
  X,
  ShieldCheck
} from 'lucide-react';

export type NavTab =
  | 'DASHBOARD'
  | 'COMPANIES'
  | 'USERS'
  | 'DDS'
  | 'ATTENDANCES'
  | 'QUIZZES'
  | 'BI'
  | 'HISTORY'
  | 'REPORTS'
  | 'MONITORING'
  | 'SETTINGS';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  pendingApprovalsCount: number;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  pendingApprovalsCount,
  isOpen,
  onClose,
  onLogout
}: SidebarProps) {
  const navItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'COMPANIES', label: 'Empresas', icon: Building2, badge: null },
    {
      id: 'USERS',
      label: 'Usuários & Fila',
      icon: Users,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
      badgeColor: 'bg-amber-500 text-slate-950 font-black'
    },
    { id: 'DDS', label: 'Treinamentos DDS', icon: Video, badge: null },
    { id: 'ATTENDANCES', label: 'Presenças & Listas', icon: FileCheck2, badge: null },
    { id: 'QUIZZES', label: 'Questionários', icon: HelpCircle, badge: 'NOVO', badgeColor: 'bg-green-500/20 text-green-400 border border-green-500/30' },
    { id: 'BI', label: 'BI & Indicadores', icon: BarChart3, badge: 'BI', badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
    { id: 'HISTORY', label: 'Histórico Global', icon: History, badge: null },
    { id: 'REPORTS', label: 'Relatórios & PDFs', icon: FileDown, badge: null },
    { id: 'MONITORING', label: 'Saúde & Conexão', icon: Activity, badge: null },
    { id: 'SETTINGS', label: 'Configurações', icon: Settings, badge: null }
  ];

  return (
    <>
      {/* Overlay Mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabeçalho do Menu */}
        <div>
          <div className="p-5 flex items-center justify-between border-b border-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white shadow-lg shadow-green-500/20 shrink-0">
                <ShieldCheck size={22} className="text-white" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-widest font-black text-green-400 block leading-tight">
                  SuperAdmin
                </span>
                <span className="text-base font-black text-white tracking-tight">
                  DDS MASTER
                </span>
              </div>
            </div>

            {/* Botão Fechar Mobile */}
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Lista de Navegação */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-170px)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as NavTab);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-600/20'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      size={18}
                      className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-green-400 transition-colors'}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        item.badgeColor || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Rodapé do Menu com Usuário e Logout */}
        <div className="p-4 border-t border-slate-900 bg-slate-950/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-bold text-white truncate">Alexandre Machado</p>
              <p className="text-[10px] text-slate-500 truncate">alexandre@amtst.com.br</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition-all shrink-0"
              title="Encerrar Sessão Mestre"
            >
              <LogOut size={16} />
            </button>
          </div>

          <div className="pt-2 border-t border-slate-900/80 flex items-center justify-between text-[10px] text-slate-600 font-medium">
            <span>DDS Master v2.0</span>
            <span className="flex items-center gap-1.5 text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Neon Active
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
