// Passo da decisão v2 no fim do cron ab-retrato (S8-F4 T9): congela o N, avalia os testes v2 ativos, encerra pelo
// settle e mantém o desfecho dos concluídos até ficar final. Toda escrita em `result_metadata.v2` é pela RPC
// `ab_test_v2_gravar`. Falha de settle/leitura vira UMA chamada a recordCronFailure no fim (uma por dia, não por teste).
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordCronFailure } from '@/lib/cron-health'
import { encerrarComPrazo } from '@/lib/youtube/ab-evaluate-phases'
import { lerResultadoV2, type DesfechoV2, type ResultadoV2 } from '../ab-types'
import { dayPt, diffDias } from '../coleta/day-pt'
import { lerPaginado } from '../coleta/paginar'
import type { AbTest } from '../coleta/ab-seconds'
import {
  K_POR_V, V_MAXIMO_V2, baseDoVideo, blocoDoDia, cicloDoDia, decidirV2, desfechoProvisorio, encerradoEmDia, estatisticaV2,
  pisos, relogioV2, tetoDoTesteV2, volumeMinimo, type CicloComNumero, type DiaDaDecisao, type EstatisticaV2,
} from './decisao-v2'
import { lerDiasDosTestes } from './placar-leitura'
import type { EntradasParaDecisao } from './retrato-step'

const JOB = 'ab-retrato'
const CRON_MESSAGE_MAX = 480
const DIAS_JANELA_CONCLUIDOS = 20
const DIAS_PARA_FINAL = 12
const DIA_MS = 86_400_000
const LOTE = 100
const MARGEM_REDE_MS = 10 * 60_000
const P1_SEM_LEITURA = 0.04

export type ResultadoDecisao =
  | { status: 'ok'; avaliados: number; encerrados: number; desfechos: number; notas: string[]; duracao_ms: number }
  | { status: 'error'; error: string; health_written: true }

interface LinhaTeste {
  id: string; regra_duracao?: string; site_id: string; status: string; completed_reason: string | null; paused_at: string | null; completed_at: string | null
  original_title: string | null; started_at: string | null; result_metadata: unknown; config: unknown
  youtube_videos: { youtube_video_id: string; channel_id: string } | Array<{ youtube_video_id: string; channel_id: string }>
}

const SELECT_TESTE = 'id, regra_duracao, site_id, status, completed_reason, paused_at, completed_at, original_title, started_at, result_metadata, config, youtube_videos!inner(youtube_video_id, channel_id)'

const CicloSchema = z.object({
  id: z.string(), test_id: z.string(), variant_id: z.string(), started_at: z.string(), ended_at: z.string().nullable(), cycle_number: z.number().int(),
  applied_metadata: z.object({ title_set: z.string().nullish() }).passthrough().nullable().default(null),
}).passthrough()

function v2Cru(rm: unknown): Record<string, unknown> {
  const v = rm && typeof rm === 'object' ? (rm as { v2?: unknown }).v2 : null
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

/** Ativos v2 mais concluídos/arquivados com `encerrado_em_dia` e provisório (ou concluídos pela regra sem a gravação). Filtro em TS (Yannis N-5). */
export function selecionarParaDecisao(linhas: readonly LinhaTeste[]): LinhaTeste[] {
  return linhas.filter((t) => {
    if (t.regra_duracao !== undefined && t.regra_duracao !== 'v2') return false // terceira guarda (a consulta já filtra)
    if (t.status === 'active') return true
    if (t.status !== 'completed' && t.status !== 'archived') return false
    const v = v2Cru(t.result_metadata)
    const enc = v.encerrado_em_dia
    if (typeof enc === 'string' && enc !== '') return v.provisorio === undefined || v.provisorio === null || v.provisorio === true
    return t.completed_reason === 'regra_v2' && v.desfecho === undefined
  })
}

/** Nota para recordCronFailure: itens inteiros até 480 caracteres, fechando com "e mais N"; sem texto cru do banco. */
export function notaDeFalhaDecisao(falhas: readonly string[]): string {
  const n = falhas.length
  let acc = ''
  let usados = 0
  for (let i = 0; i < n; i++) {
    const trial = acc ? `${acc}; ${falhas[i]}` : (falhas[i] as string)
    const resto = n - (i + 1)
    const sufixo = resto > 0 ? ` e mais ${resto}` : ''
    if (trial.length + sufixo.length > CRON_MESSAGE_MAX) break
    acc = trial
    usados = i + 1
  }
  if (usados === 0) {
    const sufixo = n > 1 ? ` e mais ${n - 1}` : ''
    return `${(falhas[0] ?? '').slice(0, CRON_MESSAGE_MAX - sufixo.length)}${sufixo}`
  }
  return usados < n ? `${acc} e mais ${n - usados}` : acc
}

const curto = (id: string): string => id.slice(0, 8)

type Variantes = { ids: string[]; originalId: string }

async function lerEmLotes<T>(ids: string[], pagina: (lote: string[]) => (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, teto: number): Promise<{ ok: true; linhas: T[] } | { ok: false; motivo: string }> {
  const linhas: T[] = []
  for (let i = 0; i < ids.length; i += LOTE) {
    const r = await lerPaginado<T>(pagina(ids.slice(i, i + LOTE)), teto)
    if (!r.ok) return { ok: false, motivo: r.motivo }
    linhas.push(...r.linhas)
  }
  return { ok: true, linhas }
}

export async function rodarDecisaoV2(sb: SupabaseClient, agora: Date, entradas: EntradasParaDecisao | undefined, inicioDaFuncao: number): Promise<ResultadoDecisao> {
  const t0 = Date.now()
  const falhas: string[] = []
  const notas: string[] = []
  let avaliados = 0
  let encerrados = 0
  let desfechos = 0
  const hoje = dayPt(agora)
  const ent: EntradasParaDecisao = entradas ?? {
    porTeste: new Map(), ciclosPorTeste: new Map(), alcancePorVideoDia: new Map(), relatoriosPorCanalDia: new Map(), metaPorVideoDia: new Map(), videosLidos: new Set(),
  }

  const fim = async (): Promise<ResultadoDecisao> => {
    const duracao_ms = Date.now() - t0
    if (falhas.length === 0) return { status: 'ok', avaliados, encerrados, desfechos, notas, duracao_ms }
    const error = `decisao_v2: ${notaDeFalhaDecisao(falhas)}`
    await recordCronFailure(JOB, error)
    return { status: 'error', error, health_written: true }
  }

  // (1) seleção: duas consultas, ramos de JSON filtrados em TS
  const corte = new Date(agora.getTime() - DIAS_JANELA_CONCLUIDOS * DIA_MS).toISOString()
  const ativos = await lerPaginado<LinhaTeste>((de, ate) => sb.from('ab_tests').select(SELECT_TESTE).eq('regra_duracao', 'v2').eq('status', 'active').order('id').range(de, ate), 5_000)
  const concl = await lerPaginado<LinhaTeste>((de, ate) => sb.from('ab_tests').select(SELECT_TESTE).eq('regra_duracao', 'v2').in('status', ['completed', 'archived']).gte('completed_at', corte).order('id').range(de, ate), 5_000)
  if (!ativos.ok || !concl.ok) {
    falhas.push(`selecao: ${(!ativos.ok ? ativos : (concl as { motivo: string })).motivo}`)
    return fim()
  }
  const testes = selecionarParaDecisao([...ativos.linhas, ...concl.linhas])
  if (testes.length === 0) return fim()
  const ids = testes.map((t) => t.id)

  // (2) variantes e ciclos, uma leitura cada (em lotes de 100)
  const lv = await lerEmLotes<{ id: string; test_id: string; is_original: boolean }>(ids, (l) => (de, ate) => sb.from('ab_test_variants').select('id, test_id, is_original').in('test_id', l).order('id').range(de, ate), 5_000)
  const lc = await lerEmLotes<unknown>(ids, (l) => (de, ate) => sb.from('ab_test_cycles').select('id, test_id, variant_id, started_at, ended_at, applied_metadata, cycle_number').in('test_id', l).order('id').range(de, ate), 50_000)
  if (!lv.ok || !lc.ok) {
    falhas.push(`leitura: ${!lv.ok ? lv.motivo : (lc as { motivo: string }).motivo}`)
    return fim()
  }
  const variantesPorTeste = new Map<string, Array<{ id: string; is_original: boolean }>>()
  for (const v of lv.linhas) { const l = variantesPorTeste.get(v.test_id) ?? []; l.push(v); variantesPorTeste.set(v.test_id, l) }
  const ciclosPorTeste = new Map<string, CicloComNumero[]>()
  const ciclosInvalidos = new Set<string>()
  for (const bruto of lc.linhas) {
    const p = CicloSchema.safeParse(bruto)
    if (!p.success) { const tid = (bruto as { test_id?: unknown })?.test_id; if (typeof tid === 'string') ciclosInvalidos.add(tid); continue }
    const l = ciclosPorTeste.get(p.data.test_id) ?? []
    l.push(p.data)
    ciclosPorTeste.set(p.data.test_id, l)
  }

  // dias por site
  const porSite = new Map<string, LinhaTeste[]>()
  for (const t of testes) { const l = porSite.get(t.site_id) ?? []; l.push(t); porSite.set(t.site_id, l) }

  const gravar = async (t: LinhaTeste, v2: Record<string, unknown>, hist?: Array<{ em: string; desfecho: DesfechoV2 }>, soSeSemN = false): Promise<number | null> => {
    const args: Record<string, unknown> = { p_test_id: t.id, p_v2: v2 }
    if (hist) args.p_hist = hist
    if (soSeSemN) args.p_so_se_sem_n = true
    const r = await sb.rpc('ab_test_v2_gravar', args)
    const cod = typeof r.data === 'number' ? r.data : 0
    if (r.error || cod === -1) {
      falhas.push(`${curto(t.id)}: gravar v2 falhou`)
      Sentry.captureException(new Error(`decisao v2: gravar: ${r.error?.message ?? 'RPC -1'}`), { tags: { cron: JOB }, extra: { testId: t.id } })
      return null
    }
    return cod
  }

  for (const [siteId, grupo] of porSite) {
    const lidos = await lerDiasDosTestes(sb, siteId, grupo.map((t) => t.id))
    if (!lidos.ok) { falhas.push(`dias do site ${curto(siteId)}: ${lidos.motivo}`); continue }
    for (const t of grupo) {
      try {
        const r = await decidirUm(t, lidos.porTeste.get(t.id), lidos.invalidos.has(t.id))
        avaliados += r.avaliado ? 1 : 0
        encerrados += r.encerrado ? 1 : 0
        desfechos += r.desfecho ? 1 : 0
      } catch (e) {
        falhas.push(`${curto(t.id)}: excecao`)
        Sentry.captureException(e, { tags: { cron: JOB }, extra: { testId: t.id } })
      }
    }
  }

  async function decidirUm(t: LinhaTeste, linhasDia: ReturnType<typeof Array.prototype.slice> | undefined, diaInvalido: boolean): Promise<{ avaliado: boolean; encerrado: boolean; desfecho: boolean }> {
    const nada = { avaliado: false, encerrado: false, desfecho: false }
    const pula = (fingerprint: string, msg: string) => { Sentry.captureMessage(msg, { level: 'error', fingerprint: [fingerprint, t.id], extra: { testId: t.id } }); return nada }
    const lido = lerResultadoV2(t.result_metadata)
    if (lido.estado === 'ilegivel') return pula('ab-decisao-v2-ilegivel', 'ab-decisao: result_metadata.v2 ilegível')
    let v2: ResultadoV2 = lido.estado === 'ok' ? lido.v2 : {}
    if (diaInvalido) return pula('ab-decisao-linha-invalida', 'ab-decisao: linha inválida em ab_test_dias')
    const vars = variantesPorTeste.get(t.id) ?? []
    const originais = vars.filter((v) => v.is_original)
    if (originais.length !== 1 || vars.length < 2 || vars.length > V_MAXIMO_V2) return pula('ab-decisao-variantes', 'ab-decisao: variantes fora do suportado')
    const variantes: Variantes = { ids: vars.map((v) => v.id), originalId: originais[0]!.id }
    const V = vars.length as 2 | 3
    const ciclos = ciclosPorTeste.get(t.id) ?? []
    if (ciclosInvalidos.has(t.id)) return pula('ab-decisao-linha-invalida', 'ab-decisao: ciclo inválido')
    if (ciclos.length === 0) return pula('ab-decisao-sem-ciclos', 'ab-decisao: teste v2 sem ciclos')

    const teste: AbTest = { id: t.id, status: t.status, paused_at: t.paused_at, completed_at: t.completed_at, original_title: t.original_title }
    const concluido = t.status !== 'active'
    const dias: DiaDaDecisao[] = ((linhasDia ?? []) as Array<{ day_pt: string; variant_id: string | null; alcance_estado: DiaDaDecisao['alcance_estado']; impressoes: number | null; ctr: number | null; final: boolean }>).map((l) => {
      const c = cicloDoDia(l.day_pt, ciclos, l.variant_id)
      return { day_pt: l.day_pt, variant_id: l.variant_id, alcance_estado: l.alcance_estado, impressoes: l.impressoes, ctr: l.ctr, final: l.final, bloco: c ? blocoDoDia(c.cycle_number, V) : null }
    })
    const teto = tetoDoTesteV2(t.config, V)
    const relogio = relogioV2(ciclos, teste, agora).length
    const video = Array.isArray(t.youtube_videos) ? t.youtube_videos[0]! : t.youtube_videos
    const em = agora.toISOString()

    // (3) congelamento do N
    let n = typeof v2.n === 'number' && v2.n > 0 ? v2.n : null
    let semN = false
    if (n === null) {
      const lidoVideo = ent.videosLidos.has(video.youtube_video_id)
      const fechando = relogio >= teto || pisos(dias, variantes.ids, Number.POSITIVE_INFINITY).piso_dias
      if (lidoVideo && t.started_at) {
        const base = baseDoVideo(ent, { youtube_id: video.youtube_video_id, channel_id: video.channel_id }, t.id, dayPt(new Date(t.started_at)), agora)
        n = volumeMinimo(base.p1, V)
        const cod = await gravar(t, { n, k: K_POR_V[V], p1: base.p1, p1_dias: base.dias, p1_impressoes: base.impressoes, p1_dias_sem_meta: base.p1_dias_sem_meta, base_estimada: base.base_estimada }, undefined, true)
        if (cod === null) return nada
        if (cod === 0) {
          const rel = await sb.from('ab_tests').select('result_metadata').eq('id', t.id)
          const gravado = lerResultadoV2((rel.data as Array<{ result_metadata: unknown }> | null)?.[0]?.result_metadata)
          n = gravado.estado === 'ok' && typeof gravado.v2.n === 'number' ? gravado.v2.n : n
        }
      } else {
        Sentry.captureMessage('ab-decisao: vídeo fora das entradas do retrato', { level: 'warning', fingerprint: ['ab-decisao-sem-entrada', t.id], extra: { testId: t.id } })
        if (fechando) {
          n = volumeMinimo(P1_SEM_LEITURA, V)
          const cod = await gravar(t, { n, k: K_POR_V[V], p1: P1_SEM_LEITURA, base_estimada: true, p1_motivo: 'sem_leitura' }, undefined, true)
          if (cod === null) return nada
        } else {
          semN = true
          notas.push(`teste ${curto(t.id)}: sem leitura do vídeo, N ainda não congelado`)
        }
      }
    }
    v2 = { ...v2, n }
    const pis = pisos(dias, variantes.ids, n ?? Number.POSITIVE_INFINITY)

    if (concluido) return concluidoUm(t, v2, dias, ciclos, teste, variantes, n, V, teto, em)

    // (4) ativos
    const estatistica = estatisticaV2(dias, variantes.originalId, variantes.ids)
    const ultima: NonNullable<ResultadoV2['ultima_avaliacao']> = {
      em, acao: 'seguir', ...(semN ? { sem_n: true } : {}), dias_relogio: relogio, dias_validos: pis.dias_validos, blocos_completos: pis.blocos_completos, volume: pis.volume,
    }
    const d = semN ? ({ acao: 'seguir' } as const) : decidirV2({ relogio, teto, pisos: pis, estatistica })
    if (d.acao === 'seguir') {
      const p: Record<string, unknown> = { ultima_avaliacao: ultima }
      if (!semN && pis.piso_dias && pis.piso_volume) {
        const melhor = estatistica.estado === 'calculada' ? estatistica.por_variante.filter((x) => x.passa).sort((a, b) => a.p_adj - b.p_adj)[0] : undefined
        p.vencedor_sugerido = melhor?.variant_id ?? null
        Object.assign(p, camposDeEstatistica(estatistica, melhor?.variant_id ?? null))
      }
      if (await gravar(t, p) === null) return { avaliado: true, encerrado: false, desfecho: false }
      return { avaliado: true, encerrado: false, desfecho: false }
    }

    const [saida] = await encerrarComPrazo([{ id: t.id, site_id: t.site_id }], 'regra_v2', inicioDaFuncao)
    const resultado = saida?.resultado ?? 'erro'
    switch (resultado) {
      case 'feito':
      case 'nao_voltou': {
        const prov = dias.some((x) => !x.final)
        const enc = encerradoEmDia(em)
        const p: Record<string, unknown> = {
          ultima_avaliacao: ultima, desfecho: d.desfecho, provisorio: prov, desfecho_no_encerramento: d.desfecho, encerrado_em_dia: enc,
          vencedor_sugerido: d.vencedor_sugerido, ...camposDeEstatistica(estatistica, d.vencedor_sugerido), tentativa_falhou: null,
        }
        if (resultado === 'nao_voltou') { p.volta_falhou = { em }; falhas.push(`${curto(t.id)}: nao_voltou`) }
        const ok = await gravar(t, p, [{ em, desfecho: d.desfecho }])
        return { avaliado: true, encerrado: true, desfecho: ok !== null }
      }
      case 'pausado_teste_youtube':
        await gravar(t, { tentativa_falhou: { em, motivo: 'teste_youtube' } })
        return { avaliado: true, encerrado: false, desfecho: false }
      case 'outro_escritor': {
        const desde = v2.tentativa_falhou?.em_andamento_desde ?? hoje
        await gravar(t, { tentativa_falhou: { em, motivo: 'outro_escritor', em_andamento_desde: desde } })
        if (desde < hoje) falhas.push(`${curto(t.id)}: outro_escritor`)
        return { avaliado: true, encerrado: false, desfecho: false }
      }
      case 'adiado_por_tempo':
        notas.push(`teste ${curto(t.id)}: encerramento adiado por tempo`)
        return { avaliado: true, encerrado: false, desfecho: false }
      case 'ja_encerrado':
        return { avaliado: true, encerrado: false, desfecho: false }
      default:
        await gravar(t, { tentativa_falhou: { em, motivo: 'settle_erro' } })
        falhas.push(`${curto(t.id)}: erro ${saida?.erro ?? ''}`.trim())
        return { avaliado: true, encerrado: false, desfecho: false }
    }
  }

  async function concluidoUm(t: LinhaTeste, v2: ResultadoV2, dias: DiaDaDecisao[], ciclos: CicloComNumero[], teste: AbTest, variantes: Variantes, n: number | null, V: 2 | 3, teto: number, em: string): Promise<{ avaliado: boolean; encerrado: boolean; desfecho: boolean }> {
    const nada = { avaliado: true, encerrado: false, desfecho: false }
    if (n === null || !t.completed_at) { notas.push(`teste ${curto(t.id)}: concluído sem N, aguardando`); return nada }
    const enc = v2.encerrado_em_dia ?? encerradoEmDia(t.completed_at)
    const ate = dias.filter((d) => d.day_pt <= enc)
    const rec = desfechoProvisorio({ dias: ate, encerradoEmDia: enc, variantes: variantes.ids, originalId: variantes.originalId, n })

    if (!v2.desfecho) {
      // settle ok e a gravação do desfecho falhou: foi a rede (A9) ou a decisão?
      const rede = v2.rede_tentou_em ? Date.parse(t.completed_at) - Date.parse(v2.rede_tentou_em) : NaN
      const doRelogio = relogioV2(ciclos, teste, new Date(t.completed_at)).length >= teto + 3
      const foiRede = (Number.isFinite(rede) && rede >= 0 && rede <= MARGEM_REDE_MS) || doRelogio
      if (foiRede) {
        await gravar(t, { desfecho: 'inconclusivo_por_falha', desfecho_no_encerramento: 'inconclusivo_por_falha', encerrado_em_dia: enc, provisorio: false, desfecho_final: 'inconclusivo_por_falha' }, [{ em, desfecho: 'inconclusivo_por_falha' }])
      } else {
        await gravar(t, {
          desfecho: rec.desfecho, provisorio: rec.provisorio, desfecho_no_encerramento: rec.desfecho, encerrado_em_dia: enc, vencedor_sugerido: rec.vencedor_sugerido,
          ...camposDeEstatistica(rec.estatistica, rec.vencedor_sugerido), tentativa_falhou: null,
        }, [{ em, desfecho: rec.desfecho }])
      }
      return { avaliado: true, encerrado: false, desfecho: true }
    }

    const p: Record<string, unknown> = {}
    let hist: Array<{ em: string; desfecho: DesfechoV2 }> | undefined
    if (rec.desfecho !== v2.desfecho) {
      Object.assign(p, { desfecho: rec.desfecho, vencedor_sugerido: rec.vencedor_sugerido }, camposDeEstatistica(rec.estatistica, rec.vencedor_sugerido))
      hist = [{ em, desfecho: rec.desfecho }]
    }
    const relogioAte = relogioV2(ciclos, teste, agora).filter((d) => d <= enc)
    const todasFinal = ate.length > 0 && ate.length === relogioAte.length && ate.every((d) => d.final)
    if (todasFinal) {
      Object.assign(p, { provisorio: false, desfecho_final: rec.desfecho })
    } else if (diffDias(enc, hoje) > DIAS_PARA_FINAL) {
      Object.assign(p, { provisorio: false, desfecho_final: rec.desfecho, finalizado_por_prazo: true })
      falhas.push(`${curto(t.id)}: finalizado_por_prazo`)
    }
    if (Object.keys(p).length === 0) return nada
    const ok = await gravar(t, p, hist)
    return { avaliado: true, encerrado: false, desfecho: ok !== null && hist !== undefined }
  }

  return fim()
}

/** Escalares do topo = os da variante sugerida (ou de menor p_adj); por variante em `por_variante`. Sem dado: nulos explícitos (o merge não apaga chave). */
function camposDeEstatistica(e: EstatisticaV2, sugerida: string | null): Record<string, unknown> {
  if (e.estado !== 'calculada') return { gl: null, p_adj: null, z: null, phi: null, z_adj: null, sinais_por_bloco: null, por_variante: null }
  const ref = e.por_variante.find((x) => x.variant_id === sugerida) ?? [...e.por_variante].sort((a, b) => a.p_adj - b.p_adj)[0]
  return { gl: e.gl, phi: e.phi, p_adj: ref?.p_adj ?? null, z: ref?.z ?? null, z_adj: ref?.z_adj ?? null, sinais_por_bloco: ref?.sinais_por_bloco ?? null, por_variante: e.por_variante }
}

