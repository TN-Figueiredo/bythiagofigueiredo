// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { rotuloDoDia } from '@/lib/youtube/ab-rotulo-dia'
import { PRAZO_FECHAMENTO_DIAS, type Placar } from '@/lib/youtube/ab-gravacao/placar'
import { TYPE_META } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-constants'
import { PlacarDoTeste, prazoDoPrimeiroDia } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-do-teste'
import type { FullChartVariant, VariantThumb } from '@/lib/youtube/ab-types'

const lib = (p: string) => readFileSync(join(__dirname, '../src/lib/youtube', p), 'utf8')

const placarSemDia: Placar = {
  regra: 'v2', estatistica: 'nao_calculada', variantes: [], dias_total: 0, dias_descartados: 0,
  dias_variante_desconhecida: 0, atualizado_em: null, desatualizado: false, atrasado: false,
  todos_finais: false, iniciado: true, proximo_fechamento: null,
}
const variants = [{ label: 'A' }, { label: 'B' }] as unknown as FullChartVariant[]
const thumbs: VariantThumb[] = [
  { label: 'A', color: '#000', thumbUrl: null, isOriginal: true, titleText: 'Título A' },
  { label: 'B', color: '#111', thumbUrl: null, isOriginal: false, titleText: 'Título B' },
]
const monta = (testType: 'title' | 'thumbnail', inicio: string | null = null) =>
  render(<PlacarDoTeste placar={placarSemDia} variants={variants} variantDb={[]} thumbs={thumbs} faixaDias={[]} videoTitle="V" status="active" testType={testType} inicio={inicio} />)

describe('página do teste: ajustes (M7 T17)', () => {
  it('teste de título: nenhuma caixa de miniatura vazia; a linha usa a letra e o título', () => {
    const { container } = monta('title')
    expect(container.querySelectorAll('.pm4-th').length).toBe(0)
    expect(screen.getByText('Título A')).toBeTruthy()
  })
  it('teste de miniatura sem imagem: "Sem miniatura" escrito', () => {
    monta('thumbnail')
    expect(screen.getAllByText('Sem miniatura').length).toBe(2)
  })
  it('selo de tipo em português', () => {
    expect(TYPE_META.title.label).toBe('Título')
    expect(TYPE_META.thumbnail.label).toBe('Miniatura')
    expect(TYPE_META.combo.label).toBe('Título e miniatura')
  })
  it('tela v2 sem dia válido não promete 24 horas e usa o prazo único', () => {
    const s = lib('ab-gravacao/tela-v2.ts')
    expect(s).not.toContain('24 horas')
    expect(s).toContain('Ainda não decide: o YouTube ainda não fechou nenhum dia.')
    expect(s).toContain('O Lab confere uma vez por dia.')
  })
  it('placar sem dia gravado: início + 11 dias do Pacífico, nunca "10 dias"', () => {
    monta('title', '2026-10-20T15:00:00Z')
    expect(screen.getByText('O primeiro dia fecha até 31/10.')).toBeTruthy()
  })
  it('início 2026-10-27T02:30:00Z (dia do Pacífico 26/10) → 06/11, não 07/11', () => {
    expect(prazoDoPrimeiroDia(null, '2026-10-27T02:30:00Z')).toBe('O primeiro dia fecha até 06/11.')
  })
  it('proximo_fechamento tem prioridade', () => {
    expect(prazoDoPrimeiroDia('2026-11-02', '2026-10-27T02:30:00Z')).toBe('O primeiro dia fecha até 02/11.')
  })
  it('PRAZO_FECHAMENTO_DIAS é 11 e nenhum 11 literal resta em placar/decisao-v2', () => {
    expect(PRAZO_FECHAMENTO_DIAS).toBe(11)
    expect(lib('ab-gravacao/decisao-v2.ts')).not.toMatch(/addDays\(enc, 11\)/)
    expect(lib('ab-gravacao/placar.ts')).not.toMatch(/addDays\(minAguardando, 11\)/)
  })
  it('rotuloDoDia: 0→Dia 1/15, 14→Dia 15/15, 20→Dia 15/15, teto inválido → vazio', () => {
    expect(rotuloDoDia(0, 15)).toBe('Dia 1/15')
    expect(rotuloDoDia(14, 15)).toBe('Dia 15/15')
    expect(rotuloDoDia(20, 15)).toBe('Dia 15/15')
    expect(rotuloDoDia(3, 0)).toBe('')
  })
})
