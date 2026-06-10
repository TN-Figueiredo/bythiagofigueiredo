'use client'

import { CoworkTrigger } from '@/app/cms/(authed)/_shared/cowork/cowork-trigger'
import { useEditorState } from './context'
import {
  buildBlogCoworkHeader, BLOG_STAGE_HINT, BLOG_CW_PROMPTS, BLOG_CW_PLACEHOLDER,
  type BlogCoworkStage,
} from './cowork'

export function BlogCoworkButton({
  stage, label = 'Cowork', compact,
}: { stage: BlogCoworkStage; label?: string; compact?: boolean }) {
  const state = useEditorState()
  // Sem item de pipeline linkado não há onde o Cowork escrever — degrada silenciosamente.
  if (!state.pipelineItemId || !state.postId) return null
  const header = buildBlogCoworkHeader({
    code: state.code,
    stage,
    lang: state.activeLang,
    pipelineItemId: state.pipelineItemId,
    postId: state.postId,
  })
  return (
    <CoworkTrigger
      header={header}
      hint={BLOG_STAGE_HINT[stage](state.pipelineItemId, state.activeLang)}
      prompts={BLOG_CW_PROMPTS[stage]}
      placeholder={BLOG_CW_PLACEHOLDER[stage]}
      subline="ele escreve direto no pipeline do post — direção, rascunho, prompts de imagem e SEO."
      label={label}
      compact={compact}
    />
  )
}
