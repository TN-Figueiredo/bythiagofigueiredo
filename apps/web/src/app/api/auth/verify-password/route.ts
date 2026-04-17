import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import {
  requireUser,
  createServerClient,
  UnauthenticatedError,
} from '@tn-figueiredo/auth-nextjs/server';
import {
  signRecentlyVerified,
  LGPD_VERIFY_COOKIE_NAME,
  LGPD_VERIFY_MAX_AGE_SEC,
} from '@/lib/lgpd/verify-cookie';
import { verifyPasswordRateLimiter } from '@/lib/lgpd/verify-password-rate-limiter';

const BodySchema = z.object({
  password: z.string().min(1),
});

// P1-5 (Sprint 5a): rate-limit verify-password to 5 attempts per hour
// per-user. Closes the brute-force gap where an attacker with a stolen
// session cookie could hammer the endpoint. The singleton is imported
// from `@/lib/lgpd/verify-password-rate-limiter` so the route file only
// exports route handlers — Next.js rejects any other export name.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/auth/verify-password
 *
 * Re-authenticates the current user via password. Used as a pre-flight for
 * high-risk actions (account deletion). Signs out the ephemeral browser-
 * client session immediately after validation so the original server session
 * cookies continue to be the authoritative one.
 *
 * Contract:
 *  - 401 { valid: false } if no session OR password wrong
 *  - 400 if body invalid
 *  - 200 { valid: true } on success
 */
export async function POST(req: Request): Promise<Response> {
  const cookieStore = await cookies();
  const serverClient = createServerClient({
    env: {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  let user: { id: string; email: string };
  try {
    user = await requireUser(serverClient);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
    throw err;
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    parsed = BodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // P1-5: rate-limit check BEFORE hitting Supabase Auth. Uses the
  // `isAllowed(key, max, windowMs)` API from @tn-figueiredo/audit —
  // sliding-window semantics: each call increments the count, returns
  // false once the window's count reaches `max`. We key on the user's
  // stable auth id so a signed-in attacker can't bypass by rotating
  // IPs/headers.
  const rlKey = `verify-password:${user.id}`;
  const allowed = await verifyPasswordRateLimiter.isAllowed(
    rlKey,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!allowed) {
    return NextResponse.json(
      {
        valid: false,
        error: 'rate_limited',
        retryAfterSec: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
      },
    );
  }

  // Ephemeral, session-less client — does NOT touch cookies, so the user's
  // primary server-side session remains the authoritative one. We explicitly
  // signOut() to revoke the just-issued refresh token server-side.
  const ephemeral = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await ephemeral.auth.signInWithPassword({
    email: user.email,
    password: parsed.password,
  });
  if (error) {
    try {
      await ephemeral.auth.signOut();
    } catch {
      /* best-effort */
    }
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  try {
    await ephemeral.auth.signOut();
  } catch {
    /* best-effort */
  }

  // P1-5: correct password → reset the rate-limit counter so a legitimate
  // user who just recovered from a typo isn't stuck at 1/5 for an hour.
  try {
    verifyPasswordRateLimiter._store.delete(rlKey);
  } catch {
    /* store introspection is best-effort — a failure here doesn't change
       the correctness of the 429 gating above, it just means the counter
       ticks down naturally by its window reset. */
  }

  // Fix 14 (Sprint 5a): server-enforced password re-auth. Set a signed,
  // HTTPOnly cookie that /api/lgpd/request-deletion + /api/lgpd/request-export
  // verify on each call. Cookie TTL is 300s — forces a fresh prompt for
  // every high-risk action. Signing key is LGPD_VERIFY_SECRET (falls back
  // to CRON_SECRET; both empty → signRecentlyVerified throws).
  try {
    const signed = signRecentlyVerified(user.id);
    cookieStore.set(LGPD_VERIFY_COOKIE_NAME, signed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: LGPD_VERIFY_MAX_AGE_SEC,
      path: '/',
    });
  } catch (e) {
    // Fail the whole flow rather than return 200 without the cookie —
    // that would silently downgrade enforcement to "password matched but
    // no server proof". Client should see 500 + retry after env fix.
    return NextResponse.json(
      {
        valid: false,
        error: 'verify_cookie_signing_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ valid: true }, { status: 200 });
}
