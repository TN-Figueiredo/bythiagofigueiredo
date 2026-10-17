// Monta o `ExtrasProprio` das páginas de servidor (lista de Canais e comparação). Só chama `acessoPrivado` e os leitores de
// `dados.ts`: não cria guarda própria nem importa o leitor (uma varredura de teste barra). Sem canal próprio no site nada é
// consultado. Sem permissão de edição, cada canal chega como 'sem-acesso' (sem consulta alguma).
import 'server-only'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import { DIMENSOES_LIGADO_EM } from '@/lib/youtube/coleta/e11-config'
import { mapLimit } from '@/lib/youtube/observatorio/load'
import type { Observatory } from '@/lib/youtube/observatorio'
import { leituraValida, type AcessoPrivado, type LeituraPrivadaDoSite, type MotivoSemLeitura } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { AlcanceCanal, DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { vpdDoCanal, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import { totalDoPeriodo } from '@/lib/youtube/observatorio/proprio/diario-periodo'
import { montarSoSeuCanalDado, type EntradaOrigemCartao, type SoSeuCanalDado } from '../_comparar/so-seu-canal-model'
import { acessoPrivado, ausenciaDaProva, lerAlcanceDosCanais, lerDiarioDosCanais, longosAcompanhadosDe } from './dados'
import { lerOrigem } from './dados-origem'
import { lerTermosESites } from './dados-termos'
import { videosDaOrigem } from './origem-model'
import { dmDia, type ExtrasProprio } from './extras'

/**
 * `agora`: o relógio da página (`ObservatoryPage.now`), em ms. `undefined` = o site não tem canal próprio.
 * `previo`: a página do canal próprio já leu o diário DELE com a guarda da própria página: o token vale (sem segunda guarda) e o diário não é lido de novo;
 * só os outros canais próprios do site são lidos.
 */
export async function carregarExtrasProprio(
  obs: Observatory, siteId: string, agora: number, avisar?: (e: unknown, n: number) => void,
  previo?: { leitura: LeituraPrivadaDoSite | null; canalId: string; diario: Privado<DiarioCanal>; negativa?: MotivoSemLeitura | null },
): Promise<ExtrasProprio | undefined> {
  const owns = obs.ownChannels()
  if (owns.length === 0) return undefined
  const acesso: AcessoPrivado = previo ? { leitura: previo.leitura, edita: false, negativa: previo.negativa ?? null } : await acessoPrivado(siteId)
  const leitura = acesso.leitura
  // decisão 75: guarda caída (`nao_foi_possivel_conferir`) é `erro`, nunca `negado`: o `vpd` sai `leitura-falhou`, nunca o cadeado
  const semLeitura = ausenciaDaProva(acesso)
  const longos = new Map(owns.map(c => [c.id, longosAcompanhadosDe(obs, c.id)]))
  const aLer = owns.filter(c => c.id !== previo?.canalId)
  const diarios = await lerDiarioDosCanais({ canais: aLer.map(c => ({ id: c.id, longosAcompanhados: longos.get(c.id) ?? [] })), agora, leitura }, avisar)
  if (semLeitura !== 'ok' && semLeitura.acesso === 'erro') for (const c of owns) diarios.set(c.id, semLeitura)
  else if (previo) diarios.set(previo.canalId, previo.diario)
  const hoje = dayPt(new Date(agora))
  const vpd = new Map<string, VpdCanal>(owns.map(c => [c.id, vpdDoCanal(diarios.get(c.id) ?? { acesso: 'negado' }, longos.get(c.id) ?? [], hoje)]))
  return { vpd, dm: dmDia, negativa: acesso.negativa }
}

/**
 * A página da COMPARAÇÃO: as views por dia (`extras`, como acima) e o cartão "Só o seu canal mede" de cada canal próprio do site, tudo com UMA guarda
 * de edição e UMA leitura do diário por canal. O alcance é lido DEPOIS do token e só com ele. Sem token cada canal chega como { acesso: 'negado', view: null }
 * (nenhum número, nenhum cliente de serviço); sem canal próprio no site nada é consultado. A leitura vale para o site, não para o par da URL: trocar o
 * seletor no navegador não vai ao servidor (D14), então o pacote leva o cartão de todos os canais próprios.
 */
export async function carregarProprioDaComparacao(
  obs: Observatory, siteId: string, agora: number, avisar?: (e: unknown, n: number) => void,
  /** Os ids dos canais do par da URL: só estes têm as cinco linhas da origem (7 dias). Ausente = nenhum (o cartão fica com as quatro do alcance). */
  par: readonly string[] = [],
): Promise<{ extras: ExtrasProprio | undefined; soSeuCanal: Record<string, SoSeuCanalDado> }> {
  const owns = obs.ownChannels()
  if (owns.length === 0) return { extras: undefined, soSeuCanal: {} }
  const acesso = await acessoPrivado(siteId)
  const leitura = acesso.leitura
  // decisão 75: guarda caída é `erro` em todo canal (nunca `negado`/cadeado); chave ausente do mapa também é falha, não negação
  const semLeitura = ausenciaDaProva(acesso)
  const SEM_PROVA: { acesso: 'negado' } | { acesso: 'erro' } = semLeitura === 'ok' ? { acesso: 'erro' } : semLeitura
  const longos = new Map(owns.map(c => [c.id, longosAcompanhadosDe(obs, c.id)]))
  const [diarios, alcances] = await Promise.all([
    lerDiarioDosCanais({ canais: owns.map(c => ({ id: c.id, longosAcompanhados: longos.get(c.id) ?? [] })), agora, leitura }, avisar),
    lerAlcanceDosCanais({ canalIds: owns.map(c => c.id), agora, leitura }, avisar),
  ])
  const hoje = dayPt(new Date(agora))
  const NEGADO = { acesso: 'negado' } as const
  if (semLeitura !== 'ok' && semLeitura.acesso === 'erro') for (const c of owns) { diarios.set(c.id, semLeitura); alcances.set(c.id, semLeitura) }
  const vpd = new Map<string, VpdCanal>(owns.map(c => [c.id, vpdDoCanal(diarios.get(c.id) ?? SEM_PROVA, longos.get(c.id) ?? [], hoje)]))
  // as cinco linhas da origem: só para os canais próprios do par, no máximo 4 em voo; a falha de um vira `erro` naquele canal (a leitura já avisa o Sentry)
  const doPar = owns.filter(c => par.includes(c.id))
  const ordemPub = (v: { pub: number }) => dayPt(new Date(v.pub))
  const origens = new Map<string, EntradaOrigemCartao>()
  if (leituraValida(leitura)) {
    await mapLimit(doPar, 4, async c => {
      const diario = diarios.get(c.id)
      const ate = diario?.acesso === 'ok' && diario.dado.ultimoDia ? diario.dado.ultimoDia : addDays(hoje, -3)
      const de = addDays(ate, -6)
      const ytIds = videosDaOrigem(obs, c.id)
      const publicacoes = new Map<string, string | null>(obs.videos.filter(v => v.ch === c.id).map(v => [v.ytId, ordemPub(v)]))
      const [origem, termos] = await Promise.all([
        lerOrigem({ canalId: c.id, ytIds, de, ate, diarioDesde: de, publicacoes, agora, prova: leitura }),
        acesso.edita ? lerTermosESites({ canalId: c.id, ytIds, de, ate, agora, prova: leitura }) : Promise.resolve(NEGADO),
      ])
      const total = origem.acesso === 'ok' ? totalDoPeriodo(origem.dado.diario, { de, ate }) : null
      origens.set(c.id, {
        origem, termos, hojePt: hoje, ligadoEm: DIMENSOES_LIGADO_EM, publicacoes, podeEditar: acesso.edita, dm: dmDia, dmy: d => `${dmDia(d)}/${d.slice(0, 4)}`, n: x => obs.fmt.int(x),
        periodo: {
          id: '7', rotulo: '7 dias', de, ate, totalDoPeriodo: total?.total ?? null,
          videosDoTotal: total ? { naConta: total.videosNaConta, fora: total.videosFora, parados: total.videosParados, paradosDesde: total.paradosDesde, comBuraco: total.comBuraco } : null,
        },
      })
    })
  }
  const soSeuCanal: Record<string, SoSeuCanalDado> = {}
  for (const c of owns) {
    const alcance: Privado<AlcanceCanal> = alcances.get(c.id) ?? SEM_PROVA
    soSeuCanal[c.id] = montarSoSeuCanalDado({ nome: c.name, alcance, diario: diarios.get(c.id) ?? SEM_PROVA, longos: longos.get(c.id) ?? [], dm: dmDia, F: obs.fmt, hoje, origem: origens.get(c.id) })
  }
  return { extras: { vpd, dm: dmDia, negativa: acesso.negativa }, soSeuCanal }
}
