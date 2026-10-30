# Manutenção M9b: limpeza de canal removido até `concluido` (passo 19 da M8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar um canal removido de `guardado` (ou `sem_destino`) até `concluido`, com prova de ausência no NAS, nos snapshots e no B2, pelo caminho que já existe (`obs:arquivo`), para fechar o passo 19 da M8 (item 164) antes da partida. Data-alvo do código: antes de 28/11.

**Architecture:** O banco e o kit já fazem o caminho inteiro; faltam quatro pontas: (1) a ação "Apagar do arquivo" chamando `obs_archive_channel_removal_decide`; (2) soltar o `canal:` em ESPERA no script e limpar as pastas vazias de `_recebendo`; (3) a variável dos blobs separada da variável da tela; (4) a recusa de `comandos-recarga` para canal apagado. **Sem migration, sem mudança no kit da forja, sem rota nova.** A Tarefa 6 prova isso no banco local antes de soltar o script.

**Tech Stack:** Next.js 16 (server actions), TypeScript 5 strict + Zod, Vitest (`bythiago_int`, 54421/54422), bash do script impresso.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/`: `03` §13.3 passo 19, `06` itens 161, 163, 164, 165; `04` §14.2, §14.7. Plano-mãe: `docs/superpowers/plans/2026-10-14-manutencao-nas-m9-expurgo-enxuto.md` (emenda 25/10, Tarefas 8 e 12, D-M9-10 a D-M9-13). Revisões: `.superpowers/sdd/manutencao-nas/saidas/m9-t14-rev-hanna.md` (H1, H3, H4, H5), `m9-t14-rerev-phil.md`. Mockups: `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/` (`arquivo.js`, `arq-dados.js` CAN, `peca7.js`).

## Emenda de 30/10 (revisões Phil 78, Yannis 82, Hanna 82): achado → onde foi consertado

Fonte: `.superpowers/sdd/manutencao-nas/saidas/m9b-rev-phil.md`, `m9b-rev-yannis.md`, `m9b-rev-hanna.md`. Regra do controlador sobre `thumbs_unknown_ack_at`: **`decide` grava** (`20261025000002:2549-2550`, `now()` no ramo sem linha). Phil M1 e Yannis M1 vencem; Hanna H2 cai, o negativo da T6 sai e `sem_destino` conclui.

| Achado | Onde foi consertado |
|---|---|
| Phil I1 = Yannis Y1 (2ª rodada dá `PULADO`; `JA-APAGADO` só em `canal:`) | T5 (6º argumento `canal=1` em `apaga_conferido`, testes) |
| Phil I2 (lote da E10 fica no Mac e no NAS) | Decisão 4 ao dono; T4/T7 frase; T8 runbook com o `rm -r` e ledger |
| Phil I3 + Hanna H3 + Hanna H4 + Yannis Y2 (leitura sem nome nem parada; T5 sobe junto) | Ordem de deploy (consulta com nome e `unidades_com_linhas`, parada, T5 em ramo próprio, releitura antes do pull) |
| Phil I4 = Yannis Y4 (blobs de linha `guardar`) | T1 (`.eq('archive_decision','apagar')`, teste); Decisão 2 reescrita |
| Phil I5 (frase "espere até" sem dado; `apagado_nas` pede comando) | T7 (leitor de `pendencias.ts`, `acao: null`); T8 emenda do item 163 |
| Yannis Y3 (`ESTADO_PASSO` e `ETAPAS`) | T7 (`regua(linha)`), T4 item 2 |
| Phil M1 / Yannis M1 (`ack`, `online_thumbs_known`, `b2_nomes`) | T6, tabela do dado ausente, NÃO VERIFICADO |
| Phil M2 = Yannis M2 (`so_prefixo` termina em `NADA A RODAR`) | T5 (`temLimpeza` em `fim`, frase reescrita) |
| Phil M3 = Yannis M3 (frase do `RESTA`) | T5 (frase neutra com o filho) |
| Phil M4 (`purged_at`) | T6 (provado, sai do `it.todo`) e T8 |
| Phil M5 = Yannis M10 (calendário, estimativa) | Calendário (~17/12, ESTIMATIVA), Estimativa (650-800K, julgamento) |
| Yannis M4 `soltarCache`, M5 `sem_direito`, M8 Zod | T2, Global Constraints |
| Yannis M6 (testes de `sql: null`, `COM_BANCO`, `USO`, runbook) | T3 |
| Yannis M7 (`USO` do CLI), M9 (quarentena 30 dias) | T5, T8 runbook |
| Hanna H1 (T6 primeiro) | Ordem das tarefas (T6 é a primeira de código) |
| Hanna H2 | **Não aplicado**: contradito pelo SQL (ver acima); botão de `sem_destino` fica na T7 |
| Hanna H5 (blobs em `apagado_b2`) | Decisão 2 |
| Hanna H6 (emendas do spec) | T8 (lista completa; spec não é tocado agora) |
| Hanna H7 (tese não assinada, custo contraditório) | Decisões, Estimativa |
| Hanna H8 (canal de teste é ação de hoje) | T0 |
| Hanna H9 (critério de aceite) | Critérios de aceite (nova seção) |
| Hanna H10 (mockup delta é regra) | Decisão 3 removida; T4 |
| Hanna H11 (leitura em T0, quem liga a variável) | Global Constraints, ordem de deploy passo 6 |
| "Já rodei" fora do passo 19 (Hanna, tabela) | T7b (nova, commit separado) |

**Ordem das tarefas (código):** T6 primeiro (prova a tese; se falhar, para), depois T1, T3, T5 (ramo próprio), T2, T4 (mockup, em paralelo), T7, T7b, T8. A numeração não muda para não quebrar as referências das revisões.

---

## A decisão: `expurgar --canal` não é preciso para o passo 19 (Hanna H4 confirmada, com uma ressalva)

**O caminho sem `--canal`, conferido no código de `84f351eca`:**

| Passo | Quem faz | Evidência |
|---|---|---|
| Decisão `guardar` → `apagar`, ou linha nova para `sem_destino` | `obs_archive_channel_removal_decide` (existe e tem teste; ninguém no site a chama) | `20261025000002:2533`; só aparece em `manutencao-m3b-remocao.test.ts` |
| Marca `purged_at`, fecha alvos de item em voo, abre 3 linhas de ausência por (filho, classe) | decide + gatilho `obs_archive_canal_apagado` | `20261025000002:2556`; `20261029000002:697-738` |
| Pendência `canal:` em `apagar_antigas` com todos os arquivos e sha256 | `obs_archive_owner_pending` + `obs_archive_arquivos_do_canal` | `20261029000004:164-184`; `20261029000002:1099` |
| `apaga_conferido` arquivo a arquivo + `limpa_prefixo` | script do `obs:arquivo`; hoje segurado por uma linha | `pendencias-script.ts`, `case 'apagar_antigas'`; a linha `limpa_prefixo` saiu no `7edb13a58` |
| Duas ausências com 11 h, snapshots 14 d 8 h, conferência do NAS em 24 h | copiador + `obs_archive_attest_prefixos` + `obs_archive_etapa` | `copiar.py:218`; `20261029000002:936` |
| Nomes no B2 para o painel; `conferir-b2` conclui | `b2_painel`, `conferir.py:242` | `pendencias-script.ts`, `case 'conferir_b2'` |
| `completed_at` | `obs_archive_removal_advance` exige B2, `blobs_pending` vazio, miniaturas e lote E10 | `20261029000002:871-898` |

O lote da E10 não segura o canal do passo 19: `competitor_channel_remove_archived` grava `deleted_at` no lote (`20261021000002:359`), e o gatilho só olha `deleted_at` e `closed_at` nulos. **Consequência (Phil I2):** `deleted_at` quer dizer "linhas apagadas do banco"; `concluido` não prova que o export sumiu do Mac e do NAS. Ver Decisão 4.

**O que `--canal` faria e o `obs:arquivo` não faz:** apagar por `rm -r` arquivo que o registro não conhece, e limpar `_recebendo/`. Disso sai a ressalva:

**Defeito achado, bloqueia o `concluido`.** O copiador cria `_recebendo/<classe>/canais/<ref>/<tabela>/` ao gravar (`comum.py:369`) e nunca apaga a pasta (`copiar.py:154-167` só faz `unlink` do arquivo; nenhum `rmdir`, `removedirs` nem `rmtree` em `copiar.py` e `comum.py`). `prefixos_nas` usa `lstat` (`comum.py:284`): pasta vazia é `presente`. O prefixo `_recebendo/...` tem linha em `obs_archive_absence`, mas sai da lista `prefixos` da pendência (`not like '\_recebendo/%'`), então ninguém o limpa. Resultado: todo canal que teve unidade copiada fica em `apagar_antigas` para sempre, com o script dizendo `FEITO (0 gravado(s), 0 apagado(s), N já feito(s))`. É falha em verde. A Tarefa 5 conserta sem SQL e sem kit: o script deriva os dois prefixos de `_recebendo` e limpa só pastas vazias.

**Decisão do plano:** `--canal` sai do caminho do passo 19. Fica recusado no CLI com frase honesta. Arquivo desconhecido vira `RESTA`, com o procedimento manual no runbook. Se um `RESTA` real aparecer, abre-se o `--canal` como tarefa própria. Isso exige emenda do dono no passo 19 e no item 161 (Decisão 1).

## Decisões abertas para o dono (Tarefa 0)

Tese "sem `--canal`, sem migration, sem kit": Phil e Yannis a confirmaram por leitura; a prova é a T6, que roda primeiro. Custo total: **650-800K (ESTIMATIVA, julgamento de Yannis, sem medida)**; a Decisão 1 "sim" evita ~60K de tarefa extra.

| # | Pergunta | Recomendação (minha e da Hanna) | Custo de cada lado |
|---|---|---|---|
| 1 | Emendar passo 19 e item 161: limpeza pelo `obs:arquivo`, sem `expurgar --canal` nem `rm -r`? Só vai ao dono depois da T6 verde. | Sim | Sim: ~60K a menos e nenhum comando novo que apaga por `rm -r`; arquivo desconhecido (`RESTA`) vira passo manual por ssh, inclusive de longe. Não: tarefa extra de ~60K (`--canal`, arquivo de comandos, rota C14 `passo: 'canal'`, testes do 161), total ~710-860K |
| 2 | Ligar `OBS_ARQUIVO_LIMPEZA_BLOBS` quando o canal de teste chegar a `apagado_b2` (NAS, snapshots e B2 já provados), repetindo nesse dia a leitura de `blobs_pending` e mostrando ao dono? A tentativa diária só toca linha `apagar` (T1). | Sim, em `apagado_b2`, não no dia do apagamento | Sim: miniaturas das remoções `apagar` listadas somem sem volta; ~1 dia a mais até o `concluido`. Não: passo 19 para em `apagado_b2`, itens 164 e 59 ficam abertos |
| 4 | Lote da E10 (Phil I2): aceitar que `concluido` não apaga o export de `~/Workspace/arquivo-observatorio/<lote>` e do destino do `comandos-nas`, e que o passo é manual, com frase na tela e `rm -r` no runbook? | Sim, passo manual explícito, sem mexer no banco | Sim: ~5K; o dono tem de apagar à mão, e a tela avisa. Não (rastrear o lote como prefixo): exige SQL e kit, fora desta fase; cópia integral, com comentários de terceiros (LGPD), segue em dois lugares sem aviso |

A antiga Decisão 3 (mockup delta antes da T7) deixou de ser pergunta: é regra permanente (Hanna H10); entra na fila de aprovação.

## Global Constraints

- Sem migration e sem kit. Se a Tarefa 6 mostrar que é preciso um dos dois, **pare e volte ao controlador**: muda a ordem de deploy e envolve o dono.
- Nada contra produção, forja ou NAS durante a implementação. Leitura de produção só nos passos marcados da ordem de deploy e na T0 (consulta do canal de teste, já nomeada).
- Validação de entrada com Zod (`z.string().regex(...)`), nunca regex solta (Yannis M8).
- Toda ação nova: confere admin no servidor (`canUnlock`), valida com Zod, nunca importada direto no client (callback por prop). Cores literais, sem `color-mix`.
- Sanitização, datas e fixture: fake timers; teste que apaga a variável (`delete process.env.X`) para todo default.
- Commit por caminho explícito; `npm run build:packages` não se aplica (nada em `packages/`).

## Tasks

### Task 0: portão do dono (sem código) // ~5K

- [ ] **Hoje (Hanna H8): é ação, não conferência.** Cadastrar o canal de teste e conferir com a consulta de `competitor_video_daily` de `saidas/m9-t14-rerev-phil.md` (`count >= 1` em outubro; a conferência é 01/11). Zero: o passo 19 vai para a selagem de 28/12 e o `concluido` para meados de janeiro, com o item 11 da lista de partida aberto; o código segue com pressa.
- [ ] Levar as Decisões 1, 2 e 4 ao dono, com "pode" descritivo, a 1 só depois da T6 verde. Anotar em `m9-progresso.md`.

### Task 1: separar a variável dos blobs (Hanna H3) // ~30K

**Files:** Modify `apps/web/src/lib/youtube/observatorio/arquivo/remover.ts:273`, `apps/web/test/youtube/observatorio/arquivo-remover.test.ts`, `docs/ops/env-vars.md`.

Regra nova: `OBS_ARQUIVO_LIMPEZA_CANAL` = a tela e a ação (promessa do comando). `OBS_ARQUIVO_LIMPEZA_BLOBS` = a nova tentativa diária de `retentarBlobsDeRemocoes`. `capacidades.ts` não muda.

- [ ] **Passo 1. Testes, falhando:** em `arquivo-remover.test.ts`, `describe` da T13 troca para a variável nova. Novos: variável nova ausente com `OBS_ARQUIVO_LIMPEZA_CANAL=on` → `{ porque: 'flag_desligada' }` e `apagarDoBlob` não chamado; variável nova `on` com a antiga ausente → apaga; valores `ON`, `1`, `''` → desligada (`delete process.env` no caso ausente).
- [ ] **Passo 2 (Phil I4 = Yannis Y4).** Teste: linha `guardar` com `blobs_pending` não é tocada nem entra em `pendentes`; só `archive_decision = 'apagar'`. Antes de ligar a variável.
- [ ] **Passo 3.** Rodar → FAIL.
- [ ] **Passo 4.** `remover.ts:278-281`: acrescentar `.eq('archive_decision', 'apagar')` à seleção. `remover.ts:273`: `if ((deps.env ?? process.env).OBS_ARQUIVO_LIMPEZA_BLOBS !== 'on') return { porque: 'flag_desligada' }`; ajustar o comentário da l.266.
- [ ] **Passo 5.** `env-vars.md`: a linha da T13 (l.30) vira `OBS_ARQUIVO_LIMPEZA_BLOBS`, e a l.29 diz que a antiga liga a tela e a ação.
- [ ] **Passo 6.** Rodar → PASS. Commit: `fix: M9b: variável própria para os blobs das remoções (Hanna H3)`.

### Task 2: as ações `apagarDoArquivo`, `marcarRodado`, `desfazerRodado` // ~45K

**Files:** Create `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/actions-canal.ts`, `apps/web/test/youtube/observatorio/arquivo-actions-canal.test.ts` (`// @vitest-environment node`). Antes, `grep -n "guardaDaRemocao\|permissoesDoSite" "apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts"` e `_chrome/permissoes.ts`: usar a guarda que devolve `{ siteId, userId }` com `canUnlock`.

```ts
type Resposta = { ok: true; status: 'ok' | 'ja_pedido' } | { ok: false; erro: 'sem_permissao' | 'forma' | 'desligado' | 'nome_nao_confere' | 'canal_nao_encontrado' | 'interno' }
export async function apagarDoArquivoAction(channelRef: string, digitado: string): Promise<Resposta>
export async function marcarRodado(itemId: string): Promise<{ ok: true } | { ok: false; erro: string }>
export async function desfazerRodado(itemId: string): Promise<{ ok: true } | { ok: false; erro: string }>
```

`apagarDoArquivoAction`, nesta ordem: guarda de admin → `lerCapacidades().comandoDeLimpeza` falso devolve `desligado` → `UUID_RE` em `channelRef` → `nomeConfere(digitado, esperado)` (`_canais/remover-model.ts:164`; reusar, é a regra do mockup 11.2), com `esperado` relido no servidor por `lerCanaisRemovidos` (`nome ?? código`), nunca vindo do client → `rpc('obs_archive_channel_removal_decide', { p_site, p_channel_ref, p_actor })` → `soltarCache` (`actions.ts:285`, exportada e reusada, sem cópia: invalida também o pacote de 15 min e a tag de 300 s; Yannis M4). Erro `sem_direito` do banco vira `sem_permissao` (M5). `UUID_RE` e `ItemId` por `z.string().regex` (M8).

`marcar` (entra na T7b, não no passo 19): `ItemId = /^(item:[1-9][0-9]{0,18}|canal:[0-9a-f-]{36})$/`; `antiga:` recusada; `rpc('obs_archive_marcar_rodado', { p_site, p_item_id, p_actor, p_desfazer })` (já com `grant` a `service_role`, `20261029000002:1074`).

- [ ] **Passo 1. Testes, falhando:** sem admin: `sem_permissao` e `rpc` não chamado (nas três); variável ausente (`delete`): `desligado`; uuid com `'`: `forma`; nome errado: `nome_nao_confere`; nome com caixa e acento diferentes: passa; `ja_pedido` do banco vira `{ ok: true, status: 'ja_pedido' }`; erro `canal_nao_encontrado` traduzido; erro desconhecido: `interno`, com Sentry, sem repassar a mensagem; `marcarRodado('antiga:<uuid>')`: `forma`; `desfazerRodado`: `p_desfazer: true`.
- [ ] **Passo 2.** Rodar → FAIL. **Passo 3.** Código. **Passo 4.** Rodar → PASS, typecheck web.
- [ ] **Passo 5.** Commit: `feat: M9b: ações apagar do arquivo e já rodei`.

### Task 3: `comandos-recarga` recusa canal apagado (165, parte canal) // ~40K

**Files:** Modify `apps/web/src/lib/youtube/observatorio/arquivo/cli.ts` (l.58 `COM_BANCO`, l.69, l.188, l.303), `apps/web/test/youtube/observatorio/arquivo-cli*.test.ts` (`grep -ln "comandos-recarga" apps/web/test`), `apps/web/test/integration/manutencao-m9-cobertura.test.ts`.

O que existe de restauração hoje e o que muda:

| Comando | Situação | M9b |
|---|---|---|
| `comandos-recarga` (E10, Mac) | não consulta o banco | ganha a consulta |
| `restaurar_do_b2.py --do-plano` | lê `aguardando_dono.json`, que vem do plano | sem mudança; Tarefa 6 prova que unidade com `purged_at` não entra |
| `restaurar_do_b2.py --file-id` | ferramenta manual do dono, sem site | sem mudança; frase no runbook; arquivo restaurado aparece como `presente` e reabre a limpeza |
| `ensaiar-restauracao` | não existe no código | passa à M8, com a regra do 165 (Tarefa 8) |

Regra, depois de validar o manifesto: `obs_archive_channel_is_removed(site, m.valor.canal.id)`. `decisao = 'apagar'`: `recusado('canal_apagado: ...')`, sem nenhum `\copy` na saída. `decisao = 'guardar'`: imprime, porque recarregar lote guardado é o uso legítimo. `sem_destino: true`: imprime, com uma linha de aviso. **Motivo:** a função devolve `sem_destino` para qualquer canal ausente sem remoção, inclusive lote anterior à M3b (`20261025000002:2606`), e recusar aí quebra a recarga antiga.

- [ ] **Passo 1. Testes, falhando:** um por caso (canal existe, `apagar`, `guardar`, `sem_destino`); sem `OBS_ARQUIVO_DB_URL`: erro claro, nunca imprimir os comandos sem consultar; `canal_apagado` sem `\copy` na saída.
- [ ] **Passo 2.** Rodar → FAIL. Quebram por `sql: null`/env vazia e são atualizados no mesmo commit (Yannis M6): `arquivo-cli.test.ts:75,145,177,196,204,214`, `observatorio-a5-e10-ida-e-volta.test.ts`; também o comentário de `COM_BANCO` ("só imprimem", l.57), o `USO` (a T3 é dona da linha de `comandos-recarga`; a T5 rebaseia depois da T3 e é dona da linha de `--canal`) e `docs/ops/observatorio-arquivo-runbook.md`. Custo já dentro da estimativa revista.
- [ ] **Passo 3.** `COM_BANCO` inclui `comandos-recarga`; opção `--site`; a despacho sai da l.188 para o `switch` depois de `resolverSite`.
- [ ] **Passo 4.** Rodar → PASS. Trocar o `it.todo` do 165 canal por `it` no `cobertura`. Commit: `fix: M9b: recarga recusa canal apagado (item 165)`.

### Task 4: mockup delta (portão antes da Tarefa 7) // ~60K

**Pedido explícito de mockup; o delta é regra permanente, não pergunta ao dono.** O aprovado cobre o diálogo (`c-apagar`, `c-apagar-sd`), a linha `guardado` (c10), `sem_destino` (c11) e o painel da peça 7. **Não** cobre:

1. **"Ver os comandos" do canal:** `CMDHTML` e c1, c2, c3, c5, c6, c12 falam de `expurgar --canal` e "o arquivo que ele gravar". Viram a linha fixa da peça 7, com Copiar. Pendente da Decisão 1.
2. **Ordem da régua:** c5 e c7 pressupõem B2 antes dos snapshots. Desde a M9-snap (`obs_archive_etapa`) é NAS → snapshots (14 d 8 h) → B2. `ETAPAS` e `ESTADO_PASSO` em `canais-removidos.ts` e c5 ("rode o comando de novo") estão errados na espera: frase "espere até dd/mm" só quando há data (Phil I5, Yannis Y3); `apagado_nas` esperando snapshots não mostra comando.
6. **Frase do lote da E10** no diálogo `c-apagar` e no `concluido` de canal que veio de `e10_export`: "o lote exportado à mão fica no Mac e no NAS; apague-o" (Decisão 4).
3. **Estados com `falta`:** `lote_e10`, `blobs`, `imagens`, e `RESTA` (arquivo desconhecido).
4. **Erro do clique** em "Apagar do arquivo" e `ja_pedido`.
5. **"Já rodei" no canal:** recomendação: só no painel da peça 7, como aprovado, e não na linha do bloco (a Tarefa 12 antiga previa os dois).

- [ ] Logan e Naksu discutem antes de desenhar; skill `frontend-design` desenha na pasta `19-mes-fora-do-banco`; os dois revisam; `open -a Opera` para o dono; anotar em `ROTEIRO-DE-TESTE-E-MELHORIAS.md`. Portão: aprovação do dono.

### Task 5: limpar `_recebendo` e soltar o `canal:` // ~50K

**Vai por último no deploy, em ramo próprio** (`chore/manutencao-m9b-t5`), que só entra em `staging` depois do passo 3 da Ordem de deploy, que é a regra única (lista vazia segue sem perguntar; linha na lista exige "pode" por canal; Yannis Y2). O script nasce do checkout do Mac em `staging`: o `git pull` de `staging` já vale, não a promoção. **Files:** Modify `apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts`, `apps/web/test/youtube/observatorio/arquivo-pendencias-bash.test.ts`, `arquivo-expurgar.test.ts:333`, `cli.ts:102` (frase).

```ts
case 'apagar_antigas':
  temApagar = true
  for (const a of i.apagar) { /* como está */ }
  if (i.itemId.startsWith('canal:')) {
    temPrefixo = true
    for (const p of i.prefixos) itens.push(`  limpa_prefixo ${aspas(p)}`, `  limpa_prefixo ${aspas('_recebendo/' + p)}`, `  limpa_prefixo ${aspas('_recebendo/_quarentena/' + p)}`)
  }
  break
```

`limpa_prefixo` já roda sob a `TRAVA`, confere sentinela e só apaga pasta vazia (`find -xdev -depth -type d -empty -delete`). Frase do `RESTA`: `RESTA <filho>/<prefixo>: a pasta não ficou vazia; veja "Sobrou arquivo no canal" no runbook` (frase neutra: cobre arquivo desconhecido, sha divergente e falha de permissão do `find`; Phil M3, Yannis M3). **Falha em verde:** `RESTA` hoje só soma `esperando` e a última linha diz `FEITO`. Passa a somar `falhas` também, e a saída fica `NÃO TERMINOU`.

**`JA-APAGADO` em item `canal:` (Phil I1 = Yannis Y1):** `limpa_prefixo` remove a pasta do canal, então na 2ª rodada `apaga_conferido` cairia em `PULADO: a pasta não existe` e somaria `falhas`. 6º argumento `canal=1` em `apaga_conferido`, passado só em item `canal:`: pasta e `$alvo` ausentes, com montagem e sentinela já conferidas, contam `JA-APAGADO`. Item `item:` e `antiga:` mantêm o `PULADO`. Caminho errado de verdade não some em silêncio: o arquivo real continua e `limpa_prefixo` dá `RESTA`.

**`temLimpeza` (definição única, aqui):** `temLimpeza = temApagar || temPrefixo`, com `temPrefixo` ligado no item `canal:` e no `so_prefixo` com `prefixos`. Os outros trechos só a usam.

**`fim` (M2):** `fim` olha `temApagar || temGrava || temLimpeza`; sem isso `so_prefixo` limpa e termina em `NADA A RODAR AGORA`. `FRASE_DA_FALTA.so_prefixo` ("a limpeza as confere sozinha") fica falsa: reescrever, mantendo-a única para o teste de `FALTAS`.

Caso `so_prefixo` (`sem_comando`): também imprimir os `limpa_prefixo` quando `i.falta === 'so_prefixo'` e há `prefixos`; sem isso a pasta vazia prende canal sem arquivo conhecido. A `TRAVA` usa `temLimpeza` (definição acima).

- [ ] **Passo 1. Testes, falhando** (bash real em raiz falsa temporária, como o `describe` da l.245, que é reescrito):
  - canal com 2 arquivos e `_recebendo/<p>/tab/` vazio: tudo some, `FEITO`.
  - `_recebendo/_quarentena/<p>/x.csv` com arquivo: arquivo fica, `RESTA`, sai 1, `NÃO TERMINOU`.
  - arquivo desconhecido em `<p>/`: fica, `RESTA`.
  - sha256 diverge: `PULADO`, nada apagado.
  - outro canal `<p2>` intacto.
  - sem sentinela: nada apagado.
  - rodar duas vezes: 2ª sai 0 com `JA-APAGADO`, `falhas=0`; pasta do canal nunca criada: idem; item de vídeo com pasta ausente segue `PULADO`.
  - `so_prefixo` limpa e termina com a frase de limpeza, não `NADA A RODAR AGORA`.
  - `so_prefixo` com pasta vazia: pasta some.
  - item de vídeo ao lado continua apagando.
- [ ] **Passo 2.** Rodar → FAIL. **Passo 3.** Código. **Passo 4.** Rodar → PASS.
- [ ] **Passo 5.** `cli.ts:102` e a linha `USO` (`cli.ts:52`, que ainda diz `--canal: M9b`; a T5 rebaseia depois da T3 e toca só a linha de `--canal`, a de `comandos-recarga` é da T3): frase `expurgar --canal não existe: a limpeza de canal é pelo obs:arquivo`; teste ajustado. Commit: `feat: M9b: obs:arquivo limpa canal removido, inclusive pastas de _recebendo`.

### Task 6: a prova de ponta a ponta no banco local // ~70K (PRIMEIRA de código, antes do mockup)

**Files:** Create `apps/web/test/integration/manutencao-m9b-canal.test.ts` (`describe.skipIf(skipIfNoLocalDb())`, helpers `m3b`, `aplicarM9`, `begin … rollback`). Critério de aceite: verde no 54422 sem SQL novo; quem confere: Phil e Yannis. Se falhar, **para** e volta ao controlador (muda a ordem de deploy).

- [ ] Roteiro em um `it`: canal com unidade, resumo e `received_at` → `competitor_channel_remove` com `guardar` (via `e10_export`) → lista dá `guardado` → `decide` → lista dá `pedido`, pendência `apagar_antigas` com os arquivos e 3 linhas por (filho, classe) → `attest_prefixos` ausente em todas (inclusive `_recebendo`) → `segunda_conferencia` → 2º attest com 11 h → `snapshots` → attest de snapshot → `conferir_b2` → attest B2 com nome real (não fixture; `b2_nomes` com `fileName` inteiro e prefixo `filho/`, Yannis) → `apagado_b2` → `blobs_pending` vazio → `concluido`, `completed_at` e `obs_archive_absence` encerrada.
- [ ] Negativos: uma linha `_recebendo` `presente` segura em `apagar_antigas` (o defeito, documentado); `blobs_pending` com URL segura com `falta 'blobs'`; linha montada à mão com `online_thumbs_known = false` e `thumbs_unknown_ack_at` nulo → `falta 'imagens'`. **Não** testar `sem_destino` por `decide` como negativo: `decide` grava `thumbs_unknown_ack_at = now()` (`20261025000002:2549-2550`), então `sem_destino` conclui; adicionar o positivo `sem_destino` → `concluido`.
- [ ] `guardar` via `e10_export` nasce com `online_thumbs_known = true` (`:2720`): afirmar.
- [ ] Unidade com `purged_at` fora de `aguardando_dono` no `obs_archive_plan` (fecha o `it.todo` de 165 `purged_at`; filtros `purged_at is null`, `:542-558`).
- [ ] SQL de reversão (`archive_decision`, `purged_at`/`purged_by`/`purge_ref`, APAGAR as linhas de `obs_archive_absence` do canal, nunca só encerrar) provado dentro de `begin … rollback`; o texto vai ao runbook (T8).
- [ ] Rodar a suíte `manutencao-m9*` inteira. Se qualquer passo exigir SQL: **parar** (Global Constraints).
- [ ] Commit: `test: M9b: canal de guardado a concluido, de ponta a ponta`.

### Task 7: a tela (depende da Tarefa 4) // ~120K

**Files:** Modify `_arquivo/bloco-canais-removidos.tsx`, `_arquivo/arquivo-screen.tsx`, `_canais/esperam-comandos.tsx` (l.4 diz "sem Já rodei (M9)"), `apps/web/src/lib/youtube/observatorio/arquivo-mensal/canais-removidos.ts` (frases, `ETAPAS`, campo novo `acao`). Create `_arquivo/apagar-do-arquivo.tsx` (`'use client'`). Tests: `apps/web/test/cms/observatorio/canais-removidos.test.tsx` (`// @vitest-environment jsdom`), `arquivo-mensal-estado.test.ts`.

- [ ] `montarLinha` devolve `acao: 'apagar' | 'comandos' | null` e `dialogo: { titulo, meses, faixa, confirma } | null`. `guardado` e `sem_destino`: `apagar`, só com `cap.comandoDeLimpeza`, só para `administra`. `pedido`: `comandos`. `apagado_nas` com `falta = 'snapshots'`: `acao: null`, fora da marca da pastilha, frase com a data; só `falta = 'conferir_b2'` dá `comandos` (Phil I5).
- [ ] **Dados (sem migration):** a lista não traz `snap_libera_em`. Ler as pendências pelo leitor de `pendencias.ts` (`snapLiberaEm`, `snapBloqueio`) e juntar por `channel_ref`. `snapBloqueio` preenchido: frase âmbar, sem data. **Custo e cliente (conferido por grep em `_canais/pendencias-da-fila.ts`):** a leitura é a RPC `obs_archive_owner_pending`, uma chamada por render da página, sem cache, com `getSupabaseServiceClient()`, só depois da guarda `podeEditar` (e só com `OBS_ARQUIVO=on`). A peça 7 já faz essa chamada: reusar `lerPendenciasDaFila` (ou a mesma leitura passada por parâmetro) em vez de uma segunda RPC no mesmo render; falha vira sem frase de data, nunca zero.
- [ ] **Régua (Yannis Y3):** `regua()` recebe a linha, não só o estado: `apagado_nas` com `snapshots_clear_on` = passo 2; `apagado_b2` = passo 3 ou mais; mudar `ETAPAS` **e** `ESTADO_PASSO` (`canais-removidos.ts:42-48`). A frase da régua acompanha `regua(linha)`: o mesmo passo decide o texto, nunca o estado sozinho. Teste por combinação (`nas` sem snap, `nas` com snap, `b2`, `concluido`) e `snapshots_clear_on` nulo em `apagado_b2`.
- [ ] Frase do lote da E10 no `c-apagar` e no `concluido` vindo de `e10_export` (Decisão 4).
- [ ] `BlocoCanaisRemovidosView` recebe `onApagar` por prop (a página passa a action). Para quem não administra: frase "espera quem administra", sem botão.
- [ ] Diálogo: `c-apagar` (digita nome) e `c-apagar-sd` (digita código, aviso do Blob). Botão desabilitado até `nomeConfere`.
- [ ] `sem_destino`: a linha e o botão `c-apagar-sd` ficam (a ação conclui, ver T6).
- [ ] Testes: um por estado do CAN aprovado com texto exato; `meses` nulo: diálogo sem número e sem confirmar, nunca "0 meses"; idade 29, 31, 61 dias com fake timers; erro da ação preserva o estado; `podeApagar=false` sem botão; flag ausente (`delete`): sem botão, frase "espera o comando"; `apagado_nas` esperando snapshots: marca da pastilha zero, `acao: null` e a data na frase.
- [ ] Gio valida com o CMS local autenticado, Logan e Naksu revisam o implementado, dono confere no Opera.
- [ ] Commit: `feat: M9b: apagar do arquivo e ver os comandos na tela`.

### Task 7b: "Já rodei" e "Desfazer" (commit separado, não segura o passo 19) // fora dos ~120K, a estimar

**Files:** `actions-canal.ts` (`marcarRodado`, `desfazerRodado`), peça 7. Gatilho: T7 no ar, ou 1º item real depois de 28/11. Mockup já aprovado (itens 65 e 111).

- [ ] Peça 7: "Já rodei" e "Desfazer" pelo molde de `peca7.js:61,139-140`, com `marcarRodado`/`desfazerRodado` por prop; `refutado` em âmbar quando `marcadoRodadoEm` e o item segue pendente. Testes de `marcar`/`desfazer` da T2 (`antiga:` → `forma`; `p_desfazer: true`).
- [ ] Commit: `feat: M9b: já rodei e desfazer no canal e no item`.

### Task 8: cobertura, runbook, emendas, revisão // ~110K (30K + revisões)

- [ ] `manutencao-m9-cobertura.test.ts`: `it.todo` 161 relido com a Decisão 1 (provas de fim viram `it` da Tarefa 6; comando sai); 163 vira `it`; 165 canal, feito; 65 "Já rodei", 65 31/61 e 111 (a Tarefa 7 fecha, para canal e para item). **Ficam:** 120, do núcleo (165 `purged_at` fecha na T6, l.207). Tabela do topo atualizada.
- [ ] `docs/ops/runbook-arquivo-mensal.md`: "Canal removido fica SEGURO" vira o ciclo do canal; seção "Sobrou arquivo no canal" (leitura `find`, decisão do dono, `rm` à mão); frase do `--file-id`; a condição "só liga depois de um ciclo inteiro limpo" conforme a Decisão 2; tabela de `falta` ganha `blobs`, `imagens`, `lote_e10`, `so_prefixo`.
- [ ] Spec (com a Decisão 1; **não tocar o spec agora**, só ao executar a T8) emendas completas (Hanna H6): `03` passo 19 e `03:214`; `04:241` ("Ver os comandos"); `05:597-603` (§16.10); `06` itens 69, 161, 163 (`apagado_nas` não conta na marca, Phil I5) e 164 (emenda dos dois: revisão "`apagado_b2` 15 dias depois de `snapshots_clear_on`"), 165 (`ensaiar-restauracao` chama `obs_archive_channel_is_removed`, a cargo da M8), 166, P34; `02:758`. Conferir com grep de `expurgar --canal`. Plano-mãe: D-M9-10 e D-M9-13 com nota. Plano da M8: linha do 165.
- [ ] Runbook, itens extras: `rm -r` do lote da E10 no Mac e no NAS, com registro no ledger do passo 19 e `ls` vazio guardado em `saidas/` (Decisão 4); SQL de reversão provado na T6; `RESTA` em `_quarentena` tende a se resolver sozinho (quarentena de 30 dias, `copiar.py:37`): esperar antes do `rm`; canal real de 12 meses leva dias de clique no painel do B2 (até 20 nomes por prefixo).
- [ ] Critérios de aceite, em seção própria abaixo.
- [ ] Phil (dados) e Yannis (software) revisam o lote inteiro, incluindo a tese "sem `--canal`, sem SQL, sem kit". Consertar até haver acordo. Hanna fecha a amarração com a M8.
- [ ] Status: linha 28 e linha 22.

## O que acontece quando o dado não existe

| Dado ausente | Resultado | Onde |
|---|---|---|
| `OBS_ARQUIVO_LIMPEZA_CANAL` ausente | sem botão; ação devolve `desligado`; bloco diz "espera o comando" | T2, T7 |
| `OBS_ARQUIVO_LIMPEZA_BLOBS` ausente | nada apagado; canal para em `falta 'blobs'`, nunca `concluido` | T1, T6 |
| Lista de canais ilegível | "Não foi possível ler os canais removidos.", nunca vazia; ação sem `esperado` devolve `interno` | T7 |
| `meses`/`nome` nulos | diálogo sem número e sem confirmar; rótulo cai no código de 8 | T7 |
| Pasta vazia em `_recebendo` | limpa pelo script; sem isso, presa para sempre (defeito) | T5 |
| Arquivo em `_recebendo/_quarentena` ou desconhecido | `RESTA`, sai 1, `NÃO TERMINOU`, o que sobrou ficou como estava, canal não avança | T5 |
| Filho sem sentinela | `limpa_prefixo` pula; copiador não atesta (`filho_fora`); estado não anda | T5 |
| Item sem `prefixos` | nenhum `limpa_prefixo`; `apaga_conferido` segue; o copiador acusa `presente` e o item não avança | T5, T6 |
| Canal de teste sem linha em outubro | passo 19 vai para 28/12; a consulta da Tarefa 0 diz antes | T0 |
| `conferir_b2` com `b2_nomes` vazio | não ocorre: a etapa exige `b2_checked_at` em toda linha aberta e `presente` sem nomes é recusado por `forma` (Phil M1); conferir nome real na T6 | T6 |
| Remoção `apagar` antiga já em produção | apaga no 1º `obs:arquivo` depois do deploy; por isso a consulta do passo 3 e a parada se `unidades_com_linhas > 0` | Ordem de deploy |
| `thumbs_unknown_ack_at` | `decide` grava `now()` (`:2549-2550`): `sem_destino` conclui; só linha à mão com `online_thumbs_known = false` fica em `imagens` | T6 |
| Pasta do canal já removida (2ª rodada) | `JA-APAGADO`, não `PULADO` | T5 |
| Lote da E10 | `concluido` não o apaga; frase na tela e `rm -r` no runbook | T7, T8 |
| `snap_libera_em` ausente da lista | lido de `pendencias.ts`; sem dado, sem frase de data | T7 |

## Ordem de deploy

Sem migration e sem kit, portanto sem passo do dono na forja. Tudo com variáveis ausentes até o fim. A T6 já passou (primeira de código).

1. **T1, T2, T3, T7 em `staging`, CI verde, promoção a `main`.** Efeito em produção: nenhum (botão escondido). `blobs` segue desligado. T7b entra quando quiser, sem ordem.
2. **`git pull` no checkout do Mac:** `comandos-recarga` agora pede `OBS_ARQUIVO_DB_URL`.
3. **Leitura de produção, com critério de parada (Phil I3, Hanna H3, Yannis Y2):**
```sql
select r.channel_ref, r.name_at_removal, r.removed_via, r.units_at_removal, r.first_month, r.last_month, cardinality(r.blobs_pending) as blobs,
       (select count(*) from public.obs_archive_units u where u.site_id = r.site_id and u.channel_ref = r.channel_ref and u.row_count > 0) as unidades_com_linhas
  from public.obs_archive_channel_removals r where r.archive_decision = 'apagar' and r.completed_at is null;
```
   Regra: `unidades_com_linhas > 0` em qualquer linha, ou canal que o dono não reconheça: **o passo 4 não acontece**, e a volta atrás vira tarefa própria (SQL de reversão da T6, com migration só se o dono pedir). Lista vazia: segue sem perguntar. Linha na lista exige "pode" por canal: o dono diz "pode apagar o arquivo do canal X, na primeira rodada", um por linha. A T5 aponta para esta frase. Guardar a saída em `saidas/`.
4. **T5 em ramo próprio, mergeada em `staging` só depois do passo 3.** Repetir a consulta do passo 3 imediatamente antes do `git pull` no Mac. A partir desse pull, `obs:arquivo` deixa de ser só espera: apaga. Promoção a `main` depois.
5. **`OBS_ARQUIVO_LIMPEZA_CANAL=on` no Vercel**, redeploy. Invertido com o passo 4, a tela promete um comando que ainda só espera.
6. **`OBS_ARQUIVO_LIMPEZA_BLOBS=on` quem liga: o controlador, com o "pode" do dono**, quando o canal de teste chegar a `apagado_b2`, depois de repetir nesse dia a leitura de `blobs_pending` e mostrar ao dono (Decisão 2).

**Volta atrás:** apagar as variáveis esconde a ação na hora; reverter o commit da T5 segura o canal de novo. A decisão `apagar` já gravada e os arquivos apagados **não voltam** (só o SQL de reversão, para linha sem arquivo apagado).

**Calendário do passo 19:** selagem em 28/11; copiador e B2 atestam; E10 com o canal de teste (`guardado`); "Apagar do arquivo"; `obs:arquivo`; 11 h; 14 d 8 h de snapshots; B2. Espera do `obs:arquivo` ao `concluido`: 11 h + 14 d 8 h + copiador + 1 a 3 dias de painel do B2 = 15 a 16 dias. Fim esperado por volta de **17/12 (ESTIMATIVA)**, antes da partida de janeiro; uma reabertura zera os 14 dias (uma só cabe, duas não). Canal real de 12 meses leva dias de clique no painel.

## Critérios de aceite (Hanna H9)

- **T6:** verde no 54422 sem SQL novo (Phil e Yannis).
- **Código no ar:** com as variáveis desligadas, a página do Arquivo em produção igual à de antes (Gio).
- **`sem_destino`:** a linha diz o que falta (Gio).
- **Pronto do passo 19:** com o Mac fora da rede de casa, `npm run -s obs:arquivo | ssh forja 'bash -s'` termina em `FEITO` com o canal de teste; a página diz "limpeza concluída"; o ledger traz a data de cada estado e a saída em `saidas/`; o canal tinha linha na série diária do mês selado; `ls` do lote da E10 vazio no Mac e no NAS.

## Conferências com data

| Quando | O quê | Esperado |
|---|---|---|
| 01/11 | consulta de `competitor_video_daily` do canal de teste | `count >= 1` em outubro |
| Passo 3 e dia do passo 4 | consulta do passo 3 | `unidades_com_linhas = 0` |
| Dia do 1º `obs:arquivo` | saída do script | `FEITO`, sem `RESTA` |
| Dia seguinte | `obs_archive_absence` do canal | `nas_absent_first_at` preenchido em todas as linhas, inclusive `_recebendo` |
| Fim do passo 19 | `ls` do lote da E10 | vazio |

## NÃO VERIFICADO

1. Produção: remoções existentes, `blobs_pending`, cadastro do canal de teste.
2. (Respondido) `decide` grava `thumbs_unknown_ack_at`; `online_thumbs_known = true` na E10 (`:2720`): a T6 afirma.
3. Se a E10 já apagou as URLs de `blobs_pending` das linhas `guardar` (Phil I4); o filtro da T1 vale de qualquer modo. Se o lote da E10 leva miniaturas. Se a unidade vazia tem `sha256_bytes` (quantos `PULADO` na 1ª rodada). Permissão real do `thiago` em pasta criada pelo copiador (sem isso, `find` falha e sai `RESTA`). Se `_recebendo` entra no sync do B2.
4. `limpa_prefixo` tenta os dois filhos; pasta do prefixo do outro filho é ignorada (`[ -d ]`), conferir no teste.

## Estimativa de tokens

**650-800K (ESTIMATIVA, julgamento de Yannis, sem medida).** A soma por tarefa abaixo (~510K) é o piso do plano original; T4 (Logan, Naksu, opositores), T7 (Gio, Logan, Naksu, dono) e T8 (três revisores com rodada de conserto) estão baixas; a emenda soma T1 (filtro), T5 (JA-APAGADO) e T6 (reversão), e a T7b.

| Tarefa | Tokens (piso) | Agente |
|---|---|---|
| T0 portão | ~5K | controlador |
| T6 ponta a ponta (1ª) | ~70K | executor |
| T1 variável | ~30K | executor |
| T3 recarga | ~40K | executor |
| T5 script | ~50K | executor |
| T2 ações | ~45K | executor |
| T4 mockup delta | ~60K+ | skill, Logan, Naksu |
| T7 tela | ~120K+ | executor, Gio |
| T7b já rodei | a estimar | executor |
| T8 fecho e revisões | ~110K+ | executor, Phil, Yannis, Hanna |

Mantendo o `--canal` (Decisão 1 "não"): +~60K.

## Self-review

- Cobertura do brief: "Apagar do arquivo" T2/T7; "Já rodei" T2/T7; H3 T1; 165 canal T3; `it.todo` T8; tela T4/T7; dado ausente, ordem de deploy e tokens nas seções acima.
- **Numeração:** a numeração não é a ordem: código começa na T6; deploy põe a T5 em ramo próprio depois do passo 3.
