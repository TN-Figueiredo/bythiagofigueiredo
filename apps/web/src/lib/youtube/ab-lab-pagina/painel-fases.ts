/**
 * Fases do painel de escolha como redutor puro e total (M7b T9). Sem relógio, sem rede, sem React: o componente
 * dispara os eventos (`quinze_s`, `sem_resposta_45s`, `conferir_15s` vêm de timers dele) e executa os efeitos.
 * Regra de ouro: nenhum caminho sai de `conferindo` para `escrevendo` sem um clique do dono (`enviar` é ignorado ali).
 */
import type { CampoNome } from '../ab-restore'
import type { NoArConfirmado, NoArLido } from '../ab-no-ar'
import type { PorqueRecusou, ResultadoConferir, ResultadoEscolha } from '../ab-acao-saida'
import type { DisplayLabel } from '../ab-types'
import { montarPainelEscolha, type EntradaPainelEscolha, type FaseFrase, type PainelEscolha } from './painel-escolha'

export const TETO_LEITURAS = 5

export type MotivoSemRede = 'sem_conexao' | 'sem_leitura' | 'demorando' | 'nao_propagou'
export type AvisoEscolha = 'nenhuma_versao'

export type FasePainel =
  | { tipo: 'escolha'; selId: string | null; aviso: AvisoEscolha | null; restoreSeq: number | null }
  | { tipo: 'escrevendo'; selId: string; anteriorId: string | null; envioId: number; demorando: boolean; forcar: boolean }
  | { tipo: 'conferindo'; selId: string; anteriorId: string | null; envioId: number; leituras: number }
  | { tipo: 'no_ar'; selId: string; noAr: NoArConfirmado; restoreSeq: number | null; hoje: boolean }
  | { tipo: 'recusou'; selId: string; porque: PorqueRecusou; noAr: NoArLido; entrou: CampoNome[]; restoreSeq: number | null; conferido: boolean; erro: string }
  | { tipo: 'sem_rede'; selId: string; anteriorId: string | null; envioId: number; motivo: MotivoSemRede }
  | { tipo: 'guardado'; selId: string; restoreSeq: number | null }
  | { tipo: 'confirmar'; selId: string; campos: Array<{ campo: CampoNome; valor_atual: string }> }
  | { tipo: 'erro'; selId: string | null; texto: string; recarregar: boolean }

export type EventoPainel =
  | { tipo: 'marcar'; varianteId: string }
  | { tipo: 'enviar'; envioId: number; forcar?: boolean }
  | { tipo: 'quinze_s' }
  | { tipo: 'resposta'; envioId: number; r: ResultadoEscolha }
  | { tipo: 'sem_resposta_45s' }
  | { tipo: 'falha_rede' }
  | { tipo: 'conferido'; r: ResultadoConferir }
  | { tipo: 'conferir_15s' }
  | { tipo: 'voltar' }

export const TIPOS_DE_FASE = ['escolha', 'escrevendo', 'conferindo', 'no_ar', 'recusou', 'sem_rede', 'guardado', 'confirmar', 'erro'] as const
export const TIPOS_DE_EVENTO = ['marcar', 'enviar', 'quinze_s', 'resposta', 'sem_resposta_45s', 'falha_rede', 'conferido', 'conferir_15s', 'voltar'] as const

export interface ContextoFases {
  /** versão confirmada no ar quando o dono clica (vira `anteriorId`) */
  noArId: string | null
  /** o `restoreSeq` que o painel recebeu da página */
  restoreSeq: number
}

export function assertNever(x: never): never { throw new Error(`fase/evento inesperado: ${JSON.stringify(x)}`) }

export function faseInicial(p: PainelEscolha): FasePainel {
  return { tipo: 'escolha', selId: p.padrao, aviso: null, restoreSeq: null }
}

/** Seq que o próximo "Deixar X no ar" / "Tentar de novo" deve levar. */
export function seqParaEnviar(f: FasePainel, p: PainelEscolha): number {
  if ((f.tipo === 'recusou' || f.tipo === 'escolha' || f.tipo === 'no_ar' || f.tipo === 'guardado') && f.restoreSeq !== null) return f.restoreSeq
  return p.restoreSeq
}

/** A fase de tela que a frase do topo e os selos usam. */
export function faseDaFrase(f: FasePainel): FaseFrase {
  switch (f.tipo) {
    case 'escrevendo': return 'escrevendo'
    case 'conferindo': return 'conferindo'
    case 'sem_rede': return 'sem_rede'
    case 'guardado': return 'guardado'
    case 'escolha': case 'no_ar': case 'recusou': case 'confirmar': case 'erro': return 'normal'
    default: return assertNever(f)
  }
}

export function travada(f: FasePainel): boolean {
  return f.tipo === 'escrevendo' || f.tipo === 'conferindo' || f.tipo === 'sem_rede' || f.tipo === 'guardado' || f.tipo === 'confirmar'
}

const semRede = (f: Extract<FasePainel, { tipo: 'escrevendo' | 'conferindo' | 'sem_rede' }>, motivo: MotivoSemRede): FasePainel =>
  ({ tipo: 'sem_rede', selId: f.selId, anteriorId: f.anteriorId, envioId: f.envioId, motivo })

type FaseEmVoo = Extract<FasePainel, { tipo: 'escrevendo' | 'conferindo' | 'sem_rede' }>

function aplicarResposta(f: FaseEmVoo, r: ResultadoEscolha): FasePainel {
  if (r.ok) {
    switch (r.resultado) {
      case 'no_ar': return { tipo: 'no_ar', selId: f.selId, noAr: r.noAr, restoreSeq: r.restoreSeq, hoje: false }
      case 'guardado': return { tipo: 'guardado', selId: f.selId, restoreSeq: r.restoreSeq }
      case 'precisa_confirmar': return { tipo: 'confirmar', selId: f.selId, campos: r.campos }
      default: return assertNever(r)
    }
  }
  switch (r.resultado) {
    case 'recusou': return { tipo: 'recusou', selId: f.selId, porque: r.porque, noAr: r.noAr, entrou: r.entrou, restoreSeq: r.restoreSeq, conferido: false, erro: r.error }
    case 'incerto': return f.tipo === 'escrevendo' ? { tipo: 'conferindo', selId: f.selId, anteriorId: f.anteriorId, envioId: f.envioId, leituras: 0 } : f
    case 'mudou': case 'ja_encerrado': return { tipo: 'erro', selId: f.selId, texto: r.error, recarregar: true }
    case 'em_andamento': case 'outro_teste': case 'teste_youtube': case 'sem_permissao': case 'erro':
      return { tipo: 'erro', selId: f.selId, texto: r.error, recarregar: false }
    default: return assertNever(r)
  }
}

function aplicarConferencia(f: Extract<FasePainel, { tipo: 'conferindo' }>, r: ResultadoConferir): FasePainel {
  if (!r.ok) {
    if (r.estado === 'sem_leitura') return semRede(f, 'sem_leitura')
    return { tipo: 'erro', selId: f.selId, texto: r.error, recarregar: r.estado === 'ja_encerrado' }
  }
  switch (r.estado) {
    case 'escrevendo': {
      const leituras = f.leituras + 1
      return leituras >= TETO_LEITURAS ? semRede(f, 'demorando') : { ...f, leituras }
    }
    case 'lido':
      if (r.noAr.varianteId === f.selId) return { tipo: 'no_ar', selId: f.selId, noAr: r.noAr, restoreSeq: r.restoreSeq, hoje: true }
      return { tipo: 'recusou', selId: f.selId, porque: 'youtube', noAr: r.noAr, entrou: [], restoreSeq: r.restoreSeq, conferido: true, erro: '' }
    case 'nao_propagou': return semRede(f, 'nao_propagou')
    case 'lido_misto':
      return { tipo: 'recusou', selId: f.selId, porque: 'youtube', noAr: { tipo: 'misto', porCampo: r.porCampo as Partial<Record<CampoNome, DisplayLabel>> }, entrou: [], restoreSeq: r.restoreSeq, conferido: true, erro: '' }
    case 'nenhuma_versao': return { tipo: 'escolha', selId: f.selId, aviso: 'nenhuma_versao', restoreSeq: r.restoreSeq }
    default: return assertNever(r)
  }
}

export function reduzir(f: FasePainel, ev: EventoPainel, ctx: ContextoFases): FasePainel {
  switch (ev.tipo) {
    case 'marcar':
      switch (f.tipo) {
        case 'escolha': return { ...f, selId: ev.varianteId }
        case 'recusou': return { ...f, selId: ev.varianteId }
        case 'no_ar': case 'erro': return { tipo: 'escolha', selId: ev.varianteId, aviso: null, restoreSeq: f.tipo === 'no_ar' ? f.restoreSeq : null }
        case 'escrevendo': case 'conferindo': case 'sem_rede': case 'guardado': case 'confirmar': return f
        default: return assertNever(f)
      }
    case 'enviar':
      switch (f.tipo) {
        case 'escolha': case 'recusou': case 'no_ar': case 'erro': case 'confirmar': {
          if (f.selId === null) return f
          // "Tentar de novo" e "Deixar X no ar" saem sempre de um clique; de `no_ar` só depois de marcar outra.
          if (f.tipo === 'no_ar') return f
          return { tipo: 'escrevendo', selId: f.selId, anteriorId: ctx.noArId, envioId: ev.envioId, demorando: false, forcar: ev.forcar === true }
        }
        case 'escrevendo': case 'conferindo': case 'sem_rede': case 'guardado': return f
        default: return assertNever(f)
      }
    case 'quinze_s':
      return f.tipo === 'escrevendo' ? { ...f, demorando: true } : f
    case 'resposta':
      switch (f.tipo) {
        case 'escrevendo': case 'conferindo': case 'sem_rede':
          return ev.envioId === f.envioId ? aplicarResposta(f, ev.r) : f
        case 'escolha': case 'no_ar': case 'recusou': case 'guardado': case 'confirmar': case 'erro': return f
        default: return assertNever(f)
      }
    case 'sem_resposta_45s':
      switch (f.tipo) {
        case 'escrevendo': return { tipo: 'conferindo', selId: f.selId, anteriorId: f.anteriorId, envioId: f.envioId, leituras: 0 }
        case 'conferindo': return semRede(f, 'demorando')
        case 'escolha': case 'no_ar': case 'recusou': case 'sem_rede': case 'guardado': case 'confirmar': case 'erro': return f
        default: return assertNever(f)
      }
    case 'falha_rede':
      return f.tipo === 'escrevendo' ? { tipo: 'conferindo', selId: f.selId, anteriorId: f.anteriorId, envioId: f.envioId, leituras: 0 } : f
    case 'conferido':
      return f.tipo === 'conferindo' ? aplicarConferencia(f, ev.r) : f
    case 'conferir_15s':
      return f.tipo === 'conferindo' ? semRede(f, 'sem_conexao') : f
    case 'voltar':
      return f.tipo === 'confirmar' ? { tipo: 'escolha', selId: f.selId, aviso: null, restoreSeq: null } : f
    default: return assertNever(ev)
  }
}

/** O modelo vivo: a entrada de origem com o que o servidor acabou de dizer. */
export function painelVivo(p: PainelEscolha, f: FasePainel, agoraIso: string): PainelEscolha {
  const e = p.entrada
  switch (f.tipo) {
    case 'no_ar': return montarPainelEscolha({ ...e, noAr: f.noAr, restoreSeq: f.restoreSeq ?? e.restoreSeq, escolha: { varianteId: f.selId, em: agoraIso } })
    case 'guardado': {
      const v = e.variantes.find(x => x.id === f.selId)
      const noAr: NoArConfirmado | null = v ? { tipo: 'confirmado', varianteId: v.id, letra: v.letra, desde: e.noAr.tipo === 'confirmado' && e.noAr.varianteId === v.id ? e.noAr.desde : null } : null
      return montarPainelEscolha({ ...e, noAr: noAr ?? e.noAr, restoreSeq: f.restoreSeq ?? e.restoreSeq, escolha: { varianteId: f.selId, em: agoraIso } })
    }
    case 'recusou': return montarPainelEscolha({ ...e, noAr: f.noAr, restoreSeq: f.restoreSeq ?? e.restoreSeq })
    case 'escolha': return f.aviso === 'nenhuma_versao' ? montarPainelEscolha({ ...e, noAr: { tipo: 'desconhecido', ultima: null }, restoreSeq: f.restoreSeq ?? e.restoreSeq }) : p
    case 'escrevendo': case 'conferindo': case 'sem_rede': case 'confirmar': case 'erro': return p
    default: return assertNever(f)
  }
}
