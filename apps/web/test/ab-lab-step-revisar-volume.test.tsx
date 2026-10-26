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
    expect(caixa.getAttribute('role')).toBe('status')
    expect(caixa.getAttribute('aria-busy')).toBe('true')
    expect(caixa.textContent).toContain('Conferindo o volume do vídeo…')
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
})
