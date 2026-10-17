// A5 E5a, Tarefa 20 (mockup 13, bloco 2): "As primeiras 72 horas, hora a hora". Puro, com o relógio por parâmetro.
// A escala é UMA só, a do tempo real: cada barra vai de `t − 1` a `t` horas desde a publicação, onde `t` é a hora cheia em que ela acaba;
// a primeira barra é parcial, da publicação até a hora cheia. O total e os marcos saem da curva da Tarefa 14d (acumulado por bordas),
// NUNCA da soma das barras.
import { intervalos, type Intervalo } from '@/lib/youtube/horaria/regra'
import { H, floorHour } from '@/lib/youtube/observatorio/time'
import { RULES } from '@/lib/youtube/observatorio/rules'
import {
  REGRAS_DAS_72_HORAS as R72, curvaDe72Horas, marcosDoVideo, motivoSemHoras,
  type CurvaDe72Horas, type MedidaDeHoras, type MotivoDeHora, type MotivoDeHoras, type TracaoDoCanal,
} from '@/lib/youtube/observatorio/medidas-telas/tracao-72h'
import type { HorasDoCanal, LeituraPorHora } from '@/lib/youtube/observatorio/medidas-telas/ler-horas'
import { FRASES_DAS_HORAS, FRASES_DE_HORA, fraseDasHorasSemBarra, CLASSE_DO_MOTIVO, type ContextoDeHoras } from '@/lib/youtube/observatorio/medidas-telas/frases-das-horas'
import { tarefaViva } from '@/lib/youtube/observatorio/medidas-telas/tarefa-viva'
import { dataEHoraSP, dataSP, diaEDataSP, dm, duracaoHM, horaSP, milhar, plural, spDateOfMs } from './formatos'

const MIN = 60_000
const HORAS = R72.HORAS
export const MINIMO_DE_VIDEOS_DO_NORMAL = RULES.weakBase

export type FracaoDaRegua = '1/4' | '1/2' | '3/4'
const FRACOES: ReadonlyArray<{ nome: 'um_quarto' | 'metade' | 'tres_quartos'; rotulo: FracaoDaRegua; fator: number; chave: 'umQuarto' | 'metade' | 'tresQuartos' }> = [
  { nome: 'um_quarto', rotulo: '1/4', fator: 0.25, chave: 'umQuarto' },
  { nome: 'metade', rotulo: '1/2', fator: 0.5, chave: 'metade' },
  { nome: 'tres_quartos', rotulo: '3/4', fator: 0.75, chave: 'tresQuartos' },
]

export interface EntradaDeHoras {
  agoraMs: number
  publicadoEmMs: number
  descobertoEmMs: number | null
  aoVivo: boolean
  /** As views de hoje, do cabeçalho (só para o estado "ainda não existe"). */
  viewsAgora: number | null
  /** Nulo = a leitura por hora não foi lida (falhou, ou o prazo estourou). */
  horas: Pick<HorasDoCanal, 'primeiraHoraDoSiteMs' | 'ultimoOkDaTarefaMs' | 'primeiraExecucaoDaTarefaMs'> | null
  /** As leituras DESTE vídeo. */
  leituras: readonly LeituraPorHora[]
  /** `toleranciaVigiaH` da definição da tarefa (`agenda/definicoes.ts`); nenhum número escrito aqui. */
  toleranciaH: number
  /** O normal do canal (`tracaoDoCanal`); nulo = não carregou. */
  normal: (MedidaDeHoras<TracaoDoCanal> & { fora?: unknown }) | null
  /** Primeiro dia da contagem por dia do vídeo (`AAAA-MM-DD`), para a frase de "entrou tarde"; nulo = não se sabe. */
  contagemPorDiaDesde: string | null
}

export type EstadoDaLeituraPorHora =
  | { tipo: 'comecou'; texto: string }
  | { tipo: 'nao_comecou'; texto: string }
  | { tipo: 'parada'; texto: string }
  | { tipo: 'nao_lida'; texto: string }

export type TipoDeBarra = 'medido' | 'zero' | 'diminuiu' | 'nao_medido' | 'ainda_nao_existe'
export interface BarraDaHora {
  /** 1 a 72. */
  j: number
  deMs: number
  ateMs: number
  /** Horas desde a publicação (a escala do eixo). */
  xDe: number
  xAte: number
  tipo: TipoDeBarra
  ganho: number | null
  motivo: MotivoDeHora | null
  /** O contador no fim da hora (a última leitura até a borda); nulo antes da primeira contagem. */
  acumulado: number | null
  /** "02:00 a 03:00" (a primeira: "20:40 a 21:00"). */
  intervalo: string
  /** "sex 09/10": a data do início da barra (o intervalo de 23:00 a 00:00 leva o dia que termina). */
  data: string
  fala: string
}

export type TotalDas72Horas =
  | { tipo: 'medido'; views: number }
  | { tipo: 'ainda_nao_existe'; frase: string }
  | { tipo: 'nao_medido'; motivo: MotivoDeHoras; frase: string }

export interface MarcaDoVideo {
  fracao: FracaoDaRegua
  /** Horas desde a publicação, arredondadas para a hora (o rótulo da régua); nulo = a marca não existe (ponto hachurado na ponta de 0 h). */
  horas: number | null
  /** Onde a linha cai no gráfico: o fim da barra em que a contagem chegou à fração; nulo = não se desenha. */
  x: number | null
  motivo: MotivoDeHoras | null
}

export type NormalDaRegua =
  | { tipo: 'medido'; n: number; marcas: Array<{ fracao: FracaoDaRegua; horas: number }> }
  | { tipo: 'nao_medido'; n: number; frase: string }
  | { tipo: 'fora'; frase: string }

export interface ReguaDeHoras {
  video: MarcaDoVideo[]
  normal: NormalDaRegua
  /** Frases do motivo de cada marca do vídeo que não existe. */
  frasesDoVideo: string[]
  eixo: number[]
  aria: string
}

export interface MarcaDoEixo { x: number; rotulo: '00:00' | '12:00'; data: string | null }

export interface BlocoDeHorasOk {
  tipo: 'ok'
  estado: EstadoDaLeituraPorHora
  /** "publicado qui 08/10, 20:40" */
  publicacao: string
  subtitulo: string
  frase: string
  /** Frases de quantas horas ficaram em cada caso (fora da hora cheia, cobre mais de uma hora, contagem diminuiu, sem barra). */
  frasesDasHoras: string[]
  barras: BarraDaHora[]
  eixo: MarcaDoEixo[]
  /** O trecho antes da primeira contagem em hachura, com a idade do vídeo nessa contagem. */
  antesDaPrimeira: { xAte: number; texto: string } | null
  primeiraContagem: { emMs: number; idadeMin: number; views: number; texto: string } | null
  pico: { j: number; ganho: number; nome: 'maior hora medida'; rotulo: string } | null
  /** A linha de "1/2 das views"; nula na ponta vazia ou quando a metade não foi medida. */
  linhaDaMetade: { x: number; horas: number } | null
  total: TotalDas72Horas
  /** Quantas horas ficaram sem barra com leitura depois (o ganho delas está no total); nulo = não se escreve. */
  horasSemBarra: number
  horasFinaisSemContagem: number
  horasForaDaHoraCheia: number
  horasCobremMaisDeUma: number
  horasQueDiminuiram: number
  zeros: number
  medidas: number
  regua: ReguaDeHoras
  /** "hora com views", "zero medido", ... */
  legenda: string[]
}

export type BlocoDeHoras =
  | { tipo: 'nao_carregou'; estado: EstadoDaLeituraPorHora; frase: string }
  | { tipo: 'ainda_nao_existe'; estado: EstadoDaLeituraPorHora; frase: string; primeiraContagemEmMs: number }
  | { tipo: 'nao_medido'; estado: EstadoDaLeituraPorHora; motivo: MotivoDeHoras; classe: 'nao_medido' | 'nao_carregou'; frase: string; extra: string | null }
  | BlocoDeHorasOk

// ───── o estado da leitura por hora ─────

export function estadoDaLeituraPorHora(
  h: Pick<HorasDoCanal, 'primeiraHoraDoSiteMs' | 'ultimoOkDaTarefaMs' | 'primeiraExecucaoDaTarefaMs'> | null,
  toleranciaH: number,
  agoraMs: number,
): EstadoDaLeituraPorHora {
  // a linha de estado (a forma de erro é a de "parada")
  if (h === null) return { tipo: 'nao_lida', texto: 'não carregou: leitura por hora' }
  if (h.primeiraHoraDoSiteMs === null) return { tipo: 'nao_comecou', texto: 'ainda não começou' }
  const viva = tarefaViva({ ultimoOkMs: h.ultimoOkDaTarefaMs, primeiraExecucaoMs: h.primeiraExecucaoDaTarefaMs, toleranciaH, agoraMs })
  if (viva.estado === 'parada') return { tipo: 'parada', texto: `parada desde ${dataEHoraSP(viva.desdeMs)}` }
  return { tipo: 'comecou', texto: `começou em ${dm(spDateOfMs(h.primeiraHoraDoSiteMs))}` }
}

// ───── as 72 barras ─────

const motivoDoIntervalo = (iv: Intervalo): MotivoDeHora => (iv.fim - iv.inicio > 70 * MIN ? 'cobre_mais_de_uma_hora' : 'fora_da_hora_cheia')

/** O fim da primeira barra: a primeira hora cheia DEPOIS da publicação (publicado às 21:00 em ponto, a barra vai de 21:00 a 22:00). */
export const primeiraHoraCheia = (publicadoEmMs: number): number => floorHour(publicadoEmMs) + H

function montarBarras(e: EntradaDeHoras, curva: CurvaDe72Horas): BarraDaHora[] {
  const pub = e.publicadoEmMs
  const e1 = primeiraHoraCheia(pub)
  const ord = [...e.leituras].sort((a, b) => a.lidaEmMs - b.lidaEmMs)
  const ivs = intervalos(ord.map((l) => ({ takenAt: l.lidaEmMs, views: l.views, likes: l.likes, comments: l.comments })), pub)
  const porBarra = new Map<number, Intervalo>()
  for (const iv of ivs) {
    const j = iv.limpo ? Math.round((floorHour(iv.inicio) + H - e1) / H) + 1 : Math.floor(((iv.inicio + iv.fim) / 2 - (e1 - H)) / H) + 1
    if (j < 1 || j > HORAS) continue
    const atual = porBarra.get(j)
    // o intervalo limpo vence o que não é
    if (!atual || (!atual.limpo && iv.limpo)) porBarra.set(j, iv)
  }
  const primeira = ord[0] ?? null
  const acumuladoAte = (ms: number): number | null => {
    let v: number | null = null
    for (const l of ord) {
      if (l.lidaEmMs <= ms) v = l.views
      else break
    }
    return v
  }
  const out: BarraDaHora[] = []
  for (let j = 1; j <= HORAS; j++) {
    const ateMs = e1 + (j - 1) * H
    const deMs = Math.max(pub, ateMs - H)
    const xDe = (deMs - pub) / H
    const xAte = (ateMs - pub) / H
    const iv = porBarra.get(j)
    const intervalo = `${horaSP(deMs)} a ${horaSP(ateMs)}`
    const data = diaEDataSP(deMs)
    const base = { j, deMs, ateMs, xDe, xAte, intervalo, data }
    // o acumulado: a leitura que fecha a hora; sem ela, a última até a borda
    const fecha = iv ? ord.find((l) => l.lidaEmMs === iv.fim) : undefined
    const acumulado = fecha ? fecha.views : acumuladoAte(ateMs)
    const total = (a: number | null): string => (a === null ? '' : ` Total até aqui: ${milhar(a)}.`)
    const cab = `${data}, ${intervalo}`
    if (ateMs > e.agoraMs) {
      out.push({ ...base, tipo: 'ainda_nao_existe', ganho: null, motivo: null, acumulado: null, fala: `${cab}: ainda não existe.` })
      continue
    }
    if (iv?.limpo && iv.d.views !== null) {
      if (iv.d.views < 0) {
        out.push({ ...base, tipo: 'diminuiu', ganho: null, motivo: null, acumulado, fala: `${cab}: ${FRASES_DE_HORA.diminuiu}.${total(acumulado)}` })
      } else if (iv.d.views === 0) {
        out.push({ ...base, tipo: 'zero', ganho: 0, motivo: null, acumulado, fala: `${cab}: 0 views (medido).${total(acumulado)}` })
      } else {
        out.push({ ...base, tipo: 'medido', ganho: iv.d.views, motivo: null, acumulado, fala: `${cab}: ${milhar(iv.d.views)} views.${total(acumulado)}` })
      }
      continue
    }
    let motivo: MotivoDeHora
    if (iv && !iv.limpo) motivo = motivoDoIntervalo(iv)
    else if (iv) motivo = 'sem_contagem_nesta_hora'
    else if (!primeira || primeira.lidaEmMs >= ateMs) motivo = 'antes_da_primeira_contagem'
    else motivo = 'sem_contagem_nesta_hora'
    const pc = curva.primeiraContagem
    const fala =
      motivo === 'antes_da_primeira_contagem' && pc
        ? `${cab}: não medido: antes da primeira leitura, que foi às ${horaSP(floorHour(pc.emMs))} (${duracaoHM(Math.max(0, (floorHour(pc.emMs) - pub) / MIN))} depois de publicar).`
        : `${cab}: ${FRASES_DE_HORA[motivo]}.`
    out.push({ ...base, tipo: 'nao_medido', ganho: null, motivo, acumulado, fala })
  }
  return out
}

function eixoDe(e: EntradaDeHoras): MarcaDoEixo[] {
  const out: MarcaDoEixo[] = []
  const fim = e.publicadoEmMs + HORAS * H
  for (let t = floorHour(e.publicadoEmMs) + H; t <= fim; t += H) {
    const h = Number(horaSP(t).slice(0, 2))
    if (h !== 0 && h !== 12) continue
    out.push({ x: (t - e.publicadoEmMs) / H, rotulo: h === 0 ? '00:00' : '12:00', data: h === 0 ? dataSP(t) : null })
  }
  return out
}

/** Onde cai a fração: o fim da primeira barra com o contador na fração; só com total lido. */
function xDaFracao(barras: readonly BarraDaHora[], alvo: number): number | null {
  const b = barras.find((x) => x.acumulado !== null && x.acumulado >= alvo && x.tipo !== 'ainda_nao_existe')
  return b ? b.xAte : null
}

// ───── a régua ─────

/** Os rótulos de hora que se tocam descem para a segunda linha: dados os x em px, devolve o nível (0 ou 1) de cada um, na ordem de entrada. */
export function nivelDosRotulos(xsPx: readonly number[], larguraDoRotuloPx: number, folgaPx = 6): number[] {
  const ordem = xsPx.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x)
  const fim = [-Infinity, -Infinity]
  const nivel = new Array<number>(xsPx.length).fill(0)
  for (const { x, i } of ordem) {
    const esq = x - larguraDoRotuloPx / 2
    if (esq >= fim[0]! + folgaPx) { fim[0] = x + larguraDoRotuloPx / 2; nivel[i] = 0 } else { fim[1] = x + larguraDoRotuloPx / 2; nivel[i] = 1 }
  }
  return nivel
}

function reguaDe(e: EntradaDeHoras, curva: CurvaDe72Horas, barras: readonly BarraDaHora[], comecouEm: string | null): ReguaDeHoras {
  const marcos = marcosDoVideo(curva)
  const total = curva.total72.estado === 'medido' ? curva.total72.valor : null
  const video: MarcaDoVideo[] = FRACOES.map((f) => {
    const m = marcos[f.nome]
    if (m.estado !== 'medido') return { fracao: f.rotulo, horas: null, x: null, motivo: m.motivo }
    const x = total === null ? null : xDaFracao(barras, f.fator * total)
    // sem barra que cruze a fração, vale a hora da curva (14d)
    return { fracao: f.rotulo, horas: x === null ? m.valor : Math.round(x), x, motivo: null }
  })
  let normal: NormalDaRegua
  if (e.aoVivo) normal = { tipo: 'fora', frase: FRASES_DAS_HORAS.ao_vivo_ou_estreia({}).longa }
  else if (e.normal !== null && e.normal.estado === 'medido' && (e.normal.n ?? 0) >= MINIMO_DE_VIDEOS_DO_NORMAL) {
    const v = e.normal.valor
    normal = { tipo: 'medido', n: e.normal.n, marcas: FRACOES.map((f) => ({ fracao: f.rotulo, horas: v[f.chave] })) }
  } else {
    const n = e.normal?.n ?? 0
    const nao = e.normal !== null && e.normal.estado === 'nao_medido' ? e.normal.motivo : 'poucos_videos'
    const soN = n === 0 ? 'nenhum vídeo' : `só ${n} ${n === 1 ? 'vídeo' : 'vídeos'}`
    const desde = comecouEm ? `, e a leitura por hora começou em ${comecouEm}` : ''
    normal = {
      tipo: 'nao_medido', n,
      frase: nao === 'poucos_videos' || e.normal === null
        ? `Normal do canal: ${soN} com as 72 horas completas (o mínimo é ${MINIMO_DE_VIDEOS_DO_NORMAL})${desde}.`
        : FRASES_DAS_HORAS[nao]({ n, minimo: MINIMO_DE_VIDEOS_DO_NORMAL }).longa,
    }
  }
  const faltam = video.filter((m) => m.horas === null)
  const frasesDoVideo: string[] = []
  if (faltam.length > 0 && faltam.length < 3) {
    // o motivo é o do primeiro que falta (todos os que faltam por "já tinha passado" têm o mesmo)
    const pc = curva.primeiraContagem
    const motivo = faltam[0]!.motivo
    if (motivo) {
      frasesDoVideo.push(
        FRASES_DAS_HORAS[motivo]({
          fracao: faltam.map((m) => m.fracao).join(' e '),
          depoisDePublicar: pc ? duracaoHM(pc.idadeMin) : '',
          k: curva.ultimaLeitura?.k, views: curva.ultimaLeitura?.views,
        }).longa,
      )
    }
  } else if (faltam.length === 3 && faltam[0]!.motivo) {
    frasesDoVideo.push(FRASES_DAS_HORAS[faltam[0]!.motivo]({ k: curva.ultimaLeitura?.k, views: curva.ultimaLeitura?.views }).longa)
  }
  const partes = video.map((m) => (m.horas === null ? `${m.fracao}: não medido` : `${m.fracao}: ${m.horas} horas`))
  const aria = `Quando o vídeo chegou a um quarto, à metade e a três quartos das views das 72 horas. ${partes.join('; ')}`
  return { video, normal, frasesDoVideo, eixo: [0, 24, 48, 72], aria }
}

// ───── o bloco ─────

export function blocoDeHoras(e: EntradaDeHoras): BlocoDeHoras {
  const estado = estadoDaLeituraPorHora(e.horas, e.toleranciaH, e.agoraMs)
  if (e.horas === null) return { tipo: 'nao_carregou', estado, frase: FRASES_DAS_HORAS.leitura_falhou({}).longa }
  const comecouEm = e.horas.primeiraHoraDoSiteMs === null ? null : dm(spDateOfMs(e.horas.primeiraHoraDoSiteMs))
  const pub = e.publicadoEmMs
  const nao = (motivo: MotivoDeHoras, ctx: ContextoDeHoras = {}): BlocoDeHoras => ({
    tipo: 'nao_medido', estado, motivo, classe: CLASSE_DO_MOTIVO[motivo], frase: FRASES_DAS_HORAS[motivo](ctx).longa,
    extra: motivo === 'entrou_tarde' && e.contagemPorDiaDesde ? `A leitura por dia, a partir de ${dm(e.contagemPorDiaDesde)}, continua abaixo.` : null,
  })
  const ctxMotivo = (): ContextoDeHoras => ({
    comecouEm: comecouEm ?? '',
    publicadoEm: dm(spDateOfMs(pub)) + '/' + spDateOfMs(pub).slice(0, 4),
    horasAteEntrar: e.descobertoEmMs === null ? 0 : Math.round((e.descobertoEmMs - pub) / H),
  })

  const primeiraLida = e.leituras.length > 0 ? Math.min(...e.leituras.map((l) => l.lidaEmMs)) : null
  const semLeitura = e.leituras.length === 0
  if (semLeitura) {
    const m = motivoSemHoras({ publicadoEmMs: pub, descobertoEmMs: e.descobertoEmMs }, e.horas)
    if (m !== 'sem_contagem_nas_72_horas') return nao(m, ctxMotivo())
    if (estado.tipo === 'parada') return nao('leitura_por_hora_parada', { paradaDesde: estado.texto.replace('parada desde ', '') })
    if (e.agoraMs < pub + HORAS * H) {
      // o vídeo ainda está dentro das 72 horas e a leitura por hora vai chegar
      const proxima = floorHour(e.agoraMs) + H
      const descoberto = e.descobertoEmMs === null ? '' : `O vídeo foi descoberto às ${horaSP(e.descobertoEmMs)}${e.viewsAgora === null ? '' : `, com ${milhar(e.viewsAgora)} views`}. `
      // o estado "ainda não existe" do bloco de 72 horas (o do mockup tem a hora de exemplo)
      return {
        tipo: 'ainda_nao_existe', estado, primeiraContagemEmMs: proxima,
        frase: `${descoberto}A primeira leitura por hora entra às ${horaSP(proxima)} ${spDateOfMs(proxima) === spDateOfMs(e.agoraMs) ? 'de hoje' : `de ${dataSP(proxima)}`}; depois a curva ganha uma barra por hora, até 72 horas depois de publicar.`,
      }
    }
    return nao('sem_contagem_nas_72_horas')
  }
  // a primeira contagem já veio depois das 72 horas (ou na última hora): entrou tarde
  if (primeiraLida !== null && primeiraLida >= pub + (HORAS - 1) * H) return nao('entrou_tarde', ctxMotivo())

  const curva = curvaDe72Horas(e.leituras, pub, e.agoraMs)
  const barras = montarBarras(e, curva)
  const pc = curva.primeiraContagem
  const ultimaNaJanela = [...e.leituras].sort((a, b) => b.lidaEmMs - a.lidaEmMs).find((l) => l.lidaEmMs <= pub + HORAS * H)
  const pontaVazia = curva.total72.estado === 'nao_medido' && curva.total72.motivo === 'sem_contagem_no_fim_das_72_horas'
  const totalLido = curva.total72.estado === 'medido'

  let semBarra = 0
  let finais = 0
  let fora = 0
  let cobre = 0
  let diminuiu = 0
  let zeros = 0
  let medidas = 0
  for (const b of barras) {
    if (b.tipo === 'zero') { zeros++; medidas++ } else if (b.tipo === 'medido') medidas++
    else if (b.tipo === 'diminuiu') diminuiu++
    else if (b.tipo === 'nao_medido') {
      if (b.motivo === 'fora_da_hora_cheia') fora++
      else if (b.motivo === 'cobre_mais_de_uma_hora') cobre++
      if (b.motivo === 'antes_da_primeira_contagem') continue
      if (ultimaNaJanela && b.ateMs <= ultimaNaJanela.lidaEmMs && !pontaVazia) semBarra++
      else finais++
    }
  }

  // o total
  let total: TotalDas72Horas
  const t72 = curva.total72
  if (t72.estado === 'medido') total = { tipo: 'medido', views: t72.valor }
  else if (t72.motivo === 'ainda_nao_tem_72_horas') total = { tipo: 'ainda_nao_existe', frase: FRASES_DAS_HORAS.ainda_nao_tem_72_horas({}).longa }
  else total = { tipo: 'nao_medido', motivo: t72.motivo, frase: FRASES_DAS_HORAS[t72.motivo]({ k: curva.ultimaLeitura?.k, views: curva.ultimaLeitura?.views }).longa }

  const regua = reguaDe(e, curva, barras, comecouEm)
  const metade = regua.video.find((m) => m.fracao === '1/2')!
  const linhaDaMetade = !pontaVazia && totalLido && metade.x !== null && metade.horas !== null ? { x: metade.x, horas: metade.horas } : null

  // o pico: a maior hora medida (empate: a primeira)
  let pico: BlocoDeHorasOk['pico'] = null
  for (const b of barras) {
    if ((b.tipo === 'medido') && b.ganho !== null && (pico === null || b.ganho > pico.ganho)) {
      pico = { j: b.j, ganho: b.ganho, nome: 'maior hora medida', rotulo: `${milhar(b.ganho)} em 1 hora` }
    }
  }

  // as frases
  const atraso = pc ? Math.max(0, (floorHour(pc.emMs) - pub) / MIN) : 0
  const primeiraHora = pc ? horaSP(floorHour(pc.emMs)) : ''
  const comeca = pc ? `A curva começa ${duracaoHM(atraso)} depois de publicar (primeira leitura às ${primeiraHora}), já com ${milhar(pc.views)} views` : ''
  let frase: string
  if (medidas > 0 && zeros * 2 >= medidas) {
    frase = `Em ${zeros} das ${medidas} horas medidas o vídeo não ganhou nenhuma view (medido: 0, caixa vazada). Em ${medidas - zeros} ${medidas - zeros === 1 ? 'hora' : 'horas'} ganhou algumas.`
  } else if (metade.horas !== null && totalLido) {
    frase = `Metade das views das 72 horas veio nas primeiras ${metade.horas} horas. ${comeca}.`
  } else if (metade.motivo === 'ja_tinha_passado') {
    frase = `${comeca}; ainda não dá para dizer quando chegou à metade das views (o vídeo já tinha mais da metade quando a leitura por hora começou).`
  } else {
    // a metade não foi medida por outro motivo (ponta vazia, menos de 72 horas)
    frase = `${comeca}; a metade das views não foi medida.`
  }

  const frasesDasHoras: string[] = []
  // quantas horas ficaram em cada caso (desvio 16)
  if (fora > 0) frasesDasHoras.push(`${plural(fora, 'hora', 'horas')} com a leitura fora da hora cheia`)
  if (cobre > 0) frasesDasHoras.push(`${plural(cobre, 'hora', 'horas')} em que a leitura cobre mais de uma hora`)
  if (diminuiu > 0) frasesDasHoras.push(`${plural(diminuiu, 'hora', 'horas')} em que o total de views diminuiu`)
  const sem = fraseDasHorasSemBarra(semBarra, totalLido)
  if (sem) frasesDasHoras.push(sem)

  // Gio trem 5 (7): para uma live, as 72 horas contam do início real (a âncora `baseDaIdade`), não da hora marcada que o cabeçalho mostra.
  // rótulo da âncora da live
  const publicacao = e.aoVivo
    ? `início da live ${diaEDataSP(pub)}, ${horaSP(pub)} (as 72 horas contam daqui, não da hora marcada)`
    : `publicado ${diaEDataSP(pub)}, ${horaSP(pub)}`
  return {
    tipo: 'ok', estado, publicacao,
    subtitulo: pc ? `Horário de São Paulo. Primeira leitura às ${primeiraHora} de ${dataSP(floorHour(pc.emMs))}.` : 'Horário de São Paulo.',
    frase, frasesDasHoras, barras, eixo: eixoDe(e),
    antesDaPrimeira: pc && atraso > 0 ? { xAte: atraso / 60, texto: `${duracaoHM(atraso)} depois de publicar` } : null,
    primeiraContagem: pc ? { ...pc, texto: `primeira leitura às ${primeiraHora}, ${duracaoHM(atraso)} depois de publicar` } : null,
    pico, linhaDaMetade, total,
    horasSemBarra: semBarra, horasFinaisSemContagem: finais, horasForaDaHoraCheia: fora, horasCobremMaisDeUma: cobre, horasQueDiminuiram: diminuiu,
    zeros, medidas, regua,
    legenda: ['hora com views', 'zero medido', 'não medido (antes da primeira leitura)', 'publicação'],
  }
}
