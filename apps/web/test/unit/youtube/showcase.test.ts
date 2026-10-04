// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { byRegistration, showcaseChannels, showcaseChannelId } from '@/lib/youtube/showcase'

const ch = (id: string, locale: string, created_at?: string | null) => ({ id, locale, created_at })

describe('showcase (regra de transição do site público)', () => {
  it('lista vazia: nada e id nulo', () => {
    expect(showcaseChannels([])).toEqual([])
    expect(showcaseChannelId([], 'pt')).toBeNull()
  })

  it('PT + EN: os dois, em ordem en, pt', () => {
    const rows = [ch('a', 'pt', '2024-01-01T00:00:00Z'), ch('b', 'en', '2025-01-01T00:00:00Z')]
    expect(showcaseChannels(rows).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('terceiro canal PT não entra', () => {
    const rows = [
      ch('a', 'pt', '2024-01-01T00:00:00Z'),
      ch('b', 'en', '2025-01-01T00:00:00Z'),
      ch('c', 'pt', '2026-01-01T00:00:00Z'),
    ]
    expect(showcaseChannels(rows).map((r) => r.id)).toEqual(['b', 'a'])
    expect(showcaseChannelId(rows, 'pt')).toBe('a')
    expect(showcaseChannelId(rows, 'en')).toBe('b')
  })

  it('três PT e nenhum EN: um canal; EN é nulo', () => {
    const rows = [ch('a', 'pt', '2024-01-01T00:00:00Z'), ch('b', 'pt', '2025-01-01T00:00:00Z'), ch('c', 'pt', '2026-01-01T00:00:00Z')]
    expect(showcaseChannels(rows).map((r) => r.id)).toEqual(['a'])
    expect(showcaseChannelId(rows, 'en')).toBeNull()
  })

  it('empate de created_at: menor id vence, independente da ordem de entrada', () => {
    const rows = [ch('b', 'pt', '2024-01-01T00:00:00Z'), ch('a', 'pt', '2024-01-01T00:00:00Z')]
    expect(showcaseChannels(rows).map((r) => r.id)).toEqual(['a'])
    expect(showcaseChannels([...rows].reverse()).map((r) => r.id)).toEqual(['a'])
  })

  it('created_at ausente ou inválido vai para o fim, sem lançar', () => {
    const rows = [ch('a', 'pt', null), ch('b', 'pt', 'lixo'), ch('c', 'pt', '2020-01-01T00:00:00Z'), ch('d', 'pt')]
    expect(byRegistration(rows).map((r) => r.id)).toEqual(['c', 'a', 'b', 'd'])
    expect(showcaseChannelId(rows, 'pt')).toBe('c')
  })

  it('não muta a entrada', () => {
    const rows = [ch('b', 'pt', '2025-01-01T00:00:00Z'), ch('a', 'pt', '2024-01-01T00:00:00Z')]
    byRegistration(rows)
    expect(rows.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('removido o PT mais antigo, o seguinte assume', () => {
    const rows = [ch('a', 'pt', '2024-01-01T00:00:00Z'), ch('c', 'pt', '2026-01-01T00:00:00Z')]
    expect(showcaseChannelId(rows.slice(1), 'pt')).toBe('c')
  })
})
