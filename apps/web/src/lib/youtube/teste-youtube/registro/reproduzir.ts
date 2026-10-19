import { rodadasDeTitulo } from '../rodadas'
import type { EscritaConhecida, LeituraWatch } from '../tipos'
import { avaliarVideo } from './registrar'
import type { AcaoRegistro, Encerramento, Fechamentos, NovaAvaliacao, NovoRegistro, RegistroAberto } from './tipos'

export interface Reproducao {
  registros: Array<NovoRegistro & { fim: Encerramento | null }>
  avaliacoes: NovaAvaliacao[]
}

/**
 * Acerto do passado: repete, rodada a rodada, o que o registrador teria feito se já existisse (avaliações `retroativa`),
 * e termina com uma avaliação real (`agora`). Pura: o mesmo `novoId` determinístico dá o mesmo resultado; a idempotência
 * da gravação é da RPC `ab_native_reproduzir`. Só para vídeo sem nenhuma avaliação sem erro.
 *
 * `inicial` (aberto e fechamentos vindos do banco) entra só como estado de partida: ação contra um registro que já está
 * no banco não vira linha em `registros` (a reprodução só devolve registros novos).
 */
export function reproduzirPassado(
  leituras: readonly LeituraWatch[],
  escritas: readonly EscritaConhecida[],
  agora: string,
  novoId: () => string,
  inicial?: { aberto: RegistroAberto | null; fechamentos: Fechamentos },
): Reproducao {
  let aberto: RegistroAberto | null = inicial?.aberto ?? null
  let fechamentos: Fechamentos = inicial?.fechamentos ?? { encerradoEm: null, descartadoEm: null }
  const registros: Array<NovoRegistro & { fim: Encerramento | null }> = []
  const avaliacoes: NovaAvaliacao[] = []
  let versao = 0

  const abertoDe = (n: NovoRegistro): RegistroAberto => ({
    id: n.id, updatedAt: `reproducao-${++versao}`, origem: 'detectado', campos: n.campos, variantesTitulo: n.variantesTitulo, votosTitulo: n.votosTitulo,
    primeiraVista: n.primeiraVista, ultimaVista: n.ultimaVista, veredito: n.veredito, evidencia: n.evidencia,
  })
  const registroDe = (id: string): (NovoRegistro & { fim: Encerramento | null }) | undefined => registros.find(r => r.id === id)
  const fechar = (id: string, fim: Encerramento): void => {
    const r = registroDe(id)
    if (r) r.fim = fim
    aberto = null
    fechamentos = { ...fechamentos, encerradoEm: fim.encerradoEm }
  }
  const aplicar = (a: AcaoRegistro): void => {
    switch (a.tipo) {
      case 'nada':
        return
      case 'criar':
        registros.push({ ...a.novo, fim: null })
        aberto = abertoDe(a.novo)
        return
      case 'atualizar': {
        const { desfecho, ...campos } = a.mudanca
        const r = registroDe(a.id)
        if (r) Object.assign(r, campos)
        if (aberto !== null && aberto.id === a.id) {
          aberto = { ...aberto, ...campos, updatedAt: `reproducao-${++versao}`, ...(desfecho ? { desfechoEstado: desfecho.estado, desfechoMotivo: 'motivo' in desfecho ? desfecho.motivo : null } : {}) }
        }
        return
      }
      case 'desfecho':
        if (aberto !== null && aberto.id === a.id) {
          aberto = { ...aberto, updatedAt: `reproducao-${++versao}`, desfechoEstado: a.desfecho.estado, desfechoMotivo: 'motivo' in a.desfecho ? a.desfecho.motivo : null }
        }
        return
      case 'encerrar':
        fechar(a.id, a.fim)
        return
      case 'encerrar_e_criar':
        fechar(a.id, a.fim)
        registros.push({ ...a.novo, fim: null })
        aberto = abertoDe(a.novo)
        return
    }
  }

  const ordenadas = rodadasDeTitulo(leituras, { escritasConhecidas: escritas })
    .map(r => ({ ateMs: Date.parse(r.ate) }))
    .sort((x, y) => x.ateMs - y.ateMs)
  for (const { ateMs } of ordenadas) {
    const ate = leituras.filter(l => Date.parse(l.lidaEm) <= ateMs)
    const r = avaliarVideo({ leituras: ate, escritas, aberto, fechamentos, agora: new Date(ateMs + 1).toISOString(), novoId, retroativa: true })
    avaliacoes.push(r.avaliacao)
    aplicar(r.acao)
  }
  const real = avaliarVideo({ leituras, escritas, aberto, fechamentos, agora, novoId, retroativa: false })
  avaliacoes.push(real.avaliacao)
  aplicar(real.acao)
  return { registros, avaliacoes }
}
