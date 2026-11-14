// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '@/app/cms/(authed)/_shared/cms-sections'

const itens = (s: ReturnType<typeof buildCmsSections>) => s.flatMap((x) => x.items)

describe('buildCmsSections conectarIa', () => {
  it('sem opção: nenhum item novo e a lista é a de hoje', () => {
    const base = itens(buildCmsSections()).map((i) => i.href)
    expect(base).not.toContain('/cms/conectar-ia')
    expect(itens(buildCmsSections({})).map((i) => i.href)).toEqual(base)
    expect(itens(buildCmsSections({ conectarIa: false })).map((i) => i.href)).toEqual(base)
  })
  it('com opção: item logo depois de Competitors, sem minRole', () => {
    const base = itens(buildCmsSections()).map((i) => i.href)
    const com = itens(buildCmsSections({ conectarIa: true }))
    const hrefs = com.map((i) => i.href)
    const i = hrefs.indexOf('/cms/youtube/competitors')
    expect(hrefs[i + 1]).toBe('/cms/conectar-ia')
    expect(com[i + 1]!.label).toBe('Conectar sua IA')
    expect((com[i + 1] as { minRole?: string }).minRole).toBeUndefined()
    expect(hrefs.filter((h) => h !== '/cms/conectar-ia')).toEqual(base)
  })
})
