# A5, X3: coleta de playlists e seções dos canais concorrentes (plano de implementação)

Escrito em 17/10/2026 (trem 6). **1º rascunho com a 1ª revisão aplicada** (Phil e Yannis: aprovado com consertos, seção "Consertos da 1ª revisão" abaixo; a 2ª rodada (re-revisão Sonnet de Phil e Yannis) aplicada em seguida, seção "Consertos da 2ª rodada"; falta a re-revisão final). Sem tela.

**Origem e liberação.** O dono reabriu a decisão 32 em 17/10 ("siga com as recomendações"). Pareceres:
`.superpowers/sdd/a5/noite/decisoes-17-10-phil.md` (item 1), `decisoes-17-10-yannis.md` (item 1), `decisoes-17-10-hanna.md`
(item 1); estado da coleta em `.superpowers/sdd/a5/noite/coleta-estado-17-10.md` (linha X3). Esboço antigo: spec da A5,
`docs/superpowers/specs/2026-10-12-observatorio-a5/01-coleta-concorrentes.md` §4.4 (retirada na v2.3; o arquivo está no checkout
principal) e itens de aceite 24 a 26 (riscados lá, **reabertos aqui** como A-24 a A-26, seção 9).

**Objetivo, em três frases.** Uma vez por semana e por canal concorrente, ler as playlists públicas do canal (menos a de
envios, `UU…`), os itens de cada uma e as seções da página inicial, e gravar **só a mudança**: playlist nova, playlist sumida,
renomeação, item que entrou, item que saiu, seções trocadas. Cada leitura tem teto de unidades por canal e um estado
honesto (`ok`, `parcial`, `erro`) por canal e por playlist; lista incompleta nunca apaga nem marca "saiu". A coleta nasce
**desligada** (`OBS_X3_PLAYLISTS` diferente de `on`), e as tabelas novas entram no export da E10 e na remoção do canal
desde a migration.

**Fica FORA.**
- Tela, mockup, rota de pipeline, Cowork, contexto para IA: nada. (Pipeline Integrity não se aplica.)
- A pergunta "o vídeo entrou numa série antes de subir?" (P2/P3 do spec) é leitura futura; aqui só o dado.
- Apagar item de playlist quando o dono apaga um vídeo pela fila "Saíram do YouTube" (E9): **não** entra (desvio D-3, ponto
  aberto P-3).
- X4 (partes grátis do `videos.list`) já está no código (`competitor-sync.ts:28`); X1/X2/X5 têm migration própria
  (`20261016000003`). Este plano não toca nenhum dos dois.

---

## Consertos da 1ª revisão (Phil e Yannis, 17/10)

Pareceres: `.superpowers/sdd/a5/noite/t6-x3-portao-phil.md` (7 I + 7 M) e `t6-x3-portao-yannis.md` (4 I + 6 M). Tudo aplicado
abaixo; onde o corpo do plano diz outra coisa, vale o corpo (já emendado). Decisões do controlador: tempos pelo mais estrito
(60 s / 50 s); cota por visita, falha em `cota_nao_registrada`, teto do dia lido de `youtube_quota_usage`; P-1 1ª opção + `last_cycle_at`;
P-2 mantém 40/10/600; P-3 D-3; P-4 capa fora do hash e resposta inteira na versão; P-5 todos no 1º dia. T0 sai do caminho crítico.

| Achado | O que mudou | Onde |
|---|---|---|
| Phil I-1 | `p_complete` de itens só com todas as páginas **e** `totalResults` presente e igual ao lido; senão `parcial` `contagem_difere`; saída em massa (> metade dos presentes e > 5) fica `saida_em_massa_a_confirmar` e outro dia confirma | §4.4 passo 4, §4.5, T5, Apêndice (`items_record`, coluna `mass_exit_day`) |
| Phil I-2 = Yannis I-3 | `recordQuota` por visita, depois do `visit_close`; falha soma em `detalhe.cota_nao_registrada`; teto do dia lido de `youtube_quota_usage` (dia do Pacífico), não de `last_units` | §4.6, §5, T4 (`unidadesDeHoje` sai), T6 |
| Phil I-3 = Yannis I-1 | chamada nova até 60 s, canal novo até 50 s; fórmula e teste amarrado a `BANCO_MS` e ao `fimAteMs` | §4.6, §5, T3, T5 |
| Yannis I-2 | `comecaAteMs` da definição = 50 000 (sai `adiada` `sem_tempo`, não gasta tentativa); teste de igualdade | §4.6, T6 |
| Phil I-4 / P-1 | motivo recuperável × estrutural; `last_cycle_at`; alarme `canais_sem_volta_14d` | §4.5, §4.6, §12, T4, T6, Apêndice (`last_cycle_at`, `p_ciclo`) |
| Phil I-5 | teste de RLS por comportamento (GUC forjado, anon 42501, uma política por tabela) | T1 (`observatorio-a5-x3-rls.test.ts`) |
| Phil I-6 | `removed_after` (itens), `prev_seen_at` (versões de playlist e de seção) | §4.1, Apêndice |
| Phil I-7 / C1 | volume medido pelo `itemCount`, projeção `soma × 330 B`, portão 15 MB; vira a conferência x3-d1 (fora do caminho crítico) | §3.2, §10 T0, T8 |
| Yannis I-4 | a migration **não** fica aplicada no `bythiago_int`; `garantirX3` aplica 2× dentro de `begin … rollback` | T1 passo 4, T2 |
| Phil M-1 a M-7 | 1º vazio a confirmar; `canais_com_secoes`; `note`; `total: null`; falha de leitura = `erro`; perda da ordem no §12; volta com export | §4.5, T3, T5, T6, T8, §12, §2 |
| Yannis M-1 | `visit_close` e `items_record` monotônicos | Apêndice |
| Yannis M-2 | `position` reescreve a playlist; frase corrigida, aceito | §4.1, Apêndice |
| Yannis M-3 | `ops.lerCanal` na borda | T5 |
| Yannis M-4 | `ligaCom` antes do retorno antecipado; testes das duas variáveis ausentes | T6 |
| Yannis M-5 | `unidadesJaGastasHoje` entra como dado no planejador | T4 |
| Yannis M-6 | "última versão" por `observed_at desc, id desc limit 1` | Apêndice |
| P-1 a P-5 | decididos (seção 13) | §13 |
| Q1 do Phil | medida em 17/10 (leitura horária em produção, 89 rodadas em 7 dias): p50 2,5 s, p90 3,3 s, p99 5,2 s; não aperta o orçamento de 50 s | §5 |

---

## Consertos da 2ª rodada (re-revisão de Phil e Yannis, 17/10, TK)

Pareceres: `.superpowers/sdd/a5/noite/t6-x3-rerevisao-yannis.md` (J1 a J5 e menores) e `t6-x3-rerevisao-phil.md` (N1 a N5). Tudo aplicado;
onde o corpo diz outra coisa, vale o corpo. Harmonização do controlador: J1 = N1, J3 = N2 (uma coluna só, `items_complete_at`), J2 + N5, J5 + N4.

| Achado | O que mudou | Onde |
|---|---|---|
| J1 = N1 | **devido** = `last_cycle_at` nulo, **ou** 7 dias ou mais, **ou** `last_cycle_at < last_visit_at` (visita que não fechou a volta), e uma visita por dia (não lê `last_reason`); **playlist devida** = `items_read_at` nulo ou 6 dias ou mais (mais a que ficou com motivo recuperável em dia anterior, senão a saída em massa nunca confirmaria no dia seguinte); `p_ciclo` só com `playlists_left = 0`, lista completa (ou vazia já confirmada) e nenhum motivo recuperável na visita inteira, calculado por `calcularCiclo` (puro, com teste); estruturais (`teto_itens`, `contagem_difere`, `itens_incoerentes`) sempre estruturais, sem "duas visitas"; `lerCanais` devolve `items_status`/`items_reason` por playlist | §4.4 (0, 4), §4.5, §4.6, T4, T5, Apêndice `p_ciclo` |
| J3 = N2 | coluna **`items_complete_at`** em `competitor_playlists`, carimbada só com `p_complete` **e** sem saída em massa pendente; `removed_after` = o valor anterior dela (nulo = "sem leitura completa anterior"); `items_read_at` só ordena a fila; x3-d30 aceita `removed_after` nulo nessa razão | §4.1, §4.2, T1, T8, §11, Apêndice |
| J2 + N5 | portão monotônico no **topo** de `items_record` (`p_now` < `items_read_at` → devolve `{atrasada: true}` sem tocar em itens nem em `removed_since`) e em `playlists_record` (`p_now` < `max(last_seen_at)` do canal → `atrasada`) | §4.2, §6, T1, Apêndice |
| J5 + N4 | `recordQuota` com `Promise.race` contra `BANCO_MS`, dentro de `try/finally` depois do `visit_close` (a cota entra mesmo se o fecho lançar); estouro ou erro = `cota_nao_registrada`; teste com promessa que nunca resolve | §4.4 passo 6, §4.6, T5 |
| Phil N5 (leitura) | falha ao ler `youtube_quota_usage` no começo do `rodar` = `erro` `gravacao_falhou`, nunca 0 (linha ausente do dia = 0 legítimo) | §4.5, §4.6, §6, T6 |
| Phil N3 / Yannis (extra) | `extra: { x3_teto_por_canal: 1 }` só nas visitas cortadas pelo teto; a soma (`p_add`) dá o número de visitas cortadas do dia | §4.6, T5, T6 |
| J4 | coluna `first_visit_at` em `competitor_playlist_reads` (só no 1º insert); `canais_sem_volta_14d` conta `coalesce(last_cycle_at, first_visit_at) < now() - 14 d` (tarefa e x3-d7) | §4.1, §4.6, T4, T6, §11, Apêndice |
| Yannis: `distinct on` | insert de versões com `distinct on (playlist_id)` | Apêndice (`playlists_record`), T1 |
| Yannis: tri-state | `p_lista_vazia` e `p_secoes_vazias` nulos preservam `empty_streak`/`sections_empty_streak`; `false` zera; `true` soma | §4.2, T1, Apêndice |
| Yannis: `lerCanais` | uma leitura **por disparo** (3 consultas com `in`: leituras, playlists, estado das seções), no lugar de `lerCanal` por canal | §4.4 (0), §4.6, T5, T6 |
| Yannis: 1ª chamada barrada | se o relógio barra a **1ª** chamada à API da visita, ela não chama `visit_close` nem entra em `feitas` | §4.4 passo 5, T5 |
| Yannis: `naoTerminouVermelhoEm` | 6 → **9** | §4.6 |
| Dívidas declaradas (Yannis) | `position` reescreve a playlist com item no topo; `unfinished_n` compartilhado entre `parcial` e `adiada`: aceitos, no §12 | §12 |

---

## 0. Dependências e avisos de topo

| O que uso | Forma exata | Fonte (lida em 17/10, base `0bf87b417`) |
|---|---|---|
| Agenda da E16 | `Tarefa`/`Definicao`, `periodo: 'dia'`, peso `leve` (`LEVE_COMECA_ATE_MS` 75 s, teto `fimAteMs` 90 s), `tarefasDesligadas(env, catalogo)` usado pelo executor **e** pelo vigia | `agenda/tipos.ts`, `agenda/definicoes.ts:163-205`, `agenda/executar.ts:284`, `agenda/saude.ts:45-80` |
| Retomada com progresso não gasta tentativa | `competitor_agenda_runs.attempts` "retomada com progresso não soma" | `supabase/migrations/20261013000001_…agenda_despacho.sql:10` |
| Linhas de canal da agenda | `ContextoTarefa.linhas` = `semPausados(loadBatchRows())`: já sem canal pausado; traz `missing_since` | `agenda/executar.ts:270-277`, `competitor-sync-batch.ts:73-85, 278` |
| Guarda de schema | `schemaTablesReady(sb, grupos, { signal })` → `ausente`/`nao_conferido` | `competitor-health.ts:63` |
| Cota | `recordQuota(sb, { siteId, nowMs, units, mode, extra, max })` na linha do dia do Pacífico | `competitor-quota.ts` |
| Bruto por mudança | padrão da X1: tabela `…_raw` com `state_sha256`, `raw jsonb`, `observed_at`; função `…_record` com `pg_advisory_xact_lock` por chave e insert só se o último hash difere | `20261016000003_observatorio_a5_x1_x2_x5_estado_proprio.sql:7-122` |
| Hash canônico | `canonicalJson`, `sha256Hex`, `sanitizeForDb` | `competitor-capture.ts:43-91` |
| Registro do export | `obs_archive_registry()` com **22** entradas, definido **uma vez só** (MG6); `obs_archive_uncovered()` varre as chaves em cascata a partir de `competitor_channels`; `obs_archive_register` e `competitor_channel_remove_archived` recusam com `E10:tabela_sem_export` | `20261014000002_observatorio_a5_e10_export_pausa_e_limite.sql:308-409, 474-476, 642-644` |
| Conferência independente da remoção | `pg_stat_xact_user_tables.n_tup_del` por tabela do fecho de cascata, igual ao `row_count` do lote | idem, 693-747 |
| Lista de identidade da recarga | `TABELAS_COM_IDENTIDADE` em `arquivo/cli.ts:210`; a integração confere contra o catálogo | `test/integration/observatorio-a5-e10-migration.test.ts:706` |
| Helper da MG6 nos testes | `garantirMg6` **reaplica a MG6 inteira** em cada teste (recria o registro com as 22) e depois o bloco 11 da M2 | `test/helpers/mg6.ts:30-40` |
| Contagem da fila E9 | `competitor_cascade_counts('canal', id)` lê o catálogo até o nível 2; recusa nível 3 e chave composta nos níveis 1 e 2 | `20261015000001_…e9_apagar_o_que_saiu.sql:72-150` |

**Avisos.**
- **O SQL do Apêndice A não foi rodado** por quem escreveu (só leitura). A Tarefa 1 o roda duas vezes **dentro de `begin … rollback`**
  no `bythiago_int` (54422), com a trava `/tmp/claude-501/int-db.lock`; a migration **não fica aplicada** lá até o lote estar em
  `staging` (Yannis I-4). Erro achado corrige o apêndice no mesmo commit.
- **Fatos da API não medidos** (seção 3.2): formato de `channelSections` hoje, `pageInfo.totalResults` de `playlistItems`
  com vídeo apagado, se o `etag` da playlist muda quando muda um item, e o número real de playlists e itens por canal (o risco do
  Phil: "a conta usa 10 por canal"). O último vira a conferência x3-d1, com portão de 15 MB (seção 3.2, C1); os outros têm teste de forma e conferência com data.
- **Escrita em produção:** `db:push:prod` depois do portão (o agente roda, regra do dono de 15/10); `OBS_X3_PLAYLISTS=on` na
  Vercel só depois do deploy do código e da migration (seção 2).

## 1. Perguntas ao dono

Nenhuma trava o plano. O padrão vale sem resposta:
1. Ler playlists de **todos** os canais na primeira semana, já no dia em que a coleta ligar (padrão: sim, é o dado que
   expira; a cota cabe, seção 5).
2. Itens de vídeos de **outros** canais dentro das playlists de um concorrente: gravar o id (padrão: sim, só o id de 11
   caracteres e o canal dono do vídeo, nunca título nem miniatura; "visível nos outros = público", 14/10).

## 2. O que é do dono, e a ordem do envio

1. Portão Phil + Yannis sobre este plano (antes da Tarefa 1).
2. Código em `staging` → `main` (a coleta desligada, a migration ainda não aplicada: a tarefa sai `desligada` no vigia e
   nada é chamado).
3. `npm run db:push:prod` (agente, depois do portão do lote; a migration só foi testada dentro de `rollback`, nunca aplicada no `bythiago_int`). **Antes:** `npx supabase migration list --linked` mostra a X3
   como única pendente. A migration é aditiva e inerte: tabelas vazias, funções sem chamador, o registro do export com 5
   entradas a mais e as 22 de hoje iguais.
4. Ligar: `OBS_X3_PLAYLISTS=on` em Production na Vercel e redeploy (a medição C1 ampliada vem em seguida, x3-d1; passando de 15 MB projetados, desligar e voltar ao Phil). Anotar a data em `X3_LIGADA` (Tarefa 8).
   **Não depende do ensaio T13 da E10:** canal pausado não é lido (as linhas da agenda vêm sem pausados e as funções do
   banco recusam canal pausado), então um lote exportado antes da X3 continua batendo com o banco; a Tarefa 2 prova isso.
5. Desligar (volta): apagar a variável ou pôr qualquer valor diferente de `on`. O dado fica; nada apaga. Desfazer a migration (`drop` das cinco tabelas e das funções) **apaga o que foi coletado**: só depois de um export da E10 dos canais ou com a perda aceita por escrito pelo dono (Phil M-7).

## 3. Fatos de que o desenho depende

### 3.1 Medidos ou lidos

- Cron de concorrentes a cada 20 min (`apps/web/vercel.json:39`); a agenda roda dentro dele, uma pesada por disparo e as
  leves em sequência depois da leitura horária (até 60 s).
- Custo da Data API: `playlists.list`, `playlistItems.list` e `channelSections.list` custam 1 unidade por chamada; até 50
  resultados por página nas duas primeiras; `channelSections` não pagina.
- `playlistItems.snippet.publishedAt` = quando o item entrou na playlist (retroação parcial: entrada sim, saída não).
- Os concorrentes não gravam `youtube_sync_log` (essa tabela é dos canais próprios, `route.ts:296`); o registro da
  coleta dos concorrentes é `competitor_agenda_runs` + `cron_health` + `youtube_quota_usage`. A X3 segue esse.
- Volume (Phil/Hanna): ~0,15 MB/ano por canal, ~3,6 MB/ano com 24 canais, ~11 MB com 3×. Contra o alerta de ~455 MB/ano
  da horária, X3 é menos de 1%.

### 3.2 Conferências pendentes

| # | O quê | Quem/quando | Muda o quê |
|---|---|---|---|
| C1 (ampliada, Phil I-7) | Playlists **e itens** por canal: `playlists.list?part=contentDetails&channelId=…&maxResults=50` paginado, somando `itemCount` (⌈P/50⌉ unidades por canal, ~30 a 50 no total). Anotar no `progress.md`: playlists e itens por canal (máximo, mediana, soma) e a projeção `soma_itens × 330 B` da 1ª leitura (~200 B de tupla + ~80 B da chave + ~50 B do `idx_cpli_site_video`) | controlador, conferência **x3-d1** (depois de ligar; **fora do caminho crítico**) | portão: projeção acima de **15 MB**, ou canal com mais de ~300 playlists, desliga a coleta e volta ao Phil (propor: tirar `idx_cpli_site_video`, que hoje não tem consumidor, e baixar `paginasDeItensPorPlaylist`) |
| C2 | `channelSections.list` ainda devolve itens para canal com seções (formato, `type`, `contentDetails.playlists`) | Tarefa 0, 1 unidade num canal | se a API devolver vazio para todos, as seções saem do escopo (desvio, anotado) e a guarda de "vazio suspeito" impede gravar estado falso; depois de ligar, `canais_com_secoes` no detalhe da tarefa tem de ser > 0 (x3-d7, Phil M-2) |
| C3 | `playlistItems` com vídeo apagado ou privado: o item vem (título "Deleted video"/"Private video") e `pageInfo.totalResults` bate com o lido? | x3-d1 (D+1 da ligação) | se não bater, a regra de "contagem difere = parcial" vira nota, não parcial (emenda); até lá a contagem divergente **protege** (sem `removed_since`), é a escolha segura |
| C4 | O `etag` da playlist muda quando muda um item? | x3-d7 | se mudar, pular a leitura dos itens de playlist com `etag` igual (economia; dívida, não entra agora) |

## 4. Desenho

### 4.1 Tabelas (Apêndice A)

Cinco tabelas, todas com `site_id` e todas penduradas em `competitor_channels` por chave em cascata (diretamente ou pela
playlist). Nenhuma chave estrangeira para `competitor_videos`: item de playlist pode ser vídeo de outro canal.

| Tabela | Uma linha por | Muda como |
|---|---|---|
| `competitor_playlist_reads` | canal | estado da última visita (dia de São Paulo, `ok`/`parcial`/`erro`, motivo, unidades, playlists que ficaram, última volta completa `last_complete_at` e última volta **terminada** `last_cycle_at`, `first_visit_at` (1ª visita, nunca muda), contadores de "vazio a confirmar") |
| `competitor_playlists` | playlist do canal (`unique (competitor_channel_id, playlist_id)`; `check` recusa `UU…`, `LL…`, `FL…`) | `last_seen_at` e `item_count` no lugar; `missing_since` só com lista completa; estado da leitura dos itens (`items_read_at` só para a ordem da fila, `items_complete_at` = última leitura **completa** sem saída em massa pendente, `items_status`, `items_reason`, `mass_exit_day`) |
| `competitor_playlist_versions` | estado distinto da playlist (título, descrição, idioma, privacidade, localizações) | insert só quando o hash muda (padrão X1); a 1ª linha é "pelo menos desde"; `raw` guarda o item inteiro da API sem `etag` (capa e `itemCount` de cada versão ficam de graça, P-4); `prev_seen_at` = quando o estado anterior foi visto pela última vez |
| `competitor_playlist_items` | item de playlist (`primary key (playlist_ref, item_id)`; o `item_id` do YouTube muda se o vídeo sai e volta) | `position` no lugar quando muda; `removed_since` só com leitura completa e confirmada da playlist, com `removed_after` (o `items_complete_at` anterior da playlist: a saída foi entre as duas; nulo = sem leitura completa antes); reaparecer limpa os dois; `note` do criador |
| `competitor_channel_sections` | estado distinto da vitrine (lista de seções ordenada por posição) | insert só quando o hash muda; `prev_seen_at` = `last_visit_at` anterior do canal |

`competitor_playlists.id` é `uuid` (não o id do YouTube): o mesmo canal pode estar em dois sites, e o índice antigo do
esboço (chave = id do YouTube) quebraria isso. Itens não guardam `last_seen_at`: item sem `removed_since` está presente desde a última `items_read_at` com `items_status = 'ok'`.
Atenção (Yannis M-2): `position` **reescreve a playlist inteira** quando entra item no topo (~7 mil updates por semana no pior caso,
com tupla morta); aceito para ~24 canais. Reavaliar com 3× canais.

**RLS** (padrão do Observatório, memória "RLS GUC-spoof"): `select` só com `public.can_edit_site(site_id)`; `anon` sem nada;
`authenticated` sem escrita; escrita só pelas funções, que são `security invoker` e executáveis só por `service_role`.

### 4.2 Funções do banco (Apêndice A)

| Função | Faz | Recusa |
|---|---|---|
| `competitor_x3_playlists_record(p_site, p_channel, p_now, p_rows, p_complete)` | upsert das playlists vistas; versão nova quando o hash muda (com `prev_seen_at`); com `p_complete` marca `missing_since` nas não vistas e limpa nas que voltaram; devolve `{playlist_id → id}`; portão monotônico (`p_now` < `max(last_seen_at)` do canal → `{atrasada: true}`, nada gravado) | canal fora do site, ausente (`missing_since`) ou pausado (`collection_paused_at`) → `X3:canal_indisponivel`; linha `UU…` → `check` (23514) |
| `competitor_x3_items_record(p_site, p_channel, p_playlist, p_now, p_rows, p_complete, p_status, p_reason)` | upsert dos itens; com `p_complete` marca `removed_since` (+ `removed_after`) nos não vistos, salvo saída em massa (> metade e > 5), que fica a confirmar por outro dia; grava o estado da leitura na playlist e carimba `items_complete_at` só com `p_complete` sem saída em massa; **portão monotônico no topo** (`p_now` mais velho que `items_read_at` → `{atrasada: true}`, nada gravado) | idem; playlist de outro canal → `X3:playlist_de_outro_canal` |
| `competitor_x3_sections_record(p_site, p_channel, p_now, p_sha, p_raw)` | insert só se o último hash do canal difere | idem |
| `competitor_x3_visit_close(p_site, p_channel, p_now, p_status, p_reason, p_units, p_left, p_lista_vazia, p_secoes_vazias, p_ciclo)` | grava/atualiza a linha de `competitor_playlist_reads`; grava `first_visit_at` só no 1º insert; contadores de vazio tri-state (`p_lista_vazia`/`p_secoes_vazias` nulo preserva, `false` zera, `true` soma); carimba `last_complete_at` só com `ok` e `last_cycle_at` com `ok` ou `p_ciclo`; monotônico em `last_visit_at` (visita atrasada não sobrescreve a mais nova) | idem |

Cada função toma `pg_advisory_xact_lock(hashtextextended('x3:' || p_channel, 0))` antes de escrever (duas visitas do mesmo
canal não se cruzam; a agenda já garante uma tomada por período, isto é defesa).

### 4.3 O registro do export (portão duro)

A migration **recria** `obs_archive_registry()` com as 22 entradas de hoje **copiadas do corpo da MG6** (único
`create or replace` dela no repositório; a Tarefa 1 confere com `grep -l obs_archive_registry supabase/migrations/*`) e cinco
a mais, no fim, pai antes de filho: `competitor_playlist_reads`, `competitor_playlists`, `competitor_playlist_versions`,
`competitor_playlist_items`, `competitor_channel_sections`. Antes de recriar, um bloco `do` lê o registro **instalado** e
recusa se o conjunto de nomes não for exatamente as 22 de hoje ou as 27 (reaplicação): alguém que mexer no registro em
outra migration faz a X3 parar em vez de apagar a entrada dele. Depois, o mesmo `revoke`/`grant` da MG6 sobre a função.

Sem isso, `obs_archive_uncovered()` passa a devolver as cinco tabelas novas e export e `remover` recusam para **todo**
canal (Yannis, D-I1 da E10). A conferência independente da remoção (`n_tup_del`) cobre as tabelas novas sozinha, porque
lê o catálogo. `TABELAS_COM_IDENTIDADE` ganha `competitor_playlist_versions` e `competitor_channel_sections`.

### 4.4 A visita de um canal (código)

Ordem das chamadas, com o contador de unidades da visita (`u`) e o teto `RULES.x3.unidadesPorVisita`:
0. `ops.lerCanais(siteId, channelIds)` (Yannis M-3, J-menor): **uma vez por disparo**, 3 consultas com `in` (leituras de `competitor_playlist_reads`,
   playlists presentes, estado das seções). Por canal: playlists presentes (`id`, `playlist_id`, `items_read_at`, `items_status`, `items_reason`,
   `item_count`, `missing_since`), `empty_streak`, `sections_empty_streak`, `ultima_secao_vazia`. **Falha na leitura = tarefa `erro`, nunca "nenhuma
   vista"** (Phil M-5; senão a tarefa releria os 24 canais, ~290 unidades).
1. `channelSections.list?part=snippet,contentDetails&channelId=…` (u+1).
2. `playlists.list?part=snippet,contentDetails,status,localizations&channelId=…&maxResults=50&pageToken=…` até acabar o
   `nextPageToken` (u+1 por página). Filtra `UU`, `LL`, `FL` no código **e** o `check` do banco recusa.
3. Grava a lista (`competitor_x3_playlists_record`) com `p_complete` verdadeiro **só se** todas as páginas vieram, nenhuma
   falhou, o teto não cortou, `pageInfo.totalResults` bate (ausente = `total: null`, nunca comparado com 0) e a lista não é "vazia a confirmar" (4.5).
4. Para cada playlist **devida** (`items_read_at` nulo ou de 6 dias ou mais, ou com motivo recuperável gravado em dia anterior; a de menos de 6 dias é pulada, a volta de 7 dias tem jitter de cron), na ordem `items_read_at` mais antigo primeiro (nulo antes): `playlistItems.list?part=snippet,contentDetails,status&playlistId=…&maxResults=50`,
   até `RULES.x3.paginasDeItensPorPlaylist` páginas (u+1 por página). Grava ao fim de cada playlist (o que foi lido fica
   mesmo se o tempo acabar). `p_complete` só quando (a) todas as páginas vieram sem erro e sem corte **e** (b) `pageInfo.totalResults`
   está presente e é igual ao número de itens lidos (antes do descarte de `videoId` inválido); (b) falhou → `items_status = 'parcial'`,
   `items_reason = 'contagem_difere'`, sem `removed_since`.
5. Para quando `u` alcança o teto (antes de começar a chamada que passaria dele) ou quando o relógio da tarefa manda
   (nenhuma chamada nova depois de `chamadaComecaAteMs`, seção 4.6).
   Se o relógio barra a **1ª** chamada à API do canal, a visita não começou: não chama `visit_close` e não entra em `feitas`.
6. `try { competitor_x3_visit_close(…, p_ciclo) } finally { recordQuota(…) }`: a cota **daquela visita** entra mesmo se o fecho lançar; o
   `recordQuota` corre contra `Promise.race` de `BANCO_MS` (estouro ou erro = `cota_nao_registrada`, a visita não cai; J5, N4).
   `playlists_left` = playlists devidas não lidas nesta visita. `p_ciclo = calcularCiclo(visita)` (puro): verdadeiro só se `playlists_left = 0`, a lista
   veio completa (ou vazia já confirmada) e **nenhuma** playlist nem a lista ficou com motivo recuperável (4.5).

O que se grava de cada item: `item_id`, `youtube_video_id` (11 caracteres, conferido), `position`, `added_at`
(`snippet.publishedAt`), `video_published_at` (`contentDetails.videoPublishedAt`), `video_owner_channel_id`, `privacy`
(`status.privacyStatus`) e `note` (`contentDetails.note`, texto do criador, quase sempre vazio, sanitizado com `sanitizeForDb`).
Nunca o título nem a descrição do item.

O hash da playlist (`state_sha256`) é do recorte `snippet` sem `thumbnails` e sem `publishedAt`, mais `status` e
`localizations`, sem `etag` e sem `contentDetails.itemCount` (contagem muda a cada vídeo novo e viraria versão por semana;
ela vai na coluna `item_count`). As miniaturas da playlist mudam quando muda o primeiro vídeo: fora do hash (P-4, decidido: a troca de
capa **sozinha** não gera versão, perda aceita e escrita no §12), mas o `raw` da versão guarda o item **inteiro** sem `etag`
(miniaturas e `itemCount` inclusos), então a capa de cada versão fica de graça.
O hash das seções é da lista ordenada por `snippet.position`, cada uma sem `etag`.

### 4.5 "Dado ausente nunca vira ok vazio" e "lista cortada é parcial"

| Situação | Grava | Estado da visita |
|---|---|---|
| Resposta sem `items` (array) ou fora da forma | nada daquela chamada | `erro`, `resposta_invalida` (se nada gravado na visita) ou `parcial` |
| Erro HTTP ou tempo esgotado no meio da paginação das playlists | as playlists vistas (`last_seen_at`), **sem** `missing_since` | `parcial`, `lista_cortada` |
| Teto de unidades antes de acabar as páginas das playlists | idem | `parcial`, `teto_por_canal` |
| Lista completa e vazia (**inclusive o 1º vazio de canal sem histórico**, Phil M-1) | nada de `missing_since`; `empty_streak + 1` | `parcial`, `lista_vazia_a_confirmar` |
| Segunda leitura completa e vazia seguida, em outro dia | `missing_since` nas presentes (se havia); zera o contador | `ok` (custa 2 unidades a mais, uma vez por canal) |
| `pageInfo.totalResults` maior que o lido com a paginação acabada | as vistas, sem `missing_since` | `parcial`, `contagem_difere` |
| Itens: erro ou tempo no meio | os itens lidos, sem `removed_since`; playlist `items_status = 'parcial'` | `parcial`, `itens_cortados` |
| Itens: mais páginas que o teto por playlist | idem, `items_reason = 'teto_itens'` | `parcial`, `teto_itens` |
| Itens: lista vazia com `item_count > 0`, **ou** com `item_count` nulo e itens já presentes (Phil M-1) | nada, `items_status = 'parcial'` | `parcial`, `itens_incoerentes` |
| Itens: leitura completa mas `totalResults` ausente ou diferente do lido (Phil I-1) | os itens lidos, sem `removed_since`; `items_status = 'parcial'` | `parcial`, `contagem_difere` |
| Itens: leitura completa em que a saída atinge mais da metade dos presentes (e mais de 5) | os itens lidos, **sem** `removed_since`; `mass_exit_day` = hoje | `parcial`, `saida_em_massa_a_confirmar`; a visita seguinte, de outro dia, confirma e grava `removed_since` |
| Falha ao ler o estado do canal no banco (`lerCanais`), `competitor_playlist_reads` (Phil M-5) ou `youtube_quota_usage` (Phil N5) | nada | `erro`, `gravacao_falhou`; nunca "nenhum visto" nem unidades 0 (linha ausente do dia = 0 legítimo; erro de leitura não) |
| Playlist some entre a lista e os itens (404 `playlistNotFound`) | nada; `items_status = 'erro'`; **não** marca `missing_since` (só a lista completa marca) | `parcial`, `playlist_sumiu_no_meio` |
| Seções: lista vazia e havia seção | não grava a versão vazia; `sections_empty_streak + 1` | `parcial`, `secoes_vazias_a_confirmar` |
| `403 quotaExceeded` | o que já foi lido | visita `parcial`/`erro`, `cota_esgotada`; a tarefa **para** (nenhum outro canal) |
| Teto de playlists da visita cortou (sobrou playlist sem leitura de itens) | o lido | `parcial`, `teto_por_canal`, `playlists_left = n`; o canal volta a ser devido **no dia seguinte** e continua pelas mais antigas |

`last_complete_at` só é carimbado com visita `ok` (lista completa, todas as playlists com itens `ok`, seções gravadas ou
iguais).

**Motivos recuperáveis × estruturais, devido e volta (Phil I-4, P-1; 2ª rodada J1 = N1).** Recuperáveis: `lista_cortada`, `cota_esgotada`, `sobrou`,
`itens_cortados`, `teto_por_canal` com `playlists_left > 0`, `lista_vazia_a_confirmar`, `lista_*_a_confirmar`, `secoes_vazias_a_confirmar`,
`saida_em_massa_a_confirmar`, `erro`. Estruturais, **sempre** (sem "duas visitas seguidas": o motivo anterior por playlist não é gravado): `teto_itens`,
`contagem_difere`, `itens_incoerentes`; a visita fica `parcial` honesta e o retorno natural é o da semana seguinte.
- **Playlist devida:** `items_read_at` nulo ou de 6 dias ou mais; também a que ficou com `items_status` `parcial`/`erro` e motivo recuperável gravado em dia
  anterior (senão a confirmação da saída em massa esperaria 6 dias). `playlists_left` = devidas não lidas nesta visita.
- **`p_ciclo = true`** só se, ao fim da visita, `playlists_left = 0`, a lista veio completa (ou vazia já confirmada) e nenhum motivo recuperável apareceu na visita
  inteira (lista, seções ou qualquer playlist). Canal de 400 playlists com teto 40 nunca carimba `last_cycle_at` por isso (`playlists_left > 0`).
- **Canal devido** = `last_cycle_at` nulo, **ou** de 7 dias ou mais, **ou** `last_cycle_at < last_visit_at` (visita que não fechou a volta), e `last_visit_day`
  anterior a hoje em São Paulo (uma visita por canal por dia, no máximo). Não lê `last_reason`: `contagem_difere` numa playlist não esconde a saída em massa de outra.
- **Alarme do disparo:** `canais_sem_volta_14d` = canais com `coalesce(last_cycle_at, first_visit_at) < now() - 14 dias` (J4: canal que nunca terminou a volta
  também conta, a partir da 1ª visita), nunca por condição que ninguém consegue consertar.

### 4.6 A tarefa na agenda

`playlists_semanais`, rótulo "playlists e seções dos concorrentes", `ordem: 5.7` (depois de `marcas_de_idade`, antes das
pesadas), peso `leve`, período `dia`, `aPartirDaHoraSP: 7`, `tetoTentativas: 12`, `toleranciaVigiaH: 36`,
`naoTerminouVermelhoEm: 9`, `comecaAteMs: 50_000` (= `X3_RULES.canalComecaAteMs`, escrito por extenso porque `definicoes.ts` não importa código de coleta; teste confere a igualdade), `fimAteMs: 85_000`, **`ligaCom: 'OBS_X3_PLAYLISTS'`** (campo
novo da `Definicao`: a tarefa só liga com o valor exato `on`; ausente, vazio, `ON`, `1` ou qualquer outro valor = desligada).
`tarefasDesligadas` passa a pôr na lista as tarefas com `ligaCom` sem `on` (**a regra vem antes do retorno antecipado** de
`OBS_AGENDA_TASKS_OFF` ausente, Yannis M-4; o tipo do catálogo vira `Pick<Tarefa, 'nome' | 'nuncaDesliga' | 'ligaCom'>`; o catálogo
recusa definição com `ligaCom` **e** `nuncaDesliga`), e devolve também `naoLigadas` para o vigia
escrever o motivo "tarefa ainda não ligada (OBS_X3_PLAYLISTS)". Assim o executor não a chama e o vigia não a cobra, pelo
mesmo caminho das outras desligadas. `OBS_AGENDA=off` também a desliga (não é `nuncaDesliga`).

`rodar`: guarda de schema das cinco tabelas (`schema_ausente` se a migration não foi aplicada, mesmo com a variável `on`);
`linhas` nula → `canais_nao_lidos`; lê o estado dos canais das linhas com `lerCanais` (3 consultas com `in`, `Map` por canal; **falha =
`erro`**, nunca "nenhum visto", Phil M-5); lê **uma vez por disparo** `youtube_quota_usage.operations->>'competitors_playlists'`
do dia do Pacífico (as unidades já gastas hoje; **falha ao ler = `erro` `gravacao_falhou`, nunca 0**, Phil N5); planeja (puro); visita os devidos em ordem (nunca vistos primeiro, depois
`last_visit_at` mais antigo).

**Tempo (Phil I-3 = Yannis I-1, vale o mais estrito).** Nenhuma chamada à API começa depois de
`chamadaComecaAteMs = fimAteMs − chamadaMs − 3 × BANCO_MS − 2 s = 85 − 8 − 15 − 2 = 60 s` (a última chamada termina em 68 s e ainda
cabem `items_record`, `recordQuota` e `visit_close` de 5 s cada, 83 s + 2 s de folga); **nenhum canal novo começa depois de 50 s**
(`canalComecaAteMs`). Como a tarefa só é tomada até `comecaAteMs` = 50 s, sem tempo para um canal ela sai `adiada` `sem_tempo` e
**não gasta tentativa** (Yannis I-2; `competitor_agenda_claim` só perdoa `parcial` com progresso). `sobrou` só com `feitas >= 1`.
`regras.ts` traz a fórmula e um teste a recalcula das constantes (padrão `relogio.ts`).

**Cota por visita (Phil I-2 = Yannis I-3).** `recordQuota` com `mode: 'competitors_playlists'`, e `extra: { x3_teto_por_canal: 1 }` **só** na visita cortada pelo teto
(`extra` soma via `p_add`: o dia mostra o número de visitas cortadas, não 40 × visitas), é chamada **ao fim de cada visita**, num `try/finally`
depois do `competitor_x3_visit_close`, com as unidades da visita e `Promise.race` contra `BANCO_MS` (promessa que nunca resolve não trava a tarefa).
Falha, estouro ou `visit_close` que lançou não derrubam a visita nem a cota: soma em `detalhe.cota_nao_registrada` (convenção do despachante, que vira problema
vermelho). Execução cortada por `passou_do_tempo` não perde a cota das visitas já feitas. O teto do dia soma o lido de
`youtube_quota_usage` (começo do `rodar`) com as unidades gastas na execução.

Resultado da tarefa (código de catálogo, `detalhe` só números):

| Caso | Estado | Motivo |
|---|---|---|
| nenhum canal devido | `ok`, feitas 0 | — (o detalhe traz `canais_parciais`, `canais_sem_volta_14d` e `canais_com_secoes`, lidos da tabela; `canais_sem_volta_14d > 0` vira problema do disparo e aparece na frase de `ok`, P-1) |
| todos os visitados `ok`, nenhum devido sobrando | `ok` | — |
| algum visitado `parcial` | `parcial` | o de maior gravidade: `cota_esgotada` > `lista_cortada` > `contagem_difere` > `teto_por_canal` > `itens_cortados` > `teto_itens` > `saida_em_massa_a_confirmar` > `lista_vazia_a_confirmar` > `secoes_vazias_a_confirmar` |
| sobrou canal devido por tempo (com `feitas >= 1`) | `parcial` | `sobrou` (retoma no próximo disparo sem gastar tentativa, porque houve progresso); sem tempo para nenhum canal: `adiada` `sem_tempo` |
| nada gravado e houve erro | `erro` | `api_falhou`, `resposta_invalida` ou `gravacao_falhou` (inclui a falha de leitura de `competitor_playlist_reads`) |
| teto do dia (`RULES.x3.unidadesPorDia`) | `parcial` | `teto_do_dia` |

### 4.7 Complexidade

Por canal: `O(P/50)` chamadas de lista + `Σ O(I_p/50)` de itens, cada uma limitada pelos tetos. Diferença entre leituras
**no banco**, numa instrução por playlist (`left join` do lido contra o gravado por `item_id`, com o índice da chave
primária), nunca `find` dentro de `map` no código: no código a lista de playlists vira `Map` por `playlist_id` uma vez.

## 5. As contas

- **Unidades por visita** (10 playlists de ~30 itens): 1 (seções) + 1 (lista) + 10 (itens) = **12**. Semana com 24 canais:
  288 ≈ **41 por dia** (Phil/Hanna estimaram ~36; a diferença é que cada playlist custa no mínimo 1 unidade). 0,4% de 10.000.
- **Teto por canal por visita:** `unidadesPorVisita = 40` (canal com até ~37 playlists pequenas fecha numa visita). Canal
  com 400 playlists: 1 + 8 páginas + 31 playlists por dia; cada playlist relida a cada ~13 dias; a visita sai `parcial`
  `teto_por_canal` todos os dias, nunca `ok` com lista cortada. Revisar com C1.
- **Teto de itens por playlist por visita:** `paginasDeItensPorPlaylist = 10` (500 itens). Acima disso a saída de item
  nunca é inferida para aquela playlist (a entrada continua, pelo `added_at`).
- **Teto do dia:** `unidadesPorDia = 600` (6%), lido de `youtube_quota_usage.operations->>'competitors_playlists'` do dia do Pacífico
  (o contador que o dono lê), não da soma de `last_units`. Só dispara em defeito; a primeira semana com os 24 canais no mesmo dia gasta ~290.
- **Tempo:** ~12 chamadas × ~0,4 s ≈ 5 s por canal (não medido). Pior caso da cauda: 8 + 3 × 5 + 2 = 25 s, por isso a última chamada
  começa até 60 s e o canal novo até 50 s (4.6). **Q1 do Phil, medida em 17/10 pelo controlador:** a leitura horária em produção leva p50
  2,5 s, p90 3,3 s, p99 5,2 s (89 rodadas em 7 dias): não aperta o orçamento (esperado p90 ≤ 50 s). Primeiro dia: 24 canais ≈ 120 s,
  espalhados em ~6 disparos; depois ~3 a 4 canais por dia.
- **Espaço (Phil I-7):** com 10 playlists × 30 itens por canal (número ainda **não medido**), a linha de item custa ~330 B com índices
  (~200 B de tupla + ~80 B da chave primária + ~50 B do `idx_cpli_site_video`): ~7.200 itens ≈ **2,4 MB** na 1ª leitura; versões com o
  `raw` inteiro ~0,6 MB; ~5 mil itens novos por ano ≈ 1,7 MB. **~4,5 a 5 MB no 1º ano**; com 3× canais ~15 MB. Se os canais tiverem 100
  playlists de 50 itens, ~40 MB (8% do plano gratuito): por isso a medição ampliada da C1 e o portão de 15 MB.
- **Cota por canal grande (Phil I-4):** 1 playlist de 600 itens + 10 pequenas custa 22 unidades por visita; sem a regra estrutural
  seriam 154 por semana em vez de 22.

## 6. Quando o dado não existe e em cada falha

Já na tabela de 4.5. Mais:
- **Migration não aplicada e variável `on`:** `schema_ausente` (comum da agenda), nada chamado na API.
- **Variável ausente:** tarefa `desligada` no despacho e no vigia; nada chamado, nada gravado, nenhum alarme.
- **Canal pausado no meio da visita:** a função do banco recusa (`X3:canal_indisponivel`); a visita para, sem estado
  falso (`erro`, `canal_pausado`). O export da E10 espera 6 min depois de pausar; a visita inteira cabe em 85 s.
- **Canal removido no meio:** a cascata leva as linhas; a função seguinte recusa; idem.
- **Gravação falha depois da leitura:** visita `erro` `gravacao_falhou`; nada marcado como lido; o canal volta no dia seguinte.
- **Leitura de `competitor_playlist_reads`/`lerCanais` ou de `youtube_quota_usage` falha:** `erro` `gravacao_falhou`, nunca "nenhum visto" nem 0 (Phil M-5, N5).
- **Seções desligadas na origem (API devolve `[]` para todos):** falha em verde muda; o detalhe traz `canais_com_secoes` e a conferência x3-d7 cobra `> 0` (Phil M-2).
- **Gravação atrasada de execução abandonada** (`passou_do_tempo`): as funções `visit_close`, `items_record` (portão no topo, devolve `atrasada`) e `playlists_record` (`max(last_seen_at)`) são monotônicas e não sobrescrevem estado mais novo (Yannis M-1, J2; Phil N5).

## 7. Desvios do esboço do spec (§4.4)

- **D-1.** Chave da playlist é `uuid` com `unique (canal, playlist_id)`, não o id do YouTube (multi-site; o próprio spec
  anotou que `playlist_title` em `competitor_field_versions` quebraria o índice: aqui a renomeação vai em
  `competitor_playlist_versions`).
- **D-2.** Teto por **unidades** por visita (40) em vez de "50 playlists por canal"; o que não coube volta no dia seguinte,
  não na semana seguinte.
- **D-3.** A E9 (apagar vídeo que saiu) **não** apaga itens de playlist com aquele id: o item é dado da playlist (que segue
  pública), não do vídeo. Ponto aberto P-3.
- **D-4.** Seções entram (o spec listava `channelSections` como "sem pergunta de desempenho"); o dono liberou "playlists e
  seções" e custa 1 unidade por semana por canal.
- **D-5.** Cadência semanal por canal com a primeira leitura imediata, em vez do espalhamento `hash mod 7`.

## 8. Arquivos e tarefas

**Restrições globais.** TypeScript estrito, sem `any`, sem `as unknown as`. Testes de servidor com
`// @vitest-environment node`. Datas de teste fixas no passado ou relativas. Integração só no `bythiago_int`
(`HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run <arquivo> --no-file-parallelism`),
com a trava `/tmp/claude-501/int-db.lock`; nunca o 54321/54322; nunca chamar função como `anon`/`authenticated` (usar
`has_function_privilege`). Commit por caminho explícito, sem `--no-verify` em código, sem push. Comando longo em background
com saída em arquivo.

| Tarefa | Arquivos | Horas |
|---|---|---|
| 0 | conferência C2 e fixtures (leitura; C1 virou a x3-d1) | 0,3 (controlador) |
| 1 | migration X3 + testes de integração (migration e RLS) | 3,0 |
| 2 | helper da MG6 + testes da E10 com as tabelas novas + identidade da recarga | 1,0 |
| 3 | regras + leitura da resposta da API (puro) | 1,0 |
| 4 | planejamento dos canais devidos (puro) | 0,5 |
| 5 | visita de um canal + gravação | 1,5 |
| 6 | tarefa da agenda + interruptor `ligaCom` + vigia | 1,0 |
| 7 | lista fechada do que apaga, proibidas por cron, contagem da E9 | 0,5 |
| 8 | env-vars, conferências com data, ledger | 0,5 |
| 9 | portão do lote, envio | 0,5 |
| | **total** | **~10 h** |

Ordem: 0 → 1 → 2 (2 depende de 1); 3 e 4 em paralelo com 1; 5 depois de 1, 3 e 4; 6 depois de 5; 7 e 8 a qualquer momento
depois de 1; 9 no fim.

## 9. Itens de aceite

- **A-24** (reaberto). Toda playlist pública de canal ativo aparece em `competitor_playlists` até 7 dias depois de ligar;
  item que saiu ganha `removed_since` só depois de leitura completa da playlist; playlist apagada ganha `missing_since` só
  depois de lista completa (e, se a lista ficou vazia, de duas).
- **A-25** (reaberto). Canal cujo custo passa do teto: a visita registra `parcial` `teto_por_canal` com `playlists_left`, e o
  dia seguinte continua pelas playlists mais antigas.
- **A-26** (reaberto). A playlist de envios (`UU…`) nunca é gravada: filtrada no código e recusada pelo banco.
- **A-X3-1.** Export e `remover` da E10 funcionam com as tabelas novas (`obs_archive_uncovered()` vazio; ida e volta).
- **A-X3-2.** Com `OBS_X3_PLAYLISTS` apagada, a tarefa é `desligada` no despacho e no vigia e nenhuma chamada sai.
- **A-X3-3.** Nenhuma visita fica `ok` com lista cortada, contagem divergente ou lista vazia não confirmada.
- **A-X3-4.** A cota da X3 aparece em `youtube_quota_usage.operations.competitors_playlists` por dia.

## 10. As tarefas

### Tarefa 0: conferência C2 e fixtures (controlador, só leitura; fora do caminho crítico da medição C1)

A C1 (playlists e itens por canal, projeção em MB, portão de 15 MB) **saiu daqui**: vira a conferência x3-d1, depois de ligar
(seção 3.2). A coleta sobe desligada de qualquer forma.

1. Ler um canal ativo: `select c.channel_id from public.competitor_channels c where c.missing_since is null and c.collection_paused_at is null limit 3;`
   (produção, `supabase db query --linked`; leitura de produção é do controlador).
2. Um canal com seções: `channelSections?part=snippet,contentDetails&channelId=…`; guardar a resposta (sem chave) em
   `.superpowers/sdd/a5/x3/amostra-secoes.json`, que vira fixture da Tarefa 3. Idem uma página de `playlists` e uma de
   `playlistItems` (fixtures `amostra-playlists.json`, `amostra-itens.json`).
3. Q1 (já feita em 17/10, registrar no `progress.md`): leitura horária p50 2,5 s, p90 3,3 s, p99 5,2 s.

### Tarefa 1: a migration e o teste dela

**Arquivos:** `supabase/migrations/<timestamp>_observatorio_a5_x3_playlists_e_secoes.sql` (novo, via script);
`apps/web/test/integration/observatorio-a5-x3-migration.test.ts` (novo).

1. **Teste primeiro** (falha sem a migration): no `bythiago_int`, dentro de `begin; … rollback;`, com `garantirX3(c)` (helper novo em
   `test/helpers/x3.ts`, Yannis I-4: aplica o texto inteiro da migration **duas vezes** na transação aberta, depois de `garantirMg6`), com site, canal A, canal B
   e um admin semeados pelo `semearCena` de `test/helpers/mg6.ts`:
   - as cinco tabelas existem com RLS ligada; `has_table_privilege('anon', t, 'select')` falso; `authenticated` sem `insert/update/delete`
     (o comportamento da política vai no teste de RLS próprio, abaixo);
   - `has_function_privilege` das cinco funções: só `service_role`;
   - `insert` de playlist `UUabc…` → 23514; `LL…` e `FL…` também;
   - `competitor_x3_playlists_record` com 2 playlists, `p_complete` verdadeiro → 2 linhas e 2 versões; de novo com o mesmo
     conteúdo → nenhuma versão nova; com título trocado → 1 versão nova; com uma só e `p_complete` falso → nenhuma
     `missing_since`; com uma só e `p_complete` verdadeiro → `missing_since` na outra; ela volta → `missing_since` nulo;
   - `competitor_x3_items_record`: 3 itens completos → 3 linhas; 2 itens com `p_complete` falso → nenhum `removed_since`;
     2 itens completos → `removed_since` no terceiro; o terceiro volta com o mesmo `item_id` → `removed_since` nulo;
     `youtube_video_id` com 10 caracteres → recusa; playlist do canal B passada com `p_channel` A → `X3:playlist_de_outro_canal`;
   - sections: mesmo hash duas vezes → 1 linha; hash novo → 2;
   - `visit_close`: `ok` carimba `last_complete_at` e `last_cycle_at`; `parcial` não carimba `last_complete_at`, e carimba `last_cycle_at`
     só com `p_ciclo`; `p_lista_vazia` soma `empty_streak`, `ok` zera; **monotônico** (Yannis M-1): `visit_close` com `p_now` 10:20 `ok`, depois
     com 10:00 `parcial` → a linha continua `ok` às 10:20; idem `items_read_at` em `items_record`;
   - **portão monotônico** (J2, N5): `items_record` com `p_now` novo e depois `p_now` velho, `p_complete = true`, lista sem o item → nada marcado, retorno
     `atrasada`; `playlists_record` com `p_now` velho → `atrasada`, nenhum `missing_since`;
   - **`items_complete_at` e `removed_after`** (J3 = N2): completa em t1, parcial, completa sem o item → `removed_after` = t1; saída em massa no dia D e confirmada
     em D+1 → `removed_after` = a última completa **antes** de D; parcial entre duas completas não move `removed_after`; playlist sem leitura completa anterior → nulo;
   - **`first_visit_at`** (J4): 1º `visit_close` grava; o 2º não muda; **tri-state**: `p_lista_vazia` nulo preserva `empty_streak`, `false` zera, `true` soma (idem seções);
     `playlists_record` com a mesma playlist duplicada em `p_rows` → uma versão só (`distinct on`);
   - **janela da mudança** (Phil I-6): item some na 2ª leitura completa → `removed_after` = `items_complete_at` da 1ª; versão nova de playlist →
     `prev_seen_at` = `last_seen_at` anterior; versão nova de seção → `prev_seen_at` = `last_visit_at` anterior; item que volta limpa os dois;
   - **saída em massa** (Phil I-1): 30 presentes, leitura completa traz 10 → nenhum `removed_since`, `items_reason = 'saida_em_massa_a_confirmar'`,
     `mass_exit_day` = hoje; segunda vez em **outro dia** → marca 20 e zera `mass_exit_day`; segunda vez no mesmo dia → continua sem marcar;
   - `note` gravada e atualizada; "último" das versões por `observed_at desc, id desc` (Yannis M-6: mesmo hash do último → nenhuma versão; hash de uma versão antiga volta → versão nova);
   - canal pausado (`competitor_channel_pause`) ou com `missing_since` → as quatro funções recusam `X3:canal_indisponivel`;
     canal de outro site → idem;
   - `obs_archive_uncovered()` = `{}`; `obs_archive_registry()` tem 27 linhas, as 22 primeiras **iguais** (nome, filtro,
     período, soma, ordem) às da fixture `test/fixtures/sql/a5-e10-mg6.sql` aplicada numa transação separada;
   - o bloco de guarda recusa quando o registro instalado tem um nome a mais que não é da X3 (recria o registro com 23
     entradas dentro da transação e aplica a migration: espera a exceção `X3: registro instalado inesperado`);
   - `competitor_cascade_counts('canal', A)` traz as cinco chaves com as contagens semeadas (a E9 vê as tabelas novas).
   - **RLS por comportamento** (Phil I-5), no teste novo `observatorio-a5-x3-rls.test.ts`, no molde de `observatorio-a5-e9-rls.test.ts` e
     `a5-e11-rls.test.ts` (GUC forjado como não superusuário), para as **cinco** tabelas: (a) editor do site A lê as linhas de A; (b) editor do
     site B com `set_config('app.site_id', A)` lê 0; (c) `anon` falha com 42501; (d) `authenticated` falha com 42501 em `insert`; (e) `pg_policies`
     tem exatamente **uma** política por tabela (uma permissiva extra esquecida reprovaria).
2. `npm run db:new observatorio_a5_x3_playlists_e_secoes` no worktree; colar o Apêndice A.
3. Conferir que nenhuma outra migration recria o registro: `grep -l "function public.obs_archive_registry" supabase/migrations/*`
   devolve só a MG6 e a X3. Se devolver outra, as 22 mudaram: parar e reconciliar (a guarda do passo 1 também pega).
4. **Não deixar a migration aplicada** no `bythiago_int` nem no 54322 (é do Gio) (Yannis I-4): o banco é compartilhado, e com as cinco
   tabelas presentes o `garantirMg6` de outro worktree (sem a Tarefa 2) reaplica a MG6, deixa o registro em 22 e todo teste da E10 vira
   `E10:tabela_sem_export` por causa alheia. A idempotência é provada **dentro de transação**: o teste do passo 1 (aplica 2× via `garantirX3`) e,
   na mão, um arquivo com `\set ON_ERROR_STOP 1`, `begin;`, `\i <migration>`, `\i <migration>`, `rollback;` rodado com `psql -1`. Sem registrar em
   `schema_migrations`.
5. Rodar os testes do passo 1 (migration e RLS; background, saída em arquivo) até verde.
6. Commit: `feat: X3: migration de playlists e seções dos concorrentes, registro do export com as tabelas novas (trem 6)`.

### Tarefa 2: E10 com as tabelas novas

**Arquivos:** `apps/web/test/helpers/mg6.ts`; `apps/web/test/helpers/x3.ts` (novo);
`apps/web/src/lib/youtube/observatorio/arquivo/cli.ts`; `apps/web/test/integration/observatorio-a5-x3-arquivo.test.ts` (novo);
`apps/web/test/youtube/observatorio/arquivo-cli.test.ts`.

1. **Teste primeiro:** um caso que chama `garantirX3` e depois `garantirMg6` de novo (a ordem que um teste da E10 faz) e afirma
   `obs_archive_uncovered() = '{}'`; sem o conserto do passo 2 ele falha (o `garantirMg6` reaplica a MG6 e o registro volta a 22). Guardar a
   saída. (A X3 **não** fica aplicada no banco: tudo dentro de `begin … rollback`.)
2. `test/helpers/x3.ts`: `X3_REGISTRO` = o trecho da migration entre os marcadores `-- X3:REGISTRO:INICIO` e
   `-- X3:REGISTRO:FIM` (lido do arquivo; o helper acha o arquivo por `*_observatorio_a5_x3_playlists_e_secoes.sql`).
   `garantirMg6` passa a aplicar `X3_REGISTRO` depois do bloco 11 da M2 quando `to_regclass('public.competitor_playlists')`
   não é nulo.
3. `TABELAS_COM_IDENTIDADE` += `'competitor_channel_sections', 'competitor_playlist_versions'` (ordem alfabética como o teste
   compara). O teste "a lista fixa de tabelas com identidade" passa.
4. Teste novo `observatorio-a5-x3-arquivo.test.ts`:
   - canal A com 2 playlists, 3 itens, 1 versão, 1 seção, linha de leitura; exportar, conferir, confirmar
     (`exportarConferirConfirmar`), `competitor_channel_remove_archived` → `removido`; as cinco tabelas sem linha de A; o
     canal B intacto; o lote tem `row_count` das cinco tabelas;
   - **ida e volta:** os `\copy` de `comandosDeRecarga` (aplicados com `COPY FROM STDIN` do conteúdo gerado em memória)
     recarregam as cinco tabelas e as contagens batem; o `setval` das duas tabelas de identidade deixa o próximo insert
     sem colisão;
   - **lote exportado antes da X3:** sem a X3 (registro de 22), exportar A; aplicar a X3 na transação; remover A → passa
     (as tabelas novas não têm linha de A); com uma playlist de A inserida depois do export → `banco_difere_do_manifesto`.
   - `garantirX3` aplicada e `garantirMg6` reaplicada em seguida → `obs_archive_uncovered() = '{}'` e o registro tem 27 linhas.
5. Rodar a pasta `test/integration/observatorio-a5-e10*` e `manutencao-m2-e10.test.ts` com a X3 aplicada **dentro da transação de cada teste**
   via `garantirX3` (background); o banco compartilhado fica sem a X3.
6. Commit: `test: X3: export, remoção e recarga da E10 com as tabelas de playlists (trem 6)`.

### Tarefa 3: regras e leitura da resposta (puro)

**Arquivos:** `apps/web/src/lib/youtube/observatorio/playlists/regras.ts` (novo); `observatorio/rules.ts` (`x3: X3_RULES`);
`apps/web/src/lib/youtube/observatorio/playlists/ler-api.ts` (novo); `apps/web/test/youtube/observatorio/playlists-ler-api.test.ts` (novo);
fixtures em `apps/web/test/fixtures/youtube/x3-*.json` (das amostras da Tarefa 0, sem chave).

1. **Teste primeiro:**
   - `lerPaginaDePlaylists(json)`: forma boa → `{ itens, proxima, total }`; `pageInfo.totalResults` ausente → `total: null` (nunca 0; a
     comparação `contagem_difere` não se aplica com nulo, Phil M-4); o mesmo para `lerPaginaDeItens`; sem `items` → `{ porque: 'forma' }`; id `UU…`,
     `UULF…`, `LL…`, `FL…` filtrados (e contados em `excluidas`); `contentDetails.itemCount` ausente → `item_count: null`,
     nunca 0;
   - `hashDaPlaylist`: igual com `etag`, `itemCount` e `thumbnails` diferentes; diferente com título, descrição,
     `privacyStatus` ou `localizations` diferentes; estável com chaves em outra ordem;
   - `lerPaginaDeItens(json)`: `videoId` de 11 caracteres; item sem `videoId` válido descartado e contado; vídeo apagado
     (título "Deleted video", sem `videoOwnerChannelId`) entra com `video_owner_channel_id: null`; `position` ausente → `null`;
     `contentDetails.note` lido e sanitizado, ausente → `null`; o `raw` da versão da playlist traz o item inteiro sem `etag`;
   - `lerSecoes(json)`: ordena por `snippet.position`; tira `etag`; sem `items` → `forma`; `items: []` → lista vazia (não forma);
   - `erroDaApi(status, json)`: 403 `quotaExceeded` → `cota`; 404 `playlistNotFound` → `playlist_sumiu`; 5xx e rede → `api`.
   - **tempos** (Phil I-3, Yannis I-1), em `playlists-regras.test.ts`: `chamadaComecaAteMs + chamadaMs + 3 * BANCO_MS + 2_000 <= DEFINICAO_PLAYLISTS_SEMANAIS.fimAteMs`
     (importa `BANCO_MS` de `agenda/relogio.ts`), `canalComecaAteMs < chamadaComecaAteMs`, e `DEFINICAO_PLAYLISTS_SEMANAIS.comecaAteMs === X3_RULES.canalComecaAteMs`;
     mexer num número reprova o teste.
2. Implementar; `X3_RULES = { unidadesPorVisita: 40, paginasDeItensPorPlaylist: 10, unidadesPorDia: 600, diasEntreVoltas: 7, chamadaMs: 8_000, canalComecaAteMs: 50_000, chamadaComecaAteMs: 60_000 }`,
   com a fórmula `chamadaComecaAteMs = fimAteMs − chamadaMs − 3 × BANCO_MS − 2_000` escrita em `regras.ts`.
3. Commit: `feat: X3: regras e leitura das respostas de playlists, itens e seções (trem 6)`.

### Tarefa 4: quem é devido (puro)

**Arquivos:** `apps/web/src/lib/youtube/observatorio/playlists/planejar.ts` (novo); `apps/web/test/youtube/observatorio/playlists-planejar.test.ts` (novo).

1. **Teste primeiro** (`agoraMs` fixo no passado): canal sem linha de leitura → devido, primeiro da fila; `last_cycle_at`
   há 6 dias e 23 h → não devido; há 7 dias → devido; `parcial` com motivo **recuperável** (`lista_cortada`) ontem → devido; `parcial`
   `teto_itens` ontem com `last_cycle_at` há 2 dias → **não** devido (Phil I-4); `parcial` hoje → não devido; canal com `missing_since`
   → fora; ordem: nunca vistos, depois `last_visit_at` mais antigo, desempate por id; dia de São Paulo na virada (02:59Z e 03:00Z);
   `canais_sem_volta_14d` conta `coalesce(last_cycle_at, first_visit_at)` com mais de 14 dias (J4: canal sem `last_cycle_at` visitado há 15 dias entra; há 10, não);
   **J1/N1:** `last_cycle_at` < `last_visit_at` e visita de ontem → devido, mesmo com `last_reason = 'contagem_difere'`; `contagem_difere` numa playlist + `playlists_left = 3` → devido
   amanhã; só `teto_itens` com todas tentadas → não devido; `p_ciclo`/`last_cycle_at` = `last_visit_at` hoje → não devido; playlist lida há 3 dias é pulada, há 6 dias é devida;
   playlist com `saida_em_massa_a_confirmar` de ontem é devida; o teto corta a lista quando
   `unidadesJaGastasHoje + estimativa > unidadesPorDia`.
2. Implementar com `Map` por canal (sem `find` em laço). O planejador recebe `unidadesJaGastasHoje: number` como **entrada** (lido de
   `youtube_quota_usage` pelo `rodar`, dia do Pacífico; Yannis M-5, Phil I-2); não existe `unidadesDeHoje` por `last_units`.
3. Commit: `feat: X3: escolha dos canais devidos para a leitura de playlists (trem 6)`.

### Tarefa 5: a visita e a gravação

**Arquivos:** `apps/web/src/lib/youtube/observatorio/playlists/visitar.ts` (novo); `observatorio/playlists/gravar.ts` (novo);
`apps/web/test/youtube/observatorio/playlists-visitar.test.ts` (novo).

1. **Teste primeiro**, com `fetch` falso (contador de chamadas = unidades) e `ops` de gravação falsos que registram cada chamada:
   - canal com 2 playlists de 3 itens: 4 chamadas, `ok`, `p_complete` verdadeiro em todas as gravações;
   - erro 500 na 2ª página das playlists → `parcial` `lista_cortada`, gravação da lista com `p_complete` falso, nenhuma
     chamada de itens das não vistas, `visit_close` com `parcial`;
   - 120 playlists de 1 item e teto 40 → para em exatamente 40 unidades, `parcial` `teto_por_canal`, `playlists_left` = o
     que não foi lido; a próxima visita (mesmos `items_read_at` gravados) começa pelas não lidas;
   - playlist com 11 páginas → lê 10, `teto_itens`, `p_complete` falso, nenhuma inferência de saída;
   - lista vazia com playlist presente no banco → `lista_vazia_a_confirmar`, `p_complete` falso; segunda vez em outro dia
     (`empty_streak` = 1) → `p_complete` verdadeiro, `ok`;
   - `pageInfo.totalResults` 12 e 10 lidas sem `nextPageToken` → `contagem_difere`;
   - **itens (Phil I-1):** 11 itens lidos, `totalResults` 12, sem `nextPageToken` → `p_complete` falso, nenhum `removed_since`, `contagem_difere`;
     `totalResults` ausente → idem; 30 presentes e leitura completa traz 10 → `saida_em_massa_a_confirmar` (o banco decide; o código passa
     `p_complete` verdadeiro e lê o retorno `saida_em_massa_a_confirmar`) e a visita termina `parcial`;
   - **1º vazio** (Phil M-1): lista vazia de canal sem histórico → `lista_vazia_a_confirmar`, `parcial`; itens vazios com `item_count` nulo e
     itens já presentes → `itens_incoerentes`;
   - **estado do canal** (Yannis M-3): `ops.lerCanais` falso com e sem playlist presente alimenta os casos de lista vazia e a ordem das playlists;
     `lerCanais` lança → `erro` `gravacao_falhou`, nenhuma chamada à API (Phil M-5);
   - **cota por visita** (Phil I-2, N4): `recordQuota` chamada depois do `visit_close` de cada visita, com as unidades daquela visita, em `try/finally`;
     `visit_close` lança `gravacao_falhou` → a cota da visita **é** registrada (finally); `recordQuota` que nunca resolve (promessa pendente, relógio falso) → estoura em `BANCO_MS`,
     `cota_nao_registrada`, a visita termina; duas visitas cortadas pelo teto → `extra.x3_teto_por_canal` = 1 em cada chamada (soma 2, não 80); visita não cortada → sem `extra`; `recordQuota` lança → `detalhe.cota_nao_registrada = u` e as
     visitas seguintes continuam;
   - **tempo** (Yannis I-1): relógio falso em 59,9 s com chamada de 8 s e duas gravações de 5 s → a visita termina antes de 85 s e o
     `visit_close` é chamado; com o relógio em 60,1 s nenhuma chamada nova sai; canal novo em 50,1 s não começa;
   - **volta e `p_ciclo`** (J1 = N1, `calcularCiclo`): 400 playlists, teto 40 → `p_ciclo` falso e `playlists_left > 0`; só `teto_itens` e `contagem_difere` com todas tentadas → verdadeiro;
     `contagem_difere` numa playlist + `saida_em_massa_a_confirmar` noutra → falso; lista `lista_vazia_a_confirmar` → falso; `lerCanais` devolve `items_status`/`items_reason` por playlist
     e a playlist com motivo recuperável de ontem é relida, a `teto_itens` de ontem lida há 3 dias não;
   - **1ª chamada barrada pelo tempo**: relógio em 60,1 s antes da 1ª chamada do canal → nenhum `visit_close`, nenhuma `recordQuota`, `feitas` não conta;
   - 403 `quotaExceeded` no meio → para, `cota_esgotada`, nenhuma chamada depois;
   - resposta sem `items` na primeira chamada de lista → `erro` `resposta_invalida`, nada gravado como completo;
   - relógio passou de `chamadaComecaAteMs` → não começa a chamada seguinte; o que foi lido está gravado;
   - gravação lança `X3:canal_indisponivel` → `erro` `canal_pausado`, nenhuma chamada depois;
   - a playlist `UU…` vinda da API nunca chega aos `ops`;
   - a ordem das playlists na leitura de itens: `items_read_at` nulo primeiro, depois o mais antigo.
2. `gravar.ts`: `lerCanais` (uma vez por disparo, 3 consultas com `in`, `abortSignal(BANCO_MS)`) e os quatro `sb.rpc(...)` com `abortSignal(AbortSignal.timeout(BANCO_MS))`; erro com mensagem `X3:canal_indisponivel`
   vira o código `canal_pausado`; outro erro vira `gravacao_falhou` (só código e SQLSTATE vão ao Sentry, nunca o texto).
3. Commit: `feat: X3: visita de um canal com teto de unidades e estado honesto por lista (trem 6)`.

### Tarefa 6: a tarefa na agenda e o interruptor

**Arquivos:** `apps/web/src/lib/youtube/agenda/tipos.ts` (`ligaCom?: string`); `agenda/definicoes.ts`
(`DEFINICAO_PLAYLISTS_SEMANAIS`, entra em `TODAS_AS_DEFINICOES`; `tarefasDesligadas` com `naoLigadas`);
`agenda/tarefas/playlists-semanais.ts` (novo); `agenda/catalogo.ts`; `agenda/saude.ts` (`MOTIVO_TAREFA_NAO_LIGADA`);
testes `test/youtube/agenda/{catalogo,saude,despachante,tarefas}.test.ts` e `test/youtube/agenda/playlists-semanais.test.ts` (novo).

1. **Teste primeiro:**
   - `tarefasDesligadas`: com `delete process.env.OBS_X3_PLAYLISTS` **e** `OBS_AGENDA_TASKS_OFF` ausente (as duas apagadas; Yannis M-4:
     `tarefasDesligadas({}, CATALOGO)`) → `playlists_semanais` em `desligadas` e em `naoLigadas`; com `OBS_AGENDA_TASKS_OFF: 'marcas_de_idade'`
     → as duas desligadas; o catálogo recusa definição com `ligaCom` e `nuncaDesliga`; com `on` → fora; com `ON`, `1`, `''`, `' on'` → dentro. O teste antigo "todas as
     tarefas ligadas com a variável ausente" passa a excluir as que têm `ligaCom` (e um teste novo afirma que são só elas);
   - `avaliarAgenda` com a variável apagada → `{ status: 'desligada', motivo: 'tarefa ainda não ligada (OBS_X3_PLAYLISTS)' }`;
   - `despachar` com a variável apagada → `desligada`, `rodar` nunca chamado (espião); com `agora - t0 = 55_000` e a tarefa devida →
     `adiada` `sem_tempo`, `tomar` nunca chamado e nenhuma tentativa gasta (Yannis I-2);
   - `OBS_AGENDA=off` com `OBS_X3_PLAYLISTS=on` → desligada (`MOTIVO_AGENDA_OFF`);
   - `rodar` (com `visitar` e `gravar` falsos): schema ausente → `erro` `schema_ausente`; `linhas` nula → `canais_nao_lidos`;
     nenhum devido → `ok` feitas 0; um `parcial` entre três → `parcial` com o motivo de maior gravidade; tempo acabou com
     canal devido e `feitas >= 1` → `parcial` `sobrou` com `deixadas` = canais; teto do dia → `teto_do_dia`, lido da linha de
     `youtube_quota_usage` (não de `last_units`); `recordQuota` chamada **por visita**, com `Promise.race` (três canais, três chamadas, cada uma com as unidades
     da sua visita, `mode: 'competitors_playlists'`); `recordQuota` que lança na 2ª → `detalhe.cota_nao_registrada` = unidades da 2ª e as
     visitas seguintes continuam; falha de leitura de `competitor_playlist_reads` → `erro`, nunca "nenhum visto" (Phil M-5);
     `detalhe.canais_com_secoes`;
   - falha ao ler `youtube_quota_usage` no começo → `erro` `gravacao_falhou`, nenhuma visita, **nunca** teto 0 (N5); linha do dia ausente → 0 e a tarefa segue;
     `naoTerminouVermelhoEm` = 9 na definição;
   - o catálogo e `TODAS_AS_DEFINICOES` continuam iguais (teste existente) e os motivos todos casam `CODIGO_RE`.
2. Implementar. `comecaAteMs` da definição = 50 000 por extenso, com teste de igualdade com `X3_RULES.canalComecaAteMs`. `definicoes.ts` continua sem importar código de coleta (os motivos escritos por extenso lá; um teste confere
   que batem com os de `visitar.ts`, como faz `marcas_de_idade`).
3. Rodar `npx vitest run test/youtube/agenda test/youtube/observatorio/playlists-*` e `npx tsc --noEmit -p apps/web` (background).
4. Commit: `feat: X3: tarefa playlists_semanais na agenda, desligada até OBS_X3_PLAYLISTS=on (trem 6)`.

### Tarefa 7: o que apaga e o que nunca apaga

**Arquivos:** `apps/web/test/youtube/observatorio/lista-fechada-do-que-apaga.test.ts`.

1. A X3 não apaga nada (sem `.delete()` e sem `delete from` no código novo): a lista fechada fica igual e o teste passa
   sem mudança de par; isso é a prova. Acrescentar `competitor_playlist_items`, `competitor_playlist_versions` e
   `competitor_channel_sections` a `PROIBIDAS_POR_CRON`.
2. A remoção do canal (E10) e a fila E9 (`competitor_channel_purge`, `competitor_purge_preview`) cobrem as tabelas novas
   pelo catálogo (provado nas Tarefas 1 e 2). Apagar o site leva tudo por `site_id … on delete cascade`. Não há dado
   pessoal novo: playlists e seções são públicas de canal, e o item guarda só ids.
3. Commit: `test: X3: tabelas de playlists na lista do que o cron nunca apaga (trem 6)`.

### Tarefa 8: documentação e conferências com data

**Arquivos:** `docs/ops/env-vars.md`; `apps/web/src/lib/conferencias.ts` (`X3_LIGADA: string | null = null`,
`conferenciasX3`); `apps/web/test/lib/conferencias.test.ts` (se existir o padrão); `.superpowers/sdd/a5/x3/progress.md`.

1. `env-vars.md`: `OBS_X3_PLAYLISTS` — liga só com `on`; ausente = desligada; ligar só depois da migration aplicada.
2. Conferências (datas a partir de `X3_LIGADA`):
   - `x3-d1`: a consulta do §11 devolve **0 linhas** (todo canal ativo tem linha em `competitor_playlist_reads`); a unidade do dia em
     `competitors_playlists` está entre 200 e 400; **C1 ampliada** (playlists e itens por canal: máximo, mediana, soma; projeção `soma × 330 B`
     ≤ 15 MB, senão desligar e voltar ao Phil, Phil I-7); C3;
   - `x3-d7`: todo canal ativo com `last_cycle_at` em até 7 dias; `canais_com_secoes > 0` (valor esperado: o número da C2); tamanho das
     cinco tabelas ≤ 1,5 × a projeção da C1; nenhuma linha com `reason = 'cota_nao_registrada'`; C4;
   - `x3-d30`: versões por playlist por mês ≤ 1 (acima disso, rever o hash); `removed_after` preenchido em toda linha com `removed_since`, **exceto** a de playlist sem leitura completa anterior (`items_complete_at` nulo na época: nulo é honesto, J3 = N2).
3. Commit: `docs: X3: variável OBS_X3_PLAYLISTS e conferências com data (trem 6)`.

### Tarefa 9: portão e envio

1. `npx tsc --noEmit` web, `npx vitest run test/youtube` e a integração das Tarefas 1 e 2 (background, só falhas no contexto).
2. Portão do lote: Phil (dados: tetos, hash, volume, RLS) e Yannis (software: registro, interruptor, concorrência).
3. Envio na ordem da seção 2.

## 11. Consultas de conferência (produção, controlador)

```sql
-- x3-d1: canais ativos sem leitura
select c.id, c.channel_name from public.competitor_channels c
 where c.missing_since is null and c.collection_paused_at is null
   and not exists (select 1 from public.competitor_playlist_reads r where r.competitor_channel_id = c.id);
-- x3-d7: estado por canal e canais sem volta terminada em 14 dias
select r.last_status, r.last_reason, count(*) from public.competitor_playlist_reads r group by 1, 2 order by 3 desc;
select c.id, c.channel_name from public.competitor_channels c join public.competitor_playlist_reads r on r.competitor_channel_id = c.id
 where coalesce(r.last_cycle_at, r.first_visit_at) < now() - interval '14 days';   -- J4: nunca terminou a volta conta a partir da 1ª visita
-- C1 ampliada (x3-d1): itens por canal e projeção em MB (330 B por item com índices)
select p.competitor_channel_id, count(*) as playlists, sum(coalesce(p.item_count, 0)) as itens,
       round(sum(coalesce(p.item_count, 0)) * 330 / 1048576.0, 2) as mb_projetado
  from public.competitor_playlists p group by 1 order by 3 desc;
-- unidades por dia
select date, operations->>'competitors_playlists' from public.youtube_quota_usage order by date desc limit 10;
-- tamanho
select relname, pg_size_pretty(pg_total_relation_size(oid)) from pg_class
 where relname in ('competitor_playlist_reads','competitor_playlists','competitor_playlist_versions','competitor_playlist_items','competitor_channel_sections');
```

## 12. Riscos que ficam

- Canal com centenas de playlists nunca fecha uma volta em 7 dias com o teto de 40 (cada playlist relida a cada ~13 dias).
  Aparece como `parcial` todo dia e, depois de 14 dias sem `last_cycle_at`, em `canais_sem_volta_14d`; o número decide se o teto sobe.
  Motivo estrutural (`teto_itens`, `contagem_difere`) não reabre o canal todo dia (Phil I-4).
- Playlist com mais de 500 itens nunca tem saída inferida.
- Playlist que falha de forma permanente (ex.: sempre `itens_cortados`) bloqueia o `p_ciclo` e deixa o canal devido todo dia: custo de 1 a 2 unidades por dia por playlist (desprezível) e o alarme `canais_sem_volta_14d` a acusa (honesto). Dívida aceita; gatilho: alarme maior que zero (Yannis M-2c).
- **Perdas conscientes (Phil M-6, P-4):** a ordem dos itens (`position`) é sobrescrita (a história de reordenação se perde; guardar custaria uma
  versão por vídeo novo no topo, toda semana); a troca de capa **sozinha** não gera versão de playlist (a capa de cada versão fica no `raw`).
- Dívidas declaradas (Yannis, 2ª rodada): `position` reescreve a playlist inteira quando entra item no topo; `unfinished_n` da agenda é compartilhado entre `parcial` e `adiada`. Aceitos.
- A saída de item é uma janela (`removed_after` a `removed_since`), não um instante.
- A primeira linha de cada versão é "pelo menos desde" o dia da ligação; o que saiu antes dela não volta (dito pelo spec).
- `channelSections` pode ter mudado de comportamento (C2).

## 13. Pontos em aberto: decididos na 1ª revisão

- **P-1 (decidido).** 1ª opção: as execuções seguintes do dia sem canal devido fecham `ok`; o `parcial` fica na linha do canal e no detalhe.
  Para não falhar em verde: `canais_sem_volta_14d > 0` vira problema do disparo e aparece na frase de `ok`; motivo estrutural não reabre o
  canal (`last_cycle_at`, Phil I-4). Gatilho: qualquer canal sem volta há 14 dias vira item do BACKLOG com o nº de playlists dele.
- **P-2 (decidido).** Manter 40 por visita, 10 páginas por playlist e 600 por dia. O que limita é o tempo, não a cota (cota em 0,4%).
  Rever só se a C1 mostrar canal com mais de 37 playlists ou a projeção passar de 15 MB.
- **P-3 (decidido).** Manter D-3: a E9 não apaga item de playlist (só ids públicos de playlist que segue no ar, sem dado pessoal, ~330 B).
  Escrever no runbook da E9 e no contrato de tela futura: item com `youtube_video_id` sem `competitor_videos` = "vídeo apagado pelo dono".
- **P-4 (decidido).** Capa fora do hash; o `raw` da versão guarda o item inteiro sem `etag`; troca de capa sozinha não gera versão (§12).
- **P-5 (decidido).** Todos os canais no 1º dia (D-5), sem `hash mod 7`. Gatilho para mudar: o dia de pico passar de 12 tentativas ou de 3× canais.

## 14. Apêndice A: a migration (proposta, não rodada)

```sql
-- A5, X3 (dono, 17/10: "siga com as recomendações"): playlists e seções dos canais concorrentes, só o que muda.
-- Aditiva: cinco tabelas e quatro funções novas (vazias, sem chamador até OBS_X3_PLAYLISTS=on) e o registro do export
-- recriado com as 22 entradas da MG6 iguais e cinco a mais. Idempotente (provada dentro de transação, 2×). Volta: drop das cinco tabelas e das quatro funções,
-- e recriar o registro com as 22 (corpo da MG6).
set lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.obs_archive_registry()') is null then
    raise exception 'X3 depende da MG6 (obs_archive_registry)';
  end if;
  if to_regprocedure('public.competitor_channel_pause_covers(uuid,timestamptz,interval)') is null then
    raise exception 'X3 depende da MG6 (pausa)';
  end if;
end $$;

-- 1. Estado da leitura por canal
create table if not exists public.competitor_playlist_reads (
  competitor_channel_id uuid primary key references public.competitor_channels(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  first_visit_at timestamptz not null,                           -- 1ª visita, nunca muda (J4: alarme de canal que nunca fecha a volta)
  last_visit_at timestamptz not null,
  last_visit_day date not null,                                  -- dia de São Paulo
  last_status text not null check (last_status in ('ok', 'parcial', 'erro')),
  last_reason text check (last_reason ~ '^[a-z0-9_]{1,60}$'),
  last_units integer not null check (last_units >= 0),
  playlists_left integer check (playlists_left >= 0),
  last_complete_at timestamptz,                                  -- só visita 'ok'
  last_cycle_at timestamptz,                                     -- volta terminada (toda playlist tentada até o teto; Phil I-4)
  empty_streak smallint not null default 0 check (empty_streak >= 0),
  sections_empty_streak smallint not null default 0 check (sections_empty_streak >= 0)
);
create index if not exists idx_cplr_site on public.competitor_playlist_reads (site_id);

-- 2. Playlists
create table if not exists public.competitor_playlists (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  playlist_id text not null check (length(playlist_id) between 2 and 64 and playlist_id !~ '^(UU|LL|FL)'),
  title text,
  published_at timestamptz,
  item_count integer check (item_count >= 0),                    -- nulo = a API não mandou; nunca 0 por falta
  privacy text,
  state_sha256 text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  missing_since date,                                            -- só com lista completa
  items_read_at timestamptz,                                     -- só a ordem da fila
  items_complete_at timestamptz,                                 -- última leitura COMPLETA sem saída em massa pendente (J3 = N2)
  items_status text check (items_status in ('ok', 'parcial', 'erro')),
  items_reason text check (items_reason ~ '^[a-z0-9_]{1,60}$'),
  mass_exit_day date,                                            -- dia (SP) em que uma saída em massa ficou a confirmar (Phil I-1)
  unique (competitor_channel_id, playlist_id)
);
create index if not exists idx_cpl_site on public.competitor_playlists (site_id);

create table if not exists public.competitor_playlist_versions (
  id bigint generated always as identity primary key,
  playlist_ref uuid not null references public.competitor_playlists(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  state_sha256 text not null,
  raw jsonb not null,                                            -- o item inteiro da API, sem etag (P-4: miniaturas e itemCount inclusos)
  prev_seen_at timestamptz,                                      -- quando o estado anterior foi visto pela última vez (Phil I-6)
  observed_at timestamptz not null default now()                 -- a 1ª linha é "pelo menos desde"
);
create index if not exists idx_cplv_playlist on public.competitor_playlist_versions (playlist_ref, observed_at desc, id desc);

create table if not exists public.competitor_playlist_items (
  playlist_ref uuid not null references public.competitor_playlists(id) on delete cascade,
  item_id text not null check (length(item_id) between 1 and 128),
  site_id uuid not null references public.sites(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  position integer check (position >= 0),
  added_at timestamptz,                                          -- snippet.publishedAt: quando entrou na playlist
  video_published_at timestamptz,
  video_owner_channel_id text,
  privacy text,
  note text,                                                     -- contentDetails.note, texto do criador, sanitizado (Phil M-3)
  first_seen_at timestamptz not null,
  removed_since date,                                            -- só com leitura completa da playlist
  removed_after timestamptz,                                     -- limite inferior da janela: items_complete_at anterior da playlist (Phil I-6, J3; nulo = sem leitura completa antes)
  primary key (playlist_ref, item_id)
);
create index if not exists idx_cpli_site_video on public.competitor_playlist_items (site_id, youtube_video_id);

create table if not exists public.competitor_channel_sections (
  id bigint generated always as identity primary key,
  competitor_channel_id uuid not null references public.competitor_channels(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  state_sha256 text not null,
  raw jsonb not null,
  prev_seen_at timestamptz,                                      -- last_visit_at anterior do canal (Phil I-6)
  observed_at timestamptz not null default now()
);
create index if not exists idx_ccs_channel on public.competitor_channel_sections (competitor_channel_id, observed_at desc, id desc);

do $$
declare t text;
begin
  foreach t in array array['competitor_playlist_reads', 'competitor_playlists', 'competitor_playlist_versions',
                           'competitor_playlist_items', 'competitor_channel_sections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.can_edit_site(site_id))', t || '_select', t);
  end loop;
end $$;

-- 3. A guarda comum das quatro funções: canal deste site, presente e não pausado. Trava o canal (consultivo) na transação.
create or replace function public.competitor_x3_guard(p_site uuid, p_channel uuid)
returns void language plpgsql set search_path = '' as $$
begin
  if p_site is null or p_channel is null then
    raise exception 'X3:parametro_nulo' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('x3:' || p_channel::text, 0));
  perform 1 from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site and c.missing_since is null and c.collection_paused_at is null;
  if not found then
    raise exception 'X3:canal_indisponivel' using errcode = 'P0001';
  end if;
end $$;

-- 4. Lista de playlists. p_rows = [{playlist_id, title, published_at, item_count, privacy, state_sha256, raw}].
create or replace function public.competitor_x3_playlists_record(
  p_site uuid, p_channel uuid, p_now timestamptz, p_rows jsonb, p_complete boolean
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_ids jsonb;
  v_versoes integer;
  v_sumidas integer := 0;
  v_prev jsonb;
  v_max timestamptz;
begin
  perform public.competitor_x3_guard(p_site, p_channel);
  if p_now is null or jsonb_typeof(p_rows) <> 'array' or p_complete is null then
    raise exception 'X3:parametro_invalido' using errcode = '22023';
  end if;
  -- J2, N5: portão monotônico no topo; execução abandonada com p_now velho não marca sumidas nem grava versão
  select max(q.last_seen_at) into v_max from public.competitor_playlists q where q.competitor_channel_id = p_channel;
  if v_max is not null and p_now < v_max then
    return jsonb_build_object('atrasada', true, 'ids', '{}'::jsonb, 'versoes', 0, 'sumidas', 0);
  end if;
  -- Phil I-6: o último "visto" de cada playlist, lido ANTES do upsert que o sobrescreve
  select coalesce(jsonb_object_agg(q.playlist_id, q.last_seen_at), '{}'::jsonb) into v_prev
    from public.competitor_playlists q where q.competitor_channel_id = p_channel;
  with lido as (
    select distinct on (x.playlist_id) x.*
      from jsonb_to_recordset(p_rows) as x(playlist_id text, title text, published_at timestamptz, item_count integer,
                                           privacy text, state_sha256 text, raw jsonb)
     order by x.playlist_id
  ), up as (
    insert into public.competitor_playlists as p
      (site_id, competitor_channel_id, playlist_id, title, published_at, item_count, privacy, state_sha256, first_seen_at, last_seen_at)
    select p_site, p_channel, l.playlist_id, l.title, l.published_at, l.item_count, l.privacy, l.state_sha256, p_now, p_now from lido l
    on conflict (competitor_channel_id, playlist_id) do update
      set title = excluded.title, published_at = excluded.published_at, item_count = excluded.item_count,
          privacy = excluded.privacy, state_sha256 = excluded.state_sha256, last_seen_at = excluded.last_seen_at,
          missing_since = null
    returning p.id, p.playlist_id
  )
  select coalesce(jsonb_object_agg(up.playlist_id, up.id), '{}'::jsonb) into v_ids from up;

  -- versão nova só quando o hash difere do último gravado da playlist
  -- Yannis M-6: o "último" casa com o índice (observed_at desc, id desc), igual à X1
  insert into public.competitor_playlist_versions (playlist_ref, site_id, state_sha256, raw, prev_seen_at, observed_at)
  select distinct on (l.playlist_id) (v_ids ->> l.playlist_id)::uuid, p_site, l.state_sha256, l.raw, (v_prev ->> l.playlist_id)::timestamptz, p_now   -- Yannis: distinct on
    from jsonb_to_recordset(p_rows) as l(playlist_id text, state_sha256 text, raw jsonb)
   where l.state_sha256 is distinct from (
     select m.state_sha256 from public.competitor_playlist_versions m
      where m.playlist_ref = (v_ids ->> l.playlist_id)::uuid
      order by m.observed_at desc, m.id desc limit 1);
  get diagnostics v_versoes = row_count;

  if p_complete then
    update public.competitor_playlists p
       set missing_since = (p_now at time zone 'America/Sao_Paulo')::date
     where p.competitor_channel_id = p_channel and p.missing_since is null
       and not (v_ids ? p.playlist_id);
    get diagnostics v_sumidas = row_count;
  end if;
  return jsonb_build_object('ids', v_ids, 'versoes', v_versoes, 'sumidas', v_sumidas);
end $$;

-- 5. Itens de uma playlist. p_rows = [{item_id, youtube_video_id, position, added_at, video_published_at, video_owner_channel_id, privacy, note}].
--    p_complete = o código já conferiu (a) todas as páginas sem erro e sem corte e (b) totalResults presente e igual ao lido (Phil I-1).
create or replace function public.competitor_x3_items_record(
  p_site uuid, p_channel uuid, p_playlist uuid, p_now timestamptz, p_rows jsonb, p_complete boolean, p_status text, p_reason text
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_novos integer;
  v_saidos integer := 0;
  v_massa boolean := false;
  v_ant timestamptz;
  v_compl timestamptz;
  v_massa_dia date;
  v_hoje date := (p_now at time zone 'America/Sao_Paulo')::date;
  v_presentes integer;
  v_sairiam integer;
begin
  perform public.competitor_x3_guard(p_site, p_channel);
  select p.items_read_at, p.items_complete_at, p.mass_exit_day into v_ant, v_compl, v_massa_dia
    from public.competitor_playlists p where p.id = p_playlist and p.competitor_channel_id = p_channel;
  if not found then
    raise exception 'X3:playlist_de_outro_canal' using errcode = 'P0001';
  end if;
  if p_now is null or jsonb_typeof(p_rows) <> 'array' or p_complete is null
     or p_status not in ('ok', 'parcial', 'erro') or (p_complete and p_status <> 'ok') then
    raise exception 'X3:parametro_invalido' using errcode = '22023';
  end if;
  -- J2, N5: portão monotônico no TOPO (antes de tocar em itens e em removed_since): execução abandonada com p_now velho morre aqui
  if v_ant is not null and p_now < v_ant then
    return jsonb_build_object('gravados', 0, 'saidos', 0, 'saida_em_massa_a_confirmar', false, 'atrasada', true);
  end if;
  with lido as (
    select distinct on (x.item_id) x.*
      from jsonb_to_recordset(p_rows) as x(item_id text, youtube_video_id text, position integer, added_at timestamptz,
                                           video_published_at timestamptz, video_owner_channel_id text, privacy text, note text)
     order by x.item_id
  )
  -- `position` reescreve a playlist inteira quando entra item no topo (~7 mil updates por semana no pior caso; aceito, Yannis M-2)
  insert into public.competitor_playlist_items as i
    (playlist_ref, item_id, site_id, youtube_video_id, position, added_at, video_published_at, video_owner_channel_id, privacy, note, first_seen_at)
  select p_playlist, l.item_id, p_site, l.youtube_video_id, l.position, l.added_at, l.video_published_at, l.video_owner_channel_id, l.privacy, l.note, p_now
    from lido l
  on conflict (playlist_ref, item_id) do update
    set position = excluded.position, privacy = excluded.privacy, video_owner_channel_id = excluded.video_owner_channel_id,
        note = excluded.note, removed_since = null, removed_after = null
    where i.position is distinct from excluded.position or i.privacy is distinct from excluded.privacy
       or i.video_owner_channel_id is distinct from excluded.video_owner_channel_id or i.note is distinct from excluded.note
       or i.removed_since is not null;
  get diagnostics v_novos = row_count;   -- inseridos + alterados

  if p_complete then
    -- Phil I-1: saída em massa (mais da metade dos presentes e mais de 5) não é gravada na 1ª vez; a visita de OUTRO dia confirma
    select count(*), count(*) filter (where i.item_id not in (select x.item_id from jsonb_to_recordset(p_rows) as x(item_id text)))
      into v_presentes, v_sairiam
      from public.competitor_playlist_items i where i.playlist_ref = p_playlist and i.removed_since is null;
    if v_sairiam > 5 and v_sairiam * 2 > v_presentes and (v_massa_dia is null or v_massa_dia >= v_hoje) then
      v_massa := true;
    else
      -- Phil I-6, J3 = N2: removed_after = items_complete_at ANTERIOR da playlist (lido antes do update final; v_compl; nulo = sem leitura completa antes)
      update public.competitor_playlist_items i
         set removed_since = v_hoje, removed_after = v_compl
       where i.playlist_ref = p_playlist and i.removed_since is null
         and i.item_id not in (select x.item_id from jsonb_to_recordset(p_rows) as x(item_id text));
      get diagnostics v_saidos = row_count;
    end if;
  end if;
  update public.competitor_playlists p
     set items_read_at = p_now,
         items_complete_at = case when p_complete and not v_massa then p_now else p.items_complete_at end,
         items_status = case when v_massa then 'parcial' else p_status end,
         items_reason = case when v_massa then 'saida_em_massa_a_confirmar' else p_reason end,
         mass_exit_day = case when v_massa then coalesce(v_massa_dia, v_hoje) else null end
   where p.id = p_playlist;   -- o portão monotônico está no topo (J2)
  return jsonb_build_object('gravados', v_novos, 'saidos', v_saidos, 'saida_em_massa_a_confirmar', v_massa, 'atrasada', false);
end $$;

-- 6. Seções: só quando o hash muda.
create or replace function public.competitor_x3_sections_record(p_site uuid, p_channel uuid, p_now timestamptz, p_sha text, p_raw jsonb)
returns integer language plpgsql set search_path = '' as $$
declare k integer;
begin
  perform public.competitor_x3_guard(p_site, p_channel);
  if p_now is null or p_sha is null or p_raw is null then
    raise exception 'X3:parametro_invalido' using errcode = '22023';
  end if;
  -- prev_seen_at (Phil I-6): last_visit_at do canal, lido aqui, antes do visit_close que o sobrescreve.
  -- Yannis M-6: "último" por (observed_at desc, id desc), casando com idx_ccs_channel.
  insert into public.competitor_channel_sections (competitor_channel_id, site_id, state_sha256, raw, prev_seen_at, observed_at)
  select p_channel, p_site, p_sha, p_raw,
         (select r.last_visit_at from public.competitor_playlist_reads r where r.competitor_channel_id = p_channel), p_now
   where p_sha is distinct from (
     select m.state_sha256 from public.competitor_channel_sections m
      where m.competitor_channel_id = p_channel order by m.observed_at desc, m.id desc limit 1);
  get diagnostics k = row_count;
  return k;
end $$;

-- 7. Fecho da visita. p_ciclo = volta terminada, calculado pelo código (`calcularCiclo`): playlists_left = 0, lista completa e nenhum motivo recuperável (J1 = N1).
create or replace function public.competitor_x3_visit_close(
  p_site uuid, p_channel uuid, p_now timestamptz, p_status text, p_reason text, p_units integer, p_left integer,
  p_lista_vazia boolean, p_secoes_vazias boolean, p_ciclo boolean
) returns void language plpgsql set search_path = '' as $$
begin
  perform public.competitor_x3_guard(p_site, p_channel);
  if p_now is null or p_status not in ('ok', 'parcial', 'erro') or p_units is null or p_units < 0 then
    raise exception 'X3:parametro_invalido' using errcode = '22023';
  end if;
  insert into public.competitor_playlist_reads as r
    (competitor_channel_id, site_id, first_visit_at, last_visit_at, last_visit_day, last_status, last_reason, last_units, playlists_left,
     last_complete_at, last_cycle_at, empty_streak, sections_empty_streak)
  values (p_channel, p_site, p_now, p_now, (p_now at time zone 'America/Sao_Paulo')::date, p_status, p_reason, p_units, p_left,
          case when p_status = 'ok' then p_now end,
          case when p_status = 'ok' or coalesce(p_ciclo, false) then p_now end,
          case when coalesce(p_lista_vazia, false) then 1 else 0 end,
          case when coalesce(p_secoes_vazias, false) then 1 else 0 end)
  on conflict (competitor_channel_id) do update
    set last_visit_at = excluded.last_visit_at, last_visit_day = excluded.last_visit_day, last_status = excluded.last_status,
        last_reason = excluded.last_reason, last_units = excluded.last_units, playlists_left = excluded.playlists_left,
        last_complete_at = coalesce(excluded.last_complete_at, r.last_complete_at),
        last_cycle_at = coalesce(excluded.last_cycle_at, r.last_cycle_at),
        -- tri-state (Yannis): nulo preserva, false zera, true soma; first_visit_at nunca é atualizado (J4)
        empty_streak = case when p_lista_vazia is null then r.empty_streak when p_lista_vazia then least(r.empty_streak + 1, 100) else 0 end,
        sections_empty_streak = case when p_secoes_vazias is null then r.sections_empty_streak when p_secoes_vazias then least(r.sections_empty_streak + 1, 100) else 0 end
    -- Yannis M-1: gravação atrasada de uma execução abandonada nunca sobrescreve a visita mais nova
    where r.last_visit_at <= excluded.last_visit_at;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.competitor_x3_guard(uuid, uuid)',
    'public.competitor_x3_playlists_record(uuid, uuid, timestamptz, jsonb, boolean)',
    'public.competitor_x3_items_record(uuid, uuid, uuid, timestamptz, jsonb, boolean, text, text)',
    'public.competitor_x3_sections_record(uuid, uuid, timestamptz, text, jsonb)',
    'public.competitor_x3_visit_close(uuid, uuid, timestamptz, text, text, integer, integer, boolean, boolean, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- 8. O registro do export. Guarda: o instalado tem de ser as 22 da MG6 (ou as 27, reaplicação).
do $$
declare
  v_inst text[];
  v_22 text[] := array['competitor_channels', 'competitor_collection_pauses', 'competitor_channel_snapshots',
    'competitor_channel_hour_map', 'competitor_videos', 'competitor_field_versions', 'competitor_raw',
    'competitor_video_versions', 'competitor_changes', 'competitor_video_tier_spans', 'competitor_video_daily',
    'competitor_video_marks', 'competitor_video_mark_misses', 'competitor_missing_baseline', 'competitor_video_early',
    'competitor_video_hourly', 'competitor_hour_fold_log', 'competitor_video_comment_snaps', 'competitor_video_comments',
    'competitor_video_comment_marks', 'youtube_intelligence_tasks', 'competitor_readings'];
  v_5 text[] := array['competitor_playlist_reads', 'competitor_playlists', 'competitor_playlist_versions',
    'competitor_playlist_items', 'competitor_channel_sections'];
begin
  select array_agg(r.table_name order by r.table_name) into v_inst from public.obs_archive_registry() r;
  if v_inst is distinct from (select array_agg(x order by x) from unnest(v_22) x)
     and v_inst is distinct from (select array_agg(x order by x) from unnest(v_22 || v_5) x) then
    raise exception 'X3: registro instalado inesperado (%): reconciliar antes de aplicar', array_to_string(v_inst, ', ');
  end if;
end $$;

-- X3:REGISTRO:INICIO
create or replace function public.obs_archive_registry()
returns table (table_name text, filter_sql text, period_sql text, sum_sql text, order_sql text)
language sql
stable
set search_path = ''
as $$
  values
    -- (as 22 entradas da MG6, copiadas byte a byte de 20261014000002_…sql, linhas 315-374, sem tirar comentário; a última ganha vírgula)
    ...,
    ('competitor_playlist_reads', 't.competitor_channel_id = $1', null, null, 't.competitor_channel_id'),
    ('competitor_playlists', 't.competitor_channel_id = $1', null, null, 't.id'),
    ('competitor_playlist_versions',
     't.playlist_ref in (select p.id from public.competitor_playlists p where p.competitor_channel_id = $1)',
     '(t.observed_at at time zone ''UTC'')::date', null, 't.id'),
    ('competitor_playlist_items',
     't.playlist_ref in (select p.id from public.competitor_playlists p where p.competitor_channel_id = $1)',
     '(t.first_seen_at at time zone ''UTC'')::date', null, 't.playlist_ref, t.item_id'),
    ('competitor_channel_sections', 't.competitor_channel_id = $1', '(t.observed_at at time zone ''UTC'')::date', null, 't.id');
$$;
revoke all on function public.obs_archive_registry() from public, anon, authenticated;
grant execute on function public.obs_archive_registry() to service_role;
-- X3:REGISTRO:FIM
```

O `...` do registro é **literal a substituir** na Tarefa 1 pelas 22 linhas da MG6 (linhas 315-374 do arquivo dela, com os
comentários), copiadas do arquivo e não deste plano; o teste da Tarefa 1 compara as 22 com a fixture da MG6.
