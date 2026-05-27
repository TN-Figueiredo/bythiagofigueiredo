'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SWRResponse } from 'swr'
import type { UpNextApiResponse } from '@/lib/pipeline/up-next-types'

export function useSlotAssignment(
  mutate: SWRResponse<UpNextApiResponse>['mutate'],
  dataRef: React.RefObject<UpNextApiResponse | undefined>,
): {
  handleAssignSlot: (itemId: string, slotDay: string, slotHour: string | null, previousItemId?: string) => Promise<void>
  announcement: string
} {
  const [announcement, setAnnouncement] = useState('')
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current)
    }
  }, [])

  const scheduleAnnouncementClear = useCallback(() => {
    if (clearTimerRef.current !== null) clearTimeout(clearTimerRef.current)
    clearTimerRef.current = setTimeout(() => setAnnouncement(''), 5000)
  }, [])

  const handleAssignSlot = useCallback(async (
    itemId: string, slotDay: string, slotHour: string | null, previousItemId?: string,
  ) => {
    if (inFlightRef.current) throw new Error('Atribuição em andamento')
    const snapshot = dataRef.current
    if (!snapshot) return
    inFlightRef.current = true

    const candidate = snapshot.candidates?.find(c => c.id === itemId)
    if (candidate) {
      const newItem = { id: candidate.id, title: candidate.title, stage: candidate.stage }
      mutate(
        (current) => {
          const base = current ?? snapshot
          return {
            ...base,
            weekSlots: base.weekSlots.map(s => {
              // NEW slot: assign incoming item (works for both fresh assign and swap target)
              if (s.day === slotDay && s.format === candidate.format && s.hour === slotHour) {
                return { ...s, assignedItem: newItem }
              }
              // OLD slot: clear previous item regardless of which day it was in
              if (previousItemId && s.assignedItem?.id === previousItemId) {
                return { ...s, assignedItem: null }
              }
              return s
            }),
          }
        },
        { revalidate: false },
      )
    } else {
      // Candidate not in local snapshot — announce intent and let the server response drive UI
      setAnnouncement('Atribuindo item...')
      scheduleAnnouncementClear()
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15_000)
      const res = await fetch('/api/pipeline/up-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, slotDay, slotHour, previousItemId }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Erro ao atribuir' } }))
        throw new Error(err.error?.message ?? 'Erro ao atribuir')
      }
      setAnnouncement('Item atribuído ao slot')
      scheduleAnnouncementClear()
      mutate()
    } catch (e) {
      const msg = e instanceof DOMException && e.name === 'AbortError'
        ? 'Tempo esgotado — tente novamente'
        : e instanceof Error ? e.message : 'Erro ao atribuir'
      setAnnouncement(msg)
      scheduleAnnouncementClear()
      mutate(snapshot, { revalidate: true })
      throw e
    } finally {
      inFlightRef.current = false
    }
  }, [mutate, dataRef, scheduleAnnouncementClear])

  return { handleAssignSlot, announcement }
}
