// @vitest-environment jsdom
// M3b T12 (B1/B2): o diálogo "Remover canal" lê o arquivo e o Blob (Q1 a Q3, falha, corrida) e entrega ao aviso o que leu (Q4).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, fireEvent, cleanup } from '@testing-library/react'
import { RemoveDialog, type ImpactAnswer, type Desfecho } from '@/app/cms/(authed)/youtube/competitors/_canais/remove-dialog'
import { SIZER_PORQUE, type ArquivoImpact } from '@/app/cms/(authed)/youtube/competitors/_canais/remover-model'

const IMPACT = { name: 'Viaje com Marina', videos: 12, pinned: 2, versions: 36, dailyDays: 14, bookmarks: 1, readings: 200, watch: { readings: 20, thumbs: 0, alvos: 0 } }
const VAZIO: ArquivoImpact = { meses: 0, de: null, ate: null, foraDoBanco: { meses: 0, de: null, ate: null }, videosRetirados: { n: 0, de: null, ate: null }, imagensBlob: 0 }
const resp = (arq: Partial<ArquivoImpact>, extra: Partial<Extract<ImpactAnswer, { ok: true }>> = {}): ImpactAnswer =>
  ({ ok: true, impact: IMPACT, semGuardar: { pode: true }, arquivo: { ...VAZIO, ...arq }, capacidade: 'nao-sim', dataDoComando: null, ...extra })

function mount(o: { impact?: () => Promise<ImpactAnswer>; apagar?: ReturnType<typeof vi.fn> } = {}) {
  const onApagar = o.apagar ?? vi.fn(async () => ({ ok: true as const, videos: 12, leituras: 220, imagensRestantes: 47 }))
  const onDone = vi.fn<(d: Desfecho) => void>()
  const r = render(
    <div data-obs=""><div data-obs-screen="canais">
      <RemoveDialog id="c1" name="Viaje com Marina" onImpact={o.impact ?? (async () => resp({}))} onPedir={vi.fn() as never} onApagar={onApagar as never}
        onCancel={vi.fn()} onDone={onDone} onConferir={vi.fn()} onBloqueio={vi.fn()} trap={() => {}} />
    </div></div>,
  )
  const q = <T extends Element = HTMLElement>(s: string) => r.container.querySelector<T>(s)
  const radio = (v: string) => q<HTMLInputElement>(`input[type="radio"][value="${v}"]`)!
  const rows = () => [...r.container.querySelectorAll('.fx-shown .fx-loss li')].map(li => li.textContent)
  const btn = (t: string | RegExp) => [...r.container.querySelectorAll('button')].find(b => (typeof t === 'string' ? b.textContent === t : t.test(b.textContent ?? '')))!
  return { ...r, onApagar, onDone, q, radio, rows, btn }
}
afterEach(() => { vi.useRealTimers(); cleanup() })

describe('Q1 · a 5ª linha "meses já no arquivo"', () => {
  it('N = 0: quatro linhas, como hoje', async () => {
    const m = mount(); await act(async () => {})
    expect(m.rows()).toHaveLength(4)
  })
  it('N > 0 no guardar: 5ª linha com a faixa e "Ficam como estão"', async () => {
    const m = mount({ impact: async () => resp({ meses: 9, de: '2026-01', ate: '2026-09' }) }); await act(async () => {})
    expect(m.rows()).toHaveLength(5)
    expect(m.rows()[4]).toBe('9meses já no arquivode 01/2026 a 09/2026. Ficam como estão: o arquivo não é tocado.')
  })
  it('1 mês: singular', async () => {
    const m = mount({ impact: async () => resp({ meses: 1, de: '2026-09', ate: '2026-09' }) }); await act(async () => {})
    expect(m.rows()[4]).toBe('1mês já no arquivoem 09/2026. Fica como está.')
  })
  it('contando: quatro linhas "contando…" e nenhuma 5ª linha antes da leitura', () => {
    const m = mount({ impact: () => new Promise(() => {}) })
    expect(m.rows()).toHaveLength(4)
  })
  it('o sizer reserva a 5ª linha (a caixa não cresce quando a contagem chega)', async () => {
    const m = mount(); await act(async () => {})
    expect(m.container.querySelectorAll('.fx-sizer li')).toHaveLength(5)
  })
})

describe('Q2 · apagar sem guardar desligado quando há arquivo', () => {
  it('meses no arquivo: rádio desligado, Guardar marcado, frase ligada por aria-describedby', async () => {
    const m = mount({ impact: async () => resp({ meses: 2, de: '2026-09', ate: '2026-10' }) }); await act(async () => {})
    expect(m.radio('apagar').disabled).toBe(true)
    expect(m.radio('guardar').checked).toBe(true)
    const id = m.radio('apagar').getAttribute('aria-describedby')!
    expect(m.container.querySelector('#' + CSS.escape(id))!.textContent).toBe('Este canal tem 2 meses no arquivo (09/2026 a 10/2026). Para não perder esse histórico, use Guardar no NAS.')
  })
  it('só vídeos retirados: a frase da única cópia, e nenhuma 5ª linha', async () => {
    const m = mount({ impact: async () => resp({ videosRetirados: { n: 3, de: null, ate: null } }) }); await act(async () => {})
    expect(m.radio('apagar').disabled).toBe(true)
    expect(m.container.textContent).toContain('3 vídeos deste canal já foram retirados do banco e só existem no arquivo. Para não perder a única cópia, use Guardar no NAS.')
    expect(m.rows()).toHaveLength(4)
  })
  it('o ⓘ do rádio desligado é cinza: nenhuma classe âmbar de aviso', async () => {
    const m = mount({ impact: async () => resp({ meses: 2, de: '2026-09', ate: '2026-10' }) }); await act(async () => {})
    expect(m.q('.opt.off .why')).not.toBeNull()
    expect(m.q('.opt.off .why.warn')).toBeNull()
  })
  it('sem arquivo: o rádio liga como hoje e não há frase visível', async () => {
    const m = mount(); await act(async () => {})
    expect(m.radio('apagar').disabled).toBe(false)
    expect(m.radio('apagar').hasAttribute('aria-describedby')).toBe(false)
  })
  it('o rádio reserva a altura da frase mais longa, invisível (o botão não pula)', async () => {
    const m = mount(); await act(async () => {})
    const s = m.q('.opt .why-sizer')!
    expect(s.getAttribute('aria-hidden')).toBe('true')
    expect(s.textContent).toBe(SIZER_PORQUE)
  })
  it('falha_contagem: arquivo e Blob vêm juntos ou nenhum; apagar desligado, guardar livre, nenhum zero', async () => {
    const m = mount({ impact: async () => ({ ok: false }) }); await act(async () => {})
    expect(m.radio('apagar').disabled).toBe(true)
    expect(m.container.textContent).toContain('Não foi possível contar o que sai.')
    expect(m.q('.fx-shown')).toBeNull()
    expect(m.rows()).toEqual([])
    expect(m.btn('Parar coleta e agendar guarda no NAS').hasAttribute('aria-disabled')).toBe(false)
  })
  it('corrida: o servidor responde apagar_com_arquivo => a frase do Q2, rádio desligado, e Escolher guardar', async () => {
    const apagar = vi.fn(async () => ({ ok: false as const, codigo: 'apagar_com_arquivo', frase: 'Este canal tem meses no arquivo. Para não perder esse histórico, use Guardar no NAS.' }))
    const m = mount({ apagar })
    await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    fireEvent.change(m.q('.fld input')!, { target: { value: 'Viaje com Marina' } })
    await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
    expect(m.q('.fx-msg.fx-err')!.textContent).toContain('Para não perder esse histórico, use Guardar no NAS.')
    expect(m.q('.fx-msg.fx-err')!.textContent).not.toContain('não pode ser apagado')
    expect(m.radio('apagar').disabled).toBe(true)
    await act(async () => { fireEvent.click(m.btn('Escolher guardar no NAS')) })
    expect(m.radio('guardar').checked).toBe(true)
  })
})

describe('Q3 · a frase do Blob antes do clique (B2)', () => {
  const abrirApagar = async (m: ReturnType<typeof mount>) => { await act(async () => {}); fireEvent.click(m.radio('apagar')) }
  it('N > 0 no caminho apagar: a frase, a de capacidade e o ⓘ', async () => {
    const m = mount({ impact: async () => resp({ imagensBlob: 47 }) }); await abrirApagar(m)
    const b = m.q('.fx-blob')!
    expect(b.textContent).toContain('Este canal tem 47 imagens guardadas no Blob')
    expect(b.textContent).toContain('Ao apagar, elas ficam anotadas para apagar.')
    expect(b.textContent).toContain('O site tenta apagar as imagens agora; o que não sair fica anotado, e o aviso depois do clique diz quantas sobraram.')
    expect(b.textContent).not.toMatch(/comando/i)
    expect(b.querySelector('button.ri-ibtn')!.getAttribute('aria-label')).toBe('O que é o Blob')
  })
  it('singular', async () => {
    const m = mount({ impact: async () => resp({ imagensBlob: 1 }, { capacidade: 'nao-nao' }) }); await abrirApagar(m)
    expect(m.q('.fx-blob')!.textContent).toContain('Este canal tem 1 imagem guardada no Blob')
    expect(m.q('.fx-blob')!.textContent).toContain('ela fica anotada')
    expect(m.q('.fx-blob')!.textContent).toContain('o aviso depois do clique diz se sobrou.')
  })
  it('sem imagens: nenhuma frase', async () => {
    const m = mount(); await abrirApagar(m)
    expect(m.q('.fx-blob')).toBeNull()
  })
  it('no caminho guardar a frase do Blob não aparece (as imagens saem pela exportação)', async () => {
    const m = mount({ impact: async () => resp({ imagensBlob: 47 }) }); await act(async () => {})
    expect(m.q('.fx-blob')).toBeNull()
  })
  it('Esc com o ⓘ aberto fecha só o ⓘ: o popover nativo dispara `toggle` (fechado) ANTES do keydown chegar ao diálogo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const onCancel = vi.fn()
    const r = render(<div data-obs=""><div data-obs-screen="canais"><RemoveDialog id="c1" name="V" onImpact={async () => resp({ imagensBlob: 3 })} onPedir={vi.fn() as never} onApagar={vi.fn() as never}
      onCancel={onCancel} onDone={vi.fn()} onConferir={vi.fn()} onBloqueio={vi.fn()} trap={() => {}} /></div></div>)
    await act(async () => {})
    fireEvent.click(r.container.querySelector('input[value="apagar"]')!)
    const ib = r.container.querySelector('.fx-blob .ri-ibtn')!
    const pop = r.container.querySelector<HTMLElement>('.fx-blob .ri-pop')!
    const toggle = (novo: string) => act(() => { pop.dispatchEvent(Object.assign(new Event('toggle'), { newState: novo })) })
    toggle('open')
    // ordem real do navegador: o Esc fecha o popover (toggle fechado) e só depois o keydown sobe até o diálogo
    toggle('closed')
    // false = defaultPrevented: é o que faz o ouvinte do document (canais-screen) desistir; no navegador o stopPropagation não o barra
    expect(fireEvent.keyDown(ib, { key: 'Escape' })).toBe(false)
    expect(onCancel).not.toHaveBeenCalled()
    // o Esc seguinte, já sem ⓘ aberto e fora da janela do anterior, fecha o diálogo
    vi.setSystemTime(Date.now() + 1000)
    fireEvent.keyDown(ib, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
  it('Esc com o ⓘ ainda aberto no keydown (toggle depois): também só fecha o ⓘ', async () => {
    const onCancel = vi.fn()
    const r = render(<div data-obs=""><div data-obs-screen="canais"><RemoveDialog id="c1" name="V" onImpact={async () => resp({ imagensBlob: 3 })} onPedir={vi.fn() as never} onApagar={vi.fn() as never}
      onCancel={onCancel} onDone={vi.fn()} onConferir={vi.fn()} onBloqueio={vi.fn()} trap={() => {}} /></div></div>)
    await act(async () => {})
    fireEvent.click(r.container.querySelector('input[value="apagar"]')!)
    const pop = r.container.querySelector<HTMLElement>('.fx-blob .ri-pop')!
    act(() => { pop.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' })) })
    expect(fireEvent.keyDown(r.container.querySelector('.fx-blob .ri-ibtn')!, { key: 'Escape' })).toBe(false)
    expect(onCancel).not.toHaveBeenCalled()
  })
  it('o ⓘ do Blob é cinza (como o do rádio) e o ponto vem colado a ele', async () => {
    const fs = await import('node:fs'); const path = await import('node:path')
    const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
    for (const f of ['_canais/canais.css', '_chrome/kit.css']) {
      const css = fs.readFileSync(path.join(DIR, f), 'utf8')
      expect(css, f).toMatch(/\.modal \.fx-blob > \.fx-i\{color:var\(--muted\)\}/)
      expect(css, f).toMatch(/\.fx-blob \.ri-ibtn\{[^}]*margin:-4px 1px -4px 1px/)
    }
  })
  it('depois da recusa por corrida o rádio volta a desligado com a frase do Q2, e "O que será apagado" sai', async () => {
    const apagar = vi.fn(async () => ({ ok: false as const, codigo: 'apagar_com_arquivo', frase: 'x' }))
    const m = mount({ apagar, impact: async () => resp({ imagensBlob: 3 }) })
    await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    fireEvent.change(m.q('.fld input')!, { target: { value: 'Viaje com Marina' } })
    await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
    expect(m.radio('apagar').disabled).toBe(true)
    expect(m.radio('apagar').checked).toBe(false)
    expect(m.radio('guardar').checked).toBe(true)
    expect(m.container.textContent).toContain('Este canal tem meses no arquivo. Para não perder esse histórico, use Guardar no NAS.')
    expect(m.q('.fx-blob')).toBeNull()
  })
})

describe('I1 · resposta sem `arquivo` nunca liga o apagar (fail closed)', () => {
  it('ok: true sem o campo ⇒ rádio desligado e "Não foi possível contar o que sai."', async () => {
    const m = mount({ impact: async () => ({ ok: true, impact: IMPACT, semGuardar: { pode: true } }) as unknown as ImpactAnswer }); await act(async () => {})
    expect(m.radio('apagar').disabled).toBe(true)
    expect(m.container.textContent).toContain('Não foi possível contar o que sai.')
    expect(m.rows()).toEqual([])
  })
})
describe('Q4 · o desfecho leva o que o aviso precisa', () => {
  it('apagar: imagensRestantes (depois do clique), imagensAoAbrir (ao abrir), capacidade e data', async () => {
    const m = mount({ impact: async () => resp({ imagensBlob: 47 }, { capacidade: 'nao-sim', dataDoComando: '2026-12-05' }) })
    await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    fireEvent.change(m.q('.fld input')!, { target: { value: 'Viaje com Marina' } })
    await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
    expect(m.onDone).toHaveBeenCalledWith({ caminho: 'apagar', videos: 12, leituras: 220, imagensRestantes: 47, imagensAoAbrir: 47, capacidade: 'nao-sim', dataDoComando: '2026-12-05' })
  })
  it('sem imagensRestantes na resposta: o campo não existe no desfecho (o aviso diz que não deu para conferir)', async () => {
    const apagar = vi.fn(async () => ({ ok: true as const, videos: 12 }))
    const m = mount({ apagar, impact: async () => resp({ imagensBlob: 47 }) })
    await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    fireEvent.change(m.q('.fld input')!, { target: { value: 'Viaje com Marina' } })
    await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
    const d = m.onDone.mock.calls[0]![0]
    expect(d).toMatchObject({ caminho: 'apagar', imagensAoAbrir: 47 }); expect('imagensRestantes' in d).toBe(false)
  })
})

describe('D6 · o CSS do diálogo', async () => {
  const fs = await import('node:fs'); const path = await import('node:path')
  const DIR = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
  for (const f of ['_canais/canais.css', '_chrome/kit.css']) {
    it(`${f}: .acts quebra a linha e, a 460 px, os botões ocupam a linha`, () => {
      const css = fs.readFileSync(path.join(DIR, f), 'utf8')
      expect(css).toMatch(/\.modal \.fx-remove \.acts\{[^}]*flex-wrap:wrap/)
      expect(css).toMatch(/@media \(max-width:460px\)\{[^}]*\.fx-remove \.acts \.btn\{[^}]*flex:1 1 100%/)
    })
  }
})

describe('ajustes Logan/Naksu 25/10', () => {
  it('N1/N3: apagar não reserva o why-sizer nem a 5ª linha; falha de contagem desmonta o sizer', async () => {
    const m = mount(); await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    expect(m.q('.why-sizer')).toBeNull()
    // já contado, o caminho apagar não reserva nada (Gio r4: sobravam ~120 px com o sizer de 4 linhas)
    expect(m.container.querySelector('.fx-sizer')).toBeNull()
    fireEvent.click(m.radio('guardar'))
    // M3b-G5: já contado e visto no apagar, voltar a guardar não remonta a reserva (deixava ~150 px de vazio a 390)
    await act(async () => {})
    expect(m.container.querySelector('.fx-sizer')).toBeNull()
    const f = mount({ impact: async () => ({ ok: false }) }); await act(async () => {})
    expect(f.container.querySelector('.fx-sizer')).toBeNull()
  })
  it('L3: depois da recusa por corrida, a lista ganha a 5ª linha e a faixa fica', async () => {
    const impact = vi.fn<() => Promise<ImpactAnswer>>().mockResolvedValueOnce(resp({})).mockResolvedValue(resp({ meses: 2, de: '2026-09', ate: '2026-10' }))
    const apagar = vi.fn(async () => ({ ok: false as const, codigo: 'apagar_com_arquivo', frase: 'x' }))
    const m = mount({ impact, apagar }); await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    fireEvent.change(m.q('.fld input')!, { target: { value: 'Viaje com Marina' } })
    await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
    await act(async () => {})
    expect(impact).toHaveBeenCalledTimes(2)
    expect(m.q('.fx-msg.fx-err')).not.toBeNull()
    expect(m.rows()).toHaveLength(5)
  })
  it('L4: clicar o botão tracejado sem o nome foca o campo', async () => {
    const m = mount(); await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    fireEvent.click(m.btn('Apagar sem guardar'))
    expect(document.activeElement).toBe(m.q('.fld input'))
  })
  it('L5: 0 versões não aparece', async () => {
    const { TXT } = await import('@/app/cms/(authed)/youtube/competitors/_canais/remover-model')
    expect(TXT.subVideos(0)).toBe('')
    expect(TXT.subVideos(1)).toContain('1 versão')
  })
  it('item 0: Esc com o ⓘ aberto fecha o popover aberto do diálogo (e não o diálogo)', async () => {
    const m = mount({ impact: async () => resp({ imagensBlob: 47 }) }); await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    const pop = document.createElement('div'); const hide = vi.fn(); (pop as unknown as { hidePopover: () => void }).hidePopover = hide
    m.q('.box')!.appendChild(pop)
    const orig = Element.prototype.querySelector
    vi.spyOn(Element.prototype, 'querySelector').mockImplementation(function (this: Element, s: string) { return s === ':popover-open' ? pop : orig.call(this, s) })
    expect(m.q('.ri-ibtn')).not.toBeNull()
    const p = m.q('.ri-pop')!
    p.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }))
    fireEvent.keyDown(m.q('.modal')!, { key: 'Escape' })
    expect(hide).toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
