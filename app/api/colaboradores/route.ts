import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Validador estrito de nome
export function validateAndSanitizeName(name: any): { valid: boolean; sanitized: string; error?: string } {
  if (typeof name !== 'string') {
    return { valid: false, sanitized: '', error: 'O nome deve ser um texto válido.' };
  }

  // 1. Trim e colapso de espaços múltiplos
  const sanitized = name.trim().replace(/\s+/g, ' ');

  // 2. Comprimento entre 2 e 100 caracteres
  if (sanitized.length < 2) {
    return { valid: false, sanitized, error: 'O nome deve conter pelo menos 2 caracteres.' };
  }
  if (sanitized.length > 100) {
    return { valid: false, sanitized, error: 'O nome não pode exceder 100 caracteres.' };
  }

  // 3. Regex que aceita letras latinas completas (acentos pt-BR), apóstrofos (D'Ávila), hífens e espaços
  const validNameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'´`-]+$/;
  if (!validNameRegex.test(sanitized)) {
    return {
      valid: false,
      sanitized,
      error: 'O nome contém caracteres inválidos. Utilize apenas letras, espaços, apóstrofos e hífens.'
    };
  }

  return { valid: true, sanitized };
}

// -----------------------------------------------------------------------------
// GET: Listar Colaboradores com busca e contagem de presenças
// -----------------------------------------------------------------------------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || '';
    const companyId = searchParams.get('companyId')?.trim();

    // Filtro para usuários
    const userWhere: any = {};
    if (companyId) {
      userWhere.companyId = companyId;
    }
    if (query) {
      userWhere.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { position: { contains: query, mode: 'insensitive' } }
      ];
    }

    const registeredUsers = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        position: true,
        company: true,
        companyId: true,
        createdAt: true,
        companyRel: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            meetings: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const collaborators = registeredUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      position: u.position || 'Colaborador',
      companyId: u.companyId,
      companyName: u.companyRel?.name || u.company || 'Não vinculada',
      meetingsCount: u._count?.meetings || 0,
      createdAt: u.createdAt,
      source: 'USER_TABLE'
    }));

    return NextResponse.json({
      success: true,
      count: collaborators.length,
      collaborators
    });
  } catch (error: any) {
    console.error('[API /api/colaboradores GET Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar colaboradores.' },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// PUT: Atualizar/Corrigir Nome do Colaborador com Sincronização e Auditoria
// -----------------------------------------------------------------------------
export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, name, adminId, adminName, companyId } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID do colaborador é obrigatório.' },
        { status: 400 }
      );
    }

    // 1. Validação estrita do novo nome
    const { valid, sanitized: cleanName, error: validationError } = validateAndSanitizeName(name);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    // 2. Busca do usuário alvo
    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: {
        companyRel: true
      }
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Colaborador não encontrado.' },
        { status: 404 }
      );
    }

    // 3. Validação de isolamento de empresa (multi-tenant)
    if (companyId && targetUser.companyId && targetUser.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado a alterar colaboradores de outra empresa.' },
        { status: 403 }
      );
    }

    const previousName = targetUser.name;

    // Se o nome não mudou, retorna sucesso idempotente
    if (previousName === cleanName) {
      return NextResponse.json({
        success: true,
        message: 'O nome informado já é o nome atual do colaborador.',
        user: targetUser
      });
    }

    // 4. Atualiza o nome na tabela User (Single Source of Truth)
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: cleanName
      },
      include: {
        companyRel: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // 5. Sincronização com presenças ativas (Meeting status = 'LIVE')
    // Apenas reuniões ativas têm o nome atualizado; histórico encerrado permanece imutável
    try {
      await prisma.attendance.updateMany({
        where: {
          name: previousName,
          meeting: {
            status: 'LIVE'
          }
        },
        data: {
          name: cleanName
        }
      });
    } catch (syncErr) {
      console.warn('Aviso na sincronização de presenças ativas:', syncErr);
    }

    // 6. Registro na Trilha de Auditoria (AuditLog)
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'DDS_MASTER';

    await recordAuditLog({
      action: 'UPDATE_COLLABORATOR_NAME',
      entityType: 'User',
      entityId: id,
      adminId: adminId || 'MASTER_ADMIN',
      adminName: adminName || 'Administrador Master',
      companyId: targetUser.companyId || companyId || null,
      previousValue: previousName,
      newValue: cleanName,
      details: JSON.stringify({
        email: targetUser.email,
        company: targetUser.company || targetUser.companyRel?.name || null,
        reason: 'Correção cadastral de colaborador'
      }),
      ipAddress,
      userAgent
    });

    return NextResponse.json({
      success: true,
      message: `Nome do colaborador corrigido com sucesso para "${cleanName}".`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        position: updatedUser.position,
        company: updatedUser.company,
        companyId: updatedUser.companyId
      }
    });
  } catch (error: any) {
    console.error('[API /api/colaboradores PUT Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao atualizar nome do colaborador.' },
      { status: 500 }
    );
  }
}
