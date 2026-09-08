'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, KeyRound, ExternalLink, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MasterLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const sessionStr = localStorage.getItem('dds_master_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session && session.role === 'SUPER_ADMIN_MASTER') {
          router.push('/');
        }
      }
    } catch {
      localStorage.removeItem('dds_master_session');
    }
  }, [router]);

  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '').trim();
    const cleanKey = String(masterKey || '').toUpperCase().trim();

    try {
      const res = await fetch('/api/master/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          masterKey: cleanKey
        })
      });

      const data = await res.json().catch(() => ({ success: false, error: 'Resposta inválida do servidor.' }));

      if (res.ok && data.success && data.session) {
        localStorage.setItem('dds_master_session', JSON.stringify(data.session));
        router.push('/');
      } else {
        setError(data.error || 'Credenciais mestras incorretas. Verifique os dados informados.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Não foi possível conectar ao servidor de autenticação. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 font-sans relative overflow-x-hidden pt-safe pb-safe">
      
      {/* Luz ambiente de fundo responsiva */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-green-600/15 blur-[100px] sm:blur-[140px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/95 sm:bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl relative z-10 space-y-5 sm:space-y-6 backdrop-blur-md my-auto">
        
        <div className="text-center space-y-3">
          {/* Nova Logo Oficial do DDS Master */}
          <div className="inline-flex p-1.5 bg-slate-950 rounded-2xl border border-green-500/30 shadow-lg shadow-green-500/10">
            <img 
              src="/logo.jpg" 
              alt="DDS Master Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl"
            />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span> MASTER
            </h1>
            <p className="text-slate-400 text-xs font-medium mt-0.5">Acesso Restrito ao Proprietário (Super Admin)</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3.5 rounded-xl flex items-start gap-2.5 font-medium animate-in fade-in duration-200">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleMasterLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">E-mail Mestre</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 text-slate-500 pointer-events-none" size={17} />
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alexandre@amtst.com.br"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-3 text-base sm:text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all disabled:opacity-50 min-h-[46px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Senha Mestra</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 text-slate-500 pointer-events-none" size={17} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha mestra"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-12 py-3 text-base sm:text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all disabled:opacity-50 min-h-[46px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 text-slate-500 hover:text-slate-300 transition-colors p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center"
                title={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Chave de Segurança Mestre <span className="text-slate-500 font-normal">(Opcional)</span>
            </label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-3.5 text-slate-500 pointer-events-none" size={17} />
              <input
                type="text"
                disabled={loading}
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                placeholder="AM2026"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-3 text-base sm:text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all uppercase font-mono disabled:opacity-50 min-h-[46px]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/25 mt-3 disabled:opacity-60 disabled:cursor-not-allowed min-h-[48px]"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Validando Credenciais...
              </>
            ) : (
              <>
                Desbloquear Painel Master <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <footer className="pt-4 border-t border-slate-800/80 text-center space-y-1.5">
          <p className="text-[11px] text-slate-400 font-normal">
            © {new Date().getFullYear()} <strong>DDS ON MASTER</strong> • Área Confidencial
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

      </div>
    </main>
  );
}