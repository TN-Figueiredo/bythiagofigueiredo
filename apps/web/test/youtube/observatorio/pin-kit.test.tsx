// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/pin-kit.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinProvider, PinButton, PinMessage, PinChips, PIN_TEXT, type PinAction } from '@/app/cms/(authed)/youtube/competitors/_chrome/pin-kit'
import type { PinView } from '@/app/cms/(authed)/youtube/competitors/_chrome/pin-view'
import type { PinResult } from '@/app/cms/(authed)/youtube/competitors/pin-result'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }))

const pin = (o: Partial<PinView> = {}): PinView => ({ videoId: 'v1', channelId: 'c1', title: 'Cruzei a Mongólia de trem', pinned: false, chips: [], hint: 'Um vídeo fixado tem gráfico de views.', pinnedHref: '/cms/youtube/competitors?channel=c1&tab=videos#fixados', ...o })
const OK: PinResult = { ok: true }
const CAP: PinResult = { ok: false, kind: 'cap', error: 'Sem vagas: 10 de 10 vídeos fixados em Canal Um. Desafixe um para fixar outro.' }
const FAILED: PinResult = { ok: false, kind: 'failed', error: 'Não foi possível fixar agora. Tente de novo.' }
const DENIED: PinResult = { ok: false, kind: 'denied', error: 'Este vídeo não existe mais no Observatório.' }
/** A promise the test resolves by hand, so the busy state can be looked at. */
function deferred() { let done!: (r: PinResult) => void; const p = new Promise<PinResult>(r => { done = r }); return { p, done } }
function mount(o: { onPin?: PinAction; onUnpin?: PinAction; pins?: Array<{ pin: PinView; k?: string }> } = {}) {
  const pins = o.pins ?? [{ pin: pin() }]
  return render(
    <div data-obs="">
      <PinProvider onPin={o.onPin ?? (async () => OK)} onUnpin={o.onUnpin ?? (async () => OK)}>
        {pins.map(x => <div key={x.k ?? x.pin.videoId} data-card=""><PinButton pin={x.pin} k={x.k} className="btn" /><PinMessage k={x.k ?? x.pin.videoId} /></div>)}
      </PinProvider>
    </div>)
}
const btn = (i = 0) => document.querySelectorAll<HTMLButtonElement>('[data-pin]')[i]!
const status = () => document.getElementById('fx-status')!, alertEl = () => document.getElementById('fx-alert')!

beforeEach(() => { refresh.mockReset() })
afterEach(() => { vi.useRealTimers(); document.getElementById('flut')?.remove() })

describe('PinProvider: regiões vivas', () => {
  it('existem vazias desde a montagem, uma de cada', () => {
    mount()
    expect(document.querySelectorAll('#fx-status')).toHaveLength(1)
    expect(document.querySelectorAll('#fx-alert')).toHaveLength(1)
    expect(status().getAttribute('aria-live')).toBe('polite'); expect(status().textContent).toBe('')
    expect(alertEl().getAttribute('aria-live')).toBe('assertive'); expect(alertEl().textContent).toBe('')
  })
})

describe('PinButton', () => {
  it('diz a ação e leva o título do vídeo no nome; o estado não é aria-pressed', () => {
    mount()
    expect(btn().textContent).toBe(PIN_TEXT.pin)
    expect(btn().getAttribute('aria-label')).toBe('Fixar vídeo: Cruzei a Mongólia de trem')
    expect(btn().hasAttribute('aria-pressed')).toBe(false)
    expect(btn().classList.contains('fx-btn')).toBe(true)
  })
  it('em andamento: "Fixando…", aria-busy e aria-disabled, sem disabled (não perde o foco), e anuncia', async () => {
    const d = deferred(), onPin = vi.fn(() => d.p)
    mount({ onPin })
    btn().focus()
    fireEvent.click(btn())
    expect(btn().textContent).toBe(PIN_TEXT.pinBusy)
    expect(btn().getAttribute('aria-busy')).toBe('true'); expect(btn().getAttribute('aria-disabled')).toBe('true'); expect(btn().disabled).toBe(false)
    expect(status().textContent).toBe('Fixando…')
    fireEvent.click(btn()) // a second click while busy does nothing
    expect(onPin).toHaveBeenCalledTimes(1)
    await act(async () => { d.done(OK); await d.p })
    expect(btn().textContent).toBe(PIN_TEXT.unpin)
    expect(btn().getAttribute('aria-label')).toBe('Desafixar: Cruzei a Mongólia de trem')
    expect(status().textContent).toBe('Vídeo fixado.'); expect(alertEl().textContent).toBe('')
    expect(document.activeElement).toBe(btn())
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('desafixar: chama onUnpin e anuncia', async () => {
    const onUnpin = vi.fn(async () => OK)
    mount({ onUnpin, pins: [{ pin: pin({ pinned: true }) }] })
    await act(async () => { fireEvent.click(btn()) })
    expect(onUnpin).toHaveBeenCalledWith('v1')
    expect(btn().textContent).toBe(PIN_TEXT.pin); expect(status().textContent).toBe('Vídeo desafixado.')
  })
  it.each([[CAP, 'cap', 'warn', true], [FAILED, 'failed', 'err', false], [DENIED, 'denied', 'info', false]] as const)(
    'resposta %j: a mensagem mostra a frase como veio, com o tratamento do kind', async (res, kind, icon, link) => {
      mount({ onPin: async () => res })
      await act(async () => { fireEvent.click(btn()) })
      const msg = document.getElementById('fx-msg-v1')!
      expect(msg.getAttribute('data-fx-msg')).toBe(kind)
      expect(msg.querySelector('svg')!.getAttribute('data-fx-icon')).toBe(icon)
      expect(msg.textContent!.startsWith(res.ok ? '' : res.error)).toBe(true)
      expect(!!msg.querySelector('a')).toBe(link)
      if (link) { expect(msg.querySelector('a')!.textContent).toBe('Ver fixados'); expect(msg.querySelector('a')!.getAttribute('href')).toBe('/cms/youtube/competitors?channel=c1&tab=videos#fixados') }
      expect(msg.hasAttribute('aria-live')).toBe(false); expect(msg.getAttribute('role')).toBeNull() // announced once, by #fx-alert
      expect(alertEl().textContent).toBe(res.ok ? '' : res.error); expect(status().textContent).toBe('')
      expect(btn().textContent).toBe(PIN_TEXT.pin) // the button goes back to what it was
      expect(btn().getAttribute('aria-describedby')).toContain('fx-msg-v1')
      expect(refresh).not.toHaveBeenCalled()
    })
  it('os três tratamentos têm classes diferentes', async () => {
    const seen: string[] = []
    for (const res of [CAP, FAILED, DENIED]) {
      const r = mount({ onPin: async () => res })
      await act(async () => { fireEvent.click(btn()) })
      seen.push(document.getElementById('fx-msg-v1')!.className); r.unmount()
    }
    expect(seen).toEqual(['fx-msg fx-cap', 'fx-msg fx-err', 'fx-msg fx-info'])
  })
  it('a ação que lança vira a frase de falha (nunca o erro cru)', async () => {
    mount({ onPin: async () => { throw new Error('permission denied for table competitor_videos') } })
    await act(async () => { fireEvent.click(btn()) })
    expect(document.getElementById('fx-msg-v1')!.textContent).toBe('Não foi possível fixar agora. Tente de novo.')
    expect(document.body.textContent).not.toMatch(/permission denied|competitor_videos/)
  })
  it('sem resposta em 15 s: a frase de falha, e o botão volta ao que era', async () => {
    vi.useFakeTimers()
    mount({ onPin: () => new Promise<PinResult>(() => {}) })
    fireEvent.click(btn())
    expect(btn().getAttribute('aria-busy')).toBe('true')
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(btn().hasAttribute('aria-busy')).toBe(false); expect(btn().textContent).toBe(PIN_TEXT.pin)
    expect(document.getElementById('fx-msg-v1')!.getAttribute('data-fx-msg')).toBe('failed')
  })
  it('por 0,7 s depois de uma resposta boa o botão ignora cliques (a ação acabou de trocar sob o cursor)', async () => {
    vi.useFakeTimers()
    const onPin = vi.fn(async () => OK), onUnpin = vi.fn(async () => OK)
    mount({ onPin, onUnpin })
    await act(async () => { fireEvent.click(btn()); await vi.advanceTimersByTimeAsync(0) })
    expect(btn().textContent).toBe(PIN_TEXT.unpin)
    await act(async () => { fireEvent.click(btn()); await vi.advanceTimersByTimeAsync(0) })
    expect(onUnpin).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(700); fireEvent.click(btn()); await vi.advanceTimersByTimeAsync(0) })
    expect(onUnpin).toHaveBeenCalledTimes(1)
  })
  it('o mesmo vídeo em dois cartões: nomes únicos por cartão ficam a cargo da tela, ids nunca se repetem, e a mensagem nasce só no cartão ativado', async () => {
    mount({ onPin: async () => CAP, pins: [{ pin: pin(), k: 'troca-1' }, { pin: pin(), k: 'troca-2' }] })
    await act(async () => { fireEvent.click(btn(1)) })
    expect(document.getElementById('fx-msg-troca-2')).not.toBeNull(); expect(document.getElementById('fx-msg-troca-1')).toBeNull()
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(btn(0).getAttribute('data-fx-k')).toBe('troca-1'); expect(btn(1).getAttribute('data-fx-k')).toBe('troca-2')
  })
  it('qualquer resposta apaga as mensagens do mesmo canal (a contagem delas pode ter ficado velha); as de outro canal ficam', async () => {
    let n = 0
    mount({ onPin: async () => (++n <= 2 ? CAP : OK), pins: [{ pin: pin() }, { pin: pin({ videoId: 'v2', channelId: 'c2' }) }, { pin: pin({ videoId: 'v3' }) }] })
    await act(async () => { fireEvent.click(btn(0)) }); await act(async () => { fireEvent.click(btn(1)) })
    expect(document.querySelectorAll('.fx-msg')).toHaveLength(2)
    await act(async () => { fireEvent.click(btn(2)) }) // v3 is of channel c1: answers OK
    expect(document.getElementById('fx-msg-v1')).toBeNull(); expect(document.getElementById('fx-msg-v2')).not.toBeNull()
    expect(alertEl().textContent).toBe('')
  })
  it('sem ação recebida por props (página que não passou onPin): o clique não faz nada e nada quebra', async () => {
    render(<div data-obs=""><PinProvider><PinButton pin={pin()} className="btn" /></PinProvider></div>)
    await act(async () => { fireEvent.click(btn()) })
    expect(btn().textContent).toBe(PIN_TEXT.pin); expect(document.querySelector('.fx-msg')).toBeNull()
  })
})

describe('dica do botão (V1)', () => {
  const hint = () => document.getElementById('fx-hint-v1')!
  it('existe no DOM como descrição do botão, fechada; abre com foco de teclado', async () => {
    mount()
    expect(hint().textContent).toBe('Um vídeo fixado tem gráfico de views.'); expect(hint().hasAttribute('data-open')).toBe(false)
    expect(btn().getAttribute('aria-describedby')).toBe('fx-hint-v1')
    await userEvent.tab()
    expect(document.activeElement).toBe(btn()); expect(hint().hasAttribute('data-open')).toBe(true)
  })
  it('não abre com foco vindo do ponteiro', () => {
    mount()
    fireEvent.pointerDown(btn()); fireEvent.focus(btn())
    expect(hint().hasAttribute('data-open')).toBe(false)
  })
  it('Esc fecha e ela fica fechada até o foco sair', async () => {
    mount()
    await userEvent.tab(); await userEvent.keyboard('{Escape}')
    expect(hint().hasAttribute('data-open')).toBe(false); expect(document.activeElement).toBe(btn())
    fireEvent.blur(btn()); fireEvent.focus(btn())
    expect(hint().hasAttribute('data-open')).toBe(true)
  })
  it('some ao ativar o botão e nunca aparece junto de uma mensagem', async () => {
    mount({ onPin: async () => CAP })
    await userEvent.tab()
    await act(async () => { await userEvent.keyboard('{Enter}') })
    expect(document.getElementById('fx-msg-v1')).not.toBeNull(); expect(hint().hasAttribute('data-open')).toBe(false)
    fireEvent.blur(btn()); fireEvent.focus(btn())
    expect(hint().hasAttribute('data-open')).toBe(false) // a message is on the screen
  })
  it('a dica visível mora em #flut; o texto para leitor de tela continua junto do botão', () => {
    const { container } = mount()
    fireEvent.focus(btn())
    const sr = container.querySelector('.fx-hint')!
    expect(sr.hasAttribute('data-open')).toBe(true)
    const vis = document.querySelector('#flut .fx-hint-pop')!
    expect(vis.textContent).toBe(sr.textContent)
    expect(vis.getAttribute('aria-hidden')).toBe('true')
    fireEvent.blur(btn())
    expect(document.querySelector('#flut .fx-hint-pop')).toBeNull()
  })
  it('a dica visível abre à ESQUERDA do botão (como em produção) e, sem espaço dos dois lados, ACIMA dele', () => {
    const at = (left: number) => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const isBtn = this.hasAttribute('data-pin'), w = isBtn ? 100 : 300, h = isBtn ? 32 : 60
      return { left: isBtn ? left : 0, right: (isBtn ? left : 0) + w, top: isBtn ? 400 : 0, bottom: (isBtn ? 400 : 0) + h, width: w, height: h, x: 0, y: 0, toJSON: () => ({}) }
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 300 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 60 })
    try {
      const spy = at(800)
      mount(); fireEvent.focus(btn())
      expect((document.querySelector('#flut .fx-hint-pop') as HTMLElement).style.left).toBe(800 - 8 - 300 + 'px')
      fireEvent.blur(btn()); spy.mockRestore()
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 })
      Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 400 })
      at(40)
      fireEvent.focus(btn())
      const hint = document.querySelector('#flut .fx-hint-pop') as HTMLElement
      expect(hint.dataset.lado).toBe('cima')
      expect(hint.style.top).toBe(400 - 6 - 60 + 'px')
    } finally {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight
      Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 0 })
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
      vi.restoreAllMocks()
    }
  })
  it('vídeo já fixado: sem dica (a ação é "Desafixar")', () => {
    mount({ pins: [{ pin: pin({ pinned: true }) }] })
    expect(document.getElementById('fx-hint-v1')).toBeNull()
  })
})

describe('PinChips', () => {
  it('selo de dois segmentos com a vírgula só para leitor de tela; selo de um segmento tracejado', () => {
    render(<div data-obs=""><PinChips chips={[{ kind: 'fixado', label: 'Fixado', how: 'conferido a cada 6 h' }, { kind: 'fora-dos-n', label: 'fora dos 150 mais recentes', how: null }]} small /></div>)
    const [a, b] = [...document.querySelectorAll('.fx-chip')]
    expect(a!.getAttribute('data-fx')).toBe('fixado'); expect(a!.textContent).toBe('Fixado, conferido a cada 6 h'); expect(a!.classList.contains('fx-sm')).toBe(true)
    expect(a!.querySelector('.fx-sr')!.textContent).toBe(', ')
    expect(b!.classList.contains('fx-out')).toBe(true); expect(b!.textContent).toBe('fora dos 150 mais recentes')
  })
  it('sem selos (o dado não existe): nada no DOM', () => {
    const { container } = render(<div data-obs=""><PinChips chips={[]} /></div>)
    expect(container.querySelector('.fx-chip')).toBeNull()
  })
})
