/**
 * M7b T5: núcleo de `escolherVersao` (sem 'use server'; a action fina mora em ab-lab/actions.ts).
 * Deixa qualquer versão no ar num teste concluído da regra v2. Nunca muda o vencedor estatístico, salvo quando o dono escolhe
 * a própria sugerida (aí o vencedor recebe a sugerida, qualquer que seja o caminho). Nenhuma escrita corre em paralelo:
 * a escrita passa pelo `settleOnAir` (CAS de restore_seq) e o "sem escrita" por um UPDATE com a mesma CAS.
 */
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { camposDoTeste, paraRestoreStatus } from '@/lib/youtube/ab-restore'
import type { CampoNome, RestoreStatus } from '@/lib/youtube/ab-restore'
import { noArConfirmado } from '@/lib/youtube/ab-no-ar'
import type { NoArConfirmado, TentativaNoAr } from '@/lib/youtube/ab-no-ar'
import { lerResultadoV2, toDisplayLabel } from '@/lib/youtube/ab-types'
import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { emAndamentoRecente } from '@/lib/youtube/ab-settle'
import type { settleOnAir as SettleOnAir, OpcoesSaida, LeituraNoAr, lerNoArNoYouTube as LerNoAr } from '@/lib/youtube/ab-settle'
import { qualVersaoNoAr } from '@/lib/youtube/ab-settle-decidir'
import { CICLO_MINIMO_MS } from '@/lib/youtube/ab-watchdog-drift'
import {
  MSG_FALHA_SAIDA, MSG_JA_ENCERRADO, MSG_MUDOU, MSG_EM_ANDAMENTO, MSG_OUTRO_TESTE, MSG_RECUSA, MSG_DESTINO_INVALIDO, MSG_SEM_PERMISSAO_VARIANTE,
} from '@/lib/youtube/ab-acao-saida'
import type { PorqueRecusou, ResultadoConferir, ResultadoEscolha } from '@/lib/youtube/ab-acao-saida'

const LIMITE_HISTORICO = 200

export interface EntradaEscolha { testId: string; varianteId: string; seqVisto: number; forcar?: boolean; siteId: string; userId: string }
export interface PortasEscolha { supabase: SupabaseClient; settle: typeof SettleOnAir }

interface LinhaTeste {
  id: string; site_id: string; test_type: 'thumbnail' | 'title' | 'combo'; status: string; restore_status: unknown; restore_seq: number
  completed_at: string | null; completed_reason: string | null; winner_variant_id: string | null; winner_applied_at: string | null
  result_metadata: unknown; escolha_variant_id: string | null; escolha_em: string | null
}
interface LinhaVariante { id: string; label: string; is_original: boolean }


/** Linhas do histórico que o `final` de uma reivindicação produziu (o histórico no banco só as ganha por gatilho). */
export function linhasDe(final: RestoreStatus, seq: number): TentativaNoAr[] {
  const out: TentativaNoAr[] = []
  for (const campo of ['title', 'thumbnail'] as const) {
    const c = final[campo]
    if (c && c.estado !== 'em_andamento') out.push({ seq, campo, destino: c.destino, estado: c.estado, escreveu: c.escreveu, em: c.em })
  }
  return out
}

export function porqueDe(campos: RestoreStatus, ordem: CampoNome[]): PorqueRecusou {
  for (const k of ordem) {
    const c = campos[k]
    if (!c || c.estado === 'ok') continue
    if (c.estado === 'pulado_drift') return 'drift'
    if (c.estado === 'pulado_sem_original') return 'sem_original'
    const motivo = c.erro !== null && typeof c.erro === 'object' && 'motivo' in c.erro ? c.erro.motivo : null
    if (motivo === 'tempo_esgotado') return 'sem_tempo'
    if (motivo === 'arquivo_do_destino_indisponivel') return 'arquivo_indisponivel'
    return 'youtube'
  }
  return 'youtube'
}

const erro = (error: string): ResultadoEscolha => ({ ok: false, resultado: 'erro', error })

export async function escolherVersaoCore(e: EntradaEscolha, p: PortasEscolha): Promise<ResultadoEscolha> {
  const { supabase } = p
  // 2. leituras (filtradas por site; histórico só deste teste). Erro de leitura nunca vira "sem histórico".
  let teste: LinhaTeste, variantes: LinhaVariante[], historico: TentativaNoAr[]
  try {
    const t = await supabase.from('ab_tests')
      .select('id, site_id, test_type, status, restore_status, restore_seq, completed_at, completed_reason, winner_variant_id, winner_applied_at, result_metadata, escolha_variant_id, escolha_em')
      .eq('id', e.testId).eq('site_id', e.siteId).maybeSingle()
    if (t.error) throw new Error(t.error.message)
    if (!t.data) return { ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO }
    teste = t.data as LinhaTeste
    const [v, h] = await Promise.all([
      supabase.from('ab_test_variants').select('id, label, is_original').eq('test_id', e.testId),
      supabase.from('ab_test_restores').select('seq, campo, destino, estado, escreveu, em').eq('test_id', e.testId).order('seq', { ascending: false }).limit(LIMITE_HISTORICO),
    ])
    if (v.error) throw new Error(v.error.message)
    if (h.error) throw new Error(h.error.message)
    variantes = (v.data ?? []) as LinhaVariante[]
    historico = (h.data ?? []) as TentativaNoAr[]
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'ab-escolha' } })
    return erro(MSG_FALHA_SAIDA)
  }

  const lido = lerResultadoV2(teste.result_metadata)
  const v2 = lido.estado === 'ok' ? lido.v2 : null
  const dentro = teste.completed_reason === 'regra_v2' || (teste.completed_reason === 'manual_winner' && (v2?.encerrado_em_dia ?? null) !== null)
  if (teste.status !== 'completed' || !dentro) return { ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO }
  const destino = variantes.find((v) => v.id === e.varianteId)
  if (!destino) return erro(MSG_DESTINO_INVALIDO)
  const originais = variantes.filter((v) => v.is_original)
  if (originais.length !== 1) return erro(MSG_DESTINO_INVALIDO)
  const original = originais[0]!
  let sugerida: string | null = v2?.vencedor_sugerido ?? null
  if (sugerida !== null && !variantes.some((v) => v.id === sugerida)) {
    Sentry.captureMessage('ab-escolha: vencedor_sugerido não é variante do teste', { extra: { testId: e.testId } })
    sugerida = null
  }

  // 3. CAS de tela
  if (e.seqVisto !== teste.restore_seq) return { ok: false, resultado: 'mudou', error: MSG_MUDOU }

  const entrada = {
    test_type: teste.test_type, restore_status: teste.restore_status, restore_seq: teste.restore_seq, completed_at: teste.completed_at,
    winner_variant_id: teste.winner_variant_id, winner_applied_at: teste.winner_applied_at,
    variantes: variantes.map((v) => ({ id: v.id, label: toDisplayLabel(v.label, v.is_original), is_original: v.is_original })),
  }
  const noAr = noArConfirmado(entrada, historico)
  const vencedorPendente = teste.completed_reason === 'regra_v2' && teste.winner_variant_id === null
  const destinoESugerida = sugerida !== null && e.varianteId === sugerida

  // 4. sem escrita no YouTube: o destino já está confirmado no ar
  if (noAr.tipo === 'confirmado' && noAr.varianteId === e.varianteId) {
    if (teste.escolha_variant_id === e.varianteId && teste.escolha_em !== null) return { ok: true, resultado: 'no_ar', noAr, restoreSeq: e.seqVisto }
    const gravaVencedor = destinoESugerida && vencedorPendente
    const agora = new Date().toISOString()
    let q = supabase.from('ab_tests')
      .update({
        escolha_variant_id: e.varianteId, escolha_em: agora, escolha_por: e.userId, updated_at: agora, restore_seq: e.seqVisto + 1,
        ...(gravaVencedor ? { completed_reason: 'manual_winner', winner_variant_id: sugerida } : {}),
      })
      .eq('id', e.testId).eq('site_id', e.siteId).eq('status', 'completed').eq('restore_seq', e.seqVisto)
    if (gravaVencedor) q = q.is('winner_variant_id', null).eq('completed_reason', 'regra_v2')
    const { data, error } = await q.select('id')
    if (error) { Sentry.captureException(error, { tags: { area: 'ab-escolha' } }); return erro(MSG_FALHA_SAIDA) }
    if (((data ?? []) as unknown[]).length === 0) return { ok: false, resultado: 'mudou', error: MSG_MUDOU }
    return destino.is_original
      ? { ok: true, resultado: 'guardado', restoreSeq: e.seqVisto + 1 }
      : { ok: true, resultado: 'no_ar', noAr: { ...noAr, desde: agora }, restoreSeq: e.seqVisto + 1 }
  }

  // 5. escrita no YouTube
  const viaSugerido = destinoESugerida && !destino.is_original && vencedorPendente
  const op: OpcoesSaida = {
    siteId: e.siteId, destino: { tipo: 'variante', id: e.varianteId }, humano: true, seqEsperado: e.seqVisto, autor: e.userId,
    ...(e.forcar === true ? { forcar: true } : {}),
    motivo: viaSugerido ? 'aplicar_sugerido' : 'escolher',
    ...(!viaSugerido && destinoESugerida && vencedorPendente
      ? { extra: { completed_reason: 'manual_winner', winner_variant_id: sugerida }, vencedorEsperado: sugerida as string } : {}),
  }
  let r: Awaited<ReturnType<typeof SettleOnAir>>
  try {
    r = await p.settle(e.testId, op)
  } catch (err) {
    // O settle pode ter escrito antes de lançar: não se sabe o que está no ar.
    Sentry.captureException(err, { tags: { area: 'ab-escolha' } })
    return { ok: false, resultado: 'incerto', restoreSeq: null }
  }

  // 6. mapeia
  switch (r.resultado) {
    case 'feito': {
      const seq = r.seq ?? teste.restore_seq + 1
      const ordem = camposDoTeste(teste.test_type)
      const doFinal = { ...entrada, restore_status: r.campos, restore_seq: seq }
      const emMemoria = noArConfirmado(doFinal, [...historico, ...linhasDe(r.campos, seq)])
      if (ordem.some((c) => r.campos[c]?.escreveu === null)) return { ok: false, resultado: 'incerto', restoreSeq: seq }
      if (ordem.every((c) => r.campos[c]?.estado === 'ok')) {
        const confirmado: NoArConfirmado = emMemoria.tipo === 'confirmado'
          ? emMemoria
          : { tipo: 'confirmado', varianteId: e.varianteId, letra: toDisplayLabel(destino.label, destino.is_original), desde: null }
        return { ok: true, resultado: 'no_ar', noAr: confirmado, restoreSeq: seq }
      }
      const porque = porqueDe(r.campos, ordem)
      return {
        ok: false, resultado: 'recusou', porque, noAr: emMemoria, restoreSeq: seq, error: MSG_RECUSA[porque],
        entrou: ordem.filter((c) => r.campos[c]?.estado === 'ok'),
      }
    }
    case 'perdido': return { ok: false, resultado: 'incerto', restoreSeq: null }
    case 'precisa_confirmar': return { ok: true, resultado: 'precisa_confirmar', campos: r.campos }
    case 'mudou': return { ok: false, resultado: 'mudou', error: MSG_MUDOU }
    case 'em_andamento': return { ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO }
    case 'ja_encerrado': return { ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO }
    case 'sem_permissao': return { ok: false, resultado: 'sem_permissao', error: MSG_SEM_PERMISSAO_VARIANTE }
    case 'outro_teste': return { ok: false, resultado: 'outro_teste', error: MSG_OUTRO_TESTE }
    case 'teste_youtube': return { ok: false, resultado: 'teste_youtube', error: r.motivo }
    case 'destino_invalido': return erro(MSG_DESTINO_INVALIDO)
  }
}


// ---------------------------------------------------------------------------
// conferirNoAr: só lê; quem acerta o registro é o "Tentar de novo" do dono
// ---------------------------------------------------------------------------

export interface PortasConferir { supabase: SupabaseClient; ler: typeof LerNoAr; agora?: () => Date }

const MSG_SEM_LEITURA = 'Não foi possível ler o vídeo no YouTube agora.'

export async function conferirNoArCore(e: { testId: string; siteId: string }, p: PortasConferir): Promise<ResultadoConferir> {
  const { supabase } = p
  const agora = (p.agora ?? (() => new Date()))()
  let teste: LinhaTeste, variantes: LinhaVariante[], historico: TentativaNoAr[]
  try {
    // Guarda de site: o cliente de serviço ignora a RLS; teste de outro site nunca gasta cota com o token do canal dele.
    const t = await supabase.from('ab_tests')
      .select('id, site_id, test_type, status, restore_status, restore_seq, completed_at, completed_reason, winner_variant_id, winner_applied_at, result_metadata, escolha_variant_id, escolha_em')
      .eq('id', e.testId).eq('site_id', e.siteId).maybeSingle()
    if (t.error) throw new Error(t.error.message)
    if (!t.data) return { ok: false, estado: 'ja_encerrado', error: MSG_JA_ENCERRADO }
    teste = t.data as LinhaTeste
    const [v, h] = await Promise.all([
      supabase.from('ab_test_variants').select('id, label, is_original').eq('test_id', e.testId),
      supabase.from('ab_test_restores').select('seq, campo, destino, estado, escreveu, em').eq('test_id', e.testId).order('seq', { ascending: false }).limit(LIMITE_HISTORICO),
    ])
    if (v.error) throw new Error(v.error.message)
    if (h.error) throw new Error(h.error.message)
    variantes = (v.data ?? []) as LinhaVariante[]
    historico = (h.data ?? []) as TentativaNoAr[]
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'ab-escolha' } })
    return { ok: false, estado: 'sem_leitura', error: MSG_SEM_LEITURA }
  }
  if (teste.status !== 'completed') return { ok: false, estado: 'ja_encerrado', error: MSG_JA_ENCERRADO }

  const rs = paraRestoreStatus(teste.restore_status)
  if (emAndamentoRecente(rs, agora)) return { ok: true, estado: 'escrevendo' }

  const entrada = {
    test_type: teste.test_type, restore_status: teste.restore_status, restore_seq: teste.restore_seq, completed_at: teste.completed_at,
    winner_variant_id: teste.winner_variant_id, winner_applied_at: teste.winner_applied_at,
    variantes: variantes.map((v) => ({ id: v.id, label: toDisplayLabel(v.label, v.is_original), is_original: v.is_original })),
  }
  const registro = noArConfirmado(entrada, historico)
  if (registro.tipo === 'confirmado') return { ok: true, estado: 'lido', noAr: registro, restoreSeq: teste.restore_seq, fonte: 'registro' }

  // desconhecido ou misto: lê o YouTube
  let leitura: LeituraNoAr
  try {
    leitura = await p.ler(e.testId, e.siteId)
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'ab-escolha' } })
    return { ok: false, estado: 'sem_leitura', error: MSG_SEM_LEITURA }
  }
  if (leitura.tipo === 'sem_leitura') return { ok: false, estado: 'sem_leitura', error: MSG_SEM_LEITURA }

  const r = leitura.retrato
  const original = r.variantes.find((v) => v.is_original)
  if (!original) return { ok: false, estado: 'sem_leitura', error: MSG_SEM_LEITURA }
  const q = qualVersaoNoAr({
    ...(leitura.titulo !== undefined ? { titulo: leitura.titulo } : {}),
    ...(leitura.dhash !== undefined ? { dhash: leitura.dhash } : {}),
    originalTitle: r.original_title, variantes: r.variantes.map((v) => ({ id: v.id, title_text: v.title_text })),
    dhashes: leitura.dhashes, idOriginal: original.id,
  })
  const letraDoId = (id: string): DisplayLabel => {
    const v = variantes.find((x) => x.id === id)
    return v ? toDisplayLabel(v.label, v.is_original) : 'B'
  }
  const campos = camposDoTeste(teste.test_type)
  const lidos = campos.map((c) => (c === 'title' ? q.porCampo.title : q.porCampo.thumbnail))

  // Miniatura recém-enviada (tentativa sem resposta há menos de 3 h) ainda mostrando a versão anterior: o CDN demora. Nunca "recusou".
  const ultima = registro.tipo === 'desconhecido' ? registro.ultima : null
  const anteriorId = ultima ? variantes.find((v) => toDisplayLabel(v.label, v.is_original) === ultima.letra)?.id ?? null : null
  const linhasThumb = [...(rs?.thumbnail ? [{ ...rs.thumbnail, seq: teste.restore_seq }] : []), ...historico.filter((h) => h.campo === 'thumbnail')]
  const recente = linhasThumb.find((l) => l.escreveu === null && agora.getTime() - Date.parse(l.em) < CICLO_MINIMO_MS)
  if (campos.includes('thumbnail') && anteriorId !== null && recente !== undefined) {
    const destinoId = recente.destino === 'original' ? original.id : recente.destino
    if (q.porCampo.thumbnail === anteriorId && destinoId !== anteriorId) {
      const noAr: NoArConfirmado = { tipo: 'confirmado', varianteId: anteriorId, letra: letraDoId(anteriorId), desde: ultima?.desde ?? null }
      const titulo = campos.includes('title') && q.porCampo.title === destinoId ? 'conferido' : 'nao_lido'
      return { ok: true, estado: 'nao_propagou', noAr, titulo }
    }
  }

  if (lidos.every((x): x is string => typeof x === 'string')) {
    const primeiro = lidos[0]!
    if (lidos.every((x) => x === primeiro)) {
      const noAr: NoArConfirmado = { tipo: 'confirmado', varianteId: primeiro, letra: letraDoId(primeiro), desde: null }
      return { ok: true, estado: 'lido', noAr, restoreSeq: teste.restore_seq, fonte: 'youtube' }
    }
    const porCampo: Partial<Record<CampoNome, DisplayLabel>> = {}
    campos.forEach((c, i) => { porCampo[c] = letraDoId(lidos[i] as string) })
    return { ok: true, estado: 'lido_misto', porCampo, restoreSeq: teste.restore_seq }
  }
  // Algum campo não casa com versão nenhuma: só afirma "nenhuma" se todas as versões foram comparadas.
  if (!q.completo) return { ok: false, estado: 'sem_leitura', error: MSG_SEM_LEITURA }
  return { ok: true, estado: 'nenhuma_versao', restoreSeq: teste.restore_seq }
}
