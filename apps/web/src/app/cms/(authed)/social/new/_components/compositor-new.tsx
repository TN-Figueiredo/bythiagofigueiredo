'use client'

import { useState } from 'react'
import type { DestId } from '@/lib/social/destinations'
import { DEST_IDS } from '@/lib/social/destinations'
import { DestinationPicker } from './destination-picker'
import { DestCompositor } from './dest-compositor'

const DEFAULT_ON: Record<DestId, boolean> = {
  ig_story: true,
  yt_community: false,
  fb_page: true,
  ig_feed: false,
}

export function CompositorNew() {
  const [destsOn, setDestsOn] = useState<Record<DestId, boolean>>(DEFAULT_ON)
  const [focused, setFocused] = useState<DestId>('ig_story')

  function handleToggle(id: DestId) {
    const next = { ...destsOn, [id]: !destsOn[id] }
    setDestsOn(next)
    // If turning off the focused dest, move focus to next active
    if (destsOn[id] && focused === id) {
      const nextActive = DEST_IDS.find((d) => d !== id && next[d])
      if (nextActive) setFocused(nextActive)
    }
  }

  return (
    <>
      <DestinationPicker
        initialOn={destsOn}
        onToggle={handleToggle}
        onFocus={setFocused}
        focused={focused}
      />
      <DestCompositor focusedDest={focused} destsOn={destsOn} />
    </>
  )
}
