import type { MediaGalleryStrings } from './types'

export const en: MediaGalleryStrings = {
  modal: { title: 'Media Gallery', close: 'Close' },
  tabs: { upload: 'Upload', library: 'Library' },
  upload: {
    dragPrompt: 'Drag an image here or click to browse',
    dropHere: 'Drop your file here',
    selectFile: 'Select file',
    altLabel: 'Alt text',
    altPlaceholder: 'Describe this image for screen readers',
    altRequired: 'Alt text is required',
    folderLabel: 'Folder',
    tagsLabel: 'Tags',
    tagsPlaceholder: 'Add a tag…',
    uploadButton: 'Upload & Select',
    uploading: 'Uploading…',
    uploadSuccess: 'Upload complete',
    uploadError: 'Upload failed',
    duplicateNotice: 'This image already exists — reusing it.',
  },
  library: {
    searchPlaceholder: 'Search by filename or tag…',
    folderAll: 'All', folderAuthors: 'Authors', folderBlog: 'Blog',
    folderNewsletters: 'Newsletters', folderBranding: 'Branding', folderOg: 'OG Images',
    folderAds: 'Ads', folderGeneral: 'General',
    loadMore: 'Load more',
    noResults: 'No images match your search.',
    emptyLibrary: 'No images uploaded yet.',
  },
  crop: { cropTitle: 'Crop image', cropConfirm: 'Apply crop', cropCancel: 'Cancel' },
  delete: {
    confirmTitle: 'Delete image?',
    confirmMessage: 'This image will be marked for deletion.',
    usageWarning: 'This image is used in {count} places. Deleting it may break content.',
  },
  dimensions: { tooSmall: 'Image is too small for this context' },
}
