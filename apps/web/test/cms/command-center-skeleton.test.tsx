// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

/* ------------------------------------------------------------------ */
/*  Import                                                            */
/* ------------------------------------------------------------------ */

import { CommandCenterSkeleton } from '../../src/app/cms/(authed)/pipeline/_components/command-center-skeleton'

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('CommandCenterSkeleton', () => {
  it('renders with aria-busy="true"', () => {
    const { container } = render(<CommandCenterSkeleton />)

    const skeleton = container.firstElementChild as HTMLElement
    expect(skeleton.getAttribute('aria-busy')).toBe('true')
  })

  it('has aria-label', () => {
    const { container } = render(<CommandCenterSkeleton />)

    const skeleton = container.firstElementChild as HTMLElement
    expect(skeleton.getAttribute('aria-label')).toBe('Carregando command center')
  })

  it('contains skeleton pulse elements', () => {
    const { container } = render(<CommandCenterSkeleton />)

    const pulseElements = container.querySelectorAll('.motion-safe\\:animate-pulse')
    // The component has many Pulse elements: 2 top + 1 bar + 2 grid + 1 full +
    // 7 headers + 7 cards in week grid + 3 list items + 3 dots = 26
    expect(pulseElements.length).toBeGreaterThan(10)
  })

  it('renders 7 day columns for the week grid', () => {
    const { container } = render(<CommandCenterSkeleton />)

    // The grid has 7 columns, each with border-r class
    const weekGrid = container.querySelector('.grid-cols-7')
    expect(weekGrid).toBeTruthy()
    expect(weekGrid!.children).toHaveLength(7)
  })
})
