// A5 · E17 degrau 1, Tarefa 4: do pacote segmentado (partes 1 a 6) ao texto final (partes 1 a 9), com o corte por tamanho.
//
// A função é pura: não lê relógio, banco nem rede. O corte decide por SOMA de tamanhos (cada segmento é medido uma vez por pacote),
// e o texto e o JSON do bloco estruturado são montados uma vez, depois de decidido. A pergunta entra no total e nunca é cortada.
//
// Ordem do corte, do que menos pesa na leitura ao que mais pesa: (1) as tabelas de dia a dia; (2) as linhas de cada lista, em degraus
// (25, 10, 5, 3, 1, 0), levando junto os textos citados ligados a elas; (3) os textos citados sem linha, do último ao primeiro.
// Definições, avisos, "como ler" e foco nunca saem; se nem assim couber, `pisoPassou` fica verdadeiro e o texto diz o tamanho real.
import { CONTEXTO_IA_RULES } from './regras'
import * as F from './frases'
import type { PacoteSerializado, Segmento } from './segmentar'
import { naCelula, noJson } from './terceiros'

export interface TextoMontado {
  texto: string
  caracteres: number
  /** O tamanho do texto inteiro, sem corte (com a linha "Por tamanho: nada"). */
  totalSemCorte: number
  cabe: boolean
  /** No máximo dois itens, na ordem do corte; a soma é o que o texto deixou de levar. */
  cortes: Array<{ rotulo: string; caracteres: number }>
  degrau: number | null
  pisoPassou: boolean
}

export interface ResumoDoDialogo {
  copia: TextoMontado
  completo: TextoMontado
  /** O que nem o arquivo completo leva. */
  naoSaem: number
  /** O que só o arquivo completo leva. */
  soNoArquivo: number
  /** Fatias do texto da cópia: `inicio + dobra1 + fim7e8 + dobra2 + fim9` somam `copia.caracteres`. */
  previa: { inicio: string; dobra1: number; fim7e8: string; dobra2: number; fim9: string }
}

type ModoDiaADia = 'todos' | 'um_por_vez'

interface Passo { dias: ReadonlySet<string>; grau: number | null; blocos: number }

interface Item { seg: Segmento; texto: number; json: number }

/** O que se mede uma vez por pacote. */
interface Medido {
  itens: Item[]
  /** Ids das tabelas de dia a dia que têm segmento, na ordem do pacote. */
  diaTabelas: string[]
  totalBlocos: number
  /** Tamanho do JSON do bloco estruturado sem nenhuma medida (`"medidas": []`). */
  jsonVazio: number
}

const TITULO_8 = `${F.ESTRUTURADO_TITULO}\n`

// Texto novo (o mockup não mostra o piso): a linha "Por tamanho" quando nem cortando tudo o que pode sair o pacote cabe. Diz o tamanho real.
const porTamanhoPisoSemCorte = (total: number, limite: number): string =>
  `- Por tamanho: o pacote tem ${F.milhar(total)} caracteres, acima do limite de ${F.milhar(limite)}, e não há nada que possa sair sem tirar definições ou avisos.`
const porTamanhoPiso = (total: number, limite: number, cortados: number, itens: string): string =>
  `- Por tamanho: o pacote tem ${F.milhar(total)} caracteres, acima do limite de ${F.milhar(limite)}, mesmo depois de cortar ${F.milhar(cortados)}: ${itens}. Definições e avisos não saem.`
const medidosDoPacote = new WeakMap<PacoteSerializado, Medido>()

/** Tamanho que `noJson` dá a um texto JSON: cada crase e cada separador de linha (inclusive U+0085) virou escape de seis caracteres. */
const tamanhoNoJson = (s: string): number => s.length + 5 * (s.match(/[`\u0085\u2028\u2029]/g)?.length ?? 0)

function cabecalhoDoJson(p: PacoteSerializado, medidas: unknown[]) {
  return { tela: p.tela, formato: CONTEXTO_IA_RULES.versaoDoFormato, gerado: p.geradoEm, janela: p.janela, medidas }
}

export function medir(p: PacoteSerializado): Medido {
  const guardado = medidosDoPacote.get(p)
  if (guardado) return guardado
  const itens: Item[] = p.segmentos.map((seg) => {
    let json = 0
    if (seg.linhaDoJson) {
      const s = JSON.stringify(seg.linhaDoJson, null, 2)
      json = tamanhoNoJson(s) + 4 * s.split('\n').length + 2 // recuo de quatro espaços, mais a vírgula e a quebra que separam as entradas
    }
    return { seg, texto: seg.texto.length, json }
  })
  const diaTabelas: string[] = []
  let totalBlocos = 0
  for (const { seg } of itens) {
    if (seg.corte?.classe === 'dia_a_dia' && !diaTabelas.includes(seg.corte.tabela)) diaTabelas.push(seg.corte.tabela)
    if (seg.corte?.classe === 'bloco_sem_linha') totalBlocos += 1
  }
  const medido: Medido = { itens, diaTabelas, totalBlocos, jsonVazio: tamanhoNoJson(JSON.stringify(cabecalhoDoJson(p, []), null, 2)) }
  medidosDoPacote.set(p, medido)
  return medido
}

const mantido = (seg: Segmento, passo: Passo, totalBlocos: number): boolean => {
  const c = seg.corte
  if (c === null) return true
  if (c.classe === 'dia_a_dia') return !passo.dias.has(c.tabela)
  if (c.classe === 'linha_de_lista') return passo.grau === null || c.posicao <= passo.grau
  return c.ordem <= totalBlocos - passo.blocos
}

// ───────────────────────── rótulos do corte (a linha "Por tamanho" e o diálogo dizem a mesma coisa)
function rotuloDoDiaADia(p: PacoteSerializado, cortadas: readonly string[], totalDeTabelas: number): string {
  const nomes = [...new Set(cortadas.map((id) => p.tabelas.find((t) => t.id === id)?.nomeNoCorte ?? ''))]
  const k = cortadas.length
  const nome = nomes.length === 1 && nomes[0] ? nomes[0] : 'tabelas'
  if (k === 1 && totalDeTabelas === 1) return `dia a dia de ${nome}`
  if (k < totalDeTabelas) return `dia a dia de ${k} de ${totalDeTabelas} ${nome}`
  return k === 1 ? `dia a dia de ${nome}` : `dia a dia de ${k} ${nome}`
}

function rotuloDasLinhas(p: PacoteSerializado, listas: readonly string[], grau: number): string {
  if (listas.length === 1) {
    const nome = p.tabelas.find((t) => t.id === listas[0])?.nomeNoCorte ?? 'lista'
    return grau === 0 ? `todas as linhas da ${nome}` : `linhas além da ${grau}ª da ${nome}`
  }
  return grau === 0 ? `todas as linhas de ${listas.length} listas` : `linhas além da ${grau}ª de ${listas.length} listas`
}

const rotuloDosTextos = (k: number): string => (k === 1 ? '1 texto citado' : `${k} textos citados`)

// ───────────────────────── a conta de um passo
interface Soma {
  /** Tamanho de tudo menos a parte 7, já com as quebras entre as peças. */
  semParte7: number
  mantidos: Segmento[]
  dia: { tabelas: string[]; caracteres: number }
  linhas: { listas: string[]; caracteres: number }
  blocos: { quantos: number; caracteres: number }
}

function somar(p: PacoteSerializado, pergunta: string, passo: Passo): Soma {
  const m = medir(p)
  const mantidos: Segmento[] = []
  let texto = 0
  let json = 0
  let entradas = 0
  const dia = { tabelas: [] as string[], caracteres: 0 }
  const linhas = { listas: [] as string[], caracteres: 0 }
  const blocos = { quantos: 0, caracteres: 0 }
  for (const it of m.itens) {
    if (mantido(it.seg, passo, m.totalBlocos)) {
      mantidos.push(it.seg)
      texto += it.texto
      if (it.seg.linhaDoJson) { json += it.json; entradas += 1 }
      continue
    }
    const tirado = it.texto + 1 + it.json
    const c = it.seg.corte
    if (c?.classe === 'dia_a_dia') { if (!dia.tabelas.includes(c.tabela)) dia.tabelas.push(c.tabela); dia.caracteres += tirado }
    else if (c?.classe === 'linha_de_lista') { if (!linhas.listas.includes(c.tabela)) linhas.listas.push(c.tabela); linhas.caracteres += tirado }
    else { blocos.quantos += 1; blocos.caracteres += tirado }
  }
  const parte8 = TITULO_8.length + (entradas === 0 ? m.jsonVazio : m.jsonVazio + 2 + json) + 1
  const parte9 = `${F.PERGUNTA_TITULO}\n${F.PERGUNTA_ROTULO}\n${pergunta}`.length
  return { semParte7: texto + parte8 + parte9 + mantidos.length + 2, mantidos, dia, linhas, blocos }
}

function linhaDoPrivado(p: PacoteSerializado): string {
  const v = p.privado
  if (v.estado === 'na') return F.foraPrivadoNa
  const itens = naCelula(v.itens)
  if (v.estado === 'incluido') return F.foraPrivadoIncluido(itens)
  if (v.motivo === 'sem_direito') return F.foraPrivadoSemDireito(itens)
  return v.motivo === 'nao_conferido' ? F.foraPrivadoNaoConferido(itens) : F.foraPrivadoLeituraFalhou(itens)
}

function linhaDosComentarios(p: PacoteSerializado): string {
  const c = p.comentarios
  if (c.estado === 'na') return F.foraComentariosNa
  return c.estado === 'incluido' ? F.foraComentariosIncluido(c.quantos) : F.foraComentariosExcluido(c.quantos)
}

const parte7 = (p: PacoteSerializado, linhasDeTamanho: readonly string[]): string =>
  `${[F.FORA_TITULO, ...linhasDeTamanho, linhaDoPrivado(p), linhaDosComentarios(p), F.FORA_CHAVES].join('\n')}\n`

// ───────────────────────── o plano: qual passo, com que linha "Por tamanho"
interface Plano {
  passo: Passo
  mantidos: Segmento[]
  linhasDeTamanho: string[]
  caracteres: number
  totalSemCorte: number
  cortes: Array<{ rotulo: string; caracteres: number }>
  cabe: boolean
  pisoPassou: boolean
}

function cortarPergunta(pergunta: string): string {
  const max = CONTEXTO_IA_RULES.perguntaMax
  if (pergunta.length <= max) return pergunta
  const corte = pergunta.slice(0, max)
  const ultimo = corte.charCodeAt(max - 1)
  return ultimo >= 0xd800 && ultimo <= 0xdbff ? corte.slice(0, max - 1) : corte // não deixa meio par de substituição
}

/** Os passos do corte, do mais leve ao mais pesado. O primeiro é o texto inteiro. */
function passosDoCorte(p: PacoteSerializado, modo: ModoDiaADia): Passo[] {
  const m = medir(p)
  const vazio = new Set<string>()
  const passos: Passo[] = [{ dias: vazio, grau: null, blocos: 0 }]
  const todos = m.diaTabelas
  if (todos.length) {
    if (modo === 'todos') passos.push({ dias: new Set(todos), grau: null, blocos: 0 })
    else for (let k = 1; k <= todos.length; k += 1) passos.push({ dias: new Set(todos.slice(todos.length - k)), grau: null, blocos: 0 }) // da última para a primeira
  }
  const dias = todos.length ? new Set(todos) : vazio
  const posicoes = m.itens.flatMap((i) => (i.seg.corte?.classe === 'linha_de_lista' ? [i.seg.corte.posicao] : []))
  let anterior = Number.POSITIVE_INFINITY
  for (const grau of CONTEXTO_IA_RULES.degrausDeLinhas) {
    const sobra = posicoes.filter((x) => x > grau).length
    if (sobra === 0 || sobra === anterior) continue // nada de novo sairia neste degrau
    anterior = sobra
    passos.push({ dias, grau, blocos: 0 })
  }
  for (let b = 1; b <= m.totalBlocos; b += 1) passos.push({ dias, grau: posicoes.length ? 0 : null, blocos: b })
  return passos
}

function itensDoCorte(p: PacoteSerializado, passo: Passo, soma: Soma, liquido: number): Array<{ rotulo: string; caracteres: number }> {
  const m = medir(p)
  const rotulos: Array<{ rotulo: string; medido: number }> = []
  if (soma.dia.tabelas.length) rotulos.push({ rotulo: rotuloDoDiaADia(p, soma.dia.tabelas, m.diaTabelas.length), medido: soma.dia.caracteres })
  const lista = soma.linhas.listas.length ? rotuloDasLinhas(p, soma.linhas.listas, passo.grau ?? 0) : null
  const texto = soma.blocos.quantos ? rotuloDosTextos(soma.blocos.quantos) : null
  const junto = lista !== null && texto !== null ? `${lista} e ${texto}` : (lista ?? texto)
  if (junto !== null) rotulos.push({ rotulo: junto, medido: soma.linhas.caracteres + soma.blocos.caracteres })
  if (rotulos.length === 0) return []
  if (rotulos.length === 1) return [{ rotulo: rotulos[0]!.rotulo, caracteres: liquido }]
  const [a, b] = [rotulos[0]!, rotulos[1]!]
  let primeiro = a.medido
  let resto = liquido - primeiro // o último item é o resto, de modo que a soma fecha com o que o texto deixou de levar
  if (resto < 0) { resto = b.medido; primeiro = Math.max(0, liquido - resto) }
  return [{ rotulo: a.rotulo, caracteres: primeiro }, { rotulo: b.rotulo, caracteres: Math.max(0, liquido - primeiro) }]
}

function linhasDeTamanho(
  cortes: ReadonlyArray<{ rotulo: string; caracteres: number }>, liquido: number, completo: { caracteres: number; naoSaem: number },
  piso: { total: number; limite: number } | null,
): string[] {
  const itens = cortes.map((c, i) => `${i ? 'depois' : 'primeiro'} ${c.rotulo} (${F.milhar(c.caracteres)})`).join(', ')
  const primeira = piso ? (cortes.length ? porTamanhoPiso(piso.total, piso.limite, liquido, itens) : porTamanhoPisoSemCorte(piso.total, piso.limite)) : F.porTamanhoCortei(liquido, itens)
  return [primeira, completo.naoSaem > 0 ? F.completoLeva(completo.caracteres, completo.naoSaem) : F.COMPLETO_LEVA_TUDO]
}

/** Resolve o ponto fixo de "cortei {n}": o número está dentro do texto, e o texto muda de tamanho com o número. */
function resolver(
  p: PacoteSerializado, passo: Passo, soma: Soma, total: number,
  linhasPara: (cortes: Array<{ rotulo: string; caracteres: number }>, liquido: number) => string[],
): { linhas: string[]; caracteres: number; cortes: Array<{ rotulo: string; caracteres: number }> } {
  let liquido = 0
  let melhor: { linhas: string[]; caracteres: number; cortes: Array<{ rotulo: string; caracteres: number }> } | null = null
  for (let i = 0; i < 8; i += 1) {
    const cortes = itensDoCorte(p, passo, soma, liquido)
    const linhas = linhasPara(cortes, liquido)
    const caracteres = soma.semParte7 + parte7(p, linhas).length
    melhor = { linhas, caracteres, cortes }
    const novo = total - caracteres
    if (novo === liquido) return melhor
    liquido = novo
  }
  return melhor as NonNullable<typeof melhor> // oito voltas sem ponto fixo: fica a última (a diferença é de um caractere, na virada de dígitos)
}

/** Os planos de todos os passos, e o índice do primeiro que cabe (ou do último, se nenhum couber). */
interface Candidatos { planos: Plano[]; primeiro: number }
const candidatosGuardados = new WeakMap<PacoteSerializado, Map<string, Candidatos>>()

function candidatos(p: PacoteSerializado, perguntaBruta: string, limite: number, modo: ModoDiaADia): Candidatos {
  const pergunta = cortarPergunta(perguntaBruta)
  const chave = `${limite}|${modo}|${pergunta}`
  const doPacote = candidatosGuardados.get(p) ?? new Map<string, Candidatos>()
  candidatosGuardados.set(p, doPacote)
  const guardado = doPacote.get(chave)
  if (guardado) return guardado

  const passos = passosDoCorte(p, modo)
  // O tamanho do texto inteiro: o número dele está na linha "Por tamanho: nada", então também é um ponto fixo.
  const inteiro = somar(p, pergunta, passos[0]!)
  let total = inteiro.semParte7 + parte7(p, [F.porTamanhoNada(0, limite)]).length
  for (let i = 0; i < 8; i += 1) {
    const novo = inteiro.semParte7 + parte7(p, [F.porTamanhoNada(total, limite)]).length
    if (novo === total) break
    total = novo
  }
  const planos: Plano[] = [{
    passo: passos[0]!, mantidos: inteiro.mantidos, linhasDeTamanho: [F.porTamanhoNada(total, limite)], caracteres: total, totalSemCorte: total, cortes: [],
    cabe: total <= limite, pisoPassou: total > limite,
  }]
  if (total > limite) {
    const completo = limite === CONTEXTO_IA_RULES.limiteCompleto ? null : escolhida(candidatos(p, perguntaBruta, CONTEXTO_IA_RULES.limiteCompleto, 'um_por_vez'))
    const linhasPara = (piso: boolean) => (cortes: Array<{ rotulo: string; caracteres: number }>, liquido: number): string[] => {
      const marca = piso ? { total, limite } : null
      if (completo) return linhasDeTamanho(cortes, liquido, { caracteres: completo.caracteres, naoSaem: completo.cabe ? 0 : completo.totalSemCorte - completo.caracteres }, marca)
      // o próprio arquivo completo: o que ele leva é o que sobrou; o que não sai é o que ele cortou
      return linhasDeTamanho(cortes, liquido, { caracteres: total - liquido, naoSaem: liquido }, marca)
    }
    for (const passo of passos.slice(1)) {
      const soma = somar(p, pergunta, passo)
      const r = resolver(p, passo, soma, total, linhasPara(false))
      planos.push({ passo, mantidos: soma.mantidos, linhasDeTamanho: r.linhas, caracteres: r.caracteres, totalSemCorte: total, cortes: r.cortes, cabe: false, pisoPassou: r.caracteres > limite })
    }
    // Nenhum passo coube: o último é o piso, e a linha "Por tamanho" dele diz o tamanho real.
    if (planos.every((x) => x.caracteres > limite)) {
      const ultimo = planos[planos.length - 1]!
      if (planos.length === 1) {
        const linhas = linhasPara(true)([], 0)
        planos[0] = { ...ultimo, linhasDeTamanho: [linhas[0]!], caracteres: inteiro.semParte7 + parte7(p, [linhas[0]!]).length, cabe: false, pisoPassou: true }
      } else {
        const soma = somar(p, pergunta, ultimo.passo)
        const r = resolver(p, ultimo.passo, soma, total, linhasPara(true))
        planos[planos.length - 1] = { ...ultimo, linhasDeTamanho: r.linhas, caracteres: r.caracteres, cortes: r.cortes, pisoPassou: true }
      }
    }
  }
  const fit = planos.findIndex((x) => x.caracteres <= limite)
  const saida: Candidatos = { planos, primeiro: fit === -1 ? planos.length - 1 : fit }
  doPacote.set(chave, saida)
  return saida
}

const escolhida = (c: Candidatos): Plano => c.planos[c.primeiro]!

// ───────────────────────── montagem
const pecasDoTexto = new WeakMap<TextoMontado, { pecas: string[]; mantidos: Segmento[]; estimado: number }>()

function montarPlano(p: PacoteSerializado, pergunta: string, plano: Plano): { texto: string; pecas: string[] } {
  const entradas = plano.mantidos.flatMap((s) => (s.linhaDoJson ? [s.linhaDoJson] : []))
  const json = noJson(cabecalhoDoJson(p, entradas))
  const pecas = [
    ...plano.mantidos.map((s) => s.texto),
    parte7(p, plano.linhasDeTamanho),
    `${TITULO_8}${json}\n`,
    `${F.PERGUNTA_TITULO}\n${F.PERGUNTA_ROTULO}\n${pergunta}`,
  ]
  return { texto: pecas.join('\n'), pecas }
}

export function montarTexto(p: PacoteSerializado, perguntaBruta: string, limite: number, diaADia: ModoDiaADia): TextoMontado {
  const pergunta = cortarPergunta(perguntaBruta)
  const c = candidatos(p, perguntaBruta, limite, diaADia)
  // A conta é exata; a conferência final só existe para o dia em que alguém mude o formato de um segmento e esqueça a medida:
  // se o texto montado passar do limite, tenta o passo seguinte.
  let i = c.primeiro
  let plano = c.planos[i]!
  let montado = montarPlano(p, pergunta, plano)
  while (montado.texto.length > limite && i < c.planos.length - 1) {
    i += 1
    plano = c.planos[i]!
    montado = montarPlano(p, pergunta, plano)
  }
  const saida: TextoMontado = {
    texto: montado.texto,
    caracteres: montado.texto.length,
    totalSemCorte: plano.totalSemCorte,
    cabe: plano.cabe && montado.texto.length <= limite,
    cortes: plano.cortes,
    degrau: plano.passo.grau,
    pisoPassou: montado.texto.length > limite,
  }
  pecasDoTexto.set(saida, { pecas: montado.pecas, mantidos: plano.mantidos, estimado: plano.caracteres })
  return saida
}

/** Para os testes: a medida por soma bateu com o texto montado? (A conta do corte tem de ser exata.) */
export function medidaConfere(t: TextoMontado): boolean {
  return pecasDoTexto.get(t)?.estimado === t.caracteres
}

const abreTabela = (s: Segmento): boolean => {
  if (s.parte !== 4) return false
  const l = s.texto.split('\n')
  return (l[0] ?? '').startsWith('### ') && (l[1] ?? '').startsWith('| ') && (l[2] ?? '').startsWith('| ---')
}

export function resumir(p: PacoteSerializado, pergunta: string): ResumoDoDialogo {
  const copia = montarTexto(p, pergunta, CONTEXTO_IA_RULES.limiteCopia, 'todos')
  const completo = montarTexto(p, pergunta, CONTEXTO_IA_RULES.limiteCompleto, 'um_por_vez')
  const guardado = pecasDoTexto.get(copia)
  if (!guardado) throw new Error('contexto-ia: texto montado sem as peças')
  const { pecas, mantidos } = guardado
  const quantas = mantidos.length
  const comeco: number[] = []
  let atual = 0
  for (const peca of pecas) { comeco.push(atual); atual += peca.length + 1 }
  const tabelas = mantidos.flatMap((s, i) => (abreTabela(s) ? [i] : []))
  const fimDoInicio = tabelas.length >= 3 ? tabelas[2]! : mantidos.findIndex((s) => s.parte === 5)
  const inicioDa7 = comeco[quantas]!
  const inicioDa8 = comeco[quantas + 1]!
  const inicioDa9 = comeco[quantas + 2]!
  const fimDoInicioEm = comeco[fimDoInicio]!
  const tresLinhas = (pecas[quantas + 1] ?? '').split('\n').slice(0, 3).join('\n').length + 1
  const fimDe8 = inicioDa8 + tresLinhas
  return {
    copia,
    completo,
    naoSaem: completo.totalSemCorte - completo.caracteres,
    soNoArquivo: completo.caracteres - copia.caracteres,
    previa: {
      inicio: copia.texto.slice(0, fimDoInicioEm),
      dobra1: inicioDa7 - fimDoInicioEm,
      fim7e8: copia.texto.slice(inicioDa7, fimDe8),
      dobra2: inicioDa9 - fimDe8,
      fim9: copia.texto.slice(inicioDa9),
    },
  }
}
