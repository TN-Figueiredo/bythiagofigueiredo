// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/resize-handle.tsx
'use client'

import { useState, useCallback } from 'react'
import { HANDLE_H, TH } from './constants'

interface ResizeHandleProps {
  onStart: (e: React.MouseEvent) => void
}

export function ResizeHandle({ onStart }: ResizeHandleProps) {
  const [hov, setHov] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onStart(e)
  }, [onStart])

  return (
    <div
      style={{ height: HANDLE_H, cursor: 'row-resize', position: 'relative', zIndex: 2 }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize track"
    >
      <div
        className="absolute left-0 right-0"
        style={{
          top: 1,
          height: hov ? 2 : 1,
          background: hov ? TH.accent : TH.border,
          transition: 'background 0.15s, height 0.1s',
          borderRadius: hov ? 1 : 0,
        }}
      />
    </div>
  )
}
