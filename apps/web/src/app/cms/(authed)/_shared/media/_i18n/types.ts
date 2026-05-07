export interface MediaGalleryStrings {
  modal: { title: string; close: string }
  tabs: { upload: string; library: string }
  upload: {
    dragPrompt: string; dropHere: string; selectFile: string
    altLabel: string; altPlaceholder: string; altRequired: string
    folderLabel: string; tagsLabel: string; tagsPlaceholder: string
    uploadButton: string; uploading: string; uploadSuccess: string
    uploadError: string; duplicateNotice: string
  }
  library: {
    searchPlaceholder: string
    folderAll: string; folderAuthors: string; folderBlog: string
    folderNewsletters: string; folderBranding: string; folderOg: string
    folderAds: string; folderGeneral: string
    loadMore: string; noResults: string; emptyLibrary: string
  }
  crop: { cropTitle: string; cropConfirm: string; cropCancel: string }
  delete: { confirmTitle: string; confirmMessage: string; usageWarning: string }
  dimensions: { tooSmall: string }
}

import { en } from './en'
import { ptBR } from './pt-BR'

export function getMediaGalleryStrings(locale: 'en' | 'pt-BR'): MediaGalleryStrings {
  return locale === 'pt-BR' ? ptBR : en
}
