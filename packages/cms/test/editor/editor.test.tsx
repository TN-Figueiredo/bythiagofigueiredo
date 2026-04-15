import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { PostEditor } from '../../src/editor/editor'

describe('PostEditor', () => {
  it('calls onSave with content on Salvar click', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true })
    const onPreview = vi.fn().mockResolvedValue({ compiledSource: '', toc: [], readingTimeMin: 1 })
    render(
      <PostEditor
        initialContent="# Hello"
        locale="pt-BR"
        componentNames={[]}
        onSave={onSave}
        onPreview={onPreview}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0]![0].content_mdx).toBe('# Hello')
  })

  it('inserts bold marker when toolbar B is clicked', () => {
    const onSave = vi.fn()
    const onPreview = vi.fn().mockResolvedValue({ compiledSource: '', toc: [], readingTimeMin: 1 })
    render(
      <PostEditor
        initialContent=""
        locale="pt-BR"
        componentNames={[]}
        onSave={onSave}
        onPreview={onPreview}
      />
    )
    const ta = screen.getByRole('textbox', { name: /content/i }) as HTMLTextAreaElement
    ta.focus()
    fireEvent.click(screen.getByRole('button', { name: /bold/i }))
    expect(ta.value).toContain('**')
  })
})
