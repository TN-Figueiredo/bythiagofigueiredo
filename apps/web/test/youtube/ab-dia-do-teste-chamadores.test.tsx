// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { toCardView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { diaDoTeste } from '@/lib/youtube/ab-dia-do-teste'
import { makeTestWithVariants } from '../helpers/ab-fixtures'

describe('dia do teste: lista e view do cartão usam a mesma conta', () => {
  it('mesmo número e duração prevista vinda da config', () => {
    const base = makeTestWithVariants({ startedDaysAgo: 3 })
    const t = { ...base, config: { ...base.config, max_duration_days: 21 } }
    const view = toCardView(t)
    expect(view.dayOf).toBe(diaDoTeste(t.started_at, t.completed_at, new Date()))
  })
  it('sem config usa 14 e não encolhe abaixo do dia atual', () => {
    const view = toCardView(makeTestWithVariants({ startedDaysAgo: 16 }))
    expect(view.dayOf).toBe(16)
  })
})
