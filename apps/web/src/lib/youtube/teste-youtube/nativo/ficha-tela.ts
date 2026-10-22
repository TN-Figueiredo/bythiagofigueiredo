// Estado puro da ficha do teste do YouTube na tela (F1a-tela-1, T4). Nada aqui lê relógio nem banco: `agora` entra por parâmetro.
// A cópia vive em `frases.ts`; os componentes (T6-T9) só desenham o que `vistaDaFicha` decide.
import type { FichaLida } from './ficha'
import type { ResultadoAcaoConfirmar, ResultadoAcaoDescartar, ResultadoAcaoResponder } from '@/app/cms/(authed)/youtube/ab-lab/actions-nativo'
import { FRASES, dataCurta } from './frases'

/** Vencida ⇔ inatividade > 14 d, com inatividade = greatest(criada_em, atualizada_em, studio_aberto_em, lembrar_em) (spec §5.3). */
export const INATIVIDADE_DESCARTE_MS = 14 * 24 * 3600 * 1000
/** A ficha "parada" avisa a partir de 13 d de inatividade. */
const INATIVIDADE_AVISO_MS = 13 * 24 * 3600 * 1000
const DIA_MS = 86_400_000

export type Largura = 'larga' | 'estreita'
export type MotivoErro = 'incompleta' | 'ja_ha_teste' | 'estado_mudou' | 'sem_conexao'

export interface EntradaFicha {
  ficha: FichaLida
  agora: Date
  largura: Largura
  nosso: { status: 'active' | 'paused'; dia: number; originalDeVolta: 'sim' | 'restaurando' | 'falhou' | 'nao' } | null
  registroDetectado: { primeiraVista: string } | null
  studioAbertoNestaSessao: boolean
  criadaEmOutroAparelho: boolean
  /** Com o nosso teste rodando, `aberta` é a confirmação da PAUSA (faixa `0b-ask`); sem ele, a do "Já iniciei". */
  confirmacao: 'fechada' | 'aberta' | 'ainda_nao' | 'registrada' | { erro: MotivoErro }
  /** Estado do salvamento (padrão `ok`). Estados `ficha-salvando` e `ficha-offline` do mockup. */
  salvamento?: 'ok' | 'salvando' | 'offline'
  /** Versão (n) cuja imagem não carregou (estado `ficha-imagem-falhou`). */
  imagemFalhou?: number | null
}

export type Faixa = null | '0b' | '0b-ask' | 'restaurando' | 'falhou' | 'restaurada' | '0c'
export type Primario = 'abrir_studio' | 'ja_iniciei' | 'confirmar' | 'pausar' | 'lembrar' | 'comecar_outra' | 'voltar' | 'copiar_titulo' | null

export interface VistaFicha {
  idade: 'normal' | 'parada' | 'vencida'
  faixa: Faixa
  acaoDoTopo: 'abrir_studio' | 'confirmar' | null
  abrirStudioHabilitado: boolean
  motivoDesabilitado: string | null
  jaIniciouHabilitado: boolean
  primario: Primario
  frase: string
  apoio: string | null
}

const LETRA = ['A', 'B', 'C'] as const
const letra = (n: number): string => LETRA[n - 1] ?? String(n)

/** Instante da última atividade: greatest(criada_em, atualizada_em, studio_aberto_em, lembrar_em); nulos ignorados. */
export function ultimaAtividade(f: FichaLida): number {
  const marcas = [f.criada_em, f.atualizada_em, f.studio_aberto_em, f.lembrar_em]
    .filter((x): x is string => x !== null).map((x) => Date.parse(x)).filter((n) => Number.isFinite(n))
  return marcas.length > 0 ? Math.max(...marcas) : 0
}

export function idadeDaFicha(f: FichaLida, agora: Date): 'normal' | 'parada' | 'vencida' {
  const inativo = agora.getTime() - ultimaAtividade(f)
  if (inativo > INATIVIDADE_DESCARTE_MS) return 'vencida'
  if (inativo >= INATIVIDADE_AVISO_MS) return 'parada'
  return 'normal'
}

function faixaDe(e: EntradaFicha): Faixa {
  if (e.confirmacao === 'registrada') return null
  const n = e.nosso
  if (n !== null) {
    switch (n.originalDeVolta) {
      case 'restaurando': return 'restaurando'
      case 'falhou': return 'falhou'
      case 'sim': return 'restaurada'
      case 'nao':
        if (n.status === 'active') return e.confirmacao === 'aberta' ? '0b-ask' : '0b'
        return 'restaurando' // pausado e a original ainda não voltou: restauração pendente, nunca "Abrir no Studio"
      default: { const _x: never = n.originalDeVolta; return _x }
    }
  }
  return e.registroDetectado !== null ? '0c' : null
}

const temB = (f: FichaLida): boolean => f.variantes.some((v) => v.n >= 2 && (v.titulo !== undefined || v.imagem !== undefined))
const baixaResolucao = (f: FichaLida): number[] =>
  f.campos.includes('miniatura') ? f.variantes.filter((v) => v.imagem && (v.imagem.largura < 1280 || v.imagem.altura < 720)).map((v) => v.n) : []

function fraseDaForma(e: EntradaFicha, estreita: boolean): { frase: string; apoio: string | null } {
  const f = e.ficha
  const n = f.variantes.length
  const baixas = baixaResolucao(f)
  if (n >= 3 && baixas.length > 0) {
    const txt = baixas.length === 1 ? `a ${letra(baixas[0]!)} está abaixo de 1280 × 720` : `a ${baixas.map(letra).join(' e a ')} estão abaixo de 1280 × 720`
    return FRASES.ficha.tresBaixa(txt)
  }
  const soTitulo = f.campos.length === 1 && f.campos[0] === 'titulo'
  const soMini = f.campos.length === 1 && f.campos[0] === 'miniatura'
  if (soTitulo) return FRASES.ficha.soTitulo(n)
  if (soMini) return FRASES.ficha.soMiniatura(n)
  return estreita ? FRASES.ficha.duasEstreita : FRASES.ficha.duas
}

function fraseDe(e: EntradaFicha, idade: VistaFicha['idade'], faixa: Faixa): { frase: string; apoio: string | null } {
  const estreita = e.largura === 'estreita'
  const f = e.ficha
  if (idade === 'vencida') return FRASES.ficha.vencida
  const c = e.confirmacao
  if (c === 'registrada') return FRASES.ficha.registrada(new Date(e.agora.getTime() + 14 * DIA_MS))
  if (typeof c === 'object') return FRASES.ficha.erro
  if (c === 'aberta' && faixa === '0b-ask') return FRASES.ficha.pausarConfirma
  if (faixa === '0b') return FRASES.ficha.nossoRodando
  if (faixa === 'restaurando') return FRASES.ficha.restaurando
  if (faixa === 'falhou') return FRASES.ficha.restaurarFalhou
  if (c === 'aberta') return FRASES.ficha.jaIniciei
  if (c === 'ainda_nao') return FRASES.ficha.ainda
  if (faixa === 'restaurada') return estreita ? FRASES.ficha.restauradaEstreita : FRASES.ficha.restaurada
  if (faixa === '0c') return FRASES.ficha.detectado
  if (e.salvamento === 'offline') return FRASES.ficha.offline
  if (e.salvamento === 'salvando') return estreita ? FRASES.ficha.salvandoFraseEstreita : FRASES.ficha.salvandoFrase
  if (e.imagemFalhou != null) return FRASES.ficha.imagemFalhou(letra(e.imagemFalhou))
  if (e.criadaEmOutroAparelho) return estreita ? FRASES.ficha.outroAparelhoEstreita : FRASES.ficha.outroAparelho
  if (estreita && f.lembrar_em !== null) return FRASES.ficha.lembrete
  if (!temB(f)) return FRASES.ficha.soOriginal
  if (e.studioAbertoNestaSessao && !estreita) return FRASES.ficha.studioAberto
  if (idade === 'parada') return FRASES.ficha.parada(Math.floor((e.agora.getTime() - ultimaAtividade(f)) / DIA_MS))
  return fraseDaForma(e, estreita)
}

/** O que a tela mostra e qual é o ÚNICO primário (laranja) de cada estado. */
export function vistaDaFicha(e: EntradaFicha): VistaFicha {
  const idade = idadeDaFicha(e.ficha, e.agora)
  const faixa = faixaDe(e)
  const estreita = e.largura === 'estreita'
  const semB = !temB(e.ficha)
  const vencida = idade === 'vencida'
  const nossoBloqueia = e.nosso !== null && e.nosso.originalDeVolta !== 'sim'
  const { frase, apoio } = fraseDe(e, idade, faixa)

  const jaIniciouHabilitado = !vencida && !semB && !nossoBloqueia
  const abrirStudioHabilitado = !estreita && jaIniciouHabilitado && e.confirmacao !== 'registrada'
  let motivoDesabilitado: string | null = null
  if (!vencida) {
    if (semB) motivoDesabilitado = estreita ? FRASES.ficha.rodapeLembrete.semB : FRASES.ficha.faltaB
    else if (nossoBloqueia) motivoDesabilitado = FRASES.ficha.primeiroPause
  }

  const confirmando = typeof e.confirmacao === 'object' || e.confirmacao === 'aberta' || e.confirmacao === 'ainda_nao'
  const noTopo = !estreita && !vencida && !nossoBloqueia && e.confirmacao !== 'registrada' && (e.studioAbertoNestaSessao || e.registroDetectado !== null || confirmando)
  const acaoDoTopo: VistaFicha['acaoDoTopo'] = estreita || vencida || e.confirmacao === 'registrada' || nossoBloqueia ? null : noTopo ? 'confirmar' : 'abrir_studio'

  // Um só primário: decidido em uma sequência de regras, da mais forte para a mais fraca.
  let primario: Primario
  if (vencida) primario = 'comecar_outra'
  else if (e.confirmacao === 'registrada') primario = 'voltar'
  else if (faixa === '0b' || faixa === '0b-ask' || faixa === 'falhou') primario = 'pausar'
  else if (e.confirmacao === 'aberta') primario = 'confirmar' // 2º toque da ficha: o que era primário vira secundário (Naksu 1)
  else if (estreita) primario = e.criadaEmOutroAparelho || e.ficha.lembrar_em !== null ? 'copiar_titulo' : 'lembrar'
  else if (faixa === 'restaurando') primario = null
  else if (noTopo) primario = e.confirmacao === 'ainda_nao' || semB ? null : 'ja_iniciei'
  else primario = abrirStudioHabilitado ? 'abrir_studio' : null

  return { idade, faixa, acaoDoTopo, abrirStudioHabilitado, motivoDesabilitado, jaIniciouHabilitado, primario, frase, apoio }
}

// ---- Erros -> motivo (exaustivo; `never` no default) ----------------------------------------------------------------------

type ErroDaActionConfirmar = NonNullable<Extract<ResultadoAcaoConfirmar, { ok: false }>['erro']>
/** `sem_permissao`/`pedido_invalido`/`falha` viram `estado_mudou`: o chamador manda ao Sentry (só `fichaId` e `motivo`). */
export function motivoDoErro(erro: ErroDaActionConfirmar | 'rede'): MotivoErro {
  switch (erro) {
    case 'ficha_incompleta': return 'incompleta'
    case 'ja_ha_teste_em_andamento': return 'ja_ha_teste'
    case 'estado_mudou': case 'nao_encontrada': case 'ja_confirmado': return 'estado_mudou'
    case 'sem_permissao': case 'pedido_invalido': case 'falha': return 'estado_mudou'
    case 'rede': return 'sem_conexao'
    default: { const _x: never = erro; return _x }
  }
}

type ErroDaActionDescartar = NonNullable<Extract<ResultadoAcaoDescartar, { ok: false }>['erro']>
export function motivoDoErroDescartar(erro: ErroDaActionDescartar | 'rede'): 'estado_mudou' | 'sem_conexao' {
  switch (erro) {
    case 'nao_encontrado': case 'confirmado': case 'ja_encerrado': case 'sem_permissao': case 'pedido_invalido': case 'falha': return 'estado_mudou'
    case 'rede': return 'sem_conexao'
    default: { const _x: never = erro; return _x }
  }
}

type ErroDaActionResponder = NonNullable<Extract<ResultadoAcaoResponder, { ok: false }>['erro']>
/** `falha`: mostrar a frase de erro da resposta (T10b) e mandar ao Sentry no chamador. */
export function motivoDoErroResponder(erro: ErroDaActionResponder | 'rede'): 'estado_mudou' | 'sem_conexao' | 'falha' {
  switch (erro) {
    case 'ja_respondido': case 'estado_mudou': case 'nao_respondivel': case 'nao_encontrado': return 'estado_mudou'
    case 'falha_escrita': case 'falha': return 'falha'
    case 'sem_permissao': case 'pedido_invalido': case 'variante_invalida': return 'falha'
    case 'rede': return 'sem_conexao'
    default: { const _x: never = erro; return _x }
  }
}
