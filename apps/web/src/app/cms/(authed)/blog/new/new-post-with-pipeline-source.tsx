'use client'

import { PostEditionEditor } from './post-edition-editor'
import { PipelineSourcePicker } from './pipeline-source-picker'
import { searchPipelineItems, createPostFromPipeline } from '@/app/cms/(authed)/blog/actions'

interface Props {
  locale: string
  tagId?: string
  defaultLocale: string
  tags: Array<{ id: string; name: string; color: string; nameTranslations: Record<string, string> | null }>
  supportedLocales: string[]
  siteId: string
}

export function NewPostWithPipelineSource({
  locale,
  tagId,
  defaultLocale,
  tags,
  supportedLocales,
  siteId,
}: Props) {
  return (
    <>
      <PipelineSourcePicker
        siteId={siteId}
        supportedLocales={supportedLocales}
        defaultLocale={defaultLocale}
        onSearch={(q) => searchPipelineItems(siteId, q)}
        onCreate={createPostFromPipeline}
      />
      <PostEditionEditor
        locale={locale}
        tagId={tagId}
        defaultLocale={defaultLocale}
        tags={tags}
        supportedLocales={supportedLocales}
        siteId={siteId}
      />
    </>
  )
}
