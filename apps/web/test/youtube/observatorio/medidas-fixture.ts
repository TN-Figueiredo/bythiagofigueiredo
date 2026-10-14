// A5 E4, Tarefa 13: o falso de PostgREST dos leitores das medidas. Tabelas em memória; `select` (com projeção das colunas pedidas),
// `eq`, `neq`, `in`, `gte`, `order` e `range`; no máximo 1.000 linhas por pedido (como o PostgREST); contador de consultas e registro
// das colunas e dos filtros. A Tarefa 14 acrescenta a fixture cheia a este arquivo.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Linha = Record<string, unknown>
export interface Consulta { tabela: string; colunas: string[]; filtros: Array<{ op: 'eq' | 'neq' | 'in' | 'gte'; coluna: string; valor: unknown }>; de: number | null; ate: number | null }
export interface FalsoOpcoes {
  /** Erro devolvido (no campo `error`) a toda consulta desta tabela. */
  erros?: Record<string, { code: string; message: string }>
  /** A consulta a esta tabela lança. */
  lancam?: string[]
  /** Colunas que "ainda não existem": pedir uma delas devolve 42703. */
  colunasAusentes?: Record<string, string[]>
}

const comparavel = (v: unknown): string | number | null => (typeof v === 'number' || typeof v === 'string' ? v : null)

export function falsoPostgrest(tabelas: Record<string, Linha[]>, op: FalsoOpcoes = {}) {
  const consultas: Consulta[] = []
  const sb = {
    from(tabela: string) {
      const c: Consulta = { tabela, colunas: [], filtros: [], de: null, ate: null }
      let ordem: string[] = []
      const b = {
        select(cols: string) { c.colunas = cols.split(',').map((x) => x.trim()).filter(Boolean); return b },
        eq(coluna: string, valor: unknown) { c.filtros.push({ op: 'eq', coluna, valor }); return b },
        neq(coluna: string, valor: unknown) { c.filtros.push({ op: 'neq', coluna, valor }); return b },
        in(coluna: string, valor: unknown[]) { c.filtros.push({ op: 'in', coluna, valor }); return b },
        gte(coluna: string, valor: unknown) { c.filtros.push({ op: 'gte', coluna, valor }); return b },
        order(coluna: string) { ordem = [...ordem, coluna]; return b },
        range(de: number, ate: number) { c.de = de; c.ate = ate; return b },
        then(ok: (r: { data: unknown; error: unknown }) => unknown, falha?: (e: unknown) => unknown) {
          return executar().then(ok, falha)
        },
      }
      async function executar(): Promise<{ data: unknown; error: unknown }> {
        consultas.push(c)
        if (op.lancam?.includes(tabela)) throw new Error('FRASE-SENTINELA-LANCADA')
        const erro = op.erros?.[tabela]
        if (erro) return { data: null, error: erro }
        const ausentes = op.colunasAusentes?.[tabela] ?? []
        if (c.colunas.some((x) => ausentes.includes(x))) return { data: null, error: { code: '42703', message: 'column does not exist' } }
        const base = tabelas[tabela]
        if (!base) return { data: null, error: { code: '42P01', message: 'relation does not exist' } }
        let linhas = base.filter((l) => c.filtros.every((f) => {
          const v = l[f.coluna]
          if (f.op === 'eq') return v === f.valor
          if (f.op === 'neq') return v !== f.valor
          if (f.op === 'in') return Array.isArray(f.valor) && f.valor.includes(v)
          const a = comparavel(v), z = comparavel(f.valor)
          return a !== null && z !== null && a >= z
        }))
        if (ordem.length) {
          linhas = [...linhas].sort((x, y) => {
            for (const k of ordem) {
              const a = comparavel(x[k]), z = comparavel(y[k])
              if (a === null || z === null || a === z) continue
              return a < z ? -1 : 1
            }
            return 0
          })
        }
        const de = c.de ?? 0
        const ate = c.ate === null ? de + 999 : Math.min(c.ate, de + 999)
        linhas = linhas.slice(de, ate + 1)
        const cols = c.colunas
        return { data: linhas.map((l) => Object.fromEntries(cols.map((k) => [k, l[k] ?? null]))), error: null }
      }
      return b
    },
  } as unknown as SupabaseClient
  return { sb, consultas }
}

// ───── A5 E4, Tarefa 14: a fixture cheia do montador (todas as partes lidas, canal com dados de verdade) ─────
import { viewsNaIdade, type Leitura, type MarcaLida } from '@/lib/youtube/observatorio/medidas/m1'
import type { Insumos, InsumoDeComentariosDoVideo } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { VideoLido, MudancaLida } from '@/lib/youtube/observatorio/medidas/ler'
import type { RetratoDoCanal } from '@/lib/youtube/observatorio/medidas/direcao'

const D = 864e5, HR = 36e5
/** Um instante fixo do passado (declarado, nunca `Date.now()`). */
export const AGORA_CHEIA = Date.UTC(2026, 9, 14, 15, 0, 0)
export const HOJE_CHEIA = '2026-10-14'
export const IDADES_LONGOS = [8, 15, 22, 30, 38, 45, 52, 60, 70, 80, 88, 95, 105, 115, 125, 135, 150, 165]
export const IDADES_SHORTS = [10, 25, 40, 55, 70, 85]

/** Views acumuladas de um vídeo `vf` na idade `t` dias: forma fechada, para conferir à mão. */
export const viewsDaCurva = (vf: number, t: number): number => Math.round(vf * (1 - Math.exp(-t / 20)))
export const vfDoVideo = (i: number, short: boolean): number => (short ? 12000 : 20000) * (1 + (i % 5) * 0.3)
/** Retrato do canal no dia de índice `k` (0 = 120 dias atrás; 119 = ontem). */
export const viewsDoRetrato = (k: number): number => 1_000_000 + 4000 * k + 10 * k * k

const iso2 = (ms: number): string => new Date(ms).toISOString()

function leiturasDe(base: number, vf: number): Leitura[] {
  const out: Leitura[] = []
  const pontoEm = (t: number) => {
    const idade = (t - base) / D
    const views = viewsDaCurva(vf, idade)
    out.push({ t, views, likes: Math.round(views * 0.04), comments: Math.round(views * 0.004) })
  }
  for (let h = 2; h <= 72; h += 4) pontoEm(base + h * HR)
  for (let t = base + 4 * D; t <= AGORA_CHEIA - HR; t += D) pontoEm(t)
  return out
}

export interface VideoDaFixture { video: VideoLido; leituras: Leitura[]; marcas: Partial<Record<1 | 7 | 30, MarcaLida>>; vf: number; short: boolean; idade: number }

export function videosDaFixture(): VideoDaFixture[] {
  const lista: Array<{ idade: number; short: boolean }> = [
    ...IDADES_LONGOS.map((idade) => ({ idade, short: false })),
    ...IDADES_SHORTS.map((idade) => ({ idade, short: true })),
  ]
  return lista.map(({ idade, short }, i) => {
    const base = AGORA_CHEIA - idade * D
    const vf = vfDoVideo(i, short)
    const leituras = leiturasDe(base, vf)
    const marcas: Partial<Record<1 | 7 | 30, MarcaLida>> = {}
    for (const a of [1, 7, 30] as const) {
      if (idade < a + 2) continue
      const r = viewsNaIdade(leituras, base, a, { maxGapHoras: a === 1 ? 8 : 36 })
      if ('medido' in r) marcas[a] = { views: r.medido.views, likes: r.medido.likes, comments: r.medido.comments, readBeforeAt: r.medido.antes, readAfterAt: r.medido.depois, ageBaseAt: base }
    }
    const atual = viewsDaCurva(vf, idade)
    const video: VideoLido = {
      id: 'v' + i, videoId: 'yt' + i, publishedAt: iso2(base), liveActualStartAt: null, liveBroadcastContent: 'none', wasLive: false, isShort: short,
      durationSeconds: short ? 40 : 600, viewCount: atual, likeCount: Math.round(atual * 0.04), commentCount: Math.round(atual * 0.004),
      likesHidden: false, commentsDisabled: false, viewsHidden: false, discoveredAt: iso2(base + HR), missingSince: null, seriesTier: 'diaria', lastCheckedAt: iso2(AGORA_CHEIA),
    }
    return { video, leituras, marcas, vf, short, idade }
  })
}

export function insumosCheios(): Insumos {
  const vs = videosDaFixture()
  const marcas = new Map<string, Partial<Record<1 | 7 | 30, MarcaLida>>>()
  const series = new Map<string, Leitura[]>()
  const multiplos = new Map<string, { valor: number | null; baseFraca: boolean }>()
  const comentarios = new Map<string, InsumoDeComentariosDoVideo>()
  const mudancas = new Map<string, MudancaLida[]>()
  vs.forEach((x, i) => {
    marcas.set(x.video.id, x.marcas)
    series.set(x.video.id, x.leituras)
    multiplos.set(x.video.id, { valor: [0.4, 1, 2.5, 1.2, 0.6, 3][i % 6]!, baseFraca: false })
    comentarios.set(x.video.id, { retrato7: 'ok', retrato30: 'ok', algumComRespostaDoCriador: i % 3 === 0, maiorCurtidas7: 300, maiorCurtidas30: 300 })
  })
  mudancas.set('v4', [{ campo: 'titulo', em: AGORA_CHEIA - 30 * D, valueText: null }])
  const retratos: RetratoDoCanal[] = Array.from({ length: 120 }, (_, k) => ({ dia: new Date(Date.parse(HOJE_CHEIA + 'T00:00:00Z') - (120 - k) * D).toISOString().slice(0, 10), views: viewsDoRetrato(k) }))
  return {
    canal: { lido: true, dados: { id: 'c1', siteId: 's1', collectionPausedAt: null, missingSince: null } },
    videos: { lido: true, dados: vs.map((x) => x.video) },
    marcas: { lido: true, dados: { marcas, faltas: new Map() } },
    retratos: { lido: true, dados: retratos },
    series: { lido: true, dados: { series, foraDoCanal: 0 } },
    mudancas: { lido: true, dados: { mudancas, foraDoCanal: 0 } },
    multiplos,
    comentarios: { lido: true, dados: { coletaDesdeMs: AGORA_CHEIA - 60 * D, porVideo: comentarios } },
  }
}
