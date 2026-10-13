// @vitest-environment node
// A tarefa inteira da leitura horária (A5 E16, Tarefa 9): banco falso em memória, `fetch` falso, `recordQuota` simulada.
// Nenhuma rede, nenhum banco. Datas relativas ao relógio (nunca data futura fixa).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/youtube/competitor-quota', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('@/lib/youtube/competitor-quota')>()
  return { ...original, recordQuota: vi.fn() }
})

import { recordQuota, pacificDate } from '@/lib/youtube/competitor-quota'
import { executarLeituraHoraria } from '@/lib/youtube/horaria/executar'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import type { ResultadoTarefa } from '@/lib/youtube/agenda/tipos'

const H = 3_600_000
const DIA = 24 * H
const CHAVE = 'AIzaSy-CHAVE-SECRETA-DE-TESTE'
const SENTINELA = 'TEXTO-SENTINELA-DE-FORA-NAO-PODE-SAIR'
const SITE = 'site-1'
const HORA = Math.floor(Date.now() / H) * H
const iso = (ms: number): string => new Date(ms).toISOString()

const relogio = { t: HORA + 40_000 }

// ───────────────────────── o banco falso ─────────────────────────
type Linha = Record<string, unknown>
type Modo = 'erro' | 'nulo' | 'lanca' | 'pendura'
interface Ida { tabela: string; op: 'select' | 'upsert'; filtros: string[]; linhas: number; de: number | null }
interface Resposta { data: Linha[] | null; error: { message: string; code: string } | null }
interface Banco {
  sb: SupabaseClient
  tabelas: Map<string, Linha[]>
  idas: Ida[]
  falha: (tabela: string, op: 'select' | 'upsert', n: number) => Modo | undefined
}
interface Q {
  select: (c?: string) => Q
  eq: (c: string, v: unknown) => Q
  gt: (c: string, v: string) => Q
  gte: (c: string, v: string) => Q
  lt: (c: string, v: string) => Q
  in: (c: string, v: unknown[]) => Q
  or: (expr: string) => Q
  not: (c: string, op: string, v: unknown) => Q
  order: (c: string, o?: { ascending?: boolean }) => Q
  range: (de: number, ate: number) => Q
  abortSignal: (s: AbortSignal) => Q
  upsert: (linhas: Linha[], o: { onConflict: string; ignoreDuplicates?: boolean }) => Q
  then: (ok: (r: Resposta) => unknown, err?: (e: unknown) => unknown) => Promise<unknown>
}

/** PostgREST `or(...)` mínimo: termos `col.op.valor` (gt, is.null) e `and(termo,termo)`, separados por vírgula fora de parênteses. */
function avaliarOr(expr: string, r: Record<string, unknown>): boolean {
  const partes = (s: string): string[] => {
    const out: string[] = []
    let nivel = 0, ini = 0
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') nivel++
      else if (s[i] === ')') nivel--
      else if (s[i] === ',' && nivel === 0) { out.push(s.slice(ini, i)); ini = i + 1 }
    }
    out.push(s.slice(ini))
    return out
  }
  const termo = (t: string): boolean => {
    if (t.startsWith('and(') && t.endsWith(')')) return partes(t.slice(4, -1)).every(termo)
    const i = t.indexOf('.'), j = t.indexOf('.', i + 1)
    const col = t.slice(0, i), op = t.slice(i + 1, j), val = t.slice(j + 1)
    const v = r[col]
    if (op === 'is' && val === 'null') return v === null || v === undefined
    if (op === 'gt') return typeof v === 'string' && v > val
    throw new Error(`or() do banco falso não conhece ${op}`)
  }
  return partes(expr).some(termo)
}

function criarBanco(): Banco {
  const tabelas = new Map<string, Linha[]>()
  const contagem = new Map<string, number>()
  const banco: Banco = { sb: undefined as never, tabelas, idas: [], falha: () => undefined }
  const linhasDe = (t: string): Linha[] => {
    let l = tabelas.get(t)
    if (!l) { l = []; tabelas.set(t, l) }
    return l
  }
  banco.sb = {
    from: (tabela: string): Q => {
      const filtros: Array<(r: Linha) => boolean> = []
      const nomes: string[] = []
      const ordem: Array<{ col: string; asc: boolean }> = []
      let faixa: [number, number] | null = null
      let escrita: { linhas: Linha[]; chaves: string[]; ignorar: boolean } | null = null
      const rodar = async (): Promise<Resposta> => {
        const op = escrita ? 'upsert' : 'select'
        const k = `${tabela}:${op}`
        const n = contagem.get(k) ?? 0
        contagem.set(k, n + 1)
        banco.idas.push({ tabela, op, filtros: nomes, linhas: escrita?.linhas.length ?? 0, de: faixa ? faixa[0] : null })
        const modo = banco.falha(tabela, op, n)
        if (modo === 'pendura') return new Promise<Resposta>(() => undefined)
        if (modo === 'lanca') throw new Error(SENTINELA)
        if (modo === 'erro') return { data: null, error: { message: SENTINELA, code: 'XX000' } }
        if (modo === 'nulo') return { data: null, error: null }
        if (escrita) {
          const alvo = linhasDe(tabela)
          for (const l of escrita.linhas) {
            const igual = (r: Linha): boolean => escrita !== null && escrita.chaves.every(c => r[c] === l[c])
            const i = alvo.findIndex(igual)
            if (i >= 0) { if (!escrita.ignorar) alvo[i] = { ...l } } else alvo.push({ ...l })
          }
          return { data: null, error: null }
        }
        let rows = linhasDe(tabela).filter(r => filtros.every(f => f(r)))
        rows = [...rows].sort((a, b) => {
          for (const o of ordem) {
            const x = String(a[o.col] ?? ''), y = String(b[o.col] ?? '')
            if (x !== y) return (x < y ? -1 : 1) * (o.asc ? 1 : -1)
          }
          return 0
        })
        if (faixa) rows = rows.slice(faixa[0], faixa[1] + 1)
        return { data: rows, error: null }
      }
      const q: Q = {
        select: () => q,
        eq: (c, v) => { filtros.push(r => r[c] === v); nomes.push(`eq:${c}`); return q },
        gt: (c, v) => { filtros.push(r => typeof r[c] === 'string' && (r[c] as string) > v); nomes.push(`gt:${c}`); return q },
        gte: (c, v) => { filtros.push(r => typeof r[c] === 'string' && (r[c] as string) >= v); nomes.push(`gte:${c}`); return q },
        lt: (c, v) => { filtros.push(r => typeof r[c] === 'string' && (r[c] as string) < v); nomes.push(`lt:${c}`); return q },
        in: (c, v) => { filtros.push(r => v.includes(r[c])); nomes.push(`in:${c}`); return q },
        or: expr => { filtros.push(r => avaliarOr(expr, r)); nomes.push(`or:${expr.split('.')[0]}`); return q },
        not: (c, _op, _v) => { filtros.push(r => r[c] !== null && r[c] !== undefined); nomes.push(`not:${c}`); return q },
        order: (c, o) => { ordem.push({ col: c, asc: o?.ascending !== false }); return q },
        range: (de, ate) => { faixa = [de, ate]; return q },
        abortSignal: () => q,
        upsert: (linhas, o) => { escrita = { linhas, chaves: o.onConflict.split(','), ignorar: o.ignoreDuplicates === true }; return q },
        then: (ok, err) => rodar().then(ok, err),
      }
      return q
    },
  } as never
  return banco
}

const linhas = (b: Banco, t: string): Linha[] => b.tabelas.get(t) ?? []
const idasEm = (b: Banco, t: string, op: 'select' | 'upsert'): Ida[] => b.idas.filter(i => i.tabela === t && i.op === op)

// ───────────────────────── os candidatos ─────────────────────────
let seq = 0
interface OpConc { canal?: string; site?: string; idadeMs?: number; descobertoApos?: number | null; lbc?: string | null; prefixo?: string }
/** Semeia `n` vídeos de concorrente; devolve os ids do YouTube. */
function conc(b: Banco, n: number, o: OpConc = {}): string[] {
  const idade = o.idadeMs ?? 2 * H
  const prefixo = o.prefixo ?? `c${++seq}`
  const tab = b.tabelas.get('competitor_videos') ?? []
  b.tabelas.set('competitor_videos', tab)
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const yt = `yt-${prefixo}-${String(i).padStart(4, '0')}`
    const pub = relogio.t - idade
    tab.push({
      id: `u-${prefixo}-${String(i).padStart(4, '0')}`,
      video_id: yt,
      competitor_channel_id: o.canal ?? 'canal-1',
      published_at: iso(pub),
      discovered_at: o.descobertoApos === null ? null : iso(pub + (o.descobertoApos ?? H)),
      live_broadcast_content: o.lbc ?? null,
      missing_since: null,
      competitor_channels: { site_id: o.site ?? SITE, missing_since: null },
    })
    ids.push(yt)
  }
  return ids
}
interface OpProp { canal?: string; site?: string; idadeMs?: number; criadoHa?: number; prefixo?: string }
function prop(b: Banco, n: number, o: OpProp = {}): string[] {
  const prefixo = o.prefixo ?? `p${++seq}`
  const tab = b.tabelas.get('youtube_videos') ?? []
  b.tabelas.set('youtube_videos', tab)
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const yt = `yt-${prefixo}-${String(i).padStart(4, '0')}`
    tab.push({
      id: `up-${prefixo}-${String(i).padStart(4, '0')}`,
      youtube_video_id: yt,
      channel_id: o.canal ?? 'dono-1',
      site_id: o.site ?? SITE,
      published_at: iso(relogio.t - (o.idadeMs ?? 2 * H)),
      created_at: iso(relogio.t - (o.criadoHa ?? H)),
    })
    ids.push(yt)
  }
  return ids
}
/** Uma captura diária do dono. `diasAtras` conta em Pacífico. */
function captura(b: Banco, ytId: string, diasAtras: number, status: string | null): void {
  const tab = b.tabelas.get('yt_own_video_meta_daily') ?? []
  b.tabelas.set('yt_own_video_meta_daily', tab)
  tab.push({ youtube_video_id: ytId, day_pt: pacificDate(relogio.t - diasAtras * DIA), privacy_status: status })
}

// ───────────────────────── o YouTube falso ─────────────────────────
interface OpFetch {
  priv?: Record<string, string | null>
  faltam?: ReadonlySet<string>
  aoVivo?: ReadonlySet<string>
  semStatistica?: boolean
  responder?: (ids: string[], n: number) => Response | undefined
  aoResponder?: () => void
}
interface Falso { fetchImpl: typeof fetch; urls: string[]; pedidos: string[][] }
const resposta = (corpo: unknown, status = 200): Response => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
function youtube(o: OpFetch = {}): Falso {
  const urls: string[] = []
  const pedidos: string[][] = []
  const fetchImpl = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    urls.push(url)
    const ids = (new URL(url).searchParams.get('id') ?? '').split(',').filter(Boolean)
    pedidos.push(ids)
    o.aoResponder?.()
    const custom = o.responder?.(ids, urls.length - 1)
    if (custom) return custom
    const items = ids.filter(id => !o.faltam?.has(id)).map(id => {
      const it: Record<string, unknown> = { id }
      if (!o.semStatistica) it.statistics = { viewCount: '100', likeCount: '10', commentCount: '2' }
      const priv = o.priv && id in o.priv ? o.priv[id] : 'public'
      if (priv !== null) it.status = { privacyStatus: priv }
      if (o.aoVivo?.has(id)) it.liveStreamingDetails = { actualStartTime: iso(relogio.t - H) }
      return it
    })
    return resposta({ items })
  }) as typeof fetch
  return { fetchImpl, urls, pedidos }
}

type Guarda = () => Promise<null | { tipo: 'ausente' | 'nao_conferido' }>
type Relatar = (tarefa: string, o: { codigo: string; tecnico?: { classe: string; sqlstate: string | null } }) => void
async function rodar(b: Banco, f: Falso, o: { guarda?: Guarda; relatar?: Relatar } = {}): Promise<ResultadoTarefa> {
  return executarLeituraHoraria({
    sb: b.sb, apiKey: CHAVE, t0: relogio.t, agora: () => relogio.t,
    guarda: o.guarda ?? (async () => null), fetchImpl: f.fetchImpl,
    ...(o.relatar ? { relatar: o.relatar } : {}),
  })
}
const det = (r: ResultadoTarefa): Record<string, number> => r.detalhe ?? {}
/** Deixa a tarefa chegar à espera do banco (turnos reais) e só então avança o relógio falso. */
async function comRelogioFalso<T>(p: Promise<T>, ms: number): Promise<T> {
  for (let i = 0; i < 30; i++) await new Promise<void>(r => setImmediate(r))
  await vi.advanceTimersByTimeAsync(ms)
  return p
}

beforeEach(() => {
  relogio.t = HORA + 40_000
  vi.mocked(recordQuota).mockReset()
  vi.mocked(recordQuota).mockResolvedValue(undefined)
})
afterEach(() => { vi.useRealTimers() })

describe('executarLeituraHoraria: idempotência e retomada', () => {
  it('duas execuções na mesma hora: uma leitura por vídeo e a segunda não chama a API', async () => {
    const b = criarBanco(); conc(b, 10)
    const f = youtube()
    const r1 = await rodar(b, f)
    expect(r1.estado).toBe('ok')
    expect(r1.feitas).toBe(10)
    expect(f.urls).toHaveLength(1)
    relogio.t += 20 * 60_000
    const r2 = await rodar(b, f)
    expect(f.urls).toHaveLength(1)
    expect(r2.estado).toBe('ok')
    expect(det(r2).chamadas).toBe(0)
    expect(det(r2).ja_lidos).toBe(10)
    expect(det(r2).pedidos).toBe(0)
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(10)
    expect(linhas(b, 'competitor_video_early')).toHaveLength(10)
  })

  it('a segunda execução lê só o que ficou', async () => {
    const b = criarBanco()
    conc(b, 19, { canal: 'a' }); conc(b, 19, { canal: 'b' }); conc(b, 19, { canal: 'c' }) // 57 ids: blocos de 50 e 7
    const f1 = youtube({ responder: ids => (ids.length === 7 ? resposta({ error: { code: 500 } }, 500) : undefined) })
    const r1 = await rodar(b, f1)
    expect(r1.estado).toBe('parcial')
    expect(r1.motivo).toBe('sobrou')
    expect(r1.feitas).toBe(50)
    expect(r1.deixadas).toBe(7)
    const faltaram = new Set(f1.pedidos.find(p => p.length === 7))
    relogio.t += 20 * 60_000
    const f2 = youtube()
    const r2 = await rodar(b, f2)
    expect(f2.pedidos).toHaveLength(1)
    expect(new Set(f2.pedidos[0])).toEqual(faltaram)
    expect(f2.pedidos[0]).toHaveLength(7)
    expect(r2.estado).toBe('ok')
    expect(det(r2).ja_lidos).toBe(50)
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(57)
  })

  it('os já lidos são buscados pela hora, em páginas', async () => {
    const b = criarBanco()
    for (let c = 0; c < 75; c++) conc(b, 25, { canal: `canal-${c}`, prefixo: `m${c}` })
    expect(linhas(b, 'competitor_videos')).toHaveLength(1875)
    for (const v of linhas(b, 'competitor_videos')) {
      const hourly = b.tabelas.get('competitor_video_hourly') ?? []
      b.tabelas.set('competitor_video_hourly', hourly)
      hourly.push({ video_id: v.id, hour_slot: iso(HORA), taken_at: iso(HORA + 40_000), views: 100, likes: 10, comments: 2 })
      const early = b.tabelas.get('competitor_video_early') ?? []
      b.tabelas.set('competitor_video_early', early)
      early.push({ video_id: v.id, taken_at: iso(HORA + 40_000), views: 100, likes: 10, comments: 2 })
    }
    const f = youtube()
    const r = await rodar(b, f)
    expect(f.urls).toHaveLength(0)
    expect(r.estado).toBe('ok')
    expect(det(r).ja_lidos).toBe(1875)
    expect(det(r).lista).toBe(1875)
    expect(idasEm(b, 'competitor_video_hourly', 'select')).toHaveLength(2)
    expect(idasEm(b, 'competitor_video_early', 'select')).toHaveLength(2)
    expect(idasEm(b, 'yt_own_public_video_hourly', 'select')).toHaveLength(1)
    expect(idasEm(b, 'yt_own_public_video_early', 'select')).toHaveLength(1)
    const dasTabelas = b.idas.filter(i => i.tabela.includes('hourly') || i.tabela.includes('early'))
    expect(dasTabelas.some(i => i.filtros.some(n => n.startsWith('in:')))).toBe(false)
  })

  it('não conseguir ler os já lidos é erro, não "ninguém lido"', async () => {
    for (const modo of ['erro', 'nulo', 'lanca'] as const) {
      const b = criarBanco(); conc(b, 3)
      b.falha = (t, op) => (t === 'competitor_video_hourly' && op === 'select' ? modo : undefined)
      const f = youtube()
      const r = await rodar(b, f)
      expect(r.estado).toBe('erro')
      expect(r.motivo).toBe('ja_lidos_falhou')
      expect(f.urls).toHaveLength(0)
    }
    // a tabela da curva do dono também conta
    const b2 = criarBanco(); conc(b2, 3)
    b2.falha = (t, op) => (t === 'yt_own_public_video_early' && op === 'select' ? 'erro' : undefined)
    expect((await rodar(b2, youtube())).motivo).toBe('ja_lidos_falhou')
    // sexta página cheia: 6.000 leituras na hora
    const b3 = criarBanco(); conc(b3, 3)
    const cheia: Linha[] = []
    for (let i = 0; i < 6000; i++) cheia.push({ video_id: `x-${String(i).padStart(5, '0')}`, hour_slot: iso(HORA), taken_at: iso(HORA + 40_000), views: 1, likes: null, comments: null })
    b3.tabelas.set('competitor_video_hourly', cheia)
    const f3 = youtube()
    const r3 = await rodar(b3, f3)
    expect(r3.estado).toBe('erro')
    expect(r3.motivo).toBe('ja_lidos_falhou')
    expect(f3.urls).toHaveLength(0)
  })
})

describe('executarLeituraHoraria: os vídeos do dono', () => {
  it('as leituras do dono vão para yt_own_public_video_hourly, nunca para competitor_*', async () => {
    const b = criarBanco(); const [id] = prop(b, 1)
    const r = await rodar(b, youtube({ priv: { [id as string]: 'public' } }))
    expect(r.estado).toBe('ok')
    const dono = linhas(b, 'yt_own_public_video_hourly')
    expect(dono).toHaveLength(1)
    expect(dono[0]).toMatchObject({ youtube_video_id: id, site_id: SITE, channel_id: 'dono-1', views: 100, likes: 10, comments: 2 })
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(0)
    expect(linhas(b, 'competitor_video_early')).toHaveLength(0)
  })

  it('vídeo do dono não listado, privado ou sem status na resposta não é gravado', async () => {
    const b = criarBanco(); const [a, p, s] = prop(b, 3) as [string, string, string]
    const r = await rodar(b, youtube({ priv: { [a]: 'unlisted', [p]: 'private', [s]: null } }))
    expect(r.estado).toBe('ok')
    expect(linhas(b, 'yt_own_public_video_hourly')).toHaveLength(0)
    expect(linhas(b, 'yt_own_public_video_early')).toHaveLength(0)
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(0)
    expect(det(r).proprios_fora_nao_publico).toBe(2)
    expect(det(r).proprios_fora_sem_status).toBe(1)
    expect(r.feitas).toBe(0)
  })

  it('vídeo do dono público há uma hora, sem captura nenhuma, é lido e entra na curva', async () => {
    const b = criarBanco(); const [id] = prop(b, 1, { criadoHa: H, idadeMs: 2 * H })
    const r = await rodar(b, youtube({ priv: { [id as string]: 'public' } }))
    expect(r.estado).toBe('ok')
    expect(linhas(b, 'yt_own_public_video_hourly')).toHaveLength(1)
    expect(linhas(b, 'yt_own_public_video_early')).toHaveLength(1)
    expect(b.idas.filter(i => i.tabela === 'yt_own_video_meta_daily')).toHaveLength(0)
    expect(det(r).proprios_cruas).toBe(1)
    expect(det(r).proprios_curva).toBe(1)
  })

  it('vídeo do dono pedido e não devolvido conta à parte do concorrente', async () => {
    const b = criarBanco()
    const c = conc(b, 7); const [p] = prop(b, 1) as [string]
    const r = await rodar(b, youtube({ faltam: new Set([c[6] as string, p]) }))
    expect(r.estado).toBe('ok')
    expect(det(r).pedidos).toBe(8)
    expect(det(r).nao_devolvidos).toBe(2)
    expect(det(r).proprios_nao_devolvidos).toBe(1)
    expect(det(r).lidos).toBe(6)
    const gravados = linhas(b, 'competitor_video_hourly').map(l => l.video_id)
    expect(gravados).toHaveLength(6)
    expect(linhas(b, 'yt_own_public_video_hourly')).toHaveLength(0)
  })

  it('rascunho privado do dono não entra no desconto', async () => {
    const b = criarBanco(); const [p] = prop(b, 1) as [string]
    captura(b, p, 1, 'private')
    const r = await rodar(b, youtube({ faltam: new Set([p]) }))
    expect(det(r).proprios_nao_devolvidos).toBe(1)
    expect(det(r).proprios_negados_cobraveis).toBe(0)
    expect(det(r).proprios_negados_sem_classe).toBe(0)
  })

  it('não listado antigo do dono não entra no desconto', async () => {
    const b = criarBanco(); const [p] = prop(b, 1) as [string]
    captura(b, p, 1, 'unlisted')
    const r = await rodar(b, youtube({ priv: { [p]: 'unlisted' } }))
    expect(det(r).proprios_fora_nao_publico).toBe(1)
    expect(det(r).proprios_negados_cobraveis).toBe(0)
  })

  it('vídeo que a captura ainda diz público e a resposta nega entra', async () => {
    const b = criarBanco(); const [a, n, velho] = prop(b, 3) as [string, string, string]
    captura(b, a, 1, 'public')
    captura(b, n, 1, 'public')
    captura(b, velho, 5, 'public')
    const r = await rodar(b, youtube({ priv: { [a]: 'unlisted', [velho]: 'unlisted' }, faltam: new Set([n]) }))
    expect(det(r).proprios_negados_cobraveis).toBe(2)
    expect(det(r).proprios_negados_sem_classe).toBe(0)
    expect(r.estado).toBe('ok')
  })

  it('captura que não pôde ser lida: sem desconto, com contador', async () => {
    // a consulta lança
    const b1 = criarBanco(); const [p1] = prop(b1, 1) as [string]
    b1.falha = t => (t === 'yt_own_video_meta_daily' ? 'lanca' : undefined)
    const r1 = await rodar(b1, youtube({ priv: { [p1]: 'unlisted' } }))
    expect(det(r1).proprios_negados_cobraveis).toBe(0)
    expect(det(r1).proprios_negados_sem_classe).toBe(1)
    expect(r1.estado).toBe('ok')
    // a consulta nunca resolve
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const b2 = criarBanco(); const [p2] = prop(b2, 1) as [string]
    b2.falha = t => (t === 'yt_own_video_meta_daily' ? 'pendura' : undefined)
    const r2 = await comRelogioFalso(rodar(b2, youtube({ priv: { [p2]: 'unlisted' } })), BANCO_MS)
    expect(det(r2).proprios_negados_cobraveis).toBe(0)
    expect(det(r2).proprios_negados_sem_classe).toBe(1)
    expect(r2.estado).toBe('ok')
    vi.useRealTimers()
    // sem negados, o banco não é chamado e os dois contadores existem, valendo 0
    const b3 = criarBanco(); const [p3] = prop(b3, 1) as [string]
    const r3 = await rodar(b3, youtube({ priv: { [p3]: 'public' } }))
    expect(b3.idas.filter(i => i.tabela === 'yt_own_video_meta_daily')).toHaveLength(0)
    expect(det(r3).proprios_negados_cobraveis).toBe(0)
    expect(det(r3).proprios_negados_sem_classe).toBe(0)
  })

  it('vale a linha de maior day_pt, não "algum public nos últimos 3 dias"', async () => {
    const b = criarBanco(); const [cinco, virou, nulo, ontem] = prop(b, 4) as [string, string, string, string]
    captura(b, cinco, 5, 'public')
    captura(b, virou, 2, 'public'); captura(b, virou, 1, 'private')
    captura(b, nulo, 2, 'public'); captura(b, nulo, 1, null)
    captura(b, ontem, 1, 'public')
    const r = await rodar(b, youtube({ priv: { [cinco]: 'unlisted', [virou]: 'unlisted', [nulo]: 'unlisted', [ontem]: 'unlisted' } }))
    expect(det(r).proprios_negados_cobraveis).toBe(2)
  })

  it('acima de 250 ids a classificação recusa', async () => {
    const montar = (n: number): { b: Banco; priv: Record<string, string> } => {
      const b = criarBanco(); const priv: Record<string, string> = {}
      let falta = n, c = 0
      while (falta > 0) {
        const k = Math.min(25, falta)
        for (const id of prop(b, k, { canal: `dono-${c}`, prefixo: `q${c}` })) priv[id] = 'unlisted'
        falta -= k; c++
      }
      return { b, priv }
    }
    const g = montar(251)
    const r = await rodar(g.b, youtube({ priv: g.priv }))
    expect(g.b.idas.filter(i => i.tabela === 'yt_own_video_meta_daily')).toHaveLength(0)
    expect(det(r).proprios_negados_cobraveis).toBe(0)
    expect(det(r).proprios_negados_sem_classe).toBe(251)
    expect(r.estado).toBe('ok')
    const p = montar(250)
    const r250 = await rodar(p.b, youtube({ priv: p.priv }))
    expect(p.b.idas.filter(i => i.tabela === 'yt_own_video_meta_daily')).toHaveLength(1)
    expect(det(r250).proprios_negados_sem_classe).toBe(0)
  })
})

describe('executarLeituraHoraria: concorrente, curva e duplicados', () => {
  it('concorrente não listado continua sendo lido', async () => {
    const b = criarBanco(); const [id] = conc(b, 1)
    const r = await rodar(b, youtube({ priv: { [id as string]: 'unlisted' } }))
    expect(r.estado).toBe('ok')
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(1)
  })

  it('o mesmo id como concorrente e como próprio: uma chamada, uma linha em cada tabela', async () => {
    const b = criarBanco()
    const [id] = conc(b, 1, { prefixo: 'dup' }) as [string]
    const tabProp = b.tabelas.get('youtube_videos') ?? []
    b.tabelas.set('youtube_videos', tabProp)
    tabProp.push({ id: 'up-dup', youtube_video_id: id, channel_id: 'dono-1', site_id: SITE, published_at: iso(relogio.t - 2 * H), created_at: iso(relogio.t - H) })
    const f = youtube()
    const r = await rodar(b, f)
    expect(r.estado).toBe('ok')
    expect(f.urls).toHaveLength(1)
    expect(f.pedidos[0]).toEqual([id])
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(1)
    expect(linhas(b, 'yt_own_public_video_hourly')).toHaveLength(1)
    expect(r.feitas).toBe(2)
  })

  it('curva de 72 horas só para descoberto em até 24 h e com menos de 72 h', async () => {
    const b = criarBanco()
    const [a] = conc(b, 1, { prefixo: 'a', idadeMs: 10 * H, descobertoApos: 2 * H }) as [string]
    conc(b, 1, { prefixo: 'b', idadeMs: 40 * H, descobertoApos: 30 * H })
    conc(b, 1, { prefixo: 'c', idadeMs: 80 * H, descobertoApos: H })
    conc(b, 1, { prefixo: 'd', idadeMs: 5 * H, descobertoApos: null })
    const r = await rodar(b, youtube())
    expect(r.estado).toBe('ok')
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(4)
    const curva = linhas(b, 'competitor_video_early')
    expect(curva).toHaveLength(1)
    expect(curva[0]?.video_id).toBe('u-a-0000')
    expect(a).toBe('yt-a-0000')
  })
})

describe('executarLeituraHoraria: falhas de gravação e da curva', () => {
  it('erro nas cruas: tarefa em erro e a curva não é tentada', async () => {
    const b = criarBanco(); conc(b, 5)
    b.falha = (t, op) => (t === 'competitor_video_hourly' && op === 'upsert' ? 'erro' : undefined)
    const f = youtube()
    const r = await rodar(b, f)
    expect(r.estado).toBe('erro')
    expect(r.motivo).toBe('gravacao_falhou')
    expect(idasEm(b, 'competitor_video_early', 'upsert')).toHaveLength(0)
    expect(linhas(b, 'competitor_video_early')).toHaveLength(0)
    // a hora ficou perdida e a próxima execução pede de novo
    b.falha = () => undefined
    relogio.t += 20 * 60_000
    const f2 = youtube()
    const r2 = await rodar(b, f2)
    expect(f2.pedidos[0]).toHaveLength(5)
    expect(r2.estado).toBe('ok')
  })

  it('erro só na curva: parcial, as cruas ficam', async () => {
    const b = criarBanco(); conc(b, 5)
    b.falha = (t, op) => (t === 'competitor_video_early' && op === 'upsert' ? 'erro' : undefined)
    const r = await rodar(b, youtube())
    expect(r.estado).toBe('parcial')
    expect(r.motivo).toBe('curva_falhou')
    expect(r.feitas).toBe(5)
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(5)
    expect(linhas(b, 'competitor_video_early')).toHaveLength(0)
  })

  it('erro só na curva; o disparo seguinte completa a curva sem chamar o YouTube', async () => {
    const b = criarBanco(); conc(b, 5)
    b.falha = (t, op) => (t === 'competitor_video_early' && op === 'upsert' ? 'erro' : undefined)
    const f = youtube()
    await rodar(b, f)
    b.falha = () => undefined
    relogio.t += 20 * 60_000
    const r2 = await rodar(b, f)
    expect(f.urls).toHaveLength(1)
    expect(r2.estado).toBe('ok')
    expect(det(r2).chamadas).toBe(0)
    expect(det(r2).curva_completada).toBe(5)
    const curva = linhas(b, 'competitor_video_early')
    const cruas = linhas(b, 'competitor_video_hourly')
    expect(curva).toHaveLength(5)
    for (const c of curva) {
      const crua = cruas.find(x => x.video_id === c.video_id)
      expect(c.taken_at).toBe(crua?.taken_at)
      expect(c.views).toBe(crua?.views)
      expect(c.likes).toBe(crua?.likes)
      expect(c.comments).toBe(crua?.comments)
    }
  })

  it('a curva não é completada duas vezes, nem quando a sincronização já gravou naquela hora', async () => {
    const b = criarBanco(); conc(b, 5)
    b.falha = (t, op, n) => (t === 'competitor_video_early' && op === 'upsert' && n === 0 ? 'erro' : undefined)
    const f = youtube()
    await rodar(b, f)
    relogio.t += 20 * 60_000
    await rodar(b, f)
    expect(linhas(b, 'competitor_video_early')).toHaveLength(5)
    relogio.t += 20 * 60_000
    const r3 = await rodar(b, f)
    expect(linhas(b, 'competitor_video_early')).toHaveLength(5)
    expect(det(r3).curva_completada).toBe(0)
    expect(r3.estado).toBe('ok')

    // a E2 gravou a curva às HORA+5min; a leitura crua falhou na curva
    const b2 = criarBanco(); const [x] = conc(b2, 1, { prefixo: 'e2' }) as [string]
    b2.tabelas.set('competitor_video_hourly', [{ video_id: 'u-e2-0000', hour_slot: iso(HORA), taken_at: iso(HORA + 40_000), views: 100, likes: 10, comments: 2 }])
    b2.tabelas.set('competitor_video_early', [{ video_id: 'u-e2-0000', taken_at: iso(HORA + 5 * 60_000), views: 99, likes: null, comments: null }])
    const r = await rodar(b2, youtube())
    expect(x).toBe('yt-e2-0000')
    expect(r.estado).toBe('ok')
    expect(linhas(b2, 'competitor_video_early')).toHaveLength(1)
    expect(det(r).curva_completada).toBe(0)
  })

  it('completar a curva falha de novo: continua parcial', async () => {
    const b = criarBanco(); conc(b, 5)
    b.falha = (t, op) => (t === 'competitor_video_early' && op === 'upsert' ? 'erro' : undefined)
    const f = youtube()
    await rodar(b, f)
    relogio.t += 20 * 60_000
    const r2 = await rodar(b, f)
    expect(r2.estado).toBe('parcial')
    expect(r2.motivo).toBe('curva_falhou')
    expect(f.urls).toHaveLength(1)
  })

  it('a gravação que não coube no tempo', async () => {
    const b = criarBanco(); conc(b, 3)
    const f = youtube({ aoResponder: () => { relogio.t += 56_000 } })
    const r = await rodar(b, f)
    expect(r.estado).toBe('erro')
    expect(r.motivo).toBe('gravacao_sem_tempo')
    expect(b.idas.filter(i => i.op === 'upsert')).toHaveLength(0)
  })
})

describe('executarLeituraHoraria: a lista', () => {
  it('lista vazia é ok com zero', async () => {
    const b = criarBanco()
    const f = youtube()
    const r = await rodar(b, f)
    expect(r.estado).toBe('ok')
    expect(r.feitas).toBe(0)
    expect(r.motivo).toBeUndefined()
    expect(det(r).lista).toBe(0)
    expect(det(r).pedidos).toBe(0)
    expect(det(r).chamadas).toBe(0)
    expect(f.urls).toHaveLength(0)
    expect(vi.mocked(recordQuota)).not.toHaveBeenCalled()
  })

  it('consulta da lista falha', async () => {
    const b = criarBanco(); conc(b, 2)
    b.falha = (t, op) => (t === 'competitor_videos' && op === 'select' ? 'erro' : undefined)
    const f = youtube()
    const r = await rodar(b, f)
    expect(r.estado).toBe('erro')
    expect(r.motivo).toBe('lista_falhou')
    expect(f.urls).toHaveLength(0)
  })

  it('resposta da lista nula ou fora da forma é erro, não lista vazia', async () => {
    const b = criarBanco(); conc(b, 2)
    b.falha = (t, op) => (t === 'competitor_videos' && op === 'select' ? 'nulo' : undefined)
    const f = youtube()
    const r = await rodar(b, f)
    expect(r.estado).toBe('erro')
    expect(r.motivo).toBe('lista_falhou')
    expect(f.urls).toHaveLength(0)
    // a lista do dono também
    const b2 = criarBanco(); prop(b2, 1)
    b2.falha = (t, op) => (t === 'youtube_videos' && op === 'select' ? 'nulo' : undefined)
    expect((await rodar(b2, youtube())).motivo).toBe('lista_falhou')
    // linha fora da forma
    const b3 = criarBanco()
    b3.tabelas.set('competitor_videos', [{ id: 1, video_id: null, published_at: iso(relogio.t - H) }])
    expect((await rodar(b3, youtube())).motivo).toBe('lista_falhou')
  })

  it('mais de 5.000 vídeos na janela é erro', async () => {
    const b = criarBanco()
    for (let c = 0; c < 6; c++) conc(b, 1000, { canal: `canal-${c}`, prefixo: `g${c}` })
    expect(linhas(b, 'competitor_videos')).toHaveLength(6000)
    const f = youtube()
    const r = await rodar(b, f)
    expect(r.estado).toBe('erro')
    expect(r.motivo).toBe('lista_cortada')
    expect(f.urls).toHaveLength(0)
  })

  it('o detalhe diz quantos ficaram fora do teto', async () => {
    const b = criarBanco(); conc(b, 30)
    const r = await rodar(b, youtube())
    expect(det(r).fora_do_teto).toBe(5)
    expect(det(r).lista).toBe(25)
    expect(r.feitas).toBe(25)
  })
})

describe('executarLeituraHoraria: a resposta do YouTube', () => {
  it('todas as chamadas falham', async () => {
    const b = criarBanco(); conc(b, 25, { canal: 'a' }); conc(b, 25, { canal: 'b' }); conc(b, 10, { canal: 'c' })
    const f = youtube({ responder: () => resposta({ error: { message: SENTINELA } }, 500) })
    const r = await rodar(b, f)
    expect(r.estado).toBe('erro')
    expect(r.motivo).toBe('api_falhou')
    expect(det(r).http_da_primeira_falha).toBe(500)
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(0)
    expect(linhas(b, 'competitor_video_early')).toHaveLength(0)
  })

  it('cota esgotada', async () => {
    const b = criarBanco(); conc(b, 3)
    const f = youtube({ responder: () => resposta({ error: { code: 403, errors: [{ reason: 'quotaExceeded' }] } }, 403) })
    const r = await rodar(b, f)
    expect(r.estado).toBe('erro')
    expect(r.motivo).toBe('cota_esgotada')
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(0)
  })

  it('200 com a lista vazia para os 55 vídeos não fecha ok', async () => {
    const b = criarBanco(); conc(b, 25, { canal: 'a' }); conc(b, 25, { canal: 'b' }); conc(b, 5, { canal: 'c' })
    const f = youtube({ responder: () => resposta({ items: [] }) })
    const r = await rodar(b, f)
    expect(f.urls).toHaveLength(2)
    expect(r.estado).toBe('erro')
    expect(r.motivo).toBe('resposta_vazia')
    expect(det(r).pedidos_sem_resposta).toBe(55)
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(0)
  })

  it('todos os itens sem statistics não fecha ok', async () => {
    const b = criarBanco(); conc(b, 25, { canal: 'a' }); conc(b, 25, { canal: 'b' }); conc(b, 5, { canal: 'c' })
    const r = await rodar(b, youtube({ semStatistica: true }))
    expect(r.estado).toBe('erro')
    expect(r.motivo).toBe('resposta_vazia')
    expect(det(r).sem_contagem).toBe(55)
    expect(det(r).pedidos_sem_resposta).toBe(55)
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(0)
  })

  it('três vídeos pedidos e nenhum devolvido é ok com nao_devolvidos', async () => {
    const b = criarBanco(); conc(b, 3)
    const r = await rodar(b, youtube({ responder: () => resposta({ items: [] }) }))
    expect(r.estado).toBe('ok')
    expect(det(r).nao_devolvidos).toBe(3)
    expect(r.feitas).toBe(0)
  })

  it('só ao vivo na lista pedida não é resposta vazia', async () => {
    const b = criarBanco(); const ids = conc(b, 8)
    const r = await rodar(b, youtube({ aoVivo: new Set(ids) }))
    expect(r.estado).toBe('ok')
    expect(det(r).ao_vivo_na_resposta).toBe(8)
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(0)
  })
})

describe('executarLeituraHoraria: a cota', () => {
  it('a cota vai para o modo horario, com os contadores', async () => {
    const b = criarBanco(); conc(b, 25, { canal: 'a' }); conc(b, 25, { canal: 'b' }); conc(b, 5, { canal: 'c' })
    const r = await rodar(b, youtube())
    expect(r.estado).toBe('ok')
    expect(det(r).chamadas).toBe(2)
    expect(vi.mocked(recordQuota)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(recordQuota)).toHaveBeenCalledWith(b.sb, expect.objectContaining({
      siteId: SITE, units: 2, mode: 'horario', nowMs: relogio.t, extra: { horario_lidos: 55, horario_chamadas: 2 },
    }))
    expect(det(r).cota_nao_registrada).toBeUndefined()
  })

  it('falha ao gravar a cota não derruba a leitura', async () => {
    const b = criarBanco(); conc(b, 25, { canal: 'a' }); conc(b, 25, { canal: 'b' }); conc(b, 5, { canal: 'c' })
    vi.mocked(recordQuota).mockRejectedValue(new Error(SENTINELA))
    const r = await rodar(b, youtube())
    expect(r.estado).toBe('ok')
    expect(det(r).cota_nao_registrada).toBe(2)
  })

  it('a gravação da cota que nunca volta não segura a tarefa', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const b = criarBanco(); conc(b, 25, { canal: 'a' }); conc(b, 25, { canal: 'b' }); conc(b, 5, { canal: 'c' })
    vi.mocked(recordQuota).mockReturnValue(new Promise<void>(() => undefined))
    const r = await comRelogioFalso(rodar(b, youtube()), BANCO_MS)
    expect(r.estado).toBe('ok')
    expect(det(r).cota_nao_registrada).toBe(2)
  })

  it('cada chamada é contada para o site com mais ids no bloco; o empate vai ao menor id de site', async () => {
    const b = criarBanco()
    conc(b, 25, { canal: 'a', site: 'site-b', prefixo: 'sb' })
    conc(b, 25, { canal: 'b', site: 'site-a', prefixo: 'sa' })
    conc(b, 10, { canal: 'c', site: 'site-a', prefixo: 'sa2' })
    const r = await rodar(b, youtube())
    expect(r.estado).toBe('ok')
    const chamadas = vi.mocked(recordQuota).mock.calls.map(c => ({ site: c[1].siteId, units: c[1].units }))
    expect(chamadas.reduce((s, c) => s + c.units, 0)).toBe(2)
    // bloco 1: 50 ids (25 de cada site) = empate -> site-a; bloco 2: 10 ids de site-a
    expect(chamadas).toEqual([{ site: 'site-a', units: 2 }])
  })
})

describe('executarLeituraHoraria: o que o conserto da T6/T9 exige', () => {
  it('vídeo sem published_at não some em silêncio: fora_sem_data conta (e ele não é lido)', async () => {
    const b = criarBanco(); conc(b, 2)
    b.tabelas.get('competitor_videos')?.push({
      id: 'u-sem-data', video_id: 'yt-sem-data', competitor_channel_id: 'canal-1', published_at: null,
      discovered_at: iso(relogio.t - H), live_broadcast_content: null, missing_since: null,
      competitor_channels: { site_id: SITE, missing_since: null },
    })
    const f = youtube()
    const r = await rodar(b, f)
    expect(r.estado).toBe('ok')
    expect(det(r).fora_sem_data).toBe(1)
    expect(det(r).lista).toBe(2)
    expect(f.pedidos.flat()).not.toContain('yt-sem-data')
  })

  it('o sqlstate de cada falha do banco chega ao relatar, sem o texto', async () => {
    const casos: Array<{ tabela: string; op: 'select' | 'upsert'; codigo: string; monta: (b: Banco) => void }> = [
      { tabela: 'competitor_videos', op: 'select', codigo: 'lista_falhou', monta: b => { conc(b, 2) } },
      { tabela: 'competitor_video_hourly', op: 'select', codigo: 'ja_lidos_falhou', monta: b => { conc(b, 2) } },
      { tabela: 'competitor_video_hourly', op: 'upsert', codigo: 'gravacao_falhou', monta: b => { conc(b, 2) } },
    ]
    for (const c of casos) {
      const b = criarBanco(); c.monta(b)
      b.falha = (t, op) => (t === c.tabela && op === c.op ? 'erro' : undefined)
      const relatos: Array<{ tarefa: string; codigo: string; tecnico?: { classe: string; sqlstate: string | null } }> = []
      await rodar(b, youtube(), { relatar: (tarefa, o) => { relatos.push({ tarefa, ...o }) } })
      expect(relatos.find(x => x.codigo === c.codigo), c.codigo).toMatchObject({ tarefa: 'leitura_horaria', tecnico: { sqlstate: 'XX000' } })
      expect(JSON.stringify(relatos)).not.toContain(SENTINELA)
    }
  })

  it('a classificação dos negados e a cota que falham também relatam', async () => {
    const b = criarBanco(); const [id] = prop(b, 1)
    b.falha = t => (t === 'yt_own_video_meta_daily' ? 'erro' : undefined)
    vi.mocked(recordQuota).mockRejectedValue(Object.assign(new Error(SENTINELA), { code: '57014' }))
    const relatos: Array<{ tarefa: string; codigo: string; tecnico?: { classe: string; sqlstate: string | null } }> = []
    const r = await rodar(b, youtube({ priv: { [id as string]: 'private' } }), { relatar: (tarefa, o) => { relatos.push({ tarefa, ...o }) } })
    expect(r.estado).toBe('ok')
    expect(relatos.find(x => x.codigo === 'classificacao_falhou')).toMatchObject({ tecnico: { sqlstate: 'XX000' } })
    expect(relatos.find(x => x.codigo === 'cota_nao_registrada')).toMatchObject({ tecnico: { classe: 'Error', sqlstate: '57014' } })
    expect(JSON.stringify(relatos)).not.toContain(SENTINELA)
  })

  it('sem relatar, tudo funciona como antes (falha da lista continua lista_falhou)', async () => {
    const b = criarBanco(); conc(b, 2)
    b.falha = t => (t === 'competitor_videos' ? 'erro' : undefined)
    expect((await rodar(b, youtube())).motivo).toBe('lista_falhou')
  })

  it('a cota não registrada fica no detalhe com o estado do trabalho; quem a torna vermelha é o despachante', async () => {
    const b = criarBanco(); conc(b, 5)
    vi.mocked(recordQuota).mockRejectedValue(new Error(SENTINELA))
    const r = await rodar(b, youtube())
    expect(r.estado).toBe('ok')
    expect(det(r).cota_nao_registrada).toBe(1)
  })
})

describe('executarLeituraHoraria: a guarda e o texto de fora', () => {
  it('sem a MG9; guarda que não conseguiu conferir', async () => {
    const b = criarBanco(); conc(b, 3)
    const f = youtube()
    const r1 = await rodar(b, f, { guarda: async () => ({ tipo: 'ausente' }) })
    expect(r1.estado).toBe('erro')
    expect(r1.motivo).toBe('schema_ausente')
    const r2 = await rodar(b, f, { guarda: async () => ({ tipo: 'nao_conferido' }) })
    expect(r2.estado).toBe('erro')
    expect(r2.motivo).toBe('schema_nao_conferido')
    expect(f.urls).toHaveLength(0)
    expect(b.idas).toHaveLength(0)
    expect(vi.mocked(recordQuota)).not.toHaveBeenCalled()
  })

  it('nenhum texto de fora no resultado', async () => {
    type Preparar = (b: Banco) => { f?: Falso; guarda?: Guarda }
    const cenarios: Array<[string, Preparar]> = [
      ['guarda com texto', () => {
        const g = { tipo: 'ausente' as const, texto: SENTINELA, codigo: '42P01' }
        return { guarda: async () => g }
      }],
      ['lista dos concorrentes', b => { b.falha = (t, op) => (t === 'competitor_videos' && op === 'select' ? 'erro' : undefined); return {} }],
      ['lista do dono', b => { b.falha = (t, op) => (t === 'youtube_videos' && op === 'select' ? 'lanca' : undefined); return {} }],
      ['já lidos', b => { b.falha = (t, op) => (t === 'yt_own_public_video_hourly' && op === 'select' ? 'erro' : undefined); return {} }],
      ['crua', b => { b.falha = (t, op) => (op === 'upsert' && t === 'competitor_video_hourly' ? 'erro' : undefined); return {} }],
      ['crua que lança', b => { b.falha = (t, op) => (op === 'upsert' && t === 'yt_own_public_video_hourly' ? 'lanca' : undefined); return {} }],
      ['curva', b => { b.falha = (t, op) => (op === 'upsert' && t === 'competitor_video_early' ? 'erro' : undefined); return {} }],
      ['captura diária', b => { b.falha = t => (t === 'yt_own_video_meta_daily' ? 'erro' : undefined); return {} }],
      ['cota', () => { vi.mocked(recordQuota).mockRejectedValue(new Error(SENTINELA)); return {} }],
      ['corpo do erro da API', () => ({ f: youtube({ responder: () => resposta({ error: { message: SENTINELA } }, 400) }) })],
      ['fetch que rejeita com a URL', () => ({ f: youtube({ responder: () => { throw new Error(`falhou https://www.googleapis.com/youtube/v3/videos?key=${CHAVE} ${SENTINELA}`) } }) })],
    ]
    for (const [nome, preparar] of cenarios) {
      vi.mocked(recordQuota).mockReset(); vi.mocked(recordQuota).mockResolvedValue(undefined)
      const b = criarBanco()
      conc(b, 3, { prefixo: 'tx' })
      const [, ilegal] = prop(b, 2, { prefixo: 'ty' }) as [string, string]
      const prep = preparar(b)
      const f = prep.f ?? youtube({ priv: { [ilegal]: 'unlisted' } })
      const r = await rodar(b, f, prep.guarda ? { guarda: prep.guarda } : {})
      const json = JSON.stringify(r)
      expect(json, nome).not.toContain(SENTINELA)
      expect(json, nome).not.toContain(CHAVE)
      expect(json, nome).not.toContain('XX000')
      expect(json, nome).not.toContain('googleapis')
      for (const v of Object.values(r.detalhe ?? {})) expect(typeof v, nome).toBe('number')
      if (r.motivo !== undefined) expect(/^[a-z0-9_]{1,60}$/.test(r.motivo), nome).toBe(true)
    }
  })
})
