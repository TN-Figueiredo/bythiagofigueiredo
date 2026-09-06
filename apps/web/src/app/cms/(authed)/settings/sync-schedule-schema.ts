import { z } from 'zod'

// Shared by settings/actions.ts (server action) and its tests. Lives OUTSIDE
// the 'use server' module on purpose: Next 16 refuses to load a 'use server'
// file that exports anything but async functions ("A "use server" file can
// only export async functions, found object"), which took down every settings
// action in prod — the YouTube "Sync" button surfaced it as React #441
// (2026-09-06).

function isValidTimezone(v: string) {
  try { Intl.DateTimeFormat(undefined, { timeZone: v }); return true } catch { return false }
}

function trimString(v: string) { return v.trim() }

function trimOrNull(v: string) { return v || null }

function noDuplicateSchedules(arr: Array<{ day: string; hour: number; tz: string }>, ctx: z.RefinementCtx) {
  const seen = new Set<string>()
  for (let i = 0; i < arr.length; i++) {
    const entry = arr[i]
    if (!entry) continue
    const key = `${entry.day}:${entry.hour}:${entry.tz}`
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate schedule entry at index ${i}`,
        path: [i],
      })
    }
    seen.add(key)
  }
}

export const syncScheduleSchema = z.object({
  channel_id: z.string().uuid(),
  sync_enabled: z.boolean(),
  sync_schedules: z.array(z.object({
    day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    hour: z.number().int().min(0).max(23),
    tz: z.string().refine(isValidTimezone, { message: 'Invalid IANA timezone' }),
    label: z.string().max(100).transform(trimString),
  })).max(21).superRefine(noDuplicateSchedules),
  schedule_label: z.string().max(200).trim().transform(trimOrNull).nullable().optional(),
})


export type SyncScheduleInput = z.infer<typeof syncScheduleSchema>
