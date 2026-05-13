const GRAPH_BASE = 'https://graph.facebook.com/v25.0'

interface LongLivedTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface PageInfo {
  id: string
  name: string
  access_token: string
}

interface PageListResponse {
  data: PageInfo[]
}

interface IGBusinessAccount {
  ig_user_id: string
  ig_username: string
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string,
): Promise<{ access_token: string; expires_in: number }> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('fb_exchange_token', shortLivedToken)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Meta token exchange failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as LongLivedTokenResponse
  return { access_token: data.access_token, expires_in: data.expires_in }
}

export async function getPageAccessToken(
  userToken: string,
  pageId: string,
): Promise<string> {
  const url = `${GRAPH_BASE}/${pageId}?fields=access_token&access_token=${userToken}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to get page token (${res.status}): ${body}`)
  }

  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

export async function getUserPages(
  userToken: string,
): Promise<Array<{ id: string; name: string; access_token: string }>> {
  const url = `${GRAPH_BASE}/me/accounts?access_token=${userToken}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to list pages (${res.status}): ${body}`)
  }

  const data = (await res.json()) as PageListResponse
  return data.data.map((p) => ({
    id: p.id,
    name: p.name,
    access_token: p.access_token,
  }))
}

export async function getInstagramBusinessAccount(
  pageId: string,
  pageToken: string,
): Promise<IGBusinessAccount | null> {
  const url = `${GRAPH_BASE}/${pageId}?fields=instagram_business_account{id,username}&access_token=${pageToken}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to get IG business account (${res.status}): ${body}`)
  }

  const data = (await res.json()) as {
    instagram_business_account?: { id: string; username: string }
  }

  if (!data.instagram_business_account) return null

  return {
    ig_user_id: data.instagram_business_account.id,
    ig_username: data.instagram_business_account.username,
  }
}

export function buildOAuthUrl(
  appId: string,
  redirectUri: string,
  scopes: string[],
): string {
  const url = new URL('https://www.facebook.com/v25.0/dialog/oauth')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scopes.join(','))
  url.searchParams.set('response_type', 'code')
  return url.toString()
}
