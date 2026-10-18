# S6/S7 fase 1 (gravação do teste nativo): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** uma tarefa da agenda da A5 lê as leituras da watch que a S4 grava dos vídeos do canal próprio, roda a regra da S3 e grava o registro do teste nativo (`ab_native_tests`) e uma avaliação por rodada (`ab_native_avaliacoes`), inclusive do que a S4 já gravou antes de a fase 1 entrar; o Cowork lê os dois por GET.

**Architecture:** núcleo puro em `apps/web/src/lib/youtube/teste-youtube/registro/` (escritas conhecidas, evidência, decisão, reprodução do passado), uma camada de leitura paginada e a tarefa `registro_teste_nativo` no catálogo da agenda (leve, horária, reaberta a cada disparo por `devidaPeloDado`). Uma migration (três tabelas, a de liberação da fase 2 vazia, quatro funções, nenhum CHECK de tabela existente: o `ab_test_restores_estado_check` é da S8-F1). A migration nasce logo depois da T6 e não depende de código nem da S4/S8-F1 aplicadas. Nada escreve no YouTube nem em tabela do A/B que já existe.

**Tech Stack:** Next.js 16, TypeScript 5 estrito, Zod, Supabase (PostgREST + plpgsql), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-ab-s6-s7-guarda-e-nativo-design.md` (r2, acordo de Phil e Yannis). Este plano não o reescreve: cita seções (§) e só registra decisões que o spec deixou ao plano, as pendências e os desvios. Depende do plano da S4: `docs/superpowers/plans/2026-10-18-a5-s4-tc-coleta-plan.md` (Tarefas 7, 8, 9, 10, 12).

---

## 0. Onde se trabalha, pré-requisitos e convenções

- Árvore `~/Workspace/bythiago-ab-p4a`, branch `lote/ab-s6-s8` (base `origin/staging`). `W=~/Workspace/bythiago-ab-p4a`, `SAIDA=$W/.superpowers/sdd/ab-lab/s7-f1-saida` (saída de teste vai para arquivo; no contexto entram só as falhas).
- **Pré-requisito de código (bloqueia só a T7 em diante; T1 a T6 não dependem da S4, Yannis D5):** o lote da S4 no `origin/staging` com `apps/web/src/lib/youtube/watch/puro.ts` (`leiturasDoBanco`, tipos `LinhaLeituraBanco`, `LinhaThumbBanco`) e `watch/rodada.ts` (`RODADA`, `periodoMin`); bastam esses dois commits, não o lote inteiro. Antes de cada tarefa: `git -C $W pull --rebase origin staging`. Se a S4 renomear algo do contrato (pedido P4 do spec §10), o plano para e volta ao controlador. **O atraso da S4 atrasa o código (sem data), não a migration.**
- **Pré-requisito de banco (fila):** Migration A (aplicada 18/10 21:35 UTC; `20261018000003`, `2f7121ad5`, já no `origin/staging` mas **não** nesta árvore: trazer com o `pull --rebase` antes da T6). A migration desta fase **não depende da S4 nem da S8-F1 aplicadas** (Phil D6, Yannis D5): `yt_watch_reter` é `plpgsql` (não confere `yt_watch_alvos` ao criar) e o CHECK de `ab_test_restores.estado` é da S8-F1. Ela só precisa nascer por `npm run db:new ab_lab_s7_teste_nativo` com timestamp posterior à última migration e ser aplicada em qualquer dia de migration até 29/10 23:59 UTC, logo depois da T6 e do portão da migration (T6b), sem esperar T7 a T10. A ordem na fila continua a combinada com a A5 (ok escrito dela para `yt_watch_reter` antes do `db:new`). O SQL vive em `$W/.superpowers/sdd/ab-lab/s7-f1-migration.sql` (fora do git: `.superpowers/` está no `.gitignore`) e é ensaiado no `bythiago_int` (54421/54422).
- TDD com vermelho **por asserção**. **Passo 0 de toda tarefa com código novo:** criar o arquivo de produção com as assinaturas de "Interfaces" e corpo `throw new Error('não implementado')`, e rodar o teste: tem de falhar por asserção ou pelo `throw` do stub, nunca por "módulo não encontrado". Nenhum teste novo usa `toThrow()` contra função do stub (passaria vazio). Lib pura sob `// @vitest-environment node`. Commit por caminho explícito (`git add <caminhos>`), nunca `git add -A`, nunca stash/reset. **Nunca `git add` em `.superpowers/`** (ignorado; o `add` falha). Sem `any`.
- **Ambiguidades fechadas para o executor (Yannis D8):** (i) a ordem das chaves de `votos` é a de `veredito.campos.titulo.variantes`; (ii) o rascunho SQL é aplicado **de verdade** no 54422 com `psql -f`, duas vezes, antes da suíte de integração, e os testes só leem (P8); (iii) permissão de função se testa por `has_function_privilege`, **nunca chamando a função como `authenticated`** (SIGSEGV no 54422); (iv) `feitas = avaliados`, `deixadas = sobrou`; (v) nome da coluna de `ab_tests` é `youtube_video_id` (uuid de `youtube_videos.id`).
- Arquivos que outras frentes tocam: `agenda/definicoes.ts`, `agenda/catalogo.ts`, `test/youtube/agenda/catalogo.test.ts` (S4, S8), `api-registry.ts`, `cowork-docs-youtube.md`, `mcp/tools.ts`, `mcp/services/ab-tests.ts`. Editar por último na tarefa e com `pull --rebase` logo antes.

## Global Constraints

- **Lista proibida (G0, condição do P2 do dono):** o lote não toca `apps/web/src/lib/youtube/ab-settle.ts`, `ab-settle-decidir.ts`, `ab-rotate-phases.ts`, `ab-rotate-claim.ts`, `ab-evaluate-phases.ts`, `ab-watchdog-drift.ts`, `ab-apply.ts`, `ab-metadata.ts`, `ab-start.ts`, `ab-restore.ts`, `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`, nem `apps/web/src/lib/youtube/watch/**` (código da A5). Conferido por `git diff --name-only origin/staging...HEAD` na T10.
- O registrador só escreve em `ab_native_tests`, `ab_native_avaliacoes` e nas RPCs `yt_watch_reter`, `ab_native_poda` e `ab_native_reproduzir` (C-6); lê por `ab_native_ultimas`.
- `AB_NATIVO_REGISTRO`: só o valor exato `on` liga (`ligaCom`); ausente = desligada.
- Regra da S3 inalterada em comportamento: `REGRA_TESTE_YOUTUBE_VERSAO` continua `1`.
- `FRESCOR_MAX_MS = 8 h 40 min` = soma nominal 8 h 00 + `MARGEM_FRESCOR_MS` 40 min (§6.2 item 4; pendência 1); definida na T7 (depende de `periodoMin`/`RODADA` da S4).
- Teto do registrador: 30 s próprios, `comecaAteMs 60_000`, `fimAteMs 88_000`, nenhuma ida ao banco depois de `t0 + 83_000`; no máximo 8 vídeos por disparo (2 deles de reprodução), paralelo 4.
- Janela das leituras `JANELA_V14_MS = 14 d`, `JANELA_V48_MS = 48 h`; reprodução lê até `RETENCAO_S4_MS + JANELA_V14_MS = 44 d`.
- `sem_rodada_nova` no máximo 1 a cada `INTERVALO_SEM_RODADA_MS = 6 h` por vídeo; erro repetido: no máximo uma tentativa a cada `RETENTATIVA_ERRO_MS = 55 min`; erro igual **só regrava a linha de erro se ela for a avaliação mais recente do vídeo** (Phil D3).
- Evidência: teto 1.000 entradas, as mais recentes, `evidencia_cortada = true` ao cortar. Retenção pedida: `ultima_vista + 365 d`. Poda das avaliações: 180 d.
- RLS: `select` só com `can_edit_site(site_id)`; sem policy de escrita; `revoke all from anon`; `revoke insert, update, delete, truncate from authenticated`.
- Push por sha literal em `bash -c`, fora das janelas 07:50–08:10, 09:50–10:10, 11:50–12:10, 19:50–20:10 UTC.

## Review Focus

1. **T19 girando todo dia** (`Uy5_DPzoGi8`): a propagação de cada rotação não pode virar `provavel_teste` nem registro `detectado`. Teste na T4 (rotação diária com escritas conhecidas por 14 dias → nenhum `criar`).
2. **Dado ausente nunca vira verde:** tabela da S4 ausente, alvo sem `youtube_videos` e falha na lista dão `parcial` com motivo; zero candidatos dá `ok` mas sempre com `detalhe.sem_candidatos 1` e `antigos_fora` visíveis (Yannis D4; a coleta parada é cobrada pela prova da S4). Testes na T8.
3. **Inserção concorrente da coleta entre páginas** e empate de `lida_em`: nada repetido nem pulado (C-3). Teste na T7.
4. **Instante com `+00:00`** (como o PostgREST devolve) nas escritas conhecidas é aceito pela regra; instante sem fuso vira avaliação `erro` só daquele vídeo (C-5). Testes na T2 e na T8.
5. **Registro que nunca fecha:** alvo que saiu da coleta com registro aberto vai a `sem_desfecho` pelo motivo certo (`coleta_encerrada` ou `sem_leitura_depois`); registro encerrado não reabre pelas mesmas leituras (C-8, C-8b, C-7d). Testes na T4.

---

## 1. Pendências do acordo (uma a uma)

| # | Pendência | Fechamento neste plano | Onde |
|---|---|---|---|
| 1 | `MARGEM_FRESCOR_MS` nomeada | `FRESCOR_MAX_MS = somaFrescorNominalMs() + MARGEM_FRESCOR_MS`; soma nominal 8 h 00 a partir de `periodoMin(4)`, `RODADA.sorteioMin` e `PERIODO_DISPARO_MS`; margem 40 min. O texto "8 h 20" do spec é a soma com 20 min de folga; o adotado é 8 h 40 (folga de 40 min). A constante e o teste C-10c ficam na T7, porque dependem do código da S4 | T7 |
| 2 | Quarentena: frase única | **Portão C-17b (fase 2), frase única:** passa se, com ≥ 3 rotações seguidas do T19, toda rodada misturada com escrita do app nas 6 h anteriores está a ≤ `quarentenaEscritaMs` (60 min) da escrita (p100 ≤ 60 min) **e** p95 ≤ 45 min; senão a quarentena da fase 2 passa a p100 medido + 30 min, arredondado para cima em 5 min. "p95 + 15" sai (p100 + 30 sempre o domina). Sem dado (menos de 3 rotações medidas) = não passou | T3 (medida), §4 |
| 3 | Prioridade dos devidos | Ordem fixa: (1) vídeo com teste nosso aberto; (2) vídeo com registro `em_andamento`; (3) alvo próprio com rodada nova, a mais antiga primeiro (a primeira avaliação de um vídeo sem avaliação herda o nível do motivo: teste nosso 1, alvo ativo 3, saído 5; Yannis P4); (4) `sem_rodada_nova`; (5) reprodução do passado (máx. 2 por disparo). Os ~300 antigos (2ª entrega, P4) entram no nível 3 com peso abaixo dos de ≤ 14 d e nunca à frente de (1) e (2) | T7 |
| 4 | Zerar `guarda_adiada_desde` ao liberar | Restrição herdada da fase 2 (a coluna é escrita só pela rotação da fase 2) | §4 |
| 5 | TOCTOU de até 55 s | Restrição herdada da fase 2: a guarda lê a avaliação antes da reivindicação; uma avaliação nova nos ≤ 55 s seguintes não é vista naquela escrita. Declarado, aceito | §4 |
| 6 | "Devido no disparo seguinte" × "uma tentativa por hora" | Fixado: depois de uma avaliação com erro, o vídeo volta a ser devido no primeiro disparo com `agora − erro.avaliada_em ≥ RETENTATIVA_ERRO_MS` (55 min), ou seja, o 3º disparo depois do erro (≤ 60 min). Atende C-4 ("volta a ler em ≤ 1 h"). Erro igual só regrava a linha se for a avaliação mais recente (Phil D3) | T8 |
| 7 | A regra expõe os textos por rodada | Nova função pública `rodadasDeTitulo` na regra (mesma montagem interna, sem mudar veredito) | T1 |
| 8 | Liberação do dono vence `avaliacao_velha` | Restrição herdada da fase 2: com liberação vigente, `avaliacao_velha` não bloqueia (item 3 do §6.2 vem antes do 4); só `provavel_teste` depois da liberação bloqueia. Declarado | §4 |
| 9 | `ab_test_restores.em`: escrita ou reivindicação | A fase 1 trata `em` como instante de escrita (é o que a regra quer). Medido depois do deploy pela consulta Q9 (§5): `em − ab_test_cycles.ended_at` do mesmo teste; mediana > 60 s = `em` é a escrita; perto de 0 = reivindicação, e a fase 2 soma a duração da restauração à janela | T2, §5 |
| 10 | Automático com bloqueio passageiro (Phil N-1) | Leitura fixada para o plano da fase 2: `falha_api`, `duracao_maxima` e `drift` com motivo passageiro **adiam a saída** (não chamam `restaurarCampos` sem `PasseGuarda`); passadas 24 h do 1º adiamento, saem como `teste_youtube` com o gatilho em `restore_status[campo].motivo`. C-15 ganha os três casos (adiado < 24 h, `teste_youtube` > 24 h, por gatilho). Nada disso no código da fase 1 | §4 |
| 11a | C-10c soma 8 h 20 × constante 8 h 40 | Ver item 1 | T2 |
| 11b | `fimAteMs` 88 s × teto 30 s | Prazo interno `ateMs = min(inicio + 30_000, t0 + 83_000)`; os 5 s até 88 s são do relato da agenda | T8 |
| 11c | `updated_at` sem gatilho no CAS | Gatilho `before update` em `ab_native_tests` grava `updated_at = clock_timestamp()`; o CAS compara com o texto lido, que vai e volta como texto cru do PostgREST, nunca por `Date` (teste de ida e volta na T6; Yannis D3). CAS perdido: relê e reavalia uma vez; na 2ª perda soma `detalhe.cas_perdido`, não grava a avaliação e o vídeo conta como falha | T4, T6, T8 |
| 11d | `coleta_encerrada` × `sem_leitura_depois` | `coleta_encerrada` = havia leitura votante depois de `ultima_vista`, a última há > 48 h, sem sufixo estável (vem da regra). `sem_leitura_depois` = nenhuma leitura votante depois de `ultima_vista` e `ultima_vista` há > 48 h (decisão do registrador; a regra devolve `depois_sem_leitura`). C-8b usa o 1º; C-7d o 2º | T4 |
| 11e | C-17b sem dado = não passou | Escrito no item 2 | §4 |
| 12 | P5 com ressalvas | Decisão do dono (P4): os ~300 antigos ficam para uma **2ª entrega**, (D2 da A5 fechada como sim em 18/10; ~35 antigos) com a conta das leituras da S4 deles; o frescor dos antigos (1 rodada/dia) será por período do alvo (`frescorMaxMs(rodadasPorDia)` = `periodoMin(r)` + 2 × sorteio + 3 × 20 min + margem), senão ~1.200 linhas/dia de `sem_rodada_nova`. **Limite da 1ª entrega:** teste nativo em vídeo próprio com mais de 14 dias e sem teste nosso não é registrado; para isso `lerCandidatos` deixa de fora alvos com `rodadas_por_dia = 1` sem teste nosso nem registro aberto e os conta em `detalhe.antigos_fora` (Phil D5). **D2 da A5 = sim (18/10): o filtro fica ativo**; o falso `sem_rodada_nova` (~3 linhas/dia por antigo, ~35 antigos) só some com ele | T7, §4 |

**CHECKs (correção do controlador, 18/10; decidido por Phil e Yannis na r1: B1):** o plano da S8-F1 (`docs/superpowers/plans/2026-10-18-ab-s8-f1-gravacao-plan.md`) reescreve `ab_test_cycles_end_reason_check` (+ `teste_youtube`, `regra_v2`), `ab_tests_restore_status_shape` (+ `pulado_teste_youtube` nos dois ramos) **e, como 4ª reescrita, `ab_test_restores_estado_check`** (+ `pulado_teste_youtube`). **A S8-F1 é a dona desse CHECK**: o gatilho `tg_ab_tests_restore_log` copia `restore_status[campo].estado` para `ab_test_restores.estado`, e o próprio teste C-10a da S8-F1 grava `pulado_teste_youtube` e esbarraria em `23514` dentro do gatilho se o CHECK ficasse para depois; `shape` e tabela são um invariante só e mudam juntos. **Esta fase não reescreve nenhum dos três** e a migration dela não depende da S8-F1. Fica aqui só uma conferência informativa na T10 (Passo 2b), depois de a S8-F1 aplicada; a suíte da T6 não depende dela. A fase 2 não começa sem a S8-F1 aplicada. Avisar o controlador de que o plano da S8-F1 muda (bloqueante lá também).

**Desvios do spec declarados neste plano (precisam do ok de Phil e Yannis na r2):**
- **Critério de "devido" (Yannis D6):** o spec §5.2 (a) usa `lida_em > ate_lida_em` da última avaliação sem erro; o plano usa `alvo.ultima_rodada_em > ultimaOkEm` (`ultima_ok_em` exclui `erro` e `sem_rodada_nova`). Só é igual porque `leitura_watch` (5.9) roda antes, no mesmo disparo e em série, então `ultima_rodada_em < avaliada_em`; rodada partida (1 a 2 leituras) não atualiza `ultima_rodada_em` e fica para a seguinte. Testes na T7 (rodada gravada no mesmo disparo é devida; rodada partida não é; `ultima_rodada_em` igual a `ultimaOkEm` não é).
- **`sem_candidatos` com tabelas legíveis é `ok`, não `parcial` (Yannis D4, muda o spec §5.5):** a S4 mediu 0 vídeos próprios com ≤ 14 d; zero candidatos é o estado normal depois do E8 e como `parcial` deixaria o vigia (`saude.ts`) atrasado para sempre. A coleta parada já é cobrada pela prova da S4. `parcial` fica para `schema_ausente`, `lista_falhou`, `video_falhou`, `sobrou`.
- **`end_reason` das escritas:** `ended_at` entra com `end_reason !== null && !== 'rotacao'` (igual ao spec F4/§6.3); inclui `regra_v2` e valores futuros (falhar para o lado da quarentena).
- **`ab_native_avaliacoes.aviso`** (coluna nova, Phil D4) para `variantes_demais`; **`retroativa`**; poda a cada disparo em lote de 500; RPC `ab_native_reproduzir` (T5/T6).
---

## 2. Arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `src/lib/youtube/teste-youtube/rodadas.ts` (+ `index.ts`) | `rodadasDeTitulo`: rodadas públicas da regra | T1 |
| `src/lib/youtube/teste-youtube/registro/constantes.ts` | constantes nomeadas (sem a soma de frescor, que depende da S4) | T2 |
| `.../registro/frescor.ts` | `somaFrescorNominalMs`, `FRESCOR_MAX_MS` (importa `watch/rodada`) | T7 |
| `.../registro/escritas.ts` | `escritasDoApp` | T2 |
| `.../registro/evidencia.ts` | `evidenciaPorRodada`, `medidaPropagacao`, `juntarEvidencia` | T3 |
| `.../registro/tipos.ts` | tipos do registro e da avaliação | T3 |
| `.../registro/registrar.ts` | `corteDaJanela`, `decidirRegistro`, `avaliarVideo` | T4 |
| `.../registro/reproduzir.ts` | `reproduzirPassado` (acerto do passado) | T5 |
| `supabase/migrations/<ts>_ab_lab_s7_teste_nativo.sql` (nasce na T6b) | tabelas, gatilho, funções, RLS (sem CHECK de tabela existente) | T6, T6b |
| `.../registro/ler.ts` (servidor) | candidatos, leituras paginadas, escritas, registros | T7 |
| `.../registro/tarefa.ts` (servidor) | um disparo: por vídeo, gravação, retenção, poda, estado | T8 |
| `src/lib/youtube/agenda/{definicoes,catalogo}.ts`, `agenda/tarefas/registro-teste-nativo.ts` | definição e entrada no catálogo | T8 |
| `src/lib/youtube/teste-youtube/registro/serializar.ts`, `src/lib/pipeline/services/youtube-native.ts`, rotas `src/app/api/pipeline/youtube/ab-tests/native/{route.ts,[id]/route.ts}`, `mcp/tools.ts`, `mcp/services/ab-tests.ts`, `api-registry.ts`, `data/pipeline-docs/cowork-docs-youtube.md`, `docs/ops/env-vars.md` | leitura do Cowork | T9 |

Testes em `apps/web/test/youtube/teste-youtube/registro/*.test.ts`, `test/youtube/agenda/catalogo.test.ts` (acrescentar), `test/integration/ab-s7-native-{schema,rls}.test.ts`, `test/pipeline/ab-native-api.test.ts`. Prefixo `@/` = `apps/web/src/`.

---

## 3. Tarefas

### Tarefa 1: a regra expõe as rodadas de título (pendência 7)

**Files:** Create `src/lib/youtube/teste-youtube/rodadas.ts`; Modify `teste-youtube/index.ts` (reexporta); Test `test/youtube/teste-youtube/rodadas.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export interface RodadaTitulo {
    chave: string                                        // Rodada.chave da regra = JSON.stringify([rodadaId, idioma, origemRede]); é a chave da evidência (Yannis P1)
    rodadaId: string; de: string; ate: string            // ISO UTC com Z (min e max lidaEm)
    votos: Record<string, number>                        // chave = texto NORMALIZADO (normalizarTitulo)
    textos: Record<string, string>                       // normalizado → 1º texto cru visto (para mapear à variante)
    longa: boolean; emQuarentena: boolean
    mista: boolean                                       // idêntico ao critério da regra (conta em rodadasMistasTitulo)
    misturada: boolean                                   // !longa && votos com ≥ 2 chaves (inclui as em quarentena)
  }
  export function rodadasDeTitulo(leituras: readonly LeituraWatch[], opts?: OpcoesDeteccao): RodadaTitulo[]
  ```
  Implementação: `resolverOpcoes` → `prepararLeituras` → `montarRodadas` (já existem em `preparar.ts`), só mapeia. `rodadaId` sai de `leituras[0].l.rodadaId`. O arquivo fica na raiz de `teste-youtube/`, coberto pelo `pureza.test.ts`.

- [ ] **Passo 1: testes que falham** (`rodadas.test.ts`):
  - `fixture qIg9: 20 rodadas, 13 mistas` — `rodadasDeTitulo(carregarQIg9().leituras)` tem `length 20`, `filter(r => r.mista).length === 13`, e esse número é igual a `detectarTesteYoutube(...).contagem.rodadasMistasTitulo`.
  - `paridade com a regra nos sintéticos`: para cada cenário de `test/youtube/teste-youtube/sintetico.ts` usado em `detectar.test.ts`, com e sem `escritasConhecidas`, `mista` contado = `contagem.rodadasMistasTitulo` e `emQuarentena` contado = `contagem.rodadasEmQuarentena`.
  - `misturada inclui a rodada em quarentena`: rodada com 2 textos a 30 min de uma escrita → `emQuarentena true`, `mista false`, `misturada true`.
  - `chave distingue origem` (Yannis P1): duas rodadas com o mesmo `rodadaId` e `origemRede` diferente têm `chave` distinta.
  - `versão da regra não muda`: `REGRA_TESTE_YOUTUBE_VERSAO === 1`.
- [ ] **Passo 0:** criar `rodadas.ts` com a assinatura e `throw new Error('não implementado')`.
- [ ] **Passo 2:** `npx vitest run test/youtube/teste-youtube > $SAIDA/t1.txt 2>&1`; esperado: falham só os novos, por asserção.
- [ ] **Passo 3:** implementar e reexportar em `index.ts`.
- [ ] **Passo 4:** mesmo comando; esperado: todos passam, inclusive `pureza.test.ts`.
- [ ] **Passo 5:** commit `feat: regra do teste do YouTube expõe as rodadas de título (rodadasDeTitulo)`.

### Tarefa 2: constantes e escritas conhecidas (§6.3 peça 1; pendência 9). Não depende da S4

**Files:** Create `registro/constantes.ts`, `registro/escritas.ts`; Test `registro/constantes.test.ts`, `registro/escritas.test.ts`, `registro/pureza.test.ts`.

**Interfaces:**
- Consumes: `PADROES_DETECCAO`, `EscritaConhecida` da regra. (`RODADA` e `periodoMin` da S4 só entram na T7.)
- Produces:
  ```ts
  // constantes.ts
  export const PERIODO_DISPARO_MS = 20 * 60_000
  export const DISPAROS_DE_ATRASO = 2
  export const MARGEM_FRESCOR_MS = 40 * 60_000
  export const JANELA_V14_MS = 14 * 86_400_000, JANELA_V48_MS = 48 * 3_600_000
  export const RETENCAO_S4_MS = 30 * 86_400_000, JANELA_REPRODUCAO_MS = RETENCAO_S4_MS + JANELA_V14_MS
  export const INTERVALO_SEM_RODADA_MS = 6 * 3_600_000, RETENTATIVA_ERRO_MS = 55 * 60_000
  export const JANELA_PROPAGACAO_MS = 6 * 3_600_000            // §6.3 peça 3
  export const EVIDENCIA_TETO = 1000, RETENCAO_PEDIDA_MS = 365 * 86_400_000, PODA_AVALIACOES_MS = 180 * 86_400_000
  export const NOVO_TESTE_APOS_MS = 7 * 86_400_000             // §5.3 p.5 (d)
  // escritas.ts
  export interface LinhasEscrita {
    testes: Array<{ id: string; test_type: string; winner_applied_at: string | null }>
    ciclos: Array<{ test_id: string; started_at: string | null; ended_at: string | null; end_reason: string | null }>
    restauracoes: Array<{ test_id: string; campo: 'title' | 'thumbnail'; escreveu: boolean | null; em: string }>
  }
  export function camposDoTipo(testType: string): CampoTeste[]   // title→[titulo], combo→[titulo,miniatura], thumbnail→[miniatura], outro→[]
  export function escritasDoApp(l: LinhasEscrita, janela: { deMs: number; ateMs: number }): EscritaConhecida[]
  ```
  `escritasDoApp`: `started_at` de todo ciclo; `ended_at` com `end_reason !== null && end_reason !== 'rotacao'` (igual ao spec; inclui `regra_v2`, `teste_youtube` e qualquer valor futuro, o lado seguro da quarentena; Yannis D1); `winner_applied_at`; `restauracoes.em` com `escreveu === true` (`campo` title→`titulo`, thumbnail→`miniatura`). Campo dos três primeiros por `camposDoTipo`. Filtra `em ∈ [deMs, ateMs]`, ordena por `em`, deduplica `(em, campo)`. **Não reescreve `em`** (passa o texto do banco; a regra valida o fuso).

- [ ] **Passo 1: testes que falham:**
  - (C-10c e a sonda de frescor saem desta tarefa: vão para o começo da T7.)
  - `escritasDoApp`: ciclo `rotacao` contribui só `started_at`; `ended_at` de `drift` entra; ciclo `regra_v2` contribui `ended_at`; `end_reason` desconhecido (`'futuro'`) contribui `ended_at`; `restauracoes` com `escreveu false` e `null` ficam fora; `combo` dá duas escritas por instante; fora da janela sai; `em` com `+00:00` passa intacto e `resolverOpcoes({ escritasConhecidas })` não lança; `em` `'2026-10-18 10:00:00'` passa intacto e `resolverOpcoes` lança (quem captura é a T8).
  - `pureza do registro`: os arquivos de `registro/` exceto `ler.ts`, `tarefa.ts` e `frescor.ts` só importam `./`, `../` (da regra), `zod`, `@/lib/youtube/watch/puro` e `@/lib/youtube/watch/rodada`; nenhum `Date.now(` nem `new Date()` (mesmo detector de `pureza.test.ts`, importado dele).
- [ ] **Passo 0:** criar `constantes.ts` (constantes são valores: sem stub) e `escritas.ts` com stub.
- [ ] **Passo 2:** `npx vitest run test/youtube/teste-youtube/registro > $SAIDA/t2.txt 2>&1`; falham por asserção.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** mesmo comando passa.
- [ ] **Passo 5:** commit `feat: registro do teste nativo: constantes nomeadas e escritas conhecidas do app`.

### Tarefa 3: evidência compacta e medida da propagação (§7.1, §6.3 peça 4; pendência 2)

**Files:** Create `registro/tipos.ts`, `registro/evidencia.ts`; Test `registro/evidencia.test.ts`.

**Interfaces:**
- Consumes: `RodadaTitulo` (T1), `EscritaConhecida`, constantes (T2).
- Produces:
  ```ts
  // tipos.ts
  export interface EvidenciaRodada { rodada: string  /* = RodadaTitulo.chave */; de: string; ate: string; votos: Record<string, number>  // chave = índice da variante ("0","1","2") ou "x" (texto fora das variantes)
    mista: boolean; ms_desde_escrita: number | null }
  export interface MedidaPropagacao { mistas48ForaQuarentena: number; minDesdeEscrita: number[] | null }
  export type EstadoAvaliacao14 = 'sem_leitura' | 'insuficiente' | 'nada_visivel' | 'provavel_teste' | 'sem_rodada_nova' | 'erro'
  export interface NovaAvaliacao { avaliadaEm: string; ateLidaEm: string | null; estado14: EstadoAvaliacao14; motivo14: string | null
    estado48: Exclude<EstadoAvaliacao14, 'sem_rodada_nova' | 'erro'> | null; mistas48: number | null; mistas48ForaQuarentena: number | null
    minDesdeEscrita: number[] | null; contagem: ContagemLeituras | null; escritas: number | null; versaoRegra: number
    registroId: string | null; erro: string | null; retroativa: boolean
    aviso: 'variantes_demais' | null }                  // Phil D4: gravado na coluna ab_native_avaliacoes.aviso
  // evidencia.ts
  export function evidenciaPorRodada(rodadas: readonly RodadaTitulo[], variantes: readonly string[], escritas: readonly EscritaConhecida[], desdeMs: number): EvidenciaRodada[]
  /* implementar com Map por `rodada` (O(N)), não find dentro de map (Yannis) */
  export function juntarEvidencia(antiga: readonly EvidenciaRodada[], nova: readonly EvidenciaRodada[]): { evidencia: EvidenciaRodada[]; cortada: boolean }
  export function medidaPropagacao(rodadas48: readonly RodadaTitulo[], escritas: readonly EscritaConhecida[], quarentenaMs: number): MedidaPropagacao
  ```
  - `evidenciaPorRodada`: uma entrada por rodada com `de ≥ desdeMs` (a `primeira_vista` do registro), votos mapeados por `normalizarTitulo(variante) === chave`; `ms_desde_escrita` = `de` − a escrita de título mais próxima **antes** de `de`, só quando essa escrita está a ≤ `JANELA_PROPAGACAO_MS`, senão `null`.
  - `juntarEvidencia`: união por `rodada` (a nova vence), ordem por `de`, corta para as `EVIDENCIA_TETO` mais recentes.
  - `medidaPropagacao` (definição fixada aqui, porque `mista` da regra já exclui a quarentena e o nome do spec ficaria redundante): considera as rodadas `misturada` das últimas 48 h. `minDesdeEscrita` = minutos (inteiro, para baixo) de cada uma até a escrita de título anterior mais próxima nas 6 h, ordenados; `null` quando não há escrita de título em 48 h. `mistas48ForaQuarentena` = quantas dessas têm escrita anterior a ≤ 6 h **e** estão fora da quarentena (a propagação que vazou). C-17b lê as duas colunas.

- [ ] **Passo 1: testes que falham:**
  - C-1 (parte pura) `qIg9 dá 20 entradas, 13 mistas`: com as variantes A/B da fixture e `desdeMs` = início, `evidenciaPorRodada` tem 20 itens, 13 com `mista`, soma de votos `{"0": 29, "1": 31}`, com os índices na ordem de `veredito.campos.titulo.variantes` (ajustar o número ao que a fixture dá, mas fixar um só).
  - C-2 (parte pura) `idempotente`: `juntarEvidencia(e, e)` = `e`; com a mesma rodada de votos diferentes, fica a nova.
  - `teto`: 1.005 entradas → 1.000 mais recentes e `cortada true`.
  - `propagação`: escrita às 10:00; rodada misturada às 10:30 → `minDesdeEscrita [30]`, `mistas48ForaQuarentena 0`; às 11:10 (fora dos 60 min) → `[70]` e `1`; rodada misturada sem escrita em 48 h → `minDesdeEscrita null`, `0`; texto fora das variantes vira chave `"x"`.
- [ ] **Passos 0 a 4:** stub; falhar (`> $SAIDA/t3.txt`), implementar, passar.
- [ ] **Passo 5:** commit `feat: registro do teste nativo: evidência por rodada e medida da propagação`.

### Tarefa 4: decisão do registro (§5.3 passos 3–6, §5.4; pendência 11d)

**Files:** Create `registro/registrar.ts`; Modify `registro/tipos.ts`; Test `registro/registrar.test.ts`.

**Interfaces:**
- Consumes: T1, T2, T3; `detectarTesteYoutube`, `inferirDesfecho`.
- Produces:
  ```ts
  export interface RegistroAberto { id: string; updatedAt: string  /* texto cru do PostgREST (microssegundos e +00:00); NUNCA passar por Date */; origem: 'detectado' | 'confirmado'; campos: CampoTeste[]
    variantesTitulo: string[] | null; votosTitulo: Record<string, number> | null; primeiraVista: string | null; ultimaVista: string | null
    veredito: VereditoTesteYoutube | null; evidencia: EvidenciaRodada[] }
  export interface Fechamentos { encerradoEm: string | null; descartadoEm: string | null }   // do último encerrado/sem_desfecho e do último descartado
  export interface NovoRegistro { id: string; origem: 'detectado'; campos: CampoTeste[]; variantesTitulo: string[]; votosTitulo: Record<string, number>
    tituloOficial: string | null; primeiraVista: string; ultimaVista: string; veredito: VereditoTesteYoutube; versaoRegra: number
    sinaisFracos: SinalFraco[]; evidencia: EvidenciaRodada[]; evidenciaCortada: boolean; miniaturaA: ImagemComparavel | null }
  export type Encerramento = { estado: 'encerrado' | 'sem_desfecho'; desfechoEstado: Desfecho['estado'] | null; desfechoMotivo: string
    desfechoVersaoRegra: number; vencedorTitulo: string | null; encerradoEm: string }
  export type AcaoRegistro =
    | { tipo: 'nada' }
    | { tipo: 'criar'; novo: NovoRegistro }
    | { tipo: 'atualizar'; id: string; lido: string; mudanca: Partial<Omit<NovoRegistro, 'id' | 'origem'>> & { desfecho?: Desfecho } }
    | { tipo: 'encerrar'; id: string; lido: string; fim: Encerramento }
    | { tipo: 'encerrar_e_criar'; id: string; lido: string; fim: Encerramento; novo: NovoRegistro }
    | { tipo: 'desfecho'; id: string; lido: string; desfecho: Desfecho }
  export function corteDaJanela(agoraMs: number, f: Fechamentos): number      // §5.4
  export function decidirRegistro(aberto: RegistroAberto | null, v14: VereditoTesteYoutube, desfecho: Desfecho | null,
    ctx: { agora: string; fechamentos: Fechamentos; novoId: () => string; rodadas: readonly RodadaTitulo[]; escritas: readonly EscritaConhecida[];
           ultimaVotanteDepoisMs: number | null; miniaturaA: ImagemComparavel | null }): { acao: AcaoRegistro; aviso: 'variantes_demais' | null }
  export interface EntradaVideo { leituras: readonly LeituraWatch[]; escritas: readonly EscritaConhecida[]; aberto: RegistroAberto | null
    fechamentos: Fechamentos; agora: string; novoId: () => string; retroativa: boolean }
  export function avaliarVideo(e: EntradaVideo): { acao: AcaoRegistro; avaliacao: NovaAvaliacao }
  ```
- Regras que o spec deixa ao plano:
  - `avaliarVideo`: filtra `leituras` com `lidaEm ≥ corteDaJanela` (e `≥ agora − JANELA_V14_MS`) para `v14`; `≥ agora − JANELA_V48_MS` para `v48`; `desfecho = inferirDesfecho(aberto.veredito, leituras com lidaEm > aberto.ultimaVista, { escritasConhecidas, agora })` só com aberto `detectado` e `veredito` não nulo. `ultimaVotanteDepoisMs` = `lidaEm` da última leitura sem erro com título depois de `ultimaVista`. A `avaliacao` sai preenchida (`estado14` = `v14.estado`, `motivo14` = `detalhe.motivo` ou `motivo`, `estado48`, `mistas48 = v48.contagem.rodadasMistasTitulo`, medida da T3, `contagem = v14.contagem`, `escritas = escritas.length`, `ateLidaEm` = maior `lidaEm` entre as leituras recebidas, `registroId` do aberto ou do novo, `aviso` copiado do `decidirRegistro`). Exceção da regra **não** é capturada aqui (é da T8).
  - Ordem (a)–(e) do §5.3 p.5, a primeira que vale decide. (b) órfão: `ultimaVotanteDepoisMs === null` e `agora − ultimaVista > PADROES_DESFECHO.maxIdadeColetaMs` → `sem_desfecho`, `desfechoMotivo 'sem_leitura_depois'`. (a) com `sem_dado`/`coleta_encerrada` → `sem_desfecho`, `desfechoMotivo 'coleta_encerrada'`. (a) `vencedor_provavel` → `encerrado`, `vencedorTitulo` = `desfecho.vencedor`.
  - (d) atualiza só se algo muda (`ultimaVista` maior, votos ou evidência novos); senão `nada`. União de variantes > `maxVariantes` (3) → `nada` com `aviso 'variantes_demais'`. Aberto `confirmado` com `campos ['miniatura']` recebendo título provável → `mudanca.campos = ['titulo','miniatura']` e os campos de título preenchidos.
  - `descartado`: só cria se `v14.primeiraVista > fechamentos.descartadoEm` (o corte já garante; teste afirma).
- [ ] **Passo 1: testes que falham** (fixtures: `carregarQIg9`, `sintetico.ts`; relógio sempre relativo à fixture):
  - C-1 `qIg9 cria 1 registro detectado` com os dois títulos, votos 29/31, `primeiraVista` = 1ª rodada mista, evidência 20/13.
  - C-2 `mesmas leituras, aberto já gravado` → `nada` (ou `atualizar` sem mudança de evidência; afirmar `tipo 'nada'`).
  - C-7 `sufixo estável de 18 votos B em 24 h` → `encerrar`, `vencedorTitulo` = variante canônica, `desfechoVersaoRegra 1`.
  - C-7b `v14 ainda provável e sufixo estável` → `encerrar` (ordem fixa).
  - C-7c `primeiraVista` 8 d depois da `ultimaVista` aberta → `encerrar_e_criar`, `desfechoMotivo 'teste_novo'`.
  - C-7d `depois só leituras com erro por 49 h` → `sem_desfecho`, `sem_leitura_depois`.
  - C-7f (parte pura) aberto `confirmado` de miniatura + título provável → `campos ['titulo','miniatura']`.
  - C-8 `corte`: encerrado às T; mesmas leituras → `nada` (v14 só vê depois de T); mistura nova depois de T → `criar`.
  - C-8b `alvo saiu, leituras votantes depois, a última há 49 h` → `sem_desfecho`, `coleta_encerrada`.
  - Review Focus 1 `rotação diária por 14 dias`: teste nosso de título, escrita conhecida a cada 24 h, cada rotação com 1 rodada misturada a 30 min e outra a 70 min da escrita → nenhum `criar`; `mistas48ForaQuarentena` = 1 nas avaliações das 48 h seguintes a cada rotação.
  - `variantes_demais`: aberto com 3 variantes e uma 4ª no `v14` → `nada`, `aviso 'variantes_demais'`, e `avaliarVideo(...).avaliacao.aviso === 'variantes_demais'` (Phil D4); sem o caso, `aviso null`.
  - Fronteira do limiar (Yannis P5), com o comentário "limite que o C-17b mede": 2 rodadas misturadas fora da quarentena por rotação do T19 (fração 0,67 ≥ `minFracaoRodadasMistas` 0,4) → `criar`; 1 por rotação → nenhum `criar`.
  - `avaliação sempre sai`: lista vazia → `estado14 'sem_leitura'`, `ateLidaEm null`.
- [ ] **Passos 0 a 4:** stub; `> $SAIDA/t4.txt`; falhar, implementar, passar.
- [ ] **Passo 5:** commit `feat: registro do teste nativo: decisão do registro (ordem fixa, corte, desfecho)`.

### Tarefa 5: acerto do passado (`reproduzirPassado`)

O que a retenção da S4 garante: leituras de alvo ativo ficam todas; depois de o alvo sair, **30 d** (e `ultimaVista + 180 d` quando a extensão da S4 viu `provavel_teste`). Com a fila (S4 no ar por volta de 20–24/10, esta até 29/10), a distância entre a 1ª leitura da S4 e a entrada da fase 1 fica em ≤ 10 d: a reprodução vê **tudo** o que a S4 gravou de vídeo próprio. Ela lê até `JANELA_REPRODUCAO_MS` = 44 d (30 d de retenção + 14 d de janela). **É completa para alvo próprio que saiu; alvo com teste nosso (nunca sai) ou estendido pela S4 pode ter leitura mais velha que 44 d, fora da reprodução** (Phil P6, Yannis P2; não pesa no calendário real).

**Idempotência da gravação (Phil D1/D2, Yannis D2): decisão = RPC atômica `ab_native_reproduzir`, não id determinístico com upsert.** Justificativa: o upsert por id determinístico cobre só o registro; as avaliações continuariam num segundo `insert` e uma falha entre os dois deixaria o vídeo sem avaliação e com registro (ou o contrário), de modo que a reprodução teria de ser desfeita por heurística. A RPC grava registros e avaliações na **mesma transação** e é por si só a trava: `if exists (select 1 from public.ab_native_avaliacoes where video_id = p_video and estado_14 <> 'erro') then return 0`. Duas execuções ou uma falha no meio nunca duplicam nem deixam metade. A guarda ignora linhas `erro` (Phil D1): um erro na 1ª tentativa grava `estado_14 'erro'` fora da RPC e **não** desliga a reprodução; o vídeo volta a ser devido pelo ritmo de 55 min e reproduz na tentativa seguinte.

**Files:** Create `registro/reproduzir.ts`; Test `registro/reproduzir.test.ts`.

**Interfaces:**
- Consumes: `avaliarVideo` (T4), `rodadasDeTitulo` (T1).
- Produces:
  ```ts
  export interface Reproducao { registros: Array<NovoRegistro & { fim: Encerramento | null }>; avaliacoes: NovaAvaliacao[] }
  export function reproduzirPassado(leituras: readonly LeituraWatch[], escritas: readonly EscritaConhecida[], agora: string, novoId: () => string,
    inicial?: { aberto: RegistroAberto | null; fechamentos: Fechamentos }): Reproducao
  ```
  Vale só para vídeo **sem nenhuma avaliação sem erro**. `inicial` (Phil P10): o `aberto` e os `fechamentos` lidos do banco (alvo que volta depois de a poda de 180 d apagar as avaliações); sem ele, parte do estado vazio. Ordena as rodadas por `ate`; para cada rodada `k`, chama `avaliarVideo` com `agora = ate_k + 1 ms`, leituras com `lidaEm ≤ ate_k`, `retroativa: true`, e aplica a ação a um estado em memória. Por fim, um `avaliarVideo` com o `agora` real e `retroativa: false`. Custo O(R·L log L + R²) (≈ 1 milhão de operações para R ≤ 176, L ≤ 528; só no 1º disparo de cada vídeo).
- [ ] **Passo 0:** stub de `reproduzir.ts`.
- [ ] **Passo 1: testes que falham:**
  - `qIg9 reproduzido`: 20 avaliações retroativas + 1 real; 1 registro `detectado` aberto, igual ao da T4 C-1 em variantes, votos e `primeiraVista`.
  - `teste que começou e acabou no passado`: sintético com mistura por 3 dias e depois 18 votos B em 24 h → 1 registro com `fim.estado 'encerrado'` e vencedor B; a última avaliação real não cria registro novo (corte).
  - `pureza`: duas chamadas com o mesmo `novoId` determinístico dão o mesmo resultado (prova a função pura; a idempotência da gravação é da RPC, T6/T8).
  - `inicial` (P10): com `aberto` e `fechamentos` vindos do banco, não recria o registro já fechado.
  - `custo` (P3): um espião em `detectarTesteYoutube` é chamado R + 1 vezes (afirmar a contagem, não o relógio de parede).
- [ ] **Passos 2–4:** `> $SAIDA/t5.txt`; falhar, implementar, passar.
- [ ] **Passo 5:** commit `feat: registro do teste nativo: reprodução das rodadas já gravadas pela S4`.

### Tarefa 6: migration (rascunho ensaiado no `bythiago_int`; o arquivo nasce na T6b)

**Files:** Create `$W/.superpowers/sdd/ab-lab/s7-f1-migration.sql` (rascunho, **fora do git**: `.superpowers/` é ignorado), no dia (T6b) `supabase/migrations/<ts>_ab_lab_s7_teste_nativo.sql` por `npm run db:new ab_lab_s7_teste_nativo`; Test `test/integration/ab-s7-native-schema.test.ts`, `test/integration/ab-s7-native-rls.test.ts` (`describe.skipIf(skipIfNoLocalDb())`).

**Conteúdo** (`set lock_timeout = '5s'`, idempotente):
- (a) As três tabelas do spec §7.1, §7.2, §7.3 **como estão**, mais em `ab_native_avaliacoes`: `retroativa boolean not null default false` (desvio: distingue o acerto do passado) e `aviso text check (aviso is null or aviso in ('variantes_demais'))` (Phil D4); índice `ab_native_avaliacoes_poda on (avaliada_em)`.
- (b) Gatilho `ab_native_tests_updated_at` (`before update`, `new.updated_at := clock_timestamp()`), com `drop trigger if exists` (pendência 11c).
- (c) Funções `security invoker`, `set search_path = ''`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`:
  - `yt_watch_reter(p_site uuid, p_video text, p_ate timestamptz) returns integer` em **`language plpgsql`** (não confere `yt_watch_alvos` ao criar: a migration independe da S4; chamada sem a tabela dá `42P01`, tratado como `retencao_sem_rpc`): `update public.yt_watch_alvos set reter_ate = greatest(reter_ate, p_ate) where site_id = p_site and youtube_video_id = p_video; get diagnostics n = row_count; return n;` (`greatest` do Postgres ignora o nulo, então `reter_ate` nulo vira `p_ate`, e a função nunca diminui). Condição da A5: `revoke execute on function public.yt_watch_reter(uuid, text, timestamptz) from public, anon, authenticated;` e `grant execute ... to service_role`. **Ok da A5 recebido (sessão bythiagofigueiredo-25, 18/10)**, nessas condições: é o mesmo contrato que a poda da S4 respeita (§7/§10).
  - `ab_native_ultimas(p_videos uuid[])` com **consulta lateral** (Phil P1, Yannis D8b), nunca agregação do histórico inteiro:
    ```sql
    create or replace function public.ab_native_ultimas(p_videos uuid[])
    returns table (video_id uuid, alguma boolean, ultima_em timestamptz, ultima_ok_em timestamptz,
                   ultimo_erro_em timestamptz, ultimo_erro text, ultimo_erro_id bigint, ultima_id bigint, ultimo_sem_rodada_em timestamptz)
    language sql stable security invoker set search_path = '' as $$
      select v.id,
             exists (select 1 from public.ab_native_avaliacoes x where x.video_id = v.id and x.estado_14 <> 'erro') as alguma,  -- D1: sem erro, SEM filtro de retroativa
             u.avaliada_em, ok.avaliada_em, er.avaliada_em, er.erro, er.id, u.id, sr.avaliada_em
        from unnest(p_videos) as v(id)
        left join lateral (select a.id, a.avaliada_em from public.ab_native_avaliacoes a
                            where a.video_id = v.id and not a.retroativa order by a.avaliada_em desc limit 1) u on true
        left join lateral (select a.avaliada_em from public.ab_native_avaliacoes a
                            where a.video_id = v.id and not a.retroativa and a.estado_14 not in ('erro','sem_rodada_nova')
                            order by a.avaliada_em desc limit 1) ok on true
        left join lateral (select a.id, a.avaliada_em, a.erro from public.ab_native_avaliacoes a
                            where a.video_id = v.id and a.estado_14 = 'erro' order by a.avaliada_em desc limit 1) er on true
        left join lateral (select a.avaliada_em from public.ab_native_avaliacoes a
                            where a.video_id = v.id and a.estado_14 = 'sem_rodada_nova' order by a.avaliada_em desc limit 1) sr on true;
    $$;
    ```
    (`ultima_id` = a avaliação mais recente do vídeo, qualquer estado; `ultimo_erro_id` = o id da última linha de erro (Phil R2-1). A T8 só regrava erro igual quando `ultimoErroId = ultimaId` e o código é o mesmo. Todas pelo índice `(video_id, avaliada_em desc)`.)
  - `ab_native_poda(p_agora timestamptz, p_lote integer) returns integer`: `if p_lote is null or p_lote < 1 or p_lote > 5000 then raise exception 'p_lote invalido' using errcode = '22023'; end if;` e `delete from public.ab_native_avaliacoes where id in (select id from public.ab_native_avaliacoes where avaliada_em < p_agora - interval '180 days' order by avaliada_em limit p_lote)` (usa o índice `ab_native_avaliacoes_poda`; Yannis P6, Phil P9).
  - `ab_native_reproduzir(p_site uuid, p_video uuid, p_registros jsonb, p_avaliacoes jsonb) returns integer` em **`language plpgsql`** (Yannis D2, R2-2; ver T5): numa transação, **primeiro** `perform pg_advisory_xact_lock(hashtext(p_video::text));` (a 2ª chamada simultânea espera e então vê a guarda), depois `if exists (select 1 from public.ab_native_avaliacoes where video_id = p_video and estado_14 <> 'erro') then return 0; end if;` insere os registros (`jsonb_populate_recordset`) e depois as avaliações e devolve o número de avaliações. Linha inválida em `p_avaliacoes` aborta tudo (nenhum registro fica).
- (d) **Nenhum CHECK de tabela existente aqui.** `ab_test_restores_estado_check`, `ab_tests_restore_status_shape` e `ab_test_cycles_end_reason_check` são da S8-F1 (que é a dona do 4º, decidido por Phil e Yannis na r1).
- (e) RLS do §7.3 nas três tabelas novas.

- [ ] **Passo 1: testes que falham.** O vermelho vem de **uma asserção**, não de `42P01`: cada teste consulta o catálogo (`to_regclass`, `to_regprocedure`, `pg_constraint`, `pg_trigger`) e faz `expect(x).not.toBeNull()` / `toBe(true)`, de modo que o rascunho ausente falha por asserção. Rodam com `HAS_LOCAL_DB=1` contra 54422; **o rascunho é aplicado de verdade com `psql -f` antes da suíte (Passo 3), duas vezes (idempotência), e os testes só leem e escrevem dados dentro de `begin … rollback`** (P8; não há "aplicar em transação pelo helper"). Permissão de função: `has_function_privilege`, nunca chamar como `authenticated` (SIGSEGV).
  - (O caso `pré-requisito` da S8-F1 **saiu desta suíte** (Yannis R2-1): a suíte passa num 54422 sem a migration da S8-F1. Ele vive na T10, Passo 2b, como conferência informativa.)
  - `schema`: `relrowsecurity` nas três; os `check` do §7.1 recusam `estado 'x'`, `campos '{video}'`, `encerrado` sem `encerrado_em`; `aviso 'x'` recusa (`23514`); o índice parcial recusa 2 abertos no mesmo vídeo (`23505`).
  - `updated_at` (CAS, Yannis D3): pelo cliente de serviço contra 54421, `select updated_at` (texto cru) → `update … .eq('updated_at', lido)` devolve 1 linha; um `update` sem a coluna muda o `updated_at`; o mesmo `.eq` com o texto antigo devolve 0; e o teste afirma que o texto lido tem microssegundos e `+00:00`.
  - `funções`: `yt_watch_reter` devolve 1 e nunca diminui `reter_ate`, 0 sem alvo; **criar a função num banco sem `yt_watch_alvos` não falha, e chamá-la dá `42P01`** (D6); `ab_native_ultimas`: `alguma` ignora linhas `erro` e **não** filtra retroativa, `ultima_em` ignora retroativas, `ultima_ok_em` ignora `erro` e `sem_rodada_nova`, devolve o último erro, `ultima_id` e `ultimo_erro_id` (este igual a `ultima_id` só quando a avaliação mais recente é o erro; sequência erro, `sem_rodada_nova`: `ultimo_erro_id` é o do erro e `ultima_id` o da `sem_rodada_nova`; Phil R2-1); `ab_native_poda` apaga só o que tem mais de 180 d, no máximo `p_lote`, e `p_lote` 0 ou 5001 dá `22023`; `ab_native_reproduzir`: a 2ª chamada devolve 0 sem duplicar, `p_avaliacoes` com `estado_14 'x'` não deixa nenhum registro gravado, uma avaliação `erro` anterior **não** impede a reprodução, e **duas chamadas seguidas** (a 2ª só depois de a 1ª confirmar) gravam N e depois 0 sem duplicar; a função tem de ser `plpgsql` e conter `pg_advisory_xact_lock` (conferido em `pg_proc.prosrc`) (Yannis R2-2). A duas conexões simultâneas real não é testada: o lock é por construção.
  - C-9 `RLS`: `anon` sem `select`; editor de outro site não vê; GUC `app.site_id` forjado por não-superusuário não vê; `authenticated` não insere; apagar o usuário de `liberado_por` não falha (`set null`); `has_function_privilege` nega `public`/`anon`/`authenticated` e concede `service_role` nas quatro funções (inclusive `yt_watch_reter`, condição da A5).
- [ ] **Passo 2:** `HAS_LOCAL_DB=1 npx vitest run test/integration/ab-s7-native > $SAIDA/t6.txt 2>&1` sem o rascunho aplicado: falham por asserção.
- [ ] **Passo 3:** escrever o rascunho; aplicar duas vezes no 54422 com `psql -f` (a S4 e a S8-F1 **não** precisam estar lá); rodar de novo.
- [ ] **Passo 4:** mesmo comando do Passo 2 passa.
- [ ] **Passo 5:** commit só dos testes (`git add test/integration/ab-s7-native-schema.test.ts test/integration/ab-s7-native-rls.test.ts`): `test: integração da migration do teste nativo (S7 fase 1)`. O rascunho **não** entra no git (`.superpowers/` ignorado); o arquivo em `supabase/migrations/` entra na T6b.

### Tarefa 6b: portão da migration e aplicação (logo depois da T6; sem esperar T7 a T10)

- [ ] **Passo 1:** portão próprio: Phil e Yannis revisam só o rascunho SQL e os testes da T6 (volume, poda, CAS, funções, RLS). Conserta-se até haver acordo.
- [ ] **Passo 2:** ok da A5 para `yt_watch_reter` **já recebido** (sessão bythiagofigueiredo-25, 18/10, nas condições: revoke de public/anon/authenticated, grant só a `service_role`, `greatest(reter_ate, p_ate)`); registrar a referência no commit. `git fetch`; confirmar fila anotada.
- [ ] **Passo 3:** `npm run db:new ab_lab_s7_teste_nativo`; copiar o rascunho para o arquivo criado.
- [ ] **Passo 4:** Q-CHECK em produção por leitura (`supabase db query --linked`): esperado o que o §5 diz; `npm run db:push:prod`; C-10b (controlador): `relrowsecurity` nas três tabelas e as quatro funções existem.
- [ ] **Passo 5:** `git add supabase/migrations/<ts>_ab_lab_s7_teste_nativo.sql`; commit `feat: migration do registro do teste nativo (S7 fase 1)`; push por sha literal em `bash -c`, fora das janelas; CI verde. O deploy do código (T7 a T10) vem depois e não precisa de migration.

### Tarefa 7: leitura do banco (§5.2, §5.3 p.1–2; pendência 3)

**Files:** Create `registro/frescor.ts`, `registro/ler.ts` (`import 'server-only'`); Test `registro/frescor.test.ts`, `registro/ler.test.ts` (cliente falso de PostgREST, como o de `test/youtube/watch/extensao.test.ts` da S4).

**Interfaces:**
- Consumes: `leiturasDoBanco`, `LinhaLeituraBanco`, `LinhaThumbBanco` (S4); `LinhasEscrita` (T2); `RegistroAberto`, `Fechamentos` (T4); `Lido<T>` de `agenda/tipos.ts`.
- Produces:
  ```ts
  export type Prioridade = 1 | 2 | 3 | 4 | 5
  export interface Candidato { siteId: string; videoId: string; ytId: string; prioridade: Prioridade; motivo: 'teste_nosso' | 'registro_aberto' | 'rodada_nova' | 'sem_rodada_nova' | 'reproduzir'
    ultimaRodadaEm: string | null; aberto: RegistroAberto | null; fechamentos: Fechamentos; ultimas: UltimasAvaliacoes | null }
  export interface UltimasAvaliacoes { alguma: boolean  /* existe avaliação SEM erro */; ultimaEm: string | null; ultimaOkEm: string | null  /* exclui erro e sem_rodada_nova */; ultimoErroEm: string | null; ultimoErro: string | null; ultimaId: number | null  /* avaliação mais recente, qualquer estado */; ultimoSemRodadaEm: string | null }
  export async function lerCandidatos(sb: SupabaseClient, agoraMs: number): Promise<Lido<{ devidos: Candidato[]; semVideo: number; antigosFora: number; total: number }>>
  export async function lerLeiturasPaginadas(sb: SupabaseClient, ytId: string, siteId: string, desdeMs: number, t0Iso: string): Promise<Lido<LeituraWatch[]>>
  export async function lerEscritas(sb: SupabaseClient, videoId: string, janela: { deMs: number; ateMs: number }): Promise<Lido<LinhasEscrita>>
  ```
- `frescor.ts` (importa `periodoMin` e `RODADA` da S4; **primeira peça que depende do código da S4**, abrir a tarefa por ela): `somaFrescorNominalMs()` = `periodoMin(4)·60_000 + 2·RODADA.sorteioMin·60_000 + PERIODO_DISPARO_MS` (coleta) `+ PERIODO_DISPARO_MS` (registrador) `+ DISPAROS_DE_ATRASO·PERIODO_DISPARO_MS`; `FRESCOR_MAX_MS = somaFrescorNominalMs() + MARGEM_FRESCOR_MS`. Testes (movidos da T2): C-10c `somaFrescorNominalMs() === 8 * 3_600_000`, `FRESCOR_MAX_MS === 8 * 3_600_000 + 40 * 60_000`, e o teste **monta a soma** de `periodoMin(4)`, `RODADA.sorteioMin` e `PERIODO_DISPARO_MS` (nenhum número solto além do 2 de "duas pontas"); sonda de Yannis: intervalo nominal de 7,00 h entre rodadas fica abaixo de `FRESCOR_MAX_MS` com folga ≥ 1 h.
- Regras:
  - `lerCandidatos`: alvos `tipo = 'proprio'` (ativos, e saídos há ≤ 30 d para a reprodução). **Deixa de fora** alvos com `rodadas_por_dia = 1` sem teste nosso e sem registro aberto e os conta em `antigosFora` (vai para `detalhe.antigos_fora`, nunca some; Phil D5; D2 da A5 = sim, §1 item 12), paginados; junta `youtube_videos (id, site_id, youtube_video_id)` pelo par `(site_id, youtube_video_id)`; alvo sem par conta em `semVideo`; registros `em_andamento` (todos, inclusive de alvo saído) e o último `encerrado/sem_desfecho/descartado` por vídeo; testes abertos (`ab_tests` com `status not in ('completed','archived')`, por **`youtube_video_id`** = uuid de `youtube_videos.id`; Phil P7); `rpc('ab_native_ultimas', { p_videos })`. **Devido** (pendência 6 e §5.2; critério `ultimaRodadaEm > ultimaOkEm` é desvio declarado no §1): sem avaliação **sem erro** (`alguma false`) → prioridade do motivo do vídeo (teste nosso 1, alvo ativo 3, saído `reproduzir` 5; Yannis P4; o teto de 2 reproduções por disparo vale só para o nível 5); `ultimaRodadaEm > ultimaOkEm` → `rodada_nova`; registro aberto com `ultimaEm` há ≥ 24 h → `registro_aberto`; alvo ativo sem rodada nova há > `FRESCOR_MAX_MS` e `ultimoSemRodadaEm` há ≥ 6 h (ou nulo) → `sem_rodada_nova`; com `ultimoErroEm > ultimaOkEm`, só é devido se `agora − ultimoErroEm ≥ RETENTATIVA_ERRO_MS`. Prioridade do §1 item 3; empate por `ultimaRodadaEm` mais antigo, depois `ytId`.
  - `lerLeiturasPaginadas`: colunas do expansor, `.eq('site_id').eq('youtube_video_id').gte('lida_em', desde).lte('lida_em', t0Iso).order('lida_em').order('id')`, `.range` de 1.000, `count: 'exact'` na 1ª página; **o `updatedAt` do registro aberto sai do PostgREST como texto e nunca passa por `Date`**; soma ≠ `count` → `{ porque: 'paginacao', causa: 'forma_invalida' }`. Miniaturas por `.in('id', miniatura_ids)` em lotes de 500. Expande com `leiturasDoBanco`; `invalidas > 0` vai junto (não é erro).
  - `lerEscritas`: `ab_tests (id, test_type, winner_applied_at)` do vídeo, `ab_test_cycles` (filtro `or(started_at in janela, ended_at in janela)`) e `ab_test_restores` desses testes com o instante na janela, paginados. **Com zero leituras a T8 não chama `lerEscritas`** (a janela fica indefinida): escritas = `[]` (Phil P2).
- [ ] **Passo 1: testes que falham:**
  - C-3 `1.000 + 300 com count 1.300` → 1.300 lidas; `count` 1.301 → `paginacao`; `3 linhas inseridas entre a página 1 e a 2 com lida_em > t0` → 1.300, sem erro; `empate de lida_em` na fronteira da página → nenhuma repetida nem pulada (ordem `lida_em, id`).
  - `prioridade`: T19 (teste nosso) + 12 alvos com rodada nova + 3 reproduções → T19 primeiro, reproduções por último; com 300 alvos `proprio_antigo` simulados, T19 continua o 1º.
  - `alvo sem youtube_videos` → `semVideo 1`, fora de `devidos`.
  - `erro há 40 min` → não devido; `há 56 min` → devido.
  - `sem_rodada_nova`: alvo ativo com `ultimaRodadaEm` há 9 h e `ultimoSemRodadaEm` há 3 h → não devido; há 7 h → devido.
  - `registro aberto de alvo saído`, última avaliação há 25 h → devido `registro_aberto`.
  - `lerEscritas` lê só os testes do vídeo pedido (o cliente falso confere o filtro); ciclo só com `ended_at` na janela também entra.
  - `alvo rodadas_por_dia 1` sem teste nosso nem registro aberto → fora de `devidos`, `antigosFora 1`; com teste nosso, entra.
  - `devido` (Yannis D6): rodada gravada pela watch no mesmo disparo → devida; rodada partida (`ultima_rodada_em` não atualizado) → não devida; `ultima_rodada_em` igual a `ultimaOkEm` → não devida.
  - `primeira avaliação de vídeo novo` (alvo ativo, sem avaliação) → prioridade 3, não 5.
  - `CAS` (Phil P5): `RegistroAberto.updatedAt` sai igual, byte a byte, ao texto do cliente falso (`2026-10-18T21:45:37.471588+00:00`), e o `update` da T8 filtra por esse texto.
- [ ] **Passos 0 a 4:** stub de `frescor.ts` e `ler.ts`; `> $SAIDA/t7.txt`; falhar, implementar, passar.
- [ ] **Passo 5:** commit `feat: registro do teste nativo: frescor, candidatos por prioridade e leitura paginada`.

### Tarefa 8: a tarefa `registro_teste_nativo` (§5.1, §5.3 p.5–7, §5.5; pendências 6, 11b)

**Files:** Create `registro/tarefa.ts`, `agenda/tarefas/registro-teste-nativo.ts`; Modify `agenda/definicoes.ts` (`DEFINICAO_REGISTRO_TESTE_NATIVO` + `TODAS_AS_DEFINICOES`), `agenda/catalogo.ts` (import + entrada), `docs/ops/env-vars.md` (`AB_NATIVO_REGISTRO`); Test `registro/tarefa.test.ts`, `test/youtube/agenda/catalogo.test.ts` (acrescentar).

**Interfaces:**
- Consumes: T4, T5, T7.
- Produces:
  ```ts
  export async function rodarRegistro(c: ContextoTarefa, o?: { novoId?: () => string }): Promise<ResultadoTarefa>
  export const DEFINICAO_REGISTRO_TESTE_NATIVO: Definicao   // definicoes.ts
  export const registroTesteNativo: Tarefa                   // tarefas/registro-teste-nativo.ts, com devidaPeloDado: () => true
  ```
- `DEFINICAO_REGISTRO_TESTE_NATIVO`: `nome 'registro_teste_nativo'`, `rotulo 'registro do teste do YouTube'`, `ordem 5.95`, `peso 'leve'`, `periodo 'hora'`, `tetoTentativas 3`, `toleranciaVigiaH 3`, `naoTerminouVermelhoEm 3` (o contador `unfinished_n` é por linha de período: com `periodo 'hora'` e disparo `*/20` chega no máximo a 3, igual a `leitura_horaria` em `definicoes.ts:20`; com 6 o vigia nunca acenderia; Yannis D4), `comecaAteMs 60_000`, `fimAteMs 88_000`, `ligaCom 'AB_NATIVO_REGISTRO'`. `motivos`: `schema_ausente` (comum), `video_falhou: 'a avaliação de teste do YouTube falhou em algum vídeo'`, (`sem_candidatos` não é motivo: vira `ok` com `detalhe.sem_candidatos 1`), `sobrou: 'ficaram vídeos para o próximo disparo'`, `lista_falhou: 'não foi possível montar a lista de vídeos'`, `gravacao_falhou: 'não foi possível gravar a avaliação'`.
- `rodarRegistro`: guarda `schemaTablesReady` (S4: `yt_watch_alvos`, `yt_watch_readings`, `yt_watch_thumbs`; S7: `ab_native_tests`, `ab_native_avaliacoes`) → `parcial schema_ausente`. `ateMs = min(c.agora() + 30_000, c.t0 + 83_000)`. `lerCandidatos`; até 8 devidos (no máximo 2 `reproduzir`), pool de 4; vídeo que não começa antes de `ateMs` conta em `sobrou`. Por vídeo, dentro de `try/catch` (F9): ler leituras (`desde` = `corteDaJanela` ou `min(corte, aberto.ultimaVista)`, ou `agora − JANELA_REPRODUCAO_MS` na reprodução) → `lerEscritas` na janela `[min lidaEm − quarentena, max lidaEm + maxDuracaoRodada]` → `avaliarVideo` ou `reproduzirPassado` → gravar. `sem_rodada_nova` não lê leitura: grava a avaliação direto.
- Gravação: (1) ação do registro: `insert` (`23505` → relê o aberto e reavalia uma vez no ramo (d); 2º `23505` → erro `corrida`); `update ... .eq('id').eq('estado','em_andamento').eq('updated_at', lido)` com 0 linhas (CAS perdido, Yannis D3) → relê o aberto e reavalia **uma vez** no mesmo disparo (mesmo caminho do `23505`); na 2ª perda não grava a avaliação, soma `detalhe.cas_perdido` e o vídeo conta como falha (`parcial video_falhou`), ficando devido no disparo seguinte (C-7e); (2) a avaliação (`insert` normal, com `aviso`; `registro_id` do id gerado por `novoId`). **Reprodução: um único `rpc('ab_native_reproduzir', { p_site, p_video, p_registros, p_avaliacoes })`** com tudo (registros e avaliações em uma transação, ver T5); retorno 0 → `detalhe.reproducao_ja_feita += 1`; (3) com `criar`/`atualizar`, `rpc('yt_watch_reter', { p_site, p_video: ytId, p_ate: ultimaVista + 365 d })`; retorno 0 → `detalhe.retencao_sem_alvo += 1`; RPC ausente (`42883`) ou tabela da S4 ausente (`42P01`) → `detalhe.retencao_sem_rpc += 1`, segue.
- Erro (§5.5): exceção → avaliação `estado_14 'erro'`, `erro` = código curto (`opcao_invalida`, `escrita_sem_fuso`, `paginacao`, `banco`, `corrida`, `excecao`), `ate_lida_em null`, `versao_regra` = a da regra. Só regrava (`update ab_native_avaliacoes set avaliada_em = agora where id = ultimaId`) quando o erro é **o mesmo código e é a avaliação mais recente do vídeo**: `ultimoErroId = ultimaId` (ambos não nulos) e `ultimoErro` igual ao código novo; `ultimoErroEm > ultimaOkEm` fica redundante e sai (Phil R2-1); `update ... where id = ultimoErroId`. Senão insere (sequências erro, ok, ok, erro igual e erro, `sem_rodada_nova`, erro igual dão 2 linhas de erro cada; Phil D3, R2-1). Erro na reprodução grava `estado_14 'erro'` com `retroativa false` mas, como `alguma` ignora `erro`, não desliga a reprodução (Phil D1).
- Fim: `rpc('ab_native_poda', { p_agora, p_lote: 500 })` se sobrar ≥ 3 s (desvio: a cada disparo, lote 500, no lugar de 1/dia até 5.000; mesmo efeito, uma consulta por índice). Estado: algum vídeo com erro ou CAS perdido duas vezes → `parcial video_falhou` (`detalhe.falhas`); todos → `erro video_falhou`; **zero candidatos com as tabelas legíveis → `ok`, `feitas 0`, `detalhe.sem_candidatos 1` mais `detalhe.candidatos_total` e `detalhe.alvos_lidos` (`alvos_lidos` = linhas de `yt_watch_alvos` lidas, o `total` de `lerCandidatos`; `candidatos_total` = as que passaram nos filtros de idade e `antigos_fora`; C-8c afirma os dois valores; juntos distinguem "0 candidatos entre 40 alvos" de "0 alvos lidos" e a coleta nunca ligada; Yannis R2-3, Phil)** (estado normal sem vídeo próprio ≤ 14 d; `parcial` deixaria o vigia atrasado para sempre; falha ao montar a lista → `parcial lista_falhou`); senão `sobrou` → `parcial sobrou`; senão `ok`. `feitas = avaliados`, `deixadas = sobrou`. `detalhe` sempre com `candidatos_total, alvos_lidos, avaliados, criados, atualizados, encerrados, sem_video, antigos_fora, sobrou, reproduzidos, reproducao_ja_feita, retencao_sem_alvo, retencao_sem_rpc, cas_perdido, variantes_demais, podadas, inicio_ms`.
- [ ] **Passo 1: testes que falham** (cliente falso com tabelas em memória; relógio falso):
  - Passo 0: stub de `tarefa.ts` e da tarefa.
  - C-2 `duas execuções seguidas com as mesmas leituras` → 1 registro, evidência sem duplicata, 1 avaliação a mais por rodada nova (zero sem rodada nova).
  - C-4 `lista vazia` → `sem_leitura`; `sem rodada nova há 9 h` → `sem_rodada_nova`, e de novo 3 h depois → nada novo; `erro de banco no 1º disparo e sucesso 60 min depois` → linha de erro com `ate_lida_em null` e depois a boa; `mesmo erro duas vezes seguidas` → 1 linha, `avaliada_em` atualizado; `erro, ok, erro igual` → 2 linhas de erro (Phil D3); **`erro, sem_rodada_nova, erro igual`** (Phil R2-1) → 2 linhas de erro e a `sem_rodada_nova` com `avaliada_em` intacto (3 linhas, a do meio inalterada).
  - C-5 `em sem fuso no 2º de 3 vídeos` → `erro escrita_sem_fuso` só no 2º; os outros dois avaliados; estado `parcial video_falhou`.
  - C-6 `não escreve fora`: o cliente falso lança em `insert/update/delete/upsert` de qualquer tabela que não seja `ab_native_tests`/`ab_native_avaliacoes` e em `rpc` fora de `yt_watch_reter`, `ab_native_ultimas`, `ab_native_poda`, `ab_native_reproduzir`; uma execução com criação, atualização, encerramento e reprodução passa.
  - C-7e `CAS perdido` (Yannis D3): o `update` devolve 0 linhas → relê e reavalia uma vez; na 2ª perda registro intacto, avaliação não gravada, `cas_perdido 1`, `parcial video_falhou`, e o vídeo é devido no disparo seguinte; na 1ª perda seguida de sucesso grava normalmente.
  - C-7f `23505 no insert` → relê e atualiza; `campos` vira os dois.
  - C-8c `estado`: erro em 1 vídeo → `parcial video_falhou`; em todos → `erro`; **zero candidatos → `ok`, `sem_candidatos 1`, `feitas 0`, e `detalhe.candidatos_total` e `detalhe.alvos_lidos` presentes com o valor do `total` lido (ex.: 0 candidatos entre 40 alvos → `alvos_lidos 40`; 0 alvos → 0)** (Yannis D4, R2-3); falha na lista → `parcial lista_falhou`; alvo sem `youtube_videos` → `detalhe.sem_video 1`; `variantes_demais` → `detalhe.variantes_demais` conta e a avaliação traz o aviso.
  - `schema ausente (42P01)` → `parcial schema_ausente`, nenhuma escrita.
  - `teto`: com relógio em `t0 + 60 s` no início, nenhum vídeo começa depois de `t0 + 83 s` e a tarefa devolve `parcial sobrou`.
  - `reprodução`: vídeo sem avaliação → uma única chamada de `ab_native_reproduzir` com as avaliações `retroativa true` e 1 real.
  - `reprodução com erro na 1ª tentativa` (Phil D1): 1º disparo de reprodução com erro de banco; 60 min depois reproduz e grava as retroativas.
  - `reprodução idempotente` (Phil D2, Yannis D2): o cliente falso faz o `rpc` falhar depois do primeiro disparo parcial; a 2ª execução não duplica (1 encerrado e 1 aberto); `rpc` devolvendo 0 → `reproducao_ja_feita 1`.
  - `retenção`: `yt_watch_reter` devolve 0 → `detalhe.retencao_sem_alvo 1`, estado não piora.
  - Catálogo (`catalogo.test.ts`): `TODAS_AS_DEFINICOES` igual ao `CATALOGO`; `fimAteMs ≤ LEVE_FIM_MS`; `naoTerminouVermelhoEm ≤ disparos por período` (3) para toda tarefa com `periodo 'hora'` (pegaria o mesmo erro em qualquer tarefa futura; Yannis D4); `HORARIA_FIM_MS + 30_000 (watch) + 30_000 (registrador) < COMMENT_RULES.startsByMs`; `delete process.env.AB_NATIVO_REGISTRO` → `registro_teste_nativo` em `desligadas`; `'ON'`, `'1'` → desligada; `'on'` → ligada; `devidaPeloDado` devolve `true`; ordem `5.9 < 5.95 < 6`.
- [ ] **Passos 2–4:** `npx vitest run test/youtube/teste-youtube/registro test/youtube/agenda > $SAIDA/t8.txt 2>&1` (suíte que contém a tarefa e o catálogo); falhar, implementar, passar.
- [ ] **Passo 5:** `docs/ops/env-vars.md`: linha `AB_NATIVO_REGISTRO` (só `on` liga; desligada = nenhuma avaliação; ligar depois da migration aplicada e da S4 ligada). Commit `feat: tarefa registro_teste_nativo da agenda (S7 fase 1)`.

### Tarefa 9: leitura pelo Cowork (§8.3 fase 1)

**Files:** Create `registro/serializar.ts`, `src/lib/pipeline/services/youtube-native.ts`, `src/app/api/pipeline/youtube/ab-tests/native/route.ts`, `.../native/[id]/route.ts`; Modify `src/lib/pipeline/mcp/tools.ts` (enum `action` + `list_native`, `get_native`; parâmetros `estado`), `src/lib/pipeline/mcp/services/ab-tests.ts` (dois `case` e a lista de "Supported"), `src/lib/pipeline/api-registry.ts` (duas entradas `auth: 'read'`; `endpoint_count` do youtube 34 → 36), `data/pipeline-docs/cowork-docs-youtube.md`; Test `test/pipeline/ab-native-api.test.ts` e os testes existentes do registro e das tools.

**Interfaces:**
- Produces:
  ```ts
  export interface RegistroNativoSerializado { id: string; youtube_video_id: string; origem: string; campos: string[]; estado: string
    variantes_titulo: string[] | null; votos_titulo: Record<string, number> | null; titulo_oficial: string | null
    primeira_vista: string | null; ultima_vista: string | null; desfecho: { estado: string | null; motivo: string | null; em: string | null; versao_regra: number | null }
    vencedor: { titulo: string; fonte: 'regra' | 'dono' } | null; evidencia_rodadas: number; evidencia_cortada: boolean; versao_regra: number | null }
  export interface AvaliacaoSerializada { avaliada_em: string; estado_14: string; estado_48: string | null; motivo_14: string | null; mistas_48: number | null
    mistas_48_fora_quarentena: number | null; min_desde_escrita: number[] | null; erro: string | null; retroativa: boolean; aviso: string | null }
  export function serializarRegistro(linha: LinhaAbNativeTest): RegistroNativoSerializado        // a S9 usa a mesma
  export function serializarAvaliacao(linha: LinhaAbNativeAvaliacao): AvaliacaoSerializada
  export async function listNativeTests(ctx: ServiceContext, f: { youtubeVideoId?: string; estado?: string }): Promise<ServiceResult<{ testes: RegistroNativoSerializado[] }>>
  export async function getNativeTest(ctx: ServiceContext, id: string): Promise<ServiceResult<{ teste: RegistroNativoSerializado; avaliacoes: AvaliacaoSerializada[] }>>  // últimas 20 do vídeo
  ```
  `video_id` do filtro é o id de 11 caracteres do YouTube (igual a `get_history`); `estado` validado por Zod no enum do §7.1 (fora → 400 `VALIDATION_ERROR`). Sempre `.eq('site_id', ctx.siteId)`. `id` não-uuid → 400; inexistente → 404. Sem rota de escrita nesta fase. Rotas no padrão de `ab-tests/[id]/history/route.ts` (`authenticateRead`, `authToServiceContext`).
- [ ] **Passo 1: testes que falham:**
  - `GET native sem filtro` devolve só o site do contexto; `?estado=x` → 400; `?video_id=qIg9a7vqcNo` filtra.
  - `GET native/:id` → registro + no máximo 20 avaliações, da mais nova para a mais velha; id de outro site → 404.
  - `MCP list_native/get_native` devolvem o mesmo objeto da rota (mesma função de serialização; afirmar `toEqual`).
  - `api-registry`: o teste de estrutura existente passa com `endpoint_count` 36 (o teste conta as entradas).
- [ ] **Passos 2–4:** `npx vitest run test/pipeline test/youtube/teste-youtube/registro > $SAIDA/t9.txt 2>&1`; falhar, implementar, passar.
- [ ] **Passo 5:** docs do endpoint em `cowork-docs-youtube.md` (dois blocos, com o exemplo de resposta e a frase "estado `sem_leitura` nunca quer dizer sem teste"). **O pre-commit semeia a referência em produção: avisar a A5 antes do commit** (plano conjunto §1.2). Commit `feat: Cowork lê o registro do teste nativo (GET native, list_native, get_native)`.

### Tarefa 10: portão do lote de código e envio (sem código novo; a migration já foi na T6b)

- [ ] **Passo 1: C-1 da lista proibida:** `git -C $W diff --name-only origin/staging...HEAD | grep -E 'ab-(settle|settle-decidir|rotate-phases|rotate-claim|evaluate-phases|watchdog-drift|apply|metadata|start|restore)\.ts|ab-lab/actions\.ts|lib/youtube/watch/'`; esperado: vazio.
- [ ] **Passo 2: suíte inteira** `npx vitest run > $SAIDA/suite.txt 2>&1` (~160 s, em background com saída em arquivo; no contexto só as falhas) e `HAS_LOCAL_DB=1` para `test/integration/ab-s7-native-*`. Typecheck web.
- [ ] **Passo 2b: conferência informativa da S8-F1 (Yannis R2-1; fora da suíte, não bloqueia):** depois de a S8-F1 estar aplicada no 54422, `select pg_get_constraintdef(oid) from pg_constraint where conname in ('ab_tests_restore_status_shape','ab_test_restores_estado_check')` deve conter `pulado_teste_youtube`; senão a fase 2 quebra no 1º `teste_youtube`. Resultado anotado no ledger como dado para a fase 2.
- [ ] **Passo 3: portão de Phil, Yannis e Gio** sobre o lote de código (C-9 é do Gio): Phil o volume e a poda; Yannis correção, CAS, ordem e teste de arquitetura C-6. Conserta-se até haver acordo.
- [ ] **Passo 4:** push do lote por sha literal em `bash -c`, fora das janelas. CI verde. Promoção a `main` pela regra do dono (código e migration da fase 1 liberados pelo P2). O código só funciona com a migration da T6b aplicada; a guarda `schemaTablesReady` cobre o intervalo.
- [ ] **Passo 5: ligar** `AB_NATIVO_REGISTRO=on` no Vercel (produção) depois de a S4 estar ligada (`OBS_WATCH_READ=on`). Anotar a hora no ledger.
- [ ] **Passo 6: lembretes datados** em `.superpowers/sdd/ab-lab/lembretes.md` (sobrevivem ao handoff; arquivo ignorado pelo git, não fazer `git add`): D+1 aceite Q-ACEITE e C-6; D+3 Q9; diariamente até a fase 2, Q-C17b.

---

## 4. Restrições herdadas pela fase 2 e 3 (não são código desta fase)

- **P5 (dono, sim):** o Lab espera 3 rodadas (~12 h, desde a 1ª leitura) antes da 1ª escrita num vídeo sem leitura; fila e playoff não gastam tentativa até 72 h. **P6 (sim):** `duracao_maxima` com bloqueio pausa sem escrever; regra v2 encerra voltando ao original e só sugere o vencedor. **P7 (sim):** "Liberar o Lab" só no CMS, 2 toques; o Cowork só lê a liberação.
- Pendências 4 (zerar `guarda_adiada_desde` ao liberar), 5 (TOCTOU ≤ 55 s declarado), 8 (liberação vigente vence `avaliacao_velha`), 10 (automático com motivo passageiro adia; > 24 h vira `teste_youtube` com gatilho; C-15 estendido) e o C-17b com a frase única do §1 item 2: entram no plano da fase 2 como estão escritas acima.
- **Falso `sem_rodada_nova` dos antigos (Phil D5): D2 da A5 = SIM (dono, 18/10; resposta da A5, bythiagofigueiredo-25).** Os ~35 próprios antigos (`rodadas_por_dia = 1`, não ~300) entram no alvo a 1 rodada por dia (4 por dia com teste) e contariam em `sem_rodada_nova` (~3 linhas/dia por antigo, ~105/dia). **O filtro `antigos_fora` da T7 fica ativo** (não inerte) e os mantém fora na 1ª entrega, visíveis em `detalhe.antigos_fora`; a 2ª entrega troca a frescura por `frescorMaxMs(rodadasPorDia)`. Nota da A5: a 1ª execução do P-V (21:22 UTC) deu 0/30 (jogador bloqueado no iad1); se a S4 mudar de origem ou atrasar, o tratamento de `42P01` cobre.
- A fase 2 muda o código desta fase em um ponto (§8.2): o registrador lê `ab_guarda_liberacoes` e grava `estado_pos_liberacao`. A coluna já existe; nesta fase fica sempre nula.
- `mistura_recente` da fase 2 ignora a rodada cujos dois textos são o par de uma escrita conhecida (§6.3 peça 3); para isso lerá `ab_test_variants.title_text`, que a fase 1 não lê.
- Zod de `ab-restore.ts:102` com `pulado_teste_youtube`: fase 2 (arquivo proibido aqui; nenhuma linha terá o valor antes dela).

## 5. Consultas de conferência (leitura; produção por `supabase db query --linked`)

- **Q-CHECK** (antes do `db:push:prod` da T6b): nada de `ab_test_restores` aqui (é da S8-F1). Conferir só que as tabelas ainda não existem (`select to_regclass('public.ab_native_tests')` nulo) e que a última migration em `supabase_migrations.schema_migrations` é anterior ao timestamp novo.
- **Q-ACEITE** (D+1, controlador): rodadas da S4 de vídeo próprio nas últimas 24 h sem avaliação, ignorando a rodada da última hora (Phil P4): `select a.youtube_video_id, a.ultima_rodada_em from yt_watch_alvos a join youtube_videos v on v.site_id = a.site_id and v.youtube_video_id = a.youtube_video_id where a.tipo = 'proprio' and a.saiu_em is null and a.ultima_rodada_em > now() - interval '24 hours' and a.ultima_rodada_em < now() - interval '1 hour' and not exists (select 1 from ab_native_avaliacoes n where n.video_id = v.id and not n.retroativa and n.avaliada_em >= a.ultima_rodada_em);` → zero linhas. E C-6: `select max(updated_at) from ab_tests` e `select count(*) from ab_test_cycles where coalesce(ended_at, started_at) > '<hora do deploy>'` iguais ao que o T19 explica (só a rotação dele).
- **Q9** (D+3, pendência 9): `select percentile_disc(0.5) within group (order by extract(epoch from r.em - c.ended_at)) from ab_test_restores r join ab_test_cycles c on c.test_id = r.test_id and c.end_reason <> 'rotacao' and abs(extract(epoch from r.em - c.ended_at)) < 600 where r.escreveu;`
- **Q-C17b** (diária até a fase 2): `select percentile_disc(0.95) within group (order by m), max(m) from ab_native_avaliacoes, unnest(min_desde_escrita) m where avaliada_em > now() - interval '7 days';`, `select avg((mistas_48_fora_quarentena = 0)::int) from ab_native_avaliacoes n join youtube_videos v on v.id = n.video_id where v.youtube_video_id = 'Uy5_DPzoGi8' and avaliada_em > now() - interval '7 days';` e, para o "menos de 3 rotações = não passou" ter número (Phil P4), `select count(distinct c.id) from ab_test_cycles c join ab_tests t on t.id = c.test_id join youtube_videos v on v.id = t.youtube_video_id where v.youtube_video_id = 'Uy5_DPzoGi8' and c.started_at > now() - interval '7 days';`
- **Conferências de go-live (Phil §6):** +1 h, reprodução do T19: `select count(*) filter (where retroativa), count(*) filter (where not retroativa) from ab_native_avaliacoes n join youtube_videos v on v.id = n.video_id where v.youtube_video_id = 'Uy5_DPzoGi8';` (retroativas ≈ rodadas da S4; reais ≥ 1). +1 d: duplicados `select video_id, primeira_vista, count(*) from ab_native_tests group by 1,2 having count(*) > 1;` (zero) e `sem_rodada_nova` ≤ 4 por dia por vídeo (zero linhas).

## 6. Riscos que ficam

- **Dependência do código da S4:** T7 em diante só compilam com `watch/puro.ts` e `watch/rodada.ts` no `origin/staging`. O atraso da S4 atrasa o código (sem data), **não a migration** (T6b, até 29/10, independente da S4 e da S8-F1).
- **`ab_test_restores_estado_check`:** decidido por Phil e Yannis: é da S8-F1 (4ª reescrita). Se a S8-F1 não o levar, a fase 2 quebra no 1º `teste_youtube`; a conferência da T10 (Passo 2b) acusa; a fase 2 não começa sem a S8-F1 aplicada.
- **`yt_watch_reter` na migration do A/B** mexe em tabela da A5: precisa do ok dela antes do `db:new`. A função é `plpgsql`, então existe sem a tabela da S4; sem o ok, ela sai e o registro guarda só a evidência compacta (o relato conta `retencao_sem_rpc`). Se a A5 renomear a coluna em `yt_watch_alvos`, a RPC quebra em silêncio (`retencao_sem_rpc`): pedir a ela o teste de integração no suíte dela.
- **Reprodução com rotação antiga do T19:** se a S4 já tiver lido o T19 durante rotações, a reprodução grava `min_desde_escrita` retroativo; o Q-C17b conta as retroativas de propósito (é dado real), o que adianta o portão.
- **Limite da 1ª entrega:** teste nativo em vídeo próprio com mais de 14 dias e sem teste nosso não é registrado até a 2ª entrega (P4 do dono).
- Sem estimativa de horas por tarefa (pedir a Yannis e Phil no portão).

---

## 7. Conserto r1 (18/10; achados de Phil, Yannis e do controlador)

| Id | O que mudou | Onde |
|---|---|---|
| Phil B1 / Yannis B1 | T6 (d) sai; `ab_test_restores_estado_check` é da S8-F1 (4ª reescrita); fica só a nota (conferência informativa na T10, r2) | §1 CHECKs, T6, §5, §6 |
| Phil D1 | `alguma` = existe avaliação sem erro; erro na 1ª tentativa não desliga a reprodução; teste na T8 | T5, T6, T7, T8 |
| Phil D2 / Yannis D2 | RPC atômica `ab_native_reproduzir` (escolhida em vez de id determinístico + upsert: o upsert só cobriria o registro, as avaliações iriam num 2º insert); trava `exists` sem erro | T5, T6, T8, Global Constraints |
| Phil D3 | erro igual só regrava se for a avaliação mais recente (`ultimoErroEm > ultimaOkEm`, `ultimaId`); teste erro, ok, erro | T8, §1 item 6 |
| Phil D4 | coluna `aviso` + `NovaAvaliacao.aviso`, copiado por `avaliarVideo`, `detalhe.variantes_demais`, serializado | T3, T4, T6, T8, T9 |
| Phil D5 | `antigos_fora` na `lerCandidatos`, ativo na fase 1 (D2 da A5 = sim, 18/10; ~35 antigos ficam para a 2ª entrega, decisão P4) | T7, §1 item 12, §4 |
| Phil D6 / Yannis D5 | `yt_watch_reter` em plpgsql; migration sem depender de S4 nem S8-F1; T2 dividida (frescor vai à T7); T6b aplica a migration logo após a T6 com portão próprio | §0, T2, T6, T6b, T7, §6 |
| Phil P1 | `ultima_ok_em` exclui `erro` e `sem_rodada_nova`; SQL com consulta lateral | T6 |
| Phil P2 | zero leituras não chama `lerEscritas`; filtro de ciclo por `or` | T7 |
| Phil P3 / Yannis D1 | `ended_at` com `end_reason` diferente de `rotacao` (inclui `regra_v2`) | T2 |
| Phil P4 | Q-ACEITE ignora a última hora; Q-C17b conta rotações | §5 |
| Phil P5 / Yannis D3 | `updatedAt` texto cru; teste de ida e volta na T6 e na T7; CAS perdido relê e reavalia, na 2ª perda `cas_perdido` e `parcial video_falhou` | T4, T6, T7, T8 |
| Phil P6 / Yannis P2 | frase da janela de 44 d corrigida (alvo com teste nosso ou estendido fica fora) | T5 |
| Phil P7 | coluna `youtube_video_id` de `ab_tests` | §0, T7 |
| Phil P8 | rascunho aplicado de verdade com `psql -f` duas vezes; vermelho por asserção de catálogo | §0, T6 |
| Phil P9 / Yannis P6 | `ab_native_poda` com guarda `22023` e `id in (select ... limit)` | T6 |
| Phil P10 | `reproduzirPassado` recebe `inicial` (aberto e fechamentos) | T5 |
| Yannis D4 | `sem_candidatos` com tabelas legíveis vira `ok`; `naoTerminouVermelhoEm 3`; `feitas`/`deixadas`; teste de catálogo; desvio declarado | §1, T8 |
| Yannis D6 | critério de "devido" declarado como desvio com 3 testes | §1, T7 |
| Yannis D7 | sem `git add` em `.superpowers/`; rascunho fora do git | §0, T6, T10 |
| Yannis D8 | Passo 0 (stub) em todas as tarefas; ordem das variantes fixa; `ultimas` com laterais; `has_function_privilege`; `feitas`/`deixadas` | §0, T1 a T8, T6 |
| Yannis P1 | `RodadaTitulo.chave` é a chave da evidência | T1, T3 |
| Yannis P3 | complexidade corrigida; teste por contagem de chamadas, não por relógio | T5 |
| Yannis P4 | primeira avaliação herda a prioridade do motivo | §1 item 3, T7 |
| Yannis P5 | caso de fronteira do limiar (2 mistas fora da quarentena por rotação cria) | T4 |
| Controlador | T19 tem `thumbnail_dhash` nas duas variantes; limite de 100 crons cabe (49 para 51) | sem mudança de plano; fatos registrados |

### r2 (18/10; Rodada 2 de Phil e Yannis e condições da A5)

| Id | O que mudou | Onde |
|---|---|---|
| Phil R2-1 | `ab_native_ultimas` devolve `ultimo_erro_id` (`er.id`); erro igual só regrava se `ultimoErroId = ultimaId` e o código é o mesmo (`ultimoErroEm > ultimaOkEm` sai); teste erro, `sem_rodada_nova`, erro igual = 2 linhas de erro e `sem_rodada_nova` intacta | T6, T8 |
| Yannis R2-1 | caso `pré-requisito` sai da suíte da T6; vira conferência informativa na T10 (Passo 2b) depois da S8-F1 aplicada; acoplamento desfeito | T6, §1 CHECKs, §6, T10 |
| Yannis R2-2 | `ab_native_reproduzir` em plpgsql com `pg_advisory_xact_lock(hashtext(p_video::text))` no início; teste de duas chamadas seguidas sem duplicar | T6 |
| Yannis R2-3 / Phil | `detalhe.candidatos_total` e `detalhe.alvos_lidos` no caso `sem_candidatos`, com teste | T8 |
| A5 (bythiagofigueiredo-25) | `yt_watch_reter`: revoke de public/anon/authenticated, grant a `service_role`, `greatest(reter_ate, p_ate)`; ok da A5 registrado no Passo 2 da T6b | T6, T6b |
| A5 D2 = sim | ~35 antigos a 1 rodada por dia; filtro `antigos_fora` ativo; texto condicional resolvido | §1 item 12, T7, §4 |
| Spec §5.5 | `naoTerminouVermelhoEm` 6 para 3, ok do Phil (emenda no spec e linha no registro de revisões) | spec §5.5 |
