// @vitest-environment node
// A gravação da leitura horária (A5 E16, Tarefa 9): lista, já lidos, cruas, curva e a classificação dos negados do dono.
// Banco falso em memória; nenhuma rede, nenhum banco. Datas relativas ao relógio.
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { pacificDate } from '@/lib/youtube/competitor-quota'
import {
  ErroDeLeitura, lerCandidatos, jaLidosNaHora, gravarLeituras, completarCurva, contarNegadosCobraveis, type JaLidos,
} from '@/lib/youtube/horaria/gravar'
import type { Alvo } from '@/lib/youtube/horaria/lista'
import type { Contagem } from '@/lib/youtube/horaria/leitura'

const H = 3_600_000
const DIA = 24 * H
const SENTINELA = 'TEXTO-SENTINELA-DE-FORA-NAO-PODE-SAIR'
const HORA = Math.floor(Date.now() / H) * H
const AGORA = HORA + 40_000
const iso = (ms: number): string => new Date(ms).toISOString()

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

const semear = (b: Banco, t: string, l: Linha[]): void => { b.tabelas.set(t, [...(b.tabelas.get(t) ?? []), ...l]) }

const SEMPRE = { agoraMs: AGORA, podeGravar: (): boolean => true }
function alvo(i: number, tipo: 'concorrente' | 'proprio', o: Partial<Alvo> = {}): Alvo {
  return {
    ytId: `yt-${tipo[0]}-${String(i).padStart(4, '0')}`, tipo, uuid: `u-${tipo[0]}-${String(i).padStart(4, '0')}`,
    canalId: tipo === 'proprio' ? 'dono-1' : 'canal-1', siteId: 'site-1',
    publishedAt: iso(AGORA - 2 * H), descobertoEm: iso(AGORA - H), ...o,
  }
}
function contagem(a: Alvo, o: Partial<Contagem> = {}): Contagem {
  return { ytId: a.ytId, lidoEm: iso(AGORA), views: 100, likes: 10, comments: 2, privacidade: 'public', ...o }
}

describe('lerCandidatos', () => {
  it('mapeia as duas tabelas para os candidatos, com o canal embutido', async () => {
    const b = criarBanco()
    semear(b, 'competitor_videos', [{
      id: 'u1', video_id: 'yt1', competitor_channel_id: 'c1', published_at: iso(AGORA - 2 * H), discovered_at: iso(AGORA - H),
      live_broadcast_content: 'none', missing_since: null, competitor_channels: { site_id: 's1', missing_since: iso(AGORA - H) },
    }])
    semear(b, 'youtube_videos', [{ id: 'up1', youtube_video_id: 'ytp1', channel_id: 'd1', site_id: 's1', published_at: iso(AGORA - 3 * H), created_at: iso(AGORA - 2 * H) }])
    const { conc, prop } = await lerCandidatos(b.sb, AGORA)
    expect(conc).toEqual([{
      id: 'u1', ytId: 'yt1', canalId: 'c1', siteId: 's1', publishedAt: iso(AGORA - 2 * H), discoveredAt: iso(AGORA - H),
      lbc: 'none', missingSince: null, canalAusente: true,
    }])
    expect(prop).toEqual([{ id: 'up1', ytId: 'ytp1', canalId: 'd1', siteId: 's1', publishedAt: iso(AGORA - 3 * H), createdAt: iso(AGORA - 2 * H) }])
  })

  it('só pede o que foi publicado nos últimos 14 dias, em ordem estável, sem ler a captura diária do dono', async () => {
    const b = criarBanco()
    semear(b, 'competitor_videos', [
      { id: 'novo', video_id: 'a', competitor_channel_id: 'c', published_at: iso(AGORA - DIA), discovered_at: null, live_broadcast_content: null, missing_since: null, competitor_channels: { site_id: 's', missing_since: null } },
      { id: 'velho', video_id: 'b', competitor_channel_id: 'c', published_at: iso(AGORA - 15 * DIA), discovered_at: null, live_broadcast_content: null, missing_since: null, competitor_channels: { site_id: 's', missing_since: null } },
    ])
    const { conc } = await lerCandidatos(b.sb, AGORA)
    expect(conc.map(c => c.id)).toEqual(['novo'])
    expect(b.idas.some(i => i.tabela === 'yt_own_video_meta_daily')).toBe(false)
    // a janela é `published_at > corte` OU `published_at nulo` com descoberta dentro da janela: o nulo precisa chegar a montarLista
    expect(idasEm(b, 'competitor_videos', 'select')[0]?.filtros).toContain('or:published_at')
  })

  it('vídeo sem published_at, descoberto na janela, chega aos candidatos (nunca some em silêncio); o nulo antigo não', async () => {
    const b = criarBanco()
    const base = { competitor_channel_id: 'c', live_broadcast_content: null, missing_since: null, competitor_channels: { site_id: 's', missing_since: null } }
    semear(b, 'competitor_videos', [
      { id: 'sem-data', video_id: 'a', published_at: null, discovered_at: iso(AGORA - 2 * H), ...base },
      { id: 'sem-data-antigo', video_id: 'b', published_at: null, discovered_at: iso(AGORA - 20 * DIA), ...base },
      { id: 'com-data', video_id: 'c', published_at: iso(AGORA - H), discovered_at: null, ...base },
    ])
    semear(b, 'youtube_videos', [
      { id: 'p-sem-data', youtube_video_id: 'pa', channel_id: 'd', site_id: 's', published_at: null, created_at: iso(AGORA - 2 * H) },
      { id: 'p-sem-data-antigo', youtube_video_id: 'pb', channel_id: 'd', site_id: 's', published_at: null, created_at: iso(AGORA - 20 * DIA) },
    ])
    const { conc, prop } = await lerCandidatos(b.sb, AGORA)
    expect(conc.map(c => c.id).sort()).toEqual(['com-data', 'sem-data'])
    expect(prop.map(p => p.id)).toEqual(['p-sem-data'])
    expect(conc.find(c => c.id === 'sem-data')?.publishedAt).toBeNull()
  })

  it('5.000 linhas exatas passam (seis consultas, a sexta vazia); mais que isso é lista_cortada', async () => {
    const mk = (n: number): Linha[] => Array.from({ length: n }, (_, i) => ({
      id: `u${String(i).padStart(5, '0')}`, video_id: `y${i}`, competitor_channel_id: 'c', published_at: iso(AGORA - H), discovered_at: null,
      live_broadcast_content: null, missing_since: null, competitor_channels: { site_id: 's', missing_since: null },
    }))
    const b = criarBanco(); semear(b, 'competitor_videos', mk(5000))
    const ok = await lerCandidatos(b.sb, AGORA)
    expect(ok.conc).toHaveLength(5000)
    const b2 = criarBanco(); semear(b2, 'competitor_videos', mk(5001))
    await expect(lerCandidatos(b2.sb, AGORA)).rejects.toMatchObject({ codigo: 'lista_cortada' })
  })

  it('erro, resposta nula e linha fora da forma lançam lista_falhou, sem o texto do banco', async () => {
    for (const modo of ['erro', 'nulo', 'lanca'] as const) {
      const b = criarBanco(); b.falha = t => (t === 'youtube_videos' ? modo : undefined)
      const e: unknown = await lerCandidatos(b.sb, AGORA).catch((x: unknown) => x)
      expect(e).toBeInstanceOf(ErroDeLeitura)
      expect((e as ErroDeLeitura).codigo).toBe('lista_falhou')
      expect(String((e as Error).message)).not.toContain(SENTINELA)
    }
    const b = criarBanco(); semear(b, 'competitor_videos', [{ id: 'x', published_at: iso(AGORA - H) }])
    await expect(lerCandidatos(b.sb, AGORA)).rejects.toMatchObject({ codigo: 'lista_falhou' })
  })
})

describe('jaLidosNaHora', () => {
  it('chaveia por tipo e id, e separa as cruas da curva', async () => {
    const b = criarBanco()
    semear(b, 'competitor_video_hourly', [{ video_id: 'v1', hour_slot: iso(HORA), taken_at: iso(HORA + 40_000), views: 5, likes: null, comments: 1 }])
    semear(b, 'yt_own_public_video_hourly', [{ youtube_video_id: 'p1', hour_slot: iso(HORA), taken_at: iso(HORA + 50_000), views: 7, likes: 2, comments: null }])
    semear(b, 'competitor_video_early', [{ video_id: 'v1', taken_at: iso(HORA + 5 * 60_000), views: 5, likes: null, comments: 1 }])
    semear(b, 'yt_own_public_video_early', [{ youtube_video_id: 'p9', taken_at: iso(HORA + 59 * 60_000), views: 1, likes: null, comments: null }])
    semear(b, 'competitor_video_early', [{ video_id: 'v2', taken_at: iso(HORA + H), views: 1, likes: null, comments: null }]) // hora seguinte: fora
    const ja = await jaLidosNaHora(b.sb, iso(HORA))
    expect([...ja.cruas.keys()].sort()).toEqual(['concorrente:v1', 'proprio:p1'])
    expect(ja.cruas.get('concorrente:v1')).toEqual({ lidoEm: iso(HORA + 40_000), views: 5, likes: null, comments: 1 })
    expect([...ja.comCurva].sort()).toEqual(['concorrente:v1', 'proprio:p9'])
    for (const i of b.idas) expect(i.filtros.some(n => n.startsWith('in:'))).toBe(false)
  })

  it('falha de leitura lança ja_lidos_falhou em qualquer uma das quatro', async () => {
    for (const tabela of ['competitor_video_hourly', 'yt_own_public_video_hourly', 'competitor_video_early', 'yt_own_public_video_early']) {
      for (const modo of ['erro', 'nulo', 'lanca'] as const) {
        const b = criarBanco(); b.falha = t => (t === tabela ? modo : undefined)
        await expect(jaLidosNaHora(b.sb, iso(HORA))).rejects.toMatchObject({ codigo: 'ja_lidos_falhou' })
      }
    }
  })
})

describe('gravarLeituras', () => {
  it('hour_slot é a hora cheia do instante da resposta', async () => {
    const b = criarBanco()
    const a1 = alvo(1, 'concorrente'), a2 = alvo(2, 'concorrente')
    const r = await gravarLeituras(b.sb, [a1, a2], [
      contagem(a1, { lidoEm: iso(HORA + 50_000) }), contagem(a2, { lidoEm: iso(HORA + 20 * 60_000 + 10_000) }),
    ], SEMPRE)
    expect(r.cruas).toBe(2)
    const slots = linhas(b, 'competitor_video_hourly').map(l => l.hour_slot)
    expect(slots).toEqual([iso(HORA), iso(HORA)])
    expect(linhas(b, 'competitor_video_hourly').map(l => l.taken_at)).toEqual([iso(HORA + 50_000), iso(HORA + 20 * 60_000 + 10_000)])
  })

  it('o mesmo ytId em dois alvos gera uma linha em cada tabela; o dono só com privacidade public', async () => {
    const b = criarBanco()
    const c = alvo(1, 'concorrente'), p: Alvo = { ...alvo(1, 'proprio'), ytId: c.ytId }
    const nl = alvo(2, 'proprio'), sem = alvo(3, 'proprio'), priv = alvo(4, 'proprio')
    const r = await gravarLeituras(b.sb, [c, p, nl, sem, priv], [
      contagem(c), contagem(nl, { privacidade: 'unlisted' }), contagem(sem, { privacidade: null }), contagem(priv, { privacidade: 'private' }),
    ], SEMPRE)
    expect(r).toMatchObject({ cruas: 1, cruasProprio: 1, curva: 1, curvaProprio: 1, naoPublico: 2, semStatus: 1, falhouCruas: false, falhouCurva: false, semTempo: false })
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(1)
    expect(linhas(b, 'yt_own_public_video_hourly')).toHaveLength(1)
    expect(linhas(b, 'yt_own_public_video_hourly')[0]).toMatchObject({ youtube_video_id: c.ytId, video_id: p.uuid, channel_id: 'dono-1', site_id: 'site-1' })
  })

  it('zero medido continua zero e contagem oculta continua nula', async () => {
    const b = criarBanco(); const a = alvo(1, 'concorrente')
    await gravarLeituras(b.sb, [a], [contagem(a, { views: 0, likes: null, comments: null })], SEMPRE)
    expect(linhas(b, 'competitor_video_hourly')[0]).toMatchObject({ views: 0, likes: null, comments: null })
  })

  it('curva só para o elegível (a regra da E2), e as cruas vão primeiro', async () => {
    const b = criarBanco()
    const a = alvo(1, 'concorrente'), velho = alvo(2, 'concorrente', { publishedAt: iso(AGORA - 80 * H) }), sem = alvo(3, 'concorrente', { descobertoEm: null })
    const r = await gravarLeituras(b.sb, [a, velho, sem], [contagem(a), contagem(velho), contagem(sem)], SEMPRE)
    expect(r.cruas).toBe(3)
    expect(r.curva).toBe(1)
    expect(linhas(b, 'competitor_video_early').map(l => l.video_id)).toEqual([a.uuid])
    const ordem = b.idas.filter(i => i.op === 'upsert').map(i => i.tabela)
    expect(ordem[0]).toBe('competitor_video_hourly')
  })

  it('grava em blocos de 500 linhas', async () => {
    const b = criarBanco()
    const alvos = Array.from({ length: 1200 }, (_, i) => alvo(i, 'concorrente', { descobertoEm: null }))
    const r = await gravarLeituras(b.sb, alvos, alvos.map(a => contagem(a)), SEMPRE)
    expect(r.cruas).toBe(1200)
    expect(idasEm(b, 'competitor_video_hourly', 'upsert').map(i => i.linhas)).toEqual([500, 500, 200])
  })

  it('upsert pede ignoreDuplicates: repetir a gravação não duplica linha', async () => {
    const b = criarBanco(); const a = alvo(1, 'concorrente')
    await gravarLeituras(b.sb, [a], [contagem(a)], SEMPRE)
    await gravarLeituras(b.sb, [a], [contagem(a, { views: 999 })], SEMPRE)
    expect(linhas(b, 'competitor_video_hourly')).toHaveLength(1)
    expect(linhas(b, 'competitor_video_hourly')[0]?.views).toBe(100)
    expect(linhas(b, 'competitor_video_early')).toHaveLength(1)
  })

  it('erro nas cruas: falhouCruas, a curva não é tentada, nenhum texto no retorno', async () => {
    const b = criarBanco(); b.falha = (t, op) => (op === 'upsert' && t === 'competitor_video_hourly' ? 'erro' : undefined)
    const a = alvo(1, 'concorrente')
    const r = await gravarLeituras(b.sb, [a], [contagem(a)], SEMPRE)
    expect(r.falhouCruas).toBe(true)
    expect(r.cruas).toBe(0)
    expect(idasEm(b, 'competitor_video_early', 'upsert')).toHaveLength(0)
    expect(JSON.stringify(r)).not.toContain(SENTINELA)
    const b2 = criarBanco(); b2.falha = (t, op) => (op === 'upsert' && t === 'competitor_video_hourly' ? 'lanca' : undefined)
    expect((await gravarLeituras(b2.sb, [a], [contagem(a)], SEMPRE)).falhouCruas).toBe(true)
  })

  it('erro só na curva: falhouCurva, as cruas ficam', async () => {
    const b = criarBanco(); b.falha = (t, op) => (op === 'upsert' && t === 'competitor_video_early' ? 'erro' : undefined)
    const a = alvo(1, 'concorrente')
    const r = await gravarLeituras(b.sb, [a], [contagem(a)], SEMPRE)
    expect(r).toMatchObject({ cruas: 1, curva: 0, falhouCruas: false, falhouCurva: true, semTempo: false })
  })

  it('sem tempo: antes da primeira ida nada é gravado; no meio, o que já foi fica contado', async () => {
    const b = criarBanco(); const a = alvo(1, 'concorrente')
    const r = await gravarLeituras(b.sb, [a], [contagem(a)], { agoraMs: AGORA, podeGravar: () => false })
    expect(r).toMatchObject({ cruas: 0, curva: 0, semTempo: true, falhouCruas: false })
    expect(b.idas).toHaveLength(0)
    const b2 = criarBanco(); let n = 0
    const alvos = Array.from({ length: 600 }, (_, i) => alvo(i, 'concorrente', { descobertoEm: null }))
    const r2 = await gravarLeituras(b2.sb, alvos, alvos.map(x => contagem(x)), { agoraMs: AGORA, podeGravar: () => ++n <= 1 })
    expect(r2.semTempo).toBe(true)
    expect(r2.cruas).toBe(500)
    expect(idasEm(b2, 'competitor_video_hourly', 'upsert')).toHaveLength(1)
  })

  it('sem nada a gravar não consulta o relógio nem o banco', async () => {
    const b = criarBanco(); const a = alvo(1, 'proprio')
    const r = await gravarLeituras(b.sb, [a], [contagem(a, { privacidade: 'private' })], { agoraMs: AGORA, podeGravar: () => false })
    expect(r.semTempo).toBe(false)
    expect(r.naoPublico).toBe(1)
    expect(b.idas).toHaveLength(0)
  })
})

describe('completarCurva', () => {
  const jaCom = (alvos: Alvo[], comCurva: Alvo[] = []): JaLidos => ({
    cruas: new Map(alvos.map(a => [`${a.tipo}:${a.tipo === 'proprio' ? a.ytId : a.uuid}`, { lidoEm: iso(HORA + 41_000), views: 11, likes: null, comments: 3 }])),
    comCurva: new Set(comCurva.map(a => `${a.tipo}:${a.tipo === 'proprio' ? a.ytId : a.uuid}`)),
  })

  it('grava a curva a partir da crua, com os mesmos números e o mesmo instante, nas duas tabelas', async () => {
    const b = criarBanco(); const c = alvo(1, 'concorrente'), p = alvo(2, 'proprio')
    const r = await completarCurva(b.sb, [c, p], jaCom([c, p]), SEMPRE)
    expect(r).toEqual({ curva: 1, curvaProprio: 1, falhou: false })
    expect(linhas(b, 'competitor_video_early')[0]).toMatchObject({ video_id: c.uuid, taken_at: iso(HORA + 41_000), views: 11, likes: null, comments: 3, site_id: 'site-1' })
    expect(linhas(b, 'yt_own_public_video_early')[0]).toMatchObject({ youtube_video_id: p.ytId, taken_at: iso(HORA + 41_000), views: 11, channel_id: 'dono-1' })
  })

  it('pula quem já tem curva na hora, quem não foi lido e quem não é elegível; nada a fazer não vai ao banco', async () => {
    const b = criarBanco()
    const tem = alvo(1, 'concorrente'), naoLido = alvo(2, 'concorrente'), velho = alvo(3, 'concorrente', { publishedAt: iso(AGORA - 90 * H) })
    const r = await completarCurva(b.sb, [tem, naoLido, velho], jaCom([tem, velho], [tem]), SEMPRE)
    expect(r).toEqual({ curva: 0, curvaProprio: 0, falhou: false })
    expect(b.idas).toHaveLength(0)
  })

  it('falha e falta de tempo viram falhou, sem texto', async () => {
    const c = alvo(1, 'concorrente')
    const b = criarBanco(); b.falha = (t, op) => (op === 'upsert' && t === 'competitor_video_early' ? 'erro' : undefined)
    expect(await completarCurva(b.sb, [c], jaCom([c]), SEMPRE)).toEqual({ curva: 0, curvaProprio: 0, falhou: true })
    const b2 = criarBanco()
    expect((await completarCurva(b2.sb, [c], jaCom([c]), { agoraMs: AGORA, podeGravar: () => false })).falhou).toBe(true)
    expect(b2.idas).toHaveLength(0)
  })
})

describe('contarNegadosCobraveis', () => {
  const dia = (d: number): string => pacificDate(AGORA - d * DIA)
  const cap = (id: string, d: number, status: string | null): Linha => ({ youtube_video_id: id, day_pt: dia(d), privacy_status: status })

  it('lista vazia é 0 sem ir ao banco', async () => {
    const b = criarBanco()
    expect(await contarNegadosCobraveis(b.sb, [], AGORA)).toEqual({ valor: 0 })
    expect(b.idas).toHaveLength(0)
  })

  it('vale a linha de maior day_pt dentro de 3 dias, e só conta se for public', async () => {
    const b = criarBanco()
    semear(b, 'yt_own_video_meta_daily', [
      cap('cinco', 5, 'public'), cap('virou', 2, 'public'), cap('virou', 1, 'private'),
      cap('nulo', 2, 'public'), cap('nulo', 1, null), cap('ontem', 1, 'public'), cap('fora', 1, 'public'),
    ])
    const r = await contarNegadosCobraveis(b.sb, ['cinco', 'virou', 'nulo', 'ontem', 'semcaptura'], AGORA)
    expect(r).toEqual({ valor: 2 })
    const ida = idasEm(b, 'yt_own_video_meta_daily', 'select')
    expect(ida).toHaveLength(1)
    expect(ida[0]?.filtros).toEqual(expect.arrayContaining(['in:youtube_video_id', 'gte:day_pt', 'not:privacy_status']))
  })

  it('a janela vai de hoje menos 3 dias (Pacífico) em diante: o dia hoje-3 entra, hoje-4 não', async () => {
    const b = criarBanco()
    semear(b, 'yt_own_video_meta_daily', [cap('tres', 3, 'public'), cap('quatro', 4, 'public')])
    expect(await contarNegadosCobraveis(b.sb, ['tres', 'quatro'], AGORA)).toEqual({ valor: 1 })
  })

  it('250 ids consultam; 251 recusam sem ir ao banco', async () => {
    const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `id-${i}`)
    const b = criarBanco()
    expect(await contarNegadosCobraveis(b.sb, ids(250), AGORA)).toEqual({ valor: 0 })
    expect(idasEm(b, 'yt_own_video_meta_daily', 'select')).toHaveLength(1)
    const b2 = criarBanco()
    const r = await contarNegadosCobraveis(b2.sb, ids(251), AGORA)
    expect('porque' in r).toBe(true)
    expect(b2.idas).toHaveLength(0)
  })

  it('erro, resposta nula, fora da forma e corte do banco viram { porque }, sem o texto do banco', async () => {
    for (const modo of ['erro', 'nulo', 'lanca'] as const) {
      const b = criarBanco(); b.falha = () => modo
      const r = await contarNegadosCobraveis(b.sb, ['a'], AGORA)
      expect('porque' in r).toBe(true)
      expect(JSON.stringify(r)).not.toContain(SENTINELA)
    }
    const b = criarBanco(); semear(b, 'yt_own_video_meta_daily', [{ youtube_video_id: 'a', day_pt: dia(1), privacy_status: 2 }])
    expect('porque' in (await contarNegadosCobraveis(b.sb, ['a'], AGORA))).toBe(true)
    // 1.000 linhas é o teto do banco: pode ter cortado, então não classifica
    const b2 = criarBanco()
    const ids250 = Array.from({ length: 250 }, (_, i) => `v${i}`)
    semear(b2, 'yt_own_video_meta_daily', ids250.flatMap(id => [0, 1, 2, 3].map(d => cap(id, d, 'public'))))
    expect('porque' in (await contarNegadosCobraveis(b2.sb, ids250, AGORA))).toBe(true)
  })
})

// ───────────────────────── o código do Postgres chega ao relato ─────────────────────────
describe('relatar: só o código do Postgres e o código de catálogo, nunca o texto', () => {
  type Relato = { tarefa: string; codigo: string; tecnico?: { classe: string; sqlstate: string | null } }
  const novoRelator = (): { relatos: Relato[]; relatar: (tarefa: string, o: { codigo: string; tecnico?: { classe: string; sqlstate: string | null } }) => void } => {
    const relatos: Relato[] = []
    return { relatos, relatar: (tarefa, o) => { relatos.push({ tarefa, ...o }) } }
  }
  const semTexto = (relatos: Relato[]): void => {
    const s = JSON.stringify(relatos)
    expect(s).not.toContain(SENTINELA)
    expect(s).not.toContain('message')
  }

  it('lerCandidatos: erro do banco relata lista_falhou com o sqlstate; sem o texto', async () => {
    const b = criarBanco(); b.falha = t => (t === 'youtube_videos' ? 'erro' : undefined)
    const { relatos, relatar } = novoRelator()
    await expect(lerCandidatos(b.sb, AGORA, relatar)).rejects.toMatchObject({ codigo: 'lista_falhou' })
    expect(relatos).toEqual([{ tarefa: 'leitura_horaria', codigo: 'lista_falhou', tecnico: { classe: 'Error', sqlstate: 'XX000' } }])
    semTexto(relatos)
  })

  it('lerCandidatos: exceção relata a classe, sem sqlstate; resposta nula relata sem sqlstate', async () => {
    for (const modo of ['lanca', 'nulo'] as const) {
      const b = criarBanco(); b.falha = t => (t === 'competitor_videos' ? modo : undefined)
      const { relatos, relatar } = novoRelator()
      await expect(lerCandidatos(b.sb, AGORA, relatar)).rejects.toMatchObject({ codigo: 'lista_falhou' })
      expect(relatos).toHaveLength(1)
      expect(relatos[0]).toMatchObject({ tarefa: 'leitura_horaria', codigo: 'lista_falhou', tecnico: { sqlstate: null } })
      semTexto(relatos)
    }
  })

  it('lerCandidatos: lista cortada relata lista_cortada', async () => {
    const mk = (n: number): Linha[] => Array.from({ length: n }, (_, i) => ({
      id: `u${String(i).padStart(5, '0')}`, video_id: `y${i}`, competitor_channel_id: 'c', published_at: iso(AGORA - H), discovered_at: null,
      live_broadcast_content: null, missing_since: null, competitor_channels: { site_id: 's', missing_since: null },
    }))
    const b = criarBanco(); semear(b, 'competitor_videos', mk(5001))
    const { relatos, relatar } = novoRelator()
    await expect(lerCandidatos(b.sb, AGORA, relatar)).rejects.toMatchObject({ codigo: 'lista_cortada' })
    expect(relatos.map(r => r.codigo)).toEqual(['lista_cortada'])
  })

  it('jaLidosNaHora: erro do banco relata ja_lidos_falhou com o sqlstate', async () => {
    const b = criarBanco(); b.falha = (t, op) => (t === 'competitor_video_early' && op === 'select' ? 'erro' : undefined)
    const { relatos, relatar } = novoRelator()
    await expect(jaLidosNaHora(b.sb, iso(HORA), relatar)).rejects.toMatchObject({ codigo: 'ja_lidos_falhou' })
    expect(relatos).toEqual([{ tarefa: 'leitura_horaria', codigo: 'ja_lidos_falhou', tecnico: { classe: 'Error', sqlstate: 'XX000' } }])
    semTexto(relatos)
  })

  it('gravarLeituras e completarCurva: bloco recusado relata gravacao_falhou com o sqlstate', async () => {
    const a = alvo(1, 'concorrente')
    const b = criarBanco(); b.falha = (t, op) => (t === 'competitor_video_hourly' && op === 'upsert' ? 'erro' : undefined)
    const { relatos, relatar } = novoRelator()
    const r = await gravarLeituras(b.sb, [a], [contagem(a)], { ...SEMPRE, relatar })
    expect(r.falhouCruas).toBe(true)
    expect(relatos).toEqual([{ tarefa: 'leitura_horaria', codigo: 'gravacao_falhou', tecnico: { classe: 'Error', sqlstate: 'XX000' } }])

    const b2 = criarBanco(); b2.falha = (t, op) => (t === 'competitor_video_early' && op === 'upsert' ? 'lanca' : undefined)
    const ja: JaLidos = { cruas: new Map([[`concorrente:${a.uuid}`, { lidoEm: iso(AGORA), views: 1, likes: null, comments: null }]]), comCurva: new Set() }
    const outro = novoRelator()
    const c = await completarCurva(b2.sb, [a], ja, { ...SEMPRE, relatar: outro.relatar })
    expect(c.falhou).toBe(true)
    expect(outro.relatos).toHaveLength(1)
    expect(outro.relatos[0]).toMatchObject({ codigo: 'gravacao_falhou', tecnico: { sqlstate: null } })
    semTexto([...relatos, ...outro.relatos])
  })

  it('contarNegadosCobraveis: erro do banco relata classificacao_falhou com o sqlstate e devolve { porque }', async () => {
    const b = criarBanco(); b.falha = t => (t === 'yt_own_video_meta_daily' ? 'erro' : undefined)
    const { relatos, relatar } = novoRelator()
    const r = await contarNegadosCobraveis(b.sb, ['x'], AGORA, relatar)
    expect('porque' in r).toBe(true)
    expect(relatos).toEqual([{ tarefa: 'leitura_horaria', codigo: 'classificacao_falhou', tecnico: { classe: 'Error', sqlstate: 'XX000' } }])
    semTexto(relatos)
    // exceção também
    const b2 = criarBanco(); b2.falha = t => (t === 'yt_own_video_meta_daily' ? 'lanca' : undefined)
    const o2 = novoRelator()
    expect('porque' in await contarNegadosCobraveis(b2.sb, ['x'], AGORA, o2.relatar)).toBe(true)
    expect(o2.relatos).toHaveLength(1)
    semTexto(o2.relatos)
  })

  it('um relatar que lança não derruba a leitura nem muda o resultado', async () => {
    const b = criarBanco(); b.falha = t => (t === 'youtube_videos' ? 'erro' : undefined)
    await expect(lerCandidatos(b.sb, AGORA, () => { throw new Error('relato quebrou') })).rejects.toMatchObject({ codigo: 'lista_falhou' })
  })
})
