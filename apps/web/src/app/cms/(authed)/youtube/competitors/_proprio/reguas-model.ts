/**
 * Modelo de "Este vídeo no canal" (spec 17.3 e 17.5; mockup M/regua.js): a posição do vídeo entre os do canal em cada número, o terço
 * e a frase-resumo. Puro: recebe o dado JÁ LIDO (os vídeos do canal e o alcance por vídeo), não lê banco, não pede a prova de edição e
 * não importa os leitores nem `edicao` (uma varredura de teste barra).
 *
 * Regra de ouro (este sistema falha em VERDE): a posição só existe quando o vídeo E pelo menos `MIN_REGUA` vídeos do canal têm a
 * medida. Vídeo sem a medida não tem posição e NÃO é "último": fica fora da régua e fora do "de N", e a linha diz por quê. Zero
 * medido participa; não medido não participa e é contado ("N sem medida"). Nulo nunca vira zero. O empate divide a posição (mesma
 * medida = mesma posição, a medida como a tela a ESCREVE, como a lista de Canais faz) e o terço sai da posição média.
 *
 * A frase diz só o que o dado sustenta, sem número e sem causa ("foi mal porque…"); a base ("entre N vídeos com impressões medidas
 * de 09/09 a 07/10") e a janela vão em `base`, ao lado da frase. Os números têm o MESMO texto da faixa do vídeo (T11) e do cartão
 * (T7): os formatadores são os de lá.
 */
import { createFmt, type Fmt } from '@/lib/youtube/observatorio/fmt'
import { createClock } from '@/lib/youtube/observatorio/time'
import type { AlcanceVideo } from '@/lib/youtube/observatorio/proprio/dias'
import { escalar, MIN_REGUA } from '../_chrome/regua/regua-model'
import { foraDosGuardadosFrase } from './extras'
import { durText, numNb, POUCO_VOLUME } from './formato'

export type Terco = 'cima' | 'meio' | 'baixo'
export interface PosVideo { pos: number; de: number; empates: number; terco: Terco }

const num = (x: number | null): number | null => (x != null && Number.isFinite(x) && x >= 0 ? x : null)

/**
 * 1 + quantos têm valor MAIOR; `de` conta só quem tem o dado; `empates` = quantos OUTROS têm a mesma medida. O terço sai da posição
 * MÉDIA (`pos + empates ÷ 2`) contra `de ÷ 3` e `2 × de ÷ 3` (conta feita em inteiros: sem erro de ponto flutuante nas bordas).
 * `chave` é a medida como a tela a escreve: duas medidas que se escrevem igual dividem a posição, mesmo que o número cru difira.
 * null = o vídeo não tem o dado (nunca "último"), ou menos de `MIN_REGUA` vídeos têm.
 */
export function posicaoNoCanal(vals: ReadonlyArray<{ id: string; x: number | null; chave?: string }>, id: string): PosVideo | null {
  const com = vals.filter((v): v is { id: string; x: number; chave?: string } => num(v.x) != null)
  const eu = com.find(v => v.id === id)
  if (!eu || com.length < MIN_REGUA) return null
  const igual = (o: { x: number; chave?: string }) => (o.chave != null && eu.chave != null ? o.chave === eu.chave : o.x === eu.x)
  let maiores = 0, empates = 0
  for (const o of com) {
    if (o.id === id) continue
    if (igual(o)) empates++
    else if (o.x > eu.x) maiores++
  }
  const pos = 1 + maiores, de = com.length
  const tresMedias = 3 * pos + (3 * empates) / 2 // 3 × (pos + empates ÷ 2)
  const terco: Terco = tresMedias <= de ? 'cima' : tresMedias <= 2 * de ? 'meio' : 'baixo'
  return { pos, de, empates, terco }
}

export type NumeroRegua = 'impressoes' | 'views' | 'vpd' | 'engajamento' | 'assistido' | 'curtidas' | 'comentarios' | 'duracao'

export interface TracoRegua {
  id: string
  /** 0 a 100 no eixo (a escala já aplicada) */
  pct: number
  este: boolean
  /** O valor como a tela o escreve; é por ele que o empate se decide e é ele que a dica e o leitor de tela falam. */
  texto: string
  /** O afastamento do empate, em px (2,6 por vez; o traço deste vídeo fica no valor exato, 0). */
  dx: number
  /** O título do vídeo (a dica e o leitor de tela falam dele); o id quando a entrada não traz. */
  titulo: string
  /** Para onde Enter e o segundo toque levam; null = sem destino (a entrada não deu `hrefVideo`). */
  href: string | null
}

export interface LinhaRegua {
  numero: NumeroRegua
  grupo: 'Alcance' | 'Resposta' | 'Formato'
  nome: string
  /** O valor deste vídeo como a tela o escreve; null = este vídeo não tem o dado (a causa está em `semRegua`). Nunca "0" no lugar de nulo. */
  valor: string | null
  /** true = `valor` é "0" e é ZERO MEDIDO: houve dia medido e o vídeo não apareceu nele (caixa vazada). Nunca vale para "não medido" (valor nulo, hachura). */
  zeroMedido: boolean
  pos: PosVideo | null
  /** "18º de 35 · empate com 2". null = sem posição. */
  posTexto: string | null
  /** A frase que ocupa o lugar da régua: sem o dado neste vídeo, ou poucos vídeos para comparar. null = há régua. */
  semRegua: string | null
  /** Quantos vídeos do canal ficam fora da conta por não terem o dado: "2 sem medida". null = nenhum (ou a leitura nem existe). */
  semMedida: string | null
  /** A segunda linha do nome ("média dos últimos 28 dias"); null = sem ela. */
  sub: string | null
  /** Um traço por vídeo com o dado, do menor ao maior valor. Vazio quando não há régua. */
  tracos: TracoRegua[]
  min: string | null
  max: string | null
  /** Onde a mediana do canal cai no eixo (0 a 100), com a MESMA escala dos traços. */
  medianaPct: number | null
  comprimida: boolean
  /** A duração: comprido não é bom nem ruim; sem cor de terço, fora da frase. */
  neutro: boolean
  /** A lista de Canais ordenada por este número; só views e impressões, e só quando há posição para levar. */
  href: string | null
  /** O texto só para leitor de tela (a régua visual é `aria-hidden`). */
  sr: string
}

export interface ReguasView {
  frase: string
  linhas: LinhaRegua[]
  /** A base e a janela das impressões ("Entre 4 vídeos com impressões medidas de 09/09 a 07/10."); null = alcance não lido ou sem impressão em vídeo nenhum. */
  base: string | null
  /** O aviso de pouco volume (abaixo de `POUCO_VOLUME` impressões no RELATÓRIO do canal, que pode incluir vídeos fora dos guardados); null = não se aplica. */
  pouco: string | null
}

/**
 * As duas linhas que nascem do diário (A4 13.4): "Views por dia" e "% assistido". Vêm em `EntradaReguas.diario`; sem ele a régua tem as seis
 * linhas da Tarefa 12. As chaves dos mapas são os `id` dos vídeos de `videos`.
 */
export interface DiarioReguas {
  /** views por dia (média dos 28 dias) de cada vídeo; null = sem 7 dias de medida */
  vpd: ReadonlyMap<string, number | null>
  /** % assistido (pontos, pode passar de 100) de cada vídeo; null = sem views nos 28 dias */
  pct: ReadonlyMap<string, number | null>
  /** Por que ESTE vídeo não pode ser posicionado em views por dia (poucas views); o valor continua escrito. null = pode. */
  naoPosicionaVpd: string | null
  /** Idem para o % assistido. */
  naoPosicionaPct: string | null
  /** A frase de quando ESTE vídeo não tem o número ("sem 7 dias de medida"). */
  semVpd: string
  /** Idem ("sem views nos 28 dias"). */
  semPct: string
}

/** A palavra curta do vídeo com menos de DIAS_DE_VIDA_MIN dias de vida (pastilha da coluna) e a frase que a explica: as mesmas no cartão, na lista e na régua. */
export const PALAVRA_VIDEO_NOVO = 'vídeo novo'
export const FRASE_VIDEO_NOVO = 'vídeo novo: o alcance chega com 2 a 3 dias de atraso'

export interface EntradaReguas {
  videoId: string
  videos: ReadonlyArray<{ id: string; ytId: string; views: number | null; likes: number | null; comments: number | null; dur: number | null; titulo?: string }>
  porVideo: Map<string, AlcanceVideo>
  /** false = o alcance não foi lido (sem permissão, leitura que falhou, sem relatório): nenhuma impressão é "0", todas são "não medidas". */
  alcanceLido: boolean
  /**
   * Quantos dias do período foram MEDIDOS (relatório lido) e quantos ficaram sem relatório. Decide se o vídeo ausente do relatório é ZERO MEDIDO
   * (`medidos > 0`: houve dia medido e ele não apareceu) ou se ainda não dá para dizer (`medidos === 0`: nenhum dia foi medido). Alcance não lido: 0 e 0.
   */
  dias: { medidos: number; semRelatorio: number }
  /**
   * Os mesmos dois números, mas SÓ dos dias que valem para o vídeo `id` (a partir da publicação dele; D e D-1 sem linha não são zero medido). O dia
   * anterior à publicação não existe para o vídeo: não entra nem em `medidos` nem em `semRelatorio`. Ausente = `dias` (os do canal) vale para todos;
   * a tela do vídeo SEMPRE o passa.
   */
  diasDe?: (id: string) => { medidos: number; semRelatorio: number; novo?: boolean }
  /** "de 09/09 a 07/10", como a tela o escreve; null = sem período. */
  periodoTexto: string | null
  /** Por que as impressões não foram lidas ("só quem edita o site vê as impressões"); sem ele, a frase é a de "impressões não medidas". Só vale com `alcanceLido: false`. */
  motivoImpressoes?: string
  /** As linhas "Views por dia" e "% assistido"; ausente = a régua tem só as seis linhas. */
  diario?: DiarioReguas
  hrefs: { vistos: string; imp: string }
  /** Para onde Enter e o segundo toque num traço levam (preserva o `back=` da página); sem ele os traços não abrem nada. */
  hrefVideo?: (id: string) => string
  /** Os formatadores do motor (`obs.fmt`); sem eles, os mesmos da fábrica (o texto é igual). */
  fmt?: Fmt
}

/* ---------------------------------------------------------------- definição das seis linhas */

interface Def { numero: NumeroRegua; grupo: LinhaRegua['grupo']; nome: string; sub?: string }

/** A ordem do spec 17.3: Alcance, Resposta, Formato. */
const DEFS: readonly Def[] = [
  { numero: 'impressoes', grupo: 'Alcance', nome: 'Impressões' },
  { numero: 'views', grupo: 'Alcance', nome: 'Views' },
  { numero: 'vpd', grupo: 'Alcance', nome: 'Views por dia', sub: 'média dos últimos 28 dias' },
  { numero: 'engajamento', grupo: 'Resposta', nome: 'Engajamento' },
  { numero: 'assistido', grupo: 'Resposta', nome: '% assistido', sub: 'média pelas views, 28 dias' },
  { numero: 'curtidas', grupo: 'Resposta', nome: 'Curtidas' },
  { numero: 'comentarios', grupo: 'Resposta', nome: 'Comentários' },
  { numero: 'duracao', grupo: 'Formato', nome: 'Duração' },
]

/** As duas linhas do diário: ficam fora das frases de "poucos vídeos" e "sem medida" (a linha diz o seu motivo). */
const DO_DIARIO: readonly NumeroRegua[] = ['vpd', 'assistido']

const FALA_TERCO: Record<Terco, string> = { cima: 'terço de cima', meio: 'terço do meio', baixo: 'terço de baixo' }
const FORMA_TERCO: Record<Terco, string> = { cima: '▲', meio: '●', baixo: '▼' }

const mediana = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** "a", "a e b", "a, b e c". */
const lista = (xs: readonly string[]): string => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

/** O mesmo valor escrito abre 2,6 px para o lado (nas pontas, só para dentro); o traço deste vídeo fica no valor exato e empurra os outros 4,4 px. */
const PASSO_EMPATE = 2.6
const PASSO_COM_ESTE = 4.4
function abrirEmpates(tracos: TracoRegua[]): TracoRegua[] {
  const grupos = new Map<string, number[]>()
  tracos.forEach((t, i) => { const g = grupos.get(t.texto); if (g) g.push(i); else grupos.set(t.texto, [i]) })
  const out = tracos.map(t => ({ ...t }))
  const ultimo = tracos.length - 1
  for (const idx of grupos.values()) {
    if (idx.length < 2) continue
    const meu = idx.filter(i => out[i]!.este), outros = idx.filter(i => !out[i]!.este)
    const naPonta = idx.length === tracos.length ? 0 : idx.includes(0) ? 1 : idx.includes(ultimo) ? -1 : 0
    let base = PASSO_COM_ESTE, resto = outros
    if (meu.length === 0) { resto = outros.slice(1); base = PASSO_EMPATE }
    let lado = 1
    resto.forEach((i, j) => {
      out[i]!.dx = naPonta !== 0 ? naPonta * (base + j * PASSO_EMPATE) : lado * (base + Math.floor(j / 2) * PASSO_EMPATE)
      lado = -lado
    })
  }
  return out
}

const FMT_PADRAO = createFmt(createClock(0, 0, 0))

/** A frase do vídeo ausente de relatório MEDIDO: zero medido, com os dias medidos, os dias sem relatório e a base de comparação. */
function fraseZeroImpressao(d: EntradaReguas['dias'], nCom: number): string {
  const onde = d.medidos === 1 ? 'em 1 dia medido' : `nos ${d.medidos} dias medidos`
  const sem = d.semRelatorio > 0 ? ` (${d.semRelatorio === 1 ? '1 dia' : `${d.semRelatorio} dias`} sem dado)` : ''
  const base = nCom > 0 ? ` ${nCom === 1 ? 'O 1 vídeo com impressão fica acima dele.' : `Os ${nCom} vídeos com impressão ficam acima dele.`}` : ''
  return `Nenhuma impressão ${onde}${sem}.${base}`
}

export function buildReguas(a: EntradaReguas): ReguasView {
  const F = a.fmt ?? FMT_PADRAO
  const este = a.videos.find(v => v.id === a.videoId)
  if (!este) throw new Error(`réguas: o vídeo ${a.videoId} não está entre os vídeos do canal`)
  const diasDe = (id: string): { medidos: number; semRelatorio: number; novo?: boolean } => a.diasDe ? a.diasDe(id) : a.dias

  /* o valor cru de cada número, vídeo a vídeo: null = o vídeo não tem o dado */
  const engajamentoDe = (v: EntradaReguas['videos'][number]): number | null => {
    const vi = num(v.views), li = num(v.likes), co = num(v.comments)
    return vi != null && li != null && co != null && vi > 0 ? (li + co) / vi : null
  }
  const cru = (numero: NumeroRegua, v: EntradaReguas['videos'][number]): number | null => {
    switch (numero) {
      case 'impressoes': return a.alcanceLido ? num(a.porVideo.get(v.ytId)?.imp ?? null) : null
      case 'views': return num(v.views)
      case 'vpd': return num(a.diario?.vpd.get(v.id) ?? null)
      case 'assistido': return num(a.diario?.pct.get(v.id) ?? null)
      case 'engajamento': return engajamentoDe(v)
      case 'curtidas': return num(v.likes)
      case 'comentarios': return num(v.comments)
      case 'duracao': return num(v.dur)
      default: { const nunca: never = numero; return nunca }
    }
  }
  /** O número como a faixa do vídeo e o cartão o escrevem. */
  const texto = (numero: NumeroRegua, x: number): string => {
    switch (numero) {
      case 'impressoes': return F.num(x)
      case 'views': case 'curtidas': case 'comentarios': return numNb(F, x)
      case 'vpd': return x === 0 ? '0' : x < 10 ? F.dec1(x) : F.int(x)
      case 'assistido': return F.int(x) + '%'
      case 'engajamento': return F.dec1(x * 100) + '%'
      case 'duracao': return durText(x) ?? ''
      default: { const nunca: never = numero; return nunca }
    }
  }
  /** O valor com a unidade, para o leitor de tela. */
  const fala = (numero: NumeroRegua, x: number, t: string): string => {
    switch (numero) {
      case 'impressoes': return `${t} ${x === 1 ? 'impressão' : 'impressões'}`
      case 'views': return `${t} ${x === 1 ? 'view' : 'views'}`
      case 'vpd': return `${t} ${x === 1 ? 'view' : 'views'} por dia`
      case 'assistido': return `${t} do vídeo assistido`
      case 'engajamento': return `engajamento de ${t}`
      case 'curtidas': return `${t} ${x === 1 ? 'curtida' : 'curtidas'}`
      case 'comentarios': return `${t} ${x === 1 ? 'comentário' : 'comentários'}`
      case 'duracao': return `duração de ${t}`
      default: { const nunca: never = numero; return nunca }
    }
  }
  /** Por que ESTE vídeo não tem o dado. */
  const semODado = (numero: NumeroRegua): string => {
    switch (numero) {
      case 'impressoes': return !a.alcanceLido ? a.motivoImpressoes ?? 'impressões não medidas' : diasDe(este.id).novo ? FRASE_VIDEO_NOVO : diasDe(este.id).medidos === 0 ? 'ainda não há dia de alcance medido' : fraseZeroImpressao(diasDe(este.id), nImpressao)
      case 'views': return 'sem contagem de views'
      case 'vpd': return a.diario?.semVpd ?? 'não medido'
      case 'assistido': return a.diario?.semPct ?? 'não medido'
      case 'engajamento':
        if (num(este.views) == null) return 'sem contagem de views'
        if (num(este.likes) == null || num(este.comments) == null) return 'não medido'
        return 'sem views para calcular'
      case 'curtidas': case 'comentarios': return 'não medido'
      case 'duracao': return 'sem duração'
      default: { const nunca: never = numero; return nunca }
    }
  }

  /** Quantos vídeos têm impressão medida: a base da posição ("5º de 5 com impressão") e da frase do vídeo sem impressão. */
  const nImpressao = a.videos.filter(v => cru('impressoes', v) != null).length
  /** Impressões com dia medido: o vídeo ausente do relatório é ZERO MEDIDO. Sem dia medido (nada lido) ou sem alcance, é "não medido". */
  const zeroPossivel = (id: string): boolean => a.alcanceLido && diasDe(id).medidos > 0

  const titulos = new Map(a.videos.map(v => [v.id, v.titulo] as const))
  const defs = DEFS.filter(d => !DO_DIARIO.includes(d.numero) || a.diario != null)
  const linhas: LinhaRegua[] = defs.map((d): LinhaRegua => {
    const entradas = a.videos.map(v => {
      const x = cru(d.numero, v)
      return { id: v.id, x, chave: x == null ? undefined : texto(d.numero, x) }
    })
    const com = entradas.filter((e): e is { id: string; x: number; chave: string } => e.x != null)
    const eu = com.find(e => e.id === este.id) ?? null
    const n = com.length
    const semMedidaN = a.videos.length - n
    const impZero = d.numero === 'impressoes' && zeroPossivel(este.id)
    // quem não tem impressão e teve dia medido desde a publicação é zero medido; quem ainda não teve nenhum dia que valha (recém-publicado) é "sem medida"
    const semImp = d.numero === 'impressoes' ? a.videos.filter(v => cru('impressoes', v) == null) : []
    const nZero = semImp.filter(v => zeroPossivel(v.id)).length
    const semMedida = d.numero === 'impressoes'
      ? (a.alcanceLido && semImp.length > 0 ? [nZero > 0 ? `${nZero} sem impressão no período` : null, semImp.length - nZero > 0 ? `${semImp.length - nZero} sem medida` : null].filter(x => x != null).join(', ') : null)
      : semMedidaN > 0 ? `${semMedidaN} sem medida` : null
    const neutro = d.numero === 'duracao'
    const nomeBaixo = d.nome.toLowerCase()
    const zeroMedido = impZero && eu == null
    const valor = eu ? eu.chave : zeroMedido ? '0' : null
    // poucas views neste vídeo: o número fica escrito e a posição não (o diário de um vídeo quase sem view não ordena nada)
    const trava = eu == null ? null : d.numero === 'vpd' ? a.diario?.naoPosicionaVpd ?? null : d.numero === 'assistido' ? a.diario?.naoPosicionaPct ?? null : null
    const pos = eu && !trava ? posicaoNoCanal(entradas, este.id) : null
    const href = pos == null ? null : d.numero === 'impressoes' ? a.hrefs.imp : d.numero === 'views' ? a.hrefs.vistos : null
    const semRegua = eu == null ? semODado(d.numero) : trava ? trava : pos == null ? `poucos vídeos para comparar (${n})` : null
    const vazia = { tracos: [] as LinhaRegua['tracos'], min: null, max: null, medianaPct: null, comprimida: false }

    if (!eu || !pos) {
      const sr = eu ? `${nomeBaixo}: ${fala(d.numero, eu.x, eu.chave)}; ${semRegua}` : zeroMedido ? `${nomeBaixo}: zero medido; ${semRegua}` : `${nomeBaixo}: ${semRegua}`
      return { numero: d.numero, grupo: d.grupo, nome: d.nome, sub: d.sub ?? null, valor, zeroMedido, pos: null, posTexto: null, semRegua, semMedida, ...vazia, neutro, href, sr }
    }

    const xs = com.map(e => e.x)
    const es = escalar(xs)
    const ordenados = [...com].sort((p, q) => p.x - q.x || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))
    const tracos = abrirEmpates(ordenados.map(e => ({
      id: e.id, pct: es.pct(e.x), este: e.id === este.id, texto: e.chave, dx: 0,
      titulo: titulos.get(e.id) ?? e.id, href: a.hrefVideo ? a.hrefVideo(e.id) : null,
    })))
    const med = mediana(xs)
    const min = texto(d.numero, es.min), max = texto(d.numero, es.max)
    // a base da posição em impressões é o vídeo COM impressão: os que não aparecem no relatório são zero medido e ficam fora da régua
    const baseTxt = d.numero === 'impressoes' ? ' com impressão' : ''
    const posTexto = `${pos.pos}º de ${pos.de}${baseTxt}` + (pos.empates > 0 ? ` · empate com ${pos.empates}` : '')
    const sr = `${pos.pos}º de ${pos.de}${baseTxt} em ${nomeBaixo}` + (neutro ? '' : `, ${FALA_TERCO[pos.terco]}`) + (pos.empates > 0 ? `, empate com ${pos.empates}` : '')
      + `; ${fala(d.numero, eu.x, eu.chave)}; no canal de ${min} a ${max}; mediana ${texto(d.numero, med)}`
    return {
      numero: d.numero, grupo: d.grupo, nome: d.nome, sub: d.sub ?? null, valor, zeroMedido: false, pos, posTexto, semRegua, semMedida,
      tracos, min, max, medianaPct: es.pct(med), comprimida: es.comprimida, neutro, href, sr,
    }
  })

  /* o volume de impressões do RELATÓRIO no período (a soma do que foi lido, inclusive de vídeos que não estão entre os guardados do canal) */
  let total = 0, fora = 0
  const guardados = new Set(a.videos.map(v => v.ytId))
  if (a.alcanceLido) for (const [yt, r] of a.porVideo) { total += r.imp; if (!guardados.has(yt)) fora++ }
  const poucoVolume = a.alcanceLido && total > 0 && total < POUCO_VOLUME
  const periodo = a.periodoTexto ?? 'no período'
  const nImp = nImpressao
  const base = a.alcanceLido && nImp > 0
    ? (nImp === 1 ? `Só 1 vídeo tem impressões medidas ${periodo}.` : `Entre ${nImp} vídeos com impressões medidas ${periodo}.`)
    : null
  const pouco = poucoVolume
    ? `${F.int(total)} ${total === 1 ? 'impressão' : 'impressões'} no relatório ${periodo}. ${fora > 0 ? `${foraDosGuardadosFrase(fora, F.int)} ` : ''}Com tão poucas, a posição em impressões muda de um dia para o outro.`
    : null

  return { frase: fraseDe(linhas, a.alcanceLido, poucoVolume), linhas, base, pouco }
}

/* ---------------------------------------------------------------- a frase */

function fraseDe(linhas: readonly LinhaRegua[], alcanceLido: boolean, poucoVolume: boolean): string {
  const partes: string[] = []
  const imp = linhas[0]!
  // sem impressão neste vídeo (alcance lido): a frase abre com isso; alcance não lido, a frase nem fala de impressões
  if (imp.zeroMedido) partes.push('Sem impressão no período.')

  const alvo = linhas.filter(l => !l.neutro)
  const nomes = (ls: readonly LinhaRegua[]) => lista(ls.map(l => l.nome.toLowerCase()))
  const comPos = alvo.filter((l): l is LinhaRegua & { pos: PosVideo } => l.pos != null)

  // o primeiro em impressões com pouco volume diz o volume, sozinho (o "poucas" é só das impressões)
  const impPouca = poucoVolume && imp.pos?.pos === 1 ? imp : null
  if (impPouca?.pos) partes.push(`${FORMA_TERCO[impPouca.pos.terco]} ${impPouca.pos.empates === 0 ? 'Primeiro do canal' : 'Empatado em primeiro do canal'} em impressões, mas com poucas.`)

  const grupo = (t: Terco) => comPos.filter(l => l.pos.terco === t && l !== impPouca)
  const cima = grupo('cima'), meio = grupo('meio'), baixo = grupo('baixo')
  const primeiros = cima.filter(l => l.pos.pos === 1 && l.pos.empates === 0)
  const ultimos = baixo.filter(l => l.pos.pos === l.pos.de && l.pos.empates === 0)
  const sai = (ls: readonly LinhaRegua[], f: (n: string) => string) => { if (ls.length) partes.push(f(nomes(ls))) }
  sai(primeiros, n => `▲ Primeiro do canal em ${n}.`)
  sai(cima.filter(l => !primeiros.includes(l)), n => `▲ Entre os primeiros em ${n}.`)
  sai(meio, n => `● No meio em ${n}.`)
  // em impressões a base é só o vídeo COM impressão (os outros são zero e ficam fora da régua): "o menor do canal" afirmaria demais
  const ultimoImp = ultimos.find(l => l.numero === 'impressoes')
  sai(ultimos.filter(l => l !== ultimoImp), n => `▼ O menor do canal em ${n}.`)
  if (ultimoImp) partes.push(`▼ O que menos teve impressões entre os ${ultimoImp.pos.de} vídeos com impressão.`)
  sai(baixo.filter(l => !ultimos.includes(l)), n => `▼ Entre os últimos em ${n}.`)

  // com o dado e sem comparação (menos de MIN_REGUA vídeos): dito, sem forma de terço
  const poucos = alvo.filter(l => l.valor != null && l.pos == null && (l.numero !== 'impressoes' || alcanceLido) && !DO_DIARIO.includes(l.numero))
  sai(poucos, n => `Poucos vídeos para comparar em ${n}.`)
  // sem o dado neste vídeo (impressões já têm a sua frase)
  const sem = alvo.filter(l => l.valor == null && l.numero !== 'impressoes' && !DO_DIARIO.includes(l.numero))
  sai(sem, n => `Sem medida neste vídeo: ${n}.`)

  return partes.length ? partes.join(' ') : 'Nada para comparar este vídeo com o resto do canal.'
}
