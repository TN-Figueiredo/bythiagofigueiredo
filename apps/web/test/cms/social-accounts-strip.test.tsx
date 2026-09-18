// @vitest-environment jsdom
/**
 * A faixa de contas de /cms/social.
 *
 * Ela existe para dizer ao dono o que precisa da mão dele. Em 2026-09-18 ela
 * dizia o contrário em dois pontos:
 *   1. pedia "reconectar" para as duas contas do YouTube, que guardam refresh
 *      token e se renovam sozinhas — o access token do Google dura ~1 h, então
 *      o vencimento é o ciclo normal;
 *   2. o botão da conta do Instagram levava para /cms/settings, que é a tela do
 *      FEED (outra tabela, outro OAuth, e justamente a que está bloqueada) e
 *      não reconecta esta conexão de PUBLICAÇÃO nenhuma.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ConnectionHealth } from '@/lib/social/actions/connections'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('@/app/cms/(authed)/_shared/social/platform-icon', () => ({
  PlatformIcon: ({ provider }: { provider: string }) => <span>{provider}</span>,
}))

import { AccountsStripClient } from '@/app/cms/(authed)/social/_components/accounts-strip-client'

function conn(over: Partial<ConnectionHealth> = {}): ConnectionHealth {
  return {
    connectionId: 'c1',
    provider: 'facebook',
    accountName: 'Figueiredo',
    status: 'ok',
    followersCount: 100,
    tokenExpiresIn: 30,
    tokenExpiresInHours: 720,
    renewsAutomatically: false,
    ...over,
  }
}

function reconnectHref(): string | null {
  const link = screen.queryByRole('link', { name: /reconectar/i })
  return link ? link.getAttribute('href') : null
}

describe('faixa de contas de /cms/social', () => {
  it('conta que se renova sozinha aparece como válida, sem pedir reconexão', () => {
    render(
      <AccountsStripClient
        connections={[
          conn({
            provider: 'youtube',
            accountName: '@tnfigueiredotv',
            status: 'ok',
            renewsAutomatically: true,
            tokenExpiresIn: -1,
            tokenExpiresInHours: -3,
          }),
        ]}
      />,
    )
    expect(screen.getByText(/token válido/i)).toBeTruthy()
    expect(reconnectHref()).toBeNull()
  })

  it('a conexão de PUBLICAÇÃO do Instagram reconecta em /cms/social/accounts, não na tela do feed', () => {
    render(
      <AccountsStripClient
        connections={[conn({ provider: 'instagram', accountName: 'thiagonfigueiredo', status: 'error' })]}
      />,
    )
    expect(reconnectHref()).toBe('/cms/social/accounts')
    expect(reconnectHref()).not.toContain('/cms/settings')
  })

  it('o Facebook vencido também vai para a tela de contas', () => {
    render(<AccountsStripClient connections={[conn({ status: 'error' })]} />)
    expect(screen.getByText(/token expirado/i)).toBeTruthy()
    expect(reconnectHref()).toBe('/cms/social/accounts')
  })

  it('o YouTube continua indo para a própria tela', () => {
    render(
      <AccountsStripClient
        connections={[conn({ provider: 'youtube', accountName: '@x', status: 'error' })]}
      />,
    )
    expect(reconnectHref()).toBe('/cms/youtube')
  })

  it('menos de um dia restante é dito em HORAS, não arredondado para "1 dias"', () => {
    render(
      <AccountsStripClient
        connections={[conn({ status: 'warn', tokenExpiresIn: 0, tokenExpiresInHours: 5 })]}
      />,
    )
    expect(screen.getByText(/expira em 5 horas/i)).toBeTruthy()
    expect(screen.queryByText(/dias/i)).toBeNull()
  })

  it('a partir de um dia continua em dias, no plural certo', () => {
    render(<AccountsStripClient connections={[conn({ status: 'warn', tokenExpiresIn: 1, tokenExpiresInHours: 30 })]} />)
    expect(screen.getByText(/expira em 1 dia —/i)).toBeTruthy()
  })
})
