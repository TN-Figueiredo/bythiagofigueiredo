import { describe, it, expect } from 'vitest'
import { ptBR } from '@/app/cms/(authed)/social/_i18n/pt-BR'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return flatKeys(value as Record<string, unknown>, fullKey)
    }
    return [fullKey]
  })
}

describe('social i18n completeness', () => {
  it('pt-BR and en have identical key sets', () => {
    const ptKeys = flatKeys(ptBR as Record<string, unknown>).sort()
    const enKeys = flatKeys(en as Record<string, unknown>).sort()

    const missingInEn = ptKeys.filter(k => !enKeys.includes(k))
    const missingInPt = enKeys.filter(k => !ptKeys.includes(k))

    expect(missingInEn, 'Keys missing in en').toEqual([])
    expect(missingInPt, 'Keys missing in pt-BR').toEqual([])
  })
})
