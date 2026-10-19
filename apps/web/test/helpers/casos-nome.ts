/**
 * Tabela única de paridade entre `normalizarNome` (a tela) e `obs_nome_normalizado` (o banco). Vale nos dois testes: o unitário (`remover-model`)
 * e o de integração da F1 (com `HAS_LOCAL_DB=1`). Cada linha é [digitado, nome do canal, deve conferir].
 */
export const CASOS_NOME: Array<[string, string, boolean]> = [
  ['  Ryan Otis ', 'Ryan Otis', true],
  ['Ryan Otis ', 'Ryan Otis', true],
  ['Ryan Otis', 'Ryan Otis', true],
  ['\tRyan Otis', 'Ryan Otis', true],
  ['ryan otis', 'Ryan Otis', true],
  ['RYAN OTIS', 'Ryan Otis', true],
  ['Ryan  Otis', 'Ryan Otis', true],
  ['﻿Ryan Otis', 'Ryan Otis', true],
  // caracteres de largura zero somem (não viram espaço), como na F1 r2
  ['Canal', 'Ca​nal', true],
  ['Canal', 'Ca⁠nal﻿', true],
  ['Ca​nal', 'Canal', true],
  ['Ca nal', 'Ca​nal', false],
  ['ÉDEN', 'Éden', true],
  ['SÃO', 'são', true],
  ['Eden', 'Éden', false],
  ['Sao', 'São', false],
  ['ryan otic', 'Ryan Otis', false],
  ['', '', false],
  ['   ', '', false],
]
