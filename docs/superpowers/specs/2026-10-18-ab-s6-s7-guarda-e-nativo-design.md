# Spec S6 + S7: registro do teste nativo (`ab_native_tests`) e guarda do canal próprio

- **Data:** 18/10/2026. **Estado:** 1º rascunho (Opus), para Phil e Yannis revisarem.
- **Frente:** A/B Lab. Consome a regra pura da S3 (`lib/youtube/teste-youtube/`) e a coleta crua da S4 (A5: `yt_watch_alvos`, `yt_watch_readings`, `yt_watch_thumbs`, `watch/puro.ts`).
- **Fontes:** plano conjunto (`.superpowers/sdd/ab-lab/2026-10-18-nativo-vs-nosso/plano-conjunto.md`, §1, §1.2, §2, §9, §10, §11); spec da regra `docs/superpowers/specs/2026-10-18-teste-youtube-deteccao-design.md` (§3, §4.3, §4.4, §8, emenda r5); spec da S4 `docs/superpowers/specs/2026-10-18-a5-s4-tc-coleta-design.md` (§4, §5.1, §7, §8, §10) e o plano dela; spec do A/B honesto (`2026-10-07-ab-lab-honesto-design.md`); código da P4a nesta árvore (base `7bd60eb98`); mockup S9 aprovado (`docs/superpowers/mockups/2026-10-18-ab-detalhe-teste-youtube/NOTAS.md`); aviso N1 do Phil (`review-lote-s013-phil.md`).
- **Ajuste do dono (18/10), que manda na ordem deste spec:** a coleta vem primeiro. A fase 1 é só gravação (`ab_native_tests` + registro automático do detectado + o que ainda não tem tela), sem tocar rotação, `settleOnAir`, drift nem avaliação. A guarda e as telas vêm depois. Prioridade ao dado que a origem expira: o título B do teste nativo some quando o teste acaba.
- **Libera (quando Phil e Yannis concordarem):** o plano das três fases. **Não libera:** código antes do plano; deploy da fase 2 antes do E8 do T19 (G0); deploy da fase 1 antes da resposta do dono à pergunta Q1 (§12).
- Legenda: **[V]** verificado (código ou dado citado); **[H]** hipótese.

---

## 1. Resumo em cinco linhas

1. **Fase 1 (gravação, S7a):** uma tarefa horária lê as leituras gravadas pela S4 dos vídeos do canal próprio, roda `detectarTesteYoutube` e `inferirDesfecho`, e grava duas coisas: o registro do teste nativo (`ab_native_tests`, origem `detectado`, A e B salvos, evidência por rodada, vencedor provável) e uma linha de avaliação por rodada nova (`ab_native_avaliacoes`, inclusive "nada visível" e "sem leitura"). Não escreve no YouTube nem em tabela do A/B que já existe.
2. **Fase 2 (guarda, S6):** antes de toda escrita do Lab no YouTube, a guarda lê a última avaliação do vídeo. Teste do YouTube provável, confirmado, leitura ausente, avaliação velha ou mistura recente bloqueiam. Bloqueio no início = recusa. Bloqueio com teste nosso no ar = pausa sem escrever nada. Junto vão as ações do dono (confirmar teste de miniatura, liberar o Lab, informar vencedor, desfazer) e a paridade de escrita do Cowork.
3. **Fase 3 (telas, S9):** cartão e bloco "Resultado do YouTube" do mockup aprovado, depois da S8.
4. **Aviso do Phil (N1) resolvido** em duas peças (§6.3): todas as escritas do app na janela das leituras, vindas de `timestamptz`; e a regra "mistura bloqueia" olha só as últimas 48 h.
5. **Sem leitura ≠ sem teste:** em toda fase, a falta de dado vira estado gravado e visível, e na fase 2 bloqueia.

---

## 2. Escopo

**Entra:**
- Fase 1: migration (duas tabelas, RLS, e dois CHECKs alargados sem efeito, §7.3); registrador puro + tarefa; leitura paginada das leituras da S4; evidência compacta; pedido de retenção à A5; leitura pelo Cowork (`manage_ab_test` e pipeline, só GET).
- Fase 2: guarda (porta única `avaliarGuarda`), ganchos em início, retomada, rotação (cron e forçar), `settleOnAir` (todos os motivos), aplicação de vencedor; motivo de saída `teste_youtube` (pausa sem escrever); fila e playoff adiam sem gastar tentativa; interruptor `AB_GUARDA_TESTE_YOUTUBE`; ações do dono; escrita pelo Cowork.
- Fase 3: só o vínculo com a S9 (o que cada estado da tela lê).

**Não entra:** detecção de miniatura (sai do ciclo, linha "sai" do plano); leitura logada; placar com alcance (S8); mudança na coleta da S4 (só pedidos, §10); concorrentes (S5, da A5); mudar `DHASH_MAX_SAME`.

---

## 3. Fatos que sustentam o desenho

| # | Fato | Fonte |
|---|---|---|
| F1 | `startAbTestInternal` é o início único: chamado pela ação humana, pela fila (`phaseProcessQueue`) e pelo playoff (`phaseAutoStartPlayoffs`). Não passa por `settleOnAir`. | `ab-start.ts:182`, `ab-rotate-phases.ts:123`, `ab-evaluate-phases.ts:37` [V] |
| F2 | `settleOnAir` é a saída única: pausa, encerrar, reverter (humanos, `actions.ts:679/757/1076`), `falha_api` (rotação, `ab-rotate-phases.ts:185`), `duracao_maxima` (`ab-evaluate-phases.ts:107`), `drift` (vigia, `ab-watchdog-drift.ts`). Todos reivindicam por `ab_settle_claim` e escrevem em `restaurarCampos`. | `ab-settle.ts:450-523` [V] |
| F3 | As escritas no YouTube estão em `settleOnAir` (`ab-settle.ts:402-404`), em `applyVariantToYouTube` (`ab-apply.ts:97,114`, usado por início, retomada e rotação/forçar via `ab-rotate-claim.ts`) e em `ab-metadata.ts:88` (chamado só por esses). A A5 não escreve título nem miniatura. | grep, plano §8.6 [V] |
| F4 | Instantes de escrita do app existem em `timestamptz`: `ab_test_cycles.started_at` (todo ciclo, de todo teste do vídeo), `ab_test_cycles.ended_at` com `end_reason ≠ 'rotacao'` (saídas por `ab_settle_claim`), `ab_tests.winner_applied_at`. O `restore_status[campo].em` é texto dentro de `jsonb` (validado como `timestamptz` pelo CHECK, mas não é coluna). | migrations `20260517000001`, `20260531000005`, `20261014000005`, `20261018000001` [V] |
| F5 | `ultimaEscritaDoApp` só guarda a **última** escrita por campo; o histórico vem dos ciclos. | `ab-settle-decidir.ts:101` [V] |
| F6 | `ab_test_cycles_end_reason_check` aceita `pausa, encerrado, falha_api, duracao_maxima, drift, rotacao`; `ab_tests_restore_status_shape` aceita os estados `em_andamento, ok, falhou, pulado_sem_original, pulado_drift, desistiu`. Um motivo novo exige alargar os dois. | `20261014000005_ab_restore_status.sql:35-92` [V] |
| F7 | Já existe precedente de pausa sem YouTube (tipo fora de uso), por `update` direto, sem reivindicação por `restore_seq`. | `ab-rotate-phases.ts` (bloco "Teste antigo de tipo fora dos três") [V] |
| F8 | A S4 grava toda tentativa (inclusive falha), lê próprios ≤ 14 dias e todo teste nosso aberto **desde a criação** (`draft` incluso), 3 leituras por rodada, uma rodada a cada 6 h por vídeo, e exporta `leiturasDoBanco` em `watch/puro.ts` (sem `sharp`). Retém 30 d depois de o alvo sair, e `reter_ate = ultimaVista + 180 d` no `provavel_teste`. `max_rows = 1000`: leitura sem paginação perde as mais recentes em verde. | spec S4 §4, §6.1, §7, §8, §10.1 [V no texto do spec] |
| F9 | `resolverOpcoes` lança para `escritasConhecidas[].em` sem fuso e limiar inválido; o consumidor captura **por vídeo** (emenda r5). | spec da regra §3 [V] |
| F10 | Miniatura do teste nativo é sempre A para leitor anônimo; detecção só por título. | plano §10 [V] |
| F11 | Mockup S9 aprovado pede: "verificado há N h" no estado sem teste; "Não é teste, liberar o Lab"; "Confirmar teste de miniatura" e "Não tenho teste de miniatura"; "Informar o vencedor à mão"; "Tentar ler agora"; "Desfazer"; liberação "decisão sua, fica registrada". | `NOTAS.md` do mockup [V] |

---

## 4. Fases e portões

| Fase | O que vai ao ar | Toca rotação/`settleOnAir`/drift/avaliação? | Depende de | Pode antes do E8? |
|---|---|---|---|---|
| **1. Gravação (S7a)** | migration 1; registrador; tarefa horária; GET do Cowork | **Não.** Só lê `ab_tests`/`ab_test_cycles` (escritas conhecidas) e as tabelas da S4; só escreve nas duas tabelas novas (e pede retenção à A5 por RPC dela). | S4 com migration aplicada e coleta ligada; migration 1 na fila (§7.4) | **Sim pelo G0** (o G0 proíbe mudar rotação, `settleOnAir`, drift ou avaliação, e a fase 1 não muda nenhum). **Mas** o §9 do plano diz "não libera publicar código do A/B antes do E8". É decisão do dono: Q1 (§12). |
| **2. Guarda (S6) + ações do dono** | ganchos nas escritas; motivo `teste_youtube`; interruptor; ações; escrita do Cowork; faixa mínima de recusa/pausa nas telas que já existem | **Sim** | fase 1 no ar com ≥ 1 dia de avaliações reais (§11, C-17); E8 do T19 | **Não** (G0) |
| **3. Telas (S9)** | bloco "Resultado do YouTube", cartões 2/2b/3/3b/4a/4b | Não (só lê) | fases 1 e 2; S8 (placar) | Não (vem depois da S8) |

**Por que a fase 1 tem pressa:** o B do teste nativo só existe enquanto o teste corre. A S4 grava as leituras, mas a poda dela apaga 30 dias depois de o vídeo sair (180 d no provável). O registro da fase 1 copia a evidência compacta para `ab_native_tests`, que não tem poda (§7.1). Cada teste que acaba antes da fase 1 entrar depende só da retenção da S4.

**Teste T19 (`Uy5_DPzoGi8`, teste `0d31687e`) durante a fase 1:** é um alvo `teste_nosso` da S4. O registrador só lê as leituras dele e grava avaliação. Nenhuma linha de `ab_tests` ou `ab_test_cycles` muda. C-6 prova por teste que o registrador não escreve fora das duas tabelas.

---

## 5. Fase 1: registrador

### 5.1 Onde roda

- Módulos novos do A/B em `apps/web/src/lib/youtube/teste-youtube/registro/`:
  - `escritas.ts` (puro): `escritasDoApp(linhas, janela): EscritaConhecida[]` (§6.3).
  - `evidencia.ts` (puro): `evidenciaPorRodada(leituras, veredito): EvidenciaRodada[]` (§7.1).
  - `registrar.ts` (puro): `decidirRegistro(estadoAtual, v14, v48, desfecho, agora): AcaoRegistro` (criar, atualizar, encerrar, nada).
  - `tarefa.ts` (servidor): lê o banco, chama as funções puras, grava.
- **Como dispara: recomendação, tarefa nova `registro_teste_nativo` no catálogo da agenda da A5** (`agenda/definicoes.ts`), `peso: 'leve'`, `periodo: 'hora'`, `ordem` **depois** de `leitura_watch`, `ligaCom: 'AB_NATIVO_REGISTRO'` (só `on` liga), `tetoTentativas: 3`. Herda arrendamento, vigia, `/api/health` e o relato ao Sentry. O código da tarefa é do A/B; a linha no catálogo é pedido à A5 (§10, P1). Alternativa (Q2): rota própria `/api/cron/ab-native` por pg_cron GET; custa um cron a mais e reescreve o vigia.
- **Teto:** 30 s por disparo, no máximo 8 vídeos por disparo, em paralelo de 4; vídeo que não coube fica para o próximo (`parcial`, `sobrou`).

### 5.2 Quem é avaliado e quando

- Candidatos: `yt_watch_alvos` com `tipo = 'proprio'` e `saiu_em` nulo, **mais** todo vídeo com registro `ab_native_tests` em `em_andamento` (mesmo que o alvo tenha saído: o desfecho precisa ser tentado até `coleta_encerrada`).
- **Devido:** existe leitura com `lida_em > ab_native_avaliacoes.ate_lida_em` da última avaliação do vídeo (rodada nova). Sem rodada nova há mais de 7 h para um alvo ativo: grava avaliação `estado_14 = 'sem_rodada_nova'` (é dado: a coleta parou para esse vídeo). Uma avaliação por rodada nova, ~4 por vídeo por dia.
- Junção: `yt_watch_alvos.youtube_video_id` (11 caracteres) com `youtube_videos.youtube_video_id` e o mesmo `site_id` → `video_id` (uuid interno), que é o que `ab_tests.youtube_video_id` guarda (spec S4 §7 [V]).

### 5.3 Passos por vídeo (dentro de `try/catch` por vídeo, F9)

1. **Leituras.** `yt_watch_readings` do vídeo com `lida_em >= corte` (§5.4), só as colunas do expansor, ordem `lida_em`, **paginadas por `range` até esgotar, com `count: 'exact'` conferido** (diferença = erro do vídeo, nunca veredito). Miniaturas por `miniatura_id` em `yt_watch_thumbs`. Expande com `leiturasDoBanco` de `watch/puro.ts`.
2. **Escritas conhecidas** do vídeo na janela das leituras entregues (§6.3).
3. **Dois vereditos:** `v14 = detectarTesteYoutube(leituras, { escritasConhecidas })` e `v48 = detectarTesteYoutube(leituras com lida_em ≥ agora − 48 h, { escritasConhecidas })`.
4. **Registro aberto do vídeo** (`estado = 'em_andamento'`): se existir, `antes` = o `veredito` gravado nele (último `provavel_teste`), e `desfecho = inferirDesfecho(antes, leituras com lida_em > antes.ultimaVista, { escritasConhecidas, agora })`.
5. **Decisão** (`decidirRegistro`, puro):
   - `v14` `provavel_teste` sem registro aberto → **cria** (`origem = 'detectado'`).
   - `v14` `provavel_teste` com registro aberto e `primeiraVista` do veredito ≤ `ultima_vista` do registro + 7 d → **atualiza** (variantes ∪, votos, `ultima_vista`, evidência por `rodada_id`, idempotente). Variantes novas além de 3 = não atualiza, grava avaliação com `aviso = 'variantes_demais'`.
   - `desfecho.estado = 'vencedor_provavel'` → **encerra** (`estado = 'encerrado'`, `vencedor_titulo`, `desfecho_*`).
   - `desfecho` `sem_dado` com `coleta_encerrada` → `estado = 'sem_desfecho'` (fecha; o dono pode informar o vencedor à mão na fase 2).
   - Outros `sem_dado` e `em_andamento` → grava `desfecho_*` no registro, não muda `estado`.
   - Registro `descartado` pelo dono (fase 2) não é reaberto pela mesma evidência: só cria registro novo se a 1ª rodada mista do veredito for **posterior** a `descartado_em`.
6. **Avaliação:** sempre grava uma linha em `ab_native_avaliacoes` (inclusive `sem_leitura`, `insuficiente`, `nada_visivel`, erro). É o que a guarda e o "verificado há N h" leem.
7. **Retenção:** com registro criado ou atualizado, chama a RPC da A5 `yt_watch_reter(p_site, p_video, p_ate)` com `ultima_vista + 365 d` (pedido P2, §10). Sem a RPC, a evidência compacta do registro já guarda o essencial.

### 5.4 Corte da janela

`corte = max(agora − 14 d, encerrado_em do último registro encerrado/sem_desfecho do vídeo, descartado_em do último descartado)`. Sem isso, um teste nativo encerrado continuaria a dar `provavel_teste` por 14 dias e reabriria registro em laço.

### 5.5 Erro por vídeo

- Exceção (opção inválida, `em` sem fuso, contagem divergente, vídeos misturados): grava avaliação `estado_14 = 'erro'`, `erro = <código curto>`, segue para o próximo vídeo, conta `falhas` no relato. Nunca grava "nada visível" por causa de erro.
- Erro de opção é falha do chamador (r5): não vira `erro` de leitura.

---

## 6. Fase 2: guarda

### 6.1 Porta única

```ts
export type MotivoBloqueio =
  | 'teste_provavel'        // v14 provavel_teste, registro aberto
  | 'teste_confirmado'      // dono confirmou (inclusive só miniatura)
  | 'sem_leitura'           // v14 ou v48 sem_leitura
  | 'insuficiente'          // v14 ou v48 insuficiente (qualquer detalhe)
  | 'mistura_recente'       // v48 nada_visivel com rodadasMistasTitulo ≥ 1
  | 'avaliacao_velha'       // última avaliação > 7 h, ou nenhuma
  | 'avaliacao_com_erro'    // última avaliação com erro
  | 'guarda_falhou'         // exceção ao ler a guarda

export type DecisaoGuarda =
  | { libera: true; base: 'nada_visivel' | 'liberado_pelo_dono' | 'guarda_desligada'; avaliadaEm: string | null }
  | { libera: false; motivo: MotivoBloqueio; avaliadaEm: string | null; registroId: string | null }

export async function avaliarGuarda(supabase, siteId: string, videoId: string, agora: Date): Promise<DecisaoGuarda>
```

- Lê **só** a última avaliação, o registro aberto e a liberação vigente do vídeo: 3 consultas por índice, sem ler leituras nem a watch. Cabe no teto de 55 s de `settleOnAir` e do início.
- **Nunca lê a watch ao vivo.** Uma rodada avulsa não decide nada: a regra precisa de 9 votos e 2 rodadas mistas (spec da regra §4.3). O botão "Tentar ler agora" do mockup pede uma rodada extra à coleta da S4 (pedido P3, §10), não uma leitura dentro da guarda.
- Exceção dentro da guarda → `guarda_falhou` (bloqueia), Sentry.

### 6.2 Política (ordem)

1. `AB_GUARDA_TESTE_YOUTUBE === 'off'` → libera, `guarda_desligada`, com `Sentry.captureMessage` a cada uso. Qualquer outro valor, inclusive ausente, = ligada (C-11 apaga a variável e afirma "ligada").
2. Registro com confirmação do dono em aberto → bloqueia `teste_confirmado`.
3. Liberação do dono vigente (§8.2) → libera `liberado_pelo_dono`, **salvo** se a avaliação mais nova tem `v14_pos_liberacao = provavel_teste` (leituras depois da liberação) → bloqueia `teste_provavel`.
4. Nenhuma avaliação, ou a última com `avaliada_em < agora − 7 h` → `avaliacao_velha`. (7 h = uma rodada de 6 h + folga do sorteio de ±20 min + atraso de um disparo.)
5. Última avaliação com erro → `avaliacao_com_erro`.
6. `estado_14 = provavel_teste` (ou registro aberto `em_andamento`) → `teste_provavel`.
7. `estado_14` ou `estado_48` em `sem_leitura`/`sem_rodada_nova` → `sem_leitura`; em `insuficiente` → `insuficiente`.
8. `estado_48 = nada_visivel` com `mistas_48 ≥ 1` → `mistura_recente`.
9. Senão → libera `nada_visivel`.

Custo aceito: falso positivo custa atraso (o Lab espera); falso negativo destrói dois testes (o nativo e o nosso). A recomendação de bloqueio do spec da regra (§8) vira os itens 6–8.

**Efeito no vídeo novo:** o teste nosso entra na coleta na criação (F8). Com 3 rodadas (~12 h), `v48` passa de `insuficiente`. Antes disso o início é recusado com "Lendo a página do vídeo: faltam N rodadas (próxima às HH:MM)". Pergunta Q3 (§12).

### 6.3 Escritas conhecidas sem travar o Lab (aviso N1 do Phil)

O defeito: passar só as escritas das últimas 30 h deixa a rodada mista da propagação de uma rotação de D-3 contar como mista; com rotação diária, sempre há uma; a política bloquearia o Lab por 14 dias.

Conserto, em duas peças:

1. **Todas as escritas do app na janela das leituras entregues**, não 30 h: `em ∈ [min lidaEm − quarentenaEscritaMs, max lidaEm + maxDuracaoRodadaMs]`. Fontes, todas `timestamptz` lidas por PostgREST (`+00:00`, aceito pelo Zod da regra):
   - `ab_test_cycles.started_at` de **todo** teste do vídeo (não só o atual);
   - `ab_test_cycles.ended_at` com `end_reason` em (`pausa`, `encerrado`, `falha_api`, `duracao_maxima`, `drift`) (instante da reivindicação, antes da escrita da saída);
   - `ab_tests.winner_applied_at`;
   - `restore_status[campo].em` com `escreveu ≠ false`, convertido **no SQL** (`(restore_status->'title'->>'em')::timestamptz`) por uma `view` de leitura `ab_escritas_do_app` (security invoker), para chegar como `timestamptz` e nunca como texto montado (r5).
   - Campo: `test_type = 'title'` → `titulo`; `combo` → `titulo` e `miniatura`; `thumbnail` → `miniatura` (sem efeito na v1, mas gravado).
   - Volume: ~1 ciclo por dia por teste; 14 dias ≈ 15 escritas por vídeo. Paginado do mesmo jeito.
2. **"Mistura bloqueia" só nas últimas 48 h** (`v48`, item 8 de §6.2). Uma rodada mista fora da quarentena que sobrou de uma propagação antiga [H: propagação não medida] sai da janela em 48 h e para de bloquear. Um teste nativo vivo a q = 0,75 por rodada deixa zero rodada mista em 8 rodadas com P ≈ 0,25⁸ ≈ 1,5 × 10⁻⁵; a 1/3 × 2/3 (q = 0,67), P ≈ 1,5 × 10⁻⁴.

O `provavel_teste` continua olhando 14 dias (`v14`): um teste nativo real pede ≥ 2 rodadas mistas por par e fração ≥ 0,4, o que a propagação de rotações diárias não produz [H, mesma hipótese da regra].

### 6.4 Ganchos

| Ponto | Bloqueio faz |
|---|---|
| `startAbTestInternal` (humano, fila, playoff), antes do passo (1) da reivindicação | recusa: `{ ok: false, error: <frase>, motivo: 'teste_youtube' }` (campo novo opcional; `actions.ts` e as assinaturas públicas não mudam) |
| Fila (`phaseProcessQueue`) com recusa `teste_youtube` | volta a `queued` e adia para a próxima rodada da coleta, **sem gastar tentativa** de `MAX_TENTATIVAS_DA_FILA` |
| Playoff com recusa `teste_youtube` | fica `draft` com `playoff_start_after` mantido; tenta no próximo ciclo |
| `retomarTeste` (humano) | recusa com frase; teste continua `paused` |
| Rotação do cron (`phaseRotateActiveTests`), antes da reivindicação | `settleOnAir(..., motivo: 'teste_youtube')` = pausa sem escrever |
| Forçar rotação (humano) | recusa com frase |
| `settleOnAir` motivo `pausa` (humano) | pausa **sem escrever** (vira `teste_youtube`) |
| `settleOnAir` motivos `encerrado`, `reverter` (humano) | recusa: resultado novo `{ resultado: 'teste_youtube'; motivo }` com frase "O YouTube pode estar testando este vídeo. Nada foi escrito. Pause o Lab ou libere-o se não houver teste." |
| `settleOnAir` motivos `falha_api`, `duracao_maxima`, `drift` (automáticos) | viram `teste_youtube`: pausa sem escrever. `duracao_maxima` **não encerra**: pausa, e o encerramento fica humano depois da liberação |
| `applyVariantToYouTube` e `restaurarCampos` | asserção: recebem a `DecisaoGuarda` do chamador (tipo `PasseGuarda` com `libera: true`); sem passe, lançam. Teste de arquitetura enumera as chamadas a `setThumbnail`, `escreverTitulo`, `updateVideoMetadata` e falha se aparecer chamador novo fora da lista |

### 6.5 Motivo de saída `teste_youtube`

- `caminhoDe`: `{ de: ['active'], para: 'paused', endReason: 'teste_youtube', extra: { status_note: <frase do motivo> } }`.
- Reivindica por `ab_settle_claim` (mesmo `restore_seq`, não o `update` direto de F7: duas escritas concorrentes têm de perder pela reivindicação).
- Pula os passos 2 e 3 (`restaurarCampos` não roda). `restore_status[campo] = { estado: 'pulado_teste_youtube', escreveu: false, ... }`.
- Exige alargar `ab_test_cycles_end_reason_check` (+ `teste_youtube`), `ab_tests_restore_status_shape` (+ `pulado_teste_youtube`) e o Zod de `ab-restore.ts:102`. **Os dois CHECKs vão já na migration da fase 1** (§7.3): alargar um CHECK não muda comportamento, e assim a fase 2 não precisa de migration (a fila tem dias sem migration a partir de 30/10, plano §1.2).
- Aviso ao dono: o mesmo canal de `avisarRestauracao`, texto "Lab pausado: o YouTube pode estar testando o título de <vídeo>. Nada foi escrito no vídeo."

### 6.6 O que acontece quando o dado não existe

| Situação | Fase 1 grava | Fase 2 decide |
|---|---|---|
| S4 sem migration (`42P01`) | tarefa `parcial`, `schema_ausente`; nenhuma avaliação | `avaliacao_velha`: bloqueia |
| Coleta desligada (`OBS_WATCH_READ` ≠ `on`) | `sem_rodada_nova` depois de 7 h | bloqueia `sem_leitura` |
| Registrador desligado (`AB_NATIVO_REGISTRO` ≠ `on`) | nada | `avaliacao_velha`: bloqueia. Por isso a fase 2 só sobe com a fase 1 ligada (C-17) |
| Todas as leituras com erro (429, consentimento) | avaliação `sem_leitura`, `comErro = N` | bloqueia `sem_leitura` |
| Layout mudou (renderers somem) | `insuficiente`, `titulo_nao_lido` | bloqueia `insuficiente` |
| Vídeo antigo sem alvo e sem teste nosso | nada (não é candidato) | ao criar o teste ele vira alvo; até 3 rodadas, bloqueia |
| Escrita com `em` ilegível | avaliação `erro` | `avaliacao_com_erro`: bloqueia |
| `count` ≠ linhas lidas | avaliação `erro`, `paginacao` | bloqueia |
| Teste só de miniatura | `nada_visivel` (é invisível de fora, F10) | **libera**: único furo; fecha só com a confirmação do dono (§8.1). A tela diz "nada visível de fora", nunca "sem teste" |

---

## 7. Banco

### 7.1 `ab_native_tests`

```sql
create table if not exists public.ab_native_tests (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid not null references public.youtube_videos(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  origem text not null check (origem in ('detectado','confirmado')),       -- como nasceu
  campos text[] not null check (campos <@ array['titulo','miniatura'] and cardinality(campos) between 1 and 2),
  estado text not null check (estado in ('em_andamento','encerrado','sem_desfecho','descartado')),
  -- detecção (null em origem confirmado sem título visto)
  variantes_titulo jsonb check (variantes_titulo is null or (jsonb_typeof(variantes_titulo) = 'array' and jsonb_array_length(variantes_titulo) between 2 and 3)),
  votos_titulo jsonb,                                  -- {texto: n}
  titulo_oficial text check (titulo_oficial is null or length(btrim(titulo_oficial)) > 0),
  primeira_vista timestamptz,
  ultima_vista timestamptz,
  veredito jsonb,                                      -- último VereditoTesteYoutube provavel_teste, inteiro (antes do desfecho)
  versao_regra smallint,
  sinais_fracos jsonb not null default '[]'::jsonb,
  evidencia jsonb not null default '[]'::jsonb,        -- [{rodada, de, ate, votos:{i: n}, mista}] (§5.3), teto 1.000 itens
  miniatura_a jsonb,                                   -- {variante, largura, altura, dhash} da hqdefault vista; B nunca (F10)
  -- desfecho
  desfecho_estado text check (desfecho_estado in ('vencedor_provavel','em_andamento','sem_dado')),
  desfecho_motivo text,
  desfecho_versao_regra smallint,
  desfecho_em timestamptz,
  vencedor_titulo text,
  vencedor_fonte text check (vencedor_fonte in ('regra','dono')),
  -- dono (fase 2)
  confirmado_em timestamptz, confirmado_por uuid references auth.users(id) on delete set null,
  descartado_em timestamptz, descartado_por uuid references auth.users(id) on delete set null,
  encerrado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origem = 'detectado' or confirmado_em is not null),
  check ((estado = 'descartado') = (descartado_em is not null)),
  check ((estado in ('encerrado','sem_desfecho')) = (encerrado_em is not null)),
  check ((vencedor_titulo is null) = (vencedor_fonte is null)),
  check (origem = 'confirmado' or (variantes_titulo is not null and primeira_vista is not null and versao_regra is not null)),
  check (ultima_vista is null or ultima_vista >= primeira_vista)
);
create unique index if not exists ab_native_tests_um_aberto on public.ab_native_tests (site_id, video_id) where estado = 'em_andamento';
create index if not exists ab_native_tests_video on public.ab_native_tests (video_id, created_at desc);
```

- **Evidência compacta:** uma entrada por rodada do período do teste (votos por índice da variante), ~60 B; 30 dias × 4 = 120 rodadas ≈ 7 KB por teste. É a prova que sobrevive à poda da S4. **Sem poda nesta tabela** (poucos testes por ano; o dono quer a biblioteca).
- **Grava o que ainda não tem tela:** `sinais_fracos` (reenvio da capa), `contagem` dentro de `veredito`, `miniatura_a`, `titulo_oficial`, votos absolutos.

### 7.2 `ab_native_avaliacoes`

```sql
create table if not exists public.ab_native_avaliacoes (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid not null references public.youtube_videos(id) on delete cascade,
  avaliada_em timestamptz not null,
  ate_lida_em timestamptz,                             -- última leitura considerada; null = nenhuma
  estado_14 text not null check (estado_14 in ('sem_leitura','insuficiente','nada_visivel','provavel_teste','sem_rodada_nova','erro')),
  motivo_14 text,
  estado_48 text check (estado_48 in ('sem_leitura','insuficiente','nada_visivel','provavel_teste')),
  mistas_48 smallint,
  estado_pos_liberacao text,                           -- só com liberação vigente (§6.2 item 3)
  contagem jsonb,                                      -- ContagemLeituras de v14 (rodadasLongas, rodadasEmQuarentena: medição pedida pelo Phil r3)
  escritas smallint,                                   -- quantas escritas do app foram passadas
  versao_regra smallint not null,
  registro_id uuid references public.ab_native_tests(id) on delete set null,
  erro text check (erro is null or erro ~ '^[a-z0-9_]{1,40}$'),
  check ((estado_14 = 'erro') = (erro is not null))
);
create index if not exists ab_native_avaliacoes_ultima on public.ab_native_avaliacoes (video_id, avaliada_em desc);
```

- ~4 linhas por vídeo por dia, ~250 B. Com 15 vídeos próprios na coleta, ~15 KB/dia, ~2,7 MB em 180 dias. **Poda: 180 dias**, em lote pela própria tarefa (1 vez por dia, até 5.000 linhas).

### 7.3 Liberação do dono (fase 2, tabela já na migration 1)

```sql
create table if not exists public.ab_guarda_liberacoes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid not null references public.youtube_videos(id) on delete cascade,
  motivo_na_hora text not null,                        -- MotivoBloqueio visto quando o dono liberou
  liberado_em timestamptz not null default now(),
  liberado_por uuid not null references auth.users(id) on delete restrict,
  valido_ate timestamptz not null,                     -- liberado_em + 14 d
  desfeito_em timestamptz, desfeito_por uuid references auth.users(id) on delete set null
);
create index if not exists ab_guarda_liberacoes_video on public.ab_guarda_liberacoes (video_id, liberado_em desc);
```

Na mesma migration: `ab_test_cycles_end_reason_check` + `teste_youtube`; `ab_tests_restore_status_shape` + `pulado_teste_youtube` (nos dois ramos, `title` e `thumbnail`); a `view` `ab_escritas_do_app` (§6.3). Nenhum código da fase 1 usa os dois valores novos.

**RLS** (padrão da E14/E18 e do GUC-spoof): nas três tabelas, `select` com `can_edit_site(site_id)` (nunca `can_view_row`); sem policy de escrita (só `service_role`, depois de `requireSiteAdmin`/`canAdminSite` nas ações); `revoke all from anon`; `revoke insert, update, delete, truncate from authenticated`; `drop policy if exists` antes de cada `create policy`. A `view` é `security_invoker = true` e herda a RLS de `ab_tests`/`ab_test_cycles`. Idempotência: `if not exists`, `create or replace`, `drop constraint if exists`.

### 7.4 Fila única

Migration A do A/B (P3) → **S4 da A5** (`observatorio_a5_s4_leitura_watch`) → **esta** (`npm run db:new ab_lab_s7_teste_nativo`) → Migration B. Antes do `db:new`: `git fetch`, trazer `origin/staging`, conferir que as duas anteriores estão lá, avisar a A5, anotar na fila. A partir de 30/10 não há dia de migration (plano §1.2): se a S4 atrasar além disso, esta espera.

---

## 8. Ações do dono (fase 2) e paridade Cowork

### 8.1 Ações (server actions com `requireSiteAdmin`, auditadas em `audit_log`)

| Ação (texto do mockup) | Efeito |
|---|---|
| "Confirmar teste de miniatura" | cria registro `origem = 'confirmado'`, `campos = ['miniatura']`, `confirmado_em/por`, `miniatura_a` da última `hqdefault` lida; a guarda passa a bloquear `teste_confirmado`; teste nosso no ar pausa sem escrever |
| "Confirmar" num registro `detectado` | grava `confirmado_em/por` (1 toque); não muda o estado |
| "Não tenho teste de miniatura" / "Desfazer" | registro confirmado sem título → `descartado`; liberação → `desfeito_em` |
| "Não é teste, liberar o Lab" / "Sei que não há teste: liberar o Lab" | dois toques; grava `ab_guarda_liberacoes` com o motivo da hora; registro aberto vira `descartado` |
| "Informar o vencedor à mão" | `vencedor_titulo`, `vencedor_fonte = 'dono'`, `estado = 'encerrado'` |
| "Recalcular" | põe o vídeo como devido na próxima execução do registrador (não roda a regra na ação) |
| "Tentar ler agora" | pedido P3 à A5 (rodada extra); sem isso, o botão não aparece |

### 8.2 Liberação vigente

`desfeito_em` nulo e `agora < valido_ate`. Libera tudo, menos um `provavel_teste` calculado só com leituras **depois** de `liberado_em` (o registrador grava `estado_pos_liberacao`). Assim, liberar no estado 4a (sem leitura) não esconde um teste que comece depois.

### 8.3 Cowork

- **Fase 1 (leitura):** `GET /api/pipeline/youtube/ab-tests/native` (filtros `video_id`, `estado`) e `GET /api/pipeline/youtube/ab-tests/native/:id` (registro + últimas 20 avaliações). `manage_ab_test` ganha `list_native` e `get_native`. Mesma serialização da tela (mesmos números).
- **Fase 2 (escrita, `auth: 'write'`):** `POST .../native/:id/confirm`, `POST .../native/:id/winner`. **Liberar o Lab fica só no CMS** (recomendação, Q4): é a única ação que desliga uma proteção.
- Integridade do pipeline (CLAUDE.md): `api-registry.ts` (entradas e `endpoint_count` do domínio youtube), `data/pipeline-docs/cowork-docs-youtube.md`, e `docs/cowork-pipeline-reference.md` só se uma section mudar. O pre-commit semeia em produção: avisar a A5 antes (plano §1.2).

---

## 9. Fase 3: o que a S9 lê

| Estado do mockup | Lê |
|---|---|
| 1 "nenhum teste visto, verificado há N h" | última avaliação `nada_visivel` sem mistura, `avaliada_em` |
| 2 provável | registro `em_andamento` (variantes, votos, `primeira_vista`, mistas da `contagem`) + `DecisaoGuarda` |
| 2b miniatura | registro `confirmado` com `campos = ['miniatura']` |
| 3 / 3b resultado | `desfecho_*`, `vencedor_*`, `versao_regra` |
| 4a sem leitura / 4b poucas leituras | `estado_14/48`, `contagem`, `yt_watch_alvos.proxima_rodada_em` |
| "Lab pausado por segurança" / "Lab liberado por você" | `ab_tests.status_note`, `ab_guarda_liberacoes` |

Mapa motivo → texto por `switch` exaustivo (`never` no `default`), um teste de componente por motivo.

---

## 10. Pedidos à A5

- **P1.** Linha `registro_teste_nativo` no catálogo da agenda (código do A/B), `ordem` depois de `leitura_watch`.
- **P2.** RPC `yt_watch_reter(p_site uuid, p_video text, p_ate timestamptz)` (`greatest`, só `service_role`), para a prova crua do teste do canal próprio ficar 365 d.
- **P3 (opcional, fase 3).** Rodada extra por pedido ("Tentar ler agora"): marcar `proxima_rodada_em = agora` do alvo por RPC.
- **P4.** Confirmar que `leiturasDoBanco` e as colunas lidas (§5.3) estão no contrato do plano da S4 e não mudam sem aviso.

---

## 11. Critérios de aceite

Vitest (`// @vitest-environment node`) salvo indicação. Dono do teste entre parênteses.

**Fase 1**
- **C-1** (Yannis) Fixture `qIg9a7vqcNo` passada por `paraLinhas` → `leiturasDoBanco` → registrador: cria 1 registro `detectado` com os dois títulos, votos 29/31, `primeira_vista` da 1ª rodada mista, `evidencia` com 20 rodadas e 13 mistas.
- **C-2** (Yannis) Reexecutar o registrador com as mesmas leituras não cria segundo registro nem duplica evidência (índice parcial + `rodada_id`).
- **C-3** (Phil) Cliente falso devolve 1.000 linhas com `count = 1.300` → o registrador pagina e usa 1.300; `count` diferente do lido → avaliação `erro`, `paginacao`, nunca `nada_visivel`.
- **C-4** (Phil) Lista vazia → avaliação `sem_leitura`; nenhuma rodada nova há > 7 h → `sem_rodada_nova`.
- **C-5** (Yannis) `em` sem fuso no 2º de 3 vídeos → avaliação `erro` só no 2º; os outros dois avaliados.
- **C-6** (Yannis) O registrador não escreve fora de `ab_native_tests`, `ab_native_avaliacoes` e da RPC P2 (cliente falso que lança em qualquer outra tabela).
- **C-7** (Phil) Sufixo estável de 18 votos B em 24 h depois do teste → `encerrado`, `vencedor_titulo` = variante canônica, `vencedor_fonte = 'regra'`, `desfecho_versao_regra = 1`.
- **C-8** (Phil) Corte (§5.4): registro encerrado não é reaberto pelas mesmas leituras; mistura nova depois do encerramento cria registro novo.
- **C-9** (Gio, integração com banco local) RLS: `anon` sem `select`; editor de outro site não vê; GUC `app.site_id` forjado por não-superusuário não vê nada; `authenticated` não insere.
- **C-10** (controlador, depois do `db:push:prod`) `relrowsecurity = true` nas três tabelas; os dois CHECKs alargados aceitam `teste_youtube`/`pulado_teste_youtube` e continuam recusando valor desconhecido.

**Fase 2**
- **C-11** (Yannis) `delete process.env.AB_GUARDA_TESTE_YOUTUBE` → guarda ligada; `'off'` → libera com Sentry.
- **C-12** (Yannis) Para cada `MotivoBloqueio`, uma avaliação sintética faz `avaliarGuarda` bloquear com aquele motivo; avaliação `nada_visivel` com `mistas_48 = 0`, fresca, libera.
- **C-13** (Phil) Aviso N1: teste nosso de título com rotação diária por 14 dias, cada rotação deixando 1 rodada mista 70 min depois da escrita (fora da quarentena de 60 min) → `v14` não é `provavel_teste` e `v48` só bloqueia nas 48 h seguintes à mista; com a mista a 30 min, nunca bloqueia (quarentena).
- **C-14** (Yannis) Início com bloqueio → `ok: false`, `motivo: 'teste_youtube'`, nenhuma chamada a `ab_settle_claim` nem ao YouTube; fila volta a `queued` sem gastar tentativa.
- **C-15** (Yannis) Rotação, `drift`, `falha_api`, `duracao_maxima` e `pausa` com bloqueio → `ab_settle_claim` com `teste_youtube`, `restaurarCampos` não roda, `restore_status` com `pulado_teste_youtube` e `escreveu: false`; `encerrado`/`reverter`/retomar/forçar → recusa, nada escrito.
- **C-16** (Yannis) Teste de arquitetura: toda chamada a `setThumbnail`, `escreverTitulo`, `updateVideoMetadata` está na lista conhecida e recebe `PasseGuarda`.
- **C-17** (controlador, portão de deploy) Fase 1 ligada em produção há ≥ 1 dia com avaliações frescas (< 7 h) para todo alvo próprio e todo teste nosso aberto, antes de subir a fase 2. Consulta de leitura em `ab_native_avaliacoes`.
- **C-18** (Gio, staging) Vídeo com registro `provavel_teste`: "Iniciar" recusa com a frase; teste nosso ativo pausa sem mudar título nem miniatura no YouTube (conferido no Studio); sem avaliação, a recusa diz "sem leitura", nunca "sem teste".
- **C-19** (Gio) Liberar (2 toques) libera; leitura nova com `provavel_teste` depois da liberação volta a bloquear; desfazer volta a bloquear.
- **C-20** (Gio) Cowork (`manage_ab_test list_native/get_native`) mostra o mesmo registro e os mesmos votos da tela; `confirm` e `winner` gravam com a chave por pessoa; não há rota de liberar.

**Fase 3:** critérios no plano da S9 (mockup aprovado).

---

## 12. Decisões abertas (com recomendação)

- **Q1. A fase 1 pode ir ao ar antes do E8?** Pelo G0, sim: não muda rotação, `settleOnAir`, drift nem avaliação (C-6 prova). O §9 do plano, porém, não libera "publicar código do A/B antes do E8". **Recomendo pedir ao dono para liberar só a fase 1**: cada teste nativo que acaba antes perde o B fora da retenção da S4. Custo: um push a mais antes do E8 (4 builds) e a migration 1 na fila. Na prática, a fase 1 só tem dado depois de a S4 estar no ar.
- **Q2. Tarefa na agenda da A5 ou cron próprio?** Recomendo a agenda (vigia e health de graça). Custo: depende do P1 da A5.
- **Q3. O Lab espera ~12 h (3 rodadas) antes da 1ª escrita num vídeo sem histórico de leitura?** Recomendo sim (já recomendado no spec da regra, §11 p.3, sem resposta do dono registrada). Custo: o teste nosso começa meio dia depois de criado; a tela diz quanto falta.
- **Q4. Liberar o Lab pelo Cowork?** Recomendo não: é a única ação que desliga proteção; fica no CMS com 2 toques.
- **Q5. `duracao_maxima` com bloqueio pausa em vez de encerrar.** Recomendo pausar: encerrar escreveria o original. Custo: o teste nosso fica pausado até o dono decidir.

---

## 13. O que NÃO conferi

- Se `qIg9a7vqcNo` está dentro dos 14 dias de publicação (se não, só entra na S4 pela D2 da A5, ainda aberta).
- O código da S4 (não existe ainda): colunas e nomes vêm do spec dela.
- O tempo de propagação de uma troca comum de título (base dos 60 min de quarentena e da janela de 48 h) [H].
- Se `can_view_private_site` (MG11) existe; usei `can_edit_site`, que o padrão aceita.
- Se o vigia de `applyVariantToYouTube` cobre todos os caminhos da P4b (avisos da A5 para a P4b: rascunho que restaura B, `queued` sem barreira).
- Limite de crons do Vercel (só relevante se Q2 for "cron próprio").
- Horas de cada fase: sem estimativa; pedir a Yannis e Phil.
- Leitura em produção: nenhuma consulta feita.
