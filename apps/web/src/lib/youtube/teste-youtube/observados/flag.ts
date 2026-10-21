export type ModoTrocasConcorrente = 'off' | 'on'

/** Comparação exata (como `modoPausaPorDetectado`); ausente ou desconhecido = 'off'. A etapa não vai ligada no deploy (§5.8, T13). */
export function modoTrocasConcorrente(env: NodeJS.ProcessEnv = process.env): ModoTrocasConcorrente {
  return env.OBS_TROCAS_CONCORRENTE === 'on' ? 'on' : 'off'
}
