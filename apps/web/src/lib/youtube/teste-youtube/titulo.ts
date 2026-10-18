import { compararCodePoint, normalizarTitulo } from './normalizar-titulo'
import { montarRodadas, type LeituraPreparada, type Rodada } from './preparar'
import type { DetalheInsuficiente, LimiaresDeteccao, MotivoNadaVisivelTitulo } from './tipos'

export interface ContagemTitulo {
  rodadas: number
  rodadasLongas: number
  rodadasMistasTitulo: number
  rodadasEmQuarentena: number
  textosDistintosTitulo: number
  primeiraMistura: string | null
  validasTitulo: number
}

export type ResultadoTitulo = { contagem: ContagemTitulo } & (
  | { estado: 'nao_lido' }
  | { estado: 'insuficiente'; detalhe: Exclude<DetalheInsuficiente, { motivo: 'titulo_nao_lido' }> }
  | { estado: 'nada_visivel'; motivo: MotivoNadaVisivelTitulo; valorUnico?: { titulo: string }; janela: { de: string; ate: string } }
  | {
      estado: 'provavel_teste'
      variantes: string[]
      proporcao: Record<string, number>
      votos: Record<string, number>
      primeiraVista: string
      ultimaVista: string
      janela: { de: string; ate: string }
    }
)

/** O título oficial mais frequente (texto cru); empate: o primeiro pela ordem de desempate. */
export function tituloOficialMaisFrequente(ls: readonly LeituraPreparada[]): string | null {
  const cont = new Map<string, number>()
  for (const p of ls) {
    const t = p.l.tituloOficial
    if (t !== null) cont.set(t, (cont.get(t) ?? 0) + 1)
  }
  let melhor: string | null = null
  let max = 0
  for (const [t, n] of cont) {
    // Map mantém a ordem da 1ª aparição; só uma contagem estritamente maior troca
    if (n > max) {
      melhor = t
      max = n
    }
  }
  return melhor
}

interface Par {
  a: string
  b: string
  rodadas: Rodada[]
  janelaMs: number
}

const iso = (ms: number) => new Date(ms).toISOString()

export function classificarTitulo(ls: readonly LeituraPreparada[], o: LimiaresDeteccao): ResultadoTitulo {
  const rodadas = montarRodadas(ls, o)
  const mistas = rodadas.filter(r => r.mista)
  const votantes = ls.filter(p => p.voto !== null)

  // texto normalizado -> texto cru da 1ª leitura (ordem de desempate); a ordem do Map é a da 1ª aparição
  const cru = new Map<string, string>()
  const votosPorTexto = new Map<string, number>()
  for (const p of votantes) {
    const v = p.voto as string
    if (!cru.has(v)) cru.set(v, p.votoCru as string)
    votosPorTexto.set(v, (votosPorTexto.get(v) ?? 0) + 1)
  }

  const contagem: ContagemTitulo = {
    rodadas: rodadas.length,
    rodadasLongas: rodadas.filter(r => r.longa).length,
    rodadasMistasTitulo: mistas.length,
    rodadasEmQuarentena: rodadas.filter(r => r.emQuarentena).length,
    textosDistintosTitulo: cru.size,
    primeiraMistura: mistas.length > 0 ? mistas[0]!.leituras[0]!.l.lidaEm : null,
    validasTitulo: ls.filter(p => p.leuTitulo).length,
  }

  if (contagem.validasTitulo === 0) return { contagem, estado: 'nao_lido' }
  if (votantes.length < o.minLeituras) {
    return { contagem, estado: 'insuficiente', detalhe: { motivo: 'poucas_leituras', minimo: o.minLeituras, atual: votantes.length } }
  }

  const janela = { de: votantes[0]!.l.lidaEm, ate: votantes[votantes.length - 1]!.l.lidaEm }
  const nada = (motivo: MotivoNadaVisivelTitulo): ResultadoTitulo => ({ contagem, estado: 'nada_visivel', motivo, janela })

  if (cru.size === 1) {
    return { contagem, estado: 'nada_visivel', motivo: 'um_valor_so', valorUnico: { titulo: [...cru.values()][0]! }, janela }
  }
  if (mistas.length === 0) return nada('troca_sem_mistura')

  // Pares: coexistência nas rodadas mistas
  const pares = new Map<string, Par>()
  for (const r of mistas) {
    const textos = [...r.votos.keys()].sort(compararCodePoint)
    for (let i = 0; i < textos.length; i++) {
      for (let j = i + 1; j < textos.length; j++) {
        const chave = JSON.stringify([textos[i], textos[j]])
        const par = pares.get(chave)
        if (par) par.rodadas.push(r)
        else pares.set(chave, { a: textos[i]!, b: textos[j]!, rodadas: [r], janelaMs: 0 })
      }
    }
  }
  const limitesVoto = (r: Rodada) => {
    let de = Infinity
    let ate = -Infinity
    for (const p of r.leituras) {
      if (p.voto === null) continue
      if (p.ms < de) de = p.ms
      if (p.ms > ate) ate = p.ms
    }
    return { de, ate }
  }
  for (const par of pares.values()) {
    const lim = par.rodadas.map(limitesVoto)
    par.janelaMs = Math.max(...lim.map(l => l.ate)) - Math.min(...lim.map(l => l.de))
  }
  const aprovados1 = [...pares.values()].filter(
    p =>
      p.rodadas.length >= o.minRodadasMistas &&
      (votosPorTexto.get(p.a) ?? 0) >= o.minVotosPorVariante &&
      (votosPorTexto.get(p.b) ?? 0) >= o.minVotosPorVariante,
  )
  if (aprovados1.length === 0) return nada('mistura_isolada')

  const ligados = (ps: readonly Par[]): string[] => {
    const set = new Set<string>()
    for (const p of ps) {
      set.add(p.a)
      set.add(p.b)
    }
    return [...cru.keys()].filter(t => set.has(t)) // ordem da 1ª aparição
  }
  const oficial = tituloOficialMaisFrequente(ls)
  const oficialNorm = oficial === null ? null : normalizarTitulo(oficial)
  const ordenarVariantes = (textos: string[]): string[] => {
    const i = oficialNorm === null ? -1 : textos.indexOf(oficialNorm)
    return i > 0 ? [textos[i]!, ...textos.filter((_, k) => k !== i)] : textos
  }

  if (ligados(aprovados1).length > o.maxVariantes) return nada('mistura_atipica')

  const aprovados = aprovados1.filter(p => p.janelaMs >= o.minJanelaMistaMs)
  if (aprovados.length === 0) {
    return {
      contagem,
      estado: 'insuficiente',
      detalhe: {
        motivo: 'janela_curta',
        janelaMs: Math.max(...aprovados1.map(p => p.janelaMs)),
        minimoMs: o.minJanelaMistaMs,
        variantes: ordenarVariantes(ligados(aprovados1)).map(t => cru.get(t) as string),
      },
    }
  }

  // Rodadas mistas dos pares aprovados e span
  const mistasAprovadas = [...new Set(aprovados.flatMap(p => p.rodadas))].sort((a, b) => a.deMs - b.deMs || compararCodePoint(a.chave, b.chave))
  const spanDe = mistasAprovadas[0]!.deMs
  const spanAte = Math.max(...mistasAprovadas.map(r => r.ateMs))
  const noSpan = rodadas.filter(r => r.deMs >= spanDe && r.deMs <= spanAte)
  const ilegiveis = noSpan.filter(r => r.longa || r.emQuarentena).length
  if (ilegiveis > noSpan.length / 2) {
    return { contagem, estado: 'insuficiente', detalhe: { motivo: 'span_ilegivel', ilegiveis, rodadasSpan: noSpan.length } }
  }

  // Fração: mesmo filtro no numerador e no denominador
  const legiveis = noSpan.filter(r => !r.longa && !r.emQuarentena && r.votosValidos >= 3)
  const fracao = legiveis.length === 0 ? 0 : legiveis.filter(r => r.mista).length / legiveis.length
  if (fracao < o.minFracaoRodadasMistas) return nada('mistura_esparsa')

  const textos = ordenarVariantes(ligados(aprovados))
  const votos: Record<string, number> = {}
  let total = 0
  for (const t of textos) {
    const n = votosPorTexto.get(t) ?? 0
    votos[cru.get(t) as string] = n
    total += n
  }
  const proporcao: Record<string, number> = {}
  for (const k of Object.keys(votos)) proporcao[k] = votos[k]! / total
  return {
    contagem,
    estado: 'provavel_teste',
    variantes: textos.map(t => cru.get(t) as string),
    proporcao,
    votos,
    primeiraVista: iso(Math.min(...mistasAprovadas.map(r => r.deMs))),
    ultimaVista: iso(Math.max(...mistasAprovadas.map(r => r.ateMs))),
    janela,
  }
}
