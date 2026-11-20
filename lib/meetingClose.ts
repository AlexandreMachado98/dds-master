// lib/meetingClose.ts
// Encerrar pelo Master um DDS do DDS-ON que ficou aberto à toa.
//
// Faz exatamente o que o botão "Encerrar" do organizador faz no DDS-ON
// (app/api/reuniao/route.ts, action end_meeting):
//   - mesmo lock das assinaturas (pg_advisory_xact_lock(hashtext(id))), para nenhuma
//     presença entrar no meio do encerramento;
//   - status ENDED, endedAt = agora, coleta complementar fechada;
//   - documentHash SHA-256 calculado com a mesma fórmula, então a ata e o validador
//     do DDS-ON reconhecem o documento normalmente.
// DDS Semanal (link fixo) não é encerrado aqui: ele fecha sozinho no fim do tema e o
// DDS-ON reabriria a lista se o tema ainda estivesse no prazo.

import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';

export type CloseResult =
  | { id: string; ok: true; alreadyEnded: boolean }
  | { id: string; ok: false; error: string };

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int AS n FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
    table, column
  );
  return (rows[0]?.n ?? 0) > 0;
}

/** Ids, entre os informados, que são DDS de um tema do DDS Semanal. */
export async function weeklyMeetingIds(meetingIds: string[]): Promise<Set<string>> {
  if (meetingIds.length === 0 || !(await columnExists('DdsScheduleTheme', 'meetingId'))) return new Set();
  const rows = await prisma.$queryRawUnsafe<{ meetingId: string }[]>(
    'SELECT "meetingId" FROM "DdsScheduleTheme" WHERE "meetingId" = ANY($1::text[])', meetingIds
  );
  return new Set(rows.map(r => r.meetingId));
}

export async function closeMeeting(meetingId: string): Promise<CloseResult> {
  if ((await weeklyMeetingIds([meetingId])).has(meetingId)) {
    return { id: meetingId, ok: false, error: 'DDS Semanal: ele encerra sozinho no fim do tema.' };
  }
  const hasCollectionFlag = await columnExists('Meeting', 'attendanceCollectionOpen');

  return prisma.$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT 1 AS lock_acquired FROM pg_advisory_xact_lock(hashtext($1))', meetingId);
    const current = await tx.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true, status: true, topic: true, createdAt: true,
        attendees: { select: { id: true, name: true, cpf: true }, orderBy: { createdAt: 'asc' } },
        attachments: { select: { id: true, fileName: true }, orderBy: { order: 'asc' } }
      }
    });
    if (!current) return { id: meetingId, ok: false as const, error: 'DDS não encontrado.' };
    if (current.status === 'ENDED') return { id: meetingId, ok: true as const, alreadyEnded: true };

    const endedAt = new Date();
    const digest = [
      current.id,
      current.topic || '',
      current.createdAt?.toISOString() || '',
      endedAt.toISOString(),
      current.attendees.map(a => [a.id, a.name, a.cpf].join(':')).join(';'),
      current.attachments.map(att => [att.id, att.fileName].join(':')).join(';')
    ].join('|');
    const documentHash = createHash('sha256').update(digest).digest('hex');

    await tx.meeting.update({ where: { id: meetingId }, data: { status: 'ENDED', endedAt, documentHash } });
    if (hasCollectionFlag) {
      await tx.$executeRawUnsafe('UPDATE "Meeting" SET "attendanceCollectionOpen" = false WHERE "id" = $1', meetingId);
    }
    return { id: meetingId, ok: true as const, alreadyEnded: false };
  }, { timeout: 20000 });
}
