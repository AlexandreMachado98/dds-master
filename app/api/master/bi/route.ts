import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, 12m, all
    const companyId = searchParams.get('companyId')?.trim();

    // 1. Cálculo do intervalo de datas
    const now = new Date();
    let startDate: Date | null = null;

    if (period === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === '90d') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (period === '12m') {
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    // Filtros base
    const dateFilter = startDate ? { gte: startDate } : undefined;
    const meetingWhere: any = {};
    if (companyId) meetingWhere.companyId = companyId;
    if (dateFilter) meetingWhere.createdAt = dateFilter;

    const quizWhere: any = {};
    if (companyId) {
      quizWhere.OR = [
        { meeting: { companyId } },
        { creator: { companyId } }
      ];
    }
    if (dateFilter) quizWhere.createdAt = dateFilter;

    const attemptWhere: any = {};
    if (companyId) {
      attemptWhere.quiz = {
        OR: [
          { meeting: { companyId } },
          { creator: { companyId } }
        ]
      };
    }
    if (dateFilter) attemptWhere.submittedAt = dateFilter;

    // 2. Consultas Agregadas Paralelas de Alta Performance
    const [
      totalMeetings,
      remoteMeetings,
      presentialMeetings,
      liveMeetings,
      totalAttendees,
      totalQuizzes,
      publishedQuizzes,
      totalAttempts,
      passedAttempts,
      companiesStats,
      allAttemptsForScore,
      monthlyMeetingsRaw
    ] = await Promise.all([
      prisma.meeting.count({ where: meetingWhere }),
      prisma.meeting.count({ where: { ...meetingWhere, type: 'REMOTE' } }),
      prisma.meeting.count({ where: { ...meetingWhere, type: 'PRESENTIAL' } }),
      prisma.meeting.count({ where: { ...meetingWhere, status: 'LIVE' } }),
      prisma.attendance.count({
        where: companyId ? { meeting: { companyId } } : (dateFilter ? { createdAt: dateFilter } : undefined)
      }),
      prisma.quiz.count({ where: quizWhere }),
      prisma.quiz.count({ where: { ...quizWhere, status: 'PUBLISHED' } }),
      prisma.quizAttempt.count({ where: attemptWhere }),
      prisma.quizAttempt.count({ where: { ...attemptWhere, passed: true } }),
      prisma.company.findMany({
        where: companyId ? { id: companyId } : undefined,
        select: {
          id: true,
          name: true,
          status: true,
          _count: {
            select: {
              users: true,
              meetings: true
            }
          },
          meetings: {
            select: {
              _count: { select: { attendees: true, quizzes: true } }
            }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.quizAttempt.findMany({
        where: attemptWhere,
        select: { score: true, level: true, submittedAt: true }
      }),
      prisma.meeting.findMany({
        where: meetingWhere,
        select: { createdAt: true, type: true },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    // 3. Distribuição de Aproveitamento e Desempenho
    let totalScoreSum = 0;
    const levelCounts: Record<string, number> = { EXCELLENT: 0, PASS: 0, CRITICAL: 0, OTHER: 0 };

    allAttemptsForScore.forEach((a) => {
      totalScoreSum += a.score;
      const lvl = (a.level || 'OTHER').toUpperCase();
      levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
    });

    const avgScore = totalAttempts > 0 ? Math.round((totalScoreSum / totalAttempts) * 10) / 10 : 0;
    const approvalRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;
    const avgAttendeesPerMeeting = totalMeetings > 0 ? Math.round((totalAttendees / totalMeetings) * 10) / 10 : 0;

    // 4. Agrupamento Temporal de Reuniões (Por Mês)
    const monthlyGroups: Record<string, { month: string; ddsTotal: number; remote: number; presential: number }> = {};

    monthlyMeetingsRaw.forEach((m) => {
      const d = new Date(m.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

      if (!monthlyGroups[key]) {
        monthlyGroups[key] = { month: monthLabel, ddsTotal: 0, remote: 0, presential: 0 };
      }
      monthlyGroups[key].ddsTotal += 1;
      if (m.type === 'REMOTE') monthlyGroups[key].remote += 1;
      else monthlyGroups[key].presential += 1;
    });

    const monthlyEvolution = Object.entries(monthlyGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => data);

    // 5. Comparativo Consolidado por Empresa
    const companyComparison = companiesStats.map((c) => {
      const totalCompanyAttendees = c.meetings.reduce((acc, m) => acc + m._count.attendees, 0);
      const totalCompanyQuizzes = c.meetings.reduce((acc, m) => acc + m._count.quizzes, 0);

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        usersCount: c._count.users,
        meetingsCount: c._count.meetings,
        attendeesCount: totalCompanyAttendees,
        quizzesCount: totalCompanyQuizzes
      };
    }).sort((a, b) => b.meetingsCount - a.meetingsCount);

    return NextResponse.json({
      success: true,
      period,
      kpis: {
        totalMeetings,
        remoteMeetings,
        presentialMeetings,
        liveMeetings,
        endedMeetings: totalMeetings - liveMeetings,
        totalAttendees,
        avgAttendeesPerMeeting,
        totalQuizzes,
        publishedQuizzes,
        totalAttempts,
        passedAttempts,
        avgScore,
        approvalRate
      },
      levelDistribution: levelCounts,
      monthlyEvolution,
      companyComparison
    });
  } catch (error: any) {
    console.error('[API /api/master/bi GET Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao carregar métricas de BI.' },
      { status: 500 }
    );
  }
}
