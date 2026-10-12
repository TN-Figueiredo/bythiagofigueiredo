// @vitest-environment jsdom
// A4 13.3 (I2b): `_canal/video-card.tsx` é compartilhado com a página de canal do CONCORRENTE, que está em produção. A ordem nova das linhas do cartão
// (views por dia logo abaixo das views) só vale para o canal próprio; aqui o cartão do concorrente é preso BYTE A BYTE: o SHA-256 do HTML dos 12
// primeiros cartões foi tirado do código ANTES da mudança (o mesmo mundo `matt-wolfe`, o mesmo relógio do oráculo) e tem de continuar igual.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { createHash } from 'node:crypto'
import { mountCanal, cartoes } from './canal-mount'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
}))
beforeEach(() => { window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

describe('13.3 cartão do concorrente: intocado pela ordem nova do cartão próprio', () => {
  it('o HTML dos 12 primeiros cartões do concorrente é byte a byte o de antes (SHA-256 e tamanho)', () => {
    mountCanal()
    const doze = cartoes().slice(0, 12)
    expect(doze).toHaveLength(12)
    const html = doze.map(c => c.outerHTML).join('\n')
    expect(html.length).toBe(39398)
    expect(createHash('sha256').update(html).digest('hex')).toBe('6c4577c96df0706e36113f71e1ab20985ef3e563060daed6546f51777c875bd0')
  })

  it('o cartão do concorrente não tem a linha das views por dia do diário nem a classe do cartão próprio', () => {
    mountCanal()
    for (const c of cartoes()) {
      expect(c.querySelector('.cv-vpd')).toBeNull()
      expect(c.querySelector('.cv-n3')).toBeNull()
    }
  })
})
