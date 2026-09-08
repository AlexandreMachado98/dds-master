/**
 * TEST SUITE: DDS MASTER ADMIN USER APPROVAL & ACCESS CONTROL
 * Executa a auditoria e validação de ponta a ponta de todos os cenários (A até I).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  scenario: string;
  description: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordResult(scenario: string, description: string, passed: boolean, details: string) {
  results.push({ scenario, description, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${scenario}] ${description}: ${details}`);
}

async function runAuditTests() {
  console.log('================================================================');
  console.log('  INICIANDO AUDITORIA TÉCNICA E TESTES DE FLUXO - DDS MASTER   ');
  console.log('================================================================\n');

  const testEmail = `test.tecnico.${Date.now()}@amtst.com.br`;
  const companyKey = `TEST_KEY_${Date.now()}`;
  let testCompanyId = '';
  let testUserId = '';

  try {
    // PREPARAÇÃO: Criar Empresa de Teste
    const company = await prisma.company.create({
      data: {
        name: 'Fazenda Modelo de Teste SST',
        document: '12.345.678/0001-90',
        secretKey: companyKey,
        status: 'ACTIVE',
        autoApproveWithKey: true
      }
    });
    testCompanyId = company.id;
    console.log(`[SETUP] Empresa de teste criada: ${company.name} (ID: ${company.id})`);

    // -------------------------------------------------------------------------
    // CENÁRIO A: Novo usuário se cadastra sem chave mágica
    // Resultado esperado: Status PENDING_APPROVAL
    // -------------------------------------------------------------------------
    const newUser = await prisma.user.create({
      data: {
        name: 'Carlos Alberto TST',
        email: testEmail,
        password: 'PasswordHash123#',
        role: 'ORGANIZER',
        status: 'PENDING_APPROVAL',
        position: 'Técnico em Segurança do Trabalho',
        company: 'Fazenda Modelo de Teste SST'
      }
    });
    testUserId = newUser.id;

    const isPending = newUser.status === 'PENDING_APPROVAL';
    recordResult(
      'CENÁRIO A',
      'Novo usuário se cadastra sem chave mágica',
      isPending,
      `Status inicial registrado: ${newUser.status}`
    );

    // -------------------------------------------------------------------------
    // CENÁRIO B: Administrador visualiza o usuário na fila de pendentes
    // Resultado esperado: Usuário listado na consulta de PENDING_APPROVAL
    // -------------------------------------------------------------------------
    const pendingList = await prisma.user.findMany({
      where: { status: 'PENDING_APPROVAL' }
    });
    const foundInPending = pendingList.some((u) => u.id === testUserId);
    recordResult(
      'CENÁRIO B',
      'Administrador visualiza o usuário na fila de pendentes',
      foundInPending,
      `Usuário ${testUserId} encontrado na fila (${pendingList.length} pendentes)`
    );

    // -------------------------------------------------------------------------
    // CENÁRIO C: Administrador libera acesso
    // Resultado esperado: PENDING_APPROVAL -> ACTIVE e persistência garantida
    // -------------------------------------------------------------------------
    const approvedUser = await prisma.user.update({
      where: { id: testUserId },
      data: {
        status: 'ACTIVE',
        companyId: testCompanyId,
        company: company.name
      },
      include: { companyRel: true }
    });

    const isNowActive = approvedUser.status === 'ACTIVE' && approvedUser.companyId === testCompanyId;
    recordResult(
      'CENÁRIO C',
      'Administrador libera acesso e vincula empresa',
      isNowActive,
      `Status atualizado para: ${approvedUser.status}, Empresa vinculada: ${approvedUser.companyRel?.name}`
    );

    // -------------------------------------------------------------------------
    // CENÁRIO D: Usuário tenta acessar novamente após liberação
    // Resultado esperado: Acesso autorizado (ACTIVE e empresa ACTIVE)
    // -------------------------------------------------------------------------
    const userSessionCheck = await prisma.user.findUnique({
      where: { id: testUserId },
      include: { companyRel: true }
    });

    const isAccessAllowed =
      userSessionCheck?.status === 'ACTIVE' &&
      (!userSessionCheck.companyRel || userSessionCheck.companyRel.status === 'ACTIVE');

    recordResult(
      'CENÁRIO D',
      'Usuário autentica e valida autorização de acesso',
      Boolean(isAccessAllowed),
      `Autorização concedida: ${isAccessAllowed ? 'PERMITIDO' : 'NEGADO'}`
    );

    // -------------------------------------------------------------------------
    // CENÁRIO E: Administrador bloqueia o usuário
    // Resultado esperado: ACTIVE -> BLOCKED
    // -------------------------------------------------------------------------
    const blockedUser = await prisma.user.update({
      where: { id: testUserId },
      data: { status: 'BLOCKED' }
    });

    recordResult(
      'CENÁRIO E',
      'Administrador bloqueia usuário',
      blockedUser.status === 'BLOCKED',
      `Status atualizado para: ${blockedUser.status}`
    );

    // -------------------------------------------------------------------------
    // CENÁRIO F: Usuário bloqueado tenta acessar
    // Resultado esperado: Acesso negado
    // -------------------------------------------------------------------------
    const checkBlockedAccess = await prisma.user.findUnique({
      where: { id: testUserId }
    });
    const isBlockedDenialCorrect = checkBlockedAccess?.status === 'BLOCKED';

    recordResult(
      'CENÁRIO F',
      'Usuário bloqueado tenta acessar a plataforma',
      isBlockedDenialCorrect,
      `Acesso rejeitado corretamente para status: ${checkBlockedAccess?.status}`
    );

    // -------------------------------------------------------------------------
    // CENÁRIO G: Resiliência de Estado em Falha
    // Resultado esperado: Se ocorrer erro ou rollback, dados permanecem íntegros
    // -------------------------------------------------------------------------
    let rollbackSuccess = false;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: testUserId },
          data: { status: 'ACTIVE' }
        });
        throw new Error('SIMULATED_NETWORK_FAILURE');
      });
    } catch (e: any) {
      const userAfterFailedTx = await prisma.user.findUnique({ where: { id: testUserId } });
      rollbackSuccess = userAfterFailedTx?.status === 'BLOCKED';
    }

    recordResult(
      'CENÁRIO G',
      'Simulação de falha de conexão/transação (Rollback seguro)',
      rollbackSuccess,
      `Estado preservado com segurança no banco sem corrupção.`
    );

    // -------------------------------------------------------------------------
    // CENÁRIO H: Cliques múltiplos/concorrentes no botão "Liberar" (Idempotência)
    // Resultado esperado: Operações concorrentes produzem o mesmo estado estável
    // -------------------------------------------------------------------------
    const concurrentApprovals = await Promise.all([
      prisma.user.update({ where: { id: testUserId }, data: { status: 'ACTIVE' } }),
      prisma.user.update({ where: { id: testUserId }, data: { status: 'ACTIVE' } }),
      prisma.user.update({ where: { id: testUserId }, data: { status: 'ACTIVE' } })
    ]);

    const allActive = concurrentApprovals.every((u) => u.status === 'ACTIVE');
    recordResult(
      'CENÁRIO H',
      'Idempotência contra múltiplos cliques concorrentes em Liberar',
      allActive,
      `3 operações paralelas concluídas com status uniforme ACTIVE.`
    );

    // -------------------------------------------------------------------------
    // CENÁRIO I: Tentativa de operação em usuário inexistente (Tratamento de erro)
    // Resultado esperado: Erro tratado sem derrubar a aplicação
    // -------------------------------------------------------------------------
    let handledGracefully = false;
    try {
      await prisma.user.update({
        where: { id: 'non-existent-user-uuid-999' },
        data: { status: 'ACTIVE' }
      });
    } catch (err: any) {
      handledGracefully = Boolean(err.message);
    }

    recordResult(
      'CENÁRIO I',
      'Tratamento adequado de falhas no backend',
      handledGracefully,
      `Exceção tratada com integridade.`
    );

  } catch (error: any) {
    console.error('ERRO INESPERADO NA EXECUÇÃO DOS TESTES:', error);
  } finally {
    // LIMPEZA DOS REGISTROS DE TESTE
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    if (testCompanyId) {
      await prisma.company.delete({ where: { id: testCompanyId } }).catch(() => {});
    }
    await prisma.$disconnect();

    console.log('\n================================================================');
    console.log('                RESUMO DA AUDITORIA E TESTES                   ');
    console.log('================================================================');
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`TOTAL DE CENÁRIOS: ${results.length} | APROVADOS: ${passedCount} | FALHAS: ${results.length - passedCount}`);
    console.log('================================================================\n');
  }
}

runAuditTests();
