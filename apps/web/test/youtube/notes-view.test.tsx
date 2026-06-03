import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotesView, NoteEntry } from '@/app/cms/(authed)/youtube/analytics/_components/notes-view'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/youtube/format', () => ({ fmtRelative: (d: string) => `rel:${d}` }))

import { toast } from 'sonner'

const CHANNEL = 'UCxyz'

function makeNote(overrides: Partial<NoteEntry> & { id: string }): NoteEntry {
  return {
    author: 'Thiago',
    text: 'Bom desempenho esta semana',
    timestamp: '2026-06-01T12:00:00Z',
    isBot: false,
    ...overrides,
  }
}

const SAMPLE_NOTES: NoteEntry[] = [
  makeNote({ id: '1', author: 'Thiago', text: 'Primeira nota' }),
  makeNote({ id: '2', author: 'Ana', text: 'Segunda nota', isBot: false }),
  makeNote({ id: '3', author: 'Cowork', text: 'Insight automatico', isBot: true }),
]

describe('NotesView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all provided notes with author and text', () => {
    render(<NotesView notes={SAMPLE_NOTES} channelId={CHANNEL} />)
    expect(screen.getByText('Primeira nota')).toBeDefined()
    expect(screen.getByText('Segunda nota')).toBeDefined()
    expect(screen.getByText('Insight automatico')).toBeDefined()
    expect(screen.getByText('Thiago')).toBeDefined()
    expect(screen.getByText('Ana')).toBeDefined()
  })

  it('shows bot badge (sparkle icon or "IA" text) for isBot notes', () => {
    render(<NotesView notes={[makeNote({ id: 'b1', isBot: true, author: 'Cowork' })]} channelId={CHANNEL} />)
    expect(screen.getByText('IA')).toBeDefined()
    // Bot notes display "Cowork" as author name
    expect(screen.getByText('Cowork')).toBeDefined()
  })

  it('shows author initial for non-bot notes', () => {
    render(<NotesView notes={[makeNote({ id: 'h1', isBot: false, author: 'Thiago' })]} channelId={CHANNEL} />)
    // The avatar should show 'T' (first letter of Thiago, uppercased)
    expect(screen.getByText('T')).toBeDefined()
    // Should NOT show "IA" badge
    expect(screen.queryByText('IA')).toBeNull()
  })

  it('disables save button when text is empty', () => {
    const onCreate = vi.fn()
    render(<NotesView notes={[]} channelId={CHANNEL} onCreateNote={onCreate} />)
    const btn = screen.getByRole('button', { name: /salvar nota/i })
    expect(btn.getAttribute('disabled')).not.toBeNull()
  })

  it('enables save button when text is entered', () => {
    const onCreate = vi.fn()
    render(<NotesView notes={[]} channelId={CHANNEL} onCreateNote={onCreate} />)
    const textarea = screen.getByPlaceholderText(/anotar algo/i)
    fireEvent.change(textarea, { target: { value: 'Nova nota' } })
    const btn = screen.getByRole('button', { name: /salvar nota/i })
    expect(btn.getAttribute('disabled')).toBeNull()
  })

  it('calls onCreateNote with correct payload on save', async () => {
    const onCreate = vi.fn().mockResolvedValue({ ok: true })
    render(<NotesView notes={[]} channelId={CHANNEL} onCreateNote={onCreate} />)
    const textarea = screen.getByPlaceholderText(/anotar algo/i)
    fireEvent.change(textarea, { target: { value: '  Nota com espacos  ' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar nota/i }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ channelId: CHANNEL, text: 'Nota com espacos' }))
  })

  it('clears input after successful save', async () => {
    const onCreate = vi.fn().mockResolvedValue({ ok: true })
    render(<NotesView notes={[]} channelId={CHANNEL} onCreateNote={onCreate} />)
    const textarea = screen.getByPlaceholderText(/anotar algo/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Nota temp' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar nota/i }))
    await waitFor(() => expect(textarea.value).toBe(''))
    expect(toast.success).toHaveBeenCalledWith('Nota salva.')
  })

  it('shows error toast on failed save', async () => {
    const onCreate = vi.fn().mockResolvedValue({ ok: false, error: 'Falha custom' })
    render(<NotesView notes={[]} channelId={CHANNEL} onCreateNote={onCreate} />)
    const textarea = screen.getByPlaceholderText(/anotar algo/i)
    fireEvent.change(textarea, { target: { value: 'Nota' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar nota/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falha custom'))
  })

  it('shows error toast when save throws', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('network'))
    render(<NotesView notes={[]} channelId={CHANNEL} onCreateNote={onCreate} />)
    const textarea = screen.getByPlaceholderText(/anotar algo/i)
    fireEvent.change(textarea, { target: { value: 'Nota' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar nota/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao salvar nota.'))
  })

  it('shows delete button on notes and calls onDeleteNote', async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: true })
    render(<NotesView notes={[makeNote({ id: 'd1' })]} channelId={CHANNEL} onDeleteNote={onDelete} />)
    const deleteBtn = screen.getByTitle('Remover nota')
    fireEvent.click(deleteBtn)
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('d1'))
    expect(toast.success).toHaveBeenCalledWith('Nota removida.')
  })

  it('does not show delete button for bot notes', () => {
    const onDelete = vi.fn()
    render(<NotesView notes={[makeNote({ id: 'bot1', isBot: true })]} channelId={CHANNEL} onDeleteNote={onDelete} />)
    expect(screen.queryByTitle('Remover nota')).toBeNull()
  })

  it('shows empty state when notes array is empty', () => {
    render(<NotesView notes={[]} channelId={CHANNEL} />)
    expect(screen.getByText(/nenhuma nota ainda/i)).toBeDefined()
  })

  it('formats timestamps correctly', () => {
    const ts = '2026-06-01T10:00:00Z'
    render(<NotesView notes={[makeNote({ id: 'ts1', timestamp: ts })]} channelId={CHANNEL} />)
    // Our mock returns `rel:<timestamp>`, verifying fmtRelative was called with the timestamp
    expect(screen.getByText(`rel:${ts}`)).toBeDefined()
  })
})
