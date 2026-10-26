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
  { arquivo: S + 'lib/youtube/observatorio/arquivo-mensal/leitores-das-series.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/observatorio/arquivo-mensal/online-desde.ts', comoTrata: 'registro' },
  { arquivo: S + 'lib/youtube/observatorio/arquivo/remover.ts', comoTrata: 'registro' },
  { arquivo: S + 'app/cms/(authed)/youtube/competitors/_canais/remover-model.ts', comoTrata: 'registro' },
  { arquivo: S + 'lib/youtube/observatorio/saiu/rotulos.ts', comoTrata: 'texto_online_desde' },
  // o vigia e as telas: leem o registro; sem registro dizem "não medido", nunca 365 dias
  { arquivo: S + 'lib/youtube/competitor-health.ts', comoTrata: 'registro' },
  { arquivo: S + 'lib/youtube/observatorio/load.ts', comoTrata: 'registro' },
  { arquivo: S + 'lib/youtube/observatorio/load-channel.ts', comoTrata: 'registro' },
  { arquivo: S + 'lib/youtube/observatorio/medidas/ler.ts', comoTrata: 'texto_online_desde' },
  { arquivo: S + 'lib/youtube/observatorio/medidas/m1.ts', comoTrata: 'texto_online_desde' },
  { arquivo: S + 'lib/youtube/observatorio/medidas-telas/ler-horas.ts', comoTrata: 'janela_por_construcao' },
  { arquivo: S + 'lib/youtube/video-antigo/leitores-competitor-videos.ts', comoTrata: 'registro' },
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
]
