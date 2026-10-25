// @vitest-environment jsdom
// T10: pausa do NOSSO teste por haver teste do YouTube. O "Retomar" segue o DADO (registro aberto), a data é só texto (Phil C7, Yannis M6).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { NOTA_TESTE_YOUTUBE, TEXTO_SEM_LEITURA } from '@/lib/youtube/ab-settle'
import { pausaVisivel } from '@/lib/youtube/teste-youtube/nativo/pausa-visivel'
import { lerPausasYoutube } from '@/lib/youtube/teste-youtube/nativo/pausa-borda'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { AbCreateWizard } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-create-wizard'
import { MOTIVO_GUARDA_FALHOU, MOTIVO_RECUSA_NATIVO } from '@/lib/youtube/teste-youtube/nativo/guarda'
import type { AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { AbConfirmarTrocaDialog } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-confirmar-troca-dialog'
import type { AbTestActiveView, FullChartVariant } from '@/lib/youtube/ab-types'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), applyWinnerNow: vi.fn(), cancelGracePeriod: vi.fn(), acknowledgeAbTestDrift: vi.fn(),
  createAbTest: vi.fn(), uploadVariant: vi.fn(), createTextVariant: vi.fn(async () => ({ ok: true })), updateAbTestType: vi.fn(),
  cleanupDraftVariants: vi.fn(async () => ({ ok: true })), fetchAbBriefingData: vi.fn(), fetchLibraryEntries: vi.fn(), lerDimensoesDaOriginal: vi.fn(async () => ({ ok: false })),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({ usePollStats: () => ({ data: null, loading: false }) }))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({ YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

afterEach(() => cleanup())

// 04/11/2026 22:00 em São Paulo = 05/11 01:00 UTC. O instante exato é a fronteira.
const ATE = '2026-11-05T01:00:00.000Z'
const ANTES = new Date('2026-11-05T00:59:59.000Z')
const NO_INSTANTE = new Date(ATE)
const DEPOIS = new Date('2026-11-05T01:00:01.000Z')

describe('pausaVisivel (puro)', () => {
  it('registro aberto, antes da hora: frase com dd/mm, HH:MM e Retomar desabilitado', () => {
    const r = pausaVisivel({ aberto: true, ate: ATE }, ANTES)
    expect(r.frase).toBe('Lab pausado porque há teste no Studio. Retomar fica disponível a partir de 04/11, 22:00.')
    expect(r.retomarDesabilitado).toBe(true)
  })
  it('registro aberto, no instante e depois: a frase vira "espera o resultado" e o botão CONTINUA desabilitado (dado, não data)', () => {
    for (const t of [NO_INSTANTE, DEPOIS]) {
      const r = pausaVisivel({ aberto: true, ate: ATE }, t)
      expect(r.frase).toBe('Retomar espera o resultado do teste no Studio.')
      expect(r.retomarDesabilitado).toBe(true)
    }
  })
  it('registro que deixou de estar aberto libera o Retomar, antes ou depois da data', () => {
    for (const t of [ANTES, DEPOIS]) {
      const r = pausaVisivel({ aberto: false, ate: null }, t)
      expect(r).toEqual({ frase: null, retomarDesabilitado: false })
    }
  })
  it('hora 00:00 mostra só dd/mm', () => {
    const r = pausaVisivel({ aberto: true, ate: '2026-11-04T03:00:00.000Z' }, new Date('2026-11-03T12:00:00.000Z'))
    expect(r.frase).toContain('a partir de 04/11.')
  })
  it('sem leitura do registro (nulo) falha fechada; data ausente ou inválida também não inventa dia', () => {
    expect(pausaVisivel(null, ANTES)).toEqual({ frase: FRASES.s7.retomarEspera, retomarDesabilitado: true })
    expect(pausaVisivel({ aberto: true, ate: null }, ANTES).retomarDesabilitado).toBe(true)
    expect(pausaVisivel({ aberto: true, ate: 'lixo' }, ANTES).frase).toBe(FRASES.s7.retomarEspera)
  })
})

describe('lerPausasYoutube (borda)', () => {
  const fake = (data: unknown[] | null, error: { message: string } | null = null) => {
    const q = { select: vi.fn(() => q), eq: vi.fn(() => q), in: vi.fn(() => Promise.resolve({ data, error })) }
    return { from: vi.fn(() => q), q }
  }
  const t = (id: string, o: Partial<{ status: string; status_note: string | null; youtube_video_id: string | null }> = {}) =>
    ({ id, status: 'paused', status_note: NOTA_TESTE_YOUTUBE, youtube_video_id: `v-${id}`, ...o })

  it('só testes pausados com a nota do teste do YouTube entram; os outros nem disparam leitura', async () => {
    const sb = fake([])
    const m = await lerPausasYoutube(sb as never, 's1', [t('a', { status_note: 'outra nota' }), t('b', { status: 'active' })])
    expect(m.size).toBe(0)
    expect(sb.from).not.toHaveBeenCalled()
  })
  it('registro aberto vira {aberto, ate = início + 14 d + 2 d}; sem registro aberto vira {aberto:false}', async () => {
    const sb = fake([{ video_id: 'v-a', confirmado_em: '2026-10-19T12:00:00.000Z', primeira_vista: '2026-10-19T09:40:00.000Z', created_at: '2026-10-19T09:40:00.000Z' }])
    const m = await lerPausasYoutube(sb as never, 's1', [t('a'), t('b')])
    expect(m.get('a')).toEqual({ aberto: true, ate: '2026-11-04T09:40:00.000Z' })
    expect(m.get('b')).toEqual({ aberto: false, ate: null })
  })
  it('falha de leitura falha fechada: aberto sem data (nunca "liberado")', async () => {
    const m = await lerPausasYoutube(fake(null, { message: 'x' }) as never, 's1', [t('a')])
    expect(m.get('a')).toEqual({ aberto: true, ate: null })
  })
  it('falha de leitura avisa o Sentry (Retomar travado não pode ficar calado), sem dado do dono', async () => {
    vi.mocked(Sentry.captureMessage).mockClear()
    await lerPausasYoutube(fake(null, { message: 'x' }) as never, 's1', [t('a')])
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls[0])).not.toContain('v-a')
  })
})

const vz = (label: 'A' | 'B'): FullChartVariant => ({ label, color: '#888', ctr: 0, impressions: 0, clicks: 0, pBest: 0.5 })
const viewPausado = (extra: Record<string, unknown>): AbTestActiveView => ({
  id: 't1', videoTitle: 'V', flag: 'thumbnail', status: 'paused', statusNote: NOTA_TESTE_YOUTUBE, restoreSeq: 3,
  variants: [vz('A'), vz('B')], variantThumbs: [], confTrend: [], daily: { A: [0], B: [0] }, abbaSeq: ['A', 'B'],
  cycles: { total: 6, done: 0 }, durationDays: 14, confidenceTarget: 0.95, totalRounds: 1, hasPlayoff: false, gates: [],
  confirmedData: { confidence: 0, leader: 'A', leaderColor: '#888', lift: 0 }, dayOf: 4, ...extra,
}) as unknown as AbTestActiveView

describe('ActiveDetail: nosso teste pausado por teste do YouTube', () => {
  const props = () => ({ encerrar: vi.fn(), pausar: vi.fn(), retomar: vi.fn().mockResolvedValue({ ok: true, resultado: 'feito', campos: {} }) })
  const botao = (): HTMLButtonElement => screen.getByRole('button', { name: /Retomar/ }) as HTMLButtonElement

  it('registro aberto, antes da hora: a frase com dd/mm, HH:MM e Retomar desabilitado', () => {
    render(<ActiveDetail view={viewPausado({ pausaYoutube: { aberto: true, ate: ATE } })} {...props()} agora={() => ANTES} />)
    expect(screen.getByText('Lab pausado porque há teste no Studio. Retomar fica disponível a partir de 04/11, 22:00.')).toBeTruthy()
    expect(botao().disabled).toBe(true)
  })
  it('registro aberto, depois da hora: "Retomar espera o resultado..." e botão ainda desabilitado', () => {
    render(<ActiveDetail view={viewPausado({ pausaYoutube: { aberto: true, ate: ATE } })} {...props()} agora={() => DEPOIS} />)
    expect(screen.getByText(FRASES.s7.retomarEspera)).toBeTruthy()
    expect(botao().disabled).toBe(true)
  })
  it('registro que deixou de estar aberto: Retomar habilitado e chama a ação por prop com o restoreSeq', () => {
    const p = props()
    render(<ActiveDetail view={viewPausado({ pausaYoutube: { aberto: false, ate: null } })} {...p} agora={() => ANTES} />)
    expect(botao().disabled).toBe(false)
    expect(screen.queryByText(/Lab pausado porque há teste/)).toBeNull()
    fireEvent.click(botao())
    expect(p.retomar).toHaveBeenCalledWith(3)
  })
  it('pausa por outro motivo segue como antes (sem a frase do teste do YouTube)', () => {
    render(<ActiveDetail view={viewPausado({ statusNote: null })} {...props()} agora={() => ANTES} />)
    expect(botao().disabled).toBe(false)
    expect(screen.queryByText(/há teste no Studio/)).toBeNull()
  })
})

describe('AbConfirmarTrocaDialog: leitura do YouTube que falhou', () => {
  const opcao = { id: 'o', rotulo: 'A', isOriginal: true, titulo: 'Meu título', miniatura: 'https://x/a.jpg' }
  it.each(['', TEXTO_SEM_LEITURA])('título com valor_atual %j mostra a frase no lugar do título', (v) => {
    render(<AbConfirmarTrocaDialog campos={[{ campo: 'title', valor_atual: v }]} opcao={opcao} onVoltar={vi.fn()} onConfirmar={vi.fn()} />)
    expect(screen.getByText('Não deu para conferir o título agora; tente de novo.')).toBeTruthy()
  })
  it('miniatura sem leitura mostra o mesmo texto no lugar da imagem, nunca caixa em branco', () => {
    render(<AbConfirmarTrocaDialog campos={[{ campo: 'thumbnail', valor_atual: '' }]} opcao={opcao} onVoltar={vi.fn()} onConfirmar={vi.fn()} />)
    expect(screen.getByText('Não deu para conferir o título agora; tente de novo.')).toBeTruthy()
    expect(screen.queryByText('Sem imagem')).toBeNull()
  })
  it('com leitura boa o título aparece como sempre', () => {
    render(<AbConfirmarTrocaDialog campos={[{ campo: 'title', valor_atual: 'Título de fora' }]} opcao={opcao} onVoltar={vi.fn()} onConfirmar={vi.fn()} />)
    expect(screen.getByText('Título de fora')).toBeTruthy()
    expect(screen.queryByText('Não deu para conferir o título agora; tente de novo.')).toBeNull()
  })
})

describe('assistente: recusa da guarda ao iniciar o nosso teste (D-7)', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) }, clear: () => store.clear() })
  })
  const montar = (iniciarTeste: ReturnType<typeof vi.fn>) => render(
    <AbCreateWizard
      video={{ id: 'vid-1', title: 'Meu vídeo', thumbnailUrl: null }} siteId="s1" settings={{} as AbTestSiteSettings}
      onClose={vi.fn()} onCreated={vi.fn()} iniciarTeste={iniciarTeste as never}
      existingDraftId="d1"
      prefill={{ testType: 'title', draftVariants: [
        { label: 'A', isOriginal: true, thumbUrl: null, titleText: 'Meu vídeo' }, { label: 'B', isOriginal: false, thumbUrl: null, titleText: 'Outro título' },
      ] }}
    />,
  )

  it('MOTIVO_RECUSA_NATIVO vira a frase fechada de D-7 (sem inventar a data), sem "Tentar de novo", sem o texto provisório do servidor', async () => {
    const iniciar = vi.fn().mockResolvedValue({ ok: false, error: MOTIVO_RECUSA_NATIVO, codigo: 'teste_youtube' })
    montar(iniciar)
    fireEvent.click(screen.getByRole('button', { name: 'Ativar teste' }))
    const msg = await screen.findByRole('alert')
    expect(msg.textContent).toBe(FRASES.guarda.motivoRecusaSemData)
    expect(msg.textContent).toContain('Aguarde o resultado ou responda o teste antes de iniciar o nosso.')
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(document.body.textContent).not.toContain(MOTIVO_RECUSA_NATIVO)
  })
  it('MOTIVO_GUARDA_FALHOU vira a frase fechada com "Tentar de novo"; o botão repete SÓ o início (sem recriar versões)', async () => {
    const iniciar = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: MOTIVO_GUARDA_FALHOU, codigo: 'guarda_falhou' })
      .mockResolvedValueOnce({ ok: true })
    const { createTextVariant } = await import('@/app/cms/(authed)/youtube/ab-lab/actions')
    montar(iniciar)
    fireEvent.click(screen.getByRole('button', { name: 'Ativar teste' }))
    const msg = await screen.findByRole('alert')
    expect(msg.textContent).toContain('Não deu para conferir se este vídeo já tem teste do YouTube. Nada foi iniciado.')
    expect(document.body.textContent).not.toContain(MOTIVO_GUARDA_FALHOU)
    const criadas = vi.mocked(createTextVariant).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(iniciar).toHaveBeenCalledTimes(2))
    expect(iniciar).toHaveBeenNthCalledWith(2, 'd1')
    expect(vi.mocked(createTextVariant).mock.calls.length).toBe(criadas)
  })
  it('recusa com `ate`: a frase fechada de D-7 traz "até dd/mm"; sem `ate`, a frase sem data; o texto cru do servidor nunca decide', async () => {
    const iniciar = vi.fn().mockResolvedValue({ ok: false, error: 'texto qualquer do servidor', codigo: 'teste_youtube', ate: ATE })
    montar(iniciar)
    fireEvent.click(screen.getByRole('button', { name: 'Ativar teste' }))
    const msg = await screen.findByRole('alert')
    expect(msg.textContent).toBe(FRASES.guarda.motivoRecusa(new Date(ATE)))
    expect(msg.textContent).toContain('registrado até 04/11.')
    expect(document.body.textContent).not.toContain('texto qualquer do servidor')
  })
  it('recusa pelo código mesmo com mensagem diferente da constante antiga', async () => {
    montar(vi.fn().mockResolvedValue({ ok: false, error: 'outra redação', codigo: 'guarda_falhou' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ativar teste' }))
    const msg = await screen.findByRole('alert')
    expect(msg.textContent).toContain(FRASES.guarda.guardaFalhou)
  })
  it('a recusa some ao mudar de passo e ao editar uma versão; "Tentar de novo" não volta com versões velhas', async () => {
    const iniciar = vi.fn().mockResolvedValue({ ok: false, error: MOTIVO_GUARDA_FALHOU, codigo: 'guarda_falhou' })
    montar(iniciar)
    fireEvent.click(screen.getByRole('button', { name: 'Ativar teste' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    })
  })
  it('outro erro do servidor vira o texto 10 em português, sem o texto cru; o botão primário vira "Tentar de novo"', async () => {
    montar(vi.fn().mockResolvedValue({ ok: false, error: 'Quota excedida' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ativar teste' }))
    const msg = await screen.findByRole('alert')
    expect(msg.textContent).toContain('Não foi possível ativar')
    expect(msg.textContent).toContain('O rascunho ficou salvo')
    expect(document.body.textContent).not.toContain('Quota excedida')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
})
