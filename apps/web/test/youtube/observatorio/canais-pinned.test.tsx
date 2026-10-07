// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/canais-pinned.test.tsx — "Vídeos fixados" in the channel drawer's existing Vídeos tab.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen, type CanaisScreenProps } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import type { PinResult } from '@/app/cms/(authed)/youtube/competitors/pin-result'

let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors', useSearchParams: () => new URLSearchParams(search),
}))
const CH = 'luke-damant' // 321 videos, 200 tracked, in the oracle
/** The oracle with `n` pinned videos of CH: the first inside the tracked ones, the rest outside. */
function build(n: number) {
  const ds = datasetFromOracle(loadOracle())
  const mine = ds.videos.filter(v => v.ch === CH && v.fmt === 'long').sort((a, b) => b.pub - a.pub)
  const picks = n ? [mine.find(v => v.tracked)!, ...mine.filter(v => !v.tracked).slice(0, n - 1)] : []
  for (const v of picks) { v.pinned = true; v.pinState = 'ativo' }
  return { obs: createObservatory(ds), picks }
}
const ok = async () => ({ ok: true })
function mount(n: number, props: Partial<CanaisScreenProps> = {}) {
  const { obs, picks } = build(n)
  const view = buildCanaisView(obs, { niche: 'todos', limit: 75, channel: CH, tab: 'videos' })
  const r = render(<ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><div data-obs-chrome="" />
    <CanaisScreen view={view} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} onPin={async () => ({ ok: true })} onUnpin={async () => ({ ok: true })} {...props} />
  </div></ChromeSyncContext.Provider></ToastProvider>)
  return { ...r, obs, picks, view, list: () => r.container.querySelector<HTMLElement>('#fixados')! }
}
beforeEach(() => { search = 'channel=' + CH + '&tab=videos'; window.location.hash = '' })

describe('view model: videos.pinned', () => {
  it('nenhum fixado (o dado não existe): a seção existe, "0 de RULES.pinLimit", com a frase de como fixar', () => {
    const { view, obs } = mount(0)
    const p = view.drawer!.videos.pinned!, ch = obs.channel(CH)!
    expect(p).toMatchObject({ title: 'Vídeos fixados', count: '0 de ' + obs.RULES.pinLimit, rows: [] })
    expect(p.empty).toBe('Nenhum vídeo fixado em ' + ch.name + '. Para fixar, use “Fixar vídeo” no histórico do vídeo ou no cartão dele em Mudanças.')
    expect(p.intro.replace(/\u00a0/g, ' ')).toBe('Um vídeo fixado continua com gráfico de views e conferência a cada 6 h, mesmo fora dos ' + ch.video_limit + ' mais recentes. O limite é de ' + obs.RULES.pinLimit + ' por canal.')
  })
  it('três fixados: do mais novo para o mais antigo, dizendo se está entre os N ou fora deles', () => {
    const { view, obs, picks } = mount(3)
    const p = view.drawer!.videos.pinned!, N = obs.channel(CH)!.video_limit
    expect(p.count).toBe('3 de ' + obs.RULES.pinLimit); expect(p.empty).toBeNull()
    expect(p.rows.map(r => r.id)).toEqual([...picks].sort((a, b) => b.pub - a.pub).map(v => v.id))
    expect(p.rows.map(r => r.where)).toEqual(['entre os ' + N + ' mais recentes', 'fora dos ' + N + ' mais recentes', 'fora dos ' + N + ' mais recentes'])
    expect(p.rows.every(r => r.pin.pinned && r.histHref.includes('/video/'))).toBe(true)
  })
  it('canal próprio: sem a seção', () => {
    const obs = build(0).obs, own = obs.channels.find(c => c.own)!
    expect(buildCanaisView(obs, { niche: 'todos', limit: 75, channel: own.id, tab: 'videos' }).drawer!.videos.pinned).toBeNull()
  })
})

describe('gaveta do canal, aba Vídeos', () => {
  it('não há aba nova: as mesmas três abas, e a lista de fixados é a primeira seção do painel de Vídeos', () => {
    const { container, list } = mount(3)
    expect([...container.querySelectorAll('.dtabs [role="tab"]')]).toHaveLength(3)
    const panel = container.querySelector('#cn-pVid')!
    expect(panel.hasAttribute('hidden')).toBe(false)
    expect(panel.firstElementChild).toBe(list())
    expect(list().querySelector('h4')!.textContent).toBe('Vídeos fixados 3 de 10')
    expect(list().querySelectorAll('.fx-plist li')).toHaveLength(3)
  })
  it('cada linha: título inteiro como link do histórico, duas linhas de metadado, "Desafixar" com o título no nome', () => {
    const { list, view } = mount(3)
    const row = view.drawer!.videos.pinned!.rows[1]!, li = list().querySelectorAll('.fx-plist li')[1]!
    const a = li.querySelector('a.fx-t')!
    expect(a.textContent).toBe(row.title); expect(a.getAttribute('href')).toBe(row.histHref)
    expect([...li.querySelectorAll('.m')].map(e => e.textContent)).toEqual(['publicado ' + row.published, row.where])
    expect(li.querySelector('[data-pin]')!.getAttribute('aria-label')).toBe('Desafixar: ' + row.title)
    expect(li.querySelector('[data-pin]')!.textContent).toBe('Desafixar')
  })
  it('a falha aparece dentro da linha do vídeo', async () => {
    const FAILED: PinResult = { ok: false, kind: 'failed', error: 'Não foi possível desafixar agora. Tente de novo.' }
    const { list } = mount(3, { onUnpin: async () => FAILED })
    const li = list().querySelectorAll('.fx-plist li')[1]!
    await act(async () => { fireEvent.click(li.querySelector('[data-pin]')!) })
    expect(li.querySelector('.fx-msg')!.getAttribute('data-fx-msg')).toBe('failed')
    expect(list().querySelectorAll('.fx-msg')).toHaveLength(1)
  })
  it('chegando por #fixados: o foco vai para o título da lista', () => {
    window.location.hash = '#fixados'
    const { list } = mount(3)
    expect(document.activeElement).toBe(list().querySelector('h4'))
    expect(list().querySelector('h4')!.getAttribute('tabindex')).toBe('-1')
  })
  it('sem #fixados o foco não é roubado', () => {
    const { list } = mount(3)
    expect(document.activeElement).not.toBe(list().querySelector('h4'))
  })
  it('nenhum fixado: a nota no lugar da lista', () => {
    const { list } = mount(0)
    expect(list().querySelector('.fx-plist')).toBeNull()
    expect(list().querySelector('.note')!.textContent).toMatch(/^Nenhum vídeo fixado em /)
  })
})
