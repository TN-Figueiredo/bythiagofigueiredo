import { randomUUID } from 'node:crypto'
import { schemaTablesReady } from '@/lib/youtube/competitor-health'
import { conciliar, lerDevidos, marcarTesteNosso } from '@/lib/youtube/watch/alvos'
import { atualizacoesDosAlvos, estadoDoDisparo, lerPassadas, type Passadas } from '@/lib/youtube/watch/disparo'
import { avaliarExtensoes, juntarAtualizacoes, saidasPorJanela, type ResultadoExtensao } from '@/lib/youtube/watch/extensao'
import { gravarComDegrau, type PayloadDisparo } from '@/lib/youtube/watch/gravar'
import { lerWatchSemCookie } from '@/lib/youtube/watch/leitor'
import { paraLinhas, type LinhaLeitura, type LinhaThumb } from '@/lib/youtube/watch/expansor'
import { RODADA, kAgora } from '@/lib/youtube/watch/rodada'
import { relatarAgenda } from '../fecho'
import { BANCO_MS } from '../relogio'
import { DEFINICAO_LEITURA_WATCH } from '../definicoes'
import type { ContextoTarefa, ResultadoTarefa, Tarefa } from '../tipos'

/** Só existe se o P-V passar (a Vercel enxerga a divisão); a forja seria outro valor. */
export const ORIGEM_REDE = 'vercel' as const
const ORCAMENTO_PROPRIO_MS = RODADA.orcamentoS * 1000
const FIXOS_MS = RODADA.segundosFixos * 1000
const BANCO_ATE_MS = RODADA.bancoAteS * 1000
const COMECA_ATE_MS = RODADA.comecaAteS * 1000

export interface DepsLeituraWatch {
  ler?: typeof lerWatchSemCookie
  novoUuid?: () => string
  rng?: () => number
}

const semFeito = (estado: ResultadoTarefa['estado'], motivo: string, deixadas: number | null = null): ResultadoTarefa =>
  ({ estado, feitas: 0, deixadas, motivo })

/**
 * `leitura_watch`: guarda de schema, conciliação, alvos devidos (K pelo relógio), três passadas, extensão, saída por janela, gravação
 * (uma chamada, com degrau) e o estado do disparo. Nenhuma ida ao banco começa depois de t0 + 83 s; a tarefa dura no máximo 30 s próprios.
 */
export async function rodarLeituraWatch(c: ContextoTarefa, deps: DepsLeituraWatch = {}): Promise<ResultadoTarefa> {
  const ler = deps.ler ?? lerWatchSemCookie
  const novoUuid = deps.novoUuid ?? randomUUID
  const rng = deps.rng ?? Math.random
  const inicio = c.agora()
  const decorrido = inicio - c.t0
  const fimBanco = c.t0 + BANCO_ATE_MS

  const falha = await schemaTablesReady(c.sb, [['MG-S4', [
    ['yt_watch_alvos', 'id'], ['yt_watch_readings', 'id'], ['yt_watch_thumbs', 'id'],
  ]]], { signal: AbortSignal.timeout(BANCO_MS) })
  if (falha !== null) return falha.tipo === 'ausente' ? semFeito('parcial', 'schema_ausente') : semFeito('erro', 'schema_nao_conferido')

  if (decorrido > COMECA_ATE_MS) return semFeito('parcial', 'sobrou')

  const conc = await conciliar(c.sb, c.agora(), relatarAgenda)
  if (!('valor' in conc)) return semFeito('erro', 'lista_falhou')
  const { candidatosEsperados, alvosAtivos, testesVivos, idsDescartados } = conc.valor

  const k = kAgora(decorrido, RODADA.kMax)
  if (c.agora() >= fimBanco) return semFeito('parcial', 'sobrou')
  // Pede K + 1: a sobra prova que ficou vídeo devido para o próximo disparo.
  const devidosLidos = await lerDevidos(c.sb, c.agora(), k + 1)
  if (!('valor' in devidosLidos)) return semFeito('erro', 'lista_falhou')
  const sobraram = Math.max(0, devidosLidos.valor.length - k)
  const devidos = marcarTesteNosso(devidosLidos.valor.slice(0, k), testesVivos)

  const vazias: Passadas = { resultados: new Map(), disjuntor: false, tentativas: 0 }
  if (devidos.length === 0) {
    return estadoDoDisparo(vazias, { sobraram, extensaoFalhou: 0, gravou: true, candidatosEsperados, alvosAtivos, devidos: 0, inicioMs: decorrido, idsDescartados })
  }

  const passadas = await lerPassadas(devidos, (yt, o) => ler(yt, { ...o, agora: c.agora }), {
    origemRede: ORIGEM_REDE, agora: c.agora, ateMs: Math.min(inicio + ORCAMENTO_PROPRIO_MS - FIXOS_MS, c.t0 + COMECA_ATE_MS), novoUuid,
  })

  const siteDe = new Map(devidos.map(a => [a.id, a.siteId]))
  const leituras: LinhaLeitura[] = []
  const thumbs: LinhaThumb[] = []
  let proximoK = 0
  for (const [id, rs] of passadas.resultados) {
    const siteId = siteDe.get(id)
    if (siteId === undefined) continue
    for (const r of rs) {
      const l = paraLinhas(r, siteId, proximoK)
      if (l.thumb !== null) { thumbs.push(l.thumb); proximoK++ }
      leituras.push(l.leitura)
    }
  }

  const agoraMs = c.agora()
  let ext: ResultadoExtensao = { atualizacoes: new Map(), avaliados: new Set<number>(), falharam: 0 }
  if (agoraMs < fimBanco) ext = await avaliarExtensoes(c.sb, devidos, passadas.resultados, agoraMs, fimBanco, { relogio: c.agora })

  const alvos = juntarAtualizacoes(
    atualizacoesDosAlvos(devidos, passadas, agoraMs, rng),
    [...ext.atualizacoes].map(([id, u]) => ({ id, ...u })),
    saidasPorJanela(devidos, ext, agoraMs),
  )
  const payload: PayloadDisparo = { thumbs, leituras, alvos }
  const g = await gravarComDegrau(c.sb, payload, { agora: c.agora, ateMs: fimBanco, alvos: devidos })
  return estadoDoDisparo(passadas, {
    sobraram, extensaoFalhou: ext.falharam, gravou: g.ok, candidatosEsperados, alvosAtivos, foraDoFormato: g.foraDoFormato,
    devidos: devidos.length, inicioMs: decorrido, idsDescartados,
  })
}

export const leituraWatch: Tarefa = {
  ...DEFINICAO_LEITURA_WATCH,
  devidaPeloDado: () => true,
  rodar: c => rodarLeituraWatch(c),
}
