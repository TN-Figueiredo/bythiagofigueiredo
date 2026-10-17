// E5a Tarefa 15 e C4: a célula "Criador responde" e o bloco "O que o criador respondeu". Puro: relógio e leitura entram por parâmetro.
// A conta é SEMPRE `criadorResponde` da E4 (M11); aqui só se escolhe o estado e a frase. A tela NUNCA escreve "não respondeu": o que a medida
// não viu não é afirmado ("não vimos resposta").
import { DEFINICAO_RETRATOS_COMENTARIOS } from '@/lib/youtube/agenda/definicoes'
import type { ContagemDeRespostas, ParteLida } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import { criadorResponde, type StatusDoRetrato, type VideoParaResposta } from '@/lib/youtube/observatorio/medidas/comentarios'
import type { VideoLido } from '@/lib/youtube/observatorio/medidas/ler'
import { baseDaIdade } from '@/lib/youtube/observatorio/medidas/m1'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { tarefaViva } from '@/lib/youtube/observatorio/medidas-telas/tarefa-viva'
import { DAY, spDateOf } from '@/lib/youtube/observatorio/time'
import type { FormatoDoCanal } from './cabecalho-model'
import type { EstadoDaPagina } from './estado-model'
import { dm, ptn } from './formatos'

export type EstadoDaColetaDeComentarios = 'nao_pedida' | 'nao_comecou' | 'parada'

export interface CelulaDoCriador {
  tipo: 'nao_medido'
  /** Frase revista pelo Logan (desvio 16): a frase da pergunta 26, terceira forma. */
  curta: string
  longa: string
}

export const FRASE_CRIADOR_NAO_PEDIDA = 'não medido: a coleta de comentários não foi pedida'
export const FRASE_CRIADOR_NAO_COMECOU = 'não medido: a coleta de comentários ainda não começou'
export const FRASE_CRIADOR_PARADA = 'não medido: a coleta de comentários está parada'

export function celulaDoCriador(estadoDaColeta: EstadoDaColetaDeComentarios): CelulaDoCriador {
  switch (estadoDaColeta) {
    case 'nao_pedida':
      return { tipo: 'nao_medido', curta: FRASE_CRIADOR_NAO_PEDIDA, longa: FRASE_CRIADOR_NAO_PEDIDA }
    case 'nao_comecou':
      return { tipo: 'nao_medido', curta: FRASE_CRIADOR_NAO_COMECOU, longa: FRASE_CRIADOR_NAO_COMECOU }
    case 'parada':
      return { tipo: 'nao_medido', curta: FRASE_CRIADOR_PARADA, longa: FRASE_CRIADOR_PARADA }
  }
}

// ───── C4: o modelo com dado ─────

export type TipoDaCelulaDoCriador = 'medido' | 'zero' | 'nao_medido' | 'nao_carregou'
export interface CelulaDoCriadorComDado {
  valor: TipoDaCelulaDoCriador
  base: string
  motivo: string | null
  k: number | null
  n: number | null
  pct: number | null
}

/** Uma casa por vídeo da janela: ✓ resposta vista; vazada = não vimos resposta; pontilhada = ainda sem retrato de 30 dias (fora da conta); hachura = sem retrato. */
export type CasaDoCriador = 'com' | 'sem' | 'espera' | 'sem_retrato'

export interface BlocoDoCriador {
  tipo: 'medido' | 'zero' | 'nao_medido' | 'nao_carregou' | 'desligados' | 'fora'
  frase: { negrito: string; resto: string }
  casas: CasaDoCriador[]
  legenda: Array<{ chave: CasaDoCriador; texto: string }>
  /** A pastilha "não medido" (ou "não carregou") quando a medida não existe. */
  pastilha: string | null
  /** O n de vídeos com retrato de 30 dias (a base da conta), para a lista dizer "em N vídeos com retrato de 30 dias". */
  nBase: number
}

export interface ModeloDoCriador { celula: CelulaDoCriadorComDado; bloco: BlocoDoCriador }

export interface EntradaDoCriador {
  nome: string
  formato: FormatoDoCanal
  videos: readonly VideoLido[] | null
  /** Nulo = não lida (o carregador não deu os vídeos, ou o canal não é deste site). */
  contagem: ParteLida<ContagemDeRespostas> | null
  estado: EstadoDaPagina
  agoraMs: number
  hojeSP: string
}

const MAX_COMENTARIOS = 12
const NC = 'não carregou'

function vazio(valor: TipoDaCelulaDoCriador, texto: string): CelulaDoCriadorComDado {
  return { valor, base: texto, motivo: texto, k: null, n: null, pct: null }
}

const semCasas = (tipo: BlocoDoCriador['tipo'], negrito: string, resto: string, pastilha: string | null): BlocoDoCriador =>
  ({ tipo, frase: { negrito, resto }, casas: [], legenda: [], pastilha, nBase: 0 })

/**
 * A base da conta: os vídeos do formato do canal, fora os que ainda vão estrear, com idade de 0 a `windowDays` dias, o mais novo primeiro.
 * É a ÚNICA fonte da base: a conta, as casas e a leitura dos comentários (ids) saem daqui, para a lista nunca contar vídeo fora das casas.
 */
export function videosDaBase(videos: readonly VideoLido[], fmt: 'long' | 'short', agoraMs: number): Array<{ v: VideoLido; base: number; idade: number }> {
  const janela = MEASURE_RULES.comments.windowDays
  return videos
    .map(v => ({ v, base: baseDaIdade(v) }))
    .filter((x): x is { v: VideoLido; base: number } => x.base !== null && (fmt === 'short' ? x.v.isShort === true : x.v.isShort === false) && x.v.liveBroadcastContent !== 'upcoming')
    .map(x => ({ ...x, idade: Math.floor((agoraMs - x.base) / DAY) }))
    .filter(x => x.idade >= 0 && x.idade <= janela)
    .sort((a, b) => b.base - a.base)
}

export const idsDaBaseDoCriador = (videos: readonly VideoLido[], fmt: 'long' | 'short', agoraMs: number): string[] => videosDaBase(videos, fmt, agoraMs).map(x => x.v.id)

export function criadorDoCanal(e: EntradaDoCriador): ModeloDoCriador {
  const fmt = e.formato.fmt
  const quem = e.formato.soShorts ? 'Shorts' : 'vídeos longos'
  if (e.videos === null || e.contagem === null || !e.contagem.lido) {
    return {
      celula: vazio('nao_carregou', NC),
      bloco: semCasas('nao_carregou', 'Não carregou:', ' não deu para ler os comentários deste canal agora.', NC),
    }
  }
  const c = e.contagem.dados
  const janela = MEASURE_RULES.comments.windowDays
  const doFormato = videosDaBase(e.videos, fmt, e.agoraMs)

  if (e.estado.tipo === 'saiu') {
    return {
      celula: vazio('nao_medido', 'sem comentários para ler: o canal saiu do YouTube'),
      bloco: semCasas('fora', 'Sem comentários para ler: o canal saiu do YouTube.', '', 'não medido'),
    }
  }
  // a coleta de comentários decide ANTES de qualquer conta: zero retrato no site e a medida nem é chamada
  if (c.coletaDoSiteDesdeMs === null) {
    const f = celulaDoCriador('nao_comecou')
    return { celula: vazio('nao_medido', f.longa), bloco: semCasas('nao_medido', 'Ainda não dá para dizer se o criador responde.', ' A coleta de comentários ainda não começou.', 'não medido') }
  }
  const viva = tarefaViva({ ultimoOkMs: c.ultimoOkDaTarefaMs, primeiraExecucaoMs: c.primeiraExecucaoDaTarefaMs, toleranciaH: DEFINICAO_RETRATOS_COMENTARIOS.toleranciaVigiaH, agoraMs: e.agoraMs })
  if (viva.estado === 'nao_lida') {
    return { celula: vazio('nao_carregou', NC), bloco: semCasas('nao_carregou', 'Não carregou:', ' não deu para saber se a coleta de comentários está rodando.', NC) }
  }
  if (viva.estado === 'parada') {
    const f = celulaDoCriador('parada')
    return { celula: vazio('nao_medido', f.longa), bloco: semCasas('nao_medido', 'Ainda não dá para dizer se o criador responde.', ' A coleta de comentários está parada.', 'não medido') }
  }

  const retrato = (id: string): StatusDoRetrato | null => (c.porVideo.get(id)?.retrato30 ?? null) as StatusDoRetrato | null
  if (doFormato.length > 0 && doFormato.every(x => retrato(x.v.id) === 'desligados')) {
    return { celula: vazio('nao_medido', 'comentários desligados pelo canal'), bloco: semCasas('desligados', 'Os comentários estão desligados pelo canal.', '', 'não medido') }
  }

  const insumos: VideoParaResposta[] = doFormato.map(x => ({
    formato: fmt, idadeDias: x.idade, retrato30: retrato(x.v.id), algumComRespostaDoCriador: c.porVideo.get(x.v.id)?.algumComRespostaDoCriador ?? false,
  }))
  const m = criadorResponde(insumos, { formato: fmt, coletaDesdeMs: c.coletaDoCanalDesdeMs, agoraMs: e.agoraMs })

  const casas: CasaDoCriador[] = doFormato.map(x => {
    if (retrato(x.v.id) === 'ok') return c.porVideo.get(x.v.id)?.algumComRespostaDoCriador ? 'com' : 'sem'
    return x.idade < 30 ? 'espera' : 'sem_retrato'
  })
  const cont = (k: CasaDoCriador): number => casas.filter(x => x === k).length
  // "antes da coleta" usa o começo da coleta do SITE (emenda d:m2); o do canal só entra na M11. Aqui o do site nunca é nulo (já passou pelo "não começou").
  const antes = c.coletaDoSiteDesdeMs === null ? 0 : doFormato.filter((x, i) => casas[i] === 'sem_retrato' && x.base < c.coletaDoSiteDesdeMs!).length
  const legendaDe = (): BlocoDoCriador['legenda'] => {
    const l: BlocoDoCriador['legenda'] = []
    if (cont('com')) l.push({ chave: 'com', texto: `${ptn(cont('com'), 'vídeo', 'vídeos')} com resposta dele` })
    if (cont('sem')) l.push({ chave: 'sem', texto: `${ptn(cont('sem'), 'vídeo', 'vídeos')} em que não vimos resposta` })
    if (cont('espera')) l.push({ chave: 'espera', texto: `${cont('espera')} ainda sem retrato de 30 dias, não entram na conta` })
    if (cont('sem_retrato')) {
      const so = cont('sem_retrato') - antes
      if (antes > 0) l.push({ chave: 'sem_retrato', texto: `${ptn(antes, 'vídeo anterior à coleta', 'vídeos anteriores à coleta')}${c.coletaDoSiteDesdeMs !== null ? `, que começou em ${dm(spDateOf(c.coletaDoSiteDesdeMs))}` : ''}` })
      if (so > 0) l.push({ chave: 'sem_retrato', texto: `${so} sem retrato de 30 dias (o motivo de cada um está na página do vídeo)` })
    }
    return l
  }
  const nBase = cont('com') + cont('sem')
  const total = doFormato.length

  if (m.estado === 'medido') {
    const { com, total: n, pct } = m.valor
    const pctTxt = pct === null ? null : Math.round(pct * 100)
    const espera = cont('espera')
    const resto = (espera > 0 ? ` Outros ${ptn(espera, 'vídeo recente ainda não fechou', 'vídeos recentes ainda não fecharam')} os 30 dias.` : '') +
      ` É só um piso: só vemos os ${MAX_COMENTARIOS} comentários guardados de cada vídeo.`
    const celula: CelulaDoCriadorComDado = { valor: com === 0 ? 'zero' : 'medido', base: `${quem} de até ${janela} dias com retrato de 30 dias`, motivo: null, k: com, n, pct: pctTxt }
    if (com === 0) {
      return {
        celula, bloco: {
          tipo: 'zero', casas, legenda: legendaDe(), pastilha: null, nBase,
          frase: { negrito: `Não vimos resposta de ${e.nome} em nenhum dos ${n} vídeos.`, resto: ` É um zero medido: conferimos os comentários guardados e nenhum traz resposta dele.${resto}` },
        },
      }
    }
    return {
      celula, bloco: {
        tipo: 'medido', casas, legenda: legendaDe(), pastilha: null, nBase,
        frase: { negrito: `${e.nome} respondeu a comentários em ${com} de ${n} vídeos com retrato de 30 dias${pctTxt === null ? '' : ` (${pctTxt}%)`}.`, resto },
      },
    }
  }
  // não medido: as três frases de M11 da tabela do NOTAS 20 (fecha em, poucos vídeos, sem retrato do canal)
  const comColeta = doFormato.filter(x => c.coletaDoCanalDesdeMs !== null && x.base >= c.coletaDoCanalDesdeMs).length
  let frase: BlocoDoCriador['frase']
  let curta: string
  if (m.motivo === 'fecha_em' && m.fechaEm) {
    frase = { negrito: 'Ainda não dá para medir.', resto: ` Só ${comColeta} dos ${total} vídeos dos últimos ${janela} dias têm coleta de comentários, e o primeiro retrato de 30 dias fecha em ${dm(m.fechaEm)}.` }
    curta = `não medido: o primeiro retrato de 30 dias fecha em ${dm(m.fechaEm)}`
  } else if (m.motivo === 'poucos_videos') {
    frase = { negrito: 'Ainda não dá para medir.', resto: ` Só ${m.n ?? nBase} dos ${total} vídeos têm retrato de 30 dias, e a conta pede pelo menos ${m.minimo ?? MEASURE_RULES.comments.minVideos}.` }
    curta = `não medido: só ${m.n ?? nBase} de ${total} vídeos têm retrato de 30 dias (pede pelo menos ${m.minimo ?? MEASURE_RULES.comments.minVideos})`
  } else {
    frase = { negrito: 'Ainda não dá para medir.', resto: ' Os vídeos deste canal ainda não têm coleta de comentários.' }
    curta = 'não medido: os vídeos deste canal ainda não têm coleta de comentários'
  }
  return {
    celula: { valor: 'nao_medido', base: curta, motivo: curta, k: null, n: null, pct: null },
    bloco: { tipo: 'nao_medido', frase, casas, legenda: legendaDe(), pastilha: 'não medido', nBase },
  }
}
