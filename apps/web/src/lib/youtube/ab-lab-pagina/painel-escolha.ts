/**
 * Modelo puro do painel "O que fica no vídeo?" de um teste concluído (M7b T8). Sem banco, sem relógio, sem rede.
 * Os textos do mockup vêm das funções `frase(S)` e `painel(S)` do index.html; os de fora do mockup, de `painel-textos.ts` (Logan, T7a).
 */
import type { DisplayLabel } from '../ab-types'
import type { NoArLido } from '../ab-no-ar'
import {
  BLOQUEIO_ORIGINAL, FRASE_DESCONHECIDO, LINHA_DESCONHECIDO, SAI_NAO_CONFIRMADO, fraseEscolhaApagada, fraseMisto, linhaNoArMisto, seloUltimaLeitura,
} from './painel-textos'

export type TipoTeste = 'title' | 'thumbnail' | 'combo'
export type SeloEscolha = 'no_ar' | 'no_ar_ultima' | 'sugerida' | 'escolhida' | 'mantida' | 'titulo_no_ar' | 'miniatura_no_ar'
export type BloqueioOpcao = 'sem_original' | 'sem_permissao' | null
/** Fase de tela que muda a frase e os selos (o redutor da T9 decide qual). */
export type FaseFrase = 'normal' | 'escrevendo' | 'conferindo' | 'sem_rede' | 'guardado'

export interface VarianteEscolha {
  id: string
  letra: DisplayLabel
  original: boolean
  titulo: string | null
  miniatura: string | null
  /** fração 0..1; nulo = não medido */
  ctr: number | null
}

export interface EntradaPainelEscolha {
  testId: string
  nomeVideo: string
  tipo: TipoTeste
  restoreSeq: number
  /** quem administra o site (o servidor recusa os demais) */
  podeAdministrar: boolean
  variantes: VarianteEscolha[]
  /** `result_metadata.v2.vencedor_sugerido`; id que não é variante do teste vale como "sem sugerida" */
  sugeridaId: string | null
  noAr: NoArLido
  /** `escolha_variant_id` / `escolha_em` (ISO) */
  escolha: { varianteId: string | null; em: string | null } | null
  /** Há cópia da original para voltar a ela? Por campo, lido do teste. */
  originalGuardada: { titulo: boolean; miniatura: boolean }
}

export interface OpcaoEscolha extends VarianteEscolha {
  /** no máximo 2 */
  selos: SeloEscolha[]
  bloqueio: BloqueioOpcao
  textoBloqueio: string | null
  ctrTexto: string
}

export interface PainelEscolha {
  testId: string
  nomeVideo: string
  tipo: TipoTeste
  meta: string
  restoreSeq: number
  podeAdministrar: boolean
  opcoes: OpcaoEscolha[]
  /** varianteId pré-marcado */
  padrao: string | null
  noAr: NoArLido
  /** id da versão confirmada no ar; nulo quando misto ou desconhecido */
  noArId: string | null
  sugeridaId: string | null
  sugeridaLetra: DisplayLabel | null
  /** sem sugerida válida = o teste não mostrou diferença clara */
  inconclusivo: boolean
  /** existe `escolha_em` e a versão escolhida é uma versão deste teste */
  decidido: boolean
  /** `escolha_em` gravada, mas a versão escolhida já não existe */
  escolhaApagadaEm: string | null
  /** A entrada de origem: o painel refaz o modelo no cliente depois de cada resposta do servidor. */
  entrada: EntradaPainelEscolha
}

const TIPO_ROTULO: Record<TipoTeste, string> = { title: 'título', thumbnail: 'miniatura', combo: 'título e miniatura' }

export const ctrTexto = (c: number | null): string => (c === null ? 'CTR não medido' : `CTR ${(c * 100).toFixed(1).replace('.', ',')}%`)
const pct = (c: number): string => `${(c * 100).toFixed(1).replace('.', ',')}%`

/** 'dd/mm' em São Paulo, de um ISO. Nulo se não for data. */
export function diaMes(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(t))
  return p
}

export function selosValidos(o: Pick<OpcaoEscolha, 'selos'>): boolean {
  return o.selos.length <= 2 && !(o.selos.includes('sugerida') && (o.selos.includes('escolhida') || o.selos.includes('mantida')))
}

function bloqueioDeOriginal(e: EntradaPainelEscolha): string | null {
  const t = e.tipo !== 'thumbnail' && !e.originalGuardada.titulo
  const m = e.tipo !== 'title' && !e.originalGuardada.miniatura
  if (e.tipo === 'combo') return t && m ? BLOQUEIO_ORIGINAL.combo : t ? BLOQUEIO_ORIGINAL.title : m ? BLOQUEIO_ORIGINAL.thumbnail : null
  return t ? BLOQUEIO_ORIGINAL.title : m ? BLOQUEIO_ORIGINAL.thumbnail : null
}

export function montarPainelEscolha(e: EntradaPainelEscolha): PainelEscolha {
  const ids = new Set(e.variantes.map(v => v.id))
  const sugeridaId = e.sugeridaId !== null && ids.has(e.sugeridaId) ? e.sugeridaId : null
  const noArId = e.noAr.tipo === 'confirmado' ? e.noAr.varianteId : null
  const escolhaId = e.escolha?.varianteId ?? null
  const decidido = escolhaId !== null && ids.has(escolhaId)
  const escolhaApagadaEm = e.escolha?.em && !decidido ? diaMes(e.escolha.em) : null
  const originais = e.variantes.filter(v => v.original)
  const textoSemOriginal = originais.length !== 1 ? BLOQUEIO_ORIGINAL[e.tipo === 'combo' ? 'combo' : e.tipo] : bloqueioDeOriginal(e)

  const opcoes: OpcaoEscolha[] = [...e.variantes]
    .sort((a, b) => (a.original === b.original ? (a.letra < b.letra ? -1 : a.letra > b.letra ? 1 : 0) : a.original ? -1 : 1))
    .map(v => {
      const selos: SeloEscolha[] = []
      if (e.noAr.tipo === 'confirmado') {
        if (v.id === noArId) selos.push('no_ar')
      } else if (e.noAr.tipo === 'misto') {
        const l = v.letra
        if (e.noAr.porCampo.title === l) selos.push('titulo_no_ar')
        if (e.noAr.porCampo.thumbnail === l) selos.push('miniatura_no_ar')
      } else if (e.noAr.ultima && e.noAr.ultima.letra === v.letra) selos.push('no_ar_ultima')
      if (v.id === sugeridaId) selos.push('sugerida')
      else if (v.id === noArId && v.id === escolhaId) selos.push(v.original ? 'mantida' : 'escolhida')
      const bloqueada = originais.length !== 1 || v.original
      const semOriginal = bloqueada && textoSemOriginal !== null
      const bloqueio: BloqueioOpcao = !e.podeAdministrar ? 'sem_permissao' : semOriginal ? 'sem_original' : null
      return { ...v, selos: selos.slice(0, 2), bloqueio, textoBloqueio: bloqueio === 'sem_original' ? textoSemOriginal : null, ctrTexto: ctrTexto(v.ctr) }
    })

  let padrao: string | null = decidido ? escolhaId : sugeridaId
  if (padrao !== null && opcoes.find(o => o.id === padrao)?.bloqueio) padrao = null
  return {
    testId: e.testId, nomeVideo: e.nomeVideo, tipo: e.tipo, meta: `Teste de ${TIPO_ROTULO[e.tipo]} · ${e.nomeVideo}`, restoreSeq: e.restoreSeq,
    podeAdministrar: e.podeAdministrar, opcoes, padrao, noAr: e.noAr, noArId,
    sugeridaId, sugeridaLetra: sugeridaId ? e.variantes.find(v => v.id === sugeridaId)?.letra ?? null : null,
    inconclusivo: sugeridaId === null, decidido, escolhaApagadaEm, entrada: e,
  }
}

const letraNoAr = (p: PainelEscolha): DisplayLabel | null => (p.noAr.tipo === 'confirmado' ? p.noAr.letra : p.noAr.tipo === 'desconhecido' ? p.noAr.ultima?.letra ?? null : null)
const desdeNoAr = (p: PainelEscolha): string | null => (p.noAr.tipo === 'confirmado' ? diaMes(p.noAr.desde) : p.noAr.tipo === 'desconhecido' ? diaMes(p.noAr.ultima?.desde) : null)
const noArEhOriginal = (p: PainelEscolha): boolean => p.opcoes.some(o => o.original && o.id === p.noArId)

/** A frase do topo (`frase(S)` do mockup + A1..A4 e D1 do Logan). */
export function fraseDoPainel(p: PainelEscolha, fase: FaseFrase = 'normal'): string {
  const letra = letraNoAr(p)
  const desde = desdeNoAr(p)
  const leitura = letra ? ` Última leitura: ${letra}${desde ? ` desde ${desde}` : ''}.` : ''
  if (fase === 'escrevendo' || fase === 'conferindo') return `Conferindo o que está no ar.${leitura}`
  if (fase === 'sem_rede') return `Não deu para conferir o que está no ar.${leitura}`
  const sugOriginal = p.opcoes.some(o => o.original && o.id === p.sugeridaId)
  const sug = p.sugeridaLetra
  if (fase === 'guardado' || (p.decidido && noArEhOriginal(p))) {
    return sug && !sugOriginal ? `Você manteve a original (A). O teste sugeria a ${sug}.` : 'Você manteve a original (A). O teste não mostrou diferença clara.'
  }
  if (p.escolhaApagadaEm) return fraseEscolhaApagada(p.escolhaApagadaEm)
  if (p.noAr.tipo === 'misto') return fraseMisto(p.noAr.porCampo.title ?? '?', p.noAr.porCampo.thumbnail ?? '?')
  if (p.noAr.tipo === 'desconhecido') return FRASE_DESCONHECIDO
  const ar = p.noAr.letra
  const oOriginal = noArEhOriginal(p)
  if (p.inconclusivo) {
    return oOriginal
      ? 'O teste não mostrou diferença clara. O vídeo está com a original (A). Escolha qual fica.'
      : `O teste não mostrou diferença clara. O vídeo está com a versão ${ar}.`
  }
  if (sugOriginal) {
    return p.noArId === p.sugeridaId
      ? 'O teste sugeriu manter a original (A). O vídeo já está com ela.'
      : `O teste sugeriu manter a original (A). O vídeo está com a versão ${ar}.`
  }
  const quando = desde ? ` desde ${desde}` : ''
  if (p.noArId === p.sugeridaId) return `A versão ${sug} está no ar${quando}.`
  if (oOriginal) return `O teste sugeriu a versão ${sug}. O vídeo está com a original (A).`
  return `Você deixou a versão ${ar} no ar${quando}. O teste sugeria a ${sug}.`
}

export type LadoSaiEntra = { tipo: 'versao'; letra: DisplayLabel; titulo: string | null; miniatura: string | null } | { tipo: 'texto'; texto: string }
export type MeioDoPainel =
  | { tipo: 'nada' }
  | { tipo: 'info'; texto: string }
  | { tipo: 'ok'; texto: string }
  | { tipo: 'sai_entra'; sai: LadoSaiEntra; entra: LadoSaiEntra; linhaNeutra: string | null }
export type AcaoDoPainel =
  | { tipo: 'fechar' }
  | { tipo: 'deixar'; rotulo: string; desabilitado: boolean }
  | { tipo: 'manter_original'; rotulo: string }

export interface VisaoDaSelecao { meio: MeioDoPainel; acao: AcaoDoPainel; mostraFechar: true }

const achar = (p: PainelEscolha, id: string | null): OpcaoEscolha | null => (id === null ? null : p.opcoes.find(o => o.id === id) ?? null)

/** O que o painel mostra abaixo das opções e no rodapé, dada a versão marcada (`painel(S)` do mockup). */
export function visaoDaSelecao(p: PainelEscolha, selId: string | null): VisaoDaSelecao {
  const sel = achar(p, selId)
  const fechar: AcaoDoPainel = { tipo: 'fechar' }
  if (!p.podeAdministrar) return { meio: { tipo: 'nada' }, acao: fechar, mostraFechar: true }
  const igual = sel !== null && sel.id === p.noArId
  if (sel?.original && igual && p.decidido) {
    return { meio: { tipo: 'info', texto: 'Sua escolha está guardada. Marque outra versão só se quiser mudar o vídeo.' }, acao: fechar, mostraFechar: true }
  }
  if (sel?.original && igual) {
    return {
      meio: { tipo: 'info', texto: 'O vídeo continua como está. Guardamos que você escolheu a original e o teste sai da lista do que espera você.' },
      acao: { tipo: 'manter_original', rotulo: 'Manter a original (A)' }, mostraFechar: true,
    }
  }
  if (sel === null) {
    return { meio: { tipo: 'nada' }, acao: p.decidido ? fechar : { tipo: 'deixar', rotulo: 'Deixar no ar', desabilitado: true }, mostraFechar: true }
  }
  if (igual) return { meio: { tipo: 'ok', texto: `Nada a fazer: a versão ${sel.letra} já está no ar.` }, acao: fechar, mostraFechar: true }
  const base = p.noArId ? achar(p, p.noArId) : null
  const partes: string[] = []
  if (p.noAr.tipo === 'desconhecido') partes.push(LINHA_DESCONHECIDO)
  if (p.sugeridaLetra && sel.id !== p.sugeridaId) partes.push(`O teste sugeria a ${p.sugeridaLetra}.`)
  if (base && sel.ctr !== null && base.ctr !== null && sel.ctr < base.ctr) partes.push(`Esta versão teve CTR menor (${pct(sel.ctr)} contra ${pct(base.ctr)}).`)
  if (sel.ctr === null) partes.push('CTR não medido para esta versão.')
  const lado = (o: OpcaoEscolha): LadoSaiEntra => ({ tipo: 'versao', letra: o.letra, titulo: o.titulo, miniatura: o.miniatura })
  const sai: LadoSaiEntra = base ? lado(base)
    : p.noAr.tipo === 'misto' ? { tipo: 'texto', texto: linhaNoArMisto(p.noAr.porCampo.title ?? '?', p.noAr.porCampo.thumbnail ?? '?') }
    : { tipo: 'texto', texto: SAI_NAO_CONFIRMADO }
  return {
    meio: { tipo: 'sai_entra', sai, entra: lado(sel), linhaNeutra: partes.length > 0 ? partes.join(' ') : null },
    acao: { tipo: 'deixar', rotulo: `Deixar ${sel.letra} no ar`, desabilitado: false }, mostraFechar: true,
  }
}

/** Texto de um selo na fase corrente (`No ar agora` vira "na última leitura" enquanto se confere). */
export function textoDoSelo(p: PainelEscolha, o: OpcaoEscolha, s: SeloEscolha, fase: FaseFrase = 'normal'): string {
  switch (s) {
    case 'no_ar': return fase === 'normal' || fase === 'guardado' ? 'No ar agora' : 'No ar na última leitura'
    case 'no_ar_ultima': return fase === 'normal' && p.noAr.tipo === 'desconhecido' && p.noAr.ultima ? seloUltimaLeitura(p.noAr.ultima.letra, diaMes(p.noAr.ultima.desde)) : 'No ar na última leitura'
    case 'sugerida': return 'Sugerida pelo teste'
    case 'escolhida': return 'Escolhida por você'
    case 'mantida': return 'Mantida por você'
    case 'titulo_no_ar': return 'Título no ar'
    case 'miniatura_no_ar': return 'Miniatura no ar'
  }
}
