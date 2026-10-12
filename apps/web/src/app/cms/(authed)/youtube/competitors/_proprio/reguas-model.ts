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

export type NumeroRegua = 'impressoes' | 'views' | 'engajamento' | 'curtidas' | 'comentarios' | 'duracao'

export interface LinhaRegua {
  numero: NumeroRegua
  grupo: 'Alcance' | 'Resposta' | 'Formato'
  nome: string
  /** O valor deste vídeo como a tela o escreve; null = este vídeo não tem o dado (a causa está em `semRegua`). Nunca "0" no lugar de nulo. */
  valor: string | null
  pos: PosVideo | null
  /** "18º de 35 · empate com 2". null = sem posição. */
  posTexto: string | null
  /** A frase que ocupa o lugar da régua: sem o dado neste vídeo, ou poucos vídeos para comparar. null = há régua. */
  semRegua: string | null
  /** Quantos vídeos do canal ficam fora da conta por não terem o dado: "2 sem medida". null = nenhum (ou a leitura nem existe). */
  semMedida: string | null
  /** Um traço por vídeo com o dado, do menor ao maior valor. Vazio quando não há régua. */
  tracos: Array<{ id: string; pct: number; este: boolean }>
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

export interface EntradaReguas {
  videoId: string
  videos: ReadonlyArray<{ id: string; ytId: string; views: number | null; likes: number | null; comments: number | null; dur: number | null }>
  porVideo: Map<string, AlcanceVideo>
  /** false = o alcance não foi lido (sem permissão, leitura que falhou, sem relatório): nenhuma impressão é "0", todas são "não medidas". */
  alcanceLido: boolean
  /** "de 09/09 a 07/10", como a tela o escreve; null = sem período. */
  periodoTexto: string | null
  hrefs: { vistos: string; imp: string }
  /** Os formatadores do motor (`obs.fmt`); sem eles, os mesmos da fábrica (o texto é igual). */
  fmt?: Fmt
}

/* ---------------------------------------------------------------- definição das seis linhas */

interface Def { numero: NumeroRegua; grupo: LinhaRegua['grupo']; nome: string }

/** A ordem do spec 17.3: Alcance, Resposta, Formato. */
const DEFS: readonly Def[] = [
  { numero: 'impressoes', grupo: 'Alcance', nome: 'Impressões' },
  { numero: 'views', grupo: 'Alcance', nome: 'Views' },
  { numero: 'engajamento', grupo: 'Resposta', nome: 'Engajamento' },
  { numero: 'curtidas', grupo: 'Resposta', nome: 'Curtidas' },
  { numero: 'comentarios', grupo: 'Resposta', nome: 'Comentários' },
  { numero: 'duracao', grupo: 'Formato', nome: 'Duração' },
]

const FALA_TERCO: Record<Terco, string> = { cima: 'terço de cima', meio: 'terço do meio', baixo: 'terço de baixo' }
const FORMA_TERCO: Record<Terco, string> = { cima: '▲', meio: '●', baixo: '▼' }

const mediana = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** "a", "a e b", "a, b e c". */
const lista = (xs: readonly string[]): string => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

const FMT_PADRAO = createFmt(createClock(0, 0, 0))

export function buildReguas(a: EntradaReguas): ReguasView {
  const F = a.fmt ?? FMT_PADRAO
  const este = a.videos.find(v => v.id === a.videoId)
  if (!este) throw new Error(`réguas: o vídeo ${a.videoId} não está entre os vídeos do canal`)

  /* o valor cru de cada número, vídeo a vídeo: null = o vídeo não tem o dado */
  const engajamentoDe = (v: EntradaReguas['videos'][number]): number | null => {
    const vi = num(v.views), li = num(v.likes), co = num(v.comments)
    return vi != null && li != null && co != null && vi > 0 ? (li + co) / vi : null
  }
  const cru = (numero: NumeroRegua, v: EntradaReguas['videos'][number]): number | null => {
    switch (numero) {
      case 'impressoes': return a.alcanceLido ? num(a.porVideo.get(v.ytId)?.imp ?? null) : null
      case 'views': return num(v.views)
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
      case 'impressoes': return !a.alcanceLido ? 'impressões não medidas' : a.periodoTexto ? `sem impressão ${a.periodoTexto}` : 'sem impressão no período'
      case 'views': return 'sem contagem de views'
      case 'engajamento':
        if (num(este.views) == null) return 'sem contagem de views'
        if (num(este.likes) == null || num(este.comments) == null) return 'não medido'
        return 'sem views para calcular'
      case 'curtidas': case 'comentarios': return 'não medido'
      case 'duracao': return 'sem duração'
      default: { const nunca: never = numero; return nunca }
    }
  }

  const linhas: LinhaRegua[] = DEFS.map((d): LinhaRegua => {
    const entradas = a.videos.map(v => {
      const x = cru(d.numero, v)
      return { id: v.id, x, chave: x == null ? undefined : texto(d.numero, x) }
    })
    const com = entradas.filter((e): e is { id: string; x: number; chave: string } => e.x != null)
    const eu = com.find(e => e.id === este.id) ?? null
    const n = com.length
    const semMedidaN = a.videos.length - n
    const semMedida = semMedidaN > 0 && !(d.numero === 'impressoes' && !a.alcanceLido) ? `${semMedidaN} sem medida` : null
    const neutro = d.numero === 'duracao'
    const nomeBaixo = d.nome.toLowerCase()
    const valor = eu ? eu.chave : null
    const pos = eu ? posicaoNoCanal(entradas, este.id) : null
    const href = pos == null ? null : d.numero === 'impressoes' ? a.hrefs.imp : d.numero === 'views' ? a.hrefs.vistos : null
    const semRegua = eu == null ? semODado(d.numero) : pos == null ? `poucos vídeos para comparar (${n})` : null
    const vazia = { tracos: [] as LinhaRegua['tracos'], min: null, max: null, medianaPct: null, comprimida: false }

    if (!eu || !pos) {
      const sr = eu ? `${nomeBaixo}: ${fala(d.numero, eu.x, eu.chave)}; ${semRegua}` : `${nomeBaixo}: ${semRegua}`
      return { numero: d.numero, grupo: d.grupo, nome: d.nome, valor, pos: null, posTexto: null, semRegua, semMedida, ...vazia, neutro, href, sr }
    }

    const xs = com.map(e => e.x)
    const es = escalar(xs)
    const ordenados = [...com].sort((p, q) => p.x - q.x || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))
    const tracos = ordenados.map(e => ({ id: e.id, pct: es.pct(e.x), este: e.id === este.id }))
    const med = mediana(xs)
    const min = texto(d.numero, es.min), max = texto(d.numero, es.max)
    const posTexto = `${pos.pos}º de ${pos.de}` + (pos.empates > 0 ? ` · empate com ${pos.empates}` : '')
    const sr = `${pos.pos}º de ${pos.de} em ${nomeBaixo}` + (neutro ? '' : `, ${FALA_TERCO[pos.terco]}`) + (pos.empates > 0 ? `, empate com ${pos.empates}` : '')
      + `; ${fala(d.numero, eu.x, eu.chave)}; no canal de ${min} a ${max}; mediana ${texto(d.numero, med)}`
    return {
      numero: d.numero, grupo: d.grupo, nome: d.nome, valor, pos, posTexto, semRegua, semMedida,
      tracos, min, max, medianaPct: es.pct(med), comprimida: es.comprimida, neutro, href, sr,
    }
  })

  /* o volume de impressões do RELATÓRIO no período (a soma do que foi lido, inclusive de vídeos que não estão entre os guardados do canal) */
  let total = 0, fora = 0
  const guardados = new Set(a.videos.map(v => v.ytId))
  if (a.alcanceLido) for (const [yt, r] of a.porVideo) { total += r.imp; if (!guardados.has(yt)) fora++ }
  const poucoVolume = a.alcanceLido && total > 0 && total < POUCO_VOLUME
  const periodo = a.periodoTexto ?? 'no período'
  const nImp = linhas[0]!.pos ? linhas[0]!.pos.de : a.videos.filter(v => cru('impressoes', v) != null).length
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
  if (alcanceLido && imp.valor == null) partes.push('Sem impressão no período.')

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
  sai(ultimos, n => `▼ O menor do canal em ${n}.`)
  sai(baixo.filter(l => !ultimos.includes(l)), n => `▼ Entre os últimos em ${n}.`)

  // com o dado e sem comparação (menos de MIN_REGUA vídeos): dito, sem forma de terço
  const poucos = alvo.filter(l => l.valor != null && l.pos == null && (l.numero !== 'impressoes' || alcanceLido))
  sai(poucos, n => `Poucos vídeos para comparar em ${n}.`)
  // sem o dado neste vídeo (impressões já têm a sua frase)
  const sem = alvo.filter(l => l.valor == null && l.numero !== 'impressoes')
  sai(sem, n => `Sem medida neste vídeo: ${n}.`)

  return partes.length ? partes.join(' ') : 'Nada para comparar este vídeo com o resto do canal.'
}
