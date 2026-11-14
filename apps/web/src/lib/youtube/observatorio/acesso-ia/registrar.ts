// O registro de acesso de IA (`obs_ai_access_log`, origem `mcp`; plano, 4.5 e Tarefa 6). Duas portas de escrita, de propósito separadas:
//   - `registrarAcessoDaChave`: o caminho DO DADO. Exige a prova (`ChaveDoPerfilProvada`): site, pessoa e chave vêm dela, nunca de `params`.
//     A linha `ok` é gravada ANTES de a ferramenta devolver qualquer coisa ("sem linha, sem dado"); a `limite` é de melhor esforço;
//   - `registrarRecusaDaPorta`: a linha `recusado`. NÃO recebe prova (num caminho de recusa ela não existe, e nenhum código a fabrica
//     para poder gravar): recebe os três ids da linha da chave que a porta acabou de recusar. Valores fixos.
// `params` passa por uma lista fechada de chaves E de valores (cada chave tem a forma dela): texto de pergunta, de comentário ou de resposta não tem por onde entrar.
// `result = 'ok'` quer dizer "a chamada foi atendida e registrada", NÃO "o dado foi entregue": entregue é `result = 'ok'` e `desfecho = 'ok'`.
// Nenhuma função lança; erro, exceção e prazo viram `{ ok: false, code }` (quem chama decide: a `ok` bloqueia a entrega, as outras vão ao Sentry).
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ACOES } from './acoes'
import { TODOS_OS_CAMPOS } from './exemplos'
import { METRICAS_DA_CONSULTA } from '../consulta/catalogo'
import { ACESSO_IA_RULES } from './regras'
import { telaExiste } from '../contexto-ia/telas'
import type { ChaveDoPerfilProvada } from './prova'
import type { Cliente } from './liberacao'

type ValorDeParam = string | number | boolean | string[] | Record<string, number>

export interface LinhaDeAcesso {
  prova: ChaveDoPerfilProvada
  acao: string
  params: Record<string, ValorDeParam>
  incluiuPrivado: boolean
  caracteres: number | null
  /** `recusado` não está aqui: é de `registrarRecusaDaPorta`. A linha `limite` leva `params.desfecho = 'limite'` e `params.por`. */
  resultado: 'ok' | 'limite'
}

export type DesfechoDaRecusa = 'banida' | 'ausente' | 'apagamento_pedido' | 'sem_vinculo' | 'desligado'

const TABELA = 'obs_ai_access_log'

// A lista fechada vale para as CHAVES e para os VALORES: cada chave tem a forma do que o chamador legítimo manda, e valor fora da forma
// derruba a chave (nunca o registro). Nenhum campo aceita texto livre: só lista fechada, id com forma de uuid ou de id do YouTube,
// slug de nicho, data que existe, booleano ou contador inteiro. Texto de comentário, de pergunta ou dado privado não têm por onde entrar.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CANAL_YT = /^UC[A-Za-z0-9_-]{22}$/
const VIDEO_YT = /^[A-Za-z0-9_-]{11}$/
const NICHO = /^[a-z0-9][a-z0-9-]{0,31}$/
const CONTADOR_MAX = 1_000_000
const CHAVE_DE_PARAMETRO = /^[a-z_]{1,32}$/
const VALOR_DE_PARAMETRO = /^[A-Za-z0-9_.,:-]{1,64}$/

const daLista = (lista: readonly string[]) => (v: unknown): v is string => typeof v === 'string' && lista.includes(v)
const idValido = (v: unknown): v is string => typeof v === 'string' && (UUID.test(v) || CANAL_YT.test(v) || VIDEO_YT.test(v))
const dataReal = (v: unknown): v is string => {
  if (typeof v !== 'string') return false
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  return m !== null && new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toISOString().slice(0, 10) === v
}
const contador = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= CONTADOR_MAX

/** Os desfechos que a ferramenta grava (`ok` é a entrega; os outros são o motivo de não haver entrega). */
const DESFECHOS = ['ok', 'limite', 'tempo', 'falhou', 'pedido_invalido', 'nao_encontrado'] as const

/** Separa os pares `k=v` de `parametros` entre os que têm a forma (ordenados, até 12) e os que saem; `null` se o valor não é lista nem objeto. */
function paresDeParametros(v: unknown): { ok: string[]; fora: number } | null {
  const pares: string[] = []
  if (Array.isArray(v)) {
    for (const x of v) if (typeof x === 'string') pares.push(x)
  } else if (typeof v === 'object' && v !== null) {
    for (const [k, val] of Object.entries(v)) if (typeof val === 'string') pares.push(`${k}=${val}`)
  } else return null
  const ok = new Set<string>()
  for (const x of pares) {
    const i = x.indexOf('=')
    if (i < 1) continue
    if (CHAVE_DE_PARAMETRO.test(x.slice(0, i)) && VALOR_DE_PARAMETRO.test(x.slice(i + 1))) ok.add(x)
  }
  return { ok: [...ok].sort().slice(0, 12), fora: new Set(pares).size - ok.size }
}

const LUGAR = /^(pais:[A-Z]{2}|local:[a-z]{2}-[a-z0-9-]{1,40})$/
const FAIXA_DE_IDADE = /^(0-30|31-90|91-180|181-365|365\+|todas)$/
const DADOS_DE = /^\d{4}-\d{2}-\d{2}T\d{2}$/
/** As métricas da `consultar`: derivadas do catálogo (A4 T4), uma lista só para `metricas`, `ordenar_por` e `nao_medidos`. */
const METRICAS_DO_REGISTRO: readonly string[] = Object.keys(METRICAS_DA_CONSULTA)
/** `entidade` da `consultar`: `video` hoje, `canal` na 2ª entrega; `comentario` e `yt_own_*` nunca (spec 3.1). */
const ENTIDADES_DO_REGISTRO = ['video', 'canal'] as const

const CAMPOS_DE_RECUSA: readonly string[] = [...TODOS_OS_CAMPOS, '(desconhecido)']

/** A chave aceita? Se sim, o valor (cortado/ajustado) que vai para a linha; se não, `undefined` e a chave sai. */
export const FORMA_DOS_PARAMS: Readonly<Record<string, (v: unknown) => ValorDeParam | undefined>> = {
  acao: (v) => (daLista(ACOES)(v) ? v : undefined),
  tela: (v) => (telaExiste(v) ? v : undefined),
  canal_id: (v) => (idValido(v) ? v : undefined),
  video_id: (v) => (idValido(v) ? v : undefined),
  canal_ids: (v) => {
    if (!Array.isArray(v) || !v.every((x) => x === 'proprio' || idValido(x))) return undefined
    return v.slice(0, Math.max(ACESSO_IA_RULES.canaisNoComparar.max, ACESSO_IA_RULES.tetoDeCanaisDaSerie.canais))
  },
  janela: (v) => (daLista(['7', '30', '90', 'todas'])(v) ? v : undefined),
  formato: (v) => (daLista(['todos', 'longos', 'shorts'])(v) ? v : undefined),
  nicho: (v) => (typeof v === 'string' && NICHO.test(v) ? v : undefined),
  grao: (v) => (daLista(['dia', 'semana'])(v) ? v : undefined),
  de: (v) => (dataReal(v) ? v : undefined),
  ate: (v) => (dataReal(v) ? v : undefined),
  desde: (v) => (dataReal(v) ? v : undefined),
  id: (v) => (idValido(v) ? v : undefined),
  // `pacote_da_tela`: pares `k=v` (ou o objeto do esquema); chave e valor na forma fechada, até 12, ordenados; o par fora da forma sai
  parametros: (v) => {
    const r = paresDeParametros(v)
    return r === null || r.ok.length === 0 ? undefined : r.ok
  },
  // quantos pares de `parametros` saíram por estar fora da forma: calculado por `filtrarParams`, nunca vem do chamador
  parametros_fora: (v) => (contador(v) && v > 0 ? v : undefined),
  desfecho: (v) => (daLista(DESFECHOS)(v) ? v : undefined),
  privado: (v) => (typeof v === 'boolean' ? v : undefined),
  comentarios: (v) => (typeof v === 'boolean' ? v : undefined),
  cortes: (v) => (contador(v) ? v : undefined),
  pares: (v) => (contador(v) ? v : undefined),
  // A7a: linhas da principal entregues e total da principal antes de qualquer corte (nomes da A4/A5; contador, nunca texto)
  linhas: (v) => (contador(v) ? v : undefined),
  total: (v) => (contador(v) ? v : undefined),
  // A7d: a resposta era completa (booleano), quanto demorou (ms) e quantos outliers a tela deixou fora do pacote (contadores)
  completa: (v) => (typeof v === 'boolean' ? v : undefined),
  ms: (v) => (contador(v) ? v : undefined),
  fora_do_pacote: (v) => (contador(v) ? v : undefined),
  // A7b: a janela da lista (1ª linha pedida, >= 1), se a lista mudou entre janelas e quantas linhas de apoio ficaram sem dona; a `marca` (hash) NUNCA é gravada
  a_partir_da_linha: (v) => (contador(v) && v >= 1 ? v : undefined),
  // A5 F1b: a forma da resposta (texto ou tabela); outro valor sai
  saida: (v) => (daLista(['texto', 'tabela'])(v) ? v : undefined),
  // A5 F1b: tabelas CSV com número sem valor de máquina (defeito do empacotador; o esperado é 0)
  sem_x: (v) => (contador(v) ? v : undefined),
  // A5 F2b: a `serie` de vários canais: quantos foram pedidos e quantos foram lidos de fato (contadores; nunca nome nem valor)
  n_canais: (v) => (contador(v) ? v : undefined),
  canais_lidos: (v) => (contador(v) ? v : undefined),
  marca: () => undefined, // tem forma (a entrada a aceita) mas nunca vai para a linha
  marca_mudou: (v) => (typeof v === 'boolean' ? v : undefined),
  sem_dona: (v) => (contador(v) ? v : undefined),
  // A7e: qual(is) campo(s) o esquema recusou (só NOMES de campo do esquema ou "(desconhecido)"; nunca o valor), até 6
  campos_invalidos: (v) => {
    if (!Array.isArray(v)) return undefined
    const ok = [...new Set(v.filter((x): x is string => typeof x === 'string' && CAMPOS_DE_RECUSA.includes(x)))].sort().slice(0, 6)
    return ok.length > 0 ? ok : undefined
  },
  por: (v) => (daLista(['minuto', 'dia'])(v) ? v : undefined),
  // A4 T1: sha256 do texto entregue (só em `ok`)
  resposta_sha256: (v) => (typeof v === 'string' && /^[0-9a-f]{64}$/.test(v) ? v : undefined),
  // A4 T2: as chaves da `consultar`. Nenhuma é texto livre: lista fechada, regex curta, data real ou contador.
  entidade: (v) => (daLista(ENTIDADES_DO_REGISTRO)(v) ? v : undefined),
  lugar: (v) => (typeof v === 'string' && LUGAR.test(v) ? v : undefined),
  janela_idade: (v) => {
    if (typeof v === 'string') return FAIXA_DE_IDADE.test(v) ? v : undefined
    if (!Array.isArray(v) || v.length === 0 || v.length > 5 || !v.every((x) => typeof x === 'string' && FAIXA_DE_IDADE.test(x))) return undefined
    return v as string[]
  },
  publicado_de: (v) => (dataReal(v) ? v : undefined),
  publicado_ate: (v) => (dataReal(v) ? v : undefined),
  metricas: (v) => (Array.isArray(v) && v.length > 0 && v.length <= 8 && v.every(daLista(METRICAS_DO_REGISTRO)) ? (v as string[]) : undefined),
  ordenar_por: (v) => (daLista(METRICAS_DO_REGISTRO)(v) ? v : undefined),
  direcao: (v) => (daLista(['desc', 'asc'])(v) ? v : undefined),
  limite: (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 50 ? v : undefined),
  incluir_base_fraca: (v) => (typeof v === 'boolean' ? v : undefined),
  elegiveis: (v) => (contador(v) ? v : undefined),
  cortadas: (v) => (contador(v) ? v : undefined),
  sem_lugar_calculado: (v) => (contador(v) ? v : undefined),
  dados_de: (v) => (typeof v === 'string' && DADOS_DE.test(v) ? v : undefined),
  // só `true`; quem escreve é `filtrarParams` (o chamador nunca)
  params_cortado: (v) => (v === true ? true : undefined),
  // chaves só as do catálogo de métricas, valor contador 0–99999, validado chave a chave; sem nenhuma boa, a chave sai
  nao_medidos: (v) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
    const o: Record<string, number> = {}
    for (const m of METRICAS_DO_REGISTRO) {
      const x = (v as Record<string, unknown>)[m]
      if (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 99_999) o[m] = x
    }
    return Object.keys(o).length > 0 ? o : undefined
  },
  canais_sem_medida: (v) => (contador(v) ? v : undefined),
  n_metricas: (v) => (contador(v) ? v : undefined),
  n_faixas: (v) => (contador(v) ? v : undefined),
  // `ambiente` não é do chamador: a função repõe o dela
}
/** Para o teste de completude: as chaves que têm forma. Só leitura; o mapa não sai daqui. */
export const CHAVES_COM_FORMA_DE_PARAMS: readonly string[] = Object.freeze(Object.keys(FORMA_DOS_PARAMS))
const ambiente = (): string => process.env.VERCEL_ENV ?? 'local'

/** O teto da forma de `params` (inclui a chave `ambiente`, que o registro acrescenta). */
export const TETO_DOS_PARAMS_B = 1_024

/** Nunca caem no corte (A4 T2): o que audita a linha. `params_cortado` é o aviso do próprio corte. */
const PROTEGIDAS: ReadonlySet<string> = new Set(['acao', 'desfecho', 'linhas', 'total', 'elegiveis', 'cortadas', 'ms', 'resposta_sha256', 'campos_invalidos', 'lugar', 'params_cortado'])

const tamanho = (p: Record<string, ValorDeParam>): number => JSON.stringify({ ...p, ambiente: ambiente() }).length
const contagem = (v: ValorDeParam | undefined): number => (Array.isArray(v) ? v.length : v === undefined ? 0 : 1)

/** Filtra pela forma e, se o JSON passar de `TETO_DOS_PARAMS_B`, corta em degraus fixos sem trocar o tipo de nenhuma chave. */
export function filtrarParams(params: Record<string, unknown>): { params: Record<string, ValorDeParam>; cortado: boolean } {
  const saida: Record<string, ValorDeParam> = {}
  for (const [k, v] of Object.entries(params)) {
    if (!Object.prototype.hasOwnProperty.call(FORMA_DOS_PARAMS, k)) continue
    const aceito = FORMA_DOS_PARAMS[k]!(v)
    if (aceito !== undefined) saida[k] = aceito
  }
  // o par descartado não some em silêncio: fica a contagem (número tem forma)
  delete saida.parametros_fora
  delete saida.params_cortado
  const fora = paresDeParametros(params.parametros)?.fora ?? 0
  if (fora > 0) saida.parametros_fora = fora
  if (tamanho(saida) <= TETO_DOS_PARAMS_B) return { params: saida, cortado: false }

  saida.params_cortado = true
  const degrau = (chave: string, contador: string): void => {
    if (tamanho(saida) <= TETO_DOS_PARAMS_B || saida[chave] === undefined) return
    if (saida[contador] === undefined) saida[contador] = contagem(saida[chave])
    delete saida[chave]
  }
  degrau('metricas', 'n_metricas')
  degrau('canal_ids', 'n_canais')
  degrau('janela_idade', 'n_faixas')
  if (tamanho(saida) > TETO_DOS_PARAMS_B && Array.isArray(saida.parametros)) saida.parametros = [`n_pares=${saida.parametros.length}`]
  if (tamanho(saida) > TETO_DOS_PARAMS_B) {
    for (const k of Object.keys(saida).filter((x) => !PROTEGIDAS.has(x)).sort()) {
      if (tamanho(saida) <= TETO_DOS_PARAMS_B) break
      delete saida[k]
    }
  }
  if (tamanho(saida) > TETO_DOS_PARAMS_B) for (const k of Object.keys(saida)) if (!PROTEGIDAS.has(k)) delete saida[k]
  return { params: saida, cortado: true }
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
  const { params } = filtrarParams(l.params)
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

const DESFECHOS_DA_RECUSA: ReadonlySet<string> = new Set<DesfechoDaRecusa>(['banida', 'ausente', 'apagamento_pedido', 'sem_vinculo', 'desligado'])

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

export type DesfechoDoConsentimento = 'sem_direito' | 'cortado' | 'desligado' | 'invalido'
export type MotivoDoConsentimento = 'nao_liberada' | 'teto' | 'sem_vinculo' | 'banida' | 'apagamento'

const DESFECHOS_DO_CONSENTIMENTO: ReadonlySet<string> = new Set<DesfechoDoConsentimento>(['sem_direito', 'cortado', 'desligado', 'invalido'])
const MOTIVOS_DO_CONSENTIMENTO: ReadonlySet<string> = new Set<MotivoDoConsentimento>(['nao_liberada', 'teto', 'sem_vinculo', 'banida', 'apagamento'])

/**
 * A linha `recusado` do consentimento que nasce NO APP (antes da função SQL): `desligado` e `invalido` da página. Vai por
 * `obs_ai_log_recusa_consentimento` (mesmo formato de `params` das linhas do SQL e limite de 1/h por pessoa, cliente e desfecho:
 * recarregar a tela não enche o log). `keyId` fica na assinatura do plano mas só `null` é aceito: estas recusas nunca têm chave.
 * Nunca lança.
 */
export async function registrarConsentimento(
  sb: SupabaseClient,
  c: { siteId: string; userId: string; keyId: string | null; cliente: Cliente | null; desfecho: DesfechoDoConsentimento; motivo?: MotivoDoConsentimento; agora: number },
  opcoes?: { prazoMs?: number },
): Promise<{ ok: true } | { ok: false; code: string }> {
  if (!DESFECHOS_DO_CONSENTIMENTO.has(c.desfecho)) return { ok: false, code: 'desfecho_invalido' }
  if (c.motivo !== undefined && !MOTIVOS_DO_CONSENTIMENTO.has(c.motivo)) return { ok: false, code: 'motivo_invalido' }
  if (c.keyId !== null) return { ok: false, code: 'key_invalida' }
  const r = await comPrazo(prazoDe(opcoes), () =>
    sb.rpc('obs_ai_log_recusa_consentimento', {
      p_user: c.userId,
      p_site: c.siteId,
      p_cliente: c.cliente,
      p_desfecho: c.desfecho,
      p_motivo: c.motivo ?? null,
      p_agora: new Date(c.agora).toISOString(),
    }),
  )
  if (!r.ok) return { ok: false, code: r.code }
  const { error } = (r.valor ?? {}) as { error?: { code?: unknown } | null }
  return error ? { ok: false, code: codigoDe(error) } : { ok: true }
}
