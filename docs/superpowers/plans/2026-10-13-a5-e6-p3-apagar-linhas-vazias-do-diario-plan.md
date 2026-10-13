# A5, ordem 14: E6 (P3), apagar as linhas vazias do diário do canal próprio (plano de implementação)

Escrito em 13/10/2026. Primeira versão, ainda sem portão dos dois especialistas. **Emenda 1, de 13/10/2026:** resposta aos pareceres da rodada 1 (dados e software); cada trecho mudado traz a marca "(emenda 1: <achado>)", com `D-` para o parecer de dados e `S-` para o de software; a lista está em `.superpowers/sdd/a5-planos-onda-2/e6-p3-apagar-linhas-vazias-do-diario/resposta-r1.md`. Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md`, seção 7.1 (passos P3 e P4, "Conferência de contagem", "Plano de volta") e itens de aceite 47, 48, 49 e 50; `00-indice-decisoes-e-sequencia.md`, linhas 343, 387, 395 e 418 e risco 8; `06-ciclo-de-vida-volume-e-cota.md`, linha 7 da tabela de 9.2 e item 231. Migration: **MG15**, sozinha, aplicada pelo dono. Plano irmão (P1 e P2, MG14): `docs/superpowers/plans/2026-10-12-a5-e6-e8-dieta-e-retencao-plan.md`, daqui em diante "plano irmão".

**Objetivo, em três frases.** Apagar de `yt_own_video_daily` as linhas de dia sem nenhuma atividade (cerca de 94 mil das 97 mil, 97,5% da tabela), depois de guardar uma cópia fora do banco (CSV, com o dono) e uma cópia dentro do banco (tabela de backup), e devolver o espaço com `vacuum full` (de 72 MB para menos de 2 MB). A migration só apaga se ela mesma provar, na hora, que o coletor novo (P2) rodou limpo nos três últimos dias, que toda linha que vai sair está dentro da cobertura e que as contas de antes e de depois fecham; se qualquer prova falhar ela recusa por inteiro e nada muda. O caminho de volta fica escrito, testado e guardado no repositório em três formas: restaurar do backup, recriar os zeros a partir da cobertura, e restaurar do CSV.

**Fica FORA deste plano.**
- **P1 e P2** (MG14, coletor pela função, leitor tolerante, critério de cobertura no cron, semente e2e): são do plano irmão. Este plano **depende** deles em produção e não edita nenhum arquivo deles.
- **P4** (MG16, `drop table` do backup, 14 dias ou mais depois): outra etapa, outra migration. Aqui só nasce a conferência com data que lembra dela.
- **A dieta de `yt_own_video_meta_daily`** (MG17, E18 parte 2): usa o mesmo ritual; o texto do ritual daqui (seção 2 e Apêndice D) é a referência, mas a MG17 é de outro plano.
- **A dívida D1 do plano irmão** (a janela do diário repedir um buraco antigo de cobertura). O plano irmão a entregou a este "porque mexe na mesma janela"; este plano **não mexe na janela nem no coletor**. Fica na dívida (seção 13), com o motivo.
- **Regenerar `database.types.ts`**: a tabela de backup é temporária e nenhum código a lê.
- **Tela, navegador, mockup:** não há tela nova. Nenhuma rota em `api/pipeline/` é criada ou alterada; nada em `api-registry.ts`, `apps/web/data/pipeline-docs/` nem `docs/cowork-*` (Pipeline Integrity: não se aplica).
- **Cron, variável de ambiente, interruptor:** a etapa não tem passo de cron nem variável. O "interruptor" é a própria migration, que recusa (seção 6).

---

## 0. Dependências duras (ler antes de tudo)

### 0.1 O que este plano usa da MG14 e do código de P2

| O que uso | Forma exata | Fonte (lida em 13/10) | Onde uso |
|---|---|---|---|
| `public.yt_own_video_coverage` | chave `(youtube_video_id, metric_set, covered_from)`; `site_id uuid not null`; `covered_to >= covered_from`; conjuntos `base` e `estendidas` | `.superpowers/sdd/a5-e6-e8/sql/mg14.sql:18-35` | a regra "coberta" da linha que sai; as contas |
| Semântica da carga | `base` cobre toda linha com `views` não nulo; `estendidas` cobre toda linha com `engaged_views` não nulo | `mg14.sql:51-72` | regras 3 e 4 do critério (seção 4) |
| O que `yt_own_daily_apply` já apaga | linha de dia **devolvido** com `views = 0` e as outras oito contagens zero ou nulas; **não** olha `avg_view_*`, `card_click_rate` nem a cobertura | `mg14.sql:199-207` | o critério daqui é o mesmo nas nove contagens e **mais estreito** no resto |
| `resumo.diario` do cron | objeto com `apagadas`, `intervalos`, `pendentes`, `tentativas`, `estendidas_recusadas`, `estendidas_ausentes`, `atrasados_antigos`, `com_buraco`. **(emenda 1: D-I-1, S-I-1) `apagadas` é número em TODA saída do passo novo, inclusive quando ele não coletou nada** (nasce em 0 em `diario-step.ts:70-73` e `fechar()` devolve o mesmo objeto em canal sem autorização, sem tempo dentro do passo, API sem dias e falha ao ler `youtube_videos`). Só não traz `apagadas` o coletor antigo e o corte feito pelo executor antes de o passo começar (`index.ts:139-144`); passo que lançou não deixa a chave. Por isso a regra de "limpa" olha também `pendentes`, `tentativas`, `intervalos`, `atrasados_antigos` e `estendidas_recusadas` | `apps/web/src/lib/youtube/coleta/diario-step.ts:32-48`; `coleta/index.ts:268-271`; `coleta/types.ts:53-57`; rota `sync-analytics-metrics/route.ts:589-604` | a guarda das três execuções limpas |
| Notas de falha do diário e da cobertura em `falhas` | começam por `diário:` (passo e critério), ou por `diario:` (o passo lançou: `index.ts:123-125`), ou contêm `yt_own_video_coverage`, `yt_own_daily_apply` ou `cobertura` | `diario-step.ts:93, 124, 134, 140, 243, 287, 290, 294`; `criteria-cobertura.ts:86, 90, 193, 267` | idem |
| `yt_own_collection_runs` | `ran_at timestamptz`, `falhas text[] not null`, `resumo jsonb not null`; **sem `site_id`** (a execução é do cron inteiro) | `supabase/migrations/20261008000002_coleta_canais_proprios_l1b.sql:67-79` | idem; por isso a guarda das execuções é global, não por site |
| O leitor tolerante (Tarefa 5 do plano irmão) | `lerDiario` passa a ler os intervalos `base` e a materializar `views: 0` em dia coberto sem linha | plano irmão, linhas 602 a 633. **Ainda não existe no código local** (`proprio/ler.ts:127-158` lê só a tabela; não há `cobertura-leitor.ts`) | condição do portão (0.2, G1) |

**Não uso** `yt_own_daily_apply` nem nenhuma função da MG5 ou da MG7. Não recrio `youtube_channel_removal_impact`: a tabela de backup **não tem chave estrangeira**, então não entra em `serie_coletada`, e a remoção de canal continua recusada pela cobertura (chave `restrict`), como hoje.

### 0.2 O portão da P3: o que tem de estar provado antes de o arquivo da migration existir

Nada disto é verdade em 13/10. Cada linha é uma **conferência pendente** (só leitura; quem roda é o controlador; as consultas com letra e número estão na seção 3.2 e na seção 11). O arquivo da MG15 só é criado (Tarefa 6) com as doze em verde.

| # | Condição | Como se prova | Se falhar |
|---|---|---|---|
| G1 | O lote E6-P2 do plano irmão está em `main` e em produção, **com o leitor tolerante** | `git grep -c yt_own_video_coverage origin/main -- apps/web/src/lib/youtube/observatorio/proprio/ler.ts` maior que 0; `git cat-file -e origin/main:apps/web/src/lib/youtube/observatorio/proprio/cobertura-leitor.ts`; **(emenda 1: D-M-1)** `git grep -n "criteria-cobertura" origin/main -- apps/web/src/lib/youtube/coleta/index.ts` com pelo menos uma linha (hoje o critério de cobertura **não** está ligado no cron: nenhum `import` dele em `coleta/index.ts`, e sem ele o alarme do risco 6 não existe); e o deploy de produção é desse commit ou posterior: o controlador copia do painel da Vercel o SHA do deploy de produção em vigor, anota no ledger, e `git merge-base --is-ancestor <sha do commit do lote E6-P2> <sha do deploy>` sai com código 0 (reconciliação 13/10, emenda 3: I1) **o SHA do lote é o do commit como está em `origin/main`, isto é, a cópia que subiu por árvore de lote (`git log origin/main -- apps/web/src/lib/youtube/observatorio/proprio/cobertura-leitor.ts`), nunca o hash do `staging` local: o local não é ancestral de `origin/main` nem do deploy, e a conferência falharia com o lote em produção** | a P3 não começa. Com o leitor antigo, todo dia de zero vira "não medido" na tela |
| G2 | `E6_P2_DEPLOY` tem data e a conferência `e6-p2-tres-execucoes` tem `feitaEm` | `grep -n "E6_P2_DEPLOY\|e6-p2-tres-execucoes" apps/web/src/lib/conferencias.ts .superpowers/sdd/a5/conferencias-com-data.md` | espera |
| G3 | Três execuções limpas, em três dias seguidos, a última há menos de 36 horas | CP5 (a mesma regra que a migration aplica) devolve **três linhas** (emenda 1: D-M-5, S-M-6), de três dias seguidos, com `limpa` verdadeiro nas três e a primeira com `ran_at` de menos de 36 horas | espera um dia e roda de novo. Se o formato de `resumo.diario` não for o da tabela de 0.1, **o Apêndice A é corrigido antes** e a Tarefa 1 roda de novo |
| G4 | Nenhuma linha vazia fora da cobertura `base` | CP3 = 0 | a P3 não roda: a migration recusaria. Descobrir de onde vieram (linha gravada pelo coletor antigo depois da MG14 e nunca coberta) |
| G5 | Nenhuma linha vazia traz média ou taxa de cartão preenchida | CP2 (a) = 0 | ver pergunta 3 da seção 1: o padrão é essas linhas **ficarem**. (emenda 1: D-I-2) A CP2 roda **antes da Tarefa 1**, e a resposta do dono escolhe entre o texto padrão e a variante Z da regra 2, os dois escritos no Apêndice A e testados |
| G6 | Sem buraco e em dia | CP4: 0 e `atrasados` 0 | buraco antigo não impede (a linha do buraco não é coberta e não sai), mas tem de estar explicado no ledger |
| G7 | O coletor novo não cria linha vazia | CP6 = 0 | o coletor de produção não é o novo: volta a G1 |
| G8 | Nada mais no banco lê o diário | CP9: só as funções da lista | ler a função desconhecida antes de seguir |
| G9 | A forma do diário é a que o Apêndice A espera (20 colunas, nessa ordem) | CP1b | corrigir a lista do Apêndice A (a migration recusa sozinha se divergir) |
| G10 | Nenhuma outra migration pendente | `npx supabase migration list --linked` (controlador): a única linha sem data remota será a MG15, depois de criada; **(emenda 1: S-I-2)** e o ledger comum `.superpowers/sdd/a5/` traz a linha "MG15 pendente: db push bloqueado" desde antes do `db:new` | **parar**: `db:push:prod` aplicaria as outras junto |
| G11 | O ensaio local em volume de produção rodou duas vezes, com tempo medido | Tarefa 3, saída guardada | se o `delete` passar de 10 s, parar e avisar (seção 5) |
| G12 | Acordo dos dois especialistas sobre este plano e sobre o SQL rodado | pareceres em `.superpowers/sdd/a5/` | emenda |

### 0.3 Avisos de topo

- **O SQL dos apêndices NÃO foi rodado pelo autor.** A regra desta onda de planos é só leitura do repositório. A Tarefa 1 (testes contra o `bythiago_int`) e a Tarefa 3 (roteiro em volume de produção, duas vezes, dentro de `begin; … rollback;`) são as que rodam; o que elas acharem emenda os apêndices **antes** do portão. Todo número de tempo deste plano está marcado "não medido".
- **Esta é a única migration da A5, até aqui, que não é inerte para o código antigo.** Ver "Convive com o código?" na seção 2.
- **O arquivo da MG15 não é criado antes da vez dela** (Tarefa 6). `npm run db:push:prod` aplica todo arquivo pendente; um arquivo destrutivo criado cedo entraria no envio de outro lote. Até lá o SQL vive no Apêndice A e numa cópia de ensaio em `.superpowers/sdd/a5-e6-p3/sql/mg15.sql` (fora do git).
- **(emenda 1: S-I-2) Depois de criado, o arquivo fica armado.** `scripts/db-push-prod.sh` roda `npx supabase db push` sem filtro, e migration que recusou não é registrada: continua pendente e entra no próximo envio de qualquer lote. Três defesas, na seção 2 ("Arquivo armado"): nenhum outro `db:push:prod` enquanto ele existir sem estar aplicado; arquivo que recusou e não é reaplicado no mesmo dia **sai** do repositório; e a migration exige a marca do dia que o dono põe no passo do CSV, sem a qual recusa.
- **Escrita em produção é do dono:** o `\copy` do CSV, o `db:push:prod` e o `vacuum full`. O agente prepara os comandos, um por linha (Apêndice D).
- **Banco local:** antes de aplicar a MG15 num banco local que tenha diário semeado com zeros (o do navegador, portas 54321 e 54322), é preciso tirar as linhas vazias da semente (Tarefa 6, passo 4, com o aviso do controlador aos outros terminais: emenda 1, D-M-6) ou a migration recusa por falta da marca do dia e das três execuções. Banco novo (diário vazio) aplica sem recusa. Está na Tarefa 6.
- **Nada aqui é dado pessoal.** O diário traz id de vídeo e contagens do próprio canal. É dado privado de desempenho: seção 4.4.

---

## 1. Perguntas que só o dono responde

Nenhuma trava o início. O plano segue com o padrão.

1. **Onde guardar o CSV?** Recomendo `~/Workspace/arquivo-observatorio/dieta-diario/yt_own_video_daily-AAAAMMDD.csv`, com o `.sha256` ao lado, fora do repositório (a pasta ainda não existe: `ls` em 13/10). **Padrão:** essa pasta; cópia para o NAS quando a fase do NAS chegar. **Trava:** nada.
2. **Em que dia e hora?** Recomendo o primeiro dia depois do portão verde, entre 14:00 e 20:00 de Brasília (17:00 a 23:00 UTC): longe da janela proibida (11:30 a 13:00 UTC) e com 13 horas ou mais até o cron seguinte. **Padrão:** o dono escolhe o dia; a migration recusa sozinha dentro da janela. **Trava:** só a data da Tarefa 7.
3. **Se existirem linhas vazias com média (`avg_view_*`) ou taxa de cartão preenchida** (o spec diz que não existem; CP2 confere): apagar mesmo assim? Apagar trocaria "0%" por "não medido" na tela daquele dia. **Padrão: ficam.** A tabela termina maior do que o item 48 pede e o ledger diz quantas ficaram e por quê. **Trava:** nada; só muda o número final. **(emenda 1: D-I-2) A pergunta vai ao dono fechada, com os números da CP2, antes da Tarefa 1.** O ramo "todas as vazias têm média zero" é provável, não remoto: a regra "dia sem view grava nulo nas médias" entrou no coletor em 10/10/2026 (commit `74f50884`) e a tabela nasceu em 09/10/2026 (commit `0d619cb9`); se a carga da vida inteira rodou antes do conserto, as linhas antigas trazem média 0, não nula (**não medido: só a CP2 responde**). As duas respostas levam a SQL já escrito e testado: "ficam" = o texto padrão do Apêndice A; "apaga as de média zero" = a **variante Z** (média ou taxa nula **ou igual a zero** sai; diferente de zero continua ficando). O efeito visível da variante Z: no leitor de hoje (`proprio/ler.ts:149`) a linha de zero views com percentual 0 entrega percentual 0 naquele dia; sem a linha, o dia entrega percentual nulo. A média ponderada por views não muda (`assistido.ts:49` já pula dia sem view). Sem resposta do dono vale o padrão, e a etapa pode terminar sem ganho de espaço (risco 8).
4. **O `vacuum full` no mesmo dia?** Recomendo que sim, logo depois das conferências V1 a V6: trava a tabela pelo tempo de regravar cerca de 2.500 linhas (não medido; esperado abaixo de 1 segundo). **Padrão:** no mesmo dia. Se ele preferir não rodar, nada quebra: a tabela continua com 72 MB e o item 48 fica aberto. **Trava:** o item 48.

---

## 2. O que é do dono

**Três coisas, no mesmo dia, nesta ordem, que não pode inverter:** o CSV, a migration, o `vacuum full`. Produção está na versão `20261012000004` mais os lotes B e C que forem aplicados até lá (não medido no dia: G10).

| Passo | Quem | O quê | Se inverter ou pular |
|---|---|---|---|
| 1 | controlador | o portão G1 a G12 (0.2), anotado no ledger `.superpowers/sdd/a5-e6-p3/progress.md` | a migration recusa nos casos G3, G4, G9; nos outros nada avisa: por isso o portão é escrito |
| 2 | agente (Tarefa 6) | **no mesmo dia do passo 5** (emenda 1: S-I-2): o controlador anota "MG15 pendente: db push bloqueado" no ledger comum; depois `npm run db:new observatorio_a5_e6_p3_apagar_linhas_vazias`, cola o Apêndice A, `diff` contra o ensaio, testes locais, commit local por caminho | arquivo criado cedo, ou deixado para trás depois de uma recusa, entra no `db push` de outro lote |
| 3 | **dono** | cria a pasta e tira o CSV (Apêndice D, linhas 1 a 6): `\copy` da tabela inteira, `wc -l`, `shasum`; e põe a **marca do dia** no diário (Apêndice D, linha 7; emenda 1: S-I-2) | sem o CSV, depois da MG16 não há volta byte a byte (só a volta B). Sem a marca do dia a migration recusa |
| 4 | controlador | **contagens "antes"** (A1) e **retrato "antes"** (V5), com o instante; prova local de que o CSV restaura (seção 11, R1): linhas do CSV = `t` da A1 | sem o "antes", o item 47 fica só com o que a migration anotou (V2), que basta para as contas mas não para o retrato |
| 5 | **dono** | `npm run db:push:prod` (digita `YES`), fora de 11:30 a 13:00 UTC | dentro da janela: a migration recusa, nada muda, roda de novo depois, **no mesmo dia**. (emenda 1: D-M-4, S-I-2) Qualquer recusa cuja nova tentativa fique para outro dia: o arquivo sai do repositório e o ritual recomeça do passo 2, com CSV, `sha256`, marca, A1, V5 e R1 novos (o CSV de ontem não é o diário de hoje) |
| 6 | controlador | V1 a V6 (seção 11), anotadas | qualquer diferença: volta A (Apêndice B), no mesmo dia |
| 7 | **dono** | `vacuum full` (Apêndice D, a linha do `vacuum`; depois da V7, a linha que retira a marca do dia) | antes da migration: regrava 72 MB à toa. Sem ele: espaço não volta |
| 8 | controlador | V7 (item 48) | |
| 9 | agente (Tarefa 7) | preenche `E6_P3_APLICADA`, commit, push em `staging`, CI, promoção a `main` (fora de 11:55 a 12:15 UTC) | sem a data, as conferências D+1, D+7 e D+14 nunca vencem e nada avisa |

**Nome para o `db:new`:** `observatorio_a5_e6_p3_apagar_linhas_vazias`. Uma migration só, sozinha no `db push`.

**Arquivo armado (emenda 1: S-I-2).** Enquanto o arquivo da MG15 existir em `supabase/migrations/` sem estar aplicado em produção, valem três regras:
1. **Nenhum outro `db:push:prod`, de lote nenhum.** O controlador escreve "MG15 pendente: db push bloqueado" no ledger comum `.superpowers/sdd/a5/` antes do `db:new` e só retira a linha quando a V1 passar ou quando o arquivo sair. **(reconciliação 13/10: R14) Os planos da E10 (MG6), da E4 (MG4) e da E9 (MG18) não conheciam esta linha; cada um ganhou, na tarefa da própria migration, a conferência dela antes do `db:new`. O arquivo exato é `.superpowers/sdd/a5/fila-do-db-push.md` (o controlador cria na primeira vez; uma linha por arquivo armado, com data e hora).**
2. **Recusou e não vai ser reaplicada no mesmo dia: o arquivo sai.** O commit da Tarefa 6 é local e sem push; desfaz-se por um commit novo que remove o arquivo (`git rm` do caminho e commit por caminho; nunca `reset`). No dia da nova tentativa o arquivo nasce de novo por `db:new`, com carimbo novo, e o ritual recomeça do passo 2.
3. **A migration exige a marca do dia.** No passo 3 o dono grava no comentário da tabela do diário o texto `P3 armada em AAAA-MM-DD` (dia em UTC; o comando calcula a data). A função recusa se o comentário não trouxer a marca do dia de `p_agora` em UTC: "MG15 recusada: o ritual do CSV não foi feito hoje". Fecha o caso em que as regras 1 e 2 falham por descuido: um `db push` de outro lote, em outro dia, não apaga nada. Banco sem linha vazia continua sem exigir marca nenhuma (CI, banco novo).

A marca prova que o passo 3 foi feito naquele dia; **não prova** que o CSV está inteiro (isso é a R1) nem que a A1 e a V5 "antes" foram anotadas (isso é o ledger). Ritual que atravessa a meia-noite UTC (21:00 de Brasília) toma recusa e repete a linha da marca: por isso a pergunta 2 recomenda terminar antes das 20:00 de Brasília.

**Janela.** Fora de **11:30 a 13:00 UTC** (o cron do canal próprio roda às 12:00 UTC e grava no diário: `apps/web/vercel.json:25`). A migration confere a hora e recusa dentro da janela. Ela pede uma trava `share row exclusive` no diário: **quem lê não espera** (as telas seguem), quem grava espera (só o cron grava, e ele está fora). `lock_timeout` de 5 s: se bater, roda de novo. Duração da trava: **não medida** (Tarefa 3); o que ela faz é apagar cerca de 94 mil linhas de uma tabela de 72 MB e inserir as mesmas no backup. O `vacuum full` pede trava exclusiva (quem lê também espera) pelo tempo de regravar o que sobrou (cerca de 2.500 linhas; não medido).

**Convive com o código que está em `main`? Não é inerte: depende de qual código.**
- **MG15 aplicada com o leitor antigo em `main`** (o de hoje, `ler.ts:134-143`): todo dia de zero passa a ler "não medido" e o canal parado perde a data âncora. Nenhum dado se perde; as telas ficam erradas até o leitor tolerante subir ou a volta A rodar. **Guarda:** G1 no portão; e a migration exige três execuções do coletor novo, que só vai a `main` no mesmo lote do leitor (regra dura de envio do ledger do plano irmão). A migration **não consegue** conferir o leitor por SQL: isso é do portão.
- **MG15 aplicada e, depois, o coletor revertido para o antigo:** o coletor antigo parte do último dia **com linha** de cada vídeo (anos atrás, em 32 dos 35) e regrava a vida inteira com os zeros, em um ou dois dias. As telas não mudam de número; a tabela volta a engordar e ninguém é avisado pelo cron. **Guarda:** a conferência `e6-p3-d7` lê o tamanho; o runbook passa a dizer que, depois da P3, o coletor não se reverte (o conserto é para a frente).
- **Código de P2 em `main` sem a MG15** (o estado de hoje até a P3): é o estado para o qual o leitor tolerante existe. Nada muda.
- **MG15 sem a MG14:** recusa na primeira instrução ("MG15 depende da MG14") e não cria nada.

**Como desfazer.** Três caminhos, na ordem de preferência (textos nos Apêndices B e C e no runbook):
- **Volta A, até a MG16:** restaurar do backup. Devolve as mesmas linhas, coluna por coluna. O espaço volta a ser ocupado.
- **Volta B, sempre:** recriar os zeros a partir da cobertura (a dívida D5 do plano irmão). Equivalente para todo leitor (views 0, dia medido), **não** idêntica byte a byte (`collected_at` novo, contagens em zero onde o original podia ter nulo).
- **Volta C, sempre que o CSV existir:** carregar o CSV numa tabela temporária e inserir o que falta.
- **O que não volta:** o espaço que o `vacuum full` devolveu (volta a ser ocupado se restaurar); e, depois da MG16 sem o CSV, a cópia byte a byte.

**Conferências depois de aplicar** (o controlador roda, só `select`; texto na seção 11):

| # | O que | Esperado |
|---|---|---|
| V1 | a migration entrou inteira e não deixou função | `t, t, 0, f, f, f, t, 0, 0` |
| V2 | o que a migration anotou no comentário da tabela de backup | texto `MG15 <instante> [...]` com `estado: apagado` e `apagadas` igual a `vazias` da A1 menos as que ficaram. **Nulo = nada foi apagado: parar e ler a saída do `db push`** |
| V3 | as contas de depois, contra a A1 | seção 4.3: seis igualdades |
| V4 | toda linha do backup é dia coberto e sem linha no diário | `N, 0, 0`, com N = `apagadas` |
| V5 | retrato da vida inteira, igual ao de antes | mesmo `pares`, mesmos `medidos`, mesma `soma`, **mesmo md5** |
| V6 | K4, K5 e K8 do plano irmão | 0 e 0; `atrasados` 0; 0 |
| V7 | tamanho, depois do `vacuum full` (item 48) | diário menor que 2.097.152 bytes |

---

## 3. Fatos de que o desenho depende

### 3.1 Medidos (com a fonte)

| # | Fato | Fonte |
|---|---|---|
| F1 | Diário em produção, 12/10: **96.892** linhas, **2.455** com atividade, **94.437** sem; soma de views 6.915; 35 vídeos; de 26/08/2015 a 09/10/2026; **72,0 MB**. 22 linhas têm `views` 0 e outra atividade; 14 têm valor negativo. Nenhuma com `views`, `engaged_views` ou `card_impressions` nulos. 35 ilhas para 35 vídeos | plano irmão, fatos P1, P2 e P3 (`select` em produção, 12/10) |
| F2 | Banco inteiro: 170,7 MB em 12/10, plano gratuito de 500 MB | spec `06`, 9.6 |
| F3 | O diário tem 20 colunas, chave `(youtube_video_id, day_pt)`, chaves estrangeiras para `sites` (cascade), `youtube_videos` (set null) e `youtube_channels` (restrict); nenhuma outra migration versionada toca a tabela | `supabase/migrations/20261009000001_coleta_canais_proprios_l2.sql:16-41`; `grep -l yt_own_video_daily supabase/migrations/*.sql` = só esse arquivo |
| F4 | A primeira execução do coletor novo apaga os zeros da janela (280 linhas na simulação) e a soma da cobertura `C` passa a ser **maior** que o número de linhas `T`: `C = T` deixa de valer antes da P3 | plano irmão, fato L4 e desvio 13 |
| F5 | Depois da P2, vídeo sem cobertura tem a vida inteira repedida e os zeros da vida apagados pela função, na execução seguinte | plano irmão, Tarefa 11b (aviso do runbook, m7); `cobertura.ts:100-106` |
| F6 | Quem lê o diário no código: `coleta/diario-step.ts` (só comentário; grava pela função), `coleta/dimensoes-step.ts:351-357` (`views > 0`, de hoje menos 10), `proprio/ler.ts`, `proprio/ler-dimensoes.ts` (já lê cobertura), e três módulos que só recebem linhas prontas. Nada em `apps/api`, em `packages/` nem em `api/pipeline/` | `grep -rl yt_own_video_daily apps/web/src apps/api/src packages/*/src` (13/10) |
| F7 | `resumo.diario` fica em `resumo->'diario'` na linha de `yt_own_collection_runs`; o passo que lançou gera a nota `diario: <causa>` (sem acento); só o corte do executor antes de o passo começar devolve resumo sem `apagadas` (`{gravados, tentativas, pendentes, sem_tempo}`). (emenda 1: D-I-1, S-I-1) Sem tempo **dentro** do passo, canal sem autorização e API sem dias devolvem `apagadas: 0` | `route.ts:589-604`; `index.ts:123-125, 268-271`; `types.ts:53-57` |
| F8 | A versão da métrica por dia: antes de 31/03/2025, `views_ate_2025-03-30`; antes de 27/08/2026, `views_2025-03-31_a_2026-08-26`; depois, `views_desde_2026-08-27` | `apps/web/src/lib/youtube/coleta/metric-version.ts:8-12` |
| F9 | A máquina do dono tem `psql` (`/opt/homebrew/bin/psql`); a pasta `~/Workspace/arquivo-observatorio` não existe | `which psql`; `ls -d` (13/10, nesta máquina) |
| F10 | O teste do item 231 (lista fechada do que apaga) não existe no código; é da E10 | fatos da etapa, seção 1; `grep` em `apps/web/test` |
| F11 | O runbook manda escrever em produção pelo SQL Editor do painel e ler por `npx supabase db query --linked`; a seção 11 dele (apagar a série de um canal) não cita a cobertura nem o backup | `docs/ops/youtube-coleta-canais-proprios-runbook.md:12, 632-650` |
| F12 | O `bythiago_int` tem a MG14 e a MG5 aplicadas de forma persistente e o diário vazio | ledger `.superpowers/sdd/a5-e6-e8/progress.md`, linha da Tarefa 1a |

### 3.2 Conferências pendentes (só produção responde; o controlador roda; `:site` = o uuid do site)

Todas com `npx supabase db query --linked "<select>"`. As que não dependem da MG14 podem rodar **já**; as outras, depois dela.

**CP1 (já): os números do dia.**
```sql
select count(*) as t, count(*) filter (where coalesce(views,0)<>0 or coalesce(engaged_views,0)<>0 or coalesce(watch_time_minutes,0)<>0 or coalesce(likes,0)<>0 or coalesce(comments,0)<>0 or coalesce(shares,0)<>0 or coalesce(subscribers_gained,0)<>0 or coalesce(subscribers_lost,0)<>0 or coalesce(card_impressions,0)<>0) as a, count(*) filter (where views is null) as views_nulo, coalesce(sum(views),0) as s, count(distinct youtube_video_id) as videos, count(distinct site_id) as sites, min(day_pt), max(day_pt), pg_total_relation_size('public.yt_own_video_daily') as bytes from public.yt_own_video_daily;
```
Esperado: `t` perto de 96.892 mais 35 por dia desde 12/10; `sites` = 1. **Muda o quê:** `sites` maior que 1 não muda o SQL (a migration percorre os sites), mas a A1 e as V passam a rodar uma vez por site.

**CP1b (já): a forma do diário.**
```sql
select string_agg(a.attname, ',' order by a.attnum) from pg_attribute a where a.attrelid = 'public.yt_own_video_daily'::regclass and a.attnum > 0 and not a.attisdropped;
```
Esperado: a lista de 20 nomes do Apêndice A, seção 0. **Muda o quê:** qualquer diferença corrige a lista do Apêndice A e as listas de colunas dos Apêndices B e C.

**CP2 (já): linha vazia com média ou taxa preenchida, e o estado das estendidas.**
```sql
select count(*) as vazias, count(*) filter (where avg_view_duration_seconds is not null or avg_view_percentage is not null or card_click_rate is not null) as a_com_media, count(*) filter (where coalesce(avg_view_duration_seconds,0) <> 0 or coalesce(avg_view_percentage,0) <> 0 or coalesce(card_click_rate,0) <> 0) as com_media_diferente_de_zero, count(*) filter (where engaged_views is null and card_impressions is not null) as so_cartao, count(*) filter (where engaged_views is not null and card_impressions is null) as so_engajadas, count(*) filter (where engaged_views is null and card_impressions is null) as sem_estendidas from public.yt_own_video_daily where views = 0 and coalesce(engaged_views,0)=0 and coalesce(watch_time_minutes,0)=0 and coalesce(likes,0)=0 and coalesce(comments,0)=0 and coalesce(shares,0)=0 and coalesce(subscribers_gained,0)=0 and coalesce(subscribers_lost,0)=0 and coalesce(card_impressions,0)=0;
```
Esperado: `a_com_media` = 0 (o spec afirma em D8; o registro da conferência não está nos arquivos lidos). **Muda o quê:** `a_com_media` maior que 0 com `com_media_diferente_de_zero` = 0 quer dizer que as linhas antigas trazem média 0 em dia sem view: a migration, no texto padrão, **não apagaria quase nada** (as linhas ficam por causa da regra 2). Nesse caso a pergunta 3 vai ao dono com os números; o padrão continua "ficam" e a etapa termina sem ganho de espaço, dito no ledger; se ele responder "apaga", entra a variante Z da regra 2 (seção 4.2 e Apêndice A), já testada. **(emenda 1: D-I-2) Esta conferência roda antes da Tarefa 1** (seção 9, "Ondas"). `com_media_diferente_de_zero` maior que 0: essas linhas ficam nos dois textos, contadas. `so_cartao` maior que 0: a regra 4 exige cobertura `estendidas` para essas linhas, e a carga da MG14 só cobre `engaged_views` não nulo; elas ficam, contadas.

**CP3 (depois da MG14): linha fora da cobertura `base`.**
```sql
select count(*) from public.yt_own_video_daily d where d.views is not null and not exists (select 1 from public.yt_own_video_coverage c where c.site_id = d.site_id and c.youtube_video_id = d.youtube_video_id and c.metric_set = 'base' and d.day_pt between c.covered_from and c.covered_to);
```
Esperado 0 depois da primeira execução de P2. **Muda o quê:** maior que 0, a migration recusa (G4). (emenda 1: S-M-5) A cobertura casa também pelo site, como na função: sem isso, cobertura gravada em outro site daria 0 aqui e recusa na migration.

**CP4 (depois da MG14): buraco e atraso.**
```sql
select (select count(*) from (select youtube_video_id from public.yt_own_video_coverage where site_id = :site and metric_set = 'base' group by 1 having count(*) > 1) x) as com_buraco, count(*) as videos, count(*) filter (where not exists (select 1 from public.yt_own_video_coverage c where c.site_id = v.site_id and c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base' and c.covered_to >= current_date - 4)) as atrasados from public.youtube_videos v where v.site_id = :site;
```
Esperado `0, 35, 0`. (emenda 1: D-M-9) **Qual é a regra do "em dia":** esta conferência usa a K5 do plano irmão, `current_date − 4`, e pede **todos** os vídeos em dia; a guarda (4) da migration usa `hoje em UTC − 5` e pede **algum** vídeo. A migration é de propósito um dia mais folgada: uma virada de dia UTC entre o portão e o `db push` nunca transforma portão verde em recusa. O portão é o mais estreito dos dois; a guarda da migration só pega cobertura parada. Com a emenda 1 a guarda (4) pede também gravação recente (`collected_at`), ver Apêndice A. **Muda o quê:** `videos` 0 = site errado (nada foi avaliado, não é "nada atrasado"). `atrasados` igual a `videos`: a migration recusa (nenhum vídeo em dia).

**CP5 (depois de três dias de P2): as três execuções limpas, pela regra da migration.** (emenda 1: D-I-1, S-I-1: a expressão de `limpa` é a do passo (3) do Apêndice A, letra por letra.)
```sql
with por_dia as (select distinct on ((r.ran_at at time zone 'utc')::date) (r.ran_at at time zone 'utc')::date as dia, r.ran_at, r.falhas, j.d as diario, (coalesce(jsonb_typeof(j.d->'apagadas') = 'number', false) and coalesce(j.d->'pendentes' = '0'::jsonb, false) and coalesce(j.d->'atrasados_antigos' = '0'::jsonb, false) and coalesce(j.d->'estendidas_recusadas' = '0'::jsonb, false) and coalesce(case when jsonb_typeof(j.d->'intervalos') = 'number' then (j.d->>'intervalos')::numeric >= 1 end, false) and coalesce(case when jsonb_typeof(j.d->'tentativas'->'ok') = 'number' then (j.d->'tentativas'->>'ok')::numeric >= 1 end, false) and not coalesce(j.d->'tentativas' ?| array['sem_autorizacao','sem_conexao','nao_alcancado_orcamento','erro_http','schema_ausente'], true) and not exists (select 1 from unnest(r.falhas) f where f like 'diário:%' or f like 'diario:%' or f like '%yt_own_video_coverage%' or f like '%yt_own_daily_apply%' or f like '%cobertura%' or f like '%youtube_videos%')) as limpa from public.yt_own_collection_runs r cross join lateral (select r.resumo->'diario' as d) j where r.ran_at > now() - interval '10 days' order by (r.ran_at at time zone 'utc')::date desc, r.ran_at desc) select dia, ran_at, limpa, diario, falhas from por_dia order by dia desc limit 3;
```
Esperado: três linhas, dias seguidos, `limpa` verdadeiro nas três, a primeira com `ran_at` de menos de 36 horas. **Muda o quê:** se `diario` vier com outra forma (sem `apagadas`, ou em outro caminho), o Apêndice A é corrigido e a Tarefa 1 roda de novo antes de qualquer coisa. Uma das três linhas, **sem os nomes de canal nas notas**, vira a fixture real da Tarefa 6.

**Conferência pendente dentro da CP5 (emenda 1: S-I-1), respondida pela primeira execução real de P2:** a coluna `diario` de uma execução normal traz `intervalos` maior ou igual a 1, `tentativas.ok` maior ou igual a 1, `pendentes` 0, `atrasados_antigos` 0 e nenhuma das cinco chaves de falha em `tentativas`? **Muda o quê:** (a) se uma execução normal trouxer `intervalos` 0 (a API não devolveu dia nenhum para vídeo nenhum), a exigência de `intervalos` sai do Apêndice A e da CP5 e fica só a de `collected_at` recente da guarda (4), com a Tarefa 1 rodada de novo; (b) se uma execução normal trouxer `atrasados_antigos` maior que 0 ou `erro_http` (um vídeo que falha todo dia, por exemplo um vídeo tornado privado), a regra **não é afrouxada sozinha**: o portão fica vermelho, o vídeo é explicado no ledger e a decisão (consertar o vídeo, ou emendar a regra com novo parecer) vai ao controlador. Recusar é o lado seguro; aceitar seria dar por limpa uma execução com falha.

**CP6 (depois de P2): nenhuma linha vazia nova.** A K3 do plano irmão, com `:d` = `E6_P2_DEPLOY`. Esperado 0.

**CP7 (já): as linhas que têm de ficar.**
```sql
select count(*) filter (where views = 0 and (coalesce(likes,0)<>0 or coalesce(comments,0)<>0 or coalesce(shares,0)<>0 or coalesce(subscribers_gained,0)<>0 or coalesce(subscribers_lost,0)<>0 or coalesce(watch_time_minutes,0)<>0 or coalesce(engaged_views,0)<>0 or coalesce(card_impressions,0)<>0)) as views0_com_atividade, count(*) filter (where least(coalesce(views,0), coalesce(engaged_views,0), coalesce(likes,0), coalesce(comments,0), coalesce(shares,0), coalesce(subscribers_gained,0), coalesce(subscribers_lost,0), coalesce(card_impressions,0), coalesce(watch_time_minutes,0)) < 0) as com_negativo from public.yt_own_video_daily;
```
Esperado em 12/10: 22 e 14. Tem de dar o mesmo antes e depois da P3 (entra na V3).

**CP8 (já): tamanhos.**
```sql
select pg_database_size(current_database()) as banco, pg_total_relation_size('public.yt_own_video_daily') as diario, pg_relation_size('public.yt_own_video_daily') as heap, pg_indexes_size('public.yt_own_video_daily') as indices, (select n_dead_tup from pg_stat_user_tables where relname = 'yt_own_video_daily') as mortas;
```
**Muda o quê:** `banco` acima de 400 MB no dia da P3 pede o `vacuum full` no mesmo minuto (o backup acrescenta até 23 MB, estimativa do spec).

**CP9 (já, e de novo no portão): o que no banco cita o diário.**
```sql
select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc ilike '%yt_own_video_daily%' union all select 'visão: ' || viewname from pg_views where definition ilike '%yt_own_video_daily%' union all select 'gatilho: ' || tgname from pg_trigger where tgrelid = 'public.yt_own_video_daily'::regclass and not tgisinternal order by 1;
```
Esperado hoje: só `youtube_channel_removal_impact`. No portão: mais `yt_own_daily_apply`, as da MG5 e as da MG7, se o lote C já entrou. **Muda o quê:** nome fora da lista é lido antes; gatilho no diário muda o custo do `delete`.

**CP10 (já): o limite de tempo de instrução de quem aplica a migration, e como o `vacuum full` roda.**
```sql
select rolname, rolconfig from pg_roles where rolname in ('postgres', 'authenticator', 'service_role');
```
**Muda o quê:** o Apêndice A já define `statement_timeout` de 120 s na sessão, então o valor do papel não decide; a consulta fica no ledger para o caso de a migration bater no limite. **Não medido, e sem consulta que responda:** se o `vacuum full` é aceito pela conexão "Session pooler" e pelo SQL Editor do painel. O padrão é `psql` pela "Session pooler"; se ela recusar, o dono roda a mesma linha no SQL Editor; se os dois recusarem, pela conexão direta. O plano não depende de qual.

**CP11 (dono, no dia): a URL de conexão.** O dono copia do painel (Connect, "Session pooler"). O host exato não está em arquivo nenhum do repositório.

**CP12 (já; emenda 1: S-I-2): o comentário atual da tabela do diário.**
```sql
select obj_description('public.yt_own_video_daily'::regclass, 'pg_class');
```
Esperado: nulo (nenhuma migration versionada nem SQL de ensaio comenta a tabela: `grep -rn "comment on table public.yt_own_video_daily" supabase/migrations .superpowers/sdd/a5-e6-e8/sql .superpowers/sdd/a5-e11/sql` não acha nada). **Muda o quê:** se vier texto, a linha 7 do Apêndice D passa a gravar o texto antigo seguido da marca (a função procura a marca dentro do comentário, não o comentário inteiro), e a linha de limpeza do fim do Apêndice D devolve o texto antigo em vez de nulo.

**CP13 (já; emenda 1: D-M-2): linha do diário de vídeo que saiu do cadastro.**
```sql
select count(distinct d.youtube_video_id) as videos_fora_do_cadastro, count(*) as linhas from public.yt_own_video_daily d where not exists (select 1 from public.youtube_videos v where v.youtube_video_id = d.youtube_video_id);
```
Esperado `0, 0`. **Muda o quê:** a migration apaga pela linha do diário e pela cobertura, sem olhar `youtube_videos`; a V5 percorre `youtube_videos`. Maior que 0, a V5 passa a partir da lista de ids do próprio dado (a forma alternativa está escrita ao lado da V5, seção 11), senão linhas sairiam sem entrar no retrato.

**CP14 (já; emenda 1: S-M-8): a hora real em que o cron grava.**
```sql
select count(*) as execucoes, min((ran_at at time zone 'utc')::time) as mais_cedo, max((ran_at at time zone 'utc')::time) as mais_tarde from public.yt_own_collection_runs where ran_at > now() - interval '30 days';
```
Esperado: tudo entre 12:00 e 12:10 UTC (cron às 12:00, função de até 300 s). **Muda o quê:** `execucoes` 0 = nada foi avaliado, não é "pontual". `mais_tarde` depois de 12:55 UTC, ou `mais_cedo` antes de 11:35: a janela proibida do Apêndice A (11:30 a 13:00) é alargada até cobrir o horário visto com 30 minutos de folga, no SQL, na seção 2, na seção 6 e no teste `janela do cron`. A trava `share row exclusive` já garante a correção em qualquer horário; a janela existe para o cron não tomar erro de espera.

---

## 4. Desenho

### 4.1 A migration se prova sozinha

O ritual do spec (CSV, contagens, migration, contagens) deixa espaço para erro humano entre os passos (risco 8 do spec). A MG15 traz as contas **dentro dela**: três funções auxiliares criadas, usadas e apagadas no mesmo arquivo, e **uma instrução só** (um bloco `do`) que apaga. Uma instrução é atômica em qualquer forma de aplicação: ou tudo, ou nada.

- `yt_own_daily_linha_vazia(d)`: o critério "vazia", escrito **uma vez**.
- `yt_own_daily_diet_p3_contas(p_site)`: as contas do site (linhas, com atividade, vazias, dentro da cobertura, as nove somas, a soma da cobertura). Só lê. Roda antes e depois.
- `yt_own_daily_diet_p3(p_site, p_agora)`: as guardas (hora, marca do dia posta pelo dono no passo do CSV, três execuções limpas, cobertura em dia e gravada há pouco; emenda 1: S-I-2, D-I-1, S-I-1), a trava, o apagamento com cópia, as contas de novo e a comparação. Devolve um objeto com tudo. `p_agora` existe para o teste poder escolher a hora e o dia; a migration passa `now()`.

Nenhuma das três tem `execute` para `anon`, `authenticated` ou `service_role`, e nenhuma sobra depois da migration (V1).

### 4.2 Quando uma linha sai: "apagar não muda nenhuma leitura"

A linha de (vídeo V, dia D) sai se, e só se, valem as quatro:

1. **Vazia:** `views = 0` (medido; nulo não é zero) e as outras oito contagens zero ou nulas. É o critério de `yt_own_daily_apply` (`mg14.sql:201-206`), letra por letra.
2. **Sem média e sem taxa:** `avg_view_duration_seconds`, `avg_view_percentage` e `card_click_rate` nulos. O leitor mostra essas colunas; um dia sem linha as lê como nulas. Linha com qualquer uma preenchida **fica** e é contada (`ficaram_com_media`). **Variante Z (emenda 1: D-I-2), só se o dono responder "apaga" à pergunta 3:** a regra passa a ser "média e taxa nulas **ou iguais a zero**"; linha vazia com média ou taxa **diferente de zero** continua ficando, contada no mesmo campo. Motivo de a variante ser aceitável: é o que `yt_own_daily_apply` já faz na janela dos últimos dias (`mg14.sql:201-206` não olha as médias) e o que o coletor define desde 10/10 (média de dia sem view é nula: `analytics-diario.ts:140-144`). O que ela muda na leitura está dito na pergunta 3 e é conferido pelo retrato V5m (seção 11). O texto das duas formas é um trecho marcado do Apêndice A; nenhuma outra linha do SQL muda.
3. **Coberta na `base`:** existe intervalo `base` do mesmo vídeo **e do mesmo site** que contém D. Sem isso o dia viraria "não medido". Linha vazia fora da `base` não fica quieta: **a função recusa tudo** (estado desconhecido da P2).
4. **Estendidas preservadas:** ou `engaged_views` e `card_impressions` são nulos (as estendidas nunca foram medidas naquele dia, e continuam "não medido"), ou existe intervalo `estendidas` que contém D. Linha que falha só aqui **fica** e é contada (`ficaram_fora_das_estendidas`).

### 4.3 As contas (o item 47, reescrito)

O spec pede cinco igualdades com `C = T` antes. Depois da P2 isso é falso (F4). As igualdades passam a ser estas seis, todas por site, com `antes` e `depois` da mesma transação e os números do dia:

| # | Igualdade | Onde é exigida |
|---|---|---|
| E1 | antes: nenhuma linha vazia fora da `base` (no lugar de `C = T`) | a função recusa; CP3 no portão |
| E2 | `t_depois = t_antes − apagadas`, e as vazias que sobraram = `vazias_antes − apagadas` (esperado 0) | a função recusa se não fechar; V3 |
| E3 | linhas com atividade e as **nove** somas (não só a de views) iguais antes e depois | idem |
| E4 | linhas gravadas no backup nesta execução = `apagadas` | idem |
| E5 | soma da cobertura `base` inalterada | idem |
| E6 | dias cobertos sem linha: `depois = antes + apagadas`; e, por vídeo, toda linha do backup é dia coberto e sem linha no diário | a função recusa na conta do site; por vídeo é a V4 |

"Recusa" quer dizer `raise exception`: a instrução inteira se desfaz, o `db push` falha com a mensagem e nada foi apagado.

### 4.4 Segurança e privacidade

- **Quem lê o backup:** ninguém pelo aplicativo. RLS ligada, **nenhuma policy**, e `revoke all` de `public`, `anon`, `authenticated` e `service_role`. Só o papel dono do banco (o SQL Editor e o `psql` do dono). Não há leitura pública, então `site_visible` não se aplica; não há leitura privada pelo aplicativo, então `can_edit_site` também não. Nada aqui confia no GUC `app.site_id`.
- **Quem lê o diário:** não muda (`yt_own_video_daily_select`, por `can_edit_site`, ou pelo direito que a MG11 instalar). A MG15 não toca policy.
- **Service client:** nenhum código novo usa. Os testes usam conexão direta ao banco local.
- **O CSV** fica numa pasta do dono fora do repositório; não vai ao Vercel Blob nem a commit. Traz ids de vídeo e contagens do próprio canal; **não traz dado pessoal**.
- **Retenção:** o backup vive até a MG16 (14 dias ou mais; conferência `e6-p3-d14`). O CSV fica com o dono sem prazo, e vai ao NAS na fase do NAS.
- **Remoção do site ou do canal nesse intervalo:** o backup não tem chave estrangeira, então não é apagado em cascata nem bloqueia. A remoção de canal continua recusada pela cobertura. Se um site for apagado antes da MG16, as linhas dele no backup ficam órfãs até a MG16: aceito, dito aqui.

---

## 5. As contas

- **Chamadas de API e cota:** zero. A etapa não chama o YouTube.
- **Linhas:** uma vez, saem cerca de 94 mil (`vazias` do dia, menos as que ficarem pelas regras 2 e 4) e entram as mesmas no backup. Por dia e por ano, a etapa não acrescenta linha nenhuma: quem decide o crescimento do diário é a P2 (só dia com atividade: hoje cerca de 2.500 linhas em 11 anos).
- **Espaço** (estimativas do spec, **não medidas**; a Tarefa 3 mede o backup em volume igual): banco de 170,7 MB (12/10) para cerca de 194 MB entre a migration e o `vacuum full` (o backup, até 23 MB; o diário continua com 72 MB porque `delete` não devolve espaço); cerca de 123 MB depois do `vacuum full`; cerca de 100 MB depois da MG16. Longe dos 500 MB em todos os momentos.
- **Tempo da migration: não medido.** São quatro varreduras do diário (97 mil linhas, com consulta à cobertura de 70 intervalos), um `delete` de 94 mil linhas e um `insert` das mesmas. A Tarefa 3 mede no `bythiago_int` com volume igual. **Limites:** `lock_timeout` 5 s para conseguir a trava; `statement_timeout` 120 s para a instrução. **Quando estoura:** a instrução se desfaz inteira, o `db push` falha, nada foi apagado; roda de novo. Se o ensaio local passar de 10 s, a tarefa para e avisa: o plano B é apagar por vídeo (35 chamadas da mesma função com um parâmetro a mais), e isso é uma emenda, não improviso.
- **Orçamentos do cron:** a etapa não acrescenta passo, critério nem ida ao banco ao cron do canal próprio (função de 300 s da Vercel, tetos de `clock.ts`). Os orçamentos acoplados da forja (20 min do claim, 25 min do cron, 30 min do vigia) não são tocados. Depois da P3 o passo do diário trabalha sobre uma tabela 40 vezes menor.
- **Testes de integração:** cada teste é uma transação desfeita, com a trava do diário segurada por menos de 2 s; o `bythiago_int` é dividido com outras etapas.

---

## 6. O que acontece quando o dado não existe, e em cada falha

Não há cron: "vermelho" aqui é **o `db push` falhar com a mensagem escrita**, na tela do dono. Nenhum e-mail é enviado por esta etapa, salvo o do cron vermelho por conferência vencida há mais de 7 dias (mecanismo que já existe em `lib/conferencias.ts`).

| Situação | O que a migration faz | Veredito e o que o dono vê |
|---|---|---|
| MG14 não aplicada (tabela de cobertura ou função ausente) | recusa na primeira instrução | vermelho: `MG15 depende da MG14: …` |
| O diário não tem as 20 colunas esperadas, nessa ordem | recusa na primeira instrução | vermelho: `MG15: o diário mudou de forma (colunas: …)` |
| Diário vazio (banco novo, CI, `db reset`) | o laço não acha site; nada é chamado; a tabela de backup nasce vazia | verde, com aviso `MG15: diário sem linhas, nada a fazer`. **Em produção isso seria estado desconhecido**: a V2 (comentário nulo) manda parar |
| Site só com linhas de atividade (rodar de novo; banco local com semente `dieta: true`) | a função devolve `nada_a_apagar` **sem exigir** as execuções | verde; em produção, na primeira aplicação, a V2 acusa |
| `yt_own_collection_runs` vazia, ou menos de três dias com execução nos últimos 10 | recusa | vermelho: `MG15 recusada: preciso de 3 execuções limpas do diário em 3 dias seguidos (achei N dias, M limpas, …)` |
| Uma das três últimas execuções é do coletor antigo (`resumo.diario` sem `apagadas`), foi cortada pelo executor antes de o passo começar (resumo sem `apagadas`), ou o passo lançou (sem a chave `diario`) | não conta como limpa: recusa | idem |
| (emenda 1: D-I-1, S-I-1) Uma das três **rodou e não coletou**: canal em "reautorizar" ou sem conexão (`tentativas.sem_autorizacao` ou `sem_conexao`), autorização negada no meio, sem tempo dentro do passo (`pendentes` maior que 0 ou `tentativas.nao_alcancado_orcamento`), a API não devolveu dia para vídeo nenhum (`intervalos` 0), nenhum canal com coleta ligada (`tentativas` vazio), falha ao ler `youtube_videos` (nota `erro de banco ao ler youtube_videos`), erro em vídeo atrasado antigo (`atrasados_antigos` maior que 0), `erro_http` ou `schema_ausente` em `tentativas`. Todas trazem `apagadas: 0` e nenhuma nota `diário:` | não conta como limpa: recusa. Ausência de coleta não é execução limpa | idem |
| (emenda 1: S-I-2) O comentário da tabela do diário não traz a marca `P3 armada em <hoje em UTC>` (o dono não fez o passo 3 hoje; o arquivo ficou de outro dia; outro lote rodou o `db push`) | recusa | vermelho: `MG15 recusada: o ritual do CSV não foi feito hoje` |
| (emenda 1: S-I-2, D-M-4) Qualquer recusa, e a nova tentativa não é no mesmo dia | nada mudou no banco; o arquivo continua pendente | **o arquivo sai do repositório** (commit que o remove) e o ritual recomeça do passo 2 no outro dia, com CSV novo. Até lá o bloqueio de `db:push:prod` continua anotado |
| Uma das três tem nota do diário ou da cobertura em `falhas` (inclusive "estendidas ausentes" e "sem cobertura até dd/mm") | recusa | idem |
| Uma das três tem nota de **outro** passo (relatórios, metadados, conferência vencida) | aceita: a falha não é da dieta | verde. É desvio declarado do "execução limpa" literal (seção 8) |
| Os três dias não são seguidos (o cron não rodou num deles) | recusa | vermelho, a mesma mensagem com os dias |
| A execução mais recente tem 36 horas ou mais (o cron parou) | recusa | idem |
| Agora é entre 11:30 e 13:00 UTC | recusa | vermelho: `MG15 recusada: entre 11:30 e 13:00 UTC o cron do canal próprio grava no diário` |
| Nenhum vídeo do site com cobertura `base` até hoje menos 5 **gravada pela função nas últimas 36 horas** (cobertura parada, credencial vencida, site sem vídeos cadastrados, ou cobertura que só a carga da MG14 gravou: emenda 1, S-I-1) | recusa | vermelho: `MG15 recusada: nenhum vídeo do site com cobertura em dia` |
| Linha vazia fora de todo intervalo `base` | apaga, conta, **e recusa**: tudo se desfaz | vermelho: `MG15 desfeita: N linha(s) vazia(s) fora da cobertura base` |
| Linha vazia com média ou taxa preenchida | fica; contada em `ficaram_com_media` | verde com nota no retorno e no comentário; a V3 mostra |
| Linha vazia com estendidas medidas em dia sem cobertura `estendidas` | fica; contada em `ficaram_fora_das_estendidas` | idem |
| Linha com `views` nulo | não é "vazia": fica | nada |
| Linha de `views` 0 com curtida, comentário, minuto, inscrito ou cartão diferente de zero (inclusive negativo) | não é "vazia": fica | nada (CP7 antes e depois) |
| As contas de depois não fecham com as de antes (qualquer das seis igualdades) | recusa: tudo se desfaz | vermelho: `MG15 desfeita: as contas não fecham`, com os dois objetos |
| A trava do diário não sai em 5 s (outra transação gravando) | erro de `lock_timeout` | vermelho do banco; roda de novo |
| A instrução passa de 120 s | erro de `statement_timeout`; tudo se desfaz | vermelho do banco; parar e avisar (seção 5) |
| Erro de banco no meio (disco, conexão) | a instrução se desfaz | vermelho do banco |
| A migration aplicada duas vezes | a tabela de backup já existe. **Se nenhuma linha vazia ficou** da primeira vez: `nada_a_apagar`, nada é exigido, o comentário antigo fica. **(emenda 1: D-M-3, S-M-7) Se alguma ficou** (regras 2 ou 4): a segunda aplicação acha linha vazia e exige de novo hora, marca do dia e três execuções; passando, não apaga nada (`nada_apagado`); não passando, recusa | verde no primeiro caso; verde ou vermelho no segundo. Em produção não há segunda aplicação (a migration fica registrada); vale para banco local e para o ensaio |
| Cron disparado à mão fora da janela, ao mesmo tempo | a gravação do cron espera a trava (segundos); se passar do limite do PostgREST, o diário daquele vídeo falha e volta no dia seguinte | nota `diário:` naquela execução. Por isso o dono não dispara o cron no dia da P3 |
| `vacuum full` recusado pela conexão, ou sem trava em 5 s | nada muda; a tabela continua com 72 MB | erro na tela do dono; item 48 aberto até rodar |
| CSV com menos linhas que `t` da A1 (tirado em outro dia, ou cortado) | a migration não sabe do CSV | o passo 4 do ritual compara e **para antes do passo 5**. Depois da migration, o conserto é exportar o diário e o backup juntos (Apêndice D, linha de reserva) |
| API do YouTube 403, 429 ou 500; lista vazia; resposta parcial | não se aplica: a etapa não chama API. O efeito indireto (o diário de ontem falhou) aparece como execução não limpa | recusa, acima |
| Leitor (depois da P3): dia coberto sem linha | `views: 0`, medido (Tarefa 5 do plano irmão) | número igual ao de antes |
| Leitor (depois da P3): tabela de cobertura ilegível | segue sem cobertura e avisa o Sentry (plano irmão): os zeros apagados leem "não medido" | **é o pior caso depois da P3**: antes dela esse erro não mudava a tela. Risco 6 |
| Volta A com um vídeo que saiu de `youtube_videos` desde então | a linha volta com `video_id` nulo (a chave é `set null`) | nada |
| Volta A num dia que ganhou atividade depois | a linha nova fica; a do backup não entra por cima | nada |

---

## 7. Simulação do dia e dos seguintes

Suposições: lote C aplicado; lote E6-P2 em `main` há três dias ou mais; portão verde; D = o dia da P3, às 15:00 de Brasília (18:00 UTC).

- **D, 17:30 UTC.** O dono tira o CSV: cerca de 96.900 linhas mais o cabeçalho, e põe a marca do dia no diário (emenda 1: S-I-2). O controlador roda A1 (por exemplo `t` 96.650, `a` 2.460, `vazias` 94.190) e o retrato V5 "antes", e carrega o CSV numa tabela temporária do banco local (R1): mesmas `t` e soma de views.
- **D, 18:00 UTC.** `db:push:prod`. A migration cria o backup e as três funções; para o único site: acha vazias, a hora está fora da janela, as três últimas execuções (D, D − 1, D − 2, todas das 12:00 UTC) estão limpas e a última tem 6 horas; 35 de 35 vídeos em dia; trava; contas de antes; apaga 94.190 e grava 94.190 no backup; contas de depois: `t` 2.460, as nove somas iguais; anota o comentário; apaga as três funções; `analyze`.
- **D, 18:05 UTC.** V1 a V6. O retrato "depois" tem o mesmo md5.
- **D, 18:10 UTC.** `vacuum full`. V7: menos de 2 MB.
- **D, 18:30 UTC.** Tarefa 7: data em `E6_P3_APLICADA`, push, CI, promoção.
- **D + 1, 12:00 UTC.** O cron roda como nos dias anteriores: o coletor novo pede de hoje menos 10 em diante, não cria linha vazia, estende a cobertura. Conferência `e6-p3-d1`.
- **Se o dono rodar às 09:10 de Brasília (12:10 UTC):** recusa pela janela; nada muda; ele roda de novo depois das 10:00.
- **Se o cron de D falhou no diário** (cota, credencial): a execução de D não é limpa; recusa. Espera-se D + 1, D + 2, D + 3 limpas. O arquivo sai do repositório até lá (emenda 1: S-I-2).
- **(emenda 1: D-I-1, S-I-1) Se a credencial do canal foi revogada em D − 2:** as execuções de D − 2, D − 1 e D trazem `{gravados: 0, apagadas: 0, intervalos: 0, tentativas: {sem_autorizacao: 1}, pendentes: 0}` e nenhuma nota `diário:` em `falhas`. Na versão anterior deste plano as três contavam como limpas e a migration apagava sem a P2 ter gravado uma vez. Agora nenhuma conta (`tentativas.sem_autorizacao`, `intervalos` 0, `tentativas.ok` ausente) e a guarda (4) também recusa (nenhuma cobertura gravada nas últimas 36 horas).
- **(emenda 1: S-I-2) Se a migration recusou em D e, em D + 2, outro lote roda `db:push:prod` com o arquivo ainda lá** (as regras 1 e 2 da seção 2 falharam): a MG15 é aplicada primeiro, as execuções agora estão limpas, e a função recusa pela marca (a do diário é de D). O envio do outro lote falha com a mensagem da MG15; nada foi apagado.
- **Se o lote E6-P2 foi revertido em D − 1:** a execução de D é do coletor antigo (sem `apagadas`): recusa. E o coletor antigo já regravou zeros: CP6 deixa de dar 0.
- **Se um vídeo foi cadastrado em D − 1:** ainda não tem cobertura nem linha vazia; não muda nada (a guarda pede "algum vídeo em dia", não todos).
- **Se a migration falhar no meio:** o `db push` mostra a mensagem; a tabela de backup pode existir vazia (inofensiva; a próxima aplicação a reaproveita) e, se o cliente não aplicar o arquivo numa transação só, as três funções podem ter ficado: a próxima aplicação as recria e apaga. A V1 (`funcao_saiu`) diz.
- **D + 14.** `e6-p3-d14`: a MG16 pode ser planejada.

**Conferências com data** (entram em `lib/conferencias.ts` na Tarefa 4, no molde de E1 e E2; constante `E6_P3_APLICADA: string | null`, dia de São Paulo em que o dono aplicou a MG15; sem a data não há entradas):

| id | Quando | O que, e o valor esperado |
|---|---|---|
| `e6-p3-d0` | D | V1 a V7 anotadas no ledger; as seis igualdades com os números do dia (item 47); diário menor que 2 MB (item 48); retrato igual; CSV com `sha256` e a prova R1 |
| `e6-p3-d1` | D + 1, depois das 12:30 UTC | a execução do cron: `resumo.diario` com `apagadas` e sem nota do diário; CP6 = 0; `t` = `t_depois` de D mais as linhas com atividade novas (nunca dezenas de milhares); V6; o dono abre a página do canal próprio e não vê "não medido" onde havia zero |
| `e6-p3-d7` | D + 7 | CP8: diário ainda menor que 2 MB e o banco menor; V6; CP4 `atrasados` 0; nenhuma restauração foi necessária |
| `e6-p3-d14` | D + 14 | o CSV confere com o `sha256`; decidir a MG16 (P4): a etapa dela pode ser planejada. Enquanto não for, o backup ocupa o espaço dele |

---

## 8. Desvios do texto do spec, com o motivo

1. **`C = T` não é exigido antes.** Depois da P2 é falso (F4; recado do desvio 13 do plano irmão). No lugar: nenhuma linha vazia fora da `base`, e `dias cobertos sem linha: depois = antes + apagadas`.
2. **"Linhas no backup = Z" vira "linhas gravadas no backup nesta execução = apagadas".** `Z` do spec (todas as sem atividade) já foi reduzido pela P2 antes da P3, e algumas vazias podem ficar (regras 2 e 4).
3. **A igualdade por vídeo** ("dias cobertos sem linha = linhas dele no backup") vira "toda linha do backup é dia coberto e sem linha" (V4), porque a P2 já tinha deixado dias cobertos sem linha.
4. **O backup não é `create table as select`.** É `create table if not exists (like …)` mais um índice único, e o apagamento grava no backup **as mesmas linhas que apagou** (`delete … returning` para `insert`), numa instrução. `create table if not exists … as` aplicado pela segunda vez não copiaria nada e o `delete` seguinte apagaria sem cópia.
5. **O critério é mais estreito que "sem atividade e cobertas":** `views = 0` medido (linha com `views` nulo fica), média e taxa nulas, e a condição das estendidas (seção 4.2). O spec afirma que as três colunas de média e taxa estão vazias nessas linhas; a migration não confia na afirmação.
6. **A migration traz guardas que o spec deixava ao ritual:** hora, três execuções, cobertura em dia, forma da tabela, contas. E anota o resultado no comentário da tabela de backup.
7. **"Execução limpa" é limpa para o diário e para a cobertura**, não "sem nenhuma falha no cron". Uma nota do passo de relatórios não tem relação com a dieta e não deve segurar a P3 por semanas.
8. **`revoke` também de `service_role`** (o spec pede `anon` e `authenticated`). Nenhum código lê o backup.
9. **Restaurar não é `insert … select * … on conflict do nothing` cru:** lista as colunas e anula `video_id` de vídeo que não existe mais (senão a chave estrangeira derruba a restauração inteira).
10. **O plano de volta do spec ("o comando da tabela mais reverter o código de P2") está superado:** depois da P3 não se reverte o leitor (plano irmão, Tarefa 15) e este plano acrescenta que também não se reverte o coletor sem aceitar que a tabela engorde de novo. As voltas são as três da seção 2.
11. **As cinco igualdades são seis** e a de soma vale para as nove contagens, não só `views`.
12. **(emenda 1: D-I-1, S-I-1) "Execução limpa" exige prova de que o diário coletou**, não só ausência de nota: `pendentes` 0, `intervalos` e `tentativas.ok` maiores ou iguais a 1, nenhuma tentativa de falha, `atrasados_antigos` e `estendidas_recusadas` 0; e a guarda de cobertura pede gravação nas últimas 36 horas. O spec diz só "3 execuções limpas"; no código, uma execução sem coleta nenhuma não deixa nota.
13. **(emenda 1: S-I-2) A migration exige uma marca posta pelo dono no dia** (comentário da tabela do diário). O spec deixa "sozinha, com o dono" ao processo; o arquivo pendente entra no `db push` de qualquer lote.
14. **(emenda 1: D-I-2) A regra 2 tem duas formas escritas e testadas** (padrão e variante Z), e quem escolhe é o dono, sobre os números da CP2.

---

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`, salvo os que começam por `docs/`, `supabase/` ou `.superpowers/`. A lista de cada tarefa é fechada: se precisar de outro arquivo, para e avisa.

| T | O que | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 0 | Conferências de leitura (CP1 a CP10, CP12 a CP14) e o portão | só `.superpowers/sdd/a5-e6-p3/progress.md` | CP1, CP1b, CP2, CP7 a CP10, CP12 a CP14: nada. CP3 a CP6: MG14 e P2 em produção | todas, **salvo a Tarefa 1, que espera a CP2 e a resposta à pergunta 3** (emenda 1: D-I-2) |
| 1 | SQL de ensaio da MG15 e o teste contra o banco | `.superpowers/sdd/a5-e6-p3/sql/mg15.sql` (novo, fora do git); `test/integration/a5-e6-p3-dieta.test.ts` (novo) | MG14 no `bythiago_int` (está: F12); **a CP2 da Tarefa 0 respondida** (emenda 1: D-I-2) | 4, 5 |
| 2 | Os dois roteiros de volta e o teste deles | `docs/ops/sql/dieta-diario-volta-a-restaurar-do-backup.sql` (novo); `docs/ops/sql/dieta-diario-volta-b-recriar-da-cobertura.sql` (novo); `test/integration/a5-e6-p3-volta.test.ts` (novo) | 1 | 4, 5 |
| 3 | Ensaio em volume de produção e a migration inteira, por `psql`, duas vezes | `.superpowers/sdd/a5-e6-p3/sql/prova.sql`, `prova-volume.sql`, `prova-saida.txt` (novos, fora do git); o ledger | 1, 2 | 4, 5 |
| 4 | Conferências com data | `src/lib/conferencias.ts`; `test/lib/conferencias.test.ts`; `.superpowers/sdd/a5/conferencias-com-data.md` | nada | 1, 2, 3, 5; **fila com as outras etapas** no mesmo arquivo |
| 5 | Runbook | `docs/ops/youtube-coleta-canais-proprios-runbook.md` | 2 (cita os dois roteiros) | 1, 3, 4; **fila com E6-P2, E8, E11, E20** |
| 6 | O arquivo da migration, **só com o portão verde** | `supabase/migrations/<carimbo>_observatorio_a5_e6_p3_apagar_linhas_vazias.sql` (novo, por `db:new`); `test/youtube/coleta/fixtures/e6-p3-execucao-real.json` (novo); `test/integration/a5-e6-p3-dieta.test.ts` (um teste a mais); o teste do item 231, **se existir** | 0 a 5; G1 a G12 | nenhuma |
| 7 | O dia: ritual, conferências, envio | `src/lib/conferencias.ts` (só o valor de `E6_P3_APLICADA`); `.superpowers/sdd/a5/conferencias-com-data.md`; o ledger; `.superpowers/sdd/a5/retratos/e6-p3-antes.json` e `e6-p3-depois.json` | 6; o dono | nenhuma |

**Ondas.** (emenda 1: D-I-2) Já, em paralelo: 0 (a parte que não depende da MG14) e 4. **Assim que a CP2 voltar** (e, se `a_com_media` for maior que 0, a pergunta 3 tiver ido ao dono com os números): 1. A Tarefa 1 testa as duas formas da regra 2, então não espera a resposta do dono, só a CP2 (que diz se há um terceiro caso, média diferente de zero, e quanto pesa cada um). Em seguida: 2 e 5. Depois: 3. Só com o portão verde: 6. Por último: 7.

**Ordem de envio (emenda 1: S-M-1), regra dura.** Os commits das Tarefas 1 e 2 **nunca** entram numa lista de push antes do arquivo da Tarefa 6. O teste `a5-e6-p3-dieta.test.ts` lê o SQL do ensaio (fora do git) e cai para o arquivo de migration; o job `test-db-integration` da CI (`.github/workflows/ci.yml:110-142`) roda a pasta `integration/` com `HAS_LOCAL_DB=1`, e num checkout sem nenhum dos dois o teste lança "nem o arquivo de ensaio nem a migration existem" e a CI fica vermelha. Como o arquivo da Tarefa 6 só vai a push depois de aplicado (Tarefa 7), os testes das Tarefas 1 e 2 também só vão na Tarefa 7.

**Arquivos compartilhados com outras etapas.**

| Arquivo | Quem mais mexe | Regra |
|---|---|---|
| `src/lib/conferencias.ts`, `test/lib/conferencias.test.ts`, `.superpowers/sdd/a5/conferencias-com-data.md` | todas | um bloco por etapa. **Dona nesta etapa: a Tarefa 4**; a Tarefa 7 só troca o valor da constante. Uma etapa por vez, na ordem do controlador |
| `docs/ops/youtube-coleta-canais-proprios-runbook.md` | E6-P2 (seções 1, 4, 6, 12), E8, E11, E20 | **só a Tarefa 5**: seção nova no fim, e duas linhas na seção 11 |
| `test/integration/a5-e6-p3-dieta.test.ts` | ninguém de fora | Tarefa 1 cria; Tarefa 6 acrescenta um teste (em série) |
| o teste do item 231 (E10) | E10, E20 | se existir no dia da Tarefa 6, ela acrescenta o par; se não, fica na dívida com o par escrito |
| `proprio/ler.ts`, `coleta/index.ts`, `coleta/diario-step.ts`, `coleta/cobertura.ts`, `e2e/fixtures/observatorio-seed.ts`, `types/database.types.ts`, `.superpowers/sdd/a5-e6-e8/**` | A4, E6-P2, E8, E11, E18 | **este plano não toca** |

**Restrições globais.** TypeScript estrito, sem `any`, nenhum `as unknown as` novo. Arquivos em kebab-case. Mensagem que o dono lê em português. Testes de servidor com `// @vitest-environment node`. Datas de teste passadas e fixas ou relativas a hoje; nada no futuro. Testes de integração gated em `HAS_LOCAL_DB`, só contra o `bythiago_int` (`HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run <arquivo> --no-file-parallelism`); nunca `db:reset`; nunca o banco 54321/54322; nenhuma função chamada como `anon` ou `authenticated` (privilégio se confere por catálogo). Cada teste cria o **seu** site e o **seu** canal; diário, cobertura, vídeos, execuções, a tabela de backup e as três funções vivem **só dentro de `begin; … rollback;`** (a tabela `yt_own_collection_runs` não tem site: por isso os testes usam um `p_agora` fixo no passado, `2026-03-10T15:00:00Z`, e execuções com `ran_at` em torno dele, longe de qualquer linha de outro teste; e, **dentro da transação, antes de semear**, cada teste apaga as execuções da faixa que a função lê, `delete from public.yt_own_collection_runs where ran_at > <p_agora> - interval '10 days' and ran_at <= <p_agora>`, desfeito no `rollback`: emenda 1, D-M-7 e S-M-4). Commit local por caminho explícito, sem push, sem `--no-verify`. Nenhum comando ou espera acima de 4 minutos.

**Foco de revisão** (o que os dois especialistas devem atacar primeiro): (1) a instrução única de apagar e copiar, e se ela é mesmo atômica; (2) as quatro regras do critério e a recusa por linha fora da `base`; (3) a regra das três execuções limpas contra o formato real de `resumo` e de `falhas`; (4) as contas de antes e depois; (5) a volta A com chave estrangeira; (6) a volta B contra a cobertura com buraco; (7) o que falha em verde: diário vazio e `nada_a_apagar`.

---

## 10. As tarefas

### Tarefa 0: conferências de leitura e o portão

**Objetivo.** Trocar por medida o que este plano marca "não medido", e fechar G1 a G12.
**Como.** O controlador roda CP1, CP1b, CP2, CP7, CP8, CP9, CP10, CP12, CP13 e CP14 **já** (não dependem de nada) e anota no ledger; **a CP2 primeiro, porque a Tarefa 1 espera por ela** (emenda 1: D-I-2). CP3 a CP6 quando a MG14 e a P2 estiverem em produção. O agente desta etapa não roda nada com `--linked`.
**Decide.** CP1b e CP2 podem emendar o Apêndice A antes da Tarefa 1; CP5 pode emendar a regra das execuções.
**Pronto quando:** o ledger tem a resposta de cada CP com data (CP1 a CP10 e CP12 a CP14; a CP11 é do dono, no dia) e, no dia, a tabela G1 a G12 preenchida.

### Tarefa 1: SQL de ensaio da MG15 e o teste contra o banco

**Objetivo.** O texto do Apêndice A rodando no `bythiago_int`, provado caso a caso.
**Arquivos.** `.superpowers/sdd/a5-e6-p3/sql/mg15.sql`; `test/integration/a5-e6-p3-dieta.test.ts`.
**Passos, nesta ordem (teste antes do SQL).**
1. Escrever o teste. `lerSql()` lê o arquivo de ensaio e cai para o arquivo de migration cujo nome contém `observatorio_a5_e6_p3_apagar_linhas_vazias` (molde: `test/integration/a5-e6-e8-schema.test.ts:46-56`). O teste extrai dois trechos pelas marcas `-- >>> MG15 backup (início)` / `(fim)` e `-- >>> MG15 funções (início)` / `(fim)`, e **nunca executa o trecho final** (o bloco `do` que chama com `now()` e os `drop`). Rodar: falha com "nem o arquivo de ensaio nem a migration existem". Guardar a saída vermelha no relatório.
2. Escrever `mg15.sql` = o Apêndice A, com as marcas. Rodar até verde.
3. Provas por mutação (lista abaixo): cada uma aplicada à mão no arquivo de ensaio, teste rodado, mutação desfeita; a tabela "mutação, teste que morreu" vai ao relatório.
**Contrato.**

| Função | Assinatura | Devolve |
|---|---|---|
| `yt_own_daily_linha_vazia` | `(d public.yt_own_video_daily) returns boolean`, nunca nulo | verdadeiro só com `views = 0` medido e as outras oito contagens zero ou nulas |
| `yt_own_daily_diet_p3_contas` | `(p_site uuid) returns jsonb` | `{t, a, vazias, dentro_da_base, somas: {views, engaged_views, watch_time_minutes, likes, comments, shares, subscribers_gained, subscribers_lost, card_impressions}, c_base}` |
| `yt_own_daily_diet_p3` | `(p_site uuid, p_agora timestamptz) returns jsonb`; lança com parâmetro nulo | sem linha vazia: `{site, estado: 'nada_a_apagar', apagadas: 0, linhas}`. Senão: `{site, estado: 'apagado' ou 'nada_apagado', agora, ultima_execucao, videos, videos_em_dia, vazias, apagadas, ficaram_com_media, ficaram_fora_das_estendidas, antes, depois}` |

**Testes** (cada um: `begin`, cria backup e funções pelos dois trechos, semeia, chama, afirma, `rollback`). "Execuções boas" = três linhas em `yt_own_collection_runs`, uma por dia nos três dias até `p_agora`, a última 3 horas antes, `falhas` vazio e `resumo.diario` montado a partir de um literal **tipado como `DiarioResumo`** (se o tipo mudar, o teste deixa de compilar). (emenda 1: D-I-1, S-I-1) O literal da execução boa é `{gravados: 12, tentativas: {ok: 36}, pendentes: 0, ate, estendidas_recusadas: 0, apagadas: 0, intervalos: 35, estendidas_ausentes: 0, atrasados_antigos: 0, com_buraco: 0}`; **cada caso de recusa difere dele em um campo só**, para a mutação da condição correspondente matar aquele teste e nenhum outro o encobrir. **Antes de cada teste que espera apagamento** (emenda 1: S-I-2): `comment on table public.yt_own_video_daily is 'P3 armada em 2026-03-10'` dentro da transação (o dia de `p_agora` em UTC), e a cobertura semeada com `collected_at` explícito, 3 horas antes de `p_agora`.

| Nome | Entrada | Esperado |
|---|---|---|
| `parâmetro nulo lança` | `p_site` nulo; `p_agora` nulo | exceção nas duas; nada apagado |
| `site sem diário: nada a apagar, sem exigir execuções` | site com vídeos e cobertura, diário vazio, **nenhuma** execução | `nada_a_apagar` |
| `site só com linhas de atividade: nada a apagar, sem exigir execuções` | nove linhas, cada uma com `views` 0 e **uma** das outras oito contagens diferente de zero (uma delas com curtida −1), e uma com `views` 3; nenhuma execução | `nada_a_apagar`; as dez ficam |
| `tabela de execuções vazia: recusa` | linhas vazias cobertas, zero execuções | exceção com "3 execuções limpas"; nada apagado |
| `duas execuções limpas recusa; três aceita` | fronteira | recusa; aceita |
| `nota do diário em uma das três recusa` (seis casos) | uma execução com `falhas` = `diário: X: 2 de 35 vídeos com erro`; `diario: timeout`; `schema_ausente: yt_own_video_coverage`; `erro de banco ao gravar yt_own_daily_apply`; `critérios: não foi possível avaliar cobertura de X (sem tempo)`; `diário: X: estendidas ausentes na resposta de 1 vídeo(s)` | recusa nos seis |
| `nota de outro passo não recusa` | `falhas` = `relatórios: guarda do bruto não conferida` | aceita |
| `execução sem resumo.diario, sem apagadas, ou com apagadas em texto não conta` | três variações numa das três | recusa nas três |
| `execução que rodou e não coletou não conta` (emenda 1: D-I-1, S-I-1; nove casos, todos com `apagadas: 0` presente) | numa das três: `tentativas {sem_autorizacao: 1}` sem `ok`; `tentativas {ok: 36, sem_conexao: 1}`; `pendentes: 35`; `tentativas {ok: 20, nao_alcancado_orcamento: 15}` com `pendentes: 0` (só a chave); `tentativas {ok: 1, sem_dado_na_janela: 35}` com `intervalos: 0`; `tentativas {}` (nenhum canal com coleta ligada); `tentativas {ok: 35, erro_http: 1}`; `atrasados_antigos: 2`; `estendidas_recusadas: 1` sem a nota correspondente | recusa nos nove |
| `nota de falha ao ler youtube_videos recusa` (emenda 1: D-I-1) | resumo da execução boa e `falhas` = `erro de banco ao ler youtube_videos` | recusa |
| `campos de resumo em formato estranho não derrubam a função` (emenda 1: D-I-1) | `pendentes: "0"` (texto), `intervalos: "35"`, `tentativas: []`, `tentativas: null` | recusa com a mensagem das três execuções, nunca erro de conversão |
| `sem a marca do dia recusa` (emenda 1: S-I-2; quatro casos) | comentário nulo; `P3 armada em 2026-03-09`; `P3 armada em 2026-03-11`; `texto antigo. P3 armada em 2026-03-10` | recusa com "o ritual do CSV não foi feito hoje" nos três primeiros; aceita no quarto |
| `sem linha vazia a marca não é exigida` (emenda 1: S-I-2) | site só com linhas de atividade, comentário nulo | `nada_a_apagar` |
| `cobertura em dia mas gravada há muito recusa` (emenda 1: S-I-1) | todos os vídeos com `covered_to` = hoje − 1 e `collected_at` 37 horas antes de `p_agora`; depois um vídeo com 35 horas | recusa com "cobertura em dia"; aceita |
| `segunda chamada com linha que ficou: exige as guardas` (emenda 1: S-M-7, D-M-3) | cenário com uma vazia de `avg_view_duration_seconds` 12,5; primeira chamada apaga as outras; segunda chamada com as execuções apagadas | a segunda **recusa** (três execuções); com as execuções de volta devolve `nada_apagado`, `apagadas` 0 |
| `duas execuções no mesmo dia: vale a última` | suja às 12:00 e limpa às 14:00 do mesmo dia; e o contrário | aceita; recusa |
| `dias não seguidos recusa` | execuções em D, D − 1 e D − 3 | recusa |
| `a mais recente com 36 horas recusa; com 35 aceita` | fronteira | recusa; aceita |
| `janela do cron` | `p_agora` às 11:29:59, 11:30:00, 12:59:59 e 13:00:00 UTC | aceita, recusa, recusa, aceita |
| `nenhum vídeo em dia recusa` | cobertura até hoje − 6 em todos; depois um vídeo até hoje − 5 | recusa; aceita |
| `vídeo em dia de OUTRO site não libera` | o site alvo sem vídeo em dia; outro site com | recusa |
| `apaga só a linha vazia e coberta` | 40 dias cobertos: 30 vazias, 6 com view, 4 com `views` 0 e outra atividade | `apagadas` 30; as 10 ficam, iguais coluna por coluna |
| `views nulo fica` | linha com `views` nulo e o resto zero | fica; `apagadas` não a conta |
| `linha vazia com média ou taxa preenchida fica` (três casos) | `avg_view_percentage` 0; `avg_view_duration_seconds` 12,5; `card_click_rate` 0 | ficam; `ficaram_com_media` 3 |
| `variante Z: média ou taxa zero sai, diferente de zero fica` (emenda 1: D-I-2) | os mesmos três casos, com o SQL na forma da variante Z (o teste monta as duas formas a partir do arquivo lido, qualquer que seja a que está nele, trocando o trecho entre as marcas `-- >>> MG15 regra 2 (início)` e `(fim)`; a troca falha o teste se o trecho não for achado) | as duas de zero saem e estão no backup com o zero original; a de 12,5 fica; `ficaram_com_media` 1; as contas fecham |
| `variante Z: retrato V5m igual antes e depois; retrato cru diferente` (emenda 1: D-I-2) | cenário com vazias de média 0 e de média nula | o md5 da V5m é o mesmo antes e depois; e o teste afirma que o retrato **sem** a regra "média só vale com view" muda (0 virou nulo), para a diferença visível estar escrita e não escondida |
| `linha vazia fora da base: a função lança e nada é apagado` | uma vazia um dia depois de `covered_to`, junto de 30 cobertas | exceção com "fora da cobertura base"; as 31 continuam; backup vazio |
| `fronteira do intervalo` | vazias em `covered_from` e em `covered_to` | as duas saem |
| `buraco de cobertura: a vazia do buraco faz lançar` | dois intervalos com um dia entre eles e uma vazia nesse dia | exceção |
| `estendidas medidas em dia sem cobertura estendidas: fica` | vazia com `engaged_views` 0 e só cobertura `base` | fica; `ficaram_fora_das_estendidas` 1 |
| `estendidas nunca medidas: sai sem cobertura estendidas` | vazia com `engaged_views` e `card_impressions` nulos | sai |
| `outro site não é tocado` | sites A e B com vazias cobertas; chamada para A | as de B ficam; nenhuma linha de B no backup; as contas de B iguais |
| `cobertura de outro site para o mesmo vídeo não libera a linha` | linha vazia de A sem cobertura em A; intervalo `base` do mesmo id de vídeo gravado com `site_id` de B | exceção (fora da base) |
| `toda linha apagada está no backup, coluna por coluna` | 30 vazias com `collected_at`, `source`, `metric_version` e `video_id` variados | `to_jsonb` de cada linha antes = `to_jsonb` da linha do backup |
| `rodar duas vezes` | a mesma chamada de novo | `nada_a_apagar`; backup com as mesmas 30 |
| `chave que já estava no backup é atualizada, não duplicada` | backup com a chave e `collected_at` antigo; a linha de volta no diário com `collected_at` novo | uma linha no backup, com o valor novo |
| `as contas fecham e o retorno bate com a contagem do teste` | o cenário de 40 dias | `antes.t` 40, `depois.t` 10, `a` 10 nos dois, as nove somas iguais, `c_base` igual, `dentro_da_base` 40 e 10 |
| `retrato da vida inteira igual antes e depois` | a consulta V5 sobre o cenário, com um dia fora da cobertura e um com `views` nulo | mesmo md5; o dia fora da cobertura "não medido" nos dois |
| `backup: RLS ligada, sem policy, sem privilégio, sem chave estrangeira` | catálogo | `relrowsecurity` verdadeiro; 0 policies; `has_table_privilege` falso para `anon`, `authenticated` e `service_role` em `select`, `insert`, `update`, `delete`; 0 chaves estrangeiras |
| `as três funções: sem execute para anon, authenticated e service_role` | `has_function_privilege` (nunca chamando) | falso nas nove combinações |
| `serie_coletada não conta o backup` | canal com cobertura, 10 linhas no diário e 30 no backup | `youtube_channel_removal_impact(...)->'serie_coletada'` = soma sem o backup; maior que 0 |

**Provas por mutação pedidas** (cada uma tem de matar pelo menos um teste): tirar `d.site_id = p_site` da seleção das vazias; tirar `c.site_id = p_site` da regra da `base`; tirar o filtro de site de `…_contas`; tirar o filtro de site da contagem de vídeos em dia; trocar `d.views = 0` por `coalesce(d.views, 0) = 0`; tirar, uma por vez, cada uma das oito outras contagens de `yt_own_daily_linha_vazia`; tirar a regra 2; tirar a regra 4; tirar a recusa de "fora da base"; trocar `>=` por `>` em 11:30 e `<` por `<=` em 13:00; trocar 36 por 48 horas; tirar a exigência de dias seguidos; trocar `limit 3` por `limit 2`; tirar, um por vez, cada um dos **seis** padrões de nota (o sexto é `%youtube_videos%`); tirar `on conflict … do update`. **(emenda 1: D-I-1, S-I-1, S-I-2)** Mais: tirar, uma por vez, cada condição nova de `limpa` (`pendentes` 0; `atrasados_antigos` 0; `estendidas_recusadas` 0; `intervalos` maior ou igual a 1; `tentativas.ok` maior ou igual a 1; e cada uma das cinco chaves de falha da lista); tirar `c.collected_at > p_agora - interval '36 hours'` da guarda (4); trocar 36 por 48 nessa guarda; tirar a guarda da marca do dia; trocar `v_hoje` por `v_hoje - 1` na marca. **Mutação equivalente, declarada:** tirar `and d.site_id = p_site` do `delete` (as chaves já vêm da seleção filtrada por site) não muda o resultado.
**Armadilhas.** A semente de `youtube_channels` exige `locale`, `handle` e `uploads_playlist_id`; a do diário exige `metric_version` da lista aceita. A trava do diário fica presa até o `rollback`: transação curta, `set local lock_timeout = '5s'`. Não usar o cliente PostgREST para ler o que está dentro da transação (ele não vê). (emenda 1) `comment on table` pede trava `share update exclusive` no diário até o `rollback`: é mais um motivo para a transação ser curta. A cobertura semeada **sem** `collected_at` explícito nasce com `now()` (outubro de 2026), posterior a `p_agora`, e faria a guarda (4) passar sem provar nada: sempre semear o valor.
**Pronto quando:** os testes passam duas vezes seguidas contra o `bythiago_int`; a tabela de mutações está no relatório; depois do último `rollback`, `to_regclass('public.yt_own_video_daily_zeros_bkp')` e as três funções são nulos no banco; `npm run typecheck -w apps/web` limpo.

### Tarefa 2: os dois roteiros de volta e o teste deles

**Objetivo.** As voltas A e B como arquivos versionados, com o texto exato testado (itens 49 e dívida D5 do plano irmão).
**Arquivos.** Os dois `.sql` em `docs/ops/sql/` (textos nos Apêndices B e C); `test/integration/a5-e6-p3-volta.test.ts`.
**Contrato.** O roteiro A não tem parâmetro. O roteiro B tem um: o texto literal `<UUID_DO_SITE>`, que o dono troca (o teste troca por `replace`). Os dois são uma instrução `insert` cada, sem `begin` nem `commit` (o dono roda no SQL Editor; o teste, dentro da transação dele).
**Testes** (teste antes: falha por arquivo ausente).

| Nome | Entrada | Esperado |
|---|---|---|
| `volta A devolve as T linhas, iguais coluna por coluna` (item 49) | cenário de 40 dias; md5 das linhas do site ordenadas, antes; P3; roteiro A | 40 linhas; md5 igual ao de antes |
| `volta A: as telas não mudam` (item 49) | o retrato V5 antes da P3, depois da P3 e depois da volta A | três md5 iguais |
| `volta A com vídeo que saiu de youtube_videos` | apagar o vídeo depois da P3 | as linhas voltam com `video_id` nulo; nenhuma exceção |
| `volta A não passa por cima de dia que ganhou atividade` | depois da P3, inserir linha com 2 views num dia do backup | a linha de 2 views fica |
| `volta A duas vezes` | o roteiro de novo | nenhuma linha a mais |
| `volta A com o backup vazio` | sem P3 | 0 linhas inseridas, sem erro |
| `volta B: retrato igual ao de antes da P3` | P3; roteiro B com o site | md5 do retrato igual; `t` de volta a 40 menos os dias que já não tinham linha |
| `volta B: contagens em zero, média nula, estendidas só onde cobertas` | cobertura `estendidas` em metade dos dias | `engaged_views` e `card_impressions` 0 na metade coberta, nulos na outra; as três de média nulas |
| `volta B: metric_version pelo dia` | dias 30/03/2025, 31/03/2025, 26/08/2026 e 27/08/2026 cobertos | as três versões, nas fronteiras de F8, iguais às de `metricVersion()` do código |
| `volta B não toca outro site; site errado não insere nada` | dois sites; uuid aleatório | só o site pedido; 0 linhas |
| `volta B com buraco na cobertura` | dois intervalos | nenhuma linha no dia do buraco |
| `volta B com vídeo que saiu de youtube_videos` | idem volta A | `video_id` nulo |

**Provas por mutação:** tirar o `case` de `video_id` do roteiro A; trocar `do nothing` por `do update` no A; tirar `c.site_id =` do B; tirar `c.metric_set = 'base'` do B; trocar uma fronteira de data do `case` de `metric_version`.
**Pronto quando:** os testes passam duas vezes; os dois arquivos são idênticos aos Apêndices B e C (`diff`).

### Tarefa 3: ensaio em volume de produção e a migration inteira, por `psql`

**Objetivo.** Medir o tempo, provar a idempotência do arquivo inteiro e as recusas de entrada, que o vitest não cobre (o bloco final usa `now()`).
**Como.** Dois roteiros, rodados **duas vezes**, saída em `prova-saida.txt`. **(emenda 1: S-M-2)** Depois do primeiro `raise exception` a transação fica abortada e todo comando seguinte falha com "current transaction is aborted": uma recusa esperada "passaria" por qualquer erro e o caso seguinte nunca rodaria. Por isso **cada caso é a sua própria transação** `begin; … rollback;` (ou um `savepoint` por caso, com `rollback to savepoint` depois de cada recusa), com `\set ON_ERROR_STOP off` e `\set VERBOSITY terse`, e a saída é conferida pelo **texto** da mensagem de cada recusa (`MG15 recusada: entre 11:30…`, `MG15: o diário mudou de forma`, `MG15 depende da MG14`), não por "deu erro". **(emenda 1: S-M-3)** Toda transação começa com `set local lock_timeout = '5s'`; os casos (d) e (e), que pedem trava exclusiva em tabela dividida com outras trilhas, vão **por último**, cada um numa transação própria e curta (só o `alter` ou o `drop`, o arquivo, o `rollback`). **(emenda 1: S-M-4)** Dentro de cada transação, antes de semear: `delete from public.yt_own_collection_runs where ran_at > now() - interval '10 days'` (desfeito no `rollback`), para a execução suja de outro teste não virar "a última do dia"; e a marca do dia (`comment on table public.yt_own_video_daily is 'P3 armada em <hoje em UTC>'`) nos casos que esperam apagamento. Antes de começar, `select count(*) from public.yt_own_video_daily` tem de dar 0 (o banco é dividido: se outro teste tiver semeado, esperar e rodar de novo).
- `prova.sql`: (a) o arquivo inteiro com o diário vazio: sem erro, aviso "nada a fazer", backup criado vazio, as três funções **não** existem no fim; (b) semente pequena (um site, um canal, três vídeos, 40 dias, três execuções boas com `ran_at` relativo a `now()`), arquivo inteiro: apaga, comentário escrito, V1 a V4 com os valores esperados; **se a hora atual estiver entre 11:30 e 13:00 UTC, o esperado é a recusa**, e o roteiro imprime qual ramo rodou; (c) o arquivo de novo na mesma transação: sem erro, `nada_a_apagar`, comentário intacto; (d) com uma coluna a mais no diário (`alter table … add column`): recusa "mudou de forma"; (e) sem a cobertura (`drop table … cascade` dentro da transação): recusa "depende da MG14"; (f) roteiro A e roteiro B sobre o resultado de (b). (emenda 1: S-M-2, S-M-3) Agrupamento em transações: (a) sozinha; (b), (c) e (f) na mesma (a (f) precisa do resultado da (b)), com um `savepoint` antes do arquivo para o ramo em que a (b) recusa pela janela; (d) sozinha e (e) sozinha, por último.
- `prova-volume.sql` (uma transação `begin; … rollback;`, sem recusa esperada): 35 vídeos × 2.768 dias = 96.880 linhas, 2,5% com view (a mesma semente do fato L19 do plano irmão), cobertura pela carga da MG14, três execuções boas; `\timing`; a função para o site; depois `pg_total_relation_size` do backup; a exportação e a recarga de um CSV de dentro da transação (`\copy … to` um arquivo do scratch, `\copy` de volta para uma tabela temporária, mesma contagem e mesma soma). (emenda 1: sugestão do parecer de software) Depois, na mesma transação, **a volta B em volume real** com `\timing`: é uma instrução de cerca de 94 mil linhas que o dono rodaria pelo SQL Editor, cujo limite de tempo não está medido; o tempo vai ao ledger e ao runbook.
**Anotar no ledger:** segundos da função (a medida que este plano não tem), segundos da volta B em volume, tamanho do backup, e a saída das duas rodadas iguais (fora carimbos de hora). **(emenda 1: D-M-8)** E a resposta a esta pergunta, com `show lock_timeout; show statement_timeout;` rodados depois do arquivo, na mesma sessão: os dois `set` do topo do arquivo são de sessão, não de transação; se a forma de aplicar reaproveitar a sessão para o arquivo seguinte, os limites vazam para ele. Em produção a MG15 vai sozinha e o cliente fecha a conexão; se o ensaio mostrar reaproveitamento, o Apêndice A troca os dois por `set local` dentro de cada bloco, por emenda.
**Pronto quando:** as duas rodadas dão a mesma saída; depois do `rollback`, nada ficou (as mesmas conferências de "nada ficou" do plano irmão); o tempo está no ledger. **Acima de 10 s: parar e avisar.**

### Tarefa 4: conferências com data

**Objetivo.** As quatro conferências da seção 7 no mecanismo que já deixa o cron vermelho quando vencem há mais de 7 dias.
**Contrato** (`src/lib/conferencias.ts`, no molde de `conferenciasE8Coleta`, linhas 68 a 88): `export const E6_P3_APLICADA: string | null = null`; `export function conferenciasE6P3(aplicada: string | null): Conferencia[]`, com `etapa: 'E6'`, ids `e6-p3-d0`, `e6-p3-d1`, `e6-p3-d7`, `e6-p3-d14`, datas `aplicada + 0, 1, 7, 14`, `responsavel: 'agente'`, e `onde` apontando para este plano (seção 7 e seção 11) e para o ledger; `CONFERENCIAS` passa a espalhar `conferenciasE6P3(E6_P3_APLICADA)`.
**Testes** (`test/lib/conferencias.test.ts`, escritos antes): `E6_P3_APLICADA nula = nenhuma entrada, nada vence` (o caso de dado ausente); `malformada = uma entrada de erro de 1970 que cita a constante` (com `2026-13-01`, `13/10/2026` e texto vazio); `preenchida = quatro entradas nas datas certas, em ordem`; `a constante publicada é nula ou uma data real, e, se tiver data, a lista publicada tem a entrada e6-p3-d0` (pega o espalhamento esquecido).
**Mesma lista em** `.superpowers/sdd/a5/conferencias-com-data.md`.
**Pronto quando:** `npx vitest run test/lib/conferencias.test.ts` verde; `typecheck` limpo.

### Tarefa 5: runbook

**Objetivo.** O dono achar, num lugar só, o ritual e as três voltas.
**Arquivo.** `docs/ops/youtube-coleta-canais-proprios-runbook.md`: (a) seção nova no fim, "Dieta do diário: apagar as linhas vazias (P3)": o ritual da seção 2 e o Apêndice D deste plano, as conferências A1 e V1 a V7, as três voltas com o caminho dos dois roteiros e os comandos da volta C, o aviso "depois da P3 o coletor e o leitor não se revertem", e o que o comentário da tabela de backup traz; (b) na seção 11 (apagar a série de um canal), acrescentar a linha de `yt_own_video_daily_zeros_bkp` e, **se a Tarefa 11b do plano irmão ainda não tiver posto**, a de `yt_own_video_coverage` antes do canal (`grep -n yt_own_video_coverage` no arquivo decide).
**Sem teste automático** (é documento). **Pronto quando:** todo comando de escrita traz "(você roda)" e vai um por linha, como manda a linha 12 do runbook; os dois caminhos de `docs/ops/sql/` existem.

### Tarefa 6: o arquivo da migration (só com o portão verde)

**Não começa antes de o controlador dizer que G1 a G12 estão verdes e que nenhum outro lote tem arquivo pendente.**
**Passos, nesta ordem.**
1. Gravar a fixture: uma das três linhas da CP5 (só `falhas` e `resumo.diario`, nomes de canal trocados por `canal`) em `test/youtube/coleta/fixtures/e6-p3-execucao-real.json`. Acrescentar ao teste da Tarefa 1 o caso `execução real de produção é reconhecida como limpa` (três cópias da fixture em três dias): escrito antes de qualquer mudança no SQL; se falhar, a regra das execuções está errada para o formato real: corrigir o Apêndice A, o ensaio e rodar as Tarefas 1 e 3 de novo.
2. `npm run db:new observatorio_a5_e6_p3_apagar_linhas_vazias`; conferir que o carimbo é posterior ao de todo arquivo existente; colar o Apêndice A; `diff` contra `.superpowers/sdd/a5-e6-p3/sql/mg15.sql`: vazio.
3. Rodar os testes das Tarefas 1 e 2 (agora lendo o arquivo de migration se o de ensaio for removido) e `prova.sql` com o arquivo real.
4. Bancos locais, **só depois de o passo 5 do ritual dar verde em produção** (emenda 1, consequência de S-I-2: se o arquivo sair do repositório depois de uma recusa, um banco local que já o tivesse aplicado ficaria com uma versão sem arquivo no histórico; o ensaio do arquivo inteiro já é a Tarefa 3 e o passo 3 daqui, por `psql`, sem registrar migration): no `bythiago_int`, o controlador aplica a pendente (diário vazio: sem recusa). No banco do navegador (54321), que a A4 e os outros terminais usam para ver tela (emenda 1: D-M-6), **nada é apagado sem o controlador avisar os outros terminais antes**. A ordem: se a semente e2e já tiver a opção sem linhas vazias que o plano irmão prevê (`grep -n "dieta" apps/web/e2e/fixtures/observatorio-seed.ts`; em 13/10 não tem), semear de novo com ela e aplicar; se não tiver, limpar só o diário desse banco (`clearOwnL2`), aplicar, e **semear de novo logo em seguida**, no mesmo passo. Sem isso a migration recusa nesse banco por falta da marca e das execuções, e trava o `migration up` local dos outros terminais.
5. Se o teste do item 231 existir: acrescentar o par. (emenda 1: S-M-9) Não decidir por `grep` de "lista fechada", que é frágil: perguntar ao controlador o caminho do arquivo de teste da E10 e, sem resposta, procurar pelo número do item e pelo nome da tabela (`grep -rln "231" apps/web/test | xargs grep -ln "yt_own_video_daily\|supabase/migrations"`); nenhum arquivo = o teste não existe e o par fica na dívida. O par é (arquivo da MG15, `yt_own_video_daily`), linha 7 da tabela de 9.2, no mesmo commit. **(reconciliação 13/10, emenda 1: D-I2) No mesmo commit do arquivo, e conferido antes do passo 2:** a tabela de backup que a MG15 deixa no banco (`yt_own_video_daily_zeros_bkp`) é classificada nas listas dos testes `observatorio-a5-e17-p0-doze.test.ts` e `-reporter-banco.test.ts` (passo 0 da E17), se existirem; e, ~~com o SQL de ensaio aplicado no `bythiago_int`~~ (reconciliação 13/10, emenda 2: D2-m3) **dentro da mesma transação desfeita (`begin; … rollback;`) em que o teste da Tarefa 1 aplica o ensaio, rodar a consulta de catálogo da lista fechada da E10 e a dos dois testes da E17, e conferir o resultado contra as listas; nunca aplicar a MG15 de forma persistente em banco local antes de produção verde (passo 4 desta tarefa).** Os três arquivos de teste abrem conexão própria e não enxergam a transação: rodá-los "com o ensaio aplicado" exigiria aplicação persistente no banco que seis agentes dividem, que é o que o passo 4 proíbe. Assim conferidos, esses dois e `observatorio-a5-e10-lista-fechada.test.ts` passam depois de produção verde. A MG15 não deixa função permanente com `delete` (as auxiliares somem no fim do arquivo), então o teste de integração da E10 não ganha par; o par de arquivo vai para `.superpowers/sdd/a5/fila-do-db-push.md`. Motivo de ser aqui e não na Tarefa 7: depois do passo 2 a fila do `db push` está travada para todos.**
6. Commit local por caminho. **Sem push** (o push é da Tarefa 7, depois de aplicada).
**Pronto quando:** `diff` vazio; testes verdes; `git status` mostra só os arquivos desta tarefa; o ledger diz a hora em que o arquivo nasceu. **Entre este commit e o `db:push:prod` do dono, nenhum outro `db:new` no repositório, e (emenda 1: S-I-2) nenhum outro `db:push:prod`:** a linha "MG15 pendente: db push bloqueado" está no ledger comum desde antes do passo 2. **Se a migration recusar e a nova tentativa não for no mesmo dia, esta tarefa é desfeita** por um commit que remove o arquivo (seção 2, "Arquivo armado", regra 2) e refeita no outro dia a partir do passo 2; a fixture do passo 1 fica.

### Tarefa 7: o dia (ritual, conferências, envio)

**Antes.** Tarefa 6 feita **no mesmo dia** (emenda 1: S-I-2: "ou na véspera" saiu; arquivo que dorme no repositório é arquivo armado); G3 conferido de novo na hora (a execução das 12:00 UTC do dia entra na conta).
**Ordem que não pode inverter:** CSV e marca do dia (dono) → A1, V5 "antes" e R1 (controlador) → `db:push:prod` (dono) → V1 a V6 → `vacuum full` (dono) → V7 → data em `E6_P3_APLICADA`, commit, push em `staging`, CI verde, promoção a `main`. O que acontece se inverter está na tabela da seção 2.
**No commit do envio.** `E6_P3_APLICADA` com o dia de São Paulo; a mesma data em `conferencias-com-data.md`; o arquivo da migration (Tarefa 6), os dois roteiros, os testes e o runbook, por lista explícita de commits. **Tem de estar em `main` antes:** o lote E6-P2 (G1) e os lotes que tocam `conferencias.ts` e o runbook na frente.
**Retratos.** A saída da V5 de antes e de depois em `.superpowers/sdd/a5/retratos/e6-p3-antes.json` e `e6-p3-depois.json`, com o instante, o uuid do site e o corte. **Regra: igualdade total** (mesmo md5). Não há cron entre os dois, então nenhuma diferença é "revisão do YouTube".
**Volta.** Qualquer V fora do esperado: volta A no mesmo dia (o dono roda o roteiro no SQL Editor), V3 de novo (tem de dar `t` = `t_antes`), e a P3 fica para depois de a causa ser achada. A MG15 já consta como aplicada: uma segunda tentativa é uma migration nova, com o mesmo texto e outro nome.
**Pronto quando:** CI verde, deploy pronto, `e6-p3-d0` com `feitaEm`, e o ledger traz A1, V1 a V7, os dois md5, o `sha256` do CSV e a saída do `db push`.

---

## 11. Consultas de conferência

**Nenhuma foi rodada pelo autor** (aviso de 0.3). A Tarefa 3 roda todas no `bythiago_int` sobre semente e anota o resultado ao lado. Em toda consulta o site entra por parâmetro e a resposta traz o total avaliado: `0 de 0` se lê "nada foi avaliado".

**A1, contas de antes (passo 4 do ritual).** Guardar a linha inteira.
```sql
select count(*) as t, count(*) filter (where coalesce(views,0)<>0 or coalesce(engaged_views,0)<>0 or coalesce(watch_time_minutes,0)<>0 or coalesce(likes,0)<>0 or coalesce(comments,0)<>0 or coalesce(shares,0)<>0 or coalesce(subscribers_gained,0)<>0 or coalesce(subscribers_lost,0)<>0 or coalesce(card_impressions,0)<>0) as a, count(*) filter (where views = 0 and coalesce(engaged_views,0)=0 and coalesce(watch_time_minutes,0)=0 and coalesce(likes,0)=0 and coalesce(comments,0)=0 and coalesce(shares,0)=0 and coalesce(subscribers_gained,0)=0 and coalesce(subscribers_lost,0)=0 and coalesce(card_impressions,0)=0) as vazias, coalesce(sum(views),0) as s_views, coalesce(sum(engaged_views),0) as s_engajadas, coalesce(sum(watch_time_minutes),0) as s_minutos, coalesce(sum(likes),0) as s_curtidas, coalesce(sum(comments),0) as s_comentarios, coalesce(sum(shares),0) as s_compart, coalesce(sum(subscribers_gained),0) as s_ganhos, coalesce(sum(subscribers_lost),0) as s_perdidos, coalesce(sum(card_impressions),0) as s_cartao, (select coalesce(sum(covered_to - covered_from + 1),0) from public.yt_own_video_coverage where site_id = :site and metric_set = 'base') as c_base, now() as instante from public.yt_own_video_daily where site_id = :site;
```

**V1, a migration entrou inteira.** Esperado `t, t, 0, f, f, f, t, 0, 0`.
```sql
select to_regclass('public.yt_own_video_daily_zeros_bkp') is not null as backup_existe, (select relrowsecurity from pg_class where oid = 'public.yt_own_video_daily_zeros_bkp'::regclass) as rls, (select count(*) from pg_policies where schemaname = 'public' and tablename = 'yt_own_video_daily_zeros_bkp') as policies_de_0, has_table_privilege('anon', 'public.yt_own_video_daily_zeros_bkp', 'select') as anon_le, has_table_privilege('authenticated', 'public.yt_own_video_daily_zeros_bkp', 'select') as autenticado_le, has_table_privilege('service_role', 'public.yt_own_video_daily_zeros_bkp', 'select') as servico_le, to_regprocedure('public.yt_own_daily_diet_p3(uuid,timestamptz)') is null as funcao_saiu, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('yt_own_daily_linha_vazia', 'yt_own_daily_diet_p3_contas', 'yt_own_daily_diet_p3')) as funcoes_de_0, (select count(*) from pg_constraint where conrelid = 'public.yt_own_video_daily_zeros_bkp'::regclass and contype = 'f') as chaves_estrangeiras_de_0;
```

**V2, o que a migration anotou.** Esperado: texto. Nulo = nada apagado.
```sql
select obj_description('public.yt_own_video_daily_zeros_bkp'::regclass, 'pg_class');
```

**V3, contas de depois.** A mesma A1, mais `(select count(*) from public.yt_own_video_daily_zeros_bkp where site_id = :site) as backup`. Esperado contra a A1: `t = t_antes − apagadas`; `a` igual; `vazias` = as que ficaram (esperado 0); as nove somas iguais; `c_base` igual; `backup = apagadas`. E a CP7 de novo: 22 e 14 (ou os números do dia), iguais aos de antes.

**V4, por vídeo: toda linha do backup é dia coberto e sem linha.** Esperado `N, 0, 0`.
```sql
select count(*) as linhas_no_backup, count(*) filter (where not exists (select 1 from public.yt_own_video_coverage c where c.site_id = b.site_id and c.youtube_video_id = b.youtube_video_id and c.metric_set = 'base' and b.day_pt between c.covered_from and c.covered_to)) as fora_da_base_de_0, count(*) filter (where exists (select 1 from public.yt_own_video_daily d where d.youtube_video_id = b.youtube_video_id and d.day_pt = b.day_pt)) as ainda_com_linha_de_0 from public.yt_own_video_daily_zeros_bkp b where b.site_id = :site;
```
Só vale no dia: num dia seguinte, um dia do backup pode ganhar atividade por revisão do YouTube e `ainda_com_linha` sobe, o que é certo.

**V5, retrato da vida inteira** (`:inicio` = o menor `day_pt` do diário **antes** da P3, anotado; `:corte` = o maior). Rodar antes e depois com os mesmos três parâmetros.
```sql
select count(*) as pares, count(*) filter (where x.medido) as medidos, coalesce(sum(x.views),0) as soma, md5(string_agg(x.youtube_video_id || '|' || x.dia || '|' || x.medido || '|' || coalesce(x.views::text, '-'), ',' order by x.youtube_video_id, x.dia)) as retrato from (select v.youtube_video_id, g::date as dia, case when d.youtube_video_id is not null then d.views is not null else cb.ok end as medido, case when d.youtube_video_id is not null then d.views when cb.ok then 0 end as views from public.youtube_videos v cross join generate_series(:inicio::date, :corte::date, interval '1 day') g left join public.yt_own_video_daily d on d.youtube_video_id = v.youtube_video_id and d.day_pt = g::date cross join lateral (select exists (select 1 from public.yt_own_video_coverage c where c.site_id = v.site_id and c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base' and g::date between c.covered_from and c.covered_to) as ok) cb where v.site_id = :site) x;
```
(emenda 1: S-M-5) A cobertura casa também pelo site, como na função.

**(emenda 1: D-M-2) Se a CP13 der maior que 0** (há linha de vídeo que saiu do cadastro), a V5 troca `public.youtube_videos v … where v.site_id = :site` por `(select youtube_video_id, site_id from public.yt_own_video_daily where site_id = :site union select youtube_video_id, site_id from public.yt_own_video_daily_zeros_bkp where site_id = :site) v`. Na rodada "antes" a tabela de backup ainda não existe: o controlador roda só o primeiro ramo e guarda a lista de ids; a rodada "depois" usa a união, e `pares` tem de ser igual nas duas.

**V5m, só se a variante Z da regra 2 for a escolhida (emenda 1: D-I-2): retrato das duas colunas de média.** A mesma consulta da V5, com o md5 sobre `youtube_video_id | dia | pct | duracao`, em que `pct` e `duracao` são `avg_view_percentage` e `avg_view_duration_seconds` da linha **só quando `views > 0`**, e nulos em todo outro caso (linha de zero views, dia coberto sem linha, dia não medido). Antes e depois têm de dar o mesmo md5: prova que a variante não mexeu em nenhuma média de dia com view. **O que a V5m não cobre, de propósito:** a média 0 gravada em dia sem view, que a variante troca por nula; é a mudança que o dono aprovou na pergunta 3, e o número de linhas afetadas é `a_com_media` da CP2, anotado no ledger.
É a K1 do plano irmão estendida à vida inteira (35 vídeos × cerca de 4.060 dias), com a regra do leitor: havendo linha vale a linha; sem linha vale a cobertura. `pares` 0 = site errado.

**V6.** K4, K5 e K8 do plano irmão (seção 11 dele), sem mudança. Esperado: 0 e 0; `atrasados` 0; 0.

**V7, tamanho (item 48), depois do `vacuum full`.** Esperado: `diario` menor que 2.097.152.
```sql
select pg_total_relation_size('public.yt_own_video_daily') as diario, pg_total_relation_size('public.yt_own_video_daily_zeros_bkp') as backup, pg_database_size(current_database()) as banco;
```

**R1, o CSV restaura (banco local, controlador, antes do passo 5).** Num `psql` contra o `bythiago_int`, dentro de `begin; … rollback;`: `create temp table csv_real (like public.yt_own_video_daily);` depois `\copy csv_real from '<caminho do CSV>' csv header` e `select count(*), coalesce(sum(views),0), count(distinct youtube_video_id), min(day_pt), max(day_pt) from csv_real;`. Esperado: `t`, `s_views` e os vídeos da A1. Diferença = o CSV não é o do dia: **não seguir para o passo 5**.

---

## 12. Onde está cada item de aceite

| Item | Onde |
|---|---|
| 47 (as igualdades, com os números do dia, antes e depois) | seção 4.3 (as seis, com o motivo de não serem as cinco do spec: desvios 1, 2, 3 e 11); exigidas dentro da função (Apêndice A); Tarefa 1 (`as contas fecham…`); A1, V2, V3 e V4; conferência `e6-p3-d0` |
| 48 (menor que 2 MB depois do `vacuum full`) | passo 7 do ritual; V7; `e6-p3-d0` e `e6-p3-d7`. (emenda 1: D-I-2) **Depende da CP2:** com `a_com_media` 0 fecha; com `a_com_media` alto e resposta "apaga" fecha pela variante Z; com `a_com_media` alto e o padrão "ficam", **não fecha** e o ledger diz quantas linhas ficaram. Fica aberto também se o dono não rodar o `vacuum full` (pergunta 4) |
| 49 (ensaio da volta no banco local: `T` linhas e telas iguais) | Tarefa 2 (`volta A devolve as T linhas…`, `volta A: as telas não mudam`); Tarefa 3 (f) e a recarga do CSV. "Telas iguais" é provado pelo dado idêntico e pelo retrato, não por navegador (seção "o que nenhum teste prova") |
| 50 (NP-E6 continua em 0) | V6 (K5) no dia; `e6-p3-d1` e `e6-p3-d7`. O alarme permanente é o critério do cron, do plano irmão; a P3 não o toca |
| 43 e 247 (os números não mudam, sobre base congelada) | V5 (retrato da vida inteira, igualdade total); Tarefa 1 (`retrato da vida inteira igual…`); Tarefa 7 (retratos guardados) |
| 231 (lista fechada do que apaga) | Tarefa 6, passo 5, **se o teste existir**; senão dívida, com o par escrito. As três funções não sobrevivem à migration (V1), então o único `delete` que fica é o do arquivo |
| 245 (interruptor com teste que apaga a variável) | **não se aplica**: sem variável e sem cron. A recusa da migration faz o papel, com teste para cada guarda |
| 246 (conferência com data) | Tarefas 4 e 7 |
| 201 (`serie_coletada`) | Tarefa 1 (`serie_coletada não conta o backup`): a função de impacto não é recriada |
| 191 (policy das tabelas privadas) | **não se aplica**: o backup não está na lista e não tem policy nenhuma |
| Spec `00`, linha 395 (sozinha, com o dono, depois do código tolerante em `main`) | G1 e G10; seção 2 |
| Spec `00`, linha 418 (o que não se desfaz) | seção 2, "Como desfazer" |
| Risco 8 do spec (erro humano entre o CSV e a migration) | as guardas e as contas dentro da migration; R1; tudo no mesmo dia; (emenda 1: S-I-2) a marca do dia exigida pela função, o bloqueio de `db:push:prod` e a saída do arquivo depois de uma recusa (seção 2, "Arquivo armado") |
| Dívida D5 do plano irmão (recriar os zeros da cobertura) | Apêndice C; Tarefa 2 |
| Dívida D1 do plano irmão (janela repedir buraco) | **fora**, com o motivo: seção 13 |
| P4, itens da MG16 | **fora**: outra etapa. Aqui só `e6-p3-d14` |

**O que nenhum teste vai provar (declarado).**
- O tempo da migration e do `vacuum full` **em produção** (só o ensaio local em volume igual).
- Que o cliente do `db push` aplica o arquivo numa transação só (não medido; por isso o apagamento é uma instrução única, e o resto é inofensivo se ficar pela metade).
- Que a conexão do dono aceita `vacuum full` (CP10).
- Que o leitor tolerante está em produção: a migration não vê código; é G1.
- Que a tela real não muda: a prova é o retrato (V5) e a cadeia "a função só tira linha vazia e coberta" (Tarefa 1) mais "o leitor devolve as mesmas linhas com e sem as vazias" (Tarefas 5 e 3b do plano irmão). Ninguém abre navegador nesta etapa; o dono olha a página em D + 1.
- A regra das três execuções contra uma linha real de produção, até a Tarefa 6 (antes disso, só contra o tipo `DiarioResumo`). (emenda 1) Com a regra mais estreita, a fixture real passa a ser também a prova de que ela **não recusa uma execução boa de verdade**; até lá isso é a conferência pendente da CP5.
- (emenda 1: S-I-2) Que o bloqueio de `db:push:prod` e a retirada do arquivo são obedecidos: são regras de processo. O que tem teste é a marca do dia.
- A concorrência real com o cron (a trava é provada por leitura do SQL, não por duas sessões).
- Que o CSV de produção restaura **em produção** (só no banco local, R1).
- A volta C (CSV) contra o banco de produção.

---

## 13. Riscos que ficam, sem suavizar

1. **O SQL dos apêndices nunca rodou.** Foi escrito lendo a MG14 e o código; as Tarefas 1 e 3 são a primeira execução. É esperado achar defeito de sintaxe ou de regra; nada disto vai ao dono antes de rodar duas vezes e de os especialistas verem a saída.
2. **A etapa depende de código que não existe.** O leitor tolerante (Tarefa 5 do plano irmão) e o critério de cobertura no cron (Tarefa 11b) esperam a A4 fechar. Sem eles, a P3 não tem data.
3. **A regra das "três execuções limpas" foi desenhada sobre o formato do resumo lido no código, não sobre uma linha real** (a P2 nunca rodou em produção). Se o formato for outro, a migration recusa (lado seguro), e a correção custa uma volta nas Tarefas 1, 3 e 6. (emenda 1: D-I-1, S-I-1) A regra ficou mais estreita (exige prova de coleta) e, por isso, **mais sujeita a recusar execução boa**: se uma execução normal trouxer `intervalos` 0, `atrasados_antigos` maior que 0 ou `erro_http` por causa de um vídeo só, a P3 fica parada até a causa ser tratada (conferência pendente da CP5, com o que muda em cada caso).
4. **Depois da MG16, a única cópia byte a byte é um arquivo no disco do dono.** A volta B recria o que os leitores precisam, não as linhas originais. Se o CSV se perder e a Analytics API deixar de devolver a vida inteira, `collected_at` e os nulos originais das linhas de zero não voltam. São linhas de zero: a perda é de proveniência, não de medida.
5. **Reverter o coletor depois da P3 desfaz a dieta em silêncio** (seção 2). Só a conferência `e6-p3-d7` e o tamanho do banco avisam.
6. **Depois da P3, a cobertura é a única prova de "zero medido".** Antes, uma cobertura ilegível ou apagada não mudava a tela (as linhas de zero estavam lá). Depois, uma falha de leitura da cobertura, ou um `delete` errado nela, transforma 11 anos de zeros em "não medido" de uma vez. O leitor do plano irmão avisa o Sentry e segue; o critério de cobertura do cron fica vermelho no dia seguinte. A volta B não ajuda nesse caso (ela parte da cobertura); a volta A e o CSV, sim.
7. **A recusa por "linha vazia fora da base" pode segurar a P3 por uma linha só**, e a causa provável (linha gravada pelo coletor antigo e nunca coberta) não tem conserto automático: é o dono apagar a linha ou cobrir o dia, caso a caso. É o lado seguro, e custa atenção.
8. **Se a API devolver média zero em dia sem view** (CP2), a migration não apaga nada com o padrão da pergunta 3, e a etapa termina sem ganho. O plano prefere isso a trocar "0%" por "não medido" sem o dono saber. (emenda 1: D-I-2) Esse ramo é **provável** (a regra do nulo entrou no coletor um dia depois de a tabela nascer). A CP2 roda antes da Tarefa 1, e a variante Z está escrita e testada para o caso de o dono responder "apaga"; se ele não responder, vale o padrão e os itens 47 e 48 não fecham com ganho.
9. **O backup e o comentário somem na MG16.** O ledger tem de ter os números antes.
10. **Buraco de cobertura antigo nunca é repedido** (risco 16 do plano irmão). A P3 não o piora (linha em buraco não sai, e a função recusa se for vazia), mas também não o conserta.
11. **A guarda das execuções é global** (a tabela não tem site). Com dois sites, a execução limpa de um libera o outro; a guarda de "vídeo em dia" é que é por site. Hoje há um site só. (emenda 1: S-I-1) A guarda por site ficou mais forte: pede cobertura gravada pela função nas últimas 36 horas, o que a carga da MG14 sozinha não dá.
12. **Duas redações do mesmo ritual** (esta e a da MG17, quando o plano da E18 parte 2 existir). Se uma for emendada e a outra não, o dono segue passos diferentes para a mesma coisa.
13. **(emenda 1: S-I-2) A marca do dia grava em produção um comentário na tabela do diário.** É escrita do dono, inofensiva para todo leitor, e o Apêndice D traz a linha que a retira no fim. Se a tabela já tiver comentário (CP12), ele tem de ser preservado à mão. A marca não prova que o CSV está inteiro nem que a A1 foi anotada.
14. **(emenda 1) A regra "nenhum outro `db:push:prod`" segura os outros lotes da A5 enquanto o arquivo existir.** Por isso a Tarefa 6 é do mesmo dia e o arquivo sai depois de uma recusa: o bloqueio dura horas, não dias.

### Dívida registrada

- **D1 do plano irmão (a janela repedir o buraco antigo):** não entra. O plano irmão a entregou a este "porque mexe na mesma janela"; este plano não toca `cobertura.ts` nem `diario-step.ts`. Hoje não há buraco (35 ilhas para 35 vídeos). Vai para o controlador, com a sugestão de um commit próprio depois da P3.
- **O par do item 231:** `(supabase/migrations/<carimbo>_observatorio_a5_e6_p3_apagar_linhas_vazias.sql, yt_own_video_daily)`, linha 7 da tabela de 9.2. Para a E10, se o teste nascer depois da P3. **(reconciliação 13/10: R6) Nenhum dos dois testes da E10 tem lugar para um par de arquivo:** o estático varre `.delete()` no TypeScript, e o de integração lê do catálogo as funções com `delete from` que existem no fim, e as três funções daqui são apagadas no fim do arquivo. O passo 5 da Tarefa 6 ("só se existir") não acha onde pôr o par: ele fica declarado no ledger comum, e o plano da E10 (Tarefa 10) ganhou a dívida de dizer no runbook que os apagamentos das migrations destrutivas não são vistos por teste.
- **Alarme de tamanho do diário:** depois da P3, nada no cron avisa se a tabela voltar a crescer (risco 5). O sinal de tamanho do banco é da E10 (`obs_db_size_daily`); sugerir a ela um limite para esta tabela.
- **Apagar em lotes por vídeo** (plano B da seção 5): só se o ensaio passar de 10 s.
- **O ritual comum à MG15 e à MG17** num arquivo só do runbook, quando o plano da E18 parte 2 existir.

---

## 14. Apêndices

- **Apêndice A:** SQL final da MG15 (`observatorio_a5_e6_p3_apagar_linhas_vazias`). **Não rodado.**
- **Apêndice B:** roteiro da volta A (`docs/ops/sql/dieta-diario-volta-a-restaurar-do-backup.sql`). **Não rodado.**
- **Apêndice C:** roteiro da volta B (`docs/ops/sql/dieta-diario-volta-b-recriar-da-cobertura.sql`). **Não rodado.**
- **Apêndice D:** os comandos do dono, um por linha, e a volta C.

### Apêndice A: MG15

```sql
-- =============================================================================
-- MIGRATION: Observatório A5, E6 (dieta do diário do canal próprio), parte DESTRUTIVA: P3 (MG15 do spec)
-- Spec: docs/superpowers/specs/2026-10-12-observatorio-a5/05-canal-proprio.md, seção 7.1
-- Plano: docs/superpowers/plans/2026-10-13-a5-e6-p3-apagar-linhas-vazias-do-diario-plan.md
--
-- APAGA LINHA. Vai sozinha, com o dono, depois de o leitor tolerante estar em main (o SQL não vê código:
-- isso é do portão do plano). Fora de 11:30 a 13:00 UTC. O vacuum full é um comando à parte.
--
-- O que faz:
--   0. Recusa sem a MG14, ou se o diário não tiver as 20 colunas esperadas.
--   1. yt_own_video_daily_zeros_bkp: a cópia das linhas apagadas. Sem policy, sem privilégio, sem chave estrangeira.
--   2. Três funções auxiliares (critério, contas, apagamento), sem execute para ninguém.
--   3. UMA instrução: para cada site com linha no diário, apaga as linhas vazias e cobertas, copiando-as
--      para o backup na mesma instrução, e confere as contas de antes e de depois. Qualquer prova que falhe
--      desfaz tudo. O resultado fica no comentário da tabela de backup.
--   4. Apaga as três funções.
-- Roda duas vezes sem erro quando nenhuma linha vazia ficou: na segunda não há linha vazia e nada é exigido nem
-- apagado. Se alguma ficou (regras 2 ou 4), a segunda exige de novo as guardas e pode recusar. (emenda 1: D-M-3, S-M-7)
-- Com linha vazia, exige a marca do dia no comentário do diário (o dono a põe no passo do CSV). (emenda 1: S-I-2)
-- Banco sem linha no diário (novo, CI): não faz nada e não recusa.
-- =============================================================================
set lock_timeout = '5s';
set statement_timeout = '120s';

-- ── 0. Recusas de entrada ───────────────────────────────────────────────────
do $$
declare v_cols text;
begin
  if to_regclass('public.yt_own_video_coverage') is null
     or to_regprocedure('public.yt_own_daily_apply(text,jsonb,jsonb,date[],text[])') is null then
    raise exception 'MG15 depende da MG14: public.yt_own_video_coverage ou public.yt_own_daily_apply não existe';
  end if;
  select string_agg(a.attname, ',' order by a.attnum) into v_cols
    from pg_catalog.pg_attribute a
   where a.attrelid = 'public.yt_own_video_daily'::regclass and a.attnum > 0 and not a.attisdropped;
  if v_cols is distinct from 'youtube_video_id,day_pt,site_id,video_id,channel_id,views,engaged_views,watch_time_minutes,avg_view_duration_seconds,avg_view_percentage,likes,comments,shares,subscribers_gained,subscribers_lost,card_impressions,card_click_rate,source,collected_at,metric_version' then
    raise exception 'MG15: o diário mudou de forma (colunas: %). Rever o critério e a cópia antes de apagar', v_cols;
  end if;
end $$;

-- >>> MG15 backup (início)
-- ── 1. A cópia dentro do banco ──────────────────────────────────────────────
-- Mesmas colunas do diário, na mesma ordem. Sem chave estrangeira: não entra em serie_coletada.
create table if not exists public.yt_own_video_daily_zeros_bkp (like public.yt_own_video_daily);
create unique index if not exists yt_own_video_daily_zeros_bkp_chave
  on public.yt_own_video_daily_zeros_bkp (youtube_video_id, day_pt);
alter table public.yt_own_video_daily_zeros_bkp enable row level security;
-- Nenhuma policy: ninguém lê pelo aplicativo. Só o dono do banco, até a MG16 soltar a tabela.
revoke all on table public.yt_own_video_daily_zeros_bkp from public, anon, authenticated, service_role;
-- <<< MG15 backup (fim)

-- >>> MG15 funções (início)
-- ── 2a. O critério "vazia", escrito uma vez ─────────────────────────────────
-- O mesmo de yt_own_daily_apply (MG14): views = 0 MEDIDO (nulo não é zero) e as outras oito contagens zero ou nulas.
create or replace function public.yt_own_daily_linha_vazia(d public.yt_own_video_daily)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select d.views is not null and d.views = 0
     and coalesce(d.engaged_views, 0) = 0 and coalesce(d.watch_time_minutes, 0) = 0
     and coalesce(d.likes, 0) = 0 and coalesce(d.comments, 0) = 0 and coalesce(d.shares, 0) = 0
     and coalesce(d.subscribers_gained, 0) = 0 and coalesce(d.subscribers_lost, 0) = 0
     and coalesce(d.card_impressions, 0) = 0
$$;

-- ── 2b. As contas de um site (só lê) ────────────────────────────────────────
create or replace function public.yt_own_daily_diet_p3_contas(p_site uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    't', count(*),
    'a', count(*) filter (where x.ativa),
    'vazias', count(*) filter (where x.vazia),
    'dentro_da_base', count(*) filter (where x.na_base),
    'somas', jsonb_build_object(
      'views', coalesce(sum(x.views), 0), 'engaged_views', coalesce(sum(x.engaged_views), 0),
      'watch_time_minutes', coalesce(sum(x.watch_time_minutes), 0), 'likes', coalesce(sum(x.likes), 0),
      'comments', coalesce(sum(x.comments), 0), 'shares', coalesce(sum(x.shares), 0),
      'subscribers_gained', coalesce(sum(x.subscribers_gained), 0),
      'subscribers_lost', coalesce(sum(x.subscribers_lost), 0),
      'card_impressions', coalesce(sum(x.card_impressions), 0)),
    'c_base', (select coalesce(sum(c.covered_to - c.covered_from + 1), 0)
                 from public.yt_own_video_coverage c
                where c.site_id = p_site and c.metric_set = 'base'))
  from (
    select d.views, d.engaged_views, d.watch_time_minutes, d.likes, d.comments, d.shares,
           d.subscribers_gained, d.subscribers_lost, d.card_impressions,
           public.yt_own_daily_linha_vazia(d) as vazia,
           (coalesce(d.views, 0) <> 0 or coalesce(d.engaged_views, 0) <> 0 or coalesce(d.watch_time_minutes, 0) <> 0
            or coalesce(d.likes, 0) <> 0 or coalesce(d.comments, 0) <> 0 or coalesce(d.shares, 0) <> 0
            or coalesce(d.subscribers_gained, 0) <> 0 or coalesce(d.subscribers_lost, 0) <> 0
            or coalesce(d.card_impressions, 0) <> 0) as ativa,
           exists (select 1 from public.yt_own_video_coverage c
                    where c.site_id = p_site and c.youtube_video_id = d.youtube_video_id and c.metric_set = 'base'
                      and d.day_pt between c.covered_from and c.covered_to) as na_base
      from public.yt_own_video_daily d
     where d.site_id = p_site
  ) x
$$;

-- ── 2c. Guardas, trava, apagamento com cópia, contas de novo ────────────────
-- p_agora existe para o teste escolher a hora e o dia; a migration passa now().
create or replace function public.yt_own_daily_diet_p3(p_site uuid, p_agora timestamptz)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_hora time;
  v_hoje date;
  v_dias integer; v_limpas integer; v_ultima timestamptz; v_primeiro date; v_ultimo date;
  v_videos bigint; v_em_dia bigint;
  v_antes jsonb; v_depois jsonb;
  v_vazias bigint; v_com_media bigint; v_fora_base bigint; v_fora_est bigint; v_apagadas bigint; v_guardadas bigint;
begin
  if p_site is null or p_agora is null then
    raise exception 'yt_own_daily_diet_p3: p_site e p_agora são obrigatórios' using errcode = '22023';
  end if;
  v_hora := (p_agora at time zone 'utc')::time;
  v_hoje := (p_agora at time zone 'utc')::date;

  -- (1) Sem linha vazia neste site não há o que apagar, e nenhuma guarda é exigida (banco novo, segunda aplicação).
  if not exists (select 1 from public.yt_own_video_daily d
                  where d.site_id = p_site and public.yt_own_daily_linha_vazia(d)) then
    return jsonb_build_object('site', p_site, 'estado', 'nada_a_apagar', 'apagadas', 0,
                              'linhas', (select count(*) from public.yt_own_video_daily d where d.site_id = p_site));
  end if;

  -- (2) A janela do cron das 12:00 UTC.
  if v_hora >= time '11:30' and v_hora < time '13:00' then
    raise exception 'MG15 recusada: entre 11:30 e 13:00 UTC o cron do canal próprio grava no diário (agora % UTC). Rodar fora dessa janela', v_hora;
  end if;

  -- (2b) (emenda 1: S-I-2) O ritual do CSV foi feito HOJE: o dono grava a marca no comentário do diário no passo 3.
  -- Sem isto, um arquivo que ficou pendente (recusa de outro dia) seria aplicado pelo db push de outro lote.
  if coalesce(pg_catalog.obj_description('public.yt_own_video_daily'::regclass, 'pg_class'), '')
       not like '%P3 armada em ' || to_char(v_hoje, 'YYYY-MM-DD') || '%' then
    raise exception 'MG15 recusada: o ritual do CSV não foi feito hoje (o comentário de public.yt_own_video_daily não traz "P3 armada em %"). Tirar o CSV e gravar a marca antes de aplicar',
      to_char(v_hoje, 'YYYY-MM-DD');
  end if;

  -- (3) Três execuções limpas do diário, em três dias seguidos, a última há menos de 36 horas.
  -- (emenda 1: D-I-1, S-I-1) Limpa = o coletor novo rodou (resumo.diario.apagadas é número) E COLETOU: nada ficou
  -- pendente, a função gravou cobertura (intervalos >= 1), houve tentativa ok, nenhuma tentativa de falha, nenhum
  -- vídeo atrasado antigo, estendidas não recusadas; e nenhuma nota do diário, da cobertura nem de leitura de
  -- youtube_videos ficou em falhas. apagadas sozinho não prova nada: nasce em 0 em toda saída do passo.
  -- Campo ausente ou em outro formato = não limpa (nunca erro de conversão). Vale a última execução de cada dia (UTC).
  with por_dia as (
    select distinct on ((r.ran_at at time zone 'utc')::date)
           (r.ran_at at time zone 'utc')::date as dia, r.ran_at,
           (coalesce(jsonb_typeof(j.d->'apagadas') = 'number', false)
            and coalesce(j.d->'pendentes' = '0'::jsonb, false)
            and coalesce(j.d->'atrasados_antigos' = '0'::jsonb, false)
            and coalesce(j.d->'estendidas_recusadas' = '0'::jsonb, false)
            and coalesce(case when jsonb_typeof(j.d->'intervalos') = 'number'
                              then (j.d->>'intervalos')::numeric >= 1 end, false)
            and coalesce(case when jsonb_typeof(j.d->'tentativas'->'ok') = 'number'
                              then (j.d->'tentativas'->>'ok')::numeric >= 1 end, false)
            and not coalesce(j.d->'tentativas' ?| array['sem_autorizacao', 'sem_conexao', 'nao_alcancado_orcamento',
                                                         'erro_http', 'schema_ausente'], true)
            and not exists (select 1 from unnest(r.falhas) as f
                             where f like 'diário:%' or f like 'diario:%'
                                or f like '%yt_own_video_coverage%' or f like '%yt_own_daily_apply%'
                                or f like '%cobertura%' or f like '%youtube_videos%')) as limpa
      from public.yt_own_collection_runs r
     cross join lateral (select r.resumo->'diario' as d) j
     where r.ran_at <= p_agora and r.ran_at > p_agora - interval '10 days'
     order by (r.ran_at at time zone 'utc')::date desc, r.ran_at desc
  ), ultimas as (
    select p.dia, p.ran_at, p.limpa from por_dia p order by p.dia desc limit 3
  )
  select count(*), count(*) filter (where u.limpa), max(u.ran_at), min(u.dia), max(u.dia)
    into v_dias, v_limpas, v_ultima, v_primeiro, v_ultimo
    from ultimas u;
  if v_dias < 3 or v_limpas < 3 or (v_ultimo - v_primeiro) <> 2 or v_ultima <= p_agora - interval '36 hours' then
    raise exception 'MG15 recusada: preciso de 3 execuções limpas do diário em 3 dias seguidos, a última há menos de 36 horas (achei % dia(s), % limpa(s), de % a %, a última em %)',
      v_dias, v_limpas, v_primeiro, v_ultimo, v_ultima;
  end if;

  -- (4) A coleta nova está viva para ESTE site: algum vídeo dele com cobertura base até hoje − 5 (UTC),
  -- gravada nas últimas 36 horas. (emenda 1: S-I-1) A carga da MG14 grava collected_at uma vez só; quem renova
  -- é yt_own_daily_apply. Cobertura em dia com collected_at antigo = a função nova nunca gravou para este site.
  -- (emenda 1: D-M-9) hoje − 5 em UTC é de propósito um dia mais folgado que a CP4 do portão (current_date − 4).
  select count(*),
         count(*) filter (where exists (select 1 from public.yt_own_video_coverage c
                                         where c.site_id = p_site and c.youtube_video_id = v.youtube_video_id
                                           and c.metric_set = 'base' and c.covered_to >= v_hoje - 5
                                           and c.collected_at > p_agora - interval '36 hours'))
    into v_videos, v_em_dia
    from public.youtube_videos v
   where v.site_id = p_site;
  if v_em_dia = 0 then
    raise exception 'MG15 recusada: nenhum vídeo do site % com cobertura em dia e gravada nas últimas 36 horas (% vídeo(s) cadastrado(s)). A coleta nova está rodando?', p_site, v_videos;
  end if;

  -- (5) Ninguém grava no diário enquanto as contas são feitas. Quem lê não espera.
  lock table public.yt_own_video_daily in share row exclusive mode;

  v_antes := public.yt_own_daily_diet_p3_contas(p_site);

  -- (6) Apaga e copia NA MESMA INSTRUÇÃO: só entra no backup o que saiu, e só sai o que entra no backup.
  -- A linha sai se: é vazia; não tem média nem taxa; o dia está na cobertura base do vídeo, neste site;
  -- e as estendidas ou nunca foram medidas ou o dia está na cobertura estendidas.
  with vazias as materialized (
    select d.youtube_video_id, d.day_pt,
           -- >>> MG15 regra 2 (início)  (emenda 1: D-I-2: texto padrão; a variante Z está logo abaixo do bloco)
           (d.avg_view_duration_seconds is not null or d.avg_view_percentage is not null
            or d.card_click_rate is not null) as com_media,
           -- <<< MG15 regra 2 (fim)
           exists (select 1 from public.yt_own_video_coverage c
                    where c.site_id = p_site and c.youtube_video_id = d.youtube_video_id and c.metric_set = 'base'
                      and d.day_pt between c.covered_from and c.covered_to) as na_base,
           ((d.engaged_views is null and d.card_impressions is null)
            or exists (select 1 from public.yt_own_video_coverage c
                        where c.site_id = p_site and c.youtube_video_id = d.youtube_video_id
                          and c.metric_set = 'estendidas'
                          and d.day_pt between c.covered_from and c.covered_to)) as est_ok
      from public.yt_own_video_daily d
     where d.site_id = p_site and public.yt_own_daily_linha_vazia(d)
  ), sai as (
    delete from public.yt_own_video_daily d
     using vazias v
     where d.youtube_video_id = v.youtube_video_id and d.day_pt = v.day_pt
       and d.site_id = p_site
       and v.na_base and not v.com_media and v.est_ok
    returning d.youtube_video_id, d.day_pt, d.site_id, d.video_id, d.channel_id,
              d.views, d.engaged_views, d.watch_time_minutes, d.avg_view_duration_seconds, d.avg_view_percentage,
              d.likes, d.comments, d.shares, d.subscribers_gained, d.subscribers_lost,
              d.card_impressions, d.card_click_rate, d.source, d.collected_at, d.metric_version
  ), guardado as (
    insert into public.yt_own_video_daily_zeros_bkp as b
      (youtube_video_id, day_pt, site_id, video_id, channel_id,
       views, engaged_views, watch_time_minutes, avg_view_duration_seconds, avg_view_percentage,
       likes, comments, shares, subscribers_gained, subscribers_lost,
       card_impressions, card_click_rate, source, collected_at, metric_version)
    select s.youtube_video_id, s.day_pt, s.site_id, s.video_id, s.channel_id,
           s.views, s.engaged_views, s.watch_time_minutes, s.avg_view_duration_seconds, s.avg_view_percentage,
           s.likes, s.comments, s.shares, s.subscribers_gained, s.subscribers_lost,
           s.card_impressions, s.card_click_rate, s.source, s.collected_at, s.metric_version
      from sai s
    on conflict (youtube_video_id, day_pt) do update set
      site_id = excluded.site_id, video_id = excluded.video_id, channel_id = excluded.channel_id,
      views = excluded.views, engaged_views = excluded.engaged_views,
      watch_time_minutes = excluded.watch_time_minutes,
      avg_view_duration_seconds = excluded.avg_view_duration_seconds,
      avg_view_percentage = excluded.avg_view_percentage,
      likes = excluded.likes, comments = excluded.comments, shares = excluded.shares,
      subscribers_gained = excluded.subscribers_gained, subscribers_lost = excluded.subscribers_lost,
      card_impressions = excluded.card_impressions, card_click_rate = excluded.card_click_rate,
      source = excluded.source, collected_at = excluded.collected_at, metric_version = excluded.metric_version
    returning 1
  )
  select (select count(*) from vazias),
         (select count(*) from vazias z where z.com_media),
         (select count(*) from vazias z where not z.na_base),
         (select count(*) from vazias z where z.na_base and not z.com_media and not z.est_ok),
         (select count(*) from sai),
         (select count(*) from guardado)
    into v_vazias, v_com_media, v_fora_base, v_fora_est, v_apagadas, v_guardadas;

  -- (7) Linha vazia fora da cobertura base é estado desconhecido da P2: desfaz tudo.
  if v_fora_base > 0 then
    raise exception 'MG15 desfeita: % linha(s) vazia(s) fora da cobertura base no site %. Nada foi apagado', v_fora_base, p_site;
  end if;

  -- (8) As contas de depois têm de fechar com as de antes.
  v_depois := public.yt_own_daily_diet_p3_contas(p_site);
  if v_guardadas <> v_apagadas
     or v_vazias <> (v_antes->>'vazias')::bigint
     or (v_depois->>'t')::bigint <> (v_antes->>'t')::bigint - v_apagadas
     or (v_depois->>'a')::bigint <> (v_antes->>'a')::bigint
     or (v_depois->>'vazias')::bigint <> (v_antes->>'vazias')::bigint - v_apagadas
     or (v_depois->>'dentro_da_base')::bigint <> (v_antes->>'dentro_da_base')::bigint - v_apagadas
     or (v_depois->>'c_base')::bigint <> (v_antes->>'c_base')::bigint
     or (v_depois->'somas') <> (v_antes->'somas') then
    raise exception 'MG15 desfeita: as contas não fecham (apagadas %, guardadas %, vazias %; antes %; depois %). Nada foi apagado',
      v_apagadas, v_guardadas, v_vazias, v_antes, v_depois;
  end if;

  return jsonb_build_object(
    'site', p_site, 'estado', case when v_apagadas > 0 then 'apagado' else 'nada_apagado' end,
    'agora', p_agora, 'ultima_execucao', v_ultima, 'videos', v_videos, 'videos_em_dia', v_em_dia,
    'vazias', v_vazias, 'apagadas', v_apagadas,
    'ficaram_com_media', v_com_media, 'ficaram_fora_das_estendidas', v_fora_est,
    'antes', v_antes, 'depois', v_depois);
end $$;

revoke all on function public.yt_own_daily_linha_vazia(public.yt_own_video_daily) from public, anon, authenticated, service_role;
revoke all on function public.yt_own_daily_diet_p3_contas(uuid) from public, anon, authenticated, service_role;
revoke all on function public.yt_own_daily_diet_p3(uuid, timestamptz) from public, anon, authenticated, service_role;
-- <<< MG15 funções (fim)

-- ── 3. O apagamento: UMA instrução, tudo ou nada ────────────────────────────
do $$
declare
  v_site uuid;
  v_r jsonb;
  v_tudo jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_sites integer := 0;
begin
  for v_site in select distinct d.site_id from public.yt_own_video_daily d order by 1 loop
    v_sites := v_sites + 1;
    v_r := public.yt_own_daily_diet_p3(v_site, now());
    v_tudo := v_tudo || jsonb_build_array(v_r);
    v_total := v_total + (v_r->>'apagadas')::bigint;
    raise notice 'MG15: %', v_r;
  end loop;
  if v_sites = 0 then
    raise notice 'MG15: diário sem linhas, nada a fazer';
  end if;
  if v_total > 0 then
    execute format('comment on table public.yt_own_video_daily_zeros_bkp is %L',
      'MG15 ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || ' ' || v_tudo::text);
  end if;
end $$;

-- ── 4. Nada que apaga fica no banco ─────────────────────────────────────────
drop function if exists public.yt_own_daily_diet_p3(uuid, timestamptz);
drop function if exists public.yt_own_daily_diet_p3_contas(uuid);
drop function if exists public.yt_own_daily_linha_vazia(public.yt_own_video_daily);

analyze public.yt_own_video_daily;
-- O vacuum full NÃO vai aqui (não roda dentro de transação): é o passo 7 do ritual, do dono.
```

**Variante Z da regra 2 (emenda 1: D-I-2). Não rodada.** Entra no lugar do trecho entre as marcas `-- >>> MG15 regra 2 (início)` e `-- <<< MG15 regra 2 (fim)`, **só** se o dono responder "apaga" à pergunta 3 sobre os números da CP2; nenhuma outra linha do arquivo muda. Com ela, `com_media` (e o campo `ficaram_com_media` do retorno) passa a contar só a linha vazia com média ou taxa **diferente de zero**.

```sql
           -- >>> MG15 regra 2 (início)  (variante Z: média ou taxa nula OU ZERO sai; diferente de zero fica)
           (coalesce(d.avg_view_duration_seconds, 0) <> 0 or coalesce(d.avg_view_percentage, 0) <> 0
            or coalesce(d.card_click_rate, 0) <> 0) as com_media,
           -- <<< MG15 regra 2 (fim)
```

Na Tarefa 6 o arquivo de migration leva **uma** das duas formas, a que o dono escolheu, anotada no ledger; o teste da Tarefa 1 monta as duas a partir do arquivo, qualquer que seja a que está nele, e roda os casos de cada uma.

**Índices que as instruções usam.** O `delete` casa pela chave primária do diário `(youtube_video_id, day_pt)`; o `insert … on conflict` usa o índice único novo do backup; as consultas à cobertura usam a chave primária dela `(youtube_video_id, metric_set, covered_from)`. Nenhum índice novo no diário.

### Apêndice B: volta A, restaurar do backup

```sql
-- Volta A da dieta do diário (P3): devolve ao diário as linhas que a MG15 apagou. Vale até a MG16 soltar o backup.
-- Uma instrução. Roda duas vezes sem erro. Não passa por cima de dia que ganhou linha depois.
-- video_id de vídeo que não existe mais volta nulo (a chave do diário é "on delete set null").
insert into public.yt_own_video_daily
  (youtube_video_id, day_pt, site_id, video_id, channel_id,
   views, engaged_views, watch_time_minutes, avg_view_duration_seconds, avg_view_percentage,
   likes, comments, shares, subscribers_gained, subscribers_lost,
   card_impressions, card_click_rate, source, collected_at, metric_version)
select b.youtube_video_id, b.day_pt, b.site_id,
       case when exists (select 1 from public.youtube_videos v where v.id = b.video_id) then b.video_id end,
       b.channel_id,
       b.views, b.engaged_views, b.watch_time_minutes, b.avg_view_duration_seconds, b.avg_view_percentage,
       b.likes, b.comments, b.shares, b.subscribers_gained, b.subscribers_lost,
       b.card_impressions, b.card_click_rate, b.source, b.collected_at, b.metric_version
  from public.yt_own_video_daily_zeros_bkp b
on conflict (youtube_video_id, day_pt) do nothing;
```
Depois: a A1 de novo; `t` tem de ser o `t` de antes da P3 (mais o que o cron gravou desde então).

### Apêndice C: volta B, recriar os zeros a partir da cobertura

```sql
-- Volta B da dieta do diário: recria uma linha de zero para cada dia coberto (conjunto base) que não tem linha.
-- Serve quando o backup já foi solto (MG16), ou quando for preciso voltar a um leitor que não lê a cobertura.
-- Equivalente para todo leitor (views 0, dia medido); NÃO é a linha original (collected_at é o de agora;
-- as contagens da base voltam em zero; as estendidas só onde o dia está na cobertura estendidas).
-- Trocar <UUID_DO_SITE> pelo uuid do site. Uma instrução. Roda duas vezes sem erro.
insert into public.yt_own_video_daily
  (youtube_video_id, day_pt, site_id, video_id, channel_id,
   views, engaged_views, watch_time_minutes, likes, comments, shares, subscribers_gained, subscribers_lost,
   card_impressions, source, collected_at, metric_version)
select c.youtube_video_id, g.dia, c.site_id,
       case when exists (select 1 from public.youtube_videos v where v.id = c.video_id) then c.video_id end,
       c.channel_id,
       0, e.zero, 0, 0, 0, 0, 0, 0,
       e.zero, 'analytics_api', now(),
       case when g.dia < date '2025-03-31' then 'views_ate_2025-03-30'
            when g.dia < date '2026-08-27' then 'views_2025-03-31_a_2026-08-26'
            else 'views_desde_2026-08-27' end
  from public.yt_own_video_coverage c
 cross join lateral (select s::date as dia
                       from generate_series(c.covered_from::timestamp, c.covered_to::timestamp, interval '1 day') s) g
 cross join lateral (select case when exists (select 1 from public.yt_own_video_coverage x
                                               where x.site_id = c.site_id and x.youtube_video_id = c.youtube_video_id
                                                 and x.metric_set = 'estendidas'
                                                 and g.dia between x.covered_from and x.covered_to)
                                 then 0::bigint end as zero) e
 where c.site_id = '<UUID_DO_SITE>'::uuid and c.metric_set = 'base'
on conflict (youtube_video_id, day_pt) do nothing;
```

### Apêndice D: os comandos do dono, um por linha

Todos "(você roda)". `AAAAMMDD` é o dia. A URL é a "Session pooler" do painel do Supabase (Connect), com a senha do banco; ela não vai para arquivo nenhum.

Antes da migration (passo 3 do ritual):

```bash
mkdir -p ~/Workspace/arquivo-observatorio/dieta-diario
```
```bash
cd ~/Workspace/arquivo-observatorio/dieta-diario
```
```bash
read -s PGURL
```
```bash
psql "$PGURL" -c "\copy (select * from public.yt_own_video_daily order by youtube_video_id, day_pt) to 'yt_own_video_daily-AAAAMMDD.csv' csv header"
```
```bash
wc -l yt_own_video_daily-AAAAMMDD.csv
```
```bash
shasum -a 256 yt_own_video_daily-AAAAMMDD.csv > yt_own_video_daily-AAAAMMDD.csv.sha256
```
O número do `wc -l` menos 1 (o cabeçalho) tem de ser o `t` da A1.

Linha 7, **a marca do dia** (emenda 1: S-I-2), logo depois do CSV e no mesmo terminal. A data sai do comando, em UTC. Se a CP12 tiver achado comentário na tabela, o texto antigo vai antes da marca, dentro das mesmas aspas simples:

```bash
psql "$PGURL" -c "comment on table public.yt_own_video_daily is 'P3 armada em $(date -u +%F)'"
```
Sem esta linha, ou com ela feita em outro dia (UTC), a migration recusa com "o ritual do CSV não foi feito hoje" e nada muda.

A migration (passo 5), na pasta do repositório:

```bash
npm run db:push:prod
```

O `vacuum full` (passo 7), no mesmo terminal em que `PGURL` foi lida:

```bash
psql "$PGURL" -c "set lock_timeout = '5s'" -c "vacuum (full, analyze) public.yt_own_video_daily"
```
Retirar a marca do dia (emenda 1: S-I-2), depois da V7; se a CP12 tiver achado comentário antigo, gravar o texto antigo no lugar de `null`:

```bash
psql "$PGURL" -c "comment on table public.yt_own_video_daily is null"
```
```bash
unset PGURL
```
Se a conexão recusar o `vacuum full`: a mesma instrução, sozinha, no SQL Editor do painel (`vacuum (full, analyze) public.yt_own_video_daily;`).

**Linha de reserva: o CSV ficou incompleto e a migration já rodou.** O diário e o backup juntos são a tabela de antes:

```bash
psql "$PGURL" -c "\copy (select * from public.yt_own_video_daily union all select * from public.yt_own_video_daily_zeros_bkp order by 1, 2) to 'yt_own_video_daily-AAAAMMDD-refeito.csv' csv header"
```

**Volta C: restaurar do CSV** (três linhas, na ordem; depois a A1):

```bash
psql "$PGURL" -c "create table public.yt_own_video_daily_csv_tmp (like public.yt_own_video_daily)" -c "alter table public.yt_own_video_daily_csv_tmp enable row level security" -c "revoke all on table public.yt_own_video_daily_csv_tmp from public, anon, authenticated, service_role"
```
```bash
psql "$PGURL" -c "\copy public.yt_own_video_daily_csv_tmp from 'yt_own_video_daily-AAAAMMDD.csv' csv header"
```
```bash
psql "$PGURL" -c "insert into public.yt_own_video_daily select t.youtube_video_id, t.day_pt, t.site_id, case when exists (select 1 from public.youtube_videos v where v.id = t.video_id) then t.video_id end, t.channel_id, t.views, t.engaged_views, t.watch_time_minutes, t.avg_view_duration_seconds, t.avg_view_percentage, t.likes, t.comments, t.shares, t.subscribers_gained, t.subscribers_lost, t.card_impressions, t.card_click_rate, t.source, t.collected_at, t.metric_version from public.yt_own_video_daily_csv_tmp t on conflict (youtube_video_id, day_pt) do nothing" -c "drop table public.yt_own_video_daily_csv_tmp"
```
A volta C é ensaiada no banco local pela Tarefa 3 (a recarga do CSV de dentro da transação); contra produção nunca foi rodada.
