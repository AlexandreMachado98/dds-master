import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit';
import { MASTER_SESSION_COOKIE, verifyMasterSessionToken } from '@/lib/masterSession';
import {
  archiveCompany,
  ArchiveError,
  deleteCompanyPermanently,
  deletionPreview,
  ensureArchiveTable,
  restoreCompany,
} from '@/lib/companyArchive';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function readCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

/** Empresas do DDS-ON arquivadas ("Excluir" do Master), da mais recente para a mais antiga. */
export async function GET() {
  try {
    await ensureArchiveTable();
    const rows = await prisma.$queryRaw<
      { id: string; name: string; document: string | null; archivedAt: Date; archivedBy: string | null; users: bigint; meetings: bigint }[]
    >`
      SELECT c.id, c.name, c.document, a."archivedAt", a."archivedBy",
        (SELECT count(*) FROM "User" u WHERE u."companyId" = c.id) AS users,
        (SELECT count(*) FROM "Meeting" m WHERE m."companyId" = c.id) AS meetings
      FROM "MasterCompanyArchive" a JOIN "Company" c ON c.id = a."companyId"
      ORDER BY a."archivedAt" DESC`;
    return NextResponse.json({
      success: true,
      companies: rows.map((r) => ({ ...r, users: Number(r.users), meetings: Number(r.meetings) })),
    });
  } catch (error: any) {
    console.error('[API /api/master/arquivo GET]', error);
    return NextResponse.json({ success: false, error: 'Erro ao carregar as empresas arquivadas.' }, { status: 500 });
  }
}

/**
 * action: "archive" (Excluir), "restore", "preview" (o que será apagado) ou "delete" (exclusão definitiva,
 * só de empresa arquivada e com confirmName igual ao nome da empresa).
 */
export async function POST(req: Request) {
  const session = await verifyMasterSessionToken(readCookie(req, MASTER_SESSION_COOKIE));
  if (!session) return NextResponse.json({ success: false, error: 'Sessão do DDS Master ausente ou expirada.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const companyId = String(body?.companyId || '').trim();
  const action = String(body?.action || '');
  if (!companyId) return NextResponse.json({ success: false, error: 'Empresa não informada.' }, { status: 400 });
  const audit = (name: string, details: Record<string, unknown>) =>
    recordAuditLog({
      action: name,
      entityType: 'Company',
      entityId: companyId,
      companyId,
      adminName: session.sub,
      details: JSON.stringify(details),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: req.headers.get('user-agent'),
    });

  try {
    if (action === 'archive') {
      const result = await archiveCompany(companyId, session.sub);
      await audit('COMPANY_ARCHIVED', result);
      return NextResponse.json({ success: true, message: `Empresa "${result.name}" arquivada. Ninguém dela entra mais no DDS-ON.`, ...result });
    }
    if (action === 'restore') {
      const result = await restoreCompany(companyId);
      await audit('COMPANY_RESTORED', result);
      return NextResponse.json({ success: true, message: `Empresa "${result.name}" restaurada.`, ...result });
    }
    if (action === 'preview') {
      return NextResponse.json({ success: true, preview: await deletionPreview(companyId) });
    }
    if (action === 'delete') {
      const result = await deleteCompanyPermanently(companyId, String(body?.confirmName || ''));
      await audit('COMPANY_DELETED', result);
      console.warn(`[EXCLUIR EMPRESA] ${session.sub} excluiu definitivamente "${result.name}" (${companyId}).`);
      return NextResponse.json({ success: true, message: `Empresa "${result.name}" excluída definitivamente.`, ...result });
    }
    return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (error: any) {
    if (error instanceof ArchiveError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error('[API /api/master/arquivo POST]', error);
    return NextResponse.json({ success: false, error: 'Erro ao processar a empresa. Nada foi alterado.' }, { status: 500 });
  }
}
