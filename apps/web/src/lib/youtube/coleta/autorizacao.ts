// Estado de autorização do canal (spec, seção 6, "Autorização" — lote L1b).
// `reautorizar` = o canal perdeu a autorização do YouTube: a coleta por token para, nada é apagado e o dono é
// avisado. Volta a `ok` sozinho quando o token volta a passar, ou pelo callback do OAuth.
import { ensureFreshToken, NoActiveConnectionError, TokenRevokedError } from '@/lib/social/token-refresh'
import { avisarEntrada, avisarSaida } from './alerts'
import { registrarTentativa } from './attempts'
import { comPrazo, restante, SemTempoError } from './clock'
import { conferirBanco, type ErroBanco } from './schema'
import type { ColetaChannel, StepCtx, Tentativa } from './types'

type CtxAut = Pick<StepCtx, 'supabase' | 'falhas' | 'tentativas'>
export type ClasseToken = 'reautorizar' | 'sem_conexao' | 'outro'

/**
 * O que um erro de `ensureFreshToken` significa para a coleta.
 * O caso comum de revogação é o SEGUNDO dia: o token revogado marca a conexão antes de lançar, e dali em diante só
 * aparece "sem conexão". Por isso "sem conexão" com uma conexão revogada deste canal também é `reautorizar`.
 * Leitura que falha não é "sem conexão revogada": devolve `outro` e a falha de banco fica em `falhas`.
 */
export async function classificarErroDeToken(ctx: CtxAut, c: ColetaChannel, e: unknown): Promise<ClasseToken> {
  if (e instanceof TokenRevokedError) return 'reautorizar'
  if (!(e instanceof NoActiveConnectionError)) return 'outro'
  let r: { data: unknown; error: ErroBanco | null }
  try {
    r = await ctx.supabase
      .from('social_connections')
      .select('id')
      .eq('site_id', c.site_id)
      .eq('provider', 'youtube')
      .eq('account_id', c.channel_id)
      .not('revoked_at', 'is', null)
      .limit(1)
  } catch {
    r = { data: null, error: { code: null, message: 'leitura lançou' } }
  }
  if (conferirBanco(r, 'social_connections', ctx.falhas, 'ler') !== 'ok') return 'outro'
  return ((r.data ?? []) as unknown[]).length > 0 ? 'reautorizar' : 'sem_conexao'
}

async function gravarCanal(ctx: CtxAut, c: ColetaChannel, patch: Record<string, unknown>): Promise<boolean> {
  let r: { error: ErroBanco | null }
  try {
    r = await ctx.supabase.from('youtube_channels').update(patch).eq('id', c.id)
  } catch {
    r = { error: { code: null, message: 'update lançou' } }
  }
  return conferirBanco(r, 'youtube_channels', ctx.falhas) === 'ok'
}

/** Marca o canal e avisa (entrada, e lembrete a cada 7 dias). Se a gravação falhar, nada mais acontece. Nunca lança. */
export async function marcarReautorizar(ctx: CtxAut, c: ColetaChannel): Promise<void> {
  if (c.collection_status !== 'reautorizar') {
    if (!(await gravarCanal(ctx, c, { collection_status: 'reautorizar' }))) return
    c.collection_status = 'reautorizar'
  }
  await avisarEntrada(ctx, c, 'reautorizar')
}

/** Uma chamada autenticada passou: carimba a data e, se o canal estava em `reautorizar`, devolve-o a `ok`. Nunca lança. */
export async function marcarAutorizado(ctx: CtxAut, c: ColetaChannel): Promise<void> {
  const voltou = c.collection_status === 'reautorizar'
  const patch: Record<string, unknown> = { authorization_verified_at: new Date().toISOString() }
  if (voltou) patch.collection_status = 'ok'
  if (!(await gravarCanal(ctx, c, patch))) return
  if (!voltou) return
  c.collection_status = 'ok'
  await avisarSaida(ctx, c, ['reautorizar'])
}

/**
 * O token do canal para um passo. `null` = o canal foi pulado e a tentativa já está registrada
 * (`sem_autorizacao` quando perdeu a autorização, `sem_conexao` quando nunca foi conectado).
 * Lança `SemTempoError` quando o prazo do passo acaba, e relança qualquer outro erro (falha do passo, estado inalterado).
 */
export async function obterToken(
  ctx: StepCtx,
  c: ColetaChannel,
  base: Omit<Tentativa, 'outcome' | 'http_status' | 'error'>,
): Promise<string | null> {
  let token: string
  try {
    const t = await comPrazo(ensureFreshToken(c.site_id, 'youtube', c.channel_id), ctx.deadline)
    if (!t) {
      if (restante(ctx.deadline) <= 0) throw new SemTempoError()
      throw new Error('token refresh timed out')
    }
    token = t.accessToken
  } catch (e) {
    if (e instanceof SemTempoError) throw e
    const classe = await classificarErroDeToken(ctx, c, e)
    if (classe === 'outro') throw e
    if (classe === 'reautorizar') await marcarReautorizar(ctx, c)
    await registrarTentativa(ctx, { ...base, outcome: classe === 'reautorizar' ? 'sem_autorizacao' : 'sem_conexao' })
    return null
  }
  // O token voltou a passar num canal marcado: o estado volta a `ok` sem esperar o OAuth.
  if (c.collection_status === 'reautorizar') await marcarAutorizado(ctx, c)
  return token
}
