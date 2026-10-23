// Roteador nativo × nosso (§5.1, D9). Função pura: recebe só valores já lidos; a borda (`formato-borda.ts`) lê o banco.

/** Cada campo é `null` quando não se sabe: nulo nunca vira `false` (se o formato do bruto mudar, cai no terceiro estado). */
export interface Formato { isShort: boolean | null; kids: boolean | null; adulto: boolean | null; aoVivo: boolean | null }

export type Caminho =
  | { tipo: 'nativo'; portao: boolean; motivo: string }
  | { tipo: 'nosso'; motivo: string }
  | { tipo: 'nao_confirmado'; motivo: string }
  | { tipo: 'sem_volume'; motivo: string }

/** Vídeo publicado há menos dias que isto é lançamento: nativo sem portão de volume. */
export const IDADE_LANCAMENTO_DIAS = 7

export interface EntradaDoRoteador {
  formato: Formato
  idadeDias: number
  /** O piso numérico é do Phil (§5.4) e chega já calculado; `null` = volume ainda não lido. */
  impressoesAcimaDoPiso: boolean | null
}

export function caminhoDoTeste(e: EntradaDoRoteador): Caminho {
  const { formato: f } = e
  // O que é certo vence o que falta: kids, 18+ ou ao vivo `true` decidem mesmo com o resto nulo.
  if (f.kids === true) return { tipo: 'nosso', motivo: 'Vídeo para crianças: o Studio não oferece o teste. Só o nosso, como indício.' }
  if (f.adulto === true) return { tipo: 'nosso', motivo: 'Vídeo com restrição de idade: o Studio não oferece o teste. Só o nosso, como indício.' }
  if (f.aoVivo === true) return { tipo: 'nosso', motivo: 'Transmissão ao vivo ou estreia agendada: o Studio não oferece o teste. Só o nosso, como indício.' }
  if (f.isShort === true) return { tipo: 'nosso', motivo: 'Short: o Studio não oferece o teste. Só o nosso, como indício.' }
  if (f.isShort === null) return { tipo: 'nao_confirmado', motivo: 'Ainda não sabemos se é Short. Se for, o Studio não oferece o teste.' }
  if (f.kids === null) return { tipo: 'nao_confirmado', motivo: 'Formato ainda não lido: não sabemos se o vídeo é para crianças. Se for, o Studio não oferece o teste.' }
  if (e.idadeDias < IDADE_LANCAMENTO_DIAS) return { tipo: 'nativo', portao: false, motivo: 'Lançamento: o teste do YouTube vale sem exigir volume.' }
  if (e.impressoesAcimaDoPiso === null) return { tipo: 'nao_confirmado', motivo: 'Volume ainda não lido: não dá para dizer se há dado para o teste.' }
  if (e.impressoesAcimaDoPiso) return { tipo: 'nativo', portao: true, motivo: 'Vídeo longo com volume: o teste do YouTube é o caminho.' }
  return { tipo: 'sem_volume', motivo: 'Sem volume para teste. Trocar direto?' }
}
