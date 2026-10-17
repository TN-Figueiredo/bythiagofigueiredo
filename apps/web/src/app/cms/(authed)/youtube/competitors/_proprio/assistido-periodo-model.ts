/**
 * Modelo dos três cartões de "% assistido por período" (plano E5b, Tarefa 15; mockup B do lote 1). Puro: recebe os normais já calculados
 * (`normalDoPeriodo` e `normalDaFaixaNoPeriodo`, Tarefa 14) e devolve só texto e números prontos. Não lê banco nem importa leitor.
 * A conta é a mediana por vídeo do % assistido; a diferença em pontos é feita sobre os números ARREDONDADOS que a tela escreve.
 * "Não medido" nunca vira zero: poucas views, cobertura parcial, sem diário e sem acesso têm o seu cartão, sem número e sem seta.
 */
import { contraNormal, FAIXAS, MIN_VIDEOS_FAIXA, type FaixaId } from '@/lib/youtube/observatorio/proprio/assistido'
import { MIN_VIEWS_PERIODO, type NormalDoPeriodo, type PeriodoAssistido } from '@/lib/youtube/observatorio/proprio/assistido-periodo'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import { ausenciaDoAcesso, ausenciaDoVpdComNegativa, type EstadoAusencia, type NegativaPrivada } from '../_chrome/ausencia/estado'
import { int } from './impressoes-model'

export type TelaAssistido = 'video' | 'canal'
export const PERIODOS_ASSISTIDO: readonly PeriodoAssistido[] = ['inteiro', '90', '28']
export const CHAVE_ASSISTIDO = 'obs-proprio-assistido-periodo'

export interface EntradaAssistido {
  tela: TelaAssistido
  acesso: 'ok' | 'negado' | 'erro'
  /** Por que o acesso foi negado (a da página). Ausente = não preenchida: `sem-acesso` vira `falhou`, nunca cadeado (decisão 75). */
  negativa?: NegativaPrivada
  normais: Record<PeriodoAssistido, NormalDoPeriodo>
  /** as três faixas por período; null na página do vídeo */
  faixas: Record<PeriodoAssistido, Array<{ faixa: FaixaId; normal: NormalDoPeriodo }>> | null
  /** o % assistido do vídeo (só na página do vídeo); null = ainda sem percentual */
  videoPct: number | null
  /** vídeos com buraco de cobertura e vídeos da conta, por período; null = a cobertura não é conhecida */
  buracos: Record<PeriodoAssistido, { comBuraco: number; naConta: number } | null>
  /** o primeiro dia lido do diário, quando ele começa DEPOIS da publicação mais antiga (C-10); null = o diário cobre a vida */
  diarioDesde: DiaYt | null
  /** o último dia da janela (o `ultimoDia` do `lerDiario` tolerante) */
  ultimoDia: DiaYt | null
  dm(d: DiaYt): string
  dmy(d: DiaYt): string
}

export type EstadoCartao = 'medido' | 'sem-numero'
export interface Seta { simbolo: '▲' | '▼' | '＝'; leitura: 'acima' | 'abaixo' | 'na-media'; sinal: string; texto: string; palavra: string }
export interface CartaoAssistido {
  id: PeriodoAssistido
  rotulo: string
  curto: string
  estado: EstadoCartao
  /** "51%"; null quando não há número */
  valor: string | null
  /** o texto sob o valor: "188 mil views", "340 de 1.000 views", "poucas views" etc. */
  legenda: string
  /** o que fica no lugar do número ("poucas views", "não medido", "sem dado") */
  semNumero: string | null
  /** Decisão 75: o estado de ausência do cartão (null ⇔ há número). A palavra de `semNumero` não muda aqui. */
  ausencia: EstadoAusencia | null
  seta: Seta | null
  /** o que o leitor de tela ouve */
  aria: string
}
export interface CelulaFaixa {
  estado: 'medido' | 'sem-numero'
  valor: string | null
  seta: Seta | null
  /** "412 mil views" ou "340 de 1.000" ou o texto do motivo */
  legenda: string
  semNumero: string | null
}
export interface ConteudoAssistido {
  /** a frase de comparação (vídeo) ou de tendência (canal); `leitura` dá a direção para o desenho */
  frase: { sinal: Seta['simbolo'] | '—'; leitura: Seta['leitura'] | 'sem'; texto: string; negrito: readonly string[]; verInteiro: boolean } | null
  /** só na aba do canal: faixa de duração × três períodos */
  tabela: Array<{ rotulo: string; celulas: Record<PeriodoAssistido, CelulaFaixa> }> | null
  /** o título da lista de vídeos na aba do canal */
  tituloLista: string
  /** a marca do normal na barra do vídeo: o % arredondado do período, quando há */
  normalNaBarra: number | null
}
export interface AssistidoPeriodosView {
  tela: TelaAssistido
  estado: 'ok' | 'negado' | 'erro'
  rotuloGrupo: string
  /** a frase quando não há acesso ou a leitura falhou: nenhum número na vista */
  vazio: string | null
  /** Decisão 75: o estado de ausência de `vazio` (negado→restrito só com `sem_direito`, senão falhou; erro→falhou); null = há cartões. */
  vazioEstado: EstadoAusencia | null
  cartoes: CartaoAssistido[]
  conteudos: Record<PeriodoAssistido, ConteudoAssistido>
  padrao: PeriodoAssistido
  lembranca: string
  voltar: string
  legenda: string
  metodo: readonly string[]
}

const NOME: Record<PeriodoAssistido, { nome: string; de: string; rot: string; curto: string }> = {
  inteiro: { nome: 'canal inteiro', de: 'do canal inteiro', rot: 'Canal inteiro', curto: 'Inteiro' },
  '90': { nome: 'últimos 90 dias', de: 'dos últimos 90 dias', rot: 'Últimos 90 dias', curto: '90 dias' },
  '28': { nome: 'últimos 28 dias', de: 'dos últimos 28 dias', rot: 'Últimos 28 dias', curto: '28 dias' },
}
const SIMBOLO = { acima: '▲', abaixo: '▼', 'na-media': '＝' } as const
/** A causa do "acima do teto", dita igual nos cartões do % assistido e na origem das views (mesma página, mesma causa). */
export const TEXTO_ACIMA_DO_TETO = 'o canal tem vídeos demais para esta tela ler de uma vez'
export const TEXTO_NEGADO = 'Só quem edita o site vê o % assistido.'
export const TEXTO_ERRO = 'A leitura do % assistido falhou agora; recarregue a página.'
const TEXTO_SEM_DIARIO = 'A coleta diária ainda não rodou: sem ela não há % assistido, nem do vídeo nem do canal.'

const milV = (x: number): string => (x >= 1000 ? `${Math.round(x / 1000)} mil` : int(x))
const sinalDe = (d: number): string => (d === 0 ? '0' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`)
const pontos = (d: number): string => (Math.abs(d) === 1 ? 'ponto' : 'pontos')

function seta(dif: number, leitura: Seta['leitura']): Seta {
  const palavra = leitura === 'na-media' ? 'na média' : leitura
  return { simbolo: SIMBOLO[leitura], leitura, sinal: sinalDe(dif), texto: `${SIMBOLO[leitura]} ${sinalDe(dif)}`, palavra }
}

/** O texto "não medido" do cartão e da frase, por motivo. */
function textoDoMotivo(n: NormalDoPeriodo, b: { comBuraco: number; naConta: number } | null): string {
  switch (n.motivo) {
    case 'poucas-views': return 'poucas views'
    case 'cobertura-parcial':
      // sem o prefixo "não medido: ": a legenda já fica sob o valor "não medido" (Logan, item 4)
      return b == null ? 'não sabemos se todos os dias foram coletados' : `${int(b.comBuraco)} de ${int(b.naConta)} vídeos com dias sem leitura no período`
    // mesma causa e mesmo texto da origem, na mesma página: o tamanho da leitura, não um defeito de coleta
    case 'acima-do-teto': return TEXTO_ACIMA_DO_TETO
    case 'sem-acesso': return TEXTO_NEGADO
    case 'leitura-falhou': return TEXTO_ERRO
    default: return 'sem dado'
  }
}

function rotuloDe(id: PeriodoAssistido, e: EntradaAssistido): { rotulo: string; curto: string } {
  if (id === 'inteiro' && e.diarioDesde != null) return { rotulo: `Desde ${e.dmy(e.diarioDesde)}`, curto: `Desde ${e.dm(e.diarioDesde)}` }
  return { rotulo: NOME[id].rot, curto: NOME[id].curto }
}

function cartao(id: PeriodoAssistido, e: EntradaAssistido): CartaoAssistido {
  const n = e.normais[id]
  const r = rotuloDe(id, e)
  if (n.pctArredondado == null) {
    const motivo = n.motivo ?? 'sem-diario'
    const semNumero = motivo === 'poucas-views' ? 'poucas views' : motivo === 'cobertura-parcial' || motivo === 'acima-do-teto' ? 'não medido' : motivo === 'sem-acesso' ? 'sem acesso' : motivo === 'leitura-falhou' ? 'não conseguimos ler' : 'sem dado'
    const legenda = motivo === 'poucas-views' ? `${int(n.views)} de ${int(MIN_VIEWS_PERIODO)} views` : textoDoMotivo({ ...n, motivo }, e.buracos[id])
    return { id, ...r, estado: 'sem-numero', valor: null, legenda, semNumero, ausencia: ausenciaDoVpdComNegativa(motivo, e.negativa ?? null) ?? 'nao_medido', seta: null, aria: `${r.rotulo}: ${semNumero}. ${legenda}` }
  }
  const inteiro = e.normais.inteiro
  const c = id !== 'inteiro' ? contraNormal(n.pctArredondado, inteiro.pctArredondado) : null
  const s = c ? seta(c.dif, c.leitura) : null
  const palavra = c ? (c.leitura === 'na-media' ? 'na média do canal inteiro' : `${Math.abs(c.dif)} ${pontos(c.dif)} ${c.leitura === 'acima' ? 'acima' : 'abaixo'} do canal inteiro`) : null
  return {
    id, ...r, estado: 'medido', valor: `${n.pctArredondado}%`, legenda: `${milV(n.views)} views`, semNumero: null, ausencia: null, seta: s,
    aria: `${r.rotulo}: ${n.pctArredondado}% assistido, ${milV(n.views)} views${palavra ? `, ${palavra}` : ''}`,
  }
}

function celula(f: { normal: NormalDoPeriodo }, inteiro: { normal: NormalDoPeriodo } | undefined, id: PeriodoAssistido, e: EntradaAssistido): CelulaFaixa {
  const n = f.normal
  if (n.pctArredondado != null) {
    const c = id !== 'inteiro' && inteiro ? contraNormal(n.pctArredondado, inteiro.normal.pctArredondado) : null
    return { estado: 'medido', valor: `${n.pctArredondado}%`, seta: c ? seta(c.dif, c.leitura) : null, legenda: `${milV(n.views)} views`, semNumero: null }
  }
  if (n.motivo === 'poucas-views') return { estado: 'sem-numero', valor: null, seta: null, legenda: `${int(n.views)} de ${int(MIN_VIEWS_PERIODO)} views`, semNumero: 'poucas views' }
  if (n.motivo === 'cobertura-parcial' || n.motivo === 'acima-do-teto') return { estado: 'sem-numero', valor: null, seta: null, legenda: textoDoMotivo(n, e.buracos[id]), semNumero: 'não medido' }
  // "poucos vídeos" é outra causa que "poucas views" (views bastam, vídeos de menos), por isso o rótulo é diferente
  if (n.motivo == null && n.views >= MIN_VIEWS_PERIODO) return { estado: 'sem-numero', valor: null, seta: null, legenda: `${n.videos} de ${MIN_VIDEOS_FAIXA} vídeos`, semNumero: 'poucos vídeos' }
  return { estado: 'sem-numero', valor: null, seta: null, legenda: textoDoMotivo(n, e.buracos[id]), semNumero: 'sem dado' }
}

function fraseDoVideo(id: PeriodoAssistido, e: EntradaAssistido): ConteudoAssistido['frase'] {
  const n = e.normais[id]
  const quem = NOME[id].nome.replace('últimos', 'os últimos')
  if (n.pctArredondado == null) {
    if (n.motivo === 'poucas-views') return { sinal: '—', leitura: 'sem', texto: `Sem comparação com ${quem}: o canal teve só ${int(n.views)} views no período (precisa de ${int(MIN_VIEWS_PERIODO)}).`, negrito: [], verInteiro: id !== 'inteiro' }
    return { sinal: '—', leitura: 'sem', texto: `Sem comparação com ${quem}: ${textoDoMotivo(n, e.buracos[id])}.`, negrito: [], verInteiro: id !== 'inteiro' }
  }
  if (e.videoPct == null) return null
  const v = Math.round(e.videoPct)
  const c = contraNormal(v, n.pctArredondado)
  if (!c) return null
  const palavra = c.leitura === 'acima' ? 'Acima do normal' : c.leitura === 'abaixo' ? 'Abaixo do normal' : 'Na média'
  const dif = c.dif === 0 ? 'igual' : `${sinalDe(c.dif)} ${pontos(c.dif)}`
  return { sinal: SIMBOLO[c.leitura], leitura: c.leitura, texto: `${palavra} ${NOME[id].de}: ${v}% contra ${n.pctArredondado}% (${dif}).`, negrito: [`${v}%`, `${n.pctArredondado}%`], verInteiro: false }
}

function fraseDoCanal(id: PeriodoAssistido, e: EntradaAssistido): ConteudoAssistido['frase'] {
  const alvo: PeriodoAssistido = id === 'inteiro' ? '90' : id
  const a = e.normais[alvo]
  const i = e.normais.inteiro
  if (a.pctArredondado == null || i.pctArredondado == null) {
    const quem = a.pctArredondado == null ? a : i
    const onde = a.pctArredondado == null ? NOME[alvo].nome : NOME.inteiro.nome
    const texto = quem.motivo === 'poucas-views'
      ? `Não dá para comparar: nos ${NOME[alvo].nome} o canal teve só ${int(a.views)} views (precisa de ${int(MIN_VIEWS_PERIODO)}).`
      : `Não dá para comparar: no ${onde}, ${textoDoMotivo(quem, e.buracos[a.pctArredondado == null ? alvo : 'inteiro'])}.`
    return { sinal: '—', leitura: 'sem', texto, negrito: [], verInteiro: false }
  }
  const c = contraNormal(a.pctArredondado, i.pctArredondado)
  if (!c) return null
  const dif = c.dif === 0 ? 'igual' : `${sinalDe(c.dif)} ${pontos(c.dif)}`
  return { sinal: SIMBOLO[c.leitura], leitura: c.leitura, texto: `Nos ${NOME[alvo].nome}, o vídeo típico foi assistido por ${a.pctArredondado}%; no canal inteiro, ${i.pctArredondado}% (${dif}).`, negrito: [`${a.pctArredondado}%`, `${i.pctArredondado}%`], verInteiro: false }
}

const METODO: readonly string[] = [
  'Últimos 90 dias: o que as pessoas assistiram nesses dias, em todos os outros vídeos do canal, publicados quando for. Para cada vídeo, vale só o % assistido dentro dessa janela; o normal é a mediana desses vídeos (o vídeo do meio, não a média), com a mesma conta do canal inteiro.',
  `Mínimo de ${int(MIN_VIEWS_PERIODO)} views: com menos, o número balança e a tela diz “poucas views”, em vez de comparar.`,
  '▲ ▼ ＝ nos cartões: o período contra o canal inteiro, com a mesma conta (mediana por vídeo). Até 2 pontos é “＝”. A diferença é entre os números arredondados que você vê.',
]

export function buildAssistidoPeriodos(e: EntradaAssistido): AssistidoPeriodosView {
  const base = {
    tela: e.tela, rotuloGrupo: 'Comparar o % assistido com', padrao: 'inteiro' as const,
    lembranca: 'Salvo neste navegador', voltar: 'Voltar ao padrão (canal inteiro)', legenda: 'contra o canal inteiro', metodo: METODO,
  }
  if (e.acesso !== 'ok') {
    const vazio = e.acesso === 'negado' ? TEXTO_NEGADO : TEXTO_ERRO
    return { ...base, estado: e.acesso, vazio, vazioEstado: ausenciaDoAcesso(e.acesso, e.negativa ?? null), cartoes: [], conteudos: { inteiro: vazia(), '90': vazia(), '28': vazia() } }
  }
  const cartoes = PERIODOS_ASSISTIDO.map(id => cartao(id, e))
  const semDiario = PERIODOS_ASSISTIDO.every(id => e.normais[id].motivo === 'sem-diario')
  const conteudos = Object.fromEntries(PERIODOS_ASSISTIDO.map((id): [PeriodoAssistido, ConteudoAssistido] => {
    const faixas = e.faixas
    const tabela = e.tela === 'canal' && faixas
      ? FAIXAS.map(f => ({
        rotulo: f.rotulo,
        celulas: Object.fromEntries(PERIODOS_ASSISTIDO.map(p => [p, celula(faixas[p].find(x => x.faixa === f.id)!, faixas.inteiro.find(x => x.faixa === f.id), p, e)])) as Record<PeriodoAssistido, CelulaFaixa>,
      }))
      : null
    const frase = semDiario ? { sinal: '—' as const, leitura: 'sem' as const, texto: TEXTO_SEM_DIARIO, negrito: [], verInteiro: false } : e.tela === 'video' ? fraseDoVideo(id, e) : fraseDoCanal(id, e)
    return [id, { frase, tabela, tituloLista: `Vídeos mais assistidos, contra o normal da faixa (${NOME[id].nome})`, normalNaBarra: e.normais[id].pctArredondado }]
  })) as Record<PeriodoAssistido, ConteudoAssistido>
  return { ...base, estado: 'ok', vazio: null, vazioEstado: null, cartoes, conteudos }
}

function vazia(): ConteudoAssistido {
  return { frase: null, tabela: null, tituloLista: '', normalNaBarra: null }
}
