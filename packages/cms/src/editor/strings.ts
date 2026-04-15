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
  campaign_editor_title: string
  campaign_editor_meta_section: string
  campaign_editor_translations_section: string
  campaign_editor_slug: string
  campaign_editor_interest: string
  campaign_editor_status: string
  campaign_editor_status_draft: string
  campaign_editor_status_scheduled: string
  campaign_editor_status_published: string
  campaign_editor_status_archived: string
  campaign_editor_scheduled_for: string
  campaign_editor_brevo_list_id: string
  campaign_editor_brevo_template_id: string
  campaign_editor_pdf_path: string
  campaign_editor_main_hook: string
  campaign_editor_supporting_argument: string
  campaign_editor_introductory_block: string
  campaign_editor_body_content: string
  campaign_editor_form_intro: string
  campaign_editor_form_button_label: string
  campaign_editor_context_tag: string
  campaign_editor_locale_tabs_label: string
  campaign_editor_save_error: string
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
  campaign_editor_title: 'Editor de campanha',
  campaign_editor_meta_section: 'Metadados',
  campaign_editor_translations_section: 'Traduções',
  campaign_editor_slug: 'Slug',
  campaign_editor_interest: 'Interesse',
  campaign_editor_status: 'Status',
  campaign_editor_status_draft: 'Rascunho',
  campaign_editor_status_scheduled: 'Agendada',
  campaign_editor_status_published: 'Publicada',
  campaign_editor_status_archived: 'Arquivada',
  campaign_editor_scheduled_for: 'Agendada para',
  campaign_editor_brevo_list_id: 'Brevo list ID',
  campaign_editor_brevo_template_id: 'Brevo template ID',
  campaign_editor_pdf_path: 'Caminho do PDF (storage)',
  campaign_editor_main_hook: 'Hook principal',
  campaign_editor_supporting_argument: 'Argumento de apoio',
  campaign_editor_introductory_block: 'Bloco introdutório',
  campaign_editor_body_content: 'Conteúdo principal',
  campaign_editor_form_intro: 'Introdução do formulário',
  campaign_editor_form_button_label: 'Rótulo do botão',
  campaign_editor_context_tag: 'Tag de contexto',
  campaign_editor_locale_tabs_label: 'Idiomas',
  campaign_editor_save_error: 'Erro ao salvar campanha',
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
  campaign_editor_title: 'Campaign editor',
  campaign_editor_meta_section: 'Metadata',
  campaign_editor_translations_section: 'Translations',
  campaign_editor_slug: 'Slug',
  campaign_editor_interest: 'Interest',
  campaign_editor_status: 'Status',
  campaign_editor_status_draft: 'Draft',
  campaign_editor_status_scheduled: 'Scheduled',
  campaign_editor_status_published: 'Published',
  campaign_editor_status_archived: 'Archived',
  campaign_editor_scheduled_for: 'Scheduled for',
  campaign_editor_brevo_list_id: 'Brevo list ID',
  campaign_editor_brevo_template_id: 'Brevo template ID',
  campaign_editor_pdf_path: 'PDF storage path',
  campaign_editor_main_hook: 'Main hook',
  campaign_editor_supporting_argument: 'Supporting argument',
  campaign_editor_introductory_block: 'Introductory block',
  campaign_editor_body_content: 'Body content',
  campaign_editor_form_intro: 'Form intro',
  campaign_editor_form_button_label: 'Form button label',
  campaign_editor_context_tag: 'Context tag',
  campaign_editor_locale_tabs_label: 'Locales',
  campaign_editor_save_error: 'Failed to save campaign',
}

export const EDITOR_STRINGS: Record<string, EditorStrings> = {
  'pt-BR': ptBR,
  en,
}

export function getEditorStrings(locale: string): EditorStrings {
  return EDITOR_STRINGS[locale] ?? ptBR
}
