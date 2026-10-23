'use client'
import type { ReactElement } from 'react'
import { nivelDeResolucao, LARGURA_MINIMA_ORIGINAL } from '@/lib/youtube/resolucao'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { SeloCaminho } from './selo-caminho'
import '../caminho-nativo.css'

export interface MedidaResolucao { largura: number; altura: number }

export function AvisoResolucao({ sujeito, medida }: { sujeito: 'enviada' | 'guardada'; medida: MedidaResolucao | null }): ReactElement {
  const nivel = nivelDeResolucao(medida)
  if (nivel === 'nao_medida' || !medida) {
    return <div className="cn-aviso-res"><SeloCaminho tipo="unk">{FRASES.resolucao.naoMedida}</SeloCaminho></div>
  }
  const dim = `${medida.largura} × ${medida.altura}`
  if (nivel === 'ok') return <p className="cn-meta" style={{ marginTop: 8 }}>{dim}</p>
  return (
    <div className="cn-aviso-res">
      <SeloCaminho tipo="resb">{FRASES.resolucao.baixa(dim)}</SeloCaminho>
      <span className="cn-meta">{FRASES.resolucao.explicacao(sujeito, LARGURA_MINIMA_ORIGINAL)}</span>
    </div>
  )
}
