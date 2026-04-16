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

const BodySchema = z.object({
  password: z.string().min(1),
});

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
