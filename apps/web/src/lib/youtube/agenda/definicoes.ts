import type { Tarefa } from './tipos'
import { BATCH_BUDGET_MS, WEEKLY_DEADLINE_MS } from '@/lib/youtube/competitor-batch-constantes'
import { COMMENT_RULES, WORST_END_FROM_T0_MS } from '@/lib/youtube/observatorio/comentarios/regras'
import { FRASES_FIXAS, fraseDe } from '@/lib/youtube/observatorio/comentarios/frases'
import { MOTIVOS_COMUNS } from './motivos'
import { HORARIA_FIM_MS, HORARIA_ULTIMA_ONDA_MS, LEVE_COMECA_ATE_MS, PESADA_FIM_MS } from './relogio'

/**
 * As DEFINIÇÕES das tarefas (nome, rótulo, período, peso, tolerância, tempos, frases): tudo o que o vigia, o despachante e os testes leem,
 * SEM o código (`rodar`). Este módulo é leve de propósito: `/api/health` e o `cron-watchdog` chegam aqui pelo vigia (`saude.ts`) e não podem
 * carregar a coleta de comentários nem a leitura horária. Por isso ele NÃO importa `catalogo`, `executar`, `despachante` nem `tarefas/*`
 * (os arquivos de `tarefas/*` é que importam estas definições, para montar a `Tarefa` inteira; `catalogo.ts` re-exporta tudo daqui).
 */
/** Uma tarefa sem o que é código (`rodar`, `devidaPeloDado`): o que o vigia, o despachante e os testes leem sem carregar a coleta. */
export type Definicao = Omit<Tarefa, 'rodar' | 'devidaPeloDado'>

export const DEFINICOES: readonly Definicao[] = [
  {
    nome: 'leitura_horaria', rotulo: 'leitura horária', ordem: 1, peso: 'sempre', periodo: 'hora',
    tetoTentativas: 3, toleranciaVigiaH: 2, naoTerminouVermelhoEm: 3,
    comecaAteMs: HORARIA_ULTIMA_ONDA_MS, fimAteMs: HORARIA_FIM_MS,
    motivos: {
      lista_falhou: 'não foi possível montar a lista',
      lista_cortada: 'mais de 5.000 vídeos na janela (corte do banco)',
      ja_lidos_falhou: 'não foi possível ler o que já foi lido nesta hora',
      cota_esgotada: 'cota do YouTube esgotada',
      api_falhou: 'o YouTube não respondeu às chamadas',
      resposta_vazia: 'o YouTube não devolveu contagem dos vídeos pedidos',
      gravacao_falhou: 'não foi possível gravar as leituras',
      gravacao_sem_tempo: 'a gravação não coube no tempo',
      curva_falhou: 'a curva de 72 horas não foi gravada',
      sobrou: 'ficaram vídeos para o próximo disparo',
    },
  },
  {
    nome: 'sincronizar_canais', rotulo: 'sincronização dos canais', ordem: 6, peso: 'pesada', periodo: 'faixa',
    // 6 fechos seguidos sem terminar: a `e16-k1` ajusta (emenda do portão: S-I10).
    tetoTentativas: 9, toleranciaVigiaH: 8, naoTerminouVermelhoEm: 6,
    comecaAteMs: BATCH_BUDGET_MS, fimAteMs: PESADA_FIM_MS,
    motivos: {
      lote_em_erro: 'o lote de canais falhou',
      sobrou: 'ficaram canais para o próximo disparo',
    },
  },
  {
    nome: 'serie_semanal', rotulo: 'série semanal', ordem: 8, peso: 'pesada', periodo: 'dia', aPartirDaHoraSP: 12,
    cedeA: ['sincronizar_canais'],
    tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null,
    comecaAteMs: WEEKLY_DEADLINE_MS, fimAteMs: PESADA_FIM_MS,
    motivos: {
      canais_nao_lidos: 'não foi possível ler os canais',
      semanal_erro: 'a passada semanal falhou',
      semanal_com_erros: 'a passada semanal gravou parte e teve erros',
      sobrou: 'ficaram visitas para o próximo disparo',
    },
  },
]

/** As frases fixas da E14 sem os códigos que a agenda já tem (`schema_ausente`): quem está em `MOTIVOS_COMUNS` usa a frase comum. */
const MOTIVOS_E14: Record<string, string> = Object.fromEntries(Object.entries(FRASES_FIXAS).filter(([codigo]) => !Object.hasOwn(MOTIVOS_COMUNS, codigo)))

/**
 * `anular_identidade` (E14): aos 28 dias a identidade do autor de um comentário é apagada. Obrigação de LGPD: `nuncaDesliga`, entra na lista que
 * roda antes do lote antigo e o vigia a cobra (36 h de tolerância) mesmo com `OBS_AGENDA=off` ou com o nome em `OBS_AGENDA_TASKS_OFF`.
 * `fimAteMs`: 75 s para começar mais as duas idas ao banco (apagar e ler a prova), 5 s cada; dentro do teto das leves (90 s).
 */
export const DEFINICAO_ANULAR_IDENTIDADE: Definicao = {
  nome: 'anular_identidade', rotulo: 'anular identidade de autores', ordem: 2, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 3,
  tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null,
  comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 85_000, nuncaDesliga: true,
  // m-7: o `inesperado` da E14 diz "retratos falharam"; na anulação a frase é própria (sem número: `fraseDe` não a substitui).
  motivos: { ...MOTIVOS_E14, inesperado: 'a anulação falhou com erro inesperado (ver Sentry)' },
  fraseDe: (codigo, detalhe) => (codigo === 'inesperado' ? undefined : fraseDe(codigo, detalhe)),
}

/**
 * `retratos_comentarios` (E14): os retratos dos comentários de destaque dos vídeos de concorrentes (24 h, 7 e 30 dias). Pesada: a vaga é da
 * agenda (cede a vez à sincronização dos canais). `comecaAteMs` e `fimAteMs` vêm de `COMMENT_RULES` e do pior caso derivado dele
 * (225 s de `t0`, que deixa os 20 s da prova e os 15 s do registro da rota). Pode ser desligada (`OBS_AGENDA_TASKS_OFF`).
 */
export const DEFINICAO_RETRATOS_COMENTARIOS: Definicao = {
  nome: 'retratos_comentarios', rotulo: 'retratos de comentários', ordem: 7, peso: 'pesada', periodo: 'dia', aPartirDaHoraSP: 13,
  tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: 6,
  comecaAteMs: COMMENT_RULES.startsByMs, fimAteMs: WORST_END_FROM_T0_MS, cedeA: ['sincronizar_canais'],
  motivos: MOTIVOS_E14, fraseDe: (codigo, detalhe) => fraseDe(codigo, detalhe),
}

/**
 * `tamanho_do_banco` (A5 E10): a medida diária do tamanho do banco do site (`obs_db_size_record`), a partir das 05:00 de São Paulo. Leve; pode ser
 * desligada (`OBS_AGENDA_TASKS_OFF`). O código mora em `agenda/tarefas/tamanho-do-banco.ts`. Os três motivos são os de `MOTIVOS_TAMANHO`, escritos por
 * extenso AQUI: este módulo é leve e não importa `observatorio/arquivo` (um teste confere que os dois textos são iguais). `fimAteMs` 85 s: 10 s das
 * duas idas ao banco da medida e 20 s da nova tentativa das miniaturas, com folga, dentro do teto das leves (90 s).
 */
export const DEFINICAO_TAMANHO_DO_BANCO: Definicao = {
  nome: 'tamanho_do_banco', rotulo: 'tamanho do banco', ordem: 4, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 5,
  tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null,
  comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 85_000,
  motivos: {
    medida_falhou: 'não foi possível medir o tamanho do banco',
    resposta_invalida: 'a medida do tamanho do banco veio fora da forma esperada',
    inesperado: 'a medida do tamanho do banco falhou de um jeito inesperado',
  },
}

/**
 * `marcas_de_idade` (A5 E4, Tarefa 11): grava uma vez, quando a idade do vídeo fecha, as views (e curtidas e comentários) nas idades de 1, 7 e 30 dias
 * (`competitor_marks_pending` / `competitor_marks_apply`), e o motivo quando a marca não pôde ser medida. Leve, a partir das 04:00 de São Paulo; pode ser
 * desligada (`OBS_AGENDA_TASKS_OFF`). O código mora em `agenda/tarefas/marcas-de-idade.ts`. Os códigos de motivo são escritos por extenso AQUI: este módulo é
 * leve e não importa `medidas/fechar-marcas.ts` (um teste confere que batem com `MOTIVOS_DAS_MARCAS`; `schema_ausente` é dos comuns). `ordem: 5.5` (a 3 é da
 * soma do mapa); `naoTerminouVermelhoEm: null` (a carga inicial drena em várias execuções, e `parcial` com progresso não é problema).
 */
export const DEFINICAO_MARCAS_DE_IDADE: Definicao = {
  nome: 'marcas_de_idade', rotulo: 'marcas de idade', ordem: 5.5, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 4,
  tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null,
  comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 85_000,
  motivos: {
    banco_nao_respondeu: 'o banco não respondeu a tempo',
    leitura_falhou: 'não foi possível ler os vídeos com idade fechada',
    gravacao_falhou: 'não foi possível gravar as marcas',
    resposta_invalida: 'o banco devolveu uma resposta fora da forma esperada',
    marca_recusada: 'o banco recusou marcas ou motivos calculados (vídeo apagado ou base alterada no meio; se repetir, é defeito de código)',
    prova_inconsistente: 'há marca e motivo para o mesmo vídeo, marca com o site errado ou marca com a base da idade antiga',
    marcas_perdidas: 'marcas não puderam ser medidas: faltou leitura ao redor da idade',
    marcas_atrasadas: 'há vídeos com idade fechada há mais de 3 dias sem marca nem motivo',
    sobrou: 'ficaram vídeos para o próximo disparo',
    inesperado: 'a gravação das marcas falhou com erro inesperado (ver Sentry)',
  },
  // Só `marcas_perdidas` tem frase com número, e só as idades 7 e 30 avisam (a idade 1 fica no detalhe). Sem os números: `undefined` (frase fixa).
  fraseDe: (codigo, d) => {
    if (codigo !== 'marcas_perdidas') return undefined
    const p7 = d.perdidas_7, p30 = d.perdidas_30
    if (typeof p7 !== 'number' || typeof p30 !== 'number') return undefined
    const p30Avisa = p30 - (d.perdidas_30_semanal ?? 0)
    const n = p7 + p30Avisa
    if (n <= 0) return undefined
    return `${n} marcas não puderam ser medidas (7 dias: ${p7}; 30 dias: ${p30Avisa}): faltou leitura ao redor da idade`
  },
}

/**
 * `poda_acesso_ia` (A5 E17 degrau 2, Tarefa 13b): apaga do registro de acesso de IA o que passou de 400 dias e do contador de taxa o que passou de 2 dias
 * (`acesso-ia/poda.ts`, por fatia de 30 dias). Leve, a partir das 05:00 de São Paulo, uma vez por dia; pode ser desligada (`OBS_AGENDA_TASKS_OFF`). Sem filtro
 * de site, de propósito: a guarda é do banco inteiro. `toleranciaVigiaH` 192 = os 8 dias que o spec dá às podas. Os quatro códigos são escritos por extenso
 * AQUI (este módulo é leve e não importa `acesso-ia/poda.ts`, que é `server-only`; um teste confere o conjunto); `schema_ausente` é dos comuns.
 * `ordem: 5.2`: depois de `tamanho_do_banco` (4) e antes de `marcas_de_idade` (5.5) e de toda pesada.
 */
export const DEFINICAO_PODA_ACESSO_IA: Definicao = {
  nome: 'poda_acesso_ia', rotulo: 'poda do registro de acesso de IA', ordem: 5.2, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 5,
  tetoTentativas: 12, toleranciaVigiaH: 192, naoTerminouVermelhoEm: null,
  comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 85_000,
  motivos: {
    banco_falhou: 'o banco falhou ao podar o registro de acesso de IA',
    contagem_ausente: 'o banco não devolveu a contagem do que podou; nada foi afirmado',
    sem_tempo_para_terminar: 'não coube no disparo; o resto fica para o dia seguinte',
    atraso_restante: 'ainda há registro vencido de dias anteriores; a próxima execução continua',
  },
}

/**
 * `playlists_semanais` (A5 X3): lê as playlists e as seções de canal dos concorrentes (`competitor_x3_*`), uma visita por canal por dia, cada canal a cada 7 dias.
 * Leve, a partir das 07:00 de São Paulo. **`ligaCom: 'OBS_X3_PLAYLISTS'`**: só liga com o valor exato `on` (ausente = desligada; ligar só depois da migration aplicada).
 * `comecaAteMs: 50_000` é `X3_RULES.canalComecaAteMs` escrito por extenso (este módulo é leve e não importa código de coleta; um teste confere a igualdade, e os
 * motivos contra `PRIORIDADE_DE_MOTIVOS`). `fimAteMs: 85_000` é `FIM_ATE_MS`. `ordem: 5.7` (depois de `marcas_de_idade`, antes das pesadas).
 */
export const DEFINICAO_PLAYLISTS_SEMANAIS: Definicao = {
  nome: 'playlists_semanais', rotulo: 'playlists e seções dos concorrentes', ordem: 5.7, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 7,
  tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: 9,
  comecaAteMs: 50_000, fimAteMs: 85_000, ligaCom: 'OBS_X3_PLAYLISTS',
  motivos: {
    canais_nao_lidos: 'não foi possível ler os canais',
    api_falhou: 'o YouTube não respondeu às chamadas',
    resposta_invalida: 'o YouTube devolveu uma resposta fora da forma esperada',
    gravacao_falhou: 'não foi possível ler ou gravar as playlists',
    canal_pausado: 'um canal foi pausado ou removido durante a leitura',
    cota_esgotada: 'cota do YouTube esgotada',
    lista_cortada: 'a lista de playlists de um canal ficou incompleta',
    contagem_difere: 'a contagem do YouTube não bate com o que foi lido',
    teto_por_canal: 'o teto de chamadas por canal cortou a leitura; o resto segue no dia seguinte',
    itens_cortados: 'a leitura dos itens de uma playlist foi interrompida',
    playlist_sumiu_no_meio: 'uma playlist sumiu entre a lista e os itens',
    itens_incoerentes: 'o YouTube devolveu uma playlist vazia que tinha itens',
    teto_itens: 'uma playlist tem mais itens do que o teto de leitura',
    saida_em_massa_a_confirmar: 'muitos itens saíram de uma playlist; a confirmação fica para outro dia',
    lista_vazia_a_confirmar: 'a lista de playlists de um canal veio vazia; a confirmação fica para outro dia',
    secoes_vazias_a_confirmar: 'as seções de um canal vieram vazias; a confirmação fica para outro dia',
    teto_do_dia: 'o teto de unidades do dia cortou a leitura',
    sobrou: 'ficaram canais para o próximo disparo',
  },
}

/**
 * `leitura_watch` (A5 S4): lê a página `watch` anônima de cada vídeo devido, 3 leituras por rodada, e grava numa chamada só. Leve, depois das leves diárias
 * (`ordem 5.9`) e antes das pesadas. **`ligaCom: 'OBS_WATCH_READ'`**: só `on` liga (deploy desligado; liga depois da migration e do P-V, longe das 05:00 SP).
 * `comecaAteMs` é o das leves (a tarefa tem a sua própria guarda de 70 s); `fimAteMs: 88_000` é a guarda dura, dentro do teto de 90 s das leves.
 */
export const DEFINICAO_LEITURA_WATCH: Definicao = {
  nome: 'leitura_watch', rotulo: 'leitura das páginas do YouTube', ordem: 5.9, peso: 'leve', periodo: 'hora',
  // 3 = a hora inteira sem terminar (período 'hora' tem 3 disparos): o 6 antigo nunca acendia. No dia da ligação o vermelho é esperado.
  tetoTentativas: 3, toleranciaVigiaH: 2, naoTerminouVermelhoEm: 3,
  comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 88_000, ligaCom: 'OBS_WATCH_READ',
  motivos: {
    bloqueado: 'o YouTube bloqueou as leituras (consentimento, robô ou limite); o próximo disparo tenta de novo',
    leitura_bloqueada: 'mais da metade das leituras da página do YouTube falhou',
    layout_mudou: 'a página do YouTube mudou: os títulos não foram encontrados',
    gravacao_falhou: 'não foi possível gravar as leituras da página do YouTube',
    sem_alvos: 'há vídeos na janela, mas nenhum entrou na coleta',
    sobrou: 'ficaram vídeos para o próximo disparo',
    extensao_falhou: 'a avaliação de teste falhou em algum vídeo',
    lista_falhou: 'não foi possível montar a lista de vídeos',
  },
}

/**
 * `poda_leituras_watch` (A5 S4): poda as leituras vencidas da `watch` (até 3 lotes de 5.000) e roda a prova diária da saúde da leitura (`yt_watch_prova`).
 * Leve, depois das 05:00 de São Paulo, **sem `ligaCom`**: com a coleta desligada ela roda assim mesmo (a prova recebe `p_coleta_ligada = false` e não acende aviso).
 * `ordem: 5.3` (depois de `poda_acesso_ia`, antes de `marcas_de_idade`).
 */
export const DEFINICAO_PODA_LEITURAS_WATCH: Definicao = {
  nome: 'poda_leituras_watch', rotulo: 'poda das leituras da página do YouTube', ordem: 5.3, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 5,
  tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null,
  comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 85_000,
  motivos: {
    banco_falhou: 'o banco falhou ao podar as leituras da página do YouTube',
    prova_falhou: 'não foi possível conferir a saúde da leitura das páginas do YouTube',
    sobrou: 'ficaram leituras vencidas para o dia seguinte',
  },
}

/**
 * `registro_teste_nativo` (S7 fase 1): lê as leituras da watch dos vídeos próprios devidos, roda a regra do teste nativo do YouTube e grava o registro e a avaliação
 * (`ab_native_tests`, `ab_native_avaliacoes`). Leve, a cada disparo (`devidaPeloDado` sempre verdadeira; o que é devido sai da lista), **depois** da `leitura_watch` (`5.9`).
 * **`ligaCom: 'AB_NATIVO_REGISTRO'`**: só `on` liga. `naoTerminouVermelhoEm 3`: o contador é por linha de período; com `periodo 'hora'` e disparo a cada 20 min chega a 3 no máximo.
 * `comecaAteMs` e `fimAteMs` iguais aos da leitura da watch (a tarefa tem prazo próprio de 30 s e nenhuma ida ao banco depois de `t0 + 83 s`).
 */
export const DEFINICAO_REGISTRO_TESTE_NATIVO: Definicao = {
  nome: 'registro_teste_nativo', rotulo: 'registro do teste do YouTube', ordem: 5.95, peso: 'leve', periodo: 'hora',
  tetoTentativas: 3, toleranciaVigiaH: 3, naoTerminouVermelhoEm: 3,
  comecaAteMs: 60_000, fimAteMs: 88_000, ligaCom: 'AB_NATIVO_REGISTRO',
  motivos: {
    video_falhou: 'a avaliação de teste do YouTube falhou em algum vídeo',
    sobrou: 'ficaram vídeos para o próximo disparo',
    lista_falhou: 'não foi possível montar a lista de vídeos',
    gravacao_falhou: 'não foi possível gravar a avaliação',
    sem_video: 'há vídeo próprio acompanhado há mais de um dia que não está na tabela de vídeos',
  },
}

/**
 * `avisos_pendentes` (F1a-dado, T12): o lembrete do dia 14 (e-mail, uma vez por dono) e o fechamento por silêncio (`sem_resposta`) dos testes do YouTube confirmados.
 * Leve, a partir das 09:00 de São Paulo, uma vez ao dia. **Sem `ligaCom`** (o recuo natural do registrador, `off`, deixaria a linha confirmada sem lembrete nem
 * fechamento; o desligamento operacional é `OBS_AGENDA_TASKS_OFF`): sem linha devida a tarefa não faz nada. O código mora em `agenda/tarefas/avisos-pendentes.ts`.
 * `ordem: 5.96` (depois do registro, antes das pesadas).
 */
export const DEFINICAO_AVISOS_PENDENTES: Definicao = {
  nome: 'avisos_pendentes', rotulo: 'avisos do teste do YouTube', ordem: 5.96, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 9,
  tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null,
  comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 85_000,
  motivos: {
    leitura_falhou: 'não foi possível ler os testes do YouTube para avisar',
    lembrete_falhou: 'o lembrete do dia 14 não saiu e será tentado de novo',
    lembrete_desistiu: 'o lembrete do dia 14 falhou três vezes e foi abandonado (o teste fecha por silêncio)',
    fechamento_falhou: 'não foi possível fechar um teste sem resposta',
    sobrou: 'ficaram testes para o próximo disparo',
  },
}

/** As duas definições da E14. O código de cada uma mora em `agenda/tarefas/anular-identidade.ts` e `retratos-comentarios.ts`, que declaram a `Tarefa` inteira. */
export const DEFINICOES_COMENTARIOS: readonly Definicao[] = [DEFINICAO_ANULAR_IDENTIDADE, DEFINICAO_RETRATOS_COMENTARIOS]

/**
 * A lista ÚNICA, em ordem de execução: as três da agenda, as duas da E14, a medida do banco (E10) e as marcas de idade (E4). É o que o vigia cobra (`saude.ts`) e o que o `CATALOGO` tem de
 * reproduzir (um teste compara os dois). Acrescentar uma tarefa ao catálogo é acrescentar a definição aqui.
 */
export const TODAS_AS_DEFINICOES: readonly Definicao[] = [...DEFINICOES, ...DEFINICOES_COMENTARIOS, DEFINICAO_TAMANHO_DO_BANCO, DEFINICAO_PODA_ACESSO_IA, DEFINICAO_MARCAS_DE_IDADE, DEFINICAO_PLAYLISTS_SEMANAIS, DEFINICAO_LEITURA_WATCH, DEFINICAO_REGISTRO_TESTE_NATIVO, DEFINICAO_AVISOS_PENDENTES, DEFINICAO_PODA_LEITURAS_WATCH].sort((a, b) => a.ordem - b.ordem)

/** O interruptor geral. Desligada SÓ com `OBS_AGENDA === 'off'` (exato: 'OFF', '0', '' e espaço deixam ligada). Variável apagada = ligada. */
export function agendaLigada(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OBS_AGENDA !== 'off'
}

/** Nota fixa (sem o valor da variável) para `OBS_AGENDA` que não é ausente, vazia nem exatamente 'off'; `null` nos demais casos. `agendaLigada` não muda. */
export function notaDoInterruptorDaAgenda(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = env.OBS_AGENDA
  if (v === undefined || v === '' || v === 'off') return null
  return 'valor não reconhecido em OBS_AGENDA; a agenda segue ligada'
}

/** A variável `ligaCom` de uma tarefa a liga só com o valor exato `on`. */
export const ligadaPorVariavel = (t: Pick<Tarefa, 'ligaCom'>, env: NodeJS.ProcessEnv): boolean => t.ligaCom === undefined || env[t.ligaCom] === 'on'

/**
 * `OBS_AGENDA_TASKS_OFF`: nomes de tarefa separados por vírgula (espaços e vazios ignorados; o nome é exato, minúsculo).
 * Nome que não é do catálogo vai em `desconhecidas` (o chamador põe numa nota visível); tarefa `nuncaDesliga` é ignorada, continua ligada e vai em `ignoradas` (o chamador mostra a nota).
 * Tarefa com `ligaCom` cuja variável não é exatamente `on` entra em `desligadas` e em `naoLigadas` (para o vigia dizer o motivo); essa regra vem ANTES do
 * retorno antecipado de `OBS_AGENDA_TASKS_OFF` ausente.
 */
export function tarefasDesligadas(
  env: NodeJS.ProcessEnv,
  catalogo: readonly Pick<Tarefa, 'nome' | 'nuncaDesliga' | 'ligaCom'>[],
): { desligadas: Set<string>; desconhecidas: string[]; ignoradas: string[]; naoLigadas: Set<string> } {
  const desligadas = new Set<string>()
  const naoLigadas = new Set<string>()
  const desconhecidas: string[] = []
  const ignoradas: string[] = []
  for (const t of catalogo) if (!ligadaPorVariavel(t, env)) { desligadas.add(t.nome); naoLigadas.add(t.nome) }
  const cru = env.OBS_AGENDA_TASKS_OFF
  if (typeof cru !== 'string') return { desligadas, desconhecidas, ignoradas, naoLigadas }
  for (const parte of cru.split(',')) {
    const nome = parte.trim()
    if (nome === '') continue
    const t = catalogo.find(c => c.nome === nome)
    if (!t) { if (!desconhecidas.includes(nome)) desconhecidas.push(nome); continue }
    if (t.nuncaDesliga) { if (!ignoradas.includes(nome)) ignoradas.push(nome); continue }
    desligadas.add(nome)
  }
  return { desligadas, desconhecidas, ignoradas, naoLigadas }
}
