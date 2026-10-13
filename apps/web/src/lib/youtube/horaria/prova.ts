// Observatório A5 (E16 parte 1, Tarefa 10): a prova da leitura horária.
// Três peças: `lerProvaHoraria` (a função `competitor_hourly_health`, conferida chave a chave), `lerNegadosDoDono` (quantos vídeos
// do dono a resposta do YouTube negou, lido de `competitor_agenda_runs.detail`) e `veredictoHorario` (o que é vermelho, o que é nota).
//
// É um ALARME. A pergunta que pesa é "o que acontece quando o dado não existe?": função ausente, resposta nula, lista no lugar de
// objeto, chave faltando, tipo errado, número negativo, rpc abortado (o cliente não lança: devolve `error`), exceção e prazo estourado
// são SEMPRE "não li" com a frase em português, nunca um objeto de zeros e nunca verde. Texto de erro do banco não sai daqui (S-I4):
// só frases fixas e, no máximo, o código de 5 caracteres do Postgres.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { HealthVerdict } from '@/lib/youtube/competitor-health'
import type { Lido } from '@/lib/youtube/agenda/tipos'
import { BANCO_MS, comPrazo } from '@/lib/youtube/agenda/relogio'
import { RULES } from '@/lib/youtube/observatorio/rules'

export interface ProvaHoraria {
  desde: string | null; ultima_leitura: string | null; horas_lidas_24h: number
  videos_na_lista: number; videos_fora_do_teto: number; videos_cobrados: number; videos_abaixo_de_22h: number; videos_abaixo_do_lido: number
  proprios_desde: string | null; proprios_ultima_leitura: string | null
  proprios_na_lista: number; proprios_fora_do_teto: number; proprios_sem_captura: number
  proprios_cobrados: number; proprios_abaixo_de_22h: number; proprios_abaixo_do_lido: number; proprios_em_competitor: number
}
export interface AvisoHorario { chave: 'leitura_horaria_parada'; frase: string }

const HORA_MS = 3_600_000
const SP_OFFSET_MS = 3 * HORA_MS
/** Depois disto sem leitura, a leitura horária está parada (e o dono recebe o e-mail). Antes, é o começo. */
const PARADA_H = 2
/** A cobertura de 24 horas só é cobrada depois de 25 horas de leitura (as 24 da janela mais uma de folga). */
const COBERTURA_H = 25
const JANELA_MS = 24 * HORA_MS
const NEGADOS_LINHAS_MAX = 25
const TAREFA_PADRAO = 'leitura_horaria'

const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0
const plural = (n: number, um: string, varios: string): string => n + ' ' + (n === 1 ? um : varios)
const objeto = (x: unknown): Record<string, unknown> | undefined =>
  typeof x === 'object' && x !== null && !Array.isArray(x) ? Object.fromEntries(Object.entries(x)) : undefined
/** O código de 5 caracteres do Postgres, se for isso; qualquer outra coisa (inclusive texto do banco) não passa. */
const sqlstate = (x: unknown): string | null => {
  const e = objeto(x)
  return e && typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code) ? e.code : null
}
/** O código do erro (5 do Postgres ou 8 do PostgREST, como PGRST202), só para decidir; nunca é mostrado sem passar por `sqlstate`. */
const codigoDoErro = (x: unknown): string => {
  const e = objeto(x)
  return e && typeof e.code === 'string' && /^[0-9A-Za-z]{5,8}$/.test(e.code) ? e.code : ''
}
const dataLegivel = (x: unknown): x is string => typeof x === 'string' && x !== '' && !Number.isNaN(Date.parse(x))

/** O que o cliente devolve quando a chamada ao banco não deu certo: frase fixa, nunca o texto do erro. */
function frasePorErro(erro: unknown, oQue: string): string {
  const e = objeto(erro)
  const msg = e && typeof e.message === 'string' ? e.message : ''
  if (/abort/i.test(msg)) return oQue + ' foi interrompida por passar do prazo'
  const cod = sqlstate(erro)
  return oQue + ' voltou com erro do banco' + (cod ? ' (código ' + cod + ')' : '')
}

// ───────── lerProvaHoraria ─────────

const CONTAGENS = [
  'horas_lidas_24h', 'videos_na_lista', 'videos_fora_do_teto', 'videos_cobrados', 'videos_abaixo_de_22h', 'videos_abaixo_do_lido',
  'proprios_na_lista', 'proprios_fora_do_teto', 'proprios_sem_captura', 'proprios_cobrados', 'proprios_abaixo_de_22h', 'proprios_abaixo_do_lido', 'proprios_em_competitor',
] as const
const DATAS = ['desde', 'ultima_leitura', 'proprios_desde', 'proprios_ultima_leitura'] as const

/** A prova, conferida chave a chave (sem cast), ou o motivo de não ser uma. */
function conferirProva(data: unknown): Lido<ProvaHoraria> {
  if (data === null || data === undefined) return { porque: 'a prova da leitura horária veio vazia (a função devolve nulo quando o site ou o instante falta)' }
  if (Array.isArray(data)) return { porque: 'a prova da leitura horária veio como lista, não como objeto' }
  const d = objeto(data)
  if (!d) return { porque: 'a prova da leitura horária não é um objeto' }
  const n: Record<string, number> = {}
  for (const k of CONTAGENS) {
    if (!(k in d) || d[k] === undefined) return { porque: 'a prova da leitura horária não traz o campo ' + k + ' (a migration MG9 está aplicada?)' }
    const v = d[k]
    if (!isCount(v)) return { porque: 'o campo ' + k + ' da prova da leitura horária não é um número inteiro maior ou igual a zero' }
    n[k] = v
  }
  const t: Record<string, string | null> = {}
  for (const k of DATAS) {
    if (!(k in d) || d[k] === undefined) return { porque: 'a prova da leitura horária não traz o campo ' + k + ' (a migration MG9 está aplicada?)' }
    const v = d[k]
    if (v === null) { t[k] = null; continue }
    if (!dataLegivel(v)) return { porque: 'o campo ' + k + ' da prova da leitura horária não é uma data legível' }
    t[k] = v
  }
  return {
    valor: {
      desde: t.desde ?? null, ultima_leitura: t.ultima_leitura ?? null, horas_lidas_24h: n.horas_lidas_24h ?? 0,
      videos_na_lista: n.videos_na_lista ?? 0, videos_fora_do_teto: n.videos_fora_do_teto ?? 0, videos_cobrados: n.videos_cobrados ?? 0,
      videos_abaixo_de_22h: n.videos_abaixo_de_22h ?? 0, videos_abaixo_do_lido: n.videos_abaixo_do_lido ?? 0,
      proprios_desde: t.proprios_desde ?? null, proprios_ultima_leitura: t.proprios_ultima_leitura ?? null,
      proprios_na_lista: n.proprios_na_lista ?? 0, proprios_fora_do_teto: n.proprios_fora_do_teto ?? 0, proprios_sem_captura: n.proprios_sem_captura ?? 0,
      proprios_cobrados: n.proprios_cobrados ?? 0, proprios_abaixo_de_22h: n.proprios_abaixo_de_22h ?? 0,
      proprios_abaixo_do_lido: n.proprios_abaixo_do_lido ?? 0, proprios_em_competitor: n.proprios_em_competitor ?? 0,
    },
  }
}

/**
 * (emenda do portão: R5) A prova é por site: rpc `competitor_hourly_health(p_site_id, p_now, p_age_days, p_cap)`, `strict` (parâmetro nulo
 * devolve nulo, que aqui é "não li"). Nunca lança; passa de `BANCO_MS` e vira "não li".
 */
export async function lerProvaHoraria(sb: SupabaseClient, siteId: string, agoraIso: string): Promise<Lido<ProvaHoraria>> {
  if (!dataLegivel(agoraIso)) return { porque: 'o instante da prova da leitura horária não é uma data legível' }
  let res: unknown
  try {
    const corrida = await comPrazo(
      Promise.resolve(sb.rpc('competitor_hourly_health', { p_site_id: siteId, p_now: agoraIso, p_age_days: RULES.hourly.ageDays, p_cap: RULES.hourly.videosMax })),
      BANCO_MS,
    )
    if ('estourou' in corrida) return { porque: 'a chamada da prova da leitura horária passou do prazo' }
    res = corrida.valor
  } catch {
    return { porque: 'a chamada da prova da leitura horária falhou (ver Sentry)' }
  }
  const r = objeto(res)
  if (!r) return { porque: 'o banco não respondeu a prova da leitura horária' }
  if (r.error) {
    const cod = codigoDoErro(r.error)
    if (cod === '42883' || cod === 'PGRST202') return { porque: 'a função competitor_hourly_health não existe no banco (migration MG9 não aplicada)' }
    return { porque: frasePorErro(r.error, 'a chamada da prova da leitura horária') }
  }
  return conferirProva(r.data)
}

// ───────── lerNegadosDoDono ─────────

/** Um contador do `detail`: ausente ou nulo é 0 (execução que nada negou); presente e fora de inteiro ≥ 0 é "não li". */
function contador(detail: Record<string, unknown>, chave: string): number | null {
  const v = detail[chave]
  if (v === undefined || v === null) return 0
  return isCount(v) ? v : null
}

/**
 * (emenda 2 do portão: D2-F1; refeita na emenda 3: D3-T1) Quantos vídeos do dono a resposta do YouTube NEGOU (privado, não listado, apagado) nas
 * últimas 24 horas E que a captura diária ainda diz públicos (`proprios_negados_cobraveis`: os únicos que a prova SQL cobra), e quantos
 * não puderam ser classificados (`proprios_negados_sem_classe`). Os dois são o MÁXIMO por execução da janela, nunca a soma (o mesmo vídeo
 * negado em cinco horas seguidas conta 1). `proprios_fora_nao_publico` e `proprios_nao_devolvidos` NÃO são lidos: contam rascunho e não
 * listado antigo, que a prova nunca cobrou. Leitura que falha é `{ porque }`: o chamador não desconta nada (o vermelho fica).
 */
export async function lerNegadosDoDono(sb: SupabaseClient, agoraIso: string, tarefa: string = TAREFA_PADRAO): Promise<Lido<{ negados: number; semClasse: number }>> {
  if (!dataLegivel(agoraIso)) return { porque: 'o instante da leitura dos vídeos negados não é uma data legível' }
  const desde = new Date(Date.parse(agoraIso) - JANELA_MS).toISOString()
  let res: unknown
  try {
    const consulta = sb.from('competitor_agenda_runs').select('period_key, detail')
      .eq('task', tarefa).gt('started_at', desde).limit(NEGADOS_LINHAS_MAX)
      .abortSignal(AbortSignal.timeout(BANCO_MS))
    const corrida = await comPrazo(Promise.resolve(consulta), BANCO_MS)
    if ('estourou' in corrida) return { porque: 'a leitura dos vídeos negados passou do prazo' }
    res = corrida.valor
  } catch {
    return { porque: 'a leitura dos vídeos negados falhou (ver Sentry)' }
  }
  const r = objeto(res)
  if (!r) return { porque: 'o banco não respondeu a leitura dos vídeos negados' }
  if (r.error) return { porque: frasePorErro(r.error, 'a leitura dos vídeos negados') }
  if (!Array.isArray(r.data)) return { porque: 'a leitura dos vídeos negados veio fora da forma esperada (não é uma lista)' }
  let negados = 0
  let semClasse = 0
  for (const linha of r.data as unknown[]) {
    const l = objeto(linha)
    if (!l) return { porque: 'a leitura dos vídeos negados trouxe uma linha fora da forma esperada' }
    if (l.detail === null || l.detail === undefined) continue
    const detail = objeto(l.detail)
    if (!detail) return { porque: 'a leitura dos vídeos negados trouxe um detalhe fora da forma esperada' }
    const a = contador(detail, 'proprios_negados_cobraveis')
    const b = contador(detail, 'proprios_negados_sem_classe')
    if (a === null || b === null) return { porque: 'a leitura dos vídeos negados trouxe um contador que não é número inteiro maior ou igual a zero' }
    negados = Math.max(negados, a)
    semClasse = Math.max(semClasse, b)
  }
  return { valor: { negados, semClasse } }
}

// ───────── veredictoHorario ─────────

/** 'dd/mm hh:mm' no relógio de São Paulo (UTC−3 fixo, como `agenda/periodo.ts`). */
function textoSP(ms: number): string {
  const d = new Date(ms - SP_OFFSET_MS)
  const dois = (x: number): string => String(x).padStart(2, '0')
  return dois(d.getUTCDate()) + '/' + dois(d.getUTCMonth() + 1) + ' ' + dois(d.getUTCHours()) + ':' + dois(d.getUTCMinutes())
}

export interface OpcoesHorario {
  agoraMs: number
  ligada: boolean
  /** Desde quando a agenda roda (a linha mais antiga de `competitor_agenda_runs`); nulo = sem agenda conhecida. */
  agendaDesde: string | null
  listaDoDisparo: number | null
  semStatusNoDisparo: number | null
  /** `proprios_negados_cobraveis` (máximo das 24 h); nulo = a leitura falhou: nada é descontado e a nota diz. */
  negadosDoDono: number | null
  /** `proprios_negados_sem_classe`: só vira nota, nunca desconto. 0 quando a leitura falhou ou não há. */
  negadosSemClasse: number
}

/**
 * O veredito da leitura horária de um site. Regras na tabela do plano (Tarefa 10). Duas decisões que valem registrar:
 * (1) o desconto do dono é SÓ `negadosDoDono` (os negados que a captura ainda diz públicos): rascunho e não listado antigo parados na
 * janela não descontam, então 2 rascunhos não escondem 2 vídeos públicos sem leitura; (2) hora perdida já encerrada é nota com o número
 * (a leitura voltou), e hora perdida em curso (leitura parada há mais de 2 h) é vermelho com e-mail.
 */
export function veredictoHorario(p: ProvaHoraria | null, o: OpcoesHorario): HealthVerdict & { avisos: AvisoHorario[] } {
  const problems: string[] = []
  const notes: string[] = []
  const paradas: string[] = []
  const pronto = (): HealthVerdict & { avisos: AvisoHorario[] } => ({
    ok: problems.length === 0, problems, notes,
    avisos: paradas.length > 0 ? [{ chave: 'leitura_horaria_parada', frase: paradas.join('; ') }] : [],
  })

  if (!o.ligada) { notes.push('leitura horária desligada'); return pronto() }
  if (!p) { problems.push('não foi possível ler a prova da leitura horária'); return pronto() }

  // idade da agenda: "mais de X" só se prova com a agenda conhecida; uma data ilegível não dá carência a ninguém
  const agendaMs = o.agendaDesde === null ? null : Date.parse(o.agendaDesde)
  const agendaMaisDe = (h: number): boolean => agendaMs !== null && (Number.isNaN(agendaMs) || o.agoraMs - agendaMs > h * HORA_MS)
  const horasDesde = (ms: number): number => Math.max(0, Math.floor((o.agoraMs - ms) / HORA_MS))
  const idadeMs = (iso: string | null): number | null => { if (iso === null) return null; const t = Date.parse(iso); return Number.isNaN(t) ? null : o.agoraMs - t }

  const negados = o.negadosDoDono ?? 0

  if (p.proprios_em_competitor > 0) problems.push('canal do dono dentro da lista de concorrentes (' + p.proprios_em_competitor + '): remova da lista')

  // ── concorrentes: a leitura parou?
  const ultima = idadeMs(p.ultima_leitura)
  let leituraParada = false
  if (p.videos_na_lista > 0) {
    if (p.desde === null) {
      if (agendaMaisDe(PARADA_H)) {
        problems.push('nenhuma leitura horária gravada'); paradas.push('nenhuma leitura horária gravada'); leituraParada = true
      } else notes.push('leitura horária ainda sem leitura (esperado só nas primeiras horas)')
    } else if (ultima !== null && ultima > PARADA_H * HORA_MS) {
      const f = 'leitura horária parada há ' + Math.floor(ultima / HORA_MS) + ' h'
      problems.push(f); paradas.push(f); leituraParada = true
    }
  }

  // ── dono: parada (sem os negados que a captura ainda diz públicos)
  const donoUltima = idadeMs(p.proprios_ultima_leitura)
  if (p.proprios_cobrados - negados > 0 && (p.proprios_ultima_leitura === null || (donoUltima !== null && donoUltima > PARADA_H * HORA_MS)) && agendaMaisDe(PARADA_H)) {
    const h = donoUltima !== null ? Math.floor(donoUltima / HORA_MS) : agendaMs !== null && !Number.isNaN(agendaMs) ? horasDesde(agendaMs) : 0
    const f = 'leitura horária do seu canal parada há ' + h + ' h'
    problems.push(f); paradas.push(f); leituraParada = true
  }

  // ── cobertura das 24 horas (concorrentes)
  const desdeMs = p.desde === null ? null : Date.parse(p.desde)
  if (desdeMs !== null && !Number.isNaN(desdeMs)) {
    if (o.agoraMs - desdeMs > COBERTURA_H * HORA_MS) {
      if (p.videos_abaixo_do_lido > 0) {
        problems.push(plural(p.videos_abaixo_do_lido, 'vídeo', 'vídeos') + ' com leituras faltando nas últimas 24 horas (a tarefa leu ' + plural(p.horas_lidas_24h, 'hora', 'horas') + ')')
      }
      if (p.horas_lidas_24h < 24 && !leituraParada) {
        const m = p.videos_abaixo_de_22h > 0 ? '; ' + plural(p.videos_abaixo_de_22h, 'vídeo', 'vídeos') + ' com menos de 22 leituras' : ''
        notes.push(plural(24 - p.horas_lidas_24h, 'hora', 'horas') + ' sem leitura nas últimas 24 (lidas ' + p.horas_lidas_24h + ' de 24)' + m)
      }
    } else {
      notes.push('cobertura de 24 horas cobrada a partir de ' + textoSP(desdeMs + COBERTURA_H * HORA_MS))
    }
  }

  // ── dono: leituras faltando, com o desconto dos negados
  const donoFaltando = Math.max(0, p.proprios_abaixo_do_lido - negados)
  if (donoFaltando > 0 && agendaMaisDe(COBERTURA_H)) {
    problems.push(plural(donoFaltando, 'vídeo', 'vídeos') + ' do seu canal com leituras faltando nas últimas 24 horas')
  }
  if (negados > 0) {
    notes.push(negados === 1
      ? '1 vídeo do seu canal saiu do ar ou deixou de ser público nas últimas 24 horas (a resposta do YouTube o negou): sem leitura, fora da cobrança'
      : negados + ' vídeos do seu canal saíram do ar ou deixaram de ser públicos nas últimas 24 horas (a resposta do YouTube os negou): sem leitura, fora da cobrança')
  }
  if (o.negadosDoDono === null) notes.push('não foi possível ler quantos vídeos do seu canal foram negados; o alarme do seu canal não desconta nada')
  if (o.negadosSemClasse > 0) {
    notes.push(plural(o.negadosSemClasse, 'vídeo', 'vídeos') + ' do seu canal ' + (o.negadosSemClasse === 1 ? 'foi negado' : 'foram negados') +
      ' e não foi possível conferir a captura ' + (o.negadosSemClasse === 1 ? 'dele' : 'deles') + '; o alarme do seu canal não ' + (o.negadosSemClasse === 1 ? 'o desconta' : 'os desconta'))
  }

  // ── a lista do disparo
  if (o.listaDoDisparo === 0 && p.videos_na_lista > 0) problems.push('a leitura horária montou lista vazia com ' + p.videos_na_lista + ' vídeos elegíveis')

  // ── limites declarados: só nota
  if (p.videos_fora_do_teto > 0) notes.push(plural(p.videos_fora_do_teto, 'vídeo', 'vídeos') + ' fora do teto de ' + RULES.hourly.videosMax + ' por canal')
  if (p.proprios_fora_do_teto > 0) {
    notes.push(plural(p.proprios_fora_do_teto, 'vídeo', 'vídeos') + ' do seu canal fora do teto de ' + RULES.hourly.videosMax + ' (a conta do teto inclui vídeos privados e não listados)')
  }
  if (p.proprios_sem_captura > 0) {
    notes.push(plural(p.proprios_sem_captura, 'vídeo', 'vídeos') + ' do seu canal fora da prova: sem captura de privacidade há 3 dias (a coleta diária do canal parou?)')
  }
  if (o.semStatusNoDisparo !== null && o.semStatusNoDisparo > 0) {
    notes.push(plural(o.semStatusNoDisparo, 'vídeo', 'vídeos') + ' do seu canal ' + (o.semStatusNoDisparo === 1 ? 'não foi gravado' : 'não foram gravados') + ': a resposta do YouTube veio sem o estado de privacidade')
  }
  return pronto()
}
