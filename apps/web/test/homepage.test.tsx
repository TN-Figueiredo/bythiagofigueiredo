import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Home from '../src/app/(public)/page'

describe('homepage', () => {
  it('renders hero headline', () => {
    const { container } = render(<Home />)
    expect(container.querySelector('h2')).toBeTruthy()
  })
})
