// A5 · E17 degrau 2, Tarefa 10: da ação ao texto (plano, 4.6). `responder` valida a entrada, traduz para telas do degrau 1, monta cada pacote
// pelo MESMO `EMPACOTAR` da ação do botão, aplica o limite próprio da ação, segmenta e monta o texto com o teto. NUNCA lança.
// Não há leitor próprio aqui: nenhuma consulta ao banco (a varredura da Tarefa 17 confere). O que a tela não mede continua "não medido"
// com o motivo: este arquivo só corta linhas inteiras de tabela e não toca em célula.
// Erro, log e Sentry levam só o nome do passo: nunca a mensagem da exceção, o pedido nem o pacote.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { z } from 'zod'
import { ENTRADA, traduzir, type Pedido } from '@/lib/youtube/observatorio/acesso-ia/acoes'
import { FRASES_DA_FERRAMENTA } from '@/lib/youtube/observatorio/acesso-ia/frases'
import { montarTexto } from '@/lib/youtube/observatorio/contexto-ia/montar-texto'
import { segmentar } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import type { Celula, PacoteModelo, Tabela, TelaId } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import type { Resposta } from '@/lib/pipeline/mcp/observatorio/executar'
import type { Abridor } from '../_chrome/abridor'
import { EMPACOTAR } from '../_contexto-ia'

type Entrada = z.infer<typeof ENTRADA>
type Params = Resposta['params']
type Tela = Pedido['telas'][number]['tela']

const TAGS = { component: 'observatorio-ia', step: 'responder' } as const
const avisar = (passo: string): void => {
  Sentry.captureMessage(`observatorio_leitura: ${passo}`, { level: 'warning', tags: TAGS, extra: { passo } })
}

/* ------------------------------------------------------------------ pedido inválido, sem eco de texto livre */

const CAMPOS = ['acao', 'canal_id', 'video_id', 'canal_ids', 'janela', 'formato', 'nicho', 'de', 'ate', 'grao', 'desde', 'tela', 'id', 'parametros'] as const
const ehCampo = (s: unknown): s is (typeof CAMPOS)[number] => typeof s === 'string' && (CAMPOS as readonly string[]).includes(s)

/** A frase do esquema, sem o que a pessoa escreveu: só mensagens nossas (`custom`) ou o nome de um campo conhecido. */
function fraseDoEsquema(erro: z.ZodError): string {
  const frases = new Set<string>()
  for (const i of erro.issues) {
    const campo = ehCampo(i.path[0]) ? String(i.path[0]) : null
    if (i.code === 'custom') frases.add(campo ? `${campo}: ${i.message}` : i.message)
    else if (i.code === 'unrecognized_keys') frases.add('a ação não aceita um dos campos enviados')
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

/* ------------------------------------------------------------------ limites próprios */

const SUBSTANTIVO: Partial<Record<TelaId, string>> = { canais: 'canais', outliers: 'vídeos', mudancas: 'mudanças' }

interface Cortes { n: number }

/** Os degraus do corte por tamanho para o limite `n` da ação: o texto só cai para 25 linhas depois de tentar 150, 100, 75 e 50 (o diálogo do degrau 1 segue com a escada dele). */
export const degrausDoLimite = (n: number): number[] => [n, 150, 100, 75, 50, 25, 10, 5, 3, 1, 0].filter((x, i, xs) => x <= n && xs.indexOf(x) === i)

/**
 * Linhas de tabela do tipo `lista`: as `n` primeiras (limite da ação), na ordem da tela. `k` é quantas linhas o texto de fato leva (o corte por tamanho
 * pode tê-lo baixado de `n`): a frase do aviso diz `k`, nunca o limite da ação quando o tamanho cortou mais. O bloco citado de linha cortada sai junto.
 */
function limitarLinhas(m: PacoteModelo, n: number, tela: TelaId, cortes: Cortes, k: number = n): PacoteModelo {
  const avisos = [...m.avisos]
  let primeira = true
  const cortadas = new Map<string, number>()
  const tabelas = m.tabelas.map((t): Tabela => {
    const principal = t.tipo === 'lista' && primeira
    if (t.tipo === 'lista') primeira = false
    if (t.tipo !== 'lista' || t.linhas.length <= Math.min(n, k)) return t
    cortes.n += 1
    cortadas.set(t.id, n)
    const resto = k < n ? ` (o limite da ação é ${n}; o resto não coube no tamanho)` : ''
    avisos.push(principal
      ? `há ${t.linhas.length} ${SUBSTANTIVO[tela] ?? 'linhas'}; saíram ${k}, na ordem da tela${resto}`
      : `tabela "${t.titulo}": há ${t.linhas.length} linhas; saíram ${k}, na ordem da tela${resto}`)
    return t.linhas.length > n ? { ...t, linhas: t.linhas.slice(0, n) } : t
  })
  const citados = m.citados.filter((b) => !(b.linha && cortadas.has(b.linha.tabela) && b.linha.posicao > (cortadas.get(b.linha.tabela) ?? 0)))
  return { ...m, tabelas, citados, avisos }
}

/** `serie`: só as tabelas `dia_a_dia`, no intervalo `de..ate`; acima de `n` pontos passa ao grão semana (seleção, nunca soma nem média) e depois aos `n` mais recentes. */
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
    if (grao === 'dia' && dentro.length > n) {
      grao = 'semana'
      cortes.n += 1
      avisos.push(`série "${t.titulo}": ${dentro.length} pontos no grão dia passam de ${n}; mostrada no grão semana`)
    }
    if (grao === 'semana') {
      const semanas = new Map<string, typeof dentro>()
      for (const x of dentro) semanas.set(segundaDe(x.dia), [...(semanas.get(segundaDe(x.dia)) ?? []), x])
      const escolhidas = [...semanas.values()].map((xs) => {
        const ord = [...xs].sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0))
        // a última linha MEDIDA; semana sem nenhuma medida fica com a última linha, "não medido" com o motivo (nunca some)
        return ord.find((x) => medidaNaLinha(x.linha)) ?? ord[0]!
      })
      dentro = escolhidas
      avisos.push(`série "${t.titulo}": grão semana: a última leitura de cada semana (segunda a domingo, horário de São Paulo); não é soma nem média`)
    }
    if (dentro.length > n) {
      const mantidos = new Set([...dentro].sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0)).slice(0, n).map((x) => x.i))
      cortes.n += 1
      avisos.push(`série "${t.titulo}": ainda são ${dentro.length} pontos no grão semana; ficam os ${n} mais recentes`)
      dentro = dentro.filter((x) => mantidos.has(x.i))
    }
    dentro.sort((a, b) => a.i - b.i)
    tabelas.push({ ...t, linhas: dentro.map((x) => x.linha) })
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
async function empacotar(t: Pedido['telas'][number], abrir: Abridor) {
  const chamar = async (tela: TelaId) => {
    const f = EMPACOTAR[tela]
    if (!f) throw new Error('sem empacotador')
    return f({ ...(t.id !== undefined ? { id: t.id } : {}), sp: t.sp }, abrir)
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
function textoDoModelo(m: PacoteModelo, recente: string | null, agora: number, teto: number, degraus?: readonly number[], cortes?: Cortes): { texto: string; primeira: string | null; degrau: number | null } {
  const pacote = segmentar(m, { geradoEm: agora, recente })
  const t = montarTexto(pacote, '', teto, 'todos', degraus)
  // A1c: o que `montarTexto` cortou por tamanho (e o piso que estourou, que vira corte do fim) chega ao registro; antes ele gravava `cortes=0` em silêncio
  if (cortes) cortes.n += t.cortes.length + (t.pisoPassou && t.cortes.length === 0 ? 1 : 0)
  return { texto: cabeEm(t.texto, teto), primeira: pacote.primeiraLinhaDeAviso, degrau: t.degrau }
}

/** As tabelas e o foco que só falam do lado A (`privado-alcance-a`, `…-sentido-a`, `…-notas-a`): o lado A não se repete em cada par. A tabela "número a número" fica (ela põe A ao lado de B). */
const SO_DO_LADO_A = /(^|-)alcance-a$|-sentido-a$|-notas-a$/
function semOLadoA(m: PacoteModelo): PacoteModelo {
  return { ...m, foco: m.foco.slice(1), tabelas: m.tabelas.filter((t) => !SO_DO_LADO_A.test(t.id)) }
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

export async function responder(entradaCrua: unknown, abrir: Abridor, agora: number): Promise<Resposta> {
  let params: Params = {}
  try {
    const lida = ENTRADA.safeParse(entradaCrua)
    if (!lida.success) return resp('pedido_invalido', fraseDoEsquema(lida.error))
    const entrada = lida.data
    params = paramsDaEntrada(entrada)
    const t = traduzir(entrada)
    if (!t.ok) return resp('pedido_invalido', t.frase, params)
    const pedido = t.pedido
    const cortes: Cortes = { n: 0 }
    const topo = topoDe(pedido)

    /* ---- comparar: um bloco por par, com o teto dividido */
    if (entrada.acao === 'comparar') {
      const pares = pedido.telas.length
      const reserva = topo.length + 1 + 2 * (pares - 1)
      const doPar = Math.floor((pedido.teto - reserva) / pares)
      const achados: Array<{ a: string; b: string; montado: Awaited<ReturnType<typeof empacotar>> }> = []
      for (const tela of pedido.telas) achados.push({ a: tela.sp.a ?? '', b: tela.sp.b ?? '', montado: await empacotar(tela, abrir) })
      // A1c: nenhum par saiu: a frase fechada MAIS os ids pedidos (já validados pelo esquema), para a IA saber qual id errou
      if (achados.every((x) => x.montado === null)) return resp('nao_encontrado', `${FRASES_DA_FERRAMENTA.nao_encontrado}: ${achados.map((x) => x.b).join(', ')}`, { ...params, pares })
      let privado = false
      let comentarios = false
      const blocos = achados.map((x, i) => {
        const cab = `## Par ${i + 1}: canal ${x.a} contra canal ${x.b}\n`
        // `a` é o mesmo em todos os pares: se algum par saiu, o que faltou foi o `b` deste
        if (x.montado === null) return `${cab}Canal ${x.b}: ${FRASES_DA_FERRAMENTA.nao_encontrado}.`
        if (x.montado.modelo.privado.estado === 'incluido') privado = true
        if (x.montado.modelo.comentarios.estado === 'incluido') comentarios = true
        // o lado A é o mesmo em todos os pares: só o 1º bloco o descreve por inteiro (foco e tabelas só do lado A); os outros ficam com mais espaço para o lado B
        const modelo = i === 0 ? x.montado.modelo : semOLadoA(x.montado.modelo)
        const aviso = i === 0 ? '' : 'O lado A é o mesmo do Par 1 e não se repete aqui.\n'
        return cab + aviso + textoDoModelo(modelo, x.montado.recente, agora, doPar - cab.length - aviso.length, undefined, cortes).texto
      })
      const texto = cabeEm(`${topo === '' ? '' : `${topo}\n`}${blocos.join('\n\n')}`, pedido.teto)
      return resp('ok', texto, { ...params, privado, comentarios, cortes: cortes.n, pares }, privado || comentarios)
    }

    /* ---- definicoes: a união das cinco telas */
    if (entrada.acao === 'definicoes') {
      const modelos: PacoteModelo[] = []
      for (const tela of pedido.telas) {
        const m = await empacotar(tela, abrir)
        if (m) modelos.push(m.modelo)
      }
      if (modelos.length === 0) return NAO_ENCONTRADO(params)
      const { texto } = textoDoModelo(unirDefinicoes(modelos), null, agora, pedido.teto - (topo === '' ? 0 : topo.length + 1))
      return resp('ok', cabeEm(comTopo(texto, topo, null), pedido.teto), { ...params, privado: false, comentarios: false, cortes: 0 })
    }

    /* ---- uma tela só */
    const tela = pedido.telas[0]
    if (!tela) return resp('falhou', FRASES_DA_FERRAMENTA.nao_montou, params)
    const montado = await empacotar(tela, abrir)
    if (montado === null) return NAO_ENCONTRADO(params)
    let modelo = montado.modelo
    const tetoDoTexto = pedido.teto - (topo === '' ? 0 : topo.length + 1)
    let feito: ReturnType<typeof textoDoModelo>
    if (pedido.limite.tipo === 'linhas') {
      // o aviso diz quantas linhas o TEXTO levou: se o tamanho cortou abaixo do limite da ação, relê com o número real (k só desce, então para)
      const n = pedido.limite.n
      let k = n
      for (let volta = 0; ; volta += 1) {
        cortes.n = 0
        modelo = limitarLinhas(montado.modelo, n, montado.modelo.tela, cortes, k)
        feito = textoDoModelo(modelo, montado.recente, agora, tetoDoTexto, degrausDoLimite(n), cortes)
        const novo = feito.degrau === null ? k : Math.min(k, feito.degrau)
        if (novo === k || volta >= 6) break
        k = novo
      }
    } else {
      if (pedido.limite.tipo === 'pontos') modelo = recortarSerie(modelo, pedido, agora, cortes)
      feito = textoDoModelo(modelo, montado.recente, agora, tetoDoTexto, undefined, cortes)
    }
    const incluiu = privadoIncluido(modelo)
    const { texto, primeira } = feito
    return resp('ok', cabeEm(comTopo(texto, topo, primeira), pedido.teto), {
      ...params, privado: modelo.privado.estado === 'incluido', comentarios: modelo.comentarios.estado === 'incluido', cortes: cortes.n,
    }, incluiu)
  } catch {
    // sem a mensagem da exceção, sem o pedido, sem o pacote
    avisar('responder_falhou')
    return resp('falhou', FRASES_DA_FERRAMENTA.nao_montou, params)
  }
}
