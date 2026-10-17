/**
 * A5 · E17 degrau 1, TG: os blocos de medida do Histórico do vídeo de concorrente no pacote "Perguntar a uma IA" (resumo e faixa de números, Views
 * por idade, Estourou e parou, as 72 horas, Subida e Mudanças deste vídeo). Puro. `projetarMedidasDoVideo` recebe o `DerivadoDoVideo` que a tela usa
 * (nenhuma conta nova) e a leitura de "Estourou e parou" e deixa só texto, como a tela o escreve; as tabelas saem daí. Dado ausente sai como
 * "não medido"/"não carregou" com o motivo da tela, nunca como 0. Título e texto que o concorrente escreveu entram só como célula de terceiros.
 */
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import { TEXTO_M10 } from '@/lib/youtube/observatorio/medidas-telas/texto-m10'
import type { DerivadoDoVideo } from '../_historico/medidas/derivar-do-video'
import { abrev } from '../_historico/medidas/formatos'
import { milhar as milharH } from '../_historico/medidas/formatos'
import type { BlocoDeIdade } from '../_historico/medidas/idade-model'
import type { BlocoDeHoras } from '../_historico/medidas/horas-model'
import type { CartaoDaSubida, CelulaDaSubida } from '../_historico/medidas/subida-model'
import type { ListaDeMudancas } from '../_historico/medidas/mudancas-model'
import { dataBR, fraseAindaSemLeitura, milhar, pct, REGRAS_DA_LEITURA as R, TEXTOS_NAO_CARREGOU, TITULO_AINDA_SEM_LEITURA, vezes, type Leitura } from '../_chrome/medidas/estourou-model'

// ───────────────────────── a projeção: só texto, na ordem da tela
const NAO_CARREGOU_TELA = 'Não carregou'
const SEM = '—'

export interface ResumoIa {
  frase: string
  viewsAgora: { rotulo: string; texto: string; sub: string }
  /** `valor` e `razao`/`sub` são nulos quando a tela não os escreve; `motivo` diz por quê (não medido ou não carregou). */
  subida: { rotulo: string; estado: CelulaDaSubida['estado']; valor: string | null; motivo: string | null; razao: string | null; sub: string | null }
}

export interface IdadeIa {
  tipo: BlocoDeIdade['tipo']
  /** O texto de abertura do bloco em cada estado (frase, motivo ou a frase de "ainda não existe"). */
  frase: string
  extra: string
  pontos: Array<{ rotulo: string; video: string | null; videoMotivo: string | null; videoZero: boolean; normal: string | null; normalMotivo: string | null; razao: string | null }>
}

export interface CartaoIa {
  sinal: string
  cartao: string
  condicao: string
  valor: string
  valorEstado: 'medido' | 'zero'
  mede: string
  /** Nulo = a tela não compara com o normal (o sinal "E ainda rende pouco" não tem normal). */
  contra: string | null
  regra: string
}

export interface EstourouIa {
  tipo: Leitura['tipo']
  frase: string
  /** O que a tela escreve a mais no estado (a explicação do não medido, o fim do erro). */
  textos: string[]
  /** O texto obrigatório de M10; só em "estourou e parou". */
  indicio: string[]
  cartoes: CartaoIa[]
}

export interface HorasVideoIa {
  tipo: BlocoDeHoras['tipo']
  frase: string
  extra: string
  estado: string
  publicacao: string
  total: string
  barras: Array<{ hora: string; views: string | null; viewsZero: boolean; motivoDaBarra: string | null; contador: string | null }>
  antes: string
  frases: string[]
  regua: Array<{ marca: string; video: string | null; videoMotivo: string | null; normal: string | null; normalMotivo: string | null }>
  frasesDaRegua: string[]
}

export interface SubidaIa {
  tipo: CartaoDaSubida['tipo']
  textos: string[]
}

export interface MudancasIa {
  tipo: 'nao_carregou' | 'vazia' | 'lista'
  rotulo: string
  motivo: string | null
  textos: string[]
  itens: Array<{ n: string; rotulo: string; quando: string }>
  observacoes: Array<{ n: string; texto: string }>
  /** O de-para de título cita o título antigo e o novo: texto de terceiros. */
  dePara: Array<{ n: string; texto: string }>
}

export interface MedidasVideoIa {
  /** O traço que ocupa a célula quando a tela não escreve nada naquela coluna. */
  sem: string
  /** Os textos que a tela mostra no lugar dos blocos quando o conjunto do canal falhou; vazio quando as medidas chegaram. */
  falhou: string[]
  resumo: ResumoIa
  idade: IdadeIa
  estourou: EstourouIa | null
  horas: HorasVideoIa
  subida: SubidaIa
  mudancas: MudancasIa
}


function resumoIa(d: DerivadoDoVideo): ResumoIa {
  const r = d.resumo
  const s = r.faixa.subida
  return {
    frase: r.frase,
    viewsAgora: { rotulo: r.faixa.viewsAgora.rotulo, texto: r.faixa.viewsAgora.texto, sub: r.faixa.viewsAgora.sub },
    subida: s.estado === 'nao_medido' || s.estado === 'nao_carregou'
      // a tela esconde o texto pequeno e mostra o motivo curto (ou "Não carregou")
      ? { rotulo: s.rotulo, estado: s.estado, valor: null, motivo: s.estado === 'nao_carregou' ? NAO_CARREGOU_TELA : s.sub, razao: null, sub: null }
      : { rotulo: s.rotulo, estado: s.estado, valor: s.valor ?? '', motivo: null, razao: s.razao, sub: s.sub },
  }
}

function idadeIa(b: BlocoDeIdade): IdadeIa {
  if (b.tipo === 'nao_carregou') return { tipo: b.tipo, frase: b.frase, extra: '', pontos: [] }
  if (b.tipo === 'ainda_nao_existe') return { tipo: b.tipo, frase: b.frase, extra: '', pontos: [] }
  if (b.tipo === 'nao_medido') return { tipo: b.tipo, frase: b.motivo, extra: b.extra, pontos: [] }
  return {
    tipo: b.tipo, frase: b.frase, extra: '',
    pontos: b.pontos.map((p) => ({
      rotulo: p.rotulo,
      video: p.video.tipo === 'medido' ? abrev(p.video.views) : null,
      videoMotivo: p.video.tipo === 'medido' ? null : p.video.tipo === 'ainda_nao_existe' ? 'ainda não existe' : p.video.curto,
      videoZero: p.video.tipo === 'medido' && p.video.views === 0,
      normal: p.normal.tipo === 'medido' ? `${abrev(p.normal.views)} (${p.normal.n} vídeos)` : null,
      normalMotivo: p.normal.tipo === 'medido' ? null : p.normal.frase,
      razao: p.razao?.texto ?? null,
    })),
  }
}

const igual = (f: boolean): string => (f ? ' Igual ao limite: bate.' : '')
const selo = (vale: boolean): string => (vale ? '✓ bate' : '✕ não bate')

function estourouIa(l: Leitura | null): EstourouIa | null {
  if (l === null) return null
  switch (l.tipo) {
    case 'ainda_nao_existe':
      return {
        tipo: l.tipo, indicio: [], cartoes: [],
        frase: `${TITULO_AINDA_SEM_LEITURA} ${fraseAindaSemLeitura(l)}`,
        textos: [],
      }
    case 'nao_carregou':
      return {
        tipo: l.tipo, indicio: [], cartoes: [],
        frase: TEXTOS_NAO_CARREGOU.titulo,
        textos: [TEXTOS_NAO_CARREGOU.corpo],
      }
    case 'nao_medido': {
      const passa = l.passaAExistir
      return {
        tipo: l.tipo, indicio: [], cartoes: [],
        frase: `Não medido: ${l.curta}.`,
        textos: [
          ...(l.aoVivo ? ['ao vivo ou estreia'] : []), l.titulo, ...(l.explica ? [l.explica] : []), ...(l.falta ? [l.falta.legenda] : []),
          ...(passa.tipo === 'sem_promessa' ? [] : [`Passa a existir: ${passa.tipo === 'data' ? `em ${dataBR(passa.data)} (faltam ${passa.faltam} ${passa.faltam === 1 ? 'dia' : 'dias'}).` : `${passa.texto}.`}`]),
        ],
      }
    }
    case 'nao_e_o_caso':
    case 'estourou_e_parou': {
      const { viewsCedo: a, quaseNada: b, reacao: c } = l.cartoes
      const nb = (b.valeCauda ? 1 : 0) + (b.valeRende ? 1 : 0)
      const seloB = `${b.vale ? '✓' : '✕'} ${nb} de 2 ${nb === 1 ? 'bate' : 'batem'}`
      const zeroCauda = b.cauda === 0, zeroRende = b.ganho === 0
      return {
        tipo: l.tipo, frase: l.frase, textos: [],
        indicio: l.tipo === 'estourou_e_parou' ? [TEXTO_M10.titulo, TEXTO_M10.oQueVimos, TEXTO_M10.hipoteseNossa, TEXTO_M10.oQueNinguemDeForaVe] : [],
        cartoes: [
          { sinal: 'Muitas views cedo', cartao: selo(a.vale), condicao: selo(a.vale), valor: milhar(a.valor), valorEstado: a.valor === 0 ? 'zero' : 'medido', mede: 'views nos 30 primeiros dias',
            contra: `${vezes(a.razao)} o normal do canal`, regra: `Bate se tiver ${milhar(a.limite)} views ou mais (${R.outlierMin}× o normal).${igual(a.igual)}` },
          { sinal: 'Quase nada depois', cartao: seloB, condicao: selo(b.valeCauda), valor: zeroCauda ? '0' : pct(b.cauda), valorEstado: zeroCauda ? 'zero' : 'medido',
            mede: zeroCauda ? 'nenhuma view depois dos 30 primeiros dias' : 'das views vieram depois do dia 30',
            contra: zeroCauda ? `O normal do canal é ${pct(b.normalCauda)}` : `${vezes(b.razaoCauda)} o normal do canal`, regra: `Bate se for até ${pct(b.limiteCauda)} (metade do normal).${igual(b.igualCauda)}` },
          { sinal: 'E ainda rende pouco', cartao: seloB, condicao: selo(b.valeRende), valor: zeroRende ? '0' : pct(b.rende), valorEstado: zeroRende ? 'zero' : 'medido',
            mede: zeroRende ? `view ganha nos últimos ${R.stillDias} dias` : `ganhos nos últimos ${R.stillDias} dias (${milhar(b.ganho)} views)`,
            contra: null, regra: `Bate se for até ${pct(b.limiteRende)} das views dos 30 primeiros dias.${igual(b.igualRende)}` },
          { sinal: 'Pouca reação do público', cartao: selo(c.vale), condicao: selo(c.vale), valor: pct(c.taxa), valorEstado: c.taxa === 0 ? 'zero' : 'medido', mede: 'curtidas e comentários por view, aos 30 dias',
            contra: `${vezes(c.razao)} o normal do canal · ${milhar(c.reacoes)} de ${milhar(c.views)} views`, regra: `Bate se for até ${pct(c.limite)} (metade do normal).${igual(c.igual)}` },
        ],
      }
    }
  }
}

function horasIa(b: BlocoDeHoras): HorasVideoIa {
  const vazio: HorasVideoIa = { tipo: b.tipo, frase: '', extra: '', estado: '', publicacao: '', total: '', barras: [], antes: '', frases: [], regua: [], frasesDaRegua: [] }
  const estado = `Leitura por hora: ${b.estado.texto}.`
  if (b.tipo === 'nao_carregou') return { ...vazio, frase: b.frase, estado }
  if (b.tipo === 'ainda_nao_existe') return { ...vazio, frase: b.frase }
  if (b.tipo === 'nao_medido') return { ...vazio, frase: b.frase, extra: b.extra ?? '', estado }
  const marcasN = b.regua.normal.tipo === 'medido' ? b.regua.normal.marcas : null
  return {
    ...vazio, estado, frase: b.frase,
    publicacao: `${b.publicacao}. ${b.subtitulo}`,
    total: b.total.tipo === 'medido' ? `Total das 72 horas: ${milharH(b.total.views)} views.` : b.total.frase,
    barras: b.barras.map((x) => ({
      hora: `${x.data}, ${x.intervalo}`,
      views: x.ganho === null ? null : milharH(x.ganho), viewsZero: x.ganho === 0,
      motivoDaBarra: x.ganho !== null ? null : x.tipo === 'ainda_nao_existe' ? 'ainda não existe' : 'não medido',
      contador: x.acumulado === null ? null : milharH(x.acumulado),
    })),
    antes: b.antesDaPrimeira?.texto ?? '', frases: b.frasesDasHoras,
    regua: b.regua.video.map((m) => {
      const n = marcasN?.find((x) => x.fracao === m.fracao)
      return {
        marca: m.fracao,
        video: m.horas === null ? null : `${m.horas} h`, videoMotivo: m.horas === null ? `${m.fracao}: não medido` : null,
        normal: n ? `${n.horas} h` : null, normalMotivo: n ? null : b.regua.normal.tipo === 'medido' ? 'não medido' : b.regua.normal.frase,
      }
    }),
    frasesDaRegua: [...(b.regua.normal.tipo !== 'medido' ? [b.regua.normal.frase] : []), ...b.regua.frasesDoVideo],
  }
}

function subidaIa(c: CartaoDaSubida): SubidaIa {
  switch (c.tipo) {
    case 'nao_carregou': return { tipo: c.tipo, textos: [c.frase] }
    case 'inconclusivo': return { tipo: c.tipo, textos: [c.titulo, c.texto, c.info] }
    case 'sem_subida': return { tipo: c.tipo, textos: [c.titulo, c.texto] }
    case 'subiu': return { tipo: c.tipo, textos: [c.fraseTopo, c.lista, c.nota] }
    case 'nao_medido': return { tipo: c.tipo, textos: [c.titulo, `${c.texto}.`] }
  }
}

function mudancasIa(l: ListaDeMudancas | null): MudancasIa {
  if (l === null) return { tipo: 'nao_carregou', rotulo: 'Mudanças deste vídeo', motivo: NAO_CARREGOU_TELA, textos: [], itens: [], observacoes: [], dePara: [] }
  return {
    tipo: l.itens.length === 0 ? 'vazia' : 'lista', rotulo: l.titulo, motivo: null,
    textos: [...(l.resumo ? [`${l.resumo.negrito}${l.resumo.resto}`] : []), ...(l.fraseDeDentro ? [l.fraseDeDentro] : []), ...(l.vazia ? [l.vazia] : [])],
    itens: l.itens.map((i) => ({ n: String(i.n), rotulo: i.rotulo, quando: i.quando })),
    observacoes: l.itens.flatMap((i) => [...(i.depoisDaLeitura ? [{ n: String(i.n), texto: 'depois da leitura do dia' }] : []), ...(i.marcaFora ? [{ n: String(i.n), texto: 'fora dos 14 dias antes' }] : [])]),
    dePara: l.itens.flatMap((i) => (i.deParaTexto !== null ? [{ n: String(i.n), texto: i.deParaTexto }] : [])),
  }
}

/** A projeção das medidas do vídeo. `estourou` é a leitura que a página mostraria (nula = o vídeo não tem o bloco). */
export function projetarMedidasDoVideo(d: DerivadoDoVideo, estourou: Leitura | null): MedidasVideoIa {
  return {
    sem: SEM, falhou: [],
    resumo: resumoIa(d), idade: idadeIa(d.idade), estourou: estourouIa(estourou), horas: horasIa(d.horas), subida: subidaIa(d.subida), mudancas: mudancasIa(d.lista),
  }
}

/** O texto que a página mostra no lugar dos blocos quando o conjunto do canal falhou (o estado de erro do mockup 13). */
export const TEXTOS_DO_ERRO_DO_HISTORICO = ['Não deu para abrir o histórico deste vídeo', 'Não deu para ler o histórico agora. Toque em “Tentar de novo”; se continuar, abra a tela mais tarde.'] as const

/** A projeção de quando o conjunto do canal falhou: a página mostra o estado de erro, o pacote diz o mesmo e não traz medida nenhuma. */
export function medidasDoVideoNaoCarregaram(): MedidasVideoIa {
  const vazio = { tipo: 'nao_carregou' as const, frase: '', extra: '' }
  return {
    sem: SEM, falhou: [...TEXTOS_DO_ERRO_DO_HISTORICO],
    resumo: { frase: '', viewsAgora: { rotulo: '', texto: '', sub: '' }, subida: { rotulo: '', estado: 'nao_carregou', valor: null, motivo: NAO_CARREGOU_TELA, razao: null, sub: null } },
    idade: { ...vazio, pontos: [] }, estourou: null,
    horas: { ...vazio, estado: '', publicacao: '', total: '', barras: [], antes: '', frases: [], regua: [], frasesDaRegua: [] },
    subida: { tipo: 'nao_carregou', textos: [] },
    mudancas: { tipo: 'nao_carregou', rotulo: '', motivo: NAO_CARREGOU_TELA, textos: [], itens: [], observacoes: [], dePara: [] },
  }
}

// ───────────────────────── o inventário de folhas
const CTRL = { descartado: 'controle de tela' } as const

export const INVENTARIO_MEDIDAS_VIDEO: Inventario = {
  'derivado.medidas.sem': 'rotulo', 'derivado.medidas.falhou[]': 'base',
  // resumo
  'derivado.medidas.resumo.frase': 'base',
  'derivado.medidas.resumo.viewsAgora.rotulo': 'rotulo', 'derivado.medidas.resumo.viewsAgora.texto': 'numero', 'derivado.medidas.resumo.viewsAgora.sub': 'base',
  'derivado.medidas.resumo.subida.rotulo': 'rotulo', 'derivado.medidas.resumo.subida.estado': CTRL, 'derivado.medidas.resumo.subida.valor': 'numero',
  'derivado.medidas.resumo.subida.motivo': 'motivo', 'derivado.medidas.resumo.subida.razao': 'base', 'derivado.medidas.resumo.subida.sub': 'base',

  // Views por idade
  'derivado.medidas.idade.tipo': CTRL, 'derivado.medidas.idade.frase': 'base', 'derivado.medidas.idade.extra': 'base',
  'derivado.medidas.idade.pontos[].rotulo': 'rotulo', 'derivado.medidas.idade.pontos[].video': 'numero', 'derivado.medidas.idade.pontos[].videoMotivo': 'motivo', 'derivado.medidas.idade.pontos[].videoZero': CTRL,
  'derivado.medidas.idade.pontos[].normal': 'numero', 'derivado.medidas.idade.pontos[].normalMotivo': 'motivo', 'derivado.medidas.idade.pontos[].razao': 'base',

  // Estourou e parou
  'derivado.medidas.estourou': CTRL, 'derivado.medidas.estourou.tipo': CTRL, 'derivado.medidas.estourou.frase': 'base', 'derivado.medidas.estourou.textos[]': 'base',
  'derivado.medidas.estourou.indicio[]': 'base',
  'derivado.medidas.estourou.cartoes[].sinal': 'rotulo', 'derivado.medidas.estourou.cartoes[].cartao': 'base', 'derivado.medidas.estourou.cartoes[].condicao': 'base',
  'derivado.medidas.estourou.cartoes[].valor': 'numero', 'derivado.medidas.estourou.cartoes[].valorEstado': CTRL, 'derivado.medidas.estourou.cartoes[].mede': 'base',
  'derivado.medidas.estourou.cartoes[].contra': 'base', 'derivado.medidas.estourou.cartoes[].regra': 'base',

  // as 72 horas
  'derivado.medidas.horas.tipo': CTRL, 'derivado.medidas.horas.frase': 'base', 'derivado.medidas.horas.extra': 'base', 'derivado.medidas.horas.estado': 'base',
  'derivado.medidas.horas.publicacao': 'base', 'derivado.medidas.horas.total': 'base',
  'derivado.medidas.horas.barras[].hora': 'rotulo', 'derivado.medidas.horas.barras[].views': 'numero', 'derivado.medidas.horas.barras[].viewsZero': CTRL,
  'derivado.medidas.horas.barras[].motivoDaBarra': 'motivo', 'derivado.medidas.horas.barras[].contador': 'numero',
  'derivado.medidas.horas.antes': 'base', 'derivado.medidas.horas.frases[]': 'base',
  'derivado.medidas.horas.regua[].marca': 'rotulo', 'derivado.medidas.horas.regua[].video': 'numero', 'derivado.medidas.horas.regua[].videoMotivo': 'motivo',
  'derivado.medidas.horas.regua[].normal': 'numero', 'derivado.medidas.horas.regua[].normalMotivo': 'motivo', 'derivado.medidas.horas.frasesDaRegua[]': 'base',

  // Subida
  'derivado.medidas.subida.tipo': CTRL, 'derivado.medidas.subida.textos[]': 'base',

  // Mudanças deste vídeo
  'derivado.medidas.mudancas.tipo': CTRL, 'derivado.medidas.mudancas.rotulo': 'rotulo', 'derivado.medidas.mudancas.motivo': 'motivo', 'derivado.medidas.mudancas.textos[]': 'base',
  'derivado.medidas.mudancas.itens[].n': 'rotulo', 'derivado.medidas.mudancas.itens[].rotulo': 'base', 'derivado.medidas.mudancas.itens[].quando': 'base',
  'derivado.medidas.mudancas.observacoes[].n': 'rotulo', 'derivado.medidas.mudancas.observacoes[].texto': 'base',
  'derivado.medidas.mudancas.dePara[].n': 'rotulo', 'derivado.medidas.mudancas.dePara[].texto': 'terceiros',
}

// ───────────────────────── células
const O = 'modelo.derivado.medidas'
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const terceiros = (texto: string, origem: string): Celula => ({ papel: 'terceiros', texto, origem })
const medido = (texto: string, origem: string, zero = false): Celula => (zero ? { papel: 'numero', estado: 'zero_medido', texto, x: 0, origem } : { papel: 'numero', estado: 'medido', texto, x: null, origem })
const naoMedido = (motivo: string | null, origem: string): Celula => ({ papel: 'numero', estado: 'nao_medido', motivo: motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO, origem })
const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada: false, colunas, linhas })
const tabelaLista = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'lista', nomeNoCorte, privada: false, colunas, linhas })

/** As tabelas e os avisos dos blocos de medida do vídeo; vazio quando as medidas não foram pedidas ao empacotador. */
export function tabelasDeMedidasDoVideo(m: MedidasVideoIa | null): { tabelas: Tabela[]; avisos: string[] } {
  if (m === null) return { tabelas: [], avisos: [] }
  if (m.falhou.length) return { tabelas: [], avisos: [...m.falhou] }
  const tabelas: Tabela[] = []
  const avisos: string[] = []
  const SEMC = rotulo(m.sem, `${O}.sem`)

  // resumo e faixa de números
  const r = m.resumo
  const sub = r.subida
  avisos.push(r.frase)
  tabelas.push(tabelaFixa('video-resumo-numeros', 'Resumo do vídeo: views agora e subida', 'resumo do vídeo', ['Medida', 'Valor', 'Razão', 'Base'], [
    [rotulo(r.viewsAgora.rotulo, `${O}.resumo.viewsAgora.rotulo`), medido(r.viewsAgora.texto, `${O}.resumo.viewsAgora.texto`), SEMC, base(r.viewsAgora.sub, `${O}.resumo.viewsAgora.sub`)],
    [rotulo(sub.rotulo, `${O}.resumo.subida.rotulo`),
      sub.valor !== null ? medido(sub.valor, `${O}.resumo.subida.valor`) : naoMedido(sub.motivo, `${O}.resumo.subida.motivo`),
      sub.razao ? base(sub.razao, `${O}.resumo.subida.razao`) : SEMC,
      sub.sub ? base(sub.sub, `${O}.resumo.subida.sub`) : SEMC],
  ]))

  // Views por idade
  const I = `${O}.idade`
  const id = m.idade
  avisos.push(id.frase)
  if (id.extra) avisos.push(id.extra)
  if (id.pontos.length) {
    tabelas.push(tabelaLista('video-idade', 'Views por idade: o vídeo contra o normal do canal', 'views por idade', ['Idade', 'Vídeo', 'Normal do canal', 'Razão'],
      id.pontos.map((p, i) => [
        rotulo(p.rotulo, `${I}.pontos[${i}].rotulo`),
        p.video !== null ? medido(p.video, `${I}.pontos[${i}].video`, p.videoZero) : naoMedido(p.videoMotivo, `${I}.pontos[${i}].videoMotivo`),
        p.normal !== null ? medido(p.normal, `${I}.pontos[${i}].normal`) : naoMedido(p.normalMotivo, `${I}.pontos[${i}].normalMotivo`),
        p.razao ? base(p.razao, `${I}.pontos[${i}].razao`) : SEMC,
      ])))
  }

  // Estourou e parou
  const E = `${O}.estourou`
  const es = m.estourou
  if (es) {
    avisos.push(es.frase, ...es.textos, ...es.indicio)
    if (es.cartoes.length) {
      tabelas.push(tabelaFixa('video-estourou', 'Estourou e parou: os três sinais', 'estourou e parou', ['Sinal', 'Resultado do cartão', 'Resultado da condição', 'Valor do vídeo', 'O que o valor mede', 'Contra o normal', 'Regra'],
        es.cartoes.map((c, i) => [
          rotulo(c.sinal, `${E}.cartoes[${i}].sinal`), base(c.cartao, `${E}.cartoes[${i}].cartao`), base(c.condicao, `${E}.cartoes[${i}].condicao`),
          medido(c.valor, `${E}.cartoes[${i}].valor`, c.valorEstado === 'zero'), base(c.mede, `${E}.cartoes[${i}].mede`),
          c.contra !== null ? base(c.contra, `${E}.cartoes[${i}].contra`) : SEMC, base(c.regra, `${E}.cartoes[${i}].regra`),
        ])))
    }
  }

  // as 72 horas
  const H = `${O}.horas`
  const h = m.horas
  avisos.push(...[h.frase, h.extra, h.estado, h.publicacao, h.total, h.antes, ...h.frases, ...h.frasesDaRegua].filter((x) => x !== ''))
  if (h.barras.length) {
    tabelas.push(tabelaLista('video-horas', 'As primeiras 72 horas, hora a hora', 'primeiras 72 horas', ['Hora', 'Views ganhas', 'Contador no fim da hora'],
      h.barras.map((x, i) => [
        rotulo(x.hora, `${H}.barras[${i}].hora`),
        x.views !== null ? medido(x.views, `${H}.barras[${i}].views`, x.viewsZero) : naoMedido(x.motivoDaBarra, `${H}.barras[${i}].motivoDaBarra`),
        x.contador !== null ? medido(x.contador, `${H}.barras[${i}].contador`) : x.motivoDaBarra !== null ? naoMedido(x.motivoDaBarra, `${H}.barras[${i}].motivoDaBarra`) : SEMC,
      ])))
    tabelas.push(tabelaFixa('video-horas-regua', 'As primeiras 72 horas: quando chegou a 1/4, 1/2 e 3/4 das views', 'régua das 72 horas', ['Marca', 'Este vídeo', 'Normal do canal'],
      h.regua.map((x, i) => [
        rotulo(x.marca, `${H}.regua[${i}].marca`),
        x.video !== null ? medido(x.video, `${H}.regua[${i}].video`) : naoMedido(x.videoMotivo, `${H}.regua[${i}].videoMotivo`),
        x.normal !== null ? medido(x.normal, `${H}.regua[${i}].normal`) : naoMedido(x.normalMotivo, `${H}.regua[${i}].normalMotivo`),
      ])))
  }

  // Subida
  avisos.push(...m.subida.textos)

  // Mudanças deste vídeo
  const M = `${O}.mudancas`
  const mu = m.mudancas
  avisos.push(...mu.textos)
  if (mu.motivo !== null) {
    tabelas.push(tabelaFixa('video-mudancas-estado', 'Mudanças deste vídeo', 'mudanças deste vídeo', ['Medida', 'Valor'], [[rotulo(mu.rotulo, `${M}.rotulo`), naoMedido(mu.motivo, `${M}.motivo`)]]))
  }
  if (mu.itens.length) {
    tabelas.push(tabelaLista('video-mudancas', 'Mudanças deste vídeo', 'mudanças deste vídeo', ['Nº', 'Mudança', 'Quando'],
      mu.itens.map((x, i) => [rotulo(x.n, `${M}.itens[${i}].n`), base(x.rotulo, `${M}.itens[${i}].rotulo`), base(x.quando, `${M}.itens[${i}].quando`)])))
  }
  if (mu.observacoes.length) {
    tabelas.push(tabelaLista('video-mudancas-observacoes', 'Mudanças deste vídeo: observações', 'observações das mudanças', ['Nº', 'Observação'],
      mu.observacoes.map((x, i) => [rotulo(x.n, `${M}.observacoes[${i}].n`), base(x.texto, `${M}.observacoes[${i}].texto`)])))
  }
  if (mu.dePara.length) {
    tabelas.push(tabelaLista('video-mudancas-de-para', 'Mudanças deste vídeo: de quê para quê', 'de-para das mudanças', ['Nº', 'De e para'],
      mu.dePara.map((x, i) => [rotulo(x.n, `${M}.dePara[${i}].n`), terceiros(x.texto, `${M}.dePara[${i}].texto`)])))
  }
  return { tabelas, avisos }
}
