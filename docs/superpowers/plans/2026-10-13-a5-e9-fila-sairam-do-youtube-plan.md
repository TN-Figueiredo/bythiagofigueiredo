# A5, ordem 18: E9, fila "Saíram do YouTube" (plano de implementação)

Escrito em 13/10/2026. Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/01-coleta-concorrentes.md`, seção 4.5 e itens de aceite 66 a 73; `02-comentarios-de-destaque.md` (itens 118 e 120, na parte da fila); `06-ciclo-de-vida-volume-e-cota.md` (lista fechada do que apaga, linha 1, item 231); `04-medidas-telas-e-mockups.md` (mockup 10, rito 6.5(d), item 98); `00-indice-decisoes-e-sequencia.md` (itens 245 a 247, risco aceito "guardado por padrão"). Obrigação herdada: D-11 do plano de E1 e E2 (a sincronização consulta `competitor_removed_items` antes de a função de apagar chegar a produção). Migration: **uma, nova** (o pedido dizia "nenhuma": ver seção 0.1). Fatos levantados antes do plano: `.superpowers/sdd/a5-planos-onda-2/e9-fila-sairam-do-youtube/fatos.md`.

**Objetivo, em três frases.** Dar ao dono a aba "Saíram do YouTube": a lista do que deixou de vir do YouTube (vídeo, canal inteiro, comentários), com o que há guardado de cada um e duas respostas, "manter para análise" e "apagar". "Apagar" remove tudo do item numa transação só (linhas, por cascata, e depois os arquivos de miniatura no Blob), deixa uma linha sem conteúdo em `competitor_removed_items`, grava a auditoria na mesma transação e recusa enquanto a forja lê o vídeo. Sem resposta nada é apagado, e o cron de concorrentes passa a provar isso a cada disparo (linhas dos ausentes não podem cair) e a acusar apagamento que ficou pela metade.

**Fica FORA deste plano.**
- A pastilha "saiu do YouTube em dd/mm · mantido para análise" nas outras telas, e a frase "N vídeos fora do ar entram nesta mediana": são da E5 e da E4. Aqui o item mantido aparece só na própria aba, em "Já respondidos".
- O export para o NAS e os comandos de apagar lá (`archive_pending`, "Ver os comandos", "Já rodei"): dependem da E10 e da MG6, que não existem. Nesta fase `archive_pending` é sempre `false` e a tela diz que não há exportação (seção 8, desvio 9). **(reconciliação 13/10: R8) "Não há exportação" só é verdade enquanto a MG6 não existir, e a E10 vem antes na sequência (ordem 15).** Com `obs_archive_batches` no banco pode haver lote exportado de um canal que depois sai do YouTube, e o plano da E10 diz que o "apagar" tem de alcançar o arquivo sem implementar isso (linhas 977 e 1086 de lá): nenhum dos dois planos apaga do NAS. O que este plano passa a fazer, para não afirmar o que não é: as três funções de apagar e a prévia conferem, quando `to_regclass('public.obs_archive_batches')` não é nulo, quantos lotes do canal existem com `deleted_at` nulo, e devolvem o número na chave `lotes_exportados` **(reconciliação 13/10, emenda 1: S-m7: a tabela tem uma linha por lote, tabela e período, então a conta é `count(distinct batch)` com `channel_ref = <id do canal>::text` e `deleted_at is null`, servida por `idx_obs_archive_batches_channel`)**; maior que zero, o painel e o item apagado dizem "há N arquivo(s) exportado(s) deste canal: este apagar não os alcança; apague-os no NAS e na pasta local", no lugar de "não há exportação". `archive_pending` continua `false` (ligá-lo sem o botão "Já rodei" deixaria o item em "apagando" para sempre e o cron vermelho depois de 24 h). **SQL não escrito no Apêndice A e não rodado:** entra na Tarefa 1 e volta aos dois especialistas. A limpeza do arquivo fica como pergunta R-B ao dono (documento de reconciliação, seção 6).
- O fluxo antigo "remover canal" de um canal que está **no ar** (`removeCompetitorChannel`): continua como é (sem registro em `competitor_removed_items`, sem limpar o Blob). Só ganha uma recusa quando o canal está na fila. As miniaturas órfãs desse fluxo ficam na dívida (seção 13).
- O teste geral da lista fechada do que apaga (item 231) em todo o código do Observatório: é da E10. Este plano entrega a linha 1 da lista e uma varredura própria (Tarefa 11).
- Descobrir o motivo do sumiço, ler a página do YouTube, avisar por e-mail (regra 4.5: só o contador na aba).
- Nenhuma rota em `api/pipeline/`; nada em `api-registry.ts`, `data/pipeline-docs/` nem em `docs/cowork-*`. A fila não vai para a forja nem para o Cowork.
- Regenerar `types/database.types.ts`.
- O botão "Perguntar a uma IA" na fila (spec `07`, 8.1.5, lista a fila entre as telas com o botão): é da etapa que entrega o botão e os empacotadores (E17 e E7), cujo teste percorre a lista de telas. Aqui a tela só deixa pronto o modelo puro (`_saiu/view-model.ts`) de que o empacotador vai precisar. (emenda 1: S-m10)

---

## Estado do portão

Primeira versão, com a **emenda 1** (13/10): os pareceres da rodada 1 dos dois especialistas foram respondidos achado por achado em `.superpowers/sdd/a5-planos-onda-2/e9-fila-sairam-do-youtube/resposta-r1.md`, e cada mudança está marcada no lugar com "(emenda 1: <id>)" (`S-` = parecer de software, `D-` = parecer de dados). **Emenda 2** (13/10): os pareceres da rodada 2 foram respondidos em `.superpowers/sdd/a5-planos-onda-2/e9-fila-sairam-do-youtube/resposta-r2.md`, com cada mudança marcada "(emenda 2: <id>)" (`N1` a `N6` = parecer de dados; `I-N1` e `m-N1` a `m-N8` = parecer de software). Na rodada 2 o especialista de dados **concordou** (6 menores); o de software condicionou o acordo ao I-N1, que está emendado, e a confirmação dele ainda não foi escrita: o plano **ainda não tem o acordo** dos dois especialistas (`revisor-engenharia-dados-senior` e `revisor-engenharia-software-senior`). O SQL do Apêndice A **não foi executado** por quem escreveu este plano (o pedido proibia rodar banco, teste e build): ele foi escrito contra o texto das migrations locais, lido linha a linha. A Tarefa 1 existe para rodá-lo duas vezes no banco de integração **antes** de qualquer outra tarefa que dependa dele; os pontos em que eu espero achado estão em "Foco de revisão" (seção 9).

**O que pode começar JÁ**, sem migration, sem resposta do dono e sem tocar a zona da A4: as Tarefas **1** (ensaio do SQL), **3** (modelo puro), **5** (Blob). A Tarefa **7** (consulta da sincronização, que é a obrigação D-11 e vai em envio próprio) também pode ser **escrita** já, com uma ressalva (emenda 1: S-I3): ela edita `…/competitors/actions.ts`, que fica dentro da zona `competitors/**` da A4, então só começa com esse arquivo limpo no `git status` e com o aviso do controlador; e o **envio** dela tem uma dependência maior do que a CP2 (seção 2, passo 1). Depois da Tarefa 1: **4, 6, 8**. A tela (**9, 10**) começa quando o `git status` mostrar limpos os arquivos de `_chrome/` que ela edita. A **2** (arquivo da migration) só na vez do lote que o controlador indicar.

---

## 0. Dependências duras (ler antes de tudo)

### 0.1 Cinco fatos que mudam o pedido

1. **A etapa precisa de migration.** O pedido e o spec (`00:347`, `00:377`) dizem "não (na MG1)". A MG1 criou só a **tabela** `competitor_removed_items` (`supabase/migrations/20261012000002_observatorio_a5_e1_campos_sinalizadores_raw.sql:128-149`). A função `competitor_video_purge`, que o spec exige atômica e só para `service_role` (`01:291`), não existe em nenhum arquivo (`grep -rn competitor_video_purge supabase/ apps/web/src` devolve zero). Sem função em SQL, "apagar" seria uma sequência de chamadas do TypeScript (apaga, registra, audita), que pode parar no meio e deixar o vídeo apagado sem registro: é o caso clássico de falha em verde. Vale a migration (Apêndice A).
2. **O código da E1 não está em `main`.** Lido em 13/10 com `git ls-remote origin refs/heads/main refs/heads/staging`: `main` = `4a9387ac` (12/10, 19:15), que **não contém** `apps/web/src/lib/youtube/competitor-capture.ts`; `staging` remoto = `63db57ba`, que contém. As colunas da MG1 estão em produção, mas nada as preenche ainda: em produção a fila está vazia e continuará vazia até a promoção da E1. O pedido dizia "E1 em produção hoje pelo Lote 1": a constante `E1_E2_DEPLOY = '2026-10-13'` já está no HEAD local, mas a promoção não tinha acontecido quando li. **Nenhum envio deste plano vai antes de a E1 e a E2 estarem em `main`** (conferência CP2). **(reconciliação 13/10: R12) Fato atualizado:** relido na referência local às 14 h de 13/10, `origin/main` = `6d63f387` ("release: A5 E1 e E2, Lote 1", 13/10 12:27), que **contém** `competitor-capture.ts` (`git cat-file -e origin/main:apps/web/src/lib/youtube/competitor-capture.ts`). A promoção aconteceu depois da leitura acima; a CP2 passa na referência local e o `git fetch` do controlador confirma. O Lote 2 de E1/E2, o lote B e a A4 continuam só locais, e a condição do Envio A (linha 1 da tabela da seção 2) não muda.
3. **A janela da recusa é de 30 minutos, não 20.** A conferência C0.12 (`.superpowers/sdd/a5/conferencias-c0-resultado.md:186`) fechou: recusar com `status = 'running'` e `started_at` nos últimos 30 minutos (a constante do vigia). O spec (`01:262`) e o mockup aprovado (`e.js:39`) escrevem 20. O texto da tela passa a "até 30 minutos" (desvio 1).
4. **O mockup 10 está aprovado** (decisão 62 do dono, 13/10: tela E, `docs/superpowers/mockups/2026-10-13-a5-lote-1/e-sairam-do-youtube.html`). A tela entra neste plano, seguindo o mockup, com as divergências **declaradas** na seção 8.
5. **A zona da A4 foi liberada em 13/10, 02:35** (`.superpowers/sdd/2026-10-12-telas-a4-canal-proprio-plan/SESSAO-ANTERIOR-ENCERRADA.md`), mas a A4 ainda não foi enviada e o `git status` de hoje mostra arquivos de `_canal/` em edição por outro terminal. O spec dizia que a E9 não toca arquivo da A4 (`00:504`); a aba exige editar três arquivos de `_chrome/` e `observatorio/links.ts`. Regra na seção 9.

### 0.2 O que este plano usa de outras migrations (conferido contra o texto local)

| O que uso | Forma exata, lida no arquivo | Onde uso |
|---|---|---|
| `competitor_removed_items` (MG1, em produção) | `id bigint`, `site_id`, `kind in ('video','canal','comentario')`, `youtube_id text`, `competitor_channel_id uuid` sem FK, `missing_since date`, `decided_at`, `decided_by uuid not null`, `rows_deleted jsonb not null`, `blobs_pending text[]`, `archive_pending boolean`, `purge_count smallint`, `returned_seen_at`, `return_decision in ('voltar','ignorar')`, `return_decided_at`; `unique (site_id, kind, youtube_id)`; RLS ligada; uma policy `select` com `can_edit_site(site_id)`; nenhuma policy de escrita | as funções de apagar, a consulta da sincronização, o leitor |
| Colunas de ausência e decisão em `competitor_videos` e `competitor_channels` (MG1) | `missing_since date`, `miss_streak`, `miss_first_at`, `last_seen_at`, `removal_decision text check (in ('manter'))`, `removal_decided_at`, `removal_decided_by`, `discovered_at` | a fila; "manter" |
| O mesmo em `competitor_video_comments` (MG8, em produção) | `missing_since`, `removal_decision`, `removal_decided_*`; `site_id`, `competitor_channel_id`, `video_id` (os três `not null`); `parent_id` com cascata para a própria tabela; índice parcial `idx_cvc_missing (site_id, missing_since) where missing_since is not null and removal_decision is null` | o grupo de comentários |
| `competitor_videos` não tem `site_id`; `video_id text` é `UNIQUE` **global** (`20260531000008_competitor_observatory.sql:14-24`) | o site de um vídeo sai do canal dele | todo filtro de site de vídeo passa por `competitor_channels.site_id` |
| Cascatas para `competitor_videos(id)` | `competitor_video_versions`, `competitor_video_daily`, `competitor_changes`, `youtube_intelligence_tasks.target_video_id`, `competitor_readings.video_id`, `competitor_field_versions`, `competitor_raw`, `competitor_video_early`, `competitor_video_tier_spans`, `competitor_video_hourly`, `competitor_hour_fold_log`, `competitor_video_comment_snaps`, `competitor_video_comments`: todas `on delete cascade` | "apagar" só apaga a linha do vídeo; o resto vai por cascata |
| Cascatas para `competitor_channels(id)` | `competitor_videos`, `competitor_channel_snapshots`, `competitor_field_versions`, `competitor_raw`, `competitor_channel_hour_map`, `competitor_video_comment_snaps`, `competitor_video_comments`: `cascade`. `competitor_video_comments.featured_channel_id`: `set null` | "apagar canal" |
| Cascatas para `competitor_video_comments(id)` | `competitor_video_comment_authors`, `competitor_video_comment_marks`, e `parent_id` (a resposta do criador) | "apagar comentários" |
| `youtube_intelligence_tasks` (`20261003000004_observatorio_forja.sql:14-34`) | estados `pending, running, completed, failed, stale, refused`; `started_at` preenchido no claim; `competitor_readings.task_id` é `set null` | a recusa |
| O claim da forja | um `update … set status = 'running', started_at = now` filtrado por estado (`lib/pipeline/services/forja-queue.ts:127`); o vigia devolve à fila `running` com mais de 30 min (`app/api/cron/youtube-intelligence-watchdog/route.ts:23,40,62-72`); a mesma constante é `STALE_AFTER_MINUTES = 30` em `lib/youtube/analysis-progress.ts:42` | a trava e a janela |
| Miniaturas no Blob | `put('observatorio/thumbs/${videoUuid}/${dhash}.jpg', …, { access: 'public', addRandomSuffix: false, allowOverwrite: true })` (`lib/youtube/thumb-fingerprint.ts:101-107`); a URL fica em `competitor_video_versions.thumb_blob_url` | o que apagar no Blob |
| `audit_log` (`20260507000001_schema.sql:718-731`) | `actor_user_id, action, resource_type, resource_id uuid, org_id, site_id, before_data, after_data, ip inet, user_agent`; a policy de leitura exige `org_id` preenchido para o administrador da organização ver; `sites.org_id` é `not null` | a auditoria, dentro das funções |
| A escrita de comentário respeita o apagado (MG8, linhas 287-302 e 397) | `apply_competitor_comment_snap` não regrava comentário cujo id está em `competitor_removed_items` com `kind = 'comentario'`, **qualquer que seja** `return_decision`, e carimba `returned_seen_at` | "voltou" de comentário só tem "ignorar" (desvio 7) |
| A volta ao ar de quem não foi apagado (código da E1) | toda leitura boa zera `missing_since` e a decisão (`competitor-capture.ts`, `VideoRowPatch` e `ChannelRowPatch`) e abre a versão `availability = 'no_ar'` | o item 73 já está feito pela E1; este plano só o prova de ponta |

### 0.3 Conferências pendentes (leitura; o controlador roda)

Nenhuma trava o começo. Leitura de produção é do controlador (`npx supabase db query --linked` não é usado por agente). Cada linha diz o que muda conforme a resposta.

| # | Comando | O que muda |
|---|---|---|
| CP1 | `select (select count(*) from competitor_videos where missing_since is not null) as videos_ausentes, (select count(*) from competitor_videos where miss_streak > 0 and missing_since is null) as com_uma_falta, (select count(*) from competitor_channels where missing_since is not null) as canais_ausentes, (select count(*) from competitor_video_comments where missing_since is not null) as comentarios_ausentes, (select count(*) from competitor_removed_items) as ja_apagados, (select count(*) from competitor_videos where removal_decision is not null) as mantidos;` | Tudo zero (o esperado enquanto a E1 não está em `main`): a primeira prova em produção só acontece no D+1 da E1 ou depois. `videos_ausentes > 0`: a conferência `e9-d0` ganha a leitura do painel de um item real **antes** de qualquer "apagar". `ja_apagados > 0`: alguém gravou fora do código; parar e avisar |
| CP2 | `git ls-remote origin refs/heads/main` e `git cat-file -e <sha>:apps/web/src/lib/youtube/competitor-capture.ts` (depois de `git fetch origin main`, que o controlador roda) | Enquanto falhar, nenhum envio deste plano sai (seção 2). Hoje falha. (emenda 1: D-M11) "Hoje falha" vale para o ref local lido em 13/10; quem decide é o `git fetch` do controlador |
| CP3 | `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('competitor_video_purge','competitor_channel_purge','competitor_comments_purge','competitor_cascade_counts','competitor_missing_proof','competitor_missing_keep','competitor_return_decide','competitor_removed_blobs_done','competitor_purge_preview','competitor_jsonb_sum','competitor_missing_count','competitor_comments_preview','competitor_removed_comment_groups'); select to_regclass('public.competitor_missing_baseline');` | Esperado: nenhuma linha e `null`. Qualquer outra coisa: alguém aplicou fora do repositório; parar |
| CP4 | `select k.conrelid::regclass as tabela, k.confrelid::regclass as referencia, k.conname, k.confdeltype, cardinality(k.conkey) as colunas from pg_constraint k where k.contype = 'f' and k.confrelid in ('public.competitor_videos'::regclass, 'public.competitor_channels'::regclass, 'public.competitor_video_comments'::regclass, 'public.youtube_intelligence_tasks'::regclass, 'public.competitor_video_versions'::regclass, 'public.competitor_readings'::regclass) order by 2, 1;` | Esperado: as cascatas da tabela 0.2, `colunas = 1` em todas, e nenhum `confdeltype` `a` ou `r`. `a` ou `r` para vídeo, canal ou comentário: "apagar" falharia com erro de chave (nada apagado, vermelho na tela); a Tarefa 1 acrescenta o `delete` explícito daquela tabela antes do da raiz. Cascata apontando para `competitor_video_versions`, `competitor_readings` ou para uma tabela filha de `youtube_intelligence_tasks`: é nível 3, e `competitor_cascade_counts` **lança** de propósito; a Tarefa 1 estende a função para três níveis antes de seguir. Tabela que o repositório não conhece: anotar e parar |
| CP5 | `select task_type, status, count(*), max(started_at) from youtube_intelligence_tasks where task_type <> 'diagnostico' group by 1, 2 order by 1, 2; select count(*) from competitor_readings where video_id is not null;` | Diz se `leitura-video` é usada. Zero tarefas com alvo: a recusa fica provada só por teste e isso vai em "o que nenhum teste prova" como não visto em produção |
| CP6 | `select count(*) filter (where thumb_blob_url like '%/observatorio/thumbs/%') as no_prefixo, count(*) filter (where thumb_blob_url not like '%/observatorio/thumbs/%') as fora, count(*) as total from competitor_video_versions where thumb_blob_url is not null; select count(*) from competitor_videos where thumbnail_url like '%blob.vercel-storage.com%' or original_thumbnail_url like '%blob.vercel-storage.com%';` | (emenda 1: S-m3; a frase anterior dizia "nada muda no código" e contradizia a Tarefa 5) A Tarefa 5 **recusa** URL que não contém `/observatorio/thumbs/`: com `fora > 0` essas URLs ficariam em `blobs_pending` para sempre e o cron ficaria vermelho depois de 24 h. Então, com `fora > 0`: parar antes da Tarefa 5 e fechar com o controlador a forma aceita (a regra da Tarefa 5 passa a aceitar a forma real medida, com teste). Com `fora = 0` (o esperado: há um escritor só, `thumb-fingerprint.ts:104`), nada muda; a saída para uma entrada recusada que apareça depois é o comando K7 da seção 11, que o dono cola. Segunda consulta maior que 0: há arquivo do Blob apontado pela linha do vídeo que nenhuma versão cita; a Tarefa 2 acrescenta essas duas colunas à lista de URLs da função |
| CP7 | `select count(*) as leituras_de_nicho from competitor_readings where video_id is null; select count(*) as citam_video from competitor_readings r where r.video_id is null and exists (select 1 from competitor_videos v where r.sent::text like '%' \|\| v.video_id \|\| '%' or r.evidence::text like '%' \|\| v.video_id \|\| '%');` e (emenda 1: D-M1) `select count(*) as pacotes_de_nicho, count(*) filter (where exists (select 1 from competitor_videos v where t.sent::text like '%' \|\| v.video_id \|\| '%')) as pacotes_citam_video from youtube_intelligence_tasks t where t.target_video_id is null and t.sent is not null;` | `citam_video > 0` confirma o resíduo (pergunta 4 ao dono). O padrão não muda: a linha no painel é verdadeira nos dois casos. `pacotes_citam_video > 0` confirma o segundo resíduo (o pacote enviado à forja, guardado em `youtube_intelligence_tasks.sent`, que a cascata não alcança nas tarefas de nicho): a linha do painel já o cobre (desvio 8) |
| CP8 | `select rolname, rolconfig from pg_roles where rolname in ('service_role','authenticator','authenticated','anon');` | Se `service_role` (ou `authenticator`, de quem ele herda a sessão) tiver `statement_timeout` de 8 s ou menos e a CP9 mostrar canal com mais de 100 mil linhas filhas: "apagar canal" pode estourar (a transação volta inteira, nada é apagado, a tela mostra `tempo_esgotado`). (emenda 1: D-I4 e S-I6; o conserto que estava aqui, `set local statement_timeout` dentro do corpo, **não funciona**: o Postgres arma o relógio no começo do comando, e a chamada inteira da função é um comando só) O teto passa a ser cláusula da própria definição de `competitor_video_purge` e `competitor_channel_purge` (`set statement_timeout = '30s'`, já no Apêndice A, sem condição). Que o PostgREST aplica essa cláusula antes de chamar é **afirmação dos dois revisores, não medida**: a Tarefa 1 (passo 5) prova pela API local; se a prova falhar, a cláusula fica inofensiva e a saída vai ao dono como pergunta, com os números da CP9 (a tela continua dizendo `tempo_esgotado`, nada é apagado) |
| CP9 | para o maior canal: `select c.channel_name, (select count(*) from competitor_videos v where v.competitor_channel_id = c.id) as videos, (select count(*) from competitor_video_daily d join competitor_videos v on v.id = d.video_id where v.competitor_channel_id = c.id) as dias, (select count(*) from competitor_video_versions x join competitor_videos v on v.id = x.video_id where v.competitor_channel_id = c.id and x.thumb_blob_url is not null) as miniaturas from competitor_channels c order by 2 desc limit 3;` | Fecha a conta da seção 5 (tempo do `delete` e quantos disparos o Blob leva). Canal com mais de 2.000 vídeos: o teto de 2.000 prefixos por item (Tarefa 5) corta, e o resto fica em `blobs_pending`. (emenda 1: D-I4) Esta consulta conta só três tabelas e vale como piso. A conta inteira, por catálogo, é `select public.competitor_cascade_counts('canal', '<id do maior canal>');` (depois da MG-E9; no banco de integração já na Tarefa 1), e é ela que fecha a conta da seção 5 |
| CP10 | `select tablename, policyname, cmd, qual from pg_policies where tablename = 'competitor_removed_items'; select relrowsecurity from pg_class where oid = 'public.competitor_removed_items'::regclass;` | Esperado: uma policy `SELECT` com `can_edit_site(site_id)` e `true`. Repetir depois da MG11 (lote C): se ela trocar a policy, avisar (a fila é de quem edita, não de quem tem o direito de desempenho privado) |
| CP11 | no banco de integração (porta 54422): `select to_regclass('public.competitor_video_comments'), to_regclass('public.competitor_video_hourly'), to_regclass('public.competitor_removed_items');` | Algum `null`: o controlador aplica as migrations pendentes no `bythiago_int` antes da Tarefa 1 (nunca `db:reset`) |
| CP12 | `grep -rn "delete from public.competitor_\|delete from competitor_" supabase/migrations/ \| grep -v "^supabase/migrations/2026101[23]"` e o mesmo sem o filtro, no dia da Tarefa 11 | A lista de funções SQL que apagam de tabela `competitor_*` hoje é: `competitor_agenda_lease` (soltar o arrendamento, MG10) e `competitor_video_comment_authors` (identidade aos 28 dias, MG8). Se outra etapa tiver criado mais uma, ela entra na lista fechada do teste da Tarefa 11 com a linha de 9.2 que a autoriza |
| CP13 | (emenda 1: D-I4 e S-I6) no banco de integração (porta 54422), coluna de chave estrangeira **sem índice** que a cascata ou o `set null` percorrem: `select k.conrelid::regclass as tabela, a.attname as coluna, k.confdeltype from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1] where k.contype = 'f' and k.confrelid in ('public.competitor_videos'::regclass, 'public.competitor_channels'::regclass, 'public.competitor_video_versions'::regclass, 'public.competitor_video_comments'::regclass) and not exists (select 1 from pg_index i where i.indrelid = k.conrelid and i.indkey[0] = k.conkey[1]) order by 1, 2;` | Os revisores apontam, por leitura, `competitor_changes.video_id`, `competitor_changes.from_version_id` e `to_version_id`, `youtube_intelligence_tasks.target_video_id` e `competitor_readings.video_id`; eu não confirmei (a busca por texto não enxerga índice declarado em várias linhas). Regra de decisão, escrita antes da resposta: coluna sem índice em tabela com mais de 10.000 linhas na CP14 ganha `create index if not exists` na MG-E9 (a Tarefa 1 acrescenta ao Apêndice A, corrige a nota "nenhum índice novo" e a frase da janela da seção 2); com menos, fica como está e o número vai ao ledger. Nenhuma linha: nada muda |
| CP14 | (emenda 1: D-I4 e S-I6) `select (select count(*) from competitor_changes) as mudancas, (select count(*) from youtube_intelligence_tasks) as tarefas, (select count(*) from competitor_readings) as leituras, (select count(*) from competitor_video_daily) as dias, (select count(*) from competitor_video_hourly) as horas;` | Dá o tamanho das tabelas que a CP13 pode apontar, e a base da estimativa de tempo de "apagar canal" (seção 5) |
| CP15 | (emenda 1: S-I4) `select count(*) from competitor_channel_snapshots s join competitor_channels c on c.id = s.competitor_channel_id where c.missing_since is not null and s.snapshot_date < current_date - 365;` | Maior que zero: a poda de 365 dias do `ab-watchdog`, que **já está em produção**, pode apagar retrato de canal ausente no próximo disparo dela; a mudança do `ab-watchdog` (Tarefa 11) sai junto com o **Envio A**, em commit próprio, em vez de esperar o Envio B. Zero: vai no Envio B |
| CP16 | (emenda 1: D-M2) `grep -rn "createNotification" apps/web/src/lib/youtube` | Hoje há uma ocorrência (`competitor-sync.ts:1321`), que grava o **nome do canal** no título da notificação. Outra ocorrência com nome de canal ou título de vídeo: entra na mesma linha do painel (desvio 8) |
| CP17 | (emenda 2: m-N3) `grep -n "abortSignal" node_modules/@vercel/blob/dist/index.d.ts` (na raiz do repositório; não consegui ler o arquivo nesta sessão) | Se `del` e `list` aceitarem `abortSignal`: a Tarefa 5 passa a cada chamada um `AbortSignal.timeout` do mesmo tamanho do teto da chamada, e a chamada pendurada é de fato cortada. Se não aceitarem: fica só a corrida contra o prazo (`comPrazo`), que devolve o controle mas deixa a chamada viva até a função morrer; isso vai escrito em "o que nenhum teste prova" |
| CP18 | (emenda 2: m-N2) `grep -n "recordCronFailure\|recordCronSuccess\|problems\|notes\|prova" apps/web/test/integration/agenda-despacho.test.ts` e, com a MG-E9 aplicada no `bythiago_int`, rodar só esse arquivo depois do commit da Tarefa 8 | O arquivo é da E16 e roda `executarAgenda` de verdade contra o banco de integração (li: ele afirma `recordCronFailure` chamado uma vez na linha 908 e frases de prova nas linhas 742 a 759; não li se algum caso afirma verde com site na lista). Todos verdes com a MG-E9 aplicada: nada muda. Algum caso cai por causa de nota ou problema novo da prova dos ausentes: a Tarefa 8 **para e avisa o controlador** (o arquivo é de outra etapa; não se edita sem ele) |

### 0.4 Avisos de topo
- **Texto de terceiros.** Título de vídeo, texto de comentário, nome e id de autor **nunca** vão para `audit_log`, para o Sentry (C0.9: o Sentry não limpa texto livre nem `extra`), para nota de cron nem para `competitor_removed_items`. O id de comentário do YouTube é dado sensível (spec `07:69`): fica só em `competitor_removed_items.youtube_id`, legível por quem edita o site, e não entra na auditoria.
- **As migrations só vão ao dono depois do acordo dos dois especialistas** (decisão 45a). O arquivo da migration não é criado antes da vez do lote (`db:new` carimba pela hora).
- **Tudo o que este plano avisa ao dono é o cron de concorrentes vermelho ou a própria tela.** Não há e-mail, push nem sino (regra 4.5 e R10 dos planos anteriores).
- **Nenhum ensaio grava em produção.** `apps/web/.env.local` aponta para produção: nenhuma tarefa roda script que o carregue. Teste de integração só contra `bythiago_int` (API 54421, banco 54422).

---

## 1. Perguntas que só o dono responde

Nenhuma trava o início. Cada uma tem o padrão que vale se ele não responder (decisão 44).

1. **O número da aba soma o que espera você, o que está apagando e o que voltou ao ar?** O desenhista leu assim (7 = 5 + 2 no caso cheio; `AJUSTES-UX-2.md`, E3) e o mockup aprovado mostra isso. Recomendo manter. **Padrão:** soma os três, como no mockup. Trava: nada (é uma linha em `saiu/modelo.ts`).
2. **Apagar pela fila um canal inteiro não exporta nada antes?** O spec se contradiz: 4.5 diz que é a única exceção à regra de exportar; a lista de 9.2 diz que remoção de canal exporta. Recomendo a exceção (o motivo de apagar aqui é não ter mais o dado, e o export nem existe ainda). **Padrão:** não exporta; a regra de 9.2 fica para o fluxo "remover canal" de canal no ar, que é da E10. Trava: nada.
3. **Comentários que sumiram: um cartão por canal, com os vídeos listados dentro (como o mockup aprovado: "7 comentários de 2 vídeos"), ou um cartão por vídeo (como o texto do spec)?** Recomendo o do mockup (menos cartões, uma decisão por canal). **Padrão:** um cartão por canal; a resposta vale para os comentários que o painel mostrou, e só para eles. Trava: nada.
4. **Leitura de nicho da forja já publicada que cita um vídeo apagado (no texto ou na evidência) fica como está?** A cascata apaga as leituras **do vídeo**, não as do nicho que o citam. Reescrever leitura publicada é outro problema. Recomendo deixar e dizer no painel, na lista "O que não sai com o apagar". **Padrão:** fica; o painel ganha a linha "Leituras e pacotes de nicho da forja que citem este vídeo: o sistema não reescreve". Trava: nada (a CP7 mede quantas são). (emenda 1: D-M1 e S-m7) A mesma pergunta cobre dois casos que a primeira versão não dizia: o **pacote enviado** à forja numa tarefa de nicho (`youtube_intelligence_tasks.sent`), que fica guardado e a cascata não alcança; e a tarefa de nicho que está **em andamento** na hora do "apagar" (ela não tem vídeo alvo, então não bloqueia) e publica depois uma leitura que pode citar o vídeo.
5. **Quer que o sistema confira todo dia se um vídeo apagado e antigo voltou ao ar?** Hoje a volta só é percebida se o vídeo aparecer nas páginas de envios que a sincronização lê (os mais recentes). Conferir por id custa 1 unidade de cota por 50 vídeos apagados, mas é uma leitura a mais de algo que você mandou apagar. Recomendo não. **Padrão:** não confere; a ajuda da tela diz "só percebemos a volta de vídeo recente". Trava: nada.

---

## 2. O que é do dono

**Uma coisa: aplicar a migration desta etapa.** Nenhum agente roda `db:push:prod`.

| Passo | Quem | O quê |
|---|---|---|
| 0 | controlador | CP2 verde (E1 e E2 em `main`); CP1, CP3, CP4, CP6, CP8 lidas e anotadas no ledger `.superpowers/sdd/a5-e9/progress.md` |
| 1 | agente (Tarefa 7) | **Envio A**: a sincronização passa a consultar `competitor_removed_items`. Sem migration. Push em `staging`, CI, promoção a `main`. (emenda 1: S-I3) **Só depois** de todo commit local anterior que toca os arquivos da Tarefa 7 estar em `main`: em 13/10 são 18 commits não enviados em `competitor-sync.ts`, 13 no harness e 1 em `competitors/actions.ts` (na prática, lote B e A4 enviados). ~~Conferência do controlador, que tem de dar 0, por `git rev-list --count origin/main..<commit-pai-do-Envio-A>`~~ (reconciliação 13/10, emenda 3: I1) **Conferência do controlador, por conteúdo e não por contagem de commits; o código de saída tem de ser 0:** `git diff --quiet origin/main <commit-pai-do-Envio-A> -- apps/web/src/lib/youtube/competitor-sync.ts apps/web/test/youtube/competitor-sync-harness.ts apps/web/test/youtube/competitor-sync-a5.test.ts "apps/web/src/app/cms/(authed)/youtube/competitors/actions.ts"` (0 = tudo o que veio antes nesses arquivos já está em `main`; 1 = falta enviar alguma coisa). **A contagem por `rev-list` nunca dá 0 no envio por árvore de lote, que é o modo deste programa (regra 1 da seção 3 da reconciliação): o commit que chega a `main` é cópia com outro hash e o original nunca vira ancestral de `origin/main`. Medido em 13/10: `competitors/actions.ts` é igual em `origin/main` e no `staging` local, e a contagem dá 1.** Se a E9 tivesse de ir antes da A4: não vai; a Tarefa 7 fica commitada local e o Envio A espera ~~(não há cherry-pick: o diff não aplica sobre `origin/staging`)~~ **(emenda 3: I1) (o Envio A sobe por árvore de lote sobre `origin/staging`, só com o commit da Tarefa 7; com a conferência acima em 0 ele aplica limpo).** (emenda 2: I-N1) Antes do push: a suíte inteira verde (`npx vitest run`, em background, com a saída em arquivo; só as falhas entram no contexto) |
| 2 | controlador | conferência do Envio A (seção 11, A1) |
| 3 | controlador | avisa que chegou a vez desta migration (depois do acordo dos dois especialistas; lote indicado por ele) |
| 4 | agente (Tarefa 2) | `npm run db:new observatorio_a5_e9_apagar_o_que_saiu`, cola o Apêndice A (com o que a Tarefa 1 tiver corrigido), roda o roteiro de prova duas vezes, commit local |
| 5 | **dono** | `npm run db:push:prod` (digita `YES`) |
| 6 | agente | V1 a V4 em produção (só leitura; quem lê produção é o controlador), resultado no ledger |
| 7 | agente (Tarefa 13) | **Envio B**: prova no cron, servidor e tela. Promoção fora de 11:55 a 12:15 UTC e fora dos minutos :00, :20 e :40 |

**Nome para o `db:new`:** `observatorio_a5_e9_apagar_o_que_saiu`. Uma migration só. Não tem número na tabela de migrations do spec (MG1 a MG17); chamo de **MG-E9** e o controlador numera. **(reconciliação 13/10: R5) Numerada: MG18.** Onde este plano diz MG-E9, leia-se MG18. Ordem de aplicação: depois da MG6 (o registro do export de lá já traz a tabela daqui: R2) e, por hábito, depois da MG4; sozinha ou com outra aditiva; nunca com arquivo armado pendente (MG15, MG16, MG17).

**Janela.** A MG-E9 cria uma tabela vazia (`competitor_missing_baseline`), treze funções (emenda 1: eram onze; D-I2 e D-I3 acrescentaram duas, só de leitura) e nenhuma coluna em tabela existente. Se a CP13 mandar criar índice em tabela existente, a Tarefa 1 acrescenta aqui a frase da trava do `create index` (tabelas pequenas: milissegundos; acima de 100 mil linhas na CP14, parar e avisar o controlador antes de levar ao dono). O único contato com tabela quente é a criação das duas chaves estrangeiras da tabela nova (para `competitor_videos` e para `sites`): cada uma pede uma trava `SHARE ROW EXCLUSIVE` na tabela referenciada pelo tempo de criar a restrição numa tabela vazia (milissegundos), que espera as escritas em curso e segura as novas nesse intervalo. `set lock_timeout = '5s'` na primeira linha: se a sincronização estiver no meio de uma gravação longa, a migration falha rápido e é reexecutada (é idempotente). Aplicar fora dos minutos :00, :20 e :40 (cron de concorrentes) e, por hábito, fora de 11:55 a 12:15 UTC. **(reconciliação 13/10: R2, R10, R14)** (a) `competitor_missing_baseline` tem cascata para `competitor_videos`: sem entrada no registro do export da E10, o export e a remoção de canal arquivado passariam a recusar com `tabela_sem_export`. A entrada foi posta no Apêndice A do plano da E10 (22 entradas, tabela ausente é pulada); **esta migration não recria `obs_archive_registry()`**. Com a MG6 em produção, depois de aplicar roda-se a V2 de lá (esperado `{}` e `22`); se a chave da tabela mudar na Tarefa 1, avisar o controlador (a entrada de lá ordena por `video_id, missing_since`). (b) Antes do `db:new`: a fila do `db push`, `.superpowers/sdd/a5/fila-do-db-push.md` (reconciliação 13/10, emenda 1: S-m3), sem linha de "db push bloqueado" (reconciliação 13/10, emenda 4: p8, n5) **Arquivo ausente ou ilegível: parar e perguntar ao controlador; nunca tratar como fila vazia.**; janela comum da A5, fora de 11:30 a 13:00 UTC. (c) Se os testes `observatorio-a5-e17-p0-doze.test.ts` e `-reporter-banco.test.ts` (passo 0 da E17) existirem, a tabela nova é classificada nas listas deles no mesmo commit do arquivo.

**Convive com o código que está em `main`?** Sim, nos dois sentidos:
- **MG-E9 aplicada, código antigo:** inerte. Ninguém chama as funções, a tabela nova fica vazia, nenhuma função existente muda de corpo, assinatura ou privilégio (`competitor_channel_removal_impact` e `competitor_capture_health` **não** são recriadas).
- **Código novo sem a MG-E9:** o Envio A não depende dela (lê e carimba `competitor_removed_items`, que é da MG1). No Envio B, a guarda `schemaE9` (Tarefa 4) confere a tabela `competitor_missing_baseline` antes de tudo: sem ela, a aba mostra "a fila não pode ser lida: a migration desta etapa ainda não foi aplicada" (nunca "fila vazia"), nenhuma resposta é aceita, e o cron de concorrentes fica **vermelho** com `prova dos ausentes: schema ausente (MG-E9 não aplicada)`. Por isso a ordem é migration antes do Envio B.
- **MG-E9 sem a MG1, a MG2 ou a MG8:** recusa na primeira instrução com a mensagem "MG-E9 depende da …" e não cria nada.

**Volta.** Envio B: reverter os commits da lista e refazer o deploy (a aba some; o que foi apagado não volta, por desenho). A prova no cron tem interruptor próprio (`OBS_PROVA_AUSENTES=off`, seção 6). Envio A: reverter o commit (a sincronização volta a recoletar o apagado; só importa se já existir linha em `competitor_removed_items`, então reverter o A depois de um "apagar" real **exige** reverter o B antes). MG-E9: os comandos de `drop` estão no fim do Apêndice A, para o dono colar; só fazem sentido com o Envio B revertido.

### Consultas de conferência pós-aplicação (o resultado esperado é o do desenho; a Tarefa 1 roda as quatro no banco de integração e corrige aqui o que divergir)

**V1: a migration entrou inteira?** Esperado: `1, 1, 13, 0` (emenda 1: eram 11 funções).

```sql
select (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'competitor_missing_baseline' and c.relkind = 'r' and c.relrowsecurity) as tabela_com_rls, (select count(*) from pg_policies where schemaname = 'public' and tablename = 'competitor_missing_baseline' and cmd = 'SELECT' and qual like '%can_edit_site%') as policy_de_leitura, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('competitor_jsonb_sum','competitor_cascade_counts','competitor_purge_preview','competitor_video_purge','competitor_channel_purge','competitor_comments_purge','competitor_missing_keep','competitor_return_decide','competitor_removed_blobs_done','competitor_missing_proof','competitor_missing_count','competitor_comments_preview','competitor_removed_comment_groups') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute')) as funcoes_so_service_role, (select count(*) from public.competitor_missing_baseline) as linhas;
```

**V2: a contagem por catálogo enxerga as tabelas certas e não lança?** Esperado: um objeto com pelo menos as chaves `competitor_video_versions`, `competitor_video_daily`, `competitor_changes`, `youtube_intelligence_tasks`, `competitor_readings`, `competitor_field_versions`, `competitor_raw`, `competitor_video_early`, `competitor_video_tier_spans`, `competitor_video_hourly`, `competitor_hour_fold_log`, `competitor_video_comment_snaps`, `competitor_video_comments`, `competitor_video_comment_authors`, `competitor_video_comment_marks`, `competitor_missing_baseline`, todas com número. Chave a mais: é tabela nova de outra etapa (certo; ganha rótulo na Tarefa 3). Exceção "nível 3" ou "chave composta": ver CP4.

```sql
select public.competitor_cascade_counts('video', (select id from public.competitor_videos order by last_checked_at desc nulls last limit 1));
select jsonb_object_keys(public.competitor_cascade_counts('canal', (select id from public.competitor_channels limit 1)));
```

**V3: nada foi gravado nem apagado pela migration.** Esperado: `0` em `apagados` e em `linhas` (ou o valor da CP1, se já havia), e os totais de `competitor_videos` e `competitor_channels` iguais aos de antes (anotar antes de aplicar).

```sql
select (select count(*) from public.competitor_removed_items) as apagados, (select count(*) from public.competitor_missing_baseline) as linhas, (select count(*) from public.competitor_videos) as videos, (select count(*) from public.competitor_channels) as canais;
```

**V4: a prova roda (grava só o piso dos ausentes, se houver).** Esperado com a fila vazia: `videos_ausentes 0, linhas_de_ausentes 0, miniaturas_de_ausentes 0, ausentes_com_queda 0, pisos_novos 0, esperando 0, apagando 0, apagando_ha_mais_de_1d 0, voltaram_sem_resposta 0, mais_antigo_dias null` (dez chaves). É a única das quatro que escreve (uma linha de piso por vídeo ausente): roda no banco de integração; em produção quem a roda primeiro é o cron do Envio B.

```sql
select public.competitor_missing_proof((select site_id from public.competitor_channels limit 1), now());
```

---

## 3. Fatos de que o desenho depende

| # | Fato | Fonte |
|---|---|---|
| F1 | Em produção há 1 site e 1 conta; os filtros de site são defesa em profundidade, mas todos têm prova por mutação | memória do projeto (sub-sites são aspiracionais); regra do pedido |
| F2 | O cron de concorrentes roda a cada 20 minutos e já lê uma prova do banco a cada disparo, por site, com teto de tempo (`readProofWithin`, `PROOF_TIMEOUT_MS`) | `apps/web/vercel.json:39`; `app/api/cron/sync-youtube/route.ts:203-217`. (emenda 1: S-C1) Essa linha da rota é o caminho **antigo**: com a agenda ligada (o padrão desde a E16, código local que vai a `main` antes da E9) a rota retorna em `route.ts:92` e quem lê a prova é `fecharDisparo`, em `lib/youtube/agenda/fecho.ts:196`. A linha 215 só roda com `OBS_AGENDA=off` ou com a guarda da MG10 falhando. São **dois** caminhos, e a Tarefa 8 liga a prova nova nos dois |
| F3 | A sincronização insere vídeo novo num ponto só, no laço da página, depois de montar `existingMap` | `lib/youtube/competitor-sync.ts:1064,1121-1127` |
| F4 | Canal que some: a sincronização lança 404 antes de olhar os vídeos; os vídeos do canal ausente **não** ganham `missing_since` | `competitor-sync.ts:951-964` |
| F5 | A sincronização incremental para na primeira página com vídeo conhecido ou em `ceil(video_limit / 50)` páginas (`video_limit` padrão 50) | `competitor-sync.ts:331,1200` |
| F6 | `removeCompetitorChannel` apaga o canal por cascata, sem Blob, sem registro, sem auditoria | `app/cms/(authed)/youtube/competitors/actions.ts:152-169` |
| F7 | `addCompetitorChannel` só confere duplicata em `competitor_channels` | `actions.ts:98-107` |
| F8 | O teste `cache-writers.test.ts` reprova qualquer arquivo novo que escreva em `competitor_videos` sem estar em `KNOWN_WRITERS`, e conta as invalidações de `actions.ts` uma a uma | `test/youtube/observatorio/cache-writers.test.ts:16-56` |
| F9 | As abas do Observatório vêm de `buildChromeView`; as contagens das outras abas saem do pacote **em cache**; a fila não pode (a resposta tem de aparecer na hora) | `_chrome/view-model.ts:11-12,52-59` |
| F10 | `provarEdicao` só pode ser chamada pelos módulos que a varredura da A4 autoriza | `test/youtube/observatorio/proprio-varredura.test.ts:49` |
| F11 | Só duas bibliotecas apagam do Blob hoje, com `del(urls)` e `list({ prefix, cursor, limit })` de `@vercel/blob` 2.5.0 | `lib/instagram/deletion.ts:42-43`; `app/api/cron/media-cleanup/route.ts:70`; `apps/web/package.json:74` |
| F12 | Volume: 1.390 vídeos de concorrentes e 707 miniaturas no Blob (números do spec, 12/10) | spec `00`, risco 9 e fatos |
| F13 | O mockup aprovado tem dez casos (`cheia, vazia, confirmar, confirmar-pronto, confirmar-canal, confirmar-comentarios, apagar-mantido, recusa, apagando, voltou`) e três requisitos que não são desenho: 10 itens por vez com "Mostrar mais N", "Manter todos para análise", e o botão `disabled` de verdade | `mockups/2026-10-13-a5-lote-1/e.js`; `LEIAME.md:131-132` |
| F14 | Um comentário mantido que volta ao ar tem `missing_since` zerado pela MG8, mas **não** a decisão (`removal_decision` continua `'manter'`): se sumir de novo, não reentra na fila | `20261013000003…:319,351,376` (lido); dívida na seção 13 |

---

## 4. Desenho, no que difere de "copiar o que já existe"

**Uma transação por resposta, com a auditoria dentro.** As três funções de apagar (`competitor_video_purge`, `competitor_channel_purge`, `competitor_comments_purge`), a de manter (`competitor_missing_keep`) e a de "voltou" (`competitor_return_decide`) gravam a linha de `audit_log` **na mesma transação** da mudança. O spec fala em `set_audit_context`, que só serve a gatilho na mesma transação; o cliente de serviço faz cada chamada numa transação própria, então a auditoria por fora poderia faltar com o vídeo já apagado. IP e agente do usuário entram como parâmetros.

**A ordem dentro de "apagar vídeo"** (é o que fecha as corridas):
1. `select … for update` na linha do vídeo, com o filtro do site pelo canal. Enquanto a transação durar, ninguém insere linha filha nova (a inserção pede `KEY SHARE` na linha do vídeo e espera) nem atualiza o vídeo.
2. Vídeo que voltou ao ar entre a tela e o clique (`missing_since` nulo) devolve `no_ar` e nada é apagado.
3. `for update` em **todas** as tarefas da forja do vídeo. Um claim concorrente (que é um `update` da tarefa) ou já terminou (e a tarefa aparece `running`: recusa) ou espera aqui e, depois do `delete`, não acha a linha (o claim devolve "nada a fazer"). Tarefa `running` com `started_at` nos últimos `p_janela_min` minutos: devolve `forja_em_andamento`, nada apagado.
4. Conta por tabela (`competitor_cascade_counts`) com a linha travada, junta as URLs do Blob e o prefixo do vídeo.
5. `delete` da linha do vídeo (o resto vai por cascata), `insert … on conflict do update` em `competitor_removed_items`, `insert` em `audit_log`.

**A contagem é por catálogo, não por lista.** `competitor_cascade_counts` soma toda tabela presa por chave estrangeira com cascata à raiz (nível 1) e às filhas dela (nível 2), lendo `pg_constraint`. Tabela nova de outra etapa (a `competitor_video_marks` da MG4, por exemplo) entra sozinha, com o nome dela como chave. É a mesma escolha que o portão da E11 fez para `youtube_channel_removal_impact` (um corpo por catálogo, sem lista para envelhecer). Onde o catálogo não alcança (nível 3, chave composta), a função **lança**: prefiro "não foi possível contar, nada apagado" a uma contagem menor que a verdade. `competitor_channel_removal_impact` não é recriada nem chamada por este plano.

**A janela da recusa vem de um lugar só.** As funções recebem `p_janela_min`; o TypeScript passa `STALE_AFTER_MINUTES` (30). Um teste novo lê o arquivo do vigia e falha se `STALE_THRESHOLD_MINUTES` for diferente (hoje os dois são 30 por comentário, não por teste).

**Blob: depois do commit, com o pendente gravado antes.** A função devolve e grava em `blobs_pending` as URLs das miniaturas e um prefixo por vídeo (`observatorio/thumbs/<uuid>/`). O TypeScript apaga as URLs em lotes, depois lista e apaga cada prefixo (pega arquivo que nenhuma linha citava), e tira de `blobs_pending` o que confirmou (`competitor_removed_blobs_done`, atômica). O que falhar ou não couber no tempo fica em `blobs_pending`: o item é "apagando". O cron de concorrentes tenta de novo a cada disparo, com 5 s de teto (é o "a próxima tentativa conclui sozinha" do mockup), e fica **vermelho** se algum item estiver "apagando" há mais de 24 horas.

**A prova "sem resposta o dado fica" é por vídeo, com piso.** `competitor_missing_proof` conta, para cada vídeo ausente (ou de canal ausente), as linhas de série diária, das primeiras horas e de versões. Na primeira vez que vê o vídeo ausente, grava esse número em `competitor_missing_baseline` (o piso). Em toda execução seguinte, vídeo com menos linhas que o piso conta em `ausentes_com_queda`, e o cron fica vermelho. Vídeo apagado pelo dono some junto com o piso (cascata); vídeo que volta ao ar deixa de ser olhado. O total `linhas_de_ausentes` do spec também é devolvido, como número.

**A sincronização não depende da migration nova.** A consulta do apagado (Tarefa 7) usa só `competitor_removed_items` por PostgREST. Se ela falhar, os vídeos **novos** daquela página não são inseridos e a falha entra no erro do canal: na dúvida, não se recoleta o que pode ter sido apagado.

**Quem vê e quem responde.** Ver a fila: quem edita o site (`requireSiteScope` com `mode: 'edit'`, o critério da policy de `competitor_removed_items`). Responder: quem administra (`denyUnlessSiteAdmin`, o `canAdminSite` do spec), conferido **antes** de qualquer cliente de serviço. Quem só lê não vê a aba. As tabelas-fonte (`competitor_videos`, `competitor_channels`) têm policy de leitura `can_view_site`, então a restrição da fila é da camada de servidor, não da RLS delas (isso já era verdade para "saiu do YouTube" como estado: spec `07:66`).

**O que é um item.**

| Bloco da tela | Item | Critério |
|---|---|---|
| Esperando você | vídeo | `missing_since` preenchido, `removal_decision` nulo, e o canal dele **não** ausente |
| | canal inteiro | canal com `missing_since` preenchido e `removal_decision` nulo (um item; os vídeos dele não aparecem soltos, mesmo os que tinham `missing_since` próprio) |
| | comentários | um por canal: comentários com `missing_since` preenchido e decisão nula, de vídeo e canal que não estão ausentes |
| Voltaram ao ar | apagado que voltou | linha de `competitor_removed_items` com `returned_seen_at` preenchido e `return_decision` nulo, **sem** pendência de Blob (a que ainda está apagando aparece só no bloco "Apagando", com a linha "voltou ao ar em dd/mm", e passa para cá quando concluir: emenda 1: D-M9). Vídeo e canal: um item por linha. Comentários: **um item por canal** ("N comentários que você apagou voltaram a aparecer"), com uma resposta para o grupo (emenda 1: D-M10) |
| | mantido que voltou (só informa) | vídeo com auditoria `competitor_missing_keep` nos últimos 30 dias e `missing_since` nulo hoje |
| Apagando | apagamento incompleto | linha de `competitor_removed_items` com `blobs_pending` não vazio ou `archive_pending` |
| Já respondidos | mantido | vídeo, canal ou grupo de comentários com `missing_since` e `removal_decision = 'manter'` |
| | apagado | as demais linhas de `competitor_removed_items` (código e datas; comentário aparece como contagem por canal, sem o id) |

Contador da aba = esperando + apagando + apagados que voltaram sem resposta. (emenda 1: D-M9 e D-M10) Cada linha de `competitor_removed_items` conta **uma vez** (a que está apagando não conta de novo em "voltaram"), e comentários que voltaram contam um por canal. A regra existe em dois lugares que um teste compara: `competitor_missing_count` (SQL) e `contadorDaAba` (TypeScript).

---

## 5. As contas

**Chamadas à API do YouTube: zero a mais.** Nenhuma tarefa deste plano chama o YouTube. A cota do dia não muda.

**Banco, por disparo do cron de concorrentes (72 por dia):** uma chamada a `competitor_missing_proof` por site (1 site: 72 por dia). Ela varre os vídeos ausentes do site e conta três tabelas por vídeo, por índice de `video_id`. Com a fila em dezenas de vídeos, milissegundos. Pior caso plausível: um canal de 500 vídeos ausente, 1.500 contagens por índice, abaixo de 1 s; a prova roda dentro do teto que já existe (`readProofWithin`, `PROOF_TIMEOUT_MS`), e estouro vira `prova dos ausentes: não foi possível ler a prova a tempo (passou de N s)` (vermelho, nunca verde; emenda 1: D-M6: é a frase de `readProofWithin` com o prefixo que a Tarefa 8 acrescenta).

**Banco, por página lida na sincronização:** zero chamadas quando a página não traz vídeo novo (o caso de quase todo disparo). "Vídeo novo" é o id que `videos.list` **devolveu** e não está gravado (emenda 1: S-I1 e D-I1): o id que só a lista de envios cita não conta, então a frase vale também para o canal que tem vídeo apagado e ainda fora do ar. Com vídeo novo: um `select` em `competitor_removed_items` pela chave única (`site_id, kind, youtube_id`), e um `update` só se houver apagado na página.

**Banco, por página da tela:** 5 contagens para o número da aba em **toda** página do Observatório, para quem edita (uma função, `competitor_missing_count`, uma ida). Na aba: 9 leituras (emenda 1: D-I2; eram 6: a de `competitor_removed_items` virou três filtradas mais uma agregação em SQL, e toda leitura de lista é paginada de 1.000 em 1.000 com contagem exata) e uma prévia por item mostrado (`competitor_purge_preview` para vídeo e canal, `competitor_comments_preview` para o grupo de comentários), no máximo 10 por vez, em paralelo.

**Linhas novas.**

| Tabela | Por dia | Por ano | Nota |
|---|---|---|---|
| `competitor_removed_items` | 0 na maior parte dos dias | dezenas para vídeo e canal; para comentário, **uma por comentário apagado** (até 500 por resposta) | (emenda 1: D-I2) com poucos grupos grandes a tabela passa de 1.000 linhas, que é o teto de linhas por resposta da API (`supabase/config.toml:15`, `max_rows = 1000`): por isso o leitor nunca a lê inteira numa chamada só (Tarefa 4) |
| `competitor_missing_baseline` | uma por vídeo que entra em ausência | dezenas a poucas centenas | canal inteiro ausente: uma por vídeo dele (500 no pior caso plausível); some por cascata quando o vídeo é apagado |
| `audit_log` | uma por resposta | dezenas | manter em lote de vídeos: uma por vídeo; grupo de comentários: uma por grupo |

**Tempo de "apagar".** A página define `maxDuration = 60` (o mesmo das outras do Observatório). Dentro dela: a transação (um vídeo: dezenas a centenas de linhas filhas, milissegundos; o canal do exemplo do mockup: 13 vídeos e 2.318 dias, abaixo de 1 s; a CP9 dá o maior real) (emenda 1: D-I4: "abaixo de 1 s" vale para o exemplo do mockup, não para o maior canal em um ano. Estimativa dos revisores, **não medida**: um canal de 200 vídeos com um ano de série diária passa de 100 mil linhas filhas, cada uma apagada por gatilho de chave estrangeira, e coluna de chave sem índice faz cada vídeo apagado varrer a tabela inteira. Por isso as duas funções carregam o teto próprio de 30 s, a Tarefa 1 cronometra "apagar canal" com semente do tamanho da CP9, e a CP13 decide os índices. A soma fecha: 30 s da transação + 20 s do Blob < 60 s da página) e depois o Blob com **20 s de teto**: URLs em lotes de até 100 por chamada de `del`, depois um `list` por prefixo. Passou do teto: para, grava o que falta, responde "apagando: faltam N". O cron termina nos disparos seguintes, 5 s por disparo.

**Orçamentos acoplados que já existem** (`CLAUDE.md`, seção da forja): 20 min do claim < `timeout -k 30s 25m` do cron da forja < 30 min do vigia; o pulso corta em 70 min. Este plano acrescenta **um quarto dependente**: a janela da recusa = a do vigia (30 min), lida de `STALE_AFTER_MINUTES`. Quem mexer no vigia muda a recusa junto, e o teste da Tarefa 6 acusa se as duas constantes divergirem.

**Disparo do cron de concorrentes.** O orçamento do disparo não muda (`FUNCTION_LIMIT_MS`, `RECORD_RESERVE_MS`). A prova nova entra no **mesmo `Promise.all` por site** da prova que já existe, sob o mesmo `proofMs`, nos **dois** caminhos do cron (emenda 1: S-C1 e S-I2; a Tarefa 8 mandava rodar depois de `verdicts`, em sequência: seriam dois tetos de 20 s contra uma reserva dimensionada para um só (`FINISH_RESERVE_MS`), e o disparo passaria de 300 s sem gravar `cron_health`). A conclusão de apagamentos roda **depois** de `cron_health` gravado (nunca atrasa nem impede o registro), só se sobrarem pelo menos 8 s antes do limite da função menos 3 s de folga (`LIMITE_FUNCAO_MS` no caminho da agenda, `FUNCTION_LIMIT_MS` no lote antigo), e usa no máximo 5 s; sem tempo, não roda e o item continua "apagando" (visível na tela; vermelho só depois de 24 horas). (emenda 2: m-N3) "No máximo 5 s" passa a ter teto de verdade: dentro de `apagarDoBlob` cada chamada ao Blob corre contra o prazo que resta (uma chamada pendurada não segura o disparo), e a conclusão inteira corre contra 6 s nos dois caminhos do cron (6 s cabem nos 8 s exigidos).

---

## 6. O que acontece quando o dado não existe, e em cada falha

Interruptor: `OBS_PROVA_AUSENTES=off` desliga **só** a prova dos ausentes e a conclusão de apagamentos no cron (padrão: ligado; valor diferente de `off`, vazio ou variável ausente = ligado). Desligado nunca é verde mudo: nota em todo disparo, e a conferência `e9-religar-prova` cobra. **(reconciliação 13/10: R4) É variável da Vercel: só vale depois de um redeploy de produção (emenda I7 do plano da E11); custa um build e não é saída imediata. Religar, idem.** As respostas da tela não têm interruptor (spec `00:420`): a volta é reverter o envio.

| Situação | O que o código faz | O que o dono vê | Veredito / e-mail |
|---|---|---|---|
| MG-E9 não aplicada, código do Envio B no ar | `schemaE9` falha: leitor e ações não seguem; a prova não roda | aba: "a fila não pode ser lida: a migration desta etapa ainda não foi aplicada"; número da aba "?" | tela: erro escrito. Cron **vermelho**: `prova dos ausentes: schema ausente (MG-E9 não aplicada)`. Sem e-mail |
| A própria guarda de schema não consegue ler | não é "pronto": mesmo caminho de cima, com o texto "não foi possível conferir o schema" | idem | vermelho |
| Fila vazia e a última leitura boa dos canais tem menos de 24 h | lista vazia, com a hora da leitura mais recente (`max(last_ok_synced_at)` dos canais do site) | "Nenhum item esperando. Tudo o que você acompanha continua vindo do YouTube. Última leitura dos canais: hoje, às HH:MM" | verde |
| **Fila vazia e a última leitura boa tem mais de 24 h, ou nenhum canal foi lido** | não afirma que tudo continua no ar | "Nenhum item na fila, mas a última leitura dos canais foi em dd/mm às HH:MM: não dá para afirmar que nada saiu" (ou "ainda não houve leitura") | nota na tela (o vermelho dessa parada é do cron de concorrentes, que já existe) |
| Site sem nenhum canal de concorrente | lista vazia | "Você ainda não acompanha nenhum canal" | verde |
| Erro de banco ao ler a fila | o leitor devolve `{ estado: 'erro', codigo }`; nada é mostrado como vazio | "não foi possível ler a fila agora" e o número da aba vira "?" | tela: erro. Sentry com o código, sem título |
| A fila mudou entre duas páginas de uma leitura longa (só com mais de 1.000 linhas numa lista e uma gravação do cron no meio; emenda 2: N4) | as linhas trazidas não fecham com a contagem **da última página**: o leitor devolve `erro`, nunca uma lista com linha faltando | "não foi possível ler a fila agora. Recarregue a página" | tela: erro passageiro; a recarga resolve |
| Erro ao contar para a aba (qualquer página do Observatório) | `contarFila` devolve `null` | aba com "?" e `title` "não foi possível contar a fila" | nota |
| Usuário que só lê | o leitor não é chamado; a aba não é montada | não vê a aba; a URL direta responde "sem acesso" | nenhum |
| Usuário que edita mas não administra | vê a fila; as ações recusam antes do cliente de serviço | botões desabilitados, com "Só quem administra o site pode responder" | nenhum |
| A prévia de um item falha (função lança: nível 3, chave composta, erro de banco) | o item aparece **sem** a linha "Guardado" e sem o botão de apagar | "não foi possível contar o que há guardado deste item" | tela: erro no item; "Manter" continua disponível |
| Item sem título, sem miniatura ou sem contagem (nulo no banco) | cada campo nulo vira "não registrado"; `discovered_at` nulo vira "antes de dd/mm" (a data da MG1) | nunca "0 views" nem título vazio | nenhum |
| "Apagar" e o vídeo voltou ao ar no meio | a função devolve `no_ar` | "este vídeo voltou a vir do YouTube; nada foi apagado" | nota |
| "Apagar" com a forja lendo | `forja_em_andamento` | "A forja está lendo este vídeo agora. Tente de novo em até 30 minutos" | nota; nada apagado |
| "Apagar" e o item não é deste site ou não existe mais | `not_found` | "este item não está mais na fila" | nota |
| "Apagar comentários" e a lista mudou (um voltou, outro foi respondido) | `mudou`: nada apagado | "a lista mudou; confira de novo" e a tela recarrega | nota |
| Erro de banco no meio de "apagar" (inclui chave que impede, tempo esgotado, impasse de travas) | a transação volta inteira: nenhuma linha apagada, nenhum registro, nenhuma auditoria | "não foi possível apagar; nada foi apagado" com o código (`impedido_por_tabela`, `tempo_esgotado`, `impasse`, `erro_de_banco`) | tela: erro. Sentry com código e ids |
| Banco apagou, Blob falha (rede, 500, token ausente) | `blobs_pending` fica como a função gravou, menos o que deu certo | "Apagando: faltam N miniaturas no Blob" e "Tentar de novo" | nota; **vermelho no cron depois de 24 h** |
| Banco apagou, Blob sem tempo | idem | idem | idem |
| `BLOB_READ_WRITE_TOKEN` ausente, ou servidor de teste de navegador (`OBS_E2E=1` fora de produção: emenda 1: S-I5) | o apagamento do Blob não é tentado; nada sai de `blobs_pending` | "Apagando: o Blob não está configurado neste ambiente" | idem |
| `list` do prefixo falha mas as URLs foram apagadas | o prefixo fica em `blobs_pending` | "Apagando: falta conferir N pastas de miniatura" | idem |
| A gravação do "o que já foi apagado no Blob" falha | o item continua com tudo pendente; a próxima tentativa apaga de novo (apagar o que não existe não é erro) | "Apagando" | idem |
| Sincronização: a consulta do apagado falha | os vídeos novos da página não são inseridos; o erro entra no erro tardio do canal | canal com erro no popover de frescor | vermelho pelo caminho que já existe (lote com erro) |
| Sincronização: vídeo apagado reaparece **em `videos.list`** | não insere; carimba `returned_seen_at` na primeira vez | item em "Voltaram ao ar" | conta no número da aba |
| Sincronização: a lista de envios ainda cita o apagado, mas `videos.list` não o devolve (o caso comum de vídeo privado; emenda 1: S-I1 e D-I1) | não insere e **não** carimba a volta: o vídeo não voltou | nada | nenhum |
| "Voltar a acompanhar" de um vídeo que já saiu das páginas de envios lidas (emenda 1: S-m6) | a decisão é gravada; o vídeo só entra se aparecer numa página lida | a resposta diz: "Entra de novo na próxima leitura do canal, se ainda estiver entre os vídeos mais recentes" | nota; declarado no risco 2 |
| Vídeo apagado e antigo volta, fora das páginas lidas | ninguém percebe | nada | **não detectado** (declarado na seção 13 e na ajuda da tela) |
| Prova: função falha, não responde a tempo, devolve forma errada ou chave faltando | nunca vira "0 quedas" | cron | **vermelho**: `prova dos ausentes: não foi possível ler` (no estouro de tempo: `prova dos ausentes: não foi possível ler a prova a tempo (passou de N s)`; emenda 1: D-M6) |
| Prova: `ausentes_com_queda > 0` | nenhum | cron | **vermelho**: `N vídeos fora do ar perderam linhas sem resposta de apagar`. Fica vermelho até o dono rodar o comando de ajuste do piso, **depois** de investigar a queda (o comando está escrito: K6, seção 11; emenda 1: D-M5). Sem e-mail |
| Prova: `apagando_ha_mais_de_1d > 0` | nenhum | cron | **vermelho**: `N itens apagando há mais de 1 dia` |
| Prova: há item esperando resposta | nenhum | nota: `N itens esperando resposta na fila (o mais antigo há D dias)` | **nota**, nunca vermelho: sem resposta o dado fica |
| Prova desligada pela variável | não roda | nota em todo disparo: `prova dos ausentes desligada (OBS_PROVA_AUSENTES=off)` | nota; conferência com data cobra |
| Site com canais mas nenhum ausente | a prova devolve zeros e `mais_antigo_dias` nulo | nada | verde |
| "Manter todos" com mais itens do que a tela mostrou | a ação recebe os ids que a tela **mostrou**; os outros ficam | "N mantidos; ainda há M na fila" | nenhum |
| Readicionar um canal que foi apagado | a ação adiciona e, **depois** do `insert` bem-sucedido, registra a volta (`return_decision = 'voltar'`); sem vaga ou com falha no `insert`, nada é registrado (emenda 1: S-m1) | "Você apagou este canal em dd/mm; ele entra de novo como novo, sem o histórico" | nota |
| "Remover canal" (fluxo antigo) num canal que está na fila | recusa | "Este canal saiu do YouTube: responda na aba Saíram do YouTube" | nota |
| "Remover canal" (fluxo antigo) num canal **no ar** que tem vídeo ou comentário esperando resposta na fila (emenda 1: D-M7) | recusa: sem ela os itens sumiriam da fila sem auditoria, sem linha em `competitor_removed_items` e com as miniaturas públicas no Blob sem registro (e o piso iria junto por cascata, então a prova não acusaria) | "Este canal tem N itens esperando resposta na aba Saíram do YouTube: responda primeiro" | nota |
| A prova cruza com um "apagar" do mesmo vídeo (o piso é inserido enquanto o vídeo é apagado; emenda 1: D-M4 e S-m5) | a função tenta de novo, já sem o vídeo; só lança se falhar três vezes seguidas (emenda 2: N3: eram duas tentativas e só a falha de chave era tratada; o impasse de travas com "apagar canal" passa a ser evitado pela ordem de inserção do piso e, se ainda acontecer, tratado do mesmo jeito) | nada | verde; a terceira falha seguida é vermelho "não foi possível ler" (um disparo isolado: conferir o seguinte, está no runbook) |
| Site que ficou **sem canal na lista da prova** e tem item "apagando" (emenda 1: S-m4) | a conclusão de apagamentos lê os sites de `competitor_removed_items` com pendência, não da lista de canais, e continua tentando; a prova (e o vermelho de 24 h) **não** roda para esse site | o item continua em "Apagando" na aba, com "Tentar de novo" | **não fica vermelho** (declarado no risco 12) |
| Canal ausente sem resposta com retratos diários de mais de 365 dias (emenda 1: S-I4) | a poda do `ab-watchdog` passa a pular canal com `missing_since`; se não conseguir ler quais são, ou se houver mais de 150 canais ausentes, **não poda nada** naquele disparo (emenda 2: N5) | nada | (emenda 2: m-N7) além do `console.error`, a resposta do `ab-watchdog` ganha o campo `poda_retratos` com `ok: false` e o motivo; o `ab-watchdog` continua registrando sucesso (poda parada não perde dado) |

---

## 7. Simulação do dia do deploy e dos seguintes

Suposições: E1 e E2 em `main` desde o dia E; Envio A em A; MG-E9 aplicada; Envio B em D.

- **E a E + 1.** O código da E1 começa a marcar. A segunda leitura seguida sem o item (com pelo menos 3 horas entre as duas) grava `missing_since`. Um vídeo que sumiu antes de E só entra na fila no segundo dia. Nada disso depende deste plano.
- **A.** A sincronização passa a consultar `competitor_removed_items`. A tabela está vazia: nenhum efeito visível. Conferência A1: nenhum erro "conferir os vídeos já apagados" no retorno do cron.
- **Migration.** V1 a V3. Código antigo: nada muda.
- **D, primeiro disparo depois do deploy.** A prova roda. Para cada vídeo já ausente grava o piso (`pisos_novos` = número de ausentes) e devolve `ausentes_com_queda = 0`. Se a fila tiver itens: nota com a contagem e o mais antigo. A aba aparece para quem edita, com o número.
- **D, o dono abre a aba com a fila vazia.** Vê o estado vazio com a hora da última leitura. É o estado normal.
- **Primeiro "apagar" real.** O dono lê o painel (o que some, o que fica), digita APAGAR. Um vídeo: transação curta, 1 a 3 miniaturas apagadas na hora, item em "Já respondidos" como apagado. A conferência `e9-primeiro-apagar` (sem data: é por evento) manda o controlador rodar a consulta K2 da seção 11.
- **Blob fora do ar na hora.** O item fica em "Apagando (1): faltam 3 miniaturas". Vinte minutos depois o cron tenta, conclui, e o item passa a apagado. Se ficar 24 horas: cron vermelho.
- **Vídeo apagado volta a vir em `videos.list`** (não basta a lista de envios citar o id: emenda 1: S-I1 e D-I1). A sincronização não o insere e carimba a volta. A aba mostra "Voltou ao ar em dd/mm · você apagou em dd/mm", só com o código. "Voltar a acompanhar": na sincronização seguinte ele entra como novo, se ainda estiver numa página de envios lida (emenda 1: S-m6). "Ignorar": não pergunta de novo.
- **Dono não responde por 60 dias.** Nada é apagado. A nota do cron diz há quantos dias o mais antigo espera. A prova continua comparando com o piso.
- **Alguma rotina futura apaga série de vídeo ausente por engano.** No disparo seguinte: `ausentes_com_queda > 0`, cron vermelho com a contagem.
- **Um dia sem cron.** Nada se perde: o piso é por vídeo e não depende do dia.
- **Reversão do Envio B com item "apagando".** A linha de `competitor_removed_items` fica com `blobs_pending`; ninguém mais tenta. O comando de conferência K3 lista o que ficou, para o dono decidir (ou reenviar).

**Conferências com data** (entram em `lib/conferencias.ts` no commit do Envio B, no molde de E1 e E2: constante `E9_DEPLOY: string | null`, função `conferenciasE9(deploy)`, `etapa: 'E9'`; a mesma lista em `.superpowers/sdd/a5/conferencias-com-data.md`):

| id | Quando | O que e o valor esperado |
|---|---|---|
| `e9-d0` | D | retorno do primeiro disparo do cron de concorrentes depois do deploy: o campo `prova_ausentes` **presente**, com as dez chaves da prova (emenda 1: S-C1: "sem problema novo" passava verde justamente quando a prova não rodava; campo ausente = a prova não está ligada naquele caminho = falha da conferência); `prova` sem problema novo; nota da prova coerente com a CP1; K1 (seção 11): `pisos` = vídeos ausentes; aba aberta pelo controlador nos dois temas; se CP1 tinha ausente, o painel de um item real lido **sem** confirmar |
| `e9-d1` | D + 1 | K1 de novo: `ausentes_com_queda = 0`; K3: nenhum item "apagando"; nenhum erro "conferir os vídeos já apagados" em 72 disparos |
| `e9-d7` | D + 7 | K1; K4 (ausentes por idade): quantos esperam há mais de 7 dias (número para o dono, não falha); se houve "apagar": K2 daquele item |
| `e9-d30` | D + 30 | K1; K5: toda linha de `competitor_removed_items` tem auditoria; CP5 de novo (a recusa foi exercida alguma vez?); CP10 de novo se a MG11 entrou |
| `e9-religar-prova` | 3 dias depois de desligar, **só se** `OBS_PROVA_AUSENTES=off` for usado | religar e conferir K1 |

---

## 8. Desvios do texto do spec e do mockup aprovado, com o motivo

Os de número 1 a 9, o 22 e o 23 mudam o que o mockup aprovado mostra ou escreve: são **divergências declaradas**, que o `revisor-ux-senior` confere na Tarefa 12 (rito 6.5(d): divergência não declarada é achado).

1. **"Tente de novo em até 30 minutos"**, não 20 (C0.12; seção 0.1). Vale para o texto da recusa.
2. **Fila longa:** 10 itens por vez, "Mostrar mais N" (um link que recarrega com `?mostrar=20`), e "Manter todos para análise" no resumo (vale para os itens mostrados). Requisito do `LEIAME.md` do mockup.
3. **"Apagar para sempre" é `<button disabled>`** até o campo valer `APAGAR` (aceita minúsculas e espaços nas pontas); foco no campo ao abrir; Esc fecha e devolve o foco.
4. **Estado vazio com duas frases**, conforme a idade da última leitura (seção 6). O mockup só tem a primeira ("Última conferência: hoje, às 12:20"); afirmar "tudo continua vindo" com a leitura parada seria falha em verde.
5. **Três estados que o mockup não desenhou:** número da aba "?" (contagem indisponível), fila ilegível (erro ou migration ausente), e botões desabilitados para quem edita mas não administra.
6. **Item sem a linha "Guardado"** quando a prévia falha, sem botão de apagar (seção 6).
7. **"Voltou ao ar" de comentário só oferece "Não perguntar de novo"** (grava `ignorar`). A escrita de comentários da MG8 nunca regrava um comentário apagado, qualquer que seja a resposta; oferecer "voltar" seria um botão que não faz nada. Mudar isso é mexer em `apply_competitor_comment_snap`, da E14 (dívida).
8. **Painel, lista "O que não sai com o apagar":** ganha a linha "Leituras e pacotes de nicho da forja que citem este vídeo: o sistema não reescreve" (pergunta 4; emenda 1: D-M1), a linha "Notificações antigas do sino que citam o nome do canal: ficam" no painel de **canal** (emenda 1: D-M2: `competitor-sync.ts:1326` grava o nome do canal no título da notificação, e o painel aprovado dizia "o que fica: só o código"; apagar notificação é de outro módulo e fica na dívida), e a linha do NAS passa a "Cópias no arquivo do NAS: nenhuma (a exportação para o NAS ainda não existe)".
9. **Bloco "Apagando" sem os botões "Ver os comandos" e "Já rodei"**, e sem a linha de exemplo do NAS: `archive_pending` é sempre falso até a E10. A frase do resumo "1 espera você rodar os comandos no NAS" não aparece.
10. **Comentários agrupados por canal** (mockup), não por vídeo (texto do spec): pergunta 3.
11. **Assinatura de `competitor_video_purge`:** o spec dá `(p_site, p_video, p_actor)`; ficam seis parâmetros (mais `p_janela_min`, `p_ip`, `p_ua`). Motivos: a janela vem de um lugar só, e a auditoria é gravada na transação.
12. **Auditoria dentro da função, sem `set_audit_context`** (seção 4). As ações são as do spec: `competitor_missing_keep` e `competitor_missing_purge`; mais duas para a volta: `competitor_return_follow` e `competitor_return_ignore`.
13. **Mais funções do que o spec nomeia:** canal inteiro e grupo de comentários têm função própria; contagem, prévia, manter, volta, pendência do Blob, prova e contador também. O spec só nomeia a do vídeo.
14. **A contagem não usa `competitor_channel_removal_impact`** (o spec diz que ela "mostra a contagem"): ela não conta leituras, tarefas, comentários nem ritmo por hora de forma completa, e é corpo de outro plano. A contagem daqui é por catálogo e inclui as duas tabelas que a v2.3 mandou incluir.
15. **A prova em produção é por vídeo, com piso, e não "o total caiu sem decisão no dia"** (item 67). O total cai de forma legítima quando um vídeo volta ao ar; por vídeo, a queda é sempre perda. Custa uma tabela pequena (`competitor_missing_baseline`). O total `linhas_de_ausentes` continua no retorno.
16. **A prova mora no cron de concorrentes** (a cada 20 minutos), não num "cron diário": é onde a prova da captura já roda por site.
17. **Interruptor que o spec não lista** (`OBS_PROVA_AUSENTES`): o spec diz que a E9 não tem variável (item 245). A variável desliga só a prova no cron, para um defeito dela não deixar vermelho, a cada 20 minutos, o cron que carrega as outras provas. As respostas continuam sem interruptor.
18. **"Apagar" só vale para item com `missing_since`.** Vídeo ou canal no ar devolve `no_ar`. O spec não diz; a fila é do que saiu, e a remoção de canal no ar é outro fluxo.
19. **Readicionar um canal apagado é a resposta "voltar"** (não há item "voltou ao ar" para canal: ninguém lê um canal que foi removido).
20. **Item 68, a pastilha nas outras telas, e a frase das medianas:** ficam com a E5 e a E4. Aqui o item 68 é cumprido na decisão, na auditoria e na linha "Mantido" da própria aba.
21. **Item 231:** este plano entrega a linha 1 da lista e uma varredura dos arquivos e funções que ele cria; o teste geral é da E10.
22. **(emenda 1: D-M10) Comentários apagados que voltam aparecem como um item por canal** em "Voltaram ao ar" ("N comentários que você apagou voltaram a aparecer"), com um botão "Não perguntar de novo" para o grupo. A MG8 carimba a volta comentário a comentário; sem agrupar, sete comentários seriam sete cartões e sete cliques.
23. **(emenda 1: D-I3) O painel de comentários conta também a resposta do criador que vai junto:** "3 comentários e 1 resposta do criador", e as marcas e identidades da resposta entram nos números. A função leva a resposta por cascata; mostrar só os 3 seria contar menos do que some.

---

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`, salvo os que começam por `supabase/`, `docs/` ou `.superpowers/`. "Novo" = criado por esta etapa. A lista de cada tarefa é **fechada**: se precisar de outro arquivo, a tarefa para e avisa.

| T | O que | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 1 | Ensaio do SQL no banco de integração | `.superpowers/sdd/a5-e9/sql/mg-e9.sql`, `prova.sql`, `prova-saida.txt` (novos); este plano (Apêndice A e seção 2, só para corrigir) | CP11 | 3, 5, 7 |
| 2 | Arquivo da migration e testes de migration, RLS e corrida. **Só na vez do lote** | `supabase/migrations/<carimbo>_observatorio_a5_e9_apagar_o_que_saiu.sql` (novo, por `db:new`); `test/integration/observatorio-a5-e9-migration.test.ts`, `…-e9-rls.test.ts`, `…-e9-corrida.test.ts` (novos) | 1; aviso do controlador | as demais, menos a 12 |
| 3 | Modelo puro da fila | `src/lib/youtube/observatorio/saiu/modelo.ts`, `saiu/rotulos.ts` (novos); `test/youtube/observatorio/saiu-modelo.test.ts`, `saiu-rotulos.test.ts` (novos) | nada | 1, 5, 7 |
| 4 | Guarda de schema, contador e leitor da fila | `src/lib/youtube/observatorio/saiu/schema.ts`, `saiu/contar.ts`, `saiu/ler-fila.ts` (novos); `test/youtube/observatorio/saiu-ler-fila.test.ts`, `saiu-contar.test.ts`, `saiu-fake-supabase.ts` (novos) | 3; contrato do Apêndice A | 5, 6, 7, 8 |
| 5 | Apagar do Blob | `src/lib/youtube/observatorio/saiu/blob.ts` (novo); `test/youtube/observatorio/saiu-blob.test.ts` (novo) | nada | todas |
| 6 | Serviço das respostas | `src/lib/youtube/observatorio/saiu/responder.ts` (novo); `test/youtube/observatorio/saiu-responder.test.ts`, `saiu-janela-forja.test.ts` (novos) | 3, 5; contrato do Apêndice A | 4, 7, 8 |
| 7 | **Sincronização consulta o apagado** (D-11; Envio A) | `src/lib/youtube/competitor-removed.ts` (novo); `src/lib/youtube/competitor-sync.ts`; `src/app/cms/(authed)/youtube/competitors/actions.ts` (**só** `addCompetitorChannel`); `test/youtube/competitor-removed.test.ts` (novo); `test/youtube/competitor-sync-harness.ts`; `test/youtube/competitor-sync-a5.test.ts` | para escrever: `competitors/actions.ts` limpo no `git status` e aviso do controlador. Para enviar (emenda 1: S-I3): E1 e E2 em `main` **e** todo commit local anterior nos arquivos desta tarefa em `main` (seção 2, passo 1) | 1, 3, 5 |
| 8 | Prova no cron e conclusão de apagamentos | `src/lib/youtube/competitor-missing-proof.ts` (novo); `src/app/api/cron/sync-youtube/route.ts` (o lote antigo); `src/lib/youtube/agenda/fecho.ts` e `src/lib/youtube/agenda/executar.ts` (o caminho da agenda; emenda 1: S-C1); `test/youtube/competitor-missing-proof.test.ts` (novo); `test/youtube/cron-competitors-prova.test.ts`; `test/youtube/agenda/fecho.test.ts`; `test/youtube/agenda/executar.test.ts`; (emenda 2: m-N1) e, **só para acrescentar o `vi.mock` do módulo novo**, os testes do cron que hoje afirmam verde com site na lista: `test/youtube/cron-competitors-agenda.test.ts` (conferido), e `test/youtube/cron-competitors-invalidate.test.ts`, `test/youtube/cron-route.test.ts` e `test/api/cron/sync-youtube.test.ts` se caírem sem ele | 5 e 6 (emenda 1: a conclusão de apagamentos chama `concluirApagamentos` e `sitesComApagamentoPendente`, que são da Tarefa 6); contrato do Apêndice A | 4 |
| 9 | Ações de servidor e dados da página | `src/app/cms/(authed)/youtube/competitors/_saiu/actions.ts`, `_saiu/dados.ts` (novos); `…/competitors/actions.ts` (**só** `removeCompetitorChannel`: a recusa); `test/youtube/observatorio/saiu-actions.test.ts` (novo); `test/youtube/observatorio/cache-writers.test.ts` | 4, 6; 7 commitada (mesmo arquivo `actions.ts`); 11a commitada (mesmo vetor de `cache-writers.test.ts`; emenda 2: I-N1) | 10 não |
| 10 | Tela e aba | `…/competitors/saiu/page.tsx`, `_saiu/view-model.ts`, `_saiu/fila-screen.tsx`, `_saiu/painel-apagar.tsx`, `_saiu/saiu.css` (novos); `_chrome/view-model.ts`, `_chrome/chrome-server.tsx`, `_chrome/icons.tsx` (se faltar ícone); `src/lib/youtube/observatorio/links.ts`; `test/youtube/observatorio/saiu-view-model.test.ts`, `saiu-fila-screen.test.tsx`, `saiu-painel-apagar.test.tsx` (novos); o teste existente do `view-model` do chrome. (emenda 1: S-m9) Dividida em **10a** (aba: `links.ts`, os arquivos de `_chrome/` e o teste do chrome) e **10b** (tela: o resto), em commits separados | 3, 4, 9; os arquivos de `_chrome/` e `links.ts` limpos no `git status` | nenhuma |
| 11 | "Sem resposta o dado fica": varredura e teste de 400 dias | `test/youtube/observatorio/saiu-varredura.test.ts` (novo); `test/integration/observatorio-a5-e9-400-dias.test.ts` (novo); `src/lib/youtube/competitor-snapshot-prune.ts` (novo), `src/app/api/cron/ab-watchdog/route.ts` (**só** a poda de retratos) e `test/cron/ab-watchdog-competitor-history.test.ts` (emenda 1: S-I4); `test/youtube/observatorio/cache-writers.test.ts` (**só** a troca do escritor da poda em `KNOWN_WRITERS` e o comentário acima dela; emenda 2: I-N1). Dividida em **11a** (a poda: os quatro arquivos do `ab-watchdog` e `cache-writers.test.ts`, num commit só) e **11b** (a varredura e o teste de 400 dias) | 11a: nada. 11b: 2, 7, 8 e a 11a | 12 não; a 11a não roda junto com a 9 (mesmo vetor `KNOWN_WRITERS`) |
| 12 | Testes de ponta contra o banco, semente e conferência de UX | `test/integration/observatorio-a5-e9-fila.test.ts` (novo); `e2e/fixtures/observatorio-seed.ts` (só com o arquivo limpo); `playwright.config.ts` (uma linha; emenda 1: S-I5); `e2e/tests/cms/observatorio/saiu.spec.ts` (novo); `docs/superpowers/mockups/2026-10-13-a5-lote-1/REVISAO-UX-IMPLEMENTADO-E.md` (novo, do revisor) | 2, 9, 10 | nenhuma |
| 13 | Envio B e conferências | `src/lib/conferencias.ts`; `test/lib/conferencias.test.ts`; `docs/ops/observatorio-fila-sairam-runbook.md` (novo); `docs/ops/env-vars.md` (uma linha); `.superpowers/sdd/a5/conferencias-com-data.md` | tudo; MG-E9 em produção | |

**Ondas.**
- **Já, em paralelo:** 1, 3, 5, 7.
- **Depois da 1 (o contrato do SQL confirmado):** 4 e 6 em paralelo, e a 8 depois da 6 (emenda 1: ela usa o serviço da 6; arquivos próprios; a 8 toca `route.ts`, `agenda/fecho.ts` e `agenda/executar.ts`, sozinha). A parte do `ab-watchdog` da Tarefa 11 (a **11a**) não depende de nenhuma outra tarefa e pode ser feita já, em commit próprio (emenda 1: S-I4); (emenda 2: I-N1) ela é commitada **antes** da Tarefa 9, porque as duas editam o mesmo vetor de `cache-writers.test.ts`. (emenda 1: S-m12; emenda 2: m-N2) Logo depois da Tarefa 1 o controlador **aplica** `mg-e9.sql` no `bythiago_int` (é idempotente; nunca `db:reset`), **antes do commit da Tarefa 8**, e avisa as trilhas que rodam `test/integration/agenda-despacho.test.ts` (E16, E15): depois da Tarefa 8, sem a tabela `competitor_missing_baseline` nesse banco, todo disparo de agenda desse teste sairia com "schema ausente" (CP18). Além disso, com isso os testes de integração das Tarefas 11 e 12 que não dependem da tela podem ser escritos e rodados sem esperar o arquivo da migration, e o contrato real é exercitado antes da vez do lote. Se a Tarefa 2 mudar o SQL depois, reaplica-se.
- **Depois:** 9, sozinha (edita `actions.ts`, que a 7 também edita: a 7 commita antes; e edita `cache-writers.test.ts`, que a 11a também edita: a 11a commita antes; emenda 2: I-N1). Depois 10a e 10b, nessa ordem, cada uma sozinha.
- **Na vez do lote:** 2. Depois dela: 11b e 12 (uma de cada vez: as duas usam o banco de integração).
- **Por último:** 13. O **Envio A** (só a Tarefa 7; e a mudança do `ab-watchdog`, se a CP15 der maior que zero) sai antes, quando a CP2 passar **e** a conferência ~~de commits~~ (reconciliação 13/10, emenda 3: I1: por conteúdo, `git diff --quiet`, código de saída) da seção 2, passo 1, der 0 (emenda 1: S-I3; "assim que a CP2 passar" estava errado).

**Arquivos compartilhados com OUTRAS etapas** (cada um é tocado por **uma** tarefa deste plano):

| Arquivo | Quem mais mexe | Regra |
|---|---|---|
| `lib/youtube/competitor-sync.ts`, `test/youtube/competitor-sync-harness.ts`, `competitor-sync-a5.test.ts` | E1 e E2 (autores), E16, E15 | Tarefa 7, só. Mudança cirúrgica em três pontos (a consulta depois de `existingMap`; o filtro de `probeCandidates`; o salto no laço; emenda 1: S-m2). Avisar o controlador antes: integração serial com quem estiver no arquivo |
| `app/api/cron/sync-youtube/route.ts`, `test/youtube/cron-competitors-prova.test.ts` | E1 e E2, E16, E15, E14 | Tarefa 8, só. A leitura nova entra **dentro** do `Promise.all` que calcula `verdicts` (emenda 1: S-I2), e a conclusão de apagamentos depois do registro; nenhuma outra linha muda além da composição de `prova` e do retorno |
| `lib/youtube/agenda/fecho.ts`, `lib/youtube/agenda/executar.ts`, `test/youtube/agenda/fecho.test.ts`, `test/youtube/agenda/executar.test.ts` (emenda 1: S-C1) | E16 (autora), E15, E14, e os outros planos da onda 2 que pendurem prova no cron | Tarefa 8, só, com os quatro limpos no `git status` e aviso ao controlador (integração serial). Em `fecho.ts`: um elemento a mais no `Promise.all` por site e a composição de `prova`; em `executar.ts`: um passo depois do aviso ao dono e um campo no corpo da resposta |
| `app/api/cron/ab-watchdog/route.ts`, `test/cron/ab-watchdog-competitor-history.test.ts` (emenda 1: S-I4) | A/B Lab (autor) | Tarefa 11a, só: a poda de `competitor_channel_snapshots` vai para um módulo próprio e ganha a exclusão dos canais ausentes; na rota, as seis linhas da poda viram uma chamada e a resposta ganha o campo `poda_retratos` (emenda 2: m-N7); nada mais no arquivo. Commit próprio (pode ir no Envio A: CP15), **junto com** a troca em `cache-writers.test.ts` (emenda 2: I-N1) |
| `playwright.config.ts` (emenda 1: S-I5) | toda etapa com teste de navegador | Tarefa 12, só: uma linha no `env` do `webServer` (`BLOB_READ_WRITE_TOKEN: ''`) |
| `…/competitors/actions.ts` | A4, E5, E1 e E2 | Tarefa 7 (só `addCompetitorChannel`) e Tarefa 9 (só `removeCompetitorChannel`), nessa ordem, cada uma com o arquivo limpo no `git status`. As ações novas vão em `_saiu/actions.ts` |
| `test/youtube/observatorio/cache-writers.test.ts` | quem escreve em tabela em cache | (emenda 2: I-N1) Duas tarefas, nesta ordem. **Tarefa 11a**, no mesmo commit da mudança da poda: em `KNOWN_WRITERS`, `app/api/cron/ab-watchdog/route.ts` **sai** e `lib/youtube/competitor-snapshot-prune.ts` **entra** (o primeiro teste do arquivo exige igualdade exata da lista: sem a troca ele cai pelos dois lados), e o comentário acima da constante passa a nomear o módulo. **Tarefa 9**, no mesmo commit das ações, já sobre o vetor trocado: as funções novas entram em `WRITES` e `lib/youtube/observatorio/saiu/responder.ts` entra em `KNOWN_WRITERS` (é onde as chamadas `rpc` moram; esta linha dizia `_saiu/actions.ts`, que não casa com o padrão: corrigido para o que a Tarefa 9 já dizia); a contagem de invalidações de `actions.ts` não muda |
| `_chrome/view-model.ts`, `_chrome/chrome-server.tsx`, `_chrome/icons.tsx`, `observatorio/links.ts` | A4 (não enviada), E5 | Tarefa 10a e, **só em `_chrome/chrome-server.tsx`**, também a 10b (a linha que chama `contarParaAAba()` e passa `fila`; emenda 2: m-N8: esta linha dizia "Tarefa 10a, só"). A condição vale para as duas: **só com os quatro limpos no `git status`**. Um campo opcional a mais em `buildChromeView` e uma aba a mais; nada do que existe muda de comportamento (teste: sem o campo, as quatro abas de hoje saem idênticas) |
| `observatorio/proprio/**` (`edicao.ts`, `ler.ts`) | A4, E6, E17, E11 | **não toca nem importa**: a guarda da fila é própria (F10) |
| `lib/youtube/competitor-health.ts`, `competitor-capture.ts`, `competitor-removal-impact.ts` | E1 e E2, E16, E15, E5 | **não toca** |
| `lib/youtube/observatorio/rules.ts` | A5 inteira | **não toca**: as constantes da fila moram em `saiu/modelo.ts` |
| `lib/conferencias.ts`, `test/lib/conferencias.test.ts` | todas | Tarefa 13: um bloco (constante e função), e um spread a mais em `CONFERENCIAS` |
| `e2e/fixtures/observatorio-seed.ts` | A4, E6, E8, E18, E11 | Tarefa 12, só com o arquivo limpo; a semente não bloqueia os testes de integração (eles semeiam por conta própria) |
| `supabase/migrations/` | todas | um arquivo novo; nenhuma função de outra etapa é recriada |
| `types/database.types.ts` | todas | **não toca** |
| Teste geral da lista fechada (item 231) | E10 | se existir no dia da Tarefa 11, ela acrescenta as linhas da E9 no mesmo commit; se não existir, a obrigação fica registrada no ledger para a E10 |

**Restrições globais.** TypeScript estrito, sem `any`, sem `as unknown as` novo. Arquivos em kebab-case. Texto que o dono lê em português. Módulos de servidor com `import 'server-only'`; testes de servidor com `// @vitest-environment node`, de componente com `// @vitest-environment jsdom`. Datas de teste relativas ou com relógio falso. Todo padrão de variável de ambiente tem teste que **apaga** a variável. Nenhum `next/link` passado como prop a componente cliente (usar `_shared/cms-link.tsx`). Componente cliente não importa ação de servidor: recebe por prop. Nenhum título, texto de comentário, nome de autor ou id de comentário em `Sentry.captureException` (`extra`, `tags` ou mensagem), em nota de cron ou em `audit_log`: só ids internos, o id público do vídeo ou do canal, códigos e contagens. Nenhum texto de exceção do banco chega à tela: a tela mostra a frase de um catálogo fechado de códigos. Testes de integração gated em `HAS_LOCAL_DB`, contra `bythiago_int` (`HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres`), sem paralelismo entre arquivos, cada teste com o **seu** site (nenhum conta "o banco inteiro"), e **nunca** chamando função como `anon` ou `authenticated` (derruba o Postgres local: confere-se por `has_function_privilege`). Cada tarefa termina com `npm run typecheck -w apps/web` limpo e os testes dos seus arquivos verdes; commit local por lista explícita de caminhos, sem push. Nenhum comando ou espera acima de 4 minutos. `apps/web/next-env.d.ts` e `apps/web/tsconfig.json` não são tocados nem commitados.

**Provas por mutação (toda tarefa que filtra por site ou por canal).** Para cada filtro da lista abaixo, o implementador tira o filtro, roda o teste nomeado, vê falhar, repõe, e anota no relatório da tarefa o nome do teste e a falha vista. Sem a falha vista, a tarefa não está pronta.

| Filtro | Onde | Teste que tem de cair |
|---|---|---|
| `c.site_id = p_site` no `select … for update` do vídeo | `competitor_video_purge` | `apagar vídeo de outro site devolve not_found e não apaga` |
| `c0.site_id = p_site` | `competitor_channel_purge` | `apagar canal de outro site devolve not_found e não apaga` |
| `k.site_id = p_site` e `k.competitor_channel_id = p_channel` (dois filtros, duas mutações) | `competitor_comments_purge` | `comentário de outro site não é apagado`; `comentário de outro canal devolve mudou` |
| `k.missing_since is not null` | as três de apagar | `item no ar devolve no_ar (ou mudou) e nada some` |
| `c.site_id = p_site` nos três ramos | `competitor_missing_keep` | `manter não alcança item de outro site` (um por tipo) |
| `r.site_id = p_site` | `competitor_return_decide`, `competitor_removed_blobs_done` | `linha de outro site não muda` |
| `c.site_id = p_site` | `competitor_purge_preview`, `competitor_missing_proof`, `competitor_missing_count` | `outro site não entra na contagem` (um por função) |
| `.eq('site_id', siteId)` e `.eq('kind', 'video')` (duas mutações) | `competitor-removed.ts` | `apagado em outro site não bloqueia`; `linha de canal com o mesmo id não bloqueia vídeo` |
| filtro de site em cada uma das leituras | `saiu/ler-fila.ts`, `saiu/contar.ts` | `a fila de um site não mostra item do outro` (um caso por leitura) |
| `t.status = 'running'` e a janela (duas mutações) | `competitor_video_purge` | `tarefa pending não bloqueia`; `tarefa running há 31 minutos não bloqueia` |
| `t.started_at is null or …` (emenda 1: D-M3) | `competitor_video_purge` | `tarefa running sem started_at bloqueia` |
| `k.site_id = p_site` e `k.competitor_channel_id = p_channel` (emenda 1: D-I3) | `competitor_comments_preview` | `a prévia não conta comentário de outro site`; `nem de outro canal` |
| `r.site_id = p_site` (emenda 1: D-I2) | `competitor_removed_comment_groups` | `grupos de comentários apagados de outro site não entram` |
| a lista de "novos" vem de `videosData.items`, não de `videoIds` (emenda 1: S-I1 e D-I1) | `competitor-sync.ts` | `apagado que a lista de envios ainda cita mas videos.list não devolve: não é inserido e NÃO ganha returned_seen_at` |
| `.not('competitor_channel_id', 'in', …)` dos canais ausentes (emenda 1: S-I4) | `competitor-snapshot-prune.ts` | `a poda de retratos não apaga os de canal ausente` |

**Foco de revisão** (o que os dois especialistas devem atacar primeiro): (1) `competitor_cascade_counts`: o SQL dinâmico, os dois níveis, a guarda do nível 3 e a auto-referência de comentários; não foi executado por mim. (2) A ordem das travas em `competitor_video_purge` e `competitor_channel_purge` e a corrida com o claim da forja e com a sincronização (impasse possível: seção 13). (3) A prova por piso: o que a deixa vermelha para sempre e como se sai. (4) A consulta da sincronização que falha fechada (vídeo novo não entra) e o custo dela. (5) A auditoria dentro da transação e o que **não** vai nela. (6) O que a tela afirma com a fila vazia.

---

## 10. As tarefas

Cada tarefa: teste antes do código. O primeiro passo é escrever os testes nomeados, rodar, **ver falhar** e guardar a saída vermelha no relatório (`.superpowers/sdd/a5-e9/task-<N>-report.md`); só então o código.

### Tarefa 1: ensaio do SQL no banco de integração (já)

**Objetivo.** Rodar o Apêndice A de verdade antes de qualquer tarefa depender dele, e corrigir o plano onde o SQL estiver errado.
**Arquivos.** `.superpowers/sdd/a5-e9/sql/mg-e9.sql` (cópia do Apêndice A), `prova.sql` (roteiro `psql`), `prova-saida.txt`.
**(reconciliação 13/10, emenda 1: D-I1, S-m7, D-m4) Entra neste ensaio o SQL que a R8 pediu e que o Apêndice A não tem.** (a) `lotes_exportados` nas três funções de apagar e na prévia: `count(distinct batch)` de `obs_archive_batches` com `channel_ref = <id do canal>::text` e `deleted_at is null`, só quando `to_regclass('public.obs_archive_batches')` não é nulo; tabela ausente devolve a chave com `null`, nunca `0` (zero diria "conferi e não há"). (b) "Apagar canal" encerra os lotes abertos do canal (`closed_at = now()`, `closed_reason = 'canal_apagado'`) na mesma transação, quando a tabela existir: sem isso o registro fica "exportado e não confirmado" para sempre, apontando para canal que não existe. O valor `'canal_apagado'` depende de o `check` de `closed_reason` da MG6 aceitá-lo (emenda 1 no plano da E10, Tarefa 1); se a MG6 já estiver aplicada sem ele, (b) não é feito e a R-B do documento de reconciliação diz que o lote fica aberto. Casos de prova, com a MG6 aplicada antes no `bythiago_int`: canal com dois lotes de três tabelas cada devolve `2`; canal sem lote devolve `0`; sem a tabela, `null`; depois do apagar, os lotes do canal têm `closed_reason = 'canal_apagado'` e os de outro canal não mudam. **Não rodado.**
**Passos.**
1. CP11. Copiar o Apêndice A para `mg-e9.sql`.
2. Escrever `prova.sql`: abre transação, aplica `mg-e9.sql` **duas vezes** (idempotência), cria um site, dois canais e os cenários abaixo com dados inventados, imprime cada resultado, e termina em `rollback` (o banco de integração fica como estava; a Tarefa 2 é quem aplica de verdade).
3. Rodar `prova.sql` duas vezes; as duas saídas têm de ser iguais (fora carimbo de hora). Guardar em `prova-saida.txt`.
4. Onde o SQL falhar ou o resultado divergir do esperado: corrigir `mg-e9.sql`, **o Apêndice A deste plano** e os valores esperados da seção 2, e listar cada correção no relatório. Mudança de contrato (nome, parâmetro, chave de retorno): parar e avisar o controlador, porque as Tarefas 4, 6 e 8 leem o contrato.
5. **(emenda 1: D-I4 e S-I6) Prova do teto de tempo pela API, não por `psql`.** O `psql` não exercita o que importa (quem aplica a cláusula `set statement_timeout` da função antes da chamada é o PostgREST). No `bythiago_int`, fora de transação: criar `public.t_e9_dorme(p_seg numeric)` com `set statement_timeout = '2s'` e corpo `perform pg_sleep(p_seg)`, com `execute` só para `service_role`; `notify pgrst, 'reload schema'`; chamar pela API (porta 54421, chave de serviço) com `p_seg = 4`. Esperado: erro `57014` em cerca de 2 s (o teto da função vale). Depois ler `select rolname, rolconfig from pg_roles where rolname in ('authenticator','service_role');` no banco local: se houver teto de papel de T segundos, recriar a função com `set statement_timeout` de T + 4 s e chamar com `p_seg` = T + 2. Esperado: termina **sem** erro (o teto da função vence o do papel). `drop function` no fim, nos dois desfechos. Se o segundo ensaio falhar (ou o papel local não tiver teto e o primeiro falhar): a cláusula não resolve; anotar, **parar e avisar o controlador** (a saída passa a ser pergunta ao dono, com os números da CP9; o plano não inventa outra).
6. **(emenda 1: S-I6) "Apagar canal" cronometrado.** Dentro de `rollback`: semear um canal com o número de vídeos e de linhas por tabela que a CP9 e a conta inteira de `competitor_cascade_counts` derem para o maior canal (se a CP9 ainda não tiver resposta: 200 vídeos, 365 dias de série e 24 leituras por hora de 30 dias por vídeo, e anotar que é suposição), `\timing on`, chamar `competitor_channel_purge`. Anotar o tempo. Acima de 10 s: parar e avisar (o teto de 30 s fica perto demais com o banco de produção carregado).
7. **(emenda 1: D-I4 e S-I6) CP13** no mesmo banco, e a decisão escrita no relatório pela regra da linha CP13 (índice na MG-E9 ou "tabela pequena, aceito", com o número da CP14).

**Cenários do roteiro (cada um vira depois um teste da Tarefa 2).**

| Nome | Entrada | Esperado |
|---|---|---|
| `aplica duas vezes` | o arquivo duas vezes | sem erro; V1 = 1, 1, 13, 0 |
| `recusa sem a MG1` | dentro de `savepoint`, com `competitor_removed_items` renomeada | exceção "MG-E9 depende da MG1" |
| `contagem de vídeo = o que some` | vídeo com 3 dias de série, 2 das primeiras horas, 4 versões (2 com `thumb_blob_url`), 2 mudanças, 1 tarefa `completed` com 1 leitura, 2 linhas de histórico de campo, 1 `raw`, 1 faixa, 2 leituras por hora, 1 retrato de comentários, 3 comentários (1 resposta do criador), 2 identidades, 4 marcas | cada chave com o número semeado; depois do `delete` da linha do vídeo, `count(*)` de cada tabela para esse vídeo = 0, e a soma do que sumiu = a soma da contagem |
| `comentário com resposta não conta duas vezes` | o cenário acima | `competitor_video_comments` = 3, não 4 |
| `contagem de canal` | canal com 2 vídeos como o de cima e 5 linhas de `competitor_channel_snapshots` | cada chave = o dobro, mais `competitor_videos` 2, `competitor_channel_snapshots` 5; o outro canal do site intacto |
| `tabela nova entra sozinha` | `create table t_e9_x (id bigint generated always as identity primary key, video_id uuid references public.competitor_videos(id) on delete cascade)` com 2 linhas | a contagem traz `t_e9_x: 2` |
| `nível 3 lança` | tabela com cascata para `t_e9_x` | exceção com "nível 3" e o nome da tabela; nada apagado |
| `chave composta lança` | tabela com chave estrangeira de duas colunas para uma filha | exceção com "chave composta" |
| `raiz desconhecida e id nulo lançam` | `'playlist'`; `null` | exceção nas duas |
| `apagar vídeo: tudo ou nada` | o vídeo do cenário, `missing_since` preenchido | `status: 'apagado'`; zero linhas em todas as tabelas; uma linha em `competitor_removed_items` com `kind 'video'`, `youtube_id`, `missing_since`, `rows_deleted` = a contagem, `blobs_pending` = 2 URLs e 1 prefixo, `purge_count 1`; uma linha em `audit_log` com `action 'competitor_missing_purge'`, `org_id` e `site_id` preenchidos, e `after_data` sem nenhuma chave de título |
| `apagar vídeo no ar` | `missing_since` nulo | `no_ar`; nada muda |
| `apagar vídeo de outro site` | `p_site` de outro site | `not_found`; nada muda |
| `recusa com tarefa running recente` | tarefa `leitura-video` `running`, `started_at` = agora menos 5 min, janela 30 | `forja_em_andamento`; nada muda; a tarefa continua lá |
| `pending não bloqueia; running velha não bloqueia` | tarefa `pending`; tarefa `running` há 31 min | `apagado` nos dois; a tarefa some |
| `janela inválida lança` | `p_janela_min` 0, 241, nulo | exceção |
| `IP inválido não apaga` | `p_ip = 'abc'` | exceção; nada apagado (a transação volta) |
| `apagar duas vezes soma` | apagar; reinserir o mesmo `video_id` como novo, com `missing_since`; apagar de novo | sem erro de chave; `purge_count 2`; `rows_deleted` = soma das duas contagens, chave a chave; `returned_seen_at`, `return_decision`, `return_decided_at` nulos; `blobs_pending` = união sem repetição |
| `apagar canal` | canal ausente com 2 vídeos | `apagado`; canal, vídeos e filhas somem; uma linha `kind 'canal'` com o id `UC…`; um prefixo por vídeo em `blobs_pending`; nenhuma linha `kind 'video'` criada |
| `apagar canal com tarefa em andamento num dos vídeos` | uma tarefa `running` recente | `forja_em_andamento`; nada muda |
| `apagar comentários` | 3 comentários ausentes de um canal (um com resposta do criador), pedidos pelos 3 ids | `apagado`, `comentarios 4` (os 3 e a resposta); 4 linhas `kind 'comentario'`; identidades e marcas somem; os vídeos e o canal ficam; a auditoria tem **uma** linha, sem nenhum id de comentário |
| `apagar comentários: a lista mudou` | pedir 3 ids, um deles com `missing_since` nulo | `mudou`, `pedidos 3`, `encontrados 2`; nada apagado |
| `apagar comentários de outro canal ou site` | `p_channel` de outro canal; `p_site` de outro site | `mudou` ou `not_found`; nada apagado |
| `manter` | 2 vídeos ausentes sem decisão e 1 já mantido | `mantidos 2`; decisão, data e autor gravados; 2 linhas de auditoria `competitor_missing_keep`; o já mantido não muda de data |
| `manter não alcança o que está no ar nem outro site` | um no ar; um de outro site | `mantidos 0`, `status 'nada'` |
| `voltar e ignorar` | linha com `returned_seen_at`; `'voltar'` | `status 'ok'`; segunda chamada `nada`; `kind 'comentario'` com `'voltar'` devolve `nada`; decisão fora da lista lança |
| `pendência do Blob` | linha com 3 pendentes; `p_done` com 2 deles e 1 que não existe | `restam 1`; outra linha do site e a de outro site intactas |
| `prova: fila vazia` | site com vídeos, nenhum ausente | todos os números 0, `mais_antigo_dias` nulo |
| `prova: grava o piso uma vez` | 2 ausentes; rodar duas vezes | 1ª: `pisos_novos 2`; 2ª: `pisos_novos 0`; `ausentes_com_queda 0` nas duas |
| `prova: queda acusa` | depois do piso, `delete` direto de uma linha de série de um ausente | `ausentes_com_queda 1` |
| `prova: vídeo de canal ausente entra` | canal ausente, vídeo sem `missing_since` próprio | conta em `videos_ausentes`; ganha piso com a data do canal |
| `prova: volta ao ar sai` | o vídeo com queda tem `missing_since` zerado | `ausentes_com_queda 0` |
| `prova: apagando há mais de 1 dia` | linha com `blobs_pending` e `decided_at` há 25 horas; outra há 2 horas | `apagando 2`, `apagando_ha_mais_de_1d 1` |
| `prova e contador: outro site não entra` | os mesmos dados num segundo site | os números do primeiro não mudam |
| `prova: parâmetro nulo lança` | `p_site` nulo; `p_now` nulo | exceção |
| `running sem started_at bloqueia` (emenda 1: D-M3) | tarefa `leitura-video` `running` com `started_at` nulo | `forja_em_andamento` em apagar vídeo e em apagar canal; `forja_em_andamento: true` na prévia; nada muda |
| `prévia = apagado, vídeo e canal` (emenda 1: D-I3) | `competitor_purge_preview` e, em seguida, a função de apagar do mesmo item | `rows` da prévia igual, chave a chave, ao `rows_deleted` devolvido; `blobs` da prévia = número de URLs de `blobs` (sem os prefixos) |
| `prévia de comentários = o que o apagar leva` (emenda 1: D-I3) | `competitor_comments_preview` com os 3 ids do cenário `apagar comentários`, e depois o apagar | prévia: `encontrados 3`, `respostas 1`, `rows` com `competitor_video_comments 4` e as marcas e identidades dos 4; igual, chave a chave, ao `rows_deleted` do apagar |
| `prévia de comentários: fora do alcance` | outro site; outro canal; ids no ar; 501 ids; lista vazia | `not_found` nos três primeiros; exceção nos dois últimos |
| `grupos de comentários apagados` (emenda 1: D-I2) | `competitor_removed_comment_groups` depois do cenário `apagar comentários`; os mesmos dados em outro site | um objeto do canal com `comentarios 4` e `decided_at`; o outro site não entra; site sem comentário apagado devolve `[]` |
| `contador: cada linha conta uma vez` (emenda 1: D-M9 e D-M10) | uma linha de vídeo com `blobs_pending` **e** `returned_seen_at` sem resposta; 7 linhas de comentário de um mesmo canal com `returned_seen_at` sem resposta; 1 linha de vídeo que voltou, sem pendência | `competitor_missing_count`: `apagando 1`, `voltaram 2` (o vídeo sem pendência e o grupo de comentários; a linha que está apagando não entra em `voltaram`) |
| `as duas funções de apagar têm teto próprio` (emenda 1: D-I4) | `select proname, proconfig from pg_proc where proname in ('competitor_video_purge','competitor_channel_purge')` | as duas com `statement_timeout=30s` em `proconfig` |
| `V1 a V4` | as consultas da seção 2 | os valores esperados de lá |

**Pronto quando:** duas saídas iguais guardadas; todo cenário com o resultado esperado; o Apêndice A deste plano igual a `mg-e9.sql` (`diff` do bloco); as correções listadas no relatório.

### Tarefa 2: arquivo da migration e testes de migration, RLS e corrida (só na vez do lote)

**Objetivo.** O arquivo da migration, igual ao `mg-e9.sql` provado, e os testes que ficam no repositório.
**Não começa antes** do aviso do controlador (decisão 45a e a regra do `db:new`).
**Passos.**
1. `npm run db:new observatorio_a5_e9_apagar_o_que_saiu`; conferir que o carimbo é posterior ao da última migration do diretório; colar `mg-e9.sql`; `diff` com o Apêndice A vazio.
2. Rodar `prova.sql` de novo, duas vezes, apontando para o arquivo novo: saída igual à guardada.
3. O controlador aplica a migration no `bythiago_int` (nunca `db:reset`).
4. Escrever e rodar os três arquivos de teste.

**`observatorio-a5-e9-migration.test.ts`:** um teste por linha da tabela de cenários da Tarefa 1 (mesmos nomes), menos `aplica duas vezes`, `recusa sem a MG1` e os que criam tabela (`tabela nova entra sozinha`, `nível 3 lança`, `chave composta lança`), que ficam no roteiro `psql` porque pedem DDL dentro de transação.
**`observatorio-a5-e9-rls.test.ts`** (usuários criados no teste, **sem** `super_admin`, com o GUC `app.site_id` forjado para o site alvo): `usuário sem vínculo e reporter não leem competitor_missing_baseline nem competitor_removed_items`; `editor do site lê as duas`; `editor de OUTRO site, com o GUC forjado para este, não lê`; `anon não tem select; authenticated não tem insert, update nem delete nas duas` (por `has_table_privilege` e por tentativa, que tem de dar "permission denied" ou zero linhas); `as treze funções: has_function_privilege falso para anon e authenticated, verdadeiro para service_role`.
**`observatorio-a5-e9-corrida.test.ts`** (duas conexões `pg` no mesmo teste; é o que a C0.12 deixou como "não verificado"):
- `claim que chega primeiro faz o apagar recusar`: conexão A faz o `update` do claim e commita; B chama a função: `forja_em_andamento`.
- `apagar que chega primeiro faz o claim não achar a tarefa`: A abre transação e chama a função (não commita); B dispara o `update` do claim com `statement_timeout` de 3 s e fica esperando; A commita; o `update` de B devolve 0 linhas.
- `inserção de filha durante o apagar espera e depois falha por chave`: A com a função em transação aberta; B tenta inserir uma linha de série do vídeo: espera; depois do commit de A, erro de chave estrangeira; nenhuma linha órfã.
- `dois apagar do mesmo vídeo ao mesmo tempo`: um devolve `apagado`, o outro `not_found`; uma linha em `competitor_removed_items`, `purge_count 1`.
- (emenda 1: D-M4 e S-m5) `a prova que cruza com um apagar não fica vermelha`: vídeo ausente ainda sem piso; A abre transação e chama `competitor_video_purge` (não commita); B chama `competitor_missing_proof` e fica esperando na inserção do piso; A commita; B devolve as dez chaves **sem** exceção, e o vídeo apagado não conta em `videos_ausentes` nem ganhou piso. Mutação: sem o laço de nova tentativa, este teste cai com `23503`.
- (emenda 2: N3) `a prova que cruza com "apagar canal" não dá impasse`: canal ausente com 40 vídeos ainda sem piso; A chama `competitor_channel_purge` e B chama `competitor_missing_proof` ao mesmo tempo, 20 rodadas (cada uma com semente nova); nenhuma devolve `40P01`, e a prova devolve as dez chaves em todas. É teste de corrida, não determinístico: por isso vai junto um teste de leitura, `o piso é inserido em ordem de id e a prova trata impasse` (lê `prosrc` de `competitor_missing_proof` e exige `order by a.id` e `deadlock_detected`), que cai se alguém tirar uma das duas linhas.

**Teto de tempo, pela API** (emenda 1: D-I4 e S-I6; no arquivo `…-e9-migration.test.ts`, com a migration já aplicada pelo controlador): `apagar vídeo e apagar canal carregam statement_timeout de 30 s na definição` (lê `proconfig`); `pela API, o teto da função vale no lugar do teto do papel` (o ensaio do passo 5 da Tarefa 1 como teste permanente: a função `t_e9_dorme` é criada e removida pelo próprio teste, em `afterAll` também).

**Pronto quando:** `diff` vazio; roteiro igual ao guardado, duas vezes; os três arquivos passam contra `bythiago_int`; as mutações da seção 9 que são de SQL feitas e anotadas (cada uma num `create or replace` temporário dentro de transação com `rollback`, nunca no arquivo).

### Tarefa 3: modelo puro da fila

**Objetivo.** Tipos, regras e textos da fila num módulo sem banco, sem rede e sem relógio próprio.
**Arquivos.** `saiu/modelo.ts`, `saiu/rotulos.ts` e os dois testes.
**Contrato (`modelo.ts`).**
- Constantes: `FILA_PAGINA = 10`; `JANELA_FORJA_MIN` (reexporta `STALE_AFTER_MINUTES` de `lib/youtube/analysis-progress.ts`; não copia o número); `LEITURA_RECENTE_H = 24`; `APAGANDO_VERMELHO_H = 24`; `MANTIDO_QUE_VOLTOU_DIAS = 30`; `PALAVRA = 'APAGAR'`; `DATA_MG1 = '2026-10-12'` (para "antes de dd/mm").
- `type TipoDeItem = 'video' | 'canal' | 'comentarios'`.
- `interface ItemEsperando { tipo; chave: string; titulo: string | null; canal: string | null; desde: string; diasEsperando: number; ultimaLeitura: string | null; views: number | null; curtidas: number | null; comentarios: number | null; inscritos: number | null; canalNoAr: boolean | null; formato: 'longo' | 'short' | null; duracaoSeg: number | null; publicadoEm: string | null; vistoPrimeiro: string | null; miniaturaUrl: string | null; codigo: string | null; videosDoGrupo: Array<{ titulo: string | null; comentarios: number }> | null; idsDoGrupo: number[] | null; previa: Previa | { erro: CodigoDeErro }; decisao: 'manter' | null }`.
- `interface Previa { linhas: Record<string, number>; miniaturas: number; forjaEmAndamento: boolean }`.
- `interface FilaLida { esperando: ItemEsperando[]; totalEsperando: number; apagando: ItemApagando[]; voltaram: ItemVoltou[]; respondidos: ItemRespondido[]; ultimaLeituraDosCanais: string | null; canaisDoSite: number; podeResponder: boolean }` e `type LeituraDaFila = { estado: 'ok'; fila: FilaLida } | { estado: 'sem_acesso' } | { estado: 'schema_ausente'; texto: string } | { estado: 'erro'; codigo: CodigoDeErro }`.
- `contadorDaAba(f: Pick<FilaLida, 'totalEsperando' | 'apagando' | 'voltaram'>): number` (esperando + apagando + voltaram com `pedeResposta`).
- `estadoDaFilaVazia(f, agoraMs): 'vazia' | 'vazia_sem_leitura_recente' | 'sem_canais'`.
- `palavraConfere(digitado: string): boolean` (`trim` e maiúsculas).
- `diasDesde(desde: string, hojeSP: string): number`.
- `faltaNoBlob(pendentes: readonly string[]): { miniaturas: number; pastas: number }` (entrada que começa por `observatorio/thumbs/` e termina em `/` é pasta; o resto é miniatura).
- `CODIGOS_DE_ERRO` (lista fechada: `schema_ausente`, `erro_de_banco`, `tempo_esgotado`, `impasse`, `impedido_por_tabela`, `contagem_indisponivel`, `resposta_inesperada`, `blob_nao_configurado`) e `fraseDoErro(codigo): string`; código fora da lista devolve a frase de `erro_de_banco`, nunca o código cru.
- `type Desfecho = 'apagado' | 'apagando' | 'no_ar' | 'forja_em_andamento' | 'not_found' | 'mudou' | 'mantido' | 'nada' | 'sem_permissao' | 'palavra_errada' | 'erro'` e `fraseDoDesfecho(d, o: { tipo: TipoDeItem; janelaMin: number; faltam?: … }): string` (a recusa escreve o número de `janelaMin`, nunca "30" fixo).
- **(emenda 1)** `FilaLida` ganha `respondidosTotal: number` (o bloco "Já respondidos" mostra os 50 mais recentes e "e mais N"; D-I2). `ItemVoltou` tem a forma `{ tipo: 'video' | 'canal' | 'comentarios'; pedeResposta: boolean; itemIds: number[]; … }`: para comentários é **um por canal**, com os ids das linhas do grupo (D-M10). `Previa` ganha `respostasDoCriador: number` (0 para vídeo e canal; D-I3). `contadorDaAba` conta cada linha de `competitor_removed_items` **uma vez**: a que está em `apagando` não entra de novo em `voltaram`, e comentários que voltaram contam um por canal (D-M9 e D-M10); é a mesma regra de `competitor_missing_count`. `fraseDoDesfecho` para a resposta "voltar" de vídeo escreve "Entra de novo na próxima leitura do canal, se ainda estiver entre os vídeos mais recentes" (S-m6). `RESPONDIDOS_PAGINA = 50` e `LISTA_TETO = 20_000` moram aqui.

**Contrato (`rotulos.ts`).** `ROTULO_DA_TABELA: Record<string, { um: string; muitos: string; interno?: true }>` com as tabelas conhecidas (as da V2 e `competitor_videos`, `competitor_channels`, `competitor_channel_snapshots`, `competitor_channel_hour_map`); `linhasDoPainel(linhas: Record<string, number>, miniaturas: number): Array<{ n: number; texto: string }>` na ordem do mockup, **omitindo zero**, com as internas somadas numa linha "registros internos", e tabela **fora do catálogo** mostrada como "N linhas em `<nome>`" (nunca omitida); `resumoGuardado(linhas, miniaturas): string` (a linha "Guardado: 41 dias de views, 3 títulos…"; as versões de título, miniatura e descrição vêm separadas na prévia: ver Tarefa 4).
**Testes (nomes).** `contador soma os três blocos e ignora voltou que só informa`; `fila vazia com leitura há 2 h é vazia; há 25 h é vazia_sem_leitura_recente; sem leitura é vazia_sem_leitura_recente; site sem canal é sem_canais`; `palavra: APAGAR, apagar, " Apagar " conferem; APAGA, vazio e APAGAR! não`; `dias desde: mesmo dia é 0; virada de mês; data futura é 0, nunca negativo`; `falta no Blob separa miniatura de pasta; lista vazia é 0 e 0`; `todo código de erro tem frase e a frase não repete o código cru; código desconhecido não lança`; `a recusa escreve a janela recebida (30 e 45), não um número fixo`; `tabela fora do catálogo aparece com o nome; zero é omitido; internas somam numa linha`; `toda tabela que a V2 lista tem rótulo` (a lista da V2 copiada no teste; a Tarefa 12 confere contra o catálogo real do banco). (emenda 1) `item que está apagando e voltou conta uma vez`; `sete comentários que voltaram, de um canal, contam 1`; `painel de comentários: "3 comentários e 1 resposta do criador"; sem resposta, só "3 comentários"`; `a resposta "voltar" diz a condição ("se ainda estiver entre os vídeos mais recentes")`.
**Pronto quando:** testes verdes; nenhum outro arquivo da etapa escreve um desses textos ou números solto.

### Tarefa 4: guarda de schema, contador e leitor da fila

**Objetivo.** Ler a fila inteira para a tela, com o site em todo filtro, e nunca devolver "vazio" quando não conseguiu ler.
**Arquivos.** `saiu/schema.ts`, `saiu/contar.ts`, `saiu/ler-fila.ts`, os dois testes e o banco falso `saiu-fake-supabase.ts` (próprio desta etapa; não edita o falso de outra).
**Contrato.**
- `schemaE9(sb): Promise<string | null>`: `select` de zero linhas em `competitor_missing_baseline`. `null` = pronto. Tabela ausente (`42P01`, `PGRST205`): "a migration desta etapa ainda não foi aplicada". Qualquer outro erro, resposta nula ou exceção: "não foi possível conferir o schema". Só `null` é "pronto".
- `contarFila(sb, siteId): Promise<number | null>`: chama `competitor_missing_count` e soma as cinco chaves (`videos`, `canais`, `grupos_de_comentarios`, `apagando`, `voltaram`); chave faltando, forma errada, erro ou exceção devolvem `null`. Recebe o cliente de serviço de quem já passou a guarda de edição.
- `lerFila(sb, o: { siteId: string; mostrar: number; agoraMs: number; podeResponder: boolean }): Promise<LeituraDaFila>`: (1) `schemaE9`; (2) **nove** leituras em paralelo (emenda 1: D-I2; eram seis, e a de `competitor_removed_items` não tinha filtro, ordem nem paginação: a API corta em 1.000 linhas **sem erro** (`supabase/config.toml:15`), e um item "apagando" ou "voltou" podia ficar fora da tela com o número da aba contando), cada uma com o filtro do site: vídeos ausentes (com o canal `!inner` filtrado por `site_id`), canais ausentes, comentários ausentes, auditoria `competitor_missing_keep` dos últimos 30 dias, `max(last_ok_synced_at)` com a contagem de canais, e quatro sobre o que já foi apagado: **apagando** (`competitor_removed_items` com `blobs_pending` não vazio ou `archive_pending`), **voltaram** (`returned_seen_at` preenchido e `return_decision` nulo, de todos os tipos, com o `id` da linha), **já respondidos de vídeo e canal** (`kind in ('video','canal')`, `order by decided_at desc`, `limit` de `RESPONDIDOS_PAGINA`, com `count: 'exact'` para o "e mais N") e **comentários apagados por canal** (`rpc('competitor_removed_comment_groups')`: a contagem vem da agregação em SQL, não de linhas trazidas). **Regra de toda leitura de lista** (as quatro primeiras, apagando e voltaram): `order('id')` escrito (sem ordem as páginas repetem e pulam linhas), `count: 'exact'`, páginas de 1.000 até as linhas trazidas igualarem a contagem; passou de `LISTA_TETO` (20.000), ou terminou com menos linhas que a contagem, devolve `erro` com o número. (emenda 2: N4) A contagem usada nessa comparação é a que veio com a **última** página, não com a primeira (toda página pede `count: 'exact'`); se a fila mudar entre duas páginas e as linhas não fecharem, o erro é passageiro e a frase da tela manda recarregar (seção 6). (emenda 2: N1) A leitura de **já respondidos de vídeo e canal** leva o filtro **na consulta**, não em memória: `blobs_pending` vazio, `archive_pending` falso, e (`returned_seen_at` nulo **ou** `return_decision` preenchido). Sem ele a consulta traria também as linhas que estão em "Apagando" e em "Voltaram ao ar": com 50 recentes nesses dois estados o bloco "Já respondidos" sairia vazio depois do filtro em memória, e o "e mais N" contaria linhas de outro bloco. `respondidosTotal` é a contagem dessa consulta filtrada. `totalEsperando` sai das listas completas (só aceitas com linhas = contagem), nunca do tamanho de uma página; (3) monta os blocos pela tabela da seção 4; (4) ordena "esperando" pelo mais antigo primeiro; (5) pede a prévia (`competitor_purge_preview`) **só** dos `mostrar` primeiros, em paralelo; para o grupo de comentários a prévia vem de `competitor_comments_preview` (emenda 1: D-I3; a primeira versão contava no leitor por `in` dos ids, e o apagar leva também a resposta do criador com as marcas e a identidade dela: o painel mostraria 3 e sumiriam 4. A regra `id = any(ids) or parent_id = any(ids)` passa a existir num lugar só, o SQL); (6) qualquer leitura com erro devolve `{ estado: 'erro' }` inteiro: não há fila parcial.
- A prévia de vídeo e canal traz, além de `rows`, as versões separadas por campo (`versoes: { title, thumb, desc }`), lidas pelo leitor com um `select field` das versões do item (para a frase "3 títulos, 2 miniaturas, 1 descrição").
- Nenhum título vai para log ou Sentry: em erro, `Sentry.captureException` com `tags: { component: 'observatorio-saiu', step }` e `extra: { siteId, codigo }`.

**Testes (`saiu-ler-fila.test.ts`, com o banco falso).** `tabela ausente devolve schema_ausente, não fila vazia`; `a guarda que lança devolve schema_ausente com "não foi possível conferir"`; `cada uma das nove leituras com erro devolve erro (nove casos), nunca fila parcial`; `vídeo de canal ausente não aparece solto; o canal é um item só`; `vídeo com missing_since próprio em canal ausente também não aparece solto`; `comentários de um canal viram um item, com os vídeos e as contagens`; `comentário ausente de vídeo ausente não vira item` (vai com o vídeo); `mantido vai para respondidos e não para esperando`; `apagado com blobs_pending vai para apagando; sem pendência vai para respondidos`; `apagado que voltou sem resposta vai para voltaram com pedeResposta; com resposta vai para respondidos`; `mantido que voltou ao ar aparece em voltaram só como informação, e some depois de 30 dias`; `a fila de um site não mostra item do outro` (um caso por leitura: nove); `campos nulos ficam nulos (título, views, discovered_at), nunca zero nem texto vazio`; `prévia que falha num item: o item vem com previa.erro e os outros com a prévia`; `só os N primeiros pedem prévia (conta as chamadas: 10 com 25 itens)`; `ordem: o mais antigo primeiro; empate pela chave`; `20.001 comentários ausentes devolve erro com o número`; `linha de comentário apagado não leva o id para o item (só a contagem por canal)`. (emenda 1: D-I2, D-M9, D-M10) `1.001 linhas em competitor_removed_items (comentários apagados): o item apagando mais antigo e o item que voltou aparecem`; `1.001 vídeos ausentes: vêm os 1.001 (duas páginas), em ordem estável`; `leitura que traz menos linhas que a contagem devolve erro`; `toda leitura de lista manda order e count exact (o banco falso recusa a chamada sem os dois)`; `já respondidos: 51 apagados mostram 50 e respondidosTotal 51`; `comentários apagados vêm da agregação, um por canal`; `comentários que voltaram, de um canal, viram um item com os ids das linhas`; `linha que está apagando e voltou aparece só em apagando, com a data da volta`; `a prévia do grupo de comentários traz as respostas do criador (3 e 1)`; `totalEsperando com 25 itens e mostrar = 10 é 25`. (emenda 2: N1 e N4) `linha apagando e linha que voltou sem resposta não entram em respondidos nem em respondidosTotal (o banco falso aplica os filtros da consulta, e o teste confere que os três foram mandados)`; `50 linhas recentes apagando ou voltando e 3 respondidas mais antigas: o bloco mostra as 3 e respondidosTotal é 3`; `a contagem que vale é a da última página (1.500 linhas, a primeira página diz 1.500 e a segunda diz 1.499: erro)`.
**Testes (`saiu-contar.test.ts`).** `devolve o número`; `erro, exceção, nulo, lista e número negativo devolvem null`; `passa o site`.
**Pronto quando:** testes verdes; mutações de site feitas e anotadas.

### Tarefa 5: apagar do Blob

**(reconciliação 13/10: R9)** O plano da E10 cria outro apagador de miniaturas do mesmo prefixo (`observatorio/arquivo/remover.ts`, Tarefa 11a de lá: `soMiniaturasDoObservatorio`, `PREFIXO_DAS_MINIATURAS`). Se ele já existir no dia, esta tarefa reusa o filtro de prefixo de lá em vez de escrever outro; se não existir, a 11a de lá reusa o daqui. A guarda de `OBS_E2E` vale para os dois módulos (o de lá ganhou a mesma, por emenda).

**Objetivo.** Apagar as miniaturas de um item, dizer exatamente o que **confirmou**, e nunca lançar.
**Arquivo.** `saiu/blob.ts`.
**Contrato.** `apagarDoBlob(pendentes: readonly string[], o: { prazoMs: number; agora?: () => number; del?: (urls: string[]) => Promise<void>; list?: (a: { prefix: string; cursor?: string; limit: number }) => Promise<{ blobs: Array<{ url: string }>; cursor?: string; hasMore: boolean }>; token?: string | undefined }): Promise<{ feitos: string[]; restam: string[]; motivo: 'ok' | 'sem_tempo' | 'erro' | 'blob_nao_configurado' }>`.
- Sem token (`BLOB_READ_WRITE_TOKEN` ausente ou vazio, lido no padrão do parâmetro): não tenta nada; `restam` = tudo; `motivo: 'blob_nao_configurado'`.
- **(emenda 1: S-I5) Servidor de teste de navegador nunca fala com o Blob real.** O Playwright e a conferência de UX sobem o servidor com o `.env.local`, que traz o token **de produção** (`docs/ops/runbook-cms-e2e-local.md:55-57`). Com `process.env.OBS_E2E === '1'` e `NODE_ENV !== 'production'` (a mesma guarda de `observatorio/now.ts:8`), o padrão do parâmetro `token` é `undefined`, qualquer que seja a variável: o desfecho é `blob_nao_configurado` e nenhuma chamada sai. Em produção a guarda é inerte (o teste prova os dois lados).
- Ordem: primeiro as URLs, em lotes de 100; lote que falha fica inteiro em `restam` e o laço **segue** para o próximo. Depois os prefixos, no máximo 2.000 por chamada: `list` paginado, `del` do que vier, e o prefixo só entra em `feitos` quando um `list` devolve vazio **depois** dos `del`.
- Antes de cada chamada confere o prazo; sem tempo, para e devolve `sem_tempo`.
- **(emenda 2: m-N3) Teto por chamada.** Conferir o prazo antes não basta: um `del` ou um `list` pendurado não volta, e quem chamou ficaria esperando além dos 5 s do cron e dos 20 s da tela. Cada chamada corre contra o menor entre o prazo que resta e 5 s, com `comPrazo` de `lib/youtube/agenda/relogio.ts` (só importado; o arquivo não é tocado). Estourou: o lote ou o prefixo daquela chamada fica em `restam`, o motivo é `sem_tempo`, e a função **para** (não segue para o próximo lote). Se a CP17 confirmar que `del` e `list` aceitam `abortSignal`, cada chamada recebe também um `AbortSignal.timeout` do mesmo tamanho, para a requisição ser cortada de fato; sem isso a chamada perdida segue viva até a função morrer (declarado em "o que nenhum teste prova").
- Só aceita prefixo que casa com `^observatorio/thumbs/[0-9a-f-]{36}/$` e URL que contém `/observatorio/thumbs/`; qualquer outra entrada vai para `restam` e o motivo vira `erro` (nunca se apaga fora da pasta do Observatório).

**Testes.** `apaga URLs e prefixo e devolve tudo em feitos`; `o Blob falha uma vez: a URL fica em restam; a segunda chamada conclui` (item 70); `lote de 250 URLs faz 3 chamadas de del`; `um lote falha e os outros seguem`; `prefixo com 2 páginas de list apaga as duas e confirma com a terceira vazia`; `list falha: o prefixo fica em restam mesmo com as URLs apagadas`; `sem tempo antes da segunda chamada: devolve o que fez e sem_tempo`; `sem token: nenhuma chamada e blob_nao_configurado` (o teste **apaga** `process.env.BLOB_READ_WRITE_TOKEN`); (emenda 1: S-I5) `com OBS_E2E=1 fora de produção e o token presente: nenhuma chamada e blob_nao_configurado`; `com OBS_E2E=1 em NODE_ENV=production o token vale` (a guarda não desliga o Blob em produção); `sem OBS_E2E (variável apagada) o token vale`; `entrada fora da pasta do Observatório não é apagada (prefixo "instagram/x/", URL de outro caminho, prefixo "observatorio/thumbs/" sem uuid)`; `lista vazia: nenhuma chamada, ok`; `nunca lança (del e list que lançam)`; (emenda 2: m-N3) `del que nunca volta: devolve sem_tempo dentro do teto da chamada (relógio falso), a URL fica em restam e nenhuma outra chamada sai`; `list que nunca volta: idem, o prefixo fica em restam`.
**Pronto quando:** testes verdes.

### Tarefa 6: serviço das respostas

**Objetivo.** As respostas como funções puras de orquestração (sem Next, sem leitura de sessão), para serem testadas inteiras.
**Arquivo.** `saiu/responder.ts`.
**Contrato.** Todas recebem `(sb, ctx: { siteId: string; actorId: string; ip: string | null; ua: string | null }, …)`, nunca lançam e devolvem `{ desfecho: Desfecho; codigo?: CodigoDeErro; faltam?: { miniaturas: number; pastas: number }; n?: number }`.
- `apagarVideo(sb, ctx, videoId, palavra, deps)`, `apagarCanal(sb, ctx, canalId, palavra, deps)`, `apagarComentarios(sb, ctx, canalId, ids, palavra)`: (1) `palavraConfere` (senão `palavra_errada`, sem ir ao banco); (2) a função SQL, com `p_janela_min = JANELA_FORJA_MIN` e o IP **validado** (`node:net` `isIP`; inválido vira `null`); (3) resposta que não é objeto com `status` conhecido: `erro` com `resposta_inesperada`; (4) `status 'apagado'`: `apagarDoBlob` com 20 s, depois `competitor_removed_blobs_done` com os `feitos`; sobrou algo, ou a gravação do feito falhou: `apagando` com `faltam`; (5) erro do banco mapeado: `57014` → `tempo_esgotado`, `40P01` → `impasse`, `23503` → `impedido_por_tabela`, o resto → `erro_de_banco`.
- `manter(sb, ctx, tipo, ids)` (ids de vídeo ou canal como texto, de comentário como número; até 500 por chamada), `decidirVolta(sb, ctx, itemId, 'voltar' | 'ignorar')`, `tentarDeNovo(sb, ctx, itemId, deps)` (lê `blobs_pending` da linha **do site**, apaga, grava).
- **(emenda 1: D-M10)** `ignorarVoltaDoGrupo(sb, ctx, itemIds: number[])`: a resposta "Não perguntar de novo" do grupo de comentários que voltou. Recebe os ids das linhas que a tela **mostrou** (até 500), chama `competitor_return_decide(…, 'ignorar')` para cada um, e devolve `{ desfecho, n }` com quantos mudaram. Não é uma transação só: cada chamada é independente e idempotente; se uma falhar, para, devolve `erro` com o `n` já feito, e a tela mostra o que restou (nada fica em estado que a tela não veja). Uma linha de auditoria por comentário, sem o id do YouTube (só `item_id`), como a função já grava: um clique grava até 500 linhas em `audit_log`. (emenda 2: N2) Grupo com **mais de 500** linhas (dois grupos de 300 apagados no mesmo canal que voltem somam 600): o serviço continua recusando 501 ids, e quem fatia é a tela: ela manda os **500 primeiros** (em ordem de `id`) e a resposta diz "N respondidos; ainda há M" (o padrão de "Manter todos"); o cartão continua na tela com os que restam e o segundo clique conclui. Sem isso a ação recusaria sempre, o cartão não sairia e o número da aba não desceria nunca.
- `concluirApagamentos(sb, siteId, o: { prazoMs; deps })`: para o cron; pega as linhas do site com `blobs_pending` não vazio, da mais antiga para a mais nova (com `order` e `limit` escritos: no máximo 50 por chamada), e roda `apagarDoBlob` enquanto houver prazo. Devolve `{ tentados, concluidos }`.
- **(emenda 1: S-m4)** `sitesComApagamentoPendente(sb): Promise<string[] | { erro: string }>`: os `site_id` distintos de `competitor_removed_items` com `blobs_pending` não vazio (no máximo 1.000 linhas lidas, ordenadas por `decided_at`). É de onde o cron tira os sites da conclusão, para ela não depender de o site ainda ter canal ativo. (emenda 2: N6) Limite declarado: com mais de um site e mais de 1.000 pendências num deles, as 1.000 linhas lidas podem ser todas do mesmo site e o outro fica sem a conclusão até a fila do primeiro descer. Hoje há um site (risco 10); fica na dívida.

**Testes (`saiu-responder.test.ts`).** `palavra errada não chama o banco`; `apagado com Blob ok devolve apagado e grava os feitos`; `apagado com Blob falhando devolve apagando com a contagem certa; tentarDeNovo depois conclui` (item 70, de ponta no serviço); `apagado com a gravação dos feitos falhando devolve apagando (nunca apagado)`; `no_ar, forja_em_andamento, not_found e mudou passam adiante sem tocar o Blob (conta zero chamadas)`; `resposta nula, lista, texto e status desconhecido viram erro com resposta_inesperada`; `erro 57014, 40P01, 23503 e outro viram o código certo`; `IP inválido vira nulo; IPv4 e IPv6 válidos passam`; `a janela passada é a constante importada`; `manter com lista vazia não chama o banco e devolve nada`; `manter com 501 ids recusa`; `tentarDeNovo de linha de outro site não acha e não chama o Blob`; `concluirApagamentos respeita o prazo e a ordem (mais antigo primeiro)`; (emenda 1) `ignorarVoltaDoGrupo: 7 ids, 7 chamadas, n = 7`; `a terceira falha: para, devolve erro com n = 2`; `lista vazia e 501 ids não chamam o banco`; `id de linha de outro site devolve nada e não conta`; `sitesComApagamentoPendente: erro devolve erro, nunca lista vazia`; `nenhuma chamada ao Sentry leva título (o banco falso devolve um título e o teste procura por ele nos argumentos)`.
**Teste (`saiu-janela-forja.test.ts`).** `a constante do vigia e a da recusa são a mesma`: lê `src/app/api/cron/youtube-intelligence-watchdog/route.ts` como texto, extrai `STALE_THRESHOLD_MINUTES = (\d+)` (falha se não achar: a varredura prova que olha para algo) e compara com `STALE_AFTER_MINUTES`.
**Pronto quando:** testes verdes.

### Tarefa 7: a sincronização consulta o apagado (obrigação D-11; Envio A)

**Objetivo.** Vídeo ou canal que o dono apagou não volta a ser coletado sem ele decidir. É a única tarefa que pode ir a produção antes da migration, e **tem de ir antes** de qualquer "apagar" existir.
**Arquivos.** `lib/youtube/competitor-removed.ts` (novo); `competitor-sync.ts` (três pontos: emenda 1: S-m2); `actions.ts` (`addCompetitorChannel`); testes.
**Contrato (`competitor-removed.ts`).**
- `apagadosDaPagina(sb, o: { siteId: string; videoIds: readonly string[]; nowIso: string }): Promise<{ pular: Set<string>; vistosAgora: number } | { erro: string }>`: lista vazia não vai ao banco. `select youtube_id, return_decision, returned_seen_at from competitor_removed_items` com `site_id`, `kind = 'video'` e `youtube_id in (…)`. `pular` = os que têm `return_decision` diferente de `'voltar'` (nulo ou `'ignorar'`). Os com `returned_seen_at` nulo e `return_decision` nulo recebem `returned_seen_at = nowIso` num `update` com os mesmos três filtros; se o `update` falhar, devolve `{ erro }` (o item continuaria fora da tela de "voltou").
- `canalApagado(sb, siteId, youtubeChannelId): Promise<{ apagadoEm: string; itemId: number } | null | { erro: string }>`.

**Mudança em `competitor-sync.ts`** (confira as linhas antes: o arquivo é vivo). (a) Logo depois de `existingMap` (hoje linha 1064) e **antes** de `probeCandidates` (hoje 1085): `novos` = os ids de **`videosData.items`** (o que `videos.list` devolveu) que não estão em `existingMap`; se houver, chama `apagadosDaPagina` com eles. (emenda 1: S-I1 e D-I1) A primeira versão montava `novos` a partir de `videoIds`, que é a lista de **envios** (`competitor-sync.ts:1042-1048`). O id que a lista de envios cita e `videos.list` não devolve é exatamente como a E1 marca ausência (`asked` na linha 1070, `missedIds` em 872 e 1341): um vídeo apagado que continua privado entraria em `novos` a cada disparo e ganharia `returned_seen_at`, e a aba diria "Voltou ao ar" para um vídeo que não voltou. O carimbo de volta só vale para id que o YouTube **devolveu**. Erro: registra pelo `late('não foi possível conferir os vídeos já apagados', …)` que o arquivo já usa e marca a página para **não inserir nenhum vídeo novo**. (a2) (emenda 1: S-m2) O filtro de `probeCandidates` (hoje linha 1087) ganha `&& !semConferencia && !pular.has(v.id)`: sem isso cada disparo gastaria sonda de Shorts com o apagado que reaparece e será pulado. (b) No laço do vídeo, o mais cedo possível e antes de qualquer gravação (inserção, versões, miniatura, série): `if (!existing && (semConferencia || pular.has(videoId))) continue`. O vídeo pulado não conta como "conhecido" para a parada incremental, não entra em `asked` nem em `seen`. `SyncResult` ganha `removedSkipped?: number` (opcional, para não quebrar quem lê o resultado).
**Mudança em `addCompetitorChannel`.** Depois da conferência de duplicata e antes das vagas: `canalApagado`. Erro: devolve `{ ok: false, error: 'Não foi possível conferir se este canal já foi apagado. Tente de novo.' }` (não adiciona). Achou: guarda o achado e **segue** para as vagas e o `insert`. (emenda 1: S-m1) **Só depois do `insert` bem-sucedido** (`actions.ts:116`) grava `returned_seen_at` (se nulo), `return_decision = 'voltar'` e `return_decided_at` na linha e insere em `audit_log` a ação `competitor_return_follow` (com `site_id`, `org_id` de `getSiteContext`, e `after_data` só com `kind` e `youtube_id`): sem vaga, ou com falha no `insert`, não fica auditoria de uma volta que não aconteceu. Se essa gravação falhar com o canal já inserido, o canal fica (nenhuma rotina lê `return_decision` de canal), a falha vai ao Sentry com o código e sem o nome, e o aviso diz "não foi possível registrar a volta na fila". A resposta de sucesso ganha `aviso: 'Você apagou este canal em dd/mm; ele entra de novo como novo, sem o histórico.'`.
**Testes (`competitor-removed.test.ts`).** `lista vazia não vai ao banco`; `nenhum apagado: pular vazio`; `apagado sem resposta: pula e carimba a volta`; `apagado já visto: pula e não carimba de novo`; `ignorar: pula e não carimba`; `voltar: não pula`; `apagado em outro site não bloqueia`; `linha de canal com o mesmo id não bloqueia vídeo`; `select com erro devolve erro`; `update do carimbo com erro devolve erro`; `tabela ausente devolve erro (não "nenhum apagado")`.
**Testes novos em `competitor-sync-a5.test.ts`** (o banco falso `competitor-sync-harness.ts` ganha a tabela `competitor_removed_items`, vazia por padrão: todos os testes existentes continuam verdes sem mudança). `vídeo apagado na página não é inserido, não ganha versão, miniatura nem série (conta as gravações)`; `os outros vídeos novos da mesma página entram`; `apagado com "voltar" entra como novo, com discovered_at de agora`; `a consulta falha: nenhum vídeo novo da página entra, os já gravados são atualizados, e o erro aparece no resultado`; `página sem vídeo novo não consulta (conta zero chamadas)`; `removedSkipped conta`; `o vídeo pulado não para a leitura incremental`. (emenda 1: S-I1, D-I1, S-m2) `apagado que a lista de envios ainda cita mas videos.list não devolve: não é inserido e NÃO ganha returned_seen_at` (o teste de `competitor-removed.test.ts` não basta: o erro estava em quem monta a lista); `página em que só a lista de envios traz id desconhecido não consulta (conta zero chamadas)`; `o apagado que reaparece não entra na sonda de Shorts (conta as chamadas da sonda)`.
**Teste de `addCompetitorChannel`** (no arquivo de teste de ações que o HEAD tiver para ela; se não houver, em `test/youtube/competitor-removed.test.ts`, com a ação importada): `canal apagado readicionado registra a volta e avisa`; `a conferência falha: não adiciona`; `canal nunca apagado: nada muda`. (emenda 1: S-m1) `sem vaga: não registra a volta nem audita`; `o insert falha: não registra a volta`; `o registro da volta falha depois do insert: o canal fica e o aviso diz`.
**Pronto quando:** testes verdes; `cache-writers.test.ts` e `competitor-actions-schema-guard.test.ts` continuam verdes; mutações de `site_id` e `kind` feitas e anotadas; commit **separado** dos demais (é o Envio A).

### Tarefa 8: a prova no cron e a conclusão de apagamentos

**Objetivo.** O cron de concorrentes prova a cada disparo que nenhum ausente perdeu linhas, acusa apagamento pela metade e termina o que ficou no Blob.
**Arquivos.** `lib/youtube/competitor-missing-proof.ts` (novo); `sync-youtube/route.ts` (o lote antigo); `lib/youtube/agenda/fecho.ts` e `lib/youtube/agenda/executar.ts` (o caminho da agenda, que é o normal; emenda 1: S-C1); testes.
**Contrato.**
- `provaLigada(env = process.env): boolean` (`OBS_PROVA_AUSENTES` diferente de `'off'`, sem diferenciar maiúsculas; ausente = ligada).
- `readMissingProof(sb, siteId, nowIso): Promise<VereditoDosAusentes>`, com `type VereditoDosAusentes = HealthVerdict & { numeros: ProvaDosAusentes | null }` (o tipo `{ ok, problems, notes }` de `competitor-health.ts`, só importado; `numeros` são as dez chaves validadas, ou nulo quando não foi possível ler): `schemaE9` antes; lê `competitor_missing_proof`; valida as dez chaves (nove inteiros não negativos; `mais_antigo_dias` inteiro ou nulo). Vereditos: os da seção 6. (emenda 2: m-N5) **`readMissingProof` nunca lança:** qualquer exceção (do cliente, da guarda de schema, da validação) é capturada dentro dela e vira o veredito `não foi possível ler`, com `numeros` nulo. Motivo: se ela lançasse, quem responderia seria o `catch` de `readProofWithin`, cuja frase é "não foi possível ler a prova da captura e da série" (`agenda/fecho.ts:66`), e o prefixo produziria "prova dos ausentes: não foi possível ler a prova da captura e da série", que aponta para a prova errada.
- **(emenda 1: S-C1, S-I2, D-M6)** `provaDosAusentes(sb, siteId, nowIso, dentroDoPrazo: (ler: () => Promise<HealthVerdict>) => Promise<HealthVerdict>, env = process.env): Promise<VereditoDosAusentes>`: **a única função que os dois caminhos do cron chamam.** Desligada: `{ ok: true, problems: [], notes: ['prova dos ausentes desligada (OBS_PROVA_AUSENTES=off)'], numeros: null }`, sem ir ao banco. Ligada: `dentroDoPrazo(() => readMissingProof(…))` (quem chama passa `ler => readProofWithin(ler, proofMs)`; o módulo **não importa** `agenda/fecho.ts`, que vai importá-lo: sem ciclo), e todo problema que não começar por `prova dos ausentes: ` ganha esse prefixo (as frases de `readProofWithin` são genéricas: "não foi possível ler a prova a tempo" não diz qual prova). (emenda 2: m-N4) **Como `numeros` atravessa `dentroDoPrazo` sem cast:** o tipo de `readProofWithin` é `(read: () => Promise<HealthVerdict>, timeoutMs: number) => Promise<HealthVerdict>` (`agenda/fecho.ts:65`), então o que volta dele **não** tem `numeros`. `provaDosAusentes` guarda o resultado por fechamento: `const caixa: { lido: VereditoDosAusentes | null } = { lido: null }; const v = await dentroDoPrazo(async () => (caixa.lido = await readMissingProof(…)))` (um objeto, não um `let`: o TypeScript estreita para `null` um `let` atribuído dentro de fechamento). Os números só valem quando o veredito que voltou **é** o da leitura (`caixa.lido !== null && v === caixa.lido`); no estouro de prazo o veredito que volta é o de `readProofWithin` e `numeros` é nulo, mesmo que a leitura termine depois. Nenhum `as` é preciso.
- `fecharApagamentos(sb, o: { prazoMs; deps; env? }): Promise<{ tentados: number; concluidos: number; sites: string[]; erro?: string }>`: com a prova desligada não roda (devolve zeros); senão lê `sitesComApagamentoPendente` (emenda 1: S-m4: os sites vêm das pendências, não da lista de canais ativos) e chama `concluirApagamentos` por site, dentro do prazo; nunca lança. `sites` são os que tiveram algo concluído (para invalidar o cache).

**A ligação no cron, nos DOIS caminhos** (emenda 1: S-C1 e S-I2; este parágrafo substitui "o bloco em `route.ts` depois de `verdicts`"). A primeira versão pendurava a prova só em `route.ts:215`, que com a agenda ligada **não roda** (`route.ts:89-92`: `executarAgenda` responde e a rota retorna); a prova, o vermelho de 24 h, o "schema ausente" e a conclusão de apagamentos nunca rodariam no caminho normal, com o cron verde. E mandava rodar depois de `verdicts`, em sequência, o que estoura o tempo do disparo (seção 5).
- **Caminho da agenda (`agenda/fecho.ts`, `fecharDisparo`).** No `Promise.all` interno de cada site (hoje linhas 195-202, que já tem a prova da série e a horária) entra um **terceiro** elemento: `provaDosAusentes(sb, siteId, nowIso, ler => readProofWithin(ler, proofMs))`. `prova` passa a ser `juntar` das duas (série e ausentes) de todos os sites, então o problema entra em `vermelho` e em `mensagem` pelo caminho que já existe (`failureMessage`, campo `prova`). `Fechamento` ganha `provaAusentes: Array<ProvaDosAusentes | null>` (um por site, sem o id do site).
- **Caminho da agenda (`agenda/executar.ts`).** Depois do passo 10 (o aviso ao dono, hoje linhas 301-306) e antes da resposta: se `LIMITE_FUNCAO_MS - FOLGA_FIM_MS - (agora() - t0) >= 8000`, `fecharApagamentos` com `prazoMs: 5000`, dentro de `try` (nunca muda a resposta nem o `cron_health`, que já foi gravado); `invalidateObservatory` de cada site devolvido. O corpo da resposta ganha `prova_ausentes: f.provaAusentes` e `apagamentos`.
- **Lote antigo (`route.ts`).** O `Promise.all` da linha 215 passa a ler as duas provas por site, juntas: `Promise.all(result.healthSiteIds.map(async siteId => Promise.all([readProofWithin(() => readSiteHealth(…), proofMs), provaDosAusentes(supabase, siteId, nowIso, ler => readProofWithin(ler, proofMs))])))`, e `prova` é composta do achatado. Depois de `recordCronFailure`/`recordCronSuccess` e antes do `return`: a mesma condição de tempo com `FUNCTION_LIMIT_MS - 3000`, `fecharApagamentos` com 5 s. O retorno ganha os mesmos dois campos.
- `readProofWithin` já devolve veredito não ok no estouro (`agenda/fecho.ts:65-76`, conferido pelos dois revisores): não se toca o auxiliar.
- (emenda 2: m-N3) Nos dois caminhos a chamada de `fecharApagamentos` vai dentro de `comPrazo(…, 6000)` (`agenda/relogio.ts`, já existe): se uma ida ao banco ou ao Blob pendurar, o disparo responde e grava o `logCron` mesmo assim. O `cron_health` já estava gravado e o arrendamento vence sozinho, então o que se perdia era só a resposta do disparo.
- (emenda 2: m-N1) **Testes que já existem e passam a cair sem um falso do módulo novo.** `test/youtube/cron-competitors-agenda.test.ts` cria o cliente como `{}` (linha 11), põe `healthSiteIds: ['s1']` (linha 53) e afirma `recordCronSuccess` (linha 175), com `competitor-health` falso e o módulo novo **não**: `provaDosAusentes({}, 's1')` cairia em "não foi possível conferir o schema" e o disparo ficaria vermelho. Ele ganha `vi.mock('@/lib/youtube/competitor-missing-proof', …)` devolvendo verde com `numeros` zerados por padrão (o `beforeEach` dele faz `vi.resetAllMocks()`: o valor padrão é reposto ali). Antes de começar, o implementador roda `grep -rln "sync-youtube/route\|executarAgenda\|fecharDisparo" apps/web/test` (hoje onze arquivos, conferido) e, para cada um que afirme verde com site na lista, acrescenta o mesmo falso; os que a lista fechada já autoriza são os quatro nomeados na linha da Tarefa 8 na tabela da seção 9, e neles só entra a linha do falso. Outro arquivo que precise: a tarefa para e avisa. `test/integration/agenda-despacho.test.ts` **não** recebe falso (roda contra o banco): é a CP18.
- Lista de sites vazia ou nula: a decisão que cada caminho já toma continua sendo dele (este plano não a muda); a prova dos ausentes não roda para site fora da lista (risco 12).
**Testes (`competitor-missing-proof.test.ts`).** `variável ausente: ligada` (o teste **apaga** `process.env.OBS_PROVA_AUSENTES`); `off, OFF e " off " desligam; vazio, 0 e false não`; `schema ausente: vermelho com o texto`; `erro do banco, exceção, nulo, lista, chave faltando, número negativo e texto no lugar de número: vermelho "não foi possível ler" (sete casos)`; `tudo zero: verde sem nota`; `queda: vermelho com a contagem`; `apagando há mais de 1 dia: vermelho`; `apagando há menos de 1 dia: verde`; `itens esperando: nota com a contagem e os dias, e continua verde`; `voltaram sem resposta: nota`; `fecharApagamentos não lança e respeita o prazo`. (emenda 1) `provaDosAusentes desligada: nota fixa, numeros nulo e zero chamadas ao banco`; `provaDosAusentes prefixa as frases de readProofWithin ("prova dos ausentes: não foi possível ler a prova a tempo (passou de 20 s)") e não duplica o prefixo de quem já tem`; `provaDosAusentes devolve os números quando lê`; `fecharApagamentos tira os sites das pendências, não de uma lista recebida`; `fecharApagamentos com a prova desligada não chama nada`; `o módulo não importa agenda/fecho (leitura do arquivo)`. (emenda 2: m-N4, m-N5) `leitura que lança: readMissingProof devolve "não foi possível ler" e a frase final não cita captura nem série`; `estouro de prazo: numeros é nulo mesmo que a leitura termine depois (relógio falso)`; `o módulo não tem "as unknown as" (leitura do arquivo)`.
**Testes novos em `cron-competitors-prova.test.ts`.** `a prova dos ausentes vermelha deixa o disparo vermelho com a frase`; `prova desligada: nota no retorno e o disparo não fica vermelho por ela`; `a prova dos ausentes que não responde a tempo é vermelho, não verde`; `sem tempo sobrando, fecharApagamentos não é chamado`; `os testes que já existem continuam verdes sem mudança de expectativa` (o falso da prova nova devolve zeros por padrão).
**Testes novos no caminho da agenda** (emenda 1: S-C1 e S-I2; sem `OBS_AGENDA=off`). Em `test/youtube/agenda/fecho.test.ts` (`describe('fecharDisparo')`): `a prova dos ausentes vermelha deixa o disparo da agenda vermelho, com a frase na mensagem`; `sem a MG-E9 o disparo da agenda fica vermelho com "schema ausente"`; `a prova dos ausentes desligada vira nota e não deixa vermelho`; `as duas provas penduradas: o fecho volta dentro de proofMs, não de duas vezes proofMs (relógio falso)`; `provaAusentes traz as dez chaves por site`. Em `test/youtube/agenda/executar.test.ts`: `com tempo, o disparo da agenda chama fecharApagamentos depois de gravar cron_health (ordem das chamadas)`; `sem tempo, não chama`; `fecharApagamentos que lança não muda a resposta`; `a resposta traz prova_ausentes`; (emenda 2: m-N3) `fecharApagamentos que nunca volta: o disparo responde em até 6 s (relógio falso)`. Em `cron-competitors-prova.test.ts` (lote antigo): `as duas provas penduradas: o disparo grava a falha dentro do prazo (relógio falso)`.
**Varredura** (em `competitor-missing-proof.test.ts`, lê `apps/web/src`): `todo arquivo que chama readSiteHealth( chama também provaDosAusentes(` (hoje são dois: `route.ts` e `agenda/fecho.ts`; a lista achada não pode ser vazia), para um terceiro caminho futuro não nascer sem a prova. (emenda 2: m-N6) A busca literal acha **três** arquivos, porque pega a própria declaração (`lib/youtube/competitor-health.ts:246`, `export async function readSiteHealth(`): a varredura exclui a declaração (padrão `(?<!function )readSiteHealth\(`) e o teste afirma a lista exata dos dois, com um caso que prova que a declaração foi excluída de propósito.
**Pronto quando:** testes verdes; `cron-competitors-agenda.test.ts`, `cron-competitors-invalidate.test.ts`, `cron-route.test.ts`, `test/api/cron/sync-youtube.test.ts` e a pasta `test/youtube/agenda/` inteira verdes; a MG-E9 aplicada no `bythiago_int` pelo controlador e a CP18 anotada (emenda 2: m-N1 e m-N2); mutação do filtro de site da função feita na Tarefa 2 e citada aqui; mutação nova (emenda 1: S-C1): tirar a chamada de `provaDosAusentes` de `fecho.ts` faz cair o teste do disparo da agenda vermelho.

### Tarefa 9: ações de servidor e dados da página

**Objetivo.** A porta de entrada: guarda, depois serviço. Nenhuma regra aqui.
**Arquivos.** `_saiu/actions.ts`, `_saiu/dados.ts`; `actions.ts` (só `removeCompetitorChannel`); testes. **(reconciliação 13/10: R10)** O teste `acoes-recusam-leitora.test.ts` do passo 0 da E17 percorre só três módulos de ações (`actions.ts`, `niche-actions.ts`, `forja-actions.ts`) e não enxerga `_saiu/actions.ts`: se ele já existir, esta tarefa acrescenta o quarto módulo à lista dele, com as ações daqui classificadas; se não existir, `saiu-actions.test.ts` prova sozinho a recusa para quem só lê (a usuária com o direito de desempenho privado e sem edição).
**Contrato (`_saiu/dados.ts`, `import 'server-only'`).** `abrirFila(mostrar: number): Promise<LeituraDaFila>`: `getSiteContext`; `requireSiteScope({ area: 'cms', siteId, mode: 'edit' })` (não passou: `{ estado: 'sem_acesso' }`, sem criar cliente de serviço); `requireSiteAdminScope` só para preencher `podeResponder`; `lerFila`. `contarParaAAba(): Promise<{ visivel: false } | { visivel: true; n: number | null }>` com a mesma guarda de edição.
**Contrato (`_saiu/actions.ts`, `'use server'`).** `manterItens`, `apagarItem`, `responderVolta`, `tentarApagarDeNovo` e, pela emenda 1 (D-M10), `ignorarVoltaDoGrupo` (cinco ações). Em todas, nesta ordem: (1) `denyUnlessSiteAdmin(siteId, 'responder à fila Saíram do YouTube')`: recusou, devolve `{ desfecho: 'sem_permissao' }` **antes** de `getSupabaseServiceClient()`; (2) `requireSiteScope` de edição para obter o id do usuário; (3) valida a forma da entrada (uuid, inteiro positivo, tipo da lista fechada; inválido: `erro`); (4) `schemaE9`; (5) o serviço da Tarefa 6; (6) em todo desfecho que mudou o banco (`apagado`, `apagando`, `mantido`, `ok` da volta), `invalidateObservatory(siteId)` e `revalidatePath('/cms/youtube/competitors', 'layout')`. O IP e o agente saem de `headers()` (`x-forwarded-for`, primeiro valor; `user-agent` cortado em 300 caracteres). (emenda 1: S-m11) O `siteId` vem **sempre** de `getSiteContext()`, nunca de argumento da ação nem do cliente; o que o cliente manda são ids de item, e é o filtro de site das funções que os recusa. A quinta ação, `ignorarVoltaDoGrupo` (emenda 1: D-M10), segue a mesma ordem.
**Mudança em `removeCompetitorChannel`.** Depois da guarda e antes do `delete`: lê `missing_since` do canal (com `id` e `site_id`); preenchido, devolve `{ ok: false, error: 'Este canal saiu do YouTube: responda na aba Saíram do YouTube.' }`; a leitura falhou, `{ ok: false }` (não apaga sem saber). (emenda 1: D-M7) Canal **no ar**: duas contagens (`head: true, count: 'exact'`) dos vídeos e dos comentários dele com `missing_since` preenchido e `removal_decision` nulo; soma maior que zero, devolve `{ ok: false, error: 'Este canal tem N itens esperando resposta na aba Saíram do YouTube: responda primeiro.' }`; contagem que falha, `{ ok: false }`. Item já mantido não bloqueia (a decisão do dono existe e está auditada). **(reconciliação 13/10: R7)** A Tarefa 11b do plano da E10 edita a mesma função: troca o `delete` direto por `removerCanalArquivado` (canal no ar só sai com lote exportado e confirmado). Forma final, em qualquer ordem de chegada: guardas de acesso, depois as recusas desta tarefa, depois a chamada da E10. Se a 11b de lá já estiver aplicada, "antes do `delete`" lê-se "antes de `removerCanalArquivado`", e o par `competitors/actions.ts` **não** entra no conjunto do teste da Tarefa 11 (não há mais `.delete(` ali).
**Testes (`saiu-actions.test.ts`).** `sem administrar: nenhuma das cinco ações cria o cliente de serviço (o mock lança se for chamado) e devolve sem_permissao` (cinco casos, com a da emenda 1: é o item 71); `sem sessão: idem`; `entrada malformada não chega ao serviço (uuid inválido, id de comentário negativo, tipo desconhecido, lista com 501)`; `schema ausente: erro com o código, sem chamar o serviço`; `desfecho que muda o banco invalida e revalida; no_ar, forja_em_andamento, not_found, mudou, palavra_errada e erro não invalidam`; `IP: primeiro valor do cabeçalho; ausente vira nulo`; `abrirFila sem edição devolve sem_acesso sem cliente de serviço`; `podeResponder falso para quem edita e não administra`; `remover canal que está na fila recusa com a frase; canal no ar segue como antes; leitura que falha não apaga`. (emenda 1: S-m11, D-M7, D-M10) `ação com id de item de outro site devolve not_found (o site vem do contexto, e o teste manda um siteId falso no corpo, que é ignorado)`; `remover canal no ar com 2 vídeos e 1 comentário esperando recusa com "3 itens"`; `canal no ar só com item mantido é removido como antes`; `contagem que falha não apaga`; `ignorarVoltaDoGrupo sem administrar não cria o cliente de serviço`.
**`cache-writers.test.ts`.** `WRITES` ganha `rpc\('(?:competitor_video_purge|competitor_channel_purge|competitor_missing_keep)'`; `KNOWN_WRITERS` ganha `lib/youtube/observatorio/saiu/responder.ts` (é onde as chamadas `rpc` moram); o teste de `actions.ts` não muda de contagem (a recusa nova não invalida). (emenda 2: I-N1) Esta tarefa edita o vetor **já com** a troca da Tarefa 11a (`lib/youtube/competitor-snapshot-prune.ts` no lugar de `app/api/cron/ab-watchdog/route.ts`): a 11a commita antes. Se a 11a ainda não estiver commitada quando a 9 começar, a 9 espera (não faz a troca por ela, e não deixa o teste vermelho). Um teste novo: `quem chama o serviço das respostas invalida`: todo arquivo fora de `lib/` que importa `saiu/responder` contém `invalidateObservatory(`.
**Pronto quando:** testes verdes; `cache-invalidation-actions.test.ts` verde.

### Tarefa 10: a tela e a aba

**Objetivo.** A aba "Saíram do YouTube", fiel ao mockup aprovado, com as divergências da seção 8 e nenhuma outra.
**Antes de começar.** `git status` limpo para `_chrome/view-model.ts`, `_chrome/chrome-server.tsx`, `_chrome/icons.tsx` e `observatorio/links.ts`; copiar a pasta do mockup para `.superpowers/sdd/a5-e9/mockup-congelado-13-10/` (referência fixa, como na A4).
**Divisão em duas (emenda 1: S-m9).** **10a, a aba:** `observatorio/links.ts`, os três arquivos de `_chrome/` e o teste do chrome ("sem o campo, idêntico"). É a parte que toca arquivo da A4: pequena, com commit próprio, revertível sozinha. Enquanto a 10b não existir, `chrome-server.tsx` **não** passa `fila` (a aba não aparece apontando para rota inexistente): a chamada de `contarParaAAba()` entra no commit da 10b. (emenda 2: m-N8) Por isso `_chrome/chrome-server.tsx` é tocado pelas **duas**: a condição "limpo no `git status`" e o aviso ao controlador valem de novo antes da 10b, e o teste "sem o campo, idêntico" é rodado de novo no commit dela. **10b, a tela:** `saiu/page.tsx`, `_saiu/*`, os testes da tela, e a linha de `chrome-server.tsx` que liga a contagem. Cada uma fecha com typecheck e os seus testes verdes.
**Arquivos e contrato.**
- `observatorio/links.ts`: `saiu(p?: { mostrar?: number }): string` (`OBS_BASE + '/saiu'`).
- `_chrome/view-model.ts`: `ChromeTab` ganha `'saiu'`; `buildChromeView` ganha o campo opcional `fila?: { n: number | null } | null`. Ausente ou `null`: as quatro abas de hoje, idênticas. Presente: quinta aba "Saíram do YouTube", `count` = `n`, e com `n` nulo o rótulo do contador é "?" e o `title` "não foi possível contar a fila".
  (emenda 1: S-m8) Como `'saiu'` entra sem tocar o pacote em cache: `TABS` continua com as quatro, tipada como `readonly AbaDoPacote[]`, com `type AbaDoPacote = Exclude<ChromeTab, 'saiu'>`; os três registros `countOf`, `titleOf` e `hrefOf` (`view-model.ts:49-55`) passam a `Record<AbaDoPacote, …>` e continuam lendo `obs.tabCounts` como hoje; a quinta aba é **acrescentada** ao vetor depois do `map`, só quando `fila` vem, com o `count` de `fila.n` e o `href` de `link.saiu()`. `coworkText` (`view-model.ts:106-108`) fica tipado com as quatro abas e `'historico'`: a fila não vai ao Cowork (seção "Fica fora"); se o mockup aprovado mostrar o botão do Cowork nesta aba, parar e avisar. Os dois testes que tipam listas de abas, `test/youtube/observatorio/meu-canal.test.tsx:181` e `topo-telas-a3.test.tsx:45`, não são editados e têm de continuar verdes (as listas deles são as quatro de hoje).
- `_chrome/chrome-server.tsx`: chama `contarParaAAba()` (em paralelo com o que já faz) e passa `fila`.
- `saiu/page.tsx`: `dynamic = 'force-dynamic'`, `maxDuration = 60`, `metadata`; lê `?mostrar=` (inteiro, múltiplo de 10, entre 10 e 200; inválido vira 10); `abrirFila`; monta o view model; passa as cinco ações por prop (emenda 1: eram quatro).
- `_saiu/view-model.ts` (puro): `buildFilaView(leitura, o: { agoraMs; mostrar })` com tudo o que a tela escreve: frase-resumo, barra por tipo (número e proporção), cartões, painel (linhas de "o que some", "o que fica", "o que não sai"), blocos "Voltaram ao ar", "Apagando" e "Já respondidos", "Mostrar mais N", e os estados de erro. Datas em São Paulo, `dd/mm`.
- `_saiu/fila-screen.tsx` (servidor) e `_saiu/painel-apagar.tsx` (`'use client'`: o campo, o botão `disabled`, o foco, o Esc, o envio e a mensagem do desfecho; recebe as ações por prop).
- `_saiu/saiu.css`: as classes do mockup (`sq-*`), com as cores e os símbolos de lá. Cor nunca é o único sinal: cada tipo tem ícone e rótulo; "Apagando", "Mantido" e "Apagado" têm ícone e palavra. Nenhum `color-mix()` em cor de que a leitura dependa (regra do projeto: o Opera o desenha transparente).

**Testes (`saiu-view-model.test.ts`).** Um por caso do mockup, com os números do exemplo: `cheia: "5 itens esperando você e 2 apagando", barra 3 vídeos, 1 canal, 1 grupo, contador 7`; `vazia com leitura recente e sem leitura recente: as duas frases`; `sem canais`; `canal inteiro: "um item só, não um por vídeo", com os N vídeos`; `comentários: "7 comentários de 2 vídeos" e os vídeos com a contagem`; `painel do vídeo: as linhas na ordem do mockup, zero omitido, tabela desconhecida com o nome`; `painel: "o que fica" com o código e sem título`; `painel: linha das leituras de nicho e linha do NAS com o texto novo`; `recusa: "até 30 minutos" vindo da constante (com 45 escreve 45)`; `apagando: "faltam 3 miniaturas"; só pastas: "falta conferir 2 pastas"; sem botões de NAS`; `voltou apagado: só o código e as duas datas, dois botões; comentário: um botão`; `voltou mantido: sem botão`; `respondidos: mantido com "Apagar…"; apagado só com código e data; comentário apagado como contagem por canal`; `25 itens: mostra 10 e "Mostrar mais 10"; com mostrar=20 mostra 20 e "Mostrar mais 5"`; `"Manter todos" leva só os ids mostrados`; `sem poder responder: botões desabilitados com a frase`; `item com prévia em erro: sem "Guardado" e sem apagar`; `erro e schema ausente: a frase, e nenhum bloco de lista`; `dias esperando: 0 é "hoje", 1 é "1 dia"`; `nenhum campo nulo vira 0 ou texto vazio ("não registrado"; "antes de 12/10")`. (emenda 1: D-M9, D-M10, D-I2, D-I3, D-M2, S-m6) `comentários que voltaram: um cartão por canal com "N comentários que você apagou voltaram a aparecer" e um botão`; `item que está apagando e voltou: fica em "Apagando" com a linha "voltou ao ar em dd/mm", e o contador o conta uma vez`; `já respondidos com 51 apagados: 50 e "e mais 1"`; `painel de comentários: "3 comentários e 1 resposta do criador"`; `painel de canal: a linha das notificações antigas; painel de vídeo não a tem`; `resposta "voltar": a frase com a condição`. (emenda 2: N2) `grupo de comentários que voltou com 600 linhas: o botão leva os 500 primeiros ids (em ordem) e o cartão diz que são 600`; `depois da resposta: "500 respondidos; ainda há 100", e o cartão continua com os 100`.
**Testes de componente.** `saiu-painel-apagar.test.tsx` (jsdom): `o botão nasce disabled de verdade (atributo, não aria)`; `digitar "apagar " habilita; apagar um caractere desabilita`; `abrir põe o foco no campo`; `Esc fecha e devolve o foco ao botão que abriu`; `enviar chama a ação uma vez e desabilita durante o envio (duplo clique não manda duas)`; `desfecho de recusa mostra a frase em role="alert" e mantém o painel`; `com a forja em andamento na prévia, o campo já nasce desabilitado`. `saiu-fila-screen.test.tsx`: `cada bloco só aparece com item`; `a aba tem o contador`; `nenhuma ação é importada pelo componente cliente` (leitura do arquivo: não há `from '../_saiu/actions'` em arquivo com `'use client'`).
**Teste do chrome** (no arquivo de teste do `view-model` do chrome que o HEAD tiver): `sem o campo fila, as abas e os hrefs são exatamente os de hoje`; `com fila { n: 7 } há a quinta aba com 7`; `com n nulo o contador é "?"`.
**Pronto quando:** testes verdes; `npm run typecheck -w apps/web` limpo; nenhum arquivo de `_canal/`, `_proprio/` ou `observatorio/proprio/` tocado.

### Tarefa 11: "sem resposta o dado fica" (varredura e 400 dias)

**Objetivo.** Os itens 67 e 231, na parte que é desta etapa.
**Divisão (emenda 2: I-N1).** **11a, a poda:** `competitor-snapshot-prune.ts`, `ab-watchdog/route.ts`, `test/cron/ab-watchdog-competitor-history.test.ts` e a troca em `cache-writers.test.ts`, num commit só, sem depender de outra tarefa e **antes** da Tarefa 9. **11b, a varredura e os 400 dias:** depois das Tarefas 2, 7, 8 e da 11a.
**`saiu-varredura.test.ts`** (estático, lê arquivos). (reconciliação 13/10, emenda 2: S2-m3) Antes de escrever a lista de nomes, ler `.superpowers/sdd/a5/fila-do-db-push.md`, seção "pares e classificações pendentes": a E10 (MG6) e a E4 (MG4) deixam lá os nomes que este teste tem de conhecer se chegaram antes dele. Entram no commit que cria o teste, e a linha sai do arquivo no mesmo commit. (reconciliação 13/10, emenda 3: n6) **Arquivo ausente: parar e perguntar ao controlador. Ausente não é vazio** (quem cria o arquivo é o controlador, antes do primeiro `db:new`; em 13/10 ele ainda não existe).
- `a varredura enxerga o que procura`: acha as três funções de apagar no arquivo da migration e `del(` em `saiu/blob.ts` (lista não vazia; um exemplo ruim inventado no teste é pego).
- `funções SQL que apagam de tabela competitor_*: lista fechada`: varre `supabase/migrations/*.sql` por `delete from (public\.)?competitor_` e, para cada ocorrência, o nome da função em que está; o conjunto tem de ser exatamente `{ competitor_video_purge, competitor_channel_purge, competitor_comments_purge, competitor_comment_identity_purge, <a função da MG10 que solta o arrendamento> }` mais o que a CP12 achar no dia, cada um com a linha de 9.2 que o autoriza escrita ao lado. **(reconciliação 13/10: R6) Já se sabe de dois, se os arquivos existirem no dia:** `competitor_channel_remove_archived` (MG6 da E10: remoção de canal com lote confirmado, linha 2 de 9.2) e `competitor_marks_apply` (MG4 da E4: apaga só de `competitor_video_marks` e `competitor_video_mark_misses`, regravando a decisão da própria tarefa). No sentido contrário, no mesmo commit desta tarefa: as três funções de apagar daqui entram em `observatorio-a5-e10-lista-fechada.test.ts` e `saiu/blob.ts` entra como segundo par da varredura de `del(` de `lista-fechada-do-que-apaga.test.ts`, se esses testes da E10 já existirem.
- `no TypeScript desta etapa, só blob.ts apaga, e só do Blob`: nenhum `.delete(` em `lib/youtube/observatorio/saiu/**`, `_saiu/**`, `competitor-removed.ts`, `competitor-missing-proof.ts`.
- `a sincronização e o cron de concorrentes não ganharam delete`: zero `.delete(` em `competitor-sync.ts`, em `app/api/cron/sync-youtube/route.ts` e em `lib/youtube/agenda/**`.
- (emenda 1: S-I4) `todo .delete( sobre tabela competitor_* no TypeScript: lista fechada`: varre **todo** `apps/web/src` por `.from('competitor_…')` seguido de `.delete(` (até 6 linhas adiante: a chamada do `ab-watchdog` é quebrada em linhas) e exige o conjunto exato, cada um com a sua linha de 9.2 escrita ao lado: `lib/youtube/competitor-snapshot-prune.ts` (poda de retratos de canal, 365 dias, **menos os de canal ausente**; saiu de `app/api/cron/ab-watchdog/route.ts`), `competitors/actions.ts` (remover canal no ar), `lib/pipeline/services/forja-queue.ts` (duas: leitura órfã da forja). A primeira versão só varria SQL e os arquivos desta etapa, e a poda do `ab-watchdog` ficava de fora.
- Se o teste geral da E10 existir: acrescentar a ele as linhas da E9 e deixar aqui só o que é próprio.

**`observatorio-a5-e9-400-dias.test.ts`** (integração). Semeia um vídeo ausente **sem decisão** com série, primeiras horas, versões (uma com URL do Blob), histórico de campo, `raw`, e um comentário com identidade; e um canal ausente com um vídeo. Conta as linhas por tabela. Com o relógio 400 dias à frente (as funções recebem `p_now`; o que usa `now()` é chamado com as linhas envelhecidas por `update` das datas), roda cada rotina que existe no banco e apaga de tabela `competitor_*` ou é chamada pelo cron de concorrentes: `competitor_missing_proof`, `competitor_comment_identity_purge`, a de soltar o arrendamento, `competitor_capture_health`, `competitor_series_health`. Afirma: as linhas de conteúdo, versão e miniatura do vídeo e do canal ausentes são **as mesmas** (contagem por tabela igual), com uma exceção escrita no teste: a linha de identidade do autor some aos 28 dias (linha 3 da lista de 9.2, decisão 20 do dono). Depois: `ausentes_com_queda = 0`. E o caso inverso: um `delete` direto de uma linha de série faz `ausentes_com_queda = 1`.

**A poda de retratos do `ab-watchdog` (emenda 1: S-I4).** `app/api/cron/ab-watchdog/route.ts:203-208` apaga `competitor_channel_snapshots` com mais de 365 dias **sem filtro de canal**, e já está em produção: um canal que saiu do YouTube e ficou sem resposta começaria a perder os retratos diários um ano depois, com o teste de 400 dias verde (ele não chamava essa rotina) e a prova verde (o piso não conta essa tabela). A regra R1 ("nem por prazo, nem por cron") estaria quebrada em silêncio. Entre mudar a poda e declarar a exceção, fica **mudar**: é a opção que não perde dado e não depende de número não medido.
- **Mudança, só nesse trecho:** a poda sai da rota para `lib/youtube/competitor-snapshot-prune.ts` (novo: `podarRetratosDeCanal(sb, agoraMs): Promise<{ ok: boolean; motivo?: string }>`), porque um arquivo `route.ts` do Next não pode exportar função avulsa e o teste de 400 dias precisa chamá-la; a rota passa a chamar a função no mesmo ponto. Dentro dela, antes do `delete`, ler os ids dos canais com `missing_since` preenchido (`competitor_channels`, só `id`, com `order('id')` e `count: 'exact'`; mais de **150** ou menos linhas que a contagem: trata como falha); o `delete` ganha `.not('competitor_channel_id', 'in', '(…)')` quando a lista não é vazia. (emenda 2: N5) O teto era 1.000. A lista vai na URL da requisição, e cada id ocupa 37 caracteres: perto de 200 ids a URL passa de 8 KB e tende a ser recusada antes de chegar ao banco (o tamanho aceito não foi medido; 150 ids dão cerca de 5,5 KB). Acima de 150 canais ausentes a poda **para de propósito**, com o motivo `mais de 150 canais ausentes`; hoje há dezenas de canais no total. Se um dia passar, a saída é uma função SQL, quando a E10 mexer na retenção (dívida). **Se a leitura falhar, a poda não roda naquele disparo** (na dúvida não se apaga) e a falha é registrada pelo `console.error` que o trecho vizinho já usa; o resto do `ab-watchdog` segue. (emenda 2: m-N7) Só o `console.error` deixaria uma falha permanente invisível: a rota põe o que `podarRetratosDeCanal` devolveu na resposta do cron, no campo novo `poda_retratos` (`{ ok, motivo? }`). Não uso o campo `avisos` que o parecer sugeriu: ele já existe, mas é um objeto com a contagem dos e-mails de aviso (`route.ts:216-220`), outra coisa. O `ab-watchdog` continua registrando sucesso. O `delete` continua escrito como `.from('competitor_channel_snapshots').delete(` no módulo novo: é essa forma que `cache-writers.test.ts` enxerga (emenda 2: I-N1). A coluna `missing_since` é da MG1, que está em produção: a mudança não depende da MG-E9 e pode ir no Envio A (CP15).
- **Testes** (em `test/cron/ab-watchdog-competitor-history.test.ts`): `a poda de retratos não apaga os de canal ausente`; `sem canal ausente a poda é a de hoje (mesmo filtro de data)`; `a leitura dos ausentes falha: nenhum delete de retratos, e o cron termina`; (emenda 2: N5 e m-N7) `151 canais ausentes: nenhum delete, e o motivo diz o número`; `a resposta do cron traz poda_retratos com ok false e o motivo quando a poda não rodou, e ok true quando rodou`.
- **(emenda 2: I-N1) `cache-writers.test.ts`, no mesmo commit.** Mover a poda derruba o primeiro teste desse arquivo, que exige igualdade exata entre os arquivos achados e `KNOWN_WRITERS` (`test/youtube/observatorio/cache-writers.test.ts:25-32`, conferido): a varredura passa a achar o módulo novo (fora da lista) e deixa de achar `ab-watchdog/route.ts` (que está nela, e cuja única escrita em tabela em cache era essa). Em `KNOWN_WRITERS`, `app/api/cron/ab-watchdog/route.ts` sai e `lib/youtube/competitor-snapshot-prune.ts` entra; o comentário acima da constante passa a nomear o módulo. Nada mais muda no arquivo (as funções e o escritor da fila são da Tarefa 9, depois).
- **No teste de 400 dias:** a semente ganha retratos do canal ausente com mais de 365 dias e de um canal no ar com a mesma idade; a poda (`podarRetratosDeCanal`, com o cliente do banco de integração) é uma das rotinas exercitadas; afirma que os do ausente ficam e os do canal no ar saem.
- Canal **mantido** (`removal_decision = 'manter'`) também tem `missing_since`: fica fora da poda pelo mesmo filtro. Canal que volta ao ar volta a ser podado (a E1 zera `missing_since`).
**Pronto quando:** os dois verdes; os testes do `ab-watchdog` (`test/ab-cron-watchdog.test.ts`, `test/ab-watchdog-drift.test.ts`, `test/cron/ab-watchdog-competitor-history.test.ts`) verdes; **`test/youtube/observatorio/cache-writers.test.ts` verde** (emenda 2: I-N1); a exceção da identidade escrita com a referência à lista; a mudança do `ab-watchdog` em commit próprio (a 11a), que leva junto a troca em `cache-writers.test.ts`.

### Tarefa 12: testes de ponta, semente e conferência de UX

**`observatorio-a5-e9-fila.test.ts`** (integração, o serviço de verdade contra o banco, com o Blob falso). `fila de ponta: semeia 3 vídeos, 1 canal e 1 grupo de comentários ausentes; lerFila devolve os 5 itens com todos os campos de 4.5` (item 66); `todo nome de tabela que a prévia devolve tem rótulo em rotulos.ts` (o catálogo real contra o código); `manter: decisão, autor, data e auditoria; o item muda de bloco` (item 68); `apagar vídeo de ponta: zero linhas em cada tabela filha, Blob falso vazio no prefixo, uma linha sem conteúdo, auditoria sem título` (item 69): o teste procura o título semeado em **todo** `audit_log` e em `competitor_removed_items` como texto e não pode achar; `Blob falha uma vez: apagando com N; tentarDeNovo conclui` (item 70); `apagado que reaparece na sincronização: não é inserido, vira "voltou"; "voltar" e a sincronização seguinte o insere como novo, a linha fica; apagar de novo: purge_count 2` (item 72), com a sincronização real e a API simulada; (emenda 1: S-I1 e D-I1) antes do "reaparece", o mesmo teste roda uma sincronização em que a lista de envios cita o apagado e `videos.list` **não** o devolve: nada é inserido, `returned_seen_at` continua nulo e o número da aba não muda; (emenda 1: D-I3) `a prévia que o leitor mostrou é igual, chave a chave, ao rows_deleted que o apagar devolveu` para vídeo, canal e grupo de comentários (com resposta do criador); `sem decisão que volta ao ar sai da fila e a versão availability no_ar existe` (item 73); `comentário apagado não é regravado pela escrita de comentários (apply_competitor_comment_snap) e ganha returned_seen_at` (itens 118 e 120, na parte da fila).
**Semente e navegador.** Com `e2e/fixtures/observatorio-seed.ts` limpo no `git status`, acrescentar um bloco `saiu` (os casos do mockup) e `e2e/tests/cms/observatorio/saiu.spec.ts`: abre a aba; confere o contador; abre o painel; o botão está desabilitado; digita APAGAR; confirma; o item sai de "Esperando você" e aparece em **"Apagando"**, com "o Blob não está configurado neste ambiente" (emenda 1: S-I5; a primeira versão esperava "Já respondidos", o que exigiria falar com o Blob). Navegador **só em subagente Sonnet**, banco 54321/54322. (emenda 2: m-N8) Esse banco é outro (o do navegador, não o `bythiago_int`): antes do `saiu.spec.ts` o **controlador** aplica nele o arquivo da migration que a Tarefa 2 criou (idempotente; nunca `db:reset`). Sem ela a aba abre em "a migration desta etapa ainda não foi aplicada" e o teste cai sem motivo aparente; o primeiro passo do spec confere que essa frase **não** está na tela e falha com a mensagem "MG-E9 não aplicada no banco do navegador".
**O teste de navegador nunca fala com o Blob de produção (emenda 1: S-I5).** O servidor do Playwright carrega o `.env.local`, que tem o `BLOB_READ_WRITE_TOKEN` real (`docs/ops/runbook-cms-e2e-local.md:55-57`; `playwright.config.ts:78-86` não o sobrepõe). Duas travas: (1) a guarda de `saiu/blob.ts` sob `OBS_E2E=1` (Tarefa 5), que é a que vale e tem teste de unidade; (2) uma linha em `playwright.config.ts`, `BLOB_READ_WRITE_TOKEN: ''` no `env` do `webServer`, como segunda barreira (se o Next recarregar o valor do `.env.local` por cima do vazio, a primeira trava continua valendo; não medi qual dos dois acontece). O próprio desfecho esperado do teste ("Apagando: o Blob não está configurado") prova a trava: se aparecer "Já respondidos", o teste falha. A semente só usa `thumb_blob_url` inventada, com o uuid da semente (`https://e2e.invalid/observatorio/thumbs/<uuid da semente>/<hash>.jpg`); **nunca** uma URL copiada de produção.
**Conferência de UX (rito 6.5(d)).** O `revisor-ux-senior` abre a tela implementada ao lado do mockup congelado (em servidor subido com `OBS_E2E=1` e `BLOB_READ_WRITE_TOKEN=` vazio na linha de comando, e isso vai escrito no pedido a ele: emenda 1: S-I5), a 1440 e a 390, claro e escuro, nos dez casos e nos estados novos da seção 8, e escreve `REVISAO-UX-IMPLEMENTADO-E.md`. Divergência que não está na seção 8 é achado e volta para a Tarefa 10. A tela não vai a produção sem o acordo dele.
**Pronto quando:** integração verde; spec de navegador verde; parecer de UX sem achado aberto.

### Tarefa 13: Envio B e conferências

**Antes.** CP2 verde; a conferência ~~de commits~~ (reconciliação 13/10, emenda 3: I1: por conteúdo, `git diff --quiet origin/main <commit-pai-do-Envio-B> -- <caminhos>`, código de saída 0; o Envio B também sobe por árvore de lote) da seção 2 (passo 1) em 0 também para os arquivos do Envio B (`agenda/fecho.ts`, `agenda/executar.ts`, `sync-youtube/route.ts`, `lib/conferencias.ts`, `_chrome/*`, `observatorio/links.ts`: emenda 1: S-I3 e S-C1); Envio A em `main` e conferência A1 feita; MG-E9 em produção com V1 a V3 anotadas; os dois especialistas de acordo com a implementação (decisão 38); parecer de UX fechado. (emenda 2: I-N1) A suíte inteira verde antes do push (`npx vitest run`, em background, com a saída em arquivo; cerca de 160 s): vale para o Envio A e para o Envio B, porque os dois levam arquivos de outras trilhas e um teste de varredura de outra pasta pode cair por mudança daqui, como o `cache-writers.test.ts` cairia.
**Passos.**
1. `lib/conferencias.ts`: `E9_DEPLOY: string | null`, `conferenciasE9(deploy)` com as entradas da seção 7, spread em `CONFERENCIAS`. Testes no molde das outras etapas: `nula = nenhuma entrada`; `malformada = uma entrada de erro de 1970`; `preenchida = as entradas com as datas certas`. A mesma lista em `.superpowers/sdd/a5/conferencias-com-data.md`.
2. `docs/ops/observatorio-fila-sairam-runbook.md` (novo): o que a aba faz; os vermelhos do cron e o que fazer em cada um; as consultas K1 a K7 (emenda 1: a K6 é o ajuste do piso e a K7 a saída de uma entrada do Blob recusada, as duas com o SQL escrito na seção 11; o dono cola, **só depois de investigar**); a linha "vermelho isolado 'não foi possível ler' logo depois de um apagar: confira o disparo seguinte antes de agir" (D-M4); "site sem canal ativo com item apagando não fica vermelho: olhe a aba" (S-m4); o interruptor; a reversão. `docs/ops/env-vars.md`: a linha de `OBS_PROVA_AUSENTES`.
3. Lista explícita de commits do envio (há outros lotes locais não enviados). Push em `staging`, CI verde, promoção a `main` fora de 11:55 a 12:15 UTC e fora dos minutos :00, :20 e :40.
4. Preencher `E9_DEPLOY` no commit do envio. Conferência `e9-d0`.

**Ordem que não pode inverter, e o que acontece se inverter.**

| Ordem certa | Se inverter |
|---|---|
| E1 e E2 em `main` antes de tudo | o código deste plano importa módulos que não existem em `main`: o build da Vercel falha |
| Envio A antes da migration e do Envio B | existe "apagar" sem a consulta: o primeiro vídeo apagado e recente volta a ser coletado na sincronização seguinte, sem aviso. É a inversão que **não** fica vermelha: por isso a Tarefa 13 confere o Envio A em `main` por `git` antes de promover o B |
| Migration antes do Envio B | cron de concorrentes vermelho a cada 20 minutos (`schema ausente`), aba com erro; nada é apagado nem lido errado. Volta: aplicar a migration |
| Acordo dos dois especialistas antes da migration ir ao dono | regra do dono (45a) |
| Parecer de UX antes do Envio B | rito 6.5(d) |

**Pronto quando:** CI verde, deploy pronto na Vercel, `e9-d0` anotada no ledger.

---

## 11. Consultas de conferência e o que foi rodado

**O que foi rodado por quem escreveu este plano:** só leitura do repositório e `git ls-remote origin` (seção 0.1, fato 2). **Nenhum SQL deste plano foi executado**; nenhum teste, build ou navegador. Tudo o que a seção 2 e a Tarefa 1 chamam de "esperado" é o resultado do desenho, a confirmar pela Tarefa 1.

**A1 (depois do Envio A, leitura do retorno do cron de concorrentes em 3 disparos):** nenhum canal com o erro "não foi possível conferir os vídeos já apagados"; `removedSkipped` ausente ou 0.

**K1: a prova, lida de fora** (não grava). Esperado: `quedas = 0`; `pisos` = `ausentes`.

```sql
with aus as (select v.id, coalesce(v.missing_since, c.missing_since) as desde, (select count(*) from competitor_video_daily d where d.video_id = v.id) + (select count(*) from competitor_video_early e where e.video_id = v.id) + (select count(*) from competitor_video_versions x where x.video_id = v.id) as linhas from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id where v.missing_since is not null or c.missing_since is not null) select count(*) as ausentes, coalesce(sum(a.linhas), 0) as linhas_de_ausentes, count(b.video_id) as pisos, count(*) filter (where b.lines_floor is not null and a.linhas < b.lines_floor) as quedas from aus a left join competitor_missing_baseline b on b.video_id = a.id and b.missing_since = a.desde;
```

**K2: um item apagado não deixou nada** (trocar `:yt` pelo código do vídeo). Esperado: `0, 1, 0, 0` (emenda 1: D-M8: a terceira coluna era `auditoria = 1`, errada para um vídeo apagado duas vezes; agora é a diferença entre as linhas de auditoria e o `purge_count`, que tem de ser 0).

```sql
select (select count(*) from competitor_videos where video_id = :yt) as linha_do_video, (select count(*) from competitor_removed_items where kind = 'video' and youtube_id = :yt) as registro, (select count(*) from audit_log where action = 'competitor_missing_purge' and after_data ->> 'kind' = 'video' and after_data ->> 'youtube_id' = :yt) - (select coalesce(max(purge_count), 0) from competitor_removed_items where kind = 'video' and youtube_id = :yt) as auditoria_menos_purge_count, (select coalesce(sum(cardinality(blobs_pending)), 0) from competitor_removed_items where kind = 'video' and youtube_id = :yt) as blobs_pendentes;
```

**K3: o que está "apagando" e há quanto tempo.** Esperado: nenhuma linha, ou todas com menos de 24 horas.

```sql
select id, kind, decided_at, cardinality(blobs_pending) as pendentes, archive_pending, now() - decided_at as ha from competitor_removed_items where cardinality(blobs_pending) > 0 or archive_pending order by decided_at;
```

**K4: quem espera resposta, por idade.** Número para o dono, não falha.

```sql
select 'video' as tipo, count(*), min(v.missing_since) as mais_antigo from competitor_videos v join competitor_channels c on c.id = v.competitor_channel_id where v.missing_since is not null and v.removal_decision is null and c.missing_since is null union all select 'canal', count(*), min(missing_since) from competitor_channels where missing_since is not null and removal_decision is null union all select 'comentario', count(*), min(missing_since) from competitor_video_comments where missing_since is not null and removal_decision is null;
```

**K5: toda resposta tem auditoria, e a auditoria não tem texto.** Esperado: `0`, `0` e `0` (emenda 1: D-M8: a segunda coluna é nova e cobre os comentários; o `decided_at` da linha e o `created_at` da auditoria são o mesmo `now()` da transação).

```sql
select (select count(*) from competitor_removed_items r where r.kind in ('video', 'canal') and not exists (select 1 from audit_log a where a.action = 'competitor_missing_purge' and a.site_id = r.site_id and a.after_data ->> 'youtube_id' = r.youtube_id)) as apagados_sem_auditoria, (select count(*) from competitor_removed_items r where r.kind = 'comentario' and not exists (select 1 from audit_log a where a.action = 'competitor_missing_purge' and a.resource_type = 'competitor_comment_group' and a.site_id = r.site_id and a.created_at = r.decided_at)) as comentarios_sem_auditoria, (select count(*) from audit_log a where a.action like 'competitor_missing_%' and (a.after_data ? 'title' or a.after_data ? 'titulo' or a.after_data ? 'body' or a.before_data is not null)) as auditoria_com_conteudo;
```

**K6: o piso de um vídeo ausente e o ajuste dele** (emenda 1: D-M5). É o que tira o cron do vermelho `N vídeos fora do ar perderam linhas`; **só depois** de saber por que as linhas caíram (ajustar o piso é aceitar a perda). Primeiro a leitura, que mostra o piso e a contagem de hoje de cada vídeo com queda:

```sql
select b.video_id, b.missing_since, b.lines_floor as piso, b.measured_at, (select count(*) from competitor_video_daily d where d.video_id = b.video_id) + (select count(*) from competitor_video_early e where e.video_id = b.video_id) + (select count(*) from competitor_video_versions x where x.video_id = b.video_id) as linhas_hoje from competitor_missing_baseline b where b.lines_floor > (select count(*) from competitor_video_daily d where d.video_id = b.video_id) + (select count(*) from competitor_video_early e where e.video_id = b.video_id) + (select count(*) from competitor_video_versions x where x.video_id = b.video_id) order by b.measured_at;
```

Depois, um comando por vídeo, com os três valores copiados da leitura (o agente prepara, o dono cola; esperado: `UPDATE 1`):

```sql
update public.competitor_missing_baseline set lines_floor = <linhas_hoje>, measured_at = now() where video_id = '<video_id>' and missing_since = '<missing_since>' and lines_floor > <linhas_hoje>;
```

**K7: tirar de `blobs_pending` uma entrada que o apagamento recusa** (emenda 1: S-m3; URL fora de `/observatorio/thumbs/`, o caso que a CP6 espera ser zero). **Só depois** de conferir à mão, no painel do Blob da Vercel, que o arquivo não existe mais ou foi apagado lá. Leitura (K3 dá o `id`), e o comando, um por entrada (esperado: `UPDATE 1`):

```sql
select id, kind, decided_at, blobs_pending from competitor_removed_items where id = <id>;
update public.competitor_removed_items set blobs_pending = array_remove(blobs_pending, '<entrada exata>') where id = <id>;
```

---

## 12. Onde está cada item de aceite

| Item | O que pede | Tarefa que cobre | Fica fora, e por quê |
|---|---|---|---|
| 66 | item na fila com os campos de 4.5 e "o YouTube não diz o motivo"; canal inteiro = um item | 4 (leitor), 10 (tela), 12 (de ponta) | "períodos já arquivados": não há exportação (E10); a tela diz isso |
| 67 | sem resposta o dado fica: lista fechada, 400 dias, e a prova em produção `linhas_de_ausentes` | 8 (prova no cron, nos dois caminhos: emenda 1: S-C1), 11 (varredura, 400 dias e a poda do `ab-watchdog`: emenda 1: S-I4), 1 e 2 (a função) | o teste geral da lista em todo o Observatório é da E10; a prova é por vídeo com piso (desvio 15) |
| 68 | "manter": decisão, quem, quando, auditoria; segue nas telas com a pastilha e nas medidas | 1, 2 (`competitor_missing_keep`), 6, 9, 12 | a pastilha nas outras telas e a frase das medianas: E5 e E4 (desvio 20). Nada aqui tira o vídeo mantido das medidas |
| 69 | "apagar": zero linhas em cada tabela (com leituras e tarefas da forja), nada no Blob, uma linha sem conteúdo, auditoria sem título, cache invalidado; recusa com a forja | 1, 2 (função, corrida), 5 (Blob), 6, 9 (cache), 12 (de ponta) | "nenhum arquivo no prefixo" é provado contra o Blob **falso**; no Blob real, só pela conferência K2 e pela seção 13 |
| 70 | falha no Blob: `blobs_pending`, "apagando: faltam N", nova tentativa conclui | 5, 6, 8 (o cron conclui, nos dois caminhos), 10 (texto), 12 | site sem canal na lista da prova: conclui, mas não fica vermelho às 24 h (risco 12) |
| 71 | sem `canAdminSite` nenhuma resposta; quem só lê não vê a fila nem `competitor_removed_items` | 9 (ações e dados), 2 (RLS), 10 (aba ausente) | nenhum |
| 72 | apagado que volta não é recoletado e vira item; "voltar" recoleta como novo e mantém a linha; apagar duas vezes = `purge_count 2` | 7 (sincronização), 1 e 2 (`on conflict`), 6, 12 | volta de vídeo antigo fora das páginas lidas não é percebida (seção 13; pergunta 5); a volta só é carimbada para id que `videos.list` devolveu (emenda 1: S-I1 e D-I1) |
| 73 | sem decisão que volta ao ar sai sozinho, com a volta no histórico | já feito pela E1; provado de ponta na 12 | nenhum |
| 118 (parte da fila) | comentário que deixa de vir aparece na fila, agrupado | 4, 10, 12 | agrupado por canal, não por vídeo (pergunta 3) |
| 120 (parte da E9) | apagar leva os comentários; a contagem os inclui | 1, 2 (contagem por catálogo; `competitor_comments_purge`), 12 | nenhum |
| 231 (linha 1) | "apagar" está na lista fechada; ocorrência sem linha falha | 11 | o teste geral: E10 |
| 245 | interruptores | 8 (`OBS_PROVA_AUSENTES`, com teste que apaga a variável) | o spec diz "E9: nenhum"; a variável é só da prova (desvio 17) |
| 246 | conferência com data em `lib/conferencias.ts` | 13 | nenhum |
| 247 | números não mudam sobre base congelada | 10 (teste: sem o campo `fila`, o chrome é idêntico); 9 (`cache-writers` verde) | a E9 não cria medida; "apagar" muda número por desenho, e só por ato do dono |
| 98 e 6.5(d) | tela só com mockup aprovado; o revisor confere o implementado | 10 (mockup congelado), 12 (parecer) | nenhum |
| D-11 (plano de E1 e E2) | a sincronização consulta o apagado antes de "apagar" existir em produção | 7 e a ordem da Tarefa 13 | nenhum |

---

## 13. Riscos que ficam, sem suavizar

1. **O SQL não foi executado por quem o escreveu.** O ponto mais frágil é `competitor_cascade_counts` (SQL dinâmico sobre o catálogo). A Tarefa 1 existe para isso e roda antes de qualquer dependente; se ela achar que a função não se sustenta, a saída é uma lista explícita de tabelas com uma guarda que lança quando o catálogo tem tabela fora da lista (mais simples, e passa a exigir uma linha de cada etapa que criar tabela filha).
2. **Volta ao ar de vídeo apagado e antigo não é percebida.** A sincronização só lê as páginas mais recentes de envios. O item 72 vale para vídeo recente. A ajuda da tela diz; a pergunta 5 dá a alternativa. (emenda 1: S-m6) Pelo mesmo motivo, "Voltar a acompanhar" pode não fazer nada se o vídeo já tiver saído da primeira página de envios quando o dono responder (canal de Shorts, que publica muito): a decisão fica gravada, o vídeo não entra, e a resposta da tela diz a condição.
3. **Impasse de travas.** "Apagar canal" trava o canal, depois os vídeos, depois as tarefas; uma função da sincronização que esteja gravando no mesmo canal pode travar em outra ordem. O Postgres aborta uma das duas: ou o "apagar" volta inteiro (a tela diz `impasse`, tente de novo), ou a gravação da sincronização falha e entra no erro do canal. Nada fica pela metade, mas pode acontecer. Canal ausente quase não é gravado (a sincronização lança 404 no começo), o que torna raro. (emenda 2: N3) O segundo par que podia dar impasse era a **prova** contra "apagar canal": o apagar trava os vídeos em ordem de `id` e a prova inseria os pisos sem ordem. A inserção do piso passa a ir em ordem de `id` (mesma ordem de travas) e a prova trata `deadlock_detected` como trata a falha de chave. Que a ordem do `insert … select … order by` é a ordem em que as travas são pedidas é leitura do desenho, **não medida**: o teste de corrida da Tarefa 2 é a prova.
4. **Uma tarefa `running` há mais de 30 minutos some junto** se o vigia ainda não a tiver tratado, e a forja, se ainda responder, recebe erro para uma tarefa que não existe. É o contrato da C0.12.
5. **Leituras de nicho da forja que citam o vídeo apagado ficam** (pergunta 4), e o mesmo vale para o que já saiu do sistema para uma IA (risco 28 do spec). O painel diz as duas coisas. (emenda 1: D-M1 e S-m7) Ficam também: o pacote que foi enviado à forja nas tarefas de nicho (`youtube_intelligence_tasks.sent`, que a cascata não alcança) e a leitura que uma tarefa de nicho **em andamento** na hora do "apagar" publicar depois (a recusa só olha tarefa com o vídeo como alvo). (emenda 1: D-M2) E as notificações antigas do sino que citam o **nome do canal** apagado.
6. **Enquanto o item está "apagando", as miniaturas continuam em URL pública no Blob** (risco 9 do spec). O vermelho depois de 24 horas limita o tempo, não o elimina.
7. **A prova por piso fica vermelha até alguém agir.** É de propósito (vermelho que some sozinho ensina a esquecer), mas uma queda legítima que eu não previ (por exemplo, uma migration futura da dieta que apague versão redundante de vídeo ausente) deixa o cron vermelho até o ajuste do piso, que é comando do dono.
8. **A prova não vê o Blob.** Ela conta linhas de versão com URL, não arquivos. Um arquivo apagado do Blob por fora, de vídeo ausente e sem resposta, não é percebido.
9. **O filtro "quem só lê não vê a fila" é da camada de servidor.** As tabelas-fonte continuam legíveis por quem vê o site (`can_view_site`): quem só lê não vê a aba, mas vê, nas outras telas, que um vídeo saiu. É o que o spec classifica como público (`07:66`).
10. **`video_id` é único no banco inteiro, não por site.** Com dois sites acompanhando o mesmo canal, "voltar" num site depois de o outro manter o vídeo falharia na inserção. Hoje há um site.
11. **O fluxo antigo de remover canal no ar continua deixando miniaturas órfãs no Blob e não tem auditoria.** Não é desta etapa; fica pior de ver agora que existe um caminho que limpa.
12. **(emenda 1: S-m4) Site que ficou sem canal na lista da prova não tem prova dos ausentes.** Os dois caminhos do cron leem a prova para os sites que têm canal na lista do disparo; um site cujo dono removeu todos os canais depois de um "apagar" com Blob pendente continua tendo a conclusão tentada (os sites dela vêm das pendências), mas o vermelho de 24 horas **não** dispara para ele. O item segue visível em "Apagando", com "Tentar de novo". Não medi se um canal ausente continua na lista de canais do disparo; se não continuar, um site só com canais ausentes cai neste risco, e a conferência `e9-d0` olha isso (campo `prova_ausentes` presente).
13. **(emenda 1: D-I4 e S-I6) O teto de tempo de "apagar canal" depende de um comportamento do PostgREST que ninguém mediu aqui** (aplicar a cláusula `set statement_timeout` da função antes da chamada). A Tarefa 1 prova pela API local; a versão do PostgREST de produção pode ser outra. Se não valer em produção, o primeiro canal grande devolve `tempo_esgotado` toda vez: nada é apagado (visível), e o dever de apagar fica sem caminho até uma decisão do dono.
14. **(emenda 1: D-M10) "Não perguntar de novo" do grupo de comentários não é uma transação só:** são N chamadas. Uma falha no meio deixa parte respondida; a tela mostra o que restou.

### O que nenhum teste vai provar (declarado)

- Que o Blob **real** apaga e que o prefixo real fica vazio: os testes usam `del` e `list` falsos. A primeira prova é o primeiro "apagar" em produção, com a K2 e uma olhada no painel do Blob na Vercel.
- O tempo real de "apagar canal" no maior canal de produção, o `statement_timeout` do papel de serviço e se o PostgREST de produção aplica o teto da função (CP8, CP9, risco 13).
- (emenda 1, do parecer de dados) Por quanto tempo o Blob público continua servindo, por cache, uma miniatura depois do `del`.
- (emenda 2: m-N3) O comportamento do `@vercel/blob` com uma chamada pendurada: o teto por chamada é provado com `del` e `list` falsos que nunca voltam; se a CP17 disser que a biblioteca não aceita `abortSignal`, a requisição perdida segue viva até a função morrer.
- (emenda 2: N5) O tamanho de URL que a API do banco aceita em produção: o teto de 150 ids na poda é folga calculada, não medida.
- (emenda 1) Que o Next não repõe o `BLOB_READ_WRITE_TOKEN` do `.env.local` por cima do vazio do `playwright.config.ts`: por isso a trava que vale é a de `saiu/blob.ts`.
- A recusa com uma tarefa `leitura-video` de verdade em andamento na forja (a corrida é provada com duas conexões no banco local, não com a forja).
- A trava da criação das chaves estrangeiras da MG-E9 sobre `competitor_videos` em produção com a sincronização rodando (por isso a janela e o `lock_timeout`).
- Leitor de tela, Safari, Opera e a ordem completa de teclado da tela (o mockup também não foi verificado nisso).
- Que nenhuma rotina **futura** apague dado de ausente: a varredura cobre o que existe no dia; a prova por piso é a rede para o resto.
- O comportamento com dois sites reais (há um).

### Dívida registrada (o que aparece aqui e não entra agora)

| O que | Quem herda |
|---|---|
| Miniaturas órfãs e falta de auditoria no "remover canal" de canal no ar | E10 (mexe nesse fluxo) |
| `archive_pending`, "Ver os comandos" e "Já rodei" (arquivo no NAS) | E10 e MG6 |
| Pastilha "saiu do YouTube" nas outras telas e a contagem por mediana | E5 e E4 |
| "Voltar a acompanhar" para comentário apagado (a escrita da MG8 ignora `return_decision`) | E14, se o dono pedir |
| Comentário mantido que volta ao ar guarda a decisão `'manter'` (F14): se sumir de novo, não reentra na fila | E14 (uma linha em `apply_competitor_comment_snap`) |
| Comentários de outros canais que perdem o vínculo de destaque quando um canal é apagado (`featured_channel_id` vira nulo): não aparecem no painel | E5 ou E14 |
| Teste geral da lista fechada do que apaga (item 231) | E10 |
| Conferir por id, todo dia, se um apagado antigo voltou (pergunta 5) | pós-conclusão, se o dono mudar o padrão |
| Índice em `competitor_videos (missing_since)`: hoje a leitura varre cerca de 1.400 linhas, sem custo; rever acima de 50 mil | quem mexer na escala |
| `competitor_channel_removal_impact` continua sem contar leituras, tarefas e comentários | E5 ou E10 (podem trocar por `competitor_cascade_counts('canal', …)`) |
| (emenda 1: D-M2) Notificações do sino com o nome de um canal apagado (`competitor-sync.ts:1326`): apagar ou reescrever | quem mexer no módulo de notificações, se o dono pedir |
| (emenda 1: S-m4) Prova dos ausentes para site sem canal na lista do disparo | E16 (dona da lista de sites da prova) |
| (emenda 2: N6) `sitesComApagamentoPendente` deduz os sites de no máximo 1.000 linhas: com mais de um site e mais de 1.000 pendências num deles, o outro espera | quem ligar o segundo site (junto do risco 10) |
| (emenda 2: N5) Poda de retratos para de propósito acima de 150 canais ausentes (a lista vai na URL): trocar por função SQL | E10 (mexe na retenção) |

---

## 14. Apêndices

### Apêndice A: MG-E9 (`observatorio_a5_e9_apagar_o_que_saiu`)

SQL final do desenho. **Não executado** por quem o escreveu: a Tarefa 1 o roda duas vezes e corrige este bloco onde for preciso. O arquivo em `supabase/migrations/` só é criado na Tarefa 2.

```sql
-- Fase A5 do Observatório, etapa E9 (spec v2.3, arquivo 01, seção 4.5): a fila "Saíram do YouTube".
-- DEPENDE da MG1 (competitor_removed_items, colunas de ausência), da MG2 (competitor_video_early) e da MG8
-- (competitor_video_comments). NÃO altera tabela nem função existente: cria uma tabela pequena e treze funções.
-- Idempotência: create table/index if not exists, create or replace function, drop policy if exists antes de create policy.
-- Código antigo depois desta migration: inerte (ninguém chama as funções; a tabela nova fica vazia).

set lock_timeout = '5s';

do $$
begin
  if to_regclass('public.competitor_removed_items') is null then
    raise exception 'MG-E9 depende da MG1 (competitor_removed_items)';
  end if;
  if to_regclass('public.competitor_video_early') is null then
    raise exception 'MG-E9 depende da MG2 (competitor_video_early)';
  end if;
  if to_regclass('public.competitor_video_comments') is null then
    raise exception 'MG-E9 depende da MG8 (competitor_video_comments)';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. O piso da prova "sem resposta o dado fica": quantas linhas o vídeo ausente tinha quando foi visto ausente.
--    Uma linha por vídeo e por episódio de ausência. Estado de conferência, sem conteúdo de terceiros.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_missing_baseline (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  missing_since date not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  lines_floor integer not null check (lines_floor >= 0),
  measured_at timestamptz not null,
  primary key (video_id, missing_since)
);
create index if not exists idx_cmb_site on public.competitor_missing_baseline (site_id);
comment on table public.competitor_missing_baseline is 'A5 E9: piso da prova dos ausentes. lines_floor = linhas de série diária, das primeiras horas e de versões do vídeo na 1ª vez em que a prova o viu ausente. Menos linhas que o piso, sem o vídeo ter sido apagado pelo dono, é perda.';
alter table public.competitor_missing_baseline enable row level security;
drop policy if exists "competitor_missing_baseline_select" on public.competitor_missing_baseline;
create policy "competitor_missing_baseline_select" on public.competitor_missing_baseline
  for select using (public.can_edit_site(site_id));
revoke insert, update, delete, truncate on public.competitor_missing_baseline from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Soma de dois objetos de contagem, chave a chave (para apagar o mesmo id pela 2ª vez).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_jsonb_sum(p_a jsonb, p_b jsonb)
returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(t.k, t.v), '{}'::jsonb)
    from (
      select s.k, sum(s.v) as v
        from (
          select e.key as k, (e.value #>> '{}')::numeric as v
            from jsonb_each(coalesce(p_a, '{}'::jsonb)) e where jsonb_typeof(e.value) = 'number'
          union all
          select e.key, (e.value #>> '{}')::numeric
            from jsonb_each(coalesce(p_b, '{}'::jsonb)) e where jsonb_typeof(e.value) = 'number'
        ) s
       group by s.k
    ) t;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. O que a cascata levaria: linhas por tabela, lidas do CATÁLOGO (toda tabela presa por chave estrangeira
--    "on delete cascade" à raiz, nível 1, e às filhas dela, nível 2). Tabela nova entra sozinha.
--    Onde o catálogo não alcança, LANÇA: contagem menor que a verdade não se devolve.
--    A raiz não entra na contagem (quem chama soma a linha dela).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_cascade_counts(p_root text, p_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_root oid;
  v_out jsonb := '{}'::jsonb;
  v_n bigint;
  v_fundo text;
  v_composta text;
  r record;
begin
  if p_id is null then
    raise exception 'competitor_cascade_counts: id nulo';
  end if;
  v_root := case p_root
              when 'video' then 'public.competitor_videos'::regclass::oid
              when 'canal' then 'public.competitor_channels'::regclass::oid
            end;
  if v_root is null then
    raise exception 'competitor_cascade_counts: raiz desconhecida (%)', coalesce(p_root, 'nulo');
  end if;

  with fk as (
    select k.conrelid as filho, k.confrelid as pai, cardinality(k.conkey) as colunas
      from pg_catalog.pg_constraint k
     where k.contype = 'f' and k.confdeltype = 'c' and k.conrelid <> k.confrelid
  ), n1 as (
    select distinct fk.filho from fk where fk.pai = v_root
  ), n2 as (
    select distinct fk.filho from fk join n1 on n1.filho = fk.pai where fk.filho <> v_root
  ), so2 as (
    select n2.filho from n2 except select n1.filho from n1
  )
  select (select string_agg(distinct fk.filho::regclass::text, ', ') from fk join so2 on so2.filho = fk.pai),
         (select string_agg(distinct fk.filho::regclass::text, ', ') from fk
           where fk.colunas > 1 and (fk.pai = v_root or fk.pai in (select n1.filho from n1)))
    into v_fundo, v_composta;
  if v_fundo is not null then
    raise exception 'competitor_cascade_counts: nível 3 fora da contagem (%)', v_fundo;
  end if;
  if v_composta is not null then
    raise exception 'competitor_cascade_counts: chave composta fora da contagem (%)', v_composta;
  end if;

  for r in
    with fk as (
      select k.conrelid as filho, k.confrelid as pai,
             (select a.attname from pg_catalog.pg_attribute a where a.attrelid = k.conrelid and a.attnum = k.conkey[1]) as col,
             (select a.attname from pg_catalog.pg_attribute a where a.attrelid = k.confrelid and a.attnum = k.confkey[1]) as ref
        from pg_catalog.pg_constraint k
       where k.contype = 'f' and k.confdeltype = 'c' and cardinality(k.conkey) = 1
    ), n1 as (
      select fk.filho, string_agg(format('%I = $1', fk.col), ' or ' order by fk.col) as pred
        from fk
       where fk.pai = v_root and fk.filho <> v_root
       group by fk.filho
    ), n2 as (
      -- inclui a auto-referência de uma filha (a resposta do criador aponta para o comentário): o OR abaixo não conta duas vezes
      select fk.filho,
             string_agg(format('%I in (select %I from %s where %s)', fk.col, fk.ref, fk.pai::regclass, n1.pred), ' or ' order by fk.col) as pred
        from fk join n1 on n1.filho = fk.pai
       where fk.filho <> v_root
       group by fk.filho
    ), todos as (
      select n1.filho, n1.pred from n1
      union all
      select n2.filho, n2.pred from n2
    )
    select t.filho::regclass as tab,
           (select c.relname from pg_catalog.pg_class c where c.oid = t.filho) as nome,
           string_agg('(' || t.pred || ')', ' or ') as pred
      from todos t
     group by t.filho
     order by 2
  loop
    execute format('select count(*) from %s where %s', r.tab, r.pred) into v_n using p_id;
    v_out := v_out || jsonb_build_object(r.nome, v_n);
  end loop;
  return v_out;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. A prévia do painel: o que "apagar" levaria de UM vídeo ou canal deste site. Só lê.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_purge_preview(p_site uuid, p_kind text, p_id uuid, p_janela_min integer)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_yt text;
  v_since date;
  v_rows jsonb;
  v_blobs bigint;
  v_busy bigint;
begin
  if p_site is null or p_id is null or p_janela_min is null or p_janela_min not between 1 and 240 then
    raise exception 'competitor_purge_preview: parâmetro inválido';
  end if;
  if p_kind = 'video' then
    select v.video_id, v.missing_since into v_yt, v_since
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where v.id = p_id and c.site_id = p_site;
    if not found then
      return jsonb_build_object('status', 'not_found');
    end if;
    v_rows := public.competitor_cascade_counts('video', p_id) || jsonb_build_object('competitor_videos', 1);
    select count(distinct x.thumb_blob_url) into v_blobs
      from public.competitor_video_versions x
     where x.video_id = p_id and x.thumb_blob_url is not null;
    select count(*) into v_busy
      from public.youtube_intelligence_tasks t
     where t.target_video_id = p_id and t.status = 'running'
       and (t.started_at is null or t.started_at > now() - make_interval(mins => p_janela_min)); -- (emenda 1: D-M3) running sem started_at também bloqueia
  elsif p_kind = 'canal' then
    select c.channel_id, c.missing_since into v_yt, v_since
      from public.competitor_channels c
     where c.id = p_id and c.site_id = p_site;
    if not found then
      return jsonb_build_object('status', 'not_found');
    end if;
    v_rows := public.competitor_cascade_counts('canal', p_id) || jsonb_build_object('competitor_channels', 1);
    select count(distinct x.thumb_blob_url) into v_blobs
      from public.competitor_video_versions x
      join public.competitor_videos v on v.id = x.video_id
     where v.competitor_channel_id = p_id and x.thumb_blob_url is not null;
    select count(*) into v_busy
      from public.youtube_intelligence_tasks t
      join public.competitor_videos v on v.id = t.target_video_id
     where v.competitor_channel_id = p_id and t.status = 'running'
       and (t.started_at is null or t.started_at > now() - make_interval(mins => p_janela_min)); -- (emenda 1: D-M3) running sem started_at também bloqueia
  else
    raise exception 'competitor_purge_preview: tipo desconhecido (%)', coalesce(p_kind, 'nulo');
  end if;
  return jsonb_build_object('status', 'ok', 'youtube_id', v_yt, 'missing_since', v_since,
                            'rows', v_rows, 'blobs', v_blobs, 'forja_em_andamento', v_busy > 0);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4b. (emenda 1: D-I3) A prévia do grupo de comentários, com a MESMA regra do apagar: os pedidos e as respostas
--     presas a eles (parent_id), com as marcas e as identidades de todos. Só lê.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_comments_preview(p_site uuid, p_channel uuid, p_comment_ids bigint[])
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_alvo bigint[];
  v_todos bigint[];
begin
  if p_site is null or p_channel is null or p_comment_ids is null
     or cardinality(p_comment_ids) = 0 or cardinality(p_comment_ids) > 500 then
    raise exception 'competitor_comments_preview: parâmetro inválido';
  end if;
  select coalesce(array_agg(k.id), '{}'::bigint[]) into v_alvo
    from public.competitor_video_comments k
   where k.id = any(p_comment_ids) and k.site_id = p_site
     and k.competitor_channel_id = p_channel and k.missing_since is not null;
  if cardinality(v_alvo) = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;
  select coalesce(array_agg(k.id), '{}'::bigint[]) into v_todos
    from public.competitor_video_comments k
   where k.id = any(v_alvo) or k.parent_id = any(v_alvo);
  return jsonb_build_object(
    'status', 'ok',
    'encontrados', cardinality(v_alvo),
    'respostas', cardinality(v_todos) - cardinality(v_alvo),
    'rows', jsonb_build_object(
      'competitor_video_comments', cardinality(v_todos),
      'competitor_video_comment_marks',
        (select count(*) from public.competitor_video_comment_marks m where m.comment_id = any(v_todos)),
      'competitor_video_comment_authors',
        (select count(*) from public.competitor_video_comment_authors a where a.comment_id = any(v_todos))));
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Apagar UM vídeo que saiu do YouTube. Uma transação: trava, recusa, conta, apaga, registra, audita.
--    Devolve status: 'apagado' | 'not_found' | 'no_ar' | 'forja_em_andamento'.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_video_purge(
  p_site uuid, p_video uuid, p_actor uuid, p_janela_min integer, p_ip text, p_ua text
) returns jsonb
-- (emenda 1: D-I4 e S-I6) teto próprio na DEFINIÇÃO: dentro do corpo não adianta (o relógio do comando já está armado)
language plpgsql security invoker set search_path = '' set statement_timeout = '30s' as $$
declare
  v_yt text;
  v_channel uuid;
  v_since date;
  v_rows jsonb;
  v_blobs text[];
  v_busy bigint;
  v_item bigint;
  v_purge smallint;
begin
  if p_site is null or p_video is null or p_actor is null
     or p_janela_min is null or p_janela_min not between 1 and 240 then
    raise exception 'competitor_video_purge: parâmetro inválido';
  end if;

  -- 1. a linha do vídeo, deste site, travada: ninguém insere filha nova nem a atualiza até o fim
  select v.video_id, v.competitor_channel_id, v.missing_since into v_yt, v_channel, v_since
    from public.competitor_videos v
    join public.competitor_channels c on c.id = v.competitor_channel_id
   where v.id = p_video and c.site_id = p_site
     for update of v;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_since is null then
    return jsonb_build_object('status', 'no_ar');
  end if;

  -- 2. a forja: trava TODAS as tarefas do vídeo; um claim concorrente espera aqui e depois não acha a linha
  perform 1 from public.youtube_intelligence_tasks t
    where t.target_video_id = p_video order by t.id for update;
  select count(*) into v_busy
    from public.youtube_intelligence_tasks t
   where t.target_video_id = p_video and t.status = 'running'
     and (t.started_at is null or t.started_at > now() - make_interval(mins => p_janela_min)); -- (emenda 1: D-M3) running sem started_at também bloqueia
  if v_busy > 0 then
    return jsonb_build_object('status', 'forja_em_andamento', 'tarefas', v_busy, 'janela_min', p_janela_min);
  end if;

  -- 3. a contagem e os arquivos, com a linha travada
  v_rows := public.competitor_cascade_counts('video', p_video) || jsonb_build_object('competitor_videos', 1);
  select coalesce(array_agg(distinct x.thumb_blob_url), '{}'::text[]) into v_blobs
    from public.competitor_video_versions x
   where x.video_id = p_video and x.thumb_blob_url is not null;
  v_blobs := v_blobs || array['observatorio/thumbs/' || p_video::text || '/'];

  -- 4. apaga (as filhas vão por cascata) e grava a linha sem conteúdo
  delete from public.competitor_videos v where v.id = p_video;

  insert into public.competitor_removed_items as r
    (site_id, kind, youtube_id, competitor_channel_id, missing_since, decided_at, decided_by, rows_deleted, blobs_pending, archive_pending)
  values (p_site, 'video', v_yt, v_channel, v_since, now(), p_actor, v_rows, v_blobs, false)
  on conflict (site_id, kind, youtube_id) do update set
    competitor_channel_id = excluded.competitor_channel_id,
    missing_since = excluded.missing_since,
    decided_at = excluded.decided_at,
    decided_by = excluded.decided_by,
    rows_deleted = public.competitor_jsonb_sum(r.rows_deleted, excluded.rows_deleted),
    blobs_pending = (select coalesce(array_agg(distinct b order by b), '{}'::text[])
                       from unnest(r.blobs_pending || excluded.blobs_pending) b),
    purge_count = least(r.purge_count + 1, 32767)::smallint,
    returned_seen_at = null, return_decision = null, return_decided_at = null
  returning r.id, r.purge_count into v_item, v_purge;

  -- 5. a auditoria, na mesma transação. Sem título, sem descrição, sem texto: código, datas e contagens.
  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
  select p_actor, 'competitor_missing_purge', 'competitor_video', p_video, s.org_id, p_site,
         jsonb_build_object('kind', 'video', 'youtube_id', v_yt, 'missing_since', v_since,
                            'rows_deleted', v_rows, 'blobs', cardinality(v_blobs), 'purge_count', v_purge),
         p_ip::inet, nullif(p_ua, '')
    from public.sites s where s.id = p_site;
  if not found then
    raise exception 'competitor_video_purge: site sem linha (auditoria não gravada)';
  end if;

  return jsonb_build_object('status', 'apagado', 'item_id', v_item, 'youtube_id', v_yt,
                            'rows_deleted', v_rows, 'blobs', to_jsonb(v_blobs), 'purge_count', v_purge);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Apagar UM canal inteiro que saiu do YouTube (um item, não um por vídeo). Mesma ordem do vídeo.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_channel_purge(
  p_site uuid, p_channel uuid, p_actor uuid, p_janela_min integer, p_ip text, p_ua text
) returns jsonb
-- (emenda 1: D-I4 e S-I6) teto próprio na DEFINIÇÃO, como no vídeo
language plpgsql security invoker set search_path = '' set statement_timeout = '30s' as $$
declare
  v_yt text;
  v_since date;
  v_rows jsonb;
  v_blobs text[];
  v_busy bigint;
  v_item bigint;
  v_purge smallint;
begin
  if p_site is null or p_channel is null or p_actor is null
     or p_janela_min is null or p_janela_min not between 1 and 240 then
    raise exception 'competitor_channel_purge: parâmetro inválido';
  end if;

  select c.channel_id, c.missing_since into v_yt, v_since
    from public.competitor_channels c
   where c.id = p_channel and c.site_id = p_site
     for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_since is null then
    return jsonb_build_object('status', 'no_ar');
  end if;

  perform 1 from public.competitor_videos v
    where v.competitor_channel_id = p_channel order by v.id for update;
  perform 1 from public.youtube_intelligence_tasks t
    where t.target_video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = p_channel)
    order by t.id for update;
  select count(*) into v_busy
    from public.youtube_intelligence_tasks t
    join public.competitor_videos v on v.id = t.target_video_id
   where v.competitor_channel_id = p_channel and t.status = 'running'
     and (t.started_at is null or t.started_at > now() - make_interval(mins => p_janela_min)); -- (emenda 1: D-M3) running sem started_at também bloqueia
  if v_busy > 0 then
    return jsonb_build_object('status', 'forja_em_andamento', 'tarefas', v_busy, 'janela_min', p_janela_min);
  end if;

  v_rows := public.competitor_cascade_counts('canal', p_channel) || jsonb_build_object('competitor_channels', 1);
  select coalesce(array_agg(distinct x.thumb_blob_url), '{}'::text[]) into v_blobs
    from public.competitor_video_versions x
    join public.competitor_videos v on v.id = x.video_id
   where v.competitor_channel_id = p_channel and x.thumb_blob_url is not null;
  v_blobs := v_blobs || coalesce(
    (select array_agg('observatorio/thumbs/' || v.id::text || '/' order by v.id)
       from public.competitor_videos v where v.competitor_channel_id = p_channel), '{}'::text[]);

  delete from public.competitor_channels c where c.id = p_channel;

  insert into public.competitor_removed_items as r
    (site_id, kind, youtube_id, competitor_channel_id, missing_since, decided_at, decided_by, rows_deleted, blobs_pending, archive_pending)
  values (p_site, 'canal', v_yt, p_channel, v_since, now(), p_actor, v_rows, v_blobs, false)
  on conflict (site_id, kind, youtube_id) do update set
    competitor_channel_id = excluded.competitor_channel_id,
    missing_since = excluded.missing_since,
    decided_at = excluded.decided_at,
    decided_by = excluded.decided_by,
    rows_deleted = public.competitor_jsonb_sum(r.rows_deleted, excluded.rows_deleted),
    blobs_pending = (select coalesce(array_agg(distinct b order by b), '{}'::text[])
                       from unnest(r.blobs_pending || excluded.blobs_pending) b),
    purge_count = least(r.purge_count + 1, 32767)::smallint,
    returned_seen_at = null, return_decision = null, return_decided_at = null
  returning r.id, r.purge_count into v_item, v_purge;

  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
  select p_actor, 'competitor_missing_purge', 'competitor_channel', p_channel, s.org_id, p_site,
         jsonb_build_object('kind', 'canal', 'youtube_id', v_yt, 'missing_since', v_since,
                            'rows_deleted', v_rows, 'blobs', cardinality(v_blobs), 'purge_count', v_purge),
         p_ip::inet, nullif(p_ua, '')
    from public.sites s where s.id = p_site;
  if not found then
    raise exception 'competitor_channel_purge: site sem linha (auditoria não gravada)';
  end if;

  return jsonb_build_object('status', 'apagado', 'item_id', v_item, 'youtube_id', v_yt,
                            'rows_deleted', v_rows, 'blobs', to_jsonb(v_blobs), 'purge_count', v_purge);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Apagar os comentários que o painel MOSTROU (de um canal). Tudo o que foi pedido, ou nada ('mudou').
--    Leva a resposta do criador (cascata), as identidades e as marcas. Sobra uma linha por comentário, só com o id.
--    A auditoria NÃO leva id de comentário (dado sensível): só contagens.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_comments_purge(
  p_site uuid, p_channel uuid, p_comment_ids bigint[], p_actor uuid, p_ip text, p_ua text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_pedidos integer;
  v_alvo bigint[];
  v_todos bigint[];
  v_marcas bigint;
  v_autores bigint;
  v_rows jsonb;
begin
  if p_site is null or p_channel is null or p_actor is null or p_comment_ids is null
     or cardinality(p_comment_ids) = 0 or cardinality(p_comment_ids) > 500 then
    raise exception 'competitor_comments_purge: parâmetro inválido';
  end if;
  select count(distinct x) into v_pedidos from unnest(p_comment_ids) x where x is not null;

  select coalesce(array_agg(q.id), '{}'::bigint[]) into v_alvo
    from (select k.id
            from public.competitor_video_comments k
           where k.id = any(p_comment_ids) and k.site_id = p_site
             and k.competitor_channel_id = p_channel and k.missing_since is not null
           order by k.id
             for update) q;
  if cardinality(v_alvo) = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;
  if cardinality(v_alvo) <> v_pedidos then
    return jsonb_build_object('status', 'mudou', 'pedidos', v_pedidos, 'encontrados', cardinality(v_alvo));
  end if;

  select coalesce(array_agg(k.id), '{}'::bigint[]) into v_todos
    from public.competitor_video_comments k
   where k.id = any(v_alvo) or k.parent_id = any(v_alvo);
  select count(*) into v_marcas from public.competitor_video_comment_marks m where m.comment_id = any(v_todos);
  select count(*) into v_autores from public.competitor_video_comment_authors a where a.comment_id = any(v_todos);
  v_rows := jsonb_build_object('competitor_video_comments', cardinality(v_todos),
                               'competitor_video_comment_marks', v_marcas,
                               'competitor_video_comment_authors', v_autores);

  insert into public.competitor_removed_items as r
    (site_id, kind, youtube_id, competitor_channel_id, missing_since, decided_at, decided_by, rows_deleted)
  select p_site, 'comentario', a.youtube_comment_id, p_channel, a.missing_since, now(), p_actor,
         jsonb_build_object('competitor_video_comments', 1,
                            'competitor_video_comment_marks', a.marcas,
                            'competitor_video_comment_authors', a.autores)
    from (
      select distinct on (k.youtube_comment_id) k.youtube_comment_id, k.missing_since,
             (select count(*) from public.competitor_video_comment_marks m where m.comment_id = k.id) as marcas,
             (select count(*) from public.competitor_video_comment_authors x where x.comment_id = k.id) as autores
        from public.competitor_video_comments k
       where k.id = any(v_todos)
       order by k.youtube_comment_id, k.id
    ) a
  on conflict (site_id, kind, youtube_id) do update set
    competitor_channel_id = excluded.competitor_channel_id,
    missing_since = excluded.missing_since,
    decided_at = excluded.decided_at,
    decided_by = excluded.decided_by,
    rows_deleted = public.competitor_jsonb_sum(r.rows_deleted, excluded.rows_deleted),
    purge_count = least(r.purge_count + 1, 32767)::smallint,
    returned_seen_at = null, return_decision = null, return_decided_at = null;

  delete from public.competitor_video_comments k where k.id = any(v_alvo);

  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
  select p_actor, 'competitor_missing_purge', 'competitor_comment_group', p_channel, s.org_id, p_site,
         jsonb_build_object('kind', 'comentario', 'comentarios', cardinality(v_todos), 'rows_deleted', v_rows),
         p_ip::inet, nullif(p_ua, '')
    from public.sites s where s.id = p_site;
  if not found then
    raise exception 'competitor_comments_purge: site sem linha (auditoria não gravada)';
  end if;

  return jsonb_build_object('status', 'apagado', 'comentarios', cardinality(v_todos), 'rows_deleted', v_rows);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Manter para análise. Só alcança o que está ausente, sem decisão, e é deste site.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_missing_keep(
  p_site uuid, p_kind text, p_ids uuid[], p_comment_ids bigint[], p_actor uuid, p_ip text, p_ua text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_org uuid;
  v_n integer := 0;
begin
  if p_site is null or p_actor is null then
    raise exception 'competitor_missing_keep: parâmetro nulo';
  end if;
  select s.org_id into v_org from public.sites s where s.id = p_site;
  if not found then
    raise exception 'competitor_missing_keep: site desconhecido';
  end if;

  if p_kind = 'video' then
    with up as (
      update public.competitor_videos v
         set removal_decision = 'manter', removal_decided_at = now(), removal_decided_by = p_actor
        from public.competitor_channels c
       where c.id = v.competitor_channel_id and c.site_id = p_site
         and v.id = any(coalesce(p_ids, '{}'::uuid[]))
         and v.missing_since is not null and v.removal_decision is null
      returning v.id, v.video_id, v.missing_since
    ), au as (
      insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
      select p_actor, 'competitor_missing_keep', 'competitor_video', up.id, v_org, p_site,
             jsonb_build_object('kind', 'video', 'youtube_id', up.video_id, 'missing_since', up.missing_since),
             p_ip::inet, nullif(p_ua, '')
        from up
      returning 1
    )
    select count(*) into v_n from au;
  elsif p_kind = 'canal' then
    with up as (
      update public.competitor_channels c
         set removal_decision = 'manter', removal_decided_at = now(), removal_decided_by = p_actor
       where c.site_id = p_site and c.id = any(coalesce(p_ids, '{}'::uuid[]))
         and c.missing_since is not null and c.removal_decision is null
      returning c.id, c.channel_id, c.missing_since
    ), au as (
      insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
      select p_actor, 'competitor_missing_keep', 'competitor_channel', up.id, v_org, p_site,
             jsonb_build_object('kind', 'canal', 'youtube_id', up.channel_id, 'missing_since', up.missing_since),
             p_ip::inet, nullif(p_ua, '')
        from up
      returning 1
    )
    select count(*) into v_n from au;
  elsif p_kind = 'comentario' then
    with up as (
      update public.competitor_video_comments k
         set removal_decision = 'manter', removal_decided_at = now(), removal_decided_by = p_actor
       where k.site_id = p_site and k.id = any(coalesce(p_comment_ids, '{}'::bigint[]))
         and k.missing_since is not null and k.removal_decision is null
      returning 1
    )
    select count(*) into v_n from up;
    if v_n > 0 then
      insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
      values (p_actor, 'competitor_missing_keep', 'competitor_comment_group', null, v_org, p_site,
              jsonb_build_object('kind', 'comentario', 'comentarios', v_n), p_ip::inet, nullif(p_ua, ''));
    end if;
  else
    raise exception 'competitor_missing_keep: tipo desconhecido (%)', coalesce(p_kind, 'nulo');
  end if;

  return jsonb_build_object('status', case when v_n > 0 then 'mantido' else 'nada' end, 'mantidos', v_n);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. A resposta a "voltou ao ar; voltar a acompanhar?". Comentário só aceita 'ignorar'.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_return_decide(
  p_site uuid, p_item bigint, p_decision text, p_actor uuid, p_ip text, p_ua text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_kind text;
  v_yt text;
begin
  if p_site is null or p_item is null or p_actor is null then
    raise exception 'competitor_return_decide: parâmetro nulo';
  end if;
  if p_decision is null or p_decision not in ('voltar', 'ignorar') then
    raise exception 'competitor_return_decide: decisão desconhecida (%)', coalesce(p_decision, 'nulo');
  end if;

  update public.competitor_removed_items r
     set return_decision = p_decision, return_decided_at = now()
   where r.id = p_item and r.site_id = p_site
     and r.returned_seen_at is not null and r.return_decision is null
     and (p_decision = 'ignorar' or r.kind in ('video', 'canal'))
  returning r.kind, r.youtube_id into v_kind, v_yt;
  if not found then
    return jsonb_build_object('status', 'nada');
  end if;

  insert into public.audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, after_data, ip, user_agent)
  select p_actor, case p_decision when 'voltar' then 'competitor_return_follow' else 'competitor_return_ignore' end,
         'competitor_removed_item', null, s.org_id, p_site,
         jsonb_build_object('kind', v_kind, 'item_id', p_item)
           || case when v_kind = 'comentario' then '{}'::jsonb else jsonb_build_object('youtube_id', v_yt) end,
         p_ip::inet, nullif(p_ua, '')
    from public.sites s where s.id = p_site;
  if not found then
    raise exception 'competitor_return_decide: site sem linha (auditoria não gravada)';
  end if;

  return jsonb_build_object('status', 'ok', 'kind', v_kind, 'decision', p_decision);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Tirar de blobs_pending o que o Blob confirmou apagado. Atômica: o cron e o clique não se atropelam.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_removed_blobs_done(p_site uuid, p_item bigint, p_done text[])
returns jsonb
language sql security invoker set search_path = '' as $$
  with up as (
    update public.competitor_removed_items r
       set blobs_pending = coalesce(
             (select array_agg(b order by b) from unnest(r.blobs_pending) b
               where b <> all(coalesce(p_done, '{}'::text[]))), '{}'::text[])
     where r.id = p_item and r.site_id = p_site
    returning cardinality(r.blobs_pending) as restam
  )
  select coalesce((select jsonb_build_object('status', 'ok', 'restam', up.restam) from up),
                  jsonb_build_object('status', 'not_found'));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. A prova "sem resposta o dado fica", lida pelo cron de concorrentes a cada disparo.
--     Grava o piso de cada vídeo ausente na 1ª vez; depois, menos linhas que o piso = queda.
--     Vídeo de canal ausente entra, com a data do canal.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_missing_proof(p_site uuid, p_now timestamptz)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_out jsonb;
  v_hoje date;
begin
  if p_site is null or p_now is null then
    raise exception 'competitor_missing_proof: parâmetro nulo';
  end if;
  v_hoje := (p_now at time zone 'America/Sao_Paulo')::date;

  -- (emenda 1: D-M4 e S-m5) um "apagar" do mesmo vídeo que confirma enquanto o piso é inserido faz a inserção falhar por
  -- chave estrangeira. Não é perda: tenta de novo (a leitura seguinte já não vê o vídeo).
  -- (emenda 2: N3) "apagar canal" trava os vídeos em ordem de id: o piso é inserido na MESMA ordem (order by a.id), para as
  -- duas transações não se esperarem em círculo; se ainda assim houver impasse (40P01), é tratado como a falha de chave.
  -- São 3 tentativas: um impasse seguido de uma falha de chave (o apagar que confirma) gasta duas. A 3ª falha sobe.
  for v_try in 1..3 loop
  begin
  with aus as (
    select v.id, coalesce(v.missing_since, c.missing_since) as desde,
           (select count(*) from public.competitor_video_daily d where d.video_id = v.id)
         + (select count(*) from public.competitor_video_early e where e.video_id = v.id)
         + (select count(*) from public.competitor_video_versions x where x.video_id = v.id) as linhas,
           (select count(*) from public.competitor_video_versions x
             where x.video_id = v.id and x.thumb_blob_url is not null) as miniaturas
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where c.site_id = p_site and (v.missing_since is not null or c.missing_since is not null)
  ), ant as (
    select a.id, a.desde, a.linhas, a.miniaturas, b.lines_floor
      from aus a
      left join public.competitor_missing_baseline b on b.video_id = a.id and b.missing_since = a.desde
  ), grava as (
    insert into public.competitor_missing_baseline (video_id, missing_since, site_id, lines_floor, measured_at)
    select a.id, a.desde, p_site, a.linhas, p_now from ant a where a.lines_floor is null
     order by a.id
    on conflict (video_id, missing_since) do nothing
    returning 1
  ), esp as (
    select v.missing_since as desde
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
     where c.site_id = p_site and v.missing_since is not null and v.removal_decision is null and c.missing_since is null
    union all
    select c.missing_since
      from public.competitor_channels c
     where c.site_id = p_site and c.missing_since is not null and c.removal_decision is null
    union all
    select min(k.missing_since)
      from public.competitor_video_comments k
      join public.competitor_videos v on v.id = k.video_id
      join public.competitor_channels c on c.id = k.competitor_channel_id
     where k.site_id = p_site and k.missing_since is not null and k.removal_decision is null
       and v.missing_since is null and c.missing_since is null
     group by k.competitor_channel_id
  )
  select jsonb_build_object(
    'videos_ausentes', (select count(*) from ant),
    'linhas_de_ausentes', (select coalesce(sum(ant.linhas), 0) from ant),
    'miniaturas_de_ausentes', (select coalesce(sum(ant.miniaturas), 0) from ant),
    'ausentes_com_queda', (select count(*) from ant where ant.lines_floor is not null and ant.linhas < ant.lines_floor),
    'pisos_novos', (select count(*) from grava),
    'esperando', (select count(*) from esp),
    'mais_antigo_dias', (select v_hoje - min(esp.desde) from esp),
    'apagando', (select count(*) from public.competitor_removed_items r
                  where r.site_id = p_site and (cardinality(r.blobs_pending) > 0 or r.archive_pending)),
    'apagando_ha_mais_de_1d', (select count(*) from public.competitor_removed_items r
                                where r.site_id = p_site and (cardinality(r.blobs_pending) > 0 or r.archive_pending)
                                  and r.decided_at < p_now - interval '1 day'),
    'voltaram_sem_resposta', (select count(*) from public.competitor_removed_items r
                               where r.site_id = p_site and r.returned_seen_at is not null and r.return_decision is null)
  ) into v_out;
  exit;
  exception when foreign_key_violation or deadlock_detected then
    if v_try = 3 then
      raise;
    end if;
  end;
  end loop;
  return v_out;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. O número da aba: o que espera resposta + o que está apagando + o que voltou sem resposta. Só lê.
--     Vídeo de canal ausente não conta solto (o canal é um item); comentários contam um grupo por canal.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_missing_count(p_site uuid)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'videos', (select count(*) from public.competitor_videos v
                 join public.competitor_channels c on c.id = v.competitor_channel_id
                where c.site_id = p_site and v.missing_since is not null
                  and v.removal_decision is null and c.missing_since is null),
    'canais', (select count(*) from public.competitor_channels c
                where c.site_id = p_site and c.missing_since is not null and c.removal_decision is null),
    'grupos_de_comentarios', (select count(distinct k.competitor_channel_id)
                                from public.competitor_video_comments k
                                join public.competitor_videos v on v.id = k.video_id
                                join public.competitor_channels c on c.id = k.competitor_channel_id
                               where k.site_id = p_site and k.missing_since is not null and k.removal_decision is null
                                 and v.missing_since is null and c.missing_since is null),
    'apagando', (select count(*) from public.competitor_removed_items r
                  where r.site_id = p_site and (cardinality(r.blobs_pending) > 0 or r.archive_pending)),
    -- (emenda 1: D-M9 e D-M10) cada linha conta uma vez: a que ainda está apagando não entra aqui; comentários contam um por canal
    'voltaram', (select count(*) from public.competitor_removed_items r
                  where r.site_id = p_site and r.kind in ('video', 'canal')
                    and r.returned_seen_at is not null and r.return_decision is null
                    and cardinality(r.blobs_pending) = 0 and not r.archive_pending)
              + (select count(distinct r.competitor_channel_id) from public.competitor_removed_items r
                  where r.site_id = p_site and r.kind = 'comentario'
                    and r.returned_seen_at is not null and r.return_decision is null));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12b. (emenda 1: D-I2) Comentários já apagados, um objeto por canal: a tela mostra a contagem sem trazer as linhas
--      (são uma por comentário e passam do teto de linhas da API). Só lê; não devolve id de comentário.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_removed_comment_groups(p_site uuid)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
                    'competitor_channel_id', g.competitor_channel_id,
                    'comentarios', g.n,
                    'decided_at', g.decided_at) order by g.decided_at desc), '[]'::jsonb)
    from (select r.competitor_channel_id, count(*) as n, max(r.decided_at) as decided_at
            from public.competitor_removed_items r
           where r.site_id = p_site and r.kind = 'comentario'
           group by r.competitor_channel_id) g;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Quem executa: só service_role.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.competitor_jsonb_sum(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.competitor_cascade_counts(text, uuid) from public, anon, authenticated;
revoke all on function public.competitor_purge_preview(uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.competitor_video_purge(uuid, uuid, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.competitor_channel_purge(uuid, uuid, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.competitor_comments_purge(uuid, uuid, bigint[], uuid, text, text) from public, anon, authenticated;
revoke all on function public.competitor_missing_keep(uuid, text, uuid[], bigint[], uuid, text, text) from public, anon, authenticated;
revoke all on function public.competitor_return_decide(uuid, bigint, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.competitor_removed_blobs_done(uuid, bigint, text[]) from public, anon, authenticated;
revoke all on function public.competitor_missing_proof(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.competitor_missing_count(uuid) from public, anon, authenticated;
revoke all on function public.competitor_comments_preview(uuid, uuid, bigint[]) from public, anon, authenticated;
revoke all on function public.competitor_removed_comment_groups(uuid) from public, anon, authenticated;
grant execute on function public.competitor_jsonb_sum(jsonb, jsonb) to service_role;
grant execute on function public.competitor_cascade_counts(text, uuid) to service_role;
grant execute on function public.competitor_purge_preview(uuid, text, uuid, integer) to service_role;
grant execute on function public.competitor_video_purge(uuid, uuid, uuid, integer, text, text) to service_role;
grant execute on function public.competitor_channel_purge(uuid, uuid, uuid, integer, text, text) to service_role;
grant execute on function public.competitor_comments_purge(uuid, uuid, bigint[], uuid, text, text) to service_role;
grant execute on function public.competitor_missing_keep(uuid, text, uuid[], bigint[], uuid, text, text) to service_role;
grant execute on function public.competitor_return_decide(uuid, bigint, text, uuid, text, text) to service_role;
grant execute on function public.competitor_removed_blobs_done(uuid, bigint, text[]) to service_role;
grant execute on function public.competitor_missing_proof(uuid, timestamptz) to service_role;
grant execute on function public.competitor_missing_count(uuid) to service_role;
grant execute on function public.competitor_comments_preview(uuid, uuid, bigint[]) to service_role;
grant execute on function public.competitor_removed_comment_groups(uuid) to service_role;

reset lock_timeout;
```

**Notas do contrato, para quem implementa o TypeScript.**
- A prova devolve **dez** chaves (`videos_ausentes`, `linhas_de_ausentes`, `miniaturas_de_ausentes`, `ausentes_com_queda`, `pisos_novos`, `esperando`, `mais_antigo_dias`, `apagando`, `apagando_ha_mais_de_1d`, `voltaram_sem_resposta`): nove são inteiros não negativos e `mais_antigo_dias` é inteiro ou nulo. `esperando` conta vídeos, canais e **grupos** de comentário (um por canal), com os mesmos critérios de `competitor_missing_count`.
- Índices que os `upsert` usam: a chave única `(site_id, kind, youtube_id)` de `competitor_removed_items` (MG1) e a chave primária `(video_id, missing_since)` da tabela nova. Nenhum índice novo em tabela existente, salvo o que a CP13 mandar (emenda 1: D-I4; a Tarefa 1 corrige esta frase se criar algum).
- As funções são `security invoker`: quem as chama é o papel de serviço, que não passa pela RLS; `anon` e `authenticated` não têm `execute`. Nenhuma confia no GUC `app.site_id`: o site é sempre parâmetro, e cada função o confere contra a linha.
- (emenda 1) São **treze** funções. As duas novas são só de leitura: `competitor_comments_preview(p_site, p_channel, p_comment_ids)` devolve `{ status: 'ok' | 'not_found', encontrados, respostas, rows }`, com `rows` nas mesmas três chaves do `rows_deleted` de `competitor_comments_purge` (o teste compara chave a chave); `competitor_removed_comment_groups(p_site)` devolve uma lista `[{ competitor_channel_id, comentarios, decided_at }]`, vazia quando não há.
- (emenda 1) `competitor_missing_count.voltaram` é **agrupada** (vídeo e canal por linha, sem os que ainda estão apagando; comentários um por canal). `voltaram_sem_resposta` da prova continua sendo a contagem **de linhas**, sem agrupar: é número de nota, não entra no contador da aba.
- (emenda 1) `competitor_video_purge` e `competitor_channel_purge` carregam `set statement_timeout = '30s'` na definição. Chamadas por `psql` a cláusula não muda o relógio do comando em curso; quem a faz valer é o PostgREST, e isso é provado pela API (Tarefa 1, passo 5). O erro `57014` continua virando `tempo_esgotado` no serviço.
- (emenda 1) `competitor_missing_proof` tenta de novo quando a inserção do piso falha por chave estrangeira (corrida com um "apagar"); o contrato de retorno não muda. (emenda 2: N3) São até **três** tentativas (eram duas), a mesma saída vale para impasse de travas (`40P01`), e o piso é inserido em ordem de `id`. A Tarefa 1 confere no ensaio que `insert … select … order by … on conflict` é aceito como está escrito; se não for, a ordem passa para uma subconsulta e o Apêndice é corrigido.

**Volta da migration (comandos para o dono colar, um por linha; só com o Envio B revertido):**

```sql
drop function if exists public.competitor_removed_comment_groups(uuid);
drop function if exists public.competitor_comments_preview(uuid, uuid, bigint[]);
drop function if exists public.competitor_missing_count(uuid);
drop function if exists public.competitor_missing_proof(uuid, timestamptz);
drop function if exists public.competitor_removed_blobs_done(uuid, bigint, text[]);
drop function if exists public.competitor_return_decide(uuid, bigint, text, uuid, text, text);
drop function if exists public.competitor_missing_keep(uuid, text, uuid[], bigint[], uuid, text, text);
drop function if exists public.competitor_comments_purge(uuid, uuid, bigint[], uuid, text, text);
drop function if exists public.competitor_channel_purge(uuid, uuid, uuid, integer, text, text);
drop function if exists public.competitor_video_purge(uuid, uuid, uuid, integer, text, text);
drop function if exists public.competitor_purge_preview(uuid, text, uuid, integer);
drop function if exists public.competitor_cascade_counts(text, uuid);
drop function if exists public.competitor_jsonb_sum(jsonb, jsonb);
drop table if exists public.competitor_missing_baseline;
```

`competitor_removed_items` não é tocada pela volta: as linhas do que já foi apagado ficam, e é isso que impede a recoleta enquanto o Envio A estiver no ar.
