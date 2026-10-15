// A5 · E17 degrau 1, Tarefa 10: as frases do diálogo "Perguntar a uma IA", copiadas de `NOTAS.md` (seção 2) e de `pi.js` do mockup 22
// (`docs/superpowers/mockups/2026-10-13-a5-lote-2/22-perguntar-a-uma-ia/`). Nenhuma conta aqui: o que tem número recebe o número já pronto.
// Módulo puro (sem 'use client'): o teste de frases o lê.
import { milhar } from '@/lib/youtube/observatorio/contexto-ia/frases'

export { milhar }

const plural = (n: number, um: string, varios: string): string => `${milhar(n)} ${n === 1 ? um : varios}`

export const BOTAO = 'Perguntar a uma IA'
export const TITULO = 'Perguntar a uma IA'
export const FECHAR = 'Fechar'

export const NADA_PRIVADO = 'nada privado'
export const PRIVADO_INCLUIDO = 'inclui dado privado do canal'
export const PRIVADO_EXCLUIDO = 'sem o dado privado do canal'
export const NENHUM_NUMERO_AINDA = 'nenhum número ainda'

export const tabelas = (n: number): string => plural(n, 'tabela', 'tabelas')
export const fraseResumoCaracteres = (copia: number, total: number, cabe: boolean): string =>
  cabe ? `${milhar(total)} caracteres` : `${milhar(copia)} caracteres (cortado de ${milhar(total)})`
export const soMedidos = (medidos: number, total: number): string => `só ${milhar(medidos)} de ${milhar(total)} números medidos`
export const fraseErro = (nome: string): string => `Pacote da tela ${nome}: não foi montado`
export const fraseCarregando = (nome: string): string => `Montando o pacote da tela ${nome}…`

// bloco 1
export const TAMANHO = 'Tamanho'
export const caracteresDeLimite = (copia: number, limite: number): string => `${milhar(copia)} de ${milhar(limite)} caracteres`
export const CABE_INTEIRO = 'cabe inteiro'
export const CORTADO_POR_TAMANHO = 'cortado por tamanho'
export const legendaNoPacote = (n: number): string => `${milhar(n)} no pacote`
export const legendaLimite = (limite: number): string => `limite da cópia: ${milhar(limite)}`
export const legendaVaoNaCopia = (n: number): string => `${milhar(n)} vão na cópia`
export const legendaSoNoArquivo = (n: number): string => `${milhar(n)} só no arquivo completo`
export const legendaNaoSaem = (n: number): string => `${milhar(n)} não saem`
export const barraCabe = (total: number, limite: number): string => `${milhar(total)} de ${milhar(limite)} caracteres: cabe inteiro`
export const barraCortou = (copia: number, soArquivo: number, naoSaem: number): string =>
  `a cópia leva ${milhar(copia)} caracteres` + (soArquivo ? `; mais ${milhar(soArquivo)} só no arquivo completo` : '') + (naoSaem ? `; ${milhar(naoSaem)} não saem de jeito nenhum` : '')

// bloco 2
export const NUMEROS_NO_PACOTE = 'Os números no pacote'
export const medidos = (n: number): string => `${milhar(n)} medidos`
export const zeros = (n: number): string => `${milhar(n)} ${n === 1 ? 'zero medido' : 'zeros medidos'}`
export const naoMedidos = (n: number): string => `${milhar(n)} ${n === 1 ? 'não medido' : 'não medidos'}`
export const reguaAria = (m: number, z: number, n: number): string =>
  `${m} ${m === 1 ? 'número medido' : 'números medidos'}, ${z} ${z === 1 ? 'zero medido' : 'zeros medidos'}, ${n} ${n === 1 ? 'não medido' : 'não medidos'}`
export const REGUA_VAZIA_ARIA = 'nenhum número no pacote'

// bloco 3
export const O_QUE_FICOU_DE_FORA = 'O que ficou de fora'
export const POR_TAMANHO = 'Por tamanho'
export const POR_TAMANHO_NADA = 'nada'
export const POR_TAMANHO_CORTADO = 'cortado'
export const CORTES_ARIA = 'O que saiu, em caracteres, na ordem do corte'
export const DADO_PRIVADO = 'Dado privado do canal'
export const TEXTO_DE_COMENTARIOS = 'Texto de comentários'
export const CHAVES = 'Chaves, senhas e links de acesso'
export const ESTA_TELA_NAO_TEM = 'esta tela não tem'
export const INCLUIDO = 'incluído'
export const SEM_O_DIREITO = 'sem o direito'
// texto novo (pergunta 8 do plano): os outros dois motivos de o privado não ter entrado
export const NAO_FOI_POSSIVEL_CONFERIR = 'não foi possível conferir agora'
export const A_LEITURA_FALHOU = 'a leitura falhou agora'
export const NUNCA_ENTRAM = 'nunca entram'
export const deFora = (itens: string): string => `de fora: ${itens}`
export const comentariosIncluidos = (n: number): string => `${milhar(n)} comentários, sem nome`
export const comentariosDeFora = (n: number): string => `${milhar(n)} comentários de fora`

// prévia
export const PREVIA_ARIA = 'Prévia do texto que será copiado'
export const previaMeta = (n: number): string => `Markdown · início e fim do texto · ${milhar(n)} caracteres`
export const dobra = (n: number, descricao: string): string => `${milhar(n)} caracteres no meio: ${descricao}`
export const DOBRA_1 = 'resto da seção 4, 5. Definições e método e 6. Avisos'
export const DOBRA_2 = 'o resto dos números, em estrutura'
export const VAO_NA_COPIA = 'vão na cópia'
export const dobraAria = (n: number): string => `trecho do meio, ${milhar(n)} caracteres, que vai na cópia, mas não aparece aqui`

// pergunta
export const MINHA_PERGUNTA = 'Minha pergunta'
export const OPCIONAL = '(opcional)'
export const DICA_DA_PERGUNTA = 'Escreva o que você quer saber. Ela entra no fim do texto.'
export const contador = (n: number, max: number): string => `${milhar(n)} de ${milhar(max)} caracteres`
export const EXEMPLOS = 'Exemplos:'

// rodapé
export const AVISO_FIXO = 'Este texto sai do site: ao colar numa IA, ele passa a estar num serviço de terceiros.'
export const COPIAR_TEXTO = 'Copiar texto'
export const BAIXAR_MD = 'Baixar .md'
export const baixarCompleto = (n: number): string => `Baixar completo (${milhar(n)})`
export const COPIAR_DE_NOVO = 'Copiar de novo'
export const SELECIONAR_PREVIA = 'Selecionar o texto da prévia'
export const TENTAR_COPIAR_DE_NOVO = 'Tentar copiar de novo'
export const TENTAR_DE_NOVO = 'Tentar de novo'
export const COPIADO_NEGRITO = 'Copiado:'
export const copiadoResto = (n: number): string => ` ${milhar(n)} caracteres estão na área de transferência. Cole na IA que você usa.`
export const FALHOU_NEGRITO = 'Não deu para copiar.'
export const FALHOU_RESTO = ' O navegador não deixou usar a área de transferência. Baixe o arquivo, ou selecione o texto da prévia e copie com Ctrl+C.'
export const ERRO_TITULO = 'Não foi possível montar o pacote'
export const ERRO_CORPO = 'O servidor não respondeu a tempo. Sua pergunta foi mantida. Tente de novo; se continuar, abra a tela outra vez.'

// os três ⓘ
export const INFO_METODO = {
  titulo: 'Como o pacote é montado',
  itens: [
    ['Os números são os da tela:', ' cálculo do Observatório sobre dados públicos do YouTube. O pacote não calcula nada novo e leva a base e a janela de cada número.'],
    ['É montado para quem pede:', ' sem o direito “ver desempenho privado”, os números privados e o texto dos comentários não entram, e o texto diz que ficou de fora.'],
    ['Nunca entram', ' chaves, senhas nem links que deem acesso ao site. Os links que houver são os públicos do YouTube.'],
    ['Comentários', ' entram sem o nome de quem escreveu, cada um marcado como texto de terceiros.'],
  ],
} as const
export const INFO_TAMANHO = {
  titulo: 'Como o tamanho é medido e cortado',
  itens: [
    ['Limite da cópia:', ' 30.000 caracteres, o que cabe numa mensagem de qualquer IA.'],
    ['Se passar:', ' o corte começa pelo que menos pesa na leitura: primeiro os números dia a dia de cada canal, depois as linhas além das primeiras de cada lista. Definições e avisos nunca saem.'],
    ['O que foi cortado', ' está escrito na seção 7 do texto e aqui, em “O que ficou de fora”.'],
    ['Baixar completo', ' gera o arquivo .md sem o corte, até 200.000 caracteres.'],
  ],
} as const
export const INFO_NUMEROS = {
  titulo: 'O que quer dizer medido, zero medido e não medido',
  itens: [
    ['Medido:', ' o número chegou e vale para a base escrita ao lado.'],
    ['Zero medido:', ' o dado chegou e o valor é 0. É um resultado.'],
    ['Não medido:', ' o dado não chegou ou a conta pede mais vídeos do que há. O texto diz o motivo e a IA é avisada de que não é zero.'],
    ['Quase tudo não medido, ou tela vazia:', ' a primeira linha do texto avisa a IA, em vez de uma tabela de traços.'],
  ],
} as const

/** Frases que o mockup NÃO tem (texto novo, a revisar por Logan e Naksu). O teste de frases não as procura no mockup. */
export const FRASES_NOVAS: readonly string[] = [NAO_FOI_POSSIVEL_CONFERIR, A_LEITURA_FALHOU]

/** Fragmentos fixos que o teste procura em `pi.js` ou `NOTAS.md` da pasta versionada. */
export const FRASES_DO_MOCKUP: readonly string[] = [
  BOTAO, TITULO, FECHAR, NADA_PRIVADO, PRIVADO_INCLUIDO, PRIVADO_EXCLUIDO, NENHUM_NUMERO_AINDA, CABE_INTEIRO, CORTADO_POR_TAMANHO,
  TAMANHO, NUMEROS_NO_PACOTE, O_QUE_FICOU_DE_FORA, POR_TAMANHO, 'cortado', DADO_PRIVADO, TEXTO_DE_COMENTARIOS, CHAVES, ESTA_TELA_NAO_TEM, INCLUIDO,
  SEM_O_DIREITO, NUNCA_ENTRAM, CORTES_ARIA, PREVIA_ARIA, MINHA_PERGUNTA, OPCIONAL, DICA_DA_PERGUNTA, EXEMPLOS, AVISO_FIXO, COPIAR_TEXTO, BAIXAR_MD,
  COPIAR_DE_NOVO, SELECIONAR_PREVIA, TENTAR_COPIAR_DE_NOVO, TENTAR_DE_NOVO, COPIADO_NEGRITO, FALHOU_NEGRITO, FALHOU_RESTO.trim(), ERRO_TITULO, ERRO_CORPO,
  DOBRA_1, DOBRA_2, VAO_NA_COPIA, 'Markdown · início e fim do texto', 'limite da cópia', 'vão na cópia', 'só no arquivo completo', 'não saem', 'no pacote',
  'cortado de', 'números medidos', 'de fora: ', 'comentários, sem nome', 'comentários de fora', 'Montando o pacote da tela', 'não foi montado',
  'estão na área de transferência. Cole na IA que você usa.', 'Baixar completo',
  ...[INFO_METODO, INFO_TAMANHO, INFO_NUMEROS].flatMap((i) => [i.titulo, ...i.itens.flatMap(([a, b]) => [a, b.trim()])]),
]
