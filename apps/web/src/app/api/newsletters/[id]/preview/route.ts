import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../../lib/supabase/service'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('content_html, content_mdx, subject, site_id')
    .eq('id', id)
    .maybeSingle()

  if (!edition) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Auth gate: only staff who can view this site's content
  const res = await requireSiteScope({ area: 'cms', siteId: edition.site_id, mode: 'view' })
  if (!res.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const html = edition.content_html ?? wrapBasicHtml(edition.content_mdx ?? '', edition.subject)

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function wrapBasicHtml(mdx: string, subject: string): string {
  const escaped = mdx
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${subject}</title>
<style>body{font-family:system-ui;max-width:640px;margin:2rem auto;padding:0 1rem;}</style>
</head><body><pre style="white-space:pre-wrap;">${escaped}</pre></body></html>`
}
