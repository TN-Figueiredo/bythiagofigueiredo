// A5 F2a T9: a série de um canal em CSV longo (`saida: 'tabela'`). Puro: sem banco, sem relógio (o `agora` entra por parâmetro), sem Sentry (quem avisa é o `responder`,
// com os códigos que daqui saem em `avisos`). Lê o MESMO `PacoteModelo` que passa por `segmentar` (que lança com dado privado sem direito); a data de cada ponto é
// `Tabela.dias` (ISO), nunca o texto do rótulo. Aqui mora também `somaDaSemana`, a regra única da semana (texto e CSV).
import * as F from '@/lib/youtube/observatorio/contexto-ia/frases'
import { segmentar, textoDoPrivadoExcluido } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { campoCsv, novaLegenda, numeroCsv, type EstadoVazio, type Legenda } from '@/lib/youtube/observatorio/contexto-ia/tabela-csv'
import { naCelula } from '@/lib/youtube/observatorio/contexto-ia/terceiros'
import { foraDaLeituraFrase } from '@/lib/youtube/observatorio/proprio/vpd'
import type { Cobertura } from '@/lib/youtube/observatorio/acesso-ia/cobertura'
import type { Celula, ContextoDoPacote, PacoteModelo, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'

export type MotivoDaSemana = 'semana_aberta' | 'dias_sem_leitura' | 'total_corrigido' | 'tabela_sem_soma'
export interface SomaDaSemana { x: number | null; diasMedidos: number; motivo: MotivoDaSemana | null }
export interface PontoCsv {
  data: string
  canalId: string
  apelido: string
  medida: string
  x: number | null
  estado: 'medido' | 'zero_medido' | 'nao_medido' | 'falhou' | 'restrito'
  diasMedidos?: number
  motivo?: string
  /** O ponto vem de tabela privada (conta em `privadosMedidos`). */
  privada?: true
}
export interface CanalDaSerie { apelido: string; canalId: string; nome: string; medidas: Array<{ medida: string; titulo: string; base: string }> }

/* ------------------------------------------------------------------ datas */

const DIA_MS = 86_400_000
const SP_MS = 3 * 3_600_000
export const isoDe = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
export const hojeSp = (agora: number): string => isoDe(agora - SP_MS)
const ms = (d: string): number => Date.parse(`${d}T00:00:00Z`)
export const somaDias = (d: string, n: number): string => isoDe(ms(d) + n * DIA_MS)
/** Segunda-feira da semana (segunda a domingo) do dia `AAAA-MM-DD`. */
export const segundaDe = (dia: string): string => somaDias(dia, -((new Date(ms(dia)).getUTCDay() + 6) % 7))
/** `dd/mm/aaaa` */
export const dmy = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const entre = (a: string, b: string): number => Math.round((ms(b) - ms(a)) / DIA_MS)

/* ------------------------------------------------------------------ a semana */

/** O `x` de uma célula só quando ela é número medido (ou zero medido) com valor de máquina finito. */
export function xDaCelula(c: Celula | undefined): number | null {
  return c && c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido') && typeof c.x === 'number' && Number.isFinite(c.x) ? c.x : null
}
const temLeitura = (c: Celula | undefined): boolean =>
  c !== undefined && c.papel === 'numero' && (c.estado === 'medido' || c.estado === 'zero_medido' || (c.estado === 'nao_medido' && c.causa === 'diminuiu'))

/**
 * A semana (segunda a domingo) de uma tabela `dia_a_dia`. `regra` vem de `Tabela.semana`: `'soma'` (ganho do dia: soma dos 7, só com os 7 medidos), `'ultima'` (total
 * acumulado: a última leitura medida) ou `null` (não declarado: nunca soma). `dias` são os dias da semana que a tabela TEM; o denominador é sempre 7.
 */
export function somaDaSemana(segunda: string, dias: ReadonlyArray<{ dia: string; celula: Celula }>, hoje: string, regra: 'soma' | 'ultima' | null): SomaDaSemana {
  const medidos = dias.flatMap((d) => { const x = xDaCelula(d.celula); return x === null ? [] : [{ dia: d.dia, x }] })
  const k = medidos.length
  if (regra === null) return { x: null, diasMedidos: k, motivo: 'tabela_sem_soma' }
  if (regra === 'ultima') {
    if (k === 0) return { x: null, diasMedidos: 0, motivo: 'dias_sem_leitura' }
    const ultimo = medidos.reduce((a, b) => (b.dia > a.dia ? b : a))
    return { x: ultimo.x, diasMedidos: k, motivo: null }
  }
  if (dias.length >= 7 && k >= 7) return { x: Math.round(medidos.reduce((a, b) => a + b.x, 0) * 100) / 100, diasMedidos: k, motivo: null }
  if (somaDias(segunda, 6) >= hoje) return { x: null, diasMedidos: k, motivo: 'semana_aberta' }
  if (dias.some((d) => d.celula.papel === 'numero' && d.celula.estado === 'nao_medido' && d.celula.causa === 'diminuiu')) return { x: null, diasMedidos: k, motivo: 'total_corrigido' }
  return { x: null, diasMedidos: k, motivo: 'dias_sem_leitura' }
}

/** A frase de cada motivo (CSV). O texto do modo `texto` tem as suas próprias frases de sempre. */
export function frasesDoMotivo(motivo: MotivoDaSemana, segunda: string, k: number): string {
  if (motivo === 'semana_aberta') return F.SEMANA_ABERTA(dm(somaDias(segunda, 6)))
  if (motivo === 'total_corrigido') return F.SEMANA_TOTAL_CORRIGIDO
  if (motivo === 'tabela_sem_soma') return F.SEMANA_TABELA_SEM_SOMA
  return F.SEMANA_DIAS_SEM_LEITURA(7 - k)
}

/* ------------------------------------------------------------------ os pontos */

/** Colunas numéricas de cada tabela `dia_a_dia` com data que a série lê: coluna da tabela e a chave de máquina da medida. */
const MEDIDAS_DA_TABELA: Readonly<Record<string, ReadonlyArray<{ col: number; medida: string }>>> = {
  'canal-linha-do-tempo': [{ col: 1, medida: 'views_ganhas' }],
  'privado-views-por-dia': [{ col: 1, medida: 'views' }],
  'privado-views-por-dia-do-video': [{ col: 1, medida: 'views' }],
  'privado-impressoes-por-dia': [{ col: 1, medida: 'impressoes' }, { col: 2, medida: 'cliques_estimados' }],
  'privado-impressoes-por-dia-do-video': [{ col: 1, medida: 'impressoes' }, { col: 2, medida: 'cliques_estimados' }],
}
const MEDIDA_RESTRITA = 'views'

interface Serie { t: Tabela; col: number; medida: string }
const diasValidos = (t: Tabela): boolean => t.dias !== undefined && t.dias.length === t.linhas.length
const ehDoProprio = (m: PacoteModelo): boolean => m.tela === 'canal-proprio' || m.tela === 'video-proprio'
/** O dado privado não foi liberado: a série do próprio sai `restrito`, e nenhuma tabela privada é lida (mesmo que alguém a entregue). */
const privadoNegado = (m: PacoteModelo): boolean => m.privado.estado !== 'incluido'

function seriesDe(m: PacoteModelo): Serie[] {
  return m.tabelas
    .filter((t) => t.tipo === 'dia_a_dia' && diasValidos(t) && MEDIDAS_DA_TABELA[t.id] !== undefined && !(t.privada && privadoNegado(m)))
    .flatMap((t) => MEDIDAS_DA_TABELA[t.id]!.map((c) => ({ t, col: c.col, medida: c.medida })))
}
const regraDe = (t: Tabela): 'soma' | 'ultima' | null => (t.semana === 'soma' ? 'soma' : t.semana === 'ultima' ? 'ultima' : null)
const estadoDaSoma = (x: number | null): PontoCsv['estado'] => (x === null ? 'nao_medido' : x === 0 ? 'zero_medido' : 'medido')

function datasDoPedido(de: string, ate: string, grao: 'dia' | 'semana'): string[] {
  const out: string[] = []
  if (grao === 'dia') { for (let d = de; d <= ate; d = somaDias(d, 1)) out.push(d) } else { for (let d = segundaDe(de); d <= segundaDe(ate); d = somaDias(d, 7)) out.push(d) }
  return out
}

function pontosDaSeriePorMedida(s: Serie, canalId: string, apelido: string, p: { de: string; ate: string; grao: 'dia' | 'semana' }, hoje: string): PontoCsv[] {
  const { t, col, medida } = s
  const celulas = new Map<string, Celula>()
  t.linhas.forEach((l, i) => { const d = t.dias![i]!; const c = l[col]; if (c !== undefined && !celulas.has(d)) celulas.set(d, c) })
  const todos = [...celulas.keys()].sort()
  const tmin = todos[0]!
  const tmax = todos[todos.length - 1]!
  // início e fim da coleta: o MENOR e o MAIOR dia com leitura, pelas células de `dias` (a tabela vem do dia mais recente ao mais antigo: a posição não vale)
  const lidos = todos.filter((d) => temLeitura(celulas.get(d)))
  const inicio = lidos[0]
  const fimDaLeitura = lidos[lidos.length - 1]
  const privada = t.privada ? ({ privada: true } as const) : {}
  const ponto = (data: string, x: number | null, estado: PontoCsv['estado'], motivo: string | undefined, diasMedidos?: number): PontoCsv =>
    ({ data, canalId, apelido, medida, x, estado, ...(diasMedidos !== undefined ? { diasMedidos } : {}), ...(motivo !== undefined ? { motivo } : {}), ...privada })
  const semDia = p.grao === 'semana' ? 0 : undefined

  const de = p.grao === 'semana' ? segundaDe(p.de) : p.de
  const ate = p.grao === 'semana' ? somaDias(segundaDe(p.ate), 6) : p.ate
  if (ate < tmin || de > tmax) return [ponto(de, null, 'nao_medido', F.SERIE_A_TELA_COBRE(dmy(tmin), dmy(tmax)), semDia)]

  const semLeitura = (d: string): string =>
    inicio === undefined || fimDaLeitura === undefined ? F.SERIE_SEM_LEITURA_NENHUMA
      : d < inicio ? F.SERIE_ANTES_DA_COLETA(dmy(inicio))
        : d > fimDaLeitura ? F.SERIE_DEPOIS_DO_FIM(dmy(fimDaLeitura))
          : F.SERIE_SEM_LEITURA

  if (p.grao === 'dia') {
    return datasDoPedido(de, ate, 'dia').map((d): PontoCsv => {
      const c = celulas.get(d)
      if (c === undefined) return ponto(d, null, 'nao_medido', inicio === undefined ? F.SERIE_SEM_LEITURA_NENHUMA : d < tmin ? F.SERIE_FORA_DOS_90 : semLeitura(d))
      if (c.papel !== 'numero') return ponto(d, null, 'nao_medido', semLeitura(d))
      if (c.estado === 'medido' || c.estado === 'zero_medido') {
        const x = xDaCelula(c)
        return x === null ? ponto(d, null, 'falhou', F.MOTIVO_SEM_NUMERO_DE_MAQUINA) : ponto(d, x, c.estado, undefined)
      }
      if (c.estado === 'falhou' || c.estado === 'restrito') return ponto(d, null, c.estado, c.motivo)
      if (c.estado === 'nao_medido' && c.causa === 'diminuiu') return ponto(d, null, 'nao_medido', F.DIA_TOTAL_CORRIGIDO)
      return ponto(d, null, 'nao_medido', semLeitura(d))
    })
  }
  return datasDoPedido(de, ate, 'semana').map((segunda): PontoCsv => {
    const domingo = somaDias(segunda, 6)
    const nenhuma = (motivo: string): PontoCsv => ponto(segunda, null, 'nao_medido', motivo, 0)
    if (inicio === undefined || fimDaLeitura === undefined) return nenhuma(F.SERIE_SEM_LEITURA_NENHUMA)
    if (domingo < tmin) return nenhuma(F.SERIE_FORA_DOS_90)
    if (segunda > fimDaLeitura) return nenhuma(F.SERIE_DEPOIS_DO_FIM(dmy(fimDaLeitura)))
    if (domingo < inicio) return nenhuma(F.SERIE_ANTES_DA_COLETA(dmy(inicio)))
    const dias = todos.filter((d) => d >= segunda && d <= domingo).map((d) => ({ dia: d, celula: celulas.get(d)! }))
    const r = somaDaSemana(segunda, dias, hoje, regraDe(t))
    return ponto(segunda, r.x, estadoDaSoma(r.x), r.motivo === null ? undefined : frasesDoMotivo(r.motivo, segunda, r.diasMedidos), r.diasMedidos)
  })
}

/**
 * Os pontos da série de um canal (ou vídeo): data crescente, depois a medida na ordem das colunas. Só lê tabela `dia_a_dia` com `dias` (as demais saem da série).
 * Próprio sem o direito: uma linha `restrito` por dia (ou semana) pedido, sem número nenhum.
 */
export function pontosDaSerie(m: PacoteModelo, canalId: string, apelido: string, p: { de: string; ate: string; grao: 'dia' | 'semana' }, agora: number): PontoCsv[] {
  const hoje = hojeSp(agora)
  const series = seriesDe(m)
  const porSerie = series.map((s) => pontosDaSeriePorMedida(s, canalId, apelido, p, hoje))
  const negado = m.privado
  const restritos: PontoCsv[] = ehDoProprio(m) && negado.estado === 'excluido'
    ? datasDoPedido(p.grao === 'semana' ? segundaDe(p.de) : p.de, p.grao === 'semana' ? segundaDe(p.ate) : p.ate, p.grao).map((data): PontoCsv => ({
      data, canalId, apelido, medida: MEDIDA_RESTRITA, x: null, estado: 'restrito', motivo: textoDoPrivadoExcluido(negado), ...(p.grao === 'semana' ? { diasMedidos: 0 } : {}), privada: true,
    }))
    : []
  return [...porSerie.flat(), ...restritos]
    .map((pt, i) => ({ pt, i }))
    .sort((a, b) => (a.pt.data < b.pt.data ? -1 : a.pt.data > b.pt.data ? 1 : a.i - b.i))
    .map((x) => x.pt)
}

/* ------------------------------------------------------------------ o CSV */

/** O `N fora da soma` do próprio (o `responder` o lê do modelo INTEIRO, antes de reduzi-lo à série): o aviso do teto chega como frase (`foraDaLeituraFrase`); acha-se o `k` comparando com a frase, sem ler número do texto. */
export function foraDaSoma(m: PacoteModelo): number {
  const frases = new Set<string>()
  for (const t of m.tabelas) for (const l of t.linhas) for (const c of l) if (c.papel !== 'numero') frases.add(c.texto)
  for (const a of [...m.avisos, ...(m.avisosPrivados ?? [])]) frases.add(a)
  for (let k = 1; k <= 1000; k += 1) if (frases.has(foraDaLeituraFrase(k))) return k
  return 0
}

/** O dicionário de cada canal e medida: nome, o que a coluna mede e a base (que lê `Tabela.fuso`). */
export function infoDaSerie(m: PacoteModelo, canalId: string, apelido: string, fora = foraDaSoma(m)): CanalDaSerie {
  const medidas = seriesDe(m).map((s): CanalDaSerie['medidas'][number] => ({
    medida: s.medida, titulo: s.t.colunas[s.col] ?? s.medida,
    base: s.t.fuso === 'pacifico' ? F.SERIE_BASE_PROPRIO(s.medida === 'views' ? fora : 0) : F.SERIE_BASE_CONCORRENTE,
  }))
  if (ehDoProprio(m) && m.privado.estado === 'excluido') medidas.push({ medida: MEDIDA_RESTRITA, titulo: 'Views', base: F.SERIE_BASE_RESTRITA })
  return { apelido, canalId, nome: m.foco[0]?.nome ?? '', medidas }
}

/** O cabeçalho, as linhas e o dicionário de canais de um bloco CSV longo. `canais` leva nome e base; sem ele o dicionário só liga o apelido ao id. */
export function csvDaSerie(pontos: readonly PontoCsv[], grao: 'dia' | 'semana', legenda: Legenda, canais?: readonly CanalDaSerie[]): { cabecalho: string; linhas: string[]; dicionarioDeCanais: string[] } {
  const colunas = [grao === 'semana' ? 'semana_inicio' : 'dia', 'canal', 'medida', 'valor', 'estado', ...(grao === 'semana' ? ['dias_medidos'] : []), 'motivo_id']
  const linhas = pontos.map((p) => {
    const vazio = p.x === null || (p.estado !== 'medido' && p.estado !== 'zero_medido')
    const estadoVazio: EstadoVazio = p.estado === 'falhou' || p.estado === 'restrito' ? p.estado : p.x === null && (p.estado === 'medido' || p.estado === 'zero_medido') ? 'falhou' : 'nao_medido'
    const motivo = vazio ? legenda.idDe(estadoVazio, p.motivo ?? F.MOTIVO_SEM_NUMERO_DE_MAQUINA) : ''
    return [p.data, campoCsv(p.apelido), campoCsv(p.medida), vazio ? '' : numeroCsv(p.x!), p.estado, ...(grao === 'semana' ? [String(p.diasMedidos ?? '')] : []), motivo].join(',')
  })
  const lista = canais ?? [...new Map(pontos.map((p) => [p.apelido, { apelido: p.apelido, canalId: p.canalId, nome: '', medidas: [] as CanalDaSerie['medidas'] }])).values()]
  const dicionarioDeCanais = lista.flatMap((c) => [
    `- ${c.apelido}: ${c.canalId}${c.nome === '' ? '' : ` · ${naCelula(c.nome)}`}`,
    ...c.medidas.map((x) => `  - ${c.apelido} · ${x.medida}: ${x.titulo} · base: ${x.base}`),
  ])
  return { cabecalho: colunas.join(','), linhas, dicionarioDeCanais }
}

/* ------------------------------------------------------------------ a resposta inteira */

type Numeros = Cobertura['numeros']
export interface AvisoDaSerie { passo: string; extra?: Record<string, number | string> }
export interface RespostaDaSerie {
  /** Do cabeçalho ao último bloco fechado. Sem o topo do pedido e sem a Cobertura (quem chama põe). */
  texto: string
  primeira: string | null
  /** Linhas CSV entregues e as que a série tinha antes do corte. */
  pontos: number
  total: number
  de: string
  ate: string
  grao: 'dia' | 'semana'
  convertida: boolean
  cortes: number
  rotulos: string[]
  semX: number
  numeros: Numeros
  incluiuPrivado: boolean
  /** `nomeNoCorte` das tabelas `dia_a_dia` sem data de calendário (só no modo texto). */
  soNoTexto: string[]
  nenhumMedido: boolean
  avisos: AvisoDaSerie[]
}

const contar = (ps: readonly PontoCsv[]): Numeros => ({
  medidos: ps.filter((p) => p.estado === 'medido').length, zerosMedidos: ps.filter((p) => p.estado === 'zero_medido').length,
  naoMedidos: ps.filter((p) => p.estado === 'nao_medido').length, falhou: ps.filter((p) => p.estado === 'falhou').length, restrito: ps.filter((p) => p.estado === 'restrito').length,
  privadosMedidos: ps.filter((p) => p.privada === true && (p.estado === 'medido' || p.estado === 'zero_medido')).length,
})

/**
 * O modo tabela da `serie` de um canal. `m` é o modelo já reduzido à série (só tabelas `dia_a_dia`, sem comentário; `soASerie`), o MESMO objeto que vai a `segmentar`
 * (que lança com dado privado sem direito). `n` = pontos por canal; `teto` = caracteres do texto. O corte é por data inteira, das mais antigas.
 */
export function respostaDaSerieEmTabela(
  m: PacoteModelo, ctx: ContextoDoPacote, pedido: { canalId: string; apelido: string; de: string; ate: string; grao: 'dia' | 'semana'; foraDaSoma?: number }, n: number, teto: number,
): RespostaDaSerie {
  const pacote = segmentar(m, ctx)
  const avisos: AvisoDaSerie[] = []
  let grao = pedido.grao
  let convertida = false
  const diasPedidos = entre(pedido.de, pedido.ate) + 1
  let cortes = 0
  const extras: string[] = []
  if (grao === 'dia' && diasPedidos > n) { grao = 'semana'; convertida = true; cortes += 1; extras.push(F.SERIE_PASSOU_A_SEMANA(diasPedidos, n)) }
  const tudo = pontosDaSerie(m, pedido.canalId, pedido.apelido, { de: pedido.de, ate: pedido.ate, grao }, ctxAgora(ctx))
  const info = infoDaSerie(m, pedido.canalId, pedido.apelido, pedido.foraDaSoma)
  const de = grao === 'semana' ? segundaDe(pedido.de) : pedido.de
  const ate = grao === 'semana' ? somaDias(segundaDe(pedido.ate), 6) : pedido.ate
  if (grao === 'semana') extras.push(F.SERIE_REGRA_DA_SEMANA)

  const datas = [...new Set(tudo.map((p) => p.data))]
  const soNoTexto = m.tabelas.filter((t) => t.tipo === 'dia_a_dia' && !(diasValidos(t) && MEDIDAS_DA_TABELA[t.id] !== undefined)).map((t) => t.nomeNoCorte)
  for (const nome of soNoTexto) extras.push(`tabela "${nome}": ${F.SERIE_SEM_DATA}`)
  const nenhumMedido = tudo.length > 0 && !tudo.some((p) => p.estado === 'medido' || p.estado === 'zero_medido')
  const primeiraMinha = nenhumMedido ? F.SERIE_NENHUM_PONTO(dmy(de), dmy(ate)) : null

  const montar = (ficam: number): { texto: string; pontos: PontoCsv[] } => {
    const depois = new Set(datas.slice(Math.max(0, datas.length - ficam)))
    const ps = tudo.filter((p) => depois.has(p.data))
    const legenda = novaLegenda()
    const csv = csvDaSerie(ps, grao, legenda, [info])
    const avisosDoModelo = [...m.avisos, ...extras, ...(m.privado.estado === 'incluido' ? (m.avisosPrivados ?? []).map((a) => `${a}${F_MARCA}`) : [])]
    const cortou = ficam < datas.length
    const linhasAvisos = [...avisosDoModelo.map((a) => `- ${naCelula(a)}`), ...(cortou ? [`- ${F.SERIE_CORTADA(ps.length, tudo.length, grao)}`] : [])]
    const privada = ps.some((p) => p.privada === true)
    const colunas = grao === 'semana'
      ? ['semana_inicio', 'canal', 'medida', 'valor', 'estado', 'dias_medidos', 'motivo_id'] as const
      : ['dia', 'canal', 'medida', 'valor', 'estado', 'motivo_id'] as const
    const bloco = [
      `## Série ${grao === 'semana' ? 'por semana' : 'por dia'}`,
      ...(privada ? [F.TABELA_PRIVADA] : []),
      ...(grao === 'semana' ? [F.SERIE_TOPO_DAS_SEMANAS(dm(de), dm(ate))] : []),
      ...colunas.map((c) => F.dicionarioLinha(c, F.SERIE_DICIONARIO_COLUNAS[c])),
      ...csv.dicionarioDeCanais,
      F.graficoSugerido(F.FRASE_DO_GRAFICO.linha),
      '```csv', csv.cabecalho, ...csv.linhas, '```',
      F.SERIE_LINHAS(ps.length, tudo.length),
    ].join('\n')
    const partes = [
      ...(primeiraMinha ? [primeiraMinha] : []),
      ...pacote.segmentos.filter((x) => x.parte === 1).map((x) => x.texto),
      F.COMO_LER_TABELA,
      ...(m.privado.estado === 'excluido' ? [textoDoPrivadoExcluido(m.privado)] : []),
      ...(linhasAvisos.length > 0 ? [['## Avisos', ...linhasAvisos].join('\n')] : []),
      ...(legenda.linhas().length > 0 ? [legenda.linhas().join('\n')] : []),
      bloco,
    ]
    return { texto: partes.join('\n\n'), pontos: ps }
  }

  // o limite de pontos por canal (n datas) e o teto de caracteres: tira as datas mais antigas, em linhas inteiras (busca binária; o texto cresce com o número de datas)
  let ficam = Math.min(datas.length, n)
  let melhor = montar(ficam)
  if (melhor.texto.length > teto && ficam > 1) {
    let lo = 1
    let hi = ficam - 1
    let achou = 1
    while (lo <= hi) {
      const meio = (lo + hi) >> 1
      if (montar(meio).texto.length <= teto) { achou = meio; lo = meio + 1 } else hi = meio - 1
    }
    ficam = achou
    melhor = montar(ficam)
    avisos.push({ passo: 'serie_tabela_estourou' })
  }
  if (ficam < datas.length) cortes += 1
  const rotulos = ficam < datas.length ? [`${melhor.pontos.length} de ${tudo.length} linhas da série`] : []
  const semXn = tudo.filter((p) => p.motivo === F.MOTIVO_SEM_NUMERO_DE_MAQUINA).length
  if (semXn > 0) avisos.push({ passo: 'csv_sem_x', extra: { tabela: seriesDe(m)[0]?.t.id ?? '', n: semXn } })
  if (melhor.texto.length > teto) rotulos.push('o fim do texto')
  return {
    texto: melhor.texto, primeira: primeiraMinha ?? pacote.primeiraLinhaDeAviso, pontos: melhor.pontos.length, total: tudo.length, de, ate, grao, convertida, cortes,
    rotulos, semX: semXn, numeros: contar(melhor.pontos), incluiuPrivado: m.privado.estado === 'incluido', soNoTexto, nenhumMedido, avisos,
  }
}

const F_MARCA = F.MARCA_PRIVADO
const ctxAgora = (ctx: ContextoDoPacote): number => ctx.geradoEm
