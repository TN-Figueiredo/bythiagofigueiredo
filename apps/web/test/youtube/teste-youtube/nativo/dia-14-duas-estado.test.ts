import { describe, it, expect } from 'vitest'
import { perguntaDoDia14 } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/dia-14-duas-estado'

const v = (n: number) => ({ n, titulo: `T${n}`, imagem: null })

describe('perguntaDoDia14 (T10b, D-1)', () => {
  it('2 versões -> duas', () => { expect(perguntaDoDia14({ variantes: [v(1), v(2)] })).toBe('duas') })
  it('3 versões -> sem_botao', () => { expect(perguntaDoDia14({ variantes: [v(1), v(2), v(3)] })).toBe('sem_botao') })
  it('origem derivada (variantes nulo) -> sem_botao, nunca pergunta com versões inventadas', () => { expect(perguntaDoDia14({ variantes: null })).toBe('sem_botao') })
  it('lista vazia ou de 1 -> sem_botao', () => {
    expect(perguntaDoDia14({ variantes: [] })).toBe('sem_botao')
    expect(perguntaDoDia14({ variantes: [v(1)] })).toBe('sem_botao')
  })
})
