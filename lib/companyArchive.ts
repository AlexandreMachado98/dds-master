// lib/companyArchive.ts
// "Excluir empresa" do DDS-ON em duas fases:
//   1. Arquivar: some das listas do Master, a palavra-chave para de funcionar e os usuários da empresa
//      ficam bloqueados (o DDS-ON confere o status do usuário a cada acesso). Nada é apagado e dá
//      para restaurar exatamente como estava (status da empresa, chave e status de cada usuário).
//   2. Excluir definitivamente (só arquivada, com o nome digitado): apaga a empresa e todos os dados.
//
// O banco é o mesmo do DDS-ON, e o DDS Master não conhece todas as tabelas dele (planos de ação,
// competições, DDS semanal, colaboradores). Por isso a exclusão usa SQL na ordem certa e só mexe nas
// tabelas que existirem. A tabela de arquivamento é criada aqui, com SQL idempotente (nunca db push).

import prisma from '@/lib/prisma';

let tableReady = false;

export async function ensureArchiveTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MasterCompanyArchive" (
      "companyId" TEXT NOT NULL PRIMARY KEY,
      "previousStatus" TEXT NOT NULL,
      "previousSecretKey" TEXT,
      "userStatuses" TEXT NOT NULL DEFAULT '[]',
      "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "archivedBy" TEXT
    )`);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MasterCompanyArchive_companyId_fkey') THEN
        ALTER TABLE "MasterCompanyArchive" ADD CONSTRAINT "MasterCompanyArchive_companyId_fkey"
          FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`);
  tableReady = true;
}

/** Ids das empresas arquivadas (para tirá-las das listas). */
export async function archivedCompanyIds(): Promise<string[]> {
  await ensureArchiveTable();
  const rows = await prisma.$queryRaw<{ companyId: string }[]>`SELECT "companyId" FROM "MasterCompanyArchive"`;
  return rows.map((r) => r.companyId);
}

export class ArchiveError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type UserStatus = { id: string; status: string };

export async function archiveCompany(companyId: string, actor: string) {
  await ensureArchiveTable();
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, status: true, secretKey: true } });
  if (!company) throw new ArchiveError('Empresa não encontrada.', 404);
  const already = await prisma.$queryRaw<{ companyId: string }[]>`SELECT "companyId" FROM "MasterCompanyArchive" WHERE "companyId" = ${companyId}`;
  if (already.length) return { name: company.name, alreadyArchived: true };

  const users = await prisma.user.findMany({ where: { companyId, role: { not: 'SUPER_ADMIN' } }, select: { id: true, status: true } });
  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO "MasterCompanyArchive" ("companyId", "previousStatus", "previousSecretKey", "userStatuses", "archivedBy")
      VALUES (${companyId}, ${company.status}, ${company.secretKey}, ${JSON.stringify(users)}, ${actor})`,
    prisma.company.update({ where: { id: companyId }, data: { status: 'SUSPENDED', secretKey: null } }),
    prisma.user.updateMany({ where: { companyId, role: { not: 'SUPER_ADMIN' } }, data: { status: 'BLOCKED' } }),
  ]);
  return { name: company.name, blockedUsers: users.length };
}

/** Volta tudo como estava. Se a palavra-chave foi usada por outra empresa nesse meio-tempo, volta sem chave. */
export async function restoreCompany(companyId: string) {
  await ensureArchiveTable();
  const rows = await prisma.$queryRaw<{ previousStatus: string; previousSecretKey: string | null; userStatuses: string }[]>`
    SELECT "previousStatus", "previousSecretKey", "userStatuses" FROM "MasterCompanyArchive" WHERE "companyId" = ${companyId}`;
  const archive = rows[0];
  if (!archive) throw new ArchiveError('Esta empresa não está arquivada.', 404);
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (!company) throw new ArchiveError('Empresa não encontrada.', 404);

  let secretKey = archive.previousSecretKey;
  let keyWarning: string | null = null;
  if (secretKey) {
    const clash = await prisma.company.findFirst({ where: { secretKey, NOT: { id: companyId } }, select: { name: true } });
    if (clash) {
      keyWarning = `A palavra-chave ${secretKey} agora é da empresa "${clash.name}". Defina uma chave nova para esta empresa.`;
      secretKey = null;
    }
  }
  let users: UserStatus[] = [];
  try {
    users = JSON.parse(archive.userStatuses);
  } catch {}

  await prisma.$transaction([
    prisma.company.update({ where: { id: companyId }, data: { status: archive.previousStatus as never, secretKey } }),
    // Só volta quem continua bloqueado (não desfaz um bloqueio feito depois, de propósito, em outro lugar).
    ...users.map((u) => prisma.user.updateMany({ where: { id: u.id, companyId, status: 'BLOCKED' }, data: { status: u.status as never } })),
    prisma.$executeRaw`DELETE FROM "MasterCompanyArchive" WHERE "companyId" = ${companyId}`,
  ]);
  return { name: company.name, restoredUsers: users.length, keyWarning };
}

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: boolean }[]>`SELECT to_regclass(${`"${name}"`}) IS NOT NULL AS ok`;
  return !!rows[0]?.ok;
}

async function countWhere(table: string, sql: string, params: unknown[]): Promise<number> {
  if (!(await tableExists(table))) return 0;
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM "${table}" WHERE ${sql}`, ...params);
  return Number(rows[0]?.n ?? 0);
}

/** O que a exclusão definitiva vai apagar (mostrado na confirmação). */
export async function deletionPreview(companyId: string) {
  await ensureArchiveTable();
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, document: true } });
  if (!company) throw new ArchiveError('Empresa não encontrada.', 404);
  const archived = (await prisma.$queryRaw<{ c: string }[]>`SELECT "companyId" AS c FROM "MasterCompanyArchive" WHERE "companyId" = ${companyId}`).length > 0;
  const userIds = (await prisma.user.findMany({ where: { companyId, role: { not: 'SUPER_ADMIN' } }, select: { id: true } })).map((u) => u.id);
  const meetingWhere = `"companyId" = $1 OR "organizerId" = ANY($2::text[])`;
  const [meetings, attendances, actionPlans, competitions, collaborators, schedules] = await Promise.all([
    countWhere('Meeting', meetingWhere, [companyId, userIds]),
    countWhere('Attendance', `"meetingId" IN (SELECT id FROM "Meeting" WHERE ${meetingWhere})`, [companyId, userIds]),
    countWhere('ActionPlan', `"companyId" = $1`, [companyId]),
    countWhere('Competition', `"companyId" = $1`, [companyId]),
    countWhere('Collaborator', `"companyId" = $1`, [companyId]),
    countWhere('DdsSchedule', `"companyId" = $1 OR "organizerId" = ANY($2::text[])`, [companyId, userIds]),
  ]);
  return { id: company.id, name: company.name, document: company.document, archived, counts: { users: userIds.length, meetings, attendances, actionPlans, competitions, collaborators, schedules } };
}

/**
 * Exclusão definitiva: tudo numa transação (ou apaga tudo, ou nada). Ordem pensada para as
 * chaves estrangeiras do DDS-ON, inclusive as que impedem apagar (RESTRICT).
 */
export async function deleteCompanyPermanently(companyId: string, confirmName: string) {
  const preview = await deletionPreview(companyId);
  if (!preview.archived) throw new ArchiveError('Arquive a empresa antes de excluir definitivamente.');
  const typed = (confirmName ?? '').trim().toLocaleLowerCase('pt-BR');
  if (!typed || typed !== preview.name.trim().toLocaleLowerCase('pt-BR')) {
    throw new ArchiveError('Para confirmar, digite o nome da empresa exatamente como está cadastrado.');
  }

  const exists: Record<string, boolean> = {};
  for (const table of ['ActionPlan', 'Competition', 'DdsSchedule', 'QuizAttempt', 'Attendance', 'Quiz', 'Collaborator', 'CollaboratorSettings']) {
    exists[table] = await tableExists(table);
  }
  const userIds = (await prisma.user.findMany({ where: { companyId, role: { not: 'SUPER_ADMIN' } }, select: { id: true } })).map((u) => u.id);

  try {
    await prisma.$transaction(
      async (tx) => {
        const run = (sql: string, ...params: unknown[]) => tx.$executeRawUnsafe(sql, ...params);
        if (exists.ActionPlan) await run(`DELETE FROM "ActionPlan" WHERE "companyId" = $1`, companyId);
        if (exists.Competition) await run(`DELETE FROM "Competition" WHERE "companyId" = $1`, companyId);
        if (exists.DdsSchedule) await run(`DELETE FROM "DdsSchedule" WHERE "companyId" = $1 OR "organizerId" = ANY($2::text[])`, companyId, userIds);

        const meetings = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "Meeting" WHERE "companyId" = $1 OR "organizerId" = ANY($2::text[])`,
          companyId,
          userIds,
        );
        const meetingIds = meetings.map((m) => m.id);
        if (meetingIds.length) {
          if (exists.QuizAttempt && exists.Attendance) {
            await run(`DELETE FROM "QuizAttempt" WHERE "attendanceId" IN (SELECT id FROM "Attendance" WHERE "meetingId" = ANY($1::text[]))`, meetingIds);
          }
          if (exists.Attendance) await run(`DELETE FROM "Attendance" WHERE "meetingId" = ANY($1::text[])`, meetingIds);
          await run(`DELETE FROM "Meeting" WHERE id = ANY($1::text[])`, meetingIds);
        }
        // Modelos de questionário dos técnicos da empresa que não estão em nenhum DDS.
        if (exists.Quiz && userIds.length) await run(`DELETE FROM "Quiz" WHERE "creatorId" = ANY($1::text[]) AND "meetingId" IS NULL`, userIds);
        if (exists.Collaborator) await run(`DELETE FROM "Collaborator" WHERE "companyId" = $1`, companyId);
        if (exists.CollaboratorSettings) await run(`DELETE FROM "CollaboratorSettings" WHERE "companyId" = $1`, companyId);
        if (userIds.length) await run(`DELETE FROM "User" WHERE id = ANY($1::text[])`, userIds);
        await run(`DELETE FROM "MasterCompanyArchive" WHERE "companyId" = $1`, companyId);
        await run(`DELETE FROM "Company" WHERE id = $1`, companyId);
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (error: any) {
    // Chave estrangeira: algum usuário da empresa aparece em registros de outra empresa.
    if (error?.code === 'P2003' || /foreign key|violates/i.test(String(error?.message))) {
      console.error('[EXCLUIR EMPRESA] Bloqueado por vínculo:', error?.message);
      throw new ArchiveError(
        'Não foi possível excluir: há registros de outra empresa ligados a usuários desta (por exemplo, um plano de ação). Nada foi apagado.',
        409,
      );
    }
    throw error;
  }
  return { deleted: true, name: preview.name, counts: preview.counts };
}
