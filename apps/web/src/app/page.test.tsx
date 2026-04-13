import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Home from './page'

describe('Home (creator hub)', () => {
  it('renders the build in public headline', () => {
    const { container } = render(<Home />)
    expect(container.querySelector('h1')?.textContent).toContain('Build in public')
  })
})
