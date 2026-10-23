/**
 * Retomar um teste pausado (P4a, T10, emenda 32 i). NÃO é server action: o corpo mora aqui para que as portas
 * (banco, relógio, token, leitura do retrato) sejam injetáveis sem virar parâmetro de endpoint HTTP.
 * `resumeAbTest` (actions.ts) só resolve a sessão e chama `retomarTeste`.
 *
 * Ordem: lê (restore_seq, restore_status anterior em memória) -> recusa se há tentativa em voo (< 2 min) ->
 * reivindica por restore_seq MANTENDO `paused` -> escreve no YouTube (relendo restore_seq antes de CADA escrita) ->
 * fecha por `ab_resume_commit` (uma transação). Falha tratada grava o resultado por campo (nunca "voltou ao original"
 * com escrita parcial); morte sem tratamento deixa o campo `em_andamento` com destino = variante e o vigia converte.
 */
import { guardaDoPonto } from '@/lib/youtube/teste-youtube/nativo/aplicar-guarda'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyVariantToYouTube, antesDeEscreverPorSeq } from '@/lib/youtube/ab-apply'
import { avisarRotacaoCruzada, motivoVarianteSemConteudo } from '@/lib/youtube/ab-rotate-claim'
import { camposDoTeste, paraRestoreStatus, proximaDoInterrompido } from '@/lib/youtube/ab-restore'
import type { CampoNome, CampoRestauracao, RestoreStatus } from '@/lib/youtube/ab-restore'
import { emAndamentoRecente, TETO_MS } from '@/lib/youtube/ab-settle'
import { MSG_EM_ANDAMENTO, MSG_JA_ENCERRADO, MSG_MUDOU, MSG_VARIANTE_DA_VEZ, MSG_YOUTUBE_NAO_ACEITOU } from '@/lib/youtube/ab-acao-saida'
import type { ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import { TestTypeSchema, DESCRICAO_FORA_DO_TESTE } from '@/lib/youtube/ab-schemas'
import { DRIFT_STATUS_NOTE } from '@/lib/youtube/ab-types'
import type { AbTestVariantRow, TestType } from '@/lib/youtube/ab-types'
import { resolveVideoChannel, resolveYouTubeVideoId } from '@/lib/youtube/ab-video-context'

/** A linha do teste que a retomada precisa (o que `lerRetrato` devolve). */
export interface RetratoRetomar {
  id: string
  site_id: string
  name: string | null
  status: string
  status_note: string | null
  drift_acknowledged_at: string | null
  youtube_video_id: string
  test_type: string | null
  original_title: string | null
  config: { rotation_pattern?: 'abba' | 'round_robin' | 'random' } | null
  restore_seq: number
  restore_status: unknown
}

export interface PortasRetomar {
  supabase: SupabaseClient
  agora: () => Date
  /** Token do canal (a porta embrulha ensureFreshToken). */
  token: (siteId: string, channelAccountId: string) => Promise<string>
  lerRetrato?: (testId: string, siteId: string) => Promise<RetratoRetomar | null>
}

const COLUNAS = 'id, site_id, name, status, status_note, drift_acknowledged_at, youtube_video_id, test_type, original_title, config, restore_seq, restore_status'

const erro = (error: string): ResultadoAcaoSaida => ({ ok: false, resultado: 'erro', error })

export { antesDeEscreverPorSeq }

/** Teste de tipo fora dos três (descrição saiu do A/B): mensagem de recusa, ou null se o tipo vale. */
export function recusaTipoForaDeUso(testType: unknown): string | null {
  if (TestTypeSchema.safeParse(testType ?? 'thumbnail').success) return null
  return testType === 'description' ? DESCRICAO_FORA_DO_TESTE.message : 'Tipo de teste desconhecido'
}

async function lerPadrao(supabase: SupabaseClient, testId: string, siteId: string): Promise<RetratoRetomar | null> {
  const { data } = await supabase.from('ab_tests').select(COLUNAS).eq('id', testId).eq('site_id', siteId).single()
  return (data as RetratoRetomar | null) ?? null
}

/**
 * Valor de `restore_status` depois de uma retomada que falhou. Campo escrito (a verdade: está no ar) vira `ok`;
 * campo não escrito volta ao VALOR ANTERIOR, inclusive nulo (F-P10: teste antigo continua antigo). Nada escrito =
 * o anterior inteiro.
 */
export function restoreStatusDaFalha(
  anterior: RestoreStatus | null,
  escritos: Partial<Record<CampoNome, boolean>>,
  varianteId: string,
  em: string,
  attemptsAnterior: Partial<Record<CampoNome, number>>,
): RestoreStatus | null {
  const campos = (Object.keys(escritos) as CampoNome[]).filter((c) => escritos[c])
  if (campos.length === 0) return anterior
  const saida: RestoreStatus = { ...(anterior ?? {}) }
  for (const c of campos) {
    const ok: CampoRestauracao = { estado: 'ok', destino: varianteId, em, forcado: false, escreveu: true, erro: null, attempts: attemptsAnterior[c] ?? 0 }
    saida[c] = ok
  }
  return saida
}

/**
 * `seqVisto` (P4b T9, Y-5): o `restore_seq` que a tela leu; diferente do atual = `mudou`, nada lido além do retrato,
 * nada escrito. Omitido só por chamadores sem tela (testes do corpo).
 */
export async function retomarTeste(testId: string, siteId: string, portas: PortasRetomar, seqVisto?: number): Promise<ResultadoAcaoSaida> {
  const { supabase } = portas
  const prazo = portas.agora().getTime() + TETO_MS // F-D3: ação humana, início + 55 s
  const teste = await (portas.lerRetrato ?? ((t, s) => lerPadrao(supabase, t, s)))(testId, siteId)
  if (!teste) return erro('Test not found')
  if (seqVisto !== undefined && seqVisto !== teste.restore_seq) return { ok: false, resultado: 'mudou', error: MSG_MUDOU }
  if (teste.status !== 'paused') return { ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO }
  const tipoRecusado = recusaTipoForaDeUso(teste.test_type)
  if (tipoRecusado) return erro(tipoRecusado)
  if (teste.status_note === DRIFT_STATUS_NOTE && !teste.drift_acknowledged_at) {
    return erro('Drift não reconhecido. Reconheça a mudança antes de retomar o teste.')
  }
  // Guarda do teste do YouTube (F1a-dado; depois das recusas sem escrita, para o modo `log` só anotar onde a escrita sairia): retomar escreveria no vídeo; teste nativo em andamento recusa.
  const guarda = await guardaDoPonto(supabase, { siteId, testId, videoId: teste.youtube_video_id, ponto: 'retomar' })
  if (!guarda.seguir) return erro(guarda.motivo)

  // Retrato anterior, em memória (F-P10): restore_status ilegível conta como "sem retrato" para a conta, mas o valor
  // bruto é o que se regrava numa falha sem escrita.
  let anteriorBruto = teste.restore_status ?? null
  let anterior = paraRestoreStatus(anteriorBruto)
  let seqAtual = teste.restore_seq
  // F-D4: tentativa em voo há menos de 2 min (60 s do teto da função + folga) -> recusa, sem reivindicar.
  if (emAndamentoRecente(anterior, portas.agora())) return { ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO }

  // PODE-1: campo em_andamento que chegou até aqui (a validação acima já recusou os de menos de 2 min) conta como
  // interrompido ANTES de a reivindicação o sobrescrever: uma reivindicação própria, uma linha no histórico.
  const velhos = anterior ? (['title', 'thumbnail'] as const).filter((c) => anterior?.[c]?.estado === 'em_andamento') : []
  if (anterior && velhos.length > 0) {
    const convertido: RestoreStatus = { ...anterior }
    for (const c of velhos) convertido[c] = proximaDoInterrompido(anterior[c]!)
    const { data: conv, error: erroConv } = await supabase
      .from('ab_tests')
      .update({ restore_seq: seqAtual + 1, restore_status: convertido })
      .eq('id', testId)
      .eq('site_id', siteId)
      .eq('status', 'paused')
      .eq('restore_seq', seqAtual)
      .select('restore_seq')
    if (erroConv) throw new Error(`ab-resume: converter em_andamento velho do teste ${testId}: ${erroConv.message}`)
    if (((conv ?? []) as unknown[]).length === 0) return outroEscritorGanhou(supabase, testId)
    seqAtual += 1
    anterior = convertido
    anteriorBruto = convertido
  }

  const { data: variantes } = await supabase
    .from('ab_test_variants')
    .select('id, label, is_original, blob_url, title_text, sort_order')
    .eq('test_id', testId)
    .order('sort_order', { ascending: true })
  if (!variantes || variantes.length < 2) return erro('No variants found')

  const { count: totalCiclos } = await supabase.from('ab_test_cycles').select('id', { count: 'exact', head: true }).eq('test_id', testId)
  const indice = getNextVariantIndex(teste.config?.rotation_pattern ?? 'abba', variantes.length, totalCiclos ?? 0)
  if (indice < 0 || indice >= variantes.length) return erro(MSG_VARIANTE_DA_VEZ)
  const proxima = variantes[indice] as AbTestVariantRow
  const testType = (teste.test_type ?? 'thumbnail') as TestType

  // Guarda de conteúdo (T9 R1): variante sem cópia no Blob ou sem título não reivindica.
  const semConteudo = motivoVarianteSemConteudo(testType as 'thumbnail' | 'title' | 'combo', proxima, teste.original_title)
  if (semConteudo) {
    return erro(`O teste continua pausado: a variante da vez está ${semConteudo}. Corrija a variante e retome de novo.`)
  }

  // Falha de canal ou de token volta como resultado com a mensagem (o dono precisa saber que deve reconectar o canal).
  let accessToken: string
  let youtubeVideoId: string | null
  try {
    const canal = await resolveVideoChannel(supabase, siteId, teste.youtube_video_id)
    if (!canal.ok) return erro(canal.error)
    accessToken = await portas.token(siteId, canal.channelAccountId)
    youtubeVideoId = await resolveYouTubeVideoId(supabase, teste.youtube_video_id)
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Não foi possível ler o canal do YouTube. Reconecte o canal.')
  }
  if (!youtubeVideoId) return erro('YouTube video ID not found')

  // Reivindica mantendo `paused`: restore_seq + 1 e os campos que vai escrever em em_andamento (destino = a variante).
  const campos = camposDoTeste(testType as 'thumbnail' | 'title' | 'combo')
  const emIso = portas.agora().toISOString()
  const reivindicado: RestoreStatus = { ...(anterior ?? {}) }
  const attemptsAnterior: Partial<Record<CampoNome, number>> = {}
  for (const c of campos) {
    attemptsAnterior[c] = 0 // a retomada abre corrente: nasce com 0 (e o `ok` de uma falha parcial também)
    reivindicado[c] = { estado: 'em_andamento', destino: proxima.id, em: emIso, forcado: false, escreveu: null, erro: null, attempts: 0 }
  }
  const { data: linhas, error: erroClaim } = await supabase
    .from('ab_tests')
    .update({ restore_seq: seqAtual + 1, restore_status: reivindicado })
    .eq('id', testId)
    .eq('site_id', siteId)
    .eq('status', 'paused')
    .eq('restore_seq', seqAtual)
    .select('restore_seq')
  if (erroClaim) throw new Error(`ab-resume: reivindicação do teste ${testId}: ${erroClaim.message}`)
  const seq = (linhas as Array<{ restore_seq: number }> | null)?.[0]?.restore_seq
  if (seq === undefined) return outroEscritorGanhou(supabase, testId)

  const aplicado = await applyVariantToYouTube(
    {
      youtubeVideoId,
      accessToken,
      testType,
      variant: { id: proxima.id, blob_url: proxima.blob_url, title_text: proxima.title_text },
      originalTitle: teste.original_title,
    },
    { antesDeEscrever: antesDeEscreverPorSeq(supabase, testId, seq), prazo, agora: () => portas.agora().getTime() },
  )

  const nomeDoTeste = teste.name ?? ''
  if (aplicado.perdeuAVez) {
    if (aplicado.appliedThumbnail || aplicado.appliedMetadata) {
      Sentry.captureMessage('ab-resume: perdeu a vez no meio da escrita', { extra: { testId, seq } })
      await avisarCruzada({ testId, siteId, testName: nomeDoTeste, seq, youtubeVideoId })
    }
    return outroEscritorGanhou(supabase, testId)
  }

  if (!aplicado.ok) {
    // Y-B2: resultado por campo. A thumbnail vai antes do título, então `appliedThumbnail && !appliedMetadata` é possível.
    const escritos: Partial<Record<CampoNome, boolean>> = {}
    for (const c of campos) escritos[c] = c === 'thumbnail' ? aplicado.appliedThumbnail : aplicado.appliedMetadata
    // Nada escrito: regrava o valor bruto anterior (F-P10). Com escrita, parte do parseado (o bruto ilegível não vai ao objeto novo).
    const algumEscrito = Object.values(escritos).some(Boolean)
    const valor = algumEscrito
      ? restoreStatusDaFalha(anterior, escritos, proxima.id, emIso, attemptsAnterior)
      : (anteriorBruto as RestoreStatus | null)
    const { error: erroGrava } = await supabase
      .from('ab_tests')
      .update({ restore_status: valor })
      .eq('id', testId)
      .eq('restore_seq', seq)
    if (erroGrava) throw new Error(`ab-resume: gravação do resultado da falha do teste ${testId}: ${erroGrava.message}`)
    return erro(aplicado.tempoEsgotado ? 'O YouTube demorou demais. Tente de novo.' : (aplicado.error ?? MSG_YOUTUBE_NAO_ACEITOU))
  }

  const { data: cicloId, error: erroFecho } = await supabase.rpc('ab_resume_commit', {
    p_test_id: testId,
    p_seq: seq,
    p_de: 'paused',
    p_variant_id: proxima.id,
    p_applied_metadata: aplicado.meta,
  })
  if (erroFecho) throw new Error(`ab-resume: fecho da retomada do teste ${testId}: ${erroFecho.message}`)
  if (!cicloId) {
    // Outro escritor ganhou entre a escrita e o fecho: nenhum ciclo foi aberto e o YouTube foi escrito por nós.
    Sentry.captureMessage('ab-resume: reivindicação perdida depois da escrita', { extra: { testId, seq } })
    await avisarCruzada({ testId, siteId, testName: nomeDoTeste, seq, youtubeVideoId })
    return outroEscritorGanhou(supabase, testId)
  }
  return { ok: true, resultado: 'feito', campos: {} }
}

async function avisarCruzada(args: Parameters<typeof avisarRotacaoCruzada>[0]): Promise<void> {
  try {
    await avisarRotacaoCruzada(args)
  } catch (e) {
    Sentry.captureException(e, { extra: { testId: args.testId, context: 'aviso-retomada-cruzada' } })
  }
}

/** Perdeu a reivindicação: a releitura diz se o teste segue pausado (outra tentativa em voo) ou já mudou. */
async function outroEscritorGanhou(supabase: SupabaseClient, testId: string): Promise<ResultadoAcaoSaida> {
  const { data } = await supabase.from('ab_tests').select('status').eq('id', testId).maybeSingle()
  const status = (data as { status: string } | null)?.status
  return status === 'paused'
    ? { ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO }
    : { ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO }
}
