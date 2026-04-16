/**
 * Track G3 — /admin/users/[user_id]/edit client form.
 *
 * Covers the interactive UX of `EditForm` in isolation:
 *  1. Role change + save forwards (user_id, site_id, role) to onUpdateRole.
 *  2. Reassign forwards (from_user, to_user, site_id) to onReassign.
 *  3. Revoke fires only after confirm() approval, cancelled when rejected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  EditForm,
  type EditableMembership,
  type TargetCandidate,
} from '../../src/app/admin/(authed)/users/[user_id]/edit/edit-form'

describe('EditForm', () => {
  const USER_ID = 'user-subject'
  const SITE_A: EditableMembership = {
    site_id: 'site-a',
    site_name: 'Site A',
    primary_domain: 'a.example.com',
    role: 'reporter',
  }
  const SITE_B: EditableMembership = {
    site_id: 'site-b',
    site_name: 'Site B',
    primary_domain: 'b.example.com',
    role: 'editor',
  }
  const CANDIDATE_A: TargetCandidate = {
    user_id: 'editor-a',
    email: 'alice@example.com',
    site_id: 'site-a',
    role: 'editor',
  }

  type Props = React.ComponentProps<typeof EditForm>
  const onUpdateRole: Props['onUpdateRole'] = vi.fn()
  const onRevoke: Props['onRevoke'] = vi.fn()
  const onReassign: Props['onReassign'] = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(onUpdateRole as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(onRevoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    ;(onReassign as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  it('renders empty-state when user has no site memberships', () => {
    render(
      <EditForm
        userId={USER_ID}
        memberships={[]}
        candidates={[]}
        onUpdateRole={onUpdateRole}
        onRevoke={onRevoke}
        onReassign={onReassign}
      />,
    )
    expect(screen.getByText(/não tem membership/i)).toBeTruthy()
  })

  it('calls onUpdateRole with (user_id, site_id, new role) when Save is clicked', async () => {
    render(
      <EditForm
        userId={USER_ID}
        memberships={[SITE_A]}
        candidates={[CANDIDATE_A]}
        onUpdateRole={onUpdateRole}
        onRevoke={onRevoke}
        onReassign={onReassign}
      />,
    )

    // Change role reporter → editor
    const roleSelect = screen.getByLabelText(/^Papel$/) as HTMLSelectElement
    fireEvent.change(roleSelect, { target: { value: 'editor' } })

    const saveButton = screen.getByRole('button', { name: 'Salvar' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(onUpdateRole).toHaveBeenCalledWith({
        user_id: USER_ID,
        site_id: 'site-a',
        role: 'editor',
      })
    })
  })

  it('calls onReassign with (from_user, to_user, site_id) when Reatribuir is clicked', async () => {
    render(
      <EditForm
        userId={USER_ID}
        memberships={[SITE_A]}
        candidates={[CANDIDATE_A]}
        onUpdateRole={onUpdateRole}
        onRevoke={onRevoke}
        onReassign={onReassign}
      />,
    )

    const reassignButton = screen.getByRole('button', { name: 'Reatribuir' })
    fireEvent.click(reassignButton)

    await waitFor(() => {
      expect(onReassign).toHaveBeenCalledWith({
        from_user: USER_ID,
        to_user: 'editor-a',
        site_id: 'site-a',
      })
    })
  })

  it('does NOT call onRevoke when confirm() is cancelled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <EditForm
        userId={USER_ID}
        memberships={[SITE_B]}
        candidates={[]}
        onUpdateRole={onUpdateRole}
        onRevoke={onRevoke}
        onReassign={onReassign}
      />,
    )

    const revokeButton = screen.getByRole('button', {
      name: /Remover acesso a este site/,
    })
    fireEvent.click(revokeButton)

    expect(confirmSpy).toHaveBeenCalled()
    expect(onRevoke).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('calls onRevoke with (user_id, site_id) when confirm() is accepted', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <EditForm
        userId={USER_ID}
        memberships={[SITE_B]}
        candidates={[]}
        onUpdateRole={onUpdateRole}
        onRevoke={onRevoke}
        onReassign={onReassign}
      />,
    )

    const revokeButton = screen.getByRole('button', {
      name: /Remover acesso a este site/,
    })
    fireEvent.click(revokeButton)

    await waitFor(() => {
      expect(onRevoke).toHaveBeenCalledWith({
        user_id: USER_ID,
        site_id: 'site-b',
      })
    })
    confirmSpy.mockRestore()
  })
})
