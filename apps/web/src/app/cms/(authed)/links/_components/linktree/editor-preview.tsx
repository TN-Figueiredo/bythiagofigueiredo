'use client'

import { useMemo } from 'react'
import type { z } from 'zod'
import type { LinktreeConfigSchema, LinktreePageData } from '@/app/go/linktree/_lib/types'
import { LinktreeClient } from '@/app/go/linktree/_components/linktree-client'

type Config = z.infer<typeof LinktreeConfigSchema>

interface Props {
  config: Config
  pageData: LinktreePageData
}

export function EditorPreview({ config, pageData }: Props) {
  const mergedPageData = useMemo(() => ({
    ...pageData,
    config,
    sharedLinks: config.shared_links,
  }), [pageData, config])

  return (
    <div style={{ width: 320, background: 'rgb(19, 17, 13)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ transform: 'scale(1)', transformOrigin: 'top center' }}>
        <LinktreeClient
          initialLocale="pt-BR"
          initialTheme="dark"
          {...mergedPageData}
        />
      </div>
    </div>
  )
}
