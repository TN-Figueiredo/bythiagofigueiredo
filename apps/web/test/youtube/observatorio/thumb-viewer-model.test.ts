// @vitest-environment node
// Modelo puro do visualizador de thumbnail: quais URLs tentar e o que a linha de resolução diz (spec 6.3).
import { describe, it, expect } from 'vitest'
import { candidates, resolutionLine, missingText, positionLabel, fileOf, YT_VARIANTS, type ViewerVersion } from '@/app/cms/(authed)/youtube/competitors/_chrome/thumb-viewer/viewer-model'

const base: ViewerVersion = {
  label: 'Capa B', current: true, archived: null, youtubeId: 'abc123XYZ_-', caption: 'Capa B (no ar): 05/10 14:22 até agora; no ar por 2 d 7 h', from: '05/10 14:22', to: 'agora',
}

describe('thumb-viewer · modelo', () => {
  it('as quatro resoluções, nesta ordem', () => {
    expect([...YT_VARIANTS]).toEqual(['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'])
  })
  it('a versão atual pede as quatro resoluções do YouTube na ordem', () => {
    expect(candidates(base)).toEqual(YT_VARIANTS.map(n => `https://i.ytimg.com/vi/abc123XYZ_-/${n}.jpg`))
  })
  it('o id do vídeo é codificado na URL', () => {
    expect(candidates({ ...base, youtubeId: 'a b/c' })[0]).toBe('https://i.ytimg.com/vi/a%20b%2Fc/maxresdefault.jpg')
  })
  it('versão anterior arquivada usa só a imagem guardada', () => {
    const v = { ...base, current: false, youtubeId: null, archived: 'https://x.public.blob.vercel-storage.com/t/a.jpg' }
    expect(candidates(v)).toEqual(['https://x.public.blob.vercel-storage.com/t/a.jpg'])
  })
  it('versão anterior não arquivada devolve []; atual sem id do vídeo e sem cópia também (nada inventado)', () => {
    expect(candidates({ ...base, current: false, youtubeId: null })).toEqual([])
    expect(candidates({ ...base, youtubeId: null })).toEqual([])
    expect(candidates({ ...base, current: false })).toEqual([]) // youtubeId só vale na versão atual
  })
  it('a atual que também tem cópia guardada usa a cópia como último recurso, depois das quatro', () => {
    const lista = candidates({ ...base, archived: 'https://x.public.blob.vercel-storage.com/t/a.jpg' })
    expect(lista).toHaveLength(5)
    expect(lista[4]).toBe('https://x.public.blob.vercel-storage.com/t/a.jpg')
  })
  it('fileOf devolve o nome do arquivo da URL', () => {
    expect(fileOf('https://i.ytimg.com/vi/abc/sddefault.jpg')).toBe('sddefault.jpg')
    expect(fileOf('https://i.ytimg.com/vi/abc/sddefault.jpg?x=1')).toBe('sddefault.jpg')
  })
  it('a linha de resolução diz o arquivo e o tamanho medido, e que ampliar não dá detalhe', () => {
    const t = resolutionLine('maxresdefault.jpg', 1280, 720, false, false)
    expect(t).toBe('Exibindo maxresdefault.jpg, 1280×720 px (maior resolução disponível). Acima de 100% a imagem é aumentada: ganha tamanho, não detalhe.')
  })
  it('quando caiu para uma menor, diz que o YouTube não tem versão maior deste vídeo', () => {
    const t = resolutionLine('hqdefault.jpg', 480, 360, true, false)
    expect(t).toContain('Exibindo hqdefault.jpg, 480×360 px (o YouTube não tem versão maior deste vídeo).')
    expect(t).toContain('ganha tamanho, não detalhe')
    expect(t).not.toContain('maior resolução disponível')
  })
  it('a arquivada diz que mostra a imagem guardada, no tamanho em que foi guardada', () => {
    const t = resolutionLine('a.jpg', 480, 360, false, true)
    expect(t).toContain('imagem arquivada')
    expect(t).toContain('480×360 px')
    expect(t).toContain('no tamanho em que foi guardada')
    expect(t).toContain('ganha tamanho, não detalhe')
    expect(t).not.toContain('YouTube')
  })
  it('o texto da versão não arquivada é o do spec 6.3, com o período', () => {
    expect(missingText({ ...base, current: false, from: '01/10 09:00', to: '05/10 14:22' })).toBe(
      'A coleta só guarda a thumbnail a partir do momento em que a vê. Esta versão (01/10 09:00 até 05/10 14:22) saiu do ar antes disso, então não há imagem para mostrar nem para baixar.')
  })
  it('o contador de posição', () => {
    expect(positionLabel('Capa B', 1, 2)).toBe('Capa B · 2 de 2')
  })
})

import { downloadName } from '@/app/cms/(authed)/youtube/competitors/_chrome/thumb-viewer/viewer-model'
describe('thumb-viewer · nome do arquivo baixado', () => {
  it('a atual leva o id do vídeo e o arquivo do YouTube', () => {
    expect(downloadName({ label: 'Capa B', youtubeId: 'vid1234' }, 'maxresdefault.jpg', false)).toBe('thumbnail-vid1234-maxresdefault.jpg')
  })
  it('a anterior arquivada leva o nome da capa e a extensão da cópia', () => {
    expect(downloadName({ label: 'Capa Ã', youtubeId: null }, 'a.PNG', true)).toBe('thumbnail-capa-a.png')
    expect(downloadName({ label: 'Capa A', youtubeId: null }, 'semextensao', true)).toBe('thumbnail-capa-a.jpg')
  })
})
