'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  HelpCircle,
  Search,
  RefreshCw,
  Trophy,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Award,
  Users,
  Eye,
  Building2,
  Video,
  FileDown,
  Loader2
} from 'lucide-react';

interface QuizItem {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  passingScore: number;
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  shareToken: string;
  showRanking: boolean;
  company: { id: string | null; name: string };
  meeting: { id: string; topic: string; farm: string; status: string } | null;
  creatorName: string;
  questionsCount: number;
  totalAttempts: number;
  passedAttempts: number;
  avgScore: number;
  passRate: number;
}

interface QuizDetailData {
  id: string;
  title: string;
  status: string;
  passingScore: number;
  criticalBelow: number;
  excellentFrom: number;
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  company: { id: string | null; name: string };
  meeting: { id: string; topic: string; farm: string; status: string; organizerName: string } | null;
  creator: { id: string; name: string; email: string } | null;
  stats: {
    totalQuestions: number;
    totalAttempts: number;
    passedAttempts: number;
    avgScore: number;
    passingRate: number;
  };
  questions: Array<{
    id: string;
    text: string;
    type: string;
    weight: number;
    totalAnswers: number;
    correctAnswers: number;
    errorAnswers: number;
    errorRate: number;
    options: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>;
  ranking: Array<{
    rank: number;
    name: string;
    doc: string;
    score: number;
    passed: boolean;
    level: string;
    timeSpentSeconds: number | null;
    submittedAt: string;
  }>;
}

export default function QuizzesModule() {
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [quizDetail, setQuizDetail] = useState<QuizDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Carrega listagem de questionários
  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search) params.set('q', search);

      const res = await fetch(`/api/master/questionarios?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setQuizzes(data.quizzes || []);
      }
    } catch (err) {
      console.error('Erro ao buscar questionários:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  // Carrega detalhes de um questionário
  const handleOpenDetail = async (id: string) => {
    setSelectedQuizId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/master/questionarios?id=${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setQuizDetail(data.quiz);
      }
    } catch (err) {
      console.error('Erro ao buscar detalhe do questionário:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalQuizzes = quizzes.length;
  const totalResponses = quizzes.reduce((acc, q) => acc + q.totalAttempts, 0);
  const avgOverallScore = totalResponses > 0
    ? Math.round((quizzes.reduce((acc, q) => acc + (q.avgScore * q.totalAttempts), 0) / totalResponses) * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <HelpCircle className="text-green-400" size={22} /> Gestão de Questionários e Avaliações
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Supervisão global de avaliações de eficácia, participação de colaboradores e rankings do DDS-ON.
            </p>
          </div>

          <button
            onClick={fetchQuizzes}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Mini Cards de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Total Criados</span>
            <p className="text-xl font-black text-white">{totalQuizzes}</p>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Total Respostas</span>
            <p className="text-xl font-black text-emerald-400">{totalResponses}</p>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Média Geral</span>
            <p className="text-xl font-black text-amber-400">{avgOverallScore} pts</p>
          </div>
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Publicados Ativos</span>
            <p className="text-xl font-black text-green-400">
              {quizzes.filter((q) => q.status === 'PUBLISHED').length}
            </p>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, tema de DDS ou empresa..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-green-500 min-h-[42px]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none focus:ring-2 focus:ring-green-500 min-h-[42px]"
          >
            <option value="ALL">Todos os Status</option>
            <option value="PUBLISHED">Apenas Publicados</option>
            <option value="CLOSED">Apenas Encerrados</option>
            <option value="DRAFT">Rascunhos (Draft)</option>
          </select>
        </div>
      </div>

      {/* Listagem em Cards e Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-green-500" />
            <p className="text-xs">Carregando questionários...</p>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <HelpCircle size={36} className="mx-auto opacity-30 text-green-500" />
            <p className="text-sm font-semibold text-slate-300">Nenhum questionário encontrado</p>
            <p className="text-xs">Não foram encontradas avaliações com os filtros atuais.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-green-400 font-bold block truncate">
                        {quiz.company.name}
                      </span>
                      <h3 className="font-bold text-white text-sm truncate">{quiz.title}</h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold shrink-0 border ${
                        quiz.status === 'PUBLISHED'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : quiz.status === 'CLOSED'
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {quiz.status === 'PUBLISHED'
                        ? 'PUBLICADO'
                        : quiz.status === 'CLOSED'
                        ? 'ENCERRADO'
                        : 'RASCUNHO'}
                    </span>
                  </div>

                  {quiz.meeting && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Video size={13} className="text-emerald-400 shrink-0" />
                      <span className="truncate">DDS: {quiz.meeting.topic} ({quiz.meeting.farm})</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-900 text-center">
                    <div className="bg-slate-900/60 p-2 rounded-xl">
                      <span className="text-[9px] text-slate-500 block">Questões</span>
                      <span className="font-bold text-white text-xs">{quiz.questionsCount}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl">
                      <span className="text-[9px] text-slate-500 block">Respostas</span>
                      <span className="font-bold text-green-400 text-xs">{quiz.totalAttempts}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-xl">
                      <span className="text-[9px] text-slate-500 block">Média</span>
                      <span className="font-bold text-amber-400 text-xs">{quiz.avgScore} pts</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-900/80 text-[11px]">
                  <span className="text-slate-500">
                    {new Date(quiz.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                  <button
                    onClick={() => handleOpenDetail(quiz.id)}
                    className="px-3 py-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Eye size={13} />
                    <span>Ver Detalhes & Ranking</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalhamento e Ranking do Questionário */}
      {selectedQuizId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => {
                setSelectedQuizId(null);
                setQuizDetail(null);
              }}
              className="absolute top-5 right-5 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>

            {detailLoading || !quizDetail ? (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <Loader2 size={30} className="animate-spin text-green-500" />
                <p className="text-xs text-slate-400">Carregando dossiê da avaliação...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <span className="text-xs text-green-400 font-bold uppercase block">
                    {quizDetail.company.name}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {quizDetail.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {quizDetail.meeting ? `Vinculado ao DDS: ${quizDetail.meeting.topic}` : 'Questionário Autônomo'} • Criado em {new Date(quizDetail.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                {/* KPIs da Avaliação */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Participantes</span>
                    <p className="text-2xl font-black text-white">{quizDetail.stats.totalAttempts}</p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Aprovados</span>
                    <p className="text-2xl font-black text-green-400">{quizDetail.stats.passedAttempts}</p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Média Geral</span>
                    <p className="text-2xl font-black text-amber-400">{quizDetail.stats.avgScore} pts</p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Taxa Aprovação</span>
                    <p className="text-2xl font-black text-emerald-400">{quizDetail.stats.passingRate}%</p>
                  </div>
                </div>

                {/* Ranking com Pódio Inteligente */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Trophy size={16} className="text-amber-400" /> Ranking e Pódio dos Participantes
                  </h3>

                  {quizDetail.ranking.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">Nenhuma resposta registrada ainda.</p>
                  ) : (
                    <div className="space-y-2 overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                            <th className="pb-2 font-semibold">Posição</th>
                            <th className="pb-2 font-semibold">Colaborador</th>
                            <th className="pb-2 font-semibold text-center">Nota</th>
                            <th className="pb-2 font-semibold text-center">Tempo Resposta</th>
                            <th className="pb-2 font-semibold text-right">Situação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {quizDetail.ranking.map((row) => (
                            <tr key={row.attemptId} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                                    row.rank === 1
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : row.rank === 2
                                      ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30'
                                      : row.rank === 3
                                      ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  #{row.rank} {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : ''}
                                </span>
                              </td>
                              <td className="py-2.5">
                                <span className="font-bold text-white block">{row.name}</span>
                                {row.doc && <span className="text-[10px] text-slate-500">{row.doc}</span>}
                              </td>
                              <td className="py-2.5 text-center font-black text-amber-400">
                                {row.score} pts
                              </td>
                              <td className="py-2.5 text-center text-slate-400 font-mono text-[11px]">
                                {row.timeSpentSeconds ? `${row.timeSpentSeconds}s` : '—'}
                              </td>
                              <td className="py-2.5 text-right">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    row.passed
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  }`}
                                >
                                  {row.passed ? 'APROVADO' : 'REPROVADO'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Análise de Perguntas e Fragilidades */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-400" /> Análise de Perguntas e Taxa de Erros
                  </h3>

                  <div className="space-y-3">
                    {quizDetail.questions.map((q, idx) => (
                      <div key={q.id} className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-white">
                            #{idx + 1}. {q.text}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                              q.errorRate > 50
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-green-500/20 text-green-400 border border-green-500/30'
                            }`}
                          >
                            {q.errorRate}% erros ({q.errorAnswers}/{q.totalAnswers})
                          </span>
                        </div>

                        <div className="space-y-1 pt-1">
                          {q.options.map((opt) => (
                            <div
                              key={opt.id}
                              className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                                opt.isCorrect
                                  ? 'bg-green-500/10 text-green-300 font-semibold border border-green-500/20'
                                  : 'text-slate-400'
                              }`}
                            >
                              <span>{opt.text}</span>
                              {opt.isCorrect && <CheckCircle2 size={13} className="text-green-400" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
