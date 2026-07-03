import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const theme = body?.theme

  if (theme !== 'dark' && theme !== 'light') {
    return NextResponse.json({ error: 'invalid theme' }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  // Add `Secure` in production so the theme cookie is only ever sent over HTTPS.
  // Kept off in dev because localhost is plain HTTP (a Secure cookie would be dropped).
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.headers.set(
    'set-cookie',
    `btf_theme=${theme}; Path=/; SameSite=Lax; Max-Age=31536000; HttpOnly${secure}`,
  )
  return res
}
