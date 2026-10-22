// F2 · T1: custo do gravador de sinais do nicho e calibração da T3. SÓ LEITURA (a chave é a de serviço).
//   bash scripts/f2-medir-gravador.sh   (rode da raiz do repositório; grava .superpowers/sdd/ab-lab/f2/medida-gravador-<data>.json)
// Nenhum agente roda isto contra produção. Opcional: --site <uuid> (sem ele, vale o único site de competitor_settings).
import type { SupabaseClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { loadRows, rowsToDataset } from '../src/lib/youtube/observatorio/load'
import { createObservatory } from '../src/lib/youtube/observatorio'
import { RULES } from '../src/lib/youtube/observatorio/rules'
import type { Fmt } from '../src/lib/youtube/observatorio/types'

const LINHAS_POR_IDA = 1000 as const
const REPETICOES = 5

/* ------------------------------------------------------------------ puras (testadas) */

/** Idas de 1.000 linhas para ler `linhasDiaria` (hoje em `diasAtuais` dias) quando a janela chegar a `diasAlvo`. */
export function projetarIdas(linhasDiaria: number, diasAtuais: number, diasAlvo: 90 | 365, linhasPorIda: 1000): number {
  if (linhasDiaria <= 0 || diasAtuais <= 0) return 0
  return Math.ceil(((linhasDiaria / diasAtuais) * diasAlvo) / linhasPorIda)
}

// Deny-by-default: só `from(t).select(...)` e os encadeamentos de filtro, ordem e faixa da leitura passam.
// Tudo o mais (rpc, schema, storage, functions, auth, channel, insert/update/upsert/delete...) lança.
const LEITURA = new Set([
  'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'like', 'ilike', 'not', 'or', 'filter', 'match', 'contains',
  'containedBy', 'order', 'range', 'limit', 'single', 'maybeSingle', 'csv', 'abortSignal', 'then',
])
const recusa = (nome: string) => () => { throw new Error(`somente leitura: ${nome} recusado`) }

function leitura(alvo: object): object {
  return new Proxy(alvo, {
    get(a, prop) {
      if (typeof prop !== 'string') return Reflect.get(a, prop)
      if (!LEITURA.has(prop)) return recusa(`.${prop}`)
      const v = (a as Record<string, unknown>)[prop]
      if (typeof v !== 'function') return v
      if (prop === 'then') return v.bind(a)
      return (...args: unknown[]) => {
        const r = v.apply(a, args)
        return r && typeof r === 'object' ? leitura(r) : r
      }
    },
  })
}

/** Embrulha o cliente: só `.from(t).select(...)` passa. `onFrom` conta as consultas (idas) de cada etapa. */
export function somenteLeitura(sb: SupabaseClient, onFrom?: (tabela: string) => void): SupabaseClient {
  return new Proxy(sb, {
    get(alvo, prop) {
      if (prop !== 'from') return typeof prop === 'string' ? recusa(`.${prop}`) : Reflect.get(alvo, prop)
      return (t: string) => { onFrom?.(t); return leitura((alvo.from as (t: string) => object).call(alvo, t)) }
    },
  })
}

/** 42P01 (Postgres) ou PGRST205 (PostgREST: tabela fora do cache) = relação inexistente: a etapa vira `{ausente: true}`. */
export function ehRelacaoAusente(err: { code?: string | null } | null | undefined): boolean {
  return err?.code === '42P01' || err?.code === 'PGRST205'
}

/** PROVISÓRIO: a `tokensDe` oficial nasce na T5. Minúsculas, sem acento, tokens de 3+ letras. */
export function tokensDe(titulo: string | null | undefined, tags: readonly string[] | null | undefined): Set<string> {
  const texto = [titulo ?? '', ...(tags ?? [])].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return new Set(texto.split(/[^a-z0-9]+/).filter(t => t.length >= 3))
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

/** Degraus de 0,05: a chave é o piso do degrau ("0.00" a "1.00"); 1,00 tem degrau próprio. */
export function histogramaJaccard(valores: readonly number[]): Record<string, number> {
  const h: Record<string, number> = {}
  for (let i = 0; i <= 20; i++) h[(i / 20).toFixed(2)] = 0
  for (const v of valores) { const k = (Math.min(20, Math.floor(v * 20 + 1e-9)) / 20).toFixed(2); h[k] = (h[k] ?? 0) + 1 }
  return h
}

const pct = (xs: number[], q: number): number => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))] ?? 0
}
const r2 = (n: number) => Math.round(n * 100) / 100

/* ------------------------------------------------------------------ medição */

interface Medida { p50: number; p95: number; heapMB: number }
interface Ausente { ausente: true }
type Etapa = Medida & { idas: number; linhas: number }

async function cronometrar<T>(fn: () => Promise<{ valor: T; idas?: number; linhas?: number }>): Promise<{ medida: Etapa; ultimo: T }> {
  const ms: number[] = []
  let heap = 0, idas = 0, linhas = 0, ultimo!: T
  for (let i = 0; i < REPETICOES; i++) {
    const h0 = process.memoryUsage().heapUsed
    const t0 = performance.now()
    const r = await fn()
    ms.push(performance.now() - t0)
    heap = Math.max(heap, (process.memoryUsage().heapUsed - h0) / 1_048_576)
    idas = r.idas ?? 0; linhas = r.linhas ?? 0; ultimo = r.valor
  }
  return { medida: { p50: r2(pct(ms, 0.5)), p95: r2(pct(ms, 0.95)), heapMB: r2(heap), idas, linhas }, ultimo }
}

type Pagina = PromiseLike<{ data: unknown[] | null; error: { code?: string | null; message: string } | null }>
/** Lê tudo em páginas de 1.000. Relação inexistente (42P01) devolve `ausente`; outro erro lança. */
async function lerPaginado(pagina: (de: number, ate: number) => Pagina): Promise<{ linhas: number; idas: number } | Ausente> {
  let linhas = 0, idas = 0
  for (let de = 0; ; de += LINHAS_POR_IDA) {
    const { data, error } = await pagina(de, de + LINHAS_POR_IDA - 1)
    idas++
    if (error) { if (ehRelacaoAusente(error)) return { ausente: true }; throw new Error(`${error.code}: ${error.message}`) }
    linhas += data?.length ?? 0
    if (!data || data.length < LINHAS_POR_IDA) return { linhas, idas }
  }
}

async function etapaLeitura(nome: string, fn: () => Promise<{ linhas: number; idas: number } | Ausente>): Promise<Etapa | Ausente> {
  const { medida, ultimo } = await cronometrar(async () => {
    const r = await fn()
    return { valor: r, idas: 'ausente' in r ? 0 : r.idas, linhas: 'ausente' in r ? 0 : r.linhas }
  })
  if ('ausente' in ultimo) { console.error(`${nome}: relação ausente (42P01/PGRST205), estimada pela leitura de competitor_raw`); return ultimo }
  return medida
}

type Resultado = Etapa | Ausente | { erro: string }
const erroDe = (e: unknown): { erro: string } => ({ erro: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200) })

async function main(): Promise<number> {
  const bruto = getSupabaseServiceClient() as unknown as SupabaseClient
  let contagem = 0
  const sb = somenteLeitura(bruto, () => { contagem++ })

  const argSite = process.argv.indexOf('--site')
  let siteId = argSite >= 0 ? process.argv[argSite + 1] ?? '' : ''
  if (!siteId) {
    const { data, error } = await sb.from('competitor_settings').select('site_id')
    if (error || !data || data.length !== 1) { console.error(`informe --site <uuid> (competitor_settings devolveu ${data?.length ?? 'erro'} sites)`); return 2 }
    siteId = (data[0] as { site_id: string }).site_id
  }

  const now = Date.now()
  const etapas: Record<string, Resultado> = {}
  const saida: Record<string, unknown> = { geradoEm: new Date(now).toISOString(), siteId, repeticoes: REPETICOES, etapas, parcial: true }
  const dia = new Date(now).toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' })
  const gravar = () => {
    mkdirSync('.superpowers/sdd/ab-lab/f2', { recursive: true })
    const arquivo = `.superpowers/sdd/ab-lab/f2/medida-gravador-${dia}.json`
    writeFileSync(arquivo, JSON.stringify(saida, null, 2) + '\n')
    console.log(`gravado: ${arquivo}${saida.parcial ? ' (PARCIAL: veja etapas com "erro")' : ''}`)
  }
  /** Uma etapa que falha vira `{erro}` no JSON; a medição segue. */
  const seguro = async <T>(nome: string, fn: () => Promise<{ medida: Etapa; ultimo: T }>): Promise<T | undefined> => {
    try { const r = await fn(); etapas[nome] = r.medida; return r.ultimo } catch (e) { etapas[nome] = erroDe(e); console.error(`${nome}: ${(etapas[nome] as { erro: string }).erro}`); return undefined }
  }
  const seguroLeitura = async (nome: string, fn: () => Promise<{ linhas: number; idas: number } | Ausente>) => {
    try { etapas[nome] = await etapaLeitura(nome, fn) } catch (e) { etapas[nome] = erroDe(e); console.error(`${nome}: ${(etapas[nome] as { erro: string }).erro}`) }
  }

  try {
    const rows = await seguro('loadRows', () => cronometrar(async () => { contagem = 0; const v = await loadRows({ siteId, now, supabase: sb }); return { valor: v, idas: contagem, linhas: v.videos.length + v.daily.length + v.versions.length + v.snapshots.length + (v.spans?.length ?? 0) } }))
    const ds = rows && await seguro('rowsToDataset', () => cronometrar(async () => ({ valor: rowsToDataset(rows, now) })))
    const obs = ds && await seguro('createObservatory', () => cronometrar(async () => ({ valor: createObservatory(ds) })))
    const consulta = (fmt: Fmt) => obs!.outliers({ maxAge: 30, fmt })
    if (obs) {
      await seguro('outliersLong', () => cronometrar(async () => ({ valor: consulta('long') })))
      await seguro('outliersShort', () => cronometrar(async () => ({ valor: consulta('short') })))
    }

    await seguroLeitura('lerVideoLugares', () => lerPaginado((de, ate) => sb.from('video_lugares').select('*').eq('site_id', siteId).range(de, ate)))
    await seguroLeitura('lerLugarAliases', () => lerPaginado((de, ate) => sb.from('lugar_aliases').select('alias_norm, slug, ambiguo, semente_versao').range(de, ate)))
    await seguroLeitura('lerDescricaoPropria', () => lerPaginado((de, ate) => sb.from('youtube_videos').select('id, description').eq('site_id', siteId).range(de, ate)))
    await seguroLeitura('lerCompetitorRawRecordingDetails', () => lerPaginado((de, ate) => sb.from('competitor_raw').select('video_id, raw->recordingDetails').eq('site_id', siteId).eq('is_current', true).range(de, ate)))

    // ida de 1.000 linhas de competitor_video_daily em offsets espalhados (início, ~50%, ~90% da tabela): p50/p95 sobre todas
    let latencia: { p50: number; p95: number; offsets: number[] } | undefined
    try {
      const { count, error: ec } = await sb.from('competitor_video_daily').select('video_id', { count: 'exact', head: true })
      if (ec) throw new Error(`${ec.code}: ${ec.message}`)
      const total = count ?? 0
      const offsets = [0, Math.floor(total * 0.5), Math.floor(total * 0.9)].map(o => Math.max(0, Math.min(o, total - LINHAS_POR_IDA)))
      const ms: number[] = []
      for (const off of offsets) for (let i = 0; i < REPETICOES; i++) {
        const t0 = performance.now()
        const { error } = await sb.from('competitor_video_daily').select('video_id, snap_date, views, likes, comments, taken_at').order('video_id').order('snap_date').range(off, off + LINHAS_POR_IDA - 1)
        if (error) throw new Error(`${error.code}: ${error.message}`)
        ms.push(performance.now() - t0)
      }
      latencia = { p50: r2(pct(ms, 0.5)), p95: r2(pct(ms, 0.95)), offsets }
      saida.latenciaIda1000Ms = latencia
    } catch (e) { saida.latenciaIda1000Ms = erroDe(e) }

    if (rows && obs && latencia) {
      // projeção: leitura cresce por ida; o resto (CPU) cresce com as linhas
      const linhasDiaria = rows.daily.length
      const diasAtuais = new Set(rows.daily.map(d => d.snap_date)).size
      const idasAtuais = Math.ceil(linhasDiaria / LINHAS_POR_IDA)
      const p95 = (n: string) => (etapas[n] as Medida | undefined)?.p95 ?? 0
      const cpuP95 = p95('rowsToDataset') + p95('createObservatory') + p95('outliersLong') + p95('outliersShort')
      const projetar = (alvo: 90 | 365) => {
        const idas = projetarIdas(linhasDiaria, diasAtuais, alvo, LINHAS_POR_IDA)
        const fator = linhasDiaria > 0 ? idas / Math.max(1, idasAtuais) : 1
        return { idas, p95Ms: r2(p95('loadRows') + Math.max(0, idas - idasAtuais) * latencia.p95 + cpuP95 * Math.max(1, fator)) }
      }
      saida.base = { linhasDiaria, diasAtuais, idasAtuais }
      saida.projecao = { d90: projetar(90), d365: projetar(365), formula: 'p95 loadRows + (idasProj - idasAtuais) * p95 ida (offsets espalhados) + p95 CPU (rowsToDataset+createObservatory+outliers) * fator de linhas' }
    }

    if (rows && obs) {
      // T3: por canal e formato, pelo motor. median7 do motor = median(vpd7 dos vídeos do canal, tracked, do formato, vpd7 != null)
      const concorrentes = obs.channels.filter(c => !c.own)
      const nome = new Map(obs.channels.map(c => [c.id, c.name]))
      const vpdsDe = (ch: string, fmt: Fmt): number[] => obs.videos.filter(v => v.ch === ch && v.tracked && v.fmt === fmt && v.vpd7 != null).map(v => v.vpd7 as number)
      const t3Fmt = (fmt: Fmt) => {
        const nPorCanal = new Map(concorrentes.map(c => [c.id, vpdsDe(c.id, fmt)]))
        const estourando = consulta(fmt).items.filter(it => !it.weak && it.phase.id === 'estourando')
        const estourandoPorCanal: Record<string, number> = {}
        const mults: number[] = []
        for (const it of estourando) {
          const n = nome.get(it.video.ch) ?? it.video.ch
          estourandoPorCanal[n] = (estourandoPorCanal[n] ?? 0) + 1
          const m7 = obs.median(vpdsDe(it.video.ch, fmt))
          if (it.video.vpd7 != null && m7 != null && m7 > 0) mults.push(it.video.vpd7 / m7)
        }
        return {
          estourando,
          porFormato: { canais: concorrentes.length, canaisComNMinimo8: [...nPorCanal.values()].filter(a => a.length >= 8).length, estourandoPorCanal },
          mult: { p50: r2(pct(mults, 0.5)), p90: r2(pct(mults, 0.9)), max: r2(Math.max(0, ...mults)), nAcimaDe5: mults.filter(m => m >= RULES.tiers.high).length },
        }
      }
      const tl = t3Fmt('long'), ts = t3Fmt('short')

      // parecido (Jaccard título + tags, outlier × próprio); a descrição fica de fora
      const tagsDe = new Map(rows.videos.map(v => [v.id, v.tags]))
      const proprios = rows.ownVideos.map(v => ({ titulo: v.title, toks: tokensDe(v.title, v.tags) }))
      const pares: { jaccard: number; tituloTerceiro: string; tituloProprio: string }[] = []
      for (const it of [...tl.estourando, ...ts.estourando]) {
        const a = tokensDe(it.video.title, tagsDe.get(it.video.id))
        let melhor: { j: number; titulo: string } | null = null
        for (const p of proprios) { const j = jaccard(a, p.toks); if (!melhor || j > melhor.j) melhor = { j, titulo: p.titulo } }
        if (melhor) pares.push({ jaccard: r2(melhor.j), tituloTerceiro: it.video.title, tituloProprio: melhor.titulo })
      }
      pares.sort((x, y) => y.jaccard - x.jaccard)
      saida.t3 = {
        porFormato: { long: tl.porFormato, short: ts.porFormato },
        multDistribuicao: { long: tl.mult, short: ts.mult },
        parecidoAmostra: { top20: pares.slice(0, 20), histograma: histogramaJaccard(pares.map(p => p.jaccard)), nPares: pares.length, nota: 'Jaccard provisório (tokensDe local, sem descrição)' },
      }
    }
    saida.parcial = Object.values(etapas).some(e => 'erro' in e) || !saida.projecao || !saida.t3
  } catch (e) {
    saida.erroGeral = erroDe(e).erro
  } finally {
    gravar()
  }
  return saida.parcial ? 1 : 0
}

// só roda como script (o teste importa as funções puras acima)
if (/f2-medir-gravador\.ts$/.test(process.argv[1] ?? '')) {
  main().then(c => { process.exitCode = c }, e => { console.error('falha:', e instanceof Error ? e.message : e); process.exitCode = 1 })
}
