// A prova de que quem pede pode LER o desempenho privado do canal próprio (impressões, CTR, retenção, texto de comentário):
// quem edita o site OU quem tem o direito "ver desempenho privado" (tabela `site_private_viewers`, MG11) com vínculo no site.
// Irmão de `edicao.ts`, com a mesma fabricação:
//   - não se fabrica de fora: construtor privado, campo `#siteId` e chave `Symbol` que só este módulo conhece; o brand check em
//     execução é `#siteId in e` (objeto literal, `Object.create(prototype)`, `Reflect.construct`, subclasse e `structuredClone` não passam);
//   - o site vem DENTRO do token; a instância e a classe são congeladas; é um objeto de servidor (não serializa);
//   - nasce por UM caminho, `provarAcessoPrivado`: (1) `provarEdicao` (quem edita lê, sem tocar a MG11); (2) a guarda de sessão
//     com `mode: 'view'` (sem sessão ou sem vínculo: sem token); (3) a função `can_view_private_site_as` pelo cliente de serviço,
//     com o id que a guarda devolveu. Só `data === true` faz o token nascer; erro, nulo ou qualquer outra forma = sem token (falha fechada);
//   - NÃO autoriza escrita: o token de edição continua sendo o único que autoriza (uma Leitura não é atribuível a uma Edicao, e vice-versa).
//   - a prova de TIPO está em `leitura-privada.type-test.ts`, que o `tsc` do web compila.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { edicaoValida, provarEdicao } from './edicao'
import { chaveProvada, type ChaveDoPerfilProvada } from '../acesso-ia/prova'

const CHAVE = Symbol('LeituraPrivadaDoSite')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let marca: (e: unknown) => boolean = () => false
/** A fábrica também fica fora da classe (atribuída no bloco estático): não há `LeituraPrivadaDoSite.alguma()` que fabrique de fora. */
let fabricar: (siteId: string) => LeituraPrivadaDoSite = () => { throw new TypeError('LeituraPrivadaDoSite ainda não inicializada') }

export class LeituraPrivadaDoSite {
  readonly #siteId: string
  private constructor(siteId: string, chave: symbol) {
    if (new.target !== LeituraPrivadaDoSite || chave !== CHAVE) throw new TypeError('LeituraPrivadaDoSite só nasce em provarAcessoPrivado, depois da guarda')
    this.#siteId = siteId
    Object.freeze(this)
  }
  get siteId(): string { return this.#siteId }

  static {
    marca = (e: unknown): boolean => typeof e === 'object' && e !== null && #siteId in e
    fabricar = (siteId: string): LeituraPrivadaDoSite => new LeituraPrivadaDoSite(siteId, CHAVE)
  }
}

Object.freeze(LeituraPrivadaDoSite)

/** `sem_direito`: negação de verdade. `nao_foi_possivel_conferir`: não houve resposta confiável (nunca vira `sem_direito`). */
export type MotivoSemLeitura = 'sem_direito' | 'nao_foi_possivel_conferir'
/** `negativa` é null se, e só se, há leitura. `edita` só é true quando a guarda de edição aceitou. */
export interface AcessoPrivado { leitura: LeituraPrivadaDoSite | null; edita: boolean; negativa: MotivoSemLeitura | null }

type MotivoSentry = 'guarda_falhou' | 'funcao_ausente_ou_erro' | 'resposta_inesperada'
const TAGS = { component: 'observatorio-proprio', step: 'provar-leitura-privada' } as const
const semDireito: AcessoPrivado = { leitura: null, edita: false, negativa: 'sem_direito' }
const semResposta: AcessoPrivado = { leitura: null, edita: false, negativa: 'nao_foi_possivel_conferir' }
const codigoDe = (e: unknown): string | undefined => {
  const c = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined
  return typeof c === 'string' ? c : undefined
}

/** A única porta: nunca lança. O `extra` leva o código do erro, nunca a mensagem crua nem o id da pessoa. */
export async function provarAcessoPrivado(siteId: string): Promise<AcessoPrivado> {
  const edicao = await provarEdicao(siteId)
  if (edicaoValida(edicao)) return { leitura: fabricar(edicao.siteId), edita: true, negativa: null }
  if (!UUID.test(siteId)) return semDireito
  const avisar = (motivo: MotivoSentry, e?: unknown): void => {
    const code = codigoDe(e)
    const extra = { siteId, motivo, ...(code ? { code } : {}) }
    if (motivo === 'resposta_inesperada') Sentry.captureMessage('can_view_private_site_as devolveu forma inesperada', { level: 'warning', tags: TAGS, extra })
    else Sentry.captureException(new Error(`leitura privada: ${motivo}`), { tags: TAGS, extra })
  }
  let userId: string
  try {
    const guarda = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
    if (!guarda.ok) return semDireito
    userId = guarda.user.id
  } catch (e) {
    avisar('guarda_falhou', e)
    return semResposta
  }
  try {
    const { data, error } = await getSupabaseServiceClient().rpc('can_view_private_site_as', { p_user: userId, p_site: siteId })
    if (error) { avisar('funcao_ausente_ou_erro', error); return semResposta }
    if (data === true) return { leitura: fabricar(siteId), edita: false, negativa: null }
    if (data === false) return semDireito
    avisar('resposta_inesperada')
    return semResposta
  } catch (e) {
    avisar('funcao_ausente_ou_erro', e)
    return semResposta
  }
}

/**
 * A segunda porta (degrau 2, plano 4.8): a pessoa chega por uma chave do perfil, sem sessão. Quem a chama é só a rota do MCP, com a prova
 * que a porta acabou de devolver. Confere que a prova é legítima (brand check), pergunta `can_view_private_site_as` com o usuário e o
 * site DA PROVA e só com `data === true` devolve a leitura. `edita` é sempre `false`; nunca lança. O banco tem prazo (padrão 5 s, com
 * sinal de cancelamento): sem resposta no prazo, `nao_foi_possivel_conferir`.
 */
export async function provarAcessoPrivadoDaChave(prova: ChaveDoPerfilProvada, opcoes?: { prazoMs?: number }): Promise<AcessoPrivado> {
  if (!chaveProvada(prova)) return semDireito
  const siteId = prova.siteId
  const avisar = (motivo: MotivoSentry, e?: unknown): void => {
    const code = codigoDe(e)
    const extra = { siteId, motivo, ...(code ? { code } : {}) }
    if (motivo === 'resposta_inesperada') Sentry.captureMessage('can_view_private_site_as devolveu forma inesperada', { level: 'warning', tags: TAGS, extra })
    else Sentry.captureException(new Error(`leitura privada: ${motivo}`), { tags: TAGS, extra })
  }
  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), opcoes?.prazoMs ?? 5_000)
  try {
    const { data, error } = await getSupabaseServiceClient().rpc('can_view_private_site_as', { p_user: prova.userId, p_site: siteId }).abortSignal(controle.signal)
    if (error) { avisar('funcao_ausente_ou_erro', error); return semResposta }
    if (data === true) return { leitura: fabricar(siteId), edita: false, negativa: null }
    if (data === false) return semDireito
    avisar('resposta_inesperada')
    return semResposta
  } catch (e) {
    avisar('funcao_ausente_ou_erro', e)
    return semResposta
  } finally {
    clearTimeout(relogio)
  }
}

export const provarLeituraPrivada = async (siteId: string): Promise<LeituraPrivadaDoSite | null> => (await provarAcessoPrivado(siteId)).leitura

/** Em execução: o valor nasceu em `provarAcessoPrivado` (brand check do campo privado). */
export const leituraValida = (l: unknown): l is LeituraPrivadaDoSite => marca(l)
