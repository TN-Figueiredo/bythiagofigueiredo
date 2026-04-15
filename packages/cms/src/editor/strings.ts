export interface EditorStrings {
  titleLabel: string
  slugLabel: string
  excerptLabel: string
  saveButton: string
  savingButton: string
  validationFailed: (fields: string[]) => string
  previewCompiling: string
  previewIdle: string
  previewOk: string
  previewReadingTime: (min: number) => string
  previewHeadings: (count: number) => string
  previewBytes: (bytes: number) => string
  assetPickerButton: string
  assetPickerUploading: string
  seoSectionLabel: string
  seoTitleLabel: string
  seoDescriptionLabel: string
  ogImageUrlLabel: string
  coverImageLabel: string
  coverImagePick: string
  coverImageClear: string
  autosaveRestoreBanner: string
  autosaveRestore: string
  autosaveDiscard: string
  toolbarPlaceholders: {
    text: string
    h1: string
    h2: string
    code: string
    linkText: string
    imageAlt: string
  }
}

export const ptBR: EditorStrings = {
  titleLabel: 'Título',
  slugLabel: 'Slug',
  excerptLabel: 'Excerpt',
  saveButton: 'Salvar',
  savingButton: 'Salvando…',
  validationFailed: (fields) => `Campos inválidos: ${fields.join(', ')}`,
  previewCompiling: 'Compilando…',
  previewIdle: 'Aguardando…',
  previewOk: '✓ MDX compila sem erros',
  previewReadingTime: (min) => `${min} min de leitura`,
  previewHeadings: (count) => `${count} headings`,
  previewBytes: (bytes) => `${bytes} bytes compilados`,
  assetPickerButton: '📎 Escolher arquivo',
  assetPickerUploading: 'Enviando…',
  seoSectionLabel: 'SEO',
  seoTitleLabel: 'SEO: título',
  seoDescriptionLabel: 'SEO: descrição',
  ogImageUrlLabel: 'Imagem Open Graph (URL)',
  coverImageLabel: 'Imagem de capa',
  coverImagePick: 'Escolher capa',
  coverImageClear: 'Remover capa',
  autosaveRestoreBanner: 'Rascunho anterior disponível',
  autosaveRestore: 'Restaurar',
  autosaveDiscard: 'Descartar',
  toolbarPlaceholders: {
    text: 'texto',
    h1: 'Título',
    h2: 'Subtítulo',
    code: 'code',
    linkText: 'texto',
    imageAlt: 'alt',
  },
}

export const en: EditorStrings = {
  titleLabel: 'Title',
  slugLabel: 'Slug',
  excerptLabel: 'Excerpt',
  saveButton: 'Save',
  savingButton: 'Saving…',
  validationFailed: (fields) => `Invalid fields: ${fields.join(', ')}`,
  previewCompiling: 'Compiling…',
  previewIdle: 'Waiting…',
  previewOk: '✓ MDX compiles without errors',
  previewReadingTime: (min) => `${min} min read`,
  previewHeadings: (count) => `${count} headings`,
  previewBytes: (bytes) => `${bytes} bytes compiled`,
  assetPickerButton: '📎 Choose file',
  assetPickerUploading: 'Uploading…',
  seoSectionLabel: 'SEO',
  seoTitleLabel: 'SEO: title',
  seoDescriptionLabel: 'SEO: description',
  ogImageUrlLabel: 'Open Graph image (URL)',
  coverImageLabel: 'Cover image',
  coverImagePick: 'Pick cover',
  coverImageClear: 'Remove cover',
  autosaveRestoreBanner: 'Previous draft available',
  autosaveRestore: 'Restore',
  autosaveDiscard: 'Discard',
  toolbarPlaceholders: {
    text: 'text',
    h1: 'Heading',
    h2: 'Subheading',
    code: 'code',
    linkText: 'text',
    imageAlt: 'alt',
  },
}

export const EDITOR_STRINGS: Record<string, EditorStrings> = {
  'pt-BR': ptBR,
  en,
}

export function getEditorStrings(locale: string): EditorStrings {
  return EDITOR_STRINGS[locale] ?? ptBR
}
