import type { MediaGalleryStrings } from './types'

export const ptBR: MediaGalleryStrings = {
  modal: { title: 'Galeria de Mídia', close: 'Fechar' },
  tabs: { upload: 'Upload', library: 'Biblioteca' },
  upload: {
    dragPrompt: 'Arraste uma imagem aqui ou clique para escolher',
    dropHere: 'Solte o arquivo aqui',
    selectFile: 'Selecionar arquivo',
    altLabel: 'Texto alternativo',
    altPlaceholder: 'Descreva a imagem para leitores de tela',
    altRequired: 'Texto alternativo é obrigatório',
    folderLabel: 'Pasta',
    tagsLabel: 'Tags',
    tagsPlaceholder: 'Adicionar tag…',
    uploadButton: 'Enviar e Selecionar',
    uploading: 'Enviando…',
    uploadSuccess: 'Upload concluído',
    uploadError: 'Falha no upload',
    duplicateNotice: 'Esta imagem já existe — reutilizando.',
  },
  library: {
    searchPlaceholder: 'Buscar por nome ou tag…',
    folderAll: 'Todas', folderAuthors: 'Autores', folderBlog: 'Blog', folderPipeline: 'Pipeline',
    folderNewsletters: 'Newsletters', folderBranding: 'Marca', folderOg: 'Imagens OG',
    folderAds: 'Anúncios', folderLinks: 'Links', folderGeneral: 'Geral',
    loadMore: 'Carregar mais',
    noResults: 'Nenhuma imagem encontrada.',
    emptyLibrary: 'Nenhuma imagem enviada ainda.',
  },
  crop: { cropTitle: 'Recortar imagem', cropConfirm: 'Aplicar recorte', cropCancel: 'Cancelar' },
  delete: {
    confirmTitle: 'Excluir imagem?',
    confirmMessage: 'A imagem será marcada para exclusão.',
    usageWarning: 'Esta imagem é usada em {count} lugares. Excluí-la pode quebrar conteúdo.',
  },
  dimensions: { tooSmall: 'Imagem muito pequena para este contexto' },
}
