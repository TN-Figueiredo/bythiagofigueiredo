// Prova de TIPO (a mesma ideia de `lib/.../proprio/edicao.type-test.ts`): `muitosProprios` é obrigatório no cabeçalho do canal próprio. O fallback antigo
// (`obs.ownChannels()`) LANÇA no conjunto de UM canal, que é o que a página do canal lê; quem esquecesse o parâmetro só descobria no navegador.
// Sem efeito em execução (ninguém importa este arquivo, nada o chama). O `tsc` do web COMPILA este arquivo: o `@ts-expect-error` vira erro TS2578 se a
// chamada sem `muitosProprios` voltar a compilar. Não acrescente nada fora da função.
import type { Observatory } from '@/lib/youtube/observatorio'
import { buildProprioHeader } from './header-model'
import type { DadosDoCanal } from './dados'

export function provasDeTipo(obs: Observatory, dados: DadosDoCanal): void {
  // @ts-expect-error falta `muitosProprios`
  const semParametro = buildProprioHeader(obs, 'c', dados, { hoje: '2026-01-01', dm: d => d, posicao: null })
  const comParametro = buildProprioHeader(obs, 'c', dados, { hoje: '2026-01-01', dm: d => d, posicao: null, muitosProprios: false })
  void [semParametro, comParametro]
}
