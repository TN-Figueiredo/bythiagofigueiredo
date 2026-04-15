import pRetry, { AbortError } from 'p-retry';

export interface BrevoContactParams {
  email: string;
  name?: string;
  listId: number;
  attributes?: Record<string, unknown>;
}

export interface BrevoContactResponse {
  id?: number;
  [key: string]: unknown;
}

const BREVO_CONTACTS_URL = 'https://api.brevo.com/v3/contacts';

export async function createBrevoContact(
  params: BrevoContactParams,
): Promise<BrevoContactResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const body = JSON.stringify({
    email: params.email,
    listIds: [params.listId],
    attributes: { FIRSTNAME: params.name, ...(params.attributes ?? {}) },
    updateEnabled: true,
  });

  const attempt = async (): Promise<BrevoContactResponse> => {
    const r = await fetch(BREVO_CONTACTS_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body,
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      const err = new Error(`brevo ${r.status}: ${text}`);
      if (r.status >= 400 && r.status < 500) throw new AbortError(err);
      throw err;
    }
    if (r.status === 204) return {};
    return (await r.json()) as BrevoContactResponse;
  };

  return pRetry(attempt, {
    retries: 3,
    minTimeout: 200,
    maxTimeout: 1000,
    onFailedAttempt: (e) => {
      // Sprint 4 replaces this with Sentry.captureException
      console.warn(
        `[brevo_retry] attempt ${e.attemptNumber} failed (${e.retriesLeft} left): ${e.message}`,
      );
    },
  });
}
