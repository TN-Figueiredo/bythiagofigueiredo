// A5 · E14, Tarefa 9: a tarefa `retratos_comentarios`. Lê o que está devido, chama a API, normaliza, escolhe até 12 comentários
// por vídeo, grava (uma transação por retrato) e prova no fim.
//
// Este arquivo só tem CÓDIGOS e números: nenhuma frase para o dono (a frase sai de `fraseDe`, em `frases.ts`).
// DADO PESSOAL: nome, id de canal e texto de comentário de terceiros nunca entram em número, código, relato nem exceção.
import { recordQuota } from '@/lib/youtube/competitor-quota'
import { criarApi, type ApiComentarios } from './api'
import { ComentariosErro, codigoDe } from './erro'
import { agregadosDoLote, loteDe, porIdDe } from './normalizar'
import { desconhecidos, destaqueDe, inscritosDe, quemConsultar } from './destaque'
import { gravarRetrato, lerCadastro, lerDevidos, lerGuardados, lerProva, montarPacote } from './gravar'
import { veredito } from './prova'
import {
  CODIGOS_EXECUCAO, COMMENT_RULES, COMMENT_SINCE, MOTIVOS, MOTIVOS_PASSAGEIROS,
} from './regras'
import { relatarComentarios } from './relato'
import { selecionar } from './selecao'
import type {
  CodigoExecucao, Destaque, Devido, EstadoRetrato, Motivo, ProvaComentarios, TarefaCtx, TarefaSaida,
} from './tipos'

type Cadastro = { acompanhados: Map<string, string>; proprios: Set<string> }
type Guardado = { youtubeId: string; topo: boolean }
type PorId = NonNullable<ReturnType<typeof porIdDe>>
type Falha = 'leitura' | 'banco'

const HORA_MS = 3_600_000

/** Tudo o que a execução conta. Só números; as chaves de `numeros` saem daqui. */
interface Placar {
  devidos: number; feitos: number; ficaram: number; ok: number; sem_comentarios: number; desligados: number; erros: number
  descartados: number; conferencias_falhas: number; conferencias_nao_feitas: number; consultas_de_autor_falhas: number
  ausentes_marcados: number; fora_da_tolerancia: number; erros_de_gravacao: number; inesperados: number; unidades: number
  ja_existe: number; video_ausente: number; falhas_passageiras: number; ms: number; vermelhos: number
}

function novoPlacar(): Placar {
  return {
    devidos: 0, feitos: 0, ficaram: 0, ok: 0, sem_comentarios: 0, desligados: 0, erros: 0, descartados: 0,
    conferencias_falhas: 0, conferencias_nao_feitas: 0, consultas_de_autor_falhas: 0, ausentes_marcados: 0,
    fora_da_tolerancia: 0, erros_de_gravacao: 0, inesperados: 0, unidades: 0, ja_existe: 0, video_ausente: 0,
    falhas_passageiras: 0, ms: 0, vermelhos: 0,
  }
}

const ehMotivo = (c: string): c is Motivo => (MOTIVOS as readonly string[]).includes(c)
const ehPassageiro = (c: string): boolean => (MOTIVOS_PASSAGEIROS as readonly string[]).includes(c)
const ehParada = (c: string): boolean => c === 'cota_esgotada' || c === 'limite_de_taxa'

function blocos<T>(lista: T[], tamanho: number): T[][] {
  const saida: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) saida.push(lista.slice(i, i + tamanho))
  return saida
}

/** Só `ComentariosErro` vira resultado; qualquer outra coisa lançada é defeito e sobe (o laço conta como inesperado). */
async function tentar<T>(f: () => Promise<T>): Promise<{ ok: true; v: T } | { ok: false; codigo: string }> {
  try {
    return { ok: true, v: await f() }
  } catch (e) {
    if (e instanceof ComentariosErro) return { ok: false, codigo: e.codigo }
    throw e
  }
}

/** Passa a ordem de `CODIGOS_EXECUCAO`: o primeiro vermelho é o motivo. */
function motivoMaisComum(contagem: Map<string, number>): number | null {
  let melhor: { motivo: string; n: number; indice: number } | null = null
  for (const [motivo, n] of contagem) {
    const i = (MOTIVOS as readonly string[]).indexOf(motivo)
    const indice = i < 0 ? MOTIVOS.length : i
    if (melhor === null || n > melhor.n || (n === melhor.n && indice < melhor.indice)) melhor = { motivo, n, indice }
  }
  return melhor === null ? null : melhor.indice
}

function saidaCedo(p: Placar, ms: number, motivo: CodigoExecucao, extra: Record<string, number> = {}): TarefaSaida {
  return { status: 'erro', feitos: 0, ficaram: 0, motivo, numeros: { ...p, ...extra, ms, vermelhos: 1 } }
}

export async function runRetratosComentarios(ctx: TarefaCtx): Promise<TarefaSaida> {
  const r = COMMENT_RULES
  const p = novoPlacar()
  const decorrido = (): number => ctx.now() - ctx.inicioMs

  // 0. o início da coleta ainda não foi decidido: nada é lido, nada é chamado
  const since = COMMENT_SINCE
  if (since === 'a_decidir') return saidaCedo(p, 0, 'inicio_nao_decidido')
  const siteFiltro = ctx.siteId ?? null

  // 1. a prova do começo (e a guarda de schema)
  const inicioProva = await lerProva(ctx.sb, { siteId: siteFiltro, nowIso: new Date(ctx.now()).toISOString(), since })
  if (!inicioProva.ok) {
    return inicioProva.motivo === 'prova_ilegivel'
      ? saidaCedo(p, decorrido(), 'prova_ilegivel', { na_guarda: 1 })
      : saidaCedo(p, decorrido(), 'schema_ausente')
  }
  const comecou = veredito(inicioProva.prova, { filaZerada: false })
  if (comecou.vermelhos.some((v) => v.codigo === 'identidade_vencida')) {
    return saidaCedo(p, decorrido(), 'identidade_vencida', comecou.numeros)
  }
  const vermelhos = new Set<CodigoExecucao>()
  // invariante quebrada no começo: anota e segue (a decisão é da Tarefa 10)
  if (comecou.vermelhos.some((v) => v.codigo === 'identidade_invariante')) vermelhos.add('identidade_invariante')

  // 2. o que está devido
  const dev = await lerDevidos(ctx.sb, { nowIso: new Date(ctx.now()).toISOString(), since, siteId: siteFiltro })
  if (dev === null) return saidaCedo(p, decorrido(), 'lista_de_devidos_ilegivel', comecou.numeros)
  p.devidos = dev.total
  const prazo = (d: Devido): number => {
    const ms = Date.parse(d.deadline)
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY
  }
  const linhas = [...dev.linhas].sort((a, b) => prazo(a) - prazo(b))

  // 3. o cadastro, uma vez por site
  const sites = [...new Set(linhas.map((l) => l.siteId))]
  const cadastros = new Map<string, Cadastro>()
  if (sites.length > 0) {
    const lidos = await Promise.all(sites.map((s) => lerCadastro(ctx.sb, s)))
    for (let i = 0; i < sites.length; i++) {
      const c = lidos[i]
      if (c === null || c === undefined) return saidaCedo(p, decorrido(), 'cadastro_ilegivel', comecou.numeros)
      cadastros.set(sites[i] as string, c)
    }
  }

  const api: ApiComentarios = criarApi({
    apiKey: ctx.apiKey, timeoutMs: r.callTimeoutMs,
    ...(ctx.fetchImpl ? { fetchImpl: ctx.fetchImpl } : {}),
    ...(ctx.apiBase ? { base: ctx.apiBase } : {}),
  })

  const porSite = new Map<string, { unidades: number; retratos: number; erros: number }>()
  for (const s of sites) porSite.set(s, { unidades: 0, retratos: 0, erros: 0 })
  const leituras = new Map<string, number>() // motivo -> falhas de leitura passageiras gravadas
  let falhas: Falha[] = [] // as seguidas, para o disjuntor
  const st = { cotaAcabou: false, disjuntor: false, disjuntorComLeitura: false, inscritosTentadas: 0, conferenciasTentadas: 0 }

  const relatar = (codigo: string, marco: number): void => relatarComentarios('coletar', codigo, { marco })

  /** Um vídeo. Devolve `false` quando a execução deve parar SEM ter gravado este (o vídeo conta em `ficaram`). */
  async function umRetrato(d: Devido, cad: Cadastro, unidadesAntes: number): Promise<boolean> {
    const sit: { estado: EstadoRetrato; motivo: Motivo | undefined } = { estado: 'erro', motivo: undefined }
    let lote: NonNullable<ReturnType<typeof loteDe>> | undefined
    let escolhidos: ReturnType<typeof selecionar> | undefined
    let agregados: ReturnType<typeof agregadosDoLote> | undefined
    let consulta: { n: number | null; desconhecidos: number } = { n: null, desconhecidos: 0 }
    let guardados: Guardado[] | undefined
    const achados: PorId = new Map()
    const ausentes: string[] = []
    let conferenciaFalhou = false

    const falhaDoVideo = (codigo: string, fallback: Motivo): void => {
      sit.estado = 'erro'
      sit.motivo = ehMotivo(codigo) ? codigo : fallback
    }

    const conv = await tentar(() => api.conversas(d.youtubeVideoId))
    if (!conv.ok) {
      if (ehParada(conv.codigo)) { st.cotaAcabou = true; return false }
      if (conv.codigo === 'comentarios_desligados') sit.estado = 'desligados'
      else falhaDoVideo(conv.codigo, 'http_4xx')
    } else {
      lote = loteDe(conv.v, d.channelYoutubeId) ?? undefined
      if (lote === undefined) {
        falhaDoVideo('resposta_sem_lista', 'resposta_sem_lista')
      } else {
        p.descartados += lote.descartadas
        if (lote.conversas.length === 0 && lote.descartadas > 0) {
          falhaDoVideo('lote_ilegivel', 'lote_ilegivel')
        } else if (lote.conversas.length === 0) {
          // lista vazia: a contagem de agora decide (nunca a guardada); so a contagem lida 0 vira sem_comentarios
          const cont = await tentar(() => api.contagem(d.youtubeVideoId))
          if (!cont.ok) {
            if (ehParada(cont.codigo)) { st.cotaAcabou = true; return false }
            falhaDoVideo('contagem_nao_lida', 'contagem_nao_lida')
          } else if (cont.v === null) {
            falhaDoVideo('contagem_ausente', 'contagem_ausente')
          } else if (cont.v === 0) {
            sit.estado = 'sem_comentarios'
          } else {
            falhaDoVideo('lista_vazia_com_contagem', 'lista_vazia_com_contagem')
          }
        } else {
          sit.estado = 'ok'
          agregados = agregadosDoLote(lote, Date.parse(d.t0))
          // 7. quem é consultado e quem é destaque
          const quem = quemConsultar(lote.conversas, { canalDoVideo: d.channelYoutubeId, acompanhados: cad.acompanhados, proprios: cad.proprios })
          let inscritos: ReturnType<typeof inscritosDe> = null
          if (quem.ids.length === 0) {
            consulta = { n: 0, desconhecidos: quem.semId }
          } else {
            st.inscritosTentadas += 1
            if (!st.cotaAcabou) {
              const ins = await tentar(() => api.inscritos(quem.ids))
              if (ins.ok) inscritos = inscritosDe(ins.v, quem.ids)
              else if (ehParada(ins.codigo)) st.cotaAcabou = true
            }
            if (inscritos === null) p.consultas_de_autor_falhas += 1
            consulta = { n: inscritos === null ? null : quem.ids.length, desconhecidos: desconhecidos(quem.ids, inscritos) + quem.semId }
          }
          const base = d.channelSubscribersHidden === true ? null : d.channelSubscribers
          const destaques = new Map<string, Destaque>()
          for (const c of lote.conversas) {
            const dest = destaqueDe(c, {
              canalDoVideo: d.channelYoutubeId, acompanhados: cad.acompanhados, proprios: cad.proprios,
              inscritosDoCanalDoVideo: base, inscritos,
            })
            if (dest !== null) destaques.set(c.id, dest)
          }
          escolhidos = selecionar(lote.conversas, destaques)

          // 8. marcos 7 e 30: conferir por id o que ja estava guardado e nao veio no lote
          if (d.mark !== 1 && d.storedN > 0) {
            let lidos: Guardado[] | null = null
            try {
              lidos = await lerGuardados(ctx.sb, d.videoId)
            } catch (e) {
              if (!(e instanceof ComentariosErro)) throw e
              relatar(e.codigo, d.mark)
            }
            if (lidos === null) {
              // nao li: a conferencia FALHOU, nunca "lista vazia"; nenhum guardado vira ausente
              st.conferenciasTentadas += 1
              p.conferencias_falhas += 1
              conferenciaFalhou = true
            } else {
              guardados = lidos
              const vistos = new Set<string>()
              for (const c of lote.conversas) {
                vistos.add(c.id)
                for (const resp of c.respostasDoCriador) vistos.add(resp.id)
              }
              const alvo = lidos.map((g) => g.youtubeId).filter((id) => !vistos.has(id))
              const todos = blocos(alvo, r.checkChunk)
              p.conferencias_nao_feitas += todos.slice(r.checkBlocksMax).reduce((a, b) => a + b.length, 0)
              for (const bloco of todos.slice(0, r.checkBlocksMax)) {
                st.conferenciasTentadas += 1
                let achou: PorId | null = null
                if (!st.cotaAcabou) {
                  const res = await tentar(() => api.porId(bloco))
                  if (res.ok) achou = porIdDe(res.v)
                  else if (ehParada(res.codigo)) st.cotaAcabou = true
                }
                if (achou === null) {
                  p.conferencias_falhas += 1
                  conferenciaFalhou = true
                  continue
                }
                for (const id of bloco) {
                  const v = achou.get(id)
                  if (v === undefined) ausentes.push(id)
                  else achados.set(id, v)
                }
              }
            }
          }
        }
      }
    }

    // 9. a idade na hora da escrita: passou da tolerancia, o banco nem e chamado
    const tirado = ctx.now()
    const janela = r.marks.find((m) => m.mark === d.mark)
    const idadeH = (tirado - Date.parse(d.t0)) / HORA_MS
    if (janela !== undefined && idadeH > janela.untilH) {
      p.fora_da_tolerancia += 1
      return true
    }

    // 10. o pacote e a escrita
    const pacote = montarPacote({
      devido: d, tiradoEm: new Date(tirado).toISOString(), estado: sit.estado,
      ...(sit.motivo !== undefined ? { motivo: sit.motivo } : {}),
      ...(lote !== undefined ? { lote } : {}),
      ...(escolhidos !== undefined ? { escolhidos } : {}),
      ...(guardados !== undefined ? { guardados } : {}),
      ...(achados.size > 0 ? { porId: achados } : {}),
      ausentes, consulta, ...(agregados !== undefined ? { agregados } : {}),
      conferenciaFalhou, unidades: api.unidades() - unidadesAntes,
    })
    const g = await gravarRetrato(ctx.sb, d.videoId, d.mark, pacote)
    if (!g.ok) {
      if (g.codigo === 'tolerancia_incoerente') {
        // defeito nosso (o banco nem foi chamado): o retrato fica devido
        p.inesperados += 1
        relatar('tolerancia_incoerente', d.mark)
        return true
      }
      p.erros_de_gravacao += 1
      falhas.push('banco')
      relatar(g.codigo, d.mark)
      return true
    }
    const res = g.resultado
    if (res.status === 'ja_existe') { p.ja_existe += 1; return true }
    if (res.status === 'video_ausente') { p.video_ausente += 1; return true }
    if (res.status === 'fora_da_tolerancia') { p.fora_da_tolerancia += 1; return true }
    p.feitos += 1
    p.ausentes_marcados += res.ausentes_marcados ?? 0
    const site = porSite.get(d.siteId)
    if (site !== undefined) site.retratos += 1
    if (sit.estado === 'ok') p.ok += 1
    else if (sit.estado === 'sem_comentarios') p.sem_comentarios += 1
    else if (sit.estado === 'desligados') p.desligados += 1
    else {
      p.erros += 1
      if (site !== undefined) site.erros += 1
    }
    if (sit.estado === 'erro' && sit.motivo !== undefined && ehPassageiro(sit.motivo)) {
      leituras.set(sit.motivo, (leituras.get(sit.motivo) ?? 0) + 1)
      falhas.push('leitura')
    } else {
      falhas = []
    }
    return true
  }

  // 4 a 13: o laco, com a cota gravada num finally que cobre tudo
  let cota = { falhou: false, unidades: 0 }
  try {
    for (let i = 0; i < linhas.length; i++) {
      const d = linhas[i] as Devido
      const agora = ctx.now()
      const reserva = d.mark === 1 ? 2 : 2 + Math.min(Math.ceil(d.storedN / r.checkChunk), r.checkBlocksMax)
      if (agora - ctx.inicioMs >= r.startBudgetMs || agora - ctx.t0 >= r.lastSnapStartsByMs || api.unidades() + reserva > r.callsMax) {
        p.ficaram += linhas.length - i
        break
      }
      const unidadesAntes = api.unidades()
      let seguir = true
      try {
        seguir = await umRetrato(d, cadastros.get(d.siteId) as Cadastro, unidadesAntes)
      } catch (e) {
        p.inesperados += 1
        relatar(codigoDe(e), d.mark)
      } finally {
        const site = porSite.get(d.siteId)
        if (site !== undefined) site.unidades += api.unidades() - unidadesAntes
      }
      if (!seguir) { p.ficaram += linhas.length - i; break }
      if (st.cotaAcabou) { p.ficaram += linhas.length - i - 1; break }
      if (falhas.length >= r.breakerAfter) {
        st.disjuntor = true
        st.disjuntorComLeitura = falhas.includes('leitura')
        p.ficaram += linhas.length - i - 1
        break
      }
    }
    p.ficaram += Math.max(0, dev.total - linhas.length)
  } finally {
    p.unidades = api.unidades()
    cota = await registrarCota()
  }

  /** Por site, todos em paralelo, numa corrida contra o tempo da ida ao banco. Nunca lança. */
  async function registrarCota(): Promise<{ falhou: boolean; unidades: number }> {
    let nowMs = ctx.inicioMs
    try { nowMs = ctx.now() } catch { /* o relogio falhou: o dia do inicio serve */ }
    let timer: ReturnType<typeof setTimeout> | undefined
    const corte = new Promise<never>((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error('tempo')), r.dbTimeoutMs) })
    const perdidas = await Promise.all([...porSite].map(async ([siteId, s]): Promise<{ falhou: boolean; unidades: number }> => {
      if (s.unidades === 0 && s.retratos === 0 && s.erros === 0 && p.ficaram === 0) return { falhou: false, unidades: 0 }
      try {
        await Promise.race([
          recordQuota(ctx.sb, {
            siteId, nowMs, units: s.unidades, mode: 'comentarios',
            extra: { comentarios_retratos: s.retratos, comentarios_erros: s.erros },
            max: { comentarios_ficaram: p.ficaram },
          }),
          corte,
        ])
        return { falhou: false, unidades: 0 }
      } catch {
        return { falhou: true, unidades: s.unidades }
      }
    }))
    clearTimeout(timer)
    return { falhou: perdidas.some((x) => x.falhou), unidades: perdidas.reduce((a, x) => a + x.unidades, 0) }
  }

  // 12. a prova do fim (a do comeco, se nada era devido) e o veredito
  const filaZerada = p.ficaram === 0 && !st.cotaAcabou && !st.disjuntor && p.erros_de_gravacao === 0 && p.inesperados === 0
  let fim: ProvaComentarios | null = null
  if (linhas.length === 0) {
    fim = inicioProva.prova
  } else {
    const lida = await lerProva(ctx.sb, { siteId: siteFiltro, nowIso: new Date(ctx.now()).toISOString(), since })
    if (lida.ok) fim = lida.prova
    else vermelhos.add(lida.motivo)
  }
  const numeros: Record<string, number> = { ...p, ...comecou.numeros }
  if (fim !== null) {
    const v = veredito(fim, { filaZerada })
    for (const x of v.vermelhos) vermelhos.add(x.codigo)
    Object.assign(numeros, v.numeros)
    // a invariante quebrada no comeco continua contada, ainda que o fim a mostre consertada
    for (const k of ['identidade_vencida', 'identidade_prazo_errado', 'identidade_de_criador', 'respostas_de_terceiros']) {
      numeros[k] = Math.max(comecou.numeros[k] ?? 0, v.numeros[k] ?? 0)
    }
  }

  // o estado da execucao
  if (st.cotaAcabou) vermelhos.add('cota_esgotada')
  if (cota.falhou) {
    vermelhos.add('cota_nao_registrada')
    numeros.unidades_nao_registradas = cota.unidades
  }
  if (p.inesperados > 0) vermelhos.add('inesperado')
  let totalLeituras = 0
  for (const n of leituras.values()) totalLeituras += n
  numeros.falhas_passageiras = totalLeituras + p.erros_de_gravacao
  if (totalLeituras > 0) {
    vermelhos.add('falhas_passageiras')
    const mais = motivoMaisComum(leituras)
    if (mais !== null) numeros.motivo_mais_comum = mais
  } else if (p.erros_de_gravacao > 0) {
    vermelhos.add('banco')
  }
  if (st.disjuntor && st.disjuntorComLeitura) vermelhos.add('disjuntor')
  if (st.inscritosTentadas >= 3 && p.consultas_de_autor_falhas === st.inscritosTentadas) vermelhos.add('consulta_de_autores_falhou')
  if (st.conferenciasTentadas >= 3 && p.conferencias_falhas === st.conferenciasTentadas) vermelhos.add('conferencia_falhou')

  const ordem = CODIGOS_EXECUCAO.filter((c) => vermelhos.has(c))
  numeros.vermelhos = ordem.length
  numeros.ms = decorrido()
  const primeiro = ordem[0]
  if (primeiro !== undefined) return { status: 'erro', feitos: p.feitos, ficaram: p.ficaram, motivo: primeiro, numeros }
  return { status: p.ficaram > 0 ? 'parcial' : 'ok', feitos: p.feitos, ficaram: p.ficaram, numeros }
}
