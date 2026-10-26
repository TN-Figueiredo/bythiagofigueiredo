// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, cleanup } from '@testing-library/react'
import { andamentoDoDia, rotuloDoDiaExtenso } from '@/lib/youtube/ab-rotulo-dia'
import { AndamentoV2 } from '@/app/cms/(authed)/youtube/ab-lab/_components/blocos-v2'

describe('andamentoDoDia (M7 I1/M3)', () => {
  it('conta de 1 a partir dos dias passados', () => {
    expect(andamentoDoDia(0, 15)).toEqual({ atual: 1, faltam: 14, ultimo: false, passou: false })
    expect(andamentoDoDia(14, 15)).toEqual({ atual: 15, faltam: 0, ultimo: true, passou: false })
    expect(andamentoDoDia(16, 15).passou).toBe(true)
  })
  it('rotuloDoDiaExtenso monta o texto dos números; teto inválido vira vazio (M4)', () => {
    expect(rotuloDoDiaExtenso(14, 15)).toBe('Dia 15 de 15')
    expect(rotuloDoDiaExtenso(0, 15, { minusculo: true })).toBe('dia 1 de 15')
    expect(rotuloDoDiaExtenso(3, 0)).toBe('')
  })
  it('AndamentoV2 no dia 15 de 15: "último dia", sem "faltam"', () => {
    const { container } = render(<AndamentoV2 dia={14} teto={15} pausado={false} />)
    const t = container.textContent ?? ''
    expect(t).toContain('Dia 15 de 15')
    expect(t).toContain('último dia')
    expect(t).not.toContain('faltam')
    cleanup()
  })
  it('AndamentoV2 no dia 1: "faltam 14 dias"', () => {
    const { container } = render(<AndamentoV2 dia={0} teto={15} pausado={false} />)
    expect(container.textContent).toContain('faltam 14 dias')
    cleanup()
  })
  it('a frase da tela v2 no último dia não cita número de dia (fonte)', () => {
    const src = readFileSync(join(__dirname, '../src/lib/youtube/ab-gravacao/tela-v2.ts'), 'utf8')
    expect(src).not.toContain('No dia ${e.teto}')
    expect(src).toContain('Amanhã a original volta ao ar.')
  })
  it('a doc do Cowork explica que a tela mostra dia + 1 (I2)', () => {
    const doc = readFileSync(join(__dirname, '../data/pipeline-docs/cowork-docs-youtube.md'), 'utf8')
    expect(doc).toContain('Dia `dia + 1`/`teto`')
    expect(doc).not.toContain('é o mesmo número da tela')
  })
})

describe('vocabulário: miniatura (M7 M2)', () => {
  it('filtro, passo Tipo e frase do combo dizem miniatura', async () => {
    const { FRASE_COMBO } = await import('@/app/cms/(authed)/youtube/ab-lab/_components/ab-constants')
    expect(FRASE_COMBO).toContain('ou a miniatura')
    const tipo = readFileSync(join(__dirname, '../src/app/cms/(authed)/youtube/ab-lab/_components/step-tipo.tsx'), 'utf8')
    expect(tipo).toContain("title: 'Título e miniatura'")
    expect(tipo).not.toContain('Thumbnail')
  })
})
