import { getLogger } from './logger';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DEFAULT_TIMEOUT_MS = 3000;

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export interface VerifyTurnstileOptions {
  timeoutMs?: number;
  expectedHostname?: string;
}

let warnedOnce = false;

export async function verifyTurnstileToken(
  token: string,
  remoteip?: string,
  opts?: VerifyTurnstileOptions,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (!warnedOnce) {
      warnedOnce = true;
      getLogger().error('TURNSTILE_SECRET_KEY is not configured; verifyTurnstileToken will always return false');
    }
    return false;
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteip) body.set('remoteip', remoteip);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: controller.signal,
    });
    if (!r.ok) return false;
    const data = (await r.json()) as SiteverifyResponse;
    if (data.success !== true) {
      getLogger().warn('[turnstile] verification failed', {
        errorCodes: data['error-codes'],
      });
      return false;
    }
    if (opts?.expectedHostname && data.hostname && data.hostname !== opts.expectedHostname) {
      getLogger().warn('[turnstile] hostname mismatch', {
        expected: opts.expectedHostname,
        actual: data.hostname,
      });
      return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
