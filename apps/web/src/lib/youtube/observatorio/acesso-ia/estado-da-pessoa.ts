// C1 F4 T21b: o estado da liberação DA PESSOA da sessão (página "Conectar sua IA", item do menu, linha do Observatório).
// `classificarLiberacoes` é pura: o tempo entra por `agoraMs`. Dado ausente ou ilegível NUNCA vira "nunca teve acesso": vira `erro`.
import type { SupabaseClient } from '@supabase/supabase-js'
import { instanteValido } from '@/lib/pipeline/chave'
import { diaDeVencimentoSp } from './vencimento'

export type IaDaPagina = 'chatgpt' | 'claude'
export type EstadoDaPessoa =
  | { tipo: 'ativa'; ate: string | null; bloqueadas: IaDaPagina[] }
  | { tipo: 'vencida'; em: string | null }
  | { tipo: 'cortada' }
  | { tipo: 'nunca' }
  | { tipo: 'erro' }

const IAS: readonly IaDaPagina[] = ['chatgpt', 'claude']
const pad = (n: number): string => String(n).padStart(2, '0')

function dataBr(expiresAt: unknown): string | null {
  if (typeof expiresAt !== 'string' || !instanteValido(expiresAt)) return null
  const d = diaDeVencimentoSp(expiresAt)
  return `${pad(d.dia)}/${pad(d.mes)}/${d.ano}`
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function classificarLiberacoes(linhas: unknown, agoraMs: number): EstadoDaPessoa {
  if (!Array.isArray(linhas)) return { tipo: 'erro' }
  const lista = linhas.filter(ehObjeto)
  if (lista.length !== linhas.length) return { tipo: 'erro' }
  const aberta = lista.find((l) => l.revoked_at === null || l.revoked_at === undefined)
  if (aberta) {
    const exp = aberta.expires_at
    const bloqueadas = bloqueadasDe(aberta.bloqueios)
    if (typeof exp !== 'string' || !instanteValido(exp)) {
      if (bloqueadas.length === IAS.length) return { tipo: 'cortada' }
      return { tipo: 'ativa', ate: null, bloqueadas }
    }
    if (Date.parse(exp) > agoraMs) {
      if (bloqueadas.length === IAS.length) return { tipo: 'cortada' }
      return { tipo: 'ativa', ate: dataBr(exp), bloqueadas }
    }
    return { tipo: 'vencida', em: dataBr(exp) }
  }
  const recente = lista[0] // a leitura já vem ordenada por created_at desc
  if (!recente) return { tipo: 'nunca' }
  if (recente.revogada_por === 'dono') return { tipo: 'cortada' }
  if (recente.revogada_por === 'vencida') return { tipo: 'vencida', em: dataBr(recente.expires_at) }
  if (recente.revogada_por === 'lgpd') return { tipo: 'nunca' }
  return { tipo: 'erro' } // motivo desconhecido: não afirma nada
}

function bloqueadasDe(b: unknown): IaDaPagina[] {
  const lista = Array.isArray(b) ? b : []
  return IAS.filter((ia) => lista.includes(ia))
}

/** Leitura com o cliente de SERVIÇO (a RLS só deixa `can_admin_site_users` ler; o cliente da irmã veria zero linhas). Só leitura, só as 5 colunas,
 *  sempre filtrada pelo `userId` da sessão. Erro ou exceção = `erro`. */
export async function lerEstadoDaPessoa(
  sb: SupabaseClient,
  q: { userId: string; siteId: string; agoraMs: number },
): Promise<EstadoDaPessoa> {
  try {
    const { data, error } = await sb
      .from('obs_ai_liberacoes')
      .select('expires_at, revoked_at, revogada_por, bloqueios, created_at')
      .eq('user_id', q.userId)
      .eq('site_id', q.siteId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return { tipo: 'erro' }
    return classificarLiberacoes(data, q.agoraMs)
  } catch {
    return { tipo: 'erro' }
  }
}

export function mostraItemDoMenu(e: EstadoDaPessoa): boolean {
  return e.tipo === 'ativa' || e.tipo === 'vencida' || e.tipo === 'cortada'
}

export function iaInicial(param: string | string[] | undefined, bloqueadas: IaDaPagina[]): IaDaPagina {
  const p = Array.isArray(param) ? param[0] : param
  if ((p === 'chatgpt' || p === 'claude') && !bloqueadas.includes(p)) return p
  return IAS.find((ia) => !bloqueadas.includes(ia)) ?? 'chatgpt'
}
