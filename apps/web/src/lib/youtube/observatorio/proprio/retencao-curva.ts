// Modelo puro da curva de retenção do vídeo próprio (A5 E8, Tarefa 12a): sem banco, sem rede, sem React.
// Recebe os pontos que a coleta gravou e devolve o que a tela desenha. As regras de "metade" e de "maiores saídas"
// são as do mockup 6 (`video.js`, `curvaInfo`). A tela não inventa curva: não interpola, não preenche, não converte
// ausência em zero; ponto de forma ruim é erro (o leitor descarta a curva inteira antes de chegar aqui).

export interface PontoCurva {
  /** Fração decorrida do vídeo, de 0 a 1. */
  t: number
  /** Não é cortado: passa de 1 quando há replays. */
  ratio: number
  /** Desempenho relativo ao de vídeos de duração parecida; `null` = a API não mediu (nunca zero). */
  relative: number | null
}

export interface LeituraDaCurva {
  /** Quantos pontos a curva tem. */
  pontos: number
  /** 100 pontos. */
  completa: boolean
  /** `t` do primeiro ponto com `ratio < 0,5`; `null` = nenhum dos pontos que temos cruza. */
  meio: number | null
  /** No máximo 2, em ordem de posição. */
  saidas: Array<{ de: number; ate: number; ratioDe: number; ratioAte: number }>
  /** No máximo 3, em ordem de posição. */
  revistos: Array<{ de: number; ate: number }>
  /** Maior `ratio` (pode passar de 1). */
  pico: number
  relativa: 'acima' | 'na-media' | 'abaixo' | null
}

const PONTOS_COMPLETA = 100
/** A queda de cada saída é medida entre um ponto e o 5.º seguinte (como no mockup). */
const SALTO_SAIDA = 5
/** Duas saídas precisam distar MAIS de 12 pontos. */
const DISTANCIA_MIN_SAIDAS = 12
const MAX_SAIDAS = 2
/** Menos de 13 pontos: sem saídas. */
const MIN_PONTOS_SAIDAS = DISTANCIA_MIN_SAIDAS + 1
const MAX_REVISTOS = 3
/** Subida total mínima de uma sequência para contar como trecho revisto. */
const SUBIDA_MIN_REVISTO = 0.02
const LIMITE_ACIMA = 0.55
const LIMITE_ABAIXO = 0.45
/** Folga para a soma de decimais em ponto flutuante não decidir um limite. */
const EPS = 1e-9

function validar(pontos: readonly PontoCurva[]): void {
  let anterior = -Infinity
  for (const p of pontos) {
    if (typeof p.t !== 'number' || !Number.isFinite(p.t) || p.t < 0 || p.t > 1) {
      throw new Error('curva de retenção: ponto com t inválido')
    }
    if (typeof p.ratio !== 'number' || !Number.isFinite(p.ratio) || p.ratio < 0) {
      throw new Error('curva de retenção: ponto com ratio inválido')
    }
    if (p.relative !== null && (typeof p.relative !== 'number' || !Number.isFinite(p.relative))) {
      throw new Error('curva de retenção: ponto com relative inválido')
    }
    if (p.t <= anterior) throw new Error('curva de retenção: pontos fora de ordem ou repetidos')
    anterior = p.t
  }
}

function acharSaidas(pontos: readonly PontoCurva[]): LeituraDaCurva['saidas'] {
  const n = pontos.length
  if (n < MIN_PONTOS_SAIDAS) return []
  const quedas: Array<{ i: number; queda: number }> = []
  for (let i = 0; i + SALTO_SAIDA < n; i++) {
    quedas.push({ i, queda: pontos[i]!.ratio - pontos[i + SALTO_SAIDA]!.ratio })
  }
  // maior queda primeiro; empate fica na ordem de posição (sort estável)
  quedas.sort((a, b) => b.queda - a.queda)
  const escolhidas: Array<{ i: number; queda: number }> = []
  for (const q of quedas) {
    if (escolhidas.length >= MAX_SAIDAS) break
    if (!(q.queda > 0)) break
    if (escolhidas.every((e) => Math.abs(e.i - q.i) > DISTANCIA_MIN_SAIDAS)) escolhidas.push(q)
  }
  return escolhidas
    .sort((a, b) => a.i - b.i)
    .map(({ i }) => ({
      de: pontos[i]!.t,
      ate: pontos[i + SALTO_SAIDA]!.t,
      ratioDe: pontos[i]!.ratio,
      ratioAte: pontos[i + SALTO_SAIDA]!.ratio,
    }))
}

function acharRevistos(pontos: readonly PontoCurva[]): LeituraDaCurva['revistos'] {
  const trechos: Array<{ ini: number; fim: number; subida: number }> = []
  let ini = -1
  const fechar = (fim: number): void => {
    if (ini < 0) return
    const subida = pontos[fim]!.ratio - pontos[ini]!.ratio
    if (subida >= SUBIDA_MIN_REVISTO - EPS) trechos.push({ ini, fim, subida })
    ini = -1
  }
  for (let k = 0; k + 1 < pontos.length; k++) {
    if (pontos[k + 1]!.ratio > pontos[k]!.ratio) {
      if (ini < 0) ini = k
    } else {
      fechar(k)
    }
  }
  fechar(pontos.length - 1)
  return trechos
    .sort((a, b) => b.subida - a.subida)
    .slice(0, MAX_REVISTOS)
    .sort((a, b) => a.ini - b.ini)
    .map((t) => ({ de: pontos[t.ini]!.t, ate: pontos[t.fim]!.t }))
}

function lerRelativa(pontos: readonly PontoCurva[]): LeituraDaCurva['relativa'] {
  const valores: number[] = []
  for (const p of pontos) if (p.relative !== null) valores.push(p.relative)
  // menos da metade dos pontos com o campo: não dá para dizer (e nulo nunca entra como zero)
  if (valores.length === 0 || valores.length * 2 < pontos.length) return null
  valores.sort((a, b) => a - b)
  const m = valores.length >> 1
  const mediana = valores.length % 2 === 1 ? valores[m]! : (valores[m - 1]! + valores[m]!) / 2
  if (mediana > LIMITE_ACIMA + EPS) return 'acima'
  if (mediana < LIMITE_ABAIXO - EPS) return 'abaixo'
  return 'na-media'
}

/** `null` com lista vazia. Lança com pontos fora de ordem, repetidos ou de forma ruim (o leitor entrega ordenado e validado). */
export function lerCurva(pontos: readonly PontoCurva[]): LeituraDaCurva | null {
  if (pontos.length === 0) return null
  validar(pontos)
  let meio: number | null = null
  let pico = -Infinity
  for (const p of pontos) {
    if (meio === null && p.ratio < 0.5) meio = p.t
    if (p.ratio > pico) pico = p.ratio
  }
  return {
    pontos: pontos.length,
    completa: pontos.length === PONTOS_COMPLETA,
    meio,
    saidas: acharSaidas(pontos),
    revistos: acharRevistos(pontos),
    pico,
    relativa: lerRelativa(pontos),
  }
}
