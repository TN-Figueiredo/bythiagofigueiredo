/**
 * A5 · E10, Tarefa 11a: remover um canal de concorrente do banco online só com exportação conferida e confirmada no NAS, e apagar do Blob as
 * miniaturas dele. Quem confere tudo é a função do banco (`competitor_channel_remove_archived`, MG6); aqui ficam a tradução do erro para a
 * frase do catálogo (nunca a mensagem do banco), o apagamento das miniaturas e a nova tentativa diária das que sobraram.
 *
 * É o ÚNICO ponto do Observatório que chama `del` do Blob (linha 17 da lista fechada do que apaga). Só apaga URL sob `observatorio/thumbs/`,
 * decidido pelo CAMINHO da URL. Com `OBS_E2E=1` o Blob não é tocado (o `.env.local` do Playwright traz o token de produção): a pendência fica.
 */
import * as Sentry from '@sentry/nextjs'
import { del } from '@vercel/blob'
import type { SupabaseClient } from '@supabase/supabase-js'
import { codigoE10, FRASES_E10, type CodigoE10 } from './codigos'
import { RULES } from '../rules'

export { codigoE10, FRASES_E10 }
export type { CodigoE10 }

export const PREFIXO_DAS_MINIATURAS = 'observatorio/thumbs/'
const BLOCO = 100

export interface DepsDoBlob { apagarDoBlob?: (urls: string[]) => Promise<void> }

async function apagarDoBlobPadrao(urls: string[]): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('sem_token')
  await del(urls, { token })
}

const e2e = (): boolean => process.env.OBS_E2E === '1'
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Separa pelo caminho da URL (não por `includes`): só vale `https://host/observatorio/thumbs/...`, sem `..` nem barra codificada. */
export function soMiniaturasDoObservatorio(urls: string[]): { apagar: string[]; fora: string[] } {
  const apagar: string[] = []
  const fora: string[] = []
  for (const u of urls) {
    let ok = false
    try {
      const p = new URL(u)
      if (p.protocol === 'https:' || p.protocol === 'http:') {
        const caminho = decodeURIComponent(p.pathname)
        ok = p.pathname.startsWith('/' + PREFIXO_DAS_MINIATURAS) && !caminho.split('/').includes('..') && !/%2f/i.test(p.pathname)
      }
    } catch { ok = false }
    ;(ok ? apagar : fora).push(u)
  }
  return { apagar, fora }
}

function relatar(motivo: string, contagens: Record<string, number>): void {
  // só o motivo e contagens: nunca URL, token nem mensagem de erro
  Sentry.captureMessage(`arquivo_remover: ${motivo}`, { level: 'warning', tags: { component: 'observatorio-arquivo', motivo }, extra: contagens })
}

type Remocao =
  | { ok: true; lote: string; linhas: number; miniaturasPendentes: number; foraDoPrefixo: number }
  | { ok: false; codigo: CodigoE10; frase: string }

export async function removerCanalArquivado(
  sb: SupabaseClient,
  e: { siteId: string; canalId: string; actorId: string },
  deps: DepsDoBlob = {},
): Promise<Remocao> {
  const falha = (codigo: CodigoE10): Remocao => ({ ok: false, codigo, frase: FRASES_E10[codigo] })
  let data: unknown
  try {
    const r = await sb.rpc('competitor_channel_remove_archived', { p_site: e.siteId, p_channel: e.canalId, p_actor: e.actorId })
    if (r.error) {
      const codigo = codigoE10(r.error)
      if (codigo === 'inesperado') relatar('remocao_inesperada', {})
      return falha(codigo)
    }
    data = r.data
  } catch {
    relatar('remocao_excecao', {})
    return falha('inesperado')
  }
  if (!ehObjeto(data) || data.status !== 'removido' || typeof data.batch !== 'string') {
    relatar('resposta_invalida', {})
    return falha('inesperado')
  }
  const lote = data.batch
  const linhas = Number(data.linhas)
  const urls = Array.isArray(data.blob_urls) ? data.blob_urls.filter((u): u is string => typeof u === 'string') : []
  const { apagar, fora } = soMiniaturasDoObservatorio(urls)
  if (fora.length > 0) relatar('miniaturas_fora_do_prefixo', { fora: fora.length })
  let apagadas = 0
  if (apagar.length > 0 && !e2e()) {
    const apagarDoBlob = deps.apagarDoBlob ?? apagarDoBlobPadrao
    for (let i = 0; i < apagar.length; i += BLOCO) {
      const bloco = apagar.slice(i, i + BLOCO)
      try {
        await apagarDoBlob(bloco)
      } catch {
        relatar('blob_falhou', { restantes: apagar.length - i })
        break
      }
      apagadas += bloco.length
      try {
        const b = await sb.rpc('obs_archive_blobs_done', { p_site: e.siteId, p_batch: lote, p_channel_ref: e.canalId, p_urls: bloco })
        if (b.error) relatar('baixa_da_pendencia_falhou', { bloco: bloco.length })
      } catch {
        relatar('baixa_da_pendencia_falhou', { bloco: bloco.length })
      }
    }
  }
  return { ok: true, lote, linhas: Number.isFinite(linhas) ? linhas : 0, miniaturasPendentes: urls.length - apagadas, foraDoPrefixo: fora.length }
}

export type NovaTentativa = { apagadas: number; pendentes: number; foraDoPrefixo: number } | { porque: string }

/**
 * Nova tentativa diária das miniaturas pendentes de canais já removidos, de TODOS os sites. No máximo `o.maximo` URLs; `o.prazoMs` é o prazo
 * da tentativa inteira, contado de `o.agoraMs`. Nunca lança. Uma baixa de pendência (`obs_archive_blobs_done`) por lote.
 */
export async function retentarMiniaturasPendentes(
  sb: SupabaseClient,
  o: { agoraMs: number; maximo: number; prazoMs: number },
  deps: DepsDoBlob = {},
): Promise<NovaTentativa> {
  try {
    if (e2e()) return { porque: 'e2e' }
    if (!deps.apagarDoBlob && !process.env.BLOB_READ_WRITE_TOKEN) return { porque: 'sem_token' }
    const apagarDoBlob = deps.apagarDoBlob ?? apagarDoBlobPadrao
    const lido = await sb.from('obs_archive_batches')
      .select('site_id, batch, channel_ref, blob_urls_pending')
      .eq('table_name', 'competitor_channels')
      .not('deleted_at', 'is', null)
      .not('blob_urls_pending', 'is', null)
      .order('deleted_at', { ascending: true })
      .limit(50)
    if (lido.error) return { porque: 'leitura_falhou' }
    const lotes = (Array.isArray(lido.data) ? lido.data : []).filter(ehObjeto)
      .map(l => ({ site: String(l.site_id), batch: String(l.batch), canal: String(l.channel_ref), urls: Array.isArray(l.blob_urls_pending) ? l.blob_urls_pending.filter((u): u is string => typeof u === 'string') : [] }))
      .filter(l => l.urls.length > 0)

    const fim = o.agoraMs + o.prazoMs
    let apagadas = 0
    let pendentes = 0
    let foraDoPrefixo = 0
    let corte = false
    for (const l of lotes) {
      const { apagar, fora } = soMiniaturasDoObservatorio(l.urls)
      foraDoPrefixo += fora.length
      const baixadas: string[] = []
      for (let i = 0; i < apagar.length && !corte; i += BLOCO) {
        const folga = o.maximo - apagadas
        if (folga <= 0 || Date.now() >= fim) { corte = true; break }
        const bloco = apagar.slice(i, i + Math.min(BLOCO, folga))
        try {
          await apagarDoBlob(bloco)
        } catch {
          relatar('blob_falhou_na_nova_tentativa', { bloco: bloco.length })
          corte = true
          break
        }
        baixadas.push(...bloco)
        apagadas += bloco.length
        if (bloco.length < Math.min(BLOCO, apagar.length - i)) corte = true // o máximo do dia cortou o bloco
      }
      if (baixadas.length > 0) {
        try {
          const b = await sb.rpc('obs_archive_blobs_done', { p_site: l.site, p_batch: l.batch, p_channel_ref: l.canal, p_urls: baixadas })
          if (b.error) relatar('baixa_da_pendencia_falhou', { urls: baixadas.length })
        } catch {
          relatar('baixa_da_pendencia_falhou', { urls: baixadas.length })
        }
      }
      pendentes += l.urls.length - baixadas.length
    }
    return { apagadas, pendentes, foraDoPrefixo }
  } catch {
    return { porque: 'inesperado' }
  }
}
