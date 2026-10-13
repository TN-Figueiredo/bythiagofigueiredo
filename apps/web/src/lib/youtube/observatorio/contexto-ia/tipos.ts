// A5 · E17 degrau 1 ("Perguntar a uma IA"), Tarefa 1: os tipos do pacote de texto. Só tipos: nada aqui roda.
// A pasta inteira é pura (sem `server-only`, sem `next/*`, sem Supabase, sem `fetch`, sem relógio); a única exceção é `registrar-acesso.ts`.

export type TelaId =
  | 'canais' | 'canal' | 'video' | 'comparar' | 'outliers' | 'insights' | 'mudancas' | 'fila' | 'canal-proprio' | 'video-proprio' | 'ritmo'

export type Celula =
  // `origem` é o caminho CONCRETO da folha no modelo, com o índice: 'pack.canais[2].numeros.medianaViews'
  | { papel: 'numero'; estado: 'medido' | 'zero_medido'; texto: string; x: number | null; origem: string }
  | { papel: 'numero'; estado: 'nao_medido'; motivo: string; origem: string }
  | { papel: 'base' | 'rotulo'; texto: string; origem: string }
  | { papel: 'terceiros'; texto: string; origem: string } // uma linha só; sai neutralizado

export interface Tabela {
  id: string
  titulo: string
  colunas: string[]
  linhas: Celula[][]
  tipo: 'fixa' | 'lista' | 'dia_a_dia'
  nomeNoCorte: string
  privada: boolean
}

export interface BlocoCitado {
  rotulo: string
  texto: string
  origem: string // várias linhas de terceiros ou da forja
  /** O bloco pertence a esta linha de lista e sai com ela no corte; ausente = bloco sem linha. */
  linha?: { tabela: string; posicao: number }
}

/** Não tem campo para nome, id de canal, foto, link nem id do comentário: a identidade não tem por onde entrar. */
export interface Comentario {
  texto: string
  curtidas: number | null
  respostas: number | null
  idade: string
  sinalizadores: string[]
  respostaDoCriador: { canal: string; texto: string } | null
}

export interface PacoteModelo {
  tela: TelaId
  janela: string
  foco: Array<{ nome: string; oQueE: 'seu canal' | 'concorrente' | 'vídeo'; detalhe: string }>
  tabelas: Tabela[]
  citados: BlocoCitado[]
  definicoes: Array<{ medida: string; frase: string; limiares: string[] }>
  avisos: string[]
  naoMede: string[]
  /** Três motivos; a frase "não tem o direito" só sai com 'sem_direito'. */
  privado:
    | { estado: 'na' }
    | { estado: 'incluido'; itens: string }
    | { estado: 'excluido'; motivo: 'sem_direito' | 'nao_conferido' | 'leitura_falhou'; itens: string }
  comentarios: { estado: 'na' } | { estado: 'incluido'; itens: Comentario[] } | { estado: 'excluido'; quantos: number }
  vazio: string | null
  motivoDoMagro: string | null
  /** Liga a linha do cabeçalho "Listas completas do período; a tela mostra em páginas.". */
  listasCompletas: boolean
}

export interface ContextoDoPacote {
  geradoEm: number
  recente: string | null
}

export type PedidoDePacote = { tela: string; id?: string; consulta: string }

/** Resultado cru de uma leitura de dado privado. */
export type AcessoCru = 'ok' | 'negado' | 'erro'

/** O que `montar…` das quatro telas com dado privado entrega ao empacotador: uma entrada por LEITURA, não por canal. */
export interface EstadoDoPrivado {
  acessoPorCanal: Record<string, { diario: AcessoCru; alcance?: AcessoCru }>
  negativa: 'sem_direito' | 'nao_foi_possivel_conferir' | null
}
