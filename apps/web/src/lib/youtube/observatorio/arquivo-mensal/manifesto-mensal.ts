/** Manutenção M3b: o manifesto mensal de uma classe (C0.3, C5). Puro. Nunca nome de canal nem id do YouTube. */
import { createHash } from 'node:crypto'

export type EstadoDoArquivo = 'normal' | 'vazia' | 'perdida' | 'expurgada'

export interface ArquivoDoManifestoMensal {
  arquivo_id: string
  tipo: 'unidade' | 'parte' | 'resumo'
  caminho: string | null
  canal: string | null
  tabela: string | null
  linhas: number | string | null
  soma: string | null
  sha256: string | null
  csv_sha256: string | null
  estado: EstadoDoArquivo
}
export interface LinhasDoManifesto {
  classe: string
  mes: string
  versao: number
  /** Dia de São Paulo da primeira geração da versão, em ISO com -03: igual em toda repetição do mesmo dia. */
  gerado_em: string
  arquivos: ArquivoDoManifestoMensal[]
  contagens: { unidades_canal_removido: number; unidades_perdidas: number; unidades_expurgadas: number }
}

export interface ManifestoMensal { json: Buffer; lista: Buffer; caminhoJson: string }

const sha = (d: Uint8Array): string => createHash('sha256').update(d).digest('hex')

export function montarManifesto(rows: LinhasDoManifesto, site: string): ManifestoMensal {
  const caminhoJson = `${rows.classe}/manifestos/${rows.mes}.v${rows.versao}.json`
  const m = {
    formato: 1, classe: rows.classe, mes: rows.mes, versao: rows.versao, gerado_em: rows.gerado_em, site,
    arquivos: rows.arquivos,
    unidades_canal_removido: rows.contagens.unidades_canal_removido,
    unidades_perdidas: rows.contagens.unidades_perdidas,
    unidades_expurgadas: rows.contagens.unidades_expurgadas,
  }
  const json = Buffer.from(JSON.stringify(m, null, 2) + '\n', 'utf8')
  // formato do sha256sum: "<hash>  <caminho>" (dois espaços), caminho relativo ao filho; o próprio .json entra por último
  const linhas = rows.arquivos.filter(a => a.sha256 !== null && a.caminho !== null).map(a => `${a.sha256}  ${a.caminho}`)
  linhas.push(`${sha(json)}  ${caminhoJson}`)
  return { json, lista: Buffer.from(linhas.join('\n') + '\n', 'utf8'), caminhoJson }
}
