import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ScrollProvider, useScrollState } from '../../../src/components/blog/scroll-context'

function ScrollConsumer() {
  const { progress, activeSection, visible } = useScrollState()
  return <div data-testid="state">{JSON.stringify({ progress, activeSection, visible })}</div>
}

describe('ScrollProvider', () => {
  it('provides default scroll state', () => {
    const sections = [{ slug: 'intro', text: 'Intro', depth: 2 as const }]
    const { getByTestId } = render(
      <ScrollProvider sections={sections}><ScrollConsumer /></ScrollProvider>,
    )
    const state = JSON.parse(getByTestId('state').textContent!)
    expect(state.progress).toBe(0)
    expect(state.activeSection).toBeNull()
    expect(state.visible).toBe(false)
  })

  it('renders children', () => {
    const { container } = render(
      <ScrollProvider sections={[]}><div>child content</div></ScrollProvider>,
    )
    expect(container.textContent).toContain('child content')
  })

  it('exposes sectionProgress as empty map by default', () => {
    function SectionProgressConsumer() {
      const { sectionProgress } = useScrollState()
      return <div data-testid="sp">{sectionProgress.size}</div>
    }
    const { getByTestId } = render(
      <ScrollProvider sections={[]}><SectionProgressConsumer /></ScrollProvider>,
    )
    expect(getByTestId('sp').textContent).toBe('0')
  })
})
