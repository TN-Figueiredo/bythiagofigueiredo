import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { defaultOwnChannel } from '@/lib/youtube/default-channel'
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'

export const runtime = 'nodejs'

const UC_ID = /^UC[a-zA-Z0-9_-]+$/

const UploadSessionSchema = z.object({
  /** Canal do upload: o id "UC…" ou o uuid de `youtube_channels`. Ausente = canal padrão do site. */
  channel: z.union([z.string().uuid(), z.string().regex(UC_ID)]).optional(),
  title: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  categoryId: z.string().regex(/^\d+$/).optional(),
  privacyStatus: z.enum(['private', 'unlisted', 'public']),
  contentType: z.string().regex(/^video\/[\w.+-]+$/).max(100).optional(),
  /** Teto do YouTube: 256 GiB. */
  contentLength: z.number().int().positive().max(256 * 1024 ** 3).optional(),
})

const GENERIC_FAILURE = 'Could not open the YouTube upload session. Try again.'

function isGoogleUploadUrl(raw: string | null): boolean {
  if (!raw) return false
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && (u.hostname === 'googleapis.com' || u.hostname.endsWith('.googleapis.com'))
  } catch {
    return false
  }
}

function missingScope(channelName: string) {
  return NextResponse.json(
    {
      error: `The connection for "${channelName}" lacks the youtube.upload permission. Reconnect the channel to grant it.`,
      code: 'missing_scope',
    },
    { status: 403 },
  )
}

function hasUploadScope(scopes: readonly string[] | null): boolean {
  return (scopes ?? []).some((s) => s === 'youtube.upload' || s.endsWith('/auth/youtube.upload'))
}

export async function POST(req: NextRequest) {
  const { siteId } = await getSiteContext()
  // Publicar, não só editar: o upload usa a credencial do dono do canal, e `reporter`
  // (can_edit_site, sem can_publish_site) não pode abrir sessão com ela.
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'publish' })
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = UploadSessionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const body = parsed.data
  const supabase = getSupabaseServiceClient()

  // 1. Qual canal. Sempre filtrado por site: canal de outro site nunca resolve.
  let accountId: string
  let channelName: string
  try {
    if (body.channel) {
      const column = UC_ID.test(body.channel) ? 'channel_id' : 'id'
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('channel_id, name')
        .eq('site_id', siteId)
        .eq(column, body.channel)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
      }
      accountId = data.channel_id
      channelName = data.name
    } else {
      const def = await defaultOwnChannel(supabase, siteId)
      if (!def) {
        return NextResponse.json({ error: 'This site has no YouTube channel' }, { status: 404 })
      }
      accountId = def.channelId
      channelName = def.name
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'youtube-upload-session' }, extra: { siteId } })
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 500 })
  }

  // 2. Escopo concedido à conexão viva deste canal (a coluna `scopes` é gravada no callback).
  const { data: conn, error: connError } = await supabase
    .from('social_connections')
    .select('scopes')
    .eq('site_id', siteId)
    .eq('provider', 'youtube')
    .eq('account_id', accountId)
    .is('revoked_at', null)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle() // duas conexões vivas da mesma conta: a mais recente, como ensureFreshToken
  if (connError) {
    Sentry.captureException(new Error(`upload-session connection read failed: ${connError.message}`), {
      tags: { area: 'youtube-upload-session' },
      extra: { siteId, accountId },
    })
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 500 })
  }
  if (!conn) return notConnected(channelName)
  if (!hasUploadScope(conn.scopes)) {
    return missingScope(channelName)
  }

  // 3. Token fresco da conta deste canal (nunca sai desta função).
  let accessToken: string
  try {
    accessToken = (await ensureFreshToken(siteId, 'youtube', accountId)).accessToken
  } catch (err) {
    if (err instanceof NoActiveConnectionError) return notConnected(channelName)
    if (err instanceof TokenRevokedError) {
      return NextResponse.json(
        {
          error: `Google revoked access for "${channelName}". Reconnect the channel.`,
          code: 'token_revoked',
        },
        { status: 409 },
      )
    }
    Sentry.captureException(err, { tags: { area: 'youtube-upload-session' }, extra: { siteId, accountId } })
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 502 })
  }

  const metadata = {
    snippet: {
      title: body.title,
      description: body.description ?? '',
      tags: body.tags ?? [],
      categoryId: body.categoryId ?? '22',
    },
    status: { privacyStatus: body.privacyStatus },
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': body.contentType ?? 'video/*',
  }
  if (body.contentLength) headers['X-Upload-Content-Length'] = String(body.contentLength)

  let res: Response
  try {
    res = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(15_000),
      },
    )
  } catch {
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 502 })
  }

  if (res.status === 403) {
    // Google recusou a abertura: na prática o consentimento não inclui youtube.upload.
    Sentry.captureMessage('youtube upload-session: Google answered 403', {
      level: 'warning',
      tags: { area: 'youtube-upload-session', status: '403' },
      extra: { siteId, accountId },
    })
    return missingScope(channelName)
  }

  if (!res.ok) {
    // O corpo do Google não volta ao cliente nem vai a log: só o status.
    Sentry.captureMessage('youtube upload-session rejected by Google', {
      level: 'warning',
      tags: { area: 'youtube-upload-session', status: String(res.status) },
      extra: { siteId, accountId },
    })
    return NextResponse.json({ error: `YouTube API error: ${res.status}` }, { status: 502 })
  }

  // O desenho original devolve a URL da sessão: o navegador envia o vídeo direto ao Google
  // (a função não carrega o arquivo). A URL carrega um upload_id, não o access token.
  const uploadUri = res.headers.get('location')
  if (!uploadUri || !isGoogleUploadUrl(uploadUri)) {
    // Nunca repassa uma URL que não seja do Google; a URL em si não vai ao Sentry.
    Sentry.captureMessage('youtube upload-session: missing or non-Google Location header', {
      level: 'warning',
      tags: { area: 'youtube-upload-session' },
      extra: { siteId, accountId, hadLocation: Boolean(uploadUri) },
    })
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 502 })
  }

  return NextResponse.json({ uploadUri, channel: { channelId: accountId, name: channelName } })
}

function notConnected(channelName: string) {
  return NextResponse.json(
    {
      error: `The channel "${channelName}" has no YouTube connection. Connect the channel first.`,
      code: 'channel_not_connected',
    },
    { status: 409 },
  )
}
