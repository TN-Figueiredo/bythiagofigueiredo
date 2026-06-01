'use client'

import {
  useState,
  useRef,
  useTransition,
  type FormEvent,
} from 'react'
import { deriveScheduleLabel } from '@/lib/youtube/schedule-label'
import type { SyncScheduleEntry } from '@/lib/youtube/types'
import { groupSchedules, explodeGroups, type ScheduleGroup } from '@/lib/youtube/schedule-group'
import {
  updateYouTubeChannelSettings,
  lookupYouTubeChannel,
  addYouTubeChannel,
  removeYouTubeChannel,
} from '../actions'
import {
  useSaveState,
  SaveButton,
  labelCls,
  sectionCls,
} from './_shared'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface YouTubeChannelData {
  id: string
  name: string
  handle: string
  locale: string
  sync_enabled: boolean
  sync_schedules: SyncScheduleEntry[] | null
  schedule_label: string | null
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const DAY_LABELS: Record<typeof DAYS[number], string> = {
  monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua', thursday: 'Qui',
  friday: 'Sex', saturday: 'Sáb', sunday: 'Dom',
}

/* ------------------------------------------------------------------ */
/*  YouTubeSection                                                    */
/* ------------------------------------------------------------------ */

export function YouTubeSection({
  channels: initialChannels,
  readOnly,
}: {
  channels: YouTubeChannelData[]
  readOnly: boolean
}) {
  const [, startTransition] = useTransition()
  const [channels, setChannels] = useState(initialChannels)
  const canAdd = channels.length < 2

  const handleRemove = (channelId: string) => {
    if (!confirm('Remove this channel and all its synced videos?')) return
    startTransition(async () => {
      const res = await removeYouTubeChannel({ channelId })
      if (res.ok) setChannels(prev => prev.filter(c => c.id !== channelId))
      else alert(res.error)
    })
  }

  const handleAdded = (ch: YouTubeChannelData) => {
    setChannels(prev => [...prev, ch])
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-100">YouTube Channels</h2>

      {channels.length === 0 && (
        <p className="text-sm text-slate-400">No YouTube channels configured yet.</p>
      )}

      {channels.map((channel) => (
        <YouTubeChannelCard
          key={channel.id}
          channel={channel}
          readOnly={readOnly}
          onRemove={() => handleRemove(channel.id)}
        />
      ))}

      {canAdd && !readOnly && (
        <AddChannelForm
          existingLocales={channels.map(c => c.locale)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  AddChannelForm                                                    */
/* ------------------------------------------------------------------ */

function AddChannelForm({
  existingLocales,
  onAdded,
}: {
  existingLocales: string[]
  onAdded: (ch: YouTubeChannelData) => void
}) {
  const [handle, setHandle] = useState('')
  const [locale, setLocale] = useState<'pt' | 'en'>(
    existingLocales.includes('pt') ? 'en' : 'pt',
  )
  const [looking, setLooking] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    channelId: string; name: string; handle: string; description: string | null
    uploadsPlaylistId: string; subscriberCount: number; videoCount: number
    thumbnailUrl: string | null; bannerUrl: string | null; customUrl: string | null
  } | null>(null)

  const availableLocales = (['pt', 'en'] as const).filter(l => !existingLocales.includes(l))

  const handleLookup = async () => {
    if (!handle.trim()) return
    setError(null)
    setPreview(null)
    setLooking(true)
    const res = await lookupYouTubeChannel({ handleOrUrl: handle.trim() })
    setLooking(false)
    if (!res.ok) { setError(res.error); return }
    setPreview(res.channel)
  }

  const handleAdd = async () => {
    if (!preview) return
    setAdding(true)
    setError(null)
    const res = await addYouTubeChannel({
      channelId: preview.channelId,
      locale,
      handle: preview.handle,
      name: preview.name,
      description: preview.description,
      uploadsPlaylistId: preview.uploadsPlaylistId,
      subscriberCount: preview.subscriberCount,
      videoCount: preview.videoCount,
      thumbnailUrl: preview.thumbnailUrl,
      bannerUrl: preview.bannerUrl,
      customUrl: preview.customUrl,
    })
    setAdding(false)
    if (!res.ok) { setError(res.error); return }
    onAdded({
      id: crypto.randomUUID(),
      name: preview.name,
      handle: preview.handle,
      locale,
      sync_enabled: true,
      sync_schedules: [],
      schedule_label: null,
    })
    setHandle('')
    setPreview(null)
  }

  return (
    <div className={sectionCls()}>
      <h3 className="text-sm font-medium text-slate-300">Add Channel</h3>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor="yt-handle" className={labelCls()}>Handle or URL</label>
          <input
            id="yt-handle"
            type="text"
            value={handle}
            onChange={e => { setHandle(e.target.value); setPreview(null); setError(null) }}
            placeholder="@channel or youtube.com/@channel"
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="yt-locale" className={labelCls()}>Locale</label>
          <select
            id="yt-locale"
            value={locale}
            onChange={e => setLocale(e.target.value as 'pt' | 'en')}
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availableLocales.map(l => (
              <option key={l} value={l}>{l === 'pt' ? '🇧🇷 PT-BR' : '🌎 EN'}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleLookup}
          disabled={looking || !handle.trim()}
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {looking ? 'Looking up…' : 'Lookup'}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {preview && (
        <div className="mt-3 rounded-md border border-slate-600 bg-slate-800/50 p-3">
          <div className="flex items-center gap-3">
            {preview.thumbnailUrl && (
              <img src={preview.thumbnailUrl} alt="" className="h-10 w-10 rounded-full" />
            )}
            <div>
              <p className="text-sm font-medium text-slate-200">{preview.name}</p>
              <p className="text-xs text-slate-400">
                {preview.handle} · {preview.subscriberCount.toLocaleString()} subs · {preview.videoCount} videos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="mt-3 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            {adding ? 'Adding…' : `Add as ${locale === 'pt' ? '🇧🇷 PT-BR' : '🌎 EN'} channel`}
          </button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  YouTubeChannelCard                                                */
/* ------------------------------------------------------------------ */

function YouTubeChannelCard({
  channel,
  readOnly,
  onRemove,
}: {
  channel: YouTubeChannelData
  readOnly: boolean
  onRemove?: () => void
}) {
  const [saveState, setSaveState] = useSaveState()
  const [, startTransition] = useTransition()
  const [syncEnabled, setSyncEnabled] = useState(channel.sync_enabled)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const nextIdRef = useRef(0)
  const nextId = () => ++nextIdRef.current
  const [groups, setGroups] = useState<ScheduleGroup[]>(() =>
    groupSchedules(channel.sync_schedules ?? [], nextId),
  )
  const [scheduleLabel, setScheduleLabel] = useState(channel.schedule_label ?? '')

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    setSaveState('saving')
    startTransition(async () => {
      try {
        const res = await updateYouTubeChannelSettings({
          channel_id: channel.id,
          sync_enabled: syncEnabled,
          sync_schedules: explodeGroups(groups),
          schedule_label: scheduleLabel.trim() || null,
        })
        setSaveState(res.ok ? 'success' : 'error')
      } catch {
        setSaveState('error')
      }
    })
  }

  const addGroup = () => {
    setGroups(prev => [...prev, { _id: nextId(), days: [], hour: 10, tz: 'America/Sao_Paulo', label: '' }])
  }

  const removeGroup = (groupId: number) => {
    setGroups(prev => prev.filter(g => g._id !== groupId))
    requestAnimationFrame(() => addBtnRef.current?.focus())
  }

  const toggleDay = (groupId: number, day: SyncScheduleEntry['day']) => {
    setGroups(prev => prev.map(g =>
      g._id !== groupId ? g :
      { ...g, days: g.days.includes(day) ? g.days.filter(d => d !== day) : [...g.days, day].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)) }
    ))
  }

  const updateGroup = (groupId: number, patch: Partial<ScheduleGroup>) => {
    setGroups(prev => prev.map(g => g._id !== groupId ? g : { ...g, ...patch }))
  }

  const flag = channel.locale === 'pt' ? '🇧🇷' : '🇺🇸'

  return (
    <form onSubmit={handleSave} className={sectionCls()}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{flag}</span>
          <h3 className="text-base font-medium text-slate-200">{channel.name}</h3>
          <span className="text-xs text-slate-500">{channel.handle}</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              disabled={readOnly}
              className="accent-indigo-500"
            />
            Sync enabled
          </label>
          {onRemove && !readOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {syncEnabled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelCls()}>Posting Schedule</label>
            <button
              ref={addBtnRef}
              type="button"
              onClick={addGroup}
              disabled={readOnly || groups.length >= 3}
              title={groups.length >= 3 ? 'Máximo de 3 grupos' : undefined}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              + Adicionar grupo
            </button>
          </div>

          {groups.length === 0 && (
            <p className="text-xs text-slate-500">Nenhum horário configurado. O cron diário (07:00) ainda sincronizará.</p>
          )}

          {groups.map((group, groupIdx) => (
            <div key={group._id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-md border border-slate-600 bg-slate-800/50 p-3">
              <div role="group" aria-label="Dias da semana" className="flex items-center gap-1">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(group._id, day)}
                    disabled={readOnly}
                    aria-pressed={group.days.includes(day)}
                    className={`min-h-[44px] min-w-[44px] rounded-full px-2 text-xs font-medium disabled:opacity-50 ${group.days.includes(day) ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                max={23}
                value={group.hour}
                onChange={(e) => updateGroup(group._id, { hour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })}
                disabled={readOnly}
                aria-label={`Hora do grupo ${groupIdx + 1}`}
                className="w-14 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-500">h</span>
              <input
                type="text"
                value={group.label}
                onChange={(e) => updateGroup(group._id, { label: e.target.value })}
                disabled={readOnly}
                placeholder="Label"
                aria-label={`Rótulo do grupo ${groupIdx + 1}`}
                className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => removeGroup(group._id)}
                disabled={readOnly}
                aria-label={`Remover grupo ${groupIdx + 1}`}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}

          <div className="space-y-1">
            <label className={labelCls()}>Schedule Label (public site)</label>
            <input
              type="text"
              value={scheduleLabel}
              onChange={(e) => setScheduleLabel(e.target.value)}
              disabled={readOnly}
              placeholder={deriveScheduleLabel(explodeGroups(groups), channel.locale as 'pt' | 'en') ?? 'Auto-derived from schedules'}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-500">Leave empty to auto-derive from posting schedule. Set to override.</p>
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex justify-end pt-2">
          <SaveButton state={saveState} />
        </div>
      )}
    </form>
  )
}
