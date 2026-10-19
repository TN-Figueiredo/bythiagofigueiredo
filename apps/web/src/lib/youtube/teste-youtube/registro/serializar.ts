// Forma pública do registro do teste nativo (Cowork/MCP e, depois, a S9). Função pura.
export interface LinhaAbNativeTest {
  id: string
  youtube_video_id: string
  origem: string
  campos: string[]
  estado: string
  variantes_titulo: string[] | null
  votos_titulo: Record<string, number> | null
  titulo_oficial: string | null
  primeira_vista: string | null
  ultima_vista: string | null
  desfecho_estado: string | null
  desfecho_motivo: string | null
  desfecho_em: string | null
  desfecho_versao_regra: number | null
  vencedor_titulo: string | null
  vencedor_fonte: string | null
  evidencia: unknown
  evidencia_cortada: boolean | null
  versao_regra: number | null
}

export interface LinhaAbNativeAvaliacao {
  avaliada_em: string
  estado_14: string
  estado_48: string | null
  motivo_14: string | null
  mistas_48: number | null
  mistas_48_fora_quarentena: number | null
  min_desde_escrita: number[] | null
  erro: string | null
  retroativa: boolean | null
  aviso: string | null
}

export interface RegistroNativoSerializado {
  id: string; youtube_video_id: string; origem: string; campos: string[]; estado: string
  variantes_titulo: string[] | null; votos_titulo: Record<string, number> | null; titulo_oficial: string | null
  primeira_vista: string | null; ultima_vista: string | null
  desfecho: { estado: string | null; motivo: string | null; em: string | null; versao_regra: number | null }
  vencedor: { titulo: string; fonte: 'regra' | 'dono' } | null
  evidencia_rodadas: number; evidencia_cortada: boolean; versao_regra: number | null
}

export interface AvaliacaoSerializada {
  avaliada_em: string; estado_14: string; estado_48: string | null; motivo_14: string | null; mistas_48: number | null
  mistas_48_fora_quarentena: number | null; min_desde_escrita: number[] | null; erro: string | null
  retroativa: boolean; aviso: string | null
}

export function serializarRegistro(l: LinhaAbNativeTest): RegistroNativoSerializado {
  // `data_api` fica fora desta fase: o vencedor público é só o da regra ou o do dono.
  const fonte = l.vencedor_fonte === 'regra' || l.vencedor_fonte === 'dono' ? l.vencedor_fonte : null
  return {
    id: l.id,
    youtube_video_id: l.youtube_video_id,
    origem: l.origem,
    campos: l.campos,
    estado: l.estado,
    variantes_titulo: l.variantes_titulo,
    votos_titulo: l.votos_titulo,
    titulo_oficial: l.titulo_oficial,
    primeira_vista: l.primeira_vista,
    ultima_vista: l.ultima_vista,
    desfecho: { estado: l.desfecho_estado, motivo: l.desfecho_motivo, em: l.desfecho_em, versao_regra: l.desfecho_versao_regra },
    vencedor: l.vencedor_titulo !== null && fonte !== null ? { titulo: l.vencedor_titulo, fonte } : null,
    evidencia_rodadas: Array.isArray(l.evidencia) ? l.evidencia.length : 0,
    evidencia_cortada: l.evidencia_cortada === true,
    versao_regra: l.versao_regra,
  }
}

export function serializarAvaliacao(l: LinhaAbNativeAvaliacao): AvaliacaoSerializada {
  return {
    avaliada_em: l.avaliada_em,
    estado_14: l.estado_14,
    estado_48: l.estado_48,
    motivo_14: l.motivo_14,
    mistas_48: l.mistas_48,
    mistas_48_fora_quarentena: l.mistas_48_fora_quarentena,
    min_desde_escrita: l.min_desde_escrita,
    erro: l.erro,
    retroativa: l.retroativa === true,
    aviso: l.aviso,
  }
}
