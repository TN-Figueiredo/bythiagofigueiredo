export interface MediaGalleryStrings {
  modal: { title: string; close: string }
  tabs: { upload: string; library: string }
  upload: {
    dragPrompt: string; dropHere: string; selectFile: string
    altLabel: string; altPlaceholder: string; altRequired: string
    folderLabel: string; tagsLabel: string; tagsPlaceholder: string
    uploadButton: string; uploading: string; uploadSuccess: string
    uploadError: string; duplicateNotice: string
    errorCodes?: Record<string, string>
  }
  library: {
    searchPlaceholder: string
    folderAll: string; folderAuthors: string; folderBlog: string; folderPipeline: string
    folderNewsletters: string; folderBranding: string; folderOg: string
    folderAds: string; folderLinks: string; folderGeneral: string
    loadMore: string; noResults: string; emptyLibrary: string
  }
  crop: { cropTitle: string; cropConfirm: string; cropCancel: string }
  delete: { confirmTitle: string; confirmMessage: string; usageWarning: string }
  dimensions: { tooSmall: string }
  toolbar: {
    selectAll: string; deselectAll: string
    searchHint: string; searchCount: string
    filterAll: string; filterCovers: string; filterInline: string
    filterAvatars: string; filterOg: string; filterUnused: string
    sortNewest: string; sortOldest: string; sortLargest: string; sortSmallest: string; sortName: string
    viewGrid: string; viewList: string
    columns: string
  }
  detail: {
    tabDetails: string; tabUsage: string; tabHistory: string
    filename: string; dimensions: string; fileSize: string
    ratio: string; mimeType: string; uploaded: string; uploadedBy: string
    tags: string; addTag: string; altText: string; folder: string
    copyUrl: string; replace: string; deleteAsset: string
    copied: string; noUsages: string
    orphanWarning: string; orphanAutoDelete: string
    historyUpload: string; historyExifStrip: string; historyDedupCheck: string
    usedIn: string
  }
  bulk: {
    selected: string; deselect: string
    download: string; tag: string; deleteSelected: string
  }
  lightbox: {
    counter: string; previous: string; next: string; close: string
  }
  storage: {
    label: string; used: string
    covers: string; inline: string; avatars: string; og: string; unused: string
  }
  context: {
    preview: string; download: string; copyUrl: string
    editAlt: string; moveTo: string; deleteAsset: string
  }
  empty: {
    noAssets: string; noCovers: string; noInline: string
    noAvatars: string; noOg: string; noUnused: string
    noSearchResults: string
  }
  shortcuts: {
    title: string; search: string; navigate: string; openDetail: string
    toggleSelect: string; escape: string; deleteKey: string; showShortcuts: string
    rangeSelect: string; lightboxNav: string
  }
}

import { en } from './en'
import { ptBR } from './pt-BR'

export function getMediaGalleryStrings(locale: 'en' | 'pt-BR'): MediaGalleryStrings {
  return locale === 'pt-BR' ? ptBR : en
}
