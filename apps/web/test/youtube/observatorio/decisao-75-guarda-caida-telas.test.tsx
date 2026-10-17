// @vitest-environment jsdom
// Decisão 75 (Phil R2-1): a guarda de permissão CAÍDA (`nao_foi_possivel_conferir`) nunca vira cadeado em tela nenhuma. Aqui roda o caminho de verdade de
// cada tela (lista de Canais, canal, vídeo, Histórico do vídeo e Comparar): a guarda de edição e a de leitura lançam, o `acessoPrivado` real devolve
// `nao_foi_possivel_conferir`, os montadores e os modelos rodam, e a varredura do modelo montado não acha estado "restrito" em lugar nenhum.
// O contraste: com `sem_direito` o MESMO caminho mostra restrito, para provar que a varredura enxerga o estado.
// Escopo desta task (4): o estado nos modelos. A pastilha `falhou` + "Tentar de novo" no DOM de cada tela entra com as Tasks 6, 7 e 8b.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { proprioWorld, umCanal } from './proprio-fixture'
import type { ChannelPage, ObservatoryPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'

const requireSiteScope = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => fakeSupabase({ yt_reporting_reports: [] as Row[], yt_own_video_reach_daily: [] as Row[], yt_own_video_daily: [] as Row[] }).client }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => false }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-site', () => ({ carregarMedidasDoSite: async () => null }))
const pagina = vi.hoisted(() => ({ canal: null as unknown, site: null as unknown }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openChannelPage: async () => pagina.canal,
  openObservatoryPage: async () => pagina.site,
}))

import { PastilhaAusencia } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/pastilhas'
import { ROTULO_AUSENCIA, type EstadoAusencia } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/estado'
import { acessoPrivado } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import { montarCanal, origemDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/montar'
import { montarCanais } from '@/app/cms/(authed)/youtube/competitors/_canais/montar'
import { montarVideo, origemDoVideo } from '@/app/cms/(authed)/youtube/competitors/_historico/montar'
import { montarComparar } from '@/app/cms/(authed)/youtube/competitors/_comparar/montar'

const SITE = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a77'
const w = proprioWorld()
const wUm = proprioWorld({ mut: umCanal })
const OWNS: OwnMenu = { itens: [{ id: w.canalId, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' }
const GUARDA_CAIDA = () => requireSiteScope.mockRejectedValue(new Error('guarda caiu'))
const SEM_DIREITO = () => requireSiteScope.mockResolvedValue({ ok: false, reason: 'insufficient_access' })

/** Todo valor da árvore cujo nome termina em "ausencia"/"Estado" e vale 'restrito', e todo que vale 'falhou'. */
function estadosDe(v: unknown): { restrito: number; falhou: number } {
  const n = { restrito: 0, falhou: 0 }
  const anda = (x: unknown): void => {
    if (Array.isArray(x)) { x.forEach(anda); return }
    if (x instanceof Map) { for (const y of x.values()) anda(y); return }
    if (x === null || typeof x !== 'object') return
    for (const [k, y] of Object.entries(x)) {
      if (/(ausencia|Estado|estado)$/i.test(k) && (y === 'restrito' || y === 'falhou')) n[y]++
      else anda(y)
    }
  }
  anda(v)
  return n
}

beforeEach(() => {
  requireSiteScope.mockReset()
  pagina.canal = null; pagina.site = null
})

async function abrir(): Promise<{ canal: ChannelPage; site: ObservatoryPage<undefined> }> {
  const acesso = await acessoPrivado(SITE)
  const canal: ChannelPage = {
    siteId: SITE, now: wUm.obs.NOW, obs: wUm.obs, canEdit: acesso.edita, leitura: acesso.leitura, negativa: acesso.negativa,
    ownYtIds: wUm.ytIds, meuCanalLembrado: null, owns: OWNS,
  }
  const site = { siteId: SITE, now: w.obs.NOW, rows: {} as ObservatoryPage<undefined>['rows'], obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined, canAdmin: false } as unknown as ObservatoryPage<undefined>
  pagina.canal = canal; pagina.site = site
  return { canal, site }
}

/** A pastilha de cada estado achado: a de restrito nunca existe no DOM da guarda caída. */
function pastilhasNoDom(estados: EstadoAusencia[]): HTMLElement {
  const { container } = render(<div>{estados.map((e, i) => <PastilhaAusencia key={i} estado={e} motivo="m" />)}</div>)
  return container
}

describe('guarda caída: nenhuma tela vira cadeado', () => {
  it('canal próprio: o cabeçalho, os vídeos, o "como está" e o privado do pacote não têm restrito; têm falhou', async () => {
    GUARDA_CAIDA()
    await abrir()
    const m = await montarCanal(wUm.canalId, {})
    if (m.tipo !== 'proprio') throw new Error('esperava o canal próprio')
    const e = estadosDe([m.pv, m.comoEsta])
    expect(e.restrito).toBe(0)
    expect(e.falhou).toBeGreaterThan(0)
    expect(m.privado.negativa).toBe('nao_foi_possivel_conferir')
  })
  it('canal próprio com sem_direito: o MESMO caminho mostra restrito (a varredura enxerga o estado)', async () => {
    SEM_DIREITO()
    await abrir()
    const m = await montarCanal(wUm.canalId, {})
    if (m.tipo !== 'proprio') throw new Error('esperava o canal próprio')
    expect(estadosDe([m.pv, m.comoEsta]).restrito).toBeGreaterThan(0)
  })
  it('lista de Canais: o views por dia dos canais próprios sai leitura-falhou, nunca sem-acesso', async () => {
    GUARDA_CAIDA()
    await abrir()
    const r = await montarCanais({})
    expect(JSON.stringify(r.view)).not.toContain('"sem-acesso"')
    expect(Object.values(r.privado.acessoPorCanal).every(a => a.diario === 'erro')).toBe(true)
    expect(estadosDe(r.view).restrito).toBe(0)
  })
  it('vídeo próprio (Histórico do vídeo): os blocos e a nota não têm restrito; têm falhou', async () => {
    GUARDA_CAIDA()
    await abrir()
    const video = w.obs.videos.find(v => v.ch === w.canalId)!
    const m = await montarVideo(video.id, {}, async () => pagina.site as ObservatoryPage<undefined>, { trocas: true })
    if (m.tipo !== 'proprio') throw new Error('esperava o vídeo próprio')
    const e = estadosDe([m.blocos, m.base, m.trocas])
    expect(e.restrito).toBe(0)
    expect(e.falhou).toBeGreaterThan(0)
    expect(m.privado.negativa).toBe('nao_foi_possivel_conferir')
  })
  it('Comparar: o cartão "Só o seu canal mede" e o pack não têm restrito', async () => {
    GUARDA_CAIDA()
    await abrir()
    const r = await montarComparar({})
    expect(estadosDe(r.pack).restrito).toBe(0)
    expect(JSON.stringify(r.pack)).not.toContain('"acesso":"negado"')
  })
  it('no DOM: as pastilhas dos estados achados (falhou) não trazem .obs-au-restrito', async () => {
    GUARDA_CAIDA()
    await abrir()
    const m = await montarCanal(wUm.canalId, {})
    if (m.tipo !== 'proprio') throw new Error('esperava o canal próprio')
    const achados: EstadoAusencia[] = []
    for (const c of [...m.pv.header.faixa, ...m.pv.header.todos]) if (c.ausencia) achados.push(c.ausencia)
    expect(achados.length).toBeGreaterThan(0)
    const dom = pastilhasNoDom(achados)
    expect(dom.querySelectorAll('.obs-au-restrito')).toHaveLength(0)
    expect(dom.textContent).not.toContain(ROTULO_AUSENCIA.restrito)
  })
})

describe('guarda caída: a Origem (canal e vídeo) e as Trocas também não viram "você não vê"', () => {
  it('Origem do canal: guarda caída = bloco de erro (nunca so-aviso/semAcesso); sem_direito = só o aviso', async () => {
    GUARDA_CAIDA()
    await abrir()
    const m = await montarCanal(wUm.canalId, {})
    if (m.tipo !== 'proprio') throw new Error('esperava o canal próprio')
    const o = await origemDoCanal(m.origemProps)
    expect(o.nivel).not.toBe('so-aviso')
    expect(o.semAcesso).toBeNull()
    expect(JSON.stringify(o)).toContain('"erro"')
    SEM_DIREITO()
    await abrir()
    const m2 = await montarCanal(wUm.canalId, {})
    if (m2.tipo !== 'proprio') throw new Error('esperava o canal próprio')
    const o2 = await origemDoCanal(m2.origemProps)
    expect(o2.nivel).toBe('so-aviso')
    expect(o2.semAcesso).not.toBeNull()
  })
  it('Origem do vídeo e Trocas: guarda caída = erro (nunca so-aviso nem "privado"); sem_direito = so-aviso e "privado"', async () => {
    const video = w.obs.videos.find(v => v.ch === w.canalId)!
    GUARDA_CAIDA()
    await abrir()
    const m = await montarVideo(video.id, {}, async () => pagina.site as ObservatoryPage<undefined>, { trocas: true })
    if (m.tipo !== 'proprio') throw new Error('esperava o vídeo próprio')
    const o = await origemDoVideo(m.origemProps)
    expect(o.nivel).not.toBe('so-aviso')
    expect(o.semAcesso).toBeNull()
    expect(m.trocas!.estado).toBe('erro-de-leitura')
    SEM_DIREITO()
    await abrir()
    const m2 = await montarVideo(video.id, {}, async () => pagina.site as ObservatoryPage<undefined>, { trocas: true })
    if (m2.tipo !== 'proprio') throw new Error('esperava o vídeo próprio')
    expect((await origemDoVideo(m2.origemProps)).nivel).toBe('so-aviso')
    expect(m2.trocas!.estado).toBe('privado')
  })
})
