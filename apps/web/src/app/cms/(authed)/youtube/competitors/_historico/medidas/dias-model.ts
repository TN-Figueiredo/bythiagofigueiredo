// A5 E5a, Tarefa 20 (mockup 13, bloco 3): o que o gráfico "Views por dia e cada mudança" ganha. Puro, com o relógio por parâmetro.
// O cabeçalho e a forma do gráfico de hoje NÃO são redesenhados: aqui estão as raias, o agrupamento "×N", as faixas, a linha "saiu do YouTube",
// a linha de 24/08 e a forma "contagem por semana". Toda frase nova leva a marca TEXTO-A-REVISAR para o Logan.
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { Leitura } from '@/lib/youtube/observatorio/medidas/m1'
import { somaDias } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { linhaDeCorteNaJanela } from '@/lib/youtube/observatorio/medidas-telas/calendario-das-paginas'
import { DAY, H, spDateStart } from '@/lib/youtube/observatorio/time'
import { dm, horaSP, milhar, spDateOfMs } from './formatos'
import { MUITAS_MUDANCAS, type CampoDoVideo, type MudancaNumerada, type TipoDeMudanca } from './mudancas-model'

// ───── as raias ─────

/**
 * A raia do GRÁFICO. Não é o `LaneType` do módulo (esse é o campo das versões e das comparações, e continua `'title' | 'thumb' | 'desc'`):
 * a descrição, as tags, a categoria, a duração e os capítulos caem juntas em "Outras".
 */
export type RaiaDoGrafico = 'title' | 'thumb' | 'outras'
export const RAIAS_DO_GRAFICO: ReadonlyArray<{ id: RaiaDoGrafico; nome: string; forma: 'losango' | 'triangulo' | 'circulo' }> = [
  { id: 'title', nome: 'Título', forma: 'losango' },
  { id: 'thumb', nome: 'Miniatura', forma: 'triangulo' },
  { id: 'outras', nome: 'Outras', forma: 'circulo' },
]

/** Campo ou tipo de mudança para a raia do gráfico. Aceita os nomes do motor e os do `LaneType`. */
export function raiaDoCampo(campo: CampoDoVideo | 'title' | 'thumb' | 'desc' | TipoDeMudanca): RaiaDoGrafico {
  if (campo === 'titulo' || campo === 'title') return 'title'
  if (campo === 'miniatura' || campo === 'thumb') return 'thumb'
  return 'outras'
}

/** O que a legenda da raia "Outras" diz que ela junta. */
export const CAMPOS_DE_OUTRAS: readonly string[] = ['descrição', 'tags', 'categoria', 'duração', 'capítulos']
export const LEGENDA_DE_OUTRAS = `outras (${CAMPOS_DE_OUTRAS.join(', ')})`

// ───── o agrupamento "×N" ─────

/** Marcas a menos de tantos px na mesma raia viram uma só. */
export const DISTANCIA_DO_AGRUPAMENTO_PX = 26

export interface GrupoDeMarcas<T extends { x: number }> { x: number; itens: T[]; n: number; rotulo: string | null }

/** Por raia, ordena por x e junta enquanto a distância ao ANTERIOR for menor que `minPx`. A posição do grupo é a da primeira marca. */
export function agruparMarcas<T extends { x: number; raia: RaiaDoGrafico }>(marcas: readonly T[], minPx = DISTANCIA_DO_AGRUPAMENTO_PX): Array<GrupoDeMarcas<T> & { raia: RaiaDoGrafico }> {
  const out: Array<GrupoDeMarcas<T> & { raia: RaiaDoGrafico }> = []
  for (const raia of RAIAS_DO_GRAFICO.map((r) => r.id)) {
    const ord = marcas.filter((m) => m.raia === raia).sort((a, b) => a.x - b.x)
    let atual: T[] = []
    const fecha = (): void => {
      if (atual.length === 0) return
      out.push({ raia, x: atual[0]!.x, itens: atual, n: atual.length, rotulo: atual.length > 1 ? `×${atual.length}` : null })
      atual = []
    }
    for (const m of ord) {
      const anterior = atual[atual.length - 1]
      if (anterior !== undefined && m.x - anterior.x >= minPx) fecha()
      atual.push(m)
    }
    fecha()
  }
  return out
}

/** Com mais de 6 mudanças as linhas verticais não atravessam as barras: só um traço curto, na altura da raia. */
export const modoDasLinhas = (nMudancas: number): 'atravessa' | 'traco_curto' => (nMudancas > MUITAS_MUDANCAS ? 'traco_curto' : 'atravessa')

// ───── onde cai cada mudança ─────

export type PosicaoDaMudanca =
  | { tipo: 'dia'; dia: string; tardia: boolean }
  /** A contagem ficou parada: a marca fica na divisa entre os dois dias da janela, e vale para os dois. */
  | { tipo: 'divisa'; depoisDe: string; antesDe: string }

export function posicaoDaMudanca(m: Pick<MudancaNumerada, 'dia' | 'diaDe' | 'precisao' | 'tardia'>): PosicaoDaMudanca {
  if (m.precisao === 'parada' && m.diaDe !== null && m.diaDe !== m.dia) return { tipo: 'divisa', depoisDe: m.diaDe, antesDe: m.dia }
  return { tipo: 'dia', dia: m.dia, tardia: m.tardia }
}

/** Os dias a que uma mudança pertence: a divisa vale para os dois. */
export const diasDaMudanca = (p: PosicaoDaMudanca): string[] => (p.tipo === 'divisa' ? [p.depoisDe, p.antesDe] : [p.dia])

// ───── as faixas da subida ─────

export interface FaixasDaSubida {
  /** Os 7 dias da subida: a faixa começa na borda DIREITA do dia da subida. */
  subida: { bordaDireitaDoDia: string; dias: string[] }
  /** Os 14 dias antes (tracejada, sobre as raias). */
  antes: { dias: string[] }
}

export function faixasDaSubida(subidaDia: string): FaixasDaSubida {
  const d = MEASURE_RULES.rise.days
  const l = MEASURE_RULES.rise.lookbackDays
  return {
    subida: { bordaDireitaDoDia: subidaDia, dias: Array.from({ length: d }, (_, i) => somaDias(subidaDia, i + 1)) },
    antes: { dias: Array.from({ length: l }, (_, i) => somaDias(subidaDia, i - l)) },
  }
}

// ───── "saiu do YouTube" e a linha de 24/08 ─────

export interface LinhaSaiu {
  /** O primeiro dia sem contagem: a linha fica na borda esquerda dele. */
  dia: string
  rotulo: string
  rotuloCurto: string
  /** Do dia da saída em diante, o resto do eixo vira contorno pontilhado. */
  diasPontilhados: string[]
}

export function linhaSaiu(saiuEm: string | null, diasDoEixo: readonly string[]): LinhaSaiu | null {
  if (saiuEm === null || diasDoEixo.length === 0) return null
  const ultimo = diasDoEixo[diasDoEixo.length - 1]!
  if (saiuEm > ultimo) return null
  const pontilhados = diasDoEixo.filter((d) => d >= saiuEm)
  return {
    dia: saiuEm < diasDoEixo[0]! ? diasDoEixo[0]! : saiuEm,
    rotulo: `✕ saiu do YouTube em ${dm(saiuEm)}: a contagem termina aqui`,
    rotuloCurto: `✕ saiu em ${dm(saiuEm)}`,
    diasPontilhados: pontilhados,
  }
}

/** A linha de 24/08, se a data estiver no eixo. A data sai de `MEASURE_RULES.countChange`. */
export function linhaDeCorteDoEixo(de: string, ate: string): { dia: string; rotulo: string } | null {
  const dia = linhaDeCorteNaJanela(de, ate)
  return dia === null ? null : { dia, rotulo: `${dm(dia)}: mudou a regra de contar views` }
}

// ───── as barras por dia ─────

export type TipoDeDia = 'pub' | 'com' | 'zero' | 'diminuiu' | 'nm' | 'saiu'
export interface DiaDaBarra {
  dia: string
  tipo: TipoDeDia
  /** Views ganhas nas 24 horas até as 12:00; nulo em tudo que não é `com` e `zero`. */
  ganho: number | null
  /** Para os dois dias de uma contagem perdida: o ganho dos dois juntos. */
  junto: number | null
  motivo: string | null
  fala: string
}

const dia12 = (ms: number): string => spDateOfMs(ms)

/**
 * Último valor DIÁRIO de cada dia de São Paulo (a leitura das 12:00 é a que fecha a barra). A leitura por hora das primeiras 72 horas
 * (`porHora`) nunca entra: a última do dia seria a das 23:00 e a barra deixaria de ser "até as 12:00" (portão Phil I3).
 */
function porDia(leituras: readonly Leitura[]): Map<string, number> {
  const por = new Map<string, { t: number; views: number }>()
  for (const l of leituras) {
    if (l.porHora === true) continue
    const d = dia12(l.t)
    const a = por.get(d)
    if (!a || l.t > a.t) por.set(d, { t: l.t, views: l.views })
  }
  return new Map([...por.entries()].map(([d, v]) => [d, v.views]))
}

/**
 * As barras por dia: a barra de um dia é a leitura das 12:00 desse dia menos a do dia anterior; a primeira conta desde a publicação.
 * Falta a leitura de um dia: ele e o seguinte são "não medido" e a frase diz os dois juntos. Zero é medido; contagem que diminuiu não é zero.
 * O dia da publicação só leva a marca da publicação. Depois do dia em que o vídeo saiu, o dia é `saiu`.
 */
export function barrasPorDia(o: {
  leituras: readonly Leitura[]
  publicadoEmMs: number
  agoraMs: number
  /** `AAAA-MM-DD` do primeiro dia sem contagem de um vídeo que saiu; nulo = continua no ar. */
  saiuEm: string | null
}): DiaDaBarra[] {
  const lidas = porDia(o.leituras.filter((l) => Number.isFinite(l.t) && Number.isFinite(l.views)))
  const pub = spDateOfMs(o.publicadoEmMs)
  const hoje = spDateOfMs(o.agoraMs)
  // a barra de hoje só existe depois das 12:00
  const hojeJaFechou = Number(horaSP(o.agoraMs).slice(0, 2)) >= 12
  const ultimoDia = hojeJaFechou ? hoje : somaDias(hoje, -1)
  // publicado antes do meio-dia, o dia da publicação já tem a leitura das 12:00: o ganho desde a publicação fica na coluna dele
  const viewsNoDiaDaPublicacao = lidas.get(pub) ?? null
  const out: DiaDaBarra[] = [{
    dia: pub, tipo: 'pub', ganho: viewsNoDiaDaPublicacao, junto: null, motivo: null,
    fala: `${dm(pub)}: o vídeo foi publicado às ${horaSP(o.publicadoEmMs)}${viewsNoDiaDaPublicacao === null ? ', sem contagem das 12:00 nesse dia' : `; até as 12:00 ganhou ${milhar(viewsNoDiaDaPublicacao)} views`}.`,
  }]
  const dias: string[] = []
  for (let d = somaDias(pub, 1); d <= ultimoDia; d = somaDias(d, 1)) dias.push(d)

  const primeiraLida = dias.find((d) => lidas.has(d)) ?? null
  const montados = new Map<string, DiaDaBarra>()
  let anterior: { dia: string; views: number } | null = viewsNoDiaDaPublicacao === null ? null : { dia: pub, views: viewsNoDiaDaPublicacao }
  for (const d of dias) {
    if (o.saiuEm !== null && d >= o.saiuEm) {
      montados.set(d, { dia: d, tipo: 'saiu', ganho: null, junto: null, motivo: 'o vídeo não está mais no YouTube', fala: `${dm(d)}: o vídeo não está mais no YouTube: não há contagem.` })
      continue
    }
    const v = lidas.get(d)
    if (v === undefined) {
      const ate = primeiraLida === null || d < primeiraLida
      montados.set(d, {
        dia: d, tipo: 'nm', ganho: null, junto: null,
        motivo: ate ? 'sem contagem antes da primeira leitura do vídeo' : 'falta a contagem das 12:00 deste dia',
        fala: `${dm(d)}: não medido: ${ate ? `sem contagem antes de ${primeiraLida === null ? 'hoje' : dm(primeiraLida)}` : 'falta a contagem das 12:00 deste dia'}.`,
      })
      continue
    }
    const veioDeFato = anterior !== null && anterior.dia === somaDias(d, -1)
    // a primeira barra conta desde a publicação, se a primeira leitura for a do dia seguinte a ela
    const desdeAPublicacao = d === somaDias(pub, 1)
    if (veioDeFato || desdeAPublicacao) {
      const ganho = v - (veioDeFato ? anterior!.views : 0)
      if (ganho < 0) montados.set(d, { dia: d, tipo: 'diminuiu', ganho: null, junto: null, motivo: 'a contagem diminuiu', fala: `${dm(d)}: a contagem diminuiu neste dia.` })
      else if (ganho === 0) montados.set(d, { dia: d, tipo: 'zero', ganho: 0, junto: null, motivo: null, fala: `${dm(d)}: 0 views (medido).` })
      else montados.set(d, { dia: d, tipo: 'com', ganho, junto: null, motivo: null, fala: `${dm(d)}: ${milhar(ganho)} views.` })
    } else if (anterior !== null) {
      // há leituras antes, mas o dia anterior está faltando: este dia e o anterior se juntam
      const junto = v - anterior.views
      const ontem = somaDias(d, -1)
      const motivo = 'falta a contagem do dia anterior'
      montados.set(d, { dia: d, tipo: 'nm', ganho: null, junto: junto >= 0 ? junto : null, motivo, fala: `${dm(d)}: não medido: ${motivo}.${junto >= 0 ? ` Os dois dias juntos ganharam ${milhar(junto)} views.` : ''}` })
      const m = montados.get(ontem)
      if (m && m.tipo === 'nm' && junto >= 0) montados.set(ontem, { ...m, junto, fala: `${m.fala.replace(/\.$/, '.')} Os dois dias juntos ganharam ${milhar(junto)} views.` })
    } else {
      // a primeira leitura do vídeo, sem a anterior para tirar a diferença
      montados.set(d, { dia: d, tipo: 'nm', ganho: null, junto: null, motivo: 'primeira contagem do vídeo, sem a anterior para tirar a diferença', fala: `${dm(d)}: não medido: primeira contagem do vídeo, sem a anterior para tirar a diferença.` })
    }
    anterior = { dia: d, views: v }
  }
  for (const d of dias) out.push(montados.get(d)!)
  return out
}

/** Com mais de 12 barras, só o melhor dia e o último levam número. */
export const BARRAS_COM_NUMERO_ATE = 12
export function barrasComNumero(dias: readonly DiaDaBarra[]): Set<string> {
  const medidas = dias.filter((d) => d.tipo === 'com' || d.tipo === 'zero')
  if (medidas.length <= BARRAS_COM_NUMERO_ATE) return new Set(medidas.map((d) => d.dia))
  let melhor = medidas[0]!
  for (const d of medidas) if ((d.ganho ?? 0) > (melhor.ganho ?? 0)) melhor = d
  return new Set([melhor.dia, medidas[medidas.length - 1]!.dia])
}

// ───── a frase do bloco ─────

export interface EntradaDaFraseDosDias {
  dias: readonly DiaDaBarra[]
  semanal: boolean
  saiuEm: string | null
  /** O último dia com contagem (vídeo que saiu). */
  ultimaContagem: string | null
  totalViews: number | null
  subidaDia: string | null
  nMudancas: number
  /** "título, miniatura e outras" */
  tiposDeMudanca: string
  inicioDaContagem: string
  /** O vídeo foi publicado antes do início da contagem. */
  publicadoAntesDoInicio: boolean
  ponteiro: 'mouse' | 'dedo'
}

export function fraseDosDias(e: EntradaDaFraseDosDias): string {
  if (e.semanal) return 'Uma contagem por semana: cada ponto é a média de views por dia da semana. Sem barra por dia e sem dizer se uma mudança “funcionou”.'
  const comDado = e.dias.filter((d) => d.tipo === 'com' || d.tipo === 'zero')
  const comValor = e.dias.filter((d) => d.tipo === 'com')
  const contados = e.dias.filter((d) => d.tipo !== 'pub')
  const nm = e.dias.filter((d) => d.tipo === 'nm')
  const zeros = e.dias.filter((d) => d.tipo === 'zero').length
  const melhor = comValor.reduce<DiaDaBarra | null>((a, d) => (a === null || (d.ganho ?? 0) > (a.ganho ?? 0) ? d : a), null)
  const mud = e.nMudancas > 0 ? `${e.nMudancas} ${e.nMudancas === 1 ? 'mudança registrada' : 'mudanças registradas'}` : null
  if (nm.length > 0 && e.saiuEm === null) {
    const toque = e.ponteiro === 'dedo' ? 'Toque em' : 'Passe o mouse sobre'
    return `Dos ${contados.length} dias desde a publicação, ${nm.length} ${nm.length === 1 ? 'está “não medido”' : 'estão “não medido”'}: uma contagem se perdeu. ${toque} cada barra com hachura rosa para ver o motivo.`
  }
  if (e.saiuEm !== null && e.totalViews !== null) {
    const termina = e.ultimaContagem ?? e.saiuEm
    return `O vídeo ganhou ${milhar(e.totalViews)} views em ${comDado.length} ${comDado.length === 1 ? 'dia' : 'dias'} com contagem. A contagem termina em ${dm(termina)}, o último dia em que o vídeo respondeu.`
  }
  if (e.publicadoAntesDoInicio && melhor) {
    return `A contagem por dia só existe desde ${dm(e.inicioDaContagem)} (${contados.length} dias). Melhor dia: ${dm(melhor.dia)}, com ${milhar(melhor.ganho ?? 0)} views. ${mud ? `Houve ${mud}.` : 'Nenhuma mudança registrada.'}`
  }
  if (zeros > 0 && zeros * 2 >= comDado.length && melhor) {
    return `Dos ${contados.length} dias, ${zeros} ${zeros === 1 ? 'teve' : 'tiveram'} zero view (caixa vazada, medido) e o melhor teve ${milhar(melhor.ganho ?? 0)}. ${mud ? `Houve ${mud}.` : 'Nenhuma mudança registrada.'}`
  }
  if (!melhor) return mud ? `Houve ${mud}.` : 'Nenhuma mudança registrada.'
  const sub = e.subidaDia ? ` ▲ Subida em ${dm(e.subidaDia)}.` : ''
  const m = mud ? ` O canal mudou o vídeo ${e.nMudancas} ${e.nMudancas === 1 ? 'vez' : 'vezes'} (${e.tiposDeMudanca}).` : ' Nenhuma mudança registrada.'
  return `O melhor dia foi ${dm(melhor.dia)}, com ${milhar(melhor.ganho ?? 0)} views.${sub}${m}`
}

// ───── a contagem por semana ─────

export interface PontoDaSemana {
  /** O dia (São Paulo) da leitura que fecha a semana. */
  dia: string
  tipo: 'medido' | 'primeira' | 'diminuiu'
  /** A média de views por dia da semana que termina na data. */
  mediaPorDia: number | null
  fala: string
}

export interface ContagemPorSemana {
  pontos: PontoDaSemana[]
  /** O dia antes do qual não há contagem (tracejado "sem contagem antes de dd/mm"). */
  semContagemAntesDe: string | null
  linhaDeCorte: { dia: string; rotulo: string } | null
  legenda: string[]
  rotuloSemContagem: string | null
}

/**
 * Um ponto por semana, com a média de views por dia (a diferença entre duas leituras dividida pelos dias entre elas). A primeira leitura
 * não tem anterior para tirar a diferença: é hachura (não medido). Nada de barra por dia.
 */
export function contagemPorSemana(leituras: readonly Leitura[], publicadoEmMs: number): ContagemPorSemana {
  const ord = [...leituras].filter((l) => Number.isFinite(l.t) && Number.isFinite(l.views)).sort((a, b) => a.t - b.t)
  const pontos: PontoDaSemana[] = ord.map((l, i): PontoDaSemana => {
    const dia = spDateOfMs(l.t)
    const ant = ord[i - 1]
    if (!ant) return { dia, tipo: 'primeira', mediaPorDia: null, fala: `${dm(dia)}: não medido: primeira contagem do vídeo, sem a anterior para tirar a diferença.` }
    const dias = Math.max(1, Math.round((l.t - ant.t) / DAY))
    const d = l.views - ant.views
    if (d < 0) return { dia, tipo: 'diminuiu', mediaPorDia: null, fala: `${dm(dia)}: a contagem diminuiu nesta semana.` }
    const media = d / dias
    return { dia, tipo: 'medido', mediaPorDia: media, fala: `Semana que termina em ${dm(dia)}: ${milhar(media)} views por dia em média.` }
  })
  const primeiro = pontos[0]?.dia ?? null
  const de = spDateOfMs(publicadoEmMs)
  const ate = pontos.length > 0 ? pontos[pontos.length - 1]!.dia : de
  const corte = linhaDeCorteDoEixo(de, ate)
  return {
    pontos, semContagemAntesDe: primeiro, linhaDeCorte: corte,
    rotuloSemContagem: primeiro ? `sem contagem antes de ${dm(primeiro)}` : null,
    legenda: [
      'média por dia da semana (um ponto por semana)', 'sem contagem (antes da primeira leitura)',
      ...(corte ? [`${dm(corte.dia)}: mudou a regra de contar views`] : []),
    ],
  }
}


// ───── o que o gráfico por dia ganha, em dado serializável (Tarefa 21) ─────

/**
 * Os acréscimos do gráfico "Views por dia e cada mudança", prontos para atravessar do servidor ao `HistoricoScreen` (cliente): só números,
 * textos e a forma por semana. O eixo é o do gráfico de hoje, horas desde a publicação. A barra de cada dia fecha na leitura das 12:00, então
 * "a borda direita do dia D" é as 12:00 de D e a esquerda, as 12:00 do dia anterior.
 */
export interface AcrescimosDoGrafico {
  faixaSubida: { deH: number; ateH: number; rotulo: string } | null
  /** Os 14 dias antes da subida (tracejada). */
  faixaAntes: { deH: number; ateH: number; rotulo: string } | null
  saiu: { h: number; rotulo: string } | null
  corte: { h: number; rotulo: string } | null
  /** As marcas da raia "Outras" (descrição, tags, categoria, duração e capítulos). */
  outras: Array<{ h: number; rotulo: string; aria: string; n: number }>
  /** Só com `series_tier` semanal: a forma por semana no lugar das barras por dia. */
  semanal: ContagemPorSemana | null
}

export function acrescimosDoGrafico(o: {
  publicadoEmMs: number
  subidaDia: string | null
  saiuEm: string | null
  eixo: { de: string; ate: string }
  mudancas: readonly MudancaNumerada[] | null
  semanal: ContagemPorSemana | null
}): AcrescimosDoGrafico {
  const direita = (dia: string): number => (spDateStart(dia) + 12 * H - o.publicadoEmMs) / H
  const esquerda = (dia: string): number => direita(somaDias(dia, -1))
  const f = o.subidaDia ? faixasDaSubida(o.subidaDia) : null
  const saiu = linhaSaiu(o.saiuEm, [o.eixo.de, o.eixo.ate])
  const corte = linhaDeCorteDoEixo(o.eixo.de, o.eixo.ate)
  return {
    faixaSubida: f && o.subidaDia ? { deH: direita(o.subidaDia), ateH: direita(f.subida.dias[f.subida.dias.length - 1]!), rotulo: `os ${f.subida.dias.length} dias da subida` } : null,
    faixaAntes: f && o.subidaDia ? { deH: esquerda(f.antes.dias[0]!), ateH: direita(f.antes.dias[f.antes.dias.length - 1]!), rotulo: `os ${f.antes.dias.length} dias antes` } : null,
    saiu: saiu ? { h: esquerda(saiu.dia), rotulo: saiu.rotulo } : null,
    corte: corte ? { h: esquerda(corte.dia), rotulo: corte.rotulo } : null,
    outras: (o.mudancas ?? []).filter((m) => m.tipo === 'outras').map((m) => ({
      h: (m.ateMs - o.publicadoEmMs) / H, rotulo: m.nomeDosCampos, n: m.n, aria: `Mudança ${m.n}: ${m.nomeDosCampos}, ${m.quando}`,
    })),
    semanal: o.semanal,
  }
}
