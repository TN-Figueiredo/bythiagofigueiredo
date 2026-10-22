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

const ESCRITAS = new Set(['insert', 'update', 'upsert', 'delete'])
const recusa = (nome: string) => () => { throw new Error(`somente leitura: ${nome} recusado`) }

/** Embrulha o cliente: `.rpc` e as escritas de tabela lançam. `onFrom` conta as consultas (idas) de cada etapa. */
export function somenteLeitura(sb: SupabaseClient, onFrom?: (tabela: string) => void): SupabaseClient {
  const tabela = (b: object): object => new Proxy(b, {
    get(alvo, prop, rec) {
      if (typeof prop === 'string' && ESCRITAS.has(prop)) return recusa(`.${prop}`)
      return Reflect.get(alvo, prop, rec)
    },
  })
  return new Proxy(sb, {
    get(alvo, prop, rec) {
      if (prop === 'rpc') return recusa('.rpc')
      if (prop === 'from') return (t: string) => { onFrom?.(t); return tabela((alvo.from as (t: string) => object).call(alvo, t)) }
      const v = Reflect.get(alvo, prop, rec)
      return typeof v === 'function' ? v.bind(alvo) : v
    },
  })
}

/** 42P01 = relação inexistente (video_lugares e lugar_aliases só nascem na F2-1): a etapa vira `{ausente: true}`. */
export function ehRelacaoAusente(err: { code?: string | null } | null | undefined): boolean {
  return err?.code === '42P01'
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
  if ('ausente' in ultimo) { console.error(`${nome}: relação ausente (42P01), estimada pela leitura de competitor_raw`); return ultimo }
  return medida
}

async function main(): Promise<number> {
  const bruto = getSupabaseServiceClient() as unknown as SupabaseClient
  let contagem = 0
  const sb = somenteLeitura(bruto, () => { contagem++ })

  const argSite = process.argv.indexOf('--site')
  let siteId = argSite >= 0 ? process.argv[argSite + 1] : ''
  if (!siteId) {
    const { data, error } = await sb.from('competitor_settings').select('site_id')
    if (error || !data || data.length !== 1) { console.error(`informe --site <uuid> (competitor_settings devolveu ${data?.length ?? 'erro'} sites)`); return 2 }
    siteId = (data[0] as { site_id: string }).site_id
  }

  const now = Date.now()
  const etapas: Record<string, Etapa | Ausente> = {}

  const lr = await cronometrar(async () => { contagem = 0; const v = await loadRows({ siteId, now, supabase: sb }); return { valor: v, idas: contagem, linhas: v.videos.length + v.daily.length + v.versions.length + v.snapshots.length + (v.spans?.length ?? 0) } })
  etapas.loadRows = lr.medida
  const rows = lr.ultimo
  const rd = await cronometrar(async () => ({ valor: rowsToDataset(rows, now) }))
  etapas.rowsToDataset = rd.medida
  const co = await cronometrar(async () => ({ valor: createObservatory(rd.ultimo) }))
  etapas.createObservatory = co.medida
  const obs = co.ultimo
  const consulta = (fmt: Fmt) => obs.outliers({ maxAge: 30, fmt })
  etapas.outliersLong = (await cronometrar(async () => ({ valor: consulta('long') }))).medida
  etapas.outliersShort = (await cronometrar(async () => ({ valor: consulta('short') }))).medida

  etapas.lerVideoLugares = await etapaLeitura('lerVideoLugares', () => lerPaginado((de, ate) => sb.from('video_lugares').select('video_id').eq('site_id', siteId).range(de, ate)))
  etapas.lerLugarAliases = await etapaLeitura('lerLugarAliases', () => lerPaginado((de, ate) => sb.from('lugar_aliases').select('lugar_id').range(de, ate)))
  etapas.lerDescricaoPropria = await etapaLeitura('lerDescricaoPropria', () => lerPaginado((de, ate) => sb.from('youtube_videos').select('id, description').eq('site_id', siteId).range(de, ate)))
  etapas.lerCompetitorRawRecordingDetails = await etapaLeitura('lerCompetitorRawRecordingDetails', () => lerPaginado((de, ate) => sb.from('competitor_raw').select('video_id, raw->recordingDetails').eq('site_id', siteId).eq('is_current', true).range(de, ate)))

  // uma ida de 1.000 linhas de competitor_video_daily
  const ida = await cronometrar(async () => {
    const { data, error } = await sb.from('competitor_video_daily').select('video_id, snap_date, views, likes, comments, taken_at').order('video_id').order('snap_date').range(0, LINHAS_POR_IDA - 1)
    if (error) throw new Error(`${error.code}: ${error.message}`)
    return { valor: data?.length ?? 0, idas: 1, linhas: data?.length ?? 0 }
  })

  // projeção: leitura cresce por ida; o resto (CPU) cresce com as linhas
  const linhasDiaria = rows.daily.length
  const diasAtuais = new Set(rows.daily.map(d => d.snap_date)).size
  const idasAtuais = Math.ceil(linhasDiaria / LINHAS_POR_IDA)
  const cpuP95 = etapas.rowsToDataset && (etapas.rowsToDataset as Medida).p95 + (etapas.createObservatory as Medida).p95 + (etapas.outliersLong as Medida).p95 + (etapas.outliersShort as Medida).p95
  const projetar = (alvo: 90 | 365) => {
    const idas = projetarIdas(linhasDiaria, diasAtuais, alvo, LINHAS_POR_IDA)
    const fator = linhasDiaria > 0 ? idas / Math.max(1, idasAtuais) : 1
    return { idas, p95Ms: r2((etapas.loadRows as Medida).p95 + Math.max(0, idas - idasAtuais) * ida.medida.p95 + cpuP95 * Math.max(1, fator)) }
  }

  // T3: por canal e formato, pelo motor
  const concorrentes = obs.channels.filter(c => !c.own)
  const nome = new Map(obs.channels.map(c => [c.id, c.name]))
  const t3Fmt = (fmt: Fmt) => {
    const nPorCanal = new Map<string, number[]>()
    for (const v of obs.videos) if (v.tracked && v.fmt === fmt && v.vpd7 != null && !obs.channel(v.ch)?.own) (nPorCanal.get(v.ch) ?? nPorCanal.set(v.ch, []).get(v.ch)!).push(v.vpd7)
    const estourando = consulta(fmt).items.filter(it => !it.weak && it.phase.id === 'estourando')
    const estourandoPorCanal: Record<string, number> = {}
    const mults: number[] = []
    for (const it of estourando) {
      estourandoPorCanal[nome.get(it.video.ch) ?? it.video.ch] = (estourandoPorCanal[nome.get(it.video.ch) ?? it.video.ch] ?? 0) + 1
      const m7 = obs.median(nPorCanal.get(it.video.ch) ?? [])
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

  const saida = {
    geradoEm: new Date(now).toISOString(), siteId, repeticoes: REPETICOES,
    etapas: { ...etapas, ida1000: ida.medida },
    latenciaIda1000Ms: { p50: ida.medida.p50, p95: ida.medida.p95 },
    base: { linhasDiaria, diasAtuais, idasAtuais },
    projecao: { d90: projetar(90), d365: projetar(365), formula: 'p95 loadRows + (idasProj - idasAtuais) * p95 ida + p95 CPU (rowsToDataset+createObservatory+outliers) * fator de linhas' },
    t3: {
      porFormato: { long: tl.porFormato, short: ts.porFormato },
      multDistribuicao: { long: tl.mult, short: ts.mult },
      parecidoAmostra: { top20: pares.slice(0, 20), histograma: histogramaJaccard(pares.map(p => p.jaccard)), nPares: pares.length, nota: 'Jaccard provisório (tokensDe local, sem descrição)' },
    },
  }
  const dia = new Date(now).toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' })
  mkdirSync('.superpowers/sdd/ab-lab/f2', { recursive: true })
  const arquivo = `.superpowers/sdd/ab-lab/f2/medida-gravador-${dia}.json`
  writeFileSync(arquivo, JSON.stringify(saida, null, 2) + '\n')
  console.log(`gravado: ${arquivo}`)
  return 0
}

// só roda como script (o teste importa as funções puras acima)
if (/f2-medir-gravador\.ts$/.test(process.argv[1] ?? '')) {
  main().then(c => { process.exitCode = c }, e => { console.error('falha:', e instanceof Error ? e.message : e); process.exitCode = 1 })
}
