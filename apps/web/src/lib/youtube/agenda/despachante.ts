import type { ContextoTarefa, EstadoAgenda, LinhaTarefa, Lido, ResultadoTarefa, Tarefa } from './tipos'
import { codigoDoMotivo, fraseDoMotivo, resumoTecnico } from './motivos'
import { chaveDoPeriodo, horaSP, inicioDoPeriodo } from './periodo'
import { LEVE_COMECA_ATE_MS, comPrazo } from './relogio'

/**
 * O despachante decide o que roda neste disparo e na ordem. Não importa banco, `fetch` nem Sentry:
 * as operações chegam por parâmetro (`ops`), e a rota as monta com o cliente de serviço.
 * Texto de exceção nunca sai daqui: só código de catálogo, números e a frase fixa do catálogo.
 */

export interface EstadoFinalTarefa {
  tarefa: string
  estado: 'ok' | 'parcial' | 'erro' | 'adiada' | 'esgotada' | 'nao_devida' | 'desligada' | 'ocupada'
  ms: number
  feitas: number | null
  deixadas: number | null
  motivo?: string
  detalhe?: Record<string, number>
  extra?: unknown
}
export interface ResumoDisparo { tarefas: EstadoFinalTarefa[]; problemas: string[]; notas: string[] }

export interface OpsAgenda {
  tomar: (t: { task: string; period_key: string; teto: number; reabrir: boolean }) => Promise<Lido<boolean>>
  fechar: (t: {
    task: string; period_key: string; estado: 'ok' | 'parcial' | 'erro'; feitas: number; deixadas: number | null
    motivo?: string; ms: number; detalhe?: Record<string, number>
  }) => Promise<Lido<boolean>>
  adiar: (t: { task: string; period_key: string; motivo: 'sem_tempo' | 'uma_pesada_por_disparo' }) => Promise<void>
  esgotar: (t: { task: string; period_key: string; teto: number }) => Promise<Lido<boolean>>
  relatar: (tarefa: string, o: { codigo: string; tecnico?: { classe: string; sqlstate: string | null } }) => void
}

export interface EntradaDespacho {
  catalogo: readonly Tarefa[]
  desligadas: ReadonlySet<string>
  t0: number
  agora: () => number
  estado: Lido<EstadoAgenda>
  contexto: ContextoTarefa
  ops: OpsAgenda
}

interface Devida { t: Tarefa; chave: string; linha: LinhaTarefa | null; reabrir: boolean }

const ESTADOS_DO_RESULTADO: ReadonlySet<string> = new Set(['ok', 'parcial', 'erro'])
const P_SEM_RESPOSTA = 'o banco não respondeu'

const inteiroNaoNegativo = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : null

function soNumeros(d: Readonly<Record<string, number>> | undefined): Record<string, number> | undefined {
  if (typeof d !== 'object' || d === null) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(d)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  return out
}

/** Sã: a última execução não foi erro, esgotada, nem ficou rodando, nem parcial sem nada feito. Sem execução anterior conta como sã. */
function sa(linha: LinhaTarefa | null): boolean {
  const s = linha?.last_run_status
  if (s === null || s === undefined) return true
  if (s === 'erro' || s === 'esgotada' || s === 'rodando') return false
  if (s === 'parcial' && (linha?.last_run_done_n ?? 0) === 0) return false
  return true
}

/** Quando a tarefa rodou pela última vez (ms); sem registro, 0: a mais antiga de todas. */
function execucaoMs(linha: LinhaTarefa | null): number {
  const t = linha?.started_at ? Date.parse(linha.started_at) : Number.NaN
  return Number.isNaN(t) ? 0 : t
}

export async function despachar(d: EntradaDespacho): Promise<ResumoDisparo> {
  const problemas: string[] = []
  const notas: string[] = []
  const finais = new Map<string, EstadoFinalTarefa>()
  const catalogo = [...d.catalogo].sort((a, b) => a.ordem - b.ordem)

  const relatar = (tarefa: string, o: { codigo: string; tecnico?: { classe: string; sqlstate: string | null } }): void => {
    try { d.ops.relatar(tarefa, o) } catch { /* o relato nunca derruba o disparo */ }
  }
  const adiar = async (t: Tarefa, chave: string, motivo: 'sem_tempo' | 'uma_pesada_por_disparo'): Promise<void> => {
    try { await d.ops.adiar({ task: t.nome, period_key: chave, motivo }) } catch { /* adiar nunca lança */ }
  }
  const marcar = (t: Tarefa, f: Omit<EstadoFinalTarefa, 'tarefa'>): void => { finais.set(t.nome, { tarefa: t.nome, ...f }) }

  const estadoLido: EstadoAgenda | null = 'porque' in d.estado ? null : d.estado.valor
  if ('porque' in d.estado) problemas.push(`não foi possível ler o estado da agenda (${d.estado.porque})`)

  // 1. Quem é devido. O período e a hora são os do começo do disparo (o mesmo instante com que o estado foi lido).
  const hora = horaSP(d.t0)
  const devidas: Devida[] = []
  for (const t of catalogo) {
    if (d.desligadas.has(t.nome)) { marcar(t, { estado: 'desligada', ms: 0, feitas: null, deixadas: null }); continue }
    if (t.aPartirDaHoraSP !== undefined && hora < t.aPartirDaHoraSP) { marcar(t, { estado: 'nao_devida', ms: 0, feitas: null, deixadas: null }); continue }
    const chave = chaveDoPeriodo(t.periodo, d.t0)
    const linha = estadoLido?.tarefas.find(l => l.task === t.nome && l.period_key === chave) ?? null
    if (linha?.status === 'esgotada') {
      // a tomada não reabre `esgotada`: tratá-la como devida faria a recusa virar "ocupada", um verde
      marcar(t, { estado: 'esgotada', ms: 0, feitas: null, deixadas: null })
      problemas.push(`${t.rotulo}: esgotou as ${t.tetoTentativas} tentativas do período`)
      continue
    }
    if (linha?.status === 'ok') {
      let pelaDado = false
      if (t.devidaPeloDado) {
        try { pelaDado = t.devidaPeloDado({ linhas: d.contexto.linhas, agora: d.agora }) === true } catch (err) {
          relatar(t.nome, { codigo: 'excecao', tecnico: resumoTecnico(err) })
          notas.push(`${t.rotulo}: não foi possível avaliar se há dado novo`)
        }
      }
      if (!pelaDado) { marcar(t, { estado: 'nao_devida', ms: 0, feitas: null, deixadas: null }); continue }
      devidas.push({ t, chave, linha, reabrir: true })
      continue
    }
    devidas.push({ t, chave, linha, reabrir: false })
  }

  // 2. A vaga da pesada (N5): uma só por disparo.
  const pesadas = devidas.filter(x => x.t.peso === 'pesada')
  let escolhida: Devida | null = null
  if (pesadas.length > 0) {
    const candidatas = pesadas.filter(p => !(p.t.cedeA ?? []).some(nome => {
      const outra = devidas.find(x => x.t.nome === nome)
      return outra !== undefined && sa(outra.linha)
    }))
    const lista = candidatas.length > 0 ? candidatas : pesadas
    lista.sort((a, b) => {
      const sa1 = sa(a.linha), sa2 = sa(b.linha)
      if (sa1 !== sa2) return sa1 ? -1 : 1
      const porData = sa1
        ? inicioDoPeriodo(a.t.periodo, d.t0) - inicioDoPeriodo(b.t.periodo, d.t0)
        : execucaoMs(a.linha) - execucaoMs(b.linha)
      return porData !== 0 ? porData : a.t.ordem - b.t.ordem
    })
    escolhida = lista[0] ?? null
    for (const p of pesadas) {
      if (p === escolhida) continue
      await adiar(p.t, p.chave, 'uma_pesada_por_disparo')
      marcar(p.t, { estado: 'adiada', ms: 0, feitas: null, deixadas: null, motivo: 'uma_pesada_por_disparo' })
    }
  }

  // 3. A execução: as sempre, as leves, a pesada escolhida.
  const executar = async (x: Devida): Promise<void> => {
    const { t, chave, linha } = x
    const decorrido = d.agora() - d.t0
    const semTempo = decorrido > t.comecaAteMs || (t.peso === 'leve' && decorrido >= LEVE_COMECA_ATE_MS)
    if (semTempo) {
      await adiar(t, chave, 'sem_tempo')
      marcar(t, { estado: 'adiada', ms: 0, feitas: null, deixadas: null, motivo: 'sem_tempo' })
      const n = (linha?.unfinished_n ?? 0) + 1
      if (t.naoTerminouVermelhoEm !== null && n >= t.naoTerminouVermelhoEm) problemas.push(`${t.rotulo}: ${n} disparos seguidos sem terminar`)
      return
    }

    let tomada: Lido<boolean>
    try { tomada = await d.ops.tomar({ task: t.nome, period_key: chave, teto: t.tetoTentativas, reabrir: x.reabrir }) } catch { tomada = { porque: P_SEM_RESPOSTA } }
    if ('porque' in tomada) return naoTomada(t, tomada.porque)
    if (!tomada.valor) {
      let esgotada: Lido<boolean>
      try { esgotada = await d.ops.esgotar({ task: t.nome, period_key: chave, teto: t.tetoTentativas }) } catch { esgotada = { porque: P_SEM_RESPOSTA } }
      if ('porque' in esgotada) return naoTomada(t, esgotada.porque)
      if (esgotada.valor) {
        marcar(t, { estado: 'esgotada', ms: 0, feitas: null, deixadas: null })
        problemas.push(`${t.rotulo}: esgotou as ${t.tetoTentativas} tentativas do período`)
      } else {
        marcar(t, { estado: 'ocupada', ms: 0, feitas: null, deixadas: null })
        notas.push(`${t.rotulo}: outro disparo está com ela`)
      }
      return
    }

    const inicio = d.agora()
    const r = await executarTarefa(t, inicio)
    const ms = Math.max(0, Math.round(d.agora() - inicio))
    const detalhe = soNumeros(r.detalhe)
    const fecho = {
      task: t.nome, period_key: chave, estado: r.estado, feitas: r.feitas, deixadas: r.deixadas, ms,
      ...(r.motivo !== undefined ? { motivo: r.motivo } : {}),
      ...(detalhe !== undefined ? { detalhe } : {}),
    }
    let fechada: Lido<boolean>
    try { fechada = await d.ops.fechar(fecho) } catch { fechada = { porque: P_SEM_RESPOSTA } }
    if ('porque' in fechada || fechada.valor !== true) {
      // o resultado não foi gravado: a linha fica `rodando`; é nota e é problema, nunca sucesso
      const porque = 'porque' in fechada ? fechada.porque : 'o banco não aceitou o fecho'
      notas.push(`${t.rotulo}: não foi possível gravar o fecho`)
      problemas.push(`${t.rotulo}: não foi possível gravar o fecho (${porque})`)
    }
    marcar(t, {
      estado: r.estado, ms, feitas: r.feitas, deixadas: r.deixadas,
      ...(r.motivo !== undefined ? { motivo: r.motivo } : {}),
      ...(detalhe !== undefined ? { detalhe } : {}),
      ...(r.extra !== undefined ? { extra: r.extra } : {}),
    })

    if (r.estado === 'erro') {
      problemas.push(fraseDoMotivo(t, r.motivo, detalhe))
    } else if (r.estado === 'parcial' && t.naoTerminouVermelhoEm !== null) {
      const n = (linha?.unfinished_n ?? 0) + 1
      if (n >= t.naoTerminouVermelhoEm) {
        problemas.push(`${t.rotulo}: ${n} disparos seguidos sem terminar${r.deixadas !== null ? ` (ficaram ${r.deixadas})` : ''}`)
      }
    }
  }

  const naoTomada = (t: Tarefa, porque: string): void => {
    marcar(t, { estado: 'erro', ms: 0, feitas: null, deixadas: null, motivo: 'tomada_falhou' })
    problemas.push(`${fraseDoMotivo(t, 'tomada_falhou')} (${porque})`)
  }

  /** Roda a tarefa com prazo e devolve sempre um resultado válido; exceção, prazo e forma errada viram `erro` com código. */
  const executarTarefa = async (t: Tarefa, inicio: number): Promise<ResultadoTarefa & { feitas: number }> => {
    const erro = (motivo: string): ResultadoTarefa => ({ estado: 'erro', feitas: 0, deixadas: null, motivo })
    const restante = d.t0 + t.fimAteMs - inicio
    let bruto: ResultadoTarefa
    if (!(restante > 0)) {
      bruto = erro('passou_do_tempo')
    } else {
      try {
        const corrida = await comPrazo((async () => t.rodar(d.contexto))(), restante)
        // a promessa abandonada pode terminar depois; as gravações dela são idempotentes e o fecho dela é este
        bruto = 'estourou' in corrida ? erro('passou_do_tempo') : corrida.valor
      } catch (err) {
        relatar(t.nome, { codigo: 'excecao', tecnico: resumoTecnico(err) })
        bruto = erro('excecao')
      }
    }
    return normalizar(t, bruto)
  }

  const normalizar = (t: Tarefa, bruto: ResultadoTarefa): ResultadoTarefa & { feitas: number } => {
    const forma = typeof bruto === 'object' && bruto !== null && typeof bruto.estado === 'string' && ESTADOS_DO_RESULTADO.has(bruto.estado)
    if (!forma) {
      relatar(t.nome, { codigo: 'motivo_desconhecido' })
      return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'motivo_desconhecido' }
    }
    const feitas = inteiroNaoNegativo(bruto.feitas) ?? 0
    const deixadas = bruto.deixadas === null ? null : inteiroNaoNegativo(bruto.deixadas)
    let motivo: string | undefined
    if (bruto.motivo !== undefined) {
      motivo = codigoDoMotivo(t, bruto.motivo)
      if (motivo === 'motivo_desconhecido' && bruto.motivo !== 'motivo_desconhecido') relatar(t.nome, { codigo: 'motivo_desconhecido' })
    } else if (bruto.estado === 'erro') {
      motivo = 'motivo_desconhecido'
      relatar(t.nome, { codigo: 'motivo_desconhecido' })
    }
    return {
      estado: bruto.estado, feitas, deixadas,
      ...(motivo !== undefined ? { motivo } : {}),
      ...(bruto.detalhe !== undefined ? { detalhe: bruto.detalhe } : {}),
      ...(bruto.extra !== undefined ? { extra: bruto.extra } : {}),
    }
  }

  const fila: Devida[] = [
    ...devidas.filter(x => x.t.peso === 'sempre'),
    ...devidas.filter(x => x.t.peso === 'leve'),
    ...(escolhida ? [escolhida] : []),
  ]
  for (const x of fila) await executar(x)

  const tarefas = catalogo.map(t => finais.get(t.nome)).filter((f): f is EstadoFinalTarefa => f !== undefined)
  return { tarefas, problemas, notas }
}
