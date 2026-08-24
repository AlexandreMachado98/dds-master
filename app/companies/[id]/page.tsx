 import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { 
  Building2, Users, Video, ArrowLeft, KeyRound, 
  MapPin, ShieldCheck, ExternalLink, Activity
} from 'lucide-react';
import { PrismaClient } from '@prisma/client';
import CompanyUserTable from './CompanyUserTable'; // Componente de ações do usuário

const prisma = new PrismaClient();

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  const companyId = resolvedParams.id;

  if (!companyId) {
    notFound();
  }

  // 1. Busca os dados da empresa e seus técnicos
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      users: {
        include: {
          _count: {
            select: { meetings: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!company) {
    notFound();
  }

  // 2. Busca reuniões da empresa ou dos técnicos
  const meetings = await prisma.meeting.findMany({
    where: {
      OR: [
        { companyId: companyId },
        { organizer: { companyId: companyId } }
      ]
    },
    include: {
      organizer: { select: { name: true, email: true } },
      _count: { select: { attendees: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const totalTecnicos = company.users.length;
  const totalDDS = meetings.length;
  const totalAssinaturas = meetings.reduce((acc, m) => acc + m._count.attendees, 0);
  const totalRemotos = meetings.filter(m => m.type === 'REMOTE').length;
  const totalPresenciais = meetings.filter(m => m.type === 'PRESENTIAL' || !m.type).length;
  const isSuspended = company.status === 'SUSPENDED';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 flex flex-col justify-between">
      <div className="max-w-7xl w-full mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <header className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl backdrop-blur-md shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-colors flex items-center justify-center group"
                title="Voltar ao Painel Master"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              </Link>
              
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    <Building2 className="text-green-400" size={26} /> {company.name}
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                    isSuspended 
                      ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                      : 'bg-green-500/20 text-green-300 border-green-500/30'
                  }`}>
                    {isSuspended ? '🔴 Empresa Suspensa' : '🟢 Empresa Ativa'}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1">
                  Documento: <strong className="text-slate-200">{company.document || 'Não informado'}</strong> • Cadastrada em: <strong className="text-slate-200">{new Date(company.createdAt).toLocaleDateString('pt-BR')}</strong>
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 px-4 py-3 rounded-2xl flex items-center gap-3">
              <KeyRound size={18} className="text-green-400" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Chave de Cadastro Automático</p>
                <p className="font-mono text-sm font-black text-green-400 tracking-wider">
                  {company.secretKey || 'SEM CHAVE'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* CARDS DE MÉTRICAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Users size={15} className="text-blue-400" /> Técnicos Vinculados
            </span>
            <p className="text-3xl font-black text-white">{totalTecnicos}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Video size={15} className="text-emerald-400" /> Total de DDSs
            </span>
            <p className="text-3xl font-black text-white">{totalDDS}</p>
            <span className="text-[10px] text-slate-500 block">
              {totalPresenciais} presenciais • {totalRemotos} ao vivo
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-green-400" /> Presenças Auditadas
            </span>
            <p className="text-3xl font-black text-green-400">{totalAssinaturas}</p>
            <span className="text-[10px] text-slate-500 block">Com biometria facial</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Activity size={15} className="text-amber-400" /> Média por DDS
            </span>
            <p className="text-3xl font-black text-amber-400">
              {totalDDS > 0 ? (totalAssinaturas / totalDDS).toFixed(1) : '0'}
            </p>
            <span className="text-[10px] text-slate-500 block">Participantes / reunião</span>
          </div>
        </div>

        {/* SEÇÃO 1: TABELA DE TÉCNICOS COM BOTÃO DE EXCLUSÃO */}
        <CompanyUserTable initialUsers={company.users} />

        {/* SEÇÃO 2: HISTÓRICO DE DDSs */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Video size={18} className="text-emerald-400" /> Histórico de Treinamentos e DDSs ({meetings.length})
              </h2>
              <p className="text-xs text-slate-400">Registro de todas as atas geradas e reuniões realizadas</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">Tema do DDS</th>
                  <th className="pb-3 font-semibold">Local / Fazenda</th>
                  <th className="pb-3 font-semibold">Modalidade</th>
                  <th className="pb-3 font-semibold">Técnico Responsável</th>
                  <th className="pb-3 font-semibold">Assinaturas</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {meetings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Nenhum DDS registrado por esta empresa ou seus técnicos até o momento.
                    </td>
                  </tr>
                ) : (
                  meetings.map((meeting) => (
                    <tr key={meeting.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4">
                        <p className="font-bold text-white text-sm">{meeting.topic}</p>
                        {meeting.objective && (
                          <p className="text-[11px] text-slate-500 truncate max-w-xs">{meeting.objective}</p>
                        )}
                      </td>
                      <td className="py-4 text-slate-300">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-slate-500" /> {meeting.farm}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] border ${
                          meeting.type === 'REMOTE' 
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' 
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                        }`}>
                          {meeting.type === 'REMOTE' ? '📹 AO VIVO' : '👥 CAMPO'}
                        </span>
                      </td>
                      <td className="py-4">
                        <p className="font-semibold text-slate-200">{meeting.organizer?.name || 'Técnico Não Identificado'}</p>
                        <p className="text-[10px] text-slate-500">{meeting.organizer?.email}</p>
                      </td>
                      <td className="py-4">
                        <span className="font-black text-green-400 text-sm">
                          {meeting._count.attendees}
                        </span>
                        <span className="text-[10px] text-slate-500 block">presentes</span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          meeting.status === 'LIVE'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {meeting.status === 'LIVE' ? 'EM ANDAMENTO' : 'ENCERRADA'}
                        </span>
                      </td>
                      <td className="py-4 text-right text-slate-400 font-mono">
                        {new Date(meeting.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

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