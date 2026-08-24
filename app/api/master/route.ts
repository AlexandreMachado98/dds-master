 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    const totalCompanies = await prisma.company.count();
    const totalMeetings = await prisma.meeting.count();
    const totalAttendees = await prisma.attendance.count();
    const pendingApprovals = await prisma.user.count({
      where: { status: 'PENDING_APPROVAL' }
    });

    const companies = await prisma.company.findMany({
      include: {
        _count: { select: { meetings: true, users: true } },
        meetings: { select: { _count: { select: { attendees: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedCompanies = companies.map((c) => ({
      id: c.id,
      name: c.name,
      document: c.document,
      status: c.status,
      secretKey: c.secretKey,
      totalMeetings: c._count.meetings,
      totalUsers: c._count.users,
      totalAttendees: c.meetings.reduce((acc, m) => acc + m._count.attendees, 0)
    }));

    const pendingUsers = await prisma.user.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: { companyRel: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const allMeetings = await prisma.meeting.findMany({
      select: { topic: true }
    });
    const topicCounts: Record<string, number> = {};
    allMeetings.forEach((m) => {
      topicCounts[m.topic] = (topicCounts[m.topic] || 0) + 1;
    });
    const topTopics = Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      metrics: { totalCompanies, totalMeetings, totalAttendees, pendingApprovals },
      companies: formattedCompanies,
      pendingUsers,
      topTopics
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, document, secretKey } = body;

    if (!name || !secretKey) {
      return NextResponse.json({ success: false, error: 'Nome e Palavra-Chave são obrigatórios.' }, { status: 400 });
    }

    const company = await prisma.company.create({
      data: {
        name: String(name).trim(),
        document: document ? String(document).trim() : null,
        secretKey: String(secretKey).trim().toUpperCase(),
        status: 'ACTIVE'
      }
    });

    return NextResponse.json({ success: true, company });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { action, companyId, newStatus, userId } = body;

    if (action === 'update_company_status') {
      const updated = await prisma.company.update({
        where: { id: companyId },
        data: { status: newStatus }
      });
      return NextResponse.json({ success: true, company: updated });
    }

    if (action === 'update_user_status') {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { status: newStatus }
      });
      return NextResponse.json({ success: true, user: updated });
    }

    // =========================================================================
    // EXCLUSÃO SEGURA DE USUÁRIO VIA PATCH ACTION
    // =========================================================================
    if (action === 'delete_user') {
      // 1. Desvincula reuniões para não quebrar a chave estrangeira
      await prisma.meeting.updateMany({
        where: { organizerId: userId },
        data: { organizerId: null }
      });

      // 2. Deleta o usuário definitivamente
      await prisma.user.delete({
        where: { id: userId }
      });

      return NextResponse.json({ success: true, message: 'Usuário excluído com sucesso.' });
    }

    return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

// Endpoint DELETE direto
export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'ID do usuário não informado.' }, { status: 400 });
    }

    // 1. Desvincula reuniões
    await prisma.meeting.updateMany({
      where: { organizerId: userId },
      data: { organizerId: null }
    });

    // 2. Deleta o usuário
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ success: true, message: 'Usuário excluído com sucesso.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}