// O comando de ESTENDER a chave do perfil `observatorio_leitura` (A3b): nova validade, mesmo segredo. Não cria chave, não gera texto, não revoga.
// O único efeito é UM `update` de `expires_at` com compare-and-set (nome + perfil exato + não revogada + validade lida). Fica em arquivo próprio
// porque `criar-chave.ts` é travado por teste a só inserir. Mesmas guardas de entrada do `criar` (E19 conferida, exceção do dono, `--dias` 1..366).
import type { SupabaseClient } from '@supabase/supabase-js'
import { PERFIL, instanteValido } from '@/lib/pipeline/chave'
import { ACESSO_IA_RULES } from './regras'
import { NOME_DA_CHAVE } from './vencimento'

export interface PedidoDeEstender { chave: string; dias?: number }
export type RecusaDeEstender =
  | 'subcomando' | 'opcao_desconhecida' | 'travas' | 'excecao_ausente' | 'chave_ausente' | 'nome_invalido' | 'validade_invalida'
  | 'chave_inexistente' | 'chave_revogada' | 'perfil_diferente' | 'vencida_ha_mais_de_30_dias' | 'ja_vale_ate' | 'sem_vinculo' | 'pessoa_banida'
  | 'nada_mudou' | 'nao_conferido'
export type ResultadoDeEstender =
  | { ok: true; nome: string; venceAntes: string; venceAgora: string }
  | { ok: false; recusa: RecusaDeEstender; code?: string; venceEm?: string }

export interface DepsDeEstender {
  sb: SupabaseClient
  agora: () => number
  e19: () => { ok: true } | { ok: false; motivo: string }
  excecaoEm: string | null
}

const DIA_MS = 86_400_000
const TRES_HORAS_MS = 3 * 3_600_000
export const CARENCIA_DIAS = 30

/** O dia de São Paulo (AAAA-MM-DD) de um instante ISO. */
export const diaDeSp = (iso: string): string => new Date(Date.parse(iso) - TRES_HORAS_MS).toISOString().slice(0, 10)

export function lerArgumentosDeEstender(argv: readonly string[]): { ok: true; pedido: PedidoDeEstender } | { ok: false; recusa: 'subcomando' | 'opcao_desconhecida' | 'chave_ausente' | 'validade_invalida' } {
  const [sub, ...resto] = argv
  if (sub !== 'estender') return { ok: false, recusa: 'subcomando' }
  const v: { chave?: string; dias?: string } = {}
  for (let i = 0; i < resto.length; i += 2) {
    const k = resto[i]
    const valor = resto[i + 1]
    if ((k !== '--chave' && k !== '--dias') || valor === undefined || valor.startsWith('--')) return { ok: false, recusa: 'opcao_desconhecida' }
    const nome = k.slice(2) as 'chave' | 'dias'
    if (v[nome] !== undefined) return { ok: false, recusa: 'opcao_desconhecida' }
    v[nome] = valor
  }
  if (v.chave === undefined || v.chave.trim() === '') return { ok: false, recusa: 'chave_ausente' }
  let dias: number | undefined
  if (v.dias !== undefined) {
    if (!/^\d+$/.test(v.dias)) return { ok: false, recusa: 'validade_invalida' }
    dias = Number(v.dias)
  }
  return { ok: true, pedido: { chave: v.chave, ...(dias !== undefined ? { dias } : {}) } }
}

const falha = (recusa: RecusaDeEstender, extra: { code?: string; venceEm?: string } = {}): { ok: false; recusa: RecusaDeEstender; code?: string; venceEm?: string } => ({ ok: false, recusa, ...extra })
const codigoDe = (e: { code?: unknown } | null | undefined): string => (typeof e?.code === 'string' && e.code !== '' ? e.code : 'desconhecido')

export async function estenderChaveDoPerfil(deps: DepsDeEstender, p: PedidoDeEstender): Promise<ResultadoDeEstender> {
  const { sb, agora } = deps
  if (!deps.e19().ok) return falha('travas')
  if (deps.excecaoEm === null || deps.excecaoEm === '') return falha('excecao_ausente')
  const dias = p.dias ?? ACESSO_IA_RULES.validadeMaxDias
  if (!Number.isInteger(dias) || dias < 1 || dias > ACESSO_IA_RULES.validadeMaxDias) return falha('validade_invalida')
  const t = agora()
  if (!Number.isFinite(t)) return falha('nao_conferido', { code: 'relogio' })
  const nome = typeof p.chave === 'string' ? p.chave.trim() : ''
  if (nome === '') return falha('chave_ausente')
  if (!NOME_DA_CHAVE.test(nome)) return falha('nome_invalido')
  // a linha
  let linha: { site_id?: unknown; user_id?: unknown; expires_at?: unknown; permissions?: unknown; revoked_at?: unknown } | undefined
  try {
    const r = await sb.from('pipeline_api_keys').select('name, site_id, user_id, expires_at, permissions, revoked_at').eq('name', nome)
    if (r.error) return falha('nao_conferido', { code: codigoDe(r.error) })
    const linhas = (r.data ?? []) as Array<NonNullable<typeof linha>>
    if (linhas.length === 0) return falha('chave_inexistente')
    if (linhas.length > 1) return falha('nao_conferido', { code: 'nome_repetido' })
    linha = linhas[0]
  } catch { return falha('nao_conferido', { code: 'excecao' }) }
  if (linha!.revoked_at !== null && linha!.revoked_at !== undefined) return falha('chave_revogada')
  const perms = linha!.permissions
  if (!Array.isArray(perms) || perms.length !== 1 || perms[0] !== PERFIL) return falha('perfil_diferente')
  const lido = linha!.expires_at
  if (typeof lido !== 'string' || !instanteValido(lido)) return falha('nao_conferido', { code: 'validade_invalida' })
  const atual = Date.parse(lido)
  if (atual < t - CARENCIA_DIAS * DIA_MS) return falha('vencida_ha_mais_de_30_dias', { venceEm: diaDeSp(lido) })
  const nova = t + dias * DIA_MS
  if (nova < atual) return falha('ja_vale_ate', { venceEm: diaDeSp(lido) })
  // a pessoa: vínculo com o site e sem apagamento/banimento (user_id nulo = pessoa apagada)
  const userId = linha!.user_id
  const siteId = linha!.site_id
  if (typeof userId !== 'string' || typeof siteId !== 'string') return falha('sem_vinculo')
  try {
    const { data, error } = await sb.rpc('can_view_site_as', { p_user: userId, p_site: siteId })
    if (error) return falha('nao_conferido', { code: codigoDe(error) })
    if (typeof data !== 'boolean') return falha('nao_conferido', { code: 'forma_invalida' })
    if (!data) return falha('sem_vinculo')
  } catch { return falha('nao_conferido', { code: 'excecao' }) }
  try {
    const u = await sb.auth.admin.getUserById(userId)
    if (u.error) {
      const e = u.error as { status?: number; code?: string }
      // só "não existe" é definitivo; timeout/500 do Auth é "não conferido, rode de novo"
      if (e.status === 404 || e.code === 'user_not_found') return falha('sem_vinculo')
      return falha('nao_conferido', { code: codigoDe(e) })
    }
    if (!u.data?.user) return falha('sem_vinculo')
    const banido = (u.data.user as { banned_until?: string | null }).banned_until
    // mesma regra de lib/lgpd/account-status-cache: banned_until preenchido = banida (passado, futuro ou ilegível)
    if (banido !== null && banido !== undefined && banido !== '') return falha('pessoa_banida')
  } catch { return falha('nao_conferido', { code: 'excecao' }) }
  // o efeito: UM update com CAS
  const venceAgora = new Date(nova).toISOString()
  try {
    const { data, error } = await sb.from('pipeline_api_keys')
      .update({ expires_at: venceAgora })
      .eq('name', nome).eq('permissions', `{${PERFIL}}`).is('revoked_at', null).eq('expires_at', lido)
      .select('name')
    if (error) return falha('nao_conferido', { code: codigoDe(error) })
    if (!Array.isArray(data) || data.length === 0) return falha('nada_mudou')
  } catch { return falha('nao_conferido', { code: 'excecao' }) }
  return { ok: true, nome, venceAntes: lido, venceAgora }
}
