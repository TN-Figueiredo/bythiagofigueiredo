// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'

import { Pagination } from '@/app/cms/(authed)/links/_components/pagination'

afterEach(() => cleanup())

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders page buttons for multi-page', () => {
    const { container } = render(<Pagination page={1} totalPages={5} onChange={() => {}} />)
    expect(container.querySelector('nav')).toBeTruthy()
    expect(container.textContent).toContain('1')
    expect(container.textContent).toContain('5')
  })

  it('highlights current page with aria-current', () => {
    const { container } = render(<Pagination page={3} totalPages={5} onChange={() => {}} />)
    const current = container.querySelector('[aria-current="page"]')
    expect(current?.textContent).toBe('3')
  })

  it('calls onChange when page clicked', () => {
    const onChange = vi.fn()
    const { getByText } = render(<Pagination page={1} totalPages={5} onChange={onChange} />)
    fireEvent.click(getByText('3'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('disables previous button on first page', () => {
    const { container } = render(<Pagination page={1} totalPages={5} onChange={() => {}} />)
    const prev = container.querySelector('[aria-label="Pagina anterior"]')
    expect(prev?.hasAttribute('disabled')).toBe(true)
  })

  it('disables next button on last page', () => {
    const { container } = render(<Pagination page={5} totalPages={5} onChange={() => {}} />)
    const next = container.querySelector('[aria-label="Proxima pagina"]')
    expect(next?.hasAttribute('disabled')).toBe(true)
  })

  it('has accessible nav landmark', () => {
    const { container } = render(<Pagination page={1} totalPages={3} onChange={() => {}} />)
    const nav = container.querySelector('nav[aria-label]')
    expect(nav).toBeTruthy()
  })
})
