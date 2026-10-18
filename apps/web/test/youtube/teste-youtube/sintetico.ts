import { RENDERERS_TITULO, type LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'

export const VIDEO = 'abcdefghijk'

export interface ParamsLeitura {
  em: string
  rodada: string
  titulo?: string | null
  renderers?: Array<{ renderer: string; texto: string | null }>
  idioma?: string | null
  origem?: string | null
  erro?: string | null
  oficial?: string | null
  miniaturas?: LeituraWatch['miniaturas']
  video?: string
}

export function leitura(p: ParamsLeitura): LeituraWatch {
  const titulos =
    p.renderers ??
    RENDERERS_TITULO.map(renderer => ({ renderer, texto: p.titulo ?? null }))
  return {
    youtubeVideoId: p.video ?? VIDEO,
    lidaEm: p.em,
    rodadaId: p.rodada,
    origemRede: p.origem === undefined ? 'vercel' : p.origem,
    idioma: p.idioma === undefined ? 'pt-BR' : p.idioma,
    erro: p.erro ?? null,
    tituloOficial: p.oficial ?? null,
    titulo_oficial_fonte: p.oficial != null ? 'videoDetails' : null,
    rendicoesSqp: null,
    titulosExibidos: titulos,
    miniaturas: p.miniaturas ?? [],
  }
}

export interface ParamsRodadas {
  inicio: string
  intervaloMs: number
  padroes: string[]
  textos: Record<string, string>
  passoLeituraMs?: number
}

/** Rodada `i` começa em `inicio + i*intervaloMs`; cada letra do padrão é uma leitura. */
export function rodadas(p: ParamsRodadas): LeituraWatch[] {
  const t0 = Date.parse(p.inicio)
  const passo = p.passoLeituraMs ?? 2000
  const out: LeituraWatch[] = []
  p.padroes.forEach((padrao, i) => {
    ;[...padrao].forEach((letra, j) => {
      const texto = p.textos[letra]
      if (texto === undefined) throw new Error(`rodadas: letra sem texto: ${letra}`)
      out.push(
        leitura({
          em: new Date(t0 + i * p.intervaloMs + j * passo).toISOString(),
          rodada: `r${i}`,
          titulo: texto,
        }),
      )
    })
  })
  return out
}
