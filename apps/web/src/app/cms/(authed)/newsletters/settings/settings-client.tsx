'use client'

import { useTransition } from 'react'
import { NewsletterSettings } from '@tn-figueiredo/newsletter-admin/client'
import type { NewsletterTypeSettings } from '@tn-figueiredo/newsletter-admin'
import { updateCadence } from '../actions'

export function SettingsClient({ types }: { types: NewsletterTypeSettings[] }) {
  const [isPending, startTransition] = useTransition()

  function handleSave(
    typeId: string,
    data: { cadence_days: number; preferred_send_time: string; cadence_paused: boolean },
  ) {
    startTransition(async () => {
      await updateCadence(typeId, data)
    })
  }

  return (
    <div className={isPending ? 'opacity-60 pointer-events-none' : undefined}>
      <NewsletterSettings types={types} onSave={handleSave} />
    </div>
  )
}
