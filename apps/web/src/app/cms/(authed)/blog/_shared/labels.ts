/**
 * CMS blog editor labels — extractable for future i18n.
 * Default locale: pt-BR (matching current CMS behavior).
 */

export type CmsEditorLabels = {
  readonly hashtags: string
  readonly searchHashtags: string
  readonly createNew: (name: string) => string
  readonly hashtagPlaceholder: string
  readonly previousPost: string
  readonly searchByTitle: string
  readonly searchPreviousPost: string
  readonly continuesInNext: string
  readonly addEmpty: string
  readonly addItem: string
  readonly keyPoints: string
  readonly pullQuote: string
  readonly pullQuotePlaceholder: string
  readonly notes: string
  readonly colophon: string
  readonly colophonHint: string
  readonly characters: string
}

const ptBR: CmsEditorLabels = {
  hashtags: 'Marcadores',
  searchHashtags: 'Buscar marcadores',
  createNew: (name: string) => `+ Criar "#${name}"`,
  hashtagPlaceholder: '#tag',
  previousPost: 'Post anterior',
  searchByTitle: 'Buscar por título...',
  searchPreviousPost: 'Buscar post anterior',
  continuesInNext: 'Continua na próxima parte',
  addEmpty: '+ Adicionar',
  addItem: '+ Adicionar item',
  keyPoints: 'Pontos-chave',
  pullQuote: 'Citação',
  pullQuotePlaceholder: 'Uma frase marcante do post...',
  notes: 'Notas',
  colophon: 'Colofão',
  colophonHint: 'ferramentas, processo, créditos',
  characters: 'caracteres',
}

const en: CmsEditorLabels = {
  hashtags: 'Tags',
  searchHashtags: 'Search tags',
  createNew: (name: string) => `+ Create "#${name}"`,
  hashtagPlaceholder: '#tag',
  previousPost: 'Previous post',
  searchByTitle: 'Search by title...',
  searchPreviousPost: 'Search previous post',
  continuesInNext: 'Continues in next part',
  addEmpty: '+ Add',
  addItem: '+ Add item',
  keyPoints: 'Key points',
  pullQuote: 'Pull quote',
  pullQuotePlaceholder: 'A memorable quote from the post...',
  notes: 'Notes',
  colophon: 'Colophon',
  colophonHint: 'tools, process, credits',
  characters: 'characters',
}

const locales: Record<string, CmsEditorLabels> = {
  'pt-BR': ptBR,
  en,
}

export function getCmsEditorLabels(locale?: string): CmsEditorLabels {
  return locales[locale ?? 'pt-BR'] ?? ptBR
}
