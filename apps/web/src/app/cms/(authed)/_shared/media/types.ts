export interface CropPresetAvatar { name: 'avatar'; aspect: 1; maxWidth: 400; maxHeight: 400; circular: true }
export interface CropPresetBlogCover { name: 'blog-cover'; aspect: number; maxWidth: 1200; maxHeight: 675; circular: false }
export interface CropPresetOgImage { name: 'og-image'; aspect: number; maxWidth: 1200; maxHeight: 630; circular: false }
export interface CropPresetNewsletterHeader { name: 'newsletter-header'; aspect: undefined; maxWidth: 600; maxHeight: undefined; circular: false }
export interface CropPresetSiteLogo { name: 'site-logo'; aspect: undefined; maxWidth: 512; maxHeight: 512; circular: false }
export interface CropPresetFree { name: 'free'; aspect: undefined; maxWidth: 2048; maxHeight: 2048; circular: false }

export type CropPreset =
  | CropPresetAvatar
  | CropPresetBlogCover
  | CropPresetOgImage
  | CropPresetNewsletterHeader
  | CropPresetSiteLogo
  | CropPresetFree

export type CropPresetName = CropPreset['name']

export const CROP_PRESETS: Record<CropPresetName, CropPreset> = {
  avatar: { name: 'avatar', aspect: 1, maxWidth: 400, maxHeight: 400, circular: true },
  'blog-cover': { name: 'blog-cover', aspect: 16 / 9, maxWidth: 1200, maxHeight: 675, circular: false },
  'og-image': { name: 'og-image', aspect: 1200 / 630, maxWidth: 1200, maxHeight: 630, circular: false },
  'newsletter-header': { name: 'newsletter-header', aspect: undefined, maxWidth: 600, maxHeight: undefined, circular: false },
  'site-logo': { name: 'site-logo', aspect: undefined, maxWidth: 512, maxHeight: 512, circular: false },
  free: { name: 'free', aspect: undefined, maxWidth: 2048, maxHeight: 2048, circular: false },
}

export interface MediaAssetResult {
  id: string
  url: string
  alt: string
  width: number
  height: number
  mimeType: string
}

export interface MediaGalleryModalProps {
  open: boolean
  onClose: () => void
  onSelect: (asset: MediaAssetResult) => void
  folder?: string
  cropPreset?: CropPreset
  multiple?: boolean
  locale: 'en' | 'pt-BR'
  siteId: string
}
