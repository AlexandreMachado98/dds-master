import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const startTime = Date.now();

  try {
    // 1. Testa conectividade real e calcula latência (Round-Trip Time)
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    // 2. Consulta contagens reais das tabelas operacionais
    const [
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      totalUsers,
      totalMeetings,
      liveMeetings,
      totalAttendances,
      totalQuizzes,
      publishedQuizzes,
      totalAttempts,
      totalAuditLogs
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { status: 'ACTIVE' } }),
      prisma.company.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count(),
      prisma.meeting.count(),
      prisma.meeting.count({ where: { status: 'LIVE' } }),
      prisma.attendance.count(),
      prisma.quiz.count(),
      prisma.quiz.count({ where: { status: 'PUBLISHED' } }),
      prisma.quizAttempt.count(),
      prisma.auditLog.count().catch(() => 0)
    ]);

    // Determina o status da saúde operacional
    let healthStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY';
    if (latencyMs > 1500) {
      healthStatus = 'DEGRADED';
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      status: healthStatus,
      database: {
        provider: 'PostgreSQL (Neon Serverless)',
        connected: true,
        latencyMs,
        pooler: 'PgBouncer Active'
      },
      counts: {
        companies: { total: totalCompanies, active: activeCompanies, suspended: suspendedCompanies },
        users: { total: totalUsers },
        meetings: { total: totalMeetings, live: liveMeetings, ended: totalMeetings - liveMeetings },
        attendances: { total: totalAttendances },
        quizzes: { total: totalQuizzes, published: publishedQuizzes },
        attempts: { total: totalAttempts },
        auditLogs: { total: totalAuditLogs }
      }
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error('[Health Check Error]:', error);

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        status: 'DOWN',
        database: {
          provider: 'PostgreSQL (Neon Serverless)',
          connected: false,
          latencyMs,
          error: error?.message || 'Falha de comunicação com o banco de dados.'
        }
      },
      { status: 503 }
    );
  }
}
