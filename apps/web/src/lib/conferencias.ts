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
}

/** Decisão do controlador (12/10/2026): até 7 dias de atraso só o resumo; com 8 dias ou mais o cron fica vermelho. */
export const DIAS_ATE_O_VERMELHO = 7

const PLANO_E12 = 'docs/superpowers/plans/2026-10-12-a5-e12-relatorios-em-lote-plan.md, Tarefa 8 (consultas A a D); anotar o resultado em .superpowers/sdd/a5/e12-ledger.md'
const PLANO_E19 = 'docs/superpowers/plans/2026-10-12-a5-e19-leitura-do-pipeline-plan.md, Tarefas 8 a 10'
const PLANO_E20 = 'docs/superpowers/plans/2026-10-12-a5-e20-guarda-do-bruto-plan.md, "Conferências depois do envio"'

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
  const e = (id: string, mais: number, onde: string): Conferencia => ({ id: `e1e2-${id}`, etapa: 'E1', data: somaDias(deploy, mais), responsavel: 'agente', onde: `${PLANO_E1E2}: ${onde}`, feitaEm: null })
  return [
    e('d0', 0, 'D0, depois das 19:10 de SP: select count(*) from competitor_raw (esperado 690 ou mais); K5 com as 9 e as 13 chaves, vermelhas em 0; K9 e K17: nenhum "(sem faixa)", cerca de 676 na faixa diária e 714 na semanal; completa_hoje em todos os canais; K16 (correntes_sem_copia) = 0; K12: tempo por canal (base 16 s; acima de 30 s, refazer a conta do disparo); K3: uma linha de cota'),
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
export const E8_COLETA_DEPLOY: string | null = null

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

// E14 (comentários de destaque dos vídeos de concorrentes): as datas dependem do dia da promoção a `main` (D), que ainda não existe.
// O controlador preenche `E14_DEPLOY` (dia de São Paulo, AAAA-MM-DD) no commit do envio. Enquanto for `null`, as quatro entradas
// NÃO existem (nada vence, nada deixa o cron vermelho). Etapa `E14` (o formato `E<n>` do guardião).
/** Dia de São Paulo (AAAA-MM-DD) em que a E14 foi promovida a `main`. `null` = ainda não enviada. */
export const E14_DEPLOY: string | null = null

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
    e('d1', 1, 'D+1: V5 a V8 da seção 11; `comentarios` em youtube_quota_usage.operations contra a soma de `units_used` dos retratos do dia (reconciliação); a primeira execução no retorno do cron; o primeiro dia teve o número de retratos que a resposta à pergunta 1 manda (cerca de 49 ou cerca de 12); select error_reason, count(*) from competitor_video_comment_snaps where status = \'erro\' group by 1. Se COMMENT_SINCE foi null, comparar o primeiro dia contra os 49: os perdidos de antes da primeira coleta não entram em retratos_perdidos_7d (dívida D-M5) e esta conferência fecha o buraco'),
    e('d7', 7, 'D+7: tamanho das quatro tabelas e unidades por canal e dia, contra 1,3 a 1,9 MB por canal por ano e 2,16 (itens 122 e 149; diferença acima de 30% corrige 9.5 e 9.6 do spec); quantos retratos ficaram em `proibido`. Com 3 ou mais vídeos presos em `proibido` ao mesmo tempo o cron fica vermelho (Tarefa 10, teste 10): se for recorrente e legítimo, a regra dos três presos é revista e `proibido` passa a ser aceito como preso; se for zero, MOTIVOS_PERDA_ACEITA pode esvaziar. Até esta conferência, o vermelho de código erros_presos cujo motivo mais comum é `proibido` é esperado; qualquer outro código vermelho é defeito'),
    e('d29', 29, 'D+29: a primeira anulação: `apagadas > 0` na linha de anular_identidade do dia, e V6 = 0, 0, 0'),
    e('d31', 31, 'D+31: identidade em comentário com author_purged_at = 0; comentários com missing_since existem; retratos_perdidos_7d e perdidos_por_motivo'),
  ]
}

// Em ordem de data. Datas das etapas já em produção: E12 com D0 = 13/10/2026 (primeiro cron depois do deploy de 12/10);
// E19 com `avisoDesde` = 12/10/2026 (lote 1 enviado em 12/10, dia de São Paulo); E20 com o envio antes do cron de 13/10.
// Se o envio da E20 atrasar, deslocar `e20-segundo-cron` e corrigir .superpowers/sdd/a5/conferencias-com-data.md.
const BASE: readonly Conferencia[] = [
  { id: 'e19-d1', etapa: 'E19', data: '2026-10-13', responsavel: 'agente', onde: `${PLANO_E19}: contagem do dia 0 por chave, painel do CMS e /admin/audit sem as linhas, tamanho de audit_log (base: 204.800 bytes, 140 linhas)`, feitaEm: null },
  { id: 'e20-segundo-cron', etapa: 'E20', data: '2026-10-14', responsavel: 'agente', onde: `${PLANO_E20}: resumo do segundo cron depois do envio (consulta B do runbook da coleta): guarda.blobs_guardados_antes é número, baixados_sem_bruto = 0, conferencias_vencidas = [], ms_total e ms_passos.guarda; conta exata blobs_guardados = antes + baixados + vazios`, feitaEm: null },
  { id: 'e12-d3', etapa: 'E12', data: '2026-10-16', responsavel: 'agente', onde: `${PLANO_E12}: D+3: quais dos 9 tipos novos o YouTube gera (consulta C, zero relatórios de um tipo é "não ok"), maior_lido_por_tipo contra os tetos (um tipo recusado por tamanho só tem conserto enquanto o arquivo existe na origem) e ms_passos.relatorios`, feitaEm: null },
  { id: 'e12-d7', etapa: 'E12', data: '2026-10-20', responsavel: 'agente', onde: `${PLANO_E12}: D+7: a mesma leitura do D+3 (acao_do_dono não notifica ninguém: esta e a do D+3 são a única vigilância de um tipo que nunca gerou); pendentes caindo 70 ou mais por dia; item 97, três execuções seguidas`, feitaEm: null },
  { id: 'e19-veredito', etapa: 'E19', data: '2026-10-20', responsavel: 'agente', onde: `${PLANO_E19}: lista e veredito da janela, 7 dias medidos e um com tarefa da forja concluída; busca no Sentry (action:leitura_registro tipo:gravacao) antes`, feitaEm: null },
  { id: 'e20-tamanho-d8', etapa: 'E20', data: '2026-10-21', responsavel: 'agente', onde: `${PLANO_E20}: tamanho das duas tabelas, primeira medida (também é o D+8 da E12: fila zerada, tamanho por tipo)`, feitaEm: null },
  { id: 'e12-d9', etapa: 'E12', data: '2026-10-22', responsavel: 'agente', onde: `${PLANO_E12}: D+9: tipo que gerou histórico e parou de gerar diário (o cron deve estar vermelho: runbook da coleta, seção 10); consulta C`, feitaEm: null },
  { id: 'e19-15o-dia', etapa: 'E19', data: '2026-10-26', responsavel: 'agente', onde: `${PLANO_E19}: se a recusa não subiu, avisar o dono (o registro já está reduzido) e dizer por que a janela não fechou`, feitaEm: null },
  { id: 'e12-item95-a', etapa: 'E12', data: '2026-11-01', responsavel: 'agente', onde: `${PLANO_E12}: item 95, antes do primeiro vencimento na origem: listado_velho = 0 e vencidos_depois_do_deploy = 0 (nada vence sem baixar)`, feitaEm: null },
  { id: 'e12-item95-b', etapa: 'E12', data: '2026-11-08', responsavel: 'agente', onde: `${PLANO_E12}: item 95, depois do primeiro vencimento da fila atual (08/11 02:34 UTC e 10:40 UTC), a partir das 12:10 UTC: as mesmas duas consultas, esperado 0 e 0`, feitaEm: null },
  { id: 'e19-30o-dia', etapa: 'E19', data: '2026-11-11', responsavel: 'dono', onde: `${PLANO_E19}: se a janela ainda está aberta, escolher entre subir a recusa e congelar o controle (controleFechadoEm)`, feitaEm: null },
  { id: 'e20-tamanho-30d', etapa: 'E20', data: '2026-11-12', responsavel: 'agente', onde: `${PLANO_E20}: tamanho das duas tabelas, 30 dias`, feitaEm: null },
  { id: 'e12-d31', etapa: 'E12', data: '2026-11-13', responsavel: 'agente', onde: `${PLANO_E12}: D+31, depois de a origem apagar o histórico: as consultas do item 95 (0 e 0) e, nas três últimas execuções, ms_baixar ÷ (baixados + vazios) abaixo de 0,90 s (item 97; se passar, baixar MAX_DOWNLOADS)`, feitaEm: null },
  { id: 'e20-prova-90d', etapa: 'E20', data: '2027-01-09', responsavel: 'agente', onde: `${PLANO_E20}: salvos_pela_e20 > 0 (item 205)`, feitaEm: null },
  { id: 'e20-prova-180d', etapa: 'E20', data: '2027-04-09', responsavel: 'agente', onde: `${PLANO_E20}: salvos_pela_e20 maior que em janeiro`, feitaEm: null },
]

/** A lista publicada, em ordem de data (a ordenação é estável: na mesma data vale a ordem de escrita). */
export const CONFERENCIAS: readonly Conferencia[] = [...BASE, ...conferenciasE1E2(E1_E2_DEPLOY), ...conferenciasE8Coleta(E8_COLETA_DEPLOY), ...conferenciasE14(E14_DEPLOY)].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))

const FMT_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
/** O dia de São Paulo (AAAA-MM-DD) do instante dado. */
export function hojeSP(agora: Date = new Date()): string {
  return FMT_SP.format(agora)
}

const emDias = (dia: string): number => Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10))) / 86_400_000

/** Dias de calendário entre a data devida e `hoje`. 0 = é hoje; 1 = venceu ontem; negativo = ainda não chegou. */
export function diasDeAtraso(hoje: string, c: Pick<Conferencia, 'data'>): number {
  return Math.round(emDias(hoje) - emDias(c.data))
}

/** Vencida = a data já passou (o próprio dia ainda não conta) e ninguém preencheu `feitaEm`. */
export function conferenciasVencidas(hoje: string, lista: readonly Conferencia[] = CONFERENCIAS): Conferencia[] {
  return lista.filter(c => c.feitaEm === null && c.data < hoje)
}

/** As vencidas há mais de `DIAS_ATE_O_VERMELHO` dias: as que deixam o cron vermelho. */
export function conferenciasEmFalha(hoje: string, lista: readonly Conferencia[] = CONFERENCIAS): Conferencia[] {
  return conferenciasVencidas(hoje, lista).filter(c => diasDeAtraso(hoje, c) > DIAS_ATE_O_VERMELHO)
}
