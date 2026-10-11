// Fase A2, tarefa 6, conserto 1 (I2 e I3): a legenda e o período de uma versão de thumbnail são UMA conta só, a do Histórico, nas duas telas.
// O canal e o Histórico leem o mesmo vídeo do mesmo motor; a legenda do visualizador tem de ser igual, versão por versão.
import { describe, it, expect } from 'vitest'
import { canalWorld } from './canal-fixture'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { buildCanalVideos } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'
import { buildCanalTrocas } from '@/app/cms/(authed)/youtube/competitors/_canal/trocas-model'
import { missingText } from '@/app/cms/(authed)/youtube/competitors/_chrome/thumb-viewer/viewer-model'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const FULL = 'matt-opus55', H = 36e5
const BLOB = (i: number) => `https://x.public.blob.vercel-storage.com/t/${i}.jpg`

/** O mesmo vídeo com as quatro precisões que a coleta tem: uma versão vista desde o arquivo, uma com janela, uma ao minuto, a atual. */
const precisoes = (ds: Dataset) => {
  const v = ds.videos.find(x => x.id === FULL)!
  v.thumbs.forEach((t, i) => { t.blobUrl = i === 1 ? null : BLOB(i) })
  const [a, b, c] = v.thumbs
  a!.prec = 'desde-arquivo'; a!.seenSinceArchive = true
  b!.prec = '6h'; b!.window = [b!.first_seen - 6 * H, b!.first_seen]
  c!.prec = 'min'; c!.window = null
}

describe('I2: a legenda do visualizador é a mesma no canal e no Histórico', () => {
  it('para cada vídeo do canal com versões de thumbnail, versão por versão (legenda, período, rótulo)', () => {
    const { obs, chId } = canalWorld(precisoes)
    const videos = buildCanalVideos(obs, chId).videos
    let comparados = 0
    for (const cv of videos) {
      if (!cv.viewer) continue
      const h = buildHistoricoView(obs, cv.id, {}).viewer
      if (!h) continue
      expect(cv.viewer.versions.map(x => x.caption), cv.id).toEqual(h.versions.map(x => x.caption))
      expect(cv.viewer.versions.map(x => x.label), cv.id).toEqual(h.versions.map(x => x.label))
      expect(cv.viewer.versions.map(x => x.span), cv.id).toEqual(h.versions.map(x => x.span))
      expect(cv.viewer.start, cv.id).toBe(h.start)
      comparados++
    }
    expect(comparados).toBeGreaterThan(5)
  })
  it('o vídeo das quatro precisões: a legenda diz "desde", a janela e "pelo menos", e a aba Trocas diz o mesmo', () => {
    const { obs, chId } = canalWorld(precisoes)
    const h = buildHistoricoView(obs, FULL, {}).viewer!
    const cv = buildCanalVideos(obs, chId).videos.find(x => x.id === FULL)!.viewer!
    expect(h.versions[0]!.caption).toMatch(/vista desde /)
    expect(h.versions[0]!.caption).toMatch(/no ar por pelo menos /)
    expect(h.versions[1]!.caption).toMatch(/vista pela 1ª vez /)
    expect(cv.versions.map(x => x.caption)).toEqual(h.versions.map(x => x.caption))
    const tr = buildCanalTrocas(obs, chId).cards.find(c => c.videoId === FULL)
    if (tr) expect(tr.viewer!.versions.map(x => x.caption)).toEqual(h.versions.map(x => x.caption))
  })
  it('canal parado: a atual diz "última vista" nos dois', () => {
    const { obs, chId } = canalWorld((ds, id) => { precisoes(ds); const c = ds.channels.find(x => x.id === id)!; c.sync = { ...c.sync, state: 'atrasado', last: ds.now - 40 * 36e5 } })
    const h = buildHistoricoView(obs, FULL, {}).viewer!
    const cv = buildCanalVideos(obs, chId).videos.find(x => x.id === FULL)!.viewer!
    expect(cv.versions.map(x => x.caption)).toEqual(h.versions.map(x => x.caption))
    expect(h.versions[3]!.caption).toMatch(/^Capa C \(última vista\)/)
  })
})

describe('I3: o quadro da versão não arquivada usa o período da legenda', () => {
  it('o período do quadro é o do cartão da versão (span), o mesmo da legenda do mesmo diálogo', () => {
    const { obs } = canalWorld(precisoes)
    const view = buildHistoricoView(obs, FULL, {})
    const cards = view.versions!.thumbs.cards
    const vv = view.viewer!.versions[1]!
    expect(vv.archived).toBeNull()
    expect(vv.span).toBe(cards[1]!.span)
    expect(vv.caption).toContain(vv.span!)
    const quadro = missingText(vv)
    expect(quadro).toContain(cards[1]!.span)
    // o texto fixo do spec continua o mesmo, só o período muda
    expect(quadro.startsWith('A coleta só guarda a thumbnail a partir do momento em que a vê. Esta versão (')).toBe(true)
    expect(quadro.endsWith(') saiu do ar antes disso, então não há imagem para mostrar nem para baixar.')).toBe(true)
  })
  it('sem `span` (quem monta o ViewerVersion à mão), o quadro cai em "de até" como antes', () => {
    expect(missingText({ from: '01/10 09:00', to: '05/10 14:22' })).toBe(
      'A coleta só guarda a thumbnail a partir do momento em que a vê. Esta versão (01/10 09:00 até 05/10 14:22) saiu do ar antes disso, então não há imagem para mostrar nem para baixar.')
  })
})
