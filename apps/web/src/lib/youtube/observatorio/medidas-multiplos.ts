// A5 · E7, Tarefa 11b: os múltiplos de M4 por canal. Módulo neutro e puro: a rota do Cowork (services/competitors-medidas)
// e as telas (E5a) derivam do mesmo lugar, para o número ser o mesmo nos dois caminhos.
// Não recalcula nada: lê o múltiplo que o motor já gravou em cada vídeo (`index.ts`: `v.mult = multiplierAt(ctx, v, null)`).
// Sem server-only, sem next, sem cliente de banco.

/** O pedaço do motor de que este módulo precisa; o `Observatory` inteiro satisfaz. */
export interface IMotorDeMultiplos {
  videos: ReadonlyArray<{ id: string; ch: string; mult: { value: number | null; weak: boolean } | null }>
}

export interface MultiploDoVideo { valor: number | null; baseFraca: boolean }

/**
 * Uma entrada por vídeo DAQUELE canal. `valor` é o do motor (nulo quando ele não devolveu); `baseFraca` é o `weak` dele,
 * e `true` quando o motor não devolveu múltiplo (ausência nunca vira "base firme").
 * `agoraMs` fica na assinatura (resposta (m) da Tarefa 10) e NÃO entra na conta: o motor já fixou o múltiplo no último
 * registro do canal; `multiplierAt` pede índice de série, não instante. Dois `agoraMs` dão o mesmo mapa.
 */
export function multiplosDoCanal(obs: IMotorDeMultiplos, channelId: string, _agoraMs: number): Map<string, MultiploDoVideo> {
  const mapa = new Map<string, MultiploDoVideo>()
  for (const v of obs.videos) {
    if (v.ch !== channelId) continue
    mapa.set(v.id, { valor: v.mult?.value ?? null, baseFraca: v.mult?.weak ?? true })
  }
  return mapa
}
