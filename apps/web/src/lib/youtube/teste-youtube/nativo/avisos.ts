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
}

const DIA_MS = 86_400_000
export const DIAS_ATE_O_LEMBRETE = 14
export const DIAS_ATE_O_FECHAMENTO = 16

const inicioMs = (l: LinhaAviso): number => inicioDoTeste(l).getTime()

/** Confirmada, em aberto ou já encerrada sem a resposta do dono, com 14 dias desde o início e sem lembrete enviado nem desistido. Sem corte por `created_at`. */
export function devidosDoLembrete(linhas: readonly LinhaAviso[], agora: Date): string[] {
  return linhas
    .filter((l) =>
      (l.estado === 'em_andamento' || l.estado === 'encerrado' || l.estado === 'sem_desfecho')
      && l.confirmado_em !== null
      && l.resposta_dono === null
      && l.lembrete_notificado_em === null
      && l.notificacao_falhou_em === null
      && inicioMs(l) + DIAS_ATE_O_LEMBRETE * DIA_MS <= agora.getTime())
    .map((l) => l.id)
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
