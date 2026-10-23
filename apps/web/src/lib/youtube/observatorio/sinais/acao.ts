// Ação derivada na leitura (F2 T8, r6): a coluna `niche_signals.acao` é a foto do cálculo; o que a pessoa vê (tela, rota, Cowork,
// Claude Code) é derivado AGORA dos vídeos próprios que cobrem o lugar. Pura: sem banco, sem relógio. Só `leitura.ts` e a F2b tocam a coluna.
export type AcaoGravada = 'titulo_descricao' | 'video_novo' | 'playlist' | 'titulo_complementar' | 'thumbnail_ideias'
export type AcaoDerivada = 'titulo_descricao' | 'video_novo' | 'playlist'
export type RotuloDaAcao = 'abrir-concorrente' | 'abrir-seus' | 'generico' | 'playlist'

export interface AcaoDoSinal { acao: AcaoDerivada; rotulo: RotuloDaAcao; n: number | null }

/**
 * `propriosAgora = null` = não medido (site sem `video_lugares`): mantém a gravada, rótulo genérico, sem número a prometer.
 * `[]` = medido, nenhum vídeo seu: `video_novo`. Com ≥ 1: `titulo_descricao` com o número. `playlist` gravada nunca muda.
 * `kind` fica na assinatura (contrato do plano); hoje a derivação não distingue destino de parecido.
 */
export function derivarAcao(kind: 'destino' | 'parecido', acaoGravada: string, propriosAgora: readonly string[] | null): AcaoDoSinal {
  if (acaoGravada === 'playlist') return { acao: 'playlist', rotulo: 'playlist', n: propriosAgora === null ? null : propriosAgora.length }
  if (propriosAgora === null) {
    const gravada: AcaoDerivada = acaoGravada === 'video_novo' ? 'video_novo' : 'titulo_descricao'
    return { acao: gravada, rotulo: 'generico', n: null }
  }
  if (propriosAgora.length === 0) {
    return { acao: 'video_novo', rotulo: 'abrir-concorrente', n: 0 }
  }
  void kind
  return { acao: 'titulo_descricao', rotulo: 'abrir-seus', n: propriosAgora.length }
}
