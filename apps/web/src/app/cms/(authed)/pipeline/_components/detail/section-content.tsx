'use client'

import { Component, type ReactNode } from 'react'
import type { SectionData } from '@/lib/pipeline/sections'
import { IdeaRenderer } from './renderers/idea-renderer'
import { ScriptRenderer } from './renderers/script-renderer'
import { BRollRenderer } from './renderers/broll-renderer'
import { SceneGuideRenderer } from './renderers/scene-guide-renderer'
import { CrossRefRenderer } from './renderers/crossref-renderer'
import { SpeedRampRenderer } from './renderers/speedramp-renderer'
import { PublishRenderer } from './renderers/publish-renderer'
import { DraftRenderer } from './renderers/draft-renderer'
import { SeoRenderer } from './renderers/seo-renderer'
import { ImagesRenderer } from './renderers/images-renderer'
import { GenericRenderer } from './renderers/generic-renderer'
import { PostProductionView } from './renderers/postprod-renderer'
import { CurriculumRenderer } from './renderers/curriculum-renderer'

const REGISTRY: Record<string, React.ComponentType<RendererProps>> = {
  ideia: IdeaRenderer,
  roteiro: ScriptRenderer,
  brolls: BRollRenderer,
  postprod: PostProductionView,
  // Legacy sub-section keys — kept for backward compat with existing data
  postprod_scenes: SceneGuideRenderer,
  postprod_crossref: CrossRefRenderer,
  postprod_speedramps: SpeedRampRenderer,
  publish: PublishRenderer,
  draft: DraftRenderer,
  seo: SeoRenderer,
  images: ImagesRenderer,
  curriculum: CurriculumRenderer,
}

export interface RendererProps {
  content: SectionData['content']
  isEditing: boolean
  lang: string
  format?: string
  onContentChange: (content: SectionData['content']) => void
  pipelineItemId?: string
  siteId?: string
  vvsScore?: number
  stage?: string
  blogPostId?: string | null
  blogSlug?: string | null
  socialPostId?: string | null
}

interface SectionContentProps extends RendererProps {
  sectionType: string
}

class RendererErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="p-5 text-center space-y-2">
          <p className="text-[12px] font-medium" style={{ color: '#f87171' }}>Erro ao renderizar seção</p>
          <pre className="text-[10px] p-3 rounded-md overflow-auto text-left" style={{ background: 'var(--gem-well)', color: 'var(--gem-dim)' }}>
            {this.state.error.message}
          </pre>
          <button
            className="text-[11px] px-3 py-1 rounded"
            style={{ background: 'var(--gem-well)', color: 'var(--gem-muted)', border: '1px solid var(--gem-border)' }}
            onClick={() => this.setState({ error: null })}
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function SectionContent({ sectionType, content, isEditing, lang, format, onContentChange, pipelineItemId, siteId, vvsScore, stage, blogPostId, blogSlug, socialPostId }: SectionContentProps) {
  const Renderer = REGISTRY[sectionType] ?? GenericRenderer

  return (
    <RendererErrorBoundary>
      <Renderer
        content={content}
        isEditing={isEditing}
        lang={lang}
        format={format}
        onContentChange={onContentChange}
        pipelineItemId={pipelineItemId}
        siteId={siteId}
        vvsScore={vvsScore}
        stage={stage}
        blogPostId={blogPostId}
        blogSlug={blogSlug}
        socialPostId={socialPostId}
      />
    </RendererErrorBoundary>
  )
}
