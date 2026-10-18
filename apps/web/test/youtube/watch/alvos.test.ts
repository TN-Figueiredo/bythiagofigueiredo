// @vitest-environment node
// Candidatos e conciliação da watch (A5 S4, Tarefa 9). Banco falso em memória; datas relativas ao relógio.
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  montarCandidatos, lerTestesVivos, conciliar, lerDevidos, marcarTesteNosso, PROPRIOS_ANTIGOS, INCLUIR_SHORTS, chaveAlvo,
  type AlvoAtivo, type TesteVivo,
} from '@/lib/youtube/watch/alvos'
import type { CandConcorrente, CandProprio } from '@/lib/youtube/horaria/lista'
import { RULES } from '@/lib/youtube/observatorio/rules'

const DIA = 86_400_000
const AGORA = Math.floor(Date.now() / 3_600_000) * 3_600_000
const iso = (ms: number): string => new Date(ms).toISOString()
const SITE = '11111111-1111-4111-8111-111111111111'
const SENTINELA = 'TEXTO-SENTINELA-DO-BANCO'
const yt = (n: number): string => `v${String(n).padStart(10, '0')}`

function conc(n: number, o: Partial<CandConcorrente> = {}): CandConcorrente {
  return { id: `u${n}`, ytId: yt(n), canalId: 'c1', siteId: SITE, publishedAt: iso(AGORA - 2 * DIA), discoveredAt: null, lbc: null,
    missingSince: null, canalAusente: false, canalPausado: false, ...o }
}
function prop(n: number, o: Partial<CandProprio> = {}): CandProprio {
  return { id: `p${n}`, ytId: yt(n), canalId: 'd1', siteId: SITE, publishedAt: iso(AGORA - 2 * DIA), createdAt: iso(AGORA - 2 * DIA), ...o }
}

// ───────────────────────── o banco falso ─────────────────────────
type Linha = Record<string, unknown>
interface Pedido { tabela: string; filtros: string[] }
interface Banco {
  sb: SupabaseClient
  tabelas: Map<string, Linha[]>
  pedidos: Pedido[]
  rpcs: Array<{ nome: string; args: Record<string, unknown> }>
  falhaTabela: Set<string>
  respostaRpc: { data: unknown; error: unknown }
}
function criarBanco(): Banco {
  const b: Banco = {
    sb: undefined as never, tabelas: new Map(), pedidos: [], rpcs: [], falhaTabela: new Set(),
    respostaRpc: { data: { inseridos: 0, atualizados: 0, removidos: 0, alvos_ativos: 0 }, error: null },
  }
  b.sb = {
    from: (tabela: string) => {
      const pedido: Pedido = { tabela, filtros: [] }
      b.pedidos.push(pedido)
      let faixa: [number, number] | null = null
      let limite: number | null = null
      const q: Record<string, unknown> = {}
      const reg = (nome: string) => (...a: unknown[]) => { pedido.filtros.push(`${nome}:${a.map(String).join(',')}`); return q }
      for (const n of ['select', 'eq', 'is', 'lte', 'lt', 'gt', 'not', 'or', 'order', 'abortSignal']) q[n] = reg(n)
      q.range = (de: number, ate: number) => { faixa = [de, ate]; return q }
      q.limit = (n: number) => { limite = n; return q }
      q.then = (ok: (r: unknown) => unknown, err: (e: unknown) => unknown) => {
        if (b.falhaTabela.has(tabela)) return Promise.resolve({ data: null, error: { message: SENTINELA, code: 'XX000' } }).then(ok, err)
        let rows = b.tabelas.get(tabela) ?? []
        if (tabela === 'yt_watch_alvos' && pedido.filtros.some(f => f.startsWith('lte:'))) {
          const corte = pedido.filtros.find(f => f.startsWith('lte:'))?.split(',')[1] ?? ''
          rows = rows.filter(r => !('proxima_rodada_em' in r) || (r.saiu_em === null && String(r.proxima_rodada_em) <= corte))
        }
        if (tabela === 'competitor_videos' || tabela === 'youtube_videos') {
          const or = pedido.filtros.find(f => f.startsWith('or:'))
          if (or) {
            const m = /published_at\.gt\.([^,]+),/.exec(or)
            const corte = m?.[1] ?? ''
            rows = rows.filter(r => typeof r.published_at === 'string' && r.published_at > corte)
          }
          const lt = pedido.filtros.find(f => f.startsWith('lt:published_at'))
          if (lt) { const c = lt.split(',')[1] ?? ''; rows = rows.filter(r => typeof r.published_at === 'string' && r.published_at < c) }
        }
        if (faixa) rows = rows.slice(faixa[0], faixa[1] + 1)
        if (limite !== null) rows = rows.slice(0, limite)
        return Promise.resolve({ data: rows, error: null }).then(ok, err)
      }
      return q
    },
    rpc: (nome: string, args: Record<string, unknown>) => {
      b.rpcs.push({ nome, args })
      const r = { abortSignal: () => r, then: (ok: (x: unknown) => unknown, err: (e: unknown) => unknown) => Promise.resolve(b.respostaRpc).then(ok, err) }
      return r
    },
  } as never
  return b
}
const semear = (b: Banco, t: string, l: Linha[]): void => { b.tabelas.set(t, [...(b.tabelas.get(t) ?? []), ...l]) }
const concBanco = (n: number, pub: number, extra: Linha = {}): Linha => ({
  id: `u${n}`, video_id: yt(n), competitor_channel_id: 'c1', published_at: iso(pub), discovered_at: null,
  live_broadcast_content: null, missing_since: null,
  competitor_channels: { site_id: SITE, missing_since: null, collection_paused_at: null }, ...extra,
})
const propBanco = (n: number, pub: number): Linha => ({
  id: `p${n}`, youtube_video_id: yt(n), channel_id: 'd1', site_id: SITE, published_at: iso(pub), created_at: iso(pub),
})
const testeBanco = (n: number, status: string, criado: number, atualizado: number | null = null): Linha => ({
  status, created_at: iso(criado), updated_at: atualizado === null ? null : iso(atualizado),
  youtube_videos: { youtube_video_id: yt(n), site_id: SITE },
})

describe('montarCandidatos', () => {
  it('id fora do formato de 11 caracteres fica fora (não aborta a conciliação no CHECK)', () => {
    const r = montarCandidatos([conc(1), conc(2, { ytId: 'pinold1' }), conc(3, { ytId: 'v123456789012' })], [], [{ siteId: SITE, ytId: 'curto' }], null, AGORA)
    expect(r.map((c) => c.ytId)).toEqual([yt(1)])
  })
  it('Short entra quando INCLUIR_SHORTS (o vídeo não é filtrado por duração)', () => {
    expect(INCLUIR_SHORTS).toBe(true)
    const r = montarCandidatos([conc(1)], [], [], null, AGORA)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ tipo: 'concorrente', motivoAte: 'janela_concorrente', rodadasPorDia: 4, coletaAte: iso(AGORA - 2 * DIA + 30 * DIA) })
  })
  it('canal pausado, canal ausente, vídeo ausente e publishedAt nulo ficam fora', () => {
    const r = montarCandidatos([
      conc(1, { canalPausado: true }), conc(2, { canalAusente: true }), conc(3, { missingSince: iso(AGORA) }),
      conc(4, { publishedAt: null }), conc(5, { publishedAt: iso(AGORA - 31 * DIA) }),
    ], [], [], null, AGORA)
    expect(r).toEqual([])
  })
  it('próprio com 15 dias fica fora; com 13 entra até publishedAt + 14 d', () => {
    expect(montarCandidatos([], [prop(1, { publishedAt: iso(AGORA - 15 * DIA) })], [], null, AGORA)).toEqual([])
    const r = montarCandidatos([], [prop(2, { publishedAt: iso(AGORA - 13 * DIA) })], [], null, AGORA)
    expect(r[0]).toMatchObject({ tipo: 'proprio', motivoAte: 'janela_propria', coletaAte: iso(AGORA + DIA) })
  })
  it('o mesmo vídeo como próprio e como teste dá 1 candidato teste_nosso com o maior coletaAte', () => {
    const r = montarCandidatos([], [prop(1, { publishedAt: iso(AGORA - DIA) })], [{ siteId: SITE, ytId: yt(1) }], null, AGORA)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ motivoAte: 'teste_nosso', rodadasPorDia: 4, coletaAte: iso(AGORA - DIA + 14 * DIA) })
  })
  it('D2: antigo entra com 1/dia e proprio_antigo; vídeo de até 14 d não vira antigo', () => {
    expect(PROPRIOS_ANTIGOS).toBe(true)
    const r = montarCandidatos([], [], [], [prop(1, { publishedAt: iso(AGORA - 60 * DIA) }), prop(2, { publishedAt: iso(AGORA - 5 * DIA) }), prop(3, { publishedAt: null })], AGORA)
    expect(r).toEqual([{ siteId: SITE, ytId: yt(1), tipo: 'proprio', motivoAte: 'proprio_antigo', coletaAte: iso(AGORA + DIA), rodadasPorDia: 1 }])
  })
  it('D2: antigo que ganha teste passa a 4/dia', () => {
    const r = montarCandidatos([], [], [{ siteId: SITE, ytId: yt(1) }], [prop(1, { publishedAt: iso(AGORA - 60 * DIA) })], AGORA)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ motivoAte: 'teste_nosso', rodadasPorDia: 4 })
  })
  it('vídeos de sites diferentes com o mesmo id não se fundem', () => {
    const r = montarCandidatos([conc(1), conc(1, { siteId: '22222222-2222-4222-8222-222222222222' })], [], [], null, AGORA)
    expect(r).toHaveLength(2)
  })
})

describe('lerTestesVivos', () => {
  it('draft com 31 d fica fora, com 29 d entra; active entra; o id é o de 11 caracteres, não o uuid', async () => {
    const b = criarBanco()
    semear(b, 'ab_tests', [
      testeBanco(1, 'draft', AGORA - 31 * DIA, AGORA - 31 * DIA), testeBanco(2, 'draft', AGORA - 29 * DIA), testeBanco(3, 'active', AGORA - 90 * DIA),
      testeBanco(4, 'draft', AGORA - 90 * DIA, AGORA - DIA),
    ])
    const r = await lerTestesVivos(b.sb, AGORA)
    expect(r).toEqual({ valor: [{ siteId: SITE, ytId: yt(2) }, { siteId: SITE, ytId: yt(3) }, { siteId: SITE, ytId: yt(4) }] })
    expect('valor' in r && r.valor.every(t => t.ytId.length === 11)).toBe(true)
    const f = b.pedidos[0]?.filtros ?? []
    expect(f.find(x => x.startsWith('select:'))).toContain('youtube_videos!inner(youtube_video_id, site_id)')
    expect(f).toContain('not:status,in,(completed,archived)')
  })
  it('falha do banco devolve porque, sem o texto do banco', async () => {
    const b = criarBanco()
    b.falhaTabela.add('ab_tests')
    const r = await lerTestesVivos(b.sb, AGORA)
    expect('porque' in r).toBe(true)
    expect(JSON.stringify(r)).not.toContain(SENTINELA)
  })
})

describe('conciliar', () => {
  it('3 candidatos com o RPC devolvendo alvos_ativos 0: candidatosEsperados 3 e alvosAtivos 0; o novo recebe a faixa menos cheia', async () => {
    const b = criarBanco()
    semear(b, 'competitor_videos', [concBanco(1, AGORA - DIA), concBanco(2, AGORA - DIA), concBanco(3, AGORA - DIA)])
    // 17 das 18 faixas ocupadas: a vaga é a da faixa 0 (0..19)
    semear(b, 'yt_watch_alvos', Array.from({ length: 17 }, (_, i) => ({
      id: 100 + i, site_id: SITE, youtube_video_id: `x${String(i).padStart(10, '0')}`, hora_base_min: (i + 1) * 20 + 5, saiu_em: null,
    })))
    const r = await conciliar(b.sb, AGORA)
    expect('valor' in r && r.valor).toMatchObject({ candidatosEsperados: 3, alvosAtivos: 0, sites: [SITE] })
    const args = b.rpcs[0]?.args
    expect(b.rpcs[0]?.nome).toBe('yt_watch_conciliar')
    expect(args?.p_agora).toBe(iso(AGORA))
    const p = args?.p_candidatos
    expect(Array.isArray(p) && p.length).toBe(3)
    if (Array.isArray(p)) expect(p[0].hora_base_min % 360).toBeLessThan(20)
  })
  it('o alvo existente não é recalculado: leva o hora_base_min lido', async () => {
    const b = criarBanco()
    semear(b, 'competitor_videos', [concBanco(1, AGORA - DIA)])
    semear(b, 'yt_watch_alvos', [{ id: 1, site_id: SITE, youtube_video_id: yt(1), hora_base_min: 777, saiu_em: iso(AGORA - DIA) }])
    await conciliar(b.sb, AGORA)
    expect(b.rpcs[0]?.args.p_candidatos).toEqual([expect.objectContaining({ youtube_video_id: yt(1), hora_base_min: 777 })])
  })
  it('Phil I6: toda entrada de p_candidatos tem os 7 campos não nulos, inclusive a de alvo existente', async () => {
    const b = criarBanco()
    semear(b, 'competitor_videos', [concBanco(1, AGORA - DIA), concBanco(2, AGORA - DIA)])
    semear(b, 'youtube_videos', [propBanco(3, AGORA - 90 * DIA), propBanco(4, AGORA - 3 * DIA)])
    semear(b, 'yt_watch_alvos', [{ id: 1, site_id: SITE, youtube_video_id: yt(1), hora_base_min: 5, saiu_em: null }])
    await conciliar(b.sb, AGORA)
    const p = b.rpcs[0]?.args.p_candidatos
    expect(Array.isArray(p) && p.length).toBe(4)
    if (Array.isArray(p)) for (const c of p) {
      for (const campo of ['site_id', 'youtube_video_id', 'tipo', 'motivo_ate', 'coleta_ate', 'hora_base_min', 'rodadas_por_dia']) {
        expect(c[campo]).not.toBeNull()
        expect(c[campo]).not.toBeUndefined()
      }
      expect(c.hora_base_min).toBeGreaterThanOrEqual(0)
      expect(c.hora_base_min).toBeLessThanOrEqual(1439)
    }
  })
  it('D2: o antigo vai com 1/dia e proprio_antigo; a 4ª consulta é a de youtube_videos com published_at < corte de 14 d', async () => {
    const b = criarBanco()
    semear(b, 'youtube_videos', [propBanco(3, AGORA - 90 * DIA)])
    await conciliar(b.sb, AGORA)
    expect(b.rpcs[0]?.args.p_candidatos).toEqual([expect.objectContaining({ youtube_video_id: yt(3), motivo_ate: 'proprio_antigo', rodadas_por_dia: 1 })])
    expect(b.pedidos.filter(p => p.tabela === 'youtube_videos')).toHaveLength(2)
  })
  it('lerCandidatos lança: devolve porque e o RPC não é chamado', async () => {
    const b = criarBanco()
    b.falhaTabela.add('competitor_videos')
    const r = await conciliar(b.sb, AGORA)
    expect('porque' in r).toBe(true)
    expect(JSON.stringify(r)).not.toContain(SENTINELA)
    expect(b.rpcs).toHaveLength(0)
  })
  it('falha na leitura dos alvos: porque, sem RPC', async () => {
    const b = criarBanco()
    b.falhaTabela.add('yt_watch_alvos')
    const r = await conciliar(b.sb, AGORA)
    expect('porque' in r && r.causa).toBe('erro_do_banco')
    expect(b.rpcs).toHaveLength(0)
  })
  it('erro do RPC e resposta fora da forma viram porque, sem o texto do banco', async () => {
    const b = criarBanco()
    b.respostaRpc = { data: null, error: { message: SENTINELA, code: '42883' } }
    const r1 = await conciliar(b.sb, AGORA)
    expect(r1).toMatchObject({ causa: 'erro_do_banco', codigo: '42883' })
    expect(JSON.stringify(r1)).not.toContain(SENTINELA)
    b.respostaRpc = { data: { inseridos: 1 }, error: null }
    expect(await conciliar(b.sb, AGORA)).toMatchObject({ causa: 'forma_invalida' })
  })
  it('devolve testesVivos (site|yt) do mesmo disparo', async () => {
    const b = criarBanco()
    semear(b, 'ab_tests', [testeBanco(9, 'active', AGORA - DIA)])
    const r = await conciliar(b.sb, AGORA)
    expect('valor' in r && r.valor.testesVivos).toEqual(new Set([chaveAlvo(SITE, yt(9))]))
  })
})

describe('lerDevidos e Phil I7', () => {
  const linhaAlvo = (n: number, motivo: string, extra: Linha = {}): Linha => ({
    id: n, site_id: SITE, youtube_video_id: yt(n), hora_base_min: 10, rodadas_por_dia: 4, proxima_rodada_em: iso(AGORA - 60_000),
    coleta_ate: iso(AGORA + DIA), motivo_ate: motivo, extensoes_curtas: 0, indisponivel_seguidas: 4, rodadas: 3, saiu_em: null, ...extra,
  })
  it('lê só os ativos e devidos, em ordem, com limite', async () => {
    const b = criarBanco()
    semear(b, 'yt_watch_alvos', [linhaAlvo(1, 'janela_propria'), linhaAlvo(2, 'janela_propria', { proxima_rodada_em: iso(AGORA + DIA) }), linhaAlvo(3, 'janela_propria', { saiu_em: iso(AGORA) })])
    const r = await lerDevidos(b.sb, AGORA, 16)
    expect('valor' in r && r.valor.map(a => a.ytId)).toEqual([yt(1)])
    const f = b.pedidos[0]?.filtros ?? []
    expect(f).toContain('is:saiu_em,null')
    expect(f.some(x => x.startsWith('order:proxima_rodada_em'))).toBe(true)
  })
  it('alvo janela_propria ou extensao com teste vivo e 4 indisponivel: temTesteNosso vem do Set, não do motivo_ate', async () => {
    const b = criarBanco()
    semear(b, 'yt_watch_alvos', [linhaAlvo(1, 'janela_propria'), linhaAlvo(2, 'extensao'), linhaAlvo(3, 'teste_nosso')])
    const r = await lerDevidos(b.sb, AGORA, 16)
    if (!('valor' in r)) throw new Error('devia ler')
    expect(r.valor.every(a => a.temTesteNosso === false)).toBe(true)
    const vivos = new Set([chaveAlvo(SITE, yt(1)), chaveAlvo(SITE, yt(2))])
    const marcados: AlvoAtivo[] = marcarTesteNosso(r.valor, vivos)
    expect(marcados.map(a => [a.ytId, a.temTesteNosso])).toEqual([[yt(1), true], [yt(2), true], [yt(3), false]])
  })
  it('resposta fora da forma ou erro do banco: porque', async () => {
    const b = criarBanco()
    semear(b, 'yt_watch_alvos', [{ id: 1 }])
    expect(await lerDevidos(b.sb, AGORA, 16)).toMatchObject({ causa: 'forma_invalida' })
    b.falhaTabela.add('yt_watch_alvos')
    expect(await lerDevidos(b.sb, AGORA, 16)).toMatchObject({ causa: 'erro_do_banco', codigo: 'XX000' })
  })
})

describe('tipos', () => {
  it('TesteVivo é só site e id', () => {
    const t: TesteVivo = { siteId: SITE, ytId: yt(1) }
    expect(Object.keys(t)).toEqual(['siteId', 'ytId'])
    expect(RULES.hourly.ageDays).toBe(14)
  })
})
