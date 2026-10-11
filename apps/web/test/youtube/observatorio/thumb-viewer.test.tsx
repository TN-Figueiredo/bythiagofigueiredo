// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/thumb-viewer.test.tsx
// O diálogo do visualizador de thumbnail (spec telas v9, 6.3 e 11 linha 7). Sem layout em jsdom: a caixa de 800×600 vem de clientWidth/clientHeight.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, fireEvent, cleanup, screen, waitFor, within, act } from '@testing-library/react'
import { ThumbViewer, useThumbViewer } from '@/app/cms/(authed)/youtube/competitors/_chrome/thumb-viewer/thumb-viewer'
import { missingText, type ViewerInput, type ViewerVersion } from '@/app/cms/(authed)/youtube/competitors/_chrome/thumb-viewer/viewer-model'

const YT = (n: string) => `https://i.ytimg.com/vi/vid1234/${n}.jpg`
const BLOB_A = 'https://x.public.blob.vercel-storage.com/t/a.jpg'
const BLOB_B = 'https://x.public.blob.vercel-storage.com/t/b.jpg'

/** O que a rede devolve, por URL: tamanho = carrega; null = erro. URL fora do mapa = erro. */
let rede = new Map<string, { w: number; h: number } | null>()
class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  set src(url: string) {
    setTimeout(() => {
      const r = rede.get(url)
      if (r) { this.naturalWidth = r.w; this.naturalHeight = r.h; this.onload?.() } else this.onerror?.()
    }, 0)
  }
}

const velha = (over: Partial<ViewerVersion> = {}): ViewerVersion => ({
  label: 'Capa A', current: false, archived: BLOB_A, youtubeId: null, caption: 'Capa A: 01/10 09:00 até 05/10 14:22; no ar por 4 d 5 h', from: '01/10 09:00', to: '05/10 14:22', ...over,
})
const atual = (over: Partial<ViewerVersion> = {}): ViewerVersion => ({
  label: 'Capa B', current: true, archived: null, youtubeId: 'vid1234', caption: 'Capa B (no ar): 05/10 14:22 até agora; no ar por 2 d 7 h', from: '05/10 14:22', to: 'agora', ...over,
})
const dois = (start = 1): ViewerInput => ({ title: 'Tailândia barrou a minha entrada', versions: [velha(), atual()], start })
const um = (): ViewerInput => ({ title: 'Tailândia barrou a minha entrada', versions: [atual()], start: 0 })

function Host({ input }: { input: ViewerInput }) {
  const v = useThumbViewer()
  return (
    <>
      <div id="tela" data-testid="tela"><button data-testid="gatilho" onClick={e => v.open(input, e.currentTarget)}>ampliar</button></div>
      {v.node}
    </>
  )
}
const abrir = (input: ViewerInput) => {
  const r = render(<Host input={input} />)
  fireEvent.click(r.getByTestId('gatilho'))
  return r
}
const dialog = () => screen.getByRole('dialog')
const stage = () => dialog().querySelector<HTMLElement>('.obs-tv-stage')!
const pct = () => dialog().querySelector('.obs-tv-pct')!.textContent
const carregada = async () => { await waitFor(() => expect(stage().querySelector('img')).not.toBeNull()) }

let clientW: PropertyDescriptor | undefined, clientH: PropertyDescriptor | undefined
beforeEach(() => {
  rede = new Map([[YT('maxresdefault'), { w: 1280, h: 720 }], [BLOB_A, { w: 480, h: 360 }], [BLOB_B, { w: 640, h: 480 }]])
  vi.stubGlobal('Image', FakeImage)
  clientW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  clientH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (clientW) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientW); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
  if (clientH) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientH); else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight
  document.body.removeAttribute('inert')
})

describe('ThumbViewer · diálogo', () => {
  it('role="dialog", aria-modal, título "Thumbnail: <título>"; abre com o foco no título do diálogo', () => {
    abrir(dois())
    const d = dialog()
    expect(d.getAttribute('aria-modal')).toBe('true')
    const titulo = document.getElementById(d.getAttribute('aria-labelledby')!)!
    expect(titulo.textContent).toBe('Thumbnail: Tailândia barrou a minha entrada')
    expect(titulo.tagName).toBe('H2')
    expect(document.activeElement).toBe(titulo)
    // monta no <body> com os tokens do Observatório (data-obs), fora da árvore da tela
    const host = d.closest('[data-obs]')!
    expect(host.parentElement).toBe(document.body)
    expect(host.contains(screen.getByTestId('tela'))).toBe(false)
  })

  it('o foco fica preso: Tab e Shift+Tab giram dentro do diálogo; o fundo fica inerte', async () => {
    const r = abrir(dois())
    await carregada()
    const d = dialog()
    // o fundo (o que não é o diálogo) fica inerte enquanto está aberto
    const host = d.closest('[data-obs]')!
    const fundo = [...document.body.children].filter(e => e !== host)
    expect(fundo.length).toBeGreaterThan(0)
    for (const e of fundo) expect(e.hasAttribute('inert')).toBe(true)
    expect(host.hasAttribute('inert')).toBe(false)
    const titulo = document.getElementById(d.getAttribute('aria-labelledby')!)!
    const ultimo = within(d).getByRole('button', { name: 'Baixar' })
    ultimo.focus()
    fireEvent.keyDown(ultimo, { key: 'Tab' })
    expect(document.activeElement).toBe(titulo)
    fireEvent.keyDown(titulo, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(ultimo)
    // Tab no meio do ciclo não é interceptado
    const fechar = within(d).getByRole('button', { name: 'Fechar' })
    fechar.focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    fechar.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
    // fechado, o fundo volta como estava
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    for (const e of fundo) expect(e.hasAttribute('inert')).toBe(false)
    expect(r.getByTestId('tela')).toBeTruthy()
  })

  it('quem já era inerte antes continua inerte depois de fechar (devolve o valor anterior)', () => {
    const lixo = document.createElement('aside')
    lixo.setAttribute('inert', '')
    document.body.appendChild(lixo)
    abrir(dois())
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(lixo.hasAttribute('inert')).toBe(true)
    lixo.remove()
  })

  it('Esc fecha e o foco volta ao gatilho', () => {
    const r = abrir(dois())
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(r.getByTestId('gatilho'))
  })

  it('o botão Fechar e o clique no fundo fecham', () => {
    const r = abrir(dois())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(r.getByTestId('gatilho'))
    fireEvent.click(r.getByTestId('gatilho'))
    fireEvent.click(document.querySelector('.obs-tv-back')!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('uma versão só: sem Anterior/Próxima; "Comparar lado a lado" apagado com o motivo', () => {
    abrir(um())
    const d = dialog()
    expect(within(d).queryByRole('button', { name: /Anterior/ })).toBeNull()
    expect(within(d).queryByRole('button', { name: /Próxima/ })).toBeNull()
    const cmp = within(d).getByRole('button', { name: 'Comparar lado a lado' })
    expect(cmp.getAttribute('aria-disabled')).toBe('true')
    const motivo = document.getElementById(cmp.getAttribute('aria-describedby')!)!
    expect(motivo.textContent).toMatch(/uma versão/i)
    fireEvent.click(cmp)
    expect(cmp.getAttribute('aria-pressed')).toBe('false')
    expect(d.querySelector('.obs-tv-cmp')).toBeNull()
  })

  it('várias versões: "Capa B · 2 de 2", Anterior e Próxima trocam a imagem e a legenda', async () => {
    abrir(dois())
    const d = dialog()
    expect(within(d).getByText('Capa B · 2 de 2')).toBeTruthy()
    expect(within(d).getByText(atual().caption)).toBeTruthy()
    await carregada()
    expect(stage().querySelector('img')!.getAttribute('src')).toBe(YT('maxresdefault'))
    expect(within(d).getByRole('button', { name: /Próxima/ }).getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(within(d).getByRole('button', { name: /Anterior/ }))
    expect(within(d).getByText('Capa A · 1 de 2')).toBeTruthy()
    expect(within(d).getByText(velha().caption)).toBeTruthy()
    expect(within(d).queryByText(atual().caption)).toBeNull()
    await waitFor(() => expect(stage().querySelector('img')?.getAttribute('src')).toBe(BLOB_A))
    expect(within(d).getByRole('button', { name: /Anterior/ }).getAttribute('aria-disabled')).toBe('true')
    // a linha de resolução da arquivada diz que é a imagem guardada
    await waitFor(() => expect(d.querySelector('.obs-tv-res')!.textContent).toMatch(/imagem arquivada.*480×360 px/))
    fireEvent.click(within(d).getByRole('button', { name: /Próxima/ }))
    expect(within(d).getByText('Capa B · 2 de 2')).toBeTruthy()
  })

  it('versão não arquivada: quadro tracejado com o texto do spec 6.3; Baixar e Abrir original apagados (aria-disabled)', () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 0 })
    const d = dialog()
    const quadro = within(d).getByText(missingText(velha({ archived: null })))
    expect(quadro.closest('.obs-tv-miss')).not.toBeNull()
    expect(d.querySelector('img')).toBeNull() // sem imagem quebrada
    const baixar = within(d).getByRole('button', { name: 'Baixar' })
    expect(baixar.getAttribute('aria-disabled')).toBe('true')
    const abrirOrig = within(d).getByRole('link', { name: /Abrir original/ })
    expect(abrirOrig.getAttribute('aria-disabled')).toBe('true')
    expect(abrirOrig.hasAttribute('href')).toBe(false)
    expect(pct()).toBe('—')
    for (const nome of ['Diminuir o zoom', 'Aumentar o zoom', 'Ajustar', '100%']) expect(within(d).getByRole('button', { name: nome }).getAttribute('aria-disabled')).toBe('true')
  })

  it('imagem que falha: tenta a resolução seguinte; se todas falharem, "A imagem não carregou."', async () => {
    // maxres devolve o quadro de 120×90 do YouTube (existe, mas é substituto); sddefault erra; hqdefault serve
    rede = new Map([[YT('maxresdefault'), { w: 120, h: 90 }], [YT('sddefault'), null], [YT('hqdefault'), { w: 480, h: 360 }]])
    const r = abrir(um())
    await carregada()
    expect(stage().querySelector('img')!.getAttribute('src')).toBe(YT('hqdefault'))
    expect(dialog().querySelector('.obs-tv-res')!.textContent).toContain('Exibindo hqdefault.jpg, 480×360 px (o YouTube não tem versão maior deste vídeo)')
    expect(within(dialog()).getByRole('link', { name: /Abrir original/ }).getAttribute('href')).toBe(YT('hqdefault'))
    cleanup()
    rede = new Map()
    r.unmount?.()
    abrir(um())
    await waitFor(() => expect(within(dialog()).getByText('A imagem não carregou.')).toBeTruthy())
    expect(dialog().querySelector('img')).toBeNull()
    expect(within(dialog()).getByRole('button', { name: 'Baixar' }).getAttribute('aria-disabled')).toBe('true')
    expect(within(dialog()).getByRole('link', { name: /Abrir original/ }).getAttribute('aria-disabled')).toBe('true')
  })

  it('teclas +, -, 0 e 1; com zoom as setas movem, sem zoom trocam de versão', async () => {
    abrir(dois(1))
    await carregada()
    const d = dialog()
    expect(pct()).toBe('63%') // 800/1280, ajustado
    fireEvent.keyDown(d, { key: '1' })
    expect(pct()).toBe('100%')
    fireEvent.keyDown(d, { key: '+' })
    expect(pct()).toBe('125%')
    fireEvent.keyDown(d, { key: '-' })
    expect(pct()).toBe('100%')
    // Ctrl/Alt/Meta não disparam atalho
    fireEvent.keyDown(d, { key: '+', ctrlKey: true })
    fireEvent.keyDown(d, { key: '0', metaKey: true })
    expect(pct()).toBe('100%')
    const img = stage().querySelector('img')!
    const antes = img.style.transform
    stage().focus()
    fireEvent.keyDown(stage(), { key: 'ArrowRight' })
    expect(img.style.transform).not.toBe(antes)
    expect(img.style.transform).toContain('translate(-300px')
    expect(within(d).getByText('Capa B · 2 de 2')).toBeTruthy() // com zoom a seta não troca de versão
    fireEvent.keyDown(d, { key: '0' })
    expect(pct()).toBe('63%')
    fireEvent.keyDown(stage(), { key: 'ArrowLeft' }) // sem zoom, a seta troca de versão
    expect(within(d).getByText('Capa A · 1 de 2')).toBeTruthy()
  })

  it('os botões −, +, Ajustar e 100% usam a mesma matemática das teclas', async () => {
    abrir(um())
    await carregada()
    const d = dialog()
    fireEvent.click(within(d).getByRole('button', { name: '100%' }))
    expect(pct()).toBe('100%')
    fireEvent.click(within(d).getByRole('button', { name: 'Aumentar o zoom' }))
    expect(pct()).toBe('125%')
    fireEvent.click(within(d).getByRole('button', { name: 'Diminuir o zoom' }))
    expect(pct()).toBe('100%')
    fireEvent.click(within(d).getByRole('button', { name: 'Ajustar' }))
    expect(pct()).toBe('63%')
  })

  it('a roda do mouse amplia em torno do cursor (listener não passivo)', async () => {
    abrir(um())
    await carregada()
    const ev = new WheelEvent('wheel', { deltaY: -200, clientX: 100, clientY: 100, bubbles: true, cancelable: true })
    act(() => { stage().dispatchEvent(ev) })
    expect(ev.defaultPrevented).toBe(true)
    expect(Number.parseInt(pct()!, 10)).toBeGreaterThan(63)
  })

  it('clique duplo na imagem alterna Ajustar e 100%', async () => {
    abrir(um())
    await carregada()
    expect(pct()).toBe('63%')
    fireEvent.doubleClick(stage(), { clientX: 400, clientY: 300 })
    expect(pct()).toBe('100%')
    fireEvent.doubleClick(stage(), { clientX: 400, clientY: 300 })
    expect(pct()).toBe('63%')
  })

  it('"Comparar lado a lado": duas imagens, seletor "Comparar com", zoom apagado e o contador diz "sem zoom"', async () => {
    abrir(dois(1))
    await carregada()
    const d = dialog()
    const cmp = within(d).getByRole('button', { name: 'Comparar lado a lado' })
    expect(cmp.getAttribute('aria-disabled')).toBe('false')
    fireEvent.click(cmp)
    expect(cmp.getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(d.querySelectorAll('.obs-tv-cmp img')).toHaveLength(2))
    const sel = within(d).getByLabelText('Comparar com') as HTMLSelectElement
    expect(sel.options[sel.selectedIndex].textContent).toBe('Capa A')
    expect(pct()).toBe('sem zoom')
    for (const nome of ['Diminuir o zoom', 'Aumentar o zoom', 'Ajustar', '100%']) expect(within(d).getByRole('button', { name: nome }).getAttribute('aria-disabled')).toBe('true')
    // sem zoom: a tecla não mexe
    fireEvent.keyDown(d, { key: '1' })
    expect(pct()).toBe('sem zoom')
    // cada lado traz a própria legenda
    expect(within(d).getByText(velha().caption)).toBeTruthy()
    expect(within(d).getByText(atual().caption)).toBeTruthy()
    // voltar ao modo único
    fireEvent.click(cmp)
    expect(d.querySelector('.obs-tv-cmp')).toBeNull()
  })

  it('comparar com uma versão não arquivada: o lado dela mostra o quadro tracejado e o seletor avisa', async () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 1 })
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Comparar lado a lado' }))
    const sel = within(dialog()).getByLabelText('Comparar com') as HTMLSelectElement
    expect(sel.options[sel.selectedIndex].textContent).toBe('Capa A (não arquivada)')
    expect(dialog().querySelector('.obs-tv-cmp .obs-tv-miss')).not.toBeNull()
  })

  it('"Baixar" que o navegador recusa: abre em outra aba e o status diz para salvar por lá', async () => {
    abrir(um())
    await carregada()
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)
    const abrirAba = vi.spyOn(window, 'open').mockReturnValue(null)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Baixar' }))
    await waitFor(() => expect(abrirAba).toHaveBeenCalledWith(YT('maxresdefault'), '_blank', 'noopener'))
    expect(fetchMock).toHaveBeenCalledOnce()
    await waitFor(() => expect(within(dialog()).getByText(/salve por lá/)).toBeTruthy())
    expect(within(dialog()).getByText(/salve por lá/).closest('[role="status"]')).not.toBeNull()
  })

  it('"Baixar" que o navegador deixa: baixa o arquivo e o status diz o nome', async () => {
    abrir(um())
    await carregada()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) }))
    const criar = vi.fn().mockReturnValue('blob:fake'), revogar = vi.fn()
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar })
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('thumbnail-vid1234-maxresdefault.jpg')
    })
    const abrirAba = vi.spyOn(window, 'open').mockReturnValue(null)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Baixar' }))
    await waitFor(() => expect(clique).toHaveBeenCalledOnce())
    expect(abrirAba).not.toHaveBeenCalled()
    await waitFor(() => expect(within(dialog()).getByText('Download iniciado: thumbnail-vid1234-maxresdefault.jpg')).toBeTruthy())
  })

  it('"Abrir original em nova aba" aponta para a resolução que está na tela', async () => {
    abrir(um())
    await carregada()
    const a = within(dialog()).getByRole('link', { name: /Abrir original em nova aba/ })
    expect(a.getAttribute('href')).toBe(YT('maxresdefault'))
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toContain('noopener')
  })

  it('ThumbViewer avulso (sem o hook) devolve o foco a quem o tinha ao abrir', () => {
    const fecha = vi.fn()
    const r = render(<button data-testid="b">b</button>)
    r.getByTestId('b').focus()
    const v = render(<ThumbViewer input={um()} onClose={fecha} />)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(fecha).toHaveBeenCalledOnce()
    v.unmount()
    expect(document.activeElement).toBe(r.getByTestId('b'))
  })
})
