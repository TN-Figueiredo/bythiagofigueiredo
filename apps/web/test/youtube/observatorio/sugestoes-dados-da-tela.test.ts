// @vitest-environment node
/** F3 T6: `abrirListaDaTela` e `contarParaAAbaSugestoes` (`_sugestoes/dados-da-tela.ts`). */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface Opcoes { edit?: boolean; admin?: boolean; lista?: unknown; listaLanca?: boolean; amostraLanca?: boolean; contar?: number | null | 'lanca'; estado?: { calculado: boolean; velho: boolean; computado_em: string | null } | null | 'lanca' }
const AGORA = new Date('2026-10-23T12:00:00Z')

const item = (id: string, kind: 'destino' | 'parecido', outs: Array<{ video_id: string; mult_vpd7: number }>, proprios_agora: string[] | null) =>
  ({ id, kind, evidence: { outliers: outs, proprios: [] }, proprios_agora })

async function montar(o: Opcoes = {}) {
  const r = { ordem: [] as string[], amostraIds: [] as string[][], listaArgs: [] as unknown[][], contarArgs: [] as unknown[][], estadoArgs: [] as unknown[][], sentry: [] as unknown[][] }
  vi.resetModules()
  vi.doMock('server-only', () => ({}))
  vi.doMock('@sentry/nextjs', () => ({ captureMessage: (...a: unknown[]) => { r.sentry.push(a) }, captureException: (...a: unknown[]) => { r.sentry.push(a) } }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-ctx' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => { r.ordem.push('edit'); return o.edit === false ? { ok: false } : { ok: true, user: { id: 'u1' } } } }))
  vi.doMock('@/lib/cms/auth-guards', () => ({ requireSiteAdminScope: async () => { r.ordem.push('admin'); return { ok: o.admin !== false } } }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { r.ordem.push('service'); return { marca: 'sb' } } }))
  vi.doMock('@/lib/youtube/observatorio/sinais/leitura', () => ({
    listarSinaisDoNicho: async (...a: unknown[]) => { r.listaArgs.push(a); if (o.listaLanca) throw new Error('boom'); return o.lista },
    calculoLigadoNoAmbiente: () => true,
    contarSinaisAbertos: async (...a: unknown[]) => { r.contarArgs.push(a); if (o.contar === 'lanca') throw new Error('boom'); return o.contar === undefined ? 3 : o.contar },
    lerEstadoDaAba: async (...a: unknown[]) => { r.estadoArgs.push(a); if (o.estado === 'lanca') throw new Error('boom'); return o.estado === undefined ? { calculado: true, velho: false, computado_em: '2026-10-23T08:00:00Z' } : o.estado },
  }))
  vi.doMock('@/lib/youtube/observatorio/proprio/leitura-privada', () => ({ acessoDoEditor: async () => { r.ordem.push('leitura'); return { marca: 'leitura' } } }))
  vi.doMock('@/lib/youtube/observatorio/sinais/amostra', () => ({
    lerAmostraDasLinhas: async (_sb: unknown, _s: string, ids: string[]) => { r.amostraIds.push(ids); if (o.amostraLanca) throw new Error('boom'); return new Map() },
  }))
  return { r, ...(await import('@/app/cms/(authed)/youtube/competitors/_sugestoes/dados-da-tela')) }
}

beforeEach(() => { vi.restoreAllMocks() })

describe('abrirListaDaTela', () => {
  it('sem acesso de edição: sem_acesso, sem cliente de serviço', async () => {
    const { r, abrirListaDaTela } = await montar({ edit: false })
    expect(await abrirListaDaTela(AGORA, 100)).toEqual({ estado: 'sem_acesso' })
    expect(r.ordem).not.toContain('service')
  })
  it('editor sem admin: podeResponder = false (mesmo predicado da ação)', async () => {
    const { abrirListaDaTela } = await montar({ admin: false, lista: { n: 0, itens: [] } })
    const res = await abrirListaDaTela(AGORA, 100)
    expect(res).toMatchObject({ estado: 'ok', podeResponder: false })
  })
  it('admin: podeResponder = true; a lista vem do site da guarda, com a hora e o limite recebidos', async () => {
    const { r, abrirListaDaTela } = await montar({ lista: { n: 0, itens: [] } })
    expect(await abrirListaDaTela(AGORA, 100)).toMatchObject({ estado: 'ok', podeResponder: true })
    expect(r.listaArgs[0]!.slice(1)).toEqual(['site-ctx', AGORA, 100, true, { marca: 'leitura' }])
  })
  it('amostra: outlier mais forte de cada linha + até 3 próprios por linha (F4 T9: os vídeos da seção "Pedir títulos", também no destino)', async () => {
    const lista = { n: 3, itens: [
      item('a', 'destino', [{ video_id: 'c1', mult_vpd7: 3 }, { video_id: 'c2', mult_vpd7: 9 }], ['p-nao']),
      item('b', 'parecido', [{ video_id: 'c3', mult_vpd7: 4 }], ['p1', 'p2', 'p3', 'p4']),
      item('c', 'parecido', [], null),
    ] }
    const { r, abrirListaDaTela } = await montar({ lista })
    const res = await abrirListaDaTela(AGORA, 100)
    expect(res.estado).toBe('ok')
    expect(r.amostraIds[0]!.sort()).toEqual(['c2', 'c3', 'p-nao', 'p1', 'p2', 'p3'])
  })
  it('limite menor (bloco): só as linhas dentro do limite entram na amostra', async () => {
    const lista = { n: 4, itens: [1, 2, 3, 4].map((i) => item('i' + i, 'destino', [{ video_id: 'v' + i, mult_vpd7: 5 }], null)) }
    const { r, abrirListaDaTela } = await montar({ lista })
    await abrirListaDaTela(AGORA, 3)
    expect(r.amostraIds[0]!.sort()).toEqual(['v1', 'v2', 'v3'])
  })
  it('erro na leitura da lista: { estado: "erro" } sem lançar, e Sentry', async () => {
    const { r, abrirListaDaTela } = await montar({ listaLanca: true })
    expect(await abrirListaDaTela(AGORA, 100)).toEqual({ estado: 'erro' })
    expect(r.sentry.length).toBeGreaterThan(0)
  })
  it('erro na amostra: { estado: "erro" } sem lançar', async () => {
    const { abrirListaDaTela } = await montar({ amostraLanca: true, lista: { n: 1, itens: [item('a', 'destino', [{ video_id: 'c1', mult_vpd7: 3 }], null)] } })
    expect(await abrirListaDaTela(AGORA, 100)).toEqual({ estado: 'erro' })
  })
})

describe('contarParaAAbaSugestoes', () => {
  it('o relógio é observatoryNow() (paridade com a página sob OBS_NOW_OVERRIDE)', async () => {
    vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('OBS_E2E', '1'); vi.stubEnv('OBS_NOW_OVERRIDE', '2026-10-01T10:00:00Z')
    try {
      const { r, contarParaAAbaSugestoes } = await montar({ contar: 2 })
      await contarParaAAbaSugestoes()
      expect(r.contarArgs[0]![2]).toEqual(new Date('2026-10-01T10:00:00Z'))
      expect(r.estadoArgs[0]![2]).toEqual(new Date('2026-10-01T10:00:00Z'))
    } finally { vi.unstubAllEnvs() }
  })
  it('sem edição: visivel false, sem serviço', async () => {
    const { r, contarParaAAbaSugestoes } = await montar({ edit: false })
    expect(await contarParaAAbaSugestoes()).toEqual({ visivel: false })
    expect(r.ordem).not.toContain('service')
  })
  it('calculado e novo: n, velho false, calculado true', async () => {
    const { contarParaAAbaSugestoes } = await montar({ contar: 3 })
    expect(await contarParaAAbaSugestoes()).toEqual({ visivel: true, n: 3, velho: false, calculado: true })
  })
  it('velho propaga', async () => {
    const { contarParaAAbaSugestoes } = await montar({ estado: { calculado: true, velho: true, computado_em: 'x' } })
    expect(await contarParaAAbaSugestoes()).toMatchObject({ velho: true, calculado: true })
  })
  it('nunca calculado: calculado false (a aba mostra "—", nunca 0)', async () => {
    const { contarParaAAbaSugestoes } = await montar({ contar: 0, estado: { calculado: false, velho: false, computado_em: null } })
    expect(await contarParaAAbaSugestoes()).toMatchObject({ visivel: true, calculado: false })
  })
  it('count nulo: n nulo ("?")', async () => {
    const { contarParaAAbaSugestoes } = await montar({ contar: null })
    expect(await contarParaAAbaSugestoes()).toMatchObject({ visivel: true, n: null })
  })
  it('exceção na contagem: n nulo, não lança, Sentry', async () => {
    const { r, contarParaAAbaSugestoes } = await montar({ contar: 'lanca' })
    expect(await contarParaAAbaSugestoes()).toMatchObject({ visivel: true, n: null })
    expect(r.sentry.length).toBeGreaterThan(0)
  })
  it('estado da aba ilegível (null ou exceção): n nulo, nunca 0 nem "—"', async () => {
    for (const estado of [null, 'lanca' as const]) {
      const { contarParaAAbaSugestoes } = await montar({ estado })
      expect(await contarParaAAbaSugestoes()).toMatchObject({ visivel: true, n: null, calculado: true })
    }
  })
})
