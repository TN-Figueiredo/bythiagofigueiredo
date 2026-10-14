import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

// A5 · E7, Tarefa 3: o perfil do canal concorrente (handle, país, data de criação) para o Cowork.
// "O YouTube não informou" (null dentro de `lido`) não é "ainda não lemos" (`nao_lido`): a prova de que o perfil foi lido
// é a existência das DUAS versões correntes (custom_url e country) em competitor_field_versions; handle e país saem do
// `value` delas, nunca das colunas (a versão e a coluna são duas gravações separadas). Só criado_em e lido_em vêm da linha do canal.

export type MotivoDePerfil = 'canal_ainda_nao_relido' | 'tabela_ausente' | 'erro_do_banco' | 'cortado'
export type PerfilDoCanal =
  | { estado: 'lido'; lido_em: string | null; handle: string | null; pais: string | null; criado_em: string | null }
  | { estado: 'nao_lido'; motivo: MotivoDePerfil; frase: string }

export const FRASES_DE_PERFIL: Record<MotivoDePerfil, string> = {
  canal_ainda_nao_relido: 'o histórico do perfil deste canal ainda não tem a primeira leitura de handle e país',
  tabela_ausente: 'o histórico de campos não existe neste banco; o perfil não foi lido',
  erro_do_banco: 'a leitura do perfil falhou nesta consulta; o valor não é conhecido',
  cortado: 'a leitura do perfil foi cortada pelo limite de páginas; o valor não é conhecido',
}

export const LEITURA_MS = 5_000
export const TAMANHO_DA_PAGINA = 1_000
export const MAX_PAGINAS = 10

export type ResultadoDePerfis =
  | { lido: true; porCanal: Map<string, PerfilDoCanal> }
  | { lido: false; motivo: 'tabela_ausente' | 'erro_do_banco' | 'cortado' }

type FalhaDeLeitura = 'tabela_ausente' | 'erro_do_banco' | 'cortado'
type Pagina = { data: unknown; error: { code?: string; message?: string } | null }
type Linhas = { ok: true; linhas: Array<Record<string, unknown>> } | { ok: false; motivo: FalhaDeLeitura }

const TABELA_AUSENTE = new Set(['42P01', 'PGRST205'])

/**
 * Lê uma consulta em páginas de 1.000, na ordem de `id` (página sem ordem estável repete e pula linha), até uma página
 * incompleta. Exatamente 1.000 linhas seguidas de uma página vazia é leitura completa; `cortado` é só o teto de páginas
 * atingido com a última cheia. `{ data: null, error: null }` é erro do banco, nunca zero linhas. Nunca lança; nenhuma
 * mensagem do banco sai daqui (ao Sentry vai só o SQLSTATE).
 */
async function lerEmPaginas(tabela: string, maxPaginas: number, pedir: (de: number, ate: number) => PromiseLike<Pagina>): Promise<Linhas> {
  const todas: Array<Record<string, unknown>> = []
  for (let p = 0; p < maxPaginas; p++) {
    let r: Pagina
    try {
      r = await pedir(p * TAMANHO_DA_PAGINA, p * TAMANHO_DA_PAGINA + TAMANHO_DA_PAGINA - 1)
    } catch (e) {
      Sentry.captureMessage('e7.leitura_falhou', { extra: { leitor: 'perfil', tabela, classe: e instanceof Error ? e.name : 'desconhecida' } })
      return { ok: false, motivo: 'erro_do_banco' }
    }
    if (r.error) {
      const codigo = r.error.code ?? 'sem_codigo'
      Sentry.captureMessage('e7.leitura_falhou', { extra: { leitor: 'perfil', tabela, sqlstate: codigo } })
      return { ok: false, motivo: TABELA_AUSENTE.has(codigo) ? 'tabela_ausente' : 'erro_do_banco' }
    }
    if (!Array.isArray(r.data)) {
      Sentry.captureMessage('e7.leitura_falhou', { extra: { leitor: 'perfil', tabela, sqlstate: 'resposta_nula' } })
      return { ok: false, motivo: 'erro_do_banco' }
    }
    const linhas = r.data.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    todas.push(...linhas)
    if (linhas.length < TAMANHO_DA_PAGINA) return { ok: true, linhas: todas }
  }
  return { ok: false, motivo: 'cortado' }
}

const texto = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** Texto ou nulo; qualquer outra coisa é tratada como nulo, com aviso (o catálogo diz que o valor é texto). */
function textoOuNulo(v: unknown): string | null {
  if (v === null || typeof v === 'string') return v
  Sentry.captureMessage('e7.perfil_valor_inesperado', { extra: { tipo: typeof v } })
  return null
}

/**
 * Duas consultas, as duas com o site: os canais (`id, published_at, last_seen_at`) e as versões correntes de custom_url e
 * country do canal. Nunca lança. Não seleciona `description`.
 */
export async function lerPerfis(sb: SupabaseClient, siteId: string, o: { maxPaginas?: number } = {}): Promise<ResultadoDePerfis> {
  const maxPaginas = o.maxPaginas ?? MAX_PAGINAS
  const canais = await lerEmPaginas('competitor_channels', maxPaginas, (de, ate) =>
    sb.from('competitor_channels').select('id, published_at, last_seen_at').eq('site_id', siteId).order('id').range(de, ate).abortSignal(AbortSignal.timeout(LEITURA_MS)))
  if (!canais.ok) return { lido: false, motivo: canais.motivo }

  const versoes = await lerEmPaginas('competitor_field_versions', maxPaginas, (de, ate) =>
    sb.from('competitor_field_versions').select('competitor_channel_id, field, value').eq('site_id', siteId)
      .is('video_id', null).in('field', ['custom_url', 'country']).eq('is_current', true).order('id').range(de, ate).abortSignal(AbortSignal.timeout(LEITURA_MS)))
  if (!versoes.ok) return { lido: false, motivo: versoes.motivo }

  const porCanalDeCampo = new Map<string, { custom_url?: string | null; country?: string | null }>()
  for (const v of versoes.linhas) {
    const canal = texto(v['competitor_channel_id']), campo = v['field']
    if (!canal || (campo !== 'custom_url' && campo !== 'country')) continue
    const atual = porCanalDeCampo.get(canal) ?? {}
    atual[campo] = textoOuNulo(v['value'])
    porCanalDeCampo.set(canal, atual)
  }

  const porCanal = new Map<string, PerfilDoCanal>()
  for (const c of canais.linhas) {
    const id = texto(c['id'])
    if (!id) continue
    const v = porCanalDeCampo.get(id)
    porCanal.set(id, v && 'custom_url' in v && 'country' in v
      ? { estado: 'lido', lido_em: texto(c['last_seen_at']), handle: v.custom_url ?? null, pais: v.country ?? null, criado_em: texto(c['published_at']) }
      : naoLido('canal_ainda_nao_relido'))
  }
  return { lido: true, porCanal }
}

function naoLido(motivo: MotivoDePerfil): PerfilDoCanal {
  return { estado: 'nao_lido', motivo, frase: FRASES_DE_PERFIL[motivo] }
}

/** O perfil de um canal: resultado não lido, o motivo dele para todo canal; canal que não está no mapa, `canal_ainda_nao_relido`. */
export function perfilDe(canalId: string, r: ResultadoDePerfis): PerfilDoCanal {
  if (!r.lido) return naoLido(r.motivo)
  return r.porCanal.get(canalId) ?? naoLido('canal_ainda_nao_relido')
}
