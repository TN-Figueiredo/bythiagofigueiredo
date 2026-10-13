// A5 · E14: as regras da coleta de comentários de destaque dos vídeos de concorrentes.
// Um lugar só: o banco, a coleta, a agenda e os testes leem estes números daqui.

export const COMMENT_RULES = {
  version: 1,
  target: 12, creatorMax: 4, featuredMax: 2, pool: 100, creatorRepliesMax: 3,
  featuredLookup: 20, featuredMinSubs: 100_000, featuredMinRatio: 10,
  identityDays: 28, bodyMax: 2000,
  marks: [{ mark: 1, fromH: 24, untilH: 72 }, { mark: 7, fromH: 168, untilH: 240 }, { mark: 30, fromH: 720, untilH: 888 }],
  dueFromHourSP: 13, callsMax: 60,
  startBudgetMs: 40_000, // contado do começo da TAREFA: depois disto não começa retrato
  startsByMs: 130_000, // contado de t0 (começo do disparo): depois disto a tarefa nem começa (é o `comecaAteMs` do catálogo)
  lastSnapStartsByMs: 170_000, // contado de t0: depois disto não começa retrato
  callTimeoutMs: 6_000, dbTimeoutMs: 5_000,
  checkChunk: 50, checkBlocksMax: 3,
  callsPerSnapMax: 5, // conversas + (inscritos OU contagem) + até 3 blocos de conferência por id
  dbPerSnapMax: 2, // guardados + escrita
  dbAfterLoopMax: 3, // cota (todos os sites em paralelo, uma espera) + prova do fim + 1 de folga
  retryAfterHours: 20, retryFastMinutes: 15, breakerAfter: 3, graceHours: 30, dueLimit: 200,
  stuckSameReasonRed: 3,
} as const

/** O pior retrato: as chamadas e as idas ao banco, cada uma no seu teto. Derivado dos campos acima (40.000). */
export const WORST_SNAP_MS = COMMENT_RULES.callsPerSnapMax * COMMENT_RULES.callTimeoutMs
  + COMMENT_RULES.dbPerSnapMax * COMMENT_RULES.dbTimeoutMs
/** O pior fim, contado de t0. Derivado (225.000). */
export const WORST_END_FROM_T0_MS = COMMENT_RULES.lastSnapStartsByMs + WORST_SNAP_MS
  + COMMENT_RULES.dbAfterLoopMax * COMMENT_RULES.dbTimeoutMs

/**
 * 'a_decidir' = a pergunta 1 não foi respondida nem o envio preencheu: a tarefa para em vermelho.
 * null = coletar tudo o que estiver na tolerância. ISO = só marco atingido a partir deste instante.
 */
export const COMMENT_SINCE: 'a_decidir' | null | string = 'a_decidir'

export const SIZE_BANDS = [['100k_1m', 100_000], ['1m_10m', 1_000_000], ['10m_mais', 10_000_000]] as const
export const RATIO_BANDS = [['10x_100x', 10], ['100x_1000x', 100], ['1000x_mais', 1000]] as const

/** O que pode ir a competitor_video_comment_snaps.error_reason. O banco só aceita ^[a-z0-9_]{1,40}$. */
export const MOTIVOS = ['resposta_sem_lista', 'resposta_ilegivel', 'lote_ilegivel', 'lista_vazia_com_contagem', 'contagem_ausente',
  'contagem_nao_lida', 'video_nao_encontrado', 'proibido', 'http_400', 'http_4xx', 'http_5xx', 'rede', 'tempo_esgotado'] as const

/** Falha que não é do vídeo: volta a ser devida em 15 minutos e deixa a execução vermelha. */
export const MOTIVOS_PASSAGEIROS = ['rede', 'tempo_esgotado', 'http_5xx', 'resposta_ilegivel', 'resposta_sem_lista', 'lote_ilegivel', 'contagem_nao_lida'] as const

/** Retrato perdido com este motivo não fica vermelho sozinho (vídeo só para membros). Três presos no mesmo motivo ficam (stuckSameReasonRed). */
export const MOTIVOS_PERDA_ACEITA = ['proibido'] as const

/** O que a tarefa devolve em `motivo` e o que vai para competitor_agenda_runs.reason: código, nunca texto. Em ordem de gravidade. */
export const CODIGOS_EXECUCAO = ['schema_ausente', 'prova_ilegivel', 'inicio_nao_decidido', 'identidade_vencida', 'identidade_invariante',
  'lista_de_devidos_ilegivel', 'cadastro_ilegivel', 'cota_esgotada', 'cota_nao_registrada', 'inesperado', 'falhas_passageiras', 'disjuntor',
  'consulta_de_autores_falhou', 'conferencia_falhou', 'retratos_atrasados', 'retratos_perdidos', 'erros_presos', 'banco'] as const

/**
 * O que vai em `rule_params` do retrato: os tetos, o lote, os três parâmetros de destaque e os limites das faixas.
 * Gravado com o retrato para que uma mudança de parâmetro não reescreva a leitura antiga. Só números e códigos de faixa.
 */
export function ruleParams(): {
  target: number; creator_max: number; featured_max: number; pool: number; creator_replies_max: number
  featured_lookup: number; featured_min_subs: number; featured_min_ratio: number
  body_max: number; check_chunk: number; check_blocks_max: number
  size_bands: Array<[string, number]>; ratio_bands: Array<[string, number]>
} {
  const r = COMMENT_RULES
  return {
    target: r.target, creator_max: r.creatorMax, featured_max: r.featuredMax, pool: r.pool, creator_replies_max: r.creatorRepliesMax,
    featured_lookup: r.featuredLookup, featured_min_subs: r.featuredMinSubs, featured_min_ratio: r.featuredMinRatio,
    body_max: r.bodyMax, check_chunk: r.checkChunk, check_blocks_max: r.checkBlocksMax,
    size_bands: SIZE_BANDS.map(([k, v]): [string, number] => [k, v]),
    ratio_bands: RATIO_BANDS.map(([k, v]): [string, number] => [k, v]),
  }
}
