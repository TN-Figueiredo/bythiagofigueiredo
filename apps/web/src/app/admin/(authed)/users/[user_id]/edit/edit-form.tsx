'use client'

import { useState, useTransition } from 'react'

export interface EditableMembership {
  site_id: string
  site_name: string
  primary_domain: string
  role: 'editor' | 'reporter'
}

export interface TargetCandidate {
  user_id: string
  email: string
  site_id: string
  role: 'editor'
}

interface Props {
  userId: string
  memberships: EditableMembership[]
  candidates: TargetCandidate[]
  onUpdateRole: (input: {
    user_id: string
    site_id: string
    role: 'editor' | 'reporter'
  }) => Promise<void>
  onRevoke: (input: { user_id: string; site_id: string }) => Promise<void>
  onReassign: (input: {
    from_user: string
    to_user: string
    site_id: string
  }) => Promise<void>
}

/**
 * Track G3 — per-site membership editor.
 *
 * Renders one card per site_membership with:
 *  - role selector (editor | reporter) + Save button
 *  - Reassign form (pick target editor on the same site) + Reassign button
 *  - Revoke button (confirm-gated, does NOT reassign automatically)
 *
 * All server actions are injected as props so the client component stays
 * portable and testable in isolation.
 */
export function EditForm({
  userId,
  memberships,
  candidates,
  onUpdateRole,
  onRevoke,
  onReassign,
}: Props) {
  if (memberships.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Este usuário não tem membership em nenhum site desta organização.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {memberships.map((m) => (
        <MembershipCard
          key={m.site_id}
          userId={userId}
          membership={m}
          targetCandidates={candidates.filter((c) => c.site_id === m.site_id)}
          onUpdateRole={onUpdateRole}
          onRevoke={onRevoke}
          onReassign={onReassign}
        />
      ))}
    </div>
  )
}

function MembershipCard({
  userId,
  membership,
  targetCandidates,
  onUpdateRole,
  onRevoke,
  onReassign,
}: {
  userId: string
  membership: EditableMembership
  targetCandidates: TargetCandidate[]
  onUpdateRole: Props['onUpdateRole']
  onRevoke: Props['onRevoke']
  onReassign: Props['onReassign']
}) {
  const [role, setRole] = useState<'editor' | 'reporter'>(membership.role)
  const [reassignTarget, setReassignTarget] = useState<string>(
    targetCandidates[0]?.user_id ?? '',
  )
  const [isPending, startTransition] = useTransition()

  function handleSaveRole() {
    startTransition(() => {
      void onUpdateRole({ user_id: userId, site_id: membership.site_id, role })
    })
  }

  function handleReassign() {
    if (!reassignTarget) return
    startTransition(() => {
      void onReassign({
        from_user: userId,
        to_user: reassignTarget,
        site_id: membership.site_id,
      })
    })
  }

  function handleRevoke() {
    if (!window.confirm(`Remover acesso ao site ${membership.site_name}?`)) return
    startTransition(() => {
      void onRevoke({ user_id: userId, site_id: membership.site_id })
    })
  }

  return (
    <section className="border rounded-lg p-4">
      <header className="flex items-baseline justify-between mb-4">
        <h3 className="text-lg font-semibold">{membership.site_name}</h3>
        <span className="text-xs text-gray-500">{membership.primary_domain}</span>
      </header>

      {/* Role edit */}
      <div className="flex items-end gap-2 mb-4">
        <div>
          <label
            htmlFor={`role-${membership.site_id}`}
            className="block text-xs font-medium mb-1"
          >
            Papel
          </label>
          <select
            id={`role-${membership.site_id}`}
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'reporter')}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="editor">editor</option>
            <option value="reporter">reporter</option>
          </select>
        </div>
        <button
          type="button"
          onClick={handleSaveRole}
          disabled={isPending || role === membership.role}
          className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Salvar
        </button>
      </div>

      {/* Reassign */}
      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <label
            htmlFor={`reassign-${membership.site_id}`}
            className="block text-xs font-medium mb-1"
          >
            Reatribuir conteúdo para
          </label>
          <select
            id={`reassign-${membership.site_id}`}
            value={reassignTarget}
            onChange={(e) => setReassignTarget(e.target.value)}
            className="border rounded px-2 py-1 text-sm w-full"
            disabled={targetCandidates.length === 0}
          >
            {targetCandidates.length === 0 ? (
              <option value="">Nenhum editor elegível nesse site</option>
            ) : (
              targetCandidates.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.email}
                </option>
              ))
            )}
          </select>
        </div>
        <button
          type="button"
          onClick={handleReassign}
          disabled={isPending || !reassignTarget}
          className="bg-amber-600 text-white rounded px-3 py-1.5 text-sm hover:bg-amber-700 disabled:opacity-50"
        >
          Reatribuir
        </button>
      </div>

      {/* Revoke */}
      <div className="border-t pt-3">
        <button
          type="button"
          onClick={handleRevoke}
          disabled={isPending}
          className="text-red-600 text-sm hover:underline disabled:opacity-50"
        >
          Remover acesso a este site
        </button>
        <p className="text-xs text-gray-500 mt-1">
          Conteúdo owned por este usuário não é reatribuído automaticamente.
          Rode "Reatribuir" antes se quiser preservar a autoria.
        </p>
      </div>
    </section>
  )
}
