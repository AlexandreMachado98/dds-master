'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, Mail, ArrowRight, KeyRound, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MasterLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Se já estiver autenticado, redireciona para o dashboard
  useEffect(() => {
    const session = localStorage.getItem('dds_master_session');
    if (session) {
      router.push('/');
    }
  }, [router]);

  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !password) {
      setError('Informe seu e-mail e senha de acesso mestre.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/master/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, masterKey })
      });

      const data = await res.json();

      if (data.success && data.session) {
        localStorage.setItem('dds_master_session', JSON.stringify(data.session));
        router.push('/');
      } else {
        setError(data.error || 'Acesso negado.');
      }
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail('alexandre@amtst.com.br');
    setPassword('AMTST#Master2026');
    setMasterKey('AM2026');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Brilho Verde de Alta Segurança */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-600/15 blur-[140px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 backdrop-blur-md">
        
        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 bg-green-500/10 rounded-2xl border border-green-500/20 text-green-400 mb-1">
            <ShieldCheck size={36} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span> MASTER
          </h1>
          <p className="text-slate-400 text-xs font-medium">Acesso Restrito ao Administrador Geral (Proprietário)</p>
        </div>

        {/* Card de Teste Rápido (Apenas para você) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
            <KeyRound size={13} className="text-green-400" /> Acesso Mestre Salvo
          </span>
          <button
            type="button"
            onClick={handleQuickFill}
            className="text-[11px] text-green-400 hover:text-green-300 font-bold bg-green-600/20 hover:bg-green-600/30 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 border border-green-500/30"
          >
            <Sparkles size={11} /> Preencher
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleMasterLogin} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Mestre</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 text-slate-500" size={17} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alexandre@amtst.com.br"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Senha Mestra</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 text-slate-500" size={17} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Chave de Segurança (Opcional)</label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-3.5 text-slate-500" size={17} />
              <input
                type="text"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                placeholder="AM2026"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all uppercase font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/25 mt-2"
          >
            {loading ? 'Validando Acesso...' : 'Desbloquear Painel Master'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Rodapé Oficial */}
        <footer className="pt-4 border-t border-slate-800/80 text-center space-y-1.5">
          <p className="text-[11px] text-slate-400 font-normal">
            © {new Date().getFullYear()} <strong>DDS ON MASTER</strong> • Área Confidencial
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

      </div>
    </main>
  );
}