// A5 E5a, Tarefa 20 (mockup 13): "Mudanças deste vídeo". Puro. Nenhuma frase diz "depois da troca" nem afirma causa: a lista é de coincidências.
// A janela real de cada mudança ("entre 06:00 e 12:00", "em algum momento entre dd/mm e dd/mm") vem do dado; esta camada só a escreve.
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { somaDias } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { dm, horaSP, juntar, spDateOfMs } from './formatos'

export type CampoDoVideo = 'titulo' | 'miniatura' | 'descricao' | 'tags' | 'categoria' | 'duracao' | 'capitulos' | 'idioma'
export type TipoDeMudanca = 'titulo' | 'miniatura' | 'outras'
/** A precisão da janela: minuto (miniatura), 6 em 6 horas, dia a dia, ou a contagem ficou parada. */
export type PrecisaoDaMudanca = 'min' | '6h' | 'dia' | 'parada'

/** Quantas mudanças passam a ser "muitas": acima disto as linhas verticais do gráfico viram traço curto. */
export const MUITAS_MUDANCAS = 6
/** Acima disto a frase do resumo e a do cartão não listam datas campo a campo. */
export const LISTA_CURTA_ATE = 4
/** A janela de antes da subida em que a lista procura coincidências. */
export const DIAS_ANTES_DA_SUBIDA = MEASURE_RULES.rise.lookbackDays

export interface MudancaDoVideo {
  campos: readonly CampoDoVideo[]
  /** Início da janela (a leitura anterior); nulo quando não se sabe. */
  deMs: number | null
  /** Fim da janela: a leitura que viu a mudança. */
  ateMs: number
  precisao: PrecisaoDaMudanca
  /** O texto antes e depois (título; a descrição não é guardada em frase). */
  de?: string | null
  para?: string | null
}

export interface MudancaNumerada {
  n: number
  tipo: TipoDeMudanca
  campos: readonly CampoDoVideo[]
  /** "descrição e tags" */
  nomeDosCampos: string
  /** O dia (São Paulo) em que a contagem a viu. */
  dia: string
  /** O dia em que a janela começou (nulo se não se sabe). */
  diaDe: string | null
  precisao: PrecisaoDaMudanca
  /** Mudança feita entre 12:00 e 24:00: a barra do dia já tinha fechado. */
  tardia: boolean
  quando: string
  deMs: number | null
  ateMs: number
  de: string | null
  para: string | null
}

const NOME_DO_CAMPO: Record<CampoDoVideo, string> = {
  titulo: 'título', miniatura: 'miniatura', descricao: 'descrição', tags: 'tags', categoria: 'categoria', duracao: 'duração', capitulos: 'capítulos', idioma: 'idioma',
}
export const nomeDoCampo = (c: CampoDoVideo): string => NOME_DO_CAMPO[c]

/** O tipo da lista: título e miniatura têm o próprio; todo o resto é "outras". */
export function tipoDaMudanca(campos: readonly CampoDoVideo[]): TipoDeMudanca {
  if (campos.includes('titulo')) return 'titulo'
  if (campos.includes('miniatura')) return 'miniatura'
  return 'outras'
}

/** O nome da mudança: título e miniatura no mesmo instante são UMA mudança que diz os dois ("título e miniatura"), nunca só o primeiro (D3 do Gio). */
function nomeDaMudanca(m: Pick<MudancaNumerada, 'tipo' | 'campos' | 'nomeDosCampos'>): string {
  if (m.tipo === 'outras') return m.nomeDosCampos
  return juntar(m.campos.filter((c) => c === 'titulo' || c === 'miniatura').sort((a, b) => (a === 'titulo' ? -1 : b === 'titulo' ? 1 : 0)).map(nomeDoCampo))
}

const horaDe = (ms: number): number => Number(horaSP(ms).slice(0, 2))

/** A janela real escrita: "em 11/10, entre 06:00 e 12:00" · "em algum momento entre 08/10 e 10/10 (a leitura ficou parada)" · "em 13/10". */
export function quandoMudou(m: Pick<MudancaDoVideo, 'deMs' | 'ateMs' | 'precisao'>): string {
  const dia = dm(spDateOfMs(m.ateMs))
  if (m.precisao === 'parada' && m.deMs !== null) return `em algum momento entre ${dm(spDateOfMs(m.deMs))} e ${dia} (a leitura ficou parada)`
  if (m.precisao === '6h' && m.deMs !== null) return `em ${dia}, entre ${horaSP(m.deMs)} e ${horaSP(m.ateMs)}`
  if (m.precisao === 'min') return `em ${dia}, às ${horaSP(m.ateMs)}`
  return `em ${dia}`
}

/** Numera pela ordem em que a contagem viu (a ordem cronológica do gráfico). */
export function numerarMudancas(lista: readonly MudancaDoVideo[]): MudancaNumerada[] {
  return [...lista]
    .sort((a, b) => a.ateMs - b.ateMs)
    .map((m, i): MudancaNumerada => {
      const dia = spDateOfMs(m.ateMs)
      return {
        n: i + 1, tipo: tipoDaMudanca(m.campos), campos: m.campos, nomeDosCampos: juntar(m.campos.map(nomeDoCampo)),
        dia, diaDe: m.deMs === null ? null : spDateOfMs(m.deMs), precisao: m.precisao,
        // a barra de cada dia fecha às 12:00: a janela inteira a partir das 12:00 do mesmo dia vem depois dela
        tardia: m.precisao === '6h' && m.deMs !== null && horaDe(m.deMs) >= 12 && spDateOfMs(m.deMs) === dia,
        quando: quandoMudou(m), deMs: m.deMs, ateMs: m.ateMs, de: m.de ?? null, para: m.para ?? null,
      }
    })
}

/** Dentro dos 14 dias antes do dia da subida: de `subida − 14` até o dia anterior à subida. */
export function dentroDosDiasAntes(m: Pick<MudancaNumerada, 'dia'>, subidaDia: string): boolean {
  return m.dia >= somaDias(subidaDia, -DIAS_ANTES_DA_SUBIDA) && m.dia < subidaDia
}

export interface ItemDaLista {
  n: number
  tipo: TipoDeMudanca
  /** "Título" · "Miniatura" · "Outras: descrição e tags" */
  rotulo: string
  /** A janela sem o "em " da frente ("05/10, entre 12:01 e 16:19"); o tipo já está no rótulo. */
  quando: string
  /** Mudança depois da leitura das 12:00: o marcador curto "depois da leitura do dia" (a explicação fica no ⓘ do bloco). */
  depoisDaLeitura: boolean
  deParaTexto: string | null
  /** "fora dos 14 dias antes": só nos itens de fora, e só quando há subida. */
  marcaFora: boolean
}

export interface ListaDeMudancas {
  titulo: 'Mudanças deste vídeo'
  itens: ItemDaLista[]
  /** A frase-resumo do topo: "2 mudanças, as duas em 05/10:" + " miniatura e título." Nula sem mudança. */
  resumo: { negrito: string; resto: string } | null
  /** Quantas estão dentro dos 14 dias antes (nulo sem subida). */
  dentro: number | null
  /** A frase de quantas estão dentro (nula sem subida ou sem mudança). */
  fraseDeDentro: string | null
  /** A frase de lista vazia, com a data real do início do histórico. */
  vazia: string | null
  /** Mais de 6 itens: duas colunas. */
  emColunas: boolean
}

/** "2 mudanças, as duas em 05/10:" + " miniatura e título." · "1 mudança, em 05/10:" · "3 mudanças entre 05/10 e 09/10." */
export function resumoDasMudancas(mudancas: readonly MudancaNumerada[]): { negrito: string; resto: string } | null {
  if (mudancas.length === 0) return null
  const n = mudancas.length
  const dias = [...new Set(mudancas.map((m) => m.dia))].sort()
  const nome = nomeDaMudanca
  const tipos = juntar([...new Set(mudancas.map(nome))])
  const plural = `${n} mudanças`
  if (dias.length === 1) {
    const d = dm(dias[0]!)
    const negrito = n === 1 ? `1 mudança, em ${d}:` : n === 2 ? `${plural}, as duas em ${d}:` : `${plural}, todas em ${d}:`
    return { negrito, resto: ` ${tipos}.` }
  }
  return { negrito: `${plural} entre ${dm(dias[0]!)} e ${dm(dias[dias.length - 1]!)}.`, resto: ` ${tipos[0]!.toUpperCase()}${tipos.slice(1)}.` }
}

export function listaDeMudancas(
  mudancas: readonly MudancaNumerada[],
  o: { subidaDia: string | null; inicioDoHistorico: string },
): ListaDeMudancas {
  const sub = o.subidaDia
  const dentro = sub === null ? null : mudancas.filter((m) => dentroDosDiasAntes(m, sub)).length
  const itens = mudancas.map((m): ItemDaLista => ({
    n: m.n, tipo: m.tipo,
    rotulo: m.tipo === 'outras' ? `Outras: ${m.nomeDosCampos}` : ((n) => n.charAt(0).toUpperCase() + n.slice(1))(nomeDaMudanca(m)),
    quando: m.quando.replace(/^em (?=\d)/, ''),
    depoisDaLeitura: m.tardia,
    deParaTexto: m.de !== null && m.para !== null ? `de “${m.de}” para “${m.para}”` : null,
    marcaFora: sub !== null && !dentroDosDiasAntes(m, sub),
  }))
  let fraseDeDentro: string | null = null
  if (sub !== null && mudancas.length > 0 && dentro !== null) {
    const total = mudancas.length
    fraseDeDentro =
      dentro === total
        ? `${total === 1 ? 'A mudança está' : `As ${total} mudanças estão todas`} nos 14 dias antes da subida.`
        : `${dentro} das ${total} mudanças estão nos 14 dias antes da subida; as outras levam a marca “fora dos 14 dias antes”.`
  }
  return {
    titulo: 'Mudanças deste vídeo', itens, resumo: resumoDasMudancas(mudancas), dentro, fraseDeDentro,
    vazia: mudancas.length === 0 ? `Nenhuma mudança vista desde ${dm(o.inicioDoHistorico)} (o histórico de mudanças começou nesse dia).` : null,
    emColunas: mudancas.length > MUITAS_MUDANCAS,
  }
}

/** As mudanças dos 14 dias antes agrupadas por campo e escritas ("título em 11/10 e 13/10"), em ordem de campo: título, miniatura, outras. */
export function listaAgrupadaDosAntes(mudancas: readonly MudancaNumerada[], subidaDia: string): string[] {
  const antes = mudancas.filter((m) => dentroDosDiasAntes(m, subidaDia))
  const por = new Map<string, string[]>()
  for (const m of antes) {
    const chave = nomeDaMudanca(m)
    por.set(chave, [...(por.get(chave) ?? []), dm(m.dia)])
  }
  const ordem = (k: string): number => (k.startsWith('título') ? 0 : k === 'miniatura' ? 1 : 2)
  return [...por.keys()].sort((a, b) => ordem(a) - ordem(b)).map((k) => `${k} em ${juntar(por.get(k)!)}`)
}
