// O comando de criar a chave do perfil `observatorio_leitura` (plano, 4.10 e Tarefa 15): PREPARADO e TRANCADO. O núcleo tem o cliente injetado e
// só INSERE: este arquivo não atualiza, não apaga e não revoga nada (um teste lê o texto e confere). A casca é `scripts/observatorio-acesso.ts`.
// Guarda: a E19 em recusa e conferida (`deps.e19`, que não lê ambiente) E a exceção do dono no código (`deps.excecaoEm`); sem as duas, nenhuma chave.
// O nome da chave é sempre o gerado (`observatorio-AAAAMMDD-xxxx`): sem dado pessoal, e é a forma que a conferência de vencimento exige.
// A chave é `obs_` mais 32 bytes aleatórios em base64url; só o SHA-256 vai ao banco; o texto sai uma vez, no retorno.
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PERFIL, ehDoPerfil, instanteValido } from '@/lib/pipeline/chave'
import { ACESSO_IA_RULES } from './regras'
import { podeRenovar } from './vencimento'

export interface PedidoDeChave { email: string; dias?: number; siteId?: string }
export type RecusaDeChave =
  | 'subcomando' | 'opcao_desconhecida' | 'travas' | 'excecao_ausente' | 'email_ausente' | 'email_ambiguo' | 'sem_acesso_ao_site'
  | 'site_ambiguo' | 'nome_repetido' | 'ja_tem_chave' | 'teto_de_chaves' | 'validade_invalida' | 'nao_conferido'
export type ResultadoDeCriar =
  | { ok: true; chave: string; nome: string; venceEm: string; siteId: string }
  | { ok: false; recusa: RecusaDeChave; code?: string }

export interface DepsDeCriar {
  sb: SupabaseClient
  agora: () => number
  e19: () => { ok: true } | { ok: false; motivo: string }
  excecaoEm: string | null
  aleatorio: (n: number) => Buffer
}

const DIA_MS = 86_400_000
const TRES_HORAS_MS = 3 * 3_600_000
const POR_PAGINA = 1000
const PAGINAS_MAX = 20
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* ---------------------------------------------------------------- a casca: os argumentos */

/** Só `criar`, com `--usuario`, `--dias` e `--site`. Opção fora disso nunca é ignorada em silêncio. */
export function lerArgumentos(argv: readonly string[]): { ok: true; pedido: PedidoDeChave } | { ok: false; recusa: 'subcomando' | 'opcao_desconhecida' | 'email_ausente' | 'validade_invalida' } {
  const [sub, ...resto] = argv
  if (sub !== 'criar') return { ok: false, recusa: 'subcomando' }
  const v: { usuario?: string; dias?: string; site?: string } = {}
  for (let i = 0; i < resto.length; i += 2) {
    const k = resto[i]
    const valor = resto[i + 1]
    if ((k !== '--usuario' && k !== '--dias' && k !== '--site') || valor === undefined || valor.startsWith('--')) return { ok: false, recusa: 'opcao_desconhecida' }
    const nome = k.slice(2) as 'usuario' | 'dias' | 'site'
    if (v[nome] !== undefined) return { ok: false, recusa: 'opcao_desconhecida' }
    v[nome] = valor
  }
  if (v.usuario === undefined || v.usuario.trim() === '') return { ok: false, recusa: 'email_ausente' }
  let dias: number | undefined
  if (v.dias !== undefined) {
    if (!/^\d+$/.test(v.dias)) return { ok: false, recusa: 'validade_invalida' }
    dias = Number(v.dias)
  }
  return { ok: true, pedido: { email: v.usuario, ...(dias !== undefined ? { dias } : {}), ...(v.site !== undefined ? { siteId: v.site } : {}) } }
}

/* ---------------------------------------------------------------- o núcleo */

const falha = (recusa: RecusaDeChave, code?: string): { ok: false; recusa: RecusaDeChave; code?: string } => ({ ok: false, recusa, ...(code ? { code } : {}) })
const codigoDe = (e: { code?: unknown } | null | undefined): string => (typeof e?.code === 'string' && e.code !== '' ? e.code : 'desconhecido')

/** Leitura de `sites` paginada: o PostgREST corta em 1000 linhas. 50 páginas cheias sem fim = não conferido. */
const SITES_POR_PAGINA = 1000
const SITES_PAGINAS_MAX = 50

/** Percorre a listagem do Auth até o fim (página curta ou vazia). 20 páginas cheias sem fim = não conferido. */
export async function acharPessoas(sb: SupabaseClient, email: string): Promise<{ ids: string[] } | { erro: string }> {
  const ids: string[] = []
  for (let pagina = 1; pagina <= PAGINAS_MAX; pagina++) {
    let r: Awaited<ReturnType<typeof sb.auth.admin.listUsers>>
    try { r = await sb.auth.admin.listUsers({ page: pagina, perPage: POR_PAGINA }) } catch { return { erro: 'excecao' } }
    if (r.error) return { erro: codigoDe(r.error as { code?: unknown }) }
    const usuarios = r.data?.users ?? []
    for (const u of usuarios) if (typeof u.email === 'string' && u.email.trim().toLowerCase() === email && typeof u.id === 'string') ids.push(u.id)
    if (usuarios.length < POR_PAGINA) return { ids }
  }
  return { erro: 'listagem_sem_fim' }
}

export async function veOSite(sb: SupabaseClient, userId: string, siteId: string): Promise<boolean | { erro: string }> {
  try {
    const { data, error } = await sb.rpc('can_view_site_as', { p_user: userId, p_site: siteId })
    if (error) return { erro: codigoDe(error) }
    if (typeof data !== 'boolean') return { erro: 'forma_invalida' }
    return data
  } catch { return { erro: 'excecao' } }
}

/** C1 (spec 4.4): a chave de uma conexão OAuth se reconhece pelo prefixo do nome E pelo `id` em `obs_ai_conexoes.key_id` (os dois; a órfã é ignorada pelo prefixo). */
export const PREFIXO_DE_CONEXAO = 'observatorio-oauth-'
interface LinhaDeChave { id?: unknown; name: unknown; site_id: unknown; user_id: unknown; expires_at: unknown; permissions: unknown; revoked_at: unknown }

export async function criarChaveDoPerfil(deps: DepsDeCriar, p: PedidoDeChave): Promise<ResultadoDeCriar> {
  const { sb, agora } = deps
  // 1. as guardas: a E19 conferida E a exceção do dono (a variável do acesso NÃO entra: a chave nasce antes de ela existir)
  if (!deps.e19().ok) return falha('travas')
  if (deps.excecaoEm === null || deps.excecaoEm === '') return falha('excecao_ausente')
  // 2. a validade
  const dias = p.dias ?? ACESSO_IA_RULES.validadeDias
  if (!Number.isInteger(dias) || dias < 1 || dias > ACESSO_IA_RULES.validadeMaxDias) return falha('validade_invalida')
  const t = agora()
  if (!Number.isFinite(t)) return falha('nao_conferido', 'relogio')
  // 3. a pessoa
  const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : ''
  if (email === '') return falha('email_ausente')
  const pessoas = await acharPessoas(sb, email)
  if ('erro' in pessoas) return falha('nao_conferido', pessoas.erro)
  if (pessoas.ids.length === 0) return falha('email_ausente')
  if (pessoas.ids.length > 1) return falha('email_ambiguo')
  const userId = pessoas.ids[0]!
  // 4. o site: o que a pessoa vê
  let siteId: string
  if (p.siteId !== undefined) {
    if (!UUID.test(p.siteId)) return falha('sem_acesso_ao_site')
    const v = await veOSite(sb, userId, p.siteId)
    if (typeof v === 'object') return falha('nao_conferido', v.erro)
    if (!v) return falha('sem_acesso_ao_site')
    siteId = p.siteId
  } else {
    let sites: Array<{ id?: unknown }>
    try {
      // paginado: o PostgREST corta em max_rows (1000) em silêncio; ordenar por id mantém as páginas estáveis
      sites = []
      for (let pagina = 0; ; pagina++) {
        if (pagina >= SITES_PAGINAS_MAX) return falha('nao_conferido', 'listagem_sem_fim')
        const r = await sb.from('sites').select('id').order('id').range(pagina * SITES_POR_PAGINA, (pagina + 1) * SITES_POR_PAGINA - 1)
        if (r.error) return falha('nao_conferido', codigoDe(r.error))
        const lote = (r.data ?? []) as Array<{ id?: unknown }>
        sites.push(...lote)
        if (lote.length < SITES_POR_PAGINA) break
      }
    } catch { return falha('nao_conferido', 'excecao') }
    const vistos: string[] = []
    for (const s of sites) {
      if (typeof s.id !== 'string') continue
      const v = await veOSite(sb, userId, s.id)
      if (typeof v === 'object') return falha('nao_conferido', v.erro)
      if (v) vistos.push(s.id)
    }
    if (vistos.length === 0) return falha('sem_acesso_ao_site')
    if (vistos.length > 1) return falha('site_ambiguo')
    siteId = vistos[0]!
  }
  // 5. as chaves que existem (todas, revogadas ou não: o nome é único entre todas)
  let linhas: LinhaDeChave[]
  try {
    const r = await sb.from('pipeline_api_keys').select('id, name, site_id, user_id, expires_at, permissions, revoked_at')
    if (r.error) return falha('nao_conferido', codigoDe(r.error))
    linhas = (r.data ?? []) as LinhaDeChave[]
  } catch { return falha('nao_conferido', 'excecao') }
  // C1: as conexões OAuth do site (key_id das chaves-conexão) e as liberações ativas (a pessoa que o dono liberou já ocupa uma vaga do teto)
  const chavesDeConexao = new Set<string>()
  const pessoasLiberadas = new Set<string>()
  try {
    const c = await sb.from('obs_ai_conexoes').select('key_id').eq('site_id', siteId)
    if (c.error) return falha('nao_conferido', codigoDe(c.error))
    for (const x of (c.data ?? []) as Array<{ key_id?: unknown }>) if (typeof x.key_id === 'string') chavesDeConexao.add(x.key_id)
    const b = await sb.from('obs_ai_liberacoes').select('user_id, expires_at').eq('site_id', siteId).is('revoked_at', null)
    if (b.error) return falha('nao_conferido', codigoDe(b.error))
    for (const x of (b.data ?? []) as Array<{ user_id?: unknown; expires_at?: unknown }>) {
      if (typeof x.user_id === 'string' && typeof x.expires_at === 'string' && instanteValido(x.expires_at) && Date.parse(x.expires_at) > t) pessoasLiberadas.add(x.user_id)
    }
  } catch { return falha('nao_conferido', 'excecao') }
  const ehConexao = (l: LinhaDeChave): boolean =>
    (typeof l.name === 'string' && l.name.startsWith(PREFIXO_DE_CONEXAO)) || (typeof l.id === 'string' && chavesDeConexao.has(l.id))
  const dia = new Date(t - TRES_HORAS_MS).toISOString().slice(0, 10).replace(/-/g, '')
  const nome = `observatorio-${dia}-${deps.aleatorio(2).toString('hex')}`
  if (linhas.some((l) => l.name === nome)) return falha('nome_repetido')
  // "ativa" = não revogada e com validade no futuro (vencer exatamente agora é vencida); só do perfil, só deste site
  const ativas = linhas.filter((l) => {
    if (l.site_id !== siteId || !Array.isArray(l.permissions) || !ehDoPerfil(l.permissions as string[])) return false
    if (ehConexao(l)) return false // linha de conexão não é chave da pessoa: nem em `daPessoa` nem no teto (a liberação já conta a pessoa)
    if (l.revoked_at !== null && l.revoked_at !== undefined) return false
    return typeof l.expires_at === 'string' && instanteValido(l.expires_at) && Date.parse(l.expires_at) > t
  })
  const daPessoa = ativas.filter((l) => l.user_id === userId)
  if (daPessoa.length >= 2) return falha('ja_tem_chave')
  if (daPessoa.length === 1 && !podeRenovar(daPessoa[0]!.expires_at as string, t)) return falha('ja_tem_chave')
  // o teto conta PESSOAS (user_id nulo = pessoa apagada: já não abre nada, não conta): donas de chave `obs_` ativa MAIS as de liberação ativa
  const pessoasAtivas = new Set([...ativas.map((l) => l.user_id).filter((u): u is string => typeof u === 'string'), ...pessoasLiberadas])
  if (!pessoasAtivas.has(userId) && pessoasAtivas.size >= ACESSO_IA_RULES.pessoasComChaveMax) return falha('teto_de_chaves')
  // 6. a chave e a linha
  const chave = `obs_${deps.aleatorio(32).toString('base64url')}`
  const venceEm = new Date(t + dias * DIA_MS).toISOString()
  try {
    const { error } = await sb.from('pipeline_api_keys').insert({
      site_id: siteId,
      name: nome,
      key_hash: createHash('sha256').update(chave).digest('hex'),
      permissions: [PERFIL],
      user_id: userId,
      expires_at: venceEm,
      created_by: null,
    })
    if (error) return falha('nao_conferido', codigoDe(error))
  } catch { return falha('nao_conferido', 'excecao') }
  return { ok: true, chave, nome, venceEm, siteId }
}
