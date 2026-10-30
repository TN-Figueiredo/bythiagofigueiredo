# Manutenção M9b: limpeza de canal removido até `concluido` (passo 19 da M8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar um canal removido de `guardado` (ou `sem_destino`) até `concluido`, com prova de ausência no NAS, nos snapshots e no B2, pelo caminho que já existe (`obs:arquivo`), para fechar o passo 19 da M8 (item 164) antes da partida. Data-alvo do código: antes de 28/11.

**Architecture:** O banco e o kit já fazem o caminho inteiro; faltam quatro pontas: (1) a ação "Apagar do arquivo" chamando `obs_archive_channel_removal_decide`; (2) soltar o `canal:` em ESPERA no script e limpar as pastas vazias de `_recebendo`; (3) a variável dos blobs separada da variável da tela; (4) a recusa de `comandos-recarga` para canal apagado. **Sem migration, sem mudança no kit da forja, sem rota nova.** A Tarefa 6 prova isso no banco local antes de soltar o script.

**Tech Stack:** Next.js 16 (server actions), TypeScript 5 strict + Zod, Vitest (`bythiago_int`, 54421/54422), bash do script impresso.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/`: `03` §13.3 passo 19, `06` itens 161, 163, 164, 165; `04` §14.2, §14.7. Plano-mãe: `docs/superpowers/plans/2026-10-14-manutencao-nas-m9-expurgo-enxuto.md` (emenda 25/10, Tarefas 8 e 12, D-M9-10 a D-M9-13). Revisões: `.superpowers/sdd/manutencao-nas/saidas/m9-t14-rev-hanna.md` (H1, H3, H4, H5), `m9-t14-rerev-phil.md`. Mockups: `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/` (`arquivo.js`, `arq-dados.js` CAN, `peca7.js`).

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

O lote da E10 não segura o canal do passo 19: `competitor_channel_remove_archived` grava `deleted_at` no lote (`20261021000002:359`), e o gatilho só olha `deleted_at` e `closed_at` nulos.

**O que `--canal` faria e o `obs:arquivo` não faz:** apagar por `rm -r` arquivo que o registro não conhece, e limpar `_recebendo/`. Disso sai a ressalva:

**Defeito achado, bloqueia o `concluido`.** O copiador cria `_recebendo/<classe>/canais/<ref>/<tabela>/` ao gravar (`comum.py:369`) e nunca apaga a pasta (`copiar.py:154-167` só faz `unlink` do arquivo; nenhum `rmdir`, `removedirs` nem `rmtree` em `copiar.py` e `comum.py`). `prefixos_nas` usa `lstat` (`comum.py:284`): pasta vazia é `presente`. O prefixo `_recebendo/...` tem linha em `obs_archive_absence`, mas sai da lista `prefixos` da pendência (`not like '\_recebendo/%'`), então ninguém o limpa. Resultado: todo canal que teve unidade copiada fica em `apagar_antigas` para sempre, com o script dizendo `FEITO (0 gravado(s), 0 apagado(s), N já feito(s))`. É falha em verde. A Tarefa 5 conserta sem SQL e sem kit: o script deriva os dois prefixos de `_recebendo` e limpa só pastas vazias.

**Decisão do plano:** `--canal` sai do caminho do passo 19. Fica recusado no CLI com frase honesta. Arquivo desconhecido vira `RESTA`, com o procedimento manual no runbook. Se um `RESTA` real aparecer, abre-se o `--canal` como tarefa própria. Isso exige emenda do dono no passo 19 e no item 161 (Decisão 1).

## Decisões abertas para o dono (Tarefa 0)

| # | Pergunta | Minha recomendação | Custo de cada lado |
|---|---|---|---|
| 1 | Emendar passo 19 e item 161: limpeza pelo `obs:arquivo`, sem `expurgar --canal` nem `rm -r`? | Sim. Hanna recomendou essa fatia em §3, a confirmar com Phil e Yannis na Tarefa 8 | Sim: ~40K a menos e nada de comando novo que apaga por `rm -r`; arquivo desconhecido exige passo manual. Não: Tarefa extra de ~60K (`--canal`, arquivo de comandos, rota C14 `passo: 'canal'`, testes do item 161) |
| 2 | Ligar `OBS_ARQUIVO_LIMPEZA_BLOBS` antes de um ciclo inteiro limpo? O runbook hoje exige o ciclo, mas o canal de teste só conclui com os blobs apagados: a regra não fecha | Sim, ligar no dia em que o canal de teste for apagado, depois de a leitura do passo 3 da ordem de deploy listar quem tem `blobs_pending` | Sim: apaga miniaturas de todas as remoções listadas, irreversível, mas de canais que já saíram. Não: passo 19 para em `apagado_b2`, item 164 fica aberto |
| 3 | Mockup delta da Tarefa 4 antes do código da tela | Sim, é a regra | Sem ele a Tarefa 7 não começa; a M8 só precisa dela no dia do canal de teste |

## Global Constraints

- Sem migration e sem kit. Se a Tarefa 6 mostrar que é preciso um dos dois, **pare e volte ao controlador**: muda a ordem de deploy e envolve o dono.
- Nada contra produção, forja ou NAS durante a implementação. Leitura de produção só nos passos marcados da ordem de deploy.
- Toda ação nova: confere admin no servidor (`canUnlock`), valida com Zod, nunca importada direto no client (callback por prop). Cores literais, sem `color-mix`.
- Sanitização, datas e fixture: fake timers; teste que apaga a variável (`delete process.env.X`) para todo default.
- Commit por caminho explícito; `npm run build:packages` não se aplica (nada em `packages/`).

## Tasks

### Task 0: portão do dono (sem código) // ~5K

- [ ] Levar as Decisões 1, 2 e 3 ao dono, com "pode" descritivo. Anotar em `m9-progresso.md`.
- [ ] Conferir que o canal de teste novo está cadastrado. A consulta de `competitor_video_daily` está em `saidas/m9-t14-rerev-phil.md` (`count >= 1` em outubro). Zero: o passo 19 vai para a selagem de 28/12, e esta M9b deixa de ter pressa de novembro.

### Task 1: separar a variável dos blobs (Hanna H3) // ~30K

**Files:** Modify `apps/web/src/lib/youtube/observatorio/arquivo/remover.ts:273`, `apps/web/test/youtube/observatorio/arquivo-remover.test.ts`, `docs/ops/env-vars.md`.

Regra nova: `OBS_ARQUIVO_LIMPEZA_CANAL` = a tela e a ação (promessa do comando). `OBS_ARQUIVO_LIMPEZA_BLOBS` = a nova tentativa diária de `retentarBlobsDeRemocoes`. `capacidades.ts` não muda.

- [ ] **Passo 1. Testes, falhando:** em `arquivo-remover.test.ts`, `describe` da T13 troca para a variável nova. Novos: variável nova ausente com `OBS_ARQUIVO_LIMPEZA_CANAL=on` → `{ porque: 'flag_desligada' }` e `apagarDoBlob` não chamado; variável nova `on` com a antiga ausente → apaga; valores `ON`, `1`, `''` → desligada (`delete process.env` no caso ausente).
- [ ] **Passo 2.** Rodar → FAIL.
- [ ] **Passo 3.** `remover.ts:273`: `if ((deps.env ?? process.env).OBS_ARQUIVO_LIMPEZA_BLOBS !== 'on') return { porque: 'flag_desligada' }`; ajustar o comentário da l.266.
- [ ] **Passo 4.** `env-vars.md`: a linha da T13 (l.30) vira `OBS_ARQUIVO_LIMPEZA_BLOBS`, e a l.29 diz que a antiga liga a tela e a ação.
- [ ] **Passo 5.** Rodar → PASS. Commit: `fix: M9b: variável própria para os blobs das remoções (Hanna H3)`.

### Task 2: as ações `apagarDoArquivo`, `marcarRodado`, `desfazerRodado` // ~45K

**Files:** Create `apps/web/src/app/cms/(authed)/youtube/competitors/_arquivo/actions-canal.ts`, `apps/web/test/youtube/observatorio/arquivo-actions-canal.test.ts` (`// @vitest-environment node`). Antes, `grep -n "guardaDaRemocao\|permissoesDoSite" "apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts"` e `_chrome/permissoes.ts`: usar a guarda que devolve `{ siteId, userId }` com `canUnlock`.

```ts
type Resposta = { ok: true; status: 'ok' | 'ja_pedido' } | { ok: false; erro: 'sem_permissao' | 'forma' | 'desligado' | 'nome_nao_confere' | 'canal_nao_encontrado' | 'interno' }
export async function apagarDoArquivoAction(channelRef: string, digitado: string): Promise<Resposta>
export async function marcarRodado(itemId: string): Promise<{ ok: true } | { ok: false; erro: string }>
export async function desfazerRodado(itemId: string): Promise<{ ok: true } | { ok: false; erro: string }>
```

`apagarDoArquivoAction`, nesta ordem: guarda de admin → `lerCapacidades().comandoDeLimpeza` falso devolve `desligado` → `UUID_RE` em `channelRef` → `nomeConfere(digitado, esperado)` (`_canais/remover-model.ts:164`; reusar, é a regra do mockup 11.2), com `esperado` relido no servidor por `lerCanaisRemovidos` (`nome ?? código`), nunca vindo do client → `rpc('obs_archive_channel_removal_decide', { p_site, p_channel_ref, p_actor })` → `revalidatePath('/cms/youtube/competitors', 'layout')`.

`marcar`: `ItemId = /^(item:[1-9][0-9]{0,18}|canal:[0-9a-f-]{36})$/`; `antiga:` recusada; `rpc('obs_archive_marcar_rodado', { p_site, p_item_id, p_actor, p_desfazer })` (já com `grant` a `service_role`, `20261029000002:1074`).

- [ ] **Passo 1. Testes, falhando:** sem admin: `sem_permissao` e `rpc` não chamado (nas três); variável ausente (`delete`): `desligado`; uuid com `'`: `forma`; nome errado: `nome_nao_confere`; nome com caixa e acento diferentes: passa; `ja_pedido` do banco vira `{ ok: true, status: 'ja_pedido' }`; erro `canal_nao_encontrado` traduzido; erro desconhecido: `interno`, com Sentry, sem repassar a mensagem; `marcarRodado('antiga:<uuid>')`: `forma`; `desfazerRodado`: `p_desfazer: true`.
- [ ] **Passo 2.** Rodar → FAIL. **Passo 3.** Código. **Passo 4.** Rodar → PASS, typecheck web.
- [ ] **Passo 5.** Commit: `feat: M9b: ações apagar do arquivo e já rodei`.

### Task 3: `comandos-recarga` recusa canal apagado (165, parte canal) // ~30K

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
- [ ] **Passo 2.** Rodar → FAIL.
- [ ] **Passo 3.** `COM_BANCO` inclui `comandos-recarga`; opção `--site`; a despacho sai da l.188 para o `switch` depois de `resolverSite`.
- [ ] **Passo 4.** Rodar → PASS. Trocar o `it.todo` do 165 canal por `it` no `cobertura`. Commit: `fix: M9b: recarga recusa canal apagado (item 165)`.

### Task 4: mockup delta (portão antes da Tarefa 7) // ~60K

**Pedido explícito de mockup.** O aprovado cobre o diálogo (`c-apagar`, `c-apagar-sd`), a linha `guardado` (c10), `sem_destino` (c11) e o painel da peça 7. **Não** cobre:

1. **"Ver os comandos" do canal:** `CMDHTML` e c1, c2, c3, c5, c6, c12 falam de `expurgar --canal` e "o arquivo que ele gravar". Viram a linha fixa da peça 7, com Copiar. Pendente da Decisão 1.
2. **Ordem da régua:** c5 e c7 pressupõem B2 antes dos snapshots. Desde a M9-snap (`obs_archive_etapa`) é NAS → snapshots (14 d 8 h) → B2. `ETAPAS` em `canais-removidos.ts` e c5 ("rode o comando de novo") estão errados na espera: falta frase "espere até dd/mm".
3. **Estados com `falta`:** `lote_e10`, `blobs`, `imagens`, e `RESTA` (arquivo desconhecido).
4. **Erro do clique** em "Apagar do arquivo" e `ja_pedido`.
5. **"Já rodei" no canal:** recomendação: só no painel da peça 7, como aprovado, e não na linha do bloco (a Tarefa 12 antiga previa os dois).

- [ ] Logan e Naksu discutem antes de desenhar; skill `frontend-design` desenha na pasta `19-mes-fora-do-banco`; os dois revisam; `open -a Opera` para o dono; anotar em `ROTEIRO-DE-TESTE-E-MELHORIAS.md`. Portão: aprovação do dono.

### Task 5: limpar `_recebendo` e soltar o `canal:` // ~40K

**Vai por último no deploy** (commit separado, ver ordem). **Files:** Modify `apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts`, `apps/web/test/youtube/observatorio/arquivo-pendencias-bash.test.ts`, `arquivo-expurgar.test.ts:333`, `cli.ts:102` (frase).

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

`limpa_prefixo` já roda sob a `TRAVA`, confere sentinela e só apaga pasta vazia (`find -xdev -depth -type d -empty -delete`). Frase do `RESTA`: `RESTA <prefixo>: há arquivo que o site não conhece; nada foi apagado, veja "Sobrou arquivo no canal" no runbook`. **Falha em verde:** `RESTA` hoje só soma `esperando` e a última linha diz `FEITO`. Passa a somar `falhas` também, e a saída fica `NÃO TERMINOU`.

Caso `so_prefixo` (`sem_comando`): também imprimir os `limpa_prefixo` quando `i.falta === 'so_prefixo'` e há `prefixos`; sem isso a pasta vazia prende canal sem arquivo conhecido. `temApagar` tem de ligar a `TRAVA`: usar `temLimpeza = temApagar || canal` na condição da `TRAVA`.

- [ ] **Passo 1. Testes, falhando** (bash real em raiz falsa temporária, como o `describe` da l.245, que é reescrito):
  - canal com 2 arquivos e `_recebendo/<p>/tab/` vazio: tudo some, `FEITO`.
  - `_recebendo/_quarentena/<p>/x.csv` com arquivo: arquivo fica, `RESTA`, sai 1, `NÃO TERMINOU`.
  - arquivo desconhecido em `<p>/`: fica, `RESTA`.
  - sha256 diverge: `PULADO`, nada apagado.
  - outro canal `<p2>` intacto.
  - sem sentinela: nada apagado.
  - rodar duas vezes: 2ª dá `JA-APAGADO`.
  - `so_prefixo` com pasta vazia: pasta some.
  - item de vídeo ao lado continua apagando.
- [ ] **Passo 2.** Rodar → FAIL. **Passo 3.** Código. **Passo 4.** Rodar → PASS.
- [ ] **Passo 5.** `cli.ts:102`: frase `expurgar --canal não existe: a limpeza de canal é pelo obs:arquivo`; teste ajustado. Commit: `feat: M9b: obs:arquivo limpa canal removido, inclusive pastas de _recebendo`.

### Task 6: a prova de ponta a ponta no banco local // ~70K

**Files:** Create `apps/web/test/integration/manutencao-m9b-canal.test.ts` (`describe.skipIf(skipIfNoLocalDb())`, helpers `m3b`, `aplicarM9`, `begin … rollback`).

- [ ] Roteiro em um `it`: canal com unidade, resumo e `received_at` → `competitor_channel_remove` com `guardar` (via `e10_export`) → lista dá `guardado` → `decide` → lista dá `pedido`, pendência `apagar_antigas` com os arquivos e 3 linhas por (filho, classe) → `attest_prefixos` ausente em todas (inclusive `_recebendo`) → `segunda_conferencia` → 2º attest com 11 h → `snapshots` → attest de snapshot → `conferir_b2` → attest B2 → `apagado_b2` → `blobs_pending` vazio → `concluido`, `completed_at` e `obs_archive_absence` encerrada.
- [ ] Negativos: uma linha `_recebendo` `presente` segura em `apagar_antigas` (o defeito, documentado); `blobs_pending` com URL segura com `falta 'blobs'`; `sem_destino` → `decide` cria a linha com `online_thumbs_known = false` e `falta 'imagens'` até `thumbs_unknown_ack_at`; **quem grava esse aceite?** Se nada no site grava, `sem_destino` não conclui: anotar, sem bloquear o passo 19 (canal de teste é `guardado`).
- [ ] Unidade com `purged_at` fora de `aguardando_dono` no `obs_archive_plan`.
- [ ] Rodar a suíte `manutencao-m9*` inteira. Se qualquer passo exigir SQL: **parar** (Global Constraints).
- [ ] Commit: `test: M9b: canal de guardado a concluido, de ponta a ponta`.

### Task 7: a tela (depende da Tarefa 4) // ~120K

**Files:** Modify `_arquivo/bloco-canais-removidos.tsx`, `_arquivo/arquivo-screen.tsx`, `_canais/esperam-comandos.tsx` (l.4 diz "sem Já rodei (M9)"), `apps/web/src/lib/youtube/observatorio/arquivo-mensal/canais-removidos.ts` (frases, `ETAPAS`, campo novo `acao`). Create `_arquivo/apagar-do-arquivo.tsx` (`'use client'`). Tests: `apps/web/test/cms/observatorio/canais-removidos.test.tsx` (`// @vitest-environment jsdom`), `arquivo-mensal-estado.test.ts`.

- [ ] `montarLinha` devolve `acao: 'apagar' | 'comandos' | null` e `dialogo: { titulo, meses, faixa, confirma } | null`. `guardado` e `sem_destino`: `apagar`, só com `cap.comandoDeLimpeza`, só para `administra`. `pedido` e `apagado_nas`: `comandos`.
- [ ] `BlocoCanaisRemovidosView` recebe `onApagar` por prop (a página passa a action). Para quem não administra: frase "espera quem administra", sem botão.
- [ ] Diálogo: `c-apagar` (digita nome) e `c-apagar-sd` (digita código, aviso do Blob). Botão desabilitado até `nomeConfere`.
- [ ] Peça 7: "Já rodei" e "Desfazer" pelo molde de `peca7.js:61,139-140`, com `marcarRodado`/`desfazerRodado` por prop; `refutado` em âmbar quando `marcadoRodadoEm` e o item segue pendente.
- [ ] Testes: um por estado do CAN aprovado com texto exato; `meses` nulo: diálogo sem número e sem confirmar, nunca "0 meses"; idade 29, 31, 61 dias com fake timers; erro da ação preserva o estado; `podeApagar=false` sem botão; flag ausente (`delete`): sem botão, frase "espera o comando".
- [ ] Gio valida com o CMS local autenticado, Logan e Naksu revisam o implementado, dono confere no Opera.
- [ ] Commit: `feat: M9b: apagar do arquivo, ver os comandos e já rodei na tela`.

### Task 8: cobertura, runbook, emendas, revisão // ~110K (30K + revisões)

- [ ] `manutencao-m9-cobertura.test.ts`: `it.todo` 161 relido com a Decisão 1 (provas de fim viram `it` da Tarefa 6; comando sai); 163 vira `it`; 165 canal, feito; 65 "Já rodei", 65 31/61 e 111 (a Tarefa 7 fecha, para canal e para item). **Ficam:** 120 e 165 `purged_at`, do núcleo. Tabela do topo atualizada.
- [ ] `docs/ops/runbook-arquivo-mensal.md`: "Canal removido fica SEGURO" vira o ciclo do canal; seção "Sobrou arquivo no canal" (leitura `find`, decisão do dono, `rm` à mão); frase do `--file-id`; a condição "só liga depois de um ciclo inteiro limpo" conforme a Decisão 2; tabela de `falta` ganha `blobs`, `imagens`, `lote_e10`, `so_prefixo`.
- [ ] Spec (com a Decisão 1): `03` passo 19, `06` itens 161, 164, 165 (`ensaiar-restauracao` chama `obs_archive_channel_is_removed`, a cargo da M8). Plano-mãe: D-M9-10 e D-M9-13 com nota. Plano da M8: linha do 165.
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
| Arquivo em `_recebendo/_quarentena` ou desconhecido | `RESTA`, sai 1, `NÃO TERMINOU`, nada apagado, canal não avança | T5 |
| Filho sem sentinela | `limpa_prefixo` pula; copiador não atesta (`filho_fora`); estado não anda | T5 |
| Item sem `prefixos` | nenhum `limpa_prefixo`; `apaga_conferido` segue; o copiador acusa `presente` e o item não avança | T5, T6 |
| Canal de teste sem linha em outubro | passo 19 vai para 28/12; a consulta da Tarefa 0 diz antes | T0 |
| `conferir_b2` com `b2_nomes` vazio | só a frase do painel: **NÃO VERIFICADO**; conferir na T6 | T6 |
| Remoção `apagar` antiga já em produção | apaga no 1º `obs:arquivo` depois do deploy; por isso a leitura do passo 3 | Ordem de deploy |
| `thumbs_unknown_ack_at` sem quem grave | `sem_destino` não conclui; registrar | T6 |

## Ordem de deploy

Sem migration e sem kit, portanto sem passo do dono na forja. Tudo com variáveis ausentes até o fim.

1. **T1, T2, T3, T6, T7 em `staging`, CI verde, promoção a `main`.** Efeito em produção: nenhum (botão escondido). `blobs` segue desligado.
2. **`git pull` no checkout do Mac:** `comandos-recarga` agora pede `OBS_ARQUIVO_DB_URL`.
3. **Leitura de produção:** `select channel_ref, archive_decision, decided_at, cardinality(blobs_pending) from public.obs_archive_channel_removals where completed_at is null;`. Toda linha `apagar` será apagada no primeiro `obs:arquivo` depois do passo 4: mostrar ao dono antes.
4. **T5 em `staging` → `main`, `git pull` no Mac.** Antes do pull, o Mac segura o canal: seguro.
5. **`OBS_ARQUIVO_LIMPEZA_CANAL=on` no Vercel**, redeploy. Invertido com o passo 4, a tela promete um comando que ainda só espera.
6. **`OBS_ARQUIVO_LIMPEZA_BLOBS=on`**, no dia do canal de teste, conforme a Decisão 2.

**Volta atrás:** apagar as variáveis esconde a ação na hora; reverter o commit da T5 segura o canal de novo. A decisão `apagar` já gravada e os arquivos apagados **não voltam**.

**Calendário do passo 19:** selagem em 28/11; copiador e B2 atestam; E10 com o canal de teste (`guardado`); "Apagar do arquivo"; `obs:arquivo`; 11 h; 14 d 8 h de snapshots; B2. Fim esperado por volta de 15/12 (ESTIMATIVA), antes da partida de janeiro.

## NÃO VERIFICADO

1. Produção: remoções existentes, `blobs_pending`, cadastro do canal de teste.
2. Quem grava `thumbs_unknown_ack_at`.
3. Se `competitor_channel_remove_archived` chega à linha `guardar` com `online_thumbs_known = true` (a Tarefa 6 prova).
4. `limpa_prefixo` tenta os dois filhos; pasta do prefixo do outro filho é ignorada (`[ -d ]`), conferir no teste.

## Estimativa de tokens

| Tarefa | Tokens | Agente |
|---|---|---|
| T0 portão | ~5K | controlador |
| T1 variável | ~30K | executor |
| T2 ações | ~45K | executor |
| T3 recarga | ~30K | executor |
| T4 mockup delta | ~60K | skill, Logan, Naksu |
| T5 script | ~40K | executor |
| T6 ponta a ponta | ~70K | executor |
| T7 tela | ~120K | executor, Gio |
| T8 fecho e revisões | ~110K | executor, Phil, Yannis, Hanna |
| **Total** | **~510K** | |

Mantendo o `--canal` (Decisão 1 "não"): ~570K.

## Self-review

- Cobertura do brief: "Apagar do arquivo" T2/T7; "Já rodei" T2/T7; H3 T1; 165 canal T3; `it.todo` T8; tela T4/T7; dado ausente, ordem de deploy e tokens nas seções acima.
- **Numeração:** as tarefas seguem a ordem de código; a de deploy é outra, de propósito (T5 entra depois de T7).
