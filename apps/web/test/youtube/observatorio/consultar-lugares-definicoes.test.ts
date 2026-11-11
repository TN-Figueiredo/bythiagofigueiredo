// @vitest-environment node
/**
 * A4 R4 (conserto Yannis I-1): o fio de `_consultar/dados.ts` sem dublê do próprio arquivo: estado, chave do cache (`computado_em`), guarda da sessão e
 * caminho da chave. Dobrados só os vizinhos (banco, leitor de estado, leitor de mapa, guarda, site).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  lerEstado: vi.fn(),
  lerMapa: vi.fn(),
  guarda: vi.fn(),
  site: vi.fn(),
  db: { fake: 'db' },
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => m.db }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: m.site }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: m.guarda }))
vi.mock('@/lib/youtube/observatorio/sinais/leitura', async (orig) => ({ ...(await orig<object>()), lerEstadoDaAba: m.lerEstado }))
vi.mock('@/lib/youtube/observatorio/lugar/leitura', async (orig) => ({ ...(await orig<object>()), lerMapaDeLugares: m.lerMapa }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/abridor', () => ({
  ABRIDOR_DE_SESSAO: { sessao: true },
}))

import { lugaresParaDefinicoes } from '@/app/cms/(authed)/youtube/competitors/_consultar/dados'
import { ABRIDOR_DE_SESSAO, type Abridor } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'

const AGORA = Date.parse('2026-11-11T12:00:00Z')
const MAPA = {
  ids: ['a', 'b', 'c'], slugs: ['pais:VN'], chavesPorVideo: [[0], [0], [0]], versoes: 1, lidoEm: 1,
}
const fresco = { calculado: true, velho: false, computado_em: 'A' }
const ENV = { ...process.env }
const abridorDaChave = (siteId: string): Abridor => ({ doSite: (ler: (s: string) => Promise<unknown>) => ler(siteId) } as unknown as Abridor)

beforeEach(() => {
  for (const f of [m.lerEstado, m.lerMapa, m.guarda, m.site]) f.mockReset()
  m.site.mockResolvedValue({ siteId: 'S' })
  m.guarda.mockResolvedValue({ ok: true })
  m.lerMapa.mockResolvedValue(MAPA)
  process.env.OBS_SINAIS_NICHO = 'on'
})
afterEach(() => { process.env = { ...ENV } })

describe('lugaresParaDefinicoes', () => {
  it('cálculo fresco: ok, e o mapa é lido com o computado_em do estado (a chave do cache muda com o cálculo)', async () => {
    m.lerEstado.mockResolvedValue(fresco)
    const r = await lugaresParaDefinicoes(AGORA, ABRIDOR_DE_SESSAO)
    expect(m.lerMapa).toHaveBeenCalledWith(m.db, 'S', 'A')
    expect(r).toEqual({ estado: 'ok', lugares: [{ slug: 'pais:VN', n: 3 }], totalDeVideos: 3, computadoEm: 'A', atrasado: false })
  })
  it('cálculo atrasado: ok com atrasado verdadeiro e a data do cálculo (Phil I-1)', async () => {
    m.lerEstado.mockResolvedValue({ calculado: true, velho: true, computado_em: '2026-11-05T10:00:00Z' })
    const r = await lugaresParaDefinicoes(AGORA, ABRIDOR_DE_SESSAO)
    expect(r).toMatchObject({ estado: 'ok', atrasado: true, computadoEm: '2026-11-05T10:00:00Z' })
    expect(m.lerMapa).toHaveBeenCalledWith(m.db, 'S', '2026-11-05T10:00:00Z')
  })
  it('leitura do estado nula: falhou, e o mapa nem é lido (nunca vira "sem cálculo")', async () => {
    m.lerEstado.mockResolvedValue(null)
    expect(await lugaresParaDefinicoes(AGORA, ABRIDOR_DE_SESSAO)).toEqual({ estado: 'falhou' })
    expect(m.lerMapa).not.toHaveBeenCalled()
  })
  it('sem cálculo e tarefa ligada: nunca', async () => {
    m.lerEstado.mockResolvedValue({ calculado: false, velho: false, computado_em: null })
    expect(await lugaresParaDefinicoes(AGORA, ABRIDOR_DE_SESSAO)).toEqual({ estado: 'nunca' })
    expect(m.lerMapa).not.toHaveBeenCalled()
  })
  it('sem cálculo e OBS_SINAIS_NICHO apagada: desligado (padrão sem a variável)', async () => {
    delete process.env.OBS_SINAIS_NICHO
    m.lerEstado.mockResolvedValue({ calculado: false, velho: false, computado_em: null })
    expect(await lugaresParaDefinicoes(AGORA, ABRIDOR_DE_SESSAO)).toEqual({ estado: 'desligado' })
    expect(m.lerMapa).not.toHaveBeenCalled()
  })
  it('caminho da chave: lê com o site da prova, sem passar pela guarda da sessão', async () => {
    m.lerEstado.mockResolvedValue(fresco)
    const r = await lugaresParaDefinicoes(AGORA, abridorDaChave('S-chave'))
    expect(r.estado).toBe('ok')
    expect(m.lerMapa).toHaveBeenCalledWith(m.db, 'S-chave', 'A')
    expect(m.lerEstado).toHaveBeenCalledWith(m.db, 'S-chave', new Date(AGORA))
    expect(m.guarda).not.toHaveBeenCalled()
    expect(m.site).not.toHaveBeenCalled()
  })
  it('abridor que não é o da sessão e não tem doSite: falhou', async () => {
    expect(await lugaresParaDefinicoes(AGORA, {} as Abridor)).toEqual({ estado: 'falhou' })
    expect(m.lerEstado).not.toHaveBeenCalled()
  })
  it('guarda da sessão negada: falhou, nada é lido', async () => {
    m.guarda.mockResolvedValue({ ok: false })
    expect(await lugaresParaDefinicoes(AGORA, ABRIDOR_DE_SESSAO)).toEqual({ estado: 'falhou' })
    expect(m.guarda).toHaveBeenCalledWith({ area: 'cms', siteId: 'S', mode: 'view' })
    expect(m.lerEstado).not.toHaveBeenCalled()
    expect(m.lerMapa).not.toHaveBeenCalled()
  })
  it('o leitor do mapa rejeitar: falhou', async () => {
    m.lerEstado.mockResolvedValue(fresco)
    m.lerMapa.mockRejectedValue(new Error('boom'))
    expect(await lugaresParaDefinicoes(AGORA, ABRIDOR_DE_SESSAO)).toEqual({ estado: 'falhou' })
  })
})
