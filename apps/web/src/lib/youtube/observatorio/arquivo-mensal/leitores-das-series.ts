/**
 * Manutenção M5 (04 §14.1, itens 82 e 83): a lista FECHADA de quem lê (ou escreve) `competitor_video_daily|early|hourly`. O teste
 * `test/manutencao/leitores-das-series.test.ts` procura no código e falha com o caminho de qualquer arquivo novo que não esteja aqui.
 *
 * `comoTrata`: `janela_por_construcao` (só nomeia a tabela ou lê uma janela que a política garante online), `registro` (lê o registro/online
 * desde e diz "não medido" quando falta), `texto_online_desde` (a tela passa a dizer "desde dd/mm"), `escritor` (só grava, nunca decide janela).
 * O que cada tela diz depois de uma saída está no comentário de cada linha (04 L92-96).
 */
export type ComoTrata = 'janela_por_construcao' | 'registro' | 'texto_online_desde' | 'escritor'
export interface LeitorDaSerie { arquivo: string; comoTrata: ComoTrata }
const S = 'apps/web/src/'

export const LEITORES_DAS_SERIES: readonly LeitorDaSerie[] = [
  // escritores: gravam as leituras; uma saída de mês não muda o que gravam
  { arquivo: S + 'lib/youtube/agenda/tarefas/leitura-horaria.ts', comoTrata: 'escritor' },
  { arquivo: S + 'lib/youtube/horaria/gravar.ts', comoTrata: 'escritor' },
  { arquivo: S + 'lib/youtube/competitor-sync.ts', comoTrata: 'escritor' },
  // partições (criação/manutenção): trabalham com a tabela, não com a janela de leitura
  { arquivo: S + 'lib/youtube/agenda/particoes.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/agenda/tarefas/particoes-a-frente.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/conferencias.ts', comoTrata: 'janela_por_construcao' },
  // tipos gerados e nomes de tabela
  { arquivo: S + 'types/database.types.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/observatorio/cache-tag.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/video-antigo/tabelas-fora-da-classe.ts', comoTrata: 'janela_por_construcao' },
  // o arquivo mensal: contrato, expurgo e remoção falam das tabelas pelo nome; o número vem do registro
  { arquivo: S + 'lib/youtube/observatorio/arquivo-mensal/contrato.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/observatorio/arquivo-mensal/expurgo-filtro.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/observatorio/arquivo-mensal/expurgo-resumo.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/observatorio/arquivo-mensal/peca1.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/observatorio/arquivo-mensal/estado-do-mes.ts', comoTrata: 'janela_por_construcao' }, // T9: só nomeia as tabelas nos rótulos (NOME_DA_TABELA); a janela vem do registro já lido pelo chamador
  { arquivo: S + 'lib/youtube/observatorio/arquivo-mensal/leitores-das-series.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/observatorio/arquivo-mensal/online-desde.ts', comoTrata: 'registro' },
  { arquivo: S + 'lib/youtube/observatorio/arquivo/remover.ts', comoTrata: 'registro' },
  { arquivo: S + 'app/cms/(authed)/youtube/competitors/_canais/remover-model.ts', comoTrata: 'registro' },
  { arquivo: S + 'lib/youtube/observatorio/saiu/rotulos.ts', comoTrata: 'texto_online_desde' },
  // o vigia e as telas: leem o registro; sem registro dizem "não medido", nunca 365 dias
  { arquivo: S + 'lib/youtube/competitor-health.ts', comoTrata: 'registro' },
  { arquivo: S + 'lib/youtube/observatorio/load.ts', comoTrata: 'registro' },
  { arquivo: S + 'lib/youtube/observatorio/load-channel.ts', comoTrata: 'registro' },
  // `cortadoEm` existe mas ainda não tem consumidor nos carregadores (portão da T13); as janelas dos chamadores (120 d, curva 180 d) cabem na garantia da série diária
  { arquivo: S + 'lib/youtube/observatorio/medidas/ler.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/observatorio/medidas/m1.ts', comoTrata: 'janela_por_construcao' }, // só nomeia a tabela num comentário
  { arquivo: S + 'lib/youtube/observatorio/medidas-telas/ler-horas.ts', comoTrata: 'registro' },
  { arquivo: S + 'lib/youtube/video-antigo/leitores-competitor-videos.ts', comoTrata: 'registro' },
  // peça 1 (T5b): as telas do vídeo e do canal leem o online desde e dizem "no arquivo" ou "não medido"
  { arquivo: S + 'app/cms/(authed)/youtube/competitors/_historico/view-model.ts', comoTrata: 'registro' },
  { arquivo: S + 'app/cms/(authed)/youtube/competitors/_historico/medidas/horas-model.ts', comoTrata: 'registro' },
  { arquivo: S + 'app/cms/(authed)/youtube/competitors/_historico/medidas/ler-do-video.ts', comoTrata: 'registro' },
  { arquivo: S + 'app/cms/(authed)/youtube/competitors/_canal/medidas/lancamentos-model.ts', comoTrata: 'registro' },
  { arquivo: S + 'app/cms/(authed)/youtube/competitors/_canal/medidas/contexto-do-canal.ts', comoTrata: 'registro' },
]

/**
 * Arquivos de tela que podem escrever 365, 180 ou uma data de início de coleta (2026-10-01 a 03). Toda entrada tem motivo e a
 * confirmação de Phil (Tarefa 16); nunca exceção silenciosa.
 */
export const EXCECOES_DE_DATA_FIXA: readonly { arquivo: string; motivo: string }[] = [
  {
    arquivo: S + 'lib/youtube/observatorio/medidas-telas/calendario.ts',
    motivo: 'INICIO_DAS_MARCAS é o início das marcas V1, V7 e V30 (competitor_video_marks), que nunca saem do banco; não é o início da série diária e não depende do online desde.',
  },
  // Triagem de 365/180 da M5 (r3): confirmação do Phil na Tarefa 16
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_canais/add-channel-form.tsx',
    motivo: 'não é janela: minWidth: 180 em pixels de um select do formulário de canal',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_canais/ri-model.ts',
    motivo: 'não é janela: "1.180 mil" é exemplo de formatação de número num comentário, sem dias',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_canal/medidas/lancamentos.tsx',
    motivo: 'janela: texto de ajuda da linha do normal diz "publicados nos últimos 180 dias" (janela da curva do canal, constante curve.windowDays); só texto',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_canal/tabela.tsx',
    motivo: 'não é janela: height={180} em pixels da miniatura do vídeo',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_canal/trocas.tsx',
    motivo: 'não é janela: height={180} em pixels da miniatura do vídeo',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_canal/use-rolagem-ao-voltar.ts',
    motivo: 'não é janela: 180 é o limite de quadros de requestAnimationFrame da espera da rolagem',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_canal/video-card.tsx',
    motivo: 'não é janela: height={180} em pixels da miniatura do vídeo',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_chrome/forja-view-model.ts',
    motivo: 'não é janela: só formata o rótulo (meses ou dias) de uma janela da forja que vem pronta; não define janela de série',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_chrome/gatilho-volta.ts',
    motivo: 'não é janela: 180 é o limite de quadros de requestAnimationFrame do gatilho de volta',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_chrome/medidas/estourou-leitura.ts',
    motivo: 'janela: comentário descreve a janela de 180 dias do conjunto do canal; não decide nada no código',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_chrome/own-menu.ts',
    motivo: 'não é janela: 365 separa "há N meses" de "há N anos" na idade de um item do menu; texto de idade, não leitura de série',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_comparar/direcao-model.ts',
    motivo: 'janela: frase "com 180 dias de registro" escrita à mão: texto da janela de comparação; candidato a ler a constante da política (Tarefa 16)',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_comparar/medidas-do-lado.ts',
    motivo: 'janela: comentário sobre os vídeos fora da conta nos 180 dias; não decide nada',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_comparar/pack.ts',
    motivo: 'janela: `idade > 180` corta o conjunto da comparação aos 180 dias de série (idade fracionária 0..90 e 90..180); cabe na garantia da diária (181), candidato a ler a constante',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_historico/medidas/curva-por-idade.tsx',
    motivo: 'janela: texto de ajuda "publicados nos últimos 180 dias" da curva do normal; só texto',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_historico/medidas/derivar-do-video.ts',
    motivo: 'janela: comentário sobre a janela de 180 dias da série do conjunto do canal; não decide nada',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_historico/medidas/idade-model.ts',
    motivo: 'não é janela: comentário "nunca 365 dias" explica que a idade não medida não vira número; sem janela',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_historico/medidas/ler-do-video.ts',
    motivo: 'janela: comentário sobre a janela de 180 dias de série e 90 de horas do conjunto; não decide nada',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_historico/thumb.tsx',
    motivo: 'não é janela: h = 180 é a altura padrão em pixels da miniatura',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_insights/view-model.ts',
    motivo: 'janela: faixas de idade AGES_6M (91-180) e texto "nos últimos 180 dias" do recorte de temas; faixas fixas da tela, não leem a série diretamente',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_outliers/age-timeline.tsx',
    motivo: 'janela: comentário com as faixas de idade (0-30, 31-90, 91-180, 181-365); documentação das faixas, não decide nada',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_outliers/view-model.ts',
    motivo: 'janela: faixas de idade (91-180, 181-365, 365+), apelidos de URL e rótulo "6 meses" quando windowDays >= 180; faixas e rótulos fixos da tela de outliers',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_proprio/como-esta-model.ts',
    motivo: 'não é janela: ALTURA_VIEWS e ALTURA_CANAL = 180 px da área de barras do gráfico',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_proprio/impressoes-model.type-test.ts',
    motivo: 'não é janela: alturaArea: 180 em pixels num teste de tipos',
  },
  {
    arquivo: S + 'app/cms/(authed)/youtube/competitors/_proprio/video-screen.tsx',
    motivo: 'não é janela: height={180} em pixels da miniatura do vídeo',
  },
  {
    arquivo: S + 'lib/youtube/observatorio/medidas-telas/carregar-do-video.ts',
    motivo: 'janela: comentário cita curve.windowDays (180) dias do conjunto; não decide nada',
  },
  {
    arquivo: S + 'lib/youtube/observatorio/medidas-telas/cobertura.ts',
    motivo: 'janela: anteriorCoberto(…, dias = 180): padrão de 180 dias da cobertura do histórico; candidato a ler a constante da política',
  },
]
