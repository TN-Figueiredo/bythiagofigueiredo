// A prova de que quem pede pode EDITAR o site: o único caminho para o dado privado do canal próprio (impressões, CTR,
// views por dia). Os leitores (`ler.ts`) não aceitam um booleano: pedem este token, que só nasce aqui, depois da guarda
// de edição (`requireSiteScope({ mode: 'edit' })`, o critério `can_edit_site` da RLS das tabelas privadas).
//   - não se fabrica de fora: construtor privado e campo `#` fazem do tipo nominal (um objeto literal não compila), e em execução a
//     validação é o BRAND CHECK do campo privado (`#siteId in e`), que nenhum objeto forjado tem: `Object.create(prototype)`,
//     `Reflect.construct` e subclasse não passam. O construtor exige uma chave que só este módulo conhece e recusa `new.target`
//     diferente da classe; a instância é congelada;
//   - o site vem DENTRO do token (no campo privado, exposto só por getter): ninguém mistura a prova de um site com os dados de outro;
//   - é um objeto de servidor: não é serializável, então não atravessa para um componente cliente.
//   - a prova de TIPO (literal, `new`, `extends` não compilam) está em `edicao.type-test.ts`, que o `tsc` do web compila.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

/** Só este módulo conhece a chave: `new EdicaoDoSite(...)`, `Reflect.construct` e `super()` de fora não a têm. */
const CHAVE = Symbol('EdicaoDoSite')

/**
 * O brand check, fora da classe: não é propriedade de ninguém, então não se regrava (nem `EdicaoDoSite.ehEdicao = …` existe mais).
 * Atribuído uma vez, no bloco estático abaixo, o único lugar onde `#siteId in e` é legal.
 */
let marca: (e: unknown) => boolean = () => false

export class EdicaoDoSite {
  readonly #siteId: string
  private constructor(siteId: string, chave: symbol) {
    if (new.target !== EdicaoDoSite || chave !== CHAVE) throw new TypeError('EdicaoDoSite só nasce em provarEdicao, depois da guarda de edição')
    this.#siteId = siteId
    Object.freeze(this)
  }
  get siteId(): string { return this.#siteId }

  /** Brand check pelo campo privado: só uma instância construída acima passa (nem protótipo, nem propriedade própria enganam). */
  static {
    marca = (e: unknown): boolean => typeof e === 'object' && e !== null && #siteId in e
  }

  /** O token do site, ou null (não edita, sem sessão, ou a guarda falhou: falha fechada, avisada ao Sentry). Nunca lança. */
  static async provar(siteId: string): Promise<EdicaoDoSite | null> {
    try {
      const guarda = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
      return guarda.ok ? new EdicaoDoSite(siteId, CHAVE) : null
    } catch (e) {
      Sentry.captureException(e, { tags: { component: 'observatorio-proprio', step: 'provar-edicao' }, extra: { siteId } })
      return null
    }
  }
}

// a classe congelada: nem `provar` se troca por fora
Object.freeze(EdicaoDoSite)

/** A única porta: quem chama é o módulo de dados (`_proprio/dados.ts`); uma varredura de teste barra qualquer outro. */
export const provarEdicao = (siteId: string): Promise<EdicaoDoSite | null> => EdicaoDoSite.provar(siteId)

/** Em tempo de execução: o valor foi construído por `provar` (brand check do campo privado; um objeto forjado, ainda que com cast, não passa). */
export const edicaoValida = (e: unknown): e is EdicaoDoSite => marca(e)
