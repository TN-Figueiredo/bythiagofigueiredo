import { getSupabaseServiceClient } from '../../../../../../lib/supabase/service'

export const runtime = 'nodejs'

const POLL_INTERVAL_MS = 2_000
const MAX_INACTIVITY_MS = 5 * 60 * 1000 // 5 minutes

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: linkId } = await params

  // Simple auth check via cookie-based session or bearer token
  // In a full implementation this would use requireArea('cms'),
  // but for the SSE route we check the x-site-id header set by middleware
  const siteId = request.headers.get('x-site-id')
  if (!siteId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = getSupabaseServiceClient()

  // Verify link exists and belongs to the site
  const { data: link, error: linkErr } = await supabase
    .from('tracked_links')
    .select('id, site_id')
    .eq('id', linkId)
    .single()

  if (linkErr || !link) {
    return new Response('Not Found', { status: 404 })
  }

  if (link.site_id !== siteId) {
    return new Response('Forbidden', { status: 403 })
  }

  let lastSeenAt = new Date().toISOString()
  let lastActivityAt = Date.now()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const poll = async () => {
        if (closed) return

        // Check inactivity timeout
        if (Date.now() - lastActivityAt > MAX_INACTIVITY_MS) {
          controller.enqueue(encoder.encode('event: timeout\ndata: {}\n\n'))
          controller.close()
          closed = true
          return
        }

        try {
          const { data: clicks } = await supabase
            .from('link_clicks')
            .select('id, clicked_at, country, city, referrer_domain, is_bot, visitor_id')
            .eq('link_id', linkId)
            .gt('clicked_at', lastSeenAt)
            .order('clicked_at', { ascending: true })
            .limit(50)

          if (clicks && clicks.length > 0) {
            lastActivityAt = Date.now()
            for (const click of clicks) {
              const msg = `data: ${JSON.stringify(click)}\n\n`
              controller.enqueue(encoder.encode(msg))
            }
            const lastClick = clicks[clicks.length - 1]
            if (lastClick) lastSeenAt = lastClick.clicked_at
          }
        } catch {
          // Non-fatal polling error -- skip this tick
        }

        if (!closed) {
          setTimeout(poll, POLL_INTERVAL_MS)
        }
      }

      // Start polling
      await poll()
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  })
}
