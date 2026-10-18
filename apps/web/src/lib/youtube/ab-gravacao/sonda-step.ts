import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { recordCronFailure } from '@/lib/cron-health'
import { thumbUrl, dhashOf } from '../thumb-fingerprint'
import { dhashDoArquivo } from '../ab-variant-dhash'
import { lerPaginado } from '../coleta/paginar'
import type { ErroBanco } from '../coleta/schema'
import { classificarLeitura, enviadaEmDoEtag, erroDaSonda, etagUtil, horaDe, type LeituraEstado } from './sonda'

const JOB = 'ab-sonda-miniatura'
const TETO_TESTES = 5_000
const TETO_LINHAS = 20_000
const BLOCO_IN = 100
const HEAD_TIMEOUT_MS = 10_000
const GET_TIMEOUT_MS = 15_000
const BLOB_TIMEOUT_MS = 15_000
const JANELA_ULTIMA_SONDA_MS = 48 * 3_600_000

export type ResultadoSonda =
  | { status: 'ok'; testes: number; gravadas: number; falhas: number }
  | { status: 'error'; error: string; health_written: true }

type Linha = Record<string, unknown>

interface TesteAtivo { id: string; site_id: string; youtube_videos: { youtube_video_id: string } | Array<{ youtube_video_id: string }> }
interface Variante { id: string; test_id: string; thumbnail_dhash: string | null; blob_url: string | null }
interface Ciclo { test_id: string; variant_id: string }
interface SondaAnterior { test_id: string; hora: string; etag: string | null; dhash: string | null; sha16: string | null }

export interface LinhaSondaGravada {
  test_id: string
  hora: string
  site_id: string
  youtube_video_id: string
  lida_em: string
  http: number | null
  erro: string | null
  etag: string | null
  enviada_em: string | null
  sha16: string | null
  dhash: string | null
  variante_esperada: string | null
  variante_vista: string | null
  leitura_estado: LeituraEstado
  variantes_sem_referencia: number
}

class FalhaDeLeitura extends Error {}

async function ler<T>(tabela: string, teto: number, pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const r = await lerPaginado<T>((de, ate) => pagina(de, ate) as PromiseLike<{ data: T[] | null; error: ErroBanco | null }>, teto)
  if (!r.ok) throw new FalhaDeLeitura(`${tabela}: ${r.motivo}${r.detalhe ? ` (${r.detalhe})` : ''}`)
  return r.linhas
}

async function emBlocos<V, T>(valores: V[], fn: (bloco: V[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < valores.length; i += BLOCO_IN) out.push(...(await fn(valores.slice(i, i + BLOCO_IN))))
  return out
}

/** Rejeita se a promessa não resolver no prazo (o Blob que nunca responde não pode comer o minuto da rota). */
function comPrazo<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((ok, ko) => {
    const t = setTimeout(() => ko(new DOMException('prazo do Blob estourou', 'TimeoutError')), ms)
    p.then((v) => { clearTimeout(t); ok(v) }, (e) => { clearTimeout(t); ko(e) })
  })
}

async function falha(msg: string): Promise<ResultadoSonda> {
  await recordCronFailure(JOB, msg)
  return { status: 'error', error: msg, health_written: true }
}

class SondaFalhou extends Error {
  constructor(readonly erro: string, readonly http: number | null) { super(erro) }
}

export async function rodarSonda(sb: SupabaseClient, agora: Date, f: typeof fetch = fetch): Promise<ResultadoSonda> {
  let testes: TesteAtivo[]
  const variantes = new Map<string, Variante[]>()
  const esperada = new Map<string, string | null>()
  const anterior = new Map<string, SondaAnterior>()
  try {
    testes = await ler<TesteAtivo>('ab_tests', TETO_TESTES, (de, ate) => sb.from('ab_tests')
      .select('id, site_id, youtube_videos!inner(youtube_video_id)').eq('status', 'active').in('test_type', ['thumbnail', 'combo'])
      .order('id').range(de, ate))
    if (testes.length === 0) return { status: 'ok', testes: 0, gravadas: 0, falhas: 0 }
    const ids = testes.map((t) => t.id)
    const vs = await emBlocos(ids, (bl) => ler<Variante>('ab_test_variants', TETO_LINHAS, (de, ate) => sb.from('ab_test_variants')
      .select('id, test_id, thumbnail_dhash, blob_url').in('test_id', bl).order('id').range(de, ate)))
    for (const v of vs) variantes.set(v.test_id, [...(variantes.get(v.test_id) ?? []), v])
    const cs = await emBlocos(ids, (bl) => ler<Ciclo & { id: string }>('ab_test_cycles', TETO_LINHAS, (de, ate) => sb.from('ab_test_cycles')
      .select('id, test_id, variant_id').in('test_id', bl).is('ended_at', null).order('id').range(de, ate)))
    const abertos = new Map<string, string[]>()
    for (const c of cs) abertos.set(c.test_id, [...(abertos.get(c.test_id) ?? []), c.variant_id])
    for (const [t, vsAb] of abertos) esperada.set(t, vsAb.length === 1 ? vsAb[0]! : null)
    const desde = new Date(agora.getTime() - JANELA_ULTIMA_SONDA_MS).toISOString()
    const ss = await emBlocos(ids, (bl) => ler<SondaAnterior>('ab_test_sondas', TETO_LINHAS, (de, ate) => sb.from('ab_test_sondas')
      .select('test_id, hora, etag, dhash, sha16').in('test_id', bl).gte('hora', desde).order('test_id').order('hora').range(de, ate)))
    for (const s of ss) {
      const a = anterior.get(s.test_id)
      if (!a || s.hora > a.hora) anterior.set(s.test_id, s)
    }
  } catch (e) {
    return falha(e instanceof FalhaDeLeitura ? e.message : `leitura: ${e instanceof Error ? e.message : String(e)}`)
  }

  const lidaEm = agora.toISOString()
  const hora = horaDe(agora)

  const sondar = async (t: TesteAtivo): Promise<LinhaSondaGravada> => {
    const v = Array.isArray(t.youtube_videos) ? t.youtube_videos[0]! : t.youtube_videos
    const videoId = v.youtube_video_id
    const url = thumbUrl(videoId)
    const base = {
      test_id: t.id, hora, site_id: t.site_id, youtube_video_id: videoId, lida_em: lidaEm,
      variante_esperada: esperada.get(t.id) ?? null,
    }
    const vars = variantes.get(t.id) ?? []
    // Referências (Blob) em paralelo com o HEAD; falha do Blob só tira a referência daquela variante.
    const refsP = Promise.all(vars.map(async (va): Promise<{ variant_id: string; dhash: string | null }> => {
      if (va.thumbnail_dhash) return { variant_id: va.id, dhash: va.thumbnail_dhash }
      try {
        const r = await comPrazo(dhashDoArquivo(va.blob_url, f), BLOB_TIMEOUT_MS)
        return { variant_id: va.id, dhash: r.tipo === 'ok' ? r.dhash : null }
      } catch {
        return { variant_id: va.id, dhash: null }
      }
    }))
    refsP.catch(() => undefined)
    const head = await f(url, { method: 'HEAD', signal: AbortSignal.timeout(HEAD_TIMEOUT_MS) })
    const etag = head.headers.get('etag')
    if (!head.ok) throw Object.assign(new SondaFalhou(erroDaSonda({ status: head.status }), head.status), { etag })
    const etagAtual = etagUtil(etag)
    const ant = anterior.get(t.id)
    let dhash: string | null
    let sha16: string | null
    if (etagAtual !== null && etagAtual === etagUtil(ant?.etag ?? null) && ant?.dhash) {
      dhash = ant.dhash
      sha16 = ant.sha16 ?? null
    } else {
      const get = await f(url, { signal: AbortSignal.timeout(GET_TIMEOUT_MS) })
      if (!get.ok) throw Object.assign(new SondaFalhou(erroDaSonda({ status: get.status }), get.status), { etag })
      const bytes = Buffer.from(await get.arrayBuffer())
      try {
        dhash = await dhashOf(bytes)
      } catch {
        throw Object.assign(new SondaFalhou('imagem_invalida', get.status), { etag })
      }
      sha16 = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
    }
    const refs = await refsP
    const c = classificarLeitura(dhash, refs)
    return {
      ...base, http: head.status, erro: null, etag, enviada_em: enviadaEmDoEtag(etag), sha16, dhash,
      variante_vista: c.variante_vista, leitura_estado: c.leitura_estado, variantes_sem_referencia: c.variantes_sem_referencia,
    }
  }

  const resultados = await Promise.allSettled(testes.map(sondar))
  const linhas: LinhaSondaGravada[] = resultados.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const t = testes[i]!
    const v = Array.isArray(t.youtube_videos) ? t.youtube_videos[0]! : t.youtube_videos
    const razao = r.reason as unknown
    const erro = razao instanceof SondaFalhou ? razao.erro : erroDaSonda(razao)
    const http = razao instanceof SondaFalhou ? razao.http : null
    const etag = razao && typeof razao === 'object' && 'etag' in razao ? ((razao as { etag: string | null }).etag ?? null) : null
    return {
      test_id: t.id, hora, site_id: t.site_id, youtube_video_id: v.youtube_video_id, lida_em: lidaEm,
      http, erro, etag, enviada_em: null, sha16: null, dhash: null,
      variante_esperada: esperada.get(t.id) ?? null, variante_vista: null, leitura_estado: 'falhou', variantes_sem_referencia: 0,
    }
  })

  const { error } = await sb.from('ab_test_sondas').upsert(linhas as unknown as Linha[], { onConflict: 'test_id,hora', ignoreDuplicates: true })
  if (error) return falha(`ab_test_sondas: ${error.message}`)
  const falhadas = linhas.filter((l) => l.leitura_estado === 'falhou')
  if (testes.length > 0 && falhadas.length === testes.length) {
    return falha(`todas as ${testes.length} sondas falharam: ${[...new Set(falhadas.map((l) => String(l.erro)))].join(',')}`)
  }
  return { status: 'ok', testes: testes.length, gravadas: linhas.length, falhas: falhadas.length }
}
