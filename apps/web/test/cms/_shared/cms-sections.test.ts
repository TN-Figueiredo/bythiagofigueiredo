import { describe, it, expect } from 'vitest'
import { buildCmsSections } from '../../../src/app/cms/(authed)/_shared/cms-sections'

describe('buildCmsSections — redesign', () => {
  const sections = buildCmsSections()

  it('has no section labelled Insights', () => {
    expect(sections.find(s => s.label === 'Insights')).toBeUndefined()
  })

  it('Overview section has Analytics as third item', () => {
    const overview = sections.find(s => s.label === 'Overview')!
    expect(overview).toBeDefined()
    expect(overview.items[2]).toBeDefined()
    expect(overview.items[2].label).toBe('Analytics')
    expect(overview.items[2].href).toBe('/cms/analytics')
  })

  it('Overview still has Dashboard at index 0 and Schedule at index 1', () => {
    const overview = sections.find(s => s.label === 'Overview')!
    expect(overview.items[0].href).toBe('/cms')
    expect(overview.items[1].href).toBe('/cms/schedule')
  })

  it('total section count is 4', () => {
    expect(sections.length).toBe(4)
  })
})
