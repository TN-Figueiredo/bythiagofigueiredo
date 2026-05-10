'use client'

import { lazy, Suspense } from 'react'
import type { SectionData } from '@/lib/pipeline/sections'

const IdeaRenderer = lazy(() => import('./renderers/idea-renderer').then(m => ({ default: m.IdeaRenderer })))
const ScriptRenderer = lazy(() => import('./renderers/script-renderer').then(m => ({ default: m.ScriptRenderer })))
const BRollRenderer = lazy(() => import('./renderers/broll-renderer').then(m => ({ default: m.BRollRenderer })))
const SceneGuideRenderer = lazy(() => import('./renderers/scene-guide-renderer').then(m => ({ default: m.SceneGuideRenderer })))
const CrossRefRenderer = lazy(() => import('./renderers/crossref-renderer').then(m => ({ default: m.CrossRefRenderer })))
const SpeedRampRenderer = lazy(() => import('./renderers/speedramp-renderer').then(m => ({ default: m.SpeedRampRenderer })))
const PublishRenderer = lazy(() => import('./renderers/publish-renderer').then(m => ({ default: m.PublishRenderer })))

const REGISTRY: Record<string, React.LazyExoticComponent<React.ComponentType<RendererProps>>> = {
  ideia: IdeaRenderer,
  roteiro: ScriptRenderer,
  brolls: BRollRenderer,
  postprod_scenes: SceneGuideRenderer,
  postprod_crossref: CrossRefRenderer,
  postprod_speedramps: SpeedRampRenderer,
  publish: PublishRenderer,
}

export interface RendererProps {
  content: SectionData['content']
  isEditing: boolean
  lang: string
  onContentChange: (content: SectionData['content']) => void
}

interface SectionContentProps extends RendererProps {
  sectionType: string
}

function LoadingSkeleton() {
  return (
    <div className="p-5 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-4 rounded" style={{ background: 'var(--gem-well)', width: `${80 - i * 15}%` }} />
      ))}
    </div>
  )
}

export function SectionContent({ sectionType, content, isEditing, lang, onContentChange }: SectionContentProps) {
  const Renderer = REGISTRY[sectionType]
  if (!Renderer) {
    return (
      <div className="p-5 text-xs" style={{ color: 'var(--gem-dim)' }}>
        Renderer não encontrado para tipo: {sectionType}
      </div>
    )
  }

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Renderer content={content} isEditing={isEditing} lang={lang} onContentChange={onContentChange} />
    </Suspense>
  )
}
