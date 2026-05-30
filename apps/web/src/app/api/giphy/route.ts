import { NextRequest, NextResponse } from 'next/server'

const GIPHY_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''
  const limit = request.nextUrl.searchParams.get('limit') ?? '12'

  const endpoint = q.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=${limit}&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=${limit}&rating=g`

  const res = await fetch(endpoint)
  const json = await res.json()

  return NextResponse.json(json)
}
