/**
 * Manutenção M3b, T12 (B1/B2): o que o arquivo e o Blob dizem sobre o canal que vai ser removido. A função do banco
 * (`obs_archive_channel_archive_impact`) é a fonte; aqui só se lê e se confere a forma. Resposta fora da forma LANÇA: um número que não veio
 * nunca vira zero (o diálogo cai em `falha_contagem`). Puro: o cliente entra por parâmetro, sem `server-only` nem `@/`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FaixaDeMeses {
  meses: number; de: string | null; ate: string | null
  /** M5: registros dos meses que já saíram do banco. Ausente = função de antes da M5 (não medido; nunca zero). */
  registros?: number
}
/** `de`/`ate`: 'YYYY-MM' (meses) ou 'YYYY-MM-DD' (vídeos retirados). */
export interface ImpactoDoArquivo {
  meses: number; de: string | null; ate: string | null
  foraDoBanco: FaixaDeMeses
  videosRetirados: { n: number; de: string | null; ate: string | null }
  imagensBlob: number
}

const FN = 'obs_archive_channel_archive_impact'
const contagem = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0
const objeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const dataOuNula = (x: unknown): string | null => (typeof x === 'string' && x.length > 0 ? x : null)
const erro = (): never => { throw new Error(FN + ': resposta inesperada') }

/** null = o canal não é deste site. Qualquer outra forma lança. */
export function parseImpactoDoArquivo(data: unknown): ImpactoDoArquivo | null {
  if (!objeto(data)) return erro()
  if (data.status === 'nao_encontrado') return null
  if (data.status !== 'ok' || !contagem(data.meses) || !contagem(data.imagens_blob)) return erro()
  const fora = data.fora_do_banco, vr = data.videos_retirados
  if (!objeto(fora) || !contagem(fora.meses) || !objeto(vr) || !contagem(vr.n)) return erro()
  return {
    meses: data.meses, de: dataOuNula(data.de), ate: dataOuNula(data.ate),
    foraDoBanco: { meses: fora.meses, de: dataOuNula(fora.de), ate: dataOuNula(fora.ate), ...(fora.registros === undefined ? {} : { registros: contagem(fora.registros) ? fora.registros : erro() }) },
    videosRetirados: { n: vr.n, de: dataOuNula(vr.de), ate: dataOuNula(vr.ate) },
    imagensBlob: data.imagens_blob,
  }
}

/**
 * O que o canal tem no total, sem contar duas vezes: o que está no banco agora MAIS o que já saiu do banco (`foraDoBanco.registros`), nunca os
 * `registros` totais do arquivo (incluem o que ainda está no banco). Antes de qualquer saída é só a parcela online. null = há mês fora do banco
 * e a função não diz quantos registros (antes da M5): não medido.
 */
export function registrosDoCanal(noBancoAgora: number, a: ImpactoDoArquivo): number | null {
  const fora = a.foraDoBanco
  if (fora.registros === undefined) return fora.meses > 0 ? null : noBancoAgora
  return noBancoAgora + fora.registros
}

/** Cliente de serviço: quem chama já passou pela guarda do site. null = canal de outro site. Erro do banco ou forma errada lança. */
export async function lerImpactoDoArquivo(sb: SupabaseClient, siteId: string, canalId: string): Promise<ImpactoDoArquivo | null> {
  const r = await sb.rpc(FN, { p_site: siteId, p_channel: canalId })
  if (r.error) throw new Error(FN + ': ' + r.error.message)
  return parseImpactoDoArquivo(r.data)
}
