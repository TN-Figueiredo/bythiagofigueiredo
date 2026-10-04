import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import * as Sentry from '@sentry/nextjs'
import { byRegistration } from './showcase'

/**
 * UMA regra para "o canal padrão" quando ninguém pediu um canal (painel, prompts, recursos
 * MCP, tela de analytics): o primeiro canal, em ordem de cadastro, que tem conexão OAuth
 * viva; se nenhum tem, o primeiro em ordem de cadastro. Canal explícito sempre vence — quem
 * chama só usa esta função quando não recebeu um.
 */
export interface DefaultOwnChannel {
  /** uuid de `youtube_channels.id` */
  id: string
  /** id "UC…" (= `social_connections.account_id`) */
  channelId: string
  name: string
  /** false quando nenhum canal do site tem OAuth e este é só o mais antigo */
  hasConnection: boolean
}

interface ChannelRow {
  id: string
  channel_id: string
  name: string
  locale: string
  created_at: string | null
}

/** Pura: escolhe entre linhas já lidas. */
export function pickDefaultChannel<T extends { id: string; channel_id: string; locale: string; created_at?: string | null }>(
  channels: readonly T[],
  connectedAccountIds: ReadonlySet<string>,
): { channel: T; hasConnection: boolean } | null {
  const ordered = byRegistration(channels)
  const connected = ordered.find((c) => connectedAccountIds.has(c.channel_id))
  if (connected) return { channel: connected, hasConnection: true }
  const first = ordered[0]
  return first ? { channel: first, hasConnection: false } : null
}

/** Lê canais e conexões vivas do site. Erro de banco LANÇA: nunca vira "sem canal". */
export async function defaultOwnChannel(
  supabase: SupabaseClient<Database>,
  siteId: string,
): Promise<DefaultOwnChannel | null> {
  const [connRes, chRes] = await Promise.all([
    supabase
      .from('social_connections')
      .select('account_id')
      .eq('site_id', siteId)
      .eq('provider', 'youtube')
      .is('revoked_at', null),
    supabase.from('youtube_channels').select('id, channel_id, name, locale, created_at').eq('site_id', siteId),
  ])
  // O texto do Postgres vai só para o Sentry: esta mensagem chega crua ao cliente MCP e à tela.
  if (connRes.error || chRes.error) {
    Sentry.captureException(new Error(`defaultOwnChannel read failed: ${(connRes.error ?? chRes.error)!.message}`), {
      tags: { area: 'default-channel' },
      extra: { siteId, connections: connRes.error?.message ?? null, channels: chRes.error?.message ?? null },
    })
    throw new Error('Failed to read YouTube channels')
  }

  const connected = new Set((connRes.data ?? []).map((c) => c.account_id as string))
  const picked = pickDefaultChannel((chRes.data ?? []) as ChannelRow[], connected)
  if (!picked) return null
  return {
    id: picked.channel.id,
    channelId: picked.channel.channel_id,
    name: picked.channel.name,
    hasConnection: picked.hasConnection,
  }
}

/**
 * O canal ativo da tela de analytics: o explícito válido vence; um `?channel=` ausente OU
 * inválido cai no canal padrão (não no primeiro da lista); sem padrão conectado, o primeiro.
 */
export function pickActiveChannel<T extends { channelId: string }>(
  connected: readonly T[],
  selectedChannelId: string | undefined,
  defaultChannelId: string | undefined,
): T | undefined {
  return (
    connected.find((c) => c.channelId === selectedChannelId) ??
    connected.find((c) => c.channelId === defaultChannelId) ??
    connected[0]
  )
}
