// E5a Tarefa 16: o bloco "Ritmo e regularidade". Puro. As casas contam publicações por semana com a MESMA divisão em semanas da M6
// (`floor((agora − t) / 7 dias)`, 0 = a mais recente), então "casas com publicação" e `semanasComPublicacao` da M6 nunca discordam.
// Semana não lida é "—" (hachura), fora da conta, nas duas raias; nunca zero.
import type { MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import { baseDaIdade } from '@/lib/youtube/observatorio/medidas/m1'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import type { ValorRitmo } from '@/lib/youtube/observatorio/medidas/ritmo'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { Formato, Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import { FRASES, classeDoMotivo } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { DAY, spDateOf } from '@/lib/youtube/observatorio/time'
import type { FormatoDoCanal } from './cabecalho-model'
import type { EstadoDaPagina } from './estado-model'
import { dec1, dm, ptn } from './formatos'

const SEMANA = 7 * DAY
const SEMANAS = MEASURE_RULES.rhythm.weeks

export type CasaDaSemana =
  | { estado: 'com'; n: number; fracao: number }
  | { estado: 'zero' }
  | { estado: 'nao_lida'; por: string }

export interface RaiaDeRitmo { rotulo: 'Longos' | 'Shorts'; casas: CasaDaSemana[]; semNenhum: boolean; ausente: boolean }

export type ValorDoCartao =
  | { tipo: 'medido'; texto: string; pequeno: string | null }
  | { tipo: 'nao_medido'; motivo: string }
  | { tipo: 'nao_carregou' }

export interface CartaoDeRitmo { chave: 'intervalo' | 'semanas' | 'buraco'; rotulo: string; valor: ValorDoCartao }

export interface PonteiroDeRitmo {
  rotulo: string
  /** "vira parado depois de N dias" e, só quando 4 × o intervalo passa de 28, a conta entre parênteses. */
  limite: number
  conta: string | null
  /** O intervalo típico (mediana) em dias, para a marca "típico" na régua; nulo quando o canal não tem intervalo medido. */
  tipico: number | null
  dias: number
  passou: boolean
  ate: string | null
  pelaBusca: boolean
  /** Fim da escala, em dias, para posicionar o ponteiro e o limite. */
  escala: number
}

export interface BlocoDeRitmo {
  frase: { negrito: string; resto: string; tom: 'medido' | 'parcial' | 'sem_base' | 'sem_leitura' | 'nao_carregou' }
  raias: RaiaDeRitmo[]
  eixoFim: string
  ponteiro: PonteiroDeRitmo | null
  cartoes: CartaoDeRitmo[]
  semanasLidas: number
}

export interface EntradaDoRitmo {
  /** Nulo = as medidas não carregaram. */
  medidas: MedidasDoCanal | null
  /** Nulo = os vídeos não carregaram. */
  videos: readonly VideoLido[] | null
  formato: FormatoDoCanal
  estado: EstadoDaPagina
  /** A última leitura boa do canal (ms). */
  ultimaLeituraMs: number | null
  agoraMs: number
  hojeSP: string
}

interface Pub { ms: number; formato: Formato | null }
const publicacoes = (videos: readonly VideoLido[]): Pub[] => {
  const out: Pub[] = []
  for (const v of videos) {
    if (v.liveBroadcastContent === 'upcoming') continue
    const ms = baseDaIdade(v)
    if (ms === null) continue
    out.push({ ms, formato: v.isShort === true ? 'short' : v.isShort === false ? 'long' : null })
  }
  return out
}

const umDia = (x: number): string => dec1(x).replace(/,0$/, '')
const semLeituraParou = (e: EstadoDaPagina): boolean => e.tipo === 'erro' || e.tipo === 'saiu' || e.tipo === 'pausado'

function raia(rotulo: 'Longos' | 'Shorts', f: Formato, pubs: readonly Pub[], o: EntradaDoRitmo, primeiraPubMs: number | null): RaiaDeRitmo {
  const contagem = new Array<number>(SEMANAS).fill(0)
  for (const p of pubs) {
    if (p.formato !== f || p.ms > o.agoraMs) continue
    const i = Math.floor((o.agoraMs - p.ms) / SEMANA)
    if (i >= 0 && i < SEMANAS) contagem[i] = (contagem[i] ?? 0) + 1
  }
  const mx = Math.max(3, ...contagem)
  const casas: CasaDaSemana[] = []
  for (let i = SEMANAS - 1; i >= 0; i--) {
    const fim = o.agoraMs - i * SEMANA
    let por: string | null = null
    if (semLeituraParou(o.estado) && o.ultimaLeituraMs !== null && fim > o.ultimaLeituraMs) por = `sem leitura desde ${dm(spDateOf(o.ultimaLeituraMs))}`
    else if (o.estado.tipo === 'primeira_busca' && primeiraPubMs !== null && fim < primeiraPubMs) por = 'ainda não buscada'
    if (por !== null) { casas.push({ estado: 'nao_lida', por }); continue }
    const n = contagem[i] ?? 0
    casas.push(n === 0 ? { estado: 'zero' } : { estado: 'com', n, fracao: n / mx })
  }
  const semNenhum = contagem.every(n => n === 0)
  // Raia toda zero (13 semanas medidas, nenhuma não lida) vira uma linha só; "—" nunca vira "nenhum".
  const todaZero = casas.every(c => c.estado === 'zero')
  return { rotulo, casas, semNenhum, ausente: (semNenhum && o.formato.soShorts && rotulo === 'Longos') || todaZero }
}

function motivoDe(m: Extract<Medida<unknown>, { estado: 'nao_medido' }>): { carregou: boolean; longa: string } {
  const f = FRASES[m.motivo]({ desde: m.desde, fechaEm: m.fechaEm, n: m.n, minimo: m.minimo }, 'canal')
  return { carregou: classeDoMotivo(m.motivo) !== 'nao_carregou', longa: f.longa }
}

/** O maior intervalo entre publicações do formato nas últimas 26 semanas, com as datas (M6 dá só o número). */
function buracoComDatas(pubs: readonly Pub[], f: Formato, refMs: number): { de: string; ate: string | null; aberto: boolean } | null {
  const largas = pubs.filter(p => p.formato === f && p.ms <= refMs && refMs - p.ms <= MEASURE_RULES.rhythm.gapWeeks * SEMANA).map(p => p.ms).sort((a, b) => a - b)
  if (largas.length === 0) return null
  let melhor = { d: (refMs - largas[largas.length - 1]!) / DAY, de: largas[largas.length - 1]!, ate: null as number | null }
  for (let i = 1; i < largas.length; i++) {
    const d = (largas[i]! - largas[i - 1]!) / DAY
    if (d > melhor.d) melhor = { d, de: largas[i - 1]!, ate: largas[i]! }
  }
  return { de: spDateOf(melhor.de), ate: melhor.ate === null ? null : spDateOf(melhor.ate), aberto: melhor.ate === null }
}

export function blocoDeRitmo(o: EntradaDoRitmo): BlocoDeRitmo {
  const nome = o.formato.fmt === 'long' ? { pl: 'vídeos longos', um: 'um longo', um1: 'longo', plc: 'longos' } : { pl: 'Shorts', um: 'um Short', um1: 'Short', plc: 'Shorts' }
  const principal: 'Longos' | 'Shorts' = o.formato.fmt === 'long' ? 'Longos' : 'Shorts'
  const outro: 'Longos' | 'Shorts' = o.formato.fmt === 'long' ? 'Shorts' : 'Longos'
  const m = o.medidas
  if (m === null || o.videos === null) {
    const nc: ValorDoCartao = { tipo: 'nao_carregou' }
    return {
      frase: { negrito: 'A leitura falhou:', resto: ' não deu para ler os vídeos ou as medidas. Nada aqui vale como zero.', tom: 'nao_carregou' },
      raias: [], eixoFim: 'esta semana', ponteiro: null, semanasLidas: 0,
      cartoes: [
        { chave: 'intervalo', rotulo: 'Intervalo típico (valor do meio)', valor: nc },
        { chave: 'semanas', rotulo: `Semanas com ${nome.um}`, valor: nc },
        { chave: 'buraco', rotulo: `Maior buraco entre ${nome.plc} (${MEASURE_RULES.rhythm.gapWeeks} semanas)`, valor: nc },
      ],
    }
  }
  const pubs = publicacoes(o.videos)
  const primeiraPubMs = pubs.length ? Math.min(...pubs.map(p => p.ms)) : null
  const raiaPrincipal = raia(principal, o.formato.fmt, pubs, o, primeiraPubMs)
  const raiaOutra = raia(outro, o.formato.fmt === 'long' ? 'short' : 'long', pubs, o, primeiraPubMs)
  const semanasLidas = raiaPrincipal.casas.filter(c => c.estado !== 'nao_lida').length
  const parou = semLeituraParou(o.estado)
  const ate = o.ultimaLeituraMs !== null ? spDateOf(o.ultimaLeituraMs) : null
  const refMs = parou && o.ultimaLeituraMs !== null ? o.ultimaLeituraMs : o.agoraMs
  const parcial = o.estado.tipo === 'primeira_busca'
  const m6 = (o.formato.fmt === 'long' ? m.porFormato.long : m.porFormato.short).m6

  // A medida (e a frase) do ritmo. Canal em erro/fora do ar: sem o pedido P7 a M6 está ancorada no relógio, não na última leitura,
  // então ela não vale: "não medido: sem leitura desde dd/mm" (pergunta 22).
  type Estado6 = { tipo: 'medido'; v: ValorRitmo }
    | { tipo: 'nao_medido'; motivo: string; tom: BlocoDeRitmo['frase']['tom'] }
    | { tipo: 'nao_carregou' }
  let e6: Estado6
  if (parou) e6 = { tipo: 'nao_medido', motivo: `não medido: sem leitura desde ${ate ? dm(ate) : 'a última leitura'}`, tom: 'sem_leitura' }
  else if (parcial) e6 = { tipo: 'nao_medido', motivo: FRASES.ritmo_parcial({}, 'canal').longa, tom: 'parcial' }
  else if (m6.estado === 'nao_medido') {
    const mt = motivoDe(m6)
    e6 = mt.carregou ? { tipo: 'nao_medido', motivo: mt.longa, tom: 'sem_base' } : { tipo: 'nao_carregou' }
  } else e6 = { tipo: 'medido', v: m6.valor }

  // Régua "dias desde o último vídeo" contra o limite de "parado" que M8 devolve. O limite é arredondado aqui (a mediana vem em dias
  // fracionários, de milissegundos): na tela nunca sai "48.000277…". O número da API do Cowork não muda.
  const todas = pubs.filter(p => p.ms <= refMs)
  const ultimaMs = todas.length ? Math.max(...todas.map(p => p.ms)) : null
  let ponteiro: PonteiroDeRitmo | null = null
  if (ultimaMs !== null) {
    const dias = Math.max(0, Math.floor((refMs - ultimaMs) / DAY))
    const par = m.m8.parado
    const limite = Math.round(par.estado === 'medido' ? par.valor.limite : MEASURE_RULES.stalled.floorDays)
    const tipico = par.estado === 'medido' && par.valor.limite > MEASURE_RULES.stalled.floorDays ? par.valor.limite / MEASURE_RULES.stalled.factor : (e6.tipo === 'medido' ? e6.v.intervaloMedianoDias : null)
    const conta = limite > MEASURE_RULES.stalled.floorDays ? `4 × o intervalo típico, ${umDia((par.estado === 'medido' ? par.valor.limite : limite) / MEASURE_RULES.stalled.factor)} dias` : null
    ponteiro = {
      rotulo: `desde o último ${o.formato.doisFormatos ? 'vídeo (longo ou Short)' : nome.um1}`, limite, conta, tipico, dias, passou: dias > limite,
      ate: parou && ate ? ate : null, pelaBusca: parcial, escala: Math.max(limite * 1.25, dias * 1.12),
    }
  }

  let frase: BlocoDeRitmo['frase']
  if (e6.tipo === 'medido') {
    const v = e6.v
    const tipicoTxt = ptn(Math.round(v.intervaloMedianoDias), 'dia', 'dias')
    const aCada = v.intervaloMedianoDias <= 1 ? 'por dia' : `a cada ${tipicoTxt}`
    const d = ponteiro?.dias ?? null
    if (ponteiro?.passou && d !== null) {
      frase = { negrito: `Parado: nenhum ${o.formato.doisFormatos ? 'vídeo' : nome.um1} há ${ptn(d, 'dia', 'dias')}.`, resto: ` Antes, publicava ${nome.um} ${aCada}.`, tom: 'medido' }
    } else {
      frase = { negrito: `Publica ${nome.um} ${aCada}.`, resto: d !== null ? ` O último saiu há ${ptn(d, 'dia', 'dias')}.` : '', tom: 'medido' }
    }
  } else if (e6.tipo === 'nao_carregou') {
    frase = { negrito: 'A leitura falhou:', resto: ' o cálculo falhou. As casas abaixo mostram o que foi lido.', tom: 'nao_carregou' }
  } else if (e6.tom === 'parcial') {
    frase = { negrito: 'Ritmo parcial:', resto: ' o canal ainda está buscando vídeos. As casas abaixo mostram o que já foi buscado.', tom: 'parcial' }
  } else if (e6.tom === 'sem_leitura') {
    frase = { negrito: 'Ritmo não medido:', resto: ` sem leitura desde ${ate ? dm(ate) : 'a última leitura'}. As casas abaixo mostram o que foi lido até lá.`, tom: 'sem_leitura' }
  } else {
    frase = { negrito: 'Ritmo ainda não medido:', resto: ` ${e6.motivo}. As casas abaixo mostram o que já foi buscado.`, tom: 'sem_base' }
  }

  const sem = (texto: string): ValorDoCartao => ({ tipo: 'nao_medido', motivo: texto })
  const cartoes: CartaoDeRitmo[] = []
  const rotuloBuraco = `Maior buraco entre ${nome.plc} (${MEASURE_RULES.rhythm.gapWeeks} semanas)`
  if (e6.tipo === 'medido') {
    const v = e6.v
    const b = buracoComDatas(pubs, o.formato.fmt, refMs)
    cartoes.push(
      { chave: 'intervalo', rotulo: 'Intervalo típico (valor do meio)', valor: { tipo: 'medido', texto: `${umDia(v.intervaloMedianoDias)} ${v.intervaloMedianoDias === 1 ? 'dia' : 'dias'}`, pequeno: null } },
      { chave: 'semanas', rotulo: `Semanas com ${nome.um}`, valor: { tipo: 'medido', texto: `${v.semanasComPublicacao} de ${semanasLidas}`, pequeno: semanasLidas < SEMANAS ? 'semanas com leitura' : null } },
      { chave: 'buraco', rotulo: rotuloBuraco, valor: { tipo: 'medido', texto: ptn(Math.floor(v.maiorBuracoDias), 'dia', 'dias'), pequeno: b === null ? null : b.aberto ? `sem ${nome.um1} desde ${dm(b.de)}` : `${dm(b.de)} a ${dm(b.ate!)}` } },
    )
  } else if (e6.tipo === 'nao_carregou') {
    const nc: ValorDoCartao = { tipo: 'nao_carregou' }
    cartoes.push({ chave: 'intervalo', rotulo: 'Intervalo típico (valor do meio)', valor: nc }, { chave: 'semanas', rotulo: `Semanas com ${nome.um}`, valor: nc }, { chave: 'buraco', rotulo: rotuloBuraco, valor: nc })
  } else {
    cartoes.push(
      { chave: 'intervalo', rotulo: 'Intervalo típico (valor do meio)', valor: sem(e6.motivo) },
      { chave: 'semanas', rotulo: `Semanas com ${nome.um}`, valor: sem(e6.motivo) },
      { chave: 'buraco', rotulo: rotuloBuraco, valor: sem(e6.motivo) },
    )
  }

  return {
    frase, semanasLidas,
    raias: [raiaPrincipal, raiaOutra],
    eixoFim: parou && ate ? `semana de ${dm(ate)}` : 'esta semana',
    ponteiro, cartoes,
  }
}
