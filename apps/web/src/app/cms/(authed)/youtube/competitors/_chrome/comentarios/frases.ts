// A5 · E5a · Tarefa C2: as frases da seção "Comentários de destaque". Texto puro, sem componente.
// Fonte: tabela do NOTAS 20, seção 2, MENOS "canal do seu cadastro; o nome fica" (desvio 17 / decisão 67: nenhuma variação escreve
// "o nome fica") e MENOS "Nada foi apagado: o que está guardado continua lá." (desvio 18); MAIS as frases do desvio 16.

/** O YouTube devolve no máximo 5 respostas por comentário de topo; com 5 ou menos nunca é "não sabemos". */
export const RESPOSTAS_QUE_O_YOUTUBE_MOSTRA = 5

export const dias = (n: number): string => (n === 1 ? '1 dia' : `${n} dias`)
export const plural = (n: number, um: string, varios: string): string => (n === 1 ? `1 ${um}` : `${n.toLocaleString('pt-BR')} ${varios}`)

export const FRASES = {
  titulo: 'Comentários de destaque',
  tituloDoInfo: 'Como escolhemos os comentários',
  rotuloDoInfoDaFrase: (n: number, de: number) => `Como contamos os ${n} de ${de} comentários`,
  fonte: 'Cálculo do Observatório sobre dados públicos do YouTube.',
  // Abas: a segunda linha diz o estado.
  abaGuardados: (n: number | null) => (n === null ? 'guardados' : n === 1 ? '1 guardado' : `${n} guardados`),
  abaNenhum: 'nenhum comentário',
  abaDesligados: 'desligados pelo canal',
  abaNaoColetado: 'não coletado',
  abaAntesDaColeta: 'antes da coleta',
  abaFechaEm: (dm: string) => `fecha em ${dm}`,
  abaACaminho: 'a caminho',
  abaParada: 'coleta parada',
  abaNaoComecou: 'coleta não começou',
  abaNaoCarregou: 'não carregou',
  // Motivos
  motivoCurtidos: 'Mais curtido',
  motivoCriador: 'Com o criador',
  motivoAcompanhado: 'Canal que você acompanha',
  motivoGrande: 'Canal grande',
  seloSeuCanal: 'seu canal',
  voceComentou: 'Você comentou aqui',
  seloCriador: 'criador',
  // Legenda
  legendaCurtidos: (n: number) => (n === 1 ? '1 mais curtido' : `${n} mais curtidos`),
  legendaCriador: (n: number, respondeu = 0) => `${n} com o criador${respondeu > 0 ? ` (ele respondeu a ${respondeu})` : ''}`,
  legendaAcompanhado: (n: number) => `${n} de canal que você acompanha`,
  legendaGrande: (n: number, ate: string) => `${n} de canal grande, ${ate}`,
  legendaGrandeCurta: (n: number) => `${n} de canal grande`,
  // Frases de abertura da lista (singular no 1)
  abreTodos: (d: number, n: number) => `Com ${dias(d)}, guardamos ${n === 1 ? 'o único comentário do vídeo' : `todos os ${n} comentários do vídeo`}`,
  abreDeTodos: (d: number, n: number, de: number) => `Com ${dias(d)}, guardamos ${n} de todos os ${de.toLocaleString('pt-BR')} comentários do vídeo`,
  abreDosPrimeiros: (d: number, n: number, de: number) =>
    `Com ${dias(d)}, guardamos ${n} dos ${de.toLocaleString('pt-BR')} primeiros comentários que o YouTube mostra, na ordem de relevância dele`,
  rotuloDaCasa: (i: number, n: number, motivo: string, curtidas: number | null, d: number) =>
    `Comentário ${i} de ${n}, ${motivo.toLowerCase()}${curtidas === null ? '' : `, ${curtidas === 1 ? '1 curtida' : `${curtidas.toLocaleString('pt-BR')} curtidas`} com ${dias(d)}`}`,
  zeroCurtidos: '0 mais curtidos',
  zeroCriador: '0 com o criador',
  zeroAcompanhado: 'nenhum canal que você acompanha comentou',
  zeroGrande: (ate: string) => `nenhum canal grande ${ate}`,
  entreOs20: (n: number) => `entre os ${n} mais curtidos`,
  entreOsMedidos: (n: number) => `entre os ${n} que deu para medir`,
  entreOsDoVideo: 'entre os comentários do vídeo',
  inscritosOcultos: (n: number) => (n === 1 ? '1 autor com inscritos ocultos' : `${n} autores com inscritos ocultos`),
  // Entrou e saiu
  entraram: (n: number, de: number, ate: number) => `${n} ${n === 1 ? 'entrou' : 'entraram'} nos 12 do dia ${de} ao dia ${ate}`,
  sairam: (n: number) => `${n} ${n === 1 ? 'saiu' : 'saíram'}`,
  verOsQueSairam: (n: number) => (n === 1 ? 'Ver o 1 que saiu dos 12' : `Ver os ${n} que saíram dos 12`),
  primeiroRetrato: (proximo: number | null) =>
    proximo === null ? 'Este é o primeiro retrato.' : `Este é o primeiro retrato. O dia ${proximo} mostra quem entrou e quem saiu dos 12.`,
  // Lista
  mostrarOutros: (n: number) => `Mostrar os outros ${n}`,
  mostrarSoOsPrimeiros: (n: number) => `Mostrar só os ${n} primeiros`,
  posicao: (i: number, de: number) => `${i} de ${de}`,
  entrouNoDia: (d: number) => `entrou nos 12 no dia ${d}`,
  // Autor
  espectador: 'Um espectador',
  autorReservado: 'Autor reservado',
  textoReservado: 'Texto reservado.',
  textoReservadoSub: 'Há um comentário aqui que você não vê.',
  identidadeAte: (dm: string) => `identidade guardada até ${dm}`,
  canalGrandeSemNome: (faixa: string | null) =>
    faixa === '10m_mais' ? 'Um canal com mais de 10 milhões de inscritos comentou'
      : faixa === '100k_1m' ? 'Um canal de 100 mil a 1 milhão de inscritos comentou'
        : faixa === '1m_10m' ? 'Um canal de 1 a 10 milhões de inscritos comentou'
          : 'Um canal grande comentou',
  // Permissão que não se conferiu: o nível cai para o número e a tela diz por quê (a C3 e a C4 usam a mesma frase)
  permissaoNaoConferida: 'Não deu para conferir a sua permissão agora, então os comentários aparecem só como número. Recarregue a página para tentar de novo.',
  // Texto
  verTudo: 'Ver tudo',
  mostrarMenos: 'Mostrar menos',
  cortadoAos: 'cortado aos 2.000 caracteres',
  temEndereco: 'Este comentário tem um endereço. Aqui ele é só texto, não abre.',
  // Resposta do criador
  respondeu: (nome: string) => `${nome} respondeu`,
  respondeuReservado: 'O criador respondeu. O texto da resposta é reservado.',
  naoVimos: (n: number) =>
    n === 1
      ? 'Não vimos resposta do criador. Conferimos a única resposta que o YouTube mostrou e ela não é dele.'
      : `Não vimos resposta do criador. Conferimos as ${n} respostas que o YouTube mostrou e nenhuma é dele.`,
  naoSabemos: (vistas: number, total: number) =>
    `Não sabemos se o criador respondeu. O YouTube mostrou só ${vistas} das ${total.toLocaleString('pt-BR')} respostas e nenhuma é dele.`,
  // Curtidas
  foraDos12: 'fora dos 12',
  fechaEmCurto: (dm: string) => `fecha em ${dm}`,
  semRetratoAinda: 'ainda sem retrato', // o marco ainda vai fechar ou a coleta voltará
  semRetrato: 'sem retrato', // o marco encerrou sem retrato
  // Base do canal grande
  tamanho: { '100k_1m': 'de 100 mil a 1 milhão de inscritos', '1m_10m': 'de 1 a 10 milhões de inscritos', '10m_mais': 'mais de 10 milhões de inscritos' } as Record<string, string>,
  razao: { '10x_100x': 'de 10 a 100 vezes este canal', '100x_1000x': 'de 100 a 1.000 vezes este canal', '1000x_mais': 'mais de 1.000 vezes este canal' } as Record<string, string>,
  razaoNaoMedida: 'razão não medida',
  razaoNaoMedidaLonga: 'os inscritos do canal do vídeo estão ocultos',
  // Saiu do YouTube
  saiuDesde: (quando: string) => `Não veio mais do YouTube desde ${quando}. O YouTube não diz por quê.`,
  verNaFila: 'Ver na fila “Saíram do YouTube”',
  // Rodapé
  publicadoEm: (dm: string) => `Publicado em ${dm}`,
  respostasN: (n: number) => (n === 1 ? '1 resposta' : `${n.toLocaleString('pt-BR')} respostas`),
  // Faixas de nível
  faixaContagem:
    'Você vê quantos comentários há e como cada um evoluiu. O texto fica reservado a quem tem o direito “ver desempenho privado” ou edita o site; o nome e a foto, só a quem edita.',
  faixaTexto:
    'Você vê o texto, mas não o nome nem a foto de quem comentou. Nos primeiros 28 dias, isso é só de quem edita o site.',
  // Estados sem lista
  zeroMedidoTitulo: (d: number) => `Com ${dias(d)}, nenhum comentário.`,
  zeroMedidoCorpo: (dm: string) => `O YouTube informou 0 comentários neste vídeo em ${dm}.`,
  zeroMedidoSelo: 'zero medido',
  zeroMedidoNota: 'Medimos e deu zero. Isto não é falta de dado: o YouTube confirmou a contagem.',
  desligadosTitulo: 'Comentários desligados pelo canal.',
  desligadosCorpo: (canal: string) => `O canal ${canal} desligou os comentários deste vídeo.`,
  desligadosSelo: 'motivo do canal',
  desligadosNota: 'Não é zero comentários e não é falha nossa: ninguém pode comentar neste vídeo. Se o canal religar, o próximo retrato mostra.',
  naoColetadoTitulo: (d: number) => `Não coletado com ${dias(d)}.`,
  tardeCorpo: (descobertoComDias: number | null, prazoDias: number) =>
    descobertoComDias === null
      ? `Descobrimos o vídeo depois do prazo de ${dias(prazoDias)} para esta idade.`
      : `Descobrimos o vídeo com ${dias(descobertoComDias)}, depois do prazo de ${dias(prazoDias)} para esta idade.`,
  tardeSelo: (dm: string) => `motivo nosso · ${dm}`,
  // A coleta grava "lista vazia com contagem" como erro; o dado diz a data e, quando há, a contagem guardada do vídeo.
  listaVaziaCorpo: (dm: string, total: number | null) =>
    total === null || total <= 0
      ? `Em ${dm} o YouTube devolveu a lista vazia.`
      : `Em ${dm} o vídeo tinha ${total === 1 ? '1 comentário' : `${total.toLocaleString('pt-BR')} comentários`} pela última contagem, mas o YouTube devolveu a lista vazia.`,
  listaVaziaNota: 'Isto não é “nenhum comentário”: a contagem diz que há.',
  erroCorpo: (dm: string, codigo: string) =>
    codigo === 'proibido' ? `O YouTube não deixou ler os comentários deste vídeo em ${dm}. Pode ser vídeo só para membros.`
      : codigo === 'video_nao_encontrado' ? `O YouTube não encontrou este vídeo em ${dm}.`
        : `O YouTube não devolveu os comentários em ${dm}.`,
  erroSelo: (dm: string) => `motivo nosso · tentativa de ${dm}`,
  erroNota: (ate: string, encerrada: boolean) =>
    encerrada ? `Tentamos até ${ate}; esta idade ficou sem retrato.` : `Tentamos de novo até ${ate}; se não vier, esta idade fica sem retrato.`,
  // desvio 16
  janelaPerdida: (d: number) => `Não coletado com ${dias(d)}: a coleta não rodou enquanto o vídeo tinha essa idade`,
  janelaPerdidaNota: 'Isto não é “nenhum comentário”. Essa idade não terá retrato.',
  antesDaColetaTitulo: 'Este vídeo é anterior à coleta de comentários.',
  antesDaColetaCorpo: (coleta: string, publicado: string) => `A coleta começou em ${coleta}; o vídeo foi publicado em ${publicado}.`,
  antesDaColetaSelo: (coleta: string) => `a coleta começou em ${coleta}`,
  fechaEmTitulo: (d: number, dm: string) => `O retrato de ${dias(d)} fecha em ${dm}.`,
  fechaEmSelo: 'ainda não existe',
  fechaEmNota: (d: number, dm: string) => `O vídeo faz ${dias(d)} em ${dm}. Até lá não há o que mostrar, e isto não é zero.`,
  aCaminho: (d: number, fez: string, ate: string) => `Ainda não existe: o vídeo fez ${dias(d)} em ${fez}; o retrato sai na próxima coleta, até ${ate}.`,
  aCaminhoSelo: 'chega na próxima coleta',
  naoComecou: 'A coleta de comentários ainda não começou.',
  parada: (dm: string) => `A coleta de comentários está parada desde ${dm}.`,
  paradaSemOk: (dm: string) => `A coleta de comentários está parada: sem execução completa desde ${dm}.`,
  paradaSelo: 'coleta parada',
  carregando: 'Carregando os comentários guardados…',
  erroDeLeitura: 'Não deu para abrir os comentários agora.',
  tentarDeNovo: 'Tentar de novo',
  // ⓘ da seção
  infoParagrafos: (mencoesTrocadas: number): string[] => [
    'Guardamos até 12 comentários por idade do vídeo.',
    'Eles vêm dos 100 primeiros que o YouTube mostra: até 4 com o criador, até 2 de destaque e o resto, os mais curtidos.',
    'As três idades (1, 7 e 30 dias) são retratos separados. “Fora dos 12” quer dizer que o comentário não estava entre os guardados naquele dia; não é zero curtidas.',
    'O nome e a foto de quem comentou ficam guardados por 28 dias; depois disso o autor vira “Um espectador”.',
    'Guardamos até 3 respostas do criador por comentário.',
    ...(mencoesTrocadas > 0 ? ['Menções a outras pessoas aparecem como “@…”: o nome delas fica escondido.'] : []),
    'Cálculo do Observatório sobre dados públicos do YouTube.',
  ],
} as const

/** O marcador que substitui uma menção. */
export const MARCADOR_DE_MENCAO_NA_TELA = '@…'
