// lib/selfiePolicy.ts
// Selfie de presença no DDS-ON, ligada ou desligada por empresa.
//
// A coluna "Company"."requireSelfie" é do DDS-ON e não está no schema do Prisma daqui (o
// banco é compartilhado). As duas instruções abaixo são as mesmas do DDS-ON e são
// idempotentes: empresas que já existiam ficam com a selfie ligada; novas começam desligadas.

import prisma from '@/lib/prisma';

const STATEMENTS = [
  'ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "requireSelfie" BOOLEAN NOT NULL DEFAULT true',
  'ALTER TABLE "Company" ALTER COLUMN "requireSelfie" SET DEFAULT false'
];

let ready = false;

export async function ensureSelfieColumn(): Promise<void> {
  if (ready) return;
  const rows = await prisma.$queryRawUnsafe<{ d: string | null }[]>(
    `SELECT column_default AS d FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Company' AND column_name = 'requireSelfie'`
  );
  if (!(rows[0] && String(rows[0].d) === 'false')) {
    for (const sql of STATEMENTS) await prisma.$executeRawUnsafe(sql);
  }
  ready = true;
}

/** Selfie ligada por empresa (id → true/false). */
export async function selfieByCompany(): Promise<Map<string, boolean>> {
  await ensureSelfieColumn();
  const rows = await prisma.$queryRawUnsafe<{ id: string; requireSelfie: boolean }[]>(
    'SELECT "id", "requireSelfie" FROM "Company"'
  );
  return new Map(rows.map(r => [r.id, r.requireSelfie]));
}

export async function setCompanySelfie(companyId: string, requireSelfie: boolean): Promise<void> {
  await ensureSelfieColumn();
  await prisma.$executeRawUnsafe('UPDATE "Company" SET "requireSelfie" = $1 WHERE "id" = $2', requireSelfie, companyId);
}
