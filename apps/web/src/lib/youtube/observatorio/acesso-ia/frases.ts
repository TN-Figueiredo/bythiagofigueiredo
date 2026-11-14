// A5 · E17 degrau 2: as frases fechadas do acesso externo da IA (plano, seção 6), cada uma com o status HTTP quando é da porta.
// Frase de recusa nunca leva dado: nem chave, nem hash, nem id de pessoa, nem texto do que foi pedido.

export interface FraseHttp { status: 401 | 403 | 503; frase: string }

/** As recusas da porta. A de chave vencida tem a data e vem de `fraseDeVencida` (lib/pipeline/chave.ts), com status 401. */
export const FRASES = {
  desligado: { status: 503, frase: 'acesso externo desligado' },
  misto: { status: 403, frase: 'chave de perfil misto: recusada' },
  sem_pessoa: { status: 401, frase: 'chave sem pessoa: peça outra ao dono' },
  sem_validade: { status: 401, frase: 'chave sem validade: peça outra ao dono' },
  sem_acesso: { status: 403, frase: 'sem acesso ao site' },
  nao_conferido: { status: 503, frase: 'não foi possível conferir o acesso agora: tente de novo em instantes' },
} as const satisfies Record<string, FraseHttp>

/** As respostas de erro da ferramenta (sem status HTTP: vão no corpo do resultado MCP). Nenhuma leva dado. */
export const FRASES_DA_FERRAMENTA = {
  nao_encontrado: 'não encontrado',
  nao_registrou: 'não foi possível registrar a consulta: nada foi entregue',
  demorou: 'a consulta demorou demais: nada foi entregue',
  taxa_nao_conferida: 'não foi possível conferir o limite de uso: nada foi entregue',
  nao_montou: 'não foi possível montar a resposta',
  tela_sem_pacote: 'esta tela ainda não tem pacote',
} as const

/** A5 F1b (I3): modo tabela pedido e nenhum CSV saiu; a linha vai no topo, para a IA não esperar um bloco que não existe. */
export const SEM_CSV_LISTA_VAZIA = 'Modo tabela: a lista está vazia nesta janela; não há CSV.'
export const SEM_CSV_SEM_CHAVES = (tabela: string): string => `Modo tabela: a tabela "${tabela}" não declara colunas de máquina; não há CSV, a resposta vem em texto.`

/** O rodapé da ação `sugestoes` (F2 T8): associação, não causa; "pode ajudar", nunca "vai ajudar" (D2). */
export const RODAPE_SUGESTOES =
  'Sugestões do nicho: associação entre vídeos de concorrentes que estouraram e um lugar, não causa; pode ajudar, não promete resultado.'

const TRES_HORAS_MS = 3 * 3_600_000 // São Paulo é UTC-3, sem horário de verão desde 2019 (igual a `lib/pipeline/chave.ts`)

/** `limite de uso atingido: tente de novo a partir das HH:MM (horário de São Paulo)`. Instante inválido não inventa hora. */
export function fraseDeLimite(voltaEmIso: string): string {
  const ms = Date.parse(voltaEmIso)
  if (!Number.isFinite(ms)) return 'limite de uso atingido: tente de novo mais tarde'
  const d = new Date(ms - TRES_HORAS_MS)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `limite de uso atingido: tente de novo a partir das ${hh}:${mm} (horário de São Paulo)`
}

/** O texto da tela de consentimento (mockup M1 r2, aprovado em 11/11). `sem_direito` é UMA frase para todos os motivos (sem dizer qual);
 *  `FRASES.sem_acesso` é técnica, serve à IA e não aparece na tela. */
export const FRASES_DA_TELA = {
  sem_direito: 'Esta conta não tem acesso a esta área.',
  sem_direito_titulo: 'Não foi possível conectar.',
  cortado_titulo: 'Acesso pausado pelo Thiago.',
  cortado: 'O Thiago desligou o seu acesso. Fale com ele para voltar.',
  desligado_titulo: 'A conexão está desligada por enquanto.',
  desligado: 'Nada foi criado. Tente de novo mais tarde ou fale com o Thiago.',
  invalido_titulo: 'Este pedido não vale mais.',
  invalido: 'Volte à IA em que você tocou em Conectar e tente de novo.',
  outro_navegador_titulo: 'Este pedido não vale mais.',
  outro_navegador: 'Volte à sua IA e toque em Conectar de novo. Faça tudo neste mesmo navegador, sem abrir outra aba.',
  sem_login_titulo: 'Entre para continuar.',
  sem_login: 'Sua sessão terminou. Entre de novo para conectar o Observatório à sua IA.',
  erro_titulo: 'Não deu para conectar agora.',
  erro: 'Nada foi criado nem liberado. Tente de novo em instantes.',
  erro_codigo: 'Se repetir, avise o Thiago e diga este código:',
  negado_titulo: 'Conexão negada.',
  negado: (ia: string): string => `Nada foi liberado para o ${ia}. Pode fechar esta página ou voltar.`,
  aprovado_titulo: (ia: string): string => `Pronto. O ${ia} está conectado.`,
  aprovado_voltando: (ia: string): string => `Voltando ao ${ia}...`,
  aprovado_manual: (ia: string): string => `Não voltou sozinho? Abra o ${ia}; a conexão já está feita.`,
  titulo: (ia: string): string => `Conectar o ${ia}`,
  resumo_privado: (ia: string): string => `O ${ia} quer ler o Observatório do Thiago na sua conta.`,
  resumo_publico: (ia: string): string => `O ${ia} quer ler os concorrentes do Observatório do Thiago na sua conta.`,
  voce_entrou: 'Você entrou como',
  nao_e_voce: 'Não é você? Sair',
  pedido_as: (ia: string, hora: string): string => `Pedido feito às ${hora} pelo ${ia}. Este pedido vale por 10 minutos.`,
  pode: (ia: string): string => `O que o ${ia} poderá fazer`,
  nao_pode: 'O que não poderá fazer',
  pode_concorrentes: 'Ver os canais concorrentes e como estão indo.',
  pode_privado: 'Ver o desempenho privado do canal do Thiago.',
  nao_escrever: 'Escrever, mudar ou apagar nada.',
  nao_outras_partes: 'Ver outras partes do site.',
  nao_privado: 'Ver o desempenho privado do canal (sem acesso nesta conta).',
  risco_sai: (ia: string): string => `O que você perguntar ao ${ia} sobre isso passa para o ${ia} e sai do nosso controle.`,
  risco_vale_ate: (data: string): string => `O acesso vale até ${data}.`,
  risco_corta: 'O Thiago pode cortar o acesso quando quiser.',
  aviso: (ia: string): string => `Só aprove se você acabou de clicar em Conectar no seu ${ia}.`,
  aviso_detalhe: 'Se alguém lhe mandou este link, não aprove.',
  aviso_tarde: 'Este pedido tem mais de 3 minutos. Se você não clicou em Conectar agora há pouco, toque em Não conectar.',
  ja_conectado: (ia: string): string => `Você já conectou o ${ia} antes. Se aprovar, a conexão antiga para de funcionar e vale esta.`,
  login_contexto: 'Entre para conectar o Observatório à sua IA.',
  aprovar: 'Sim, fui eu. Aprovar',
  aprovando: 'Aprovando...',
  negar: 'Não conectar',
  voltar: (ia: string): string => `Voltar ao ${ia}`,
  sair: 'Sair',
  tentar_de_novo: 'Tentar de novo',
  entrar: 'Entrar',
} as const
