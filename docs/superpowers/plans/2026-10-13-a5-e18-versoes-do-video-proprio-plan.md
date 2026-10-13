# A5, ordem 12: E18, versões do vídeo próprio (plano de implementação)

Escrito em 13/10/2026. Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md`, seção 7.5 (partes 1 a 5 e 7) e itens de aceite 173 a 195, 199 a 201, 203, 245 a 247; obrigação de plano OP-2. Migration: **MG12** (lote C, a última das cinco). Fatos de partida: `.superpowers/sdd/a5-planos-onda-2/e18-versoes-do-video-proprio/fatos.md` (conferi no código local os que decidem o desenho; a seção 3 diz quais).

**Objetivo, em três frases.** Passar a saber, para cada vídeo dos canais do dono, quais títulos, thumbnails e descrições ele já teve, de quando a quando, e se a troca foi feita pelo A/B Lab ou fora do sistema. Isso sai de uma tabela nova, derivada das linhas diárias de `yt_own_video_meta_daily` (que existem desde 07/10/2026), por um passo novo do cron diário que já existe, sem nenhuma chamada ao YouTube. A etapa entrega também o leitor de servidor e a função pura do "antes e depois da troca", que a tela (parte 6, fora daqui) vai consumir.

**Fica FORA deste plano.**
- **A tela** (parte 6 de 7.5: bloco "Trocas deste vídeo", marcas nos gráficos, faixa "em teste A/B", faixa "antes do início do registro"). Espera o mockup 3 ajustado e os dois elementos novos desenhados (decisão 45). Itens 196, 197 e 198 ficam com ela. Aqui só entram os tipos, o leitor e a função pura (seção 4.7 é o contrato que a tela consome).
- **A dieta de `yt_own_video_meta_daily`** (parte 2 da etapa, 7.5.10, migration MG17, item 202): é a ordem 23 da sequência, depois de 14 execuções limpas. Este plano só não fecha a porta dela (seção 4.8).
- O pacote "Perguntar a uma IA" (E17) e qualquer leitura das versões pelo Cowork: outra etapa.
- **Nenhuma rota nova** em `apps/web/src/app/api/pipeline/`; nada em `lib/pipeline/api-registry.ts`, `apps/web/data/pipeline-docs/` nem `docs/cowork-pipeline-reference.md`. A regra de Pipeline Integrity não se aplica.
- A regeneração de `src/types/database.types.ts` (desvio 9) e a semeadura **e a limpeza** das duas tabelas na semente e2e (as duas ficam com o plano da parte 6; desvio 10). (emenda 1: S-m3)
- A imagem de um retoque cujo dHash é idêntico ao anterior (pergunta 1).

**O que pode começar JÁ**, sem esperar migration, mockup nem resposta do dono: as Tarefas **2, 3, 4, 5 e 8** (módulos puros, regras e a mudança de uma condição no passo de metadados). A **6** (o passo) começa quando a 3 e a 4 estiverem commitadas. A **7** (integração no cron) espera a 6, a vez de mexer em `coleta/index.ts` **e a MG12 em produção com V1 a V5 conferidas** (emenda 1: S-I3; o motivo está na Tarefa 7). Esperam o lote C: a **1** (arquivo da migration) e a **10** (testes contra o banco). Espera a A4 em `staging`: a **9** (leitor). A **11** (semente do A/B Lab) e a **12** (envio) são as últimas.

---

## 0. Dependências duras (ler antes de tudo)

### 0.1 O que este plano usa de outras migrations e de outros planos

| O que uso | Forma exata, lida no repositório local | Onde uso |
|---|---|---|
| `public.yt_own_video_meta_daily` | chave primária `(youtube_video_id, day_pt)`; colunas lidas: `site_id`, `channel_id`, `video_id` (anulável), `title_at_capture`, `description_sha256`, `description_text`, `thumbnail_dhash`, `thumbnail_sha256_at_capture`, `thumbnail_blob_url`, `privacy_status`, `captured_at` (`supabase/migrations/20261007000006_coleta_canais_proprios_l1a.sql:66-96`) | a origem de tudo; a MG12 recusa sem ela |
| `youtube_channel_removal_impact` com o **corpo por catálogo** | soma toda tabela de `public` com chave estrangeira `on delete restrict` de uma coluna para `youtube_channels` (`supabase/migrations/20261013000002_observatorio_a5_e15_leitura_horaria.sql:315-386`, a MG9, que a tarefa dá como aplicada em produção) | as duas tabelas da MG12 entram sozinhas na soma; a MG12 **não recria** a função e **recusa** se o corpo em vigor não for o por catálogo (desvio 3) |
| `to_regprocedure('public.can_view_private_site(uuid)')` | função da MG11 (E17, passo 0), ainda sem arquivo. A MG12 usa o bloco PL do spec: existe = policy com ela; não existe = `can_edit_site` | policy das duas tabelas |
| `public.yt_own_collection_attempts` | colunas `scope_type`, `scope_id`, `kind`, `outcome`, `attempt_day` (dia em UTC), `site_id` | a prova diária (item 200) |
| `coleta/passos-desligados.ts` | `PASSOS_COM_INTERRUPTOR` já tem `'versoes'` (linha 6); `passoDesligado('versoes')` lê `YT_OWN_STEPS_OFF` a cada chamada | o interruptor. **Não edito o arquivo** |
| `coleta/criteria-desligados.ts` | `criterioDesligados(ctx, desligados)`: nota até a 7ª execução seguida, vermelho da 8ª; lê `resumo.<passo>.desligado` de `yt_own_collection_runs` | a Tarefa 7 só põe `'versoes'` na lista |
| `coleta/clock.ts` | `TETOS_MS` (soma 240 s) e `TETOS_DE_FIM_MS` (sem `versoes`) | **não edito**; o teto do passo é uma constante do próprio passo (desvio 6) |
| `observatorio/proprio/dias.ts`, `taxa.ts`, `edicao.ts`, `tipos.ts`, `ler.ts` (A4, commitados só localmente) | `DiaAlcance`, `montarDias`, `wilson(k, n)`, `edicaoValida`, `Privado<T>`, `Pedido` | **importo, não edito** (Tarefas 8 e 9) |

**Duas dependências que não são de arquivo:**
1. **A A4 em `staging`** antes da Tarefa 9 (o leitor importa o token de acesso dela). Este plano não toca mais `e2e/fixtures/observatorio-seed.ts` (emenda 1: S-m3). A Tarefa 8 importa só um tipo e uma função pura já commitados; se a A4 mudar a assinatura, o `tsc` acusa.
2. **A MG11, antes ou depois da MG12.** No lote C ela vem antes (ordem fixada: MG14, MG11, MG5, MG7, MG12). Se vier depois, a lista de tabelas cuja policy a MG11 troca tem de incluir `yt_own_video_versions` e `yt_own_versions_state` (spec 7.5.7, ponto b). Isso é do plano da E17, passo 0; este plano avisa na consulta V2.

### 0.2 Avisos de topo
- **Nada do SQL deste plano foi rodado.** Quem escreveu só tinha permissão de ler o repositório. O Apêndice A é o texto final proposto; a Tarefa 1 o roda **duas vezes** no banco local de integração (`bythiago_int`, banco na porta 54422) contra as migrations reais do lote C e só então cria o arquivo. Qualquer erro de sintaxe ou de ordem achado lá corrige o apêndice no mesmo commit.
- **O arquivo da MG12 não é criado antes da vez do lote C** (regra R2 dos planos do lote): o `db:new` carimba pela hora, e um arquivo criado cedo entraria no `db:push:prod` de outro lote. Até lá o SQL vive no Apêndice A e no ensaio `.superpowers/sdd/a5-e18/sql/mg12.sql`.
- **As migrations só vão ao dono depois do acordo dos dois especialistas** sobre este plano (decisão 45).
- **Nenhum ensaio ou script deste plano grava em produção.** `apps/web/.env.local` aponta para produção: teste de integração só com `HAS_LOCAL_DB=1` e as variáveis do `bythiago_int`. O comando da semente (Tarefa 11) nasce em modo de simulação e só grava com uma flag, e em produção quem o roda é o dono.
- **Tudo o que este plano avisa ao dono é cron vermelho** (nota em `falhas`). Não há push, sino nem e-mail próprio; o e-mail é o que o vigia do cron já manda quando o veredito é vermelho.
- **Nenhum texto de exceção do Postgres** (`message`, `details`, `hint`) vai a nota, coluna ou Sentry. As funções da MG12 lançam códigos curtos (`touch_recusado`, `sem_linha_do_dia`), e o passo escolhe a nota de um catálogo fechado. (emenda 1: S-m1) Todas essas recusas saem com o mesmo SQLSTATE (`P0001`); o nome da recusa vem no campo `message`. O passo compara `message` por **igualdade** com a lista fechada (`argumento_nulo`, `argumento_invalido`, `canal_fora_do_site`, `dia_nao_fechado`, `touch_recusado`, `sem_linha_do_dia`, `abertura_invalida`, `linha_de_base_incoerente`); qualquer outro texto, inclusive o de uma restrição violada, vira `erro_desconhecido` e nunca é copiado para a nota.
- **Dado privado.** Título de vídeo não listado ou privado e a origem da troca (que revela o que está em teste) não vão a nota de `falhas`, a `resumo` nem ao Sentry: só contagens e o id de 11 caracteres do YouTube.

---

## 1. Perguntas que só o dono responde

Nenhuma trava o início nem a MG12. Uma linha cada, com a recomendação e o padrão que vale se ele não responder (decisão 44). As perguntas 27 a 33 do spec já têm padrão (27 foi fechada pelo dono na decisão 45: 100 impressões por lado e 7 dias); não as repito.

1. **Retoque de thumbnail que não muda nenhum dos 64 bits do dHash: guardar a imagem nova?** Hoje a cópia é gravada no Blob com o dHash no nome do arquivo e com permissão de sobrescrever (`thumb-fingerprint.ts:101-107`), então guardar a imagem nova **apagaria a antiga**. Guardar as duas pede mudar o nome do arquivo, numa função que os concorrentes também usam. Recomendo não mexer agora. **Padrão:** a versão de retoque é registrada (com o hash dos bytes novos), a imagem guardada continua sendo a anterior, e a tela dirá "imagem quase igual, a cópia guardada é a anterior". **Trava:** nada.
2. **O passo de metadados passa a guardar a imagem sempre que o dHash mudar em 1 bit ou mais** (hoje só guarda quando muda mais de 6 bits contra a véspera)? É o que o spec pede em 7.5.2 ("uma mudança de uma condição") e o que evita que uma troca vista por deriva lenta nasça apontando a imagem velha. Custo: nos 140 pares de dias medidos os bytes não mudaram nenhuma vez, então o esperado é zero imagem a mais; no pior caso (o YouTube recodificar tudo todo dia) seriam 35 imagens por dia. Recomendo que sim. **Padrão:** sim (Tarefa 5), com a contagem conferida no D+7. **Trava:** só a Tarefa 5.
3. **Semente do A/B Lab** (pergunta 30 do spec): gravar os títulos dos ciclos de 31/05 a 07/06/2026 como versões "antes do início do registro"? Vale pouco (2 vídeos) e custa pouco. **Padrão:** sim, como última tarefa (Tarefa 11), por um comando que o dono cola; grava só títulos de ciclo, não o título original (desvio 8). **Trava:** só a Tarefa 11. Se ele cortar, a função `yt_own_versions_seed_pre` fica sem uso.
4. **Uma mudança só de espaço em branco no fim da descrição conta como versão nova de descrição?** A tabela diária guarda o hash do texto cru, e é só ele que existe nos dias sem mudança (desvio 2). **Padrão:** conta; a tela não mostra descrição por ora (pergunta 29 do spec). **Trava:** nada.

---

## 2. O que é do dono

**Uma coisa: aplicar o lote C, do qual a MG12 é a quinta e última migration.** Nenhum agente roda `db:push:prod`. E, se ele quiser a semente (pergunta 3), colar um comando no fim.

| Passo | Quem | O quê |
|---|---|---|
| 1 | controlador | roda as conferências de leitura P1 a P15 (seção 3.2; emenda 1) e anota em `.superpowers/sdd/a5-e18/progress.md` |
| 2 | controlador | avisa que chegou a vez do lote C e que os arquivos da MG14, MG11, MG5 e MG7 já existem |
| 3 | agente (Tarefa 1) | `npm run db:new observatorio_a5_e18_versoes_do_video_proprio`, **depois** dos outros quatro arquivos (o carimbo tem de ser posterior), cola o Apêndice A, roda o roteiro de prova duas vezes. Commit local |
| 4 | **dono** | `npm run db:push:prod` (digita `YES`), uma vez, com as cinco do lote C |
| 5 | agente | V1 a V5 em produção (só leitura), resultado no ledger |
| 5b | agente | **só agora** a Tarefa 7 (integração no cron) é escrita e commitada (emenda 1: S-I3) |
| 6 | agente | push do código (Tarefa 12), promoção fora de 11:55 a 12:15 UTC |
| 7 | **dono** (opcional) | o comando da semente do A/B Lab, depois do D+1 |

**Nome para o `db:new`:** `observatorio_a5_e18_versoes_do_video_proprio`. Uma migration só.

**Janela.** A MG12 cria duas tabelas vazias, seis índices sobre elas e três funções. Não altera nem lê tabela com tráfego, salvo duas leituras de catálogo no bloco de guarda. Não pede trava em tabela quente: as chaves estrangeiras novas tomam uma trava curta de `share row exclusive` em `sites`, `youtube_videos` e `youtube_channels` (milissegundos, porque as tabelas novas estão vazias). `set lock_timeout = '5s'` na primeira linha. Pode ser aplicada a qualquer hora; por hábito, fora de 11:55 a 12:15 UTC (cron da coleta).

**Convive com o código que está em `main`?** Sim, nos dois sentidos:
- **MG12 aplicada, código antigo:** a migration é **inerte**. Ninguém lê nem grava as tabelas novas; elas ficam vazias, então `serie_coletada` de `youtube_channel_removal_impact` não muda de valor até o código novo gravar. Nenhuma função existente é recriada.
- **Código novo sem a MG12:** o passo de versões confere o schema na primeira leitura e **para em vermelho sem gravar nada**: nota `schema_ausente: yt_own_versions_state`. Os outros passos seguem. O leitor devolve o estado `schema_ausente`, nunca lista vazia.
- **MG12 sem o corpo por catálogo da função de impacto:** a migration **recusa** no bloco de guarda e não cria nada.

### Consultas de conferência (para depois de aplicar; os resultados esperados vêm do texto do Apêndice A e a Tarefa 1 os confirma no banco local)

**V1: a migration entrou inteira?** Esperado: **2, 2, 6, 3, 0, 0**. (Antes de aplicar: 0, 0, 0, 0 e erro nas duas contagens de linha; rodar só depois.)

```sql
select (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname in ('yt_own_video_versions', 'yt_own_versions_state')) as tabelas_com_rls_de_2, (select count(*) from pg_policies where schemaname = 'public' and tablename in ('yt_own_video_versions', 'yt_own_versions_state') and cmd = 'SELECT') as policies_de_2, (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('idx_yovv_one_current', 'idx_yovv_dia', 'idx_yovv_pre', 'idx_yovv_canal', 'idx_yovv_canal_corrente', 'idx_yovv_site')) as indices_de_6, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('yt_own_versions_apply_day', 'yt_own_versions_seed_pre', 'yt_own_versions_prova') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute')) as funcoes_so_service_role_de_3, (select count(*) from public.yt_own_video_versions) as versoes, (select count(*) from public.yt_own_versions_state) as estados;
```

**V2: a policy é a certa para a ordem em que as migrations entraram?** Esperado em produção: duas linhas com `can_view_private_site(site_id)`, porque a MG11 vem antes no lote C. Se vier `can_edit_site(site_id)`, a MG11 não tinha entrado: avisar o controlador (a MG11, quando entrar, tem de trocar estas duas). Nenhuma política de escrita pode aparecer.

```sql
select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename in ('yt_own_video_versions', 'yt_own_versions_state') order by 1, 2;
```

**V3: as duas tabelas estão presas ao canal e a função de impacto as conta.** Esperado: `2` e `true`.

```sql
select (select count(*) from pg_catalog.pg_constraint k where k.contype = 'f' and k.confrelid = 'public.youtube_channels'::regclass and k.confdeltype = 'r' and cardinality(k.conkey) = 1 and k.conrelid in ('public.yt_own_video_versions'::regclass, 'public.yt_own_versions_state'::regclass)) as tabelas_presas_ao_canal_de_2, (select p.prosrc like '%pg_catalog.pg_constraint%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'youtube_channel_removal_impact') as corpo_por_catalogo;
```

**V4: a prova roda e diz a verdade antes de o código novo rodar.** Esperado logo depois de aplicar, com o código antigo no ar: `publicos` igual ao número de vídeos públicos (35 em 12/10), `sem_titulo` e `sem_thumb` iguais a `publicos` (nenhuma versão existe ainda), `canais_com_linha_sem_estado` igual ao número de canais com linha diária (2 esperados), `derivado_ate` nulo, `origem_cms` 0. É leitura pura.

```sql
select public.yt_own_versions_prova((select site_id from public.youtube_channels where sync_enabled limit 1), ((now() at time zone 'America/Los_Angeles')::date - 1));
```

**V5: as restrições de forma existem.** Esperado: `9`.

```sql
select count(*) from pg_constraint where conrelid = 'public.yt_own_video_versions'::regclass and contype = 'c' and conname like 'yovv_%';
```

---

## 3. Fatos de que o desenho depende

### 3.1 Conferidos no código local em 13/10 (HEAD `8144a7fd`)

| # | Fato | Fonte |
|---|---|---|
| F1 | O passo de metadados grava a linha de "ontem no Pacífico" com o estado **do instante da captura** (por volta de 12:00 UTC do dia seguinte). A linha do dia D mostra o que estava no ar já no dia D+1 do Pacífico | `coleta/meta-step.ts` (`const day = ontemPt(agora)`); `coleta/index.ts:177-179` |
| F2 | Sem captura pela API o título da linha vem de `youtube_videos` e pode estar velho; o sinal de captura é `privacy_status` não nulo | `meta-step.ts` (`const titulo = cap?.title ?? v.title`) |
| F3 | `description_sha256` é o sha256 inteiro do texto cru; `description_text` só é gravado quando o hash difere do da linha anterior do vídeo, ou na primeira linha | `meta-step.ts` (`const descHash = descricao === null ? null : sha256(descricao)`; a condição de `linha.description_text`) |
| F4 | A cópia da thumbnail só é guardada quando o dHash do dia fica a mais de 6 bits do dHash **da véspera**; senão a linha repete a URL anterior | `meta-step.ts`, `capturarThumb` (`const mudou = …`) |
| F5 | O arquivo no Blob se chama `observatorio/thumbs/<uuid do vídeo>/<dHash>.jpg`, com `allowOverwrite: true`. Guardar outra imagem com o mesmo dHash sobrescreve a anterior | `thumb-fingerprint.ts:101-107` |
| F6 | `thumbnail_dhash` e `thumbnail_sha256_at_capture` são gravados juntos, só quando a captura da imagem deu certo | `meta-step.ts` (`if (thumb.ok) { … }`) |
| F7 | O resumo das duas fases do cron é fundido (`{ ...antes, ...depois }`) e gravado em `yt_own_collection_runs.resumo`; os tempos por passo vão a `ms_passos` | `app/api/cron/sync-analytics-metrics/route.ts` (`resumoColeta`, `msPassos`) |
| F8 | `'versoes'` já está em `PASSOS_COM_INTERRUPTOR`; nenhum outro arquivo de `coleta/` cita o passo | `coleta/passos-desligados.ts:6`; `grep versoes` |
| F9 | `TETOS_MS` soma 240 s dos 270 s do relógio; os 30 s restantes são a reserva da parte antiga da rota; um teste trava a soma | `coleta/clock.ts:4-5` |
| F10 | `ab_tests.youtube_video_id` é o uuid de `youtube_videos`, não o id de 11 caracteres; a linha diária guarda esse uuid em `video_id`, anulável | `supabase/migrations/20260517000001_ab_testing.sql`; L1a |
| F11 | `applied_metadata` de um ciclo traz `title_set` (texto) e `thumbnail_set` (booleano) | `lib/youtube/ab-types.ts` (`AppliedMetadata`) |
| F12 | `youtube_channel_remove` recusa com `status: 'serie_coletada'` quando a soma é maior que zero, antes de apagar qualquer coisa | `20261008000002_coleta_canais_proprios_l1b.sql:143-190` |
| F13 | `lerAlcance` lê os últimos 35 dias contados de `hoje`; quem decide zero medido, com impressões ou não medido é `montarDias` | `proprio/ler.ts:95-126`; `proprio/dias.ts:160-202`; conferência C0.10 |
| F14 | "Vídeo público" é o último `privacy_status` conhecido igual a `'public'`; `youtube_videos` não tem coluna de privacidade | conferência C0.11 |
| F15 | O intervalo de Wilson de 95% já existe como `wilson(k, n)`; o `wilsonScore` do A/B Lab é outra conta | `proprio/taxa.ts:41`; `ab-lab/queries.ts:614` |
| F16 | O Postgres do banco local de integração cai (SIGSEGV) quando `anon` ou `authenticated` chama uma função sem `EXECUTE` | memória do projeto, "Banco local de integração" |

### 3.2 Conferências pendentes (só produção responde; quem roda é o controlador, só leitura)

Cada linha diz o que muda no plano conforme a resposta. Nenhuma trava as Tarefas 2 a 8.

| # | Comando | Esperado | O que muda se for diferente |
|---|---|---|---|
| P1 | `select md5(prosrc), prosrc like '%pg_catalog.pg_constraint%' from pg_proc where proname = 'youtube_channel_removal_impact' and pronamespace = 'public'::regnamespace;` | `true` na segunda coluna | `false`: a MG9 não está como se supôs; a MG12 só pode entrar depois da MG14 (que traz o corpo). No lote C já é assim; a guarda da MG12 recusaria sozinha |
| P2 | `select day_pt, count(*) n, count(*) filter (where privacy_status is null) sem_priv, count(*) filter (where thumbnail_dhash is null) sem_dhash, count(*) filter (where thumbnail_dhash is not null and thumbnail_sha256_at_capture is null) dhash_sem_sha, count(*) filter (where thumbnail_blob_url is null) sem_blob from yt_own_video_meta_daily group by 1 order by 1;` | um dia por linha desde 07/10, 35 por dia, `sem_priv` = 35 só em 07/10, `dhash_sem_sha` = 0 | dia faltando: a primeira execução nasce com um buraco, fica vermelha uma vez e segue (seção 6, linha 5). `dhash_sem_sha` maior que zero: nesses dias não há como ver retoque; o resumo conta e o plano não muda. Contagem de vídeos diferente de 35: muda o número esperado no D0 (3 × vídeos) |
| P3 | `select youtube_video_id, count(distinct title_at_capture) titulos, count(distinct description_sha256) descricoes, count(distinct thumbnail_sha256_at_capture) sha_thumb, count(distinct thumbnail_dhash) dhashes from yt_own_video_meta_daily where privacy_status is not null group by 1 having count(distinct title_at_capture) > 1 or count(distinct description_sha256) > 1 or count(distinct thumbnail_sha256_at_capture) > 1;` | zero linhas | qualquer linha: a primeira execução vai gravar essas trocas, e o D0 espera esse número em vez de zero. O teste do item 188 usa semente de mesma forma e não muda |
| P4 | `select count(*) from (select distinct on (youtube_video_id) * from yt_own_video_meta_daily where privacy_status is not null and description_sha256 is not null order by youtube_video_id, day_pt) x where description_text is null;` | número anotado (pode ser maior que zero: a primeira linha capturada, de 08/10, pode repetir o hash da linha de 07/10, que foi quem guardou o texto) | nada no desenho: o passo busca o texto, **em uma leitura por canal e dia**, na linha mais recente com o mesmo hash (seção 4.3; emenda 1: D-I4, S-I4). Com P4 perto de 35, a busca de recuo acontece para quase todos os vídeos no dia 08/10 (é o esperado pelo código: `meta-step.ts:444` só grava o texto quando o hash difere do da linha anterior). Se depois da busca ainda faltar texto, o D0 mostra `desc_sem_texto` maior que zero e uma nota vermelha naquele dia |
| P5 | `select t.id, t.status, t.youtube_video_id, t.started_at, t.paused_at, t.completed_at, t.winner_applied_at, (t.original_title is not null) tem_titulo, count(c.id) ciclos, count(c.id) filter (where c.applied_metadata ->> 'title_set' is not null) com_titulo from ab_tests t left join ab_test_cycles c on c.test_id = t.id group by t.id order by t.started_at;` | 2 testes encerrados, 7 ciclos, de 31/05 a 07/06/2026 | teste `active`, `paused` ou `queued`, ou iniciado depois de 07/10: a primeira execução grava rotações e o D0 não espera "zero trocas". `com_titulo` é o número de linhas que a semente da Tarefa 11 vai gravar |
| P6 | `select to_regprocedure('public.can_view_private_site(uuid)') is not null;` | `false` hoje; `true` depois da MG11 | só o esperado da V2 |
| P7 | `select to_regclass('public.yt_own_video_versions') is not null a, to_regclass('public.yt_own_versions_state') is not null b; select version from supabase_migrations.schema_migrations order by version desc limit 8;` | `false`, `false`; e as versões já aplicadas | `true`: alguém aplicou antes; parar e avisar |
| P8 | `select min(day_pt), max(day_pt), count(*), count(distinct youtube_video_id), coalesce(sum(thumbnail_impressions) filter (where day_pt >= current_date - 30), 0) imp_30d from yt_own_video_reach_daily;` | por volta de 158 impressões em 30 dias (12/10) | só o texto do relatório da etapa: com o limiar em 100 por lado, toda troca de hoje dá "ainda não dá para dizer" |
| P9 | `select youtube_video_id, count(distinct thumbnail_sha256_at_capture) from yt_own_video_meta_daily where thumbnail_sha256_at_capture is not null group by 1 having count(distinct thumbnail_sha256_at_capture) > 1;` | zero linhas | qualquer linha: o retoque (ou a recodificação pelo YouTube) deixou de ser teórico; a pergunta 1 e a Tarefa 5 sobem de prioridade e o D+7 da Tarefa 5 é adiantado |
| P10 | `vercel env ls production \| grep YT_OWN_STEPS_OFF` (dono ou controlador) | ausente, ou sem `versoes` | com `versoes` na lista o passo nasce desligado; tirar antes do envio, ou aceitar e contar as 7 execuções |
| P11 | `select id, name, sync_enabled, collection_status, video_count from youtube_channels; select channel_id, count(*) from yt_own_video_meta_daily where day_pt >= current_date - 3 group by 1;` | 2 canais, os dois com linha nos últimos dias | canal com vídeos e sem linha: o passo nasce vermelho para ele (é o comportamento certo, item 189); avisar antes do envio para não surpreender |
| P12 | `select ran_at, ms_total, ms_passos from yt_own_collection_runs order by ran_at desc limit 7;` | `ms_total` com folga de mais de 5 s para os 270 s; `ms_passos.metadados` bem abaixo de 30 s | folga menor que 5 s em alguma execução: o bloco do passo vai para o fim da fase `'depois'` em vez da fase `'antes'` (desvio 6 diz como). **Mover não é só mover um bloco** (emenda 1: S-m8): exige a tarefa 7b descrita no desvio 6. A mesma resposta dá o tempo real por ida ao banco, que troca os 50 ms estimados da seção 5.2 (emenda 1: D-I4) |
| P13 (emenda 1: S-I4) | `select day_pt, count(*) filter (where description_sha256 is not null) com_hash, count(*) filter (where description_text is not null) com_texto from yt_own_video_meta_daily where day_pt <= '2026-10-09' group by 1 order by 1;` | em 08/10, `com_texto` perto de 0 e `com_hash` perto de 35 (o texto ficou na linha de 07/10) | `com_texto` perto de 35 em 08/10: a busca de recuo quase não acontece e a primeira execução faz 2 idas a menos; o desenho não muda (a busca em lote fica) |
| P14 (emenda 1: D-I3, S-I2; emenda 2: D-N1, S-N1) | `select t.id, t.status, t.test_type, t.completed_reason, (t.winner_variant_id is not null) tem_vencedor, t.paused_at, t.completed_at, t.winner_applied_at, (t.original_thumbnail_url is not null) tem_thumb_original, (t.original_thumbnail_url like '%blob.vercel-storage.com%') original_no_blob, count(c.id) filter (where (c.applied_metadata ->> 'thumbnail_set')::boolean) ciclos_com_thumb from ab_tests t left join ab_test_cycles c on c.test_id = t.id group by t.id order by t.started_at;` | 2 testes do tipo `combo`, encerrados; `completed_reason` de cada um **não é suposto** (anotar) | não muda a regra da seção 4.4 (os caminhos estão no código, não no dado); diz qual caminho de encerramento os testes existentes tomaram. Linha com `completed_reason = 'manual_winner'` e `winner_applied_at` nulo, ou `auto_resolve` com `winner_applied_at` nulo, vira fixture dos casos 18 a 20 da Tarefa 4. `original_no_blob` falso em algum teste: nesse teste as paradas automáticas e as de reenvio condicional não devolvem a imagem (risco 3); anotar o id. Esta consulta cobre também a conferência CP4 pedida pelo parecer de dados da rodada 2 (a contagem por `completed_reason` sai da lista) |
| P15 (emenda 1: S-m5) | `select count(*) from (select distinct on (youtube_video_id) youtube_video_id, privacy_status from yt_own_video_meta_daily where privacy_status is not null order by youtube_video_id, day_pt) x where privacy_status = 'private';` | 0 | maior que zero: a linha de base de thumbnail desses vídeos, aberta com a linha de 07/10 (sem privacidade conhecida), pode ser a imagem de substituição do YouTube (risco 15). O controlador anota os ids; o plano não muda |

---

## 4. Desenho, no que difere de "copiar o que já existe"

### 4.1 Peças e onde moram

| Peça | Arquivo novo | Depende de banco? |
|---|---|---|
| Regras (limiar, janela, retoque) e tipos | `src/lib/youtube/observatorio/proprio-versoes/regras.ts`, `tipos.ts` | não |
| Derivação de um dia (parte 1) | `src/lib/youtube/coleta/versoes-derivar.ts` | não |
| Origem da troca (parte 1) | `src/lib/youtube/coleta/versoes-origem.ts` | não |
| Passo do cron (parte 3) | `src/lib/youtube/coleta/versoes-step.ts` | sim |
| Antes e depois (parte 5) | `src/lib/youtube/observatorio/proprio-versoes/antes-depois.ts` | não |
| Leitor (parte 4) | `src/lib/youtube/observatorio/proprio-versoes/ler.ts` | sim |
| Semente do A/B Lab (parte 7) | `src/lib/youtube/coleta/versoes-semente-ab.ts` (puro) e `apps/web/scripts/semear-versoes-ab-lab.ts` (comando) | o comando, sim |

A pasta `proprio-versoes/` é nova de propósito: `observatorio/proprio/**` é zona reservada da A4 até ela ir a `staging`.

### 4.2 A derivação de um dia (função pura)

`derivarDia(correntes, linhas)` recebe as versões correntes do canal e as linhas diárias de **um** dia e devolve o que confirmar, o que abrir (ainda sem origem) e o que pulou. Regra por campo:

- **Título.** Só linha com `privacy_status` não nulo e `title_at_capture` não nulo. Valor comparado: `hashValue(title_at_capture)` (a função dos concorrentes, `competitor-versions.ts:22`). Sem versão corrente: abre a linha de base. Hash igual: confirma. Hash diferente: abre a nova.
- **Descrição.** Só linha com `privacy_status` não nulo e `description_sha256` não nulo. Valor comparado: o próprio `description_sha256` (desvio 2). O texto da versão é resolvido pelo passo, não pela função pura (seção 4.3).
- **Thumbnail.** Só linha com `thumbnail_dhash` não nulo e `privacy_status` diferente de `'private'`. Linha com `privacy_status` nulo **vale** para a thumbnail (a imagem é pública e foi baixada: é o caso das linhas de 07/10, que dão a linha de base de imagem), **salvo quando a última privacidade conhecida do vídeo, em dia anterior, é `'private'`** (emenda 1: S-m5): aí a imagem baixada pode ser a de substituição do YouTube, e a thumbnail é pulada como `privado`. A última privacidade conhecida chega no fato (`privacidadeConhecida`), montada pelo passo; sem nenhuma conhecida (as linhas de 07/10), a linha vale. Duas comparações:
  1. distância de `thumbnail_dhash` até a **âncora** (`thumb_anchor_dhash` da versão corrente) maior que 6: versão nova, `thumb_similar = false`, e a âncora passa a ser o dHash do dia;
  2. senão, `thumbnail_sha256_at_capture` não nulo, o da corrente não nulo, e os dois diferentes: versão de **retoque** (`thumb_similar = true`), que herda a âncora da corrente;
  3. senão: confirma a corrente.
  
  A âncora só anda com troca cheia. Assim uma deriva de 3 bits por dia gera retoques nos dois primeiros dias (os bytes mudaram) e **uma** troca cheia no terceiro, com 9 bits contra a âncora (item 176, lido junto com o 178: desvio 1).

O que cada versão aberta carrega: `first_seen_at` e `seen_at` iguais ao `captured_at` da linha; `window_start` igual ao `last_seen_at` da versão corrente (a captura da última linha que a confirmou) e `window_end` igual ao `captured_at` da linha; precisão `1d` quando o dia da linha menos o `last_day_pt` da corrente é 1, `lacuna` quando é maior; linha de base com precisão `first` e janela nula. Dois campos trocados no mesmo dia geram duas aberturas com a mesma janela quando as duas correntes foram confirmadas no mesmo dia (item 180).

O que a função **não** faz: ler banco, decidir origem, buscar texto de descrição.

### 4.3 O passo (`coleta/versoes-step.ts`)

Por canal (todos os de `youtube_channels`, não só os de `sync_enabled`, porque o passo de metadados cobre todos), nesta ordem:

1. Lê `yt_own_versions_state` do canal. Tabela ausente: nota `schema_ausente: yt_own_versions_state` e o passo **para para todos os canais**.
2. Conta os vídeos do canal em `youtube_videos` (`head`, `count: 'exact'`) **com o mesmo filtro do passo de metadados** (emenda 1: D-m6, S-m4): `published_at` não nulo e anterior ao fim de `ontem` no Pacífico (`meta-step.ts:185`). Vídeo agendado ou sem data de publicação não ganha linha diária e não pode produzir "tem vídeos e nenhuma linha". Para um dia sem linha no meio do intervalo, a contagem é refeita com o fim **daquele** dia (uma ida a mais, só nesse caminho). Contagem nula não é zero: vira nota "não foi possível avaliar".
3. Define o intervalo a derivar: de `derived_through + 1` (ou, sem estado, do menor `day_pt` do canal) até `ontem` no Pacífico, limitado a `MAX_DIAS_POR_EXECUCAO = 30` dias. **(emenda 2: S-n4)** Sem estado, o menor `day_pt` vem de **uma ida própria** (`day_pt` das linhas do canal, filtrando `site_id` e `channel_id`, ordem crescente, limite 1), feita só nesse caso. Não sai da leitura das linhas do passo 4, porque essa leitura já é limitada ao intervalo: tirar o começo dela faria um canal com mais de 30 dias acumulados nascer com `tracking_since` no meio do histórico, calado. Resposta vazia: o canal não tem linha (seção 6, linhas 6 e 7). A conta da seção 5.2 inclui esta ida.
4. Lê as linhas diárias do intervalo com `lerPaginado` (`coleta/paginar.ts`), filtrando por `site_id` **e** `channel_id`, ordenadas por `day_pt, youtube_video_id`, teto de 20.000 linhas. **Sem** a coluna `description_text` (pode ter 5 kB por linha). Passar do teto ou erro de banco: nota vermelha e o canal não é derivado.
5. Lê as versões correntes do canal (`is_current`, filtrando `site_id` e `channel_id`), também paginado, **ordenado por `id`** (emenda 1: D-m7; `lerPaginado` exige ordem por chave única, `paginar.ts:17`).
6. Para cada dia do intervalo, **em ordem**:
   - **dia sem nenhuma linha**: se existe dia posterior com linha no intervalo lido, o dia é pulado e contado em `dias_sem_linha` (a troca vista depois ganha precisão `lacuna` sozinha); se é o fim do intervalo, o canal para ali. Nos dois casos, com vídeos cadastrados no canal, entra a nota vermelha (item 189);
   - **(emenda 1: S-m5)** monta os fatos do dia com a `privacidadeConhecida` de cada vídeo: a última privacidade não nula de dia **anterior**. Ela vem das linhas já lidas do intervalo; só quando o dia tem linha sem privacidade e com dHash de um vídeo sem privacidade anterior em memória, e o canal **já tem estado** (no primeiro dia derivado de um canal não existe dia anterior), o passo faz **uma** leitura por canal e execução: `youtube_video_id, day_pt, privacy_status` das linhas do canal com privacidade não nula e `day_pt` anterior ao começo do intervalo, dos últimos 30 dias, ordenadas por `youtube_video_id, day_pt desc`, paginadas. Leitura que falha: a thumbnail desses vídeos é pulada como `sem_captura` e sai nota vermelha de erro de banco (não se abre versão sobre privacidade desconhecida por falha);
   - chama `derivarDia`;
   - se há abertura que não é linha de base, usa a leitura do A/B Lab do canal e chama `atribuirOrigem`. **(emenda 1: D-I2, S-I1) A leitura é própria do passo, não cópia da de `meta-step.ts`** (aquela não traz `winner_applied_at` e filtra os ciclos por `ended_at` posterior ao começo do dia, `meta-step.ts:101` e `:121-125`: serve aos segundos no ar, não à janela de uma troca). Ela é feita **no primeiro dia com troca** do canal na execução, e vale para os dias seguintes do mesmo canal porque cobre o canal inteiro e o intervalo inteiro: (a) `ab_tests`, colunas `id, youtube_video_id, test_type, paused_at, completed_at, completed_reason, winner_variant_id, winner_applied_at, original_title` (emenda 2: D-N1, S-N1: `completed_reason` e `winner_variant_id` entram; sem eles o encerramento com vencedor escolhido à mão não se distingue do encerramento que devolve a original), para **todos** os uuids de vídeo (`video_id`) das linhas lidas do canal no intervalo, e não só os vídeos com troca naquele dia; (b) `ab_test_cycles`, colunas `id, test_id, variant_id, started_at, applied_metadata`, dos testes lidos, com `started_at` entre o menor `last_seen_at` das versões correntes **dos vídeos com linha no intervalo** no momento da leitura (nenhuma janela do intervalo começa antes; emenda 2: D-n2: a corrente de um vídeo que não tem mais linha, apagado ou parado, não entra nesse mínimo, senão prenderia o limite no passado e a leitura cresceria até o teto de 1.000) e o maior `captured_at` das linhas do intervalo (nenhuma termina depois), as duas pontas incluídas. Leitura que falha, ou qualquer das duas que chega a 1.000 linhas: origem `nao_se_sabe` em todas as trocas do canal na execução e nota vermelha (item 184). Sem nenhuma troca no intervalo, o Lab não é lido;
   - para as aberturas de descrição do dia, busca o texto **em uma leitura por canal e dia** (emenda 1: D-I4, S-I4): linhas do canal com `youtube_video_id` na lista dos vídeos que abrem, `description_text` não nulo e `day_pt <= dia`, ordenadas por `youtube_video_id, day_pt desc`, paginadas (teto de 20.000). Para cada abertura vale a linha mais recente do vídeo com o **mesmo** `description_sha256`. Não achou: `value_text` nulo, `desc_sem_texto` no resumo e nota vermelha;
   - chama `yt_own_versions_apply_day`. **(emenda 1: D-I1)** `ok` sem abertura: aplica o plano do dia às correntes em memória com a função pura `aplicarPlanoNasCorrentes` (as confirmadas passam a ter `ultimoDia` = o dia e `vistaAte` = a captura do dia), para que a troca do dia seguinte saia com a janela e a precisão que duas execuções diárias dariam. `ok` com abertura: relê as correntes do canal (os ids das versões novas nascem no banco). `ja_derivado`: conta, relê as correntes e segue. Erro: nota vermelha e o canal para (os dias seguintes ficam para amanhã, em ordem);
   - **prazo dentro do dia (emenda 1: D-I4 item b, S-m7).** Toda leitura e toda chamada de função do passo vai dentro de `comPrazo(…, ctx.deadline)` (`clock.ts:88`), que devolve `null` quando o prazo do passo acaba. `null` numa leitura: o canal para com `sem_tempo: true`, sem nota de erro de banco. `null` em `apply_day`: o resultado é **desconhecido** (a transação pode ter fechado no banco): o canal para, o dia **não** é somado em `dias_derivados` e entra em `dia_sem_resposta`; a execução seguinte relê o estado e continua do dia certo, porque a função recusa dia repetido;
   - antes de cada dia confere o prazo: com menos de 1,5 s, para com `sem_tempo: true`.
7. Calcula o atraso do canal: `ontem` menos `derived_through` final. Igual a 1: fica no resumo; só é vermelho pela causa que o produziu (dia sem linha, erro). Maior que 1: nota vermelha, **com uma única exceção, a recuperação (emenda 1: D-I4 item c, S-I4 item b; a emenda 2 a estende ao teto de 30 dias, abaixo)**: o canal parou por `sem_tempo` **e** derivou 2 dias ou mais nesta execução. Aí o atraso vai ao resumo em `recuperando` (canal e atraso) e não é vermelho. A exceção não tem contador nem guarda estado, e termina sozinha: cada dia que passa acrescenta um dia a derivar, então quem deriva 2 ou mais por execução diminui o atraso a cada execução; quem derivar menos de 2 com atraso maior que 1 fica vermelho. (A frase anterior, "falta de tempo sozinha não é vermelho no primeiro dia", contradizia "maior que 1: vermelho, sempre" e sai.)
   - **(emenda 2: S-n7) A exceção vale também para quem parou no teto de 30 dias** (`MAX_DIAS_POR_EXECUCAO`), tendo derivado 2 dias ou mais: é a mesma recuperação, e termina sozinha pelo mesmo motivo. Sem isso, um envio feito mais de 30 dias depois de 07/10 nasceria vermelho por desenho.
   - **(emenda 2: S-n1) Canal sem estado.** Não tem `derived_through`. Para canal sem linha em `yt_own_versions_state` e com linha diária, o atraso é `ontem` menos (menor `day_pt` menos 1), com o menor `day_pt` do passo 3, e vale a mesma regra acima (vermelho se derivou menos de 2 dias com atraso maior que 1).
   - **(emenda 2: S-n1) Atraso desconhecido.** Canal cujo atraso o passo não chegou a saber, porque a leitura do estado ou a do menor `day_pt` não voltou até o prazo, ou porque o tempo acabou antes de chegar a ele, entra em `atraso_desconhecido` (lista de canais) no resumo e é **vermelho**: `versões: <n> canal(is) sem tempo para saber o atraso`. Uma exceção só: quando **outro** canal da mesma execução está em `recuperando` (o tempo foi gasto numa recuperação que termina sozinha), fica só no resumo. Assim "a primeira leitura não volta, todo dia" deixa de ser verde.

No fim, por site com canal: chama `yt_own_versions_prova(site, ontem)` (item 200). Vermelho quando `sem_explicacao > 0`, quando `origem_cms > 0` (item 203), quando `publicos = 0` havendo vídeos cadastrados e linhas com captura (ausência não é "zero vídeos públicos"), ou quando `canais_com_linha_sem_estado > 0` (emenda 1: D-m3). Duas ressalvas, as duas no resumo e nunca caladas (emenda 1: D-I4): enquanto algum canal do site estiver em `recuperando`, `sem_explicacao` não gera a sua nota (o motivo é o atraso, já contado); e `canais_com_linha_sem_estado` não é vermelho **só enquanto algum canal do site estiver em `recuperando`** (emenda 2: S-n1; a versão anterior dizia "quando o passo parou por `sem_tempo` antes de chegar ao canal", e isso deixava um canal sem versão nenhuma em verde, todo dia, se o banco estivesse sempre lento). Fora da recuperação, canal com atraso maior que 1 já tem a sua nota vermelha, e a da prova sai junto. **(emenda 2: S-n2) Prova sem resposta até o prazo** (`comPrazo` devolve `null`): o resumo do site traz `prova: 'sem_tempo'` e `sem_tempo` fica verdadeiro; não sai nota enquanto algum canal do site estiver em `recuperando` (a recuperação do D0 não nasce vermelha por isso); fora da recuperação é vermelho, a mesma nota da linha 18 da seção 6. A prova nunca some sem rastro.

O resumo do passo (`resumo.versoes`) traz: `dia_ate`, `canais`, `dias_derivados`, `confirmadas`, `abertas` por origem, `retoques`, `pulados` (`sem_captura`, `sem_dhash`, `privado`), `dias_sem_linha`, `ja_derivado`, `desc_sem_texto`, `origem_sem_video`, `origem_ab_incerta` e `atraso_desconhecido` (emenda 2), `atraso_dias` por canal, `sem_tempo`, `recuperando` e `dia_sem_resposta` (emenda 1), `prova` por site. "Zero trocas hoje" só aparece junto de `confirmadas` maior que zero.

### 4.4 A origem (função pura `atribuirOrigem`)

Para cada troca (abertura que não é linha de base), com os testes e ciclos do vídeo já lidos:

| Ordem | Condição | Resultado |
|---|---|---|
| 1 | a leitura do Lab falhou ou veio cortada | `nao_se_sabe` |
| 2 | a linha não tem `video_id` (o vídeo saiu de `youtube_videos`, e os testes dele foram junto) | `nao_se_sabe`, contado em `origem_sem_video`, **sem** vermelho (o passo de metadados já acusa "ausente de videos.list" para esse vídeo) |
| 3 | `winner_applied_at` de um teste do vídeo dentro da janela, **e o teste mexe no campo** (emenda 1: D-I3): título com `test_type` `title` ou `combo`; thumbnail com `thumbnail` ou `combo`; descrição com `description` ou `combo` | `ab_lab`, evento `vencedor`, instante = `winner_applied_at` |
| 3b (emenda 2: D-N1, S-N1) | **só campo thumbnail:** `completed_at` de um teste do vídeo dentro da janela, com `completed_reason = 'manual_winner'` e `test_type` `thumbnail` ou `combo` (o dono encerrou escolhendo o vencedor: a imagem enviada é a da variante escolhida, e `winner_applied_at` **fica nulo** nesse caminho) | `ab_lab`, evento `vencedor`, instante = `completed_at`, `ab_variant_id` = `winner_variant_id` |
| 4 | campo título: `paused_at` ou `completed_at` dentro da janela e título novo igual a `original_title`. **Campo thumbnail (emenda 1: D-I3, S-I2; emenda 2: D-N1, S-N1):** `paused_at` de um teste do vídeo dentro da janela; ou `completed_at` dentro da janela com `completed_reason = 'manual_archive'`; ou `completed_at` dentro da janela com `completed_reason` `manual_no_apply` ou `inconclusive` **e nenhum ciclo do teste com `thumbnail_set` verdadeiro começado na mesma janela**. Sem conferência de conteúdo (desvio 15). **A lista de motivos é fechada:** `winner_applied_at` nulo sozinho **não** basta | `ab_lab`, evento `restauro`, instante = o da parada |
| 4b (emenda 2: S-N1) | **só campo thumbnail:** `completed_at` dentro da janela num caminho em que o Lab reenviou (ou pode ter reenviado) uma imagem e as colunas lidas não dizem qual: `manual_no_apply` ou `inconclusive` **com** ciclo de `thumbnail_set` começado na mesma janela; ou `manual_winner` em teste de `test_type` `title` ou `description` | `nao_se_sabe`, com o `ab_test_id` do teste preenchido, contado em `origem_ab_incerta`, **sem** vermelho (o Lab foi lido; o que falta é o Lab gravar o que enviou) |
| 5 | ciclo com `started_at` dentro da janela e, no título, `title_set` igual ao título novo; na thumbnail, `thumbnail_set` verdadeiro. Havendo mais de um, vale o mais recente | `ab_lab`, evento `rotacao`, instante = `started_at`, com `ab_test_id` e `ab_variant_id` |
| 6 | nenhum evento, ou evento cujo título não bate | `fora_do_sistema` |

**Por que a ordem 4 vem antes da 5 também na thumbnail (emenda 1: S-I2; emenda 2: D-N1, S-N1, o texto anterior dizia "parar um teste devolve a imagem original", e isso só vale para parte dos caminhos).** Nenhum ciclo começa depois da parada sem uma retomada, que **zera** `paused_at` (`actions.ts:875`); logo, havendo parada e rotação na mesma janela, a parada é o evento mais recente. O que a parada envia ao YouTube depende do caminho, e a regra segue esta tabela, lida no código local em 13/10:

| Caminho que grava a parada | O que vai ao YouTube | `winner_applied_at` | Pela regra |
|---|---|---|---|
| pausa manual (`ab-lab/actions.ts:691-741`): grava `paused_at` só depois do envio; erro no envio devolve erro e não grava | a original | não muda | ordem 4, `restauro` |
| pausas automáticas: vigia (`api/cron/ab-watchdog/route.ts:118-161`) e rotação depois de 3 falhas (`ab-rotate-phases.ts:243-272`) | a original, **só se a URL original é do Blob** e sem garantia (erro vai ao Sentry e a pausa é gravada do mesmo jeito) | não muda | ordem 4, `restauro`; não se distingue da pausa manual pelas colunas lidas (risco 3) |
| aplicar o vencedor (`actions.ts:1396-1404`, `manual_apply`) e aplicação automática (`ab-evaluate-phases.ts:331-337` e `:553-557`, `auto_resolve`) | o vencedor | preenchido | ordem 3, `vencedor` |
| **encerrar escolhendo o vencedor** (`endAbTest(testId, winnerId)`, `actions.ts:936-973`, `manual_winner`) | a imagem da variante escolhida, ou a original se a variante não tem imagem (`targetVariant?.blob_url ?? original_thumbnail_url`, `:946`); **só thumbnail, o título não é enviado** | **fica nulo** | teste `thumbnail` ou `combo`: ordem 3b, `vencedor`. Teste `title` ou `description`: ordem 4b |
| encerrar sem vencedor (`endAbTest(testId)`, `manual_archive`) | a original; erro no envio não grava | nulo | ordem 4, `restauro` |
| cancelar no período de graça (`actions.ts:1448-1470`, `manual_no_apply`) | a original, só se é do Blob, sem garantia | nulo | ordem 4 sem rotação na janela; 4b com rotação |
| duração máxima (`ab-evaluate-phases.ts:407-440`, `inconclusive`) | a original, só se é do Blob, sem garantia | nulo | idem |
| duração máxima sem duas variantes com impressões (`ab-evaluate-phases.ts:117-137`, também `inconclusive`) | **nada** ("nothing to revert") | nulo | idem (não se distingue da linha de cima) |
| **encerramento automático com `AB_AUTO_APPLY_WINNER` desligado** (`ab-evaluate-phases.ts:236-257`, `auto_resolve`; é o padrão de produção) | **nada** | nulo | **não explica troca nenhuma**: segue para a ordem 5 (rotação) e a 6 |

Por que "sem rotação na janela" nos dois caminhos de reenvio sem garantia: se não houve rotação na janela e a imagem mudou, o Lab só pode tê-la mudado pelo reenvio (sem ele a imagem no ar seria a mesma da captura anterior, e nenhuma versão abriria; a outra explicação é troca à mão na mesma janela, que é o risco 3); se houve rotação na janela, a imagem vista pode ser a restaurada ou a da rotação, e o plano não afirma nenhuma das duas (ordem 4b). Motivo de encerramento fora desta tabela (`max_duration`, que o esquema aceita e nenhum código grava hoje; nulo; valor novo) **não explica nada**: a lista é fechada.

**(emenda 2: S-n5) Teste e variante em todo evento do Lab.** `vencedor` e `restauro` devolvem sempre `abTestId` (o teste cujo instante caiu na janela), como a `rotacao`: a função do banco recusa `ab_lab` sem teste (`abertura_invalida`), e uma origem `ab_lab` sem teste travaria o canal naquele dia para sempre. `abVariantId`: na rotação, a variante do ciclo; no vencedor, `winner_variant_id` (pode ser nulo); no restauro, nulo.

Descrição: só as condições 1, 2 e 6 e, pela 3, o vencedor (o Lab não registra a descrição aplicada de forma que o passo confira). Com origem `ab_lab` a precisão vira `min`, `first_seen_at` passa a ser o instante do evento, e `window_start` e `window_end` passam a ser esse mesmo instante. A "janela" inclui as duas pontas. Nenhuma versão sai com origem `cms`: o tipo de escrita não tem esse valor.

### 4.5 A mudança no passo de metadados (Tarefa 5)

Uma condição em `capturarThumb`: a cópia passa a ser guardada quando o dHash do dia é **diferente** do da linha anterior (1 bit ou mais), não mais quando difere em mais de 6. Como o nome do arquivo no Blob leva o dHash, um dHash diferente nunca sobrescreve a imagem anterior (F5). Com dHash idêntico e bytes diferentes nada é guardado (pergunta 1). Consequência útil para a leitura: a URL da linha **termina em `/<dHash>.jpg`** quando a imagem guardada é a daquele dia; o leitor expõe isso como `imagemExata` (seção 4.7), sem coluna nova. Para as linhas anteriores a esta mudança, uma versão aberta por deriva lenta pode apontar a imagem de uma versão vizinha, e `imagemExata` dirá `false`.

### 4.6 O antes e o depois (função pura `anteDepoisDaTroca`)

Recebe a troca, as outras versões do mesmo vídeo, os dias de alcance do vídeo já classificados por `montarDias` (a regra de zero medido e não medido **não é reescrita**), o dia da publicação e as regras. Devolve um estado.

- **Dia da troca não é `first_day_pt`.** A linha do dia D é capturada no dia D+1 do Pacífico (F1). Os dias que "encostam" na troca são `dayPt(window_start)` e `dayPt(window_end)`: dois dias com precisão `1d`, um com `min`, o buraco inteiro com `lacuna`.
- **Lados.** Antes: até `trocaJanelaDias` dias anteriores a `dayPt(window_start)`. Depois: até `trocaJanelaDias` dias posteriores a `dayPt(window_end)`.
- **Vizinhas.** Toda versão do mesmo vídeo, de **qualquer** campo entre título e thumbnail, que seja troca (origem diferente de `linha_de_base`), não seja `pre_registro` e, com `retoqueContaComoTroca = false`, não seja retoque. Rotações do Lab **contam** como vizinhas. Descrição não conta (não age na taxa de clique). O lado para no dia anterior à vizinha seguinte e no dia posterior à vizinha anterior; se isso encurtou o lado, `cortada = true`.
- **Fora dos dois lados:** o dia da publicação.
- **Dia medido.** Entra na soma o dia com situação `com-impressoes` ou `zero-medido`. `nao-medido` e dia ausente da lista (fora do período lido) não somam e não contam em `diasMedidos`. Dia com impressões e cliques estimados nulos não soma em nenhum dos dois e é contado em `diasSemClique`.
- **Estados, na ordem em que são decididos:**

| Estado | Quando |
|---|---|
| `nao_se_aplica` | a versão é linha de base, `pre_registro`, retoque (com a constante em `false`) ou de descrição |
| `em_teste_ab` | origem `ab_lab` com evento `rotacao` |
| `antes_fora_da_janela_lida` | todos os dias candidatos do antes são anteriores ao primeiro dia que o leitor de alcance leu |
| `sem_antes` | nenhum dia medido antes |
| `depois_nao_medido` | nenhum dia medido depois (nunca "0 impressões") |
| `ainda_nao_da` | algum lado soma menos que `trocaMinImpressoesPorLado`; devolve as duas contagens, sem taxa e sem faixa |
| `com_leitura` | os dois lados passam do limiar: taxa e faixa de Wilson de cada lado, e `leitura` = `subiu` (faixa do depois inteira acima), `caiu` (inteira abaixo) ou `sem_diferenca_firme` (as faixas se tocam) |

Nada é gravado: o relatório de alcance revisa os últimos dias. Nenhum nome de campo, estado ou texto usa "efeito", "causou" ou "por causa".

### 4.7 O contrato que a tela (parte 6) vai consumir

```ts
// proprio-versoes/tipos.ts
export type CampoVersao = 'title' | 'thumb' | 'desc'
export type OrigemVersao = 'linha_de_base' | 'ab_lab' | 'fora_do_sistema' | 'nao_se_sabe' | 'cms'   // 'cms': só leitura, reservado
export type OrigemGravavel = Exclude<OrigemVersao, 'cms'>
export type EventoAb = 'rotacao' | 'vencedor' | 'restauro'
export type PrecisaoJanela = 'first' | 'min' | '1d' | 'lacuna'
export interface VersaoPropria {
  id: string; ytId: string; campo: CampoVersao
  texto: string | null                // título ou descrição; null na thumbnail (e na descrição sem texto guardado)
  hash: string
  thumb: { dhash: string; sha256: string | null; blobUrl: string | null; imagemExata: boolean; retoque: boolean } | null
  primeiroDia: DiaYt; ultimoDia: DiaYt
  vistaDesde: string; vistaAte: string             // ISO
  janela: { de: string; ate: string } | null       // null só na linha de base
  precisao: PrecisaoJanela
  origem: OrigemVersao; eventoAb: EventoAb | null; abTestId: string | null; abVariantId: string | null
  preRegistro: boolean; corrente: boolean
}
export type EstadoRegistro =
  | { estado: 'schema_ausente' }
  | { estado: 'sem_estado' }                                   // o passo ainda não derivou o canal
  | { estado: 'registrando'; desde: DiaYt; conferidoAte: DiaYt; atrasoDias: number }
export type RegistroDoCampo = { estado: 'sem_versao' | 'so_linha_de_base' | 'com_trocas'; conferidoAte: DiaYt | null }   // (emenda 1: S-I5)
export interface VersoesDoVideo { ytId: string; registro: Record<CampoVersao, RegistroDoCampo>; versoes: VersaoPropria[] }
export interface VersoesCanal { canalId: string; estado: EstadoRegistro; videos: VersoesDoVideo[] }

// proprio-versoes/ler.ts
export async function lerVersoes(sb: SupabaseClient, p: Pedido & { ytIds: readonly string[] }): Promise<Privado<VersoesCanal>>

// proprio-versoes/antes-depois.ts
export function anteDepoisDaTroca(e: {
  troca: VersaoPropria; versoesDoVideo: readonly VersaoPropria[]; dias: readonly DiaAlcance[]
  publicadoEm: DiaYt | null; regras?: RegrasTroca
}): LeituraDaTroca
```

`registro` separa, **por campo** (emenda 1: S-I5), os três casos que a tela não pode confundir (item 196): `sem_versao` ("não registrado"), `so_linha_de_base` e `com_trocas`. É por campo porque a ausência é por campo: vídeo privado tem título e descrição e nenhuma versão de thumbnail; canal sem captura pela API tem thumbnail e nenhuma de título. O `conferidoAte` do campo é o `ultimoDia` da versão corrente dele (nulo sem versão) e dá o "thumbnail não conferida desde dd/mm"; o `conferidoAte` de `EstadoRegistro` é o do canal e dá o "trocas conferidas até dd/mm". Versões `pre_registro` não contam para o `estado` do campo. O texto e o desenho são da parte 6. (emenda 2: S-N1) Versão com `origem` `nao_se_sabe` **e** `abTestId` preenchido é a da ordem 4b da seção 4.4 (o Lab encerrou o teste na janela e não se sabe qual imagem enviou); com `abTestId` nulo, é Lab ilegível ou vídeo sem cadastro. A tela pode separar as duas sem coluna nova.

### 4.8 O que fica aberto para a parte 2 (dieta, MG17)

A função `derivarDia` recebe "as linhas do dia" como uma lista de fatos por vídeo, e é o passo que as busca. Quando a dieta vier, o passo passa a montar esses fatos também a partir da cobertura (`meta_texto`, `meta_thumb`): dia coberto sem linha vira um fato "igual ao anterior". Por isso `yt_own_versions_apply_day` **não** exige linha diária para confirmar uma versão (só para abrir), e o item 202 poderá comparar as duas derivações sem mudar a função pura.

---

## 5. As contas

### 5.1 Cota e rede
Zero unidade de cota e zero chamada ao YouTube no passo de versões. A Tarefa 5 não acrescenta chamada de API: acrescenta, só no dia em que o dHash muda, o download da cópia grande que `archiveThumb` já fazia (até duas tentativas de 10 s, dentro do teto de 30 s do passo de metadados, que não muda).

### 5.2 Idas ao banco e tempo do passo

| Situação | Idas ao banco | Tempo estimado (não medido) |
|---|---|---|
| Dia normal, por canal | estado (1) + contagem de vídeos (1) + linhas do dia (1) + correntes (1) + `apply_day` (1) = 5 | |
| Dia normal, 2 canais e 1 site | 10 + prova (1) = **11** | menos de 1 s, a 50 ms por ida |
| Dia com troca num canal | + 2 leituras do A/B Lab (testes e ciclos) + 1 de texto de descrição (só se a troca for de descrição) + 1 releitura das correntes | menos de 1,5 s |
| Dia com linha sem privacidade e com dHash, fora do primeiro dia do canal | + 1 leitura da última privacidade conhecida, por canal e execução | |
| Primeira execução, N dias acumulados por canal (emenda 1: D-I4, S-I4) | por canal: 4 fixas + 1 do menor `day_pt` (só sem estado; emenda 2: S-n4) + N `apply_day` + 2 releituras das correntes (07/10 abre as thumbnails, 08/10 abre títulos e descrições) + 1 leitura em lote do texto das descrições (08/10) = **N + 8** | com N = 13 e 2 canais: 42 + prova (1) = **43 idas, cerca de 2,2 s a 50 ms por ida** |

**(emenda 1) O que mudou nesta conta e o que ela não prova.** A versão anterior dizia "cerca de 2 s" e deixava de fora a busca do texto de 35 descrições, vídeo a vídeo (70 idas, 3,5 s): pelos números dela mesma a primeira execução passava do teto e nascia vermelha. Com a busca em lote, essas 70 idas viram 2. **(emenda 2: S-n4)** A conta da emenda 1 dava 41 e não dizia de onde vinha o primeiro dia de um canal sem estado; com a ida própria do passo 3 da seção 4.3 são **43**. Os 50 ms por ida **não são medidos**: P12 traz o tempo real, e o teste 19 da Tarefa 6 trava o **número de idas** (o que o código controla), não o tempo. Se a latência real for de 120 ms ou mais, 43 idas passam de 5 s e a primeira execução termina em `recuperando`, sem vermelho, fechando no dia seguinte (seção 4.3, passo 7).

**Teto do passo: 5 s** (`TETO_VERSOES_MS = 5_000`, constante de `versoes-step.ts`). Ele roda na fase `'antes'`, logo depois dos metadados, quando o relógio de 270 s gastou no máximo 30 s. Não entra em `TETOS_MS` (não edito `clock.ts`): no pior caso em que **todos** os passos batem no próprio teto, os 5 s saem da reserva de 30 s da parte antiga da rota, que cai para 25 s. O gasto real fica em `ms_passos.versoes` a cada execução (F7), e P12 confere a folga antes do envio.

**Quando estoura.** Sem tempo no começo: o passo não roda e devolve `sem_tempo: true`. Sem tempo no meio: para entre dois dias, ou dentro de um dia quando uma ida ao banco não volta até o prazo (emenda 1: `comPrazo`, seção 4.3); o dia nunca fica pela metade no banco, porque é uma transação, e amanhã o passo continua do dia certo. Atraso maior que 1 sem estar em recuperação (parou por `sem_tempo` ou no teto de 30 dias, com 2 dias ou mais derivados na execução; emenda 2: S-n7): cron vermelho. O orçamento acoplado do cron (270 s do relógio, 296 s da função, 300 s de `maxDuration`) não muda.

### 5.3 Volume

| O que | Conta | Por ano |
|---|---|---|
| Linhas de base | 35 vídeos × 3 campos, uma vez (105); 3 por vídeo novo | com 100 vídeos novos: 300 |
| Trocas fora do sistema | estimativa do spec, não medida: 2 por vídeo novo | cerca de 200 |
| Rotações do A/B Lab | 2 linhas por ciclo; 10 testes de 14 dias | cerca de 280 |
| Retoques | zero nos 140 pares medidos | cerca de 0 |
| **Total** | **menos de 3 linhas por dia** | **cerca de 800 linhas, menos de 1 MB** (a descrição inteira pesa 2 a 5 kB por versão) |
| `yt_own_versions_state` | 1 linha por canal | 2 linhas |
| Blob | só a Tarefa 5: uma imagem por dia em que o dHash muda | cerca de 0; pior caso 35 por dia |

As duas tabelas nunca saem do banco online (spec 9.2). O crescimento de `yt_own_video_meta_daily` (cerca de 9 MB por ano) não é desta parte.

---

## 6. O que acontece quando o dado não existe, e em cada falha

"Vermelho" = nota em `falhas`, o cron grava falha e o vigia manda o e-mail de sempre. "Resumo" = aparece em `resumo.versoes`, cron verde.

| # | Situação | O que o código faz | Veredito |
|---|---|---|---|
| 1 | **Schema ausente** (código novo sem a MG12) | primeira leitura devolve código de schema ausente; nenhum canal é derivado, nada é gravado | vermelho: `schema_ausente: yt_own_versions_state`, todo dia até a migration entrar |
| 2 | Função ausente ou recusa de `apply_day` | o dia não é gravado (transação única), o canal para, `derived_through` não anda | vermelho: `versões: <canal> não gravou o dia <dia> (<código de catálogo>)` |
| 3 | Erro de banco numa leitura (estado, linhas, correntes) | o canal não é derivado | vermelho: `erro de banco ao ler <tabela>` (texto do Postgres nunca) |
| 4 | Leitura das linhas passa do teto de 20.000 | nenhuma linha parcial é usada | vermelho: `versões: <canal> tem linhas demais para uma execução` |
| 5 | **Dia sem nenhuma linha**, canal com vídeos | dia no meio: pulado, a troca seguinte sai `lacuna`. Dia no fim: o canal para | vermelho nos dois casos: `versões: <canal> sem nenhuma linha diária em <dia>` |
| 6 | Canal sem vídeos cadastrados e sem linha | nada a derivar | resumo: `sem_videos`; verde |
| 7 | Canal com vídeos **já publicados** (o filtro do passo de metadados; emenda 1: D-m6, S-m4) e **nenhuma** linha em tabela nenhuma | sem intervalo a derivar | vermelho: `versões: <canal> tem vídeos e nenhuma linha diária`. Canal só com vídeo agendado ou sem data de publicação cai na linha 6 |
| 8 | Contagem de vídeos nula | não se afirma "sem vídeos" | vermelho: `critérios: não foi possível avaliar se <canal> tem vídeos` |
| 9 | Linha sem `privacy_status` (API 403, 429, 500, sem token: a captura falhou no passo de metadados) | título e descrição pulados; a versão corrente não avança | resumo: `pulados.sem_captura`. O vermelho é o do passo de metadados, que já existe; se durar 2 dias, a prova (linha 16) acusa |
| 10 | Linha sem dHash (a imagem não baixou) | thumbnail pulada; título segue | resumo: `pulados.sem_dhash`; idem |
| 11 | Vídeo privado | thumbnail pulada; título e descrição seguem | resumo: `pulados.privado`; verde (fora do conjunto da prova) |
| 12 | Vídeo sem linha no dia (apagado, ou a linha dele falhou) | nada para ele; os outros vídeos seguem (**dado parcial**) | verde no passo; a prova acusa se for público e passar de 2 dias sem motivo |
| 13 | A/B Lab ilegível ou leitura no limite de 1.000 | a troca é gravada com `nao_se_sabe` | vermelho: `versões: A/B Lab não pôde ser lido; origem de <n> troca(s) ficou sem resposta` |
| 14 | Troca de vídeo sem `video_id` | `nao_se_sabe` | resumo: `origem_sem_video`; verde |
| 15 | Abertura de descrição sem texto em linha nenhuma | grava com `value_text` nulo | vermelho naquele dia: `versões: <n> versão(ões) de descrição sem o texto guardado` |
| 16 | **Prova diária**: vídeo público sem título ou thumbnail conferidos nos últimos 2 dias e sem tentativa que explique **aquele campo** (emenda 1: S-m2, D-m2; a regra por campo está no desvio 11) | só leitura | vermelho: `versões: <n> vídeo(s) público(s) sem título ou thumbnail conferidos em 2 dias e sem tentativa que explique`. Em recuperação (linha 21) o número vai só ao resumo |
| 17 | Prova devolve `publicos = 0` com vídeos cadastrados e linhas capturadas | não se afirma "nenhum público" | vermelho: `versões: a prova não achou vídeo público em <site>` |
| 18 | Prova falha (função ausente, erro) | | vermelho: `critérios: não foi possível avaliar a prova das versões` |
| 18b (emenda 2: S-n2) | Prova sem resposta até o prazo | `prova: 'sem_tempo'` no resumo do site, `sem_tempo` verdadeiro | só resumo enquanto algum canal do site está em `recuperando`; fora disso vermelho, com a nota da linha 18 |
| 19 | `origem_cms > 0` | | vermelho: `versões: há versão com origem reservada (cms)` |
| 20 | Sem tempo | para entre dois dias, ou dentro de um dia quando uma ida ao banco não volta até o prazo (emenda 1: S-m7). `apply_day` sem resposta: o dia não é contado como derivado | resumo: `sem_tempo` e, se foi `apply_day`, `dia_sem_resposta`; vermelho pela regra da linha 21, ou da 21b quando nem o atraso se soube (emenda 2: S-n1) |
| 21 | Atraso de `derived_through` maior que 1 dia | | vermelho: `versões: <canal> conferido até <dia>, <n> dias de atraso`. **Exceção (emenda 1: D-I4; emenda 2: S-n7):** parou por `sem_tempo` **ou no teto de 30 dias**, com 2 dias ou mais derivados nesta execução: resumo `recuperando`, verde. Canal sem estado: o atraso conta do menor `day_pt` (emenda 2: S-n1) |
| 21b (emenda 2: S-n1) | Atraso que o passo não chegou a saber (a leitura do estado ou do menor `day_pt` não voltou, ou o tempo acabou antes do canal) | o canal entra em `atraso_desconhecido` | vermelho: `versões: <n> canal(is) sem tempo para saber o atraso`; só resumo quando outro canal da execução está em `recuperando` |
| 27 (emenda 1: D-m3) | A prova devolve `canais_com_linha_sem_estado` maior que zero | o passo não criou o estado de um canal que tem linha diária | vermelho: `versões: <n> canal(is) com linha diária e sem estado de derivação`; só resumo enquanto algum canal do site está em `recuperando` (emenda 2: S-n1; antes bastava `sem_tempo`) |
| 30 (emenda 2: S-N1) | Troca de thumbnail com encerramento do Lab na janela, num caminho em que as colunas não dizem qual imagem foi enviada (seção 4.4, ordem 4b) | gravada com `nao_se_sabe` e o `ab_test_id` do teste | resumo: `origem_ab_incerta`; verde (a linha 13, do Lab ilegível, continua vermelha: são causas diferentes) |
| 28 (emenda 1: S-I6) | Abertura que não casa com a linha diária do dia (chave trocada no JSON, linha reescrita por uma segunda execução entre a leitura e a gravação) | a função recusa com `abertura_invalida`; o dia não é gravado e o canal para | vermelho: `versões: <canal> não gravou o dia <dia> (abertura_invalida)`; amanhã o passo relê a linha e tenta o mesmo dia |
| 29 (emenda 1: S-m5) | Linha sem privacidade, com dHash, de vídeo cuja última privacidade conhecida é `private` | thumbnail pulada | resumo: `pulados.privado`; verde. Leitura da última privacidade que falha: thumbnail pulada como `sem_captura` e nota vermelha de erro de banco |
| 22 | Duas execuções ao mesmo tempo | trava por canal na função; a segunda recebe `ja_derivado` | resumo: `ja_derivado`; verde |
| 23 | Passo desligado (`versoes` em `YT_OWN_STEPS_OFF`) | não lê nem grava; `resumo.versoes = { desligado: true }` | nota em `acao_do_dono` até a 7ª execução; vermelho da 8ª (regra única do lote) |
| 24 | Nome errado na variável (`versao`) | não desliga nada | vermelho: a nota de nome desconhecido que já existe |
| 25 | Primeira execução, título de hoje diferente do de `youtube_videos` | só linha de base | verde; nenhuma troca inventada |
| 26 | Canal em `reautorizar` (credencial vencida) | as linhas vêm sem captura: caso 9 | o vermelho é o da autorização, que já existe |

**Leitor:** sem token de acesso válido devolve `{ acesso: 'negado' }` sem consultar nada; tabela ausente devolve `estado: 'schema_ausente'`; canal sem linha em `yt_own_versions_state` devolve `estado: 'sem_estado'`; vídeo pedido sem versão devolve os três campos de `registro` com `estado: 'sem_versao'` (nunca some da resposta), e campo sem versão num vídeo que tem outras devolve `sem_versao` só nele (emenda 1: S-I5); erro de banco ou teto de linhas **lança** (`ErroLeituraVersoes`, sem texto do banco). Lista vazia nunca significa "nenhuma troca".

**Interruptor.** `YT_OWN_STEPS_OFF=versoes` (variável da Vercel; lida a cada execução). Desligar não perde dado: religado, o passo deriva os dias que faltaram, em ordem, enquanto as linhas diárias existirem (até a MG17).

---

## 7. Simulação do dia do envio e dos seguintes

Valores para 35 vídeos em 2 canais, com P3 e P5 no esperado (nenhuma troca desde 07/10 e nenhum teste ativo). Se P2, P3 ou P5 vierem diferentes, o controlador troca os números no ledger antes do D0.

| Quando | O que conferir | Esperado |
|---|---|---|
| **D0** (primeiro cron das 12:00 UTC depois da promoção) | `resumo.versoes` em `yt_own_collection_runs` | `dias_derivados` = dias desde 07/10 em cada canal; `abertas.linha_de_base` = **105**; as outras origens = 0; `atraso_dias` = 0 nos dois canais; `prova.sem_explicacao` = 0; `ms_passos.versoes` abaixo de 5.000. **(emenda 1: D-I4, S-I4)** Se vier `sem_tempo` com `recuperando` preenchido e `dias_derivados` de 2 ou mais por canal, **não é falha**: o cron fica verde, o D0 é anotado como "em recuperação" e quem prova é o D+1 (atraso 0). Se vier vermelho por atraso, a recuperação não andou 2 dias: é falha real, investigar `ms_passos.versoes`. **(emenda 2: S-n7)** Envio feito mais de 30 dias depois de 07/10 (de 07/11 em diante): o D0 deriva 30 dias por canal, para no teto e sai `recuperando`, verde, sem `sem_tempo`; o atraso fecha nas execuções seguintes, e o D+1 passa a ser "atraso menor que o do D0", com atraso 0 no dia em que fechar. **(emenda 2: S-n1)** `atraso_desconhecido` não vazio no D0: um canal não foi alcançado; é só resumo se o outro está em `recuperando`, e vermelho se não está |
| D0 (emenda 1: S-I6; emenda 2: S-n6) | `select count(*) filter (where field = 'thumb' and thumb_blob_url is null) thumb_sem_url, count(*) filter (where field = 'thumb' and thumb_sha256 is null) thumb_sem_sha, count(*) filter (where video_id is null) sem_video, count(*) filter (where origin = 'ab_lab' and ab_test_id is null) ab_sem_teste, count(*) filter (where field = 'desc' and value_text is null) desc_sem_texto from yt_own_video_versions where not pre_registro;` | `thumb_sem_url` = o `sem_blob` de P2 no dia 07/10 (0 esperado); `thumb_sem_sha` = o `dhash_sem_sha` de P2 (0); `sem_video` = 0; `ab_sem_teste` = 0; `desc_sem_texto` = o `desc_sem_texto` do resumo do passo (0 esperado; o do resumo é contado pelo passo, este é lido do banco: os dois têm de bater). Número maior: uma chave do JSON de abertura chegou trocada; desligar o passo e corrigir |
| D0 | `select field, origin, window_precision, min(first_day_pt), max(first_day_pt), count(*) from yt_own_video_versions group by 1, 2, 3 order by 1;` | três linhas `linha_de_base`/`first`: `thumb` com 35 e primeiro dia 07/10; `title` e `desc` com 35 e primeiro dia 08/10 |
| D0 | `select channel_id, tracking_since, derived_through from yt_own_versions_state;` | 2 linhas; `tracking_since` = 2026-10-07; `derived_through` = ontem no Pacífico |
| D0 | `select count(*) from yt_own_video_versions where origin = 'cms';` | 0 (item 203) |
| **D+1** | `resumo.versoes` | `dias_derivados` = 2 (um por canal); `confirmadas` = 105 menos os pulados; `abertas` = 0 ou as trocas reais do dia; `ja_derivado` = 0 |
| D+1 | a consulta do item 200 (seção 11, K2) | 0 |
| **D+3** | `ms_passos.versoes` das três execuções; `falhas` sem nota de versões | abaixo de 2.000 ms nas duas últimas |
| **D+7** | Tarefa 5: `select count(*) from (select youtube_video_id, count(distinct thumbnail_blob_url) n from yt_own_video_meta_daily where day_pt >= <dia do envio da Tarefa 5> group by 1 having count(distinct thumbnail_blob_url) > 1) x;` | 0, ou os vídeos em que o dono trocou a capa. Muitos vídeos sem troca do dono: o YouTube recodifica; rever a pergunta 2 |
| D+7 (emenda 1: D-m8) | Tarefa 5: `select attempt_day, outcome, count(*) from yt_own_collection_attempts where kind = 'thumbnail' and attempt_day >= <dia do envio da Tarefa 5> group by 1, 2 order by 1;` | só `ok` (e `nao_alcancado_orcamento` igual a zero). `erro_http` ou `nao_alcancado_orcamento` em dia sem troca do dono: o arquivamento a mais está falhando ou estourando os 30 s do passo de metadados, e cada falha deixa a linha sem dHash e sem sha (risco 16); reverter a Tarefa 5 |
| **D+14** | 14 execuções seguidas com `resumo.versoes` presente, não desligado, sem nota de versões em `falhas` **e com `atraso_dias` 0 nos dois canais** (emenda 1: execução em `recuperando` não conta e zera a contagem); itens 188 e 199 conferidos | é o gatilho da MG17 (parte 2); anotar no ledger |
| **D+30** | item 195: `select origin, ab_event, thumb_similar, count(*) from yt_own_video_versions where origin <> 'linha_de_base' group by 1, 2, 3 order by 1;` | anotar. Retoque em vídeo que o dono não tocou: o YouTube recodifica sozinho e a regra do retoque é revista. **(emenda 1: S-m6)** Junto, a K7: troca de título seguida da volta ao título anterior em dias vizinhos, sem evento do Lab, é o sinal do furo do risco 14 |

As seis entradas (D0, D+1, D+3, D+7, D+14, D+30) entram em `conferenciasE18` (Tarefa 12).

---

## 8. Desvios do texto do spec, com o motivo

1. **Item 176 lido junto com o 178.** O spec diz que três dias de 3 bits "abrem uma versão, no terceiro dia", e que bytes diferentes com dHash até 6 abrem versão de retoque. As duas frases só fecham se "uma versão" for **uma troca cheia**: nos dois primeiros dias os bytes mudaram e nascem retoques. O teste do item 176 afirma exatamente uma versão com `thumb_similar = false` (no terceiro dia) e duas de retoque. Para isso a âncora da comparação de dHash é guardada na própria linha (`thumb_anchor_dhash`, coluna que o spec não tem) e só anda com troca cheia.
2. **Hash da descrição (contradição C2 dos fatos).** O spec manda reaproveitar `hashValue(normalizeDescription(...))`. A tabela diária só guarda o sha256 do texto **cru** nos dias sem mudança, e o texto só nos dias em que mudou. A versão de descrição usa o `description_sha256` da linha. Consequência: mudança só de espaço no fim conta (pergunta 4). O título usa `hashValue`, como o spec pede.
3. **A MG12 não recria `youtube_channel_removal_impact`** (contradição C3; o spec e a C0.11 mandavam "acrescentar as duas tabelas"). O corpo em disco já soma por catálogo toda tabela presa ao canal por `on delete restrict`: as duas tabelas entram sozinhas. A MG12 recusa se o corpo em vigor não for esse. **Item 201 reescrito:** com versões gravadas, `youtube_channel_remove` devolve `status: 'serie_coletada'` e **não remove** (é o comportamento desejado: recusa antes de apagar); o teste afirma esse status, e afirma `removed` sem erro de chave para um canal sem linha nenhuma.
4. **Wilson não é extraído de `ab-lab/queries.ts`** (C4): o intervalo já existe em `proprio/taxa.ts`; importo.
5. **Caminhos** (C5): o leitor mora em `observatorio/proprio-versoes/`, não em `lib/proprio/`.
6. **O passo roda na fase `'antes'`, com teto próprio de 5 s fora de `TETOS_MS`** (C9). O spec diz "depois do passo de metadados"; a fase `'antes'` é onde ele termina, e ali a linha de ontem acabou de ser gravada. Se P12 mostrar folga menor que 5 s, o mesmo bloco vai para o fim da fase `'depois'` (logo antes de `criterioDesligados`), onde só gasta o que sobra; a derivação é a mesma, porque lê linhas já gravadas. **(emenda 1: S-m8) Mover tem um custo que a versão anterior não dizia:** sem tempo, o auxiliar `passo` de `index.ts` devolve um resumo genérico e **não chama** `passoVersoes` (`coleta/index.ts:139-144`), então a nota de atraso nunca sairia e o passo poderia ficar dias sem rodar em verde. Por isso a mudança de posição só é permitida junto com uma **tarefa 7b**, que este plano não detalha e que tem de passar pelos dois especialistas: um critério fora do passo, com prazo próprio (no molde de `criteria-retencao.ts`, que usa `prazoDoCriterio`), que lê `yt_own_versions_state` e emite a nota de atraso maior que 1. Sem a 7b, o passo fica na fase `'antes'`.
7. **`yt_own_versions_apply_day` mais rígida que a do spec:** `search_path = ''` com nomes qualificados (OP-2); confere que o canal é do site; recusa dia que ainda não fechou no Pacífico; recusa quando alguma confirmação não casou (`touch_recusado`); exige linha diária do vídeo, do canal e do site para abrir versão; recusa linha de base onde já há versão corrente e troca onde não há. Devolve também `derived_through`.
8. **A semente do A/B Lab grava só títulos de ciclo**, por função própria (`yt_own_versions_seed_pre`), e não o título original: o original não tem instante de início conhecido, e a coluna `first_seen_at` é obrigatória. A parte 6 pode ler `ab_tests.original_title` direto se o desenho pedir. Thumbnails não entram: não há dHash da imagem de cada ciclo.
9. **`database.types.ts` não é regenerado** (o item 201 pede). Regenerar traria o diff de todas as migrations recentes, que o arquivo local ainda não tem; é a convenção dos planos do lote (E11). O leitor e o passo usam tipos de linha escritos à mão em `tipos.ts`. A regeneração fica para uma tarefa única do controlador ao fim do lote C.
10. **A semente e2e não é tocada por este plano** (emenda 1: S-m3; a versão anterior acrescentava as duas tabelas à limpeza). O motivo dado, "apagar o canal de teste esbarra na chave `restrict`", não vale hoje: nada semeia as duas tabelas no e2e, então elas ficam vazias e não seguram a remoção. E o custo era real: `check` lança em qualquer erro (`e2e/fixtures/observatorio-seed.ts:224-227`), e no banco do navegador (54321), sem a MG12, a semente inteira passaria a falhar com tabela inexistente, quebrando o trabalho de outro terminal. Semear **e** limpar ficam juntas no plano da parte 6, que é quem tem tela para elas e quem passa a exigir a MG12 no banco do navegador.
11. **A prova do item 200 muda em três pontos:** "vídeo público" é o último `privacy_status` conhecido (C0.11); a tentativa que explica tem de ter `outcome <> 'ok'` (com `ok` toda tentativa do dia "explicaria" a ausência); e o corte de data das versões é `p_ontem - 1`, não `current_date - 2` (o mesmo dia, sem depender do relógio da sessão). **(emenda 1: D-m1, D-m2, S-m2) Mais dois:** (a) o corte das **tentativas** é `attempt_day >= p_ontem`, não `p_ontem - 1`: `attempt_day` é o dia UTC da execução (L1a, `yt_own_attempt_record`), e as duas execuções que poderiam ter conferido os dias `p_ontem - 1` e `p_ontem` rodaram nos dias UTC `p_ontem` e `p_ontem + 1`; com `- 1` uma falha de três execuções atrás explicava por mais um dia; (b) o motivo é **por campo**. Título sem conferência é explicado por tentativa `meta` do vídeo com resultado diferente de `ok` **ou** por tentativa `meta` do **canal** do vídeo com resultado diferente de `ok` (é onde fica a falha da `videos.list`, `meta-step.ts:218-253`; a tentativa por vídeo sai `ok` sempre que a linha é gravada, mesmo sem captura, `meta-step.ts:457-460`). Thumbnail sem conferência é explicada por tentativa `thumbnail` do vídeo com resultado diferente de `ok`, ou por tentativa `meta` do vídeo com resultado diferente de `ok` (linha que não foi gravada não tem imagem). Falha de thumbnail não explica título.
12. **Origem de troca sem `video_id`** (C6): `nao_se_sabe` sem vermelho; o spec não previa o caso.
13. **Precisão `min`:** `window_start` e `window_end` passam a ser o instante do evento (o spec só fixa `first_seen_at`). Assim "os dias que encostam na janela" vale para as quatro precisões com uma regra só.
14. **`RULES.proprio` mora em `proprio-versoes/regras.ts` e é referenciado em `rules.ts`** por uma linha (`proprio: PROPRIO_RULES`), no padrão de `comments: COMMENT_RULES`. O item 193 continua valendo: o número existe num lugar só.
15. **(emenda 1: D-I3, S-I2) Restauro de thumbnail sem conferência de conteúdo.** O spec (7.5.3 e item 182) só fala do restauro do título. Mas pausar um teste, encerrá-lo sem vencedor e a pausa automática do vigia reenviam a imagem original ao YouTube e gravam `paused_at` ou `completed_at` (`ab-lab/actions.ts:727-741`, `:946-970`; `ab-watchdog/route.ts:125-161`). Sem regra, essa troca saía `fora_do_sistema` e a tela diria "trocada fora do A/B Lab" para uma troca que o Lab fez. A regra nova: troca de thumbnail com pausa de um teste do vídeo dentro da janela, ou com encerramento que devolve a original dentro da janela, é `ab_lab`, `restauro`. **(emenda 2: D-N1, S-N1) A frase que estava aqui, "encerramento com vencedor grava `completed_at` e `winner_applied_at` juntos", estava errada:** ela vale para aplicar o vencedor (`applyWinnerNow`, `actions.ts:1396-1404`) e para a aplicação automática, e **não** para encerrar escolhendo o vencedor (`endAbTest(testId, winnerId)`, `actions.ts:936-973`), que envia a imagem da variante escolhida e deixa `winner_applied_at` nulo. Também não é verdade que todo encerramento com `winner_applied_at` nulo devolve a original: o encerramento automático com `AB_AUTO_APPLY_WINNER` desligado não envia nada (`ab-evaluate-phases.ts:236-257`). Por isso a regra passou a ser **por motivo de encerramento** (`completed_reason`), com lista fechada: a tabela dos caminhos está na seção 4.4. As linhas `:946-970`, que a emenda 1 citava como prova do restauro, são as do próprio `endAbTest`, e com `winnerId` aplicam a vencedora. **Os dois pareceres pediram condições mais estreitas e diferentes** (dados: o teste ter algum ciclo com `thumbnail_set`; software: `test_type` igual a `thumbnail` ou `combo`). Fico com a parada sozinha, por dois motivos conferidos no código: a pausa reenvia a imagem **sem olhar o tipo do teste** (`actions.ts:727-730`), então até um teste só de título pode produzir um retoque de thumbnail feito pelo Lab; e a condição por ciclo pediria ler todos os ciclos do teste, fora da janela, numa leitura sem teto conhecido. O que **não** se afirma: que a imagem vista é a original (não há dHash do original para comparar). Fica no risco 3: troca feita à mão no Studio na mesma janela de uma parada é atribuída ao Lab.
16. **(emenda 1: D-I3) O vencedor só explica o campo que o teste mexe** (`test_type`), em vez de qualquer campo com `winner_applied_at` na janela: um teste só de título não explica uma troca de thumbnail do mesmo dia.
17. **(emenda 1: S-I6) `yt_own_versions_apply_day` confere a abertura contra a linha diária do dia.** A função lê `p_open` por nome de chave, e chave ausente vira nulo em silêncio. Ela passa a recusar com `abertura_invalida` quando o `video_id` da abertura difere do da linha, quando, na thumbnail, dHash, sha ou URL diferem dos da linha, e quando a origem é `ab_lab` sem teste (ou rotação sem variante).

---

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`, salvo quando começam por `supabase/`, `docs/` ou `.superpowers/`.

| T | O que | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 0 | Conferências P1 a P15 (controlador; emenda 1) | `.superpowers/sdd/a5-e18/progress.md` | nada | todas |
| 1 | Migration MG12 e a prova no banco | `supabase/migrations/<carimbo>_observatorio_a5_e18_versoes_do_video_proprio.sql`; `.superpowers/sdd/a5-e18/sql/mg12.sql`, `prova.sql`; `test/integration/a5-e18-schema.test.ts`, `a5-e18-rls.test.ts` | vez do lote C | 2 a 9 |
| 2 | Regras e tipos | `src/lib/youtube/observatorio/proprio-versoes/regras.ts`, `tipos.ts`; **`src/lib/youtube/observatorio/rules.ts`** (uma linha e um import); `test/youtube/observatorio/versoes-proprio-regras.test.ts` | nada | 3, 4, 5 |
| 3 | Derivação pura | `src/lib/youtube/coleta/versoes-derivar.ts`; `test/youtube/coleta/versoes-derivar.test.ts` | 2 (tipos) | 4, 5, 8 |
| 4 | Origem pura | `src/lib/youtube/coleta/versoes-origem.ts`; `test/youtube/coleta/versoes-origem.test.ts` | 2 | 3, 5, 8 |
| 5 | Condição de guarda da imagem | **`src/lib/youtube/coleta/meta-step.ts`**; **`test/youtube/coleta/meta-step.test.ts`** | nada | 2, 3, 4, 8 |
| 6 | Passo de versões | `src/lib/youtube/coleta/versoes-step.ts`; `test/youtube/coleta/versoes-step.test.ts`; **`test/youtube/coleta/fake-supabase.ts`** (um bloco) | 3, 4 | 8 |
| 7 | Integração no cron | **`src/lib/youtube/coleta/index.ts`**; **`test/youtube/coleta/index.test.ts`** | 6; a vez do arquivo; **MG12 em produção com V1 a V5 conferidas** (emenda 1: S-I3) | 9, 10, 11 |
| 8 | Antes e depois | `src/lib/youtube/observatorio/proprio-versoes/antes-depois.ts`; `test/youtube/observatorio/versoes-proprio-antes-depois.test.ts` | 2 | 3 a 7 |
| 9 | Leitor | `src/lib/youtube/observatorio/proprio-versoes/ler.ts`; `test/youtube/observatorio/versoes-proprio-ler.test.ts` | 2; **A4 em `staging`** | 7, 8 |
| 10 | Testes de ponta contra o banco | `test/integration/observatorio-a5-e18-passo.test.ts` (emenda 1: S-m3, a semente e2e saiu da lista) | 1, 6; o caso 10 e o 9 pedem a Tarefa 9 | 11 |
| 11 | Semente do A/B Lab | `src/lib/youtube/coleta/versoes-semente-ab.ts`; `scripts/semear-versoes-ab-lab.ts`; `test/youtube/coleta/versoes-semente-ab.test.ts` | 1, 2 | 10 |
| 12 | Runbook, conferências com data e envio | **`src/lib/conferencias.ts`**; **`test/lib/conferencias.test.ts`**; **`docs/ops/youtube-coleta-canais-proprios-runbook.md`** (seção nova); **`.superpowers/sdd/a5/conferencias-com-data.md`** | todas | nenhuma |

**Ondas (emenda 1: S-I3, a Tarefa 7 trocou de onda).** Onda 1 (já): 2, depois 3, 4, 5 e 8 em paralelo. Onda 2: 6. Onda 3 (lote C aplicado no banco local): 1, depois 10 (os casos que não pedem o leitor) e 11. Onda 4 (A4 em `staging`): 9 e os casos 9 e 10 da Tarefa 10. Onda 5 (**MG12 em produção, V1 a V5 conferidas**): 7, serial com quem mais mexe em `index.ts`. Onda 6: 12. As Tarefas 6, 9, 10 e 11 podem ser commitadas antes da MG12 em produção: nada em produção chama `versoes-step.ts`, o leitor nem o comando da semente enquanto a Tarefa 7 e a tela não existirem.

**Arquivos compartilhados com OUTRAS etapas (em negrito na tabela). Uma só tarefa deste plano toca cada um.**

| Arquivo | Quem mais mexe | Regra |
|---|---|---|
| `observatorio/rules.ts` | toda etapa com limiar | só a Tarefa 2; acrescenta `proprio: PROPRIO_RULES` no fim do objeto e o import; nada mais |
| `coleta/meta-step.ts` e o teste dele | L1b e L2 (histórico), a parte 2 desta etapa (MG17) | só a Tarefa 5; uma condição; antes, `git status` do arquivo limpo |
| `test/youtube/coleta/fake-supabase.ts` | toda etapa com função de banco | só a Tarefa 6; um bloco `rpcHandlers` por função, no fim do arquivo |
| `coleta/index.ts` e `index.test.ts` | E11 (Tarefa 10 dela), E6 P2, E8 | só a Tarefa 7; integração serial, depois de quem estiver na frente; um bloco na fase `'antes'` e uma linha na `'depois'` |
| `e2e/fixtures/observatorio-seed.ts` | A4 (com alteração sem commit em 13/10), E6, E8, E11 | **este plano não toca** (emenda 1: S-m3; desvio 10) |
| `lib/conferencias.ts`, `test/lib/conferencias.test.ts`, `.superpowers/sdd/a5/conferencias-com-data.md` | todas | só a Tarefa 12; bloco próprio |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md` | E6, E8, E11, E20 | só a Tarefa 12; seção nova "Versões do vídeo próprio", sem editar as outras |
| `coleta/passos-desligados.ts`, `criteria-desligados.ts`, `clock.ts`, `kinds.ts`, `schema.ts`, `paginar.ts`, `day-pt.ts` | plano das ordens 8 e 10 (dono) | **importar, não editar.** Se faltar algo neles, parar e avisar |
| `observatorio/proprio/**` | A4 (dona) | **importar, não editar** |
| `competitor-versions.ts`, `thumb-fingerprint.ts` | concorrentes | **importar, não editar** |

**Restrições globais** (as de `.superpowers/sdd/a5-e11/regras-implementador.md`, mais estas): lista de arquivos fechada (precisou de outro: para e avisa); TDD com o vermelho guardado no relatório da tarefa; nada parado mais de 4 minutos (suíte e `tsc` com saída em arquivo); `tsc --noEmit -p apps/web` no fim de cada tarefa; sem `any` nem `as unknown as` novo; fixtures de data relativas ou com relógio falso, nunca ano fixo; testes de servidor com `// @vitest-environment node`; commit por lista de arquivos (`git add <arquivos>` e `git commit -m … -- <os mesmos>`), nunca `git add -A`, `stash`, `reset` nem `--no-verify`; nunca commitar `apps/web/next-env.d.ts` nem `apps/web/tsconfig.json`; sem navegador, sem `next dev`, sem o banco local das portas 54321 e 54322; relatório em `.superpowers/sdd/a5-e18/task-<N>-report.md`, resposta em até 10 linhas.

**Foco de revisão.** (a) A regra da âncora e do retoque (desvio 1) contra os itens 176 a 178. (b) A recusa de `apply_day` quando o canal não é do site e quando o vídeo não tem linha do canal (provas por mutação da Tarefa 1). (c) O dia da troca no antes e depois (F1): é o erro mais fácil de cometer. (d) Tudo o que na seção 6 está "verde": cada um tem de ter um número no resumo. (e) A mudança da Tarefa 5 e a garantia de não sobrescrever imagem.

---

## 10. As tarefas

### Tarefa 0: conferências de leitura (controlador)

Rodar P1 a P15 (seção 3.2; emenda 1), só leitura, e anotar resultado e data em `.superpowers/sdd/a5-e18/progress.md`. **Pronto quando** as quinze têm resposta e, onde a resposta difere do esperado, o ledger diz qual número deste plano mudou.

### Tarefa 1: migration MG12 e a prova no banco (só na vez do lote C)

**Objetivo.** Criar o arquivo da migration com o texto do Apêndice A, provado duas vezes no `bythiago_int` contra os arquivos reais da MG14, MG11, MG5 e MG7.

**Passos.**
1. Copiar o Apêndice A para `.superpowers/sdd/a5-e18/sql/mg12.sql` e escrever `.superpowers/sdd/a5-e18/sql/prova.sql`: aplica a MG12 duas vezes e roda os cenários S1 a S18 abaixo (emenda 1: S-m11; o texto dizia S14 e a tabela já ia até S16), cada um dentro de `begin; … rollback;`.
2. Escrever os dois testes de integração **antes** de criar o arquivo da migration; com o banco sem a MG12 eles falham por tabela ausente (guardar a saída).
3. Só então `npm run db:new observatorio_a5_e18_versoes_do_video_proprio` (depois dos quatro arquivos do lote), colar o SQL, aplicar no `bythiago_int` e rodar testes e roteiro. Nunca `db:reset`.
4. Anotar no ledger os resultados de V1 a V5 no banco local.

**Cenários do roteiro e dos testes (nomes dos casos).**

| # | Caso | Esperado |
|---|---|---|
| S1 | aplicar duas vezes | sem erro; V1 = 2, 2, 6, 3, 0, 0 nas duas |
| S2 | aplicar sem o corpo por catálogo da função de impacto (função trocada por uma de lista, dentro da transação) | exceção "MG12 depende do corpo por catálogo"; nada criado |
| S3 | policy com e sem `can_view_private_site` (MG11 antes e depois) | a função certa em cada caso |
| S4 | `apply_day` primeiro dia com 3 linhas de base | `ok`, `abertas` 3; estado com `tracking_since = derived_through = dia` |
| S5 | item 186: mesmo dia de novo, e dia anterior | `ja_derivado`; contagem e `md5` das linhas iguais antes e depois |
| S6 | item 185: `p_open` com a segunda de três linhas inválida (`field = 'x'`) | exceção; zero versão nova; `derived_through` igual |
| S7 | item 187: dois dias em ordem numa execução × duas execuções | mesmas linhas |
| S8 | troca: fecha a corrente e abre a nova | uma corrente por vídeo e campo; a antiga com `is_current = false` |
| S9 | **mutação de site:** `p_site_id` de outro site | exceção `canal_fora_do_site`; nada gravado |
| S10 | **mutação de canal:** abertura para vídeo cuja linha diária é de outro canal | exceção `sem_linha_do_dia` |
| S11 | confirmação com id de outra versão, de outro canal, ou não corrente | exceção `touch_recusado`; `derived_through` igual |
| S12 | linha de base onde já há corrente; troca onde não há | exceção `linha_de_base_incoerente` |
| S13 | dia de hoje no Pacífico | exceção `dia_nao_fechado` |
| S14 | item 201: canal com versões: `youtube_channel_removal_impact` soma as linhas das duas tabelas e `youtube_channel_remove` devolve `serie_coletada` sem apagar; canal sem linha nenhuma: `removed`, sem erro de chave | como descrito |
| S15 | `seed_pre`: sem estado; instante posterior ao início do registro; **início anterior e fim posterior ao início do registro** (emenda 1: D-m9); vídeo de outro canal; mesma linha duas vezes | `sem_estado`; `fora_do_pre_registro`; `fora_do_pre_registro`; `video_fora_do_canal`; segunda vez `inseridas` 0 |
| S16 | `prova`: público sem versão e sem tentativa; com tentativa `erro_http`; com tentativa `ok`; privado; vídeo de outro site | conta em `sem_explicacao`; não conta; **conta**; fora; fora |
| S16b (emenda 1: S-m2, D-m1, D-m2) | `prova`, motivo por campo e por data: sem título, com tentativa `thumbnail` `erro_http` do vídeo; sem título, com tentativa `meta` `erro_http` do **canal** do vídeo; sem thumbnail, com tentativa `thumbnail` `erro_http`; sem título, com tentativa `meta` `erro_http` do vídeo em `p_ontem - 1`; a mesma em `p_ontem`. **Fronteira nomeada: `p_ontem - 1` e `p_ontem`** | **conta**; não conta; não conta; **conta**; não conta |
| S17 (emenda 1: S-I6) | abertura que não casa com a linha diária: thumbnail com `thumb_blob_url` ausente do JSON enquanto a linha tem URL; `thumb_sha256` diferente do da linha; `video_id` ausente enquanto a linha tem; origem `ab_lab` sem `ab_test_id`; rotação sem `ab_variant_id` | exceção `abertura_invalida` nas cinco; zero versão nova; `derived_through` igual |
| S18 (emenda 1: D-m5, S-m11) | apagar o site da semente: `begin; delete from public.sites where id = <site>; rollback;`, com e sem versões gravadas | anotar o que o banco faz. O esperado pelo SQL versionado é **recusa** nos dois casos, pela chave de `youtube_channels.site_id`, que não tem `on delete cascade` (`20260507000001_schema.sql:3018`): a MG12 não muda o que já acontece hoje. Resultado diferente: corrigir a frase de "Retenção e apagamento" (seção 13) no mesmo commit |

**Testes de RLS (`a5-e18-rls.test.ts`), itens 190 e 191.** Como papel **não superusuário**: usuário sem edição e sem o direito privado lê zero linha das duas tabelas, **inclusive depois de `set_config('app.site_id', <site>, true)`** (o GUC forjado); usuário com edição lê só as do próprio site (mutação: linha de outro site semeada, e ele não a vê). `anon` e `authenticated` não executam nenhuma das três funções: afirmado por `has_function_privilege`, **nunca chamando a função** (F16). Nenhuma policy de `insert`, `update` ou `delete`. Para o item 191, o teste percorre a lista das doze tabelas do spec e afirma `can_view_private_site` em cada uma **que existir**, registrando as ausentes; fica `skip` com motivo escrito enquanto a MG11 não estiver aplicada no banco local, e o fecho do lote C o roda.

**Armadilhas.** `jsonb_to_recordset` devolve nulo para chave ausente: a linha inválida do S6 tem de falhar por restrição, não passar em branco; e as chaves sem restrição que as obrigue (`thumb_blob_url`, `thumb_sha256`, `video_id`, `ab_test_id`, `ab_variant_id`) são conferidas pela própria função contra a linha diária (S17; emenda 1: S-I6). `on conflict … where pre_registro` exige o predicado do índice parcial escrito igual. A trava é `pg_advisory_xact_lock`, solta no fim da transação.

**Pronto quando** os dois testes passam, o roteiro roda duas vezes sem diferença, V1 a V5 batem no banco local e o texto do arquivo é igual ao do apêndice (ou o apêndice foi corrigido no mesmo commit).

### Tarefa 2: regras e tipos

**Contrato.** `regras.ts`: `export const PROPRIO_RULES = { trocaMinImpressoesPorLado: 100, trocaJanelaDias: 7, retoqueContaComoTroca: false }` (objeto mutável, sem `as const`, para o teste do item 193 trocar o valor) e `export type RegrasTroca = typeof PROPRIO_RULES`. `tipos.ts`: os tipos da seção 4.7 e as linhas de banco escritas à mão (`LinhaVersaoDb`, `LinhaEstadoDb`). `rules.ts`: `proprio: PROPRIO_RULES`.

**Testes primeiro.** `RULES.proprio === PROPRIO_RULES` (a mesma referência: o número mora num lugar só); os três valores padrão; `OrigemGravavel` não aceita `'cms'` (linha com `// @ts-expect-error`).

**Pronto quando** os testes passam e nenhum outro arquivo foi tocado.

### Tarefa 3: derivação pura (itens 173 a 180 e 199)

**Contrato.**
```ts
export interface FatoDoDia {
  ytId: string; dia: DiaYt; videoId: string | null; capturadoEm: string
  privacidade: 'public' | 'unlisted' | 'private' | null
  privacidadeConhecida: 'public' | 'unlisted' | 'private' | null   // (emenda 1: S-m5) a última conhecida em dia ANTERIOR; null = nenhuma
  titulo: string | null; descHash: string | null
  dhash: string | null; sha256: string | null; blobUrl: string | null
}
export interface CorrenteDoCampo { id: string; ytId: string; campo: CampoVersao; hash: string; ancoraDhash: string | null; sha256: string | null; ultimoDia: DiaYt; vistaAte: string }
export interface AberturaSemOrigem { ytId: string; videoId: string | null; campo: CampoVersao; tituloOuNulo: string | null; hash: string
  thumb: { dhash: string; ancoraDhash: string; sha256: string | null; blobUrl: string | null; retoque: boolean } | null
  capturadoEm: string; janela: { de: string; ate: string } | null; precisao: 'first' | '1d' | 'lacuna' }
export type MotivoPulo = 'sem_captura' | 'sem_dhash' | 'privado'
export interface PlanoDoDia { confirmar: Array<{ id: string; vistaEm: string }>; abrir: AberturaSemOrigem[]; pulados: Record<MotivoPulo, number> }
export function derivarDia(correntes: readonly CorrenteDoCampo[], fatos: readonly FatoDoDia[]): PlanoDoDia
// (emenda 1: D-I1) Depois de um dia gravado SEM abertura: as correntes confirmadas avançam em memória.
export function aplicarPlanoNasCorrentes(correntes: readonly CorrenteDoCampo[], plano: PlanoDoDia, dia: DiaYt): CorrenteDoCampo[]
```
`aplicarPlanoNasCorrentes` lança se o plano tiver abertura (aí o passo relê do banco: os ids nascem lá) e devolve cada corrente confirmada com `ultimoDia = dia` e `vistaAte = vistaEm`; as não confirmadas voltam iguais.

**Testes primeiro (um caso por nome).**
1. Item 173: primeiro dia abre uma linha de base por campo, precisão `first`, janela nula, nenhuma troca.
2. Item 174: título igual confirma com `vistaEm` = captura; título diferente abre com `janela.de` = `vistaAte` da corrente e `janela.ate` = captura.
3. Item 175: `privacidade` nula com título e hash de descrição diferentes: nada abre, nada confirma, `pulados.sem_captura` conta; **e a thumbnail da mesma linha é tratada** (com dHash).
4. Item 176 (com o desvio 1): três dias de 3 bits, bytes diferentes a cada dia: dias 1 e 2 abrem retoque com a âncora original; dia 3 abre troca cheia com âncora nova. Variante com os bytes iguais nos dias 1 e 2 (sha igual): só confirma, e no dia 3 a troca.
5. Item 177: sem dHash, a thumbnail é pulada e não confirma; vídeo privado, idem com `pulados.privado`; o título das duas linhas segue.
6. Item 178: bytes diferentes e distância 6: retoque. Distância 7: troca cheia. **Fronteira nomeada: 6 e 7.**
7. Sha nulo de um dos lados com distância até 6: confirma (não inventa retoque).
8. Item 179: `dia` menos `ultimoDia` igual a 1 dá `1d`; igual a 2 dá `lacuna`. **Fronteira: 1 e 2.**
9. Item 180: título e thumbnail trocados no mesmo dia: duas aberturas com a mesma janela.
10. Título nulo com captura: pulado como `sem_captura`, nunca versão de texto vazio.
11. Vídeo com corrente e sem fato no dia: nada para ele (lista vazia de fatos devolve plano vazio, sem lançar).
12. Dois fatos do mesmo vídeo no mesmo dia: lança erro de programação (a chave primária da origem não permite).
13. Item 199, com gerador de semente fixa (200 sequências de até 30 dias, com buracos e dias sem captura): o número de aberturas de título com precisão diferente de `first` é igual ao número de mudanças de valor entre fatos válidos seguidos; a sequência A, B, A dá três versões, duas trocas. O mesmo para a thumbnail com o sha como valor quando a distância fica até 6.
14. A função não devolve origem em campo nenhum (o tipo não tem).
15. (emenda 1: D-I1) **Dia 1 confirma, dia 2 troca**, para título e para thumbnail: `derivarDia` do dia 2 sobre `aplicarPlanoNasCorrentes(correntes, planoDoDia1, dia1)` devolve `janela.de` = captura do dia 1, precisão `1d` e, na thumbnail, a âncora e o sha da corrente; sobre as correntes **sem** aplicar o plano (o defeito) devolveria `lacuna` com `janela.de` na captura do dia 0. O teste afirma os dois resultados, para o defeito ficar nomeado. `aplicarPlanoNasCorrentes` com abertura no plano: lança.
16. (emenda 1: S-m5) `privacidade` nula, dHash presente e `privacidadeConhecida` `'private'`: thumbnail pulada em `pulados.privado`, não confirma nem abre. Com `privacidadeConhecida` nula ou `'public'`: a thumbnail é tratada (o caso das linhas de 07/10).
17. (emenda 1: S-m9) A mensagem do erro lançado no caso 12 traz só o id de 11 caracteres do vídeo e o dia, nunca o título (varredura da mensagem contra os títulos dos fatos).

**Pronto quando** os 17 passam, sem import de banco nem de `server-only`.

### Tarefa 4: origem pura (itens 181 a 184)

**Contrato.**
```ts
export interface TesteAb { id: string; videoId: string; tipo: 'thumbnail' | 'title' | 'description' | 'combo'; pausadoEm: string | null; concluidoEm: string | null; vencedorAplicadoEm: string | null; tituloOriginal: string | null
  motivoConclusao: string | null; varianteVencedora: string | null }   // `tipo` = ab_tests.test_type (emenda 1: D-I3); `motivoConclusao` = completed_reason, comparado só com a lista fechada da seção 4.4, e `varianteVencedora` = winner_variant_id (emenda 2: D-N1, S-N1)
export interface CicloAb { testId: string; variantId: string; iniciadoEm: string; tituloAplicado: string | null; thumbAplicada: boolean }
export type LeituraAb = { ok: true; testes: readonly TesteAb[]; ciclos: readonly CicloAb[] } | { ok: false }
export interface OrigemAtribuida { origem: OrigemGravavel; eventoAb: EventoAb | null; abTestId: string | null; abVariantId: string | null; instante: string | null
  incerta?: true }   // (emenda 2: S-N1) só na ordem 4b: `nao_se_sabe` porque o Lab enviou imagem e as colunas não dizem qual
export function atribuirOrigem(a: AberturaSemOrigem, ab: LeituraAb): OrigemAtribuida
```

**Testes primeiro.** (1) item 181: ciclo na janela com `tituloAplicado` igual: `rotacao`, com teste e variante, `instante` = início do ciclo. (2) item 182: vencedor; restauro com título igual ao original. (3) item 183: nenhum evento; e evento com título diferente: `fora_do_sistema`. (4) item 184: `{ ok: false }` dá `nao_se_sabe`. (5) `videoId` nulo dá `nao_se_sabe`. (6) evento **na ponta** da janela (igual a `de` e igual a `ate`) conta; um milissegundo fora não conta. (7) dois ciclos na janela com o título novo: vale o mais recente. (8) thumbnail: ciclo com `thumbAplicada` falso não explica. (9) **mutação de vídeo:** teste de outro vídeo com evento na janela não explica. (10) linha de base passada por engano: lança. (11) prioridade: vencedor e ciclo na mesma janela: `vencedor`. (12) nenhum retorno com origem `'cms'`. **(emenda 1: D-I3, S-I2)** (13) pausa de teste `combo` com as duas trocas na mesma janela: título igual ao original e thumbnail saem as duas `restauro`, com o instante da parada. (14) pausa **e** rotação com `thumbAplicada` verdadeiro na mesma janela, campo thumbnail: `restauro` ganha (a ordem 4 vem antes da 5). (15) thumbnail trocada, teste encerrado sem vencedor (`concluidoEm` na janela, `vencedorAplicadoEm` nulo, **`motivoConclusao` `manual_archive`**; emenda 2, ver abaixo): `restauro`; parada um milissegundo fora da janela: `fora_do_sistema`. (16) vencedor por campo: teste de `tipo` `title` com vencedor na janela explica a troca de título e **não** explica a de thumbnail do mesmo dia (`fora_do_sistema`); `combo` explica as duas; `description` explica a de descrição. (17) retoque de thumbnail (`thumb.retoque` verdadeiro) com pausa de teste de `tipo` `title` na janela: `restauro` (a pausa reenvia a imagem sem olhar o tipo; desvio 15).

**(emenda 2: D-N1, S-N1, S-n5) O caso 15 muda e entram os casos 18 a 24.** No caso 15, "encerrado sem vencedor" passa a ser `motivoConclusao` `manual_archive` (com `vencedorAplicadoEm` nulo); o mesmo teste com `motivoConclusao` nulo, ou com um valor fora da lista (`max_duration`), **não** dá `restauro`: `fora_do_sistema`. (18) thumbnail trocada, teste `combo` com `concluidoEm` na janela, `motivoConclusao` `manual_winner`, `vencedorAplicadoEm` nulo: `vencedor`, instante = `concluidoEm`, `abVariantId` = `varianteVencedora`; nunca `restauro`. (19) `auto_resolve` com `vencedorAplicadoEm` nulo **e** ciclo com `thumbAplicada` na mesma janela: `rotacao`, com teste e variante do ciclo. (20) `auto_resolve` com `vencedorAplicadoEm` nulo, sem ciclo na janela: `fora_do_sistema`. (21) `manual_no_apply` e `inconclusive`, um caso cada, **sem** ciclo de thumbnail na janela: `restauro`; os mesmos **com** ciclo de `thumbAplicada` na janela: `nao_se_sabe`, `eventoAb` nulo, `abTestId` do teste, e o retorno marca a incerteza (campo `incerta: true` em `OrigemAtribuida`, que o passo soma em `origem_ab_incerta`). **Fronteira nomeada:** o ciclo um milissegundo fora da janela volta a dar `restauro`. (22) `manual_winner` em teste de `tipo` `title`, thumbnail trocada (inclusive retoque): `nao_se_sabe` com `incerta`; a troca de **título** do mesmo teste segue a regra do título (ordem 4 se o título novo é o original, senão ordens 5 e 6: esse caminho não envia título, `actions.ts:936-962`). (23) `manual_winner` de teste `combo` **e** ciclo de thumbnail na mesma janela: `vencedor` ganha (a ordem 3b vem antes da 5). (24) S-n5: nos casos 2, 13, 15, 18 e 21 (todo `vencedor` e todo `restauro`) o teste afirma `abTestId` **não nulo** e igual ao teste cujo instante caiu na janela; no restauro, `abVariantId` nulo.

**Pronto quando** os 24 passam.

### Tarefa 5: condição de guarda da imagem no passo de metadados

**Objetivo.** Em `capturarThumb`, trocar `hamming(ant.thumbnail_dhash, probe.dhash) > DHASH_MAX_SAME` por "o dHash é diferente do da linha anterior". Nada mais muda: nem o `select` de `anteriores`, nem o que a linha grava.

**Testes primeiro (em `meta-step.test.ts`, que falham antes da mudança).** (1) dHash a 3 bits do da véspera: `archiveThumb` é chamado e a linha leva a URL nova. (2) dHash igual ao da véspera: não é chamado, a URL repete (o comportamento de hoje, travado). (3) dHash a 7 bits: chamado (como hoje). (4) arquivamento que falha com dHash a 3 bits: a linha sai sem os campos de thumbnail e com a nota de sempre (o caminho de falha não mudou). (5) nenhum teste existente do arquivo muda de resultado, salvo os que afirmavam "até 6 bits não arquiva": esses são reescritos no mesmo commit, com o motivo.

**(emenda 1: D-m8) O que piora, e fica dito.** Hoje uma diferença de 1 a 6 bits não arquiva nada e a linha sai com dHash e sha. Depois da mudança ela arquiva, e arquivamento que falha devolve `falha` (`meta-step.ts:162`): **a linha desse dia sai sem dHash e sem sha**, e a thumbnail é pulada na derivação (`pulados.sem_dhash`). No pior caso (o YouTube recodificar tudo num dia) são 35 arquivamentos, 4 em paralelo, de até duas buscas de 10 s cada, dentro dos 30 s do passo de metadados. A conferência nova do D+7 (seção 7) mede; o caso 4 abaixo trava o comportamento.

**Armadilha.** Não tocar no nome do arquivo no Blob nem em `thumb-fingerprint.ts`. Esta tarefa é independente da migration e **pode ir no primeiro envio disponível**: quanto antes, menos imagem de retoque se perde.

**Pronto quando** os testes passam e o diff de `meta-step.ts` é de uma linha de código (mais o comentário).

### Tarefa 6: o passo de versões (itens 184, 187 a 189, 203)

**Contrato.**
```ts
export const TETO_VERSOES_MS = 5_000
export const MAX_DIAS_POR_EXECUCAO = 30
export interface VersoesResumo { dia_ate: string; canais: number; dias_derivados: number; confirmadas: number
  abertas: Record<OrigemGravavel, number>; retoques: number; pulados: Record<MotivoPulo, number>
  dias_sem_linha: number; ja_derivado: number; desc_sem_texto: number; origem_sem_video: number
  atraso_dias: Record<string, number>; sem_videos: string[]; sem_tempo: boolean; prova: Record<string, unknown> }
export async function passoVersoes(ctx: StepCtx & { ontem: string }): Promise<VersoesResumo>
```
Consome: `derivarDia`, `atribuirOrigem`, `lerPaginado`, `conferirBanco`, `pushUnico`, `restante`, `diffDias`, `addDays`. Grava só por `rpc('yt_own_versions_apply_day')`. **(emenda 1: D-I2, S-I1) Lê o A/B Lab com leitura própria, descrita na seção 4.3** (colunas `id, youtube_video_id, test_type, paused_at, completed_at, completed_reason, winner_variant_id, winner_applied_at, original_title` de `ab_tests` (emenda 2: D-N1, S-N1); `id, test_id, variant_id, started_at, applied_metadata` de `ab_test_cycles`; ciclos por `started_at` no intervalo; todos os vídeos do canal; limite de 1.000 em cada leitura). **Não é cópia da leitura de `meta-step.ts`**: aquela não traz `winner_applied_at` e filtra ciclos por `ended_at`. Toda leitura e toda `rpc` vão em `comPrazo(…, ctx.deadline)` (emenda 1: S-m7). `VersoesResumo` ganha `recuperando: Record<string, number>` e `dia_sem_resposta: string[]`; e (emenda 2) `origem_ab_incerta: number`, `atraso_desconhecido: string[]`, e `prova` passa a aceitar, por site, o valor `'sem_tempo'`.

**Bloco novo em `fake-supabase.ts`:** `rpcHandlers.yt_own_versions_apply_day` (aplica sobre as tabelas falsas com as mesmas recusas: `ja_derivado`, canal fora do site, confirmação que não casa, e `abertura_invalida` com a mesma regra do Apêndice A; emenda 1: S-I6) e `rpcHandlers.yt_own_versions_prova` (devolve o que o teste semeou). `db.errors['rpc:<nome>']` continua tendo precedência.

**Testes primeiro.**
1. Item 188, com semente de mesma forma que produção (35 vídeos, primeiro dia sem captura, N dias): 105 linhas de base, zero trocas, `derived_through` = ontem, e a ordem das chamadas de `apply_day` é crescente por dia.
2. Item 187: dois dias acumulados dão o mesmo estado final que duas execuções diárias. **(emenda 1: D-I1) A sequência é "dia 1 só confirma, dia 2 troca"** (título num vídeo, thumbnail noutro), e a comparação é linha a linha de `window_start`, `window_end`, `window_precision`, `thumb_anchor_dhash` e `thumb_sha256` entre a execução acumulada e as duas diárias. O teste falha se o passo não avançar as correntes em memória depois do dia 1.
3. Reexecução no mesmo dia: nenhuma chamada de `apply_day` (o intervalo é vazio) e resumo com `dias_derivados` 0 e `atraso_dias` 0.
4. Item 189a: **apaga** as linhas do último dia de um canal com vídeos: nota vermelha de dia sem linha, `derived_through` parado, o outro canal segue.
5. Item 189b: buraco no meio com dia posterior presente: nota vermelha, o dia é pulado, a troca do dia seguinte sai `lacuna`.
6. Item 189c: `derived_through` dois dias atrás e o passo sem tempo **antes de derivar qualquer dia**: nota de atraso (a exceção da recuperação, caso 25, pede 2 dias derivados; emenda 1).
7. Canal sem vídeos e sem linha: `sem_videos`, nenhuma nota. Contagem de vídeos nula: nota "não foi possível avaliar".
8. Schema ausente no estado: uma nota `schema_ausente: yt_own_versions_state`, nenhuma chamada de função, nenhum outro canal lido.
9. Erro de `apply_day` no segundo de três dias: o primeiro fica, o terceiro não é tentado, nota de catálogo fechado; **afirma que o texto do erro do banco não aparece em nota nem em resumo**.
10. Item 184: leitura do A/B Lab com erro, e com exatamente 1.000 linhas: troca gravada com `nao_se_sabe` e nota vermelha.
11. Sem troca no dia: o A/B Lab **não é lido** (zero consulta a `ab_tests`).
12. Descrição: texto na linha do dia; texto só numa linha anterior de mesmo hash; texto em lugar nenhum (`desc_sem_texto` e nota).
13. **Mutação de canal:** linhas de outro canal semeadas no mesmo dia não entram no plano do canal (o teste falha se o filtro `channel_id` for tirado da leitura). **Mutação de site:** idem para `site_id`, nas duas leituras.
14. Prova: `sem_explicacao` 1 dá nota; `publicos` 0 com vídeos dá nota; função ausente dá "não foi possível avaliar"; `origem_cms` 1 dá nota (item 203).
15. `ja_derivado` devolvido pela função: conta, relê as correntes e segue sem nota.
16. Prazo menor que 1,5 s antes do segundo dia: para, `sem_tempo` verdadeiro, o primeiro dia gravado.
17. Nenhuma nota nem campo do resumo contém título de vídeo (varredura das strings do resultado contra os títulos da semente).
18. Leitura das linhas acima do teto: nota, nenhuma derivação parcial.
19. (emenda 1: S-I4 item c, D-I4) **Idas ao banco da primeira execução, travadas por número:** semente de 35 vídeos em 2 canais, 13 dias, primeiro dia sem captura, segundo dia com o hash da descrição igual ao do primeiro e **sem** `description_text`: o banco falso conta as chamadas e o teste afirma **no máximo 43** (42 mais a prova; emenda 2: S-n4, eram 41 antes da ida do menor `day_pt`), exatamente **uma** leitura de texto de descrição por canal e exatamente **uma** leitura do menor `day_pt` por canal sem estado (nenhuma, na execução seguinte, com estado). As 70 versões de descrição saem com `value_text` preenchido.
20. (emenda 1: D-I2, S-I1) **Vencedor pela leitura do passo:** teste semeado nas tabelas falsas com `winner_applied_at` na janela; a versão gravada sai `ab_lab`, `vencedor`. O banco falso respeita a projeção de colunas: o teste falha se `winner_applied_at` ou `test_type` saírem do `select`. **(emenda 2: D-N1, S-N1)** Segundo teste semeado no mesmo caso: `completed_reason` `manual_winner`, `winner_applied_at` nulo, `completed_at` na janela, thumbnail trocada: a versão gravada sai `ab_lab`, `vencedor`, com `ab_variant_id` = `winner_variant_id`; o teste falha se `completed_reason` ou `winner_variant_id` saírem do `select`.
21. (emenda 1) **Restauro pela leitura do passo:** pausa de `combo` na janela, título e thumbnail: as duas versões saem `restauro`.
22. (emenda 1) **Dia atrasado cujo ciclo já fechou:** três dias acumulados, troca no primeiro, explicada por um ciclo que começou **e terminou** dentro da janela dela (`ended_at` anterior a hoje): sai `rotacao`, não `fora_do_sistema`.
23. (emenda 1) **Trocas em vídeos diferentes em dois dias da mesma execução:** vídeo A troca no dia 1 sem teste, vídeo B troca no dia 2 explicado por ciclo: B sai `rotacao` (a leitura do primeiro dia com troca cobre todos os vídeos do canal), e `ab_tests` é lido **uma** vez no canal.
24. (emenda 1: D-I4, S-m7) **Prazo dentro do dia:** `apply_day` que não responde até o prazo: `sem_tempo` verdadeiro, o dia em `dia_sem_resposta`, `dias_derivados` sem ele, nenhuma nota de erro de banco; na execução seguinte, com a função devolvendo `ja_derivado` para esse dia, o passo conta, relê e segue. Leitura que não responde: canal parado com `sem_tempo`, sem nota de erro de banco.
25. (emenda 1: D-I4) **Recuperação. Fronteira nomeada: 1 e 2 dias derivados.** Atraso de 5 dias, sem tempo depois de 2 dias derivados: `recuperando` com o canal, **nenhuma** nota de atraso e nenhuma nota de `sem_explicacao` da prova. Sem tempo depois de 1 dia derivado: nota vermelha de atraso. Atraso de 5 dias **sem** `sem_tempo` (parou por erro): nota vermelha. **(emenda 2: S-n7)** Atraso de 40 dias, com tempo de sobra: o canal deriva 30, para no teto, sai em `recuperando` com atraso 10 e **nenhuma** nota de atraso; na execução seguinte fecha (atraso 0). **Fronteira nomeada: 30 e 31 dias acumulados** (30 fecha numa execução, sem `recuperando`; 31 deixa 1 de atraso, que não é maior que 1 e fica só no resumo).
26. (emenda 1: S-m1) **Recusa da função por `message`:** erro `{ code: 'P0001', message: 'touch_recusado' }` dá a nota com `(touch_recusado)`; erro `{ code: 'P0001', message: 'duplicate key value violates … "Título secreto"' }` dá `(erro_desconhecido)` e o texto não aparece em nota, resumo nem no que vai ao Sentry.
27. (emenda 1: D-m3, D-m6, S-m4, S-m5) `canais_com_linha_sem_estado` 1 dá nota; 1 com `sem_tempo` e **sem** canal em `recuperando` **dá** nota; 1 com outro canal do site em `recuperando` não dá (emenda 2: S-n1; antes bastava `sem_tempo`); canal cujo único vídeo tem `published_at` nulo ou posterior ao fim de ontem, sem linha: `sem_videos`, nenhuma nota; linha sem privacidade e com dHash de vídeo cuja linha anterior era `private`: thumbnail pulada, e a leitura da última privacidade acontece **uma** vez por canal.
28. (emenda 1: S-m9) O passo que lança (fato duplicado, forçado no teste): a mensagem do erro, que vai a `falhas` e ao Sentry por `falhou()` de `index.ts`, não contém título de vídeo.
29. (emenda 2: S-n1) **Canal sem estado e sem tempo.** Canal B sem linha em `yt_own_versions_state`, com linhas diárias de 5 dias: (a) o tempo acaba depois da leitura do menor `day_pt` e antes do primeiro dia: nota vermelha de atraso (5 dias, contados do menor `day_pt`); (b) com 2 dias derivados e `sem_tempo`: `recuperando`, sem nota; (c) a leitura do estado de B não volta até o prazo, e o canal A está em dia: B em `atraso_desconhecido` e nota vermelha `sem tempo para saber o atraso`; (d) o mesmo com o canal A em `recuperando`: B em `atraso_desconhecido`, **sem** nota.
30. (emenda 2: S-n2) **Prova sem resposta até o prazo:** `resumo.versoes.prova[<site>]` é `'sem_tempo'` e `sem_tempo` verdadeiro; com um canal em `recuperando`, nenhuma nota; sem canal em `recuperando`, a nota `critérios: não foi possível avaliar a prova das versões`.
31. (emenda 2: S-N1) **Origem incerta pela leitura do passo:** teste `inconclusive` com `completed_at` e um ciclo de `thumbnail_set` na mesma janela: versão gravada com `nao_se_sabe`, `ab_event` nulo e `ab_test_id` preenchido; `origem_ab_incerta` 1; **nenhuma** nota (a nota do Lab ilegível, caso 10, não sai). E `auto_resolve` com `winner_applied_at` nulo e ciclo na janela: `rotacao`, com variante.
32. (emenda 2: D-n2) **Limite inferior da leitura de ciclos:** canal com uma versão corrente de vídeo que não tem mais linha no intervalo (`last_seen_at` de 200 dias atrás) e uma troca noutro vídeo: o filtro de `started_at` enviado ao banco falso começa no `last_seen_at` da corrente do vídeo **com** linha, não no de 200 dias atrás.

**Pronto quando** os 32 passam com o banco falso e o `tsc` fecha.

### Tarefa 7: integração no cron (item 245)

**Quando (emenda 1: S-I3). Esta tarefa só é escrita e commitada depois de a MG12 estar em produção com V1 a V5 conferidas.** O trabalho é todo em `staging`, sem ramo por etapa, e qualquer push desse ramo (o da A4, que este plano espera para a Tarefa 9, ou o de outra trilha) leva junto tudo o que estiver commitado. Com este commit em produção antes das tabelas, o cron das 12:00 UTC ficaria vermelho todo dia com `schema_ausente: yt_own_versions_state`, escondendo qualquer outra falha no e-mail do vigia. Deixar o código pronto e sem commit na árvore não serve (outros agentes escrevem em `coleta/index.ts` na mesma árvore, e `stash` é proibido): por isso a tarefa inteira muda de onda. É pequena (um bloco e uma linha). **Saída de emergência, se o controlador precisar adiantá-la:** antes de qualquer push de `staging` que contenha este commit, o dono põe `versoes` em `YT_OWN_STEPS_OFF` em produção (passo desligado: nota, não vermelho, por até 7 execuções) e tira depois de V1 a V5; o controlador confere a variável antes do push e anota no ledger. As Tarefas 5, 6, 8, 9, 10 e 11 não têm esta restrição: nenhuma delas é chamada pelo cron sem a Tarefa 7.

**Passos.** Em `index.ts`, fase `'antes'`, logo depois do bloco de `metadados`:
```ts
if (passoDesligado('versoes')) resumo.versoes = { desligado: true }
else { const r = await passo('versoes', TETO_VERSOES_MS, 'meta', [], c => passoVersoes({ ...c, ontem: ontemPt(new Date()) })); if (r) resumo.versoes = r }
```
`servidos` vazio de propósito: sem tempo, o passo não registra tentativa (o `kind` passado não é usado). Na fase `'depois'`, antes da chamada de `criterioDesligados`: `if (passoDesligado('versoes')) desligados.push('versoes')`. A rota não muda (F7 funde os resumos). Atualizar o comentário de `PASSOS_LIGADOS` para citar as versões.

**Testes primeiro (`index.test.ts`).** (1) **apaga** `process.env.YT_OWN_STEPS_OFF` e afirma que o passo rodou (`resumo.versoes` com `dias_derivados`). (2) com `versoes` na variável: `resumo.versoes` é exatamente `{ desligado: true }`, nenhuma chamada a `yt_own_versions_apply_day`, e na fase `'depois'` `criterioDesligados` recebe `'versoes'`. (3) com ` Versoes ` (espaços e maiúscula): desligado. (4) com `versao`: não desliga e a nota de nome desconhecido aparece. (5) o passo roda **depois** dos metadados e antes dos jobs (ordem das chamadas no banco falso). (6) o passo que lança não derruba a fase: `falhas` ganha `versoes: …` e os jobs rodam. (7) relógio sem tempo: `resumo.versoes.sem_tempo` verdadeiro e nenhuma tentativa `nao_alcancado_orcamento` gravada. (8) a nota de conferências continua sendo a última de `falhas` (o teste que já existe não muda). (9) item 247: com o passo ligado e desligado, todos os outros campos de `resumo` da fase `'antes'` são iguais sobre a mesma base. (10) (emenda 1: S-m8) o caso 7 fica travado como está **e comentado**: sem tempo na entrada, `passoVersoes` não é chamado e nenhuma nota de atraso sai; na fase `'antes'` isso só acontece se os passos anteriores gastarem os 270 s, e a execução seguinte acusa o atraso. É por isso que a posição alternativa (fim da fase `'depois'`) exige a tarefa 7b do desvio 6.

**Pronto quando** os testes passam e nenhum teste antigo de `index.test.ts` mudou.

### Tarefa 8: antes e depois (itens 193 e 194)

**Contrato.** O da seção 4.7, mais:
```ts
export interface Lado { diasCandidatos: number; diasMedidos: number; diasSemClique: number; imp: number; cliquesEst: number; taxa: number | null; lo: number | null; hi: number | null }
export type LeituraDaTroca =
  | { estado: 'nao_se_aplica' | 'em_teste_ab' | 'antes_fora_da_janela_lida' }
  | { estado: 'sem_antes' | 'depois_nao_medido' | 'ainda_nao_da'; antes: Lado; depois: Lado; cortada: boolean }
  | { estado: 'com_leitura'; antes: Lado; depois: Lado; cortada: boolean; leitura: 'subiu' | 'caiu' | 'sem_diferenca_firme' }
```

**Testes primeiro.**
1. Item 193: 99 de um lado e 5.000 do outro: `ainda_nao_da`, `taxa`, `lo` e `hi` nulos nos dois lados. 100 e 100: `com_leitura`. **Fronteira: 99 e 100.**
2. Item 193: com `PROPRIO_RULES.trocaMinImpressoesPorLado = 50` (restaurado no `afterEach`), o dado de 60 e 60 passa de `ainda_nao_da` a `com_leitura`.
3. Item 194: precisão `1d` tira dois dias; `min` tira um; `lacuna` de 3 dias tira o buraco inteiro. O dia tirado é `dayPt` do instante da janela, **não** `primeiroDia` (caso com captura às 12:00 UTC: os dias diferem em um).
4. Dia da publicação fora, dos dois lados.
5. Vizinha de **outro** campo (troca de thumbnail 3 dias depois de uma de título) corta o depois e marca `cortada`; vizinha de descrição não corta; retoque não corta com a constante em `false` e corta em `true`; rotação do Lab corta.
6. Dia `nao-medido` não soma e reduz `diasMedidos`; dia `zero-medido` conta como medido com zero; dia ausente da lista, idem a não medido.
7. Nenhum dia medido depois: `depois_nao_medido`, nunca `imp: 0` como leitura.
8. Nenhum dia medido antes: `sem_antes`; todos os candidatos do antes anteriores ao primeiro dia da lista: `antes_fora_da_janela_lida`.
9. Faixas que se tocam: `sem_diferenca_firme`; separadas: `subiu` e `caiu`; **fronteira:** `hi` de um igual a `lo` do outro é tocar.
10. Linha de base, `pre_registro` e descrição: `nao_se_aplica`. Rotação: `em_teste_ab`.
11. Janela de 7 dias: o oitavo dia não entra. **Fronteira: 7 e 8.**
12. Dia com impressões e cliques nulos: fora das duas somas, contado em `diasSemClique`.
13. Varredura do arquivo-fonte: nenhuma ocorrência de "efeito", "causou" ou "por causa".

**Pronto quando** os 13 passam, sem import de banco.

### Tarefa 9: leitor (item 192; só depois da A4 em `staging`)

**Contrato.** `lerVersoes` (seção 4.7), no molde de `proprio/ler-dimensoes.ts`: `import 'server-only'`; sem token válido (`edicaoValida(p.edicao)` falso) devolve `{ acesso: 'negado' }` **antes de qualquer consulta**; o site vem de dentro do token; toda consulta filtra `site_id` **e** `channel_id`; `ytIds` validados por expressão regular e limitados a 50; leitura paginada com teto de 20.000 linhas; `ErroLeituraVersoes` (tabela, motivo, código, linhas lidas; nunca a mensagem do banco). `imagemExata` = a URL termina em `/<dhash>.jpg`. O leitor aceita o token que `Pedido` aceitar: quando a E17, passo 0, trocar `Pedido` para o token de leitura privada, este leitor acompanha sem mudança.

**Testes primeiro.** (1) item 192: `edicao: null` devolve `negado` e **zero** chamada ao banco; objeto forjado com `siteId`, idem. (2) **mutação de site:** versão de outro site com o mesmo canal semeada não aparece; **mutação de canal:** idem. (3) tabela ausente: `estado: 'schema_ausente'`, sem lançar. (4) canal sem estado: `estado: 'sem_estado'` e todo vídeo pedido com os três campos de `registro` em `sem_versao`. (5) campo só com linha de base: `so_linha_de_base`; com troca: `com_trocas`; vídeo pedido sem linha nenhuma **continua na resposta**. **(emenda 1: S-I5)** (5b) vídeo privado: `registro.thumb.estado` é `sem_versao` com `conferidoAte` nulo, e `registro.title.estado` é `so_linha_de_base`; (5c) vídeo só com thumbnail (canal sem captura pela API): `title` e `desc` em `sem_versao`, `thumb` em `so_linha_de_base`; (5d) corrente de thumbnail parada há 3 dias com o título em dia: `registro.thumb.conferidoAte` é o dia de 3 dias atrás e `registro.title.conferidoAte` é ontem; (5e) versão `pre_registro` de título num vídeo sem outra versão de título: `title` continua `sem_versao`. (6) erro de banco e teto de linhas lançam `ErroLeituraVersoes`, cuja mensagem não contém o texto do banco. (7) `ytIds` vazio: nenhuma consulta às versões, o estado real do canal. (8) `atrasoDias` = `hoje - 1 - conferidoAte`. (9) `imagemExata` verdadeira e falsa. (10) versão com origem `'cms'` no banco é lida como veio (o tipo de leitura aceita). (11) ordem das versões: por campo e por `vistaDesde`.

**Pronto quando** os 11 (com os quatro casos 5b a 5e) passam e uma varredura de teste confirma que só este arquivo consulta `yt_own_video_versions` fora de `coleta/`.

### Tarefa 10: testes de ponta contra o banco local

**Objetivo.** O passo real contra o `bythiago_int` com a MG12 aplicada (`describe.skipIf(skipIfNoLocalDb())`).

**Casos.** (1) item 188: semente de 35 vídeos e 5 dias: 105 linhas de base, zero trocas, estado certo. (2) item 186: o passo de novo: nenhuma linha alterada (comparação de `md5` do conteúdo). (3) item 187. (4) item 189: apaga as linhas do último dia e afirma a nota. (5) item 185: o passo com uma abertura que a restrição recusa: nada do dia gravado. (6) troca de título com ciclo do A/B Lab semeado na janela: `ab_lab`, `rotacao`, `min`. (7) item 201, como reescrito no desvio 3. (8) item 203: `select count(*) … where origin = 'cms'` = 0 depois de tudo. (9) item 190 pelo leitor: sessão sem edição não lê. (10) o leitor sobre o que o passo gravou devolve os três estados de `registro`, por campo. **(emenda 1)** (11) S-I6: depois do passo real, **todas as colunas** de uma versão de thumbnail aberta são comparadas com a linha diária semeada (`thumb_dhash`, `thumb_anchor_dhash`, `thumb_sha256`, `thumb_blob_url`, `video_id`, `first_seen_at`, `last_seen_at`, não nulos e iguais), e as de uma versão `ab_lab` de título com o ciclo semeado (`ab_test_id`, `ab_variant_id`, `first_seen_at` = início do ciclo, `window_start` = `window_end` = esse instante, `value_text` = o título); **(emenda 2: S-n6)** e as de uma versão de **descrição** aberta: `value_text` não nulo e igual ao texto semeado na linha diária, `value_hash` igual ao `description_sha256` da linha (a descrição era o único campo cujo valor a função do banco não confere, porque `value_text` nulo é permitido nela). (12) S-I1: vencedor (`winner_applied_at` na janela) e restauro (pausa de `combo`, título e thumbnail) contra o banco real; e (emenda 2: D-N1, S-N1) encerramento `manual_winner` de teste `combo` com `winner_applied_at` nulo: a versão de thumbnail sai `vencedor`, com `ab_variant_id` = `winner_variant_id`, lendo `completed_reason` do banco de verdade (a coluna existe desde `20260517000001_ab_testing.sql:20`, com os valores ampliados em `20260531000007_fix_ab_tests_status_check.sql`). (13) D-I1: "dia 1 confirma, dia 2 troca" numa execução acumulada e em duas diárias: as linhas de `yt_own_video_versions` são iguais coluna a coluna, fora `id` e `created_at`.

**Semente e2e: fora** (emenda 1: S-m3; desvio 10). Os testes desta tarefa semeiam e limpam o que usam, dentro do próprio arquivo, no `bythiago_int`.

**Pronto quando** os treze casos passam com `HAS_LOCAL_DB=1` no `bythiago_int`, a saída está em arquivo e o relatório lista o que ficou `skip` e por quê.

### Tarefa 11: semente do A/B Lab (parte 7; última de código)

**Contrato.** `versoes-semente-ab.ts` (puro): `montarSementeAb(testes, ciclos, videos, registroDesde): { linhas: LinhaSemente[]; fora: Array<{ ciclo: string; motivo: 'sem_titulo' | 'depois_do_registro' | 'video_ausente' | 'atravessa_o_registro' }> }` (emenda 2: D-n3: o quarto valor estava só na prosa). Uma linha por ciclo com `title_set` não nulo e início anterior a `registroDesde`: `value_hash = hashValue(title_set)`, `first_seen_at` = início do ciclo, `last_seen_at` = fim do ciclo (ou o início, se o ciclo não tem fim), evento `rotacao`. **(emenda 1: D-m9)** Ciclo que começa antes e **termina no dia do início do registro ou depois** fica em `fora` com o motivo novo `atravessa_o_registro` (o tipo de `motivo` ganha esse valor): gravado, ele teria `last_day_pt` dentro do período registrado. Não se perde nada: o título desse ciclo é o que estava no ar quando o registro começou, e já é a linha de base. A função do banco recusa o mesmo caso (S15). `scripts/semear-versoes-ab-lab.ts`: lê os canais, testes e ciclos, imprime o que gravaria e **não grava**; só chama `yt_own_versions_seed_pre` com a flag `--gravar`. **(emenda 1: S-m10)** Antes de qualquer leitura o comando imprime o endereço do projeto a que está ligado (o host de `NEXT_PUBLIC_SUPABASE_URL`, sem chave); e `--gravar` só vale junto de `--confirmar=<ref do projeto>` igual ao ref desse endereço: sem a flag, ou com ref diferente, sai com erro sem chamar a função (`apps/web/.env.local` aponta para produção).

**Testes primeiro.** (1) os 7 ciclos da forma medida (4 com metadado): 4 linhas (ou o número de P5), 3 em `fora` com `sem_titulo`. (2) ciclo iniciado depois do registro: `depois_do_registro`. (3) vídeo que saiu de `youtube_videos`: `video_ausente`. (4) **invocação sem a flag**: o teste chama a função principal do comando sem `--gravar` e afirma zero chamada de `rpc`. (5) com a flag e a função devolvendo `sem_estado`: sai com código de erro e mensagem de catálogo. (6) rodar duas vezes: a segunda devolve `inseridas` 0. (7) lista vazia de testes: imprime "nenhum ciclo para semear" e sai com zero, sem chamar a função. (8) (emenda 1: S-m10) `--gravar` sem `--confirmar`, e com `--confirmar` de outro ref: zero chamada de `rpc`, código de erro; a primeira linha impressa é o endereço do projeto. (9) (emenda 1: D-m9) ciclo que atravessa o início do registro: em `fora`, `atravessa_o_registro`.

**Em produção.** O agente prepara o comando; o dono cola (o comando grava em produção). Antes, o agente roda a simulação contra o banco local.

**Pronto quando** os 9 passam e o runbook (Tarefa 12) traz o comando em uma linha.

### Tarefa 12: runbook, conferências com data e envio

**Antes do envio.** Tarefa 0 feita; MG12 aplicada pelo dono e V1 a V5 conferidas em produção; P10 conferida (variável sem `versoes`); `tsc` e os testes das Tarefas 2 a 11 verdes, com saída em arquivo; a suíte dos consumidores de `rules.ts` e de `coleta/index.ts`.

**No commit do envio.** `E18_DEPLOY: string | null` em `lib/conferencias.ts` (nasce `null`; o controlador preenche com o dia de São Paulo da promoção) e `conferenciasE18(deploy)` com as seis entradas da seção 7, `etapa: 'E18'`, somada a `CONFERENCIAS`. Teste: `null` = nenhuma entrada; data malformada = uma entrada de 1970; data preenchida = as seis datas certas. As mesmas seis linhas em `.superpowers/sdd/a5/conferencias-com-data.md`. Runbook: seção "Versões do vídeo próprio" com o que o passo faz, as notas vermelhas da seção 6 e o que fazer em cada uma, o que quer dizer `recuperando`, `dia_sem_resposta`, `atraso_desconhecido`, `origem_ab_incerta` e `prova: 'sem_tempo'` (emenda 2), o caminho mudo conhecido da prova (emenda 1: D-m2: vídeo apagado no YouTube e ainda em `youtube_videos` continua "público" pelo último status e fica explicado todo dia pela tentativa `erro_http` "ausente de videos.list"; quem acusa é a nota do passo de metadados, e a saída é remover o vídeo de `youtube_videos`), como desligar (`YT_OWN_STEPS_OFF=versoes`), como voltar, e o comando da semente.

**Ordem que não pode inverter.**

| Ordem | O quê | Se inverter |
|---|---|---|
| 1 | acordo dos dois especialistas sobre este plano | a migration não vai ao dono (decisão 45) |
| 2 | MG12 em produção (dono, no lote C) | código antes da migration: cron **vermelho todo dia** com `schema_ausente: yt_own_versions_state`; nada é gravado nem perdido. **(emenda 1: S-I3) "Código" aqui é o commit da Tarefa 7**, e ele chega a produção no push de **qualquer** trilha de `staging`, não só no da Tarefa 12: por isso a Tarefa 7 só é commitada depois da linha 3 |
| 3 | V1 a V5 | sem elas não se sabe se a policy ficou a certa |
| 3a (emenda 2: S-n3, as linhas 3 e 3a estavam em ordem trocada) | Tarefa 7 escrita e commitada, **depois** da linha 3 | antes disso nenhum push de `staging` leva o passo ao cron |
| 4 | variável `YT_OWN_STEPS_OFF` conferida | com `versoes` esquecido na lista, o passo nasce desligado e só fica vermelho na 8ª execução |
| 5 | push em `staging`, CI verde, promoção a `main` fora de 11:55 a 12:15 UTC | promover dentro da janela pode pegar o cron com o código pela metade |
| 6 | D0, D+1 e as outras conferências | |
| 7 | semente do A/B Lab (dono), depois do D+1 | antes do primeiro cron a função recusa com `sem_estado` |

A Tarefa 5 é independente e pode ir antes de tudo isto.

**Como voltar.** Primeiro o interruptor: `YT_OWN_STEPS_OFF=versoes` na Vercel (vale na execução seguinte, sem deploy). Depois, se for o caso, reverter o commit do código. As tabelas ficam, com o que já foi derivado; o passo religado deriva os dias que faltaram, em ordem. Não há o que desfazer em dado: o passo só escreve nas duas tabelas novas. Apagar as tabelas (Apêndice B) é só do dono e só faz sentido antes da MG17, enquanto as linhas diárias permitem derivar tudo de novo. A Tarefa 5 volta por reversão do commit dela; as imagens guardadas a mais ficam no Blob.

**Pronto quando** o D0 e o D+1 da seção 7 batem e estão no ledger.

---

## 11. Consultas de conferência e o que foi rodado

**Rodado por quem escreveu o plano: nada** (só leitura do repositório). As consultas abaixo são para o controlador e para a Tarefa 1.

- **K1, estado por canal:** `select c.name, s.tracking_since, s.derived_through, ((now() at time zone 'America/Los_Angeles')::date - 1) - s.derived_through as atraso from youtube_channels c left join yt_own_versions_state s on s.channel_id = c.id;` Esperado: atraso 0; linha sem estado só para canal sem linha diária.
- **K2, item 200:** `select public.yt_own_versions_prova(<site>, ((now() at time zone 'America/Los_Angeles')::date - 1));` Esperado: `sem_explicacao` 0, `origem_cms` 0, `canais_com_linha_sem_estado` 0 (os três são vermelho no passo; emenda 1: D-m3).
- **K3, uma corrente por vídeo e campo:** `select youtube_video_id, field, count(*) from yt_own_video_versions where is_current group by 1, 2 having count(*) <> 1;` Esperado: zero linhas (o índice único garante; a consulta é a prova de fora).
- **K4, invariante do item 199 em produção:** `select count(*) from yt_own_video_versions v where not pre_registro and origin <> 'linha_de_base' and not exists (select 1 from yt_own_video_versions a where a.youtube_video_id = v.youtube_video_id and a.field = v.field and not a.pre_registro and a.first_day_pt < v.first_day_pt);` Esperado: 0 (toda troca tem versão anterior).
- **K5, janelas coerentes:** `select window_precision, count(*), count(*) filter (where window_start is null) from yt_own_video_versions group by 1;` Esperado: só `first` com janela nula.
- **K6, item 195:** a do D+30 (seção 7).
- **K7, trocas por dia desde o envio:** `select first_day_pt, field, origin, count(*) from yt_own_video_versions where origin <> 'linha_de_base' group by 1, 2, 3 order by 1;` (emenda 1: S-m6) No D+30, procurar nela troca de título `fora_do_sistema` seguida, no dia vizinho, da volta ao título anterior: é a assinatura do risco 14.

---

## 12. Onde está cada item de aceite

| Item | Onde |
|---|---|
| 173 a 180 | Tarefa 3 (casos 1 a 9); o 176 com o desvio 1 |
| 181 a 183 | Tarefa 4 (com os desvios 15 e 16; emenda 1; casos 18 a 24 da emenda 2) e, pela leitura real do passo, Tarefa 6 (casos 20 a 23 e 31) e Tarefa 10 (casos 6 e 12) |
| 184 | Tarefa 4 (caso 4) e Tarefa 6 (caso 10) |
| 185 | Tarefa 1 (S6) e Tarefa 10 (caso 5) |
| 186 | Tarefa 1 (S5), Tarefa 6 (caso 3), Tarefa 10 (caso 2) |
| 187 | Tarefa 1 (S7), Tarefa 3 (caso 15), Tarefa 6 (caso 2), Tarefa 10 (casos 3 e 13) |
| 188 | Tarefa 6 (caso 1), Tarefa 10 (caso 1); em produção, D0 (com P2 e P3) |
| 189 | Tarefa 6 (casos 4 a 6 e 29), Tarefa 10 (caso 4) |
| 190 | Tarefa 1 (testes de RLS), Tarefa 10 (caso 9) |
| 191 | Tarefa 1: escrito aqui, verde só com a MG11 no banco; a troca das policies é do plano da E17, passo 0 |
| 192 | Tarefa 9 (caso 1) |
| 193 | Tarefa 8 (casos 1 e 2), Tarefa 2 |
| 194 | Tarefa 8 (casos 3 a 7) |
| 195 | conferência D+30 (Tarefa 12) |
| 196, 197, 198 | **fora**: são da tela (parte 6) e do pacote da E17. O leitor entrega os três estados de `registro`, por campo (Tarefa 9, casos 5 a 5e; emenda 1: S-I5) e a função pura não usa palavra de causa (Tarefa 8, caso 13) |
| 199 | Tarefa 3 (caso 13); em produção, K4 |
| 200 | função `yt_own_versions_prova` (Tarefa 1, S16 e S16b), o passo (Tarefa 6, caso 14), K2 no D+1; com o desvio 11 |
| 201 | Tarefa 1 (S14) e Tarefa 10 (caso 7), como reescrito no desvio 3; **fora**: regenerar `database.types.ts` (desvio 9) e semear e limpar as tabelas na semente e2e (desvio 10; emenda 1: S-m3) |
| 202 | **fora**: é da parte 2 (MG17); a seção 4.8 diz o que este plano deixa aberto |
| 203 | Tarefa 2 (tipo), Tarefa 4 (caso 12), Tarefa 6 (caso 14), Tarefa 10 (caso 8), D0; a frase da tela é da parte 6 |
| 245 | Tarefa 7 (casos 1 a 4) |
| 246 | Tarefa 12 |
| 247 | Tarefa 7 (caso 9); a MG12 é inerte (seção 2) |
| OP-2 | Apêndice A (`search_path = ''` e nomes qualificados nas três funções) |

---

## 13. Riscos que ficam, sem suavizar

1. **O SQL não foi rodado por quem o escreveu.** A Tarefa 1 é a primeira vez que ele encontra um Postgres. É o maior risco de prazo deste plano; não é risco de produção, porque nada vai ao dono antes da prova.
2. **Troca dentro do mesmo dia, fora do Lab, não é vista** (risco 32 do spec): a leitura é diária. A, B, A no mesmo dia não deixa rastro.
3. **A origem depende do relógio do servidor** (risco 33): troca feita no Studio na mesma janela de um ciclo com o mesmo título é atribuída ao Lab. (emenda 1) O mesmo vale, e com menos prova, para a thumbnail trocada à mão na janela de uma parada de teste: sai `restauro` sem conferência de imagem (desvio 15). **(emenda 2: S-N1)** E o que a regra por caminho ainda não cobre: as pausas automáticas (vigia e rotação depois de 3 falhas) só reenviam a original quando ela está no Blob, e gravam `paused_at` mesmo quando o reenvio falha; nesses casos, com rotação na mesma janela, a imagem no ar é a da rotação e a versão sai `restauro`. Não se distingue da pausa manual pelas colunas lidas (`status_note` distinguiria, e fica como dívida). P14 diz se algum teste tem a original fora do Blob. Nos encerramentos sem garantia de reenvio a regra não afirma: sai `nao_se_sabe` (ordem 4b).
4. **O limiar cala quase tudo hoje** (risco 35): com cerca de 158 impressões em 30 dias nos dois canais, toda troca dá "ainda não dá para dizer". É a leitura honesta de um canal pequeno.
5. **Leitura causal** (risco 34): "a taxa subiu depois da troca" convida à causa. O código não usa a palavra; o texto é da parte 6.
6. **Imagem de versão anterior à Tarefa 5** pode ser a de uma versão vizinha (deriva lenta); `imagemExata` diz quando. Retoque com dHash idêntico nunca tem imagem própria (pergunta 1).
7. **O limiar de 6 bits do dHash é provisório** (risco 36): calibrado nos concorrentes. O D+30 mede.
8. **A barreira real do dado privado é o token no código** (risco 39): o leitor usa cliente de serviço. A varredura da Tarefa 9 trava novos leitores, mas não impede alguém de escrever outro fora da pasta.
9. **Cinco segundos saídos da reserva** no pior caso do relógio (desvio 6). P12 mede a folga; `ms_passos.versoes` mostra o gasto real todo dia.
10. **Linha diária que nasce depois de o dia ser derivado** (segunda execução manual do cron no mesmo dia, depois de uma primeira parcial) não é relida: a troca desse vídeo é vista no dia seguinte, com precisão `lacuna` em vez de `1d`. Não perde a troca; perde precisão. **(emenda 1: D-m4) E há mais:** a segunda execução não só cria linhas, ela **reescreve** `title_at_capture`, `captured_at`, dHash e sha de linhas já derivadas quando há captura (`meta-step.ts:409-456`). Nada se perde (a diferença aparece como troca no dia seguinte), mas a linha diária e a versão passam a discordar naquele dia, e a invariante que a MG17 vai exigir, "derivar do zero dá as mesmas versões", pode falhar nesses dias. Fica registrado para o plano da MG17 (item 202), que tem de decidir o que faz com dia reescrito antes de pôr a dieta. Quando a reescrita cai entre a leitura do passo e a gravação, a função recusa com `abertura_invalida` e o dia é refeito amanhã (seção 6, linha 28).
11. **Título, descrição e thumbnail lidos com o acesso do dono ficam guardados além de 30 dias** (risco 37, política III.E.4.c). A tabela diária já os guarda desde 07/10; este plano dá forma, não cria retenção nova nem prazo de apagamento. Apagar é por remoção do canal (que hoje recusa com série coletada) ou pelo Apêndice B, com o dono.
12. **A cópia da imagem existe uma vez só, em URL pública do Blob** (risco 43), sem export nesta fase.
13. **(emenda 1; achado de quem respondeu, não dos pareceres) Reverter um vencedor aplicado não deixa instante.** A ação de reverter devolve título e thumbnail originais ao YouTube e só **zera** `winner_applied_at` (`ab-lab/actions.ts:1531-1553`): não grava quando reverteu. A troca que o passo vê no dia seguinte não acha evento na janela e sai `fora_do_sistema`, sendo do Lab. Não há como consertar aqui sem inventar instante; o conserto é o Lab gravar o instante da reversão, fora deste plano (fica em "Dívida registrada", abaixo). Do mesmo tipo: uma retomada zera `paused_at` (`actions.ts:875`), então o restauro de um dia derivado com atraso, depois da retomada, também sai `fora_do_sistema`. **(emenda 2: D-n1)** E aplicar o vencedor depois de um encerramento **sobrescreve** `completed_at` e `completed_reason` (`actions.ts:1396-1404`): num dia derivado com atraso, o encerramento original fica sem evento na janela, e a troca dele sai `fora_do_sistema` (ou `rotacao`, se houve ciclo na janela). Regra nenhuma muda: é estado do Lab que mudou depois do fato.
14. **(emenda 1: S-m6) "`privacy_status` não nulo = houve captura" tem um furo conhecido.** Numa segunda execução no mesmo dia, com a captura falhando **e** o dia ilegível, `preservar` é falso e `title_at_capture` recebe o título de `youtube_videos`, enquanto o `privacy_status` da primeira execução fica (`meta-step.ts:409-450`). A derivação vê uma troca falsa e, no dia seguinte, a volta. É falha tripla e rara; não se corrige aqui (o passo de metadados é de outra etapa). A K7 do D+30 procura a assinatura.
15. **(emenda 1: S-m5) A linha de base de thumbnail de 07/10 de um vídeo que já era privado** pode ser a imagem de substituição do YouTube: naquele dia não há privacidade conhecida, nem anterior. P15 conta quantos são (0 esperado).
16. **(emenda 1: D-m8) A Tarefa 5 troca um risco por outro:** deixa de apontar imagem velha numa deriva lenta, e passa a perder dHash e sha do dia quando o arquivamento a mais falha. O D+7 mede.

### Segurança e LGPD, num lugar só
- **Quem lê:** quem tem o direito de ver desempenho privado (depois da MG11) ou quem edita o site (antes). RLS ligada nas duas tabelas, sem policy de escrita, privilégios de escrita revogados de `anon` e `authenticated`. A policy nunca usa `can_view_site` nem confia no GUC `app.site_id` (teste com o GUC forjado, Tarefa 1).
- **Cliente de serviço:** só no cron (autenticado por `CRON_SECRET`) e no leitor, **depois** do token de acesso (a prova de `can_edit_site` da A4). Nenhuma server action nova.
- **Dado pessoal:** nenhum de terceiros. Título e descrição são conteúdo do próprio dono; não vão a nota, resumo nem Sentry (Tarefa 6, caso 17).
- **Retenção e apagamento:** as versões ficam enquanto o canal existir (spec 9.2). Site apagado: **a MG12 não muda o que já acontece hoje** (emenda 1: D-m5, S-m11; a versão anterior dizia "cascata", o que não está provado): `youtube_channels.site_id` não tem `on delete cascade` (`20260507000001_schema.sql:3018`), então apagar um site com canal já para ali, antes de chegar às tabelas novas; o cenário S18 da Tarefa 1 confere no banco local. Canal: `restrict`, com a recusa amigável de `youtube_channel_remove`.

### Dívida registrada
- A janela de 35 dias do leitor de alcance da A4 limita o antes e depois a trocas recentes (estado `antes_fora_da_janela_lida`). Alargar pede um parâmetro em `proprio/ler.ts`; fica para o plano da parte 6.
- Regenerar `database.types.ts` (desvio 9).
- Guardar a imagem do retoque de dHash idêntico (pergunta 1).
- Título original dos testes na faixa "antes do registro" (desvio 8).
- (emenda 1) O A/B Lab gravar o instante da reversão de um vencedor (risco 13).
- (emenda 2: S-N1) O A/B Lab gravar, em cada parada, se reenviou imagem e qual (hoje só o código sabe): é o que tiraria a ordem 4b e o furo das pausas automáticas do risco 3.
- (emenda 1) Semear e limpar as duas tabelas na semente e2e: plano da parte 6 (desvio 10).

### O que nenhum teste vai provar
- Que o YouTube não recodifica thumbnails sozinho (só o D+7 e o D+30).
- Que os tempos da seção 5.2 valem em produção (só `ms_passos.versoes`); o teste 19 da Tarefa 6 prova o número de idas, não a latência.
- Que a forma real das linhas de produção é a da semente dos testes (P2, P3, P4 e o D0).
- Que a atribuição ao A/B Lab está certa num teste ativo de verdade: não há teste ativo hoje (P5); o primeiro teste real é a prova.
- Que `can_view_private_site` faz o que promete: é da MG11.
- Que a tela não vai confundir "não registrado" com "nenhuma troca": é da parte 6.

---

## 14. Apêndices

### Apêndice A: MG12 (texto final proposto; a Tarefa 1 roda duas vezes antes de virar arquivo)

```sql
-- =============================================================================
-- MIGRATION MG12: Observatório A5, etapa E18: versões do vídeo próprio
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md (7.5)
-- Plano: docs/superpowers/plans/2026-10-13-a5-e18-versoes-do-video-proprio-plan.md
-- Aditiva. Roda duas vezes sem erro. Não altera nem apaga dado existente. Não recria função existente.
-- Inerte para o código de main: só cria duas tabelas vazias e três funções novas.
--
-- O que faz:
--   1. yt_own_video_versions: versões de título, thumbnail e descrição, derivadas de yt_own_video_meta_daily.
--   2. yt_own_versions_state: até que dia cada canal já foi derivado.
--   3. RLS nas duas (can_view_private_site se a MG11 já existir; senão can_edit_site). Sem policy de escrita.
--   4. yt_own_versions_apply_day: grava UM canal e UM dia numa transação. Só service_role.
--   5. yt_own_versions_seed_pre: versões reconstruídas do A/B Lab, anteriores ao registro. Só service_role.
--   6. yt_own_versions_prova: a prova diária (item 200). Só leitura. Só service_role.
-- youtube_channel_removal_impact NÃO é recriada: o corpo por catálogo já soma toda tabela presa ao canal
-- por FK "on delete restrict"; as duas daqui entram sozinhas. A migration recusa se o corpo não for esse.
-- =============================================================================
set lock_timeout = '5s';

do $$ begin
  if to_regclass('public.yt_own_video_meta_daily') is null then
    raise exception 'MG12 depende da coleta L1a: public.yt_own_video_meta_daily não existe.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'youtube_channel_removal_impact'
      and p.prosrc like '%pg_catalog.pg_constraint%'
  ) then
    raise exception 'MG12 depende do corpo por catálogo de youtube_channel_removal_impact (MG9 ou MG14). Aplique uma delas antes.';
  end if;
end $$;

-- ── 1. Versões ──────────────────────────────────────────────────────────────
create table if not exists public.yt_own_video_versions (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{1,32}$'),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  field text not null check (field in ('title', 'thumb', 'desc')),
  value_text text,                                -- título ou descrição; nulo na thumbnail
  value_hash text not null check (value_hash ~ '^[0-9a-f]{16,64}$'),
  thumb_dhash text,
  thumb_anchor_dhash text,                        -- dHash da última troca cheia: a âncora da comparação
  thumb_sha256 text,
  thumb_blob_url text,
  thumb_similar boolean not null default false,   -- bytes mudaram, imagem quase igual (retoque)
  first_day_pt date not null,                     -- dia da linha diária em que foi vista pela primeira vez
  last_day_pt date not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  window_start timestamptz,                       -- a troca aconteceu entre window_start e window_end
  window_end timestamptz,
  window_precision text not null check (window_precision in ('first', 'min', '1d', 'lacuna')),
  origin text not null check (origin in ('linha_de_base', 'ab_lab', 'fora_do_sistema', 'nao_se_sabe', 'cms')),  -- 'cms' reservado, sem uso
  ab_event text check (ab_event is null or ab_event in ('rotacao', 'vencedor', 'restauro')),
  ab_test_id uuid,                                -- sem FK: o teste pode ser apagado, a versão fica
  ab_variant_id uuid,
  pre_registro boolean not null default false,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  constraint yovv_dias check (last_day_pt >= first_day_pt),
  constraint yovv_instantes check (last_seen_at >= first_seen_at),
  constraint yovv_janela check (
    (window_precision = 'first') = (window_start is null)
    and (window_start is null) = (window_end is null)
    and (window_end is null or window_end >= window_start)),
  constraint yovv_evento check ((origin = 'ab_lab') = (ab_event is not null)),
  constraint yovv_base check ((window_precision = 'first') = (origin = 'linha_de_base')),
  constraint yovv_min check ((window_precision = 'min') = (origin = 'ab_lab')),
  constraint yovv_thumb check (
    case when field = 'thumb'
      then thumb_dhash is not null and thumb_anchor_dhash is not null and value_text is null
           and value_hash = thumb_dhash and (thumb_similar or thumb_anchor_dhash = thumb_dhash)
           and not (thumb_similar and origin = 'linha_de_base')
      else thumb_dhash is null and thumb_anchor_dhash is null and thumb_sha256 is null
           and thumb_blob_url is null and not thumb_similar
    end),
  constraint yovv_titulo check (field <> 'title' or value_text is not null),
  constraint yovv_pre check (not pre_registro or (not is_current and origin = 'ab_lab' and field = 'title'))
);
create unique index if not exists idx_yovv_one_current
  on public.yt_own_video_versions (youtube_video_id, field) where is_current;
create unique index if not exists idx_yovv_dia          -- o mesmo dia não abre duas versões do mesmo campo
  on public.yt_own_video_versions (youtube_video_id, field, first_day_pt) where not pre_registro;
create unique index if not exists idx_yovv_pre
  on public.yt_own_video_versions (youtube_video_id, field, first_seen_at) where pre_registro;
create index if not exists idx_yovv_canal
  on public.yt_own_video_versions (channel_id, youtube_video_id, field, first_seen_at);
create index if not exists idx_yovv_canal_corrente
  on public.yt_own_video_versions (channel_id) where is_current;
create index if not exists idx_yovv_site on public.yt_own_video_versions (site_id);

-- ── 2. Estado da derivação, por canal ───────────────────────────────────────
create table if not exists public.yt_own_versions_state (
  channel_id uuid primary key references public.youtube_channels(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete cascade,
  tracking_since date not null,                   -- primeiro dia derivado: o "registro desde" do canal
  derived_through date not null,                  -- último dia já derivado
  updated_at timestamptz not null default now(),
  constraint yovs_ordem check (derived_through >= tracking_since)
);

-- ── 3. RLS: leitura por quem tem o direito de ver o dado privado; escrita só por service role ──
alter table public.yt_own_video_versions enable row level security;
alter table public.yt_own_versions_state enable row level security;
do $$
declare
  v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                    then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
  t text;
begin
  foreach t in array array['yt_own_video_versions', 'yt_own_versions_state'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (%s)', t || '_select', t, v_fn);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;

-- ── 4. Grava UM canal e UM dia. Recusa dia repetido (reexecução segura) e nunca deixa o dia pela metade ──
create or replace function public.yt_own_versions_apply_day(
  p_channel_id uuid, p_site_id uuid, p_day date, p_touch jsonb, p_open jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_through date;
  v_touch jsonb := coalesce(p_touch, '[]'::jsonb);
  v_open jsonb := coalesce(p_open, '[]'::jsonb);
  v_touched integer := 0;
  v_opened integer := 0;
  v_closed integer;
  r record;
  v_m record;
begin
  if p_channel_id is null or p_site_id is null or p_day is null then
    raise exception 'argumento_nulo';
  end if;
  if jsonb_typeof(v_touch) <> 'array' or jsonb_typeof(v_open) <> 'array' then
    raise exception 'argumento_invalido';
  end if;
  if not exists (select 1 from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception 'canal_fora_do_site';
  end if;
  if p_day >= (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'dia_nao_fechado';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('yt_own_versions:' || p_channel_id::text, 0));
  select s.derived_through into v_through from public.yt_own_versions_state s where s.channel_id = p_channel_id;
  if found and p_day <= v_through then
    return jsonb_build_object('resultado', 'ja_derivado', 'derived_through', v_through);
  end if;

  -- Confirma o que não mudou. Não exige linha diária do dia: a dieta (MG17) confirmará pela cobertura.
  update public.yt_own_video_versions v
     set last_day_pt = p_day, last_seen_at = t.seen_at
    from jsonb_to_recordset(v_touch) as t(id uuid, seen_at timestamptz)
   where v.id = t.id and v.channel_id = p_channel_id and v.site_id = p_site_id
     and v.is_current and not v.pre_registro and v.last_day_pt < p_day and t.seen_at is not null;
  get diagnostics v_touched = row_count;
  if v_touched <> jsonb_array_length(v_touch) then
    raise exception 'touch_recusado';
  end if;

  for r in
    select * from jsonb_to_recordset(v_open) as x(
      youtube_video_id text, video_id uuid, field text, value_text text, value_hash text,
      thumb_dhash text, thumb_anchor_dhash text, thumb_sha256 text, thumb_blob_url text, thumb_similar boolean,
      first_seen_at timestamptz, seen_at timestamptz, window_start timestamptz, window_end timestamptz,
      window_precision text, origin text, ab_event text, ab_test_id uuid, ab_variant_id uuid)
  loop
    -- Abrir versão exige a linha diária do vídeo, deste canal e deste site, neste dia.
    select m.video_id, m.thumbnail_dhash, m.thumbnail_sha256_at_capture, m.thumbnail_blob_url into v_m
      from public.yt_own_video_meta_daily m
     where m.youtube_video_id = r.youtube_video_id and m.day_pt = p_day
       and m.channel_id = p_channel_id and m.site_id = p_site_id;
    if not found then
      raise exception 'sem_linha_do_dia';
    end if;
    -- (emenda 1: S-I6) Chave ausente em p_open chega nula sem erro. A abertura tem de casar com a linha do dia.
    if r.video_id is distinct from v_m.video_id
       or (r.field = 'thumb' and (r.thumb_dhash is distinct from v_m.thumbnail_dhash
             or r.thumb_sha256 is distinct from v_m.thumbnail_sha256_at_capture
             or r.thumb_blob_url is distinct from v_m.thumbnail_blob_url))
       or (r.origin = 'ab_lab' and (r.ab_test_id is null or (r.ab_event = 'rotacao' and r.ab_variant_id is null))) then
      raise exception 'abertura_invalida';
    end if;
    update public.yt_own_video_versions v set is_current = false
     where v.youtube_video_id = r.youtube_video_id and v.field = r.field
       and v.channel_id = p_channel_id and v.is_current;
    get diagnostics v_closed = row_count;
    -- Linha de base só onde não havia corrente; troca só onde havia.
    if (v_closed = 0) is distinct from (r.origin = 'linha_de_base') then
      raise exception 'linha_de_base_incoerente';
    end if;
    insert into public.yt_own_video_versions (
      youtube_video_id, site_id, video_id, channel_id, field, value_text, value_hash,
      thumb_dhash, thumb_anchor_dhash, thumb_sha256, thumb_blob_url, thumb_similar,
      first_day_pt, last_day_pt, first_seen_at, last_seen_at, window_start, window_end, window_precision,
      origin, ab_event, ab_test_id, ab_variant_id, pre_registro, is_current
    ) values (
      r.youtube_video_id, p_site_id, r.video_id, p_channel_id, r.field, r.value_text, r.value_hash,
      r.thumb_dhash, r.thumb_anchor_dhash, r.thumb_sha256, r.thumb_blob_url, coalesce(r.thumb_similar, false),
      p_day, p_day, r.first_seen_at, r.seen_at, r.window_start, r.window_end, r.window_precision,
      r.origin, r.ab_event, r.ab_test_id, r.ab_variant_id, false, true
    );
    v_opened := v_opened + 1;
  end loop;

  insert into public.yt_own_versions_state (channel_id, site_id, tracking_since, derived_through)
  values (p_channel_id, p_site_id, p_day, p_day)
  on conflict (channel_id) do update set derived_through = excluded.derived_through, updated_at = now();

  return jsonb_build_object('resultado', 'ok', 'confirmadas', v_touched, 'abertas', v_opened, 'derived_through', p_day);
end;
$$;
revoke all on function public.yt_own_versions_apply_day(uuid, uuid, date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_versions_apply_day(uuid, uuid, date, jsonb, jsonb) to service_role;

-- ── 5. Semente: títulos de ciclos do A/B Lab anteriores ao início do registro. Nunca versão corrente ──
create or replace function public.yt_own_versions_seed_pre(
  p_channel_id uuid, p_site_id uuid, p_rows jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_since date;
  v_rows jsonb := coalesce(p_rows, '[]'::jsonb);
  v_ins integer := 0;
  v_n integer;
  r record;
begin
  if p_channel_id is null or p_site_id is null or jsonb_typeof(v_rows) <> 'array' then
    raise exception 'argumento_invalido';
  end if;
  if not exists (select 1 from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id) then
    raise exception 'canal_fora_do_site';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_versions:' || p_channel_id::text, 0));
  select s.tracking_since into v_since from public.yt_own_versions_state s where s.channel_id = p_channel_id;
  if not found then
    raise exception 'sem_estado';
  end if;

  for r in
    select * from jsonb_to_recordset(v_rows) as x(
      youtube_video_id text, video_id uuid, value_text text, value_hash text,
      first_seen_at timestamptz, last_seen_at timestamptz, ab_event text, ab_test_id uuid, ab_variant_id uuid)
  loop
    -- (emenda 1: D-m9) nem o início nem o fim do ciclo podem cair no período registrado.
    if r.first_seen_at is null or r.last_seen_at is null
       or (r.first_seen_at at time zone 'America/Los_Angeles')::date >= v_since
       or (r.last_seen_at at time zone 'America/Los_Angeles')::date >= v_since then
      raise exception 'fora_do_pre_registro';
    end if;
    if not exists (select 1 from public.youtube_videos v
                    where v.youtube_video_id = r.youtube_video_id and v.channel_id = p_channel_id) then
      raise exception 'video_fora_do_canal';
    end if;
    insert into public.yt_own_video_versions (
      youtube_video_id, site_id, video_id, channel_id, field, value_text, value_hash,
      first_day_pt, last_day_pt, first_seen_at, last_seen_at, window_start, window_end, window_precision,
      origin, ab_event, ab_test_id, ab_variant_id, pre_registro, is_current
    ) values (
      r.youtube_video_id, p_site_id, r.video_id, p_channel_id, 'title', r.value_text, r.value_hash,
      (r.first_seen_at at time zone 'America/Los_Angeles')::date,
      (r.last_seen_at at time zone 'America/Los_Angeles')::date,
      r.first_seen_at, r.last_seen_at, r.first_seen_at, r.first_seen_at, 'min',
      'ab_lab', r.ab_event, r.ab_test_id, r.ab_variant_id, true, false
    )
    on conflict (youtube_video_id, field, first_seen_at) where pre_registro do nothing;
    get diagnostics v_n = row_count;
    v_ins := v_ins + v_n;
  end loop;

  return jsonb_build_object('resultado', 'ok', 'inseridas', v_ins, 'ja_existiam', jsonb_array_length(v_rows) - v_ins);
end;
$$;
revoke all on function public.yt_own_versions_seed_pre(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_versions_seed_pre(uuid, uuid, jsonb) to service_role;

-- ── 6. Prova diária (item 200). Só leitura ──────────────────────────────────
-- Vídeo público = último privacy_status conhecido igual a 'public' (C0.11), ainda cadastrado em youtube_videos.
-- (emenda 1: D-m1, D-m2, S-m2) Explica a ausência, POR CAMPO, uma tentativa com outcome diferente de 'ok' desde p_ontem.
-- attempt_day é o dia UTC da execução: as execuções que conferem os dias p_ontem - 1 e p_ontem rodam em p_ontem e p_ontem + 1.
--   título: tentativa 'meta' do vídeo, ou tentativa 'meta' do canal do vídeo (a falha da videos.list fica no canal).
--   thumbnail: tentativa 'thumbnail' do vídeo, ou 'meta' do vídeo (linha que não foi gravada não tem imagem).
create or replace function public.yt_own_versions_prova(p_site_id uuid, p_ontem date)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with ult as (
    select distinct on (m.youtube_video_id) m.youtube_video_id, m.privacy_status
      from public.yt_own_video_meta_daily m
     where m.site_id = p_site_id and m.privacy_status is not null
     order by m.youtube_video_id, m.day_pt desc
  ), pub as (
    select distinct u.youtube_video_id, v.channel_id
      from ult u
      join public.youtube_videos v on v.youtube_video_id = u.youtube_video_id
      join public.youtube_channels c on c.id = v.channel_id and c.site_id = p_site_id
     where u.privacy_status = 'public'
  ), f as (
    select p.youtube_video_id,
           not exists (select 1 from public.yt_own_video_versions x
                        where x.site_id = p_site_id and x.youtube_video_id = p.youtube_video_id
                          and x.field = 'title' and x.is_current and x.last_day_pt >= p_ontem - 1) as sem_titulo,
           not exists (select 1 from public.yt_own_video_versions x
                        where x.site_id = p_site_id and x.youtube_video_id = p.youtube_video_id
                          and x.field = 'thumb' and x.is_current and x.last_day_pt >= p_ontem - 1) as sem_thumb,
           exists (select 1 from public.yt_own_collection_attempts a
                    where a.site_id = p_site_id and a.kind = 'meta' and a.outcome <> 'ok'
                      and a.attempt_day >= p_ontem
                      and ((a.scope_type = 'video' and a.scope_id = p.youtube_video_id)
                        or (a.scope_type = 'canal' and a.scope_id = p.channel_id::text))) as motivo_titulo,
           exists (select 1 from public.yt_own_collection_attempts a
                    where a.site_id = p_site_id and a.scope_type = 'video' and a.scope_id = p.youtube_video_id
                      and a.kind in ('meta', 'thumbnail') and a.outcome <> 'ok'
                      and a.attempt_day >= p_ontem) as motivo_thumb
      from pub p
  )
  select jsonb_build_object(
    'publicos', (select count(*) from pub),
    'sem_titulo', (select count(*) from f where f.sem_titulo),
    'sem_thumb', (select count(*) from f where f.sem_thumb),
    'sem_explicacao', (select count(*) from f
                        where (f.sem_titulo and not f.motivo_titulo) or (f.sem_thumb and not f.motivo_thumb)),
    'canais_com_linha_sem_estado', (
      select count(*) from public.youtube_channels c
       where c.site_id = p_site_id
         and exists (select 1 from public.yt_own_video_meta_daily m where m.channel_id = c.id)
         and not exists (select 1 from public.yt_own_versions_state s where s.channel_id = c.id)),
    'derivado_ate', (select min(s.derived_through) from public.yt_own_versions_state s where s.site_id = p_site_id),
    'origem_cms', (select count(*) from public.yt_own_video_versions x where x.site_id = p_site_id and x.origin = 'cms')
  );
$$;
revoke all on function public.yt_own_versions_prova(uuid, date) from public, anon, authenticated;
grant execute on function public.yt_own_versions_prova(uuid, date) to service_role;
```

**Pontos que a Tarefa 1 confere ao rodar (dúvidas de quem escreveu sem poder rodar):** (a) `youtube_videos` tem as colunas `youtube_video_id` e `channel_id` com esses nomes (o código do passo de metadados as usa; conferir no banco); (b) `gen_random_uuid()` e `hashtextextended` estão disponíveis sem prefixo de schema com `search_path = ''` (são de `pg_catalog`; se o banco acusar, prefixar com `pg_catalog.`); (c) o `on conflict … where pre_registro` casa com o índice `idx_yovv_pre`; (d) a comparação `(v_closed = 0) is distinct from (r.origin = 'linha_de_base')` recusa também origem nula (com `origin` nulo o lado direito é nulo, a comparação dá verdadeiro e a função lança); (e) (emenda 1) `yt_own_collection_attempts.scope_id` é texto e, nas tentativas de escopo `canal`, guarda o uuid do canal (`meta-step.ts:218`): a comparação `a.scope_id = p.channel_id::text` depende disso, e o S16b prova; (f) (emenda 1) `select … into v_m` com `v_m record` seguido de `if not found` é a forma usada; se a linha diária do dia tiver `thumbnail_blob_url` repetida da véspera, a abertura traz a mesma URL (o fato do dia é montado da própria linha), e o S17 confere que uma abertura legítima passa.

### Apêndice B: desfazer a MG12 (só o dono, só se pedido, só antes da MG17)

Apaga as versões e o estado. Enquanto `yt_own_video_meta_daily` estiver inteira, o passo deriva tudo de novo na execução seguinte; as linhas da semente do A/B Lab têm de ser semeadas de novo.

```sql
drop function if exists public.yt_own_versions_prova(uuid, date);
drop function if exists public.yt_own_versions_seed_pre(uuid, uuid, jsonb);
drop function if exists public.yt_own_versions_apply_day(uuid, uuid, date, jsonb, jsonb);
drop table if exists public.yt_own_versions_state;
drop table if exists public.yt_own_video_versions;
```
