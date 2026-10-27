/** Manutenção M5, Tarefa 7: fixtures da página do Arquivo (forma de obs_archive_pagina, m5.sql PARTE 2). Hoje do banco = 03/05/2028 12:00 (SP). */
import type { PaginaLida, LinhaMesLida } from '@/lib/youtube/observatorio/arquivo-mensal/pagina'

export const AGORA = Date.parse('2028-05-03T15:00:00Z')
const H = 3_600_000, D = 24 * H
const iso = (ms: number): string => new Date(ms).toISOString()
const dias = (n: number): string => iso(AGORA - n * D)
const horas = (n: number): string => iso(AGORA - n * H)
const dia = (ms: number): string => iso(ms).slice(0, 10)

type Progresso = PaginaLida['progresso'][number]
type Recuperacao = PaginaLida['recuperacao'][number]
export interface MesSemeado { linha: LinhaMesLida; progresso?: Progresso; recuperacao?: Recuperacao[] }

export interface OpcoesMes {
  mes?: 'corrente' | 'fechado_ha'; dias?: number; mesNum?: number; classe?: 'horaria' | 'serie' | 'texto'; semLinha?: boolean
  devidoHa?: number; esperadas?: number; recebidas?: number
  nasHorasAtras?: number; b2Forja?: number; b2Dono?: number; b2Tentativa?: string; b2Divergiu?: boolean
  conteudoDivergente?: boolean; unsealed?: string; recuperacaoHa?: number; fpMudou?: boolean; vazioConferido?: boolean
  destacadoHa?: number; descartadoHa?: number
}
const TABELAS: Record<string, string[]> = { horaria: ['competitor_video_hourly'], serie: ['competitor_video_daily', 'competitor_video_early'], texto: ['competitor_video_comments', 'competitor_video_comment_marks', 'competitor_raw'] }

/** Um mês (uma linha da grade) coerente com o que o SQL devolve. Sem opções: o mês fechado mais recente, copiado, selado e verificado há 3 h. */
export function mesCom(o: OpcoesMes = {}): MesSemeado {
  const classe = o.classe ?? 'serie'
  const tabela = TABELAS[classe]![0]!
  const corrente = o.mes === 'corrente'
  const month = corrente ? '2028-05-01' : `2027-${String(9 + (o.mesNum ?? 1)).padStart(2, '0')}-01`
  const devidoMs = o.devidoHa != null ? AGORA - o.devidoHa * D : o.mes === 'fechado_ha' ? AGORA + (28 - (o.dias ?? 10)) * D : AGORA - 5 * D
  const emCopia = o.devidoHa != null && o.esperadas != null
  const selado = !corrente && o.mes !== 'fechado_ha' && !emCopia
  const comNas = selado || (emCopia && (o.recebidas ?? 0) > 0 && o.nasHorasAtras != null)
  const b2Forja = o.b2Forja ?? (o.recuperacaoHa != null ? 1 : undefined)
  const comB2 = b2Forja != null || o.b2Dono != null || o.b2Tentativa != null || o.b2Divergiu === true
  const destacado = o.destacadoHa ?? o.descartadoHa
  const linha: LinhaMesLida = {
    class: classe, table_name: tabela, month, devido_em: dia(devidoMs),
    tem_linha: !o.semLinha && (selado || (o.recebidas ?? 0) > 0),
    sealed_at: selado || o.vazioConferido ? horas(5 * 24) : null, sealed_kind: o.vazioConferido ? 'vazio_conferido' : selado ? 'com_dado' : null,
    unsealed_at: o.unsealed ? horas(2) : null, unsealed_reason: o.unsealed ?? null,
    nas_attested_at: comNas ? horas(o.nasHorasAtras ?? 3) : null, manifest_nas_withdrawn_at: o.conteudoDivergente ? horas(1) : null,
    b2_attested_at: comB2 ? dias(Math.min(b2Forja ?? 99, o.b2Dono ?? 99)) : null, b2_attested_via: comB2 ? 'forja' : null,
    b2_forja_ok_at: b2Forja != null ? dias(b2Forja) : null, b2_dono_ok_at: o.b2Dono != null ? dias(o.b2Dono) : null,
    b2_forja_diverged_at: o.b2Divergiu ? horas(1) : null, b2_withdrawn_at: null, b2_withdrawn_reason: null,
    b2_last_attempt_at: o.b2Tentativa ? dias(1) : null, b2_last_attempt_result: o.b2Tentativa ?? null,
    detached_at: destacado != null ? dias(destacado) : null, dropped_at: o.descartadoHa != null ? dias(o.descartadoHa) : null, closed_at: null,
    rows_total: null, units_total: null, units_empty: null, days_measured: null, days_in_month: null, rows_dropped: null, bytes_freed: null,
    reattach_out_of_order: false,
    b2: {
      atestada_em: comB2 ? dias(Math.min(b2Forja ?? 99, o.b2Dono ?? 99)) : null, via: comB2 ? 'forja' : null,
      forja_ok_at: b2Forja != null ? dias(b2Forja) : null, dono_ok_at: o.b2Dono != null ? dias(o.b2Dono) : null, forja_divergiu_em: o.b2Divergiu ? horas(1) : null,
      retirada: null, ultima_tentativa: { em: o.b2Tentativa ? dias(1) : null, resultado: o.b2Tentativa ?? null, via: o.b2Tentativa ? 'forja' : null },
      idade_dias: null,
    },
  }
  const progresso: Progresso | undefined = selado || corrente || o.mes === 'fechado_ha' ? undefined
    : { class: classe, month, canais_esperados: o.esperadas ?? 0, canais_prontos: o.recebidas ?? 0, canais_perdidos: 0 }
  const recuperacao = o.recuperacaoHa != null
    ? TABELAS[classe]!.map(t => ({ class: classe, table_name: t, done_at: dias(o.recuperacaoHa!), schema_fp: 'a'.repeat(8), schema_fp_atual: o.fpMudou ? 'b'.repeat(8) : 'a'.repeat(8), diff_rows: 0 }))
    : undefined
  return { linha, ...(progresso ? { progresso } : {}), ...(recuperacao ? { recuperacao } : {}) }
}

const batimento = (worker: string): PaginaLida['casa'][number] => ({
  worker, last_poll_at: horas(1), updated_at: horas(1), version: '1', machine_time: null, stopped_at_cap: null, nas_ok: true, nas_checked_at: horas(1),
  last_error: null, livre_bytes: null, total_bytes: null, sentinel_ok: true, mounts_ok: true,
})

/** A página de um site com a casa em dia e nenhum mês. `over.meses` aceita `mesCom(...)` e junta linhas, progressos e recuperações; o resto substitui a chave. */
export function paginaVazia(over: Record<string, unknown> = {}): PaginaLida {
  const { meses, ...resto } = over as { meses?: MesSemeado[] } & Record<string, unknown>
  const recDefault: Recuperacao[] = Object.entries(TABELAS).flatMap(([c, ts]) => ts.map(t => ({ class: c as Recuperacao['class'], table_name: t, done_at: null, schema_fp: null, schema_fp_atual: 'f'.repeat(8), diff_rows: null })))
  const recSemeada = (meses ?? []).flatMap(m => m.recuperacao ?? [])
  const recuperacao = recDefault.map(r => recSemeada.find(s => s.table_name === r.table_name) ?? r)
  const base = {
    versao: 1 as const, lido_em: iso(AGORA), hoje: '2028-05-03',
    casa: ['copiador', 'respondedor', 'conferir_b2'].map(batimento),
    classes: (['horaria', 'serie', 'texto'] as const).map(c => ({ class: c, first_month: '2026-10-01', released: true, window_months: c === 'horaria' ? 3 : 6, seal_margin_days: c === 'texto' ? 45 : 28, wait_days: 7 })),
    online_since: [], meses: (meses ?? []).map(m => m.linha), progresso: (meses ?? []).flatMap(m => (m.progresso ? [m.progresso] : [])), recuperacao,
    meses_a_frente: ['competitor_video_hourly', 'competitor_video_daily', 'competitor_video_early'].map(t => ({ table_name: t, months_ahead: 12, last_month: '2029-05-01', converted_at: '2028-01-01T00:00:00Z' })),
    teste: { aberto: false, meses: [], encerrado_em: null }, vermelhos: [] as string[],
    atraso: { amarelos: 0, vermelhos: 0, mais_antiga: null, meses_sem_selo: 0 }, teto_b2: 'verde' as const,
  }
  return { ...base, ...resto } as PaginaLida
}
