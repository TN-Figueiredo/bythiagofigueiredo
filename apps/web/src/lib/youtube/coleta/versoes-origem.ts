// Origem de uma troca de título, thumbnail ou descrição (E18, plano seção 4.4). Pura: sem banco, sem `server-only`.
// Recebe uma abertura que NÃO é linha de base e a leitura do A/B Lab já feita; devolve a origem. Lista de motivos fechada.
// Ordens: 1/2 (sem leitura, sem vídeo), 3 e 3b (vencedor), 4 (restauro), 4b (incerto), 5 (rotação), 6 (fora do sistema).

import type { AberturaSemOrigem } from './versoes-derivar'
import type { EventoAb, OrigemGravavel } from '@/lib/youtube/observatorio/proprio-versoes/tipos'

export interface TesteAb {
  id: string
  videoId: string
  /** ab_tests.test_type */
  tipo: 'thumbnail' | 'title' | 'description' | 'combo'
  pausadoEm: string | null
  concluidoEm: string | null
  vencedorAplicadoEm: string | null
  tituloOriginal: string | null
  /** completed_reason: comparado só com a lista fechada da seção 4.4 */
  motivoConclusao: string | null
  /** winner_variant_id */
  varianteVencedora: string | null
}

export interface CicloAb {
  testId: string
  variantId: string
  iniciadoEm: string
  tituloAplicado: string | null
  thumbAplicada: boolean
}

export type LeituraAb = { ok: true; testes: readonly TesteAb[]; ciclos: readonly CicloAb[] } | { ok: false }

export interface OrigemAtribuida {
  origem: OrigemGravavel
  eventoAb: EventoAb | null
  abTestId: string | null
  abVariantId: string | null
  instante: string | null
  /** Só na ordem 4b: nao_se_sabe porque o Lab enviou imagem e as colunas não dizem qual. */
  incerta?: true
}

const SEM_EVENTO = { eventoAb: null, abTestId: null, abVariantId: null, instante: null } as const
const nao = (origem: OrigemGravavel): OrigemAtribuida => ({ origem, ...SEM_EVENTO })

/** O teste mexe no campo? (emenda 1: D-I3) */
function mexe(t: TesteAb, campo: AberturaSemOrigem['campo']): boolean {
  if (t.tipo === 'combo') return true
  return campo === 'title' ? t.tipo === 'title' : campo === 'thumb' ? t.tipo === 'thumbnail' : t.tipo === 'description'
}

export function atribuirOrigem(a: AberturaSemOrigem, ab: LeituraAb): OrigemAtribuida {
  if (a.janela === null || a.precisao === 'first') throw new Error('atribuirOrigem: linha de base não tem origem a atribuir')
  if (!ab.ok) return nao('nao_se_sabe')
  if (a.videoId === null) return nao('nao_se_sabe')

  const de = Date.parse(a.janela.de), ate = Date.parse(a.janela.ate)
  const dentro = (inst: string | null): inst is string => {
    if (inst === null) return false
    const ms = Date.parse(inst)
    return ms >= de && ms <= ate
  }
  const testes = ab.testes.filter(t => t.videoId === a.videoId)
  const ids = new Set(testes.map(t => t.id))
  const ciclos = ab.ciclos.filter(c => ids.has(c.testId))
  const maisRecente = <T>(xs: Array<{ inst: string; v: T }>): { inst: string; v: T } | null =>
    xs.reduce<{ inst: string; v: T } | null>((m, x) => (m === null || Date.parse(x.inst) > Date.parse(m.inst) ? x : m), null)
  const evento = (e: EventoAb, t: TesteAb, inst: string, variante: string | null): OrigemAtribuida =>
    ({ origem: 'ab_lab', eventoAb: e, abTestId: t.id, abVariantId: variante, instante: inst })

  // 3: vencedor aplicado na janela, em teste que mexe no campo.
  const v3 = maisRecente(testes.filter(t => mexe(t, a.campo) && dentro(t.vencedorAplicadoEm)).map(t => ({ inst: t.vencedorAplicadoEm as string, v: t })))
  if (v3) return evento('vencedor', v3.v, v3.inst, v3.v.varianteVencedora)

  // 3b: só thumbnail. Encerrar escolhendo o vencedor deixa winner_applied_at nulo.
  if (a.campo === 'thumb') {
    const v3b = maisRecente(testes
      .filter(t => (t.tipo === 'thumbnail' || t.tipo === 'combo') && t.motivoConclusao === 'manual_winner' && dentro(t.concluidoEm))
      .map(t => ({ inst: t.concluidoEm as string, v: t })))
    if (v3b) return evento('vencedor', v3b.v, v3b.inst, v3b.v.varianteVencedora)
  }

  if (a.campo === 'title') {
    // 4 (título): parada ou encerramento na janela com o título novo igual ao original.
    if (a.tituloOuNulo !== null) {
      const r = maisRecente(testes.flatMap(t => {
        if (t.tituloOriginal === null || t.tituloOriginal !== a.tituloOuNulo) return []
        return [t.pausadoEm, t.concluidoEm].filter(dentro).map(inst => ({ inst, v: t }))
      }))
      if (r) return evento('restauro', r.v, r.inst, null)
    }
  } else if (a.campo === 'thumb') {
    // 4 (thumbnail): lista de motivos fechada; sem conferência de conteúdo (desvio 15).
    const comCicloNaJanela = (t: TesteAb): boolean => ciclos.some(c => c.testId === t.id && c.thumbAplicada && dentro(c.iniciadoEm))
    const candidatos: Array<{ inst: string; v: TesteAb }> = []
    for (const t of testes) {
      if (dentro(t.pausadoEm)) candidatos.push({ inst: t.pausadoEm, v: t })
      if (dentro(t.concluidoEm)) {
        const m = t.motivoConclusao
        if (m === 'manual_archive' || ((m === 'manual_no_apply' || m === 'inconclusive') && !comCicloNaJanela(t))) candidatos.push({ inst: t.concluidoEm, v: t })
      }
    }
    const r = maisRecente(candidatos)
    if (r) return evento('restauro', r.v, r.inst, null)

    // 4b: o Lab reenviou (ou pode ter reenviado) uma imagem e as colunas não dizem qual.
    const incerto = testes.find(t => dentro(t.concluidoEm) && (
      ((t.motivoConclusao === 'manual_no_apply' || t.motivoConclusao === 'inconclusive') && comCicloNaJanela(t)) ||
      (t.motivoConclusao === 'manual_winner' && (t.tipo === 'title' || t.tipo === 'description'))))
    if (incerto) return { origem: 'nao_se_sabe', eventoAb: null, abTestId: incerto.id, abVariantId: null, instante: null, incerta: true }
  }

  // 5: rotação (a descrição não tem rotação registrada).
  if (a.campo !== 'desc') {
    const r5 = maisRecente(ciclos
      .filter(c => dentro(c.iniciadoEm) && (a.campo === 'title' ? c.tituloAplicado !== null && c.tituloAplicado === a.tituloOuNulo : c.thumbAplicada))
      .map(c => ({ inst: c.iniciadoEm, v: c })))
    if (r5) return { origem: 'ab_lab', eventoAb: 'rotacao', abTestId: r5.v.testId, abVariantId: r5.v.variantId, instante: r5.inst }
  }

  return nao('fora_do_sistema')
}
