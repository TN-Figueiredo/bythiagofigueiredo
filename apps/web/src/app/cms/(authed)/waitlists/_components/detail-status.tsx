'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WaitlistStatusStrip } from './status-strip'
import type { WaitlistStatus } from '../../../../../../lib/waitlists/status'
import type { WaitlistTransitionResult } from '../actions'

/**
 * Detail-page status control island: renders the WaitlistStatusStrip and bridges the
 * transitionWaitlistStatus server action (passed in as a prop — props-only). On success it
 * refreshes the server component; gated/illegal results leave the strip in place (the
 * Fase-2 toast is the documented UX for surfacing those).
 */
export function WaitlistDetailStatus({
  waitlistId,
  status,
  transitionAction,
}: {
  waitlistId: string
  status: WaitlistStatus
  transitionAction: (id: string, from: WaitlistStatus, to: WaitlistStatus) => Promise<WaitlistTransitionResult>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <WaitlistStatusStrip
      status={status}
      pending={pending}
      onTransition={(to) =>
        startTransition(async () => {
          const res = await transitionAction(waitlistId, status, to)
          if (res.ok) router.refresh()
        })
      }
    />
  )
}
