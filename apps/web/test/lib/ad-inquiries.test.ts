import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateResult = { error: null as { message: string } | null }
const mockUpdateChain = {
  eq: vi.fn(() => Promise.resolve(mockUpdateResult)),
}
const mockChain = {
  update: vi.fn(() => mockUpdateChain),
}
const mockFrom = vi.fn(() => mockChain)

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireArea: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/sentry-wrap', () => ({
  captureServerActionError: vi.fn(),
}))

import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { captureServerActionError } from '@/lib/sentry-wrap'

const actionsPath = '../../src/app/admin/(authed)/ads/_actions/inquiries'

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateResult.error = null
})

describe('updateInquiryStatus', () => {
  it('rejects invalid status values', async () => {
    const { updateInquiryStatus } = await import(actionsPath)
    await expect(updateInquiryStatus('id1', 'hacked')).rejects.toThrow('Invalid status')
  })

  it('calls requireArea before updating', async () => {
    const { updateInquiryStatus } = await import(actionsPath)
    await updateInquiryStatus('id1', 'contacted')
    expect(requireArea).toHaveBeenCalledWith('admin')
  })

  it('sets contacted_at when status changes to contacted', async () => {
    const { updateInquiryStatus } = await import(actionsPath)
    await updateInquiryStatus('id1', 'contacted')
    const updateArg = mockChain.update.mock.calls[0][0]
    expect(updateArg.status).toBe('contacted')
    expect(updateArg.contacted_at).toBeDefined()
  })

  it('sets converted_at when status changes to converted', async () => {
    const { updateInquiryStatus } = await import(actionsPath)
    await updateInquiryStatus('id1', 'converted')
    const updateArg = mockChain.update.mock.calls[0][0]
    expect(updateArg.status).toBe('converted')
    expect(updateArg.converted_at).toBeDefined()
  })

  it('accepts all valid statuses', async () => {
    const { updateInquiryStatus } = await import(actionsPath)
    for (const status of ['pending', 'contacted', 'negotiating', 'converted', 'archived']) {
      mockChain.update.mockClear()
      mockUpdateResult.error = null
      await updateInquiryStatus('id1', status)
      expect(mockChain.update).toHaveBeenCalled()
    }
  })

  it('captures Sentry error on DB failure', async () => {
    const { updateInquiryStatus } = await import(actionsPath)
    mockUpdateResult.error = { message: 'db boom' }
    await expect(updateInquiryStatus('id1', 'pending')).rejects.toThrow('db boom')
    expect(captureServerActionError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'db boom' }),
      expect.objectContaining({ action: 'update_inquiry_status' }),
    )
  })
})

describe('updateInquiryNotes', () => {
  it('rejects notes exceeding max length', async () => {
    const { updateInquiryNotes } = await import(actionsPath)
    const longNotes = 'x'.repeat(5001)
    await expect(updateInquiryNotes('id1', longNotes)).rejects.toThrow('Notes too long')
  })

  it('calls requireArea before updating', async () => {
    const { updateInquiryNotes } = await import(actionsPath)
    await updateInquiryNotes('id1', 'some notes')
    expect(requireArea).toHaveBeenCalledWith('admin')
  })

  it('stores null for empty notes', async () => {
    const { updateInquiryNotes } = await import(actionsPath)
    await updateInquiryNotes('id1', '')
    const updateArg = mockChain.update.mock.calls[0][0]
    expect(updateArg.admin_notes).toBeNull()
  })

  it('accepts notes within max length', async () => {
    const { updateInquiryNotes } = await import(actionsPath)
    const validNotes = 'x'.repeat(5000)
    await updateInquiryNotes('id1', validNotes)
    expect(mockChain.update).toHaveBeenCalled()
  })
})
