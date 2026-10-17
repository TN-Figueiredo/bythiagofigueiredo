/**
 * A5 E5a, Tarefa 9 (mockup 17c): "quem sobe e quem desce no nicho". Módulo PURO: nenhuma consulta, nenhum relógio (o dia de hoje entra por
 * parâmetro) e nenhum texto montado no componente. Uma leitura ordena, pinta e conta por vez; as outras duas ficam no painel "As 3 leituras".
 * Quatro estados que nunca se confundem: medido (com percentual e posição), não medido (com o motivo), sem base para comparar (também não
 * medido, fora da posição e da contagem) e não carregou. Dividir por 0 não gera percentual.
 */
import { FRASES, FRASE_FIXA_DA_FONTE, classeDoMotivo } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { aindaNaoExiste, avisoDeContagem, mesmaIdadeExisteEm, somaDias } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { direcaoExibida, posicaoNaRegua, posicoesDeCompeticao, type SimboloDeDirecao } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import type { ValorDirecaoCanal, ValorDirecaoVideos } from '@/lib/youtube/observatorio/medidas/direcao'
import type { Medida, MotivoNaoMedido } from '@/lib/youtube/observatorio/medidas/tipos'

export type LeituraDaDirecao = 'a' | 'b' | 'c'
export const LEITURAS: readonly LeituraDaDirecao[] = ['a', 'b', 'c']
export const parseLeitura = (raw: string | null | undefined): LeituraDaDirecao => (raw === 'b' || raw === 'c' ? raw : 'a')

/** A escala da régua e o tamanho da página: constantes do mockup. */
export const LIMITE_DA_REGUA = 60
export const LINHAS_POR_PAGINA = 10

export interface CanalDoNicho { id: string; name: string; href: string }

const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const dma = (d: string): string => `${dm(d)}/${d.slice(0, 4)}`
const n0 = (n: number): string => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n)
const plural = (n: number, um: string, varios: string): string => (n === 1 ? um : varios)

interface Texto { nome: string; curto: string; janela: string; objeto: string; meta: string; legenda: string; dias: number }
const TEXTOS: Record<LeituraDaDirecao, Texto> = {
  a: {
    nome: 'Canal inteiro', curto: 'Canal inteiro', janela: '28 dias contra 28', dias: MEASURE_RULES.direction.windowDays,
    objeto: 'em views nos últimos 28 dias', meta: 'Últimos 28 dias contra os 28 anteriores',
    legenda: 'Inclui Shorts e vídeos apagados. O filtro de formato não vale aqui.',
  },
  b: {
    nome: 'Vídeos novos', curto: 'Vídeos novos', janela: '90 dias contra 90', dias: MEASURE_RULES.channelWindowDays,
    objeto: 'nas views do vídeo típico dos longos publicados nos últimos 90 dias', meta: 'Últimos 90 dias contra os 90 anteriores',
    legenda: 'Só vídeos longos. Descer pode ser só idade: os mais velhos tiveram mais tempo.',
  },
  c: {
    nome: 'Vídeos novos, mesma idade', curto: 'Mesma idade', janela: 'views aos 30 dias', dias: MEASURE_RULES.channelWindowDays,
    objeto: 'nas views do vídeo típico dos longos publicados nos últimos 90 dias, medidas aos 30 dias de vida', meta: 'Últimos 90 dias contra os 90 anteriores',
    legenda: 'Compara cada vídeo aos 30 dias de vida, sem o efeito do tempo.',
  },
}

/** O que uma leitura diz de um canal, antes de ordenar. */
export type Leitura =
  | { tipo: 'medido'; pct: number; simbolo: SimboloDeDirecao; texto: string; variacao: number; base: string[] }
  | { tipo: 'sem_base'; curta: string; base: string[] }
  | { tipo: 'nao_medido'; motivo: MotivoNaoMedido; curta: string; longa: string; fechaEm: string | null; base: string[]; progresso: number | null }
  | { tipo: 'nao_carregou' }

function janelas(ate: string, dias: number): { recente: string; anterior: string } {
  return {
    recente: `${dm(somaDias(ate, -(dias - 1)))} a ${dm(ate)}`,
    anterior: `${dm(somaDias(ate, -(2 * dias - 1)))} a ${dm(somaDias(ate, -dias))}`,
  }
}

function deMedida(l: LeituraDaDirecao, m: Medida<ValorDirecaoCanal> | Medida<ValorDirecaoVideos> | undefined): Leitura {
  if (!m) return { tipo: 'nao_carregou' }
  const t = TEXTOS[l]
  if (m.estado === 'medido') {
    const v = m.valor
    if (!Number.isFinite(v.variacao)) return { tipo: 'nao_carregou' }
    const d = direcaoExibida(v.variacao)
    const j = m.janela.ate ? janelas(m.janela.ate, t.dias) : null
    const base = 'ganhoRecente' in v
      ? [`${n0(v.ganhoRecente)} views contra ${n0(v.ganhoAnterior)}`, ...(j ? [`${j.recente} contra ${j.anterior}`] : [])]
      : [`vídeo típico: ${n0(v.medianaRecente)} views contra ${n0(v.medianaAnterior)}`, ...(j ? [`publicados de ${j.recente} contra ${j.anterior}`] : [])]
    return { tipo: 'medido', pct: d.pct, simbolo: d.simbolo, texto: d.texto, variacao: v.variacao, base }
  }
  if (classeDoMotivo(m.motivo) === 'nao_carregou') return { tipo: 'nao_carregou' }
  if (m.motivo === 'base_zero') {
    return { tipo: 'sem_base', curta: 'sem base para comparar', base: [l === 'a' ? `0 views nos ${t.dias} dias anteriores` : `vídeo típico de 0 views nos ${t.dias} dias anteriores`] }
  }
  const f = { ...FRASES[m.motivo]({ fechaEm: m.fechaEm, desde: m.desde, n: m.n, minimo: m.minimo }, 'insights') }
  let aviso: string[] = []
  // as frases do mockup 17c (NOTAS, seção 3): a tabela única guarda as genéricas, estas são as desta tela
  if (m.motivo === 'pouco_registro' && m.fechaEm) f.curta = `fecha em ${dm(m.fechaEm)}`
  if (m.motivo === 'sem_registro_na_borda' && m.desde) { f.curta = `sem o registro de ${dm(m.desde)}`; aviso = [`volta a medir quando houver o dado de ${dm(m.desde)}`] }
  if (m.motivo === 'poucos_videos' && typeof m.n === 'number' && typeof m.minimo === 'number') f.curta = `${m.n} ${plural(m.n, 'longo', 'longos')} num dos períodos; precisa de ${m.minimo}`
  const progresso = m.motivo === 'pouco_registro' && typeof m.n === 'number' ? Math.min(1, Math.max(0, m.n / (2 * t.dias))) : null
  const base = m.motivo === 'pouco_registro' && typeof m.n === 'number' ? [`${m.n} de ${2 * t.dias} dias de registro`] : aviso
  return { tipo: 'nao_medido', motivo: m.motivo, curta: f.curta, longa: f.longa, fechaEm: m.fechaEm ?? null, base, progresso }
}

/** A leitura de um canal. A "mesma idade" não existe antes da data: todo canal fica "fecha em dd/mm", seja qual for a medida (calendário, plano T9). */
export function leituraDoCanal(l: LeituraDaDirecao, medidas: MedidasDoSite, canal: string, hojeSP: string): Leitura {
  const c = medidas.porCanal.get(canal)
  if (!c || 'naoCarregou' in c) return { tipo: 'nao_carregou' }
  if (l === 'c') {
    const ainda = aindaNaoExiste('mesma_idade', hojeSP)
    if (ainda) {
      return {
        tipo: 'nao_medido', motivo: 'fecha_em', curta: `fecha em ${dma(ainda.existeEm)}`,
        longa: `precisa de ${2 * MEASURE_RULES.channelWindowDays} dias de registro dos vídeos novos`, fechaEm: ainda.existeEm, base: [], progresso: null,
      }
    }
    return deMedida('c', c.porFormato.long.m3c)
  }
  return deMedida(l, l === 'a' ? c.m3a : c.porFormato.long.m3b)
}

export type EstadoDaLinha = 'medido' | 'nao_medido' | 'sem_base' | 'nao_carregou'

export interface LeituraNoPainel {
  key: LeituraDaDirecao; nome: string; sub: string; principal: boolean
  estado: EstadoDaLinha; simbolo: SimboloDeDirecao | null; texto: string | null; base: string[]; motivo: string | null
}

export interface LinhaDaDirecao {
  id: string; name: string; href: string
  estado: EstadoDaLinha
  simbolo: SimboloDeDirecao | null
  /** O percentual escrito (`+42%`), ou nulo sem medida. */
  texto: string | null
  /** A posição escrita (`2º`), ou `–` sem medida. */
  posicao: string
  empate: boolean
  /** A ponta da trilha: de 0 a 1 na largura da régua; nulo sem medida. */
  fracao: number | null
  fora: 'acima' | 'abaixo' | null
  base: string[]
  /** A frase do motivo (pastilha) quando não há medida. */
  motivo: string | null
  motivoLongo: string | null
  /** A parte já preenchida da hachura (0 a 1); só no "poucos dias de registro". */
  progresso: number | null
  aria: string
  leituras: LeituraNoPainel[]
  /** Só no canal único: "Único canal do nicho: sem posição." */
  unico: string | null
}

export interface BotaoDeLeitura {
  key: LeituraDaDirecao; nome: string; curto: string; janela: string; contagem: string; nenhum: boolean; pressed: boolean
  /** O nome por extenso, para o leitor de tela. */
  aria: string
}

export interface ContagemDaDirecao { sobem: number; descem: number; estaveis: number; naoMedidos: number; naoCarregaram: number; total: number }

export type EstadoDoCartao = 'normal' | 'um-canal' | 'sem-dado' | 'erro'

export interface DirecaoNichoView {
  estado: EstadoDoCartao
  titulo: string
  meta: string
  leitura: LeituraDaDirecao
  frase: string
  /** O botão sob a frase quando nada está medido e outra leitura mede ao menos um canal. */
  sugestao: { key: LeituraDaDirecao; texto: string } | null
  contagem: ContagemDaDirecao
  /** A barra: aria e os cinco segmentos; nula com um canal só ou sem canal. */
  barra: { aria: string; segmentos: Array<{ tipo: 'sobe' | 'desce' | 'estavel' | 'nao_medido' | 'nao_carregou'; n: number; texto: string }> } | null
  botoes: BotaoDeLeitura[]
  legenda: string
  avisos: string[]
  /** O eixo (descendo / estável / subindo) só existe quando há um canal medido. */
  eixo: boolean
  linhas: LinhaDaDirecao[]
  seuCanal: Array<{ nome: string; texto: string }>
  /** O método, só no ⓘ: o da régua, o das três leituras e o do seu canal. Cada um termina na frase fixa da fonte. */
  info: { regua: string[]; leituras: string[]; seuCanal: string[] }
  semDado: { titulo: string; texto: string } | null
  erro: { titulo: string; texto: string } | null
  fonte: string
}

const SIMBOLO_DA_FRASE: Record<SimboloDeDirecao, string> = { sobe: '▲', desce: '▼', estavel: '＝' }

function estadoDe(l: Leitura): EstadoDaLinha {
  return l.tipo === 'medido' ? 'medido' : l.tipo === 'sem_base' ? 'sem_base' : l.tipo === 'nao_medido' ? 'nao_medido' : 'nao_carregou'
}

function noPainel(key: LeituraDaDirecao, principal: boolean, l: Leitura): LeituraNoPainel {
  const t = TEXTOS[key]
  const comum = { key, nome: t.nome, sub: t.janela, principal, estado: estadoDe(l) }
  if (l.tipo === 'medido') return { ...comum, simbolo: l.simbolo, texto: l.texto, base: l.base, motivo: null }
  if (l.tipo === 'sem_base') return { ...comum, simbolo: null, texto: null, base: l.base, motivo: l.curta }
  if (l.tipo === 'nao_medido') return { ...comum, simbolo: null, texto: null, base: l.base, motivo: l.curta }
  return { ...comum, simbolo: null, texto: null, base: [], motivo: 'a leitura falhou' }
}

const PALAVRA: Record<SimboloDeDirecao, string> = { sobe: 'subindo', desce: 'descendo', estavel: 'estável' }

function fraseDoCaso(
  leitura: LeituraDaDirecao, nicho: string, c: ContagemDaDirecao, primeiraData: string | null, unico: Leitura | null,
): string {
  const t = TEXTOS[leitura]
  if (unico) {
    if (unico.tipo === 'medido') {
      const verbo = unico.simbolo === 'sobe' ? 'sobe' : unico.simbolo === 'desce' ? 'desce' : 'fica estável'
      return `Só 1 canal no nicho ${nicho}, e ele ${verbo} ${SIMBOLO_DA_FRASE[unico.simbolo]} ${t.objeto}. Sem outro canal, não há com quem comparar.`
    }
    return `Só 1 canal no nicho ${nicho}, e ele ainda não pôde ser medido ${t.objeto}. Sem outro canal, não há com quem comparar.`
  }
  const medidos = c.sobem + c.descem + c.estaveis
  // Quem não carregou é dito à parte; nunca vira "ainda" nem some da frase
  const falhou = c.naoCarregaram ? ` ${c.naoCarregaram} ${plural(c.naoCarregaram, 'canal: a leitura falhou.', 'canais: a leitura falhou.')}` : ''
  if (!medidos) {
    const quando = primeiraData ? `: o primeiro fecha em ${leitura === 'c' ? dma(primeiraData) : dm(primeiraData)}` : ''
    return `Nenhum canal do nicho ${nicho} tem medida ${t.objeto} ainda${quando}.${falhou}`
  }
  let f = `▲ ${c.sobem} ${plural(c.sobem, 'sobe', 'sobem')}, ▼ ${c.descem} ${plural(c.descem, 'desce', 'descem')} e ＝ ${c.estaveis} ${plural(c.estaveis, 'fica estável', 'ficam estáveis')} ${t.objeto}, no nicho ${nicho}.`
  if (c.naoMedidos) f += ` ${c.naoMedidos} ${plural(c.naoMedidos, 'canal ainda não pôde ser medido.', 'canais ainda não puderam ser medidos.')}`
  return f + falhou
}

function contar(ls: ReadonlyArray<Leitura>): ContagemDaDirecao {
  const medidos = ls.filter((l): l is Extract<Leitura, { tipo: 'medido' }> => l.tipo === 'medido')
  return {
    sobem: medidos.filter(l => l.simbolo === 'sobe').length, descem: medidos.filter(l => l.simbolo === 'desce').length,
    estaveis: medidos.filter(l => l.simbolo === 'estavel').length,
    naoMedidos: ls.filter(l => l.tipo === 'nao_medido' || l.tipo === 'sem_base').length,
    naoCarregaram: ls.filter(l => l.tipo === 'nao_carregou').length, total: ls.length,
  }
}

export interface OpcoesDaDirecao {
  leitura: LeituraDaDirecao
  hojeSP: string
  /** O nome do nicho como a tela o escreve ("Viagem"). */
  nicho: string
  /** Os canais PRÓPRIOS do nicho: só o nome. Nunca passam pelo carregador de medidas. */
  seusCanais: readonly string[]
  /** Ids dos canais cujo período anterior não está coberto pelo histórico guardado (`anteriorCoberto`). Só as leituras b e c usam. */
  anteriorIncompleto?: readonly string[]
}

/** A nota das leituras b e c quando o histórico guardado não alcança o período anterior (portão Phil I2). */
function notaAnteriorIncompleto(n: number): string {
  return `Atenção: em ${n} ${plural(n, 'canal', 'canais')} falta histórico do período anterior, e a alta pode estar exagerada.`
}

function infoDoCartao(): DirecaoNichoView['info'] {
  const lim = LIMITE_DA_REGUA, eq = Math.round(MEASURE_RULES.equalPct * 100), dias = MEASURE_RULES.direction.windowDays, jan = MEASURE_RULES.channelWindowDays
  return {
    regua: [
      'Cada linha é um canal do nicho contra ele mesmo, na leitura escolhida nos botões: a janela de cada leitura está na frase do alto.',
      `▲ sobe a partir de +${eq}%, ▼ desce a partir de −${eq}%, ＝ fica no meio. A regra vale sobre o número que aparece, já arredondado ao inteiro.`,
      `A régua vai de −${lim}% a +${lim}%. Passou disso, a barra encosta na borda e termina numa seta; o número verdadeiro continua escrito.`,
      'A posição é ordem, não nota: ser 1º não quer dizer que o canal é melhor. Canais com o mesmo percentual dividem a posição e a tela escreve "empate".',
      'Não medido: o canal ainda não tem o que a leitura pede, e a linha diz o motivo e a data. Quando o período anterior tem 0 views, o motivo é "sem base para comparar": dividir por 0 não dá percentual.',
      'Zero medido (caixa vazada com 0) é uma medida: teve 0 views.',
      FRASE_FIXA_DA_FONTE,
    ],
    leituras: [
      'Uma leitura ordena por vez; as outras duas ficam no painel "As 3 leituras" de cada linha, só em contorno.',
      `Canal inteiro: as views ganhas nos últimos ${dias} dias contra as dos ${dias} anteriores, com ${2 * dias} dias de registro do canal; inclui Shorts e vídeos apagados.`,
      `Vídeos novos: a mediana das views dos longos publicados nos últimos ${jan} dias contra a dos ${jan} anteriores, com ${RULES.weakBase} longos em cada período; descer pode ser só idade.`,
      `Mesma idade: o mesmo, com as views de cada vídeo aos 30 dias de vida; passa a existir em ${dma(mesmaIdadeExisteEm())}.`,
      FRASE_FIXA_DA_FONTE,
    ],
    seuCanal: ['O Observatório não coleta o dia a dia público do seu canal, e inventar uma direção para ele seria falsa precisão.', FRASE_FIXA_DA_FONTE],
  }
}

const SEM_DADO = { titulo: 'Nenhum canal neste nicho', texto: '' }

/**
 * O cartão inteiro. `medidas` é `'erro'` quando a leitura lançou por inteiro (o cartão em erro, sem posição nenhuma). Só a leitura escolhida
 * ordena, pinta e conta. Ordem: maior inteiro primeiro; não medidos pela data em que fecham e depois pelo nome; "não carregou" por último.
 */
export function direcaoDoNicho(medidas: MedidasDoSite | 'erro', canais: readonly CanalDoNicho[], o: OpcoesDaDirecao): DirecaoNichoView {
  const { leitura, hojeSP, nicho } = o
  const t = TEXTOS[leitura]
  const seuCanal = o.seusCanais.map(nome => ({ nome, texto: `seu canal · ${nome} · fora desta régua` }))
  const incompletos = leitura === 'a' ? 0 : canais.filter(c => o.anteriorIncompleto?.includes(c.id)).length
  const nota = incompletos ? notaAnteriorIncompleto(incompletos) : null
  const base = {
    titulo: `Quem sobe e quem desce no nicho ${nicho}`, meta: t.meta, leitura, legenda: t.legenda, fonte: FRASE_FIXA_DA_FONTE, seuCanal, info: infoDoCartao(),
    sugestao: null, barra: null, avisos: [] as string[], eixo: false, linhas: [] as LinhaDaDirecao[],
  }
  const vazia: ContagemDaDirecao = { sobem: 0, descem: 0, estaveis: 0, naoMedidos: 0, naoCarregaram: 0, total: 0 }
  const botoesVazios: BotaoDeLeitura[] = LEITURAS.map(k => ({
    key: k, nome: TEXTOS[k].nome, curto: TEXTOS[k].curto, janela: TEXTOS[k].janela, contagem: 'nenhum medido', nenhum: true, pressed: k === leitura, aria: TEXTOS[k].nome,
  }))
  if (!canais.length) {
    return {
      ...base, estado: 'sem-dado', frase: '', contagem: vazia, botoes: botoesVazios,
      semDado: { ...SEM_DADO, texto: `Adicione um canal de ${nicho} para ver quem sobe e quem desce.` }, erro: null,
    }
  }
  const emErro = (): DirecaoNichoView => {
    return {
      ...base, estado: 'erro', frase: '', contagem: { ...vazia, total: canais.length, naoCarregaram: canais.length }, botoes: botoesVazios, semDado: null,
      erro: { titulo: 'Não deu para carregar as views dos canais deste nicho.', texto: 'Os outros cartões desta tela carregaram. Tente de novo; se o erro continuar, confira se a sincronização dos canais está atrasada.' },
    }
  }
  if (medidas === 'erro') return emErro()

  // as três leituras de cada canal; só a escolhida ordena
  const todas = new Map<string, Record<LeituraDaDirecao, Leitura>>(canais.map(c => [c.id, {
    a: leituraDoCanal('a', medidas, c.id, hojeSP), b: leituraDoCanal('b', medidas, c.id, hojeSP), c: leituraDoCanal('c', medidas, c.id, hojeSP),
  }]))
  // nenhum canal carregou: a leitura inteira falhou, e isso não é "ainda não deu tempo" (as três leituras derivam do mesmo carregamento do canal)
  if (canais.every(c => todas.get(c.id)!.a.tipo === 'nao_carregou')) return emErro()
  const doNicho = (k: LeituraDaDirecao): Leitura[] => canais.map(c => todas.get(c.id)![k])
  const contagemDe = (k: LeituraDaDirecao): ContagemDaDirecao => contar(doNicho(k))
  const botoes: BotaoDeLeitura[] = LEITURAS.map(k => {
    const c = contagemDe(k)
    const medidos = c.sobem + c.descem + c.estaveis
    return {
      key: k, nome: TEXTOS[k].nome, curto: TEXTOS[k].curto, janela: TEXTOS[k].janela, pressed: k === leitura, nenhum: medidos === 0,
      contagem: medidos === 0 ? 'nenhum medido' : `${medidos} de ${c.total} medidos`, aria: TEXTOS[k].nome,
    }
  })

  const contagem = contagemDe(leitura)
  const itens = canais.map(c => ({ c, l: todas.get(c.id)![leitura] }))
  const medidos = itens.filter((x): x is { c: CanalDoNicho; l: Extract<Leitura, { tipo: 'medido' }> } => x.l.tipo === 'medido')
  const porNome = (a: CanalDoNicho, b: CanalDoNicho): number => a.name.localeCompare(b.name, 'pt-BR')
  medidos.sort((a, b) => b.l.pct - a.l.pct || b.l.variacao - a.l.variacao || porNome(a.c, b.c))
  const naoMedidos = itens.filter(x => x.l.tipo === 'nao_medido' || x.l.tipo === 'sem_base')
  const quando = (x: { l: Leitura }): string => (x.l.tipo === 'nao_medido' && x.l.fechaEm ? x.l.fechaEm : '9999-99-99')
  naoMedidos.sort((a, b) => quando(a).localeCompare(quando(b)) || porNome(a.c, b.c))
  const naoCarregaram = itens.filter(x => x.l.tipo === 'nao_carregou').sort((a, b) => porNome(a.c, b.c))

  const posicoes = posicoesDeCompeticao(medidos.map(x => x.l.pct))
  const unico = canais.length === 1
  const montar = (x: { c: CanalDoNicho; l: Leitura }, i: number | null): LinhaDaDirecao => {
    const painel = LEITURAS.map(k => noPainel(k, k === leitura, todas.get(x.c.id)![k]))
    const comum = { id: x.c.id, name: x.c.name, href: x.c.href, leituras: painel, unico: unico ? 'Único canal do nicho: sem posição.' : null }
    if (x.l.tipo === 'medido' && i !== null) {
      const pos = unico ? null : posicoes[i]!
      const empate = pos !== null && posicoes.filter(p => p === pos).length > 1
      const r = posicaoNaRegua(x.l.pct, LIMITE_DA_REGUA, x.l.variacao)
      const posTxt = pos === null ? '–' : `${pos}º`
      return {
        ...comum, estado: 'medido', simbolo: x.l.simbolo, texto: x.l.texto, posicao: posTxt, empate, fracao: r.fracao, fora: r.foraDaEscala,
        base: x.l.base, motivo: null, motivoLongo: null, progresso: null,
        aria: `${x.c.name}: ${PALAVRA[x.l.simbolo]} ${x.l.texto}.` + (pos === null ? ' Sem posição.' : ` ${posTxt} de ${medidos.length} ${plural(medidos.length, 'medido', 'medidos')}${empate ? ', empate' : ''}.`),
      }
    }
    if (x.l.tipo === 'sem_base') {
      return { ...comum, estado: 'sem_base', simbolo: null, texto: null, posicao: '–', empate: false, fracao: null, fora: null, base: x.l.base, motivo: x.l.curta, motivoLongo: null, progresso: null, aria: `${x.c.name}: não medido, ${x.l.curta}. Sem posição.` }
    }
    if (x.l.tipo === 'nao_medido') {
      return { ...comum, estado: 'nao_medido', simbolo: null, texto: null, posicao: '–', empate: false, fracao: null, fora: null, base: x.l.base, motivo: x.l.curta, motivoLongo: x.l.longa, progresso: x.l.progresso, aria: `${x.c.name}: não medido, ${x.l.curta}. Sem posição.` }
    }
    return { ...comum, estado: 'nao_carregou', simbolo: null, texto: null, posicao: '–', empate: false, fracao: null, fora: null, base: [], motivo: 'a leitura falhou', motivoLongo: null, progresso: null, aria: `${x.c.name}: a leitura falhou. Sem posição.` }
  }
  const linhas = [...medidos.map((x, i) => montar(x, i)), ...naoMedidos.map(x => montar(x, null)), ...naoCarregaram.map(x => montar(x, null))]

  const primeiraData = naoMedidos.map(quando).filter(d => d !== '9999-99-99').sort()[0] ?? null
  const frase = fraseDoCaso(leitura, nicho, contagem, primeiraData, unico ? itens[0]!.l : null)
  // o botão sob a frase: só quando nada está medido e outra leitura mede ao menos um canal
  const outra = botoes.find(b => b.key !== leitura && !b.nenhum)
  const sugestao = !medidos.length && !unico && outra
    ? { key: outra.key, texto: `${TEXTOS[outra.key].nome} já mede ${outra.contagem.replace(' medidos', '')}.` } : null

  const avisos: string[] = nota ? [nota] : []
  if (leitura === 'a') {
    const aviso = avisoDeContagem({ de: somaDias(hojeSP, -2 * t.dias), ate: hojeSP, dias: 2 * t.dias })
    if (aviso) avisos.push(`Até ${dm(aviso.ate)}, os ${t.dias} dias anteriores incluem a mudança de contagem do YouTube (${dm(MEASURE_RULES.countChange)}).`)
  }

  const segmentos: Array<{ tipo: 'sobe' | 'desce' | 'estavel' | 'nao_medido' | 'nao_carregou'; n: number; texto: string }> = [
    { tipo: 'sobe', n: contagem.sobem, texto: `▲ ${contagem.sobem} ${plural(contagem.sobem, 'sobe', 'sobem')}` },
    { tipo: 'desce', n: contagem.descem, texto: `▼ ${contagem.descem} ${plural(contagem.descem, 'desce', 'descem')}` },
    { tipo: 'estavel', n: contagem.estaveis, texto: `＝ ${contagem.estaveis} ${plural(contagem.estaveis, 'estável', 'estáveis')}` },
    { tipo: 'nao_medido', n: contagem.naoMedidos, texto: `◌ ${contagem.naoMedidos} ${plural(contagem.naoMedidos, 'não medido', 'não medidos')}` },
    { tipo: 'nao_carregou', n: contagem.naoCarregaram, texto: `✕ ${contagem.naoCarregaram}: a leitura falhou` },
  ]
  const barra = unico ? null : {
    aria: `${contagem.sobem} ${plural(contagem.sobem, 'sobe', 'sobem')}, ${contagem.descem} ${plural(contagem.descem, 'desce', 'descem')}, ${contagem.estaveis} ${plural(contagem.estaveis, 'estável', 'estáveis')}, ${contagem.naoMedidos} ${plural(contagem.naoMedidos, 'não medido', 'não medidos')}, ${contagem.naoCarregaram ? `${contagem.naoCarregaram} a leitura falhou, ` : ''}de ${contagem.total} canais`,
    segmentos,
  }
  return {
    ...base, estado: unico ? 'um-canal' : 'normal', frase, contagem, botoes, sugestao, avisos, barra, eixo: medidos.length > 0, linhas, semDado: null, erro: null,
  }
}
