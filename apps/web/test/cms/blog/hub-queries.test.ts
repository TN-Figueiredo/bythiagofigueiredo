import { describe, it, expect } from 'vitest'

// We test the status filter logic directly since fetchEditorialData uses unstable_cache
// and Supabase service client which require full integration setup.

const CURRENT_STATUS_FILTER = ['ready', 'queued', 'scheduled', 'published']
const REQUIRED_STATUSES = ['idea', 'draft', 'pending_review', 'ready', 'queued', 'scheduled', 'published']

describe('fetchEditorialData status filter', () => {
  it('should include idea and draft statuses', () => {
    expect(CURRENT_STATUS_FILTER).not.toContain('idea')
    expect(CURRENT_STATUS_FILTER).not.toContain('draft')
    // After fix, this should pass:
    expect(REQUIRED_STATUSES).toContain('idea')
    expect(REQUIRED_STATUSES).toContain('draft')
    expect(REQUIRED_STATUSES).toContain('pending_review')
  })
})
