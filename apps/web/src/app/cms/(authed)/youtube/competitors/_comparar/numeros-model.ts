/**
 * Os treze números de um canal na comparação entre dois canais (spec 18.4 e 18.9, com D9 e D10 do plano). Puro: só lê o
 * canal pedido (`channel`, `videos`, `channelStats`, `cadence`, `changesIn`), nunca o que agrega entre canais.
 *
 * Regras que valem para todos:
 * - `x` null = não medido, e a frase do motivo vem em `motivo`; `x` 0 = zero medido, escrito "0". Nunca o contrário.
 * - texto null ⇔ x null ⇔ motivo preenchido. O que o motor já calcula (`channelStats`, `cadence`) é reusado, não refeito:
 *   o mesmo canal mostra o mesmo número aqui, na lista de Canais e no cabeçalho do canal. As contas que o cabeçalho
 *   também faz moram em `_canal/numeros.ts` e os dois lugares chamam a mesma função.
 * - Canal em primeira sincronização: só os inscritos são medidos (como o cabeçalho). Canal sem vídeos: "sem vídeos".
 * - Canal próprio: views por dia, views por dia por mil, inscritos em 30 dias e trocas são "não medido" com o motivo
 *   (A4 liga a coleta diária; as trocas ficam no A/B Lab), mesmo que o conjunto traga algum valor: a regra é do canal.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import { DAY } from '@/lib/youtube/observatorio/time'
import { acima2x, durText, duracaoMediana, trocas30, viewsMediana, vpdText } from '../_canal/numeros'

export type NumeroId = 'inscritos' | 'inscritos30' | 'longosAcomp' | 'longos90' | 'ritmo' | 'diasUltimo' | 'medianaViews' | 'vpd' | 'vpdPorMil' | 'engajamento' | 'acima2x' | 'duracao' | 'trocas30'

/** As treze, na ordem do spec 18.4 (Tamanho, Publicação, Desempenho). */
export const NUMEROS: readonly NumeroId[] = ['inscritos', 'inscritos30', 'longosAcomp', 'longos90', 'ritmo', 'diasUltimo', 'medianaViews', 'vpd', 'vpdPorMil', 'engajamento', 'acima2x', 'duracao', 'trocas30']

/** As seis que têm régua e posição no nicho (spec 18.5). */
export const NO_NICHO: ReadonlySet<NumeroId> = new Set<NumeroId>(['inscritos', 'longosAcomp', 'longos90', 'medianaViews', 'vpd', 'vpdPorMil'])

/** x null = não medido (com `motivo`); x 0 = zero medido. `texto` é o valor como a tela o escreve; `nota` é a segunda linha. */
export interface Numero { x: number | null; texto: string | null; motivo: string | null; nota: string | null }

/** Por que um número não foi medido. A frase sai de `motivoTexto`, um `switch` exaustivo: tipo novo sem frase não compila. */
export type Motivo =
  | { k: 'subsOcultos' }
  | { k: 'subsZero' }
  | { k: 'primeiraSync' }
  | { k: 'semVideos' }
  | { k: 'semDataVideo' }
  /** `falta`: o que o motor diz que falta para a segunda contagem ("faltam 12 d (primeira contagem 24/10)"); null = nenhuma contagem a citar. */
  | { k: 'sem30'; falta: string | null }
  | { k: 'semPercentual' }
  | { k: 'semViewsLongos' }
  | { k: 'semDiarioProprio' }
  | { k: 'semDiarioConcorrente' }
  | { k: 'semEngajamento' }
  | { k: 'semMultiplo'; proprio: boolean }
  | { k: 'semDuracao' }
  | { k: 'trocasAbLab' }

export function motivoTexto(m: Motivo): string {
  switch (m.k) {
    case 'subsOcultos': return 'inscritos ocultos pelo canal'
    case 'subsZero': return 'o canal ainda não tem inscritos'
    case 'primeiraSync': return 'a primeira sincronização ainda não terminou'
    case 'semVideos': return 'sem vídeos'
    case 'semDataVideo': return 'nenhum vídeo com data de publicação'
    case 'sem30': return m.falta == null ? 'sem contagem de 30 dias atrás' : `sem contagem de 30 dias atrás: ${m.falta}`
    case 'semPercentual': return 'sem percentual: o canal não tinha inscritos na contagem anterior'
    case 'semViewsLongos': return 'nenhum longo com contagem de views'
    case 'semDiarioProprio': return 'a coleta diária do seu canal começa em breve'
    case 'semDiarioConcorrente': return 'aguarda o 2º registro diário'
    case 'semEngajamento': return 'nenhum longo com curtidas e comentários'
    case 'semMultiplo': return m.proprio ? 'nenhum vídeo seu nos últimos 90 dias' : 'nenhum vídeo com múltiplo em 90 dias'
    case 'semDuracao': return 'nenhum longo com duração'
    case 'trocasAbLab': return 'as trocas do seu canal ficam no A/B Lab'
    default: { const nunca: never = m; return nunca }
  }
}

const EXEMPLOS: Record<Motivo['k'], Motivo> = {
  subsOcultos: { k: 'subsOcultos' }, subsZero: { k: 'subsZero' }, primeiraSync: { k: 'primeiraSync' }, semVideos: { k: 'semVideos' },
  semDataVideo: { k: 'semDataVideo' }, sem30: { k: 'sem30', falta: null }, semPercentual: { k: 'semPercentual' },
  semViewsLongos: { k: 'semViewsLongos' }, semDiarioProprio: { k: 'semDiarioProprio' }, semDiarioConcorrente: { k: 'semDiarioConcorrente' },
  semEngajamento: { k: 'semEngajamento' }, semMultiplo: { k: 'semMultiplo', proprio: false }, semDuracao: { k: 'semDuracao' }, trocasAbLab: { k: 'trocasAbLab' },
}
/** Todo motivo possível, as variantes incluídas (para o teste que varre as frases). */
export const MOTIVOS: readonly Motivo[] = [
  ...Object.values(EXEMPLOS),
  { k: 'sem30', falta: 'faltam 12 d (primeira contagem 24/10)' },
  { k: 'semMultiplo', proprio: true },
]

function medido(x: number, texto: string, nota: string | null = null): Numero {
  // um número que não é finito ou um texto vazio nunca sai como medido: falha alto em vez de falhar em verde
  if (!Number.isFinite(x) || texto.trim() === '') throw new Error(`número medido inválido: x=${x} texto="${texto}"`)
  return { x, texto, motivo: null, nota }
}
const naoMedido = (m: Motivo): Numero => ({ x: null, texto: null, motivo: motivoTexto(m), nota: null })

/** Zero medido é "0"; qualquer outro valor, uma casa decimal. */
const umaCasa = (v: number, dec1: (x: number) => string) => (v === 0 ? '0' : dec1(v))

export function numerosDoCanal(obs: Observatory, channelId: string): Record<NumeroId, Numero> {
  const ch = obs.channel(channelId)
  if (!ch) throw new Error(`canal desconhecido: ${channelId}`)
  const F = obs.fmt, D = obs.date
  const vids = obs.videos.filter(v => v.ch === ch.id)
  const semVideos = vids.length === 0 && ch.undated.length === 0
  const primeiraSync = ch.sync.state === 'backfill'
  const longs = vids.filter(v => v.fmt === 'long')

  /** Antes de olhar o dado: canal que ainda sincroniza, ou sem vídeo algum, não tem o que medir. */
  const semBase = (): Motivo | null => (primeiraSync ? { k: 'primeiraSync' } : semVideos ? { k: 'semVideos' } : null)
  /** Roda `f` só quando há base; do contrário, o motivo. */
  const com = (f: () => Numero): Numero => { const m = semBase(); return m ? naoMedido(m) : f() }

  const SL = obs.channelStats(ch.id, 'long')

  /* ---------------------------------------------------------------- Tamanho */
  const inscritos = ch.subs == null ? naoMedido({ k: 'subsOcultos' }) : medido(ch.subs, F.subs(ch.subs))

  const inscritos30 = ((): Numero => {
    if (primeiraSync) return naoMedido({ k: 'primeiraSync' })
    if (ch.own) return naoMedido({ k: 'sem30', falta: null }) // o canal próprio não tem a contagem diária de inscritos (spec 16.1)
    const g = SL.growth30
    if (g.pending) return naoMedido({ k: 'sem30', falta: g.pending === 'sem contagem' ? null : g.pending })
    const de = ch.snapshots.find(s => s.t === g.from), para = ch.snapshots.find(s => s.t === g.to)
    const nota = de && para ? `de ${F.int(de.subs)} para ${F.int(para.subs)}` : null
    if (g.withinRounding) return medido(g.pct ?? 0, '≈ 0', nota)
    if (g.pct == null) return naoMedido({ k: 'semPercentual' })
    return medido(g.pct, g.pct === 0 ? '0,0%' : `${g.pct > 0 ? '+' : '−'}${F.dec1(Math.abs(g.pct * 100))}%`, nota)
  })()

  /* ---------------------------------------------------------------- Publicação */
  // D10: só os longos (channelStats().tracked soma todos os formatos)
  const longosAcomp = com(() => { const n = longs.filter(v => v.tracked).length; return medido(n, String(n)) })
  // D9: 90 dias corridos, como o cabeçalho do canal; todo longo guardado com data, acompanhado ou não
  const longos90 = com(() => { const n = longs.filter(v => v.ageDays <= 90).length; return medido(n, String(n)) })

  const ritmo = com(() => {
    const kl = obs.cadence(ch.id, 'long'), ks = obs.cadence(ch.id, 'short'), sem = obs.RULES.habit.weeks
    return medido(Math.round((kl.pw + ks.pw) * 10) / 10, `${umaCasa(kl.pw, F.dec1)} + ${umaCasa(ks.pw, F.dec1)}`,
      `${F.plural(kl.n, 'longo', 'longos')} e ${F.plural(ks.n, 'Short', 'Shorts')} em ${sem} semanas`)
  })

  const diasUltimo = com(() => {
    const a = obs.cadence(ch.id, 'long').lastUpload, b = obs.cadence(ch.id, 'short').lastUpload
    const ult = a == null ? b : b == null ? a : Math.max(a, b)
    if (ult == null) return naoMedido({ k: 'semDataVideo' })
    const dias = Math.max(0, Math.floor((obs.NOW - ult) / DAY))
    return medido(dias, String(dias), `publicado em ${D.dmOrDmy(ult)}`)
  })

  /* ---------------------------------------------------------------- Desempenho */
  const medianaViews = com(() => {
    const { median } = viewsMediana(obs, vids, 'long')
    return median == null ? naoMedido({ k: 'semViewsLongos' }) : medido(median, F.num(median))
  })

  // views por dia: o canal próprio não tem a coleta diária até a A4, e o motivo é dele, não "aguarda o 2º registro"
  const diario = (f: () => Numero): Numero => com(() => (ch.own ? naoMedido({ k: 'semDiarioProprio' }) : f()))
  const vpd = diario(() => {
    const t = vpdText(SL.vpdMedian, F.num)
    return SL.vpdMedian == null || t == null ? naoMedido({ k: 'semDiarioConcorrente' }) : medido(SL.vpdMedian, t)
  })
  const vpdPorMil = diario(() => {
    if (ch.subs == null) return naoMedido({ k: 'subsOcultos' })
    const v = SL.perMilSubs
    if (v == null) return naoMedido(SL.vpdMedian == null ? { k: 'semDiarioConcorrente' } : { k: 'subsZero' })
    // positivo pequeno demais para uma casa decimal não vira "0,0": seria um zero escrito onde há medida
    return medido(v, v === 0 ? '0' : v < 0.05 ? 'menos de 0,1' : F.dec1(v))
  })

  // engajamento SEM janela de 90 dias (spec 18.4): o mesmo critério para os dois lados. Comentário nulo fica de fora, não é 0.
  const engajamento = com(() => {
    const r = longs.filter(v => v.views != null && v.views > 0 && v.likes != null && v.comments != null).map(v => (v.likes! + v.comments!) / v.views!)
    const m = obs.median(r)
    if (m == null) return naoMedido({ k: 'semEngajamento' })
    return medido(m, `${F.dec1(m * 100)}%`, `mediana de ${r.length === 1 ? '1 longo guardado' : `${r.length} longos guardados`}, de qualquer idade`)
  })

  const acima = com(() => {
    const a = acima2x(SL)
    return a == null ? naoMedido({ k: 'semMultiplo', proprio: ch.own }) : medido(a.k, `${a.k} de ${a.de}`)
  })

  const duracao = com(() => {
    const d = duracaoMediana(obs, vids)
    return d.median == null ? naoMedido({ k: 'semDuracao' }) : medido(d.median, durText(d.median), `mediana de ${F.plural(d.n, 'longo acompanhado', 'longos acompanhados')}`)
  })

  const trocas = com(() => {
    if (ch.own) return naoMedido({ k: 'trocasAbLab' })
    const n = trocas30(obs, ch.id)
    return medido(n, String(n))
  })

  return {
    inscritos, inscritos30, longosAcomp, longos90, ritmo, diasUltimo, medianaViews, vpd, vpdPorMil,
    engajamento, acima2x: acima, duracao, trocas30: trocas,
  }
}
