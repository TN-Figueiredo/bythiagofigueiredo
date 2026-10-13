# A5, ordem 11 — E11: canal próprio em tabelas (plano de implementação)

Escrito em 12/10/2026 (noite) e **emendado no mesmo dia, depois do portão** (ver "Emenda do portão", logo abaixo). Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md`, seção 7.3 e itens de aceite 83 a 93, 226 a 228 e 249; obrigações de plano OP-8 e OP-13. Migration: **MG7** (lote C).

**Objetivo, em três frases.** Passar a guardar em tabelas, por vídeo e por dia, de onde vêm as views do canal próprio (origem, aparelho e sistema, país, inscrito ou não), o detalhe da origem (termo pesquisado, site externo, vídeo ou canal que sugeriu) e as impressões por origem e por aparelho. As quatro primeiras famílias vêm da Analytics API, num passo diário novo ("dimensões"); as duas últimas vêm dos relatórios em lote que a E12 já baixa e a E20 já guarda, por dois normalizadores novos. A coleta é só para a frente (decisão 32): nada é pedido ao YouTube com data anterior ao dia do deploy menos 10 dias, e tudo o que é anterior lê "não medido: a coleta começou em dd/mm".

**Fica FORA deste plano.**
- **As telas** (seções "De onde vêm as views", "O que pesquisaram e de que sites vieram", "Em que aparelho", "De que país", "Inscritos e não inscritos", e as linhas novas do cartão "Só o seu canal mede"): esperam o **mockup 12** aprovado pelo dono. O item 93 (ver em navegador) fica com elas. Aqui só entram o modelo puro dos três estados e o leitor de servidor, sem nenhum componente.
- Retroação (decisão 32), linha de mês ou de ano (não existe `period_days`), impressões por termo de pesquisa em tabela (ficam no bruto), demografia, diário ampliado.
- A MG14 e o código da dieta (E6 P1 e P2): são do plano das ordens 8 e 10 (`docs/superpowers/plans/2026-10-12-a5-e6-e8-dieta-e-retencao-plan.md`). Este plano **depende** deles (seção 0).
- A pergunta 38 do spec (o Cowork já lê termos de pesquisa ao vivo por `youtube_analytics.get_search_terms`): não muda aqui.
- Nenhuma rota nova em `api/pipeline/`; nada em `docs/cowork-*`, `apps/web/data/pipeline-docs/` nem em `lib/pipeline/api-registry.ts`.

---

## Emenda do portão (12/10/2026, fim da noite)

Os dois especialistas **reprovaram** a primeira versão: dados com 1 crítico, 6 importantes e 8 menores (`.superpowers/sdd/a5/revisao-plano-e11-canal-proprio-em-tabelas-dados.md`); software com 1 crítico, 7 importantes, 11 menores e 2 de texto (`…-software.md`). Esta versão aplica os 2 críticos (que são o mesmo defeito, visto pelos dois), os 13 importantes (um deles só em parte: decisão 3 abaixo) e os 21 menores, e as decisões R1 a R10 do controlador. Cada trecho mudado traz `(emenda do portão: <parecer> <código>)`; os códigos do parecer de dados têm hífen (C-1, I-1, m-1) e os do de software não (C1, I1, m1). A resposta achado por achado está em `.superpowers/sdd/a5/resposta-revisao-plano-e11-canal-proprio-em-tabelas.md`. O SQL emendado foi **rodado de novo, duas vezes**, contra a **MG14 real** (o texto do Apêndice A do plano das ordens 8 e 10), não mais contra um stub: seção 11.

**Decisões da emenda** (onde os dois pareceres pedem coisas diferentes, ou onde não fiz o que o parecer pediu):

1. **C-1 e C1 (país preso no dia com view): o conserto é o do parecer de software, uma chamada só por vídeo e família.** O de dados pedia uma chamada por trecho contíguo sem view; o de software, juntar as linhas de todos os dias consultados e chamar `yt_own_dim_apply` uma vez com a janela inteira. Os dois dão a mesma cobertura (rodei o de software: seção 11, S5 e S6). Escolhi o de software porque é uma ida ao banco em vez de várias e porque deixa a cobertura contígua por construção, o que resolve o I-5 do parecer de dados sem regra a mais: o último dia coberto é o dia anterior ao primeiro dia com view que não foi respondido.
2. **I3 de software contra m-2 de dados (vídeo com a `base` parada):** os dois pedem que a prova pare de contar esse vídeo; um propõe "base anterior à data de partida" (`p_desde`), o outro "base parada há mais de 30 dias". Vale `p_desde`: é a condição exata em que `yt_own_dim_cover_idle` não tem o que cobrir. Com a base parada **depois** da data de partida a função cobre até a base e a prova fecha sozinha (rodado: S4).
3. **`videos_sem_base` não fica vermelho por vídeo isolado (discordo do I3 de software em parte).** A carência de 4 dias para vídeo recém-publicado entrou no SQL, como pedido. Mas o vídeo antigo que a Analytics API nunca devolve (privado, apagado) ficaria vermelho para sempre aqui **e** no critério de cobertura da dieta, que é o dono desse alarme e que o plano das ordens 8 e 10, já emendado, manda para "ação do dono" depois de 3 dias vermelho (achado I4 do parecer de dados daquele plano). Dois alarmes para a mesma causa, um deles eterno, esconderiam as outras falhas. Regra desta etapa: vermelho só quando **nenhum** vídeo do site tem `base` (a dieta não está no ar); com `base` em algum vídeo, o número vai no resumo e o alarme é o da dieta. O caminho até o vermelho e os testes nos dois sentidos estão na Tarefa 9.
4. **R1: a MG7 traz o corpo por catálogo de `youtube_channel_removal_impact`, igual ao da MG14 byte a byte**, e não uma lista de tabelas (o I1 de software pedia acrescentar quatro nomes à lista: superado pela decisão do controlador). As três tabelas daqui entram sozinhas, pela chave `on delete restrict`; o plano dono diz que "na prática nem precisa trazer", e eu trago assim mesmo, porque o item 93 é desta etapa e o bloco reaplicado devolve a função ao certo se outra migration a tiver trocado no meio do caminho (rodado: S12). Rodado em quatro ordens de aplicação: mesmo corpo, mesmo número.
5. **Posse dos arquivos divididos com a E6, a E8 e a E18** (os pareceres daqui não fecham isso; o parecer de software do plano das ordens 8 e 10 pede, no I-9 dele, e aquele plano, **já emendado**, escreve a resposta: li a versão das 23:36 de 12/10). Vale o que está lá: `coleta/passos-desligados.ts` e o teste dele, `coleta/kinds.ts`, `coleta/motivo.ts`, `coleta/criteria-desligados.ts` e o objeto `TETOS_DE_FIM_MS` de `clock.ts` **são da Tarefa 2 daquele plano** (ordem menor), e **já nascem com o que é da E11**: os nomes `dimensoes` e `normalizadores` no interruptor, os três `kind` no catálogo, e `dimensoes: 30_000` e `normalizadores: 20_000` nos tetos de fim. Este plano **não abre nenhum desses arquivos**: confere que existem. A ordem dos passos e dos critérios no cron é a que aquele plano escreve uma vez (seção 4 daqui a repete).
6. **Passo desligado e esquecido** (I-7 do mesmo parecer, que cita este plano): não fica verde para sempre. Vale a regra do plano das ordens 8 e 10: até a 7ª execução seguida desligado, só nota em `acao_do_dono`; **da 8ª em diante, cron vermelho**. O critério (`criterioDesligados`, em `coleta/criteria-desligados.ts`) é dele; a Tarefa 10 daqui só põe os dois nomes na lista que ele recebe.
7. **m-3 de dados ("em revisão" sem fim) entrou no SQL**, embora o parecer o desse como opcional: custa três linhas, foi rodado (S7) e tira o risco 4 da primeira versão.

**O que pode começar JÁ**, sem esperar migration, mockup nem resposta do dono: as Tarefas **2, 3, 4, 5, 6** (módulos puros e configuração: nenhuma delas cria arquivo que seja de outro plano), depois **9 e 11** (os critérios, o modelo e o leitor: escrevem contra o contrato da MG7 que está neste plano e testam com banco falso), e a **0b** (leitura, com o token por injeção). As Tarefas **7 e 8** (os dois passos) começam assim que a Tarefa 2 do plano das ordens 8 e 10 estiver commitada: elas importam o catálogo de motivos dela (`coleta/motivo.ts`). A **10** (integração) espera as anteriores e a mesma Tarefa 2. Esperam o lote C: a **1** (o arquivo da migration) e a **12** (testes contra o banco). Esperam mockup: as telas, que não são deste plano.

---

## 0. Dependências duras (ler antes de tudo)

### 0.1 O que este plano usa da MG14 (agora conferido contra o texto real)

**(emenda do portão: dados I-6; software "não consegui verificar")** A primeira versão foi rodada contra um stub. A MG14 já existe como texto final, no Apêndice A do plano das ordens 8 e 10; esta emenda rodou a MG7 contra **esse texto** (seção 11). Ela ainda não existe como **arquivo** de migration (nenhum arquivo do lote C é criado antes da vez do lote: decisão R2), e o plano dono pode mudá-la na emenda dele. Por isso a Tarefa 1 repete a prova contra o arquivo real, como condição de saída.

| O que uso | Forma exata, lida no texto da MG14 | Onde uso |
|---|---|---|
| Tabela `public.yt_own_video_coverage` | colunas `youtube_video_id text`, `metric_set text`, `covered_from date`, `covered_to date`, `site_id uuid not null`, `video_id uuid` (anulável), `channel_id uuid not null … on delete restrict`, `source text`, `collected_at timestamptz`; chave primária `(youtube_video_id, metric_set, covered_from)`; índice `(channel_id, metric_set, covered_to)` | as seis funções da MG7; o passo; o leitor |
| `check` de `metric_set` | aceita `'base'`, `'estendidas'`, `'trafego'`, `'dispositivo'`, `'pais'`, `'inscrito'`, `'detalhe'`, `'alcance_dim'`, `'meta_texto'`, `'meta_thumb'` | gravo os seis da E11; **leio** `'base'` |
| `check` de `source` da cobertura | aceita `'analytics_api'` e `'reporting_api'` | gravo os dois |
| Semântica do conjunto `'base'` | `covered_to` = último dia que o diário **devolveu**. **A `base` pode ter buraco** (a função da dieta parte o intervalo quando falta um dia) e **nasce quando o diário devolve o primeiro dia**, não no cadastro do vídeo | o teto da cobertura das dimensões; a regra de leitura "coberto" (Tarefa 11, emenda I-2); a carência de 4 dias de `videos_sem_base` (Apêndice A, 5f) |
| `check` de `yt_own_collection_attempts.kind` | `kind ~ '^[a-z0-9_]{1,40}$'` | gravo `dimensoes`, `normalizador_trafego`, `normalizador_alcance_dim` |
| Catálogo de `kind` no código | `COLLECTION_KINDS` em `coleta/kinds.ts`, criado pela Tarefa 2 do plano das ordens 8 e 10 **já com os três valores da E11** (decisão 5 da emenda); `registrarTentativa` com `kind` fora do catálogo não chama o banco | os dois passos gravam tentativa com esses `kind`; este plano não edita o catálogo |
| `youtube_channel_removal_impact` | corpo **por catálogo**: soma toda tabela de `public` com chave estrangeira `on delete restrict` para `youtube_channels` | a MG7 repete o mesmo bloco, entre as mesmas marcas (R1); Apêndice A, seção 6 |

**Não uso** `yt_own_daily_apply` nem nenhuma outra função da MG14. A fusão de intervalos da cobertura é feita por uma função própria da MG7 (`yt_own_dim_coverage_extend`), de nome exclusivo. O conserto que o parecer de dados pediu em `yt_own_daily_apply` (recusar dia sem `views`) não muda nada do que uso.

**Duas dependências que não são de arquivo:**
1. **O código da E6 P2 em produção** (o diário gravando a cobertura `base` todo dia). Sem ele, a `base` para no dia em que a MG14 foi aplicada e a cobertura das dimensões para com ela. **(emenda do portão: software m11)** Isso prende só o passo "dimensões": os normalizadores não leem a `base`. Se o lote C estiver aplicado e a E6 P2 ainda não estiver em produção, o lote da E11 vai com `dimensoes` desligado (Tarefa 14).
2. **A MG13 aplicada** (já está, decisão 49) **antes** de qualquer normalizador: normalizar punha o bruto no relógio de 90 dias; com a MG13 a função de apagar devolve 0.

### 0.2 Uma conferência de leitura que falta (C0.2b), e o que ela decide

A C0.2 testou só a família **país**. As outras três consultas do passo (`day,insightTrafficSourceType`; `day,deviceType,operatingSystem`; `day,subscribedStatus`, todas com `filters=video==<id>`) **não foram chamadas**; o spec as dá como aceitas e eu não medi. A Tarefa 0b faz as três chamadas (só `GET`, a mesma credencial e o mesmo procedimento da C0.2, autorizados na decisão 56; **o token é renovado em memória e nunca gravado**: decisão R6) e guarda as respostas como fixture. **O plano não depende do resultado para começar:** o cliente (Tarefa 5) nasce com dois modos por família, `com_dia` (uma consulta por vídeo para a janela) e `por_dia` (uma consulta por vídeo e dia, como o país). Se alguma der 400, a família passa a `por_dia` trocando uma constante; o que muda é a conta de chamadas (seção 5).

### 0.3 Avisos de topo
- **Nenhuma rota nova de pipeline.** Nada a registrar em `api-registry.ts`.
- **Termos de pesquisa são dado privado e podem ser nome de pessoa.** Nenhum log, nota de `falhas`, evento do Sentry ou fixture deste plano leva o conteúdo de `traffic_source_detail`. As fixtures têm o detalhe mascarado.
- **As migrations só vão ao dono depois do acordo dos dois especialistas** sobre este plano (decisão 45).
- **(emenda do portão: R2)** O arquivo da MG7 **não é criado antes da vez do lote C**. O `db:new` carimba pela hora, e um arquivo criado cedo entraria no próximo `db:push:prod` de outro lote. Até lá o SQL vive no Apêndice A deste plano e a prova dele é o roteiro `.superpowers/sdd/a5/plano-e11-emenda-prova.sql`.
- **(emenda do portão: R6)** Nenhum ensaio ou script deste plano grava em produção. O caminho `obterToken → ensureFreshToken` **grava o token renovado em produção**: a Tarefa 0b e a Tarefa 13 recebem o token por injeção (renovado em memória, nunca persistido), ou não rodam.
- **(emenda do portão: R10)** Tudo o que este plano avisa ao dono é **cron vermelho** (a nota entra em `falhas` e a rota grava a falha). Não há push nem sino.
- **(emenda do portão: R8)** A Analytics API e a Reporting API usam o token no cabeçalho `Authorization`, não `key=` na URL: o conserto da redação da chave no Sentry (feito fora dos planos) não é pré-requisito daqui. A exigência própria desta etapa é outra e continua: o termo pesquisado nunca vai ao Sentry (Tarefa 8).

---

## 1. Perguntas que só o dono responde

Nenhuma trava o início. Uma linha cada, com a recomendação e o padrão que vale se ele não responder (decisão 44). **(emenda do portão: as perguntas que as decisões R1 a R10 já respondem saíram; a posse dos arquivos divididos e o corpo da função de impacto não são mais perguntas.)**

1. **Qual é a cota diária da Analytics API** ("Queries per day" no console do Google Cloud)? Recomendo que ele olhe uma vez e o controlador anote. **Padrão:** o passo vai com teto próprio de 400 consultas por execução (hoje usa de 0 a 15), conta o que cortou e trata cota esgotada como falha visível.
2. **A coleta por API parte do dia do deploy menos 10 dias?** (pergunta 35 do spec). Recomendo que sim. **Padrão:** sim; a tela dirá "a coleta começou em dd/mm".
3. **Autoriza um ensaio do passo "dimensões" com a API real, gravando só no banco local, com o token renovado em memória e nunca gravado?** Recomendo que sim (é o que mede a latência e as três consultas que nunca foram chamadas). **Padrão:** o ensaio não é feito; a prova fica com as fixtures reais e com a leitura do primeiro cron em produção, e o passo tem interruptor.

---

## 2. O que é do dono

**Uma coisa: aplicar o lote C, do qual a MG7 é a quarta migration.** Nenhum agente roda `db:push:prod`. Produção está na versão `20261012000004` (lido em 12/10, 23:40 de São Paulo).

**(emenda do portão: R2)** Ordem de aplicação, fixada pelo controlador: lote B = MG10, MG9, MG8 (planos das ordens 5 e 6); **lote C = MG14, MG11, MG5, MG7, MG12**. A MG7 depende da MG14 (recusa sem ela) e convive com a MG11 antes ou depois (a policy se ajusta: V2).

| Passo | Quem | O quê |
|---|---|---|
| 1 | controlador | avisa que chegou a vez do lote C e que o arquivo da MG14 já existe |
| 2 | agente (Tarefa 1) | `npm run db:new observatorio_a5_e11_canal_proprio_em_tabelas`, **depois** dos arquivos da MG14, da MG11 e da MG5 (o carimbo tem de ser posterior ao dos três), cola o Apêndice A, confere o corpo da função de impacto letra por letra contra o arquivo da MG14, roda o roteiro de prova duas vezes. Commit local |
| 3 | **dono** | `npm run db:push:prod` (digita `YES`), uma vez, com as cinco do lote C |
| 4 | agente | V1 a V4 em produção (só leitura), resultado no ledger `.superpowers/sdd/a5-e11/progress.md` |
| 5 | agente | push do código (Tarefa 14), promoção fora de 11:55 a 12:15 UTC |

**Nome para o `db:new`:** `observatorio_a5_e11_canal_proprio_em_tabelas`. Uma migration só.

**Janela.** A MG7 cria três tabelas vazias e seis funções, e reafirma o corpo de `youtube_channel_removal_impact` (o mesmo que a MG14 acabou de instalar: não muda nada). Não pede trava em tabela com tráfego. Pode ser aplicada a qualquer hora; por hábito, fora de 11:55 a 12:15 UTC (cron da coleta). `set lock_timeout = '5s'` na primeira linha.

**Convive com o código que está em `main`?** Sim, nos dois sentidos, conferido:
- **MG7 aplicada, código antigo:** ninguém lê nem grava as tabelas novas. `youtube_channel_removal_impact` mantém assinatura, privilégios e as 16 chaves do retorno. As três tabelas nascem vazias, então `serie_coletada` não muda até o código novo gravar.
- **Código novo sem a MG7 (ou sem a MG14):** os dois passos novos conferem o schema antes (`schemaE11`, Tarefa 6) e **param em vermelho sem chamar a API nem gravar nada**: nota `schema_ausente: MG7 não aplicada (yt_own_dim_prova)` ou `schema_ausente: MG14 não aplicada (yt_own_video_coverage)`. Os passos antigos seguem.
- **MG7 sem a MG14:** a migration **recusa** na terceira instrução, com a mensagem "MG7 depende da MG14", e não cria nada (rodado duas vezes: seção 11).

**A função de impacto (emenda do portão: R1; software I1).** Três planos a recriavam com três corpos (lista de dez tabelas na MG9, catálogo na MG14, lista de treze na MG7), e a ordem de aplicação apagava tabelas de um no outro: a lista da MG7 tirava da soma as quatro tabelas que a MG9 tinha acabado de somar. Vale **um corpo só, o por catálogo**: `serie_coletada` soma toda tabela de `public` com chave estrangeira `on delete restrict` para `youtube_channels`. O plano das ordens 8 e 10 é o dono do texto; a MG7 traz **o bloco entre as marcas `-- >>> corpo único` e `-- <<< corpo único`** do Apêndice A dele, sem mudar um byte: 76 linhas com as duas marcas, `sha256` = `83daff580903450b98a6ee480f5b098067f03eb1595233ca67a1268746f47ac6` (o mesmo número que aquele plano escreve; conferido nesta emenda contra a versão dele das 23:38 de 12/10, já emendada). Depois de aplicada, `md5(prosrc)` = `4827d5ad12a0120b52ebc1280491b00c` (rodado; é a V7 daquele plano). Se aquele plano mudar o bloco, a Tarefa 1 copia de novo e roda de novo; o fecho confere a igualdade.

### Consultas de conferência (rodadas no banco local em 12/10, com a MG14 real e a MG7 emendada aplicadas, duas vezes)

**V1: a migration entrou inteira?** Esperado depois de aplicar: **3, 3, 3, 6, 0, 4**. (Em produção, hoje, antes: 0, 0, 0, 0, 0, 0.)

```sql
select (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname in ('yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily')) as tabelas_com_rls_de_3, (select count(*) from pg_policies where schemaname = 'public' and tablename in ('yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily') and cmd = 'SELECT') as policies_de_3, (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('idx_yt_own_video_dim_daily_channel', 'idx_yt_own_traffic_detail_channel_day', 'idx_yt_own_reach_dim_channel_day')) as indices_de_3, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('yt_own_dim_coverage_extend', 'yt_own_dim_apply', 'yt_own_dim_cover_idle', 'yt_own_traffic_detail_apply', 'yt_own_reach_dim_apply', 'yt_own_dim_prova') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute')) as funcoes_so_service_role_de_6, (select count(*) from information_schema.columns where table_schema = 'public' and table_name in ('yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily') and column_name = 'period_days') as period_days_de_0, (select count(*) from information_schema.columns where table_schema = 'public' and table_name in ('yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily') and column_name in ('source_report_id', 'report_create_time') and is_nullable = 'NO') as not_null_de_4;
```

**V2: a policy é a certa para a ordem em que as migrations entraram?** Esperado **em produção: três linhas com `can_view_private_site(site_id)`**, porque a MG11 vem antes da MG7 no lote C. Se alguma vier com `can_edit_site(site_id)`, a MG11 não tinha entrado: avisar (a MG11, quando entrar, troca). Rodado nos dois casos.

```sql
select tablename, qual from pg_policies where schemaname = 'public' and tablename in ('yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily') order by 1;
```

**V3: a função de impacto conta as tabelas da E11 e continua por catálogo (rodar de novo depois de TODO o lote C). (emenda do portão: R1; software I1)** Esperado: `3`, `true` e `4827d5ad12a0120b52ebc1280491b00c`. Menos de 3 = uma tabela da E11 perdeu a chave `restrict`. `false` ou outro md5 = outra migration recriou a função com outro corpo por cima: reaplicar o bloco único. A consulta antiga só procurava três nomes no texto e dava `true` com a lista incompleta.

```sql
select (select count(*) from pg_catalog.pg_constraint k where k.contype = 'f' and k.confrelid = 'public.youtube_channels'::regclass and k.confdeltype = 'r' and cardinality(k.conkey) = 1 and k.conrelid in ('public.yt_own_video_dim_daily'::regclass, 'public.yt_own_video_traffic_detail_daily'::regclass, 'public.yt_own_video_reach_dim_daily'::regclass)) as tabelas_da_e11_presas_ao_canal_de_3, (select p.prosrc like '%pg_catalog.pg_constraint%' and p.prosrc not like '%yt_own_video_meta_daily%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'youtube_channel_removal_impact') as corpo_por_catalogo, (select md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'youtube_channel_removal_impact') as md5_do_corpo;
```
O `md5_do_corpo` de produção tem de ser igual ao do banco local depois do lote C inteiro (a Tarefa 1 anota o valor no ledger; hoje, antes do lote, produção e `main` têm `37214ca7d95f3bae16317115bfcf0dc3`, o corpo de lista de seis tabelas).

**V4: nada foi gravado pela migration e a prova roda.** Esperado logo depois de aplicar (código antigo no ar): `0, 0, 0` e um objeto com as **oito** chaves; `videos_com_base` = 35 e `faltando_cobertura` = **140** (4 conjuntos × os 35 vídeos, todos com `base` recente pela carga da MG14), porque nenhuma dimensão foi coletada ainda; `videos_sem_base` = 0; `base_ate` com data. Se `base_ate` vier nulo ou `videos_com_base` = 0, a MG14 não preencheu a cobertura: parar e avisar. `faltando_cobertura` só cai a 0 depois do primeiro cron com o código novo. **(emenda do portão: R5)** A prova recebe o site: em produção há um só.

```sql
select (select count(*) from public.yt_own_video_dim_daily) as dim, (select count(*) from public.yt_own_video_traffic_detail_daily) as detalhe, (select count(*) from public.yt_own_video_reach_dim_daily) as alcance_dim, public.yt_own_dim_prova((select site_id from public.youtube_channels where sync_enabled limit 1), (now() at time zone 'America/Los_Angeles')::date, (now() at time zone 'America/Los_Angeles')::date - 10) as prova;
```

---

## 3. Fatos medidos

Produção: `npx supabase db query --linked` (só `select`), 12/10/2026 entre 22:30 e 22:50 de São Paulo. Banco local: `bythiago_int` (porta 54422), tudo dentro de `begin; … rollback;`.

| # | Fato | Como |
|---|---|---|
| F1 | Os dois tipos de lote da E11: **66 relatórios cada** (33 por canal), dias 08/09 a 10/10; os 94 já baixados (`baixado` e `vazio`) têm todos `downloaded_at` preenchido (a prova de fila parada usa essa coluna). `channel_reach_combined_a1`: 21 `baixado` (113 linhas, maior arquivo 564 bytes) e 45 `vazio`, **0 normalizados**. `channel_traffic_source_a3`: 4 `baixado` (7 linhas), 24 `vazio`, **38 `listado`** (a E12 os baixa a partir de 13/10) | `group by report_type_id, status` em `yt_reporting_reports` |
| F2 | **Todo relatório cobre exatamente um dia** (`end_time − start_time` = 1 dia nos 198 dos três tipos) e a `date` das linhas do CSV é igual à data UTC do `start_time` em 94 de 94 brutos (0 divergências; 0 relatórios com mais de um dia) | consulta + abertura dos 94 brutos em memória (OP-8, primeira metade) |
| F3 | **Nenhum relatório refeito existe:** 0 de 264 grupos (canal, tipo, `start_time`) têm mais de um relatório. A segunda metade da OP-8 ("o `create_time` do refeito é sempre maior") **não pôde ser medida** | `group by … having count(*) > 1` |
| F4 | Cabeçalho real de `channel_reach_combined_a1` (igual nos 66 brutos, inclusive nos 45 vazios, que guardam só o cabeçalho): `date,channel_id,video_id,device_type,operating_system,traffic_source_type,traffic_source_detail,video_thumbnail_impressions,video_thumbnail_impressions_ctr` | brutos abertos em memória |
| F5 | Cabeçalho real de `channel_traffic_source_a3` (igual nos 28 brutos): as 15 colunas da C0.2. Além da chave da tabela, o CSV traz **três dimensões que a tabela não tem**: `live_or_on_demand`, `subscribed_status`, `country_code` | idem; fixture `c02-traffic-source-a3-forma.csv` |
| F6 | **As dimensões do lote vêm em código numérico**, não em nome: `traffic_source_type` 4, 5 e 8; `device_type` 101, 102, 104, 105; `operating_system` 2, 4, 5, 9, 12. A Analytics API devolve nomes (`YT_SEARCH`, `MOBILE`) | brutos; documentação da Reporting API lida em 12/10 |
| F7 | Pela documentação: **5 = busca do YouTube (detalhe = o termo)**, 4 = canais do YouTube (detalhe = id do canal), 8 = outras páginas do YouTube (detalhe = tipo de página), 9 = externo (detalhe = página). **Corrige a C0.2**, que supôs o 8 como busca. Nos brutos: tipo 4 sempre com id de canal (83 linhas); tipo 5 com detalhe **vazio** em 2 linhas do relatório de tráfego (o termo ficou abaixo do limiar) e com texto em 34 do relatório de alcance; tipo 8 em 1 linha | documentação + brutos |
| F8 | No relatório de alcance: 113 linhas, **113 chaves distintas** (vídeo, dia, origem, aparelho, sistema): nenhuma colisão hoje. A soma dentro da chave (achado C-3) não tem caso real para fixture; o teste usa o cabeçalho real e linhas montadas | brutos |
| F9 | Nenhum campo com aspas nem vírgula nos 94 brutos; taxa de clique sempre preenchida (0 vazias), sempre entre 0 e 1; nenhuma linha com 0 impressões | brutos |
| F10 | Canal próprio hoje: 35 vídeos (um canal; o outro tem 0). Diário: 96.892 linhas, última 09/10. **Vídeos com view nos últimos 10 dias: 1** (1 dia); nos últimos 14: 3; 36 views em 90 dias, em 28 dias de vídeo | `yt_own_video_daily` |
| F11 | Duração do cron em produção: 73 a 145 s no total. Por passo, três execuções: metadados 13 a 17 s; relatórios 28 a 36 s; alcance 2,3, 9,1 e **20,1 s** (teto batido no dia em que normalizou a fila inteira); diário 9,6, 13,7 e **50,4 s** (teto batido no primeiro dia); parte antiga 20 a 24 s | `yt_own_collection_runs.ms_passos` |
| F12 | O passo de alcance normalizou 16 relatórios (7 com dado, 9 vazios) em 9,1 s: **cerca de 0,6 s por relatório**, com 3 idas ao banco cada | `resumo.alcance` de 11/10 |
| F13 | Os tetos somam **240 s** e, com os 30 s da parte antiga, fecham os 270 s do relógio (`clock.test.ts` trava a soma). O spec fala em "200 s de 270 s": está desatualizado. **Não há folga para um teto novo somado.** Pior caso teórico de hoje: 281 s (ledger da E20) | `clock.ts`, ledger |
| F14 | Em produção não existem `yt_own_video_coverage`, `can_view_private_site` nem `yt_own_daily_apply` (MG14 e MG11 não aplicadas). O `check` de `kind` ainda é a lista de seis. **Relido em 12/10 às 23:40: versão `20261012000004`, um site, 2 canais com coleta ligada, 94 relatórios dos dois tipos na fila (emenda do portão: R7)** | `to_regclass`, `pg_constraint`, `schema_migrations` |
| F15 | Banco: 171 MB. `yt_reporting_report_blobs`: 176 kB. `yt_own_video_reach_daily`: 96 kB, 104 linhas | `pg_database_size` |
| F16 | `day,country` dá 400; `country` com `startDate = endDate` e filtro de vídeo dá 200; dia sem view dá 200 com `rows: []`; a soma dos países fica **abaixo** do diário (204 de 215; 17 de 21): a API omite o não identificado | C0.2 e fixtures |
| F17 | A MG7 **emendada** aplica duas vezes sem erro **sobre a MG14 real**; as seis funções têm `search_path = ''` e `execute` só para `service_role`; o apagamento por (canal, dia) usa os índices novos nas duas tabelas de lote | banco local (seção 11) |
| F18 | **(emenda do portão: R7)** Estado do HEAD local (`9d806ab0`) relido: `test/helpers/db-skip.ts:42` tem `localSupabaseUrl()`, que lê `NEXT_PUBLIC_SUPABASE_URL`, e `db-seed.ts:61` a usa (commit `69bd83c7`): a Tarefa 0a da primeira versão não existe mais. `lib/conferencias.ts` tem o molde `E1_E2_DEPLOY` (data nula = nenhuma entrada, nada vence). A rota `sync-analytics-metrics` dá o veredito em um lugar só: `falhas.length > 0` grava a falha do cron. `competitor-capture.ts:63` exporta `cleanText` (texto) e `:67` `sanitizeForDb` (devolve `{ value, changed }`) | leitura do código |
| F19 | `apps/web/e2e/fixtures/observatorio-seed.ts` continua **modificado e não commitado** por outro terminal (A4) | `git status` em 12/10, 23:20 |
| F20 | O banco `bythiago_int` está na versão `20261012000003` (não tem a corretiva `…000004`, que só mexe nas provas dos concorrentes), com 1 site, 0 canais e um usuário, que é `super_admin`: teste de RLS feito com ele lê tudo. A prova de RLS da emenda criou um usuário sem papel dentro da transação | `schema_migrations`, `auth.users` |
| F21 | Em `main`, as tabelas com chave `on delete restrict` para `youtube_channels` são exatamente seis (`yt_own_collection_attempts`, `yt_own_video_daily`, `yt_own_video_meta_daily`, `yt_own_video_reach_daily`, `yt_reporting_jobs`, `yt_reporting_reports`): o corpo por catálogo dá hoje o mesmo número da lista escrita | `pg_constraint` no banco local |

**NÃO medido (dito como tal):**
- A cota diária da Analytics API (pergunta 1).
- Se as três consultas com `day` + dimensão e filtro de vídeo são aceitas, e se aceitam `engagedViews` (Tarefa 0b).
- Latência de uma consulta de dimensão (uso a do diário: cerca de 0,3 s por vídeo, com as idas ao banco).
- Se o `create_time` de um relatório refeito é sempre maior (F3). A função desempata por `report_id`.
- A correspondência entre o código numérico do lote e o nome da Analytics API **não é uma tabela publicada**: montei pelos rótulos das duas páginas. O catálogo (Tarefa 2) traz o rótulo em português por código e por nome; código fora do catálogo aparece como "código N", nunca some.
- O tamanho real de uma linha das três tabelas (estão vazias); a conta de volume usa a do spec.
- A forma de um termo de pesquisa com vírgula ou aspas no CSV (não há caso: F9). O leitor de CSV recusa a linha e marca o relatório em erro, em vez de adivinhar.
- O plano do apagamento por dia com tabela cheia (medido só com tabela vazia e `enable_seqscan = off`).
- O arquivo real da MG14 (não existe antes da vez do lote C): a prova desta emenda usou o texto do plano dono, que pode mudar na emenda dele.
- As migrations MG9, MG11 e MG12 de verdade: a prova de "qualquer ordem" (seção 11, S12) usou a MG14 e a MG5 reais, uma tabela inventada no lugar das de outras etapas, e o corpo de `main` no papel da "migration com lista fixa".

---

## 4. Desenho, no que difere de "copiar o que já existe"

**Dois passos novos, cada um num arquivo próprio, rodando depois do diário.**

```
… relatórios → guarda → alcance → critérios de relatórios → diário → [dimensões] → [normalizadores] → criteriosL2 → (criterioCobertura, da dieta) → [criteriosE11] → (retenção e criteriosRetencao, da E8) → (criterioDesligados) → metadados → orçamento → conferências
```

- **`dimensões`** (Analytics API) vem depois do diário porque o teto da cobertura é a `base` que o diário acabou de estender.
- **`normalizadores`** (só banco) vem depois: o bruto está guardado e nada vence; é o que pode esperar.
- **(emenda do portão: decisão 5)** Esta ordem é a que o plano das ordens 8 e 10 escreve uma vez para as três etapas (seção 5 dele). Entre colchetes, o que é da E11; entre parênteses, o que é de outra etapa e pode ainda não existir quando a Tarefa 10 rodar. A linha da primeira versão que punha a retenção entre os dois passos daqui estava errada e saiu.
- **(emenda do portão: dados m-1; software I4)** Os critérios da E11 rodam **depois** dos dois passos e chamam a prova de novo: a prova tirada antes dos passos mede o estado de ontem.
- **Os dois têm "teto de fim":** `relogio.prazo(teto)` já devolve `min(agora + teto, fim do relógio global)`. Eles só gastam o que **sobrar** dos 270 s. Num dia normal sobram mais de 120 s (F11); no pior dia (fila da E12 cheia e diário no teto) não rodam, gravam `nao_alcancado_orcamento` e entram primeiro na execução seguinte. **Por isso os tetos deles não entram em `TETOS_MS`** (a soma travada por teste não muda): ficam em `TETOS_DE_FIM_MS`, objeto novo em `clock.ts`.

**Três estados na leitura, uma regra na gravação.** A gravação é esparsa e a cobertura nunca passa da `base`. Para um vídeo, dia e dimensão: fora da cobertura **do conjunto ou da base de comparação** = não medido (emenda do portão: dados I-2); coberto com linha = o valor; coberto sem linha e a soma das linhas do dia fecha com o diário = zero medido; soma abaixo = "zero ou abaixo do limiar do YouTube" (a diferença é "omitido"); soma acima = "em revisão". Isso mora num módulo puro (Tarefa 11).

**O relatório manda no dia, não as linhas (OP-13).** As duas funções de lote leem `yt_reporting_reports` para saber o dia (`start_time` em UTC) e se há relatório mais novo, **não** as linhas já gravadas: um relatório refeito **vazio** não deixa linha nenhuma para dizer "sou mais novo", e sem isso o velho voltaria ao ser reprocessado.

---

## 5. As contas

### 5.1 Passo "dimensões" (por execução)

Janela de cada conjunto de cada vídeo: `de = maior(DIMENSOES_DESDE, menor(hoje − 10, último dia coberto do conjunto))`; `até = menor(hoje, último dia da base)`. "Hoje" é o dia do Pacífico (`dayPt`).

| Parte | Idas ao banco | Chamadas à API | Observação |
|---|---|---|---|
| Por site, fixo | 1 (schema e `base_ate`, pela função de prova) | 0 | |
| Por canal ligado, fixo | 3: `yt_own_dim_cover_idle` (1), cobertura dos cinco conjuntos (1, paginada), diário com `views > 0` **a partir do menor começo de janela** (1, paginada) | 0 | o token vem de `obterToken` (ou por injeção, no ensaio) |
| Por vídeo **com view na janela**, famílias `com_dia` | 3 (`yt_own_dim_apply` × 3) + 1 (tentativa) | 3 (origem; aparelho e sistema; inscrito) | a chamada cobre a janela inteira |
| Por vídeo com view, família `por_dia` (país) | **1** (`yt_own_dim_apply` uma vez, com a janela inteira) | 1 por **dia com view** | **(emenda do portão: dados C-1, software C1)** antes: uma ida ao banco por dia, e só o dia com view ficava coberto |
| Por canal, fim | 1 (tentativa do canal) | 0 | |

| Cenário | Vídeos com view na janela | Dias de vídeo com view | API | Banco | Tempo estimado (4 em paralelo, 0,35 s por par) |
|---|---|---|---|---|---|
| **Hoje** (F10: 1 vídeo, 1 dia com view) | 0 a 1 | 0 a 1 | 0 a 4 | 5 a 10 | 1 a 3 s |
| Canal do modelo (40 vídeos, 30% dos dias com view) | 40 | 120 | 240 | cerca de 210 (antes: 290) | cerca de 21 a 25 s |
| Se a Tarefa 0b der 400 nas três (tudo `por_dia`) | 40 | 120 | 480 | cerca de 210 | cerca de 45 s: **não cabe** no teto de 30 s; ver abaixo |

- **A janela é relida inteira todo dia, de propósito:** um dia com view é consultado de novo enquanto estiver nos últimos 10 dias (o YouTube revisa). No canal de hoje isso é 1 consulta de país por dia durante 10 dias; depois o dia sai da janela, o vídeo volta a ser "parado" e não gera chamada (teste de integração na Tarefa 12).
- **(emenda do portão: dados I-3)** O diário é lido a partir do **menor começo de janela** entre os vídeos do canal (em regime, hoje − 10), não desde `DIMENSOES_DESDE`: a leitura desde a data de partida crescia para sempre (4.380 linhas por ano no canal do modelo) e batia no teto de 20.000 linhas em 4,6 anos, parando o canal todo dia.
- **Teto do passo:** 30 s (`TETOS_DE_FIM_MS.dimensoes`), e nunca além do relógio global. **Antes de cada vídeo** confere o relógio: com menos de 3 s, não começa; grava `nao_alcancado_orcamento` e conta em `pendentes`.
- **Teto de consultas:** `MAX_CONSULTAS_DIMENSOES = 400` por execução; o que cortar é contado (`consultas_cortadas`) e vira `nao_alcancado_orcamento`.
- **Ordem da fila:** vídeo nunca coberto primeiro; depois o de cobertura mais antiga. A fase A (três consultas) roda para todos antes da fase B (país): se faltar tempo, quem atrasa é o país, e a prova diz qual conjunto.
- **Se tudo for `por_dia`** e o canal crescer até o modelo, o passo não fecha em 30 s. O plano não resolve isso agora (o canal tem 1 vídeo ativo): fica como risco com gatilho (seção 13), e o `consultas_cortadas > 0` por 3 dias seguidos é o sinal.
- **Cota da Data API:** 0. **Cota da Analytics API:** 0 a 15 consultas por dia hoje; a cota diária não foi medida (pergunta 1).

### 5.2 Passo "normalizadores"

| Parte | Idas ao banco |
|---|---|
| Fila (uma leitura, os dois tipos, `limit 201`) | 1 |
| Vídeos do canal (uma por canal por execução) | 1 por canal |
| Por relatório: bruto (1) + função de gravação (1; ela apaga o dia, grava, estende a cobertura e marca `normalized_at` na mesma transação) | 2 |

- Medida análoga (F12): 0,6 s por relatório com 3 idas; aqui são 2, mais o laço de cobertura dentro do banco. Estimo **0,5 s por relatório**.
- **Teto:** 20 s (`TETOS_DE_FIM_MS.normalizadores`) e `MAX_NORMALIZAR = 200`. Cerca de **40 relatórios por execução**.
- **Fila no dia do deploy:** 94 brutos já baixados (66 de alcance, 28 de tráfego) mais os 38 de tráfego que a E12 baixa a partir de 13/10, mais 4 novos por dia. **Esvazia em 3 a 5 execuções.** Nada vence: o bruto está no banco e a E20 o guarda.
- **Regime:** 4 relatórios por dia, cerca de 2 s.

### 5.3 O relógio global

- Dia normal (F11): 90 a 145 s usados; os dois passos novos somam de 3 a 25 s.
- **Pior caso teórico:** os passos novos param no fim do relógio (270 s), então não somam teto. **(emenda do portão: software m7)** Toda função de banco dos dois passos vai dentro de `comPrazo(…, deadline)`: quando o prazo vence, o código para de esperar (a função termina sozinha no banco, numa transação inteira) e o item vira "pendente". O que sobra depois dos 270 s é a prova dos critérios (uma ida por site, com prazo próprio de 5 s). **O pior caso passa de 281 s para cerca de 286 s; a folga até os 300 s cai de 19 s para 14 s.** Estimativa, não medição (o parecer de dados também não conseguiu medir). É o mesmo tipo de aperto que a E20 já registrou (dívida M2). O plano das ordens 8 e 10 (retenção) também acrescenta passo: os dois planos têm de usar `TETOS_DE_FIM_MS` e o controlador soma as duas caudas antes do envio do segundo.

### 5.4 Volume

- **Banco, hoje:** 28 dias de vídeo com view em 90 dias; a cerca de 6 linhas por dia ativo, menos de 200 linhas por trimestre nas dimensões; menos de 0,1 MB por ano. Cobertura: 35 vídeos × 6 conjuntos, uma linha por intervalo contíguo: cerca de 210 linhas, e cresce só quando há buraco.
- **Banco, no modelo do spec** (40 vídeos, 30% dos dias): 13 MB de dimensões, 3 MB de detalhe, 3 MB de alcance por dimensão: **cerca de 19 MB por canal por ano** (número do spec, 7.3; não remedido: as tabelas estão vazias).
- **Blob:** nada.

---

## 6. O que acontece quando o dado não existe, e em cada falha

| Situação | O que o código faz | O que o dono vê |
|---|---|---|
| MG7 ou MG14 não aplicada | `schemaE11` falha: os dois passos não rodam, não chamam a API | cron vermelho: `schema_ausente: MG7 não aplicada (…)` |
| Configuração da E11 inválida (data de partida vazia, malformada ou depois da data de ligar) | os dois passos não rodam | cron vermelho: `dimensões: data de partida inválida (e11-config.ts)`. **(emenda do portão: software I2)** As constantes nascem preenchidas e a configuração entra por parâmetro; o caso "vazia" é teste de `configE11`, não estado do repositório |
| Passo na lista `YT_OWN_STEPS_OFF` | não roda; `resumo.dimensoes = { desligado: true }` | "desligado" no retorno, nunca "ok"; os critérios daquele passo não rodam e dizem `desligado`. **(emenda do portão: decisão 6)** Até a 7ª execução seguida desligado: nota em `acao_do_dono`. Da 8ª em diante: cron vermelho, pelo `criterioDesligados` do plano das ordens 8 e 10 (o texto da nota é o dele) |
| **Nenhum** vídeo do site com cobertura `base` (a E6 P2 não está no ar, ou a MG14 não carregou) | nada a cobrir | vermelho: `dimensões: nenhum vídeo com cobertura do diário (base): a dieta (E6 P2) está em produção?` |
| Vídeo **recém-publicado** (4 dias ou menos) ainda sem `base` | não conta em `videos_sem_base` (o diário leva de 2 a 3 dias para devolver o primeiro dia) | nada. **(emenda do portão: software I3)** |
| Vídeo antigo sem `base`, com `base` em outros vídeos (privado, apagado, ou a API não devolve) | conta em `videos_sem_base`, que vai no resumo | nada **desta etapa**: o alarme é o critério de cobertura da dieta (decisão 3 da emenda) |
| Vídeo com a `base` parada **antes** da data de partida | não há o que cobrir; conta em `videos_base_antes_do_inicio` e **não** em `faltando_cobertura` | número no resumo. **(emenda do portão: software I3, dados m-2)** Antes: 4 pares faltando para sempre |
| `base` atrasada no canal mais atrasado (último dia coberto anterior a hoje − 4) | o passo roda até onde a base vai | vermelho: `dimensões: a cobertura do diário (base) parou em dd/mm`. **(emenda do portão: dados m-4)** `base_ate` é o menor entre os canais, para um canal parado não se esconder atrás de outro |
| Vídeo sem view na janela | uma função por canal estende os quatro conjuntos; **zero chamadas à API** (teste que conta). Com menos de 3 s de prazo a função não é chamada (dados m-5) | nada |
| **Vídeo com view só no dia X e nenhuma depois** (o caso do canal de hoje) | **(emenda do portão: dados C-1, software C1)** as três famílias `com_dia` cobrem a janela inteira; o país consulta só o dia X e grava **uma vez** com a janela inteira: os dias sem view ficam cobertos. Quando X sai dos 10 dias, o vídeo volta a ser "parado" | nada. Antes: país preso no dia X e cron vermelho para sempre a partir de D + 3 |
| País: a consulta de um dia com view falha (HTTP, cota, sem tempo) | **(emenda do portão: dados I-5)** o vídeo para naquela família: os dias com view seguintes não são consultados e a gravação cobre só até o dia anterior ao que falhou | "com erro" ou "pendente"; se não se recuperar, a prova acusa em 4 dias (rodado: S6) |
| Vídeo com view, resposta 200 **sem `rows`** (chave ausente) | tratada como lista vazia **só se** `columnHeaders` veio; sem `columnHeaders` é falha da chamada (`erro_http`, `corpo_sem_cabecalho`) | o vídeo conta em "com erro" |
| Vídeo com view, resposta 200 com `rows: []` | a função é chamada com lista vazia: **as linhas antigas dos dias com view no diário ficam** (`dias_mantidos`), a cobertura avança; tentativa `sem_dado_na_janela` | a leitura dirá "zero ou abaixo do limiar", com a diferença como "omitido": nunca zero |
| Dia sem linha nova cuja linha antiga soma **mais** que as views do diário (o diário foi revisado para baixo) | **(emenda do portão: dados m-3)** a linha antiga sai (contradiz a referência); conta em `apagadas` | "zero ou abaixo do limiar", em vez de "em revisão" para sempre |
| Coluna esperada ausente no cabeçalho da resposta (`views`, ou a da dimensão) | `AnalyticsApiError(200, 'sem_coluna_<nome>')`; nada gravado | "com erro" |
| Valor de dimensão fora do formato (`^[A-Za-z0-9_|]{1,80}$`) ou país que não é duas letras maiúsculas | a linha é descartada e contada (`valores_invalidos`); o resto do vídeo grava | `resumo.dimensoes.valores_invalidos`; vermelho se > 0 |
| Métrica ausente numa linha | fica fora do envio: nula no banco, nunca zero | |
| `engagedViews` recusada (400) | repete só com `views,estimatedMinutesWatched`; conta `estendidas_recusadas` | nota, como no diário |
| 400 "query not supported" numa família em modo `com_dia` | `erro_http` com o motivo; **não** troca de modo sozinho | vermelho: `dimensões: a API recusou a consulta de <família>`; a troca para `por_dia` é um commit |
| 401 ou 403 de autorização | marca `reautorizar` (o mesmo caminho do diário), para o canal | "reautorizar" em `acao_do_dono` |
| 403 ou 429 de cota (`quotaExceeded`, `rateLimitExceeded`) | **não** marca reautorizar; para o canal; `erro_http` | vermelho: `dimensões: cota da Analytics API esgotada` |
| Sem tempo | não começa vídeo novo; `nao_alcancado_orcamento` por vídeo e no canal | `pendentes`; vermelho só pela prova, se durar 4 dias |
| A função de gravação falha (erro de banco) | o vídeo fica com a tentativa `erro_http` e o código `erro_de_banco` (do catálogo de `coleta/motivo.ts`); nada parcial (a função é uma transação). **(emenda do portão: R3)** O texto do erro do banco não vai a coluna nenhuma | "com erro" |
| A função de gravação não responde até o prazo do passo | **(emenda do portão: software m7)** `comPrazo` devolve nulo: o item vira "pendente" e entra primeiro amanhã | `pendentes` |
| A soma de uma dimensão passa das views do diário | a função conta `dias_em_revisao`; nada é corrigido | `resumo.dimensoes.dias_em_revisao` (número, não falha) |
| País: a API omite o não identificado | **não** se grava linha `ZZ` inventada; a diferença é calculada na leitura | "omitido pelo YouTube" |
| Leitura de cobertura ou de diário com mais de 1.000 linhas | paginada por `lerPaginado` (auxiliar novo em `coleta/paginar.ts`; o `readAll` do Observatório é `server-only` e não é importado pela coleta: software m4); teto de 20.000 linhas: passou, falha | vermelho, com o número |
| **Normalizador:** relatório `baixado` ou `vazio` sem bruto | marca `erro: bruto_ausente` | vermelho no dia; depois o critério de relatório em erro |
| Cabeçalho diferente do esperado (coluna trocada, a mais, a menos) | marca `erro: cabecalho_inesperado`; **nenhuma linha** | idem |
| Linha com aspas, número de campos errado, data inválida, número inválido, taxa fora de 0 a 1 | marca `erro: linha_invalida`; nenhuma linha do relatório entra | idem |
| Linha de outro canal | `erro: canal_inesperado` | idem |
| Linha com dia diferente do dia do relatório | `erro: dia_inesperado` (e a função também recusa) | idem |
| Relatório `vazio` (só cabeçalho) | o cabeçalho é conferido; a função é chamada com lista vazia: **apaga o dia** se havia linhas de relatório mais velho, estende a cobertura, marca normalizado | `vazios` no resumo |
| Relatório mais velho que outro **já normalizado** do mesmo dia | a função devolve `superado`, marca `normalized_at`, não grava | `superados` no resumo |
| Dois relatórios do mesmo dia na fila, e o **mais novo falha** por conteúdo | **(emenda do portão: dados I-1, software m8)** o mais velho é aplicado primeiro e **grava**; o mais novo vai a `erro`; o dia fica com o dado do velho | o relatório em erro aparece no critério de relatório em erro. Antes: o velho saía `superado` e o dia ficava vazio, com tudo "normalizado" |
| O banco recusa as linhas por conteúdo (`23505` chave repetida, `23514` regra da tabela, `22P02` texto inválido) | **(emenda do portão: dados m-6)** é erro de **conteúdo**: o relatório vai a `erro` com o código `recusado_pelo_banco`, em vez de ficar na fila para sempre como "erro de banco" | vermelho no dia; depois o critério de relatório em erro |
| Detalhe vazio (termo abaixo do limiar) | grava `detail = ''` (a soma das views do dia continua certa); o leitor mostra "sem detalhe informado", nunca um termo vazio | |
| Detalhe com caractere inválido para o banco | `cleanText` antes do hash; corte em 300 **por ponto de código** e `cleanText` de novo depois do corte (emenda do portão: dados I-4, software m1 e m2) | |
| Detalhe com emoji atravessando a posição 300 | o corte não parte o par: o texto gravado é aceito pelo banco | nada. Antes: o relatório ficava preso na fila todo dia |
| Vídeo do CSV sem par em `youtube_videos` | grava com `video_id` nulo, lista em `unmatched_video_ids`, cobre o dia também para ele | `sem_par` |
| Código de origem, aparelho ou sistema fora do catálogo | **grava** como veio; conta `codigos_fora_do_catalogo` | número no resumo; o leitor mostra "código N" |
| Vídeo cadastrado depois de o relatório do dia ter sido normalizado | não tem cobertura daquele dia: lê "não medido" (conservador) | risco registrado (seção 13) |
| Tabela vazia, primeira execução | a prova devolve números, não nulo; `faltando_cobertura` alto no primeiro dia é esperado e não fica vermelho antes de `DIMENSOES_LIGADO_EM + 3 dias` | resumo |
| A função de prova falha, estoura 5 s ou recebe parâmetro nulo (ela lança) | vermelho: `dimensões: prova não avaliada`; nunca "0 faltando" (emenda do portão: R9) | |
| Leitor: usuário sem o direito | devolve `{ acesso: 'negado' }` sem consultar | "privado", nunca lista vazia |
| Leitor: dia anterior ao começo da coleta | estado `nao_medido` com motivo `antes_do_inicio` e a data do conjunto | "a coleta começou em dd/mm" (texto: mockup 12) |
| Leitor: dia coberto no conjunto mas **não na base de comparação** (buraco na `base`; ou, no alcance por dimensão, o relatório básico do dia não normalizado) | **(emenda do portão: dados I-2)** estado `nao_medido` com motivo `base_nao_medida`; base ausente **nunca** vira zero | "não medido", em vez de "zero medido" num dia que o diário não mediu |

---

## 7. Simulação do dia do deploy e dos seguintes

Suposições: lote C aplicado; E6 P2 em produção; deploy do código em D (antes das 12:00 UTC); data de partida = D − 10; data de ligar = D.

- **D, 12:00 UTC.** Diário roda e estende a `base` até cerca de D − 2. **Dimensões:** `yt_own_dim_cover_idle` cobre os quatro conjuntos de cada vídeo sem view, de D − 10 até a `base`: com 35 vídeos e 0 ou 1 ativo, cerca de 136 a 140 linhas de cobertura numa ida. O vídeo ativo recebe 3 consultas da janela inteira e 1 de país por dia com view, e **quatro** gravações, cada uma com a janela inteira. **Normalizadores:** cerca de 40 dos 94 brutos; cada dia normalizado ganha cobertura `detalhe` ou `alcance_dim` para os 35 vídeos. Critérios: `pendentes_normalizar` maior que 0 **não** fica vermelho (carência de 5 dias); `faltando_cobertura` = 0 se o passo rodou.
- **(emenda do portão: dados C-1, software C1) O caso real, rodado com as datas do canal** (seção 11, S5): o único vídeo com view nos últimos 10 dias teve 2 views em 05/10. Com D = 14/10, data de partida 04/10 e `base` até 12/10, depois do primeiro cron os quatro conjuntos ficam cobertos de 04/10 a 12/10 e a prova dá 0. Quarenta e cinco dias depois, sem view nova, a cobertura de país vai de 04/10 a 26/11 num intervalo só, a linha `BR` de 05/10 continua lá e a prova dá 0. Na primeira versão do plano esse mesmo caso deixava país em "05/10 a 05/10" e o cron vermelho para sempre.
- **Se em D a fila da E12 ainda come os 120 s e o diário bate o teto:** os dois passos novos ficam sem tempo, gravam `nao_alcancado_orcamento`; nada fica vermelho por isso até D + 3. Nada se perde: a janela do dia seguinte começa no último dia coberto (ou na data de partida), não em "hoje − 10".
- **D + 1 a D + 4.** A fila dos normalizadores esvazia. A cobertura de lote passa a ir de 08/09 até o último relatório baixado.
- **D + 3.** Acaba a carência de `faltando_cobertura`: a partir daqui, um conjunto que não chegou a `menor(hoje − 4, base)` deixa o cron vermelho, com a contagem.
- **D + 5.** Acaba a carência de `pendentes_normalizar`.
- **Um dia sem cron** (falha da Vercel): no dia seguinte a janela de cada conjunto começa no último dia coberto; não fica buraco.
- **Passo desligado por 20 dias e religado:** idem; a primeira execução pede a janela inteira desde o último dia coberto (mais consultas no primeiro dia, dentro do teto de 400). Durante os 20 dias o cron fica vermelho da 8ª execução desligado em diante (decisão 6 da emenda).
- **Relatório refeito pelo YouTube** (nunca visto: F3): o passo de relatórios lista o novo, a E12 o baixa, o normalizador o aplica e ele substitui o dia inteiro; o velho, se reprocessado, sai `superado`. Se o novo e o velho estiverem os dois na fila, o velho grava primeiro e o novo substitui (rodado: S9).
- **A E6 P2 ainda não está em produção quando o lote C é aplicado (emenda do portão: software m11):** o lote da E11 vai com `dimensoes` desligado; os normalizadores rodam e esvaziam a fila. A conferência `e11-religar-dimensoes` cobra o religamento.

**Conferências com data** (entram em `lib/conferencias.ts` no commit do envio, **no molde que o HEAD já tem para E1 e E2**: uma constante `E11_DEPLOY: string | null`, dia de São Paulo da promoção a `main`, e uma função `conferenciasE11(deploy)` que gera as entradas relativas a ela; sem a data não há entradas e nada vence. Emenda do portão: R7):

| id | Quando | O que |
|---|---|---|
| `e11-d1` | D + 1 | resumo do primeiro cron: `dimensoes` e `normalizadores` presentes, `ms_passos` dos dois, `consultas`, `dias_mantidos` (dias com view cuja resposta veio sem linha e que tinham linha antiga: só vale para respostas de dias com view; dados m-7), `dias_em_revisao`, `codigos_fora_do_catalogo`; V4 em produção |
| `e11-d5` | D + 5 | item 84: fila dos dois tipos zerada (consulta C1); item 249 (C2) = 0 e 0; NP-E11 (C3) = 0 |
| `e11-d14` | D + 14 | item 92 com 14 dias de dado; a soma por origem ≤ diário em todo dia (C4); tamanho das três tabelas |
| `e11-religar-dimensoes` | D + 5, **só se o lote foi com `dimensoes` desligado** (antes da 8ª execução, que deixa o cron vermelho) | a E6 P2 está em produção? Tirar `dimensoes` de `YT_OWN_STEPS_OFF` e refazer o deploy |
| `e11-relatorio-refeito` | D + 60 | F3 de novo: apareceu relatório refeito? Se sim, conferir que o `create_time` é maior e que o dia ficou com um relatório só |

---

## 8. Desvios do texto do spec, com o motivo

1. **Os códigos do lote são gravados como vêm (números), não como nomes.** O spec exemplifica `'YT_SEARCH'` em `source_type`; o CSV traz `5` (F6). Traduzir na gravação perderia o código que não está no catálogo. A tradução mora num catálogo testado (Tarefa 2).
2. **A busca do YouTube é o tipo 5, não o 8** (F7). A C0.2 supôs o 8. Muda a regra de privacidade: é o detalhe do **tipo 5** que é termo de pesquisa.
3. **O normalizador de tráfego soma por cima de três dimensões que a tabela não tem** (`live_or_on_demand`, `subscribed_status`, `country_code`; F5). O spec só previu a soma de detalhes iguais depois do corte da query string. Elas continuam no bruto.
4. **Detalhe vazio é gravado como `''`** e lido como "sem detalhe informado" (C0.2 pede que nunca vire "termo vazio"). Deixar a linha de fora quebraria a soma das views do dia.
5. **`yt_own_dim_apply` não apaga às cegas o dia que veio sem linha:** só limpa se o diário diz zero view naquele dia; se o diário tem view, as linhas antigas ficam e o dia é contado (`dias_mantidos`). Motivo: uma resposta 200 vazia (limiar ou falha passageira) apagaria para sempre o que já foi coletado de um dia que está saindo da janela. **(emenda do portão: dados m-3)** Uma exceção: se a soma das linhas antigas já passa das views do diário, a linha antiga contradiz a referência e sai. Sem isso um dia revisado para baixo do limiar ficava "em revisão" para sempre.
6. **Linha de dia além da `base` é descartada e contada**, não gravada (o spec só fala da cobertura). Linha sem cobertura leria "não medido" de qualquer jeito, e volta no dia seguinte.
7. **Quem decide "o mais novo vence" é `yt_reporting_reports`, não as linhas gravadas**, e a função marca `normalized_at` na mesma transação (o molde `yt_own_reach_apply` não faz nenhuma das duas). Motivo: relatório novo vazio (seção 4).
8. **País: nenhuma linha `ZZ` é fabricada.** O spec lista `ZZ` como valor; a API omite o não identificado (F16). A diferença para o diário é o estado "omitido", na leitura.
9. **Os passos novos rodam depois do diário, com teto de fim fora da soma.** O spec pede "depois do diário e antes da retenção, com teto próprio dentro do relógio (hoje 200 s de 270 s)"; a soma real é 270 (F13).
10. **Índices.** `yt_own_video_traffic_detail_daily`: `(channel_id, day_pt, source_type)` no lugar de `(channel_id, source_type, day_pt)`; índice novo `(channel_id, day_pt)` em `yt_own_video_reach_dim_daily` (OP-8). Os dois servem o apagamento do dia.
11. **`check` a mais nas três tabelas:** "alguma métrica diferente de zero" (o item 85 vira regra do banco), formato dos códigos, tamanho do detalhe, formato do hash, cliques estimados entre 0 e as impressões. E os privilégios de escrita saem de `anon` e `authenticated` além da RLS.
12. **`thumbnail_clicks_est` fica nulo se alguma linha da chave veio sem taxa** (somar só as que têm subestimaria). Hoje nenhuma vem sem (F9).
13. **`youtube_channel_removal_impact` soma por catálogo** (toda tabela presa ao canal por chave `on delete restrict`), com o texto da MG14 repetido letra por letra (emenda do portão: R1; seção 2). A lista de tabelas da primeira versão saiu.
14. **Interruptor a mais:** `normalizadores` em `YT_OWN_STEPS_OFF`, além de `dimensoes` (o spec lista três nomes). São passos independentes; desligar um não deve desligar o outro.
15. **A prova NP-E11 é mais dura que a do item 92:** cobra todo vídeo com cobertura `base` que chega à data de partida (não só os com view em 14 dias), nos quatro conjuntos, até `menor(hoje − 4, base)`. A do spec fica verde com a tabela do diário parada; esta traz `videos_com_base`, `videos_sem_base` e `base_ate`. A consulta literal do item 92 também é rodada (C3). **(emenda do portão: R5, R9, software I3)** A prova recebe o site, a data de hoje e a data de partida, e lança com parâmetro nulo.
16. **O leitor nasce com o token que existir no HEAD.** Se `LeituraPrivadaDoSite` (E17 passo 0) ainda não existir quando a Tarefa 11 rodar, usa `EdicaoDoSite`; a troca é da E17 passo 0, como o spec já prevê.
17. **`metric_version` sem `check`** nas tabelas novas (como no DDL do spec): as duas tabelas antigas listam três valores e a próxima definição de "view" pediria migration.
18. **(emenda do portão: dados C-1, software C1)** **A família consultada dia a dia (país) grava uma vez por vídeo, com a janela inteira**, e não uma vez por dia com view. O spec descreve a consulta por dia; a gravação por dia deixava sem cobertura todo dia sem view de um vídeo ativo.
19. **(emenda do portão: dados I-1)** **Um relatório só é "superado" por outro mais novo que já foi normalizado.** O spec diz "o mais novo vence"; se o mais novo ainda está na fila e depois falha, o dado do mais velho tem de estar gravado.
20. **(emenda do portão: dados I-2)** **O leitor tem um quarto motivo de "não medido": `base_nao_medida`.** O spec lista três estados; a cobertura do conjunto pode passar por cima de um buraco da `base`, e ali não há referência para dizer "zero".
21. **(emenda do portão: decisão 3)** **`videos_sem_base` só fica vermelho quando nenhum vídeo tem `base`.** O alarme por vídeo é do critério de cobertura da dieta.
22. **(emenda do portão: R3)** **O relatório em erro guarda um código de um catálogo fechado**, nunca o texto da exceção; o texto que o dono lê sai de uma função.

---

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`. "Novo" = arquivo criado por esta etapa. **(emenda do portão: software I2, I5, m3, m10; R2, R5)** A lista de cada tarefa é fechada: se a tarefa precisar de outro arquivo, para e avisa.

| T | O que | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 0a | ~~URL do banco de teste por variável~~ | **nenhum: feita no lote de E1 e E2** (commit `69bd83c7`, `localSupabaseUrl()` em `test/helpers/db-skip.ts`) | | |
| 0b | Conferência C0.2b (leitura) | só `.superpowers/sdd/a5/c0-fixtures/c02b-*.json`, `.superpowers/sdd/a5/conferencias-c0-resultado.md` e o ledger | credencial por injeção (decisões 56 e R6) | todas |
| 1 | Migration MG7 e a prova no banco. **Só na vez do lote C** | `supabase/migrations/<carimbo>_observatorio_a5_e11_canal_proprio_em_tabelas.sql` (novo, por `db:new`); `test/integration/observatorio-a5-e11-migration.test.ts` (novo); `test/integration/observatorio-a5-e11-rls.test.ts` (novo) | os arquivos da MG14, da MG11 e da MG5 existirem; o aviso do controlador | 12 não; as demais sim |
| 2 | Catálogo de códigos e de motivos | `src/lib/youtube/reporting/codigos.ts` (novo); `test/youtube/coleta/codigos.test.ts` (novo) | nada | todas |
| 3 | Leitor do CSV de tráfego | `src/lib/youtube/reporting/traffic-source-csv.ts` (novo); `test/youtube/coleta/traffic-source-csv.test.ts` (novo); `test/youtube/coleta/fixtures/traffic-source-a3-real.csv` (novo) | nada | todas |
| 4 | Leitor do CSV de alcance por dimensão | `src/lib/youtube/reporting/reach-combined-csv.ts` (novo); `test/youtube/coleta/reach-combined-csv.test.ts` (novo); `test/youtube/coleta/fixtures/reach-combined-a1-real.csv` (novo) | nada | todas |
| 5 | Cliente da Analytics API por dimensão | `src/lib/youtube/coleta/analytics-dimensoes.ts` (novo); `test/youtube/coleta/analytics-dimensoes.test.ts` (novo) | fixtures da C0.2 (e da 0b quando houver) | todas |
| 6 | Configuração, janela, forma da prova, guarda de schema, paginação | `src/lib/youtube/coleta/e11-config.ts` (novo); `src/lib/youtube/coleta/paginar.ts` (novo); `test/youtube/coleta/e11-config.test.ts` (novo); `test/youtube/coleta/paginar.test.ts` (novo) | nada | todas |
| 7 | Passo "dimensões" | `src/lib/youtube/coleta/dimensoes-step.ts` (novo); `test/youtube/coleta/dimensoes-step.test.ts` (novo) | 5, 6; contrato da MG7 (neste plano); **`coleta/motivo.ts` e `coleta/kinds.ts` da Tarefa 2 do plano das ordens 8 e 10** | 8, 9, 11 |
| 8 | Passo "normalizadores" | `src/lib/youtube/coleta/normalizadores-step.ts` (novo); `test/youtube/coleta/normalizadores-step.test.ts` (novo) | 2, 3, 4, 6; **a mesma Tarefa 2** | 7, 9, 11 |
| 9 | Critérios da E11 | `src/lib/youtube/coleta/criteria-e11.ts` (novo); `test/youtube/coleta/criteria-e11.test.ts` (novo) | 6; contrato da MG7 | 7, 8, 11 |
| 10 | **Integração** (pequena, no fim) | `src/lib/youtube/coleta/index.ts`; `src/lib/youtube/coleta/criteria.ts` (**só o comentário** da linha 239); `src/lib/youtube/reporting/types.ts`; `test/youtube/coleta/index.test.ts`; `test/youtube/coleta/fake-supabase.ts`; `test/youtube/coleta/reporting-client.test.ts`; `test/youtube/coleta/tres-dias.test.ts`; `test/youtube/coleta/orcamento.test.ts`; `test/cron/sync-analytics-metrics-veredito.test.ts` (nove; `clock.ts`, `kinds.ts`, `types.ts` e `passos-desligados.ts` **não** são abertos: decisão 5) | 7, 8, 9; **a Tarefa 2 do plano das ordens 8 e 10 commitada** (dona de `passos-desligados.ts`, `kinds.ts`, `motivo.ts`, `criteria-desligados.ts` e `TETOS_DE_FIM_MS`) | nenhuma desta etapa; **fila com E6 P2, E8 e E18** nos mesmos arquivos |
| 11 | Modelo dos estados e leitor de servidor (sem tela) | `src/lib/youtube/observatorio/proprio/dimensoes-estado.ts` (novo); `src/lib/youtube/observatorio/proprio/ler-dimensoes.ts` (novo); `test/youtube/observatorio/proprio-dimensoes-estado.test.ts` (novo); `test/youtube/observatorio/proprio-ler-dimensoes.test.ts` (novo) | 2; contrato da MG7 | 7, 8, 9 |
| 12 | Testes de ponta contra o banco, e a semente | `test/integration/observatorio-a5-e11-passos.test.ts` (novo); `test/integration/observatorio-a5-e11-sentinela.test.ts` (novo); `e2e/fixtures/observatorio-seed.ts` (**só depois de a A4 commitar o arquivo**: F19) | 1 (lote C aplicado no `bythiago_int`), 10, 11 | nenhuma |
| 13 | Ensaio com a API real no banco local (**só com a resposta do dono à pergunta 3**) | nenhum arquivo do repositório; resultado no ledger | 10; 1 | |
| 14 | Envio e conferências | `src/lib/conferencias.ts`; `test/lib/conferencias.test.ts` (ou o arquivo de teste que o HEAD tiver para ela); `src/lib/youtube/coleta/e11-config.ts` (as duas datas); `docs/ops/youtube-coleta-canais-proprios-runbook.md`; `.superpowers/sdd/a5/conferencias-com-data.md` | tudo; lote C em produção | |

**Ondas (sem contradição com a coluna "depende de").**
- **Já, em paralelo:** 0b, 2, 3, 4, 5, 6.
- **Em seguida, em paralelo:** 9 e 11 (só dependem da 6 e da 2); 7 e 8 junto com elas **se** a Tarefa 2 do plano das ordens 8 e 10 já estiver commitada (senão esperam por ela). Cada uma em arquivo próprio; escrevem contra o contrato da MG7 deste plano, com banco falso.
- **Depois:** 10, sozinha. Se E6 P2, E8 ou E18 estiverem integrando nos mesmos arquivos, é uma de cada vez, na ordem que o controlador der.
- **Na vez do lote C:** 1. Depois dela e da 10: 12, e 13 se autorizado.
- **Por último:** 14.

**Arquivos compartilhados com OUTRAS etapas da A5:**

| Arquivo | Quem mais mexe | Regra |
|---|---|---|
| `coleta/passos-desligados.ts` e o teste dele; `coleta/kinds.ts`; `coleta/motivo.ts`; `coleta/criteria-desligados.ts`; `coleta/types.ts` | E8, E18 | **(emenda do portão: decisão 5)** são da Tarefa 2 do plano das ordens 8 e 10 e já nascem com os nomes, os `kind` e os motivos que a E11 usa. Este plano **não cria nem edita**: importa. Se a Tarefa 7, 8 ou 10 achar que falta um nome ou um motivo, **para e avisa o controlador** (não edita o arquivo de outro plano) |
| `coleta/clock.ts`, `test/…/clock.test.ts` | E8 (retenção), E18 (versões) | `TETOS_DE_FIM_MS` nasce na mesma Tarefa 2 **com as duas chaves da E11** (`dimensoes: 30_000`, `normalizadores: 20_000`); este plano não abre o arquivo; ninguém mexe em `TETOS_MS` |
| `coleta/index.ts`, `test/…/index.test.ts` | E6 P2, E8, E18 | cada etapa acrescenta **um bloco**; a ordem dos passos e dos critérios é a da seção 4; a integração de cada etapa é serial. A nota de nome desconhecido é `pushUnico(falhas, notaNomesDesconhecidos())`: quem integrar primeiro põe a linha |
| `test/youtube/coleta/fake-supabase.ts`, `…/tres-dias.test.ts`, `…/orcamento.test.ts`, `test/cron/sync-analytics-metrics-veredito.test.ts` | E6 P2 (Tarefas 3 e 11b do plano das ordens 8 e 10), E8 (Tarefa 11a) | **(emenda 3 do plano das ordens 8 e 10)** Cada etapa acrescenta só o seu manipulador padrão no falso (`yt_own_daily_apply` na 3, `yt_own_retention_facts` na 11a, `semearCobertura` na 11b, as seis da E11 na Tarefa 10 dela); uma etapa por vez, na ordem de integração; quem chega depois encaixa. O plano das ordens 8 e 10 não edita o veredito: ele troca `rodarColeta` por `vi.fn()` (a justificativa "exercitam `rodarColeta` de verdade", na linha 708 deste plano, vale para `tres-dias` e `orcamento`, não para o veredito; a edição daqui nesse arquivo, os dois testes da rota, continua válida). A lista de `kind` aceita pelo falso vem de `COLLECTION_KINDS` desde a Tarefa 2 do plano das ordens 8 e 10: os três `kind` da E11 já passam, e a Tarefa 10 não mexe nessa lista. Teste que roda a fase `'depois'` com o relógio 300 s atrás e afirma `falhas` usa 280 s depois que `prazoDoCriterio` entrar (Tarefa 11a de lá) |
| `coleta/diario-step.ts` | E6 P2 | **este plano não toca** |
| `observatorio/proprio/ler.ts`, `edicao.ts`, `tipos.ts` | A4, E6 P2, E17 passo 0 | **este plano não toca**: o leitor da E11 é arquivo novo |
| `reporting/types.ts` (`SEM_NORMALIZADOR`), `test/…/reporting-client.test.ts` | E10 | uma linha em cada |
| `lib/conferencias.ts` | todas | um bloco por etapa (constante de deploy e função), no molde de E1 e E2 |
| `e2e/fixtures/observatorio-seed.ts` | **A4 (com alteração não commitada: F19)**, E6, E8, E18 | **(emenda do portão: software I5)** a Tarefa 12 só edita depois de `git status` mostrar o arquivo limpo; nunca commit por caminho com trabalho de outro terminal dentro. A semente não bloqueia os testes de integração: eles semeiam por conta própria |
| `types/database.types.ts` | todas | **(emenda do portão: software m10)** este plano **não toca**: nenhum módulo daqui usa os tipos gerados, e regenerar traria o diff de todas as etapas |
| `test/helpers/db-seed.ts`, `db-skip.ts` | todas com teste de integração | **não toca**: já aceitam a URL por variável (R5) |
| `supabase/migrations/…`: `youtube_channel_removal_impact` | MG9, MG14, MG12 | **um corpo só, o da MG14** (R1); a MG7 o repete letra por letra |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md` | E6, E8, E20 | seção nova própria ("Dimensões e normalizadores"), sem editar as dos outros |

**Restrições globais.** TypeScript estrito, sem `any`. Arquivos em kebab-case. Erro que o dono lê em português. Nenhuma nota, log ou evento do Sentry leva o conteúdo de `traffic_source_detail` nem de `dim_value` de país junto de vídeo e dia de terceiros (só contagens e ids de relatório). **(emenda do portão: R3)** Nenhum texto de exceção (`message`, `details`, `hint` do banco; corpo de erro da API) vai para coluna de motivo ou de estado: grava-se um código de catálogo fechado, o texto humanizado sai de função e o detalhe técnico vai ao Sentry já sem o conteúdo. Testes de servidor com `// @vitest-environment node`. Datas de teste relativas ou com relógio falso. Todo padrão de variável de ambiente tem teste que **apaga** a variável. **(emenda do portão: R5)** Testes de integração gated em `HAS_LOCAL_DB`, contra o banco `bythiago_int`, com `HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres`, sem paralelismo entre arquivos; cada teste cria o **seu** site e passa o id à função de prova (o banco é dividido entre etapas; nenhum teste conta linhas "do banco inteiro"). Cada tarefa termina com `npm run typecheck -w apps/web` limpo e os testes dos seus arquivos verdes; commit local por caminho explícito, sem push.

**Foco de revisão** (o que os dois especialistas devem atacar primeiro nesta versão): (1) a gravação única da família `por_dia` e o corte no primeiro dia que falha; (2) "superado" só por relatório já normalizado; (3) `videos_sem_base` vermelho só sem nenhuma base (decisão 3); (4) a exceção do m-3 no apagamento; (5) o relógio com os critérios chamando a prova depois dos passos; (6) a igualdade do corpo da função de impacto com o da MG14.

---

## 10. As tarefas

### Tarefa 0a — (retirada)

**(emenda do portão: R5; software m3)** Já foi feita no lote de E1 e E2 (commit `69bd83c7`): `localSupabaseUrl()` em `test/helpers/db-skip.ts` lê `NEXT_PUBLIC_SUPABASE_URL` e `db-seed.ts` a usa; `PG_URL` lê `SUPABASE_DB_URL`. Este plano usa o que existe e não toca nesses arquivos. As variáveis de todo teste de integração daqui são as da seção 9 ("Restrições globais").

### Tarefa 0b — Conferência C0.2b (leitura)

**Objetivo.** Saber se as três consultas com `day` são aceitas, e com quais métricas.
**Como.** O procedimento da C0.2 (script no scratch, só `GET`; relido antes de rodar). **(emenda do portão: R6)** O token é obtido lendo a conexão do canal (só `select`) e renovado **em memória** contra o Google; o script **não** chama `obterToken` nem `ensureFreshToken` (os dois gravam o token renovado em produção) e não faz `insert`, `update` nem `rpc` em banco nenhum. Se isso não for possível com a credencial disponível, a conferência não é feita e o ledger diz por quê. Para o vídeo `eibJk0L8zzc`, de `2019-08-06` a `2019-08-12` (dias com view; é consulta de conferência, **fora do passo**, e não contradiz o item 228, que vale para as chamadas da E11 em produção): `dimensions=day,insightTrafficSourceType`; `day,deviceType,operatingSystem`; `day,subscribedStatus`; cada uma com `metrics=views,estimatedMinutesWatched` e depois com `engagedViews` a mais. Seis chamadas.
**(emenda do portão: dados m-8)** Mais duas chamadas, só para anotar: `country` de um dia e `day,subscribedStatus` com `likes,shares,subscribersGained,averageViewPercentage` a mais. O resultado vai ao ledger e **não muda o contrato** desta etapa (as colunas a mais ficam na dívida registrada, seção 13); nada disso expira na origem.
**Saída.** `.superpowers/sdd/a5/c0-fixtures/c02b-trafego.json`, `c02b-dispositivo.json`, `c02b-inscrito.json` (status, `columnHeaders`, até 10 linhas; sem segredo) e um parágrafo em `conferencias-c0-resultado.md`.
**Decide.** O modo de cada família em `MODO_DA_FAMILIA` (Tarefa 5) e se `engagedViews` entra.
**Pronto quando:** as três fixtures existem, ou o ledger diz por que não foi possível (e o plano segue com `com_dia` e a troca por commit).

### Tarefa 1 — Migration MG7 e a prova no banco (só na vez do lote C)

**Objetivo.** O arquivo da migration, igual ao Apêndice A, e os testes que provam as funções nos dois sentidos.
**(emenda do portão: R2; dados I-6)** **Não começa antes de o controlador dizer que chegou a vez do lote C** e de os arquivos da MG14, da MG11 e da MG5 existirem em `supabase/migrations/`. Antes disso, a prova do SQL é o roteiro `.superpowers/sdd/a5/plano-e11-emenda-prova.sql` (rodado nesta emenda: seção 11), e as Tarefas 7, 8, 9 e 11 trabalham contra o contrato abaixo.
**Arquivos.** A migration (por `npm run db:new observatorio_a5_e11_canal_proprio_em_tabelas`); os dois testes de integração.
**Passos, nesta ordem.**
1. `npm run db:new …`; conferir que o carimbo é posterior ao da MG14, da MG11 e da MG5; colar o Apêndice A.
2. **Igualdade do corpo da função de impacto (R1).** Extrair, do arquivo da MG14 e do arquivo da MG7, o bloco que vai da linha `-- >>> corpo único: youtube_channel_removal_impact (início)` à linha `-- <<< corpo único: youtube_channel_removal_impact (fim)`, as duas inclusive, e rodar `diff`: tem de sair vazio, e o `sha256` do bloco tem de ser o que o plano dono escreve (hoje `83daff58…47ac6`). Se sair diferença, o bloco da MG14 mudou depois desta emenda: copiar o da MG14 para a MG7 **e** para o Apêndice A, e seguir.
3. Rodar o roteiro de prova **duas vezes**, com `mg14.sql` = o arquivo real da MG14, `mg5.sql` = o arquivo real da MG5 e `mg7.sql` = o arquivo novo. As duas saídas têm de ser iguais entre si e iguais à guardada em `.superpowers/sdd/a5/plano-e11-emenda-prova-saida.txt` (fora carimbos de hora). Diferença = parar e avisar.
4. O controlador aplica as migrations pendentes do lote C no `bythiago_int` (nunca `db:reset`); rodar os dois testes de integração.
5. **V3 no banco local depois de TODO o lote C aplicado** (as cinco), e anotar o `md5_do_corpo` no ledger.
**Contrato (funções; `execute` só `service_role`; todas `search_path = ''`).**

| Função | Assinatura | Devolve |
|---|---|---|
| `yt_own_dim_coverage_extend` | `(p_video text, p_set text, p_from date, p_to date, p_site uuid, p_video_id uuid, p_channel uuid, p_source text)` | `void`; funde intervalos que se tocam; nunca encolhe |
| `yt_own_dim_apply` | `(p_video text, p_kind text, p_from date, p_to date, p_rows jsonb, p_site uuid, p_video_id uuid, p_channel uuid)`; `p_rows` = `[{day_pt, dim_value, views?, engaged_views?, watch_time_minutes?, metric_version}]`. **Quem chama passa a janela inteira** (`p_from` = começo da janela; `p_to` = último dia respondido sem falha), também na família consultada dia a dia | `{status: 'gravado' \| 'base_sem_cobertura', base_ate, coberto_ate, gravadas, apagadas, fora_do_teto, dias_mantidos, dias_em_revisao}` |
| `yt_own_dim_cover_idle` | `(p_channel uuid, p_inicio date, p_janela date, p_to date)` | `{videos_com_base, conjuntos_cobertos, videos_com_view}` |
| `yt_own_traffic_detail_apply` | `(p_report_id text, p_rows jsonb, p_unmatched jsonb)`; `p_rows` = `[{youtube_video_id, video_id?, day_pt, source_type, detail, detail_hash, views?, watch_time_minutes?, metric_version}]` | `{status: 'gravado' \| 'superado', dia, gravadas, apagadas, videos_cobertos}` |
| `yt_own_reach_dim_apply` | `(p_report_id text, p_rows jsonb, p_unmatched jsonb)`; `p_rows` = `[{youtube_video_id, video_id?, day_pt, traffic_source_type, device_type, operating_system, thumbnail_impressions, thumbnail_clicks_est?, metric_version}]` | idem |
| `yt_own_dim_prova` **(emenda do portão: R5, R9, software I3, dados m-2 e m-4)** | `(p_site uuid, p_hoje date, p_desde date)`; **lança com qualquer parâmetro nulo** | `{faltando_cobertura, videos_com_base, videos_base_antes_do_inicio, videos_sem_base, base_ate, dias_dois_relatorios_detalhe, dias_dois_relatorios_alcance, pendentes_normalizar}` (oito chaves) |

`p_kind` → conjunto: `traffic_source` → `trafego`; `device_os` → `dispositivo`; `country` → `pais`; `subscribed_status` → `inscrito`.

**Testes de `observatorio-a5-e11-migration.test.ts`** (cada um cria o **seu** site, dois canais e os vídeos, e passa o site à prova; todos os cenários abaixo já foram rodados em SQL: seção 11).

| Nome | Entrada | Esperado |
|---|---|---|
| `aplicada: V1` | o banco depois do lote C | V1 = 3, 3, 3, 6, 0, 4 |
| `cobertura funde vizinhos` | 05/10, depois 07/10, depois 06/10 | um intervalo 05/10 a 07/10 |
| `teto da base` (item 227) | janela até hoje, `base` até anteontem, linha de ontem | `coberto_ate` = anteontem; a linha de ontem não entra; `fora_do_teto` = 1 |
| `linha zerada não entra` (item 85) | linha com `views: 0` e minutos 0 | `gravadas` não a conta; `insert` direto de linha zerada falha pelo `check` |
| `resposta vazia mantém o dia com view` | linhas gravadas (soma = diário), depois `[]` | `apagadas` 0, `dias_mantidos` 1 |
| `diário revisado para baixo e resposta vazia: a linha antiga sai` (dados m-3) | linha de 2 views, diário passa a 1, `[]` | `apagadas` 1, `dias_mantidos` 0, `dias_em_revisao` 0 |
| `diário revisado a zero limpa o dia` | idem, com `views = 0` no diário | as linhas somem |
| `dia com linha é substituído inteiro` | A, B no dia; depois só A | B some |
| `em revisão é contada` | linha nova de 3 views, diário 1 | `dias_em_revisao` 1 |
| `vídeo sem base` | vídeo sem cobertura `base`, ou com `base` anterior à janela | `status: 'base_sem_cobertura'`, 0 linhas, 0 cobertura |
| `kind desconhecido` e `linha fora da janela` | `'idade'`; linha de 07/10 numa janela de 06/10 | exceção; nada gravado |
| `idle cobre quem não tem view e pula quem tem` | A com view, B sem | B ganha 4 conjuntos; A nenhum; `videos_com_view` 1 |
| `idle limpa dimensão de dia sem view` | linha de dimensão num dia que o diário zera | some |
| **`país: view só no dia X, uma gravação com a janela inteira cobre os dias sem view`** (dados C-1, software C1) | `base` de 01/10 a 12/10, view só em 05/10, janela de 04/10 a 14/10, linhas só de 05/10 | cobertura de `pais` = 04/10 a 12/10; prova = 0 |
| **`país: 45 dias depois sem view nova, a cobertura anda e a linha antiga fica`** | o mesmo, `base` até 26/11, `cover_idle` com hoje = 28/11 | `pais` = 04/10 a 26/11, um intervalo; a linha `BR` de 05/10 existe; prova = 0 |
| **`país: a gravação cortada no dia anterior ao que falhou deixa a prova vermelha`** (dados I-5) | views em 20, 22 e 24/11; gravação de 04/10 a 21/11 só com a linha de 20/11 | cobertura até 21/11; `faltando_cobertura` 1 com hoje = 28/11; depois da gravação de 19/11 a 26/11 com as três, 0 e um intervalo só |
| `relatório refeito substitui o dia inteiro` (item 249) | A com k1, k2, k3; B (mais novo) com k1, k2 | k3 some; `count(distinct source_report_id)` = 1; soma = a de B; outro dia e outro canal intactos (contagem antes e depois) |
| **`dois na fila: o mais velho grava; o mais novo que falha não esvazia o dia`** (dados I-1) | A e B `baixado` e sem normalizar; A aplicado; B marcado `erro` | A devolve `gravado`; o dia fica com as linhas de A e um relatório |
| `o mais velho chegando depois não muda nada` (item 87) | B aplicado, depois A | A sai `superado`; linhas iguais; `normalized_at` de A preenchido |
| `o mesmo relatório duas vezes` | B, B | mesmas linhas |
| `relatório novo VAZIO apaga o dia` (OP-13) | A com linhas e aplicado; B `vazio`, mais novo, `[]` | B apaga o dia (0 linhas); cobertura mantida; A reprocessado sai `superado` |
| `refazer a fila inteira dá o mesmo estado` | os quatro com `normalized_at = null`, reaplicados na ordem de `create_time` | mesmas linhas de antes; 0 pendentes |
| `mais novo ainda só listado não bloqueia` | B `listado` | A grava; quando B vira `baixado` e é aplicado, substitui |
| `dia diferente do relatório`, `tipo errado`, `chave repetida`, `linha zerada` | uma linha de outro dia; relatório de outro tipo; duas linhas com a mesma chave; linha com views 0 | exceção nas quatro; nada gravado; `normalized_at` continua nulo |
| `sem par ganha cobertura` | vídeo que não está em `youtube_videos` | linha com `video_id` nulo; cobertura do dia para ele; `unmatched_video_ids` gravado |
| `prova: parâmetro nulo lança` (R9) | `p_site` nulo; `p_hoje` nulo; `p_desde` nulo | exceção nas três |
| `prova: tabela vazia` | site com vídeos e nada mais | `faltando_cobertura` 0, `videos_com_base` 0, `videos_sem_base` = nº de vídeos antigos, `base_ate` nulo |
| `prova: outro site não entra` (R5) | vídeos, relatórios e linhas de dois relatórios num segundo site | os números do primeiro site não mudam |
| `prova sobe` | `base` em 2 vídeos, nenhuma dimensão | `faltando_cobertura` 8 |
| `prova não sobe` | os quatro conjuntos cobertos até `menor(hoje − 4, base)` | 0 |
| `prova não sobe por canal desligado` | o mesmo com `sync_enabled = false` | 0 |
| **`prova não sobe por vídeo com base anterior à data de partida`** (software I3) | vídeo com `base` só em 2019 | fora de `faltando_cobertura`; `videos_base_antes_do_inicio` 1 |
| **`videos_sem_base não sobe por vídeo publicado anteontem; sobe quatro dias depois`** (software I3) | vídeo novo sem `base` | não conta com hoje = publicação + 2; conta com hoje = publicação + 5 |
| **`base_ate é o menor entre os canais`** (dados m-4) | canal T com `base` até 26/11, canal U até 10/10 | `2026-10-10` |
| `prova: dois relatórios no dia` | `insert` direto de duas linhas do mesmo (canal, dia) com `source_report_id` diferentes | `dias_dois_relatorios_detalhe` 1 e a outra tabela 0; com um só, 0; dia com mais de 60 dias, 0 |
| `prova: pendentes` | `baixado` há 3 dias sem normalizar; outro há 1 dia; outro em `erro` há 5 dias; canal desligado | 1; o de 1 dia, o de `erro` e o do canal desligado **não** contam (software I3) |
| `impacto conta as três tabelas e as de outras etapas` (item 93; R1; software I1) | linhas nas três, na cobertura e numa tabela criada no teste com chave `restrict` para o canal | `serie_coletada` = soma esperada, com a tabela inventada dentro; `youtube_channel_remove` recusa e não apaga |
| `sem period_days; not null` (itens 226 e 249) | `information_schema` | 0 colunas; 4 `NO` |

Os testes `aplica duas vezes`, `recusa sem a MG14` e `com can_view_private_site existente, a policy a usa` **saem do vitest**: precisam de `drop` e de reaplicar o arquivo dentro de transação, e ficam no roteiro psql (`plano-e11-emenda-prova.sql` e `plano-e11-emenda-prova-2.sql`), que a Tarefa 1 roda no passo 3.

**Testes de `observatorio-a5-e11-rls.test.ts`.** `usuário sem vínculo e reporter não leem as três tabelas, forjando o GUC app.site_id` (usuário criado no teste, **sem** `super_admin`: F20); `editor lê` (enquanto a policy for `can_edit_site`; com a MG11 aplicada antes, o teste afirma o direito de `can_view_private_site` e diz qual das duas encontrou); `editor de outro site, com o GUC forjado para este, não lê`; `anon não tem select; authenticated não tem insert, update, delete` (por `has_table_privilege` e por tentativa de `delete` e `insert` como `authenticated`, que tem de dar "permission denied"; **sem chamar função como `anon` ou `authenticated`**: neste Postgres local isso derruba o servidor); `as seis funções: has_function_privilege falso para anon e authenticated`.
**Armadilhas.** Não usar `db:reset`. A semente de `youtube_channels` exige `locale` em (`pt`, `en`), `handle` e `uploads_playlist_id`; a de `yt_own_video_daily` exige `metric_version` da lista aceita (`views_desde_2026-08-27`). O `bythiago_int` não tem a corretiva `…000004` (F20): se o controlador a aplicar junto, nada daqui muda.
**Pronto quando:** `diff` do passo 2 vazio; o roteiro deu a saída guardada, duas vezes; os dois arquivos de teste passam contra `bythiago_int`; o SQL do arquivo é idêntico ao Apêndice A (`diff`); V3 anotada depois do lote C inteiro.

### Tarefa 2 — Catálogo de códigos

**Objetivo.** Um lugar só para traduzir código do lote e nome da Analytics API em rótulo, e para dizer qual origem tem detalhe privado.
**Arquivo.** `reporting/codigos.ts` (puro, sem import de banco nem de rede).
**Contrato.**
- `ORIGEM_LOTE: Record<string, { nome: string | null; rotulo: string; detalhe: 'termo' | 'url' | 'video' | 'canal' | 'outro' | 'nenhum' }>` com os 24 códigos da documentação (0, 1, 3, 4, 5, 7, 8, 9, 11, 14, 17, 18, 19, 20, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32). `nome` = o enum da Analytics API correspondente, ou `null` quando não há par certo. Pares que afirmo: 1 `ADVERTISING`, 3 `SUBSCRIBER`, 4 `YT_CHANNEL`, 5 `YT_SEARCH`, 7 `RELATED_VIDEO`, 8 `YT_OTHER_PAGE`, 9 `EXT_URL`, 11 `ANNOTATION`, 14 `PLAYLIST`, 17 `NOTIFICATION`, 18 `YT_PLAYLIST_PAGE`, 20 `END_SCREEN`, 24 `SHORTS`, 25 `PRODUCT_PAGE`, 26 `HASHTAGS`, 27 `SOUND_PAGE`, 28 `LIVE_REDIRECT`, 30 `VIDEO_REMIXES`, 0 `NO_LINK_OTHER`. Os demais ficam `null`. **O implementador confere cada par nas duas páginas da documentação antes de escrever; par que não conseguir confirmar fica `null`** (melhor "sem par" do que par errado: o par só serve para pôr origem do lote e origem da API na mesma linha de uma tela futura).
- `APARELHO_LOTE` (100 a 105) e `SISTEMA_LOTE` (1 a 32, sem o 8), com `nome` (`DESKTOP`, `TV`, `GAME_CONSOLE`, `MOBILE`, `TABLET`, `UNKNOWN_PLATFORM`; `ANDROID`, `IOS`, …) e `rotulo`.
- `rotuloOrigem(valor: string): { rotulo: string; catalogado: boolean }`: aceita código ou nome; fora do catálogo devolve `{ rotulo: 'código 99', catalogado: false }` (ou o próprio nome). Idem `rotuloAparelho`, `rotuloSistema`.
- `ORIGEM_DE_BUSCA = '5'`, `ORIGEM_EXTERNA = '9'`; `tipoDoDetalhe(codigo: string)`.
- **(emenda do portão: R3)** `MOTIVOS_NORMALIZADOR = ['bruto_ausente', 'gzip_invalido', 'cabecalho_inesperado', 'linha_invalida', 'canal_inesperado', 'dia_inesperado', 'recusado_pelo_banco'] as const` e `motivoNormalizadorHumano(codigo: string): string` (frase em português para cada código; código fora do catálogo → `motivo não catalogado`). É o único texto que vai à coluna `error` de `yt_reporting_reports` nesta etapa: o **código**. A frase sai da função, na nota de `falhas`.
**Testes.** `todo código visto em produção está no catálogo` (4, 5, 8; 101, 102, 104, 105; 2, 4, 5, 9, 12); `código fora do catálogo não some` (`'99'` → "código 99", `catalogado: false`); `a busca é o 5 e o externo é o 9`; `nenhum nome repetido em dois códigos`; `nome da API e código do mesmo par dão o mesmo rótulo`; `todo motivo do catálogo tem frase, e a frase não repete o código cru`; `motivo fora do catálogo não lança`.
**Pronto quando:** testes verdes; nenhum outro arquivo da etapa escreve um código numérico solto.

### Tarefa 3 — Leitor do CSV de `channel_traffic_source_a3`

**Objetivo.** Do texto do CSV às linhas agregadas prontas para a função, ou erro e nenhuma linha.
**Arquivo.** `reporting/traffic-source-csv.ts` (puro), no molde de `reach-csv.ts`.
**Contrato.**
- `CABECALHO_TRAFEGO`: as 15 colunas de F5, na ordem do arquivo real. Aceita as mesmas colunas em outra ordem; coluna a mais, a menos ou trocada = `cabecalho_inesperado`.
- `class CsvTrafegoError { motivo: 'cabecalho_inesperado' | 'linha_invalida' }`.
- `lerTrafego(csv: string): LinhaTrafego[]`, `LinhaTrafego = { day, channelId, videoId, sourceType, detail, views, watchTimeMinutes }` (as outras colunas são conferidas quanto à contagem de campos e ignoradas). Linha com aspas, número de campos diferente, data que não existe, `views` não inteiro, minutos não numérico ou negativo, `sourceType` fora de `^[A-Za-z0-9_]{1,40}$` = `linha_invalida`.
- `normalizarDetalhe(sourceType: string, bruto: string): string`: **`cleanText`** (de `competitor-capture.ts:63`; `sanitizeForDb` devolve `{ value, changed }`, não texto: emenda do portão, software m1); **só para a origem externa (9)**, corta no primeiro `?` ou `#`; `trim`. Para as outras origens o texto fica inteiro (um termo de pesquisa pode ter `?`).
- `cortarDetalhe(s: string): string` **(emenda do portão: dados I-4, software m2)**: `cleanText(Array.from(s).slice(0, 300).join(''))`. O corte é por ponto de código, não por unidade UTF-16: `slice(0, 300)` direto pode deixar meio emoji, que o `jsonb` recusa, e o relatório ficava preso na fila todo dia (o mesmo defeito que o commit `2861bdf1` consertou nos concorrentes).
- `agregarTrafego(linhas): DetalheDoDia[]`, `DetalheDoDia = { day, videoId, sourceType, detail (o resultado de `cortarDetalhe`: até 300 pontos de código), detailHash (sha256 em hexadecimal do detalhe normalizado INTEIRO, antes do corte), views, watchTimeMinutes }`. Chave de soma: `(videoId, day, sourceType, detailHash)`. Linha cuja soma dá `views = 0` e minutos 0 sai (e é contada no retorno `descartadasZeradas`).
**Testes** (sobre a fixture real, com o detalhe mascarado, mais linhas montadas sob o cabeçalho real).

| Nome | Entrada | Esperado |
|---|---|---|
| `lê o arquivo real` | fixture (7 linhas) | 7 linhas; tipos `'4'`, `'5'`, `'8'` |
| `só cabeçalho` | cabeçalho real | lista vazia, sem erro |
| `coluna trocada` (item 86) | `views` renomeada | `cabecalho_inesperado`; nenhuma linha |
| `coluna a mais` e `coluna a menos` | | idem |
| `linha com aspas` | um campo com `"` | `linha_invalida` |
| `soma por cima de país e inscrito` | duas linhas iguais com `country_code` diferente | uma linha, views somadas |
| `url sem query e sem fragmento` (item 88) | origem 9, `https://ex.com/p?utm_source=x&email=a@b.c#x` | `https://ex.com/p` |
| `mesma URL com duas query strings vira uma` (item 226) | duas linhas | uma, views somadas |
| `iguais nos 300 primeiros e diferentes depois são duas` (item 226) | dois detalhes de 350 caracteres | duas linhas, mesmo `detail`, `detailHash` diferentes |
| `termo com interrogação fica inteiro` | origem 5, `como fazer x?` | detalhe igual ao bruto |
| `detalhe vazio` | origem 5, vazio | uma linha com `detail: ''`; hash = sha256 da cadeia vazia |
| `NUL e substituto solitário` | detalhe com `\u0000` | limpo antes do hash |
| `detalhe com emoji atravessando a posição 300` (dados I-4) | `'a'.repeat(299) + '😀' + 'zz'` | `JSON.stringify` do retorno sem substituto solitário; `Array.from(detail).length` ≤ 300; `select $1::jsonb` no banco aceita (na Tarefa 12) |
| `linha zerada sai e é contada` | views 0, minutos 0 | fora; `descartadasZeradas` 1 |
**Armadilhas.** A fixture não pode ter termo real: copiar `c02-traffic-source-a3-forma.csv` (já mascarada). Nenhuma mensagem de erro leva o conteúdo da linha.
**Pronto quando:** testes verdes.

### Tarefa 4 — Leitor do CSV de `channel_reach_combined_a1`

**Objetivo.** Idem, para o alcance por dimensão.
**Arquivo.** `reporting/reach-combined-csv.ts` (puro).
**Contrato.**
- `CABECALHO_ALCANCE_COMBINADO`: as 9 colunas de F4.
- `class CsvAlcanceCombinadoError { motivo: 'cabecalho_inesperado' | 'linha_invalida' }`.
- `lerAlcanceCombinado(csv): LinhaAlcanceCombinado[]` = `{ day, channelId, videoId, deviceType, operatingSystem, trafficSourceType, impressions, ctr: number | null }`. As mesmas recusas de `reach-csv.ts` (taxa fora de 0 a 1, data inexistente, aspas). **(emenda do portão: dados m-6)** Os três códigos (`deviceType`, `operatingSystem`, `trafficSourceType`) são validados contra `^[A-Za-z0-9_]{1,40}$`, a mesma regra da tabela: fora disso é `linha_invalida` aqui, e não uma recusa do banco lá na frente. **`traffic_source_detail` é lido e descartado aqui: nunca sai do módulo.**
- `agregarAlcanceCombinado(linhas): AlcanceDimDoDia[]` = `{ day, videoId, trafficSourceType, deviceType, operatingSystem, impressions, clicksEst: number | null }`. Chave: `(videoId, day, trafficSourceType, deviceType, operatingSystem)`. `impressions` soma; `clicksEst` = soma de `impressions × ctr`, ou `null` se **alguma** linha da chave veio sem taxa. Chave com 0 impressões sai e é contada.
**Testes.** `lê o arquivo real` (uma fixture exportada de um bruto real, com o detalhe mascarado: o relatório de 30/09, 38 linhas); `só cabeçalho`; `coluna trocada` (item 86); `duas linhas com a mesma chave e detalhe diferente viram uma` (item 226: impressões 3 e 5 com taxas 0 e 0,2 → 8 impressões, 1 clique estimado; taxa lida = 0,125); `uma linha sem taxa na chave deixa cliques nulo`; `taxa 33.3 é linha inválida`; `código de aparelho com espaço é linha inválida` (dados m-6); `0 impressões sai e é contada`; `o detalhe não aparece em nenhum campo do retorno` (varre o JSON do retorno pelo texto do detalhe da fixture).
**Pronto quando:** testes verdes.

### Tarefa 5 — Cliente da Analytics API por dimensão

**Objetivo.** Uma função por consulta, lendo por nome de coluna, sem zero inventado.
**Arquivo.** `coleta/analytics-dimensoes.ts` (recebe o `fetch` de fora, como `analytics-diario.ts`; reusa `AnalyticsApiError` e `motivoDoGoogle`).
**Contrato.**
- `type Familia = 'traffic_source' | 'device_os' | 'country' | 'subscribed_status'`.
- `MODO_DA_FAMILIA: Record<Familia, 'com_dia' | 'por_dia'>` = `{ traffic_source: 'com_dia', device_os: 'com_dia', subscribed_status: 'com_dia', country: 'por_dia' }` (o resultado da Tarefa 0b pode mudar as três primeiras).
- `DIMENSOES_DA_FAMILIA`: `traffic_source` → `insightTrafficSourceType`; `device_os` → `deviceType,operatingSystem` (valor gravado `MOBILE|ANDROID`); `country` → `country`; `subscribed_status` → `subscribedStatus`.
- `dimensaoDoVideo(i: { token; canalUc; videoId; familia; inicio; fim; f }): Promise<{ linhas: LinhaDim[]; estendidas: 'ok' | 'recusadas'; invalidas: number }>`, `LinhaDim = { day: string; valor: string; views?: number; engaged_views?: number; watch_time_minutes?: number }`. Em modo `por_dia`, `inicio` tem de ser igual a `fim` (senão lança) e `day` = `inicio`.
- Métricas: `views,estimatedMinutesWatched,engagedViews`; em 400, repete sem `engagedViews` e devolve `estendidas: 'recusadas'`; se o segundo também der 400, lança `AnalyticsApiError(400, motivo)`.
- 200 sem `columnHeaders` → `AnalyticsApiError(200, 'corpo_sem_cabecalho')`. 200 com `columnHeaders` e sem `rows` (ou `rows: []`) → `linhas: []`. Falta a coluna da dimensão, `day` (em `com_dia`) ou `views` → `AnalyticsApiError(200, 'sem_coluna_<nome>')`.
- Valor de dimensão fora de `^[A-Za-z0-9_|]{1,80}$`, país fora de `^[A-Z]{2}$`, dia fora de `[inicio, fim]` → a linha sai e soma em `invalidas`.
- Nunca guarda o corpo de erro.
**Testes** (com as fixtures da C0.2; as da 0b entram quando existirem).

| Nome | Entrada | Esperado |
|---|---|---|
| `país de um dia` | `c02-pais-um-dia.json` (dia com 215 views) | `[BR 191, CA 13]`, com `day` = o dia pedido |
| `dia sem view` | 200 com `rows: []` | `linhas: []` |
| `200 sem cabeçalho` | `{}` | lança `corpo_sem_cabecalho` |
| `day,country recusado` | `c02-day-country.json` (400) | lança `AnalyticsApiError(400, …)` |
| `métrica ausente não vira zero` | linha sem `estimatedMinutesWatched` no cabeçalho | chave ausente |
| `engagedViews recusada` | 400 na primeira, 200 na segunda | `estendidas: 'recusadas'`, duas chamadas |
| `aparelho e sistema viram um valor` | `['2026-10-05','MOBILE','ANDROID',3,1]` | `valor: 'MOBILE|ANDROID'` |
| `valor inválido sai e é contado` | país `'br'`; valor com espaço | `invalidas` 2 |
| `por_dia com inicio diferente de fim` | | lança antes de chamar |
| `a URL` | qualquer | `ids=channel==…`, `filters=video==…`, `startDate`, `endDate`, sem `maxResults` |
**Pronto quando:** testes verdes.

### Tarefa 6 — Configuração, janela, forma da prova, guarda de schema e paginação

**Arquivos.** `coleta/e11-config.ts`; `coleta/paginar.ts`. **(emenda do portão: decisão 5)** `coleta/passos-desligados.ts` **não é desta tarefa**: é da Tarefa 2 do plano das ordens 8 e 10, com o contrato que a primeira versão deste plano propôs e uma função a mais: `passoDesligado(nome: PassoComInterruptor, env = process.env): boolean` (lê `YT_OWN_STEPS_OFF`, lista separada por vírgula; variável ausente ou vazia = nenhum desligado), `nomesDesconhecidos(env): string[]` e `notaNomesDesconhecidos(env): string | null`. Os nomes desta etapa (`dimensoes`, `normalizadores`) já estão lá. Os dois arquivos desta tarefa não importam nada daquela: **esta tarefa não espera por ela**.
**Contrato de `e11-config.ts`.**
- **(emenda do portão: software I2)** `DIMENSOES_DESDE: string` (`'AAAA-MM-DD'`, dia do Pacífico) e `DIMENSOES_LIGADO_EM: string` **nascem preenchidas** com a data prevista do envio que o controlador der ao despachar a tarefa (na falta, o dia da tarefa mais 7) e a mesma data menos 10. A Tarefa 14 as **confirma** no commit do envio. Nunca ficam vazias no repositório: com elas vazias, toda execução de `rodarColeta` nos testes existentes ganhava uma nota em `falhas` e quatro arquivos de teste que afirmam `falhas` vazia quebravam.
- `type ConfigE11 = { desde: string; ligadoEm: string }`. `configE11(entrada: Partial<ConfigE11> = { desde: DIMENSOES_DESDE, ligadoEm: DIMENSOES_LIGADO_EM }): { ok: true } & ConfigE11 | { ok: false; motivo: string }`: recusa vazio, formato inválido, data que não existe, `desde > ligadoEm`. **A configuração entra por parâmetro** nos passos e nos critérios (`ctx.e11`); as constantes são só o padrão do orquestrador.
- `JANELA_DIAS = 10`, `MAX_CONSULTAS_DIMENSOES = 400`, `FOLGA_PARA_COMECAR_MS = 3_000`, `CARENCIA_COBERTURA_DIAS = 3`, `CARENCIA_NORMALIZAR_DIAS = 5`, `PRAZO_DA_PROVA_MS = 5_000`, `TIPOS_E11 = { detalhe: 'channel_traffic_source_a3', alcance_dim: 'channel_reach_combined_a1' }`, `LOTE_DESDE = '2026-09-08'` (o primeiro dia do bruto guardado: só rótulo de leitura).
- `janelaDoConjunto(p: { desde: string; hoje: string; ultimoCoberto: string | null; baseAte: string | null }): { de: string; ate: string } | null`: `de = maior(desde, menor(hoje − 10, ultimoCoberto ?? desde))`; `ate = menor(hoje, baseAte)`; `null` se `baseAte` é nulo ou `ate < de`. **É a mesma fórmula de `yt_own_dim_cover_idle`**; um teste de integração (Tarefa 12) compara as duas.
- **(emenda do portão: software I4; dados m-1)** `type ProvaE11 = { faltando_cobertura: number; videos_com_base: number; videos_base_antes_do_inicio: number; videos_sem_base: number; base_ate: string | null; dias_dois_relatorios_detalhe: number; dias_dois_relatorios_alcance: number; pendentes_normalizar: number }` e `lerProva(x: unknown): { ok: true; prova: ProvaE11 } | { ok: false; campo: string }` (campo ausente, não numérico ou negativo = não ok; nunca vira 0). **Moram aqui**, e é daqui que os passos e os critérios importam.
- `chamarProva(sb, p: { site: string; hoje: string; desde: string }, deadline: number): Promise<{ ok: true; prova: ProvaE11 } | { ok: false; motivo: 'schema_ausente' | 'sem_resposta' | 'erro_de_banco' | 'forma_inesperada'; campo?: string }>`: `rpc('yt_own_dim_prova', { p_site, p_hoje, p_desde })` dentro de `comPrazo`.
- `schemaE11(sb, p: { site: string; hoje: string; desde: string }, deadline: number): Promise<{ ok: true; prova: ProvaE11 } | { ok: false; nota: string }>`: chama `chamarProva`; código de schema ausente (`ehSchemaAusente`) → `schema_ausente: MG7 não aplicada (yt_own_dim_prova)`; e um `select` de uma linha em `yt_own_video_coverage` → `schema_ausente: MG14 não aplicada (yt_own_video_coverage)`. A prova que ela devolve serve **só** à guarda de schema e ao `base_ate` do resumo do passo: os critérios chamam a prova de novo, depois dos passos.
**Contrato de `paginar.ts` (emenda do portão: software m4).** `lerPaginado<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: ErroBanco | null }>, teto: number): Promise<{ ok: true; linhas: T[] } | { ok: false; motivo: 'erro_de_banco' | 'passou_do_teto'; lidas: number }>`: páginas de 1.000 por `.range`, para quando a página vem com menos de 1.000, e falha (não corta em silêncio) se passar do teto. Sem `server-only`, sem import do Observatório.
**Testes.** `configE11: vazia, malformada, data que não existe e desde > ligadoEm = não ok` (entrada passada ao teste; **não** depende das constantes); `as constantes do repositório são uma configuração válida`; `janela: nunca antes de desde` (item 228, parte pura); `janela: último coberto há 20 dias começa nele`; `janela: base nula = null`; `janela: base antes de de = null`; `lerProva: campo faltando, texto no lugar de número e negativo = não ok com o nome do campo`; `chamarProva: promessa que não resolve = sem_resposta`; `schemaE11 com 42883 diz MG7`; `com PGRST205 na cobertura diz MG14`; `lerPaginado: 2.500 linhas em três páginas`; `lerPaginado: passou do teto = não ok com o número lido`; `lerPaginado: erro na segunda página = não ok`.
**Pronto quando:** testes verdes.

### Tarefa 7 — Passo "dimensões"

**Objetivo.** O passo diário da Analytics API, com orçamento, sem zero inventado e com cobertura contígua.
**Arquivo.** `coleta/dimensoes-step.ts`.
**Contrato.** `passoDimensoes(ctx: StepCtx & { e11: ConfigE11; hoje?: string; token?: (c: ColetaChannel) => Promise<string | null> }): Promise<DimensoesResumo>`, com
`DimensoesResumo extends StepResumo { ate: string; desde: string; consultas: number; consultas_cortadas: number; videos_com_view: number; conjuntos_cobertos_sem_api: number; dias_mantidos: number; dias_em_revisao: number; fora_do_teto: number; valores_invalidos: number; estendidas_recusadas: number; base_ate: string | null }`.
**(emenda do portão: R6)** `token` é a injeção do ensaio: quando vem, o passo **não** chama `obterToken` (que renova e **grava** o token em produção). Em produção não vem, e o passo usa `obterToken`, com o mesmo tratamento de erro do diário.
**Sequência, por canal com `sync_enabled`.**
1. `configE11(ctx.e11)` não ok → nota `dimensões: data de partida inválida (e11-config.ts)` e fim. `schemaE11` (uma vez por site) não ok → nota, tentativa `schema_ausente` por canal, fim.
2. **(emenda do portão: dados m-5; software m7)** Com menos de `FOLGA_PARA_COMECAR_MS` de prazo, não chama nada: canal `nao_alcancado_orcamento`. Senão `yt_own_dim_cover_idle(canal, desde, hoje − 10, hoje)` dentro de `comPrazo`. Erro ou sem resposta → nota e próximo canal.
3. Lê a cobertura do canal (conjuntos `base`, `trafego`, `dispositivo`, `pais`, `inscrito`) com `lerPaginado`, teto de 20.000.
4. Para cada vídeo e conjunto, `janelaDoConjunto`. **(emenda do portão: dados I-3)** Só então lê o diário com `views > 0`, **com `day_pt >=` o menor `de` entre as janelas do canal** (em regime, hoje − 10; nunca "desde a data de partida"), com `lerPaginado`, teto de 20.000. Vídeo "com view" **para aquele conjunto** = tem dia com `views > 0` dentro da janela dele. Fila: sem cobertura primeiro, depois cobertura mais antiga.
5. Token.
6. **Famílias `com_dia`**, `emParalelo(PARALELO)`: para cada vídeo com view, em sequência: `dimensaoDoVideo(inicio = de, fim = até)` e `yt_own_dim_apply(vídeo, família, de, até, linhas)`. Falha da consulta = nada é gravado para aquela família.
7. **Famílias `por_dia` (hoje: país). (emenda do portão: dados C-1 e I-5; software C1)** Para cada vídeo com view: os dias com view da janela, **em ordem crescente**; `dimensaoDoVideo(inicio = fim = dia)` para cada um, juntando as linhas. **O primeiro dia que não for respondido (erro, cota, sem tempo, teto de consultas) encerra o vídeo naquela família:** os dias seguintes não são consultados. `ateFeito` = `até` se todos os dias com view responderam; senão, o dia anterior ao primeiro que não respondeu. Se `ateFeito >= de`: **uma** chamada `yt_own_dim_apply(vídeo, família, de, ateFeito, todas as linhas juntas)`. Se `ateFeito < de` (falhou o primeiro dia e não há dia antes na janela): nenhuma chamada. Assim os dias sem view da janela ficam cobertos, a cobertura do conjunto é contígua e a prova de "último dia coberto" basta.
8. Antes de cada vídeo (passo 6) e de cada dia (passo 7): `restante(deadline) < FOLGA_PARA_COMECAR_MS` ou `consultas >= MAX_CONSULTAS_DIMENSOES` → não começa; tentativa `nao_alcancado_orcamento` do vídeo; `pendentes++` (e `consultas_cortadas++` no segundo caso). Toda `rpc` vai dentro de `comPrazo(…, ctx.deadline)`; nulo = "pendente".
9. Tentativa por vídeo (`kind: 'dimensoes'`, `scope_type: 'video'`): `ok`; `sem_dado_na_janela` (todas as famílias vieram vazias); `erro_http`; `sem_autorizacao`; `nao_alcancado_orcamento`. Tentativa por canal no fim. **(emenda do portão: R3)** A coluna `error` da tentativa recebe **só um valor do catálogo fechado de `coleta/motivo.ts`** (Tarefa 2 do plano das ordens 8 e 10): um dos fixos (`erro_de_banco`, `forma_inesperada`, …), `http_<status>`, ou `http_<status>_<motivo>` quando o motivo do Google está na lista conhecida de lá (como `quotaExceeded`). O passo usa a função daquele arquivo para montar o valor; nunca `message`, `details` ou corpo de resposta.
10. Notas em `falhas`: `dimensões: <canal>: N de M vídeos com erro (<primeira causa, por código>)`; `dimensões: a API recusou a consulta de <família> (HTTP 400)`; `dimensões: cota da Analytics API esgotada`; `dimensões: <canal>: N valor(es) de dimensão em formato inesperado`.
**`metric_version`** de cada linha: `metricVersion(day)`.
**Testes** (`fake-supabase` com `rpcHandlers` para as funções; `fetch` falso que **registra as URLs**; `ctx.e11` com datas relativas a hoje).

| Nome | Entrada | Esperado |
|---|---|---|
| `vídeo sem view não gera chamada` (item 91) | 3 vídeos, nenhum com view | 0 chamadas ao `fetch`; 1 `yt_own_dim_cover_idle` por canal |
| **`vídeo com view: 2 dias com view → 5 consultas e 4 gravações`** (dados C-1, software C1) | 1 vídeo, 2 dias com view no meio da janela | 5 chamadas ao `fetch`; **4** `yt_own_dim_apply`; a de `country` com `p_from = de`, `p_to = até` e as linhas dos dois dias |
| **`país: dia com view que falhou corta a cobertura no dia anterior`** (dados I-5) | 3 dias com view; erro HTTP no segundo | o terceiro **não** é consultado; uma `yt_own_dim_apply` de `country` com `p_to` = dia anterior ao segundo e só as linhas do primeiro; tentativa `erro_http` |
| **`país: o primeiro dia com view falha`** | view no 3º dia da janela; erro | `yt_own_dim_apply` de `country` com `p_to` = 2º dia e `p_rows: []` (cobre os dias sem view antes); se a view é no 1º dia da janela, nenhuma chamada |
| **`país: sem tempo no meio dos dias`** | prazo vencendo depois do 1º dia | uma gravação até o dia anterior ao 2º; `nao_alcancado_orcamento`; `pendentes` 1 |
| `nenhuma chamada antes da data de partida` (item 228) | `desde` = hoje − 10; cobertura nula; diário com view há 30 dias | todo `startDate` ≥ `desde` |
| `depois de 20 dias parado começa no último coberto` | último coberto = hoje − 20, `desde` = hoje − 40 | `startDate` = hoje − 20 |
| **`o diário é lido a partir do menor começo de janela`** (dados I-3) | `desde` de 3 anos atrás; coberturas em dia | o filtro `gte('day_pt', …)` da leitura do diário é hoje − 10 |
| `resposta vazia grava sem_dado_na_janela e chama a função com lista vazia` | `rows: []` | tentativa `sem_dado_na_janela`; `p_rows: []` |
| `200 sem cabeçalho é erro, não vazio` | `{}` | tentativa `erro_http`; nenhuma função chamada para aquela família |
| `sem tempo não começa vídeo novo` (item 91) | prazo vencendo depois do 1º vídeo | 2º e 3º com `nao_alcancado_orcamento`; `pendentes` 2 |
| **`cover_idle não é chamada com menos de 3 s`** (dados m-5) | prazo a 2 s | 0 `rpc`; canal `nao_alcancado_orcamento` |
| **`função de banco que não responde vira pendente`** (software m7) | `rpc:yt_own_dim_apply` com promessa que não resolve e prazo curto | o passo termina; `pendentes` ≥ 1; nenhuma exceção |
| `teto de consultas` | `MAX_CONSULTAS_DIMENSOES` baixado para 4 no teste | `consultas_cortadas` > 0; nota de orçamento |
| `quem ficou para trás entra primeiro` | vídeo A coberto ontem, B nunca | B antes de A na ordem das chamadas |
| `401 marca reautorizar e para o canal` | 401 na 1ª | `marcarReautorizar` uma vez; restantes `sem_autorizacao` |
| `cota esgotada não marca reautorizar` | 403 `quotaExceeded` | nota de cota; canal não marcado; `error` da tentativa = `http_403_quotaExceeded` |
| `motivo do Google fora da lista conhecida não vai à coluna` (R3) | 403 com `reason` = um texto livre | `error` = `http_403`, sem o texto |
| `400 numa família com_dia não troca de modo` | 400 em `device_os` | nota "a API recusou a consulta de aparelho e sistema"; as outras famílias gravam |
| `schema ausente não chama a API` | `schemaE11` falha | 0 chamadas; tentativa `schema_ausente` |
| `configuração inválida` | `ctx.e11 = { desde: '', ligadoEm: '' }` | nota; 0 chamadas |
| `erro de banco na função` | erro em `rpc:yt_own_dim_apply` com `message` e `details` cheios | tentativa `erro_http` com `error: 'erro_de_banco'`; nem `message` nem `details` aparecem na tentativa nem em `falhas` (R3); passo segue |
| `soma os contadores das funções` | funções devolvendo `dias_mantidos: 1`, `dias_em_revisao: 2`, `fora_do_teto: 3` | resumo com os mesmos |
| `leitura truncada falha` | 20.001 linhas de cobertura | nota com o número; canal pulado |
| **`com token injetado, obterToken não é chamado`** (R6) | `ctx.token` devolvendo um token | espião em `ensureFreshToken`: 0 chamadas; nenhum `update` em `social_connections` |
**Armadilhas.** O passo **não** grava linha nenhuma direto na tabela: só pelas funções. Não usar `current_date` do banco nem `toISOString()` para o dia: `dayPt`. As famílias compartilham o contador de consultas. Uma promessa de `marcarAutorizado` por canal (como no diário). Não importar `readAll` de `observatorio/load.ts` (é `server-only` e puxa o Observatório inteiro): `lerPaginado`.
**Pronto quando:** testes verdes; nenhum `from('yt_own_video_dim_daily').upsert` no arquivo (grep); nenhum `error.message` nem `error.details` em argumento de tentativa ou de `falhas` (grep).

### Tarefa 8 — Passo "normalizadores"

**Objetivo.** Normalizar o bruto dos dois tipos, o que já está guardado e o de cada dia.
**Arquivo.** `coleta/normalizadores-step.ts` (no molde de `alcance-step.ts`, sem tocar nele).
**Contrato.** `passoNormalizadores(ctx: StepCtx): Promise<NormalizadoresResumo>`, com
`NormalizadoresResumo extends StepResumo { por_tipo: Record<'detalhe' | 'alcance_dim', { normalizados: number; vazios: number; superados: number; erros: number; sem_par: number; descartadas_zeradas: number; codigos_fora_do_catalogo: number }> }`.
**Sequência.** Uma leitura da fila (`report_type_id in` os dois, `status in ('baixado','vazio')`, `normalized_at is null`, canais do contexto, `order by create_time`, `limit 201`; a leitura traz também `start_time`). Por relatório: prazo (menos de 3 s, para e conta `pendentes`); vídeos do canal (uma leitura por canal, teto 1.000, truncada = espera); bruto; `gunzip`; leitor da Tarefa 3 ou 4; confere canal (`canal_inesperado`) e dia (`dia_inesperado`: toda linha com `day` = data UTC do `start_time`); agrega; monta `p_rows` com `video_id` do mapa (ou ausente), `metric_version`; chama `yt_own_traffic_detail_apply` ou `yt_own_reach_dim_apply` (dentro de `comPrazo`) com `p_unmatched = { count, ids }` ou `null`. **A função marca `normalized_at`**: o passo não faz `update` de sucesso.
**Erros (emenda do portão: R3; dados m-6; software m8 e m9).**
- **De conteúdo** → o relatório vai a `status: 'erro'`, com `error` = **um código de `MOTIVOS_NORMALIZADOR`** (Tarefa 2), nunca texto de exceção; nota `normalizadores: relatório <id> de <canal> não pôde ser normalizado (<frase de motivoNormalizadorHumano>)`. São de conteúdo: os motivos dos leitores, `canal_inesperado`, `dia_inesperado`, `bruto_ausente`, `gzip_invalido` e **a recusa do banco por conteúdo** (`rpc` com código `23505`, `23514` ou `22P02`) → `recusado_pelo_banco`.
- **De banco, passageiros** (qualquer outro erro da `rpc`, ou sem resposta até o prazo) → o relatório **fica na fila**; conta em `pendentes`.
- **Sentry:** `captureMessage('normalizadores: <código>', { tags: { cron, passo: 'normalizadores' }, extra: { report: <id>, pg_code: <código do Postgres ou nulo> } })`. **Nunca** `error.message`, `error.details` nem `error.hint`: o erro de `check` do Postgres traz "Failing row contains (…)", com o termo pesquisado dentro.
- Com o conserto do I-1 no SQL, um relatório mais velho não sai mais `superado` antes de o mais novo ter sido normalizado; o runbook (Tarefa 14) ainda diz: "ao consertar ou desistir de um relatório em `erro`, ponha `normalized_at = null` nos outros do mesmo canal e dia e rode de novo".
**Tentativas.** Uma por canal e tipo no fim (`kind: 'normalizador_trafego'` ou `'normalizador_alcance_dim'`, `scope_type: 'canal'`): `ok`, `nao_alcancado_orcamento` (sobrou fila) ou `erro_http` (algum relatório em erro), com `error` = `forma_inesperada` (um dos motivos fixos do catálogo de `coleta/motivo.ts`, o único que a coluna da tentativa aceita; o código específico de `MOTIVOS_NORMALIZADOR` fica na linha do relatório e na nota).
**Testes.**

| Nome | Entrada | Esperado |
|---|---|---|
| `normaliza os dois tipos` | um relatório de cada, fixtures reais | uma chamada a cada função, com `p_report_id` certo |
| `vazio chama a função com lista vazia` | bruto só com cabeçalho | `p_rows: []`; conta em `vazios` |
| `cabeçalho inesperado: erro e nenhuma linha` (item 86) | coluna trocada | `status: 'erro'`, `error: 'cabecalho_inesperado'`; função não chamada; nota em `falhas` com a frase |
| `bruto ausente`, `gzip inválido` | | `erro` com o código |
| `linha de outro canal`, `linha de outro dia` | | `canal_inesperado`, `dia_inesperado`; função não chamada |
| `superado é contado e sai da fila` | função devolve `status: 'superado'` | `superados` 1 |
| `sem par` | vídeo fora do mapa | linha sem `video_id`; `p_unmatched` com o id; `sem_par` 1 |
| `código fora do catálogo é gravado e contado` | origem `'99'` | vai em `p_rows`; `codigos_fora_do_catalogo` 1 |
| `sem tempo` | prazo vencendo | `pendentes` = o resto; tentativa `nao_alcancado_orcamento` |
| `fila maior que 200` | 201 lidos | 200 processados, `pendentes` ≥ 1 |
| `schema ausente na função para o passo` | `PGRST202` | `parar`; nota `schema_ausente` |
| `erro de banco passageiro deixa o relatório na fila` | erro `57014` em `rpc:` | `pendentes` 1; `status` e `normalized_at` não tocados |
| **`recusa do banco por conteúdo marca erro`** (dados m-6) | `rpc` com `23514`; outro com `23505`; outro com `22P02` | `status: 'erro'`, `error: 'recusado_pelo_banco'` nos três; não ficam na fila |
| **`função que não responde até o prazo`** (software m7) | promessa que não resolve | `pendentes`; nada marcado |
| **`o termo não vaza por erro de banco`** (software m9) | `rpc` com `23514` cujo `message` e `details` levam `zz-sentinela-e11` | o sentinela não aparece em `falhas`, no `error` gravado, na tentativa, nem em nenhum argumento do Sentry (espião) |
| `o detalhe não vaza por erro de leitura` | fixture com sentinela no detalhe e cabeçalho quebrado | idem |
**Armadilhas.** Não marcar `erro` por falha passageira de banco. O relatório marcado `erro` por conteúdo segue o destino dos de alcance básico (critério de relatório em erro, 14 dias). Não reaproveitar o teto do passo de alcance.
**Pronto quando:** testes verdes; `grep -n "\.message\|\.details\|\.hint" normalizadores-step.ts` só em comparação de código de erro, nunca em valor gravado ou enviado.

### Tarefa 9 — Critérios da E11

**Objetivo.** Os alarmes, testados nos dois sentidos, com carência escrita e com caminho até o vermelho.
**Arquivo.** `coleta/criteria-e11.ts`.
**Contrato.** `criteriosE11(ctx: { supabase; falhas; hoje: string; e11: ConfigE11; sites: string[]; desligados: { dimensoes: boolean; normalizadores: boolean } }): Promise<{ provas: Record<string, ProvaE11 | null>; avaliados: string[]; desligados: string[] }>`. **(emenda do portão: software I4; dados m-1)** Chama **sempre** `chamarProva` (Tarefa 6), uma vez por site de `ctx.sites` (os sites dos canais com coleta ligada; hoje, um), com `PRAZO_DA_PROVA_MS`. Não aceita prova pronta de fora: a que `schemaE11` trouxe é de antes dos passos.
**(emenda do portão: R9) O caminho até o vermelho.** `rodarColeta` (`coleta/index.ts`) chama `criteriosE11` na fase `depois` → cada regra abaixo faz `pushUnico(ctx.falhas, …)` → a rota `api/cron/sync-analytics-metrics/route.ts` dá o veredito num lugar só (`falhas.length > 0` grava a falha do cron). A Tarefa 10 tem o teste na rota.
**Regras** (cada nota é o texto que o dono lê):
- `chamarProva` não ok → `dimensões: prova não avaliada (<sem resposta em 5 s | erro de banco | forma inesperada: <campo>>)`. Vale para a exceção de parâmetro nulo. Nunca tratado como 0.
- **(emenda do portão: decisão 3; software I3)** `videos_com_base = 0` e `videos_sem_base > 0` → `dimensões: nenhum vídeo com cobertura do diário (base): confira se a dieta (E6 P2) está em produção`. Com `videos_com_base > 0`, `videos_sem_base` vai só no resumo (o alarme por vídeo é do critério de cobertura da dieta).
- `base_ate < hoje − 4` (com `videos_com_base > 0`) → `dimensões: a cobertura do diário (base) parou em dd/mm no canal mais atrasado`.
- `faltando_cobertura > 0` e `hoje >= ligadoEm + 3` → `dimensões: N par(es) vídeo e conjunto sem cobertura até dd/mm (origem, aparelho, país ou inscrito)`. Antes disso só no resumo.
- `dias_dois_relatorios_detalhe > 0` ou `…_alcance > 0` → `normalizadores: N dia(s) com linhas de dois relatórios (item 249)`. Sem carência.
- `pendentes_normalizar > 0` e `hoje >= ligadoEm + 5` → `normalizadores: N relatório(s) baixado(s) há mais de 2 dias sem normalizar`.
- passo desligado: os critérios dele não rodam e o nome vai em `desligados` (o orquestrador grava `desligado`, nunca "ok"). O vermelho da 8ª execução desligado em diante é do `criterioDesligados` do plano das ordens 8 e 10 (decisão 6): a Tarefa 10 põe o nome na lista que ele recebe.
**Testes (unidade, com a prova falsa).** Para cada número: `sobe` (entrada que o deixa vermelho), `não sobe` (entrada que não pode), `tabela vazia` (tudo 0, `base_ate` nulo e 0 vídeos = sem nota). Em especial: `nenhuma base e vídeos antigos = vermelho`; `base em alguns e 2 vídeos sem base = sem nota, número no resumo`; `base_ate há 5 dias = vermelho; há 4 = sem nota`; `carência da cobertura` (dia 2 = só resumo; dia 3 = nota); `carência da fila` (dia 4 e dia 5); `prova que não responde em 5 s` (promessa que não resolve) = nota; `rpc que devolve o erro de parâmetro nulo` = nota "prova não avaliada"; `campo faltando` = nota com o campo; `dois sites: uma chamada por site, notas separadas`; `desligado não avalia e diz desligado`.
**Testes contra o banco (R9; rodam na Tarefa 12, com a função real, dentro de `observatorio-a5-e11-passos.test.ts`).** Para **cada** número da prova, pelo caminho inteiro `criteriosE11 → falhas`: uma semente que o faz subir e põe a nota, uma que não pode, e a chamada com `site` nulo (tem de pôr "prova não avaliada", nunca passar em silêncio).
**Pronto quando:** testes de unidade verdes.

### Tarefa 10 — Integração (a única que toca arquivo existente da coleta)

**Arquivos.** Os nove da linha 10 da tabela da seção 9. **(emenda do portão: software I2)** A primeira versão não fechava verde com a lista que dava: `reporting-client.test.ts` afirma o valor de `SEM_NORMALIZADOR`, e `tres-dias.test.ts`, `orcamento.test.ts` e `test/cron/sync-analytics-metrics-veredito.test.ts` exercitam `rodarColeta` de verdade com `falhas` vazia.
**Antes de começar.** Conferir que a Tarefa 2 do plano das ordens 8 e 10 está commitada: `passos-desligados.ts` com os nomes `dimensoes` e `normalizadores`, `kinds.ts` com os três `kind` daqui, `TETOS_DE_FIM_MS` com as duas chaves daqui, `criteria-desligados.ts`. Se algo faltar, **não criar nem editar por conta própria**: avisar o controlador (decisão 5).
**Mudanças, uma por arquivo.**
- `index.ts`: `ColetaCtx` ganha `e11?: ConfigE11` (padrão: as constantes de `e11-config.ts`). **Na ordem da seção 4:** depois do bloco do diário e antes de `criteriosL2`: (1) se `passoDesligado('dimensoes')` → `resumo.dimensoes = { desligado: true }` e o nome entra na lista `desligados` da fase; senão `passo('dimensoes', TETOS_DE_FIM_MS.dimensoes, 'dimensoes', ativos, c => passoDimensoes({ ...c, e11 }))`; (2) idem `normalizadores`, com **`kind` do auxiliar = `'normalizador_trafego'`** e `servidos` vazio, como o alcance faz (o passo grava as próprias tentativas por tipo: software m5); (3) **depois de `criteriosL2` (e de `criterioCobertura`, se a dieta já integrou) e antes da retenção**, `criteriosE11` num `try` próprio, com `resumo.e11 = { provas, avaliados, desligados }`; (4) `criterioOrcamento` ganha os três `kind` novos na lista; (5) a lista `desligados` é uma só para a fase e é a que `criterioDesligados` recebe: se o bloco da E8 ainda não existir, este plano cria a lista e a chamada a `criterioDesligados`, e a nota `pushUnico(falhas, notaNomesDesconhecidos())`, do jeito que o plano das ordens 8 e 10 escreve (Tarefa 11a de lá); se já existir, só faz `push` dos dois nomes.
- `reporting/types.ts`: `SEM_NORMALIZADOR` passa a excluir também os dois tipos da E11 (com a MG13 a função de apagar devolve 0 de qualquer jeito; a lista só fica coerente). `reporting-client.test.ts`: a afirmação da linha 24 acompanha.
- `criteria.ts`, linha 239: o comentário "Esses tipos só guardam o bruto" fica falso; trocar por "tipos sem normalizador, mais os dois da E11 quando o erro é de conteúdo (ver normalizadores-step.ts)". **Só o comentário.**
- `fake-supabase.ts`: respostas padrão para as seis funções novas, no molde de `comReachApply` (a prova padrão devolve as oito chaves em zero, com `videos_com_base` 1 e `base_ate` = hoje, para não acender nota em teste que não é da E11).
- `tres-dias.test.ts`, `orcamento.test.ts`, `sync-analytics-metrics-veredito.test.ts`: passam a usar o falso com as respostas padrão; onde afirmam `falhas` vazia, continuam afirmando.
**(emenda do portão: software m6)** Uma linha de aviso: sem a MG14, a tentativa `nao_alcancado_orcamento` de `kind: 'dimensoes'` é gravada pelo auxiliar `passo` **antes** da guarda de schema e bate no `check` antigo de seis valores; a nota sai "erro de banco ao gravar", não "schema_ausente". Só acontece fora da ordem de deploy (código antes do lote C), que a Tarefa 14 proíbe.
**Testes.** Em `index.test.ts`: `os dois passos rodam depois do diário e antes de criteriosL2` (ordem das chamadas); `passo desligado entra na lista que criterioDesligados recebe` (decisão 6); `criteriosE11 roda depois dos dois passos e chama a prova de novo` (duas chamadas a `yt_own_dim_prova`: a da guarda e a dos critérios; a segunda vê o que o passo gravou); `sem tempo: não rodam, gravam nao_alcancado_orcamento e o resumo diz sem_tempo`; `YT_OWN_STEPS_OFF=dimensoes: resumo.dimensoes.desligado e nenhuma chamada` (item 245); `sem a variável: os dois rodam` (apaga a variável); `um passo novo que lança não derruba os critérios nem a nota de conferências, que continua a última`; `fase 'antes' não roda nenhum dos dois`; `ctx.e11 inválido: nota de data de partida e os passos antigos seguem`. **Em `sync-analytics-metrics-veredito.test.ts` (R9):** `nota da E11 deixa o cron vermelho` (prova falsa com `faltando_cobertura: 3` e `ligadoEm` há 5 dias → `recordCronFailure` com o texto da nota) e `prova limpa não deixa` (`recordCronSuccess`).
**Armadilhas.** A nota de conferências tem de continuar a **última** de `falhas` (um teste já trava). Não mexer na ordem dos passos antigos. Se E6 P2, E8 ou E18 já integraram, encaixar na ordem da seção 4. Não abrir `clock.ts`, `kinds.ts`, `types.ts` nem `passos-desligados.ts`.
**Pronto quando:** `npx vitest run test/youtube/coleta test/api/cron test/cron` verde (saída em arquivo; só as falhas no contexto) e `npm run typecheck -w apps/web` limpo.

### Tarefa 11 — Modelo dos estados e leitor de servidor (sem tela)

**Arquivos.** `proprio/dimensoes-estado.ts` (puro); `proprio/ler-dimensoes.ts` (`server-only`).
**Contrato do modelo.**
- `type EstadoValor = { tipo: 'valor'; views: number | null; minutos: number | null } | { tipo: 'zero_medido' } | { tipo: 'zero_ou_abaixo_do_limiar' } | { tipo: 'em_revisao' } | { tipo: 'nao_medido'; motivo: 'antes_do_inicio' | 'fora_da_cobertura' | 'base_nao_medida'; desde: string | null }`.
- `estadoDoDia(p: { coberto: boolean; baseMedida: boolean; antesDoInicio: boolean; desde: string | null; linhas: { valor: string; views: number | null; minutos: number | null }[]; base: number | null }): { soma: number; omitido: number | null; emRevisao: boolean; de(valor: string): EstadoValor }`. Regras, nesta ordem: antes do início → `nao_medido/antes_do_inicio`; não coberto no conjunto → `nao_medido/fora_da_cobertura`; **(emenda do portão: dados I-2)** coberto no conjunto e `baseMedida` falso → `nao_medido/base_nao_medida` para todo valor do dia (a base ausente **não** vira zero); coberto e base medida: há linha do valor → `valor`; sem linha: `soma = base` → `zero_medido`; `soma < base` → `zero_ou_abaixo_do_limiar`, `omitido = base − soma`; `soma > base` → `em_revisao` (para **todo** valor do dia, inclusive os que têm linha, e `omitido = null`). Com `baseMedida` verdadeiro, `base` nula quer dizer "o dia foi medido e não teve atividade": base 0.
- `taxaDeClique(impressoes: number | null, cliquesEst: number | null): number | null` (nula se faltar um dos dois ou impressões 0).
**`baseMedida`, por conjunto (o leitor calcula e passa):**
- nas quatro famílias da API e em `detalhe`: o dia está dentro de algum intervalo da cobertura **`base`** do vídeo (a `base` pode ter buraco: seção 0.1), e a `base` é a coluna `views` do diário;
- em `alcance_dim`: existe relatório `channel_reach_basic_a1` daquele canal cujo dia (`start_time` em UTC) é o dia lido, com `normalized_at` preenchido; a `base` é a soma das impressões de `yt_own_video_reach_daily` do vídeo e dia.
**Contrato do leitor.** `lerDimensoes(sb, p: Pedido & { ytIds: readonly string[]; de: DiaYt; ate: DiaYt }): Promise<Privado<DimensoesCanal>>` e `lerDetalheDaOrigem(sb, p: …): Promise<Privado<DetalheCanal>>`. Mesmo molde de `ler.ts`: sem prova = `negado` **sem consultar**; erro de banco lançado; leitura paginada (o `readAll` de `observatorio/load.ts`, que aqui pode ser importado: é código de servidor do Observatório); filtro por site **e** canal; janela obrigatória (máximo de 120 dias, senão lança); teto de 50 vídeos. O token é `LeituraPrivadaDoSite` se existir no HEAD; senão `EdicaoDoSite` (desvio 16). `DetalheCanal` traz `detail` e `source_type` como vieram; quem traduz é a tela.
**Testes do modelo.** `fora da cobertura = não medido` (item 85: o teste **apaga** a cobertura e afirma); `antes do início traz a data do conjunto` (item 228); `coberto com linha = valor`; `coberto sem linha e soma fecha = zero medido` (item 227); `soma abaixo = zero ou abaixo do limiar, omitido = diferença` (itens 90 e 227); `soma acima = em revisão, sem número` (item 227); **`buraco na base: coberto no conjunto e base não medida = não medido, motivo base_nao_medida`** (dados I-2); **`base não medida com linha gravada continua não medido`** (a linha existe, a referência não); `métrica nula na linha continua nula`; `taxa: 8 impressões e 1 clique = 0,125`; `taxa sem cliques = nula, não zero`.
**Testes do leitor (banco falso).** `sem token = negado e zero consultas` (item 89); `objeto forjado = negado`; `erro de banco é lançado`; `mais de 1.000 linhas pagina`; `filtra por site e por canal`; `janela maior que 120 dias lança`; **`alcance por dimensão: sem o relatório básico do dia normalizado = base não medida`** (dados I-2); **`quatro famílias: dia fora da cobertura base = base não medida`**. Os mesmos caminhos rodam contra o banco de verdade na Tarefa 12 (software I6).
**Armadilhas.** Nenhum componente, nenhuma página, nenhum texto de tela nesta tarefa. O leitor não é importado por nenhuma rota de `api/pipeline/`.
**Pronto quando:** testes verdes; `grep -r "ler-dimensoes" src/app/api` vazio.

### Tarefa 12 — Testes de ponta contra o banco, e a semente

**Arquivos.** Os dois testes de integração; `e2e/fixtures/observatorio-seed.ts`. **(emenda do portão: software m10)** `src/types/database.types.ts` **saiu** desta tarefa. **(emenda do portão: software I5)** A semente e2e só é editada depois de `git status` mostrar o arquivo limpo (a A4 tem alteração não commitada nele: F19); enquanto isso, os dois testes de integração rodam, porque semeiam por conta própria. Na semente: limpar as três tabelas novas e a cobertura dos conjuntos da E11, na ordem das chaves; semear um vídeo com os estados (um dia fechado, um com omissão, um fora da cobertura, um com a base não medida) e um termo **sentinela** `zz-sentinela-e11` na tabela de detalhe.
**Antes de começar.** Lote C aplicado no `bythiago_int` (Tarefa 1, passo 4). Variáveis da seção 9. Cada teste cria o seu site e o passa à prova (R5).
**`observatorio-a5-e11-passos.test.ts`** (banco real, `fetch` falso, `ctx.e11` relativo a hoje, token injetado):
- `primeira execução` (item 92; **dados C-1, software C1**): canal com 3 vídeos, 1 com view **num dia do meio da janela, que não é o último da base**; depois do passo, todos os vídeos têm os quatro conjuntos até `menor(hoje, base)`, a cobertura de `pais` do vídeo ativo é **um** intervalo que começa no começo da janela, e a prova dá `faltando_cobertura = 0`.
- **`view só em X, três execuções em dias seguidos sem view nova`** (software C1): a cobertura de `pais` chega à `base` em cada uma, a prova dá 0 nas três, e a API recebe **0 consultas** na execução em que X já saiu da janela.
- `a fórmula da janela do código e a do banco coincidem` (vídeo com cobertura de 20 dias atrás: o código e `yt_own_dim_cover_idle` cobrem o mesmo intervalo).
- `normaliza a fila semeada com os brutos reais e zera os pendentes` (item 84: a consulta C1 dá 0).
- `gravação esparsa`: `select count(*)` de linha com todas as métricas zeradas ou nulas nas três tabelas, **do site do teste**, = 0 (item 85).
- `dois dias depois sem cron`: sem buraco na cobertura.
- `detalhe com emoji na posição 300 entra` (dados I-4): o relatório é normalizado, não fica na fila.
- **Critérios contra a função real (R9):** para cada número da prova, uma semente que acende a nota por `criteriosE11` e uma que não acende (as da tabela da Tarefa 1), e `site nulo = "prova não avaliada"`.
- **Leitor contra o banco (emenda do portão: software I6):** `lerDimensoes devolve os estados` (valor; zero ou abaixo do limiar com `omitido`; não medido antes do início; base não medida num buraco da `base`); `lerDetalheDaOrigem devolve o sentinela a quem tem o token e negado a quem não tem`. O banco falso aceita qualquer nome de tabela e de coluna; sem tela até o mockup 12, é aqui que um nome errado aparece.
**`observatorio-a5-e11-sentinela.test.ts`** (item 89): com o sentinela gravado na tabela de detalhe do site do teste, chama **todos os handlers `GET`** de `api/pipeline/` dos domínios do YouTube e do Observatório. A lista vem do registro (`lib/pipeline/api-registry.ts`, **só lido**); a autenticação é a do teste que já existe para o pipeline (`test/integration/pipeline-leitura-aviso.test.ts`: `PipelineAuth` do site do teste, com permissão de leitura). **O teste falha se a lista vier com 0 handlers** (registro vazio ou filtro errado não pode passar em verde) e afirma que nenhuma resposta contém `zz-sentinela-e11`.
**Pronto quando:** os dois verdes contra `bythiago_int`; a semente e2e (quando liberada) roda duas vezes seguidas sem erro de chave.

### Tarefa 13 — Ensaio com a API real no banco local (condicional)

**Só com a resposta do dono à pergunta 3.** Um disparo de `passoDimensoes` contra `bythiago_int`, com `ctx.e11` de ensaio. **(emenda do portão: R6)** O token entra por `ctx.token`: é lido da conexão do canal em produção com `select`, renovado **em memória** contra o Google e **nunca gravado**; o ensaio não chama `obterToken` nem `ensureFreshToken`, e o cliente de banco do ensaio aponta **só** para o `bythiago_int`. Se o token não puder ser obtido assim, o ensaio não existe. Anotar no ledger: consultas feitas, segundos por consulta (é a única medição de latência que este plano terá), `dias_mantidos`, `dias_em_revisao`, `valores_invalidos`, e a forma das três respostas `com_dia`. Banco local limpo no fim (`delete` das linhas do ensaio, pelo site do ensaio). **Nunca contra produção.**
**Pronto quando:** o ledger tem os números, ou diz "não autorizado" ou "token não pôde ser obtido sem gravar".

### Tarefa 14 — Envio e conferências

**Antes.** Lote C em produção (V1 a V4 conferidas). Acordo dos dois especialistas sobre o lote.
**(emenda do portão: software m11)** **A E6 P2 em produção não é mais condição do lote inteiro.** Se ela ainda não estiver em produção: a variável `YT_OWN_STEPS_OFF=dimensoes` é definida na Vercel **antes** do deploy do lote (vale para o deploy novo), os normalizadores rodam, e a conferência `e11-religar-dimensoes` entra no commit.
**No commit do envio.** `DIMENSOES_DESDE` e `DIMENSOES_LIGADO_EM` confirmadas (dia do deploy − 10 e dia do deploy, no Pacífico); `E11_DEPLOY` preenchida em `lib/conferencias.ts` (dia de São Paulo) com `conferenciasE11(deploy)` gerando as conferências da seção 7, todas com `etapa: 'E11'` (o teste de `conferencias` exige `E<n>`), e `CONFERENCIAS` espalhando também essa lista; teste em `test/lib/conferencias.test.ts`: `E11_DEPLOY nula = nenhuma entrada`, `malformada = uma entrada de erro` (como a de E1 e E2), `preenchida = as entradas com as datas certas`, e `E11_DEPLOY e DIMENSOES_LIGADO_EM não diferem em mais de um dia`; as mesmas conferências em `.superpowers/sdd/a5/conferencias-com-data.md`; seção nova no runbook: os dois passos, o interruptor, como refazer um relatório (`update … set normalized_at = null`, e os outros do mesmo canal e dia junto), a troca de modo de uma família, o que cada número do resumo quer dizer (inclusive `videos_sem_base` e `videos_base_antes_do_inicio`, que não são alarme desta etapa), e os códigos de `MOTIVOS_NORMALIZADOR`.
**Lista de arquivos do lote** (envio por lista explícita de commits; há outros lotes locais não enviados): todos os da tabela da seção 9. **Tem de estar em produção antes:** MG13 (está) e o lote C inteiro. **Tem de estar em `main` antes** (os commits não enviados que tocam os mesmos arquivos): os lotes de E20, de E12 e de E1 com E2, e o lote do plano das ordens 8 e 10 que leva a Tarefa 2 de lá (este lote importa `motivo.ts`, `kinds.ts`, `passos-desligados.ts` e `criteria-desligados.ts`).
**Janela.** Promover fora de 11:55 a 12:15 UTC. O primeiro cron depois do deploy é o D da seção 7.
**Volta (emenda do portão: software I7).** `YT_OWN_STEPS_OFF=dimensoes,normalizadores` na Vercel **e um redeploy de produção** (a variável só vale para deploys feitos depois da mudança; o deploy em pé continua com o valor antigo): custa um build. Ou reverter o commit. As tabelas ficam; o passo religado retoma do último dia coberto. Refazer a normalização: `normalized_at = null` nos relatórios dos dois tipos (as funções são idempotentes).
**Pronto quando:** CI verde, deploy pronto, e a conferência `e11-d1` anotada.

---

## 11. Consultas de conferência e o que foi rodado

**(emenda do portão: dados I-6; R1, R5, R9)** **Rodado de novo em 12/10/2026, fim da noite, no banco `bythiago_int` (porta 54422), dentro de `begin; … rollback;`, DUAS vezes, com saídas iguais.** Desta vez contra a **MG14 real** (o texto do Apêndice A do plano das ordens 8 e 10) e a **MG5 real** (Apêndice B do mesmo plano), não contra um stub. A rodada final (23:40) já usou a versão **emendada** daqueles dois textos (a MG14 com a recusa de dia sem `views`; a MG5 com as mudanças dela) e deu a mesma saída da rodada feita antes da emenda deles. Roteiros e saída guardados: `.superpowers/sdd/a5/plano-e11-emenda-prova.sql`, `…-prova-2.sql` e `…-prova-saida.txt`. Depois de cada `rollback`: `to_regclass` das tabelas novas e da cobertura = nulo, 0 canais, 1 site, 0 vínculos, 1 usuário, e o corpo de `youtube_channel_removal_impact` de volta ao de `main` (md5 conferido): nada ficou. Nenhuma função foi chamada como `anon` ou `authenticated`.

| # | O que rodou | Resultado |
|---|---|---|
| S0 | MG14 real, depois a MG7 duas vezes seguidas | sem erro; V1 = `3\|3\|3\|6\|0\|4`; uma só `yt_own_dim_prova`, a de três parâmetros; `search_path=""` nas seis; o corpo da função de impacto depois da MG7 tem o **mesmo md5** do que a MG14 deixou (`4827d5ad12a0120b52ebc1280491b00c`) |
| | Privilégios da tabela de detalhe | `anon` sem `select`; `authenticated` com `select` e sem `insert`; `service_role` com `insert` |
| S1 | Prova com `p_site`, `p_hoje` ou `p_desde` nulo | **exceção nas três** (`são obrigatórios`); nunca "0 faltando" |
| S2 | Prova com tudo vazio (site 1 com 3 vídeos antigos; site 2 com 1) | site 1: `faltando 0, videos_com_base 0, videos_sem_base 3, base_ate null`; site 2: `videos_sem_base 1` (um site não vê o outro) |
| S3 | `videos_sem_base` nos dois sentidos | vídeo publicado anteontem: **não sobe** (3); canal desligado: cai a 2; o mesmo vídeo cinco dias depois da publicação: **sobe** (4) |
| S4 | `base` em A e B (até 12/10), C com `base` só em 2019, nenhuma dimensão | `faltando_cobertura 8` (C **não** conta), `videos_base_antes_do_inicio 1`, `videos_com_base 3`, `base_ate 2019-12-31` (o menor entre os canais) |
| S5 | **O caso do C-1, com as datas do canal real:** hoje 14/10, partida 04/10, `base` até 12/10, 2 views só em 05/10 | `cover_idle`: B ganha 4 conjuntos, A fica para a API. Três gravações `com_dia` e **uma** de país com a janela inteira e só a linha de 05/10: os quatro conjuntos de A = **04/10 a 12/10**; prova = **0**. 45 dias depois (hoje 28/11, `base` até 26/11): `pais` = **04/10 a 26/11**, um intervalo; a linha `BR` de 05/10 existe; prova = **0** |
| S6 | **O corte do I-5:** views em 20, 22 e 24/11; a consulta de 22/11 "falha" e a gravação vai só até 21/11 | cobertura até 21/11; a prova **vê** (`faltando_cobertura 1` com hoje 28/11). No dia seguinte, gravação de 19/11 a 26/11 com os três dias: um intervalo só, 04/10 a 26/11; prova 0 |
| S7 | **A exceção do m-3:** linha antiga de 2 views, resposta vazia | com o diário em 2: a linha fica (`dias_mantidos 1`, `apagadas 0`); com o diário revisado para 1: a linha sai (`apagadas 1`, `dias_mantidos 0`, `dias_em_revisao 0`); linha nova de 3 contra diário 1: grava e `dias_em_revisao 1`; diário a zero: some |
| | Teto da base, linha zerada, `base` anterior à janela, `kind` desconhecido, linha fora da janela | `fora_do_teto 1` e a zerada não entra; `base_sem_cobertura`; exceção nas duas últimas |
| S8 | `pendentes_normalizar` nos dois sentidos | site 1 = **2** (os dois baixados há 3 dias); **não** conta o de 1 dia, os de hoje, o que está em `erro` há 5 dias nem o do outro site; site 2 = 1; com o canal desligado = 0 |
| S9 | **O conserto do I-1:** RA e RB do mesmo dia, os dois `baixado` e na fila | RA (mais velho) **grava** 3 linhas (antes saía `superado`). Caminho 1, RB vai a `erro`: o dia fica com as 3 linhas de RA, um relatório. Caminho 2, RB aplica: `apagadas 3, gravadas 2`, um relatório, soma 6; RA de novo sai `superado`; RB duas vezes dá igual |
| | Alcance: QA e QB (mais novo, `vazio`) | QA grava 2; QB vazio apaga as 2 (OP-13); QA de novo sai `superado`; 0 linhas |
| | Refazer os quatro (`normalized_at = null`) na ordem da fila | mesmo estado final (2 linhas de detalhe, 0 de alcance); 0 sem normalizar; `pendentes 0` |
| | Dia diferente do relatório; tipo errado; chave repetida; linha zerada | exceção nas quatro; o relatório continua na fila |
| S10 | `dias_dois_relatorios_*` nos dois sentidos | duas origens no mesmo (canal, dia): detalhe **1**, alcance 0; o site 2 vê 0; com hoje além dos 60 dias: 0 |
| S11 | `base_ate` com dois canais (até 26/11 e até 10/10) | `2026-10-10` |
| S12 | **A função de impacto em qualquer ordem (R1).** Com a MG5 real e uma tabela inventada de "outra etapa" presa ao canal | `serie_coletada` pela função = soma à mão (**46 = 46**), com a retenção e a tabela inventada dentro. O catálogo enxerga 12 tabelas: as 6 de `main`, cobertura, retenção, as 3 da E11 e a inventada. Reaplicando MG14, MG5 e MG7, com a MG7 por último e depois com a MG14 por último: **mesmo md5 e mesmo número** nas duas. Com o corpo de lista fixa de `main` por cima: o número **muda** (perde as novas); a MG7 reaplicada devolve o corpo e o número |
| S13 | RLS com o GUC `app.site_id` forjado, usuário criado na transação (sem papel de dono) | sem vínculo: **0** linhas nas tabelas e na cobertura; `reporter`: **0**; `editor`: 6 de dimensão, 4 de detalhe; `delete` e `insert` como `authenticated`: "permission denied"; editor de **outro** site com o GUC forjado para este: **0** |
| S14 | V3 e C1 a C4 | rodam; V3 = `3` e `t` |
| 2 | MG7 sem a MG14 | recusa: `MG7 depende da MG14: public.yt_own_video_coverage não existe`; nenhuma tabela criada |
| 2 | MG14, um stub de `can_view_private_site` (a MG11 vem antes da MG7 no lote C) e a MG7 duas vezes | as três policies usam `can_view_private_site(site_id)` |

**Da primeira versão, não rodado de novo porque o trecho não mudou:** o plano do apagamento por (canal, dia) (`Index Scan` nos dois índices novos, com `enable_seqscan = off` e tabelas vazias) e a cobertura que funde três dias fora de ordem.

**Consultas para depois do deploy** (só `select`). V1, V2 e V3 foram rodadas nesta emenda (acima). V4 usa a prova de três parâmetros, rodada em S2 e S4. C1 a C4 rodam (S14). Em produção, antes da MG7, a contagem de tabelas e de funções da V1 dá 0 e 0 (medido); as outras só rodam lá depois do lote C.

**C1 (item 84): a fila dos normalizadores.** Esperado em D + 5: 0.
```sql
select count(*) from yt_reporting_reports where status in ('baixado', 'vazio') and normalized_at is null and report_type_id in ('channel_traffic_source_a3', 'channel_reach_combined_a1');
```
O item 84 escreve `status = 'baixado'`; incluo `vazio` porque o relatório vazio também precisa cobrir o dia.

**C2 (item 249): um relatório por dia.** Esperado: 0 e 0.
```sql
select (select count(*) from (select channel_id, day_pt from yt_own_video_traffic_detail_daily group by 1, 2 having count(distinct source_report_id) > 1) x) as detalhe, (select count(*) from (select channel_id, day_pt from yt_own_video_reach_dim_daily group by 1, 2 having count(distinct source_report_id) > 1) x) as alcance_dim;
```

**C3 (item 92, o texto literal do spec).** Esperado: 0.
```sql
select count(*) from (select distinct d.youtube_video_id from yt_own_video_daily d where d.views > 0 and d.day_pt >= current_date - 14) v cross join (values ('trafego'), ('dispositivo'), ('pais'), ('inscrito')) s(metric_set) where not exists (select 1 from yt_own_video_coverage k where k.youtube_video_id = v.youtube_video_id and k.metric_set = s.metric_set and k.covered_to >= current_date - 4);
```
Atenção ao ler: depois da dieta, um vídeo sem view em 14 dias não aparece aqui; a prova diária (`yt_own_dim_prova`) cobre todos.

**C4 (item 90): a soma por origem nunca passa do diário.** Esperado: 0 linhas; cada linha é um dia "em revisão".
```sql
select x.youtube_video_id, x.day_pt, x.s as soma_origem, b.views as diario from (select youtube_video_id, day_pt, sum(coalesce(views, 0)) s from yt_own_video_dim_daily where dim_kind = 'traffic_source' group by 1, 2) x left join yt_own_video_daily b using (youtube_video_id, day_pt) where x.s > coalesce(b.views, 0) order by 2 desc limit 50;
```

---

## 12. Onde está cada item de aceite

| Item | Onde |
|---|---|
| 83 (as quatro conferências, com fixture) | C0.2 feita (país; CSV real); a terceira sem efeito; a quarta é a pergunta 1; **falta a C0.2b** (Tarefa 0b) |
| 84 (todo relatório `baixado` normalizado, e o bruto desde 08/09) | Tarefa 8; Tarefa 12; consulta C1; conferência `e11-d5` |
| 85 (esparsa; coberto sem linha; fora da cobertura) | `check` das três tabelas (Apêndice A); Tarefa 1 (`linha zerada não entra`); Tarefa 11 (teste que apaga a cobertura); Tarefa 12 |
| 86 (cabeçalho diferente = erro e nenhuma linha) | Tarefas 3, 4 e 8 |
| 87 (o mais novo substitui; o mais velho não muda nada) | Tarefa 1 (`o mais velho chegando depois…`, `dois na fila: o mais velho grava…`); item 249 |
| 88 (URL sem query e sem fragmento, até 300) | Tarefa 3 (corte por ponto de código); `check` de tamanho na tabela |
| 89 (acesso restrito; RLS com o GUC forjado; sentinela no pipeline) | Tarefa 1 (RLS, com usuário sem papel de dono); Tarefa 11 (leitor); Tarefa 12 (sentinela, que falha com 0 handlers, e o leitor contra o banco). "Não aparece no HTML nem no RSC" é da tela: **espera o mockup 12** |
| 90 (soma por origem ≤ diário; "omitido") | Tarefa 11 (modelo); consulta C4; o texto na tela espera o mockup 12 |
| 91 (cabe no relógio; `nao_alcancado_orcamento`; quem ficou entra primeiro; sem view não chama) | Tarefa 7; Tarefa 10; seção 5 |
| 92 (NP-E11) | `yt_own_dim_prova` (Apêndice A); Tarefa 9 (regras e caminho até o vermelho); Tarefa 10 (teste na rota); Tarefa 12 (cada número contra o banco, nos dois sentidos e com parâmetro nulo); consulta C3; conferências `e11-d5` e `e11-d14` |
| 93 (telas em navegador; impacto conta as três) | a segunda metade: Tarefa 1 e V3. **A primeira metade espera o mockup 12** |
| 226 (chaves; `period_days`) | Tarefas 3 e 4; V1 |
| 227 (três estados; teto da base) | Tarefa 1 (`teto da base`); Tarefa 11 (com o motivo `base_nao_medida`) |
| 228 (ponto de partida) | Tarefa 6 (`janela: nunca antes de desde`); Tarefa 7 (`nenhuma chamada antes da data de partida`); Tarefa 11 (`antes do início`) |
| 249 (relatório refeito substitui o dia inteiro) | Tarefa 1; prova diária em `yt_own_dim_prova`; consulta C2 |
| 245 (interruptor, na parte da E11) | Tarefa 10 (o arquivo do interruptor e o critério de "desligado há tempo demais" são da Tarefa 2 do plano das ordens 8 e 10: decisões 5 e 6) |
| OP-8 | F2 (um dia por relatório: medido); F3 (refeito: **não medido**, conferência `e11-relatorio-refeito`); índice por (canal, dia) nas duas tabelas |
| OP-13 | a função usa o dia do relatório; teste `relatório novo VAZIO apaga o dia` |

---

## 13. Riscos que ficam, sem suavizar

1. **A MG14 ainda não é um arquivo, e o plano dono pode mudá-la de novo.** A prova desta emenda usou o Apêndice A daquele plano na versão já emendada (23:38 de 12/10). Se a tabela de cobertura mudar de chave ou de `check`, ou se o corpo da função de impacto mudar uma letra, a Tarefa 1 pega (passos 2 e 3) e o SQL daqui tem de ser copiado e rodado de novo antes de ir ao dono.
2. **As três consultas `com_dia` nunca foram chamadas.** Se a API recusar, as famílias passam a `por_dia` e, no canal do modelo, o passo não cabe em 30 s. Hoje cabe com folga (1 vídeo ativo).
3. **O canal de hoje quase não tem dado.** Com 36 views em 90 dias, quase tudo fica abaixo do limiar do YouTube: as tabelas vão ficar quase vazias e a maior parte dos dias vai ler "zero ou abaixo do limiar". O valor é o histórico. E os casos difíceis (chave repetida no CSV, termo com vírgula, relatório refeito, aspas) **não têm exemplo real**: os testes usam linhas montadas sob cabeçalho real.
4. **"Em revisão" continua possível, mas não fica mais para sempre.** A linha antiga que contradiz o diário sai quando a resposta vem sem linha (emenda m-3). Fica "em revisão" o dia cuja resposta **nova** soma mais que o diário, até uma das duas fontes ser revisada; `dias_em_revisao` no resumo é o sinal, e não fica vermelho.
5. **A correspondência entre código do lote e nome da Analytics API não é publicada como tabela.** Par errado poria duas origens diferentes na mesma linha de uma tela futura. Par incerto fica nulo; o dado gravado não depende do catálogo.
6. **Cobertura de lote é por vídeo cadastrado no dia da normalização.** Vídeo cadastrado depois lê "não medido" nos dias anteriores, mesmo com o relatório lido. Conservador, mas é um "não medido" que na verdade foi medido. Reprocessar (`normalized_at = null`) conserta.
7. **O pior caso do relógio fica em cerca de 286 s de 300 s** (estimativa, não medição), e a retenção (E8) ainda vai entrar. Dois passos de fim e mais um da E8 dividem o que sobra; no pior dia nenhum roda. Nada se perde, mas a prova de 4 dias pode ficar vermelha por causa da fila da E12, não por defeito daqui.
8. **Qualquer migration futura que recrie `youtube_channel_removal_impact` com lista fixa tira as tabelas novas da conta** (rodado: S12). A decisão R1 proíbe; a V3 acusa (`corpo_por_catalogo` falso); o conserto é reaplicar o corpo por catálogo.
9. **A cota da Analytics API não foi lida.** O teto de 400 consultas é um chute prudente, não um número derivado da cota.
10. **Termo de pesquisa pode ser nome de pessoa.** As tabelas são privadas e nada sai pelo pipeline, mas o dado existe no banco e entra em todo backup e export (E10). O Cowork já lê termos ao vivo por outro caminho (pergunta 38 do spec, não resolvida aqui).
11. **`normalized_at` passa a ser preenchido também em relatório `superado`**, que não gravou nada. Quem ler "normalizado" como "gravou linha" erra; o resumo separa `superados`.
12. **Sem as telas, ninguém olha este dado até o mockup 12.** O modelo e o leitor são testados (o leitor, agora, contra o banco de verdade), mas não vistos.
13. **O alarme de "vídeo sem `base`" depende do critério de cobertura da dieta** (decisão 3 da emenda). Se a E6 P2 for a produção sem esse critério, ou com ele quebrado, um vídeo antigo sem `base` fica sem dimensão nenhuma e sem alarme: só o número em `resumo.e11`. Mitigação: o item está no foco de revisão, e a conferência `e11-d1` lê `videos_sem_base`.
14. **A cobertura das dimensões passa por cima de buraco da `base`** (as funções usam o último dia coberto como teto, não cada intervalo). A leitura não mente (motivo `base_nao_medida`), mas quem consultar a tabela de cobertura direto, sem cruzar com a `base`, vê "coberto" num dia que o diário não mediu.
15. **As datas de partida nascem com uma previsão** (emenda I2). Se o envio escorregar e a Tarefa 14 esquecer de confirmá-las, a carência acaba cedo e a coleta pede alguns dias a mais para trás (nunca mais de 10 antes da data escrita). O teste `E11_DEPLOY e DIMENSOES_LIGADO_EM não diferem em mais de um dia` pega no commit do envio, não antes.
16. **A família consultada dia a dia relê cada dia com view todo dia, por 10 dias.** É o custo de acompanhar a revisão do YouTube: 10 consultas por dia de view. No canal do modelo está na conta (seção 5.1); num canal maior, o sinal é `consultas_cortadas`.
17. **Os testes de integração só rodam depois do lote C aplicado no `bythiago_int`.** Até lá, o que prova o SQL é o roteiro psql desta emenda; os passos e os critérios só têm teste com banco falso.
18. **Passo desligado de propósito (lote sem a E6 P2) fica vermelho da 8ª execução em diante** (decisão 6). É um vermelho esperado, com texto próprio, que pode esconder outro; por isso a conferência `e11-religar-dimensoes` vence antes (D + 5).
19. **Este plano depende de cinco arquivos que são de outro plano** (`passos-desligados.ts`, `kinds.ts`, `motivo.ts`, `criteria-desligados.ts`, `TETOS_DE_FIM_MS`). Li o contrato deles na versão emendada das 23:36 de 12/10 do plano das ordens 8 e 10; se aquele plano mudar de novo, as Tarefas 7, 8 e 10 daqui acompanham. Enquanto a Tarefa 2 de lá não for commitada, os dois passos e a integração não começam.

### Dívida registrada (o que os pareceres apontaram e não entra agora)

- **Colunas a mais em país e inscrito** (curtidas, compartilhamentos, inscritos ganhos, porcentagem assistida: dados m-8). A Tarefa 0b mede se a API aceita; nada disso expira na origem. Entra numa migration futura, se a tela pedir.
- **O teto da `base` por intervalo, no banco** (risco 14): hoje a regra é só do leitor.
- **Cobertura de lote para vídeo cadastrado depois** (risco 6): reprocessar é manual.
- **Modo `por_dia` no canal do modelo com as três famílias** (risco 2): sem solução desenhada; o gatilho é `consultas_cortadas > 0` por 3 dias.
- **Um alarme só para "vídeo sem `base`"** entre a E6 e a E11 (risco 13): hoje é do critério da dieta, por decisão; se o dono quiser o vermelho aqui também, é uma linha na Tarefa 9.
- **O banco `bythiago_int` sem a corretiva `…000004`** (F20): não afeta esta etapa; fica para o controlador.
- **Latência da consulta de dimensão e o pior caso do relógio medidos** (hoje são estimativas): só o ensaio da Tarefa 13 ou o primeiro cron em produção medem.
- **A semente e2e** só entra depois de a A4 commitar o arquivo dela (F19).

---

## 14. Apêndices

- **Apêndice A:** SQL final da MG7 (`observatorio_a5_e11_canal_proprio_em_tabelas`), **emendado e rodado duas vezes** no banco local sobre a MG14 real.
- **Apêndice B:** não há segunda migration.
- **Apêndice C:** saiu. Era o stub da MG14; a validação agora usa o texto real, que está no Apêndice A do plano das ordens 8 e 10.

**O que mudou no SQL nesta emenda (emenda do portão):**
1. **5b, `yt_own_dim_apply` (dados m-3):** o apagamento ganhou uma terceira condição: sai também o dia sem linha nova cuja soma antiga passa das views do diário. O comentário diz que quem chama passa a janela inteira (C-1).
2. **5d e 5e, as duas funções de lote (dados I-1):** o mais velho só é `superado` por um mais novo com `normalized_at` preenchido.
3. **5f, `yt_own_dim_prova` (R5, R9; software I3; dados m-2 e m-4):** recebe `(p_site, p_hoje, p_desde)`, lança com nulo, só olha o site pedido, não conta em `faltando_cobertura` o vídeo com a `base` anterior à data de partida, dá carência de 4 dias ao vídeo recém-publicado em `videos_sem_base`, devolve `videos_com_base` e `videos_base_antes_do_inicio`, e `base_ate` passa a ser o menor entre os canais.
4. **6, `youtube_channel_removal_impact` (R1; software I1):** a lista de treze tabelas saiu; entra o bloco único da MG14 (76 linhas entre as marcas, com elas), sem mudar um byte.
As tabelas, os índices, a RLS e as funções 5a e 5c **não mudaram**.

### Apêndice A — MG7

```sql
-- =============================================================================
-- MIGRATION MG7: Observatório A5, etapa E11 — canal próprio em tabelas
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md (7.3)
-- Plano: docs/superpowers/plans/2026-10-12-a5-e11-canal-proprio-em-tabelas-plan.md
-- Aditiva. Roda duas vezes sem erro. Depende da MG14 (yt_own_video_coverage) e da MG13 (já aplicada).
-- Convive com o código de main: só cria tabelas e funções novas e reafirma o corpo POR CATÁLOGO de
-- youtube_channel_removal_impact (o mesmo texto da MG14, byte a byte), sem mudar assinatura nem chaves do retorno.
--
-- O que faz:
--   1. yt_own_video_dim_daily: views por origem, aparelho, país e inscrito (Analytics API). Esparsa.
--   2. yt_own_video_traffic_detail_daily: o detalhe da origem (termo, site, vídeo, canal), do lote channel_traffic_source_a3.
--   3. yt_own_video_reach_dim_daily: impressões por origem e aparelho, do lote channel_reach_combined_a1.
--   4. RLS nas três (bloco PL do spec: can_view_private_site se a MG11 já existir; senão can_edit_site).
--   5. Funções de gravação (só service_role): yt_own_dim_coverage_extend, yt_own_dim_apply, yt_own_dim_cover_idle,
--      yt_own_traffic_detail_apply, yt_own_reach_dim_apply, yt_own_dim_prova.
--   6. youtube_channel_removal_impact: o corpo por catálogo da MG14, repetido sem mudar uma letra (decisão R1 do
--      controlador): serie_coletada soma toda tabela presa ao canal por FK "on delete restrict". As três tabelas
--      daqui entram sozinhas, por terem essa chave.
-- youtube_video_id = id de 11 caracteres do YouTube. day_pt = o dia como veio da fonte.
-- Os códigos das dimensões são gravados COMO VIERAM: nomes na Analytics API ('YT_SEARCH', 'MOBILE|ANDROID'),
-- números no lote ('5', '104', '4'). A tradução mora no código (reporting/codigos.ts).
-- =============================================================================
set lock_timeout = '5s';

do $$ begin
  if to_regclass('public.yt_own_video_coverage') is null then
    raise exception 'MG7 depende da MG14: public.yt_own_video_coverage não existe. Aplique a MG14 antes.';
  end if;
end $$;

-- ── 1. Dimensões por vídeo e dia (Analytics API) ────────────────────────────
create table if not exists public.yt_own_video_dim_daily (
  youtube_video_id text not null,
  day_pt date not null,
  dim_kind text not null check (dim_kind in ('traffic_source', 'device_os', 'country', 'subscribed_status')),
  dim_value text not null check (dim_value ~ '^[A-Za-z0-9_|]{1,80}$'),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  engaged_views bigint,
  watch_time_minutes numeric,
  source text not null default 'analytics_api' check (source in ('analytics_api')),
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, dim_kind, dim_value),
  constraint yt_own_video_dim_daily_esparsa
    check (coalesce(views, 0) <> 0 or coalesce(engaged_views, 0) <> 0 or coalesce(watch_time_minutes, 0) <> 0)
);
create index if not exists idx_yt_own_video_dim_daily_channel
  on public.yt_own_video_dim_daily (channel_id, dim_kind, day_pt);

-- ── 2. Detalhe da origem (lote channel_traffic_source_a3) ───────────────────
-- detail = '' quando o YouTube não informou o detalhe (abaixo do limiar): é "sem detalhe", nunca um termo vazio.
create table if not exists public.yt_own_video_traffic_detail_daily (
  youtube_video_id text not null,
  day_pt date not null,
  source_type text not null check (source_type ~ '^[A-Za-z0-9_]{1,40}$'),
  detail text not null check (char_length(detail) <= 300),
  detail_hash text not null check (detail_hash ~ '^[0-9a-f]{64}$'),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  views bigint,
  watch_time_minutes numeric,
  source text not null default 'reporting_api' check (source in ('reporting_api')),
  source_report_id text not null,
  report_create_time timestamptz not null,
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, source_type, detail_hash),
  constraint yt_own_video_traffic_detail_daily_esparsa
    check (coalesce(views, 0) <> 0 or coalesce(watch_time_minutes, 0) <> 0)
);
-- (canal, dia) na frente: é por ele que o dia inteiro é substituído (OP-8).
create index if not exists idx_yt_own_traffic_detail_channel_day
  on public.yt_own_video_traffic_detail_daily (channel_id, day_pt, source_type);

-- ── 3. Impressões por origem e aparelho (lote channel_reach_combined_a1) ────
-- thumbnail_clicks_est = soma de (impressões × taxa) das linhas do CSV da chave; nulo se alguma veio sem taxa.
create table if not exists public.yt_own_video_reach_dim_daily (
  youtube_video_id text not null,
  day_pt date not null,
  traffic_source_type text not null check (traffic_source_type ~ '^[A-Za-z0-9_]{1,40}$'),
  device_type text not null check (device_type ~ '^[A-Za-z0-9_]{1,40}$'),
  operating_system text not null check (operating_system ~ '^[A-Za-z0-9_]{1,40}$'),
  site_id uuid not null references public.sites(id) on delete cascade,
  video_id uuid references public.youtube_videos(id) on delete set null,
  channel_id uuid not null references public.youtube_channels(id) on delete restrict,
  thumbnail_impressions bigint,
  thumbnail_clicks_est numeric,
  source_report_id text not null,
  report_create_time timestamptz not null,
  collected_at timestamptz not null default now(),
  metric_version text not null,
  primary key (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system),
  constraint yt_own_video_reach_dim_daily_esparsa check (coalesce(thumbnail_impressions, 0) <> 0),
  constraint yt_own_video_reach_dim_daily_cliques
    check (thumbnail_clicks_est is null or (thumbnail_clicks_est >= 0 and thumbnail_clicks_est <= thumbnail_impressions))
);
create index if not exists idx_yt_own_reach_dim_channel_day
  on public.yt_own_video_reach_dim_daily (channel_id, day_pt);

-- ── 4. RLS: leitura por quem tem o direito de ver o dado privado; escrita só por service role ──
alter table public.yt_own_video_dim_daily enable row level security;
alter table public.yt_own_video_traffic_detail_daily enable row level security;
alter table public.yt_own_video_reach_dim_daily enable row level security;
do $$
declare
  v_fn text := case when to_regprocedure('public.can_view_private_site(uuid)') is not null
                    then 'public.can_view_private_site(site_id)' else 'public.can_edit_site(site_id)' end;
  t text;
begin
  foreach t in array array['yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (%s)', t || '_select', t, v_fn);
    -- Sem policy de escrita, a RLS já barra; os privilégios saem também (defesa em profundidade).
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;

-- ── 5a. Estender a cobertura de um conjunto, fundindo vizinhos ──────────────
-- Nunca encolhe. Intervalos que encostam ([a, b] e [b+1, c]) viram um.
create or replace function public.yt_own_dim_coverage_extend(
  p_video text, p_set text, p_from date, p_to date,
  p_site uuid, p_video_id uuid, p_channel uuid, p_source text
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_from date := p_from;
  v_to date := p_to;
  v_min date;
  v_max date;
begin
  if p_from is null or p_to is null or p_to < p_from then
    return;
  end if;
  select min(c.covered_from), max(c.covered_to) into v_min, v_max
  from public.yt_own_video_coverage c
  where c.youtube_video_id = p_video and c.metric_set = p_set
    and c.covered_from <= p_to + 1 and c.covered_to >= p_from - 1;
  if v_min is not null then
    v_from := least(v_from, v_min);
    v_to := greatest(v_to, v_max);
    delete from public.yt_own_video_coverage c
    where c.youtube_video_id = p_video and c.metric_set = p_set
      and c.covered_from <= p_to + 1 and c.covered_to >= p_from - 1;
  end if;
  insert into public.yt_own_video_coverage
    (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, source, collected_at)
  values (p_video, p_set, v_from, v_to, p_site, p_video_id, p_channel, p_source, now());
end $$;

-- ── 5b. Gravar uma janela de UMA dimensão de UM vídeo (Analytics API) ───────
-- p_rows: [{day_pt, dim_value, views?, engaged_views?, watch_time_minutes?, metric_version}]
-- Regras: (1) a cobertura nunca passa do último dia coberto do conjunto 'base' do vídeo; linha de dia além disso é
-- descartada e contada; (2) dia que veio com linha é substituído inteiro; (3) dia que veio SEM linha só é limpo se o
-- diário diz zero view nesse dia; se o diário tem view, as linhas antigas ficam (o YouTube omitiu, ou a resposta veio
-- vazia) e o dia é contado em dias_mantidos, SALVO se a soma das linhas antigas já passa das views do diário (o diário
-- foi revisado para baixo e a linha antiga contradiz a referência): aí o dia é limpo, em vez de ficar "em revisão"
-- para sempre; (4) só entra linha com alguma métrica diferente de zero.
-- Quem chama cobre a janela INTEIRA de uma vez (dias sem view incluídos), também na família consultada dia a dia:
-- p_to é o último dia respondido sem falha. Assim a cobertura do conjunto é contígua por construção.
create or replace function public.yt_own_dim_apply(
  p_video text, p_kind text, p_from date, p_to date, p_rows jsonb,
  p_site uuid, p_video_id uuid, p_channel uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_set text := case p_kind when 'traffic_source' then 'trafego' when 'device_os' then 'dispositivo'
                            when 'country' then 'pais' when 'subscribed_status' then 'inscrito' end;
  v_base date;
  v_to date;
  v_fora integer;
  v_apagadas integer;
  v_gravadas integer;
  v_mantidos integer;
  v_revisao integer;
begin
  if v_set is null then
    raise exception 'yt_own_dim_apply: dim_kind desconhecido (%)', left(coalesce(p_kind, 'nulo'), 40);
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'yt_own_dim_apply: janela inválida';
  end if;
  if jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'yt_own_dim_apply: p_rows tem de ser uma lista';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_rows) as r(day_pt date) where r.day_pt is null or r.day_pt < p_from or r.day_pt > p_to) then
    raise exception 'yt_own_dim_apply: linha fora da janela pedida';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_dim:' || p_channel::text, 0));

  select max(c.covered_to) into v_base
  from public.yt_own_video_coverage c
  where c.youtube_video_id = p_video and c.metric_set = 'base';
  if v_base is null or v_base < p_from then
    return jsonb_build_object('status', 'base_sem_cobertura', 'base_ate', v_base, 'coberto_ate', null,
                              'gravadas', 0, 'apagadas', 0, 'fora_do_teto', jsonb_array_length(p_rows),
                              'dias_mantidos', 0, 'dias_em_revisao', 0);
  end if;
  v_to := least(p_to, v_base);

  select count(*) into v_fora from jsonb_to_recordset(p_rows) as r(day_pt date) where r.day_pt > v_to;

  delete from public.yt_own_video_dim_daily d
  where d.youtube_video_id = p_video and d.dim_kind = p_kind and d.day_pt between p_from and v_to
    and (d.day_pt in (select r.day_pt from jsonb_to_recordset(p_rows) as r(day_pt date))
         or not exists (select 1 from public.yt_own_video_daily b
                        where b.youtube_video_id = p_video and b.day_pt = d.day_pt and b.views > 0)
         or (select sum(coalesce(o.views, 0)) from public.yt_own_video_dim_daily o
             where o.youtube_video_id = p_video and o.dim_kind = p_kind and o.day_pt = d.day_pt)
            > (select b.views from public.yt_own_video_daily b
               where b.youtube_video_id = p_video and b.day_pt = d.day_pt));
  get diagnostics v_apagadas = row_count;

  select count(distinct d.day_pt) into v_mantidos
  from public.yt_own_video_dim_daily d
  where d.youtube_video_id = p_video and d.dim_kind = p_kind and d.day_pt between p_from and v_to;

  insert into public.yt_own_video_dim_daily
    (youtube_video_id, day_pt, dim_kind, dim_value, site_id, video_id, channel_id,
     views, engaged_views, watch_time_minutes, source, collected_at, metric_version)
  select p_video, r.day_pt, p_kind, r.dim_value, p_site, p_video_id, p_channel,
         r.views, r.engaged_views, r.watch_time_minutes, 'analytics_api', now(), r.metric_version
  from jsonb_to_recordset(p_rows) as r(
    day_pt date, dim_value text, views bigint, engaged_views bigint, watch_time_minutes numeric, metric_version text)
  where r.day_pt <= v_to
    and (coalesce(r.views, 0) <> 0 or coalesce(r.engaged_views, 0) <> 0 or coalesce(r.watch_time_minutes, 0) <> 0);
  get diagnostics v_gravadas = row_count;

  perform public.yt_own_dim_coverage_extend(p_video, v_set, p_from, v_to, p_site, p_video_id, p_channel, 'analytics_api');

  -- "em revisão": a soma da dimensão passou das views do diário (o diário foi revisado e a dimensão ainda não).
  select count(*) into v_revisao
  from (select d.day_pt, sum(coalesce(d.views, 0)) s
        from public.yt_own_video_dim_daily d
        where d.youtube_video_id = p_video and d.dim_kind = p_kind and d.day_pt between p_from and v_to
        group by d.day_pt) x
  left join public.yt_own_video_daily b on b.youtube_video_id = p_video and b.day_pt = x.day_pt
  where x.s > coalesce(b.views, 0);

  return jsonb_build_object('status', 'gravado', 'base_ate', v_base, 'coberto_ate', v_to,
                            'gravadas', v_gravadas, 'apagadas', v_apagadas, 'fora_do_teto', v_fora,
                            'dias_mantidos', v_mantidos, 'dias_em_revisao', v_revisao);
end $$;

-- ── 5c. Vídeos sem view na janela: a cobertura avança sem chamar a API ──────
-- Para cada vídeo do canal com cobertura 'base' e cada um dos quatro conjuntos: janela = [maior(p_inicio, menor(p_janela,
-- último dia coberto do conjunto)), menor(p_to, último dia da base)]. Se o diário não tem view nessa janela, limpa as
-- linhas da dimensão (zero view não tem origem) e estende a cobertura. Vídeo com view fica para o passo (API).
create or replace function public.yt_own_dim_cover_idle(p_channel uuid, p_inicio date, p_janela date, p_to date)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v record;
  k record;
  v_last date;
  v_from date;
  v_to date;
  v_cobertos integer := 0;
  v_ativos integer := 0;
  v_videos integer := 0;
  v_ativo boolean;
begin
  if p_inicio is null or p_janela is null or p_to is null then
    raise exception 'yt_own_dim_cover_idle: datas obrigatórias';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_dim:' || p_channel::text, 0));
  for v in
    select c.youtube_video_id, max(c.covered_to) as base_to,
           (array_agg(c.site_id order by c.covered_to desc))[1] as site_id,
           (array_agg(c.video_id order by c.covered_to desc))[1] as video_id
    from public.yt_own_video_coverage c
    where c.channel_id = p_channel and c.metric_set = 'base'
    group by c.youtube_video_id
  loop
    v_videos := v_videos + 1;
    v_ativo := false;
    for k in select * from (values ('traffic_source', 'trafego'), ('device_os', 'dispositivo'),
                                   ('country', 'pais'), ('subscribed_status', 'inscrito')) as t(kind, metric_set)
    loop
      select max(c.covered_to) into v_last
      from public.yt_own_video_coverage c
      where c.youtube_video_id = v.youtube_video_id and c.metric_set = k.metric_set;
      v_from := greatest(p_inicio, least(p_janela, coalesce(v_last, p_inicio)));
      v_to := least(p_to, v.base_to);
      continue when v_to < v_from;
      if exists (select 1 from public.yt_own_video_daily b
                 where b.youtube_video_id = v.youtube_video_id and b.day_pt between v_from and v_to and b.views > 0) then
        v_ativo := true;
        continue;
      end if;
      delete from public.yt_own_video_dim_daily d
      where d.youtube_video_id = v.youtube_video_id and d.dim_kind = k.kind and d.day_pt between v_from and v_to;
      perform public.yt_own_dim_coverage_extend(v.youtube_video_id, k.metric_set, v_from, v_to,
                                                v.site_id, v.video_id, p_channel, 'analytics_api');
      v_cobertos := v_cobertos + 1;
    end loop;
    if v_ativo then v_ativos := v_ativos + 1; end if;
  end loop;
  return jsonb_build_object('videos_com_base', v_videos, 'conjuntos_cobertos', v_cobertos, 'videos_com_view', v_ativos);
end $$;

-- ── 5d. Gravar o detalhe da origem de UM relatório (substitui o dia inteiro do canal) ──
-- O dia é o que o RELATÓRIO cobre (start_time), não os dias das linhas: relatório refeito vazio apaga o dia (OP-13).
-- Relatório mais velho que outro JÁ NORMALIZADO do mesmo canal, tipo e dia não grava nada ('superado'). Um mais novo
-- que ainda não foi normalizado não supera ninguém: se ele falhar, o dado do mais velho tem de estar gravado.
-- p_rows: [{youtube_video_id, video_id?, day_pt, source_type, detail, detail_hash, views?, watch_time_minutes?, metric_version}]
create or replace function public.yt_own_traffic_detail_apply(p_report_id text, p_rows jsonb, p_unmatched jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r public.yt_reporting_reports%rowtype;
  v_day date;
  v_apagadas integer := 0;
  v_gravadas integer := 0;
  v_cobertos integer := 0;
  x record;
begin
  if jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'yt_own_traffic_detail_apply: p_rows tem de ser uma lista';
  end if;
  select * into r from public.yt_reporting_reports t where t.report_id = p_report_id for update;
  if not found then
    raise exception 'yt_own_traffic_detail_apply: relatório não encontrado';
  end if;
  if r.report_type_id <> 'channel_traffic_source_a3' or r.status not in ('baixado', 'vazio') then
    raise exception 'yt_own_traffic_detail_apply: relatório de tipo ou estado inesperado (%, %)', r.report_type_id, r.status;
  end if;
  if r.end_time - r.start_time > interval '25 hours' then
    raise exception 'yt_own_traffic_detail_apply: o relatório cobre mais de um dia';
  end if;
  v_day := (r.start_time at time zone 'UTC')::date;
  if exists (select 1 from jsonb_to_recordset(p_rows) as j(day_pt date) where j.day_pt is distinct from v_day) then
    raise exception 'yt_own_traffic_detail_apply: linha de dia diferente do dia do relatório';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_dim:' || r.channel_id::text, 0));

  if exists (select 1 from public.yt_reporting_reports n
             where n.channel_id = r.channel_id and n.report_type_id = r.report_type_id and n.start_time = r.start_time
               and n.status in ('baixado', 'vazio') and n.normalized_at is not null
               and (n.create_time, n.report_id) > (r.create_time, r.report_id))
     or exists (select 1 from public.yt_own_video_traffic_detail_daily d
                where d.channel_id = r.channel_id and d.day_pt = v_day and d.report_create_time > r.create_time) then
    update public.yt_reporting_reports t set normalized_at = now() where t.report_id = p_report_id;
    return jsonb_build_object('status', 'superado', 'dia', v_day, 'gravadas', 0, 'apagadas', 0, 'videos_cobertos', 0);
  end if;

  delete from public.yt_own_video_traffic_detail_daily d where d.channel_id = r.channel_id and d.day_pt = v_day;
  get diagnostics v_apagadas = row_count;

  insert into public.yt_own_video_traffic_detail_daily
    (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, video_id, channel_id,
     views, watch_time_minutes, source, source_report_id, report_create_time, collected_at, metric_version)
  select j.youtube_video_id, v_day, j.source_type, j.detail, j.detail_hash, r.site_id, j.video_id, r.channel_id,
         j.views, j.watch_time_minutes, 'reporting_api', r.report_id, r.create_time, now(), j.metric_version
  from jsonb_to_recordset(p_rows) as j(
    youtube_video_id text, video_id uuid, source_type text, detail text, detail_hash text,
    views bigint, watch_time_minutes numeric, metric_version text);
  get diagnostics v_gravadas = row_count;

  for x in
    select v.youtube_video_id, v.id as video_id from public.youtube_videos v where v.channel_id = r.channel_id
    union
    select j.youtube_video_id, null::uuid from jsonb_to_recordset(p_rows) as j(youtube_video_id text)
    where not exists (select 1 from public.youtube_videos v2 where v2.channel_id = r.channel_id and v2.youtube_video_id = j.youtube_video_id)
  loop
    perform public.yt_own_dim_coverage_extend(x.youtube_video_id, 'detalhe', v_day, v_day, r.site_id, x.video_id, r.channel_id, 'reporting_api');
    v_cobertos := v_cobertos + 1;
  end loop;

  update public.yt_reporting_reports t
     set normalized_at = now(), unmatched_video_ids = p_unmatched
   where t.report_id = p_report_id;
  return jsonb_build_object('status', 'gravado', 'dia', v_day, 'gravadas', v_gravadas, 'apagadas', v_apagadas, 'videos_cobertos', v_cobertos);
end $$;

-- ── 5e. Gravar o alcance por dimensão de UM relatório (mesma regra da 5d) ───
-- p_rows: [{youtube_video_id, video_id?, day_pt, traffic_source_type, device_type, operating_system,
--           thumbnail_impressions, thumbnail_clicks_est?, metric_version}]
create or replace function public.yt_own_reach_dim_apply(p_report_id text, p_rows jsonb, p_unmatched jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r public.yt_reporting_reports%rowtype;
  v_day date;
  v_apagadas integer := 0;
  v_gravadas integer := 0;
  v_cobertos integer := 0;
  x record;
begin
  if jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'yt_own_reach_dim_apply: p_rows tem de ser uma lista';
  end if;
  select * into r from public.yt_reporting_reports t where t.report_id = p_report_id for update;
  if not found then
    raise exception 'yt_own_reach_dim_apply: relatório não encontrado';
  end if;
  if r.report_type_id <> 'channel_reach_combined_a1' or r.status not in ('baixado', 'vazio') then
    raise exception 'yt_own_reach_dim_apply: relatório de tipo ou estado inesperado (%, %)', r.report_type_id, r.status;
  end if;
  if r.end_time - r.start_time > interval '25 hours' then
    raise exception 'yt_own_reach_dim_apply: o relatório cobre mais de um dia';
  end if;
  v_day := (r.start_time at time zone 'UTC')::date;
  if exists (select 1 from jsonb_to_recordset(p_rows) as j(day_pt date) where j.day_pt is distinct from v_day) then
    raise exception 'yt_own_reach_dim_apply: linha de dia diferente do dia do relatório';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('yt_own_dim:' || r.channel_id::text, 0));

  if exists (select 1 from public.yt_reporting_reports n
             where n.channel_id = r.channel_id and n.report_type_id = r.report_type_id and n.start_time = r.start_time
               and n.status in ('baixado', 'vazio') and n.normalized_at is not null
               and (n.create_time, n.report_id) > (r.create_time, r.report_id))
     or exists (select 1 from public.yt_own_video_reach_dim_daily d
                where d.channel_id = r.channel_id and d.day_pt = v_day and d.report_create_time > r.create_time) then
    update public.yt_reporting_reports t set normalized_at = now() where t.report_id = p_report_id;
    return jsonb_build_object('status', 'superado', 'dia', v_day, 'gravadas', 0, 'apagadas', 0, 'videos_cobertos', 0);
  end if;

  delete from public.yt_own_video_reach_dim_daily d where d.channel_id = r.channel_id and d.day_pt = v_day;
  get diagnostics v_apagadas = row_count;

  insert into public.yt_own_video_reach_dim_daily
    (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system, site_id, video_id, channel_id,
     thumbnail_impressions, thumbnail_clicks_est, source_report_id, report_create_time, collected_at, metric_version)
  select j.youtube_video_id, v_day, j.traffic_source_type, j.device_type, j.operating_system, r.site_id, j.video_id, r.channel_id,
         j.thumbnail_impressions, j.thumbnail_clicks_est, r.report_id, r.create_time, now(), j.metric_version
  from jsonb_to_recordset(p_rows) as j(
    youtube_video_id text, video_id uuid, traffic_source_type text, device_type text, operating_system text,
    thumbnail_impressions bigint, thumbnail_clicks_est numeric, metric_version text);
  get diagnostics v_gravadas = row_count;

  for x in
    select v.youtube_video_id, v.id as video_id from public.youtube_videos v where v.channel_id = r.channel_id
    union
    select j.youtube_video_id, null::uuid from jsonb_to_recordset(p_rows) as j(youtube_video_id text)
    where not exists (select 1 from public.youtube_videos v2 where v2.channel_id = r.channel_id and v2.youtube_video_id = j.youtube_video_id)
  loop
    perform public.yt_own_dim_coverage_extend(x.youtube_video_id, 'alcance_dim', v_day, v_day, r.site_id, x.video_id, r.channel_id, 'reporting_api');
    v_cobertos := v_cobertos + 1;
  end loop;

  update public.yt_reporting_reports t
     set normalized_at = now(), unmatched_video_ids = p_unmatched
   where t.report_id = p_report_id;
  return jsonb_build_object('status', 'gravado', 'dia', v_day, 'gravadas', v_gravadas, 'apagadas', v_apagadas, 'videos_cobertos', v_cobertos);
end $$;

-- ── 5f. Os números de prova da etapa (uma ida ao banco por execução do cron, por site) ─
-- p_site = o site (obrigatório: o banco de integração é dividido entre etapas, e a prova nunca soma sites).
-- p_hoje = "hoje" no Pacífico, vindo do código (nunca current_date: o banco está em UTC).
-- p_desde = a data de partida da coleta de dimensões (DIMENSOES_DESDE).
-- Parâmetro nulo é erro, nunca "0 faltando".
--   faltando_cobertura: (vídeo, conjunto) de canal com coleta ligada, com base que chega à data de partida, cuja
--     cobertura não chega a menor(p_hoje - 4, base). NP-E11. Vídeo com a base parada ANTES da data de partida não
--     conta aqui (nada há para cobrir; base parada é alarme da dieta): vai em videos_base_antes_do_inicio.
--   videos_com_base: vídeos com alguma cobertura 'base'. 0 com vídeos cadastrados = a dieta (E6 P2) não está no ar.
--   videos_sem_base: vídeos de canal ligado, publicados há mais de 4 dias (dia do Pacífico), sem NENHUMA cobertura
--     'base'. O vídeo recém-publicado não conta: o diário leva de 2 a 3 dias para devolver o primeiro dia.
--   base_ate: o MENOR, entre os canais ligados que têm base, do dia mais recente coberto pela base (um canal parado
--     não se esconde atrás de outro em dia). Nulo = nenhuma base.
--   dias_dois_relatorios_*: (canal, dia) com mais de um source_report_id nos últimos 60 dias (item 249; tem de ser 0).
--   pendentes_normalizar: relatórios dos dois tipos baixados há mais de 2 dias sem normalizar (relatório em 'erro'
--     não conta aqui: é do critério de relatório em erro, que já existe).
create or replace function public.yt_own_dim_prova(p_site uuid, p_hoje date, p_desde date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_site is null or p_hoje is null or p_desde is null then
    raise exception 'yt_own_dim_prova: p_site, p_hoje e p_desde são obrigatórios' using errcode = '22023';
  end if;
  return (
    with canais as (select c.id from public.youtube_channels c where c.sync_enabled and c.site_id = p_site),
    base as (
      select k.youtube_video_id, max(k.covered_to) as base_to
      from public.yt_own_video_coverage k
      where k.metric_set = 'base' and k.channel_id in (select id from canais)
      group by k.youtube_video_id),
    falta as (
      select b.youtube_video_id, s.metric_set
      from base b cross join (values ('trafego'), ('dispositivo'), ('pais'), ('inscrito')) as s(metric_set)
      where b.base_to >= p_desde
        and not exists (
          select 1 from public.yt_own_video_coverage k
          where k.youtube_video_id = b.youtube_video_id and k.metric_set = s.metric_set
            and k.covered_to >= least(p_hoje - 4, b.base_to)))
    select jsonb_build_object(
      'faltando_cobertura', (select count(*) from falta),
      'videos_com_base', (select count(*) from base),
      'videos_base_antes_do_inicio', (select count(*) from base b where b.base_to < p_desde),
      'videos_sem_base', (select count(*) from public.youtube_videos v
                          where v.channel_id in (select id from canais)
                            and (v.published_at at time zone 'America/Los_Angeles')::date <= p_hoje - 4
                            and not exists (select 1 from base b where b.youtube_video_id = v.youtube_video_id)),
      'base_ate', (select min(x.m) from (
          select max(k.covered_to) as m from public.yt_own_video_coverage k
          where k.metric_set = 'base' and k.channel_id in (select id from canais) group by k.channel_id) x),
      'dias_dois_relatorios_detalhe', (select count(*) from (
          select d.channel_id, d.day_pt from public.yt_own_video_traffic_detail_daily d
          where d.site_id = p_site and d.day_pt >= p_hoje - 60 group by 1, 2 having count(distinct d.source_report_id) > 1) x),
      'dias_dois_relatorios_alcance', (select count(*) from (
          select d.channel_id, d.day_pt from public.yt_own_video_reach_dim_daily d
          where d.site_id = p_site and d.day_pt >= p_hoje - 60 group by 1, 2 having count(distinct d.source_report_id) > 1) x),
      'pendentes_normalizar', (select count(*) from public.yt_reporting_reports r
                               where r.site_id = p_site
                                 and r.report_type_id in ('channel_traffic_source_a3', 'channel_reach_combined_a1')
                                 and r.status in ('baixado', 'vazio') and r.normalized_at is null
                                 and r.downloaded_at < now() - interval '2 days'
                                 and r.channel_id in (select id from canais))
    ));
end $$;

revoke all on function public.yt_own_dim_coverage_extend(text, text, date, date, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.yt_own_dim_coverage_extend(text, text, date, date, uuid, uuid, uuid, text) to service_role;
revoke all on function public.yt_own_dim_apply(text, text, date, date, jsonb, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.yt_own_dim_apply(text, text, date, date, jsonb, uuid, uuid, uuid) to service_role;
revoke all on function public.yt_own_dim_cover_idle(uuid, date, date, date) from public, anon, authenticated;
grant execute on function public.yt_own_dim_cover_idle(uuid, date, date, date) to service_role;
revoke all on function public.yt_own_traffic_detail_apply(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_traffic_detail_apply(text, jsonb, jsonb) to service_role;
revoke all on function public.yt_own_reach_dim_apply(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.yt_own_reach_dim_apply(text, jsonb, jsonb) to service_role;
revoke all on function public.yt_own_dim_prova(uuid, date, date) from public, anon, authenticated;
grant execute on function public.yt_own_dim_prova(uuid, date, date) to service_role;

-- ── 6. Remover canal: toda tabela presa ao canal conta como série ───────────
-- CORPO ÚNICO DA A5 (decisão R1 do controlador). O bloco entre as marcas abaixo é o da MG14 (o plano das ordens 8 e 10
-- é o dono do texto), SEM MUDAR UM BYTE: 76 linhas com as duas marcas. Não há lista de tabelas: serie_coletada soma toda
-- tabela de public com chave estrangeira "on delete restrict" para youtube_channels. As três tabelas desta migration têm
-- essa chave e entram sozinhas. Reaplicar o bloco depois da MG14 não muda nada; se a função tiver sido recriada com
-- outro corpo no meio do caminho, este a devolve ao certo.
-- >>> corpo único: youtube_channel_removal_impact (início)
create or replace function public.youtube_channel_removal_impact(p_site_id uuid, p_channel_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_name text;
  v_slug text;
  v_yt text;
  v_serie bigint := 0;
  v_n bigint;
  v_t record;
begin
  select c.name, c.slug, c.channel_id into v_name, v_slug, v_yt
  from public.youtube_channels c where c.id = p_channel_id and c.site_id = p_site_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- linhas da coleta que apontam para o canal (o bruto vai junto com o relatório, por cascata)
  for v_t in
    select k.conrelid::regclass::text as tabela, a.attname::text as coluna
      from pg_catalog.pg_constraint k
      join pg_catalog.pg_class r on r.oid = k.conrelid
      join pg_catalog.pg_namespace n on n.oid = r.relnamespace
      join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
     where k.contype = 'f' and k.confrelid = 'public.youtube_channels'::regclass
       and k.confdeltype = 'r' and n.nspname = 'public' and cardinality(k.conkey) = 1
     order by 1
  loop
    execute format('select count(*) from %s t where t.%I = $1', v_t.tabela, v_t.coluna) into v_n using p_channel_id;
    v_serie := v_serie + v_n;
  end loop;

  return jsonb_build_object(
    'status', 'ok',
    'name', v_name,
    'slug', v_slug,
    'videos', (select count(*) from public.youtube_videos v where v.channel_id = p_channel_id),
    'comments', (select count(*) from public.youtube_curated_comments cc
                 join public.youtube_videos v on v.id = cc.video_id where v.channel_id = p_channel_id),
    'sync_logs', (select count(*) from public.youtube_sync_log l where l.channel_id = p_channel_id),
    'ab_tests', (select count(*) from public.ab_tests t
                 join public.youtube_videos v on v.id = t.youtube_video_id
                 where v.channel_id = p_channel_id and t.status not in ('active', 'paused', 'queued', 'draft')),
    'ab_drafts', (select count(*) from public.ab_tests t
                  join public.youtube_videos v on v.id = t.youtube_video_id
                  where v.channel_id = p_channel_id and t.status = 'draft'),
    'analyses', (select count(*) from public.youtube_intelligence i
                 where i.channel_id = p_channel_id
                    or i.video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)),
    'tasks', (select count(*) from public.youtube_intelligence_tasks k where k.channel_id = p_channel_id),
    'notes', (select count(*) from public.youtube_notes n where n.channel_id = p_channel_id),
    'notifications', (select count(*) from public.yt_notifications nt
                      where nt.youtube_video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)
                         or nt.ab_test_id in (select t.id from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
                                              where v.channel_id = p_channel_id)
                         or nt.optimization_cycle_id in (select oc.id from public.optimization_cycles oc
                                                         join public.youtube_videos v on v.id = oc.youtube_video_id
                                                         where v.channel_id = p_channel_id)),
    'connections', (select count(*) from public.social_connections sc
                    where sc.site_id = p_site_id and sc.provider = 'youtube' and sc.account_id = v_yt and sc.revoked_at is null),
    'pipeline_links', (select count(*) from public.content_pipeline p
                       where p.youtube_channel_id = p_channel_id
                          or p.youtube_video_id in (select v.id from public.youtube_videos v where v.channel_id = p_channel_id)),
    'serie_coletada', v_serie,
    'blockers', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'started_at', t.started_at,
                                          'paused_at', t.paused_at, 'video_title', v.title)
                       order by t.started_at nulls last, t.id)
      from public.ab_tests t join public.youtube_videos v on v.id = t.youtube_video_id
      where v.channel_id = p_channel_id and t.status in ('active', 'paused', 'queued')), '[]'::jsonb)
  );
end $$;

revoke all on function public.youtube_channel_removal_impact(uuid, uuid) from public, anon, authenticated;
grant execute on function public.youtube_channel_removal_impact(uuid, uuid) to service_role;
-- <<< corpo único: youtube_channel_removal_impact (fim)
```

### Apêndice C — (retirado)

O stub da MG14 saiu deste plano (emenda do portão: dados I-6). A MG7 foi rodada contra o texto real da MG14: `docs/superpowers/plans/2026-10-12-a5-e6-e8-dieta-e-retencao-plan.md`, Apêndice A.
