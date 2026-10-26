// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { VideoPickerDialog, type EligibleVideo } from '@/app/cms/(authed)/youtube/ab-lab/_components/video-picker-dialog'

vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({ YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('../../src/app/cms/(authed)/youtube/_components/yt-portal', () => ({ YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

const base: EligibleVideo = {
  id: 'v1', title: 'Fila de ramen', thumbnailUrl: 'https://x/t.jpg', durationSeconds: 768,
  channelHandle: '@bythiago', hasActiveTest: false, statusDoTeste: null, bloqueio: null,
  publishedAt: '2026-10-21T21:32:00Z', viewCount: 12345, previousLift: null, sourcePipelineId: null,
}
const v = (o: Partial<EligibleVideo>): EligibleVideo => ({ ...base, ...o })

function abrir(videos: EligibleVideo[], onSelect = vi.fn()) {
  render(<VideoPickerDialog eligibleVideos={videos} onSelect={onSelect} onClose={() => undefined} />)
  return onSelect
}

afterEach(cleanup)

describe('M6 seletor de vídeo', () => {
  it('cabeçalho e apoio', () => {
    abrir([base])
    expect(screen.getByText('Selecionar vídeo')).toBeTruthy()
    expect(screen.getByText(/Os mais recentes aparecem primeiro\./)).toBeTruthy()
    expect(screen.getByPlaceholderText('Buscar vídeos...')).toBeTruthy()
  })
  it('vídeos de mesmo título se diferenciam pela data', () => {
    abrir([v({ id: 'a', publishedAt: '2026-10-21T21:32:00Z' }), v({ id: 'b', publishedAt: '2026-10-20T14:05:00Z' })])
    expect(screen.getByText(/21 out 2026, 18:32/)).toBeTruthy()
    expect(screen.getByText(/20 out 2026, 11:05/)).toBeTruthy()
  })
  it('mostra duração, data e visualizações; nenhum @', () => {
    const { container } = render(<VideoPickerDialog eligibleVideos={[base]} onSelect={() => undefined} onClose={() => undefined} />)
    expect(container.textContent).toContain('Duração 12:48')
    expect(container.textContent).toContain('12.345 visualizações')
    expect(container.textContent).not.toContain('@')
    cleanup()
  })
  it('teste em andamento: linha desabilitada, motivo sem opacidade no nó', () => {
    abrir([v({ hasActiveTest: true, statusDoTeste: 'active' })])
    const btn = screen.getByRole('button', { name: /Fila de ramen/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    const motivo = screen.getByText('Teste ativo em andamento')
    expect(getComputedStyle(motivo).opacity === '' || getComputedStyle(motivo).opacity === '1').toBe(true)
  })
  it('rascunho diz "Já tem um rascunho"', () => {
    abrir([v({ hasActiveTest: true, statusDoTeste: 'draft' })])
    expect(screen.getByText('Já tem um rascunho')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Fila de ramen/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('bloqueios de Short e de thumbnail HQ', () => {
    abrir([v({ id: 's', title: 'Curto', bloqueio: 'short' }), v({ id: 'h', title: 'Sem HQ', bloqueio: 'sem_thumb_hq' })])
    expect(screen.getByText('Shorts não entram no A/B Lab')).toBeTruthy()
    expect(screen.getByText('Sincronize o vídeo em Vídeos antes')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Curto/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Sem HQ/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('título longo usa line-clamp-2', () => {
    abrir([v({ title: 'x'.repeat(120) })])
    expect(screen.getByText('x'.repeat(120)).className).toContain('line-clamp-2')
  })
  it('dado ausente some ou diz "não informada"', () => {
    const { container } = render(<VideoPickerDialog eligibleVideos={[v({ thumbnailUrl: null, durationSeconds: 0, publishedAt: null, viewCount: null })]} onSelect={() => undefined} onClose={() => undefined} />)
    expect(container.textContent).toContain('Sem thumbnail')
    expect(container.textContent).not.toContain('Duração')
    expect(container.textContent).toContain('Data de publicação não informada')
    expect(container.textContent).not.toContain('visualizaç')
    cleanup()
  })
  it('viewCount 0 não mostra visualizações', () => {
    const { container } = render(<VideoPickerDialog eligibleVideos={[v({ viewCount: 0 })]} onSelect={() => undefined} onClose={() => undefined} />)
    expect(container.textContent).not.toContain('visualizaç')
    cleanup()
  })
  it('clicar chama onEscolher com duração, data e canal', () => {
    const onSelect = abrir([base])
    fireEvent.click(screen.getByRole('button', { name: /Fila de ramen/ }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: 'v1', durationSeconds: 768, publishedAt: '2026-10-21T21:32:00Z', channelHandle: '@bythiago',
    }))
  })
})
