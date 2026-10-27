// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ResultadoConferir, ResultadoEscolha } from '@/lib/youtube/ab-acao-saida'
import { PainelOQueFica } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/painel-o-que-fica'
import type { AcoesDecisao } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/painel-o-que-fica'
import { montarPainelEscolha, type EntradaPainelEscolha } from '@/lib/youtube/ab-lab-pagina/painel-escolha'
import type { NoArConfirmado, NoArLido } from '@/lib/youtube/ab-no-ar'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))

const ID = { A: 'va', B: 'vb', C: 'vc' } as const
const conf = (l: 'A' | 'B' | 'C', desde: string | null = '2026-10-26T15:00:00.000Z'): NoArConfirmado => ({ tipo: 'confirmado', varianteId: ID[l], letra: l, desde })

function entrada(o: { ar: 'A' | 'B' | 'C'; sug: 'A' | 'B' | 'C' | null; escolha?: 'A' | 'B' | 'C'; ctr?: 'norm' | 'inc'; noAr?: NoArLido; podeAdministrar?: boolean; miniatura?: string | null }): EntradaPainelEscolha {
  const ctr = o.ctr === 'inc' ? { A: 0.041, B: 0.043, C: null } : { A: 0.039, B: 0.052, C: 0.044 }
  return {
    testId: 't1', nomeVideo: 'Bangkok', tipo: 'title', restoreSeq: 3, podeAdministrar: o.podeAdministrar ?? true,
    variantes: (['A', 'B', 'C'] as const).map(l => ({ id: ID[l], letra: l, original: l === 'A', titulo: `Título ${l}`, miniatura: o.miniatura === undefined ? `https://img/${l}.jpg` : o.miniatura, ctr: ctr[l] })),
    sugeridaId: o.sug ? ID[o.sug] : null, noAr: o.noAr ?? conf(o.ar), originalGuardada: { titulo: true, miniatura: true },
    escolha: o.escolha ? { varianteId: ID[o.escolha], em: '2026-10-27T15:00:00.000Z' } : null,
  }
}

const noArC: ResultadoEscolha = { ok: true, resultado: 'no_ar', noAr: conf('C', null), restoreSeq: 4 }
function acoes(o: { escolher?: AcoesDecisao['escolher']; conferir?: AcoesDecisao['conferir'] } = {}) {
  return {
    encerrar: vi.fn(), aplicarSugerido: vi.fn(), voltar: vi.fn(),
    escolher: vi.fn(o.escolher ?? (async () => noArC)),
    conferir: vi.fn(o.conferir ?? (async (): Promise<ResultadoConferir> => ({ ok: false, estado: 'sem_leitura', error: 'x' }))),
  } as unknown as AcoesDecisao & { escolher: ReturnType<typeof vi.fn>; conferir: ReturnType<typeof vi.fn> }
}
function monta(e: EntradaPainelEscolha, a = acoes()) {
  const onFechar = vi.fn()
  const r = render(<PainelOQueFica painel={montarPainelEscolha(e)} acoes={a} onFechar={onFechar} />)
  return { a, onFechar, ...r }
}
const radio = (nome: string) => screen.getByRole('radio', { name: nome }) as HTMLInputElement
const clica = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome })
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

beforeEach(() => { refresh.mockClear() })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('M7b T11: painel de escolha de um teste concluído', () => {
  it('a: a marcada já está no ar → "Nada a fazer" e só Fechar; X com aria-label e alvo de 44 px; aria-describedby na frase', () => {
    monta(entrada({ ar: 'B', sug: 'B' }))
    expect(screen.getByText('Nada a fazer: a versão B já está no ar.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Deixar/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(2) // o X e o botão
    const xs = document.querySelectorAll('button[aria-label="Fechar"]')
    expect(xs).toHaveLength(1)
    expect(xs[0]!.className).toContain('lab-alvo') // min-height: 44px
    const dlg = screen.getByRole('dialog')
    const frase = document.getElementById(dlg.getAttribute('aria-describedby')!)!
    expect(frase.textContent).toBe('A versão B está no ar desde 26/10.')
    expect(screen.getByText('O resultado do teste não muda com a sua escolha.')).toBeTruthy()
    // sem prazo, sem o vocabulário antigo
    expect(document.body.textContent).not.toMatch(/Aplicar B ao vídeo|Voltar à original|Em breve|7 dias|até \d\d\/\d\d/)
  })

  it('b: marcar C mostra Sai/Entra, sem diálogo, e "Deixar C no ar" chama escolherVersao com o seq da página', async () => {
    const { a } = monta(entrada({ ar: 'B', sug: 'B' }))
    fireEvent.click(radio('Versão C'))
    const troca = document.querySelector('[data-sai-entra]')!
    expect(troca.textContent).toContain('Sai')
    expect(troca.textContent).toContain('Título B')
    expect(troca.textContent).toContain('Entra')
    expect(troca.textContent).toContain('Título C')
    expect(troca.textContent).toContain('O teste sugeria a B. Esta versão teve CTR menor (4,4% contra 5,2%).')
    await clica(botao('Deixar C no ar'))
    expect(a.escolher).toHaveBeenCalledWith('t1', 'vc', 3)
  })

  it('e/d3a: depois de entrar, selos "No ar agora" + "Escolhida por você" e a frase', async () => {
    monta(entrada({ ar: 'B', sug: 'B' }))
    fireEvent.click(radio('Versão C'))
    await clica(botao('Deixar C no ar'))
    expect(document.getElementById('pe-frase')!.textContent).toMatch(/^Você deixou a versão C no ar desde \d\d\/\d\d\. O teste sugeria a B\.$/)
    const c = document.querySelector('[data-versao="C"]')!
    expect(c.textContent).toContain('No ar agora')
    expect(c.textContent).toContain('Escolhida por você')
    expect(refresh).toHaveBeenCalled()
  })

  it('c: escrevendo trava radios e Fechar; aos 15 s aparece "Está demorando"', async () => {
    vi.useFakeTimers()
    const a = acoes({ escolher: () => new Promise<ResultadoEscolha>(() => undefined) })
    const { onFechar } = monta(entrada({ ar: 'B', sug: 'B' }), a)
    fireEvent.click(radio('Versão C'))
    await clica(botao('Deixar C no ar'))
    const espera = screen.getByRole('button', { name: /Escrevendo no YouTube/ })
    expect(espera.getAttribute('aria-disabled')).toBe('true')
    expect(radio('Original A').disabled).toBe(true)
    await clica(screen.getAllByRole('button', { name: 'Fechar' })[0]!)
    await clica(screen.getAllByRole('button', { name: 'Fechar' })[1]!)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onFechar).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('Está demorando')
    await flush(15_000)
    expect(screen.getByText(/Está demorando\. Pode fechar/)).toBeTruthy()
  })

  it('d: recusa mostra o aviso vermelho com foco, "No ar agora" relido, e "Tentar de novo" leva o restoreSeq novo', async () => {
    const recusa: ResultadoEscolha = { ok: false, resultado: 'recusou', porque: 'youtube', noAr: conf('B'), entrou: [], restoreSeq: 9, error: 'x' }
    const a = acoes({ escolher: vi.fn().mockResolvedValueOnce(recusa).mockResolvedValueOnce(noArC) })
    monta(entrada({ ar: 'B', sug: 'B' }), a)
    fireEvent.click(radio('Versão C'))
    await clica(botao('Deixar C no ar'))
    const aviso = screen.getByRole('alert')
    expect(aviso.textContent).toContain('Não consegui deixar a C no ar.')
    expect(aviso.textContent).toContain('O YouTube recusou a troca e a versão B continua no ar.')
    expect(document.activeElement).toBe(aviso)
    expect(document.querySelector('[data-versao="B"]')!.textContent).toContain('No ar agora')
    expect(screen.queryByRole('button', { name: 'Deixar C no ar' })).toBeNull()
    await clica(botao('Tentar de novo'))
    expect(a.escolher).toHaveBeenLastCalledWith('t1', 'vc', 9)
  })

  it('d (sem_original): repetir não resolve, só Fechar', async () => {
    const recusa: ResultadoEscolha = { ok: false, resultado: 'recusou', porque: 'sem_original', noAr: conf('B'), entrou: [], restoreSeq: 9, error: 'x' }
    monta(entrada({ ar: 'B', sug: 'B' }), acoes({ escolher: async () => recusa }))
    fireEvent.click(radio('Versão C'))
    await clica(botao('Deixar C no ar'))
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(screen.getByText(/Não temos a original guardada/)).toBeTruthy()
  })

  it('d2 → d3a: rede cai logo depois do clique; a conferência acha C e vai a "no ar" com a data de hoje', async () => {
    vi.useFakeTimers()
    const a = acoes({
      escolher: async () => { throw new TypeError('fetch failed') },
      conferir: async () => ({ ok: true, estado: 'lido', noAr: conf('C', '2026-10-27T18:00:00.000Z'), restoreSeq: 6, fonte: 'youtube' }),
    })
    monta(entrada({ ar: 'B', sug: 'B' }), a)
    fireEvent.click(radio('Versão C'))
    await clica(botao('Deixar C no ar'))
    expect(document.getElementById('pe-frase')!.textContent).toBe('Conferindo o que está no ar. Última leitura: B desde 26/10.')
    expect(screen.getByRole('alert').textContent).toContain('Não deu para confirmar se a C entrou.')
    expect((screen.getByRole('button', { name: /Conferindo/ }) as HTMLButtonElement).disabled).toBe(true)
    await flush(0)
    expect(a.conferir).toHaveBeenCalledWith('t1')
    expect(document.getElementById('pe-frase')!.textContent).toMatch(/^Você deixou a versão C no ar desde 27\/10/)
  })

  it('d3b: a conferência acha a B ainda no ar → recusou "Conferimos agora" com "Tentar de novo"', async () => {
    vi.useFakeTimers()
    const a = acoes({
      escolher: async () => { throw new TypeError('fetch failed') },
      conferir: async () => ({ ok: true, estado: 'lido', noAr: conf('B'), restoreSeq: 6, fonte: 'youtube' }),
    })
    monta(entrada({ ar: 'B', sug: 'B' }), a)
    fireEvent.click(radio('Versão C'))
    await clica(botao('Deixar C no ar'))
    await flush(0)
    expect(screen.getByRole('alert').textContent).toContain('Conferimos agora: a versão B segue no ar.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('d3c: a conferência não responde em 15 s → "Sem conexão para conferir" e só Fechar', async () => {
    vi.useFakeTimers()
    const a = acoes({ escolher: async () => { throw new TypeError('fetch failed') }, conferir: () => new Promise<ResultadoConferir>(() => undefined) })
    monta(entrada({ ar: 'B', sug: 'B' }), a)
    fireEvent.click(radio('Versão C'))
    await clica(botao('Deixar C no ar'))
    await flush(15_000)
    expect(screen.getByRole('alert').textContent).toContain('Sem conexão para conferir.')
    expect(screen.getByRole('alert').textContent).toContain('Não repetimos a troca sozinhos.')
    expect(screen.queryByRole('button', { name: /Deixar|Tentar|Conferindo/ })).toBeNull()
    expect(radio('Original A').disabled).toBe(true)
  })

  it('f: inconclusivo sem pré-seleção: "Deixar no ar" desabilitado até marcar', () => {
    monta(entrada({ ar: 'A', sug: null, ctr: 'inc' }))
    expect((screen.getByRole('button', { name: 'Deixar no ar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(document.getElementById('pe-frase')!.textContent).toBe('O teste não mostrou diferença clara. O vídeo está com a original (A). Escolha qual fica.')
    fireEvent.click(radio('Versão C'))
    expect(screen.getByText('CTR não medido para esta versão.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Deixar C no ar' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('i → f2/g2: com A no ar, marcar A vira "Manter a original (A)"; a resposta "guardado" mostra "Guardado." sem chamar o YouTube', async () => {
    const a = acoes({ escolher: async () => ({ ok: true, resultado: 'guardado', restoreSeq: 4 }) })
    const { onFechar } = monta(entrada({ ar: 'A', sug: 'B' }), a)
    expect(document.querySelector('[data-sai-entra]')).not.toBeNull() // B pré-marcada
    fireEvent.click(radio('Original A'))
    await clica(botao('Manter a original (A)'))
    expect(a.escolher).toHaveBeenCalledWith('t1', 'va', 3)
    expect(screen.getByText('Guardado.')).toBeTruthy()
    expect(document.getElementById('pe-frase')!.textContent).toBe('Você manteve a original (A). O teste sugeria a B.')
    expect(screen.queryByRole('button', { name: /Manter|Deixar/ })).toBeNull()
    await clica(document.querySelector('.pe-dact button') as HTMLElement)
    expect(onFechar).toHaveBeenCalled()
  })

  it('k: reaberto depois de decidir: A marcada, "Mantida por você", só Fechar', () => {
    monta(entrada({ ar: 'A', sug: 'B', escolha: 'A' }))
    expect(radio('Original A').checked).toBe(true)
    expect(document.querySelector('[data-versao="A"]')!.textContent).toContain('Mantida por você')
    expect(screen.getByText('Sua escolha está guardada. Marque outra versão só se quiser mudar o vídeo.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Manter|Deixar/ })).toBeNull()
  })

  it('j: a imagem que não carrega vira ícone com role=img "Miniatura não carregou"', () => {
    monta(entrada({ ar: 'B', sug: 'B' }))
    const img = document.querySelector('[data-versao="C"] img')!
    fireEvent.error(img)
    expect(document.querySelector('[data-versao="C"] [role="img"]')!.getAttribute('aria-label')).toBe('Miniatura não carregou')
  })

  it('precisa_confirmar abre o diálogo de drift com "Deixar C no ar mesmo assim"; confirmar reenvia com forcar', async () => {
    const pend: ResultadoEscolha = { ok: true, resultado: 'precisa_confirmar', campos: [{ campo: 'title', valor_atual: 'Alguém mudou' }] }
    const a = acoes({ escolher: vi.fn().mockResolvedValueOnce(pend).mockResolvedValueOnce(noArC) })
    monta(entrada({ ar: 'B', sug: 'B' }), a)
    fireEvent.click(radio('Versão C'))
    await clica(botao('Deixar C no ar'))
    expect(screen.getByText('O vídeo mudou no YouTube')).toBeTruthy()
    expect(screen.getByText(/Desde o teste, o título foi alterado fora daqui/)).toBeTruthy()
    await clica(botao('Deixar C no ar mesmo assim'))
    expect(a.escolher).toHaveBeenLastCalledWith('t1', 'vc', 3, true)
  })

  it('sem permissão: aviso, radios travados e só Fechar', () => {
    monta(entrada({ ar: 'B', sug: 'B', podeAdministrar: false }))
    expect(screen.getByText('Só quem administra o site pode deixar uma versão no ar.')).toBeTruthy()
    expect(radio('Versão C').disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /Deixar/ })).toBeNull()
  })
})
