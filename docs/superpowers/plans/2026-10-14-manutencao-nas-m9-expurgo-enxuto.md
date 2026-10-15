# Manutenção M9: expurgo enxuto (fatia 12b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o "apagar" da fila "Saíram do YouTube" (vídeo e comentário) e o "apagar do arquivo" de um canal removido alcançarem o NAS e o B2, com prova de ausência, pelo comando único do dono (`obs:arquivo`), pela peça 7 e pelo bloco "Canais removidos", sem que nenhum programa da forja apague sozinho.

**Architecture:** O banco guarda, antes da cascata da E9, a lista do item (classe, tabela, mês, chave) e dirige tudo por estados: o Mac (`npm run -s obs:arquivo`) lê as pendências na `versao: 2`, reescreve no Mac as unidades e os resumos sem o item (versão nova, serialização TypeScript da M3b; o manifesto novo sai do fluxo de selagem da M3b), registra-os pela rota nova com a chave `archive_owner` e imprime o script que põe os arquivos em `_recebendo/` e, num segundo tempo, apaga as versões antigas conferindo sha256. A ausência (arquivo do item e prefixo do canal) é provada pelo copiador (NAS, duas vezes com 11 h) e pelo `conferir-b2` (todas as versões, com o canário da mesma execução), e só a prova avança o estado; o vigia e a tela leem o mesmo estado.

**Tech Stack:** PostgreSQL 17 (Supabase; `plpgsql`, `security definer`), Next.js 16 (App Router, route handlers do pipeline, server actions), TypeScript 5 strict + Zod, Vitest (`bythiago_int`, 54421/54422), `tsx` no Mac, Python 3 do kit da forja (`~/Workspace/forja/ferramentas/arquivo/`, git local), bash do script impresso.

**Spec:** `docs/superpowers/specs/2026-10-13-fase-manutencao-nas/` — `02` §10.4, §10.5 ("Alvo derivado", "Lista derivada", "Remoção sem arquivo"), §11.3 (expurgo, tabela de estados da remoção); `04` §14.2 (bloco "Canais removidos"), §14.3, §14.7 (peça 7); `05` l.29, l.39, §16.10; `06` itens 65, 66, 67, 109, 110, 111, 120, 161, 163 (parte M9), 165 (parte dos comandos), P47, R38. Vale mais que o spec onde divergem (brief da onda 2): `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` (r2.5), `emenda-credencial-rota.md`, `decisoes-dono-14-10.md` (seção final), `docs/superpowers/plans/2026-10-14-manutencao-nas-m3b-site.md` (E-D1 a E-D5, Tarefa E1, Tarefa 13), `docs/superpowers/plans/2026-10-14-manutencao-nas-m3b-forja.md` (Tarefa 7a, D-F22 a D-F25), `supabase/rascunhos/m3b.sql`, `apps/web/test/helpers/m3b.ts`. Mockups (fonte da tela, não redesenhar): `docs/superpowers/mockups/2026-10-14-manutencao-nas/19-mes-fora-do-banco/peca7.js`, `arquivo.js` (bloco canais, `CMDHTML` l.170), `NOTAS.md` (peça 7, l.84-123).

## Global Constraints

- **Migration só no dia, e por `npm run db:new manutencao_m9_expurgo`** (Tarefa 10). Até lá o SQL vive em `supabase/rascunhos/m9.sql` (rastreado); os testes o leem por `M9_SQL_CAMINHO` (um só lugar: `apps/web/test/helpers/m9.ts`). O nome leva `_manutencao_` (o teste da M2 reconhece a fase por isso).
- Idempotência: `create table if not exists`, `alter table ... add column if not exists`, `create index if not exists`, `create or replace function`, `drop policy if exists` antes de `create policy`, `drop trigger if exists` antes de `create trigger`.
- Tabelas novas em `public`, RLS ligada, policy de leitura `public.can_edit_site(site_id)`, nenhuma policy de escrita, `revoke all ... from public, anon, authenticated` **e** `revoke insert, update, delete, truncate, references, trigger ... from service_role`; nenhuma chave estrangeira para canal, vídeo ou site (`02` §10.1). Funções novas: `security definer`, `set search_path = ''`, nomes por `format('%I')`, `revoke all on function ... from public, anon, authenticated`; função interna também `from service_role`; `grant execute ... to service_role` só onde a aplicação chama. Prod já tem a 20261014000007 (A5): função nova nasce sem `EXECUTE` para `anon`/`PUBLIC`, e o grant a `service_role` é explícito. **Permissão se testa com `has_function_privilege`, nunca chamando como `anon`/`authenticated`** (SIGSEGV no Postgres local).
- Todo `db:push:prod` é do dono, precedido de `npx supabase migration list --linked`, e só segue se as pendentes forem exatamente as do dia. Janela: fora de 11:30 a 13:00 UTC e fora dos minutos 0, 20 e 40.
- Testes com banco: `describe.skipIf(skipIfNoLocalDb())`, banco `bythiago_int` (API 54421, Postgres 54422), nunca 54321; arquivos em série (`--no-file-parallelism`); rascunho aplicado dentro de `begin … rollback`.
- TypeScript strict, sem `any`; Zod na borda (`.safeParse`, nunca `as` em dado de RPC); kebab-case; commits `tipo: descrição`, um por tarefa, por caminho no `staging` (`git add -- <novos>` e `git commit -- <caminhos>`); nunca `git add -A`, stash ou reset. Mensagem termina com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. **O executor não commita sem o controlador mandar** (brief da onda 2).
- Mexeu em `packages/*/src/`: `npm run build:packages` na hora (este plano não prevê mexer).
- **Arquivo que outra trilha está mexendo sem commit:** antes de editar qualquer arquivo de Modify, `git diff --stat -- <arquivo>`; com mudança alheia, não editar: registrar no ledger `.superpowers/sdd/manutencao-nas/m9-progresso.md` e o controlador decide (mesma regra da M3b-site).
- `.superpowers/` é ignorado pelo git: ledger, LEIAME, arquivos de comandos e saídas ficam só no disco.
- **NAS e forja: escrita é do dono, sem exceção.** Nenhum agente roda `ssh forja '<escreve>'`, `scp`, `crontab -`, `install`, `mv` ou `systemctl`. O agente prepara ARQUIVO de comandos (curtos, um por linha) em `.superpowers/sdd/manutencao-nas/comandos/` e uma linha curta que o roda, com saída em `.superpowers/sdd/manutencao-nas/saidas/`; nada para colar salvo as exceções do `05` §16 (segredo, linha do cron por `crontab -e`, SQL do painel do Supabase). Leitura `ssh forja '<leitura>'` é permitida. **O script que `obs:arquivo` imprime é rodado pelo dono** (E-D1: `LINHA_DO_DONO`); o comando do Mac também faz leitura do NAS por `ssh forja 'cat -- …'`, que é leitura.
- **O sistema falha em VERDE.** Toda tarefa diz o que acontece quando o dado não existe (lista do item vazia, mês sem unidade, arquivo antigo ausente no NAS, retenção não registrada, função ausente, variável apagada) antes do erro. Nenhuma ausência vira "concluído" sem prova positiva da mesma execução (sentinela no NAS, canário no B2).
- Variáveis: `OBS_ARQUIVO` (só `on` liga, M3b), `OBS_ARQUIVO_LIMPEZA_CANAL` (só `on` é "sim"), `OBS_ARQUIVO_LIMPEZA_CANAL_DATA` (só texto). Teste que apaga cada uma e afirma o padrão (já existe para as três na M3b, Tarefa 9; a M9 acrescenta o da tarefa do Blob, Tarefa 13).
- **Erro de rota nunca é engolido:** `500 erro_do_banco` manda a causa ao Sentry (`captureException`/`captureMessage`), como na M3b.
- Rota nova em `apps/web/src/app/api/pipeline/` exige `apps/web/src/lib/pipeline/api-registry.ts` (entrada **e** `endpoint_count` do domínio) e `apps/web/data/pipeline-docs/cowork-docs-{domain}.md`. Nunca criar nem revogar chave de pipeline.
- Sem datas-meta. Os únicos relógios são os do dado: 11 h entre as duas conferências do NAS, 24 h de validade da conferência do NAS para liberar o B2, `snapshots_clear_on`, 30 dias de versão superada de texto, âmbar 30 e vermelho 60 dias.

## Travas e ordem de execução

- **TRAVA M9-0 (dependências de produção, conferidas na Tarefa 0):** (a) **E9 em produção** — hoje (14/10) os commits da E9 estão só na worktree `wt-e9` (HEAD `37617d174`), fora de `staging` e de `main` (`git merge-base --is-ancestor` deu "não" para os três), e a migration `observatorio_a5_e9_apagar_o_que_saiu` não existe em `supabase/migrations/`; (b) **M3b em produção** ("TRAVA M3b-2 solta" no ledger `m3b-site-progresso.md`) e a Tarefa 7a do plano da forja (script do pipe, `apaga_conferido`) commitada; (c) **M5 em produção** (o bloco "Canais removidos" e a peça 7 na página do Arquivo, que esta etapa completa); (d) **M6** para o gatilho do mês destacado (`mes_destacado_em_transito`). Sem (a) a Tarefa 2 não começa (o corpo das funções da E9 é a âncora dela). Sem (b) nada da Tarefa 1 em diante vai ao banco local com a M3b aplicada. Sem (c) a Tarefa 12 não começa. Sem (d) a Tarefa 2 trata o mês destacado como hoje (recusa da E9 não existe) e o teste correspondente fica `skip` com o motivo escrito.
- **TRAVA M9-1:** nenhum arquivo `*_manutencao_m9_*` em `supabase/migrations/` antes da Tarefa 10, Passo 1. O teste `m9-trava.test.ts` (Tarefa 1) a segura.
- **TRAVA M9-2:** nenhuma linha das Tarefas 11, 12 e 13 (rota nova, tela, tarefa do Blob) e nenhuma mudança de `VERSAO_PENDENCIAS` para `2` antes de a migration estar aplicada em produção e conferida (linha "TRAVA M9-2 solta em <data hora>" no ledger). Parte mecânica (Tarefa 1): enquanto não houver `*_manutencao_m9_*` em `supabase/migrations/`, o teste exige que `apps/web/src/app/api/pipeline/archive/expurgo` não exista e que `pendencias.ts` tenha `VERSAO_PENDENCIAS = 1`. Motivo (P47): o leitor estrito (E-D5) na `versao 2` com a função ainda na `versao 1` faz o `obs:arquivo` sair com código 1 e a peça 7 mostrar "não medido".
- **Ordem do deploy (P47):** migration → rotas e leitor `versao 2` (Tarefa 11) → kit da forja instalado pelo dono (Tarefa 9) → tela (Tarefa 12) → `OBS_ARQUIVO_LIMPEZA_CANAL=on` na Vercel (Tarefa 14). Entre o código no ar e a variável, a tarefa do Blob não tenta nada e a linha da tela diz "a limpeza das imagens espera o comando de limpeza ser ligado" (Tarefa 13).

## O que já existe (lido em 14/10; arquivo e linha)

| Fato | Fonte |
|---|---|
| `competitor_removed_items` em produção: `id bigint`, `site_id`, `kind in ('video','canal','comentario')`, `youtube_id`, `competitor_channel_id uuid` sem FK, `decided_at`, `rows_deleted jsonb`, `blobs_pending text[]`, `archive_pending boolean default false`, `purge_count`, `returned_*`; `unique (site_id, kind, youtube_id)` | `supabase/migrations/20261012000002_observatorio_a5_e1_campos_sinalizadores_raw.sql:128-149` |
| A M3b acrescenta `competitor_removed_items.archive_note text` (D15) e `obs_archive_mark_purged` conclui os itens de vídeo/comentário de um canal apagado inteiro com `archive_note = 'canal apagado inteiro'` | `supabase/rascunhos/m3b.sql:2384-2398` |
| E9 (fora do `staging`): `competitor_video_purge` com âncora `delete from public.competitor_videos v where v.id = p_video;`; `competitor_comments_purge` com âncora `delete from public.competitor_video_comments k where k.id = any(v_alvo);` (o `insert into competitor_removed_items` vem **antes** do `delete` nos comentários e **depois** no vídeo); `archive_pending` sempre `false` na E9 | `docs/superpowers/plans/2026-10-13-a5-e9-fila-sairam-do-youtube-plan.md:1100-1351`, l.9 |
| `obs_archive_units`: `redo_reason`, `purged_at/purged_by/purge_ref`, `superseded_at`, `dropped_at`, `received_at`, `hash_conteudo`, `sha256_bytes`, `version`, `parts`; `obs_archive_purges(from_version, to_version, rows_removed)`; `obs_archive_months.detached_at/dropped_at/sealed_version` | `supabase/rascunhos/m3b.sql:59-135, 165-169` |
| `obs_archive_record_core(p_site, p_kind, p_payload, p_origem)`: a origem `'expurgo'` é a única exceção a `canal_removido` (decisão `guardar`), a `mes_aberto`, `mes_fora_do_banco`, `nao_devida` e `unidade_retirada`; `sem_destino` só para o expurgo | `supabase/rascunhos/m3b.sql:603-724` |
| `obs_archive_plan` devolve `prefixos_ausentes: []` e `aguardando_dono` (procurar em `_recebendo` e informar em `unit/received`); `obs_archive_b2_plan` devolve `'prefixos_ausentes','[]'` | `m3b.sql:2248-2383` (l.2377), `m3b.sql:1650-1766` (l.1761); contrato C1 l.24-26 |
| C10 reserva à M9 `prefixos_ausentes` e `prefixo_ausente`/`prefixo_presente` no `attest` (na M3b: `400 VALIDATION_ERROR`) | `contrato-rotas-m3b.md:292-294` |
| `obs_archive_owner_pending` (C12) só emite `sem_comando`, `versao 1`; o comentário manda a M9 recriá-la com os outros tempos e `versao 2` | `m3b.sql:2709-2746` |
| Leitor estrito `pendencias.ts`: `LINHA_DO_DONO`, `VERSAO_PENDENCIAS = 1`, `TEMPOS_PENDENCIA` (5 tempos), `Apagar = {filho, caminho, sha256, nova}`, `b2_nomes` só em `apagar_antigas` | `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts:11-104` |
| C13: a linha "Segredo" manda a M9 rever, no commit que leva o leitor ao `versao 2`, o fato de `apagar`/`b2_nomes` saírem preenchidos | `contrato-rotas-m3b.md:317-333` |
| D-F25: `copiar` recusado (código 1) até a M9; a M9 reaproveita `apaga_conferido` no mesmo commit do `versao 2`. D-F23: `stdout` só o script, `escreverTudo` | `docs/superpowers/plans/2026-10-14-manutencao-nas-m3b-forja.md:5186-5188` |
| `obs_archive_removed_channel_list`: estados só `sem_destino`, `sem_arquivo`, `guardado`, `pedido`; já devolve `nas_absent_at`, `b2_absent_at`, `snapshots_clear_on`, `reappeared_*`, `online_thumbs_known`, `thumbs_unknown_ack_at`, `blobs_pendentes` | `m3b.sql:2547-2586` |
| `estado-remocao.ts`: `EstadoRemocao` já tem `apagado_nas`, `apagado_b2`, `concluido`; `IDADE` (pedido 30/60, nas 30/60, B2 15 depois dos snapshots, 30 sem snapshots, blob 14/30) | `apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-remocao.ts:5-35` |
| `capacidades.ts`: `BLOCO_CANAIS_REMOVIDOS = false` (a M5 liga), `comandoDeLimpeza` = `OBS_ARQUIVO_LIMPEZA_CANAL === 'on'` e bloco | `arquivo-mensal/capacidades.ts:7-11` |
| Serialização TS: `serializarLinhas(colunas, linhas)` (`arquivo/exportar.ts:54`), `serializarResumo` (`arquivo-mensal/resumo.ts:36`), `montarManifesto` (`arquivo-mensal/manifesto-mensal.ts:32`), `lerCsv`/`linhaCsv` (`arquivo/csv.ts`), caminhos `caminhoDaUnidade/Parte/Resumo/Manifesto` (`arquivo-mensal/caminho.ts:21-36`, nome `<mes>.v<N>.csv.gz`) | arquivos citados |
| Resumo: colunas do canal e do vídeo e a conta (por vídeo: `n`, dias distintos, primeira e última de views/likes/comments; canal: vídeos, linhas, dias distintos, `min/max ts`, soma de `ultima − primeira`) | `m3b.sql:1073-1137` |
| `obs_archive_batches` (E10): `channel_ref`, `deleted_at`, `closed_at` (emenda 1) | `supabase/migrations/20261014000002_observatorio_a5_e10_export_pausa_e_limite.sql:30-60` |
| Kit: `b2.py` `versoes(nome)` lista todas as versões (inclusive `hide`) por `b2_list_file_versions`; `conferir.py` `controle(plano)` faz controle negativo e canários; `copiar.py` grava em `_recebendo` e trata `aguardando` | `~/Workspace/forja/ferramentas/arquivo/b2.py:127-150`, `conferir-b2/conferir.py:238-262`, `copiador/copiar.py:9, 89-95` |
| E9 `saiu/blob.ts`: `apagarDoBlob(pendentes, o): Promise<{ feitos, restam, motivo }>` | worktree `wt-e9`, `apps/web/src/lib/youtube/observatorio/saiu/blob.ts:18-36` |

## Decisões desta etapa (com motivo)

| # | Decisão | Motivo |
|---|---|---|
| D-M9-1 | **A lista do item** vive numa tabela nova, `obs_archive_item_targets` (uma linha por classe, tabela, canal, mês e versão registrada que contém o item), gravada **antes** da cascata por `obs_archive_item_capture`, chamada de dentro das funções de apagar da E9 (injeção na âncora com guarda de md5 do corpo instalado, no molde do bloco `remove_archived` da M3b). O spec diz "grava em `competitor_removed_items`"; a tabela separada guarda o mesmo dado sem mudar a forma da linha da E9 e sem `jsonb` sem esquema. Item 109 é provado pela tabela | `02` §11.3 item 2; a E9 já está escrita e revisada fora desta etapa |
| D-M9-2 | `archive_pending` passa a ser **derivado**: um gatilho `before insert or update` em `competitor_removed_items` liga a coluna quando há alvo não concluído do item; `obs_archive_item_advance` a desliga quando o último alvo conclui (com `archive_note = 'arquivo limpo'`) | um só lugar decide; a fila da E9 e a condição 10 já leem a coluna |
| D-M9-3 | **Toda versão nova sai do Mac**, pela serialização TypeScript (unidade e resumo; o manifesto, que não carrega linha nem id de vídeo, é refeito pela selagem da M3b, Tarefa 3), inclusive de mês ainda online: o site nunca reexporta o mês do item por conta própria enquanto houver alvo aberto (o `obs_archive_plan` pula a unidade com alvo aberto) | `02` §11.3 "Como o expurgo reescreve"; um só caminho; item 66 |
| D-M9-4 | **O Mac lê a versão antiga do NAS** (`ssh forja 'cat -- <raiz>/<caminho>'`, leitura), e não do B2 como diz o spec. Confere o sha256 lido contra o registro antes de filtrar; diferente ou ausente: o alvo fica `bloqueado` (`antiga_divergente` ou `antiga_ausente`) | o B2 é cifrado com a chave do cofre que mora na forja (D-F2 da M3b-forja); o Mac não guarda credencial (decisão do dono, 14/10 noite). Desvio declarado ao spec, a levar ao Phil e ao Yannis |
| D-M9-5 | **`owner_pending` vai à `versao 2`** com os mesmos cinco tempos do C12 e dois campos novos: `falta` (por que um `sem_comando` espera) e `motivo` (de um `bloqueado`); `b2_nomes` passa a existir também em `conferir_b2`; `apagar` só em `apagar_antigas` (inalterado). Leitor, script e função mudam no mesmo commit da Tarefa 11 (E-D3, D-F25) | C12 e E-D3/E-D5 |
| D-M9-6 | **O tempo `copiar` é feito pelo próprio `obs:arquivo`**: para cada item em `copiar`, o Mac lê, filtra, serializa, registra pela rota nova e só então imprime o bloco `grava_recebendo` daquele item. O subcomando `expurgar --item <id>` faz o mesmo para um item só, e `expurgar --item <id> --apagar-antigas` imprime só o tempo de apagar | E-D1 (uma linha só para o dono); item 66 ("a primeira chamada imprime só os comandos de cópia") |
| D-M9-7 | **Rota nova `POST /api/pipeline/archive/expurgo`** com a chave `archive_owner` (passos no corpo: `abrir` devolve os alvos de um item com caminhos e sha256; `registrar` grava unidade e resumo; `bloquear` marca o alvo que o Mac não conseguiu reescrever; `canal` diz por que um canal não tem o que apagar). O manifesto **não** passa por ela: é refeito pelo fluxo de selagem da M3b (Tarefa 3, desvio declarado). A chave do dono passa a **registrar** versão (nunca apagar, nunca ler conteúdo). Contrato C14 novo (r2.6) e a linha "Segredo" do C13 revista | C13 l.330; o Mac não tem conexão de banco |
| D-M9-8 | **Prova de ausência** numa tabela nova, `obs_archive_absence`, por (alvo, fonte, filho, prefixo): o plano do copiador e o do B2 passam a trazer `prefixos_ausentes` (o que o site quer ver ausente), e o `attest` aceita `prefixo_ausente`/`prefixo_presente`. No NAS, `ausente` só com montagem e sentinela do filho (C7.1) e só conta depois de **duas** execuções com ≥ 11 h; no B2, zero versões (versão escondida = presente) com controle negativo e canários bons na **mesma** execução (C7.2) | `02` §11.3 tabela de estados; C10 |
| D-M9-9 | **Retenção dos snapshots** registrada pelo dono por SQL do painel (exceção do `05` §16): `select public.obs_archive_registrar_retencao_snapshot('<site>', 14);`. Sem registro, `snapshots_clear_on` fica nulo e a remoção para em `apagado_nas` com a frase "a retenção dos snapshots não foi registrada" (âmbar aos 30 dias) | lido 14/10: 2 semanas (`decisoes-dono-14-10.md`); falha em verde se presumida |
| D-M9-10 | **Canal:** o `obs:arquivo` apaga arquivo a arquivo (`apaga_conferido`, sha256 do registro) e remove diretório vazio do prefixo; `expurgar --canal <ref>` grava o arquivo de comandos do `05` §16.10 (`rm -r --one-file-system` por prefixo derivado) e imprime a linha `ssh forja 'bash -s' < '<arquivo>' > '<saida>' 2>&1`. O que o registro não conhece só sai pelo segundo; a tela oferece os dois (Tarefa 12). A linha impressa difere do `bash expurgar-….sh` do mockup: a forma da linha é do plano (P34) e o agente não escreve na forja | item 161; §16.10; E-D1 |
| D-M9-11 | **Lote da E10:** `concluido` exige que não exista linha de `obs_archive_batches` do `channel_ref` com `deleted_at` e `closed_at` nulos. O caminho do lote no NAS não é conhecido do site (`comandos-nas --destino` arbitrário): o bloco diz "há lote exportado à mão deste canal; apague-o onde você o guardou e encerre-o na E10" | `02` §11.3, estado `concluido` |
| D-M9-12 | **"Já rodei"/"Desfazer"** gravam `marcado_rodado_em` (item ou remoção) por server action com `requireSiteAdmin`; não mudam estado. A reconferência que ainda acha o arquivo devolve o item à lista em âmbar (item 111) | `04` §14.7 |
| D-M9-13 | **Blob:** a tarefa diária `tamanho_do_banco` (que já retenta as miniaturas dos lotes da E10 com `retentarMiniaturasPendentes`, `arquivo/remover.ts:122`) passa a tentar também `obs_archive_channel_removals.blobs_pending`, com o mesmo `apagarDoBlob` e o mesmo filtro de prefixo, **só** com `OBS_ARQUIVO_LIMPEZA_CANAL=on`; sem ela não tenta, e a linha diz por quê | P47; `04` §14.3 |
| D-M9-14 | **Classe `video_antigo`** entra na lista do item (alvo com `archive_frozen_at`), mas a reescrita depende da ficha da M10b: até a M10b, alvo `video_antigo` fica `bloqueado` com `motivo = 'depende_m10b'` (vermelho só aos 60 dias, como qualquer item) | `02` §11.3 "O expurgo de um vídeo que está no arquivo"; `obs_archive_summary_rows` recusa `video_antigo` (`resumo_da_m10b`, `m3b.sql:1083`) |

## Review Focus

1. **Item apagado com mês já destacado ou descartado (só no NAS e no B2):** a pessoa espera que a única cópia antiga só saia depois de a nova estar recebida no NAS e conferida no B2. Teste: `antiga_so_sai_depois_da_nova_conferida` (Tarefa 5) e `apagar_antigas_recusa_sem_b2_ok` (Tarefa 5).
2. **Reaparecimento:** um arquivo que volta ao NAS ou ao B2 depois de `apagado_nas` (restauração de snapshot, `COPY` que resobe do B2) tem de reabrir o item ou a remoção, nunca ficar "concluído". Teste: `prefixo_presente_reabre_e_conta` (Tarefa 4).
3. **Script cortado ou rodado duas vezes:** rodar o mesmo script de novo não pode apagar a versão nova nem falhar; arquivo já ausente é `JA-APAGADO`; `grava_recebendo` com o arquivo já lá e o mesmo sha256 é `JA-GRAVADO`. Teste: `script_duas_vezes_idempotente` (Tarefa 7).
4. **Retenção não registrada, canário ruim, NAS desmontado:** nenhuma ausência vira prova sem sentinela, canário e controle negativo da mesma execução, e sem retenção registrada o estado não passa de `apagado_nas`. Testes: `ausente_sem_sentinela_nao_conta`, `b2_sem_canario_nao_conta` (Tarefa 4) e `sem_retencao_para_em_apagado_nas` (Tarefa 4).
5. **Item em vários meses e tabelas com contagem que não fecha:** a versão nova tem de ter exatamente `antiga − linhas do item`; um filtro que não achou o item (zero linhas removidas) conclui o alvo sem versão nova, e um que achou mais do que o registro sabia recusa. Testes: `registrar_recusa_contagem_errada` (Tarefa 3) e `filtro_sem_linhas_conclui_sem_versao` (Tarefa 6).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/rascunhos/m9.sql` (novo; vira a migration na Tarefa 10) | partes 1 a 6 do SQL da M9 |
| `apps/web/test/helpers/m9.ts` (novo) | `M9_SQL_CAMINHO`, `aplicarM9(c, ate?)`, sementes do item |
| `apps/web/test/manutencao/m9-trava.test.ts` (novo) | TRAVAs M9-1 e M9-2 |
| `apps/web/test/integration/manutencao-m9-*.test.ts` (novos) | um por parte do SQL |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts` (modificar) | leitor `versao 2` |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro.ts` (novo) | filtro puro da unidade e o resumo refeito |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato.ts` (novo) | Zod do C14 (corpo e resposta) |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/comandos-canal.ts` (novo) | gerador puro do arquivo de comandos do §16.10 |
| `apps/web/src/lib/youtube/observatorio/arquivo-mensal/estado-remocao.ts` (modificar) | frases e cores dos estados novos |
| `apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts` (modificar; criado pela M3b-forja Tarefa 7a) | `grava_recebendo`, `apaga_conferido`, `rmdir` de prefixo, B2-PAINEL dos tempos novos |
| `apps/web/src/lib/youtube/observatorio/arquivo/expurgar.ts` (novo) | o tempo `copiar` no Mac (ler NAS, filtrar, registrar) e `--canal` |
| `apps/web/src/lib/youtube/observatorio/arquivo/cli.ts` (modificar) | subcomando `expurgar` |
| `apps/web/src/app/api/pipeline/archive/expurgo/route.ts` (novo) | C14 |
| `apps/web/src/app/api/pipeline/archive/attest/route.ts`, `plan/route.ts` (modificar; criados pela M3b Tarefa 11) | `prefixo_*` e `prefixos_ausentes` |
| `apps/web/src/lib/pipeline/api-registry.ts`, `apps/web/src/lib/pipeline/leitura-rotas.ts`, `apps/web/data/pipeline-docs/cowork-docs-archive.md` (modificar; domínio `archive` da M3b Tarefa 11) | catálogo e doc |
| `apps/web/src/app/cms/(authed)/youtube/competitors/_saiu/*` e a página do Arquivo da M5 (modificar) | peça 7 na fila e bloco "Canais removidos" |
| `apps/web/src/lib/youtube/observatorio/arquivo/blobs-remocao.ts` (novo) e `apps/web/src/lib/youtube/agenda/tarefas/tamanho-do-banco.ts` (modificar) | nova tentativa diária dos blobs das remoções, na mesma tarefa que já retenta as miniaturas da E10 |
| `~/Workspace/forja/ferramentas/arquivo/{copiador/copiar.py, conferir-b2/conferir.py, b2.py, nome-b2.py}` (kit, git local) | `prefixos_ausentes` nos dois programas; nome do B2 para o script |
| `docs/ops/runbook-arquivo-mensal.md` (modificar; criado pela M3b Tarefa 14), `docs/ops/env-vars.md` | runbook e variáveis |

---

### Task 0: leituras do dia e as travas (sem código)

**Files:**
- Disco (não rastreado): `.superpowers/sdd/manutencao-nas/m9-progresso.md` (ledger), `.superpowers/sdd/manutencao-nas/comandos/m9-0-leituras.sh`, saída em `.superpowers/sdd/manutencao-nas/saidas/m9-0-leituras.txt`

**O que acontece quando o dado não existe:** cada leitura sem resposta é escrita no ledger como "NÃO LIDO" e a trava correspondente continua presa; nunca se presume o valor.

- [ ] **Passo 1. Conferências de repositório (agente).**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git fetch origin
for r in staging origin/staging origin/main; do git merge-base --is-ancestor 6c28dc819 $r && echo "E9 em $r: sim" || echo "E9 em $r: NAO"; done
ls supabase/migrations | grep -E 'a5_e9|manutencao_m3b|manutencao_m9'
grep -n "TRAVA M3b-2 solta" .superpowers/sdd/manutencao-nas/m3b-site-progresso.md
git ls-files apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts apps/web/src/lib/youtube/observatorio/arquivo/credencial.ts
ls docs/superpowers/plans | grep -E 'manutencao-nas-m5|manutencao-nas-m6'
```

Expected para seguir: a E9 "sim" em `origin/main`; a migration da E9 e a da M3b presentes; a linha da TRAVA M3b-2; os dois arquivos da Tarefa 7a da M3b-forja rastreados; o plano da M5 existe (nomes dos componentes da página do Arquivo a consumir na Tarefa 12: `grep -n "Canais removidos\|peca7\|Peca7" <plano da M5>`, anotados no ledger). Faltando qualquer um: o ledger registra qual, e só seguem as tarefas que não dependem dele (Tarefas 1, 6 e 7 são puras ou de rascunho e podem andar).

- [ ] **Passo 2. Âncoras e md5 dos corpos da E9 (agente, no banco local com as migrations aplicadas).**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54422 -U postgres -d postgres -At -c "select p.proname, md5(p.prosrc), position('delete from public.competitor_videos v where v.id = p_video;' in p.prosrc) > 0, position('delete from public.competitor_video_comments k where k.id = any(v_alvo);' in p.prosrc) > 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('competitor_video_purge','competitor_comments_purge','competitor_channel_purge') order by 1"
```

Expected: três linhas; a âncora de vídeo `t` em `competitor_video_purge`, a de comentários `t` em `competitor_comments_purge`. Os dois md5 vão ao ledger e às constantes `v_md5_video` e `v_md5_comentarios` da Tarefa 2. Âncora ausente: parar e avisar o controlador (a E9 mudou depois do plano dela).

- [ ] **Passo 3. Leituras de produção (dono, por arquivo de comandos).** Escrever `.superpowers/sdd/manutencao-nas/comandos/m9-0-leituras.sh`:

```bash
#!/bin/bash
set -uo pipefail
cd ~/Workspace/bythiagofigueiredo
npx supabase db query --linked "select p.proname, md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('competitor_video_purge','competitor_comments_purge') order by 1"
npx supabase db query --linked "select count(*) filter (where archive_pending) as pendentes, count(*) as itens from public.competitor_removed_items"
npx supabase db query --linked "select count(*) from public.obs_archive_channel_removals where archive_decision = 'apagar' and completed_at is null"
ssh forja 'grep -n "raiz" /opt/arquivo/copiador/config.json 2>/dev/null || ls /opt/arquivo'
```

Linha que o dono roda: `bash ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/comandos/m9-0-leituras.sh > ~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/saidas/m9-0-leituras.txt 2>&1` (mandar ao `pbcopy` na hora em que for rodar, memória `feedback_comando_no_clipboard.md`). O md5 de produção tem de ser igual ao do Passo 2; diferente, as constantes da Tarefa 2 usam o de produção e o teste local recria o corpo de produção (anotar no ledger). As raízes dos filhos na forja vão à constante `RAIZ_DO_FILHO` da Tarefa 8 (hoje NÃO VERIFICADO: o kit lê de `comum.py`/configuração).

- [ ] **Passo 4. Ledger.** Escrever em `m9-progresso.md`: as respostas dos Passos 1 a 3, as travas que seguem presas e por quê. Sem commit (arquivo ignorado).

---

### Task 1: rascunho do SQL, parte 1 (tabelas, colunas, travas) e o helper dos testes

**Files:**
- Create: `supabase/rascunhos/m9.sql` (cabeçalho e `-- M9 PARTE 1`)
- Create: `apps/web/test/helpers/m9.ts`
- Create: `apps/web/test/manutencao/m9-trava.test.ts`
- Create: `apps/web/test/integration/manutencao-m9-tabelas.test.ts`

**Interfaces:**
- Consumes: `aplicarM3b(c)`, `escalar`, `q1`, `tenta`, `semearCanal`, `SITE_TESTE` (`apps/web/test/helpers/m3b.ts:9-83`); `skipIfNoLocalDb` (`apps/web/test/helpers/db-skip.ts`).
- Produces: `M9_SQL_CAMINHO`, `M9_SQL()`, `type ParteM9 = 1 | 2 | 3 | 4 | 5 | 6`, `sqlM9Ate(ate?)`, `aplicarM9(c: Client, ate?: ParteM9): Promise<void>` (aplica a M3b inteira e depois a M9 até a parte); tabelas `obs_archive_item_targets`, `obs_archive_absence`, `obs_archive_snapshot_retention`; colunas `competitor_removed_items.marcado_rodado_em`, `obs_archive_channel_removals.marcado_rodado_em`.

**O que acontece quando o dado não existe:** sem linha em `obs_archive_item_targets`, o item não tem nada no arquivo (`archive_pending` falso, Tarefa 2); sem linha em `obs_archive_absence` de um alvo, a ausência **não** está provada (nunca "zero = ausente"); sem linha em `obs_archive_snapshot_retention`, `snapshots_clear_on` fica nulo (Tarefa 4).

- [ ] **Passo 1. Teste da trava, falhando** (`apps/web/test/manutencao/m9-trava.test.ts`):

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = resolve(__dirname, '../../../..')
const migrou = readdirSync(resolve(RAIZ, 'supabase/migrations')).some(n => n.includes('_manutencao_m9_'))

describe('TRAVAs M9-1 e M9-2', () => {
  it('o SQL da M9 vive no rascunho até a Tarefa 10', () => {
    expect(existsSync(resolve(RAIZ, 'supabase/rascunhos/m9.sql'))).toBe(true)
  })
  it.skipIf(migrou)('sem a migration: nem rota do expurgo nem leitor na versao 2', () => {
    expect(existsSync(resolve(RAIZ, 'apps/web/src/app/api/pipeline/archive/expurgo'))).toBe(false)
    const p = readFileSync(resolve(RAIZ, 'apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts'), 'utf8')
    expect(p).toMatch(/export const VERSAO_PENDENCIAS = 1\b/)
  })
})
```

- [ ] **Passo 2.** `cd apps/web && npx vitest run test/manutencao/m9-trava.test.ts` → FAIL (`m9.sql` não existe).

- [ ] **Passo 3. O helper** (`apps/web/test/helpers/m9.ts`):

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Client } from 'pg'
import { aplicarM3b } from './m3b'

export const M9_SQL_CAMINHO: string = resolve(__dirname, '../../../../supabase/rascunhos/m9.sql')
export const M9_SQL = (): string => readFileSync(M9_SQL_CAMINHO, 'utf8')
export type ParteM9 = 1 | 2 | 3 | 4 | 5 | 6

/** O texto da M9 até o fim da parte `ate` (padrão: tudo). Partes marcadas por `-- M9 PARTE <n>:`. */
export function sqlM9Ate(ate: ParteM9 = 6): string {
  const sql = M9_SQL()
  if (ate === 6) return sql
  const fim = sql.indexOf(`-- M9 PARTE ${ate + 1}:`)
  if (fim < 0) throw new Error(`m9.sql sem o marcador da parte ${ate + 1}`)
  return sql.slice(0, fim)
}

export async function aplicarM9(c: Client, ate?: ParteM9): Promise<void> {
  await aplicarM3b(c)
  await c.query(sqlM9Ate(ate))
}
```

- [ ] **Passo 4. Testes das tabelas, falhando** (`manutencao-m9-tabelas.test.ts`, `describe.skipIf(skipIfNoLocalDb())`, cada `it` em `begin … rollback` com `aplicarM9(c, 1)`):

| Teste | Afirma |
|---|---|
| `tabelas novas com RLS e sem escrita` | as três tabelas com `relrowsecurity`; uma policy `select` cada, com `can_edit_site(site_id)` no texto; `has_table_privilege('service_role', t, 'INSERT')` falso; `has_table_privilege('authenticated', t, 'SELECT')` falso fora da policy (grant revogado) |
| `alvo exige motivo só quando bloqueado` | insert com `estado = 'bloqueado'` e `motivo` nulo falha `23514`; `estado = 'copiar'` com `motivo` preenchido falha `23514` |
| `ausência: forma do alvo` | `alvo = 'canal:xyz'` falha `23514`; `'canal:<uuid>'`, `'item:12'` e `'antiga:<uuid>'` passam |
| `ausência: marcos em ordem` | `nas_absent_at` com `nas_absent_first_at` nulo falha `23514` |
| `colunas novas` | `competitor_removed_items.marcado_rodado_em` e `obs_archive_channel_removals.marcado_rodado_em` existem, `timestamptz`, nulas |
| `rodar duas vezes` | `aplicarM9(c, 1)` duas vezes na mesma transação não erra (idempotência) |

- [ ] **Passo 5. A parte 1** (`supabase/rascunhos/m9.sql`):

```sql
-- Manutenção M9: expurgo enxuto (fatia 12b). Rascunho: vira a migration manutencao_m9_expurgo na Tarefa 10 (TRAVA M9-1).
-- Depende da M3b (obs_archive_*) e da E9 (competitor_*_purge) aplicadas.

-- M9 PARTE 1: tabelas e colunas
do $$ begin
  if to_regclass('public.obs_archive_units') is null or to_regclass('public.competitor_removed_items') is null then
    raise exception 'M9 depende da M3b e da E1/E9' using errcode = 'P0001';
  end if;
end $$;

alter table public.competitor_removed_items add column if not exists marcado_rodado_em timestamptz;
alter table public.obs_archive_channel_removals add column if not exists marcado_rodado_em timestamptz;
alter table public.obs_archive_channel_removals add column if not exists nas_last_absent_at timestamptz;

-- A lista do item (02 §11.3 item 2; D-M9-1): uma linha por unidade registrada que contém o item, gravada antes da cascata.
create table if not exists public.obs_archive_item_targets (
  id bigint generated always as identity primary key,
  site_id uuid not null,
  item_kind text not null check (item_kind in ('video', 'comentario')),
  item_key text not null check (item_key ~ '^(?:[A-Za-z0-9_-]{1,64}|comentarios:[0-9a-f-]{36})$'),
  item_id bigint,
  created_xid xid8 not null default pg_current_xact_id(),
  class text not null check (class in ('horaria', 'serie', 'texto', 'video_antigo')),
  table_name text not null,
  channel_ref text not null check (channel_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  month date not null check (month = date_trunc('month', month)::date),
  from_unit_id uuid not null,
  from_version integer not null check (from_version between 1 and 9999),
  keys text[] not null check (cardinality(keys) between 1 and 10000),
  estado text not null default 'copiar'
    check (estado in ('copiar', 'aguardando_nova', 'apagar_antigas', 'conferir_b2', 'concluido', 'sem_linhas', 'bloqueado')),
  motivo text check (motivo in ('antiga_ausente', 'antiga_divergente', 'depende_m10b', 'grande_demais', 'contagem_divergente')),
  to_unit_id uuid, to_version integer, rows_removed bigint check (rows_removed >= 0),
  done_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (site_id, item_key, class, table_name, channel_ref, month),
  check ((estado = 'bloqueado') = (motivo is not null)),
  check ((estado in ('concluido', 'sem_linhas')) = (done_at is not null))
);
create index if not exists idx_oait_item on public.obs_archive_item_targets (site_id, item_id);
create index if not exists idx_oait_open on public.obs_archive_item_targets (site_id) where done_at is null;

-- A prova de ausência (D-M9-8): o que o site quer ver sumir, e o que o copiador e o conferir-b2 disseram.
create table if not exists public.obs_archive_absence (
  id bigint generated always as identity primary key,
  site_id uuid not null,
  alvo text not null check (alvo ~ '^(?:canal:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|item:[1-9][0-9]{0,18}|antiga:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'),
  filho text not null check (filho in ('numerico', 'texto')),
  prefixo text not null check (prefixo ~ '^[A-Za-z0-9_][A-Za-z0-9._/-]{0,299}$' and prefixo !~ '(^|/)\.\.?(/|$)'),
  e_prefixo boolean not null,                         -- true: diretório inteiro (canal); false: arquivo exato (item, versão antiga)
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  nova_caminho text, nova_sha256 text check (nova_sha256 ~ '^[0-9a-f]{64}$'),
  nas_absent_first_at timestamptz, nas_absent_at timestamptz, nas_last_absent_at timestamptz, nas_present_at timestamptz,
  b2_absent_at timestamptz, b2_present_at timestamptz, b2_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, alvo, filho, prefixo),
  check (e_prefixo or sha256 is not null),
  check ((nova_caminho is null) = (nova_sha256 is null)),
  check (nas_absent_at is null or nas_absent_first_at is not null)
);
create index if not exists idx_oaa_alvo on public.obs_archive_absence (site_id, alvo);

-- D-M9-9: a retenção dos snapshots do NAS, registrada pelo dono (SQL do painel).
create table if not exists public.obs_archive_snapshot_retention (
  site_id uuid primary key,
  dias integer not null check (dias between 1 and 365),
  registrado_em timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['obs_archive_item_targets', 'obs_archive_absence', 'obs_archive_snapshot_retention'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select using (public.can_edit_site(site_id))', t || '_leitura', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from service_role', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
```

- [ ] **Passo 6.** Rodar os dois testes → PASS (`cd apps/web && npx vitest run test/manutencao/m9-trava.test.ts test/integration/manutencao-m9-tabelas.test.ts --no-file-parallelism`, com `HAS_LOCAL_DB=1` e o banco `bythiago_int`).

- [ ] **Passo 7. Commit** (quando o controlador mandar): `git add -- supabase/rascunhos/m9.sql apps/web/test/helpers/m9.ts apps/web/test/manutencao/m9-trava.test.ts apps/web/test/integration/manutencao-m9-tabelas.test.ts` e `git commit -m "feat: M9 parte 1: lista do item, prova de ausência e retenção dos snapshots (rascunho)" -- <os quatro>`.

---

### Task 2: SQL parte 2, a lista do item antes da cascata e o `archive_pending` derivado

**Files:**
- Modify: `supabase/rascunhos/m9.sql` (`-- M9 PARTE 2:`)
- Create: `apps/web/test/integration/manutencao-m9-lista-do-item.test.ts`

**Interfaces:**
- Consumes: `competitor_video_purge(p_site, p_video, p_actor, p_janela_min, p_ip, p_ua)` e `competitor_comments_purge(p_site, p_channel, p_comment_ids bigint[], p_actor, p_ip, p_ua)` da E9 (corpos em produção; md5 da Tarefa 0); `obs_archive_policy()`, `obs_archive_units`, `obs_archive_months`.
- Produces: `obs_archive_item_capture(p_site uuid, p_kind text, p_channel uuid, p_item_key text, p_keys text[]) returns integer` (interna); gatilhos `obs_archive_item_flag` (antes de insert/update em `competitor_removed_items`) e `obs_archive_item_link` (depois do insert); as duas funções da E9 com a chamada injetada.

**O que acontece quando o dado não existe:** canal sem unidade registrada (o comum hoje): a captura grava zero linhas e o item nasce com `archive_pending = false` ("não há cópia no arquivo", a frase da E9 continua certa). Unidade só com `row_count = 0`: não entra (arquivo vazio não contém o item). Função da E9 com corpo diferente do md5 esperado: a migration **falha** (`m9_e9_mudou`), nunca segue sem a captura.

- [ ] **Passo 1. Testes, falhando** (`aplicarM9(c, 2)`; sementes: `semearCanal` + unidades registradas com `received_at` preenchido, inseridas direto em `obs_archive_units` como superusuário):

| Teste | Afirma |
|---|---|
| `sem unidade: nada a limpar` | apagar um vídeo de canal sem unidade: zero alvos; `archive_pending = false` |
| `vídeo com unidades em dois meses e duas tabelas` | `serie/competitor_video_daily` em `2026-09` e `2026-10`, `texto/competitor_video_comments` em `2026-10`: três alvos, `keys = '{<competitor_videos.id>}'`, `from_version` = maior versão recebida de cada (classe, tabela, canal, mês), `estado 'copiar'`; `archive_pending = true`; `item_id` ligado à linha nova de `competitor_removed_items` (item 109) |
| `alvo gravado antes da cascata` | dentro da mesma transação, logo depois do apagar, `select count(*) from competitor_videos where id = <id>` = 0 **e** os alvos têm o `id` interno nas `keys` (o online já não o sabe) |
| `unidade vazia não entra` | unidade com `row_count = 0`: não vira alvo |
| `video_antigo nasce bloqueado` | unidade `video_antigo` do vídeo: alvo `bloqueado`, `motivo 'depende_m10b'`; `archive_pending = true` |
| `mês destacado recusa o apagar` | `obs_archive_months.detached_at` preenchido e `dropped_at` nulo num mês com unidade do vídeo: a função da E9 lança `mes_destacado_em_transito`; o vídeo continua no online (rollback) |
| `mês descartado não recusa` | `dropped_at` preenchido: o apagar segue e o alvo é `copiar` |
| `comentários: um alvo por unidade de texto do canal` | apagar 2 comentários com 1 resposta: alvos de `competitor_video_comments` e `competitor_video_comment_marks` dos meses com unidade; `keys` = os 3 ids (pedidos e resposta); as linhas novas de `competitor_removed_items` de `kind 'comentario'` da mesma transação com `archive_pending = true` |
| `md5 diferente derruba a migration` | trocar uma letra do corpo de `competitor_video_purge` e reaplicar a parte 2: erro `m9_e9_mudou` |
| `reaplicar não injeta duas vezes` | aplicar a parte 2 duas vezes: o corpo tem **uma** ocorrência de `obs_archive_item_capture` |
| `captura não é chamável de fora` | `has_function_privilege('service_role', 'public.obs_archive_item_capture(uuid,text,uuid,text,text[])', 'EXECUTE')` falso |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. A parte 2:**

```sql
-- M9 PARTE 2: a lista do item antes da cascata (02 §11.3 itens 2 e 3) e o archive_pending derivado (D-M9-2)
create or replace function public.obs_archive_item_capture(p_site uuid, p_kind text, p_channel uuid, p_item_key text, p_keys text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_kind not in ('video', 'comentario') or p_keys is null or cardinality(p_keys) = 0 then raise exception 'captura_invalida' using errcode = 'P0001'; end if;
  -- 02 §11.3 item 3: com mês destacado (em trânsito) não há "apagar"
  if exists (select 1 from public.obs_archive_units u join public.obs_archive_months m
               on m.site_id = u.site_id and m.class = u.class and m.table_name = u.table_name and m.month = u.month
              where u.site_id = p_site and u.channel_ref = p_channel::text and u.row_count > 0
                and m.detached_at is not null and m.dropped_at is null
                and (p_kind = 'video' or u.class = 'texto')) then
    raise exception 'mes_destacado_em_transito' using errcode = 'P0001';
  end if;
  insert into public.obs_archive_item_targets as t
         (site_id, item_kind, item_key, class, table_name, channel_ref, month, from_unit_id, from_version, keys, estado, motivo)
  select p_site, p_kind, p_item_key, u.class, u.table_name, u.channel_ref, u.month, u.id, u.version, p_keys,
         case when u.class = 'video_antigo' then 'bloqueado' else 'copiar' end,
         case when u.class = 'video_antigo' then 'depende_m10b' end
    from (select distinct on (x.class, x.table_name, x.month) x.*
            from public.obs_archive_units x
           where x.site_id = p_site and x.channel_ref = p_channel::text and x.row_count > 0
             and x.received_at is not null and x.purged_at is null and x.lost_at is null
             and (p_kind = 'video' or x.class = 'texto')
             and x.class <> 'ensaio'
           order by x.class, x.table_name, x.month, x.version desc) u
  on conflict (site_id, item_key, class, table_name, channel_ref, month) do update
     set keys = (select array_agg(distinct k order by k) from unnest(t.keys || excluded.keys) k),
         from_version = greatest(t.from_version, excluded.from_version),
         estado = case when t.done_at is null then t.estado else excluded.estado end,
         motivo = case when t.done_at is null then t.motivo else excluded.motivo end,
         done_at = null,                 -- item apagado de novo (purge_count 2): o alvo concluído reabre
         updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.obs_archive_item_capture(uuid, text, uuid, text, text[]) from public, anon, authenticated, service_role;

-- archive_pending = existe alvo aberto do item (vídeo pela chave; comentários pela transação que os apagou)
create or replace function public.obs_archive_item_flag() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'video' then
    new.archive_pending := exists (select 1 from public.obs_archive_item_targets t
                                    where t.site_id = new.site_id and t.item_key = new.youtube_id and t.done_at is null);
  elsif new.kind = 'comentario' then
    new.archive_pending := exists (select 1 from public.obs_archive_item_targets t
                                    where t.site_id = new.site_id and t.item_key = 'comentarios:' || new.competitor_channel_id::text
                                      and t.done_at is null
                                      and (t.created_xid = pg_current_xact_id() or t.item_id = new.id));
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_item_flag() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_item_flag on public.competitor_removed_items;
create trigger obs_archive_item_flag before insert or update of rows_deleted, purge_count on public.competitor_removed_items
  for each row execute function public.obs_archive_item_flag();

create or replace function public.obs_archive_item_link() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.obs_archive_item_targets t set item_id = new.id, updated_at = now()
   where t.site_id = new.site_id and t.item_id is null and t.created_xid = pg_current_xact_id()
     and ((new.kind = 'video' and t.item_key = new.youtube_id)
       or (new.kind = 'comentario' and t.item_key = 'comentarios:' || new.competitor_channel_id::text));
  return null;
end $$;
revoke all on function public.obs_archive_item_link() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_item_link on public.competitor_removed_items;
create trigger obs_archive_item_link after insert or update of rows_deleted, purge_count on public.competitor_removed_items
  for each row execute function public.obs_archive_item_link();

-- A injeção nas funções da E9 (molde do bloco remove_archived da M3b): confere o md5 do corpo instalado, troca a âncora uma vez.
do $$
declare
  v_md5_video text := '<md5 de competitor_video_purge lido na Tarefa 0, Passo 3>';
  v_md5_coment text := '<md5 de competitor_comments_purge lido na Tarefa 0, Passo 3>';
  v_def text; v_src text;
  v_anc_v text := 'delete from public.competitor_videos v where v.id = p_video;';
  v_anc_c text := 'delete from public.competitor_video_comments k where k.id = any(v_alvo);';
begin
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'competitor_video_purge';
  if position('obs_archive_item_capture' in v_src) = 0 then
    if md5(v_src) <> v_md5_video then raise exception 'm9_e9_mudou: competitor_video_purge' using errcode = 'P0001'; end if;
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'competitor_video_purge';
    execute replace(v_def, v_anc_v,
      'perform public.obs_archive_item_capture(p_site, ''video'', v_canal, v_youtube_id, array[p_video::text]);' || chr(10) || '  ' || v_anc_v);
  end if;
  select p.prosrc into v_src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'competitor_comments_purge';
  if position('obs_archive_item_capture' in v_src) = 0 then
    if md5(v_src) <> v_md5_coment then raise exception 'm9_e9_mudou: competitor_comments_purge' using errcode = 'P0001'; end if;
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'competitor_comments_purge';
    execute replace(v_def, v_anc_c,
      'perform public.obs_archive_item_capture(p_site, ''comentario'', p_channel, ''comentarios:'' || p_channel::text, (select array_agg(x::text) from unnest(v_alvo) x));'
      || chr(10) || '  ' || v_anc_c);
  end if;
end $$;
```

**Nota de execução:** os nomes `v_canal` e `v_youtube_id` são as variáveis locais que o corpo da E9 usa para o canal e o `youtube_id` do vídeo antes da âncora; a Tarefa 0, Passo 2, lê o corpo instalado (`select prosrc ...`) e, se os nomes forem outros, a linha injetada usa os do corpo (anotar no ledger; o teste `vídeo com unidades em dois meses` falha se o nome estiver errado, porque a função não compila). Nos comentários, `v_alvo` é o array dos ids (pedidos e respostas) que o `delete` usa (plano da E9, l.1340). O insert em `competitor_removed_items` dos comentários vem **antes** da âncora: por isso o gatilho de bandeira também roda no `update` (e o `obs_archive_item_link` religa) — o teste `comentários` cobre; se a E9 não fizer `update` depois do `delete`, o executor acrescenta, logo depois da captura, `update public.competitor_removed_items set purge_count = purge_count where site_id = p_site and kind = 'comentario' and competitor_channel_id = p_channel and decided_at = now();` dentro da mesma injeção (o gatilho só reage a `rows_deleted`/`purge_count`).

- [ ] **Passo 4.** Rodar → PASS.

- [ ] **Passo 5. Commit** (quando mandado): `git add -- apps/web/test/integration/manutencao-m9-lista-do-item.test.ts` e `git commit -m "feat: M9 parte 2: lista do item gravada antes da cascata da E9 e archive_pending derivado (rascunho)" -- supabase/rascunhos/m9.sql apps/web/test/integration/manutencao-m9-lista-do-item.test.ts`.

---

### Task 3: SQL parte 3, abrir e registrar o expurgo (o que a rota C14 chama)

**Files:**
- Modify: `supabase/rascunhos/m9.sql` (`-- M9 PARTE 3:`)
- Create: `apps/web/test/integration/manutencao-m9-registrar.test.ts`

**Interfaces:**
- Consumes: `obs_archive_record_core(p_site, 'unidade', p_payload, 'expurgo')` (`m3b.sql:603`; a exceção do expurgo já existe), `obs_archive_policy()`, `obs_archive_item_targets` (Tarefa 1).
- Produces:
  - `obs_archive_expurgo_open(p_site uuid, p_item bigint) returns jsonb` → `{ item_id, kind, grupos: [{ classe, canal, mes, filho, alvos: [{ alvo_id, tabela, versao, linhas, soma, coluna_controle, schema_fp, chaves: text[], arquivos: [{ caminho, sha256, parte }] }], resumo: { versao, canal: { caminho, sha256 } | null, video: { caminho, sha256 } | null } | null, outras: [{ tabela, linhas, hash_conteudo }], dias_do_mes }] }`. Só alvos em `copiar`; nenhum: `grupos: []`. `outras` são as unidades correntes do mesmo (classe, canal, mês) que não são alvo (as vazias, em geral): o resumo do canal tem uma linha por tabela, inclusive vazia (`m3b.sql:1105-1130`), e o Mac precisa delas para refazê-lo.
  - `obs_archive_expurgo_record(p_site uuid, p_item bigint, p_body jsonb) returns jsonb` → corpo `{ classe, canal, mes, unidades: [{ alvo_id, linhas_removidas, unidade: <payload de record_core> }], sem_linhas: [alvo_id], resumo: { versao, vazio, canal_sha256, canal_bytes, canal_rows, video_sha256, video_bytes, video_rows } }`; resposta `{ status: 'registrado', unidades: [{ alvo_id, arquivo_id, versao, caminho }], resumo: { arquivo_id, versao } | null }`; toda recusa é exceção `P0001` com o código na mensagem (`item_desconhecido`, `alvo_de_outro_item`, `alvo_fora_de_copiar`, `contagem_divergente`, `sem_destino`, `canal_removido`) e desfaz tudo (tudo ou nada por grupo).
  - `obs_archive_expurgo_block(p_site uuid, p_item bigint, p_alvo bigint, p_motivo text) returns jsonb` (`antiga_ausente` | `antiga_divergente` | `grande_demais`) e `obs_archive_expurgo_unblock(p_site uuid, p_alvo bigint)` (só `postgres`, SQL do painel).
  - `open`, `record` e `block` com `grant execute ... to service_role` (a rota chama).

**O que acontece quando o dado não existe:** item desconhecido do site: `item_desconhecido` (P0001, a rota devolve `404`). Item sem alvo em `copiar`: `open` devolve `grupos: []` (o Mac não grava nada; não é erro). Unidade antiga sem `sha256_bytes` (vazia): nunca é alvo (Tarefa 2). Grupo com alvo bloqueado: o `open` não o traz; o `record` de um alvo que não está em `copiar` recusa `alvo_fora_de_copiar`.

- [ ] **Passo 1. Testes, falhando** (`aplicarM9(c, 3)`; semente: item de vídeo com três alvos da Tarefa 2, unidades de 100 linhas das quais 7 do vídeo):

| Teste | Afirma |
|---|---|
| `open devolve os alvos com caminho e sha256` | um grupo por (classe, canal, mês); `arquivos[0].caminho = 'serie/canais/<ref>/competitor_video_daily/2026-09.v1.csv.gz'` (a mesma forma de `obs_archive_month_files`, `m3b.sql:539`); `sha256` = `sha256_bytes` da unidade; unidade em partes: um arquivo por parte com `parte` 1..N |
| `open sem nada a copiar` | item com todos os alvos `aguardando_nova`: `grupos = []` |
| `record grava a versão nova pela exceção do expurgo` | `unidade.row_count = 93`, `linhas_removidas = 7`: `obs_archive_units` ganha a versão 2 com `origem 'expurgo'`; `obs_archive_purges` uma linha `from_version 1, to_version 2, rows_removed 7`; o alvo vai a `aguardando_nova` com `to_unit_id`; item 66 (parte do registro) |
| `registrar_recusa_contagem_errada` (Review Focus 5) | `row_count = 95` com `linhas_removidas = 7` (100 − 7 ≠ 95): `contagem_divergente`, nada gravado; `linhas_removidas = 0`: `contagem_divergente` (zero vai em `sem_linhas`) |
| `sem_linhas conclui sem versão` | alvo em `sem_linhas`: estado `sem_linhas`, `done_at` preenchido, nenhuma unidade nova; o último alvo concluído desliga `archive_pending` (Tarefa 5 completa a regra) |
| `record de mês descartado` | mês com `dropped_at`: grava (exceção `expurgo`); mês ainda online: grava também (D-M9-3) |
| `alvo de outro item` | `alvo_id` de outro item: `alvo_de_outro_item`, nada gravado |
| `resumo novo mesmo com mês fora do banco` | `obs_archive_summaries` ganha a versão seguinte com `unit_hashes` = `{"u:<nova>": <hash_conteudo novo>, ...demais unidades do canal no mês}`; o `record_core` recusaria (`ja_no_arquivo`, `m3b.sql:704`), por isso a M9 grava direto |
| `ausência das versões antigas` | `obs_archive_absence` ganha, com `alvo 'item:<id>'` e `e_prefixo = false`: a unidade v1 (caminho, `sha256`, `nova_caminho` = caminho da v2, `nova_sha256` = `sha256_bytes` novo), cada parte de versões anteriores, e o resumo antigo (`canal` e `video`) com a `nova` correspondente; **todas** as versões anteriores da unidade, não só a última (item 110) |
| `resumo com versão de outra execução` | `resumo.versao` diferente de `max(version) + 1`: `resumo_versao_mudou`, nada gravado |
| `outras unidades do grupo` | unidade vazia de `competitor_video_early` no mesmo mês: aparece em `outras` com `linhas 0` e o `hash_conteudo` dela; nunca em `alvos` |
| `repetir o record` | o mesmo corpo de novo: `alvo_fora_de_copiar` (o primeiro já mudou o estado); nada duplicado |
| `bloquear e desbloquear` | `block(..., 'antiga_divergente')`: alvo `bloqueado`; `unblock`: volta a `copiar`; `block` de alvo fora de `copiar`: `alvo_fora_de_copiar`; `unblock` de `depende_m10b`: `alvo_nao_desbloqueavel` |
| `permissões` | `has_function_privilege('service_role', ..., 'EXECUTE')` verdadeiro para `open`, `record` e `block`; falso para `unblock` e para `anon` e `authenticated` em todas |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. A parte 3:**

```sql
-- M9 PARTE 3: abrir e registrar o expurgo (C14; D-M9-3, D-M9-7)
create or replace function public.obs_archive_caminho_unidade(p_class text, p_ref text, p_table text, p_month date, p_ver integer, p_parte integer)
returns text language sql immutable set search_path = '' as $$
  select p_class || '/canais/' || p_ref || '/' || p_table || '/' || to_char(p_month, 'YYYY-MM') || '.v' || p_ver
         || case when p_parte is null then '' else '.p' || lpad(p_parte::text, 2, '0') end || '.csv.gz'
$$;
revoke all on function public.obs_archive_caminho_unidade(text, text, text, date, integer, integer) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_expurgo_open(p_site uuid, p_item bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_kind text; v_grupos jsonb;
begin
  select i.kind into v_kind from public.competitor_removed_items i where i.site_id = p_site and i.id = p_item and i.kind in ('video', 'comentario');
  if not found then raise exception 'item_desconhecido' using errcode = 'P0001'; end if;
  with a as (
    select t.*, u.row_count, u.control_sum, u.schema_fp, u.parts, u.sha256_bytes, pol.filho, pol.control_column
      from public.obs_archive_item_targets t
      join public.obs_archive_units u on u.id = t.from_unit_id
      join public.obs_archive_policy() pol on pol.class = t.class and pol.table_name = t.table_name
     where t.site_id = p_site and t.item_id = p_item and t.estado = 'copiar'
  ), g as (
    select a.class, a.channel_ref, a.month, min(a.filho) as filho,
           jsonb_agg(jsonb_build_object(
             'alvo_id', a.id, 'tabela', a.table_name, 'versao', a.from_version, 'linhas', a.row_count, 'soma', a.control_sum::text,
             'coluna_controle', a.control_column, 'schema_fp', a.schema_fp, 'chaves', to_jsonb(a.keys),
             'arquivos', case when a.parts = 1
                 then jsonb_build_array(jsonb_build_object('caminho', public.obs_archive_caminho_unidade(a.class, a.channel_ref, a.table_name, a.month, a.from_version, null),
                                                           'sha256', a.sha256_bytes, 'parte', 1))
                 else (select jsonb_agg(jsonb_build_object('caminho', public.obs_archive_caminho_unidade(a.class, a.channel_ref, a.table_name, a.month, a.from_version, pt.part),
                                                           'sha256', pt.sha256_bytes, 'parte', pt.part) order by pt.part)
                         from public.obs_archive_unit_parts pt where pt.unit_id = a.from_unit_id) end)
             order by a.table_name) as alvos
      from a group by a.class, a.channel_ref, a.month
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'classe', g.class, 'canal', g.channel_ref, 'mes', to_char(g.month, 'YYYY-MM'), 'filho', g.filho, 'alvos', g.alvos,
           'resumo', (select jsonb_build_object('versao', s.version,
                        'canal', case when s.canal_sha256 is null then null else jsonb_build_object('caminho', g.class || '/canais/' || g.channel_ref || '/resumo/' || to_char(g.month, 'YYYY-MM') || '.v' || s.version || '.canal.csv.gz', 'sha256', s.canal_sha256) end,
                        'video', case when s.video_sha256 is null then null else jsonb_build_object('caminho', g.class || '/canais/' || g.channel_ref || '/resumo/' || to_char(g.month, 'YYYY-MM') || '.v' || s.version || '.video.csv.gz', 'sha256', s.video_sha256) end)
                        from public.obs_archive_summaries s
                       where s.site_id = p_site and s.class = g.class and s.channel_ref = g.channel_ref and s.month = g.month and s.received_at is not null
                       order by s.version desc limit 1),
           'outras', (select coalesce(jsonb_agg(jsonb_build_object('tabela', c.table_name, 'linhas', c.row_count, 'hash_conteudo', c.hash_conteudo) order by c.table_name), '[]'::jsonb)
                        from public.obs_archive_current_units(p_site, g.class, g.month) c
                       where c.channel_ref = g.channel_ref and c.purged_at is null and c.lost_at is null
                         and not exists (select 1 from public.obs_archive_item_targets t2 where t2.site_id = p_site and t2.item_id = p_item
                                          and t2.class = g.class and t2.channel_ref = g.channel_ref and t2.month = g.month and t2.table_name = c.table_name)),
           'dias_do_mes', ((g.month + interval '1 month')::date - g.month))
         order by g.class, g.month), '[]'::jsonb)
    into v_grupos from g;
  return jsonb_build_object('item_id', p_item, 'kind', v_kind, 'grupos', v_grupos);
end $$;
revoke all on function public.obs_archive_expurgo_open(uuid, bigint) from public, anon, authenticated;
grant execute on function public.obs_archive_expurgo_open(uuid, bigint) to service_role;

create or replace function public.obs_archive_expurgo_record(p_site uuid, p_item bigint, p_body jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_class text := p_body->>'classe'; v_ref text := p_body->>'canal'; v_month date := ((p_body->>'mes') || '-01')::date;
  x jsonb; t record; u record; r jsonb; v_new record; v_saida jsonb := '[]'::jsonb; v_res jsonb := null; v_old_s record; v_sid uuid; v_sver integer;
  v_filho text;
begin
  if not exists (select 1 from public.competitor_removed_items i where i.site_id = p_site and i.id = p_item) then
    raise exception 'item_desconhecido' using errcode = 'P0001';
  end if;
  select min(p.filho) into v_filho from public.obs_archive_policy() p where p.class = v_class;
  -- sem linhas: o filtro do Mac não achou o item (Review Focus 5)
  for x in select * from jsonb_array_elements(coalesce(p_body->'sem_linhas', '[]'::jsonb)) loop
    update public.obs_archive_item_targets set estado = 'sem_linhas', done_at = now(), updated_at = now()
     where id = (x #>> '{}')::bigint and site_id = p_site and item_id = p_item and estado = 'copiar';
    if not found then raise exception 'alvo_fora_de_copiar' using errcode = 'P0001'; end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_body->'unidades', '[]'::jsonb)) loop
    select * into t from public.obs_archive_item_targets where id = (x->>'alvo_id')::bigint and site_id = p_site for update;
    if not found or t.item_id is distinct from p_item then raise exception 'alvo_de_outro_item' using errcode = 'P0001'; end if;
    if t.estado <> 'copiar' then raise exception 'alvo_fora_de_copiar' using errcode = 'P0001'; end if;
    if t.class <> v_class or t.channel_ref <> v_ref or t.month <> v_month
       or x->'unidade'->>'classe' <> t.class or x->'unidade'->>'tabela' <> t.table_name
       or x->'unidade'->>'canal' <> t.channel_ref or x->'unidade'->>'mes' <> v_month::text then
      raise exception 'alvo_de_outro_item' using errcode = 'P0001';
    end if;
    select * into u from public.obs_archive_units where id = t.from_unit_id;
    if (x->>'linhas_removidas')::bigint is null or (x->>'linhas_removidas')::bigint < 1
       or (x->'unidade'->>'row_count')::bigint <> u.row_count - (x->>'linhas_removidas')::bigint then
      raise exception 'contagem_divergente' using errcode = 'P0001';
    end if;
    r := public.obs_archive_record_core(p_site, 'unidade', x->'unidade', 'expurgo');
    if r->>'status' not in ('nova', 'mesma') then raise exception '%', r->>'status' using errcode = 'P0001'; end if;   -- tudo ou nada
    select * into v_new from public.obs_archive_units where id = substr(r->>'arquivo_id', 3)::uuid;
    insert into public.obs_archive_purges (site_id, class, table_name, channel_ref, month, from_version, to_version, rows_removed)
    values (p_site, t.class, t.table_name, t.channel_ref, t.month, t.from_version, v_new.version, (x->>'linhas_removidas')::bigint);
    update public.obs_archive_item_targets set estado = 'aguardando_nova', to_unit_id = v_new.id, to_version = v_new.version,
           rows_removed = (x->>'linhas_removidas')::bigint, updated_at = now() where id = t.id;
    -- todas as versões anteriores da unidade (item 110), inteira ou em partes
    insert into public.obs_archive_absence (site_id, alvo, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256)
    select p_site, 'item:' || p_item, v_filho, public.obs_archive_caminho_unidade(o.class, o.channel_ref, o.table_name, o.month, o.version, null), false,
           o.sha256_bytes, public.obs_archive_caminho_unidade(v_new.class, v_new.channel_ref, v_new.table_name, v_new.month, v_new.version, null), v_new.sha256_bytes
      from public.obs_archive_units o
     where o.site_id = p_site and o.class = t.class and o.table_name = t.table_name and o.channel_ref = t.channel_ref and o.month = t.month
       and o.version < v_new.version and o.parts = 1 and o.sha256_bytes is not null
    on conflict (site_id, alvo, filho, prefixo) do nothing;
    insert into public.obs_archive_absence (site_id, alvo, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256)
    select p_site, 'item:' || p_item, v_filho, public.obs_archive_caminho_unidade(o.class, o.channel_ref, o.table_name, o.month, o.version, pt.part), false,
           pt.sha256_bytes, public.obs_archive_caminho_unidade(v_new.class, v_new.channel_ref, v_new.table_name, v_new.month, v_new.version, null), v_new.sha256_bytes
      from public.obs_archive_units o join public.obs_archive_unit_parts pt on pt.unit_id = o.id
     where o.site_id = p_site and o.class = t.class and o.table_name = t.table_name and o.channel_ref = t.channel_ref and o.month = t.month
       and o.version < v_new.version and o.parts > 1
    on conflict (site_id, alvo, filho, prefixo) do nothing;
    v_saida := v_saida || jsonb_build_array(jsonb_build_object('alvo_id', t.id, 'arquivo_id', r->>'arquivo_id', 'versao', v_new.version,
               'caminho', public.obs_archive_caminho_unidade(v_new.class, v_new.channel_ref, v_new.table_name, v_new.month, v_new.version, null)));
  end loop;
  -- o resumo do mês (02 §11.3): versão nova gravada aqui, porque o record_core recusa mês fora do banco
  if p_body ? 'resumo' and jsonb_array_length(v_saida) > 0 then
    select * into v_old_s from public.obs_archive_summaries s
     where s.site_id = p_site and s.class = v_class and s.channel_ref = v_ref and s.month = v_month order by s.version desc limit 1 for update;
    v_sver := coalesce(v_old_s.version, 0) + 1;
    -- o Mac escreveu versao_resumo dentro do arquivo: a versão gravada tem de ser a mesma (corrida com outra execução)
    if (p_body->'resumo'->>'versao')::int is distinct from v_sver then raise exception 'resumo_versao_mudou' using errcode = 'P0001'; end if;
    insert into public.obs_archive_summaries (site_id, class, channel_ref, month, version, empty, canal_sha256, canal_bytes, canal_rows,
           video_sha256, video_bytes, video_rows, unit_hashes, received_at)
    values (p_site, v_class, v_ref, v_month, v_sver, (p_body->'resumo'->>'vazio')::boolean,
            p_body->'resumo'->>'canal_sha256', (p_body->'resumo'->>'canal_bytes')::bigint, (p_body->'resumo'->>'canal_rows')::int,
            p_body->'resumo'->>'video_sha256', (p_body->'resumo'->>'video_bytes')::bigint, (p_body->'resumo'->>'video_rows')::int,
            (select jsonb_object_agg('u:' || c.id, c.hash_conteudo) from public.obs_archive_current_units(p_site, v_class, v_month) c where c.channel_ref = v_ref),
            case when (p_body->'resumo'->>'vazio')::boolean then now() end)
    returning id into v_sid;
    insert into public.obs_archive_absence (site_id, alvo, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256)
    select p_site, 'item:' || p_item, v_filho, v_class || '/canais/' || v_ref || '/resumo/' || to_char(v_month, 'YYYY-MM') || '.v' || s.version || '.' || k.papel || '.csv.gz', false,
           k.sha, v_class || '/canais/' || v_ref || '/resumo/' || to_char(v_month, 'YYYY-MM') || '.v' || v_sver || '.' || k.papel || '.csv.gz',
           case k.papel when 'canal' then p_body->'resumo'->>'canal_sha256' else p_body->'resumo'->>'video_sha256' end
      from public.obs_archive_summaries s
      cross join lateral (values ('canal', s.canal_sha256), ('video', s.video_sha256)) k(papel, sha)
     where s.site_id = p_site and s.class = v_class and s.channel_ref = v_ref and s.month = v_month and s.version < v_sver and k.sha is not null
       and (case k.papel when 'canal' then p_body->'resumo'->>'canal_sha256' else p_body->'resumo'->>'video_sha256' end) is not null
    on conflict (site_id, alvo, filho, prefixo) do nothing;
    v_res := jsonb_build_object('arquivo_id', 's:' || v_sid, 'versao', v_sver);
  end if;
  return jsonb_build_object('status', 'registrado', 'unidades', v_saida, 'resumo', v_res);
end $$;
revoke all on function public.obs_archive_expurgo_record(uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_expurgo_record(uuid, bigint, jsonb) to service_role;

-- o Mac não conseguiu reescrever (arquivo antigo ausente ou diferente no NAS, ou grande demais para o pipe): o alvo fica bloqueado, à vista
create or replace function public.obs_archive_expurgo_block(p_site uuid, p_item bigint, p_alvo bigint, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_motivo not in ('antiga_ausente', 'antiga_divergente', 'grande_demais') then raise exception 'motivo_invalido' using errcode = 'P0001'; end if;
  update public.obs_archive_item_targets set estado = 'bloqueado', motivo = p_motivo, updated_at = now()
   where id = p_alvo and site_id = p_site and item_id = p_item and estado = 'copiar';
  if not found then raise exception 'alvo_fora_de_copiar' using errcode = 'P0001'; end if;
  return jsonb_build_object('status', 'bloqueado', 'alvo_id', p_alvo, 'motivo', p_motivo);
end $$;
revoke all on function public.obs_archive_expurgo_block(uuid, bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.obs_archive_expurgo_block(uuid, bigint, bigint, text) to service_role;

-- o dono resolveu o bloqueio (restaurou o arquivo antigo no NAS): volta a copiar. SQL do painel (05 §16), como a retenção.
create or replace function public.obs_archive_expurgo_unblock(p_site uuid, p_alvo bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.obs_archive_item_targets set estado = 'copiar', motivo = null, updated_at = now()
   where id = p_alvo and site_id = p_site and estado = 'bloqueado' and motivo in ('antiga_ausente', 'antiga_divergente', 'grande_demais');
  if not found then raise exception 'alvo_nao_desbloqueavel' using errcode = 'P0001'; end if;
  return jsonb_build_object('status', 'copiar', 'alvo_id', p_alvo);
end $$;
revoke all on function public.obs_archive_expurgo_unblock(uuid, bigint) from public, anon, authenticated, service_role;
```

**O manifesto** não sai do Mac (desvio declarado ao item 66, que diz "na mesma execução"): `obs_archive_manifest_rows` exige as unidades do mês terminais (`m3b.sql:1150`), e a unidade nova só fica terminal quando o copiador a recebe. O manifesto não carrega linha nem id de vídeo (`manifesto-mensal.ts:1`, "Nunca nome de canal nem id do YouTube"), e é montado em TypeScript pela rota C5 a partir do registro; a M9 só garante que o mês volte ao ciclo de selagem (Tarefa 5) e põe a versão anterior do manifesto na lista de apagamento depois de a nova estar recebida. O teste da Tarefa 5 `manifesto novo aponta para a unidade nova` prova o item 120 nessa parte.

- [ ] **Passo 4.** Rodar → PASS.

- [ ] **Passo 5. Commit** (quando mandado): `git add -- apps/web/test/integration/manutencao-m9-registrar.test.ts`; `git commit -m "feat: M9 parte 3: abrir e registrar o expurgo pela exceção da M3b (rascunho)" -- supabase/rascunhos/m9.sql apps/web/test/integration/manutencao-m9-registrar.test.ts`.

---

### Task 4: SQL parte 4, a prova de ausência, os marcos da remoção, a retenção e o reaparecimento

**Files:**
- Modify: `supabase/rascunhos/m9.sql` (`-- M9 PARTE 4:`)
- Create: `apps/web/test/integration/manutencao-m9-ausencia.test.ts`

**Interfaces:**
- Consumes: `obs_archive_absence`, `obs_archive_snapshot_retention` (Tarefa 1); `obs_archive_channel_removals` (M3b, `m3b.sql:204-222`); `obs_archive_b2_runs` (`m3b.sql:225-246`: `estado`, `expires_at`, `canary_ok`); `obs_archive_agora()` e `obs_archive_hoje_sp()` (relógio testável da M3b); `obs_archive_batches` (E10: `channel_ref`, `deleted_at`, `closed_at`).
- Produces:
  - coluna `obs_archive_absence.liberado_em timestamptz` (o site só pergunta pelo que já pode sumir);
  - `obs_archive_registrar_retencao_snapshot(p_site uuid, p_dias integer) returns jsonb` (só `postgres`: SQL do painel);
  - `obs_archive_removal_targets(p_site uuid) returns integer` (interna: deriva os prefixos `<classe>/canais/<ref>/` das remoções `apagar`);
  - `obs_archive_prefixos_ausentes(p_site uuid, p_fonte text) returns jsonb` → `[{ alvo, filho, prefixo, e_prefixo }]` (até 2.000, ordem estável) (interna; os planos a chamam);
  - `obs_archive_attest_prefixos(p_site uuid, p_fonte text, p_body jsonb) returns jsonb` → `{ prefixos: [{ alvo, filho, prefixo, resposta: 'aceito' | 'recusado', motivo? }] }` (`grant` a `service_role`; a rota `attest` chama);
  - `obs_archive_removal_advance(p_site uuid) returns integer` (interna);
  - `obs_archive_plan` e `obs_archive_b2_plan` passam a devolver `prefixos_ausentes` preenchido (injeção na âncora `'prefixos_ausentes', '[]'`/`prefixos_ausentes: []`, com guarda de md5 do corpo da M3b);
  - `obs_archive_removed_channel_list` com os estados `apagado_nas`, `apagado_b2`, `concluido` e as chaves novas `nas_last_absent_at`, `marcado_rodado_em`, `retencao_registrada`, `lote_e10_aberto`, `prefixos_total`, `prefixos_ausentes_nas`.

**O que acontece quando o dado não existe:** remoção `apagar` sem unidade, resumo nem anexo: nenhum prefixo derivado; a lista já a mostra `sem_arquivo` (M3b) e a M9 a conclui sem prova de arquivo (nada a provar), mas **só** com blobs vazios, imagens resolvidas e sem lote da E10 aberto. Filho desmontado ou sem sentinela: `prefixo_ausente` é recusado (`filho_fora`), nunca conta. Execução do B2 sem `controle_ok`, vencida ou de outro site: tudo recusado (`controle_pendente`). Sem retenção registrada: `snapshots_clear_on` nulo, a remoção fica em `apagado_nas`. Lote da E10 sem `closed_at` nem `deleted_at`: não conclui.

- [ ] **Passo 1. Testes, falhando** (`aplicarM9(c, 4)`; relógio por `set_config('obs_archive.agora', ...)` como a M3b faz no `obs_archive_agora()`; semente: canal removido com `archive_decision 'apagar'`, unidades em `serie` e `texto`):

| Teste | Afirma |
|---|---|
| `prefixos derivados do registro` | duas linhas `canal:<ref>`: `serie/canais/<ref>/` (filho `numerico`) e `texto/canais/<ref>/` (filho `texto`), `e_prefixo = true`; canal só com `serie`: uma linha (alvo derivado, nunca lista fixa de classes; `02` §10.5) |
| `plano do copiador traz prefixos_ausentes` | `obs_archive_plan(site, false, null)->'prefixos_ausentes'` = as duas linhas; sem remoção aberta: `[]` |
| `ausente_sem_sentinela_nao_conta` (Review Focus 4) | `attest_prefixos('nas', {filhos: {numerico: {montado: true, sentinela: false}}, prefixos: [...]})`: `recusado/filho_fora`; nenhum marco gravado |
| `duas conferências com 11 h` | primeira `prefixo_ausente`: `nas_absent_first_at` gravado, `nas_absent_at` nulo; segunda com +10 h: ainda nulo; terceira com +11 h: `nas_absent_at` gravado; com todos os prefixos assim, a remoção ganha `nas_absent_at` e o estado `apagado_nas` |
| `sem_retencao_para_em_apagado_nas` (Review Focus 4) | sem linha de retenção: `snapshots_clear_on` nulo; mesmo com o B2 ausente, o estado fica `apagado_nas` e `retencao_registrada = false` na lista |
| `retenção registrada recalcula` | `obs_archive_registrar_retencao_snapshot(site, 14)`: `snapshots_clear_on` = dia de SP de `nas_absent_at` + 14 |
| `b2_sem_canario_nao_conta` (Review Focus 4) | execução com `estado 'aguardando_controle'`: `recusado/controle_pendente`; com `controle_ok` mas `expires_at` no passado: idem |
| `B2 antes dos snapshots não conclui` | `prefixo_ausente` do B2 com `b2_checked_at` antes de `snapshots_clear_on`: a remoção não vai a `apagado_b2`; a mesma resposta num dia ≥ `snapshots_clear_on`: vai |
| `concluido com tudo` | NAS e B2 provados depois de `snapshots_clear_on`, `blobs_pending = '{}'`, `online_thumbs_known = true`, nenhum lote E10 aberto: `completed_at` gravado, estado `concluido` |
| `lote E10 aberto segura` | uma linha de `obs_archive_batches` do `channel_ref` com `deleted_at` e `closed_at` nulos: não conclui; `lote_e10_aberto = true` |
| `imagens desconhecidas seguram até o ciente` | `online_thumbs_known = false` e `thumbs_unknown_ack_at` nulo: não conclui |
| `prefixo_presente_reabre_e_conta` (Review Focus 2) | depois de `apagado_nas`, um `prefixo_presente`: `nas_absent_at`, `b2_absent_at`, `snapshots_clear_on` e `completed_at` voltam a nulo; `reappeared_at` gravado; `reappeared_count` + 1; estado `pedido` |
| `item: só pergunta o que foi liberado` | linhas `item:<id>` com `liberado_em` nulo não saem em `prefixos_ausentes`; `attest` delas: `recusado/desconhecido` |
| `B2 só depois do NAS` | `obs_archive_prefixos_ausentes(site, 'b2')` só traz linhas com `nas_absent_at` preenchido |
| `md5 da M3b mudou` | corpo de `obs_archive_plan` diferente do esperado: a parte 4 falha `m9_m3b_mudou` |
| `estado novo na lista não quebra a M3b` | `obs_archive_owner_pending` da M3b (antes da Tarefa 5) continua listando só `pedido` como `sem_comando`; remoção `apagado_nas` não aparece lá |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. A parte 4** (o essencial; as injeções nos planos seguem o molde da Tarefa 2, com os md5 dos corpos da M3b lidos no banco local depois de `aplicarM3b`, anotados no ledger e conferidos de novo na Tarefa 10 contra produção):

```sql
-- M9 PARTE 4: prova de ausência, marcos da remoção, retenção, reaparecimento (02 §11.3, tabela de estados; D-M9-8, D-M9-9)
alter table public.obs_archive_absence add column if not exists liberado_em timestamptz;

create or replace function public.obs_archive_registrar_retencao_snapshot(p_site uuid, p_dias integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_dias is null or p_dias < 1 or p_dias > 365 then raise exception 'dias_invalidos' using errcode = 'P0001'; end if;
  insert into public.obs_archive_snapshot_retention (site_id, dias) values (p_site, p_dias)
  on conflict (site_id) do update set dias = excluded.dias, registrado_em = now();
  update public.obs_archive_channel_removals
     set snapshots_clear_on = (nas_absent_at at time zone 'America/Sao_Paulo')::date + p_dias
   where site_id = p_site and nas_absent_at is not null and completed_at is null;
  return jsonb_build_object('dias', p_dias);
end $$;
revoke all on function public.obs_archive_registrar_retencao_snapshot(uuid, integer) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_removal_targets(p_site uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.obs_archive_absence (site_id, alvo, filho, prefixo, e_prefixo, liberado_em)
  select r.site_id, 'canal:' || r.channel_ref, pol.filho, x.class || '/canais/' || r.channel_ref || '/', true, now()
    from public.obs_archive_channel_removals r
    cross join lateral (select u.class from public.obs_archive_units u where u.site_id = r.site_id and u.channel_ref = r.channel_ref
                        union select s.class from public.obs_archive_summaries s where s.site_id = r.site_id and s.channel_ref = r.channel_ref) x
    join (select distinct p.class, p.filho from public.obs_archive_policy() p) pol on pol.class = x.class
   where r.site_id = p_site and r.archive_decision = 'apagar' and r.completed_at is null
  on conflict (site_id, alvo, filho, prefixo) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.obs_archive_removal_targets(uuid) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_prefixos_ausentes(p_site uuid, p_fonte text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('alvo', a.alvo, 'filho', a.filho, 'prefixo', a.prefixo, 'e_prefixo', a.e_prefixo)
                            order by a.alvo, a.filho, a.prefixo), '[]'::jsonb)
    from (select a.* from public.obs_archive_absence a
           where a.site_id = p_site and a.liberado_em is not null
             and (p_fonte = 'nas' or a.nas_absent_at is not null)
             and not exists (select 1 from public.obs_archive_channel_removals r
                              where a.alvo = 'canal:' || r.channel_ref and r.site_id = p_site and r.completed_at is not null)
             and not exists (select 1 from public.obs_archive_item_targets t
                              where a.alvo = 'item:' || t.item_id and t.site_id = p_site
                              group by t.item_id having bool_and(t.done_at is not null))
           order by a.alvo, a.filho, a.prefixo limit 2000) a
$$;
revoke all on function public.obs_archive_prefixos_ausentes(uuid, text) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_attest_prefixos(p_site uuid, p_fonte text, p_body jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  x jsonb; a record; v_ok boolean := true; v_res jsonb := '[]'::jsonb; v_agora timestamptz := public.obs_archive_agora();
  v_resp jsonb;
begin
  if p_fonte not in ('nas', 'b2') then raise exception 'fonte_invalida' using errcode = 'P0001'; end if;
  if p_fonte = 'b2' then   -- C7.2: só com controle negativo e os dois canários bons na mesma execução, dentro do prazo
    select r.estado = 'controle_ok' and r.expires_at > v_agora
      into v_ok from public.obs_archive_b2_runs r where r.id = (p_body->>'execucao_id')::uuid and r.site_id = p_site;
    v_ok := coalesce(v_ok, false);
  end if;
  for x in select * from jsonb_array_elements(coalesce(p_body->'prefixos', '[]'::jsonb)) loop
    select * into a from public.obs_archive_absence
     where site_id = p_site and alvo = x->>'alvo' and filho = x->>'filho' and prefixo = x->>'prefixo' for update;
    v_resp := jsonb_build_object('alvo', x->>'alvo', 'filho', x->>'filho', 'prefixo', x->>'prefixo', 'resposta', 'recusado');
    if not found or a.liberado_em is null then v_res := v_res || jsonb_build_array(v_resp || '{"motivo":"desconhecido"}'); continue; end if;
    if not v_ok then v_res := v_res || jsonb_build_array(v_resp || '{"motivo":"controle_pendente"}'); continue; end if;
    if p_fonte = 'nas' and not (coalesce((p_body->'filhos'->a.filho->>'montado')::boolean, false)
                                and coalesce((p_body->'filhos'->a.filho->>'sentinela')::boolean, false)) then
      v_res := v_res || jsonb_build_array(v_resp || '{"motivo":"filho_fora"}'); continue;
    end if;
    if x->>'resultado' = 'prefixo_ausente' and p_fonte = 'nas' then
      update public.obs_archive_absence
         set nas_absent_first_at = coalesce(nas_absent_first_at, v_agora),
             nas_absent_at = case when nas_absent_at is null and nas_absent_first_at is not null
                                       and v_agora - nas_absent_first_at >= interval '11 hours' then v_agora else nas_absent_at end,
             nas_last_absent_at = v_agora
       where id = a.id;
    elsif x->>'resultado' = 'prefixo_ausente' then
      update public.obs_archive_absence set b2_absent_at = coalesce(b2_absent_at, v_agora), b2_checked_at = v_agora where id = a.id;
    elsif x->>'resultado' = 'prefixo_presente' and p_fonte = 'nas' then
      update public.obs_archive_absence set nas_present_at = v_agora, nas_absent_first_at = null, nas_absent_at = null,
             nas_last_absent_at = null, b2_absent_at = null where id = a.id;
      perform public.obs_archive_reabrir(p_site, a.alvo);
    elsif x->>'resultado' = 'prefixo_presente' then
      update public.obs_archive_absence set b2_present_at = v_agora, b2_absent_at = null, b2_checked_at = v_agora where id = a.id;
      perform public.obs_archive_reabrir(p_site, a.alvo);
    elsif x->>'resultado' = 'sem_acesso' and p_fonte = 'b2' then
      null;                                            -- nada conta; a execução seguinte pergunta de novo
    else
      v_res := v_res || jsonb_build_array(v_resp || '{"motivo":"forma"}'); continue;
    end if;
    v_res := v_res || jsonb_build_array(v_resp || '{"resposta":"aceito"}');
  end loop;
  perform public.obs_archive_removal_advance(p_site);
  perform public.obs_archive_item_advance(p_site);   -- Tarefa 5 (a parte 4 cria um corpo vazio que a parte 5 substitui)
  return jsonb_build_object('prefixos', v_res);
end $$;
revoke all on function public.obs_archive_attest_prefixos(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.obs_archive_attest_prefixos(uuid, text, jsonb) to service_role;

create or replace function public.obs_archive_reabrir(p_site uuid, p_alvo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_alvo like 'canal:%' then
    update public.obs_archive_channel_removals
       set nas_absent_first_at = null, nas_absent_at = null, b2_absent_at = null, snapshots_clear_on = null, completed_at = null,
           reappeared_at = public.obs_archive_agora(), reappeared_count = reappeared_count + 1
     where site_id = p_site and 'canal:' || channel_ref = p_alvo and (nas_absent_at is not null or completed_at is not null);
  elsif p_alvo like 'item:%' then
    update public.obs_archive_item_targets set estado = 'apagar_antigas', done_at = null, updated_at = now()
     where site_id = p_site and 'item:' || item_id = p_alvo and estado in ('conferir_b2', 'concluido');
  end if;
end $$;
revoke all on function public.obs_archive_reabrir(uuid, text) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_removal_advance(p_site uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0; v_dias integer; v_hoje date := public.obs_archive_hoje_sp();
begin
  perform public.obs_archive_removal_targets(p_site);
  select s.dias into v_dias from public.obs_archive_snapshot_retention s where s.site_id = p_site;
  for r in select x.* from public.obs_archive_channel_removals x
            where x.site_id = p_site and x.archive_decision = 'apagar' and x.completed_at is null for update loop
    with a as (select * from public.obs_archive_absence where site_id = p_site and alvo = 'canal:' || r.channel_ref)
    update public.obs_archive_channel_removals c
       set nas_absent_first_at = case when (select bool_and(a.nas_absent_at is not null) from a) then (select min(a.nas_absent_first_at) from a) end,
           nas_absent_at = case when (select bool_and(a.nas_absent_at is not null) from a) then coalesce(c.nas_absent_at, (select max(a.nas_absent_at) from a)) end,
           nas_last_absent_at = (select min(a.nas_last_absent_at) from a),
           snapshots_clear_on = case when (select bool_and(a.nas_absent_at is not null) from a) and v_dias is not null
                                     then (coalesce(c.nas_absent_at, (select max(a.nas_absent_at) from a)) at time zone 'America/Sao_Paulo')::date + v_dias end,
           b2_absent_at = case when c.snapshots_clear_on is not null
                                    and (select bool_and(a.b2_absent_at is not null and (a.b2_checked_at at time zone 'America/Sao_Paulo')::date >= c.snapshots_clear_on) from a)
                               then coalesce(c.b2_absent_at, public.obs_archive_agora()) end
     where c.site_id = p_site and c.channel_ref = r.channel_ref;
    update public.obs_archive_channel_removals c set completed_at = public.obs_archive_agora()
     where c.site_id = p_site and c.channel_ref = r.channel_ref and c.completed_at is null
       and ((c.nas_absent_at is not null and c.b2_absent_at is not null and c.snapshots_clear_on <= v_hoje)
            or not exists (select 1 from public.obs_archive_absence a where a.site_id = p_site and a.alvo = 'canal:' || c.channel_ref))
       and cardinality(c.blobs_pending) = 0
       and (c.online_thumbs_known or c.thumbs_unknown_ack_at is not null)
       and not exists (select 1 from public.obs_archive_batches b where b.site_id = p_site and b.channel_ref = c.channel_ref
                        and b.deleted_at is null and b.closed_at is null);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.obs_archive_removal_advance(uuid) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_item_advance(p_site uuid) returns integer
language sql security definer set search_path = '' as $$ select 0 $$;   -- corpo de verdade na parte 5
revoke all on function public.obs_archive_item_advance(uuid) from public, anon, authenticated, service_role;
```

Mais três blocos `do $$ … $$` na parte 4, cada um com o md5 do corpo da M3b conferido antes (`m9_m3b_mudou`) e uma troca só:
1. `obs_archive_plan`: âncora `'prefixos_ausentes', '[]'::jsonb` (ler a forma exata em `m3b.sql:2377` no dia) → `'prefixos_ausentes', public.obs_archive_prefixos_ausentes(p_site, 'nas')`; e, no começo do corpo (âncora `begin` seguida da primeira linha do corpo), `perform public.obs_archive_removal_advance(p_site); perform public.obs_archive_item_advance(p_site);`.
2. `obs_archive_b2_plan`: âncora `'prefixos_ausentes','[]'` (`m3b.sql:1761`) → `'prefixos_ausentes', public.obs_archive_prefixos_ausentes(p_site, 'b2')`.
3. `obs_archive_removed_channel_list`: âncora `else 'pedido' end,` (`m3b.sql:2571`) → `when r.completed_at is not null then 'concluido' when r.b2_absent_at is not null then 'apagado_b2' when r.nas_absent_at is not null then 'apagado_nas' else 'pedido' end,`; âncora `'thumbs_unknown_ack_at', r.thumbs_unknown_ack_at,` → a mesma seguida de `'nas_last_absent_at', r.nas_last_absent_at, 'marcado_rodado_em', r.marcado_rodado_em, 'retencao_registrada', exists (select 1 from public.obs_archive_snapshot_retention z where z.site_id = p_site), 'lote_e10_aberto', exists (select 1 from public.obs_archive_batches b where b.site_id = p_site and b.channel_ref = f.channel_ref and b.deleted_at is null and b.closed_at is null), 'prefixos_total', (select count(*) from public.obs_archive_absence a where a.site_id = p_site and a.alvo = 'canal:' || f.channel_ref), 'prefixos_ausentes_nas', (select count(*) from public.obs_archive_absence a where a.site_id = p_site and a.alvo = 'canal:' || f.channel_ref and a.nas_absent_at is not null),`.

- [ ] **Passo 4.** Rodar → PASS.

- [ ] **Passo 5. Commit** (quando mandado): `git add -- apps/web/test/integration/manutencao-m9-ausencia.test.ts`; `git commit -m "feat: M9 parte 4: prova de ausência no NAS e no B2, marcos da remoção, retenção e reaparecimento (rascunho)" -- supabase/rascunhos/m9.sql apps/web/test/integration/manutencao-m9-ausencia.test.ts`.

---

### Task 5: SQL parte 5, o avanço dos itens, as versões superadas de texto e as pendências na `versao 2`

**Files:**
- Modify: `supabase/rascunhos/m9.sql` (`-- M9 PARTE 5:`)
- Create: `apps/web/test/integration/manutencao-m9-pendencias.test.ts`

**Interfaces:**
- Consumes: partes 1 a 4; `obs_archive_b2_files.last_ok_at` (`m3b.sql:247`); `obs_archive_months.manifest_*` (`m3b.sql:113-133`); `obs_archive_removed_channel_list` na forma da parte 4.
- Produces:
  - `obs_archive_item_advance(p_site uuid) returns integer` (corpo de verdade);
  - gatilho `obs_archive_manifesto_antigo` (antes de `update of manifest_version` em `obs_archive_months`): põe a versão anterior do manifesto na lista de apagamento de cada item aberto do (classe, mês), com a `nova`;
  - injeção em `obs_archive_record_core`: unidade com alvo em `copiar` ou `aguardando_nova` e origem diferente de `expurgo` → `{ status: 'expurgo_em_curso' }` (C3 ganha a linha; o copiador pula, como `nao_devida`);
  - `obs_archive_marcar_rodado(p_site uuid, p_item_id text, p_actor uuid, p_desfazer boolean) returns jsonb` (`grant` a `service_role`; a server action chama depois de `requireSiteAdmin`);
  - `obs_archive_owner_pending(p_site uuid default null) returns jsonb` na `versao 2` (C12 r2.6): cada item `{ item_id: 'canal:<uuid>' | 'item:<id>' | 'antiga:<uuid>', kind: 'canal' | 'video' | 'comentario' | 'versao', tempo, falta, motivo, desde, mes, channel_ref, youtube_id, marcado_rodado_em, apagar: [{ filho, caminho, sha256, nova }], b2_nomes: ['<filho>/<caminho ou prefixo>'], prefixos: ['<classe>/canais/<ref>/'] }`.

**O que acontece quando o dado não existe:** nenhum item e nenhuma remoção aberta: `{ versao: 2, lido_em, total: 0, itens: [] }` (zero medido). Alvo cujo arquivo novo ainda não foi recebido: `sem_comando` com `falta: 'copiador'` (nunca `apagar_antigas`: a única cópia antiga nunca sai antes). Versão superada de texto sem conferência do B2 da versão nova: não entra (o prazo de 30 dias conta da última das duas atestações). Remoção sem retenção registrada: `sem_comando`, `falta: 'retencao'`. Erro em qualquer leitura interna: a função sobe o erro (nunca `itens: []`).

- [ ] **Passo 1. Testes, falhando** (`aplicarM9(c, 5)`; sementes das Tarefas 3 e 4):

| Teste | Afirma |
|---|---|
| `zero medido` | site sem item nem remoção: `versao = 2`, `total = 0`, `itens = []` |
| `copiar primeiro` | item recém-apagado com alvo em `copiar`: um item `item:<id>`, `tempo 'copiar'`, `apagar = []`, `b2_nomes = []` (item 66: a primeira chamada só copia) |
| `antiga_so_sai_depois_da_nova_conferida` (Review Focus 1) | depois do `record`: `sem_comando`/`falta 'copiador'`; com a unidade nova recebida e atestada no NAS mas sem `b2_files.last_ok_at`: `falta 'b2_nova'`; com o B2 da nova, o resumo novo recebido e o manifesto recebido depois da unidade nova: `apagar_antigas`, com `apagar` = todas as versões anteriores da unidade, das partes e do resumo, e a versão anterior do manifesto, cada uma com `sha256` e `nova` |
| `apagar_antigas_recusa_sem_b2_ok` (Review Focus 1) | unidade nova `recebida` e atestada no NAS, `b2_files.last_ok_at` nulo (ou de antes do `recebida`): `obs_archive_apagar_do_alvo` devolve `[]` e o item fica em `sem_comando`/`falta 'b2_nova'`; versão antiga com `nas_absent_at` gravado à mão sem a nova no B2 não avança para `conferir_b2` |
| `versão antiga sai da reconferência` | ao passar a `apagar_antigas`, as versões anteriores da unidade e do resumo ganham `superseded_at`; `obs_archive_plan(...)->'reconferir'` não as traz (sem `arquivo_ausente` depois do `rm`) |
| `reexport do site espera o expurgo` | `obs_archive_record_core(site, 'unidade', <payload da rota>, null)` de uma unidade com alvo em `copiar`: `status 'expurgo_em_curso'`, nada gravado |
| `já rodei e a reconferência que ainda acha` (item 111) | `marcar_rodado('item:<id>')`: `marcado_rodado_em` gravado, o tempo continua `apagar_antigas` até a primeira conferência; conferência `prefixo_ausente` em todas: `sem_comando`/`falta 'segunda_conferencia'`; uma `prefixo_presente` depois da marca: volta a `apagar_antigas` com o mesmo `marcado_rodado_em` (a tela pinta âmbar) |
| `desfazer` | `marcar_rodado(..., p_desfazer := true)`: `marcado_rodado_em` nulo |
| `conferir_b2 do item` | todas as linhas do item com `nas_absent_at` e alguma sem `b2_absent_at`: `tempo 'conferir_b2'`, `b2_nomes` = `'<filho>/<caminho>'` de cada uma, `apagar = []` |
| `item concluído desliga archive_pending` (item 65) | todas as linhas com NAS e B2 provados: alvos `concluido`, `competitor_removed_items.archive_pending = false`, `archive_note = 'arquivo limpo'`; o item sai das pendências |
| `canal pedido` | remoção `apagar` sem prova: `canal:<ref>`, `tempo 'apagar_antigas'`, `apagar` = cada arquivo do registro do canal (unidades em todas as versões, partes, resumos) com `sha256` e `nova = null`, `prefixos` = os da parte 4 |
| `canal no NAS, B2 antes da conferência recente` | `apagado_nas`, retenção registrada, hoje ≥ `snapshots_clear_on`, B2 ainda presente, `nas_last_absent_at` de 30 h atrás: `sem_comando`/`falta 'conferencia_nas_recente'`; com 2 h: `conferir_b2` com `b2_nomes` dos prefixos |
| `canal sem retenção` | `sem_comando`/`falta 'retencao'` |
| `canal apagado_b2 segurado pelos blobs` | `blobs_pending` não vazio: `sem_comando`/`falta 'blobs'`; lote E10 aberto: `falta 'lote_e10'` |
| `item bloqueado` | alvo `depende_m10b`: `tempo 'bloqueado'`, `motivo 'depende_m10b'` |
| `texto superado aos 30 dias` (item 110) | unidade `texto` v1 superada pela v2 (reexportação comum), v2 com `nas_attested_at` e `b2_files.last_ok_at` há 31 dias: item `antiga:<id da v1>`, `kind 'versao'`, `apagar_antigas` com a v1; há 29 dias: não aparece; classe `serie` superada sem item removido: nunca aparece |
| `canal removido não vira versão superada` | unidade de canal com remoção registrada: não gera `antiga:` (`02` §11.3) |
| `forma do C12 v2` | cada item com as 13 chaves; `apagar` só em `apagar_antigas` e não vazio lá; `b2_nomes` só em `conferir_b2` e não vazio lá; `total` = tamanho |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. A parte 5:**

```sql
-- M9 PARTE 5: avanço dos itens, versões superadas de texto, já rodei e as pendências na versao 2 (C12 r2.6)
create or replace function public.obs_archive_item_advance(p_site uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer := 0; v_agora timestamptz := public.obs_archive_agora();
begin
  -- 1. a nova está recebida, atestada no NAS e conferida no B2; o resumo novo e o manifesto seguinte também: libera o apagar
  with pronto as (
    select t.id, t.item_id, t.class, t.table_name, t.channel_ref, t.month, t.to_version from public.obs_archive_item_targets t
      join public.obs_archive_units u on u.id = t.to_unit_id
     where t.site_id = p_site and t.estado = 'aguardando_nova'
       and u.received_at is not null and u.nas_attested_at is not null
       and exists (select 1 from public.obs_archive_b2_files f where f.site_id = p_site and f.arquivo_id = 'u:' || u.id and f.last_ok_at is not null)
       and (select s.received_at from public.obs_archive_summaries s where s.site_id = p_site and s.class = t.class and s.channel_ref = t.channel_ref
             and s.month = t.month order by s.version desc limit 1) is not null
       and exists (select 1 from public.obs_archive_months m where m.site_id = p_site and m.class = t.class and m.month = t.month
                    and m.manifest_received_at is not null and m.manifest_received_at > u.received_at)
  ), feito as (
    update public.obs_archive_item_targets t set estado = 'apagar_antigas', updated_at = now() from pronto p where t.id = p.id returning t.*
  ), sup as (
    update public.obs_archive_units o set superseded_at = coalesce(o.superseded_at, v_agora)
      from feito f where o.site_id = p_site and o.class = f.class and o.table_name = f.table_name and o.channel_ref = f.channel_ref
                     and o.month = f.month and o.version < f.to_version returning 1
  )
  update public.obs_archive_summaries s set superseded_at = coalesce(s.superseded_at, v_agora)
    from feito f where s.site_id = p_site and s.class = f.class and s.channel_ref = f.channel_ref and s.month = f.month
                   and s.version < (select max(z.version) from public.obs_archive_summaries z where z.site_id = p_site and z.class = f.class
                                     and z.channel_ref = f.channel_ref and z.month = f.month);
  -- 2. libera a lista do item quando nenhum alvo dele espera cópia
  update public.obs_archive_absence a set liberado_em = v_agora
   where a.site_id = p_site and a.liberado_em is null and a.alvo like 'item:%'
     and not exists (select 1 from public.obs_archive_item_targets t where t.site_id = p_site and 'item:' || t.item_id = a.alvo
                      and t.estado in ('copiar', 'aguardando_nova'));
  -- 3. NAS provado em todas as linhas do item: conferir_b2; B2 também: concluido
  update public.obs_archive_item_targets t set estado = 'conferir_b2', updated_at = now()
   where t.site_id = p_site and t.estado = 'apagar_antigas'
     and not exists (select 1 from public.obs_archive_absence a where a.site_id = p_site and a.alvo = 'item:' || t.item_id and a.nas_absent_at is null);
  update public.obs_archive_item_targets t set estado = 'concluido', done_at = v_agora, updated_at = now()
   where t.site_id = p_site and t.estado = 'conferir_b2'
     and not exists (select 1 from public.obs_archive_absence a where a.site_id = p_site and a.alvo = 'item:' || t.item_id and a.b2_absent_at is null);
  get diagnostics n = row_count;
  -- 4. archive_pending derivado (D-M9-2): o último alvo fechado desliga a coluna
  --    vídeo: pelo próprio item; comentário: pelo grupo do canal (as linhas irmãs da mesma transação não têm item_id nos alvos;
  --    com outro grupo aberto do mesmo canal, ficam pendentes: erra para o lado de "ainda há o que limpar")
  update public.competitor_removed_items i set archive_pending = false, archive_note = 'arquivo limpo'
   where i.site_id = p_site and i.archive_pending
     and ((i.kind = 'video'
           and exists (select 1 from public.obs_archive_item_targets t where t.site_id = p_site and t.item_id = i.id)
           and not exists (select 1 from public.obs_archive_item_targets t where t.site_id = p_site and t.item_id = i.id and t.done_at is null))
       or (i.kind = 'comentario'
           and exists (select 1 from public.obs_archive_item_targets t where t.site_id = p_site and t.item_key = 'comentarios:' || i.competitor_channel_id::text)
           and not exists (select 1 from public.obs_archive_item_targets t where t.site_id = p_site
                            and t.item_key = 'comentarios:' || i.competitor_channel_id::text and t.done_at is null)));
  -- 5. versão superada de texto: 30 dias depois de a seguinte estar atestada no NAS e conferida no B2 (02 §11.3; item 110)
  insert into public.obs_archive_absence (site_id, alvo, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256, liberado_em)
  select p_site, 'antiga:' || o.id, 'texto', public.obs_archive_caminho_unidade(o.class, o.channel_ref, o.table_name, o.month, o.version, null), false,
         o.sha256_bytes, public.obs_archive_caminho_unidade(nx.class, nx.channel_ref, nx.table_name, nx.month, nx.version, null), nx.sha256_bytes, v_agora
    from public.obs_archive_units o
    join lateral (select x.* from public.obs_archive_units x where x.site_id = o.site_id and x.class = o.class and x.table_name = o.table_name
                    and x.channel_ref = o.channel_ref and x.month = o.month and x.version > o.version and x.received_at is not null
                  order by x.version desc limit 1) nx on true
    join public.obs_archive_b2_files f on f.site_id = p_site and f.arquivo_id = 'u:' || nx.id and f.last_ok_at is not null
   where o.site_id = p_site and o.class = 'texto' and o.superseded_at is not null and o.parts = 1 and o.sha256_bytes is not null
     and nx.nas_attested_at is not null and greatest(nx.nas_attested_at, f.last_ok_at) <= v_agora - interval '30 days'
     and not exists (select 1 from public.obs_archive_channel_removals r where r.site_id = p_site and r.channel_ref = o.channel_ref)
  on conflict (site_id, alvo, filho, prefixo) do nothing;
  return n;
end $$;
revoke all on function public.obs_archive_item_advance(uuid) from public, anon, authenticated, service_role;

create or replace function public.obs_archive_manifesto_antigo() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.manifest_version is not null and new.manifest_version > old.manifest_version and old.manifest_sha256 is not null then
    insert into public.obs_archive_absence (site_id, alvo, filho, prefixo, e_prefixo, sha256, nova_caminho, nova_sha256)
    select new.site_id, 'item:' || t.item_id, pol.filho,
           new.class || '/manifestos/' || to_char(new.month, 'YYYY-MM') || '.v' || old.manifest_version || '.' || k.ext, false, k.sha_old,
           new.class || '/manifestos/' || to_char(new.month, 'YYYY-MM') || '.v' || new.manifest_version || '.' || k.ext, k.sha_new
      from (select distinct t0.item_id from public.obs_archive_item_targets t0
             where t0.site_id = new.site_id and t0.class = new.class and t0.month = new.month and t0.done_at is null and t0.item_id is not null) t
      cross join (select min(p.filho) as filho from public.obs_archive_policy() p where p.class = new.class) pol
      cross join (values ('json', old.manifest_sha256, new.manifest_sha256), ('sha256', old.manifest_list_sha256, new.manifest_list_sha256)) k(ext, sha_old, sha_new)
     where k.sha_old is not null and k.sha_new is not null
    on conflict (site_id, alvo, filho, prefixo) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.obs_archive_manifesto_antigo() from public, anon, authenticated, service_role;
drop trigger if exists obs_archive_manifesto_antigo on public.obs_archive_months;
create trigger obs_archive_manifesto_antigo before update of manifest_version on public.obs_archive_months
  for each row execute function public.obs_archive_manifesto_antigo();

create or replace function public.obs_archive_marcar_rodado(p_site uuid, p_item_id text, p_actor uuid, p_desfazer boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v timestamptz := case when p_desfazer then null else public.obs_archive_agora() end;
begin
  if p_actor is null or not public.obs_archive_is_site_admin(p_site, p_actor) then raise exception 'sem_permissao' using errcode = 'P0001'; end if;
  if p_item_id ~ '^item:[1-9][0-9]{0,18}$' then
    update public.competitor_removed_items set marcado_rodado_em = v where site_id = p_site and id = substr(p_item_id, 6)::bigint;
  elsif p_item_id ~ '^canal:[0-9a-f-]{36}$' then
    update public.obs_archive_channel_removals set marcado_rodado_em = v where site_id = p_site and channel_ref = substr(p_item_id, 7);
  else
    raise exception 'item_invalido' using errcode = 'P0001';
  end if;
  if not found then raise exception 'item_desconhecido' using errcode = 'P0001'; end if;
  return jsonb_build_object('item_id', p_item_id, 'marcado_rodado_em', v);
end $$;
revoke all on function public.obs_archive_marcar_rodado(uuid, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.obs_archive_marcar_rodado(uuid, text, uuid, boolean) to service_role;
```

A injeção em `obs_archive_record_core` (bloco `do $$` com md5, molde da Tarefa 2): âncora `-- a rota não grava o que o plano não pediria (Yannis M17)` (`m3b.sql:642`), inserida **antes** dela:

```sql
    if p_origem is distinct from 'expurgo' and exists (select 1 from public.obs_archive_item_targets t
         where t.site_id = p_site and t.class = v_class and t.table_name = v_table and t.channel_ref = v_channel::text
           and t.month = v_month and t.estado in ('copiar', 'aguardando_nova')) then
      return jsonb_build_object('status', 'expurgo_em_curso');
    end if;
```

A `obs_archive_owner_pending` na `versao 2` (substitui a da M3b; o site é achado do mesmo jeito, `m3b.sql:2717-2724`, copiado sem mudança):

```sql
create or replace function public.obs_archive_owner_pending(p_site uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_site uuid := p_site; v_lista jsonb; v_itens jsonb; v_agora timestamptz := public.obs_archive_agora(); v_hoje date := public.obs_archive_hoje_sp();
begin
  if v_site is null then
    if (select count(*) from (select c.site_id from public.competitor_channels c union select r.site_id from public.obs_archive_channel_removals r
                              union select u.site_id from public.obs_archive_units u) x) <> 1 then raise exception 'site_ambiguo' using errcode = 'P0001'; end if;
    select c.site_id into v_site from (select c0.site_id from public.competitor_channels c0 union select r.site_id from public.obs_archive_channel_removals r
                                       union select u.site_id from public.obs_archive_units u) c;
  end if;
  perform public.obs_archive_removal_advance(v_site);
  perform public.obs_archive_item_advance(v_site);
  v_lista := public.obs_archive_removed_channel_list(v_site);
  if v_lista is null or jsonb_typeof(v_lista) <> 'array' then raise exception 'lista_de_remocao_ilegivel' using errcode = 'P0001'; end if;
  with canal as (
    select 'canal:' || (r->>'channel_ref') as item_id, 'canal'::text as kind, r->>'estado' as estado, r,
           greatest((r->>'decided_at')::timestamptz, (r->>'reappeared_at')::timestamptz) as desde
      from jsonb_array_elements(v_lista) r where r->>'estado' in ('pedido', 'apagado_nas', 'apagado_b2')
  ), canal_tempo as (
    select c.*, case
      when c.estado = 'pedido' then 'apagar_antigas'
      when c.estado = 'apagado_nas' and not (c.r->>'retencao_registrada')::boolean then 'sem_comando'
      when c.estado = 'apagado_nas' and (c.r->>'snapshots_clear_on')::date > v_hoje then 'sem_comando'
      when c.estado = 'apagado_nas' and coalesce((c.r->>'nas_last_absent_at')::timestamptz < v_agora - interval '24 hours', true) then 'sem_comando'
      when c.estado = 'apagado_nas' then 'conferir_b2'
      else 'sem_comando' end as tempo,
      case
      when c.estado = 'pedido' then null
      when c.estado = 'apagado_nas' and not (c.r->>'retencao_registrada')::boolean then 'retencao'
      when c.estado = 'apagado_nas' and (c.r->>'snapshots_clear_on')::date > v_hoje then 'snapshots'
      when c.estado = 'apagado_nas' and coalesce((c.r->>'nas_last_absent_at')::timestamptz < v_agora - interval '24 hours', true) then 'conferencia_nas_recente'
      when c.estado = 'apagado_nas' then null
      when (c.r->>'blobs_pendentes')::int > 0 then 'blobs'
      when not coalesce((c.r->>'online_thumbs_known')::boolean, false) and c.r->>'thumbs_unknown_ack_at' is null then 'imagens'
      when (c.r->>'lote_e10_aberto')::boolean then 'lote_e10'
      else 'b2_sync' end as falta
      from canal c
  ), canal_item as (
    select c.item_id, c.kind, c.tempo, c.falta, null::text as motivo, c.desde, null::text as mes, c.r->>'channel_ref' as channel_ref,
           nullif(c.r->>'youtube_channel_id', '') as youtube_id, (c.r->>'marcado_rodado_em')::timestamptz as marcado,
           case when c.tempo = 'apagar_antigas' then public.obs_archive_arquivos_do_canal(v_site, c.r->>'channel_ref') else '[]'::jsonb end as apagar,
           case when c.tempo = 'conferir_b2' then (select coalesce(jsonb_agg(a.filho || '/' || a.prefixo order by a.filho, a.prefixo), '[]'::jsonb)
                                                     from public.obs_archive_absence a where a.site_id = v_site and a.alvo = c.item_id and a.b2_absent_at is null)
                else '[]'::jsonb end as b2_nomes,
           (select coalesce(jsonb_agg(a.prefixo order by a.prefixo), '[]'::jsonb) from public.obs_archive_absence a where a.site_id = v_site and a.alvo = c.item_id) as prefixos
      from canal_tempo c
  ), it as (
    select i.id, i.kind, i.youtube_id, i.competitor_channel_id, i.decided_at, i.marcado_rodado_em,
           bool_or(t.estado = 'bloqueado') as bloq, min(t.motivo) filter (where t.estado = 'bloqueado') as motivo,
           bool_or(t.estado = 'copiar') as copiar, bool_or(t.estado = 'aguardando_nova') as aguardando,
           bool_or(t.estado = 'apagar_antigas') as apagar, bool_or(t.estado = 'conferir_b2') as b2
      from public.competitor_removed_items i join public.obs_archive_item_targets t on t.site_id = i.site_id and t.item_id = i.id
     where i.site_id = v_site and t.done_at is null
     group by i.id
  ), it_tempo as (
    select it.*, 'item:' || it.id as item_id,
           case when bloq then 'bloqueado' when copiar then 'copiar' when aguardando then 'sem_comando'
                when apagar and exists (select 1 from public.obs_archive_absence a where a.site_id = v_site and a.alvo = 'item:' || it.id
                                         and a.nas_absent_first_at is null) then 'apagar_antigas'
                when apagar then 'sem_comando' when b2 then 'conferir_b2' else 'sem_comando' end as tempo,
           case when bloq or copiar then null
                when aguardando and exists (select 1 from public.obs_archive_item_targets t join public.obs_archive_units u on u.id = t.to_unit_id
                                             where t.item_id = it.id and t.estado = 'aguardando_nova' and u.received_at is null) then 'copiador'
                when aguardando then 'b2_nova'
                when apagar and not exists (select 1 from public.obs_archive_absence a where a.site_id = v_site and a.alvo = 'item:' || it.id
                                             and a.nas_absent_first_at is null) then 'segunda_conferencia'
                else null end as falta
      from it
  ), it_item as (
    select x.item_id, x.kind, x.tempo, x.falta, case when x.tempo = 'bloqueado' then x.motivo end, x.decided_at, null::text,
           x.competitor_channel_id::text, x.youtube_id, x.marcado_rodado_em,
           case when x.tempo = 'apagar_antigas' then public.obs_archive_apagar_do_alvo(v_site, x.item_id) else '[]'::jsonb end,
           case when x.tempo = 'conferir_b2' then (select coalesce(jsonb_agg(a.filho || '/' || a.prefixo order by a.filho, a.prefixo), '[]'::jsonb)
                                                     from public.obs_archive_absence a where a.site_id = v_site and a.alvo = x.item_id and a.b2_absent_at is null)
                else '[]'::jsonb end,
           '[]'::jsonb
      from it_tempo x
  ), antiga as (
    select a.alvo as item_id, 'versao'::text, case when bool_or(a.nas_absent_at is null) then 'apagar_antigas' else 'conferir_b2' end as tempo,
           null::text, null::text, min(a.liberado_em), null::text, min(u.channel_ref), null::text, null::timestamptz,
           case when bool_or(a.nas_absent_at is null) then public.obs_archive_apagar_do_alvo(v_site, a.alvo) else '[]'::jsonb end,
           case when bool_or(a.nas_absent_at is null) then '[]'::jsonb
                else coalesce(jsonb_agg(a.filho || '/' || a.prefixo) filter (where a.b2_absent_at is null), '[]'::jsonb) end,
           '[]'::jsonb
      from public.obs_archive_absence a join public.obs_archive_units u on 'antiga:' || u.id = a.alvo
     where a.site_id = v_site and a.alvo like 'antiga:%'
     group by a.alvo having bool_or(a.b2_absent_at is null)
  ), tudo (item_id, kind, tempo, falta, motivo, desde, mes, channel_ref, youtube_id, marcado, apagar, b2_nomes, prefixos) as (
    select * from canal_item union all select * from it_item union all select * from antiga
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', item_id, 'kind', kind, 'tempo', tempo, 'falta', falta, 'motivo', motivo, 'desde', desde, 'mes', mes,
           'channel_ref', channel_ref, 'youtube_id', youtube_id, 'marcado_rodado_em', marcado,
           'apagar', apagar, 'b2_nomes', b2_nomes, 'prefixos', prefixos) order by desde, item_id), '[]'::jsonb)
    into v_itens from tudo;
  return jsonb_build_object('versao', 2, 'lido_em', now(), 'total', jsonb_array_length(v_itens), 'itens', v_itens);
end $$;
revoke all on function public.obs_archive_owner_pending(uuid) from public, anon, authenticated;
grant execute on function public.obs_archive_owner_pending(uuid) to service_role, postgres;

-- a lista de apagar de um alvo de item ou de versão antiga: as linhas liberadas ainda sem prova no NAS
create or replace function public.obs_archive_apagar_do_alvo(p_site uuid, p_alvo text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('filho', a.filho, 'caminho', a.prefixo, 'sha256', a.sha256,
                                               'nova', case when a.nova_caminho is null then null else jsonb_build_object('caminho', a.nova_caminho, 'sha256', a.nova_sha256) end)
                            order by a.filho, a.prefixo), '[]'::jsonb)
    from public.obs_archive_absence a
   where a.site_id = p_site and a.alvo = p_alvo and not a.e_prefixo and a.liberado_em is not null and a.nas_absent_first_at is null
$$;
revoke all on function public.obs_archive_apagar_do_alvo(uuid, text) from public, anon, authenticated, service_role;

-- todos os arquivos que o registro conhece de um canal removido (unidades em todas as versões, partes, resumos), com o sha256
create or replace function public.obs_archive_arquivos_do_canal(p_site uuid, p_ref text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with pol as (select distinct p.class, p.filho from public.obs_archive_policy() p),
  f as (
    select pol.filho, public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version, null) as caminho, u.sha256_bytes as sha
      from public.obs_archive_units u join pol on pol.class = u.class
     where u.site_id = p_site and u.channel_ref = p_ref and u.parts = 1 and u.sha256_bytes is not null
    union all
    select pol.filho, public.obs_archive_caminho_unidade(u.class, u.channel_ref, u.table_name, u.month, u.version, pt.part), pt.sha256_bytes
      from public.obs_archive_units u join public.obs_archive_unit_parts pt on pt.unit_id = u.id join pol on pol.class = u.class
     where u.site_id = p_site and u.channel_ref = p_ref and u.parts > 1
    union all
    select pol.filho, s.class || '/canais/' || s.channel_ref || '/resumo/' || to_char(s.month, 'YYYY-MM') || '.v' || s.version || '.' || k.papel || '.csv.gz', k.sha
      from public.obs_archive_summaries s join pol on pol.class = s.class
      cross join lateral (values ('canal', s.canal_sha256), ('video', s.video_sha256), ('ficha', s.ficha_sha256)) k(papel, sha)
     where s.site_id = p_site and s.channel_ref = p_ref and k.sha is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('filho', f.filho, 'caminho', f.caminho, 'sha256', f.sha, 'nova', null) order by f.filho, f.caminho), '[]'::jsonb) from f
$$;
revoke all on function public.obs_archive_arquivos_do_canal(uuid, text) from public, anon, authenticated, service_role;
```

As duas funções auxiliares (`obs_archive_apagar_do_alvo`, `obs_archive_arquivos_do_canal`) vêm **antes** de `obs_archive_owner_pending` no arquivo (a ordem acima é de leitura; `plpgsql` só resolve na chamada, mas o teste `rodar duas vezes` da Tarefa 1 roda o arquivo inteiro).

- [ ] **Passo 4.** Rodar → PASS. Rodar também `apps/web/test/integration/manutencao-m3b-pendencias.test.ts`: continua verde porque aplica só a M3b (`aplicarM3b`); se algum teste dele aplicar a M9, o executor para e avisa (a `versao 1` é contrato da M3b, a `versao 2` é desta etapa).

- [ ] **Passo 5. Commit** (quando mandado): `git add -- apps/web/test/integration/manutencao-m9-pendencias.test.ts`; `git commit -m "feat: M9 parte 5: avanço dos itens, versões superadas de texto, já rodei e pendências do dono na versao 2 (rascunho)" -- supabase/rascunhos/m9.sql apps/web/test/integration/manutencao-m9-pendencias.test.ts`.

---

### Task 6: o filtro do item, o resumo refeito e o arquivo de comandos do canal (TypeScript puro)

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-resumo.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato.ts`
- Create: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/comandos-canal.ts`
- Create: `apps/web/test/youtube/observatorio/arquivo-mensal-expurgo-filtro.test.ts`, `...-expurgo-resumo.test.ts`, `...-comandos-canal.test.ts`
- Create: `apps/web/test/integration/manutencao-m9-resumo-ouro.test.ts` (com banco: o resumo refeito em TS contra `obs_archive_summary_rows`)

**Interfaces:**
- Consumes: `lerCsv` (`arquivo/csv.ts:35`), `serializarLinhas` (`arquivo/exportar.ts:54`), `serializarResumo` e `LinhasDoResumo` (`arquivo-mensal/resumo.ts:8-36`), `UUID_RE`, `SHA_RE`, `MES_RE` (`arquivo-mensal/contrato.ts`).
- Produces:
  - `expurgo-filtro.ts`: `type Celula = string | null`; `interface UnidadeLida { colunas: string[]; linhas: Celula[][] }`; `lerUnidadeGz(gz: Buffer): UnidadeLida`; `COLUNA_DA_CHAVE`; `filtrarUnidade(o: { tabela: string; kind: 'video' | 'comentario'; chaves: ReadonlySet<string>; unidade: UnidadeLida; comentariosDoVideo?: ReadonlySet<string> }): { unidade: UnidadeLida; removidas: number }`; `idsDeComentariosDoVideo(comentarios: UnidadeLida, videos: ReadonlySet<string>): Set<string>`; `serializarUnidade(u: UnidadeLida, colunaControle: string | null): UnidadeSerializada` com `interface UnidadeSerializada { gz: Buffer | null; sha256_bytes: string; csv_sha256: string; file_bytes: number; row_count: number; control_sum: string | null; hash_conteudo: string }`; `hashConteudo(linhas: ReadonlyArray<ReadonlyArray<Celula>>): string`.
  - `expurgo-resumo.ts`: `refazerResumo(o: { classe: string; canal: string; mes: string; diasDoMes: number; versao: number; unidades: Array<{ tabela: string; unidade: UnidadeLida; hashConteudo: string }>; vazias: Array<{ tabela: string; hashConteudo: string }>; comentarios?: UnidadeLida }): LinhasDoResumo`.
  - `expurgo-contrato.ts`: `CorpoAbrir`, `RespostaAbrir`, `CorpoRegistrar`, `RespostaRegistrar`, `CorpoBloquear`, `CorpoCanal`, `RespostaCanal`, `CorpoExpurgo` (Zod, `.strict()`), os tipos inferidos.
  - `comandos-canal.ts`: `montarComandosDoCanal(o: { channelRef: string; prefixos: Array<{ filho: 'numerico' | 'texto'; prefixo: string }>; raiz: Record<'numerico' | 'texto', string>; geradoEm: Date }): string`.

**O que acontece quando o dado não existe:** unidade em que o filtro não acha o item: `removidas = 0` (o chamador manda o alvo em `sem_linhas`; Review Focus 5); unidade que fica sem linha: `serializarUnidade` devolve `gz: null`, `row_count 0`, `sha256_bytes ''` (a regra `row_count = 0 ↔ sha256 nulo` de `m3b.sql:88`), e nada vai ao NAS; tabela sem entrada em `COLUNA_DA_CHAVE`: lança `tabela_sem_chave` (nunca "não achou nada"); CSV sem a coluna da chave: lança `coluna_da_chave_ausente`; `prefixos` vazio em `montarComandosDoCanal`: lança `sem_prefixo` (o comando recusa em vez de gravar um script que não faz nada e diz que fez).

- [ ] **Passo 1. Testes puros, falhando** (`arquivo-mensal-expurgo-filtro.test.ts`, `// @vitest-environment node`):

```ts
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { serializarLinhas } from '@/lib/youtube/observatorio/arquivo/exportar'
import {
  COLUNA_DA_CHAVE, filtrarUnidade, hashConteudo, idsDeComentariosDoVideo, lerUnidadeGz, serializarUnidade,
} from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro'

const V1 = '11111111-1111-1111-1111-111111111111'
const V2 = '22222222-2222-2222-2222-222222222222'
const diaria = { colunas: ['video_id', 'snap_date', 'views'], linhas: [[V1, '2026-09-01', '10'], [V2, '2026-09-01', '5'], [V1, '2026-09-02', '12']] }

describe('expurgo: filtro do item', () => {
  it('tira só as linhas do vídeo e mantém a ordem dos outros', () => {
    const r = filtrarUnidade({ tabela: 'competitor_video_daily', kind: 'video', chaves: new Set([V1]), unidade: diaria })
    expect(r.removidas).toBe(2)
    expect(r.unidade.linhas).toEqual([[V2, '2026-09-01', '5']])
  })
  it('filtro_sem_linhas_conclui_sem_versao: vídeo ausente dá zero removidas', () => {
    const r = filtrarUnidade({ tabela: 'competitor_video_daily', kind: 'video', chaves: new Set(['33333333-3333-3333-3333-333333333333']), unidade: diaria })
    expect(r.removidas).toBe(0)
  })
  it('comentário leva as respostas (parent_id) e as marcas pelo comment_id', () => {
    const com = { colunas: ['id', 'parent_id', 'video_id', 'first_seen_at'], linhas: [['7', null, V1, 'x'], ['8', '7', V1, 'x'], ['9', null, V2, 'x']] }
    const r = filtrarUnidade({ tabela: 'competitor_video_comments', kind: 'comentario', chaves: new Set(['7']), unidade: com })
    expect(r.unidade.linhas.map(l => l[0])).toEqual(['9'])
    const marcas = { colunas: ['comment_id', 'likes'], linhas: [['7', '1'], ['8', '2'], ['9', '3']] }
    const m = filtrarUnidade({ tabela: 'competitor_video_comment_marks', kind: 'comentario', chaves: new Set(['7', '8']), unidade: marcas })
    expect(m.unidade.linhas).toEqual([['9', '3']])
  })
  it('vídeo nas marcas: pelos comentários do vídeo na unidade de comentários do mesmo mês', () => {
    const com = { colunas: ['id', 'parent_id', 'video_id', 'first_seen_at'], linhas: [['7', null, V1, 'x'], ['9', null, V2, 'x']] }
    const ids = idsDeComentariosDoVideo(com, new Set([V1]))
    const marcas = { colunas: ['comment_id', 'likes'], linhas: [['7', '1'], ['9', '3']] }
    const m = filtrarUnidade({ tabela: 'competitor_video_comment_marks', kind: 'video', chaves: new Set([V1]), unidade: marcas, comentariosDoVideo: ids })
    expect(m.unidade.linhas).toEqual([['9', '3']])
  })
  it('tabela sem chave conhecida lança, nunca devolve zero', () => {
    expect(() => filtrarUnidade({ tabela: 'outra', kind: 'video', chaves: new Set([V1]), unidade: diaria })).toThrow('tabela_sem_chave')
  })
  it('toda tabela da política fora de ensaio tem chave', () => {
    for (const t of ['competitor_video_hourly', 'competitor_video_daily', 'competitor_video_early', 'competitor_video_comments',
      'competitor_video_comment_marks', 'competitor_raw']) expect(COLUNA_DA_CHAVE[t]).toBeDefined()
  })
  it('unidade que esvazia não tem arquivo', () => {
    const s = serializarUnidade({ colunas: diaria.colunas, linhas: [] }, 'views')
    expect(s).toMatchObject({ gz: null, row_count: 0, sha256_bytes: '', control_sum: '0' })
  })
  it('ida e volta: o gz lido de volta tem as mesmas linhas; hash no formato do jsonb', () => {
    const s = serializarUnidade(diaria, 'views')
    expect(lerUnidadeGz(s.gz!)).toEqual(diaria)
    expect(s.control_sum).toBe('27')
    expect(hashConteudo([['a', null]])).toBe(hashConteudo([['a', null]]))
    expect(lerUnidadeGz(gzipSync(serializarLinhas(diaria.colunas, diaria.linhas)))).toEqual(diaria)
  })
})
```

`arquivo-mensal-expurgo-resumo.test.ts`: (a) diária de dois vídeos, um removido: a linha do canal tem `videos_com_linha 1`, `linhas` = as do que ficou, `var_views` = `ultima − primeira` do que ficou; (b) valor nulo numa leitura medida: `var_views` nulo (a regra de `m3b.sql:1112`); (c) tabela vazia em `vazias`: linha do canal com contagens `0` e datas nulas; (d) `versao_resumo` e `hash_conteudo_unidade` em toda linha.

`arquivo-mensal-expurgo-comandos-canal.test.ts` (o `05` §16.10): o texto começa por `#!/bin/bash` e `set -euo pipefail` e `umask 077`; tem `[ "$(hostname -s)" = forja ]`, a conferência `mountpoint -q` e a sentinela `.arquivo-vivo` de cada filho usado; uma linha `[ ! -d '<raiz>/<prefixo>' ] || rm -r --one-file-system -- '<raiz>/<prefixo>'` por prefixo; a validade de 24 h (`agora > gerado + 86400` → sai `4` com `OBS-ARQUIVO: VENCIDO`); `channelRef` fora da forma de uuid lança antes de montar; prefixo com `..`, aspas, espaço ou `$` lança; termina com `OBS-ARQUIVO: CANAL <ref> APAGADO DO NAS` e a função chamada na mesma linha do `}` (D-F24 (a)).

- [ ] **Passo 2.** `cd apps/web && npx vitest run test/youtube/observatorio/arquivo-mensal-expurgo-*.test.ts test/youtube/observatorio/arquivo-mensal-comandos-canal.test.ts` → FAIL.

- [ ] **Passo 3. `expurgo-filtro.ts`:**

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-filtro.ts
/**
 * Manutenção M9: o filtro do item na unidade antiga e a serialização da versão nova (02 §11.3, "Como o expurgo reescreve").
 * Puro (só `node:` e relativo): o `tsx` da raiz o importa no Mac. Nada aqui lê banco, rede ou relógio.
 */
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { lerCsv } from '../arquivo/csv'
import { serializarLinhas } from '../arquivo/exportar'

export type Celula = string | null
export interface UnidadeLida { colunas: string[]; linhas: Celula[][] }
export interface UnidadeSerializada {
  gz: Buffer | null; sha256_bytes: string; csv_sha256: string; file_bytes: number; row_count: number; control_sum: string | null; hash_conteudo: string
}

/** A coluna que carrega a chave do item, por tabela (`m3b.sql:310-350`, `obs_archive_table_exprs` l.787-806). */
export const COLUNA_DA_CHAVE: Readonly<Record<string, { video: string | null; comentario: readonly string[] | null }>> = {
  competitor_video_hourly: { video: 'video_id', comentario: null },
  competitor_video_daily: { video: 'video_id', comentario: null },
  competitor_video_early: { video: 'video_id', comentario: null },
  competitor_video_comments: { video: 'video_id', comentario: ['id', 'parent_id'] },
  competitor_video_comment_marks: { video: null, comentario: ['comment_id'] },
  competitor_raw: { video: 'video_id', comentario: null },
}

const sha = (d: Uint8Array | string): string => createHash('sha256').update(d).digest('hex')

export function lerUnidadeGz(gz: Buffer): UnidadeLida {
  const { colunas, linhas } = lerCsv(gunzipSync(gz).toString('utf8'))
  return { colunas, linhas }
}

function indice(u: UnidadeLida, coluna: string): number {
  const i = u.colunas.indexOf(coluna)
  if (i < 0) throw new Error(`coluna_da_chave_ausente: ${coluna}`)
  return i
}

export function idsDeComentariosDoVideo(comentarios: UnidadeLida, videos: ReadonlySet<string>): Set<string> {
  const iv = indice(comentarios, 'video_id'), ii = indice(comentarios, 'id')
  const ids = new Set<string>()
  for (const l of comentarios.linhas) { const v = l[iv]; const id = l[ii]; if (v != null && id != null && videos.has(v)) ids.add(id) }
  return ids
}

export function filtrarUnidade(o: {
  tabela: string; kind: 'video' | 'comentario'; chaves: ReadonlySet<string>; unidade: UnidadeLida; comentariosDoVideo?: ReadonlySet<string>
}): { unidade: UnidadeLida; removidas: number } {
  const regra = COLUNA_DA_CHAVE[o.tabela]
  if (!regra) throw new Error(`tabela_sem_chave: ${o.tabela}`)
  let tira: (l: Celula[]) => boolean
  if (o.kind === 'video' && regra.video) {
    const i = indice(o.unidade, regra.video)
    tira = l => l[i] != null && o.chaves.has(l[i]!)
  } else if (o.kind === 'video' && o.tabela === 'competitor_video_comment_marks') {
    if (!o.comentariosDoVideo) throw new Error('marcas_sem_comentarios_do_video')
    const i = indice(o.unidade, 'comment_id'); const ids = o.comentariosDoVideo
    tira = l => l[i] != null && ids.has(l[i]!)
  } else if (o.kind === 'comentario' && regra.comentario) {
    const is = regra.comentario.map(c => indice(o.unidade, c))
    tira = l => is.some(i => l[i] != null && o.chaves.has(l[i]!))
  } else {
    return { unidade: o.unidade, removidas: 0 }       // a tabela não carrega esse tipo de item (ex.: comentário na diária)
  }
  const ficam = o.unidade.linhas.filter(l => !tira(l))
  return { unidade: { colunas: o.unidade.colunas, linhas: ficam }, removidas: o.unidade.linhas.length - ficam.length }
}

/** O texto de `to_jsonb(array[...]::text[])` do Postgres: `["a", null]`, com ", " entre os elementos (`m3b.sql:376-381`). */
const jsonbTexto = (l: ReadonlyArray<Celula>): string => '[' + l.map(v => (v === null ? 'null' : JSON.stringify(v))).join(', ') + ']'
export const hashConteudo = (linhas: ReadonlyArray<ReadonlyArray<Celula>>): string => sha(linhas.map(jsonbTexto).join('\n'))

function soma(u: UnidadeLida, coluna: string | null): string | null {
  if (coluna === null) return null
  const i = indice(u, coluna)
  let s = 0n
  for (const l of u.linhas) { const v = l[i]; if (v != null) s += BigInt(v) }
  return s.toString()
}

export function serializarUnidade(u: UnidadeLida, colunaControle: string | null): UnidadeSerializada {
  const hash = hashConteudo(u.linhas)
  const control_sum = soma(u, colunaControle)
  if (u.linhas.length === 0) return { gz: null, sha256_bytes: '', csv_sha256: '', file_bytes: 0, row_count: 0, control_sum, hash_conteudo: hash }
  const csv = serializarLinhas(u.colunas, u.linhas)
  const gz = gzipSync(csv, { level: 9 })
  return { gz, sha256_bytes: sha(gz), csv_sha256: sha(csv), file_bytes: gz.byteLength, row_count: u.linhas.length, control_sum, hash_conteudo: hash }
}
```

A coluna de controle é inteira em todas as tabelas da política (`views`, `likes`: `m3b.sql:13-28`), por isso `BigInt`; uma coluna não inteira lança `SyntaxError` do `BigInt` e o Mac para, sem registrar.

- [ ] **Passo 4. `expurgo-resumo.ts`** (a mesma conta de `obs_archive_summary_rows`, `m3b.sql:1105-1130`, em TS; `ts`, `dia` e `vídeo` por tabela como em `obs_archive_table_exprs`, l.787-806):

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/expurgo-resumo.ts
/** Manutenção M9: o resumo do mês refeito a partir das unidades já filtradas (02 §11.3). Puro. A prova é o teste de ouro contra o SQL. */
import type { LinhasDoResumo } from './resumo'
import type { Celula, UnidadeLida } from './expurgo-filtro'

const COLUNAS_CANAL = ['canal', 'tabela', 'mes', 'videos_com_linha', 'linhas', 'dias_medidos', 'dias_do_mes', 'primeira_leitura', 'ultima_leitura',
  'var_views', 'var_likes', 'var_comments', 'hash_conteudo_unidade', 'versao_resumo']
const COLUNAS_VIDEO = ['video', 'canal', 'tabela', 'mes', 'linhas', 'dias_medidos', 'views_primeira', 'views_ultima', 'likes_primeira', 'likes_ultima',
  'comments_primeira', 'comments_ultima', 'hash_conteudo_unidade', 'versao_resumo']
const MEDIDAS = new Set(['competitor_video_hourly', 'competitor_video_daily', 'competitor_video_early'])
const DIA_SP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Texto de timestamptz do Postgres com `timezone = 'UTC'` ("2026-09-01 03:00:00+00") ou data ("2026-09-01"). */
function diaSP(ts: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts
  const iso = ts.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`instante_ilegivel: ${ts}`)
  return DIA_SP.format(d)
}

interface Leitura { video: string; ts: string; dia: string; a: string | null; b: string | null; c: string | null }

function leituras(tabela: string, u: UnidadeLida, comentarios: UnidadeLida | undefined): Leitura[] {
  const col = (n: string): number => { const i = u.colunas.indexOf(n); if (i < 0) throw new Error(`coluna_ausente: ${tabela}.${n}`); return i }
  const v = (l: Celula[], n: string): Celula => l[col(n)] ?? null
  if (tabela === 'competitor_video_comments' || tabela === 'competitor_video_comment_marks') {
    const base = tabela === 'competitor_video_comments' ? u : comentarios
    if (!base) throw new Error('resumo_de_marcas_sem_comentarios')
    const bi = (n: string): number => base.colunas.indexOf(n)
    const porId = new Map(base.linhas.map(l => [l[bi('id')]!, l]))
    return u.linhas.map(l => {
      const k = tabela === 'competitor_video_comments' ? l : porId.get(v(l, 'comment_id')!)
      if (!k) throw new Error('marca_sem_comentario_no_mes')
      const pai = k[bi('parent_id')] ? porId.get(k[bi('parent_id')]!) : undefined
      const ts = (pai?.[bi('first_seen_at')] ?? k[bi('first_seen_at')])!
      return { video: k[bi('video_id')]!, ts, dia: diaSP(ts), a: null, b: null, c: null }
    })
  }
  const tsCol = tabela === 'competitor_video_daily' ? 'snap_date' : tabela === 'competitor_video_early' ? 'taken_at'
    : tabela === 'competitor_raw' ? 'last_seen_at' : 'hour_slot'
  const medida = MEDIDAS.has(tabela)
  return u.linhas.map(l => ({
    video: v(l, 'video_id')!, ts: v(l, tsCol)!, dia: diaSP(v(l, tsCol)!),
    a: medida ? v(l, 'views') : null, b: medida ? v(l, 'likes') : null, c: medida ? v(l, 'comments') : null,
  }))
}

const difSoma = (pares: Array<[string | null, string | null]>): string | null =>
  pares.some(([x, y]) => x === null || y === null) ? null : pares.reduce((s, [x, y]) => s + (BigInt(y!) - BigInt(x!)), 0n).toString()

export function refazerResumo(o: {
  classe: string; canal: string; mes: string; diasDoMes: number; versao: number
  unidades: Array<{ tabela: string; unidade: UnidadeLida; hashConteudo: string }>
  vazias: Array<{ tabela: string; hashConteudo: string }>
  comentarios?: UnidadeLida
}): LinhasDoResumo {
  const canal: Celula[][] = []; const video: Celula[][] = []
  const ver = String(o.versao)
  const todas = [...o.unidades.map(u => ({ ...u, ls: leituras(u.tabela, u.unidade, o.comentarios) })),
    ...o.vazias.map(v => ({ tabela: v.tabela, hashConteudo: v.hashConteudo, unidade: { colunas: [], linhas: [] }, ls: [] as Leitura[] }))]
    .sort((x, y) => (x.tabela < y.tabela ? -1 : x.tabela > y.tabela ? 1 : 0))
  for (const u of todas) {
    const porVideo = new Map<string, Leitura[]>()
    for (const l of u.ls) { const a = porVideo.get(l.video) ?? []; a.push(l); porVideo.set(l.video, a) }
    const pv = [...porVideo.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([vid, ls]) => {
      const ord = [...ls].sort((x, y) => (x.ts < y.ts ? -1 : x.ts > y.ts ? 1 : 0))
      const p = ord[0]!, ul = ord[ord.length - 1]!
      return { vid, n: ls.length, nd: new Set(ls.map(l => l.dia)).size, t1: p.ts, t2: ul.ts, a1: p.a, a2: ul.a, b1: p.b, b2: ul.b, c1: p.c, c2: ul.c }
    })
    const vazia = u.ls.length === 0
    canal.push([o.canal, u.tabela, o.mes, String(pv.length), String(u.ls.length), String(new Set(u.ls.map(l => l.dia)).size), String(o.diasDoMes),
      vazia ? null : pv.reduce((m, x) => (x.t1 < m ? x.t1 : m), pv[0]!.t1), vazia ? null : pv.reduce((m, x) => (x.t2 > m ? x.t2 : m), pv[0]!.t2),
      vazia ? null : difSoma(pv.map(x => [x.a1, x.a2])), vazia ? null : difSoma(pv.map(x => [x.b1, x.b2])), vazia ? null : difSoma(pv.map(x => [x.c1, x.c2])),
      u.hashConteudo, ver])
    for (const x of pv) video.push([x.vid, o.canal, u.tabela, o.mes, String(x.n), String(x.nd), x.a1, x.a2, x.b1, x.b2, x.c1, x.c2, u.hashConteudo, ver])
  }
  const vazio = todas.every(u => u.ls.length === 0)
  return { versao: o.versao, vazio, colunas_canal: COLUNAS_CANAL, colunas_video: COLUNAS_VIDEO, canal: vazio ? [] : canal, video: vazio ? [] : video, unit_hashes: {} }
}
```

**Teste de ouro** (`manutencao-m9-resumo-ouro.test.ts`, com banco, `aplicarM3b`): semear um canal com diária, early (vazia), comentários com resposta e marcas num mês; chamar `obs_archive_summary_rows` e comparar, linha a linha, com `refazerResumo` alimentado pelas unidades lidas por `obs_archive_read_unit` (as mesmas que o arquivo teria). Diferença em qualquer campo falha. **Empate de `ts` dentro de um vídeo:** o SQL escolhe sem ordem definida (`array_agg(a order by ts)`); a semente não tem empate e o teste diz isso no nome (`sem empate de leitura no mesmo instante`). `unit_hashes` sai vazio daqui: quem preenche é a função do registro (Tarefa 3, a partir do registro). `video_antigo` nunca chega aqui (D-M9-14).

- [ ] **Passo 5. `expurgo-contrato.ts`** (o C14, Tarefa 11): Zod `.strict()` de `CorpoRegistrar` (`{ passo: 'registrar', item_id: number, classe, canal (uuid), mes (AAAA-MM), unidades: [{ alvo_id, linhas_removidas (int ≥ 1), unidade: { classe, tabela, canal, mes: 'AAAA-MM-01', row_count, control_sum: string|null, hash_conteudo (SHA_RE), schema_fp (SHA_RE), sha256_bytes, csv_sha256, file_bytes, partes: 1, min_key: null, max_key: null } }], sem_linhas: number[], resumo: { versao, vazio, canal_sha256, canal_bytes, canal_rows, video_sha256, video_bytes, video_rows } }`), de `CorpoAbrir` (`{ passo: 'abrir', item_id }`), `CorpoBloquear` (`{ passo: 'bloquear', item_id, alvo_id, motivo: z.enum(['antiga_ausente','antiga_divergente','grande_demais']) }`), `CorpoCanal` (`{ passo: 'canal', channel_ref: uuid }`, resposta `{ motivo: 'canal_desconhecido' | 'canal_nao_removido' | 'canal_guardado' | 'sem_destino' | 'ok' }`), a união `CorpoExpurgo = z.discriminatedUnion('passo', [CorpoAbrir, CorpoRegistrar, CorpoBloquear, CorpoCanal])` e das respostas, espelhando as interfaces da Tarefa 3. `RespostaAbrir` traz em cada alvo `hash_conteudo` (Tarefa 8). `min_key`/`max_key` vão nulos: a M3b os usa só para partes (`unit_parts.min_key`), e a versão nova é sempre arquivo único (D-M9-4).

- [ ] **Passo 6. `comandos-canal.ts`** (o `05` §16.10; forma do script do D-F24):

```ts
// apps/web/src/lib/youtube/observatorio/arquivo-mensal/comandos-canal.ts
/** Manutenção M9: o arquivo de comandos de `expurgar --canal` (05 §16.10). Puro: devolve o texto; quem grava é o CLI (umask 077, abertura exclusiva). */
import { UUID_RE } from './contrato'

const PREFIXO_SEGURO = /^(?:numerico|texto|horaria|serie|video_antigo)\/canais\/[0-9a-f-]{36}\/$/
const RAIZ_SEGURA = /^\/[A-Za-z0-9._/-]{1,200}$/
const aspas = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

export function montarComandosDoCanal(o: {
  channelRef: string; prefixos: Array<{ filho: 'numerico' | 'texto'; prefixo: string }>; raiz: Record<'numerico' | 'texto', string>; geradoEm: Date
}): string {
  if (!UUID_RE.test(o.channelRef)) throw new Error('canal_invalido')
  if (o.prefixos.length === 0) throw new Error('sem_prefixo')
  for (const p of o.prefixos) {
    if (!PREFIXO_SEGURO.test(p.prefixo) || !p.prefixo.includes(`/canais/${o.channelRef}/`)) throw new Error('prefixo_invalido')
    if (!RAIZ_SEGURA.test(o.raiz[p.filho]) || o.raiz[p.filho].includes('..')) throw new Error('raiz_invalida')
  }
  const filhos = [...new Set(o.prefixos.map(p => p.filho))].sort()
  const gerado = Math.floor(o.geradoEm.getTime() / 1000)
  return [
    '#!/bin/bash',
    `# expurgar --canal ${o.channelRef}: gerado em ${o.geradoEm.toISOString()}; vale 24 h; rodado pelo dono na forja`,
    'set -euo pipefail',
    'umask 077',
    "trap '[ \"${OBS_INICIOU:-0}\" = 1 ] || echo \"OBS-ARQUIVO: NÃO RODOU: o arquivo chegou incompleto; nada feito\"' EXIT",
    'obs_canal_main() {',
    '  OBS_INICIOU=1',
    '  [ "$(hostname -s)" = forja ] || { echo "OBS-ARQUIVO: RECUSADO: rode na forja"; return 3; }',
    `  [ "$(date +%s)" -le ${gerado + 86400} ] || { echo "OBS-ARQUIVO: VENCIDO: gere de novo no Mac"; return 4; }`,
    ...filhos.flatMap(f => [
      `  mountpoint -q ${aspas(o.raiz[f])} || { echo "OBS-ARQUIVO: RECUSADO: ${f} desmontado"; return 5; }`,
      `  [ -f ${aspas(o.raiz[f] + '/.arquivo-vivo')} ] || { echo "OBS-ARQUIVO: RECUSADO: ${f} sem sentinela"; return 5; }`,
    ]),
    ...o.prefixos.map(p => `  [ ! -d ${aspas(`${o.raiz[p.filho]}/${p.prefixo}`)} ] || rm -r --one-file-system -- ${aspas(`${o.raiz[p.filho]}/${p.prefixo}`)}`),
    `  echo "OBS-ARQUIVO: CANAL ${o.channelRef} APAGADO DO NAS (${o.prefixos.length} prefixo(s)); a conferência do copiador confirma em até 11 h"`,
    '}; obs_canal_main; exit $?',
    '',
  ].join('\n')
}
```

O B2 não entra neste arquivo: o `05` §16.10 e o `02` §11.3 mandam o B2 só depois da conferência do NAS com menos de 24 h, e isso o `obs:arquivo` faz pelo tempo `conferir_b2` (Tarefa 7).

- [ ] **Passo 7.** Rodar os quatro testes → PASS (o de ouro com `HAS_LOCAL_DB=1`).

- [ ] **Passo 8. Commit** (quando mandado; puro, não depende da TRAVA M9-2): `git add --` dos sete arquivos novos; `git commit -m "feat: M9: filtro do item, resumo refeito em TS (ouro contra o SQL) e arquivo de comandos do canal" -- <os sete>`.

---

### Task 7: o leitor e o script na `versao 2` (só depois da TRAVA M9-2; um commit, E-D3 e D-F25)

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts` (criado pela M3b-forja, Tarefa 7a)
- Modify: `apps/web/test/youtube/observatorio/arquivo-mensal-pendencias.test.ts`, o teste do script da M3b-forja (`grep -ln "scriptDasPendencias" apps/web/test`)
- Modify: `apps/web/test/manutencao/m9-trava.test.ts` (o `it.skipIf(migrou)` passa a ser satisfeito pela migration; nada a mudar no código do teste)

**Interfaces:**
- Consumes: o C12 r2.6 (Tarefa 5); `aspas`, `scriptDeFalha`, `saidaSegura`, `apaga_conferido` (M3b-forja Tarefa 7a, `m3b-forja.md:5660-5699`).
- Produces: `VERSAO_PENDENCIAS = 2`; `TEMPOS_PENDENCIA` inalterado; `FALTAS = ['copiador', 'b2_nova', 'segunda_conferencia', 'retencao', 'snapshots', 'conferencia_nas_recente', 'b2_sync', 'blobs', 'imagens', 'lote_e10'] as const`; `MOTIVOS = ['antiga_ausente', 'antiga_divergente', 'depende_m10b', 'grande_demais', 'contagem_divergente'] as const`; `PendenciaDoDono` ganha `falta: Falta | null`, `motivo: Motivo | null`, `prefixos: string[]`, e `kind` ganha `'versao'`; `ITEM_ID_RE` aceita `antiga:<uuid>`; `scriptDasPendencias(l, { versao, copias })` com `copias: Array<{ itemId: string; filho: Filho; caminho: string; sha256: string; base64: string }>` (o que o Mac já registrou nesta execução, Tarefa 8).

**O que acontece quando o dado não existe:** `versao: 1` vinda de um banco sem a M9: `lerPendencias` devolve `{ ok: false, porque: 'versao: ...' }` (E-D5: estrito), o Mac sai com código 1 e o script de falha, a peça 7 mostra "não medido" — é por isso que este commit só entra depois da migration (TRAVA M9-2). Item em `copiar` sem cópia preparada pelo Mac nesta execução (o Mac falhou ao ler o NAS e bloqueou o alvo): o script diz `ESPERA-COPIA <item>` e não grava nada. `b2_nomes` vazio em `conferir_b2`: forma inválida (nunca "nada a fazer no B2").

- [ ] **Passo 1. Testes, falhando** (estender os existentes):

| Teste | Afirma |
|---|---|
| `lê a versao 2` | um corpo com os 5 tempos, `falta`, `motivo`, `prefixos` e `kind 'versao'`: `ok: true` com os campos mapeados |
| `recusa a versao 1` | `{ versao: 1, ... }`: `ok: false` |
| `b2_nomes só em conferir_b2` | `b2_nomes` em `apagar_antigas`: `ok: false`; vazio em `conferir_b2`: `ok: false` |
| `falta só em sem_comando, motivo só em bloqueado` | cada um fora do seu tempo: `ok: false` |
| `antiga: só com kind versao` | `item_id 'antiga:<uuid>'` com `kind 'video'`: `ok: false` |
| `script: copiar grava em _recebendo` | item `copiar` com uma cópia: o script tem `grava_recebendo 'texto' '<caminho>' '<sha>' <<'OBS-B64'`, o base64 e `OBS-B64`; `grava_recebendo` confere montagem e sentinela, grava em `_recebendo/<caminho>.parcial.$$`, confere o sha256 e só então `mv -n` para `_recebendo/<caminho>`; arquivo já no caminho final ou em `_recebendo` com o mesmo sha256: `JA-GRAVADO`, sem regravar |
| `script_duas_vezes_idempotente` (Review Focus 3) | rodar o script gerado (bash de verdade, `hostname` falso por `PATH`, raízes em pasta temporária com `.arquivo-vivo` e `mountpoint` falso): primeira vez `GRAVADO` e `APAGADO`; segunda vez `JA-GRAVADO` e `JA-APAGADO`, código 0, a versão nova intacta (sha256 conferido) |
| `script: conferir_b2 imprime o painel` | `B2-PAINEL: <nome>` por linha, com o nome traduzido na forja por `python3 /opt/arquivo/conferir-b2/nome_b2.py '<filho>' '<caminho>'` (Tarefa 9); falha da tradução: `PULADO` e código 1 |
| `script: canal apaga arquivo a arquivo e o diretório vazio` | item `canal:` em `apagar_antigas`: um `apaga_conferido` por arquivo (`nova` vazia) e, no fim, `find <raiz>/<prefixo> -depth -type d -empty -delete` por prefixo, só com montagem e sentinela; prefixo que continua com arquivo depois disso: `RESTA <prefixo>: há arquivo que o site não conhece; use "Ver os comandos" na página do Arquivo` |
| `script: sem_comando diz o que falta` | `falta 'retencao'`: `ESPERA <item>: a retenção dos snapshots não foi registrada (veja o runbook)`; uma frase por valor de `FALTAS` |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. `pendencias.ts`:** subir `VERSAO_PENDENCIAS` a `2`; `KINDS = ['canal', 'video', 'comentario', 'versao']`; `ITEM_ID_RE` com a alternativa `antiga:<uuid>`; `Item` ganha `falta: z.enum(FALTAS).nullable()`, `motivo: z.enum(MOTIVOS).nullable()`, `prefixos: z.array(caminho)`; o `superRefine` passa a ser:

```ts
}).strict().superRefine((i, ctx) => {
  const falha = (message: string): void => { ctx.addIssue({ code: z.ZodIssueCode.custom, message }) }
  if ((i.apagar.length > 0) !== (i.tempo === 'apagar_antigas')) falha('apagar só existe em apagar_antigas, e lá não é vazio')
  if ((i.b2_nomes.length > 0) !== (i.tempo === 'conferir_b2')) falha('b2_nomes só existe em conferir_b2, e lá não é vazio')
  if (i.falta !== null && i.tempo !== 'sem_comando') falha('falta só em sem_comando')
  if ((i.motivo !== null) !== (i.tempo === 'bloqueado')) falha('motivo só em bloqueado, e lá obrigatório')
  const deCanal = i.item_id.startsWith('canal:')
  if (deCanal !== (i.kind === 'canal')) falha('kind canal se e só se item_id começa por canal:')
  if (deCanal && i.item_id.slice('canal:'.length) !== i.channel_ref) falha('canal:<uuid> diferente de channel_ref')
  if (i.item_id.startsWith('antiga:') !== (i.kind === 'versao')) falha('kind versao se e só se item_id começa por antiga:')
  if (i.prefixos.length > 0 && !deCanal) falha('prefixos só em canal')
})
```

e o mapeamento de `lerPendencias` acrescenta `falta`, `motivo`, `prefixos`. `pendenciasParaTela` passa `falta` e `motivo` adiante (a tela da Tarefa 12 escreve a frase). **No mesmo commit**, revisar a linha "Segredo" do C13 em `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` (r2.6): "com `versao: 2`, `apagar`, `b2_nomes` e `prefixos` saem preenchidos (caminhos do NAS, nomes do B2 e sha256 de arquivos do próprio arquivo); a chave continua sem poder de apagar (o NAS e o B2 pedem outra credencial) e passa a poder **registrar** versão nova de expurgo (C14)"; e a exceção do E-D4 (quem só edita não recebe a linha) continua: `podeVerComandos` inalterado.

- [ ] **Passo 4. `pendencias-script.ts`:** acrescentar ao corpo da função, ao lado de `apaga_conferido`:

```bash
  grava_recebendo() {   # filho caminho sha256; o conteúdo chega em base64 pela entrada, até a linha OBS-B64
    local base="$M/$1" final="$M/$1/$2" dest="$M/$1/_recebendo/$2" tmp
    if ! mountpoint -q "$base" || [ ! -f "$base/.arquivo-vivo" ]; then cat > /dev/null; echo "PULADO $1/$2: o NAS não está montado ou sem a sentinela" >&2; falhas=$((falhas+1)); return 0; fi
    if [ -f "$final" ] && [ "$(sha256sum < "$final" | cut -c1-64)" = "$3" ]; then cat > /dev/null; echo "JA-GRAVADO $1/$2"; ja=$((ja+1)); return 0; fi
    if [ -f "$dest" ] && [ "$(sha256sum < "$dest" | cut -c1-64)" = "$3" ]; then cat > /dev/null; echo "JA-GRAVADO $1/_recebendo/$2"; ja=$((ja+1)); return 0; fi
    mkdir -p -- "$(dirname -- "$dest")"; tmp="$dest.parcial.$$"
    if ! base64 -d > "$tmp" || [ "$(sha256sum < "$tmp" | cut -c1-64)" != "$3" ]; then rm -f -- "$tmp"; echo "PULADO $1/$2: o arquivo chegou diferente do registrado" >&2; falhas=$((falhas+1)); return 0; fi
    if mv -n -- "$tmp" "$dest" && [ ! -e "$tmp" ]; then echo "GRAVADO $1/_recebendo/$2"; gravados=$((gravados+1)); else rm -f -- "$tmp"; echo "PULADO $1/$2: já havia outro arquivo em _recebendo com esse nome" >&2; falhas=$((falhas+1)); fi
  }
  b2_painel() {         # filho caminho_ou_prefixo
    local n; if n="$(python3 /opt/arquivo/conferir-b2/nome_b2.py "$1" "$2")"; then echo "B2-PAINEL: $n"; else echo "PULADO B2 $1/$2: não consegui traduzir o nome" >&2; falhas=$((falhas+1)); fi
  }
```

`gravados=0` entra no `local` do começo; a trava do copiador (`flock`) vale também quando há `grava_recebendo` (o copiador não pode ler `_recebendo` no meio da escrita). Linhas por tempo (todo valor por `aspas()`):
- `copiar`: para cada `copias` do item, `grava_recebendo '<filho>' '<caminho>' '<sha256>' <<'OBS-B64'`, o base64 em linhas de 76, `OBS-B64`; sem cópia do item nesta execução: `echo 'ESPERA-COPIA <item>: o Mac não preparou a cópia (veja a mensagem dele acima)'`.
- `apagar_antigas`: `apaga_conferido` por arquivo (como a M3b); para `canal:`, depois dos arquivos, por prefixo: `[ -d "$M/<filho>/<prefixo>" ] && find "$M/<filho>/<prefixo>" -xdev -depth -type d -empty -delete`, e `[ ! -d "$M/<filho>/<prefixo>" ] || echo 'RESTA <prefixo>: ...'`.
- `conferir_b2`: `b2_painel '<filho>' '<caminho>'` por nome (o `b2_nomes` vem como `<filho>/<caminho>`; o primeiro segmento é o filho).
- `sem_comando`: `echo 'ESPERA <item>: <frase da falta>'`. `bloqueado`: `echo 'BLOQUEADO <item>: <frase do motivo>'`.
- Fecho: `OBS-ARQUIVO: FEITO ($gravados gravado(s), $apagados apagado(s), $ja já feito(s), $esperando esperando)` quando houve `grava_recebendo` ou `apaga_conferido`; as outras finais como na M3b.

- [ ] **Passo 5.** Rodar → PASS. Rodar a suíte do observatório (`npx vitest run test/youtube/observatorio > /tmp/m9-obs.txt 2>&1; grep -E "FAIL|✗" /tmp/m9-obs.txt`) → sem falha.

- [ ] **Passo 6. Commit** (quando mandado, depois de "TRAVA M9-2 solta" no ledger): `git commit -m "feat: M9: pendências do dono na versao 2 (copiar, apagar, conferir B2) e o script com grava_recebendo" -- apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts apps/web/src/lib/youtube/observatorio/arquivo/pendencias-script.ts <testes tocados>`.

---

### Task 8: o tempo `copiar` no Mac (`obs:arquivo` e `expurgar --item`) e `expurgar --canal`

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/arquivo/expurgar.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/cli.ts` (subcomando `expurgar`), o caminho do `obs:arquivo` da M3b-forja (Tarefa 7a: `cli.ts`/`pendencias` chamam `prepararCopias` antes de montar o script)
- Create: `apps/web/test/youtube/observatorio/arquivo-expurgar.test.ts`

**Interfaces:**
- Consumes: `filtrarUnidade`, `idsDeComentariosDoVideo`, `lerUnidadeGz`, `serializarUnidade` (Tarefa 6), `refazerResumo` (Tarefa 6), `serializarResumo` (`resumo.ts:36`), `CorpoRegistrar`/`RespostaAbrir` (Tarefa 6), `lerCredencial` e `URL_DO_ARQUIVO` (M3b-forja Tarefa 7a, `m3b-forja.md:5214`, `:5643`), `montarComandosDoCanal` (Tarefa 6).
- Produces: `RAIZ_DO_FILHO = { numerico: '/mnt/arquivo/escrita/numerico', texto: '/mnt/arquivo/escrita/texto' }` (o `ARQ_MONTAGEM_ESCRITA` padrão do script da M3b-forja, `m3b-forja.md:5672`); `TETO_COPIA_BYTES = 64 * 1024 * 1024`; `interface DepsExpurgo { lerDoNas(filho: Filho, caminho: string): Promise<Buffer | null>; site(passo: unknown): Promise<unknown>; agora(): Date }`; `prepararCopias(itens: PendenciaDoDono[], d: DepsExpurgo): Promise<{ copias: Copia[]; avisos: string[] }>`; `expurgarCanal(ref: string, d: DepsExpurgo & { gravarArquivo(nome: string, texto: string): Promise<string> }): Promise<{ codigo: 0 | 1 | 2; linha: string | null; frase: string }>`.

**O que acontece quando o dado não existe:** arquivo antigo que o `ssh forja cat` não acha: `block(antiga_ausente)` pela rota e aviso no `stderr` ("restaure do B2 ou do snapshot e rode `select public.obs_archive_expurgo_unblock(...)` no painel; runbook"); sha256 lido diferente do registro: `block(antiga_divergente)`; filtro com zero linhas em **todas** as unidades do grupo: o grupo vai em `sem_linhas` e nenhum arquivo é gravado; versão nova maior que `TETO_COPIA_BYTES`: `block(grande_demais)`; rota fora (rede, 5xx, forma): nada registrado, o `obs:arquivo` sai com o script de falha (D-F22), nunca com cópia parcial. `expurgar --canal` com uuid que o site não conhece, de canal existente, `guardado` ou `sem_destino`: código 1 e a frase do `02` §11.3 (`canal_desconhecido`, `canal_nao_removido`, `canal_guardado`, `sem_destino`), sem arquivo gravado.

- [ ] **Passo 1. Testes, falhando** (`arquivo-expurgar.test.ts`, `// @vitest-environment node`, com `DepsExpurgo` falso: um "NAS" em memória e um "site" que registra os passos recebidos):

| Teste | Afirma |
|---|---|
| `copiar: lê, filtra, registra e devolve a cópia` | item com um grupo `serie` (diária com 3 linhas, 2 do vídeo): o site recebe `abrir` e depois `registrar` com `linhas_removidas 2`, `row_count 1`, `hash_conteudo` = `hashConteudo` das linhas que ficaram, `resumo.versao` = `resumo.versao + 1` do `abrir`; a cópia devolvida tem o caminho `serie/canais/<ref>/competitor_video_daily/2026-09.v2.csv.gz` e o base64 do gz cujo sha256 é o registrado |
| `copiar: resumo junto` | o grupo devolve **três** cópias quando o resumo não é vazio: a unidade e os dois arquivos do resumo (`...resumo/2026-09.v<N>.canal.csv.gz` e `.video.csv.gz`), com os sha256 que foram ao `registrar` |
| `sha diferente bloqueia` | o "NAS" devolve bytes com outro sha256: o site recebe `bloquear` com `antiga_divergente`; nenhuma cópia; um aviso |
| `ausente bloqueia` | `lerDoNas` devolve `null`: `bloquear` com `antiga_ausente` |
| `grupo sem linhas do item` | o filtro dá zero em todas as unidades: `registrar` com `unidades: []` e `sem_linhas` = os alvos; nenhuma cópia |
| `rota fora não deixa meio registro` | o site lança no `registrar`: `prepararCopias` lança (o chamador faz o script de falha) e nenhuma cópia sai |
| `comentários: marcas pelos comentários do mês` | grupo `texto` com comentários e marcas de um vídeo: as marcas dos comentários do vídeo saem; as de outros ficam |
| `expurgar --canal: recusas` | site responde `canal_guardado`: código 1, frase "esse canal foi guardado no arquivo; nada a apagar", nenhum arquivo gravado |
| `expurgar --canal: grava e imprime a linha` | remoção `pedido` com dois prefixos: grava o texto de `montarComandosDoCanal` em `~/Workspace/bythiagofigueiredo/.superpowers/sdd/manutencao-nas/comandos/expurgar-<8 primeiros do ref>.sh` (abertura exclusiva `wx`, modo `0o600`; existe: sufixo `-2`, `-3`) e devolve a linha `ssh forja 'bash -s' < '<arquivo>' > '<saidas>/expurgar-<ref8>-<AAAAMMDD-HHMM>.txt' 2>&1` |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. `expurgar.ts`** (o essencial; os tipos vêm das Tarefas 6 e 7):

```ts
// apps/web/src/lib/youtube/observatorio/arquivo/expurgar.ts
/**
 * Manutenção M9: o tempo `copiar` no Mac (02 §11.3; D-M9-4, D-M9-6). Lê a versão antiga do NAS (leitura por ssh), filtra o item,
 * serializa em TS, registra pela rota C14 e devolve as cópias para o script. Nunca escreve no NAS: quem grava é o script, rodado pelo dono.
 */
import { createHash } from 'node:crypto'
import { RespostaAbrir, RespostaRegistrar } from '../arquivo-mensal/expurgo-contrato'
import { filtrarUnidade, idsDeComentariosDoVideo, lerUnidadeGz, serializarUnidade, type UnidadeLida } from '../arquivo-mensal/expurgo-filtro'
import { refazerResumo } from '../arquivo-mensal/expurgo-resumo'
import { serializarResumo } from '../arquivo-mensal/resumo'
import type { PendenciaDoDono } from '../arquivo-mensal/pendencias'
import type { Filho } from '../arquivo-mensal/contrato'

export const RAIZ_DO_FILHO: Record<Filho, string> = { numerico: '/mnt/arquivo/escrita/numerico', texto: '/mnt/arquivo/escrita/texto' }
export const TETO_COPIA_BYTES = 64 * 1024 * 1024
export interface Copia { itemId: string; filho: Filho; caminho: string; sha256: string; base64: string }
export interface DepsExpurgo { lerDoNas(filho: Filho, caminho: string): Promise<Buffer | null>; site(passo: unknown): Promise<unknown>; agora(): Date }

const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')

export async function prepararCopias(itens: PendenciaDoDono[], d: DepsExpurgo): Promise<{ copias: Copia[]; avisos: string[] }> {
  const copias: Copia[] = []; const avisos: string[] = []
  for (const it of itens.filter(i => i.tempo === 'copiar' && i.itemId.startsWith('item:'))) {
    const itemId = Number(it.itemId.slice(5))
    const aberto = RespostaAbrir.parse(await d.site({ passo: 'abrir', item_id: itemId }))
    grupo: for (const g of aberto.grupos) {
      const lidas = new Map<number, UnidadeLida>()
      for (const a of g.alvos) {
        const partes: Buffer[] = []
        for (const f of a.arquivos) {
          const b = await d.lerDoNas(g.filho, f.caminho)
          const motivo = b === null ? 'antiga_ausente' : sha(b) !== f.sha256 ? 'antiga_divergente' : null
          if (motivo) {
            await d.site({ passo: 'bloquear', item_id: itemId, alvo_id: a.alvo_id, motivo })
            avisos.push(`obs:arquivo: ${it.itemId}: ${f.caminho} ${motivo === 'antiga_ausente' ? 'não está no NAS' : 'no NAS não é o registrado'}; alvo bloqueado (runbook, "alvo bloqueado")`)
            continue grupo
          }
          partes.push(b!)
        }
        const us = partes.map(lerUnidadeGz)
        lidas.set(a.alvo_id, { colunas: us[0]!.colunas, linhas: us.flatMap(u => u.linhas) })
      }
      const chaves = new Set(g.alvos[0]!.chaves)
      const comentarios = g.alvos.find(a => a.tabela === 'competitor_video_comments')
      const doVideo = aberto.kind === 'video' && comentarios ? idsDeComentariosDoVideo(lidas.get(comentarios.alvo_id)!, chaves) : undefined
      const unidades: Array<{ alvo_id: number; linhas_removidas: number; unidade: Record<string, unknown>; ser: ReturnType<typeof serializarUnidade>; tabela: string; filtrada: UnidadeLida }> = []
      const semLinhas: number[] = []
      for (const a of g.alvos) {
        const r = filtrarUnidade({ tabela: a.tabela, kind: aberto.kind, chaves, unidade: lidas.get(a.alvo_id)!, comentariosDoVideo: doVideo })
        if (r.removidas === 0) { semLinhas.push(a.alvo_id); continue }
        const ser = serializarUnidade(r.unidade, a.coluna_controle)
        if (ser.file_bytes > TETO_COPIA_BYTES) {
          await d.site({ passo: 'bloquear', item_id: itemId, alvo_id: a.alvo_id, motivo: 'grande_demais' })
          avisos.push(`obs:arquivo: ${it.itemId}: a versão nova de ${a.tabela} passa de 64 MB; alvo bloqueado`)
          continue grupo
        }
        unidades.push({ alvo_id: a.alvo_id, linhas_removidas: r.removidas, tabela: a.tabela, ser, filtrada: r.unidade, unidade: {
          classe: g.classe, tabela: a.tabela, canal: g.canal, mes: `${g.mes}-01`, row_count: ser.row_count, control_sum: ser.control_sum,
          hash_conteudo: ser.hash_conteudo, schema_fp: a.schema_fp, sha256_bytes: ser.sha256_bytes, csv_sha256: ser.csv_sha256,
          file_bytes: ser.file_bytes, partes: 1, min_key: null, max_key: null } })
      }
      const versaoResumo = (g.resumo?.versao ?? 0) + 1
      const filtradaDe = (alvo: number): UnidadeLida => unidades.find(u => u.alvo_id === alvo)?.filtrada ?? lidas.get(alvo)!
      const linhasResumo = refazerResumo({
        classe: g.classe, canal: g.canal, mes: g.mes, diasDoMes: g.dias_do_mes, versao: versaoResumo,
        unidades: g.alvos.map(a => ({ tabela: a.tabela, unidade: filtradaDe(a.alvo_id),
          hashConteudo: unidades.find(u => u.alvo_id === a.alvo_id)?.ser.hash_conteudo ?? a.hash_conteudo })),
        vazias: g.outras.map(o => ({ tabela: o.tabela, hashConteudo: o.hash_conteudo })),
        comentarios: comentarios ? filtradaDe(comentarios.alvo_id) : undefined,
      })
      const resumo = serializarResumo(linhasResumo)
      const arq = (p: 'canal' | 'video') => resumo.arquivos.find(x => x.papel === p) ?? null
      const resp = RespostaRegistrar.parse(await d.site({
        passo: 'registrar', item_id: itemId, classe: g.classe, canal: g.canal, mes: g.mes,
        unidades: unidades.map(u => ({ alvo_id: u.alvo_id, linhas_removidas: u.linhas_removidas, unidade: u.unidade })), sem_linhas: semLinhas,
        resumo: unidades.length === 0 ? undefined : { versao: versaoResumo, vazio: resumo.vazio,
          canal_sha256: arq('canal')?.sha256 ?? null, canal_bytes: arq('canal')?.bytes ?? null, canal_rows: arq('canal')?.linhas ?? null,
          video_sha256: arq('video')?.sha256 ?? null, video_bytes: arq('video')?.bytes ?? null, video_rows: arq('video')?.linhas ?? null },
      }))
      for (const u of resp.unidades) {
        const x = unidades.find(y => y.alvo_id === u.alvo_id)!
        if (x.ser.gz) copias.push({ itemId: it.itemId, filho: g.filho, caminho: u.caminho, sha256: x.ser.sha256_bytes, base64: x.ser.gz.toString('base64') })
      }
      if (resp.resumo) for (const f of resumo.arquivos) copias.push({ itemId: it.itemId, filho: g.filho,
        caminho: `${g.classe}/canais/${g.canal}/resumo/${g.mes}.v${resp.resumo.versao}.${f.papel}.csv.gz`, sha256: f.sha256, base64: f.gz.toString('base64') })
    }
  }
  return { copias, avisos }
}
```

`RespostaAbrir` (Tarefa 6) traz em cada alvo `hash_conteudo` (acrescentar ao `open` da Tarefa 3: `'hash_conteudo', u.hash_conteudo` no objeto do alvo; o teste `open devolve os alvos` passa a afirmá-lo). A rota C14 tem um passo `bloquear` (Tarefa 11) que chama `obs_archive_expurgo_block`.

`lerDoNas` de verdade: `execFile('ssh', ['forja', 'cat', '--', `${RAIZ_DO_FILHO[filho]}/${caminho}`], { encoding: 'buffer', maxBuffer: TETO_COPIA_BYTES * 2 })`, com o `caminho` já validado por `CAMINHO_SEGURO` (o leitor estrito); código de saída 1 com `No such file` no `stderr` → `null`; outro erro → lança (o `obs:arquivo` sai com o script de falha). É leitura (`cat`), permitida pela regra da forja.

**Ordem dentro do `obs:arquivo`** (D-F23): ler pendências → `prepararCopias` (avisos no `stderr`) → ler as pendências **de novo** (o registro mudou os tempos; o script sai do estado novo) → `scriptDasPendencias(l2, { versao, copias })` → `escreverTudo`. Uma cópia cujo item não está mais em `copiar` na segunda leitura (o registro o levou a `sem_comando`/`copiador`) entra mesmo assim: o script a grava em `_recebendo` sob o `item_id` dela, e o copiador a acha por `aguardando_dono`. `expurgar --item <id>` faz o mesmo para um item; `expurgar --item <id> --apagar-antigas` só imprime o script do item se ele estiver em `apagar_antigas` ou `conferir_b2`, e recusa com a frase do tempo atual nos outros (item 66: "recusa enquanto os três arquivos novos não estiverem `recebida`").

- [ ] **Passo 4. `cli.ts`:** subcomando `expurgar` com `--item <id>` (`^[1-9][0-9]{0,18}$`), `--apagar-antigas` (só com `--item`), `--canal <uuid>` (`UUID_RE`); qualquer outra combinação: código 2 e a ajuda. `--canal` chama a rota `GET pending` (C13) e usa o item `canal:<ref>` dela: ausente → pergunta à rota C14 (`passo: 'canal', channel_ref`) o motivo (`canal_desconhecido`, `canal_nao_removido`, `canal_guardado`, `sem_destino`) e devolve a frase; presente com `prefixos` → `montarComandosDoCanal({ channelRef, prefixos: <cada prefixo nos dois filhos, numerico e texto; o passo de diretório ausente é inofensivo>, raiz: RAIZ_DO_FILHO, geradoEm: agora })`, grava e imprime a linha.

- [ ] **Passo 5.** Rodar → PASS.

- [ ] **Passo 6. Commit** (quando mandado; o `expurgar` chama a rota C14, então entra **depois** da Tarefa 11 no `staging`, ou no mesmo envio): `git add -- apps/web/src/lib/youtube/observatorio/arquivo/expurgar.ts apps/web/test/youtube/observatorio/arquivo-expurgar.test.ts`; `git commit -m "feat: M9: obs:arquivo prepara as cópias do expurgo e expurgar --item/--canal" -- <os arquivos>`.

---

### Task 9: o kit da forja (`copiar.py`, `conferir.py`, `nome_b2.py`) e o arquivo de instalação do dono

**Files (git LOCAL `~/Workspace/forja/ferramentas`, sem remoto; commit por caminho):**
- Modify: `~/Workspace/forja/ferramentas/arquivo/copiador/copiar.py` (o copiador da M3b-forja; `grep -n "def attest\|prefixos\|plan" ~/Workspace/forja/ferramentas/arquivo/copiador/copiar.py` acha os pontos)
- Modify: `~/Workspace/forja/ferramentas/arquivo/conferir-b2/conferir.py`
- Create: `~/Workspace/forja/ferramentas/arquivo/conferir-b2/nome_b2.py`
- Modify: os testes do kit (`~/Workspace/forja/ferramentas/arquivo/*/test_*.py`, `python3 -m unittest`)
- Create: `.superpowers/sdd/manutencao-nas/comandos/m9-9-instalar-kit.sh` (do dono)

**Interfaces:**
- Consumes: `prefixos_ausentes` no plano do copiador (`obs_archive_plan`, fonte `nas`) e no plano do B2 (`obs_archive_b2_plan`, fonte `b2`), já preenchidos pelas injeções da Tarefa 4: lista de `{ alvo, filho, prefixo, e_prefixo }`; o `POST attest` aceita `prefixos: [{ alvo, filho, prefixo, resultado: 'prefixo_ausente'|'prefixo_presente'|'sem_acesso' }]` ao lado do corpo da M3b (no B2 com o `execucao_id` da execução que fez o controle negativo e os canários; no NAS com o `filhos.<filho>.montado/sentinela` que o copiador já manda) → `obs_archive_attest_prefixos(p_site, p_fonte, p_body)` (Tarefa 4); `B.nome_b2(filho, caminho)` do módulo do B2 da M3b-forja.
- Produces: `nome_b2.py <filho> <caminho>` imprime uma linha com o nome no balde (código 0) ou nada e código 1.

**O que acontece quando o dado não existe:** `prefixos_ausentes` ausente do plano (site antigo, antes da Tarefa 11): o copiador não atesta prefixo nenhum (os canais ficam em `apagado_nas`, pendência `sem_comando` com `falta 'conferencia_nas_recente'`), nunca "ausente" por omissão. NAS desmontado ou sem `.arquivo-vivo`: o copiador já para (M3b); o atestado de prefixo nem é tentado. Prefixo do B2 que dá erro de listagem: `sem_acesso`, que a função SQL não conta como prova.

- [ ] **Passo 1. Testes, falhando** (`unittest`, com o sistema de arquivos em pasta temporária e o B2 falso):

| Teste | Afirma |
|---|---|
| `test_prefixo_nas_ausente` | prefixo sem diretório (ou arquivo, quando `e_prefixo` é falso), NAS montado com sentinela: `{alvo, filho, prefixo, resultado:'prefixo_ausente'}` no attest de fonte `nas` |
| `test_prefixo_nas_presente` | diretório com um arquivo (ou só subdiretório vazio): `prefixo_presente` (diretório vazio que restou também é presença: o script do dono o remove) |
| `test_sem_sentinela_nao_atesta` | sem `.arquivo-vivo`: nenhum item em `prefixos` (a função SQL recusaria com `filho_fora` de todo jeito) |
| `test_b2_zero_versoes_ausente` | `b2_list_file_versions(prefix)` sem nenhuma versão, na execução com controle e canários bons: `prefixo_ausente`, com o `execucao_id` dela |
| `test_b2_hide_e_presente` | só uma versão `hide`: `prefixo_presente` (o painel tem de apagar as versões, CP32) |
| `test_b2_erro_sem_acesso` | a listagem lança: `sem_acesso` |
| `test_nome_b2` | `nome_b2.py texto serie/canais/<ref>/x.csv.gz` imprime o mesmo que `B.nome_b2('texto', ...)`; caminho com `..`: código 1 |

- [ ] **Passo 2.** Rodar (`cd ~/Workspace/forja/ferramentas/arquivo && python3 -m unittest -v > /tmp/m9-kit.txt 2>&1; grep -E "FAIL|ERROR" /tmp/m9-kit.txt`) → FAIL.

- [ ] **Passo 3. Código.** `copiar.py`, depois da passada normal e só se o plano trouxer `prefixos_ausentes`:

```python
def prefixos_nas(plano, raiz):
    """M9 (D-M9-8): prova de ausência no NAS. Só pergunta com o filho montado e com a sentinela; o site ainda confere (filho_fora)."""
    saida = []
    for p in plano.get("prefixos_ausentes") or []:
        filho, prefixo = p["filho"], p["prefixo"]
        if not CAMINHO_SEGURO.match(prefixo):
            continue
        base = os.path.join(raiz, filho)
        if not (os.path.ismount(base) and os.path.isfile(os.path.join(base, ".arquivo-vivo"))):
            continue
        alvo = os.path.join(base, prefixo)
        presente = os.path.lexists(alvo)
        saida.append({"alvo": p["alvo"], "filho": filho, "prefixo": prefixo,
                      "resultado": "prefixo_presente" if presente else "prefixo_ausente"})
    return saida


def prefixos_b2(plano, b2):
    """M9: no B2, zero versões de qualquer ação = ausente; hide = presente; erro de listagem = sem_acesso (nunca conta)."""
    saida = []
    for p in plano.get("prefixos_ausentes") or []:
        filho, prefixo = p["filho"], p["prefixo"]
        if not CAMINHO_SEGURO.match(prefixo):
            continue
        try:
            versoes = b2.listar_versoes(B.nome_b2(filho, prefixo))
            r = "prefixo_presente" if versoes else "prefixo_ausente"
        except Exception:
            r = "sem_acesso"
        saida.append({"alvo": p["alvo"], "filho": filho, "prefixo": prefixo, "resultado": r})
    return saida
```

`copiar.py` chama `prefixos_nas` depois da passada normal e põe o resultado no corpo do `attest` de fonte `nas` que ele já manda, como `prefixos` (vazio: a chave sai do corpo). `conferir.py` chama `prefixos_b2` **dentro da mesma execução** que fez o controle negativo e os canários (o `execucao_id` vai junto; fora dela a função SQL recusa com `controle_pendente`). `b2.listar_versoes` usa `b2_list_file_versions` com `prefix` e conta **todas** as ações (upload, hide, start, folder). `nome_b2.py`:

```python
#!/usr/bin/env python3
"""M9: traduz <filho> <caminho> no nome do arquivo no balde B2 (para o dono apagar no painel). Código 1 se o caminho não for seguro."""
import sys
sys.path.insert(0, "/opt/arquivo/conferir-b2")
import b2 as B  # o módulo do B2 da M3b-forja

def main(argv):
    if len(argv) != 3 or argv[1] not in ("numerico", "texto") or not B.CAMINHO_SEGURO.match(argv[2]):
        return 1
    print(B.nome_b2(argv[1], argv[2]))
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

(Se o módulo do B2 não se chamar `b2` ou não expuser `nome_b2`/`CAMINHO_SEGURO`, ajustar o import pelo `grep -rn "def nome_b2\|CAMINHO_SEGURO" ~/Workspace/forja/ferramentas/arquivo`; o teste `test_nome_b2` amarra.)

- [ ] **Passo 4.** Rodar → PASS.

- [ ] **Passo 5. Commit no kit:** `git -C ~/Workspace/forja/ferramentas commit -m "feat: M9: atestado de ausência por prefixo e nome_b2.py" -- arquivo/copiador/copiar.py arquivo/conferir-b2/conferir.py arquivo/conferir-b2/nome_b2.py <testes>` (depois de `git -C ... add` desses caminhos).

- [ ] **Passo 6. Arquivo de instalação do dono** (`comandos/m9-9-instalar-kit.sh`; o agente **não** roda): copia os três arquivos para `/opt/arquivo/...` com `install -m 0755`/`0644` (via `scp` do Mac para `/tmp/m9-kit/` e `sudo install` na forja, no mesmo padrão do arquivo de instalação da M3b-forja — copiar a forma dele, `grep -l "install -m" .superpowers/sdd/manutencao-nas/comandos/*.sh`), roda `python3 /opt/arquivo/conferir-b2/nome_b2.py texto serie/canais/00000000-0000-0000-0000-000000000000/x` e imprime `OK-M9-KIT` no fim. Linha curta: `bash .superpowers/sdd/manutencao-nas/comandos/m9-9-instalar-kit.sh > .superpowers/sdd/manutencao-nas/saidas/m9-9-$(date +%Y%m%d-%H%M).txt 2>&1`. Ordem P47: **depois** da Tarefa 11 em produção (o `attest` com `prefixos` antes da rota nova dá 400 e o copiador inteiro falha). O ledger anota a linha; ela vai ao dono só no dia (regra "comando só na hora").

---

### Task 10: o dia da migration (TRAVA M9-1 cai; o dono aplica)

**Files:**
- Create: `supabase/migrations/<timestamp>_manutencao_m9_expurgo.sql` (pelo `npm run db:new manutencao_m9_expurgo`; conteúdo = `apps/web/test/manutencao/m9.sql`)
- Modify: `apps/web/test/helpers/m9.ts` (passa a ler a migration, não `m9.sql`; `m9.sql` é apagado no mesmo commit)
- Modify: `.superpowers/sdd/manutencao-nas/m9-progresso.md`

- [ ] **Passo 1. Conferir as âncoras contra produção** (leitura): `npx supabase db query --linked "select p.proname, md5(p.prosrc) from pg_proc p where p.proname in ('obs_archive_remove_video','obs_archive_remove_comments','obs_archive_plan','obs_archive_b2_plan','obs_archive_removed_channel_list','obs_archive_record_core') order by 1" > /tmp/m9-md5-prod.txt`; comparar com as constantes da Tarefa 2/4/5. Diferente: **para** (a E9 ou a M3b mudou em prod depois da Tarefa 0); refazer a Tarefa 0 e as constantes. Leitura de produção negada no modo automático: o arquivo `comandos/m9-10-md5.sh` com essa linha vai ao dono, saída em `saidas/`.
- [ ] **Passo 2.** `npm run db:new manutencao_m9_expurgo`; copiar o conteúdo de `m9.sql`; trocar `aplicarM9` para ler `supabase/migrations/*_manutencao_m9_expurgo.sql`; `git rm apps/web/test/manutencao/m9.sql`.
- [ ] **Passo 3.** Rodar contra o `bythiago_int` do zero: `npm run db:int:reset` (ou o comando do `reference_banco_local_integracao`) e `HAS_LOCAL_DB=1 npx vitest run test/integration/manutencao-m9 > /tmp/m9-int.txt 2>&1; grep -E "FAIL|✗" /tmp/m9-int.txt` → sem falha; `m9-trava.test.ts` agora vê a migration (o `it.skipIf(!migrou)` roda e passa).
- [ ] **Passo 4.** `npx supabase migration list --linked > /tmp/m9-list.txt`; a última de prod é anterior ao timestamp novo (sem "out of order"). Commit (quando mandado): `git commit -m "feat: M9: migration do expurgo enxuto" -- supabase/migrations/<arquivo> apps/web/test/helpers/m9.ts apps/web/test/manutencao/m9.sql`.
- [ ] **Passo 5. O dono aplica:** `comandos/m9-10-push.sh` com `npm run db:push:prod` (pede `YES`; por isso não sai como arquivo para `bash` sem interação: a linha é `npm run db:push:prod`, a exceção do 05 §16 para comando interativo). Depois, leitura: `select count(*) from pg_proc where proname like 'obs_archive_expurgo%'` → 4. Ledger: "TRAVA M9-2 solta em <data>".

---

### Task 11: as rotas (C14 nova, C3/C4/C5/C13 ajustadas), o registro e o contrato r2.6

**Files:**
- Create: `apps/web/src/app/api/pipeline/archive/expurgo/route.ts`
- Modify: `apps/web/src/app/api/pipeline/archive/attest/route.ts`, `.../archive/plan/route.ts`, `.../archive/pending/route.ts`, `.../archive/record/route.ts` (os da M3b; `ls apps/web/src/app/api/pipeline/archive`)
- Modify: `apps/web/src/lib/pipeline/api-registry.ts` (entrada `POST /api/pipeline/archive/expurgo`, `endpoint_count` do domínio `archive` +1), `apps/web/src/lib/pipeline/leitura-rotas.ts` (C14 é escrita: **não** entra na lista de leitura; conferir que o teste do registro diz isso), `apps/web/data/pipeline-docs/cowork-docs-archive.md`
- Modify: `.superpowers/sdd/manutencao-nas/contrato-rotas-m3b.md` (r2.6)
- Create: `apps/web/test/app/api/pipeline/archive/expurgo-route.test.ts`

**Interfaces:**
- Consumes: `CorpoExpurgo` (Zod, Tarefa 6: união discriminada por `passo`: `abrir`, `registrar`, `bloquear`, `canal`); a autenticação de chave com papel `archive_owner` da M3b (`grep -rn "archive_owner" apps/web/src/lib/pipeline`), que dá o `siteId` da chave; as funções SQL `obs_archive_expurgo_open(p_site, p_item)`, `obs_archive_expurgo_record(p_site, p_item, p_body)`, `obs_archive_expurgo_block(p_site, p_item, p_alvo, p_motivo)` (Tarefa 3) e `obs_archive_attest_prefixos(p_site, p_fonte, p_body)` (Tarefa 4), chamadas por `getSupabaseServiceClient().rpc(...)` **depois** da verificação da chave (a rota é de pipeline, não de sessão). O passo `canal` só lê (`obs_archive_channel_removals` e `competitor_channels` pelo `siteId`).
- Produces: `POST /api/pipeline/archive/expurgo`; respostas 200 com o JSON da função; 409 `{ erro: <código> }` para as exceções `P0001` cujo texto começa por um código conhecido (`resumo_versao_mudou`, `mes_destacado_em_transito`, `expurgo_em_curso`, `contagem_divergente`, `alvo_fora_do_item`, `item_nao_em_copiar`); 400 para forma inválida; 401/403 da autenticação; 500 sem detalhe para o resto (Sentry).

**O que acontece quando o dado não existe:** `item_id` que não existe: a função lança `item_desconhecido` → 404. `passo: 'canal'` de uuid sem remoção: 200 `{ motivo: 'canal_desconhecido' }` (o CLI escreve a frase; não é erro de transporte). `attest` com `prefixos` ausente: igual à M3b (compatível); com `prefixos: []`: idem. `plan` num banco sem `obs_archive_prefixos_ausentes` (prod antes da migration): esta rota só sobe depois da Tarefa 10 (P47), e o teste de rota usa o banco de integração com a M9.

- [ ] **Passo 1. Testes, falhando** (`expurgo-route.test.ts`, `// @vitest-environment node`, `describe.skipIf(skipIfNoLocalDb())`, chave de teste semeada como na M3b):

| Teste | Afirma |
|---|---|
| `sem chave: 401; chave sem archive_owner: 403` | — |
| `abrir: devolve os grupos` | item semeado em `copiar`: 200 com `grupos[0].alvos[0].arquivos` e `hash_conteudo` |
| `registrar: 409 resumo_versao_mudou` | registrar com `resumo.versao` velho: 409 `{ erro: 'resumo_versao_mudou' }`, nada gravado (contagem de `obs_archive_units` igual) |
| `registrar: 400 forma` | `unidades[0].unidade.sha256_bytes` com 63 caracteres: 400 |
| `bloquear: grava o motivo` | 200; `obs_archive_owner_pending()` mostra o alvo em `bloqueado` com o motivo |
| `canal: motivo` | uuid novo: `{ motivo: 'canal_desconhecido' }` |
| `attest: aceita prefixos` | attest de fonte `nas` com `filhos.texto` montado e com sentinela e `prefixos: [{ alvo:'canal:<ref>', filho:'texto', prefixo:'serie/canais/<ref>/', resultado:'prefixo_ausente' }]`: 200, `prefixos[0].resposta 'aceito'` e `nas_absent_first_at` gravado na linha de `obs_archive_absence` |
| `attest: recusa prefixo inseguro` | `prefixo: '../x/'`: 400 |
| `record: 409 expurgo_em_curso` (C3) | registrar uma unidade do mês de um canal com item em `copiar`: 409 |
| `pending: versao 2` | `GET pending` devolve `versao: 2` e passa no `lerPendencias` (Tarefa 7) |
| `registro: archive tem endpoint_count certo` | o teste do registro (já existente) passa com a entrada nova |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. A rota:**

```ts
// apps/web/src/app/api/pipeline/archive/expurgo/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { CorpoExpurgo, type CorpoExpurgoT, type RespostaCanalT } from '@/lib/youtube/observatorio/arquivo-mensal/expurgo-contrato'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { autenticarArquivo } from '@/lib/pipeline/archive-auth' // o nome real: grep -rn "archive_owner" apps/web/src/lib/pipeline

const CODIGOS_409 = ['resumo_versao_mudou', 'mes_destacado_em_transito', 'expurgo_em_curso', 'contagem_divergente', 'alvo_de_outro_item', 'alvo_fora_de_copiar', 'sem_destino', 'canal_removido'] as const
type Rpc = { fn: string; args: Record<string, unknown> }
function chamada(site: string, c: Exclude<CorpoExpurgoT, { passo: 'canal' }>): Rpc {
  switch (c.passo) {
    case 'abrir': return { fn: 'obs_archive_expurgo_open', args: { p_site: site, p_item: c.item_id } }
    case 'registrar': { const { passo: _p, item_id, ...corpo } = c; return { fn: 'obs_archive_expurgo_record', args: { p_site: site, p_item: item_id, p_body: corpo } } }
    case 'bloquear': return { fn: 'obs_archive_expurgo_block', args: { p_site: site, p_item: c.item_id, p_alvo: c.alvo_id, p_motivo: c.motivo } }
  }
}

async function motivoDoCanal(site: string, ref: string): Promise<RespostaCanalT> {
  const sb = getSupabaseServiceClient()
  const r = await sb.from('obs_archive_channel_removals').select('archive_decision, completed_at').eq('site_id', site).eq('channel_ref', ref).maybeSingle()
  if (r.error) throw new Error('leitura_falhou')
  if (r.data) return { motivo: r.data.archive_decision === 'guardar' ? 'canal_guardado' : r.data.archive_decision === 'apagar' ? 'ok' : 'sem_destino' }
  const c = await sb.from('competitor_channels').select('id').eq('site_id', site).eq('id', ref).maybeSingle()
  if (c.error) throw new Error('leitura_falhou')
  return { motivo: c.data ? 'canal_nao_removido' : 'canal_desconhecido' }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await autenticarArquivo(req, 'archive_owner')
  if (!auth.ok) return NextResponse.json({ erro: auth.erro }, { status: auth.status })
  const corpo = CorpoExpurgo.safeParse(await req.json().catch(() => null))
  if (!corpo.success) return NextResponse.json({ erro: 'forma', detalhe: corpo.error.issues.map(i => i.path.join('.')) }, { status: 400 })
  try {
    if (corpo.data.passo === 'canal') return NextResponse.json(await motivoDoCanal(auth.siteId, corpo.data.channel_ref), { status: 200 })
    const { fn, args } = chamada(auth.siteId, corpo.data)
    const { data, error } = await getSupabaseServiceClient().rpc(fn, args)
    if (error) {
      const codigo = CODIGOS_409.find(c => error.message.startsWith(c))
      if (codigo) return NextResponse.json({ erro: codigo }, { status: 409 })
      if (error.message.startsWith('item_desconhecido')) return NextResponse.json({ erro: 'item_desconhecido' }, { status: 404 })
      throw new Error(`rpc ${error.code}`)
    }
    return NextResponse.json(data, { status: 200 })
  } catch (e) {
    Sentry.captureException(e, { extra: { rota: 'archive/expurgo', passo: corpo.data.passo } })
    return NextResponse.json({ erro: 'interno' }, { status: 500 })
  }
}
```

(Nomes reais de `autenticarArquivo`, do campo `siteId` e de `getSupabaseServiceClient` saem da rota `attest` da M3b, que já faz o mesmo; o teste `sem chave: 401` amarra. Os códigos 409 são os da Tarefa 3: se o texto da exceção mudar lá, muda aqui.) Ajustes nas rotas da M3b: `attest` aceita `prefixos` (Zod: `z.array(z.object({ alvo: z.string().regex(/^(item:[1-9][0-9]{0,18}|canal:[0-9a-f-]{36}|antiga:[0-9a-f-]{36})$/), filho: z.enum(['numerico','texto']), prefixo: z.string().regex(CAMINHO_SEGURO), resultado: z.enum(['prefixo_ausente','prefixo_presente','sem_acesso']) }).strict()).max(2000).optional()`, deixando de responder `400 VALIDATION_ERROR` a elas, C10) e, quando presentes, chama `obs_archive_attest_prefixos(p_site, <fonte do attest>, <corpo inteiro>)` depois do attest existente, devolvendo `prefixos` na mesma resposta; `plan` e `b2/plan` não mudam de código (as funções SQL já devolvem `prefixos_ausentes` preenchido, Tarefa 4), só o teste do formato; `pending` idem (a função já devolve `versao 2`); `record` mapeia `expurgo_em_curso` para 409.

- [ ] **Passo 4. Registro, doc e contrato.** Entrada em `api-registry.ts` copiando a forma da entrada de `archive/attest` (método, caminho, `scope`, descrição "expurgo enxuto: abrir, registrar, bloquear e consultar canal (M9)") e `endpoint_count` +1; seção nova em `cowork-docs-archive.md` com os quatro passos, corpos e códigos (o mesmo texto do C14); `contrato-rotas-m3b.md` r2.6: C14 inteiro, C10 marcado "resolvido pela M9 (D-M9-6)", C3 com `409 expurgo_em_curso`, C4 com `prefixos`, C5 com `prefixos_ausentes`, C12/C13 `versao 2`.

- [ ] **Passo 5.** Rodar a rota, o registro (`npx vitest run test/lib/pipeline > /tmp/m9-reg.txt 2>&1; grep -E "FAIL|✗" /tmp/m9-reg.txt`) e a Tarefa 7 juntos → PASS. Typecheck web (`npm run typecheck -w apps/web > /tmp/m9-tc.txt 2>&1; tail -5 /tmp/m9-tc.txt`).

- [ ] **Passo 6. Commit** (quando mandado, depois de "TRAVA M9-2 solta", **junto** com a Tarefa 7, num envio): `git commit -m "feat: M9: rota archive/expurgo (C14), prefixos no attest e no plan, contrato r2.6" -- <arquivos>`.

---

### Task 12: a tela (peça 7 na fila e "Canais removidos" na página do Arquivo)

**Files:**
- Modify: o componente da peça 7 da E9 (`grep -rln "_saiu\|peca7\|Peça 7" apps/web/src/app/cms apps/web/src/components`) e a página do Arquivo da M5 (`grep -rln "pendenciasParaTela" apps/web/src/app/cms`)
- Create: `apps/web/src/app/cms/(authed)/youtube/observatorio/arquivo/_components/canais-removidos.tsx` (o caminho exato segue a pasta da página da M5)
- Create: `apps/web/src/app/cms/(authed)/youtube/observatorio/arquivo/actions-m9.ts` (server actions `marcarRodado`, `desfazerRodado`)
- Create: `apps/web/test/cms/observatorio/canais-removidos.test.tsx` (`// @vitest-environment jsdom`), `apps/web/test/cms/observatorio/actions-m9.test.ts` (`// @vitest-environment node`)

**Interfaces:**
- Consumes: `obs_archive_removed_channel_list` com os estados novos (Tarefa 4); `pendenciasParaTela` com `falta`/`motivo` (Tarefa 7); `obs_archive_marcar_rodado(p_site uuid, p_item_id text, p_actor uuid, p_desfazer boolean)` (Tarefa 5; ela mesma confere admin com `obs_archive_is_site_admin`, e a action confere antes, defesa em profundidade); `obs_archive_arquivos_do_canal(p_ref)` (Tarefa 5); `montarComandosDoCanal` (Tarefa 6); `requireSiteAdmin`/`canAdminSite` do CMS; o componente `CmsLink` (`src/app/cms/(authed)/_shared/cms-link.tsx`) e os componentes da M5 (`grep -rn "export function" <pasta da página da M5>/_components`: régua, selo de estado, bloco de comandos).
- Produces: `<CanaisRemovidos linhas={...} podeApagar={boolean} onMarcar onDesfazer />`; `marcarRodado(itemId: string): Promise<{ ok: true } | { ok: false; erro: string }>`, `desfazerRodado(itemId: string)` idem, com `itemId` = `canal:<uuid>`, `item:<id>` ou `antiga:<uuid>` (o mesmo `item_id` das pendências).

**Fonte do desenho:** o mockup aprovado da fase (`docs/superpowers/mockups/<pasta da manutenção>/peca7.js` e `arquivo.js`, bloco `CMDHTML`; `ls docs/superpowers/mockups | grep -i manut`). Textos copiados dele; onde o mockup não cobre um estado da M9, a frase vem do `02` §11.3 e a peça vai ao Logan e à Naksu antes do dono (regra do time).

**O que acontece quando o dado não existe:** `obs_archive_removed_channel_list` sem linhas: o bloco mostra "Nenhum canal removido" (cinza, não verde); erro de leitura: "não medido" (cinza com ⓘ "o site não conseguiu ler a lista; recarregue"), nunca lista vazia; linha com `prefixos` vazio em `apagar_antigas`: "Ver os comandos" fica desabilitado com "o site ainda não sabe os prefixos; espere a próxima passada do copiador".

- [ ] **Passo 1. Testes, falhando:**

| Teste | Afirma |
|---|---|
| `estados com cor estável` | uma linha por estado (`pedido`, `copiando`, `apagado_nas`, `apagado_b2`, `concluido`, `guardado`): selo com o texto do mockup e a classe de cor fixa (cinza/âmbar/verde), `aria-label` com o texto |
| `idade: âmbar 30, vermelho 60` | `pedido` há 31 dias: âmbar; há 61: vermelho; há 29: neutro (fake timers) |
| `só admin vê Apagar do arquivo` | `podeApagar=false`: sem o botão e sem "Ver os comandos" (E-D4) |
| `Ver os comandos: 5 passos` | abre o bloco com os 5 passos do `montarComandosDoCanal` e o botão de copiar a linha curta |
| `Já rodei / Desfazer` | clique chama a action recebida por prop (não importada no client) e mostra "marcado às HH:MM"; erro da action: frase do erro, estado anterior |
| `vazio e erro` | lista vazia: "Nenhum canal removido"; `linhas = null` (erro): "não medido" |
| `actions: exigem admin` | `marcarRodado` sem admin: `{ ok: false, erro: 'sem_permissao' }` e o `rpc` não é chamado; com admin: chama `obs_archive_marcar_rodado` com `{ p_site, p_item_id: 'canal:<uuid>', p_actor: <id do usuário>, p_desfazer: false }`; `desfazerRodado`: `p_desfazer: true`; `item_id` fora do formato: `{ ok: false, erro: 'forma' }` |

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. Código.** `actions-m9.ts`:

```ts
'use server'
import { z } from 'zod'
import { requireSiteAdmin } from '@/lib/cms/auth' // o caminho real: grep -rn "export async function requireSiteAdmin" apps/web/src
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

const ItemId = z.string().regex(/^(item:[1-9][0-9]{0,18}|canal:[0-9a-f-]{36}|antiga:[0-9a-f-]{36})$/)
async function marcar(itemId: string, desfazer: boolean): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = ItemId.safeParse(itemId)
  if (!r.success) return { ok: false, erro: 'forma' }
  const { siteId } = await getSiteContext()
  const usuario = await requireSiteAdmin(siteId).then(u => u, () => null)
  if (!usuario) return { ok: false, erro: 'sem_permissao' }
  const { error } = await getSupabaseServiceClient().rpc('obs_archive_marcar_rodado', { p_site: siteId, p_item_id: r.data, p_actor: usuario.id, p_desfazer: desfazer })
  return error ? { ok: false, erro: error.message.startsWith('sem_permissao') ? 'sem_permissao' : 'interno' } : { ok: true }
}
export async function marcarRodado(itemId: string) { return marcar(itemId, false) }
export async function desfazerRodado(itemId: string) { return marcar(itemId, true) }
```

(Se `requireSiteAdmin` do projeto receber outro argumento — post, não site — ou não devolver o usuário, usar o equivalente de admin de site da página da M5 e ler o usuário pela sessão, achado pelo `grep -n "requireSiteAdmin\|canAdminSite" <page.tsx da M5>`; o teste `actions: exigem admin` amarra.) `canais-removidos.tsx` é `'use client'`, recebe `linhas`, `podeApagar`, `onMarcar`, `onDesfazer` por props (a página passa as actions); cores literais (`#…`/`rgba`, nunca `color-mix`, memória do Opera); régua de idade; frase-resumo no topo ("2 canais esperando você, o mais antigo há 34 dias"). A peça 7 da fila E9 ganha a contagem de `apagar_antigas` + `conferir_b2` + bloqueados (vermelho se algum bloqueado) e o `CmsLink` para a página do Arquivo.

- [ ] **Passo 4.** Rodar → PASS. Typecheck web.

- [ ] **Passo 5. Validação de tela:** Gio (agente `gio-qa`, Sonnet) abre o CMS local autenticado com a semente da M9 (um canal em cada estado) e devolve o veredito em texto, capturas em `docs/superpowers/mockups/<pasta>/m9-shots/`; Logan e Naksu revisam o implementado contra o mockup; o dono confere no Opera (`open -a Opera <url>`), roteiro no `ROTEIRO-DE-TESTE-E-MELHORIAS.md`.

- [ ] **Passo 6. Commit** (quando mandado): `git commit -m "feat: M9: canais removidos na página do Arquivo e na peça 7" -- <arquivos>`.

---

### Task 13: os blobs das remoções na tarefa `tamanho_do_banco` (atrás de `OBS_ARQUIVO_LIMPEZA_CANAL`)

**Files:**
- Modify: `apps/web/src/lib/youtube/observatorio/arquivo/remover.ts` (função nova `retentarBlobsDeRemocoes`, ao lado de `retentarMiniaturasPendentes`, `remover.ts:122`, reusando `apagarDoBlobPadrao`, `PREFIXO_DAS_MINIATURAS` e o filtro de prefixo de `remover.ts:45`)
- Modify: o ponto da tarefa `tamanho_do_banco` que chama `retentarMiniaturasPendentes` (`grep -rn "retentarMiniaturasPendentes" apps/web/src`)
- Modify: `apps/web/test/manutencao/m9.sql` (parte 5, antes da Tarefa 10): `obs_archive_removal_blobs_done`
- Modify: `apps/web/test/youtube/observatorio/<teste existente de remover.ts>` (`grep -rln "retentarMiniaturasPendentes" apps/web/test`), `docs/ops/env-vars.md`

**Interfaces:**
- Consumes: `obs_archive_channel_removals.blobs_pending text[]` (M3b, `supabase/rascunhos/m3b.sql:204-222`, preenchido na remoção por `obs_archive_channel_blobs`, `m3b.sql:2426`); `DepsDoBlob` (`remover.ts:22`).
- Produces: `retentarBlobsDeRemocoes(sb: SupabaseClient, o: { agoraMs: number; maximo: number; prazoMs: number }, deps?: DepsDoBlob & { env?: NodeJS.ProcessEnv }): Promise<NovaTentativa>` (mesmo tipo de `remover.ts:116`; `{ porque: 'flag_desligada' }` sem a variável); SQL `obs_archive_removal_blobs_done(p_site uuid, p_ref text, p_urls text[]) returns int` (tira as URLs de `blobs_pending`, devolve quantas ficaram).

**O que acontece quando o dado não existe:** variável ausente ou diferente de `'on'`: `{ porque: 'flag_desligada' }`, nada lido nem apagado (default desligado; a linha da tarefa diz por quê). Sem `BLOB_READ_WRITE_TOKEN`: `{ porque: 'sem_token' }` como a irmã. `blobs_pending = '{}'`: a linha nem é lida (filtro `not eq '{}'`, como `remover.ts:137`). URL fora do prefixo: não apagada, conta em `foraDoPrefixo` e **fica** em `blobs_pending` (o canal não chega a `concluido`, Tarefa 4 exige `cardinality = 0`; a pendência mostra `falta 'blobs'` e o runbook diz como baixar à mão). Falha do Blob: a URL fica pendente, a próxima rodada tenta; nunca lança.

- [ ] **Passo 1. Testes, falhando** (no teste existente de `remover.ts`, com `sb` falso):

| Teste | Afirma |
|---|---|
| `sem a variável não tenta` | `delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL`: `{ porque: 'flag_desligada' }`, `sb.from` não chamado (regra "env com fallback") |
| `com 'off' não tenta` | idem |
| `com 'on' apaga e baixa` | duas remoções com URLs no prefixo: `apagarDoBlob` por bloco; `rpc('obs_archive_removal_blobs_done', { p_site, p_ref, p_urls })` com as apagadas |
| `fora do prefixo fica` | uma URL fora: não apagada, não baixada, `foraDoPrefixo 1` |
| `falha não baixa` | `apagarDoBlob` lança no primeiro bloco: sem `rpc` desse bloco; o segundo canal segue |
| `prazo` | `agora` além de `agoraMs + prazoMs` depois do primeiro canal: para, devolve o parcial |

E no SQL (integração, parte 5): `blobs_done tira só as URLs dadas` (três pendentes, baixa duas: fica uma, devolve 1; URL que não estava: ignorada); `sem EXECUTE para anon` (como o teste de grants da Tarefa 1).

- [ ] **Passo 2.** Rodar → FAIL.

- [ ] **Passo 3. Código.** SQL (parte 5 do `m9.sql`):

```sql
create or replace function public.obs_archive_removal_blobs_done(p_site uuid, p_ref text, p_urls text[])
returns int language plpgsql security definer set search_path = '' as $$
declare v_restam int;
begin
  update public.obs_archive_channel_removals r
     set blobs_pending = coalesce((select array_agg(u) from unnest(r.blobs_pending) u where u <> all (p_urls)), '{}'::text[])
   where r.site_id = p_site and r.channel_ref = p_ref
  returning cardinality(r.blobs_pending) into v_restam;
  return coalesce(v_restam, 0);
end $$;
revoke all on function public.obs_archive_removal_blobs_done(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.obs_archive_removal_blobs_done(uuid, text, text[]) to service_role;
```

TS (`remover.ts`), a mesma forma de `retentarMiniaturasPendentes`, lendo outra tabela:

```ts
/** M9 (D-M9-13): nova tentativa diária dos blobs dos canais removidos (obs_archive_channel_removals.blobs_pending). Só com OBS_ARQUIVO_LIMPEZA_CANAL='on'. Nunca lança. */
export async function retentarBlobsDeRemocoes(
  sb: SupabaseClient,
  o: { agoraMs: number; maximo: number; prazoMs: number },
  deps: DepsDoBlob & { env?: NodeJS.ProcessEnv } = {},
): Promise<NovaTentativa> {
  try {
    if ((deps.env ?? process.env).OBS_ARQUIVO_LIMPEZA_CANAL !== 'on') return { porque: 'flag_desligada' }
    if (e2e()) return { porque: 'e2e' }
    if (!deps.apagarDoBlob && !process.env.BLOB_READ_WRITE_TOKEN) return { porque: 'sem_token' }
    const apagarDoBlob = deps.apagarDoBlob ?? apagarDoBlobPadrao
    const agora = deps.agora ?? Date.now
    const lido = await sb.from('obs_archive_channel_removals')
      .select('site_id, channel_ref, blobs_pending')
      .not('blobs_pending', 'eq', '{}')
      .order('decided_at', { ascending: true })
      .limit(50)
    if (lido.error) return { porque: 'leitura_falhou' }
    let apagadas = 0, pendentes = 0, foraDoPrefixo = 0, usadas = 0
    for (const r of (Array.isArray(lido.data) ? lido.data : []).filter(ehObjeto)) {
      const urls = Array.isArray(r.blobs_pending) ? r.blobs_pending.filter((u): u is string => typeof u === 'string') : []
      const { dentro, fora } = separarPorPrefixo(urls)
      foraDoPrefixo += fora.length; pendentes += urls.length
      for (const bloco of blocos(dentro, 100)) {
        if (usadas >= o.maximo || agora() - o.agoraMs > o.prazoMs) return { apagadas, pendentes: pendentes - apagadas, foraDoPrefixo }
        try {
          await apagarDoBlob(bloco)
          const b = await sb.rpc('obs_archive_removal_blobs_done', { p_site: r.site_id, p_ref: r.channel_ref, p_urls: bloco })
          if (!b.error) apagadas += bloco.length
        } catch { /* fica pendente; a próxima rodada tenta */ }
        usadas += bloco.length
      }
    }
    return { apagadas, pendentes: pendentes - apagadas, foraDoPrefixo }
  } catch {
    return { porque: 'erro' }
  }
}
```

`separarPorPrefixo` e `blocos` são o filtro de `remover.ts:40-50` e o fatiamento de `remover.ts:95-100`, extraídos para funções no mesmo arquivo **se** ainda estiverem embutidos (refatoração sem mudança de comportamento; os testes existentes de `retentarMiniaturasPendentes` provam). A coluna de ordem é `decided_at` (`m3b.sql:204-222`; se o nome for outro, o `grep -n "decided_at\|requested_at" supabase/rascunhos/m3b.sql` da Tarefa 0 acerta). A tarefa `tamanho_do_banco` chama `retentarBlobsDeRemocoes` logo depois de `retentarMiniaturasPendentes`, com o mesmo `o`, e escreve o resultado na mesma linha de diário (com `flag_desligada` visível).

- [ ] **Passo 4.** Rodar → PASS. `env-vars.md`: "`OBS_ARQUIVO_LIMPEZA_CANAL` — `on` liga a nova tentativa diária dos blobs dos canais removidos (M9); ausente ou outro valor: desligado; ligar só depois de um canal de teste de ponta a ponta (P47, passo 5)".

- [ ] **Passo 5. Commit** (quando mandado): `git commit -m "feat: M9: blobs dos canais removidos na tarefa tamanho_do_banco, atrás de OBS_ARQUIVO_LIMPEZA_CANAL" -- <arquivos>`.

---

### Task 14: deploy na ordem P47, runbook, cobertura dos itens e promoção

**Files:**
- Create: `docs/ops/runbook-arquivo-mensal.md` (se a M3b já o criou: Modify, seção "Expurgo enxuto (M9)")
- Modify: `.superpowers/sdd/manutencao-nas/m9-progresso.md`
- Create: `apps/web/test/manutencao/m9-cobertura.test.ts`

- [ ] **Passo 1. Teste de cobertura dos itens** (`m9-cobertura.test.ts`, com banco de integração): um `it` por item do `02` que a M9 fecha, cada um chamando a função dona e afirmando o efeito: 65 (vídeo removido → item com alvos), 66 (`--apagar-antigas` recusa fora do tempo: Tarefa 8, aqui só a função `obs_archive_apagar_do_alvo` recusa sem `b2_ok`), 67 (`competitor_removed_items` nunca é podado: depois de `item_advance` até `concluido`, a linha continua lá), 109/110/111 (canal: `pedido` → `apagado_nas` → `apagado_b2` → `concluido` só com atestados), 120 (retenção sem registro para em `apagado_nas`), 161/163/165 (versão antiga superada sai em `antiga:<uuid>` só depois de 30 dias e com a nova conferida). Os testes que já existem nas Tarefas 3–5 são reaproveitados por nome; este arquivo só junta os que faltam e lista a tabela de cobertura num comentário no topo.

- [ ] **Passo 2. Runbook** (seção nova): o ciclo mensal com expurgo (o `obs:arquivo` mostra `copiar` → o dono roda a linha → o copiador confere → `apagar_antigas` → linha → `conferir_b2` → painel → atestado), "alvo bloqueado" (restaurar do B2/snapshot, `select public.obs_archive_expurgo_unblock(<item>, <alvo>)` no painel), "canal removido" (5 passos de "Ver os comandos" e `expurgar --canal`), "retenção" (`select public.obs_archive_registrar_retencao_snapshot(14)` no painel — 14 dias, lido em `decisoes-dono-14-10`), e o que fazer quando o `obs:arquivo` sai com `versao` errada (o site e o Mac em versões diferentes: promover o que falta).

- [ ] **Passo 3. Deploy P47** (cada passo no ledger com data e quem):
  1. Tarefa 10 (migration; dono).
  2. Tarefas 7 + 11 (leitor/script v2 e rotas; um envio para `staging`, CI verde, promoção para `main`). Entre 1 e 2, o `obs:arquivo` antigo do Mac lê `versao 2` e sai com o script de falha: janela curta e esperada; anotar no ledger o horário dos dois.
  3. Tarefa 9 (kit; dono roda o arquivo de instalação).
  4. Tarefas 8, 12 (Mac e tela; um envio).
  5. Tarefa 13 com a variável ainda ausente; depois de um ciclo inteiro limpo (um canal de teste de ponta a ponta), o dono liga `OBS_ARQUIVO_LIMPEZA_CANAL=on` no Vercel.
- [ ] **Passo 4. Retenção:** a linha do painel do passo 2 vai ao dono no dia em que o primeiro canal chegar a `apagado_nas` (antes disso não há o que destravar).
- [ ] **Passo 5. Revisão final:** Phil e Yannis (agentes `phil-dados`, `yannis-software`) revisam o lote inteiro antes da promoção; conserta-se até acordo; Hanna confere a amarração do release com a M8 (passo 19 da M8 consome o `concluido` da M9).

---

## NÃO VERIFICADO (conferir na execução; cada item tem o passo que o resolve)

1. Corpo, nomes de variáveis (`v_canal`, `v_youtube_id`, `v_alvo`) e âncoras das funções da E9 em produção: a E9 hoje está só no worktree `wt-e9` (HEAD 37617d174), fora de `staging` e de `main`. Tarefa 0 lê; Tarefa 10 confere md5 contra prod.
2. As constantes md5 das injeções (Tarefas 2, 4, 5): preenchidas na Tarefa 0; o plano não as traz.
3. Raiz do NAS vista da forja para leitura pelo Mac: assumida `/mnt/arquivo/escrita/<filho>` (padrão `ARQ_MONTAGEM_ESCRITA` da M3b-forja). Tarefa 0, arquivo de leituras do dono, confere com `ls`.
4. Colunas dos CSV usadas pelo filtro (`video_id`, `id`, `parent_id`, `comment_id`, `first_seen_at`, `snap_date`, `taken_at`, `hour_slot`, `last_seen_at`): tiradas do contrato da M3b; o teste de ouro da Tarefa 6 amarra contra `obs_archive_summary_rows`.
5. O nome do campo do plano (C5) que manda o copiador pedir o manifesto da versão nova: a Tarefa 3 assume que o fluxo de manifesto da M3b cobre a unidade `recebida` vinda de `_recebendo`; se não cobrir, a Tarefa 5 ganha um teste e a função `obs_archive_plan` mais uma injeção.
6. Se a reconferência da M3b exclui versões `superseded_at` não nulas (senão ela pede a antiga que já saiu e acusa falta).
7. Se o painel do B2 apaga **todas** as versões de um arquivo (CP32); o atestado conta `hide` como presente justamente para não aceitar meio apagamento.
8. A função de nome no B2 (`B.nome_b2`) e o nome do módulo Python (Tarefa 9, Passo 3).
9. O nome da coluna de ordem de `obs_archive_channel_removals` (`decided_at` assumido) e se `remover.ts` já tem o filtro de prefixo e o fatiamento como funções (Tarefa 13).
10. Empates de `ts` no resumo refeito (Tarefa 6, teste de ouro) e o tamanho máximo que passa pelo pipe do `ssh ... cat` e pelo heredoc em base64 (teto 64 MiB por arquivo assumido; medir com o maior mês real na Tarefa 0).
11. O caminho do lote E10 no NAS (`falta 'lote_e10'`): só a frase; a M9 não mexe no lote.

## Dependências de outras etapas e trilhas

- **E9 em produção** (TRAVA M9-0): hoje nem em `staging`. Sem ela a M9 não começa (as injeções não têm onde entrar).
- **M3b em produção** e **M3b-forja Tarefa 7a** (o `pendencias-script.ts`, `apaga_conferido`, `obs:arquivo` no Mac): a Tarefa 7 estende código que só existe depois delas.
- **M5** (página do Arquivo e componentes): Tarefa 12. **M6**: a saída de canal da M6 é quem cria os canais removidos que a M9 limpa (Travas).
- **M10b**: `video_antigo` fica `bloqueado` com `depende_m10b` até ela (D-M9-14).
- **M8**, passo 19: consome o `concluido` da M9.
- **Dono**: migration (Tarefa 10), kit da forja (Tarefa 9), retenção no painel (Tarefa 14), variável no Vercel (Tarefa 14), toda escrita no NAS e no B2.

## Self-review (feito)

- Cobertura: itens 65, 66, 67, 109, 110, 111, 120, 161, 163, 165 com dono (Tarefa 14, Passo 1); C10 resolvido (Tarefa 11); D-M9-1..14 cada uma com tarefa.
- Placeholders: as constantes md5 e os caminhos achados por `grep` são preenchidos na execução por passo explícito (Tarefa 0), não deixados em aberto.
- Tipos: `PendenciaDoDono` (Tarefa 7) ↔ `prepararCopias` (Tarefa 8); `Copia` (Tarefa 8) ↔ `scriptDasPendencias({ copias })` (Tarefa 7); `CorpoExpurgo` (Tarefa 6) ↔ rota (Tarefa 11); `obs_archive_marcar_rodado(p_ref, p_rodado)` (Tarefa 5) ↔ actions (Tarefa 12).
