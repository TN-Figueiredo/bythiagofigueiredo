import { normalizarTitulo } from '../normalizar-titulo'
import { APRENDENDO_DIAS, JANELA_DIAS, avaliarDegradacao, diaBrtAnterior, type Avaliacao, type LeituraDia } from './alarme'
import { estadoMiniatura, estadoTitulo, FRESCOR_MS, lerCursor, lerLinha, type EntradaEstado, type EstadoMiniatura, type EstadoTitulo } from './estado-de-leitura'
import { ehPlaceholder, inferirComGuarda, titulosSuspensos, type ConferirVersoes } from './guarda'
import { gravacao, type LeituraObs, type ThumbObs, type VersaoParaConferir } from './inferir'
import { textoMiniatura, textoTitulo } from './textos'

/** Uma leitura do export (replay da CI e ensaio a seco, §8.0): colunas de `yt_watch_readings` + miniatura + alvo. */
export interface LinhaExport {
  yt: string; rodada_id: string; lida_em: string; http: number | null; erro: string | null; jogador_bloqueado: boolean
  idioma: string | null; titulo_exibido: string | null; thumb_http: number | null; dhash: string | null; variante: string | null
  largura: number | null; altura: number | null; publicado_em: string | null
  canal?: string | null; saiu_em?: string | null; saiu_por?: string | null; alvo_rodadas?: number | null; ultima_rodada_em?: string | null
}
export interface FixtureColunar { fonte: string; agora: string; colunas: (keyof LinhaExport)[]; linhas: unknown[][] }
export interface AlvoExport {
  ytId: string; canal: string | null; publicadoEm: Date | null; saiuEm: string | null; saiuPor: string | null
  leituras: LeituraObs[]; thumbsPorId: Map<number, ThumbObs>; rodadas: number; ultimaRodadaEm: string | null
  /** O export trouxe `alvo_rodadas`/`saiu_em` (SQL de produção); a fixture de CI não traz. */
  temColunasDoAlvo?: boolean
}

/** '2026-10-19 01:20:55.353+00' (ou '+00:00') -> '2026-10-19T01:20:55.353Z'. Pela Date, nunca por troca de texto. */
export function isoDoBanco(s: string): string {
  return new Date(s.replace(' ', 'T').replace(/\+00(:00)?$/, 'Z')).toISOString()
}

export function linhasDaFixture(f: FixtureColunar): LinhaExport[] {
  return f.linhas.map(v => {
    const o: Record<string, unknown> = {}
    f.colunas.forEach((c, i) => { o[c] = v[i] ?? null })
    return o as unknown as LinhaExport
  })
}

const ilegivel = (): Error => new Error('export ilegível: rode a consulta com --agent=no (sem isso a CLI devolve o envelope de agente) e confira o arquivo')
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Aceita: array de linhas, `[{ json_agg: [...] }]` (envelope da CLI), `{ rows: [...] }` e o colunar `{ colunas, linhas }`. */
export function extrairLinhas(texto: string): LinhaExport[] {
  let j: unknown
  try { j = JSON.parse(texto) } catch { throw ilegivel() }
  const desembrulhar = (v: unknown): LinhaExport[] => {
    if (ehObjeto(v)) {
      if (Array.isArray(v.colunas) && Array.isArray(v.linhas)) return linhasDaFixture(v as unknown as FixtureColunar)
      if (Array.isArray(v.rows)) return desembrulhar(v.rows)
      if ('json_agg' in v) return desembrulhar(typeof v.json_agg === 'string' ? JSON.parse(v.json_agg) : v.json_agg)
      throw ilegivel()
    }
    if (!Array.isArray(v)) throw ilegivel()
    if (v.length === 1 && ehObjeto(v[0]) && ('json_agg' in v[0] || 'rows' in v[0])) return desembrulhar(v[0])
    if (!v.every(x => ehObjeto(x) && typeof x.yt === 'string')) throw ilegivel()
    return v as LinhaExport[]
  }
  return desembrulhar(j)
}

export function carregarExport(linhas: readonly LinhaExport[]): Map<string, AlvoExport> {
  const out = new Map<string, AlvoExport>()
  const rodadasPorAlvo = new Map<string, Set<string>>()
  linhas.forEach((l, idx) => {
    let a = out.get(l.yt)
    if (!a) {
      a = { ytId: l.yt, canal: null, publicadoEm: null, saiuEm: null, saiuPor: null, leituras: [], thumbsPorId: new Map(), rodadas: 0, ultimaRodadaEm: null }
      out.set(l.yt, a)
      rodadasPorAlvo.set(l.yt, new Set())
    }
    rodadasPorAlvo.get(l.yt)!.add(l.rodada_id)
    if (a.canal === null && l.canal != null) a.canal = l.canal
    if (a.publicadoEm === null && l.publicado_em) a.publicadoEm = new Date(isoDoBanco(l.publicado_em))
    if (a.saiuEm === null && l.saiu_em) a.saiuEm = l.saiu_em
    if (a.saiuPor === null && l.saiu_por) a.saiuPor = l.saiu_por
    if (l.alvo_rodadas != null) a.rodadas = l.alvo_rodadas
    if (l.ultima_rodada_em) a.ultimaRodadaEm = l.ultima_rodada_em
    let miniaturaId: number | null = null
    if (l.thumb_http !== null) {
      miniaturaId = idx
      a.thumbsPorId.set(idx, { id: idx, variante: l.variante ?? '', http: l.thumb_http, dhash: l.dhash, largura: l.largura, altura: l.altura })
    }
    a.leituras.push({
      id: idx, rodadaId: l.rodada_id, lidaEm: isoDoBanco(l.lida_em), http: l.http, erro: l.erro, jogadorBloqueado: l.jogador_bloqueado,
      idioma: l.idioma, tituloExibido: l.titulo_exibido, miniaturaId,
    })
  })
  for (const a of out.values()) {
    a.leituras.sort((x, y) => Date.parse(x.lidaEm) - Date.parse(y.lidaEm) || x.id - y.id)
    const comOpcionais = linhas.some(l => l.yt === a.ytId && l.alvo_rodadas != null)
    a.temColunasDoAlvo = comOpcionais
    if (!comOpcionais) a.rodadas = rodadasPorAlvo.get(a.ytId)!.size
    if (a.ultimaRodadaEm === null) a.ultimaRodadaEm = a.leituras.at(-1)?.lidaEm ?? null
  }
  return out
}

// ───────────────────────── Ensaio a seco (§8.0) ─────────────────────────

const DIA = 86_400_000
const MIN_RODADAS_ELEGIVEL = 8

export interface LinhaDoEnsaio { ytId: string; titulo: EstadoTitulo; miniatura: EstadoMiniatura; textoTitulo: string; textoMiniatura: string; suspensos: string[] }
export interface RelatorioEnsaio {
  agora: string; alvos: LinhaDoEnsaio[]
  cobertura: { elegiveis: number; tituloMedido: number; miniaturaMedida: number; aprendendo: number; foraDaJanela: number }
  suspensosDoDia: string[]; degradacao: Avaliacao; contaminacao: number
  /** Como "ativo" e "fora da janela" foram decididos (a fixture não traz as colunas do alvo). */
  origemDoAtivo: 'colunas_do_alvo' | 'publicacao_mais_30_dias'
}
interface Vista { ytId: string; tMs: number; canal: string | null }

/**
 * Ensaio a seco: roda a regra real e a guarda sobre o export, grava em memória pela MESMA `gravacao()` do passo e lê de volta por
 * `lerLinha`/`lerCursor` + `estadoTitulo`/`estadoMiniatura`. Nada é gravado em lugar nenhum.
 */
export async function ensaiar(
  alvos: ReadonlyMap<string, AlvoExport>,
  o: { agoraMs: number; gravar?: typeof gravacao },
): Promise<RelatorioEnsaio> {
  const gravar = o.gravar ?? gravacao
  const agoraIso = new Date(o.agoraMs).toISOString()
  const todos = [...alvos.values()]
  const comColunas = todos.some(a => a.temColunasDoAlvo === true)

  // índice único (O(L)): texto bruto -> onde apareceu
  const porBruto = new Map<string, Vista[]>()
  const porNormalizado = new Map<string, Set<string>>()
  for (const a of todos) {
    for (const l of a.leituras) {
      if (l.tituloExibido === null) continue
      const v: Vista = { ytId: a.ytId, tMs: Date.parse(l.lidaEm), canal: a.canal }
      const g = porBruto.get(l.tituloExibido)
      if (g) g.push(v); else porBruto.set(l.tituloExibido, [v])
      const k = normalizarTitulo(l.tituloExibido)
      const s = porNormalizado.get(k)
      if (s) s.add(a.ytId); else porNormalizado.set(k, new Set([a.ytId]))
    }
  }
  const canalDe = (yt: string): string | null => alvos.get(yt)?.canal ?? null
  const conferirDe = (a: AlvoExport): ConferirVersoes => async (vs: readonly VersaoParaConferir[]) => {
    const susp = new Set<string>()
    for (const v of vs) {
      const de = Date.parse(v.primeiraVista) - DIA, ate = Date.parse(v.ultimaVista) + DIA
      const achados: { ytId: string }[] = []
      for (const bruto of v.brutos) for (const x of porBruto.get(bruto) ?? []) if (x.ytId !== a.ytId && x.tMs >= de && x.tMs <= ate) achados.push({ ytId: x.ytId })
      if (ehPlaceholder(achados, { canalDoAlvo: a.canal, canalDe, bateuTeto: false })) susp.add(v.chave)
    }
    return susp
  }

  const linhas: LinhaDoEnsaio[] = []
  const ativos: { ytId: string; publicadoEm: string }[] = []
  let contaminacao = 0
  const cob = { elegiveis: 0, tituloMedido: 0, miniaturaMedida: 0, aprendendo: 0, foraDaJanela: 0 }
  for (const a of todos) {
    const publicadoMs = a.publicadoEm?.getTime() ?? null
    const foraDaJanela = comColunas ? a.saiuPor === 'janela' : publicadoMs !== null && publicadoMs + JANELA_DIAS * DIA <= o.agoraMs
    const saiu = comColunas ? a.saiuEm !== null : foraDaJanela
    const saiuPor = saiu ? (a.saiuPor ?? (foraDaJanela ? 'janela' : 'saiu')) : null
    const aprendendo = publicadoMs !== null && o.agoraMs - publicadoMs < APRENDENDO_DIAS * DIA
    let linhaTitulo = null as ReturnType<typeof lerLinha>
    let linhaMini = null as ReturnType<typeof lerLinha>
    let cursor = null as ReturnType<typeof lerCursor>
    let suspensos: string[] = []
    if (publicadoMs !== null) {
      const g = await inferirComGuarda({ leituras: a.leituras, thumbsPorId: a.thumbsPorId, publicadoEm: a.publicadoEm!, agoraMs: o.agoraMs }, conferirDe(a))
      suspensos = [...g.suspensos]
      const gr = gravar({ r: g.r, estourou: g.estourou }, { agoraIso, rodadas: a.rodadas, saiuPor })
      for (const l of gr.linhas) {
        const lida = lerLinha({ ...l } as unknown as Record<string, unknown>)
        if (l.campo === 'titulo') linhaTitulo = lida; else linhaMini = lida
        if (l.campo === 'titulo') {
          const vistos = new Set(l.trocas.map(t => normalizarTitulo(t.ref)))
          for (const k of vistos) if ([...(porNormalizado.get(k) ?? [])].filter(y => y !== a.ytId).length >= 2) contaminacao++
        }
      }
      cursor = lerCursor({ ...gr.cursor } as unknown as Record<string, unknown>)
    }
    const entrada: EntradaEstado = {
      flagLigada: true,
      alvo: { rodadas: a.rodadas, ultimaRodadaEm: a.ultimaRodadaEm, saiuPor, publicadoEm: a.publicadoEm?.toISOString() ?? null },
      cursor, linhas: { titulo: linhaTitulo, miniatura: linhaMini }, agoraMs: o.agoraMs, frescorMs: FRESCOR_MS,
    }
    const titulo = estadoTitulo(entrada), miniatura = estadoMiniatura(entrada)
    const opcoes = { agoraMs: o.agoraMs, trocaConferida: false }
    linhas.push({ ytId: a.ytId, titulo, miniatura, textoTitulo: textoTitulo(titulo, opcoes), textoMiniatura: textoMiniatura(miniatura, opcoes), suspensos })

    if (foraDaJanela) cob.foraDaJanela++
    else if (saiu) { /* saiu por outro motivo: fora do denominador */ } else if (aprendendo) cob.aprendendo++
    else if (a.rodadas >= MIN_RODADAS_ELEGIVEL) {
      cob.elegiveis++
      if (titulo.estado !== 'nao_medido' && titulo.estado !== 'fora_da_janela') cob.tituloMedido++
      if (miniatura.estado !== 'nao_medido' && miniatura.estado !== 'fora_da_janela') cob.miniaturaMedida++
    }
    if (!saiu && publicadoMs !== null) ativos.push({ ytId: a.ytId, publicadoEm: a.publicadoEm!.toISOString() })
  }

  // suspensos e alarme do dia BRT anterior ao `agora` (mesmas funções do alarme em produção)
  const dia = diaBrtAnterior(o.agoraMs)
  const doDia: LeituraDia[] = []
  const lidas: { ytId: string; canal: string | null; leitura: LeituraObs }[] = []
  for (const a of todos) for (const l of a.leituras) {
    const t = Date.parse(l.lidaEm)
    if (t < dia.inicioMs || t >= dia.fimMs) continue
    doDia.push({ ytId: a.ytId, rodadaId: l.rodadaId, lidaEm: l.lidaEm, http: l.http, erro: l.erro, jogadorBloqueado: l.jogadorBloqueado, tituloExibido: l.tituloExibido, idioma: l.idioma, canal: a.canal })
    lidas.push({ ytId: a.ytId, canal: a.canal, leitura: l })
  }
  return {
    agora: agoraIso, alvos: linhas, cobertura: cob, suspensosDoDia: titulosSuspensos(lidas), degradacao: avaliarDegradacao(ativos, doDia, dia), contaminacao,
    origemDoAtivo: comColunas ? 'colunas_do_alvo' : 'publicacao_mais_30_dias',
  }
}

const pc = (n: number, d: number): string => (d === 0 ? 'n/d' : `${((100 * n) / d).toFixed(1).replace('.', ',')}%`)

export function relatorioEmTexto(r: RelatorioEnsaio): string {
  const c = r.cobertura
  const out: string[] = [
    `Ensaio a seco da leitura dos concorrentes, agora = ${r.agora}`,
    `Alvos no export: ${r.alvos.length} (ativo/fora da janela decidido por: ${r.origemDoAtivo === 'colunas_do_alvo' ? 'colunas do alvo (saiu_em, alvo_rodadas)' : 'publicação + 30 dias, sem as colunas do alvo'})`,
    `Cobertura (elegíveis = ativos, >= ${MIN_RODADAS_ELEGIVEL} rodadas, fora do aprendizado): ${c.elegiveis}`,
    `  título medido: ${c.tituloMedido} (${pc(c.tituloMedido, c.elegiveis)}; entrada >= 90,0%)`,
    `  miniatura medida: ${c.miniaturaMedida} (${pc(c.miniaturaMedida, c.elegiveis)}; entrada >= 80,0%)`,
    `  aprendendo (à parte): ${c.aprendendo}; fora da janela (à parte): ${c.foraDaJanela}`,
    `Contaminação: ${r.contaminacao} (entrada = 0)`,
    `Alarme do dia anterior: ${r.degradacao.dispara ? 'DISPARARIA (' + r.degradacao.condicao + ')' : 'não dispara'}; sem título ${String(r.degradacao.pctSemTitulo).replace('.', ',')}%, alvos sem leitura ${r.degradacao.alvosSemLeitura} de ${r.degradacao.alvosConsiderados}`,
    `Títulos suspensos no dia anterior: ${r.suspensosDoDia.length}${r.suspensosDoDia.length ? ' -> ' + r.suspensosDoDia.slice(0, 20).join(' | ') : ''}`,
    '',
    'Por alvo (estado do título / da miniatura e texto do §11):',
  ]
  for (const l of r.alvos) {
    out.push(`- ${l.ytId}: título ${l.titulo.estado}, miniatura ${l.miniatura.estado}${l.suspensos.length ? `, suspensos: ${l.suspensos.length}` : ''}`)
    out.push(`    ${l.textoTitulo}`)
    out.push(`    ${l.textoMiniatura}`)
  }
  return out.join('\n')
}
