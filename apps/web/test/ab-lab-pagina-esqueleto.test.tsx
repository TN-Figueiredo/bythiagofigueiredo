import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LabEsqueleto } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/lab-esqueleto'

afterEach(cleanup)

describe('LabEsqueleto (Naksu C2; Gio D2)', () => {
  it('reserva o cabeçalho da página (título e 4 botões) antes de Com você', () => {
    const { container } = render(<LabEsqueleto />)
    const cab = container.querySelector('[data-esq-cabecalho]')
    expect(cab).not.toBeNull()
    expect(cab!.querySelector('h1')?.textContent).toBe('A/B Lab')
    expect(cab!.querySelectorAll('.h-11')).toHaveLength(4)
    expect(cab!.compareDocumentPosition(container.querySelector('section[aria-label="Com você"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('cada bloco tem a altura medida do elemento final (1440) e um só status', () => {
    const { container } = render(<LabEsqueleto />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    const classe = (t: string) => Array.from(container.querySelectorAll(`section[aria-label="${t}"] [data-esq-bloco]`)).map(b => b.className)
    expect(classe('Com você')[0]).toContain('sm:h-[206px]')
    const cartoes = classe('Em teste agora')
    expect(cartoes).toHaveLength(2)
    for (const c of cartoes) { expect(c).toContain('sm:h-[288px]'); expect(c).not.toContain('300') }
    expect(classe('Concluídos')[0]).toContain('sm:h-[213px]')
    expect(classe('Vídeos do canal')[0]).toContain('sm:h-11')
  })
  it('a animação respeita prefers-reduced-motion e nenhum texto "Carregando…" solto sobra', () => {
    const { container } = render(<LabEsqueleto />)
    for (const b of container.querySelectorAll('[data-esq-bloco]')) expect(b.className).toContain('motion-safe:animate-pulse')
    expect(container.textContent).not.toContain('Carregando')
  })
})
