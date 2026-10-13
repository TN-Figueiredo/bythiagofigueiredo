# A5, ordem 23: E6 (P4) e E18 parte 2, a dieta final do canal próprio (plano de implementação)

Escrito em 13/10/2026. **Emenda 1 (13/10/2026):** resposta aos pareceres da rodada 1 (dados e software), linha a linha em `.superpowers/sdd/a5-planos-onda-2/e6-p4-e-e18-parte-2-dieta-final/resposta-r1.md`. Cada mudança está marcada no lugar com "(emenda 1: <id>)"; `D-` é achado do parecer de dados, `S-` do de software. O que mudou de mais importante: a MG17 não liga mais o enxugamento diário sem as guardas quando a tabela tem linhas (D-I-1); linha de dia de teste A/B nunca sai (D-I-2); a regra das 14 execuções passou a ser por dia e tolera a reexecução sem dia novo (D-I-3, S-I-2); a Tarefa 3 só é escrita depois da MG17a em produção (S-I-1); existe roteiro de religar, e o desligamento pelo banco deixa o cron vermelho (S-I-3). Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md`, seção 7.1 (passo P4) e seção 7.5.10 (parte 2 da E18), item de aceite 202; `00-indice-decisoes-e-sequencia.md`, linhas 352, 390, 391, 395, 398, 418 e 419, riscos 8 e 37; `06-ciclo-de-vida-volume-e-cota.md`, linha 7 da tabela de 9.2 e item 231. Migrations: **MG16** e **MG17**, cada uma sozinha, aplicadas pelo dono, mais uma aditiva que o spec não numerou e este plano chama de **MG17a**. Fatos de partida: `.superpowers/sdd/a5-planos-onda-2/e6-p4-e-e18-parte-2-dieta-final/fatos.md` (conferi no código local os que decidem o desenho; a seção 3 diz quais). Planos irmãos, já com acordo: "plano P3" = `docs/superpowers/plans/2026-10-13-a5-e6-p3-apagar-linhas-vazias-do-diario-plan.md`; "plano E18" = `docs/superpowers/plans/2026-10-13-a5-e18-versoes-do-video-proprio-plan.md`; "plano irmão" = `docs/superpowers/plans/2026-10-12-a5-e6-e8-dieta-e-retencao-plan.md` (MG14).

**Objetivo, em três frases.** Soltar a cópia de segurança que a MG15 deixou dentro do banco (`yt_own_video_daily_zeros_bkp`, cerca de 23 MB), 14 dias ou mais depois dela, só quando a própria migration provar que o prazo passou, que o dono conferiu o CSV no dia e que os zeros continuam recriáveis pela cobertura. Fazer `yt_own_video_meta_daily` parar de guardar uma linha por vídeo por dia para sempre: a cobertura passa a dizer "este dia foi conferido", e de cada sequência de dias idênticos ficam só a primeira linha, a última e as duas mais recentes (de cerca de 12.800 linhas por ano para cerca de 1.000). Nada disso tem data ainda (a MG15 e o passo de versões não estão em produção): o plano entrega já o código, os testes, o SQL e os roteiros de volta, e deixa cada migration destrutiva atrás de um portão que se prova por consulta.

**Fica FORA deste plano.**
- **MG14, MG15, MG12 e o código delas** (planos irmão, P3 e E18). Este plano depende deles em produção e não edita arquivo deles, com duas exceções declaradas e em fila: `coleta/meta-step.ts` e `coleta/versoes-step.ts` (seção 9).
- **Mudar os leitores de `yt_own_video_meta_daily`** (critério de metadados do cron, `dias_sem_meta`, leitura horária, a função `competitor_hourly_health` da MG9, a situação do vídeo no critério de cobertura). O desenho escolhido os deixa como estão e prova por teste que respondem o mesmo (seção 4.1 e Tarefa 6). Se o dono preferir a regra literal do spec (pergunta 2), aí sim todos mudam, e isso é outro plano.
- **Cópia dentro do banco para a MG17.** O spec pede só o CSV ("ritual em escala pequena"); a volta sem CSV recria as linhas a partir da cobertura (seção 2).
- **Tela, navegador, mockup:** não há tela. **Nenhuma rota** em `apps/web/src/app/api/pipeline/` é criada ou alterada; nada em `lib/pipeline/api-registry.ts`, `apps/web/data/pipeline-docs/` nem `docs/cowork-*` (Pipeline Integrity: não se aplica).
- **Regenerar `database.types.ts`** (convenção dos planos do lote: tarefa única do controlador ao fim do lote C). A tabela de backup nunca entrou nos tipos.
- **Refazer a derivação de versões do zero em produção.** A capacidade passa a existir e é testada (item 202), mas o roteiro operacional não é desta etapa (dívida).
- **O teste do item 231** (lista fechada do que apaga) é da E10. Aqui ficam os pares escritos (dívida) e a Tarefa 14 e a 15 os acrescentam se o teste existir no dia.

**O que pode começar JÁ**, sem esperar migration nem resposta do dono: as Tarefas **0** (as conferências que não dependem de migration), **2** (módulo puro da cobertura), **11** (conferências com data, com as três constantes nulas) e **12** (runbook, depois da 7). Assim que a MG14 estiver no `bythiago_int` (está: fato F12 do plano P3): **1**. Assim que as Tarefas 3 e 6 do plano E18 estiverem commitadas: **4** e **5**. Assim que a MG12 estiver no `bythiago_int`: **6, 7 e 8**. Assim que o ensaio da MG15 existir (Tarefa 1 do plano P3): **9**. Esperam portão: **13** (MG14 em produção; a **3** é escrita dentro dela, depois da VA1 a VA4: emenda 1, S-I-1), **14** (MG15 mais 14 dias), **15** (14 execuções limpas).

---

## 0. Dependências duras (ler antes de tudo)

### 0.1 O que este plano usa de outras migrations e de outros planos

| O que uso | Forma exata | Fonte (lida em 13/10) | Onde uso |
|---|---|---|---|
| `public.yt_own_video_coverage` | chave `(youtube_video_id, metric_set, covered_from)`; `metric_set` já aceita `meta_texto` e `meta_thumb`; `source` com `check (source in ('analytics_api', 'reporting_api'))`; `site_id` com cascata; `channel_id` `on delete restrict`; leitura por `can_view_private_site` ou `can_edit_site`; sem policy de escrita | `.superpowers/sdd/a5-e6-e8/sql/mg14.sql:18-45` (ensaio; **sem arquivo em `supabase/migrations/`**) | a cobertura de metadados; a MG17a alarga o `check` de `source` |
| A técnica de fundir intervalos | `range_agg` de `daterange(…, '[]')`, apaga o intervalo cujo começo sumiu, `insert … on conflict` | `mg14.sql:211-233` (`yt_own_daily_apply`) | `yt_own_meta_cover_set` copia a técnica; não chama a função |
| `public.yt_own_video_meta_daily` | chave `(youtube_video_id, day_pt)`; 25 colunas (contei no DDL; os fatos dizem 24: a CP2b confere); policy de leitura `yt_own_video_meta_daily_select`; sem policy de escrita | `supabase/migrations/20261007000006_coleta_canais_proprios_l1a.sql:66-96, 133-136` | a tabela que emagrece. **Nenhuma policy é tocada** |
| O passo de metadados | grava sempre a linha de "ontem no Pacífico" (`ontemPt(agora)`), por `upsert`; nunca reescreve dia anterior; a segunda execução do dia só completa a linha do dia; `description_text` e `tags` só entram quando o hash muda | `apps/web/src/lib/youtube/coleta/meta-step.ts:169, 396-455` | a regra "o vizinho de depois tem de ser de dia anterior ao gravado" (seção 4.2) |
| `yt_own_versions_state` e `yt_own_video_versions` (MG12) | `derived_through date` por canal; `yt_own_versions_apply_day` confirma sem exigir linha diária e exige a linha para **abrir** versão (`sem_linha_do_dia`) | plano E18, Apêndice A, linhas 971-978 e 1032-1057 (texto proposto; **sem arquivo**) | a guarda "só sai linha de dia já derivado"; a MG17 recusa sem as duas tabelas |
| `derivarDia`, `passoVersoes`, `lerPaginado`, `comPrazo`, `conferirBanco`, `pushUnico` | assinaturas do plano E18 (Tarefas 3 e 6) e de `coleta/paginar.ts`, `clock.ts:88`, `schema.ts:27` | plano E18; código local | Tarefas 2 a 5. **Importo, não edito** `clock.ts`, `schema.ts`, `paginar.ts`, `passos-desligados.ts`, `criteria-desligados.ts` |
| O backup do diário | `public.yt_own_video_daily_zeros_bkp (like public.yt_own_video_daily)`, índice único `(youtube_video_id, day_pt)`, RLS ligada, sem policy, sem privilégio, sem chave estrangeira; comentário `MG15 <instante em UTC> [<json por site>]` com `site`, `estado`, `vazias`, `apagadas` | plano P3, Apêndice A, linhas 732-737 e 973-978, 1005-1008 | a MG16 lê o comentário antes de soltar |
| O critério "linha vazia" do diário | `views = 0` medido e as outras oito contagens zero ou nulas | `mg14.sql:201-206`; plano P3, função `yt_own_daily_linha_vazia` (apagada pela própria MG15) | a MG16 o reescreve, letra por letra, numa guarda |
| O ritual do CSV, a marca do dia, o arquivo armado, a janela 11:30 a 13:00 UTC | plano P3, seção 2 e Apêndice D | plano P3 | **aponto, não copio** (risco 12 do plano P3). Este plano só escreve o que muda: o nome da tabela, da pasta e da marca |
| `resumo.metadados` e `resumo.versoes` em `yt_own_collection_runs` | `resumo jsonb`, `falhas text[]`, sem `site_id`; guardadas por 90 dias | `app/api/cron/sync-analytics-metrics/route.ts:589-610`; `meta-step.ts:19-27`; plano E18, Tarefa 6 (`VersoesResumo`) | a guarda das 14 execuções limpas |

### 0.2 Os três portões

Nada disto é verdade em 13/10. Cada linha é uma **conferência pendente** (só leitura; quem roda é o controlador; as consultas estão na seção 3.2 e na seção 11). O arquivo de cada migration só nasce com o portão dela em verde.

**Portão A (MG17a e o código da cobertura).**

| # | Condição | Como se prova | Se falhar |
|---|---|---|---|
| A1 | A MG14 está em produção | CP1 traz a versão dela; `to_regclass('public.yt_own_video_coverage')` não nulo | a MG17a recusaria sozinha; esperar o lote C |
| A2 | O `check` de `source` é o que o Apêndice A espera | CP10 | corrigir o bloco 1 do Apêndice A antes do `db:new` |
| A3 | O ensaio da MG17a rodou duas vezes no `bythiago_int` | Tarefa 1, saída guardada | emenda |
| A4 | Nenhuma migration destrutiva pendente no repositório | a fila do `db push`, `.superpowers/sdd/a5/fila-do-db-push.md` (reconciliação 13/10, emenda 1: D-m8, S-m3), não tem linha "pendente: db push bloqueado". (reconciliação 13/10, emenda 4: p8, n5) **Arquivo ausente ou ilegível: parar e perguntar ao controlador; nunca tratar como fila vazia.** | esperar |
| A5 | Acordo dos dois especialistas sobre este plano e sobre o SQL rodado | pareceres | emenda |
| A6 (emenda 1: S-m-8) | O lote do plano E18 com as Tarefas 5, 6 e 7 dele está em `main` | `git log origin/main --oneline -- apps/web/src/lib/youtube/coleta/versoes-step.ts` traz os commits | a MG17a pode ser aplicada assim mesmo (é inerte); o **push do código** (passos 6 a 8 da Tarefa 13) espera |

**Portão P (MG16).**

| # | Condição | Como se prova | Se falhar |
|---|---|---|---|
| P1 | A MG15 foi aplicada há 14 dias ou mais | `E6_P3_APLICADA` mais 14 dias; e o instante do comentário do backup (CP11) | a migration recusa sozinha; esperar |
| P2 | As quatro conferências da P3 têm `feitaEm` (`e6-p3-d0`, `d1`, `d7`, `d14`) | `grep -n "e6-p3-d" apps/web/src/lib/conferencias.ts .superpowers/sdd/a5/conferencias-com-data.md` | fazer as que faltam primeiro |
| P3 | O backup está como a MG15 o deixou | CP11: comentário com `estado: apagado` e `linhas` = soma de `apagadas` | **parar**: estado desconhecido (a migration recusa) |
| P4 | Nada no banco cita o backup | CP12: nenhuma linha | ler a função antes de seguir (a migration recusa) |
| P5 | O diário continua magro e vivo | CP5, CP6 e CP4 do plano P3 de novo (três execuções limpas, nenhuma linha vazia nova, `atrasados` 0) e a CP8 **do plano P3** (diário menor que 2 MB; a CP8 deste plano é outra: emenda 1, D-m-5) | não soltar: se o coletor foi revertido, o backup é a volta mais barata |
| P6 | O CSV do diário existe e confere com o `sha256` | o dono roda `shasum -c` (Apêndice E, linha 2) | sem CSV íntegro, soltar o backup deixa só a volta B: **o dono decide** (pergunta 6) |
| P7 | As voltas B e C foram ensaiadas hoje no banco local | Tarefa 9 verde no dia | não soltar |
| P8 | O leitor tolerante continua em `main` | G1 do plano P3, rodado de novo | não soltar |
| P9 | O teste do item 191 aceita a tabela ausente | CP17 | ajustar a lista do plano E17 antes do push da Tarefa 14 |
| P10 | Nenhuma outra migration pendente; a MG17 não está armada | `npx supabase migration list --linked`; a fila do `db push`, `.superpowers/sdd/a5/fila-do-db-push.md` (reconciliação 13/10, emenda 1: D-m8). (reconciliação 13/10, emenda 4: p8, n5) **Arquivo ausente ou ilegível: parar e perguntar ao controlador; nunca tratar como fila vazia.** | **parar** |
| P11 | Acordo dos dois especialistas | pareceres | emenda |

**(reconciliação 13/10, emenda 1: D-I2) Conferência a mais do portão P, antes do `db:new`, sem número para não mexer em P1 a P11:** ~~com o SQL de ensaio da MG16 aplicado no `bythiago_int`~~ (reconciliação 13/10, emenda 2: D2-m3) dentro da mesma transação desfeita (`begin; … rollback;`) em que o teste da Tarefa 14 aplica o ensaio, rodando ali a consulta de catálogo de cada teste (eles abrem conexão própria e não enxergam a transação); nunca aplicar a MG16 de forma persistente em banco local antes de produção verde. Assim conferidos, os testes de lista fechada da E10 (`observatorio-a5-e10-lista-fechada.test.ts`) e os dois do passo 0 da E17 (`observatorio-a5-e17-p0-doze.test.ts`, `-reporter-banco.test.ts`), se existirem, passam. Vermelho: acertar a lista no commit do arquivo (Tarefa 14), antes de armar.

**Portão D (MG17).**

| # | Condição | Como se prova | Se falhar |
|---|---|---|---|
| D1 | MG12, MG17a, o passo de versões e o código da cobertura estão em produção | CP1; `E18_DEPLOY` e `E18P2_COBERTURA_DEPLOY` com data | esperar |
| D2 | 14 dias limpos seguidos, com a última execução há menos de 24 horas (emenda 1: D-I-3, S-I-2, D-m-8) | CP14 (a mesma expressão que a migration aplica): 14 linhas, uma por dia, `limpa` verdadeiro em todas | esperar; um dia sujo zera a contagem. Reexecutar o cron à mão **não** suja o dia se a reexecução sair sem nota de metadados, de cobertura e de versões; com nota, suja. A migration recusa sozinha e lista os dias não limpos |
| D3 | Os itens 188 e 199 foram conferidos em produção e a prova diária está em 0 | ledger da E18 (D0 e D+14 dela); CP15 | esperar |
| D4 | A cobertura é exatamente as linhas com captura | CP13: `descobertas` 0 e `sem_explicacao` 0 em todo canal; K1 (seção 11): dias cobertos = linhas com o campo capturado, por vídeo e conjunto | **parar**: a migration recusa |
| D5 | Sabe-se quanto sai e nada tem teste A/B que surpreenda | CP3 e CP4, com os números no ledger | os números vão ao dono na pergunta 1 |
| D6 | Nada mais no banco lê a tabela | CP7: só a lista esperada | ler a função nova antes |
| D7 | O ensaio local rodou duas vezes, e o ensaio com o CSV real (R2) fechou | Tarefas 8 e 10 | sem R2, o que fica sem prova está dito em "o que nenhum teste prova" |
| D8 | As variáveis estão no padrão | CP9: `YT_OWN_META_DIETA_OFF` ausente; `YT_OWN_STEPS_OFF` sem `versoes`. **(reconciliação 13/10, emenda 1: D-m6) A CP9 lê a configuração da Vercel, e a variável só vale para deploy feito depois dela: conferir também o deploy em pé, pelo resumo da última execução, que não pode trazer `desligado` para `versoes` nem para a dieta** | corrigir e contar de novo |
| D9 | Nenhuma outra migration pendente; a MG16 não está armada | como P10 | **parar** |
| D10 | A pergunta 1 foi ao dono com os números | ledger | sem resposta vale o padrão (seguir) |
| D11 | Acordo dos dois especialistas | pareceres | emenda |

**(reconciliação 13/10, emenda 1: D-I2) Conferência a mais do portão D, antes do `db:new`, sem número para não mexer em D1 a D11:** ~~com o SQL de ensaio da MG17 aplicado no `bythiago_int`~~ (reconciliação 13/10, emenda 2: D2-m3) dentro da mesma transação desfeita (`begin; … rollback;`) em que o teste da Tarefa 15 aplica o ensaio, rodando ali a consulta de catálogo de cada teste; nunca aplicar a MG17 de forma persistente em banco local antes de produção verde (aplicada antes, deixaria o corpo novo de `yt_own_meta_cover` no banco que os outros testes usam). Assim conferido, `observatorio-a5-e10-lista-fechada.test.ts` passa **já com o par `(yt_own_meta_cover, yt_own_video_meta_daily)`**, e os dois testes do passo 0 da E17 passam. No dia da MG17 a fila do `db push` está travada para todos: a lista se acerta antes de armar, não depois.

### 0.3 Avisos de topo

- **O SQL dos apêndices NÃO foi rodado pelo autor.** A regra desta onda de planos é só leitura do repositório. As Tarefas 1, 6, 9 e 10 são a primeira execução (contra o `bythiago_int`, dentro de `begin; … rollback;`, duas vezes); o que elas acharem emenda os apêndices **antes** do portão. Todo tempo deste plano está marcado "não medido".
- **Este plano escolhe uma regra de apagar mais conservadora que a do spec** (seção 4.1 e desvio 1), porque a regra literal quebraria em silêncio seis leitores, um deles uma função que já está em produção. É a decisão mais importante do plano e está na pergunta 2.
- **O spec trata a MG17 como uma migration; aqui são duas** (MG17a aditiva e MG17 destrutiva), com código em produção entre elas, no mesmo molde P1, P2, P3 do diário (desvio 2). A tabela de migrations do spec (16 linhas) precisa de uma linha a mais: é pedido ao controlador, não edição deste plano.
- **Nenhum arquivo de migration é criado antes da vez dele.** `npm run db:push:prod` aplica todo arquivo pendente. O SQL vive nos apêndices e em cópias de ensaio fora do git (`.superpowers/sdd/a5-e18p2/sql/` e `.superpowers/sdd/a5-e6-p4/sql/`).
- **MG16 e MG17 nunca ficam pendentes juntas**, nem junto de outro lote (regra do "arquivo armado" do plano P3, seção 2, que vale aqui sem mudança).
- **Escrita em produção é do dono:** os `\copy`, as marcas do dia e os `db:push:prod`. O agente prepara os comandos, um por linha (Apêndice E).
- **Dado privado, não pessoal.** `yt_own_video_meta_daily` traz título, descrição e tags de vídeos do próprio canal, inclusive não listados e privados. Nenhum título, descrição ou URL vai a nota de `falhas`, a `resumo`, ao Sentry, ao comentário de tabela nem aos retratos do ledger: só contagens, md5 e o id de 11 caracteres.
- **Nenhum texto de exceção do Postgres** vai a nota, coluna ou Sentry. As funções novas lançam códigos curtos e o código compara por igualdade com lista fechada (regra do plano E18, aviso de topo).

---

## 1. Perguntas que só o dono responde

Nenhuma trava o início. O plano segue com o padrão.

1. **A MG17 vale a pena agora?** O ganho de hoje é pequeno: a tabela tinha 175 linhas em 12/10 (cerca de 108 kB pelas contas do spec; o tamanho real é a CP2). O que ela evita é o crescimento: cerca de 9 MB por ano com 35 vídeos, cerca de 22 MB com 100 vídeos novos por ano (estimativas do spec). **Recomendo fazer**, porque a parte aditiva (MG17a e o código) já entrega o que mais importa, que é a cobertura e o alarme, e a parte destrutiva fica barata depois disso. **Padrão:** fazer, na ordem 23, com o portão D verde. **Trava:** só a Tarefa 15. Se ele disser "adiar", as Tarefas 1 a 13 seguem iguais e a 15 fica na dívida com os números do dia.
2. **Qual regra de apagar?** A do spec guarda só o dia em que algo mudou. A deste plano guarda, de cada sequência de dias idênticos, a primeira linha, a última e as duas mais recentes, e só apaga linha **idêntica em todas as colunas** às duas vizinhas. Custa cerca de 4 linhas por vídeo parado em vez de 1 (cerca de 175 linhas em vez de 35, para os 35 vídeos de hoje: emenda 1, D-m-7) e em troca nenhum leitor muda, o instante da última conferência antes de uma troca fica guardado, e as linhas de dia de teste A/B nunca saem (regra 8 de 4.2: emenda 1, D-I-2). **Duas consequências que ele aceita junto (emenda 1: D-m-10, S-m-10):** na regra deste plano o cron passa a **apagar** uma linha por vídeo por dia, automaticamente e para sempre (na do spec ele deixaria de gravar); e a etapa ganha uma migration que o spec não tem, a MG17a, que ele também aplica. **Padrão:** a regra deste plano. **Trava:** nada. Se ele quiser a do spec, este plano não serve para a parte 2 e os seis leitores entram num plano novo.
3. **Onde guardar o CSV de `yt_own_video_meta_daily`?** **Padrão:** `~/Workspace/arquivo-observatorio/dieta-meta/yt_own_video_meta_daily-AAAAMMDD.csv`, com o `.sha256` ao lado, fora do repositório, ao lado da pasta do CSV do diário (pergunta 1 do plano P3). **Trava:** nada.
4. **Uma cópia dentro do banco para a MG17, como a do diário?** O spec não pede. Sem ela a volta é pelo CSV (exata) ou pela cobertura (recria as linhas com o instante de captura aproximado). Com ela nasceria mais uma tabela temporária e mais uma migration destrutiva para soltá-la. **Padrão:** sem cópia dentro do banco. **Trava:** nada.
5. **`vacuum full` em `yt_own_video_meta_daily` no dia da MG17?** Trava a tabela por milissegundos (ela é pequena) e devolve o espaço das linhas apagadas. **Padrão:** só se a tabela tiver mais de 1 MB na conferência AD (emenda 1: D-m-5; "A1" é o nome da conferência equivalente do plano P3); abaixo disso não compensa. **Trava:** nada (o item 202 pede o tamanho anotado, não um alvo).
6. **Soltar o backup do diário aos 14 dias, ou esperar mais?** Ele ocupa cerca de 23 MB (estimativa do spec) num banco de cerca de 171 MB com teto de 500 MB: não há pressa de espaço. **Padrão:** soltar aos 14 dias com o portão P verde, e **antes** disso tirar também um CSV do próprio backup (Apêndice E, linha 3: é uma leitura de 23 MB). **Trava:** só a Tarefa 14.
7. **Em que dia e hora?** Como no plano P3: entre 14:00 e 20:00 de Brasília, cada migration no seu dia. **Padrão:** o dono escolhe; a MG17 recusa sozinha entre 11:30 e 13:00 UTC. **Trava:** só as datas das Tarefas 14 e 15.

---

## 2. O que é do dono

**Três aplicações, em três dias diferentes, cada uma sozinha no `db push` (a MG17a pode ir junto do lote C, se o carimbo dela for posterior ao da MG14).** **(reconciliação 13/10: R15) Se for junto, ela é a sexta e última do lote: o arquivo é criado depois do da MG12 (ordem do lote: MG14, MG11, MG5, MG7, MG12, MG17a; reconciliação 13/10, emenda 1: D-C1, S-C1: com o lote C partido, a MG17a é a terceira e última do C2, depois de MG11 e MG12, e a MG14 já está em produção desde o C1), e a janela do `db:push:prod` passa a ser a do lote, fora de 11:30 a 13:00 UTC (a da MG11), não a de 11:55 a 12:15 da linha a2 abaixo. O nome MG17a fica; está na tabela única de migrations de `docs/superpowers/plans/2026-10-13-a5-onda-2-reconciliacao.md`.**

| Passo | Quem | O quê | Se inverter ou pular |
|---|---|---|---|
| **MG17a** | | | |
| a1 | controlador | portão A; `db:new` (Tarefa 13) | sem a MG14 a migration recusa |
| a2 | **dono** | `npm run db:push:prod` (digita `YES`), fora de 11:55 a 12:15 UTC | código da cobertura antes da migration: cron **vermelho todo dia** com `schema_ausente: yt_own_meta_cover`; nada é gravado nem perdido |
| a3 | controlador | VA1 a VA4 (seção 11) | sem elas não se sabe se a carga da cobertura fechou |
| a4 | agente | (emenda 1: S-I-1) escreve e commita a Tarefa 3 **só agora**, depois da VA1 a VA4; push do código (Tarefas 2 a 5), promoção fora de 11:55 a 12:15 UTC; data em `E18P2_COBERTURA_DEPLOY` | sem a data as conferências não vencem |
| **MG16** | | | |
| p1 | controlador | portão P, no dia | nada avisa P5 a P9: por isso o portão é escrito |
| p2 | agente (Tarefa 14) | no mesmo dia: linha "MG16 pendente: db push bloqueado, e não rodar `migration up` no banco local 54321" no ledger comum; `db:new`; cola o Apêndice B; `diff` contra o ensaio | arquivo que dorme no repositório é arquivo armado |
| p3 | **dono** | confere o CSV do diário, tira o CSV do backup e põe a marca do dia (Apêndice E) | sem a marca a migration recusa |
| p4 | controlador | AP (contas de antes) | sem ela o ledger não tem os números da MG15, que somem com a tabela |
| p5 | **dono** | `npm run db:push:prod` | recusa cuja nova tentativa fique para outro dia: o arquivo sai do repositório (plano P3, "Arquivo armado", regra 2) |
| p6 | controlador | VP1 a VP4; o dono retira a marca (Apêndice E) | |
| p7 | agente | data em `E6_P4_APLICADA`, commit, push, CI, promoção | |
| **MG17** | | | |
| d1 | controlador | portão D, no dia; a pergunta 1 com os números | |
| d2 | agente (Tarefa 15) | no mesmo dia: linha "MG17 pendente" no ledger comum; `db:new`; cola o Apêndice C; `diff` | idem p2 |
| d3 | **dono** | CSV da tabela inteira, `shasum`, a contagem da tabela e a marca do dia (Apêndice E) | sem o CSV não há volta exata. Sem a marca a migration recusa |
| d4 | controlador | AD (contas e retratos de antes); R1 (o CSV recarrega no banco local com a mesma contagem); R2 (a derivação sobre o CSV real dá o mesmo antes e depois da dieta) | sem R1 não se sabe se o CSV presta |
| d5 | **dono** | `npm run db:push:prod`, fora de 11:30 a 13:00 UTC | dentro da janela: recusa, nada muda, roda de novo no mesmo dia |
| d6 | controlador | VD1 a VD8 | qualquer diferença: desligar a compactação e volta B ou C, no mesmo dia |
| d7 | **dono** (padrão da pergunta 5) | `vacuum full`, se a tabela passa de 1 MB; retira a marca | |
| d8 | agente | data em `E18P2_APLICADA`, commit, push, CI, promoção | |

**Nomes para o `db:new`:** `observatorio_a5_e18p2_cobertura_de_metadados` (MG17a), `observatorio_a5_e6_p4_soltar_backup_do_diario` (MG16), `observatorio_a5_e18p2_dieta_de_metadados` (MG17).

**Marcas do dia** (o dono grava no passo do CSV; a migration recusa sem a de hoje em UTC; a migration aplicada **troca** o comentário pelo resultado, então a marca vale uma vez só): `P4 armada em AAAA-MM-DD` no comentário de `public.yt_own_video_daily` (o comentário do backup guarda as contas da MG15 e não pode ser sobrescrito); `E18P2 armada em AAAA-MM-DD` no comentário de `public.yt_own_video_meta_daily`.

**Janela e travas.**
- **MG17a:** troca um `check` em `yt_own_video_coverage` (trava exclusiva pelo tempo de conferir algumas centenas de linhas: milissegundos, não medido; `lock_timeout` de 5 s), cria três funções e carrega a cobertura lendo `yt_own_video_meta_daily`. Quem grava a cobertura é o cron das 12:00 UTC: aplicar fora de 11:55 a 12:15 UTC.
- **MG16:** `drop table` do backup (trava só nele; ninguém o lê) e um `comment on table` no diário (trava que não segura leitura nem gravação). Qualquer hora; por hábito fora de 11:30 a 13:00 UTC.
- **MG17:** trava `share row exclusive` em `yt_own_video_meta_daily` pelo tempo de apagar (milissegundos esperados para alguns milhares de linhas; não medido): **quem lê não espera** (leitura horária, telas), quem grava espera (só o cron das 12:00 UTC e, se existir, a segunda execução do dia). A migration recusa entre 11:30 e 13:00 UTC. `lock_timeout` 5 s, `statement_timeout` 120 s.

**Convive com o código que está em `main`?**
- **MG17a com código antigo:** inerte. Ninguém chama as funções; as linhas novas de cobertura (`meta_texto`, `meta_thumb`) não são lidas por ninguém (todo leitor de cobertura filtra o conjunto: fato F6). Efeito colateral declarado: `serie_coletada` de `youtube_channel_removal_impact` cresce (a cobertura tem chave `restrict` para o canal), o que não muda o veredito, porque a tabela diária já fazia a soma ser maior que zero.
- **Código da cobertura sem a MG17a:** o passo de metadados grava as linhas como hoje e termina com a nota vermelha `schema_ausente: yt_own_meta_cover`. Nada é perdido; a primeira execução depois da migration cobre tudo o que ficou para trás (a função cobre toda linha ainda sem cobertura, não só a do dia).
- **MG16 com qualquer código:** inerte. Nenhum código lê o backup (`git grep zeros_bkp -- apps packages` não acha nada em 13/10; a CP12 confere o banco).
- **MG17 com o código da cobertura em `main`** (o estado que o portão D exige): o cron passa a enxugar um dia por execução; nenhum leitor muda de resposta (Tarefa 6).
- **MG17 e, depois, o código da cobertura revertido:** ninguém chama a função; a tabela volta a crescer 35 linhas por dia e nada avisa pelo cron. Nenhum dado se perde. Guarda: a conferência `e18p2-d7` lê o tamanho.
- **MG17 e, depois, o passo de versões desligado ou parado:** a função só apaga dia que o passo já derivou; sem derivação nova a tabela volta a crescer e o passo religado encontra todas as linhas que faltou derivar. É o que mantém `YT_OWN_STEPS_OFF=versoes` como um interruptor seguro depois da dieta.
- **MG17 sem a MG17a, ou sem a MG12:** recusa na primeira instrução e não muda nada.

**Como desfazer.**
- **MG17a:** não há o que desfazer em dado (só acrescenta cobertura). Reverter o código basta; as funções ficam, sem uso.
- **MG16:** o que não volta é **a cópia dentro do banco**. Os zeros continuam recriáveis de duas formas, as duas do plano P3 e ensaiadas de novo na Tarefa 9: **volta B** (recriar da cobertura; equivalente para todo leitor, não idêntica) e **volta C** (CSV do diário, ou o CSV do próprio backup tirado no passo p3). O spec diz "só pelo CSV"; está desatualizado (desvio 9).
- **MG17, nesta ordem:** (1) **desligar a compactação** para o cron não reapagar o que voltar: o dono roda `docs/ops/sql/dieta-meta-desligar-compactacao.sql` no SQL Editor (vale na hora, sem deploy), ou o agente põe `YT_OWN_META_DIETA_OFF=1` na Vercel **e faz um redeploy de produção** (a variável só chega a deploy novo: emenda I7 do plano E11; a frase do plano E18 "vale na execução seguinte, sem deploy" está errada); (2) **volta B**, `docs/ops/sql/dieta-meta-volta-b-recriar-da-cobertura.sql`: recria cada linha apagada como cópia da vizinha guardada, com `captured_at` aproximado (12:00 UTC do dia seguinte); ou **volta C**, o CSV (Apêndice E), que devolve as linhas originais. **O que não volta sem o CSV:** o instante exato de captura dos dias do meio. (3) (emenda 1: S-I-3) **religar**, quando a causa estiver achada e a CP13 voltar a dar `descobertas` 0 e `sem_explicacao` 0: o dono roda `docs/ops/sql/dieta-meta-religar-compactacao.sql` no SQL Editor (e, se o desligamento foi pela variável, o agente a retira e faz o redeploy). Enquanto o banco estiver desligado pelo roteiro, o cron fica **vermelho todo dia** com a nota da linha 14b da seção 6: o desligamento não pode ser esquecido em verde. A execução seguinte ao religar enxuga de uma vez o que acumulou.

**Conferências depois de aplicar** (texto na seção 11):

| # | O que | Esperado |
|---|---|---|
| VA1 | a MG17a entrou inteira | `t, 3, 3, 0` |
| VA2 | a carga cobriu tudo | `descobertas` 0 e `sem_explicacao` 0 em todo canal |
| VA3 | dias cobertos = linhas com captura, por vídeo e conjunto (K1) | 0 diferenças, com o total avaliado maior que zero |
| VA4 | a tabela diária não mudou | mesma contagem e mesmo md5 de antes (AA) |
| VP1 | o backup saiu e a função auxiliar também | `f, 0` |
| VP2 | o que a MG16 anotou no comentário do diário | texto `MG16 <instante> {…}` com `estado: solto` e `linhas` igual ao da AP. **Nulo ou a marca ainda lá = nada foi solto** |
| VP3 | o diário não mudou | a A1 do plano P3, igual à de antes |
| VP4 | tamanho | banco menor em cerca do tamanho do backup anotado na AP |
| VD1 | a MG17 entrou inteira | `t, 4, 4, 0, t` |
| VD2 | o que a migration anotou no comentário da tabela | texto `MG17 <instante> […]` com `estado: apagado`. **A marca ainda lá = nada foi apagado** |
| VD3 | as contas de depois, contra a AD | as igualdades M1 a M8 da seção 4.4 |
| VD4 | retratos | mesmo md5 das sequências e da situação |
| VD5 | cobertura | K1 "depois": toda diferença é dia coberto sem linha, e `sem_explicacao` 0 |
| VD6 | as versões não mudaram e toda versão tem a sua linha | mesmo md5 de `yt_own_video_versions`; `versoes_sem_linha` 0 |
| VD7 | os leitores respondem o mesmo | K5: a prova da leitura horária com os mesmos números de antes |
| VD8 | tamanho (item 202) | anotado, antes e depois |

---

## 3. Fatos de que o desenho depende

### 3.1 Conferidos no código local em 13/10 (HEAD `900c9b48`)

| # | Fato | Fonte |
|---|---|---|
| F1 | O passo de metadados grava **sempre** a linha de `ontemPt(agora)` de cada vídeo publicado, por `upsert` em `(youtube_video_id, day_pt)`; nunca escreve em dia anterior. A segunda execução do dia só completa a linha do dia; privacidade e dHash nunca passam de não nulo a nulo | `coleta/meta-step.ts:169, 414-455` |
| F2 | Sem captura pela API a linha sai sem `privacy_status`; sem imagem baixada, sem `thumbnail_dhash` e sem `thumbnail_sha256_at_capture` (os dois são gravados juntos) | `meta-step.ts:356, 423-426, 451` |
| F3 | `description_text` e `tags` só entram na linha quando o hash difere do da linha anterior, ou na primeira linha: as linhas seguintes trazem os dois nulos | `meta-step.ts:444-445` |
| F4 | Em dia de teste A/B a linha traz `seconds_on_air_*` e `seconds_other_*`, que mudam todo dia com o mesmo `ab_test_id` | `meta-step.ts:432-441`; `coleta/ab-seconds.ts:1-2` |
| F5 | Quem lê a tabela no código: `meta-step.ts` (última linha antes do dia, por canal e por vídeo; linhas do dia), `criteria.ts:654-661` (contagem de linhas do dia), `criteria-cobertura.ts:97-117` (a linha mais recente do vídeo), `horaria/gravar.ts:366-391` (linhas com privacidade dos últimos 3 dias). No banco: `competitor_hourly_health`, **em produção** (linhas com privacidade dos últimos 3 dias, e a mais recente com `captured_at` há mais de 26 horas), e `youtube_channel_removal_impact` (contagem) | `git grep -ln yt_own_video_meta_daily -- apps/web/src`; `supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql:209-232, 315-386` |
| F6 | Todo leitor de `yt_own_video_coverage` filtra `metric_set` (`cobertura.ts:54` só `base`; `dimensoes-step.ts:296` e `proprio/ler-dimensoes.ts:193` por lista); `criteria-e11.ts:60` e `e11-config.ts:180` só sondam o schema | `git grep -n "yt_own_video_coverage\|metric_set" -- apps/web/src/lib/youtube` |
| F7 | `yt_own_collection_runs` guarda 90 dias de execuções | `route.ts:606-609` |
| F8 | Passo que não coube no relógio não roda e devolve `{gravados: 0, tentativas: {nao_alcancado_orcamento: n}, pendentes: n, sem_tempo: true}`; passo que lançou não deixa chave no resumo e gera a nota `<nome>: <causa>` | `coleta/index.ts:122-146` |
| F9 | O teto do passo de metadados é 30 s; `comPrazo` corta cada ida em 15 s ou no que restar do passo | `coleta/clock.ts:5, 88-99` |
| F10 | Função inexistente chega como `PGRST202` e `conferirBanco` a traduz em `schema_ausente: <onde>` | `coleta/schema.ts:4-16, 27-41` |
| F11 | A semente e2e não semeia `yt_own_video_meta_daily` (o banco do navegador tem a tabela vazia, salvo dado posto à mão) | `grep -n yt_own_video_meta_daily apps/web/e2e/fixtures/observatorio-seed.ts` = nada |
| F12 | Nenhum código cita `yt_own_video_daily_zeros_bkp` | `git grep -ln zeros_bkp -- apps packages` = nada |
| F13 | O cron do canal próprio roda às 12:00 UTC; a leitura horária, de 20 em 20 minutos | `apps/web/vercel.json:25, 39` |
| F14 | `'versoes'` já está em `PASSOS_COM_INTERRUPTOR`; não existe interruptor para o passo de metadados | `coleta/passos-desligados.ts:6` |
| F15 | Em produção, 12/10: 175 linhas em 5 dias (07/10 a 11/10), 35 vídeos, 615 B por linha; as 35 linhas de 07/10 têm `privacy_status` nulo | spec `00`, linha 49; `.superpowers/sdd/a5/conferencias-c0-resultado.md:162-175` (C0.11) |
| F16 | Não existe leitor de CSV no repositório (`grep` por `papaparse`, `csv-parse`, `parseCsv` em `apps/web/src/lib` e `package.json` = nada) | 13/10 |

### 3.2 Conferências pendentes (só produção responde; o controlador roda; `:site` = o uuid do site)

Todas com `npx supabase db query --linked "<select>"`. O agente desta etapa não roda nenhuma.

**CP1 (já): o que está aplicado.**
```sql
select version from supabase_migrations.schema_migrations order by version desc limit 20;
```
Esperado em 13/10: até `20261013000003`, sem MG14, MG11, MG5, MG7, MG12, MG15. **Muda o quê:** nada no desenho; diz qual portão pode começar.

**CP2 (já): tamanho e forma da tabela diária.**
```sql
select count(*) as linhas, count(distinct youtube_video_id) as videos, count(distinct site_id) as sites, count(distinct channel_id) as canais, min(day_pt) as de, max(day_pt) as ate, pg_total_relation_size('public.yt_own_video_meta_daily') as bytes from public.yt_own_video_meta_daily;
```
Esperado: cerca de 35 linhas por dia desde 07/10; `sites` 1; `canais` 2. **Muda o quê:** os números da pergunta 1. `sites` maior que 1 não muda o SQL (as funções percorrem os sites), mas as conferências passam a rodar uma vez por site.

**CP2b (já): as colunas.**
```sql
select count(*) as n, string_agg(a.attname, ',' order by a.attname) from pg_attribute a where a.attrelid = 'public.yt_own_video_meta_daily'::regclass and a.attnum > 0 and not a.attisdropped;
```
Esperado: 25 nomes, a lista em ordem alfabética do bloco 0 do Apêndice C. **Muda o quê:** nome a mais ou a menos corrige a lista do Apêndice C e as listas de colunas do Apêndice D (a regra de comparação não muda: ela compara a linha inteira).

**CP3 (já, e de novo no portão D): quantas linhas são "do meio".**
```sql
with l as (select m.privacy_status, m.ab_test_id, (to_jsonb(m) - 'day_pt' - 'captured_at') as t, lag(to_jsonb(m) - 'day_pt' - 'captured_at') over w as ta, lead(to_jsonb(m) - 'day_pt' - 'captured_at') over w as ts, lead(m.day_pt) over w as ds, max(m.day_pt) over (partition by m.channel_id) as ate from public.yt_own_video_meta_daily m window w as (partition by m.youtube_video_id order by m.day_pt)) select count(*) as linhas, count(*) filter (where ta is null) as primeiras, count(*) filter (where ta is not null and t <> ta) as mudancas, count(*) filter (where ta is not null and ts is not null and t = ta and ts = t and ds < ate and privacy_status is not null and ab_test_id is null) as do_meio, count(*) filter (where privacy_status is null) as sem_privacidade from l;
```
Esperado em 12/10 (não medido): `primeiras` 35; `mudancas` perto de 70 (a linha de 08/10 difere da de 07/10 na privacidade, e a de 09/10 difere da de 08/10 em `description_text` e `tags`, que só a primeira linha com captura traz); `do_meio` crescendo cerca de 35 por dia. (emenda 1: D-I-2, D-m-3) A consulta aplica a regra 8 (linha de dia de teste A/B não conta) e **não** aplica a regra 9 (fronteira de versão, que precisa das tabelas da MG12): por isso é um teto, e o número exato é o `do_meio` que a MG17 anota no comentário. **Muda o quê:** `do_meio` 0 depois de muitos dias quer dizer que alguma coluna muda todo dia sem que se saiba (a regra não apagaria nada): descobrir qual antes de seguir, com `select key, count(*) from (…) group by 1` sobre as chaves que diferem entre vizinhas; o plano não afrouxa a regra sozinho.

**CP4 (já, e de novo no portão D): teste A/B e segundos gravados.**
```sql
select count(*) filter (where ab_test_id is not null) as com_teste, count(*) filter (where seconds_on_air_analytics is not null or seconds_on_air_reporting is not null) as com_segundos from public.yt_own_video_meta_daily;
```
Esperado: 0 e 0 (os dois testes acabaram em junho). **Muda o quê:** maior que zero não muda regra (emenda 1: D-I-2: linha com `ab_test_id` nunca é "do meio", pela regra 8); a Tarefa 6 já testa o caso; anotar no ledger.

**CP5 (já): linhas sem captura, por dia** (a P2 do plano E18).
```sql
select day_pt, count(*) as n, count(*) filter (where privacy_status is null) as sem_priv, count(*) filter (where thumbnail_dhash is null) as sem_dhash from public.yt_own_video_meta_daily group by 1 order by 1;
```
Esperado: 35 por dia; `sem_priv` 35 só em 07/10. **Muda o quê:** linha sem privacidade nunca é apagada; o número só diz quantas ficam.

**CP6 (já): buraco por vídeo.**
```sql
select count(*) as videos_com_buraco from (select youtube_video_id from public.yt_own_video_meta_daily group by 1 having count(*) <> max(day_pt) - min(day_pt) + 1) x;
```
Esperado 0. **Muda o quê:** buraco antigo é dia sem linha e sem cobertura: continua "ausência" depois da dieta (não é coberto). Só o número muda nas conferências.

**CP7 (já, e de novo no portão D): quem no banco cita a tabela.**
```sql
select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc ilike '%yt_own_video_meta_daily%' union all select 'visão: ' || viewname from pg_views where definition ilike '%yt_own_video_meta_daily%' union all select 'gatilho: ' || tgname from pg_trigger where tgrelid = 'public.yt_own_video_meta_daily'::regclass and not tgisinternal union all select 'job: ' || jobname from cron.job where command ilike '%meta_daily%' union all select 'chave estrangeira de: ' || conrelid::regclass::text from pg_constraint where contype = 'f' and confrelid = 'public.yt_own_video_meta_daily'::regclass order by 1;
```
Esperado hoje (emenda 1: S-m-5, D-m-6): **só** `competitor_hourly_health`, e nenhuma linha "chave estrangeira de". A `youtube_channel_removal_impact` conta pelo catálogo de chaves estrangeiras e não cita a tabela no corpo (`supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql:315-386`): ela não aparece, e isso não é defeito. No portão D: mais as da MG12 (`yt_own_versions_apply_day`, `yt_own_versions_prova`) e as três da MG17a (`yt_own_meta_cover_set`, `yt_own_meta_prova`, `yt_own_meta_cover`). **Muda o quê:** nome fora da lista é leitor novo: lido e posto na tabela de F5 e no teste "os leitores respondem o mesmo" antes da MG17.

**CP8 (já): os comentários das duas tabelas que recebem marca.**
```sql
select obj_description('public.yt_own_video_daily'::regclass, 'pg_class') as diario, obj_description('public.yt_own_video_meta_daily'::regclass, 'pg_class') as meta;
```
Esperado: nulo nos dois (no diário, depois da P3, nulo de novo: o Apêndice D do plano P3 retira a marca). **Muda o quê:** texto presente: a linha da marca do Apêndice E passa a gravar o texto antigo seguido da marca, e a linha de limpeza devolve o texto antigo.

**CP9 (portão D): as variáveis.** `vercel env ls production | grep -E "YT_OWN_STEPS_OFF|YT_OWN_META_DIETA_OFF"` (dono ou controlador). Esperado: as duas ausentes, ou a primeira sem `versoes`. **Muda o quê:** com a dieta desligada a migration apagaria o acumulado e o cron não enxugaria mais: tirar a variável antes.

**CP10 (depois da MG14): o `check` de `source`.**
```sql
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.yt_own_video_coverage'::regclass and contype = 'c' order by 1;
```
Esperado: três restrições; a de `source` com `analytics_api` e `reporting_api`. **Muda o quê:** se a MG14 for aplicada já com `data_api` e `imagem` (o controlador pode pedir isso ao plano irmão antes de o arquivo dela nascer), o bloco 1 da MG17a não faz nada, por desenho.

**CP11 (portão P): o backup.**
```sql
select count(*) as linhas, pg_total_relation_size('public.yt_own_video_daily_zeros_bkp') as bytes, obj_description('public.yt_own_video_daily_zeros_bkp'::regclass, 'pg_class') as nota from public.yt_own_video_daily_zeros_bkp;
```
Esperado: `nota` começando por `MG15 ` com `estado: apagado`, e `linhas` igual à soma de `apagadas`. **Muda o quê:** nota nula com linhas, ou contagem diferente: a MG16 recusa; descobrir antes.

**CP12 (portão P): nada depende do backup.**
```sql
select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc ilike '%yt_own_video_daily_zeros_bkp%' and p.proname <> 'yt_own_daily_bkp_soltar' union all select 'visão: ' || viewname from pg_views where definition ilike '%yt_own_video_daily_zeros_bkp%';
```
Esperado: nenhuma linha. **Muda o quê:** linha achada: a MG16 recusa. (emenda 1: D-m-6) A própria `yt_own_daily_bkp_soltar` fica de fora da busca: ela só sobra no banco depois de uma recusa em cliente que não aplique o arquivo numa transação só, e quem a procura é a leitura "Depois de uma recusa" do Apêndice E.

**CP13 (depois do código da cobertura; e no portão D): a prova da cobertura, por canal.**
```sql
select c.id, public.yt_own_meta_prova(c.site_id, c.id, (select max(day_pt) from public.yt_own_video_meta_daily m where m.channel_id = c.id)) from public.youtube_channels c where exists (select 1 from public.yt_own_video_meta_daily m where m.channel_id = c.id);
```
Esperado: `descobertas` 0 e `sem_explicacao` 0, com `linhas` maior que zero. **Muda o quê:** `linhas` 0 = nada foi avaliado. Qualquer número diferente de zero trava o portão D.

**CP14 (portão D): as 14 execuções limpas, pela regra da migration.** A consulta é o bloco (4) da função `yt_own_meta_diet` do Apêndice C, letra por letra, com `now()` no lugar de `p_agora` e devolvendo, dos 14 dias mais recentes, `dia, ultima, execucoes, limpa` e o detalhe de cada execução do dia (o texto inteiro está na seção 11, K3). Esperado: 14 linhas, uma por dia (emenda 1: D-I-3, S-I-2), 14 dias seguidos, `limpa` verdadeiro em todas, a primeira com a última execução há menos de 24 horas (emenda 1: D-m-8). **Muda o quê:** se o formato real de `resumo.metadados.cobertura` ou de `resumo.versoes` não for o que a regra lê, **o Apêndice C é corrigido antes** e as Tarefas 6 e 10 rodam de novo. Uma das 14 linhas, sem nomes de canal nas notas, vira a fixture real da Tarefa 15.

**Conferência pendente dentro da CP14, respondida pela primeira execução real:** uma execução normal traz `metadados.tentativas.ok` maior ou igual a 1, `pendentes` 0, `dias_sem_meta` com todos os canais em 0, `cobertura.ok` igual a `cobertura.canais`, e `versoes.confirmadas` maior ou igual a 1 com `atraso_dias` 0 em todo canal? **Muda o quê:** se uma execução boa de verdade não passar na regra (por exemplo, um canal sem vídeo publicado que nunca entra em `dias_sem_meta`), a regra **não é afrouxada sozinha**: o portão fica vermelho, o caso vai ao controlador e a novo parecer (a mesma regra do achado m-2 do parecer de dados da rodada 2 do plano P3).

**CP15 (portão D): a prova das versões.** A K2 do plano E18 (0) e `select origin, count(*) from public.yt_own_video_versions group by 1;` com `cms` ausente. **Muda o quê:** diferente disso, a MG17 não roda.

**CP16 (já): a hora real do cron.** A CP14 do plano P3, sem mudança. **Muda o quê:** alarga a janela proibida do Apêndice C.

**CP17 (portão P): o teste do item 191.** `git grep -n "PODEM_FALTAR" -- apps/web/test`. Esperado: a lista contém `yt_own_video_daily_zeros_bkp` (plano E17, Tarefa 11). **Muda o quê:** se não contiver, o teste fica vermelho na CI no push da Tarefa 14: o controlador acerta a lista com o dono daquele arquivo antes.

**CP18 (dono, no dia): a URL de conexão** (CP11 do plano P3).

**CP19 (já; emenda 1: D-I-3, S-I-2): dias com mais de uma execução do cron.**
```sql
select (ran_at at time zone 'utc')::date as dia, count(*) as execucoes from public.yt_own_collection_runs where ran_at > now() - interval '30 days' group by 1 having count(*) > 1 order by 1;
```
Esperado: não medido. **Muda o quê:** nenhuma linha: a reexecução é só risco do futuro, e a regra por dia do Apêndice C fica como defesa. Com linhas: a reexecução acontece de verdade; no portão D, a K3 mostra o detalhe de cada uma (`base`, `confirmou`, `sem_dia_novo`), e uma reexecução boa que não passe em `base` emenda o Apêndice C com novo parecer (a regra não é afrouxada sozinha). Antes de o passo de versões estar em produção não há `resumo.versoes`: a consulta só responde "acontece ou não".

**CP20 (já; emenda 1: D-m-4): a metade de metadados da regra, contra uma execução real.** `resumo.metadados` é gravado em produção desde 07/10.
```sql
select ran_at, resumo->'metadados' as m, falhas from public.yt_own_collection_runs order by ran_at desc limit 3;
```
Comparar à mão com as condições do bloco (4) do Apêndice C: `gravados` é número maior ou igual a 1; `pendentes` é 0; `tentativas.ok` é número maior ou igual a 1; `tentativas` não tem `sem_autorizacao`, `sem_conexao`, `nao_alcancado_orcamento` nem `schema_ausente`; `dias_sem_meta` é um objeto não vazio com todo valor 0; nenhuma nota começa por `metadados:`. **Muda o quê:** se uma execução boa de verdade não passar numa dessas, o Apêndice C é emendado **agora**, com novo parecer, e não no portão D. Se passar, o risco 3 fica só com a metade de versões e de cobertura, que ainda não tem linha real.

**CP21 (já, e de novo antes da Tarefa 3; emenda 1: S-m-2): quanto do teto de 30 s o passo de metadados já gasta.**
```sql
select ran_at, ms_passos->>'metadados' as ms from public.yt_own_collection_runs order by ran_at desc limit 14;
```
Esperado: não medido. **Muda o quê:** todas abaixo de 20.000: a chamada da cobertura segue no prazo do passo (`ctx.deadline`), como está. Alguma acima de 25.000: a cobertura sairia `sem_tempo` nesses dias e as 14 execuções nunca fechariam; a chamada ganha prazo próprio (como `TETO_CAPTURA_MS` faz para a captura) **antes** da Tarefa 3, por emenda com parecer. Entre 20.000 e 25.000: anotar, seguir, e conferir de novo na `e18p2-cob-d1`. `ms` nulo = o passo não rodou naquela execução: não conta como "abaixo".

---

## 4. Desenho

### 4.1 Por que não a regra literal do spec

O spec manda guardar só o dia em que algo mudou. Com isso um vídeo sem troca há uma semana fica sem linha recente, e seis leitores assumem que ela existe (F5): o critério de metadados e o `dias_sem_meta` ficariam vermelhos todo dia sem motivo; a função `competitor_hourly_health`, **já em produção**, tiraria da prova da leitura horária todo vídeo sem linha nos últimos 3 dias, e o que sobra disso é só uma nota que não deixa o cron vermelho ("sem captura de privacidade há 3 dias", `horaria/prova.ts:303-305`): a prova fecharia com menos vídeos, em verde; `contarNegadosCobraveis` contaria menos vídeos públicos, sem nota nenhuma. Consertar pediria recriar uma função de produção e mexer em quatro arquivos de outras trilhas. E há uma perda que o spec não viu: a janela de uma troca começa no instante da última conferência antes dela (`last_seen_at` da versão corrente, plano E18, seção 4.2); se a linha da véspera da troca sai, esse instante some e a atribuição "foi o A/B Lab ou foi fora do sistema" fica pior numa derivação refeita.

**A regra deste plano: de cada sequência de dias idênticos ficam as duas pontas.** Uma linha só sai quando é idêntica, coluna por coluna, à linha guardada antes e à guardada depois. Consequências, todas conferidas contra o código de F5:
- A linha do dia e a da véspera existem sempre. Todo leitor que procura "a mais recente", "as dos últimos 3 dias" ou "as do dia" acha o mesmo conjunto de valores (a linha apagada era igual às duas que ficaram, uma mais antiga e uma mais nova).
- A linha do dia da troca fica (ela difere da anterior) e a da véspera também (a seguinte difere dela): `yt_own_versions_apply_day` continua achando a linha para abrir a versão, e a janela da troca sai das mesmas duas capturas.
- Linha de dia de teste A/B fica **sempre** (emenda 1: D-I-2; regra 8 de 4.2), mesmo com segundos iguais aos dos vizinhos: é o único registro durável da exposição por variante, já que os ciclos do A/B Lab podem ser apagados. Para as outras colunas (contradição C-1 dos fatos) a comparação é da linha inteira, então nenhuma coluna, de hoje ou futura, é esquecida.
- Linha sem captura (`privacy_status` nulo) nunca sai: é a prova de que a captura falhou naquele dia.

O que se perde, e só isso: o **instante de captura** dos dias do meio. O dia continua sabido (a cobertura o guarda).

### 4.2 Quando uma linha sai (critério escrito uma vez, na função `yt_own_meta_linhas_do_meio`)

A linha do vídeo V no dia C sai se, e só se, valem as nove (emenda 1: as regras 8 e 9 são novas):

1. **Tem vizinha antes e depois.** Existe P, a linha mais recente de V antes de C, e N, a linha mais antiga de V depois de C.
2. **É idêntica às duas.** `to_jsonb(linha) - 'day_pt' - 'captured_at'` de C é igual ao de P, e o de N é igual ao de C. Entram na comparação todas as outras colunas, inclusive `site_id`, `channel_id`, `video_id`, `description_text`, `tags`, os quatro `seconds_*` e qualquer coluna que nasça depois.
3. **A vizinha de depois já é passado.** O dia de N é anterior ao dia que o cron acabou de gravar (`p_day`). A linha do dia pode ser completada por uma segunda execução (F1); as anteriores não mudam mais. Por isso as duas linhas mais recentes de cada vídeo nunca saem.
4. **Tem captura.** `privacy_status` não nulo.
5. **Está coberta.** Existe intervalo `meta_texto` do mesmo vídeo **e do mesmo site** que contém C; e, se a linha tem `thumbnail_dhash`, existe intervalo `meta_thumb` que contém C.
6. **Já foi derivada.** O canal tem linha em `yt_own_versions_state` do mesmo site com `derived_through` maior ou igual a C. Sem estado, nada sai.
7. **É deste site e deste canal** (os dois parâmetros da função).
8. **Não é dia de teste A/B** (emenda 1: D-I-2). `ab_test_id` nulo. Linha com teste nunca sai, nem quando os segundos se repetem em dias seguidos (variante no ar três dias inteiros).
9. **Não é fronteira de versão** (emenda 1: D-m-3). Não existe versão do vídeo, no mesmo site e fora do pré-registro, cujo `first_day_pt` seja C, nem versão não corrente cujo `last_day_pt` seja C. Pelo desenho do plano E18 uma fronteira de versão é sempre fronteira de linha, e a regra 2 já a guardaria; a regra 9 é a defesa para o caso de esse desenho mudar (ele ainda não existe em código), e faz a conta M8 valer também no enxugamento de todo dia, não só dentro da MG17.

A função devolve as linhas que passam nas regras 1 a 4 e 7 a 9, com duas colunas (`coberta`, `derivada`) para as regras 5 e 6. O apagamento usa só as que têm as duas verdadeiras; a migration **recusa** se alguma tiver uma delas falsa (estado desconhecido), em vez de apagar parte.

### 4.3 As peças

| Peça | Onde | O que faz |
|---|---|---|
| `yt_own_meta_cover_set` | MG17a | funde uma lista de dias na cobertura de um vídeo e um conjunto |
| `yt_own_meta_prova(p_site_id, p_channel_id, p_day)` | MG17a | só lê: `linhas`, `descobertas` (linha com captura fora da cobertura) e `sem_explicacao` (dia coberto, sem linha, que não está entre duas linhas idênticas). É o alarme permanente da dieta |
| `yt_own_meta_cover(p_site_id, p_channel_id, p_day, p_compactar)` | MG17a (só cobre); **corpo trocado pela MG17** (cobre e enxuga) | o que o passo de metadados chama, uma vez por canal, depois de gravar o dia. Cobre **toda** linha do canal ainda sem cobertura (a de hoje e as que ficaram para trás), então a carga inicial da MG17a é a mesma função |
| `yt_own_meta_linhas_do_meio` | MG17 | o critério de 4.2 |
| `coleta/meta-cobertura.ts` | código | chama a função, valida a resposta, monta `resumo.metadados.cobertura` e as notas |
| `coleta/versoes-fatos-cobertura.ts` | código | para dia coberto e sem linha, repete a última linha guardada do vídeo como fato do dia (item 202) |

**A troca de corpo é o interruptor de verdade.** O código é o mesmo antes e depois da MG17: ele pede a compactação sempre (salvo a variável de desligar) e a função responde o que fez (`indisponivel` antes da MG17; `feita`, `sem_estado` ou `desligada` depois). (emenda 1: S-I-3) O roteiro de desligar pelo banco devolve `desligada` **mesmo quando o código pediu a compactação**: pedir e receber `desligada` é nota vermelha (linha 14b da seção 6), e é assim que "desligada pelo roteiro" deixa de se confundir com "MG17 ainda não aplicada" (`indisponivel`, só resumo). Assim o comportamento destrutivo só entra pela migration que o dono aplica, e o "código tolerante aos dois estados" que o spec exige em `main` é tolerante por construção. Dentro da MG17, a troca do corpo acontece **na mesma instrução** que apaga e confere (um bloco `do`): se qualquer prova falhar, o corpo antigo fica, e nenhuma forma de aplicar o arquivo consegue deixar a compactação ligada sem o apagamento ter fechado as contas.

**O passo de metadados** ganha, no fim, uma chamada: `resumo.cobertura = await cobrirMetadados(ctx, day)`. Nada do que ele grava muda.

**O passo de versões** lê, por canal e execução, os intervalos `meta_texto` e `meta_thumb` que encostam no intervalo a derivar. Para cada dia e vídeo coberto e sem linha, monta um fato que é a cópia da última linha guardada do vídeo (com `privacy_status` nulo se o dia não está em `meta_texto`, e sem dHash se não está em `meta_thumb`): `derivarDia` confirma as versões correntes e `last_day_pt` avança; `last_seen_at` fica como estava (o instante da última linha real), até a próxima linha real o atualizar. Dia sem linha e sem cobertura continua sendo ausência. Abrir versão a partir de um fato repetido é impossível por construção (a linha repetida já foi derivada); se acontecer, o passo para o canal em vermelho e a função do banco recusaria de qualquer modo (`sem_linha_do_dia`). No caminho de todo dia isso não é exercitado, porque a regra 6 só deixa sair linha já derivada; é o caminho de uma derivação refeita, e é o que o item 202 testa.

### 4.4 As contas da MG17 (o item 202, escrito por extenso)

Todas por site, com `antes` e `depois` da mesma transação, exigidas dentro da função (qualquer uma que falhe desfaz tudo):

| # | Igualdade |
|---|---|
| E0 (antes) | nenhuma linha com captura fora da cobertura; nenhum dia coberto sem explicação; toda versão tem a linha do seu `first_day_pt` (e do `last_day_pt`, se não é a corrente); toda linha "do meio" está coberta e derivada |
| M1 | `linhas_depois = linhas_antes − apagadas`, e `apagadas` = as candidatas contadas antes |
| M2 | nenhuma linha "do meio" sobra |
| M3 | mesmo número de vídeos e de sequências, e **mesmo retrato das sequências**: md5 de (vídeo, primeiro dia, último dia, md5 do conteúdo, captura da primeira linha, captura da última linha) de cada sequência. Prova que só saiu linha do meio |
| M4 | mesmo retrato da situação: a linha mais recente com privacidade de cada vídeo (dia e valor). É a "coluna de vídeo público" da C0.11 |
| M5 | linhas com privacidade: `depois = antes − apagadas`; linhas com dHash: `depois = antes − apagadas com dHash`; linhas sem privacidade: iguais |
| M6 | soma dos dias cobertos de `meta_texto` e de `meta_thumb`: inalterada |
| M7 | depois: nenhuma linha com captura fora da cobertura, nenhum dia coberto sem explicação |
| M8 | depois: toda versão continua com a sua linha |

Os invariantes do spec e onde estão: "dias cobertos de cada vídeo e conjunto = linhas que ele tinha com aquele campo capturado" é E0 mais M6, e por vídeo é a K1; "linhas depois = primeiras linhas + linhas com mudança" vira M1 a M3 (desvio 4: ficam também as últimas de cada sequência e as duas mais recentes); "a derivação refeita dá as mesmas versões" é a Tarefa 8 (semente e, no dia, o CSV real).

### 4.5 A MG16 se prova sozinha

Uma função auxiliar (`yt_own_daily_bkp_soltar(p_agora)`, criada, chamada e apagada no arquivo; `p_agora` existe para o teste escolher a data) e um bloco `do`. A função solta a tabela só se: nada no banco a cita; o comentário é o da MG15 e as linhas batem com `apagadas`; passaram 14 dias do instante anotado; o dono pôs a marca de hoje; para cada site, todo dia do backup continua recriável (está na cobertura `base` ou voltou a ter linha), o diário não tem mais linhas vazias do que a MG15 deixou (o coletor antigo não voltou), e a cobertura `base` foi gravada nas últimas 36 horas. Backup vazio e sem comentário (banco novo, CI) sai sem exigir nada. Tabela ausente: não faz nada e avisa.

### 4.6 Segurança e LGPD

- **Quem lê `yt_own_video_meta_daily` e a cobertura:** não muda. As policies de leitura (`can_edit_site`, ou `can_view_private_site` depois da MG11) não são tocadas por nenhuma das três migrations. Não há leitura pública, então `site_visible` não se aplica. Nada aqui decide acesso pelo GUC `app.site_id`.
- **Funções:** todas `security invoker`, `set search_path = ''`, nomes qualificados; `revoke all` de `public`, `anon` e `authenticated`; `execute` só para `service_role` nas quatro que o cron usa (as auxiliares das migrations não têm `execute` para ninguém e não sobrevivem ao arquivo). (emenda 1: S-m-9) Só `yt_own_meta_cover`, a que o cron chama, confere que o canal é do site (`canal_fora_do_site`). `yt_own_meta_prova` e `yt_own_meta_linhas_do_meio` só leem e filtram as linhas pelo par recebido (par errado devolve zeros ou vazio, não dado de outro site). `yt_own_meta_cover_set` **grava o que receber**: quem garante o par é quem a chama (`yt_own_meta_cover`, que já conferiu); só o cliente de serviço do cron a alcança.
- **Service client:** o passo roda dentro do cron (rota autenticada por `CRON_SECRET`, cliente de serviço que já existe); nenhum código novo de tela ou de server action usa cliente de serviço. Os testes usam conexão direta ao banco local.
- **O CSV** fica numa pasta do dono fora do repositório; não vai ao Vercel Blob nem a commit. Traz título, descrição e tags de vídeos do canal, inclusive privados: **não é dado pessoal**, é dado privado do canal. Os retratos guardados em `.superpowers/sdd/a5/retratos/` trazem só contagens e md5.
- **Retenção:** a etapa não cria retenção nova (risco 37 do spec: o histórico de título e thumbnail do vídeo próprio além de 30 dias é "dado autorizado que não é estatística"; a tabela já o guarda desde 07/10 e a dieta guarda **menos**). O CSV fica com o dono sem prazo; vai ao NAS na fase do NAS.
- **Apagamento:** remover o site apaga as linhas e a cobertura por cascata. Remover o canal continua recusado enquanto houver série (`serie_coletada`); o runbook de "apagar a série de um canal" ganha a linha da cobertura de metadados (Tarefa 12).

---

## 5. As contas

**Chamadas de API e cota: zero.** Nenhuma tarefa chama o YouTube. A captura (`videos.list`, 1 unidade por lote de 50 vídeos, e o download das imagens) é a que já existe e não muda.

**Idas ao banco por execução do cron (não medidas; 50 ms por ida é a estimativa do plano E18):**

| Onde | A mais | Tempo |
|---|---|---|
| Passo de metadados | 1 chamada de função por canal com vídeo (2 hoje) | cerca de 0,1 s dentro do teto de 30 s (`TETOS_MS.metadados`, que não muda). (emenda 1: S-m-2) Quanto do teto o passo já gasta hoje **não foi medido**: é a CP21 |
| Passo de versões, dia normal | 1 leitura de cobertura por canal (2) | a conta do plano E18 vai de 11 para **13** idas, dentro do teto de 5 s dele |
| Passo de versões, com dia coberto e sem linha (só em derivação refeita) | mais 1 leitura por canal (a última linha guardada dos vídeos que faltam) | |

**Quando estoura.** A chamada da cobertura vai em `comPrazo(…, ctx.deadline)`. Sem resposta até o prazo: o resultado é desconhecido (a transação pode ter fechado no banco), o canal conta em `cobertura.sem_tempo`, sai nota vermelha, e a execução seguinte cobre o que faltou (a função cobre tudo o que está sem cobertura). Linha sem cobertura nunca é apagada, então estourar nunca perde dado: só adia o enxugamento. No passo de versões vale a regra dele: sem resposta, o canal para com `sem_tempo`. Os orçamentos acoplados do cron (270 s do relógio, 296 s da função, 300 s de `maxDuration`) e os da forja (20 min do claim, 25 min do cron, 30 min do vigia) não são tocados.

**Volume.**

| O que | Hoje | Depois da MG17 |
|---|---|---|
| Linhas por dia em `yt_own_video_meta_daily` | 35 (uma por vídeo) | entram 35 e saem cerca de 35 (a antepenúltima de cada vídeo parado): saldo perto de zero |
| Linhas por ano, 35 vídeos | 12.775, cerca de 7,9 MB a 615 B por linha (o spec arredonda para 9 MB) | (emenda 1: D-m-7) cerca de 175 fixas nos 35 vídeos de hoje (4 por vídeo parado: a primeira linha, que traz `description_text` e `tags`, e, da sequência seguinte, a primeira e as duas mais recentes; mais a de 07/10, sem privacidade), mais 2 por troca, mais os dias de teste A/B (todos ficam, pela regra 8: 10 testes de 14 dias são 140), mais os dias de captura falha: **cerca de 1.000 linhas, menos de 1 MB** (estimativa, não medida) |
| Com 100 vídeos novos por ano | cerca de 22 MB no primeiro ano (estimativa do spec) | mais 400 linhas (4 por vídeo: emenda 1, D-m-7) |
| `yt_own_video_coverage`, conjuntos `meta_*` | 0 | 2 intervalos por vídeo (70), mais 1 por buraco de captura |
| Espaço devolvido pela MG16 | | cerca de 23 MB (estimativa do spec; a AP mede) |

**Tempo das migrations: não medido.** MG17a: uma varredura da tabela diária por canal. MG16: três contagens sobre o backup (cerca de 94 mil linhas) com consulta à cobertura (70 intervalos). MG17: cinco varreduras de uma tabela de alguns milhares de linhas. A Tarefa 10 mede as três em volume igual ao de produção no dia. **Limites:** `lock_timeout` 5 s e `statement_timeout` 120 s. Quando estoura, a instrução se desfaz inteira e nada mudou. Acima de 10 s no ensaio: parar e avisar.

---

## 6. O que acontece quando o dado não existe, e em cada falha

"Vermelho" no cron = nota em `falhas`, o vigia manda o e-mail de sempre. "Resumo" = só em `resumo`, cron verde. Nas migrations, "vermelho" = o `db push` falha com a mensagem escrita, na tela do dono; nenhum e-mail.

**Cron (passo de metadados e passo de versões).**

| # | Situação | O que o código faz | Veredito |
|---|---|---|---|
| 1 | **Função ausente** (código sem a MG17a) | as linhas do dia são gravadas como hoje; a chamada devolve `PGRST202` | vermelho todo dia: `schema_ausente: yt_own_meta_cover`. Nada perdido |
| 2 | Erro de banco na chamada | canal conta em `cobertura.falhas` | vermelho: `erro de banco ao gravar yt_own_meta_cover` |
| 3 | A função recusa (`canal_fora_do_site`, `argumento_nulo`, `conjunto_invalido`) | idem | vermelho: `metadados: cobertura de <canal> recusada (<código>)`; texto fora da lista vira `erro_desconhecido` |
| 4 | Resposta fora da forma (campo ausente, tipo errado, `resultado` diferente de `ok`) | **nunca vira zeros**: o canal conta em `falhas` | vermelho: `metadados: cobertura de <canal> respondeu fora da forma` |
| 4b (emenda 1: S-m-3) | Resposta na forma, com `linhas` 0 (o canal tem vídeo e a função não achou linha dele: `site_id` das linhas diferente do site do canal, ou a gravação do dia falhou) | **não conta em `ok`**: o canal conta em `falhas`. Zero linha avaliada é "nada foi avaliado" | vermelho: `metadados: cobertura de <canal> não avaliou nenhuma linha` |
| 4c (emenda 1: S-m-4) | A chamada lança (rede) | `cobrirMetadados` captura por canal: conta em `falhas`, segue para o canal seguinte e devolve o resumo. Sem a captura, o orquestrador descartaria o resumo inteiro do passo, com as linhas já gravadas (o `catch` de `passo` em `coleta/index.ts`) | vermelho: `metadados: cobertura de <canal> falhou na chamada`, sem o texto da exceção |
| 5 | Sem resposta até o prazo | `cobertura.sem_tempo` verdadeiro | vermelho: `metadados: cobertura de metadados sem tempo em <n> canal(is)` |
| 6 | O passo de metadados não rodou (sem tempo no relógio) ou lançou | `resumo.metadados` sem a chave `cobertura` | o vermelho é o que já existe (orçamento, ou `metadados: <causa>`); a guarda das 14 execuções não conta o dia |
| 7 | Canal sem vídeo publicado | não é chamado | nada; `cobertura.canais` não o conta |
| 8 | Nenhum canal com vídeo (lista vazia) | `cobertura: {canais: 0, ok: 0, …}` | resumo. A guarda das 14 execuções exige `canais` maior ou igual a 1: ausência de coleta não é execução limpa |
| 9 | Linha do dia sem captura (API 403, 429, 500, credencial vencida, vídeo ausente da `videos.list`) | a linha é gravada sem privacidade, como hoje; **não é coberta** em `meta_texto`; nunca sai | o vermelho é o que o passo de metadados já emite |
| 10 | Imagem não baixou | linha sem dHash; não coberta em `meta_thumb` | idem |
| 11 | `descobertas` maior que zero depois da chamada (linha com captura que não entrou na cobertura) | | vermelho: `metadados: <n> linha(s) com captura fora da cobertura em <canal>` |
| 12 | `sem_explicacao` maior que zero (dia coberto sem linha, fora de uma sequência igual: linha apagada à mão, ou vizinha reescrita) | | vermelho: `metadados: <n> dia(s) coberto(s) sem linha e fora de uma sequência igual em <canal>`. **É o alarme permanente da dieta** |
| 13 | `compactacao: 'sem_estado'` (o canal não tem estado de versões) | nada sai | resumo. Quem acusa canal com linha e sem estado é a prova das versões (plano E18, linha 27) |
| 14 | `compactacao: 'indisponivel'` (a MG17 ainda não foi aplicada) | nada sai | resumo; é o estado normal até a MG17 |
| 14b (emenda 1: S-I-3) | O código **pediu** a compactação e a função respondeu `desligada` (o roteiro de desligar foi rodado no banco) | nada sai; a cobertura continua sendo gravada e o canal conta em `ok` | **vermelho todo dia**, até o roteiro de religar: `metadados: a compactação está desligada no banco em <canal> (religar: docs/ops/sql/dieta-meta-religar-compactacao.sql)` |
| 15 | Dieta desligada pela variável | a função cobre e não apaga; `cobertura.pedida: false` | **vermelho desde a primeira execução**: `metadados: a dieta diária está desligada por YT_OWN_META_DIETA_OFF`. Desvio 7 |
| 16 | Valor desconhecido na variável (`YT_OWN_META_DIETA_OFF=talvez`) | não desliga nada | vermelho: `YT_OWN_META_DIETA_OFF tem valor desconhecido` |
| 17 | Passo de versões: tabela de cobertura ausente | deriva só pelas linhas, como hoje; `resumo.versoes.cobertura_meta: 'schema_ausente'` | resumo (sem a tabela nada pode ter sido apagado) |
| 18 | Passo de versões: erro ao ler a cobertura | deriva só pelas linhas (o resultado final é o mesmo: as pontas de cada sequência estão lá; só `last_day_pt` anda um pouco atrás) | vermelho: `erro de banco ao ler yt_own_video_coverage` |
| 19 | Passo de versões: dia coberto e sem linha | fato repetido; confirma; `cobertos_sem_linha` no resumo | resumo |
| 20 | Passo de versões: fato repetido abriria versão | o canal para naquele dia, nada é gravado | vermelho: `versões: <canal> abriria versão em dia sem linha (<dia>)` |
| 21 | Passo de versões: a leitura da última linha guardada falha ou passa do teto | os vídeos sem linha ficam sem fato naquele dia | vermelho: erro de banco, ou `versões: <canal> tem linhas demais para uma execução` |
| 22 | Passo de versões: dia sem linha e sem cobertura | ausência, como hoje | o que o plano E18 já diz (linhas 5 e 12 da seção 6 dele) |

**Migrations.**

| Situação | O que a migration faz | O que o dono vê |
|---|---|---|
| MG17a sem a MG14, ou sem os dois conjuntos no `check` | recusa na primeira instrução | `MG17a depende da MG14: …` |
| MG17a com a tabela diária vazia (banco novo, CI) | cria as funções; a carga não acha canal | verde, aviso `MG17a: yt_own_video_meta_daily sem linhas, nada a cobrir` |
| MG17a: canal cujo `site_id` não bate com o das linhas | pula o canal e avisa | verde com `warning`; a VA2 acusa (`descobertas` maior que zero) |
| MG17a aplicada duas vezes | nada muda (o `check` já é o novo; a cobertura já contém os dias) | verde |
| MG16 sem a tabela de backup | não faz nada | verde, aviso `MG16: o backup não existe, nada a fazer`. **Em produção, na primeira aplicação, isso seria estado desconhecido:** o portão P3 e a VP2 (comentário nulo) mandam parar |
| MG16 com backup vazio e sem comentário (CI, banco novo) | solta | verde |
| MG16: função ou visão cita o backup | recusa | `MG16 recusada: ainda há função que cita o backup (…)` |
| MG16: backup com linhas e comentário que não é o da MG15, ou linhas diferentes de `apagadas` | recusa | `MG16 recusada: … Estado desconhecido: nada foi solto` |
| MG16 antes dos 14 dias | recusa | `MG16 recusada: a MG15 foi aplicada em …; o backup só pode ser solto a partir de …` |
| MG16 sem a marca de hoje | recusa | `MG16 recusada: o CSV não foi conferido hoje` |
| MG16: dia do backup fora da cobertura `base` e sem linha no diário | recusa | `MG16 recusada: N dia(s) do backup que a cobertura não recria` |
| MG16: o diário tem mais linhas vazias do que a MG15 deixou | recusa | `MG16 recusada: o diário voltou a ter linhas vazias (…). O coletor antigo está no ar?` |
| MG16: cobertura `base` parada há mais de 36 horas | recusa | `MG16 recusada: a cobertura do diário não foi gravada nas últimas 36 horas` |
| MG16: site do backup já apagado | as linhas órfãs são contadas e soltas junto | verde, `orfas` no retorno |
| MG17 sem a MG17a ou sem a MG12; colunas diferentes das esperadas | recusa na primeira instrução | `MG17 depende da …` / `MG17: yt_own_video_meta_daily mudou de forma` |
| (emenda 1: D-I-1, S-m-1) MG17 com a tabela **sem nenhuma linha** (banco novo, CI) | não apaga, não exige nada, e instala o corpo novo | verde, aviso `sem linhas, nada a apagar` |
| MG17 em site **com linhas e sem linha "do meio"**, com o enxugamento ainda desligado (o corpo da função é o da MG17a) | passa por **todas** as guardas (janela, marca, coleta em dia, 14 dias limpos, estado conhecido). Só com todas verdes devolve `nada_a_apagar` com `guardas: true`, e o corpo novo é instalado. Guarda que falha é **recusa**, e o corpo antigo fica: a migration nunca liga o apagamento diário sem ter avaliado nada | recusa com a mensagem da guarda; ou verde, `nada_a_apagar`, `guardas: true`. **Em produção isso continua sendo surpresa** (a CP3 espera milhares): o portão D5 manda parar antes; se passar, a VD2 mostra a marca ainda no comentário (nada foi apagado) e a VD1 mostra `corpo_novo` verdadeiro |
| MG17 em site sem linha "do meio" e com o enxugamento **já ligado** (segunda aplicação) | não apaga, não exige nada, não muda nada | verde, `nada_a_apagar`, `motivo: ja_ligada` |
| MG17 entre 11:30 e 13:00 UTC | recusa | `MG17 recusada: entre 11:30 e 13:00 UTC …` |
| MG17 sem a marca de hoje | recusa | `MG17 recusada: o ritual do CSV não foi feito hoje` |
| MG17: a última linha do site tem mais de 2 dias | recusa | `MG17 recusada: a última linha de metadados é de … (a coleta parou?)` |
| MG17: menos de 14 dias com execução, dia sujo, dias não seguidos, ou a última execução há 24 horas ou mais (emenda 1: D-m-8) | recusa | `MG17 recusada: preciso de 14 dias limpos seguidos, com a última execução há menos de 24 horas (achei N dia(s), M limpo(s), de … a …, a última execução em …; dias não limpos: <datas>)` (emenda 1: S-I-2) |
| (emenda 1: D-I-3, S-I-2) MG17: dia com mais de uma execução do cron | o dia é limpo se **alguma** execução dele é limpa pela regra inteira e **nenhuma** é suja. A reexecução sem dia novo a derivar (`versoes.dias_derivados` 0, com todo o resto da regra valendo) não limpa o dia sozinha e não o suja | dia que só tem a reexecução, ou em que alguma execução traz nota de metadados, de cobertura ou de versões: não limpo, e a data vai na mensagem |
| MG17: execução que **rodou e não coletou** (sem `cobertura`, `cobertura.canais` 0, `tentativas` sem `ok`, canal em `reautorizar`, versões desligado, em `recuperando`, com atraso, sem `confirmadas` numa execução que derivou dia novo) | não conta como limpa | idem |
| MG17: nota de outro passo (relatórios, diário, conferência vencida) numa das 14 | aceita: não é da dieta | verde (desvio 6) |
| MG17: linha com captura fora da cobertura, dia coberto sem explicação, versão sem linha, ou linha "do meio" sem cobertura ou sem derivação | recusa | `MG17 recusada: …` com os números. Nada foi apagado |
| MG17: as contas de depois não fecham | recusa: tudo se desfaz, **inclusive a troca do corpo da função** | `MG17 desfeita: as contas não fecham`, com os dois objetos |
| MG17: trava não sai em 5 s, ou a instrução passa de 120 s | erro do banco; tudo se desfaz | roda de novo; passou de 120 s: parar e avisar |
| MG17 aplicada duas vezes | na segunda não há linha "do meio": `nada_a_apagar`, o comentário da primeira fica | verde |
| CSV com menos linhas que a AD | a migration não sabe do CSV | a R1 compara e **para antes do passo d5** |
| API do YouTube 403, 429 ou 500 | não se aplica às migrations; o efeito indireto (captura falhou ontem) aparece como execução não limpa só se o passo acusar | recusa, acima |

**Interruptor.** `YT_OWN_META_DIETA_OFF` (variável da Vercel; lida a cada chamada, nunca no import): `1`, `true` ou `sim` desligam o enxugamento; ausente ou vazia = ligado. A cobertura continua sendo gravada com a dieta desligada. A variável só chega a deploy novo: desligar de verdade na hora é o roteiro SQL (seção 2, "Como desfazer"). (emenda 1: S-I-3) Desligado pelo roteiro, o cron também fica vermelho todo dia (linha 14b), até o roteiro de religar. **(reconciliação 13/10: R16) A Tarefa 12 acrescenta a linha de `YT_OWN_META_DIETA_OFF` em `docs/ops/env-vars.md` (o `CLAUDE.md` do projeto manda a lista completa morar lá; o plano só citava o runbook).**

---

## 7. Simulação do dia e dos seguintes

**MG17a e o código (D = o dia da promoção do código; a migration foi aplicada antes).**
- **Aplicação da MG17a, 18:00 UTC.** Para 2 canais e, digamos, 35 vídeos com 20 dias de linhas: a carga cobre 35 × 19 dias em `meta_texto` (as linhas de 07/10 não têm privacidade) e 35 × 20 em `meta_thumb`; cria 70 intervalos. VA1 a VA4.
- **D, 12:00 UTC.** O passo grava 35 linhas e chama a função 2 vezes: `texto` 35, `thumb` 35 (mais o que tiver ficado sem cobertura entre a migration e o código), `descobertas` 0, `sem_explicacao` 0, `compactacao: indisponivel`.
- **Se a credencial de um canal vencer em D + 3:** as linhas desse canal saem sem privacidade; a cobertura `meta_texto` dele para de crescer; nenhuma nota nova (a do passo de metadados já existe). No portão D essas execuções contam como limpas só se o passo não acusou nada, e ele acusa (`videos.list não trouxe privacy_status`): nota `metadados:`, dia sujo.

**MG16 (D = o dia; a MG15 foi aplicada em D − 14 ou antes).**
- **D, 17:30 UTC.** O dono roda `shasum -c` (OK), tira o CSV do backup (cerca de 94 mil linhas), grava a marca. O controlador roda a AP e guarda o comentário do backup no ledger.
- **D, 18:00 UTC.** `db:push:prod`: nada cita o backup; comentário lido (`MG15 2026-…Z […]`); linhas = `apagadas`; 14 dias passaram; marca de hoje; para o site, 0 dias fora da cobertura, 0 linhas vazias a mais, cobertura gravada há 6 horas; `drop table`; comentário do diário vira `MG16 … {"estado":"solto",…}`.
- **Se o dono rodar em D − 1** (13 dias): recusa com a data em que pode. O arquivo sai do repositório e volta amanhã.
- **Se o coletor foi revertido em D − 3:** o coletor antigo regravou os zeros da vida inteira; `vazias` no diário passa de 0 para dezenas de milhares: recusa. O backup fica, e é ele que diz o que era zero medido.
- **D + 1, 12:00 UTC.** O cron roda como antes; nada muda.

**MG17 (D = o dia; portão D verde).**
- **D, 17:30 UTC.** O dono tira o CSV (por exemplo 2.100 linhas, 60 dias × 35) e grava a marca. O controlador roda a AD, a R1 e a R2.
- **D, 18:00 UTC.** `db:push:prod`: cobre o que faltar (nada); contas de antes (`t` 2.100, `do_meio` perto de 1.850, todas cobertas e derivadas); janela, marca, coleta em dia, 14 execuções; trava; apaga 1.850; contas de depois (`t` 250, mesmas sequências, mesmo retrato); troca o corpo da função; comentário. VD1 a VD8.
- **D + 1, 12:00 UTC.** O passo grava 35 linhas e a função enxuga: para cada vídeo parado, a linha de D − 1 (antepenúltima) sai: `compactadas` perto de 35, `compactacao: feita`. O passo de versões lê a cobertura (2 idas a mais), acha 0 dia coberto sem linha no dia que deriva, confirma 105.
- **Se o dono trocar um título em D + 3:** a linha de D + 3 difere da de D + 2; as duas ficam para sempre; a versão nova abre com a janela entre as duas capturas, como hoje.
- **Se o cron não rodar em D + 5:** não há linha de D + 5; D + 5 não é coberto; o passo de versões vê ausência (regra dele). Nenhuma linha vizinha sai por causa disso (as vizinhas continuam idênticas e guardadas).
- **Se o passo de versões parar em D + 6** (`YT_OWN_STEPS_OFF=versoes`): `derived_through` para em D + 5; a função não acha linha derivada nova e não apaga mais; a tabela cresce 35 por dia; religado, o passo deriva tudo e a função enxuga o acumulado numa execução.

**Conferências com data** (entram em `lib/conferencias.ts` na Tarefa 11; três constantes, todas nascem `null`, e sem a data não há entradas):

| id | Quando | O que, e o valor esperado |
|---|---|---|
| `e18p2-cob-d0` | dia do código | VA1 a VA4 no ledger; `resumo.metadados.cobertura` da primeira execução com `ok` = `canais` e `descobertas` 0 |
| `e18p2-cob-d1` | + 1 | segunda execução igual; `ms_passos.metadados` sem salto (anotar); `resumo.versoes.cobertos_sem_linha` 0 |
| `e18p2-cob-d7` | + 7 | CP13 em 0; K1 em 0; nenhuma nota `metadados:` nova |
| `e18p2-cob-d14` | + 14 | CP14: é o gatilho do portão D (junto do D+14 do plano E18) |
| `e6-p4-d0` | dia da MG16 | AP e VP1 a VP4 no ledger; o CSV do backup com `sha256` |
| `e6-p4-d1` | + 1 | o cron rodou sem nota do diário; V6 do plano P3 (K4, K5, K8) |
| `e6-p4-d7` | + 7 | diário menor que 2 MB; o teste do item 191 verde na CI |
| `e18p2-d0` | dia da MG17 | AD e VD1 a VD8; os dois retratos; `sha256` do CSV; tamanho antes e depois (item 202) |
| `e18p2-d1` | + 1 | `cobertura.compactacao.feita` = canais; `compactadas` perto do número de vídeos; `sem_explicacao` 0; K2 do plano E18 em 0; `versoes.confirmadas` igual à de D − 1 |
| `e18p2-d7` | + 7 | linhas e tamanho (K4): crescimento perto de zero; K5 (a prova da leitura horária) sem vídeo "sem captura há 3 dias" que não existisse antes |
| `e18p2-d30` | + 30 | K4 de novo; K6: dias de teste A/B guardados, se houve teste |

---

## 8. Desvios do texto do spec, com o motivo

1. **A regra de apagar é "idêntica às duas vizinhas", não "igual à anterior nos campos comparados".** Motivos em 4.1. Consequências: ficam também a última linha de cada sequência e as duas mais recentes; a comparação é da linha inteira (resolve a contradição C-1 dos fatos: os segundos de teste A/B e as outras colunas que o spec não listou nunca saem); o dHash é comparado **exato**, não "a mais de 6 bits da âncora" (um bit de diferença guarda a linha; mais conservador, e dispensa medir distância em SQL). O invariante "linhas depois = primeiras + mudanças" vira M1 a M3. (emenda 1: D-I-2, D-m-3) Duas guardas a mais sobre a regra das vizinhas: linha de dia de teste A/B nunca sai (regra 8), e linha que é fronteira de versão nunca sai (regra 9).
2. **A MG17 do spec são duas migrations (MG17a e MG17), com código em produção entre elas** (contradições C-2 e C-3 dos fatos). O spec manda a MG17 preencher a cobertura e apagar de uma vez, sem que o código que grava a cobertura tenha rodado um dia. Aqui a carga da cobertura e as funções vão na MG17a (aditiva), o código roda 14 dias com a tabela inteira ainda lá (o que dá o invariante mais forte possível: cobertura = linhas, exatamente), e só então a MG17 apaga.
3. **O `check` de `source` da cobertura é alargado** (`data_api` e `imagem`). A MG14 só aceita `analytics_api` e `reporting_api`, e nenhum dos dois é verdade para a captura de metadados.
4. **O passo de metadados continua gravando a linha de todo dia**, e quem tira a linha do meio é a função que ele chama. O spec diz "passa a guardar só o dia em que algo mudou". É a forma de manter os leitores intactos. Custa um apagamento por dia feito pelo cron, que **entra na lista fechada de 9.2 do spec `06`** como linha nova (dívida, com o texto).
5. **Só sai linha de dia já derivado pelo passo de versões** (regra 6). O spec não pede; é o que faz o passo desligado ou atrasado encontrar todas as linhas ao voltar.
6. **"Execução limpa" é limpa para metadados, cobertura e versões**, não "sem nenhuma falha no cron"; e exige **prova de coleta**, não ausência de nota (desvio 12 do plano P3, herdado). O spec pede 14 execuções só do passo de versões; aqui as mesmas 14 têm de ter gravado a cobertura. (emenda 1: D-I-3, S-I-2) A conta é por **dia**, não por execução: 14 dias limpos seguidos; a reexecução do cron no mesmo dia, sem dia novo a derivar e sem nota, não suja o dia.
7. **O interruptor da dieta é vermelho desde a primeira execução**, não "nota até a 7ª, vermelho da 8ª". A regra do lote mora em `passos-desligados.ts` e `criteria-desligados.ts`, que este plano não pode editar; e dieta desligada não é estado normal (a tabela volta a crescer em silêncio).
8. **A migration destrutiva exige a marca do dia, recusa na janela do cron e some do repositório depois de uma recusa não reaplicada no dia** (regras do plano P3). O spec deixa isso ao processo.
9. **A volta da MG16 não é "só pelo CSV"** (spec `00`, linha 418): a volta B (recriar da cobertura) continua valendo, e a MG16 recusa se ela não cobrir todo dia do backup (contradição C-5).
10. **A MG16 não é só `drop table`:** traz as guardas de 4.5 (contradição C-6).
11. **A volta do interruptor de versões custa um redeploy** (contradição C-4): o plano E18 diz o contrário; vale a emenda I7 do plano E11. Este plano não corrige o texto do plano E18; avisa o controlador.
12. **Sem cópia dentro do banco na MG17** (o spec também não pede); a volta sem CSV recria da cobertura, com o instante de captura aproximado.
13. **O item 202 é afirmado em todas as colunas da versão** (menos `id` e `created_at`), não só nas quatro que o spec lista.

---

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`, salvo os que começam por `docs/`, `supabase/` ou `.superpowers/`. A lista de cada tarefa é fechada: se precisar de outro arquivo, para e avisa.

| T | O que | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 0 | Conferências de leitura e os três portões (controlador) | `.superpowers/sdd/a5-e18p2/progress.md`; `.superpowers/sdd/a5-e6-p4/progress.md` | CP1 a CP8, CP16: nada | todas |
| 1 | SQL de ensaio da MG17a e o teste contra o banco | `.superpowers/sdd/a5-e18p2/sql/mg17a.sql` (fora do git); `test/integration/a5-e18p2-cobertura-meta.test.ts` | MG14 no `bythiago_int` | 2, 9, 11 |
| 2 | Módulo da cobertura (contrato, variável, notas) | `src/lib/youtube/coleta/meta-cobertura.ts`; `test/youtube/coleta/meta-cobertura.test.ts` | nada | 1, 4, 9, 11 |
| 3 | Integração no passo de metadados | **`src/lib/youtube/coleta/meta-step.ts`**; **`test/youtube/coleta/meta-step.test.ts`**; **`test/youtube/coleta/fake-supabase.ts`** (um bloco) | 2; a Tarefa 5 do plano E18 commitada; a vez do arquivo; **(emenda 1: S-I-1) a MG17a em produção com VA1 a VA4** (é escrita e commitada dentro da Tarefa 13, passo 6) | nenhuma |
| 4 | Fatos pela cobertura (puro; item 202) | `src/lib/youtube/coleta/versoes-fatos-cobertura.ts`; `test/youtube/coleta/versoes-fatos-cobertura.test.ts` | Tarefas 2 e 3 do plano E18 commitadas (tipos e `derivarDia`) | 1, 2, 3, 9 |
| 5 | Integração no passo de versões | **`src/lib/youtube/coleta/versoes-step.ts`**; **`test/youtube/coleta/versoes-step.test.ts`** | 4; Tarefas 6 e 7 do plano E18 commitadas | 6, 9 |
| 6 | SQL de ensaio da MG17 e o teste contra o banco, em três entregas (emenda 1: S-m-6): 6a critério; 6b guardas e contas; 6c leitores e corpo novo | `.superpowers/sdd/a5-e18p2/sql/mg17.sql` e `cp14.sql` (fora do git); `test/integration/a5-e18p2-dieta.test.ts` | 1; MG12 e MG9 no `bythiago_int` | 5, 9 |
| 7 | Os quatro roteiros da MG17 (desligar, religar, volta B, retirar um dia da cobertura: emenda 1, S-I-3 e D-m-2) e o teste | `docs/ops/sql/dieta-meta-desligar-compactacao.sql`; `docs/ops/sql/dieta-meta-religar-compactacao.sql`; `docs/ops/sql/dieta-meta-volta-b-recriar-da-cobertura.sql`; `docs/ops/sql/dieta-meta-retirar-dia-da-cobertura.sql`; `test/integration/a5-e18p2-volta.test.ts` | 6 | 8, 9 |
| 8 | Teste de ponta do item 202 (derivação inteira contra derivação depois da dieta) e o ensaio com o CSV real | `test/integration/a5-e18p2-derivacao-igual.test.ts`; `.superpowers/sdd/a5-e18p2/sql/carregar-csv-de-ensaio.sql` (fora do git) | 5, 6; Tarefa 10 do plano E18 (a infraestrutura de teste do passo contra o banco) | 7, 9 |
| 9 | SQL de ensaio da MG16 e o teste (guardas e as voltas B e C depois do `drop`) | `.superpowers/sdd/a5-e6-p4/sql/mg16.sql` (fora do git); `test/integration/a5-e6-p4-soltar-backup.test.ts` | MG14 no `bythiago_int`; o ensaio da MG15 e os dois roteiros de volta do plano P3 (Tarefas 1 e 2 dele) | 1 a 8 |
| 10 | Ensaio das três migrations inteiras por `psql`, duas vezes, com tempo | `.superpowers/sdd/a5-e18p2/sql/prova.sql`, `prova-saida.txt`; `.superpowers/sdd/a5-e6-p4/sql/prova.sql`, `prova-saida.txt` (fora do git) | 1, 6, 7, 9 | 11, 12 |
| 11 | Conferências com data | **`src/lib/conferencias.ts`**; **`test/lib/conferencias.test.ts`**; **`.superpowers/sdd/a5/conferencias-com-data.md`** | nada | todas; **fila com as outras etapas** |
| 12 | Runbook | **`docs/ops/youtube-coleta-canais-proprios-runbook.md`** | 7 | 10, 11; **fila** |
| 13 | Arquivo da MG17a e o envio do código (portão A) | `supabase/migrations/<carimbo>_observatorio_a5_e18p2_cobertura_de_metadados.sql`; `src/lib/conferencias.ts` (só o valor de `E18P2_COBERTURA_DEPLOY`); `.superpowers/sdd/a5/conferencias-com-data.md`; os três arquivos da Tarefa 3, que é escrita aqui (emenda 1: S-I-1) | 1, 2, 4, 5, 10, 11; portão A | nenhuma |
| 14 | O dia da MG16 (portão P) | `supabase/migrations/<carimbo>_observatorio_a5_e6_p4_soltar_backup_do_diario.sql`; `src/lib/conferencias.ts` (só o valor de `E6_P4_APLICADA`); `.superpowers/sdd/a5/conferencias-com-data.md`; o teste do item 231, **se existir**; `.superpowers/sdd/a5/retratos/e6-p4-antes.json` e `e6-p4-depois.json` | 9, 10, 11, 12; portão P | nenhuma |
| 15 | O dia da MG17 (portão D) | `supabase/migrations/<carimbo>_observatorio_a5_e18p2_dieta_de_metadados.sql`; `test/youtube/coleta/fixtures/e18p2-execucao-real.json`; `test/integration/a5-e18p2-dieta.test.ts` (um teste a mais); `src/lib/conferencias.ts` (só o valor de `E18P2_APLICADA`); `.superpowers/sdd/a5/conferencias-com-data.md`; o teste do item 231, **se existir**; `.superpowers/sdd/a5/retratos/e18p2-antes.json` e `e18p2-depois.json` | 6, 7, 8, 10, 13; portão D | nenhuma |

**Ondas.** Onda 1 (já): 0, 2, 11. Onda 2 (MG14 no banco local): 1 e 9. Onda 3 (plano E18, Tarefas 2 e 3 commitadas): 4. (emenda 1: S-I-1) A Tarefa 3 saiu desta onda: é escrita dentro da Tarefa 13, depois da VA1 a VA4, porque qualquer push de `staging` leva tudo o que está commitado, e com ela em produção antes da MG17a o cron ficaria vermelho todo dia com `schema_ausente: yt_own_meta_cover`. Onda 4 (plano E18, Tarefas 6 e 7, e MG12 no banco local): 5, 6, depois 7 e 8. Onda 5: 10 e 12. Onda 6 (portão A): 13, com a 3 dentro. Onda 7 (portão P) e onda 8 (portão D), em qualquer ordem entre si e **nunca no mesmo dia**: 14 e 15.

**Ordem de envio, regra dura** (a mesma do plano P3, seção 9): os testes de integração das Tarefas 1, 6, 7, 8 e 9 leem o SQL de ensaio (fora do git) e, se ele não existir, o arquivo de migration; num checkout sem nenhum dos dois o teste lança "nem o arquivo de ensaio nem a migration existem" e a CI fica vermelha. Por isso os commits desses testes **só entram numa lista de push junto do arquivo de migration correspondente, depois de aplicado**: o da Tarefa 1 na 13; os das Tarefas 6, 7 e 8 na 15; o da Tarefa 9 na 14 (e, depois da MG16, os casos que precisam do backup constroem a tabela dentro da transação a partir do Apêndice A do plano P3: o arquivo da MG15 continua no repositório). (emenda 1: S-m-8) **Os outros commits:** o da Tarefa 11 vai no push da Tarefa 13. A Tarefa 7 faz **dois** commits, um só com os quatro roteiros de `docs/ops/sql/` e outro com o teste; o commit dos roteiros e o do runbook (Tarefa 12) vão **juntos**, no primeiro push entre o da Tarefa 14 e o da Tarefa 15 (a Tarefa 14 já depende da 12, que depende da 7), para `main` nunca citar arquivo de `docs/ops/sql/` que ainda não está lá; o commit do teste da Tarefa 7 continua indo só no push da 15. (emenda 1: S-I-1) **A Tarefa 5 pode ser commitada antes da MG17a:** sem a MG14 ela lê `cobertura_meta: 'schema_ausente'` (só resumo) e, com a MG14 e sem a MG17a, lê zero intervalos `meta_*` e deriva como hoje; e ela só pode existir depois das Tarefas 6 e 7 do plano E18, que esperam a MG12 em produção. As Tarefas 2 e 4 são módulos que o cron não chama.

**Arquivos compartilhados com OUTRAS etapas (em negrito na tabela). Uma só tarefa deste plano toca cada um.**

| Arquivo | Quem mais mexe | Regra |
|---|---|---|
| `coleta/meta-step.ts` e o teste dele | plano E18, Tarefa 5 (que reservou o arquivo para esta etapa) | **só a Tarefa 3**; depois da Tarefa 5 do plano E18; `git status` do arquivo limpo antes; um `import`, um campo opcional em `MetaResumo` e uma chamada antes do `return fechar()` final |
| `test/youtube/coleta/fake-supabase.ts` | toda etapa com função de banco | **só a Tarefa 3**; um bloco `rpcHandlers.yt_own_meta_cover` no fim, instalado por padrão (como `yt_own_attempt_record`), para os testes existentes do passo seguirem sem mudança |
| `coleta/versoes-step.ts` e o teste dele | plano E18 (dono; Tarefas 6 e 7) | **só a Tarefa 5**, depois das duas commitadas |
| `lib/conferencias.ts`, `test/lib/conferencias.test.ts`, `.superpowers/sdd/a5/conferencias-com-data.md` | todas | **dona: a Tarefa 11**; as Tarefas 13, 14 e 15 só trocam o valor de uma constante. Uma etapa por vez, na ordem do controlador. Nomes que não colidem com `E6_P3_APLICADA` nem `E18_DEPLOY` |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md` | E6, E8, E11, E18, E20, P3 | **só a Tarefa 12**: duas seções novas no fim e uma linha na seção 11 |
| `coleta/index.ts`, `coleta/criteria.ts`, `coleta/criteria-cobertura.ts`, `coleta/clock.ts`, `coleta/schema.ts`, `coleta/paginar.ts`, `coleta/passos-desligados.ts`, `coleta/criteria-desligados.ts`, `horaria/**`, `observatorio/proprio/**`, `observatorio/rules.ts`, `e2e/fixtures/observatorio-seed.ts`, `types/database.types.ts`, a rota do cron | várias | **este plano não toca** (importa de `clock.ts`, `schema.ts` e `paginar.ts`) |
| Testes de consumidores que podem comparar a forma de `resumo.metadados` (`test/youtube/coleta/{criteria,orcamento,tres-dias,index}.test.ts`, `test/cron/sync-analytics-metrics-veredito.test.ts`) | várias | a Tarefa 3 os **roda**; se algum quebrar pela chave nova `cobertura`, para e avisa (não estão na lista dela) |

**Restrições globais** (as de `.superpowers/sdd/a5-e11/regras-implementador.md`, mais estas). TypeScript estrito, sem `any`, nenhum `as unknown as` novo. Arquivos em kebab-case. Mensagem que o dono lê em português. Testes de servidor com `// @vitest-environment node`. Datas de teste relativas a hoje ou fixas no passado; nada no futuro. Testes de integração gated em `HAS_LOCAL_DB`, só contra o `bythiago_int` (`HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run <arquivo> --no-file-parallelism`); nunca `db:reset`; nunca o banco 54321/54322; nenhuma função chamada como `anon` ou `authenticated` (privilégio se confere por catálogo: o Postgres local cai). Cada teste cria o **seu** site e o **seu** canal; tudo o que é DDL (funções das migrations, tabela de backup) vive **só dentro de `begin; … rollback;`**. `yt_own_collection_runs` não tem site: os testes usam um `p_agora` fixo no passado (`2026-03-10T15:00:00Z`) e, dentro da transação e antes de semear, apagam a faixa que a função lê (`delete from public.yt_own_collection_runs where ran_at > <p_agora> - interval '20 days' and ran_at <= <p_agora>`, desfeito no `rollback`). Toda transação de teste começa com `set local lock_timeout = '5s'`. (emenda 1: S-m-11) **Armadilha:** toda transação de teste que aplica a MG17a (Tarefas 1, 6, 7 e 8) troca o `check` de `source` e segura uma trava exclusiva em `yt_own_video_coverage` até o `rollback`; o `bythiago_int` é dividido com os testes da E6, da E8 e da E11, que gravam nessa tabela. Por isso cada transação é curta (um caso por transação, nenhuma espera dentro dela); se o teste de outra etapa estourar os 5 s de `lock_timeout` enquanto estes rodam, é rodado de novo antes de ser investigado como defeito. Commit local por caminho explícito (`git add <arquivos>` e `git commit -m "…" -- <os mesmos>`), sem push, sem `--no-verify`, sem `stash`, sem `reset`. Nenhum comando ou espera acima de 4 minutos (suíte e `tsc` com saída em arquivo). Relatório em `.superpowers/sdd/a5-e18p2/task-<N>-report.md` (ou `a5-e6-p4/` para as Tarefas 9 e 14), resposta em até 10 linhas.

**Foco de revisão** (o que os dois especialistas devem atacar primeiro): (1) a regra das duas pontas contra cada leitor de F5: existe leitura que mude de resposta? (2) a troca do corpo de `yt_own_meta_cover` dentro do bloco `do` da MG17: é mesmo impossível ficar ligada sem o apagamento fechar? (3) a regra 3 (vizinha de depois no passado) contra a segunda execução do dia; (4) a regra das 14 execuções contra o formato real de `resumo`; (5) `sem_explicacao`: uma entrada que a faz subir e uma que não pode fazê-la subir; (6) o fato repetido no passo de versões e a igualdade do item 202 em todas as colunas; (7) a leitura do comentário da MG15 pela MG16; (8) o que falha em verde: `nada_a_apagar`, backup ausente, `cobertura.canais` 0.

---

## 10. As tarefas

### Tarefa 0: conferências de leitura e os portões (controlador)

**Objetivo.** Trocar por medida o que este plano marca "não medido" e fechar cada portão no seu dia.
**Como.** CP1 a CP8, CP16 e (emenda 1) CP19, CP20 e CP21 **já**; CP10 depois da MG14; CP13 depois do código da cobertura; CP11, CP12 e CP17 no portão P; CP9, CP14 e CP15 no portão D. O agente desta etapa não roda nada com `--linked`.
**Decide.** CP2b e CP10 podem emendar os Apêndices A e C antes das Tarefas 1 e 6; CP3 pode travar a etapa (se nada for "do meio"); CP14 pode emendar a regra das execuções.
**Pronto quando:** o ledger de cada portão tem a resposta de cada CP com data, e a tabela do portão preenchida no dia.

### Tarefa 1: SQL de ensaio da MG17a e o teste contra o banco

**Objetivo.** O Apêndice A rodando, duas vezes, com as provas por mutação.
**Arquivos.** O ensaio (cópia fiel do Apêndice A) e o teste. O teste lê o ensaio; se não existir, o arquivo `*_observatorio_a5_e18p2_cobertura_de_metadados.sql`; se nenhum existir, lança.
**Testes primeiro** (cada um numa transação desfeita; nome, entrada, esperado):
1. `aplica duas vezes sem erro e deixa o check de source com os quatro valores`: o arquivo inteiro, duas vezes; `pg_get_constraintdef` contém os quatro; uma restrição só cita `source`.
2. `tabela diária vazia: não cobre nada e avisa` (**dado ausente**): zero intervalos `meta_*`.
3. `carga: dias cobertos = linhas com captura, por vídeo e conjunto`: semente de 3 vídeos × 10 dias, o primeiro dia sem privacidade, um dia sem dHash num vídeo, um buraco de dois dias em outro. `meta_texto` de cada vídeo soma os dias com privacidade; `meta_thumb`, os com dHash; o buraco parte o intervalo em dois.
4. `linha sem privacidade nunca entra em meta_texto; linha sem dHash nunca entra em meta_thumb` (**fronteira**).
5. `yt_own_meta_cover é idempotente`: chamar de novo devolve `texto` 0 e `thumb` 0 e não muda `collected_at` de intervalo nenhum.
6. `cobre o que ficou para trás`: linhas de três dias sem cobertura; uma chamada com `p_day` no terceiro cobre os três.
7. `p_day limita`: linha de dia posterior a `p_day` não é coberta.
8. `funde com o intervalo vizinho e não cria intervalo picado`: cobertura `[1, 3]` e `[5, 7]`; cobrir o dia 4 deixa `[1, 7]`, uma linha.
9. **mutação de site:** canal de outro site com `p_site_id` deste: exceção `canal_fora_do_site`. Tirar a conferência do canal faz o teste falhar.
10. **mutação de canal:** dois canais no mesmo site; cobrir o canal A não cria cobertura de vídeo do canal B. Tirar `m.channel_id = p_channel_id` faz o teste falhar.
11. `prova: descobertas sobe com linha capturada sem cobertura; não sobe com linha sem captura; tabela vazia devolve linhas 0` (os três sentidos).
12. `prova: sem_explicacao sobe com dia coberto sem linha entre vizinhas diferentes, e com dia coberto depois da última linha; não sobe com dia coberto sem linha entre vizinhas idênticas; não sobe com dia sem linha e sem cobertura`.
13. `compactacao é indisponivel e nenhuma linha sai, com p_compactar verdadeiro`: contagem da tabela diária igual antes e depois.
14. `privilégios por catálogo`: as três funções sem `execute` para `anon` e `authenticated`, com `execute` para `service_role`; `search_path` vazio em `proconfig`.
15. `a tabela diária não muda`: md5 de todas as linhas igual antes e depois do arquivo.
16. `serie_coletada conta a cobertura de metadados e a remoção de canal continua recusada` (não é erro de chave: é `status: 'serie_coletada'`).
**Pronto quando:** os 16 verdes, duas vezes seguidas; nada ficou no banco depois do `rollback` (`select count(*)` da cobertura `meta_*` e das três funções em 0); o relatório traz cada vermelho inicial.

### Tarefa 2: módulo da cobertura

**Contrato** (`src/lib/youtube/coleta/meta-cobertura.ts`):
```ts
export const VARIAVEL_DIETA_OFF = 'YT_OWN_META_DIETA_OFF'
export type EstadoCompactacao = 'feita' | 'desligada' | 'sem_estado' | 'indisponivel'
export interface CoberturaCanal { texto: number; thumb: number; linhas: number; descobertas: number
  semExplicacao: number; compactacao: EstadoCompactacao; compactadas: number }
export interface CoberturaMetaResumo { pedida: boolean; canais: number; ok: number; falhas: number; sem_tempo: boolean
  texto: number; thumb: number; descobertas: number; sem_explicacao: number; compactadas: number
  compactacao: Partial<Record<EstadoCompactacao, number>> }
/** Ausente ou vazia: true. '1', 'true', 'sim' (sem diferenciar maiúsculas, espaços tolerados): false. Outro valor: true. */
export function compactacaoPedida(env?: NodeJS.ProcessEnv): boolean
export function notaValorDesconhecido(env?: NodeJS.ProcessEnv): string | null
/** Forma inesperada devolve null. Nunca devolve zeros inventados. */
export function lerRespostaCobertura(data: unknown): CoberturaCanal | null
export const RECUSAS_DA_COBERTURA: readonly string[]   // 'argumento_nulo', 'canal_fora_do_site', 'conjunto_invalido'
export async function cobrirMetadados(ctx: StepCtx, day: string, canais: readonly ColetaChannel[]): Promise<CoberturaMetaResumo>
```
`cobrirMetadados` chama `ctx.supabase.rpc('yt_own_meta_cover', { p_site_id, p_channel_id, p_day: day, p_compactar })` uma vez por canal recebido, dentro de `comPrazo(…, ctx.deadline)`, lê a variável **a cada chamada** e empurra as notas da seção 6 (linhas 1 a 5, 4b, 4c, 11, 12, 14b, 15 e 16) com `pushUnico`. (emenda 1: S-m-4) A chamada de cada canal vai num `try/catch`: exceção conta em `falhas`, vai ao Sentry e **não sobe**. (emenda 1: S-m-3) Resposta com `linhas` 0 conta em `falhas`, não em `ok`. (emenda 1: S-I-3) `p_compactar` verdadeiro com resposta `desligada` gera a nota da linha 14b (o canal continua em `ok`: a cobertura foi gravada). Nenhuma nota leva título, descrição, URL nem texto do Postgres.
**Testes primeiro** (`test/youtube/coleta/meta-cobertura.test.ts`, com o banco falso):
1. `variável apagada: a compactação é pedida` (`delete process.env.YT_OWN_META_DIETA_OFF`; afirma `true` e que a `rpc` recebeu `p_compactar: true`). É o teste do padrão.
2. `'1', 'true', ' SIM ' desligam; '' não desliga; 'talvez' não desliga e gera a nota de valor desconhecido`.
3. `resposta boa de dois canais soma no resumo` (`canais` 2, `ok` 2, contagens somadas, `compactacao: {indisponivel: 2}`).
4. `lista de canais vazia: canais 0, ok 0, nenhuma nota` (**dado ausente**; e o resumo não diz "ok" de nada).
5. `função ausente (PGRST202): nota schema_ausente: yt_own_meta_cover, falhas 1, ok 0`.
6. `erro de banco: nota de erro de banco, sem o texto do Postgres`.
7. `recusa conhecida: nota com o código; recusa com texto livre: erro_desconhecido, e o texto não aparece em nota nem no que vai ao Sentry` (com um título fictício dentro da mensagem).
8. `resposta sem o campo descobertas, com texto no lugar de número, ou com resultado diferente de ok: falhas 1 e a nota "fora da forma"` (três entradas).
9. `sem resposta até o prazo: sem_tempo verdadeiro e a nota de sem tempo`.
10. `descobertas 2 e sem_explicacao 3 geram as duas notas vermelhas, com o nome do canal e os números`.
11. `sem_estado e indisponivel não geram nota`.
12. `dieta desligada: p_compactar false na chamada, pedida false, e a nota vermelha da variável`.
13. **mutação:** a chamada leva o `site_id` e o `id` **do próprio canal** (dois canais de sites diferentes; trocar um pelo outro faz o teste falhar).
14. (emenda 1: S-m-3) `resposta na forma com linhas 0: falhas 1, ok 0, e a nota "não avaliou nenhuma linha"` (**dado ausente**).
15. (emenda 1: S-m-4) `a chamada lança no primeiro canal: falhas 1, a nota não traz o texto da exceção, o segundo canal ainda é chamado, e a função devolve o resumo em vez de lançar`.
16. (emenda 1: S-I-3) `pediu a compactação e recebeu desligada: nota vermelha com o caminho do roteiro de religar, e o canal em ok`; `não pediu (variável) e recebeu desligada: só a nota da variável`.
**Pronto quando:** os 16 verdes; `tsc --noEmit -p apps/web` limpo; `bash scripts/check-type-debt.sh` no número de antes.

### Tarefa 3: integração no passo de metadados

**Quando (emenda 1: S-I-1). Esta tarefa só é escrita e commitada depois de a MG17a estar em produção com VA1 a VA4 conferidas** (passo 6 da Tarefa 13), no mesmo dia do push. O trabalho é todo em `staging`, e qualquer push desse ramo leva junto tudo o que estiver commitado: com este commit em produção antes da função, o cron das 12:00 UTC ficaria vermelho todo dia com `schema_ausente: yt_own_meta_cover`, escondendo as outras falhas no e-mail do vigia. É a regra da Tarefa 7 do plano E18 (emenda S-I3 dele). **Antes dela, a CP21** (quanto do teto de 30 s o passo já gasta).
**Mudança.** Em `meta-step.ts`: `import { cobrirMetadados, type CoberturaMetaResumo } from './meta-cobertura'`; `MetaResumo` ganha `cobertura?: CoberturaMetaResumo`; logo antes do `return fechar()` final (depois do laço dos critérios, linha 545 de hoje), `resumo.cobertura = await cobrirMetadados(ctx, day, canais.filter(c => videos.some(v => v.channel_id === c.id)))`. **Nenhuma outra linha muda.** As saídas antecipadas do passo (sem canais, sem tempo, schema ausente, erro ao ler vídeos) continuam sem a chave: ausência de `cobertura` quer dizer "não foi avaliado".
**Bloco novo em `fake-supabase.ts`:** `db.rpcHandlers.yt_own_meta_cover`, instalado na criação: conta nas tabelas falsas as linhas do canal até `p_day` e devolve `{resultado: 'ok', dia, texto, thumb, linhas, descobertas: 0, sem_explicacao: 0, compactacao: 'indisponivel', compactadas: 0}`. `db.errors['rpc:yt_own_meta_cover']` continua tendo precedência.
**Testes primeiro** (em `meta-step.test.ts`):
1. `o passo chama a cobertura uma vez por canal com vídeo, depois de gravar as linhas, com o dia gravado` (a ordem das chamadas no banco falso: todos os `upsert` antes da `rpc`).
2. `canal sem vídeo publicado não é chamado` (**fronteira**).
3. `função ausente: as linhas do dia são gravadas do mesmo jeito e a nota é schema_ausente: yt_own_meta_cover`.
4. `passo sem tempo no começo, e passo que para por schema ausente da tabela diária: resumo sem a chave cobertura` (**dado ausente**).
5. `os testes que já existiam do passo continuam verdes sem mudança`.
**Depois:** rodar os testes de consumidores listados na seção 9, com saída em arquivo.
**Pronto quando:** tudo verde; `git diff --stat` do arquivo de produção mostra menos de 10 linhas mudadas.

### Tarefa 4: fatos pela cobertura (puro)

**Contrato** (`src/lib/youtube/coleta/versoes-fatos-cobertura.ts`; `LinhaDiaria` é o tipo de linha que o passo de versões lê, definido no plano E18, Tarefa 2):
```ts
export interface IntervaloMeta { youtube_video_id: string; metric_set: 'meta_texto' | 'meta_thumb'; covered_from: string; covered_to: string }
export interface FatosDoDia { linhas: LinhaDiaria[]; repetidos: ReadonlySet<string>; cobertos_sem_linha: number }
/** `ultimas`: por vídeo, a linha mais recente com day_pt anterior a `dia`. */
export function fatosDoDia(dia: string, linhasDoDia: readonly LinhaDiaria[], ultimas: ReadonlyMap<string, LinhaDiaria>, cobertura: readonly IntervaloMeta[]): FatosDoDia
/** Vídeos cobertos em `dia` (em qualquer dos dois conjuntos) que não têm linha em `dia`. */
export function videosCobertosSemLinha(dia: string, linhasDoDia: readonly LinhaDiaria[], cobertura: readonly IntervaloMeta[]): string[]
```
Regra: vídeo com linha no dia entra como está. Vídeo sem linha, coberto e com `ultimas`: entra uma cópia da última linha com `day_pt = dia`, `captured_at` igual ao da última linha, `privacy_status` nulo se o dia não está em `meta_texto`, e `thumbnail_dhash` e `thumbnail_sha256_at_capture` nulos se não está em `meta_thumb`. Vídeo coberto e sem `ultimas`: não entra (não se inventa fato), e conta em `cobertos_sem_linha` do mesmo jeito. Vídeo sem linha e sem cobertura: não entra.
**Testes primeiro:**
1. `dia com todas as linhas: devolve as mesmas, repetidos vazio`.
2. `cobertura vazia: devolve só as linhas do dia` (**dado ausente**).
3. `coberto nos dois conjuntos e sem linha: cópia da última, com o dia trocado`.
4. `coberto só em meta_thumb: a cópia vem sem privacidade` e `coberto só em meta_texto: a cópia vem sem dHash`.
5. `fronteira do intervalo: covered_from e covered_to contam; um dia antes e um dia depois não`.
6. `sem última linha: não entra, e conta`.
7. **Item 202, parte pura, com semente fixa** (gerador com semente; 200 sequências de 40 dias por vídeo, com trocas de título, de descrição, deriva de dHash, retoque, dia sem captura, dia sem linha, vídeo privado, dias de teste A/B): derivar dia a dia com `derivarDia` sobre a sequência inteira; "emagrecer" a sequência em memória pela regra de 4.2 (função auxiliar do teste, escrita a partir do texto da regra, não do SQL; (emenda 1: D-I-2, D-m-3) **com** a regra 8, linha de dia de teste A/B não sai, e **sem** a regra 9, que só existe no banco: o teste emagrece igual ou mais do que o banco, e assim prova a afirmação de que fronteira de versão é sempre fronteira de linha) e derivar de novo com `fatosDoDia`: **as mesmas versões**, em todas as colunas que a função pura produz.
8. `dia coberto sem linha avança last_day_pt; dia não coberto não avança` (os dois, com o valor de `last_day_pt` afirmado).
9. `a sequência A, B, A dá três versões nas duas derivações` (item 199, sobre a tabela emagrecida).
**Pronto quando:** os 9 verdes, com a semente escrita no teste; `tsc` limpo.

### Tarefa 5: integração no passo de versões

**Mudança** (em `versoes-step.ts`, depois da leitura das linhas do intervalo, passo 4 da seção 4.3 do plano E18):
- Uma leitura por canal e execução: `yt_own_video_coverage`, colunas `youtube_video_id, metric_set, covered_from, covered_to`, filtrando `site_id` **e** `channel_id`, `metric_set` em (`meta_texto`, `meta_thumb`), `covered_to >=` começo do intervalo e `covered_from <=` fim, ordenada por `youtube_video_id, metric_set, covered_from`, com `lerPaginado` (teto 20.000), dentro de `comPrazo`.
- Só se `videosCobertosSemLinha` achar algum vídeo em algum dia do intervalo: uma leitura das linhas desses vídeos com `day_pt` anterior ao começo do intervalo (`site_id`, `channel_id`, `.in('youtube_video_id', ids)`, ordem `youtube_video_id, day_pt desc`, as mesmas colunas da leitura do passo, **sem** `description_text`), paginada, teto 20.000; fica a mais recente de cada vídeo. Dentro do intervalo, a "última" de cada vídeo anda em memória, dia a dia.
- Cada dia passa por `fatosDoDia` antes de `derivarDia`. Abertura cujo vídeo está em `repetidos`: nota da linha 20 da seção 6 e o canal para naquele dia, sem chamar `apply_day`.
- `VersoesResumo` ganha `cobertos_sem_linha: number` e `cobertura_meta: 'lida' | 'schema_ausente' | 'erro'`.
**Testes primeiro** (em `versoes-step.test.ts`):
1. `dia normal: uma leitura de cobertura por canal e nenhuma leitura de última linha` (trava o número de idas: 13 para 2 canais e 1 site).
2. `tabela de cobertura ausente: deriva pelas linhas, cobertura_meta schema_ausente, nenhuma nota` (**dado ausente**).
3. `erro ao ler a cobertura: deriva pelas linhas e nota vermelha de erro de banco`.
4. `cobertura sem resposta até o prazo: o canal para com sem_tempo, sem nota de erro de banco`.
5. `dia coberto e sem linha: a versão corrente é confirmada (last_day_pt = o dia), last_seen_at não muda, cobertos_sem_linha conta`.
6. `dia sem linha e sem cobertura: nada é confirmado para o vídeo` (o caso de hoje).
7. `fato repetido que abriria versão: canal parado, nota vermelha, apply_day não é chamada`.
8. `leitura da última linha passa do teto: nota "linhas demais" e os vídeos ficam sem fato`.
9. **mutação de canal:** intervalo de cobertura de vídeo de outro canal do mesmo site não vira fato (tirar o filtro de `channel_id` faz o teste falhar). **mutação de site:** idem com `site_id`.
10. `os testes que já existiam do passo continuam verdes` (a contagem de idas do teste 19 do plano E18 sobe de 43 para 45: atualizar o número **e dizer no relatório**).
**Pronto quando:** tudo verde; `tsc` limpo.

### Tarefa 6: SQL de ensaio da MG17 e o teste contra o banco

**Objetivo.** O Apêndice C rodando: o critério, as guardas, as contas, e a prova de que os leitores respondem o mesmo.
**Três entregas (emenda 1: S-m-6), cada uma com o seu relatório de vermelhos iniciais (`task-6a-report.md`, `task-6b-report.md`, `task-6c-report.md`) e o seu commit:** **6a, o critério** (testes 1 a 8 e 8b); **6b, as guardas e as contas** (testes 9 a 14, 19 e 20); **6c, os leitores e o corpo novo** (testes 15 a 18). A 6b começa com a 6a verde; a 6c, com a 6b verde. O arquivo de ensaio e o arquivo de teste são os mesmos nas três.
**Como o teste monta as funções.** Lê o ensaio (ou o arquivo de migration), aplica a MG17a, e extrai por marcas (`-- >>> MG17 <nome> (início)` e `(fim)`) os blocos das funções; chama `yt_own_meta_diet(site, p_agora)` com `p_agora` fixo, sem rodar o bloco `do` final. A marca do dia entra por `comment on table` dentro da transação.
**Semente comum** (`semear(site, canal)`): 6 vídeos × 20 dias terminando em `p_agora` menos 1 no Pacífico; primeiro dia sem privacidade; vídeo 2 troca o título no dia 8 e volta no dia 12; vídeo 3 tem dois dias de captura falha; vídeo 4 tem 5 dias de teste A/B com `seconds_*` diferentes a cada dia; vídeo 5 é privado; vídeo 6 tem um buraco de dois dias; estado de versões com `derived_through` no último dia; 14 execuções boas em 14 dias seguidos.
**Testes primeiro:**
1. `critério: só sai linha idêntica às duas vizinhas` (conta as devolvidas contra uma lista escrita à mão no teste).
2. `as duas linhas mais recentes de cada vídeo nunca saem` (**fronteira** da regra 3: com `p_day` um dia menor, a antepenúltima também fica).
3. `linha sem privacidade nunca sai, mesmo idêntica às vizinhas`.
4. (emenda 1: D-I-2) `linha de dia de teste A/B nunca sai: nem com segundos diferentes dos vizinhos (C-1), nem com segundos iguais nos três dias (regra 8)`; e `a linha sem teste, idêntica às duas vizinhas, sai normalmente ao lado dela`. Tirar `ab_test_id is null` do critério faz o caso dos segundos iguais falhar.
5. `linha com description_text ou tags diferentes das vizinhas nunca sai`.
6. `linha sem cobertura meta_texto volta com coberta falsa; com dHash e sem meta_thumb, idem`.
7. `linha além de derived_through volta com derivada falsa; canal sem estado: todas com derivada falsa`.
8. **mutação de site e de canal** em `yt_own_meta_linhas_do_meio`: linhas do mesmo vídeo em outro site no meio da sequência (as vizinhas mudam); dois canais no mesmo site (não devolve o outro). Tirar cada filtro faz um teste falhar.
8b. (emenda 1: D-m-3) `linha que é first_day_pt de uma versão fora do pré-registro, ou last_day_pt de uma versão não corrente, não sai mesmo idêntica às duas vizinhas` (a versão é posta à mão sobre uma linha do meio; sem ela a linha sairia); `versão de pré-registro, e last_day_pt da versão corrente, não seguram a linha`; **mutação de site:** a mesma versão em outro site não segura.
9. `yt_own_meta_diet apaga, e as oito igualdades fecham` (o objeto devolvido, campo a campo; e depois, pela função de prova, `sem_explicacao` 0).
10. (emenda 1: D-I-1, S-m-1) Três casos (**dado ausente**): `site sem nenhuma linha: nada_a_apagar com motivo sem_linhas, sem exigir marca, hora nem execuções`; `site com linhas, sem linha do meio e com o corpo da MG17a: sem a marca RECUSA, e o corpo de yt_own_meta_cover continua o da MG17a (prosrc sem yt_own_meta_linhas_do_meio); com a marca, a hora e as 14 execuções, nada_a_apagar com guardas true`; `o mesmo site com o corpo novo já instalado: nada_a_apagar com motivo ja_ligada, sem exigir nada`. O primeiro e o terceiro chamam a função direto; o segundo roda também o bloco `do` do arquivo, para provar que a recusa não deixa o corpo trocado.
11. Recusas, uma por teste, cada uma afirmando a mensagem e que a contagem da tabela não mudou: `janela do cron` (11:30, 12:59; e 11:29 e 13:00 passam); `sem a marca`; `marca de ontem`; `última linha com 3 dias`; `13 dias de execução`; `14 dias com um buraco`; `última execução há 25 horas` (e `há 23 horas` passa: emenda 1, D-m-8).
12. Execução não limpa, uma por teste (cada uma troca **uma** das 14): sem a chave `metadados`; sem `cobertura`; `cobertura.canais` 0; `cobertura.ok` menor que `canais`; `cobertura.descobertas` 1; `cobertura.sem_tempo` verdadeiro; `tentativas` sem `ok`; `tentativas.sem_autorizacao` 1; `pendentes` 1; `dias_sem_meta` com um canal em 2; `dias_sem_meta` vazio; sem a chave `versoes`; `versoes.desligado` verdadeiro; `versoes.recuperando` não vazio; `versoes.atraso_dias` com 1; `versoes.confirmadas` 0 com `dias_derivados` 2; nota `metadados: …`; nota `versões: …`; nota `schema_ausente: yt_own_versions_state`. E `nota de outro passo (relatórios: …) não suja`. (emenda 1: D-I-3, S-I-2) **Dia com mais de uma execução**, um caso por teste: `execução limpa seguida de reexecução sem dia novo (dias_derivados 0, confirmadas 0) e sem nota: dia limpo`; `execução limpa seguida de reexecução com nota de metadados: dia sujo`; `reexecução com nota ANTES da execução limpa, no mesmo dia: dia sujo`; `dia que só tem a reexecução sem dia novo: não é limpo`. E `a mensagem de recusa traz as datas dos dias não limpos`.
13. `linha do meio sem cobertura (apagando um intervalo à mão): recusa, nada sai`; `canal sem estado de versões: recusa`; `versão cujo first_day_pt não tem linha: recusa`.
14. `as contas não fecham`: com um gatilho de teste que insere uma linha durante o `delete` (criado e destruído na transação), a função lança `MG17 desfeita` e a contagem volta.
15. `depois da troca de corpo, yt_own_meta_cover com p_compactar verdadeiro enxuga um dia; com falso, não; sem estado, devolve sem_estado e não apaga` (aplica o bloco da função nova extraído do `do`).
16. `segunda execução do dia não desfaz`: reescrever a linha do dia com outro título depois de uma compactação: `sem_explicacao` continua 0 (a regra 3 garantiu que a vizinha usada era do passado).
17. **Os leitores respondem o mesmo, antes e depois** (uma leitura por teste, sobre a semente, antes e depois da dieta, com resultado idêntico): a contagem de linhas do dia por canal (`criteria.ts`); o `max(day_pt)` anterior ao dia por canal (`dias_sem_meta`); a linha anterior de cada vídeo (as sete colunas de `meta-step.ts:292`); a privacidade mais recente de cada vídeo (`criteria-cobertura.ts`); as linhas com privacidade dos últimos 3 dias, reduzidas à mais recente por vídeo (`gravar.ts`); e `competitor_hourly_health(site, …)` em três instantes (uma hora antes do cron, uma hora depois, e 30 horas depois da última captura): mesmos `proprios_*`.
18. `youtube_channel_removal_impact continua maior que zero e a remoção continua recusada`.
19. `privilégios por catálogo` da função nova; `as duas funções auxiliares não existem depois do arquivo inteiro` (este roda o arquivo inteiro, com a tabela vazia).
20. `a consulta AD do plano dá os mesmos números que yt_own_meta_diet_contas` (os dez campos em comum, antes e depois da dieta), e `o arquivo cp14.sql traz a expressão "limpa" do ensaio, letra por letra` (compara o trecho entre as marcas).
**Pronto quando:** tudo verde, duas vezes; nada ficou no banco; o relatório traz os vermelhos iniciais e, para o teste 17, a tabela dos seis leitores com o valor antes e depois.

### Tarefa 7: os roteiros da MG17 e o teste (emenda 1: são quatro roteiros; eram dois)

**Arquivos.** `docs/ops/sql/dieta-meta-desligar-compactacao.sql` = o corpo de `yt_own_meta_cover` da MG17a (Apêndice A, entre as marcas), com um cabeçalho que diz quando usar e **uma diferença (emenda 1: S-I-3):** o literal `'indisponivel'` da resposta vira `'desligada'`. `docs/ops/sql/dieta-meta-volta-b-recriar-da-cobertura.sql` = Apêndice D. **(emenda 1: S-I-3)** `docs/ops/sql/dieta-meta-religar-compactacao.sql` = o trecho entre as marcas `-- >>> MG17 yt_own_meta_cover (início)` e `(fim)` do Apêndice C, fechado com ponto e vírgula e seguido das duas linhas de `revoke` e `grant` da migration; o cabeçalho diz "(você roda)" e a condição: a causa do desligamento achada, e a CP13 com `descobertas` 0 e `sem_explicacao` 0. **(emenda 1: D-m-2)** `docs/ops/sql/dieta-meta-retirar-dia-da-cobertura.sql` = o texto abaixo, a saída do alarme `sem_explicacao` quando a linha não pode voltar. **Não rodado pelo autor.**
```sql
-- Retira UM dia da cobertura de UM vídeo e UM conjunto (parte o intervalo em dois). O dia deixa de ser
-- "conferido, sem mudança" e passa a ser AUSÊNCIA: uma derivação refeita não avança last_day_pt por ele.
-- As versões já derivadas não mudam. Só usar quando a linha do dia não pode voltar pelo CSV.
-- (você roda) Trocar <UUID_DO_SITE>, <VIDEO>, <CONJUNTO> (meta_texto ou meta_thumb) e <DIA> (AAAA-MM-DD) nas três
-- instruções. Colar tudo de uma vez: é uma transação.
begin;
-- 1. O que vinha depois do dia vira um intervalo novo.
insert into public.yt_own_video_coverage
  (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
select c.youtube_video_id, c.metric_set, date '<DIA>' + 1, c.covered_to, c.site_id, c.video_id, c.channel_id, c.source, c.collected_at
  from public.yt_own_video_coverage c
 where c.site_id = '<UUID_DO_SITE>'::uuid and c.youtube_video_id = '<VIDEO>' and c.metric_set = '<CONJUNTO>'
   and c.covered_from <= date '<DIA>' and c.covered_to > date '<DIA>';
-- 2. Se o dia é o primeiro do intervalo, o intervalo antigo sai.
delete from public.yt_own_video_coverage c
 where c.site_id = '<UUID_DO_SITE>'::uuid and c.youtube_video_id = '<VIDEO>' and c.metric_set = '<CONJUNTO>'
   and c.covered_from = date '<DIA>';
-- 3. Senão, ele termina na véspera.
update public.yt_own_video_coverage c
   set covered_to = date '<DIA>' - 1
 where c.site_id = '<UUID_DO_SITE>'::uuid and c.youtube_video_id = '<VIDEO>' and c.metric_set = '<CONJUNTO>'
   and c.covered_from < date '<DIA>' and c.covered_to >= date '<DIA>';
commit;
```
**Dois commits (emenda 1: S-m-8):** um só com os quatro roteiros, outro com o teste.
**Testes primeiro** (`test/integration/a5-e18p2-volta.test.ts`):
1. `o roteiro de desligar é o corpo da MG17a, letra por letra, salvo o literal 'indisponivel' trocado por 'desligada'` (emenda 1: S-I-3; compara com o trecho entre as marcas do ensaio ou do arquivo depois de trocar esse literal, e afirma que ele aparece uma vez só; pega a emenda feita num e esquecida no outro).
2. `depois de desligar, p_compactar verdadeiro devolve desligada e nada sai` (emenda 1: S-I-3).
3. `volta B devolve uma linha por dia apagado, idêntica à original em todas as colunas menos captured_at` (compara com uma cópia tirada antes da dieta).
4. `volta B roda duas vezes sem erro e não passa por cima de linha que existe`.
5. `volta B não recria dia sem cobertura (o buraco continua buraco) nem dia entre vizinhas diferentes`.
6. `volta B com o roteiro de desligar não aplicado: a execução seguinte da função reapaga` (prova por que a ordem da seção 2 existe).
7. **mutação de site:** o roteiro com o uuid de outro site não insere nada neste.
8. `depois da volta B, a derivação refeita dá as mesmas versões` (chama o caso 1 da Tarefa 8 sobre o resultado; se a Tarefa 8 ainda não existir, o caso fica marcado como pendente no relatório, **não** pulado em silêncio).
9. (emenda 1: S-I-3) `o roteiro de religar é o corpo novo da MG17, letra por letra` (o trecho entre as marcas do ensaio ou do arquivo).
10. (emenda 1: S-I-3) `desligar, três dias de linhas novas, religar: p_compactar verdadeiro enxuga o acumulado de uma vez, sem_explicacao continua 0, e os privilégios por catálogo são os da migration`.
11. (emenda 1: S-I-3) `religar num banco sem a função do critério (só a MG17a): a chamada seguinte falha com erro, não devolve ok` (o cron ficaria vermelho, não verde).
12. (emenda 1: D-m-2) `retirar um dia da cobertura, nas quatro posições (primeiro dia do intervalo, último, meio, intervalo de um dia só): a soma dos dias cobertos cai exatamente 1, nenhum intervalo se sobrepõe a outro, e o sem_explicacao do canal cai 1`; `dia fora de qualquer intervalo: nada muda` (**dado ausente**); **mutação de site:** com o uuid de outro site nada muda neste.
**Pronto quando:** verdes; os quatro arquivos existem; cada um traz no topo "(você roda)" e, nos que têm, o que trocar.

### Tarefa 8: teste de ponta do item 202 e o ensaio com o CSV real

**Objetivo.** O passo de versões de verdade, contra o banco local, sobre a tabela inteira e sobre a tabela depois da dieta.
**Arquivo.** `test/integration/a5-e18p2-derivacao-igual.test.ts`, com a infraestrutura da Tarefa 10 do plano E18 (site e canal próprios do teste; o passo chamado com relógio falso até `derived_through` chegar ao fim).
**Casos:**
1. `semente: derivação inteira = derivação depois da dieta, linha a linha`: semeia (a semente da Tarefa 6, com 40 dias), deriva tudo, guarda as versões (todas as colunas menos `id` e `created_at`, ordenadas); cobre e enxuga pela função; apaga as versões e o estado **do canal do teste**; deriva de novo; compara. Igualdade total.
2. `no meio da derivação refeita, dia coberto sem linha avança last_day_pt` (para a derivação num dia do meio e lê a versão corrente).
3. `dia sem linha e sem cobertura não avança` (o buraco do vídeo 6).
4. `depois da dieta, o caminho de todo dia não encontra dia coberto sem linha` (um dia novo gravado, coberto, enxugado e derivado: `cobertos_sem_linha` 0).
5. **R2, o ensaio com o CSV real** (`describe.skipIf(!process.env.E18P2_ENSAIO)`): o controlador carrega o CSV do dono numa tabela de ensaio do `bythiago_int` com `carregar-csv-de-ensaio.sql` (`create table public.e18p2_ensaio_csv (like public.yt_own_video_meta_daily)`, com RLS ligada, sem policy e com `revoke all` de `public`, `anon`, `authenticated` e `service_role`; depois `\copy … from`), o teste copia as linhas para o site e o canal do teste (trocando `site_id`, `channel_id` e anulando `video_id`), roda o caso 1 sobre elas e, no fim, o controlador solta a tabela de ensaio. Esperado: igualdade total, e o número de versões por origem anotado no ledger. **O teste não imprime título, descrição nem URL**: só contagens e md5. (emenda 1: S-m-7) A cópia das linhas reais para o site do teste roda **dentro de `begin; … rollback;`**, como os outros casos. E a tabela `e18p2_ensaio_csv` é solta **também quando o teste falha**: o roteiro do controlador é carregar, rodar o teste e `drop table if exists public.e18p2_ensaio_csv`, nessa ordem, com o `drop` fora de qualquer condição, e o relatório traz no fim a saída de `select to_regclass('public.e18p2_ensaio_csv')` (nulo). Ela guarda título e descrição de vídeo privado.
**Pronto quando:** os casos 1 a 4 verdes; o caso 5 documentado no relatório com o comando do controlador, e rodado no dia da Tarefa 15.

### Tarefa 9: SQL de ensaio da MG16 e o teste

**Como o teste monta o backup.** Dentro da transação: cria `yt_own_video_daily_zeros_bkp` como o Apêndice A do plano P3 (`like`, índice único, RLS, `revoke`), semeia diário, cobertura `base` e backup, e grava o comentário no formato `MG15 <instante> [<json>]`. Um caso a mais usa o SQL real da MG15 para produzir o backup e o comentário, e prova que a MG16 lê o que a MG15 escreve de verdade. (emenda 1: S-m-7) Ele segue o molde dos outros: lê o ensaio (`.superpowers/sdd/a5-e6-p3/sql/mg15.sql`, fora do git) e, se ele não existir, o arquivo de migration da MG15 em `supabase/migrations/` (que no dia da Tarefa 14 já existe, e é o que a CI enxerga); se nenhum dos dois existir, o caso **falha** com a mensagem "falta o SQL da MG15", não é pulado.
**Testes primeiro** (a função com `p_agora` fixo):
1. `tabela ausente: estado sem_tabela, nada muda` (**dado ausente**).
2. `backup vazio e sem comentário: solto_vazio` (CI, banco novo).
3. `caminho feliz: solta, devolve linhas e bytes, e a tabela não existe mais`.
4. Recusas, uma por teste, cada uma afirmando a mensagem e que a tabela continua com as mesmas linhas: `13 dias e 23 horas` (e `14 dias exatos` passa: **fronteira**); `sem a marca`; `marca de ontem`; `comentário nulo com linhas`; `comentário de outro formato`; `instante ilegível`; `linhas diferentes de apagadas`; `função que cita o backup`; `visão que cita o backup`; `dia do backup fora da cobertura base e sem linha no diário`; `diário com mais linhas vazias do que a MG15 deixou`; `cobertura base gravada há 37 horas`; `cobertura base parada (covered_to de 6 dias atrás)`.
5. `dia do backup fora da cobertura mas que voltou a ter linha no diário: não recusa`.
6. `site do backup já apagado: linhas órfãs contadas e soltas`.
7. **mutação de site:** dois sites no backup, o segundo com dia fora da cobertura: recusa; tirar o filtro de site da conferência de cobertura faz o teste falhar (a cobertura do site A "cobriria" o vídeo do site B).
8. `o arquivo inteiro, duas vezes: na segunda a tabela não existe e nada falha; a função auxiliar não sobra`.
9. **As voltas depois do `drop`:** `volta B do plano P3 (docs/ops/sql/dieta-diario-volta-b-recriar-da-cobertura.sql) devolve um zero para cada dia que estava no backup` (compara a lista de dias guardada antes do `drop`); `volta C: uma tabela temporária carregada com as linhas do backup guardadas antes do drop devolve as linhas originais`; `depois das duas, a A1 do plano P3 bate com a de antes da P3`.
10. `serie_coletada não muda com o drop` (o backup nunca contou).
**Pronto quando:** verdes, duas vezes; nada ficou no banco.

### Tarefa 10: ensaio das três migrations inteiras por `psql`

**Objetivo.** O que o vitest não cobre: o arquivo inteiro com `now()`, a idempotência, as recusas de entrada, o tempo.
**Como.** Um roteiro por pasta, rodado **duas vezes**, saída em `prova-saida.txt`. Cada caso é a sua transação `begin; … rollback;`, com `\set ON_ERROR_STOP off`, `\set VERBOSITY terse`, `set local lock_timeout = '5s'`, e a saída conferida pelo **texto** da mensagem, não por "deu erro" (regras da Tarefa 3 do plano P3). Dentro de cada transação, antes de semear: `delete from public.yt_own_collection_runs where ran_at > now() - interval '20 days'`.
- **MG17a:** (a) tabela vazia; (b) semente em volume do dia (CP2: vídeos × dias), com `\timing`; (c) de novo na mesma transação; (d) sem a cobertura (`drop table … cascade` na transação): recusa "depende da MG14".
- **MG17:** (a) tabela vazia: sem erro, aviso `sem linhas, nada a apagar`, a função nova instalada, as auxiliares não existem; (b) semente em volume do dia, 14 execuções com `ran_at` relativo a `now()`, marca de hoje: apaga, comentário escrito; **se a hora estiver entre 11:30 e 13:00 UTC o esperado é a recusa**, e o roteiro imprime qual ramo rodou; (c) de novo: `nada_a_apagar` com `motivo: ja_ligada`, comentário intacto; (d) sem a MG17a (`drop function`): recusa; (e) com uma coluna a mais: recusa "mudou de forma"; (f) **o ramo que importa: a (b) sem a marca**: recusa, e `select prosrc like '%yt_own_meta_linhas_do_meio%' from pg_proc where proname = 'yt_own_meta_cover'` devolve **falso** (o corpo antigo ficou); (g) volta B e volta C sobre o resultado da (b), com `\timing`; (h) (emenda 1: D-I-1) semente **com linhas e sem nenhuma linha "do meio"** (dois dias por vídeo), sem a marca: recusa, e a mesma leitura da (f) devolve **falso** (o corpo antigo ficou).
- **MG16:** (a) sem a tabela; (b) backup vazio; (c) backup em volume (94 mil linhas, a semente do `prova-volume.sql` do plano P3) com comentário de 15 dias atrás e marca de hoje, com `\timing`; (d) de novo; (e) comentário de 13 dias atrás: recusa.
**Anotar no ledger:** segundos de cada migration e de cada volta, e `show lock_timeout; show statement_timeout;` depois de cada arquivo (os `set` do topo são de sessão: se vazarem, trocar por `set local`, por emenda).
**Pronto quando:** as duas rodadas dão a mesma saída; nada ficou; os tempos estão no ledger. **Acima de 10 s: parar e avisar.**

### Tarefa 11: conferências com data

**Contrato** (`src/lib/conferencias.ts`, no molde de `conferenciasE8Coleta`, linhas 68 a 88): `export const E18P2_COBERTURA_DEPLOY: string | null = null`, `export const E6_P4_APLICADA: string | null = null`, `export const E18P2_APLICADA: string | null = null`; `conferenciasE18P2Cobertura(deploy)` (ids `e18p2-cob-d0`, `-d1`, `-d7`, `-d14`; `etapa: 'E18'`), `conferenciasE6P4(aplicada)` (ids `e6-p4-d0`, `-d1`, `-d7`; `etapa: 'E6'`), `conferenciasE18P2(aplicada)` (ids `e18p2-d0`, `-d1`, `-d7`, `-d30`; `etapa: 'E18'`); `responsavel: 'agente'`; `onde` aponta para este plano (seções 7 e 11) e para o ledger; `CONFERENCIAS` espalha as três.
**Testes primeiro** (`test/lib/conferencias.test.ts`), para cada uma das três: `constante nula = nenhuma entrada, nada vence` (**dado ausente**); `malformada = uma entrada de erro de 1970 que cita a constante` (com `2026-13-01`, `13/10/2026` e texto vazio); `preenchida = as datas certas, em ordem`; `a constante publicada é nula ou uma data real, e, se tiver data, a lista publicada tem a primeira entrada` (pega o espalhamento esquecido).
**Mesma lista em** `.superpowers/sdd/a5/conferencias-com-data.md`.
**Pronto quando:** verde; `tsc` limpo.

### Tarefa 12: runbook

**Arquivo.** `docs/ops/youtube-coleta-canais-proprios-runbook.md`: (a) seção nova "Dieta dos metadados diários (cobertura e enxugamento)": o que a cobertura quer dizer, as notas vermelhas da seção 6 e o que fazer em cada uma, o que querem dizer `indisponivel`, `sem_estado`, `feita` e `desligada`, o ritual da MG17 (**apontando** para a seção 2 e o Apêndice D do plano P3 e listando só o que muda: tabela, pasta, marca), as conferências AD e VD1 a VD8, como desfazer (as ordens da seção 2 deste plano, com os caminhos dos quatro roteiros e os comandos da volta C; (emenda 1: S-I-3) com o passo final "religar" e a frase "desligado pelo roteiro, o cron fica vermelho todo dia até religar"), (emenda 1: D-m-2) **o fim do alarme `sem_explicacao`**, com as duas saídas e o que se perde em cada uma: restaurar a linha pelo CSV (volta C; nada se perde, e só serve para dia que o CSV tem), ou retirar o dia da cobertura com `dieta-meta-retirar-dia-da-cobertura.sql` (o dia vira ausência: uma derivação refeita não avança `last_day_pt` por ele; as versões já derivadas não mudam); e o aviso de que a volta B **não** resolve esse alarme (ela exige vizinhas idênticas), (emenda 1: S-m-12) o que fazer **depois de uma recusa** do `db push` (a leitura das funções auxiliares e a linha de `drop function`, Apêndice E), e o aviso "depois da dieta, desligar o passo de versões faz a tabela voltar a crescer, e é isso que guarda as linhas para ele"; (b) seção nova "Soltar o backup do diário (P4)": o portão P, o ritual, AP e VP1 a VP4, e o que resta de volta; (c) na seção 11 (apagar a série de um canal), a linha dos conjuntos `meta_texto` e `meta_thumb` da cobertura e a retirada da linha do backup, **se a Tarefa 5 do plano P3 a tiver posto** (`grep -n zeros_bkp` no arquivo decide).
**Sem teste automático.** **Pronto quando:** todo comando de escrita traz "(você roda)" e vai um por linha; os caminhos citados existem.

### Tarefa 13: o arquivo da MG17a e o envio do código (portão A)

**(reconciliação 13/10, emenda 1: S-I3, D-I2) No mesmo commit do arquivo da MG17a:** (a) o par `(yt_own_meta_cover_set, yt_own_video_coverage)` entra em `observatorio-a5-e10-lista-fechada.test.ts` (E10, Tarefa 10), porque a função tem `delete from public.yt_own_video_coverage` (Apêndice A) e o teste lê do catálogo toda função `yt_*` com `delete from`; (b) as três funções novas são classificadas nas listas dos testes `-doze` e `-reporter-banco` do passo 0 da E17. Se algum desses testes ainda não existir, a obrigação vai para `.superpowers/sdd/a5/fila-do-db-push.md`, seção "pares e classificações pendentes". Antes do `db:new`, os três testes passam no `bythiago_int` com o ensaio aplicado.

**Passos.** (1) Portão A verde. (2) `npm run db:new observatorio_a5_e18p2_cobertura_de_metadados`; carimbo posterior ao da MG14; colar o Apêndice A; `diff` contra o ensaio: vazio; rodar a Tarefa 1 lendo o arquivo. (3) Commit local por caminho. (4) O dono aplica (sozinha, ou no `db push` do lote C). (5) VA1 a VA4, no ledger. (6) (emenda 1: S-I-1; o passo antigo, que conferia depois do fato se o commit da Tarefa 3 já tinha ido a `staging`, saiu) **Só agora** a Tarefa 3 é escrita, testada e commitada, com a CP21 respondida. (7) Data em `E18P2_COBERTURA_DEPLOY`. (8) Push em `staging` por lista explícita de commits (o arquivo da MG17a, o teste da Tarefa 1, as Tarefas 2, 3, 4, 5 e 11), no mesmo dia do commit da Tarefa 3; CI verde; promoção a `main` fora de 11:55 a 12:15 UTC (reconciliação 13/10, emenda 2: S2-m4: esta é a janela da **promoção de código**, em volta do cron das 12:00 UTC; a do `db:push:prod` é outra, a janela comum da reconciliação: fora de 11:30 a 13:00 UTC e dos minutos 0, 20 e 40).
**Tem de estar em `main` antes:** MG14 aplicada; o lote do plano E18 com as Tarefas 5, 6 e 7 dele (linha A6 do portão: emenda 1, S-m-8).
**Volta.** Reverter os commits das Tarefas 3 e 5. A migration fica.
**Pronto quando:** CI verde, deploy pronto, `e18p2-cob-d0` com `feitaEm`.

### Tarefa 14: o dia da MG16 (portão P)

**(reconciliação 13/10, emenda 1: D-I2) No commit do arquivo da MG16, antes de armar:** a tabela `yt_own_video_daily_zeros_bkp` deixa de existir depois desta migration; as listas dos testes `-doze` e `-reporter-banco` do passo 0 da E17 têm de aceitá-la ausente (é o que a P9 confere) e a conferência a mais do portão P tem de estar verde. O par de arquivo `(arquivo da MG16, yt_own_video_daily_zeros_bkp)` não tem lugar em nenhum dos dois testes da E10: fica declarado em `.superpowers/sdd/a5/fila-do-db-push.md`.

**Ordem que não pode inverter:** portão P → linha em `.superpowers/sdd/a5/fila-do-db-push.md` (reconciliação 13/10, emenda 4: p8, n5: arquivo ausente ou ilegível: parar e perguntar ao controlador, nunca recriar do zero) → `db:new observatorio_a5_e6_p4_soltar_backup_do_diario`, cola o Apêndice B, `diff`, Tarefa 9 lendo o arquivo → commit local → o dono confere o CSV, tira o CSV do backup e põe a marca → AP → `db:push:prod` → VP1 a VP4 → o dono retira a marca → par do item 231, se o teste existir (`(arquivo da MG16, yt_own_video_daily_zeros_bkp)`, linha 7 da tabela de 9.2) → data em `E6_P4_APLICADA`, commit, push, CI, promoção.
**Bancos locais, só depois de produção verde:** no `bythiago_int` e no banco do navegador a migration não recusa (backup ausente, ou vazio e sem comentário); se algum deles tiver backup com linhas e sem o comentário da MG15, o controlador solta a tabela à mão antes, avisando os outros terminais.
**Recusa que não é reaplicada no dia:** o arquivo sai por um commit que o remove; o ritual recomeça no outro dia. (emenda 1: S-m-12) **Depois de qualquer recusa**, o controlador roda a leitura "Depois de uma recusa" do Apêndice E: se `yt_own_daily_bkp_soltar` ficou no banco (o cliente não aplicou o arquivo numa transação só), o dono roda a linha de `drop function` antes da nova tentativa.
**Pronto quando:** CI verde; `e6-p4-d0` com `feitaEm`; o ledger traz a AP **com o comentário inteiro do backup** (ele não existe mais em lugar nenhum), VP1 a VP4, o `sha256` dos dois CSVs e a saída do `db push`.

### Tarefa 15: o dia da MG17 (portão D)

**Passos, nesta ordem.**
1. Portão D verde, rodado no dia (a execução das 12:00 UTC do dia entra na conta). **(reconciliação 13/10, emenda 1: D-I2) O par `(yt_own_meta_cover, yt_own_video_meta_daily)` em `observatorio-a5-e10-lista-fechada.test.ts` e a classificação da função nos dois testes do passo 0 da E17 entram no commit do arquivo (passo 3), não no passo 9: no passo 9 a fila do `db push` já está travada e um push vermelho ali é conserto com a fila parada. O passo 9 passa a ser só a conferência de que entraram.**
2. Fixture: uma das 14 linhas da CP14 (só `falhas`, `resumo.metadados` e `resumo.versoes`, nomes de canal trocados por `canal`) em `test/youtube/coleta/fixtures/e18p2-execucao-real.json`; acrescentar à Tarefa 6 o caso `14 cópias da execução real de produção são reconhecidas como limpas`, **escrito antes de qualquer mudança no SQL**. Se falhar, a regra está errada para o formato real: corrigir o Apêndice C, o ensaio, e rodar as Tarefas 6 e 10 de novo.
3. Linha "MG17 pendente: db push bloqueado, e não rodar `migration up` no banco local 54321" em `.superpowers/sdd/a5/fila-do-db-push.md` (reconciliação 13/10, emenda 1: D-m8). (reconciliação 13/10, emenda 4: p8, n5) **Se o arquivo não existir ou estiver ilegível, não recriá-lo do zero: parar e perguntar ao controlador** (a ausência pode esconder linha de outro plano; ausente não é fila vazia); `npm run db:new observatorio_a5_e18p2_dieta_de_metadados`; colar o Apêndice C; `diff` contra o ensaio: vazio; Tarefas 6 e 7 lendo o arquivo.
4. O dono: CSV, `shasum`, contagem, marca (Apêndice E; `wc -l` não serve aqui, a descrição tem quebras de linha).
5. O controlador: AD; R1; R2 (Tarefa 8, caso 5).
6. O dono: `db:push:prod`.
7. VD1 a VD8. Qualquer diferença: seção 2, "Como desfazer", no mesmo dia. (emenda 1: S-m-12) Se o `db push` recusou: a leitura "Depois de uma recusa" do Apêndice E e, se alguma auxiliar ficou, a linha de `drop function`, antes de tentar de novo.
8. O dono: `vacuum full` se for o caso; retira a marca (o comentário já é o resultado: guardar no ledger antes de limpar).
9. Par do item 231, se o teste existir: `(arquivo da MG17, yt_own_video_meta_daily)` e, na linha nova de 9.2, `(yt_own_meta_cover, yt_own_video_meta_daily)`.
10. Data em `E18P2_APLICADA`; commit; push por lista explícita (o arquivo, os testes das Tarefas 6, 7 e 8, a fixture; e o commit dos roteiros com o do runbook, se ainda não foram no push da Tarefa 14: emenda 1, S-m-8); CI verde; promoção fora de 11:55 a 12:15 UTC.
**Bancos locais, só depois de produção verde (emenda 1: D-I-1):** tabela diária **vazia** aplica sem recusa. Banco **com qualquer linha** e sem a marca recusa sempre, tenha ou não linha "do meio": o controlador limpa a tabela diária desse banco antes, avisando os outros terminais.
**Retratos.** A saída da AD e da VD3 em `.superpowers/sdd/a5/retratos/e18p2-antes.json` e `e18p2-depois.json`, com o instante, o uuid do site e o tamanho. **Regra: igualdade total** dos dois md5 (não há cron entre os dois).
**Pronto quando:** CI verde, deploy pronto, `e18p2-d0` com `feitaEm`, e o ledger traz AD, VD1 a VD8, os dois md5, o `sha256` do CSV, a saída do `db push` e o tamanho antes e depois (item 202).

---

## 11. Consultas de conferência

**Nenhuma foi rodada pelo autor** (aviso de 0.3). A Tarefa 10 roda todas no `bythiago_int` sobre semente e anota o resultado. Em toda consulta o total avaliado vem junto: `0 de 0` se lê "nada foi avaliado".

**AA (antes da MG17a) e VA4 (depois): a tabela diária não muda.**
```sql
select count(*) as linhas, md5(coalesce(string_agg(md5(to_jsonb(m)::text), ',' order by m.youtube_video_id, m.day_pt), '')) as retrato from public.yt_own_video_meta_daily m;
```
Só vale se o cron não rodou entre as duas.

**VA1: a MG17a entrou inteira.** Esperado `t, 3, 3, 0`.
```sql
select (select pg_get_constraintdef(k.oid) like '%data_api%' and pg_get_constraintdef(k.oid) like '%imagem%' from pg_constraint k where k.conrelid = 'public.yt_own_video_coverage'::regclass and k.contype = 'c' and pg_get_constraintdef(k.oid) like '%analytics_api%') as check_novo, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('yt_own_meta_cover_set', 'yt_own_meta_prova', 'yt_own_meta_cover')) as funcoes_de_3, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('yt_own_meta_cover_set', 'yt_own_meta_prova', 'yt_own_meta_cover') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute')) as so_service_role_de_3, (select count(*) from pg_policies where schemaname = 'public' and tablename = 'yt_own_video_coverage' and cmd <> 'SELECT') as policies_de_escrita_de_0;
```
**VA2.** A CP13.

**K1 (VA3, D4 e VD5): dias cobertos contra linhas com captura, por vídeo e conjunto.**
```sql
with linhas as (select youtube_video_id, 'meta_texto'::text as s, count(*) as n from public.yt_own_video_meta_daily where site_id = :site and privacy_status is not null group by 1 union all select youtube_video_id, 'meta_thumb', count(*) from public.yt_own_video_meta_daily where site_id = :site and thumbnail_dhash is not null group by 1), cob as (select youtube_video_id, metric_set as s, sum(covered_to - covered_from + 1) as n from public.yt_own_video_coverage where site_id = :site and metric_set in ('meta_texto', 'meta_thumb') group by 1, 2) select count(*) as pares_avaliados, count(*) filter (where coalesce(l.n, 0) <> coalesce(c.n, 0)) as diferentes, coalesce(sum(coalesce(c.n, 0) - coalesce(l.n, 0)), 0) as cobertos_a_mais from linhas l full join cob c using (youtube_video_id, s);
```
Antes da MG17: `diferentes` 0 e `cobertos_a_mais` 0, com `pares_avaliados` perto de 2 × vídeos. Depois da MG17: `cobertos_a_mais` igual à soma, nos dois conjuntos, das linhas apagadas (`apagadas` mais `apagadas com dHash` da VD3), e nunca negativo.

**AP (antes da MG16).** A CP11 (guardar a linha inteira, com o comentário), a A1 do plano P3 e `select pg_database_size(current_database());`.

**VP1.** Esperado `f, 0`.
```sql
select to_regclass('public.yt_own_video_daily_zeros_bkp') is not null as backup_existe, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'yt_own_daily_bkp_soltar') as funcao_de_0;
```
**VP2.** `select obj_description('public.yt_own_video_daily'::regclass, 'pg_class');` **VP3.** A A1 do plano P3. **VP4.** `select pg_database_size(current_database());`

**AD (antes da MG17) e VD3 (depois): as contas e os retratos.** A mesma consulta nas duas vezes, com o mesmo `:site`. Guardar a linha inteira. (A Tarefa 6, teste 20, prova que ela dá os mesmos números que a função `yt_own_meta_diet_contas` da migration.)
```sql
with linhas as (select m.youtube_video_id, m.day_pt, m.privacy_status, m.thumbnail_dhash, m.captured_at, (to_jsonb(m) - 'day_pt' - 'captured_at') as t from public.yt_own_video_meta_daily m where m.site_id = :site), marcadas as (select l.*, case when l.t is distinct from lag(l.t) over (partition by l.youtube_video_id order by l.day_pt) then 1 else 0 end as nova from linhas l), numeradas as (select x.*, sum(x.nova) over (partition by x.youtube_video_id order by x.day_pt) as seq from marcadas x), sequencias as (select s.youtube_video_id, s.seq, min(s.day_pt) as de, max(s.day_pt) as ate, md5(min(s.t::text)) as conteudo, (array_agg(s.captured_at order by s.day_pt))[1] as cap_de, (array_agg(s.captured_at order by s.day_pt desc))[1] as cap_ate from numeradas s group by s.youtube_video_id, s.seq), situacao as (select distinct on (l.youtube_video_id) l.youtube_video_id, l.day_pt, l.privacy_status from linhas l where l.privacy_status is not null order by l.youtube_video_id, l.day_pt desc) select (select count(*) from linhas) as t, (select count(distinct l.youtube_video_id) from linhas l) as videos, (select count(*) from linhas l where l.privacy_status is not null) as com_texto, (select count(*) from linhas l where l.thumbnail_dhash is not null) as com_thumb, (select count(*) from linhas l where l.privacy_status is null) as sem_privacidade, (select coalesce(sum(c.covered_to - c.covered_from + 1), 0) from public.yt_own_video_coverage c where c.site_id = :site and c.metric_set = 'meta_texto') as c_texto, (select coalesce(sum(c.covered_to - c.covered_from + 1), 0) from public.yt_own_video_coverage c where c.site_id = :site and c.metric_set = 'meta_thumb') as c_thumb, (select count(*) from sequencias) as sequencias, (select md5(coalesce(string_agg(q.youtube_video_id || '|' || to_char(q.de, 'YYYY-MM-DD') || '|' || to_char(q.ate, 'YYYY-MM-DD') || '|' || q.conteudo || '|' || to_char(q.cap_de at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' || to_char(q.cap_ate at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US'), ',' order by q.youtube_video_id, q.de), '')) from sequencias q) as retrato_sequencias, (select md5(coalesce(string_agg(s.youtube_video_id || '|' || to_char(s.day_pt, 'YYYY-MM-DD') || '|' || s.privacy_status, ',' order by s.youtube_video_id), '')) from situacao s) as retrato_situacao, pg_total_relation_size('public.yt_own_video_meta_daily') as bytes, now() as instante;
```
Esperado na VD3, contra a AD: `t` menor em `apagadas` (o número do comentário, VD2); `videos`, `sem_privacidade`, `c_texto`, `c_thumb`, `sequencias` e os dois retratos **iguais**; `com_texto` menor em `apagadas`; `com_thumb` menor nas apagadas com dHash. `t` 0 = site errado (nada foi avaliado). O número de linhas "do meio" de antes vem da CP3 (a função do critério só existe depois da MG17).

**VD1.** Esperado `t, 4, 4, 0, t` (quatro funções permanentes: as três da MG17a e a do critério).
```sql
select (select prosrc like '%yt_own_meta_linhas_do_meio%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'yt_own_meta_cover') as corpo_novo, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('yt_own_meta_cover_set', 'yt_own_meta_prova', 'yt_own_meta_cover', 'yt_own_meta_linhas_do_meio')) as funcoes_de_4, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('yt_own_meta_cover_set', 'yt_own_meta_prova', 'yt_own_meta_cover', 'yt_own_meta_linhas_do_meio') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute')) as so_service_role_de_4, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('yt_own_meta_diet', 'yt_own_meta_diet_contas')) as auxiliares_de_0, (select count(*) = 1 from pg_policies where schemaname = 'public' and tablename = 'yt_own_video_meta_daily') as policy_intacta;
```
**VD2.** `select obj_description('public.yt_own_video_meta_daily'::regclass, 'pg_class');`

**VD6: as versões.** Antes e depois, o mesmo md5; e `sem_linha` 0.
```sql
select count(*) as versoes, md5(coalesce(string_agg(md5(to_jsonb(v)::text), ',' order by v.id), '')) as retrato, count(*) filter (where not v.pre_registro and (not exists (select 1 from public.yt_own_video_meta_daily m where m.youtube_video_id = v.youtube_video_id and m.day_pt = v.first_day_pt) or (not v.is_current and not exists (select 1 from public.yt_own_video_meta_daily m where m.youtube_video_id = v.youtube_video_id and m.day_pt = v.last_day_pt)))) as sem_linha from public.yt_own_video_versions v where v.site_id = :site;
```

**K3 (CP14): os 14 dias.** (emenda 1: D-I-3, S-I-2: a conta é por dia, e cada dia traz o detalhe das suas execuções.)
```sql
with execucoes as (select (r.ran_at at time zone 'utc')::date as dia, r.ran_at, r.falhas, j.k as cobertura, j.v as versoes, <as três colunas `base`, `confirmou` e `sem_dia_novo` do bloco (4) do Apêndice C, entre as marcas, letra por letra> from public.yt_own_collection_runs r cross join lateral (select r.resumo->'metadados' as m, r.resumo->'metadados'->'cobertura' as k, r.resumo->'versoes' as v) j where r.ran_at > now() - interval '20 days'), por_dia as (select e.dia, max(e.ran_at) as ultima, count(*) as execucoes, (bool_or(e.base and e.confirmou) and bool_and(e.base and (e.confirmou or e.sem_dia_novo))) as limpa from execucoes e group by e.dia) select p.dia, p.ultima, p.execucoes, p.limpa, (select jsonb_agg(jsonb_build_object('ran_at', e.ran_at, 'base', e.base, 'confirmou', e.confirmou, 'sem_dia_novo', e.sem_dia_novo, 'cobertura', e.cobertura, 'versoes', e.versoes, 'falhas', e.falhas) order by e.ran_at) from execucoes e where e.dia = p.dia) as detalhe from por_dia p order by p.dia desc limit 14;
```
A Tarefa 6 gera esta consulta **por extenso**, num arquivo (`.superpowers/sdd/a5-e18p2/sql/cp14.sql`), copiando do ensaio o trecho entre as marcas `-- >>> MG17 limpa (início)` e `(fim)` e trocando `p_agora` por `now()`: o controlador roda o arquivo, não monta a consulta à mão.

**K4 (D+7 e D+30): tamanho e ritmo.**
```sql
select count(*) as linhas, count(distinct youtube_video_id) as videos, round(count(*)::numeric / nullif(count(distinct youtube_video_id), 0), 1) as linhas_por_video, max(day_pt) as ate, pg_total_relation_size('public.yt_own_video_meta_daily') as bytes from public.yt_own_video_meta_daily;
```
Esperado: `linhas_por_video` perto de 4 (5 nos 35 vídeos de hoje, que têm a linha de 07/10 sem privacidade: emenda 1, D-m-7), mais 2 por troca e mais os dias de teste A/B; crescendo 1 por dia por vídeo = a dieta parou (variável, função trocada, ou passo de versões parado).

**K5 (VD7 e D+7): a prova da leitura horária.**
```sql
select public.competitor_hourly_health(:site, now(), 14, 25);
```
(emenda 1: D-m-1) A função tem quatro argumentos e é `strict` (`supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql:182`). Os dois últimos são `RULES.hourly.ageDays` e `RULES.hourly.videosMax`, que o código passa em `horaria/prova.ts:112` e que valiam 14 e 25 em 13/10 (`observatorio/rules.ts:46`): conferir os dois no código do dia antes de rodar; a Tarefa 6 anota a chamada exata no relatório. Resposta nula = algum argumento nulo = **não li**, nunca "sem diferença". Esperado: os campos `proprios_*` iguais aos de antes da MG17, tirados no mesmo intervalo entre duas leituras horárias.

**K6 (D+30): dias de teste A/B.** `select ab_test_id, count(*) as dias, count(distinct seconds_on_air_analytics) as valores from public.yt_own_video_meta_daily where ab_test_id is not null group by 1;` Esperado: um dia por dia de teste (nenhum saiu). (emenda 1: D-I-2) Vale pela regra 8: linha com `ab_test_id` nunca sai, mesmo com segundos iguais em dias seguidos.

**R1 (banco local, controlador, antes do passo d5).** Num `psql` contra o `bythiago_int`, dentro de `begin; … rollback;`: `create temp table csv_real (like public.yt_own_video_meta_daily);`, `\copy csv_real from '<caminho do CSV>' csv header`, `select count(*), count(distinct youtube_video_id), min(day_pt), max(day_pt), count(*) filter (where privacy_status is not null) from csv_real;`. Esperado: `t`, `videos`, as datas e `com_texto` da AD. Diferença = o CSV não é o do dia: **não seguir**.

---

## 12. Onde está cada item de aceite

| Item | Onde |
|---|---|
| 202, "a derivação sobre a tabela inteira e sobre a tabela depois da dieta dá o mesmo resultado, linha a linha (teste com a semente)" | Tarefa 4, teste 7 (função pura, semente fixa); Tarefa 8, caso 1 (o passo de verdade, contra o banco); Tarefa 8, caso 5 (o CSV real, no dia) |
| 202, "dia coberto sem linha avança `last_day_pt`; dia não coberto não avança" | Tarefa 4, teste 8; Tarefa 5, testes 5 e 6; Tarefa 8, casos 2 e 3 |
| 202, "as contagens de antes e de depois e o tamanho da tabela estão anotados" | AD, VD3, VD8; Tarefa 15 (retratos); `e18p2-d0` |
| 202, "os invariantes de 7.5.10 fecham" | seção 4.4 (E0, M1 a M8), exigidos dentro da migration; K1; desvio 1 diz por que o segundo invariante foi reescrito |
| 188 e 199 (condições da MG17) | portão D3; a Tarefa 4, teste 9, repete o 199 sobre a tabela emagrecida |
| 200 (NP-E18 continua em 0) | CP15 no portão; `e18p2-d1`; Tarefa 6, teste 17 (a privacidade mais recente não muda) |
| 201 (`serie_coletada`, remoção de canal) | Tarefa 1, teste 16; Tarefa 6, teste 18; Tarefa 9, teste 10 |
| 203 (`origin = 'cms'` em 0) | CP15 |
| 191 (policy das tabelas privadas) | nenhuma policy é tocada (VD1, `policy_intacta`); o backup sai da lista: portão P9 e CP17 |
| 231 (lista fechada do que apaga) | Tarefas 14 e 15, **se o teste existir**; senão dívida, com os três pares escritos |
| 245 (interruptor com teste que apaga a variável) | Tarefa 2, testes 1, 2 e 12 |
| 246 (conferência com data) | Tarefas 11, 13, 14 e 15 |
| 247 (retrato antes e depois sobre base congelada) | AD, VD4, Tarefa 15 |
| 49 (ensaio da volta no banco local), para depois da MG16 | Tarefa 9, teste 9 (as voltas B e C com o backup já solto) |
| 47, 48 e 50 (contas, tamanho e NP-E6 da dieta do diário) | são do plano P3; aqui só VP3 (o diário não muda com a MG16), `e6-p4-d7` (tamanho) e `e6-p4-d1` (K5) |
| Itens próprios da MG16 (o spec não tem; ver 1.2 dos fatos): o backup só sai depois de 14 dias; nada mais o lê; as voltas B e C continuam; o diário não muda | Apêndice B (guardas); CP12; Tarefa 9, testes 4 e 9; VP1 a VP4 |
| Spec `00`, linha 395 (sozinhas, com o dono, depois do código tolerante em `main`) | portões P8 e D1; seção 2 |
| Spec `00`, linhas 418 e 419 (o que não se desfaz) | seção 2, "Como desfazer"; desvios 9 e 11 |
| Risco 8 do spec (erro humano entre o CSV e a migration) | a marca do dia, R1, as contas dentro da migration, o arquivo armado |
| Risco 37 (histórico de título e thumbnail além de 30 dias) | seção 4.6: a etapa guarda menos, não mais; não fecha o risco |
| Achado I-9 (a tabela "lixo") | seção 5, "Volume" |
| Itens 196 a 198 (tela das trocas) | **fora**: parte 6 da E18 |

---

## 13. Riscos que ficam, sem suavizar

1. **O SQL dos apêndices nunca rodou.** Foi escrito lendo a MG14, o plano P3 e o plano E18. As Tarefas 1, 6, 9 e 10 são a primeira execução; é esperado achar defeito de sintaxe ou de regra. Pontos em que eu apostaria menos: a subtração de multirange em `yt_own_meta_prova`, o `delete … using` de uma função que lê a mesma tabela, e o `execute` de um `create or replace function` de dentro de um bloco `do`.
2. **A etapa depende de quatro coisas que não existem:** a MG14 e a MG15 como arquivo, a MG12 e o passo de versões. Nenhum portão tem data.
3. **A regra das 14 execuções foi desenhada sobre tipos lidos em planos, não sobre uma linha real.** `resumo.versoes` ainda não foi gravado uma vez. Se o formato for outro, a migration recusa (lado seguro) e a correção custa uma volta nas Tarefas 6, 10 e 15. E a regra é estreita: um dia de API fora do ar zera 14 dias. (emenda 1: D-I-3, S-I-2, D-m-4) A reexecução manual do cron deixou de zerar a contagem, desde que saia sem nota; com que frequência o cron roda mais de uma vez por dia hoje é a CP19, e a metade de metadados da regra pode ser conferida já contra uma execução real (CP20). O custo de esperar é pequeno (a tabela cresce 35 linhas por dia).
4. **A dieta é menor do que a do spec.** Ficam cerca de 4 linhas por vídeo parado em vez de 1 (emenda 1: D-m-7), e todos os dias de teste A/B (regra 8). Estimo cerca de 1.000 linhas por ano contra cerca de 400 da regra literal: as duas são menos de 1 MB. Se a CP3 mostrar que alguma coluna muda todo dia, a regra não apaga nada e a etapa termina sem ganho até a coluna ser entendida.
5. **O cron passa a apagar linha todo dia.** É apagamento automático de dado coletado, coisa que a lista fechada do spec só tinha para "substituição pelo valor novo". O que protege: só sai linha idêntica às duas vizinhas, coberta e derivada; o alarme `sem_explicacao`; e o CSV do dia da MG17 (que envelhece: depois dele, o instante de captura dos dias do meio não tem cópia em lugar nenhum).
6. **Depois da MG17, a cobertura é a única prova de que um dia do meio foi conferido.** Um `delete` errado na cobertura transforma "conferido, sem mudança" em "ausência". As versões já derivadas não mudam (elas guardam `last_day_pt`), mas uma derivação refeita daria `last_day_pt` menor. A volta B não ajuda nesse caso (parte da cobertura); o CSV, sim.
7. **Depois da MG16, a única cópia exata das linhas de zero do diário é arquivo no disco do dono** (dois CSVs). A volta B recria o que os leitores precisam, não as linhas originais. É o risco 4 do plano P3, agora realizado.
8. **A marca do dia grava um comentário em duas tabelas de produção** e a migration o troca pelo resultado. Se alguma tiver comentário anterior (CP8), ele é perdido se o dono não seguir a linha alternativa do Apêndice E.
9. **O interruptor da dieta deixa o cron vermelho todo dia enquanto ligado.** É de propósito, e vai incomodar se a dieta precisar ficar desligada por semanas; (emenda 1: S-I-3) a outra saída, o roteiro SQL, **também** deixa o cron vermelho todo dia (linha 14b da seção 6), até o roteiro de religar. Não existe mais forma de a dieta ficar desligada em verde; o preço é o e-mail diário enquanto durar.
10. **Reverter o código da cobertura depois da MG17 faz a tabela voltar a crescer em silêncio** (nenhum passo acusa a própria ausência). Só `e18p2-d7`, `e18p2-d30` e o sinal de tamanho do banco da E10 avisam.
11. **A guarda das execuções é global** (a tabela de execuções não tem site). Com dois sites, a execução limpa de um libera o outro; as guardas de dado (cobertura, derivação, contas) é que são por site. Hoje há um site.
12. **Três redações do mesmo ritual** (plano P3, e aqui duas vezes em resumo). Este plano aponta para o plano P3 em vez de copiar, mas o runbook terá três seções parecidas. Ver dívida.
13. **`sem_estado` é só resumo.** Um canal novo que nunca ganhe estado de versões não é enxugado e o passo de metadados não acusa; depende da prova do passo de versões (`canais_com_linha_sem_estado`).
14. **A regra 3 confia em que o passo de metadados nunca reescreve dia anterior ao gravado.** É verdade no código de hoje (F1). Um repreenchimento futuro de dias antigos quebraria a garantia de que as vizinhas não mudam; o alarme `sem_explicacao` pegaria no dia seguinte, depois de a linha ter saído.

### Dívida registrada

- **Linha nova na tabela de 9.2 do spec `06`** (pedido ao controlador): "`yt_own_meta_cover` | a linha do meio de uma sequência de dias idênticos de `yt_own_video_meta_daily`, e o intervalo de cobertura que se funde a outro | este plano (desvio 4); a cobertura guarda o dia | não: só o instante de captura do dia some".
- **Linha nova na tabela de migrations do spec `00`:** "MG17a | E18, parte 2 | alarga o `check` de `source` da cobertura, funções de cobertura de metadados e carga | MG14 | lote C ou sozinha". **(reconciliação 13/10: R5: a linha existe na tabela única de migrations do documento de reconciliação, seção 1, com o nome MG17a.)**
- **Os pares do item 231:** `(arquivo da MG16, yt_own_video_daily_zeros_bkp)`, `(arquivo da MG17, yt_own_video_meta_daily)`, `(yt_own_meta_cover, yt_own_video_meta_daily)`. O teste da E10 varre `.delete()` no código; os três apagamentos daqui estão em SQL, fora do alcance dele: avisar o dono do teste. **(reconciliação 13/10: R6) Correção: a E10 tem dois testes.** O estático varre `.delete()` no TypeScript; o de integração (`observatorio-a5-e10-lista-fechada.test.ts`) lê do catálogo toda função `yt_*` com `delete from`. `yt_own_meta_cover` passa a ter `delete` com a MG17 (e com o roteiro de religar, que instala o mesmo corpo): **esse teste cai** se o par `(yt_own_meta_cover, yt_own_video_meta_daily)` não entrar nele no commit da Tarefa 15. As funções temporárias da MG16 e da MG17 somem no fim do arquivo e nenhum teste as vê: os dois pares de arquivo ficam declarados no ledger comum (o plano da E10 foi avisado).
- **A frase errada do plano E18** ("vale na execução seguinte, sem deploy"): corrigir lá. **(reconciliação 13/10: R4: corrigida no plano da E18, no interruptor da seção 6, na saída de emergência da Tarefa 7 e em "Como voltar".)**
- **A contagem de idas do teste 19 do plano E18** sobe de 43 para 45 com a Tarefa 5.
- **O roteiro "refazer a derivação de versões do zero"** em produção.
- **Um ritual único no runbook** para as três migrations destrutivas da dieta.
- **Alarme de tamanho de `yt_own_video_meta_daily`** no sinal de tamanho do banco da E10 (risco 10).
- **(emenda 1: S-m-11; prioridade alta: pedir antes de o arquivo da MG14 nascer)** **Pedir ao plano irmão** que a MG14 já nasça com `data_api` e `imagem` no `check` de `source`, se o arquivo dela ainda não existir no dia do portão A (o bloco 1 da MG17a vira nada a fazer). Com isso some também a trava exclusiva que cada transação de teste das Tarefas 1, 6, 7 e 8 segura em `yt_own_video_coverage`. **(reconciliação 13/10: R15) Decisão: a MG14 nasce como foi provada (`analytics_api`, `reporting_api`).** Ela é o SQL de ensaio de um plano já em execução (`.superpowers/sdd/a5-e6-e8/sql/mg14.sql:29`), e o bloco 1 da MG17a funciona nos dois casos; trocar o `check` lá pediria nova prova do plano irmão para poupar uma trava de teste. O custo fica: os testes das Tarefas 1, 6, 7 e 8 rodam em série no `bythiago_int`, sem outro teste de E6, E8 ou E11 ao mesmo tempo. O controlador pode rever antes do `db:new` da MG14; se rever, a CP10 daqui já cobre.

### O que nenhum teste vai provar (declarado)

- O tempo das três migrations e do `vacuum full` **em produção** (só o ensaio local em volume igual).
- Que o cliente do `db push` aplica o arquivo numa transação só. Por isso cada apagamento é uma instrução, e na MG17 a troca do corpo da função está dentro dela. (emenda 1: S-m-12) Se não for uma transação só, uma recusa deixa as funções auxiliares no banco, sem `execute` para ninguém: a leitura "Depois de uma recusa" do Apêndice E as acha e o dono as apaga.
- (emenda 1: D-m-9) Que o cliente do `db push` aceita os três níveis de aspas de dólar da MG17 (`$mg17$`, `$ddl$`, `$fn$`): as migrations versionadas deste repositório só usam um nível com etiqueta, e a Tarefa 10 ensaia por `psql`, não pela CLI. Se a CLI partir o arquivo no lugar errado, a falha é em vermelho (erro de sintaxe no `db push`; nenhuma linha apagada, porque o apagamento está dentro do bloco que não seria lido), e a leitura "Depois de uma recusa" diz o que ficou.
- A regra das 14 execuções contra uma linha real de produção, até a Tarefa 15 (antes disso, só contra os tipos).
- Que os seis leitores respondem o mesmo **em produção**: a prova é sobre semente (Tarefa 6, teste 17) e, no dia, a K5 para a leitura horária. Os outros cinco não têm consulta de produção própria; valem o retrato das sequências (M3) e o da situação (M4).
- A derivação refeita sobre a tabela de produção: só sobre o CSV, no banco local (R2), e só se o controlador a rodar.
- Que o bloqueio de `db:push:prod`, a retirada do arquivo depois de uma recusa e a ordem "desligar antes de restaurar" são obedecidos: são regras de processo.
- Que o CSV restaura **em produção** (só no banco local, R1) e a volta C contra produção.
- A concorrência real com o cron e com a leitura horária (a trava é provada por leitura do SQL, não por duas sessões).
- Que ninguém abre navegador: não há tela nesta etapa.

---

## 14. Apêndices

- **Apêndice A:** MG17a (`observatorio_a5_e18p2_cobertura_de_metadados`). **Não rodado.**
- **Apêndice B:** MG16 (`observatorio_a5_e6_p4_soltar_backup_do_diario`). **Não rodado.**
- **Apêndice C:** MG17 (`observatorio_a5_e18p2_dieta_de_metadados`). **Não rodado.**
- **Apêndice D:** volta B da dieta de metadados. **Não rodado.**
- **Apêndice E:** os comandos do dono, um por linha.

### Apêndice A: MG17a

```sql
-- =============================================================================
-- MIGRATION MG17a: Observatório A5, E18 parte 2 (dieta de yt_own_video_meta_daily), parte ADITIVA
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.5.10
-- Plano: docs/superpowers/plans/2026-10-13-a5-e6-p4-e-e18-parte-2-dieta-final-plan.md
-- Aditiva. Roda duas vezes sem erro. NÃO apaga nenhuma linha de yt_own_video_meta_daily.
-- Inerte para o código de main: ninguém chama as funções novas nem lê os conjuntos meta_texto e meta_thumb.
--
-- O que faz:
--   0. Recusa sem a MG14.
--   1. yt_own_video_coverage.source passa a aceitar 'data_api' (videos.list) e 'imagem' (download da thumbnail).
--   2. yt_own_meta_cover_set: funde dias na cobertura de um vídeo e um conjunto.
--   3. yt_own_meta_prova: só lê. Linha com captura fora da cobertura; dia coberto sem linha e sem explicação.
--   4. yt_own_meta_cover: o que o passo de metadados chama depois de gravar o dia. Aqui só COBRE.
--      (A MG17 troca o corpo por um que também enxuga; a assinatura e a resposta são as mesmas.)
--   5. Carga: cobre as linhas que já existem.
-- =============================================================================
set lock_timeout = '5s';

-- 0. Recusas de entrada
do $$
begin
  if to_regclass('public.yt_own_video_meta_daily') is null then
    raise exception 'MG17a depende da coleta L1a: public.yt_own_video_meta_daily não existe';
  end if;
  if to_regclass('public.yt_own_video_coverage') is null then
    raise exception 'MG17a depende da MG14: public.yt_own_video_coverage não existe';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint k
     where k.conrelid = 'public.yt_own_video_coverage'::regclass and k.contype = 'c'
       and pg_catalog.pg_get_constraintdef(k.oid) like '%meta_texto%'
       and pg_catalog.pg_get_constraintdef(k.oid) like '%meta_thumb%') then
    raise exception 'MG17a depende da MG14: o check de metric_set não aceita meta_texto e meta_thumb';
  end if;
end $$;

-- 1. De onde veio a cobertura: a captura de metadados não é analytics_api nem reporting_api.
-- Troca a restrição que cita os valores antigos por uma com os quatro. Rodar de novo não faz nada.
do $$
declare r record;
begin
  for r in
    select k.conname, pg_catalog.pg_get_constraintdef(k.oid) as def
      from pg_catalog.pg_constraint k
     where k.conrelid = 'public.yt_own_video_coverage'::regclass and k.contype = 'c'
       and pg_catalog.pg_get_constraintdef(k.oid) like '%analytics_api%'
  loop
    if r.def like '%data_api%' and r.def like '%imagem%' then
      continue;
    end if;
    execute format('alter table public.yt_own_video_coverage drop constraint %I', r.conname);
  end loop;
  if not exists (
    select 1 from pg_catalog.pg_constraint k
     where k.conrelid = 'public.yt_own_video_coverage'::regclass and k.contype = 'c'
       and pg_catalog.pg_get_constraintdef(k.oid) like '%data_api%') then
    alter table public.yt_own_video_coverage
      add constraint yt_own_video_coverage_source_check
      check (source in ('analytics_api', 'reporting_api', 'data_api', 'imagem'));
  end if;
end $$;

-- 2. Funde uma lista de dias na cobertura de UM vídeo e UM conjunto (a técnica de yt_own_daily_apply, MG14).
-- Intervalo que não mudou não é regravado (collected_at continua sendo o da última extensão).
create or replace function public.yt_own_meta_cover_set(
  p_video text, p_set text, p_days date[], p_site_id uuid, p_channel_id uuid, p_video_uuid uuid, p_at timestamptz
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_mr datemultirange;
  v_n integer := 0;
  v_source text;
begin
  if p_video is null or p_video = '' or p_site_id is null or p_channel_id is null then
    raise exception 'argumento_nulo';
  end if;
  if p_set is null or p_set not in ('meta_texto', 'meta_thumb') then
    raise exception 'conjunto_invalido';
  end if;
  if p_days is null or cardinality(p_days) = 0 then
    return 0;
  end if;
  v_source := case p_set when 'meta_texto' then 'data_api' else 'imagem' end;
  select range_agg(x.r) into v_mr from (
    select daterange(c.covered_from, c.covered_to, '[]') as r
      from public.yt_own_video_coverage c
     where c.youtube_video_id = p_video and c.metric_set = p_set
    union all
    select daterange(d, d, '[]') from unnest(p_days) as d where d is not null
  ) x;
  if v_mr is null then
    return 0;
  end if;
  delete from public.yt_own_video_coverage c
   where c.youtube_video_id = p_video and c.metric_set = p_set
     and not exists (select 1 from unnest(v_mr) as r where lower(r) = c.covered_from);
  insert into public.yt_own_video_coverage as c
    (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
  select p_video, p_set, lower(r), (upper(r) - 1), p_site_id, p_video_uuid, p_channel_id, v_source, coalesce(p_at, now())
    from unnest(v_mr) as r
  on conflict (youtube_video_id, metric_set, covered_from) do update
    set covered_to = excluded.covered_to,
        site_id = excluded.site_id,
        channel_id = excluded.channel_id,
        video_id = coalesce(excluded.video_id, c.video_id),
        source = excluded.source,
        collected_at = excluded.collected_at
    where c.covered_to is distinct from excluded.covered_to;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 3. A prova (só lê). Por canal, até p_day.
--   linhas:          quantas linhas foram avaliadas (0 = nada foi avaliado, não "tudo certo").
--   descobertas:     linha com privacidade fora de meta_texto, mais linha com dHash fora de meta_thumb.
--   sem_explicacao:  dia coberto (em qualquer dos dois conjuntos), sem linha, que NÃO está entre duas linhas
--                    idênticas do mesmo vídeo. Só a dieta cria dia coberto sem linha, e só entre idênticas.
create or replace function public.yt_own_meta_prova(p_site_id uuid, p_channel_id uuid, p_day date)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with linhas as (
    select m.youtube_video_id, m.day_pt, m.privacy_status, m.thumbnail_dhash,
           (to_jsonb(m) - 'day_pt' - 'captured_at') as t,
           lead(m.day_pt) over w as dia_seg,
           lead(to_jsonb(m) - 'day_pt' - 'captured_at') over w as t_seg
      from public.yt_own_video_meta_daily m
     where m.site_id = p_site_id and m.channel_id = p_channel_id and m.day_pt <= p_day
    window w as (partition by m.youtube_video_id order by m.day_pt)
  ), explicado as (
    -- o que as linhas explicam: o próprio dia e, quando a linha seguinte é idêntica, o vão até ela
    select l.youtube_video_id,
           range_agg(case when l.dia_seg is not null and l.t_seg = l.t
                          then daterange(l.day_pt, l.dia_seg, '[]')
                          else daterange(l.day_pt, l.day_pt, '[]') end) as mr
      from linhas l
     group by l.youtube_video_id
  ), coberto as (
    select c.youtube_video_id, c.metric_set,
           range_agg(daterange(c.covered_from, least(c.covered_to, p_day), '[]')) as mr
      from public.yt_own_video_coverage c
     where c.site_id = p_site_id and c.channel_id = p_channel_id
       and c.metric_set in ('meta_texto', 'meta_thumb') and c.covered_from <= p_day
     group by c.youtube_video_id, c.metric_set
  )
  select jsonb_build_object(
    'linhas', (select count(*) from linhas),
    'descobertas',
      (select count(*) from linhas l
        where l.privacy_status is not null
          and not exists (select 1 from public.yt_own_video_coverage c
                           where c.site_id = p_site_id and c.youtube_video_id = l.youtube_video_id
                             and c.metric_set = 'meta_texto' and l.day_pt between c.covered_from and c.covered_to))
      + (select count(*) from linhas l
          where l.thumbnail_dhash is not null
            and not exists (select 1 from public.yt_own_video_coverage c
                             where c.site_id = p_site_id and c.youtube_video_id = l.youtube_video_id
                               and c.metric_set = 'meta_thumb' and l.day_pt between c.covered_from and c.covered_to)),
    'sem_explicacao',
      (select coalesce(sum((select coalesce(sum(upper(r) - lower(r)), 0)
                              from unnest(c.mr - coalesce(e.mr, '{}'::datemultirange)) as r)), 0)
         from coberto c left join explicado e on e.youtube_video_id = c.youtube_video_id))
$$;

-- >>> MG17a yt_own_meta_cover (início)
-- 4. O que o passo de metadados chama, uma vez por canal, DEPOIS de gravar as linhas do dia.
-- Cobre toda linha do canal até p_day que ainda não está na cobertura (a de hoje e as que ficaram para trás):
--   meta_texto = a linha tem privacy_status (a videos.list respondeu naquele dia);
--   meta_thumb = a linha tem thumbnail_dhash (a imagem foi baixada e comparada).
-- p_compactar é aceito e ignorado aqui: esta versão nunca apaga (compactacao = 'indisponivel').
create or replace function public.yt_own_meta_cover(
  p_site_id uuid, p_channel_id uuid, p_day date, p_compactar boolean
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  r record;
  v_texto integer := 0;
  v_thumb integer := 0;
  v_prova jsonb;
begin
  if p_site_id is null or p_channel_id is null or p_day is null then
    raise exception 'argumento_nulo';
  end if;
  if not exists (select 1 from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception 'canal_fora_do_site';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_meta_cover:' || p_channel_id::text, 0));

  for r in
    select x.youtube_video_id,
           (array_agg(x.video_id order by x.day_pt desc))[1] as video_uuid,
           max(x.captured_at) as visto,
           array_agg(x.day_pt order by x.day_pt) filter (where x.falta_texto) as dias_texto,
           array_agg(x.day_pt order by x.day_pt) filter (where x.falta_thumb) as dias_thumb
      from (
        select m.youtube_video_id, m.video_id, m.day_pt, m.captured_at,
               (m.privacy_status is not null and not exists (
                  select 1 from public.yt_own_video_coverage c
                   where c.site_id = p_site_id and c.youtube_video_id = m.youtube_video_id
                     and c.metric_set = 'meta_texto' and m.day_pt between c.covered_from and c.covered_to)) as falta_texto,
               (m.thumbnail_dhash is not null and not exists (
                  select 1 from public.yt_own_video_coverage c
                   where c.site_id = p_site_id and c.youtube_video_id = m.youtube_video_id
                     and c.metric_set = 'meta_thumb' and m.day_pt between c.covered_from and c.covered_to)) as falta_thumb
          from public.yt_own_video_meta_daily m
         where m.site_id = p_site_id and m.channel_id = p_channel_id and m.day_pt <= p_day
      ) x
     where x.falta_texto or x.falta_thumb
     group by x.youtube_video_id
  loop
    if r.dias_texto is not null then
      perform public.yt_own_meta_cover_set(r.youtube_video_id, 'meta_texto', r.dias_texto,
                                           p_site_id, p_channel_id, r.video_uuid, r.visto);
      v_texto := v_texto + cardinality(r.dias_texto);
    end if;
    if r.dias_thumb is not null then
      perform public.yt_own_meta_cover_set(r.youtube_video_id, 'meta_thumb', r.dias_thumb,
                                           p_site_id, p_channel_id, r.video_uuid, r.visto);
      v_thumb := v_thumb + cardinality(r.dias_thumb);
    end if;
  end loop;

  v_prova := public.yt_own_meta_prova(p_site_id, p_channel_id, p_day);
  return jsonb_build_object(
    'resultado', 'ok', 'dia', p_day, 'texto', v_texto, 'thumb', v_thumb,
    'linhas', v_prova->'linhas', 'descobertas', v_prova->'descobertas', 'sem_explicacao', v_prova->'sem_explicacao',
    'compactacao', 'indisponivel', 'compactadas', 0);
end $$;
-- <<< MG17a yt_own_meta_cover (fim)

revoke all on function public.yt_own_meta_cover_set(text, text, date[], uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.yt_own_meta_prova(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.yt_own_meta_cover(uuid, uuid, date, boolean) from public, anon, authenticated;
grant execute on function public.yt_own_meta_cover_set(text, text, date[], uuid, uuid, uuid, timestamptz) to service_role;
grant execute on function public.yt_own_meta_prova(uuid, uuid, date) to service_role;
grant execute on function public.yt_own_meta_cover(uuid, uuid, date, boolean) to service_role;

-- 5. Carga: a mesma função, uma vez por canal que tem linha. Canal cujo site não bate é pulado COM aviso
-- (a conferência VA2 acusa as linhas dele como descobertas).
do $$
declare
  c record;
  v jsonb;
  v_canais integer := 0;
begin
  for c in
    select m.site_id, m.channel_id, max(m.day_pt) as ate
      from public.yt_own_video_meta_daily m
     group by m.site_id, m.channel_id
     order by 1, 2
  loop
    v_canais := v_canais + 1;
    begin
      v := public.yt_own_meta_cover(c.site_id, c.channel_id, c.ate, false);
      raise notice 'MG17a: canal % coberto: %', c.channel_id, v;
    exception when raise_exception then
      if sqlerrm = 'canal_fora_do_site' then
        raise warning 'MG17a: canal % tem linhas com site_id % que não é o site do canal; nada foi coberto para ele', c.channel_id, c.site_id;
      else
        raise;
      end if;
    end;
  end loop;
  if v_canais = 0 then
    raise notice 'MG17a: yt_own_video_meta_daily sem linhas, nada a cobrir';
  end if;
end $$;
```

**Índices que as instruções usam.** As consultas à cobertura casam pela chave primária `(youtube_video_id, metric_set, covered_from)`; a leitura da prova por canal usa `idx_yt_own_video_coverage_channel (channel_id, metric_set, covered_to)`; a leitura da tabela diária por canal usa `idx_yt_own_video_meta_daily_channel_day (channel_id, day_pt)`. Nenhum índice novo.

### Apêndice B: MG16

```sql
-- =============================================================================
-- MIGRATION MG16: Observatório A5, E6 (dieta do diário do canal próprio), P4: solta o backup da MG15
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.1 (passo P4)
-- Plano: docs/superpowers/plans/2026-10-13-a5-e6-p4-e-e18-parte-2-dieta-final-plan.md
--
-- APAGA UMA TABELA. Vai sozinha, com o dono, 14 dias ou mais depois da MG15.
-- Não toca o diário (só grava o resultado no comentário dele) nem a cobertura. Nenhum código lê o backup.
--
-- O que faz:
--   1. Uma função auxiliar com as guardas e o drop, sem execute para ninguém.
--   2. UMA instrução: chama a função. Qualquer guarda que falhe desfaz tudo.
--   3. Apaga a função.
-- Backup ausente: não faz nada e avisa. Backup vazio e sem comentário (banco novo, CI): solta sem exigir nada.
-- Backup com linhas: exige o comentário da MG15, 14 dias, a marca do dia, e que os zeros continuem recriáveis.
-- =============================================================================
set lock_timeout = '5s';
set statement_timeout = '120s';

-- >>> MG16 função (início)
-- p_agora existe para o teste escolher a data; a migration passa now().
create or replace function public.yt_own_daily_bkp_soltar(p_agora timestamptz)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_nota text;
  v_m text[];
  v_instante timestamptz;
  v_json jsonb;
  v_linhas bigint;
  v_apagadas bigint;
  v_bytes bigint;
  v_hoje date;
  v_cita text;
  v_site uuid;
  v_sites integer := 0;
  v_orfas bigint := 0;
  v_n bigint;
  v_vazias bigint;
  v_ficaram bigint;
begin
  if p_agora is null then
    raise exception 'yt_own_daily_bkp_soltar: p_agora é obrigatório' using errcode = '22023';
  end if;
  if to_regclass('public.yt_own_video_daily_zeros_bkp') is null then
    return jsonb_build_object('estado', 'sem_tabela');
  end if;
  v_hoje := (p_agora at time zone 'utc')::date;

  -- (1) Nada no banco pode citar o backup.
  select string_agg(p.oid::regprocedure::text, ', ') into v_cita
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosrc ilike '%yt_own_video_daily_zeros_bkp%'
     and p.proname <> 'yt_own_daily_bkp_soltar';
  if v_cita is not null then
    raise exception 'MG16 recusada: ainda há função que cita o backup (%)', v_cita;
  end if;
  select string_agg(v.viewname::text, ', ') into v_cita
    from pg_catalog.pg_views v
   where v.schemaname = 'public' and v.definition ilike '%yt_own_video_daily_zeros_bkp%';
  if v_cita is not null then
    raise exception 'MG16 recusada: ainda há visão que cita o backup (%)', v_cita;
  end if;

  select count(*) into v_linhas from public.yt_own_video_daily_zeros_bkp;
  v_bytes := pg_catalog.pg_total_relation_size('public.yt_own_video_daily_zeros_bkp'::regclass);
  v_nota := pg_catalog.obj_description('public.yt_own_video_daily_zeros_bkp'::regclass, 'pg_class');

  -- (2) Banco novo, CI: a MG15 criou a tabela e não apagou nada.
  if v_linhas = 0 and v_nota is null then
    drop table public.yt_own_video_daily_zeros_bkp;
    return jsonb_build_object('estado', 'solto_vazio', 'linhas', 0);
  end if;

  -- (3) O comentário é o que a MG15 anota: "MG15 <instante em UTC> [<um objeto por site>]".
  v_m := regexp_match(coalesce(v_nota, ''), '^MG15 (\S+) (\[.*\])$');
  if v_m is null then
    raise exception 'MG16 recusada: o backup tem % linha(s) e o comentário dele não é o que a MG15 anota. Estado desconhecido: nada foi solto', v_linhas;
  end if;
  begin
    v_instante := v_m[1]::timestamptz;
    v_json := v_m[2]::jsonb;
  exception when others then
    raise exception 'MG16 recusada: não consegui ler o instante ou as contas no comentário do backup. Nada foi solto';
  end;
  select coalesce(sum((e->>'apagadas')::bigint), 0) into v_apagadas from jsonb_array_elements(v_json) as e;
  if v_linhas <> v_apagadas then
    raise exception 'MG16 recusada: o backup tem % linha(s) e a MG15 anotou % apagada(s). Estado desconhecido: nada foi solto', v_linhas, v_apagadas;
  end if;

  -- (4) 14 dias desde a MG15.
  if p_agora < v_instante + interval '14 days' then
    raise exception 'MG16 recusada: a MG15 foi aplicada em %; o backup só pode ser solto a partir de %',
      to_char(v_instante at time zone 'utc', 'YYYY-MM-DD HH24:MI "UTC"'),
      to_char((v_instante + interval '14 days') at time zone 'utc', 'YYYY-MM-DD HH24:MI "UTC"');
  end if;

  -- (5) O dono conferiu o CSV HOJE: ele grava a marca no comentário do diário (o do backup guarda as contas da MG15).
  if coalesce(pg_catalog.obj_description('public.yt_own_video_daily'::regclass, 'pg_class'), '')
       not like '%P4 armada em ' || to_char(v_hoje, 'YYYY-MM-DD') || '%' then
    raise exception 'MG16 recusada: o CSV não foi conferido hoje (o comentário de public.yt_own_video_daily não traz "P4 armada em %"). Conferir o CSV e gravar a marca antes de aplicar',
      to_char(v_hoje, 'YYYY-MM-DD');
  end if;

  -- (6) Por site: os zeros continuam recriáveis sem o backup, o diário não voltou a engordar, a cobertura está viva.
  for v_site in select distinct b.site_id from public.yt_own_video_daily_zeros_bkp b order by 1 loop
    if not exists (select 1 from public.sites s where s.id = v_site) then
      select count(*) into v_n from public.yt_own_video_daily_zeros_bkp b where b.site_id = v_site;
      v_orfas := v_orfas + v_n;
      continue;
    end if;
    v_sites := v_sites + 1;

    select count(*) into v_n
      from public.yt_own_video_daily_zeros_bkp b
     where b.site_id = v_site
       and not exists (select 1 from public.yt_own_video_coverage c
                        where c.site_id = b.site_id and c.youtube_video_id = b.youtube_video_id
                          and c.metric_set = 'base' and b.day_pt between c.covered_from and c.covered_to)
       and not exists (select 1 from public.yt_own_video_daily d
                        where d.youtube_video_id = b.youtube_video_id and d.day_pt = b.day_pt);
    if v_n > 0 then
      raise exception 'MG16 recusada: % dia(s) do backup do site % que a cobertura não recria (fora da cobertura base e sem linha no diário). Nada foi solto', v_n, v_site;
    end if;

    -- O mesmo critério "vazia" de yt_own_daily_apply (MG14) e da MG15.
    select count(*) into v_vazias
      from public.yt_own_video_daily d
     where d.site_id = v_site and d.views is not null and d.views = 0
       and coalesce(d.engaged_views, 0) = 0 and coalesce(d.watch_time_minutes, 0) = 0
       and coalesce(d.likes, 0) = 0 and coalesce(d.comments, 0) = 0 and coalesce(d.shares, 0) = 0
       and coalesce(d.subscribers_gained, 0) = 0 and coalesce(d.subscribers_lost, 0) = 0
       and coalesce(d.card_impressions, 0) = 0;
    select coalesce(sum(coalesce((e->>'vazias')::bigint, 0) - coalesce((e->>'apagadas')::bigint, 0)), 0) into v_ficaram
      from jsonb_array_elements(v_json) as e
     where e->>'site' = v_site::text;
    if v_vazias > v_ficaram then
      raise exception 'MG16 recusada: o diário voltou a ter linhas vazias (% agora; a MG15 tinha deixado %) no site %. O coletor antigo está no ar? Nada foi solto', v_vazias, v_ficaram, v_site;
    end if;

    if not exists (select 1 from public.yt_own_video_coverage c
                    where c.site_id = v_site and c.metric_set = 'base'
                      and c.covered_to >= v_hoje - 5 and c.collected_at > p_agora - interval '36 hours') then
      raise exception 'MG16 recusada: a cobertura do diário do site % não foi gravada nas últimas 36 horas. Nada foi solto', v_site;
    end if;
  end loop;

  drop table public.yt_own_video_daily_zeros_bkp;
  return jsonb_build_object('estado', 'solto', 'agora', p_agora, 'mg15_em', v_instante, 'linhas', v_linhas,
                            'bytes', v_bytes, 'sites', v_sites, 'orfas', v_orfas, 'mg15', v_json);
end $$;

revoke all on function public.yt_own_daily_bkp_soltar(timestamptz) from public, anon, authenticated, service_role;
-- <<< MG16 função (fim)

-- UMA instrução: solta ou recusa.
do $$
declare v jsonb;
begin
  v := public.yt_own_daily_bkp_soltar(now());
  if v->>'estado' = 'sem_tabela' then
    raise notice 'MG16: o backup não existe, nada a fazer';
  else
    raise notice 'MG16: %', v;
  end if;
  if v->>'estado' = 'solto' then
    execute format('comment on table public.yt_own_video_daily is %L',
      'MG16 ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || ' ' || v::text);
  end if;
end $$;

drop function if exists public.yt_own_daily_bkp_soltar(timestamptz);
```

### Apêndice C: MG17

```sql
-- =============================================================================
-- MIGRATION MG17: Observatório A5, E18 parte 2 (dieta de yt_own_video_meta_daily), parte DESTRUTIVA
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.5.10; item 202
-- Plano: docs/superpowers/plans/2026-10-13-a5-e6-p4-e-e18-parte-2-dieta-final-plan.md
--
-- APAGA LINHA, e liga o enxugamento diário. Vai sozinha, com o dono, depois de 14 execuções limpas.
-- Fora de 11:30 a 13:00 UTC. O vacuum full, se houver, é um comando à parte.
--
-- O que faz:
--   0. Recusa sem a MG17a, sem a MG12, ou se a tabela não tiver as colunas esperadas.
--   1. yt_own_meta_linhas_do_meio: o critério, escrito uma vez. Fica no banco (o passo de metadados o usa).
--   2. Duas funções auxiliares (contas; guardas e apagamento), sem execute para ninguém.
--   3. UMA instrução: para cada site, apaga as linhas do meio e confere as contas de antes e de depois; e SÓ SE
--      todos fecharem troca o corpo de yt_own_meta_cover pelo que também enxuga. Qualquer prova que falhe desfaz
--      tudo, inclusive a troca: a compactação nunca fica ligada sem o apagamento ter fechado.
--   4. Apaga as duas auxiliares.
-- (emenda 1: D-I-1) Tabela sem linhas (banco novo, CI): não apaga, não exige nada, e instala o corpo novo.
-- Site com linhas e enxugamento ainda desligado: TODAS as guardas, mesmo sem linha do meio (é esta migration que
-- liga o apagamento diário). Site sem linha do meio e enxugamento já ligado (segunda aplicação): nada a fazer.
-- A marca do dia vai no comentário da tabela (o dono a põe no passo do CSV).
-- =============================================================================
set lock_timeout = '5s';
set statement_timeout = '120s';

-- 0. Recusas de entrada
do $$
declare v_cols text;
begin
  if to_regprocedure('public.yt_own_meta_cover(uuid,uuid,date,boolean)') is null
     or to_regprocedure('public.yt_own_meta_prova(uuid,uuid,date)') is null
     or to_regprocedure('public.yt_own_meta_cover_set(text,text,date[],uuid,uuid,uuid,timestamptz)') is null then
    raise exception 'MG17 depende da MG17a: as funções de cobertura de metadados não existem';
  end if;
  if to_regclass('public.yt_own_versions_state') is null or to_regclass('public.yt_own_video_versions') is null then
    raise exception 'MG17 depende da MG12: public.yt_own_versions_state ou public.yt_own_video_versions não existe';
  end if;
  select string_agg(a.attname::text, ',' order by a.attname) into v_cols
    from pg_catalog.pg_attribute a
   where a.attrelid = 'public.yt_own_video_meta_daily'::regclass and a.attnum > 0 and not a.attisdropped;
  if v_cols is distinct from 'ab_test_id,ab_variant_id,captured_at,channel_id,day_pt,description_sha256,description_text,duration_seconds,is_short,privacy_status,seconds_on_air_analytics,seconds_on_air_reporting,seconds_other_analytics,seconds_other_reporting,site_id,tags,tags_sha256,thumbnail_blob_url,thumbnail_dhash,thumbnail_sha256,thumbnail_sha256_at_capture,title,title_at_capture,video_id,youtube_video_id' then
    raise exception 'MG17: yt_own_video_meta_daily mudou de forma (colunas: %). Rever o critério e as voltas antes de apagar', v_cols;
  end if;
end $$;

-- >>> MG17 yt_own_meta_linhas_do_meio (início)
-- 1. O critério. Devolve as linhas do canal que são IDÊNTICAS às duas vizinhas do mesmo vídeo (todas as colunas,
-- menos o dia e o instante da captura), que têm captura, e cuja vizinha de depois é de dia anterior a p_day
-- (a linha do dia ainda pode ser completada por uma segunda execução; as anteriores não mudam mais).
--   coberta:  o dia está em meta_texto e, se a linha tem dHash, em meta_thumb (mesmo site, mesmo vídeo).
--   derivada: o passo de versões já derivou o dia (derived_through do canal).
-- Só sai linha com as duas verdadeiras.
-- (emenda 1: D-I-2) Linha de dia de teste A/B (ab_test_id não nulo) nunca é devolvida.
-- (emenda 1: D-m-3) Linha que é fronteira de versão (first_day_pt de versão fora do pré-registro, ou last_day_pt de
-- versão não corrente) nunca é devolvida.
create or replace function public.yt_own_meta_linhas_do_meio(p_site_id uuid, p_channel_id uuid, p_day date)
returns table (youtube_video_id text, day_pt date, tem_dhash boolean, coberta boolean, derivada boolean)
language sql stable security invoker set search_path = ''
as $$
  with l as (
    select m.youtube_video_id, m.day_pt, m.channel_id, m.privacy_status, m.thumbnail_dhash, m.ab_test_id,
           (to_jsonb(m) - 'day_pt' - 'captured_at') as t,
           lag(to_jsonb(m) - 'day_pt' - 'captured_at') over w as t_ant,
           lead(to_jsonb(m) - 'day_pt' - 'captured_at') over w as t_seg,
           lead(m.day_pt) over w as dia_seg
      from public.yt_own_video_meta_daily m
     where m.site_id = p_site_id
    window w as (partition by m.youtube_video_id order by m.day_pt)
  )
  select l.youtube_video_id, l.day_pt, (l.thumbnail_dhash is not null),
         (exists (select 1 from public.yt_own_video_coverage c
                   where c.site_id = p_site_id and c.youtube_video_id = l.youtube_video_id
                     and c.metric_set = 'meta_texto' and l.day_pt between c.covered_from and c.covered_to)
          and (l.thumbnail_dhash is null
               or exists (select 1 from public.yt_own_video_coverage c
                           where c.site_id = p_site_id and c.youtube_video_id = l.youtube_video_id
                             and c.metric_set = 'meta_thumb' and l.day_pt between c.covered_from and c.covered_to))),
         exists (select 1 from public.yt_own_versions_state s
                  where s.channel_id = p_channel_id and s.site_id = p_site_id and l.day_pt <= s.derived_through)
    from l
   where l.channel_id = p_channel_id
     and l.privacy_status is not null
     and l.t_ant is not null and l.t_seg is not null
     and l.t = l.t_ant and l.t_seg = l.t
     and l.dia_seg < p_day
     and l.ab_test_id is null
     and not exists (select 1 from public.yt_own_video_versions v
                      where v.site_id = p_site_id and v.youtube_video_id = l.youtube_video_id and not v.pre_registro
                        and (v.first_day_pt = l.day_pt or (not v.is_current and v.last_day_pt = l.day_pt)))
$$;
revoke all on function public.yt_own_meta_linhas_do_meio(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.yt_own_meta_linhas_do_meio(uuid, uuid, date) to service_role;
-- <<< MG17 yt_own_meta_linhas_do_meio (fim)

-- >>> MG17 auxiliares (início)
-- 2a. As contas de um site (só lê). Para cada canal, "o dia gravado" é a última linha dele.
create or replace function public.yt_own_meta_diet_contas(p_site uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  with linhas as (
    select m.youtube_video_id, m.day_pt, m.channel_id, m.privacy_status, m.thumbnail_dhash, m.description_text,
           m.ab_test_id, m.captured_at, (to_jsonb(m) - 'day_pt' - 'captured_at') as t
      from public.yt_own_video_meta_daily m
     where m.site_id = p_site
  ), marcadas as (
    select l.*, case when l.t is distinct from lag(l.t) over (partition by l.youtube_video_id order by l.day_pt)
                     then 1 else 0 end as nova
      from linhas l
  ), numeradas as (
    select x.*, sum(x.nova) over (partition by x.youtube_video_id order by x.day_pt) as seq from marcadas x
  ), sequencias as (
    select s.youtube_video_id, s.seq, min(s.day_pt) as de, max(s.day_pt) as ate, md5(min(s.t::text)) as conteudo,
           (array_agg(s.captured_at order by s.day_pt))[1] as cap_de,
           (array_agg(s.captured_at order by s.day_pt desc))[1] as cap_ate
      from numeradas s
     group by s.youtube_video_id, s.seq
  ), situacao as (
    select distinct on (l.youtube_video_id) l.youtube_video_id, l.day_pt, l.privacy_status
      from linhas l
     where l.privacy_status is not null
     order by l.youtube_video_id, l.day_pt desc
  ), canais as (
    select l.channel_id, max(l.day_pt) as ate from linhas l group by l.channel_id
  ), meio as (
    select x.tem_dhash, x.coberta, x.derivada
      from canais c
     cross join lateral public.yt_own_meta_linhas_do_meio(p_site, c.channel_id, c.ate) x
  ), provas as (
    select public.yt_own_meta_prova(p_site, c.channel_id, c.ate) as p from canais c
  )
  select jsonb_build_object(
    't', (select count(*) from linhas),
    'videos', (select count(distinct l.youtube_video_id) from linhas l),
    'canais', (select count(*) from canais),
    'ate', (select max(c.ate) from canais c),
    'com_texto', (select count(*) from linhas l where l.privacy_status is not null),
    'com_thumb', (select count(*) from linhas l where l.thumbnail_dhash is not null),
    'sem_privacidade', (select count(*) from linhas l where l.privacy_status is null),
    'com_descricao', (select count(*) from linhas l where l.description_text is not null),
    'com_teste', (select count(*) from linhas l where l.ab_test_id is not null),
    'c_texto', (select coalesce(sum(c.covered_to - c.covered_from + 1), 0) from public.yt_own_video_coverage c
                 where c.site_id = p_site and c.metric_set = 'meta_texto'),
    'c_thumb', (select coalesce(sum(c.covered_to - c.covered_from + 1), 0) from public.yt_own_video_coverage c
                 where c.site_id = p_site and c.metric_set = 'meta_thumb'),
    'sequencias', (select count(*) from sequencias),
    'retrato_sequencias', (select md5(coalesce(string_agg(
        q.youtube_video_id || '|' || to_char(q.de, 'YYYY-MM-DD') || '|' || to_char(q.ate, 'YYYY-MM-DD') || '|' || q.conteudo
        || '|' || to_char(q.cap_de at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US')
        || '|' || to_char(q.cap_ate at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        ',' order by q.youtube_video_id, q.de), '')) from sequencias q),
    'retrato_situacao', (select md5(coalesce(string_agg(
        s.youtube_video_id || '|' || to_char(s.day_pt, 'YYYY-MM-DD') || '|' || s.privacy_status,
        ',' order by s.youtube_video_id), '')) from situacao s),
    'do_meio', (select count(*) from meio),
    'candidatas', (select count(*) from meio x where x.coberta and x.derivada),
    'candidatas_com_dhash', (select count(*) from meio x where x.coberta and x.derivada and x.tem_dhash),
    'do_meio_sem_cobertura', (select count(*) from meio x where not x.coberta),
    'do_meio_sem_derivacao', (select count(*) from meio x where not x.derivada),
    'descobertas', (select coalesce(sum((y.p->>'descobertas')::bigint), 0) from provas y),
    'sem_explicacao', (select coalesce(sum((y.p->>'sem_explicacao')::bigint), 0) from provas y),
    'versoes_sem_linha', (select count(*) from public.yt_own_video_versions v
                           where v.site_id = p_site and not v.pre_registro
                             and (not exists (select 1 from public.yt_own_video_meta_daily m
                                               where m.youtube_video_id = v.youtube_video_id and m.day_pt = v.first_day_pt)
                                  or (not v.is_current
                                      and not exists (select 1 from public.yt_own_video_meta_daily m
                                                       where m.youtube_video_id = v.youtube_video_id and m.day_pt = v.last_day_pt)))))
$$;

-- 2b. Guardas, trava, apagamento, contas de novo.
-- p_agora existe para o teste escolher a hora e o dia; a migration passa now().
create or replace function public.yt_own_meta_diet(p_site uuid, p_agora timestamptz)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_hora time;
  v_hoje date;
  v_hoje_pt date;
  v_ultimo date;
  v_dias integer; v_limpas integer; v_ultima timestamptz; v_primeiro_dia date; v_ultimo_dia date;
  v_antes jsonb; v_depois jsonb;
  v_apagadas bigint := 0;
  v_n bigint;
  v_ligada boolean;
  v_sujos text;
  c record;
begin
  if p_site is null or p_agora is null then
    raise exception 'yt_own_meta_diet: p_site e p_agora são obrigatórios' using errcode = '22023';
  end if;
  v_hora := (p_agora at time zone 'utc')::time;
  v_hoje := (p_agora at time zone 'utc')::date;
  v_hoje_pt := (p_agora at time zone 'America/Los_Angeles')::date;

  -- (0) Cobre o que faltar, sem apagar: toda linha com captura entra na cobertura antes de qualquer conta.
  for c in
    select m.channel_id, max(m.day_pt) as ate
      from public.yt_own_video_meta_daily m where m.site_id = p_site
     group by m.channel_id order by 1
  loop
    begin
      perform public.yt_own_meta_cover(p_site, c.channel_id, c.ate, false);
    exception when raise_exception then
      raise exception 'MG17 recusada: a cobertura do canal % não pôde ser gravada (%). Nada foi apagado', c.channel_id, sqlerrm;
    end;
  end loop;

  v_antes := public.yt_own_meta_diet_contas(p_site);

  -- (1) (emenda 1: D-I-1, S-m-1) Só dois casos saem sem guarda: site sem NENHUMA linha (banco novo, CI), e site sem
  -- linha do meio em que o enxugamento JÁ está ligado (segunda aplicação: não há o que apagar nem o que ligar).
  -- Site com linhas e enxugamento ainda desligado passa por TODAS as guardas, mesmo sem linha do meio: é esta
  -- migration que liga o apagamento diário, e ela não o liga sem a marca, os 14 dias limpos e as provas.
  select exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'yt_own_meta_cover'
                    and p.prosrc like '%yt_own_meta_linhas_do_meio%') into v_ligada;
  if (v_antes->>'t')::bigint = 0 then
    return jsonb_build_object('site', p_site, 'estado', 'nada_a_apagar', 'motivo', 'sem_linhas', 'guardas', false,
                              'apagadas', 0, 'linhas', 0);
  end if;
  if (v_antes->>'do_meio')::bigint = 0 and v_ligada then
    return jsonb_build_object('site', p_site, 'estado', 'nada_a_apagar', 'motivo', 'ja_ligada', 'guardas', false,
                              'apagadas', 0, 'linhas', v_antes->'t');
  end if;

  -- (2) A janela do cron das 12:00 UTC.
  if v_hora >= time '11:30' and v_hora < time '13:00' then
    raise exception 'MG17 recusada: entre 11:30 e 13:00 UTC o cron do canal próprio grava em yt_own_video_meta_daily (agora % UTC). Rodar fora dessa janela', v_hora;
  end if;

  -- (2b) O ritual do CSV foi feito HOJE: o dono grava a marca no comentário da tabela.
  if coalesce(pg_catalog.obj_description('public.yt_own_video_meta_daily'::regclass, 'pg_class'), '')
       not like '%E18P2 armada em ' || to_char(v_hoje, 'YYYY-MM-DD') || '%' then
    raise exception 'MG17 recusada: o ritual do CSV não foi feito hoje (o comentário de public.yt_own_video_meta_daily não traz "E18P2 armada em %"). Tirar o CSV e gravar a marca antes de aplicar',
      to_char(v_hoje, 'YYYY-MM-DD');
  end if;

  -- (3) A coleta de metadados está em dia.
  v_ultimo := (v_antes->>'ate')::date;
  if v_ultimo is null or v_ultimo < v_hoje_pt - 2 then
    raise exception 'MG17 recusada: a última linha de metadados do site é de % (a coleta parou?)', v_ultimo;
  end if;

  -- (4) (emenda 1: D-I-3, S-I-2, D-m-8) 14 dias limpos seguidos, com a última execução há menos de 24 horas.
  -- base = o passo de metadados COLETOU (gravou linha, nada pendente, tentativa ok, nenhuma falta de autorização,
  -- de conexão, de tempo ou de schema, nenhum canal com dia sem linha), a cobertura GRAVOU em todos os canais
  -- (nenhuma linha fora dela, nenhum dia sem explicação), o passo de versões rodou sem atraso, e nenhuma nota de
  -- metadados, de cobertura nem de versões ficou em falhas. Campo ausente ou em outro formato = falso (nunca erro
  -- de conversão).
  -- confirmou = o passo de versões confirmou ao menos uma versão. sem_dia_novo = ele não tinha dia a derivar
  -- (reexecução do cron no mesmo dia).
  -- O DIA é limpo quando alguma execução dele tem base e confirmou, e nenhuma execução dele é suja. A reexecução
  -- sem dia novo (base, sem confirmar) não limpa o dia sozinha e não o suja.
  with execucoes as (
    select (r.ran_at at time zone 'utc')::date as dia, r.ran_at,
           -- >>> MG17 limpa (início)
           (coalesce(case when jsonb_typeof(j.m->'gravados') = 'number' then (j.m->>'gravados')::numeric >= 1 end, false)
            and coalesce(j.m->'pendentes' = '0'::jsonb, false)
            and coalesce(case when jsonb_typeof(j.m->'tentativas'->'ok') = 'number'
                              then (j.m->'tentativas'->>'ok')::numeric >= 1 end, false)
            and not coalesce(j.m->'tentativas' ?| array['sem_autorizacao', 'sem_conexao', 'nao_alcancado_orcamento', 'schema_ausente'], true)
            and coalesce(jsonb_typeof(j.m->'dias_sem_meta') = 'object', false)
            and coalesce(j.m->'dias_sem_meta' <> '{}'::jsonb, false)
            and not exists (select 1 from jsonb_each(case when jsonb_typeof(j.m->'dias_sem_meta') = 'object'
                                                          then j.m->'dias_sem_meta' else '{}'::jsonb end) as e
                             where e.value <> '0'::jsonb)
            and coalesce(case when jsonb_typeof(j.k->'canais') = 'number' then (j.k->>'canais')::numeric >= 1 end, false)
            and coalesce(j.k->'ok' = j.k->'canais', false)
            and coalesce(j.k->'falhas' = '0'::jsonb, false)
            and coalesce(j.k->'sem_tempo' = 'false'::jsonb, false)
            and coalesce(j.k->'descobertas' = '0'::jsonb, false)
            and coalesce(j.k->'sem_explicacao' = '0'::jsonb, false)
            and coalesce(jsonb_typeof(j.v) = 'object', false)
            and not coalesce(j.v->'desligado' = 'true'::jsonb, false)
            and coalesce(j.v->'sem_tempo' = 'false'::jsonb, false)
            and coalesce(jsonb_typeof(j.v->'atraso_dias') = 'object', false)
            and coalesce(j.v->'atraso_dias' <> '{}'::jsonb, false)
            and not exists (select 1 from jsonb_each(case when jsonb_typeof(j.v->'atraso_dias') = 'object'
                                                          then j.v->'atraso_dias' else '{}'::jsonb end) as e
                             where e.value <> '0'::jsonb)
            and coalesce(j.v->'recuperando', '{}'::jsonb) = '{}'::jsonb
            and coalesce(j.v->'atraso_desconhecido', '[]'::jsonb) = '[]'::jsonb
            and coalesce(j.v->'dia_sem_resposta', '[]'::jsonb) = '[]'::jsonb
            and not exists (select 1 from unnest(r.falhas) as f
                             where f like 'metadados:%' or f like 'versões:%' or f like 'versoes:%'
                                or f like '%yt_own_versions%' or f like '%yt_own_video_versions%'
                                or f like '%yt_own_meta_cover%' or f like '%yt_own_video_meta_daily%'
                                or f like '%yt_own_video_coverage%' or f like '%prova das versões%'
                                or f like '%YT_OWN_META_DIETA_OFF%')) as base,
           coalesce(case when jsonb_typeof(j.v->'confirmadas') = 'number'
                         then (j.v->>'confirmadas')::numeric >= 1 end, false) as confirmou,
           coalesce(j.v->'dias_derivados' = '0'::jsonb, false) as sem_dia_novo
           -- <<< MG17 limpa (fim)
      from public.yt_own_collection_runs r
     cross join lateral (select r.resumo->'metadados' as m, r.resumo->'metadados'->'cobertura' as k,
                                r.resumo->'versoes' as v) j
     where r.ran_at > p_agora - interval '20 days' and r.ran_at <= p_agora
  ), por_dia as (
    select e.dia, max(e.ran_at) as ran_at,
           (bool_or(e.base and e.confirmou) and bool_and(e.base and (e.confirmou or e.sem_dia_novo))) as limpa
      from execucoes e
     group by e.dia
  ), ultimas as (
    select * from por_dia order by dia desc limit 14
  )
  select count(*), count(*) filter (where u.limpa), max(u.ran_at), min(u.dia), max(u.dia),
         string_agg(to_char(u.dia, 'YYYY-MM-DD'), ', ' order by u.dia) filter (where not u.limpa)
    into v_dias, v_limpas, v_ultima, v_primeiro_dia, v_ultimo_dia, v_sujos
    from ultimas u;
  if v_dias < 14 or v_limpas < 14 or v_ultimo_dia - v_primeiro_dia <> 13 or v_ultima < p_agora - interval '24 hours' then
    raise exception 'MG17 recusada: preciso de 14 dias limpos seguidos, com a última execução há menos de 24 horas (achei % dia(s), % limpo(s), de % a %, a última execução em %; dias não limpos: %)',
      v_dias, v_limpas, v_primeiro_dia, v_ultimo_dia, v_ultima, coalesce(v_sujos, 'nenhum');
  end if;

  -- (5) A trava: quem lê não espera; quem grava (o cron) espera.
  lock table public.yt_own_video_meta_daily in share row exclusive mode;
  v_antes := public.yt_own_meta_diet_contas(p_site);

  -- (6) Estado conhecido antes de apagar: cobertura inteira e explicada, versões com a sua linha, e toda linha
  -- do meio coberta e derivada. Qualquer coisa fora disso é recusa, nunca apagamento parcial.
  if (v_antes->>'descobertas')::bigint <> 0 or (v_antes->>'sem_explicacao')::bigint <> 0
     or (v_antes->>'versoes_sem_linha')::bigint <> 0
     or (v_antes->>'do_meio_sem_cobertura')::bigint <> 0 or (v_antes->>'do_meio_sem_derivacao')::bigint <> 0
     or (v_antes->>'candidatas')::bigint <> (v_antes->>'do_meio')::bigint then
    raise exception 'MG17 recusada: estado desconhecido antes de apagar (linhas com captura fora da cobertura: %; dias cobertos sem explicação: %; versões sem a sua linha: %; linhas do meio sem cobertura: %; linhas do meio que o passo de versões ainda não derivou: %). Nada foi apagado',
      v_antes->>'descobertas', v_antes->>'sem_explicacao', v_antes->>'versoes_sem_linha',
      v_antes->>'do_meio_sem_cobertura', v_antes->>'do_meio_sem_derivacao';
  end if;

  -- (6b) (emenda 1: D-I-1) Sem linha do meio e com todas as guardas passadas: nada a apagar, e o enxugamento
  -- diário pode ser ligado pelo bloco que chamou.
  if (v_antes->>'do_meio')::bigint = 0 then
    return jsonb_build_object('site', p_site, 'estado', 'nada_a_apagar', 'motivo', 'sem_linha_do_meio', 'guardas', true,
                              'apagadas', 0, 'linhas', v_antes->'t', 'ultima_execucao', v_ultima);
  end if;

  -- (7) Apaga, canal a canal, pelo critério.
  for c in
    select m.channel_id, max(m.day_pt) as ate
      from public.yt_own_video_meta_daily m where m.site_id = p_site
     group by m.channel_id order by 1
  loop
    delete from public.yt_own_video_meta_daily m
     using public.yt_own_meta_linhas_do_meio(p_site, c.channel_id, c.ate) x
     where x.coberta and x.derivada
       and m.youtube_video_id = x.youtube_video_id and m.day_pt = x.day_pt
       and m.site_id = p_site and m.channel_id = c.channel_id;
    get diagnostics v_n = row_count;
    v_apagadas := v_apagadas + v_n;
  end loop;

  -- (8) As contas de depois (M1 a M8 do plano).
  v_depois := public.yt_own_meta_diet_contas(p_site);
  if v_apagadas <> (v_antes->>'candidatas')::bigint
     or (v_depois->>'t')::bigint <> (v_antes->>'t')::bigint - v_apagadas
     or (v_depois->>'do_meio')::bigint <> 0
     or (v_depois->'videos') <> (v_antes->'videos')
     or (v_depois->'sequencias') <> (v_antes->'sequencias')
     or (v_depois->>'retrato_sequencias') <> (v_antes->>'retrato_sequencias')
     or (v_depois->>'retrato_situacao') <> (v_antes->>'retrato_situacao')
     or (v_depois->>'com_texto')::bigint <> (v_antes->>'com_texto')::bigint - v_apagadas
     or (v_depois->>'com_thumb')::bigint <> (v_antes->>'com_thumb')::bigint - (v_antes->>'candidatas_com_dhash')::bigint
     or (v_depois->'sem_privacidade') <> (v_antes->'sem_privacidade')
     or (v_depois->'c_texto') <> (v_antes->'c_texto')
     or (v_depois->'c_thumb') <> (v_antes->'c_thumb')
     or (v_depois->>'descobertas')::bigint <> 0
     or (v_depois->>'sem_explicacao')::bigint <> 0
     or (v_depois->>'versoes_sem_linha')::bigint <> 0 then
    raise exception 'MG17 desfeita: as contas não fecham (apagadas %; antes %; depois %). Nada foi apagado',
      v_apagadas, v_antes, v_depois;
  end if;

  return jsonb_build_object('site', p_site, 'estado', 'apagado', 'agora', p_agora, 'ultima_execucao', v_ultima,
                            'apagadas', v_apagadas, 'antes', v_antes, 'depois', v_depois);
end $$;

revoke all on function public.yt_own_meta_diet_contas(uuid) from public, anon, authenticated, service_role;
revoke all on function public.yt_own_meta_diet(uuid, timestamptz) from public, anon, authenticated, service_role;
-- <<< MG17 auxiliares (fim)

-- 3. UMA instrução: apaga, confere e, só então, liga o enxugamento diário.
do $mg17$
declare
  v_site uuid;
  v_r jsonb;
  v_tudo jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_sites integer := 0;
begin
  for v_site in select distinct m.site_id from public.yt_own_video_meta_daily m order by 1 loop
    v_sites := v_sites + 1;
    v_r := public.yt_own_meta_diet(v_site, now());
    v_tudo := v_tudo || jsonb_build_array(v_r);
    v_total := v_total + (v_r->>'apagadas')::bigint;
    raise notice 'MG17: %', v_r;
  end loop;
  if v_sites = 0 then
    raise notice 'MG17: yt_own_video_meta_daily sem linhas, nada a apagar';
  end if;

  -- Chegou aqui: nenhum site recusou. (emenda 1: D-I-1) Todo site com linha passou por todas as guardas, ou já
  -- estava com o enxugamento ligado. A partir de agora o passo de metadados também enxuga.
  -- Mesma assinatura e mesma resposta da MG17a; muda só o trecho entre a cobertura e a prova.
  execute $ddl$
-- >>> MG17 yt_own_meta_cover (início)
create or replace function public.yt_own_meta_cover(
  p_site_id uuid, p_channel_id uuid, p_day date, p_compactar boolean
) returns jsonb
language plpgsql security invoker set search_path = ''
as $fn$
declare
  r record;
  v_texto integer := 0;
  v_thumb integer := 0;
  v_del integer := 0;
  v_estado text;
  v_prova jsonb;
begin
  if p_site_id is null or p_channel_id is null or p_day is null then
    raise exception 'argumento_nulo';
  end if;
  if not exists (select 1 from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception 'canal_fora_do_site';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_meta_cover:' || p_channel_id::text, 0));

  for r in
    select x.youtube_video_id,
           (array_agg(x.video_id order by x.day_pt desc))[1] as video_uuid,
           max(x.captured_at) as visto,
           array_agg(x.day_pt order by x.day_pt) filter (where x.falta_texto) as dias_texto,
           array_agg(x.day_pt order by x.day_pt) filter (where x.falta_thumb) as dias_thumb
      from (
        select m.youtube_video_id, m.video_id, m.day_pt, m.captured_at,
               (m.privacy_status is not null and not exists (
                  select 1 from public.yt_own_video_coverage c
                   where c.site_id = p_site_id and c.youtube_video_id = m.youtube_video_id
                     and c.metric_set = 'meta_texto' and m.day_pt between c.covered_from and c.covered_to)) as falta_texto,
               (m.thumbnail_dhash is not null and not exists (
                  select 1 from public.yt_own_video_coverage c
                   where c.site_id = p_site_id and c.youtube_video_id = m.youtube_video_id
                     and c.metric_set = 'meta_thumb' and m.day_pt between c.covered_from and c.covered_to)) as falta_thumb
          from public.yt_own_video_meta_daily m
         where m.site_id = p_site_id and m.channel_id = p_channel_id and m.day_pt <= p_day
      ) x
     where x.falta_texto or x.falta_thumb
     group by x.youtube_video_id
  loop
    if r.dias_texto is not null then
      perform public.yt_own_meta_cover_set(r.youtube_video_id, 'meta_texto', r.dias_texto,
                                           p_site_id, p_channel_id, r.video_uuid, r.visto);
      v_texto := v_texto + cardinality(r.dias_texto);
    end if;
    if r.dias_thumb is not null then
      perform public.yt_own_meta_cover_set(r.youtube_video_id, 'meta_thumb', r.dias_thumb,
                                           p_site_id, p_channel_id, r.video_uuid, r.visto);
      v_thumb := v_thumb + cardinality(r.dias_thumb);
    end if;
  end loop;

  -- O enxugamento: só depois de cobrir. Sem estado de versões do canal, nada sai.
  if not coalesce(p_compactar, false) then
    v_estado := 'desligada';
  elsif not exists (select 1 from public.yt_own_versions_state s
                     where s.channel_id = p_channel_id and s.site_id = p_site_id) then
    v_estado := 'sem_estado';
  else
    delete from public.yt_own_video_meta_daily m
     using public.yt_own_meta_linhas_do_meio(p_site_id, p_channel_id, p_day) x
     where x.coberta and x.derivada
       and m.youtube_video_id = x.youtube_video_id and m.day_pt = x.day_pt
       and m.site_id = p_site_id and m.channel_id = p_channel_id;
    get diagnostics v_del = row_count;
    v_estado := 'feita';
  end if;

  v_prova := public.yt_own_meta_prova(p_site_id, p_channel_id, p_day);
  return jsonb_build_object(
    'resultado', 'ok', 'dia', p_day, 'texto', v_texto, 'thumb', v_thumb,
    'linhas', v_prova->'linhas', 'descobertas', v_prova->'descobertas', 'sem_explicacao', v_prova->'sem_explicacao',
    'compactacao', v_estado, 'compactadas', v_del);
end $fn$
-- <<< MG17 yt_own_meta_cover (fim)
  $ddl$;
  execute 'revoke all on function public.yt_own_meta_cover(uuid, uuid, date, boolean) from public, anon, authenticated';
  execute 'grant execute on function public.yt_own_meta_cover(uuid, uuid, date, boolean) to service_role';

  if v_total > 0 then
    execute format('comment on table public.yt_own_video_meta_daily is %L',
      'MG17 ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || ' ' || v_tudo::text);
  end if;
end $mg17$;

-- 4. Nada que apaga em massa fica no banco.
drop function if exists public.yt_own_meta_diet(uuid, timestamptz);
drop function if exists public.yt_own_meta_diet_contas(uuid);

analyze public.yt_own_video_meta_daily;
-- O vacuum full NÃO vai aqui (não roda dentro de transação): é o passo d7 do ritual, do dono, e só se compensar.
```

**Índices que as instruções usam.** O `delete` casa pela chave primária `(youtube_video_id, day_pt)`; a função do critério varre as linhas do site (alguns milhares antes da dieta, algumas centenas depois) e consulta a cobertura pela chave primária dela; o estado de versões, pela chave primária `(channel_id)`. Nenhum índice novo.

**O comentário guardado** traz, por site, contagens, datas e md5. Não traz título, descrição nem URL.

### Apêndice D: volta B da dieta de metadados

`docs/ops/sql/dieta-meta-volta-b-recriar-da-cobertura.sql`. **Antes, sempre:** `docs/ops/sql/dieta-meta-desligar-compactacao.sql` (senão o cron do dia seguinte reapaga).

```sql
-- Volta B da dieta de metadados: recria uma linha para cada dia coberto e sem linha que está entre duas linhas
-- IDÊNTICAS do mesmo vídeo. A linha recriada é a cópia da vizinha de antes (a que foi apagada era igual a ela em
-- todas as colunas, menos o dia e o instante da captura). O instante NÃO é o original: fica 12:00 UTC do dia
-- seguinte, a hora nominal do cron. Para as linhas originais, só o CSV (volta C).
-- (você roda) Trocar <UUID_DO_SITE> pelo uuid do site. Uma instrução. Roda duas vezes sem erro.
with l as (
  select m.*,
         (to_jsonb(m) - 'day_pt' - 'captured_at') as t,
         lead(m.day_pt) over w as dia_seg,
         lead(to_jsonb(m) - 'day_pt' - 'captured_at') over w as t_seg
    from public.yt_own_video_meta_daily m
   where m.site_id = '<UUID_DO_SITE>'::uuid
  window w as (partition by m.youtube_video_id order by m.day_pt)
)
insert into public.yt_own_video_meta_daily
  (youtube_video_id, day_pt, site_id, video_id, channel_id, title, thumbnail_sha256, thumbnail_dhash,
   thumbnail_blob_url, title_at_capture, thumbnail_sha256_at_capture, description_sha256, description_text,
   tags_sha256, tags, duration_seconds, is_short, privacy_status, ab_test_id, ab_variant_id,
   seconds_on_air_analytics, seconds_other_analytics, seconds_on_air_reporting, seconds_other_reporting, captured_at)
select l.youtube_video_id, g.dia::date, l.site_id, l.video_id, l.channel_id, l.title, l.thumbnail_sha256, l.thumbnail_dhash,
       l.thumbnail_blob_url, l.title_at_capture, l.thumbnail_sha256_at_capture, l.description_sha256, l.description_text,
       l.tags_sha256, l.tags, l.duration_seconds, l.is_short, l.privacy_status, l.ab_test_id, l.ab_variant_id,
       l.seconds_on_air_analytics, l.seconds_other_analytics, l.seconds_on_air_reporting, l.seconds_other_reporting,
       ((g.dia::date + 1)::timestamp + interval '12 hours') at time zone 'utc'
  from l
 cross join lateral generate_series((l.day_pt + 1)::timestamp, (l.dia_seg - 1)::timestamp, interval '1 day') as g(dia)
 where l.dia_seg is not null and l.t_seg = l.t and l.dia_seg - l.day_pt > 1
   and exists (select 1 from public.yt_own_video_coverage c
                where c.site_id = l.site_id and c.youtube_video_id = l.youtube_video_id
                  and c.metric_set = 'meta_texto' and g.dia::date between c.covered_from and c.covered_to)
   and (l.thumbnail_dhash is null
        or exists (select 1 from public.yt_own_video_coverage c
                    where c.site_id = l.site_id and c.youtube_video_id = l.youtube_video_id
                      and c.metric_set = 'meta_thumb' and g.dia::date between c.covered_from and c.covered_to))
on conflict (youtube_video_id, day_pt) do nothing;
```
Depois: a K4 (as linhas voltaram) e a CP13 (`sem_explicacao` 0: agora todo dia coberto tem linha).

### Apêndice E: os comandos do dono, um por linha

Todos "(você roda)". `AAAAMMDD` é o dia. A URL é a "Session pooler" do painel do Supabase (Connect), com a senha do banco; ela não vai para arquivo nenhum. O ritual, o porquê de cada passo e o que fazer numa recusa estão no plano P3 (seção 2 e Apêndice D): aqui só o que muda.

**MG16, antes da migration (passo p3).**

```bash
cd ~/Workspace/arquivo-observatorio/dieta-diario
```
```bash
shasum -a 256 -c yt_own_video_daily-AAAAMMDD.csv.sha256
```
(`AAAAMMDD` aqui é o dia da MG15. Tem de responder `OK`. Qualquer outra resposta: parar e avisar.)
```bash
read -s PGURL
```
```bash
psql "$PGURL" -c "\copy (select * from public.yt_own_video_daily_zeros_bkp order by youtube_video_id, day_pt) to 'yt_own_video_daily_zeros_bkp-AAAAMMDD.csv' csv header"
```
```bash
shasum -a 256 yt_own_video_daily_zeros_bkp-AAAAMMDD.csv > yt_own_video_daily_zeros_bkp-AAAAMMDD.csv.sha256
```
A marca do dia (se a CP8 tiver achado comentário no diário, o texto antigo vai antes da marca, dentro das mesmas aspas simples):
```bash
psql "$PGURL" -c "comment on table public.yt_own_video_daily is 'P4 armada em $(date -u +%F)'"
```
A migration, na pasta do repositório:
```bash
npm run db:push:prod
```
Depois da VP2 anotada, retirar o resultado do comentário (ou devolver o texto antigo no lugar de `null`):
```bash
psql "$PGURL" -c "comment on table public.yt_own_video_daily is null"
```
```bash
unset PGURL
```

**MG17, antes da migration (passo d3).**

```bash
mkdir -p ~/Workspace/arquivo-observatorio/dieta-meta
```
```bash
cd ~/Workspace/arquivo-observatorio/dieta-meta
```
```bash
read -s PGURL
```
```bash
psql "$PGURL" -c "\copy (select * from public.yt_own_video_meta_daily order by youtube_video_id, day_pt) to 'yt_own_video_meta_daily-AAAAMMDD.csv' csv header"
```
```bash
shasum -a 256 yt_own_video_meta_daily-AAAAMMDD.csv > yt_own_video_meta_daily-AAAAMMDD.csv.sha256
```
```bash
psql "$PGURL" -c "select count(*) from public.yt_own_video_meta_daily"
```
(O número tem de ser o `t` da AD. Não usar `wc -l` neste arquivo: a descrição dos vídeos tem quebras de linha e o número de linhas do arquivo é maior que o de linhas da tabela. A prova de que o CSV presta é a R1.)

A marca do dia:
```bash
psql "$PGURL" -c "comment on table public.yt_own_video_meta_daily is 'E18P2 armada em $(date -u +%F)'"
```
A migration, na pasta do repositório:
```bash
npm run db:push:prod
```
O `vacuum full`, só se a tabela passava de 1 MB na AD (pergunta 5):
```bash
psql "$PGURL" -c "set lock_timeout = '5s'" -c "vacuum (full, analyze) public.yt_own_video_meta_daily"
```
Depois da VD2 anotada:
```bash
psql "$PGURL" -c "comment on table public.yt_own_video_meta_daily is null"
```
```bash
unset PGURL
```

**Desligar a compactação, na hora** (SQL Editor do painel): colar o conteúdo de `docs/ops/sql/dieta-meta-desligar-compactacao.sql`. Enquanto estiver desligada, o cron fica vermelho todo dia (emenda 1: S-I-3).

**Religar a compactação (emenda 1: S-I-3)** (SQL Editor do painel; só com a causa achada e a CP13 com `descobertas` 0 e `sem_explicacao` 0): colar o conteúdo de `docs/ops/sql/dieta-meta-religar-compactacao.sql`.

**Depois de uma recusa do `db push` (emenda 1: S-m-12).** A leitura é do controlador:
```sql
select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('yt_own_meta_diet', 'yt_own_meta_diet_contas', 'yt_own_daily_bkp_soltar');
```
Nenhuma linha: nada ficou (o arquivo foi aplicado numa transação só). Para cada nome que aparecer, a linha dele (você roda), antes da nova tentativa:
```bash
psql "$PGURL" -c "drop function if exists public.yt_own_meta_diet(uuid, timestamptz)"
```
```bash
psql "$PGURL" -c "drop function if exists public.yt_own_meta_diet_contas(uuid)"
```
```bash
psql "$PGURL" -c "drop function if exists public.yt_own_daily_bkp_soltar(timestamptz)"
```
`yt_own_meta_linhas_do_meio` também pode ter ficado depois de uma recusa da MG17: é a função permanente do critério, só lê, ninguém a chama enquanto o corpo de `yt_own_meta_cover` for o da MG17a, e a nova tentativa a recria. Não precisa apagar.

**Volta C da MG17: restaurar do CSV** (depois de desligar a compactação; três linhas, na ordem; depois a K4):

```bash
psql "$PGURL" -c "create table public.yt_own_video_meta_daily_csv_tmp (like public.yt_own_video_meta_daily)" -c "alter table public.yt_own_video_meta_daily_csv_tmp enable row level security" -c "revoke all on table public.yt_own_video_meta_daily_csv_tmp from public, anon, authenticated, service_role"
```
```bash
psql "$PGURL" -c "\copy public.yt_own_video_meta_daily_csv_tmp from 'yt_own_video_meta_daily-AAAAMMDD.csv' csv header"
```
```bash
psql "$PGURL" -c "insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, title, thumbnail_sha256, thumbnail_dhash, thumbnail_blob_url, title_at_capture, thumbnail_sha256_at_capture, description_sha256, description_text, tags_sha256, tags, duration_seconds, is_short, privacy_status, ab_test_id, ab_variant_id, seconds_on_air_analytics, seconds_other_analytics, seconds_on_air_reporting, seconds_other_reporting, captured_at) select t.youtube_video_id, t.day_pt, t.site_id, case when exists (select 1 from public.youtube_videos v where v.id = t.video_id) then t.video_id end, t.channel_id, t.title, t.thumbnail_sha256, t.thumbnail_dhash, t.thumbnail_blob_url, t.title_at_capture, t.thumbnail_sha256_at_capture, t.description_sha256, t.description_text, t.tags_sha256, t.tags, t.duration_seconds, t.is_short, t.privacy_status, t.ab_test_id, t.ab_variant_id, t.seconds_on_air_analytics, t.seconds_other_analytics, t.seconds_on_air_reporting, t.seconds_other_reporting, t.captured_at from public.yt_own_video_meta_daily_csv_tmp t on conflict (youtube_video_id, day_pt) do nothing" -c "drop table public.yt_own_video_meta_daily_csv_tmp"
```
A tabela temporária tem as colunas na ordem da tabela de produção (`like`), e o CSV foi tirado com `select *` da mesma tabela: as ordens batem. Se a CP2b mostrar que a tabela mudou de forma entre o CSV e a volta, a linha do `\copy` passa a listar as colunas do cabeçalho do CSV.

**Volta C da MG16** (recriar a tabela de backup a partir do CSV dela, ou os zeros no diário a partir do CSV do diário): os três comandos do Apêndice D do plano P3, sem mudança.
