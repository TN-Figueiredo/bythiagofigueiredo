// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/canais-remove-dialog.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { RemoveDialog, type ImpactAnswer } from '@/app/cms/(authed)/youtube/competitors/_canais/remove-dialog'

const IMPACT = { name: 'Leo Khev', videos: 150, pinned: 2, versions: 472, dailyDays: 22, bookmarks: 3 }
function deferred() { let done!: (r: ImpactAnswer) => void; const p = new Promise<ImpactAnswer>(r => { done = r }); return { p, done } }
function mount(onImpact?: (id: string) => Promise<ImpactAnswer>) {
  const onConfirm = vi.fn(), onCancel = vi.fn()
  const r = render(<div data-obs=""><div data-obs-screen="canais"><RemoveDialog id="c1" name="Leo Khev" onImpact={onImpact} onCancel={onCancel} onConfirm={onConfirm} trap={() => {}} /></div></div>)
  const rows = () => [...r.container.querySelectorAll('.fx-loss li')].map(li => li.textContent)
  const yes = () => [...r.container.querySelectorAll('button')].find(b => b.textContent === 'Remover canal')!
  return { ...r, onConfirm, onCancel, rows, yes, status: () => r.container.querySelector('[role="status"]')! }
}
afterEach(() => { vi.useRealTimers() })

describe('RemoveDialog', () => {
  it('abre contando: as quatro linhas já existem, o foco está em Cancelar e Remover canal espera', () => {
    const d = deferred(), m = mount(() => d.p)
    expect(m.container.querySelector('[role="dialog"]')!.getAttribute('aria-modal')).toBe('true')
    expect(m.container.querySelector('h2')!.textContent).toBe('Remover Leo Khev?')
    expect(m.rows()).toHaveLength(4)
    expect(m.rows().every(t => t!.startsWith('contando…'))).toBe(true)
    expect(m.container.querySelector('.fx-loss')!.getAttribute('aria-busy')).toBe('true')
    expect(document.activeElement!.textContent).toBe('Cancelar')
    expect(m.yes().getAttribute('aria-disabled')).toBe('true'); expect(m.yes().disabled).toBe(false)
    expect(m.yes().getAttribute('aria-describedby')).toBe(m.status().id)
    expect(m.status().textContent).toBe('Contando o que será apagado. Remover canal fica disponível quando a contagem chegar.')
    fireEvent.click(m.yes()); expect(m.onConfirm).not.toHaveBeenCalled()
  })
  it('contagem pronta: números, singular e plural, e o anúncio; Remover canal libera', async () => {
    const d = deferred(), m = mount(() => d.p)
    await act(async () => { d.done({ ok: true, impact: IMPACT }); await d.p })
    expect(m.rows()).toEqual([
      '472versões guardadastítulos, thumbnails e descrições de 150 vídeos',
      '22dias de registrosviews diárias dos vídeos',
      '2vídeos fixadosapagados com o canal; se ele voltar, é preciso fixar de novo',
      '3trocas salvas no swipe filesaem do swipe file junto com o canal',
    ])
    expect(m.container.querySelector('.fx-loss')!.hasAttribute('aria-busy')).toBe(false)
    expect(m.status().textContent).toBe('Contagem pronta: 472 versões guardadas, 22 dias de registros, 2 vídeos fixados, 3 trocas salvas no swipe file.')
    expect(m.yes().hasAttribute('aria-disabled')).toBe(false)
    fireEvent.click(m.yes()); expect(m.onConfirm).toHaveBeenCalledTimes(1)
  })
  it('zeros de verdade: "nenhum" / "nenhuma", sem a linha de explicação; um: singular', async () => {
    const m = mount(async () => ({ ok: true, impact: { ...IMPACT, videos: 1, versions: 1, dailyDays: 0, pinned: 0, bookmarks: 0 } }))
    await act(async () => {})
    expect(m.rows()).toEqual(['1versão guardadatítulos, thumbnails e descrições de 1 vídeo', 'nenhumdia de registros', 'nenhumvídeo fixado', 'nenhumatroca salva no swipe file'])
    expect(m.container.querySelectorAll('.fx-loss li')).toHaveLength(4) // the row stays: its height is reserved
  })
  it.each([['a ação devolve ok: false', async (): Promise<ImpactAnswer> => ({ ok: false })], ['a ação lança', async (): Promise<ImpactAnswer> => { throw new Error('x') }]])(
    'não foi possível contar (%s): diz o que some sem números, e a remoção continua disponível', async (_n, fn) => {
      const m = mount(fn)
      await act(async () => {})
      expect(m.container.querySelector('.fx-loss')).toBeNull()
      expect(m.container.textContent).toContain('Remover apaga todo o histórico deste canal: os vídeos, as versões de título, thumbnail e descrição, os registros diários de views, os vídeos fixados e as trocas salvas no swipe file.')
      const msg = m.container.querySelector('.fx-msg.fx-err')!
      expect(msg.textContent).toBe('Não foi possível contar o que será apagado. A remoção continua disponível e apaga tudo o que está descrito acima.')
      expect(m.container.textContent).not.toMatch(/\b0\b|nenhum/)
      expect(m.yes().hasAttribute('aria-disabled')).toBe(false)
      expect(m.status().textContent).toBe('Não foi possível contar o que será apagado. Remover canal continua disponível.')
    })
  it('sem resposta em 10 s: cai em "não foi possível contar"', async () => {
    vi.useFakeTimers()
    const m = mount(() => new Promise<ImpactAnswer>(() => {}))
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(m.container.querySelector('.fx-msg.fx-err')).not.toBeNull(); expect(m.yes().hasAttribute('aria-disabled')).toBe(false)
  })
  it('sem a ação de contagem (página antiga): o mesmo estado de "não foi possível contar", nunca zeros', async () => {
    const m = mount(undefined)
    await act(async () => {})
    expect(m.container.querySelector('.fx-msg.fx-err')).not.toBeNull()
  })
  it('as frases fixas do que a contagem não mede estão sempre lá; clique fora não fecha', async () => {
    const m = mount(async () => ({ ok: true, impact: IMPACT }))
    await act(async () => {})
    expect(m.container.textContent).toContain('Também saem as leituras da forja feitas para vídeos deste canal e o histórico de inscritos dele. O canal deixa o observatório e para de sincronizar.')
    expect(m.container.textContent).toContain('Não dá para desfazer: se você adicionar o canal de novo, a coleta recomeça do zero e este histórico não volta.')
    fireEvent.click(m.container.querySelector('.modal')!)
    expect(m.onCancel).not.toHaveBeenCalled()
    fireEvent.click([...m.container.querySelectorAll('button')].find(b => b.textContent === 'Cancelar')!)
    expect(m.onCancel).toHaveBeenCalledTimes(1)
  })
})
