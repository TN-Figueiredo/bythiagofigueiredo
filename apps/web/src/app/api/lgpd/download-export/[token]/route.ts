import { NextResponse } from 'next/server';
import { createLgpdContainer } from '@/lib/lgpd/container';
import { getLogger } from '../../../../../../lib/logger';

interface RouteCtx {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/lgpd/download-export/[token]
 *
 * Email-link handler for the "your data export is ready" notification.
 * The container:
 *  - validates the token + expiry against `lgpd_requests`
 *  - generates a 10-minute signed URL ON DEMAND (never storing the URL)
 *
 * We then 302-redirect so the browser navigates directly to the storage
 * host. `Cache-Control: no-store` prevents CDNs / browser history from
 * caching the short-lived URL.
 */
export async function GET(req: Request, ctx: RouteCtx): Promise<Response> {
  void req;
  const { token } = await ctx.params;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 });
  }

  try {
    const container = createLgpdContainer();
    const { signedUrl } = await container.dataExport.download(token);
    return new NextResponse(null, {
      status: 302,
      headers: {
        location: signedUrl,
        'cache-control': 'no-store, no-cache, must-revalidate, private',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/invalid_token|expired|not_found/i.test(msg)) {
      return NextResponse.json({ error: 'token_invalid' }, { status: 410 });
    }
    getLogger().error('[lgpd_download_export_failed]', { message: msg });
    return NextResponse.json({ error: 'download_failed' }, { status: 500 });
  }
}
