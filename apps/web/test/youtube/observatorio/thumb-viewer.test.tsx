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
    const ultimo = within(d).getByRole('button', { name: 'Baixar' })
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
    const baixar = within(dialog()).getByRole('button', { name: 'Baixar' })
    baixar.focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    baixar.dispatchEvent(ev)
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
    expect(document.activeElement).toBe(within(d).getByRole('button', { name: 'Baixar' }))
  })

  it('último focável apagado (aria-disabled): Tab nele volta ao Fechar, Shift+Tab no Fechar volta a ele, e o apagado entra no anel', async () => {
    rede = new Map()
    abrir(um())
    await waitFor(() => expect(within(dialog()).getByText('A imagem não carregou.')).toBeTruthy())
    const d = dialog()
    const baixar = within(d).getByRole('button', { name: 'Baixar' })
    const original = within(d).getByRole('link', { name: /Abrir original/ })
    const fechar = within(d).getByRole('button', { name: 'Fechar' })
    expect(baixar.getAttribute('aria-disabled')).toBe('true')
    expect(original.getAttribute('aria-disabled')).toBe('true')
    baixar.focus()
    fireEvent.keyDown(baixar, { key: 'Tab' })
    expect(document.activeElement).toBe(fechar)
    fireEvent.keyDown(fechar, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(baixar)
    // o primeiro focável (Fechar) nunca é apagado; os apagados do meio continuam no caminho natural do Tab
    expect(fechar.getAttribute('aria-disabled')).toBeNull()
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
    expect(document.activeElement).toBe(within(caixa).getByRole('button', { name: 'Baixar' }))
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
