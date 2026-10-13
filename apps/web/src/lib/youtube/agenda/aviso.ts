import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications/create'
import { getSiteOwners, logSemDestinatario, type ISiteOwner } from '@/lib/notifications/get-site-owners'
import { link } from '@/lib/youtube/observatorio/links'
import { chaveDoPeriodo } from './periodo'
import { comPrazo } from './relogio'
import { resumoTecnico } from './motivos'

/**
 * O e-mail de aviso ao dono (A5 · E16, Tarefa 16). Vai pelo MESMO caminho do aviso de canal em erro de `competitor-sync-batch.ts`:
 * `createNotification` com `defaultChannels: ['email']`; o adaptador de e-mail (`notifications/adapters/email.ts`) escapa o HTML e
 * limpa o assunto na hora do envio. Aqui o texto de fora (rótulo, frase) só é limpo de controles e cortado, e NÃO escapado de novo
 * (escapar duas vezes mostraria `&amp;` ao dono).
 */
export type ChaveAviso = 'leitura_horaria_parada' | 'tarefa_esgotada'
/** `frase` vem do veredito ou de `fraseDoMotivo`: frase fixa e números. `tarefa` é o rótulo da tarefa. */
export interface Aviso { siteId: string; chave: ChaveAviso; tarefa: string; frase: string }
export interface ContagemAviso { enviados: number; suprimidos: number; falharam: number; semDestinatario: number }

const TIPO = 'youtube.observatorio_coleta'
const ROTULO_MAX = 80
const FRASE_MAX = 400

// A mesma limpeza e o mesmo corte de `clip` em competitor-sync-batch.ts (lá é privada; o arquivo é de outra trilha): sem controles, reticências.
const clip = (v: string, max: number): string => {
  const t = v.replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

const chaveDe = (a: Aviso, agoraMs: number): string =>
  'obs-agenda-' + a.chave + '-' + clip(a.tarefa, ROTULO_MAX) + '-' + a.siteId + '-' + chaveDoPeriodo('dia', agoraMs)

function textoDe(a: Aviso, onde: string): { title: string; message: string } {
  const rotulo = clip(a.tarefa, ROTULO_MAX)
  const frase = clip(a.frase, FRASE_MAX).replace(/[.\s]+$/, '')
  if (a.chave === 'leitura_horaria_parada') {
    return {
      title: 'A leitura horária do Observatório parou',
      message: frase + '. As horas sem leitura não são recuperadas. Confira a coleta no CMS, em ' + onde + '.',
    }
  }
  return {
    title: 'A tarefa ' + rotulo + ' do Observatório esgotou as tentativas',
    message: frase + '. A tarefa não roda de novo neste período. Confira a coleta no CMS, em ' + onde + '.',
  }
}

/** Nunca lança. Um e-mail por tarefa, por tipo, por site e por dia de São Paulo, por mais disparos vermelhos que haja. */
export async function avisarDono(
  sb: SupabaseClient,
  avisos: readonly Aviso[],
  o: { agoraMs: number; prazoMs: number },
): Promise<ContagemAviso> {
  const contagem: ContagemAviso = { enviados: 0, suprimidos: 0, falharam: 0, semDestinatario: 0 }
  if (avisos.length === 0) return contagem
  // O mesmo interruptor do aviso de canal em erro: 'false' desliga (apagada a variável, liga).
  if (process.env.COMPETITOR_NOTIFICATIONS_ENABLED === 'false') { contagem.suprimidos = avisos.length; return contagem }

  let cancelado = false
  const falhou = (a: Aviso, err?: unknown): void => {
    contagem.falharam++
    Sentry.captureMessage('aviso ao dono não criado', {
      level: 'warning',
      tags: { component: 'sync-youtube', mode: 'agenda-aviso' },
      extra: { chave: a.chave, ...(err === undefined ? {} : resumoTecnico(err)) },
    })
  }

  const trabalho = async (): Promise<void> => {
    // Um por chave: repetido na mesma chamada é suprimido.
    const porChave = new Map<string, Aviso>()
    for (const a of avisos) {
      const k = chaveDe(a, o.agoraMs)
      if (porChave.has(k)) contagem.suprimidos++
      else porChave.set(k, a)
    }
    let ja = new Set<string>()
    try {
      const { data, error } = await sb.from('notifications').select('dedup_key').in('dedup_key', [...porChave.keys()])
      if (!error && Array.isArray(data)) ja = new Set(data.flatMap(d => (typeof d === 'object' && d !== null && 'dedup_key' in d && typeof d.dedup_key === 'string' ? [d.dedup_key] : [])))
    } catch { /* sem a consulta, tenta criar: o índice único do banco impede a repetição */ }

    const onde = link.canais()
    const donos = new Map<string, ISiteOwner[]>()
    for (const [chave, a] of porChave) {
      if (cancelado) return
      if (ja.has(chave)) { contagem.suprimidos++; continue }
      let lista = donos.get(a.siteId)
      if (!lista) {
        try { lista = await getSiteOwners(sb, a.siteId) } catch (err) { falhou(a, err); continue }
        donos.set(a.siteId, lista)
      }
      if (lista.length === 0) { logSemDestinatario('youtube-agenda-aviso', a.siteId); contagem.semDestinatario++; continue }
      const { title, message } = textoDe(a, onde)
      for (const dono of lista) {
        if (cancelado) return
        try {
          const r = await createNotification({
            site_id: a.siteId, user_id: dono.userId, type: TIPO, domain: 'youtube', priority: 3,
            title, message, action_href: onde, dedup_key: chave,
            defaultChannels: ['email'],
          })
          if (!r.success) falhou(a)
          else if (r.suppressed) contagem.suprimidos++
          else contagem.enviados++
        } catch (err) { falhou(a, err) }
      }
    }
  }

  try {
    const r = await comPrazo(trabalho(), o.prazoMs)
    if ('estourou' in r) {
      cancelado = true
      Sentry.captureMessage('aviso ao dono passou do tempo', { level: 'warning', tags: { component: 'sync-youtube', mode: 'agenda-aviso' } })
    }
  } catch (err) {
    cancelado = true
    Sentry.captureMessage('aviso ao dono falhou', { level: 'warning', tags: { component: 'sync-youtube', mode: 'agenda-aviso' }, extra: resumoTecnico(err) })
  }
  return { ...contagem }
}
