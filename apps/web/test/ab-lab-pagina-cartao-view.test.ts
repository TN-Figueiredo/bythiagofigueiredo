// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { toCardView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { makeTestWithVariants } from './helpers/ab-fixtures'

function fixture(o: { test_type?: 'thumbnail' | 'title' | 'combo'; original_title?: string | null; name?: string; restore_seq?: number; variants?: Array<{ id: string; label: string; is_original: boolean; title_text: string | null }> } = {}) {
  const t = makeTestWithVariants()
  if (o.test_type) t.test_type = o.test_type
  if (o.original_title !== undefined) t.original_title = o.original_title
  if (o.name) t.name = o.name
  if (o.restore_seq !== undefined) t.restore_seq = o.restore_seq
  if (o.variants) {
    t.variants = o.variants.map((v, i) => ({ ...t.variants[0]!, id: v.id, label: v.label, is_original: v.is_original, title_text: v.title_text, sort_order: i }))
  }
  return t
}

describe('toCardView: títulos das versões', () => {
  it('leva title_text de cada versão; a original cai no original_title', () => {
    const v = toCardView(fixture({
      test_type: 'title', original_title: 'Main AD Diamante 2 - Lolzin raiz!', restore_seq: 3,
      variants: [
        { id: 'va', label: 'original', is_original: true, title_text: null },
        { id: 'vb', label: 'B', is_original: false, title_text: 'Main AD no Diamante 2: partida comentada (LoL raiz)' },
      ],
    }))
    expect(v.variants.map(x => [x.id, x.label, x.title, x.isOriginal])).toEqual([
      ['va', 'A', 'Main AD Diamante 2 - Lolzin raiz!', true],
      ['vb', 'B', 'Main AD no Diamante 2: partida comentada (LoL raiz)', false],
    ])
    expect(v.restoreSeq).toBe(3)
    expect(v.videoTitle).toBe('Main AD Diamante 2 - Lolzin raiz!')
  })
  it('miniatura: versão não original sem title_text tem title nulo', () => {
    const v = toCardView(fixture({ original_title: 'X', variants: [
      { id: 'va', label: 'original', is_original: true, title_text: null },
      { id: 'vb', label: 'B', is_original: false, title_text: null },
    ] }))
    expect(v.variants[1]!.title).toBeNull()
  })
  it('sem original_title: videoTitle cai no name e a original tem title nulo; restoreSeq padrão 0', () => {
    const v = toCardView(fixture({ original_title: null, name: 'Nome do teste' }))
    expect(v.videoTitle).toBe('Nome do teste')
    expect(v.variants[0]!.title).toBeNull()
    expect(v.restoreSeq).toBe(0)
  })
})
