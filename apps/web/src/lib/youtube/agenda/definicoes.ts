import type { Tarefa } from './tipos'
import { BATCH_BUDGET_MS, WEEKLY_DEADLINE_MS } from '@/lib/youtube/competitor-sync-batch'
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
  motivos: MOTIVOS_E14, fraseDe: (codigo, detalhe) => fraseDe(codigo, detalhe),
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

/** As duas definições da E14. O código de cada uma mora em `agenda/tarefas/anular-identidade.ts` e `retratos-comentarios.ts`, que declaram a `Tarefa` inteira. */
export const DEFINICOES_COMENTARIOS: readonly Definicao[] = [DEFINICAO_ANULAR_IDENTIDADE, DEFINICAO_RETRATOS_COMENTARIOS]

/**
 * A lista ÚNICA, em ordem de execução: as três da agenda e as duas da E14. É o que o vigia cobra (`saude.ts`) e o que o `CATALOGO` tem de
 * reproduzir (um teste compara os dois). Acrescentar uma tarefa ao catálogo é acrescentar a definição aqui.
 */
export const TODAS_AS_DEFINICOES: readonly Definicao[] = [...DEFINICOES, ...DEFINICOES_COMENTARIOS].sort((a, b) => a.ordem - b.ordem)

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

/**
 * `OBS_AGENDA_TASKS_OFF`: nomes de tarefa separados por vírgula (espaços e vazios ignorados; o nome é exato, minúsculo).
 * Nome que não é do catálogo vai em `desconhecidas` (o chamador põe numa nota visível); tarefa `nuncaDesliga` é ignorada, continua ligada e vai em `ignoradas` (o chamador mostra a nota).
 */
export function tarefasDesligadas(
  env: NodeJS.ProcessEnv,
  catalogo: readonly Pick<Tarefa, 'nome' | 'nuncaDesliga'>[],
): { desligadas: Set<string>; desconhecidas: string[]; ignoradas: string[] } {
  const desligadas = new Set<string>()
  const desconhecidas: string[] = []
  const ignoradas: string[] = []
  const cru = env.OBS_AGENDA_TASKS_OFF
  if (typeof cru !== 'string') return { desligadas, desconhecidas, ignoradas }
  for (const parte of cru.split(',')) {
    const nome = parte.trim()
    if (nome === '') continue
    const t = catalogo.find(c => c.nome === nome)
    if (!t) { if (!desconhecidas.includes(nome)) desconhecidas.push(nome); continue }
    if (t.nuncaDesliga) { if (!ignoradas.includes(nome)) ignoradas.push(nome); continue }
    desligadas.add(nome)
  }
  return { desligadas, desconhecidas, ignoradas }
}
