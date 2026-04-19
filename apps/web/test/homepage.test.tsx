import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Home from '../src/app/(public)/page'

describe('homepage', () => {
  it('renders PinboardHome', async () => {
    const el = await Home({ searchParams: Promise.resolve({}) })
    const { getByTestId } = render(el)
    expect(getByTestId('pinboard-home')).toBeTruthy()
  })

  it('does NOT render the insufficient_access banner when no error param', async () => {
    const el = await Home({ searchParams: Promise.resolve({}) })
    const { queryByTestId } = render(el)
    expect(queryByTestId('insufficient-access-banner')).toBeNull()
  })

  it('does NOT render banner when error param is something else', async () => {
    const el = await Home({ searchParams: Promise.resolve({ error: 'other' }) })
    const { queryByTestId } = render(el)
    expect(queryByTestId('insufficient-access-banner')).toBeNull()
  })

  it('renders the insufficient_access banner when ?error=insufficient_access', async () => {
    const el = await Home({
      searchParams: Promise.resolve({ error: 'insufficient_access' }),
    })
    const { getByTestId, getByRole } = render(el)
    const banner = getByTestId('insufficient-access-banner')
    expect(banner).toBeTruthy()
    // role="alert" with aria-live makes it accessible to screen readers
    expect(getByRole('alert')).toBeTruthy()
    expect(banner.textContent).toMatch(/acesso/i)
  })
})
