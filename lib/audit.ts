// lib/audit.ts
import prisma from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/auth';

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
        "adminId" TEXT NOT NULL,
        "adminName" TEXT,
        "action" TEXT NOT NULL,
        "collaboratorId" TEXT,
        "previousValue" TEXT,
        "newValue" TEXT,
        "details" TEXT,
        "companyId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_collaboratorId_idx" ON "AuditLog"("collaboratorId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_companyId_idx" ON "AuditLog"("companyId");`);
    auditTableInitialized = true;
  } catch (err) {
    // SQLite or Postgres compatibility
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AuditLog" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "adminId" TEXT NOT NULL,
          "adminName" TEXT,
          "action" TEXT NOT NULL,
          "collaboratorId" TEXT,
          "previousValue" TEXT,
          "newValue" TEXT,
          "details" TEXT,
          "companyId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      auditTableInitialized = true;
    } catch (e) {
      console.warn('ensureAuditLogTable fallback warning:', e);
    }
  }
}

export interface CreateAuditLogParams {
  adminId: string;
  adminName?: string | null;
  action: string;
  collaboratorId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  details?: string | null;
  companyId?: string | null;
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
        adminId: params.adminId,
        adminName: params.adminName || null,
        action: params.action,
        collaboratorId: params.collaboratorId || null,
        previousValue: params.previousValue || null,
        newValue: params.newValue || null,
        details: params.details || null,
        companyId: params.companyId || null,
      }
    });

    logSecurityEvent('ADMIN_ACTION', {
      userId: params.adminId,
      reason: `${params.action}: ${params.collaboratorId || 'N/A'} (De: "${params.previousValue}" Para: "${params.newValue}")`
    });

    return log;
  } catch (err) {
    console.error('Erro ao gravar log de auditoria:', err);
    // Fallback via raw query
    try {
      const crypto = await import('crypto');
      const id = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "AuditLog" ("id", "adminId", "adminName", "action", "collaboratorId", "previousValue", "newValue", "details", "companyId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        id,
        params.adminId,
        params.adminName || null,
        params.action,
        params.collaboratorId || null,
        params.previousValue || null,
        params.newValue || null,
        params.details || null,
        params.companyId || null,
        new Date()
      );
    } catch (rawErr) {
      console.error('Falha no fallback de gravação do log de auditoria:', rawErr);
    }
    return null;
  }
}
