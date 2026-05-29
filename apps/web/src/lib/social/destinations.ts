import type { Provider } from '@tn-figueiredo/social'

export type DestId = 'ig_story' | 'yt_community' | 'fb_page' | 'ig_feed'

export interface Destination {
  id: DestId
  provider: Provider
  surface: string
  label: string
  sublabel: string
  ratio: string
  width: number
  height: number
  captionLimit: number
  tint: string
  tintSubtle: string
  badge: 'default' | 'rare' | null
  truth: string
}

export const DESTINATIONS: Record<DestId, Destination> = {
  ig_story: {
    id: 'ig_story',
    provider: 'instagram',
    surface: 'Story',
    label: 'Instagram',
    sublabel: 'Story',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    captionLimit: 0,
    tint: '#E8823C',
    tintSubtle: 'rgba(232,130,60,.15)',
    badge: 'default',
    truth: 'Texto e link moram na arte, nao na legenda.',
  },
  yt_community: {
    id: 'yt_community',
    provider: 'youtube',
    surface: 'Comunidade',
    label: 'YouTube',
    sublabel: 'Comunidade',
    ratio: '1:1',
    width: 1080,
    height: 1080,
    captionLimit: 1500,
    tint: '#E0574E',
    tintSubtle: 'rgba(224,87,78,.15)',
    badge: null,
    truth: 'Sem API de publicacao. Post preparado para copy-paste no YouTube Studio.',
  },
  fb_page: {
    id: 'fb_page',
    provider: 'facebook',
    surface: 'Fanpage',
    label: 'Facebook',
    sublabel: 'Fanpage',
    ratio: '4:5',
    width: 1080,
    height: 1350,
    captionLimit: 2200,
    tint: '#5B7FD6',
    tintSubtle: 'rgba(91,127,214,.15)',
    badge: null,
    truth: 'Imagem ou video com texto. Link gera card preview automatico.',
  },
  ig_feed: {
    id: 'ig_feed',
    provider: 'instagram',
    surface: 'Feed',
    label: 'Instagram',
    sublabel: 'Feed',
    ratio: '4:5',
    width: 1080,
    height: 1350,
    captionLimit: 2200,
    tint: '#C964A8',
    tintSubtle: 'rgba(201,100,168,.15)',
    badge: 'rare',
    truth: 'Usado apenas para lancamentos. Story e o padrao da casa.',
  },
}

export const DEST_IDS: DestId[] = ['ig_story', 'yt_community', 'fb_page', 'ig_feed'] as const

export function getDestination(id: DestId): Destination {
  return DESTINATIONS[id]
}

export function getDestinationsForProvider(provider: Provider): Destination[] {
  return DEST_IDS.map(id => DESTINATIONS[id]).filter(d => d.provider === provider)
}

export function destIdToProvider(id: DestId): Provider {
  return DESTINATIONS[id].provider
}
