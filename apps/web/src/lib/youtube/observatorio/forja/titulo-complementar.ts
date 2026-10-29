// F4 T7: o pedido "títulos complementares" (vídeo nosso × sinal de um lugar): o que a forja recebe, a regra que o texto
// devolvido cumpre e a regra de pedir de novo. A regra de validação vive também em
// `test/fixtures/titulo-complementar-casos.json`, lido pelo Vitest e (T8) pelo `teste_obs_pacotes.py` do kit.
//
// Este sistema falha em VERDE: sem sinal aberto e sem outliers congelados no pedido NÃO se monta um pacote vazio
// (TargetUnavailableError, 422 sem nova tentativa); lista vazia de títulos não passa no validador.
import { nomeDoLugar } from '../sinais/nome-do-lugar'
import { canonicalNumberTokens, normForNumbers, normalizeNumberToken } from './numbers'
import { TargetUnavailableError, type SentPack, type SentCell } from './sent'
import type { ForjaCtx } from './scope'

export const REGRA_F4_TITULO = { k: 5, maxCaracteres: 100, titulosPassadosMaxCaracteres: 5000, outliersMax: 5 } as const
/** Início da descrição do vídeo nosso que vai à forja. */
export const DESCRICAO_MAX_CARACTERES = 300

/** Um outlier de terceiro (público) como congelado no pedido: título e números já formatados na hora de pedir. */
export interface OutlierCongelado {
  video_id: string; canal_id: string; canal: string; titulo: string; mult_vpd7: number; vpd7: number
}
/** O que o `askReading` grava em `task.sent` ao pedir (ainda sem `numbers`: o pacote é montado e congelado no 1º GET). */
export interface PedidoCongelado { subject_key: string; lugar: string; outliers: OutlierCongelado[] }

export interface AlvoTitulo {
  ownVideoId: string; signalId: string
  /** `youtube_videos.description` do vídeo nosso (lida no `readSent`); null = sem descrição. */
  descricao: string | null
  /** O que o pedido congelou; null/vazio quando o pedido é de antes disso. */
  congelado: PedidoCongelado | null
  /** O sinal como está agora (lido no `readSent`); null = fechado, expirado ou ausente. */
  sinal: { subjectKey: string; outliers: OutlierCongelado[] } | null
}

/** O que o pacote leva para o validador (snake_case: é JSON dos dois lados, o kit em Python lê o mesmo). */
export interface TituloComplementarSent {
  own_video_id: string; signal_id: string; lugar: string; titulo_alvo: string
  titulos_enviados_n: number; titulos_total: number
  /** Títulos de TODOS os canais próprios, normalizados (inclusive os que não couberam no teto de caracteres). */
  normalizados_proprios: string[]
  normalizados_outliers: string[]
  outlier_ids: string[]
}
export type SentTitulo = SentPack & { titulo_complementar: TituloComplementarSent }

/** Forma de comparar títulos: sem acento, sem caixa, sem pontuação, espaços colapsados. */
export function normTitulo(s: string): string {
  return normForNumbers(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Cada número é contado uma vez, na forma canônica do site. */
function acumula(set: Set<string>, ...textos: Array<string | null | undefined>): void {
  for (const t of textos) for (const n of canonicalNumberTokens(t)) set.add(n)
}

export function tituloComplementarPack(ctx: ForjaCtx, alvo: AlvoTitulo): SentTitulo {
  const { clock, fmt } = ctx
  const alvoV = ctx.V.get(alvo.ownVideoId)
  if (!alvoV || !ctx.CH.get(alvoV.ch)?.own) throw new TargetUnavailableError('tituloComplementarPack: unknown own video ' + alvo.ownVideoId)
  // os outliers do pedido valem; o sinal de agora só entra quando o pedido não guardou nenhum
  const congelados = alvo.congelado?.outliers ?? []
  const outliers = (congelados.length ? congelados : alvo.sinal?.outliers ?? []).slice(0, REGRA_F4_TITULO.outliersMax)
  if (!outliers.length) throw new TargetUnavailableError('tituloComplementarPack: no open signal and no frozen outliers for ' + alvo.signalId)
  const lugar = alvo.congelado?.lugar ?? nomeDoLugar(alvo.sinal?.subjectKey ?? '')

  // títulos do dono em todos os canais próprios (D3), os mais recentes primeiro, até o teto de caracteres
  const proprios = [...ctx.V.values()].filter(v => ctx.CH.get(v.ch)?.own && v.title).sort((a, b) => b.pub - a.pub)
  const enviados: string[] = []
  let usados = 0
  for (const v of proprios) {
    if (v.id === alvo.ownVideoId) continue
    if (usados + v.title.length > REGRA_F4_TITULO.titulosPassadosMaxCaracteres) break
    enviados.push(v.title); usados += v.title.length
  }
  const capped = enviados.length < proprios.filter(v => v.id !== alvo.ownVideoId).length

  const descricao = (alvo.descricao ?? '').trim().slice(0, DESCRICAO_MAX_CARACTERES)
  const items: Array<Record<string, SentCell>> = [
    { kind: KINDS_TITULO.alvo, id: alvoV.id, title: alvoV.title, description: descricao || null, lugar },
    ...enviados.map(t => ({ kind: KINDS_TITULO.dono, title: t })),
    ...outliers.map(o => ({ kind: KINDS_TITULO.outlier, id: o.video_id, channel: o.canal, title: o.titulo, mult: fmt.mult(o.mult_vpd7), viewsPerDay: fmt.num(o.vpd7) })),
  ]
  // números citáveis: múltiplos e views/dia dos outliers e os que aparecem nos títulos ENVIADOS (Y3b); a descrição fica de fora
  const nums = new Set<string>()
  for (const o of outliers) acumula(nums, fmt.mult(o.mult_vpd7), fmt.num(o.vpd7), o.titulo)
  acumula(nums, alvoV.title, ...enviados)

  const asOf = clock.snapTime(ctx.lastIdx)
  const text = 'dados enviados à forja: o vídeo “' + alvoV.title + '” (título e início da descrição), ' + enviados.length + ' de ' + (proprios.length - (proprios.some(v => v.id === alvo.ownVideoId) ? 1 : 0)) +
    ' títulos já publicados do dono e ' + outliers.length + ' títulos de outliers de ' + lugar
  const extra: TituloComplementarSent = {
    own_video_id: alvo.ownVideoId, signal_id: alvo.signalId, lugar, titulo_alvo: alvoV.title,
    titulos_enviados_n: enviados.length, titulos_total: proprios.length - (proprios.some(v => v.id === alvo.ownVideoId) ? 1 : 0),
    normalizados_proprios: proprios.map(v => normTitulo(v.title)),
    normalizados_outliers: outliers.map(o => normTitulo(o.titulo)),
    outlier_ids: outliers.map(o => o.video_id),
  }
  return {
    text, asOf, ids: [alvoV.id, ...outliers.map(o => o.video_id)], numbers: [...nums], nVideos: 1, nOutliers: outliers.length,
    channels: [...new Set(outliers.map(o => o.canal_id))], channelsOut: [], items, capped, titulo_complementar: extra,
  }
}

/** Os rótulos `kind` do pacote: contrato com o kit (que acha o alvo por eles); a fixture de casos os grava em `kinds` e os dois lados leem de lá. */
export const KINDS_TITULO = { alvo: 'vídeo nosso', dono: 'título do dono', outlier: 'outlier' } as const

export type MotivoTitulo = 'demais' | 'longo' | 'repetido' | 'numero_fora' | 'vazio'
export type ResultadoTitulo = { ok: true; itens: string[] } | { ok: false; motivo: MotivoTitulo }

const temExtra = (s: unknown): s is { titulo_complementar: Partial<TituloComplementarSent> } =>
  typeof s === 'object' && s !== null && typeof (s as { titulo_complementar?: unknown }).titulo_complementar === 'object' && (s as { titulo_complementar?: unknown }).titulo_complementar !== null
const strs = (x: unknown): string[] => Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string') : []

/** Regra do texto devolvido: ≤ 5 itens de 1 a 100 caracteres, nenhum igual a título já publicado (do dono ou de outlier), números só os do pacote. */
export function validarTitulosComplementares(sent: { numbers: readonly string[]; titulo_complementar?: unknown }, itens: readonly string[]): ResultadoTitulo {
  if (itens.length === 0) return { ok: false, motivo: 'vazio' }
  if (itens.length > REGRA_F4_TITULO.k) return { ok: false, motivo: 'demais' }
  const limpos = itens.map(i => i.trim())
  if (limpos.some(i => i === '')) return { ok: false, motivo: 'vazio' }
  if (limpos.some(i => [...i].length > REGRA_F4_TITULO.maxCaracteres)) return { ok: false, motivo: 'longo' }
  // sem o contexto do pedido "repetido" nunca dispararia (falha em verde): sem ele a regra não valida nada (C-Y7)
  if (!temExtra(sent)) return { ok: false, motivo: 'vazio' }
  const x = sent.titulo_complementar
  const passados = new Set([...strs(x.normalizados_proprios), ...strs(x.normalizados_outliers)])
  if (limpos.some(i => passados.has(normTitulo(i)))) return { ok: false, motivo: 'repetido' }
  if (new Set(limpos.map(normTitulo)).size !== limpos.length) return { ok: false, motivo: 'repetido' } // repetido dentro da própria lista (C-Y8)
  const permitidos = new Set(strs([...sent.numbers]).map(n => normalizeNumberToken(n) || n))
  if (limpos.some(i => canonicalNumberTokens(i).some(n => !permitidos.has(n)))) return { ok: false, motivo: 'numero_fora' }
  return { ok: true, itens: limpos }
}

/** Texto do motivo, para a mensagem de erro e a recusa. */
export const MOTIVO_TITULO_TEXT: Record<MotivoTitulo, string> = {
  demais: 'mais de ' + REGRA_F4_TITULO.k + ' títulos', longo: 'título com mais de ' + REGRA_F4_TITULO.maxCaracteres + ' caracteres',
  repetido: 'título igual a um já publicado', numero_fora: 'número que não está nos dados enviados', vazio: 'nenhum título (ou título vazio)',
}

/**
 * A regra de pedir de novo deste tipo: o alvo é (vídeo nosso × sinal). Há dado novo desde a última leitura do mesmo alvo quando os
 * outliers de hoje ou o título do vídeo diferem dos que a leitura recebeu. Sem leitura, ou com leitura que não diz o que recebeu: pode.
 */
export function novidadeTitulo(ultimaSent: unknown, atual: { outlierIds: readonly string[]; tituloAlvo: string }): { pode: boolean } {
  if (!temExtra(ultimaSent)) return { pode: true }
  const antes = ultimaSent.titulo_complementar
  const ids = strs(antes.outlier_ids)
  if (!ids.length || typeof antes.titulo_alvo !== 'string') return { pode: true }
  const mesmos = ids.length === atual.outlierIds.length && atual.outlierIds.every(i => ids.includes(i))
  return { pode: !(mesmos && antes.titulo_alvo === atual.tituloAlvo) }
}
