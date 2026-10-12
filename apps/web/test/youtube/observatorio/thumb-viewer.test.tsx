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
const mainEl = () => dialog().querySelector<HTMLElement>('.obs-tv-main')!
/** O elemento que recebe o foco da imagem: um alvo ESTÁVEL do diálogo (a caixa da imagem), não o palco que desmonta a cada troca. */
const focoDoPalco = () => mainEl()
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
    const ultimo = mainEl() // 11b B1: com os controles em cima, a caixa da imagem é o último foco do anel
    const fechar = within(d).getByRole('button', { name: 'Fechar' })
    ultimo.focus()
    fireEvent.keyDown(ultimo, { key: 'Tab' })
    expect(document.activeElement).toBe(fechar) // o título (tabindex=-1) não conta como elemento do anel
    fireEvent.keyDown(fechar, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(ultimo)
    titulo.focus()
    fireEvent.keyDown(titulo, { key: 'Tab', shiftKey: true }) // logo depois de abrir: o foco está no título
    expect(document.activeElement).toBe(ultimo)
    // Tab no meio do ciclo não é interceptado
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
    focoDoPalco().focus()
    fireEvent.keyDown(focoDoPalco(), { key: 'ArrowRight' })
    expect(img.style.transform).not.toBe(antes)
    expect(img.style.transform).toContain('translate(-300px')
    expect(within(d).getByText('Capa B · 2 de 2')).toBeTruthy() // com zoom a seta não troca de versão
    fireEvent.keyDown(d, { key: '0' })
    expect(pct()).toBe('63%')
    fireEvent.keyDown(focoDoPalco(), { key: 'ArrowLeft' }) // sem zoom, a seta troca de versão
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

describe('ThumbViewer · preview (a imagem que já está na tela)', () => {
  const PREV = 'https://i.ytimg.com/vi/vid1234/mqdefault.jpg'
  it('enquanto a resolução maior carrega, mostra a imagem da tela no lugar de "Carregando a imagem…"', () => {
    abrir({ title: 'Vídeo', start: 0, versions: [atual({ preview: PREV })] })
    const quadro = dialog().querySelector('.obs-tv-main')!
    expect(quadro.querySelector('img')!.getAttribute('src')).toBe(PREV)
    expect(quadro.querySelector('.obs-tv-miss')).toBeNull()
    expect(quadro.textContent).not.toMatch(/Carregando a imagem/)
  })
  it('quando a maior chega, a maior ocupa o lugar do preview', async () => {
    abrir({ title: 'Vídeo', start: 0, versions: [atual({ preview: PREV })] })
    await carregada()
    expect(stage().querySelector('img')!.getAttribute('src')).toBe(YT('maxresdefault'))
  })
  it('sem preview o quadro continua dizendo "Carregando a imagem…"', () => {
    abrir(um())
    expect(dialog().querySelector('.obs-tv-main')!.textContent).toMatch(/Carregando a imagem/)
  })
  it('imagem que não carrega em nenhuma resolução: "A imagem não carregou." vale mais que o preview', async () => {
    rede = new Map()
    abrir({ title: 'Vídeo', start: 0, versions: [atual({ preview: PREV })] })
    await waitFor(() => expect(dialog().querySelector('.obs-tv-main')!.textContent).toMatch(/A imagem não carregou\./))
    expect(dialog().querySelector('.obs-tv-main img')).toBeNull()
  })
  it('versão sem imagem para mostrar: o quadro explicativo vale mais que o preview', () => {
    abrir({ title: 'Vídeo', start: 0, versions: [velha({ archived: null, preview: PREV })] })
    expect(dialog().querySelector('.obs-tv-miss')!.textContent).toMatch(/A coleta só guarda a thumbnail/)
    expect(dialog().querySelector('.obs-tv-main img')).toBeNull()
  })
})

describe('ThumbViewer · gatilho desmontado ao fechar', () => {
  function Host2({ input, mostra }: { input: ViewerInput; mostra: boolean }) {
    const v = useThumbViewer({ fallback: () => document.getElementById('titulo-da-tela') })
    return (
      <>
        <h1 id="titulo-da-tela" tabIndex={-1}>Título da tela</h1>
        {mostra ? <button data-testid="gatilho" onClick={e => v.open(input, e.currentTarget)}>ampliar</button> : null}
        {v.node}
      </>
    )
  }
  it('o gatilho saiu da tela: o foco vai para o título da tela, nunca fica no body', () => {
    const r = render(<Host2 input={dois()} mostra />)
    r.getByTestId('gatilho').focus()
    fireEvent.click(r.getByTestId('gatilho'))
    r.rerender(<Host2 input={dois()} mostra={false} />)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(document.getElementById('titulo-da-tela'))
  })
  it('o gatilho continua na tela: o foco volta a ele, não ao título', () => {
    const r = render(<Host2 input={dois()} mostra />)
    r.getByTestId('gatilho').focus()
    fireEvent.click(r.getByTestId('gatilho'))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(document.activeElement).toBe(r.getByTestId('gatilho'))
  })
  it('sem fallback e sem gatilho, o fechamento não lança', () => {
    const r = render(<Host input={dois()} />)
    fireEvent.click(r.getByTestId('gatilho'))
    r.unmount()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})


/* ======================================================= Rodada de conserto 1 (revisão da Tarefa 5) */
describe('ThumbViewer · C1: o foco não se perde quando a versão troca', () => {
  it('foco no palco, troca de versão, a imagem nova ainda não chegou: o foco continua dentro do diálogo e a seta seguinte ainda troca', async () => {
    abrir(dois(1))
    await carregada()
    const d = dialog()
    const alvo = [stage(), mainEl()].find(e => { e.focus(); return document.activeElement === e })
    expect(alvo, 'a área da imagem aceita foco').toBeTruthy()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    // a imagem de "Capa A" ainda não chegou (a rede responde em outro turno): nada de foco no body
    expect(within(d).getByText('Capa A · 1 de 2')).toBeTruthy()
    expect(d.contains(document.activeElement), 'o foco ficou dentro do diálogo').toBe(true)
    expect(document.activeElement).not.toBe(document.body)
    await waitFor(() => expect(stage().querySelector('img')?.getAttribute('src')).toBe(BLOB_A))
    expect(d.contains(document.activeElement)).toBe(true)
    // a tecla seguinte ainda funciona (antes, o teclado do diálogo morria)
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(within(d).getByText('Capa B · 2 de 2')).toBeTruthy()
    fireEvent.keyDown(document.activeElement!, { key: '1' })
    await waitFor(() => expect(stage().querySelector('img')?.getAttribute('src')).toBe(YT('maxresdefault')))
    fireEvent.keyDown(document.activeElement!, { key: '1' })
    expect(pct()).toBe('100%')
  })

  it('a versão nova não tem imagem (não arquivada): o foco também fica no diálogo e as setas voltam', async () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 1 })
    await carregada()
    ;[stage(), mainEl()].find(e => { e.focus(); return document.activeElement === e })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    expect(dialog().contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(document.body)
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(within(dialog()).getByText('Capa B · 2 de 2')).toBeTruthy()
  })

  it('Tab nunca sai do diálogo depois de uma troca de versão com o foco na imagem', async () => {
    abrir(dois(1))
    await carregada()
    ;[stage(), mainEl()].find(e => { e.focus(); return document.activeElement === e })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    await waitFor(() => expect(stage().querySelector('img')?.getAttribute('src')).toBe(BLOB_A))
    const ultimo = mainEl() // 11b B1: o último foco do anel é a caixa da imagem (os controles ficam em cima dela)
    ultimo.focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    ultimo.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(within(dialog()).getByRole('button', { name: 'Fechar' }))
  })
})

describe('ThumbViewer · I1: o anel de foco', () => {
  it('Shift+Tab no primeiro focável real (Fechar) vai ao último; o título não é elemento do anel', () => {
    abrir(dois())
    const d = dialog()
    const fechar = within(d).getByRole('button', { name: 'Fechar' })
    fechar.focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    fechar.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(mainEl()) // 11b B1: o último do anel é a caixa da imagem
  })

  it('sem imagem (Baixar e Abrir original apagados): os apagados entram no anel, e o Tab no último (a caixa da imagem) volta ao Fechar', async () => {
    rede = new Map()
    abrir(um())
    await waitFor(() => expect(within(dialog()).getByText('A imagem não carregou.')).toBeTruthy())
    const d = dialog()
    const baixar = within(d).getByRole('button', { name: 'Baixar' })
    const original = within(d).getByRole('link', { name: /Abrir original/ })
    const fechar = within(d).getByRole('button', { name: 'Fechar' })
    expect(baixar.getAttribute('aria-disabled')).toBe('true')
    expect(original.getAttribute('aria-disabled')).toBe('true')
    // 11b B1: os controles ficam em cima da imagem; o último do anel é a caixa da imagem, que nunca é apagada
    mainEl().focus()
    fireEvent.keyDown(mainEl(), { key: 'Tab' })
    expect(document.activeElement).toBe(fechar)
    fireEvent.keyDown(fechar, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(mainEl())
    // o primeiro focável (Fechar) nunca é apagado; os apagados continuam no caminho natural do Tab, antes da imagem
    expect(fechar.getAttribute('aria-disabled')).toBeNull()
    expect(original.compareDocumentPosition(baixar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(baixar.compareDocumentPosition(mainEl()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('clicar num texto do diálogo (foco na caixa) não mata o teclado: os atalhos valem e Shift+Tab gira', async () => {
    abrir(um())
    await carregada()
    const caixa = dialog()
    expect(caixa.getAttribute('tabindex')).toBe('-1')
    caixa.focus()
    expect(document.activeElement).toBe(caixa)
    fireEvent.keyDown(caixa, { key: '1' })
    expect(pct()).toBe('100%')
    fireEvent.keyDown(caixa, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(mainEl()) // 11b B1: o último do anel é a caixa da imagem
  })
})

describe('ThumbViewer · I2: roda e trackpad com passos pequenos', () => {
  const roda = (init: WheelEventInit) => act(() => { stage().dispatchEvent(new WheelEvent('wheel', { clientX: 100, clientY: 100, bubbles: true, cancelable: true, ...init })) })
  it('10 eventos de deltaY pequeno saem do Ajustar (antes, cada um era descartado)', async () => {
    abrir(um())
    await carregada()
    expect(pct()).toBe('63%')
    const escala = () => Number(/scale\(([\d.]+)\)/.exec(stage().querySelector('img')!.style.transform)![1])
    const ajuste = escala()
    for (let k = 0; k < 10; k++) roda({ deltaY: -1 })
    expect(stage().getAttribute('data-zoomed')).toBe('true')
    expect(escala()).toBeGreaterThan(ajuste * 1.01) // 10 passos de 0,15% acumulam: ~1,5%
    // e eles acumulam: 40 passos a mais chegam bem acima
    for (let k = 0; k < 40; k++) roda({ deltaY: -10 })
    expect(Number.parseInt(pct()!, 10)).toBeGreaterThan(90)
  })
  it('um passo fracionário (trackpad do Mac, deltaY -0,5) também sai do Ajustar', async () => {
    abrir(um())
    await carregada()
    roda({ deltaY: -0.5 })
    expect(stage().getAttribute('data-zoomed')).toBe('true')
  })
  it('deltaMode=1 (linhas, Firefox) vale 16 px por linha: três linhas ampliam como 48 px', async () => {
    abrir(um())
    await carregada()
    roda({ deltaY: -3, deltaMode: 1 })
    const linhas = pct()
    expect(Number.parseInt(linhas!, 10)).toBeGreaterThan(63)
    cleanup()
    abrir(um())
    await carregada()
    roda({ deltaY: -48, deltaMode: 0 })
    expect(pct()).toBe(linhas)
  })
  it('deltaMode=2 (páginas) vale 100 px', async () => {
    abrir(um())
    await carregada()
    roda({ deltaY: -1, deltaMode: 2 })
    const paginas = pct()
    cleanup()
    abrir(um())
    await carregada()
    roda({ deltaY: -100, deltaMode: 0 })
    expect(pct()).toBe(paginas)
  })
  it('para fora, a roda volta ao Ajustar e para nele (o mínimo é o ajuste)', async () => {
    abrir(um())
    await carregada()
    fireEvent.keyDown(dialog(), { key: '1' })
    roda({ deltaY: 4000 })
    expect(pct()).toBe('63%')
    expect(stage().getAttribute('data-zoomed')).toBeNull()
  })
})

describe('ThumbViewer · I3: a região viva do status', () => {
  it('existe sempre na árvore (role=status, aria-live), vazia no começo, e só ganha texto depois', async () => {
    abrir(um())
    await carregada()
    const msg = dialog().querySelector<HTMLElement>('.obs-tv-msg')!
    expect(msg).not.toBeNull()
    expect(msg.getAttribute('role')).toBe('status')
    expect(msg.getAttribute('aria-live')).toBe('polite')
    expect(msg.textContent).toBe('')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Ajustar' }))
    expect(dialog().querySelector('.obs-tv-msg')).toBe(msg) // o mesmo nó: a região já estava lá e só recebeu texto
    expect(msg.textContent).toBe('Ajustado à janela, 63%')
  })
  it('"Ajustar" dá o mesmo percentual antes e depois do status aparecer', async () => {
    abrir(um())
    await carregada()
    const antes = pct()
    fireEvent.click(within(dialog()).getByRole('button', { name: '100%' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Ajustar' }))
    expect(pct()).toBe(antes)
  })
})

describe('ThumbViewer · I4: a versão ATUAL sem imagem não diz que saiu do ar', () => {
  it('sem youtubeId e sem cópia: "A imagem não carregou.", Baixar e Abrir original apagados, e o seletor não diz "não arquivada"', () => {
    abrir({ title: 'T', versions: [velha(), atual({ youtubeId: null, archived: null })], start: 1 })
    const d = dialog()
    expect(within(d).getByText('A imagem não carregou.')).toBeTruthy()
    expect(d.textContent).not.toMatch(/saiu do ar antes disso/)
    expect(d.querySelector('img')).toBeNull()
    expect(within(d).getByRole('button', { name: 'Baixar' }).getAttribute('aria-disabled')).toBe('true')
    expect(within(d).getByRole('link', { name: /Abrir original/ }).getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(within(d).getByRole('button', { name: 'Comparar lado a lado' }))
    const sel = within(d).getByLabelText('Comparar com') as HTMLSelectElement
    expect(sel.options[sel.selectedIndex].textContent).toBe('Capa A')
  })
  it('a versão anterior sem cópia continua com o quadro do spec', () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 0 })
    expect(within(dialog()).getByText(missingText(velha({ archived: null })))).toBeTruthy()
  })
  it('comparar: o lado da atual sem imagem diz "A imagem não carregou."', () => {
    abrir({ title: 'T', versions: [velha(), atual({ youtubeId: null, archived: null })], start: 0 })
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Comparar lado a lado' }))
    expect(within(dialog().querySelector<HTMLElement>('.obs-tv-cmp')!).getByText('A imagem não carregou.')).toBeTruthy()
  })
})

describe('ThumbViewer · I5: Baixar honesto', () => {
  it('imagem do YouTube: NÃO tenta fetch; abre a aba de forma síncrona no clique e o status manda salvar por lá', async () => {
    abrir(um())
    await carregada()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const aba = { opener: 'x' as unknown }
    const abrirAba = vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Baixar' }))
    // síncrono: já foi chamado ANTES de qualquer await (a ativação do clique ainda vale)
    expect(abrirAba).toHaveBeenCalledTimes(1)
    expect(abrirAba.mock.calls[0]![0]).toBe(YT('maxresdefault'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(aba.opener, 'a aba aberta não guarda referência à tela').toBeNull()
    await waitFor(() => expect(dialog().querySelector('.obs-tv-msg')!.textContent).toMatch(/salve por lá/))
    expect(dialog().querySelector('.obs-tv-msg')!.textContent).toMatch(/abriu em outra aba/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('imagem do YouTube e o navegador bloqueia a aba: o status diz que bloqueou, sem afirmar que abriu', async () => {
    abrir(um())
    await carregada()
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(window, 'open').mockReturnValue(null)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Baixar' }))
    const t = dialog().querySelector('.obs-tv-msg')!.textContent ?? ''
    expect(t).toMatch(/bloque/i)
    expect(t).not.toMatch(/abriu em outra aba/)
    expect(t).toMatch(/Abrir original em nova aba/)
  })
  it('imagem arquivada (Blob): fetch + download, o nome no status, e a URL de blob é revogada depois', async () => {
    abrir({ title: 'T', versions: [velha()], start: 0 })
    await carregada()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) })
    vi.stubGlobal('fetch', fetchMock)
    const criar = vi.fn().mockReturnValue('blob:fake'), revogar = vi.fn()
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar })
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('thumbnail-capa-a.jpg')
      expect(this.href).toBe('blob:fake')
    })
    const abrirAba = vi.spyOn(window, 'open').mockReturnValue(null)
    vi.useFakeTimers()
    try {
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Baixar' }))
      await act(async () => { await vi.advanceTimersByTimeAsync(10) })
      expect(fetchMock).toHaveBeenCalledWith(BLOB_A, { mode: 'cors' })
      expect(clique).toHaveBeenCalledOnce()
      expect(abrirAba).not.toHaveBeenCalled()
      expect(dialog().querySelector('.obs-tv-msg')!.textContent).toBe('Download iniciado: thumbnail-capa-a.jpg')
      expect(revogar).not.toHaveBeenCalled()
      await act(async () => { await vi.advanceTimersByTimeAsync(4100) })
      expect(revogar).toHaveBeenCalledWith('blob:fake')
    } finally { vi.useRealTimers() }
  })
  it('imagem arquivada e o navegador recusa o fetch: abre em outra aba e o status manda salvar por lá', async () => {
    abrir({ title: 'T', versions: [velha()], start: 0 })
    await carregada()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const abrirAba = vi.spyOn(window, 'open').mockReturnValue({ opener: 'x' } as unknown as Window)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Baixar' }))
    await waitFor(() => expect(abrirAba).toHaveBeenCalledOnce())
    expect(abrirAba.mock.calls[0]![0]).toBe(BLOB_A)
    await waitFor(() => expect(dialog().querySelector('.obs-tv-msg')!.textContent).toMatch(/salve por lá/))
  })
  it('imagem arquivada, fetch recusado e aba bloqueada: não afirma que abriu', async () => {
    abrir({ title: 'T', versions: [velha()], start: 0 })
    await carregada()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    vi.spyOn(window, 'open').mockReturnValue(null)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Baixar' }))
    await waitFor(() => expect(dialog().querySelector('.obs-tv-msg')!.textContent).toMatch(/bloque/i))
    expect(dialog().querySelector('.obs-tv-msg')!.textContent).not.toMatch(/abriu em outra aba/)
  })
})

describe('ThumbViewer · "Abrir original" apagado', () => {
  it('é focável, anuncia que está indisponível (aria-disabled) e não navega', () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 0 })
    const a = within(dialog()).getByRole('link', { name: /Abrir original/ })
    expect(a.getAttribute('aria-disabled')).toBe('true')
    expect(a.getAttribute('tabindex')).toBe('0')
    expect(a.hasAttribute('href')).toBe(false)
    a.focus()
    expect(document.activeElement).toBe(a)
    expect(fireEvent.click(a), 'o clique é cancelado').toBe(false)
  })
  it('o nome acessível não repete "em nova aba"', async () => {
    abrir(um())
    await carregada()
    const a = within(dialog()).getByRole('link', { name: /Abrir original/ })
    expect(a.textContent?.replace(/\s+/g, ' ').trim()).toBe('Abrir original em nova aba')
  })
})

describe('ThumbViewer · I-11b-2: Baixar e Abrir original apagados dizem o motivo', () => {
  const descricao = (el: HTMLElement) => (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim()
  const aviso = () => dialog().querySelector('.obs-tv-msg')!.textContent
  const lado = (rotulo: string) => [...dialog().querySelectorAll<HTMLElement>('.obs-tv-side')].find(s => s.querySelector('.obs-tv-lab')!.textContent!.startsWith(rotulo))!

  it('sem imagem: o clique em Baixar e em Abrir original diz "sem imagem nesta versão" na região de aviso, sem navegar nem abrir aba', () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 0 })
    const abrirAba = vi.spyOn(window, 'open').mockReturnValue(null)
    expect(aviso()).toBe('')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Baixar' }))
    expect(aviso()).toBe('Não dá para baixar: sem imagem nesta versão.')
    fireEvent.click(within(dialog()).getByRole('link', { name: /Abrir original/ }))
    expect(aviso()).toBe('Não dá para abrir o original: sem imagem nesta versão.')
    expect(abrirAba).not.toHaveBeenCalled()
  })

  it('o Abrir original apagado avisa também com Enter e com espaço (o link sem href não dispara clique sozinho)', () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 0 })
    const a = within(dialog()).getByRole('link', { name: /Abrir original/ })
    a.focus()
    expect(fireEvent.keyDown(a, { key: 'Enter' }), 'Enter cancelado').toBe(false)
    expect(aviso()).toBe('Não dá para abrir o original: sem imagem nesta versão.')
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Baixar' }))
    expect(aviso()).toBe('Não dá para baixar: sem imagem nesta versão.')
    expect(fireEvent.keyDown(a, { key: ' ' }), 'espaço cancelado').toBe(false)
    expect(aviso()).toBe('Não dá para abrir o original: sem imagem nesta versão.')
  })

  it('o Baixar apagado, acionado por Enter ou espaço (o navegador converte em clique no botão), diz o motivo; botão continua focável e sem disabled nativo', () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 0 })
    const b = within(dialog()).getByRole('button', { name: 'Baixar' })
    expect(b.hasAttribute('disabled')).toBe(false)
    b.focus()
    expect(document.activeElement).toBe(b)
    fireEvent.click(b)
    expect(aviso()).toBe('Não dá para baixar: sem imagem nesta versão.')
  })

  it('o motivo também é a descrição acessível dos dois apagados (nome acessível não muda)', () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 0 })
    const b = within(dialog()).getByRole('button', { name: 'Baixar' })
    const a = within(dialog()).getByRole('link', { name: /Abrir original/ })
    expect(descricao(b)).toBe('Sem imagem nesta versão.')
    expect(descricao(a)).toBe('Sem imagem nesta versão.')
  })

  it('enquanto a imagem carrega, o motivo é "a imagem ainda está carregando"; quando chega, o botão volta a valer e a descrição some', async () => {
    rede = new Map([[YT('maxresdefault'), { w: 1280, h: 720 }]])
    abrir(um())
    // o sinal de rede ainda não respondeu: está carregando
    const b = within(dialog()).getByRole('button', { name: 'Baixar' })
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(descricao(b)).toBe('A imagem ainda está carregando.')
    fireEvent.click(b)
    expect(aviso()).toBe('Não dá para baixar: a imagem ainda está carregando.')
    const a = within(dialog()).getByRole('link', { name: /Abrir original/ })
    fireEvent.click(a)
    expect(aviso()).toBe('Não dá para abrir o original: a imagem ainda está carregando.')
    await carregada()
    const b2 = within(dialog()).getByRole('button', { name: 'Baixar' })
    expect(b2.getAttribute('aria-disabled')).not.toBe('true')
    expect(descricao(b2)).toBe('')
    expect(descricao(within(dialog()).getByRole('link', { name: /Abrir original/ }))).toBe('')
  })

  it('imagem que falhou ao carregar: "sem imagem", não "carregando"', async () => {
    rede = new Map()
    abrir(um())
    await waitFor(() => expect(within(dialog()).getByText('A imagem não carregou.')).toBeTruthy())
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Baixar' }))
    expect(aviso()).toBe('Não dá para baixar: sem imagem nesta versão.')
  })

  it('no comparar cada lado tem o seu motivo, com ids próprios, e o nome acessível continua "Baixar Capa A"', async () => {
    rede = new Map([[YT('maxresdefault'), { w: 1280, h: 720 }]])
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 1 })
    await carregada()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Comparar lado a lado' }))
    await waitFor(() => expect(within(lado('Capa B')).getByRole('link', { name: /Abrir original/ }).getAttribute('href')).toBe(YT('maxresdefault')))
    const bA = within(lado('Capa A')).getByRole('button', { name: 'Baixar Capa A' })
    const aA = within(lado('Capa A')).getByRole('link', { name: /Abrir original/ })
    expect(descricao(bA)).toBe('Sem imagem deste lado.')
    expect(descricao(aA)).toBe('Sem imagem deste lado.')
    fireEvent.click(aA)
    expect(aviso()).toBe('Não dá para abrir o original da Capa A: sem imagem deste lado.')
    const ids = [...dialog().querySelectorAll('[id]')].map(e => e.id)
    expect(new Set(ids).size, 'ids únicos').toBe(ids.length)
    expect(descricao(within(lado('Capa B')).getByRole('button', { name: 'Baixar Capa B' }))).toBe('')
  })
})

describe('ThumbViewer · arrastar, zoom por versão, inert e carga', () => {
  it('arrastar com o mouse move a imagem; o botão do meio/direito não inicia arrasto', async () => {
    // jsdom não tem PointerEvent: sem ele o evento perde clientX/pointerType
    class FakePointerEvent extends MouseEvent { pointerId: number; pointerType: string; constructor(t: string, i: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) { super(t, i); this.pointerId = i.pointerId ?? 0; this.pointerType = i.pointerType ?? 'mouse' } }
    vi.stubGlobal('PointerEvent', FakePointerEvent)
    abrir(um())
    await carregada()
    fireEvent.keyDown(dialog(), { key: '1' })
    const img = stage().querySelector('img')!
    const t0 = img.style.transform
    fireEvent.pointerDown(stage(), { pointerId: 7, pointerType: 'mouse', button: 2, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(stage(), { pointerId: 7, pointerType: 'mouse', clientX: 340, clientY: 260 })
    fireEvent.pointerUp(stage(), { pointerId: 7, pointerType: 'mouse', button: 2 })
    expect(img.style.transform).toBe(t0)
    fireEvent.pointerDown(stage(), { pointerId: 8, pointerType: 'mouse', button: 0, clientX: 400, clientY: 300 })
    fireEvent.pointerMove(stage(), { pointerId: 8, pointerType: 'mouse', clientX: 340, clientY: 260 })
    fireEvent.pointerUp(stage(), { pointerId: 8, pointerType: 'mouse', button: 0 })
    const m = (t: string) => /translate\((-?[\d.]+)px,(-?[\d.]+)px\)/.exec(t)!.slice(1).map(Number)
    const [x0, y0] = m(t0), [x1, y1] = m(img.style.transform)
    expect(x1! - x0!).toBeCloseTo(-60, 3)
    expect(y1! - y0!).toBeCloseTo(-40, 3)
    // depois de soltar, mover sem apertar não arrasta
    const t1 = img.style.transform
    fireEvent.pointerMove(stage(), { pointerId: 8, pointerType: 'mouse', clientX: 100, clientY: 100 })
    expect(img.style.transform).toBe(t1)
  })

  it('trocar de versão zera o zoom: A ampliada, B, de volta a A, reabre no Ajustar', async () => {
    abrir(dois(1))
    await carregada()
    fireEvent.keyDown(dialog(), { key: '1' })
    expect(pct()).toBe('100%')
    fireEvent.click(within(dialog()).getByRole('button', { name: /Anterior/ }))
    await waitFor(() => expect(stage().querySelector('img')?.getAttribute('src')).toBe(BLOB_A))
    fireEvent.click(within(dialog()).getByRole('button', { name: /Próxima/ }))
    await waitFor(() => expect(stage().querySelector('img')?.getAttribute('src')).toBe(YT('maxresdefault')))
    expect(pct()).toBe('63%')
  })

  it('a janela cresce com o zoom abaixo do novo Ajustar: a escala sobe ao novo mínimo', async () => {
    abrir(um())
    await carregada()
    fireEvent.keyDown(dialog(), { key: '+' }) // 62,5% -> 78%
    expect(pct()).toBe('78%')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1100 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 700 })
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(pct()).toBe('86%') // 1100/1280; nunca menor que o Ajustar
  })

  it('fechar (ou desmontar) com o diálogo aberto devolve o inert de cada filho do body', () => {
    const lixo = document.createElement('aside'); lixo.setAttribute('inert', ''); document.body.appendChild(lixo)
    const livre = document.createElement('aside'); document.body.appendChild(livre)
    const r = abrir(dois())
    expect(livre.hasAttribute('inert')).toBe(true)
    r.unmount() // sem Esc: a navegação desmontou a árvore
    expect(document.querySelector('.obs-tv-host')).toBeNull()
    expect(livre.hasAttribute('inert')).toBe(false)
    expect(lixo.hasAttribute('inert')).toBe(true)
    lixo.remove(); livre.remove()
  })

  it('"Carregando a imagem…" aparece uma vez só e o quadro de carga não é o tracejado da versão sem imagem', () => {
    abrir(um())
    expect(within(dialog()).getAllByText('Carregando a imagem…')).toHaveLength(1)
    expect(dialog().querySelector('.obs-tv-miss')!.getAttribute('data-load')).not.toBeNull()
  })

  it('uma sonda que nunca responde vira "A imagem não carregou." depois do tempo-limite', async () => {
    class MudaImage { onload: (() => void) | null = null; onerror: (() => void) | null = null; naturalWidth = 0; naturalHeight = 0; set src(_u: string) { /* pendurada */ } }
    vi.stubGlobal('Image', MudaImage)
    vi.useFakeTimers()
    try {
      abrir(um())
      expect(within(dialog()).getByText('Carregando a imagem…')).toBeTruthy()
      await act(async () => { await vi.advanceTimersByTimeAsync(4 * 20_000 + 100) })
      expect(within(dialog()).getByText('A imagem não carregou.')).toBeTruthy()
    } finally { vi.useRealTimers() }
  })

  it('uma URL com "|" não quebra a lista de candidatas', async () => {
    const url = 'https://x.public.blob.vercel-storage.com/t/a|b.jpg'
    rede.set(url, { w: 480, h: 360 })
    abrir({ title: 'T', versions: [velha({ archived: url })], start: 0 })
    await waitFor(() => expect(stage().querySelector('img')?.getAttribute('src')).toBe(url))
  })
})

/* ---------------------------------------------------------------- 11b · B1: os controles em cima, como no mockup (viewer.js) */
describe('ThumbViewer · 11b B1: controles na posição do mockup', () => {
  const antes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
  it('uma só barra de ferramentas entre o título e a imagem, com os grupos Versão, Zoom e Arquivo nesta ordem; nada embaixo da imagem', () => {
    abrir(dois())
    const d = dialog()
    const barra = d.querySelector<HTMLElement>('.obs-tv-tools')!
    expect(barra).not.toBeNull()
    expect([...barra.querySelectorAll(':scope > [role="group"]')].map(g => g.getAttribute('aria-label'))).toEqual(['Versão da thumbnail', 'Zoom', 'Arquivo'])
    expect(antes(d.querySelector('.obs-tv-top')!, barra)).toBe(true)
    expect(antes(barra, mainEl())).toBe(true)
    // embaixo da imagem ficam só a legenda, a resolução e o status
    expect(d.querySelector('.obs-tv-foot')).toBeNull()
    for (const g of ['Zoom', 'Arquivo']) {
      const grupo = within(d).getByRole('group', { name: g })
      expect(antes(grupo, mainEl()), g).toBe(true)
    }
    const info = d.querySelector('.obs-tv-info')!
    expect(antes(mainEl(), info)).toBe(true)
    expect(info.querySelector('[role="group"]')).toBeNull()
  })
  it('"Comparar lado a lado" mora no grupo Versão (como no mockup), não solto na barra', () => {
    abrir(dois())
    const versao = within(dialog()).getByRole('group', { name: 'Versão da thumbnail' })
    expect(versao.contains(within(dialog()).getByRole('button', { name: 'Comparar lado a lado' }))).toBe(true)
  })
  it('a ordem do Tab é a da tela: Fechar, versões, Comparar, zoom, arquivo e, por último, a caixa da imagem', async () => {
    abrir(dois())
    await carregada()
    const d = dialog()
    const nomes = [...d.querySelectorAll<HTMLElement>('button, a[href], select, [tabindex="0"]')].map(e => (e.getAttribute('aria-label') ?? e.textContent ?? '').replace(/\s+/g, ' ').trim() || e.className)
    const esperado = ['Fechar', 'Anterior', 'Próxima', 'Comparar lado a lado', 'Diminuir o zoom', 'Aumentar o zoom', 'Ajustar', '100%', 'Abrir original em nova aba', 'Baixar']
    expect(nomes.slice(0, esperado.length)).toEqual(esperado)
    expect(d.querySelectorAll('[tabindex="0"]')).toHaveLength(1)
    expect(d.querySelector('[tabindex="0"]')).toBe(mainEl()) // a caixa da imagem é o único tabindex=0 e vem depois dos botões
    expect(nomes.at(-1)).toMatch(/Setas movem a imagem/) // ... e fecha o anel
  })
  it('Tab no último focável (a caixa da imagem) volta ao Fechar; Shift+Tab no Fechar vai à caixa da imagem', async () => {
    abrir(dois())
    await carregada()
    const fechar = within(dialog()).getByRole('button', { name: 'Fechar' })
    mainEl().focus()
    fireEvent.keyDown(mainEl(), { key: 'Tab' })
    expect(document.activeElement).toBe(fechar)
    fireEvent.keyDown(fechar, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(mainEl())
  })
  it('com uma versão só a barra tem Versão (só o Comparar apagado e o motivo), Zoom e Arquivo', () => {
    abrir(um())
    const barra = dialog().querySelector('.obs-tv-tools')!
    expect([...barra.querySelectorAll(':scope > [role="group"]')].map(g => g.getAttribute('aria-label'))).toEqual(['Versão da thumbnail', 'Zoom', 'Arquivo'])
    expect(within(dialog()).queryByRole('button', { name: 'Anterior' })).toBeNull()
  })
})

/* ---------------------------------------------------------------- 11b · B2: "Baixar" e "Abrir original" por imagem no modo comparar */
describe('ThumbViewer · 11b B2: um par (Baixar, Abrir original) por imagem no modo comparar', () => {
  // dois(1): a esquerda é a Capa B (no ar, do YouTube); a direita é a Capa A (arquivada, Blob)
  const comparar = async () => {
    abrir(dois(1))
    await carregada()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Comparar lado a lado' }))
    await waitFor(() => expect(dialog().querySelectorAll('.obs-tv-cmp img')).toHaveLength(2))
    await waitFor(() => expect(dialog().querySelectorAll('.obs-tv-cmp .obs-tv-cap').length).toBeGreaterThanOrEqual(4)) // as duas medidas chegaram
  }
  const lado = (rotulo: string) => [...dialog().querySelectorAll<HTMLElement>('.obs-tv-side')].find(s => s.querySelector('.obs-tv-lab')!.textContent!.startsWith(rotulo))!

  it('cada lado traz o seu par, com o lado no nome acessível; a barra de cima perde o grupo Arquivo (ele não age mais sobre um lado só)', async () => {
    await comparar()
    const d = dialog()
    expect(within(d).queryByRole('group', { name: 'Arquivo' })).toBeNull()
    expect(d.querySelector('.obs-tv-tools')!.querySelector('a, [aria-label*="Baixar"]')).toBeNull()
    for (const [rotulo, nome] of [['Capa B', 'Capa B'], ['Capa A', 'Capa A']] as const) {
      const s = within(lado(rotulo))
      expect(s.getByRole('group', { name: `Arquivo da ${nome}` })).toBeTruthy()
      expect(s.getByRole('button', { name: `Baixar ${nome}` })).toBeTruthy()
      expect(s.getByRole('link', { name: `Abrir original em nova aba, ${nome}` })).toBeTruthy()
    }
    // o texto visível continua sendo o de sempre (o nome acessível o contém, sem trocar a palavra)
    expect(within(lado('Capa A')).getByRole('button', { name: 'Baixar Capa A' }).textContent).toBe('Baixar')
    expect(within(lado('Capa A')).getByRole('link', { name: /Abrir original/ }).textContent).toBe('Abrir original em nova aba')
    expect(within(d).getAllByRole('button', { name: /^Baixar/ })).toHaveLength(2)
    expect(within(d).getAllByRole('link', { name: /^Abrir original/ })).toHaveLength(2)
  })

  it('cada "Abrir original" aponta para a imagem do SEU lado', async () => {
    await comparar()
    expect(within(lado('Capa B')).getByRole('link', { name: /Abrir original/ }).getAttribute('href')).toBe(YT('maxresdefault'))
    expect(within(lado('Capa A')).getByRole('link', { name: /Abrir original/ }).getAttribute('href')).toBe(BLOB_A)
    for (const a of dialog().querySelectorAll('.obs-tv-side a')) { expect(a.getAttribute('target')).toBe('_blank'); expect(a.getAttribute('rel')).toContain('noopener') }
  })

  it('"Baixar" do lado arquivado baixa a imagem DELE (fetch + download); o do lado do YouTube abre a aba na imagem DELE, sem fetch', async () => {
    await comparar()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) })
    vi.stubGlobal('fetch', fetchMock)
    Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue('blob:fake'), revokeObjectURL: vi.fn() })
    const baixados: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { baixados.push(this.download) })
    const abrirAba = vi.spyOn(window, 'open').mockReturnValue({ opener: 'x' } as unknown as Window)
    // o lado do YouTube: aba na hora (síncrono), nenhum fetch
    fireEvent.click(within(lado('Capa B')).getByRole('button', { name: 'Baixar Capa B' }))
    expect(abrirAba).toHaveBeenCalledTimes(1)
    expect(abrirAba.mock.calls[0]![0]).toBe(YT('maxresdefault'))
    expect(fetchMock).not.toHaveBeenCalled()
    // o lado arquivado: o fetch é da imagem DELE, e o arquivo leva o nome DELE
    fireEvent.click(within(lado('Capa A')).getByRole('button', { name: 'Baixar Capa A' }))
    await waitFor(() => expect(baixados).toEqual(['thumbnail-capa-a.jpg']))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(BLOB_A, { mode: 'cors' })
    expect(abrirAba).toHaveBeenCalledTimes(1)
  })

  it('o retorno do Baixar aparece na linha de status também no modo comparar (antes a frase "Comparando…" o escondia)', async () => {
    await comparar()
    const status = () => dialog().querySelector('.obs-tv-msg')!.textContent
    expect(status()).toBe('Comparando Capa B com Capa A')
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(window, 'open').mockReturnValue({ opener: 'x' } as unknown as Window)
    fireEvent.click(within(lado('Capa B')).getByRole('button', { name: 'Baixar Capa B' }))
    await waitFor(() => expect(status()).toMatch(/salve por lá/))
    // trocar o "Comparar com" apaga o aviso de um arquivo que já não está na tela e volta a dizer o par
    fireEvent.change(within(dialog()).getByLabelText('Comparar com'), { target: { value: '0' } })
    expect(status()).toBe('Comparando Capa B com Capa A')
  })

  it('aba bloqueada no lado do YouTube: o status diz que bloqueou, sem afirmar que abriu', async () => {
    await comparar()
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(window, 'open').mockReturnValue(null)
    fireEvent.click(within(lado('Capa B')).getByRole('button', { name: 'Baixar Capa B' }))
    const t = dialog().querySelector('.obs-tv-msg')!.textContent ?? ''
    expect(t).toMatch(/bloque/i)
    expect(t).not.toMatch(/abriu em outra aba/)
  })

  it('lado sem imagem (versão não arquivada): o par DESSE lado fica apagado e o do outro lado continua valendo', async () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 1 })
    await carregada()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Comparar lado a lado' }))
    await waitFor(() => expect(within(lado('Capa B')).getByRole('link', { name: /Abrir original/ }).getAttribute('href')).toBe(YT('maxresdefault')))
    const semImagem = within(lado('Capa A'))
    expect(semImagem.getByRole('button', { name: 'Baixar Capa A' }).getAttribute('aria-disabled')).toBe('true')
    const link = semImagem.getByRole('link', { name: /Abrir original/ })
    expect(link.getAttribute('aria-disabled')).toBe('true')
    expect(link.hasAttribute('href')).toBe(false)
    expect(fireEvent.click(link), 'o clique é cancelado').toBe(false)
    expect(within(lado('Capa B')).getByRole('button', { name: 'Baixar Capa B' }).getAttribute('aria-disabled')).not.toBe('true')
  })

  it('o Baixar apagado de um lado não baixa nem abre aba (nem fetch nem aba), mas diz o motivo na região de aviso (I-11b-2: antes era silêncio)', async () => {
    abrir({ title: 'T', versions: [velha({ archived: null }), atual()], start: 1 })
    await carregada()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Comparar lado a lado' }))
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    const abrirAba = vi.spyOn(window, 'open').mockReturnValue(null)
    fireEvent.click(within(lado('Capa A')).getByRole('button', { name: 'Baixar Capa A' }))
    expect(fetchMock).not.toHaveBeenCalled(); expect(abrirAba).not.toHaveBeenCalled()
    expect(dialog().querySelector('.obs-tv-msg')!.textContent).toBe('Não dá para baixar a Capa A: sem imagem deste lado.')
  })

  it('fora do modo comparar nada muda: um só grupo Arquivo na barra, com os nomes de sempre; ao sair do comparar ele volta', async () => {
    abrir(dois(1))
    await carregada()
    const d = dialog()
    expect(within(d).getByRole('group', { name: 'Arquivo' })).toBeTruthy()
    expect(within(d).getByRole('button', { name: 'Baixar' })).toBeTruthy()
    expect(within(d).getByRole('link', { name: 'Abrir original em nova aba' })).toBeTruthy()
    const cmp = within(d).getByRole('button', { name: 'Comparar lado a lado' })
    fireEvent.click(cmp)
    await waitFor(() => expect(d.querySelectorAll('.obs-tv-cmp img')).toHaveLength(2))
    expect(within(d).queryByRole('button', { name: 'Baixar' })).toBeNull()
    fireEvent.click(cmp)
    await carregada()
    expect(within(d).getByRole('group', { name: 'Arquivo' })).toBeTruthy()
    expect(within(d).getByRole('button', { name: 'Baixar' })).toBeTruthy()
    expect(d.querySelectorAll('.obs-tv-side')).toHaveLength(0)
  })

  it('o anel de foco no modo comparar inclui os dois pares: o último é o Baixar do lado direito e dele o Tab volta ao Fechar', async () => {
    await comparar()
    const ultimo = within(lado('Capa A')).getByRole('button', { name: 'Baixar Capa A' })
    ultimo.focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    ultimo.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(within(dialog()).getByRole('button', { name: 'Fechar' }))
  })
})
