// F0-b (Yannis B2): invariante "canal próprio conectado => coleta ligada". Só LÊ `social_connections`.
// "Conectado" = linha com provider 'youtube', account_id = youtube_channels.channel_id, mesmo site_id, revoked_at nulo,
// e canal com collection_status <> 'reautorizar' (esse estado vive em youtube_channels, já lido em `channels`).
// REGRA (a de criteria.ts): leitura que falha nunca vira verde; vira `critérios: não foi possível avaliar …` em falhas.
import type { SupabaseClient } from '@supabase/supabase-js'
import { conferirBanco, pushUnico } from './schema'
import type { ColetaChannel } from './types'

export type CriterioConectadosCtx = { supabase: SupabaseClient; falhas: string[]; channels: ColetaChannel[] }

export const notaConectadoDesligado = (nome: string): string =>
  `coleta: ${nome} está conectado com a coleta desligada; ligue a coleta ou desconecte o canal`

/** Devolve as notas de `acao_do_dono`; o vermelho vai direto em `ctx.falhas`. Sem canal desligado, não lê nada. */
export async function criterioConectadoDesligado(ctx: CriterioConectadosCtx): Promise<string[]> {
  const { supabase, falhas, channels } = ctx
  const candidatos = channels.filter(c => !c.sync_enabled && c.collection_status !== 'reautorizar')
  if (candidatos.length === 0) return []
  const res = await supabase
    .from('social_connections')
    .select('account_id, site_id')
    .eq('provider', 'youtube')
    .is('revoked_at', null)
    .in('account_id', candidatos.map(c => c.channel_id))
    .limit(1000)
  if (conferirBanco(res, 'social_connections', falhas, 'ler') !== 'ok') {
    pushUnico(falhas, 'critérios: não foi possível avaliar canais conectados com a coleta desligada (social_connections)')
    return []
  }
  const vivas = (res.data ?? []) as Array<{ account_id: string; site_id: string }>
  const notas: string[] = []
  for (const c of candidatos) {
    if (!vivas.some(v => v.account_id === c.channel_id && v.site_id === c.site_id)) continue
    const nota = notaConectadoDesligado(c.name)
    pushUnico(falhas, nota)
    if (!notas.includes(nota)) notas.push(nota)
  }
  return notas
}
