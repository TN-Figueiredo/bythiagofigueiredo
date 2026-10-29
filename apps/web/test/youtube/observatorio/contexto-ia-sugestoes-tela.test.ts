// @vitest-environment node
/**
 * F2 T8: a tela `sugestoes` pela ação `gerarPacoteIa` DE VERDADE (EMPACOTAR e o empacotador reais), no padrão de `contexto-ia-acao` e
 * `contexto-ia-direito`: guarda, pedido, registro, ausência de dado privado e de texto de terceiros. Só o banco (`abrirSugestoes`), a guarda,
 * o registro e o Sentry são simulados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ListaDeSinais, ItemDeSinal } from '@/lib/youtube/observatorio/sinais/leitura'

const SITE = '00000000-0000-4000-8000-0000000000aa'
const USUARIO = '00000000-0000-4000-8000-0000000000cc'
const st = vi.hoisted(() => ({ lista: null as unknown, abrirChamadas: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: SITE }) }))
const guarda = vi.hoisted(() => vi.fn())
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: guarda }))
const registro = vi.hoisted(() => vi.fn())
vi.mock('@/lib/youtube/observatorio/contexto-ia/registrar-acesso', () => ({ registrarAcesso: registro }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/dados', () => ({ abrirSugestoes: async () => { st.abrirChamadas++; return st.lista } }))
const modo = vi.hoisted(() => ({ ligado: true }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/regras', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/contexto-ia/regras')>()
  return { ...m, CONTEXTO_IA_RULES: new Proxy(m.CONTEXTO_IA_RULES, { get: (t, k) => (k === 'ligado' ? modo.ligado : Reflect.get(t, k)) }) }
})
import { gerarPacoteIa } from '@/app/cms/(authed)/youtube/competitors/contexto-ia-actions'

const agoraIso = new Date().toISOString()
const item = (i: number): ItemDeSinal => ({
  id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`, kind: 'destino', subject_key: `pais:P${i}`, acao: 'titulo_descricao', rotulo_acao: 'abrir-seus', n_proprios: 2,
  acao_gravada: 'video_novo', forca: 20 - i, motivo: 'dois canais estouraram', rule_version: 'sinais-v1', first_seen_at: agoraIso, expires_at: agoraIso,
  proprios_agora: ['bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002'], proprios_agora_n: 2,
  trafego_do_terceiro: { estado: 'nao', motivo: null, terceiro_video_id: 'cccccccc-0000-4000-8000-000000000001', videos_com_trafego: 0, videos_medidos: 2, videos_total: 2, views: null, ate: '2026-10-27', regra: 'f4-trafego-v1' },
  evidence: { outliers: [{ video_id: 'cccccccc-0000-4000-8000-000000000001', canal_id: 'dddddddd-0000-4000-8000-000000000001', published_at: agoraIso, mult_vpd7: 6, mult_tela: 3, vpd7: 900, formato: 'long' }], outliers_total: 2, canais: 2, proprios: [] },
})
const lista = (n: number): ListaDeSinais => ({ n, itens: Array.from({ length: n }, (_, i) => item(i + 1)), computado_em: agoraIso, desatualizado: false, motivoVazio: null, contagens: { canais_total: 5 }, calculoLigado: true })

beforeEach(() => {
  modo.ligado = true; st.lista = lista(3); st.abrirChamadas = 0
  guarda.mockResolvedValue({ ok: true, user: { id: USUARIO } })
  registro.mockResolvedValue({ ok: true })
})
afterEach(() => { vi.clearAllMocks() })

const pedir = (extra: Record<string, unknown> = {}) => gerarPacoteIa({ tela: 'sugestoes', consulta: '', ...extra } as never)

describe('sugestoes: a guarda e o pedido', () => {
  it('sem sessão: sem_acesso, nada é lido nem registrado', async () => {
    guarda.mockResolvedValue({ ok: false })
    expect(await pedir()).toEqual({ ok: false, motivo: 'sem_acesso' })
    expect(st.abrirChamadas).toBe(0)
    expect(registro).not.toHaveBeenCalled()
  })
  it('a guarda do pedido é a de visualização do site do contexto', async () => {
    await pedir()
    expect(guarda).toHaveBeenCalledWith({ area: 'cms', siteId: SITE, mode: 'view' })
  })
  it('a leitura devolve null (sem direito de edição): nao_encontrado e nenhuma linha gravada', async () => {
    st.lista = null
    expect(await pedir()).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(registro).not.toHaveBeenCalled()
  })
  it('um id e um siteId no pedido são ignorados: a leitura não recebe parâmetro de site', async () => {
    const r = await pedir({ id: '00000000-0000-4000-8000-000000000123', siteId: '00000000-0000-4000-8000-0000000000bb' })
    expect(r.ok).toBe(true)
    expect(guarda).toHaveBeenCalledWith({ area: 'cms', siteId: SITE, mode: 'view' })
  })
})

describe('sugestoes: o registro e o direito', () => {
  it('uma linha gravada: tela sugestoes, sem privado (na), zero medidos privados, sem comentários', async () => {
    const r = await pedir()
    expect(r.ok).toBe(true)
    expect(registro).toHaveBeenCalledTimes(1)
    const l = registro.mock.calls[0]![0]
    expect(l).toMatchObject({ siteId: SITE, userId: USUARIO, tela: 'sugestoes', incluiuPrivado: false })
    expect(l.params).toMatchObject({ tela: 'sugestoes', privado: 'na', privado_medidos: 0, comentarios: 'na' })
  })
  it('lista vazia: ainda registra e o pacote diz o motivo (nunca sai mudo)', async () => {
    st.lista = { n: 0, itens: [], computado_em: null, desatualizado: true, motivoVazio: 'nunca-calculado', contagens: {}, calculoLigado: false }
    const r = await pedir()
    expect(r.ok).toBe(true)
    expect(registro).toHaveBeenCalledTimes(1)
    if (r.ok) expect(JSON.stringify(r.pacote)).toMatch(/ainda não foi ligado/)
  })
  it('o pacote não leva título, miniatura, endereço, e-mail nem moeda', async () => {
    const r = await pedir()
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const t = JSON.stringify(r.pacote)
    expect(t).not.toMatch(/https?:\/\//)
    expect(t).not.toMatch(/ytimg|mqdefault/)
    expect(t).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
    expect(t).not.toMatch(/R\$|US\$|\b(revenue|rpm|cpm|adsense|receita)\b/i)
    expect(t).not.toContain(SITE)
    expect(t).not.toContain(USUARIO)
  })
  it('com o interruptor desligado: pedido_invalido e a leitura nem roda', async () => {
    modo.ligado = false
    expect(await pedir()).toMatchObject({ ok: false, motivo: 'pedido_invalido' })
    expect(st.abrirChamadas).toBe(0)
  })
})

describe('sugestoes: cache', () => {
  it('os arquivos novos não usam cache de dados', () => {
    const base = resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
    const arquivos = [join(base, '_contexto-ia/sugestoes.ts'), ...readdirSync(join(base, '_sugestoes')).map((f) => join(base, '_sugestoes', f)), resolve(__dirname, '../../../src/lib/youtube/observatorio/sinais/leitura.ts')]
    for (const f of arquivos) expect(readFileSync(f, 'utf8'), f).not.toMatch(/unstable_cache|cache-tag/)
  })
})
