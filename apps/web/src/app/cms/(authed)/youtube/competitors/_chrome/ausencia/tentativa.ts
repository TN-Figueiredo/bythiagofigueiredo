/** Núcleo puro do "Tentar de novo" (decisão 75): as fases e as transições, provadas em node. */
export type Fase = 'parado' | 'tentando' | 'falhou_de_novo' | 'lido'
export type Evento = 'clicou' | 'terminou_falhou' | 'terminou_lido'

export function proximaFase(fase: Fase, evento: Evento): Fase {
  switch (fase) {
    case 'parado':
    case 'falhou_de_novo':
    case 'lido':
      return evento === 'clicou' ? 'tentando' : fase
    case 'tentando':
      if (evento === 'terminou_falhou') return 'falhou_de_novo'
      if (evento === 'terminou_lido') return 'lido'
      return 'tentando'
    default: {
      const nunca: never = fase
      return nunca
    }
  }
}
