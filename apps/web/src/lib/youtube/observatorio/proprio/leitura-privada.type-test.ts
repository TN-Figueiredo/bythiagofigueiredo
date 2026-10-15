// Prova de TIPO de que o token de leitura não se fabrica nem se confunde com o de edição. Sem efeito em execução: ninguém
// importa este arquivo. O `tsc` do web COMPILA este arquivo: cada `@ts-expect-error` abaixo vira erro TS2578 se a linha seguinte
// deixar de dar erro. Não acrescente nada fora da função.
import { LeituraPrivadaDoSite } from './leitura-privada'
import type { EdicaoDoSite } from './edicao'

export function provasDeTipo(l: LeituraPrivadaDoSite, e: EdicaoDoSite): void {
  // @ts-expect-error um objeto literal não é um LeituraPrivadaDoSite (falta o campo privado)
  const literal: LeituraPrivadaDoSite = { siteId: 'site-1' }
  // @ts-expect-error o construtor é privado
  const novo = new LeituraPrivadaDoSite('site-1', Symbol('chave'))
  // @ts-expect-error o construtor é privado, então a classe não se estende
  class Sub extends LeituraPrivadaDoSite {}
  // @ts-expect-error uma leitura não é uma edição: ler não autoriza escrever (item 170)
  const comoEdicao: EdicaoDoSite = l
  // @ts-expect-error uma edição não é uma leitura: a conversão só existe dentro de provarAcessoPrivado
  const comoLeitura: LeituraPrivadaDoSite = e
  void [literal, novo, Sub, comoEdicao, comoLeitura]
}
