'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Archive, ArrowLeftRight, Building2, CalendarClock, ClipboardCheck, History, KeyRound, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';

const MENU = [
  { href: '/check-on', label: 'Painel', icon: LayoutDashboard },
  { href: '/check-on/clientes', label: 'Clientes', icon: Building2 },
  { href: '/check-on/vencimentos', label: 'Vencimentos', icon: CalendarClock },
  { href: '/check-on/codigos', label: 'Códigos de acesso', icon: KeyRound },
  { href: '/check-on/historico', label: 'Histórico', icon: History },
  { href: '/check-on/arquivadas', label: 'Arquivadas', icon: Archive },
];

/** Área do CHECK-ON: menu próprio (azul), separado do DDS-ON. */
export default function CheckOnLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === '/check-on' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const logout = async () => {
    try {
      await fetch('/api/master/auth', { method: 'DELETE' });
    } catch {}
    try {
      localStorage.removeItem('dds_master_session');
    } catch {}
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden" />}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 flex-col justify-between border-r border-slate-800/80 bg-slate-950 transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="flex items-center justify-between border-b border-slate-900 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 shadow-lg shadow-sky-500/20">
                <ClipboardCheck size={22} className="text-white" />
              </div>
              <div>
                <span className="block text-xs font-black uppercase leading-tight tracking-widest text-sky-400">CHECK-ON</span>
                <span className="text-base font-black tracking-tight text-white">DDS MASTER</span>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-900 hover:text-white lg:hidden" aria-label="Fechar menu">
              <X size={20} />
            </button>
          </div>
          <div className="px-3 pt-3">
            <Link
              href="/"
              data-testid="switch-product"
              className="flex w-full items-center gap-2 rounded-xl border border-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-900 hover:text-white"
            >
              <ArrowLeftRight size={16} /> Trocar de produto
            </Link>
          </div>
          <nav className="space-y-1 p-3">
            {MENU.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex items-center gap-3 rounded-xl px-3.5 py-3 text-xs font-semibold transition-all ${
                    active ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-100'
                  }`}
                >
                  <Icon size={18} className={active ? 'text-white' : 'text-slate-500 group-hover:text-sky-400'} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center justify-between border-t border-slate-900 p-4">
          <div className="min-w-0 pr-2">
            <p className="truncate text-xs font-bold text-white">Administrador master</p>
            <p className="truncate text-[10px] text-slate-500">Clientes do CHECK-ON</p>
          </div>
          <button onClick={logout} className="rounded-xl p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400" title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-900 bg-slate-950/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-xl p-2 text-slate-300 hover:bg-slate-900" aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <span className="text-sm font-black text-white">CHECK-ON</span>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
