// Classificação PURA das linhas da lista "Vídeos do A/B Lab" (F1a-tela-1, T3): estado, agrupamento e frase de resumo.
// A leitura do banco é de `lista-borda.ts`. Nada aqui lê relógio nem banco: o `agora` entra por parâmetro.
import { inicioDoTeste } from './guarda'
import { INATIVIDADE_DESCARTE_MS } from './ficha-tela'
import type { FichaLida } from './ficha'
import type { RespostaDono } from './resposta'
import type { Caminho } from './roteador'

export type EstadoLinha =
  | 'sugerido_youtube' | 'sugerido_nosso' | 'formato_nao_confirmado' | 'sem_volume' | 'em_preparo' | 'em_teste_studio'
  | 'nosso_rodando' | 'resultado_pronto' | 'sem_resposta' | 'ficou_no_ar' | 'respostas_diferentes' | 'respondido_sem_vencedor'

export interface LinhaDoCaminho {
  videoId: string; ytId: string; titulo: string; miniaturaUrl: string | null; publicadoEm: string
  estado: EstadoLinha; caminho: Caminho; fichaId: string | null
  registro: {
    id: string; updatedAt: string; confirmadoEm: string | null; primeiraVista: string | null; diaDe14: number
    variantes: { n: number; titulo: string | null; imagem: { url: string } | null }[] | null
    variantesTitulo: string[] | null; campos: ('titulo' | 'miniatura')[] | null; respostaDono: RespostaDono | null
  } | null
  labPausadoAte: string | null
  nosso: { testId: string; restoreSeq: number; dia: number; status: 'active' | 'paused' } | null
  impressoesPorDia: number | null
}

/** O que `estadoDaLinha` precisa do registro (`ab_native_tests`), já em camelCase. `sem_resposta` é o valor que o fechamento por silêncio grava. */
export interface RegistroDaLista {
  estado: 'em_andamento' | 'encerrado' | 'sem_desfecho' | 'descartado'
  confirmadoEm: string | null
  primeiraVista: string | null
  createdAt: string
  respostaDono: RespostaDono | 'sem_resposta' | null
  vencedorFonte: 'regra' | 'dono' | 'data_api' | null
  vencedorTitulo: string | null
  /** Título da versão que o dono escolheu (`variante_vencedora`); nulo quando não se sabe (derivada sem título, só miniatura). */
  tituloDaResposta: string | null
}
export interface TesteNossoDaLista { status: 'active' | 'paused' }

const DIA_MS = 86_400_000
/** O teste do YouTube dura 14 dias; passados +2 d de margem (guarda.ts) a linha fecha por silêncio. */
const DURACAO_DIAS = 14
const FECHAMENTO_DIAS = DURACAO_DIAS + 2

const inicioDe = (r: RegistroDaLista): Date =>
  inicioDoTeste({ primeira_vista: r.primeiraVista, confirmado_em: r.confirmadoEm, created_at: r.createdAt })

/** Instante a partir do qual "Retomar" pode valer: início + 14 d + margem de 2 d (o botão em si depende do dado, não desta data). */
export function retomarAPartirDe(r: { primeiraVista: string | null; confirmadoEm: string | null; createdAt: string }): Date {
  const i = inicioDoTeste({ primeira_vista: r.primeiraVista, confirmado_em: r.confirmadoEm, created_at: r.createdAt })
  return new Date(i.getTime() + FECHAMENTO_DIAS * DIA_MS)
}

/** `dd/mm`, mais `, HH:MM` quando a hora (em São Paulo) não é 00:00. */
export function rotuloRetomar(instante: Date): string {
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(instante)
  const g = (t: string): string => p.find((x) => x.type === t)?.value ?? ''
  const data = `${g('day')}/${g('month')}`
  const hora = `${g('hour')}:${g('minute')}`
  return hora === '00:00' ? data : `${data}, ${hora}`
}

const SEM_VENCEDOR: ReadonlySet<string> = new Set(['ficou_igual', 'inconclusivo', 'nao_vi'])

/** Ficha vencida (inatividade > 14 d) será descartada na próxima abertura: não conta como "em preparo". */
function fichaViva(f: FichaLida, agora: Date): boolean {
  if (!f.aberta) return false
  const marcas = [f.criada_em, f.atualizada_em, f.studio_aberto_em, f.lembrar_em]
    .filter((x): x is string => x !== null).map((x) => Date.parse(x)).filter((n) => Number.isFinite(n))
  if (marcas.length === 0) return false
  return agora.getTime() - Math.max(...marcas) <= INATIVIDADE_DESCARTE_MS
}

function estadoDoRegistro(r: RegistroDaLista, agora: Date): EstadoLinha | null {
  if (r.estado === 'descartado') return null
  const resp = r.respostaDono
  // (3) respondido: a resposta vale mesmo depois do prazo.
  if (resp !== null && resp !== 'sem_resposta') {
    if (SEM_VENCEDOR.has(resp)) return 'respondido_sem_vencedor'
    if (r.vencedorFonte === 'data_api' && r.vencedorTitulo !== null && r.tituloDaResposta !== null && r.vencedorTitulo !== r.tituloDaResposta) return 'respostas_diferentes'
    return 'ficou_no_ar'
  }
  if (r.confirmadoEm === null) return r.estado === 'em_andamento' ? 'em_teste_studio' : null // (1) visto de fora
  // (2) confirmado e sem resposta: o prazo conta do início do teste.
  const ini = inicioDe(r).getTime()
  const t = agora.getTime()
  if (r.estado === 'sem_desfecho' || resp === 'sem_resposta' || t >= ini + FECHAMENTO_DIAS * DIA_MS) return 'sem_resposta'
  if (t < ini + DURACAO_DIAS * DIA_MS) return 'em_teste_studio'
  return 'resultado_pronto'
}

const DO_CAMINHO: Record<Caminho['tipo'], EstadoLinha> = {
  nativo: 'sugerido_youtube', nosso: 'sugerido_nosso', nao_confirmado: 'formato_nao_confirmado', sem_volume: 'sem_volume',
}

/** Precedência: registro (aberto ou respondido) > ficha aberta com versão nova > nosso `active` > o caminho. */
export function estadoDaLinha(
  e: { caminho: Caminho; ficha: FichaLida | null; registro: RegistroDaLista | null; nosso: TesteNossoDaLista | null },
  agora: Date,
): EstadoLinha {
  if (e.registro) {
    const s = estadoDoRegistro(e.registro, agora)
    if (s !== null) return s
  }
  if (e.ficha && fichaViva(e.ficha, agora) && e.ficha.variantes.some((v) => v.n >= 2)) return 'em_preparo'
  if (e.nosso?.status === 'active') return 'nosso_rodando'
  return DO_CAMINHO[e.caminho.tipo]
}

const maisNovo = (a: LinhaDoCaminho, b: LinhaDoCaminho): number => Date.parse(b.publicadoEm) - Date.parse(a.publicadoEm)
const pausada = (l: LinhaDoCaminho): boolean => l.estado === 'em_teste_studio' && l.nosso?.status === 'paused'

export function agruparLinhas(l: LinhaDoCaminho[]): { precisaDeVoce: LinhaDoCaminho[]; outros: LinhaDoCaminho[] } {
  const grupo = (x: LinhaDoCaminho): number => (x.estado === 'sem_resposta' ? 0 : x.estado === 'resultado_pronto' ? 1 : pausada(x) ? 2 : 3)
  const precisa = l.filter((x) => grupo(x) < 3).sort((a, b) => grupo(a) - grupo(b) || maisNovo(a, b))
  const outros = l.filter((x) => grupo(x) === 3).sort(maisNovo)
  return { precisaDeVoce: precisa, outros }
}

const EXTENSO = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez']
const ext = (n: number): string => (n <= 10 ? EXTENSO[n]! : String(n))
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const videos = (n: number): string => `${ext(n)} ${n === 1 ? 'vídeo' : 'vídeos'}`

/** Linha de ficha com exatamente duas versões: só ela ganha o botão "Responder" (T10b). Três versões ou `variantes` nulo = sem botão. */
const comBotao = (l: LinhaDoCaminho): boolean => l.registro?.variantes?.length === 2

export function resumoDaLista(g: { precisaDeVoce: LinhaDoCaminho[]; outros: LinhaDoCaminho[] }): { frase: string; apoio: string | null } {
  const todas = [...g.precisaDeVoce, ...g.outros]
  const prazo = g.precisaDeVoce.filter((l) => l.estado === 'sem_resposta' && comBotao(l)).length
  const hoje = g.precisaDeVoce.filter((l) => l.estado === 'resultado_pronto' && comBotao(l)).length
  const semBotao = g.precisaDeVoce.filter((l) => (l.estado === 'sem_resposta' || l.estado === 'resultado_pronto') && !comBotao(l)).length
  const espera = prazo + hoje
  const studio = todas.filter((l) => l.estado === 'em_teste_studio').length
  const preparo = todas.filter((l) => l.estado === 'em_preparo').length
  const nossoRodando = todas.filter((l) => l.estado === 'nosso_rodando').length
  const pausadas = todas.filter(pausada).length

  if (espera === 0 && semBotao > 0) {
    return { frase: `${cap(videos(semBotao))} ${semBotao === 1 ? 'tem' : 'têm'} resultado pronto no YouTube.`, apoio: 'A resposta chega na próxima atualização.' }
  }
  if (espera === 0) {
    const n = studio + preparo + nossoRodando
    return {
      frase: 'Nada espera a sua resposta hoje.',
      apoio: n > 0 ? `${cap(videos(n))} em teste ou em preparo. Os demais seguem sem teste.` : null,
    }
  }
  const verbo = espera === 1 ? 'espera' : 'esperam'
  const detalhe = prazo > 0 && hoje > 0
    ? `: ${ext(prazo)} ${prazo === 1 ? 'passou' : 'passaram'} do prazo, ${ext(hoje)} ${hoje === 1 ? 'terminou' : 'terminaram'} hoje`
    : ''
  const frase = `${cap(videos(espera))} ${verbo} a sua resposta${detalhe}.`
  const partes: string[] = []
  if (studio > 0) partes.push(`${ext(studio)} em teste no Studio`)
  if (preparo > 0) partes.push(`${ext(preparo)} em preparo`)
  const frases: string[] = []
  if (partes.length > 0) frases.push(`${cap(partes.join(', '))}.`)
  if (pausadas > 0) frases.push(`O Lab está pausado em ${ext(pausadas)} deles.`)
  if (semBotao > 0) frases.push(`Mais ${ext(semBotao)} ${semBotao === 1 ? 'tem' : 'têm'} resultado pronto; a resposta chega na próxima atualização.`)
  return { frase, apoio: frases.length > 0 ? frases.join(' ') : null }
}
