// Núcleo puro de `avisos_pendentes` (F1a-dado, T12): quem recebe o lembrete do dia 14 e quem é fechado por silêncio. Sem banco, sem relógio próprio.
import { inicioDoTeste, MARGEM_FECHAMENTO_DIAS } from './guarda'

export interface LinhaAviso {
  id: string
  estado: string
  primeira_vista: string | null
  confirmado_em: string | null
  created_at: string
  resposta_dono: string | null
  lembrete_notificado_em: string | null
  notificacao_falhou_em: string | null
  notificacao_tentativas?: number
}

const DIA_MS = 86_400_000
export const DIAS_ATE_O_LEMBRETE = 14
export const DIAS_ATE_O_FECHAMENTO = 16

const inicioMs = (l: LinhaAviso): number => inicioDoTeste(l).getTime()

/** Estados em que o lembrete ainda pode sair e linha sem resposta, confirmada, sem lembrete enviado nem desistido. */
function candidataAoLembrete(l: LinhaAviso): boolean {
  return (l.estado === 'em_andamento' || l.estado === 'encerrado' || l.estado === 'sem_desfecho')
    && l.confirmado_em !== null
    && l.resposta_dono === null
    && l.lembrete_notificado_em === null
    && l.notificacao_falhou_em === null
}

/** Base das tentativas: max(início + 14 d, confirmado_em). A tentativa n (0 = a primeira) só a partir de base + n dias: no máximo uma por dia. */
function baseDoLembrete(l: LinhaAviso): number {
  return Math.max(inicioMs(l) + DIAS_ATE_O_LEMBRETE * DIA_MS, Date.parse(l.confirmado_em as string))
}

const podeTentarAgora = (l: LinhaAviso, agora: Date): boolean =>
  baseDoLembrete(l) + (l.notificacao_tentativas ?? 0) * DIA_MS <= agora.getTime()

/** Confirmada, em aberto ou já encerrada sem a resposta do dono, com 14 dias desde o início e sem lembrete enviado nem desistido; no máximo uma tentativa por dia. Sem corte por `created_at`. */
export function devidosDoLembrete(linhas: readonly LinhaAviso[], agora: Date): string[] {
  return linhas.filter((l) => candidataAoLembrete(l) && podeTentarAgora(l, agora)).map((l) => l.id)
}

/** Quantas já tentaram (>= 1) e aguardam o dia seguinte: não tentam e não contam tentativa. */
export function emEsperaDoLembrete(linhas: readonly LinhaAviso[], agora: Date): number {
  return linhas.filter((l) => candidataAoLembrete(l) && (l.notificacao_tentativas ?? 0) >= 1 && !podeTentarAgora(l, agora)).length
}

/** Dias inteiros desde o início do teste (para o texto do aviso). */
export function diasDesdeOInicio(l: LinhaAviso, agora: Date): number {
  return Math.max(0, Math.floor((agora.getTime() - inicioMs(l)) / DIA_MS))
}

/** Fecha por silêncio só o que está em andamento, sem resposta, com 16 dias, e cuja pergunta JÁ saiu (lembrete há ≥ a margem) ou desistiu de sair. */
export function devidosDoFechamento(linhas: readonly LinhaAviso[], agora: Date): string[] {
  const t = agora.getTime()
  return linhas
    .filter((l) => {
      if (l.estado !== 'em_andamento' || l.confirmado_em === null || l.resposta_dono !== null) return false
      if (inicioMs(l) + DIAS_ATE_O_FECHAMENTO * DIA_MS > t) return false
      if (l.notificacao_falhou_em !== null) return true
      if (l.lembrete_notificado_em === null) return false
      return Date.parse(l.lembrete_notificado_em) <= t - MARGEM_FECHAMENTO_DIAS * DIA_MS
    })
    .map((l) => l.id)
}
