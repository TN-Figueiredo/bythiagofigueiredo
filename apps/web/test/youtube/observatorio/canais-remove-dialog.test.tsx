// @vitest-environment jsdom
// apps/web/test/youtube/observatorio/canais-remove-dialog.test.tsx
// F2 do Remover canal, T5: a janela com o motivo e os estados do mockup aprovado (19/10).
import { StrictMode } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RemoveDialog, type ImpactAnswer, type Desfecho } from '@/app/cms/(authed)/youtube/competitors/_canais/remove-dialog'
import { TXT } from '@/app/cms/(authed)/youtube/competitors/_canais/remover-model'

const IMPACT = { name: 'Ryan Otis', videos: 340, pinned: 2, versions: 1208, dailyDays: 12, bookmarks: 3, readings: 28, watch: { readings: 20, thumbs: 0, alvos: 0 } }
const PODE: ImpactAnswer = { ok: true, impact: IMPACT, semGuardar: { pode: true } }
type Pedir = (id: string) => Promise<{ ok: true; jaPedido: boolean } | { ok: false; codigo: never; frase: string }>
function deferred<T>() { let done!: (r: T) => void; let fail!: (e: unknown) => void; const p = new Promise<T>((a, b) => { done = a; fail = b }); return { p, done, fail } }

function mount(o: { impact?: () => Promise<ImpactAnswer>; pedir?: ReturnType<typeof vi.fn>; apagar?: ReturnType<typeof vi.fn> } = {}) {
  const onPedir = o.pedir ?? vi.fn(async () => ({ ok: true as const, jaPedido: false }))
  const onApagar = o.apagar ?? vi.fn(async () => ({ ok: true as const, videos: 340 }))
  const onCancel = vi.fn(), onDone = vi.fn<(d: Desfecho) => void>(), onConferir = vi.fn(), onBloqueio = vi.fn()
  const onImpact = o.impact ?? (async () => PODE)
  const r = render(
    <div data-obs=""><div data-obs-screen="canais">
      <RemoveDialog id="c1" name="Ryan Otis" onImpact={onImpact} onPedir={onPedir as never} onApagar={onApagar as never}
        onCancel={onCancel} onDone={onDone} onConferir={onConferir} onBloqueio={onBloqueio} trap={() => {}} />
    </div></div>,
  )
  const q = (s: string) => r.container.querySelector(s)!
  const btn = (t: string | RegExp) => [...r.container.querySelectorAll('button')].find(b => (typeof t === 'string' ? b.textContent === t : t.test(b.textContent ?? '')))!
  const radio = (v: string) => r.container.querySelector(`input[type="radio"][value="${v}"]`) as HTMLInputElement
  const rows = () => [...r.container.querySelectorAll('.fx-loss li')].map(li => li.textContent)
  return { ...r, onPedir, onApagar, onCancel, onDone, onConferir, onBloqueio, q, btn, radio, rows, status: () => q('[role="status"]'), nome: () => q('input[type="text"], .fld input') as HTMLInputElement }
}
afterEach(() => { vi.useRealTimers(); cleanup() })

describe('RemoveDialog · contando e pronto', () => {
  it('D5.1 contando: (b) marcado, botão desabilitado com o status, quatro linhas "contando…"', () => {
    const d = deferred<ImpactAnswer>(), m = mount({ impact: () => d.p })
    expect(m.radio('guardar').checked).toBe(true)
    const b = m.btn('Parar coleta e agendar guarda no NAS')
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.getAttribute('aria-describedby')).toBe(m.status().id)
    expect(m.status().textContent).toBe(TXT.contando)
    expect(m.rows()).toHaveLength(4)
    expect(m.rows().every(t => t!.startsWith('contando…'))).toBe(true)
    expect(m.q('.fx-loss').getAttribute('aria-busy')).toBe('true')
  })

  it('D5.2 b: a contagem chega, as subfrases aparecem e leituras = forja + watch; o foco está no rádio (b)', async () => {
    const m = mount()
    await act(async () => {})
    expect(m.btn('Parar coleta e agendar guarda no NAS').hasAttribute('aria-disabled')).toBe(false)
    expect(m.container.textContent).toContain(TXT.falta)
    expect(m.container.querySelector('.fld')).toBeNull()
    expect(m.rows()).toEqual([
      '340vídeoscom 1.208 versões de título, thumbnail e descrição',
      '12dias de registrosviews diárias dos vídeos',
      '48leituras da forja e da página de vídeofeitas para vídeos deste canal, inclusive as da página de vídeo',
      '5itens fixados ou salvos2 vídeos fixados e 3 trocas no swipe file',
    ])
    expect(document.activeElement).toBe(m.radio('guardar'))
    expect(m.q('.fx-loss').hasAttribute('aria-busy')).toBe(false)
  })

  it('a linha de leituras diz que também saem fotos e alvos da página de vídeo, quando há', async () => {
    const m = mount({ impact: async () => ({ ok: true, impact: { ...IMPACT, watch: { readings: 20, thumbs: 3, alvos: 1 } }, semGuardar: { pode: true } }) })
    await act(async () => {})
    expect(m.rows()[2]).toContain('mais as fotos e os alvos da página de vídeo')
  })

  it('zeros de verdade: "nenhuma" e sem explicação; a linha continua (a altura é reservada)', async () => {
    const m = mount({ impact: async () => ({ ok: true, impact: { ...IMPACT, readings: 0, watch: { readings: 0, thumbs: 0, alvos: 0 } }, semGuardar: { pode: true } }) })
    await act(async () => {})
    expect(m.rows()[2]).toBe('nenhumaleitura da forja e da página de vídeo')
    expect(m.container.querySelectorAll('.fx-loss li')).toHaveLength(4)
  })

  it('D5.10 role, aria-modal, título e nenhum onClick no fundo', async () => {
    const m = mount()
    await act(async () => {})
    const dlg = m.q('[role="dialog"]')
    expect(dlg.getAttribute('aria-modal')).toBe('true')
    expect(m.q('h2').textContent).toBe('Remover Ryan Otis?')
    expect(dlg.getAttribute('aria-labelledby')).toBe(m.q('h2').id)
    fireEvent.click(dlg)
    expect(m.onCancel).not.toHaveBeenCalled()
  })
})

describe('RemoveDialog · apagar sem guardar', () => {
  it('D5.3 a: trocar mostra o campo; o nome libera sem diferenciar caixa e o onApagar recebe o texto sem trim', async () => {
    const m = mount()
    await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    expect(m.container.textContent).toContain(TXT.leadApagar)
    const b = m.btn('Apagar sem guardar')
    expect(b.className).toContain('danger')
    expect(b.getAttribute('aria-disabled')).toBe('true')
    const input = m.container.querySelector('.fld input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ryan otic' } })
    expect(m.btn('Apagar sem guardar').getAttribute('aria-disabled')).toBe('true')
    expect(m.container.textContent).toContain(TXT.nomeDica)
    fireEvent.change(input, { target: { value: '  ryan otis ' } })
    expect(m.btn('Apagar sem guardar').hasAttribute('aria-disabled')).toBe(false)
    expect(m.container.textContent).toContain(TXT.nomeOk)
    await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
    expect(m.onApagar).toHaveBeenCalledWith('c1', '  ryan otis ')
  })

  it('D5.4 a-antigo: (a) desabilitado, com a frase ligada por aria-describedby', async () => {
    const m = mount({ impact: async () => ({ ok: true, impact: IMPACT, semGuardar: { pode: false, porque: 'antigo', meses: 7 } }) })
    await act(async () => {})
    const a = m.radio('apagar')
    expect(a.disabled).toBe(true)
    const why = m.container.querySelector('#' + CSS.escape(a.getAttribute('aria-describedby')!))!
    expect(why.textContent).toBe('Este canal tem 7 meses de histórico. Para não perder tudo por engano, use "Guardar no NAS".')
  })

  it('D5.5 falha-contagem: (a) bloqueada; "Contar de novo" não fecha e libera; (b) segue habilitado', async () => {
    let n = 0
    const m = mount({ impact: async () => (++n === 1 ? { ok: false } : PODE) })
    await act(async () => {})
    expect(m.radio('apagar').disabled).toBe(true)
    expect(m.container.textContent).toContain('Precisa da contagem para apagar sem guardar.')
    expect(m.container.textContent).toContain(TXT.falhaTitulo)
    expect(m.btn('Parar coleta e agendar guarda no NAS').hasAttribute('aria-disabled')).toBe(false)
    expect(m.rows()).toEqual([])
    await act(async () => { fireEvent.click(m.btn('Contar de novo')) })
    expect(m.radio('apagar').disabled).toBe(false)
    expect(m.onCancel).not.toHaveBeenCalled()
  })

  it('D5.5 prazo: contagem sem resposta por 10 s vira falha; a resposta tardia é ignorada; contar de novo reinicia', async () => {
    vi.useFakeTimers()
    const tardia = deferred<ImpactAnswer>()
    let n = 0
    const m = mount({ impact: () => (++n === 1 ? tardia.p : Promise.resolve(PODE)) })
    await act(async () => { await vi.advanceTimersByTimeAsync(10_001) })
    expect(m.container.textContent).toContain(TXT.falhaTitulo)
    await act(async () => { tardia.done(PODE); await tardia.p })
    expect(m.container.textContent).toContain(TXT.falhaTitulo) // a tardia não desfaz a falha
    await act(async () => { fireEvent.click(m.btn('Contar de novo')) })
    expect(m.radio('apagar').disabled).toBe(false)
  })
})

describe('RemoveDialog · envio', () => {
  it('D5.6 sucesso: guardar e apagar chamam onDone com o desfecho (campos opcionais só quando vêm)', async () => {
    const m = mount()
    await act(async () => {})
    await act(async () => { fireEvent.click(m.btn('Parar coleta e agendar guarda no NAS')) })
    expect(m.onDone).toHaveBeenCalledWith({ caminho: 'guardar', jaPedido: false })
    cleanup()
    const apagar = vi.fn(async () => ({ ok: true as const, videos: 340, leituras: 48, registrosDiarios: 4000 }))
    const m2 = mount({ apagar })
    await act(async () => {})
    fireEvent.click(m2.radio('apagar'))
    fireEvent.change(m2.container.querySelector('.fld input')!, { target: { value: 'Ryan Otis' } })
    await act(async () => { fireEvent.click(m2.btn('Apagar sem guardar')) })
    expect(m2.onDone).toHaveBeenCalledWith({ caminho: 'apagar', videos: 340, leituras: 48, registrosDiarios: 4000 })
    cleanup()
    const m3 = mount()
    await act(async () => {})
    fireEvent.click(m3.radio('apagar'))
    fireEvent.change(m3.container.querySelector('.fld input')!, { target: { value: 'Ryan Otis' } })
    await act(async () => { fireEvent.click(m3.btn('Apagar sem guardar')) })
    expect(m3.onDone.mock.calls[0]![0]).toEqual({ caminho: 'apagar', videos: 340 })
  })

  it('D5.7 andamento-a: 3 cliques = 1 chamada; "Apagando…", aria-busy, Cancelar travado, campo desabilitado, Esc não fecha', async () => {
    const user = userEvent.setup()
    const d = deferred<{ ok: true; videos: number }>()
    const apagar = vi.fn(() => d.p)
    const m = mount({ apagar })
    await act(async () => {})
    await user.click(m.radio('apagar'))
    await user.type(m.container.querySelector('.fld input') as HTMLInputElement, 'Ryan Otis')
    const b = m.btn('Apagar sem guardar')
    await user.click(b); await user.click(b); await user.click(b)
    expect(apagar).toHaveBeenCalledTimes(1)
    const busy = m.btn('Apagando…')
    expect(busy.getAttribute('aria-busy')).toBe('true')
    expect(m.btn('Cancelar').getAttribute('aria-disabled')).toBe('true')
    expect((m.container.querySelector('.fld input') as HTMLInputElement).disabled).toBe(true)
    await user.click(m.btn('Cancelar'))
    await user.keyboard('{Escape}')
    expect(m.onCancel).not.toHaveBeenCalled()
    expect(m.onBloqueio).toHaveBeenCalledWith(true)
    await act(async () => { d.done({ ok: true, videos: 1 }); await d.p })
    expect(m.onBloqueio).toHaveBeenLastCalledWith(false)
  })

  it('D5.7 no (b) o botão diz "Parando a coleta…"', async () => {
    const user = userEvent.setup()
    const d = deferred<{ ok: true; jaPedido: boolean }>()
    const pedir = vi.fn(() => d.p)
    const m = mount({ pedir })
    await act(async () => {})
    const b = m.btn('Parar coleta e agendar guarda no NAS')
    await user.click(b); await user.click(b)
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(m.btn('Parando a coleta…').getAttribute('aria-busy')).toBe('true')
  })

  it('D5.7c Enter no campo do nome não envia (não há <form>)', async () => {
    const user = userEvent.setup()
    const d = deferred<{ ok: true; videos: number }>()
    const apagar = vi.fn(() => d.p)
    const m = mount({ apagar })
    await act(async () => {})
    await user.click(m.radio('apagar'))
    const input = m.container.querySelector('.fld input') as HTMLInputElement
    await user.type(input, 'Ryan Otis{Enter}{Enter}{Enter}')
    expect(m.container.querySelector('form')).toBeNull()
    expect(apagar).not.toHaveBeenCalled()
  })

  it('D5.7d ação sem resposta por 30 s vira incerto; Fechar e conferir e Esc ficam livres; a resposta tardia é descartada', async () => {
    vi.useFakeTimers()
    const d = deferred<{ ok: true; videos: number }>()
    const m = mount({ apagar: vi.fn(() => d.p) })
    await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    fireEvent.change(m.container.querySelector('.fld input')!, { target: { value: 'Ryan Otis' } })
    await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
    await act(async () => { await vi.advanceTimersByTimeAsync(30_001) })
    expect(m.container.textContent).toContain(TXT.incertoTitulo)
    expect(m.container.textContent).toContain('código: sem-resposta')
    await act(async () => { d.done({ ok: true, videos: 1 }); await d.p })
    expect(m.onDone).not.toHaveBeenCalled()
    fireEvent.keyDown(m.q('[role="dialog"]'), { key: 'Escape' })
    expect(m.onConferir).toHaveBeenCalledTimes(1)
  })

  it('D5.8 incerto (a): onApagar rejeita; nunca diz "Nada mudou" nem "Apagado"; Fechar e conferir', async () => {
    const m = mount({ apagar: vi.fn(async () => { throw new Error('rede') }) })
    await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    fireEvent.change(m.container.querySelector('.fld input')!, { target: { value: 'Ryan Otis' } })
    await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
    const alerta = m.q('[role="alert"]').textContent!
    expect(alerta).toContain(TXT.incertoTitulo)
    expect(alerta).toContain(TXT.incertoApagarCorpo)
    expect(alerta).toContain('código: sem-resposta')
    expect(alerta).not.toMatch(/Nada mudou|Apagado/)
    fireEvent.click(m.btn('Fechar e conferir'))
    expect(m.onConferir).toHaveBeenCalledTimes(1)
  })

  it('D5.8 incerto (b): onPedir rejeita; diz que pode estar "Agendado" e oferece Tentar de novo', async () => {
    const pedir = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ ok: true, jaPedido: true })
    const m = mount({ pedir })
    await act(async () => {})
    await act(async () => { fireEvent.click(m.btn('Parar coleta e agendar guarda no NAS')) })
    const alerta = m.q('[role="alert"]').textContent!
    expect(alerta).toContain(TXT.incertoGuardarCorpo)
    expect(alerta).not.toMatch(/Nada mudou|Apagado/)
    expect(m.btn('Fechar e conferir')).toBeTruthy()
    await act(async () => { fireEvent.click(m.btn('Tentar de novo')) })
    expect(pedir).toHaveBeenCalledTimes(2)
    expect(m.onDone).toHaveBeenCalledWith({ caminho: 'guardar', jaPedido: true })
  })

  it('D5.9 erro-a: a frase do servidor, o código pequeno e "Escolher guardar no NAS" marca (b)', async () => {
    const apagar = vi.fn(async () => ({ ok: false as const, codigo: 'nome_nao_confere', frase: 'FRASE DO CATÁLOGO' }))
    const m = mount({ apagar })
    await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    fireEvent.change(m.container.querySelector('.fld input')!, { target: { value: 'Ryan Otis' } })
    await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
    const alerta = m.q('[role="alert"]').textContent!
    expect(alerta).toContain('Nada foi apagado.')
    expect(alerta).toContain('FRASE DO CATÁLOGO')
    expect(alerta).toContain('código: nome_nao_confere')
    fireEvent.click(m.btn('Escolher guardar no NAS'))
    expect(m.radio('guardar').checked).toBe(true)
    expect(m.container.querySelector('[role="alert"]')).toBeNull()
  })

  it.each(['itens_na_fila', 'saiu_do_youtube'])('D5.9 %s: o corpo é a frase recebida, nunca trocada pelo código', async codigo => {
    const apagar = vi.fn(async () => ({ ok: false as const, codigo, frase: `frase de ${codigo}` }))
    const m = mount({ apagar })
    await act(async () => {})
    fireEvent.click(m.radio('apagar'))
    fireEvent.change(m.container.querySelector('.fld input')!, { target: { value: 'Ryan Otis' } })
    await act(async () => { fireEvent.click(m.btn('Apagar sem guardar')) })
    expect(m.q('[role="alert"]').textContent).toContain(`frase de ${codigo}`)
  })

  it('D5.9b erro-b transitório: título, corpo próprio e Tentar de novo chama onPedir outra vez', async () => {
    const pedir = vi.fn().mockResolvedValueOnce({ ok: false, codigo: 'leitura', frase: 'f' }).mockResolvedValueOnce({ ok: true, jaPedido: false })
    const m = mount({ pedir })
    await act(async () => {})
    await act(async () => { fireEvent.click(m.btn('Parar coleta e agendar guarda no NAS')) })
    const alerta = m.q('[role="alert"]').textContent!
    expect(alerta).toContain(TXT.erroGuardarTitulo)
    expect(alerta).toContain(TXT.erroGuardarCorpo)
    await act(async () => { fireEvent.click(m.btn('Tentar de novo')) })
    expect(pedir).toHaveBeenCalledTimes(2)
  })

  it('M-2: contagem falhou e o guardar deu erro: "Contar de novo" continua à vista', async () => {
    const pedir = vi.fn(async () => ({ ok: false as const, codigo: 'leitura', frase: 'f' }))
    const m = mount({ impact: async () => ({ ok: false }), pedir })
    await act(async () => {})
    await act(async () => { fireEvent.click(m.btn('Parar coleta e agendar guarda no NAS')) })
    expect(m.container.textContent).toContain(TXT.erroGuardarTitulo)
    expect(m.btn('Contar de novo')).toBeTruthy()
    expect(m.rows()).toEqual([])
  })

  it.each(['sem_direito', 'saiu_do_youtube'])('D5.9b erro-b permanente (%s): "Nada mudou." + frase, só Fechar', async codigo => {
    const pedir = vi.fn(async () => ({ ok: false as const, codigo, frase: 'FRASE' }))
    const m = mount({ pedir })
    await act(async () => {})
    await act(async () => { fireEvent.click(m.btn('Parar coleta e agendar guarda no NAS')) })
    expect(m.q('[role="alert"]').textContent).toContain('Nada mudou. FRASE')
    expect(m.btn('Tentar de novo')).toBeUndefined()
    fireEvent.click(m.btn('Fechar'))
    expect(m.onCancel).toHaveBeenCalled()
  })
})

describe('RemoveDialog · teclado', () => {
  it('Esc fecha fora de enviando', async () => {
    const m = mount()
    await act(async () => {})
    fireEvent.keyDown(m.q('[role="dialog"]'), { key: 'Escape' })
    expect(m.onCancel).toHaveBeenCalledTimes(1)
  })
})
void ({} as Pedir)

describe('RemoveDialog · rodada 3 do Gio', () => {
  const props = (o: { impact: () => Promise<ImpactAnswer>; apagar?: ReturnType<typeof vi.fn>; copiar?: () => void }) => ({
    id: 'c1', name: 'Ryan Otis', onImpact: o.impact,
    onPedir: (async () => ({ ok: true as const, jaPedido: false })) as never,
    onApagar: (o.apagar ?? (async () => ({ ok: true as const, videos: 1 }))) as never,
    onCancel: vi.fn(), onDone: vi.fn(), onConferir: vi.fn(), onBloqueio: vi.fn(), onCopiarPedido: o.copiar, trap: () => {},
  })

  it('C1: o erro sobrevive à troca de identidade de onImpact (revalidação) e não recontaconta', async () => {
    const apagar = vi.fn(async () => ({ ok: false as const, codigo: 'nome_nao_confere', frase: 'F' }))
    const impact1 = vi.fn(async () => PODE)
    const r = render(<RemoveDialog {...props({ impact: impact1, apagar })} />)
    await act(async () => {})
    fireEvent.click(r.container.querySelector('input[value="apagar"]')!)
    fireEvent.change(r.container.querySelector('.fld input')!, { target: { value: 'Ryan Otis' } })
    await act(async () => { fireEvent.click([...r.container.querySelectorAll('button')].find(b => b.textContent === 'Apagar sem guardar')!) })
    expect(r.container.querySelector('[role="alert"]')).not.toBeNull()
    const impact2 = vi.fn(async () => PODE)
    r.rerender(<RemoveDialog {...props({ impact: impact2, apagar })} />)
    await act(async () => {})
    expect(impact2).not.toHaveBeenCalled()
    expect(r.container.querySelector('[role="alert"]')!.textContent).toContain('Nada foi apagado.')
  })

  it('I5: sob StrictMode o sucesso chama onDone (a ref vivo volta a true na montagem)', async () => {
    const p = props({ impact: async () => PODE })
    const r = render(<StrictMode><RemoveDialog {...p} /></StrictMode>)
    await act(async () => {})
    await act(async () => { fireEvent.click([...r.container.querySelectorAll('button')].find(b => /Parar coleta/.test(b.textContent ?? ''))!) })
    expect(p.onDone).toHaveBeenCalledWith({ caminho: 'guardar', jaPedido: false })
  })

  it('I6: video_compartilhado em apagar não oferece guardar; diz que nada mudou e oferece copiar o pedido', async () => {
    const apagar = vi.fn(async () => ({ ok: false as const, codigo: 'video_compartilhado', frase: 'FRASE' }))
    const copiar = vi.fn()
    const r = render(<RemoveDialog {...props({ impact: async () => PODE, apagar, copiar })} />)
    await act(async () => {})
    fireEvent.click(r.container.querySelector('input[value="apagar"]')!)
    fireEvent.change(r.container.querySelector('.fld input')!, { target: { value: 'Ryan Otis' } })
    await act(async () => { fireEvent.click([...r.container.querySelectorAll('button')].find(b => b.textContent === 'Apagar sem guardar')!) })
    const txt = r.container.textContent!
    expect(txt).not.toContain('Escolher guardar no NAS')
    expect(r.container.querySelector('[role="alert"]')!.textContent).toMatch(/Nada mudou/)
    fireEvent.click([...r.container.querySelectorAll('button')].find(b => b.textContent === 'Copiar pedido ao agente')!)
    expect(copiar).toHaveBeenCalled()
  })

  it('I1: contando, a opção de apagar fica desligada sem a frase de falha', () => {
    const d = deferred<ImpactAnswer>()
    const r = render(<RemoveDialog {...props({ impact: () => d.p })} />)
    expect(r.container.querySelector('.why:not(.why-sizer)')).toBeNull() // T12: a frase reservada (.why-sizer) existe, invisível, desde o início
    expect((r.container.querySelector('input[value="apagar"]') as HTMLInputElement).disabled).toBe(true)
  })
})
