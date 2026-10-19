/**
 * Disparo da watch (A5 S4, Tarefa 12): as três passadas de leitura, o disjuntor, o estado do disparo e a atualização dos alvos.
 * Puro quanto ao banco: a leitura entra por parâmetro. Nunca recebe texto de fora: só códigos de catálogo e números saem daqui.
 */
import type { ResultadoTarefa } from '@/lib/youtube/agenda/tipos'
import type { AlvoAtivo } from './alvos'
import type { AtualizacaoAlvo } from './gravar'
import type { OpcoesLeitor, ResultadoLeitor } from './leitor'
import { CODIGOS_BLOQUEIO } from './parser'
import { proximaRodada, RODADA } from './rodada'

export type MotivoWatch =
  | 'bloqueado' | 'leitura_bloqueada' | 'layout_mudou' | 'gravacao_falhou' | 'sem_alvos' | 'sobrou' | 'extensao_falhou' | 'lista_falhou' | 'schema_ausente'

export interface Passadas { resultados: Map<number, ResultadoLeitor[]>; disjuntor: boolean; tentativas: number }

const PASSADAS = RODADA.leiturasPorRodada
const BLOQUEIOS_PARA_PARAR = 3
const INDISPONIVEIS_PARA_SAIR = 4
const MIN_TENTATIVAS = 6
const MIN_VIDEOS = 3
const TIMEOUT_PADRAO_MS = 10_000
const MIN_TIMEOUT_MS = 1_000
const FOLGA_MS = 8_000

const ehBloqueio = (erro: string | null): boolean => erro !== null && [...CODIGOS_BLOQUEIO].some(c => c === erro)
const temTitulo = (r: ResultadoLeitor): boolean => r.leitura.erro === null && r.leitura.titulosExibidos.some(t => t.texto !== null)

export async function lerPassadas(
  alvos: readonly AlvoAtivo[],
  ler: (ytId: string, o: OpcoesLeitor) => Promise<ResultadoLeitor>,
  o: { origemRede: OpcoesLeitor['origemRede']; agora: () => number; ateMs: number; novoUuid: () => string },
): Promise<Passadas> {
  const resultados = new Map<number, ResultadoLeitor[]>()
  const rodadaDe = new Map<number, string>()
  for (const a of alvos) rodadaDe.set(a.id, o.novoUuid())
  let bloqueios = 0
  let tentativas = 0
  const parou = (): boolean => bloqueios >= BLOQUEIOS_PARA_PARAR

  for (let passada = 1; passada <= PASSADAS; passada++) {
    if (parou() || o.agora() >= o.ateMs) break
    let proximo = 0
    const trabalhador = async (): Promise<void> => {
      for (;;) {
        if (parou() || o.agora() >= o.ateMs) return
        const i = proximo++
        const alvo = alvos[i]
        if (alvo === undefined) return
        const anteriores = resultados.get(alvo.id) ?? []
        const sondar = passada === 1 || !anteriores.some(r => r.leitura.erro === null)
        tentativas++
        // O timeout nunca passa do que resta: uma leitura lenta não leva a passada além do teto (ateMs + folga de 8 s).
        const timeoutMs = Math.max(MIN_TIMEOUT_MS, Math.min(TIMEOUT_PADRAO_MS, o.ateMs + FOLGA_MS - o.agora()))
        const r = await ler(alvo.ytId, { rodadaId: rodadaDe.get(alvo.id) ?? o.novoUuid(), origemRede: o.origemRede, sondarMiniatura: sondar, timeoutMs })
        resultados.set(alvo.id, [...(resultados.get(alvo.id) ?? []), r])
        if (ehBloqueio(r.leitura.erro)) bloqueios++
      }
    }
    await Promise.all(Array.from({ length: Math.min(RODADA.concorrencia, alvos.length) }, trabalhador))
  }
  return { resultados, disjuntor: parou(), tentativas }
}

export function estadoDoDisparo(
  p: Passadas,
  extra: {
    sobraram: number; extensaoFalhou: number; gravou: boolean; candidatosEsperados: number; alvosAtivos: number
    foraDoFormato?: number; devidos?: number; inicioMs?: number
  },
): ResultadoTarefa {
  const todas = [...p.resultados.values()].flat()
  const feitas = todas.filter(temTitulo).length
  const comErro = todas.filter(r => r.leitura.erro !== null).length
  const semTitulo = todas.filter(r => r.leitura.erro === null && !temTitulo(r)).length
  const detalhe: Record<string, number> = {
    lidas: todas.length, com_erro: comErro, sem_titulo: semTitulo,
    jogador_bloqueado: todas.filter(r => r.jogadorBloqueado).length,
    fora_do_formato: extra.foraDoFormato ?? todas.filter(r => r.leitura.erro === 'fora_do_formato').length,
    devidos: extra.devidos ?? p.resultados.size, sobraram: extra.sobraram, alvos_ativos: extra.alvosAtivos,
    candidatos_esperados: extra.candidatosEsperados, inicio_ms: extra.inicioMs ?? 0,
  }
  const base = { feitas, deixadas: extra.sobraram, detalhe }

  // leitura_bloqueada: indisponivel é propriedade do vídeo, fora do numerador e do denominador.
  const validas = todas.filter(r => r.leitura.erro !== 'indisponivel')
  const falhas = validas.filter(r => r.leitura.erro !== null && !ehBloqueio(r.leitura.erro)).length
  const videos = new Set(validas.map(r => r.leitura.youtubeVideoId)).size
  const semErro = todas.filter(r => r.leitura.erro === null)

  if (p.disjuntor) return { estado: 'erro', ...base, motivo: 'bloqueado' }
  if (!extra.gravou) return { estado: 'erro', ...base, motivo: 'gravacao_falhou' }
  if (validas.length >= MIN_TENTATIVAS && videos >= MIN_VIDEOS && falhas / validas.length > 0.5) return { estado: 'erro', ...base, motivo: 'leitura_bloqueada' }
  if (semErro.length >= MIN_TENTATIVAS && semTitulo / semErro.length > 0.5) return { estado: 'erro', ...base, motivo: 'layout_mudou' }
  if (extra.alvosAtivos === 0 && extra.candidatosEsperados > 0) return { estado: 'parcial', ...base, motivo: 'sem_alvos' }
  if (extra.extensaoFalhou > 0) return { estado: 'parcial', ...base, motivo: 'extensao_falhou' }
  if (extra.sobraram > 0) return { estado: 'parcial', ...base, motivo: 'sobrou' }
  return { estado: 'ok', ...base }
}

/** Alvo com 3 leituras fecha a rodada; com 1 ou 2 (rodada partida) só as leituras são gravadas e o alvo continua devido. */
export function atualizacoesDosAlvos(alvos: readonly AlvoAtivo[], p: Passadas, agoraMs: number, rng: () => number): AtualizacaoAlvo[] {
  const out: AtualizacaoAlvo[] = []
  for (const a of alvos) {
    const rs = p.resultados.get(a.id) ?? []
    if (rs.length < PASSADAS) continue
    const u: AtualizacaoAlvo = {
      id: a.id,
      proxima_rodada_em: new Date(proximaRodada(agoraMs, a.horaBaseMin, a.rodadasPorDia, rng)).toISOString(),
      ultima_rodada_em: new Date(agoraMs).toISOString(),
      rodadas_mais: 1,
    }
    let seguidas = a.indisponivelSeguidas
    if (rs.every(r => r.leitura.erro === 'indisponivel')) seguidas += 1
    else if (rs.some(temTitulo)) seguidas = 0
    if (seguidas !== a.indisponivelSeguidas) u.indisponivel_seguidas = seguidas
    if (seguidas >= INDISPONIVEIS_PARA_SAIR && !a.temTesteNosso) {
      u.saiu_em = new Date(agoraMs).toISOString()
      u.saiu_por = 'indisponivel'
    }
    out.push(u)
  }
  return out
}
