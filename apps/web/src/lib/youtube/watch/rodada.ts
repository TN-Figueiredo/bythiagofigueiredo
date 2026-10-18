export const RODADA = {
  leiturasPorRodada: 3, sorteioMin: 20, faixaMin: 20, kMax: 16, segundosPorVideo: 1.2, segundosFixos: 3,
  comecaAteS: 70, orcamentoS: 30, bancoAteS: 83, concorrencia: 3, extensaoMaxVideos: 4, inicioLeveP90S: 10,
} as const

// 177 videos de canais acompanhados x 4 rodadas/dia + ~35 proprios antigos x 1 rodada/dia (D2).
export const DEMANDA_RODADAS_DIA: number = 177 * 4 + 35 * 1

const MIN_MS = 60_000
const DIA_MS = 86_400_000

export function periodoMin(rodadasPorDia: 1 | 4): number {
  return 1440 / rodadasPorDia
}

export function proximaRodada(agoraMs: number, horaBaseMin: number, rodadasPorDia: 1 | 4, rng: () => number): number {
  const periodo = periodoMin(rodadasPorDia)
  const base = ((horaBaseMin % periodo) + periodo) % periodo
  const limite = agoraMs + (periodo / 2) * MIN_MS
  const meiaNoite = Math.floor(agoraMs / DIA_MS) * DIA_MS
  // k parte de -1 para cobrir a rodada do dia anterior; o primeiro candidato > limite vence.
  for (let k = -1; k < 2 * rodadasPorDia + 2; k++) {
    const cand = meiaNoite + (base + k * periodo) * MIN_MS
    if (cand > limite) {
      const jitter = (rng() * 2 - 1) * RODADA.sorteioMin * MIN_MS
      return Math.round(cand + jitter)
    }
  }
  return Math.round(limite)
}

function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function faixaMenosCheia(horasBaseAtivas: readonly number[], idParaDeslocamento: string): number {
  const faixas = 360 / RODADA.faixaMin
  const cont = new Array<number>(faixas).fill(0)
  for (const h of horasBaseAtivas) {
    const m = ((h % 360) + 360) % 360
    cont[Math.floor(m / RODADA.faixaMin)]!++
  }
  let melhor = 0
  for (let i = 1; i < faixas; i++) if (cont[i]! < cont[melhor]!) melhor = i
  return melhor * RODADA.faixaMin + (hash32(idParaDeslocamento) % RODADA.faixaMin)
}

export function kAgora(decorridoMs: number, devidos: number, segundosPorVideo: number = RODADA.segundosPorVideo): number {
  const d = decorridoMs / 1000
  const janela = Math.min(RODADA.comecaAteS - d, RODADA.orcamentoS)
  const cabem = Math.floor((janela - RODADA.segundosFixos) / segundosPorVideo + 1e-9)
  return Math.max(0, Math.min(RODADA.kMax, devidos, cabem))
}

export function estenderColeta(
  a: { coletaAte: string; extensoesCurtas: number },
  v: { provavel: boolean; rodadasMistasTitulo: number; ultimaVista: string | null },
  agoraMs: number,
): { coletaAte: string; motivoAte: 'extensao' | 'extensao_curta'; extensoesCurtas: number; reterAte: string | null } | null {
  const atual = Date.parse(a.coletaAte)
  if (v.provavel && v.ultimaVista) {
    const uv = Date.parse(v.ultimaVista)
    return {
      coletaAte: new Date(Math.max(atual, uv + 30 * DIA_MS)).toISOString(),
      motivoAte: 'extensao',
      extensoesCurtas: a.extensoesCurtas,
      reterAte: new Date(uv + 180 * DIA_MS).toISOString(),
    }
  }
  if (!v.provavel && v.rodadasMistasTitulo >= 1 && a.extensoesCurtas < 2 && atual - agoraMs < 48 * 3_600_000) {
    return {
      coletaAte: new Date(atual + 3 * DIA_MS).toISOString(),
      motivoAte: 'extensao_curta',
      extensoesCurtas: a.extensoesCurtas + 1,
      reterAte: null,
    }
  }
  return null
}
