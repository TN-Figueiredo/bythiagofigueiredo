import type { BatchRow, NotasDePausa } from '@/lib/youtube/competitor-sync-batch'
import { notasDePausa } from '@/lib/youtube/competitor-sync-batch'
import type { PendenciasDoArquivo } from '@/lib/youtube/observatorio/arquivo/ler-pendencias'
import type { SinalLido } from '@/lib/youtube/observatorio/arquivo/ler-sinal'
import { fraseDeNuncaMedido } from '@/lib/youtube/observatorio/arquivo/sinal-do-banco'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { Aviso } from './aviso'
import type { CausaDaFalha } from './tipos'

/**
 * (A5 E10, Tarefa 9) O que o sinal do tamanho do banco, as pendências do arquivo e a pausa de coleta acrescentam a UM disparo: linhas de
 * `acao_do_dono`, notas, frases vermelhas (`problemas`), avisos por e-mail e o campo `banco` da resposta. Função PURA: quem lê o banco é o
 * chamador (`executar.ts` com agenda, `arquivo-sem-agenda.ts` sem ela), que passa o resultado das leituras.
 *
 * Regras de cor: o cron NUNCA fica vermelho pela cor do banco (P2). Vermelho só por (1) mais de `unmeasuredRedHours` sem medida, (2) leitor do
 * sinal quebrado de forma permanente (`forma_invalida`, `schema_ausente`). Texto do banco/exceção nunca entra: só frases fixas e números.
 */

export interface ExtrasDoDisparo { acao: string[]; notas: string[]; avisos: Aviso[]; problemas: string[]; banco: Record<string, unknown> }

export interface EntradaExtras {
  /** Todos os canais lidos (pausados inclusive); nulo = não foram lidos (sem site para o aviso e sem linha de pausa). */
  todas: BatchRow[] | null
  sinal: SinalLido | { porque: 'prazo' }
  agoraMs: number
  /** Desde quando a agenda roda; nulo = agenda desligada ou estado não lido. */
  agendaDesde: string | null
  pendencias: PendenciasDoArquivo | { porque: 'prazo' }
  /** A tarefa `tamanho_do_banco` tem `ok` nas últimas 36 h (a medida existe); nulo = estado da agenda não lido ou caminho sem agenda. */
  tamanhoOkHa36h: boolean | null
  /** A tarefa `tamanho_do_banco` está em `OBS_AGENDA_TASKS_OFF`: a medida das 05:00 não roda, mesmo com a agenda ligada. */
  tamanhoDesligada?: boolean
}

export const FRASE_SINAL_NAO_LIDO = 'banco: não foi possível ler o tamanho'
const NOTA_PENDENCIAS_NAO_LIDAS = 'arquivo: não foi possível ler as pendências'
const HORA_MS = 3_600_000
const CAUSAS_PERMANENTES: ReadonlySet<CausaDaFalha> = new Set<CausaDaFalha>(['forma_invalida', 'schema_ausente'])

const plural = (n: number, um: string, varios: string): string => n + ' ' + (n === 1 ? um : varios)

function doSinal(e: EntradaExtras, out: ExtrasDoDisparo): void {
  const semAgenda = e.agendaDesde === null && e.todas === null
  if ('porque' in e.sinal) {
    const causa = e.sinal.porque
    out.banco = { nao_lido: causa }
    out.notas.push(FRASE_SINAL_NAO_LIDO)
    const permanente = CAUSAS_PERMANENTES.has(causa)
    if (permanente) out.problemas.push(FRASE_SINAL_NAO_LIDO)
    // transitória com a medida em dia: o aviso não sai, então a falha repetida vai para a ação do dono; sem agenda, qualquer causa vai
    if (semAgenda || (!permanente && e.tamanhoOkHa36h === true)) out.acao.push(FRASE_SINAL_NAO_LIDO)
    return
  }
  const v = e.sinal.valor
  out.banco = {
    estado: v.estado, cor: v.cor, dia_de_leitura: v.diaDeLeitura, ilegiveis: v.ilegiveis, projecao: v.projecao.estado,
    pct_do_limite: v.ultima?.pctDoLimite ?? null, horas_sem_medida: v.horasSemMedida === null ? null : Math.round(v.horasSemMedida),
    ...(v.tela ? { nivel: v.tela.nivel } : {}),
  }
  const horasRed = RULES.dbSize.unmeasuredRedHours
  if (v.estado === 'medido') {
    if (v.cor === 'amarelo' || v.cor === 'vermelho') out.acao.push(v.frase)
  } else if (v.estado === 'sem_leitura_hoje') {
    out.acao.push(v.frase)
    if (v.horasSemMedida !== null && v.horasSemMedida > horasRed) out.problemas.push(v.frase)
  } else {
    // nunca medido: a data da primeira leitura só é prometida com a medida agendada
    const horasDeAgenda = e.agendaDesde === null ? null : (e.agoraMs - Date.parse(e.agendaDesde)) / HORA_MS
    const comAgenda = horasDeAgenda !== null && Number.isFinite(horasDeAgenda)
    const agendada = comAgenda && e.tamanhoDesligada !== true && horasDeAgenda < horasRed
    let linha = fraseDeNuncaMedido(v.diaDeLeitura, agendada)
    if (!agendada) {
      if (e.agendaDesde === null) linha += ' A agenda está desligada: a medida das 05:00 não roda.' // TEXTO-A-REVISAR (P11)
      else if (e.tamanhoDesligada === true) linha += ' A medida do tamanho do banco está desligada.' // TEXTO-A-REVISAR
      else if (comAgenda && horasDeAgenda >= horasRed) {
        linha += ` A agenda roda há mais de ${horasRed} h e a medida não veio.` // TEXTO-A-REVISAR (P11)
        out.problemas.push(linha)
      }
    }
    out.acao.push(linha)
  }
  if (v.ilegiveis > 0) {
    out.acao.push(`tamanho do banco: ${v.ilegiveis} medida(s) ilegível(is) ficaram fora da conta; a cor e a previsão podem estar erradas`)
  }
  // e-mail: amarelo uma vez por mês, vermelho uma vez por semana (por site)
  if ((v.cor === 'amarelo' || v.cor === 'vermelho') && e.todas) {
    for (const siteId of [...new Set(e.todas.map(r => r.site_id))]) {
      out.avisos.push({ siteId, chave: 'banco_no_limite', tarefa: 'tamanho do banco', frase: v.frase, periodo: v.cor === 'amarelo' ? 'mes' : 'semana' })
    }
  }
}

function dasPendencias(e: EntradaExtras, out: ExtrasDoDisparo): void {
  const p = e.pendencias
  if ('porque' in p) { out.notas.push(NOTA_PENDENCIAS_NAO_LIDAS); return }
  let naoLida = false
  if ('porque' in p.semExport) naoLida = true
  else if (p.semExport.valor.length > 0) {
    out.acao.push(`arquivo: ${p.semExport.valor.length} tabela(s) sem export: ${p.semExport.valor.join(', ')}`)
  }
  if ('porque' in p.miniaturas) naoLida = true
  else {
    const m = p.miniaturas.valor
    if (m.urls > 0 && m.diasDaMaisAntiga !== null && m.diasDaMaisAntiga >= RULES.archive.blobPendingAlertDays) {
      const k = Math.ceil(m.urls / RULES.archive.blobRetryMaxPerDay)
      out.acao.push(
        `${m.urls} miniatura(s) de canal removido ainda públicas há ${m.diasDaMaisAntiga} dias; a tarefa diária apaga até ${RULES.archive.blobRetryMaxPerDay} por dia: ` +
        `no ritmo normal ${k === 1 ? 'falta' : 'faltam'} ${k} dia(s)`,
      )
    }
  }
  if (naoLida) out.notas.push(NOTA_PENDENCIAS_NAO_LIDAS)
  // mesma regra do sinal: causa permanente (a função sumiu ou mudou de forma) deixa o alarme mudo para sempre, então vai também para o vermelho
  const permanente = ('porque' in p.semExport && CAUSAS_PERMANENTES.has(p.semExport.porque)) || ('porque' in p.miniaturas && CAUSAS_PERMANENTES.has(p.miniaturas.porque))
  if (permanente) out.problemas.push(NOTA_PENDENCIAS_NAO_LIDAS)
}

function daPausa(e: EntradaExtras, out: ExtrasDoDisparo): void {
  if (!e.todas) return
  const n = notasDePausa(e.todas, e.agoraMs)
  if (n.nota) out.notas.push(n.nota)
  out.acao.push(...n.acao)
  // um aviso por SITE com todos os canais esquecidos: a chave de repetição não tem o canal, então um aviso por canal suprimiria o 2º
  const porSite = new Map<string, NotasDePausa['esquecidos']>()
  for (const x of n.esquecidos) porSite.set(x.siteId, [...(porSite.get(x.siteId) ?? []), x])
  for (const [siteId, lista] of porSite) {
    const nomeDe = (x: NotasDePausa['esquecidos'][number]): string => `${x.nome} (${x.dias === null ? 'tempo desconhecido' : `${x.dias} dias`})`
    const frase = lista.length === 1
      ? lista[0]!.dias === null
        ? `Canal ${lista[0]!.nome} com a coleta pausada há tempo desconhecido e ainda não removido`
        : `Canal ${lista[0]!.nome} com a coleta pausada há ${lista[0]!.dias} dias e ainda não removido`
      : `${lista.length} canais com a coleta pausada há mais de ${RULES.pause.forgottenDays} dias e ainda não removidos: ${lista.map(nomeDe).join(', ')}`
    out.avisos.push({ siteId, chave: 'coleta_pausada_esquecida', tarefa: 'coleta pausada', frase, periodo: 'semana' })
  }
}

export function extrasDoDisparo(e: EntradaExtras): ExtrasDoDisparo {
  const out: ExtrasDoDisparo = { acao: [], notas: [], avisos: [], problemas: [], banco: {} }
  doSinal(e, out)
  dasPendencias(e, out)
  daPausa(e, out)
  return out
}

/**
 * Junta as frases vermelhas do arquivo à mensagem do cron, sem passar de `max` e sem partir frase: o que não cabe vira "e mais N avisos"
 * (o mesmo fecho de `failureMessage`). Sem problema nenhum, devolve o veredito como veio.
 */
export function juntarVermelho(
  f: { vermelho: boolean; mensagem: string | null },
  problemas: string[],
  max: number,
): { vermelho: boolean; mensagem: string | null } {
  if (problemas.length === 0) return { vermelho: f.vermelho, mensagem: f.mensagem }
  const mais = (n: number): string => ' | e mais ' + plural(n, 'aviso', 'avisos')
  let out = f.mensagem ?? ''
  let perdidos = 0
  let i = 0
  for (; i < problemas.length; i++) {
    const candidato = out + (out ? ' | ' : '') + problemas[i]!
    const sobram = problemas.length - i - 1
    if (candidato.length + (sobram > 0 ? mais(sobram).length : 0) > max) break
    out = candidato
  }
  perdidos = problemas.length - i
  if (perdidos === 0) return { vermelho: true, mensagem: out }
  // a mensagem de antes não deixa espaço para o fecho: corta frases inteiras do fim dela; se for uma frase só, corta o texto com reticências
  let cabeca = out
  for (;;) {
    if (cabeca.length + mais(perdidos).length <= max) break
    const corte = cabeca.lastIndexOf(' | ')
    if (corte > 0) { cabeca = cabeca.slice(0, corte); perdidos++; continue }
    cabeca = cabeca.slice(0, Math.max(0, max - mais(perdidos).length - 1)) + '…'
    break
  }
  return { vermelho: true, mensagem: cabeca + mais(perdidos) }
}
