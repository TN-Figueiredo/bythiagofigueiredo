// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'

afterEach(cleanup)

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/pipeline/gem-design', () => ({
  getFormatIcon: (_format: string) => ({ icon: '✍️', bgClass: 'bg-amber-500/10', label: 'Blog' }),
  getPriorityConfig: (_priority: number) => ({
    accent: '#0ea5e9',
    accentDim: 'rgba(14,165,233,0.1)',
    accentBorder: 'rgba(14,165,233,0.3)',
    label: 'P2',
    className: 'priority-2',
  }),
  getLangConfig: (language: string) => {
    if (language === 'pt-br') return { label: 'PT', className: 'bg-green-900/50 text-green-300' }
    if (language === 'en') return { label: 'EN', className: 'bg-blue-900/50 text-blue-300' }
    return { label: 'PT+EN', className: 'bg-indigo-900/50 text-indigo-300' }
  },
}))

import { PipelineSearchInput } from '../../../src/app/cms/(authed)/blog/_shared/pipeline-search-input'
import type { PipelineSearchResult } from '../../../src/app/cms/(authed)/blog/actions'

const mockResults: PipelineSearchResult[] = [
  {
    id: '1',
    code: 'tg-01',
    title: 'AI Empire',
    format: 'blog_post',
    stage: 'ideia',
    language: 'pt-br',
    priority: 2,
    hook: 'Um mapa do que estou construindo',
    blog_post_id: null,
    linked_post_title: null,
  },
  {
    id: '2',
    code: 'tg-02',
    title: 'Hacking',
    format: 'blog_post',
    stage: 'rascunho',
    language: 'pt-br',
    priority: 3,
    hook: null,
    blog_post_id: 'post-99',
    linked_post_title: 'Meu Primeiro Contato com Hacking',
  },
]

describe('PipelineSearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders search input with placeholder', () => {
    const onSearch = vi.fn().mockResolvedValue([])
    const onSelect = vi.fn()

    const { getByPlaceholderText } = render(
      <PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="create" />,
    )

    expect(getByPlaceholderText('Criar do pipeline... (código ou título)')).toBeDefined()
  })

  it('calls onSearch after typing 2+ chars', async () => {
    const onSearch = vi.fn().mockResolvedValue(mockResults)
    const onSelect = vi.fn()

    const { getByRole } = render(
      <PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="select" />,
    )

    const input = getByRole('combobox')
    fireEvent.change(input, { target: { value: 'tg' } })

    await act(async () => {
      vi.advanceTimersByTime(350)
      await Promise.resolve()
    })

    expect(onSearch).toHaveBeenCalledWith('tg')
  })

  it('does not call onSearch with less than 2 chars', async () => {
    const onSearch = vi.fn().mockResolvedValue([])
    const onSelect = vi.fn()

    const { getByRole } = render(
      <PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="create" />,
    )

    const input = getByRole('combobox')
    fireEvent.change(input, { target: { value: 't' } })

    await act(async () => {
      vi.advanceTimersByTime(350)
      await Promise.resolve()
    })

    expect(onSearch).not.toHaveBeenCalled()
  })

  it('shows linked items as disabled', async () => {
    const onSearch = vi.fn().mockResolvedValue(mockResults)
    const onSelect = vi.fn()

    const { getByRole, container } = render(
      <PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="create" />,
    )

    const input = getByRole('combobox')
    fireEvent.change(input, { target: { value: 'tg' } })

    await act(async () => {
      vi.advanceTimersByTime(350)
      await Promise.resolve()
    })

    expect(container.textContent).toContain('vinculado a')
  })

  it('calls onSelect with item when available result is clicked', async () => {
    const onSearch = vi.fn().mockResolvedValue(mockResults)
    const onSelect = vi.fn()

    const { getByRole, getByText } = render(
      <PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="create" />,
    )

    const input = getByRole('combobox')
    fireEvent.change(input, { target: { value: 'tg' } })

    await act(async () => {
      vi.advanceTimersByTime(350)
      await Promise.resolve()
    })

    fireEvent.mouseDown(getByText('AI Empire'))

    expect(onSelect).toHaveBeenCalledWith(mockResults[0])
  })

  it('shows empty state when no results', async () => {
    const onSearch = vi.fn().mockResolvedValue([])
    const onSelect = vi.fn()

    const { getByRole, getByText } = render(
      <PipelineSearchInput onSearch={onSearch} onSelect={onSelect} mode="create" />,
    )

    const input = getByRole('combobox')
    fireEvent.change(input, { target: { value: 'xyz' } })

    await act(async () => {
      vi.advanceTimersByTime(350)
      await Promise.resolve()
    })

    expect(getByText('Nenhum item encontrado')).toBeDefined()
  })
})
