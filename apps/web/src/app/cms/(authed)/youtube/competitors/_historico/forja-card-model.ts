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
import type { ForjaRequest, FrozenReading, ObsChannel, ObsVideo, RequestState } from '@/lib/youtube/observatorio/types'
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
  /**
   * 'ver-trocas' abre a aba Trocas do canal já no vídeo: só existe quando o número da frase conta apenas o que a aba mostra
   * (título e thumbnail deste vídeo, nos 30 dias). 'ver-raias' leva ao gráfico do próprio Histórico (`href` é o âncora `#hv-tlh`).
   */
  acoes: Array<{ id: 'ver-trocas' | 'ver-raias' | 'sincronizar'; label: string; href: string }>
  /** Aberta até a primeira leitura publicada do vídeo; depois recolhe no botão "O que é a forja?". */
  explicacao: { aberta: boolean; texto: string }
  leitura: LeituraView | null; anterior: LeituraView | null
  /**
   * O botão DO CARTÃO. `visivel: false` com pedido em andamento (não há botão de pedir). `por` diz POR QUE está apagado
   * (o cabeçalho lê isso; nunca compara frase).
   */
  botao: { label: string; habilitado: boolean; motivo: string | null; visivel: boolean; por: 'limite' | 'excluido' | 'bloqueado' | 'incapaz' | 'sem-nicho' | 'sincronizar' | null }
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
/** A forja lê por nicho: o servidor recusa o pedido de um vídeo cujo canal não tem nicho ("vídeo desconhecido"). */
export const SEM_NICHO = 'Este canal ainda não tem nicho; a forja lê por nicho.'

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
/**
 * Como a pessoa vê o estado do pedido (spec 7.2). `switch` exaustivo sobre o tipo do motor: um estado novo não compila sem
 * decidir aqui (a lista de ativos vem do motor, não de uma cópia nossa).
 */
function classeDoEstado(s: RequestState): 'aguardando' | 'atrasado' | 'terminal' {
  switch (s) {
    case 'na fila': case 'trabalhando': case 'nova tentativa': case 'liberado pelo vigia': return 'aguardando'
    case 'atrasado': case 'sem máquina': return 'atrasado'
    case 'publicado': case 'falhou': case 'recusado (dado velho)': return 'terminal'
    default: { const fora: never = s; return fora }
  }
}
/**
 * A mensagem de bloqueio, escrita aqui a partir de dados (nunca o `reason` do motor, que cola o rótulo de estado do OUTRO
 * vídeo: "liberado pelo vigia · 15:05"). A situação dele usa as palavras de tela do spec 7.2.
 */
function bloqueioFrase(obs: Observatory, v: ObsVideo, outroVideo: string | null, title: string): string {
  const st = outroVideo ? obs.forja.session.current(null, { type: 'leitura-video', video: outroVideo }).request?.state ?? null : null
  const sit = st == null ? '' : ' (' + (classeDoEstado(st) === 'atrasado' ? 'aguardando, com atraso' : 'aguardando') + ')'
  return 'Já há uma leitura de vídeo' + (v.niche ? ' de ' + obs.nicheLabel(v.niche) : '') + ' em andamento' + sit + ', do vídeo “' + title + '”.'
}

/* ------------------------------------------------------------------ o que o Histórico já calculava para o cartão antigo (a cópia de lá saiu) */
/** Por que o vídeo não pode ser lido, com o que fazer; null quando pode. */
export function excludedOf(obs: Observatory, v: ObsVideo, ch: ObsChannel): string | null {
  const reason = !isObserved(v) ? 'Vídeo fora dos acompanhados: não há dados para a forja ler' : v.niche ? obs.forja.eligibleChannels(v.niche).out.find(o => o.id === v.ch)?.reason ?? null : null
  if (!reason) return null
  const act = !isObserved(v) ? '' : ch.sync.state === 'erro' ? 'Corrija o canal em Canais antes de pedir uma leitura.' : ch.sync.state === 'backfill' ? 'Espere a busca de vídeos terminar antes de pedir uma leitura.' : 'Sincronize o canal antes de pedir uma leitura deste vídeo.'
  return (endDot(reason) + ' ' + act).trim()
}
/**
 * Sem leitura do vídeo: o que a leitura de padrões do nicho diz sobre as fórmulas deste título. `jaDiz`: a frase de vazio
 * ("Ainda não há leitura deste vídeo. Ninguém pediu uma até hoje.") está na tela ao lado do botão, então o bloco não repete
 * a primeira oração (a frase aparece uma vez só no cartão).
 */
export function nicheOf(obs: Observatory, v: ObsVideo, forja: ForjaView, jaDiz = false): NichoView | null {
  if (!v.niche) return null
  const D = obs.date, F = obs.fmt
  const nr = obs.forja.latest('padroes-titulo', v.niche)
  if (!nr) return null
  const pats = patternsOf(nr).filter(p => p.evidence.includes(v.id))
  const when = D.dm(nr.generatedAt) + ' ' + D.hm(nr.generatedAt)
  const sem = 'Ainda não há leitura deste vídeo'
  if (!pats.length) return { text: jaDiz ? 'A leitura de padrões do nicho de ' + when + ' não cita este título.' : sem + ', e a leitura de padrões do nicho de ' + when + ' não o cita.', items: [], foot: null }
  if (pats.every(p => p.verdict.id === 'sem-diferenca')) return { text: (jaDiz ? '' : sem + '. ') + 'A leitura de padrões do nicho de ' + when + ' não viu diferença para as fórmulas deste título: ' + pats.map(p => F.lcfirst(obs.formula(p.formula)?.label ?? p.formula)).join(', ') + '.', items: [], foot: null }
  const s0 = obs.forja.since(nr.id)
  return {
    text: (jaDiz ? '' : sem + '. ') + 'O que a leitura de padrões do nicho de ' + D.dmOrDmy(nr.generatedAt) + ' diz sobre as fórmulas deste título:',
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
  const bloqueado = forja.blockedBy ? { text: bloqueioFrase(obs, v, sc.blockedBy?.video ?? null, forja.blockedBy.title), title: forja.blockedBy.title, href: forja.blockedBy.href } : null
  const machine = sc.machine
  const hm = D.hm
  const tomorrow = 'Libera amanhã às 00:00.'

  /* ---- a situação (switch exaustivo sobre o estado do motor) */
  type Motivo = 'validador' | 'travou' | 'outro' | 'sem-evidencia' | 'sumiu'
  type Decisao = { situacao: Situacao | null; motivoNaoDeu: Motivo | null }
  const daLeitura = (): Decisao => {
    if (!shown) return { situacao: null, motivoNaoDeu: null }
    if (items.length === 0) return { situacao: 'nao-deu', motivoNaoDeu: 'sem-evidencia' }
    return { situacao: novas.length ? 'desatualizada' : 'pronta', motivoNaoDeu: null }
  }
  const decidir = (): Decisao => {
    if (!r) return daLeitura()
    switch (r.state) {
      case 'na fila': case 'trabalhando': case 'nova tentativa': case 'liberado pelo vigia': return { situacao: 'aguardando', motivoNaoDeu: null }
      case 'atrasado': case 'sem máquina': return { situacao: 'atrasado', motivoNaoDeu: null }
      case 'recusado (dado velho)': return { situacao: 'precisa-de-voce', motivoNaoDeu: null }
      case 'falhou': return { situacao: 'nao-deu', motivoNaoDeu: failKindOf(r) }
      // pedido publicado: a leitura dele precisa estar ligada ao pedido. Sem ela (`readingId` nulo no carregador) o que o vídeo
      // tem é uma leitura de antes, e dizer "Pronta" com a hora do pedido ao lado dela seria dar a velha por nova.
      case 'publicado': return !shown || !fresh ? { situacao: 'nao-deu', motivoNaoDeu: 'sumiu' } : daLeitura()
      default: { const fora: never = r.state; return fora }
    }
  }
  const { situacao, motivoNaoDeu } = decidir()

  /* ---- o botão do cartão (o que o servidor aceitaria; a frase de "limite" não é a do motor) */
  const capable = forja.capable
  const semNicho = !v.niche
  // sem nicho não há de quem falar nem cota a gastar: o botão apaga porque a forja lê por nicho, não por limite do dia
  const limite = forja.button.mode === 'disabled' && capable && !excluido && !bloqueado && !semNicho
  // sem pedido deste vídeo o limite pode ter sido gasto por outro do nicho (o limite já exclui vídeo sem nicho: o `!` abaixo vale só quando `limite` é verdadeiro)
  const limiteFrase = (r ? 'Já houve uma leitura deste vídeo hoje. ' : 'Já houve uma leitura de ' + obs.nicheLabel(v.niche!) + ' hoje. ') + tomorrow
  const ativo = r != null && classeDoEstado(r.state) !== 'terminal'
  let habilitado = (forja.button.mode === 'free' || forja.button.mode === 'free-niche') && forja.ask != null
  let motivo: string | null = null
  let por: ForjaCardView['botao']['por'] = null
  if (excluido) { motivo = excluido; por = 'excluido' }
  else if (!capable) { motivo = forja.incapableText; por = 'incapaz' }
  else if (semNicho) { motivo = SEM_NICHO; por = 'sem-nicho' }
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
  // o "Pode pedir de novo." só vale se o botão deixa; senão a frase termina com o motivo real (limite do dia, outro vídeo do
  // nicho, vídeo excluído, forja sem o tipo). "Sincronize o canal" é motivo só de "Precisa de você", que tem a ação própria.
  const tail = habilitado ? ' Pode pedir de novo.' : motivo != null && por !== 'sincronizar' ? ' ' + motivo : ''

  /* ---- a frase, as etapas e as ações */
  let frase: string | null = null
  let passo: Passo | null = null
  let andamento: string | null = null
  const acoes: ForjaCardView['acoes'] = []
  // todo estado do motor decide aqui (exaustivo): um estado novo não compila sem uma frase (ou um `break` explícito dos terminais)
  if (r) {
    switch (r.state) {
      case 'na fila': frase = 'Aguardando: na fila desde ' + hm(r.createdAt) + '.'; passo = { i: 0, k: 'atual', texto: 'em andamento' }; break
      case 'liberado pelo vigia':
        frase = 'Aguardando: o pedido travou e voltou para a fila sozinho' + (r.releasedAt != null ? ', às ' + hm(r.releasedAt) : '') + '.'
        passo = { i: 0, k: 'atual', texto: 'em andamento' }
        break
      case 'trabalhando': {
        const t = r.claimedAt ?? r.startedAt
        frase = 'Aguardando: a forja está escrevendo' + (t != null ? ' desde ' + hm(t) : '') + '. Leva de 10 a 25 minutos.'
        passo = { i: 1, k: 'atual', texto: 'em andamento' }
        break
      }
      case 'nova tentativa': {
        // a próxima consulta que já passou não é uma promessa: só se diz a hora quando ela ainda vem
        const nx = machine.nextPollAt != null && machine.nextPollAt > NOW ? 'às ' + hm(machine.nextPollAt) : 'na próxima consulta'
        frase = 'Aguardando: o texto citava números que não batem com os dados. A forja tenta de novo ' + nx + '.'
        passo = { i: 1, k: 'atual', texto: 'em andamento: o texto citava números que não batem; a forja tenta de novo ' + nx }
        break
      }
      case 'atrasado': case 'sem máquina':
        if (r.state === 'sem máquina' && !machine.alive) {
          frase = 'Aguardando, com atraso: a forja está desligada ou sem internet' + (machine.lastPollAt != null ? ' desde ' + hm(machine.lastPollAt) : '') + '. O pedido fica guardado e roda quando ela voltar.'
        } else {
          // 'atrasado', e 'sem máquina' com a forja ligada (24 h sem pegar o pedido): a espera é o que se diz
          const espera = r.waitingMinutes ?? Math.round((NOW - (r.releasedAt || r.createdAt)) / MIN)
          const limiteAviso = machine.lastPollAt != null ? machine.lastPollAt + FORJA_QUEUE.HEARTBEAT_DEAD_MINUTES * MIN : null
          frase = 'Aguardando, com atraso: esperando há ' + dur(espera) + ', mais que o normal.' + (limiteAviso != null && limiteAviso > NOW ? ' Se passar de ' + hm(limiteAviso) + ', a tela avisa aqui.' : '')
        }
        passo = { i: 0, k: 'atrasada', texto: 'em andamento, com atraso' }
        break
      // os terminais não têm frase de pedido em andamento: a situação (abaixo) já a decidiu pela leitura
      case 'publicado': case 'falhou': case 'recusado (dado velho)': break
      default: { const fora: never = r.state; void fora }
    }
  }
  if (r && classeDoEstado(r.state) !== 'terminal') {
    const minutos = Math.floor((NOW - r.createdAt) / MIN)
    andamento = 'Pedido feito ' + (minutos < 1 ? 'agora' : 'há ' + dur(minutos)) + ', às ' + hm(r.createdAt) + '. ' + PODE_SAIR
  } else {
    // sem pedido em andamento: a situação (já decidida pelo estado do pedido e pela leitura) diz a frase
    switch (situacao) {
      case null: case 'aguardando': case 'atrasado': break
      case 'precisa-de-voce':
        frase = 'Precisa de você: os dados deste canal ' + (r?.refusedDataAsOf != null ? 'são de ' + D.dmOrDmy(r.refusedDataAsOf) + ', antigos' : 'estão antigos') + ' demais para ler.' + (sincronizou ? tail : '')
        if (!sincronizou) acoes.push({ id: 'sincronizar', label: 'Sincronizar este canal', href: '' })
        break
      case 'nao-deu': {
        const parou = (texto: string): Passo => ({ i: 1, k: 'parou', texto })
        if (motivoNaoDeu === 'validador') { frase = 'Não deu: o texto citava números que não batem com os dados, em todas as tentativas.' + tail; passo = parou('parou aqui, ao conferir os números') }
        else if (motivoNaoDeu === 'travou') {
          const n = /^travou-(\d+)x/.exec(r?.failReason ?? '')?.[1]
          frase = 'Não deu: o pedido travou ' + (n ? n + ' vezes' : 'várias vezes') + '.' + tail; passo = parou('parou aqui')
        } else if (motivoNaoDeu === 'outro') { frase = 'Não deu: o pedido falhou' + (r?.failedAt != null ? ' às ' + hm(r.failedAt) : '') + '.' + tail; passo = parou('parou aqui') }
        else if (motivoNaoDeu === 'sem-evidencia') { frase = 'Não deu: a leitura saiu sem evidências.' + tail; passo = r ? parou('parou aqui, ao conferir os números') : null }
        else { frase = 'Não deu: o pedido terminou, mas a leitura não está aqui.' + tail }
        break
      }
      case 'pronta': {
        const at = (r?.state === 'publicado' ? r.publishedAt : null) ?? shown!.generatedAt
        frase = 'Pronta: leitura publicada ' + (D.dmy(at) === D.dmy(NOW) ? '' : 'em ' + D.dmOrDmy(at) + ' ') + 'às ' + hm(at) + '.'
        break
      }
      case 'desatualizada': {
        // O número da frase e o da ação são o MESMO conjunto: a aba Trocas mostra título e thumbnail deste vídeo nos 30 dias.
        // Se algo do que saiu fica fora disso (descrição, ou troca mais antiga), a frase conta tudo e diz o que são, e a ação leva
        // ao gráfico do próprio Histórico, onde as raias mostram o que a aba não mostra.
        const n = novas.length
        const naAba = new Set(obs.changesIn({ days: 30, video: v.id }).filter(c => c.type === 'title' || c.type === 'thumb').map(c => c.id))
        const dentro = novas.filter(id => naAba.has(id)).length
        const desc = novas.filter(id => obs.change(id)?.type === 'desc').length
        const antigas = n - dentro - desc
        const resto = [desc ? (desc === n ? 'de descrição' : desc + ' de descrição') : '', antigas ? (antigas === n ? 'de mais de 30 dias' : antigas + ' de mais de 30 dias') : ''].filter(Boolean)
        frase = 'Pronta, mas desatualizada: depois que ela foi escrita, ' + (n === 1 ? 'saiu 1 troca' : 'saíram ' + n + ' trocas') + (resto.length ? ', ' + resto.join(' e ') : '') + '.'
        if (resto.length === 0) acoes.push({ id: 'ver-trocas', label: verTrocas(n), href: obs.link.canal(ch.id, { tab: 'trocas', video: v.id }) })
        else acoes.push({ id: 'ver-raias', label: 'Ver as trocas no gráfico', href: '#hv-tlh' })
        break
      }
      default: { const fora: never = situacao; void fora }
    }
  }

  // a frase de vazio só aparece ao lado do botão aceso (a tela mostra o motivo do botão no lugar dela quando ele está apagado)
  const vazio = !r && !shown ? VAZIO : null

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
    vazio,
    excluido, bloqueado,
    doNicho: shown ? null : nicheOf(obs, v, forja, vazio != null && botao.motivo == null),
  }
}

/** O rótulo e o comportamento do botão do CABEÇALHO, por situação (spec 6.5). */
export function headerAsk(card: ForjaCardView): HeaderAskView {
  const b = card.botao, sit = card.situacao
  const pode = b.habilitado       // `habilitado` já inclui "a forja aceitaria o pedido" (forja.ask): uma fonte só
  const apagado = (label: string): HeaderAskView => ({ label, modo: 'apagado', frase: b.motivo, aviso: null })
  if (sit === 'aguardando' || sit === 'atrasado') return { label: 'Leitura em andamento: ver', modo: 'so-rola', frase: null, aviso: AVISO_JA_TEM_SITUACAO }
  if (sit === 'pronta' || sit === 'desatualizada') return { label: 'Ver a leitura', modo: 'so-rola', frase: b.por === 'limite' ? b.motivo : null, aviso: AVISO_JA_TEM_SITUACAO }
  if (sit === 'nao-deu') return pode ? { label: 'Pedir leitura à forja de novo', modo: 'pedir', frase: null, aviso: null } : apagado('Pedir leitura à forja de novo')
  if (sit === 'precisa-de-voce') return pode ? { label: 'Pedir leitura à forja de novo', modo: 'pedir', frase: null, aviso: null } : apagado('Pedir leitura à forja')
  return pode ? { label: 'Pedir leitura à forja', modo: 'pedir', frase: null, aviso: null } : apagado('Pedir leitura à forja')
}
