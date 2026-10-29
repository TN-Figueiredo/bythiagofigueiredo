// @vitest-environment node
/**
 * F4 T3: paridade declarada de `trafego_do_terceiro` entre tela, pacote `sugestoes`, rota e `get_signals` do MCP (D-F4-1).
 * Tela e pacote leem com a prova de leitura; a rota e o MCP passam `null` e devolvem `nao_medido`/`sem_direito` até a porta do perfil ligar.
 */
import { describe, it, expect, vi } from 'vitest'
import { fakeSb, type Consulta, type Resposta } from '../../youtube/observatorio/sinais/fake-sb'

const SITE = '11111111-1111-4111-8111-111111111111'
const mundo = vi.hoisted(() => ({ sb: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/pipeline/mcp/context', () => ({ getMcpContext: () => ({ siteId: SITE, permissions: ['read'], keyHash: 'h', keyId: 'k' }) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => mundo.sb }))

import type { ItemDeSinal, ListaDeSinais } from '@/lib/youtube/observatorio/sinais/leitura'
import { estadoDaSugestao } from '@/lib/youtube/observatorio/sinais/trafego-terceiro/regra'
import { youtubeObservatory, cabeNoLimite, LIMITE_DO_TEXTO_DA_FERRAMENTA } from '@/lib/pipeline/mcp/services/youtube-observatory'
import { listNicheSignals } from '@/lib/pipeline/services/niche-signals'
import { empacotarSugestoes, modeloDeSugestoes, privadoDaLista, INVENTARIO_SUGESTOES } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/sugestoes'
import { semDestino, semUso } from '@/lib/youtube/observatorio/contexto-ia/inventario'

const agoraIso = new Date().toISOString()
const outlier = (i: number) => ({ video_id: `0000000${i}-0000-4000-8000-000000000000`, canal_id: `1111111${i % 9}-0000-4000-8000-000000000000`, published_at: agoraIso, mult_vpd7: 12.34567, mult_tela: 4.5678, vpd7: 123456.78, formato: 'long' })
const linha = (i: number) => ({ id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`, kind: 'destino', subject_key: `pais:${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`, acao: 'titulo_descricao', forca: 99.99,
  motivo: 'dois canais estouraram no mesmo lugar nos últimos 14 dias', rule_version: 'sinais-v1+semente-1', first_seen_at: agoraIso, expires_at: agoraIso,
  evidence: { outliers: Array.from({ length: 20 }, (_, k) => outlier(k)), outliers_total: 40, canais: 9, proprios: Array.from({ length: 10 }, (_, k) => `bbbbbbbb-0000-4000-8000-00000000000${k}`) } })

function montar(n: number): void {
  const linhas = Array.from({ length: n }, (_, i) => linha(i))
  mundo.sb = fakeSb((c: Consulta): Resposta => {
    if (c.tabela === 'niche_signals') return { data: linhas, count: linhas.length }
    if (c.tabela === 'niche_signals_estado') return { data: [{ computed_at: agoraIso, motivo_vazio: null, contagens: {} }] }
    if (c.tabela === 'video_lugares') return { data: c.filtros.some((f) => f.op === 'overlaps') ? linhas.slice(0, 5).map((l, i) => ({ video_id: `bbbbbbbb-0000-4000-8000-00000000000${i}`, chaves: [l.subject_key] })) : [{ video_id: 'x' }] }
    return { data: [] }
  }).sb
}
const ctx = () => ({ siteId: SITE, permissions: ['read'], keyHash: 'h', keyId: 'k', supabase: mundo.sb, source: 'api_key' }) as never

// fixtures GERADAS por `estadoDaSugestao` (nunca literal): campo novo no tipo aparece aqui sem editar o teste (C-Y3)
const CTX = { desde: '2026-10-20', coberto_ate: '2026-10-28' }
const SIM = estadoDaSugestao([{ estado: 'sim', views: 1000, dias: 1 }, { estado: 'sim', views: 234, dias: 1 }, { estado: 'nao', diasCobertos: 7, ate: '2026-10-27' }], 'TERC000001a', null, 3, false, CTX)
const NAO = estadoDaSugestao([{ estado: 'nao', diasCobertos: 7, ate: '2026-10-27' }, { estado: 'nao', diasCobertos: 7, ate: '2026-10-28' }, { estado: 'nao', diasCobertos: 7, ate: '2026-10-27' }], 'TERC000002b', null, 3, false, CTX)
const NM = estadoDaSugestao([], 'TERC000003c', 'cobertura_velha', 3, false, { desde: '2026-10-20', coberto_ate: null })

/** A lista REAL (rota/serviço) com a prova trocada nos 3 itens: o que a tela e o pacote veem quando a leitura foi provada. */
async function listaComProva(): Promise<ListaDeSinais> {
  montar(3)
  const real = (await listNicheSignals(ctx(), { limit: 50 })).data as ListaDeSinais
  const por = [SIM, NAO, NM]
  return { ...real, itens: real.itens.map((i, k): ItemDeSinal => ({ ...i, trafego_do_terceiro: por[k]! })) }
}
const semTrafego = (i: ItemDeSinal): unknown => { const { trafego_do_terceiro: _t, ...resto } = i; void _t; return resto }

async function tela(lista: ListaDeSinais): Promise<ListaDeSinais> {
  vi.resetModules()
  vi.doMock('server-only', () => ({}))
  vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: SITE }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u' } }) }))
  vi.doMock('@/lib/cms/auth-guards', () => ({ requireSiteAdminScope: async () => ({ ok: true }) }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))
  vi.doMock('@/lib/youtube/observatorio/sinais/leitura', () => ({ listarSinaisDoNicho: async () => lista, calculoLigadoNoAmbiente: () => true }))
  vi.doMock('@/lib/youtube/observatorio/proprio/leitura-privada', () => ({ acessoDoEditor: async () => ({ marca: 'leitura' }) }))
  vi.doMock('@/lib/youtube/observatorio/sinais/amostra', () => ({ lerAmostraDasLinhas: async () => new Map() }))
  const { abrirListaDaTela } = await import('@/app/cms/(authed)/youtube/competitors/_sugestoes/dados-da-tela')
  const r = await abrirListaDaTela(new Date(), 100)
  if (r.estado !== 'ok') throw new Error('tela não abriu')
  return r.lista
}

const texto = (c: { texto?: string; motivo?: string }): string => c.texto ?? c.motivo ?? ''

describe('F4 T3: paridade do trafego_do_terceiro', () => {
  it('(i) tela e pacote devolvem o mesmo estado, motivo, números e ate por id', async () => {
    const lista = await listaComProva()
    const daTela = (await tela(lista)).itens
    const t = empacotarSugestoes(modeloDeSugestoes(lista, new Date()), privadoDaLista(lista)).tabelas.find((x) => x.id === 'sugestoes-trafego')!
    expect(t.linhas).toHaveLength(3)
    const rotuloDoEstado = { sim: 'sim', nao: 'não', nao_medido: 'não medido', nao_se_aplica: 'não se aplica' } as const
    for (const it of daTela) {
      const l = t.linhas.find((x) => texto(x[0] as never) === it.id)!
      const f = it.trafego_do_terceiro
      expect(texto(l[1] as never)).toBe(rotuloDoEstado[f.estado])
      expect(texto(l[2] as never)).toBe(f.motivo ?? '—')
      expect(texto(l[3] as never)).toBe(String(f.videos_com_trafego))
      expect(texto(l[4] as never)).toBe(String(f.videos_medidos))
      expect(texto(l[5] as never)).toBe(String(f.videos_total))
      if (f.views !== null) expect(texto(l[6] as never)).toBe(String(f.views))
      else expect((l[6] as { estado: string }).estado).toBe('nao_medido')
      expect(texto(l[7] as never)).toBe(f.ate ?? '—')
      expect(texto(l[8] as never)).toBe(f.desde ?? 'o dado não informa essa data')
      expect(texto(l[9] as never)).toBe(f.coberto_ate ?? 'o dado não informa essa data')
      expect(texto(l[10] as never)).toBe(f.terceiro_video_id ?? '—')
      expect(texto(l[11] as never)).toBe(f.regra)
    }
    // "não medido" nunca vira "não" nem 0 no pacote
    const nm = t.linhas.find((x) => texto(x[0] as never) === lista.itens[2]!.id)!
    expect(texto(nm[1] as never)).toBe('não medido')
    expect((nm[6] as { estado: string }).estado).toBe('nao_medido')
  })

  it('(ii) a rota (listNicheSignals) e o get_signals devolvem nao_medido/sem_direito para os mesmos ids', async () => {
    montar(3)
    const rota = (await listNicheSignals(ctx(), { limit: 50 })).data as ListaDeSinais
    const mcp = JSON.parse((await youtubeObservatory({ action: 'get_signals' })).content[0]!.text!) as ListaDeSinais
    expect(mcp.itens.map((i) => i.id)).toEqual(rota.itens.map((i) => i.id))
    for (const i of [...rota.itens, ...mcp.itens]) expect(i.trafego_do_terceiro).toMatchObject({ estado: 'nao_medido', motivo: 'sem_direito', views: null, ate: null, regra: 'f4-trafego-v1' })
  })

  it('(iii) os demais campos do item são iguais nos quatro caminhos', async () => {
    const lista = await listaComProva()
    const daTela = (await tela(lista)).itens
    const pacote = modeloDeSugestoes(lista, new Date()).itens
    montar(3)
    const mcp = (JSON.parse((await youtubeObservatory({ action: 'get_signals' })).content[0]!.text!) as ListaDeSinais).itens
    const rota = ((await listNicheSignals(ctx(), { limit: 50 })).data as ListaDeSinais).itens
    const base = (xs: ItemDeSinal[]) => JSON.stringify(xs.map(semTrafego))
    expect(base(daTela)).toBe(base(lista.itens))
    expect(base(rota)).toBe(base(lista.itens))
    expect(base(mcp)).toBe(base(lista.itens))
    // o pacote tira só a foto histórica `evidence.proprios`
    expect(pacote.map((i) => i.id)).toEqual(lista.itens.map((i) => i.id))
    expect(pacote.map((i) => i.motivo)).toEqual(lista.itens.map((i) => i.motivo))
  })

  it('(iv) o inventário cobre toda folha do campo novo, em todo estado, e não guarda declaração velha', async () => {
    const lista = await listaComProva()
    const usadas = new Set<string>()
    for (const t of [SIM, NAO, NM]) {
      const m = modeloDeSugestoes({ ...lista, itens: [{ ...lista.itens[0]!, trafego_do_terceiro: t }] }, new Date())
      expect(semDestino(m, INVENTARIO_SUGESTOES)).toEqual([])
      const sobra = new Set(semUso(m, INVENTARIO_SUGESTOES))
      for (const k of Object.keys(INVENTARIO_SUGESTOES)) if (k.includes('trafego_do_terceiro') && !sobra.has(k)) usadas.add(k)
    }
    expect([...usadas].sort()).toEqual(Object.keys(INVENTARIO_SUGESTOES).filter((k) => k.includes('trafego_do_terceiro')).sort())
  })

  it('(v) 50 itens no pior caso: o campo novo pesa ~250 B por item e o MCP não o corta (corta só outliers)', async () => {
    montar(50)
    const r = await youtubeObservatory({ action: 'get_signals' })
    const t = r.content[0]!.text!
    const d = JSON.parse(t) as ListaDeSinais
    const bytesDoCampo = JSON.stringify(d.itens[0]!.trafego_do_terceiro).length
    expect(bytesDoCampo).toBeLessThanOrEqual(300)
    expect(bytesDoCampo * 50).toBeLessThanOrEqual(15_000)
    expect(t.length).toBeLessThanOrEqual(LIMITE_DO_TEXTO_DA_FERRAMENTA)
    expect(d.itens).toHaveLength(50)
    for (const i of d.itens) expect(i.trafego_do_terceiro).toMatchObject({ estado: 'nao_medido', motivo: 'sem_direito' })
    // quantos outliers sobram por item no corte de 60.000, com e sem o campo novo (o campo novo não pode custar mais que um degrau)
    const cheia = (await listNicheSignals(ctx(), { limit: 50 })).data as ListaDeSinais
    const sem = { ...cheia, itens: cheia.itens.map((i) => { const { trafego_do_terceiro: _t, ...resto } = i; void _t; return resto as ItemDeSinal }) }
    const sobramSem = cabeNoLimite(sem).lista.itens[0]!.evidence.outliers.length
    const sobramCom = cabeNoLimite(cheia).lista.itens[0]!.evidence.outliers.length
    expect(sobramCom).toBe(d.itens[0]!.evidence.outliers.length)
    // medido (fixture de 20 outliers, 10 próprios, 50 itens): sem o campo sobra 1 outlier por item; com ele, 0 (a lista dos 50 itens segue inteira)
    expect([sobramSem, sobramCom]).toEqual([1, 0])
    expect(sobramSem - sobramCom).toBeLessThanOrEqual(1)
  })

  it('(vi) C-Y2: guarda de leitura sem resposta no próprio site: a tela diz nao_conferido (não sem_direito) e zero consultas ao detalhe', async () => {
    montar(3)
    vi.resetModules()
    for (const m of ['sinais/leitura', 'proprio/leitura-privada']) vi.doUnmock(`@/lib/youtube/observatorio/${m}`)
    vi.doMock('server-only', () => ({}))
    vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: SITE }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
      requireSiteScope: async (a: { mode: string }) => { if (a.mode === 'edit') return { ok: true, user: { id: 'u' } }; throw new Error('guarda caiu') },
    }))
    vi.doMock('@/lib/cms/auth-guards', () => ({ requireSiteAdminScope: async () => ({ ok: true }) }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => mundo.sb }))
    vi.doMock('@/lib/youtube/observatorio/proprio/edicao', () => ({ provarEdicaoComAviso: async () => ({ token: null, avisou: false }), edicaoValida: () => false }))
    const { abrirListaDaTela } = await import('@/app/cms/(authed)/youtube/competitors/_sugestoes/dados-da-tela')
    const r = await abrirListaDaTela(new Date(), 100)
    if (r.estado !== 'ok') throw new Error('tela não abriu')
    expect(r.lista.itens.length).toBeGreaterThan(0)
    for (const i of r.lista.itens) expect(i.trafego_do_terceiro).toMatchObject({ estado: 'nao_medido', motivo: 'nao_conferido' })
  })
})
