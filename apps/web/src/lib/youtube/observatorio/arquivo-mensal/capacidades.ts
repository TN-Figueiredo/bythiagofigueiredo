/**
 * Manutenção M3b, P54 (item 163): o que o servidor sabe fazer pela remoção de canal. Só servidor; nada aqui lê banco.
 * "Comando sim, bloco não" volta como "não, não": o comando de limpeza só existe com o bloco da tela entregue.
 */
import 'server-only'

export interface Capacidades { comandoDeLimpeza: boolean; blocoCanaisRemovidos: boolean; dataDoComando: string | null }
/** Vira true no commit da M5 que traz o componente (04 §14.3). */
export const BLOCO_CANAIS_REMOVIDOS = false

export function lerCapacidades(env: NodeJS.ProcessEnv = process.env): Capacidades {
  const data = env.OBS_ARQUIVO_LIMPEZA_CANAL_DATA
  return {
    comandoDeLimpeza: env.OBS_ARQUIVO_LIMPEZA_CANAL === 'on' && BLOCO_CANAIS_REMOVIDOS,
    blocoCanaisRemovidos: BLOCO_CANAIS_REMOVIDOS,
    dataDoComando: typeof data === 'string' && data.length > 0 ? data : null,
  }
}
