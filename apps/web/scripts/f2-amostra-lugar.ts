// F2 · T6b: amostra do portão de precisão do lugar. SÓ LEITURA (a chave é a de serviço); nada é gravado no banco.
//   bash scripts/f2-amostra-lugar.sh [--site <uuid>] [--alvo 60|100]   (rode da raiz; grava .superpowers/sdd/ab-lab/f2/amostra-lugar-<data>.csv)
// Sorteia (semente fixa) 100 outliers de terceiros (90 d, todas as fases, long e short) + os 20 títulos negativos da T3 e
// completa o sorteio até haver `alvo` chaves `pais:` calculadas (padrão 60). O controlador rotula `chaves_corretas`.
import type { SupabaseClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { loadRows, readAll, rowsToDataset } from '../src/lib/youtube/observatorio/load'
import { createObservatory } from '../src/lib/youtube/observatorio'
import { extrairLugares } from '../src/lib/youtube/observatorio/lugar/casar'
import { calcularLugares, lerIndiceDeLugar, type RawDeLugar } from '../src/lib/youtube/observatorio/sinais/lugares-do-site'
import type { Fmt } from '../src/lib/youtube/observatorio/types'
import { ehRelacaoAusente, somenteLeitura } from './f2-medir-gravador'

export const SEMENTE_AMOSTRA = 0x6b2f2
export const N_OUTLIERS = 100
export const ALVO_PADRAO = 60

/** Os 20 primeiros títulos negativos da T3 (`test/youtube/observatorio/lugar/casar.test.ts`): nenhum pode gerar chave. */
export const TITULOS_NEGATIVOS: readonly string[] = [
  'Trip to Georgia', 'Porto seguro de vida', 'Natal em família', 'Chad reage', 'Lima limão receita',
  'Salvador Dalí documentário', 'Jordan Peterson entrevista', 'Cuba Gooding Jr melhores filmes', 'Vitória do time ontem',
  'Belém do Pará culinária', 'Turkey sandwich recipe', 'Chad e Brad jogam', 'Natal de luz', 'Porto Alegre', 'Lima e limão',
  'Georgia on my mind', 'Jordan vs Lebron', 'Turkey day dinner', 'Salvador Sobral canta', 'Receita de ceia de Natal',
]

/* ------------------------------------------------------------------ puras (testadas) */

/** mulberry32: gerador determinístico de 32 bits. */
export function aleatorio(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Embaralha (Fisher-Yates) uma cópia ordenada por `chave`: o resultado só depende da semente e do conjunto, não da ordem de leitura. */
export function embaralhar<T>(xs: readonly T[], chave: (x: T) => string, semente: number): T[] {
  const r = aleatorio(semente)
  const a = [...xs].sort((x, y) => chave(x).localeCompare(chave(y)))
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const t = a[i] as T
    a[i] = a[j] as T
    a[j] = t
  }
  return a
}

export const soPais = (chaves: readonly string[]): string[] => chaves.filter(c => c.startsWith('pais:'))

/**
 * Sorteia `n` do conjunto e, se as chaves `pais:` dos sorteados (mais as `fixas` já contadas) não chegarem a `alvo`,
 * segue tirando do que sobrou, na mesma ordem embaralhada, até chegar ou acabar. `completo = false` quando acabou antes.
 */
export function sortearComComplemento<T>(args: {
  todos: readonly T[]; id: (x: T) => string; chavesDe: (x: T) => readonly string[]
  n: number; alvo: number; paisesFixos: number; semente: number
}): { sorteados: T[]; paises: number; completo: boolean; complementares: number } {
  const ordem = embaralhar(args.todos, args.id, args.semente)
  const sorteados = ordem.slice(0, args.n)
  let paises = args.paisesFixos + sorteados.reduce((s, x) => s + soPais(args.chavesDe(x)).length, 0)
  let complementares = 0
  for (const x of ordem.slice(args.n)) {
    if (paises >= args.alvo) break
    sorteados.push(x)
    complementares++
    paises += soPais(args.chavesDe(x)).length
  }
  return { sorteados, paises, completo: paises >= args.alvo, complementares }
}

/** Intervalo de Wilson (z = 1,96 para 95%). `n = 0` devolve `null`: sem chaves não há precisão (nunca 0 nem 1). */
export function wilson(acertos: number, n: number, z = 1.96): { inferior: number; superior: number } | null {
  if (n <= 0) return null
  const p = acertos / n
  const z2 = z * z
  const centro = (p + z2 / (2 * n)) / (1 + z2 / n)
  const meia = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  return { inferior: Math.max(0, centro - meia), superior: Math.min(1, centro + meia) }
}

export interface LinhaRotulada { chaves_calculadas: string; chaves_corretas: string }
export const SEPARADOR_CHAVES = ';'
const listar = (s: string): string[] => s.split(SEPARADOR_CHAVES).map(c => c.trim()).filter(Boolean)

export interface PrecisaoPais {
  calculadas: number; corretas: number; precisao: number | null
  wilson95: { inferior: number; superior: number } | null
  /** Regra do spec: limite inferior < 0,80 pede completar o sorteio até 100 chaves antes de decidir. */
  completarAte100: boolean
  /** `n >= 60` e precisao >= 0,90: o portão só vale com as duas coisas. */
  passa: boolean
}

/**
 * Precisão sobre as chaves `pais:` apenas (cada `local:` emite também o `pais:` e inflaria a taxa). Uma chave calculada
 * conta como correta se está em `chaves_corretas`. Linha sem rótulo (`chaves_corretas` vazio) conta como nenhuma correta.
 */
export function calcularPrecisaoPais(linhas: readonly LinhaRotulada[]): PrecisaoPais {
  let calculadas = 0, corretas = 0
  for (const l of linhas) {
    const certas = new Set(listar(l.chaves_corretas))
    for (const c of soPais(listar(l.chaves_calculadas))) {
      calculadas++
      if (certas.has(c)) corretas++
    }
  }
  const precisao = calculadas > 0 ? corretas / calculadas : null
  const w = wilson(corretas, calculadas)
  return {
    calculadas, corretas, precisao, wilson95: w,
    completarAte100: calculadas < 100 && (w === null || w.inferior < 0.8),
    passa: calculadas >= 60 && precisao !== null && precisao >= 0.9,
  }
}

const escapar = (v: string): string => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
export const CABECALHO_CSV = ['video_id', 'canal', 'formato', 'titulo', 'chaves_calculadas', 'fonte', 'chaves_corretas'] as const
export interface LinhaCsv { video_id: string; canal: string; formato: string; titulo: string; chaves: readonly string[]; fonte: string }
export function paraCsv(linhas: readonly LinhaCsv[]): string {
  const corpo = linhas.map(l => [l.video_id, l.canal, l.formato, l.titulo, l.chaves.join(SEPARADOR_CHAVES), l.fonte, ''].map(escapar).join(','))
  return [CABECALHO_CSV.join(','), ...corpo].join('\n') + '\n'
}

/* ------------------------------------------------------------------ execução */

interface RawRow { video_id: string | null; rd: unknown }
const numero = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)
function rawDe(rd: unknown): RawDeLugar {
  const o = (rd && typeof rd === 'object' ? rd : {}) as { locationDescription?: unknown; location?: { latitude?: unknown; longitude?: unknown } | null }
  const desc = typeof o.locationDescription === 'string' && o.locationDescription.trim() !== '' ? o.locationDescription : null
  return { locationDescription: desc, lat: numero(o.location?.latitude), lng: numero(o.location?.longitude) }
}

async function main(): Promise<number> {
  const sb = somenteLeitura(getSupabaseServiceClient() as unknown as SupabaseClient)
  const argDe = (nome: string): string | undefined => { const i = process.argv.indexOf(nome); return i >= 0 ? process.argv[i + 1] : undefined }
  const alvo = Number(argDe('--alvo') ?? ALVO_PADRAO)
  if (!Number.isInteger(alvo) || alvo < ALVO_PADRAO || alvo > 1000) { console.error('--alvo deve ser inteiro entre 60 e 1000'); return 2 }

  let siteId = argDe('--site') ?? ''
  if (!siteId) {
    const { data, error } = await sb.from('competitor_settings').select('site_id')
    if (error || !data || data.length !== 1) { console.error(`informe --site <uuid> (competitor_settings devolveu ${data?.length ?? 'erro'} sites)`); return 2 }
    siteId = (data[0] as { site_id: string }).site_id
  }

  // lugar_aliases ausente = o F2-1 ainda não está no banco: parar com mensagem clara, nunca CSV vazio com sucesso
  const sonda = await sb.from('lugar_aliases').select('alias_norm', { count: 'exact', head: true })
  if (ehRelacaoAusente(sonda.error)) { console.error('lugar_aliases ausente (42P01/PGRST205): a migration do F2-1 ainda não está neste banco. Nada gerado.'); return 3 }
  if (sonda.error) { console.error(`lugar_aliases: ${sonda.error.code}: ${sonda.error.message}`); return 1 }
  const indice = await lerIndiceDeLugar(sb) // semente incompleta/vazia lança ErroSementeIncompleta

  const now = Date.now()
  const rows = await loadRows({ siteId, now, supabase: sb })
  const obs = createObservatory(rowsToDataset(rows, now))
  const canal = new Map(obs.channels.map(c => [c.id, c.name]))

  const porId = new Map<string, { id: string; fmt: Fmt }>()
  for (const fmt of ['long', 'short'] as const) {
    for (const it of obs.outliers({ maxAge: 90, fmt, ages: 'all' }).items) porId.set(it.id, { id: it.id, fmt })
  }
  if (porId.size === 0) { console.error('nenhum outlier de terceiro em 90 d (long+short): sem amostra. Nada gerado.'); return 3 }

  let rawRows: RawRow[]
  try {
    rawRows = await readAll<RawRow>('competitor_raw', () =>
      sb.from('competitor_raw').select('video_id, rd:raw->recordingDetails').eq('site_id', siteId).eq('is_current', true).order('id'))
  } catch (e) { console.error(`competitor_raw: ${e instanceof Error ? e.message : e}`); return 1 }
  const raws = new Map<string, RawDeLugar>()
  for (const r of rawRows) if (r.video_id) raws.set(r.video_id, rawDe(r.rd))

  const calculo = calcularLugares({ siteId, rows, proprios: [], indice, raws, existentes: new Map(), agora: new Date(now) })
  const linhaDe = new Map(calculo.linhas.map(l => [l.video_id, l]))
  const tituloDe = new Map(obs.videos.map(v => [v.id, v.title]))

  const negativas = TITULOS_NEGATIVOS.map((titulo, i) => {
    const r = extrairLugares({ titulo, tags: [], descricaoInicio: '', locationDescription: null, coordenadaPadraoDoCanal: false }, indice)
    return { video_id: `negativo-${String(i + 1).padStart(2, '0')}`, canal: '', formato: '', titulo, chaves: r.chaves, fonte: r.fonte as string }
  })
  const paisesFixos = negativas.reduce((s, l) => s + soPais(l.chaves).length, 0)

  const r = sortearComComplemento({
    todos: [...porId.values()], id: x => x.id, chavesDe: x => linhaDe.get(x.id)?.chaves ?? [],
    n: N_OUTLIERS, alvo, paisesFixos, semente: SEMENTE_AMOSTRA,
  })
  const sorteadas: LinhaCsv[] = r.sorteados.map(x => {
    const l = linhaDe.get(x.id)
    const v = obs.videos.find(y => y.id === x.id)
    return { video_id: x.id, canal: canal.get(v?.ch ?? '') ?? v?.ch ?? '', formato: x.fmt, titulo: tituloDe.get(x.id) ?? '', chaves: l?.chaves ?? [], fonte: l?.fonte ?? 'texto' }
  })

  const dia = new Date(now).toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' })
  const arquivo = `.superpowers/sdd/ab-lab/f2/amostra-lugar-${dia}.csv`
  mkdirSync('.superpowers/sdd/ab-lab/f2', { recursive: true })
  writeFileSync(arquivo, paraCsv([...sorteadas, ...negativas]))

  const long = sorteadas.filter(l => l.formato === 'long'), short = sorteadas.filter(l => l.formato === 'short')
  const nPais = (ls: LinhaCsv[]) => ls.reduce((s, l) => s + soPais(l.chaves).length, 0)
  console.log(`gravado: ${arquivo}`)
  console.log(`outliers no pool: ${porId.size}; sorteados: ${sorteadas.length} (${r.complementares} de complemento); negativos: ${negativas.length}`)
  console.log(`chaves pais: ${r.paises} (alvo ${alvo}); cobertura long ${nPais(long)} / short ${nPais(short)} (sem portão)`)
  const negComChave = negativas.filter(l => l.chaves.length > 0)
  if (negComChave.length > 0) console.error(`ATENÇÃO: ${negComChave.length} título(s) negativo(s) geraram chave: ${negComChave.map(l => l.titulo).join(' | ')}`)
  if (!r.completo) { console.error(`pool esgotado: só ${r.paises} chaves pais: (alvo ${alvo}). Amostra INSUFICIENTE, não decide o portão.`); return 1 }
  return 0
}

// só roda como script (o teste importa as funções puras acima)
if (/f2-amostra-lugar\.ts$/.test(process.argv[1] ?? '')) {
  main().then(c => { process.exitCode = c }, e => { console.error('falha:', e instanceof Error ? e.message : e); process.exitCode = 1 })
}
