import type { ConnectionHealth } from '@/lib/social/actions'
import type { FeedItem } from './feed-grid'

/* ------------------------------------------------------------------ */
/*  Queue mock data                                                    */
/* ------------------------------------------------------------------ */

export const MOCK_QUEUE_ITEMS = [
  {
    id: 'q1', title: 'Story do vídeo do MBK 🇹🇭', queuePosition: 0,
    scheduledAt: new Date(Date.now() + 3 * 3600000).toISOString(), status: 'scheduled',
    provider: 'instagram', surface: 'Story', destLabel: 'Instagram Story',
  },
  {
    id: 'q2', title: 'Enquete: próximo destino?', queuePosition: 1,
    scheduledAt: new Date(Date.now() + 24 * 3600000).toISOString(), status: 'scheduled',
    provider: 'youtube', surface: 'Comunidade', destLabel: 'YouTube Comunidade',
  },
  {
    id: 'q3', title: 'Resumo da semana no blog', queuePosition: 2,
    scheduledAt: new Date(Date.now() + 48 * 3600000).toISOString(), status: 'scheduled',
    provider: 'facebook', surface: 'Fanpage', destLabel: 'Facebook Fanpage',
  },
]

/* ------------------------------------------------------------------ */
/*  Drafts mock data                                                   */
/* ------------------------------------------------------------------ */

export const MOCK_DRAFT_ITEMS = [
  {
    id: 'd1', title: 'Newsletter #043 → Story automático',
    description: 'Gerado a partir da edição #043 do Thiago\'s Journal',
    confidence: 0.92, trigger: 'newsletter_sent', createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'd2', title: 'Vídeo MBK Center → Comunidade',
    description: 'Post automático para YouTube Community baseado no vídeo publicado',
    confidence: 0.78, trigger: 'video_published', createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 'd3', title: 'Blog post → Fanpage',
    description: 'Aprendi inglês brigando online — compartilhar no Facebook',
    confidence: 0.55, trigger: 'blog_published', createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
]

/* ------------------------------------------------------------------ */
/*  Calendar mock data                                                 */
/* ------------------------------------------------------------------ */

const TINT_IG = 'rgb(232,130,60)'
const TINT_YT = 'rgb(224,87,78)'
const TINT_FB = 'rgb(91,127,214)'

function mockCalendarDays() {
  const now = new Date()
  const dayOfWeek = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek + 1)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const dateRange = `${monday.getDate()} ${monday.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} – ${sunday.getDate()} ${sunday.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}`

  const weekNum = getISOWeekMock(monday)
  const weekLabel = `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
  const prevWeek = `${monday.getFullYear()}-W${String(Math.max(1, weekNum - 1)).padStart(2, '0')}`
  const nextWeek = `${monday.getFullYear()}-W${String(weekNum + 1).padStart(2, '0')}`

  const todayStr = now.toLocaleDateString('sv')

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    return {
      dateStr,
      dayName: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
      dayNum: d.getDate(),
      isToday: dateStr === todayStr,
      events: [] as Array<{
        postId: string
        title: string
        time: string
        tint: string
        status: string
        provider: string
      }>,
    }
  })

  // Seed events on specific days
  days[0].events.push(
    { postId: 'cal-1', title: 'Edicao 043 no ar', time: '09:00', tint: TINT_IG, status: 'completed', provider: 'instagram' },
  )
  days[1].events.push(
    { postId: 'cal-2', title: 'MBK Center — ouro na Tailandia', time: '14:30', tint: TINT_YT, status: 'scheduled', provider: 'youtube' },
    { postId: 'cal-3', title: 'Como abrir conta bancaria no exterior', time: '18:00', tint: TINT_FB, status: 'scheduled', provider: 'facebook' },
  )
  days[2].events.push(
    { postId: 'cal-4', title: 'Story: bastidores do video', time: '11:00', tint: TINT_IG, status: 'scheduled', provider: 'instagram' },
  )
  days[4].events.push(
    { postId: 'cal-5', title: 'Enquete: proximo destino?', time: '10:00', tint: TINT_YT, status: 'scheduled', provider: 'youtube' },
    { postId: 'cal-6', title: 'Carrossel: 5 dicas de Bangkok', time: '15:00', tint: TINT_IG, status: 'scheduled', provider: 'instagram' },
  )
  days[5].events.push(
    { postId: 'cal-7', title: 'Resumo semanal', time: '20:00', tint: TINT_FB, status: 'scheduled', provider: 'facebook' },
  )
  // days[3] and days[6] left empty for "slot livre"

  return { days, weekLabel, prevWeek, nextWeek, dateRange }
}

function getISOWeekMock(date: Date): number {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const yearStart = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export const MOCK_CALENDAR = mockCalendarDays()

export const MOCK_CONNECTIONS: ConnectionHealth[] = [
  {
    connectionId: 'mock-ig',
    provider: 'instagram',
    accountName: '@thiago.figueiredo',
    status: 'ok',
    followersCount: 8420,
    tokenExpiresIn: 45,
  },
  {
    connectionId: 'mock-yt',
    provider: 'youtube',
    accountName: 'Comunidade ativa',
    status: 'ok',
    followersCount: 1160,
    tokenExpiresIn: null,
  },
  {
    connectionId: 'mock-fb',
    provider: 'facebook',
    accountName: 'Thiago Figueiredo',
    status: 'warn',
    followersCount: null,
    tokenExpiresIn: 6,
  },
]

export const MOCK_FEED_ITEMS: FeedItem[] = [
  {
    id: 'mock-1',
    status: 'completed',
    title: 'Edicao 042 no ar',
    imageUrl: null,
    scheduledAt: null,
    publishedAt: '2026-05-22T14:26:00Z',
    destId: 'ig_story',
    destLabel: 'Story',
    provider: 'instagram',
    statusLabel: 'No ar',
    source: "Thiago's Journal · #042",
    sourceType: 'newsletter',
    lang: 'PT',
    metrics: { views: 1204, comments: 18 },
  },
  {
    id: 'mock-2',
    status: 'completed',
    title: 'Video novo no ar — Fui ao MBK Center comparar o preco do ouro — o resultado...',
    imageUrl: null,
    scheduledAt: null,
    publishedAt: '2026-05-19T20:26:00Z',
    destId: 'yt_community',
    destLabel: 'Comunidade',
    provider: 'youtube',
    statusLabel: 'No ar',
    source: 'MBK Center · Ouro',
    sourceType: 'video',
    lang: 'PT',
    metrics: { likes: 142 },
  },
  {
    id: 'mock-3',
    status: 'completed',
    title: 'Qual conteudo voce quer ver primeiro essa semana?',
    imageUrl: null,
    scheduledAt: null,
    publishedAt: '2026-05-19T19:47:00Z',
    destId: 'yt_community',
    destLabel: 'Comunidade',
    provider: 'youtube',
    statusLabel: 'No ar',
    lang: 'PT',
    metrics: { likes: 64, engagement: 312 },
  },
  {
    id: 'mock-4',
    status: 'completed',
    title: 'Em 2009 eu xingava em ingles quebrado. Em 2017 tirei 91 no TOEFL sem nenhuma...',
    imageUrl: null,
    scheduledAt: null,
    publishedAt: '2026-05-19T19:37:00Z',
    destId: 'fb_page',
    destLabel: 'Fanpage',
    provider: 'facebook',
    statusLabel: 'No ar',
    source: 'I Learned a Language by Arguing...',
    sourceType: 'blog',
    lang: 'PT',
  },
  {
    id: 'mock-5',
    status: 'completed',
    title: 'Story preview',
    imageUrl: null,
    scheduledAt: null,
    publishedAt: '2026-05-19T19:24:00Z',
    destId: 'ig_story',
    destLabel: 'Story',
    provider: 'instagram',
    statusLabel: 'No ar',
    lang: 'PT',
  },
  {
    id: 'mock-6',
    status: 'scheduled',
    title: 'New on the blog',
    imageUrl: null,
    scheduledAt: '2026-05-20T09:05:00Z',
    publishedAt: null,
    destId: 'ig_story',
    destLabel: 'Story',
    provider: 'instagram',
    statusLabel: 'Agendado',
    source: 'I Learned a Language by Arguing...',
    sourceType: 'blog',
    lang: 'EN',
  },
]
