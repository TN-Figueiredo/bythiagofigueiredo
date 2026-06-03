import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ─── Mock chain builders ─── */

const mockLimit = vi.fn()
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockEqC = vi.fn(() => ({ order: mockOrder, eq: mockEqC }))
const mockEqB = vi.fn(() => ({ eq: mockEqC, order: mockOrder }))
const mockEqA = vi.fn(() => ({ eq: mockEqB }))
const mockSelect = vi.fn(() => ({ eq: mockEqA }))
const mockInsert = vi.fn()
const mockDeleteEq2 = vi.fn()
const mockDeleteEq1 = vi.fn(() => ({ eq: mockDeleteEq2 }))
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq1 }))

const mockGetUserById = vi.fn()

const mockFrom = vi.fn((table: string) => {
  if (table === 'youtube_notes') {
    return {
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
    }
  }
  return { select: vi.fn(() => ({ eq: vi.fn() })) }
})

const mockSupabase = {
  from: mockFrom,
  auth: {
    admin: {
      getUserById: mockGetUserById,
    },
  },
}

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({
    ok: true,
    user: { id: 'test-user-id' },
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { listNotes, createNote, deleteNote } from '../../src/app/cms/(authed)/youtube/analytics/actions'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const VALID_CHANNEL = '00000000-0000-0000-0000-000000000002'

describe('listNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mapped NoteEntry array from DB data', async () => {
    const dbRows = [
      {
        id: 'note-aaa',
        author_name: 'Thiago',
        text: 'Great video performance',
        is_bot: false,
        source: 'manual',
        created_at: '2026-06-01T12:00:00Z',
      },
      {
        id: 'note-bbb',
        author_name: 'Bot',
        text: 'Auto-generated insight',
        is_bot: true,
        source: 'intelligence',
        created_at: '2026-06-02T08:00:00Z',
      },
    ]

    mockLimit.mockResolvedValueOnce({ data: dbRows })

    const result = await listNotes(VALID_CHANNEL)

    expect(result).toEqual([
      { id: 'note-aaa', author: 'Thiago', text: 'Great video performance', timestamp: '2026-06-01T12:00:00Z', isBot: false },
      { id: 'note-bbb', author: 'Bot', text: 'Auto-generated insight', timestamp: '2026-06-02T08:00:00Z', isBot: true },
    ])
  })

  it('returns empty array when no data', async () => {
    mockLimit.mockResolvedValueOnce({ data: null })

    const result = await listNotes(VALID_CHANNEL)

    expect(result).toEqual([])
  })

  it('rejects invalid channelId (non-UUID)', async () => {
    await expect(listNotes('not-a-uuid')).rejects.toThrow('invalid_input')
  })
})

describe('createNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts row with correct fields and returns ok', async () => {
    mockGetUserById.mockResolvedValueOnce({
      data: { user: { user_metadata: { full_name: 'Thiago F' }, email: 'thiago@example.com' } },
    })
    mockInsert.mockResolvedValueOnce({ error: null })

    const result = await createNote({ channelId: VALID_CHANNEL, text: 'Test note' })

    expect(result).toEqual({ ok: true })
    expect(mockInsert).toHaveBeenCalledWith({
      site_id: 'site-1',
      channel_id: VALID_CHANNEL,
      author_id: 'test-user-id',
      author_name: 'Thiago F',
      text: 'Test note',
      source: 'manual',
    })
  })

  it('rejects empty text (Zod validation)', async () => {
    const result = await createNote({ channelId: VALID_CHANNEL, text: '' })

    expect(result).toEqual({ ok: false, error: 'invalid_input' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('rejects text > 5000 chars', async () => {
    const longText = 'x'.repeat(5001)
    const result = await createNote({ channelId: VALID_CHANNEL, text: longText })

    expect(result).toEqual({ ok: false, error: 'invalid_input' })
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('rejects invalid channelId', async () => {
    const result = await createNote({ channelId: 'bad-id', text: 'Hello' })

    expect(result).toEqual({ ok: false, error: 'invalid_input' })
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('deleteNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes and returns ok', async () => {
    mockDeleteEq2.mockResolvedValueOnce({ error: null })

    const result = await deleteNote(VALID_UUID)

    expect(result).toEqual({ ok: true })
    expect(mockDelete).toHaveBeenCalled()
  })

  it('rejects invalid noteId (non-UUID)', async () => {
    const result = await deleteNote('not-valid')

    expect(result).toEqual({ ok: false, error: 'invalid_input' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('returns error on DB failure', async () => {
    mockDeleteEq2.mockResolvedValueOnce({ error: { message: 'row level security violation' } })

    const result = await deleteNote(VALID_UUID)

    expect(result).toEqual({ ok: false, error: 'row level security violation' })
  })
})
