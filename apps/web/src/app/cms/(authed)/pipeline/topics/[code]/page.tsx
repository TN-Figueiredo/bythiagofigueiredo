import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TopicPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data: pipelineItems } = await supabase
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, format, stage, priority')
    .eq('site_id', siteId)
    .contains('tags', [code])
    .eq('is_archived', false)
    .order('priority', { ascending: false })

  const { data: blogPosts } = await supabase
    .from('blog_posts')
    .select('id, title, slug, status')
    .eq('site_id', siteId)
    .eq('category', code)

  return (
    <>
      <CmsTopbar title={`Topic: ${code}`} />
      <div className="p-6 space-y-6">
        <section>
          <h2 className="text-sm font-medium text-slate-300 mb-3">Pipeline Items ({pipelineItems?.length ?? 0})</h2>
          <div className="space-y-1">
            {pipelineItems?.map((item) => (
              <Link key={item.id} href={`/cms/pipeline/items/${item.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800">
                <span className="text-xs font-mono text-slate-400">{item.code}</span>
                <span className="text-sm text-slate-200">{item.title_pt || item.title_en}</span>
                <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded ml-auto">{item.stage}</span>
              </Link>
            ))}
          </div>
        </section>
        {blogPosts && blogPosts.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-slate-300 mb-3">Blog Posts ({blogPosts.length})</h2>
            <div className="space-y-1">
              {blogPosts.map((post) => (
                <Link key={post.id} href={`/cms/blog/${post.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800">
                  <span className="text-sm text-slate-200">{post.title}</span>
                  <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded ml-auto">{post.status}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
