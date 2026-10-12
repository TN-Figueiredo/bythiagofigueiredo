// Prova de TIPO de que o token de edição não se fabrica. Sem efeito em execução: ninguém importa este arquivo, e tudo
// está dentro de uma função que ninguém chama. O `tsc` do web (gate do pre-commit) COMPILA este arquivo (os testes ficam
// fora do tsconfig): cada `@ts-expect-error` abaixo vira erro TS2578 se a linha seguinte deixar de dar erro, isto é, se o
// construtor virar público, o campo privado sair ou a classe voltar a ser estendível. Não acrescente nada fora da função.
import { EdicaoDoSite } from './edicao'

export function provasDeTipo(): void {
  // @ts-expect-error um objeto literal não é um EdicaoDoSite (falta o campo privado)
  const literal: EdicaoDoSite = { siteId: 'site-1' }
  // @ts-expect-error o construtor é privado
  const novo = new EdicaoDoSite('site-1', Symbol('chave'))
  // @ts-expect-error o construtor é privado, então a classe não se estende
  class Sub extends EdicaoDoSite {}
  void [literal, novo, Sub]
}
