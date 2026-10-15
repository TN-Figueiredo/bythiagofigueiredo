// Origem de uma troca de título, thumbnail ou descrição (E18, plano seção 4.4). Pura: sem banco, sem `server-only`.
// Recebe uma abertura que NÃO é linha de base e a leitura do A/B Lab já feita; devolve a origem. Lista de motivos fechada.
// Ordens: 1/2 (sem leitura, sem vídeo), 3 e 3b (vencedor), 4 (restauro), 4b (incerto), 5 (rotação), 6 (fora do sistema).

import type { AberturaSemOrigem } from './versoes-derivar'
import type { CompletedReason } from '@/lib/youtube/ab-types'
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
  /** completed_reason: comparado só com a lista fechada da seção 4.4 (switch exaustivo: valor novo quebra o tsc; portão 14/10, Yannis) */
  motivoConclusao: CompletedReason | null
  /** winner_variant_id */
  varianteVencedora: string | null
  /** Mundo novo (emenda 15/10): `restore_status` não nulo. Ausente = falso (mundo antigo). Também é novo o teste com linha no histórico. */
  mundoNovo?: boolean
  /** Campos em `em_andamento` no `restore_status` corrente: só o instante `em` (nunca `erro` nem `motivo`). */
  emAndamento?: { title?: string; thumb?: string }
}

/** Uma linha de `ab_test_restores` (resultado final de uma reivindicação do Lab), só as colunas que a origem usa. */
export interface RestauroAb {
  testId: string
  seq: number
  campo: 'title' | 'thumb'
  /** 'original' ou o uuid de uma variante */
  destino: string
  estado: 'ok' | 'falhou' | 'pulado_sem_original' | 'pulado_drift' | 'desistiu'
  /** nulo = não se sabe se escreveu */
  escreveu: boolean | null
  em: string
}

export interface CicloAb {
  testId: string
  variantId: string
  iniciadoEm: string
  tituloAplicado: string | null
  thumbAplicada: boolean
}

export type LeituraAb = { ok: true; testes: readonly TesteAb[]; ciclos: readonly CicloAb[]; restauros?: readonly RestauroAb[] } | { ok: false }

export interface OrigemAtribuida {
  origem: OrigemGravavel
  eventoAb: EventoAb | null
  abTestId: string | null
  abVariantId: string | null
  instante: string | null
  /** Só na ordem 4b: nao_se_sabe porque o Lab enviou imagem e as colunas não dizem qual. */
  incerta?: true
  /** Só na R6: parada de teste do mundo novo sem registro no histórico (vermelho). */
  semRegistro?: true
}

/**
 * Instante em que a P3 (commit 3f1bc2482, "sai a descrição": nenhum escritor do Lab envia descrição diferente da que está
 * no ar) chegou a main: data do commit de merge 55ea62df6 em origin/main (`git show -s --format=%cI 55ea62df6`).
 * Depois dele, `winner_applied_at` não prova troca de descrição (emenda 15/10, E.2).
 */
export const P3_PROMOVIDA_EM = '2026-10-15T04:02:28-03:00'

/** Folga entre o `em` da reivindicação (início do settleOnAir) e `paused_at`/`completed_at` (now() do banco), emenda 15/10 R6. */
export const FOLGA_REGISTRO_MS = 120_000

const SEM_EVENTO = { eventoAb: null, abTestId: null, abVariantId: null, instante: null } as const
const nao = (origem: OrigemGravavel): OrigemAtribuida => ({ origem, ...SEM_EVENTO })

/** O teste mexe no campo? (emenda 1: D-I3) */
function mexe(t: TesteAb, campo: AberturaSemOrigem['campo']): boolean {
  if (t.tipo === 'combo') return true
  return campo === 'title' ? t.tipo === 'title' : campo === 'thumb' ? t.tipo === 'thumbnail' : t.tipo === 'description'
}

type PapelNaThumb = 'restauro' | 'incerto' | 'nada'

/**
 * O que o encerramento de um teste diz sobre a thumbnail (seção 4.4). Switch exaustivo: um `CompletedReason` novo não compila
 * até alguém decidir o papel dele. `inconclusive` só reenvia imagem em teste de thumbnail ou combo (P2; portão 14/10, Phil I-2).
 * `manual_no_apply` reenvia a original por `original_thumbnail_url`, que só testes de imagem têm; sem restrição de tipo.
 * Limite aceito: o "teve ciclo alguma vez" não vem filtrado da janela; teste de thumbnail sem ciclo nenhum é raro.
 */
function papelNaThumb(t: TesteAb, comCicloNaJanela: boolean): PapelNaThumb {
  const m = t.motivoConclusao
  if (m === null) return 'nada'
  switch (m) {
    case 'manual_archive': return 'restauro'
    case 'manual_no_apply': return comCicloNaJanela ? 'incerto' : 'restauro'
    case 'inconclusive':
      if (t.tipo !== 'thumbnail' && t.tipo !== 'combo') return 'nada'
      return comCicloNaJanela ? 'incerto' : 'restauro'
    case 'manual_winner': return t.tipo === 'title' || t.tipo === 'description' ? 'incerto' : 'nada' // thumbnail e combo: ordem 3b
    case 'auto_resolve':
    case 'manual_apply':
    case 'max_duration': return 'nada'
    default: { const _fechado: never = m; return _fechado }
  }
}

type CandidatoR =
  | { kind: 'linha'; ms: number; teste: TesteAb; linha: RestauroAb }
  | { kind: 'andamento'; ms: number; teste: TesteAb }
  | { kind: 'ciclo'; ms: number; ciclo: CicloAb }

/** Bloco R (emenda 15/10, E.3): origem a partir do histórico. Devolve null quando nada vale e a R6 não dispara. */
function blocoR(
  a: AberturaSemOrigem, novos: readonly TesteAb[], ciclos: readonly CicloAb[], restauros: readonly RestauroAb[], de: number, ate: number,
): OrigemAtribuida | null {
  const campo = a.campo === 'title' ? 'title' : 'thumb'
  const naJanela = (ms: number): boolean => ms >= de && ms <= ate
  const tituloNovo = a.tituloOuNulo?.trim() ?? null
  const porId = new Map(novos.map(t => [t.id, t]))
  const cands: CandidatoR[] = []
  for (const l of restauros) {
    const t = porId.get(l.testId)
    if (!t || l.campo !== campo || l.escreveu === false) continue
    const ms = Date.parse(l.em)
    if (!naJanela(ms)) continue
    // R2 do título: o título novo tem de bater com o original; se não bate, o candidato sai e a escolha recomeça.
    if (campo === 'title' && l.estado === 'ok' && l.escreveu === true && l.destino === 'original'
      && (t.tituloOriginal === null || tituloNovo === null || t.tituloOriginal.trim() !== tituloNovo)) continue
    cands.push({ kind: 'linha', ms, teste: t, linha: l })
  }
  for (const t of novos) {
    const em = t.emAndamento?.[campo]
    if (em === undefined) continue
    const ms = Date.parse(em)
    if (naJanela(ms)) cands.push({ kind: 'andamento', ms, teste: t })
  }
  // Ciclos que hoje passariam na ordem 5 (de qualquer teste do vídeo).
  for (const c of ciclos) {
    const ms = Date.parse(c.iniciadoEm)
    if (!naJanela(ms)) continue
    const bate = campo === 'title' ? c.tituloAplicado !== null && a.tituloOuNulo !== null && c.tituloAplicado.trim() === a.tituloOuNulo.trim() : c.thumbAplicada
    if (bate) cands.push({ kind: 'ciclo', ms, ciclo: c })
  }
  const rank = { linha: 0, andamento: 1, ciclo: 2 } as const
  const idDe = (c: CandidatoR): string => (c.kind === 'ciclo' ? c.ciclo.testId : c.teste.id)
  cands.sort((x, y) => {
    if (x.ms !== y.ms) return y.ms - x.ms // mais recente primeiro
    if (rank[x.kind] !== rank[y.kind]) return rank[x.kind] - rank[y.kind] // linha vence em_andamento e ciclo
    if (x.kind === 'linha' && y.kind === 'linha' && x.linha.testId === y.linha.testId && x.linha.seq !== y.linha.seq) return y.linha.seq - x.linha.seq
    return idDe(x) < idDe(y) ? -1 : idDe(x) > idDe(y) ? 1 : 0 // entre testes diferentes, id lexicográfico
  })
  const v = cands[0]
  if (v) {
    const incerta = (t: TesteAb): OrigemAtribuida => ({ origem: 'nao_se_sabe', eventoAb: null, abTestId: t.id, abVariantId: null, instante: null, incerta: true })
    if (v.kind === 'ciclo') return { origem: 'ab_lab', eventoAb: 'rotacao', abTestId: v.ciclo.testId, abVariantId: v.ciclo.variantId, instante: v.ciclo.iniciadoEm }
    if (v.kind === 'andamento') return incerta(v.teste) // R4
    const l = v.linha
    if (l.escreveu === null || l.estado !== 'ok') return incerta(v.teste) // R4: nulo ou contraditória (escreveu = true com estado != ok)
    if (l.destino === 'original') return { origem: 'ab_lab', eventoAb: 'restauro', abTestId: v.teste.id, abVariantId: null, instante: l.em } // R2
    return { origem: 'ab_lab', eventoAb: 'vencedor', abTestId: v.teste.id, abVariantId: l.destino, instante: l.em } // R3
  }

  // R6: parada na janela sem registro no histórico (nem em_andamento) em [parada - 120 s, ate].
  for (const t of novos) {
    const paradas = [t.pausadoEm, t.concluidoEm, t.vencedorAplicadoEm].filter((x): x is string => x !== null).map(x => Date.parse(x)).filter(naJanela)
    const emAnd = t.emAndamento?.[campo]
    for (const p of paradas) {
      const lo = p - FOLGA_REGISTRO_MS
      const entre = (ms: number): boolean => ms >= lo && ms <= ate
      const temLinha = restauros.some(l => l.testId === t.id && l.campo === campo && entre(Date.parse(l.em)))
      const temAndamento = emAnd !== undefined && entre(Date.parse(emAnd))
      if (!temLinha && !temAndamento) return { origem: 'nao_se_sabe', eventoAb: null, abTestId: t.id, abVariantId: null, instante: null, semRegistro: true }
    }
  }
  return null
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

  // Mundo novo (emenda 15/10): `restore_status` não nulo ou ao menos uma linha no histórico.
  const restauros = ab.restauros ?? []
  const comLinha = new Set(restauros.map(r => r.testId))
  const ehNovo = (t: TesteAb): boolean => t.mundoNovo === true || comLinha.has(t.id)
  const novos = a.campo === 'desc' ? [] : testes.filter(t => ehNovo(t) && mexe(t, a.campo))
  // Nos campos title e thumb, as ordens 3, 3b, 4 e 4b só leem testes do mundo antigo; a descrição lê todos (ver ordem 3).
  const antigos = a.campo === 'desc' ? testes : testes.filter(t => !ehNovo(t))

  if (novos.length > 0) {
    const r = blocoR(a, novos, ciclos, restauros, de, ate)
    if (r) return r
  }

  // 3: vencedor aplicado na janela, em teste que mexe no campo. Na descrição só vale antes da promoção da P3 (o Lab não a escreve mais).
  const p3 = Date.parse(P3_PROMOVIDA_EM)
  const v3 = maisRecente(antigos
    .filter(t => mexe(t, a.campo) && dentro(t.vencedorAplicadoEm) && (a.campo !== 'desc' || Date.parse(t.vencedorAplicadoEm as string) < p3))
    .map(t => ({ inst: t.vencedorAplicadoEm as string, v: t })))
  if (v3) return evento('vencedor', v3.v, v3.inst, v3.v.varianteVencedora)

  // 3b: só thumbnail. Encerrar escolhendo o vencedor deixa winner_applied_at nulo.
  if (a.campo === 'thumb') {
    const v3b = maisRecente(antigos
      .filter(t => (t.tipo === 'thumbnail' || t.tipo === 'combo') && t.motivoConclusao === 'manual_winner' && dentro(t.concluidoEm))
      .map(t => ({ inst: t.concluidoEm as string, v: t })))
    if (v3b) return evento('vencedor', v3b.v, v3b.inst, v3b.v.varianteVencedora)
  }

  if (a.campo === 'title') {
    // 4 (título): parada ou encerramento na janela com o título novo igual ao original.
    const tituloNovo = a.tituloOuNulo?.trim() ?? null
    if (tituloNovo !== null) {
      const r = maisRecente(antigos.flatMap(t => {
        if (t.tituloOriginal === null || t.tituloOriginal.trim() !== tituloNovo) return []
        return [t.pausadoEm, t.concluidoEm].filter(dentro).map(inst => ({ inst, v: t }))
      }))
      if (r) return evento('restauro', r.v, r.inst, null)
    }
  } else if (a.campo === 'thumb') {
    // 4 (thumbnail): lista de motivos fechada; sem conferência de conteúdo (desvio 15).
    const comCicloNaJanela = (t: TesteAb): boolean => ciclos.some(c => c.testId === t.id && c.thumbAplicada && dentro(c.iniciadoEm))
    const candidatos: Array<{ inst: string; v: TesteAb }> = []
    for (const t of antigos) {
      if (dentro(t.pausadoEm)) candidatos.push({ inst: t.pausadoEm, v: t })
      if (dentro(t.concluidoEm) && papelNaThumb(t, comCicloNaJanela(t)) === 'restauro') candidatos.push({ inst: t.concluidoEm, v: t })
    }
    const r = maisRecente(candidatos)
    if (r) return evento('restauro', r.v, r.inst, null)

    // 4b: o Lab reenviou (ou pode ter reenviado) uma imagem e as colunas não dizem qual.
    const incerto = maisRecente(antigos
      .filter(t => dentro(t.concluidoEm) && papelNaThumb(t, comCicloNaJanela(t)) === 'incerto')
      .map(t => ({ inst: t.concluidoEm as string, v: t }))) // portão 14/10, Phil m-5: o mais recente, não o primeiro da leitura
    if (incerto) return { origem: 'nao_se_sabe', eventoAb: null, abTestId: incerto.v.id, abVariantId: null, instante: null, incerta: true }
  }

  // 5: rotação (a descrição não tem rotação registrada).
  if (a.campo !== 'desc') {
    const r5 = maisRecente(ciclos
      .filter(c => dentro(c.iniciadoEm) && (a.campo === 'title' ? c.tituloAplicado !== null && a.tituloOuNulo !== null && c.tituloAplicado.trim() === a.tituloOuNulo.trim() : c.thumbAplicada))
      .map(c => ({ inst: c.iniciadoEm, v: c })))
    if (r5) return { origem: 'ab_lab', eventoAb: 'rotacao', abTestId: r5.v.testId, abVariantId: r5.v.variantId, instante: r5.inst }
  }

  return nao('fora_do_sistema')
}
