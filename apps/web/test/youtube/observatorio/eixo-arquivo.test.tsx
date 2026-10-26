// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IconeDeArquivo, AusenciaPeca1 } from '@/app/cms/(authed)/youtube/competitors/_chrome/formas-arquivo'
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
  it('Naksu I1: o texto de 12 px é recortado pela caixa do trecho e a frase inteira fica no <title> (trecho estreito)', () => {
    const c = svg(<TrechoDoEixo estado={{ k: 'no_arquivo', de: sp('2026-10-01'), ate: sp('2027-04-30') }} x={10} y={5} w={90} h={26} />)
    const clip = c.querySelector('clipPath')!
    expect(clip.querySelector('rect')?.getAttribute('width')).toBe('90')
    expect(c.querySelector('text')?.getAttribute('clip-path')).toBe(`url(#${clip.id})`)
    expect(c.querySelector('title')?.textContent).toBe('01/10 a 30/04/2027 no arquivo')
  })
  it('não medido: a hachura desenha o trecho com a frase "Não foi possível ler..."', () => {
    const c = svg(<TrechoDoEixo estado={{ k: 'nao_medido' }} x={0} y={0} w={200} h={26} />)
    expect(c.querySelectorAll('rect.obs-ea-rect.hachura')).toHaveLength(1)
    expect(c.querySelector('text')?.textContent).toBe('Não foi possível ler desde quando há dado online.')
  })
})

describe('formas: o ícone com texto ao lado não é lido duas vezes (Naksu I2)', () => {
  it('padrão decorativo: aria-hidden, sem role nem rótulo; sozinho (decorativo=false) leva role="img" e o rótulo', () => {
    const d = render(<IconeDeArquivo qual="arquivo" />).container.querySelector('svg')!
    expect(d.getAttribute('aria-hidden')).toBe('true')
    expect(d.getAttribute('role')).toBeNull()
    expect(d.getAttribute('aria-label')).toBeNull()
    const s = render(<IconeDeArquivo qual="pontilhado" decorativo={false} />).container.querySelector('svg')!
    expect(s.getAttribute('role')).toBe('img')
    expect(s.getAttribute('aria-label')).toBe('antes da coleta')
    expect(s.getAttribute('aria-hidden')).toBeNull()
  })
  it('a ausência com forma lê o texto uma vez só', () => {
    const c = render(<AusenciaPeca1 forma="arquivo" texto="01/10 a 30/04/2027 no arquivo" />).container
    expect(c.querySelector('[role="img"]')).toBeNull()
    expect(c.textContent).toBe('01/10 a 30/04/2027 no arquivo')
  })
})
