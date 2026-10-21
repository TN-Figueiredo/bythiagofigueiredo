export type ModoPausaDetectado = 'off' | 'log' | 'on'

/** Comparação exata; ausente ou desconhecido = 'off'. 'log' nunca toca status_note. */
export function modoPausaPorDetectado(env: NodeJS.ProcessEnv = process.env): ModoPausaDetectado {
  const v = env.AB_PAUSA_POR_DETECTADO
  if (v === 'log') return 'log'
  if (v === 'on') return 'on'
  return 'off'
}
