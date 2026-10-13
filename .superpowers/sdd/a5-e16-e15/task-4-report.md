# Tarefa 4 — tipos, motivos, período, relógio, definições e RULES.hourly

Arquivos (apps/web): src/lib/youtube/agenda/{tipos,motivos,periodo,relogio,catalogo}.ts (novos); src/lib/youtube/observatorio/rules.ts (+ `hourly`); test/youtube/agenda/{periodo,catalogo,motivos}.test.ts. rules.ts estava limpo antes.

Vermelho (antes do código): 3 arquivos falharam na importação ("Test Files 3 failed, no tests").
Verde: test/youtube/agenda = 40 testes (13+16+11). tsc limpo (0 erros). check-type-debt = 148.
Vizinhos: test/youtube/observatorio + test-hygiene: 1 falha, só em arquivos ALHEIOS (coleta/criteria-e11.test.ts:213-214, coleta/e11-config.test.ts:53, datas futuras fixas). A minha primeira versão de periodo.test.ts também tinha 2027 fixo; corrigi (virada de ano 2025→2026).

Decisões (o plano não fixa):
- `comPrazo`: prazo <= 0 ou NaN devolve `{estourou:true}` na hora; rejeição ANTES do prazo propaga (não é por causa do prazo); a promessa original sempre ganha `.catch(()=>undefined)`.
- `OBS_AGENDA`: exato `'off'` (OFF, '0', '', ' off' = ligada). `OBS_AGENDA_TASKS_OFF`: nome exato (maiúsculas NÃO casam, vão para `desconhecidas`, visível); duplicado desconhecido aparece 1 vez; tarefa `nuncaDesliga` ignorada e NÃO entra em `desconhecidas`; `__proto__`/`constructor` tratados como desconhecidos.
- `codigoDoMotivo`/`fraseDoMotivo`: lookup por hasOwnProperty (`__proto__`, `constructor` caem em `motivo_desconhecido`). `fraseDe` só é chamada para código do catálogo da própria tarefa, com `detalhe` filtrado a números finitos; vazio/lança/vazio-após-trim = fixa; corte em 160.
- `resumoTecnico`: classe só se `^[A-Za-z][A-Za-z0-9_]{0,59}$` (senão 'Error'; não-objeto = 'desconhecido'); sqlstate só `^[0-9A-Z]{5}$`.
- Teste de `LIMITE_FUNCAO_MS` lê o texto de route.ts (regex em `maxDuration`) em vez de importar a rota.
- `tipos.ts` importa só tipos (`SupabaseClient`, `BatchRow` de competitor-sync-batch); nada de agenda/ nem horaria/.
- Comentário de `hourly` em rules.ts é neutro (o plano não diz o sentido de cada chave).
