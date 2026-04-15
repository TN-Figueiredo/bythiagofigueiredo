import pRetry, { AbortError } from 'p-retry';
import { getLogger } from './logger';

export interface BrevoContactParams {
  email: string;
  name?: string;
  listId: number;
  attributes?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface BrevoContactResponse {
  id?: number;
}

const BREVO_CONTACTS_URL = 'https://api.brevo.com/v3/contacts';
const DEFAULT_TIMEOUT_MS = 8000;

export async function createBrevoContact(
  params: BrevoContactParams,
): Promise<BrevoContactResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const body = JSON.stringify({
    email: params.email,
    listIds: [params.listId],
    attributes: { FIRSTNAME: params.name, ...(params.attributes ?? {}) },
    updateEnabled: true,
  });

  const attempt = async (): Promise<BrevoContactResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(BREVO_CONTACTS_URL, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body,
        signal: controller.signal,
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        const err = new Error(`brevo ${r.status}: ${text}`);
        if (r.status >= 400 && r.status < 500) throw new AbortError(err);
        throw err;
      }
      if (r.status === 204) return {};
      return (await r.json()) as BrevoContactResponse;
    } catch (e) {
      // Fetch abort due to timeout → retryable. p-retry's AbortError shares the name,
      // but only instances of its AbortError class halt retries.
      if (e instanceof AbortError) throw e;
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(`brevo timeout after ${timeoutMs}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };

  return pRetry(attempt, {
    retries: 3,
    minTimeout: 200,
    maxTimeout: 1000,
    onFailedAttempt: (e) => {
      getLogger().warn('[brevo_retry] attempt failed', {
        attemptNumber: e.attemptNumber,
        retriesLeft: e.retriesLeft,
        message: e.message,
      });
    },
  });
}
