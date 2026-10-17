// A5 · E5b · Tarefa 21: o modelo de tela das trocas do vídeo próprio (puro: sem React, sem banco, sem `server-only`).
// Recebe o que `lerTrocas` leu e devolve só texto, dias e frações. Quem decide cada número é `anteDepoisDaTroca` (E18); aqui só se escolhe
// a forma e a frase. Nenhuma palavra afirma causa. A data de hoje entra por parâmetro; nenhuma data é digitada.
import { addDays, dayPt, diffDias } from '@/lib/youtube/coleta/day-pt'
import { DIAS_RECENTES, JANELA_LEITURA_ALCANCE_DIAS, montarDias, motivoDiaTexto, videoNovo, type DiaAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import { anteDepoisDaTroca, type Lado } from '@/lib/youtube/observatorio/proprio-versoes/antes-depois'
import { PROPRIO_RULES } from '@/lib/youtube/observatorio/proprio-versoes/regras'
import type { VersaoPropria, VersoesDoVideo } from '@/lib/youtube/observatorio/proprio-versoes/tipos'
import type { MotivoNaoMedido } from '@/lib/youtube/observatorio/proprio/motivos-nao-medido'
import type { DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { TesteAb } from '@/lib/youtube/observatorio/proprio/ler-testes-ab'
import type { TrocasLidas } from './dados-trocas'
import { SEM_RELATORIO, type FaixaDoGrafico, type MarcaDoGrafico } from './impressoes-model'
import { diaDaTroca, desdeDaTroca, trocasQueContam } from './trocas-contam'
import type { Parte } from './video-blocos-model'

export type EstadoTrocas = 'ok' | 'privado' | 'erro-de-leitura' | 'nao-registrado'
export type Chip = 'subiu' | 'caiu' | 'sem-diferenca' | 'ainda-nao-da' | 'depois-nao-medido' | 'antes-nao-medido' | 'sem-antes' | 'sem-dias' | 'origem-nao-sabida' | 'leitura-falhou'
export type FormaLado = 'numero' | 'zero' | 'poucas' | 'nao-medido' | 'sem-antes' | 'sem-dias' | 'erro'

export interface LadoView {
  rotulo: string
  rotuloCurto: string
  forma: FormaLado
  /** "4,1%" */
  taxa: string | null
  /** "2,3% a 7,0%" */
  faixa: string | null
  /** frações do eixo comum (0 ao maior limite superior da tela, mais folga; a escala é a mesma para todos os lados) */
  barra: { taxa: number; lo: number; hi: number } | null
  /** a causa dita dentro da caixa dos lados sem número */
  causa: string | null
  aria: string
}

export interface ImagemTroca { texto: string | null; imagem: string | null; notaImagem: string | null }
export interface TrocaView {
  n: number
  campo: 'title' | 'thumb'
  dia: DiaYt
  quando: string
  de: ImagemTroca
  para: ImagemTroca
  origem: { chip: string; frase: string; teste: { href: string } | 'sem-acesso' | null }
  chip: Chip
  rotuloChip: string
  frase: string
  antes: LadoView | null
  depois: LadoView | null
  notas: string[]
}

export interface TesteView {
  id: string
  de: DiaYt
  ate: DiaYt | null
  andamento: boolean
  fim: 'andamento' | 'registrado' | 'nao-registrado'
  ciclos: DiaYt[]
  titulo: string
  quando: string
  nCiclos: string
  frase: string
  teste: { href: string } | 'sem-acesso'
}

export type FaixaGrafico =
  | { k: 'ab'; de: DiaYt; ate: DiaYt | null; ciclos: DiaYt[]; rot: string; rotCurto: string; fala: string }
  | { k: 'reg'; ate: DiaYt; rot: string; rotCurto: string; fala: string }
export interface MarcaGrafico { dia: DiaYt; n: number; campo: 'title' | 'thumb'; fala: string }

export interface TrocasView {
  estado: EstadoTrocas
  motivo: MotivoNaoMedido | null
  topo: { partes: Parte[]; aviso: string | null; linkAntesDepois: boolean }
  frase: string
  contagens: Array<{ chip: Chip; n: number }>
  zero: boolean
  atraso: { linhas: string[] } | null
  regua: { de: DiaYt; ate: DiaYt; rotuloDe: string; rotuloAte: string; testes: TesteView[]; marcas: MarcaGrafico[]; aria: string } | null
  reconstruida: { titulo: string; frase: string; linhas: string[]; selos: string[]; divisor: string } | null
  itens: Array<{ tipo: 'teste'; v: TesteView } | { tipo: 'troca'; v: TrocaView }>
  avisos: string[]
  bloqueio: string[] | null
  metodo: string[]
  faixas: FaixaGrafico[]
  marcas: MarcaGrafico[]
  notaGrafico: string | null
  /** só contagens: quem envia ao Sentry é a página (nunca texto, título nem data) */
  diagnostico: { foraDaJanelaSemCausa: number; fimNaoRegistrado: number; origemCms: number; estadoInesperado: number }
}

export interface EntradaTrocas {
  lidas: Privado<TrocasLidas>
  ytId: string
  publicadoEm: DiaYt | null
  hojePt: DiaYt
  podeEditar: boolean
  dm(d: DiaYt): string
  dmy(d: DiaYt): string
  /** dia e hora de São Paulo do MESMO instante, para as linhas reconstruídas */
  quandoSp(iso: string): { dia: string; hora: string }
  /** o `dayPt` da coleta: todo instante do Lab vira dia por ela */
  diaPt(iso: string): DiaYt
  n(x: number): string
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Textos fixos. TEXTO-A-REVISAR (Logan): todos, menos os copiados do mockup 3b (NOTAS seção 2).
export { SEM_RELATORIO }
/** As duas frases da A4 para o mesmo vídeo (`video-blocos-model.ts`, bloco de impressões): copiadas, e um teste as compara com o que o bloco escreve. */
export const FRASE_VIDEO_NOVO = 'O vídeo é novo: o YouTube entrega as impressões com 2 a 3 dias de atraso, então ainda não há dia fechado.'
export const rotuloChip = (c: Chip): string => ROTULO[c]
const ROTULO: Record<Chip, string> = {
  subiu: '▲ taxa subiu', caiu: '▼ taxa caiu', 'sem-diferenca': '≈ sem diferença firme', 'ainda-nao-da': '… ainda não dá para dizer',
  'depois-nao-medido': '? depois ainda não medido', 'antes-nao-medido': '? antes ainda não medido', 'sem-antes': 'sem antes', 'sem-dias': 'sem dias para comparar',
  'origem-nao-sabida': 'origem não sabida', 'leitura-falhou': 'leitura falhou',
}
const CURTO: Record<Chip, string> = {
  subiu: 'taxa subiu', caiu: 'taxa caiu', 'sem-diferenca': 'sem diferença firme', 'ainda-nao-da': 'ainda não dá para dizer', 'depois-nao-medido': 'depois ainda não medido',
  'antes-nao-medido': 'antes ainda não medido', 'sem-antes': 'sem antes', 'sem-dias': 'sem dias para comparar', 'origem-nao-sabida': 'origem não sabida', 'leitura-falhou': 'leitura falhou',
}
const SIMBOLO: Record<Chip, string> = {
  subiu: '▲', caiu: '▼', 'sem-diferenca': '≈', 'ainda-nao-da': '…', 'depois-nao-medido': '?', 'antes-nao-medido': '?', 'sem-antes': '○', 'sem-dias': '⊢', 'origem-nao-sabida': '?', 'leitura-falhou': '!',
}
const ORDEM_CHIPS: readonly Chip[] = ['subiu', 'caiu', 'sem-diferenca', 'ainda-nao-da', 'depois-nao-medido', 'antes-nao-medido', 'sem-antes', 'sem-dias', 'origem-nao-sabida', 'leitura-falhou']
export const simboloDoChip = (c: Chip): string => SIMBOLO[c]

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`
const pct1 = (x: number): string => (x * 100).toFixed(1).replace('.', ',') + '%'
const campoNome = (c: 'title' | 'thumb'): string => (c === 'title' ? 'título' : 'thumbnail')
const vazio = (): TrocasView['diagnostico'] => ({ foraDaJanelaSemCausa: 0, fimNaoRegistrado: 0, origemCms: 0, estadoInesperado: 0 })

function base(estado: EstadoTrocas, motivo: MotivoNaoMedido | null): TrocasView {
  return {
    estado, motivo, topo: { partes: [], aviso: null, linkAntesDepois: false }, frase: '', contagens: [], zero: false, atraso: null, regua: null, reconstruida: null,
    itens: [], avisos: [], bloqueio: null, metodo: [], faixas: [], marcas: [], notaGrafico: null, diagnostico: vazio(),
  }
}

export const BLOQUEIO: readonly string[] = [ // TEXTO-A-REVISAR (Logan): texto do bloqueio inventado pelo plano
  'Você não vê as trocas deste vídeo.',
  'As trocas mostram impressões e cliques, dados privados do canal: só quem administra o site vê.',
]

// ---------------------------------------------------------------------------------------------------------------------------------
// Faixas e testes.
function fimDoTeste(t: TesteAb, e: EntradaTrocas): { ate: DiaYt | null; fim: TesteView['fim'] } {
  if (t.status === 'active') return { ate: null, fim: 'andamento' }
  const datas = [t.pausadoEm, t.concluidoEm].filter((x): x is string => x !== null).map(x => Date.parse(x))
  if (datas.length > 0) return { ate: e.diaPt(new Date(Math.min(...datas)).toISOString()), fim: 'registrado' }
  const ultimoCiclo = t.ciclos.length > 0 ? t.ciclos[t.ciclos.length - 1]!.inicio : t.inicio
  return { ate: e.diaPt(ultimoCiclo), fim: 'nao-registrado' }
}

function testeView(t: TesteAb, e: EntradaTrocas, diag: TrocasView['diagnostico']): TesteView {
  const { ate, fim } = fimDoTeste(t, e)
  if (fim === 'nao-registrado') diag.fimNaoRegistrado++
  const de = e.diaPt(t.inicio)
  const ciclos = t.ciclos.map(c => e.diaPt(c.inicio))
  // TEXTO-A-REVISAR (Logan): "fim do teste não registrado" é texto inventado
  const quando = ate && fim === 'registrado' ? `de ${e.dm(de)} a ${e.dm(ate)}` : fim === 'andamento' ? `desde ${e.dm(de)}, em andamento` : `desde ${e.dm(de)}, sem data de fim registrada`
  const resultado = t.vencedorAplicadoEm ? ` Resultado: o vencedor foi aplicado em ${e.dm(e.diaPt(t.vencedorAplicadoEm))}.` : t.pausadoEm ? ` O teste foi parado em ${e.dm(e.diaPt(t.pausadoEm))}.` : ''
  return {
    id: t.id, de, ate: fim === 'andamento' ? null : ate, andamento: fim === 'andamento', fim, ciclos, titulo: 'Teste A/B', quando,
    nCiclos: plural(t.ciclos.length, 'ciclo', 'ciclos'),
    frase: `${t.ciclos.length === 1 && fim !== 'andamento' ? 'A troca de ciclo não entra' : t.ciclos.length > 1 && fim !== 'andamento' ? `As ${t.ciclos.length} trocas de ciclo não entram` : 'As trocas de ciclo não entram'} aqui.${resultado}`,
    teste: e.podeEditar ? { href: `/cms/youtube/ab-lab/${t.id}` } : 'sem-acesso',
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Os lados de uma troca.
type FormaBruta = 'cortado' | 'nao-medido' | 'zero' | 'poucas' | 'numero'
function formaBruta(l: Lado, minImp: number): FormaBruta {
  if (l.diasCandidatos === 0) return 'cortado'
  if (l.diasMedidos === 0) return 'nao-medido'
  if (l.imp === 0) return 'zero'
  if (l.imp < minImp || l.taxa === null) return 'poucas'
  return 'numero'
}

/** Os dias candidatos de cada lado, na ordem: a janela nominal da troca, sem o dia da publicação, cortada a `n` dias (os que a E18 contou). */
function candidatos(t: VersaoPropria, lado: 'antes' | 'depois', n: number, pub: DiaYt | null, J: number): DiaYt[] {
  const inicio = diaDe(t.janela!.de), fim = diaDe(t.janela!.ate)
  const todos: DiaYt[] = []
  if (lado === 'antes') for (let i = J; i >= 1; i--) todos.push(addDays(inicio, -i))
  else for (let i = 1; i <= J; i++) todos.push(addDays(fim, i))
  const sem = todos.filter(d => d !== pub)
  return lado === 'antes' ? sem.slice(Math.max(0, sem.length - n)) : sem.slice(0, n)
}
/** O dia do Pacífico de um instante (a mesma conta de `diaDaTroca`). */
function diaDe(iso: string): DiaYt {
  return dayPt(new Date(iso))
}

function promete(d: DiaYt, porDia: ReadonlyMap<DiaYt, DiaAlcance>, hojePt: DiaYt, ultimoDaLista: DiaYt | null): boolean {
  const x = porDia.get(d)
  if (!x) return ultimoDaLista === null || d > ultimoDaLista
  if (x.situacao !== 'nao-medido') return false
  switch (x.motivo) {
    case 'expirado': case 'erro': return false
    case 'recente': return true
    default: return d >= addDays(hojePt, -JANELA_LEITURA_ALCANCE_DIAS)
  }
}

interface Ctx { e: EntradaTrocas; alcanceDias: DiaAlcance[]; porDia: Map<DiaYt, DiaAlcance>; ultimoDaLista: DiaYt | null }

function intervalo(cand: readonly DiaYt[], porDia: ReadonlyMap<DiaYt, DiaAlcance>): { medidos: DiaYt[]; nm: DiaYt[] } {
  const medidos: DiaYt[] = [], nm: DiaYt[] = []
  for (const d of cand) {
    const x = porDia.get(d)
    if (x && (x.situacao === 'com-impressoes' || x.situacao === 'zero-medido') && x.imp !== null && x.cliques !== null) medidos.push(d)
    else nm.push(d)
  }
  return { medidos, nm }
}

function rotuloMedido(nome: string, ctx: Ctx, cand: readonly DiaYt[], l: Lado): { longo: string; curto: string } {
  const { e } = ctx
  const { medidos, nm } = intervalo(cand, ctx.porDia)
  if (medidos.length === 0) return { longo: `${nome}: ainda sem dia medido`, curto: `${nome}: ainda sem dia medido` }
  const de = medidos[0]!, ate = medidos[medidos.length - 1]!
  const dentro = nm.filter(d => d > de && d < ate)
  const iv = medidos.length > 1 ? `${e.dm(de)} a ${e.dm(ate)}` : e.dm(de)
  const sem = dentro.length > 0 ? `sem ${dentro.length > 1 ? dentro.slice(0, -1).map(e.dm).join(', ') + ' e ' + e.dm(dentro[dentro.length - 1]!) : e.dm(dentro[0]!)}` : ''
  const imp = `${e.n(l.imp)} ${l.imp === 1 ? 'impressão' : 'impressões'}`
  const dias = plural(medidos.length, 'dia', 'dias') + (sem ? ' medidos' : '')
  return {
    longo: `${nome}: ${dias} (${iv}${sem ? ', ' + sem : ''}), ${imp}`,
    curto: `${nome}: ${dias}, ${iv}${sem ? ', ' + sem : ''}, ${imp}`,
  }
}

type CortePor = { tipo: 'troca'; n: number } | { tipo: 'ciclo' }

/** O aviso de registro atrasado (2 dias ou mais). */
function atrasoDe(registro: { atrasoDias: number; conferidoAte: DiaYt }, e: EntradaTrocas): { linhas: string[] } | null {
  return registro.atrasoDias >= 2 ? { linhas: [ // TEXTO-A-REVISAR (Logan): linhas do aviso de atraso inventadas
    `O registro das trocas está ${registro.atrasoDias} dias atrasado.`,
    `As trocas até ${e.dm(registro.conferidoAte)} estão certas. Se você trocou algo depois disso, ainda não aparece aqui.`,
  ] } : null
}

// ---------------------------------------------------------------------------------------------------------------------------------
export function buildTrocas(a: EntradaTrocas): TrocasView {
  const e = a
  const lidas = a.lidas
  if (lidas.acesso === 'negado') {
    const v = base('privado', null)
    v.bloqueio = [...BLOQUEIO]
    return v
  }
  if (lidas.acesso === 'erro') {
    const v = base('erro-de-leitura', null)
    v.notaGrafico = 'As trocas não puderam ser lidas: o gráfico está sem as marcas.'
    v.avisos = ['Não conseguimos ler as trocas agora; recarregue a página.']
    v.topo.partes = [{ t: 'Trocas deste vídeo:', b: true }, { t: ' não conseguimos ler agora.' }]
    return v
  }
  const L = lidas.dado
  const diag = vazio()
  const estado = L.versoes.estado
  const video: VersoesDoVideo | undefined = L.versoes.videos.find(x => x.ytId === e.ytId)
  const semVersao = (c: 'title' | 'thumb') => !video || video.registro[c].estado === 'sem_versao'
  if (estado.estado === 'schema_ausente' || estado.estado === 'sem_estado' || !video || (semVersao('title') && semVersao('thumb'))) {
    const v = base('nao-registrado', 'nao_registrado')
    v.notaGrafico = 'trocas não registradas'
    v.frase = estado.estado === 'schema_ausente'
      ? 'As trocas deste vídeo ainda não são registradas: o registro não foi ligado neste banco.'
      : estado.estado === 'sem_estado'
        ? 'As trocas deste canal ainda não são registradas: o registro ainda não começou.'
        : 'As trocas deste vídeo ainda não são registradas: nenhuma versão do título nem da thumbnail foi guardada.'
    v.topo.partes = [{ t: 'Trocas deste vídeo:', b: true }, { t: ' não registradas.' }]
    // portão L5, Phil I-2: registro atrasado e vídeo publicado depois da última conferência não é "nunca registrado": o atraso aparece
    if (estado.estado === 'registrando') {
      const saiuDepois = e.publicadoEm !== null && e.publicadoEm > estado.conferidoAte
      if (saiuDepois) v.frase = `Ainda não conferimos as trocas deste vídeo: a última conferência foi em ${e.dm(estado.conferidoAte)} e o vídeo saiu depois.` // TEXTO-A-REVISAR (Logan)
      v.atraso = atrasoDe(estado, e)
      if (v.atraso || saiuDepois) v.topo.aviso = `A conferência das trocas parou em ${e.dm(estado.conferidoAte)}.`
    }
    return v
  }

  const J = PROPRIO_RULES.trocaJanelaDias
  const minImp = PROPRIO_RULES.trocaMinImpressoesPorLado
  const trocas = trocasQueContam(video)
  const registro = estado

  // desde quando
  const basesDia = (['title', 'thumb'] as const).filter(c => !semVersao(c))
    .map(c => video.versoes.filter(x => x.campo === c && x.origem === 'linha_de_base').map(x => x.primeiroDia).sort()[0])
    .filter((x): x is DiaYt => x !== undefined)
  const inicioDoRegistroDoVideo = basesDia.length > 0 ? basesDia.reduce((m, d) => (d > m ? d : m)) : registro.desde
  const desde = inicioDoRegistroDoVideo > registro.desde ? inicioDoRegistroDoVideo : registro.desde
  const desdeAPublicacao = e.publicadoEm !== null && inicioDoRegistroDoVideo <= addDays(e.publicadoEm, 2)

  // testes
  const testesLidos = L.testes.acesso === 'ok' ? L.testes.dado.testes : []
  const testes = testesLidos.map(t => testeView(t, e, diag))
  const testesOk = L.testes.acesso === 'ok'

  // alcance
  const alc = L.alcance
  const alcanceOk = alc !== null && alc.acesso === 'ok' ? alc.dado : null
  const montado = alcanceOk ? montarDias(alcanceOk.alcance, { hoje: e.hojePt, ytId: e.ytId, publicadoEm: e.publicadoEm, desde: alcanceOk.desde }) : null
  const dias = montado ? montado.dias : []
  const periodo = montado ? montado.periodo : null
  const porDia = new Map(dias.map(d => [d.dia, d]))
  const relatorios = alcanceOk ? alcanceOk.alcance.relatorios : []
  const maiorRecebido = relatorios.reduce<DiaYt | null>((m, r) => (m === null || r.dia > m ? r.dia : m), null)
  const ctx: Ctx = { e, alcanceDias: dias, porDia, ultimoDaLista: maiorRecebido }

  const itensTroca: TrocaView[] = trocas.map((t, i) => {
    const n = i + 1
    const dia = diaDaTroca(t)
    const campo = t.campo as 'title' | 'thumb'
    const anterior = video.versoes.filter(x => x.campo === t.campo && x.id !== t.id && Date.parse(x.vistaAte) <= Date.parse(t.vistaDesde)).sort((x, y) => Date.parse(y.vistaAte) - Date.parse(x.vistaAte))[0]
    const img = (v: VersaoPropria | undefined): ImagemTroca => {
      if (!v) return { texto: null, imagem: null, notaImagem: null }
      if (v.campo === 'thumb') return { texto: null, imagem: v.thumb?.blobUrl ?? null, notaImagem: !v.thumb?.blobUrl ? 'imagem não guardada' : v.thumb.imagemExata ? null : 'cópia não exata: a imagem pode diferir levemente da que esteve no ar' }
      return { texto: v.texto, imagem: null, notaImagem: null }
    }
    const lidaTeste = t.abTestId ? testesLidos.find(x => x.id === t.abTestId) : undefined
    const hrefTeste: TrocaView['origem']['teste'] = t.abTestId && lidaTeste ? (e.podeEditar ? { href: `/cms/youtube/ab-lab/${t.abTestId}` } : 'sem-acesso') : null
    // origem
    let origemChip = 'Origem não sabida', origemFrase = 'o sistema não conseguiu ler o A/B Lab neste dia e não afirma de onde veio'
    let desconhecida = false
    if (t.origem === 'fora_do_sistema') { origemChip = 'Fora do A/B Lab'; origemFrase = 'feita no Studio ou por outra ferramenta; o sistema não sabe qual' }
    else if (t.origem === 'ab_lab' && t.eventoAb === 'vencedor') {
      origemChip = 'Vencedor do teste A/B'
      origemFrase = lidaTeste ? `aplicado em ${e.dm(dia)}, no fim do teste de ${e.dm(e.diaPt(lidaTeste.inicio))}${testes.find(x => x.id === lidaTeste.id)?.ate ? ' a ' + e.dm(testes.find(x => x.id === lidaTeste.id)!.ate!) : ''}` : `aplicado em ${e.dm(dia)}`
    } else if (t.origem === 'ab_lab' && t.eventoAb === 'restauro') {
      origemChip = 'Teste parado, o original voltou'
      origemFrase = lidaTeste ? `o teste de ${e.dm(e.diaPt(lidaTeste.inicio))} foi parado em ${e.dm(dia)} e o ${campoNome(campo)} de antes voltou` : `o teste foi parado em ${e.dm(dia)} e o ${campoNome(campo)} de antes voltou`
    } else { desconhecida = true; if (t.origem === 'cms') diag.origemCms++; else if (t.origem !== 'nao_se_sabe') diag.estadoInesperado++ }

    const bruta: TrocaView = {
      n, campo, dia, quando: e.dmy(dia), de: img(anterior), para: img(t), origem: { chip: origemChip, frase: origemFrase, teste: hrefTeste },
      chip: 'origem-nao-sabida', rotuloChip: ROTULO['origem-nao-sabida'], frase: '', antes: null, depois: null, notas: [],
    }
    if (desconhecida) {
      bruta.frase = 'Sem comparação. O sistema não conseguiu ler o A/B Lab neste dia, então não sabe se a troca foi sua ou de um ciclo de teste. Comparar ciclos é do A/B Lab.'
      return bruta
    }
    return lerTroca(bruta, t, trocas, video, ctx, { alcancoErro: alc !== null && alcanceOk === null, periodo, alcanceOk, J, minImp, diag, hojePt: e.hojePt })
  })

  // chips, contagens
  const cont = new Map<Chip, number>()
  itensTroca.forEach(t => cont.set(t.chip, (cont.get(t.chip) ?? 0) + 1))
  const contagens = ORDEM_CHIPS.filter(c => cont.has(c)).map(c => ({ chip: c, n: cont.get(c)! }))

  // topo e frase
  const nT = itensTroca.length, nA = testes.length
  const desdeTxt = desdeAPublicacao && e.publicadoEm ? `a publicação (${e.dm(e.publicadoEm)})` : e.dmy(desde)
  const desdeCurto = desdeAPublicacao && e.publicadoEm ? `a publicação (${e.dm(e.publicadoEm)})` : e.dm(desde)
  let frase: string
  if (nT === 0 && nA === 0) frase = desdeAPublicacao ? `Nenhuma troca registrada desde ${desdeTxt}.` : `Nenhuma troca registrada desde ${e.dmy(desde)}, quando o registro deste vídeo começou.`
  else if (nT === 0) {
    const andamento = testes.some(t => t.andamento)
    frase = `0 trocas fora do A/B Lab desde ${desdeTxt} e ${plural(nA, 'teste A/B', 'testes A/B')}${andamento ? ' em andamento' : ''}, que não ${nA === 1 ? 'conta' : 'contam'} como troca.`
  } else frase = `${plural(nT, 'troca', 'trocas')}${nA ? ' e ' + plural(nA, 'teste A/B', 'testes A/B') : ''} neste vídeo desde ${desdeTxt}.${nA ? ' Os ciclos de teste não contam como troca.' : ''}`

  const reconstruida = montarReconstruida(video, testesLidos, desde, e)
  const partes: Parte[] = [{ t: 'Trocas deste vídeo:', b: true }]
  if (nT === 0 && nA === 0) partes.push({ t: ` nenhuma desde ${desdeCurto}${reconstruida ? `; um teste A/B de ${reconstruida.dias} foi reconstruído (mais abaixo)` : ''}.` })
  else if (nT > 3) {
    partes.splice(0, 1, { t: `${plural(nT, 'troca', 'trocas')}${nA ? ' e ' + plural(nA, 'teste A/B', 'testes A/B') : ''}`, b: true })
    partes.push({ t: ` desde ${desdeCurto}: ${contagens.map(c => `${SIMBOLO[c.chip]} ${c.n} ${CURTO[c.chip]}`).join(' · ')}.` })
  } else {
    const its = itensTroca.map(t => `${campoNome(t.campo)} (${t.n}) em ${e.dm(t.dia)}, ${CURTO[t.chip]}`)
    const te = testes.map(t => `teste A/B ${t.fim === 'andamento' ? `desde ${e.dm(t.de)}, em andamento` : t.ate ? `de ${e.dm(t.de)} a ${e.dm(t.ate)}` : `desde ${e.dm(t.de)}`}`)
    partes.push({ t: ' ' + [...its, ...te].join('; ') + '.' })
  }

  // atraso
  const atraso = atrasoDe(registro, e)
  const aviso = atraso ? `A conferência das trocas parou em ${e.dm(registro.conferidoAte)} (aviso abaixo).` : null
  if (aviso) partes.push({ t: ' ' + aviso })

  // avisos
  const avisos: string[] = []
  if (!testesOk) avisos.push(L.motivoTestes === 'teto'
    ? 'Este vídeo tem mais testes A/B do que a tela lê de uma vez: o gráfico não mostra os testes.'
    : 'Não foi possível ler o A/B Lab agora: o gráfico não mostra os testes e a origem das trocas pode estar incompleta.')
  if (L.versoes.videos.length > 0) {
    for (const c of ['title', 'thumb'] as const) {
      const r = video.registro[c]
      if (r.estado === 'sem_versao') avisos.push(`${c === 'title' ? 'Título' : 'Thumbnail'}: não registrada.`)
      else if (r.conferidoAte && video.registro[c === 'title' ? 'thumb' : 'title'].conferidoAte && r.conferidoAte < addDays(registro.conferidoAte, -2)) avisos.push(`${c === 'title' ? 'Título' : 'Thumbnail'}: não conferida desde ${e.dm(r.conferidoAte)}.`)
    }
  }
  const rotacoesFora = video.versoes.filter(v => v.origem === 'ab_lab' && v.eventoAb === 'rotacao' && !testesLidos.some(t => t.id === v.abTestId)).length
  if (testesOk && rotacoesFora > 0) avisos.push(`${plural(rotacoesFora, 'troca de ciclo', 'trocas de ciclo')} de um teste que o A/B Lab não devolveu ${rotacoesFora === 1 ? 'ficou' : 'ficaram'} fora da lista.`)

  reescalarBarras(itensTroca)

  // itens, em ordem cronológica
  const itens: TrocasView['itens'] = [
    ...testes.map(v => ({ tipo: 'teste' as const, v, d: v.de, h: 0 })),
    ...itensTroca.map(v => ({ tipo: 'troca' as const, v, d: v.dia, h: 1 })),
  ].sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : x.h - y.h)).map(({ tipo, v }) => (tipo === 'teste' ? { tipo, v: v as TesteView } : { tipo, v: v as TrocaView }))

  // faixas e marcas
  const marcas: MarcaGrafico[] = itensTroca.map(t => ({ dia: t.dia, n: t.n, campo: t.campo, fala: `troca (${t.n}) de ${campoNome(t.campo)}` }))
  const faixas: FaixaGrafico[] = testesOk ? testes.map(t => ({
    k: 'ab' as const, de: t.de, ate: t.ate, ciclos: t.ciclos, rot: 'em teste A/B' + (t.andamento ? ' (em andamento)' : ''), rotCurto: 'teste A/B',
    fala: 'Neste dia o vídeo estava em teste A/B: as trocas de ciclo não são marcadas aqui',
  })) : []
  faixas.push({
    k: 'reg', ate: addDays(desde, -1), rot: `antes do início do registro (${e.dm(desde)}): trocas não registradas`, rotCurto: 'antes do registro',
    fala: `Este dia é anterior ao início do registro de trocas (${e.dmy(desde)}): o sistema não sabe se houve troca`,
  })

  // régua
  const regua = nT + nA > 0 ? {
    de: desde, ate: e.hojePt, rotuloDe: `${e.dm(desde)} início do registro`, rotuloAte: `hoje, ${e.dm(e.hojePt)}`, testes, marcas,
    aria: `Régua das versões, de ${e.dm(desde)} a ${e.dm(e.hojePt)}: ${[
      ...testes.map(t => `teste A/B ${t.quando}`),
      ...itensTroca.map(t => `troca ${t.n} de ${campoNome(t.campo)} em ${e.dm(t.dia)}`),
    ].join('; ')}.`,
  } : null

  const metodo = metodoDasTrocas(registro.conferidoAte, desde, e)
  return {
    estado: 'ok', motivo: null, topo: { partes, aviso, linkAntesDepois: nT > 0 }, frase, contagens, zero: nT === 0, atraso, regua,
    reconstruida: reconstruida ? reconstruida.v : null, itens, avisos, bloqueio: null, metodo, faixas, marcas,
    notaGrafico: testesOk ? null : avisos[0] ?? null, diagnostico: diag,
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
interface Contexto { alcancoErro: boolean; periodo: ReturnType<typeof montarDias>['periodo']; alcanceOk: { alcance: { relatorios: { dia: DiaYt }[]; ultimoRelatorio: DiaYt | null }; desde: DiaYt; primeiroRelatorio: DiaYt | null } | null; J: number; minImp: number; diag: TrocasView['diagnostico']; hojePt: DiaYt }

/** G-2 (Gio 17/10): o eixo comum vai de 0 ao maior `hi` da tela (mais uma folga), não de 0 a 100%: taxas de clique de 2 a 6% numa régua de 0 a 100% viram um ponto colado à esquerda e a faixa some. */
export const FOLGA_EIXO = 1.15
export function reescalarBarras(trocas: readonly Pick<TrocaView, 'antes' | 'depois'>[]): number {
  let max = 0
  for (const t of trocas) for (const l of [t.antes, t.depois]) if (l?.barra && l.barra.hi > max) max = l.barra.hi
  if (max <= 0) return 1
  const eixo = Math.min(1, max * FOLGA_EIXO)
  for (const t of trocas) for (const l of [t.antes, t.depois]) if (l?.barra) l.barra = { taxa: l.barra.taxa / eixo, lo: l.barra.lo / eixo, hi: l.barra.hi / eixo }
  return eixo
}

function ladoErro(nome: string): LadoView {
  return { rotulo: `${nome}: não foi possível ler`, rotuloCurto: `${nome}: não foi possível ler`, forma: 'erro', taxa: null, faixa: null, barra: null, causa: 'não foi possível ler as impressões agora', aria: `${nome}: não foi possível ler as impressões agora` }
}
function ladoSem(nome: string, forma: 'sem-antes' | 'sem-dias' | 'nao-medido', causa: string, semAinda = false): LadoView {
  const rot = forma === 'nao-medido' ? (semAinda ? `${nome}: não medido` : `${nome}: ainda sem dia medido`) : `${nome}: sem dias para comparar`
  return { rotulo: rot, rotuloCurto: rot, forma, taxa: null, faixa: null, barra: null, causa, aria: `${rot}: ${causa}` }
}

function lerTroca(t: TrocaView, v: VersaoPropria, trocas: readonly VersaoPropria[], video: VersoesDoVideo, ctx: Ctx, c: Contexto): TrocaView {
  const { e } = ctx
  const dia = t.dia
  const fim = (chip: Chip, frase: string, antes: LadoView | null, depois: LadoView | null, rotulo?: string): TrocaView => ({ ...t, chip, rotuloChip: rotulo ?? ROTULO[chip], frase, antes, depois })
  // a coleta parou: o dado não vai chegar, então o rótulo não promete ("ainda")
  const parado = (frase: string): TrocaView => fim('depois-nao-medido', frase, ladoSem('Antes', 'nao-medido', frase, true), ladoSem('Depois', 'nao-medido', frase, true), '? não medido')
  if (c.alcancoErro || c.alcanceOk === null || !c.alcanceOk) {
    return fim('leitura-falhou', 'Não foi possível ler as impressões deste vídeo agora. A troca está certa; o antes e o depois não puderam ser calculados.', ladoErro('Antes'), ladoErro('Depois'))
  }
  const publicadoEm = e.publicadoEm
  const ac = c.alcanceOk
  const periodo = c.periodo
  const janelaDe = diaDe(v.janela!.de)

  // (1) período nulo: três ramos, decididos antes de olhar o estado; `anteDepoisDaTroca` não é chamada
  if (periodo === null) {
    if (ac.alcance.relatorios.length === 0) {
      if (ac.alcance.ultimoRelatorio === null) {
        return fim('depois-nao-medido', `${SEM_RELATORIO}`, ladoSem('Antes', 'nao-medido', SEM_RELATORIO), ladoSem('Depois', 'nao-medido', SEM_RELATORIO))
      }
      const parou = `A coleta de relatórios deste canal parou em ${data(e, ac.alcance.ultimoRelatorio, c.hojePt)}.`
      return parado(parou)
    }
    // (1c) há relatórios e a publicação é posterior ao mais novo
    const ultimo = ctx.ultimoDaLista!
    const velho = ultimo < addDays(c.hojePt, -JANELA_LEITURA_ALCANCE_DIAS)
    const parou = `A coleta de relatórios deste canal parou em ${data(e, ultimo, c.hojePt)}.`
    if (velho) return parado(parou)
    const ultimaFrase = videoNovo(publicadoEm, c.hojePt) ? FRASE_VIDEO_NOVO : `O último dia de alcance recebido é ${e.dm(ultimo)}, anterior à publicação deste vídeo: ainda não medido.`
    const primeiro = addDays(dia, 1), chega = addDays(dia, 1 + DIAS_RECENTES), cheia = addDays(dia, c.J + DIAS_RECENTES)
    const depoisFrase = c.hojePt < chega
      ? `Ainda não dá para comparar. O primeiro dia depois da troca (${e.dm(primeiro)}) só chega do YouTube em ${e.dm(chega)}. Leitura completa em ${e.dm(cheia)}.`
      : `Ainda não dá para comparar. ${ultimaFrase}`
    const pubAntes = publicadoEm !== null && publicadoEm >= addDays(janelaDe, -1)
    const antes = pubAntes ? ladoSem('Antes', 'sem-antes', 'o vídeo saiu logo antes da troca') : ladoSem('Antes', 'nao-medido', ultimaFrase)
    return fim('depois-nao-medido', depoisFrase, antes, ladoSem('Depois', 'nao-medido', c.hojePt < chega ? `as impressões do primeiro dia chegam em ${e.dm(chega)}` : ultimaFrase))
  }

  const r = anteDepoisDaTroca({ troca: v, versoesDoVideo: video.versoes, dias: ctx.alcanceDias, publicadoEm })
  const teto = ac.desde
  const antigo = desdeDaTroca(v, c.J) < teto
  const publicadoNaLista = publicadoEm !== null && periodo.de === publicadoEm

  // fora da janela lida
  if (r.estado === 'antes_fora_da_janela_lida') {
    let antes: LadoView, causaFrase: string, chip: Chip
    if (publicadoEm !== null && periodo.de === publicadoEm) {
      antes = ladoSem('Antes', 'sem-antes', 'o vídeo saiu logo antes da troca')
      causaFrase = `Sem antes para comparar. O vídeo foi publicado em ${e.dm(publicadoEm)}, ${plural(diffDias(publicadoEm, dia), 'dia', 'dias')} antes da troca.`
      chip = 'sem-antes'
    } else if (antigo && periodo.de === teto) {
      antes = ladoSem('Antes', 'sem-dias', 'troca antiga')
      causaFrase = 'Sem dias para comparar. Esta troca é antiga demais para o antes.'
      chip = 'sem-dias'
    } else if (periodo.de > ac.desde && (ac.primeiroRelatorio === null || ac.primeiroRelatorio >= periodo.de)) {
      const desdeRel = ac.primeiroRelatorio ?? periodo.de
      antes = ladoSem('Antes', 'sem-antes', `as impressões só existem desde ${e.dm(desdeRel)}`)
      causaFrase = `Sem antes para comparar. As impressões por dia só existem desde ${e.dmy(desdeRel)}.`
      chip = 'sem-antes'
    } else if (ac.primeiroRelatorio !== null && ac.primeiroRelatorio < periodo.de) {
      antes = ladoSem('Antes', 'nao-medido', motivoDiaTexto('sem-relatorio'))
      causaFrase = `Antes ainda não medido: ${motivoDiaTexto('sem-relatorio')}.`
      chip = 'antes-nao-medido'
    } else {
      c.diag.foraDaJanelaSemCausa++
      return fim('leitura-falhou', 'Não foi possível calcular o antes e o depois desta troca.', ladoErro('Antes'), ladoErro('Depois'))
    }
    // o depois vem medido da E18 (já cortado pela troca vizinha); a tela nunca recalcula dias (portão L5, Phil I-1)
    const depois = addDays(dia, 1) < periodo.de ? ladoSem('Depois', 'sem-dias', 'troca antiga') : ladoDe('Depois', 'depois', r.depois, undefined, v, trocas, video, ctx, c)
    return fim(chip, causaFrase, antes, depois)
  }
  if (!('antes' in r)) {
    c.diag.estadoInesperado++
    return fim('origem-nao-sabida', 'Sem comparação.', null, null)
  }

  const antes = ladoDe('Antes', 'antes', r.antes, r.depois, v, trocas, video, ctx, c)
  const depois = ladoDe('Depois', 'depois', r.depois, r.antes, v, trocas, video, ctx, c)
  // o teto também corta o "Antes" parcial: nunca taxa sobre parte dos dias
  let antesV = antes
  let depoisV = depois
  let chip: Chip
  const fa = formaBruta(r.antes, c.minImp), fd = formaBruta(r.depois, c.minImp)
  if (antigo && periodo.de === teto && !publicadoNaLista) {
    antesV = ladoSem('Antes', 'sem-dias', 'troca antiga')
    if (addDays(dia, 1) < periodo.de) depoisV = ladoSem('Depois', 'sem-dias', 'troca antiga')
  }
  if (antesV.forma === 'sem-dias' && antesV.causa === 'troca antiga') chip = 'sem-dias'
  else if (fd === 'nao-medido') chip = 'depois-nao-medido'
  else if (fd === 'cortado' && fa === 'cortado') chip = 'sem-dias'
  else if (fa === 'cortado' || fd === 'cortado') chip = 'sem-dias'
  else if (fa === 'nao-medido') chip = 'antes-nao-medido'
  else if (r.estado === 'com_leitura') chip = r.leitura === 'subiu' ? 'subiu' : r.leitura === 'caiu' ? 'caiu' : 'sem-diferenca'
  else chip = 'ainda-nao-da'

  return fim(chip, fraseDe(chip, t, r.antes, r.depois, antesV, depoisV, ctx, c), antesV, depoisV)
}

function data(e: EntradaTrocas, d: DiaYt, hojePt: DiaYt): string {
  return d.slice(0, 4) === hojePt.slice(0, 4) ? e.dm(d) : e.dmy(d)
}

/** O vizinho que fechou o lado: a troca numerada mais próxima ou a rotação de um teste. */
function vizinho(v: VersaoPropria, lado: 'antes' | 'depois', trocas: readonly VersaoPropria[], video: VersoesDoVideo): CortePor | null {
  const fimT = Date.parse(v.janela!.ate)
  const cand = video.versoes.filter(x => x.id !== v.id && x.janela !== null && x.origem !== 'linha_de_base' && !x.preRegistro && x.campo !== 'desc' && (PROPRIO_RULES.retoqueContaComoTroca || x.thumb?.retoque !== true)
    && (lado === 'antes' ? Date.parse(x.janela.ate) < fimT : Date.parse(x.janela.ate) > fimT))
  const x = lado === 'antes' ? cand.sort((a, b) => Date.parse(b.janela!.ate) - Date.parse(a.janela!.ate))[0] : cand.sort((a, b) => Date.parse(a.janela!.ate) - Date.parse(b.janela!.ate))[0]
  if (!x) return null
  const i = trocas.findIndex(y => y.id === x.id)
  return i >= 0 ? { tipo: 'troca', n: i + 1 } : { tipo: 'ciclo' }
}

/**
 * Por que um lado sem taxa não tem número, escolhido pelo OUTRO lado (portão L5, Yannis I1): nunca "o outro lado não tem dias" quando ele tem.
 * Com menos de `minImp` impressões a causa é a própria falta; com impressões de sobra e sem taxa é o outro lado (ou dado impossível).
 */
export function causaSemTaxa(l: Pick<Lado, 'imp'>, outro: Pick<Lado, 'imp' | 'diasMedidos'> | undefined, minImp: number, n: (x: number) => string): string {
  if (l.imp < minImp) return `só ${n(l.imp)} ${l.imp === 1 ? 'impressão' : 'impressões'}: sem faixa`
  if (outro === undefined) return 'sem comparação possível' // TEXTO-A-REVISAR (Logan)
  if (outro.diasMedidos === 0) return 'sem comparação: o outro lado não tem dia medido' // TEXTO-A-REVISAR (Logan)
  if (outro.imp < minImp) return `sem comparação: o outro lado tem só ${n(outro.imp)} ${outro.imp === 1 ? 'impressão' : 'impressões'}` // TEXTO-A-REVISAR (Logan)
  return 'sem comparação possível'
}

function ladoDe(nome: 'Antes' | 'Depois', lado: 'antes' | 'depois', l: Lado, outro: Lado | undefined, v: VersaoPropria, trocas: readonly VersaoPropria[], video: VersoesDoVideo, ctx: Ctx, c: Contexto): LadoView {
  const { e } = ctx
  const forma = formaBruta(l, c.minImp)
  const cand = candidatos(v, lado, l.diasCandidatos, e.publicadoEm, c.J)
  if (forma === 'cortado') {
    const por = vizinho(v, lado, trocas, video)
    const onde = lado === 'antes' ? 'antes' : 'depois'
    const causa = por ? (por.tipo === 'ciclo' ? `um teste A/B vem logo ${onde}` : `a troca (${por.n}) vem logo ${onde}`) : e.publicadoEm !== null && lado === 'antes' ? 'o vídeo saiu logo antes da troca' : 'sem dias para comparar'
    return ladoSem(nome, !por && e.publicadoEm !== null && lado === 'antes' ? 'sem-antes' : 'sem-dias', causa)
  }
  if (forma === 'nao-medido') {
    const prom = cand.some(d => promete(d, ctx.porDia, c.hojePt, ctx.ultimoDaLista))
    const primeiro = cand.find(d => !ctx.porDia.has(d) || ctx.porDia.get(d)!.situacao === 'nao-medido')
    const mot = primeiro ? ctx.porDia.get(primeiro)?.motivo ?? null : null
    const causa = prom ? 'não medido: ainda sem dia fechado' : `não medido: ${mot ? motivoDiaTexto(mot) : 'sem relatório deste período'}`
    return { ...ladoSem(nome, 'nao-medido', causa), aria: `${nome}: ${causa}` }
  }
  const rot = rotuloMedido(nome, ctx, cand, l)
  if (forma === 'zero') return { rotulo: rot.longo, rotuloCurto: rot.curto, forma: 'zero', taxa: null, faixa: null, barra: null, causa: 'zero medido: o vídeo não apareceu', aria: `${rot.longo}: zero medido` }
  if (forma === 'poucas' || l.taxa === null || l.lo === null || l.hi === null) {
    const causa = causaSemTaxa(l, outro, c.minImp, e.n)
    return { rotulo: rot.longo, rotuloCurto: rot.curto, forma: 'poucas', taxa: null, faixa: null, barra: null, causa, aria: l.imp >= c.minImp ? `${rot.longo}: sem comparação` : `${rot.longo}: poucas impressões, sem faixa` }
  }
  return {
    rotulo: rot.longo, rotuloCurto: rot.curto, forma: 'numero', taxa: pct1(l.taxa), faixa: `${pct1(l.lo)} a ${pct1(l.hi)}`,
    barra: { taxa: l.taxa, lo: l.lo, hi: l.hi }, causa: null, aria: `${rot.longo}: taxa de clique ${pct1(l.taxa)}, de ${pct1(l.lo)} a ${pct1(l.hi)}`,
  }
}

function fraseDe(chip: Chip, t: TrocaView, ra: Lado, rd: Lado, antes: LadoView, depois: LadoView, ctx: Ctx, c: Contexto): string {
  const { e } = ctx
  const dia = t.dia
  switch (chip) {
    case 'depois-nao-medido': {
      if (depois.forma === 'nao-medido' && depois.causa?.startsWith('não medido: ainda')) {
        const primeiro = addDays(dia, 1), chega = addDays(dia, 1 + DIAS_RECENTES), cheia = addDays(dia, c.J + DIAS_RECENTES)
        return c.hojePt < chega
          ? `Ainda não dá para comparar. O primeiro dia depois da troca (${e.dm(primeiro)}) só chega do YouTube em ${e.dm(chega)}. Leitura completa em ${e.dm(cheia)}.`
          : `Ainda não dá para comparar. A leitura completa chega em ${e.dm(cheia)}.`
      }
      return `Não dá para comparar. O depois ${depois.causa ?? 'não foi medido'}.`
    }
    case 'antes-nao-medido': return 'Ainda não dá para comparar. Os dias antes da troca ainda não foram entregues.'
    case 'sem-antes': return `Sem antes para comparar. ${antes.causa === 'o vídeo saiu logo antes da troca' && e.publicadoEm ? `O vídeo foi publicado em ${e.dm(e.publicadoEm)}, ${plural(diffDias(e.publicadoEm, dia), 'dia', 'dias')} antes da troca.` : (antes.causa ?? '')}`
    case 'sem-dias': {
      if (antes.causa === 'troca antiga') return 'Sem dias para comparar. Esta troca é antiga demais para o antes.'
      const lados = [antes, depois].filter(l => l.forma === 'sem-dias' || l.forma === 'sem-antes')
      if (lados.length === 2) return `Sem dias para comparar. ${[antes.causa, depois.causa].map(x => (x ?? '').charAt(0).toUpperCase() + (x ?? '').slice(1)).join('; ')}: não sobra dia inteiro para nenhum dos lados.`
      const l = lados[0]
      return `Sem dias para comparar. ${l ? (l.causa ?? '').charAt(0).toUpperCase() + (l.causa ?? '').slice(1) : ''}: não sobra dia inteiro desse lado.${(l?.causa ?? '').includes('teste A/B') ? ' Comparar ciclos é do A/B Lab.' : ''}`
    }
    case 'ainda-nao-da':
      return antes.forma === 'zero' && depois.forma === 'zero'
        ? 'Nos dias medidos o vídeo teve 0 impressões antes e 0 depois: o YouTube entregou os dias e ele não apareceu para ninguém.'
        : `Ainda não dá para dizer. São ${e.n(ra.imp)} ${ra.imp === 1 ? 'impressão' : 'impressões'} antes e ${e.n(rd.imp)} depois: com menos de ${PROPRIO_RULES.trocaMinImpressoesPorLado} de um lado, qualquer taxa seria chute.`
    case 'sem-diferenca': return `De ${antes.taxa} para ${depois.taxa}, mas as faixas se cruzam: a diferença pode ser só acaso.`
    case 'subiu': case 'caiu': {
      const gap = chip === 'subiu' ? (rd.lo ?? 0) - (ra.hi ?? 0) : (ra.lo ?? 0) - (rd.hi ?? 0)
      return `${chip === 'subiu' ? 'Subiu' : 'Caiu'} de ${antes.taxa} para ${depois.taxa}. As faixas ${gap < PROPRIO_RULES.trocaFaixasQuaseSeTocam ? 'quase se tocam: a diferença é pequena.' : 'não se cruzam.'}`
    }
    default: return ''
  }
}

function montarReconstruida(video: VersoesDoVideo, testes: readonly TesteAb[], desde: DiaYt, e: EntradaTrocas): { v: NonNullable<TrocasView['reconstruida']>; dias: string } | null {
  const pre = video.versoes.filter(x => x.preRegistro && x.campo === 'title').sort((a, b) => Date.parse(a.vistaDesde) - Date.parse(b.vistaDesde))
  if (pre.length === 0) return null
  const teste = testes.find(t => t.id === pre[0]!.abTestId)
  const linhas = pre.map(x => {
    const t = testes.find(y => y.id === x.abTestId)
    const i = t ? t.ciclos.findIndex(c => Math.abs(Date.parse(c.inicio) - Date.parse(x.vistaDesde)) < 60_000) : -1
    if (!t || i < 0) return `antes do teste · título original · ${x.texto ?? ''}`
    const q = e.quandoSp(x.vistaDesde)
    return `${q.dia} às ${q.hora} · ciclo ${i + 1} de ${t.ciclos.length} · ${x.texto ?? ''}`
  })
  const dias = teste ? `${e.dm(e.diaPt(teste.inicio))} a ${e.dmy(e.diaPt(teste.concluidoEm ?? teste.pausadoEm ?? teste.ciclos[teste.ciclos.length - 1]?.inicio ?? teste.inicio))}` : e.dmy(desde)
  return {
    dias,
    v: {
      titulo: `Antes do início do registro (${e.dmy(desde)}), reconstruído do A/B Lab`,
      frase: `Teste A/B de ${dias}. São títulos do passado: o que está no ar agora é o do cabeçalho.`,
      linhas, selos: ['sem antes e depois', 'a thumbnail original não dá para recuperar'], divisor: `${e.dmy(desde)}: o registro começa`,
    },
  }
}

function metodoDasTrocas(conferidoAte: DiaYt, desde: DiaYt, e: EntradaTrocas): string[] {
  const J = PROPRIO_RULES.trocaJanelaDias
  return [
    `Antes e depois: até ${J} dias de cada lado da troca, parando na troca vizinha, de qualquer origem. Ficam de fora o dia anterior e o dia da troca (o sistema olha o vídeo uma vez por dia e o dia do YouTube é do horário do Pacífico) e o dia da publicação.`,
    `Início do registro: o sistema só registra títulos e thumbnails desde ${e.dmy(desde)}. Antes dessa data ele não sabe se houve troca; por isso um gráfico sem marca ali não prova que não houve.`,
    `Atraso: o YouTube entrega as impressões com 2 a 3 dias de atraso. O primeiro dia depois da troca aparece cerca de 3 dias depois; a leitura completa, cerca de ${J + DIAS_RECENTES} dias depois da troca.`,
    `Menos de ${PROPRIO_RULES.trocaMinImpressoesPorLado} impressões num lado: sem taxa e sem faixa, só "ainda não dá para dizer".`,
    'Quais trocas contam: as feitas fora do A/B Lab (Studio ou outra ferramenta; o sistema não sabe qual), o vencedor de um teste e o original que volta quando um teste para. As trocas de ciclo de um teste A/B ficam de fora: comparar ciclos é o trabalho do A/B Lab.',
    'Origem não sabida: o sistema não conseguiu ler o A/B Lab naquele dia. A troca aparece, mas sem comparação, porque pode ter sido um ciclo de teste.',
    'Não é teste A/B: as duas versões não ficaram no ar ao mesmo tempo, ninguém sorteou quem via qual. A faixa mede só o acaso da amostra. Para saber a causa, use o A/B Lab.',
    'Fonte: cálculo do Observatório sobre os dados do YouTube Analytics do seu canal (impressões e cliques não são públicos). Os cliques são estimados: impressões × taxa do dia.',
    `Trocas conferidas até ${e.dm(conferidoAte)}.`,
  ]
}

/** O que o gráfico de views e o de impressões recebem da troca: faixas e marcas no formato do gráfico (ele não conhece a troca) e a nota sob ele. */
export interface TrocasNoGrafico { faixas: FaixaDoGrafico[]; marcas: MarcaDoGrafico[]; notaFaixas: string | null }
export function trocasNoGrafico(v: Pick<TrocasView, 'faixas' | 'marcas' | 'notaGrafico'>): TrocasNoGrafico {
  return {
    faixas: v.faixas.map((f): FaixaDoGrafico => (f.k === 'ab'
      ? { k: 'cheia', de: f.de, ate: f.ate, dentes: f.ciclos, rot: f.rot, rotCurto: f.rotCurto, fala: f.fala }
      : { k: 'pontilhada', de: null, ate: f.ate, dentes: [], rot: f.rot, rotCurto: f.rotCurto, fala: f.fala })),
    marcas: v.marcas.map((m): MarcaDoGrafico => ({ dia: m.dia, n: m.n, forma: m.campo === 'title' ? 'losango' : 'triangulo', fala: m.fala })),
    notaFaixas: v.notaGrafico,
  }
}
