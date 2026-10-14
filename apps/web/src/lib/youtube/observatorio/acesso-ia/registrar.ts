// O registro de acesso de IA (`obs_ai_access_log`, origem `mcp`; plano, 4.5 e Tarefa 6). Duas portas de escrita, de propósito separadas:
//   - `registrarAcessoDaChave`: o caminho DO DADO. Exige a prova (`ChaveDoPerfilProvada`): site, pessoa e chave vêm dela, nunca de `params`.
//     A linha `ok` é gravada ANTES de a ferramenta devolver qualquer coisa ("sem linha, sem dado"); a `limite` é de melhor esforço;
//   - `registrarRecusaDaPorta`: a linha `recusado`. NÃO recebe prova (num caminho de recusa ela não existe, e nenhum código a fabrica
//     para poder gravar): recebe os três ids da linha da chave que a porta acabou de recusar. Valores fixos.
// `params` passa por uma lista fechada de chaves: texto de pergunta, de comentário ou de resposta não tem por onde entrar.
// `result = 'ok'` quer dizer "a chamada foi atendida e registrada", NÃO "o dado foi entregue": entregue é `result = 'ok'` e `desfecho = 'ok'`.
// Nenhuma função lança; erro, exceção e prazo viram `{ ok: false, code }` (quem chama decide: a `ok` bloqueia a entrega, as outras vão ao Sentry).
import type { SupabaseClient } from '@supabase/supabase-js'
import { ACESSO_IA_RULES } from './regras'
import type { ChaveDoPerfilProvada } from './prova'

type ValorDeParam = string | number | boolean | string[]

export interface LinhaDeAcesso {
  prova: ChaveDoPerfilProvada
  acao: string
  params: Record<string, ValorDeParam>
  incluiuPrivado: boolean
  caracteres: number | null
  /** `recusado` não está aqui: é de `registrarRecusaDaPorta`. A linha `limite` leva `params.desfecho = 'limite'` e `params.por`. */
  resultado: 'ok' | 'limite'
}

export type DesfechoDaRecusa = 'banida' | 'ausente' | 'apagamento_pedido' | 'sem_vinculo'

const CHAVES_DE_PARAMS: ReadonlySet<string> = new Set([
  'acao', 'tela', 'canal_id', 'video_id', 'canal_ids', 'janela', 'formato', 'nicho', 'grao', 'de', 'ate',
  'desfecho', 'privado', 'comentarios', 'cortes', 'pares', 'ambiente', 'por',
])
const TEXTO_MAX = 64
const TABELA = 'obs_ai_access_log'

const cortar = (t: string): string => (t.length > TEXTO_MAX ? t.slice(0, TEXTO_MAX) : t)
const ambiente = (): string => process.env.VERCEL_ENV ?? 'local'

function filtrarParams(params: Record<string, unknown>): Record<string, ValorDeParam> {
  const saida: Record<string, ValorDeParam> = {}
  for (const [k, v] of Object.entries(params)) {
    if (!CHAVES_DE_PARAMS.has(k) || k === 'ambiente') continue
    if (typeof v === 'string') saida[k] = cortar(v)
    else if (typeof v === 'number' && Number.isFinite(v)) saida[k] = v
    else if (typeof v === 'boolean') saida[k] = v
    else if (Array.isArray(v) && v.every((x): x is string => typeof x === 'string')) saida[k] = v.map(cortar)
  }
  return saida
}

const ESTOUROU = Symbol('estourou')

/** Corrida contra o próprio sinal de `AbortSignal.timeout`: não espera além do prazo mesmo que a chamada ignore o sinal. */
async function comPrazo<T>(prazoMs: number, fazer: (sinal: AbortSignal) => PromiseLike<T>): Promise<{ ok: true; valor: T } | { ok: false; code: 'tempo' | 'excecao' }> {
  const sinal = AbortSignal.timeout(prazoMs)
  const estouro = new Promise<typeof ESTOUROU>((resolve) => {
    if (sinal.aborted) resolve(ESTOUROU)
    else sinal.addEventListener('abort', () => resolve(ESTOUROU), { once: true })
  })
  try {
    const r = await Promise.race([Promise.resolve(fazer(sinal)), estouro])
    return r === ESTOUROU ? { ok: false, code: 'tempo' } : { ok: true, valor: r }
  } catch {
    return { ok: false, code: 'excecao' }
  }
}

const prazoDe = (o?: { prazoMs?: number }): number => o?.prazoMs ?? ACESSO_IA_RULES.prazoPorIdaMs
const codigoDe = (e: { code?: unknown } | null | undefined): string => (typeof e?.code === 'string' && e.code !== '' ? e.code : 'desconhecido')

async function inserir(sb: SupabaseClient, linha: Record<string, unknown>, opcoes?: { prazoMs?: number }): Promise<{ ok: true } | { ok: false; code: string }> {
  const r = await comPrazo(prazoDe(opcoes), (sinal) => sb.from(TABELA).insert(linha).abortSignal(sinal))
  if (!r.ok) return { ok: false, code: r.code }
  const { error } = (r.valor ?? {}) as { error?: { code?: unknown } | null }
  return error ? { ok: false, code: codigoDe(error) } : { ok: true }
}

export async function registrarAcessoDaChave(sb: SupabaseClient, l: LinhaDeAcesso, opcoes?: { prazoMs?: number }): Promise<{ ok: true } | { ok: false; code: string }> {
  const params = filtrarParams(l.params)
  const desfecho = params.desfecho
  if (typeof desfecho !== 'string' || desfecho === '') return { ok: false, code: 'sem_desfecho' }
  const entregue = desfecho === 'ok'
  return inserir(sb, {
    site_id: l.prova.siteId,
    user_id: l.prova.userId,
    key_id: l.prova.keyId,
    origin: 'mcp',
    action: l.acao,
    params: { ...params, ambiente: ambiente() },
    // sem entrega nenhum dado privado saiu, e nenhum caractere foi entregue
    included_private: entregue ? l.incluiuPrivado : false,
    output_chars: entregue ? l.caracteres : null,
    result: l.resultado,
  }, opcoes)
}

/** Há linha `recusado` desta chave na última hora? Só `nao` autoriza gravar outra: a dúvida (`nao_conferido`) NÃO grava. */
export async function houveRecusaRecente(
  sb: SupabaseClient,
  keyId: string,
  agora: number,
  opcoes?: { prazoMs?: number },
): Promise<'sim' | 'nao' | 'nao_conferido'> {
  const janela = ACESSO_IA_RULES.recusadoNoMaximoACadaMs
  const desde = new Date(agora - janela).toISOString()
  const r = await comPrazo(prazoDe(opcoes), (sinal) =>
    sb.from(TABELA)
      .select('at')
      .eq('key_id', keyId)
      .eq('result', 'recusado')
      .gte('at', desde)
      .order('at', { ascending: false })
      .limit(1)
      .abortSignal(sinal),
  )
  if (!r.ok) return 'nao_conferido'
  const { data, error } = (r.valor ?? {}) as { data?: unknown; error?: unknown }
  if (error || !Array.isArray(data)) return 'nao_conferido'
  if (data.length === 0) return 'nao'
  const at = Date.parse(String((data[0] as { at?: unknown } | null)?.at))
  if (!Number.isFinite(at)) return 'nao_conferido'
  return at >= agora - janela ? 'sim' : 'nao'
}

const DESFECHOS_DA_RECUSA: ReadonlySet<string> = new Set<DesfechoDaRecusa>(['banida', 'ausente', 'apagamento_pedido', 'sem_vinculo'])

/** A linha `recusado` da porta. Valores fixos: `action = 'porta'`, `included_private = false`, `output_chars` nulo, `params = { desfecho, ambiente }`. */
export async function registrarRecusaDaPorta(
  sb: SupabaseClient,
  r: { siteId: string; userId: string; keyId: string; desfecho: DesfechoDaRecusa },
  opcoes?: { prazoMs?: number },
): Promise<{ ok: true } | { ok: false; code: string }> {
  if (!DESFECHOS_DA_RECUSA.has(r.desfecho)) return { ok: false, code: 'desfecho_invalido' }
  return inserir(sb, {
    site_id: r.siteId,
    user_id: r.userId,
    key_id: r.keyId,
    origin: 'mcp',
    action: 'porta',
    params: { desfecho: r.desfecho, ambiente: ambiente() },
    included_private: false,
    output_chars: null,
    result: 'recusado',
  }, opcoes)
}
