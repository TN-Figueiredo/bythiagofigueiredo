// C1 F4 T21b: todos os textos da página "Conectar sua IA" (mockup M2 r2, aprovado em 11/11). Textos literais do mockup; nada de Gemini.
export const PASSOS_POR_IA = {
  chatgpt: {
    nome: 'ChatGPT',
    abrir: 'Abrir o ChatGPT',
    // 14/11 (ensaio do dono, conta Free): Plugins fica na barra da esquerda; o botão abre a página direto e o menu é "Add" no canto de cima
    href: 'https://chatgpt.com/plugins',
    passos: [
      'Abra o ChatGPT no navegador pelo botão abaixo; ele já abre a página “Plugins”. No celular, use o navegador, não o aplicativo.',
      'Toque em “Add”, no canto de cima à direita, e depois em “Add custom MCP server”.',
      'Em nome, escreva “Observatório do Thiago”. Em endereço (URL), cole o que você copiou. Se aparecer autenticação, deixe OAuth.',
      'Se aparecer um aviso, marque que entende. Toque no botão de criar (“Create”) e salve. O ChatGPT vai abrir uma página do bythiagofigueiredo.com: confira o seu e-mail e toque em “Sim, fui eu. Aprovar”.',
    ],
  },
  claude: {
    nome: 'Claude',
    abrir: 'Abrir o Claude',
    // 14/11 (ensaio do dono): o Claude.ai levou os conectores de Configurações para Customize; o botão abre direto a lista
    href: 'https://claude.ai/new#customize/connectors/yours',
    passos: [
      'Abra o Claude no navegador pelo botão abaixo. No celular, use o navegador.',
      'O botão abre “Customize” e “Connectors” (em português, “Personalizar” e “Conectores”). Toque em “Add” (Adicionar) e escolha o conector personalizado (“custom connector”).',
      'Escreva o nome “Observatório do Thiago” e cole o endereço. Nas opções de login, deixe como já vier marcado.',
      'Toque em “Add” (Adicionar) e depois em “Connect” (Conectar). O Claude vai abrir uma página do bythiagofigueiredo.com.',
    ],
  },
} as const

export const FRASES_CONECTAR = {
  titulo: 'Conectar sua IA',
  resumo: 'Ligue o seu ChatGPT ou Claude ao Observatório para perguntar sobre os canais.',
  ate: (data: string) => ` Você tem acesso até ${data}.`,
  copieEndereco: 'Copie o endereço',
  copiar: 'Copiar',
  copiarAria: 'Copiar o endereço',
  copiado: 'Copiado',
  copiadoStatus: 'Endereço copiado. Cole no campo de endereço da IA.',
  copiarFalhou: 'Não deu para copiar. Toque no endereço, segure e escolha Copiar.',
  naSuaIa: 'Na sua IA',
  escolhaIa: 'Escolha sua IA',
  depoisPasso5: 'Depois do passo 5, abre uma página nossa para você aprovar.',
  avisoAprove: (ia: string) => `Só aprove se você acabou de clicar em Conectar no seu ${ia}.`,
  avisoLinkAlheio: 'Se alguém lhe mandou o endereço ou um link para aprovar, não aprove.',
  riscoPergunte: (ia: string) => `Depois de aprovar, volte ao ${ia} e pergunte, por exemplo: “Quais canais concorrentes publicaram mais esta semana?”`,
  riscoSoLe: 'A IA só lê o Observatório. Não escreve, não muda e não apaga nada.',
  naoAchou: 'Não achou o botão?',
  naoAchouTexto: 'Os nomes dos botões mudam de vez em quando. Procure por algo parecido com “conector”, “plugin” ou “MCP”. Se não achar, fale com o Thiago.',
  nuncaTitulo: 'Você ainda não tem acesso.',
  nuncaTexto: 'Fale com o Thiago.',
  vencidaTitulo: (em: string | null) => (em ? `Seu acesso venceu em ${em}.` : 'Seu acesso venceu.'),
  vencidaTexto: 'Fale com o Thiago para renovar.',
  pausadoTitulo: 'Acesso pausado pelo Thiago.',
  pausadoTexto: 'Fale com ele para voltar.',
  // mesmo literal de FRASES_DA_TELA.desligado_titulo (T21); repetido aqui para não acoplar a página ao arquivo da tela de consentimento
  desligadoTitulo: 'A conexão está desligada por enquanto.',
  erroTitulo: 'Não deu para checar o seu acesso agora.',
  erroTexto: 'Tente de novo em instantes.',
  tentarDeNovo: 'Tentar de novo',
  carregando: 'Carregando o seu acesso...',
  linhaObservatorio: 'Quer perguntar sobre estes canais ao seu ChatGPT ou Claude?',
  loginContexto: 'Entre para ver como conectar o Observatório à sua IA',
} as const
