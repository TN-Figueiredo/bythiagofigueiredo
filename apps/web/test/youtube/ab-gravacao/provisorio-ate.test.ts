import { describe, it, expect } from 'vitest'
import { provisorioAte } from '@/lib/youtube/ab-gravacao/decisao-v2'

describe('provisorioAte (S8-F4 T12 T1)', () => {
  it('encerrado em 24/10 => provisório até 04/11 (o mockup)', () => {
    expect(provisorioAte('2026-10-24')).toBe('2026-11-04')
  })
  it('virada de mês e de ano', () => {
    expect(provisorioAte('2026-10-25')).toBe('2026-11-05')
    expect(provisorioAte('2026-12-25')).toBe('2027-01-05')
  })
})
