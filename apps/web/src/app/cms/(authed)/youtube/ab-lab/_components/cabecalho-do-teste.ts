import type { AbTestStatus, TestType } from '@/lib/youtube/ab-types'
import type { DiaDaFaixa } from '@/lib/youtube/ab-gravacao/placar'
import { andamentoDoDia, rotuloDoDiaExtenso } from '@/lib/youtube/ab-rotulo-dia'
import { camposDoTeste, type RestoreStatus } from '@/lib/youtube/ab-restore'
import { dataCurtaSp } from '@/lib/youtube/ab-data-curta'

export type TomDoSelo = 'rodando' | 'pausado' | 'escrevendo' | 'concluido' | 'nao_iniciado'

/** Total real do teste: a mesma régua do placar (prazo vencido não deixa o dia passar do total). */
const totalDe = (dayOf: number, durationDays: number): number => Math.max(dayOf, durationDays)

export function seloDoTeste(e: {
  status: AbTestStatus
  dayOf: number
  durationDays: number
  escrevendo?: boolean
  naoIniciado?: boolean
  concluidoEm?: string
}): { tom: TomDoSelo; texto: string } {
  if (e.concluidoEm) return { tom: 'concluido', texto: `Concluído em ${e.concluidoEm}` }
  if (e.naoIniciado) return { tom: 'nao_iniciado', texto: 'Teste do Lab não iniciado' }
  const total = totalDe(e.dayOf, e.durationDays)
  const dia = total >= 1 ? rotuloDoDiaExtenso(e.dayOf, total, { minusculo: true }) : ''
  const com = (rotulo: string) => (dia ? `${rotulo} · ${dia}` : rotulo)
  if (e.escrevendo) return { tom: 'escrevendo', texto: com('Escrevendo no YouTube…') }
  if (e.status === 'paused') return { tom: 'pausado', texto: com('Pausado') }
  return { tom: 'rodando', texto: com('Rodando') }
}

export type FreioDoEncerrar = { tipo: 'sem_leitura' | 'faltam' | 'falta_1' | 'completo'; texto: string }

export function freioDoEncerrar(e: { dayOf: number; durationDays: number; medidos: number; aguardando?: number; resultadoPendente?: boolean }): FreioDoEncerrar {
  const total = totalDe(e.dayOf, e.durationDays)
  const { faltam } = andamentoDoDia(e.dayOf, total)
  const medidos = Math.min(e.medidos, total)
  const aguardando = e.aguardando ?? 0
  if (e.medidos === 0) return { tipo: 'sem_leitura', texto: 'Ainda não há leitura. Encerrar agora não calcula resultado.' }
  if (faltam === 0) {
    // Prazo de calendário completo não é dia medido: o YouTube fecha o dia com atraso.
    if (medidos >= total) return { tipo: 'completo', texto: `Todos os ${total} dias foram medidos.` }
    const espera = aguardando > 0 ? `, ${aguardando} aguardando o YouTube` : ''
    const aviso = e.resultadoPendente ? ' Esperar até amanhã calcula o resultado; encerrar agora, não.' : ''
    return { tipo: 'completo', texto: `O prazo terminou: ${medidos} dos ${total} dias medidos${espera}.${aviso}` }
  }
  if (faltam === 1) return { tipo: 'falta_1', texto: 'Falta 1 dia.' }
  return { tipo: 'faltam', texto: `Faltam ${faltam} dias dos ${total}. Encerrar agora usa só os ${medidos} dias já medidos.` }
}

export function contarDiasMedidos(faixa: readonly DiaDaFaixa[] | undefined): number {
  if (!faixa) return 0
  return faixa.filter(d => d.estado === 'medido' || d.estado === 'zero_medido').length
}

export function contarDiasAguardando(faixa: readonly DiaDaFaixa[] | undefined): number {
  if (!faixa) return 0
  return faixa.filter(d => d.estado === 'aguardando').length
}

export function fraseDaPausa(flag: TestType, restore: RestoreStatus | null): string {
  const padrao = 'Nenhum dia novo entra no placar.'
  const campos = camposDoTeste(flag)
  const ok = campos.length > 0 && campos.every(c => restore?.[c]?.estado === 'ok' && restore[c]?.destino === 'original')
  if (!ok) return padrao
  if (flag === 'title') return 'O título original foi restaurado e nenhum dia novo entra no placar.'
  if (flag === 'thumbnail') return 'A thumbnail original foi restaurada e nenhum dia novo entra no placar.'
  return 'O título e a thumbnail originais foram restaurados e nenhum dia novo entra no placar.'
}

export function fraseDaFaixaDePausa(flag: TestType, restore: RestoreStatus | null, pausedAt: string | null): string {
  const dh = dataCurtaSp(pausedAt)
  const abre = dh ? `Você pausou em ${dh.slice(0, 5)} às ${dh.slice(6)}. ` : ''
  return abre + fraseDaPausa(flag, restore)
}

export function textoDoDialogoDePausa(flag: TestType): string {
  if (flag === 'title') return 'Pausar vai restaurar o título original imediatamente.'
  if (flag === 'thumbnail') return 'Pausar vai restaurar a miniatura original imediatamente.'
  return 'Pausar vai restaurar o título e a miniatura originais imediatamente.'
}

export function linhaFicouNoAr(noAr: { letra: string | null } | null | undefined, concluidoEm?: string): string | null {
  const letra = noAr?.letra
  if (!letra) return null
  return concluidoEm ? `O teste terminou em ${concluidoEm}. Ficou no ar: a versão ${letra}.` : `Ficou no ar: a versão ${letra}.`
}
