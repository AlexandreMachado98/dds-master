import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId')?.trim();
    const meetingId = searchParams.get('meetingId')?.trim();
    const query = searchParams.get('q')?.trim() || '';

    const where: any = {};

    if (meetingId) {
      where.meetingId = meetingId;
    }

    if (companyId) {
      where.meeting = { companyId };
    }

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { cpf: { contains: query } },
        { meeting: { topic: { contains: query, mode: 'insensitive' } } }
      ];
    }

    const [totalCount, attendances] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          meeting: {
            select: {
              id: true,
              topic: true,
              farm: true,
              status: true,
              company: { select: { id: true, name: true } }
            }
          },
          _count: { select: { quizAttempts: true } }
        }
      })
    ]);

    const formatted = attendances.map((a) => {
      // Máscara LGPD para CPF
      const cleanCpf = a.cpf.replace(/\D/g, '');
      const maskedCpf = cleanCpf.length === 11
        ? `${cleanCpf.slice(0, 3)}.***.***-${cleanCpf.slice(9)}`
        : a.cpf;

      return {
        id: a.id,
        name: a.name,
        cpf: maskedCpf,
        hasSelfie: Boolean(a.selfie),
        hasSignature: Boolean(a.signature),
        hasExitSignature: Boolean(a.exitSignature),
        exitReason: a.exitReason,
        leftAt: a.leftAt,
        createdAt: a.createdAt,
        quizAttemptsCount: a._count.quizAttempts,
        meeting: a.meeting ? {
          id: a.meeting.id,
          topic: a.meeting.topic,
          farm: a.meeting.farm,
          status: a.meeting.status,
          companyName: a.meeting.company?.name || 'Não vinculada'
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      totalCount,
      attendances: formatted
    });
  } catch (error: any) {
    console.error('[API /api/master/presencas GET Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao carregar presenças.' },
      { status: 500 }
    );
  }
}
