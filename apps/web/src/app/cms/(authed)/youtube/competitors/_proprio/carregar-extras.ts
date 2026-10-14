// Monta o `ExtrasProprio` das páginas de servidor (lista de Canais e comparação). Só chama `podeVerPrivado` e os leitores de
// `dados.ts`: não cria guarda própria nem importa o leitor (uma varredura de teste barra). Sem canal próprio no site nada é
// consultado. Sem permissão de edição, cada canal chega como 'sem-acesso' (sem consulta alguma).
import 'server-only'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { AlcanceCanal, DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { vpdDoCanal, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import { montarSoSeuCanalDado, type SoSeuCanalDado } from '../_comparar/so-seu-canal-model'
import { lerAlcanceDosCanais, lerDiarioDosCanais, longosAcompanhadosDe, podeVerPrivado } from './dados'
import { dmDia, type ExtrasProprio } from './extras'

/**
 * `agora`: o relógio da página (`ObservatoryPage.now`), em ms. `undefined` = o site não tem canal próprio.
 * `previo`: a página do canal próprio já leu o diário DELE com a guarda da própria página: o token vale (sem segunda guarda) e o diário não é lido de novo;
 * só os outros canais próprios do site são lidos.
 */
export async function carregarExtrasProprio(
  obs: Observatory, siteId: string, agora: number, avisar?: (e: unknown, n: number) => void,
  previo?: { leitura: LeituraPrivadaDoSite | null; canalId: string; diario: Privado<DiarioCanal> },
): Promise<ExtrasProprio | undefined> {
  const owns = obs.ownChannels()
  if (owns.length === 0) return undefined
  const leitura = previo ? previo.leitura : await podeVerPrivado(siteId)
  const longos = new Map(owns.map(c => [c.id, longosAcompanhadosDe(obs, c.id)]))
  const aLer = owns.filter(c => c.id !== previo?.canalId)
  const diarios = await lerDiarioDosCanais({ canais: aLer.map(c => ({ id: c.id, longosAcompanhados: longos.get(c.id) ?? [] })), agora, leitura }, avisar)
  if (previo) diarios.set(previo.canalId, previo.diario)
  const hoje = dayPt(new Date(agora))
  const vpd = new Map<string, VpdCanal>(owns.map(c => [c.id, vpdDoCanal(diarios.get(c.id) ?? { acesso: 'negado' }, longos.get(c.id) ?? [], hoje)]))
  return { vpd, dm: dmDia }
}

/**
 * A página da COMPARAÇÃO: as views por dia (`extras`, como acima) e o cartão "Só o seu canal mede" de cada canal próprio do site, tudo com UMA guarda
 * de edição e UMA leitura do diário por canal. O alcance é lido DEPOIS do token e só com ele. Sem token cada canal chega como { acesso: 'negado', view: null }
 * (nenhum número, nenhum cliente de serviço); sem canal próprio no site nada é consultado. A leitura vale para o site, não para o par da URL: trocar o
 * seletor no navegador não vai ao servidor (D14), então o pacote leva o cartão de todos os canais próprios.
 */
export async function carregarProprioDaComparacao(
  obs: Observatory, siteId: string, agora: number, avisar?: (e: unknown, n: number) => void,
): Promise<{ extras: ExtrasProprio | undefined; soSeuCanal: Record<string, SoSeuCanalDado> }> {
  const owns = obs.ownChannels()
  if (owns.length === 0) return { extras: undefined, soSeuCanal: {} }
  const leitura = await podeVerPrivado(siteId)
  const longos = new Map(owns.map(c => [c.id, longosAcompanhadosDe(obs, c.id)]))
  const [diarios, alcances] = await Promise.all([
    lerDiarioDosCanais({ canais: owns.map(c => ({ id: c.id, longosAcompanhados: longos.get(c.id) ?? [] })), agora, leitura }, avisar),
    lerAlcanceDosCanais({ canalIds: owns.map(c => c.id), agora, leitura }, avisar),
  ])
  const hoje = dayPt(new Date(agora))
  const NEGADO = { acesso: 'negado' } as const
  const vpd = new Map<string, VpdCanal>(owns.map(c => [c.id, vpdDoCanal(diarios.get(c.id) ?? NEGADO, longos.get(c.id) ?? [], hoje)]))
  const soSeuCanal: Record<string, SoSeuCanalDado> = {}
  for (const c of owns) {
    const alcance: Privado<AlcanceCanal> = alcances.get(c.id) ?? NEGADO
    soSeuCanal[c.id] = montarSoSeuCanalDado({ nome: c.name, alcance, diario: diarios.get(c.id) ?? NEGADO, longos: longos.get(c.id) ?? [], dm: dmDia, F: obs.fmt, hoje })
  }
  return { extras: { vpd, dm: dmDia }, soSeuCanal }
}
