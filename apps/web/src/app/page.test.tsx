import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Home from './page'

describe('Home', () => {
  it('renders the hero heading', () => {
    const { container } = render(<Home />)
    expect(container.querySelector('h1')?.textContent).toContain('Thiago')
  })
})
