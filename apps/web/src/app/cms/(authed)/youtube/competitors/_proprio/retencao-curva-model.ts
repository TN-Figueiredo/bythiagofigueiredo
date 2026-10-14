/**
 * Modelo da seção "Retenção" da tela do vídeo próprio (A5 E8, Tarefa 13; mockup 6 de 12/10, `video.js` `secRetencao`). Puro: recebe a
 * leitura da retenção JÁ feita (`Privado<RetencaoDoVideo>`, depois do token de edição), a duração do vídeo e o formatador de data; não lê banco, não
 * pede a prova de edição e não importa os leitores (uma varredura de teste barra). Devolve só texto e frações: é o que desce para o gráfico.
 *
 * Cinco estados que nunca se confundem (este sistema falha em VERDE: pergunte "o que acontece quando o dado não existe?"):
 *  - `coletada`: há curva da vida inteira. A frase, a lista de saídas e de trechos revistos e o aviso vêm dos pontos que existem.
 *  - `sem-curva`: o YouTube RESPONDEU que não há curva (a causa é dele: a tela não a adivinha). A data é a da ÚLTIMA RESPOSTA, mesmo que a última tentativa de todas tenha sido um erro.
 *  - `nao-coletada`: nenhuma resposta ainda (ou a migration da tabela não foi aplicada). O texto de sempre.
 *  - `erro`: a leitura falhou, a curva está ilegível, ou o banco é incoerente (resposta `ok` sem curva). NUNCA vira "ainda não coletamos".
 *  - `negado`: sem a prova de edição. Nenhum número, nenhuma data, nenhum ponto.
 * Curva INCOMPLETA (menos que os 100 pontos da grade) nunca afirma o que não vê: nada de "mais da metade ficou até o fim", de saídas, de trechos
 * revistos nem de pico; a frase é "não dá para dizer". Duração desconhecida ou zero: os tempos saem em % do vídeo, nunca "0:00".
 */
import type { DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { lerCurva, type CurvaCompleta, type LeituraDaCurva } from '@/lib/youtube/observatorio/proprio/retencao-curva'
import type { RetencaoDoVideo } from './dados'

/** O texto com destaque: `b` = negrito (o número que a frase informa). */
export interface ParteRetencao { t: string; b?: boolean }

export type EstadoRetencao = 'coletada' | 'sem-curva' | 'nao-coletada' | 'erro' | 'negado'

/** O que o gráfico desenha. Posições são frações do vídeo (0 a 1); nada aqui é dado privado além do que a tela mostra. */
export interface CurvaDesenho {
  pontos: Array<{ t: number; ratio: number }>
  /** as cinco marcas do eixo do tempo: 0, 25, 50, 75 e 100% da duração (em m:ss; em % quando a duração é desconhecida) */
  eixo: [string, string, string, string, string]
  /** onde a curva cruza 50%; null = não cruza, ou curva incompleta (não se sabe) */
  meioT: number | null
  /** curva que não é a grade inteira: o último `t` com dado (fração do vídeo). O que vem depois é "sem dado", desenhado como ausência. null = curva completa */
  ateT: number | null
  /** o início de cada maior saída (triângulo) */
  saidas: Array<{ t: number }>
  /** cada trecho revisto (faixa) */
  revistos: Array<{ de: number; ate: number }>
  legenda: { saidas: boolean; revistos: boolean; pico: string | null; semDado: boolean }
  /** o texto de `role="img"`: a frase principal */
  alt: string
}

export interface RetencaoView {
  estado: EstadoRetencao
  /** a frase principal do estado */
  frase: string
  /** a mesma frase em partes, com o número em destaque (só `coletada`; nos outros estados, uma parte só) */
  partes: ParteRetencao[]
  metodo: string[]
  curva: CurvaDesenho | null
  /** "Maiores saídas: …."; null = não há (a linha não existe) */
  saidas: string | null
  /** "Trechos revistos: …."; null = não há */
  revistos: string | null
  /** "Curva da vida inteira do vídeo, coletada em dd/mm. …"; null fora de `coletada` */
  aviso: string | null
}

export const METODO_RETENCAO: string[] = [
  'Curva: a parte do público que ainda está assistindo em cada ponto do vídeo, da publicação até a coleta. Vem de uma consulta do YouTube Analytics por posição no vídeo.',
  'Janela: a curva é da vida inteira do vídeo; o % assistido da seção anterior é dos últimos dias. As janelas são diferentes.',
  'Acima de 100%: trecho que muita gente voltou para rever.',
]

const FRASE_NAO_COLETADA = 'Ainda não coletamos esta curva. Quando coletarmos, esta seção mostra onde as pessoas saem do vídeo e onde voltam.'
/** Curva que chega ao fim do vídeo (t = 1) e mesmo assim não é a grade de 100 pontos (101 pontos, ou buraco no meio): não falta o fim, falta o formato. */
const FRASE_FORA_DO_FORMATO = 'Não dá para dizer onde metade das pessoas sai: a curva coletada não veio no formato esperado.'
const FRASE_INCOMPLETA = 'Não dá para dizer onde metade das pessoas sai: a curva coletada está incompleta.'
const FRASE_ERRO = 'A leitura da curva falhou agora; recarregue a página.'
const FRASE_NEGADO = 'Só quem edita o site vê a curva de retenção deste vídeo.'

/** A curva da API vai até 100% por ponto; o desenho passa disso até este teto (o mockup corta em 120%). */
export const TETO_DO_DESENHO = 1.2
/** Um pico acima do teto, até esta fração do vídeo, é "no começo". */
const COMECO = 0.1

const pct = (x: number): number => Math.round(x * 100)
const p2 = (n: number): string => (n < 10 ? '0' : '') + n

/** m:ss, ou h:mm:ss a partir de uma hora (sem zero à esquerda nos minutos: "2:06"). */
function mmss(seg: number): string {
  const s = Math.round(seg), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  return h ? `${h}:${p2(m)}:${p2(r)}` : `${m}:${p2(r)}`
}

const temDuracao = (d: number | null): d is number => d != null && Number.isFinite(d) && d > 0

/** Uma posição no vídeo (fração) como o leitor a lê: m:ss com duração; sem ela, "35%" (o "do vídeo" vem de quem escreve a frase). */
const tempo = (t: number, dur: number | null): string => (temDuracao(dur) ? mmss(t * dur) : `${pct(t)}%`)

/** O dia (AAAA-MM-DD) de um instante no fuso da tela, America/Sao_Paulo. Nunca o corte do texto ISO, que é UTC. */
const FMT_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
export function diaDeSaoPaulo(instante: string): DiaYt {
  const t = Date.parse(instante)
  if (!Number.isFinite(t)) throw new RangeError('instante ilegível')
  return FMT_SP.format(new Date(t))
}

function vazio(estado: Exclude<EstadoRetencao, 'coletada'>, frase: string): RetencaoView {
  return { estado, frase, partes: [{ t: frase }], metodo: METODO_RETENCAO, curva: null, saidas: null, revistos: null, aviso: null }
}

const eixoDe = (dur: number | null): CurvaDesenho['eixo'] => {
  const f = [0, 0.25, 0.5, 0.75, 1]
  return f.map(x => (temDuracao(dur) ? mmss(x * dur) : `${pct(x)}%`)) as CurvaDesenho['eixo']
}

/** "pico de 130% no começo" (pico no primeiro décimo do vídeo) ou "pico de 130% aos 2:06"; null = o pico cabe no desenho (até 120%). */
function legendaDoPico(l: CurvaCompleta, pontos: ReadonlyArray<{ t: number; ratio: number }>, dur: number | null): string | null {
  if (!(l.pico > TETO_DO_DESENHO)) return null
  const maior = pontos.reduce((a, p) => (p.ratio > a.ratio ? p : a), pontos[0]!)
  return `pico de ${pct(l.pico)}% ${maior.t <= COMECO ? 'no começo' : `aos ${tempo(maior.t, dur)}${temDuracao(dur) ? '' : ' do vídeo'}`}`
}

function coletada(a: { curva: NonNullable<RetencaoDoVideo['curvas']['vida']>; duracaoSeg: number | null; dm: (d: DiaYt) => string }): RetencaoView {
  const { curva, duracaoSeg: dur, dm } = a
  const leitura: LeituraDaCurva | null = lerCurva(curva.pontos)
  if (leitura == null) throw new RangeError('curva sem pontos')
  const sufixo = temDuracao(dur) ? '' : ' do vídeo'
  // até onde vai o dado (a curva vem ordenada e validada por `lerCurva`): é o que a tela diz da curva incompleta, nunca a contagem de pontos
  const ultimoT = curva.pontos[curva.pontos.length - 1]!.t

  // a frase principal: só a curva COMPLETA pode dizer "mais da metade ficou até o fim"
  let partes: ParteRetencao[]
  if (leitura.meio.tipo === 'cruza') {
    const t = leitura.meio.t
    partes = temDuracao(dur)
      ? [{ t: 'Metade das pessoas já saiu aos ' }, { t: mmss(t * dur), b: true }, { t: ` (${pct(t)}% do vídeo).` }]
      : [{ t: 'Metade das pessoas já saiu com ' }, { t: `${pct(t)}%`, b: true }, { t: ' do vídeo.' }]
  } else if (leitura.meio.tipo === 'nunca_cruza') {
    partes = [{ t: 'Mais da metade das pessoas ficou até o fim.' }]
  } else {
    partes = [{ t: pct(ultimoT) >= 100 ? FRASE_FORA_DO_FORMATO : FRASE_INCOMPLETA }]
  }
  const frase = partes.map(p => p.t).join('')

  // saídas e trechos revistos: só a curva completa os tem (o tipo da parcial nem os carrega)
  let saidas: string | null = null
  let revistos: string | null = null
  let desenhoSaidas: CurvaDesenho['saidas'] = []
  let desenhoRevistos: CurvaDesenho['revistos'] = []
  let pico: string | null = null
  if (leitura.completa) {
    if (leitura.saidas.length > 0) {
      saidas = 'Maiores saídas: ' + leitura.saidas.map(s => `${tempo(s.de, dur)} a ${tempo(s.ate, dur)}${sufixo}, de ${pct(s.ratioDe)}% para ${pct(s.ratioAte)}%`).join('; ') + '.'
      desenhoSaidas = leitura.saidas.map(s => ({ t: s.de }))
    }
    if (leitura.revistos.length > 0) {
      revistos = 'Trechos revistos: ' + leitura.revistos.map(r => `${tempo(r.de, dur)} a ${tempo(r.ate, dur)}${sufixo}`).join('; ') + '.'
      desenhoRevistos = leitura.revistos.map(r => ({ de: r.de, ate: r.ate }))
    }
    pico = legendaDoPico(leitura, curva.pontos, dur)
  }

  // curva que acaba antes do fim do vídeo: diz quanto ela cobre ("primeiros 5:41 do vídeo (37%)"; sem duração, só "37%")
  const cobre = !leitura.completa && pct(ultimoT) < 100
    ? ` A curva cobre só os primeiros ${temDuracao(dur) ? `${mmss(ultimoT * dur)} do vídeo (${pct(ultimoT)}%)` : `${pct(ultimoT)}% do vídeo`}.`
    : ''
  const aviso = `Curva da vida inteira do vídeo, coletada em ${dm(diaDeSaoPaulo(curva.coletadaEm))}. O % assistido da seção anterior é dos últimos dias.` + cobre

  return {
    estado: 'coletada', frase, partes, metodo: METODO_RETENCAO, saidas, revistos, aviso,
    curva: {
      pontos: curva.pontos.map(p => ({ t: p.t, ratio: p.ratio })),
      eixo: eixoDe(dur),
      meioT: leitura.meio.tipo === 'cruza' ? leitura.meio.t : null,
      ateT: leitura.completa ? null : ultimoT,
      saidas: desenhoSaidas,
      revistos: desenhoRevistos,
      legenda: { saidas: desenhoSaidas.length > 0, revistos: desenhoRevistos.length > 0, pico, semDado: !leitura.completa && pct(ultimoT) < 100 },
      alt: frase,
    },
  }
}

/**
 * A vista da seção. `retencao` ausente (`undefined`/`null`) = a leitura não foi pedida a este modelo: é "ainda não coletamos", o texto de sempre.
 * `duracaoSeg` desconhecido ou zero: tudo em % do vídeo.
 */
export function buildRetencaoView(a: { retencao: Privado<RetencaoDoVideo> | null | undefined; duracaoSeg: number | null; dm: (d: DiaYt) => string }): RetencaoView {
  const r = a.retencao
  if (r == null) return vazio('nao-coletada', FRASE_NAO_COLETADA)
  if (r.acesso === 'negado') return vazio('negado', FRASE_NEGADO)
  if (r.acesso === 'erro') return vazio('erro', FRASE_ERRO)
  const d = r.dado
  const vida = d.curvas.vida
  if (vida) {
    try {
      return coletada({ curva: vida, duracaoSeg: a.duracaoSeg, dm: a.dm })
    } catch {
      // ponto fora de ordem, instante ilegível: o desenho nunca mostra o que o banco não garante
      return vazio('erro', FRASE_ERRO)
    }
  }
  // sem curva: o porquê vem da ordem abaixo
  if (d.tabelaAusente) return vazio('nao-coletada', FRASE_NAO_COLETADA)
  // uma curva que existe e não pôde ser lida é ERRO, nunca "ainda não coletamos" (a última resposta pode ter sido `ok`)
  if (d.janelasIlegiveis.includes('vida')) return vazio('erro', FRASE_ERRO)
  const resp = d.ultimaResposta
  if (resp == null) return vazio('nao-coletada', FRASE_NAO_COLETADA)
  if (resp.resultado === 'sem_dado_na_janela') {
    // a causa é do YouTube ("sem dado"); "poucas views" seria inferência nossa. A promessa é a da regra de releitura: 7 dias ou mais, com view nova
    return vazio('sem-curva', `O YouTube respondeu que não tem curva para este vídeo. Tentamos de novo em 7 dias ou mais, se o vídeo tiver views novas. Última resposta: ${a.dm(resp.dia)}.`)
  }
  // o YouTube respondeu `ok` e não há curva guardada: incoerência do banco, não falta de coleta
  return vazio('erro', FRASE_ERRO)
}
