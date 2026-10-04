// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { BUILTIN_NICHES, NICHE_PALETTE, NICHE_SLUG_RE, RESERVED_NICHE_SLUGS, parseNiche, isNicheSlug, tabOrder, forjaOrder, nicheLabel, joinLabels, inNiche, type NicheDef } from '@/lib/youtube/observatorio/niche'

const def = (id: string, label: string, order: number): NicheDef => ({ id, label, color: { dark: '#D29AE8', light: '#7B2A91' }, order, builtin: false })
const jogos = def('jogos', 'Jogos', 30), pessoal = def('pessoal', 'Pessoal', 30)

describe('niche — nicho como dado', () => {
  it('parseNiche só olha a forma: todos, um de fábrica, um criado pelo dono', () => {
    expect(parseNiche('todos')).toBe('todos')
    expect(parseNiche('viagem')).toBe('viagem')
    expect(parseNiche('jogos')).toBe('jogos')
    expect(parseNiche('cortes-de-viagem')).toBe('cortes-de-viagem')
  })
  it.each([['Não Vale'], [''], [null], [undefined], ['a'], ['-jogos'], ['jogos-'], ['all'], ['sem'], ['none'], ['x'.repeat(25)]])('parseNiche(%j) → null', raw => {
    expect(parseNiche(raw)).toBeNull()
  })
  it("isNicheSlug recusa 'todos' (é escopo, não nicho) e os reservados", () => {
    expect(isNicheSlug('todos')).toBe(false)
    expect(isNicheSlug('ia')).toBe(true)
    expect(isNicheSlug(7)).toBe(false)
    expect([...RESERVED_NICHE_SLUGS].sort()).toEqual(['all', 'none', 'sem', 'todos'])
    expect(NICHE_SLUG_RE.test('cortes-de-viagem')).toBe(true)
  })
  it('os de fábrica: Viagem (10) e IA (20), com as cores de hoje', () => {
    expect(BUILTIN_NICHES).toEqual([
      { id: 'viagem', label: 'Viagem', color: { dark: '#5BBF8A', light: '#11692F' }, order: 10, builtin: true },
      { id: 'ia', label: 'IA', color: { dark: '#6EA8FE', light: '#1D4ED8' }, order: 20, builtin: true },
    ])
  })
  it('a paleta dos nichos criados tem as QUATRO cores aprovadas (as do CHECK da migration)', () => {
    expect(NICHE_PALETTE).toEqual([
      { id: 'ameixa', dark: '#D29AE8', light: '#7B2A91' }, { id: 'rosa', dark: '#F293C2', light: '#A3216B' },
      { id: 'lima', dark: '#B9CB62', light: '#55650B' }, { id: 'ardosia', dark: '#AAB4C0', light: '#4B5563' },
    ])
  })
  it('tabOrder: por order, desempate por slug; a entrada fora de ordem não muda o resultado', () => {
    expect(tabOrder(BUILTIN_NICHES)).toEqual(['viagem', 'ia'])
    expect(tabOrder([pessoal, ...[...BUILTIN_NICHES].reverse(), jogos])).toEqual(['viagem', 'ia', 'jogos', 'pessoal'])
    expect(tabOrder([])).toEqual([])
  })
  it('forjaOrder: IA, Viagem, depois os demais na ordem das abas', () => {
    expect(forjaOrder(BUILTIN_NICHES)).toEqual(['ia', 'viagem'])
    expect(forjaOrder([...BUILTIN_NICHES, pessoal, jogos])).toEqual(['ia', 'viagem', 'jogos', 'pessoal'])
    // um site sem um dos de fábrica não o inventa
    expect(forjaOrder([BUILTIN_NICHES[0]!, jogos])).toEqual(['viagem', 'jogos'])
  })
  it('nicheLabel: o rótulo; o próprio slug quando o nicho não existe mais (nunca lança)', () => {
    expect(nicheLabel(BUILTIN_NICHES, 'ia')).toBe('IA')
    expect(nicheLabel([...BUILTIN_NICHES, jogos], 'jogos')).toBe('Jogos')
    expect(nicheLabel(BUILTIN_NICHES, 'sumiu')).toBe('sumiu')
    expect(nicheLabel([], 'sumiu')).toBe('sumiu')
  })
  it('joinLabels: "A e B" com dois (como hoje), "A, B e C" com três', () => {
    expect(joinLabels([])).toBe('')
    expect(joinLabels(['IA'])).toBe('IA')
    expect(joinLabels(['Viagem', 'IA'])).toBe('Viagem e IA')
    expect(joinLabels(['IA', 'Viagem', 'Jogos'])).toBe('IA, Viagem e Jogos')
  })
  it('inNiche não mudou', () => {
    expect(inNiche('todos', { niche: null })).toBe(true)
    expect(inNiche('jogos', { niche: 'jogos' })).toBe(true)
    expect(inNiche('jogos', { niche: 'ia' })).toBe(false)
  })
})
