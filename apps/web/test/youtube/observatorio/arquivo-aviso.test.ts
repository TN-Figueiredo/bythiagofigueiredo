// @vitest-environment node
/**
 * A5 · E10, Tarefa 8: o aviso do arquivo (`arquivo/aviso.ts`). O banco é um PostgREST em memória que APLICA os filtros
 * (`eq`, `is`, `in`, `not ... is null`), a ordem e a paginação: "lotes de outro site não aparecem" só prova alguma coisa
 * se o falso filtrar de verdade.
 */
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerAvisoDoArquivo, PERIODO_DE_ARQUIVO_UNICO, type AvisoDoArquivo } from '@/lib/youtube/observatorio/arquivo/aviso'
import { RULES } from '@/lib/youtube/observatorio/rules'

const SITE = '99999999-aaaa-4bbb-8ccc-dddddddddddd'
const OUTRO_SITE = '00000000-aaaa-4bbb-8ccc-dddddddddddd'
const A = '0a1b2c3d-1111-4222-8333-444455556666'
const B = '0a1b2c3d-1111-4222-8333-777788889999'
const SUMIU = '0a1b2c3d-1111-4222-8333-000000000000'
const AGORA = Date.UTC(2026, 9, 13, 15, 0)
const DIA_MS = 86_400_000
const iso = (diasAtras: number): string => new Date(AGORA - diasAtras * DIA_MS).toISOString()
const SEGREDO = 'segredo-da-mensagem-do-banco'

type Linha = Record<string, unknown>
type Erro = { message: string; code?: string }
interface Consulta { tabela: string; filtros: unknown[][]; intervalos: Array<[number, number]> }

function falso(tabelas: Record<string, Linha[]>, falhas: Record<string, Erro | 'lanca'> = {}) {
  const consultas: Consulta[] = []
  const sb = {
    from: (tabela: string) => {
      const c: Consulta = { tabela, filtros: [], intervalos: [] }
      consultas.push(c)
      let linhas = (tabelas[tabela] ?? []).slice()
      let ordem: string | null = null
      let desc = false
      const b = {
        select: (_: string) => b,
        eq: (col: string, v: unknown) => { c.filtros.push(['eq', col, v]); linhas = linhas.filter(l => l[col] === v); return b },
        is: (col: string, v: unknown) => { c.filtros.push(['is', col, v]); linhas = linhas.filter(l => (l[col] ?? null) === v); return b },
        in: (col: string, vs: unknown[]) => { c.filtros.push(['in', col, vs]); linhas = linhas.filter(l => vs.includes(l[col])); return b },
        not: (col: string, op: string, v: unknown) => { c.filtros.push(['not', col, op, v]); if (op === 'is') linhas = linhas.filter(l => (l[col] ?? null) !== v); return b },
        order: (col: string, o?: { ascending?: boolean }) => { ordem = col; desc = o?.ascending === false; return b },
        range: (de: number, ate: number) => { c.intervalos.push([de, ate]); return b },
        limit: (n: number) => { c.intervalos.push([0, n - 1]); return b },
        abortSignal: (s: AbortSignal) => {
          expect(s).toBeInstanceOf(AbortSignal)
          const f = falhas[tabela]
          if (f === 'lanca') return Promise.reject(new Error(SEGREDO))
          if (f) return Promise.resolve({ data: null, error: f })
          if (ordem !== null) { const o = ordem; linhas.sort((x, y) => String(x[o]).localeCompare(String(y[o])) * (desc ? -1 : 1)) }
          const [de, ate] = c.intervalos.at(-1) ?? [0, linhas.length]
          return Promise.resolve({ data: linhas.slice(de, ate + 1), error: null })
        },
      }
      return b
    },
    rpc: () => ({ abortSignal: () => Promise.resolve({ data: null, error: { message: 'sem rpc neste falso' } }) }),
  } as unknown as SupabaseClient
  return { sb, consultas }
}

let seq = 0
const linhaDeLote = (o: Partial<Linha> & { batch: string; channel_ref: string; table_name: string }): Linha => ({
  id: ++seq, site_id: SITE, channel_label: 'Canal sintético', period_start: '2026-08-01', period_end: '2026-08-31', row_count: 10, exported_at: iso(3),
  verified_at: null, nas_confirmed_at: null, deleted_at: null, closed_at: null, blob_urls_pending: null, ...o,
})
const canais: Linha[] = [{ id: A, site_id: SITE, channel_name: 'Canal A', collection_paused_at: null }, { id: B, site_id: SITE, channel_name: 'Canal B', collection_paused_at: null }]
const banco = (extra: Linha[] = [], canaisX: Linha[] = canais) => ({ obs_archive_batches: extra, competitor_channels: canaisX, obs_db_size_daily: [] })
const ler = (t: Record<string, Linha[]>, f: Record<string, Erro | 'lanca'> = {}) => { const x = falso(t, f); return lerAvisoDoArquivo(x.sb, SITE, AGORA).then(a => ({ a, x })) }
const lotes = (a: AvisoDoArquivo) => { if (!('valor' in a.lotesNaoConfirmados)) throw new Error('lotes não lidos'); return a.lotesNaoConfirmados.valor }

describe('A5 E10 T8: lerAvisoDoArquivo, as exportações', () => {
  it('a exportação soma os registros de todas as tabelas do lote e dá o período inteiro, sem a sentinela do arquivo único', async () => {
    const { a } = await ler(banco([
      linhaDeLote({ batch: 'lote-um', channel_ref: A, table_name: 'competitor_channels', period_start: PERIODO_DE_ARQUIVO_UNICO, period_end: PERIODO_DE_ARQUIVO_UNICO, row_count: 1 }),
      linhaDeLote({ batch: 'lote-um', channel_ref: A, table_name: 'competitor_video_daily', period_start: '2025-01-01', period_end: '2025-01-31', row_count: 100 }),
      linhaDeLote({ batch: 'lote-um', channel_ref: A, table_name: 'competitor_video_hourly', period_start: '2026-09-01', period_end: '2026-09-30', row_count: 23 }),
    ]))
    expect(lotes(a)).toHaveLength(1)
    expect(lotes(a)[0]).toMatchObject({ lote: 'lote-um', canalRef: A, canalNome: 'Canal sintético', arquivos: 3, registros: 124, periodoDe: '2025-01-01', periodoAte: '2026-09-30', conferido: false, conferidoEm: null, dias: 3 })
    expect(PERIODO_DE_ARQUIVO_UNICO).toBe('1970-01-01')
  })

  it('linha de arquivo único não entra no período; lote só com arquivo único tem período nulo', async () => {
    const { a } = await ler(banco([linhaDeLote({ batch: 'lote-um', channel_ref: A, table_name: 'competitor_channels', period_start: PERIODO_DE_ARQUIVO_UNICO, period_end: PERIODO_DE_ARQUIVO_UNICO, row_count: 1 })]))
    expect(lotes(a)[0]).toMatchObject({ periodoDe: null, periodoAte: null, registros: 1 })
  })

  it('conferidoEm só existe com todas as linhas do lote conferidas', async () => {
    const todas = (verificadas: number): Linha[] => ['t1', 't2', 't3'].map((t, i) => linhaDeLote({ batch: 'lote-um', channel_ref: A, table_name: t, verified_at: i < verificadas ? iso(2 - i * 0.1) : null }))
    const parcial = await ler(banco(todas(2)))
    expect(lotes(parcial.a)[0]).toMatchObject({ conferido: false, conferidoEm: null })
    const completa = await ler(banco(todas(3)))
    expect(lotes(completa.a)[0]!.conferido).toBe(true)
    expect(lotes(completa.a)[0]!.conferidoEm).toBe(iso(2 - 0.2)) // o maior verified_at do lote
  })

  it('exportado e não confirmado aparece; confirmado some; apagado some; encerrado (despausado ou substituído) some', async () => {
    const { a } = await ler(banco([
      linhaDeLote({ batch: 'lote-aberto', channel_ref: A, table_name: 't1' }),
      linhaDeLote({ batch: 'lote-confirmado', channel_ref: A, table_name: 't1', verified_at: iso(2), nas_confirmed_at: iso(1) }),
      linhaDeLote({ batch: 'lote-apagado', channel_ref: A, table_name: 't1', verified_at: iso(2), nas_confirmed_at: iso(1), deleted_at: iso(0) }),
      linhaDeLote({ batch: 'lote-despausado', channel_ref: A, table_name: 't1', closed_at: iso(1), closed_reason: 'despausado' }),
      linhaDeLote({ batch: 'lote-substituido', channel_ref: B, table_name: 't1', closed_at: iso(1), closed_reason: 'substituido' }),
    ]))
    expect(lotes(a).map(l => l.lote)).toEqual(['lote-aberto'])
  })

  it('lote aberto de canal que não existe mais não é listado e é contado (nunca escondido)', async () => {
    const { a } = await ler(banco([
      linhaDeLote({ batch: 'lote-vivo', channel_ref: A, table_name: 't1' }),
      linhaDeLote({ batch: 'lote-orfao', channel_ref: SUMIU, table_name: 't1' }),
      linhaDeLote({ batch: 'lote-orfao', channel_ref: SUMIU, table_name: 't2' }),
      linhaDeLote({ batch: 'lote-orfao-confirmado', channel_ref: SUMIU, table_name: 't1', verified_at: iso(2), nas_confirmed_at: iso(1) }),
    ]))
    expect(lotes(a).map(l => l.lote)).toEqual(['lote-vivo'])
    expect(a.lotesDeCanalInexistente).toEqual({ valor: 2 })
  })

  it('lotes de outro site não aparecem, e o filtro de site vai em todas as consultas', async () => {
    const { a, x } = await ler(banco([
      linhaDeLote({ batch: 'lote-meu', channel_ref: A, table_name: 't1' }),
      linhaDeLote({ batch: 'lote-alheio', channel_ref: A, table_name: 't1', site_id: OUTRO_SITE }),
    ]))
    expect(lotes(a).map(l => l.lote)).toEqual(['lote-meu'])
    for (const c of x.consultas.filter(q => q.tabela !== 'obs_db_size_daily')) expect(c.filtros, c.tabela).toContainEqual(['eq', 'site_id', SITE])
  })

  it('lê todas as páginas: 2.500 linhas de registro não são cortadas em 1.000', async () => {
    const muitas = Array.from({ length: 2_500 }, (_, i) => linhaDeLote({ batch: 'lote-grande', channel_ref: A, table_name: `t${i}`, row_count: 2 }))
    const { a, x } = await ler(banco(muitas))
    expect(lotes(a)[0]).toMatchObject({ arquivos: 2_500, registros: 5_000 })
    expect(x.consultas.filter(q => q.filtros.some(f => f[0] === 'is' && f[1] === 'closed_at')).flatMap(q => q.intervalos)).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })
})

describe('A5 E10 T8: lerAvisoDoArquivo, pausados, miniaturas e as falhas', () => {
  it('pausado há 8 dias vem com esquecido: true; há 1 dia, false; canal pausado de outro site não aparece', async () => {
    const cs: Linha[] = [
      { id: A, site_id: SITE, channel_name: 'Canal A', collection_paused_at: iso(8) },
      { id: B, site_id: SITE, channel_name: 'Canal B', collection_paused_at: iso(1) },
      { id: SUMIU, site_id: OUTRO_SITE, channel_name: 'Alheio', collection_paused_at: iso(30) },
      { id: '1', site_id: SITE, channel_name: 'Rodando', collection_paused_at: null },
    ]
    const { a } = await ler(banco([], cs))
    expect('valor' in a.pausados && a.pausados.valor).toEqual([
      { canalId: A, nome: 'Canal A', desde: iso(8), dias: 8, esquecido: true },
      { canalId: B, nome: 'Canal B', desde: iso(1), dias: 1, esquecido: false },
    ])
    expect(RULES.pause.forgottenDays).toBe(7)
  })

  it('miniaturas pendentes somam as URLs dos canais removidos do site', async () => {
    const { a } = await ler(banco([
      linhaDeLote({ batch: 'x', channel_ref: A, table_name: 'competitor_channels', deleted_at: iso(1), blob_urls_pending: ['u1', 'u2', 'u3'] }),
      linhaDeLote({ batch: 'y', channel_ref: B, table_name: 'competitor_channels', deleted_at: iso(4), blob_urls_pending: ['u4'] }),
      linhaDeLote({ batch: 'z', channel_ref: B, table_name: 'competitor_channels', deleted_at: iso(4), blob_urls_pending: [] }),
      linhaDeLote({ batch: 'w', channel_ref: B, table_name: 'competitor_channels', deleted_at: iso(4), blob_urls_pending: ['alheio'], site_id: OUTRO_SITE }),
      linhaDeLote({ batch: 'v', channel_ref: B, table_name: 'competitor_video_daily', deleted_at: iso(4), blob_urls_pending: ['de outra tabela'] }),
    ]))
    expect(a.miniaturasPendentes).toEqual({ valor: 4 })
  })

  it('uma leitura falha e as outras vêm; erro é "porque", lista vazia é lista vazia (nunca trocados)', async () => {
    const t = banco([linhaDeLote({ batch: 'lote-um', channel_ref: A, table_name: 't1' })])
    const { a } = await ler(t, { competitor_channels: { message: SEGREDO, code: '57014' } })
    expect(a.pausados).toEqual({ porque: 'erro_do_banco' })
    // os lotes dependem da lista de canais: falham juntos; mas o sinal e as miniaturas vêm
    expect(a.lotesNaoConfirmados).toEqual({ porque: 'erro_do_banco' })
    expect(a.lotesDeCanalInexistente).toEqual({ porque: 'erro_do_banco' })
    expect(a.miniaturasPendentes).toEqual({ valor: 0 })
    expect('valor' in a.banco).toBe(true)
    expect(JSON.stringify(a)).not.toContain(SEGREDO)
    const vazio = await ler(banco([]))
    expect(vazio.a.lotesNaoConfirmados).toEqual({ valor: [] })
    expect(vazio.a.lotesDeCanalInexistente).toEqual({ valor: 0 })
    expect(vazio.a.pausados).toEqual({ valor: [] })
    expect(vazio.a.miniaturasPendentes).toEqual({ valor: 0 })
  })

  it('tabela ausente: schema_ausente; exceção: excecao; as outras partes seguem', async () => {
    const { a } = await ler(banco([]), { obs_archive_batches: { message: SEGREDO, code: '42P01' }, obs_db_size_daily: 'lanca' })
    expect(a.lotesNaoConfirmados).toEqual({ porque: 'schema_ausente' })
    expect(a.miniaturasPendentes).toEqual({ porque: 'schema_ausente' })
    expect(a.banco).toEqual({ porque: 'excecao' })
    expect(a.pausados).toEqual({ valor: [] })
    expect(JSON.stringify(a)).not.toContain(SEGREDO)
  })

  it('linha fora da forma: forma_invalida só nessa parte', async () => {
    const t = banco([{ ...linhaDeLote({ batch: 'lote-um', channel_ref: A, table_name: 't1' }), exported_at: 'ontem' }])
    const { a } = await ler(t)
    expect(a.lotesNaoConfirmados).toEqual({ porque: 'forma_invalida' })
    expect(a.pausados).toEqual({ valor: [] })
  })

  it('muitos canais com lote aberto: a lista de ids vai em blocos de até 100 (a URL não estoura) e o resultado é o mesmo (revisão Yannis 14/10, M7)', async () => {
    const id = (n: number): string => `0a1b2c3d-1111-4222-8333-${String(n).padStart(12, '0')}`
    const refs = Array.from({ length: 250 }, (_, i) => id(i + 1))
    const lotesDe = refs.map(r => linhaDeLote({ batch: 'lote-' + r.slice(-4), channel_ref: r, table_name: 't1' }))
    const cs = refs.slice(0, 249).map(r => ({ id: r, site_id: SITE, channel_name: 'c', collection_paused_at: null })) // o último some: lote de canal que não existe mais
    const { a, x } = await ler(banco(lotesDe, cs))
    const ins = x.consultas.filter(c => c.tabela === 'competitor_channels').flatMap(c => c.filtros.filter(f => f[0] === 'in' && f[1] === 'id'))
    expect(ins.length).toBeGreaterThanOrEqual(3)
    for (const f of ins) expect((f[2] as unknown[]).length).toBeLessThanOrEqual(100)
    expect(ins.flatMap(f => f[2] as string[]).sort()).toEqual([...refs].sort())
    expect(lotes(a)).toHaveLength(249)
    expect(a.lotesDeCanalInexistente).toEqual({ valor: 1 })
  })

  it('o aviso leva o sinal do banco, lido pela mesma função do leitor (sem tabela: nunca medido)', async () => {
    const { a } = await ler(banco([]))
    expect('valor' in a.banco && a.banco.valor.estado).toBe('nunca_medido')
  })
})
