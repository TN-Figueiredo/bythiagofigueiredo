const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

export async function verifyTurnstileToken(
  token: string,
  remoteip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteip) body.set('remoteip', remoteip);

  try {
    const r = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    if (!r.ok) return false;
    const data = (await r.json()) as SiteverifyResponse;
    return data.success === true;
  } catch {
    return false;
  }
}
