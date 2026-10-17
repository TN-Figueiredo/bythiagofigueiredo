// E5a Tarefa 18: a Linha do tempo (views por dia e o que mudou). Puro: relógio e dados entram por parâmetro.
// As duas somas da frase são `m3a.ganhoRecente` e `m3a.ganhoAnterior`, os mesmos números do percentual do cabeçalho (emenda 13/10,
// resposta 1: d:I11): um dia sem retrato ou em que o total diminuiu fica fora das barras e dentro dessas somas. O percentual NÃO é recalculado.
import type { Fmt } from '@/lib/youtube/observatorio/fmt'
import type { RetratoDoCanal } from '@/lib/youtube/observatorio/medidas/direcao'
import type { MedidasDoCanal } from '@/lib/youtube/observatorio/medidas/do-canal'
import { baseDaIdade } from '@/lib/youtube/observatorio/medidas/m1'
import type { MudancaLida, VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { INICIO_DAS_MARCAS, somaDias } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { linhaDeCorteNaJanela } from '@/lib/youtube/observatorio/medidas-telas/calendario-das-paginas'
import { direcaoExibida, pctDosGanhos, type SimboloDeDirecao } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'
import { ganhosPorDia } from '@/lib/youtube/observatorio/medidas-telas/ganho-por-dia'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import type { FormatoDoCanal } from './cabecalho-model'
import type { EstadoDaPagina } from './estado-model'
import { dias as diasEntre, dm, ptn } from './formatos'
import { tetoRedondo } from './lancamentos-model'

export const DIAS_DA_LINHA = 90
const JANELA = MEASURE_RULES.direction.windowDays

export type SituacaoDoDia = 'com' | 'zero' | 'sem_registro' | 'diminuiu' | 'fora'
export interface DiaDaLinha { dia: string; situacao: SituacaoDoDia; ganho: number | null; fala: string; tabela: { views: string; situacao: string; aconteceu: string } }
export type FormaDaMarca = 'longo' | 'short' | 'campo' | 'titulo' | 'miniatura'
export interface MarcaDaLinha { indice: number; raia: 'videos' | 'campos' | 'trocas'; forma: FormaDaMarca; texto: string }
export interface TrechoDaLinha { de: number; ate: number; tipo: 'sem_registro' | 'diminuiu' | 'fora'; rotulo: string }
export type RaiaDaLinha = { tipo: 'marcas'; marcas: MarcaDaLinha[] } | { tipo: 'nao_carregou' }

export interface TrocaDoMotor { videoId: string; campo: 'titulo' | 'miniatura'; emMs: number }
export interface MudancaDoMotor extends TrocaDoMotor { ordem: number | null }

export type BarrasDaLinha =
  | {
    tipo: 'dias'; dias: DiaDaLinha[]; ymax: number; rotulos: [string, string, string]; trechos: TrechoDaLinha[]
    corte: { indice: number; dia: string } | null; nota: string | null
  }
  | { tipo: 'sem_registro'; motivo: string }
  | { tipo: 'nao_carregou'; motivo: string }

export interface LinhaDoTempo {
  frase: { simbolo: SimboloDeDirecao | null; negrito: string; resto: string }
  barras: BarrasDaLinha
  raias: Record<'videos' | 'campos' | 'trocas', RaiaDaLinha>
  legenda: Array<{ chave: string; texto: string }>
  /** Os dias do mais recente ao mais antigo, para "Ver como tabela". */
  tabela: Array<[string, string, string, string]>
}

export interface EntradaDaLinhaDoTempo {
  F: Pick<Fmt, 'num'>
  medidas: MedidasDoCanal | null
  /** Nulo = os retratos não carregaram. */
  retratos: readonly RetratoDoCanal[] | null
  videos: readonly VideoLido[] | null
  /** Nulo = o histórico de campos não carregou. */
  mudancas: ReadonlyMap<string, MudancaLida[]> | null
  /** Nulo = as trocas do motor não carregaram. */
  trocas: readonly TrocaDoMotor[] | null
  titulos: ReadonlyMap<string, string>
  estado: EstadoDaPagina
  formato: FormatoDoCanal
  /** O dia (SP) em que o canal saiu do YouTube. */
  foraEm: string | null
  hojeSP: string
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const diaCurto = (d: string): string => `${SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${dm(d)}`
const pt = (n: number): string => n.toLocaleString('pt-BR')

const ARTIGO_DO_CAMPO: Record<string, string> = { descricao: 'a descrição', tags: 'as tags', categoria: 'a categoria', duracao: 'a duração', idioma: 'o idioma' }
const NOME_DO_CAMPO: Record<string, string> = { descricao: 'descrição', tags: 'tags', categoria: 'categoria', duracao: 'duração', idioma: 'idioma' }

export function linhaDoTempo(o: EntradaDaLinhaDoTempo): LinhaDoTempo {
  const f = o.formato
  const titulo = (id: string): string => o.titulos.get(id) ?? '(sem título)'
  const ate = o.estado.ate
  const nc = (motivo: string): LinhaDoTempo => ({
    frase: { simbolo: null, negrito: 'Não carregou:', resto: ` ${motivo}` },
    barras: { tipo: 'nao_carregou', motivo }, raias: raiasVazias('nao_carregou'), legenda: [], tabela: [],
  })
  void ate

  // ── os retratos e a janela de 90 dias, que termina no último retrato com views ──
  if (o.retratos === null) {
    const base = nc('os retratos do canal não carregaram agora.')
    return { ...base, raias: marcasDasRaias(o, null) }
  }
  const comViews = o.retratos.filter(r => typeof r.views === 'number' && Number.isFinite(r.views)).map(r => r.dia).sort()
  const primeiro = comViews[0] ?? null
  const ultimoRetrato = comViews[comViews.length - 1] ?? null
  if (primeiro === null || ultimoRetrato === null) {
    return {
      frase: { simbolo: null, negrito: 'Ainda não há leitura de views deste canal:', resto: ' as barras aparecem quando houver dois dias seguidos de leitura.' },
      barras: { tipo: 'sem_registro', motivo: 'ainda não há leitura de views deste canal' },
      raias: marcasDasRaias(o, null), legenda: [], tabela: [],
    }
  }
  const saiu = o.estado.tipo === 'saiu'
  const fim = saiu ? o.hojeSP : ultimoRetrato
  const de = somaDias(fim, -(DIAS_DA_LINHA - 1))
  const ganhos = ganhosPorDia(o.retratos, de, fim)
  const eventos = eventosPorDia(o, de, fim)

  const dias: DiaDaLinha[] = ganhos.map((g, k) => {
    const ev = eventos.get(g.dia) ?? []
    const aconteceu = ev.map(e => e.texto).join('; ')
    const situacao: SituacaoDoDia = saiu && o.foraEm !== null && g.dia > o.foraEm ? 'fora'
      : g.tipo === 'medido' ? (g.ganho === 0 ? 'zero' : 'com') : g.tipo === 'diminuiu' ? 'diminuiu' : 'sem_registro'
    const ganho = situacao === 'com' || situacao === 'zero' ? (g as { ganho: number }).ganho : null
    const texto = situacao === 'fora' ? 'depois que o canal saiu do YouTube'
      : situacao === 'sem_registro' ? 'sem leitura neste dia'
      : situacao === 'diminuiu' ? 'o total de views diminuiu neste dia, então não há ganho a mostrar (o YouTube às vezes corrige a conta)'
      : situacao === 'zero' ? 'nenhuma view ganha (zero medido)' : `${o.F.num(ganho)} views ganhas`
    void k
    return {
      dia: g.dia, situacao, ganho,
      fala: `${diaCurto(g.dia)}: ${texto}${aconteceu ? `. ${aconteceu}.` : '.'}`,
      tabela: {
        views: ganho === null ? 'sem registro' : pt(ganho),
        situacao: situacao === 'com' ? 'com views' : situacao === 'zero' ? 'zero medido' : situacao === 'fora' ? 'saiu do YouTube' : situacao === 'diminuiu' ? 'o total diminuiu' : 'sem registro',
        aconteceu,
      },
    }
  })

  const trechos: TrechoDaLinha[] = []
  for (let i = 0; i < dias.length;) {
    const s = dias[i]!.situacao
    if (s !== 'sem_registro' && s !== 'fora' && s !== 'diminuiu') { i++; continue }
    let j = i
    while (j + 1 < dias.length && dias[j + 1]!.situacao === s) j++
    trechos.push({ de: i, ate: j, tipo: s, rotulo: s === 'fora' ? `saiu do YouTube${o.foraEm ? ` em ${dm(o.foraEm)}` : ''}` : s === 'diminuiu' ? 'o total diminuiu' : 'sem registro' })
    i = j + 1
  }
  const corteDia = linhaDeCorteNaJanela(de, fim)
  const corte = corteDia === null ? null : { indice: dias.findIndex(d => d.dia === corteDia), dia: corteDia }
  const mx = Math.max(10, ...dias.map(d => d.ganho ?? 0))
  const ymax = tetoRedondo(mx * 1.05)
  const barras: BarrasDaLinha = {
    tipo: 'dias', dias, ymax, rotulos: [o.F.num(0), o.F.num(ymax / 2), o.F.num(ymax)], trechos,
    corte: corte && corte.indice >= 0 ? corte : null, nota: null,
  }

  // ── a janela de 28 dias da frase ──
  const jan = dias.filter(d => d.dia > somaDias(fim, -JANELA) && d.dia <= fim)
  const semRegistro = jan.filter(d => d.situacao === 'sem_registro').length
  const diminuiram = jan.filter(d => d.situacao === 'diminuiu').length
  const vistas = jan.reduce((t, d) => t + (d.ganho ?? 0), 0)
  const m3a = o.medidas?.m3a ?? null
  const nota = semRegistro + diminuiram > 0 ? foraDasBarras(semRegistro, diminuiram) : null
  barras.nota = nota

  const nesseTempo = nesseTempoDe(o, jan, primeiro, fim)
  const sufixoErro = o.estado.tipo === 'erro' && o.estado.ate ? ` A linha termina em ${dm(o.estado.ate)}, quando a leitura parou.` : ''
  const cobertos = jan.filter(d => d.situacao === 'com' || d.situacao === 'zero' || d.situacao === 'diminuiu').length
  let frase: LinhaDoTempo['frase']
  if (primeiro > somaDias(fim, -JANELA)) {
    // menos de 28 dias de registro: a frase diz os dias reais e a data em que a janela completa
    frase = {
      simbolo: null,
      negrito: `${pt(vistas)} views ganhas em ${ptn(cobertos, 'dia', 'dias')} de registro`,
      resto: ` (a janela de ${JANELA} dias completa em ${dm(somaDias(primeiro, JANELA))}), sem os ${JANELA} anteriores para comparar. Nesse tempo: ${nesseTempo}${nota ? ` ${nota}` : ''}${sufixoErro}`,
    }
  } else if (m3a && m3a.estado === 'medido') {
    const { ganhoRecente, ganhoAnterior } = m3a.valor
    const pct = pctDosGanhos(ganhoRecente, ganhoAnterior)
    const x = pct === null ? null : direcaoExibida(pct / 100)
    frase = {
      simbolo: x?.simbolo ?? null,
      negrito: `${pt(ganhoRecente)} views ganhas em ${JANELA} dias, contra ${pt(ganhoAnterior)} nos ${JANELA} anteriores${x ? ` (${x.texto})` : ''}.`,
      resto: ` Nesse tempo: ${nesseTempo}${nota ? ` ${nota}` : ''}${sufixoErro}`,
    }
  } else {
    frase = {
      simbolo: null,
      negrito: `${pt(vistas)} views ganhas em ${JANELA} dias`,
      resto: `, sem os ${JANELA} anteriores para comparar. Nesse tempo: ${nesseTempo}${nota ? ` ${nota}` : ''}${sufixoErro}`,
    }
  }

  const temTroca = (t: 'titulo' | 'miniatura') => (o.trocas ?? []).some(x => x.campo === t)
  const legenda = [
    { chave: 'com', texto: 'dia com views' }, { chave: 'zero', texto: 'zero medido' }, { chave: 'sem_registro', texto: 'sem registro' },
    ...(diminuiram + dias.filter(d => d.situacao === 'diminuiu').length > 0 ? [{ chave: 'diminuiu', texto: 'o total diminuiu' }] : []),
    ...(saiu ? [{ chave: 'fora', texto: 'depois que saiu do YouTube' }] : []),
    { chave: 'longo', texto: 'vídeo publicado' }, { chave: 'short', texto: 'Short publicado' }, { chave: 'campo', texto: 'mudança de campo' },
    ...(temTroca('titulo') ? [{ chave: 'titulo', texto: 'troca de título' }] : []), ...(temTroca('miniatura') ? [{ chave: 'miniatura', texto: 'troca de miniatura' }] : []),
    ...(barras.corte ? [{ chave: 'corte', texto: `${dm(MEASURE_RULES.countChange)}: o YouTube mudou a contagem` }] : []),
  ]
  void f
  return {
    frase, barras, raias: marcasDasRaias(o, { de, fim, dias }), legenda,
    tabela: dias.slice().reverse().map(d => [dm(d.dia), d.tabela.views, d.tabela.situacao, d.tabela.aconteceu]),
  }
}

function raiasVazias(t: 'nao_carregou'): LinhaDoTempo['raias'] {
  return { videos: { tipo: t }, campos: { tipo: t }, trocas: { tipo: t } }
}

function foraDasBarras(semRegistro: number, diminuiram: number): string {
  const partes: string[] = []
  if (semRegistro > 0) partes.push(ptn(semRegistro, 'dia sem registro', 'dias sem registro'))
  if (diminuiram > 0) partes.push(ptn(diminuiram, 'dia em que o total diminuiu', 'dias em que o total diminuiu'))
  const so = semRegistro + diminuiram === 1
  return `${partes.join(' e ')}: o ganho ${so ? 'dele' : 'deles'} está no total, não nas barras.`
}

interface Evento { tipo: 'pub' | 'campo' | 'troca'; texto: string; forma: FormaDaMarca; raia: MarcaDaLinha['raia'] }

/** As ordens entre as trocas de um mesmo vídeo (só quando o vídeo tem duas ou mais). */
function ordemDasTrocas(trocas: readonly TrocaDoMotor[]): Map<TrocaDoMotor, number | null> {
  const por = new Map<string, TrocaDoMotor[]>()
  for (const t of trocas) por.set(t.videoId, [...(por.get(t.videoId) ?? []), t])
  const out = new Map<TrocaDoMotor, number | null>()
  for (const lista of por.values()) {
    lista.sort((a, b) => a.emMs - b.emMs)
    lista.forEach((t, i) => out.set(t, lista.length >= 2 ? i + 1 : null))
  }
  return out
}

function eventosPorDia(o: EntradaDaLinhaDoTempo, de: string, fim: string): Map<string, Evento[]> {
  const out = new Map<string, Evento[]>()
  const poe = (dia: string, e: Evento): void => { if (dia >= de && dia <= fim) out.set(dia, [...(out.get(dia) ?? []), e]) }
  const titulo = (id: string): string => o.titulos.get(id) ?? '(sem título)'
  for (const v of o.videos ?? []) {
    if (v.liveBroadcastContent === 'upcoming') continue
    const base = baseDaIdade(v)
    if (base === null || (v.isShort !== true && v.isShort !== false)) continue
    poe(spDateOf(base), { tipo: 'pub', raia: 'videos', forma: v.isShort ? 'short' : 'longo', texto: `Publicou ${v.isShort ? 'o Short' : 'o vídeo'} “${titulo(v.id)}”` })
  }
  for (const [id, lista] of o.mudancas ?? []) {
    for (const m of lista) {
      if (m.campo === 'titulo' || m.campo === 'miniatura') continue // são as trocas, que vêm do motor
      poe(spDateOf(m.em), { tipo: 'campo', raia: 'campos', forma: 'campo', texto: `Mudou ${ARTIGO_DO_CAMPO[m.campo] ?? m.campo} de “${titulo(id)}”` })
    }
  }
  const ordens = ordemDasTrocas(o.trocas ?? [])
  for (const t of o.trocas ?? []) {
    const n = ordens.get(t) ?? null
    poe(spDateOf(t.emMs), {
      tipo: 'troca', raia: 'trocas', forma: t.campo,
      texto: `${t.campo === 'titulo' ? 'Trocou o título' : 'Trocou a miniatura'} de “${titulo(t.videoId)}”${n ? ` (troca ${n})` : ''}`,
    })
  }
  return out
}

function marcasDasRaias(o: EntradaDaLinhaDoTempo, j: { de: string; fim: string; dias: DiaDaLinha[] } | null): LinhaDoTempo['raias'] {
  const raias: LinhaDoTempo['raias'] = {
    videos: o.videos === null ? { tipo: 'nao_carregou' } : { tipo: 'marcas', marcas: [] },
    campos: o.mudancas === null ? { tipo: 'nao_carregou' } : { tipo: 'marcas', marcas: [] },
    trocas: o.trocas === null ? { tipo: 'nao_carregou' } : { tipo: 'marcas', marcas: [] },
  }
  if (j === null) return raias
  const indice = new Map(j.dias.map((d, k) => [d.dia, k]))
  for (const [dia, evs] of eventosPorDia(o, j.de, j.fim)) {
    const k = indice.get(dia)
    if (k === undefined) continue
    for (const e of evs) {
      const raia = raias[e.raia]
      if (raia.tipo === 'marcas') raia.marcas.push({ indice: k, raia: e.raia, forma: e.forma, texto: e.texto })
    }
  }
  return raias
}

/** "17 publicações, 1 mudança de campo e 1 troca", com o piso e o "não medido antes de dd/mm" onde o registro de campos não cobre a janela. */
function nesseTempoDe(o: EntradaDaLinhaDoTempo, jan: DiaDaLinha[], regDesde: string, fim: string): string {
  const primeiroDaJanela = jan[0]?.dia ?? fim
  const evs = (tipo: Evento['tipo']): Array<{ dia: string; e: Evento }> => {
    const out: Array<{ dia: string; e: Evento }> = []
    for (const d of jan) for (const e of eventosPorDiaCache(o, primeiroDaJanela, fim).get(d.dia) ?? []) if (e.tipo === tipo) out.push({ dia: d.dia, e })
    return out
  }
  const pubsJ = evs('pub')
  const pubsR = pubsJ.filter(p => p.dia >= regDesde)
  const antes = pubsJ.length - pubsR.length
  const nL = pubsR.filter(p => p.e.forma === 'longo').length
  const nS = pubsR.length - nL
  const pubs = ptn(pubsR.length, 'publicação', 'publicações') + (f2(o) && pubsR.length > 0 ? (nL && nS ? ` (${ptn(nL, 'longo', 'longos')} e ${ptn(nS, 'Short', 'Shorts')})` : nL ? ' (só longos)' : ' (só Shorts)') : '')
  const campoDesde = regDesde > INICIO_DAS_MARCAS ? regDesde : INICIO_DAS_MARCAS
  const parcial = campoDesde > primeiroDaJanela
  const piso = parcial ? 'pelo menos ' : ''
  const pnm = `não medido antes de ${dm(campoDesde)}`
  const cauda = antes > 0 ? ` Antes de o canal entrar na lista: ${ptn(antes, 'publicação', 'publicações')}${o.estado.tipo === 'primeira_busca' ? ', pelo que já foi buscado' : ''}.` : ''
  const camposNc = o.mudancas === null, trocasNc = o.trocas === null
  const nCam = evs('campo').filter(x => x.dia >= regDesde).length
  const nTro = evs('troca').filter(x => x.dia >= regDesde).length
  const cam = camposNc ? null : nCam > 0 || !parcial ? piso + ptn(nCam, 'mudança de campo', 'mudanças de campo') : null
  const tro = trocasNc ? null : nTro > 0 || !parcial ? piso + ptn(nTro, 'troca', 'trocas') : null
  const itens = [pubs]
  if (cam) itens.push(cam)
  if (tro) itens.push(tro)
  const lista = itens.length === 3 ? `${itens[0]}, ${itens[1]} e ${itens[2]}` : itens.join(' e ')
  const resto: string[] = []
  if (camposNc) resto.push('Mudanças de campo: não carregou.')
  else if (!cam) resto.push(`Mudanças de campo: ${pnm}.`)
  if (trocasNc) resto.push('Trocas: não carregou.')
  else if (!tro) resto.push(`Trocas: ${pnm}.`)
  return `${lista}.${resto.length ? ` ${resto.join(' ')}` : ''}${cauda}`
}

const f2 = (o: EntradaDaLinhaDoTempo): boolean => o.formato.doisFormatos

const cache = new WeakMap<EntradaDaLinhaDoTempo, Map<string, Map<string, Evento[]>>>()
function eventosPorDiaCache(o: EntradaDaLinhaDoTempo, de: string, fim: string): Map<string, Evento[]> {
  const porJanela = cache.get(o) ?? new Map<string, Map<string, Evento[]>>()
  cache.set(o, porJanela)
  const chave = `${de}|${fim}`
  const achado = porJanela.get(chave)
  if (achado) return achado
  const novo = eventosPorDia(o, de, fim)
  porJanela.set(chave, novo)
  return novo
}

void diasEntre
