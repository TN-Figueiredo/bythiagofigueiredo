// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

// The component lives inside (authed), a parenthesized route group.
// Mock all @/ imports that the component uses so the test resolves correctly.
vi.mock('@/lib/pipeline/gem-design', () => ({
  getFormatIcon: vi.fn((f: string) => ({ icon: `[${f}]`, bgClass: '', label: f })),
  gemMix: vi.fn((color: string, pct: number) => `rgba(0,0,0,${pct / 100})`),
}))

vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns')
  return { ...actual as object }
})

/* ------------------------------------------------------------------ */
/*  Import (relative path — avoids @/ alias issues with parenthesized dirs) */
/* ------------------------------------------------------------------ */

import {
  UpNextCelebration,
  type CelebrationItem,
} from '../../src/app/cms/(authed)/pipeline/_components/up-next-celebration'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeItem(overrides: Partial<CelebrationItem> = {}): CelebrationItem {
  return {
    id: '1',
    code: 'G1-test',
    title_pt: 'Test Item',
    format: 'video',
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('UpNextCelebration', () => {
  it('returns null when items is empty', () => {
    const { container } = render(<UpNextCelebration items={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the week count text for a single item', () => {
    render(<UpNextCelebration items={[makeItem()]} />)

    expect(screen.getByTestId('celebration-banner')).toBeTruthy()
    expect(screen.getByText(/1 item publicado\./)).toBeTruthy()
  })

  it('renders plural text for multiple items', () => {
    const items = [
      makeItem({ id: '1', format: 'video' }),
      makeItem({ id: '2', format: 'blog_post' }),
      makeItem({ id: '3', format: 'newsletter' }),
    ]
    render(<UpNextCelebration items={items} />)

    expect(screen.getByText(/3 itens publicados\./)).toBeTruthy()
  })

  it('shows format icons for each item', () => {
    const items = [
      makeItem({ id: '1', format: 'video' }),
      makeItem({ id: '2', format: 'blog_post' }),
    ]
    render(<UpNextCelebration items={items} />)

    const iconsContainer = screen.getByTestId('celebration-icons')
    expect(iconsContainer.textContent).toContain('[video]')
    expect(iconsContainer.textContent).toContain('[blog_post]')
  })

  it('uses item code as title fallback when title_pt is null', () => {
    render(
      <UpNextCelebration
        items={[makeItem({ id: '1', title_pt: null, code: 'G5-fallback' })]}
      />,
    )

    const icon = screen.getByTitle('G5-fallback')
    expect(icon).toBeTruthy()
  })

  it('shows dismiss button', () => {
    render(<UpNextCelebration items={[makeItem()]} />)
    expect(screen.getByTestId('celebration-dismiss')).toBeTruthy()
  })

  it('hides after dismiss click', () => {
    render(<UpNextCelebration items={[makeItem()]} />)
    fireEvent.click(screen.getByTestId('celebration-dismiss'))
    expect(screen.queryByTestId('celebration-banner')).toBeNull()
  })
})
