// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrechoDoEixo } from '@/app/cms/(authed)/youtube/competitors/_chrome/eixo-arquivo'

const sp = (d: string) => Date.parse(d + 'T03:00:00Z')
const svg = (el: React.ReactElement) => render(<svg>{el}</svg>).container

describe('eixo: o trecho no arquivo', () => {
  it('no_arquivo: um <rect> da forma arquivo e um <text> com "no arquivo"', () => {
    const c = svg(<TrechoDoEixo estado={{ k: 'no_arquivo', de: sp('2026-10-01'), ate: sp('2027-04-30') }} x={0} y={0} w={200} h={26} />)
    expect(c.querySelectorAll('rect.obs-ea-rect.arquivo')).toHaveLength(1)
    expect(c.querySelector('text')?.textContent).toBe('01/10 a 30/04/2027 no arquivo')
  })
  it('antes_da_coleta: pontilhado, nunca a caixa de arquivo', () => {
    const c = svg(<TrechoDoEixo estado={{ k: 'antes_da_coleta', coleta: sp('2026-10-03') }} x={0} y={0} w={200} h={26} />)
    expect(c.querySelectorAll('rect.obs-ea-rect.pontilhado')).toHaveLength(1)
    expect(c.querySelector('rect.obs-ea-rect.arquivo')).toBeNull()
    expect(c.querySelector('text')?.textContent).toBe('A coleta começou em 10/2026')
  })
  it('nada_saiu, desde e sem largura: nenhum <rect> e nenhum <text>', () => {
    for (const estado of [{ k: 'nada_saiu' as const }, { k: 'desde' as const, desde: sp('2027-05-01') }]) {
      const c = svg(<TrechoDoEixo estado={estado} x={0} y={0} w={200} h={26} />)
      expect(c.querySelector('rect')).toBeNull()
      expect(c.querySelector('text')).toBeNull()
    }
    expect(svg(<TrechoDoEixo estado={{ k: 'no_arquivo', de: sp('2026-10-01'), ate: sp('2027-04-30') }} x={0} y={0} w={0} h={26} />).querySelector('rect')).toBeNull()
  })
})
