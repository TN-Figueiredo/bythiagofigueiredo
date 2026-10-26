import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LabEsqueleto } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/lab-esqueleto'

afterEach(cleanup)

describe('LabEsqueleto (Naksu C2)', () => {
  it('reserva a altura final por seção e mantém um só status', () => {
    const { container } = render(<LabEsqueleto />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    const alturas = (t: string) => Array.from(container.querySelectorAll(`section[aria-label="${t}"] [data-esq-bloco]`)).map(b => (b as HTMLElement).style.height)
    expect(alturas('Com você')).toEqual(['64px', '64px'])
    expect(alturas('Em teste agora')).toEqual(['300px', '300px'])
    expect(alturas('Concluídos')).toEqual(['68px', '68px', '68px'])
    expect(alturas('Vídeos do canal')).toEqual(['72px', '72px', '72px'])
  })
  it('a animação respeita prefers-reduced-motion e nenhum texto "Carregando…" solto sobra', () => {
    const { container } = render(<LabEsqueleto />)
    for (const b of container.querySelectorAll('[data-esq-bloco]')) expect(b.className).toContain('motion-safe:animate-pulse')
    expect(container.textContent).not.toContain('Carregando')
  })
})
