// Volume de impressões por vídeo (D-4). A soma é feita no banco (`ab_lab_volume`, em `volume-leitor.ts`); aqui só a regra do piso (módulo leve: o cliente importa).

/** Impressões que cada versão precisa para o teste do YouTube ter dado. */
export const IMPRESSOES_POR_VERSAO = 1540
export const JANELA_TESTE_DIAS = 14
/** Menos dias cobertos que isto: o volume ainda não foi lido (nunca "0"). */
export const DIAS_COBERTOS_MINIMOS = 3

/** Impressões por dia necessárias com `k` versões: ceil(1540·k/14) (k=2 → 220, k=3 → 330). */
export function pisoPorDia(k: number): number {
  return Math.ceil((IMPRESSOES_POR_VERSAO * k) / JANELA_TESTE_DIAS)
}

export interface VolumeDoVideo { porDia: number | null; acimaDoPiso: boolean | null; diasAtePiso: number | null }
export interface VolumeBruto { soma: number; diasCobertos: number }

/** Uma regra de arredondamento só (para cima), aqui; a fronteira 219/220 é de inteiros. */
export function volumeDoVideo(r: VolumeBruto | null, k: number): VolumeDoVideo {
  if (r === null || r.diasCobertos < DIAS_COBERTOS_MINIMOS) return { porDia: null, acimaDoPiso: null, diasAtePiso: null }
  const porDia = Math.ceil(r.soma / r.diasCobertos)
  return {
    porDia,
    acimaDoPiso: porDia >= pisoPorDia(k),
    diasAtePiso: porDia > 0 ? Math.ceil((IMPRESSOES_POR_VERSAO * k) / porDia) : null,
  }
}
