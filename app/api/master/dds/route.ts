import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
