// A prova de que a porta do acesso externo deixou esta chave do perfil passar: o único token que abre o cliente de serviço para ler
// dado do Observatório por este caminho (plano, 4.2). Feito como `EdicaoDoSite` (proprio/edicao.ts):
//   - não se fabrica de fora: construtor privado e campos `#` fazem do tipo nominal (um objeto literal não compila); em execução a
//     validação é o BRAND CHECK dos campos privados, que nenhum objeto forjado tem (`Object.create(prototype)`, `Reflect.construct`
//     e subclasse não passam). O construtor exige uma chave que só este módulo conhece; a instância é congelada;
//   - site, pessoa, chave e vencimento vêm DENTRO do token (campos `#`, expostos só por getter): ninguém mistura a prova de um site
//     com os dados de outro;
//   - é um objeto de servidor: `JSON.stringify` dá `{}` e `structuredClone` não carrega a marca, então não atravessa para o cliente.
// Quem fabrica: só `porta.ts`, pelo `fabricarProva` exportado daqui (uma varredura de teste barra qualquer outro). A prova de TIPO
// (literal, `new`, `extends` não compilam) está em `prova.type-test.ts`, que o `tsc` do web compila.
import 'server-only'

/** Só este módulo conhece a chave: `new ChaveDoPerfilProvada(...)`, `Reflect.construct` e `super()` de fora não a têm. */
const CHAVE = Symbol('ChaveDoPerfilProvada')

/** O brand check, fora da classe, atribuído uma vez no bloco estático abaixo (o único lugar onde `#campo in x` é legal). */
let marca: (e: unknown) => boolean = () => false

export class ChaveDoPerfilProvada {
  readonly #siteId: string
  readonly #userId: string
  readonly #keyId: string
  readonly #venceEm: string
  private constructor(siteId: string, userId: string, keyId: string, venceEm: string, chave: symbol) {
    if (new.target !== ChaveDoPerfilProvada || chave !== CHAVE) throw new TypeError('ChaveDoPerfilProvada só nasce na porta, depois das conferências')
    this.#siteId = siteId
    this.#userId = userId
    this.#keyId = keyId
    this.#venceEm = venceEm
    Object.freeze(this)
  }
  get siteId(): string { return this.#siteId }
  get userId(): string { return this.#userId }
  get keyId(): string { return this.#keyId }
  get venceEm(): string { return this.#venceEm }

  static {
    marca = (e: unknown): boolean => typeof e === 'object' && e !== null && #siteId in e && #userId in e && #keyId in e && #venceEm in e
  }

  /** Só `fabricarProva` chama. */
  static fabricar(siteId: string, userId: string, keyId: string, venceEm: string): ChaveDoPerfilProvada {
    return new ChaveDoPerfilProvada(siteId, userId, keyId, venceEm, CHAVE)
  }
}

// a classe congelada: nem `fabricar` se troca por fora
Object.freeze(ChaveDoPerfilProvada)

/** O fabricante: a única porta para criar a prova. Quem chama é `porta.ts`, no caminho em que tudo foi conferido. */
export const fabricarProva = (siteId: string, userId: string, keyId: string, venceEm: string): ChaveDoPerfilProvada =>
  ChaveDoPerfilProvada.fabricar(siteId, userId, keyId, venceEm)

/** Em tempo de execução: o valor foi construído por `fabricarProva` (brand check dos campos privados; um objeto forjado, ainda que com cast, não passa). */
export const chaveProvada = (x: unknown): x is ChaveDoPerfilProvada => marca(x)
