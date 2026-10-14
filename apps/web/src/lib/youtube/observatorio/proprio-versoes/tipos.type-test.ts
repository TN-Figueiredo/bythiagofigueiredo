// Prova de TIPO de que nenhuma escrita carrega a origem 'cms' (item 203). Sem efeito em execução: ninguém importa este arquivo e
// tudo está dentro de uma função que ninguém chama. O `tsc` do web (gate do pre-commit) COMPILA este arquivo (os testes ficam fora
// do tsconfig, então um `@ts-expect-error` em teste nunca é checado): o erro abaixo vira TS2578 se `OrigemGravavel` voltar a
// aceitar 'cms'. Não acrescente nada fora da função. (portão 14/10, Yannis I2)
import type { OrigemGravavel } from './tipos'

export function provasDeTipo(): void {
  const ok: OrigemGravavel = 'ab_lab'
  // @ts-expect-error 'cms' é só de leitura
  const ruim: OrigemGravavel = 'cms'
  void [ok, ruim]
}
