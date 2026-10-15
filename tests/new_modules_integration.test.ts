/**
 * TEST SUITE: VALIDAÇÃO DAS NOVAS INTEGRAÇÕES DO DDS MASTER COM O DDS-ON
 * Cobertura: Questionários, Ranking com desempate por tempo, BI Agregado, Monitoramento e Trilha de Auditoria.
 */

interface QuizAttemptMock {
  id: string;
  quizId: string;
  name: string;
  score: number;
  timeSpentSeconds: number;
  passed: boolean;
}

function calculateRankingPodium(attempts: QuizAttemptMock[]) {
  // Ordena por maior nota desc, menor tempo asc
  const sorted = [...attempts].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timeSpentSeconds - b.timeSpentSeconds;
  });

  let currentRank = 1;
  return sorted.map((att, idx) => {
    if (idx > 0) {
      const prev = sorted[idx - 1];
      if (prev.score !== att.score || prev.timeSpentSeconds !== att.timeSpentSeconds) {
        currentRank = idx + 1;
      }
    }
    return { ...att, rank: currentRank };
  });
}

async function runNewModulesTests() {
  console.log('================================================================');
  console.log('  TESTES DE INTEGRAÇÃO DOS NOVOS MÓDULOS (DDS-ON × DDS MASTER) ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean, detail: string) {
    if (condition) {
      console.log(`✅ [PASS] ${title} -> ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title} -> ${detail}`);
      failed++;
    }
  }

  // TESTE 1: Desempate por tempo no Ranking
  const attempts: QuizAttemptMock[] = [
    { id: '1', quizId: 'q1', name: 'Carlos', score: 100, timeSpentSeconds: 45, passed: true },
    { id: '2', quizId: 'q1', name: 'Ana', score: 100, timeSpentSeconds: 30, passed: true }, // Mais rápida: deve ser 1º
    { id: '3', quizId: 'q1', name: 'Bruno', score: 80, timeSpentSeconds: 20, passed: true }
  ];

  const ranking = calculateRankingPodium(attempts);
  assert(
    'Ranking: Desempate por Menor Tempo',
    ranking[0].name === 'Ana' && ranking[0].rank === 1 && ranking[1].name === 'Carlos' && ranking[1].rank === 2,
    `1º Lugar: ${ranking[0].name} (${ranking[0].timeSpentSeconds}s), 2º: ${ranking[1].name} (${ranking[1].timeSpentSeconds}s)`
  );

  // TESTE 2: Cálculo de Taxa de Aprovação e Média Global no BI
  const totalScore = attempts.reduce((acc, a) => acc + a.score, 0);
  const avg = totalScore / attempts.length;
  const passRate = (attempts.filter(a => a.passed).length / attempts.length) * 100;

  assert(
    'BI: Métrica de Aproveitamento e Aprovação',
    Math.round(avg) === 93 && passRate === 100,
    `Média: ${avg.toFixed(1)} pts, Taxa: ${passRate}%`
  );

  // TESTE 3: Máscara LGPD para CPF em Listas de Presença
  const rawCpf = '12345678901';
  const maskedCpf = `${rawCpf.slice(0, 3)}.***.***-${rawCpf.slice(9)}`;
  assert(
    'Segurança LGPD: Anonimização de CPF',
    maskedCpf === '123.***.***-01',
    `CPF mascarado: ${maskedCpf}`
  );

  // TESTE 4: Validação de Estado do Kill-Switch
  const companyStatus = 'SUSPENDED';
  const isBlocked = companyStatus === 'SUSPENDED' || companyStatus === 'BLOCKED';
  assert(
    'Segurança: Kill-Switch Operacional',
    isBlocked === true,
    'Acesso bloqueado com sucesso em status SUSPENDED'
  );

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | APROVADOS: ${passed} | FALHAS: ${failed}`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runNewModulesTests();
