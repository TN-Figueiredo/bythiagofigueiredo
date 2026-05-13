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
