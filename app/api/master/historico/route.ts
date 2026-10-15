import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureAuditLogTable } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    await ensureAuditLogTable();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action')?.trim();
    const query = searchParams.get('q')?.trim() || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 1. Busca logs de auditoria administrativa gravados na tabela AuditLog
    const auditWhere: any = {};
    if (action && action !== 'ALL') {
      auditWhere.action = action;
    }
    if (query) {
      auditWhere.OR = [
        { action: { contains: query, mode: 'insensitive' } },
        { previousValue: { contains: query, mode: 'insensitive' } },
        { newValue: { contains: query, mode: 'insensitive' } },
        { adminName: { contains: query, mode: 'insensitive' } }
      ];
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: auditWhere,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    // 2. Busca eventos operacionais persistidos no banco de dados para timeline unificada
    const [recentCompanies, recentUsers, recentMeetings, recentQuizzes] = await Promise.all([
      prisma.company.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, createdAt: true, status: true }
      }),
      prisma.user.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, company: true, status: true, createdAt: true }
      }),
      prisma.meeting.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          topic: true,
          farm: true,
          status: true,
          createdAt: true,
          company: { select: { name: true } },
          organizer: { select: { name: true } }
        }
      }),
      prisma.quiz.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          publishedAt: true,
          closedAt: true,
          meeting: { select: { topic: true, company: { select: { name: true } } } },
          creator: { select: { name: true } }
        }
      })
    ]);

    // Converte os eventos operacionais em formato uniforme de timeline
    const timelineItems: Array<{
      id: string;
      type: 'AUDIT' | 'COMPANY' | 'USER' | 'MEETING' | 'QUIZ';
      action: string;
      title: string;
      description: string;
      actor: string;
      createdAt: Date;
      metadata?: any;
    }> = [];

    // Adiciona logs de auditoria
    auditLogs.forEach((log) => {
      timelineItems.push({
        id: log.id,
        type: 'AUDIT',
        action: log.action,
        title: `Alteração Administrativa: ${log.action}`,
        description: log.newValue 
          ? `De "${log.previousValue || 'N/A'}" para "${log.newValue}"` 
          : (log.details || 'Ação registrada na trilha de auditoria'),
        actor: log.adminName || 'SuperAdmin',
        createdAt: log.createdAt,
        metadata: {
          entityType: log.entityType,
          entityId: log.entityId,
          ipAddress: log.ipAddress
        }
      });
    });

    // Adiciona eventos de empresas
    recentCompanies.forEach((c) => {
      timelineItems.push({
        id: `comp-${c.id}`,
        type: 'COMPANY',
        action: 'COMPANY_CREATED',
        title: `Empresa Cadastrada: ${c.name}`,
        description: `Status inicial: ${c.status}`,
        actor: 'SuperAdmin',
        createdAt: c.createdAt
      });
    });

    // Adiciona eventos de usuários
    recentUsers.forEach((u) => {
      timelineItems.push({
        id: `user-${u.id}`,
        type: 'USER',
        action: 'USER_REGISTERED',
        title: `Novo Usuário: ${u.name}`,
        description: `${u.email} • Empresa informada: ${u.company || 'Não vinculada'} (${u.status})`,
        actor: u.name,
        createdAt: u.createdAt
      });
    });

    // Adiciona eventos de DDS
    recentMeetings.forEach((m) => {
      timelineItems.push({
        id: `meet-${m.id}`,
        type: 'MEETING',
        action: 'MEETING_CREATED',
        title: `DDS Criado: ${m.topic}`,
        description: `Local: ${m.farm} • Empresa: ${m.company?.name || 'N/A'} • Status: ${m.status}`,
        actor: m.organizer?.name || 'Técnico',
        createdAt: m.createdAt
      });
    });

    // Adiciona eventos de Questionários
    recentQuizzes.forEach((q) => {
      timelineItems.push({
        id: `quiz-${q.id}`,
        type: 'QUIZ',
        action: 'QUIZ_CREATED',
        title: `Questionário Criado: ${q.title}`,
        description: `DDS: ${q.meeting?.topic || 'Autônomo'} • Status: ${q.status}`,
        actor: q.creator?.name || 'Instrutor',
        createdAt: q.createdAt
      });
    });

    // Ordena toda a timeline de forma decrescente
    timelineItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      count: timelineItems.length,
      auditLogsCount: auditLogs.length,
      timeline: timelineItems.slice(0, limit)
    });
  } catch (error: any) {
    console.error('[API /api/master/historico GET Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao carregar histórico.' },
      { status: 500 }
    );
  }
}
