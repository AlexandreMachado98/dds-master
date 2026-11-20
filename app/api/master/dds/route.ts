import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { closeMeeting, weeklyMeetingIds } from '@/lib/meetingClose';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId')?.trim();
    const status = searchParams.get('status')?.trim(); // LIVE, ENDED
    const type = searchParams.get('type')?.trim(); // REMOTE, PRESENTIAL
    const query = searchParams.get('q')?.trim() || '';

    const where: any = {};

    if (companyId) {
      where.companyId = companyId;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (type && type !== 'ALL') {
      where.type = type;
    }

    if (query) {
      where.OR = [
        { topic: { contains: query, mode: 'insensitive' } },
        { farm: { contains: query, mode: 'insensitive' } },
        { organizer: { name: { contains: query, mode: 'insensitive' } } },
        { company: { name: { contains: query, mode: 'insensitive' } } }
      ];
    }

    const [totalCount, meetings] = await Promise.all([
      prisma.meeting.count({ where }),
      prisma.meeting.findMany({
        where,
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, document: true } },
          organizer: { select: { id: true, name: true, email: true, position: true } },
          _count: {
            select: {
              attendees: true,
              attachments: true,
              quizzes: true
            }
          }
        }
      })
    ]);

    // DDS Semanal ao vivo não pode ser encerrado pelo Master (fecha sozinho no fim do tema).
    const weekly = await weeklyMeetingIds(meetings.filter((m) => m.status === 'LIVE').map((m) => m.id))
      .catch(() => new Set<string>());

    const formattedMeetings = meetings.map((m) => ({
      id: m.id,
      topic: m.topic,
      farm: m.farm,
      status: m.status,
      type: m.type || 'PRESENTIAL',
      objective: m.objective,
      classification: m.classification || 'DDS',
      instructorName: m.instructorName || m.organizer?.name || 'Não informado',
      createdAt: m.createdAt,
      endedAt: m.endedAt,
      company: m.company ? { id: m.company.id, name: m.company.name } : null,
      organizer: m.organizer ? { id: m.organizer.id, name: m.organizer.name, email: m.organizer.email } : null,
      attendeesCount: m._count.attendees,
      attachmentsCount: m._count.attachments,
      quizzesCount: m._count.quizzes,
      isWeekly: weekly.has(m.id)
    }));

    return NextResponse.json({
      success: true,
      totalCount,
      meetings: formattedMeetings
    });
  } catch (error: any) {
    console.error('[API /api/master/dds GET Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao carregar treinamentos e DDSs.' },
      { status: 500 }
    );
  }
}

// POST { action: 'end', meetingIds: string[] }: encerra DDS que ficaram abertos à toa.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.meetingIds)
      ? Array.from(new Set(body.meetingIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64)))
      : [];
    if (body.action !== 'end' || ids.length === 0 || ids.length > 100) {
      return NextResponse.json({ success: false, error: 'Informe de 1 a 100 DDS para encerrar.' }, { status: 400 });
    }

    const results = [];
    for (const id of ids) {
      try {
        results.push(await closeMeeting(id));
      } catch (error) {
        console.error('[API /api/master/dds POST] falha ao encerrar', id, error);
        results.push({ id, ok: false as const, error: 'Falha ao encerrar.' });
      }
    }
    const closed = results.filter((r) => r.ok && !r.alreadyEnded).length;
    const failed = results.filter((r) => !r.ok);
    console.info(`[ADMIN_AUDIT] [${new Date().toISOString()}] ACTION=MEETINGS_ENDED_BY_MASTER DETAILS=${JSON.stringify({ requested: ids.length, closed, failed: failed.map((f) => f.id) })}`);

    return NextResponse.json({
      success: failed.length === 0,
      closed,
      results,
      message: failed.length === 0
        ? (closed === 1 ? '1 DDS encerrado. A ata fica disponível no histórico da empresa.' : `${closed} DDS encerrados. As atas ficam disponíveis no histórico das empresas.`)
        : `${closed} encerrado(s); ${failed.length} não: ${failed.map((f) => ('error' in f ? f.error : '')).filter(Boolean)[0] || 'tente de novo.'}`
    }, { status: failed.length === ids.length ? 409 : 200 });
  } catch (error) {
    console.error('[API /api/master/dds POST Error]:', error);
    return NextResponse.json({ success: false, error: 'Erro ao encerrar os DDS.' }, { status: 500 });
  }
}
