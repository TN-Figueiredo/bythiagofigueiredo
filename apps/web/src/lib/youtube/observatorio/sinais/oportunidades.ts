// Núcleo puro dos sinais do nicho (F2 T5): recebe projeções prontas, devolve oportunidades.
// Sem banco, sem EngineCtx. D20: nenhuma métrica de desempenho do vídeo próprio entra aqui.
import { REGRA_SINAIS } from './regra'

export interface OutlierProjetado {
  videoId: string
  canalId: string
  formato: 'long' | 'short'
  publishedAt: string
  /** vpd7 / median7(canal, formato): a grandeza da régua D6. */
  mult: number
  /** `item.mult.value` da tela; só evidência. */
  multTela: number
  vpd7: number
  nCanal: number
  chaves: string[]
  tokens: string[]
  /** false para os recompostos de niche_outliers_vistos; ausente = de hoje. Só os de hoje geram `parecido`. */
  deHoje?: boolean
}

export interface ProprioProjetado {
  videoId: string
  formato: 'long' | 'short' | null
  chaves: string[]
  tokens: string[]
}

export interface EntradaDoNucleo {
  outliers: OutlierProjetado[]
  ancorasPorChave: ReadonlyMap<string, ReadonlySet<string>>
  chavesAbertas: ReadonlySet<string>
  proprios: ProprioProjetado[]
  canaisSemRitmo: number
  canaisTotal: number
  outliersSemLugar: number
  agora: Date
  semente: number
}

export interface Evidence {
  outliers: Array<{
    video_id: string
    canal_id: string
    published_at: string
    mult_vpd7: number
    mult_tela: number
    vpd7: number
    formato: 'long' | 'short'
  }>
  outliers_total: number
  canais: number
  proprios: string[]
}

export interface Oportunidade {
  kind: 'destino' | 'parecido'
  notificarComo: 'individual' | 'resumo'
  subjectKey: string
  acao: 'titulo_descricao' | 'video_novo' | 'playlist'
  forca: number
  motivo: string
  evidence: Evidence
  alvos: string[]
}

export type MotivoVazio =
  | 'sem-historico'
  | 'sem-terceiro-outlier'
  | 'sem-lugar'
  | 'sync-atrasado'
  | 'abaixo-do-minimo'
  | 'sem-grupo'

export const CHAVES_CONTAGENS = [
  'canais_total',
  'canais_sem_ritmo',
  'canais_sem_n_minimo',
  'canais_com_outlier',
  'outliers_total',
  'outliers_sem_lugar',
  'sem_n_minimo',
  'abaixo_do_piso',
  'outliers_ancora',
  'proprios',
] as const
export type Contagens = Record<(typeof CHAVES_CONTAGENS)[number], number>

export type EntradaDaForca = { mults: number[]; canais: number; idadeDias: number }

const DIA_MS = 86_400_000
const round2 = (n: number): number => Math.round(n * 100) / 100

export function forcaDe(f: EntradaDaForca): number {
  const soma = f.mults.reduce((s, m) => s + Math.log2(m), 0)
  const fator = (1 + 0.5 * (f.canais - 1)) * Math.max(0.2, 1 - f.idadeDias / 30)
  return round2(soma * fator)
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  const [menor, maior] = a.size <= b.size ? [a, b] : [b, a]
  let inter = 0
  for (const t of menor) if (maior.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

function evidenciaDe(outs: OutlierProjetado[], total: number, canais: number, proprios: string[]): Evidence {
  const fortes = [...outs]
    .sort((a, b) => b.mult - a.mult || a.videoId.localeCompare(b.videoId))
    .slice(0, REGRA_SINAIS.tetoEvidenciaOutliers)
  return {
    outliers: fortes.map((o) => ({
      video_id: o.videoId,
      canal_id: o.canalId,
      published_at: o.publishedAt,
      mult_vpd7: o.mult,
      mult_tela: o.multTela,
      vpd7: o.vpd7,
      formato: o.formato,
    })),
    outliers_total: total,
    canais,
    proprios,
  }
}

function idadeDiasDe(outs: OutlierProjetado[], agora: Date): number {
  const maisRecente = Math.max(...outs.map((o) => Date.parse(o.publishedAt)))
  return Math.max(0, (agora.getTime() - maisRecente) / DIA_MS)
}

const EXPLICA_MULT =
  'mult = vpd7 / mediana dos vídeos do canal no formato (não é o multiplicador de tela); ' +
  'piso: vpd7 × 7 do próprio vídeo do terceiro'

function fmtNum(n: number): string {
  return String(round2(n))
}

export function calcularOportunidades(e: EntradaDoNucleo): {
  itens: Oportunidade[]
  motivoVazio: MotivoVazio | null
  contagens: Contagens
} {
  const R = REGRA_SINAIS
  const rotulo = `regra v${R.versao}, semente ${e.semente}`
  const agoraMs = e.agora.getTime()

  // 1. Régua mínima: nCanal e piso de views.
  const validos: OutlierProjetado[] = []
  let semNMinimo = 0
  let abaixoPiso = 0
  const canaisSemN = new Set<string>()
  for (const o of e.outliers) {
    if (o.nCanal < R.nMinimo) {
      semNMinimo++
      canaisSemN.add(o.canalId)
    } else if (o.vpd7 * 7 < R.pisoViews) abaixoPiso++
    else validos.push(o)
  }
  const ehValido = new Set(validos.map((o) => o.videoId))

  const ancoraDe = (chave: string, videoId: string): boolean => e.ancorasPorChave.get(chave)?.has(videoId) ?? false
  const itens: Oportunidade[] = []
  const proprioIds = (chave: string): string[] =>
    e.proprios.filter((p) => p.chaves.includes(chave)).map((p) => p.videoId).sort()

  // 2. Destinos por chave pais:.
  const porChave = new Map<string, OutlierProjetado[]>()
  for (const o of validos) {
    const t = Date.parse(o.publishedAt)
    if (!(t >= agoraMs - R.janelaDias * DIA_MS && t <= agoraMs)) continue
    for (const c of o.chaves) {
      if (!c.startsWith('pais:')) continue
      const l = porChave.get(c)
      if (l) l.push(o)
      else porChave.set(c, [o])
    }
  }
  for (const [chave, grupo] of [...porChave].sort(([a], [b]) => a.localeCompare(b))) {
    const aberta = e.chavesAbertas.has(chave)
    const base = aberta ? grupo : grupo.filter((o) => !ancoraDe(chave, o.videoId))
    if (base.length === 0) continue
    const canais = new Set(base.map((o) => o.canalId)).size
    const ramoGrupo = base.length >= R.minOutliers && canais >= R.minCanais
    const ramoSozinho = base.some((o) => o.mult >= R.multSozinho)
    if (!aberta && !ramoGrupo && !ramoSozinho) continue
    const alvos = proprioIds(chave)
    const forca = forcaDe({ mults: base.map((o) => o.mult), canais, idadeDias: idadeDiasDe(base, e.agora) })
    const maxMult = Math.max(...base.map((o) => o.mult))
    const notificarComo: Oportunidade['notificarComo'] =
      ramoGrupo || R.sozinhoNotificaIndividual ? 'individual' : 'resumo'
    const motivo =
      `${chave}: ${base.length} outlier(s) em ${canais} canal(is) nos últimos ${R.janelaDias} dias, ` +
      `maior mult ${fmtNum(maxMult)}; ${rotulo}. ${EXPLICA_MULT}. ` +
      (alvos.length > 0
        ? `Seu(s) ${alvos.length} vídeo(s) com este lugar podem ganhar com um título ou descrição melhor: isso pode ajudar.`
        : 'Você não tem vídeo com este lugar: um vídeo novo sobre ele pode ajudar.')
    itens.push({
      kind: 'destino',
      notificarComo,
      subjectKey: chave,
      acao: alvos.length > 0 ? 'titulo_descricao' : 'video_novo',
      forca,
      motivo,
      evidence: evidenciaDe(base, base.length, canais, alvos),
      alvos,
    })
  }

  // 3. Parecidos: só outliers de hoje.
  const proprioSets = e.proprios.map((p) => ({ p, set: new Set(p.tokens), chaves: new Set(p.chaves) }))
  for (const o of validos) {
    if (o.deHoje === false) continue
    const subjectKey = `outlier:${o.videoId}`
    const aberto = e.chavesAbertas.has(subjectKey)
    if (!aberto && ancoraDe(subjectKey, o.videoId)) continue
    const tokensO = new Set(o.tokens)
    const casados: Array<{ p: ProprioProjetado; j: number; lugar: boolean }> = []
    for (const { p, set, chaves } of proprioSets) {
      if (p.formato !== null && p.formato !== o.formato) continue
      const j = jaccard(tokensO, set)
      if (j >= R.jaccardMin) casados.push({ p, j, lugar: o.chaves.some((c) => chaves.has(c)) })
    }
    if (casados.length === 0) continue
    casados.sort((a, b) => b.j - a.j || a.p.videoId.localeCompare(b.p.videoId))
    const top = casados.slice(0, R.topParecidos)
    const alvos = top.map((c) => c.p.videoId)
    const semFormato = top.some((c) => c.p.formato === null)
    const frase = top[0]!.lugar ? 'mesmo lugar e mesmo tema' : 'tema parecido, lugar diferente'
    const motivo =
      `Vídeo de terceiro com mult ${fmtNum(o.mult)} (vpd7 ${fmtNum(o.vpd7)}), 1 canal; ${frase}; ` +
      `Jaccard de tokens ${fmtNum(top[0]!.j)} (mín ${R.jaccardMin}); ${rotulo}. ${EXPLICA_MULT}. ` +
      (semFormato ? 'Formato não confirmado em parte dos seus vídeos. ' : '') +
      'Rever seus vídeos parecidos pode ajudar.'
    itens.push({
      kind: 'parecido',
      notificarComo: R.parecidoNotificaIndividual ? 'individual' : 'resumo',
      subjectKey,
      acao: 'titulo_descricao',
      forca: forcaDe({ mults: [o.mult], canais: 1, idadeDias: idadeDiasDe([o], e.agora) }),
      motivo,
      evidence: evidenciaDe([o], 1, 1, alvos),
      alvos,
    })
  }

  itens.sort((a, b) => b.forca - a.forca || a.subjectKey.localeCompare(b.subjectKey))

  // 4. Contagens (sempre as 10 chaves).
  const contagens: Contagens = {
    canais_total: e.canaisTotal,
    canais_sem_ritmo: e.canaisSemRitmo,
    canais_sem_n_minimo: canaisSemN.size,
    canais_com_outlier: new Set(e.outliers.map((o) => o.canalId)).size,
    outliers_total: e.outliers.length,
    outliers_sem_lugar: e.outliersSemLugar,
    sem_n_minimo: semNMinimo,
    abaixo_do_piso: abaixoPiso,
    outliers_ancora: validos.filter((o) => o.chaves.some((c) => ancoraDe(c, o.videoId))).length,
    proprios: e.proprios.length,
  }

  // 5. Motivo do vazio (só com itens vazio).
  let motivoVazio: MotivoVazio | null = null
  if (itens.length === 0) {
    const comChave = e.outliers.filter((o) => o.chaves.length > 0)
    if (e.canaisTotal === 0) motivoVazio = 'sem-historico'
    else if (e.canaisSemRitmo >= e.canaisTotal) motivoVazio = 'sync-atrasado'
    else if (e.outliers.length === 0) motivoVazio = 'sem-terceiro-outlier'
    else if (comChave.length === 0) motivoVazio = 'sem-lugar'
    else if (comChave.every((o) => !ehValido.has(o.videoId))) motivoVazio = 'abaixo-do-minimo'
    else motivoVazio = 'sem-grupo'
  }

  return { itens, motivoVazio, contagens }
}
