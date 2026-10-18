import { z } from 'zod'
import { normalizarTitulo } from './normalizar-titulo'

/** Versão da regra; vai junto de todo veredito e de todo desfecho para a S7 gravar e a S8 citar. Sobe a cada mudança de limiar ou de critério. */
export const REGRA_TESTE_YOUTUBE_VERSAO = 1

/** Os renderers em que o título exibido foi visto variar em 18/10. A coleta pode mandar outros; a regra aceita qualquer nome. */
export const RENDERERS_TITULO = ['videoPrimaryInfoRenderer', 'playerOverlayVideoDetailsRenderer', 'videoTitleHeaderViewModel'] as const

/** Uma leitura anônima (sem cookie) da página watch de um vídeo. Produzida pela A5 (S4). */
export interface LeituraWatch {
  youtubeVideoId: string            // 11 caracteres [A-Za-z0-9_-]
  lidaEm: string                    // ISO 8601; a saída do Zod é sempre UTC com Z e milissegundos (ver abaixo)
  /** Agrupa as N leituras da mesma rodada. Gerado pela coleta e OPACO para a regra: só se compara por igualdade.
   *  A coleta garante um só `origemRede`, um só `idioma` e duração de poucos minutos; recomenda-se uuid.
   *  A regra confere a duração (`maxDuracaoRodadaMs`) em vez de confiar. */
  rodadaId: string
  origemRede: string | null         // 'vercel' | 'forja' | 'mac-casa' ...; null = não registrado
  /** Idioma SERVIDO (o hl/gl que a página devolveu), não o pedido. Títulos traduzidos pelo dono diferem por idioma: misturar idiomas seria "teste" falso.
   *  Obrigatório (não nulo) quando a leitura leu algum título. A coleta manda `hl=` e `gl=` explícitos na URL, não só Accept-Language. */
  idioma: string | null
  /** Código curto quando a leitura falhou ('http_429', 'consentimento', 'timeout', 'sem_initial_data' ...). null = leu.
   *  Leitura com erro nunca vota; os campos de dado vêm nulos ou vazios. */
  erro: string | null
  /** Título oficial = `videoDetails.title` (fallback `og:title`), já sem entidades HTML. NUNCA o `<title>` (traz " - YouTube"). null = não lido. */
  tituloOficial: string | null
  /** Um item por renderer procurado. texto null = o renderer NÃO estava na página (ausente); nunca "".
   *  Texto já sem entidades HTML e sem normalização (a regra normaliza). Para `videoPrimaryInfoRenderer` o texto é a
   *  concatenação de `title.runs[].text` (título com link ou hashtag vem partido em runs). */
  titulosExibidos: Array<{ renderer: string; texto: string | null }>
  miniaturas: Array<{
    url: string
    host: string                    // i.ytimg.com, i1.ytimg.com ...
    variante: string                // nome do arquivo sem extensão nem query: hqdefault, mqdefault, sddefault, maxresdefault, hq720
    /** Dimensão decodificada da imagem (não lida da URL). null = não decodificada. A classe de comparação é `variante|largura×altura` (F11). */
    largura: number | null
    altura: number | null
    http: number | null             // null = não buscada
    etag: string | null
    sha16: string | null            // 16 hex do SHA-256 dos bytes
    /** 16 hex minúsculos, mesmo algoritmo de dhashOf (thumb-fingerprint.ts). Só com http 200; nunca do corpo de um 404. */
    dhash: string | null
  }>
}

const texto = z.string().min(1).max(500).nullable()
/** Texto de título: recusa também o que a normalização esvazia (espaço, U+00A0, U+200B). */
const textoTitulo = z
  .string()
  .min(1)
  .max(500)
  .refine(s => normalizarTitulo(s) !== '', 'título vazio após normalizar')
  .nullable()
const hex16 = z.string().regex(/^[0-9a-f]{16}$/).nullable()
const dimensao = z.number().int().min(1).max(4096).nullable()

const miniaturaSchema = z
  .object({
    url: z.string().min(1).max(2048),
    host: z.string().min(1).max(200),
    variante: z.string().min(1).max(100),
    largura: dimensao,
    altura: dimensao,
    http: z.number().int().min(100).max(599).nullable(),
    etag: z.string().min(1).max(200).nullable(),
    sha16: hex16,
    dhash: hex16,
  })
  .superRefine((m, ctx) => {
    if ((m.largura === null) !== (m.altura === null)) {
      ctx.addIssue({ code: 'custom', message: 'largura e altura são nulas juntas' })
    }
    if (m.dhash !== null && (m.http !== 200 || m.largura === null)) {
      ctx.addIssue({ code: 'custom', message: 'dhash exige http 200 e dimensões' })
    }
  })

export const leituraWatchSchema = z
  .object({
    youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
    lidaEm: z
      .string()
      .datetime({ offset: true })
      .transform(s => new Date(s).toISOString()),
    rodadaId: z.string().min(1).max(200),
    origemRede: z.string().min(1).max(100).nullable(),
    idioma: z.string().min(1).max(35).nullable(),
    erro: z.string().regex(/^[a-z0-9_]{1,40}$/).nullable(),
    tituloOficial: textoTitulo,
    titulosExibidos: z.array(z.object({ renderer: z.string().min(1).max(100), texto: textoTitulo })).max(10),
    miniaturas: z.array(miniaturaSchema).max(60),
  })
  .superRefine((l, ctx) => {
    if (l.erro !== null) {
      if (!l.titulosExibidos.every(t => t.texto === null) || !l.miniaturas.every(m => m.dhash === null)) {
        ctx.addIssue({ code: 'custom', message: 'leitura com erro não traz dado' })
      }
    } else if (l.titulosExibidos.some(t => t.texto !== null) && l.idioma === null) {
      ctx.addIssue({ code: 'custom', message: 'idioma obrigatório quando algum título foi lido' })
    }
  })

export function validarLeituras(x: unknown[]): { validas: LeituraWatch[]; invalidas: number } {
  const validas: LeituraWatch[] = []
  let invalidas = 0
  for (const item of x) {
    const r = leituraWatchSchema.safeParse(item)
    if (r.success) validas.push(r.data)
    else invalidas++
  }
  return { validas, invalidas }
}

export type CampoTeste = 'titulo' | 'miniatura'

/** Diagnóstico que acompanha todo veredito: deixa a tela dizer "0 de 12 leituras válidas" em vez de silêncio. */
export interface ContagemLeituras {
  recebidas: number; invalidas: number; comErro: number
  validasTitulo: number             // leituras sem erro com ≥1 renderer de título lido
  validasMiniatura: number          // leituras sem erro com ≥1 miniatura com dHash
  rodadas: number
  rodadasLongas: number             // rodadas que passaram de maxDuracaoRodadaMs (não contam como mistas)
  rodadasMistasTitulo: number       // depois de excluir rodadas longas e rodadas em quarentena de escrita nossa
  rodadasEmQuarentena: number       // rodadas que tocaram a quarentena de uma escritasConhecidas (N2 de Yannis r3)
  textosDistintosTitulo: number
  primeiraMistura: string | null    // ISO da 1ª leitura de uma rodada mista; null = nenhuma
}

export interface SinalFraco {
  tipo: 'reenvio_mesma_imagem'      // ETag numérico novo, imagem igual (F6)
  em: string                        // instante do ETag (ISO)
  variante: string
}

export type MotivoNadaVisivelTitulo = 'um_valor_so' | 'troca_sem_mistura' | 'mistura_isolada' | 'mistura_esparsa' | 'mistura_atipica'

/** Estado de cada campo, separado do veredito geral. A miniatura NUNCA é 'provavel_teste' na v1. */
export type EstadoCampoTitulo =
  | { estado: 'nao_lido' }
  | { estado: 'insuficiente'; motivo: 'poucas_leituras' | 'janela_curta' | 'span_ilegivel' }   // span_ilegivel: emenda de 18/10, rodada 4
  | { estado: 'nada_visivel'; motivo: MotivoNadaVisivelTitulo }
  | { estado: 'provavel_teste' }
export type EstadoCampoMiniatura =
  | { estado: 'nao_lido' }
  | { estado: 'insuficiente'; motivo: 'poucas_leituras' }
  | { estado: 'nada_visivel'; motivo: 'um_valor_so' | 'miniatura_variou' }

export type DetalheInsuficiente =
  | { motivo: 'titulo_nao_lido' }                                 // há leitura de miniatura, mas o título não foi lido
  | { motivo: 'poucas_leituras'; minimo: number; atual: number }  // votos de título
  | { motivo: 'janela_curta'; janelaMs: number; minimoMs: number; variantes: string[] }
  | { motivo: 'span_ilegivel'; ilegiveis: number; rodadasSpan: number }   // N2: mais da metade do span é rodada longa ou em quarentena

interface Base {
  versaoRegra: number
  contagem: ContagemLeituras
  sinaisFracos: SinalFraco[]
  /** O mais frequente entre as leituras válidas (empate: o primeiro pela chave de desempate); null = nenhum lido. */
  tituloOficial: string | null
  porCampo: { titulo: EstadoCampoTitulo; miniatura: EstadoCampoMiniatura }
}

/** O estado geral é o do TÍTULO, salvo 'provavel_teste'. Miniatura 'nada_visivel' nunca sobe para o geral (§4.3 passo 8). */
export type VereditoTesteYoutube = Base & (
  | { estado: 'sem_leitura' }                                           // nenhuma leitura válida de nada: NUNCA "sem teste"
  | { estado: 'insuficiente'; detalhe: DetalheInsuficiente }
  | { estado: 'nada_visivel'                                            // NÃO quer dizer "não há teste"
      campos: ['titulo']
      motivo: MotivoNadaVisivelTitulo
      valorUnico?: { titulo: string }                                   // presente quando motivo = 'um_valor_so'
      janela: { de: string; ate: string } }                             // primeira e última leitura válida de título
  | { estado: 'provavel_teste'
      campos: Array<'titulo'>                                           // v1: só título
      variantes: { titulo: string[] }                                   // texto como exibido
      proporcao: { titulo: Record<string, number> }                     // fração de votos, soma 1
      votos: { titulo: Record<string, number> }                         // contagem absoluta
      primeiraVista: string; ultimaVista: string                        // 1ª e última leitura das rodadas mistas dos pares aprovados
      janela: { de: string; ate: string } }
)

export interface EscritaConhecida {
  em: string                        // ISO do instante em que o app escreveu
  campo: CampoTeste                 // v1: só 'titulo' tem efeito
}

export interface OpcoesDeteccao {
  minLeituras?: number              // padrão 9
  minVotosPorVariante?: number      // padrão 2
  minRodadasMistas?: number         // padrão 2
  minJanelaMistaMs?: number         // padrão 30 min
  minFracaoRodadasMistas?: number   // padrão 0,4
  maxDuracaoRodadaMs?: number       // padrão 10 min
  maxVariantes?: number             // padrão 3 (limite do Test & Compare)
  dhashMaxSame?: number             // padrão DHASH_MAX_SAME (6); ninguém muda o valor neste ciclo
  /** Escritas do próprio app (S6/S7 passam as das últimas 30 h): rodada cujo intervalo [min lidaEm, max lidaEm] toca [em − maxDuracaoRodadaMs, em + quarentena] não conta como mista. */
  escritasConhecidas?: ReadonlyArray<EscritaConhecida>
  quarentenaEscritaMs?: number      // padrão 60 min
}

export type ComparacaoImagem = 'mesma' | 'diferente' | 'incomparavel'

export interface ImagemComparavel { variante: string; largura: number | null; altura: number | null; dhash: string | null }

export type Desfecho =
  | { estado: 'vencedor_provavel'; vencedor: string; leiturasDescartadas: number; versaoRegra: number }
  | { estado: 'em_andamento'; motivo: 'teste_visivel' | 'estavel_curto'; versaoRegra: number }
  | { estado: 'sem_dado'
      motivo: 'antes_sem_teste' | 'depois_sem_leitura' | 'janelas_sobrepostas' | 'valor_fora_do_teste'
            | 'oficial_diverge' | 'oficial_nao_lido' | 'depois_ambiguo' | 'coleta_encerrada'
      versaoRegra: number }

/** Herda `escritasConhecidas` e os demais limiares: o p.7 do §4.4 chama `detectarTesteYoutube(leiturasDepois, opts)` com elas. */
export interface OpcoesDesfecho extends OpcoesDeteccao {
  minLeiturasEstavel?: number       // 18
  minJanelaEstavelMs?: number       // 24 h
  /** Instante de "agora", passado por quem chama (a regra continua sem Date.now()). OBRIGATÓRIO: opcional recriaria o defeito
   *  por omissão (teste acabado há semanas lido como 'em_andamento'). `inferirDesfecho(antes, depois, {})` lança. */
  agora: string
  maxIdadeColetaMs?: number         // 48 h
}

export type LimiaresDeteccao = Required<Omit<OpcoesDeteccao, 'escritasConhecidas'>> & {
  escritasConhecidas: ReadonlyArray<EscritaConhecida>
}

export const PADROES_DETECCAO: Omit<LimiaresDeteccao, 'escritasConhecidas' | 'dhashMaxSame'> = {
  minLeituras: 9,
  minVotosPorVariante: 2,
  minRodadasMistas: 2,
  minJanelaMistaMs: 30 * 60_000,
  minFracaoRodadasMistas: 0.4,
  maxDuracaoRodadaMs: 10 * 60_000,
  maxVariantes: 3,
  quarentenaEscritaMs: 60 * 60_000,
}

/** Padrões do desfecho (§4.4). */
export const PADROES_DESFECHO = {
  minLeiturasEstavel: 18,
  minJanelaEstavelMs: 24 * 3_600_000,
  maxIdadeColetaMs: 48 * 3_600_000,
} as const

export function resolverOpcoes(opts?: OpcoesDeteccao): LimiaresDeteccao {
  const o = opts ?? {}
  return {
    minLeituras: o.minLeituras ?? PADROES_DETECCAO.minLeituras,
    minVotosPorVariante: o.minVotosPorVariante ?? PADROES_DETECCAO.minVotosPorVariante,
    minRodadasMistas: o.minRodadasMistas ?? PADROES_DETECCAO.minRodadasMistas,
    minJanelaMistaMs: o.minJanelaMistaMs ?? PADROES_DETECCAO.minJanelaMistaMs,
    minFracaoRodadasMistas: o.minFracaoRodadasMistas ?? PADROES_DETECCAO.minFracaoRodadasMistas,
    maxDuracaoRodadaMs: o.maxDuracaoRodadaMs ?? PADROES_DETECCAO.maxDuracaoRodadaMs,
    maxVariantes: o.maxVariantes ?? PADROES_DETECCAO.maxVariantes,
    dhashMaxSame: o.dhashMaxSame ?? 6, // T5: trocar por DHASH_MAX_SAME
    escritasConhecidas: o.escritasConhecidas ?? [],
    quarentenaEscritaMs: o.quarentenaEscritaMs ?? PADROES_DETECCAO.quarentenaEscritaMs,
  }
}
