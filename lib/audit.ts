import prisma from '@/lib/prisma';
import crypto from 'crypto';

let auditTableInitialized = false;

/**
 * Garante que a tabela AuditLog existe no banco de dados
 */
export async function ensureAuditLogTable() {
  if (auditTableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "action" TEXT NOT NULL,
        "entityType" TEXT NOT NULL DEFAULT 'User',
        "entityId" TEXT NOT NULL,
        "adminId" TEXT,
        "adminName" TEXT,
        "companyId" TEXT,
        "previousValue" TEXT,
        "newValue" TEXT,
        "details" TEXT,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_companyId_idx" ON "AuditLog"("companyId");`);
    auditTableInitialized = true;
  } catch (err) {
    console.warn('ensureAuditLogTable warning:', err);
  }
}

export interface CreateAuditLogParams {
  action: string;
  entityType?: string;
  entityId: string;
  adminId?: string | null;
  adminName?: string | null;
  companyId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Registra uma ação de auditoria estruturada
 */
export async function recordAuditLog(params: CreateAuditLogParams) {
  try {
    await ensureAuditLogTable();
    
    // Tenta gravar via Prisma ORM
    const log = await (prisma as any).auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType || 'User',
        entityId: params.entityId,
        adminId: params.adminId || null,
        adminName: params.adminName || null,
        companyId: params.companyId || null,
        previousValue: params.previousValue || null,
        newValue: params.newValue || null,
        details: params.details || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      }
    });

    return log;
  } catch (err) {
    console.error('Erro ao gravar log de auditoria via Prisma:', err);
    // Fallback via raw query
    try {
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "AuditLog" ("id", "action", "entityType", "entityId", "adminId", "adminName", "companyId", "previousValue", "newValue", "details", "ipAddress", "userAgent", "createdAt") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        id,
        params.action,
        params.entityType || 'User',
        params.entityId,
        params.adminId || null,
        params.adminName || null,
        params.companyId || null,
        params.previousValue || null,
        params.newValue || null,
        params.details || null,
        params.ipAddress || null,
        params.userAgent || null,
        new Date()
      );
    } catch (rawErr) {
      console.error('Falha no fallback de gravação do log de auditoria:', rawErr);
    }
    return null;
  }
}
