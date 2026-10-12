// A prova de que quem pede pode EDITAR o site: o único caminho para o dado privado do canal próprio (impressões, CTR,
// views por dia). Os leitores (`ler.ts`) não aceitam um booleano: pedem este token, que só nasce aqui, depois da guarda
// de edição (`requireSiteScope({ mode: 'edit' })`, o critério `can_edit_site` da RLS das tabelas privadas).
//   - não se fabrica de fora: construtor privado e campo `#` fazem do tipo nominal (um objeto literal não compila) e os
//     leitores ainda conferem `instanceof` em tempo de execução;
//   - o site vem DENTRO do token: ninguém mistura a prova de um site com os dados de outro;
//   - é um objeto de servidor: não é serializável, então não atravessa para um componente cliente.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

export class EdicaoDoSite {
  readonly #siteId: string
  private constructor(siteId: string) { this.#siteId = siteId }
  get siteId(): string { return this.#siteId }

  /** O token do site, ou null (não edita, sem sessão, ou a guarda falhou: falha fechada, avisada ao Sentry). Nunca lança. */
  static async provar(siteId: string): Promise<EdicaoDoSite | null> {
    try {
      const guarda = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
      return guarda.ok ? new EdicaoDoSite(siteId) : null
    } catch (e) {
      Sentry.captureException(e, { tags: { component: 'observatorio-proprio', step: 'provar-edicao' }, extra: { siteId } })
      return null
    }
  }
}

/** A única porta: quem chama é o módulo de dados (`_proprio/dados.ts`); uma varredura de teste barra qualquer outro. */
export const provarEdicao = (siteId: string): Promise<EdicaoDoSite | null> => EdicaoDoSite.provar(siteId)

/** Em tempo de execução: o valor veio mesmo de `provar` (um objeto forjado com cast não passa). */
export const edicaoValida = (e: unknown): e is EdicaoDoSite => e instanceof EdicaoDoSite
