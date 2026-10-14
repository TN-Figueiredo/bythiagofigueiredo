// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DetailHeader } from '../../src/app/cms/(authed)/youtube/ab-lab/_components/detail-header'
import { LockCountdown } from '../../src/app/cms/(authed)/youtube/ab-lab/_components/lock-countdown'

describe('detalhe a 390 px', () => {
  it('fileira de ações quebra linha e não empurra para fora', () => {
    const { container } = render(
      <DetailHeader title="t" flag="title" status="active" roundNumber={1} totalRounds={1}
        hasPlayoff={false} actions={<button type="button">Pausar</button>} />,
    )
    const bar = container.querySelector('button')!.parentElement!
    expect(bar.className).toContain('flex-wrap')
    expect(bar.className).not.toContain('flex-nowrap')
    expect(bar.className).not.toContain('justify-end')
  })
  it('prazo empilha no mobile e sem nowrap', () => {
    const { container } = render(
      <LockCountdown dayOf={1} durationDays={7} confidence={0} confidenceTarget={95} cyclesCompleted={0} />,
    )
    const row = container.querySelector('span.font-semibold')!.parentElement!
    expect(row.className).toContain('flex-col')
    expect(row.className).toContain('min-[480px]:flex-row')
    expect(container.innerHTML).not.toContain('whitespace-nowrap')
    expect(container.innerHTML).not.toContain('nowrap')
  })
})
