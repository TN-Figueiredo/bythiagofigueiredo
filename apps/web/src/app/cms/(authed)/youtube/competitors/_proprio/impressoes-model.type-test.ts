// Prova de TIPO (a mesma ideia de `header-model.type-test.ts`): `hoje` é obrigatório em `buildImpressoes`. Opcional, quem esquecesse (as telas do canal e do vídeo)
// perdia o aviso "A coleta de relatórios deste canal parou em dd/mm." em silêncio, e o sistema falha em verde. Sem efeito em execução (ninguém importa
// este arquivo). O `tsc` do web COMPILA este arquivo: o `@ts-expect-error` vira erro TS2578 se a chamada sem `hoje` voltar a compilar.
import { buildImpressoes } from './impressoes-model'

export function provasDeTipo(): void {
  // @ts-expect-error falta `hoje`
  const semHoje = buildImpressoes([], null, { escopo: 'canal', alturaArea: 180, dm: d => d, acesso: 'ok' })
  const comHoje = buildImpressoes([], null, { escopo: 'canal', alturaArea: 180, dm: d => d, acesso: 'ok', hoje: '2026-01-01' })
  void [semHoje, comHoje]
}
