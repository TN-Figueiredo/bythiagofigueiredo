// A5 E5a, Tarefa 14b: os pontos de um vídeo nas dez idades de M2 (CP21: a E4 não traz `curva` por vídeo, pedido P5 ausente).
// Não é conta nova: 1, 7 e 30 dias saem de `m1DoVideo`, as outras de `viewsNaIdade`, com as tolerâncias de `MEASURE_RULES` que `curvaDoCanal` usa.
import { DAY, spDateOf } from '../time'
import { MEASURE_RULES } from '../medidas/regras'
import { medido, naoMedido, type Medida, type MotivoNaoMedido } from '../medidas/tipos'
import { m1DoVideo, viewsNaIdade, type FaltaLida, type IdadeDeMarca, type Leitura, type MarcaLida } from '../medidas/m1'

export interface PontoDoVideo { idadeDias: number; ponto: Medida<number> }

const IDADES_DE_MARCA: readonly number[] = MEASURE_RULES.ages
const MOTIVO_DA_FALTA = {
  sem_vizinha_antes: 'leitura_comecou_depois',
  sem_vizinha_depois: 'leitura_parou_antes',
  distantes: 'leituras_distantes',
} as const satisfies Record<string, MotivoNaoMedido>

export function pontosDoVideo(
  video: { baseMs: number | null },
  leituras: Leitura[] | undefined,
  marcas: { marcas: Partial<Record<IdadeDeMarca, MarcaLida>>; faltas: Partial<Record<IdadeDeMarca, FaltaLida>> },
  agoraMs: number,
): PontoDoVideo[] {
  return MEASURE_RULES.curve.ages.map((idade): PontoDoVideo => {
    const base = video.baseMs
    if (base === null) return { idadeDias: idade, ponto: naoMedido('sem_publicacao') }
    if (IDADES_DE_MARCA.includes(idade)) {
      const i = idade as IdadeDeMarca
      const m = m1DoVideo({ idadeDias: i, baseMs: base, agendadoOuNoAr: false, agoraMs, marca: marcas.marcas[i] ?? null, falta: marcas.faltas[i] ?? null, leituras })
      if (m.estado === 'medido') return { idadeDias: idade, ponto: medido(m.valor.views, 1, m.janela) }
      return { idadeDias: idade, ponto: naoMedido(m.motivo, { desde: m.desde, fechaEm: m.fechaEm }) }
    }
    const alvo = base + idade * DAY
    if (agoraMs < alvo) return { idadeDias: idade, ponto: naoMedido('fecha_em', { fechaEm: spDateOf(alvo) }) }
    if (!leituras) return { idadeDias: idade, ponto: naoMedido('serie_nao_pedida') }
    const gap = idade >= MEASURE_RULES.curve.weeklyFromAge ? MEASURE_RULES.weeklyGapHours : MEASURE_RULES.maxGapHours
    const r = viewsNaIdade(leituras, base, idade, { maxGapHoras: gap })
    if (!('medido' in r)) return { idadeDias: idade, ponto: naoMedido(MOTIVO_DA_FALTA[r.falta]) }
    return { idadeDias: idade, ponto: medido(r.medido.views, 1, { de: spDateOf(base), ate: spDateOf(alvo), dias: idade }) }
  })
}
