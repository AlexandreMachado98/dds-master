import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createHash } from 'crypto';
import { recordAuditLog } from '@/lib/audit';

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
      quizzesCount: m._count.quizzes
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

// -----------------------------------------------------------------------------
// PATCH: Encerramento administrativo de DDS esquecido em andamento
// Replica o encerramento do DDS Online (app/api/reuniao, action end_meeting):
// mesmo lock das assinaturas, mesmo cálculo do documentHash e mesmos campos.
// -----------------------------------------------------------------------------
export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const meetingId = typeof body?.meetingId === 'string' ? body.meetingId.trim() : '';
    const action = body?.action;

    if (!meetingId || action !== 'end_meeting') {
      return NextResponse.json(
        { success: false, error: 'Informe o DDS (meetingId) e a ação end_meeting.' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT 1 AS lock_acquired FROM pg_advisory_xact_lock(hashtext($1))', meetingId);

      const current = await tx.meeting.findUnique({
        where: { id: meetingId },
        select: {
          id: true,
          status: true,
          topic: true,
          createdAt: true,
          endedAt: true,
          companyId: true,
          organizer: { select: { name: true } },
          attendees: { select: { id: true, name: true, cpf: true }, orderBy: { createdAt: 'asc' } },
          attachments: { select: { id: true, fileName: true }, orderBy: { order: 'asc' } }
        }
      });

      if (!current) return { notFound: true as const };
      if (current.status === 'ENDED') return { alreadyEnded: true as const, meeting: current };

      const endedAt = new Date();
      const digest = [
        meetingId,
        current.topic || '',
        current.createdAt?.toISOString() || '',
        endedAt.toISOString(),
        current.attendees.map((a) => [a.id, a.name, a.cpf].join(':')).join(';'),
        current.attachments.map((att) => [att.id, att.fileName].join(':')).join(';')
      ].join('|');
      const documentHash = createHash('sha256').update(digest).digest('hex');

      const updated = await tx.meeting.update({
        where: { id: meetingId },
        data: { status: 'ENDED', endedAt, attendanceCollectionOpen: false, documentHash },
        select: { id: true, status: true, endedAt: true }
      });

      return { ended: true as const, meeting: current, updated };
    });

    if ('notFound' in result) {
      return NextResponse.json({ success: false, error: 'DDS não encontrado.' }, { status: 404 });
    }

    if ('alreadyEnded' in result) {
      return NextResponse.json({
        success: true,
        meeting: { id: result.meeting.id, status: 'ENDED', endedAt: result.meeting.endedAt },
        message: 'Este DDS já estava encerrado.'
      });
    }

    await recordAuditLog({
      action: 'MEETING_FORCE_ENDED_BY_MASTER',
      entityType: 'Meeting',
      entityId: meetingId,
      adminName: 'DDS Master',
      companyId: result.meeting.companyId,
      previousValue: 'LIVE',
      newValue: 'ENDED',
      details: JSON.stringify({
        topic: result.meeting.topic,
        organizer: result.meeting.organizer?.name || null,
        openedAt: result.meeting.createdAt,
        attendees: result.meeting.attendees.length
      }),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: req.headers.get('user-agent') || null
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      meeting: result.updated,
      message: 'DDS encerrado pelo Master. A ata permanece disponível no histórico.'
    });
  } catch (error: any) {
    console.error('[API /api/master/dds PATCH Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao encerrar o DDS.' },
      { status: 500 }
    );
  }
}
