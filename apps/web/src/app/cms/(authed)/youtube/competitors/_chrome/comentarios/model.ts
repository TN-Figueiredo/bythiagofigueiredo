// A5 · E5a · Tarefa C2: o modelo puro da seção "Comentários de destaque". Entra o dado do leitor (C1), sai um objeto de tela em
// texto e números prontos. Nenhuma ida ao banco, nenhum componente.
// CONTRATO: `SecaoView` é dado do componente de servidor da seção. NÃO é campo de `HistoricoView`, de `CanalView` nem do modelo do `_chrome`.
import { COMMENT_RULES } from '@/lib/youtube/observatorio/comentarios/regras'
import type { Marco } from '@/lib/youtube/observatorio/comentarios/tipos'
import type {
  CartaoBase, CartaoContagem, CartaoIdentidade, CartaoTexto, ComentariosDoVideo, CurtidasNoMarco, EstadoDoMarco, MotivoDoCartao, Nivel,
} from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import { FRASES, RESPOSTAS_QUE_O_YOUTUBE_MOSTRA, dias } from './frases'
import type { AutorDaFala, ChaveDeMotivo, FalaView, FioView } from './fio-model'

export const MARCOS_DA_TELA: readonly Marco[] = [1, 7, 30]
const DIA_MS = 86_400_000

export type Tom = 'ok' | 'zero' | 'nm' | 'erro' | 'pontilhado'
export type { ChaveDeMotivo }

export interface AbaView { marco: Marco; rotulo: string; estado: string; tom: Tom }
export interface SeloView { texto: string; forma: Tom }
export interface EstadoView {
  kind: 'estado'; marco: Marco; tom: Tom; titulo: string; corpo: string | null; selo: SeloView | null; nota: string | null
  /** Só no erro de leitura: mostra "Tentar de novo". */
  tentar: boolean
}
/** Só os motivos que existem na lista (n > 0): o texto diz quantos. */
export interface LegendaView { chave: ChaveDeMotivo; rotulo: string; texto: string; n: number }
export interface CurtidaView {
  marco: Marco; rotulo: string; tipo: 'n' | 'fora' | 'fecha' | 'ainda'; texto: string
  /** O número cru quando `tipo === 'n'` (o pacote da IA lê daqui, nunca do texto formatado). */
  n: number | null
  /** 0 a 100, na mesma escala de todos os cartões. */
  pct: number
}
export type AutorView =
  | { tipo: 'identidade'; nome: string; fotoUrl: string | null; ate: string }
  | { tipo: 'espectador' } | { tipo: 'reservado' } | { tipo: 'grande'; faixa: string | null }
  | { tipo: 'criador'; nome: string } | { tipo: 'proprio' }
export type RespostaView =
  | { forma: 'respondeu'; titulo: string; textos: Array<{ texto: string; cortado: boolean; data: string | null }> | null; reservado: string | null }
  | { forma: 'nao_vimos' | 'nao_sabemos'; texto: string }
export interface DegrauView { degrau: 1 | 2 | 3; texto: string }
export interface CartaoView {
  id: string; posicao: number; de: number; rotuloDaPosicao: string
  chave: ChaveDeMotivo; motivo: string
  entrouNoDia: string | null
  autor: AutorView
  /** Nulo no nível contagem: o texto não existe nesse objeto. */
  texto: { texto: string; cortado: boolean; temEndereco: boolean } | null
  textoReservado: boolean
  resposta: RespostaView | null
  curtidas: CurtidaView[]
  base: { tamanho: DegrauView | null; razao: DegrauView | 'nao_medida' } | null
  saiu: string | null
  rodape: { publicado: string | null; respostas: { n: number; texto: string } | null }
  /** O comentário é um retrato antigo de quem saiu dos 12 (lista "Ver os N que saíram"). */
  saidoDosDoze: boolean
  /** O mesmo comentário no formato do fio único (a tela desenha daqui; o pacote da IA lê os campos acima). */
  fio: FioView
}
export interface MovimentoView { texto: string; saidas: string | null; primeiro: string | null; entraram: number; sairam: number }
export interface ListaView {
  kind: 'lista'; marco: Marco; frase: { negrito: string; resto: string | null }
  barra: { n: number; de: number; todos: boolean; texto: string }
  legenda: LegendaView[]
  /** Uma frase apagada com os motivos opcionais que ficaram em zero; nulo sem zero. */
  zeros: string | null
  inscritosOcultos: string | null
  movimento: MovimentoView
  cartoes: CartaoView[]; saidos: CartaoView[]
}
export type PainelView = EstadoView | ListaView
export interface SecaoView {
  titulo: string
  info: { titulo: string; rotulo: string; paragrafos: string[] }
  nivel: Nivel
  faixa: string | null
  mencoesTrocadas: number
  abas: AbaView[]
  aberta: Marco
  paineis: Record<Marco, PainelView>
  fonte: string
}
export interface OpcoesDaSecao {
  hojeSP: string
  canalNome: string
  marcoAberto?: Marco
  /** A publicação do vídeo (ms): "publicado em" e a idade em que foi descoberto. */
  t0Ms: number
  descobertoEmMs: number | null
}

const fmtDm = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
export const dmSP = (ms: number): string => fmtDm.format(ms)
/** AAAA-MM-DD (ou ISO com hora) para dd/mm. */
export function dmDeData(s: string): string {
  if (s.length > 10) { const t = Date.parse(s); if (Number.isFinite(t)) return dmSP(t) }
  return `${s.slice(8, 10)}/${s.slice(5, 7)}`
}
const num = (n: number): string => n.toLocaleString('pt-BR')

const URL_RE = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|br|io|me|ly|gg|tv)(?:\/\S*)?\b/i
export const temEndereco = (s: string): boolean => URL_RE.test(s)

const CHAVE: Record<MotivoDoCartao, ChaveDeMotivo> = { curtidos: 'c', criador: 'k', canal_acompanhado: 'a', inscritos: 'g', canal_proprio: 'p' }
const ROTULO: Record<ChaveDeMotivo, string> = {
  c: FRASES.motivoCurtidos, k: FRASES.motivoCriador, a: FRASES.motivoAcompanhado, g: FRASES.motivoGrande, p: FRASES.seloSeuCanal,
}
const DEGRAU_TAMANHO: Record<string, 1 | 2 | 3> = { '100k_1m': 1, '1m_10m': 2, '10m_mais': 3 }
const DEGRAU_RAZAO: Record<string, 1 | 2 | 3> = { '10x_100x': 1, '100x_1000x': 2, '1000x_mais': 3 }

type Cartao = CartaoContagem | CartaoTexto | CartaoIdentidade
const comTexto = (c: Cartao): c is CartaoTexto | CartaoIdentidade => 'texto' in c

function abaDoEstado(e: EstadoDoMarco): { estado: string; tom: Tom } {
  switch (e.estado) {
    case 'ok': return { estado: FRASES.abaGuardados(e.resumo.escolhidos), tom: 'ok' }
    case 'sem_comentarios': return { estado: FRASES.abaNenhum, tom: 'zero' }
    case 'desligados': return { estado: FRASES.abaDesligados, tom: 'nm' }
    case 'nao_coletado': return { estado: FRASES.abaNaoColetado, tom: 'nm' }
    case 'antes_da_coleta': return { estado: FRASES.abaAntesDaColeta, tom: 'nm' }
    case 'fecha_em': return { estado: FRASES.abaFechaEm(dmSP(e.fechaEmMs)), tom: 'pontilhado' }
    case 'a_caminho': return { estado: FRASES.abaACaminho, tom: 'pontilhado' }
    case 'coleta_parada': return { estado: FRASES.abaParada, tom: 'erro' }
    case 'coleta_nao_comecou': return { estado: FRASES.abaNaoComecou, tom: 'nm' }
  }
}

function estadoSemLista(m: Marco, e: EstadoDoMarco, o: OpcoesDaSecao, marcos: Record<Marco, EstadoDoMarco>): EstadoView {
  const base = { kind: 'estado' as const, marco: m, tentar: false }
  switch (e.estado) {
    case 'sem_comentarios':
      return { ...base, tom: 'zero', titulo: FRASES.zeroMedidoTitulo(m), corpo: FRASES.zeroMedidoCorpo(dmSP(e.tomadoEmMs)), selo: { texto: FRASES.zeroMedidoSelo, forma: 'zero' }, nota: FRASES.zeroMedidoNota }
    case 'desligados':
      return { ...base, tom: 'nm', titulo: FRASES.desligadosTitulo, corpo: FRASES.desligadosCorpo(o.canalNome), selo: { texto: FRASES.desligadosSelo, forma: 'nm' }, nota: FRASES.desligadosNota }
    case 'nao_coletado': {
      const titulo = FRASES.naoColetadoTitulo(m)
      const c = e.porque
      if (c.causa === 'tarde') {
        const prazo = Math.round((COMMENT_RULES.marks.find(x => x.mark === m)?.untilH ?? 0) / 24)
        const desc = o.descobertoEmMs === null ? null : Math.max(0, Math.floor((o.descobertoEmMs - o.t0Ms) / DIA_MS))
        const quando = o.descobertoEmMs === null ? null : dmSP(o.descobertoEmMs)
        return { ...base, tom: 'nm', titulo, corpo: FRASES.tardeCorpo(desc, prazo), selo: quando ? { texto: FRASES.tardeSelo(quando), forma: 'nm' } : null, nota: null }
      }
      if (c.causa === 'lista_vazia') {
        const nota = [(c.totalDoDia ?? 0) > 0 ? FRASES.listaVaziaNota : null, FRASES.erroNota(dmSP(c.ateMs), c.encerrada)].filter((x): x is string => x !== null).join(' ')
        return { ...base, tom: 'nm', titulo, corpo: FRASES.listaVaziaCorpo(dmSP(c.tomadoEmMs), c.totalDoDia), selo: { texto: FRASES.abaNaoColetado, forma: 'nm' }, nota }
      }
      if (c.causa === 'erro') {
        return { ...base, tom: 'nm', titulo, corpo: FRASES.erroCorpo(dmSP(c.tentouEmMs), c.codigo), selo: { texto: FRASES.erroSelo(dmSP(c.tentouEmMs)), forma: 'nm' }, nota: FRASES.erroNota(dmSP(c.ateMs), c.encerrada) }
      }
      return { ...base, tom: 'nm', titulo: FRASES.janelaPerdida(m), corpo: null, selo: { texto: FRASES.abaNaoColetado, forma: 'nm' }, nota: FRASES.janelaPerdidaNota }
    }
    case 'antes_da_coleta': {
      // O próximo retrato que ainda vem (fecha em / a caminho) é dito junto: o vídeo anterior à coleta pode ganhar os marcos seguintes.
      let proximo: { d: number; dm: string } | null = null
      for (const x of MARCOS_DA_TELA) {
        const ex = marcos[x]
        if (x <= m) continue
        if (ex.estado === 'fecha_em') { proximo = { d: x, dm: dmSP(ex.fechaEmMs) }; break }
        if (ex.estado === 'a_caminho') { proximo = { d: x, dm: dmSP(ex.ateMs) }; break }
      }
      return { ...base, tom: 'nm', titulo: FRASES.antesDaColetaTitulo(m), corpo: FRASES.antesDaColetaCorpo(dmSP(e.coletaDesdeMs), dmSP(o.t0Ms), proximo), selo: null, nota: null }
    }
    case 'fecha_em':
      return { ...base, tom: 'pontilhado', titulo: FRASES.fechaEmTitulo(m, dmSP(e.fechaEmMs)), corpo: null, selo: { texto: FRASES.fechaEmSelo, forma: 'pontilhado' }, nota: FRASES.fechaEmNota(m, dmSP(e.fechaEmMs)) }
    case 'a_caminho':
      return { ...base, tom: 'pontilhado', titulo: FRASES.aCaminho(m, dmSP(e.fezEmMs), dmSP(e.ateMs)), corpo: null, selo: { texto: FRASES.aCaminhoSelo, forma: 'pontilhado' }, nota: null }
    case 'coleta_parada':
      return { ...base, tom: 'erro', titulo: e.semOk ? FRASES.paradaSemOk(dmSP(e.desdeMs)) : FRASES.parada(dmSP(e.desdeMs)), corpo: null, selo: { texto: FRASES.paradaSelo, forma: 'erro' }, nota: null }
    case 'coleta_nao_comecou':
      return { ...base, tom: 'nm', titulo: FRASES.naoComecou, corpo: null, selo: null, nota: null }
    case 'ok':
      // retrato ok sem nenhum cartão no marco = leitura incompleta; não acusa o YouTube
      return { ...estadoDeErro(), marco: m }
  }
}

function curtidasDoCartao(c: CartaoBase, marcos: Record<Marco, EstadoDoMarco>, maximo: number): CurtidaView[] {
  return MARCOS_DA_TELA.map(m => {
    const v: CurtidasNoMarco = c.curtidas[m]
    const rotulo = dias(m)
    if (typeof v === 'number') return { marco: m, rotulo, tipo: 'n' as const, texto: num(v), n: v, pct: maximo > 0 ? Math.max(v > 0 ? 4 : 0, Math.round((v / maximo) * 100)) : 0 }
    if (v === 'fora_dos_12') return { marco: m, rotulo, tipo: 'fora' as const, n: null, texto: FRASES.foraDos12, pct: 0 }
    const e = marcos[m]
    if (e.estado === 'fecha_em') return { marco: m, rotulo, tipo: 'fecha' as const, n: null, texto: FRASES.fechaEmCurto(dmSP(e.fechaEmMs)), pct: 0 }
    const vaiVir = e.estado === 'a_caminho' || e.estado === 'coleta_parada' || e.estado === 'coleta_nao_comecou'
    return { marco: m, rotulo, tipo: 'ainda' as const, n: null, texto: vaiVir ? FRASES.semRetratoAinda : FRASES.semRetrato, pct: 0 }
  })
}

function autorDoCartao(c: Cartao, nivel: Nivel, canalNome: string): AutorView {
  if (c.motivo === 'canal_proprio') return { tipo: 'proprio' }
  const nomeDoCriador = c.criadorNome ?? canalNome
  if (c.doCriador) return { tipo: 'criador', nome: nomeDoCriador }
  if (!comTexto(c)) return { tipo: 'reservado' }
  const a = c.autor
  if (a.tipo === 'criador') return { tipo: 'criador', nome: nomeDoCriador }
  if (a.tipo === 'canal_grande') return { tipo: 'grande', faixa: c.faixas.tamanho }
  if (a.tipo === 'com_identidade' && nivel === 'identidade') return { tipo: 'identidade', nome: a.nome, fotoUrl: a.fotoUrl, ate: dmDeData(a.guardadaAte) }
  return { tipo: 'espectador' }
}

/** O autor da tela do vídeo no formato do fio: o `'criador'` perde o nome (vem de `CriadorDoFio`). */
export function autorDaFala(a: AutorView): AutorDaFala {
  return a.tipo === 'criador' ? { tipo: 'criador' } : a
}

function respostaDoCartao(c: Cartao, canalNome: string): RespostaView | null {
  if (c.doCriador || c.motivo === 'canal_proprio') return null
  const nome = c.criadorNome ?? canalNome
  if (c.criador === 'respondeu') {
    if (!comTexto(c)) return { forma: 'respondeu', titulo: FRASES.respondeu(nome), textos: null, reservado: FRASES.respondeuReservado }
    return { forma: 'respondeu', titulo: FRASES.respondeu(nome), textos: c.respostasDoCriador.map(r => ({ texto: r.texto, cortado: r.cortado, data: r.publicadoEm ? dmDeData(r.publicadoEm) : null })), reservado: null }
  }
  if (c.respostas === null || c.respostas <= 0) return null
  if (c.criador === 'nao_vimos') return { forma: 'nao_vimos', texto: FRASES.naoVimos(c.respostas) }
  // "Não sabemos" só existe quando o YouTube mostrou menos respostas do que há; com 5 ou menos, nunca.
  if (c.respostas <= RESPOSTAS_QUE_O_YOUTUBE_MOSTRA) return null
  return { forma: 'nao_sabemos', texto: FRASES.naoSabemos(RESPOSTAS_QUE_O_YOUTUBE_MOSTRA, c.respostas) }
}

function cartaoView(c: Cartao, i: number, de: number, m: Marco, ctx: { nivel: Nivel; marcos: Record<Marco, EstadoDoMarco>; max: number; maxPainel: number; hojeSP: string; canalNome: string; entrou: boolean; saido: boolean }): CartaoView {
  const chave = CHAVE[c.motivo]
  const t = comTexto(c) ? c.texto : null
  const tamanho = c.faixas.tamanho
  const razao = c.faixas.razao
  const base = c.motivo === 'inscritos' && (tamanho || razao)
    ? {
        tamanho: tamanho && DEGRAU_TAMANHO[tamanho] ? { degrau: DEGRAU_TAMANHO[tamanho], texto: FRASES.tamanho[tamanho] ?? tamanho } : null,
        razao: razao && DEGRAU_RAZAO[razao] ? { degrau: DEGRAU_RAZAO[razao], texto: FRASES.razao[razao] ?? razao } : ('nao_medida' as const),
      }
    : null
  const resp = c.respostas === null ? null : FRASES.respostasN(c.respostas)
  const pub = comTexto(c) ? FRASES.publicadoEm(dmDeData(c.publicadoEm)) : null
  const autor = autorDoCartao(c, ctx.nivel, ctx.canalNome)
  const resposta = respostaDoCartao(c, ctx.canalNome)
  const curtidasDoMarco: CurtidasNoMarco = c.curtidas[m]
  const entrou = ctx.entrou ? FRASES.entrouNoDia(m) : null
  const rotuloDaPosicao = FRASES.posicao(i + 1, de)
  const textoPronto = t === null ? null : { texto: t, cortado: comTexto(c) ? c.cortado : false, temEndereco: temEndereco(t) }
  const view = fioDoCartao({
    id: `cd-${m}-${c.ordem}`, c, autor, resposta, texto: textoPronto, curtidasDoMarco, marco: m, maxPainel: ctx.maxPainel,
    posicao: rotuloDaPosicao, entrou, saido: ctx.saido, chave, pastilha: ROTULO[chave], respostas: c.respostas === null ? null : { n: c.respostas, texto: resp as string },
    publicado: comTexto(c) ? dmDeData(c.publicadoEm) : null,
  })
  return {
    id: `cd-${m}-${c.ordem}`, posicao: i + 1, de, rotuloDaPosicao, chave, motivo: ROTULO[chave],
    entrouNoDia: entrou,
    autor,
    texto: textoPronto,
    textoReservado: t === null,
    resposta,
    curtidas: curtidasDoCartao(c, ctx.marcos, ctx.max),
    base,
    saiu: c.saiuDoYouTubeDesde === null ? null : FRASES.saiuDesde(c.saiuDoYouTubeDesde === ctx.hojeSP ? `hoje (${dmDeData(c.saiuDoYouTubeDesde)})` : dmDeData(c.saiuDoYouTubeDesde)),
    rodape: { publicado: pub, respostas: c.respostas === null ? null : { n: c.respostas, texto: resp as string } },
    saidoDosDoze: ctx.saido,
    fio: view,
  }
}

interface InsumoDoFio {
  id: string; c: Cartao; autor: AutorView; resposta: RespostaView | null; texto: CartaoView['texto']
  curtidasDoMarco: CurtidasNoMarco; marco: Marco; maxPainel: number; posicao: string; entrou: string | null; saido: boolean
  chave: ChaveDeMotivo; pastilha: string; respostas: { n: number; texto: string } | null; publicado: string | null
}

/** Converte o cartão para o fio único. A régua compara com o mais curtido DA LISTA daquele painel, na idade da aba. */
function fioDoCartao(x: InsumoDoFio): FioView {
  const v = x.curtidasDoMarco
  let curtidas: string | null = null
  let regua: number | null = null
  if (typeof v === 'number') {
    curtidas = `${num(v)} com ${dias(x.marco)}`
    regua = v <= 0 || x.maxPainel <= 0 ? 0 : Math.min(100, Math.max(4, Math.round((v / x.maxPainel) * 100)))
  } else if (v === 'fora_dos_12') {
    curtidas = FRASES.foraDos12
  }
  const r = x.resposta
  const respostas: FalaView[] = r && r.forma === 'respondeu' && r.textos
    ? r.textos.map((t): FalaView => ({ autor: { tipo: 'criador' }, data: t.data, texto: t.texto, cortado: t.cortado }))
    : []
  const raiz: FalaView = { autor: autorDaFala(x.autor), data: x.publicado, texto: x.texto === null ? null : x.texto.texto, cortado: x.texto?.cortado ?? false }
  return {
    id: x.id,
    raiz,
    respostas,
    respostaReservada: r && r.forma === 'respondeu' ? r.reservado : null,
    meta: { curtidas, regua, posicao: x.posicao, respostas: x.respostas },
    marcas: { entrou: x.entrou, saido: x.saido },
    // o motivo "com o criador" já é dito pela resposta com foto; o próprio canal já é dito pelo selo do autor
    pastilha: x.chave === 'k' || x.chave === 'p' || x.c.doCriador ? null : { chave: x.chave, texto: x.pastilha },
  }
}

const noMarco = (c: Cartao, m: Marco): boolean => c.nosMarcos.includes(m)
const numeroOuNulo = (v: CurtidasNoMarco): number | null => (typeof v === 'number' ? v : null)

function ordenar(cs: Cartao[], m: Marco): Cartao[] {
  return [...cs].sort((a, b) => {
    const ca = numeroOuNulo(a.curtidas[m]) ?? -1
    const cb = numeroOuNulo(b.curtidas[m]) ?? -1
    if (cb !== ca) return cb - ca
    const ra = a.respostas ?? -1
    const rb = b.respostas ?? -1
    if (rb !== ra) return rb - ra
    // a posição do YouTube no marco (menor = mais relevante); sem leitura vai depois
    const pa = a.posicao[m] ?? Number.MAX_SAFE_INTEGER
    const pb = b.posicao[m] ?? Number.MAX_SAFE_INTEGER
    if (pa !== pb) return pa - pb
    return a.ordem - b.ordem
  })
}

function listaDoMarco(m: Marco, dados: ComentariosDoVideo, e: Extract<EstadoDoMarco, { estado: 'ok' }>, max: number, o: OpcoesDaSecao): ListaView | null {
  const todos = dados.comentarios as Cartao[]
  const doDia = ordenar(todos.filter(c => noMarco(c, m)), m)
  if (doDia.length === 0) return null
  const r = e.resumo
  // O marco anterior com retrato ok, para "entraram" e "saíram".
  const anterior = [...MARCOS_DA_TELA].reverse().find(x => x < m && dados.marcos[x].estado === 'ok') ?? null
  const proximo = MARCOS_DA_TELA.find(x => x > m) ?? null
  const entraram = anterior === null ? [] : doDia.filter(c => !noMarco(c, anterior))
  const saidosBrutos = anterior === null ? [] : ordenar(todos.filter(c => noMarco(c, anterior) && !noMarco(c, m)), anterior)
  const maxDe = (cs: Cartao[], marco: Marco): number => {
    let mx = 0
    for (const c of cs) { const v = numeroOuNulo(c.curtidas[marco]); if (v !== null && v > mx) mx = v }
    return mx
  }
  const ctx = { nivel: dados.nivel, marcos: dados.marcos, max, hojeSP: o.hojeSP, canalNome: o.canalNome }
  const maxDoDia = maxDe(doDia, m)
  const cartoes = doDia.map((c, i) => cartaoView(c, i, doDia.length, m, { ...ctx, maxPainel: maxDoDia, entrou: anterior !== null && !noMarco(c, anterior), saido: false }))
  const saidos = saidosBrutos.map((c, i) => cartaoView(c, i, saidosBrutos.length, anterior as Marco, { ...ctx, maxPainel: maxDe(saidosBrutos, anterior as Marco), entrou: false, saido: true }))
    .map(v => ({ ...v, id: v.id.replace(/^cd-/, 'cd-saiu-') + `-${m}`, fio: { ...v.fio, id: v.id.replace(/^cd-/, 'cd-saiu-') + `-${m}` } }))

  const n = doDia.length
  const completo = r.amostraCompleta === true
  const de = completo ? (r.totalDoDia ?? r.amostra ?? n) : (r.amostra ?? COMMENT_RULES.pool)
  const conta = (k: MotivoDoCartao) => doDia.filter(c => c.motivo === k).length
  const nC = conta('curtidos'), nK = conta('criador'), nA = conta('canal_acompanhado'), nG = conta('inscritos')
  const resp = doDia.filter(c => !c.doCriador && c.criador === 'respondeu').length
  const legenda: LegendaView[] = []
  if (nC > 0) legenda.push({ chave: 'c', rotulo: FRASES.motivoCurtidos, n: nC, texto: FRASES.legendaCurtidos(nC) })
  if (nK > 0) legenda.push({ chave: 'k', rotulo: FRASES.motivoCriador, n: nK, texto: FRASES.legendaCriador(nK) })
  if (nA > 0) legenda.push({ chave: 'a', rotulo: FRASES.motivoAcompanhado, n: nA, texto: FRASES.legendaAcompanhado(nA) })
  if (nG > 0) legenda.push({ chave: 'g', rotulo: FRASES.motivoGrande, n: nG, texto: FRASES.legendaGrandeCurta(nG) })
  const zeros = nA === 0 && nG === 0 ? FRASES.zerosAmbos : nA === 0 ? FRASES.zeroAcompanhado : nG === 0 ? FRASES.zeroGrande : null
  const frase = {
    negrito: resp > 0 ? FRASES.resumoRespondeu(resp, n, m) : FRASES.resumoNaoVimos(n, m),
    resto: completo ? FRASES.resumoVideoTinha(de) : FRASES.resumoLemos(de),
  }
  const semTamanho = r.autoresSemTamanho ?? 0

  const movimento: MovimentoView = anterior === null
    ? { texto: FRASES.primeiroRetrato(proximo), saidas: null, primeiro: FRASES.primeiroRetrato(proximo), entraram: 0, sairam: 0 }
    : {
        texto: FRASES.entraram(entraram.length, anterior, m), saidas: FRASES.sairam(saidosBrutos.length),
        primeiro: null, entraram: entraram.length, sairam: saidosBrutos.length,
      }

  return {
    kind: 'lista', marco: m, frase,
    barra: { n, de, todos: completo, texto: FRASES.barra(n, de) },
    legenda, zeros, inscritosOcultos: semTamanho > 0 ? FRASES.inscritosOcultos(semTamanho) : null,
    movimento, cartoes, saidos,
  }
}

export function secaoDeComentarios(dados: ComentariosDoVideo, o: OpcoesDaSecao): SecaoView {
  const cartoes = dados.comentarios as Cartao[]
  let max = 0
  for (const c of cartoes) for (const m of MARCOS_DA_TELA) { const v = numeroOuNulo(c.curtidas[m]); if (v !== null && v > max) max = v }
  const paineis = {} as Record<Marco, PainelView>
  for (const m of MARCOS_DA_TELA) {
    const e = dados.marcos[m]
    paineis[m] = (e.estado === 'ok' ? listaDoMarco(m, dados, e, max, o) : null) ?? estadoSemLista(m, e, o, dados.marcos)
  }
  const abas: AbaView[] = MARCOS_DA_TELA.map(m => {
    const e = dados.marcos[m]
    // Um painel de "ok" sem comentário nenhum cai no estado "não carregou": a aba diz o mesmo.
    const a = e.estado === 'ok' && paineis[m].kind === 'estado' ? { estado: FRASES.abaNaoCarregou, tom: 'erro' as Tom } : abaDoEstado(e)
    return { marco: m, rotulo: dias(m), estado: a.estado, tom: a.tom }
  })
  // A aba aberta é a última cujo estado não é "fecha em" nem "a caminho".
  const abertas = MARCOS_DA_TELA.filter(m => dados.marcos[m].estado !== 'fecha_em' && dados.marcos[m].estado !== 'a_caminho')
  let aberta = o.marcoAberto ?? abertas[abertas.length - 1] ?? 1
  // Vídeo anterior à coleta: a aba aberta é a primeira que vai ter dado (o retrato seguinte), não a de uma idade que nunca terá.
  if (o.marcoAberto === undefined && dados.marcos[aberta].estado === 'antes_da_coleta') {
    const prox = MARCOS_DA_TELA.find(m => m > aberta && (dados.marcos[m].estado === 'fecha_em' || dados.marcos[m].estado === 'a_caminho'))
    if (prox !== undefined) aberta = prox
  }
  const mencoes = cartoes.reduce((s, c) => s + (comTexto(c) ? c.mencoesTrocadas : 0), 0)
  return {
    titulo: FRASES.titulo,
    info: { titulo: FRASES.tituloDoInfo, rotulo: FRASES.tituloDoInfo, paragrafos: FRASES.infoParagrafos(mencoes) },
    nivel: dados.nivel,
    faixa: dados.nivel === 'contagem' ? FRASES.faixaContagem : dados.nivel === 'texto' ? FRASES.faixaTexto : null,
    mencoesTrocadas: mencoes,
    abas, aberta, paineis, fonte: FRASES.fonte,
  }
}

/** O estado "carregando" e o de erro de leitura não vêm do dado: a tela os pede. */
export function estadoDeCarregando(): { titulo: string } { return { titulo: FRASES.carregando } }
export function estadoDeErro(): EstadoView {
  return { kind: 'estado', marco: 1, tom: 'erro', titulo: FRASES.erroDeLeitura, corpo: null, selo: null, nota: null, tentar: true }
}
