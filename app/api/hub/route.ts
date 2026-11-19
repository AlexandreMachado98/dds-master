import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkonConfig, checkonFetch, CheckonError } from '@/lib/checkon';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CheckonSummary = {
  totalCompanies: number;
  byState: Record<string, number>;
  expiringIn7Days: number;
  inspections30d: number;
  vehicles: number;
};

/** Números de cada produto para a tela inicial (escolha entre DDS-ON e CHECK-ON). */
export async function GET() {
  const ddsOn = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.meeting.count({ where: { status: 'LIVE' } }),
  ])
    .then(([companies, activeCompanies, pendingApprovals, liveMeetings]) => ({ ok: true, companies, activeCompanies, pendingApprovals, liveMeetings }))
    .catch((error) => {
      console.error('[API /api/hub] DDS-ON:', error);
      return { ok: false, error: 'Não foi possível ler os dados do DDS-ON.' };
    });

  const config = checkonConfig();
  let checkOn: Record<string, unknown>;
  if (!config.ready) {
    checkOn = { configured: false, online: false, problems: config.problems };
  } else {
    try {
      const summary = await checkonFetch<CheckonSummary>('/summary', { timeoutMs: 8000 });
      checkOn = { configured: true, online: true, summary };
    } catch (error) {
      checkOn = { configured: true, online: false, error: error instanceof CheckonError ? error.message : 'Erro ao consultar o CHECK-ON.' };
    }
  }

  return NextResponse.json({ ddsOn, checkOn });
}
