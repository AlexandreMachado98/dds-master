 'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, KeyRound, ExternalLink, ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MasterLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Credenciais Mestras Oficiais
  const MASTER_EMAIL = 'alexandre@amtst.com.br';
  const MASTER_PASSWORD = 'AMTST#Master2026';
  const MASTER_KEY = 'AM2026';

  useEffect(() => {
    const session = localStorage.getItem('dds_master_session');
    if (session) {
      router.push('/');
    }
  }, [router]);

  const handleMasterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '').trim();
    const cleanKey = String(masterKey || '').toUpperCase().trim();

    const isEmailValid = cleanEmail === MASTER_EMAIL;
    const isPassValid = cleanPassword === MASTER_PASSWORD;
    const isKeyValid = !cleanKey || cleanKey === MASTER_KEY;

    if (isEmailValid && isPassValid && isKeyValid) {
      const session = {
        id: 'master-owner-01',
        email: MASTER_EMAIL,
        name: 'Alexandre Machado',
        role: 'SUPER_ADMIN_MASTER',
        authenticatedAt: new Date().toISOString()
      };

      localStorage.setItem('dds_master_session', JSON.stringify(session));
      router.push('/');
    } else {
      setError('Credenciais mestras incorretas. Verifique os dados informados.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-600/15 blur-[140px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6 backdrop-blur-md">
        
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 bg-green-500/10 rounded-2xl border border-green-500/20 text-green-400 mb-1">
            <ShieldCheck size={36} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            DDS <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">ON</span> MASTER
          </h1>
          <p className="text-slate-400 text-xs font-medium">Acesso Restrito ao Proprietário (Super Admin)</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3.5 rounded-xl text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleMasterLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">E-mail Mestre</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 text-slate-500" size={17} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail mestre"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Senha Mestra</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 text-slate-500" size={17} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha mestra"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-500 hover:text-slate-300 transition-colors p-1"
                title={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Chave de Segurança</label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-3.5 text-slate-500" size={17} />
              <input
                type="text"
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                placeholder="Digite a chave de segurança"
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-10 py-3 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-green-500 outline-none transition-all uppercase font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/25 mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Entrando...
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