/**
 * A regra de pedir à forja (Tarefa 11d, decisão do dono em 11/10): não há limite por dia. Um pedido novo é aceito quando o dado
 * mudou desde a última leitura CONCLUÍDA do mesmo alvo: (tipo, nicho) nas leituras de nicho, (tipo, nicho, vídeo) em `leitura-video`.
 * "Dado mudou" = existe registro diário mais novo que aquele em que a leitura foi congelada (a mesma conta de `newPts` em
 * since.ts), ou o "Desde então" da própria leitura tem o que dizer (troca nova, vídeo novo, canal que ficaria fora...).
 * Falha e recusa não geram leitura: não entram na conta. Pedido ativo é outra regra (session.ts) e vem antes.
 *
 * Este sistema falha em VERDE: sem leitura do alvo, ou com leitura sem marca de registro diário, a resposta é "pode" (nunca trava o
 * dono) e o motivo vai junto (`porque`), para a tela dizer a frase certa.
 */
import type { FrozenReading, Niche } from '../types'
import { sinceStatus } from './since'
import { buildSentCtx, type SentPack } from './sent'
import { videoFreezeIdx, type ForjaCtx } from './scope'

export type Novidade =
  | { pode: true; porque: 'sem-leitura' | 'sem-marca' | 'dado-novo' }
  | { pode: false }

/** "A leitura de IA já usa o dado mais recente. Dá para pedir de novo quando houver coleta nova." `de`: "de IA", "deste vídeo"; ausente = genérica. */
export const semNovidadeText = (de?: string): string =>
  'A leitura' + (de ? ' ' + de : '') + ' já usa o dado mais recente. Dá para pedir de novo quando houver coleta nova.'
/** Leitura antiga que não diz com que dados foi escrita: pode pedir, e a frase conta o porquê. */
export const SEM_MARCA_TEXT = 'Não dá para saber com que dados a leitura anterior foi escrita; pode pedir de novo.'

const isVid = (t: string) => t === 'leitura-video'
const vidOf = (r: FrozenReading) => r.target?.video ?? null

/** A leitura mais recente do alvo (por `generatedAt`); null sem nenhuma. */
function lastReading(readings: readonly FrozenReading[], type: string, niche: Niche, video: string | null): FrozenReading | null {
  let best: FrozenReading | null = null
  for (const r of readings) {
    if (r.type !== type) continue
    if (isVid(type) ? vidOf(r) !== video : r.niche !== niche) continue
    if (!best || r.generatedAt > best.generatedAt) best = r
  }
  return best
}

/** O envio congelado com a leitura é o `SentPack` inteiro? (linha antiga e leitura de cenário guardam só a marca e o texto: sem o que comparar.) */
const temEnvio = (s: FrozenReading['sent']): boolean =>
  typeof s.text === 'string' && s.text !== '' && ['ids', 'items', 'channels', 'channelsOut'].every(k => Array.isArray(s[k]))

/** Assinatura estável do que um envio leva. As chaves saem em ordem (o jsonb do banco não guarda a ordem) e `age` fica de fora: é a idade contada de agora, muda sem o dado mudar. */
function assinatura(p: Pick<SentPack, 'text' | 'ids' | 'channels' | 'channelsOut' | 'items' | 'capped' | 'nVideos' | 'nOutliers'>): string {
  const canon = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(canon)
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, canon(v)]))
    return x
  }
  const items = p.items.map(({ age: _age, ...resto }) => resto)
  return JSON.stringify(canon({ text: p.text, ids: p.ids, channels: p.channels, channelsOut: p.channelsOut, items, capped: p.capped, nVideos: p.nVideos, nOutliers: p.nOutliers }))
}

/** O envio de agora por alvo, guardado por conjunto de dados: o painel pergunta por todo alvo visível (a conta de `buildSent` custa). */
const montadosAgora = new WeakMap<object, Map<string, string | null>>()
function assinaturaAgora(ctx: ForjaCtx, type: string, niche: Niche, video: string | null, fmt: FrozenReading['fmt']): string | null {
  const chave = [type, niche, video ?? '', fmt ?? ''].join('|')
  let m = montadosAgora.get(ctx)
  if (!m) montadosAgora.set(ctx, m = new Map())
  if (m.has(chave)) return m.get(chave)!
  let a: string | null
  try { a = assinatura(buildSentCtx(ctx, type, { niche, videoId: video, fmt: fmt ?? null })) } catch { a = null } // alvo que não se monta: sem o que comparar
  m.set(chave, a)
  return a
}

/** `readings`: as leituras que o site de fato guarda (`ds.readings`); as de cenário do gerador de teste não entram. */
export function novidadeDe(ctx: ForjaCtx, readings: readonly FrozenReading[], type: string, niche: Niche, video: string | null): Novidade {
  if (isVid(type) && !video) return { pode: true, porque: 'sem-marca' }
  // o registro diário mais novo que a tela conhece deste alvo: o que o envio congelaria agora (o do site nas leituras de nicho; no vídeo, o mínimo com o último ponto dele)
  let current: number | null | undefined = ctx.lastIdx
  if (isVid(type)) {
    const v = video ? ctx.V.get(video) : undefined
    if (!v) return { pode: true, porque: 'sem-marca' }
    current = videoFreezeIdx(ctx, v) // a mesma conta do congelamento do envio (sent.ts): um vídeo parado não fica "dado novo" para sempre
  }
  const r = lastReading(readings, type, niche, isVid(type) ? video : null)
  if (!r) return { pode: true, porque: 'sem-leitura' }
  const asOfIdx = typeof r.sent.asOfIdx === 'number' ? r.sent.asOfIdx : Number.isFinite(r.sent.asOf) ? ctx.clock.snapIdxAtOrBefore(r.sent.asOf) : Number.NaN
  if (!Number.isFinite(asOfIdx) || current == null || asOfIdx > current) return { pode: true, porque: 'sem-marca' }
  if (current > asOfIdx) return { pode: true, porque: 'dado-novo' }
  // mesmo registro diário: há novidade só se o envio que se montaria agora difere do que a leitura enviou. O texto do "Desde então" NÃO decide:
  // ele compara com o relógio (título trocado depois do registro, vídeos fora do corte de 400, troca nova de depois do registro), coisas que o envio novo
  // não leva (sent.ts congela tudo no registro diário), então um pedido novo sairia idêntico.
  if (temEnvio(r.sent)) {
    const agora = assinaturaAgora(ctx, r.type, niche, isVid(type) ? video : null, r.fmt)
    if (agora != null) return agora === assinatura(r.sent as unknown as SentPack) ? { pode: false } : { pode: true, porque: 'dado-novo' }
  }
  // leitura sem o envio congelado (linha antiga, ou o alvo não se monta mais): só o "Desde então" pode dizer que algo mudou
  // (sem a base congelada, ou vídeo fora do observatório, ele não compara, e a marca do registro diário, que existe e é igual, decide)
  return sinceStatus(ctx, r.id) === 'mudou' ? { pode: true, porque: 'dado-novo' } : { pode: false }
}
