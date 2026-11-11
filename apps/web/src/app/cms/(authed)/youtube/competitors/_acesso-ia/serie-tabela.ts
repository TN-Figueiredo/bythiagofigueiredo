// A5 F2a T9: a série de um canal em CSV longo (`saida: 'tabela'`). Puro: sem banco, sem relógio (o `agora` entra por parâmetro), sem Sentry (quem avisa é o `responder`,
// com os códigos que daqui saem em `avisos`). Lê o MESMO `PacoteModelo` que passa por `segmentar` (que lança com dado privado sem direito); a data de cada ponto é
// `Tabela.dias` (ISO), nunca o texto do rótulo. Aqui mora também `somaDaSemana`, a regra única da semana (texto e CSV).
import * as F from '@/lib/youtube/observatorio/contexto-ia/frases'
import { segmentar, textoDoPrivadoExcluido } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import { campoCsv, novaLegenda, numeroCsv, type EstadoVazio, type Legenda } from '@/lib/youtube/observatorio/contexto-ia/tabela-csv'
import { naCelula } from '@/lib/youtube/observatorio/contexto-ia/terceiros'
import { CONTEXTO_IA_RULES } from '@/lib/youtube/observatorio/contexto-ia/regras'
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
  /** Id da tabela de onde o ponto veio (o aviso `csv_sem_x` diz qual tabela falhou). */
  tabela?: string
  /** Linha-resumo ("a tela cobre de ... a ..."): não conta como ponto nem como número. */
  resumo?: true
}
export interface CanalDaSerie { apelido: string; canalId: string; nome: string; medidas: Array<{ medida: string; titulo: string; base: string }> }

/* ------------------------------------------------------------------ datas */

const DIA_MS = 86_400_000
const SP_MS = 3 * 3_600_000
export const isoDe = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
export const hojeSp = (agora: number): string => isoDe(agora - SP_MS)
/** O dia de hoje no Pacífico (o dia do YouTube; com horário de verão). `en-CA` formata `aaaa-mm-dd`. */
const FMT_PACIFICO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
export const hojePacifico = (agora: number): string => FMT_PACIFICO.format(new Date(agora))
const ms = (d: string): number => Date.parse(`${d}T00:00:00Z`)
export const somaDias = (d: string, n: number): string => isoDe(ms(d) + n * DIA_MS)
/** Segunda-feira da semana (segunda a domingo) do dia `AAAA-MM-DD`. */
export const segundaDe = (dia: string): string => somaDias(dia, -((new Date(ms(dia)).getUTCDay() + 6) % 7))
/** `dd/mm/aaaa` */
export const dmy = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const entre = (a: string, b: string): number => Math.round((ms(b) - ms(a)) / DIA_MS)
const maior = (a: string, b: string): string => (a > b ? a : b)
/** Domingo da semana de `d`, sem passar de 9999-12-31 (o ano 10000 vira `+010000-...` e quebra a comparação de texto). */
const domingoDe = (d: string): string => { const x = somaDias(segundaDe(d), 6); return x.startsWith('+') ? '9999-12-31' : x }
const menor = (a: string, b: string): string => (a < b ? a : b)
/** Quantas datas o pedido tem (aritmética; nunca percorre o intervalo, que pode chegar a 9999-12-31). */
const quantasDatas = (de: string, ate: string, grao: 'dia' | 'semana'): number =>
  ate < de ? 0 : grao === 'dia' ? entre(de, ate) + 1 : Math.round(entre(segundaDe(de), segundaDe(ate)) / 7) + 1

export const diaValido = (a: number, m: number, d: number): boolean => m >= 1 && m <= 12 && d >= 1 && new Date(Date.UTC(a, m - 1, d)).getUTCMonth() === m - 1 && new Date(Date.UTC(a, m - 1, d)).getUTCDate() === d
/** `AAAA-MM-DD` de um dia que existe no calendário. */
export const isoValido = (d: string): boolean => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d); return m !== null && diaValido(Number(m[1]), Number(m[2]), Number(m[3])) }

/** O dia de uma linha de `dia_a_dia`, lido do texto da 1ª célula (`dd/mm`, `dd/mm/aaaa`, `aaaa-mm-dd`, "hoje", "ontem"). Não leu: `null` (nunca chuta). */
export function diaDaLinha(linha: readonly Celula[], agora: number): string | null {
  const c = linha[0]
  if (!c || c.papel === 'numero') return null
  const t = c.texto.trim().toLowerCase()
  const hoje = hojeSp(agora)
  if (t === 'hoje') return hoje
  if (t === 'ontem') return isoDe(Date.parse(`${hoje}T00:00:00Z`) - 86_400_000)
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(t)
  if (m) return diaValido(Number(m[1]), Number(m[2]), Number(m[3])) ? `${m[1]}-${m[2]}-${m[3]}` : null
  m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/.exec(t)
  if (!m) return null
  const d = Number(m[1]), mes = Number(m[2])
  let ano = m[3] ? Number(m[3]) : Number(hoje.slice(0, 4))
  if (!diaValido(ano, mes, d)) return null
  let r = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  // sem ano: o dia mais recente que não está no futuro
  if (!m[3] && r > isoDe(Date.parse(`${hoje}T00:00:00Z`) + 86_400_000)) {
    ano -= 1
    if (!diaValido(ano, mes, d)) return null
    r = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return r
}

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

/** Colunas numéricas de cada tabela `dia_a_dia` com data que a série lê: coluna da tabela e a chave de máquina da medida. Segunda lista, que tem de casar com o empacotador (teste de inventário contra os empacotadores reais). */
export const MEDIDAS_DA_TABELA: Readonly<Record<string, ReadonlyArray<{ col: number; medida: string }>>> = {
  'canal-linha-do-tempo': [{ col: 1, medida: 'views_ganhas' }],
  'privado-views-por-dia': [{ col: 1, medida: 'views' }],
  'privado-views-por-dia-do-video': [{ col: 1, medida: 'views' }],
  'privado-impressoes-por-dia': [{ col: 1, medida: 'impressoes' }, { col: 2, medida: 'cliques_estimados' }],
  'privado-impressoes-por-dia-do-video': [{ col: 1, medida: 'impressoes' }, { col: 2, medida: 'cliques_estimados' }],
}
/** A base de cada tabela, por id: o que a coluna SOMA e em que fuso. Id fora do mapa = o canal concorrente (São Paulo). */
const BASE_DA_TABELA: Readonly<Record<string, (t: Tabela) => string>> = {
  'privado-views-por-dia': (t) => F.SERIE_BASE_PROPRIO(t.foraDoTeto ?? 0),
  'privado-views-por-dia-do-video': () => F.SERIE_BASE_VIDEO,
  'privado-impressoes-por-dia-do-video': () => F.SERIE_BASE_VIDEO,
  'privado-impressoes-por-dia': () => F.SERIE_BASE_ALCANCE_CANAL,
}
const MEDIDA_RESTRITA = 'views'

/** `dias`: o ISO de cada linha de `t.linhas` (ou `null` quando a linha não tem data que valha). `doTexto`: a data veio do texto da 1ª célula, não de `Tabela.dias`. */
interface Serie { t: Tabela; col: number; medida: string; dias: Array<string | null>; doTexto: boolean }
const ehDoProprio = (m: PacoteModelo): boolean => m.tela === 'canal-proprio' || m.tela === 'video-proprio'
/** O dado privado não foi liberado: a série do próprio sai `restrito`, e nenhuma tabela privada é lida (mesmo que alguém a entregue). */
const privadoNegado = (m: PacoteModelo): boolean => m.privado.estado !== 'incluido'

/** As datas de uma tabela: `Tabela.dias` quando vale (mesmo tamanho de `linhas`; entrada que não é dia do calendário vira `null`), senão o texto da 1ª célula, com aviso. */
function diasDaSerie(t: Tabela, agora: number): { dias: Array<string | null>; doTexto: boolean } {
  if (t.dias !== undefined && t.dias.length === t.linhas.length) return { dias: t.dias.map((d) => (isoValido(d) ? d : null)), doTexto: false }
  return { dias: t.linhas.map((l) => diaDaLinha(l, agora)), doTexto: true }
}

function seriesDe(m: PacoteModelo, agora: number): Serie[] {
  return m.tabelas
    .filter((t) => t.tipo === 'dia_a_dia' && MEDIDAS_DA_TABELA[t.id] !== undefined && !(t.privada && privadoNegado(m)))
    .flatMap((t) => { const d = diasDaSerie(t, agora); return MEDIDAS_DA_TABELA[t.id]!.map((c) => ({ t, col: c.col, medida: c.medida, ...d })) })
}
const regraDe = (t: Tabela): 'soma' | 'ultima' | null => (t.semana === 'soma' ? 'soma' : t.semana === 'ultima' ? 'ultima' : null)
const estadoDaSoma = (x: number | null): PontoCsv['estado'] => (x === null ? 'nao_medido' : x === 0 ? 'zero_medido' : 'medido')

function datasDoPedido(de: string, ate: string, grao: 'dia' | 'semana'): string[] {
  const out: string[] = []
  if (grao === 'dia') { for (let d = de; d <= ate; d = somaDias(d, 1)) out.push(d) } else { for (let d = segundaDe(de); d <= segundaDe(ate); d = somaDias(d, 7)) out.push(d) }
  return out
}

/** O menor dia com data de uma série (a borda de trás da janela que a tela guarda); `null` sem nenhum. */
const menorDia = (s: Serie): string | null => s.dias.reduce<string | null>((a, d) => (d !== null && (a === null || d < a) ? d : a), null)

function pontosDaSeriePorMedida(s: Serie, canalId: string, apelido: string, p: { de: string; ate: string; grao: 'dia' | 'semana' }, hoje: string, agora: number): PontoCsv[] {
  const { t, col, medida } = s
  const celulas = new Map<string, Celula>()
  t.linhas.forEach((l, i) => { const d = s.dias[i]; const c = l[col]; if (d != null && c !== undefined && !celulas.has(d)) celulas.set(d, c) })
  const todos = [...celulas.keys()].sort()
  const privada = t.privada ? ({ privada: true } as const) : {}
  const ponto = (data: string, x: number | null, estado: PontoCsv['estado'], motivo: string | undefined, diasMedidos?: number, resumo = false): PontoCsv =>
    ({ data, canalId, apelido, medida, x, estado, ...(diasMedidos !== undefined ? { diasMedidos } : {}), ...(motivo !== undefined ? { motivo } : {}), ...privada, tabela: t.id, ...(resumo ? { resumo: true as const } : {}) })
  const semDia = p.grao === 'semana' ? 0 : undefined

  const de = p.grao === 'semana' ? segundaDe(p.de) : p.de
  const ate = p.grao === 'semana' ? domingoDe(p.ate) : p.ate
  // nenhuma data que valha: uma linha-resumo, nunca crash nem chave vazia
  if (todos.length === 0) return [ponto(de, null, 'nao_medido', F.SERIE_SEM_LEITURA_NENHUMA, semDia, true)]
  const tmin = todos[0]!
  const tmax = todos[todos.length - 1]!
  // início e fim da coleta: o MENOR e o MAIOR dia com leitura, pelas células de `dias` (a tabela vem do dia mais recente ao mais antigo: a posição não vale)
  const lidos = todos.filter((d) => temLeitura(celulas.get(d)))
  const inicio = lidos[0]
  const fimDaLeitura = lidos[lidos.length - 1]
  const resumoDaTela = (data: string): PontoCsv => ponto(data, null, 'nao_medido', F.SERIE_A_TELA_COBRE(dmy(tmin), dmy(tmax)), semDia, true)
  // acessoir-14: no grão dia o fim da janela é o que vier por último entre o fim da tabela e hoje (o dado do próprio chega com 2 a 3 dias de atraso: esses dias saem `nao_medido`, um por dia)
  const limiteDeFrente = p.grao === 'dia' ? maior(tmax, hoje) : tmax
  if (ate < tmin || de > limiteDeFrente) return [resumoDaTela(de)]

  // o que está ANTES da tabela vira UMA linha-resumo (não uma linha por dia: de 0001-01-01 saíam 105 mil); a conversão para a semana também conta só o que a tabela tem
  const bordaDeTras = p.grao === 'semana' ? segundaDe(tmin) : tmin
  // o que está DEPOIS da tabela também (N-1): `ate` não tem teto; sem recorte, 9999-12-31 gerava milhares de linhas vazias e travava
  const bordaDeFrente = p.grao === 'semana' ? domingoDe(tmax) : limiteDeFrente
  const fora: PontoCsv[] = de < bordaDeTras
    ? [resumoDaTela(de)]
    : ate > bordaDeFrente ? [resumoDaTela(p.grao === 'semana' ? somaDias(segundaDe(tmax), 7) : somaDias(bordaDeFrente, 1))] : []
  const deDentro = maior(de, bordaDeTras)
  const ateDentro = menor(ate, bordaDeFrente)

  const semLeitura = (d: string): string =>
    inicio === undefined || fimDaLeitura === undefined ? F.SERIE_SEM_LEITURA_NENHUMA
      : d < inicio ? F.SERIE_ANTES_DA_COLETA(dmy(inicio))
        : d > fimDaLeitura ? F.SERIE_DEPOIS_DO_FIM(dmy(fimDaLeitura))
          : F.SERIE_SEM_LEITURA

  if (p.grao === 'dia') {
    // I2: o dia em curso (São Paulo no concorrente, Pacífico no canal próprio) sai vazio, como a semana aberta
    const pacifico = t.fuso === 'pacifico'
    const diaAberto = pacifico ? hojePacifico(agora) : hoje
    return [...fora, ...datasDoPedido(deDentro, ateDentro, 'dia').map((d): PontoCsv => {
      const c = celulas.get(d)
      if (d === diaAberto) return ponto(d, null, 'nao_medido', pacifico ? F.DIA_ABERTO_PACIFICO : F.DIA_ABERTO)
      if (c === undefined) return ponto(d, null, 'nao_medido', semLeitura(d))
      if (c.papel !== 'numero') return ponto(d, null, 'nao_medido', semLeitura(d))
      if (c.estado === 'medido' || c.estado === 'zero_medido') {
        const x = xDaCelula(c)
        return x === null ? ponto(d, null, 'falhou', F.MOTIVO_SEM_NUMERO_DE_MAQUINA) : ponto(d, x, c.estado, undefined)
      }
      if (c.estado === 'falhou' || c.estado === 'restrito') return ponto(d, null, c.estado, c.motivo)
      if (c.estado === 'nao_medido' && c.causa === 'diminuiu') return ponto(d, null, 'nao_medido', F.DIA_TOTAL_CORRIGIDO)
      return ponto(d, null, 'nao_medido', semLeitura(d))
    })]
  }
  return [...fora, ...datasDoPedido(deDentro, ateDentro, 'semana').map((segunda): PontoCsv => {
    const domingo = somaDias(segunda, 6)
    const nenhuma = (motivo: string): PontoCsv => ponto(segunda, null, 'nao_medido', motivo, 0)
    if (inicio === undefined || fimDaLeitura === undefined) return nenhuma(F.SERIE_SEM_LEITURA_NENHUMA)
    if (segunda > fimDaLeitura) return nenhuma(F.SERIE_DEPOIS_DO_FIM(dmy(fimDaLeitura)))
    if (domingo < inicio) return nenhuma(F.SERIE_ANTES_DA_COLETA(dmy(inicio)))
    const dias = todos.filter((d) => d >= segunda && d <= domingo).map((d) => ({ dia: d, celula: celulas.get(d)! }))
    const r = somaDaSemana(segunda, dias, hoje, regraDe(t))
    let motivo = r.motivo === null ? undefined : frasesDoMotivo(r.motivo, segunda, r.diasMedidos)
    if (r.motivo === 'dias_sem_leitura') {
      // a semana de borda diz a causa dos dias que faltam, com as mesmas frases do grão dia
      const causas = [
        ...(inicio > segunda && inicio > tmin ? [F.SERIE_ANTES_DA_COLETA(dmy(inicio))] : []),
        ...(tmin > segunda ? [F.SERIE_FORA_DOS_90] : []),
        ...(fimDaLeitura < domingo ? [F.SERIE_DEPOIS_DO_FIM(dmy(fimDaLeitura))] : []),
      ]
      if (causas.length > 0) motivo = `${motivo}; ${causas.join('; ')}`
    }
    return ponto(segunda, r.x, estadoDaSoma(r.x), motivo, r.diasMedidos)
  })]
}

/**
 * Os pontos da série de um canal (ou vídeo): data crescente, depois a medida na ordem das colunas. Só lê tabela `dia_a_dia` que está em `MEDIDAS_DA_TABELA` (as demais saem da série).
 * Próprio sem o direito: uma linha `restrito` por dia (ou semana) pedido, sem número nenhum.
 */
export function pontosDaSerie(m: PacoteModelo, canalId: string, apelido: string, p: { de: string; ate: string; grao: 'dia' | 'semana' }, agora: number): PontoCsv[] {
  const hoje = hojeSp(agora)
  const series = seriesDe(m, agora)
  const porSerie = series.map((s) => pontosDaSeriePorMedida(s, canalId, apelido, p, hoje, agora))
  const negado = m.privado
  // sem tabela para dar o fim, o teto é hoje (nunca um intervalo até 9999-12-31)
  const ateRestrito = menor(p.ate, hoje)
  const restritos: PontoCsv[] = ehDoProprio(m) && negado.estado === 'excluido'
    ? datasDoPedido(p.grao === 'semana' ? segundaDe(p.de) : p.de, p.grao === 'semana' ? segundaDe(ateRestrito) : ateRestrito, p.grao).map((data): PontoCsv => ({
      data, canalId, apelido, medida: MEDIDA_RESTRITA, x: null, estado: 'restrito', motivo: textoDoPrivadoExcluido(negado), ...(p.grao === 'semana' ? { diasMedidos: 0 } : {}), privada: true,
    }))
    : []
  return [...porSerie.flat(), ...restritos]
    .map((pt, i) => ({ pt, i }))
    .sort((a, b) => (a.pt.data < b.pt.data ? -1 : a.pt.data > b.pt.data ? 1 : a.i - b.i))
    .map((x) => x.pt)
}

/* ------------------------------------------------------------------ o CSV */

/** O dicionário de cada canal e medida: nome, o que a coluna mede e a base (por id da tabela; `Tabela.foraDoTeto` carrega o "N fora da soma"). `agora` só resolve "hoje"/"ontem" de tabela sem `dias`. */
export function infoDaSerie(m: PacoteModelo, canalId: string, apelido: string, agora: number): CanalDaSerie {
  const medidas = seriesDe(m, agora).map((s): CanalDaSerie['medidas'][number] => ({
    medida: s.medida, titulo: s.t.colunas[s.col] ?? s.medida, base: BASE_DA_TABELA[s.t.id]?.(s.t) ?? F.SERIE_BASE_CONCORRENTE,
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

/** A primeira linha da resposta, calculada sobre o que o CSV entrega (não sobre a tabela inteira): falha de leitura, depois "quase tudo não medido". Sem "seção 4": o modo tabela não tem. */
function avisoDoCsv(ps: readonly PontoCsv[]): string | null {
  const n = contar(ps)
  const total = n.medidos + n.zerosMedidos + n.naoMedidos + n.restrito
  if (n.falhou > 0) return F.SERIE_AVISO_FALHA(n.falhou)
  if (total >= 1 && (n.naoMedidos + n.restrito) / total >= CONTEXTO_IA_RULES.magroAPartirDe) return F.SERIE_AVISO_MAGRO(n.medidos + n.zerosMedidos, total)
  return null
}

/**
 * O modo tabela da `serie` de um canal. `m` é o modelo já reduzido à série (só tabelas `dia_a_dia`, sem comentário; `soASerie`), o MESMO objeto que vai a `segmentar`
 * (que lança com dado privado sem direito). `n` = pontos por canal; `teto` = caracteres do texto. O corte é por data inteira, das mais antigas.
 */
export function respostaDaSerieEmTabela(
  m: PacoteModelo, ctx: ContextoDoPacote, pedido: { canalId: string; apelido: string; de: string; ate: string; grao: 'dia' | 'semana' }, n: number, teto: number,
): RespostaDaSerie {
  const pacote = segmentar(m, ctx)
  const agora = ctxAgora(ctx)
  const avisos: AvisoDaSerie[] = []
  const series = seriesDe(m, agora)
  let grao = pedido.grao
  let convertida = false
  let cortes = 0
  const extras: string[] = []
  // a conversão para a semana conta os dias que a tabela TEM dentro do pedido (como o modo texto), não os dias pedidos
  const menores = series.map(menorDia).filter((d): d is string => d !== null)
  const diasPedidos = entre(pedido.de, pedido.ate) + 1
  const maiores = series.flatMap((s) => s.dias.filter((d): d is string => d !== null))
  const tmaxGeral = maiores.reduce((a, b) => (a > b ? a : b), '')
  const diasDentro = menores.length === 0 ? diasPedidos : entre(maior(pedido.de, menores.reduce((a, b) => (a < b ? a : b))), menor(pedido.ate, grao === 'dia' ? maior(tmaxGeral, hojeSp(agora)) : tmaxGeral)) + 1
  if (grao === 'dia' && diasDentro > n) { grao = 'semana'; convertida = true; cortes += 1; extras.push(F.SERIE_PASSOU_A_SEMANA(diasDentro, n)) }
  const tudo = pontosDaSerie(m, pedido.canalId, pedido.apelido, { de: pedido.de, ate: pedido.ate, grao }, agora)
  const info = infoDaSerie(m, pedido.canalId, pedido.apelido, agora)
  const de = grao === 'semana' ? segundaDe(pedido.de) : pedido.de
  const ate = grao === 'semana' ? domingoDe(pedido.ate) : pedido.ate
  if (grao === 'semana') extras.push(F.SERIE_REGRA_DA_SEMANA)

  // a data que veio do texto (a tabela perdeu `dias`) avisa o Sentry, uma vez por tabela; a linha sem data que valha fica fora e é dita
  for (const id of new Set(series.filter((s) => s.doTexto).map((s) => s.t.id))) {
    const s = series.find((x) => x.t.id === id)!
    const semData = s.dias.filter((d) => d === null).length
    avisos.push({ passo: 'dias_do_texto', extra: { tabela: id, ...(semData > 0 ? { sem_data: semData } : {}) } })
  }
  for (const id of new Set(series.map((s) => s.t.id))) {
    const s = series.find((x) => x.t.id === id)!
    const semData = s.dias.filter((d) => d === null).length
    if (semData > 0) extras.push(`tabela "${s.t.nomeNoCorte}": ${F.SERIE_DESCARTADAS(semData)}`)
  }
  // acessoir-14: o pedido passa do último dia com dado (até hoje): o aviso diz até onde vai o dado; as linhas dos dias que faltam já estão em `tudo`
  const ultimoComDado = tmaxGeral
  const pedidoAte = menor(pedido.ate, hojeSp(agora))
  if (grao === 'dia' && ultimoComDado !== '' && ultimoComDado < pedidoAte) extras.push(F.SERIE_PEDIDO_ATE_ONDE_HA_DADO(dmy(pedidoAte), dmy(ultimoComDado), ehDoProprio(m) ? 'do seu canal' : 'desta série'))
  const datas = [...new Set(tudo.filter((p) => p.resumo !== true).map((p) => p.data))]
  const soNoTexto = m.tabelas.filter((t) => t.tipo === 'dia_a_dia' && MEDIDAS_DA_TABELA[t.id] === undefined).map((t) => t.nomeNoCorte)
  for (const nome of soNoTexto) extras.push(`tabela "${nome}": ${F.SERIE_SEM_DATA}`)
  const nenhumMedido = tudo.length > 0 && !tudo.some((p) => p.estado === 'medido' || p.estado === 'zero_medido')
  const primeiraMinha = nenhumMedido ? F.SERIE_NENHUM_PONTO(dmy(de), dmy(ate)) : null
  const soResumo = tudo.length > 0 && tudo.every((p) => p.resumo === true)
  const semResumo = (ps: readonly PontoCsv[]): PontoCsv[] => ps.filter((p) => p.resumo !== true)
  // intervalo inteiro fora da tabela: "linhas: 0 de N" (N = datas pedidas); a linha-resumo não conta
  const total = soResumo ? quantasDatas(de, ate, grao) : semResumo(tudo).length
  const vazioDoPacote = m.vazio !== null

  const montar = (ficam: number): { texto: string; pontos: PontoCsv[]; contados: number } => {
    const depois = new Set(datas.slice(Math.max(0, datas.length - ficam)))
    const ps = tudo.filter((p) => p.resumo === true || depois.has(p.data))
    const contados = semResumo(ps).length
    const legenda = novaLegenda()
    const csv = csvDaSerie(ps, grao, legenda, [info])
    const avisosDoModelo = [...m.avisos, ...extras, ...(m.privado.estado === 'incluido' ? (m.avisosPrivados ?? []).map((a) => `${a}${F_MARCA}`) : [])]
    const cortou = ficam < datas.length
    const linhasAvisos = [...avisosDoModelo.map((a) => `- ${naCelula(a)}`), ...(cortou ? [`- ${F.SERIE_CORTADA(contados, total, grao)}`] : [])]
    const privada = ps.some((p) => p.privada === true && p.estado !== 'restrito') // I1: restrito não é dado privado
    const colunas = grao === 'semana'
      ? ['semana_inicio', 'canal', 'medida', 'valor', 'estado', 'dias_medidos', 'motivo_id'] as const
      : ['dia', 'canal', 'medida', 'valor', 'estado', 'motivo_id'] as const
    const bloco = [
      `## Série ${grao === 'semana' ? 'por semana' : 'por dia'}`,
      ...(privada ? [F.TABELA_PRIVADA, F.TABELA_PRIVADA_LGPD] : []),
      ...(grao === 'semana' ? [F.SERIE_TOPO_DAS_SEMANAS(dm(de), dm(ate))] : []),
      ...colunas.map((c) => F.dicionarioLinha(c, F.SERIE_DICIONARIO_COLUNAS[c])),
      ...csv.dicionarioDeCanais,
      F.graficoSugerido(F.FRASE_DO_GRAFICO.linha),
      '```csv', csv.cabecalho, ...csv.linhas, '```',
      F.SERIE_LINHAS(contados, total),
    ].join('\n')
    // a primeira linha é a do recorte (nenhum ponto medido, falha, magro); a do pacote (calculada sobre a tabela de 90 dias) sai da parte 1, menos a de tela vazia
    const minha = primeiraMinha ?? (vazioDoPacote ? null : avisoDoCsv(semResumo(ps)))
    const doPacote = pacote.primeiraLinhaDeAviso
    const parte1 = pacote.segmentos.filter((x) => x.parte === 1).map((x) => (!vazioDoPacote && doPacote !== null && x.texto.startsWith(doPacote) ? x.texto.slice(doPacote.length).replace(/^\n+/, '') : x.texto))
    const partes = [
      ...(minha ? [minha] : []),
      ...parte1,
      F.COMO_LER_TABELA,
      ...(m.privado.estado === 'excluido' ? [textoDoPrivadoExcluido(m.privado)] : []),
      ...(linhasAvisos.length > 0 ? [['## Avisos', ...linhasAvisos].join('\n')] : []),
      ...(legenda.linhas().length > 0 ? [legenda.linhas().join('\n')] : []),
      bloco,
    ]
    return { texto: partes.join('\n\n'), pontos: ps, contados }
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
  const rotulos = ficam < datas.length ? [`${melhor.contados} de ${total} linhas da série`] : []
  // o `x` que faltou, por tabela (o aviso diz qual tabela falhou)
  const semXPorTabela = new Map<string, number>()
  for (const p of tudo) if (p.motivo === F.MOTIVO_SEM_NUMERO_DE_MAQUINA) semXPorTabela.set(p.tabela ?? '', (semXPorTabela.get(p.tabela ?? '') ?? 0) + 1)
  for (const [tabela, k] of semXPorTabela) avisos.push({ passo: 'csv_sem_x', extra: { tabela, n: k } })
  const semXn = [...semXPorTabela.values()].reduce((a, b) => a + b, 0)
  if (melhor.texto.length > teto) rotulos.push('o fim do texto')
  const primeiraFinal = primeiraMinha ?? (vazioDoPacote ? pacote.primeiraLinhaDeAviso : avisoDoCsv(semResumo(melhor.pontos)))
  return {
    texto: melhor.texto, primeira: primeiraFinal, pontos: melhor.contados, total, de, ate, grao, convertida, cortes,
    rotulos, semX: semXn, numeros: contar(semResumo(melhor.pontos)), incluiuPrivado: m.privado.estado === 'incluido', soNoTexto, nenhumMedido, avisos,
  }
}

/* ------------------------------------------------------------------ A5 F2b: vários canais */

/** Um canal do pedido: lido (modelo reduzido à série), não encontrado ou não lido (o prazo acabou). `apelido` é `c1`, `c2`, … na ordem do pedido. */
export type CanalDaSerieMulti =
  | { tipo: 'lido'; apelido: string; canalId: string; m: PacoteModelo }
  | { tipo: 'nao_encontrado' | 'nao_lido'; apelido: string; canalId: string }

/** As linhas de um canal que não foi lido: uma `nao_medido` por data pedida até hoje (no máximo `n`, as mais recentes), com o motivo. Nunca o dado de outro canal. */
function pontosDoCanalAusente(c: Extract<CanalDaSerieMulti, { tipo: 'nao_encontrado' | 'nao_lido' }>, p: { de: string; ate: string; grao: 'dia' | 'semana' }, hoje: string, n: number): PontoCsv[] {
  const motivo = c.tipo === 'nao_encontrado' ? F.SERIE_CANAL_NAO_ENCONTRADO : F.SERIE_CANAL_NAO_LIDO
  const ate = menor(p.ate, hoje)
  const sem = p.grao === 'semana' ? { diasMedidos: 0 } : {}
  const linha = (data: string, resumo = false): PontoCsv => ({ data, canalId: c.canalId, apelido: c.apelido, medida: MEDIDA_RESTRITA, x: null, estado: 'nao_medido', motivo, ...sem, ...(resumo ? { resumo: true as const } : {}) })
  if (ate < p.de) return [linha(p.grao === 'semana' ? segundaDe(p.de) : p.de, true)]
  // só as `n` datas mais recentes: `de` pode ser 0001-01-01 e o laço nunca percorre o intervalo todo
  const deDentro = p.grao === 'semana' ? maior(segundaDe(p.de), somaDias(segundaDe(ate), -7 * (n - 1))) : maior(p.de, somaDias(ate, -(n - 1)))
  return datasDoPedido(deDentro, p.grao === 'semana' ? segundaDe(ate) : ate, p.grao).map((d) => linha(d))
}

export interface RespostaDaSerieMulti extends RespostaDaSerie {
  canaisLidos: number
  naoEncontrados: number
  naoLidos: number
}

/**
 * O modo tabela da `serie` de vários canais: um bloco de linhas por canal, na ordem do pedido (`c1`, `c2`, …), com o dicionário de cada canal e de cada base.
 * Os modelos lidos são os MESMOS objetos que passam por `segmentar` (que lança com dado privado sem direito). Canal não encontrado ou não lido: linhas
 * `nao_medido` com o motivo, nunca o dado de outro canal. O corte por tamanho tira as datas mais antigas de TODOS os canais por igual.
 */
export function respostaDaSerieDeCanais(
  canais: readonly CanalDaSerieMulti[], ctx: ContextoDoPacote, pedido: { de: string; ate: string; grao: 'dia' | 'semana' }, n: number, teto: number,
): RespostaDaSerieMulti {
  const agora = ctxAgora(ctx)
  const hoje = hojeSp(agora)
  const lidos = canais.filter((c): c is Extract<CanalDaSerieMulti, { tipo: 'lido' }> => c.tipo === 'lido')
  // o MESMO objeto vai a `segmentar` (lança com privado sem direito) e ao gerador
  for (const c of lidos) segmentar(c.m, ctx)
  const avisos: AvisoDaSerie[] = []
  const seriesPorCanal = new Map(lidos.map((c) => [c.apelido, seriesDe(c.m, agora)] as const))
  const todasAsSeries = [...seriesPorCanal.values()].flat()
  let grao = pedido.grao
  let convertida = false
  let cortes = 0
  const extras: string[] = []
  const menores = todasAsSeries.map(menorDia).filter((d): d is string => d !== null)
  const tmaxGeral = todasAsSeries.flatMap((s) => s.dias.filter((d): d is string => d !== null)).reduce((a, b) => (a > b ? a : b), '')
  const ateDoPedido = menor(pedido.ate, grao === 'dia' ? maior(tmaxGeral, hoje) : tmaxGeral === '' ? hoje : tmaxGeral)
  const diasDentro = menores.length === 0 ? Math.max(0, entre(pedido.de, menor(pedido.ate, hoje)) + 1) : entre(maior(pedido.de, menores.reduce((a, b) => (a < b ? a : b))), ateDoPedido) + 1
  if (grao === 'dia' && diasDentro > n) { grao = 'semana'; convertida = true; cortes += 1; extras.push(F.SERIE_PASSOU_A_SEMANA(diasDentro, n)) }
  const p = { de: pedido.de, ate: pedido.ate, grao }
  const de = grao === 'semana' ? segundaDe(pedido.de) : pedido.de
  const ate = grao === 'semana' ? domingoDe(pedido.ate) : pedido.ate
  if (grao === 'semana') extras.push(F.SERIE_REGRA_DA_SEMANA)

  const porCanal: Array<{ canal: CanalDaSerieMulti; pontos: PontoCsv[] }> = canais.map((c) => ({
    canal: c,
    pontos: c.tipo === 'lido' ? pontosDaSerie(c.m, c.canalId, c.apelido, p, agora) : pontosDoCanalAusente(c, p, hoje, n),
  }))
  const tudo = porCanal.flatMap((x) => x.pontos)
  const infos: CanalDaSerie[] = canais.map((c) => (c.tipo === 'lido' ? infoDaSerie(c.m, c.canalId, c.apelido, agora) : { apelido: c.apelido, canalId: c.canalId, nome: '', medidas: [] }))

  // por canal: a data que veio do texto, as linhas sem data, o atraso do dado e as tabelas só do modo texto (o apelido abre cada frase)
  const soNoTexto: string[] = []
  for (const c of lidos) {
    const series = seriesPorCanal.get(c.apelido)!
    for (const id of new Set(series.filter((s) => s.doTexto).map((s) => s.t.id))) {
      const s = series.find((x) => x.t.id === id)!
      const semData = s.dias.filter((d) => d === null).length
      avisos.push({ passo: 'dias_do_texto', extra: { tabela: id, ...(semData > 0 ? { sem_data: semData } : {}) } })
    }
    for (const id of new Set(series.map((s) => s.t.id))) {
      const s = series.find((x) => x.t.id === id)!
      const semData = s.dias.filter((d) => d === null).length
      if (semData > 0) extras.push(`${c.apelido}: tabela "${s.t.nomeNoCorte}": ${F.SERIE_DESCARTADAS(semData)}`)
    }
    const ultimo = series.flatMap((s) => s.dias.filter((d): d is string => d !== null)).reduce((a, b) => (a > b ? a : b), '')
    const pedidoAte = menor(pedido.ate, hoje)
    if (grao === 'dia' && ultimo !== '' && ultimo < pedidoAte) extras.push(`${c.apelido}: ${F.SERIE_PEDIDO_ATE_ONDE_HA_DADO(dmy(pedidoAte), dmy(ultimo), ehDoProprio(c.m) ? 'do seu canal' : 'desta série')}`)
    for (const t of c.m.tabelas.filter((x) => x.tipo === 'dia_a_dia' && MEDIDAS_DA_TABELA[x.id] === undefined)) {
      soNoTexto.push(t.nomeNoCorte)
      extras.push(`${c.apelido}: tabela "${t.nomeNoCorte}": ${F.SERIE_SEM_DATA}`)
    }
  }
  const datas = [...new Set(tudo.filter((x) => x.resumo !== true).map((x) => x.data))].sort()
  const nenhumMedido = tudo.length > 0 && !tudo.some((x) => x.estado === 'medido' || x.estado === 'zero_medido')
  const primeiraMinha = nenhumMedido ? F.SERIE_NENHUM_PONTO_CANAIS(dmy(de), dmy(ate)) : null
  const semResumo = (ps: readonly PontoCsv[]): PontoCsv[] => ps.filter((x) => x.resumo !== true)
  const soResumo = tudo.length > 0 && tudo.every((x) => x.resumo === true)
  const total = soResumo ? quantasDatas(de, ate, grao) * canais.length : semResumo(tudo).length
  const temProprio = lidos.some((c) => ehDoProprio(c.m))
  const temConcorrente = lidos.some((c) => !ehDoProprio(c.m))

  const montar = (ficam: number): { texto: string; pontos: PontoCsv[]; contados: number } => {
    const depois = new Set(datas.slice(Math.max(0, datas.length - ficam)))
    const ps = tudo.filter((x) => x.resumo === true || depois.has(x.data))
    const contados = semResumo(ps).length
    const legenda = novaLegenda()
    const csv = csvDaSerie(ps, grao, legenda, infos)
    const avisosDosModelos = lidos.flatMap((c) => [
      ...c.m.avisos.map((a) => `${c.apelido}: ${a}`),
      ...(c.m.privado.estado === 'incluido' ? (c.m.avisosPrivados ?? []).map((a) => `${c.apelido}: ${a}${F_MARCA}`) : []),
    ])
    const cortou = ficam < datas.length
    const linhasAvisos = [...[...avisosDosModelos, ...extras].map((a) => `- ${naCelula(a)}`), ...(cortou ? [`- ${F.SERIE_CORTADA(contados, total, grao)}`] : [])]
    const privada = ps.some((x) => x.privada === true && x.estado !== 'restrito') // restrito não é dado privado
    const colunas = grao === 'semana'
      ? ['semana_inicio', 'canal', 'medida', 'valor', 'estado', 'dias_medidos', 'motivo_id'] as const
      : ['dia', 'canal', 'medida', 'valor', 'estado', 'motivo_id'] as const
    const bloco = [
      `## Série ${grao === 'semana' ? 'por semana' : 'por dia'} de ${canais.length} ${canais.length === 1 ? 'canal' : 'canais'}`,
      ...(privada ? [F.TABELA_PRIVADA, F.TABELA_PRIVADA_LGPD] : []),
      ...(grao === 'semana' ? [F.SERIE_TOPO_DAS_SEMANAS(dm(de), dm(ate))] : []),
      ...colunas.map((c) => F.dicionarioLinha(c, F.SERIE_DICIONARIO_COLUNAS[c])),
      ...csv.dicionarioDeCanais,
      F.graficoSugerido(F.FRASE_DO_GRAFICO.linha),
      '```csv', csv.cabecalho, ...csv.linhas, '```',
      F.SERIE_LINHAS(contados, total),
    ].join('\n')
    const minha = primeiraMinha ?? avisoDoCsv(semResumo(ps))
    const partes = [
      ...(minha ? [minha] : []),
      `# Observatório · série de ${canais.length} ${canais.length === 1 ? 'canal' : 'canais'}`,
      ...(temProprio && temConcorrente ? [F.SERIE_BASES_DIFERENTES] : []),
      F.COMO_LER_TABELA,
      ...lidos.flatMap((c) => (c.m.privado.estado === 'excluido' ? [textoDoPrivadoExcluido(c.m.privado)] : [])),
      ...(linhasAvisos.length > 0 ? [['## Avisos', ...linhasAvisos].join('\n')] : []),
      ...(legenda.linhas().length > 0 ? [legenda.linhas().join('\n')] : []),
      bloco,
    ]
    return { texto: partes.join('\n\n'), pontos: ps, contados }
  }

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
  const rotulos = ficam < datas.length ? [`${melhor.contados} de ${total} linhas da série`] : []
  const semXPorTabela = new Map<string, number>()
  for (const x of tudo) if (x.motivo === F.MOTIVO_SEM_NUMERO_DE_MAQUINA) semXPorTabela.set(x.tabela ?? '', (semXPorTabela.get(x.tabela ?? '') ?? 0) + 1)
  for (const [tabela, k] of semXPorTabela) avisos.push({ passo: 'csv_sem_x', extra: { tabela, n: k } })
  const semXn = [...semXPorTabela.values()].reduce((a, b) => a + b, 0)
  if (melhor.texto.length > teto) rotulos.push('o fim do texto')
  const primeiraFinal = primeiraMinha ?? avisoDoCsv(semResumo(melhor.pontos))
  return {
    texto: melhor.texto, primeira: primeiraFinal, pontos: melhor.contados, total, de, ate, grao, convertida, cortes, rotulos, semX: semXn,
    numeros: contar(semResumo(melhor.pontos)), incluiuPrivado: lidos.some((c) => c.m.privado.estado === 'incluido'), soNoTexto, nenhumMedido, avisos,
    canaisLidos: lidos.length, naoEncontrados: canais.filter((c) => c.tipo === 'nao_encontrado').length, naoLidos: canais.filter((c) => c.tipo === 'nao_lido').length,
  }
}

const F_MARCA = F.MARCA_PRIVADO
const ctxAgora = (ctx: ContextoDoPacote): number => ctx.geradoEm
