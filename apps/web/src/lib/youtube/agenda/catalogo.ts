import type { Tarefa } from './tipos'
import { BATCH_BUDGET_MS, WEEKLY_DEADLINE_MS } from '@/lib/youtube/competitor-sync-batch'
import { HORARIA_FIM_MS, HORARIA_ULTIMA_ONDA_MS, PESADA_FIM_MS } from './relogio'
import { leituraHoraria } from './tarefas/leitura-horaria'
import { sincronizarCanais } from './tarefas/sincronizar-canais'
import { serieSemanal } from './tarefas/serie-semanal'

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

/** A definição de `nome` (que tem de existir: o teste do catálogo confere), sem o código. */
function definicao(nome: string): Definicao {
  const d = DEFINICOES.find(x => x.nome === nome)
  if (!d) throw new Error('definição ausente: ' + nome)
  return d
}

/**
 * O catálogo com o código (`rodar`), na ordem de `DEFINICOES`. Quem registra uma tarefa nova escreve `agenda/tarefas/<nome>.ts`
 * exportando uma `Tarefa` inteira (ou, como as três daqui, só o código, montado com a definição) e acrescenta UMA importação e UMA
 * entrada abaixo. Os arquivos das tarefas não importam este arquivo (ciclo).
 */
export const CATALOGO: readonly Tarefa[] = [
  { ...definicao('leitura_horaria'), ...leituraHoraria },
  { ...definicao('sincronizar_canais'), ...sincronizarCanais },
  { ...definicao('serie_semanal'), ...serieSemanal },
]

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
