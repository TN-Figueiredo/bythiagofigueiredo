// Monta o `ExtrasProprio` das páginas de servidor (lista de Canais e comparação). Só chama `podeVerPrivado` e os leitores de
// `dados.ts`: não cria guarda própria nem importa o leitor (uma varredura de teste barra). Sem canal próprio no site nada é
// consultado. Sem permissão de edição, cada canal chega como 'sem-acesso' (sem consulta alguma).
import 'server-only'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'
import type { DiarioCanal, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { vpdDoCanal, type VpdCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import { lerDiarioDosCanais, longosAcompanhadosDe, podeVerPrivado } from './dados'
import { dmDia, type ExtrasProprio } from './extras'

/**
 * `agora`: o relógio da página (`ObservatoryPage.now`), em ms. `undefined` = o site não tem canal próprio.
 * `previo`: a página do canal próprio já leu o diário DELE com a guarda da própria página: o token vale (sem segunda guarda) e o diário não é lido de novo;
 * só os outros canais próprios do site são lidos.
 */
export async function carregarExtrasProprio(
  obs: Observatory, siteId: string, agora: number, avisar?: (e: unknown, n: number) => void,
  previo?: { edicao: EdicaoDoSite | null; canalId: string; diario: Privado<DiarioCanal> },
): Promise<ExtrasProprio | undefined> {
  const owns = obs.ownChannels()
  if (owns.length === 0) return undefined
  const edicao = previo ? previo.edicao : await podeVerPrivado(siteId)
  const longos = new Map(owns.map(c => [c.id, longosAcompanhadosDe(obs, c.id)]))
  const aLer = owns.filter(c => c.id !== previo?.canalId)
  const diarios = await lerDiarioDosCanais({ canais: aLer.map(c => ({ id: c.id, longosAcompanhados: longos.get(c.id) ?? [] })), agora, edicao }, avisar)
  if (previo) diarios.set(previo.canalId, previo.diario)
  const hoje = dayPt(new Date(agora))
  const vpd = new Map<string, VpdCanal>(owns.map(c => [c.id, vpdDoCanal(diarios.get(c.id) ?? { acesso: 'negado' }, longos.get(c.id) ?? [], hoje)]))
  return { vpd, dm: dmDia }
}
