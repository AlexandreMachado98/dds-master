import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { 
  Building2, Users, Video, ArrowLeft, KeyRound, 
  MapPin, ShieldCheck, Activity, HelpCircle, Award, 
  History, CheckCircle2, Clock
} from 'lucide-react';
import prisma from '@/lib/prisma';
import CompanyUserTable from './CompanyUserTable';

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CompanyDetailPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  const companyId = resolvedParams?.id;

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

  // 2. Busca reuniões da empresa ou dos técnicos vinculados
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

  // 3. Busca questionários e avaliações da empresa
  const quizzes = await prisma.quiz.findMany({
    where: {
      OR: [
        { meeting: { companyId: companyId } },
        { creator: { companyId: companyId } }
      ]
    },
    include: {
      meeting: { select: { topic: true, farm: true } },
      _count: { select: { questions: true, attempts: true } },
      attempts: { select: { score: true, passed: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // 4. Busca logs de auditoria específicos desta empresa
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { companyId: companyId },
        { entityId: companyId }
      ]
    },
    take: 20,
    orderBy: { createdAt: 'desc' }
  }).catch(() => []);

  const totalTecnicos = company.users.length;
  const totalDDS = meetings.length;
  const totalAssinaturas = meetings.reduce((acc, m) => acc + m._count.attendees, 0);
  const totalRemotos = meetings.filter(m => m.type === 'REMOTE').length;
  const totalPresenciais = meetings.filter(m => m.type === 'PRESENTIAL' || !m.type).length;
  const isSuspended = company.status === 'SUSPENDED';

  // Métricas de questionários da empresa
  const totalQuestionarios = quizzes.length;
  const totalRespostasQuiz = quizzes.reduce((acc, q) => acc + q._count.attempts, 0);
  const totalAprovadosQuiz = quizzes.reduce((acc, q) => acc + q.attempts.filter(a => a.passed).length, 0);
  const mediaNotasEmpresa = totalRespostasQuiz > 0
    ? Math.round((quizzes.reduce((acc, q) => acc + q.attempts.reduce((s, a) => s + a.score, 0), 0) / totalRespostasQuiz) * 10) / 10
    : 0;
  const taxaAprovacaoEmpresa = totalRespostasQuiz > 0
    ? Math.round((totalAprovadosQuiz / totalRespostasQuiz) * 100)
    : 0;

  return (
    <main className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-100 font-sans p-3 sm:p-6 md:p-8 flex flex-col justify-between overflow-x-hidden pt-safe pb-safe">
      <div className="max-w-7xl w-full mx-auto space-y-6 sm:space-y-8">
        
        {/* CABEÇALHO DA EMPRESA */}
        <header className="bg-slate-900/90 border border-slate-800 p-4 sm:p-6 rounded-2xl sm:rounded-3xl backdrop-blur-md shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
              <Link
                href="/"
                className="p-2.5 sm:p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-colors flex items-center justify-center group shrink-0 min-w-[44px] min-h-[44px]"
                title="Voltar ao Painel Master"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              </Link>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2 truncate">
                    <Building2 className="text-green-400 shrink-0" size={24} /> {company.name}
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border shrink-0 ${
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

            <div className="bg-slate-950 border border-slate-800 px-4 py-3 rounded-2xl flex items-center gap-3 shrink-0">
              <KeyRound size={20} className="text-green-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Chave de Cadastro Automático</p>
                <p className="font-mono text-sm font-black text-green-400 tracking-wider">
                  {company.secretKey || 'SEM CHAVE'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* CARDS DE MÉTRICAS OPERACIONAIS E BI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Users size={14} className="text-blue-400 shrink-0" /> Técnicos
            </span>
            <p className="text-2xl font-black text-white">{totalTecnicos}</p>
            <span className="text-[10px] text-slate-500 block">Vinculados</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Video size={14} className="text-emerald-400 shrink-0" /> DDSs
            </span>
            <p className="text-2xl font-black text-white">{totalDDS}</p>
            <span className="text-[10px] text-slate-500 block truncate">
              {totalPresenciais} pres. • {totalRemotos} vivo
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-green-400 shrink-0" /> Presenças
            </span>
            <p className="text-2xl font-black text-green-400">{totalAssinaturas}</p>
            <span className="text-[10px] text-slate-500 block">Auditadas</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Activity size={14} className="text-amber-400 shrink-0" /> Média / DDS
            </span>
            <p className="text-2xl font-black text-amber-400">
              {totalDDS > 0 ? (totalAssinaturas / totalDDS).toFixed(1) : '0'}
            </p>
            <span className="text-[10px] text-slate-500 block">Partic. / reunião</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <HelpCircle size={14} className="text-purple-400 shrink-0" /> Avaliações
            </span>
            <p className="text-2xl font-black text-white">{totalQuestionarios}</p>
            <span className="text-[10px] text-slate-500 block">{totalRespostasQuiz} respostas</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-lg">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Award size={14} className="text-amber-400 shrink-0" /> Média Notas
            </span>
            <p className="text-2xl font-black text-amber-400">{mediaNotasEmpresa} <span className="text-xs text-slate-400">pts</span></p>
            <span className="text-[10px] text-emerald-400 block font-semibold">{taxaAprovacaoEmpresa}% aprov.</span>
          </div>
        </div>

        {/* SEÇÃO 1: TABELA DE TÉCNICOS COM BOTÃO DE EXCLUSÃO E EDIÇÃO */}
        <CompanyUserTable initialUsers={company.users} />

        {/* SEÇÃO 2: QUESTIONÁRIOS E AVALIAÇÕES DA EMPRESA */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle size={18} className="text-purple-400 shrink-0" /> Questionários e Avaliações de Eficácia ({quizzes.length})
              </h2>
              <p className="text-xs text-slate-400">Avaliações criadas e participação dos colaboradores desta empresa</p>
            </div>
          </div>

          {quizzes.length === 0 ? (
            <p className="py-8 text-center text-slate-500 text-xs">
              Nenhuma avaliação ou questionário criado por esta empresa até o momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quizzes.map((quiz) => {
                const attemptsCount = quiz._count.attempts;
                const passedCount = quiz.attempts.filter(a => a.passed).length;
                const avgScore = attemptsCount > 0
                  ? Math.round((quiz.attempts.reduce((acc, a) => acc + a.score, 0) / attemptsCount) * 10) / 10
                  : 0;

                return (
                  <div key={quiz.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">{quiz.title}</p>
                        {quiz.meeting && (
                          <p className="text-[11px] text-slate-400 truncate">DDS: {quiz.meeting.topic}</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold shrink-0 border ${
                        quiz.status === 'PUBLISHED'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {quiz.status === 'PUBLISHED' ? 'PUBLICADO' : quiz.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-900 text-center text-xs">
                      <div>
                        <span className="text-[9px] text-slate-500 block">Questões</span>
                        <span className="font-bold text-white">{quiz._count.questions}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Respostas</span>
                        <span className="font-bold text-green-400">{attemptsCount}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Média</span>
                        <span className="font-bold text-amber-400">{avgScore} pts</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SEÇÃO 3: HISTÓRICO DE DDSs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Video size={18} className="text-emerald-400 shrink-0" /> Histórico de Treinamentos e DDSs ({meetings.length})
              </h2>
              <p className="text-xs text-slate-400">Registro de todas as atas geradas e reuniões realizadas</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
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
                    <td colSpan={7} className="py-12 text-center text-slate-500">
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
                          <MapPin size={12} className="text-slate-500 shrink-0" /> {meeting.farm}
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
                        <span className="text-[10px] text-slate-500 block">presentes auditados</span>
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
                      <td className="py-4 text-right text-slate-400 font-mono text-[11px]">
                        {new Date(meeting.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SEÇÃO 4: TRILHA DE AUDITORIA DA EMPRESA */}
        {auditLogs.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <History size={18} className="text-amber-400 shrink-0" /> Trilha de Auditoria Administrativa ({auditLogs.length})
            </h2>

            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">{log.action}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {log.newValue ? `Alterado para: ${log.newValue}` : (log.details || 'Ação registrada')}
                    </p>
                  </div>
                  <span className="font-mono text-slate-500 text-[10px]">
                    {new Date(log.createdAt).toLocaleDateString('pt-BR')} {new Date(log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <footer className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-slate-900 text-center space-y-1.5 max-w-7xl w-full mx-auto">
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
            AM TST
          </a>
        </div>
      </footer>
    </main>
  );
}