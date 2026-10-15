// apps/web/src/lib/youtube/observatorio/medidas-telas/tarefa-viva.ts
// E5a Tarefa 14a0: a tarefa da agenda está viva? Função só, sem ida ao banco e sem importar a E4.
// A mesma regra de `avaliarAgenda` (agenda/saude.ts), com a primeira execução DA PRÓPRIA tarefa no lugar do
// começo da agenda inteira. A tolerância vem sempre de quem chama (toleranciaVigiaH de agenda/definicoes.ts).
// "Havendo linha gravada" é condição de quem chama: zero linha do site decide "ainda não começou" ANTES e
// esta função nem é chamada.

export type TarefaViva =
  | { estado: 'viva' }
  | { estado: 'parada'; desdeMs: number; semOk: boolean }
  | { estado: 'nao_lida' }

export function tarefaViva(o: {
  ultimoOkMs: number | null
  primeiraExecucaoMs: number | null
  toleranciaH: number
  agoraMs: number
}): TarefaViva {
  const limiteMs = o.toleranciaH * 3_600_000
  if (o.ultimoOkMs !== null) {
    return o.agoraMs - o.ultimoOkMs <= limiteMs
      ? { estado: 'viva' }
      : { estado: 'parada', desdeMs: o.ultimoOkMs, semOk: false }
  }
  if (o.primeiraExecucaoMs === null) return { estado: 'nao_lida' }
  return o.agoraMs - o.primeiraExecucaoMs <= limiteMs
    ? { estado: 'viva' }
    : { estado: 'parada', desdeMs: o.primeiraExecucaoMs, semOk: true }
}
