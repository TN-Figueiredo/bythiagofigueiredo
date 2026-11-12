// Comandos do dono da C1: `liberar`, `liberar --cliente`, `estender --liberacao`, `cortar`. TODO efeito é por `rpc` (funções SQL `obs_ai_*`,
// só service_role, com o lock da pessoa): este arquivo não faz `.from(...).update/delete` (um teste lê o texto e confere).
// A pessoa e o site saem como em `criarChaveDoPerfil` (`acharPessoas`, `veOSite`). Nenhum agente roda estes comandos.
import type { SupabaseClient } from '@supabase/supabase-js'
import { acharPessoas, veOSite } from './criar-chave'
import { diaDeVencimentoSp } from './vencimento'
import { ACESSO_IA_RULES } from './regras'

export type Cliente = 'claude' | 'chatgpt' | 'gemini'
export type Subcomando =
  | { tipo: 'liberar'; email: string; dias?: number; siteId?: string }
  | { tipo: 'liberar_cliente'; email: string; cliente: Cliente; siteId?: string }
  | { tipo: 'estender_liberacao'; liberacao: string; dias: number }
  | { tipo: 'cortar'; email: string; cliente?: Cliente; siteId?: string }
export type RecusaDeLeitura = 'subcomando' | 'opcao_desconhecida' | 'email_ausente' | 'validade_invalida' | 'cliente_invalido' | 'liberacao_ausente' | 'site_invalido'

export const FRASE_DO_TETO = 'teto de 2 pessoas com acesso: corte alguém antes (cortar --usuario <e-mail>)'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CLIENTES: readonly string[] = ['claude', 'chatgpt', 'gemini']
const SITES_POR_PAGINA = 1000
const SITES_PAGINAS_MAX = 50

/* ---------------------------------------------------------------- argumentos */

/** O despacho de `scripts/observatorio-acesso.ts`: `estender --liberacao` é daqui; `estender --chave` e `criar` são da chave do perfil. */
export function ehSubcomandoDeLiberacao(argv: readonly string[]): boolean {
  const sub = argv[0]
  return sub === 'liberar' || sub === 'cortar' || (sub === 'estender' && argv.includes('--liberacao'))
}

export function lerSubcomando(argv: readonly string[]): { ok: true; s: Subcomando } | { ok: false; recusa: RecusaDeLeitura } {
  const [sub, ...resto] = argv
  if (sub !== 'liberar' && sub !== 'estender' && sub !== 'cortar') return { ok: false, recusa: 'subcomando' }
  const permitidas = sub === 'liberar' ? ['--usuario', '--dias', '--cliente', '--site'] : sub === 'estender' ? ['--liberacao', '--dias'] : ['--usuario', '--cliente', '--site']
  const v: Record<string, string> = {}
  for (let i = 0; i < resto.length; i += 2) {
    const k = resto[i]
    const valor = resto[i + 1]
    if (k === undefined || !permitidas.includes(k) || valor === undefined || valor.startsWith('--')) return { ok: false, recusa: 'opcao_desconhecida' }
    const nome = k.slice(2)
    if (v[nome] !== undefined) return { ok: false, recusa: 'opcao_desconhecida' }
    v[nome] = valor
  }
  const dias = (): number | null | undefined => {
    if (v.dias === undefined) return undefined
    if (!/^\d+$/.test(v.dias)) return null
    const n = Number(v.dias)
    return n >= 1 && n <= ACESSO_IA_RULES.validadeMaxDias ? n : null
  }
  const cliente = (): Cliente | null | undefined => (v.cliente === undefined ? undefined : CLIENTES.includes(v.cliente) ? (v.cliente as Cliente) : null)
  if (sub === 'estender') {
    if (v.liberacao === undefined || !UUID.test(v.liberacao)) return { ok: false, recusa: 'liberacao_ausente' }
    const d = dias()
    if (d === undefined || d === null) return { ok: false, recusa: 'validade_invalida' }
    return { ok: true, s: { tipo: 'estender_liberacao', liberacao: v.liberacao.toLowerCase(), dias: d } }
  }
  if (v.usuario === undefined || v.usuario.trim() === '') return { ok: false, recusa: 'email_ausente' }
  const email = v.usuario
  const c = cliente()
  if (c === null) return { ok: false, recusa: 'cliente_invalido' }
  if (v.site !== undefined && !UUID.test(v.site)) return { ok: false, recusa: 'site_invalido' }
  const site = v.site !== undefined ? { siteId: v.site.toLowerCase() } : {}
  if (sub === 'cortar') return { ok: true, s: { tipo: 'cortar', email, ...(c !== undefined ? { cliente: c } : {}), ...site } }
  if (c !== undefined) {
    if (v.dias !== undefined) return { ok: false, recusa: 'opcao_desconhecida' }
    return { ok: true, s: { tipo: 'liberar_cliente', email, cliente: c, ...site } }
  }
  const d = dias()
  if (d === null) return { ok: false, recusa: 'validade_invalida' }
  return { ok: true, s: { tipo: 'liberar', email, ...(d !== undefined ? { dias: d } : {}), ...site } }
}

/* ---------------------------------------------------------------- a conferência (K14) */

/** Texto de uma `Conferencia` (lib/conferencias.ts) para o dono colar: id `e17d2-liberacao-<8 do id>-vence-AAAAMMDD`, data = vencimento (dia de SP) menos 14 dias. */
export function entradaDeConferencia(liberacaoId: string, expiresAtIso: string): string {
  const v = diaDeVencimentoSp(expiresAtIso)
  const dd = String(v.dia).padStart(2, '0')
  const mm = String(v.mes).padStart(2, '0')
  const curto = liberacaoId.slice(0, 8)
  const id = `e17d2-liberacao-${curto}-vence-${v.ano}${mm}${dd}`
  const onde = `a liberação ${curto} do acesso por OAuth vence em ${dd}/${mm}. Decida estender (comando estender --liberacao ${liberacaoId} --dias N) ou deixar vencer; nos dois casos marque esta conferência como feita`
  return `{ id: '${id}', etapa: 'E17', data: '${v.avisoEm}', responsavel: 'dono', onde: '${onde}', feitaEm: null },`
}

/* ---------------------------------------------------------------- o núcleo */

type Resultado = { ok: true; linhas: string[] } | { ok: false; recusa: string; code?: string }
const falha = (recusa: string, code?: string): { ok: false; recusa: string; code?: string } => ({ ok: false, recusa, ...(code ? { code } : {}) })
const codigoDe = (e: { code?: unknown } | null | undefined): string => (typeof e?.code === 'string' && e.code !== '' ? e.code : 'desconhecido')
const ehTexto = (x: unknown): x is string => typeof x === 'string'

/** Chama a função SQL; devolve as linhas, ou o código do erro. Resposta que não é lista = forma inválida (nunca "vazio = ok"). */
async function chamar(sb: SupabaseClient, nome: string, args: Record<string, unknown>): Promise<{ linhas: Array<Record<string, unknown>> } | { erro: string }> {
  try {
    const { data, error } = await sb.rpc(nome, args)
    if (error) return { erro: codigoDe(error as { code?: unknown }) }
    if (!Array.isArray(data)) return { erro: 'forma_invalida' }
    return { linhas: data as Array<Record<string, unknown>> }
  } catch { return { erro: 'excecao' } }
}

/** A pessoa pelo e-mail e o único site que ela vê. */
async function acharPessoaESite(sb: SupabaseClient, emailBruto: string, siteIdPedido?: string): Promise<{ userId: string; siteId: string } | { falha: ReturnType<typeof falha> }> {
  const email = emailBruto.trim().toLowerCase()
  if (email === '') return { falha: falha('email_ausente') }
  const pessoas = await acharPessoas(sb, email)
  if ('erro' in pessoas) return { falha: falha('nao_conferido', pessoas.erro) }
  if (pessoas.ids.length === 0) return { falha: falha('email_ausente') }
  if (pessoas.ids.length > 1) return { falha: falha('email_ambiguo') }
  const userId = pessoas.ids[0]!
  if (siteIdPedido !== undefined) {
    if (!UUID.test(siteIdPedido)) return { falha: falha('sem_acesso_ao_site') }
    const v = await veOSite(sb, userId, siteIdPedido)
    if (typeof v === 'object') return { falha: falha('nao_conferido', v.erro) }
    if (!v) return { falha: falha('sem_acesso_ao_site') }
    return { userId, siteId: siteIdPedido }
  }
  const ids: string[] = []
  try {
    for (let pagina = 0; ; pagina++) {
      if (pagina >= SITES_PAGINAS_MAX) return { falha: falha('nao_conferido', 'listagem_sem_fim') }
      const r = await sb.from('sites').select('id').order('id').range(pagina * SITES_POR_PAGINA, (pagina + 1) * SITES_POR_PAGINA - 1)
      if (r.error) return { falha: falha('nao_conferido', codigoDe(r.error)) }
      const lote = (r.data ?? []) as Array<{ id?: unknown }>
      for (const s of lote) if (typeof s.id === 'string') ids.push(s.id)
      if (lote.length < SITES_POR_PAGINA) break
    }
  } catch { return { falha: falha('nao_conferido', 'excecao') } }
  const vistos: string[] = []
  for (const id of ids) {
    const v = await veOSite(sb, userId, id)
    if (typeof v === 'object') return { falha: falha('nao_conferido', v.erro) }
    if (v) vistos.push(id)
  }
  if (vistos.length === 0) return { falha: falha('sem_acesso_ao_site') }
  if (vistos.length > 1) return { falha: falha('site_ambiguo') }
  return { userId, siteId: vistos[0]! }
}

export async function executarSubcomando(deps: { sb: SupabaseClient; agora: () => number }, s: Subcomando): Promise<Resultado> {
  const { sb } = deps
  const t = deps.agora()
  if (!Number.isFinite(t)) return falha('nao_conferido', 'relogio')
  const pAgora = new Date(t).toISOString()

  if (s.tipo === 'estender_liberacao') {
    const r = await chamar(sb, 'obs_ai_estender_liberacao', { p_liberacao: s.liberacao, p_dias: s.dias, p_agora: pAgora })
    if ('erro' in r) return falha('nao_conferido', r.erro)
    const l = r.linhas[0]
    if (!l) return falha('nao_conferido', 'forma_invalida')
    if (l.motivo === 'teto') return falha(FRASE_DO_TETO)
    if (ehTexto(l.motivo)) return falha(l.motivo)
    if (!ehTexto(l.expires_at)) return falha('nao_conferido', 'forma_invalida')
    return { ok: true, linhas: [
      `liberação estendida: ${s.liberacao}, agora vence em ${l.expires_at}`,
      'Falta um commit em apps/web/src/lib/conferencias.ts: marque feitaEm (hoje) na entrada antiga desta liberação e acrescente a nova:',
      entradaDeConferencia(s.liberacao, l.expires_at),
    ] }
  }

  const pe = await acharPessoaESite(sb, s.email, s.siteId)
  if ('falha' in pe) return pe.falha

  if (s.tipo === 'liberar') {
    const dias = s.dias ?? ACESSO_IA_RULES.validadeDias
    const r = await chamar(sb, 'obs_ai_liberar', { p_user: pe.userId, p_site: pe.siteId, p_dias: dias, p_agora: pAgora })
    if ('erro' in r) return falha('nao_conferido', r.erro)
    const l = r.linhas[0]
    if (!l) return falha('nao_conferido', 'forma_invalida')
    if (l.motivo === 'teto') return falha(FRASE_DO_TETO)
    if (l.motivo === 'ja_liberada') return falha(`ja_liberada${ehTexto(l.liberacao_id) ? ` (liberação ${l.liberacao_id}; para mudar a validade: estender --liberacao ${l.liberacao_id} --dias N)` : ''}`)
    if (ehTexto(l.motivo)) return falha(l.motivo)
    if (!ehTexto(l.liberacao_id) || !ehTexto(l.expires_at)) return falha('nao_conferido', 'forma_invalida')
    return { ok: true, linhas: [
      `liberação criada: ${l.liberacao_id}, vence em ${l.expires_at}`,
      'Cole em apps/web/src/lib/conferencias.ts a entrada abaixo (senão o aviso de vencimento não existe):',
      entradaDeConferencia(l.liberacao_id, l.expires_at),
    ] }
  }

  if (s.tipo === 'liberar_cliente') {
    const r = await chamar(sb, 'obs_ai_liberar_cliente', { p_user: pe.userId, p_site: pe.siteId, p_cliente: s.cliente })
    if ('erro' in r) return falha('nao_conferido', r.erro)
    const l = r.linhas[0]
    if (!l) return falha('nao_conferido', 'forma_invalida')
    if (ehTexto(l.motivo)) return falha(l.motivo)
    const bloq = Array.isArray(l.bloqueios) ? (l.bloqueios as unknown[]).filter(ehTexto) : []
    return { ok: true, linhas: [`bloqueio de ${s.cliente} apagado; bloqueios que restam: ${bloq.length === 0 ? 'nenhum' : bloq.join(', ')}`] }
  }

  const r = await chamar(sb, 'obs_ai_cortar', { p_user: pe.userId, p_site: pe.siteId, p_cliente: s.cliente ?? null, p_agora: pAgora })
  if ('erro' in r) return falha('nao_conferido', r.erro)
  if (r.linhas.length === 0) return falha('nao_conferido', 'forma_invalida')
  const afetadas = r.linhas.filter((l) => ehTexto(l.tabela) && ehTexto(l.id))
  const sem = r.linhas.find((l) => ehTexto(l.motivo))
  // sem_liberacao COM chave afetada = corte feito (a pessoa só tinha chave Bearer); sem chave afetada = nada a cortar
  if (sem && !(sem.motivo === 'sem_liberacao' && afetadas.length > 0)) return falha(String(sem.motivo))
  if (sem) {
    return { ok: true, linhas: [
      `corte feito: ${afetadas.length} chave(s) Bearer; a pessoa não tinha liberação`,
      ...afetadas.map((l) => `${String(l.tabela)}: ${String(l.id)}`),
    ] }
  }
  return { ok: true, linhas: [
    `corte feito${s.cliente ? ` (só ${s.cliente})` : ''}: ${afetadas.length} linha(s) afetada(s)`,
    ...afetadas.map((l) => `${String(l.tabela)}: ${String(l.id)}`),
  ] }
}
