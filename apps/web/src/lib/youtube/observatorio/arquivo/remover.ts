/**
 * A5 · E10, Tarefa 11a: remover um canal de concorrente do banco online só com exportação conferida e confirmada no NAS, e apagar do Blob as
 * miniaturas dele. Quem confere tudo é a função do banco (`competitor_channel_remove_archived`, MG6); aqui ficam a tradução do erro para a
 * frase do catálogo (nunca a mensagem do banco), o apagamento das miniaturas e a nova tentativa diária das que sobraram.
 *
 * É o ÚNICO ponto do Observatório que chama `del` do Blob (linha 17 da lista fechada do que apaga). Só apaga URL sob `observatorio/thumbs/`,
 * decidido pelo CAMINHO da URL. Com `OBS_E2E=1` o Blob não é tocado (o `.env.local` do Playwright traz o token de produção): a pendência fica.
 */
import * as Sentry from '@sentry/nextjs'
import { del } from '@vercel/blob'
import type { SupabaseClient } from '@supabase/supabase-js'
import { codigoE10, FRASES_E10, type CodigoE10 } from './codigos'
import { RULES } from '../rules'

export { codigoE10, FRASES_E10 }
export type { CodigoE10 }

export const PREFIXO_DAS_MINIATURAS = 'observatorio/thumbs/'
const BLOCO = 100

/** `prazoMs`: quanto a remoção pode gastar no Blob depois do commit (padrão 15 s); o que não coube fica pendente para a tarefa diária. `agora`: relógio injetável. */
export interface DepsDoBlob { apagarDoBlob?: (urls: string[]) => Promise<void>; prazoMs?: number; agora?: () => number }

export const PRAZO_DO_BLOB_NA_REMOCAO_MS = 15_000

async function apagarDoBlobPadrao(urls: string[]): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error('sem_token')
  await del(urls, { token })
}

const e2e = (): boolean => process.env.OBS_E2E === '1'
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Separa pelo caminho da URL (não por `includes`): só vale `https://host/observatorio/thumbs/...`, sem `..` nem barra codificada. */
export function soMiniaturasDoObservatorio(urls: string[]): { apagar: string[]; fora: string[] } {
  const apagar: string[] = []
  const fora: string[] = []
  for (const u of urls) {
    let ok = false
    try {
      const p = new URL(u)
      if (p.protocol === 'https:' || p.protocol === 'http:') {
        const caminho = decodeURIComponent(p.pathname)
        ok = p.pathname.startsWith('/' + PREFIXO_DAS_MINIATURAS) && !caminho.split('/').includes('..') && !/%2f/i.test(p.pathname)
      }
    } catch { ok = false }
    ;(ok ? apagar : fora).push(u)
  }
  return { apagar, fora }
}

function relatar(motivo: string, contagens: Record<string, number>, tags: Record<string, string> = {}): void {
  // só o motivo, o nome da função do banco (`fn`) e contagens: nunca URL, token nem mensagem de erro
  Sentry.captureMessage(`arquivo_remover: ${motivo}`, { level: 'warning', tags: { component: 'observatorio-arquivo', motivo, ...tags }, extra: contagens })
}

/**
 * O laço do Blob depois do commit, comum aos dois caminhos de remoção: blocos de `BLOCO`, dentro do prazo, parando no 1º erro. `baixa` tira o
 * bloco da pendência no banco. Devolve quantas URLs foram apagadas. Com `OBS_E2E=1` não toca no Blob.
 */
async function apagarNoBlob(apagar: string[], deps: DepsDoBlob, baixa: (bloco: string[]) => Promise<void>): Promise<number> {
  let apagadas = 0
  if (apagar.length > 0 && !e2e()) {
    const apagarDoBlob = deps.apagarDoBlob ?? apagarDoBlobPadrao
    const agora = deps.agora ?? Date.now
    const fim = agora() + (deps.prazoMs ?? PRAZO_DO_BLOB_NA_REMOCAO_MS)
    for (let i = 0; i < apagar.length; i += BLOCO) {
      if (agora() >= fim) { relatar('blob_prazo_da_remocao', { restantes: apagar.length - i }); break }
      const bloco = apagar.slice(i, i + BLOCO)
      try {
        await apagarDoBlob(bloco)
      } catch {
        relatar('blob_falhou', { restantes: apagar.length - i })
        break
      }
      apagadas += bloco.length
      await baixa(bloco)
    }
  }
  return apagadas
}

type Falha = { ok: false; codigo: CodigoE10; frase: string }
const falhaDe = (codigo: CodigoE10): Falha => ({ ok: false, codigo, frase: FRASES_E10[codigo] })

/** Chama uma função do banco e traduz o erro para a frase do catálogo (nunca a mensagem do banco). */
async function chamar(sb: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<{ data: unknown } | Falha> {
  try {
    const r = await sb.rpc(fn, args)
    if (r.error) {
      const codigo = codigoE10(r.error)
      if (codigo === 'inesperado') relatar('chamada_inesperada', {}, { fn })
      return falhaDe(codigo)
    }
    return { data: r.data }
  } catch {
    relatar('chamada_excecao', {}, { fn })
    return falhaDe('inesperado')
  }
}

/**
 * Caminho 1 do "Remover canal": apaga o canal SEM guardar (só quem administra o site, só canal com até `RULES.removal.semGuardarAteDias` dias, nome
 * digitado, nenhum vídeo compartilhado). Tudo é conferido pelo banco (`competitor_channel_delete_unarchived`); aqui ficam a tradução do erro
 * e a baixa das miniaturas do Blob, que não cabem na transação.
 */
export async function apagarCanalSemGuardar(
  sb: SupabaseClient,
  e: { siteId: string; canalId: string; actorId: string; nomeDigitado: string; motivo: string },
  deps: DepsDoBlob = {},
): Promise<{ ok: true; videos: number; miniaturasPendentes: number; foraDoPrefixo: number; registrosDiarios?: number; leituras?: number; imagensRestantes?: number } | Falha> {
  const r = await chamar(sb, 'competitor_channel_delete_unarchived', {
    p_site: e.siteId, p_channel: e.canalId, p_actor: e.actorId, p_confirm_name: e.nomeDigitado, p_motivo: e.motivo,
  })
  if ('ok' in r) return r
  const data = r.data
  if (!ehObjeto(data) || data.status !== 'apagado' || typeof data.deletion_id !== 'number') {
    relatar('resposta_invalida', {})
    return falhaDe('inesperado')
  }
  const id = data.deletion_id
  const videos = Number(data.videos)
  const urls = Array.isArray(data.blob_urls) ? data.blob_urls.filter((u): u is string => typeof u === 'string') : []
  const { apagar, fora } = soMiniaturasDoObservatorio(urls)
  if (fora.length > 0) relatar('miniaturas_fora_do_prefixo', { fora: fora.length })
  const apagadas = await apagarNoBlob(apagar, deps, async bloco => {
    try {
      const b = await sb.rpc('obs_unarchived_blobs_done', { p_site: e.siteId, p_id: id, p_urls: bloco })
      if (b.error) relatar('baixa_da_pendencia_falhou', { bloco: bloco.length })
    } catch {
      relatar('baixa_da_pendencia_falhou', { bloco: bloco.length })
    }
  })
  // F2: o que a F1 contou ao apagar, para o toast (nunca a contagem de antes). `linhas` só traz as tabelas com algo apagado, então chave ausente é zero
  // de verdade; mas resposta sem `linhas` (ou sem `watch.readings`) deixa o campo AUSENTE, nunca 0.
  const cont = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined)
  const linhas = ehObjeto(data.linhas) ? data.linhas : null
  const registrosDiarios = linhas ? cont(linhas.competitor_video_daily ?? 0) : undefined
  const daForja = linhas ? cont(linhas.competitor_readings ?? 0) : undefined
  const daWatch = ehObjeto(data.watch) ? cont(data.watch.readings) : undefined
  const leituras = daForja !== undefined && daWatch !== undefined ? daForja + daWatch : undefined
  return {
    ok: true, videos: Number.isFinite(videos) ? videos : 0, miniaturasPendentes: urls.length - apagadas, foraDoPrefixo: fora.length,
    // T12/Q4: o que sobrou no Blob, só quando o banco mandou a lista (sem `blob_urls` o número não existe, e a tela diz que não deu para conferir)
    ...(Array.isArray(data.blob_urls) ? { imagensRestantes: urls.length - apagadas } : {}),
    ...(registrosDiarios !== undefined ? { registrosDiarios } : {}), ...(leituras !== undefined ? { leituras } : {}),
  }
}

/** Caminho 2: o dono pediu a remoção (pausa na hora, a vaga é liberada, pode ser desfeita). */
export async function pedirRemocao(
  sb: SupabaseClient,
  e: { siteId: string; canalId: string; actorId: string; motivo: string },
): Promise<{ ok: true; jaPedido: boolean } | Falha> {
  const r = await chamar(sb, 'competitor_channel_request_removal', { p_site: e.siteId, p_channel: e.canalId, p_by: e.actorId, p_motivo: e.motivo })
  if ('ok' in r) return r
  if (!ehObjeto(r.data) || (r.data.status !== 'pedido' && r.data.status !== 'ja_pedido')) { relatar('resposta_invalida', {}); return falhaDe('inesperado') }
  return { ok: true, jaPedido: r.data.status === 'ja_pedido' }
}

/** Desfazer: despausa (se foi o pedido que pausou) e devolve a vaga. Página velha (canal já removido pelo comando) vira frase própria. */
export async function cancelarRemocao(
  sb: SupabaseClient,
  e: { siteId: string; canalId: string; actorId: string },
): Promise<{ ok: true; naoPedido: boolean; despausado: boolean } | Falha> {
  const r = await chamar(sb, 'competitor_channel_cancel_removal', { p_site: e.siteId, p_channel: e.canalId, p_by: e.actorId })
  if ('ok' in r) return r.codigo === 'canal_nao_encontrado' ? { ...r, frase: 'Este canal já foi removido. Atualize a página.' } : r
  if (!ehObjeto(r.data) || (r.data.status !== 'cancelado' && r.data.status !== 'nao_pedido')) { relatar('resposta_invalida', {}); return falhaDe('inesperado') }
  return { ok: true, naoPedido: r.data.status === 'nao_pedido', despausado: r.data.despausado === true }
}

export type NovaTentativa = { apagadas: number; pendentes: number; foraDoPrefixo: number; maisLinhas?: boolean; baixaFalhou?: number } | { porque: string }

/**
 * Nova tentativa diária das miniaturas pendentes de canais já removidos, de TODOS os sites. No máximo `o.maximo` URLs; `o.prazoMs` é o prazo
 * da tentativa inteira, contado de `o.agoraMs`. Nunca lança. Uma baixa de pendência (`obs_archive_blobs_done`) por lote.
 */
export async function retentarMiniaturasPendentes(
  sb: SupabaseClient,
  o: { agoraMs: number; maximo: number; prazoMs: number },
  deps: DepsDoBlob = {},
): Promise<NovaTentativa> {
  try {
    if (e2e()) return { porque: 'e2e' }
    if (!deps.apagarDoBlob && !process.env.BLOB_READ_WRITE_TOKEN) return { porque: 'sem_token' }
    const apagarDoBlob = deps.apagarDoBlob ?? apagarDoBlobPadrao
    // F1: a leitura que um disparo em voo gravou depois de apagar sem guardar (uma vez por execução; não conta no máximo de URLs)
    try {
      const v = await sb.rpc('obs_unarchived_watch_sweep', { p_agora: new Date(o.agoraMs).toISOString() })
      if (v.error) relatar('sweep_da_watch_falhou', {})
    } catch { relatar('sweep_da_watch_falhou', {}) }
    const lido = await sb.from('obs_archive_batches')
      .select('site_id, batch, channel_ref, blob_urls_pending')
      .eq('table_name', 'competitor_channels')
      .not('deleted_at', 'is', null)
      .not('blob_urls_pending', 'is', null)
      .not('blob_urls_pending', 'eq', '{}') // o banco grava '{}' (nunca nulo) ao zerar: sem isto os esvaziados ocupam os 50 primeiros
      .order('deleted_at', { ascending: true })
      .limit(50)
    if (lido.error) return { porque: 'leitura_falhou' }
    type Item = { urls: string[]; baixa: (urls: string[]) => Promise<{ error: unknown }> }
    const itens: Item[] = (Array.isArray(lido.data) ? lido.data : []).filter(ehObjeto)
      .map(l => ({
        urls: Array.isArray(l.blob_urls_pending) ? l.blob_urls_pending.filter((u): u is string => typeof u === 'string') : [],
        baixa: (urls: string[]) => Promise.resolve(sb.rpc('obs_archive_blobs_done', { p_site: String(l.site_id), p_batch: String(l.batch), p_channel_ref: String(l.channel_ref), p_urls: urls })),
      }))
      .filter(l => l.urls.length > 0)
    // F1: o que sobrou de canais apagados SEM guardar (outra tabela, outra baixa), dentro do mesmo máximo do dia
    try {
      const sem = await sb.from('obs_unarchived_deletions')
        .select('id, site_id, blob_urls_pending')
        .not('blob_urls_pending', 'eq', '{}')
        .order('deleted_at', { ascending: true })
        .limit(50)
      if (!sem.error) {
        for (const l of (Array.isArray(sem.data) ? sem.data : []).filter(ehObjeto)) {
          const urls = Array.isArray(l.blob_urls_pending) ? l.blob_urls_pending.filter((u): u is string => typeof u === 'string') : []
          if (urls.length > 0) itens.push({ urls, baixa: (u: string[]) => Promise.resolve(sb.rpc('obs_unarchived_blobs_done', { p_site: String(l.site_id), p_id: Number(l.id), p_urls: u })) })
        }
      } else relatar('leitura_sem_arquivo_falhou', {}) // (Yannis I-2) o PostgREST devolve `error` sem lançar: não pode falhar em verde
    } catch { relatar('leitura_sem_arquivo_falhou', {}) }

    const fim = o.agoraMs + o.prazoMs
    let apagadas = 0
    let pendentes = 0
    let foraDoPrefixo = 0
    let corte = false
    for (const l of itens) {
      const { apagar, fora } = soMiniaturasDoObservatorio(l.urls)
      foraDoPrefixo += fora.length
      const baixadas: string[] = []
      for (let i = 0; i < apagar.length && !corte; i += BLOCO) {
        const folga = o.maximo - apagadas
        if (folga <= 0 || (deps.agora ?? Date.now)() >= fim) { corte = true; break }
        const bloco = apagar.slice(i, i + Math.min(BLOCO, folga))
        try {
          await apagarDoBlob(bloco)
        } catch {
          relatar('blob_falhou_na_nova_tentativa', { bloco: bloco.length })
          corte = true
          break
        }
        baixadas.push(...bloco)
        apagadas += bloco.length
        if (bloco.length < Math.min(BLOCO, apagar.length - i)) corte = true // o máximo do dia cortou o bloco
      }
      if (baixadas.length > 0) {
        try {
          const b = await l.baixa(baixadas)
          if (b.error) relatar('baixa_da_pendencia_falhou', { urls: baixadas.length })
        } catch {
          relatar('baixa_da_pendencia_falhou', { urls: baixadas.length })
        }
      }
      pendentes += l.urls.length - baixadas.length
    }
    return { apagadas, pendentes, foraDoPrefixo }
  } catch {
    return { porque: 'inesperado' }
  }
}

const LIMITE_LINHAS = 50

/** M9 (D-M9-13): nova tentativa diária dos blobs dos canais removidos (obs_archive_channel_removals.blobs_pending). Só com OBS_ARQUIVO_LIMPEZA_BLOBS='on' (variável própria; a OBS_ARQUIVO_LIMPEZA_CANAL só liga a tela e a ação) e só em linha archive_decision='apagar'. Nunca lança. */
export async function retentarBlobsDeRemocoes(
  sb: SupabaseClient,
  o: { agoraMs: number; maximo: number; prazoMs: number },
  deps: DepsDoBlob & { env?: NodeJS.ProcessEnv } = {},
): Promise<NovaTentativa> {
  try {
    if ((deps.env ?? process.env).OBS_ARQUIVO_LIMPEZA_BLOBS !== 'on') return { porque: 'flag_desligada' }
    if (e2e()) return { porque: 'e2e' }
    if (!deps.apagarDoBlob && !process.env.BLOB_READ_WRITE_TOKEN) return { porque: 'sem_token' }
    const apagarDoBlob = deps.apagarDoBlob ?? apagarDoBlobPadrao
    const agora = deps.agora ?? Date.now
    const lido = await sb.from('obs_archive_channel_removals')
      .select('site_id, channel_ref, blobs_pending')
      .eq('archive_decision', 'apagar')
      .not('blobs_pending', 'eq', '{}')
      .order('decided_at', { ascending: true })
      .limit(50)
    if (lido.error) return { porque: 'leitura_falhou' }
    let apagadas = 0, foraDoPrefixo = 0, baixaFalhou = 0
    const linhas = (Array.isArray(lido.data) ? lido.data : []).filter(ehObjeto)
    const urlsDe = (r: Record<string, unknown>): string[] => Array.isArray(r.blobs_pending) ? r.blobs_pending.filter((u): u is string => typeof u === 'string') : []
    const total = linhas.reduce((n, r) => n + urlsDe(r).length, 0)   // conta também as linhas que o máximo ou o prazo deixam para depois
    const resultado = (): NovaTentativa => ({
      apagadas, pendentes: total - apagadas, foraDoPrefixo,
      ...(linhas.length >= LIMITE_LINHAS ? { maisLinhas: true } : {}), ...(baixaFalhou > 0 ? { baixaFalhou } : {}),
    })
    for (const r of linhas) {
      const urls = urlsDe(r)
      const { apagar, fora } = soMiniaturasDoObservatorio(urls)
      foraDoPrefixo += fora.length
      for (let i = 0; i < apagar.length; i += BLOCO) {
        const folga = o.maximo - apagadas
        if (folga <= 0 || agora() - o.agoraMs > o.prazoMs) return resultado()
        const bloco = apagar.slice(i, i + Math.min(BLOCO, folga))
        try {
          await apagarDoBlob(bloco)
          const b = await sb.rpc('obs_archive_removal_blobs_done', { p_site: String(r.site_id), p_ref: String(r.channel_ref), p_urls: bloco })
          if (b.error) baixaFalhou++; else apagadas += bloco.length
        } catch { /* fica pendente; a próxima rodada tenta */ }
      }
    }
    return resultado()
  } catch {
    return { porque: 'erro' }
  }
}
