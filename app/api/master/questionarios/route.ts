import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId')?.trim();
    const status = searchParams.get('status')?.trim(); // DRAFT, PUBLISHED, CLOSED
    const query = searchParams.get('q')?.trim() || '';
    const quizId = searchParams.get('id')?.trim();

    // -------------------------------------------------------------------------
    // CASO 1: DETALHAMENTO DE UM QUESTIONÁRIO ESPECÍFICO
    // -------------------------------------------------------------------------
    if (quizId) {
      const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: {
          meeting: {
            select: {
              id: true,
              topic: true,
              farm: true,
              status: true,
              createdAt: true,
              company: { select: { id: true, name: true } },
              organizer: { select: { id: true, name: true, email: true } }
            }
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              company: true,
              companyRel: { select: { id: true, name: true } }
            }
          },
          questions: {
            orderBy: { position: 'asc' },
            include: {
              options: { orderBy: { position: 'asc' } },
              answers: { select: { id: true, correct: true, selectedOptionIds: true, earnedPoints: true } }
            }
          },
          attempts: {
            orderBy: [{ score: 'desc' }, { timeSpentSeconds: 'asc' }, { submittedAt: 'asc' }],
            include: {
              attendance: { select: { id: true, name: true, cpf: true } },
              answers: { select: { questionId: true, correct: true, selectedOptionIds: true, earnedPoints: true } }
            }
          }
        }
      });

      if (!quiz) {
        return NextResponse.json({ success: false, error: 'Questionário não encontrado.' }, { status: 404 });
      }

      // Estatísticas agregadas deste questionário
      const totalAttempts = quiz.attempts.length;
      const passedAttempts = quiz.attempts.filter((a) => a.passed).length;
      const avgScore = totalAttempts > 0 
        ? Math.round((quiz.attempts.reduce((acc, a) => acc + a.score, 0) / totalAttempts) * 10) / 10 
        : 0;
      const passingRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;

      // Análise de fragilidade por questão
      const questionsAnalysis = quiz.questions.map((q) => {
        const totalAnswers = q.answers.length;
        const correctAnswers = q.answers.filter((ans) => ans.correct).length;
        const errorAnswers = totalAnswers - correctAnswers;
        const errorRate = totalAnswers > 0 ? Math.round((errorAnswers / totalAnswers) * 100) : 0;

        return {
          id: q.id,
          text: q.text,
          type: q.type,
          weight: q.weight,
          position: q.position,
          explanation: q.explanation,
          totalAnswers,
          correctAnswers,
          errorAnswers,
          errorRate,
          options: q.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            isCorrect: opt.isCorrect,
            position: opt.position
          }))
        };
      });

      // Ranking ordenado com desempate e pódio
      let currentRank = 1;
      const ranking = quiz.attempts.map((attempt, index) => {
        if (index > 0) {
          const prev = quiz.attempts[index - 1];
          const sameScore = prev.score === attempt.score;
          const sameTime = (prev.timeSpentSeconds || 0) === (attempt.timeSpentSeconds || 0);
          if (!sameScore || !sameTime) {
            currentRank = index + 1;
          }
        }

        const name = attempt.participantName || attempt.attendance?.name || 'Participante';
        const doc = attempt.participantDoc || attempt.attendance?.cpf || '';

        return {
          rank: currentRank,
          attemptId: attempt.id,
          name,
          doc,
          score: attempt.score,
          passed: attempt.passed,
          level: attempt.level,
          timeSpentSeconds: attempt.timeSpentSeconds ?? null,
          submittedAt: attempt.submittedAt
        };
      });

      const companyName = quiz.meeting?.company?.name || quiz.creator?.companyRel?.name || quiz.creator?.company || 'Geral / Desvinculada';
      const companyIdResolved = quiz.meeting?.company?.id || quiz.creator?.companyRel?.id || null;

      return NextResponse.json({
        success: true,
        quiz: {
          id: quiz.id,
          title: quiz.title,
          status: quiz.status,
          passingScore: quiz.passingScore,
          criticalBelow: quiz.criticalBelow,
          excellentFrom: quiz.excellentFrom,
          shareToken: quiz.shareToken,
          isTemplate: quiz.isTemplate,
          showRanking: quiz.showRanking,
          createdAt: quiz.createdAt,
          publishedAt: quiz.publishedAt,
          closedAt: quiz.closedAt,
          company: { id: companyIdResolved, name: companyName },
          meeting: quiz.meeting ? {
            id: quiz.meeting.id,
            topic: quiz.meeting.topic,
            farm: quiz.meeting.farm,
            status: quiz.meeting.status,
            organizerName: quiz.meeting.organizer?.name || 'Técnico'
          } : null,
          creator: quiz.creator ? {
            id: quiz.creator.id,
            name: quiz.creator.name,
            email: quiz.creator.email
          } : null,
          stats: {
            totalQuestions: quiz.questions.length,
            totalAttempts,
            passedAttempts,
            avgScore,
            passingRate
          },
          questions: questionsAnalysis,
          ranking
        }
      });
    }

    // -------------------------------------------------------------------------
    // CASO 2: LISTAGEM GERAL DE QUESTIONÁRIOS COM FILTROS E MÉTRICAS
    // -------------------------------------------------------------------------
    const where: any = {};

    if (companyId) {
      where.OR = [
        { meeting: { companyId } },
        { creator: { companyId } }
      ];
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { meeting: { topic: { contains: query, mode: 'insensitive' } } },
        { creator: { name: { contains: query, mode: 'insensitive' } } }
      ];
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        meeting: {
          select: {
            id: true,
            topic: true,
            farm: true,
            status: true,
            company: { select: { id: true, name: true } },
            organizer: { select: { name: true } }
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            company: true,
            companyRel: { select: { id: true, name: true } }
          }
        },
        _count: {
          select: {
            questions: true,
            attempts: true
          }
        },
        attempts: {
          select: {
            score: true,
            passed: true
          }
        }
      }
    });

    // Formatação dos questionários com cálculos consolidados
    const formattedQuizzes = quizzes.map((q) => {
      const attemptsCount = q._count.attempts;
      const passedCount = q.attempts.filter((a) => a.passed).length;
      const avgScore = attemptsCount > 0
        ? Math.round((q.attempts.reduce((acc, a) => acc + a.score, 0) / attemptsCount) * 10) / 10
        : 0;
      const passRate = attemptsCount > 0 ? Math.round((passedCount / attemptsCount) * 100) : 0;

      const companyName = q.meeting?.company?.name || q.creator?.companyRel?.name || q.creator?.company || 'Desvinculada';
      const companyIdResolved = q.meeting?.company?.id || q.creator?.companyRel?.id || null;

      return {
        id: q.id,
        title: q.title,
        status: q.status,
        passingScore: q.passingScore,
        createdAt: q.createdAt,
        publishedAt: q.publishedAt,
        closedAt: q.closedAt,
        shareToken: q.shareToken,
        showRanking: q.showRanking,
        company: { id: companyIdResolved, name: companyName },
        meeting: q.meeting ? {
          id: q.meeting.id,
          topic: q.meeting.topic,
          farm: q.meeting.farm,
          status: q.meeting.status
        } : null,
        creatorName: q.creator?.name || 'Sistema',
        questionsCount: q._count.questions,
        totalAttempts: attemptsCount,
        passedAttempts: passedCount,
        avgScore,
        passRate
      };
    });

    // Indicadores executivos globais dos questionários
    const totalQuizzes = formattedQuizzes.length;
    const publishedQuizzes = formattedQuizzes.filter((q) => q.status === 'PUBLISHED').length;
    const closedQuizzes = formattedQuizzes.filter((q) => q.status === 'CLOSED').length;
    const draftQuizzes = formattedQuizzes.filter((q) => q.status === 'DRAFT').length;
    const totalResponses = formattedQuizzes.reduce((acc, q) => acc + q.totalAttempts, 0);
    const overallAvgScore = totalResponses > 0
      ? Math.round((formattedQuizzes.reduce((acc, q) => acc + (q.avgScore * q.totalAttempts), 0) / totalResponses) * 10) / 10
      : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalQuizzes,
        publishedQuizzes,
        closedQuizzes,
        draftQuizzes,
        totalResponses,
        overallAvgScore
      },
      quizzes: formattedQuizzes
    });
  } catch (error: any) {
    console.error('[API /api/master/questionarios GET Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao carregar questionários.' },
      { status: 500 }
    );
  }
}
