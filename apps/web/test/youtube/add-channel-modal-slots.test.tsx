// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({ addCompetitorChannel: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AddChannelModal } from '@/app/cms/(authed)/youtube/competitors/_components/add-channel-modal'

describe('AddChannelModal slots', () => {
  it('shows the server free count without subtracting added ids again (no "-1 vagas")', () => {
    render(<AddChannelModal open onClose={vi.fn()} slots={{ used: 75, limit: 75, free: 0 }} existingChannelIds={[]} />)
    expect(screen.queryByText(/-1 vaga/)).toBeNull()
    expect(screen.getByText(/0 vagas restantes/)).toBeTruthy()
  })
})
