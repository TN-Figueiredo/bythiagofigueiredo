// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { VariantMetadata } from '@/lib/youtube/ab-types'
import { VariantHeatmapTable } from '../../src/app/cms/(authed)/youtube/ab-lab/_components/variant-heatmap-table'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVariant(
  label: string,
  score?: Partial<{ thumbnail: number; title: number; combo: number }>,
): { label: string; metadata: VariantMetadata } {
  return {
    label,
    metadata: score ? { score: score as VariantMetadata['score'] } : {},
  }
}

function fullVariants() {
  return [
    makeVariant('B', { thumbnail: 8, title: 7, combo: 9 }),
    makeVariant('C', { thumbnail: 5, title: 6, combo: 4 }),
    makeVariant('D', { thumbnail: 3, title: 9, combo: 6 }),
  ]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VariantHeatmapTable', () => {
  it('renders 3 rows for variants B, C, D', () => {
    render(<VariantHeatmapTable variants={fullVariants()} />)

    const tbody = screen.getByRole('table').querySelector('tbody')
    expect(tbody).toBeTruthy()
    const rows = tbody!.querySelectorAll('tr')
    expect(rows).toHaveLength(3)

    expect(screen.getByText('B')).toBeTruthy()
    expect(screen.getByText('C')).toBeTruthy()
    expect(screen.getByText('D')).toBeTruthy()
  })

  it('renders 3 column headers: Thumb, Title, Combo', () => {
    render(<VariantHeatmapTable variants={fullVariants()} />)

    const headers = screen.getAllByRole('columnheader')
    // 4 headers total: Var + Thumb + Title + Combo
    expect(headers).toHaveLength(4)
    expect(headers[0].textContent).toBe('Var')
    expect(headers[1].textContent).toBe('Thumb')
    expect(headers[2].textContent).toBe('Title')
    expect(headers[3].textContent).toBe('Combo')
  })

  it('shows scores when metadata has score data', () => {
    render(<VariantHeatmapTable variants={fullVariants()} />)

    const tbody = screen.getByRole('table').querySelector('tbody')!
    const rows = tbody.querySelectorAll('tr')

    // Row B: 8, 7, 9 (label is <th>, scores are <td>)
    const bCells = rows[0].querySelectorAll('td')
    expect(bCells[0].textContent).toBe('8')
    expect(bCells[1].textContent).toBe('7')
    expect(bCells[2].textContent).toBe('9')

    // Row C: 5, 6, 4
    const cCells = rows[1].querySelectorAll('td')
    expect(cCells[0].textContent).toBe('5')
    expect(cCells[1].textContent).toBe('6')
    expect(cCells[2].textContent).toBe('4')

    // Row D: 3, 9, 6
    const dCells = rows[2].querySelectorAll('td')
    expect(dCells[0].textContent).toBe('3')
    expect(dCells[1].textContent).toBe('9')
    expect(dCells[2].textContent).toBe('6')
  })

  it('shows em-dash when variant has no score data', () => {
    const variants = [
      makeVariant('B'), // no score at all
      makeVariant('C'),
      makeVariant('D'),
    ]
    render(<VariantHeatmapTable variants={variants} />)

    // 3 variants x 3 columns = 9 em-dashes
    const dashes = screen.getAllByText('—')
    expect(dashes).toHaveLength(9)
  })

  it('applies indigo background intensity based on score value', () => {
    const variants = [makeVariant('B', { thumbnail: 10, title: 5, combo: 0 })]
    render(<VariantHeatmapTable variants={variants} />)

    const tbody = screen.getByRole('table').querySelector('tbody')!
    const cells = tbody.querySelectorAll('td')
    // cells: [label, thumbnail, title, combo]

    // thumbnail = 10 -> opacity = (10/10)*0.3 = 0.3
    const thumbCell = cells[0] as HTMLElement
    expect(thumbCell.style.backgroundColor).toBe('rgba(99, 102, 241, 0.3)')

    // title = 5 -> opacity = (5/10)*0.3 = 0.15
    const titleCell = cells[1] as HTMLElement
    expect(titleCell.style.backgroundColor).toBe('rgba(99, 102, 241, 0.15)')

    // combo = 0 -> opacity = (0/10)*0.3 = 0
    const comboCell = cells[2] as HTMLElement
    expect(comboCell.style.backgroundColor).toBe('rgba(99, 102, 241, 0)')
  })

  it('combo column has emphasized styling (bold, border)', () => {
    const variants = [makeVariant('B', { thumbnail: 5, title: 5, combo: 5 })]
    render(<VariantHeatmapTable variants={variants} />)

    // Check header
    const headers = screen.getAllByRole('columnheader')
    const comboHeader = headers[3]
    expect(comboHeader.className).toContain('border-l-2')
    expect(comboHeader.className).toContain('border-indigo-500/30')

    // Check data cell
    const tbody = screen.getByRole('table').querySelector('tbody')!
    const cells = tbody.querySelectorAll('td')
    const comboCell = cells[2]
    expect(comboCell.className).toContain('font-bold')
    expect(comboCell.className).toContain('border-l-2')
    expect(comboCell.className).toContain('border-indigo-500/30')
    expect(comboCell.className).toContain('text-lg')
  })

  it('renders variant labels with correct inline colors from ab-constants', () => {
    render(<VariantHeatmapTable variants={fullVariants()} />)

    const labelB = screen.getByText('B') as HTMLElement
    expect(labelB.style.color).toBe('#E8823C')

    const labelC = screen.getByText('C') as HTMLElement
    expect(labelC.style.color).toBe('#3FA9C0')

    const labelD = screen.getByText('D') as HTMLElement
    expect(labelD.style.color).toBe('#A77CE8')
  })

  it('handles empty variants array gracefully', () => {
    const { container } = render(<VariantHeatmapTable variants={[]} />)
    // Component returns null for empty filtered list
    expect(container.innerHTML).toBe('')
  })

  it('handles partial score data (only thumbnail, no title/combo)', () => {
    const variants = [
      makeVariant('B', { thumbnail: 7 } as { thumbnail: number; title: number; combo: number }),
    ]
    render(<VariantHeatmapTable variants={variants} />)

    // Thumbnail should render score
    expect(screen.getByText('7')).toBeTruthy()

    // Title and combo are undefined -> em-dash
    const dashes = screen.getAllByText('—')
    expect(dashes).toHaveLength(2)

    // Verify the thumbnail cell has background color
    const tbody = screen.getByRole('table').querySelector('tbody')!
    const cells = tbody.querySelectorAll('td')
    const thumbCell = cells[0] as HTMLElement
    expect(thumbCell.style.backgroundColor).toBe('rgba(99, 102, 241, 0.21)')
  })

  it('filters out non-variant labels like A or unknown labels', () => {
    const variants = [
      makeVariant('A', { thumbnail: 5, title: 5, combo: 5 }), // A is the original, not in VARIANT_LABELS
      makeVariant('B', { thumbnail: 8, title: 7, combo: 9 }),
      makeVariant('X', { thumbnail: 1, title: 1, combo: 1 }), // unknown
    ]
    render(<VariantHeatmapTable variants={variants} />)

    const tbody = screen.getByRole('table').querySelector('tbody')!
    const rows = tbody.querySelectorAll('tr')
    expect(rows).toHaveLength(1) // only B

    expect(screen.getByText('B')).toBeTruthy()
    expect(screen.queryByText('A')).toBeNull()
    expect(screen.queryByText('X')).toBeNull()
  })
})
