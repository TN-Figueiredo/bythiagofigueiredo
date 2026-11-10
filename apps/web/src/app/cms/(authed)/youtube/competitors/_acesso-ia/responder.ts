// A5 · E17 degrau 2, Tarefa 10: da ação ao texto (plano, 4.6). `responder` valida a entrada, traduz para telas do degrau 1, monta cada pacote
// pelo MESMO `EMPACOTAR` da ação do botão, aplica o limite próprio da ação, segmenta e monta o texto com o teto. NUNCA lança.
// Não há leitor próprio aqui: nenhuma consulta ao banco (a varredura da Tarefa 17 confere). O que a tela não mede continua "não medido"
// com o motivo: este arquivo só corta linhas inteiras de tabela e não toca em célula.
// Erro, log e Sentry levam só o nome do passo: nunca a mensagem da exceção, o pedido nem o pacote.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { z } from 'zod'
import { ACOES, ENTRADA, traduzir, type Acao, type Pedido } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { ACESSO_IA_RULES } from '@/lib/youtube/observatorio/acesso-ia/regras'
import { FRASES_DA_FERRAMENTA } from '@/lib/youtube/observatorio/acesso-ia/frases'
import { coberturaCompleta, RODAPE_MAX, secaoDeCobertura, type Cobertura } from '@/lib/youtube/observatorio/acesso-ia/cobertura'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { SEMANA_FECHADA, type Celula, type PacoteModelo, type Tabela, type TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { Resposta } from '@/lib/pipeline/mcp/observatorio/executar'
import type { Abridor } from '../_chrome/abridor'
import { ehSoDoLadoA } from '../_contexto-ia/empacotar-comparar'
import { EMPACOTAR, type FaltouNoPar } from '../_contexto-ia'
import { TODOS_OS_CAMPOS, fraseDeRecusa } from '@/lib/youtube/observatorio/acesso-ia/exemplos'
import { classeDa, degrausDoLimite, escolherCorte, janela, type ClasseNaIa } from './corte-da-ia'
import { respostaEmTabela } from './resposta-tabela'

type Entrada = z.infer<typeof ENTRADA>
type Params = Resposta['params']
type Numeros = Cobertura['numeros']
type Tela = Pedido['telas'][number]['tela']

const TAGS = { component: 'observatorio-ia', step: 'responder' } as const
/** `extra` só leva contador ou id de lista fechada: nunca texto livre, pedido nem pacote. */
const avisar = (passo: string, extra?: Record<string, number | string>): void => {
  Sentry.captureMessage(`observatorio_leitura: ${passo}`, { level: 'warning', tags: TAGS, extra: { passo, ...extra } })
}

/* ------------------------------------------------------------------ pedido inválido, sem eco de texto livre */

const CAMPOS = TODOS_OS_CAMPOS
const ehCampo = (s: unknown): s is string => typeof s === 'string' && CAMPOS.includes(s)

/** A ação que a pessoa mandou, só se for uma das dez; qualquer outra coisa vira `null` (nunca se ecoa). */
const acaoConhecida = (e: unknown): Acao | null => {
  const a = typeof e === 'object' && e !== null ? (e as { acao?: unknown }).acao : undefined
  return typeof a === 'string' && (ACOES as readonly string[]).includes(a) ? (a as Acao) : null
}

/** Quais campos o esquema apontou (só nomes do esquema; campo inventado vira `(desconhecido)`); `undefined` se nenhum issue diz qual. */
function camposInvalidos(erro: z.ZodError): string[] | undefined {
  const c = new Set<string>()
  for (const i of erro.issues) {
    if (i.code === 'unrecognized_keys') c.add('(desconhecido)')
    else if (ehCampo(i.path[0])) c.add(String(i.path[0]))
    else if (i.code === 'invalid_union_discriminator') c.add('acao')
  }
  return c.size === 0 ? undefined : [...c].sort().slice(0, 6)
}

/** A frase do esquema, sem o que a pessoa escreveu: só mensagens nossas (`custom`) ou o nome de um campo conhecido. */
function fraseDoEsquema(erro: z.ZodError): string {
  const frases = new Set<string>()
  for (const i of erro.issues) {
    const campo = ehCampo(i.path[0]) ? String(i.path[0]) : null
    if (i.code === 'custom') frases.add(campo ? `${campo}: ${i.message}` : i.message)
    else if (i.code === 'unrecognized_keys') frases.add('a ação não aceita um dos campos enviados')
    else if (i.code === 'invalid_union_discriminator') frases.add('acao fora da lista')
    else if (i.code === 'invalid_union' || i.code === 'invalid_enum_value' || i.code === 'invalid_literal') frases.add(campo ? `${campo}: valor fora da lista` : 'ação desconhecida')
    else if (i.code === 'too_big' || i.code === 'too_small') frases.add(campo ? `${campo}: tamanho fora do permitido` : 'entrada fora do tamanho permitido')
    else frases.add(campo ? `${campo}: valor fora de forma` : 'entrada fora de forma')
  }
  return [...frases].slice(0, 6).join('; ')
}

/* ------------------------------------------------------------------ params do registro */

const par = (r: Record<string, string>): string[] => Object.entries(r).map(([k, v]) => `${k}=${v}`).sort()

/** Só campos já validados pelo esquema. */
function paramsDaEntrada(e: Entrada): Params {
  const p: Params = {}
  const x = e as Record<string, unknown>
  for (const k of CAMPOS) {
    if (k === 'acao' || k === 'parametros') continue
    const v = x[k]
    if (typeof v === 'string') p[k] = v
    else if (typeof v === 'number' && Number.isInteger(v)) p[k] = v
    else if (Array.isArray(v) && v.every((s) => typeof s === 'string')) p[k] = v as string[]
  }
  const ps = x.parametros
  if (ps && typeof ps === 'object') p.parametros = par(ps as Record<string, string>)
  return p
}

/* ------------------------------------------------------------------ datas das linhas de série */

const SP_MS = 3 * 3_600_000
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const hojeSp = (agora: number): string => iso(agora - SP_MS)
const diaValido = (a: number, m: number, d: number): boolean => m >= 1 && m <= 12 && d >= 1 && new Date(Date.UTC(a, m - 1, d)).getUTCMonth() === m - 1 && new Date(Date.UTC(a, m - 1, d)).getUTCDate() === d

/** O dia de uma linha de `dia_a_dia`, lido do texto da 1ª célula (`dd/mm`, `dd/mm/aaaa`, `aaaa-mm-dd`, "hoje", "ontem"). Não leu: `null` (nunca chuta). */
export function diaDaLinha(linha: readonly Celula[], agora: number): string | null {
  const c = linha[0]
  if (!c || c.papel === 'numero') return null
  const t = c.texto.trim().toLowerCase()
  const hoje = hojeSp(agora)
  if (t === 'hoje') return hoje
  if (t === 'ontem') return iso(Date.parse(`${hoje}T00:00:00Z`) - 86_400_000)
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) return diaValido(Number(m[1]), Number(m[2]), Number(m[3])) ? `${m[1]}-${m[2]}-${m[3]}` : null
  m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/.exec(t)
  if (!m) return null
  const d = Number(m[1]), mes = Number(m[2])
  let ano = m[3] ? Number(m[3]) : Number(hoje.slice(0, 4))
  if (!diaValido(ano, mes, d)) return null
  let r = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  // sem ano: o dia mais recente que não está no futuro
  if (!m[3] && r > iso(Date.parse(`${hoje}T00:00:00Z`) + 86_400_000)) {
    ano -= 1
    if (!diaValido(ano, mes, d)) return null
    r = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return r
}

/** Segunda-feira da semana (segunda a domingo) do dia `AAAA-MM-DD`. */
const segundaDe = (dia: string): string => {
  const ms = Date.parse(`${dia}T00:00:00Z`)
  const dow = (new Date(ms).getUTCDay() + 6) % 7
  return iso(ms - dow * 86_400_000)
}
const medidaNaLinha = (l: readonly Celula[]): boolean => l.some((c) => c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido'))
const dmy = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/** Uma semana (segunda a domingo) vira UMA linha: o rótulo da semana e, por coluna numérica, a soma dos 7 dias só quando os 7 estão medidos (com `x`); senão "não medido" com `N de 7 dias medidos`. `soma=false`: tipo não declarado, nunca soma. */
function linhaDaSemana(segunda: string, linhas: ReadonlyArray<readonly Celula[]>, soma: boolean): Celula[] {
  const ref = linhas[0]!
  const medidas = (j: number): number[] => linhas.map((l) => l[j]).flatMap((c) => (c && c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido') && typeof c.x === 'number' && Number.isFinite(c.x) ? [c.x] : []))
  const quantos = Math.max(0, ...ref.map((c, j) => (c.papel === 'numero' ? medidas(j).length : 0)))
  const faltou = `${quantos} de 7 dias medidos`
  return ref.map((c, j): Celula => {
    if (j === 0) return { papel: 'rotulo', texto: `semana de ${dmy(segunda)} (segunda a domingo)`, origem: c.origem }
    if (c.papel !== 'numero') return { papel: 'base', texto: faltou, origem: c.origem }
    const xs = medidas(j)
    if (!soma) return { papel: 'numero', estado: 'nao_medido', motivo: `soma da semana não calculada (tipo da tabela não declarado); ${faltou}`, origem: c.origem }
    if (linhas.length < 7 || xs.length < 7) return { papel: 'numero', estado: 'nao_medido', motivo: `semana incompleta: ${faltou}`, origem: c.origem }
    const total = Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100
    return total === 0 ? { papel: 'numero', estado: 'zero_medido', texto: '0', x: 0, origem: c.origem } : { papel: 'numero', estado: 'medido', texto: String(total), x: total, origem: c.origem }
  })
}

/* ------------------------------------------------------------------ limites próprios */

/** 9º caractere da `marca`: alguma janela anterior perdeu parte do conteúdo. */
const MARCA_PERDEU = 'p'

/** A7b: a linha da Cobertura para as tabelas de texto que ficam fora de toda janela de lista (só notas e dicas de Canais). */
const TEXTO_FORA = {
  canais: { rotulo: 'Notas e dicas', comoVer: 'para um canal, peça canal com o Id' },
} as const

const SUBSTANTIVO: Partial<Record<TelaId, string>> = { canais: 'canais', outliers: 'vídeos', mudancas: 'mudanças' }

/** `serie`: o que o recorte da série fez, para a Cobertura (números do próprio recorte). `convertida`: passou ao grão semana por tamanho. */
interface InfoSerie { pontos: number; total: number; de: string; ate: string; grao: 'dia' | 'semana'; convertida: boolean; semData: number }
interface Cortes { n: number; serie?: InfoSerie }

export { degrausDoLimite }

/**
 * Linhas de tabela do tipo `lista`: as `n` primeiras (limite da ação), na ordem da tela. Transitório até a T9 (janelas): o corte por tamanho agora é do
 * `escolherCorte`, que fixa a principal. A principal é a tabela de classe `principal` (`classeDa`), não "a 1ª lista". O bloco citado de linha cortada sai junto.
 */
function limitarLinhas(m: PacoteModelo, n: number, tela: TelaId, cortes: Cortes, soClasses?: ReadonlySet<ClasseNaIa>): { modelo: PacoteModelo; totais: Map<string, number>; avisoDaPrincipal: string | null } {
  const avisos = [...m.avisos]
  const cortadas = new Map<string, number>()
  const totais = new Map<string, number>()
  let avisoDaPrincipal: string | null = null
  const tabelas = m.tabelas.map((t): Tabela => {
    if (t.tipo !== 'lista' || t.linhas.length <= n) return t
    if (soClasses && !soClasses.has(classeDa(m.tela, t))) return t // a janela cuida da principal, das colunas e do por-nome
    cortes.n += 1
    cortadas.set(t.id, n)
    totais.set(t.id, t.linhas.length)
    // só a principal leva o aviso daqui; as outras listas contam o que não coube no `escolherCorte`, que sabe quantas linhas o texto levou de fato
    if (classeDa(m.tela, t) === 'principal') {
      avisoDaPrincipal = `há ${t.linhas.length} ${SUBSTANTIVO[tela] ?? 'linhas'}; saíram ${n}, na ordem da tela`
      avisos.push(avisoDaPrincipal)
    }
    return { ...t, linhas: t.linhas.slice(0, n) }
  })
  const citados = m.citados.filter((b) => !(b.linha && cortadas.has(b.linha.tabela) && b.linha.posicao > (cortadas.get(b.linha.tabela) ?? 0)))
  return { modelo: { ...m, tabelas, citados, avisos }, totais, avisoDaPrincipal }
}

/** `serie`: só as tabelas `dia_a_dia`, no intervalo `de..ate`; acima de `n` pontos passa ao grão semana (tabela de ganho diário: soma dos 7 dias só com os 7 medidos; acumulada: última leitura; tipo não declarado: \"não medido\") e depois aos `n` mais recentes. */
function recortarSerie(m: PacoteModelo, p: Pedido, agora: number, cortes: Cortes): PacoteModelo {
  const n = p.limite.n
  const de = p.de ?? '0000-01-01'
  const ate = p.ate ?? '9999-12-31'
  const avisos = [...m.avisos]
  const dias = m.tabelas.filter((t) => t.tipo === 'dia_a_dia')
  const tabelas: Tabela[] = []
  if (dias.length === 0) {
    // quem diz POR QUE a série não veio são as tabelas com célula falhou/restrito/não medido: elas ficam
    const motivos = m.tabelas.filter((t) => t.linhas.some((l) => l.some((c) => c.papel === 'numero' && (c.estado === 'falhou' || c.estado === 'restrito' || c.estado === 'nao_medido'))))
    tabelas.push(...motivos)
    if (m.privado.estado === 'excluido') avisos.push('a série dia a dia deste canal é dado privado e não foi incluída; o motivo está na parte do dado privado')
    else if (m.tela === 'canal' || m.tela === 'canal-proprio') {
      avisos.push(`a série dia a dia não veio nesta leitura; ${motivos.length ? 'o motivo está nas tabelas abaixo' : 'a tela não registrou o motivo'}`)
    } else avisos.push('esta tela não traz série dia a dia; nenhuma tabela de série foi montada')
  }
  for (const t of dias) {
    const lidas = t.linhas.map((linha, i) => ({ linha, i, dia: diaDaLinha(linha, agora) }))
    const semData = lidas.filter((x) => x.dia === null).length
    const comData = lidas.filter((x): x is typeof x & { dia: string } => x.dia !== null)
    let dentro = comData.filter((x) => x.dia >= de && x.dia <= ate)
    if (semData > 0) avisos.push(`série "${t.titulo}": ${semData} linha${semData === 1 ? '' : 's'} sem data reconhecível ficaram fora do intervalo`)
    if (dentro.length === 0) {
      const dts = comData.map((x) => x.dia).sort()
      avisos.push(dts.length
        ? `série "${t.titulo}": nenhum ponto entre ${dmy(de)} e ${dmy(ate)}; a tela cobre de ${dmy(dts[0]!)} a ${dmy(dts[dts.length - 1]!)}`
        : `série "${t.titulo}": nenhum ponto entre ${dmy(de)} e ${dmy(ate)}; a tela não traz datas que a ferramenta consiga ler`)
      continue
    }
    let grao = p.grao ?? 'dia'
    let totalDaSerie = dentro.length
    let convertida = false
    if (grao === 'dia' && dentro.length > n) {
      grao = 'semana'
      convertida = true
      cortes.n += 1
      avisos.push(`série "${t.titulo}": ${dentro.length} pontos no grão dia passam de ${n}; mostrada no grão semana`)
    }
    if (grao === 'semana') {
      const semanas = new Map<string, typeof dentro>()
      for (const x of dentro) semanas.set(segundaDe(x.dia), [...(semanas.get(segundaDe(x.dia)) ?? []), x])
      const regra = t.semana === 'soma' ? 'soma' : t.semana === 'ultima' ? 'ultima' : null
      // A5: o fuso do dia vem da tabela (privadas = dia do YouTube, Pacífico; concorrente = São Paulo); sem declarar, a frase de sempre
      const horario = t.fuso === 'pacifico' ? 'horário do Pacífico' : 'horário de São Paulo'
      const escolhidas = [...semanas.entries()].map(([segunda, xs]) => {
        const ord = [...xs].sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0))
        if (regra === 'ultima') {
          // acumulado (total no fim do dia): a última linha MEDIDA; semana sem nenhuma medida fica com a última linha, "não medido" com o motivo (nunca some)
          return ord.find((x) => medidaNaLinha(x.linha)) ?? ord[0]!
        }
        return { ...ord[0]!, linha: linhaDaSemana(segunda, ord.map((x) => x.linha), regra === 'soma'), dia: ord[0]!.dia }
      })
      dentro = escolhidas
      if (!convertida) totalDaSerie = escolhidas.length // pediu semana: o total é de semanas
      avisos.push(regra === 'soma'
        ? `série "${t.titulo}": grão semana, regra "ganho diário": cada semana (segunda a domingo, ${horario}) é a soma dos 7 dias, só quando os 7 estão medidos; senão a célula sai "não medido" com quantos dias foram medidos (nunca zero, nunca soma parcial)`
        : regra === 'ultima'
          ? `série "${t.titulo}": grão semana, regra "acumulado": a última leitura de cada semana (segunda a domingo, ${horario}); o total no fim do dia, não é soma nem média`
          : `série "${t.titulo}": grão semana: o tipo desta tabela (ganho por dia ou total acumulado) não declarado, então a soma da semana não é calculada; cada semana sai "não medido" com quantos dias foram medidos${SEMANA_FECHADA[t.id] ? ` (${SEMANA_FECHADA[t.id]})` : ''}; peça o grão dia`)
    }
    if (dentro.length > n) {
      const mantidos = new Set([...dentro].sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0)).slice(0, n).map((x) => x.i))
      cortes.n += 1
      avisos.push(`série "${t.titulo}": ainda são ${dentro.length} pontos no grão semana; ficam os ${n} mais recentes`)
      dentro = dentro.filter((x) => mantidos.has(x.i))
    }
    dentro.sort((a, b) => a.i - b.i)
    tabelas.push({ ...t, linhas: dentro.map((x) => x.linha) })
    if (!cortes.serie || totalDaSerie + semData > cortes.serie.total) {
      const dts = dentro.map((x) => x.dia).sort()
      // grão semana: o `dia` de cada ponto é o último dia medido da semana; a Cobertura começa na segunda da 1ª semana mostrada, como a tabela
      const deMostrado = dts[0] === undefined ? de : grao === 'semana' ? segundaDe(dts[0]) : dts[0]
      cortes.serie = { pontos: dentro.length, de: deMostrado, ate: dts[dts.length - 1] ?? ate, grao: grao === 'semana' ? 'semana' : 'dia', convertida, semData, total: totalDaSerie + semData }
    }
  }
  // só a série: sem bloco citado, sem comentário; o privado só fica se alguma tabela privada ficou
  let privado = m.privado
  let { foco, definicoes } = m
  let avisosPrivados = m.avisosPrivados
  if (privado.estado === 'incluido' && !tabelas.some((t) => t.privada)) {
    privado = { estado: 'na' }
    foco = foco.filter((f) => !f.privado)
    definicoes = definicoes.filter((d) => !d.privado)
    avisosPrivados = undefined
  }
  const saida: PacoteModelo = { ...m, tabelas, citados: [], comentarios: { estado: 'na' }, privado, foco, definicoes, avisos }
  if (avisosPrivados) saida.avisosPrivados = avisosPrivados
  else delete saida.avisosPrivados
  return saida
}

/** `definicoes`: a união das definições, dos avisos e do "o que esta tela não mede" das cinco telas, sem repetir medida. */
function unirDefinicoes(modelos: PacoteModelo[]): PacoteModelo {
  const medidas = new Set<string>()
  const definicoes = modelos.flatMap((m) => m.definicoes).filter((d) => {
    if (d.privado || medidas.has(d.medida)) return false
    medidas.add(d.medida)
    return true
  })
  const unicos = (xs: string[]): string[] => [...new Set(xs)]
  return {
    tela: modelos[0]!.tela, janela: 'definições das telas do Observatório', foco: [], tabelas: [], citados: [], definicoes,
    avisos: unicos(modelos.flatMap((m) => m.avisos)), naoMede: unicos(modelos.flatMap((m) => m.naoMede)),
    privado: { estado: 'na' }, comentarios: { estado: 'na' }, vazio: null, motivoDoMagro: null, listasCompletas: false,
  }
}

/* ------------------------------------------------------------------ a resposta */

const resp = (desfecho: Resposta['desfecho'], texto: string, params: Params = {}, incluiuPrivado = false): Resposta => ({ texto, desfecho, incluiuPrivado, params })
const NAO_ENCONTRADO = (params: Params): Resposta => resp('nao_encontrado', FRASES_DA_FERRAMENTA.nao_encontrado, params)

/** Com a tela como veio (`canal`), ou resolvendo `canal?`/`video?` entre a versão de concorrente e a própria. */
async function empacotar(t: Pedido['telas'][number], abrir: Abridor, faltou?: FaltouNoPar) {
  const chamar = async (tela: TelaId) => {
    const f = EMPACOTAR[tela]
    if (!f) throw new Error('sem empacotador')
    return f({ ...(t.id !== undefined ? { id: t.id } : {}), sp: t.sp, ...(faltou ? { faltou } : {}) }, abrir)
  }
  if (t.tela === 'canal?') return (await chamar('canal')) ?? (await chamar('canal-proprio'))
  if (t.tela === 'video?') return (await chamar('video')) ?? (await chamar('video-proprio'))
  return chamar(t.tela)
}

const TOPO_VAZIO = ''
const topoDe = (p: Pedido): string => {
  const linhas = [...p.semEquivalente.map((s) => `Não aplicado: ${s}`), ...(p.janelaUsada ? [`Janela usada: ${p.janelaUsada}`] : [])]
  return linhas.length ? `${linhas.join('\n')}\n` : TOPO_VAZIO
}

/** Texto de um pacote dentro do teto. Se nem o piso do corte cabe, o fim é cortado e a frase diz. Devolve também a 1ª linha de aviso do pacote e o degrau de linhas usado. */
function textoDoModelo(m: PacoteModelo, recente: string | null, agora: number, teto: number, degraus?: readonly number[], cortes?: Cortes): { texto: string; primeira: string | null; degrau: number | null; numeros: Numeros; rotulos: string[] } {
  const pacote = segmentar(m, { geradoEm: agora, recente })
  const t = montarTexto(pacote, '', teto, 'todos', degraus, { ia: true })
  // A1c: o que `montarTexto` cortou por tamanho (e o piso que estourou, que vira corte do fim) chega ao registro; antes ele gravava `cortes=0` em silêncio
  if (cortes) cortes.n += t.cortes.length + (t.pisoPassou ? 1 : 0)
  const rotulos = t.cortes.map((c) => c.rotulo)
  if (t.texto.length > teto) rotulos.push('o fim do texto')
  return { texto: cabeEm(t.texto, teto), primeira: pacote.primeiraLinhaDeAviso, degrau: t.degrau, numeros: t.numerosNoTexto, rotulos }
}

/** As tabelas e o foco que só falam do lado A (`ehSoDoLadoA`, definido junto de onde os ids nascem): o lado A não se repete em cada par. A tabela "número a número" fica (ela põe A ao lado de B). */
function semOLadoA(m: PacoteModelo): PacoteModelo {
  return { ...m, foco: m.foco.slice(1), tabelas: m.tabelas.filter((t) => !ehSoDoLadoA(t.id)) }
}

const FRASE_DO_FIM = '\n[texto cortado por tamanho: o fim não saiu]'
const cabeEm = (texto: string, teto: number): string => (texto.length <= teto ? texto : texto.slice(0, Math.max(0, teto - FRASE_DO_FIM.length)) + FRASE_DO_FIM)

const comTopo = (texto: string, topo: string, primeiraLinha: string | null): string => {
  if (topo === '') return texto
  // o pacote vazio ou magro abre pela frase dele; o topo vem logo depois dela
  if (primeiraLinha !== null && texto.startsWith(primeiraLinha)) {
    const fim = primeiraLinha.length
    return `${texto.slice(0, fim)}\n${topo}${texto.slice(fim).replace(/^\n/, '')}`
  }
  return `${topo}\n${texto}`
}

const privadoIncluido = (m: PacoteModelo): boolean => m.privado.estado === 'incluido' || m.comentarios.estado === 'incluido'

/* ------------------------------------------------------------------ a Cobertura e as próximas chamadas (A7d) */

type Proxima = Cobertura['proximas'][number]
const RESERVA_DO_RODAPE = RODAPE_MAX + 2
const SEM_NUMEROS: Numeros = { medidos: 0, zerosMedidos: 0, naoMedidos: 0, falhou: 0, restrito: 0, privadosMedidos: 0 }
const somarNumeros = (a: Numeros, b: Numeros): Numeros => ({
  medidos: a.medidos + b.medidos, zerosMedidos: a.zerosMedidos + b.zerosMedidos, naoMedidos: a.naoMedidos + b.naoMedidos,
  falhou: a.falhou + b.falhou, restrito: a.restrito + b.restrito, privadosMedidos: a.privadosMedidos + b.privadosMedidos,
})
const horaSp = (agora: number): string => new Date(agora - SP_MS).toISOString().slice(11, 16)
const somaDias = (dia: string, d: number): string => iso(Date.parse(`${dia}T00:00:00Z`) + d * 86_400_000)

/** Só entra no texto a chamada que o esquema e o tradutor aceitam; a que falha cai e avisa (id inventado ou campo fora do esquema nunca chega à IA). */
function validas(candidatas: readonly Proxima[]): Proxima[] {
  const ok: Proxima[] = []
  for (const c of candidatas) {
    const lida = ENTRADA.safeParse(c.chamada)
    if (lida.success && traduzir(lida.data).ok) ok.push(c)
    else avisar('proxima_invalida')
  }
  return ok
}

/** Os Ids das `n` primeiras linhas da lista principal, como o texto os mostra (coluna "Id"). */
function idsDaPrincipal(m: PacoteModelo, n: number, desde = 0): string[] {
  const t = m.tabelas.find((x) => classeDa(m.tela, x) === 'principal')
  const col = t?.colunas.indexOf('Id') ?? -1
  if (!t || col < 0) return []
  return t.linhas.slice(desde, desde + n).flatMap((l) => { const c = l[col]; return c && c.papel !== 'numero' ? [c.texto.trim()] : [] })
}

/** Até 3 chamadas que aprofundam o que a resposta mostrou. Só com id que a própria resposta mostra (ou que a pessoa mandou); `definicoes`, `sugestoes` e `pacote_da_tela` não têm. */
function proximasDe(e: Entrada, modelo: PacoteModelo | null, agora: number, vistas: number, serie: InfoSerie | undefined, inicio = 1, resto: { proximo: number; marca: string } | null = null): Proxima[] {
  const hoje = hojeSp(agora)
  const ate90 = { de: somaDias(hoje, -89), ate: hoje }
  const mesmos = (k: 'formato' | 'nicho'): Record<string, string> => { const v = (e as Record<string, unknown>)[k]; return typeof v === 'string' ? { [k]: v } : {} }
  // A7b: a próxima janela da mesma lista vem primeiro, com os mesmos filtros
  const janelaSeguinte: Proxima[] = resto === null ? [] : [{
    chamada: { ...Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'a_partir_da_linha' && k !== 'marca')), a_partir_da_linha: resto.proximo, marca: resto.marca },
    para: `ver a próxima janela da lista, da linha ${resto.proximo} em diante`,
  }]
  return [...janelaSeguinte, ...proximasDaAcao(e, modelo, ate90, mesmos, vistas, serie, inicio)]
}

/** A próxima chamada de uma lista em tabela continua em tabela. */
const daSaida = (e: Entrada): Record<string, string> => ((e as { saida?: string }).saida === 'tabela' ? { saida: 'tabela' } : {})

function proximasDaAcao(e: Entrada, modelo: PacoteModelo | null, ate90: { de: string; ate: string }, mesmos: (k: 'formato' | 'nicho') => Record<string, string>, vistas: number, serie: InfoSerie | undefined, inicio: number): Proxima[] {
  switch (e.acao) {
    case 'listar_canais': {
      if (!modelo) return []
      const [a, b] = idsDaPrincipal(modelo, Math.min(2, vistas), inicio - 1)
      if (!a) return []
      const doProprio = modelo.tabelas.some((t) => t.id === 'privado-canais')
      const out: Proxima[] = [{ chamada: { acao: 'canal', canal_id: a }, para: `ver o canal da linha ${inicio} com todas as medidas` }]
      if (b || doProprio) {
        const ids = [...(doProprio ? ['proprio'] : []), a, ...(b ? [b] : [])]
        if (ids.length >= 2) out.push({ chamada: { acao: 'comparar', canal_ids: ids }, para: doProprio ? `comparar o seu canal com os das linhas ${inicio} e ${inicio + 1}` : `comparar os canais das linhas ${inicio} e ${inicio + 1}` })
      }
      return out
    }
    case 'destaques':
      return e.janela === 'todas' ? [] : [{ chamada: { acao: 'destaques', janela: 'todas', ...mesmos('formato'), ...mesmos('nicho'), ...daSaida(e) }, para: 'ver os destaques de vídeos de todas as idades' }]
    case 'mudancas':
      return e.janela === '90' || e.janela === 'todas' ? [] : [{ chamada: { acao: 'mudancas', janela: '90', ...(e.canal_id ? { canal_id: e.canal_id } : {}), ...mesmos('formato'), ...mesmos('nicho'), ...daSaida(e) }, para: 'ver as mudanças dos últimos 90 dias' }]
    case 'canal':
      return [{ chamada: { acao: 'serie', canal_id: e.canal_id, ...ate90 }, para: 'ver a série dia a dia dos últimos 90 dias deste canal' }]
    case 'video':
      return [{ chamada: { acao: 'serie', video_id: e.video_id, ...ate90 }, para: 'ver a série dia a dia dos últimos 90 dias deste vídeo' }]
    case 'serie':
      if (!serie?.convertida) return []
      return [{ chamada: { acao: 'serie', ...(e.canal_id ? { canal_id: e.canal_id } : {}), ...(e.video_id ? { video_id: e.video_id } : {}), de: somaDias(e.ate, -399), ate: e.ate, grao: 'dia' }, para: 'ver os últimos 400 dias no grão dia' }]
    default:
      return []
  }
}

/** A seção e os params de toda resposta `ok`: `completa`, `ms` e, quando há, `fora_do_pacote`. Nenhum é texto livre. */
function comCobertura(corpo: string, cob: Cobertura, params: Params, t0: number, incluiuPrivado = false): Resposta {
  const proximas = validas(cob.proximas)
  const secao = secaoDeCobertura({ ...cob, proximas })
  if (secao.length > RODAPE_MAX) avisar('rodape_estourou', { tamanho: secao.length })
  return resp('ok', `${corpo}\n\n${secao}`, {
    ...params, completa: coberturaCompleta(cob), ms: Math.max(0, Date.now() - t0),
    ...(cob.foraDoPacote ? { fora_do_pacote: Math.max(0, cob.foraDoPacote.total - cob.foraDoPacote.mostrados) } : {}),
  }, incluiuPrivado)
}

export async function responder(entradaCrua: unknown, abrir: Abridor, agora: number): Promise<Resposta> {
  let params: Params = {}
  const t0 = Date.now()
  try {
    const lida = ENTRADA.safeParse(entradaCrua)
    if (!lida.success) {
      const campos = camposInvalidos(lida.error)
      return resp('pedido_invalido', fraseDeRecusa(acaoConhecida(entradaCrua), fraseDoEsquema(lida.error)), campos ? { campos_invalidos: campos } : {})
    }
    const entrada = lida.data
    params = paramsDaEntrada(entrada)
    const t = traduzir(entrada)
    if (!t.ok) return resp('pedido_invalido', fraseDeRecusa(entrada.acao, t.frase), { ...params, campos_invalidos: [...t.campos].sort() })
    const pedido = t.pedido
    const cortes: Cortes = { n: 0 }
    const topo = topoDe(pedido)
    const tetoFinal = pedido.teto - RESERVA_DO_RODAPE

    /* ---- comparar: um bloco por par, com o teto dividido */
    if (entrada.acao === 'comparar') {
      const pares = pedido.telas.length
      const reserva = topo.length + 1 + 2 * (pares - 1)
      const doPar = Math.floor((tetoFinal - reserva) / pares)
      const achados: Array<{ a: string; b: string; montado: Awaited<ReturnType<typeof empacotar>>; faltou: FaltouNoPar }> = []
      for (const tela of pedido.telas) {
        const faltou: FaltouNoPar = {}
        achados.push({ a: tela.sp.a ?? 'próprio', b: tela.sp.b ?? '', montado: await empacotar(tela, abrir, faltou), faltou })
      }
      // A1c: nenhum par saiu: a frase fechada MAIS o id que errou (o lado A, quando foi ele; senão os `b`), já validados pelo esquema
      if (achados.every((x) => x.montado === null)) {
        const doA = achados[0]!.faltou.lado
        const quem = doA === 'proprio' ? 'não há canal próprio com vídeo neste site' : doA === 'a' ? achados[0]!.a : achados.map((x) => x.b).join(', ')
        return resp('nao_encontrado', `${FRASES_DA_FERRAMENTA.nao_encontrado}: ${quem}`, { ...params, pares })
      }
      // o lado A é descrito inteiro no 1º par que saiu (se o Par 1 falhou, é o seguinte)
      const primeiro = achados.findIndex((x) => x.montado !== null)
      let privado = false
      let comentarios = false
      let numeros = SEM_NUMEROS
      const rotulos: string[] = []
      let parCortado = -1
      const blocos = achados.map((x, i) => {
        const cab = `## Par ${i + 1}: canal ${x.a} contra canal ${x.b}\n`
        // `a` é o mesmo em todos os pares: se algum par saiu, o que faltou foi o `b` deste
        if (x.montado === null) return `${cab}Canal ${x.b}: ${FRASES_DA_FERRAMENTA.nao_encontrado}.`
        if (x.montado.modelo.privado.estado === 'incluido') privado = true
        if (x.montado.modelo.comentarios.estado === 'incluido') comentarios = true
        // o lado A é o mesmo em todos os pares: só o 1º bloco o descreve por inteiro (foco e tabelas só do lado A); os outros ficam com mais espaço para o lado B
        const modelo = i === primeiro ? x.montado.modelo : semOLadoA(x.montado.modelo)
        const aviso = i === primeiro ? '' : `O lado A é o mesmo do Par ${primeiro + 1} e não se repete aqui.\n`
        const f = textoDoModelo(modelo, x.montado.recente, agora, doPar - cab.length - aviso.length, undefined, cortes)
        numeros = somarNumeros(numeros, f.numeros)
        if (f.rotulos.length > 0 && parCortado < 0) parCortado = i
        rotulos.push(...f.rotulos.map((r) => `Par ${i + 1}: ${r}`))
        return cab + aviso + f.texto
      })
      const junto = `${topo === '' ? '' : `${topo}\n`}${blocos.join('\n\n')}`
      if (junto.length > tetoFinal) rotulos.push('o fim do texto')
      const texto = cabeEm(junto, tetoFinal)
      const cortado = parCortado >= 0 ? achados[parCortado]! : null
      const faltaram = achados.filter((x) => x.montado === null).length
      const cob: Cobertura = {
        apoio: { inteiras: 0, total: 0, cortadas: [] }, cortesDeTamanho: rotulos, numeros, vazio: false,
        ...(faltaram > 0 ? { naoEncontrados: { quantos: faltaram, de: pares } } : {}),
        ...(rotulos.some((r) => r.endsWith('o fim do texto')) ? { numerosAntesDoCorte: true } : {}),
        proximas: cortado ? [{ chamada: { acao: 'comparar', canal_ids: [cortado.a === 'próprio' ? 'proprio' : cortado.a, cortado.b] }, para: 'comparar só este par, com o texto inteiro para ele' }] : [],
      }
      return comCobertura(texto, cob, { ...params, privado, comentarios, cortes: cortes.n, pares }, t0, privado || comentarios)
    }

    /* ---- definicoes: a união das cinco telas */
    if (entrada.acao === 'definicoes') {
      const modelos: PacoteModelo[] = []
      for (const tela of pedido.telas) {
        const m = await empacotar(tela, abrir)
        if (m) modelos.push(m.modelo)
      }
      if (modelos.length === 0) return NAO_ENCONTRADO(params)
      const f = textoDoModelo(unirDefinicoes(modelos), null, agora, tetoFinal - (topo === '' ? 0 : topo.length + 1))
      const cob: Cobertura = { apoio: { inteiras: 0, total: 0, cortadas: [] }, cortesDeTamanho: f.rotulos, numeros: f.numeros, vazio: false, proximas: [] }
      return comCobertura(cabeEm(comTopo(f.texto, topo, null), tetoFinal), cob, { ...params, privado: false, comentarios: false, cortes: 0 }, t0)
    }

    /* ---- uma tela só */
    const tela = pedido.telas[0]
    if (!tela) return resp('falhou', FRASES_DA_FERRAMENTA.nao_montou, params)
    const montado = await empacotar(tela, abrir)
    if (montado === null) return NAO_ENCONTRADO(params)
    let modelo = montado.modelo
    const tetoDoTexto = tetoFinal - (topo === '' ? 0 : topo.length + 1)
    let feito: { texto: string; primeira: string | null; degrau: number | null }
    let doCorte: { linhas: number; total: number } | null = null
    let numeros = SEM_NUMEROS
    let rotulos: string[] = []
    let lista: Cobertura['lista']
    let apoio: Cobertura['apoio'] = { inteiras: 0, total: 0, cortadas: [] }
    let vazio = montado.modelo.vazio !== null
    let proxima: { proximo: number; marca: string } | null = null
    let inicioDaJanela = 1
    let marcaMudou = false
    let semDona = 0
    let janelaDeLista = false
    let janelasAnterioresPerderam = false
    let textoFora: Cobertura['textoFora']
    let soNoTexto: string[] = []
    let incluiuDaTabela: boolean | null = null
    let semXDaTabela = 0
    if (pedido.limite.tipo === 'linhas') {
      const n = pedido.limite.n
      const principal = montado.modelo.tabelas.find((x) => classeDa(montado.modelo.tela, x) === 'principal')
      const totalAntes = principal?.linhas.length ?? 0
      const ctx = { geradoEm: agora, recente: montado.recente }
      const nomeDaTela = TELAS_IA[montado.modelo.tela]?.nome ?? montado.modelo.tela
      if (principal && totalAntes > 0) {
        // A7b: a janela da lista principal. O limite da ação (n) é o máximo de linhas POR JANELA; só o `geral` ainda é cortado em n linhas.
        if (pedido.inicio > totalAntes) {
          return resp('pedido_invalido', fraseDeRecusa(entrada.acao, `a_partir_da_linha: a lista tem ${totalAntes} linhas agora; use de 1 a ${totalAntes}`), { ...params, campos_invalidos: ['a_partir_da_linha'] })
        }
        janelaDeLista = true
        const lim = limitarLinhas(montado.modelo, n, montado.modelo.tela, cortes, new Set<ClasseNaIa>(['geral']))
        const tetoDaJanela = Math.min(tetoDoTexto, ACESSO_IA_RULES.tetoDaJanela)
        // A5 F1b: o modo tabela monta a mesma janela (mesma marca, mesmo `k` por tamanho) em CSV; principal sem `chaves` não tem modo tabela
        const emTabela = pedido.saida === 'tabela' && principal.chaves !== undefined
        if (pedido.saida === 'tabela' && !emTabela) avisar('tabela_sem_chaves', { tabela: principal.id })
        if (emTabela) {
          const r = respostaEmTabela(lim.modelo, ctx, { inicio: pedido.inicio, n }, tetoDaJanela, lim.totais)
          for (const a of r.avisos) avisar(a.passo, a.extra)
          modelo = lim.modelo
          inicioDaJanela = pedido.inicio
          marcaMudou = pedido.marca !== undefined && pedido.marca.slice(0, 8) !== r.marca
          semDona = r.semDona
          const perdeuAqui = r.apoio.cortadas.length > 0 || r.linhaNaoCabe || r.soNoTexto.length > 0
          janelasAnterioresPerderam = pedido.inicio > 1 && (pedido.marca === undefined || pedido.marca.endsWith(MARCA_PERDEU))
          if (pedido.inicio + r.linhasDaPrincipal <= totalAntes) proxima = { proximo: pedido.inicio + r.linhasDaPrincipal, marca: r.marca + (perdeuAqui || janelasAnterioresPerderam ? MARCA_PERDEU : '') }
          if (r.linhaNaoCabe) avisar('linha_nao_cabe', { linhas: r.linhasDaPrincipal, total: totalAntes })
          feito = { texto: cabeEm(r.texto, tetoDoTexto), primeira: r.primeira, degrau: null }
          doCorte = { linhas: r.linhasDaPrincipal, total: totalAntes }
          numeros = r.numeros
          rotulos = r.rotulos
          apoio = r.apoio
          soNoTexto = r.soNoTexto
          incluiuDaTabela = r.incluiuPrivado
          semXDaTabela = r.semX
          if (r.textoFora.linhas > 0) textoFora = { ...TEXTO_FORA[montado.modelo.tela as keyof typeof TEXTO_FORA], linhas: r.textoFora.linhas }
          lista = { titulo: principal.titulo, de: pedido.inicio, ate: pedido.inicio + r.linhasDaPrincipal - 1, total: totalAntes, ...(montado.modelo.tabelas.some((x) => x.id === 'privado-canais') ? { concorrentes: true } : {}) }
        } else {
          const j = janela(lim.modelo, ctx, pedido.inicio, n, tetoDaJanela, lim.totais)
          modelo = lim.modelo
          const c = j.corte
          if (j.linhaNaoCabe) avisar('linha_nao_cabe', { linhas: j.k, total: totalAntes })
          if (j.resumoPassou) avisar('resumo_passou', { total: totalAntes })
          inicioDaJanela = pedido.inicio
          marcaMudou = pedido.marca !== undefined && pedido.marca.slice(0, 8) !== j.marca
          semDona = j.semDona
          // o que uma janela perdeu (geral, colunas, texto, linha que não coube) viaja no 9º caractere da marca, para a última janela não dizer "viu tudo"
          const perdeuAqui = c.estagio !== 'E2' || c.apoio.some((x) => x.saiu < x.de) || j.linhaNaoCabe
          janelasAnterioresPerderam = pedido.inicio > 1 && (pedido.marca === undefined || pedido.marca.endsWith(MARCA_PERDEU))
          if (pedido.inicio + j.k <= totalAntes) proxima = { proximo: pedido.inicio + j.k, marca: j.marca + (perdeuAqui || janelasAnterioresPerderam ? MARCA_PERDEU : '') }
          cortes.n += c.texto.cortes.length + (c.texto.pisoPassou ? 1 : 0)
          feito = { texto: cabeEm(c.texto.texto, tetoDoTexto), primeira: c.primeiraLinhaDeAviso, degrau: c.texto.degrau }
          doCorte = { linhas: j.k, total: totalAntes }
          numeros = c.texto.numerosNoTexto
          // as tabelas de texto retiradas de propósito (notas, dicas) têm linha própria na Cobertura; aqui só o corte real
          rotulos = c.texto.cortes.map((x) => x.rotulo).filter((r) => !r.startsWith('a tabela "'))
          if (c.texto.texto.length > tetoDoTexto) rotulos.push('o fim do texto')
          const cortadas = c.apoio.filter((x) => x.saiu < x.de)
          apoio = { inteiras: c.apoio.length - cortadas.length, total: c.apoio.length, cortadas }
          if (j.textoFora.linhas > 0) textoFora = { ...TEXTO_FORA[montado.modelo.tela as keyof typeof TEXTO_FORA], linhas: j.textoFora.linhas }
          lista = { titulo: principal.titulo, de: pedido.inicio, ate: pedido.inicio + j.k - 1, total: totalAntes, ...(montado.modelo.tabelas.some((x) => x.id === 'privado-canais') ? { concorrentes: true } : {}) }
        }
      } else {
        // sem lista principal (ou vazia): o corte por estágios de antes; a frase do vazio ou o geral na janela única
        const lim = limitarLinhas(montado.modelo, n, montado.modelo.tela, cortes)
        modelo = lim.modelo
        const c = escolherCorte(modelo, ctx, n, tetoDoTexto, lim.totais, lim.avisoDaPrincipal)
        cortes.n += c.texto.cortes.length + (c.texto.pisoPassou ? 1 : 0)
        if (c.principalCortada) {
          cortes.n += 1
          avisar('principal_cortada', { linhas: c.linhasDaPrincipal, total: totalAntes })
        }
        feito = { texto: cabeEm(c.texto.texto, tetoDoTexto), primeira: c.primeiraLinhaDeAviso, degrau: c.texto.degrau }
        doCorte = { linhas: c.linhasDaPrincipal, total: totalAntes }
        numeros = c.texto.numerosNoTexto
        rotulos = c.texto.cortes.map((x) => x.rotulo)
        if (c.texto.texto.length > tetoDoTexto) rotulos.push('o fim do texto')
        const cortadas = c.apoio.filter((x) => x.saiu < x.de)
        apoio = { inteiras: c.apoio.length - cortadas.length, total: c.apoio.length, cortadas }
        if (principal) lista = { titulo: principal.titulo, de: c.linhasDaPrincipal > 0 ? 1 : 0, ate: c.linhasDaPrincipal, total: totalAntes, ...(montado.modelo.tabelas.some((x) => x.id === 'privado-canais') ? { concorrentes: true } : {}) }
        else if (vazio) lista = { titulo: nomeDaTela, de: 0, ate: 0, total: 0 }
        if (principal && totalAntes === 0) vazio = true // vazio nunca é completo, mesmo que o empacotador não tenha dito o motivo
      }
    } else {
      if (pedido.limite.tipo === 'pontos') {
        modelo = recortarSerie(modelo, pedido, agora, cortes)
        vazio = cortes.serie === undefined
      }
      const f = textoDoModelo(modelo, montado.recente, agora, tetoDoTexto, undefined, cortes)
      feito = f
      numeros = f.numeros
      rotulos = f.rotulos
    }
    const incluiu = incluiuDaTabela ?? privadoIncluido(modelo)
    const { texto, primeira } = feito
    const fora = montado.modelo.paginado
    const cob: Cobertura = {
      ...(lista ? { lista } : {}),
      ...(cortes.serie ? { serie: { pontos: cortes.serie.pontos, total: cortes.serie.total, de: cortes.serie.de, ate: cortes.serie.ate, grao: cortes.serie.grao, ...(cortes.serie.semData > 0 ? { semData: cortes.serie.semData } : {}) } } : {}),
      apoio, ...(fora ? { foraDoPacote: fora } : {}), cortesDeTamanho: rotulos, numeros, vazio,
      ...(textoFora ? { textoFora } : {}), ...(soNoTexto.length > 0 ? { soNoTexto } : {}), ...(semDona > 0 ? { semDona } : {}), ...(marcaMudou ? { marcaMudou: true } : {}), ...(janelasAnterioresPerderam ? { janelasAnterioresPerderam: true } : {}),
      ...(rotulos.some((r) => r.endsWith('o fim do texto')) ? { numerosAntesDoCorte: true } : {}),
      ...(vazio && pedido.limite.tipo === 'pontos' ? { serieAusente: true } : {}),
      proximas: proximasDe(entrada, montado.modelo, agora, doCorte?.linhas ?? 0, cortes.serie, inicioDaJanela, proxima),
    }
    if (lista && lista.ate < lista.total) cob.lidaAs = horaSp(agora)
    return comCobertura(cabeEm(comTopo(texto, topo, primeira), tetoFinal), cob, {
      ...params, privado: incluiuDaTabela ?? modelo.privado.estado === 'incluido', comentarios: modelo.comentarios.estado === 'incluido', cortes: cortes.n,
      ...(pedido.saida === 'tabela' ? { saida: 'tabela' as const, sem_x: semXDaTabela } : {}),
      ...(doCorte ? { linhas: doCorte.linhas, total: doCorte.total } : {}),
      ...(janelaDeLista ? { a_partir_da_linha: inicioDaJanela, sem_dona: semDona, ...(pedido.marca !== undefined ? { marca_mudou: marcaMudou } : {}) } : {}),
    }, t0, incluiu)
  } catch {
    // sem a mensagem da exceção, sem o pedido, sem o pacote
    avisar('responder_falhou')
    return resp('falhou', FRASES_DA_FERRAMENTA.nao_montou, params)
  }
}
