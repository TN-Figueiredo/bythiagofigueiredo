import { BskyAgent } from '@atproto/api'

const DEFAULT_PDS = 'https://bsky.social'

export interface BlueskySession {
  did: string
  handle: string
  accessJwt: string
  refreshJwt: string
}

export async function createSession(
  handle: string,
  appPassword: string,
  pdsUrl?: string,
): Promise<BskyAgent> {
  const agent = new BskyAgent({ service: pdsUrl ?? DEFAULT_PDS })
  await agent.login({ identifier: handle, password: appPassword })
  return agent
}

export async function resumeSession(
  agent: BskyAgent,
  session: BlueskySession,
): Promise<BskyAgent> {
  await agent.resumeSession({
    did: session.did,
    handle: session.handle,
    accessJwt: session.accessJwt,
    refreshJwt: session.refreshJwt,
    active: true,
  })
  return agent
}

// ---------------------------------------------------------------------------
// JWT refresh helpers
// ---------------------------------------------------------------------------

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000

export function isJwtExpiringSoon(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true
  const expiresMs = new Date(expiresAt).getTime()
  return expiresMs - Date.now() < REFRESH_THRESHOLD_MS
}

export async function refreshSession(
  currentSession: BlueskySession,
  pdsUrl?: string,
): Promise<BlueskySession> {
  const agent = new BskyAgent({ service: pdsUrl ?? DEFAULT_PDS })

  await agent.resumeSession({
    did: currentSession.did,
    handle: currentSession.handle,
    accessJwt: currentSession.accessJwt,
    refreshJwt: currentSession.refreshJwt,
    active: true,
  })

  const response = await agent.api.com.atproto.server.refreshSession(undefined, {
    headers: {
      Authorization: `Bearer ${currentSession.refreshJwt}`,
    },
  })

  return {
    did: response.data.did,
    handle: response.data.handle,
    accessJwt: response.data.accessJwt,
    refreshJwt: response.data.refreshJwt,
  }
}
