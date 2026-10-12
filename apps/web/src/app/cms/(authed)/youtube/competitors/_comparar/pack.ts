/**
 * O que vai do servidor para o navegador na comparação entre dois canais: só dados simples (nenhuma função, nenhum
 * `undefined`), com os treze números de TODOS os canais do site, porque a posição no nicho precisa de todos e trocar o
 * seletor não vai à rede (D14). O par (relações, Leitura rápida, régua) é calculado no navegador a partir daqui.
 *
 * Lê o conjunto inteiro do site: `obs.ownChannels()` é a primeira chamada e LANÇA no conjunto de um canal, em vez de
 * devolver números de um canal só.
 */
import * as Sentry from '@sentry/nextjs'
import type { Observatory } from '@/lib/youtube/observatorio'
import { link } from '@/lib/youtube/observatorio/links'
import { DAY } from '@/lib/youtube/observatorio/time'
import { ownChannelHref } from '../_chrome/own-channels'
import { numerosDoCanal, type AvisoNumero, type Numero, type NumeroId } from './numeros-model'

/** `abre`: o Histórico sabe abrir este vídeo. Vídeo sem data de publicação não está no conjunto do site (`obs.video` não o acha): aparece sem link. O destino do link depende do par e é montado pela tela. */
export interface Top5Item { id: string; abre: boolean; titulo: string; thumb: string | null; viewsTexto: string; idadeTexto: string; short: boolean }
export interface Pub90Item { t: number; fmt: 'long' | 'short' | null; dataTexto: string }

export interface CanalPack {
  id: string; name: string; own: boolean; niche: string | null; nicheLabel: string | null
  avatar: string | null; ini: string; color: string; subsTexto: string | null
  semVideos: boolean
  /** Tem ao menos um vídeo com data de publicação: sem isso a faixa de 90 dias não tem o que marcar (spec 18.7). */
  comDatas: boolean
  /** A data exata (ms) do vídeo mais novo com data, de qualquer formato; `null` sem vídeo datado. É a entrada que a lista e o menu usam para escolher "o meu canal" (`escolherPrincipal`): nunca dias inteiros. */
  ultimo: number | null
  /** "Abrir o canal …": página do concorrente; painel do canal próprio com vídeos; null sem página (canal próprio sem vídeos). */
  href: string | null
  numeros: Record<NumeroId, Numero>
  top5: Top5Item[]
  /** "5 de 133 vídeos guardados, por views." | "Só 3 vídeos com contagem de views." | "Este canal não tem vídeos." */
  top5Nota: string
  /** Um item por vídeo com data nos últimos 90 dias. `t` fica entre `inicio90` e `now`: o traço do vídeo de 90 dias e meio encosta no início do eixo e uma estreia agendada, em hoje; a data escrita é a real. */
  pub90: Pub90Item[]
  pub90Nota: string
}

export interface CompararPack {
  now: number; inicio90: number
  /** Semanas da janela do ritmo (`RULES.habit.weeks`): a frase "não publicou em N semanas" usa o mesmo número da conta. */
  semanasRitmo: number
  /** Os quatro rótulos do eixo de 90 dias: início, +30, +60 e hoje. */
  eixo: [string, string, string, string]
  canais: CanalPack[]
  /** Os canais próprios (ordem do motor), depois os concorrentes por inscritos, maior primeiro (inscritos escondidos por último). */
  ordem: string[]
}

const thumbDe = (ytId: string) => (ytId ? `https://i.ytimg.com/vi/${encodeURIComponent(ytId)}/mqdefault.jpg` : null)

/**
 * Números em estado inesperado já viraram "não medido" na tela; aqui vai UM aviso por montagem do pacote (nunca um por
 * canal × número: uma tela de 75 canais mandaria quase mil eventos por abertura), com a pilha da primeira exceção e os
 * números afetados agregados nos dados do evento. Um bug de código aparece no Sentry com pilha, não só como "não pôde
 * ser calculado" em verde.
 */
const avisarSentry = (avisos: AvisoNumero[]) => {
  if (!avisos.length) return
  const numeros: Record<string, number> = {}
  for (const a of avisos) numeros[a.numero] = (numeros[a.numero] ?? 0) + 1
  const canais = [...new Set(avisos.map(a => a.canal))].slice(0, 10)
  Sentry.captureException(avisos[0]!.excecao, { level: 'warning', fingerprint: ['comparar-numero-invalido'], extra: { total: avisos.length, numeros, canais, primeiro: avisos[0]!.erro } })
}

export function buildCompararPack(obs: Observatory, avisar: (avisos: AvisoNumero[]) => void = avisarSentry): CompararPack {
  const avisos: AvisoNumero[] = []
  const owns = obs.ownChannels() // lança no conjunto de um canal: é a guarda de escopo
  const F = obs.fmt, D = obs.date
  const now = obs.NOW, inicio90 = now - 90 * DAY

  const porCanal = new Map<string, typeof obs.videos>()
  for (const v of obs.videos) { const l = porCanal.get(v.ch); if (l) l.push(v); else porCanal.set(v.ch, [v]) }

  const canais: CanalPack[] = obs.channels.map(ch => {
    const vids = porCanal.get(ch.id) ?? []
    const semData = ch.undated
    const guardados = vids.length + semData.length
    const semVideos = guardados === 0

    /* ---- os cinco mais vistos: vídeos com data e vídeos sem data, todos com contagem de views (nunca como 0) */
    type Cand = { id: string; titulo: string; ytId: string; views: number; short: boolean; idade: string; pub: number; abre: boolean }
    const cand: Cand[] = [
      ...vids.flatMap(v => (v.views == null ? [] : [{ id: v.id, titulo: v.title, ytId: v.ytId, views: v.views, short: v.fmt === 'short', idade: F.age(v), pub: v.pub, abre: true }])),
      ...semData.flatMap(u => (u.views == null ? [] : [{ id: u.id, titulo: u.title ?? '', ytId: u.ytId, views: u.views, short: u.isShort === true, idade: 'sem data', pub: Number.NEGATIVE_INFINITY, abre: false }])),
    ].sort((a, b) => b.views - a.views || b.pub - a.pub || a.id.localeCompare(b.id))
    const top5: Top5Item[] = cand.slice(0, 5).map(c => ({
      id: c.id, abre: c.abre, titulo: c.titulo.trim() ? c.titulo : 'sem título', thumb: thumbDe(c.ytId),
      viewsTexto: c.views === 1 ? '1 view' : `${F.num(c.views)} views`, idadeTexto: c.idade, short: c.short,
    }))
    // em backfill o motor busca os mais recentes primeiro, mas o canal pode ter mais vídeos: o aviso vale para qualquer ramo
    const aindaSincroniza = ch.sync.state === 'backfill' ? ' A sincronização do canal ainda não terminou: pode haver mais vídeos.' : ''
    const top5Nota = semVideos ? (aindaSincroniza ? 'A primeira sincronização ainda não terminou: os vídeos aparecem quando ela terminar.' : 'Este canal não tem vídeos.')
      : cand.length === 0 ? `Nenhum vídeo tem contagem de views.${aindaSincroniza}`
      : cand.length < 5 ? `Só ${cand.length === 1 ? '1 vídeo' : `${cand.length} vídeos`} com contagem de views.${aindaSincroniza}`
      : `5 de ${guardados} vídeos guardados, por views.${aindaSincroniza}`

    /* ---- a publicação em 90 dias: o mesmo corte do número "longos em 90 dias" (ageDays <= 90, D9) */
    const v90 = vids.filter(v => v.ageDays <= 90).sort((a, b) => a.pub - b.pub || a.id.localeCompare(b.id))
    const pub90: Pub90Item[] = v90.map(v => ({ t: Math.min(now, Math.max(v.pub, inicio90)), fmt: v.isShort === null ? null : v.fmt, dataTexto: D.dmhm(v.pub) }))
    let pub90Nota: string
    if (semVideos) pub90Nota = 'ainda sem vídeos sincronizados'
    else if (vids.length === 0) pub90Nota = 'Os vídeos deste canal ainda não têm data de publicação.'
    else if (v90.length === 0) {
      const ult = Math.max(...vids.map(v => v.pub))
      pub90Nota = `Nenhum vídeo nos últimos 90 dias; o último foi em ${D.dmOrDmy(ult)}, ${D.ago(ult)}.${aindaSincroniza}`
    } else {
      const nl = pub90.filter(p => p.fmt === 'long').length, ns = pub90.filter(p => p.fmt === 'short').length, nc = pub90.filter(p => p.fmt === null).length
      pub90Nota = `${F.plural(nl, 'longo', 'longos')} e ${F.plural(ns, 'Short', 'Shorts')} nos últimos 90 dias${nc ? ` e ${nc} de formato não confirmado` : ''}.${aindaSincroniza}`
    }

    return {
      id: ch.id, name: ch.name, own: ch.own, niche: ch.niche, nicheLabel: ch.niche ? obs.nicheLabel(ch.niche) : null,
      avatar: ch.avatar ?? null, ini: ch.ini, color: ch.color, subsTexto: ch.subs == null ? null : F.subs(ch.subs),
      semVideos, comDatas: vids.length > 0, ultimo: vids.length ? vids.reduce((m, v) => (v.pub > m ? v.pub : m), -Infinity) : null,
      // concorrente sempre tem página (sem vídeos ela diz "ainda não tem vídeos sincronizados"); o canal próprio só com vídeos
      href: ch.own ? (semVideos ? null : ownChannelHref(ch.id)) : link.canal(ch.id),
      numeros: numerosDoCanal(obs, ch.id, a => avisos.push(a)), top5, top5Nota, pub90, pub90Nota,
    }
  })

  avisar(avisos)

  const comps = obs.channels.filter(c => !c.own)
    .sort((a, b) => (a.subs == null ? 1 : 0) - (b.subs == null ? 1 : 0) || (b.subs ?? 0) - (a.subs ?? 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  return {
    now, inicio90, semanasRitmo: obs.RULES.habit.weeks,
    eixo: [D.dm(inicio90), D.dm(inicio90 + 30 * DAY), D.dm(inicio90 + 60 * DAY), `hoje, ${D.dm(now)}`],
    canais, ordem: [...owns.map(c => c.id), ...comps.map(c => c.id)],
  }
}
