// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StepRevisar } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-revisar'
import { initWizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'

const config = initWizardConfig(AB_SITE_SETTINGS_DEFAULTS)
const meta = { canal: null, publicadoEm: null, duracao: null }
const v2 = [
  { label: 'A' as const, thumbUrl: 'a.jpg', title: 't', isOriginal: true },
  { label: 'B' as const, thumbUrl: 'b.jpg', title: 't2', isOriginal: false },
]
const base = { type: 'thumbnail' as const, variants: v2, config, meta }
afterEach(cleanup)

describe('passo Revisar: volume (M7 T15)', () => {
  it('pendente: texto "Conferindo o volume do vídeo…" com role status e aria-busy, sem caixa vazia', () => {
    render(<StepRevisar {...base} avisoVolume="pendente" />)
    const caixa = document.querySelector('[data-aviso-volume-sk]')!
    const regiao = caixa.parentElement!
    expect(regiao.getAttribute('role')).toBe('status')
    expect(regiao.getAttribute('aria-live')).toBe('polite')
    expect(regiao.getAttribute('aria-atomic')).toBe('true')
    expect(regiao.getAttribute('aria-busy')).toBe('true')
    expect(caixa.getAttribute('role')).toBeNull()
    expect(caixa.textContent).toContain('Conferindo o volume do vídeo…')
  })
  it('a região viva é a mesma na troca de pendente para resolvido (aria-busy sai)', () => {
    const { container, rerender } = render(<StepRevisar {...base} avisoVolume="pendente" />)
    const antes = container.querySelector('[data-aviso-volume-sk]')!.parentElement!
    expect(antes.querySelectorAll('[role=status]').length).toBe(0) // nada aninhado no estado pendente
    rerender(<StepRevisar {...base} avisoVolume={{ estado: 'nao_chega', texto: 'este teste não chega ao volume em 15 dias' }} />)
    const depois = container.querySelector('[data-aviso-volume]')!.parentElement!
    expect(depois).toBe(antes)
    expect(depois.getAttribute('aria-busy')).toBe('false')
    expect(antes.getAttribute('role')).toBe('status')
    expect(depois.getAttribute('role')).toBe('status')
    expect(depois.querySelectorAll('[role=status]').length).toBe(0) // nada aninhado no estado resolvido
  })
  it('o esqueleto do volume não usa nenhum token verde (guarda contra regressão)', () => {
    render(<StepRevisar {...base} avisoVolume="pendente" />)
    const html = document.querySelector('[data-aviso-volume-sk]')!.outerHTML
    expect(html).not.toMatch(/green|ban-/)
  })
  it('pendente e resolvido ocupam a mesma altura mínima (.rv-vol)', () => {
    const { container, rerender } = render(<StepRevisar {...base} avisoVolume="pendente" />)
    const minDe = (el: Element) => /min-h-\[[^\]]+\]/.exec(el.className)?.[0]
    const pend = container.querySelector('.rv-vol')!
    rerender(<StepRevisar {...base} avisoVolume={{ estado: 'nao_chega', texto: 'este teste não chega ao volume em 15 dias' }} />)
    const res = container.querySelector('.rv-vol')!
    expect(minDe(pend)).toBeDefined()
    expect(minDe(pend)).toBe(minDe(res))
  })
  it('enquanto pendente, o banner do topo não fica com o tom verde de "pronto"', () => {
    const { container } = render(<StepRevisar {...base} avisoVolume="pendente" />)
    expect(container.querySelector('[data-tom="verde"]')).toBeNull()
    expect(screen.queryByText('Tudo pronto.')).toBeNull()
  })
  it('resolução da original pendente: tem texto, role status e a mesma altura mínima do cartão (M7 I3)', () => {
    const { container } = render(<StepRevisar {...base} avisoVolume={null} avisoOriginal="pendente" />)
    const caixa = container.querySelector('[aria-label="Lendo a resolução da original"]')!
    expect(caixa.getAttribute('aria-busy')).toBe('true')
    expect(caixa.getAttribute('role')).toBe('status')
    expect(caixa.textContent).toContain('Conferindo a resolução')
    expect(caixa.className).toContain("min-h-[180px] sm:min-h-[120px]")
  })
})
