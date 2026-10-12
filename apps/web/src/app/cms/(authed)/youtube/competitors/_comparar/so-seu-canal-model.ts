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
import { montarDias, resumir } from '@/lib/youtube/observatorio/proprio/dias'
import { canalLargo } from '@/lib/youtube/observatorio/proprio/taxa'
import type { AlcanceCanal, DiarioCanal, DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { assistidoDoCanal, POUCAS_VIEWS, POUCAS_VIEWS_MEDIA, taxaDoCanal, type MotivoAssistidoCanal } from '../_proprio/canal-agregados'
import { pctUm } from '../_proprio/taxa-faixa-model'

export type ChaveLinha = 'impressoes' | 'cliques' | 'taxa' | 'assistido'

/** Uma linha do cartão. `valor` nulo = não medido (o quadradinho hachurado); `nota` = a segunda linha pequena ao lado do valor; `fraco` = valor em cinza (pouca base). */
export interface LinhaSoSeuCanal { chave: ChaveLinha; rotulo: string; sub: string; valor: string | null; nota: string | null; fraco: boolean }

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
export const FRASE_ABERTURA = 'Impressões, taxa de clique e % assistido só chegam ao dono do canal.'
export const FRASE_NEGADO_CARTAO = 'Só quem edita o site vê estes números.'
export const FRASE_ERRO_CARTAO = 'A leitura do alcance falhou agora; recarregue a página.'
/** O trecho da frase que sai em negrito. */
export const NEGRITO_NAO_ZERO = 'não porque sejam zero'
export const PREFIXO_NAO_MEDIDO = 'Não medido.'
export const NOTA_TAXA_LARGA = 'Ainda não dá para dizer se é alta ou baixa.'
const NOTA_CTR = 'não medido: o YouTube não devolveu o CTR de algum dia com impressão'
const NOTA_SEM_IMPRESSAO = 'nenhuma impressão nos dias lidos, então não há taxa'

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

const linha = (chave: ChaveLinha, rotulo: string, sub: string, valor: string | null = null, nota: string | null = null, fraco = false): LinhaSoSeuCanal =>
  ({ chave, rotulo, sub, valor, nota, fraco })

/** A nota de uma linha de % assistido sem número; `sem-views` não tem nada a dizer além do que a linha já diz. */
function notaSemAssistido(m: MotivoAssistidoCanal | null): string | null {
  switch (m) {
    case 'sem-acesso': return 'só quem edita o site vê este número'
    case 'leitura-falhou': return 'a leitura do % assistido falhou agora; recarregue a página'
    case 'sem-diario': return 'a coleta diária ainda não gravou este canal'
    case 'sem-percentual': return 'o YouTube ainda não entregou o % assistido'
    case 'sem-views':
    case null: return null
    default: { const nunca: never = m; return nunca }
  }
}

function linhaAssistido(diario: Privado<DiarioCanal>, longos: readonly string[], semNota: boolean): LinhaSoSeuCanal {
  const a = assistidoDoCanal(diario, longos)
  if (a.pct == null) return linha('assistido', '% assistido', SUB.assistidoSemNumero, null, semNota ? null : notaSemAssistido(a.motivo))
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
}): SoSeuCanalDado {
  if (a.alcance.acesso === 'negado') return { acesso: 'negado', view: null }
  if (a.alcance.acesso === 'erro') return { acesso: 'erro', view: null }
  const { periodo, dias } = montarDias(a.alcance.dado)
  const resumo = resumir(dias)
  const lido = periodo != null && resumo.diasLidos > 0

  if (!lido) {
    // nenhum relatório lido: "Não medido." e as linhas do alcance só com o quadradinho; sem nota, a frase já diz que falta medir
    return {
      acesso: 'ok',
      view: {
        canal: a.nome,
        frase: `${PREFIXO_NAO_MEDIDO} As impressões, a taxa de clique e o % assistido só chegam ao dono do canal, e os números de alcance de ${a.nome} ainda não chegaram: falta medir, não é zero.`,
        naoMedido: true,
        linhas: [
          linha('impressoes', 'Impressões', SUB.impressoesSemDado),
          linha('cliques', 'Cliques estimados', SUB.cliques),
          linha('taxa', 'Taxa de clique', SUB.taxa),
          linhaAssistido(a.diario, a.longos, true),
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
  ]
  return {
    acesso: 'ok',
    view: {
      canal: a.nome, frase: FRASE_ABERTURA, naoMedido: false, linhas,
      taxa: t ? { cliques: t.cliques, imp: t.imp, alt: `Taxa de clique do canal ${pctUm(t.taxa)}, intervalo de 95% de ${pctUm(t.lo)} a ${pctUm(t.hi)}` } : null,
    },
  }
}

interface LadoDoPar { id: string; name: string; own: boolean }

/** A View de um canal seu que não chegou com número: só a frase do motivo, sem linhas. */
const semNumero = (canal: string, frase: string): SoSeuCanalView => ({ canal, frase, naoMedido: false, linhas: [], taxa: null })

/**
 * NAVEGADOR. Um cartão por lado que é canal seu (na ordem A, B); nenhum lado seu = []. Canal seu que o pacote não trouxe, ou com `acesso: 'ok'` sem
 * View, é leitura que não chegou ("a leitura falhou"), nunca "zero" nem cartão sumido. A frase de quem tem número diz, quando o outro lado é um
 * concorrente, que ele não tem esses números "não porque sejam zero".
 */
export function buildSoSeuCanal(par: { a: LadoDoPar; b: LadoDoPar }, dados: Record<string, SoSeuCanalDado>): SoSeuCanalView[] {
  const out: SoSeuCanalView[] = []
  for (const [lado, outro] of [[par.a, par.b], [par.b, par.a]] as const) {
    if (!lado.own) continue
    const dado = dados[lado.id]
    if (dado?.acesso === 'negado') { out.push(semNumero(lado.name, FRASE_NEGADO_CARTAO)); continue }
    if (!dado || dado.acesso === 'erro' || dado.view == null) { out.push(semNumero(lado.name, FRASE_ERRO_CARTAO)); continue }
    const v = dado.view
    const frase = !v.naoMedido && !outro.own
      ? `${v.frase} ${outro.name} não tem esses números aqui porque o YouTube não os entrega, ${NEGRITO_NAO_ZERO}.`
      : v.frase
    out.push({ ...v, canal: lado.name, frase })
  }
  return out
}
