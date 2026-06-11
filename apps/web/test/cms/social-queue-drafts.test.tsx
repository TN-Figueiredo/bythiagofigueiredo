// @vitest-environment happy-dom
/**
 * NOTE: this file originally tested <PostsQueue> and <PostsDrafts>, deleted in
 * 35b6a0f7 (2026-05-30 dead-file cleanup) — the file was orphaned and failed
 * module resolution ever since. <QueueList> and <DraftsList> are the live
 * queue/drafts views; same intent: queued posts render in order with schedule
 * info, drafts render with their trigger metadata.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/cms/social/queue',
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

vi.mock('@/lib/social/actions', () => ({
  reorderQueue: vi.fn().mockResolvedValue({ ok: true }),
  deleteSocialPost: vi.fn().mockResolvedValue({ ok: true }),
}))

import { QueueList } from '@/app/cms/(authed)/social/_components/queue-list'
import { DraftsList } from '@/app/cms/(authed)/social/_components/drafts-list'

afterEach(() => cleanup())

const queueItems = [
  {
    id: 'q1', title: 'First in line', queuePosition: 0,
    scheduledAt: '2026-06-15T12:00:00Z', status: 'queued',
    provider: 'instagram', surface: 'feed', destLabel: 'Instagram',
  },
  {
    id: 'q2', title: 'Second in line', queuePosition: 1,
    scheduledAt: null, status: 'queued',
    provider: 'facebook', surface: 'page', destLabel: 'Facebook',
  },
]

describe('QueueList', () => {
  it('renders one row per queued item', () => {
    render(<QueueList initialItems={queueItems} />)
    expect(screen.getAllByRole('listitem').length).toBe(2)
  })

  it('renders titles linking to the post detail', () => {
    render(<QueueList initialItems={queueItems} />)
    expect(screen.getByText('First in line').closest('a')?.getAttribute('href')).toBe('/cms/social/q1')
    expect(screen.getByText('Second in line').closest('a')?.getAttribute('href')).toBe('/cms/social/q2')
  })

  it('renders position numbers in queue order', () => {
    render(<QueueList initialItems={queueItems} />)
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('renders a drag handle per item', () => {
    render(<QueueList initialItems={queueItems} />)
    expect(screen.getByLabelText('Arrastar First in line')).toBeDefined()
    expect(screen.getByLabelText('Arrastar Second in line')).toBeDefined()
  })

  it('renders the queue explainer copy', () => {
    render(<QueueList initialItems={queueItems} />)
    expect(screen.getByText(/A fila publica nos seus melhores horarios/)).toBeDefined()
  })
})

describe('DraftsList', () => {
  const drafts = [
    {
      id: 'd1', title: 'Cowork draft', description: 'Auto-generated from blog',
      confidence: 0.87, trigger: 'blog_published',
      createdAt: '2026-06-01T10:00:00Z', provider: 'instagram', surface: 'feed', lang: 'pt',
    },
    {
      id: 'd2', title: 'Video teaser', description: 'From the new video',
      confidence: null, trigger: 'video_published',
      createdAt: '2026-06-02T10:00:00Z',
    },
  ]

  it('renders one entry per draft with its title', () => {
    render(<DraftsList items={drafts} />)
    expect(screen.getByText('Cowork draft')).toBeDefined()
    expect(screen.getByText('Video teaser')).toBeDefined()
  })

  it('renders the confidence badge when confidence is present', () => {
    render(<DraftsList items={drafts} />)
    expect(screen.getByText(/87%/)).toBeDefined()
  })

  it('renders trigger labels', () => {
    render(<DraftsList items={drafts} />)
    expect(screen.getByText(/Blog publicado/)).toBeDefined()
    expect(screen.getByText(/Vídeo publicado/)).toBeDefined()
  })
})
