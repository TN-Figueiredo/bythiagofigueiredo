/**
 * A5 · E10: o que o arquivo ainda deve ao dono, lido a cada disparo do cron: (1) tabelas com chave em cascata para o canal que o
 * export não cobre (`obs_archive_uncovered()`), (2) miniaturas de canais já removidos que continuam no Blob. As duas idas ao banco
 * rodam em paralelo, cada uma com o seu teto, e cada parte falha sozinha: uma leitura que falha é `{ porque }` (código fechado),
 * NUNCA uma lista vazia, que diria "nada pendente". Nunca lança; nenhuma mensagem do banco sai daqui.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CausaDaFalha } from '@/lib/youtube/agenda/tipos'
import { causaDoErro, TETO_LEITURA_MS } from './ler-sinal'

const NOME_DE_TABELA = /^[a-z0-9_]+$/
export const NOME_ILEGIVEL = '(nome ilegível)'
const DIA_MS = 86_400_000
/** Teto de lotes lidos: o plano prevê dezenas de canais; mais que isto é sinal de pendência esquecida, e a contagem já grita. */
const LOTES_MAX = 1_000

type Parte<T> = { valor: T } | { porque: CausaDaFalha }

export interface PendenciasDoArquivo {
  /** `obs_archive_uncovered()`; só nomes que casam com `^[a-z0-9_]+$` (o resto vira "(nome ilegível)", um por nome). */
  semExport: Parte<string[]>
  /** `obs_archive_batches` de `competitor_channels`, apagados, com `blob_urls_pending` não vazio. */
  miniaturas: Parte<{ urls: number; lotes: number; diasDaMaisAntiga: number | null }>
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

async function lerSemExport(sb: SupabaseClient): Promise<Parte<string[]>> {
  try {
    const res: { data?: unknown; error?: unknown } | null | undefined = await sb.rpc('obs_archive_uncovered').abortSignal(AbortSignal.timeout(TETO_LEITURA_MS))
    if (typeof res !== 'object' || res === null) return { porque: 'forma_invalida' }
    if (res.error) return { porque: causaDoErro(res.error) }
    if (!Array.isArray(res.data)) return { porque: 'forma_invalida' }
    return { valor: res.data.map(n => (typeof n === 'string' && NOME_DE_TABELA.test(n) ? n : NOME_ILEGIVEL)) }
  } catch (err) {
    return { porque: causaDoErro(err) }
  }
}

async function lerMiniaturas(sb: SupabaseClient, agoraMs: number): Promise<Parte<{ urls: number; lotes: number; diasDaMaisAntiga: number | null }>> {
  try {
    const res: { data?: unknown; error?: unknown } | null | undefined = await sb
      .from('obs_archive_batches')
      .select('deleted_at, blob_urls_pending')
      .eq('table_name', 'competitor_channels')
      .not('deleted_at', 'is', null)
      .not('blob_urls_pending', 'is', null)
      .limit(LOTES_MAX)
      .abortSignal(AbortSignal.timeout(TETO_LEITURA_MS))
    if (typeof res !== 'object' || res === null) return { porque: 'forma_invalida' }
    if (res.error) return { porque: causaDoErro(res.error) }
    if (!Array.isArray(res.data)) return { porque: 'forma_invalida' }
    let urls = 0
    let lotes = 0
    let maisAntiga: number | null = null
    for (const l of res.data) {
      // a consulta já exclui o lote que não foi apagado; se vier, não é miniatura de canal removido
      if (!ehObjeto(l) || l.deleted_at === null || !Array.isArray(l.blob_urls_pending) || l.blob_urls_pending.length === 0) continue
      const quando = typeof l.deleted_at === 'string' ? Date.parse(l.deleted_at) : Number.NaN
      if (!Number.isFinite(quando)) return { porque: 'forma_invalida' }
      urls += l.blob_urls_pending.length
      lotes++
      maisAntiga = maisAntiga === null ? quando : Math.min(maisAntiga, quando)
    }
    return { valor: { urls, lotes, diasDaMaisAntiga: maisAntiga === null ? null : Math.max(0, Math.floor((agoraMs - maisAntiga) / DIA_MS)) } }
  } catch (err) {
    return { porque: causaDoErro(err) }
  }
}

export async function lerPendenciasDoArquivo(sb: SupabaseClient, agoraMs: number): Promise<PendenciasDoArquivo> {
  const [semExport, miniaturas] = await Promise.all([lerSemExport(sb), lerMiniaturas(sb, agoraMs)])
  return { semExport, miniaturas }
}
