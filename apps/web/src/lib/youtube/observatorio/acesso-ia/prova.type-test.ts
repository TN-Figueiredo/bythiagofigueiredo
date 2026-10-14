// Prova de TIPO de que a prova da chave do perfil não se fabrica. Sem efeito em execução: ninguém importa este arquivo, e tudo
// está dentro de uma função que ninguém chama. O `tsc` do web (gate do pre-commit) COMPILA este arquivo (os testes ficam
// fora do tsconfig): cada `@ts-expect-error` abaixo vira erro TS2578 se a linha seguinte deixar de dar erro, isto é, se o
// construtor virar público, o campo privado sair ou a classe voltar a ser estendível. Não acrescente nada fora da função.
import { ChaveDoPerfilProvada } from './prova'

export function provasDeTipo(): void {
  // @ts-expect-error um objeto literal não é uma ChaveDoPerfilProvada (faltam os campos privados)
  const literal: ChaveDoPerfilProvada = { siteId: 's', userId: 'u', keyId: 'k', venceEm: 'v' }
  // @ts-expect-error o construtor é privado
  const novo = new ChaveDoPerfilProvada('s', 'u', 'k', 'v', Symbol('chave'))
  // @ts-expect-error o construtor é privado, então a classe não se estende
  class Sub extends ChaveDoPerfilProvada {}
  void [literal, novo, Sub]
}
