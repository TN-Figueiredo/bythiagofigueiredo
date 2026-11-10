// A5 · E17 degrau 1 ("Perguntar a uma IA"), Tarefa 1: os tipos do pacote de texto. Só tipos: nada aqui roda.
// A pasta inteira é pura (sem `server-only`, sem `next/*`, sem Supabase, sem `fetch`, sem relógio); a única exceção é `registrar-acesso.ts`.

export type TelaId =
  | 'canais' | 'canal' | 'video' | 'comparar' | 'outliers' | 'insights' | 'mudancas' | 'fila' | 'canal-proprio' | 'video-proprio' | 'ritmo' | 'sugestoes'

export type Celula =
  // A5: `x` ausente (`undefined`) só com `semXMotivo` ("sem variação" dentro do arredondamento: sem número, com o motivo); `null` = o modelo não trouxe o número.
  // `origem` é o caminho CONCRETO da folha no modelo, com o índice: 'pack.canais[2].numeros.medianaViews'
  | { papel: 'numero'; estado: 'medido' | 'zero_medido'; texto: string; x: number | null; origem: string; semXMotivo?: never }
  | { papel: 'numero'; estado: 'medido'; texto: string; x?: never; origem: string; semXMotivo: string }
  | { papel: 'numero'; estado: 'nao_medido'; motivo: string; origem: string; causa?: 'diminuiu' }
  // decisão 75: as mesmas palavras da pastilha da tela. `falhou` = a leitura ou a conferência de permissão falhou; `restrito` = acesso negado com certeza.
  | { papel: 'numero'; estado: 'falhou'; motivo: string; origem: string }
  | { papel: 'numero'; estado: 'restrito'; motivo: string; origem: string }
  | { papel: 'base' | 'rotulo'; texto: string; origem: string }
  | { papel: 'terceiros'; texto: string; origem: string } // uma linha só; sai neutralizado

export interface Tabela {
  id: string
  titulo: string
  colunas: string[]
  linhas: Celula[][]
  tipo: 'fixa' | 'lista' | 'dia_a_dia'
  /**
   * Só para `dia_a_dia` com data. `'soma'` = valor GANHO no dia (a semana é a soma dos 7 dias, só se os 7 estão medidos); `'ultima'` = total ACUMULADO no fim
   * do dia (a semana é a última leitura). Ausente = não declarado: no grão semana a célula sai "não medido" (nunca se adivinha o tipo).
   */
  semana?: 'soma' | 'ultima'
  /** A5: chave de máquina (snake_case) de cada coluna, paralela a `colunas`. Ausente = o gerador de CSV deriva ou recusa. */
  chaves?: string[]
  /** A5: gráfico sugerido. Ausente = padrão pelo tipo da tabela (D1). */
  grafico?: 'linha' | 'barra' | 'pizza' | 'nenhum'
  /** A5: só `dia_a_dia` com data; ISO `AAAA-MM-DD`, paralelo a `linhas`. */
  dias?: string[]
  /** A5: fuso do dia da série. */
  fuso?: 'sao_paulo' | 'pacifico'
  nomeNoCorte: string
  privada: boolean
}

/** A5: id da tabela `dia_a_dia` → por que a semana não soma; `<id>-cedo`: "primeiros 7 dias, sem data de calendário". Preenchido na F0.5b. */
export const SEMANA_FECHADA: Record<string, string> = {}

export interface BlocoCitado {
  rotulo: string
  texto: string
  origem: string // várias linhas de terceiros ou da forja
  /** O bloco pertence a esta linha de lista e sai com ela no corte; ausente = bloco sem linha. */
  linha?: { tabela: string; posicao: number }
  /** Dado privado do canal: só com `privado.estado === 'incluido'`; com `na` ou `excluido` o empacotador tem de tirar o bloco (`segmentar` lança). */
  privado?: boolean
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
  foco: Array<{ nome: string; oQueE: 'seu canal' | 'concorrente' | 'vídeo'; detalhe: string; privado?: boolean }>
  tabelas: Tabela[]
  citados: BlocoCitado[]
  definicoes: Array<{ medida: string; frase: string; limiares: string[]; privado?: boolean }>
  avisos: string[]
  /** Avisos que citam dado privado do canal: saem na parte 6 com a marca e só com `privado.estado === 'incluido'` (senão `segmentar` lança). */
  avisosPrivados?: string[]
  naoMede: string[]
  /** Três motivos; a frase "não tem o direito" só sai com 'sem_direito'. */
  privado:
    | { estado: 'na' }
    | { estado: 'incluido'; itens: string }
    | { estado: 'excluido'; motivo: 'sem_direito' | 'nao_conferido' | 'leitura_falhou'; itens: string }
  comentarios: { estado: 'na' } | { estado: 'nao_carregou' } | { estado: 'incluido'; itens: Comentario[] } | { estado: 'excluido'; quantos: number }
  vazio: string | null
  motivoDoMagro: string | null
  /** Liga a linha do cabeçalho "Listas completas do período; a tela mostra em páginas.". */
  listasCompletas: boolean
  /** A7d: só quando a tela pagina (mostra menos do que o recorte tem); números do modelo, nunca extraídos de frase. */
  paginado?: { mostrados: number; total: number }
  /** A7c1: o resumo do todo (contagens sobre todas as linhas, antes da janela), só no acesso pela IA; vira um segmento da parte 1 sem corte. Ausente = não sai. */
  resumoDoTodo?: string
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
