'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { usePostEditor } from '../post-editor-context'
import { SectionBar } from '../section-bar'
import { savePostCoverImage } from '../../actions'
import { useMediaGallery } from '../../../_shared/media/use-media-gallery'
import { MediaGalleryModal } from '../../../_shared/media/media-gallery-modal'
import { CROP_PRESETS, type MediaAssetResult } from '../../../_shared/media/types'
import { ImageIcon, Upload, X } from 'lucide-react'
import type { SectionStatus } from '@/lib/posts/types'

export function ImagesTab() {
  const { state } = usePostEditor()
  const { post, activeLocale } = state
  const [coverUrl, setCoverUrl] = useState(post.coverImageUrl)
  const [isSaving, setIsSaving] = useState(false)
  const coverGallery = useMediaGallery()
  const addGallery = useMediaGallery()

  const handleCoverSelect = useCallback(async (asset: MediaAssetResult) => {
    setCoverUrl(asset.url)
    setIsSaving(true)
    const result = await savePostCoverImage(post.id, asset.url)
    setIsSaving(false)
    if (!result.ok) { toast.error('Erro ao salvar capa'); setCoverUrl(post.coverImageUrl) }
    else toast.success('Capa atualizada')
  }, [post.id, post.coverImageUrl])

  const handleCoverRemove = useCallback(async () => {
    setCoverUrl(null)
    const result = await savePostCoverImage(post.id, null)
    if (!result.ok) { toast.error('Erro ao remover capa'); setCoverUrl(post.coverImageUrl) }
  }, [post.id, post.coverImageUrl])

  const sectionStatus: SectionStatus = coverUrl ? 'done' : 'empty'

  return (
    <div className="flex flex-col gap-4">
      <SectionBar label="Imagens" status={sectionStatus} statusText={coverUrl ? '1 imagem' : undefined} isDirty={false} isSaving={isSaving} onSave={() => {}} />

      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Capa do Post</h3>
        {coverUrl ? (
          <div className="relative group rounded-lg overflow-hidden" style={{ maxHeight: 280, border: '1px solid var(--gem-border)' }}>
            <img src={coverUrl} alt="Cover" className="w-full object-cover" style={{ maxHeight: 280 }} />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button type="button" onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })} className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md">Trocar</button>
              <button type="button" onClick={handleCoverRemove} className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md"><X size={14} /></button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
            className="w-full flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-12 transition-colors hover:border-[var(--gem-accent)] hover:bg-[var(--gem-accent)]/5"
            style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}
          >
            <Upload size={24} />
            <span className="text-sm">Arraste uma imagem ou clique para selecionar</span>
            <span className="text-[10px]">PNG, JPG, WebP — até 5 MB</span>
          </button>
        )}
      </div>

      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--gem-text)' }}>Galeria</h3>
        <button
          type="button"
          onClick={() => addGallery.openGallery({ folder: 'blog' })}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed py-4 transition-colors hover:border-[var(--gem-accent)] hover:bg-[var(--gem-accent)]/5"
          style={{ borderColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}
        >
          <ImageIcon size={14} />
          <span className="text-xs">Adicionar imagem à galeria</span>
        </button>
      </div>

      <MediaGalleryModal {...coverGallery.galleryProps} onSelect={handleCoverSelect} locale={activeLocale === 'pt-br' ? 'pt-BR' : 'en'} siteId={post.siteId} />
      <MediaGalleryModal {...addGallery.galleryProps} onSelect={() => {}} locale={activeLocale === 'pt-br' ? 'pt-BR' : 'en'} siteId={post.siteId} />
    </div>
  )
}
