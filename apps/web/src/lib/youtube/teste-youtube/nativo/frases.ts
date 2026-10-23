// Toda a cópia da tela do teste do YouTube (F1a-tela-1, T4): estados `ficha-*`, `lista*`, `s7-*`, erros (`MOT`) e as
// frases fechadas por Logan em D-7/D-8. Módulo PURO (sem servidor, sem banco): é importado por componentes client e
// também pelo servidor (`imagem-ficha.ts`, `ficha.ts`, `lista.ts`). Fonte: mockup M2 `index.html:440-445,449-466,478-529,605-636`.

const EXTENSO = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez']
/** Numeral por extenso até dez; acima disso o algarismo. */
export const porExtenso = (n: number): string => (n <= 10 ? EXTENSO[n]! : String(n))
/** Feminino (versões, imagens): duas, três… */
export const porExtensoFem = (n: number): string => (n === 2 ? 'duas' : porExtenso(n))
export const capitalizar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
export const videos = (n: number): string => `${porExtenso(n)} ${n === 1 ? 'vídeo' : 'vídeos'}`

/** `dd/mm` em America/Sao_Paulo. */
export function dataCurta(d: Date): string {
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).formatToParts(d)
  const g = (t: string): string => p.find((x) => x.type === t)?.value ?? ''
  return `${g('day')}/${g('month')}`
}

/** Valor que o diálogo "Trocar mesmo assim?" recebe quando a leitura do YouTube falhou (a mesma frase vai ao lugar do título e da miniatura). */
export const TEXTO_SEM_LEITURA = 'Não deu para conferir o título agora; tente de novo.'

export interface FraseDeEstado { frase: string; apoio: string | null }
const f = (frase: string, apoio: string | null = null): FraseDeEstado => ({ frase, apoio })

export const FRASES = {
  /** Aviso de resolução (M1/M2, index.html:431). */
  resolucao: {
    naoMedida: 'Resolução não medida',
    baixa: (dim: string): string => `Resolução baixa: ${dim}`,
    explicacao: (_sujeito: 'enviada' | 'guardada', minimo: number): string =>
      `Abaixo de ${minimo} × ${Math.round((minimo * 9) / 16)} o Studio reduz todas as versões a 854 × 480. Envie uma maior.`,
  },
  /** Resumo da lista (T3 move para cá, mesmo texto) e frases de D-7. */
  lista: {
    carregando: f('Lendo os vídeos e os testes.', 'A contagem só aparece depois da leitura; nunca 0 enquanto carrega.'),
    contadorCarregando: 'Carregando…',
    caminhoTrocado: f('Você trocou o caminho deste vídeo para o nosso teste.', 'A escolha vale só para este vídeo e pode voltar.'),
    nadaEspera: 'Nada espera a sua resposta hoje.',
    apoioEmTesteOuPreparo: (n: number): string => `${capitalizar(videos(n))} em teste ou em preparo. Os demais seguem sem teste.`,
    labPausado: (n: number): string => `Lab pausado em ${n === 1 ? 'um vídeo' : `${porExtenso(n)} vídeos`}.`,
    esperam: (espera: number, prazo: number, hoje: number): string => {
      const verbo = espera === 1 ? 'espera' : 'esperam'
      const detalhe = prazo > 0 && hoje > 0
        ? `: ${porExtenso(prazo)} ${prazo === 1 ? 'passou' : 'passaram'} do prazo, ${porExtenso(hoje)} ${hoje === 1 ? 'terminou' : 'terminaram'} hoje`
        : ''
      return `${capitalizar(videos(espera))} ${verbo} a sua resposta${detalhe}.`
    },
    emTesteNoStudio: (n: number): string => `${porExtenso(n)} em teste no Studio`,
    detectados: (n: number): string => `parece haver teste no Studio em ${n === 1 ? 'um vídeo' : `${porExtenso(n)} vídeos`}`,
    emPreparo: (n: number): string => `${porExtenso(n)} em preparo`,
    labPausadoDeles: (n: number): string => `O Lab está pausado em ${porExtenso(n)} deles.`,
    rodape: 'Mostra os 20 mais recentes e os que têm ficha ou teste. Outros vídeos: Sugeridos para testar, acima.',
    leituraFalhou: 'Não deu para ler a lista agora.',
  },

  /** D-7: respostas sem vencedor (nunca "Ficou no ar"), resposta tardia e dia 14 sem botão. */
  resposta: {
    ficouIgual: 'Você respondeu: ficou igual.',
    inconclusivo: 'Você respondeu: inconclusivo.',
    naoVi: 'Você respondeu: não vi o resultado.',
    apoioSemVencedor: 'Nada ficou registrado como versão no ar. O resultado oficial está só no Studio. Mudar a resposta por esta tela chega na próxima atualização.',
    tardia: (prazo: Date): string => `O prazo acabou em ${dataCurta(prazo)}. Ainda dá para responder.`,
  },

  /** T10b: a pergunta do dia 14 com duas versões (mockup M2 `d14`, ramo sem resposta). Nunca "variante" nem "ficha". */
  dia14: {
    responder: 'Responder',
    pergunta: 'Qual versão venceu no Studio?',
    apoio: (confirmadoEm: Date | null): string =>
      `${confirmadoEm ? `Teste confirmado em ${dataCurta(confirmadoEm)}. ` : ''}O resultado oficial está só no Studio.`,
    versoes: 'Versões',
    originalFicou: 'A (original) ficou',
    novaVenceu: 'B venceu',
    outra: 'Outra resposta:',
    outraGrupo: 'Outra resposta',
    ficouIgual: 'Ficou igual',
    inconclusivo: 'Inconclusivo',
    naoVi: 'Não vi',
    /** D-7(b): aviso antes do toque (troca o M-3 da tela-1) e no modo mudar. */
    avisoResponder: 'Um toque responde; dá para mudar depois.',
    avisoMudar: 'Um toque muda a resposta.',
    /** D-7(c) e mockup `:544`: apoio da linha derivada, com e sem o título de antes conhecido. */
    apoioDerivada: 'Sem ficha: só os títulos que o Lab viu alternando; a miniatura não aparece de fora. A (original) é o título de antes.',
    apoioDerivadaSemOriginal: 'Sem ficha: só os títulos que o Lab viu alternando; a miniatura não aparece de fora. O Lab não sabe qual era o título de antes.',
    /** Rótulos dos cartões: `A ficou`/`B ficou` só na derivada sem original conhecida. */
    venceu: (letra: string): string => `${letra} venceu`,
    ficou: (letra: string): string => `${letra} ficou`,
    /** D-7(e): versões ilegíveis (ou 4 ou mais títulos) e o rótulo do grupo de respostas. */
    apoioSemVersoes: 'O Lab não guardou as versões deste teste. Você pode dizer só que ficou igual, inconclusivo ou que não viu.',
    suaResposta: 'Sua resposta:',
    mudarPara: 'Mudar para:',
    /** D-7(h): frases `sum()` do M2 para a página. */
    sum: {
      terminouDuas: 'O teste do YouTube terminou. Qual versão venceu no Studio?',
      terminouTres: 'O teste do YouTube terminou. Qual das três versões venceu no Studio?',
      prazoAcabou: 'O prazo acabou, mas ainda dá para responder.',
      semFicha: 'Sem ficha: o Lab só viu os títulos.',
    },
    /** T6: modo mudar, estados de envio e o resultado com a letra da versão (3 versões). */
    manter: 'Manter a resposta atual',
    suaRespostaCartao: 'Sua resposta',
    salvando: 'Salvando…',
    semConexaoMudar: 'Sem conexão. A resposta continua a mesma. Tente de novo.',
    seloNoAr: (letra: string): string => `Ficou no ar: ${letra}`,
    fraseNoAr: (letra: string): string => `A versão ${letra} venceu no Studio e ficou no ar.`,
    /** Troca para uma versão: a original leva "(original)" para a pessoa ver que escolheu a de antes. */
    mudadaPara: (letra: string, original: boolean): string => `Resposta mudada para ${letra}${original ? ' (original)' : ''}.`,
    /** Confirmação da 1ª resposta e da troca quando a resposta não é uma versão. */
    registrada: { ficou_igual: 'Registrado: você respondeu "ficou igual".', inconclusivo: 'Registrado: você respondeu "inconclusivo".', nao_vi: 'Registrado: você respondeu "não vi o resultado".' },
    mudadaSemVersao: { ficou_igual: 'Resposta mudada para "ficou igual".', inconclusivo: 'Resposta mudada para "inconclusivo".', nao_vi: 'Resposta mudada para "não vi o resultado".' },
    naoMedido: 'não medido',
    seloOriginal: 'Ficou no ar: A (original)',
    seloNova: 'Ficou no ar: B',
    /** `n` = quantas versões o teste tem: com 3 ou mais há mais de uma nova. */
    fraseOriginal: (n: number): string => (n >= 3 ? 'A original segurou: nenhuma das novas superou.' : 'A original segurou: a nova não superou.'),
    fraseNova: 'A versão B venceu no Studio e ficou no ar.',
    oficial: 'O resultado oficial está só no Studio.',
    seloSemVencedor: { ficou_igual: 'Sem vencedor: ficou igual', inconclusivo: 'Sem vencedor: inconclusivo', nao_vi: 'Sem vencedor: não vi o resultado' },
    respostasDiferentes: 'Respostas diferentes',
    respostasDiferentesFrase: 'O título no ar e a sua resposta são diferentes.',
    semConexao: 'Sem conexão. Nada foi registrado.',
    tentarDeNovo: 'Tentar de novo',
    falhou: 'Não deu para registrar a resposta agora. Toque na resposta de novo; se repetir, recarregue a página.',
  },

  /** D-7 (guarda do nosso teste) e D-8 (pergunta antes de "Iniciar teste"). */
  guarda: {
    motivoRecusa: (ate: Date): string =>
      `Este vídeo tem um teste do YouTube registrado até ${dataCurta(ate)}. Aguarde o resultado ou responda o teste antes de iniciar o nosso.`,
    guardaFalhou: 'Não deu para conferir se este vídeo já tem teste do YouTube. Nada foi iniciado.',
    /** O servidor devolve a recusa sem a data do registro; nunca se inventa o `dd/mm` (a frase fechada tem a data quando ela existe). */
    motivoRecusaSemData: 'Este vídeo tem um teste do YouTube registrado. Aguarde o resultado ou responda o teste antes de iniciar o nosso.',
    tentarDeNovo: 'Tentar de novo',
    estadoMudou: 'O teste mudou enquanto a tela estava aberta.',
    atualizar: 'Atualizar',
    pergunta: 'Você iniciou o teste do YouTube neste vídeo?',
    perguntaApoio: (enviadaEm: Date): string =>
      `A ficha foi enviada em ${dataCurta(enviadaEm)}. Se o teste já está ligado no Studio, o nosso não pode começar: o Lab não troca título nem miniatura enquanto o do YouTube roda.`,
    perguntaIncompleta: 'Complete a ficha para registrar',
    jaIniciei: 'Já iniciei',
    aindaNaoSeguir: 'Ainda não, seguir com o nosso teste',
  },

  /** Erros do "Já iniciei" (`MOT` do mockup): parte forte, resto e ação opcional. */
  motivo: {
    incompleta: { forte: 'Falta a versão B.', resto: ' O teste precisa de 2 ou 3 versões. Escreva o título ou envie a imagem da B e toque em Já iniciei de novo.', acao: null },
    ja_ha_teste: {
      /** A action não devolve a data do registro: sem "desde" (nunca inventar). */
      forteSemData: 'Este vídeo já tem um teste do YouTube registrado.',
      forte: (desde: Date): string => `Este vídeo já tem um teste do YouTube registrado, desde ${dataCurta(desde)}.`, resto: ' Nada novo foi gravado.', acao: 'Abrir esse teste' },
    estado_mudou: {
      forte: 'O vídeo mudou enquanto a ficha estava aberta',
      resto: (horaDaPausa: string | null): string => (horaDaPausa ? ` (o Lab pausou um teste às ${horaDaPausa}). Nada foi gravado.` : '. Nada foi gravado.'),
      acao: 'Recarregar a ficha',
    },
    sem_conexao: { forte: 'Sem conexão. Nada foi registrado.', resto: '', acao: 'Tentar de novo' },
  },

  /** Imagem da ficha (T2 usava mensagens provisórias em `imagem-ficha.ts`; agora vêm daqui). */
  imagem: {
    grande: 'A imagem precisa ter até 2 MB.',
    formato: 'A imagem precisa ser JPEG ou PNG.',
  },
  mudouEmOutroLugar: 'A ficha mudou em outra aba ou outro aparelho. Recarregamos a versão atual.',
  /** I-2: erros em que repetir o toque não resolve. */
  semPermissao: 'Sua sessão pode ter vencido. Recarregue a página, entre de novo e repita.',
  pedidoRecusado: 'Este pedido não foi aceito. Nada foi alterado. Recarregue a página e repita.',

  /** Faixas, blocos e passos da ficha (os componentes da T6-T9 leem daqui). */
  ficha: {
    crumb: 'Ficha do teste',
    testarNoYoutube: 'Testar no YouTube',
    carregando: f('Próximo passo: abrir no Studio e copiar as duas versões.', 'A ficha salva sozinha a cada campo.'),
    carregandoEstreita: f('Próximo passo: mandar esta ficha ao computador.', 'No celular o Studio não liga o teste. A ficha salva sozinha a cada campo.'),
    carregandoMeta: 'Carregando a ficha…',
    salvo: (quando: string): string => `Salvo ${quando}`,
    salvando: 'Salvando…',
    naoSalvo: 'Não salvo: sem conexão.',
    naoSalvoApoio: 'O que você escreveu continua aqui.',
    tentarAgora: 'Tentar agora',
    soOriginal: f('Falta a versão B para levar ao Studio.', 'A versão A é a atual do vídeo; escreva pelo menos uma nova.'),
    duas: f('Próximo passo: abrir no Studio e copiar as duas versões.', 'A ficha salva sozinha a cada campo.'),
    duasEstreita: f('Próximo passo: mandar esta ficha ao computador.', 'No celular o Studio não liga o teste. A ficha salva sozinha a cada campo.'),
    tresBaixa: (letras: string): FraseDeEstado => f(
      `Três versões prontas; ${letras}.`, 'Com uma imagem menor, o Studio reduz todas as versões.'),
    soTitulo: (n: number): FraseDeEstado => f(`Teste só de título: copie as ${porExtensoFem(n)} versões.`, 'Sem coluna de miniatura.'),
    soMiniatura: (n: number): FraseDeEstado => f(`Teste só de miniatura: baixe as ${porExtensoFem(n)} imagens.`, 'O título do vídeo não muda.'),
    imagemFalhou: (letra: string): FraseDeEstado => f(`A imagem da versão ${letra} não carregou.`, 'O resto da ficha está salvo.'),
    salvandoFrase: f('Próximo passo: abrir no Studio e copiar as duas versões.'),
    salvandoFraseEstreita: f('Próximo passo: ligar o teste no computador.'),
    offline: f('Sem conexão: as mudanças ainda não foram salvas.', 'O que você escreveu continua na tela.'),
    outroAparelho: f('A ficha que você começou no celular está aqui.', 'Próximo passo: abrir no Studio.'),
    outroAparelhoEstreita: f('Para ligar o teste, termine no computador; aqui dá para revisar.', 'A ficha foi feita lá; as versões estão abaixo.'),
    faixaOutroAparelho: (feita: string, estreita: boolean): { titulo: string; apoio: string | null } => estreita
      ? { titulo: `Ficha feita em ${feita} no computador`, apoio: null }
      : { titulo: `Ficha feita em ${feita} no celular`, apoio: 'As versões abaixo vieram de lá. Continue daqui: o Studio abre o teste.' },
    studioAberto: f('Você iniciou o teste no Studio?', 'Se sim, toque em Já iniciei; se não, a ficha espera.'),
    voceAbriuOStudio: (hora: string): string => `Você abriu o Studio às ${hora}.`,
    /** Ficha enviada em outro dia (recarga, outro aparelho): a data entra, nunca só a hora. */
    voceAbriuOStudioOutroDia: (data: string, hora: string): string => `Você abriu o Studio em ${data}, ${hora}.`,
    jaIniciei: f('Confirme que o teste já está ligado no Studio.'),
    confirmarConsequencia: (prazo: Date): string => `O Lab não mexe neste vídeo até você responder o resultado (prazo: ${dataCurta(prazo)}). Confirmar que o teste já está ligado no Studio?`,
    registrada: (lembrete: Date): FraseDeEstado => f('Teste do YouTube registrado. O Lab fica parado neste vídeo.', `Lembrete em ${dataCurta(lembrete)}.`),
    erro: f('O teste não foi registrado.', 'O motivo está no passo 3.'),
    ainda: f('A ficha fica salva até você iniciar no Studio.'),
    ainda_nota: 'Combinado. A ficha fica salva; a pergunta volta quando você reabrir.',
    detectado: f('Parece que o teste já começou no Studio.', 'Se foi você, confirme no passo 3.'),
    faixaDetectado: (desde: string): { titulo: string; apoio: string } => ({
      titulo: 'Parece haver um teste no Studio neste vídeo',
      apoio: `O título alterna desde ${desde}. Se foi você, toque em Já iniciei no passo 3.`,
    }),
    nossoRodando: f('Antes do Studio, pause o nosso teste neste vídeo.', 'Os dois juntos se atrapalham.'),
    faixaNossoRodando: (dia: number): { titulo: string; apoio: string } => ({
      titulo: `O nosso teste está rodando neste vídeo (dia ${dia} de 14)`,
      apoio: 'Os dois juntos se atrapalham: o teste do YouTube precisa da versão A no ar. Pausar restaura a original no YouTube e descarta a rotação em curso; os dados até hoje ficam guardados.',
    }),
    pausarConfirma: f('Confirme a pausa do nosso teste.'),
    pausarPergunta: 'Pausar agora?',
    pausarConsequencia: 'O vídeo volta à versão A (original) em até 1 minuto. Retomar o nosso teste fica disponível depois que o teste do YouTube terminar.',
    pausarEVoltar: 'Pausar e voltar a original',
    cancelar: 'Cancelar',
    restaurando: f('Restaurando a versão A no YouTube.'),
    faixaRestaurando: 'Restaurando a original…',
    restaurarFalhou: f('A original não voltou: o nosso teste segue rodando.', 'Reconecte o canal e tente de novo.'),
    faixaRestaurarFalhou: { titulo: 'Não deu para restaurar a original', apoio: 'O acesso ao YouTube venceu. O nosso teste continua rodando; nada foi trocado. Reconecte o canal e tente de novo.' },
    faixaRestaurarNaoVolta: { titulo: 'Não deu para confirmar que a original voltou', apoio: 'Pode ser que o vídeo já tivesse outro título ou miniatura, ou que a leitura do YouTube tenha demorado. Abra o vídeo no YouTube e confira se o título e a miniatura são os originais. Se não forem, troque por lá antes de seguir.' },
    /** Provisórias (Logan fecha): teste pausado sem retrato de restauro (pausa antiga ou reivindicação sem resultado) e a saída do dono. */
    faixaSemRegistro: { titulo: 'A volta da original não foi registrada', apoio: 'Este teste foi pausado antes de o Lab passar a registrar essa volta. Abra o vídeo no YouTube e confira se o título e a miniatura são os originais antes de seguir.' },
    conferiESeguir: 'A original já está no YouTube, seguir',
    reconectar: 'Reconectar o canal',
    /** Provisórias (T9b; Logan fecha): a exceção/rede ao pausar e ao mandar o lembrete. */
    pausarFalhou: 'Não deu para saber se a pausa foi feita. Recarregue a ficha: se o nosso teste ainda aparece rodando, toque em Pausar de novo.',
    pausarPrecisaConfirmar: 'O título ou a miniatura no YouTube já são outros. O Lab não os troca sozinho.',
    lembreteFalhou: 'Não deu para enviar o lembrete agora. Tente de novo.',
    restaurada: f('Original de volta no vídeo. Próximo passo: abrir no Studio.'),
    restauradaEstreita: f('Original de volta no vídeo. Próximo passo: mandar a ficha ao computador.'),
    faixaRestaurada: (quando: string): { titulo: string; apoio: string } => ({
      titulo: `Lab pausado. Original restaurada em ${quando}`,
      apoio: 'Pausado porque você vai testar no Studio. Retomar fica disponível depois que o teste do YouTube terminar.',
    }),
    lembrete: f('Lembrete enviado: abra a ficha no computador.', 'No celular o teste do YouTube não se liga.'),
    lembreteEnviado: (quando: string): string => `Lembrete enviado em ${quando}`,
    rodapeLembrete: {
      lembrar: 'Lembrar no computador',
      chega: 'Chega no sino do computador com esta ficha aberta.',
      abraPeloSino: 'Abra pelo sino no computador.',
      semB: 'Falta a versão B para mandar ao computador.',
      offline: 'Sem conexão: o lembrete fica na fila e sai quando a conexão voltar.',
    },
    parada: (dias: number): FraseDeEstado => f(`Esta ficha está parada há ${dias} dias.`, dias >= 14 ? 'Ela é descartada se nada mudar.' : 'Amanhã ela é descartada se nada mudar.'),
    faixaParada: (desde: Date, descarte: Date): { titulo: string; apoio: string } => ({
      titulo: `Ficha parada desde ${dataCurta(desde)}`,
      apoio: `Se ficar parada até amanhã, ${dataCurta(descarte)}, ela é descartada. Qualquer mudança aqui conta como uso.`,
    }),
    vencida: f('Esta ficha venceu e ficou só para consulta.', 'Para testar, comece outra.'),
    faixaVencida: (em: Date): { titulo: string; apoio: string } => ({
      titulo: `Esta ficha venceu em ${dataCurta(em)}`,
      apoio: 'Ficou 14 dias parada. As versões ficam aqui só para consulta.',
    }),
    comecarOutra: 'Começar outra ficha com estas versões',
    faltaB: 'Falta a versão B: escreva o título ou envie a imagem.',
    primeiroPause: 'Primeiro pause o nosso teste (faixa acima).',
    aberturaDepoisDaOriginal: 'Abrir no Studio aparece depois que a original voltar ao vídeo (faixa acima).',
    bloco1: { titulo: 'Versões para copiar', lede: 'O que o teste vai trocar. Até 3 versões; a A é a atual do vídeo.' },
    bloco2: {
      titulo: 'Levar ao Studio',
      passos: (tres: boolean): string[] => [
        'Na página do vídeo no Studio, abra o teste do YouTube (lá ele se chama Teste e compare), ao lado do título ou da miniatura.',
        `Cole os títulos e envie as imagens desta ficha, na ordem A, B${tres ? ', C' : ''}.`,
        'Inicie o teste no Studio e volte a esta aba.',
      ],
      ledeEstreita: 'O teste do YouTube só se liga no Studio pelo computador. Copie daqui se quiser; o lembrete leva esta ficha até lá.',
      ledeEstreitaOutroAparelho: 'Copie daqui se quiser; o teste se liga no computador.',
      ledeVencida: 'Ficha vencida: nada a levar.',
      abrirNoStudio: 'Abrir no Studio',
      abrirNoStudioDeNovo: 'Abrir no Studio de novo',
    },
    bloco3: { titulo: 'Confirmar', numero: (noTopo: boolean): number | null => (noTopo ? null : 3), pergunta: 'Você iniciou no Studio?', ainda: 'Ainda não', jaIniciei: 'Já iniciei', confirmar: 'Confirmar', voltar: 'Voltar', confirmarGrupo: 'Confirmar o início' },
    registradaBloco: (quando: string, retorno: string): { titulo: string; apoio: string } => ({
      titulo: `Teste registrado em ${quando}`,
      apoio: `O Lab não mexe neste vídeo até você responder o resultado. Em ${retorno} o lembrete chega no sino e por e-mail.`,
    }),
    voltarALista: 'Voltar à lista',
    fechar: 'Fechar',
    usarNosso: 'O Studio não ofereceu o teste neste vídeo? Usar o nosso teste',
    copiarTitulo: 'Copiar título',
    /** T8: versões, gravação e imagem. */
    naoSalvoConflito: 'Não salvo: a ficha mudou em outra aba ou outro aparelho. O que você escreveu continua aqui.',
    erroServidor: 'Não deu para salvar agora. O que você escreveu continua aqui.',
    erroCopiar: 'Não deu para copiar o título. Selecione o texto e copie à mão.',
    erroSalvar: 'Não foi possível salvar a ficha agora. Confira os campos e tente de novo.',
    tituloAcima: (limite: number): string => `O título passa de ${limite} caracteres. Encurte para salvar.`,
    erroImagem: 'Não foi possível enviar a imagem. Tente de novo.',
    erroAbrir: 'Não deu para abrir a ficha agora.',
    tentarDeNovo: 'Tentar de novo',
    baixarImagem: 'Baixar imagem',
    enviarImagem: (letra: string): string => `Enviar imagem da versão ${letra}`,
    enviarDeNovo: 'Enviar de novo',
    trocarImagem: 'Trocar imagem',
    trocarImagemAria: (letra: string): string => `Trocar imagem (Versão ${letra})`,
    imagemNaoCarregou: 'A imagem não carregou',
    naoMedidoOriginal: 'Miniatura da versão A: não medido',
    tituloOriginalNaoLido: 'O título atual do vídeo aparece aqui depois da primeira gravação.',
    versaoA: 'Versão A (original)',
    versaoA_nota: 'Já está no vídeo. Não precisa copiar.',
    versao: (letra: string): string => `Versão ${letra}`,
    tituloDaVersao: (letra: string): string => `Título da versão ${letra}`,
    escrevaOTitulo: 'Escreva o título',
    adicionarC: 'Adicionar versão C',
    oQueTestar: 'O que testar',
    campoTitulo: 'Título',
    campoMiniatura: 'Miniatura',
    campoOsDois: 'Os dois',
    salvoHoje: (hora: string): string => `às ${hora}`,
    salvoOutroDia: (dia: string, hora: string): string => `em ${dia}, ${hora}`,
  },

  /** Cartão S7, estado 1 (sem redesenho; só os rótulos do glossário). */
  s7: {
    sum: (desde: string): FraseDeEstado => f(`Parece haver um teste no Studio: o título alterna desde ${desde}. O Lab já está parado.`),
    selo: 'Parece haver um teste no Studio',
    visto: (desde: string, ultima: string): string => `Visto de fora desde ${desde}. Última leitura ${ultima}. Você ainda não confirmou.`,
    tituloDeAntes: 'Título de antes',
    tituloNovo: 'Título novo',
    leituras: 'Leituras com este título',
    leiturasNaoMedido: 'Leituras com este título: não medido',
    confirmar: 'Confirmar',
    naoETeste: 'Não é teste',
    liberarDecisao: 'Decisão sua, fica registrada.',
    liberarConsequencia: 'O Lab volta a trocar título e miniatura neste vídeo, mesmo que o YouTube esteja testando.',
    liberar: 'Liberar o Lab',
    cancelar: 'Cancelar',
    dica: 'Confirmar registra o teste; não altera o vídeo e mantém o Lab parado.',
    labPausado: (retomar: string): string => `Lab pausado porque parece haver teste no Studio. Retomar fica disponível a partir de ${retomar}.`,
    /** Estado 2 (confirmado) e o cartão do nosso teste pausado: "há", não "parece haver". */
    labPausadoConfirmado: (retomar: string): string => `Lab pausado porque há teste no Studio. Retomar fica disponível a partir de ${retomar}.`,
    /** Data passada (ou ausente) com o registro ainda aberto: o botão Retomar segue o dado, não o relógio. */
    retomarEspera: 'Retomar espera o resultado do teste no Studio.',
    labPausadoSemData: 'Lab pausado porque parece haver teste no Studio.',
    labPausadoConfirmadoSemData: 'Lab pausado porque há teste no Studio.',
    selo2: 'Em teste no Studio',
    confirmouEm: (quando: string): string => `Você confirmou em ${quando}.`,
    leiturasDe: (n: number, m: number): string => `${n} de ${m}`,
    desdeNaoMedido: 'data não medida',
    ultimaNaoMedida: 'não medida',
    retomar: 'Retomar',
    /** Provisórias (Logan fecha): a action falhou ou lançou; nada de estado 2 otimista. */
    confirmarFalhou: 'Não deu para confirmar agora. O Lab segue parado. Tente de novo.',
    liberarFalhou: 'Não deu para liberar o Lab agora. Ele segue parado neste vídeo. Tente de novo.',
    hoje: (hora: string): string => `hoje, ${hora}`,
    as: (dia: string, hora: string): string => `${dia} às ${hora}`,
  },
} as const
