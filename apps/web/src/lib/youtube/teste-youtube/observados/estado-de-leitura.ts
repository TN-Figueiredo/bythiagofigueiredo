import { CADENCIA_H, FRESCOR_H, W_RODADAS } from './inferir'

/** Leitura por campo (§5): o compilador barra o que antes só a asserção barrava. A ausência de linha nunca vira "0 versões" nem "não testou". */
export type Motivo = 'flag_off' | 'aprendendo' | 'sem_leitura' | 'sem_publicacao' | 'saiu' | 'regra'

export interface VersaoLida { ref: string; rodadasEmW: number; ultimaVista: string }

export type EstadoTituloBase =
  /** `passagens` (acréscimo ao §5): rodadas de W usadas na decisão (= `validas_titulo` do cursor), para o texto "8 passagens". */
  | { estado: 'em_andamento'; sumindo: boolean; passagens: number; versoes: VersaoLida[]; desde: string; ate: string }
  | { estado: 'provavelmente_terminou'; ficou: string; sumidas: VersaoLida[] } // reversível
  | { estado: 'troca'; antes: string; depois: string; entre: { de: string; ate: string }; vistoAte: string }
  | { estado: 'sem_troca_vista'; desde: string }
export type EstadoTitulo =
  | EstadoTituloBase
  | { estado: 'nao_medido'; motivo: Motivo; ultimo?: EstadoTituloBase; vistoAte?: string }
  | { estado: 'fora_da_janela'; ultimo: EstadoTituloBase | null; vistoAte: string }

export type EstadoMiniaturaBase =
  | { estado: 'troca'; antes: string; depois: string; entre: { de: string; ate: string }; vistoAte: string }
  | { estado: 'indeterminada' }
  | { estado: 'sem_troca_vista'; desde: string }
export type EstadoMiniatura =
  | EstadoMiniaturaBase
  | { estado: 'nao_medido'; motivo: Motivo; ultimo?: EstadoMiniaturaBase; vistoAte?: string }
  | { estado: 'fora_da_janela'; ultimo: EstadoMiniaturaBase | null; vistoAte: string }

type Veredito = 'troca_observada' | 'possivel_teste_youtube'
type FicouEstadoLido = 'estavel' | 'em_andamento' | 'sem_desfecho'
type TipoTrocaLido = 'sequencial' | 'alternada'

/** Linha de `ab_native_observados` já tipada no que a leitura precisa; `ficou` e `trocas` chegam como `unknown` e são validados aqui. */
export interface LinhaLida {
  veredito: Veredito
  ficouEstado: FicouEstadoLido
  ficou: unknown
  trocas: unknown
  versaoRegra: number
  motivo: string | null
  ultimaAtualizacaoEm: string
  tipoTroca: TipoTrocaLido
}
export interface AlvoLido { rodadas: number; ultimaRodadaEm: string | null; saiuPor: string | null; publicadoEm: string | null }
/** `validas*`: rodadas de W usadas na decisão (0 = a regra devolveu não medido, por qualquer motivo). */
export interface CursorLido { avaliadoAteRodada: number; avaliadoEm: string; motivo: string; validasTitulo: number; validasMiniatura: number }
export interface EntradaEstado {
  /** `OBS_TROCAS_CONCORRENTE` ligada (quem lê o ambiente é `modoTrocasConcorrente`). */
  flagLigada: boolean
  alvo: AlvoLido | null
  cursor: CursorLido | null
  linhas: { titulo: LinhaLida | null; miniatura: LinhaLida | null }
  agoraMs: number
  /** Frescor da prova diária, em ms: última rodada e avaliação precisam estar dentro dele. */
  frescorMs: number
}

const H = 3_600_000
export const FRESCOR_MS = FRESCOR_H * H
const APRENDENDO_MS = 4 * 86_400_000

// ───────────────────────── Validação da forma (sem Zod: o módulo é puro) ─────────────────────────

const rec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string'
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

interface VersaoTroca { v: number; ref: string; ultima: string }
interface VersaoW { v: number; rodadasEmW: number; ultima: string }
interface Transi { antes: string; de: string; ate: string }

function lerTrocas(v: unknown): VersaoTroca[] | null {
  if (!Array.isArray(v)) return null
  const out: VersaoTroca[] = []
  for (const x of v) {
    if (!rec(x) || !num(x.v) || !str(x.ref) || !str(x.ultima_vista)) return null
    out.push({ v: x.v, ref: x.ref, ultima: x.ultima_vista })
  }
  return out
}
function lerVersoesW(v: unknown): VersaoW[] | null {
  if (!Array.isArray(v)) return null
  const out: VersaoW[] = []
  for (const x of v) {
    if (!rec(x) || !num(x.v) || !num(x.rodadas_em_w) || !str(x.ultima_vista)) return null
    out.push({ v: x.v, rodadasEmW: x.rodadas_em_w, ultima: x.ultima_vista })
  }
  return out
}
function lerTransicao(v: unknown): Transi | null | undefined {
  if (v === null || v === undefined) return null
  if (!rec(v) || !str(v.antes) || !str(v.de) || !str(v.ate)) return undefined
  return { antes: v.antes, de: v.de, ate: v.ate }
}
interface FicouTLido { titulo: string; versoes: VersaoW[]; sumindo: boolean; janela: { de: string; ate: string } | null; transicao: Transi | null }
function lerFicouTitulo(v: unknown): FicouTLido | null {
  if (!rec(v) || !str(v.titulo) || typeof v.sumindo !== 'boolean') return null
  const versoes = lerVersoesW(v.versoes)
  const transicao = lerTransicao(v.transicao)
  if (versoes === null || transicao === undefined) return null
  let janela: { de: string; ate: string } | null = null
  if (v.janela_teste !== null && v.janela_teste !== undefined) {
    if (!rec(v.janela_teste) || !str(v.janela_teste.de) || !str(v.janela_teste.ate)) return null
    janela = { de: v.janela_teste.de, ate: v.janela_teste.ate }
  }
  return { titulo: v.titulo, versoes, sumindo: v.sumindo, janela, transicao }
}
interface FicouMLido { dhash: string; transicao: Transi | null }
function lerFicouMiniatura(v: unknown): FicouMLido | null {
  if (!rec(v) || !str(v.dhash)) return null
  const transicao = lerTransicao(v.transicao)
  return transicao === undefined ? null : { dhash: v.dhash, transicao }
}

/** Linha do banco (snake_case) -> `LinhaLida`. Forma inválida ou `versao_regra < 2` (v1) vale linha ausente (§4). */
export function lerLinha(row: Record<string, unknown>): LinhaLida | null {
  const { veredito, ficou_estado: fe, tipo_troca: tt, versao_regra: vr, motivo, ultima_atualizacao_em: ua } = row
  if (veredito !== 'troca_observada' && veredito !== 'possivel_teste_youtube') return null
  if (fe !== 'estavel' && fe !== 'em_andamento' && fe !== 'sem_desfecho') return null
  if (tt !== 'sequencial' && tt !== 'alternada') return null
  if (!num(vr) || vr < 2 || !str(ua) || Number.isNaN(Date.parse(ua))) return null
  if (motivo !== null && motivo !== undefined && !str(motivo)) return null
  return { veredito, ficouEstado: fe, ficou: row.ficou, trocas: row.trocas, versaoRegra: vr, motivo: str(motivo) ? motivo : null, ultimaAtualizacaoEm: ua, tipoTroca: tt }
}

/** Linha de `ab_native_obs_cursor` (snake_case) -> `CursorLido`. Lê `avaliado_motivo` (a coluna `motivo` é da tabela de linhas); forma inválida = null. */
export function lerCursor(row: Record<string, unknown>): CursorLido | null {
  const { avaliado_ate_rodada: ate, avaliado_em: em, avaliado_motivo: motivo, validas_titulo: vt, validas_miniatura: vm } = row
  if (typeof ate !== 'number' || typeof em !== 'string' || (motivo !== 'ok' && motivo !== 'sem_publicacao') || typeof vt !== 'number' || typeof vm !== 'number') return null
  return { avaliadoAteRodada: ate, avaliadoEm: em, motivo, validasTitulo: vt, validasMiniatura: vm }
}

// ───────────────────────── Linha -> estado base ─────────────────────────

interface Ctx { vistoAte: string; passagens: number }

const lidaDe = (t: VersaoTroca[], w: VersaoW): VersaoLida => ({ ref: t.find(x => x.v === w.v)?.ref ?? '', rodadasEmW: w.rodadasEmW, ultimaVista: w.ultima })

function baseTitulo(l: LinhaLida, c: Ctx): EstadoTituloBase | null {
  const trocas = lerTrocas(l.trocas)
  const f = lerFicouTitulo(l.ficou)
  if (trocas === null || f === null) return null
  if (l.veredito === 'possivel_teste_youtube') {
    if (l.ficouEstado === 'estavel') {
      const sumidas: VersaoLida[] = trocas.filter(t => t.ref !== f.titulo).map(t => ({ ref: t.ref, rodadasEmW: f.versoes.find(w => w.v === t.v)?.rodadasEmW ?? 0, ultimaVista: t.ultima }))
      return { estado: 'provavelmente_terminou', ficou: f.titulo, sumidas }
    }
    // em_andamento, ou sem_desfecho de alvo que saiu (§5 passo 2/7): vale como em andamento
    if (f.janela === null) return null
    return {
      estado: 'em_andamento', sumindo: f.sumindo, passagens: c.passagens,
      // sumindo: inclui as versões que já saíram de W (rodadasEmW 0), para o texto dizer qual não aparece mais
      versoes: f.sumindo
        ? trocas.map(t => { const w = f.versoes.find(x => x.v === t.v); return { ref: t.ref, rodadasEmW: w?.rodadasEmW ?? 0, ultimaVista: w?.ultima ?? t.ultima } })
        : f.versoes.filter(w => w.rodadasEmW > 0).map(w => lidaDe(trocas, w)),
      desde: f.janela.de, ate: f.janela.ate,
    }
  }
  // troca_observada: no título só existe estável (o par com em_andamento é proibido por tipo)
  if (l.ficouEstado !== 'estavel' || f.transicao === null) return null
  return { estado: 'troca', antes: f.transicao.antes, depois: f.titulo, entre: { de: f.transicao.de, ate: f.transicao.ate }, vistoAte: c.vistoAte }
}

function baseMiniatura(l: LinhaLida, c: Ctx): EstadoMiniaturaBase | null {
  const f = lerFicouMiniatura(l.ficou)
  if (f === null || lerTrocas(l.trocas) === null || l.veredito !== 'troca_observada') return null
  if (l.ficouEstado === 'estavel') {
    if (f.transicao === null) return null
    return { estado: 'troca', antes: f.transicao.antes, depois: f.dhash, entre: { de: f.transicao.de, ate: f.transicao.ate }, vistoAte: c.vistoAte }
  }
  return { estado: 'indeterminada' }
}

// ───────────────────────── Ordem 1–9 do §5 ─────────────────────────

type Resultado<B extends { estado: string }> =
  | B
  | { estado: 'nao_medido'; motivo: Motivo; ultimo?: B; vistoAte?: string }
  | { estado: 'fora_da_janela'; ultimo: B | null; vistoAte: string }

function resolver<B extends { estado: string }>(
  e: EntradaEstado, campo: 'titulo' | 'miniatura', converter: (l: LinhaLida, c: Ctx) => B | null, semTroca: (desde: string) => B,
): Resultado<B> {
  const { alvo, cursor, agoraMs } = e
  const validas = cursor === null ? 0 : campo === 'titulo' ? cursor.validasTitulo : cursor.validasMiniatura
  const vistoAte = alvo?.ultimaRodadaEm ?? cursor?.avaliadoEm ?? ''
  const ctx: Ctx = { vistoAte, passagens: validas > 0 ? validas : W_RODADAS }
  const bruta = e.linhas[campo]
  const linha = bruta !== null && bruta.versaoRegra >= 2 ? bruta : null // v1 vale ausente
  const base = linha === null ? null : converter(linha, ctx)
  const valida = base === null ? null : linha // forma inválida também vale ausente
  const ultimoDaLinha: { ultimo?: B } = base === null ? {} : { ultimo: base }
  const desde = cursor === null ? '' : new Date(Date.parse(cursor.avaliadoEm) - (W_RODADAS - 1) * CADENCIA_H * H).toISOString() // D-P2

  // 1
  if (!e.flagLigada) return { estado: 'nao_medido', motivo: 'flag_off' }
  // 2
  const foraDaJanela = alvo !== null && (alvo.saiuPor === 'janela' || (valida?.ficouEstado === 'sem_desfecho' && valida.motivo === 'janela'))
  if (foraDaJanela) return { estado: 'fora_da_janela', ultimo: base ?? (validas > 0 ? semTroca(desde) : null), vistoAte }
  // 3
  if (alvo === null || alvo.saiuPor !== null || (valida?.ficouEstado === 'sem_desfecho' && valida.motivo !== 'janela')) {
    return { estado: 'nao_medido', motivo: 'saiu', ...ultimoDaLinha, ...(alvo?.ultimaRodadaEm ? { vistoAte: alvo.ultimaRodadaEm } : {}) }
  }
  // 4
  if (cursor?.motivo === 'sem_publicacao') return { estado: 'nao_medido', motivo: 'sem_publicacao' }
  const novo = alvo.publicadoEm !== null && agoraMs - Date.parse(alvo.publicadoEm) < APRENDENDO_MS
  // 5
  if (cursor === null && novo) return { estado: 'nao_medido', motivo: 'aprendendo' }
  const semRodadaFresca = alvo.ultimaRodadaEm === null || agoraMs - Date.parse(alvo.ultimaRodadaEm) > e.frescorMs
  const foraDeDia = cursor !== null && cursor.avaliadoAteRodada < alvo.rodadas - 1 && agoraMs - Date.parse(cursor.avaliadoEm) > e.frescorMs
  if (cursor === null || semRodadaFresca || foraDeDia) {
    return { estado: 'nao_medido', motivo: 'sem_leitura', ...ultimoDaLinha, ...(alvo.ultimaRodadaEm ? { vistoAte: alvo.ultimaRodadaEm } : {}) }
  }
  // 6
  if (validas === 0) return { estado: 'nao_medido', motivo: novo ? 'aprendendo' : 'regra', ...ultimoDaLinha }
  // 7
  if (base !== null && valida !== null && Date.parse(valida.ultimaAtualizacaoEm) >= Date.parse(cursor.avaliadoEm)) return base
  // 8
  if (base !== null && base.estado === 'troca') return base
  // 9
  return semTroca(desde)
}

export function estadoTitulo(e: EntradaEstado): EstadoTitulo {
  return resolver<EstadoTituloBase>(e, 'titulo', baseTitulo, desde => ({ estado: 'sem_troca_vista', desde }))
}

export function estadoMiniatura(e: EntradaEstado): EstadoMiniatura {
  return resolver<EstadoMiniaturaBase>(e, 'miniatura', baseMiniatura, desde => ({ estado: 'sem_troca_vista', desde }))
}
