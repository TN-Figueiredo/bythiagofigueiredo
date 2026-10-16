/** Os números da prova dos ausentes quando nada acontece (A5 E9, Tarefa 8): o padrão do falso de `competitor-missing-proof` nos testes do cron. */
import type { ProvaDosAusentes, VereditoDosAusentes } from '@/lib/youtube/competitor-missing-proof'

export const ZEROS_AUSENTES: ProvaDosAusentes = {
  videos_ausentes: 0, linhas_de_ausentes: 0, miniaturas_de_ausentes: 0, ausentes_com_queda: 0, pisos_novos: 0,
  esperando: 0, mais_antigo_dias: null, apagando: 0, apagando_ha_mais_de_1d: 0, voltaram_sem_resposta: 0,
}
export const VERDE_AUSENTES: VereditoDosAusentes = { ok: true, problems: [], notes: [], numeros: ZEROS_AUSENTES }
export const FECHO_VAZIO = { tentados: 0, concluidos: 0, sites: [] as string[] }
