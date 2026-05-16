import { describe, it, expect, vi, afterEach } from 'vitest'
import { getGreeting, formatTodayLabel } from '../../src/app/cms/(authed)/_components/dashboard-greeting'

describe('dashboard-greeting', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getGreeting', () => {
    it('returns "Bom dia" at 05:00', () => {
      // Mock a time that is 05:00 in America/Sao_Paulo (UTC-3 → 08:00 UTC)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-16T08:00:00Z'))

      const result = getGreeting('America/Sao_Paulo')
      expect(result.text).toBe('Bom dia')
      expect(result.period).toBe('morning')
    })

    it('returns "Bom dia" at 11:00', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-16T14:00:00Z')) // 11:00 SP

      const result = getGreeting('America/Sao_Paulo')
      expect(result.text).toBe('Bom dia')
      expect(result.period).toBe('morning')
    })

    it('returns "Boa tarde" at 12:00', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-16T15:00:00Z')) // 12:00 SP

      const result = getGreeting('America/Sao_Paulo')
      expect(result.text).toBe('Boa tarde')
      expect(result.period).toBe('afternoon')
    })

    it('returns "Boa tarde" at 17:00', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-16T20:00:00Z')) // 17:00 SP

      const result = getGreeting('America/Sao_Paulo')
      expect(result.text).toBe('Boa tarde')
      expect(result.period).toBe('afternoon')
    })

    it('returns "Boa noite" at 18:00', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-16T21:00:00Z')) // 18:00 SP

      const result = getGreeting('America/Sao_Paulo')
      expect(result.text).toBe('Boa noite')
      expect(result.period).toBe('evening')
    })

    it('returns "Boa noite" at 04:00 (early morning)', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-16T07:00:00Z')) // 04:00 SP

      const result = getGreeting('America/Sao_Paulo')
      expect(result.text).toBe('Boa noite')
      expect(result.period).toBe('evening')
    })

    it('returns "Boa noite" at 23:00', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-17T02:00:00Z')) // 23:00 SP

      const result = getGreeting('America/Sao_Paulo')
      expect(result.text).toBe('Boa noite')
      expect(result.period).toBe('evening')
    })

    it('works with a different timezone (Europe/London)', () => {
      vi.useFakeTimers()
      // 12:00 UTC = 13:00 BST (summer) → Boa tarde
      vi.setSystemTime(new Date('2026-05-16T12:00:00Z'))

      const result = getGreeting('Europe/London')
      expect(result.text).toBe('Boa tarde')
    })
  })

  describe('formatTodayLabel', () => {
    it('returns a Portuguese date string', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-16T15:00:00Z')) // Friday in SP

      const label = formatTodayLabel('America/Sao_Paulo')
      // Should contain Portuguese weekday and month
      expect(label).toContain('maio')
      expect(label).toContain('16')
    })

    it('returns lowercase weekday', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-16T15:00:00Z'))

      const label = formatTodayLabel('America/Sao_Paulo')
      // pt-BR weekdays are lowercase
      expect(label).toMatch(/^[a-záéíóúãõâêô]/)
    })
  })
})
