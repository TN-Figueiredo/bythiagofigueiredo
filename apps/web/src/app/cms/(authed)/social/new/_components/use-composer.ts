'use client'

import { useState, useCallback, useMemo } from 'react'
import type { DestId } from '@/lib/social/destinations'
import { DEST_IDS } from '@/lib/social/destinations'

export interface PollConfig {
  options: string[]
  durationHours: number
}

export interface CMSContent {
  id: string
  type: string
  title: string
  excerpt: string | null
  imageUrl: string | null
  url: string
  locale: string
}

export interface AISuggestion {
  variations: string[]
  hashtags: string[]
  tone: string
  bestTime: string | null
}

export interface ComposerState {
  mode: 'cms' | 'blank'
  lang: 'pt' | 'en'
  destsOn: Record<DestId, boolean>
  focused: DestId
  captions: Record<string, string>
  poll: PollConfig | null
  sched: 'now' | 'schedule' | 'queue'
  schedDate: string
  schedTime: string
  publishing: boolean
  cmsPicked: CMSContent | null
  aiData: AISuggestion | null
  aiLoading: boolean
  design: Record<string, unknown> | null
}

const DEFAULT_DESTS_ON: Record<DestId, boolean> = {
  ig_story: true,
  yt_community: true,
  fb_page: true,
  ig_feed: false,
}

export function useComposer(initialMode: 'cms' | 'blank' = 'cms') {
  const [mode, setMode] = useState<'cms' | 'blank'>(initialMode)
  const [lang, setLang] = useState<'pt' | 'en'>('pt')
  const [destsOn, setDestsOn] = useState<Record<DestId, boolean>>(DEFAULT_DESTS_ON)
  const [focused, setFocused] = useState<DestId>('ig_story')
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const [poll, setPoll] = useState<PollConfig | null>(null)
  const [sched, setSched] = useState<'now' | 'schedule' | 'queue'>('now')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [cmsPicked, setCmsPicked] = useState<CMSContent | null>(null)
  const [aiData, setAiData] = useState<AISuggestion | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [design, setDesign] = useState<Record<string, unknown> | null>(null)

  const toggleDest = useCallback((id: DestId) => {
    setDestsOn(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const focusDest = useCallback((id: DestId) => {
    setFocused(id)
  }, [])

  const setCaption = useCallback((destId: DestId, language: 'pt' | 'en', value: string) => {
    setCaptions(prev => ({ ...prev, [`${destId}_${language}`]: value }))
  }, [])

  const getCaption = useCallback((destId: DestId, language: 'pt' | 'en') => {
    return captions[`${destId}_${language}`] ?? ''
  }, [captions])

  const applyAISuggestion = useCallback((suggestion: AISuggestion) => {
    setAiData(suggestion)
  }, [])

  const updateDesign = useCallback((composition: Record<string, unknown>) => {
    setDesign(composition)
  }, [])

  const activeDests = useMemo(() => DEST_IDS.filter(id => destsOn[id]), [destsOn])

  return {
    mode, lang, destsOn, focused, captions, poll, sched,
    schedDate, schedTime, publishing, cmsPicked, aiData,
    aiLoading, design, activeDests,
    setMode, setLang, toggleDest, focusDest, setCaption, getCaption,
    setPoll, setSched, setSchedDate, setSchedTime, setPublishing,
    setCmsPicked, setAiData, setAiLoading, applyAISuggestion, updateDesign,
  }
}
