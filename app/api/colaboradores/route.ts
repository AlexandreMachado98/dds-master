// app/api/colaboradores/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthenticatedUser, logSecurityEvent } from '@/lib/auth';
import { recordAuditLog, ensureAuditLogTable } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Normaliza e valida o nome do colaborador
 * - Remove múltiplos espaços internos
 * - Remove espaços no início e no fim
 * - Permite acentos, apóstrofos (ex: D'Ávila), hífens e nomes compostos
 */
function sanitizeAndValidateName(rawName: unknown): { isValid: boolean; cleanName: string; error?: string } {
  if (typeof rawName !== 'string') {
    return { isValid: false, cleanName: '', error: 'O nome do colaborador deve ser um texto válido.' };
  }

  // Remove espaços duplicados e espaços nas extremidades
  const cleanName = rawName.replace(/\s+/g, ' ').trim();

  if (!cleanName || cleanName.length < 2) {
    return { isValid: false, cleanName, error: 'O nome deve conter no mínimo 2 caracteres.' };
  }

  if (cleanName.length > 100) {
    return { isValid: false, cleanName, error: 'O nome não pode exceder 100 caracteres.' };
  }

  // Validação de caracteres: Permite letras latinas (com todos os acentos), apóstrofo, hífen e espaços
  // Regex Unicode para letras: \p{L}, espaços, hífen e apóstrofo
  const validNameRegex = /^[\p{L}\p{M}'\-\s.]+$/u;
  if (!validNameRegex.test(cleanName)) {
    return { isValid: false, cleanName, error: 'O nome contém caracteres inválidos. Utilize apenas letras, acentos, hífen ou apóstrofo.' };
  }

  return { isValid: true, cleanName };
}

// 1. GET: Lista todos os colaboradores pertencentes à empresa do usuário logado
export async function GET(req: Request) {
  try {
    await ensureAuditLogTable();

    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', { path: 'GET /api/colaboradores', reason: 'NO_SESSION' });
      return NextResponse.json({ success: false, error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const searchQuery = (searchParams.get('search') || '').trim().toLowerCase();
    const companyIdParam = searchParams.get('companyId');

    // Regra de Isolamento de Empresa
    const isSuperAdmin = sessionUser.role === 'SUPER_ADMIN';
    const targetCompanyId = isSuperAdmin && companyIdParam ? companyIdParam : sessionUser.companyId;
    const targetCompanyName = sessionUser.company;

    // 1. Busca os colaboradores cadastrados na tabela User (Fonte de Verdade Principal)
    const users = await prisma.user.findMany({
      where: {
        ...(targetCompanyId
          ? { companyId: targetCompanyId }
          : targetCompanyName
          ? { company: { equals: targetCompanyName, mode: 'insensitive' } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        position: true,
        company: true,
        companyId: true,
        photoURL: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    // 2. Busca reuniões da empresa para calcular estatísticas de presenças
    const companyMeetings = await prisma.meeting.findMany({
      where: {
        ...(targetCompanyId
          ? { companyId: targetCompanyId }
          : targetCompanyName
          ? { company: { name: { equals: targetCompanyName, mode: 'insensitive' } } }
          : { organizerId: sessionUser.id })
      },
      select: {
        id: true,
        status: true,
        attendees: {
          select: {
            id: true,
            name: true,
            cpf: true,
            createdAt: true,
            selfie: true,
            signature: true
          }
        }
      }
    });

    // Mapeamento de estatísticas de presenças por colaborador (usando Nome normalizado)
    const attendancesMap = new Map<string, { count: number; lastActive: Date | null; photo: string | null; sampleCpf: string; sampleId: string }>();

    for (const m of companyMeetings) {
      for (const a of m.attendees) {
        const normName = a.name.trim().toLowerCase();
        const current = attendancesMap.get(normName) || { 
          count: 0, 
          lastActive: null, 
          photo: null, 
          sampleCpf: a.cpf || '',
          sampleId: a.id 
        };
        current.count += 1;
        if (!current.lastActive || new Date(a.createdAt) > new Date(current.lastActive)) {
          current.lastActive = new Date(a.createdAt);
        }
        if (!current.photo && a.selfie) {
          current.photo = a.selfie;
        }
        attendancesMap.set(normName, current);
      }
    }

    const registeredNamesSet = new Set(users.map(u => u.name.trim().toLowerCase()));

    // Lista consolidada de colaboradores registrados
    let collaboratorsList = users.map(u => {
      const stats = attendancesMap.get(u.name.trim().toLowerCase()) || { count: 0, lastActive: null, photo: null, sampleCpf: '', sampleId: '' };
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        position: u.position || stats.sampleCpf || 'Colaborador',
        company: u.company || targetCompanyName || '',
        companyId: u.companyId || targetCompanyId || '',
        photoURL: u.photoURL || stats.photo || null,
        totalPresencas: stats.count,
        lastActive: stats.lastActive || u.createdAt,
        isRegisteredUser: true
      };
    });

    // Adiciona participantes que registraram presença em DDS mas ainda não possuem conta de usuário
    for (const [normName, stats] of attendancesMap.entries()) {
      if (!registeredNamesSet.has(normName)) {
        // Encontra o nome original formatado
        let originalName = normName;
        for (const m of companyMeetings) {
          const match = m.attendees.find(a => a.name.trim().toLowerCase() === normName);
          if (match) {
            originalName = match.name.trim();
            break;
          }
        }

        collaboratorsList.push({
          id: `att_${stats.sampleId}`,
          name: originalName,
          email: `${originalName.toLowerCase().replace(/[^a-z0-9]/g, '')}@colaborador.dds`,
          role: 'COLLABORATOR' as any,
          status: 'ACTIVE' as any,
          position: stats.sampleCpf || 'Colaborador de Campo',
          company: targetCompanyName || '',
          companyId: targetCompanyId || '',
          photoURL: stats.photo || null,
          totalPresencas: stats.count,
          lastActive: stats.lastActive || new Date(),
          isRegisteredUser: false
        });
      }
    }

    // Filtro de busca textual (se fornecido)
    if (searchQuery) {
      collaboratorsList = collaboratorsList.filter(c =>
        c.name.toLowerCase().includes(searchQuery) ||
        (c.email && c.email.toLowerCase().includes(searchQuery)) ||
        (c.position && c.position.toLowerCase().includes(searchQuery))
      );
    }

    return NextResponse.json({
      success: true,
      collaborators: collaboratorsList,
      total: collaboratorsList.length
    });

  } catch (error: any) {
    console.error('Erro no GET /api/colaboradores:', error);
    return NextResponse.json({ success: false, error: 'Falha ao buscar lista de colaboradores.' }, { status: 500 });
  }
}

// 2. PUT / PATCH: Edita o nome oficial de um colaborador existente com sincronização e auditoria
export async function PUT(req: Request) {
  try {
    await ensureAuditLogTable();

    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      logSecurityEvent('UNAUTHORIZED_ACCESS', { path: 'PUT /api/colaboradores', reason: 'NO_SESSION' });
      return NextResponse.json({ success: false, error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    // PERMISSÃO: Apenas SUPER_ADMIN, COMPANY_ADMIN ou ORGANIZER podem editar colaboradores
    const isAuthorizedRole = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ORGANIZER'].includes(sessionUser.role);
    if (!isAuthorizedRole) {
      logSecurityEvent('FORBIDDEN_ACCESS', {
        userId: sessionUser.id,
        path: 'PUT /api/colaboradores',
        reason: 'UNAUTHORIZED_ROLE_EDIT_COLLABORATOR'
      });
      return NextResponse.json({ success: false, error: 'Você não tem permissão administrativa para editar colaboradores.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { collaboratorId, name, position } = body;

    if (!collaboratorId || typeof collaboratorId !== 'string') {
      return NextResponse.json({ success: false, error: 'Identificador do colaborador não informado.' }, { status: 400 });
    }

    // 1. Validação estrita do novo nome
    const nameValidation = sanitizeAndValidateName(name);
    if (!nameValidation.isValid) {
      return NextResponse.json({ success: false, error: nameValidation.error }, { status: 400 });
    }
    const cleanNewName = nameValidation.cleanName;

    // CENÁRIO A: Colaborador registrado na tabela User
    const isFieldParticipant = collaboratorId.startsWith('att_');

    if (!isFieldParticipant) {
      const targetUser = await prisma.user.findUnique({
        where: { id: collaboratorId },
        include: { companyRel: true }
      });

      if (!targetUser) {
        return NextResponse.json({ success: false, error: 'Colaborador não encontrado no sistema.' }, { status: 404 });
      }

      // ISOLAMENTO ENTRE EMPRESAS
      const isSuperAdmin = sessionUser.role === 'SUPER_ADMIN';
      if (!isSuperAdmin) {
        const sameCompanyId = sessionUser.companyId && targetUser.companyId && sessionUser.companyId === targetUser.companyId;
        const sameCompanyName = sessionUser.company && targetUser.company && sessionUser.company.trim().toLowerCase() === targetUser.company.trim().toLowerCase();

        if (!sameCompanyId && !sameCompanyName && targetUser.id !== sessionUser.id) {
          logSecurityEvent('FORBIDDEN_ACCESS', {
            userId: sessionUser.id,
            path: `PUT /api/colaboradores (${collaboratorId})`,
            reason: `CROSS_COMPANY_EDIT_ATTEMPT (Admin Company: ${sessionUser.companyId || sessionUser.company}, Target Company: ${targetUser.companyId || targetUser.company})`
          });
          return NextResponse.json({ 
            success: false, 
            error: 'Acesso negado: Você só pode editar colaboradores pertencentes à sua própria empresa.' 
          }, { status: 403 });
        }
      }

      const previousName = targetUser.name;

      // ATUALIZAÇÃO SEGURA NA FONTE DE VERDADE (User table)
      const updatedUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          name: cleanNewName,
          ...(position && typeof position === 'string' ? { position: position.trim().slice(0, 100) } : {})
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          position: true,
          company: true,
          companyId: true,
          photoURL: true,
          createdAt: true
        }
      });

      // SINCRONIZAÇÃO COM SESSÕES ATIVAS ('LIVE')
      try {
        const activeMeetings = await prisma.meeting.findMany({
          where: {
            status: 'LIVE',
            ...(targetUser.companyId ? { companyId: targetUser.companyId } : { organizerId: sessionUser.id })
          },
          select: { id: true }
        });

        if (activeMeetings.length > 0) {
          const activeMeetingIds = activeMeetings.map(m => m.id);
          await prisma.attendance.updateMany({
            where: {
              meetingId: { in: activeMeetingIds },
              name: { equals: previousName, mode: 'insensitive' }
            },
            data: {
              name: cleanNewName
            }
          });
        }
      } catch (syncErr) {
        console.warn('Aviso: Falha na sincronização de presença em reunião ativa:', syncErr);
      }

      // GRAVAÇÃO DO REGISTRO DE AUDITORIA
      await recordAuditLog({
        adminId: sessionUser.id,
        adminName: sessionUser.name,
        action: 'UPDATE_COLLABORATOR_NAME',
        collaboratorId: targetUser.id,
        previousValue: previousName,
        newValue: cleanNewName,
        details: `Nome alterado de "${previousName}" para "${cleanNewName}" pelo administrador ${sessionUser.name}`,
        companyId: targetUser.companyId || sessionUser.companyId || null
      });

      return NextResponse.json({
        success: true,
        message: `Nome do colaborador corrigido com sucesso para "${cleanNewName}".`,
        collaborator: updatedUser
      });
    } else {
      // CENÁRIO B: Colaborador participante de presenças de campo
      const realAttendanceId = collaboratorId.replace('att_', '');
      const sampleAttendance = await prisma.attendance.findUnique({
        where: { id: realAttendanceId },
        include: { meeting: true }
      });

      if (!sampleAttendance) {
        return NextResponse.json({ success: false, error: 'Registro de presença do colaborador não encontrado.' }, { status: 404 });
      }

      const previousName = sampleAttendance.name;

      // Atualiza os registros de presença desse colaborador nas reuniões da empresa
      const companyMeetings = await prisma.meeting.findMany({
        where: {
          ...(sessionUser.companyId ? { companyId: sessionUser.companyId } : { organizerId: sessionUser.id })
        },
        select: { id: true }
      });

      const meetingIds = companyMeetings.map(m => m.id);

      await prisma.attendance.updateMany({
        where: {
          meetingId: { in: meetingIds },
          name: { equals: previousName, mode: 'insensitive' }
        },
        data: {
          name: cleanNewName,
          ...(position && typeof position === 'string' ? { cpf: position.trim().slice(0, 80) } : {})
        }
      });

      // GRAVAÇÃO DO REGISTRO DE AUDITORIA
      await recordAuditLog({
        adminId: sessionUser.id,
        adminName: sessionUser.name,
        action: 'UPDATE_COLLABORATOR_NAME',
        collaboratorId: collaboratorId,
        previousValue: previousName,
        newValue: cleanNewName,
        details: `Nome de presença em campo alterado de "${previousName}" para "${cleanNewName}" pelo administrador ${sessionUser.name}`,
        companyId: sessionUser.companyId || null
      });

      return NextResponse.json({
        success: true,
        message: `Nome do colaborador de campo corrigido com sucesso para "${cleanNewName}".`,
        collaborator: {
          id: collaboratorId,
          name: cleanNewName,
          position: position || sampleAttendance.cpf || 'Colaborador de Campo',
          company: sessionUser.company || ''
        }
      });
  } catch (error: any) {
    console.error('Erro no PUT /api/colaboradores:', error);
    return NextResponse.json({ success: false, error: 'Falha interna ao atualizar nome do colaborador.' }, { status: 500 });
  }
}
