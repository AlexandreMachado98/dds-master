import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Tipos de Status permitidos
type UserStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'BLOCKED';
type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'PENDING_APPROVAL';

// Helper de log estruturado de auditoria administrativa
function logAdminAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.info(`[ADMIN_AUDIT] [${timestamp}] ACTION=${action} DETAILS=${JSON.stringify(details)}`);
}

// -----------------------------------------------------------------------------
// GET: Painel Master (Métricas, Empresas, Fila de Pendentes, Usuários sem Empresa)
// -----------------------------------------------------------------------------
export async function GET(req: Request) {
  try {
    const [
      totalCompanies,
      totalMeetings,
      totalAttendees,
      pendingApprovals,
      companies,
      pendingUsers,
      unlinkedUsers,
      recentMeetings
    ] = await Promise.all([
      prisma.company.count(),
      prisma.meeting.count(),
      prisma.attendance.count(),
      prisma.user.count({
        where: { status: 'PENDING_APPROVAL' }
      }),
      prisma.company.findMany({
        include: {
          _count: { select: { meetings: true, users: true } },
          meetings: { select: { _count: { select: { attendees: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.findMany({
        where: { status: 'PENDING_APPROVAL' },
        include: { companyRel: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.findMany({
        where: {
          companyId: null,
          role: { not: 'SUPER_ADMIN' }
        },
        include: {
          _count: { select: { meetings: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.meeting.findMany({
        select: { topic: true },
        take: 300,
        orderBy: { createdAt: 'desc' }
      })
    ]);

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

    const topicCounts: Record<string, number> = {};
    recentMeetings.forEach((m) => {
      const topic = (m.topic || 'Outros').trim();
      if (topic) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    });

    const topTopics = Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      metrics: {
        totalCompanies,
        totalMeetings,
        totalAttendees,
        pendingApprovals
      },
      companies: formattedCompanies,
      pendingUsers,
      unlinkedUsers,
      topTopics
    });
  } catch (error: any) {
    console.error('[API /api/master GET Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Erro ao carregar dados do painel administrativo.'
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// POST: Cadastro de Empresa com Palavra-Chave Mágica
// -----------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, document, secretKey } = body;

    const cleanName = String(name || '').trim();
    const cleanDoc = document ? String(document).trim() : null;
    const cleanKey = String(secretKey || '').trim().toUpperCase();

    if (!cleanName) {
      return NextResponse.json(
        { success: false, error: 'O nome da empresa ou fazenda é obrigatório.' },
        { status: 400 }
      );
    }

    if (!cleanKey) {
      return NextResponse.json(
        { success: false, error: 'A palavra-chave mágica de cadastro é obrigatória.' },
        { status: 400 }
      );
    }

    // Verifica se já existe empresa com esta palavra-chave
    const existingKey = await prisma.company.findFirst({
      where: { secretKey: cleanKey }
    });

    if (existingKey) {
      return NextResponse.json(
        { success: false, error: `A palavra-chave "${cleanKey}" já está em uso pela empresa "${existingKey.name}". Escolha outra.` },
        { status: 409 }
      );
    }

    const company = await prisma.company.create({
      data: {
        name: cleanName,
        document: cleanDoc,
        secretKey: cleanKey,
        status: 'ACTIVE',
        autoApproveWithKey: true
      }
    });

    logAdminAudit('COMPANY_CREATED', {
      companyId: company.id,
      name: company.name,
      secretKey: company.secretKey
    });

    return NextResponse.json({
      success: true,
      message: 'Empresa cadastrada e chave mágica ativada com sucesso.',
      company
    });
  } catch (error: any) {
    console.error('[API /api/master POST Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao criar empresa.' },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// PATCH: Ações Administrativas (Aprovação, Bloqueio, Vínculo de Empresa, Status)
// -----------------------------------------------------------------------------
export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, companyId, newStatus, userId, targetCompanyId } = body;

    // 1. ALTERAR STATUS DE EMPRESA (KILL-SWITCH)
    if (action === 'update_company_status') {
      if (!companyId || !newStatus) {
        return NextResponse.json(
          { success: false, error: 'ID da empresa e novo status são obrigatórios.' },
          { status: 400 }
        );
      }

      const existingCompany = await prisma.company.findUnique({
        where: { id: companyId }
      });

      if (!existingCompany) {
        return NextResponse.json(
          { success: false, error: 'Empresa não encontrada no banco de dados.' },
          { status: 404 }
        );
      }

      const updated = await prisma.company.update({
        where: { id: companyId },
        data: { status: newStatus as CompanyStatus }
      });

      logAdminAudit('COMPANY_STATUS_UPDATED', {
        companyId,
        companyName: updated.name,
        previousStatus: existingCompany.status,
        newStatus: updated.status
      });

      return NextResponse.json({
        success: true,
        message: `Status da empresa alterado para ${updated.status}.`,
        company: updated
      });
    }

    // 2. ATUALIZAR STATUS DE USUÁRIO (LIBERAR ACESSO / RECUSAR / BLOQUEAR)
    if (action === 'update_user_status' || action === 'approve_user' || action === 'block_user') {
      const resolvedStatus = (
        action === 'approve_user' ? 'ACTIVE' :
        action === 'block_user' ? 'BLOCKED' :
        newStatus
      ) as UserStatus;

      if (!userId || !resolvedStatus) {
        return NextResponse.json(
          { success: false, error: 'ID do usuário e status são obrigatórios.' },
          { status: 400 }
        );
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { companyRel: true }
      });

      if (!targetUser) {
        return NextResponse.json(
          { success: false, error: 'Usuário não encontrado no banco de dados.' },
          { status: 404 }
        );
      }

      // Se o usuário já estiver no status desejado, retorna sucesso de forma idempotente
      if (targetUser.status === resolvedStatus && !targetCompanyId) {
        return NextResponse.json({
          success: true,
          message: `Usuário já se encontra com status ${resolvedStatus}.`,
          user: targetUser
        });
      }

      // Se foi fornecido targetCompanyId ou se for aprovação e podemos vincular
      let updateData: Record<string, any> = { status: resolvedStatus };

      if (targetCompanyId) {
        const comp = await prisma.company.findUnique({ where: { id: targetCompanyId } });
        if (comp) {
          updateData.companyId = comp.id;
          updateData.company = comp.name;
        }
      } else if (resolvedStatus === 'ACTIVE' && !targetUser.companyId && targetUser.company) {
        // Tenta auto-vincular se o nome coincidir perfeitamente com uma empresa existente
        const matchingCompany = await prisma.company.findFirst({
          where: { name: { equals: targetUser.company, mode: 'insensitive' } }
        });
        if (matchingCompany) {
          updateData.companyId = matchingCompany.id;
          updateData.company = matchingCompany.name;
        }
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: { companyRel: { select: { id: true, name: true } } }
      });

      logAdminAudit('USER_STATUS_UPDATED', {
        userId,
        userEmail: updated.email,
        userName: updated.name,
        previousStatus: targetUser.status,
        newStatus: updated.status,
        company: updated.company,
        companyId: updated.companyId
      });

      return NextResponse.json({
        success: true,
        message: resolvedStatus === 'ACTIVE'
          ? 'Acesso liberado com sucesso. O técnico já pode acessar o sistema.'
          : 'Status do usuário atualizado.',
        user: updated
      });
    }

    // 3. VINCULAR USUÁRIO À EMPRESA OFICIAL
    if (action === 'link_user_company') {
      if (!userId || !targetCompanyId) {
        return NextResponse.json(
          { success: false, error: 'ID do usuário e ID da empresa destino são obrigatórios.' },
          { status: 400 }
        );
      }

      const targetCompany = await prisma.company.findUnique({
        where: { id: targetCompanyId }
      });

      if (!targetCompany) {
        return NextResponse.json(
          { success: false, error: 'Empresa selecionada não foi encontrada.' },
          { status: 404 }
        );
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!targetUser) {
        return NextResponse.json(
          { success: false, error: 'Usuário não encontrado.' },
          { status: 404 }
        );
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          companyId: targetCompany.id,
          company: targetCompany.name,
          status: 'ACTIVE'
        },
        include: { companyRel: { select: { id: true, name: true } } }
      });

      logAdminAudit('USER_LINKED_COMPANY', {
        userId,
        userName: updated.name,
        userEmail: updated.email,
        previousCompany: targetUser.company,
        newCompanyId: targetCompany.id,
        newCompanyName: targetCompany.name,
        status: updated.status
      });

      return NextResponse.json({
        success: true,
        message: `Técnico vinculado à empresa "${targetCompany.name}" e liberado com sucesso.`,
        user: updated
      });
    }

    // 4. EXCLUSÃO TOTAL EM CASCATA VIA PATCH
    if (action === 'delete_user') {
      if (!userId) {
        return NextResponse.json(
          { success: false, error: 'ID do usuário não informado.' },
          { status: 400 }
        );
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true }
      });

      if (!targetUser) {
        return NextResponse.json(
          { success: true, message: 'Usuário já excluído ou inexistente.' }
        );
      }

      await prisma.$transaction(async (tx) => {
        const userMeetings = await tx.meeting.findMany({
          where: { organizerId: userId },
          select: { id: true }
        });
        const meetingIds = userMeetings.map((m) => m.id);

        if (meetingIds.length > 0) {
          await tx.attendance.deleteMany({
            where: { meetingId: { in: meetingIds } }
          });
          await tx.meeting.deleteMany({
            where: { id: { in: meetingIds } }
          });
        }

        await tx.user.delete({
          where: { id: userId }
        });
      });

      logAdminAudit('USER_DELETED', {
        userId: targetUser.id,
        userName: targetUser.name,
        userEmail: targetUser.email
      });

      return NextResponse.json({
        success: true,
        message: 'Usuário e todos os seus registros foram excluídos definitivamente.'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Ação administrativa não reconhecida.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API /api/master PATCH Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao processar alteração.' },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// DELETE: Exclusão Definitiva de Usuário em Cascata Transacional
// -----------------------------------------------------------------------------
export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID do usuário não informado.' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: true, message: 'Usuário já não existe no banco de dados.' }
      );
    }

    await prisma.$transaction(async (tx) => {
      const userMeetings = await tx.meeting.findMany({
        where: { organizerId: userId },
        select: { id: true }
      });
      const meetingIds = userMeetings.map((m) => m.id);

      if (meetingIds.length > 0) {
        await tx.attendance.deleteMany({
          where: { meetingId: { in: meetingIds } }
        });
        await tx.meeting.deleteMany({
          where: { id: { in: meetingIds } }
        });
      }

      await tx.user.delete({
        where: { id: userId }
      });
    });

    logAdminAudit('USER_DELETED', {
      userId: targetUser.id,
      userName: targetUser.name,
      userEmail: targetUser.email
    });

    return NextResponse.json({
      success: true,
      message: 'Usuário e todos os seus dados foram excluídos definitivamente.'
    });
  } catch (error: any) {
    console.error('[API /api/master DELETE Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao excluir usuário.' },
      { status: 500 }
    );
  }
}