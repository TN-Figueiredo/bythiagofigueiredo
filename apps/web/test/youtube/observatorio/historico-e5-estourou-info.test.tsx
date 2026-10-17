// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/historico-e5-estourou-info.test.tsx
// A5 · E5a, Tarefa 10a (G-4 do Gio): o ⓘ do "Estourou e parou" fecha com Esc e devolve o foco ao botão.
import { describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { EstourouInfo } from '@/app/cms/(authed)/youtube/competitors/_historico/estourou-info'

describe('EstourouInfo', () => {
  it('Esc fecha o painel aberto e o foco volta ao summary; com o painel fechado, Esc não faz nada', () => {
    const { container } = render(<EstourouInfo />)
    const d = container.querySelector('details')!
    const sum = container.querySelector('summary')!
    d.open = true
    fireEvent.keyDown(d, { key: 'Escape' })
    expect(d.open).toBe(false)
    expect(document.activeElement).toBe(sum)
    fireEvent.keyDown(d, { key: 'Escape' })
    expect(d.open).toBe(false)
    d.open = true
    fireEvent.keyDown(d, { key: 'a' })
    expect(d.open).toBe(true)
    cleanup()
  })
  it('o conteúdo do método continua lá', () => {
    const { container } = render(<EstourouInfo />)
    expect(container.textContent).toContain('Como a leitura é calculada')
    expect(container.textContent).toContain('Muitas views cedo')
    cleanup()
  })
})
