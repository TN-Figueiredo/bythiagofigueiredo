'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { PostEditorProvider, usePostEditor } from './post-editor-context'
import { PostTabBar } from './post-tab-bar'
import { PostSidebar } from './sidebar/post-sidebar'
import { ContentTab } from './tabs/content-tab'
import { ImagesTab } from './tabs/images-tab'
import { SeoTab } from './tabs/seo-tab'
import { SocialTab } from './tabs/social-tab'
import { PublishTab } from './tabs/publish-tab'
import { publishPost, returnToPipeline } from '../actions'
import type { PostDetailData, PostTab, SectionStatus } from '@/lib/posts/types'

interface PostDetailProps {
  post: PostDetailData
}

function PostDetailInner() {
  const router = useRouter()
  const { state, dispatch } = usePostEditor()
  const { post, activeTab } = state

  const tabStatuses: Record<PostTab, SectionStatus> = {
    content: post.translations.some(t => t.title && t.contentMdx) ? 'done' : post.translations.some(t => t.title) ? 'warn' : 'empty',
    images: post.coverImageUrl ? 'done' : 'empty',
    seo: post.translations.some(t => t.metaTitle && t.metaDescription) ? 'done' : post.translations.some(t => t.metaTitle || t.metaDescription) ? 'warn' : 'empty',
    social: post.socialConfig?.enabled && post.socialConfig.platforms.length > 0 ? 'done' : 'empty',
    publish: post.scheduledAt ? 'done' : 'empty',
  }

  const handleSchedule = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE_TAB', tab: 'publish' })
  }, [dispatch])

  const handlePublish = useCallback(async () => {
    if (!confirm('Publicar imediatamente? O post ficará visível no /blog e os posts sociais serão disparados.')) return
    try {
      const result = await publishPost(post.id)
      if (result.ok) {
        toast.success('Post publicado!')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Erro de conexão')
    }
  }, [post.id, router])

  const handleReturnToPipeline = useCallback(async () => {
    if (!confirm('Devolver ao Pipeline? O post voltará como item de pipeline no estágio Rascunho. Social config e data de agendamento serão removidos.')) return
    try {
      const result = await returnToPipeline(post.id)
      if (result.ok && result.data) {
        toast.success('Devolvido ao pipeline')
        router.push(`/cms/pipeline/blog_post/${result.data.pipelineItemId}`)
      } else if (!result.ok) {
        toast.error(result.error)
      }
    } catch {
      toast.error('Erro de conexão')
    }
  }, [post.id, router])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('posts:save-tab'))
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (state.hasDirtyTabs) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [state.hasDirtyTabs])

  return (
    <div className="flex gap-5" style={{ padding: '20px 24px', maxWidth: 1440, margin: '0 auto' }}>
      <div className="flex-1 min-w-0 flex flex-col gap-3.5">
        <nav className="flex items-center gap-2 text-xs" style={{ color: 'var(--gem-dim, #3d4654)' }} aria-label="Breadcrumb">
          <Link href="/cms/posts" className="hover:underline">Posts</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: 'var(--gem-muted, #8b949e)' }}>
            {post.translations[0]?.title ?? 'Untitled'}
          </span>
        </nav>

        <PostTabBar tabStatuses={tabStatuses} availableLocales={post.translations.map(t => t.locale)} />

        <div role="tabpanel" id="tabpanel-content" aria-labelledby="tab-content" hidden={activeTab !== 'content'}>
          <ContentTab />
        </div>
        <div role="tabpanel" id="tabpanel-images" aria-labelledby="tab-images" hidden={activeTab !== 'images'}>
          <ImagesTab />
        </div>
        <div role="tabpanel" id="tabpanel-seo" aria-labelledby="tab-seo" hidden={activeTab !== 'seo'}>
          <SeoTab />
        </div>
        <div role="tabpanel" id="tabpanel-social" aria-labelledby="tab-social" hidden={activeTab !== 'social'}>
          <SocialTab />
        </div>
        <div role="tabpanel" id="tabpanel-publish" aria-labelledby="tab-publish" hidden={activeTab !== 'publish'}>
          <PublishTab />
        </div>
      </div>

      <PostSidebar
        tabStatuses={tabStatuses}
        onSchedule={handleSchedule}
        onPublish={handlePublish}
        onReturnToPipeline={handleReturnToPipeline}
      />
    </div>
  )
}

export function PostDetail({ post }: PostDetailProps) {
  return (
    <PostEditorProvider post={post}>
      <PostDetailInner />
    </PostEditorProvider>
  )
}
