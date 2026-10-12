// Monta o `ExtrasProprio` das páginas de servidor (lista de Canais e comparação). Só chama `podeVerPrivado` e os leitores de
// `dados.ts`: não cria guarda própria nem importa o leitor (uma varredura de teste barra). Sem canal próprio no site nada é
// consultado. Sem permissão de edição, cada canal chega como 'sem-acesso' (sem consulta alguma).
import 'server-only'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import type { Observatory } from '@/lib/youtube/observatorio'
import { vpdDoCanal, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import { lerDiarioDosCanais, longosAcompanhadosDe, podeVerPrivado } from './dados'
import { dmDia, type ExtrasProprio } from './extras'

/** `agora`: o relógio da página (`ObservatoryPage.now`), em ms. `undefined` = o site não tem canal próprio. */
export async function carregarExtrasProprio(obs: Observatory, siteId: string, agora: number, avisar?: (e: unknown, n: number) => void): Promise<ExtrasProprio | undefined> {
  const owns = obs.ownChannels()
  if (owns.length === 0) return undefined
  const edicao = await podeVerPrivado(siteId)
  const longos = new Map(owns.map(c => [c.id, longosAcompanhadosDe(obs, c.id)]))
  const diarios = await lerDiarioDosCanais({ canais: owns.map(c => ({ id: c.id, longosAcompanhados: longos.get(c.id) ?? [] })), agora, edicao }, avisar)
  const hoje = dayPt(new Date(agora))
  const vpd = new Map<string, VpdCanal>(owns.map(c => [c.id, vpdDoCanal(diarios.get(c.id) ?? { acesso: 'negado' }, longos.get(c.id) ?? [], hoje)]))
  return { vpd, dm: dmDia }
}
