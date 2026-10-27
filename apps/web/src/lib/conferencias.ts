// A5, item 246: toda conferência "N dias depois do deploy" tem data absoluta, responsável e a data em que foi feita.
// É o lugar onde as etapas acrescentam as suas (uma entrada na lista, no commit do deploy; o cron não muda).
//
// O que o cron diário da coleta faz com a lista (lib/youtube/coleta/index.ts, fase 'depois'):
//   - vencida (a data passou) e sem `feitaEm`: aparece em `coleta.conferencias_vencidas`, com o nome;
//   - vencida há MAIS de 7 dias e sem `feitaEm`: entra também em `falhas` e deixa o cron vermelho.
// Fazer uma conferência = rodar a consulta de `onde`, anotar o resultado no ledger da etapa e preencher `feitaEm` aqui,
// num commit (a linha some do resumo e do vermelho no deploy seguinte). Conferência vencida há muito tempo continua
// vermelha até alguém preencher `feitaEm`: é intencional, o vermelho que some sozinho ensina a esquecer a conferência.
// A mesma lista, para quem lê sem abrir o código: .superpowers/sdd/a5/conferencias-com-data.md.
export interface Conferencia {
  id: string
  etapa: string
  /** Dia de São Paulo (AAAA-MM-DD) em que a conferência é devida. Vence no dia seguinte. */
  data: string
  responsavel: 'agente' | 'dono'
  /** Onde está a consulta e o que se espera. */
  onde: string
  /** Dia em que foi feita (AAAA-MM-DD). null = por fazer. */
  feitaEm: string | null
  /** Reaberta por decisão do dono: o vencimento conta deste dia, não de `data` (que segue sendo a do plano). */
  reabertaEm?: string
}

/** Decisão do controlador (12/10/2026): até 7 dias de atraso só o resumo; com 8 dias ou mais o cron fica vermelho. */
export const DIAS_ATE_O_VERMELHO = 7

const PLANO_E12 = 'docs/superpowers/plans/2026-10-12-a5-e12-relatorios-em-lote-plan.md, Tarefa 8 (consultas A a D); anotar o resultado em .superpowers/sdd/a5/e12-ledger.md'
const PLANO_E19 = 'docs/superpowers/plans/2026-10-12-a5-e19-leitura-do-pipeline-plan.md, Tarefas 8 a 10'
const PLANO_E20 = 'docs/superpowers/plans/2026-10-12-a5-e20-guarda-do-bruto-plan.md, "Conferências depois do envio"'

const PLANO_E7 = 'docs/superpowers/plans/2026-10-13-a5-e7-cowork-plan.md, Tarefa 9 (conferências e7-l1-d7 e e7-l2-d7)'

// E1 e E2 (coleta dos concorrentes, lote de 12/10/2026): as datas dependem do dia do envio, que ainda não existe.
// O controlador preenche `E1_E2_DEPLOY` (dia de São Paulo, AAAA-MM-DD, o da promoção para `main`) no commit do envio.
// Enquanto for `null`, as seis entradas NÃO existem (nada vence, nada deixa o cron vermelho). As entradas usam a etapa `E1`
// (o formato `E<n>` do guardião); o plano e o parecer de dados do portão final chamam o conjunto de "E1 e E2".
/** Dia de São Paulo (AAAA-MM-DD) em que o lote E1 e E2 foi promovido a `main`. `null` = ainda não enviado. */
export const E1_E2_DEPLOY: string | null = '2026-10-13'

const PLANO_E1E2 = 'docs/superpowers/plans/2026-10-12-a5-e1-e2-coleta-concorrentes-plan.md, seção 10 (consultas K1 a K17 e R1); parecer .superpowers/sdd/a5-e1-e2/portao-final-dados.md, item 10'
const dataReal = (d: string): boolean => {
  const t = Date.parse(`${d}T00:00:00.000Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d
}
const somaDias = (dia: string, n: number): string => new Date(Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)) + n)).toISOString().slice(0, 10)

/**
 * As conferências de E1 e E2 a partir do dia do envio. `null` = sem entradas. Data malformada não some em silêncio:
 * vira uma entrada de 1970 (vermelha) que manda corrigir a constante.
 */
export function conferenciasE1E2(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e1e2-deploy-invalido', etapa: 'E1', data: '1970-01-01', responsavel: 'agente', onde: `E1_E2_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  // `feitaEm` só vale para o envio REAL (13/10/2026): a e1e2-d0 foi conferida às 19:45 desse dia (D0 do Lote 1 verde, ledger a5-e1-e2).
  const e = (id: string, mais: number, onde: string, feitaEm: string | null = null): Conferencia => ({ id: `e1e2-${id}`, etapa: 'E1', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E1E2}: ${onde}`, feitaEm: deploy === '2026-10-13' ? feitaEm : null })
  return [
    e('d0', 0, 'D0, depois das 19:10 de SP: select count(*) from competitor_raw (esperado 690 ou mais); K5 com as 9 e as 13 chaves, vermelhas em 0; K9 e K17: nenhum "(sem faixa)", cerca de 676 na faixa diária e 714 na semanal; completa_hoje em todos os canais; K16 (correntes_sem_copia) = 0; K12: tempo por canal (base 16 s; acima de 30 s, refazer a conta do disparo); K3: uma linha de cota', '2026-10-13'),
    e('d1', 1, 'D+1, depois das 12:45: K5; K6 (fechadas abaixo de 2% das correntes; se passar há campo volátil no raw: abrir conserto no mesmo dia); K7; K3 (cota do dia do Pacífico fechado entre 195 e 215); K16 = 0; K11'),
    e('d3', 3, 'D+3: K8 vazia (8 leituras ou mais por vídeo novo); K6 abaixo de 5%; K13; decidir I-7 (partes gratuitas da API não pedidas) com o raw estável em dias'),
    e('d7', 7, 'D+7, depois das 19:10: K5; K16; select count(*) from competitor_videos where daily_until >= current_date; todo semanal com ponto; videos_sem_versao_de_miniatura só de ausentes e sem contagem'),
    e('d8', 8, 'D+8, depois das 19:10: K5 (semanal_atrasados = 0); K11; R1 com o mesmo corte de antes do deploy (igual ao de antes); tamanho real das tabelas contra a tabela do parecer'),
    e('d9', 9, 'D+9: K5 (semanal_atrasados_9d = 0 e sem_miniatura_9d = 0); K16 (correntes_sem_copia = 0)'),
  ]
}

// E8 (coleta da curva de retenção, lote E8-coleta): as datas dependem do dia da promoção a `main` (R), que ainda não existe.
// O controlador preenche `E8_COLETA_DEPLOY` (dia de São Paulo, AAAA-MM-DD) no commit do envio. Enquanto for `null`, as quatro
// entradas NÃO existem (nada vence, nada deixa o cron vermelho). Etapa `E8` (o formato `E<n>` do guardião).
/** Dia de São Paulo (AAAA-MM-DD) em que o lote E8-coleta foi promovido a `main`. `null` = ainda não enviado. */
export const E8_COLETA_DEPLOY: string | null = '2026-10-14'

const PLANO_E8 = 'docs/superpowers/plans/2026-10-12-a5-e6-e8-dieta-e-retencao-plan.md (Tarefa 11a; consultas K6 e K7 do apêndice); anotar o resultado em .superpowers/sdd/a5-e6-e8/progress.md'

/**
 * As conferências da coleta da retenção a partir do dia do envio (R). `null` = sem entradas. Data malformada não some em
 * silêncio: vira uma entrada de 1970 (vermelha) que manda corrigir a constante. Em ordem de data.
 */
export function conferenciasE8Coleta(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e8-coleta-deploy-invalido', etapa: 'E8', data: '1970-01-01', responsavel: 'agente', onde: `E8_COLETA_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e8-${id}`, etapa: 'E8', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E8}: ${onde}`, feitaEm: null })
  return [
    e('primeira-execucao', 1, 'R + 1: o resumo do primeiro cron depois do envio: resumo.retencao (gravados, vazios, chamadas, adiados_pela_leva, sem_resposta_do_youtube), ms_passos.retencao, quantas leituras vieram vazias e quantas com curva'),
    e('tres-dias', 3, 'R + 3: a consulta K7 em três dias seguidos (uma linha de curva por vídeo lido, nenhuma tentativa sem resposta repetida), e falhas do cron sem nota de retenção'),
    e('tempo-real', 3, 'R + 3: resumo.ms das 3 primeiras execuções, inclusive ms.cauda, e a duração da invocação no painel da Vercel; o maior total passando de 250 s manda cortar os prazos dos três critérios para 2 s, 2 s e 1 s e o teto de fim da retenção para 10 s antes do envio do lote seguinte (plano, seção 5, "Orçamento da cauda")'),
    e('primeira-leva', 8, 'R + 8: a consulta K6: a primeira leva terminou (todo vídeo com diário em dia foi tentado ao menos uma vez) e o critério da retenção nunca ficou vermelho'),
  ]
}

// E6 P2 (dieta do diário do canal próprio: o diário guarda só dia com atividade e a cobertura diz o que foi medido): as datas dependem do dia
// da promoção a `main` (D), que ainda não existe. O controlador preenche `E6_P2_DEPLOY` (dia de São Paulo, AAAA-MM-DD) no commit do envio
// (Tarefa 15). D é o dia em que o deploy fica PRONTO antes do cron das 12:00 UTC: a primeira execução da dieta é a de D; se o deploy não
// ficou pronto a tempo, D é o dia seguinte e a constante muda (portão de dados do release 1, I1). Enquanto for `null`, as três entradas NÃO
// existem (nada vence, nada deixa o cron vermelho). Etapa `E6` (o formato `E<n>` do guardião).
/** Dia de São Paulo (AAAA-MM-DD) em que o lote E6-P2 foi promovido a `main`. `null` = ainda não enviado. */
export const E6_P2_DEPLOY: string | null = '2026-10-14'

const PLANO_E6P2 = 'docs/superpowers/plans/2026-10-12-a5-e6-e8-dieta-e-retencao-plan.md (Tarefas 11b e 15; consultas K1 a K8 da seção 11); parecer .superpowers/sdd/a5/r1-portao-dados.md (I1, I2, D-1 e P-2); anotar o resultado em .superpowers/sdd/a5-e6-e8/progress.md'

/**
 * As conferências da dieta do diário a partir do dia do envio (D). `null` = sem entradas. Data malformada não some em silêncio:
 * vira uma entrada de 1970 (vermelha) que manda corrigir a constante. Em ordem de data.
 */
export function conferenciasE6P2(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e6-p2-deploy-invalido', etapa: 'E6', data: '1970-01-01', responsavel: 'agente', onde: `E6_P2_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e6-${id}`, etapa: 'E6', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E6P2}: ${onde}`, feitaEm: null })
  return [
    e('p2-primeira-execucao', 0, 'D, depois do cron das 12:00 UTC, na linha dessa execução (a consulta D-1 do parecer; "order by ran_at desc limit 1" só serve antes do cron seguinte): `resumo.diario.apagadas` = N0, o número medido pela consulta P-2 ANTES do push e anotado no ledger (teto: 7 × 35 = 245 menos as linhas com atividade nos 7 dias já gravados), com tolerância de até 5 por revisão do YouTube; `intervalos` = 70; `com_buraco` = 0; `ok` = 36; `falhas` sem `schema_ausente`; consultas K2 a K5 e K8. `apagadas` = 0 com N0 > 0 no PRIMEIRO dia é reprovação (a dieta não apaga, e o desfecho `ok` esconde isso); `apagadas` ausente do resumo = rodou o código antigo (o deploy não ficou pronto): não é reprovação, D passa a ser o dia seguinte e `E6_P2_DEPLOY` muda. Do segundo dia em diante `apagadas` = 0 é o normal (o dia novo nasce sem linha): só esta conferência distingue a dieta funcionando da que não apaga'),
    e('retrato', 0, 'D, à tarde: o retrato "depois" (K1, o MESMO corte do "antes") comparado com o "antes" pela regra de três partes da Tarefa 15 (a: `medido` igual em todo par vídeo-dia; b: `views` igual em todo par anterior a `J`; c: `views` diferente de `J` em diante só como revisão do YouTube, listada uma a uma no ledger; mais de 5 diferenças ou um dia que foi de views maior que zero a zero para a conferência). "Igual" não é o critério; "é só o dia novo" não é explicação'),
    e('p2-tres-execucoes', 2, 'D + 2, depois do cron das 12:00 UTC: as três primeiras execuções (D, D + 1 e D + 2): K3 = 0, K5 em dia e K8 = 0 nos três dias; `apagadas` = 0 (até 5 por revisão) da segunda em diante; `max(covered_to)` anda um dia por execução. É o que libera a P3 (a MG15)'),
  ]
}

// A5 E6 P4 e E18 parte 2 (plano 2026-10-13-a5-e6-p4-e-e18-parte-2-dieta-final, seção 7): três marcos, cada um com a sua constante, todas
// `null` até o controlador preenchê-las no commit do dia (Tarefas 13, 14 e 15). Enquanto for `null`, as entradas NÃO existem (nada vence,
// nada deixa o cron vermelho). Os ids não colidem com os de `e6-p3-` nem com `e8-`.
/** Dia de São Paulo (AAAA-MM-DD) em que o código da cobertura de metadados foi promovido a `main` (a MG17a já estava aplicada). `null` = ainda não. */
export const E18P2_COBERTURA_DEPLOY: string | null = '2026-10-16'
/** Dia de São Paulo (AAAA-MM-DD) em que o dono aplicou a MG16 (soltar o backup do diário). `null` = ainda não aplicada. */
export const E6_P4_APLICADA: string | null = null
/** Dia de São Paulo (AAAA-MM-DD) em que o dono aplicou a MG17 (a dieta de yt_own_video_meta_daily). `null` = ainda não aplicada. */
export const E18P2_APLICADA: string | null = null

const PLANO_P4 = 'docs/superpowers/plans/2026-10-13-a5-e6-p4-e-e18-parte-2-dieta-final-plan.md'

/** As conferências da cobertura de metadados a partir do dia do código (D). `null` = sem entradas; data malformada vira entrada de 1970 (vermelha). */
export function conferenciasE18P2Cobertura(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e18p2-cob-deploy-invalido', etapa: 'E18', data: '1970-01-01', responsavel: 'agente', onde: `E18P2_COBERTURA_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção do código a main) ou null`, feitaEm: null }]
  }
  // `feitaEm` só vale para a promoção REAL (16/10/2026): d0 e d1 conferidas em 21/10 pelas execuções de 17 e 18/10 (cobertura ok = canais = 1, descobertas 0,
  // cobertos_sem_linha 0, metadados 15,0 e 16,1 s); d7 e d14 ficam por fazer (houve a nota `metadados:` de 20/10).
  const e = (id: string, mais: number, onde: string, feitaEm: string | null = null): Conferencia => ({ id: `e18p2-cob-${id}`, etapa: 'E18', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_P4} (seção 7 e seção 11); anotar o resultado em .superpowers/sdd/a5-e18p2/progress.md: ${onde}`, feitaEm: deploy === '2026-10-16' ? feitaEm : null })
  return [
    e('d0', 0, 'D: VA1 a VA4 no ledger; `resumo.metadados.cobertura` da primeira execução com `ok` = `canais` e `descobertas` 0', '2026-10-21'),
    e('d1', 1, 'D + 1: segunda execução igual; `ms_passos.metadados` sem salto (anotar); `resumo.versoes.cobertos_sem_linha` 0', '2026-10-21'),
    e('d7', 7, 'D + 7: CP13 em 0; K1 em 0; nenhuma nota `metadados:` nova'),
    e('d14', 14, 'D + 14: CP14: é o gatilho do portão D (junto do D + 14 do plano E18)'),
  ]
}

/** As conferências de depois de soltar o backup do diário (MG16), a partir do dia da aplicação (D). */
export function conferenciasE6P4(aplicada: string | null): Conferencia[] {
  if (aplicada === null) return []
  if (!dataReal(aplicada)) {
    return [{ id: 'e6-p4-aplicada-invalida', etapa: 'E6', data: '1970-01-01', responsavel: 'agente', onde: `E6_P4_APLICADA (apps/web/src/lib/conferencias.ts) está malformada: "${aplicada}". Corrigir para AAAA-MM-DD (dia de São Paulo em que o dono aplicou a MG16) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e6-p4-${id}`, etapa: 'E6', data: somaDias(aplicada, mais), responsavel: 'agente', onde: `${PLANO_P4} (seção 7 e seção 11); anotar o resultado em .superpowers/sdd/a5-e6-p4/progress.md: ${onde}`, feitaEm: null })
  return [
    e('d0', 0, 'D: AP e VP1 a VP4 no ledger; o CSV do backup com `sha256`'),
    e('d1', 1, 'D + 1: o cron rodou sem nota do diário; V6 do plano P3 (K4, K5, K8)'),
    e('d7', 7, 'D + 7: diário menor que 2 MB; o teste do item 191 verde na CI'),
  ]
}

/** As conferências de depois da dieta de metadados (MG17), a partir do dia da aplicação (D). */
export function conferenciasE18P2(aplicada: string | null): Conferencia[] {
  if (aplicada === null) return []
  if (!dataReal(aplicada)) {
    return [{ id: 'e18p2-aplicada-invalida', etapa: 'E18', data: '1970-01-01', responsavel: 'agente', onde: `E18P2_APLICADA (apps/web/src/lib/conferencias.ts) está malformada: "${aplicada}". Corrigir para AAAA-MM-DD (dia de São Paulo em que o dono aplicou a MG17) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e18p2-${id}`, etapa: 'E18', data: somaDias(aplicada, mais), responsavel: 'agente', onde: `${PLANO_P4} (seção 7 e seção 11); anotar o resultado em .superpowers/sdd/a5-e18p2/progress.md: ${onde}`, feitaEm: null })
  return [
    e('d0', 0, 'D: AD e VD1 a VD8; os dois retratos; `sha256` do CSV; tamanho antes e depois (item 202)'),
    e('d1', 1, 'D + 1: `cobertura.compactacao.feita` = canais; `compactadas` perto do número de vídeos; `sem_explicacao` 0; K2 do plano E18 em 0; `versoes.confirmadas` igual à de D − 1'),
    e('d7', 7, 'D + 7: linhas e tamanho (K4): crescimento perto de zero; K5 (a prova da leitura horária) sem vídeo "sem captura há 3 dias" que não existisse antes'),
    e('d30', 30, 'D + 30: K4 de novo; K6: dias de teste A/B guardados, se houve teste'),
  ]
}

// E6 P3 (apagar as linhas vazias do diário do canal próprio, MG15): as datas dependem do dia em que o dono APLICOU a migration (D, dia de
// São Paulo), preenchido na Tarefa 7 do plano no commit do envio. Enquanto for `null`, as quatro entradas NÃO existem (nada vence, nada
// deixa o cron vermelho). Etapa `E6` (o formato `E<n>` do guardião). Os ids começam por `e6-p3-`, distintos dos da P2.
/** Dia de São Paulo (AAAA-MM-DD) em que o dono aplicou a MG15. `null` = ainda não aplicada. */
export const E6_P3_APLICADA: string | null = '2026-10-16'

const PLANO_E6P3 = 'docs/superpowers/plans/2026-10-13-a5-e6-p3-apagar-linhas-vazias-do-diario-plan.md (seção 7 e seção 11: V1 a V7, CP4, CP6, CP8); anotar o resultado em .superpowers/sdd/a5-e6-p3/progress.md'

/**
 * As conferências de depois de apagar as linhas vazias, a partir do dia da aplicação (D). `null` = sem entradas. Data malformada não some
 * em silêncio: vira uma entrada de 1970 (vermelha) que manda corrigir a constante. Em ordem de data.
 */
export function conferenciasE6P3(aplicada: string | null): Conferencia[] {
  if (aplicada === null) return []
  if (!dataReal(aplicada)) {
    return [{ id: 'e6-p3-aplicada-invalida', etapa: 'E6', data: '1970-01-01', responsavel: 'agente', onde: `E6_P3_APLICADA (apps/web/src/lib/conferencias.ts) está malformada: "${aplicada}". Corrigir para AAAA-MM-DD (dia de São Paulo em que o dono aplicou a MG15) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e6-p3-${id}`, etapa: 'E6', data: somaDias(aplicada, mais), responsavel: 'agente', onde: `${PLANO_E6P3}: ${onde}`, feitaEm: null })
  return [
    e('d0', 0, 'D: V1 a V7 anotadas no ledger; as seis igualdades com os números do dia (item 47); diário menor que 2 MB (item 48); retrato V5 com o mesmo md5 de antes; CSV com o sha256 e a prova R1'),
    e('d1', 1, 'D + 1, depois das 12:30 UTC: a execução do cron: `resumo.diario` com `apagadas` e sem nota do diário; CP6 = 0; `t` = `t_depois` de D mais as linhas com atividade novas (nunca dezenas de milhares); V6; o dono abre a página do canal próprio e não vê "não medido" onde havia zero'),
    e('d7', 7, 'D + 7: CP8: diário ainda menor que 2 MB e o banco menor; V6; CP4 `atrasados` 0; nenhuma restauração foi necessária'),
    e('d14', 14, 'D + 14: o CSV confere com o sha256; decidir a MG16 (P4): a etapa dela pode ser planejada. Enquanto não for, o backup ocupa o espaço dele'),
  ]
}

// E14 (comentários de destaque dos vídeos de concorrentes): as datas dependem do dia da promoção a `main` (D), que ainda não existe.
// O controlador preenche `E14_DEPLOY` (dia de São Paulo, AAAA-MM-DD) no commit do envio. Enquanto for `null`, as quatro entradas
// NÃO existem (nada vence, nada deixa o cron vermelho). Etapa `E14` (o formato `E<n>` do guardião).
/** Dia de São Paulo (AAAA-MM-DD) em que a E14 foi promovida a `main`. `null` = ainda não enviada. */
export const E14_DEPLOY: string | null = '2026-10-15'

const PLANO_E14 = 'docs/superpowers/plans/2026-10-12-a5-e14-comentarios-plan.md (seção 11, V5 a V8; Tarefa 12); anotar o resultado em .superpowers/sdd/a5-e14/progress.md'

/**
 * As conferências dos comentários de destaque a partir do dia do envio (D). `null` = sem entradas. Data malformada não some em
 * silêncio: vira uma entrada de 1970 (vermelha) que manda corrigir a constante. Em ordem de data.
 */
export function conferenciasE14(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e14-deploy-invalido', etapa: 'E14', data: '1970-01-01', responsavel: 'agente', onde: `E14_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e14-${id}`, etapa: 'E14', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E14}: ${onde}`, feitaEm: null })
  return [
    e('d1', 1, 'D+1: V5, V6, V8 da seção 11 e o V7 da F2 (.superpowers/sdd/a5/phil-x3-e14-27-10.md, seção 1, item 2: esperado 0,0,0,0,0; o V7 da seção 11 é da fase 1 e foi superado em 17/10); `comentarios` em youtube_quota_usage.operations contra a soma de `units_used` dos retratos do dia (reconciliação); a primeira execução no retorno do cron; o primeiro dia teve o número de retratos que a resposta à pergunta 1 manda (cerca de 49 ou cerca de 12); select error_reason, count(*) from competitor_video_comment_snaps where status = \'erro\' group by 1. Se COMMENT_SINCE foi null, comparar o primeiro dia contra os 49: os perdidos de antes da primeira coleta não entram em retratos_perdidos_7d (dívida D-M5) e esta conferência fecha o buraco'),
    e('d7', 7, 'D+7: tamanho das quatro tabelas e unidades por canal e dia, contra 1,3 a 1,9 MB por canal por ano e 2,16 (itens 122 e 149; diferença acima de 30% corrige 9.5 e 9.6 do spec); quantos retratos ficaram em `proibido`. Com 3 ou mais vídeos presos em `proibido` ao mesmo tempo o cron fica vermelho (Tarefa 10, teste 10): se for recorrente e legítimo, a regra dos três presos é revista e `proibido` passa a ser aceito como preso; se for zero, MOTIVOS_PERDA_ACEITA pode esvaziar. Até esta conferência, o vermelho de código erros_presos cujo motivo mais comum é `proibido` é esperado; qualquer outro código vermelho é defeito'),
    e('d29', 29, 'D+29: a primeira anulação: `apagadas > 0` na linha de anular_identidade do dia, e V6 = 0, 0, 0'),
    e('d31', 31, 'D+31: identidade em comentário com author_purged_at = 0; comentários com missing_since existem; retratos_perdidos_7d e perdidos_por_motivo'),
  ]
}

// E10 (arquivo, pausa e sinal de limite do banco): as datas dependem do dia da promoção a `main` (D). O controlador preenche `E10_DEPLOY` (dia de
// São Paulo, AAAA-MM-DD) no commit do envio. Enquanto for `null`, as entradas NÃO existem (nada vence, nada deixa o cron vermelho). Etapa `E10`.
/** Dia de São Paulo (AAAA-MM-DD) em que a E10 foi promovida a `main`. `null` = ainda não enviada. */
export const E10_DEPLOY: string | null = '2026-10-14'

const PLANO_E10 = 'docs/superpowers/plans/2026-10-13-a5-e10-export-pausa-e-sinal-de-limite-plan.md (Tarefa 14); runbook docs/ops/observatorio-arquivo-runbook.md; anotar o resultado em .superpowers/sdd/a5-e10/progress.md'

/**
 * As conferências da E10 a partir do dia do envio (D). `null` = sem entradas. Data malformada não some em silêncio: vira uma entrada de 1970
 * (vermelha) que manda corrigir a constante. `e10-cms-1` e `e10-miniaturas` não têm data própria (dependem da 1ª remoção): ficam em D e D+3 e se
 * adiam por quem as fizer, preenchendo `feitaEm` só quando feitas. Em ordem de data.
 */
export function conferenciasE10(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e10-deploy-invalido', etapa: 'E10', data: '1970-01-01', responsavel: 'agente', onde: `E10_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string, responsavel: Conferencia['responsavel'] = 'agente'): Conferencia => ({ id: `e10-${id}`, etapa: 'E10', data: somaDias(deploy, mais), responsavel, onde: `${PLANO_E10}: ${onde}`, feitaEm: null })
  return [
    e('i4', 0, 'D, ANTES do 1º `pausar` (portão I-4): `git fetch origin && git grep -q "collection_paused_at == null" origin/main -- apps/web/src/lib/youtube/competitor-sync-batch.ts && git grep -q "fora_pausado" origin/main -- apps/web/src/lib/youtube/horaria/executar.ts && echo ok` devolve `ok` (confere o CONTEÚDO do código da pausa em main, T4a e T4b; não o SHA, que muda na cópia do envio). O código antigo não respeita a pausa; nenhum canal é pausado antes disto'),
    e('d0', 0, 'D, depois da promoção, só leitura, 4 leituras: (1) o 1º disparo de concorrentes depois do deploy: sem "migration MG6", `fora_pausado: 0` no `detalhe` da horária, `nota_pausa` ausente, campo `banco` presente, tarefa `tamanho_do_banco` com `ok` (se o deploy foi depois das 05:00 de SP); (2) `select count(*), max(day) from public.obs_db_size_daily;` dá 1 e hoje; (3) `select count(*) from public.competitor_collection_pauses;` dá 0 (V5); (4) `select db_bytes, competitor_bytes, own_bytes from public.obs_db_size_daily order by day desc limit 1;` comparado com os 170,7 MB de 12/10 (diferença acima de 30% refaz a OP-9) e com o painel do Supabase (C2); anotar as 10 maiores de `top_relations`'),
    e('cms-1', 0, 'ANTES da 1ª remoção pelo botão do CMS, em produção, leitura: `explain (analyze, buffers) select count(*) from public.obs_archive_channel_counts(\'<uuid do maior canal>\');` MENOR que 1,5 s = o CMS serve; acima = remover só pelo comando e o runbook diz isso. A 1ª remoção, por qualquer caminho, é cronometrada e anotada na seção 10 do runbook'),
    e('d1', 1, 'D+1: `select count(*), max(day) from obs_db_size_daily` = 2 e hoje; a tarefa `tamanho_do_banco` com `ok` duas vezes em `competitor_agenda_runs`; o vigia mostra `tamanho_do_banco` em dia; nenhum e-mail de banco (salvo acima de 70% do limite); V5 = 0'),
    e('miniaturas', 3, 'D+3 (ou até 3 dias depois da 1ª remoção, o que vier depois): `select batch, cardinality(blob_urls_pending) from public.obs_archive_batches where table_name=\'competitor_channels\' and deleted_at is not null;` dá 0 em até ceil(N/200) dias; `detalhe.miniaturas_apagadas` da tarefa diária bate com o número de URLs pendentes do lote. Sem nenhuma remoção até esta data: anotar "sem remoção" e adiar'),
    e('d7', 7, 'D+7: 8 linhas em `obs_db_size_daily`, sem dia faltando; crescimento médio por dia contra a estimativa (com 13 a 15 canais, cerca de 0,6 MB por dia: ESTIMATIVA); as relações que mais cresceram entre `top_relations` de D e de D+7, para fechar "de onde vêm os 20 MB por ano do site"'),
    e('d14', 14, 'D+14: a projeção deixou de ser "não medida"; anotar a data de chegada ao limite que o sinal diz'),
    e('ensaio', 14, 'D+14, responsável o dono: o ensaio do item 82 (pausar, exportar, conferir, confirmar no NAS, remover por um canal de teste) feito e anotado no runbook', 'dono'),
    e('d28', 28, 'D+28: a reta usa a janela inteira de medidas; a tabela da OP-9 do runbook é refeita com ela'),
  ]
}


// E5a leva 1 (tela 16 Canais e conta da aba Mudanças): as datas D0 e D+7 dependem do dia da promoção a `main` (D), que ainda não existe
// (depende do portão de T0b a T4 e da frente do A/B). O controlador preenche `E5A_DEPLOY` (dia de São Paulo, AAAA-MM-DD) no commit da
// promoção. Enquanto for `null`, as quatro entradas NÃO existem (nada vence, nada deixa o cron vermelho). Etapa `E5` (formato `E<n>`).
// As de Outliers, Comparar, Insights e Histórico nascem com a leva de cada tela, não aqui.
/** Dia de São Paulo (AAAA-MM-DD) em que a E5a leva 1 foi promovida a `main`. `null` = ainda não enviada. */
export const E5A_DEPLOY: string | null = '2026-10-14'

const PLANO_E5A = 'docs/superpowers/plans/2026-10-13-a5-e5a-telas-dos-concorrentes-plan.md (seção 11 e Tarefa 13); anotar o resultado em .superpowers/sdd/a5/progress.md'

/** Dia fixo (SP) em que some o aviso de contagem da lista de Canais: 18/10 é o último dia com os 28 dias anteriores a incluir a mudança de 24/08; vence no dia 20. */
const E5A_AVISO_CONTAGEM = '2026-10-19'
/** Dia fixo (SP) a partir do qual "em queda" ganha número: 14/12/2026. */
const E5A_EM_QUEDA = '2026-12-14'

/**
 * As conferências da E5a leva 1 a partir do dia do envio (D). `null` = sem entradas. Data malformada não some em silêncio: vira uma entrada
 * de 1970 (vermelha) que manda corrigir a constante. `e5a-aviso-contagem` e `e5a-em-queda` têm data fixa de calendário (depois das 12 h SP),
 * mas só existem depois do envio. Em ordem de data.
 */
export function conferenciasE5A(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e5a-deploy-invalido', etapa: 'E5', data: '1970-01-01', responsavel: 'agente', onde: `E5A_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, data: string, onde: string): Conferencia => ({ id: `e5a-${id}`, etapa: 'E5', data, responsavel: 'agente', onde: `${PLANO_E5A}: ${onde}`, feitaEm: null })
  return [
    e('d0', deploy, 'D0, depois da promoção: tela Canais em produção, a 1440 e a 390, com o dono e com um usuário só de leitura: sem erro de console; nenhuma célula "não carregou"; direção medida em tantos canais quantas forem as linhas `mede = true` da consulta da seção 11 do plano; canal próprio diz o motivo e não conta como falha; aba Mudanças = contagem antiga menos as trocas de descrição de 30 dias (CP14 em produção); anotar a consulta do I2 de Phil (canais em primeira busca); nenhum Sentry `medidas-telas-canais` nem `canais-sem-retrato`'),
    e('d7', somaDias(deploy, 7), 'D+7: Sentry sem `tempo_esgotado` nem `esgotou > 0` em `medidas-telas-canais`; anotar o número de canais concorrentes (gatilho do Yannis: passar de cerca de 40 canais ou o primeiro estouro leva `PRAZO_DAS_MEDIDAS_MS` a cerca de 40 s)'),
    e('aviso-contagem', E5A_AVISO_CONTAGEM, '19/10/2026, depois das 12 h de SP (aceita o dia 20): o aviso "Até 18/10, os 28 dias anteriores incluem a mudança de contagem" sumiu da lista de Canais'),
    e('em-queda', E5A_EM_QUEDA, '14/12/2026, depois das 12 h de SP: "em queda" aparece com número e base ("medida em X de Y"), sem contorno pontilhado; com X = 0, hachura com o motivo'),
  ].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
}

// E16 e E15 (agenda de tarefas do cron `sync-youtube` e leitura horária dos vídeos novos): as datas dependem do dia da promoção a `main` (D0),
// que ainda não existe. O controlador preenche `E16_E15_DEPLOY` (dia de São Paulo, AAAA-MM-DD) no commit do envio (Tarefa 15). Enquanto for
// `null`, as oito entradas NÃO existem (nada vence, nada deixa o cron vermelho). Etapas `E16` e `E15` (o formato `E<n>` do guardião).
/** Dia de São Paulo (AAAA-MM-DD) em que a E16 e a E15 foram promovidas a `main`. `null` = ainda não enviadas. */
export const E16_E15_DEPLOY: string | null = '2026-10-13'

const PLANO_E16E15 = 'docs/superpowers/plans/2026-10-12-a5-e16-e15-parte-1-plan.md (seção 7 e Tarefa 15; consultas K1 a K10 da seção 11); anotar o resultado em .superpowers/sdd/a5-e16-e15/progress.md'

/**
 * As conferências da agenda e da captura horária a partir do dia do envio (D0). `null` = sem entradas. Data malformada não some em
 * silêncio: vira uma entrada de 1970 (vermelha) que manda corrigir a constante. Em ordem de data.
 */
export function conferenciasE16E15(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e16-e15-deploy-invalido', etapa: 'E16', data: '1970-01-01', responsavel: 'agente', onde: `E16_E15_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (etapa: 'E16' | 'E15', id: string, mais: number, onde: string): Conferencia => ({ id: `${etapa.toLowerCase()}-${id}`, etapa, data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E16E15}: ${onde}`, feitaEm: null })
  return [
    e('E16', 'd1', 1, 'D0 + 1: K2 e K3: três disparos reais com tudo devido, as cinco tarefas da agenda, sem `adiada` por `sem_tempo` (item 158); duração por tarefa; V3 (item 150); item 216 = 0; `diff` de `vercel.json` vazio; nenhum `reason` fora do formato de código (K11); se houve aviso, o e-mail chegou (perguntar ao dono). Disputa da vaga da pesada (portão, m-5): a série semanal fechou `ok` no dia (`retratos_comentarios` ou `sincronizar_canais` em `parcial` não podem tê-la deixado sem rodar; se não fechou, desempatar pela execução mais antiga no período)'),
    e('E16', 'k1', 1, 'D0 + 1: K1 depois de uma faixa das 18:00: disparos por faixa e segundos por canal. Se a faixa pediu 3 disparos ou mais, `naoTerminouVermelhoEm` de `sincronizar_canais` passa a "disparos + 2"; senão volta a 3. Mudança de uma linha em `catalogo.ts` (emenda do portão S-I10)'),
    e('E15', 'np-d3', 3, 'D0 + 3: K4: a prova horária em três dias seguidos (item 128), `videos_abaixo_do_lido = 0` e `horas_lidas_24h` de cada dia; K10: as horas distintas da curva de 72 horas de um vídeo descoberto depois do deploy (item 139, segunda frase: 60 em 72)'),
    e('E15', 'atraso-d7', 7, 'D0 + 7: K5: mediana e percentil 95 do atraso de `taken_at` sobre a hora cheia, nas 24 horas (item 220); acima de 5 minutos reabre o limiar'),
    e('E15', 'medicao-d14', 14, 'D0 + 14: item 140: K6 (zero seguido de salto por contador e por faixa de tamanho), K7 (dias de vídeo com as 24 horas limpas), duas leituras com 5 minutos de distância, duração de cada tarefa (K2). Resultado ao dono com as perguntas 17 e 20. As duas leituras são dois `curl` de `videos.list` com a chave de API passada por variável do terminal: sem token OAuth (`obterToken` e `ensureFreshToken` NÃO são chamados: gravariam o token renovado em produção), sem módulo do app, sem banco; 2 unidades de cota (emenda do portão R6)'),
    e('E16', '14-dias', 14, 'D0 + 14: K2 limpa em 14 dias: propor ao dono tirar o lote antigo e `OBS_AGENDA`'),
    e('E15', 'tamanho-d30', 30, 'D0 + 30: K8: tamanho das tabelas novas e bytes por linha, por `count(*)`, contra os 170 B medidos (item 139; emendas D-m5 e D-m6); projeção de 12 meses contra o teto do plano do Supabase (portão de dados, m7: nada do lote é apagado, fora a identidade)'),
    e('E15', 'bruto-d60', 60, 'D0 + 60: K9: `min(hour_slot)` anterior a 59 dias (item 218)'),
  ]
}

// Em ordem de data. Datas das etapas já em produção: E12 com D0 = 13/10/2026 (primeiro cron depois do deploy de 12/10);
// E19 com `avisoDesde` = 12/10/2026 (lote 1 enviado em 12/10, dia de São Paulo); E20 com o envio antes do cron de 13/10.
// Se o envio da E20 atrasar, deslocar `e20-segundo-cron` e corrigir .superpowers/sdd/a5/conferencias-com-data.md.
const PLANO_E4 = 'docs/superpowers/plans/2026-10-13-a5-e4-medidas-e-marcas-plan.md, Tarefa 12 (conferência com data); anotar o resultado em .superpowers/sdd/a5/conferencias-com-data.md'

const BASE: readonly Conferencia[] = [
  { id: 'i7-k6-d3', etapa: 'E1', data: '2026-10-19', responsavel: 'agente', onde: 'parecer .superpowers/sdd/a5-e1-e2/portao-final-dados.md I-7: K6 de novo com as partes novas; fechadas acima de 5% → tirar a parte que gira (decisão do dono 16/10)', feitaEm: null },
  { id: 'e19-d1', etapa: 'E19', data: '2026-10-13', responsavel: 'agente', onde: `${PLANO_E19}: contagem do dia 0 por chave, painel do CMS e /admin/audit sem as linhas, tamanho de audit_log (base: 204.800 bytes, 140 linhas)`, feitaEm: '2026-10-21' },
  { id: 'e20-segundo-cron', etapa: 'E20', data: '2026-10-14', responsavel: 'agente', onde: `${PLANO_E20}: resumo do segundo cron depois do envio (consulta B do runbook da coleta): guarda.blobs_guardados_antes é número, baixados_sem_bruto = 0, conferencias_vencidas = [], ms_total e ms_passos.guarda; conta exata blobs_guardados = antes + baixados + vazios`, feitaEm: null },
  { id: 'e12-d3', etapa: 'E12', data: '2026-10-16', responsavel: 'agente', onde: `${PLANO_E12}: D+3: quais dos 9 tipos novos o YouTube gera (consulta C, zero relatórios de um tipo é "não ok"), maior_lido_por_tipo contra os tetos (um tipo recusado por tamanho só tem conserto enquanto o arquivo existe na origem) e ms_passos.relatorios`, feitaEm: null },
  { id: 'e7-l1-d7', etapa: 'E7', data: '2026-10-19', responsavel: 'agente', onde: `${PLANO_E7}: a P-5 de novo (chaves e rotas da semana; anotar se forja (so leitura) leu channels ou changes e levar ao dono com a pergunta 8; zero linhas de cowork-permanent depois do veredito da E19 não quer dizer que ninguém usou) e a segunda consulta da P-2 com 7 dias de dado: máximo diário < 100 mudanças dos campos que saem e soma de 7 dias seguidos < 100; senão a continuação da leitura (4.3) abre como conserto e vai ao dono`, feitaEm: null },
  { id: 'e12-d7', etapa: 'E12', data: '2026-10-20', responsavel: 'agente', onde: `${PLANO_E12}: D+7: a mesma leitura do D+3 (acao_do_dono não notifica ninguém: esta e a do D+3 são a única vigilância de um tipo que nunca gerou); pendentes caindo 70 ou mais por dia; item 97, três execuções seguidas`, feitaEm: null },
  { id: 'e11-religar-ou-retirar', etapa: 'E11', data: '2026-10-20', responsavel: 'agente', onde: 'docs/superpowers/plans/2026-10-12-a5-e11-canal-proprio-em-tabelas-plan.md, Tarefas 13 e 14; pareceres .superpowers/sdd/a5/r1-portao-dados.md (seção 3) e r1-portao-software.md: a E11 foi a main DESLIGADA em 14/10 (YT_OWN_STEPS_OFF=dimensoes,normalizadores na Vercel). Desligada, o critério dos passos desligados deixa o cron vermelho na 8ª execução seguida (21/10, 12:00 UTC). Até 20/10: fazer o ensaio com a API real (Tarefa 13) e religar pelo commit da Tarefa 14, ou retirar a E11 do cron', feitaEm: null },
  { id: 'e19-veredito', etapa: 'E19', data: '2026-10-20', responsavel: 'agente', onde: `${PLANO_E19}: lista e veredito da janela, 7 dias medidos e um com tarefa da forja concluída; busca no Sentry (action:leitura_registro tipo:gravacao) antes`, feitaEm: '2026-10-21' },
  { id: 'e19-t0-48h', etapa: 'E19', data: '2026-10-25', responsavel: 'agente', onde: `${PLANO_E19}, Tarefa 10: T0 + 48 h do modo recusa (promovido em 23/10): zero pipeline_leitura_recusada de forja (fila), forja (so leitura) e cowork-permanent; last_used_at da fila andando; conferenciaAte vencido, a linha de controle para de ser gravada`, feitaEm: null },
  { id: 'e7-l2-d7', etapa: 'E7', data: '2026-10-21', responsavel: 'agente', onde: `${PLANO_E7}: os dois comandos do Lote 2 de novo (indisponiveis não subiu sem causa; leitura_falhou = 0); select count(*) from public.competitor_channels (só leitura) contra o gatilho de canais da Tarefa 15; select count(*) from public.competitor_field_versions: abaixo de 200.000 (esperado 6 a 10 mil), acima disso abrir o pedido de índice (site_id, first_seen_at desc) do Apêndice A; passou o gatilho, size_download acima de 80.000 ou evento e7.resposta_da_ferramenta_grande no Sentry: abrir a dívida 2 e levar ao dono`, feitaEm: null },
  { id: 'e20-tamanho-d8', etapa: 'E20', data: '2026-10-21', responsavel: 'agente', onde: `${PLANO_E20}: tamanho das duas tabelas, primeira medida (também é o D+8 da E12: fila zerada, tamanho por tipo)`, feitaEm: null },
  { id: 'e12-d9', etapa: 'E12', data: '2026-10-22', responsavel: 'agente', onde: `${PLANO_E12}: D+9: tipo que gerou histórico e parou de gerar diário (o cron deve estar vermelho: runbook da coleta, seção 10); consulta C`, feitaEm: null },
  { id: 'e19-15o-dia', etapa: 'E19', data: '2026-10-26', responsavel: 'agente', onde: `${PLANO_E19}: se a recusa não subiu, avisar o dono (o registro já está reduzido) e dizer por que a janela não fechou`, feitaEm: null },
  { id: 'e12-item95-a', etapa: 'E12', data: '2026-11-01', responsavel: 'agente', onde: `${PLANO_E12}: item 95, antes do primeiro vencimento na origem: listado_velho = 0 e vencidos_depois_do_deploy = 0 (nada vence sem baixar)`, feitaEm: null },
  { id: 'e4-dia31', etapa: 'E4', data: '2026-11-03', responsavel: 'agente', onde: `${PLANO_E4}: a consulta da Tarefa 12 (vídeos de 30 a 32 dias com ponto diário hoje), depois das 13 h de São Paulo: as duas contagens iguais em todo canal; diferentes = o teto de 200 diários cortou os da folga (olhar \`cut\`) ou a tarefa não está em produção`, feitaEm: null },
  { id: 'e12-item95-b', etapa: 'E12', data: '2026-11-08', responsavel: 'agente', onde: `${PLANO_E12}: item 95, depois do primeiro vencimento da fila atual (08/11 02:34 UTC e 10:40 UTC), a partir das 12:10 UTC: as mesmas duas consultas, esperado 0 e 0`, feitaEm: null },
  { id: 'e19-30o-dia', etapa: 'E19', data: '2026-11-11', responsavel: 'dono', onde: `${PLANO_E19}: se a janela ainda está aberta, escolher entre subir a recusa e congelar o controle (controleFechadoEm)`, feitaEm: null },
  { id: 'e20-tamanho-30d', etapa: 'E20', data: '2026-11-12', responsavel: 'agente', onde: `${PLANO_E20}: tamanho das duas tabelas, 30 dias`, feitaEm: null },
  { id: 'e12-d31', etapa: 'E12', data: '2026-11-13', responsavel: 'agente', onde: `${PLANO_E12}: D+31, depois de a origem apagar o histórico: as consultas do item 95 (0 e 0) e, nas três últimas execuções, ms_baixar ÷ (baixados + vazios) abaixo de 0,90 s (item 97; se passar, baixar MAX_DOWNLOADS)`, feitaEm: null },
  { id: 'e20-prova-90d', etapa: 'E20', data: '2027-01-09', responsavel: 'agente', onde: `${PLANO_E20}: salvos_pela_e20 > 0 (item 205)`, feitaEm: null },
  { id: 'e20-prova-180d', etapa: 'E20', data: '2027-04-09', responsavel: 'agente', onde: `${PLANO_E20}: salvos_pela_e20 maior que em janeiro`, feitaEm: null },
]

// E5a leva 2 (Referências e Inscritos, R8): as quatro conferências dependem do dia da promoção a `main` (D), que o controlador preenche em
// `E5A_RI_DEPLOY` (dia de São Paulo, AAAA-MM-DD) no commit do envio. Enquanto for `null`, as entradas NÃO existem (nada vence, nada deixa o
// cron vermelho). Etapa `E5` (formato `E<n>`); os ids começam por `e5a-ri-`, distintos dos da leva 1.
/** Dia de São Paulo (AAAA-MM-DD) em que a E5a leva 2 (Referências e Inscritos) foi promovida a `main`. `null` = ainda não enviada. */
export const E5A_RI_DEPLOY: string | null = '2026-10-15'

const PLANO_E5A_RI = 'docs/superpowers/plans/2026-10-13-a5-e5a-telas-dos-concorrentes-plan.md (Tarefa R8; consultas em .superpowers/sdd/a5-e5a/portao-plano-ri-phil.md, §7); anotar o resultado em .superpowers/sdd/a5/progress.md'

/**
 * As conferências da E5a leva 2 a partir do dia do envio (D). `null` = sem entradas. Data malformada não some em silêncio: vira uma entrada
 * de 1970 (vermelha) que manda corrigir a constante. Em ordem de data.
 */
export function conferenciasE5ARi(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e5a-ri-deploy-invalido', etapa: 'E5', data: '1970-01-01', responsavel: 'agente', onde: `E5A_RI_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e5a-ri-${id}`, etapa: 'E5', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E5A_RI}: ${onde}`, feitaEm: null })
  return [
    e('d0', 0, 'D0, CP-RI1: a tela Canais em produção com dado real; quantos canais medidos, provisórios e sem medida, por motivo (se mais da metade estiver "sem medida · dentro do arredondamento", vai ao dono como fato, não como defeito); quantos canais com janela parcial e quantos vídeos da janela com `missing_since`; e se `youtube_channels.last_synced_at` do canal próprio é atualizado dentro de 48 h (senão ele aparece "sem coleta desde" em Referências)'),
    e('d1-cortes', 1, 'D+1, CP-RI2, calibração (consulta só de leitura, `supabase db query --linked`): a razão p75/p25 dos longos de 7 a 90 dias de cada concorrente e os terços dela; se os terços caírem longe de 2 e 6, a proposta de cortes novos vai ao dono, que decide (o código não muda sem ele)'),
    e('d1-sete-dias', 1, 'D+1, CP-RI4, calibração dos 7 dias (consulta só de leitura): a razão views aos 7 dias / views aos 28 dias dos longos com série completa em `competitor_video_daily`; esperado: mediana entre 0,5 e 0,9; abaixo de 0,5 vai ao dono a proposta de subir o corte para 14 dias (o código não muda sem ele)'),
    e('d28', 28, 'D+28, CP-RI3: o canal adicionado mais recentemente passou de "menos de 28 dias" para medido no dia certo'),
  ]
}

// E5a grupo C (Comentários de destaque, Tarefa C5): as conferências dependem do dia da promoção a `main` (D) e, as duas últimas, do dia em que
// a coleta de comentários foi ligada (resposta da CP24, preenchida pelo controlador; NÃO é `E14_DEPLOY`, porque a coleta subiu desligada).
// Enquanto `E5A_COMENTARIOS_DEPLOY` for `null`, as entradas NÃO existem. Etapa `E5`; ids `e5a-comentarios-*`, distintos dos da leva 1 e 2.
/** Dia de São Paulo (AAAA-MM-DD) em que o grupo C da E5a (Comentários de destaque) foi promovido a `main`. `null` = ainda não enviado. */
export const E5A_COMENTARIOS_DEPLOY: string | null = '2026-10-17'
/** Dia de São Paulo (AAAA-MM-DD) em que a coleta de comentários foi ligada (CP24). `null` = as entradas de mais 29 e mais 31 não existem. */
export const E5A_COMENTARIOS_COLETA_LIGADA: string | null = '2026-10-15'

const PLANO_E5A_COMENTARIOS = 'docs/superpowers/plans/2026-10-13-a5-e5a-telas-dos-concorrentes-plan.md (seção 7, D0 do grupo C, e Tarefa C5); anotar o resultado em .superpowers/sdd/a5/progress.md'

/**
 * As conferências do grupo C a partir do dia do envio (D) e do dia em que a coleta foi ligada. `deploy` nulo = sem entradas. Data malformada
 * (de qualquer dos dois) não some em silêncio: vira uma entrada de 1970 (vermelha). `coletaLigada` nula: só a D0. Entrada com data anterior ao
 * envio NÃO é gerada (nasceria vencida e deixaria o cron vermelho por conferência que ninguém deixou de fazer); o esperado dela vai para a D0.
 * Em ordem de data.
 */
export function conferenciasE5AComentarios(deploy: string | null, coletaLigada: string | null = null): Conferencia[] {
  if (deploy === null) return []
  const invalida = (nome: string, v: string): Conferencia => ({ id: `e5a-comentarios-${nome}-invalido`, etapa: 'E5', data: '1970-01-01', responsavel: 'agente', onde: `${nome === 'deploy' ? 'E5A_COMENTARIOS_DEPLOY' : 'E5A_COMENTARIOS_COLETA_LIGADA'} (apps/web/src/lib/conferencias.ts) está malformada: "${v}". Corrigir para AAAA-MM-DD (dia de São Paulo) ou null`, feitaEm: null })
  if (!dataReal(deploy)) return [invalida('deploy', deploy)]
  if (coletaLigada !== null && !dataReal(coletaLigada)) return [invalida('coleta', coletaLigada)]
  const e = (id: string, data: string, onde: string): Conferencia => ({ id: `e5a-comentarios-${id}`, etapa: 'E5', data, responsavel: 'agente', onde: `${PLANO_E5A_COMENTARIOS}: ${onde}`, feitaEm: null })
  const m29 = coletaLigada === null ? null : somaDias(coletaLigada, 29)
  const m31 = coletaLigada === null ? null : somaDias(coletaLigada, 31)
  const antes29 = m29 !== null && m29 < deploy
  const antes31 = m31 !== null && m31 < deploy
  const identidade = 'identidade vencida: nenhum cartão com mais de 28 dias mostra nome ou foto, nem o do canal acompanhado; a prova do item 125 em produção dá zero'
  const trinta = 'o retrato de 30 dias e M11: a aba de 30 dias de algum vídeo com retrato, e "O criador responde" medido ou "Só N dos M vídeos têm retrato de 30 dias, e a conta pede pelo menos 5"'
  const d0Extra = `${antes29 ? ` Também nesta D0 (a entrada de mais 29 dias da coleta ligada caiu antes do envio e não foi gerada): ${identidade}.` : ''}${antes31 ? ` Também nesta D0 (a de mais 31 dias caiu antes do envio e não foi gerada): ${trinta}.` : ''}`
  const l = [
    e('d0', deploy, `D0 do grupo C: a seção num vídeo com retrato ok, num sem retrato e num com comentários desligados (se houver), com o dono, com um usuário com o direito de ver e com um só leitura, e a página de um canal; os três níveis mostram o que a seção 4.7 do spec 02 diz; curl autenticado como só leitura não acha o texto nem o nome no HTML; a foto carrega ou cai na inicial; nenhuma aba promete data com a coleta parada.${d0Extra}`),
  ]
  if (m29 !== null && !antes29) l.push(e('identidade-vencida', m29, `a coleta ligada mais 29 dias: ${identidade}`))
  if (m31 !== null && !antes31) l.push(e('retrato-30-dias', m31, `a coleta ligada mais 31 dias: ${trinta}`))
  return l.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
}

// E18 (versões do vídeo próprio): as datas dependem do dia da promoção a `main` (D). O controlador preenche `E18_DEPLOY` (dia de São Paulo,
// AAAA-MM-DD) no commit do envio, DEPOIS de a MG12 estar em produção com V1 a V5 conferidas e da Tarefa 7 commitada. Enquanto for `null`, as
// seis entradas NÃO existem (nada vence, nada deixa o cron vermelho). Etapa `E18` (formato `E<n>`).
/** Dia de São Paulo (AAAA-MM-DD) em que a E18 foi promovida a `main`. `null` = ainda não enviada. */
export const E18_DEPLOY: string | null = null

const PLANO_E18 = 'docs/superpowers/plans/2026-10-13-a5-e18-versoes-do-video-proprio-plan.md (seção 7; seção "Versões do vídeo próprio" do docs/ops/youtube-coleta-canais-proprios-runbook.md); anotar o resultado em .superpowers/sdd/a5-e18/progress.md'

/**
 * As conferências das versões do vídeo próprio a partir do dia do envio (D). `null` = sem entradas. Data malformada não some em silêncio:
 * vira uma entrada de 1970 (vermelha) que manda corrigir a constante. Em ordem de data.
 */
export function conferenciasE18(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e18-deploy-invalido', etapa: 'E18', data: '1970-01-01', responsavel: 'agente', onde: `E18_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e18-${id}`, etapa: 'E18', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E18}: ${onde}`, feitaEm: null })
  return [
    e('d0', 0, 'D0, depois do primeiro cron das 12:00 UTC: resumo.versoes em yt_own_collection_runs (dias_derivados = dias desde 07/10 por canal; abertas.linha_de_base = vídeos × 3 campos dos N canais próprios com linha diária, N contado pela consulta no dia, as outras origens = 0; atraso_dias = 0; prova.sem_explicacao = 0; ms_passos.versoes abaixo de 5.000; com sem_tempo e recuperando preenchido não é falha: anotar "em recuperação" e quem prova é o D+1); as consultas de contagem por campo e origem, de estado (N linhas, uma por canal próprio com linha diária, tracking_since 2026-10-07) e origin = \'cms\' = 0'),
    e('d1', 1, 'D+1: resumo.versoes com dias_derivados = N (um por canal próprio com linha diária, N contado pela consulta no dia), confirmadas = vídeos × 3 campos dos N canais menos os pulados, abertas = 0 ou as trocas reais do dia, ja_derivado = 0; a consulta K2 do item 200 = 0'),
    e('d3', 3, 'D+3: ms_passos.versoes das três execuções abaixo de 2.000 ms nas duas últimas, e falhas sem nota de versões'),
    e('d7', 7, 'D+7: as duas consultas da Tarefa 5 (thumbnail_blob_url distintos por vídeo desde o envio dela = 0 ou só troca do dono; tentativas kind = thumbnail só com outcome ok); se falhar, reverter a Tarefa 5'),
    e('d14', 14, 'D+14: 14 execuções seguidas com resumo.versoes presente, passo não desligado, sem nota de versões em falhas e com atraso_dias 0 em cada um dos N canais próprios (execução em recuperando não conta); itens 188 e 199 conferidos; é o gatilho da MG17 (parte 2)'),
    e('d30', 30, 'D+30: item 195, select origin, ab_event, thumb_similar, count(*) from yt_own_video_versions where origin <> \'linha_de_base\' group by 1, 2, 3; retoque em vídeo que o dono não tocou revê a regra do retoque; a K7 (título que volta ao anterior em dias vizinhos, sem evento do Lab) é o sinal do furo do risco 14'),
  ]
}

// E17 degrau 2 ("acesso direto pelo Claude Code"): três marcos, cada um com a sua constante, todas `null` até o controlador preenchê-las no commit
// do dia. Enquanto forem `null`, as entradas NÃO existem. Etapa `E17`, ids `e17d2-`. As consultas K1 a K11 estão na seção 11 do plano.
/** Dia de São Paulo (AAAA-MM-DD) em que o código do degrau 2 foi para `main`, com a variável AUSENTE (lote 2). `null` = ainda não enviado. */
export const E17_D2_DEPLOY: string | null = '2026-10-15'
/** Dia de São Paulo (AAAA-MM-DD) em que o dono abriu o acesso (A0: chave criada, variável `on`, redeploy). `null` = fechado. */
export const E17_D2_ABERTURA: string | null = null
/** Dia de São Paulo (AAAA-MM-DD) do envio do lote 3 (a tarefa de poda na agenda). `null` = ainda não enviado. */
export const E17_D2_PODA_DEPLOY: string | null = '2026-10-15'

const PLANO_E17D2 = 'docs/superpowers/plans/2026-10-13-a5-e17-degrau-2-acesso-pelo-claude-code-plan.md (seção 7 e seção 11); anotar o resultado em .superpowers/sdd/a5-e17-d2/progress.md'

/** D0, D+1 e D+7 do envio com a variável ausente. Data malformada vira entrada de 1970 (vermelha). */
export function conferenciasE17D2(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e17d2-deploy-invalido', etapa: 'E17', data: '1970-01-01', responsavel: 'agente', onde: `E17_D2_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e17d2-${id}`, etapa: 'E17', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E17D2}: ${onde}`, feitaEm: null })
  return [
    e('d0', 0, 'D0, 20 minutos depois do deploy: K1 e K6 (0 chaves do perfil; as três chaves existentes com `last_used_at` da forja da fila avançando; `expires_at` e `user_id` nulos nas três); `curl` sem chave em /api/mcp dá 401 com a frase de hoje; `OBSERVATORIO_IA_EXTERNA` ausente nos três ambientes da Vercel'),
    e('d1', 1, 'D+1: K4 e K5 (nenhuma linha de origem `mcp`; contador vazio)'),
    e('d7', 7, 'D+7: K1 e K6 (os mesmos de D0); `OBSERVATORIO_IA_EXTERNA` continua ausente na Vercel'),
  ]
}

/** A0, A0+1, A0+7 e A0+30 do dia em que o dono abriu o acesso. */
export function conferenciasE17D2Abertura(abertura: string | null): Conferencia[] {
  if (abertura === null) return []
  if (!dataReal(abertura)) {
    return [{ id: 'e17d2-abertura-invalida', etapa: 'E17', data: '1970-01-01', responsavel: 'agente', onde: `E17_D2_ABERTURA (apps/web/src/lib/conferencias.ts) está malformada: "${abertura}". Corrigir para AAAA-MM-DD (dia de São Paulo em que o dono abriu o acesso) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e17d2-${id}`, etapa: 'E17', data: somaDias(abertura, mais), responsavel: 'agente', onde: `${PLANO_E17D2}: ${onde}`, feitaEm: null })
  return [
    e('a0', 0, 'A0, 10 minutos depois da primeira consulta: K8 e K9. Esperado: sem_desfecho = 0 em toda linha; pelo menos uma linha desfecho = ok com output_chars entre 1 e 60.000 (30.000 em pacote_da_tela); output_chars nulo em toda linha cujo desfecho não é ok; e, numa consulta do dono a canal ou vídeo PRÓPRIO, a linha com included_private = true. Só linhas falhou/tempo, ou nenhuma linha ok com included_private = true depois de uma consulta ao canal próprio: VERMELHO, fechar a variável e chamar o controlador; nunca marcar feita'),
    e('a0-1', 1, 'A0+1: K8 (`limite` e `recusado` em zero ou explicados)'),
    e('a0-7', 7, "A0+7: K10 (o contador com no máximo 2 dias de linhas) e K11 (tamanho do registro e bytes por linha, contra 300 a 450). Leitura a mais, do controlador, só leitura: `select (at at time zone 'UTC')::date as dia, result, count(*) from obs_ai_access_log where at > now() - interval '7 days' group by 1, 2 order by 1`. Nenhuma linha devolvida quer dizer 'ninguém usou', não 'taxa folgada'. Linhas `limite` em mais de 2 dos dias devolvidos: levar ao dono a pergunta de subir a taxa, com a contagem; o plano não sobe o número sozinho"),
    e('a0-30', 30, 'A0+30: K11 de novo (projeção de 400 dias contra o teto do banco). Esperado: projeção de 400 dias (linhas_mcp por dia medido × 400 × bytes por linha medidos) abaixo de 50 MB e banco total abaixo de 400 MB; acima de qualquer um, levar ao dono com a conta (a volta é apagar a variável)'),
  ]
}

/** P+1 e P+7 do envio do lote 3 (a tarefa `poda_acesso_ia`): K7. */
export function conferenciasE17D2Poda(envio: string | null): Conferencia[] {
  if (envio === null) return []
  if (!dataReal(envio)) {
    return [{ id: 'e17d2-poda-deploy-invalido', etapa: 'E17', data: '1970-01-01', responsavel: 'agente', onde: `E17_D2_PODA_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${envio}". Corrigir para AAAA-MM-DD (dia de São Paulo do envio da poda) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e17d2-${id}`, etapa: 'E17', data: somaDias(envio, mais), responsavel: 'agente', onde: `${PLANO_E17D2}: ${onde}`, feitaEm: null })
  return [
    e('poda-p1', 1, 'P+1: K7 (a primeira execução de `poda_acesso_ia` com `ok` e os dois totais). Nenhuma linha = a tarefa não rodou: parar e avisar, nunca "nada a podar"'),
    e('poda-p7', 7, 'P+7: K7 (7 execuções da poda sem vermelho)'),
  ]
}

// A5 X3 (coleta de playlists e seções dos concorrentes): as datas dependem do dia em que o dono LIGA a coleta (`OBS_X3_PLAYLISTS=on` na Vercel + redeploy,
// depois da migration aplicada). `X3_LIGADA` é preenchida no commit desse dia; enquanto for `null`, as entradas NÃO existem. A X3 não tem número `E<n>`:
// a etapa é `E21` só porque o guardião exige o formato (ids `x3-`); `E21` está RESERVADA à X3 e nenhuma etapa da A5 pode usá-la (Yannis M-6). As consultas estão na seção 11 do plano; a C1 ampliada (tamanho) é a da x3-d1.
/** Dia de São Paulo (AAAA-MM-DD) em que a coleta de playlists foi ligada. `null` = ainda desligada. */
export const X3_LIGADA: string | null = '2026-10-18' // variável ligada em 17/10 à noite; a 1ª rodada (07:00 de São Paulo) é a de 18/10

const PLANO_X3 = 'docs/superpowers/plans/2026-10-17-a5-x3-playlists-e-secoes-plan.md (seção 11 e Tarefa 8); anotar o resultado em .superpowers/sdd/a5/x3/progress.md'

/** D+1, D+7 e D+30 de `X3_LIGADA`. Data malformada vira entrada de 1970 (vermelha). */
export function conferenciasX3(ligada: string | null): Conferencia[] {
  if (ligada === null) return []
  if (!dataReal(ligada)) {
    return [{ id: 'x3-ligada-invalida', etapa: 'E21', data: '1970-01-01', responsavel: 'agente', onde: `X3_LIGADA (apps/web/src/lib/conferencias.ts) está malformada: "${ligada}". Corrigir para AAAA-MM-DD (dia de São Paulo em que a coleta foi ligada) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `x3-${id}`, etapa: 'E21', data: somaDias(ligada, mais), responsavel: 'agente', onde: `${PLANO_X3}: ${onde}`, feitaEm: null })
  return [
    e('d1', 1, 'D+1: a consulta do §11 devolve 0 linhas (todo canal ativo tem linha em competitor_playlist_reads); a unidade do dia em competitors_playlists está entre 200 e 400; C1 ampliada (playlists e itens por canal: máximo, mediana, soma; projeção soma x 330 B até 15 MB, senão desligar e voltar ao Phil); PORTÃO DE PERDA (duro): `select items_reason, count(*) from public.competitor_playlists where missing_since is null group by 1;` com contagem_difere acima de 1% das playlists ativas = desligar (OBS_X3_PLAYLISTS=off) e voltar ao Phil; PORTÃO DA LISTA (observado, não desliga): `select last_reason, count(*) from public.competitor_playlist_reads group by 1;` com lista_com_ocultas (ou contagem_difere) em até 25% dos canais ativos e sempre os mesmos canais; canal novo no conjunto = voltar ao Phil; C3'),
    e('d7', 7, 'D+7: todo canal ativo com last_cycle_at em até 14 dias (a régua do §11/§12 do plano); canais_com_secoes > 0 (o número da C2); tamanho de competitor_playlist_items até 1,5 x a projeção da C1 (a C1 projeta só itens; as cinco tabelas são anotadas, não comparadas); nenhuma linha com reason = cota_nao_registrada; C4'),
    e('d30', 30, 'D+30: versões por playlist por mês até 1 (acima disso, rever o hash); removed_after preenchido em toda linha com removed_since, exceto a de playlist sem leitura completa anterior (items_complete_at nulo na época: nulo é honesto)'),
  ]
}

// E17 degrau 1 ("Perguntar a uma IA"): as datas dependem do dia da promoção a `main` (D). `E17_D1_DEPLOY` é preenchida no commit do
// envio que LIGA o botão (CONTEXTO_IA_RULES.ligado = true, no MESMO commit; um teste amarra as duas). `E17_D1_NUCLEO_DEPLOY` é a
// do envio do núcleo, que vai desligado e não liga nada. Enquanto forem `null`, as entradas NÃO existem. Etapa `E17`.
/** Dia de São Paulo (AAAA-MM-DD) em que o botão foi ligado em `main`. `null` = ainda desligado. */
export const E17_D1_DEPLOY: string | null = null
/** Dia de São Paulo (AAAA-MM-DD) em que o núcleo do botão (desligado) foi para `main`. `null` = ainda não enviado. */
export const E17_D1_NUCLEO_DEPLOY: string | null = null

const PLANO_E17D1 = 'docs/superpowers/plans/2026-10-13-a5-e17-degrau-1-perguntar-a-uma-ia-plan.md (seção 7); anotar o resultado em .superpowers/sdd/a5-e17-d1/'

/** As cinco conferências do botão a partir do dia em que foi ligado (D). Data malformada vira entrada de 1970 (vermelha). */
export function conferenciasE17D1(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e17d1-deploy-invalido', etapa: 'E17', data: '1970-01-01', responsavel: 'agente', onde: `E17_D1_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e17d1-${id}`, etapa: 'E17', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E17D1}: ${onde}`, feitaEm: null })
  return [
    e('d0', 0, 'D0: depois do primeiro clique do dono, `select origin, action, included_private, output_chars, result, key_id, params->>\'ambiente\' as ambiente, params->>\'piso_passou\' as piso_passou, params->>\'total\' as total, params->>\'degrau\' as degrau, at from public.obs_ai_access_log order by at desc limit 5;` uma linha por abertura, origin botao, result ok, key_id nulo, ambiente production; total em caracteres e >= output_chars, degrau ausente quando total <= 30000; ZERO linhas depois de um clique que mostrou o texto é defeito grave: reverter no mesmo dia'),
    e('ci', 0, 'no log do job de integração da CI do push que traz a MG11, o arquivo observatorio-a5-e17-d1-registro.test.ts aparece com os testes do registro RODADOS (não skipped) e verdes; se pulado, esvaziar ESPERA_A_MG11 no mesmo dia'),
    e('d1', 1, 'D+1: obs_ai_access_log com origin botao e ambiente production agrupado por action e included_private (só pacote:<tela> do registro); a contagem de linhas com `params ? \'pergunta\'` tem de ser 0 (a pergunta nunca é gravada); privado: `excluido:nao_conferido` e `excluido:leitura_falhou` investigados, `excluido:sem_direito` para o dono é defeito; Sentry sem evento do componente observatorio-contexto-ia'),
    e('d7', 7, 'D+7: mediana, maior e cortados (total > 30000) por action; piso_passou = 0 em toda action exceto `pacote:canal-proprio` (nesta, maior output_chars <= 31.500); `cortados` em mais da metade de uma tela vira item do roteiro de melhorias do mockup 22; o resultado substitui os números de exemplo da C4'),
    e('d365', 365, 'D+365: `select min(at), count(*), count(user_id) from public.obs_ai_access_log;` linha mais antiga com mais de 400 dias e sem tarefa de poda: apagar à mão com o comando do runbook (retenção de 400 dias do spec)'),
  ]
}

/** A conferência do envio do núcleo (desligado): D+1, Sentry sem evento novo nas páginas refeitas pela extração. */
export function conferenciasE17D1Nucleo(envio: string | null): Conferencia[] {
  if (envio === null) return []
  if (!dataReal(envio)) {
    return [{ id: 'e17d1-nucleo-deploy-invalido', etapa: 'E17', data: '1970-01-01', responsavel: 'agente', onde: `E17_D1_NUCLEO_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${envio}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  return [{ id: 'e17d1-nucleo-d1', etapa: 'E17', data: somaDias(envio, 1), responsavel: 'agente', onde: `${PLANO_E17D1}: Sentry sem evento novo nos sete page.tsx refeitos pela extração montar (Tarefas 8a e 8b)`, feitaEm: null }]
}

// E9 (fila "Saíram do YouTube"): as datas dependem do dia da promoção do Envio B a `main` (D). O controlador preenche `E9_DEPLOY` (dia de São Paulo,
// AAAA-MM-DD) no commit do envio, DEPOIS de o Envio A estar em `main` (conferência A1) e da MG18 estar em produção com V1 a V3 anotadas. Enquanto for
// `null`, as entradas NÃO existem (nada vence, nada deixa o cron vermelho). Etapa `E9`. As conferências por evento (`e9-primeiro-apagar`) e a condicional
// (`e9-religar-prova`, só se `OBS_PROVA_AUSENTES=off` for usado) não têm data fixa e ficam no runbook, não aqui.
/** Dia de São Paulo (AAAA-MM-DD) em que a E9 (Envio B) foi promovida a `main`. `null` = ainda não enviada. */
export const E9_DEPLOY: string | null = '2026-10-16'

const PLANO_E9 = 'docs/superpowers/plans/2026-10-13-a5-e9-fila-sairam-do-youtube-plan.md (seção 7 e Tarefa 13; consultas K1 a K7 da seção 11); runbook docs/ops/observatorio-fila-sairam-runbook.md; anotar o resultado em .superpowers/sdd/a5-e9/progress.md'

/**
 * As conferências da fila "Saíram do YouTube" a partir do dia do envio (D). `null` = sem entradas. Data malformada não some em silêncio:
 * vira uma entrada de 1970 (vermelha) que manda corrigir a constante. Em ordem de data.
 */
export function conferenciasE9(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e9-deploy-invalido', etapa: 'E9', data: '1970-01-01', responsavel: 'agente', onde: `E9_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e9-${id}`, etapa: 'E9', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E9}: ${onde}`, feitaEm: null })
  return [
    e('d0', 0, 'D, retorno do primeiro disparo do cron de concorrentes depois do deploy: o campo `prova_ausentes` PRESENTE, com as dez chaves da prova (campo ausente = a prova não está ligada naquele caminho = falha da conferência); `prova` sem problema novo; nota da prova coerente com a CP1; K1: `pisos` = vídeos ausentes; aba aberta nos dois temas; se a CP1 tinha ausente, o painel de um item real lido SEM confirmar'),
    e('d1', 1, 'D+1: K1 de novo com `ausentes_com_queda = 0`; K3: nenhum item "apagando"; nenhum erro "conferir os vídeos já apagados" em 72 disparos'),
    e('d7', 7, 'D+7: K1; K4 (ausentes por idade: quantos esperam há mais de 7 dias, número para o dono, não falha); se houve "apagar": K2 daquele item'),
    e('d30', 30, 'D+30: K1; K5 (toda linha de `competitor_removed_items` tem auditoria); CP5 de novo (a recusa foi exercida alguma vez?); CP10 de novo se a MG11 entrou'),
  ]
}


/** A lista publicada, em ordem de data (a ordenação é estável: na mesma data vale a ordem de escrita). */
// A5 E11 (canal próprio em tabelas: passos "dimensões" e "normalizadores"): dia de São Paulo da promoção a `main` (D), preenchido no commit
// do envio (Tarefa 14). Tem de diferir de `DIMENSOES_LIGADO_EM` (dia do Pacífico, e11-config.ts) em no máximo um dia. Etapa `E11`.
/** Dia de São Paulo (AAAA-MM-DD) em que o lote E11 foi promovido a `main`. `null` = ainda não enviado. */
export const E11_DEPLOY: string | null = '2026-10-16'

const PLANO_E11 = 'docs/superpowers/plans/2026-10-12-a5-e11-canal-proprio-em-tabelas-plan.md (seção 7 e seção 11, consultas C1 a C4 e V4); anotar o resultado em .superpowers/sdd/a5/'

/**
 * As conferências da E11 a partir do dia do envio (D). `null` = sem entradas. Data malformada vira entrada de 1970 (vermelha).
 */
export function conferenciasE11(deploy: string | null): Conferencia[] {
  if (deploy === null) return []
  if (!dataReal(deploy)) {
    return [{ id: 'e11-deploy-invalido', etapa: 'E11', data: '1970-01-01', responsavel: 'agente', onde: `E11_DEPLOY (apps/web/src/lib/conferencias.ts) está malformada: "${deploy}". Corrigir para AAAA-MM-DD (dia de São Paulo da promoção a main) ou null`, feitaEm: null }]
  }
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e11-${id}`, etapa: 'E11', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E11}: ${onde}`, feitaEm: null })
  return [
    e('d1', 1, 'D+1, resumo do primeiro cron: `dimensoes` e `normalizadores` presentes, `ms_passos` dos dois, `consultas`, `dias_mantidos` (dias com view cuja resposta veio sem linha e que tinham linha antiga: só vale para respostas de dias com view), `dias_em_revisao`, `codigos_fora_do_catalogo`; V4 em produção'),
    e('d5', 5, 'D+5: item 84 (fila dos dois tipos zerada, consulta C1); item 249 (C2) = 0 e 0; NP-E11 (C3) = 0'),
    e('d14', 14, 'D+14: item 92 com 14 dias de dado; a soma por origem <= diário em todo dia (C4); tamanho das três tabelas'),
    e('relatorio-refeito', 60, 'D+60: F3 de novo: apareceu relatório refeito pelo YouTube? Se sim, conferir que o `create_time` é maior e que o dia ficou com um relatório só'),
  ]
}

/**
 * Conferências já feitas, por id, com o dia da prova (registro datado com o resultado, em .superpowers/sdd/a5/conferencias-vencidas-22-10.md).
 * Fica fora dos geradores `conferenciasE*` (que seguem puros e sem `feitaEm`); só vale para o que o gerador devolve com `feitaEm` nulo.
 */
const FEITAS: Readonly<Record<string, string>> = {
  'e20-segundo-cron': '2026-10-14',
  'e1e2-d1': '2026-10-14',
  'e6-p2-primeira-execucao': '2026-10-14',
  'e6-p2-tres-execucoes': '2026-10-16',
  'e6-p3-d0': '2026-10-16',
  'e12-d3': '2026-10-16',
  'e12-d7': '2026-10-20',
  'e5a-ri-d1-cortes': '2026-10-16',
  'e11-religar-ou-retirar': '2026-10-20',
  // reabertas-27-10-resultado.md (dono, 27/10): ok
  'e6-retrato': '2026-10-27',
  'e10-d0': '2026-10-27',
  'e16-d1': '2026-10-27',
  'e16-k1': '2026-10-27',
  'e8-primeira-execucao': '2026-10-27',
  'e10-d1': '2026-10-27',
  'e1e2-d3': '2026-10-27',
  'e17d2-d1': '2026-10-27',
  'e17d2-poda-p1': '2026-10-27',
  'e6-p3-d1': '2026-10-27',
  'e8-tempo-real': '2026-10-27',
  'e11-d1': '2026-10-27',
  'e9-d1': '2026-10-27',
  'e7-l1-d7': '2026-10-27',
  'e1e2-d7': '2026-10-27',
  'e15-atraso-d7': '2026-10-27',
  'e20-tamanho-d8': '2026-10-27',
  'e10-d7': '2026-10-27',
  'e5a-d7': '2026-10-27',
  'e10-i4': '2026-10-27',
  // aceitas como histórico
  'i7-k6-d3': '2026-10-27',
  'e15-np-d3': '2026-10-27',
  'e8-tres-dias': '2026-10-27',
  // aposentadas pelo dono (e1e2-d8: o R1 aposentado; K5/K11 ok)
  'e9-d0': '2026-10-27',
  'e1e2-d8': '2026-10-27',
  'e19-15o-dia': '2026-10-26',
}

const TODAS: readonly Conferencia[] = [...BASE, ...conferenciasE1E2(E1_E2_DEPLOY), ...conferenciasE6P2(E6_P2_DEPLOY), ...conferenciasE6P3(E6_P3_APLICADA), ...conferenciasE18P2Cobertura(E18P2_COBERTURA_DEPLOY), ...conferenciasE6P4(E6_P4_APLICADA), ...conferenciasE18P2(E18P2_APLICADA), ...conferenciasE8Coleta(E8_COLETA_DEPLOY), ...conferenciasE14(E14_DEPLOY), ...conferenciasE10(E10_DEPLOY), ...conferenciasE5A(E5A_DEPLOY), ...conferenciasE5ARi(E5A_RI_DEPLOY), ...conferenciasE5AComentarios(E5A_COMENTARIOS_DEPLOY, E5A_COMENTARIOS_COLETA_LIGADA), ...conferenciasE16E15(E16_E15_DEPLOY), ...conferenciasE18(E18_DEPLOY), ...conferenciasE17D2(E17_D2_DEPLOY), ...conferenciasE17D2Abertura(E17_D2_ABERTURA), ...conferenciasE17D2Poda(E17_D2_PODA_DEPLOY), ...conferenciasE17D1(E17_D1_DEPLOY), ...conferenciasE17D1Nucleo(E17_D1_NUCLEO_DEPLOY), ...conferenciasX3(X3_LIGADA), ...conferenciasE11(E11_DEPLOY), ...conferenciasE9(E9_DEPLOY)].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
/**
 * Conferências vencidas sem prova em 22/10 (37; lista em .superpowers/sdd/a5/conferencias-vencidas-22-10.md), reabertas por
 * decisão do dono (23/10, fecho da A5): o vencimento passa a contar de REABERTAS_EM e elas saem do vermelho até lá. Quem as faz
 * é o handoff de acompanhamento da A5; com prova, o feitaEm vai em FEITAS.
 */
export const REABERTAS_EM = '2026-10-27'
export const REABERTAS: ReadonlySet<string> = new Set([
  'e6-retrato',
  'e10-i4',
  'e10-d0',
  'e10-cms-1',
  'e5a-d0',
  'e16-d1',
  'e16-k1',
  'e8-primeira-execucao',
  'e10-d1',
  'e5a-ri-d0',
  'e17d2-d0',
  'e1e2-d3',
  'e14-d1',
  'e5a-ri-d1-sete-dias',
  'e15-np-d3',
  'e17d2-d1',
  'e17d2-poda-p1',
  'e9-d0',
  'e6-p3-d1',
  'e8-tres-dias',
  'e8-tempo-real',
  'e10-miniaturas',
  'e5a-comentarios-d0',
  'e11-d1',
  'e9-d1',
  'i7-k6-d3',
  'e7-l1-d7',
  'e5a-aviso-contagem',
  'x3-d1',
  'e1e2-d7',
  'e15-atraso-d7',
  'e7-l2-d7',
  'e20-tamanho-d8',
  'e1e2-d8',
  'e10-d7',
  'e5a-d7',
  'e11-d5',
])

export const CONFERENCIAS: readonly Conferencia[] = TODAS.map(c => {
  const feitaEm = c.feitaEm ?? FEITAS[c.id] ?? null
  return feitaEm === null && REABERTAS.has(c.id) ? { ...c, feitaEm, reabertaEm: REABERTAS_EM } : { ...c, feitaEm }
})

const FMT_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
/** O dia de São Paulo (AAAA-MM-DD) do instante dado. */
export function hojeSP(agora: Date = new Date()): string {
  return FMT_SP.format(agora)
}

const emDias = (dia: string): number => Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10))) / 86_400_000

/** Dias de calendário entre a data devida e `hoje`. 0 = é hoje; 1 = venceu ontem; negativo = ainda não chegou. */
export function diasDeAtraso(hoje: string, c: Pick<Conferencia, 'data' | 'reabertaEm'>): number {
  return Math.round(emDias(hoje) - emDias(c.reabertaEm ?? c.data))
}

/** Vencida = a data já passou (o próprio dia ainda não conta) e ninguém preencheu `feitaEm`. */
export function conferenciasVencidas(hoje: string, lista: readonly Conferencia[] = CONFERENCIAS): Conferencia[] {
  return lista.filter(c => c.feitaEm === null && (c.reabertaEm ?? c.data) < hoje)
}

/** As vencidas há mais de `DIAS_ATE_O_VERMELHO` dias: as que deixam o cron vermelho. */
export function conferenciasEmFalha(hoje: string, lista: readonly Conferencia[] = CONFERENCIAS): Conferencia[] {
  return conferenciasVencidas(hoje, lista).filter(c => diasDeAtraso(hoje, c) > DIAS_ATE_O_VERMELHO)
}
