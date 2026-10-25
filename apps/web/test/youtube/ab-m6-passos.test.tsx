// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { VChip } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-primitives'

const m = vi.hoisted(() => ({
  createAbTest: vi.fn(),
  lerDimensoes: vi.fn(async () => ({ ok: false as const })),
  fetchAbBriefingData: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  createAbTest: m.createAbTest,
  uploadVariant: vi.fn(),
  createTextVariant: vi.fn(async () => ({ ok: true, id: 'v1' })),
  updateAbTestType: vi.fn(async () => ({ ok: true })),
  cleanupDraftVariants: vi.fn(async () => ({ ok: true })),
  fetchAbBriefingData: m.fetchAbBriefingData,
  fetchLibraryEntries: vi.fn(async () => []),
  lerDimensoesDaOriginal: m.lerDimensoes,
}))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { AbCreateWizard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'
import { StepVariantes } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-variantes'
import type { VariantData } from '@/app/cms/(authed)/youtube/ab-lab/_components/step-variantes'
import { initWizardConfig, wizardConfigToAbConfig } from '@/lib/youtube/ab-wizard-adapter'

const CSS = fs.readFileSync(
  path.resolve(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog.css'),
  'utf8',
)

describe('M6 tokens .etd-tok', () => {
  it('declara os tokens fora do .etd, no escuro e no claro', () => {
    const escuro = CSS.match(/(^|\n)([^{}\n]*\.etd-tok[^{}]*)\{([^}]*)\}/g) ?? []
    expect(escuro.some((r) => !r.includes('[data-theme') && r.includes('--etd-info-bg') && r.includes('--etd-err'))).toBe(true)
    const claro = CSS.match(/\[data-theme="light"\][^{}]*\.etd-tok[^{}]*\{[^}]*\}/)?.[0] ?? ''
    expect(claro).toContain('--etd-err: #A4261B')
  })
  it('não usa color-mix', () => {
    expect(CSS.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('color-mix')
  })
  it('VChip tem letra escura e rótulo em português', () => {
    render(<VChip label="B" />)
    expect(screen.getByLabelText('Variante B').style.color).toBe('rgb(26, 18, 10)')
  })
})

/* ------------------------------------------------------------------ */
/*  T3: assistente em 3 passos                                          */
/* ------------------------------------------------------------------ */

const video = { id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: 'https://i.ytimg.com/a.jpg' }
const settings = {} as never
const CHAVE_V2 = 'ab-wizard-draft-v2-vid-1'
const CHAVE_ANTIGA = 'ab-wizard-draft-vid-1'
const iniciar = vi.fn(async () => ({ ok: true }))
const avisoDeVolume = vi.fn(async () => ({ ok: false as const, error: 'x' }))

function montar(extra: Partial<React.ComponentProps<typeof AbCreateWizard>> = {}) {
  return render(
    <AbCreateWizard video={video} siteId="s" settings={settings} onClose={vi.fn()} onCreated={vi.fn()} iniciarTeste={iniciar} avisoDeVolume={avisoDeVolume} {...extra} />,
  )
}

const varA = { label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' }
const varB = (titleText: string, thumbUrl: string | null = null) => ({ label: 'B', isOriginal: false, thumbUrl, titleText })
const gravar = (chave: string, d: Record<string, unknown>) => localStorage.setItem(chave, JSON.stringify({ savedAt: Date.now(), ...d }))
const getItem = vi.fn()

beforeEach(() => {
  cleanup()
  m.createAbTest.mockReset()
  m.fetchAbBriefingData.mockReset()
  iniciar.mockClear()
  avisoDeVolume.mockClear()
  const store = new Map<string, string>()
  getItem.mockReset()
  getItem.mockImplementation((k: string) => store.get(k) ?? null)
  vi.stubGlobal('localStorage', {
    getItem,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
  })
})

const proximo = () => screen.getByRole('button', { name: /Próximo/ }) as HTMLButtonElement

describe('M6 T3: três passos', () => {
  it('Tipo: trilho Tipo, Variantes, Revisar e rodapé "Passo 1 de 3"', () => {
    montar()
    for (const r of ['Tipo', 'Variantes', 'Revisar']) expect(screen.getByText(r)).toBeTruthy()
    expect(screen.getByText('Passo 1 de 3')).toBeTruthy()
    for (const f of ['Ideias', 'Config', 'Burn-in', 'Ciclos', 'Pular']) expect(screen.queryByText(f)).toBeNull()
  })

  it.each(['title', 'thumbnail', 'combo'] as const)('Variantes (%s): passo 2 de 3, textos novos e nenhum resto em inglês', (testType) => {
    montar({ prefill: { testType } })
    expect(screen.getByText('Passo 2 de 3')).toBeTruthy()
    expect(screen.getByText('1 de 2 desafiantes')).toBeTruthy()
    expect(screen.getByText('Desafiante')).toBeTruthy()
    const t = document.body.textContent ?? ''
    for (const f of ['Challenger', 'Title for', 'Monte ate', 'MAX.', 'Pular', 'Ideias']) expect(t).not.toContain(f)
    if (testType !== 'thumbnail') expect(screen.getByLabelText('Título da variante B')).toBeTruthy()
  })

  it('rótulo visível "Título da variante B" ligado ao input; contador só a partir de 80', () => {
    montar({ prefill: { testType: 'title' } })
    const campo = screen.getByLabelText('Título da variante B')
    expect(campo.tagName).toBe('INPUT')
    fireEvent.change(campo, { target: { value: 'a'.repeat(79) } })
    expect(screen.queryByText(/caracteres/)).toBeNull()
    fireEvent.change(campo, { target: { value: 'a'.repeat(86) } })
    expect(screen.getByText('86/100 caracteres')).toBeTruthy()
  })

  it('validação por tipo: title exige título; combo exige título e imagem; thumbnail exige imagem', () => {
    const t = montar({ prefill: { testType: 'title' } })
    expect(proximo().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Título da variante B'), { target: { value: 'Novo' } })
    expect(proximo().disabled).toBe(false)
    t.unmount()

    cleanup()
    montar({ prefill: { testType: 'combo' } })
    fireEvent.change(screen.getByLabelText('Título da variante B'), { target: { value: 'Novo' } })
    expect(proximo().disabled).toBe(true)
    cleanup()

    gravar(CHAVE_V2, { step: 'variantes', type: 'combo', variants: [varA, varB('Novo', 'data:image/jpeg;base64,AAAA')], draftTestId: null })
    montar({ prefill: { testType: 'combo' } })
    expect(proximo().disabled).toBe(false)
    cleanup()

    gravar(CHAVE_V2, { step: 'variantes', type: 'thumbnail', variants: [varA, varB('', 'data:image/jpeg;base64,AAAA')], draftTestId: null })
    montar({ prefill: { testType: 'thumbnail' } })
    expect(proximo().disabled).toBe(false)
  })

  it('Voltar em Variantes leva ao Tipo', () => {
    montar({ prefill: { testType: 'title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('radiogroup', { name: 'Tipo de teste' })).toBeTruthy()
  })
})

describe('M6 T3: pedir ideias a uma IA', () => {
  const props = (onPedirIdeias: () => Promise<void>) => ({
    type: 'title' as const,
    variants: [{ label: 'A', isOriginal: true, thumbUrl: null, titleText: 'v' }, { label: 'B', isOriginal: false, thumbUrl: null, titleText: '' }] as VariantData[],
    originalThumbUrl: null,
    onUpdateVariant: vi.fn(), onAddVariant: vi.fn(), onRemoveVariant: vi.fn(),
    onPedirIdeias,
  })

  it('pendente: "Montando o briefing…" com role=status e o 2º clique não chama de novo', async () => {
    const f = vi.fn(() => new Promise<void>(() => {}))
    render(<StepVariantes {...props(f)} />)
    const b = screen.getByRole('button', { name: /Pedir ideias a uma IA/ })
    fireEvent.click(b)
    fireEvent.click(b)
    expect(f).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status').textContent).toContain('Montando o briefing…')
  })

  it('resolvida: "Briefing copiado"; rejeitada: alerta', async () => {
    render(<StepVariantes {...props(vi.fn(async () => {}))} />)
    fireEvent.click(screen.getByRole('button', { name: /Pedir ideias a uma IA/ }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Briefing copiado'))
    cleanup()
    render(<StepVariantes {...props(vi.fn(async () => { throw new Error('x') }))} />)
    fireEvent.click(screen.getByRole('button', { name: /Pedir ideias a uma IA/ }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Não foi possível copiar o briefing'))
  })
})

describe('M6 T3: rascunho local (migração e v2)', () => {
  const noTipo = () => screen.queryByRole('radiogroup', { name: 'Tipo de teste' })

  it('chave antiga com step 3 e título em B abre em Variantes com o título e some', () => {
    gravar(CHAVE_ANTIGA, { step: 3, type: 'title', variants: [varA, varB('Fila de 3 h')], config: {}, hypothesis: 'x' })
    montar()
    expect(noTipo()).toBeNull()
    expect((screen.getByLabelText('Título da variante B') as HTMLInputElement).value).toBe('Fila de 3 h')
    expect(localStorage.getItem(CHAVE_ANTIGA)).toBeNull()
    expect(localStorage.getItem(CHAVE_V2)).toContain('Fila de 3 h')
  })

  it('antiga: step 0 abre no Tipo; 1 e 2 em Variantes', () => {
    gravar(CHAVE_ANTIGA, { step: 0, type: 'title', variants: [varA, varB('x')] })
    montar()
    expect(noTipo()).not.toBeNull()
    cleanup(); localStorage.clear()
    for (const step of [1, 2]) {
      gravar(CHAVE_ANTIGA, { step, type: 'title', variants: [varA, varB('x')] })
      montar()
      expect(noTipo()).toBeNull()
      cleanup(); localStorage.clear()
    }
  })

  it('antiga com step 7 ou JSON inválido: ausente (Tipo) e a chave antiga some', () => {
    gravar(CHAVE_ANTIGA, { step: 7, type: 'title', variants: [varA, varB('x')] })
    montar()
    expect(noTipo()).not.toBeNull()
    expect(localStorage.getItem(CHAVE_ANTIGA)).toBeNull()
    cleanup(); localStorage.clear()
    localStorage.setItem(CHAVE_ANTIGA, '{nao-json')
    montar()
    expect(noTipo()).not.toBeNull()
    expect(localStorage.getItem(CHAVE_ANTIGA)).toBeNull()
  })

  it('antiga com mais de 7 dias é ausente', () => {
    gravar(CHAVE_ANTIGA, { step: 2, type: 'title', variants: [varA, varB('x')], savedAt: Date.now() - 8 * 24 * 3600 * 1000 })
    montar()
    expect(noTipo()).not.toBeNull()
  })

  it('v2 vence a antiga', () => {
    gravar(CHAVE_ANTIGA, { step: 0, type: 'title', variants: [varA, varB('antigo')] })
    gravar(CHAVE_V2, { step: 'variantes', type: 'title', variants: [varA, varB('novo')], draftTestId: null })
    montar()
    expect((screen.getByLabelText('Título da variante B') as HTMLInputElement).value).toBe('novo')
    expect(localStorage.getItem(CHAVE_ANTIGA)).toBeNull()
  })

  it('v2 com step "variantes" abre em Variantes; com step numérico (4) abre no Tipo', () => {
    gravar(CHAVE_V2, { step: 'variantes', type: 'title', variants: [varA, varB('x')], draftTestId: null })
    montar()
    expect(noTipo()).toBeNull()
    cleanup(); localStorage.clear()
    gravar(CHAVE_V2, { step: 4, type: 'title', variants: [varA, varB('x')], draftTestId: null })
    montar()
    expect(noTipo()).not.toBeNull()
  })

  it('v2 com draftTestId "d1" no Revisar: avisoDeVolume é chamado com "d1"', async () => {
    gravar(CHAVE_V2, { step: 'revisar', type: 'title', variants: [varA, varB('x')], draftTestId: 'd1' })
    montar()
    await waitFor(() => expect(avisoDeVolume).toHaveBeenCalled())
    expect(avisoDeVolume.mock.calls[0]?.[0]).toBe('d1')
  })

  it('saveDraft grava step por nome, draftTestId e não grava hypothesis nem config', () => {
    gravar(CHAVE_V2, { step: 'variantes', type: 'title', variants: [varA, varB('x')], draftTestId: 'd7' })
    montar()
    const salvo = JSON.parse(localStorage.getItem(CHAVE_V2) ?? '{}') as Record<string, unknown>
    expect(salvo.step).toBe('variantes')
    expect(salvo.draftTestId).toBe('d7')
    expect('hypothesis' in salvo).toBe(false)
    expect('config' in salvo).toBe(false)
  })

  it('o localStorage é lido uma vez por montagem, não por tecla', () => {
    gravar(CHAVE_V2, { step: 'variantes', type: 'title', variants: [varA, varB('')], draftTestId: null })
    montar()
    const antes = getItem.mock.calls.length
    const campo = screen.getByLabelText('Título da variante B')
    for (const v of ['a', 'ab', 'abc']) fireEvent.change(campo, { target: { value: v } })
    expect(getItem.mock.calls.length).toBe(antes)
  })
})

describe('M6 T3: o que é gravado não muda (D-M6-1)', () => {
  it('do Tipo ao Ativar, o config de createAbTest é o do padrão do site, sem max_duration_days nem teto_explicito', async () => {
    m.createAbTest.mockResolvedValue({ ok: true, id: 'd1' })
    montar()
    await act(async () => { fireEvent.click(screen.getAllByRole('radio').find(r => (r.textContent ?? '').includes('Só o título muda'))!) })
    await waitFor(() => expect(screen.getByLabelText('Título da variante B')).toBeTruthy())
    const config = m.createAbTest.mock.calls[0]?.[0]?.config as Record<string, unknown>
    expect(config).toEqual(wizardConfigToAbConfig(initWizardConfig(settings)))
    expect('max_duration_days' in config).toBe(false)
    expect('teto_explicito' in config).toBe(false)
    fireEvent.change(screen.getByLabelText('Título da variante B'), { target: { value: 'Novo' } })
    fireEvent.click(proximo())
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: /Ativar teste/ })) })
    await waitFor(() => expect(iniciar).toHaveBeenCalledWith('d1'))
  })
})
