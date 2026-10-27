// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { LinhaCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/linha-caminho'
import { CartaoEmTesteView } from '@/app/cms/(authed)/youtube/ab-lab/_components/pagina/cartao-em-teste'
import { makeCardView } from './helpers/ab-fixtures'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href, ...r }: { children: ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))

const AGORA = new Date('2026-10-22T15:00:00.000Z')
const dia = (n: number): string => new Date(AGORA.getTime() - n * 86_400_000).toISOString()
const base = (o: Partial<LinhaDoCaminho>): LinhaDoCaminho => ({
  videoId: 'u1', ytId: 'vid00000001', titulo: 'Vídeo do teste', miniaturaUrl: null, publicadoEm: dia(30), estado: 'sugerido_youtube',
  caminho: { tipo: 'nativo', portao: true, motivo: 'x' }, fichaId: null, registro: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300, ...o,
} as LinhaDoCaminho)
const props = (l: LinhaDoCaminho) => ({ l, agora: AGORA, escolhaNosso: false, aoPreferir: vi.fn(), aoAbrirPainel: vi.fn(), aoIniciar: vi.fn(), perguntaAberta: false, aoSeguirComNosso: vi.fn(), aoFecharPergunta: vi.fn(), aoAtualizar: vi.fn(), aoRegistrar: vi.fn(), jaIniciei: vi.fn(), responderAberta: false, responderPrimario: false, aoMudarResponder: vi.fn(), blocoAberto: false, aoMudarBloco: vi.fn() })
afterEach(cleanup)

describe('linha da lista: dia e link (M7 T10)', () => {
  it('nosso iniciado há 0 dias com teto 15: linha e cartão dizem "Dia 1/15"; Studio no 3º dia (diaDe14 = 3) diz "Dia 4/14"; o texto da linha não contém " de 14"', () => {
    const { container } = render(<ul><LinhaCaminho {...props(base({ estado: 'nosso_rodando', nosso: { testId: 't1', restoreSeq: 0, dia: 0, teto: 15, status: 'active' } }))} /></ul>)
    expect(container.textContent).toContain('Dia 1/15')
    expect(container.textContent).not.toContain(' de 14')
    expect(container.textContent).not.toMatch(/dia 0/i)
    cleanup()
    const card = makeCardView({ id: 't1', status: 'active', type: 'title', diaV2: { dia: 0, teto: 15 } })
    render(<CartaoEmTesteView cartao={{ tipo: 'lab', card, lider: null, semLider: 'poucos dados', proximaTroca: null, painel: null }} unico onAbrirPainel={vi.fn()} onAbrirDia14={vi.fn()} />)
    expect(screen.getByText('Dia 1/15')).toBeTruthy()
    cleanup()
    const reg = { id: 'r', updatedAt: dia(1), inicio: dia(3), confirmadoEm: dia(3), primeiraVista: dia(3), diaDe14: 3, variantes: null, variantesTitulo: null, campos: null, respostaDono: null }
    const s = render(<ul><LinhaCaminho {...props(base({ estado: 'em_teste_studio', registro: reg }))} /></ul>)
    expect(s.container.textContent).toContain('Dia 4/14')
    expect(s.container.textContent).not.toContain(' de 14')
  })
  it('getByRole("link", { name: /^Ver teste/ }) acha o link da linha; a string "Abrir teste" não existe na página', () => {
    const { container } = render(<ul><LinhaCaminho {...props(base({ estado: 'nosso_rodando', nosso: { testId: 't9', restoreSeq: 0, dia: 2, teto: 14, status: 'active' } }))} /></ul>)
    const a = screen.getByRole('link', { name: /^Ver teste/ })
    expect(a.getAttribute('href')).toBe('/cms/youtube/ab-lab/t9')
    expect(a.getAttribute('aria-label')).toBe('Ver teste de Vídeo do teste')
    expect(a.textContent).toBe('Ver teste')
    expect(container.textContent).not.toContain('Abrir teste')
  })
  it('a linha da lista está dentro de .cn-raiz e o botão da linha tem 44 px (regra com escopo)', () => {
    const css = readFileSync('src/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo.css', 'utf8')
    expect(css).toMatch(/\.cn-vrow \.cn-btn\s*\{\s*min-height:\s*44px;?\s*\}/)
    expect(css).toMatch(/\n\.cn-btn \{[^}]*min-height: 36px/)
  })
})
