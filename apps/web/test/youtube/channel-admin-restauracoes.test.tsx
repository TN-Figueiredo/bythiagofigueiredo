// @vitest-environment jsdom
/** Prévia de remoção de canal: o texto das restaurações pendentes do A/B (emenda 39). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { RemovalPanel } from '@/app/cms/(authed)/youtube/_channels/channel-admin'
import { restauracaoLinha, RESTAURACOES_NAO_CONFERIDAS, type RemovalImpact, type RestauracaoPendente } from '@/lib/youtube/channel-registry'

vi.mock('next/link', () => ({ default: (p: { href: string; children: unknown }) => <a href={p.href}>{p.children as never}</a> }))
vi.mock('@/app/cms/(authed)/youtube/_channels/channels.css', () => ({}))
afterEach(cleanup)

const base: RemovalImpact = {
  name: 'Canal', slug: 'canal', videos: 1, comments: 0, syncLogs: 0, abTests: 0, abDrafts: 0, analyses: 0, tasks: 0, notes: 0,
  notifications: 0, connections: 0, pipelineLinks: 0, serieColetada: 0, blockers: [], restauracoesPendentes: [],
}
const painel = (restauracoesPendentes: RestauracaoPendente[] | null) =>
  render(
    <RemovalPanel
      channelId="c1" name="Canal" removing={false} onRemovingChange={() => {}} onRemoved={() => {}} onClose={() => {}}
      onRemove={async () => ({ ok: true })} onImpact={async () => ({ ok: true, impact: { ...base, restauracoesPendentes } })}
    />,
  )

describe('RemovalPanel: restaurações pendentes', () => {
  it('lista pendente: a frase exata, e o botão de remover continua existindo (não bloqueia)', async () => {
    painel([{ testId: 't', videoTitulo: 'Geórgia', campo: 'title', estado: 'em_andamento', noAr: 'a variante B' }])
    await waitFor(() => expect(screen.getByText('O título do vídeo Geórgia ficou com a variante B. Depois da remoção, só o YouTube Studio corrige.')).toBeTruthy())
    expect(screen.getByRole('button', { name: /Remove channel/ })).toBeTruthy()
    expect(screen.queryByText(RESTAURACOES_NAO_CONFERIDAS)).toBeNull()
  })
  it('leitura falhou (null): "Não foi possível conferir…", e a prévia segue', async () => {
    painel(null)
    await waitFor(() => expect(screen.getByText('Não foi possível conferir restaurações pendentes deste canal.')).toBeTruthy())
    expect(screen.getByRole('button', { name: /Remove channel/ })).toBeTruthy()
  })
  it('zero pendentes: nenhum texto novo', async () => {
    const { container } = painel([])
    await waitFor(() => expect(screen.getByRole('button', { name: /Remove channel/ })).toBeTruthy())
    expect(container.textContent).not.toContain('YouTube Studio corrige')
    expect(container.textContent).not.toContain('Não foi possível conferir')
  })
})

describe('restauracaoLinha', () => {
  it('as três formas', () => {
    expect(restauracaoLinha({ testId: 'x', videoTitulo: 'G', campo: 'thumbnail', estado: 'falhou', noAr: 'não se sabe' }))
      .toBe('Não se sabe o que está no ar na thumbnail do vídeo G. Depois da remoção, só o YouTube Studio corrige.')
    expect(restauracaoLinha({ testId: 'x', videoTitulo: 'I', campo: 'title', estado: 'pulado_drift', noAr: 'o título editado por fora' }))
      .toBe('O título do vídeo I foi editado por fora. Depois da remoção, só o YouTube Studio corrige.')
    expect(restauracaoLinha({ testId: 'x', videoTitulo: 'I', campo: 'thumbnail', estado: 'pulado_sem_original', noAr: 'o original' }))
      .toBe('A thumbnail do vídeo I ficou com o original. Depois da remoção, só o YouTube Studio corrige.')
  })
})
