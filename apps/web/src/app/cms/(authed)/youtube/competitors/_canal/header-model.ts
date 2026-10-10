/**
 * Modelo do cabeçalho da página do canal (spec 5.3 e 5.9): a faixa de seis números, as doze de "Todos os números" e a
 * linha de sincronização. Tudo vem do motor (`obs`); o que o motor não tem é derivado aqui, com a base escrita para o ⓘ.
 * Dado ausente é `value: null` com a frase em `missing`: nunca zero, nunca traço. Zero medido é "0".
 *
 * Não chama nada que agregue entre canais (o conjunto de um canal lança nisso): só `channel`, `videos`, `channelStats`,
 * `cadence`, `fmt`, `date`, `RULES`, `nicheLabel`, `median` e `theme`.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import type { ObsChannel } from '@/lib/youtube/observatorio/types'
import { WD } from '@/lib/youtube/observatorio/time'
import { vpdText } from './numeros'

/** Uma célula de número. `value` null = sem dado: a tela mostra `missing` em .obs-ch-nm. `base` é o texto do ⓘ e nunca é vazio. */
export interface NumCell { key: string; value: string | null; missing: string | null; label: string; n: string | null; base: string }

export interface CanalHeaderView {
  id: string; name: string; fullName: string; avatar: string | null; ini: string; color: string; lang: string
  niche: string | null; nicheLabel: string | null; handle: string | null; url: string
  /** 6, nesta ordem: subs, growth30, ritmo, vpd, engajamento, acima2x */
  faixa: NumCell[]
  /** 12, na ordem do spec 5.3 */
  todos: NumCell[]
  sync: { tone: 'ok' | 'warn' | 'danger'; text: string; banner: string | null }
  counts: { total: number; tracked: number; pinnedOld: number; older: number; undated: number }
  /** A linha de resultado à direita das abas: "133 vídeos: 61 longos, 71 Shorts, 1 com formato não confirmado." */
  result: string
  backfill: { done: number; total: number } | null
}

const WAIT = 'quando a sincronização terminar'

function durText(sec: number): string {
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  const p2 = (n: number) => (n < 10 ? '0' : '') + n
  return h ? `${h}:${p2(m)}:${p2(r)}` : `${p2(m)}:${p2(r)}`
}

export function buildCanalHeader(obs: Observatory, channelId: string): CanalHeaderView | null {
  const ch: ObsChannel | undefined = obs.channel(channelId)
  if (!ch) return null
  const F = obs.fmt, D = obs.date, R = obs.RULES
  const vids = obs.videos.filter(v => v.ch === ch.id)
  const trackedOf = (f: 'long' | 'short') => vids.filter(v => v.tracked && v.fmt === f)
  const recent = (f: 'long' | 'short') => trackedOf(f).filter(v => v.ageDays <= 90)
  const noun = (n: number, one: string, many: string) => F.plural(n, one, many)
  const backfill = ch.sync.state === 'backfill'

  const SL = obs.channelStats(ch.id, 'long'), SS = obs.channelStats(ch.id, 'short')
  const kl = obs.cadence(ch.id, 'long'), ks = obs.cadence(ch.id, 'short')
  const weak = (n: number) => (n < R.weakBase ? `n = ${n}` : null)

  /** Em sincronização inicial nenhuma célula (fora os inscritos) tem número: a frase única, e a base segue escrita. */
  const cell = (key: string, label: string, v: { value: string | null; missing: string; n?: number | null; base: string }): NumCell => {
    if (backfill && key !== 'subs') return { key, value: null, missing: WAIT, label, n: null, base: v.base }
    if (v.value == null) return { key, value: null, missing: v.missing, label, n: null, base: v.base }
    return { key, value: v.value, missing: null, label, n: v.n != null ? weak(v.n) : null, base: v.base }
  }

  /* ---------------------------------------------------------------- faixa */
  const subs = cell('subs', 'inscritos', {
    value: ch.subs == null ? null : F.subs(ch.subs), missing: 'inscritos ocultos pelo canal',
    base: ch.subs == null ? 'o canal esconde a contagem de inscritos no YouTube' : 'arredondado pelo YouTube a 3 algarismos',
  })

  const g = SL.growth30
  const gSnap = (t: number | undefined) => ch.snapshots.find(x => x.t === t)
  const gFrom = gSnap(g.from), gTo = gSnap(g.to)
  const gValue = g.pending ? null
    : g.withinRounding ? '≈ 0'
    : g.pct == null ? null
    : g.pct === 0 ? '0,0%' : `${g.pct > 0 ? '+' : '−'}${F.dec1(Math.abs(g.pct * 100))}%`
  const growth30 = cell('growth30', 'inscritos em 30 dias', {
    value: gValue,
    missing: g.pending ? 'sem contagem de 30 dias atrás' : 'sem percentual: o canal não tinha inscritos na contagem anterior',
    base: g.pending
      ? `precisa de duas contagens de inscritos com 30 dias entre elas (${g.pending})`
      : `de ${gFrom ? F.int(gFrom.subs) : '?'} em ${D.dm(g.from!)} para ${gTo ? F.int(gTo.subs) : '?'} em ${D.dm(g.to!)}; arredondamento do YouTube: ${g.roundingText}`,
  })

  const ritmo = cell('ritmo', 'longos + Shorts por semana', {
    value: `${F.dec1(kl.pw)} + ${F.dec1(ks.pw)}`, missing: '',
    base: `longos + Shorts por semana, média de ${R.habit.weeks} semanas (${noun(kl.n, 'longo', 'longos')}, ${noun(ks.n, 'Short', 'Shorts')})`,
  })

  const vpdOf = (f: 'long' | 'short', S: typeof SL, word: string, one: string) => cell(f === 'long' ? 'vpd' : 'vpdShorts', `views/dia nos ${word}`, {
    value: vpdText(S.vpdMedian, F.num), n: S.vpdN,
    missing: f === 'short' && trackedOf('short').length === 0 ? 'nenhum Short acompanhado' : 'sem contagem diária ainda',
    base: S.vpdN === 0 ? `mediana dos ${word} acompanhados; nenhum tem contagem diária ainda`
      : `mediana em ${noun(S.vpdN, `${one} acompanhado`, `${word} acompanhados`)}, ${S.vpdWindow}`,
  })
  const vpd = vpdOf('long', SL, 'longos', 'longo')

  const engOf = (f: 'long' | 'short', S: typeof SL, word: string, one: string) => {
    const e = S.engagement, any90 = recent(f).length > 0
    return cell(f === 'long' ? 'engajamento' : 'engShorts', `engajamento nos ${word}`, {
      value: e.median == null ? null : F.dec1(e.median * 100) + '%', n: e.n,
      missing: !any90 ? (f === 'long' ? 'nenhum longo em 90 dias' : 'nenhum Short em 90 dias')
        : `nenhum ${f === 'long' ? 'longo' : 'Short'} de 90 dias com curtidas e comentários medidos`,
      base: `(curtidas + comentários) ÷ views, mediana em ${noun(e.n, one, word)} de até 90 dias`,
    })
  }
  const engajamento = engOf('long', SL, 'longos', 'longo')

  const acima2x = cell('acima2x', 'vídeos acima de 2× em 90 dias', {
    value: String(SL.outliers90), missing: '',
    base: `${SL.outliers90} de ${SL.pctOutliersN} longos de até 90 dias com múltiplo de 2× ou mais`,
  })

  /* ---------------------------------------------------------------- todos os números */
  const trocas30 = cell('trocas30', 'trocas em 30 dias', {
    value: String(SL.changes30), missing: '', base: 'título e thumbnail, últimos 30 dias',
  })

  const vpdPorMil = cell('vpdPorMil', 'views/dia por mil inscritos', {
    value: SL.perMilSubs == null ? null : F.dec1(SL.perMilSubs), n: SL.vpdN,
    missing: ch.subs == null ? 'inscritos ocultos pelo canal' : 'sem contagem diária ainda',
    base: 'views/dia nos longos ÷ milhares de inscritos',
  })

  const vpdShorts = vpdOf('short', SS, 'Shorts', 'Short')
  const engShorts = engOf('short', SS, 'Shorts', 'Short')

  const multTipico = cell('multTipico', 'múltiplo típico em 90 dias', {
    value: SL.typicalMult == null ? null : F.mult(SL.typicalMult), n: SL.typicalMultN,
    missing: 'sem base: nenhum longo com múltiplo em 90 dias',
    base: `mediana do múltiplo em ${noun(SL.typicalMultN, 'longo', 'longos')} de até 90 dias`,
  })

  const best = SL.bestOutlier, below = SL.maxMultBelowMin
  const bestVideo = best ? best.video : below ? obs.video(below.id) : undefined
  const maiorMult = cell('maiorMult', 'maior múltiplo em 90 dias', {
    value: best && best.mult.value != null ? `${F.mult(best.mult.value)} a mediana` : below ? below.label : null,
    missing: 'sem base',
    base: bestVideo?.title.trim() ? bestVideo.title : 'nenhum longo de até 90 dias com múltiplo calculado',
  })

  const lastKl = kl.lastUpload, lastKs = ks.lastUpload
  const lastAt = lastKl == null ? lastKs : lastKs == null ? lastKl : Math.max(lastKl, lastKs)
  const ultimoVideo = cell('ultimoVideo', 'desde o último vídeo', {
    value: lastAt == null ? null : D.ago(lastAt), missing: 'nenhum vídeo guardado',
    base: lastAt == null ? 'o canal não tem vídeo com data de publicação guardado' : `publicado em ${D.dm(lastAt)} ${D.hm(lastAt)} (São Paulo)`,
  })

  const hb = kl.habit
  const habito = cell('habito', 'dia e hora em que mais publica', {
    value: hb.costuma ? `${WD[hb.dow!]} às ${String(hb.hour).padStart(2, '0')}:00` : null,
    missing: hb.text,
    base: hb.costuma ? `${hb.n} de ${hb.total} longos em ${R.habit.weeks} semanas`
      : hb.n ? `${noun(hb.n, 'longo', 'longos')} em ${R.habit.weeks} semanas, sem horário que se repita o bastante`
      : `nenhum longo publicado em ${R.habit.weeks} semanas`,
  })

  const durs = trackedOf('long').map(v => v.dur).filter((d): d is number => d != null)
  const durMed = obs.median(durs)
  const duracaoMediana = cell('duracaoMediana', 'duração mediana dos longos', {
    value: durMed == null ? null : durText(durMed), missing: 'sem duração nos longos',
    base: durMed == null ? 'nenhum longo acompanhado tem a duração guardada' : `mediana em ${noun(durs.length, 'longo acompanhado', 'longos acompanhados')}`,
  })

  const tracked = vids.filter(v => v.tracked)
  const withViews = tracked.filter(v => v.views != null)
  const viewsSomadas = cell('viewsSomadas', 'views somadas dos acompanhados', {
    value: withViews.length ? F.num(withViews.reduce((a, v) => a + v.views!, 0)) : null, missing: 'sem contagem',
    base: `soma de ${noun(withViews.length, 'vídeo acompanhado', 'vídeos acompanhados')}; ${tracked.length - withViews.length ? `${tracked.length - withViews.length} sem contagem ficam fora` : 'nenhum fica sem contagem'}`,
  })

  const viewsOf = (f: 'long' | 'short') => trackedOf(f).map(v => v.views).filter((x): x is number => x != null)
  const vl = viewsOf('long'), vs = viewsOf('short'), ml = obs.median(vl), ms = obs.median(vs)
  const medParts = [ml != null ? `${F.num(ml)} longos` : null, ms != null ? `${F.num(ms)} Shorts` : null].filter((x): x is string => x != null)
  const medianaViews = cell('medianaViews', 'mediana de views, longos e Shorts', {
    value: medParts.length ? medParts.join(' · ') : null, missing: 'sem contagem',
    base: `${noun(vl.length, 'longo', 'longos')} e ${noun(vs.length, 'Short', 'Shorts')} acompanhados`,
  })

  const longs90 = recent('long'), themeCount = new Map<string, number>()
  for (const v of longs90) if (v.theme) themeCount.set(v.theme, (themeCount.get(v.theme) ?? 0) + 1)
  const top = [...themeCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  const topOk = top != null && top[1] >= R.theme.minCount && top[1] / longs90.length >= R.theme.minShare
  const tema = cell('tema', 'tema dominante', {
    value: topOk ? (obs.theme(top[0])?.label ?? top[0]) : null, missing: 'sem tema ainda',
    base: topOk ? `${top[1]} de ${noun(longs90.length, 'longo', 'longos')} de até 90 dias`
      : `só vale um tema em ${R.theme.minCount} longos ou mais e em ${Math.round(R.theme.minShare * 100)}% ou mais dos ${noun(longs90.length, 'longo', 'longos')} de até 90 dias`,
  })

  /* ---------------------------------------------------------------- contagens, sincronização, resultado */
  const undated = ch.undated
  const counts = {
    total: vids.length + undated.length,
    tracked: vids.filter(v => v.tracked === true).length,
    pinnedOld: vids.filter(v => v.pinned === true && !v.tracked).length,
    older: vids.filter(v => !v.tracked && !v.pinned).length,
    undated: undated.length,
  }
  const parts: string[] = []
  if (counts.tracked) parts.push(`${counts.tracked} ${counts.tracked === 1 ? 'acompanhado' : 'acompanhados'}`)
  if (counts.pinnedOld) parts.push(`${counts.pinnedOld} ${counts.pinnedOld === 1 ? 'fixado antigo' : 'fixados antigos'}`)
  if (counts.older) parts.push(`${counts.older} ${counts.older === 1 ? 'mais antigo' : 'mais antigos'} sem contagem diária`)
  if (counts.undated) parts.push(`${counts.undated} sem data de publicação`)
  const tail = counts.total ? ` · ${noun(counts.total, 'vídeo', 'vídeos')}: ${parts.join(', ')}` : ' · nenhum vídeo guardado'

  const s = ch.sync, last = s.last
  const stamp = (t: number) => `${D.dm(t)} ${D.hm(t)}`
  let tone: CanalHeaderView['sync']['tone'] = 'ok', text: string, banner: string | null = null
  if (s.state === 'backfill') {
    const p = s.backfill
    text = p ? `Sincronizando: ${p.done} de ${p.total} vídeos` : 'Sincronizando os vídeos do canal'
    banner = `${p ? `Sincronizando: ${p.done} de ${p.total} vídeos` : 'Sincronizando os vídeos do canal'}. Os números aparecem quando a sincronização terminar.`
  } else if (s.state === 'erro') {
    tone = 'danger'
    const reason = ch.sync.problemLabel ?? 'erro sem mensagem registrada'
    text = `Erro: ${reason}. ${last == null ? 'Este canal nunca sincronizou com sucesso.' : `A última sincronização boa foi ${stamp(last)}.`}${tail}`
    banner = `Erro: a última sincronização falhou${s.errorSince != null ? ` em ${stamp(s.errorSince)}` : ''}. ${last == null ? 'Este canal nunca sincronizou com sucesso.' : `Os números são de ${D.dm(last)}.`}`
  } else if (s.state === 'atrasado') {
    tone = 'warn'
    text = last == null ? `Sincronização atrasada: este canal nunca sincronizou com sucesso${tail}` : `Sincronização atrasada: a última foi ${stamp(last)}${tail}`
    banner = last == null ? 'Atenção: este canal nunca sincronizou com sucesso. A sincronização está atrasada.' : `Atenção: dados de ${stamp(last)}. A sincronização está atrasada.`
  } else {
    text = last == null ? `Este canal nunca sincronizou com sucesso${tail}` : `Sincronizado ${D.ago(last)} (${stamp(last)})${tail}`
  }

  const all = [...vids.map(v => v.isShort), ...undated.map(u => u.isShort)]
  const nLong = all.filter(x => x === false).length, nShort = all.filter(x => x === true).length, nUnk = all.filter(x => x == null).length
  const rparts = [nLong ? noun(nLong, 'longo', 'longos') : null, nShort ? noun(nShort, 'Short', 'Shorts') : null, nUnk ? `${nUnk} com formato não confirmado` : null].filter((x): x is string => x != null)
  const result = counts.total ? `${noun(counts.total, 'vídeo', 'vídeos')}: ${rparts.join(', ')}.` : 'Nenhum vídeo guardado.'

  return {
    id: ch.id, name: ch.name, fullName: ch.fullName, avatar: ch.avatar ?? null, ini: ch.ini, color: ch.color, lang: ch.lang,
    niche: ch.niche, nicheLabel: ch.niche ? obs.nicheLabel(ch.niche) : null, handle: ch.handle ? ch.handle : null, url: ch.url,
    faixa: [subs, growth30, ritmo, vpd, engajamento, acima2x],
    todos: [trocas30, vpdPorMil, vpdShorts, engShorts, multTipico, maiorMult, ultimoVideo, habito, duracaoMediana, viewsSomadas, medianaViews, tema],
    sync: { tone, text, banner }, counts, result, backfill: backfill ? s.backfill : null,
  }
}
