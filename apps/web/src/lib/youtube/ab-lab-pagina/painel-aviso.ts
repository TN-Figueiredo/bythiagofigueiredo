/** Aviso do topo do painel de escolha, por fase (M7b T11). Puro. Os textos são do Logan (T7a, `painel-textos.ts`). */
import type { CampoNome } from '../ab-restore'
import type { FasePainel } from './painel-fases'
import type { PainelEscolha } from './painel-escolha'
import {
  AVISO_DEMORANDO, AVISO_NAO_PROPAGOU, AVISO_NENHUMA_VERSAO, AVISO_SEM_CONEXAO, AVISO_SEM_LEITURA, RECUSA_SEM_RETENTATIVA,
  detalheDaRecusa, detalheParcial, tituloDaRecusa, tituloParcial,
} from './painel-textos'

export type IconeAviso = 'tri' | 'clock' | 'off' | 'info'
export interface AvisoDados { tom: 'err' | 'inc'; icone: IconeAviso; titulo: string; detalhe: string }

const CAMPOS_DO_TESTE: Record<PainelEscolha['tipo'], CampoNome[]> = { title: ['title'], thumbnail: ['thumbnail'], combo: ['title', 'thumbnail'] }
const ROTULO_CAMPO: Record<CampoNome, 'título' | 'miniatura'> = { title: 'título', thumbnail: 'miniatura' }

export function avisoDoPainel(f: FasePainel, p: PainelEscolha): AvisoDados | null {
  const letraDe = (id: string | null): string | null => (id ? p.opcoes.find(o => o.id === id)?.letra ?? null : null)
  switch (f.tipo) {
    case 'recusou': {
      const X = letraDe(f.selId)
      if (p.tipo === 'combo' && f.noAr.tipo === 'misto' && X) {
        const porCampo = f.noAr.porCampo
        const falhou = CAMPOS_DO_TESTE.combo.find(c => porCampo[c] !== X)
        const M = falhou ? porCampo[falhou] : undefined
        if (falhou && M) return { tom: 'err', icone: 'tri', titulo: tituloParcial(X), detalhe: detalheParcial(ROTULO_CAMPO[falhou], M) }
      }
      const S = f.noAr.tipo === 'confirmado' ? f.noAr.letra : null
      const detalhe = f.conferido && S ? `Conferimos agora: a versão ${S} segue no ar.` : detalheDaRecusa(f.porque, { S, X })
      return { tom: 'err', icone: 'tri', titulo: tituloDaRecusa(X), detalhe }
    }
    case 'erro': return { tom: 'err', icone: 'tri', titulo: tituloDaRecusa(letraDe(f.selId)), detalhe: f.texto }
    case 'conferindo': {
      const X = letraDe(f.selId)
      return {
        tom: 'inc', icone: 'clock', titulo: `Não deu para confirmar se a ${X ?? 'versão'} entrou.`,
        detalhe: 'A conexão caiu ou o YouTube demorou. Conferindo o que está no ar agora; o botão volta quando terminar.',
      }
    }
    case 'sem_rede':
      switch (f.motivo) {
        case 'nao_propagou': return { tom: 'inc', icone: 'clock', ...AVISO_NAO_PROPAGOU }
        case 'sem_leitura': return { tom: 'inc', icone: 'off', ...AVISO_SEM_LEITURA }
        case 'sem_conexao': return { tom: 'inc', icone: 'off', ...AVISO_SEM_CONEXAO }
        case 'demorando': return { tom: 'inc', icone: 'clock', ...AVISO_DEMORANDO }
      }
      return null
    case 'escolha': return f.aviso === 'nenhuma_versao' ? { tom: 'inc', icone: 'info', ...AVISO_NENHUMA_VERSAO } : null
    case 'escrevendo': case 'no_ar': case 'guardado': case 'confirmar': return null
  }
}

/** "Tentar de novo" some quando repetir não resolve (sem original, arquivo indisponível). */
export function podeTentarDeNovo(f: Extract<FasePainel, { tipo: 'recusou' }>): boolean {
  return !RECUSA_SEM_RETENTATIVA.has(f.porque)
}
