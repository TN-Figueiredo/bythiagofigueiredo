import { NextResponse } from 'next/server'

export function GET(request: Request): Response {
  const host = request.headers.get('x-short-domain') ?? request.headers.get('host') ?? ''
  const baseDomain = host.startsWith('go.') ? host.slice(3) : 'bythiagofigueiredo.com'
  return NextResponse.redirect(`https://${baseDomain}`, 302)
}
