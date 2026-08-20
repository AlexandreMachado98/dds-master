 import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

// 1. GET: Retorna Métricas de BI, Rankings e Usuários Pendentes
export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      include: {
        users: true,
        meetings: {
          include: { attendees: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const allMeetings = await prisma.meeting.findMany({
      include: { attendees: true },
      orderBy: { createdAt: 'desc' }
    });

    const pendingUsers = await prisma.user.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' }
    });

    const totalAttendees = allMeetings.reduce(
      (acc, m) => acc + (m.attendees?.length || 0),
      0
    );

    // Contagem dos temas mais falados
    const topicMap: Record<string, number> = {};
    allMeetings.forEach((m) => {
      const t = String(m.topic || '').trim();
      if (t) {
        topicMap[t] = (topicMap[t] || 0) + 1;
      }
    });

    const topTopics = Object.entries(topicMap)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const companyRanking = companies
      .map((c) => ({
        id: c.id,
        name: c.name,
        document: c.document,
        status: c.status,
        secretKey: c.secretKey,
        totalMeetings: c.meetings?.length || 0,
        totalUsers: c.users?.length || 0,
        totalAttendees: (c.meetings || []).reduce(
          (acc, m) => acc + (m.attendees?.length || 0),
          0
        )
      }))
      .sort((a, b) => b.totalMeetings - a.totalMeetings);

    return NextResponse.json({
      success: true,
      metrics: {
        totalCompanies: companies.length,
        totalMeetings: allMeetings.length,
        totalAttendees,
        pendingApprovals: pendingUsers.length
      },
      topTopics,
      companies: companyRanking,
      pendingUsers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro no servidor';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// 2. POST: Cadastra nova empresa
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, document, secretKey } = body;

    if (!name || !secretKey) {
      return NextResponse.json(
        { success: false, error: 'Nome e Palavra-chave são obrigatórios' },
        { status: 400 }
      );
    }

    const newCompany = await prisma.company.create({
      data: {
        name: String(name).trim(),
        document: document ? String(document).trim() : null,
        secretKey: String(secretKey).trim().toUpperCase(),
        status: 'ACTIVE',
        autoApproveWithKey: true
      }
    });

    return NextResponse.json({ success: true, company: newCompany });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao cadastrar';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// 3. PATCH: Ações de Bloqueio e Aprovação
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { action, companyId, userId, newStatus, newSecretKey } = body;

    if (action === 'update_company_status') {
      const updated = await prisma.company.update({
        where: { id: companyId },
        data: { status: newStatus }
      });
      return NextResponse.json({ success: true, company: updated });
    }

    if (action === 'update_secret_key') {
      const updated = await prisma.company.update({
        where: { id: companyId },
        data: { secretKey: String(newSecretKey).trim().toUpperCase() }
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

    return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao processar';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}