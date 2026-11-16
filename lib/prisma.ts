import { PrismaClient } from '@prisma/client';

// O DDS Master nunca precisa da senha dos usuários do DDS-ON: o campo é omitido em
// todas as consultas, para o hash não sair em nenhuma resposta da API ou página.
const createClient = () => new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  omit: { user: { password: true } },
});

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
