import { describe, it, expect } from 'vitest'
import { oneEmbed } from '@/lib/supabase/one-embed'

describe('oneEmbed', () => {
  it('devolve o objeto quando o embed to-one vem como objeto', () => {
    const row = { video_id: 'v1' }
    expect(oneEmbed(row)).toEqual(row)
  })
  it('desembrulha o primeiro item quando vem como array', () => {
    expect(oneEmbed([{ video_id: 'v1' }, { video_id: 'v2' }])).toEqual({ video_id: 'v1' })
  })
  it('devolve null para null, undefined e array vazio', () => {
    expect(oneEmbed(null)).toBeNull()
    expect(oneEmbed(undefined)).toBeNull()
    expect(oneEmbed([])).toBeNull()
  })
})
