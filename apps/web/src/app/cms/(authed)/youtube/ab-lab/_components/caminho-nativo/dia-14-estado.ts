// Estado puro da pergunta do dia 14 (F1a-tela-1 T10b; F1a-tela-2 T4): as versões numeradas (A/B/C), o pedido de cada botão e as letras
// de "No ar" e do respondido. A numeração vem SÓ de `variantesDaResposta` (a mesma que o servidor usa ao gravar): nada aqui conta letra por conta própria.
import { variantesDaResposta, type RespostaDono } from '@/lib/youtube/teste-youtube/nativo/versoes'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { normalizarTitulo } from '@/lib/youtube/teste-youtube/normalizar-titulo'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'

type Registro = NonNullable<LinhaDoCaminho['registro']>

// --- Tela-2 ---
const LETRAS = ['A', 'B', 'C'] as const

export type VersaoDoDia14 = { letra: 'A' | 'B' | 'C'; n: number; titulo: string | null; imagem: { url: string } | null; original: boolean }
export type PerguntaDoDia14 =
  | { tipo: 'versoes'; origem: 'ficha' | 'derivada'; originalConhecido: boolean; versoes: VersaoDoDia14[] }
  | { tipo: 'sem_versoes' }

/**
 * As versões da pergunta, de 2 a 3. Ilegível, uma só ou 4+ -> `sem_versoes`. Sem efeito colateral (o aviso ao Sentry é de `lista-borda`).
 * A lista só guarda a imagem como `{ url }`; a validação do schema da ficha roda sobre n/título e a imagem volta por `n`.
 */
export function versoesDoDia14(r: Pick<Registro, 'variantes' | 'variantesTitulo' | 'tituloAntes'>): PerguntaDoDia14 {
  const paraValidar = r.variantes === null ? null : r.variantes.map((v) => (v.titulo === null
    ? { n: v.n, tipo: 'miniatura' as const } : { n: v.n, tipo: 'titulo' as const, titulo: v.titulo }))
  const base = variantesDaResposta({ variantes: paraValidar, variantes_titulo: r.variantesTitulo, titulo_antes: r.tituloAntes })
  if (!base || base.itens.length < 2 || base.itens.length > 3) return { tipo: 'sem_versoes' }
  const imagens = new Map((r.variantes ?? []).map((v) => [v.n, v.imagem]))
  const versoes = base.itens.map((it, i): VersaoDoDia14 => ({
    letra: LETRAS[i]!, n: it.n, titulo: it.titulo ?? null, imagem: imagens.get(it.n) ?? null,
    original: base.originalConhecido && it.n === 1,
  }))
  return { tipo: 'versoes', origem: base.origem, originalConhecido: base.originalConhecido, versoes }
}

/**
 * O pedido do botão da versão. A original conhecida vira `venceu_original` (n = 1); as demais, `venceu_nova` na própria posição.
 * Sem original conhecido (derivada) até a A é `venceu_nova` por posição: a única forma que o CHECK aceita.
 * `tituloVisto` é o que a tela mostrou, para o servidor recusar se a numeração mudou (D-1).
 */
export function pedidoDaVersao(
  v: VersaoDoDia14, p: Extract<PerguntaDoDia14, { tipo: 'versoes' }>,
): { resposta: Extract<RespostaDono, 'venceu_original' | 'venceu_nova'>; n: number; tituloVisto: string | null } {
  const original = p.originalConhecido && v.n === 1
  return { resposta: original ? 'venceu_original' : 'venceu_nova', n: v.n, tituloVisto: v.titulo }
}

const porTitulo = (p: PerguntaDoDia14, titulo: string | null): VersaoDoDia14 | null => {
  if (p.tipo !== 'versoes' || titulo === null) return null
  const alvo = normalizarTitulo(titulo)
  return p.versoes.find((x) => x.titulo !== null && normalizarTitulo(x.titulo) === alvo) ?? null
}

/** A versão que o Lab leu no ar (`vencedor_titulo`); nulo sem título ou sem par entre as versões (D-7(d)). */
export function letraDoNoAr(r: Pick<Registro, 'vencedorTitulo'>, p: PerguntaDoDia14): VersaoDoDia14 | null {
  return porTitulo(p, r.vencedorTitulo)
}

/**
 * A versão que o dono escolheu. Derivada respondida pelo dono: pelo `vencedor_titulo` (D-5), porque o `variante_vencedora` gravado
 * pode apontar para outra posição na numeração de hoje. Ficha (ou veredito de outra fonte): pela posição gravada. Sem vencedor: nulo.
 */
export function letraDaResposta(
  r: Pick<Registro, 'respostaDono' | 'varianteVencedora' | 'vencedorFonte' | 'vencedorTitulo'>, p: PerguntaDoDia14,
): VersaoDoDia14 | null {
  if (p.tipo !== 'versoes') return null
  if (r.respostaDono !== 'venceu_nova' && r.respostaDono !== 'venceu_original') return null
  if (p.origem === 'derivada' && r.vencedorFonte === 'dono') return porTitulo(p, r.vencedorTitulo)
  const n = r.respostaDono === 'venceu_original' ? 1 : r.varianteVencedora
  return p.versoes.find((x) => x.n === n) ?? null
}

// --- Tela-2, T7: o que o respondido e o conflito mostram ---

/** Respostas que apontam uma versão (as outras três são "sem vencedor"). */
export const respostaComVersao = (r: RespostaDono | 'sem_resposta' | null): r is 'venceu_nova' | 'venceu_original' => r === 'venceu_nova' || r === 'venceu_original'

/**
 * A versão da resposta para a tela. Vem de `letraDaResposta`; só quando a posição gravada está ausente (registro antigo) e não há
 * dúvida possível — original, ou nova com exatamente 2 versões — a tela usa a posição natural. Nunca chuta com título que não casa.
 */
export function versaoDoRespondido(r: Pick<Registro, 'respostaDono' | 'varianteVencedora' | 'vencedorFonte' | 'vencedorTitulo'>, p: PerguntaDoDia14): VersaoDoDia14 | null {
  const v = letraDaResposta(r, p)
  if (v || p.tipo !== 'versoes' || r.varianteVencedora != null) return v
  if (r.respostaDono === 'venceu_original') return p.versoes.find((x) => x.n === 1) ?? null
  if (r.respostaDono === 'venceu_nova' && p.versoes.length === 2) return p.versoes[1] ?? null
  return null
}

/**
 * Selo e frase do respondido com versão no ar. A original lê "A (original)"; derivada sem original conhecida lê o título
 * (nunca "original"); sem par, o selo genérico e nenhuma frase inventada.
 */
export function resumoDoRespondido(
  r: Pick<Registro, 'respostaDono' | 'varianteVencedora' | 'vencedorFonte' | 'vencedorTitulo'>, p: PerguntaDoDia14,
): { selo: string; frase: string | null; versao: VersaoDoDia14 | null } {
  const versao = versaoDoRespondido(r, p)
  if (!versao || p.tipo !== 'versoes') return { selo: r.vencedorTitulo ? FRASES.dia14.seloNoArTitulo(r.vencedorTitulo) : FRASES.dia14.seloNoArSemTitulo, frase: null, versao }
  if (versao.original) return { selo: FRASES.dia14.seloOriginal, frase: FRASES.dia14.fraseOriginal(p.versoes.length), versao }
  const semOriginal = p.origem === 'derivada' && !p.originalConhecido
  const selo = semOriginal && versao.titulo ? FRASES.dia14.seloNoArTitulo(versao.titulo) : FRASES.dia14.seloNoAr(versao.letra)
  return { selo, frase: FRASES.dia14.fraseNoAr(versao.letra), versao }
}

/** Mesmo dia civil em São Paulo (a meta diz "hoje" só quando é). */
export function mesmoDiaSP(a: Date, b: Date): boolean {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
  return f.format(a) === f.format(b)
}
