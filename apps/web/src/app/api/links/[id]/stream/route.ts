import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '../../../../../../lib/supabase/service'

export const runtime = 'nodejs'

const SITE_NINGUEM = '00000000-0000-0000-0000-000000000000'
const POLL_INTERVAL_MS = 2_000
const MAX_INACTIVITY_MS = 5 * 60 * 1000 // 5 minutes

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: linkId } = await params

  const supabase = getSupabaseServiceClient()

  // A2 (MG19): sessão + permissão de EDITAR o site do LINK. Nunca o cabeçalho x-site-id (fora de /cms o valor do cliente passa).
  const { data: link } = await supabase
    .from('tracked_links')
    .select('id, site_id')
    .eq('id', linkId)
    .single()

  // Link inexistente também passa pela guarda (com um site que ninguém edita): quem não tem sessão leva 401 e quem não edita leva 403,
  // então o status não revela se o id existe.
  const escopo = await requireSiteScope({ area: 'cms', siteId: link?.site_id ?? SITE_NINGUEM, mode: 'edit' })
  if (!escopo.ok) {
    return escopo.reason === 'unauthenticated' ? new Response('Unauthorized', { status: 401 }) : new Response('Forbidden', { status: 403 })
  }
  if (!link) return new Response('Not Found', { status: 404 })

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
