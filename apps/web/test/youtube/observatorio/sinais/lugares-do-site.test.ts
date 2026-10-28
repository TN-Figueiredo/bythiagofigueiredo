// @vitest-environment node
// F2 T6: video_lugares do site (calcular em memória, gravar só o que mudou, podar órfãos) e o índice de lugar.
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { rowsToDataset } from '@/lib/youtube/observatorio/load'
import { createObservatory } from '@/lib/youtube/observatorio'
import { montarIndice } from '@/lib/youtube/observatorio/lugar/casar'
import {
  calcularLugares, gravarLugares, lerEntradasDeLugar, lerIndiceDeLugar, lerProprios, sincronizarLugares, ErroSementeIncompleta, type CalculoDeLugares, type LinhaDeLugar, type ProprioRow,
} from '@/lib/youtube/observatorio/sinais/lugares-do-site'
import { projetarOutliers, recomporVistos } from '@/lib/youtube/observatorio/sinais/projecao'
import { canal, rowsDe, NOW, DAY } from './fixture-sinais'

type Linha = Record<string, unknown>
interface Falso {
  client: SupabaseClient
  tabelas: Record<string, Linha[]>
  selects: Array<{ table: string; cols: string }>
  escritas: Array<{ table: string; op: 'upsert' | 'delete'; n: number }>
  upserts: Linha[][]
  gtes: Array<{ table: string; col: string; v: string }>
}

/** Cliente de teste mínimo: select/eq/in/order/range/upsert/delete sobre tabelas em memória; `rd:raw->x` vira `rd`. */
function falso(tabelas: Record<string, Linha[]>, o: { cortarEm?: number } = {}): Falso {
  const f: Falso = { client: null as unknown as SupabaseClient, tabelas, selects: [], escritas: [], upserts: [], gtes: [] }
  const from = (table: string) => {
    let rows = [...(tabelas[table] ?? [])]
    let cols: string[] = []
    let contar = false
    let ord: string | null = null
    const q = {
      select(s: string, op?: { count?: string; head?: boolean }) { f.selects.push({ table, cols: s }); cols = s.split(',').map((c) => c.trim()); contar = op?.count === 'exact'; return q },
      eq(c: string, v: unknown) { rows = rows.filter((r) => r[c] === v); return q },
      in(c: string, vs: readonly unknown[]) { rows = rows.filter((r) => vs.includes(r[c])); return q },
      gte(c: string, v: string) { f.gtes.push({ table, col: c, v }); rows = rows.filter((r) => String(r[c]) >= v); return q },
      order(c: string) { ord = c; return q },
      range(a: number, b: number) { return Promise.resolve(run([a, b])) },
      upsert(batch: Linha[]) {
        f.escritas.push({ table, op: 'upsert', n: batch.length }); f.upserts.push(batch)
        const t = (tabelas[table] ??= [])
        for (const r of batch) { const i = t.findIndex((x) => x.video_id === r.video_id); if (i >= 0) t[i] = r; else t.push(r) }
        return Promise.resolve({ error: null })
      },
      delete() {
        const filtros: Array<(r: Linha) => boolean> = []
        const d = {
          eq(c: string, v: unknown) { filtros.push((r) => r[c] === v); return d },
          in(c: string, vs: readonly unknown[]) { filtros.push((r) => vs.includes(r[c])); return d },
          then(ok: (r: { error: null }) => unknown) {
            const antes = (tabelas[table] ?? []).length
            tabelas[table] = (tabelas[table] ?? []).filter((r) => !filtros.every((fn) => fn(r)))
            f.escritas.push({ table, op: 'delete', n: antes - tabelas[table]!.length })
            return Promise.resolve({ error: null }).then(ok)
          },
        }
        return d
      },
      then(ok: (r: unknown) => unknown) { return Promise.resolve(run(undefined)).then(ok) },
    }
    function run(sl?: [number, number]) {
      const ordenado = ord ? [...rows].sort((a, b) => String(a[ord!]).localeCompare(String(b[ord!]))) : rows
      let pag = sl ? ordenado.slice(sl[0], sl[1] + 1) : ordenado
      if (o.cortarEm !== undefined && sl && sl[0] >= o.cortarEm) pag = []
      const data = pag.map((r) => Object.fromEntries(cols.map((c) => {
        const m = /^(\w+):(\w+)->(\w+)$/.exec(c)
        if (m) return [m[1], (r[m[2]!] as Linha | undefined)?.[m[3]!] ?? null]
        return [c, r[c] ?? null]
      })))
      return { data, error: null, ...(contar ? { count: rows.length } : {}) }
    }
    return q
  }
  f.client = { from } as unknown as SupabaseClient
  return f
}

const SITE = 'site-1'
const indice = montarIndice([
  { alias_norm: 'turkey', slug: 'pais:TR', ambiguo: true, pais_iso2: 'TR' },
  { alias_norm: 'turquia', slug: 'pais:TR', ambiguo: false, pais_iso2: 'TR' },
  { alias_norm: 'istanbul', slug: 'istambul', ambiguo: false, pais_iso2: 'TR' },
  { alias_norm: 'egito', slug: 'pais:EG', ambiguo: false, pais_iso2: 'EG' },
], 1)
const indiceV2 = montarIndice([...indice.porAlias].map(([alias_norm, e]) => ({ alias_norm, slug: e.slug, ambiguo: e.ambiguo, pais_iso2: e.pais })), 2)

function cenario() {
  const rows = rowsDe([canal('c1')], [
    { id: 'v-egito', ch: 'c1', vpd: 100, title: 'Viagem ao Egito barata' },
    { id: 'v-turkey', ch: 'c1', vpd: 100, title: 'Turkey travel' },
    { id: 'v-nada', ch: 'c1', vpd: 100, title: 'Dicas de mala' },
  ])
  const tabelas: Record<string, Linha[]> = {
    video_lugares: [],
    competitor_raw: [{ id: 1, site_id: SITE, video_id: 'v-turkey', is_current: true, raw: { recordingDetails: { locationDescription: 'Cappadocia' } } }],
    lugar_aliases: [],
  }
  return { rows, tabelas }
}
const proprios: ProprioRow[] = []
const sincroniza = (f: Falso, rows: ReturnType<typeof cenario>['rows'], ind = indice, p: ProprioRow[] = proprios) =>
  sincronizarLugares(f.client, SITE, rows, p, ind, new Date(NOW))

describe('sincronizarLugares', () => {
  it('primeira vez grava todos (sem lugar vira chaves vazias, nunca omitido); segunda sem mudança: regravados 0 e nenhum upsert', async () => {
    const { rows, tabelas } = cenario()
    const f = falso(tabelas)
    const r1 = await sincroniza(f, rows)
    expect(r1.regravados).toBe(3)
    expect(f.tabelas.video_lugares).toHaveLength(3)
    expect(r1.lugarDe('v-egito')).toContain('pais:EG')
    expect(r1.lugarDe('v-nada')).toEqual([])
    expect(f.tabelas.video_lugares.find((l) => l.video_id === 'v-nada')!.chaves).toEqual([])
    const upsertsAntes = f.upserts.length
    const r2 = await sincroniza(f, rows)
    expect(r2.regravados).toBe(0)
    expect(r2.inalterados).toBe(3)
    expect(f.upserts.length).toBe(upsertsAntes)
  })

  it('título alterado: só aquele vídeo é regravado', async () => {
    const { rows, tabelas } = cenario()
    const f = falso(tabelas)
    await sincroniza(f, rows)
    const alterado = { ...rows, versions: rows.versions.map((v) => (v.video_id === 'v-nada' && v.field === 'title' ? { ...v, value_text: 'Dicas de viagem para o Egito' } : v)) }
    const r = await sincroniza(f, alterado)
    expect(r.regravados).toBe(1)
    expect(f.upserts.at(-1)!.map((l) => l.video_id)).toEqual(['v-nada'])
    expect(r.lugarDe('v-nada')).toContain('pais:EG')
  })

  it('semente 2: todos regravados', async () => {
    const { rows, tabelas } = cenario()
    const f = falso(tabelas)
    await sincroniza(f, rows)
    const r = await sincroniza(f, rows, indiceV2)
    expect(r.regravados).toBe(3)
    expect(f.tabelas.video_lugares.every((l) => l.semente_versao === 2)).toBe(true)
  })

  it('vídeo órfão (saiu do conjunto lido) é podado', async () => {
    const { rows, tabelas } = cenario()
    tabelas.video_lugares!.push({ video_id: 'sumiu', site_id: SITE, origem: 'competidor', chaves: ['pais:EG'], fonte: 'texto', entrada_hash: 'x', semente_versao: 1, computado_em: 'x' })
    const f = falso(tabelas)
    await sincroniza(f, rows)
    expect(f.tabelas.video_lugares.some((l) => l.video_id === 'sumiu')).toBe(false)
    expect(f.escritas.some((e) => e.op === 'delete' && e.n === 1)).toBe(true)
  })

  it('poda de 450 órfãos: nenhum .in com mais de 200 ids (acima de ~250 o PostgREST responde 414) e todos apagados', async () => {
    const tamanhos: number[] = []
    const apagados: string[] = []
    const client = {
      from: () => ({
        delete: () => {
          const d = {
            eq: () => d,
            in: (_c: string, vs: readonly string[]) => { tamanhos.push(vs.length); apagados.push(...vs); return d },
            then: (ok: (r: { error: null }) => unknown) => Promise.resolve({ error: null }).then(ok),
          }
          return d
        },
      }),
    } as unknown as SupabaseClient
    const orfaos = Array.from({ length: 450 }, (_, i) => `v${i}`)
    await gravarLugares(client, SITE, { regravar: [], orfaos } as unknown as CalculoDeLugares)
    expect(tamanhos).toEqual([200, 200, 50])
    expect(apagados).toEqual(orfaos)
  })

  it('versão desc "Istanbul" e título "Turkey" -> pais:TR; localização Cappadocia sozinha não conta', async () => {
    const { rows, tabelas } = cenario()
    const comDesc = {
      ...rows,
      versions: [...rows.versions, {
        id: 'd1', video_id: 'v-turkey', field: 'desc', value_text: 'Dia 1 em Istanbul, depois Capadócia', value_hash: 'd', has_text: true, thumb_blob_url: null,
        first_seen_at: new Date(NOW).toISOString(), last_seen_at: new Date(NOW).toISOString(), window_start: null, precision: 'first', is_current: true,
      }],
    }
    const f = falso(tabelas)
    const r = await sincroniza(f, comDesc)
    expect(r.lugarDe('v-turkey')).toContain('pais:TR')
    // sem a descrição, "Turkey" sozinho (ambíguo, sem segundo sinal) não casa
    const f2 = falso(cenario().tabelas)
    const r2 = await sincroniza(f2, rows)
    expect(r2.lugarDe('v-turkey')).toEqual([])
  })

  it('v2 a: país que está na tag de >= 50% dos vídeos do canal (>= 4) não conta sozinho', async () => {
    const rows0 = rowsDe([canal('c1')], [
      { id: 'p1', ch: 'c1', vpd: 100, title: 'Dicas de mala' }, { id: 'p2', ch: 'c1', vpd: 100, title: 'Dicas de mochila' },
      { id: 'p3', ch: 'c1', vpd: 100, title: 'Dicas de voo' }, { id: 'p4', ch: 'c1', vpd: 100, title: 'Viagem ao Egito' },
    ])
    const rows = { ...rows0, videos: rows0.videos.map((v) => ({ ...v, tags: v.id === 'p4' ? ['Turquia'] : ['Egito'] })) }
    const r = await sincroniza(falso(cenario().tabelas), rows)
    expect(r.lugarDe('p1')).toEqual([])
    expect(r.lugarDe('p4')).toEqual(['pais:EG'])
  })

  it('o select de competitor_raw nunca pede o raw inteiro', async () => {
    const { tabelas } = cenario()
    const f = falso(tabelas)
    await lerEntradasDeLugar(f.client, SITE)
    const sel = f.selects.filter((s) => s.table === 'competitor_raw')
    expect(sel).toHaveLength(1)
    expect(sel[0]!.cols).toBe('video_id, rd:raw->recordingDetails')
    expect(sel[0]!.cols.split(',').map((c) => c.trim())).not.toContain('raw')
    expect(sel[0]!.cols).not.toContain('*')
  })

  it('calcularLugares é pura: nada de escrita no cliente', async () => {
    const { rows, tabelas } = cenario()
    const f = falso(tabelas)
    const { raws, existentes } = await lerEntradasDeLugar(f.client, SITE)
    const antes = f.escritas.length
    const c = calcularLugares({ siteId: SITE, rows, proprios, indice, raws, existentes, agora: new Date(NOW) })
    expect(f.escritas.length).toBe(antes)
    expect(c.contagens).toMatchObject({ total: 3, competidor: 3, proprio: 0, sem_lugar: 2, regravados: 3, inalterados: 0, orfaos: 0 })
  })

  it('vídeo próprio entra com origem proprio e descrição própria', async () => {
    const { rows, tabelas } = cenario()
    const f = falso(tabelas)
    const p: ProprioRow[] = [{ id: 'own-1', title: 'Meu vlog', description: 'Gravado no Egito', tags: [], is_short: false }]
    await sincroniza(f, rows, indice, p)
    const l = f.tabelas.video_lugares.find((x) => x.video_id === 'own-1') as LinhaDeLugar
    expect(l.origem).toBe('proprio')
    expect(l.chaves).toContain('pais:EG')
  })

  it('upsert em blocos de 500', async () => {
    const { rows, tabelas } = cenario()
    const muitos = Array.from({ length: 1100 }, (_, i) => ({ id: `p${i}`, title: 'x', description: null, tags: [], is_short: false }))
    const f = falso(tabelas)
    await sincroniza(f, rows, indice, muitos)
    expect(f.upserts.map((u) => u.length)).toEqual([500, 500, 103])
  })
})

describe('lerProprios', () => {
  const agora = new Date('2026-10-24T15:00:00-03:00') // hoje_sp = 2026-10-24
  const dia = (n: number): string => new Date(Date.UTC(2026, 9, 24 - n)).toISOString().slice(0, 10)
  const v = (id: string, extra: Linha = {}): Linha => ({ id, youtube_video_id: 'yt-' + id, site_id: SITE, is_hidden: false, title: 'T ' + id, description: 'D ' + id, tags: ['t'], ...extra })
  const m = (id: string, d: number, extra: Linha = {}): Linha => ({ youtube_video_id: 'yt-' + id, site_id: SITE, day_pt: dia(d), privacy_status: 'public', is_short: false, ...extra })

  it('oculto e não público ficam fora; formato pela linha mais nova', async () => {
    const f = falso({
      youtube_videos: [v('a'), v('oculto', { is_hidden: true }), v('priv'), v('lista'), v('sem-meta'), v('outro-site', { site_id: 'x' }), v('forma')],
      yt_own_video_meta_daily: [
        m('a', 5, { is_short: false }), m('a', 1, { is_short: true }),
        m('oculto', 1), m('priv', 3), m('priv', 1, { privacy_status: 'private' }), m('lista', 1, { privacy_status: 'unlisted' }),
        m('forma', 2, { privacy_status: 'public', is_short: true }), m('forma', 1, { privacy_status: null, is_short: false }),
      ],
    })
    const r = await lerProprios(f.client, SITE, agora)
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'forma'].sort())
    expect(r.find((x) => x.id === 'a')).toMatchObject({ is_short: true, title: 'T a', description: 'D a', tags: ['t'] })
    // último privacy conhecido (dia 2: public) vale mesmo com a linha mais nova sem privacidade; o formato é o da mais nova
    expect(r.find((x) => x.id === 'forma')!.is_short).toBe(false)
  })

  it('linha de 8 dias atrás é ignorada (formato null; sem privacidade na janela = fora)', async () => {
    const f = falso({ youtube_videos: [v('a'), v('velho')], yt_own_video_meta_daily: [m('a', 2, { is_short: null }), m('velho', 8, { is_short: true })] })
    const r = await lerProprios(f.client, SITE, agora)
    expect(r.map((x) => x.id)).toEqual(['a'])
    expect(r[0]!.is_short).toBeNull()
  })

  it('a consulta tem o filtro de day_pt (hoje_sp - 7) e não pede views/CTR', async () => {
    const f = falso({ youtube_videos: [v('a')], yt_own_video_meta_daily: [m('a', 1)] })
    await lerProprios(f.client, SITE, agora)
    expect(f.gtes).toEqual([{ table: 'yt_own_video_meta_daily', col: 'day_pt', v: dia(7) }])
    for (const s of f.selects) expect(s.cols).not.toMatch(/view|ctr|vpd|nota|like|comment/i)
  })
})

describe('lerIndiceDeLugar', () => {
  const aliases = (n: number): Linha[] => Array.from({ length: n }, (_, i) => ({
    alias_norm: `a${String(i).padStart(5, '0')}`, slug: 'pais:TR', ambiguo: false, semente_versao: i === 0 ? 3 : 1, lugares: { pais_iso2: 'TR' },
  }))
  it('1.050 aliases (mais de uma página) -> índice com 1.050 e versão = máximo', async () => {
    const f = falso({ lugar_aliases: aliases(1050) })
    const ind = await lerIndiceDeLugar(f.client)
    expect(ind.porAlias.size).toBe(1050)
    expect(ind.versao).toBe(3)
    expect(f.selects.filter((s) => s.table === 'lugar_aliases').some((s) => s.cols.includes('lugares(pais_iso2)'))).toBe(true)
  })
  it('leitura que devolve 1.000 de 1.050 -> semente_incompleta', async () => {
    const f = falso({ lugar_aliases: aliases(1050) }, { cortarEm: 1000 })
    await expect(lerIndiceDeLugar(f.client)).rejects.toBeInstanceOf(ErroSementeIncompleta)
    await expect(lerIndiceDeLugar(f.client)).rejects.toMatchObject({ motivo: 'semente_incompleta' })
  })
  it('semente vazia também é semente_incompleta', async () => {
    await expect(lerIndiceDeLugar(falso({ lugar_aliases: [] }).client)).rejects.toMatchObject({ motivo: 'semente_incompleta' })
  })
})

describe('ponta a ponta: vistos recompostos por video_lugares regravado', () => {
  it('semente v2 muda as chaves dos vistos (lugarDe do sincronizarLugares)', async () => {
    const { rows, tabelas } = cenario()
    const f = falso(tabelas)
    const r = await sincroniza(f, rows, indiceV2)
    const rec = recomporVistos({
      vistos: [{ video_id: 'v-egito', canal_id: 'c1', formato: 'long', published_at: new Date(NOW - 3 * DAY).toISOString(), n_canal: 10, ultimo_visto_em: new Date(NOW - DAY).toISOString(), mult_max: 3, vpd7_max: 300, chaves: ['antiga'] }],
      ancoras: [], lugarDe: r.lugarDe, idsDeHoje: new Set(), agora: new Date(NOW), janelaDias: 14,
    })
    expect(rec.outliers[0]!.chaves).toEqual(expect.arrayContaining(['pais:EG']))
    expect(rec.outliers[0]!.chaves).not.toContain('antiga')
  })
  it('projetarOutliers consome lugarDe e textoDe do cálculo', () => {
    const rows = rowsDe([canal('c1')], [
      ...Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, ch: 'c1', vpd: 100, ageDias: 20 + i })),
      { id: 'hit', ch: 'c1', vpd: 1000, ageDias: 21, title: 'Egito em 3 dias', tags: ['piramides'] },
    ])
    const c = calcularLugares({ siteId: SITE, rows, proprios, indice, raws: new Map(), existentes: new Map(), agora: new Date(NOW) })
    const p = projetarOutliers(createObservatory(rowsToDataset(rows, NOW)), c.lugarDe, c.textoDe)
    expect(p.outliers[0]!.chaves).toContain('pais:EG')
    expect(p.outliers[0]!.tokens).toEqual(expect.arrayContaining(['egito', 'piramides']))
    expect(p.outliersSemLugar).toBe(0)
  })
})
