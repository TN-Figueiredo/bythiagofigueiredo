/**
 * A2, Tarefa 7: o modelo puro do cartão "Leitura da forja" do Histórico do vídeo (spec 7.1, 7.2 e 7.4, e o botão do
 * cabeçalho de 6.5). Sem componente e sem relógio: as horas vêm de `obs.date`, os pedidos de `obs.forja.session`, as
 * leituras de `obs.forja`. `forja-card.tsx` desenha o cartão a partir daqui (o cartão antigo saiu na Tarefa 8).
 *
 * Este sistema falha em VERDE: dado ausente (pedido sem horário, leitura sem `sent`, leitura sem itens) não pode virar
 * "ok" com saída vazia nem um número inventado. Cada campo diz o que sai quando o dado não existe, e o teste fixa.
 *
 * Palavras que não aparecem em tela (spec 7.2): "cota", "vigia", "validador", "conferência". As frases do motor
 * (`statusText`, `quota.text`) falam assim e por isso NÃO são reaproveitadas; as da tabela 7.2 moram aqui.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import { isObserved } from '@/lib/youtube/observatorio/observed'
import { failKindOf, FORJA_QUEUE } from '@/lib/youtube/observatorio/forja/states'
import type { ForjaRequest, FrozenReading, ObsChannel, ObsVideo } from '@/lib/youtube/observatorio/types'
import { buildForjaView, patternsOf, readingModel, type ForjaView } from '../_chrome/forja-view-model'

export type Situacao = 'aguardando' | 'atrasado' | 'pronta' | 'desatualizada' | 'precisa-de-voce' | 'nao-deu'
export type EtapaId = 'fila' | 'escrevendo' | 'pronta'
export interface EtapaView {
  id: EtapaId; label: 'Na fila' | 'Escrevendo' | 'Pronta'
  estado: 'feita' | 'atual' | 'atrasada' | 'parou' | 'futura'
  /** "em andamento", "em andamento, com atraso", "parou aqui"…; vazio nas etapas feitas e nas que ainda vêm. */
  texto: string
}
export interface LeituraView {
  id: string
  /** "forja · Gemma 12B · em treino · gerada 05/10 14:10 (SP)": um selo só, com "em treino" dentro. */
  selo: string
  seloInfo: string
  /** "Leu este vídeo e 7 trocas, dados de 05/10 09:00"; null quando o que foi enviado não diz quantas trocas. */
  leu: string | null
  lead: string
  /** O texto da leitura, como veio. `refs` só tem índice quando a leitura traz a evidência desse item (D11). */
  itens: Array<{ texto: string; refs: Array<{ n: number; href: string; label: string }> }>
  /** "Do site": o que mudou depois que a leitura foi escrita. Vazio na leitura recém-publicada. */
  doSite: string[]
  /** "Leitura anterior" na leitura que ficou para trás enquanto um pedido novo anda. */
  rotulo: string | null
}
/** O que a leitura de padrões do nicho diz sobre as fórmulas deste título (site, não forja): o bloco que o cartão antigo já tinha. */
export interface NichoView { text: string; items: Array<{ text: string; href: string; label: string }>; foot: string | null }
export interface ForjaCardView {
  /** O canal do vídeo (`syncCompetitorNow` recebe este id): a ação "Sincronizar este canal" precisa dele. */
  canalId: string
  /** null = nenhum pedido e nenhuma leitura. */
  situacao: Situacao | null
  frase: string | null
  /** Só com pedido em andamento, ou parado em "Não deu". Sem pedido não há etapa, mesmo havendo leitura antiga. */
  etapas: EtapaView[] | null
  /** "Pedido feito há 16 min, às 21:59. Pode sair desta página: o pedido continua." A tela põe "Tela atualizada há N min." no meio. */
  andamento: string | null
  cancelar: boolean
  acoes: Array<{ id: 'ver-trocas' | 'sincronizar'; label: string; href: string }>
  /** Aberta até a primeira leitura publicada do vídeo; depois recolhe no botão "O que é a forja?". */
  explicacao: { aberta: boolean; texto: string }
  leitura: LeituraView | null; anterior: LeituraView | null
  /**
   * O botão DO CARTÃO. `visivel: false` com pedido em andamento (não há botão de pedir). `por` diz POR QUE está apagado
   * (o cabeçalho lê isso; nunca compara frase).
   */
  botao: { label: string; habilitado: boolean; motivo: string | null; visivel: boolean; por: 'limite' | 'excluido' | 'bloqueado' | 'incapaz' | 'sincronizar' | null }
  vazio: string | null
  excluido: string | null
  bloqueado: { text: string; title: string; href: string } | null
  /** O que o site diz sobre este título pela leitura de padrões do nicho (o bloco "niche" de hoje): não se perde. */
  doNicho: NichoView | null
}
export interface HeaderAskView {
  label: string
  /** 'pedir' rola, foca e envia; 'so-rola' só rola e foca; 'apagado' não faz nada e diz o motivo em `frase`. */
  modo: 'pedir' | 'so-rola' | 'apagado'
  frase: string | null
  /** O que o status anuncia ao rolar quando o cartão já tem uma situação (spec 6.5); null sem situação. */
  aviso: string | null
}

export const FORJA_EXPLICACAO = 'A forja é um computador nosso que lê estes números e escreve uma leitura com as evidências. Não muda nada no canal. Leva de 10 a 25 minutos; pode sair desta página.'
export const SELO_INFO = 'O modelo ainda não é especialista neste assunto. Leia como rascunho e confira as evidências.'
export const PODE_SAIR = 'Pode sair desta página: o pedido continua.'
export const AVISO_JA_TEM_SITUACAO = 'A leitura da forja já tem uma situação; ela está logo abaixo.'
export const VAZIO = 'Ainda não há leitura deste vídeo. Ninguém pediu uma até hoje.'
const SINCRONIZE = 'Sincronize o canal primeiro. Depois, pode pedir de novo.'

const MIN = 6e4
const cap = (t: string) => (t ? t[0]!.toUpperCase() + t.slice(1) : t)
const endDot = (t: string) => { const s = String(t).trim(); return /[.!?…]$/.test(s) ? s : s + '.' }
/** 29 → "29 min"; 65 → "1 h 5 min"; 120 → "2 h". */
function dur(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return m + ' min'
  const h = Math.floor(m / 60), r = m % 60
  return h + ' h' + (r ? ' ' + r + ' min' : '')
}
const ACTIVE = new Set<string>(['na fila', 'trabalhando', 'atrasado', 'sem máquina', 'nova tentativa', 'liberado pelo vigia'])

/* ------------------------------------------------------------------ o que o Histórico já calculava para o cartão antigo (a cópia de lá saiu) */
/** Por que o vídeo não pode ser lido, com o que fazer; null quando pode. */
export function excludedOf(obs: Observatory, v: ObsVideo, ch: ObsChannel): string | null {
  const reason = !isObserved(v) ? 'Vídeo fora dos acompanhados: não há dados para a forja ler' : v.niche ? obs.forja.eligibleChannels(v.niche).out.find(o => o.id === v.ch)?.reason ?? null : null
  if (!reason) return null
  const act = !isObserved(v) ? '' : ch.sync.state === 'erro' ? 'Corrija o canal em Canais antes de pedir uma leitura.' : ch.sync.state === 'backfill' ? 'Espere a busca de vídeos terminar antes de pedir uma leitura.' : 'Sincronize o canal antes de pedir uma leitura deste vídeo.'
  return (endDot(reason) + ' ' + act).trim()
}
/** Sem leitura do vídeo: o que a leitura de padrões do nicho diz sobre as fórmulas deste título. */
export function nicheOf(obs: Observatory, v: ObsVideo, forja: ForjaView): NichoView | null {
  if (!v.niche) return null
  const D = obs.date, F = obs.fmt
  const nr = obs.forja.latest('padroes-titulo', v.niche)
  if (!nr) return null
  const pats = patternsOf(nr).filter(p => p.evidence.includes(v.id))
  const when = D.dm(nr.generatedAt) + ' ' + D.hm(nr.generatedAt)
  if (!pats.length) return { text: 'Ainda não há leitura deste vídeo, e a leitura de padrões do nicho de ' + when + ' não o cita.', items: [], foot: null }
  if (pats.every(p => p.verdict.id === 'sem-diferenca')) return { text: 'Ainda não há leitura deste vídeo. A leitura de padrões do nicho de ' + when + ' não viu diferença para as fórmulas deste título: ' + pats.map(p => F.lcfirst(obs.formula(p.formula)?.label ?? p.formula)).join(', ') + '.', items: [], foot: null }
  const s0 = obs.forja.since(nr.id)
  return {
    text: 'Ainda não há leitura deste vídeo. O que a leitura de padrões do nicho de ' + D.dmOrDmy(nr.generatedAt) + ' diz sobre as fórmulas deste título:',
    items: pats.map(p => {
      const n = obs.outliers({ niche: v.niche!, fmt: nr.fmt ?? 'long', formula: p.formula, reading: nr.id }).count
      return { text: endDot(p.verdict.text + (p.attribution && p.verdict.id === 'padrao' ? '. ' + p.attribution : '')), label: n === 1 ? 'Ver o outlier' : 'Ver os ' + n + ' outliers',
        href: obs.link.outliers({ niche: v.niche!, fmt: nr.fmt ?? 'long', formula: p.formula, reading: nr.id, min: obs.RULES.outlierMin }) }
    }),
    foot: (nr.sent.text ? cap(nr.sent.text) + '. ' : '') + (s0 ? (forja.status?.active ? s0.textNoAsk : s0.text) : ''),
  }
}

/* ------------------------------------------------------------------ a leitura */
/** Quantas trocas a leitura leu: o que foi enviado (`sent.ids` menos o vídeo, ou as verificações congeladas); null = não diz. */
function trocasLidas(r: FrozenReading, videoId: string): number | null {
  const ids = r.sent.ids
  if (Array.isArray(ids) && ids.every(x => typeof x === 'string')) return (ids as string[]).filter(id => id !== videoId).length
  if (Array.isArray(r.effects)) return r.effects.length
  return null
}
/**
 * D11: o índice só existe quando a leitura traz a evidência de cada item. O formato guardado traz `analysis.effects`, uma
 * linha por troca lida, na ordem dos itens. Só vira link se TODAS as linhas casam: mesma quantidade que os itens, troca
 * deste vídeo, e o texto do item cita o momento dessa troca. Qualquer dúvida: nenhum índice (nunca um par errado).
 */
function refsOf(obs: Observatory, videoId: string, r: FrozenReading): Array<Array<{ n: number; href: string; label: string }>> {
  const none = r.text.items.map(() => [] as Array<{ n: number; href: string; label: string }>)
  const eff = r.analysis.effects
  if (!Array.isArray(eff) || eff.length !== r.text.items.length) return none
  const out: Array<Array<{ n: number; href: string; label: string }>> = []
  for (let i = 0; i < eff.length; i++) {
    const e: unknown = eff[i]
    const id = typeof e === 'object' && e !== null && typeof (e as { change?: unknown }).change === 'string' ? (e as { change: string }).change : null
    const c = id ? obs.change(id) : undefined
    if (!id || !c || c.video !== videoId || !c.whenText || !r.text.items[i]!.includes(c.whenText)) return none
    out.push([{ n: i + 1, href: obs.link.historico(videoId, { troca: id }), label: c.typeLabel + ' (' + c.whenText + ')' }])
  }
  return out
}
function leituraView(obs: Observatory, videoId: string, r: FrozenReading, o: { rotulo: string | null; doSite: string[] }): LeituraView {
  const D = obs.date, n = trocasLidas(r, videoId), refs = refsOf(obs, videoId, r)
  return {
    id: r.id,
    selo: 'forja · ' + readingModel(r) + ' · em treino · gerada ' + D.dm(r.generatedAt) + ' ' + D.hm(r.generatedAt) + ' (SP)',
    seloInfo: SELO_INFO,
    leu: n == null ? null : 'Leu este vídeo e ' + (n === 0 ? 'nenhuma troca' : obs.fmt.plural(n, 'troca', 'trocas')) + ', dados de ' + D.dm(r.sent.asOf) + ' ' + D.hm(r.sent.asOf),
    lead: r.text.lead,
    itens: r.text.items.map((texto, i) => ({ texto, refs: refs[i]! })),
    doSite: o.doSite, rotulo: o.rotulo,
  }
}

/* ------------------------------------------------------------------ o cartão */
const verTrocas = (n: number) => (n === 1 ? 'Ver a troca' : 'Ver as ' + n + ' trocas')
type Passo = { i: 0 | 1; k: 'atual' | 'atrasada' | 'parou'; texto: string }
function etapasDe(p: Passo): EtapaView[] {
  const base: Array<Pick<EtapaView, 'id' | 'label'>> = [{ id: 'fila', label: 'Na fila' }, { id: 'escrevendo', label: 'Escrevendo' }, { id: 'pronta', label: 'Pronta' }]
  return base.map((b, j) => ({ ...b, estado: j < p.i ? 'feita' : j === p.i ? p.k : 'futura', texto: j === p.i ? p.texto : '' }))
}

/** `forja`: a visão da forja deste vídeo, quando quem chama já a construiu (a tela a usa também para o botão do cabeçalho). */
export function buildForjaCard(obs: Observatory, v: ObsVideo, ch: ObsChannel, pronta?: ForjaView): ForjaCardView | null {
  // o vídeo de um canal próprio não é lido pela forja: nenhuma frase do produto o explica, o cartão simplesmente não existe
  if (ch.own) return null
  const D = obs.date, NOW = obs.NOW
  const forja = pronta ?? buildForjaView(obs, { screen: 'historico', niche: v.niche ?? 'todos', videoId: v.id })
  const sc = obs.forja.session.current(null, { type: 'leitura-video', video: v.id })
  const r: ForjaRequest | null = sc.empty ? null : sc.request
  const vr = forja.niches[0]?.reading ?? null
  const shown = vr ? obs.forja.byId[vr.id] ?? null : null
  const fresh = !!vr && vr.isNew
  const items = shown ? shown.text.items : []
  // "desatualizada": trocas deste vídeo que saíram depois de a leitura ser escrita (a recém-publicada não tem nada depois)
  const since = shown && !fresh ? obs.forja.since(shown.id) : null
  const novas = since?.newChanges ?? []
  const excluido = excludedOf(obs, v, ch)
  const bloqueado = forja.blockedBy ? { text: cap(forja.blockedBy.reason.replace(/^Nada enviado:\s*/, '')), title: forja.blockedBy.title, href: forja.blockedBy.href } : null
  const machine = sc.machine
  const hm = D.hm
  const tomorrow = 'Libera amanhã às 00:00.'

  /* ---- a situação */
  let situacao: Situacao | null = null
  let motivoNaoDeu: 'validador' | 'travou' | 'outro' | 'sem-evidencia' | 'sumiu' | null = null
  if (r && ACTIVE.has(r.state)) situacao = r.state === 'atrasado' || r.state === 'sem máquina' ? 'atrasado' : 'aguardando'
  else if (r?.state === 'recusado (dado velho)') situacao = 'precisa-de-voce'
  else if (r?.state === 'falhou') { situacao = 'nao-deu'; motivoNaoDeu = failKindOf(r) }
  else if (r?.state === 'publicado' && !shown) { situacao = 'nao-deu'; motivoNaoDeu = 'sumiu' }
  else if (shown) {
    if (items.length === 0) { situacao = 'nao-deu'; motivoNaoDeu = 'sem-evidencia' }
    else situacao = novas.length ? 'desatualizada' : 'pronta'
  }

  /* ---- o botão do cartão (o que o servidor aceitaria; a frase de "limite" não é a do motor) */
  const capable = forja.capable
  const limite = forja.button.mode === 'disabled' && capable && !excluido && !bloqueado
  const limiteFrase = (r ? 'Já houve uma leitura deste vídeo hoje. ' : 'Já houve uma leitura de ' + (v.niche ? obs.nicheLabel(v.niche) : 'este nicho') + ' hoje. ') + tomorrow
  const ativo = situacao === 'aguardando' || situacao === 'atrasado'
  let habilitado = (forja.button.mode === 'free' || forja.button.mode === 'free-niche') && forja.ask != null
  let motivo: string | null = null
  let por: ForjaCardView['botao']['por'] = null
  if (excluido) { motivo = excluido; por = 'excluido' }
  else if (!capable) { motivo = forja.incapableText; por = 'incapaz' }
  else if (bloqueado) { motivo = bloqueado.text; por = 'bloqueado' }
  else if (limite) { motivo = limiteFrase; por = 'limite' }
  // recusa por dado velho: só se pede de novo depois que o canal sincronizou (depois da recusa)
  const sincronizou = ch.sync.last != null && r != null && ch.sync.last > (r.refusedAt ?? r.createdAt)
  if (situacao === 'precisa-de-voce' && !sincronizou && motivo == null) { motivo = SINCRONIZE; por = 'sincronizar' }
  if (motivo != null) habilitado = false
  const botao: ForjaCardView['botao'] = {
    label: situacao === 'nao-deu' ? 'Pedir de novo' : shown ? 'Pedir nova leitura deste vídeo à forja' : 'Pedir leitura deste vídeo à forja',
    habilitado, motivo, visivel: !ativo, por,
  }
  // o "Pode pedir de novo." só vale se o botão deixa: a leitura sem evidências gasta o limite do dia
  const tail = por === 'limite' ? ' ' + limiteFrase : ' Pode pedir de novo.'

  /* ---- a frase, as etapas e as ações */
  let frase: string | null = null
  let passo: Passo | null = null
  let andamento: string | null = null
  const acoes: ForjaCardView['acoes'] = []
  if (r && ACTIVE.has(r.state)) {
    const s = r.state
    if (s === 'na fila') { frase = 'Aguardando: na fila desde ' + hm(r.createdAt) + '.'; passo = { i: 0, k: 'atual', texto: 'em andamento' } }
    else if (s === 'liberado pelo vigia') {
      frase = 'Aguardando: o pedido travou e voltou para a fila sozinho' + (r.releasedAt != null ? ', às ' + hm(r.releasedAt) : '') + '.'
      passo = { i: 0, k: 'atual', texto: 'em andamento' }
    } else if (s === 'trabalhando') {
      const t = r.claimedAt ?? r.startedAt
      frase = 'Aguardando: a forja está escrevendo' + (t != null ? ' desde ' + hm(t) : '') + '. Leva de 10 a 25 minutos.'
      passo = { i: 1, k: 'atual', texto: 'em andamento' }
    } else if (s === 'nova tentativa') {
      // a próxima consulta que já passou não é uma promessa: só se diz a hora quando ela ainda vem
      const nx = machine.nextPollAt != null && machine.nextPollAt > NOW ? 'às ' + hm(machine.nextPollAt) : 'na próxima consulta'
      frase = 'Aguardando: o texto citava números que não batem com os dados. A forja tenta de novo ' + nx + '.'
      passo = { i: 1, k: 'atual', texto: 'em andamento: o texto citava números que não batem; a forja tenta de novo ' + nx }
    } else if (s === 'sem máquina' && !machine.alive) {
      frase = 'Aguardando, com atraso: a forja está desligada ou sem internet' + (machine.lastPollAt != null ? ' desde ' + hm(machine.lastPollAt) : '') + '. O pedido fica guardado e roda quando ela voltar.'
      passo = { i: 0, k: 'atrasada', texto: 'em andamento, com atraso' }
    } else {
      // 'atrasado', e 'sem máquina' com a forja ligada (24 h sem pegar o pedido): a espera é o que se diz
      const espera = r.waitingMinutes ?? Math.round((NOW - (r.releasedAt || r.createdAt)) / MIN)
      const limiteAviso = machine.lastPollAt != null ? machine.lastPollAt + FORJA_QUEUE.HEARTBEAT_DEAD_MINUTES * MIN : null
      frase = 'Aguardando, com atraso: esperando há ' + dur(espera) + ', mais que o normal.' + (limiteAviso != null && limiteAviso > NOW ? ' Se passar de ' + hm(limiteAviso) + ', a tela avisa aqui.' : '')
      passo = { i: 0, k: 'atrasada', texto: 'em andamento, com atraso' }
    }
    const minutos = Math.floor((NOW - r.createdAt) / MIN)
    andamento = 'Pedido feito ' + (minutos < 1 ? 'agora' : 'há ' + dur(minutos)) + ', às ' + hm(r.createdAt) + '. ' + PODE_SAIR
  } else if (situacao === 'precisa-de-voce' && r) {
    frase = 'Precisa de você: os dados deste canal ' + (r.refusedDataAsOf != null ? 'são de ' + D.dmOrDmy(r.refusedDataAsOf) + ', antigos' : 'estão antigos') + ' demais para ler.' + (sincronizou ? ' Pode pedir de novo.' : '')
    if (!sincronizou) acoes.push({ id: 'sincronizar', label: 'Sincronizar este canal', href: '' })
  } else if (situacao === 'nao-deu') {
    const parou = (texto: string): Passo => ({ i: 1, k: 'parou', texto })
    if (motivoNaoDeu === 'validador') { frase = 'Não deu: o texto citava números que não batem com os dados, em todas as tentativas.' + tail; passo = parou('parou aqui, ao conferir os números') }
    else if (motivoNaoDeu === 'travou') {
      const n = /^travou-(\d+)x/.exec(r?.failReason ?? '')?.[1]
      frase = 'Não deu: o pedido travou ' + (n ? n + ' vezes' : 'várias vezes') + '.' + tail; passo = parou('parou aqui')
    } else if (motivoNaoDeu === 'outro') { frase = 'Não deu: o pedido falhou' + (r?.failedAt != null ? ' às ' + hm(r.failedAt) : '') + '.' + tail; passo = parou('parou aqui') }
    else if (motivoNaoDeu === 'sem-evidencia') { frase = 'Não deu: a leitura saiu sem evidências.' + tail; passo = r ? parou('parou aqui, ao conferir os números') : null }
    else { frase = 'Não deu: o pedido terminou, mas a leitura não está aqui.' + tail }
  } else if (situacao === 'pronta' || situacao === 'desatualizada') {
    if (situacao === 'desatualizada') {
      frase = 'Pronta, mas desatualizada: depois que ela foi escrita, ' + (novas.length === 1 ? 'saiu 1 troca' : 'saíram ' + novas.length + ' trocas') + '.'
      acoes.push({ id: 'ver-trocas', label: verTrocas(novas.length), href: obs.link.canal(ch.id, { tab: 'trocas' }) })
    } else {
      const at = (r?.state === 'publicado' ? r.publishedAt : null) ?? shown!.generatedAt
      frase = 'Pronta: leitura publicada ' + (D.dmy(at) === D.dmy(NOW) ? '' : 'em ' + D.dmOrDmy(at) + ' ') + 'às ' + hm(at) + '.'
    }
  }

  /* ---- as leituras */
  const doSite: string[] = []
  if (shown && !fresh && since) {
    doSite.push('desde então, ' + (novas.length ? obs.fmt.plural(novas.length, 'troca', 'trocas') : 'nenhuma troca') + '.')
    if (since.items?.length) doSite.push(...since.items)
    if (since.gone && (since.gone.changes.length || since.gone.videos.length)) doSite.push(cap(since.shortText) + '.')
  }
  const rotulo = shown && !fresh && r ? 'Leitura anterior' : null
  const leitura = shown ? leituraView(obs, v.id, shown, { rotulo, doSite }) : null
  const outra = shown && rotulo == null
    ? obs.forja.readings.filter(x => x.type === 'leitura-video' && x.target?.video === v.id && x.id !== shown.id).sort((a, b) => b.generatedAt - a.generatedAt)[0] ?? null
    : null
  const anterior = outra ? leituraView(obs, v.id, outra, { rotulo: 'Leitura anterior', doSite: [] }) : null

  return {
    canalId: ch.id,
    situacao, frase,
    etapas: passo ? etapasDe(passo) : null,
    andamento,
    cancelar: forja.cancel.length > 0 && passo != null && passo.i === 0 && ativo,
    acoes,
    explicacao: { aberta: shown == null, texto: FORJA_EXPLICACAO },
    leitura, anterior, botao,
    vazio: !r && !shown ? VAZIO : null,
    excluido, bloqueado,
    doNicho: shown ? null : nicheOf(obs, v, forja),
  }
}

/** O rótulo e o comportamento do botão do CABEÇALHO, por situação (spec 6.5). */
export function headerAsk(card: ForjaCardView, forja: ForjaView): HeaderAskView {
  const b = card.botao, sit = card.situacao
  const pode = b.habilitado && forja.ask != null
  const apagado = (label: string): HeaderAskView => ({ label, modo: 'apagado', frase: b.motivo, aviso: null })
  if (sit === 'aguardando' || sit === 'atrasado') return { label: 'Leitura em andamento: ver', modo: 'so-rola', frase: null, aviso: AVISO_JA_TEM_SITUACAO }
  if (sit === 'pronta' || sit === 'desatualizada') return { label: 'Ver a leitura', modo: 'so-rola', frase: b.por === 'limite' ? b.motivo : null, aviso: AVISO_JA_TEM_SITUACAO }
  if (sit === 'nao-deu') return pode ? { label: 'Pedir leitura à forja de novo', modo: 'pedir', frase: null, aviso: null } : apagado('Pedir leitura à forja de novo')
  if (sit === 'precisa-de-voce') return pode ? { label: 'Pedir leitura à forja de novo', modo: 'pedir', frase: null, aviso: null } : apagado('Pedir leitura à forja')
  return pode ? { label: 'Pedir leitura à forja', modo: 'pedir', frase: null, aviso: null } : apagado('Pedir leitura à forja')
}
