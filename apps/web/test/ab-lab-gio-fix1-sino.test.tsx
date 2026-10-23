// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { ListaCaminho, type AcoesCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho'
import { ContextoAssistente, useControleAssistente } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/assistente-contexto'
import { NotificationRow } from '@/app/cms/(authed)/_shared/notification-row'
import type { INotification } from '@/lib/notifications/types'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('next/link', () => ({ default: ({ children, href, ...r }: { children: ReactNode; href: string }) => <a href={href} {...r}>{children}</a> }))
afterEach(() => cleanup())

const AGORA = new Date('2026-10-22T15:00:00.000Z')
function linha(n: number, o: Partial<LinhaDoCaminho> = {}): LinhaDoCaminho {
  return {
    videoId: `uuid-${n}`, ytId: `vid${n}`, titulo: `Vídeo ${n}`, miniaturaUrl: null, publicadoEm: new Date(AGORA.getTime() - 5 * 86_400_000).toISOString(),
    estado: 'sugerido_youtube', caminho: { tipo: 'nativo', portao: true, motivo: 'Vídeo longo com volume.' },
    fichaId: null, registro: null, labPausadoAte: null, nosso: null, impressoesPorDia: 300, ...o,
  }
}
const acoes = {} as unknown as AcoesCaminho
const painel = (l: LinhaDoCaminho): ReactNode => <section data-testid="painel"><h2 tabIndex={-1}>Ficha: {l.titulo}</h2></section>
function Harness({ linhas, videoInicial }: { linhas: LinhaDoCaminho[]; videoInicial: string | null }): ReactNode {
  const controle = useControleAssistente({ onAbrir: vi.fn(), atualizar: vi.fn(), agora: () => AGORA })
  return <ContextoAssistente.Provider value={controle}><ListaCaminho linhas={linhas} videoInicial={videoInicial} acoes={acoes} painel={painel} agora={() => AGORA} /></ContextoAssistente.Provider>
}

describe('Gio F-6: o sino abre a ficha com a tela do Lab já aberta', () => {
  it('?video= muda depois da montagem: a ficha do vídeo abre', () => {
    const linhas = [linha(1, { fichaId: 'f1' }), linha(2)]
    const r = render(<Harness linhas={linhas} videoInicial={null} />)
    expect(screen.queryByTestId('painel')).toBeNull()
    r.rerender(<Harness linhas={linhas} videoInicial="vid1" />)
    expect(screen.getByTestId('painel').textContent).toContain('Vídeo 1')
  })
})

const notif = (o: Partial<INotification> = {}): INotification => ({
  id: 'n1', site_id: 's', user_id: 'u', type: 'youtube.native_ficha_lembrar', domain: 'youtube', priority: 3, title: 'Abrir a ficha no computador',
  message: 'm', payload: null, dedup_key: 'k', group_key: null, read_at: null, dismissed_at: null, expired_at: null, snoozed_until: null,
  suggested_action: 'Abrir a ficha', action_href: '/cms/youtube/ab-lab?video=x', created_at: AGORA.toISOString(), ...o,
})
describe('Gio F-6: botão do aviso visível sem hover', () => {
  it('o botão de ação não nasce com opacity-0 (sem depender de hover)', () => {
    render(<NotificationRow notification={notif()} onAction={vi.fn()} />)
    const botao = screen.getByLabelText('Abrir a ficha')
    let el: HTMLElement | null = botao
    while (el) { expect(el.className).not.toMatch(/(^|\s)opacity-0(\s|$)/); el = el.parentElement }
  })
})
