/**
 * Modelo da página do VÍDEO próprio (spec 17): cabeçalho, faixa de seis números com a conta feita, paginador na ordem da lista de origem
 * e trilha. Puro: recebe só `obs` e a query; NÃO recebe o dado privado (os blocos que o usam são de `video-blocos-model.ts`, montados depois da
 * guarda de edição); não lê banco, não pede a prova de edição e não importa os leitores (uma varredura de teste barra).
 *
 * A faixa NÃO usa o dado privado: views, curtidas, comentários, engajamento, múltiplo e duração saem do motor (as mesmas fontes e os mesmos
 * formatadores do cartão da lista de vídeos, `buildCanalVideos`), então o mesmo número tem o mesmo texto nas duas telas. Dado ausente é `null`
 * no tipo e uma frase na célula, nunca zero; a conta de cada célula sai feita no ⓘ e `validarFaixa` lança se alguma ficar vazia.
 */
import type { Observatory } from '@/lib/youtube/observatorio'
import { link } from '@/lib/youtube/observatorio/links'
import type { ObsChannel } from '@/lib/youtube/observatorio/types'
import { buildCanalVideos, type ChannelVideoView } from '../_canal/videos-model'
import { viewerSoAtual } from '../_chrome/thumb-viewer/thumb-viewer-versions'
import type { ViewerInput } from '../_chrome/thumb-viewer/viewer-model'
import { descricaoDaOrigem, veioDoTopDeImpressoes } from '../_historico/origem-canal'
import type { PagerView, TrailItem } from '../_historico/view-model'

export interface CelulaVideo {
  key: 'views' | 'curtidas' | 'comentarios' | 'engajamento' | 'multiplo' | 'duracao'
  value: string | null
  /** A frase quando não há valor ("não medido", "sem views para calcular"…); null quando há. */
  missing: string | null
  label: string
  /** A segunda linha do rótulo (spec 17.2): "curtidas + comentários por view", "mediana dos outros 34: 138 views". null = sem ela. */
  sub: string | null
  /** A base do número, com a conta FEITA. Nunca vazia. */
  conta: string
}

export interface ProprioVideoHeader {
  id: string; ytId: string; titulo: string; url: string; thumb: string | null
  /** "Publicado há 666 dias, em 23/01/2025 17:00 (São Paulo) · vídeo longo". */
  meta: string
  faixa: CelulaVideo[]
  canal: { id: string; name: string; href: string }
  /** O visualizador de "Ampliar thumbnail": as versões, ou só a atual. null = o vídeo não tem thumbnail para ampliar. */
  viewer: ViewerInput | null
  /** Vídeo guardado sem data de publicação: sem idade, sem múltiplo e fora da lista do canal. */
  semData: boolean
}

export interface ProprioVideoPage {
  header: ProprioVideoHeader
  pager: PagerView
  crumbs: TrailItem[]
  /** O id do canal quando a pessoa veio da página dele (`from=canais&canal=<este canal>`): a tela guarda daí o último vídeo visto. */
  fromCanal: string | null
}

type Params = Record<string, string | undefined>

/* ---------------------------------------------------------------- de quem é o vídeo */

/** O canal PRÓPRIO dono do vídeo (datado ou sem data), ou null: vídeo de concorrente, id desconhecido, vídeo de outro conjunto. A decisão da rota. */
export function canalProprioDoVideo(obs: Observatory, id: string): ObsChannel | null {
  const v = obs.video(id)
  if (v) {
    const ch = obs.channel(v.ch)
    return ch?.own ? ch : null
  }
  for (const c of obs.channels) if (c.own && c.undated.some(u => u.id === id)) return c
  return null
}

/* ---------------------------------------------------------------- a faixa */

/** O ⓘ nunca abre vazio (queixa do dono na rodada 8): a montagem lança se alguma célula chegar sem conta. */
export function validarFaixa(faixa: readonly CelulaVideo[]): void {
  for (const c of faixa) if (c.conta.trim() === '') throw new Error(`faixa do vídeo: a célula "${c.key}" não tem conta para o ⓘ`)
}

const un = (F: Observatory['fmt'], n: number, um: string, muitos: string): string => `${F.int(n)} ${n === 1 ? um : muitos}`

function faixaDe(obs: Observatory, cv: ChannelVideoView, semData: boolean): CelulaVideo[] {
  const F = obs.fmt, D = obs.date
  const v = semData ? null : obs.video(cv.id)!
  const { views, likes, comments } = cv
  const formato = cv.isShort ? 'Shorts' : 'longos', formatoUn = cv.isShort ? 'Short' : 'longo'

  /* views */
  const viewsCel: CelulaVideo = {
    key: 'views', label: 'views', sub: null,
    value: cv.viewsText, missing: cv.viewsText == null ? cv.viewsMissing ?? 'sem contagem de views' : null,
    conta: cv.viewsText == null
      ? `${cv.viewsMissing ?? 'sem contagem de views'}. Sem a contagem, as views não entram em nenhuma conta desta faixa; nunca valem 0.`
      : `Contagem pública de views do YouTube${v?.viewsAt != null ? `, lida em ${D.dmhm(v.viewsAt)}` : ''}.`,
  }

  /* curtidas e comentários */
  const contaPublica = (o: string) => `Contagem de ${o} do YouTube, lida junto com as views.`
  const naoMedida = (o: string) => `O YouTube não devolveu a contagem de ${o} deste vídeo (ou ela ainda não foi lida), então ela não é medida; nunca vale 0.`
  const curtidasCel: CelulaVideo = {
    key: 'curtidas', label: 'curtidas', sub: null,
    value: cv.likesText, missing: cv.likesText == null ? 'não medido' : null, conta: cv.likesText == null ? naoMedida('curtidas') : contaPublica('curtidas'),
  }
  const comentariosCel: CelulaVideo = {
    key: 'comentarios', label: 'comentários', sub: null,
    value: cv.commentsText, missing: cv.commentsText == null ? 'não medido' : null, conta: cv.commentsText == null ? naoMedida('comentários') : contaPublica('comentários'),
  }

  /* engajamento = (curtidas + comentários) ÷ views */
  let engajamento: CelulaVideo
  const eng = (value: string | null, missing: string | null, conta: string): CelulaVideo => ({ key: 'engajamento', label: 'engajamento', sub: 'curtidas + comentários por view', value, missing, conta })
  if (views == null) {
    engajamento = eng(null, 'sem contagem de views', 'Sem a contagem de views não há (curtidas + comentários) ÷ views para calcular.')
  } else if (likes == null || comments == null) {
    const falta = likes == null && comments == null ? 'curtidas e de comentários' : likes == null ? 'curtidas' : 'comentários'
    engajamento = eng(null, 'não medido', `Falta a contagem de ${falta}, então (curtidas + comentários) ÷ views não é calculado; o engajamento nunca vale 0%.`)
  } else if (views === 0) {
    engajamento = eng(null, 'sem views para calcular', 'Com 0 views não há (curtidas + comentários) ÷ views para calcular.')
  } else {
    const pct = F.dec1(((likes + comments) / views) * 100) + '%'
    engajamento = eng(pct, null, `(${un(F, likes, 'curtida', 'curtidas')} + ${un(F, comments, 'comentário', 'comentários')}) ÷ ${un(F, views, 'view', 'views')} = ${pct}.`)
  }

  /* múltiplo: o do motor, o mesmo do cartão */
  const mult = (value: string | null, missing: string | null, conta: string, sub: string | null = null): CelulaVideo => ({ key: 'multiplo', label: 'o normal do canal', sub, value, missing, conta })
  let multiplo: CelulaVideo
  if (semData) {
    multiplo = mult(null, 'sem data de publicação, sem múltiplo', 'O múltiplo compara o vídeo com outros da mesma idade; sem a data de publicação o vídeo não tem idade, então não tem múltiplo.')
  } else if (views == null) {
    multiplo = mult(null, 'sem contagem de views', 'Sem a contagem de views não há múltiplo: ele é views deste vídeo ÷ mediana de views dos outros.')
  } else if (cv.aguardando) {
    multiplo = mult(null, 'aparece quando a sincronização terminar', 'O canal ainda está na primeira sincronização: a mediana dos outros vídeos só vale quando ela terminar.')
  } else {
    const m = obs.multiplier(cv.id)
    if (m.value != null && m.base != null) {
      const card = obs.multiplierCard(cv.id)
      const texto = F.mult(m.value)
      const um = m.n === 1   // "mediana" de um só vídeo: o singular diz isso sem "1 vídeos"
      multiplo = mult(texto, null,
        `${F.int(views)} ÷ ${F.int(m.base)} = ${texto}; ${F.int(m.base)} é a mediana de views ${um ? `do outro vídeo ${formatoUn}` : `dos outros ${m.n} vídeos ${formato}`} do canal ${card.ref}. 1× é o vídeo típico do canal.`
        + (m.weak ? ` Base fraca: só ${un(F, m.n, 'vídeo', 'vídeos')} para comparar (menos de ${obs.RULES.weakBase}).` : ''),
        um ? `o outro vídeo: ${F.int(m.base)} views` : `mediana dos outros ${m.n}: ${F.int(m.base)} views`)
    } else if (m.reason === 'mediana zero') {
      multiplo = mult(null, 'a mediana dos outros é 0 views', 'Os outros vídeos do canal na mesma faixa de idade têm mediana de 0 views: dividir por 0 não dá múltiplo, então o vídeo fica sem comparação.')
    } else if (m.n === 0) {
      multiplo = mult(null, 'poucos vídeos para comparar', `O múltiplo é views deste vídeo ÷ mediana dos outros ${formato} do canal da mesma faixa de idade, e não há nenhum outro vídeo para servir de comparação.`)
    } else {
      multiplo = mult(null, 'sem comparação', `O motor não calculou o múltiplo deste vídeo${m.reason ? ` (${m.reason})` : ''}.`)
    }
  }

  /* duração */
  const duracao: CelulaVideo = {
    key: 'duracao', label: 'duração', sub: null,
    value: cv.durText, missing: cv.durText == null ? 'sem duração' : null,
    conta: cv.durText == null ? 'O YouTube não devolveu a duração deste vídeo, então ela não é medida.' : 'Duração do vídeo no YouTube, lida junto com as views.',
  }
  const faixa = [viewsCel, curtidasCel, comentariosCel, engajamento, multiplo, duracao]
  validarFaixa(faixa)
  return faixa
}

/* ---------------------------------------------------------------- o cabeçalho */

export function buildProprioVideoHeader(obs: Observatory, videoId: string): ProprioVideoHeader | null {
  const ch = canalProprioDoVideo(obs, videoId)
  if (!ch) return null
  const cv = buildCanalVideos(obs, ch.id, { soVideo: videoId }).videos.find(x => x.id === videoId)
  if (!cv) return null
  const semData = cv.grupo === 'sem-data'
  const formato = cv.isShort === true ? 'Short' : cv.isShort === false ? 'vídeo longo' : 'formato não confirmado'
  const quando = semData ? 'Sem data de publicação' : `Publicado ${cv.ageText}, em ${cv.pubTitle}`
  return {
    id: cv.id, ytId: cv.ytId, titulo: cv.title, url: cv.url, thumb: cv.thumbSrc,
    meta: `${quando} · ${formato}`,
    faixa: faixaDe(obs, cv, semData),
    canal: { id: ch.id, name: ch.name, href: link.canal(ch.id) },
    viewer: cv.viewer ?? viewerSoAtual(cv),
    semData,
  }
}

/* ---------------------------------------------------------------- a página */

const ORIGENS = {
  mudancas: { text: 'Mudanças', base: () => link.mudancas() },
  outliers: { text: 'Outliers', base: () => link.outliers() },
  insights: { text: 'Insights', base: () => link.insights() },
  comparar: { text: 'Comparar canais', base: () => link.comparar() },
} as const
type Origem = keyof typeof ORIGENS
const origemDe = (raw: string | undefined): Origem | null => (raw === 'mudancas' || raw === 'outliers' || raw === 'insights' || raw === 'comparar' ? raw : null)

const inteiro = (raw: string | undefined): number | null => (raw != null && /^[1-9]\d*$/.test(raw) ? Number(raw) : null)

const ORDEM_PADRAO = 'do mais novo ao mais antigo'
const SEM_ANTERIOR = 'Não há vídeo anterior: este é o primeiro da lista'
const SEM_PROXIMO = 'Não há próximo vídeo: este é o último da lista'
const ALEM_DA_JANELA = (lado: 'anterior' | 'próximo') => `O vídeo ${lado} está além dos vizinhos que esta tela guarda: volte à lista e abra um vídeo mais perto dele`
const SEM_DATA_LADO = 'Este vídeo não tem data de publicação e não está na lista do canal'

function paginador(obs: Observatory, ch: ObsChannel, videoId: string, titulo: string, p: Params, backHref: string): PagerView {
  const back = p.back && p.back.startsWith('?') ? p.back : null
  const canais = p.from === 'canais' && p.canal === ch.id
  // a ordem padrão: todos os vídeos datados do canal, do mais novo ao mais antigo
  const padrao = obs.videos.filter(x => x.ch === ch.id).sort((a, b) => b.pub - a.pub || (a.id < b.id ? -1 : 1)).map(x => x.id)
  // `ids=` é a lista de onde a pessoa veio (a vizinhança de até 100 vídeos); só vale o que é deste canal
  const idsDaUrl = (p.ids ?? '').split(',').map(x => x.trim()).filter(Boolean)
  const doCanal = idsDaUrl.filter(x => obs.video(x)?.ch === ch.id)
  const naLista = doCanal.includes(videoId)
  const lista = naLista ? doCanal : padrao
  const k = lista.indexOf(videoId)

  // pos/tot: o lugar do vídeo na lista inteira (`ids=` é só a vizinhança). Só vale se fecha com `ids=`; senão a contagem é a de `ids=` sozinho.
  const place = ((): { first: number; tot: number } | null => {
    if (!naLista || !canais) return null
    const pos = inteiro(p.pos), tot = inteiro(p.tot), at = doCanal.indexOf(videoId)
    if (pos == null || tot == null || at < 0 || pos > tot) return null
    const first = pos - at
    return first >= 1 && first - 1 + doCanal.length <= tot ? { first, tot } : null
  })()

  const from = p.from === 'canais' ? 'canais' as const : origemDe(p.from)
  const hrefDe = (j: number): string | null => {
    const to = lista[j]
    if (to == null) return null
    return link.historico(to, {
      ...(from ? { from } : {}),
      ...(back ? { back } : {}),
      ...(naLista ? { ids: doCanal } : {}),
      ...(canais ? { canal: ch.id } : {}),
      ...(place ? { pos: place.first + doCanal.indexOf(to), tot: place.tot } : {}),
    })
  }

  const prev = k < 0 ? null : hrefDe(k - 1), next = k < 0 ? null : hrefDe(k + 1)
  const agora = k < 0 ? 0 : place ? place.first + k : k + 1
  const de = place ? place.tot : lista.length

  // a frase só afirma a ordem que o site SABE: a do top de impressões (marcador próprio no back), a de uma lista da grade (descrita pelo back) ou,
  // sem `ids=`, a do canal por data. Um back que não descreve lista (`?painel=1` de um link antigo) não afirma ordem nenhuma.
  const descDaLista = canais ? descricaoDaOrigem(back ?? '') : null
  const ordemDaLista = veioDoTopDeImpressoes(back) ? 'na ordem do top de impressões' : `na ordem da lista: ${descDaLista ?? 'a da lista aberta'}`
  // sem `ids=` a tela anda pela data do canal: é "a ordem da lista" só quando a lista de origem é essa mesma (sem `back`, ou a grade no padrão)
  const listaEhPorData = back == null || descDaLista === ORDEM_PADRAO
  const ordem = naLista
    ? (canais ? ordemDaLista : 'na ordem da lista aberta')
    : idsDaUrl.length > 0 ? `fora da lista de origem, na ordem do canal: ${ORDEM_PADRAO}`
      : listaEhPorData ? `na ordem da lista: ${ORDEM_PADRAO}` : `na ordem do canal: ${ORDEM_PADRAO}`
  const position = k < 0 ? 'vídeo sem data de publicação, fora da lista do canal' : `vídeo ${agora} de ${de}, ${ordem}`

  // na ponta o botão fica na tela, apagado, com o motivo; se a lista é só uma janela da lista de origem, a ponta dela não é o fim da lista
  const noInicio = k >= 0 && prev == null, noFim = k >= 0 && next == null
  const motivo = (lado: 'anterior' | 'próximo'): string | undefined => {
    if (k < 0) return SEM_DATA_LADO
    if (lado === 'anterior' ? !noInicio : !noFim) return undefined
    if (place && (lado === 'anterior' ? agora > 1 : agora < place.tot)) return ALEM_DA_JANELA(lado)
    return lado === 'anterior' ? SEM_ANTERIOR : SEM_PROXIMO
  }
  const prevOff = motivo('anterior'), nextOff = motivo('próximo')
  return {
    prev, next, backHref, position, prevLabel: 'Vídeo anterior da lista', nextLabel: 'Próximo vídeo da lista', replace: true, compacto: true,
    ...(prevOff ? { prevOff } : {}), ...(nextOff ? { nextOff } : {}),
    status: k < 0 ? '' : `Vídeo ${agora} de ${de}: ${titulo}`,
  }
}

/** A página, SEM o dado privado: o modelo que a rota monta ANTES de ler o alcance e o diário (sem modelo não há o que ler). null = o vídeo não é de um canal próprio ou o cartão não se achou. */
export function buildProprioVideoBase(obs: Observatory, videoId: string, sp: Params): ProprioVideoPage | null {
  const header = buildProprioVideoHeader(obs, videoId)
  const ch = canalProprioDoVideo(obs, videoId)
  if (!header || !ch) return null
  const back = sp.back && sp.back.startsWith('?') ? sp.back : null
  const origem = origemDe(sp.from)
  const fromCanal = sp.from === 'canais' && sp.canal === ch.id ? ch.id : null
  const canalHref = link.canal(ch.id) + (!origem && back ? back : '')
  const crumbs: TrailItem[] = [
    origem ? { text: ORIGENS[origem].text, href: ORIGENS[origem].base().split('?')[0] + (back ?? '') } : { text: 'Canais', href: link.canais() },
    { text: ch.name, href: canalHref, ...(fromCanal ? { voltaAoCanal: ch.id } : {}) },
    { text: 'Vídeo' },
  ]
  return { header, crumbs, fromCanal, pager: paginador(obs, ch, videoId, header.titulo, sp, canalHref) }
}

/** O destino de um traço da régua: o Histórico do outro vídeo, com a origem (`from`, `back`, `canal`) desta página preservada. A lista de `ids=` não vale para o outro vídeo e fica de fora. */
export function hrefDeOutroVideo(sp: Params, canalId: string): (id: string) => string {
  const back = sp.back && sp.back.startsWith('?') ? sp.back : null
  const canais = sp.from === 'canais' && sp.canal === canalId
  const from = sp.from === 'canais' ? 'canais' as const : origemDe(sp.from)
  return id => link.historico(id, { ...(from ? { from } : {}), ...(back ? { back } : {}), ...(canais ? { canal: canalId } : {}) })
}
