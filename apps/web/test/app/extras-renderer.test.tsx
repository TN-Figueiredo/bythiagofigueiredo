import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ExtrasRenderer } from '../../src/app/(public)/campaigns/[locale]/[slug]/extras-renderer'

describe('<ExtrasRenderer>', () => {
  it('renders a youtube iframe with embed URL', () => {
    const { container } = render(
      <ExtrasRenderer extras={[{ kind: 'youtube', videoId: 'abc', title: 'T' }]} />,
    )
    const iframe = container.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe?.getAttribute('src')).toMatch(/\/embed\/abc/)
  })
})
