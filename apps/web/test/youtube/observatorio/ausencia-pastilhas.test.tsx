// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PastilhaAusencia } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/pastilhas'
import { CAMINHO_AVISO, CAMINHO_CADEADO } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/glifos'
import { ROTULO_AUSENCIA, type EstadoAusencia } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/estado'

const estados: EstadoAusencia[] = ['nao_medido', 'falhou', 'restrito']
const html = (e: EstadoAusencia, extra: { motivo?: string; quadradinho?: boolean } = {}) => render(<PastilhaAusencia estado={e} {...extra} />).container.innerHTML

describe('PastilhaAusencia', () => {
  it.each(estados)('%s escreve a palavra do rótulo', e => {
    const { container } = render(<PastilhaAusencia estado={e} />)
    expect(container.textContent).toBe(ROTULO_AUSENCIA[e])
  })
  it('as três formas se distinguem sem cor: glifo ou hachura próprios', () => {
    const nm = html('nao_medido'), fa = html('falhou'), re = html('restrito')
    expect(fa).toContain('M7 1.8 12.8 12H1.2Z'); expect(fa).not.toContain('<rect')
    expect(re).toContain('<rect'); expect(re).not.toContain('M7 1.8')
    expect(nm).not.toContain('<svg'); expect(nm).toContain('obs-ch-nm')
    expect(CAMINHO_AVISO).toContain('M7 1.8'); expect(CAMINHO_CADEADO).toContain('<rect')
  })
  it('o motivo vai em title e no texto só para leitor de tela', () => {
    for (const e of estados) {
      const { container } = render(<PastilhaAusencia estado={e} motivo="porque sim" />)
      expect(container.querySelector('[title="porque sim"]')).not.toBeNull()
      expect(container.querySelector('.obs-md-sr')?.textContent).toBe(': porque sim')
    }
  })
  it('quadradinho: role=img, aria-label = title = rótulo, sem texto', () => {
    for (const e of estados) {
      const { container } = render(<PastilhaAusencia estado={e} quadradinho />)
      const el = container.firstElementChild!
      expect(el.getAttribute('role')).toBe('img')
      expect(el.getAttribute('aria-label')).toBe(ROTULO_AUSENCIA[e])
      expect(el.getAttribute('title')).toBe(ROTULO_AUSENCIA[e])
      expect(el.textContent).toBe('')
    }
  })
  it('nenhum role="alert" e nenhum role na pastilha com texto', () => {
    for (const e of estados) {
      const h = html(e, { motivo: 'x' })
      expect(h).not.toContain('role=')
    }
  })
  it('texto próprio do não medido', () => {
    expect(render(<PastilhaAusencia estado="nao_medido" texto="sem dado" />).container.textContent).toBe('sem dado')
  })
})
