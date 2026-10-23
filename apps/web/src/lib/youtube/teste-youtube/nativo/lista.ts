// Classificação PURA das linhas da lista "Vídeos do A/B Lab" (F1a-tela-1, T3): estado, agrupamento e frase de resumo.
// A leitura do banco é de `lista-borda.ts`. Nada aqui lê relógio nem banco: o `agora` entra por parâmetro.
import { inicioDoTeste, MARGEM_FECHAMENTO_DIAS } from './guarda'
import { normalizarTitulo } from '../normalizar-titulo'
import { INATIVIDADE_DESCARTE_MS } from './ficha-tela'
import { FRASES, capitalizar } from './frases'
import type { FichaLida } from './ficha'
import type { RespostaDono } from './resposta'
import type { Caminho } from './roteador'
import type { RestoreStatus } from '@/lib/youtube/ab-restore'

export type EstadoLinha =
  | 'sugerido_youtube' | 'sugerido_nosso' | 'formato_nao_confirmado' | 'sem_volume' | 'em_preparo' | 'em_teste_studio'
  | 'nosso_rodando' | 'resultado_pronto' | 'sem_resposta' | 'ficou_no_ar' | 'respostas_diferentes' | 'respondido_sem_vencedor'

export interface LinhaDoCaminho {
  videoId: string; ytId: string; titulo: string; miniaturaUrl: string | null; publicadoEm: string
  estado: EstadoLinha; caminho: Caminho; fichaId: string | null
  registro: {
    id: string; updatedAt: string; confirmadoEm: string | null; primeiraVista: string | null; diaDe14: number
    /** T10 (cartão S7): última leitura do registrador e votos por título (`Record<título, leituras>`); nulo = não medido. */
    ultimaVista?: string | null; votosTitulo?: Record<string, number> | null
    variantes: { n: number; titulo: string | null; imagem: { url: string } | null }[] | null
    variantesTitulo: string[] | null; campos: ('titulo' | 'miniatura')[] | null; respostaDono: RespostaDono | null
    /** F1a-tela-2 (D-1): título vigente na Data API em `primeira_vista`; só lido para origem derivada (`variantes` nulo). */
    tituloAntes: string | null
    varianteVencedora: number | null
    /** 1ª resposta (D-6: só ela decide "tardia") e a última mudança (D-4). */
    respondidoEm: string | null; respostaMudadaEm: string | null
    vencedorFonte: 'regra' | 'dono' | 'data_api' | null; vencedorTitulo: string | null
    /** Quando o Lab leu o desfecho ("No ar, lido pelo Lab em …"); nulo = sem data. */
    desfechoEm: string | null
    /** Início do teste (ISO): o menor entre `primeira_vista` e `confirmado_em`. */
    inicio: string
  } | null
  labPausadoAte: string | null
  nosso: { testId: string; restoreSeq: number; dia: number; status: 'active' | 'paused'; restoreStatus?: RestoreStatus | null } | null
  impressoesPorDia: number | null
  /** T7 (D-8): quando a ficha aberta foi enviada ao Studio (último `studio_aberto_em`/`lembrar_em`, só se `enviada`); nulo = sem pergunta ao iniciar o nosso. */
  fichaEnviadaEm?: string | null
  /** T7 (D-8): a ficha aberta tem a versão B (2 ou mais versões); sem ela "Já iniciei" não registra. */
  fichaCompleta?: boolean
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
const FECHAMENTO_DIAS = DURACAO_DIAS + MARGEM_FECHAMENTO_DIAS

const inicioDe = (r: RegistroDaLista): Date =>
  inicioDoTeste({ primeira_vista: r.primeiraVista, confirmado_em: r.confirmadoEm, created_at: r.createdAt })

/** Instante a partir do qual "Retomar" pode valer: início + 14 d + margem de 2 d (o botão em si depende do dado, não desta data). */
export function retomarAPartirDe(r: { primeiraVista: string | null; confirmadoEm: string | null; createdAt: string }): Date {
  const i = inicioDoTeste({ primeira_vista: r.primeiraVista, confirmado_em: r.confirmadoEm, created_at: r.createdAt })
  return new Date(i.getTime() + FECHAMENTO_DIAS * DIA_MS)
}

/** Fim do prazo do dia 14: início do teste + 14 d (sem a margem de 2 d do fechamento por silêncio). */
export function prazoDoDia14(r: { primeiraVista: string | null; confirmadoEm: string | null; createdAt: string }): Date {
  const i = inicioDoTeste({ primeira_vista: r.primeiraVista, confirmado_em: r.confirmadoEm, created_at: r.createdAt })
  return new Date(i.getTime() + DURACAO_DIAS * DIA_MS)
}

/** Fim do prazo mostrado ao dono (D-6): início + 14 d. */
export function prazoDoTeste(inicio: string | Date): Date {
  return new Date(new Date(inicio).getTime() + DURACAO_DIAS * DIA_MS)
}

/**
 * Resposta tardia (D-6): a 1ª resposta chegou quando a linha já era "Sem resposta" (início + 14 d + margem).
 * Recebe só `respondido_em`: quem respondeu no prazo e mudou depois dele nunca lê "depois do prazo".
 */
export function foiTardia(inicio: string | Date, respondidoEm: string | Date): boolean {
  return new Date(respondidoEm).getTime() >= new Date(inicio).getTime() + FECHAMENTO_DIAS * DIA_MS
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
    // D-5: conflito só versão contra versão, e só com veredito de `regra` ou `data_api` (a fonte `dono` é a própria resposta).
    if ((r.vencedorFonte === 'regra' || r.vencedorFonte === 'data_api') && r.vencedorTitulo !== null && r.tituloDaResposta !== null
      && normalizarTitulo(r.vencedorTitulo) !== normalizarTitulo(r.tituloDaResposta)) return 'respostas_diferentes'
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

const cap = capitalizar

const L = FRASES.lista

export function resumoDaLista(g: { precisaDeVoce: LinhaDoCaminho[]; outros: LinhaDoCaminho[] }): { frase: string; apoio: string | null } {
  const todas = [...g.precisaDeVoce, ...g.outros]
  // Toda linha com resposta pendente conta, qualquer que seja o número de versões ou a origem (tela-2: todas têm botão).
  const prazo = g.precisaDeVoce.filter((l) => l.estado === 'sem_resposta').length
  const hoje = g.precisaDeVoce.filter((l) => l.estado === 'resultado_pronto').length
  const espera = prazo + hoje
  const studio = todas.filter((l) => l.estado === 'em_teste_studio').length
  const studioConfirmado = todas.filter((l) => l.estado === 'em_teste_studio' && Boolean(l.registro?.confirmadoEm)).length
  const studioDetectado = studio - studioConfirmado
  const preparo = todas.filter((l) => l.estado === 'em_preparo').length
  const nossoRodando = todas.filter((l) => l.estado === 'nosso_rodando').length
  const pausadas = todas.filter(pausada).length

  if (espera === 0 && pausadas > 0) {
    const n = studio + preparo + nossoRodando
    return { frase: L.labPausado(pausadas), apoio: n > 0 ? L.apoioEmTesteOuPreparo(n) : null }
  }
  if (espera === 0) {
    const n = studio + preparo + nossoRodando
    return { frase: L.nadaEspera, apoio: n > 0 ? L.apoioEmTesteOuPreparo(n) : null }
  }
  const frase = L.esperam(espera, prazo, hoje)
  const partes: string[] = []
  if (studioConfirmado > 0) partes.push(L.emTesteNoStudio(studioConfirmado))
  if (studioDetectado > 0) partes.push(L.detectados(studioDetectado))
  if (preparo > 0) partes.push(L.emPreparo(preparo))
  const frases: string[] = []
  if (partes.length > 0) frases.push(`${cap(partes.join(', '))}.`)
  if (pausadas > 0) frases.push(L.labPausadoDeles(pausadas))
  return { frase, apoio: frases.length > 0 ? frases.join(' ') : null }
}
