// @vitest-environment node
// O abridor sem sessão (E17 degrau 2, Tarefa 8a): o caminho por chave chama os carregadores com o site da prova, sem tocar sessão, cookie nem redirect.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canalWorld } from './canal-fixture'
import type { Dataset } from '@/lib/youtube/observatorio/types'
import type { ObservatoryRows } from '@/lib/youtube/observatorio/load'

const SITE = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const OUTRO = '4a2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a11'
const PESSOA = '9a1b2c3d-0000-4000-8000-00000000aaaa'
const CHAVE = '7c1d2e3f-0000-4000-8000-00000000bbbb'

const m = vi.hoisted(() => {
  const lancar = (nome: string) => () => { throw new Error(`${nome} não pode ser chamado por chave`) }
  return {
    getSiteContext: vi.fn(async () => { throw new Error('getSiteContext não pode ser chamado por chave') }),
    requireSiteScope: vi.fn(async () => { throw new Error('requireSiteScope não pode ser chamado por chave') }),
    cookies: vi.fn(async () => { throw new Error('cookies não pode ser chamado por chave') }),
    redirect: vi.fn((url: string) => { throw new Error(`redirect ${url} não pode ser chamado por chave`) }),
    loadPageRows: vi.fn(),
    loadChannelDataset: vi.fn(),
    loadOwnMenuRows: vi.fn(),
    from: vi.fn(),
    lancar,
  }
})
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: m.cookies }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: m.getSiteContext }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: m.requireSiteScope }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/load-page', () => ({ loadPageRows: m.loadPageRows, loadChannelDataset: m.loadChannelDataset }))
vi.mock('@/lib/youtube/observatorio/own-menu', () => ({ loadOwnMenuRows: m.loadOwnMenuRows }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: m.from, rpc: async () => ({ data: null, error: null }) }) }))

import { fabricarProva } from '@/lib/youtube/observatorio/acesso-ia/prova'
import { abridorDaChave } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/abrir-por-chave'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { openObservatoryPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { AcessoPrivado } from '@/lib/youtube/observatorio/proprio/leitura-privada'

const prova = () => fabricarProva(SITE, PESSOA, CHAVE, '2999-01-01T00:00:00Z')
const SEM: AcessoPrivado = { leitura: null, edita: false, negativa: 'sem_direito' }

const LINHAS_VAZIAS: ObservatoryRows = {
  settings: null, channels: [], ownChannels: [], videos: [], ownVideos: [], versions: [], legacyChanges: [], daily: [], snapshots: [], readings: [], tasks: [], heartbeat: null,
}

function umCanal(): Dataset {
  const { ds, chId } = canalWorld()
  return { ...ds, scope: 'canal', channels: ds.channels.filter((c) => c.id === chId), videos: ds.videos.filter((v) => v.ch === chId) }
}

beforeEach(() => {
  for (const f of [m.getSiteContext, m.requireSiteScope, m.cookies, m.redirect, m.loadPageRows, m.loadChannelDataset, m.loadOwnMenuRows, m.from]) f.mockClear()
  m.loadPageRows.mockImplementation(async () => LINHAS_VAZIAS)
  m.loadChannelDataset.mockImplementation(async () => umCanal())
  m.loadOwnMenuRows.mockImplementation(async () => [])
  m.from.mockImplementation(() => { throw new Error('o banco de preferência não pode ser consultado por chave') })
})

describe('abridorDaChave', () => {
  it('com getSiteContext, requireSiteScope, cookies e redirect simulados para LANÇAR, observatorio() e canal(id) respondem', async () => {
    const a = abridorDaChave(prova(), SEM)
    const pagina = await a.observatorio()
    expect(pagina.siteId).toBe(SITE)
    const { chId } = canalWorld()
    const canal = await a.canal(chId)
    expect(canal.siteId).toBe(SITE)
    for (const f of [m.getSiteContext, m.requireSiteScope, m.cookies, m.redirect]) expect(f).not.toHaveBeenCalled()
  })
  it('o conjunto é lido com o site da prova', async () => {
    const a = abridorDaChave(prova(), SEM)
    await a.observatorio()
    expect(m.loadPageRows).toHaveBeenCalledWith(SITE, expect.any(Number))
    await a.canal('qualquer')
    expect(m.loadChannelDataset).toHaveBeenCalledWith(SITE, 'qualquer', expect.any(Number))
    expect(m.loadOwnMenuRows).toHaveBeenCalledWith(SITE)
  })
  it('id de canal de outro site: obs nulo, nada lançado (o comportamento de openChannelPage, preservado)', async () => {
    m.loadChannelDataset.mockImplementation(async () => null)
    const canal = await abridorDaChave(prova(), SEM).canal('de-outro-site')
    expect(canal.obs).toBeNull()
    expect(canal.ownYtIds).toEqual([])
  })
  it('a preferência de nicho não é consultada: zero chamadas a competitor_user_prefs, savedNiche todos, meuCanalLembrado nulo', async () => {
    const p = await abridorDaChave(prova(), SEM).observatorio()
    expect(m.from).not.toHaveBeenCalled()
    expect(p.savedNiche).toBe('todos')
    expect(p.meuCanalLembrado).toBeNull()
  })
  it('o extra roda com o site da prova', async () => {
    const extra = vi.fn(async (s: string) => `extra:${s}`)
    const p = await abridorDaChave(prova(), SEM).observatorio(extra)
    expect(extra).toHaveBeenCalledWith(SITE)
    expect(p.extra).toBe(`extra:${SITE}`)
  })
  it('canEdit false sempre, mesmo quando a pessoa da chave edita pelo acesso recebido', async () => {
    const editor = { leitura: null, edita: true, negativa: null } satisfies AcessoPrivado
    const a = abridorDaChave(prova(), editor)
    expect((await a.canal('x')).canEdit).toBe(false)
    expect((await a.acessoPrivado(SITE)).edita).toBe(false)
  })
  it('acessoPrivado com outro siteId: sem leitura; com o da prova: o acesso recebido', async () => {
    const a = abridorDaChave(prova(), SEM)
    expect(await a.acessoPrivado(OUTRO)).toEqual({ leitura: null, edita: false, negativa: 'sem_direito' })
    expect(await a.acessoPrivado(SITE)).toEqual(SEM)
  })
  it('objeto literal no lugar da prova: lança antes de ler', () => {
    const falsa = { siteId: SITE, userId: PESSOA, keyId: CHAVE, venceEm: 'x' } as unknown as Parameters<typeof abridorDaChave>[0]
    expect(() => abridorDaChave(falsa, SEM)).toThrow(TypeError)
    expect(m.loadPageRows).not.toHaveBeenCalled()
  })
})

describe('ABRIDOR_DE_SESSAO', () => {
  it('observatorio é openObservatoryPage e canal é openChannelPage (mesma função), e a página por sessão ainda passa pela guarda', async () => {
    expect(ABRIDOR_DE_SESSAO.observatorio).toBe(openObservatoryPage)
    m.getSiteContext.mockResolvedValueOnce({ siteId: SITE } as never)
    m.requireSiteScope.mockResolvedValueOnce({ ok: false, reason: 'unauthenticated' } as never)
    await expect(ABRIDOR_DE_SESSAO.observatorio()).rejects.toThrow('redirect /cms/login')
    expect(m.requireSiteScope).toHaveBeenCalledTimes(1)
    expect(m.loadPageRows).not.toHaveBeenCalled()
  })
})
