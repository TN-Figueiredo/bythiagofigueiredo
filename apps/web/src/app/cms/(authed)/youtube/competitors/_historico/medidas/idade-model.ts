// A5 E5a, Tarefa 20 (mockup 13, bloco 1): "Views por idade: o vídeo contra o normal do canal". Puro: sem banco, sem relógio (`hojeSP` por
// parâmetro) e sem conta nova. Os dez pontos saem de `pontosDoVideo` (Tarefa 14b), o normal de `normalSem` (14b); aqui só se escolhe o que a
// tela escreve. Toda frase nova leva a marca TEXTO-A-REVISAR para o Logan.
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { PontoDaCurva } from '@/lib/youtube/observatorio/medidas/curva'
import type { Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { PontoDoVideo } from '@/lib/youtube/observatorio/medidas-telas/pontos-por-idade'
import { razaoEscrita } from '@/lib/youtube/observatorio/medidas-telas/faixa-do-normal'
import { abrev, dm, dmy, idadeTxt, larguraDaBarra, milhar } from './formatos'

/** Os dez pontos do eixo por categoria (1, 2, 3, 5, 7, 14, 21, 30, 60, 90 dias). */
export const IDADES_DO_EIXO: readonly number[] = MEASURE_RULES.curve.ages
/** Os três pares de barras ao lado da curva. */
export const IDADES_DOS_PARES: readonly number[] = MEASURE_RULES.ages
const MINIMO_DO_NORMAL = RULES.weakBase

export interface EntradaDeIdade {
  /** Hoje em São Paulo, `AAAA-MM-DD`. */
  hojeSP: string
  /** O dia em que a contagem por dia começou (`INICIO_DAS_MARCAS`); nenhuma data escrita aqui. */
  inicioDaContagem: string
  /** O dia da publicação, `AAAA-MM-DD` (para a frase do vídeo anterior à contagem). */
  publicadoEm: string
  aoVivo: boolean
  saiuDoYoutube: boolean
  /** Horas entre a publicação e a entrada na contagem (`discovered_at`); nulo = não se sabe. */
  horasAteEntrar: number | null
  /** Nulo = a série (ou as marcas) do vídeo não foi lida: o bloco diz "não carregou". */
  pontos: readonly PontoDoVideo[] | null
  /** Nulo = o normal do canal não foi lido. */
  normal: Medida<PontoDaCurva[]> | null
}

export type VideoNaIdade =
  | { tipo: 'medido'; views: number }
  | { tipo: 'nao_medido'; classe: 'nao_medido' | 'nao_carregou'; motivo: string; curto: string; longo: string }
  | { tipo: 'ainda_nao_existe'; fechaEm: string | null }

export type NormalNaIdade =
  | { tipo: 'medido'; views: number; n: number }
  | { tipo: 'nao_medido'; n: number; minimo: number; frase: string }
  | { tipo: 'fora'; frase: string }

export interface PontoDeIdade {
  idade: number
  rotulo: string
  video: VideoNaIdade
  normal: NormalNaIdade
  razao: { texto: string; igual: boolean } | null
  /** A leitura de uma idade (alternativa em texto do gráfico). */
  fala: string
}

export interface ParDeBarras {
  idade: number
  rotulo: string
  estado: 'ok' | 'nao_medido' | 'ainda_nao_existe'
  /** Fração da maior barra do par (0 a 1); a largura em px é `larguraDoPar`. */
  video: { views: number; fracao: number; zero: boolean } | null
  normal:
    | { tipo: 'medido'; views: number; n: number; fracao: number; frase: string }
    | { tipo: 'nao_medido'; frase: string }
    | { tipo: 'fora'; frase: string }
    | null
  razao: { texto: string; igual: boolean } | null
  /** Motivo de "não medido" / "fecha em dd/mm". */
  nota: string | null
  fala: string
}

export type BlocoDeIdade =
  | { tipo: 'nao_carregou'; frase: string }
  | { tipo: 'ainda_nao_existe'; frase: string; fechaEm: string | null; pontos: PontoDeIdade[] }
  | { tipo: 'nao_medido'; motivo: string; extra: string; curto: string; pontos: PontoDeIdade[] }
  | { tipo: 'ok'; aoVivo: boolean; frase: string; pontos: PontoDeIdade[]; pares: ParDeBarras[] }

/** O motivo de um vídeo em uma idade: curto (na célula) e longo (no ponto selecionado). Frases do `NOTAS 13`, seção 2. */
function videoNaIdade(p: PontoDoVideo, e: EntradaDeIdade): VideoNaIdade {
  const m = p.ponto
  if (m.estado === 'medido') return { tipo: 'medido', views: m.valor }
  const nao = (classe: 'nao_medido' | 'nao_carregou', curto: string, longo: string): VideoNaIdade => ({ tipo: 'nao_medido', classe, motivo: m.motivo, curto, longo })
  switch (m.motivo) {
    case 'fecha_em':
      return { tipo: 'ainda_nao_existe', fechaEm: m.fechaEm ?? null }
    case 'leitura_comecou_depois': {
      const d = dm(e.inicioDaContagem)
      return nao('nao_medido', `publicado antes de ${d}`, `publicado antes de ${d}: a contagem por dia começou em ${d}`)
    }
    case 'descoberto_tarde': {
      const h = e.horasAteEntrar
      return nao('nao_medido', 'entrou tarde na contagem', h !== null && h > 0 ? `entrou tarde na contagem: o vídeo entrou na contagem ${milhar(h)} ${h === 1 ? 'hora' : 'horas'} depois de publicado` : 'entrou tarde na contagem')
    }
    case 'leituras_distantes': {
      const falta = m.desde ? ` (falta a contagem de ${dm(m.desde)})` : ''
      return nao('nao_medido', `contagens a mais de ${MEASURE_RULES.maxGapHours} h`, `contagens vizinhas a mais de ${MEASURE_RULES.maxGapHours} horas${falta}`)
    }
    case 'leitura_parou_antes':
      return e.saiuDoYoutube
        ? nao('nao_medido', 'saiu do YouTube', 'o vídeo saiu do YouTube antes desta idade')
        // TEXTO-A-REVISAR: vídeo que não saiu e cuja contagem parou antes da idade
        : nao('nao_medido', 'contagem parou', 'a contagem parou antes desta idade')
    case 'sem_leitura':
      return nao('nao_medido', 'sem contagem', 'sem contagem nesta idade')
    case 'views_ocultas':
      // TEXTO-A-REVISAR
      return nao('nao_medido', 'views ocultas', 'o canal ocultou as views do vídeo')
    case 'sem_publicacao':
      return nao('nao_medido', 'sem data de publicação', 'o vídeo não tem data de publicação')
    case 'serie_nao_pedida':
      // TEXTO-A-REVISAR
      return nao('nao_carregou', 'não carregou', 'não carregou: o dia a dia do vídeo não foi lido')
    case 'leitura_falhou':
    case 'calculo_falhou':
      return nao('nao_carregou', 'não carregou', 'não carregou: a leitura falhou; tente de novo')
    default:
      // Outro motivo da E4: a tela não inventa texto.
      return nao('nao_medido', 'não medido', 'não medido')
  }
}

function normalNaIdade(normal: Medida<PontoDaCurva[]> | null, idade: number, aoVivo: boolean): NormalNaIdade {
  if (aoVivo) return { tipo: 'fora', frase: 'fora do normal do canal (ao vivo ou estreia)' }
  const nenhum = (n: number): NormalNaIdade => ({
    tipo: 'nao_medido', n, minimo: MINIMO_DO_NORMAL,
    frase: n === 0 ? `nenhum vídeo chegou a esta idade (o mínimo é ${MINIMO_DO_NORMAL})` : `só ${n} ${n === 1 ? 'vídeo' : 'vídeos'} (o mínimo é ${MINIMO_DO_NORMAL})`,
  })
  if (normal === null) return nenhum(0)
  if (normal.estado === 'nao_medido') return nenhum(normal.n ?? 0)
  const p = normal.valor.find((x) => x.idadeDias === idade)
  if (!p) return nenhum(0)
  if (p.ponto.estado === 'medido') return { tipo: 'medido', views: p.ponto.valor, n: p.ponto.n }
  // O normal com menos de 3 vídeos é "não medido", mesmo com o vídeo medido.
  return nenhum(p.ponto.n ?? 0)
}

function falaDoPonto(idade: number, v: VideoNaIdade, n: NormalNaIdade, razao: { texto: string } | null): string {
  const cab = `Com ${idadeTxt(idade)}: `
  const normalFrase =
    n.tipo === 'fora' ? '' : n.tipo === 'medido' ? ` O normal do canal: ${milhar(n.views)} (${n.n} vídeos)` : ` O normal do canal: não medido, ${n.frase}.`
  if (v.tipo === 'ainda_nao_existe') {
    return `${cab}ainda não existe${v.fechaEm ? `; fecha em ${dm(v.fechaEm)}` : ''}.${idade > 30 ? ' O primeiro vídeo do canal chega a esta idade depois.' : ''}`
  }
  const comRazao = n.tipo === 'medido' ? (razao && v.tipo === 'medido' ? `${normalFrase}: ${razao.texto}.` : `${normalFrase}.`) : normalFrase
  if (v.tipo === 'medido') return `${cab}o vídeo tinha ${milhar(v.views)} views.${comRazao}`
  return `${cab}${v.classe === 'nao_carregou' ? '' : 'não medido: '}${v.longo}.${comRazao}`
}

function paraOPar(p: PontoDeIdade): ParDeBarras {
  const rotulo = idadeTxt(p.idade)
  if (p.video.tipo === 'ainda_nao_existe') {
    return { idade: p.idade, rotulo, estado: 'ainda_nao_existe', video: null, normal: null, razao: null, nota: p.video.fechaEm ? `fecha em ${dm(p.video.fechaEm)}` : null, fala: p.fala }
  }
  if (p.video.tipo === 'nao_medido') {
    return { idade: p.idade, rotulo, estado: 'nao_medido', video: null, normal: null, razao: null, nota: p.video.longo, fala: p.fala }
  }
  const nv = p.normal.tipo === 'medido' ? p.normal.views : 0
  const max = Math.max(p.video.views, nv, 1)
  return {
    idade: p.idade, rotulo, estado: 'ok',
    video: { views: p.video.views, fracao: p.video.views / max, zero: p.video.views === 0 },
    normal:
      p.normal.tipo === 'medido'
        ? { tipo: 'medido', views: p.normal.views, n: p.normal.n, fracao: p.normal.views / max, frase: `normal do canal, ${p.normal.n} vídeos` }
        : p.normal.tipo === 'fora'
          ? { tipo: 'fora', frase: p.normal.frase }
          : { tipo: 'nao_medido', frase: `normal do canal não medido: ${p.normal.frase.replace(` (o mínimo é ${MINIMO_DO_NORMAL})`, '')}` },
    // Valor zero não escreve razão.
    razao: p.video.views > 0 ? p.razao : null,
    nota: null, fala: p.fala,
  }
}

/** A largura de uma barra de um par em px: proporcional ao valor, com o piso de 4 px só para valor acima de zero. */
export const larguraDoPar = (valor: number, maximo: number, larguraLivrePx: number): number => larguraDaBarra(valor, maximo, larguraLivrePx)

function fraseDoBloco(pontos: readonly PontoDeIdade[], e: EntradaDeIdade, videosForaDaConta: number): string {
  if (e.aoVivo) {
    const n = videosForaDaConta
    const fora = n > 0 ? ` (${n} ${n === 1 ? 'vídeo nessa condição saiu' : 'vídeos nessa condição saíram'} da conta)` : ''
    return `Ao vivo ou estreia: a linha é só deste vídeo, sem comparação com o normal do canal${fora}.`
  }
  const ok = pontos.filter((p) => p.video.tipo === 'medido')
  const nm = pontos.filter((p) => p.video.tipo === 'nao_medido')
  const fut = pontos.filter((p) => p.video.tipo === 'ainda_nao_existe')
  const proximo = fut[0]
  const prox = proximo && proximo.video.tipo === 'ainda_nao_existe' && proximo.video.fechaEm ? ` O próximo ponto, ${idadeTxt(proximo.idade)}, fecha em ${dm(proximo.video.fechaEm)}.` : ''
  const ult = ok[ok.length - 1]
  if (!ult || ult.video.tipo !== 'medido') {
    // TEXTO-A-REVISAR: nenhum ponto que já existe tem contagem
    return `Nenhum dos ${nm.length} ${nm.length === 1 ? 'ponto que já existe tem' : 'pontos que já existem têm'} contagem; ${nm.length === 1 ? 'ele é' : 'cada um é'} “não medido”, com o motivo.`
  }
  if (nm.length > 0) {
    const f = fut.length
    return `Só ${ok.length} dos ${ok.length + nm.length} pontos que já existem ${ok.length === 1 ? 'tem' : 'têm'} contagem; ${nm.length === 1 ? 'o outro é' : `os outros ${nm.length} são`} “não medido”, cada um com o motivo.${
      f === 0 ? '' : f === 1 ? ' O ponto de idade maior ainda não existe.' : ` Os ${f} pontos de idades maiores ainda não existem.`}`
  }
  if (ult.normal.tipo !== 'medido') {
    return `Com ${idadeTxt(ult.idade)} o vídeo tinha ${abrev(ult.video.views)} views ●. O normal do canal ainda não existe nessa idade: ${ult.normal.tipo === 'nao_medido' ? ult.normal.frase : ''}.${prox}`
  }
  return `Com ${idadeTxt(ult.idade)}, ${abrev(ult.video.views)} views ● contra ${abrev(ult.normal.views)} □ do normal do canal (${ult.normal.n} vídeos): ${ult.razao?.texto ?? ''}.${prox}`
}

/** Quantos vídeos ao vivo ou estreia saíram da conta do normal (nota da medida do canal). */
function aoVivoFora(normal: Medida<PontoDaCurva[]> | null): number {
  const nota = normal?.notas.find((n): n is { tipo: 'ao_vivo_fora'; n: number } => n.tipo === 'ao_vivo_fora')
  return nota?.n ?? 0
}

/**
 * O bloco de idade inteiro. `ainda_nao_existe` quando nenhum ponto chegou; `nao_medido` (hachura de ponta a ponta) só quando TODA idade até
 * 30 dias é anterior à contagem; `nao_carregou` quando a série não foi lida (o cabeçalho segue).
 */
export function blocoDeIdade(e: EntradaDeIdade): BlocoDeIdade {
  if (e.pontos === null) return { tipo: 'nao_carregou', frase: 'não carregou: o histórico por idade deste vídeo não foi lido; tente de novo' }
  const dados = e.pontos
  const pontos: PontoDeIdade[] = IDADES_DO_EIXO.map((idade) => {
    const dado = dados.find((p) => p.idadeDias === idade)
    const video: VideoNaIdade = dado ? videoNaIdade(dado, e) : { tipo: 'nao_medido', classe: 'nao_medido', motivo: 'sem_leitura', curto: 'sem contagem', longo: 'sem contagem nesta idade' }
    const normal = normalNaIdade(e.normal, idade, e.aoVivo)
    const razao = video.tipo === 'medido' && normal.tipo === 'medido' ? razaoEscrita(video.views, normal.views) : null
    return { idade, rotulo: `${idade} d`, video, normal, razao, fala: falaDoPonto(idade, video, normal, razao) }
  })

  const ate30 = pontos.filter((p) => p.idade <= 30)
  if (!e.aoVivo && ate30.every((p) => p.video.tipo === 'nao_medido' && p.video.motivo === 'leitura_comecou_depois')) {
    const d = dm(e.inicioDaContagem)
    const n1 = pontos.find((p) => p.idade === 1)?.normal
    const nVideos = n1 && n1.tipo !== 'fora' ? n1.n : 0
    return {
      tipo: 'nao_medido',
      motivo: `publicado em ${dmy(e.publicadoEm)}, antes de ${d}: a contagem por dia começou em ${d}, então não sabemos quantas views o vídeo tinha nas idades até 30 dias`,
      extra: `O normal do canal continua existindo para os vídeos publicados desde ${d}: ${nVideos >= MINIMO_DO_NORMAL ? `${nVideos} vídeos com 1 dia` : 'ainda poucos vídeos'}.`,
      curto: `publicado antes de ${d}`, pontos,
    }
  }
  if (pontos.every((p) => p.video.tipo === 'ainda_nao_existe')) {
    const p1 = pontos[0]!
    const fecha = p1.video.tipo === 'ainda_nao_existe' ? p1.video.fechaEm : null
    return { tipo: 'ainda_nao_existe', fechaEm: fecha, pontos, frase: `O primeiro ponto (1 dia de idade) aparece em ${dm(fecha ?? e.hojeSP)}, depois das 12:00.` }
  }
  return {
    tipo: 'ok', aoVivo: e.aoVivo, pontos,
    frase: fraseDoBloco(pontos, e, aoVivoFora(e.normal)),
    pares: IDADES_DOS_PARES.map((a) => paraOPar(pontos.find((p) => p.idade === a)!)),
  }
}

/** A célula "Com N dias" da faixa de números do resumo. */
export interface CelulaDeIdade {
  idade: number
  rotulo: string
  estado: 'ok' | 'zero' | 'nao_medido' | 'ainda_nao_existe'
  views: number | null
  razao: string | null
  /** "normal do canal: 5.200 (14 vídeos)" · "fora do normal do canal" · "fecha em dd/mm" · motivo curto. */
  sub: string
}

export function celulaDeIdade(p: PontoDeIdade): CelulaDeIdade {
  const rotulo = `Com ${idadeTxt(p.idade)}`
  if (p.video.tipo === 'ainda_nao_existe') return { idade: p.idade, rotulo, estado: 'ainda_nao_existe', views: null, razao: null, sub: p.video.fechaEm ? `fecha em ${dm(p.video.fechaEm)}` : 'ainda não existe' }
  if (p.video.tipo === 'nao_medido') return { idade: p.idade, rotulo, estado: 'nao_medido', views: null, razao: null, sub: p.video.curto }
  const sub =
    p.normal.tipo === 'medido'
      ? `normal do canal: ${milhar(p.normal.views)} (${p.normal.n} vídeos)`
      : p.normal.tipo === 'fora'
        ? 'fora do normal do canal'
        : `normal: não medido, ${p.normal.frase.replace(` (o mínimo é ${MINIMO_DO_NORMAL})`, '')}`
  return { idade: p.idade, rotulo, estado: p.video.views === 0 ? 'zero' : 'ok', views: p.video.views, razao: p.razao && p.video.views > 0 ? p.razao.texto : null, sub }
}

/** As três células "Com 1, 7 e 30 dias" da faixa de números, para qualquer estado do bloco. */
export function celulasDaFaixa(b: BlocoDeIdade): CelulaDeIdade[] {
  if (b.tipo === 'nao_carregou') {
    return IDADES_DOS_PARES.map((idade) => ({ idade, rotulo: `Com ${idadeTxt(idade)}`, estado: 'nao_medido' as const, views: null, razao: null, sub: 'não carregou' }))
  }
  return IDADES_DOS_PARES.map((idade) => celulaDeIdade(b.pontos.find((p) => p.idade === idade)!))
}
