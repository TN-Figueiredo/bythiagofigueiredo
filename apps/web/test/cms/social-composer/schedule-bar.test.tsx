import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

vi.mock('@/lib/social/queue', () => ({
  getNextQueueSlot: vi.fn().mockResolvedValue({
    date: '2026-05-14',
    hour: 15,
    scheduledAt: '2026-05-14T18:00:00Z',
    label: 'Qua 14 Mai, 15:00 BRT',
  }),
}))

describe('ScheduleBar', () => {
  const mockOnPublish = vi.fn()
  const mockOnSaveDraft = vi.fn()
  const mockOnScheduleChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 3 mode buttons: Agora, Agendar, Fila', async () => {
    const { ScheduleBar } = await import(
      '@/app/cms/(authed)/social/new/_components/schedule-bar'
    )

    render(
      <ScheduleBar
        mode="now"
        onModeChange={vi.fn()}
        scheduledAt=""
        onScheduleChange={mockOnScheduleChange}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        isPending={false}
        siteId="s1"
        showPipeline
      />,
    )

    expect(screen.getByText('Agora')).toBeDefined()
    expect(screen.getByText('Agendar')).toBeDefined()
    expect(screen.getByText('Fila')).toBeDefined()
  })

  it('shows date/time picker in Agendar mode', async () => {
    const { ScheduleBar } = await import(
      '@/app/cms/(authed)/social/new/_components/schedule-bar'
    )

    const { container } = render(
      <ScheduleBar
        mode="schedule"
        onModeChange={vi.fn()}
        scheduledAt=""
        onScheduleChange={mockOnScheduleChange}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        isPending={false}
        siteId="s1"
        showPipeline={false}
      />,
    )

    expect(container.querySelector('input[type="date"]')).not.toBeNull()
    expect(container.querySelector('input[type="time"]')).not.toBeNull()
  })

  it('shows "Publicar" button in Agora mode', async () => {
    const { ScheduleBar } = await import(
      '@/app/cms/(authed)/social/new/_components/schedule-bar'
    )

    render(
      <ScheduleBar
        mode="now"
        onModeChange={vi.fn()}
        scheduledAt=""
        onScheduleChange={mockOnScheduleChange}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        isPending={false}
        siteId="s1"
        showPipeline={false}
      />,
    )

    expect(screen.getByText('Publicar')).toBeDefined()
  })

  it('shows "Agendar" button in schedule mode', async () => {
    const { ScheduleBar } = await import(
      '@/app/cms/(authed)/social/new/_components/schedule-bar'
    )

    render(
      <ScheduleBar
        mode="schedule"
        onModeChange={vi.fn()}
        scheduledAt="2026-05-15T14:00"
        onScheduleChange={mockOnScheduleChange}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        isPending={false}
        siteId="s1"
        showPipeline={false}
      />,
    )

    // There are two "Agendar" texts — the mode button and the primary action button
    // Both should exist
    const agendarElements = screen.getAllByText('Agendar')
    expect(agendarElements.length).toBeGreaterThanOrEqual(2)
  })

  it('shows "Adicionar a Fila" button in Fila mode', async () => {
    const { ScheduleBar } = await import(
      '@/app/cms/(authed)/social/new/_components/schedule-bar'
    )

    render(
      <ScheduleBar
        mode="queue"
        onModeChange={vi.fn()}
        scheduledAt=""
        onScheduleChange={mockOnScheduleChange}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        isPending={false}
        siteId="s1"
        showPipeline={false}
      />,
    )

    await vi.waitFor(() => {
      expect(screen.getByText(/adicionar/i)).toBeDefined()
    })
  })

  it('always shows "Salvar Rascunho" button', async () => {
    const { ScheduleBar } = await import(
      '@/app/cms/(authed)/social/new/_components/schedule-bar'
    )

    render(
      <ScheduleBar
        mode="now"
        onModeChange={vi.fn()}
        scheduledAt=""
        onScheduleChange={mockOnScheduleChange}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        isPending={false}
        siteId="s1"
        showPipeline={false}
      />,
    )

    expect(screen.getByText('Salvar Rascunho')).toBeDefined()
  })

  it('calls onPublish when primary action clicked', async () => {
    const { ScheduleBar } = await import(
      '@/app/cms/(authed)/social/new/_components/schedule-bar'
    )

    render(
      <ScheduleBar
        mode="now"
        onModeChange={vi.fn()}
        scheduledAt=""
        onScheduleChange={mockOnScheduleChange}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        isPending={false}
        siteId="s1"
        showPipeline={false}
      />,
    )

    fireEvent.click(screen.getByText('Publicar'))
    expect(mockOnPublish).toHaveBeenCalled()
  })

  it('calls onSaveDraft when draft button clicked', async () => {
    const { ScheduleBar } = await import(
      '@/app/cms/(authed)/social/new/_components/schedule-bar'
    )

    render(
      <ScheduleBar
        mode="now"
        onModeChange={vi.fn()}
        scheduledAt=""
        onScheduleChange={mockOnScheduleChange}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        isPending={false}
        siteId="s1"
        showPipeline={false}
      />,
    )

    fireEvent.click(screen.getByText('Salvar Rascunho'))
    expect(mockOnSaveDraft).toHaveBeenCalled()
  })

  it('shows pipeline one-liner when showPipeline is true', async () => {
    const { ScheduleBar } = await import(
      '@/app/cms/(authed)/social/new/_components/schedule-bar'
    )

    render(
      <ScheduleBar
        mode="now"
        onModeChange={vi.fn()}
        scheduledAt=""
        onScheduleChange={mockOnScheduleChange}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        isPending={false}
        siteId="s1"
        showPipeline
      />,
    )

    expect(screen.getByText(/short link/i)).toBeDefined()
    expect(screen.getByText(/deliver/i)).toBeDefined()
  })

  it('switches mode when mode button clicked', async () => {
    const mockModeChange = vi.fn()
    const { ScheduleBar } = await import(
      '@/app/cms/(authed)/social/new/_components/schedule-bar'
    )

    render(
      <ScheduleBar
        mode="now"
        onModeChange={mockModeChange}
        scheduledAt=""
        onScheduleChange={mockOnScheduleChange}
        onPublish={mockOnPublish}
        onSaveDraft={mockOnSaveDraft}
        isPending={false}
        siteId="s1"
        showPipeline={false}
      />,
    )

    fireEvent.click(screen.getByText('Fila'))
    expect(mockModeChange).toHaveBeenCalledWith('queue')
  })
})
