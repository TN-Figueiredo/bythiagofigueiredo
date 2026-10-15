/**
 * O cartão "Só o seu canal mede" da comparação (A4 Tarefa 14, mockup aprovado em 12/10). Puro: sem servidor, sem banco, sem importar os leitores.
 *
 * Duas metades, de propósito separadas:
 *  - `montarSoSeuCanalDado` roda NO SERVIDOR, depois da guarda de edição, com o dado privado já lido de UM canal próprio, e devolve só TEXTO pronto
 *    (a View) mais, para o desenho da faixa, os dois números da taxa (cliques e impressões do canal). O pacote que atravessa para o navegador leva
 *    isto e nada de resumo cru, de relatório nem de linha do diário. Quem não edita o site recebe `{ acesso: 'negado', view: null }`: nenhum dígito.
 *  - `buildSoSeuCanal` roda NO NAVEGADOR, só com a View já montada: escolhe o cartão do par (um por canal seu) e acrescenta a frase que depende do
 *    outro lado. Trocar o seletor ou "Inverter lados" não vai à rede.
 *
 * Regra de ouro (este sistema falha em VERDE): "não medido" nunca vira zero. Sem relatório lido, as linhas levam só o quadradinho hachurado (valor
 * nulo, nota nula) e a frase começa por "Não medido."; zero impressão em dia lido é "0" (zero medido).
 */
import type { Fmt } from '@/lib/youtube/observatorio/fmt'
import { JANELA_LEITURA_ALCANCE_DIAS, montarDias, resumir } from '@/lib/youtube/observatorio/proprio/dias'
import { canalLargo } from '@/lib/youtube/observatorio/proprio/taxa'
import type { AlcanceCanal, DiarioCanal, DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { nomeDoPais } from '@/lib/youtube/observatorio/proprio/pais-pt'
import { ROTULO_ORIGEM, type GrupoOrigem } from '@/lib/youtube/observatorio/proprio/origem-grupos'
import type { DetalheCanal } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { OrigemLida } from '../_proprio/dados-origem'
import { buildOrigem, type BlocoView, type EntradaOrigem, type LinhaView, type PeriodoEntrada } from '../_proprio/origem-model'
import { assistidoDoCanal, MIN_DIAS_ASSISTIDO, POUCAS_VIEWS, POUCAS_VIEWS_MEDIA, taxaDoCanal, type MotivoAssistidoCanal } from '../_proprio/canal-agregados'
import { pctUm } from '../_proprio/taxa-faixa-model'

export type ChaveLinha = 'impressoes' | 'cliques' | 'taxa' | 'assistido' | 'origem' | 'termos' | 'aparelho' | 'pais' | 'inscritos'

/** Uma linha do cartão. `valor` nulo = não medido (o quadradinho hachurado); `nota` = a segunda linha pequena ao lado do valor; `fraco` = valor em cinza (pouca base). */
export interface LinhaSoSeuCanal {
  chave: ChaveLinha; rotulo: string; sub: string; valor: string | null; nota: string | null; fraco: boolean
  /** true = HÁ dado, mas pouco demais para dizer (o % assistido com menos de 7 dias): a tela escreve só a frase, SEM o quadradinho de "não medido". */
  aindaNaoDa: boolean
  /** Só nas cinco linhas da origem (E5b T12). Ausente nas quatro do alcance. */
  estado?: 'medido' | 'zero' | 'nao_medido' | 'ainda_nao_existe' | 'em_revisao' | 'erro' | 'bloqueado'
  /** true = a linha de termos de quem não edita: cadeado e "só para quem edita", sem número nem termo. */
  cadeado?: boolean
  /** A barra pequena da origem: só rótulo e porcentagem inteira. */
  barra?: Array<{ rotulo: string; pct: number }>
  /** Rótulo de leitor de tela do estado (ex.: "origem em revisão"). */
  rotuloLeitor?: string
}

export interface SoSeuCanalView {
  canal: string
  /** A frase de abertura. Em `buildSoSeuCanal` ela já sai completa (com a parte do outro canal, quando há). */
  frase: string
  /** Nenhum relatório de alcance foi lido: a frase começa por "Não medido." e as linhas do alcance levam só o quadradinho hachurado. */
  naoMedido: boolean
  linhas: LinhaSoSeuCanal[]
  /** Os dois números da faixa de taxa de clique (o desenho recalcula o intervalo) e a leitura em texto. Nulo: sem taxa. */
  taxa: { cliques: number; imp: number; alt: string } | null
}

/** O que viaja no pacote, por canal próprio do site. `view` só existe com `acesso: 'ok'`. */
export interface SoSeuCanalDado { acesso: 'ok' | 'negado' | 'erro'; view: SoSeuCanalView | null }

/** As frases do cartão (as de `header-model.ts`, ditas para o cartão inteiro). */
export const FRASE_ABERTURA = 'Impressões, taxa de clique, origem das views e termos de pesquisa só chegam ao dono do canal.'
export const FRASE_NEGADO_CARTAO = 'Só quem edita o site vê estes números.'
export const FRASE_ERRO_CARTAO = 'A leitura do alcance falhou agora; recarregue a página.'
/** O trecho da frase que sai em negrito. */
export const NEGRITO_NAO_ZERO = 'não porque sejam zero'
export const PREFIXO_NAO_MEDIDO = 'Não medido.'
export const NOTA_TAXA_LARGA = 'Ainda não dá para dizer se é alta ou baixa.'
const NOTA_CTR = 'não medido: o YouTube não informou a taxa de clique de algum dia com impressões'
const NOTA_SEM_IMPRESSAO = 'nenhuma impressão nos dias medidos, então não há taxa'

export const INFO_SO_SEU_CANAL = {
  titulo: 'De onde vêm estes números',
  itens: [
    { forte: 'Impressões e taxa de clique:', texto: 'dados de alcance do YouTube, por dia do YouTube. Dia que não chegou não conta como zero.' },
    { forte: 'Taxa de clique:', texto: 'cliques estimados ÷ impressões, com intervalo de 95% (Wilson). Com poucas impressões o intervalo é largo.' },
    { forte: '% assistido:', texto: 'média do percentual de cada dia, pesada pelas views do dia.' },
  ],
} as const

const SUB = {
  impressoesSemDado: 'dados de alcance do YouTube',
  cliques: 'impressões × taxa de cada dia',
  taxa: 'com intervalo de 95%',
  assistido: 'média pelas views, 28 dias',
  assistidoSemNumero: 'dos últimos 28 dias',
} as const

/** Cliques estimados como texto: arredonda só aqui; positivo que arredonda a 0 diz "menos de 1", nunca "0". */
function cliquesTexto(cliques: number, F: Pick<Fmt, 'int'>): string {
  return cliques > 0 && Math.round(cliques) === 0 ? 'menos de 1' : F.int(Math.round(cliques))
}

const linha = (chave: ChaveLinha, rotulo: string, sub: string, valor: string | null = null, nota: string | null = null, fraco = false, aindaNaoDa = false): LinhaSoSeuCanal =>
  ({ chave, rotulo, sub, valor, nota, fraco, aindaNaoDa })

/** A nota de uma linha de % assistido sem número; `sem-views` não tem nada a dizer além do que a linha já diz. */
function notaSemAssistido(m: MotivoAssistidoCanal | null): string | null {
  switch (m) {
    case 'sem-acesso': return 'só quem edita o site vê este número'
    case 'leitura-falhou': return 'a leitura do % assistido falhou agora; recarregue a página'
    case 'sem-diario': return 'ainda não há coleta diária deste canal'
    case 'sem-percentual': return 'o YouTube ainda não entregou o % assistido'
    case 'sem-views':
    case null: return null
    default: { const nunca: never = m; return nunca }
  }
}

function linhaAssistido(diario: Privado<DiarioCanal>, longos: readonly string[], semNota: boolean): LinhaSoSeuCanal {
  const a = assistidoDoCanal(diario, longos)
  if (a.pct == null) return linha('assistido', '% assistido', SUB.assistidoSemNumero, null, semNota ? null : notaSemAssistido(a.motivo))
  // há dado, mas menos de 7 dias: o mesmo veredito do cabeçalho do canal (header-model.ts), nunca um número cravado em cima de quase nada
  if (a.dias < MIN_DIAS_ASSISTIDO) return linha('assistido', '% assistido', SUB.assistidoSemNumero, null, `Ainda não dá para dizer: só ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'} com dado; precisa de ${MIN_DIAS_ASSISTIDO}.`, false, true)
  // acima de 100 é dado válido (trecho revisto): o número real, sem recortar
  const nota = a.n < POUCAS_VIEWS_MEDIA ? `só ${a.n} ${a.n === 1 ? 'view' : 'views'}: pouco para uma média` : null
  return linha('assistido', '% assistido', SUB.assistido, `${Math.round(a.pct)}%`, nota, a.n < POUCAS_VIEWS)
}

/**
 * SERVIDOR, depois da guarda. `alcance` negado/erro: sem View (o navegador escreve a frase do motivo). Alcance lido: quatro linhas; o % assistido tem o
 * seu próprio estado (o diário é outra leitura): se ele falhou, só a linha dele diz o motivo.
 * `longos` = os ytIds dos longos acompanhados do canal (a base do % assistido). `dm` = 'AAAA-MM-DD' → "dd/mm".
 */
export function montarSoSeuCanalDado(a: {
  nome: string; alcance: Privado<AlcanceCanal>; diario: Privado<DiarioCanal>; longos: readonly string[]
  dm: (d: DiaYt) => string; F: Pick<Fmt, 'int'>
  /** Hoje no dia do YouTube: D e D-1 sem linha são "não medido", nunca zero. */
  hoje: DiaYt
  /** A origem de 7 dias (E5b T12). Ausente = o cartão tem só as quatro linhas do alcance. */
  origem?: EntradaOrigemCartao
}): SoSeuCanalDado {
  if (a.alcance.acesso === 'negado') return { acesso: 'negado', view: null }
  if (a.alcance.acesso === 'erro') return { acesso: 'erro', view: null }
  const { periodo, dias } = montarDias(a.alcance.dado, { hoje: a.hoje })
  const resumo = resumir(dias)
  const lido = periodo != null && resumo.diasLidos > 0

  // o relatório mais novo é mais antigo que a janela lida: a coleta PAROU, e a frase diz desde quando (nunca "ainda não chegaram")
  const parouEm = periodo == null ? a.alcance.dado.ultimoRelatorio : null
  if (!lido) {
    // nenhum relatório lido: "Não medido." e as três linhas do alcance só com o quadradinho (sem nota: a frase já diz que falta medir); o % assistido segue o estado dele
    return {
      acesso: 'ok',
      view: {
        canal: a.nome,
        frase: `${PREFIXO_NAO_MEDIDO} As impressões, os cliques estimados e a taxa de clique só chegam ao dono do canal. ${parouEm
          ? `A coleta de relatórios de ${a.nome} parou em ${a.dm(parouEm)}; nenhum dia dos últimos ${JANELA_LEITURA_ALCANCE_DIAS} foi medido`
          : `Os números de alcance de ${a.nome} ainda não chegaram`}: falta medir, não é zero.`,
        naoMedido: true,
        linhas: [
          linha('impressoes', 'Impressões', SUB.impressoesSemDado),
          linha('cliques', 'Cliques estimados', SUB.cliques),
          linha('taxa', 'Taxa de clique', SUB.taxa),
          linhaAssistido(a.diario, a.longos, false),
          ...linhasDaOrigem(a.origem),
        ],
        taxa: null,
      },
    }
  }

  const imp = resumo.imp ?? 0
  const t = taxaDoCanal(resumo)
  const linhas: LinhaSoSeuCanal[] = [
    linha('impressoes', 'Impressões', `de ${a.dm(periodo.de)} a ${a.dm(periodo.ate)}`, a.F.int(imp)),
    resumo.cliques != null
      ? linha('cliques', 'Cliques estimados', SUB.cliques, cliquesTexto(resumo.cliques, a.F))
      : linha('cliques', 'Cliques estimados', SUB.cliques, null, NOTA_CTR),
    t
      ? linha('taxa', 'Taxa de clique', SUB.taxa, pctUm(t.taxa), `entre ${pctUm(t.lo)} e ${pctUm(t.hi)}${canalLargo(t) ? `. ${NOTA_TAXA_LARGA}` : ''}`)
      : linha('taxa', 'Taxa de clique', SUB.taxa, null, imp === 0 ? NOTA_SEM_IMPRESSAO : NOTA_CTR),
    linhaAssistido(a.diario, a.longos, false),
    ...linhasDaOrigem(a.origem),
  ]
  return {
    acesso: 'ok',
    view: {
      canal: a.nome, frase: FRASE_ABERTURA, naoMedido: false, linhas,
      taxa: t ? { cliques: t.cliques, imp: t.imp, alt: `Taxa de clique do canal ${pctUm(t.taxa)}, intervalo de 95% de ${pctUm(t.lo)} a ${pctUm(t.hi)}` } : null,
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// As cinco linhas da origem (E5b T12). Vêm do MESMO `buildOrigem` da página do canal (7 dias), então os números batem.

/** O que o servidor reúne por canal próprio para as cinco linhas: as duas leituras de 7 dias e o contexto de datas. */
export interface EntradaOrigemCartao {
  origem: Privado<OrigemLida>
  termos: Privado<DetalheCanal>
  periodo: PeriodoEntrada
  hojePt: DiaYt
  ligadoEm: DiaYt
  publicacoes: ReadonlyMap<string, DiaYt | null>
  /** quem edita o site lê os termos; os outros veem o cadeado */
  podeEditar: boolean
  dm(d: DiaYt): string
  dmy(d: DiaYt): string
  n(x: number): string
}

export const TEXTO_ERRO_LINHA = 'Não conseguimos ler agora'
const TEXTO_CADEADO = 'só para quem edita' // TEXTO-A-REVISAR
const ROTULO_LINHA: Record<'origem' | 'termos' | 'aparelho' | 'pais' | 'inscritos', { rotulo: string; sub: string }> = {
  origem: { rotulo: 'Origem das views', sub: 'últimos 7 dias' },
  termos: { rotulo: 'Termos de pesquisa', sub: 'últimos 7 dias' },
  aparelho: { rotulo: 'Aparelho', sub: 'últimos 7 dias' },
  pais: { rotulo: 'País', sub: 'últimos 7 dias' },
  inscritos: { rotulo: 'Inscritos', sub: 'últimos 7 dias' },
}
const IDS_ORIGEM = ['origem', 'termos', 'aparelho', 'pais', 'inscritos'] as const

const valores = (b: BlocoView): LinhaView[] => b.linhas.filter(l => l.tipo === 'valor' && !l.semNumero && l.valor > 0 && l.chave !== 'outros').sort((x, y) => y.valor - x.valor)
const pct = (l: LinhaView): string => l.pctTexto

function valorDoBloco(id: (typeof IDS_ORIGEM)[number], b: BlocoView): { valor: string; barra?: LinhaSoSeuCanal['barra'] } | null {
  if (id === 'termos') {
    const t = b.subListas?.find(x => x.id === 'termos')?.linhas.find(l => l.tipo === 'valor' && l.chave !== 'outros')
    return t ? { valor: `“${t.rotulo}”` } : null
  }
  const top = valores(b)
  const l0 = top[0]
  if (!l0) return null
  switch (id) {
    case 'origem': {
      const dois = top.slice(0, 2)
      const de = (l: LinhaView) => ROTULO_ORIGEM[l.chave as GrupoOrigem]?.de ?? l.rotulo.toLowerCase()
      return { valor: dois.map(l => `${pct(l)} ${de(l)}`).join(', '), barra: top.map(l => ({ rotulo: l.rotulo, pct: l.pct })) }
    }
    case 'aparelho': return { valor: `${pct(l0)} ${l0.chave === 'tv' ? 'em TV' : `em ${l0.rotulo.toLowerCase()}`}` }
    case 'pais': return { valor: `${pct(l0)} ${nomeDoPais(l0.chave).de}` }
    case 'inscritos': return { valor: `${pct(l0)} ${l0.chave === 'inscritos' ? 'de inscritos' : 'de quem não é inscrito'}` }
  }
}

function linhaDoBloco(id: (typeof IDS_ORIGEM)[number], b: BlocoView | undefined): LinhaSoSeuCanal {
  const { rotulo, sub } = ROTULO_LINHA[id]
  const base = (estado: NonNullable<LinhaSoSeuCanal['estado']>, extra: Partial<LinhaSoSeuCanal> = {}): LinhaSoSeuCanal =>
    ({ chave: id, rotulo, sub, valor: null, nota: null, fraco: false, aindaNaoDa: false, estado, ...extra })
  if (!b || b.estado === 'erro') return base('erro', { nota: TEXTO_ERRO_LINHA })
  switch (b.estado) {
    case 'bloqueado': return base('bloqueado', { cadeado: true, nota: TEXTO_CADEADO })
    case 'em_revisao': return base('em_revisao', { nota: 'em revisão', rotuloLeitor: `${id} em revisão` })
    case 'ainda_nao_existe': return base('ainda_nao_existe', { nota: 'ainda não existe', aindaNaoDa: true })
    case 'zero': return base('zero', { valor: '0', nota: id === 'origem' ? 'Zero medido: nenhuma view veio da pesquisa' : 'Zero medido' })
    case 'nao_medido': return base('nao_medido')
    case 'medido': {
      const v = valorDoBloco(id, b)
      // medido sem nenhuma linha com número (tudo omitido pelo YouTube): não é zero e não é medido bonito
      if (!v) return base('nao_medido', { nota: 'o YouTube não deu o detalhe' }) // TEXTO-A-REVISAR
      const omitido = b.linhas.find(l => l.tipo === 'omitido')
      // o YouTube escondeu a maior parte: o número é verdadeiro mas de pouca base, e o cartão diz
      const nota = id === 'origem' && omitido && omitido.pct > 50 ? `o YouTube omitiu ${omitido.pctTexto} das views` : null // TEXTO-A-REVISAR
      return base('medido', { valor: v.valor, barra: v.barra, nota, fraco: nota != null })
    }
    default: { const nunca: never = b.estado; return nunca }
  }
}

/** As cinco linhas, na ordem do mockup. Sem entrada: nenhuma (o cartão fica com as quatro do alcance). */
export function linhasDaOrigem(e: EntradaOrigemCartao | undefined): LinhaSoSeuCanal[] {
  if (!e) return []
  const view = buildOrigem({
    tela: 'canal', nivel: e.podeEditar ? 'tudo' : 'sem-termos', origem: e.origem, termos: e.termos, periodos: [e.periodo],
    publicadoEm: null, hojePt: e.hojePt, ligadoEm: e.ligadoEm, publicacoes: e.publicacoes, podeEditar: e.podeEditar, dm: e.dm, dmy: e.dmy, n: e.n,
  } satisfies EntradaOrigem)
  const blocos = view.periodos[0]?.grupo.blocos ?? []
  return IDS_ORIGEM.map(id => linhaDoBloco(id, blocos.find(b => b.id === id)))
}

/** A View de um canal seu na tela: o id do canal é a chave da lista (dois canais podem ter o mesmo nome). */
export type SoSeuCanalCartao = SoSeuCanalView & { id: string }

interface LadoDoPar { id: string; name: string; own: boolean }

/** A View de um canal seu que não chegou com número: só a frase do motivo, sem linhas. */
const semNumero = (id: string, canal: string, frase: string): SoSeuCanalCartao => ({ id, canal, frase, naoMedido: false, linhas: [], taxa: null })

/**
 * NAVEGADOR. Um cartão por lado que é canal seu (na ordem A, B); nenhum lado seu = []. Canal seu que o pacote não trouxe, ou com `acesso: 'ok'` sem
 * View, é leitura que não chegou ("a leitura falhou"), nunca "zero" nem cartão sumido. A frase de quem tem número diz, quando o outro lado é um
 * concorrente, que ele não tem esses números "não porque sejam zero".
 */
export function buildSoSeuCanal(par: { a: LadoDoPar; b: LadoDoPar }, dados: Record<string, SoSeuCanalDado>): SoSeuCanalCartao[] {
  const out: SoSeuCanalCartao[] = []
  for (const [lado, outro] of [[par.a, par.b], [par.b, par.a]] as const) {
    if (!lado.own) continue
    const dado = dados[lado.id]
    if (dado?.acesso === 'negado') { out.push(semNumero(lado.id, lado.name, FRASE_NEGADO_CARTAO)); continue }
    if (!dado || dado.acesso === 'erro' || dado.view == null) { out.push(semNumero(lado.id, lado.name, FRASE_ERRO_CARTAO)); continue }
    const v = dado.view
    const frase = !v.naoMedido && !outro.own
      ? `${v.frase} ${outro.name} não tem esses números aqui porque o YouTube não os entrega, ${NEGRITO_NAO_ZERO}.`
      : v.frase
    out.push({ ...v, id: lado.id, canal: lado.name, frase })
  }
  return out
}
