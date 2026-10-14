# A5, ordem 16: E4, medidas e marcas (plano de implementação)

Escrito em 13/10/2026. Spec: `docs/superpowers/specs/2026-10-12-observatorio-a5/04-medidas-telas-e-mockups.md`, seção 5 (medidas M1 a M10 e as marcas), `02-comentarios-de-destaque.md`, 4.6.8 (M11 e M12), e `00-indice-decisoes-e-sequencia.md` (itens de aceite 27 a 32, 54, 55, 124, 245 a 247; riscos 5, 6, 7, 11 e 22; pergunta 6). Migration: **MG4**. Fatos levantados antes: `.superpowers/sdd/a5-planos-onda-2/e4-medidas-e-marcas/fatos.md` (conferi no código o que decide o desenho; o que não conferi está dito). Ledger da execução: `.superpowers/sdd/a5-e4/progress.md`.

**Objetivo, em três frases.** Escrever as medidas M1 a M12 do Observatório como funções puras que devolvem "medido, com valor, tamanho da amostra e janela" ou "não medido, com o motivo", nunca nulo solto e nunca zero por falta. Gravar uma vez, quando a idade do vídeo fecha, as views (e curtidas e comentários) nas idades de 1, 7 e 30 dias numa tabela pequena que fica no banco para sempre, e registrar o motivo quando a marca não pôde ser medida. Entregar os leitores de servidor e o montador que as telas (E5), o Cowork (E7) e o export (E10) vão consumir, sem mudar nenhum número que as telas mostram hoje.

**Fica FORA deste plano.**
- **Toda tela** (E5, com mockup aprovado): nenhuma frase de tela, nenhuma cor, nenhum componente. Daqui saem estados e códigos de motivo; a frase é da E5. O texto obrigatório de M10 sai como constante, para a E5 usar (item 56 é dela).
- **M13 e M14** (ordem 13) e o canal próprio (a E4 é só de concorrentes).
- **O Cowork e a forja** (E7): nenhuma rota em `api/pipeline/`, nada em `api-registry.ts`, `apps/web/data/pipeline-docs/` nem `docs/cowork-*`.
- **O export e a recusa de arquivar** (E10, item 77): este plano entrega o que ela consulta (seção 4.6) e não escreve a recusa.
- **Mudar o motor atual**: `viewsAtAge`, `multiplierAt`, `channelStats`, `cadence`, `engagementOf`, `load.ts`, `pack.ts` e `PACK_VERSION` não são tocados. As medidas novas são funções novas, em arquivos novos.
- **Trocar a regra de "parado" das telas** (`PAUSED_AFTER_DAYS = 30`): a E4 entrega o estado de M8; quem troca o que a tela mostra é a E5.
- **Recriar `competitor_channel_removal_impact`** para contar marcas (seção 13, dívida 1).

**Emenda do portão.** Ainda não houve portão.

**Emenda 1 (13/10/2026, resposta aos pareceres da rodada 1; uma linha por achado em `.superpowers/sdd/a5-planos-onda-2/e4-medidas-e-marcas/resposta-r1.md`).** Cada trecho mudado está marcado "(emenda 1: <id>)"; os ids com `d:` são do parecer de dados e os com `s:` do de software. O que mudou, do mais pesado ao mais leve:
1. **Vídeo agendado ou no ar não tem idade, e base que anda refaz o par** (d:C-1, s:m5). As três funções da MG4 passam a deixar de fora `live_broadcast_content in ('upcoming', 'live')`, como a MG8; marca ou motivo gravado com uma base que depois mudou é apagado e refeito pela série; a prova ganha `base_divergente`. O Apêndice A mudou, o roteiro do Apêndice B ganhou o cenário S11 e foi rodado de novo, duas vezes (Apêndice C novo).
2. **A folga de 2 dias (Tarefa 12) vira envio próprio, com data limite 30/10/2026**, sem depender da Tarefa 1, da MG4, da agenda nem do Lote B (d:I-1, s:I3). A constante mora em `RULES.series`. **(reconciliação 13/10, emenda 1: D-C1, S-I1) "Envio próprio" não é um `git push` do `staging` local: em 13/10 ele está 321 commits à frente de `origin/staging` e leva código que lê MG14, MG5 e MG7, que não estão em produção. O caminho está escrito no "Envio" da Tarefa 12.**
3. **O lote da E4 vai depois do Lote B, inteiro** (s:I4); a frase "pode ir sem a Tarefa 11" saiu.
4. **A tarefa da agenda tem `ordem: 5.5`** (a 3 é de `soma_do_mapa`) e **`naoTerminouVermelhoEm: null`** (o campo conta disparos seguidos no mesmo dia, não dias) (s:I2, d:I-2, s:I1).
5. **Marca perdida por buraco na coleta deixa o disparo vermelho uma vez**, com o número (`marcas_perdidas`), e os motivos vão separados por código para o detalhe da execução (d:I-3, s:m8).
6. **O motivo só é definitivo 1 hora depois do limite**, e o banco confere (d:m-1, s:m4).
7. Os menores: d:m-2 a d:m-8 e s:m1 a s:m7, cada um no seu lugar.

**Emenda 2 (13/10/2026, resposta aos pareceres da rodada 2; uma linha por achado em `.superpowers/sdd/a5-planos-onda-2/e4-medidas-e-marcas/resposta-r2.md`).** Cada trecho mudado está marcado "(emenda 2: <id>)"; `d:` é o parecer de dados e `s:` o de software. O que mudou, do mais pesado ao mais leve:
1. **A segunda tabela da MG4 tem de estar no registro do export da MG6** (d:I-R2-1). O plano da E10 só conhece `competitor_video_marks`; com as duas migrations aplicadas, o export e a remoção de canal recusariam. Este plano não edita o da E10: pede a entrada ao controlador (seção 0.1), ganha a consulta V5 e um teste, e diz a saída de reserva.
2. **O aviso `marcas_perdidas` deixa de mentir e de repetir** (s:n1, s:n3, d:m-3, d:m-8): o número sai separado por idade; só as idades 7 e 30 deixam o disparo vermelho (a idade 1 fica no detalhe até a `e4-d7` medir); a perda já avisada não é anunciada de novo numa reabertura por `ruleVersion`; e o número das perdas se lê na tabela de motivos, não no detalhe da agenda, que é sobrescrito (d:m-1, s:n2).
3. **Três condições novas no SQL** (d:m-2, d:m-5, d:m-6): quem grava devolve a base que recebeu e o banco confere; a prova não conta vídeo sem data; a linha de vídeo que passou a agendado ou no ar é apagada. `pending` devolve a faixa do vídeo e o motivo anterior do par. Apêndice A mudado, roteiro com o cenário S12, rodado duas vezes (Apêndice C novo).
4. **A Tarefa 12 é "o quanto antes"; 30/10 é só o teto** (d:m-4): os vídeos de setembro fora dos N mais recentes estão perdendo V30 a cada dia.
5. **Vídeo agendado sai das medidas de hoje** (d:m-7, que fecha a dívida 8).
6. Os menores de texto: d:m-9, s:n4, s:n5.

**Foco de revisão** (o que atacar primeiro): (1) a regra "sem palpite" de M1 e os seis motivos de falta, incluída a hora em que um motivo vira definitivo (4.2); (2) quem grava a marca: tarefa leve nova na agenda, com duas idas ao banco (4.3); (3) a folga de 2 dias na faixa diária, sem a qual a marca de 30 dias nunca existe para vídeo fora dos N mais recentes (4.4); (4) a prova `competitor_marks_health` nos dois sentidos (Apêndice A, seção 5); (5) a base da idade igual à da MG8 (estreia); (6) os leitores que não podem devolver lista vazia quando a leitura falhou (Tarefa 13).

---

## 0. Dependências duras (ler antes de tudo)

### 0.1 O que este plano usa de outras etapas (conferido contra o texto real)

| O que uso | Forma exata, lida onde | Onde uso |
|---|---|---|
| `competitor_video_daily` | `video_id`, `snap_date`, `views bigint not null`, `likes`, `comments`, `taken_at`; chave `(video_id, snap_date)`; **sem `site_id`** (`supabase/migrations/20261003000002_observatorio_versoes.sql`, citado em `fatos.md` 2.3). Uma leitura por dia de São Paulo: `upsert(..., { ignoreDuplicates: true })` (`apps/web/src/lib/youtube/competitor-sync.ts:862`), `taken_at` = hora real da leitura | vizinhas das idades 7 e 30; M2, M5, M9 |
| `competitor_video_early` (MG2, em produção) | `video_id`, `taken_at`, `site_id`, `views not null`, `likes`, `comments`; chave `(video_id, taken_at)` (`20261012000003_observatorio_a5_e2_serie_faixas.sql:31-43`). Hoje **nenhum leitor** | vizinhas da idade 1 |
| `competitor_videos` (MG1, em produção) | `published_at`, `live_actual_start_at`, `was_live`, `is_short`, `discovered_at`, `views_hidden`, `likes_hidden`, `comments_disabled`, `missing_since`, `view_count`, `like_count`, `comment_count`, `last_checked_at`, `series_tier`; **sem `site_id`** (o site vem de `competitor_channel_id → competitor_channels.site_id`) | a base da idade; os sinalizadores; os insumos |
| A base da idade da MG8 | `greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at))` (`20261013000003_observatorio_a5_e14_comentarios_destaque.sql:235, 515, 561`); o plano da E14, desvio 3, manda a E4 usar a mesma | Apêndice A; `baseDaIdade` (Tarefa 2) |
| `competitor_channel_snapshots` | `competitor_channel_id`, `snapshot_date`, `view_count`, `subscriber_count`, `video_count` (anuláveis), `subscribers_hidden`; **sem `site_id`** (lido no banco local em 13/10) | M3(a), M8 |
| Tabelas da MG8 (aplicada em produção, código local) | `competitor_video_comment_snaps (video_id, mark, status, …)` lida por `can_view_site`; `competitor_video_comments (video_id, parent_id, creator_replied, …)` e `competitor_video_comment_marks (comment_id, mark, likes, …)` lidas por `can_view_private_site` ou `can_edit_site` | M11, M12 |
| A agenda (Lote B, **só local**) | `agenda/definicoes.ts` (`Definicao`, `TODAS_AS_DEFINICOES`), `agenda/catalogo.ts` (`CATALOGO`), `agenda/tipos.ts` (`Tarefa`, `ResultadoTarefa`, `ContextoTarefa`), `agenda/relogio.ts` (`BANCO_MS = 5_000`, `LEVE_COMECA_ATE_MS = 75_000`, `LEVE_FIM_MS = 90_000`), `OBS_AGENDA_TASKS_OFF` | a tarefa `marcas_de_idade` (Tarefa 11) |
| `EdicaoDoSite` (A4, **só local**) | `observatorio/proprio/edicao.ts`: token que só nasce depois de `requireSiteScope({ mode: 'edit' })` | o leitor dos insumos de comentários (Tarefa 15) |
| `RULES` | `observatorio/rules.ts`: `outlierMin: 2`, `weakBase: 3`, `medianMinN: 5`, `habit.weeks: 13`, `series.dailyAgeDays: 30`, `series.weeklyMaxGapDays: 8` | os limiares que já existem |

**Três dependências que não são de arquivo.**
1. **O Lote B em produção** (E16 parte 1: a agenda). A marca é gravada por uma tarefa da agenda; sem a agenda no ar a tarefa não tem quem a dispare. Nada se perde na espera (a série fica online e a tarefa recupera o atraso sozinha), mas nenhuma marca é gravada. **(emenda 1: s:I4) O lote da E4 vai DEPOIS do Lote B, inteiro.** A frase anterior ("as Tarefas 1 a 8, 10 e 12 a 14 não dependem disso") valia para escrever e testar o código na árvore local, não para enviar: conferido em 13/10, `git ls-tree origin/staging apps/web/src/lib/youtube/agenda/` devolve vazio (a Tarefa 10 importa `BANCO_MS` de `agenda/relogio.ts`, que não existe no remoto) e `rules.ts` local tem 8 linhas do Lote B logo abaixo de onde a Tarefa 1 escreve. O que cada tarefa importa de código que só existe local: Tarefa 1, `rules.ts` com as linhas `hourly` e `comments` (Lote B); Tarefa 10, `agenda/relogio.ts` (Lote B); Tarefa 11, `agenda/**` (Lote B); Tarefa 15, `proprio/edicao.ts` (A4). `stats.ts` difere do remoto em 15 linhas, mas `median(a: number[]): number | null` tem a mesma assinatura nos dois (conferido). **A única peça que vai antes é a Tarefa 12**, que só toca arquivos iguais aos do remoto (ver a Tarefa 12).
2. **A A4 em `staging`** para a Tarefa 15 (ela importa `proprio/edicao.ts`). Até lá, M11 e M12 existem como função pura e sem leitor.
3. **O arquivo da MG6** (E10), se ela for no mesmo lote: o arquivo da MG4 é criado **depois** do da MG6 (o carimbo do `db:new` tem de ser posterior). **(emenda 2: d:I-R2-1) A frase anterior ("as duas não se tocam em SQL") estava errada.** A MG4 cria **duas** tabelas com cascata para `competitor_videos`; o registro do export (`obs_archive_registry()`, MG6) tem de conhecer as duas, e o plano da E10 só tem `competitor_video_marks` (conferido em 13/10: `grep -n "mark_misses" docs/superpowers/plans/2026-10-13-a5-e10-export-pausa-e-sinal-de-limite-plan.md` devolve zero linhas; a entrada da linha 1410 foi escrita a partir do DDL do spec, que tem uma tabela só). `obs_archive_uncovered()` percorre toda chave em cascata a partir de `competitor_channels` (linhas 1450 a 1470 do plano da E10) e é chamada antes de registrar lote e antes de remover canal arquivado (linhas 1536 e 1701): com as duas migrations aplicadas e sem a entrada, ela devolve `{competitor_video_mark_misses}`, o export recusa com `tabela_sem_export`, a remoção de canal arquivado recusa, e a linha "arquivo: 1 tabela(s) sem export" sai em `acao_do_dono` a cada disparo. V1 a V4 daqui ficariam verdes.
   - **Pedido ao controlador (o arquivo é de outra etapa; este plano não o edita):** levar ao plano da E10 a 21ª entrada do registro, com a V2 de lá esperando `21` **(reconciliação 13/10: R1: atendido. O Apêndice A do plano da E10 ganhou esta entrada e a da tabela da E9; a V2 de lá espera `22`. Ainda não rodado)**:
     ```sql
         ('competitor_video_mark_misses',
          't.video_id in (select v.id from public.competitor_videos v where v.competitor_channel_id = $1)',
          null, null, 't.video_id, t.age_days'),
     ```
   - **Saída de reserva, só se a MG6 já estiver aplicada em produção com 20 entradas quando o arquivo da MG4 for escrito:** a MG4 recria `obs_archive_registry()` no fim do próprio arquivo, a partir do corpo vigente (copiado do arquivo da MG6, não deste plano) mais a entrada acima; é a regra da linha 452 do plano da E10. **Esse SQL não está no Apêndice A e não foi rodado** (o corpo da MG6 ainda não é final); nessa forma a MG4 exige a MG6 antes, e a prova é a V5 mais o teste novo da Tarefa 9. **(reconciliação 13/10: R1)** Com a entrada já no plano da E10, esta saída só vale se a MG6 tiver sido aplicada **sem** ela. Nesse caso o corpo parte do que está instalado (`pg_get_functiondef`), não de cópia de plano, e vai numa migration corretiva **única** para as tabelas da E4 e da E9 (uma recriação na MG4 e outra na migration da E9, feitas de cópias diferentes, apagariam a entrada uma da outra).
   - **Em qualquer das duas formas, quem confere é a V5** (seção 2), depois de aplicar.
   - **(reconciliação 13/10: R3) Canal com a coleta pausada: contrato da E10 que este plano não cumpria. O SQL e o TypeScript abaixo NÃO estão no Apêndice A nem nas tarefas, e NÃO foram rodados; fecham-se nas Tarefas 1, 4, 9 e 13 e voltam aos dois especialistas na revisão da implementação.** **(reconciliação 13/10, emenda 1: D-I1, S-I2) Passaram a estar nas tarefas: o SQL na Tarefa 8b (nova, bloqueia a 9), o estado na Tarefa 4, o escritor na Tarefa 10 e `collectionPausedAt` na Tarefa 13; o Apêndice A continua sendo o texto rodado SEM a pausa até a 8b fechar.** O plano da E10 (linha 456 de lá) pede que nenhuma tarefa grave linha de canal com `competitor_channels.collection_paused_at` preenchido (a remoção por arquivo compara a contagem do banco com a do manifesto e recusaria), e deixa para este plano o "não medido: coleta pausada" (linha 12 de lá). Sem isso, um canal que o dono pausou de propósito daria `leitura_parou_antes` com o vídeo no ar e a série anterior ao alvo, isto é, `marcas_perdidas` vermelho (seção 6.1); e M8 diria `parado` contando dias em que ninguém leu o canal. Quatro mudanças: (1) **a MG4 exige a MG6 aplicada antes** (guarda na primeira instrução: a coluna `collection_paused_at` existe; senão recusa com "MG4 depende da MG6"); (2) `competitor_marks_pending` e a contagem `atrasadas` da prova deixam de fora o vídeo de canal pausado: o par fica pendente, sem marca e sem motivo, enquanto a pausa durar (nada se perde: a série continua online); (3) depois de despausar vale a decisão normal, e o par cujo intervalo sem leitura cruza uma linha de `competitor_collection_pauses` grava o motivo que aconteceu, mas **não** conta em `perdidas`: conta em `pausadas`, no detalhe; (4) `MotivoNaoMedido` ganha `'coleta_pausada'` (35 códigos; o plano da E7 foi avisado) e `lerCanal` devolve `collectionPausedAt`: com ele preenchido, `parado` e `queda` de M8 e a direção (M3) respondem `nao_medido`, motivo `coleta_pausada`, e `estado` não sai `'parado'` nem `'ativo'` por dado vencido (~~valor proposto~~ **(reconciliação 13/10, emenda 1: S-I2) valor fixado: `'pausado'`**, logo depois de `fora_do_ar` na precedência). As chaves novas da prova chamam-se `pares_em_pausa` (par de canal pausado, enquanto a pausa dura) e `pausadas` (par cujo buraco cruzou uma pausa, depois de despausar). (reconciliação 13/10, emenda 3: m2) **`pausadas` não é chave da prova nem sai do banco: é contada pelo escritor, em TypeScript. Do banco vêm `pares_em_pausa` e, por item, `gap_crossed_pause` (Tarefa 8b, item 3, que é o texto que vale).**

### 0.2 O que não foi medido (e o plano não afirma)

Nenhuma leitura de produção foi feita para este plano. Tudo o que só produção responde está na seção 3.2, com o comando. Os três que mais pesam: quantos pares de leituras diárias seguidas estão a mais de 36 horas (C-2), quantos canais publicam mais vídeos em 32 dias do que o `video_limit` (C-14) e os sinalizadores ainda nulos (C-4).

### 0.3 Avisos de topo
- **Nenhuma rota nova de pipeline.** Nada a registrar em `api-registry.ts`.
- **O arquivo da MG4 não é criado antes da vez do lote.** Até lá o SQL vive no Apêndice A e a prova dele é o roteiro do Apêndice B (rodado duas vezes no banco local `bythiago_int`, dentro de `begin; … rollback;`: seção 11).
- **A migration só vai ao dono depois do acordo dos dois especialistas** sobre este plano (decisão 45a).
- **Tudo o que este plano avisa ao dono é cron vermelho** (a frase entra no resumo da agenda). Não há sino nem e-mail próprio. **(emenda 1: s:m1) Push existe, e não é deste plano:** o `cron-watchdog` manda o aviso do vigia quando uma tarefa da agenda está atrasada, e isso vale para `agenda:marcas_de_idade` como para as outras (seção 7, D0).
- **Zona reservada enquanto a A4 não for a `staging`:** nenhuma tarefa daqui usa navegador, `next dev`, o banco 54321/54322, `apps/web/e2e/**`, `apps/web/src/app/cms/(authed)/youtube/competitors/**` nem edita `observatorio/proprio/**`.

---

## 1. Perguntas que só o dono responde

Nenhuma trava o início. Cada uma tem o padrão que vale se ele não responder (decisão 44).

| # | Pergunta | Padrão assumido | O que ela trava |
|---|---|---|---|
| 1 | A faixa diária dos vídeos fora dos N mais recentes pode durar 32 dias em vez de 30? (seção 4.4: sem isso a leitura do dia seguinte ao 30º não existe e a marca de 30 dias nunca é medida para esses vídeos) | **Sim, 2 dias de folga** (Tarefa 12). Custo: menos de 1 unidade de cota por sincronização. **(emenda 1: d:I-1, s:I3) A pergunta vai ao dono junto do envio antecipado da Tarefa 12, que tem data limite: em produção até 30/10/2026** | nada; se ele disser não, a Tarefa 12 não é feita e o plano registra que V30 só existe para os N mais recentes, os fixados e os promovidos. **(emenda 2: d:m-3) E, com "não", `MEASURE_RULES.lost.weeklyTier30Counts` passa a `false` no mesmo commit:** a idade 30 de vídeo que está na faixa semanal na hora da decisão (`series_tier = 'semanal'`, que `pending` devolve) deixa de contar para o vermelho `marcas_perdidas` e vai só para o detalhe (`perdidas_30_semanal`). Sem isso os canais da C-14 perderiam V30 todo dia e o disparo ficaria vermelho todo dia, para sempre, por uma perda que o dono escolheu aceitar |
| 2 | Os limites de distância entre as leituras vizinhas ficam em 36 horas (idades 7 e 30) e 8 horas (idade 1)? | **Sim, os do spec.** A C-2 mede quantas marcas o limite de 36 horas perde; se passar de 10% dos pares, o controlador propõe 48 horas, que é um número em `medidas/regras.ts` mais `ruleVersion: 2` (a tarefa reavalia sozinha os motivos antigos enquanto a série existir). **(emenda 1: s:I1) Custo da reabertura:** todos os motivos voltam a ser pendentes de uma vez (da ordem de 4.000 pares hoje), o que pede `teto(pares ÷ 1.500)` execuções, uma a cada 20 minutos (3 execuções, cerca de 1 hora, com o número do spec); nenhuma delas deixa o disparo vermelho por contagem (`naoTerminouVermelhoEm: null`). **(emenda 2: s:n3, d:m-8) A reabertura não anuncia de novo as perdas antigas:** o par que já tinha `leituras_distantes` ou `leitura_parou_antes` com a mesma base e continua com um dos dois não conta em `perdidas` outra vez (`pending` devolve `prev_reason`); conta em `perdidas_ja_avisadas`, no detalhe | nada |
| 3 | Os limiares de subida (2 vezes e 1.000 views em 7 dias) e de "pico sem cauda" (2 vezes a mediana; metade da mediana e 2%; metade da mediana) valem? (pergunta 6 do spec) | **Sim, os do spec**, conferidos contra vídeos reais quando houver 20 com V30 e 90 dias (conferência com data, Tarefa 18) | nada; cada um é um número em `medidas/regras.ts` |
| 4 | M12 (peso do comentário de topo) entra, mesmo sendo o caso que a política III.E.4.h cita? | **Entra como função pura e leitor**, com o aviso na dívida; cortar é tirar uma chave do montador | nada |
| 5 | A idade do vídeo conta da estreia ou da transmissão quando ela é posterior à publicação? | **Sim** (`greatest(published_at, live_actual_start_at)`), igual aos retratos de comentários | nada |
| 6 | Vídeo de formato ainda não confirmado (`is_short` nulo) fica fora das medianas novas? | **Fica fora e é contado** (o motor antigo o trata como longo e não muda) | nada |

---

## 2. O que é do dono

**Uma coisa: aplicar a MG4.** Nenhum agente roda `db:push:prod`.

| Passo | Quem | O quê |
|---|---|---|
| 1 | controlador | roda as conferências C-1 a C-17 (seção 3.2; **a C-14 e a C-16 primeiro**, emenda 1: d:I-1, emenda 2: d:m-4), anota no ledger, e avisa que chegou a vez da MG4 (depois do arquivo da MG6, se ela for junto) |
| 2 | agente (Tarefa 9) | `npm run db:new observatorio_a5_e4_marcas_de_idade`, cola o Apêndice A, roda o roteiro do Apêndice B duas vezes. Commit local |
| 3 | **dono** | `npm run db:push:prod` (digita `YES`), uma vez |
| 4 | agente | V1 a V5 em produção (só leitura; emenda 2: d:I-R2-1), resultado no ledger |
| 5 | agente | push do código (Tarefa 18), promoção fora de 11:55 a 12:15 UTC |

**Nome para o `db:new`:** `observatorio_a5_e4_marcas_de_idade`. Uma migration só.

**Janela.** A MG4 cria duas tabelas vazias, dois índices, duas policies e três funções. As duas chaves estrangeiras para `competitor_videos` e para `sites` pedem, na criação, uma trava curta nessas duas tabelas. **(emenda 1: d:m-2) A descrição anterior estava errada:** criar chave estrangeira pede `SHARE ROW EXCLUSIVE` na tabela referenciada, que deixa ler e bloqueia também `insert`, `update` e `delete` nela enquanto a transação da migration durar. Com as duas tabelas novas vazias não há linha a validar e a transação dura milissegundos. `set lock_timeout = '5s'` na primeira linha: se a sincronização dos canais estiver escrevendo em `competitor_videos` e a trava não vier em 5 segundos, a migration falha inteira e limpa, e o dono repete. Pode ser aplicada a qualquer hora; por hábito, fora dos minutos 00, 20 e 40 de cada hora (disparo do cron de concorrentes).

**Convive com o código que está em `main`?** Sim, nos dois sentidos:
- **MG4 aplicada, código antigo: inerte.** Ninguém lê nem grava as duas tabelas; nenhuma função existente muda; `competitor_channel_removal_impact` não é tocada. Apagar um vídeo ou um canal leva as linhas por cascata (rodado: S9). **(emenda 2: d:I-R2-1) Uma exceção, quando a MG6 também estiver aplicada:** as duas tabelas novas entram na conta de `obs_archive_uncovered()`; se o registro da MG6 não tiver as duas, o export e a remoção de canal arquivado passam a recusar (0.1, dependência 3). A V5 confere.
- **Código novo sem a MG4:** a tarefa `marcas_de_idade` recebe "função não encontrada" na primeira ida ao banco e devolve `erro`, motivo `schema_ausente` ("marcas de idade: migration não aplicada"), sem gravar nada. Os leitores devolvem a parte como "não lida: schema ausente" e toda medida que depende de marca responde `nao_medido`, motivo `leitura_falhou`. As outras tarefas da agenda seguem.

### Consultas de conferência depois de aplicar

**V1: a migration entrou inteira?** Esperado: `2, 2, 2, 3, 0`. (emenda 1: d:m-3) A policy é comparada por `like`: conforme o `search_path` da sessão o catálogo devolve `can_view_site(site_id)` ou `public.can_view_site(site_id)`.

```sql
select (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname in ('competitor_video_marks', 'competitor_video_mark_misses')) as tabelas_com_rls_de_2, (select count(*) from pg_policies where schemaname = 'public' and tablename in ('competitor_video_marks', 'competitor_video_mark_misses') and cmd = 'SELECT' and qual like '%can_view_site(site_id)%') as policies_de_2, (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('idx_cvm_site', 'idx_cvmm_site')) as indices_de_2, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('competitor_marks_pending', 'competitor_marks_apply', 'competitor_marks_health') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute')) as funcoes_so_service_role_de_3, (select count(*) from pg_policies where schemaname = 'public' and tablename in ('competitor_video_marks', 'competitor_video_mark_misses') and cmd <> 'SELECT') as policies_de_escrita_de_0;
```

**V2: os privilégios das tabelas.** Esperado: `false, true, false, false`.

```sql
select has_table_privilege('anon', 'public.competitor_video_marks', 'select') as anon_le, has_table_privilege('authenticated', 'public.competitor_video_marks', 'select') as autenticado_le_pela_rls, has_table_privilege('authenticated', 'public.competitor_video_marks', 'insert') as autenticado_grava, has_table_privilege('authenticated', 'public.competitor_video_mark_misses', 'delete') as autenticado_apaga;
```

**V3: nada foi gravado pela migration e a prova roda.** Esperado logo depois de aplicar (código antigo no ar): `marcas` 0, `faltas` 0, `em_duas_tabelas` 0, `site_divergente` 0, `base_divergente` 0 (emenda 1: d:C-1) e **`atrasadas` maior que zero** (da ordem de 4.000: todo vídeo com data, vezes as idades já fechadas; nenhuma decisão foi gravada ainda). Se `atrasadas` vier 0 com as tabelas vazias, a prova não está contando: parar e avisar.

```sql
select public.competitor_marks_health(now(), 8, 36);
```

**V4: o que a tarefa vai encontrar.** Esperado: `total_pendentes` maior ou igual a `atrasadas` da V3 (ele conta também os pares fechados há menos de 84 horas); `itens` com 3 linhas.

```sql
select (r->'total_pendentes') as total, jsonb_array_length(r->'itens') as devolvidos from (select public.competitor_marks_pending(now(), 1, 3, 8, 36) as r) x;
```

**V5 (emenda 2: d:I-R2-1): o export da MG6 cobre as duas tabelas?** Esperado: ~~`mg6_ausente` (a MG6 ainda não foi aplicada: repetir esta consulta logo depois que ela for) ou~~ `{}` **(reconciliação 13/10: R3: a MG6 passou a vir antes da MG4; `mg6_ausente` depois de aplicar a MG4 quer dizer que a ordem foi invertida: parar)**. Qualquer nome de tabela na resposta: **parar**; o export e a remoção de canal arquivado estão recusando, e o conserto é a entrada que falta no registro (0.1, dependência 3).

```sql
select case when to_regprocedure('public.obs_archive_uncovered()') is null then 'mg6_ausente' else public.obs_archive_uncovered()::text end as sem_export;
```

---

## 3. Fatos de que o desenho depende

### 3.1 Conferidos (no código local, no banco local ou no spec)

| # | Fato | Fonte |
|---|---|---|
| F1 | `viewsAtAge` interpola a partir de um ponto virtual de 0 views na publicação, não limita a distância entre as leituras e é a conta do múltiplo das telas | `observatorio/series.ts:43-53, 75-86`; `multiplier.ts:30` |
| F2 | A série diária grava a primeira leitura de cada dia de São Paulo e nunca a regrava; contagem ausente não gera linha (nunca zero) | `competitor-sync.ts:855-862` |
| F3 | Vídeo fora dos N mais recentes, não fixado e não promovido, é diário só enquanto `agora − publicação <= 30 dias`; na sincronização seguinte vai para a faixa semanal | `competitor-tiers.ts:29-33`; `rules.ts:41` |
| F4 | As primeiras horas só existem para vídeo descoberto até 24 horas depois de publicado e com menos de 72 horas; uma leitura por sincronização do canal | `competitor-tiers.ts:76-81`; `competitor-sync.ts:1148-1152, 1178-1182` |
| F5 | `competitor_video_early` e `competitor_field_versions` não têm leitor nas telas; o carregador não lê `was_live`, `likes_hidden`, `comments_disabled`, `views_hidden`, `discovered_at`, `missing_since`, `live_actual_start_at` | `observatorio/load.ts:94` (`VIDEO_COLS`); `fatos.md` 2.2 |
| F6 | O carregador descarta o retrato de canal sem inscritos e troca `view_count` nulo por 0; lê 90 dias | `observatorio/load.ts:112, 324-325` |
| F7 | Não existe `lib/medidas/`, `countRuleOf`, nem `competitor_video_marks` em nenhum arquivo de código ou de migration | `grep` em `apps/web/src`, `apps/web/test`, `supabase/migrations` |
| F8 | A agenda local tem cinco tarefas; tarefa `leve` começa até 75 s e termina até 90 s; `OBS_AGENDA_TASKS_OFF` desliga por nome; tarefa nova = uma definição, uma importação e uma entrada no catálogo | `agenda/definicoes.ts`, `catalogo.ts`, `relogio.ts`, `despachante.ts:152` |
| F9 | A tarefa `anular_identidade` não tem guarda de schema à parte: a função ausente vira `schema_ausente` no próprio resultado | `agenda/tarefas/anular-identidade.ts` |
| F10 | As tabelas irmãs (`competitor_video_early`) têm os privilégios padrão do Supabase para `anon` e `authenticated`; quem protege é a RLS | banco local, `information_schema.role_table_grants`, 13/10 |
| F11 | O banco local `bythiago_int` tem as tabelas da MG1, da MG2 e da MG8 e não tem `competitor_video_marks` | banco local, 13/10 |
| F12 | Nenhuma conferência C0.x é pré-requisito da E4 | `00-indice…`, tabela das conferências; `fatos.md` 3 |
| F13 | Não há decisão do dono específica da E4; a pergunta 6 (limiares) vale pelo padrão | `.superpowers/sdd/a5/decisoes-do-dono.md`; `perguntas-para-o-dono.md` |

### 3.2 Conferências pendentes (só produção responde; o controlador roda com `npx supabase db query --linked`)

Cada linha diz o que o plano faz conforme a resposta. As consultas de C-6, C-9, C-10 e C-13 estão escritas, letra por letra, em `fatos.md`, seção 7, e não mudam o desenho (só os números da seção 5 e do ⓘ).

**C-1. A tabela existe? Qual a última migration?** Esperado: nulo, e `20261013000003` ou posterior. Se a tabela existir, alguém a criou fora do plano: parar.
```sql
select to_regclass('public.competitor_video_marks') as marcas, (select max(version) from supabase_migrations.schema_migrations) as ultima;
```

**C-2. Quantos pares de leituras diárias seguidas passam de 36 horas?** Decide a pergunta 2. Abaixo de 10% dos pares: fica 36 horas. Acima: o controlador propõe 48 horas antes do envio (um número e `ruleVersion`).
```sql
with p as (select d.video_id, d.taken_at, lag(d.taken_at) over (partition by d.video_id order by d.taken_at) as ant from public.competitor_video_daily d join public.competitor_videos v on v.id = d.video_id where v.series_tier = 'diaria') select count(*) filter (where ant is not null) as pares, count(*) filter (where taken_at - ant > interval '36 hours') as acima_de_36h, count(*) filter (where taken_at - ant > interval '48 hours') as acima_de_48h, min(extract(hour from taken_at at time zone 'America/Sao_Paulo')) as menor_hora_sp, max(extract(hour from taken_at at time zone 'America/Sao_Paulo')) as maior_hora_sp from p;
```

**C-3. Quantos vídeos foram publicados desde 03/10 e três candidatos para o item 29.** Esperado pelo spec: 39. Outro número: corrigir a conta de volume da seção 5 e as datas da Tarefa 18. **(emenda 1: d:I-2, s:I1) A mesma consulta dá o tamanho da carga inicial:** pares no pior caso = `(todos − sem_data) × 3`, e execuções para zerá-la = `teto(pares ÷ 1.500)`; o controlador escreve os dois números na seção 5.2. A conferência que o parecer de software pediu é esta, com as colunas que já existiam.
```sql
select count(*) filter (where published_at >= timestamptz '2026-10-03 00:00:00-03') as desde_03_10, count(*) as todos, count(*) filter (where published_at is null) as sem_data from public.competitor_videos;
select v.id, v.video_id, v.published_at, v.live_actual_start_at, count(d.*) as pontos, min(d.taken_at) as primeiro, max(d.taken_at) as ultimo from public.competitor_videos v join public.competitor_video_daily d on d.video_id = v.id where v.published_at >= timestamptz '2026-10-03 00:00:00-03' and v.published_at <= now() - interval '9 days' group by 1, 2, 3, 4 order by v.published_at limit 20;
```

**C-4. Sinalizadores ainda nulos.** Só tem sentido a partir de 20/10 (uma passada semanal completa). `was_live_nulo` alto: a medida trata nulo como "não se sabe" e mantém o vídeo na mediana (o spec só tira o verdadeiro), dizendo quantos são. `is_short_nulo`: tamanho do efeito da pergunta 6.
```sql
select count(*) as videos, count(*) filter (where was_live is null) as was_live_nulo, count(*) filter (where was_live) as ao_vivo_ou_estreia, count(*) filter (where live_actual_start_at > published_at) as base_muda_com_a_estreia, count(*) filter (where likes_hidden is null) as likes_hidden_nulo, count(*) filter (where comments_disabled is null) as comments_disabled_nulo, count(*) filter (where discovered_at is null) as discovered_at_nulo, count(*) filter (where is_short is null) as is_short_nulo, count(*) filter (where missing_since is not null) as ausentes from public.competitor_videos;
```

**C-5. Retratos de canal: início, buracos e nulos (item 30; M3(a) e M8).** `dias − linhas > 0` em algum canal: há buraco de verdade e M3(a) responde "sem registro na borda" nesses dias (é o comportamento do plano; o número diz com que frequência). `view_nulo > 0`: confirma que o leitor novo (Tarefa 13) não pode passar pelo carregador antigo.
```sql
select c.channel_name, min(s.snapshot_date) as primeiro, max(s.snapshot_date) as ultimo, count(*) as linhas, (max(s.snapshot_date) - min(s.snapshot_date) + 1) as dias, count(*) filter (where s.view_count is null) as view_nulo, count(*) filter (where s.subscriber_count is null) as subs_nulo from public.competitor_channel_snapshots s join public.competitor_channels c on c.id = s.competitor_channel_id group by 1 order by 1;
```

**C-7. Zeros que podem ser ausência.** Se `curtidas_zero_ambiguo` ou `comentarios_zero_ambiguo` passar de zero, vale a regra já escrita em M7 (Tarefa 5): zero com sinalizador nulo é "não medido" (emenda 1: d:m-5: o sinalizador nulo É o sinal de "ainda não relido depois da E1"; não há data no código).
```sql
select count(*) filter (where like_count = 0 and likes_hidden is null) as curtidas_zero_ambiguo, count(*) filter (where comment_count = 0 and comments_disabled is null) as comentarios_zero_ambiguo from public.competitor_videos;
```

**C-8. As primeiras horas existem, e com que distância?** Esperado: linhas só de 13/10 12:27 em diante, cerca de 6 horas entre leituras. Se `acima_de_8h` for a maioria, a marca de 1 dia quase nunca será medida até a leitura horária (E15) entrar: o desenho não muda, e a seção 13 já diz isso. **(emenda 2: d:m-3, s:n1) O que isso faria com o aviso, e o que o plano faz:** cada marca de 1 dia perdida por distância seria uma `perdida`, e o disparo ficaria vermelho quase todo dia. Como a frequência é fato não medido, a idade 1 **não entra** no vermelho (`MEASURE_RULES.lost.alarmAges` é `[7, 30]`): conta em `perdidas_1`, no detalhe e na tabela de motivos. A `e4-d7` mede a taxa com o Lote B em produção; abaixo de 10% dos pares de idade 1, o controlador propõe pôr o 1 em `alarmAges` (um número); acima, fica fora e o risco 1 diz por quê.
```sql
with p as (select video_id, taken_at, lag(taken_at) over (partition by video_id order by taken_at) as ant from public.competitor_video_early) select count(*) as linhas, count(distinct video_id) as videos, min(taken_at) as primeira, count(*) filter (where taken_at - ant > interval '8 hours') as acima_de_8h, count(*) filter (where ant is not null) as pares from p;
```

**C-11. E14 e E15 já escrevem em produção?** Esperado: zero linhas (código local). Com linhas, M11 e M12 já têm insumo e a Tarefa 15 sobe de prioridade.
```sql
select (select count(*) from public.competitor_video_comment_snaps) as retratos, (select count(*) from public.competitor_video_hourly) as horarias;
```

**C-14. Quais canais publicam mais do que o `video_limit` em 32 dias?** É o tamanho do problema da seção 4.4. **(emenda 1: d:I-1, s:I3) É a primeira conferência a rodar, antes de qualquer outra.** Zero linhas e nenhum canal perto do limite (`publicados_32d` a menos de 5 do `video_limit`, pela segunda consulta abaixo): o prazo de 30/10 da Tarefa 12 deixa de apertar, o controlador escreve isso no ledger, e a tarefa entra assim mesmo (custa quase nada), podendo ir com o lote. Uma linha ou mais: o envio antecipado da Tarefa 12 é obrigatório, até 30/10/2026; sem ele esses canais perdem, sem volta, V30 dos vídeos de 03/10 em diante que saem dos N mais recentes antes do 30º dia. (emenda 2: d:m-4) 30/10 é o teto para os vídeos de 03/10 em diante; para os de setembro a perda já corre, e quem mede é a C-16.
```sql
select c.channel_name, c.video_limit, count(*) as publicados_32d from public.competitor_channels c join public.competitor_videos v on v.competitor_channel_id = c.id where v.published_at > now() - interval '32 days' group by 1, 2 having count(*) > coalesce(c.video_limit, 50) order by 3 desc;
select c.channel_name, c.video_limit, count(v.id) as publicados_32d from public.competitor_channels c left join public.competitor_videos v on v.competitor_channel_id = c.id and v.published_at > now() - interval '32 days' group by 1, 2 order by count(v.id) - coalesce(c.video_limit, 50) desc limit 5;
```

**C-16 (emenda 2: d:m-4). Quantos vídeos já saíram da faixa diária com 30 a 45 dias, por canal?** Rodar junto da C-14, antes de tudo. São os vídeos de setembro que tinham leitura diária desde 03/10, estão fora dos N mais recentes e perderam (ou estão perdendo hoje) a leitura do dia seguinte ao 30º. Zero linhas: nenhum V30 está se perdendo hoje e o prazo da Tarefa 12 é só o de 30/10. Uma linha ou mais: **cada dia sem a Tarefa 12 em produção perde o V30 dos vídeos que fazem 30 dias naquele dia nesses canais**; o envio dela é para hoje, e a soma das linhas é a ordem de grandeza de `perdidas_30` no vermelho esperado do D0 (seção 7). A consulta supõe que a série diária de antes de 13/10 foi gravada todo dia para todo vídeo guardado (não conferido; se não foi, os vídeos aparecem aqui e o motivo deles será `leitura_comecou_depois`, que não avisa).
```sql
select c.channel_name, count(*) as fora_da_diaria_com_30_a_45_dias from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id where v.series_tier = 'semanal' and v.published_at between now() - interval '45 days' and now() - interval '30 days' group by 1 order by 2 desc;
```

**C-17 (emenda 2: s:n1). Quantas marcas de 1 dia já nascem perdidas por desenho?** Vídeos de 03/10 em diante que só têm série diária ao redor do primeiro dia (as primeiras horas só existem desde 13/10 12:27): a distância entre as vizinhas é de 24 horas contra o limite de 8, e o par sai `leituras_distantes`. O número é o `perdidas_1` esperado na carga do D0. **Não deixa o disparo vermelho** (C-8); serve para o controlador conferir o detalhe e a consulta das perdas da Tarefa 18. Muito diferente do `perdidas_1` lido no D0: parar e olhar `marcaPerdida`.
```sql
select count(*) as idade_1_perdida_por_desenho from public.competitor_videos v where v.published_at >= timestamptz '2026-10-03 00:00:00-03' and v.published_at <= now() - interval '33 hours' and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live') and exists (select 1 from public.competitor_video_daily d where d.video_id = v.id and d.taken_at < v.published_at + interval '1 day') and not exists (select 1 from public.competitor_video_early e where e.video_id = v.id and e.taken_at between v.published_at + interval '16 hours' and v.published_at + interval '1 day');
```

**C-15 (emenda 1: d:C-1). Quantos vídeos estão agendados ou no ar, e em quantos a base da idade anda mais de 1 dia?** Mede o tamanho do defeito que a emenda consertou. As duas colunas do meio em zero: o caso ainda não aconteceu com os canais de hoje; o conserto fica assim mesmo. `agendados_ou_no_ar` maior que zero: esses vídeos não têm par pendente nem atrasado, e isso é o esperado (conferir na `e4-d0`). Antes de 20/10 `live_broadcast_content` ainda é nulo em quem não foi relido (nulo conta como "nem agendado nem no ar").
```sql
select count(*) filter (where live_broadcast_content in ('upcoming', 'live')) as agendados_ou_no_ar, count(*) filter (where live_scheduled_start_at > published_at + interval '1 day') as agendado_mais_de_1_dia_depois, count(*) filter (where live_actual_start_at > published_at + interval '1 day') as comecou_mais_de_1_dia_depois, count(*) filter (where was_live) as ao_vivo_ou_estreia, count(*) filter (where live_broadcast_content is null) as estado_ainda_nulo from public.competitor_videos;
```

---

## 4. Desenho, no que difere de "implementar a tabela do spec"

### 4.1 Onde mora o código

Tudo novo em `apps/web/src/lib/youtube/observatorio/medidas/` (o spec diz `lib/medidas/`; o Observatório inteiro mora em `lib/youtube/observatorio/`, e os módulos novos da A5 seguiram essa pasta). Um arquivo por medida ou par de medidas, sem importar banco nem rede, exceto os três de servidor (`fechar-marcas.ts`, `ler.ts`, `ler-comentarios.ts`). Nenhum arquivo daqui importa `load.ts`, `pack.ts` nem lê `unobservedSeries`, `tierSpans` ou `weeklySeries` (o teste `consumidores-semanal.test.ts` continua verde sem mudança).

### 4.2 M1 sem palpite, e quando um motivo vira definitivo

A conta é uma só, pura: `viewsNaIdade(leituras, baseMs, idadeDias, { maxGapHoras })`. `leituras` é a união das primeiras horas e da série diária do vídeo (as duas são leituras reais do mesmo contador). Ela acha `a` = a última leitura no instante alvo ou antes, e `b` = a primeira no instante alvo ou depois; exige as duas e `b − a <= maxGapHoras`; interpola e arredonda ao inteiro. Leitura exatamente no instante alvo: `a = b`, distância 0. **Não existe ponto virtual de 0 views na publicação.** `viewsAtAge` fica como está, para o múltiplo das telas.

O **motivo** de uma marca não medida é um de seis códigos, decididos nesta ordem:

| Código | Quando | `since_at` |
|---|---|---|
| `views_ocultas` | o vídeo não tem nenhuma leitura e `views_hidden` é verdadeiro | nulo |
| `sem_leitura` | o vídeo não tem nenhuma leitura | nulo |
| `descoberto_tarde` | a primeira leitura é posterior ao instante alvo e `discovered_at − base > 24 h` | a primeira leitura |
| `leitura_comecou_depois` | a primeira leitura é posterior ao instante alvo (inclui todo vídeo publicado antes de a série começar, e todo vídeo com `discovered_at` nulo) | a primeira leitura |
| `leitura_parou_antes` | a última leitura é anterior ao instante alvo (vídeo que saiu do YouTube, canal pausado) **(reconciliação 13/10: R3: par de canal pausado não é decidido enquanto a pausa durar, e depois dela não conta como perda; 0.1, dependência 3)** | a última leitura |
| `leituras_distantes` | há leitura dos dois lados, e as duas vizinhas estão a mais do que o limite | nulo |

**Quando decidir.** A marca é gravada assim que `b` existe e a distância cabe. O motivo só é gravado quando `agora >= alvo + limite + 1 hora` **(emenda 1: d:m-1)**: a leitura diária e a das primeiras horas feita pela sincronização são gravadas com `taken_at` = a hora em que foram feitas, mas a leitura horária copia pontos para `competitor_video_early` com o `taken_at` da leitura crua, até o fim daquela hora (`horaria/gravar.ts`, `completarCurva`: "mesmos números, mesmo `taken_at`"); por isso uma vizinha pode aparecer até 1 hora depois do instante que carrega. Passada essa hora, nenhuma leitura nova pode ser a vizinha `b` de uma `a` anterior ao alvo dentro do limite, e o motivo é definitivo. A hora de folga é `MEASURE_RULES.lateReadingHours = 1` no código e `interval '1 hour'` no SQL (o banco recusa o motivo que chegar antes: `faltas_recusadas`; a igualdade dos dois é provada na Tarefa 9). Entre o alvo e `alvo + limite + 1 hora`, sem `b`, a decisão é `aguardar` (nada é gravado; o par volta na execução seguinte). **(emenda 2: d:m-9) O mesmo vale quando `b` existe e está além do limite:** antes desse instante o par também é `aguardar`, nunca `falta` (o banco recusaria o motivo cedo demais e o disparo ficaria vermelho com `marca_recusada` por um par que só precisava esperar). Uma mudança de regra sobe `ruleVersion`: os motivos de versão menor voltam a ser pendentes e são reavaliados enquanto a série existir; **a marca gravada nunca é regravada, salvo quando a base da idade do vídeo mudou depois da gravação** (emenda 1: d:C-1; parágrafo seguinte).

**Vídeo agendado ou no ar, e base que anda (emenda 1: d:C-1, s:m5).** A MG8 usa a mesma base e deixa de fora das listas dela o vídeo com `live_broadcast_content` igual a `'upcoming'` ou `'live'` (`20261013000003_…:520` e `:566`); a primeira versão deste plano copiou a base e não copiou a exclusão. Uma transmissão agendada entra em `competitor_videos` com `published_at` de hoje e `live_actual_start_at` nulo (o campo é regravado a cada leitura: `competitor-capture.ts:134-135`), e as idades fechariam contadas de uma data em que o vídeo não existia para o público. Quatro regras, todas no banco (as duas últimas são da emenda 2):
1. **Vídeo agendado ou no ar não tem idade.** `competitor_marks_pending`, a contagem `atrasadas` da prova e os dois `ok` de `competitor_marks_apply` deixam esses vídeos de fora (nulo conta como "nem agendado nem no ar"). A transmissão que nunca acontece nunca vira par pendente nem alarme.
2. **A base andou depois da decisão: o par é refeito.** Acontece quando a transmissão começa (`live_actual_start_at` preenchido) e quando a releitura da E1 traz a estreia de um vídeo decidido antes dela. Marca ou motivo com `age_base_at` diferente da base atual não conta como decisão em `competitor_marks_pending` (o par volta na mesma execução), e `competitor_marks_apply` começa apagando essas linhas das duas tabelas (devolve `refeitas_por_base`) antes de gravar a decisão nova, calculada pela série com a base nova. A prova conta `base_divergente`; lida logo depois de gravar tem de ser 0, e maior que zero ali é `prova_inconsistente`. (emenda 2: d:m-5) A prova só conta vídeo com data: a limpeza não toca a linha de vídeo sem `published_at`, e sem essa condição a prova ficaria vermelha para sempre por uma linha que ninguém apaga. Hoje o caso não acontece (`published_at` só é escrito no `insert`: `competitor-sync.ts:1124`); a condição é guarda.
3. **(emenda 2: d:m-6) O vídeo passou a agendado ou no ar depois da decisão: a linha sai.** É o caso do risco 13 (motivo, ou marca com as views da sala de espera, gravado enquanto `live_broadcast_content` era nulo). As duas limpezas do começo de `competitor_marks_apply` apagam também as linhas de vídeo com `live_broadcast_content` `'upcoming'` ou `'live'`, contadas em `refeitas_por_base`. Sem isso, se a transmissão nunca começasse, a base nunca andaria e a linha ficaria para sempre, escondida do leitor e levada pelo export. Quando a transmissão termina, o par volta a ser pendente e é refeito pela série.
4. **(emenda 2: d:m-2) Quem grava devolve a base que recebeu.** Cada item de `p_marks` e de `p_misses` leva `base_at`, o texto que `competitor_marks_pending` devolveu para aquele par, sem passar por número (para não perder os microssegundos); os dois `ok` de `competitor_marks_apply` exigem `base_at` igual à base atual do vídeo. Se a base andou pouco entre a ida de leitura e a de gravação, as duas leituras podem continuar cercando o alvo novo, e sem essa conferência a marca entraria com as views interpoladas para o alvo velho e `age_base_at` novo, sem nada que a refizesse depois. Com ela o item é recusado (`marcas_recusadas` ou `faltas_recusadas`), e o par volta na execução seguinte com a base certa. Item sem `base_at` também é recusado.

**O que a regra 2 custa, dito sem suavizar:** uma marca gravada com a base antiga sai da tabela mesmo quando a base nova não pode ser medida (o par passa a ter um motivo). O número apagado era views em "base antiga + N dias", que não é mais a idade N do vídeo; a contagem fica em `refeitas_por_base`, no detalhe da execução. Isso só é seguro enquanto a série estiver no banco: é a condição escrita na dívida 3 para a E10.

`decidirMarca(item, agoraMs)` é a função pura que junta as duas coisas e que a tarefa chama; o teste do item 54 a usa dos dois lados.

### 4.3 Quem grava a marca: uma tarefa leve nova na agenda

O spec diz "gravada uma vez, quando a idade fecha" e não diz por quem; a tabela de tarefas da agenda não tem linha para isso (`fatos.md`, contradição 3). Três saídas: (a) tarefa nova na agenda; (b) um passo dentro de `sincronizar_canais`; (c) calcular na leitura da tela e gravar. Escolho **(a)**: (b) põe mais trabalho dentro da tarefa mais cara e mais frágil do disparo, no arquivo que seis tarefas já disputaram; (c) faz uma tela de leitura gravar e deixa sem marca todo vídeo que ninguém abre, que é exatamente o que o export precisa ter. Não é cron novo: é uma linha no catálogo (`00-indice…`, decisão 30 e 4.8), dentro do disparo que já existe.

`marcas_de_idade`: peso `leve`, período `dia`, a partir das 4 h de São Paulo, **ordem 5.5** (emenda 1: s:I2: a ordem 3 é de `soma_do_mapa` no spec, `03-ritmo…:290`, e no teste do pior disparo, `despachante.test.ts:41`; 4 e 5 são de `tamanho_do_banco` e `podas`, e o plano da E10 já escreve `ordem: 4`; 5.5 fica depois de todas as leves do spec e antes das pesadas, não disputa número com nenhuma etapa, e `ordem` é `number` e só serve para ordenar). Consequência de ser a última das leves: num disparo em que as leves anteriores gastam o tempo, ela é a primeira a ser adiada (`adiada`, `sem_tempo`, sem gastar tentativa) e roda no disparo seguinte; no caso comum as leves anteriores somam 25 + 10 + 10 + 5 + 5 = 55 s e ela começa dentro dos 75 s. **Duas idas ao banco e nenhuma chamada ao YouTube:** (1) `competitor_marks_pending` devolve até 1.500 pares pendentes, do mais recente para o mais antigo, cada um com as leituras da vizinhança do instante alvo; (2) o código decide cada par com `decidirMarca` e manda marcas e motivos a `competitor_marks_apply`, que grava e devolve a prova lida depois de gravar. Com zero pendentes a segunda ida acontece assim mesmo, com listas vazias, para ler a prova. Sobrou pendente: `parcial`, motivo `sobrou`, e a agenda roda de novo no disparo seguinte (emenda 1: d:I-2, s:I1: a retomada de `parcial` com progresso não gasta tentativa, `competitor_agenda_claim`; o teto de 12 só conta execução em `erro` ou parcial sem nada feito, então a carga drena em quantos disparos precisar e uma fila travada esgota em 12 e fica vermelha). **Interruptor:** `OBS_AGENDA_TASKS_OFF=marcas_de_idade` (a variável já existe; variável apagada = ligada). A tarefa é do banco inteiro, como as outras da agenda: uma execução cobre todos os sites, e o site de cada linha vem do canal do vídeo.

A função de gravar **não confia em quem chama**: o `site_id` e a base da idade são lidos do vídeo e do canal; a distância é calculada dos dois instantes; a marca só entra se o instante alvo estiver entre as duas leituras e a distância couber no limite (senão é contada em `marcas_recusadas`, e a tarefa fica vermelha). **(emenda 1: s:m4) A recusa tem três causas, e só uma é defeito:** o vídeo foi apagado entre a ida de leitura e a de gravação; a base da idade mudou nesse intervalo (uma sincronização gravou `live_actual_start_at` ou o vídeo passou a `'live'`; emenda 2: d:m-2: a mudança de base agora é recusada sempre, porque o item traz a base com que foi calculado, e não só quando as leituras deixam de cercar o alvo); ou o código mandou uma marca errada. As duas primeiras são raras (o intervalo é de segundos) e somem sozinhas no disparo seguinte; a que se repete em dois disparos seguidos é defeito. A frase do motivo diz isso. O motivo mandado cedo demais é recusado do mesmo jeito (`faltas_recusadas`).

### 4.4 A leitura do dia seguinte ao 30º não existe para vídeo fora dos N mais recentes

Pelo F3, um vídeo que não está entre os `video_limit` mais recentes, não é fixado nem promovido, recebe a última leitura diária na última sincronização em que `idade <= 30 dias`, que é **antes** do instante `base + 30 dias`. A leitura seguinte só viria na faixa semanal, até 7 dias depois: as vizinhas ficam a mais de 36 horas e a marca de 30 dias sai `leituras_distantes`, sempre. V30 é a base de M3(c), M7, M9 e M10. Para os N mais recentes isso não acontece (continuam diários).

Conserto: `RULES.series.dailyGraceDays = 2` (emenda 1: s:I3: a constante mora na linha `series` de `rules.ts`, que já existe em `origin/staging`, e não em `measures`, para a Tarefa 12 poder ser enviada sozinha), e `classifyTiers` passa a comparar com `(dailyAgeDays + dailyGraceDays) * DAY`. O vídeo fica diário até 32 dias; a leitura do dia 31 passa a existir. Custo: os vídeos de 30 a 32 dias dos canais que publicam mais do que o `video_limit` em um mês, lidos em lotes de 50 por unidade de cota. O nome `dailyAgeDays` continua 30 (é o que o spec e o ⓘ dizem). É a única mudança deste plano em comportamento que já está em produção; vai em commit próprio (Tarefa 12) e é a pergunta 1. **(emenda 1: d:I-1, s:I3) Tem prazo de calendário e envio próprio.** A leitura diária só é gravada a partir das 12 h de São Paulo (`competitor-sync.ts:96`); para um vídeo publicado em 03/10 a leitura que falta é a de 02/11 ou a de 03/11. Leitura que não foi feita não se refaz: por isso a Tarefa 12 não espera a MG4, a agenda, o Lote B nem o acordo sobre o resto do plano, e tem de estar em produção até **30/10/2026** (dois dias antes da primeira leitura que ela salva). **(reconciliação 13/10, emenda 1: D-C1) O arquivo ser igual ao de `origin/staging` garante que o commit aplica limpo lá; não basta para "enviar sozinha", porque o commit feito no `staging` local nasce no topo de 321 commits. Ver o "Envio" da Tarefa 12.**

O que a folga **não** resolve: vídeo cuja base é a estreia e não a publicação (a faixa conta da publicação). Se a estreia foi mais de 2 dias depois da publicação e o vídeo está fora dos N, V30 sai `leituras_distantes`. A C-4 (`base_muda_com_a_estreia`) diz quantos são.

### 4.5 Forma das medidas e dos estados

Toda medida devolve `Medida<T>`:

```ts
export type Medida<T> =
  | { estado: 'medido'; valor: T; n: number; janela: Janela; notas: Nota[] }
  | { estado: 'nao_medido'; motivo: MotivoNaoMedido; desde?: string; fechaEm?: string; n?: number; minimo?: number; notas: Nota[] }
export interface Janela { de: string | null; ate: string | null; dias: number | null }   // datas AAAA-MM-DD de São Paulo
export type Nota =
  | { tipo: 'mudanca_de_contagem' }                 // a janela cruza 24/08/2026 (regra f)
  | { tipo: 'ao_vivo_fora'; n: number }             // regra (b), itens 31
  | { tipo: 'fora_do_ar_dentro'; n: number }        // regra (g)
  | { tipo: 'formato_nao_confirmado_fora'; n: number }
  | { tipo: 'ao_vivo_nao_se_sabe'; n: number }      // was_live nulo, mantido na mediana
  | { tipo: 'total_de_hoje' } | { tipo: 'so_curtidas' } | { tipo: 'so_comentarios' }
  | { tipo: 'serie_semanal' }                       // M2 e M9 usaram vizinhas a mais de 36 h (até 8 dias)
  | { tipo: 'agendado_fora'; n: number }            // (emenda 2: d:m-7) vídeo agendado ou no ar, fora das medidas de hoje
```

`MotivoNaoMedido` é uma união fechada (lista na Tarefa 1). Nenhuma função devolve `null`, `undefined`, `NaN`, `Infinity` nem 0 por falta; um teste de propriedade (Tarefa 14) varre a saída inteira do montador atrás desses valores. As medidas **não escrevem frase**: quem escreve é a E5, a partir do código.

A direção (M3) devolve `valor: { variacao: number; direcao: 'subindo' | 'igual' | 'descendo' }`; "parado" é só o estado de M8. A E5 tem os dois para decidir a cor (a dúvida registrada em 6.1, ponto 9, do spec fica com ela e com os mockups 1 e 9).

### 4.6 O que a E10 (item 77) consulta

"Idade 30 fechada e sem marca nem motivo registrado" é, para um vídeo: `base + 30 dias <= agora` e não existe linha `(video_id, 30)` em `competitor_video_marks` nem em `competitor_video_mark_misses`. Entre o fecho da idade e a decisão (até 37 horas, isto é, o limite mais 1 hora, mais a espera da tarefa do dia seguinte: emenda 1, d:m-1) o par está sem as duas, e a recusa vale: é o comportamento certo (a marca ainda pode ser gravada, e para isso a série tem de estar online). Vídeo sem `published_at` não tem idade e não é recusado por esta regra; **vídeo agendado ou no ar (`live_broadcast_content` `'upcoming'` ou `'live'`) também não** (emenda 1: d:C-1: sem isso a transmissão que nunca acontece travaria o arquivo para sempre). A base é a atual do vídeo, e linha com `age_base_at` diferente dela não conta como marca nem como motivo. O plano que escrever a recusa tem de dizer a mesma frase, e esta é a daqui. **Estado em 13/10:** o plano da E10 (`2026-10-13-a5-e10-export-pausa-e-sinal-de-limite-plan.md`, desvio D10) recusa **todo** lote por idade nesta fase e deixa a regra fina para o plano da manutenção; é esse plano que usa esta frase.

### 4.7 Leitores que não mentem

Cada leitor de servidor devolve `{ lido: true, … }` ou `{ lido: false, causa: 'schema_ausente' | 'erro_do_banco' | 'cortado' | 'canal_de_outro_site' | 'sem_permissao' }` (emenda 1: s:m7(i): `sem_permissao` só sai do leitor de comentários, Tarefa 15, cujo tipo `ParteDeComentarios` é `Parte<T>` mais essa causa; os leitores da Tarefa 13 não a devolvem). Lista vazia só com `lido: true`. O montador traduz toda parte não lida em `nao_medido`, motivo `leitura_falhou`, para as medidas que dependem dela, e nunca calcula sobre a metade que veio. Toda leitura é paginada em 1.000 linhas (o `max_rows` do PostgREST corta em silêncio), com `in()` em blocos de 150 ids, e a página que vem cheia sem a seguinte é `cortado`.

### 4.8 Segurança e dado pessoal

- **O que as duas tabelas guardam:** contagens públicas do YouTube (views, curtidas, comentários) de vídeos de terceiros, datas e um código de motivo. **Nenhum dado pessoal**, nenhum texto de terceiros, nada do canal próprio. Por isso a leitura é por `can_view_site(site_id)`, o mesmo nível das outras `competitor_*`, e não há leitura pública (`anon` não tem nem o privilégio de `select`).
- **Quem grava:** só o cliente de serviço, pelas funções (execução só para `service_role`). Não há policy de escrita, e `authenticated` não tem privilégio de escrita nas tabelas.
- **Cliente de serviço:** o único uso novo é o da agenda (cron, sem usuário). Os leitores recebem o cliente de quem chama; a página que os chamar (E5) continua obrigada a provar o site antes de criar o cliente de serviço. Todo leitor filtra por `site_id` ou parte de `lerCanal`, que filtra (provas por mutação na Tarefa 13). **(emenda 1: s:m6) A frase não era verdade para dois leitores:** `lerSeriesDoCanal` e `lerMudancasDoCanal` leem tabelas sem `site_id` (`competitor_video_daily`, `competitor_video_versions`) pelos ids que quem chama mandou; conferir o canal não bastava, porque um id de vídeo de outro canal passaria. Os dois passam a ler primeiro os ids dos vídeos do canal e a descartar o id pedido que não é dele (Tarefa 13, com a mutação).
- **M11 e M12 leem tabelas restritas** (o texto e as leituras dos comentários são de quem edita, ou de quem tem o direito "ver desempenho privado" depois da MG11). O leitor (Tarefa 15) exige o token `EdicaoDoSite`, usa o site de dentro dele e **não seleciona texto nem autor**: só `creator_replied`, `likes`, `status` e ids. O número que sai (uma fração, uma razão) herda a restrição: a E5 só o mostra a quem passou pela mesma guarda.
- **Retenção e apagamento:** as marcas ficam para sempre (é o propósito). Apagar um vídeo, um canal ou um site leva as linhas por cascata (rodado: S9). Não há prazo a cumprir nem rotina de anulação.
- **Sentry e resumo do cron:** só códigos de catálogo, números, nome de classe e SQLSTATE. Nenhuma mensagem do banco nem id de vídeo no resumo.

---

## 5. As contas

### 5.1 A tarefa `marcas_de_idade` (por execução)

| Item | Valor | Fonte |
|---|---|---|
| Chamadas à API do YouTube | **0** | só banco |
| Cota | **0 unidades** | |
| Idas ao banco | **2** (`pending`, `apply`), cada uma com `AbortSignal.timeout(BANCO_MS)` = 5 s | 4.3 |
| Pior tempo | 10 s (as duas no prazo máximo) | |
| Tempo medido no banco local | (emenda 2: medido de novo com o SQL da emenda 2, uma execução) `pending` com 1.500 vídeos, 73.500 linhas diárias e 4.363 pares pendentes: 52 ms (limite 500), 96 ms (limite 1.500) e 127 ms (limite 2.000); `apply` de 500 motivos: 28 ms; `health`: 3 ms. Com o SQL da emenda 1: 48, 104 e 124 ms, 23 ms e 3 ms (a diferença é ruído de uma execução só) | seção 11, roteiro de volume, 13/10 |
| Tamanho da resposta de `pending` | (emenda 2: com as duas chaves novas por item) 310 KB com 500 pares; 799 KB com 1.500; 1.031 KB com 2.000 (eram 296, 756 e 972) | idem |
| Pares por execução | até 1.500 (`MEASURE_RULES.batch`) | |

**Em produção o tempo não foi medido** (a série diária de lá é maior: C-13). Os acessos são todos pela chave primária de cada tabela; a Tarefa 18 lê o tempo real em `competitor_agenda_runs` no D0.

**Relógio da agenda.** `comecaAteMs: 75_000`, `fimAteMs: 85_000` (começo mais as duas idas de 5 s; dentro do teto de 90 s das leves, igual à `anular_identidade`). A tarefa leve roda antes da pesada do disparo; no pior caso tira 10 s do tempo da pesada, que confere o próprio relógio contado de `t0` e adia o que não couber. O teste do pior disparo (item 215) passa a incluir a tarefa (Tarefa 11). **Os orçamentos acoplados da forja (20 min, 25 min, 30 min, 70 min) não são tocados:** esta tarefa não fala com a forja.

**Quando estoura.** Uma ida ao banco que passa de 5 s é abortada: `erro`, motivo `banco_nao_respondeu`, nada gravado pela metade (cada ida é uma transação). A agenda tenta de novo no disparo seguinte; cada execução em `erro` gasta uma das 12 tentativas do dia e a 12ª falha vira `esgotada`, vermelha. No dia seguinte recomeça. Como a tarefa recupera atraso, um dia perdido não perde marca.

### 5.2 Volume

| O quê | Conta | Estado |
|---|---|---|
| Carga inicial | cerca de 1.389 vídeos × 3 idades = até 4.167 pares, quase todos motivo `leitura_comecou_depois` (vídeos anteriores a 03/10) | **estimativa** (número de vídeos do spec; C-3 confere) |
| Execuções para zerar a carga | `teto(pares ÷ 1.500)`: 3 com 4.167 pares (2,78), **com folga de só 333 pares (111 vídeos) antes da quarta** (emenda 1: d:I-2, s:I1). O número certo sai da C-3. Quantas forem, nenhuma deixa o disparo vermelho por contagem (`naoTerminouVermelhoEm: null`): quem acusa fila parada é `marcas_atrasadas`, o teto de 12 tentativas sem progresso e o vigia (36 horas sem `ok`). Capacidade: um disparo a cada 20 minutos das 4 h em diante são 60 por dia, 90.000 pares | conta |
| Regime | vídeos novos por dia × 3. O spec cita 39 vídeos em 10 dias nos 15 canais: cerca de 4 por dia, 12 linhas por dia, cerca de 4.300 por ano, somando as duas tabelas | **estimativa** (C-3) |
| Tamanho | linha de marca: cerca de 130 bytes com a chave; 4.300 linhas por ano: menos de 1 MB por ano com os dois índices | estimativa |
| Com 200 canais | cerca de 57.000 linhas por ano, menos de 12 MB | estimativa |

O spec diz "cerca de 300 linhas por canal por ano"; a conta daqui dá o mesmo (4 por dia ÷ 15 canais × 365 × 3 = 292).

### 5.3 Os leitores (por canal aberto, para a E5 saber o custo)

`lerVideosDoCanal`: 1 a 2 páginas. `lerMarcasDoCanal`: 2 consultas por bloco de 150 vídeos. `lerSnapshotsDoCanal`: 1 página (120 dias). `lerSeriesDoCanal` (só para M2, M5 e M9): vídeos dos últimos 180 dias × até 91 pontos; num canal com 100 vídeos na janela são até 9.100 linhas, 10 páginas. **É a leitura cara**, é opcional no montador (sem ela M2 fora das idades 1, 7 e 30, M5(ii) e "ainda rende" respondem `nao_medido`, motivo `serie_nao_pedida`), e quem decide guardá-la em pacote é a E5. Nenhum leitor desta etapa é chamado por tela hoje.

### 5.4 A folga de 2 dias (Tarefa 12)

Vídeos diários a mais = os de 30 a 32 dias de idade nos canais que passam do `video_limit` em um mês (C-14). (emenda 1) Envio próprio, até 30/10/2026: Tarefa 12. No pior caso plausível (um canal com 3 vídeos por dia fora dos N): 6 vídeos a mais, dentro do mesmo lote de 50 ids por unidade. O teto de 200 vídeos diários por canal continua valendo, e os de "idade" mais antigos (os da folga) são os primeiros a sair.

---

## 6. O que acontece quando o dado não existe, e em cada falha

### 6.1 A tarefa `marcas_de_idade`

| Situação | O que o código faz | Veredito na agenda | E-mail |
|---|---|---|---|
| MG4 não aplicada (função não encontrada: `PGRST202`, `42883`, `42P01`) | não grava | **vermelho**: `marcas de idade: migration não aplicada` | não (o vigia da agenda cobra a tarefa parada pela regra dele) |
| Banco não responde em 5 s, ou erro de transporte | não grava | **vermelho**: `banco_nao_respondeu` | não |
| Erro do banco com código (permissão, `check`) | não grava; só o SQLSTATE vai ao Sentry | **vermelho**: `leitura_falhou` ou `gravacao_falhou` | não |
| Resposta fora da forma (não é objeto, `itens` não é lista, `total_pendentes` não é número) | não grava | **vermelho**: `resposta_invalida` | não |
| Nenhum par pendente | chama `apply` com listas vazias e lê a prova | **verde** se a prova está limpa | |
| Nenhum vídeo no banco, ou nenhum com data | idem; `atrasadas` 0 | **verde**, com `feitas: 0` (não há o que marcar; a prova confirma) | |
| Par sem leitura nenhuma na vizinhança, alvo há menos que o limite mais 1 hora (emenda 1: d:m-1) | `aguardar`: nada gravado | verde; o par volta amanhã | |
| Par sem vizinhas dentro do limite, alvo há o limite mais 1 hora ou mais, e a série do vídeo **não** existia antes do alvo (`leitura_comecou_depois`, `descoberto_tarde`, `sem_leitura`, `views_ocultas`), ou o vídeo saiu do YouTube (`missing_since` preenchido) | grava o motivo | verde | |
| (emenda 1: d:I-3, s:m8) Par com motivo `leituras_distantes` ou `leitura_parou_antes`, série que já existia antes do alvo (`first_reading_at < target_at`) e vídeo no ar (`missing_since` nulo): a coleta teve um buraco e a marca se perdeu de vez | grava o motivo (é o que aconteceu) e conta em `perdidas` e em `perdidas_1`, `perdidas_7` ou `perdidas_30` (emenda 2: s:n1) | **vermelho, uma vez**: `marcas_perdidas`, com os números na frase ("N marcas não puderam ser medidas (7 dias: A; 30 dias: B): faltou leitura ao redor da idade"). Só a execução que **grava** avisa; a seguinte não tem o que gravar e volta a verde. Não é alarme eterno e não é silêncio. **(emenda 2: s:n1, d:m-3, s:n3, d:m-8) Três casos gravam o motivo, contam no detalhe e NÃO deixam vermelho:** a idade 1 (`perdidas_1`: com só a série diária ao redor do primeiro dia a distância é de 24 horas contra o limite de 8, o que é limite de desenho e não falta de leitura; a frequência com a leitura horária no ar é fato não medido, e a `e4-d7` decide se ela entra); o par que já tinha um dos dois motivos com a mesma base (`perdidas_ja_avisadas`: a reabertura por `ruleVersion` não anuncia a perda antiga como nova); e, só se a pergunta 1 for respondida "não", a idade 30 de vídeo na faixa semanal (`perdidas_30_semanal`). O vermelho sai quando `perdidas_7 + perdidas_30 > 0` | |
| Vídeo agendado ou no ar (emenda 1: d:C-1) | não é par pendente nem atrasado; (emenda 2: d:m-6) linha dele gravada antes, quando o estado ainda era nulo, é apagada por `apply` (`refeitas_por_base`) | verde; passa a contar quando a transmissão termina, com a base nova | |
| (emenda 2: d:m-2) A base de um vídeo andou entre a ida de leitura e a de gravação | o item é recusado (`base_at` diferente da base atual); o par volta na execução seguinte | **vermelho**: `marca_recusada`, uma vez (some no disparo seguinte) | |
| (emenda 2: s:n5) A tarefa começou tarde no disparo e as duas idas não couberam até `fimAteMs` | o despachante fecha a execução; a gravação abandonada, se terminar, é idempotente | **vermelho**: `passou_do_tempo` (motivo comum da agenda), e gasta uma das 12 tentativas. Repetido: baixar `MEASURE_RULES.batch` (Tarefa 18, `e4-d0` e `e4-d1`) | |
| A base de um vídeo andou depois da decisão (emenda 1: d:C-1) | o par volta como pendente; `apply` apaga a linha velha (`refeitas_por_base`) e grava a decisão nova | verde, com o número no detalhe | |
| Leitura com `views` não numérico na resposta | a leitura é ignorada (nunca vira 0) e contada em `leituras_ignoradas` | **nota** no detalhe; vermelho `resposta_invalida` se todas as leituras de algum par forem inválidas | |
| Sobraram pares além de 1.500 | grava os 1.500 | **parcial**: `sobrou` (roda de novo no próximo disparo). **(emenda 1: d:I-2, s:I1) A frase anterior estava errada:** `naoTerminouVermelhoEm` conta fechos `parcial` seguidos da mesma linha `(task, period_key)`, isto é, disparos do MESMO dia (`despachante.ts:208-211`, "N disparos seguidos sem terminar"; MG10, linhas 12 e 96), não dias. Com 3, a carga inicial ficava a 333 pares do vermelho falso no D0, e a reabertura por `ruleVersion` também. O campo passa a `null` (como em `anular_identidade` e `serie_semanal`): a contagem de parciais nunca deixa vermelho. Fila que não anda aparece por três outros caminhos: parcial sem nada feito gasta tentativa e esgota em 12 (`esgotada`, vermelho); `marcas_atrasadas`; e o vigia, com 36 horas sem `ok` | |
| `marcas_recusadas > 0` ou `faltas_recusadas > 0` (o banco recusou marca ou motivo que o código mandou) | as outras entram | **vermelho**: `marca_recusada` (emenda 1: s:m4: vídeo apagado ou base alterada entre as duas idas, que some no disparo seguinte; repetido, é defeito de código) | |
| Prova: `em_duas_tabelas > 0`, `site_divergente > 0` ou `base_divergente > 0` (emenda 1: d:C-1) | já gravou | **vermelho**: `prova_inconsistente` | |
| Prova: `atrasadas > 0` e nada sobrou para fazer | já gravou | **vermelho**: `marcas_atrasadas` (há par fechado há mais de 84 horas que a tarefa não decide) | |
| Prova: `atrasadas > 0` e ainda sobram pares | segue | parcial (`sobrou`): é a carga inicial drenando | |
| A tarefa lança | nada | **vermelho**: `inesperado` (só nome da classe e SQLSTATE no Sentry) | |
| `OBS_AGENDA_TASKS_OFF=marcas_de_idade` | não roda | a agenda mostra **desligada**, nunca "ok" | |
| A agenda inteira desligada (`OBS_AGENDA=off`) ou Lote B fora do ar | não roda | a tarefa não existe para o vigia; **nenhum aviso**: seção 13, risco 3 | |

**Precedência dos vereditos (emenda 1), quando mais de um vale na mesma execução:** falha de ida ao banco ou de forma; `marca_recusada`; `prova_inconsistente`; `marcas_perdidas`; `marcas_atrasadas` (só com nada sobrando); `sobrou`; `ok`. Os números de todos vão no detalhe de qualquer jeito. **(reconciliação 13/10, emenda 1: D-I1, S-I2) Duas chaves a mais no detalhe, que não mudam veredito nenhum: `pares_em_pausa` (pares de canal com a coleta pausada, fora de `total_pendentes` e de `atrasadas`) e `pausadas` (pares cujo buraco cruzou uma pausa registrada, fora de `perdidas`). Canal pausado some das outras contagens e aparece nestas.**

### 6.2 Os leitores e o montador

| Situação | O que a medida responde |
|---|---|
| Tabela de marcas ausente (MG4 não aplicada) | parte `marcas`: `lido: false, causa: 'schema_ausente'`; M1, M3(c), M7 na idade 30, M9, M10, M12: `nao_medido`, `leitura_falhou` |
| Erro de banco numa parte | só as medidas daquela parte: `leitura_falhou`; as outras seguem |
| Canal de outro site (o `site_id` pedido não é o do canal) | todas as partes: `canal_de_outro_site`; nada é lido além da linha do canal |
| Canal sem vídeo | M1 a M7: `poucos_videos` com `n: 0`; M8: pela última publicação ausente, `sem_publicacao` |
| Vídeo sem marca e sem motivo, idade fechada | `aguardando_calculo` (a tarefa ainda não passou); com a série pedida, calcula na hora pela mesma função e diz `fonte: 'serie'`; **com a série pedida e sem as duas vizinhas dentro do limite, também `aguardando_calculo`** (emenda 1: s:m7(ii): o motivo definitivo é só o que a tarefa gravou; o leitor não inventa um) |
| Vídeo agendado ou no ar (emenda 1: d:C-1) | `fecha_em` sem data (`fechaEm` ausente): a idade ainda não começou a contar |
| Vídeo agendado ou no ar, nas medidas que usam os números de hoje (emenda 2: d:m-7) | fica fora de M3(b), M3(c), M4 e M7 e é contado na nota `agendado_fora`; o agendado (`'upcoming'`) não é publicação para M6 e M8. As views dele são "ainda não medido", nunca zero |
| Uma medida lança dentro do montador (número não finito que escapou) | só aquela medida: `calculo_falhou`; as outras seguem, e o montador devolve a lista `falhas` para quem chama relatar ao Sentry (emenda 1: s:m7(v)) |
| Vídeo com idade menor que N | `fecha_em`, com a data |
| Vídeo com motivo registrado | o motivo da tabela, com `desde` quando há |
| Retrato de canal com `view_count` nulo | o dia conta como **sem registro** (nunca 0) |
| Dia sem retrato na borda de M3(a) | `sem_registro_na_borda`, com a data que faltou |
| Total do canal menor que o do retrato anterior (vídeos apagados) | `contagem_recuou` |
| Divisor zero em qualquer razão | `base_zero` |
| Curtidas ocultas e comentários desligados | M7 e M10: `sem_reacao_publica`; só um ausente: M7 medido com o outro e a nota |
| Pacote do motor sem a série (`weeklyOmitted`) | não afeta: as medidas novas não leem o pacote |
| Tabelas de comentário vazias (E14 ainda não rodou) | M11, M12: `poucos_videos`, `n: 0` |
| Quem pede não edita o site | M11, M12: `sem_permissao` (nunca "0 de 0") |

---

## 7. Simulação do dia do envio e dos seguintes

Suponha a promoção em D0 às 15:00 de São Paulo, com a MG4 aplicada na véspera e a agenda no ar.

- **Antes da promoção:** MG4 aplicada, código antigo. Tabelas vazias; nada as lê. V3 mostra `atrasadas` em torno de 4.000.
- **D0, do deploy ao primeiro `ok` (emenda 1: s:m1):** o vigia acusa `agenda:marcas_de_idade` como atrasada, "sem leitura". `avaliarAgenda` devolve `late` para tarefa sem nenhum `ok` quando a agenda existe há mais que a tolerância (`agenda/saude.ts:83-85`), e no dia do envio a agenda já tem dias de vida; se o `cron-watchdog` rodar nesse intervalo, manda o push com o nome. Dura até a carga inicial terminar: `teto(pares ÷ 1.500)` disparos de 20 minutos, cerca de 1 hora com o número do spec. É esperado e não é defeito; o controlador avisa o dono antes. **Promover depois das 04:00 de São Paulo** (antes disso a tarefa só fica devida às 4 h e o aviso dura até lá).
- **D0, 15:00:** o primeiro disparo depois das 4 h de São Paulo já passou; a tarefa é devida no dia. No disparo seguinte (até 20 minutos): 1.500 pares decididos, quase todos motivo `leitura_comecou_depois`; para os vídeos publicados de 03/10 em diante com 7 dias fechados (os de 03 a 06/10), marcas de 7 dias. `parcial`, `sobrou`.
- **D0, mais 20 e mais 40 minutos:** as outras duas levas. Na terceira: `ok`, `deixadas: 0`, `atrasadas: 0`. (emenda 1: d:I-2, s:I1) Se a C-3 der mais de 1.500 vídeos com data, há uma quarta leva, sem vermelho. (emenda 1: d:I-3; emenda 2: s:n1, d:m-4) **Um vermelho `marcas_perdidas` numa das levas do D0 é esperado, e o controlador avisa o dono antes, com os números da C-16 e da C-17.** Ele tem duas origens possíveis: (a) V7 de vídeo de 03/10 em diante com leitura faltando ao redor do 7º dia (`perdidas_7`); (b) V30 de vídeo de setembro que tinha leitura diária desde 03/10, estava fora dos N mais recentes e saiu da faixa diária no 30º dia sem a leitura do dia seguinte (`perdidas_30`; a C-16 dá a ordem de grandeza, e a Tarefa 12 em produção é o que estanca). A frase diz os dois números. A idade 1 dos vídeos que só têm série diária não deixa vermelho: vai em `perdidas_1` (a C-17 diz quanto esperar). Como `pending` devolve do mais recente para o mais antigo, quase tudo isso cai na primeira leva; ela sai vermelha uma vez e a seguinte continua a carga. Com a C-16 em zero e nenhum buraco no 7º dia, não há vermelho.
- **D+1, 04:00 a 04:20 (emenda 1: d:m-8; a versão anterior errava a hora):** a leitura diária só existe a partir das 12 h de São Paulo (`competitor-sync.ts:96`), então às 4 h a leitura de hoje nunca entrou. A execução das 4 h grava as marcas de 7 dias dos vídeos cujo 7º dia fechou **antes** da leitura diária de ontem (publicados há 8 ou 9 dias); os que fecharam depois dela ficam `aguardar` e entram amanhã. A marca sai com até cerca de 40 horas de atraso sobre o instante alvo, dentro das 84 horas da prova.
- **D+1 em diante:** cerca de 12 pares por dia.
- **02/11/2026:** fecham as primeiras idades de 30 dias (vídeos de 03/10). A marca entra em 04 ou 05/11, na execução das 4 h seguinte à leitura diária do dia seguinte ao alvo. **Só para os vídeos lidos todo dia**: sem a Tarefa 12 em produção até 30/10 (emenda 1: d:I-1, s:I3), os que estão fora dos N mais recentes saem `leituras_distantes`.
- **Idade de 1 dia:** só para vídeo descoberto até 24 horas depois de publicado, a partir de 13/10 12:27. Com a leitura a cada 6 horas e nenhuma falha, a distância é 6 h e cabe em 8 h; uma sincronização atrasada em mais de 2 horas já gera `leituras_distantes`. Com a leitura horária (E15) no ar, cabe sempre.
- **Código novo sem a MG4 (ordem invertida):** a tarefa fica vermelha (`migration não aplicada`) uma vez por disparo em que é tentada, até 12 no dia, e nada é gravado nem perdido. Aplicada a migration, o disparo seguinte grava.

---

## 8. Desvios do texto do spec, com o motivo

| # | O spec diz | O plano faz | Motivo |
|---|---|---|---|
| 1 | funções em `lib/medidas/` | `lib/youtube/observatorio/medidas/` | é onde mora todo o Observatório e os módulos novos da A5 |
| 2 | M1 é `viewsAtAge` de `series.ts` | função nova `viewsNaIdade`; `viewsAtAge` não muda | `viewsAtAge` usa um ponto virtual de 0 views e não limita distância (o spec proíbe palpite na marca), e é a conta do múltiplo das telas (itens 9, 20 e 43: os números não mudam) |
| 3 | a idade conta de `publicação` | de `greatest(published_at, live_actual_start_at)` | o plano da E14, desvio 3, e a MG8 já usam essa base; M12 divide um número pelo outro "na mesma idade" |
| 4 | "sem linha = não medido, com o motivo de M1" e o export exige "motivo registrado" | segunda tabela, `competitor_video_mark_misses`, com catálogo fechado | depois de arquivar a série o motivo não se recalcula; e o item 54 ("nenhuma linha é gravada" na tabela de marcas) continua literalmente verdadeiro |
| 5 | DDL da MG4 com 11 colunas | mais três em `competitor_video_marks`: `age_base_at`, `read_before_at`, `read_after_at`; mais os `check` de não negativo | a marca tem de ser conferível à mão depois de a série sair (item 29); e a base usada fica gravada (desvio 3) |
| 6 | "descoberto com mais de 24 h" = não medido | só é o motivo quando não há leitura antes do instante alvo; com vizinhas reais dos dois lados dentro do limite, mede | os 39 vídeos de 03 a 12/10 têm `discovered_at` nulo e o próprio spec os dá como medidos; a proteção contra o palpite é a regra das duas vizinhas |
| 7 | "publicado antes de 03/10/2026" = não medido | `leitura_comecou_depois`, com a data da primeira leitura do vídeo | a data 03/10 não fica escrita no código; a tela diz a data real |
| 8 | E4 "não tem interruptor: só acrescenta" | `OBS_AGENDA_TASKS_OFF=marcas_de_idade` | o desenho ganhou um escritor periódico; a variável já existe |
| 9 | "A fase acrescenta zero cron"; a tabela v2.3 da agenda tem oito tarefas, ordens 1 a 8 | uma tarefa nova no catálogo da agenda, **ordem 5.5** (emenda 1: s:I2) | não é cron (nenhuma linha em `vercel.json`); é o caminho que 4.8 do spec manda. As ordens 1 a 8 já têm dono; 5.5 não desloca nenhuma |
| 10 | faixa diária "até 30 dias" | até 32 para quem está na faixa só pela idade (`RULES.series.dailyGraceDays`, emenda 1) | 4.4: sem a leitura do dia 31 não existe V30 |
| 11 | M2 nas idades 60 e 90 "com a série diária ou semanal" | vizinhas a até 8 dias (`weeklyMaxGapDays`) nessas duas idades, com a nota `serie_semanal`; nas outras, 36 h | é o que "ou semanal" exige; a nota deixa a tela dizer |
| 12 | M10, condição (iii), com só curtidas ou só comentários | compara o mesmo componente (só curtidas por view contra a mediana de só curtidas por view do canal) | comparar um componente com a mediana dos dois daria "pouca reação" sempre |
| 13 | "longos e Shorts nunca se misturam" | formato não confirmado fica fora das medianas novas e é contado | o motor trata nulo como longo; nas medidas novas isso misturaria sem aviso |
| 14 | as tabelas `competitor_*` novas nascem com os privilégios padrão | `revoke` de tudo para `anon` e de escrita para `authenticated` | não custa nada e fecha uma porta que a RLS já fechava |
| 15 | M11 lê `criador_respondeu` | lê `competitor_video_comments.creator_replied` (o estado guardado, em que "sim" não volta atrás), não o da leitura por marco | é o que o texto de M11 descreve ("algum comentário guardado tem sim") |
| 16 | a remoção do canal conta as marcas | não conta (a cascata as leva) | recriar `competitor_channel_removal_impact` aqui disputaria o corpo da função com a MG6, que vai no mesmo lote; dívida 1 |
| 17 (emenda 1: s:m7(iii)) | M5(i), o efeito de uma troca, é uma das medidas | fica o `effectAt` do motor, **fora da forma `Medida`**: não é reescrito nem embrulhado (Tarefa 6) | é a conta que as telas já mostram (item 247: os números não mudam); embrulhar seria uma segunda porta para o mesmo número. A E5 lê `effectAt` como hoje |
| 18 (emenda 1: d:C-1) | "gravada uma vez, quando a idade fecha" | vídeo agendado ou no ar não tem idade; marca ou motivo cuja base mudou depois é apagado e refeito | 4.2: sem isso a marca fecharia contada de uma data em que a transmissão não existia, para sempre |
| 19 (emenda 1: s:I2) | pior disparo da ordem 15 em diante: 25 + 10 + 10 + 5 + 5 + 150 = 205 s (`00-indice…`, "Pior disparo por ordem") | com a tarefa nova, 215 s (mais 10 s de leve) | uma leve a mais; o teste do pior disparo (item 215) roda com as nove tarefas e continua dentro de `LIMITE_FUNCAO_MS` (Tarefa 11). **(reconciliação 13/10: R13) A conta de 205 s do spec dá 5 s a `tamanho_do_banco`; o plano da E10 lhe dá até 10 s da medida mais 20 s da nova tentativa das miniaturas. Soma nominal das leves: 25 + 10 + 10 + 30 + 5 + 10 = 90 s, contra o `fimAteMs` de 85 s; pior disparo nominal 240 s, não 215. Cabe porque nenhuma leve começa depois de 75 s e a nova tentativa das miniaturas só começa com mais de 25 s de sobra: no disparo em que as duas coincidem, `marcas_de_idade` é a adiada (`sem_tempo`, sem gastar tentativa). O teste do pior disparo roda com o catálogo real das duas etapas** |
| 20 (emenda 1: d:m-1) | o motivo é definitivo quando as vizinhas passam do limite | definitivo 1 hora depois do limite | a leitura horária copia pontos com o `taken_at` da hora, até 1 hora depois |
| 21 (emenda 2: s:n1, d:m-3) | o spec não fala de aviso de marca perdida (é da emenda 1 deste plano) | o aviso só fica vermelho pelas idades 7 e 30; a idade 1 vai só para o detalhe e para a tabela de motivos | a perda de V1 por distância é esperada enquanto só houver uma leitura a cada 6 horas, e a frequência com a leitura horária não foi medida; alarme de todo dia deixa de ser lido |
| 22 (emenda 2: d:m-7) | as medianas de M3, M4 e M7 e as publicações de M6 e M8 contam todo vídeo com data | vídeo agendado ou no ar fica fora das medianas, contado; o agendado não é publicação | a transmissão marcada tem views zero ou quase, que é "ainda não medido" |

---

## 9. Arquivos, tarefas, ordem e paralelismo

Caminhos relativos a `apps/web/`. `M/` = `src/lib/youtube/observatorio/medidas/`; `TM/` = `test/youtube/observatorio/`. "Novo" = criado por esta etapa. A lista de cada tarefa é fechada: precisou de outro arquivo, para e avisa.

| T | O que | Arquivos (lista fechada) | Depende de | Pode rodar junto com |
|---|---|---|---|---|
| 1 | Regras, tipos e a regra de contagem | `M/regras.ts`, `M/tipos.ts`, `M/contagem.ts` (novos); `src/lib/youtube/observatorio/rules.ts` (**uma linha**); `TM/medidas-regras.test.ts` (novo) | nada | nenhuma (é a base) |
| 2 | M1: a conta, a decisão e a leitura por vídeo e por canal | `M/m1.ts`, `TM/medidas-m1.test.ts` (novos) | 1 | 3 a 8, 10 não |
| 3 | M2 (curva) e M9 (cauda) | `M/curva.ts`, `M/cauda.ts`, `TM/medidas-curva-cauda.test.ts` (novos) | 2 | 4, 5, 6, 7, 8 |
| 4 | M3 (direção) e M8 (estado do canal) | `M/direcao.ts`, `M/estado-canal.ts`, `TM/medidas-direcao-estado.test.ts` (novos) | 1 | 2, 3, 5, 6, 7, 8 |
| 5 | M4 (acerto), M6 (ritmo), M7 (engajamento) | `M/acerto.ts`, `M/ritmo.ts`, `M/engajamento.ts`, `TM/medidas-acerto-ritmo-engajamento.test.ts` (novos) | 1 | 2, 3, 4, 6, 7, 8 |
| 6 | M5(ii): subida e as mudanças antes dela | `M/subida.ts`, `TM/medidas-subida.test.ts` (novos) | 1 | 2 a 5, 7, 8 |
| 7 | M10: pico sem cauda | `M/pico.ts`, `TM/medidas-pico.test.ts` (novos) | 1 | 2 a 6, 8 |
| 8 | M11 e M12 | `M/comentarios.ts`, `TM/medidas-comentarios.test.ts` (novos) | 1 | 2 a 7 |
| 9 | Migration MG4 e a prova no banco. **Só na vez do lote** | `supabase/migrations/<carimbo>_observatorio_a5_e4_marcas_de_idade.sql` (novo, por `db:new`); `test/integration/observatorio-a5-e4-migration.test.ts`, `test/integration/observatorio-a5-e4-rls.test.ts` (novos) | aviso do controlador; arquivo da MG6, se for junto | todas, menos a 16 |
| 10 | O escritor das marcas | `M/fechar-marcas.ts`, `TM/medidas-fechar-marcas.test.ts` (novos) | 2; contrato da MG4 (neste plano) | 3 a 8 |
| 11 | **Integração na agenda** (pequena; `ordem: 5.5`, emenda 1) | `src/lib/youtube/agenda/tarefas/marcas-de-idade.ts` (novo); `src/lib/youtube/agenda/definicoes.ts`; `src/lib/youtube/agenda/catalogo.ts`; `test/youtube/agenda/catalogo.test.ts`; `test/youtube/agenda/tarefas.test.ts`; `test/youtube/agenda/saude.test.ts`; `test/youtube/agenda/despachante.test.ts` | 10; **Lote B commitado localmente (já está)** | nenhuma desta etapa; **fila com E10 e E16 parte 2** nos mesmos arquivos |
| 12 | A folga de 2 dias na faixa diária. **Envio próprio, o quanto antes; em produção no máximo até 30/10/2026** (emenda 1: d:I-1, s:I3; emenda 2: d:m-4) | `src/lib/youtube/competitor-tiers.ts`; `test/youtube/competitor-tiers.test.ts`; `src/lib/youtube/observatorio/rules.ts` (**uma chave na linha `series`**); `.superpowers/sdd/a5/conferencias-com-data.md` (uma linha) | **nada** (não depende mais da Tarefa 1); resposta à pergunta 1 (padrão: fazer) | nenhuma (vai antes da 1: as duas editam `rules.ts`; emenda 2: s:n4) |
| 13 | Leitores de servidor | `M/ler.ts`, `TM/medidas-ler.test.ts`, `TM/medidas-fixture.ts` (novos; emenda 1: s:m2: o falso de PostgREST nasce aqui) | 1; contrato da MG4 | 2 a 8, 10 |
| 14 | O montador e o teste do banco vazio | `M/do-canal.ts`, `TM/medidas-do-canal.test.ts` (novos); `TM/medidas-fixture.ts` (acrescenta a fixture cheia ao arquivo da Tarefa 13) | 2 a 8, 13 | 10, 11, 12 |
| 15 | Leitor dos insumos de comentários. **Espera a A4 em `staging`** | `M/ler-comentarios.ts`, `TM/medidas-ler-comentarios.test.ts` (novos) | 8, 13; `proprio/edicao.ts` no remoto | 16 |
| 16 | Testes de ponta contra o banco | `test/integration/observatorio-a5-e4-marcas.test.ts`, `test/integration/observatorio-a5-e4-medidas.test.ts` (novos) | 9 (MG4 no `bythiago_int`), 10, 13, 14 | nenhuma |
| 17 | Conferências com dado real: itens 29 e 30, e C-1 a C-17 | este plano (seções 3.2, 5.2 e 11), o ledger, `TM/medidas-m1.test.ts` (três casos novos) e `TM/medidas-fixture.ts` (bloco `retratosReais`) e `TM/medidas-direcao-estado.test.ts` (dois testes novos) (emenda 1: s:m2: a lista dizia "nenhum arquivo" e a tarefa mandava editar testes) | 2, 4, 13; o controlador roda as consultas | todas, menos as que editam os mesmos três arquivos de teste ao mesmo tempo |
| 18 | Envio e conferências | `src/lib/conferencias.ts`; `test/lib/conferencias.test.ts`; `.superpowers/sdd/a5/conferencias-com-data.md` | tudo (menos a 12, que já foi); MG4 em produção; **Lote B em produção** (emenda 1: s:I4) | |

**Ondas.**
- **Antes de tudo (emenda 1: d:I-1, s:I3):** a C-14 e a C-16, e a Tarefa 12, sozinha, com envio próprio o quanto antes (teto: 30/10/2026; emenda 2: d:m-4).
- **Já:** 1, sozinha. Depois, em paralelo: 2, 4, 5, 6, 7, 8, 13.
- **Em seguida:** 3 e 10 (precisam da 2); depois 14.
- **Depois:** 11, sozinha (arquivos da agenda, em fila com outras etapas). (reconciliação 13/10, emenda 2: D2-m6) **A 11 só é commitada com a MG4 em produção e conferida**, ou com `OBS_AGENDA_TASKS_OFF=marcas_de_idade` gravada na Vercel antes do envio que a leva e conferida no deploy dele. Sem isso a tarefa devolve `erro`, `schema_ausente`, todo dia até a MG4 (seção "Código novo sem a MG4"): nada se perde, mas é vermelho diário que esconde outro vermelho. A ordem das Ondas a punha antes da 9; a dependência "Lote B commitado localmente" não basta.
- **Na vez do lote:** 9; depois dela, 16. A 15 quando a A4 estiver em `staging`.
- **Em paralelo com tudo, assim que houver resposta do controlador:** 17. **Por último:** 18.

**Arquivos compartilhados com OUTRAS etapas da A5:**

| Arquivo | Quem mais mexe | Regra |
|---|---|---|
| `observatorio/rules.ts` | E2 (`series`, `promotion`), E14 (`comments`), E15 (`hourly`) | **a Tarefa 1**, uma linha nova (`measures: MEASURE_RULES,`) e uma importação, no molde de `comments: COMMENT_RULES`; **e a Tarefa 12** (emenda 1), uma chave nova dentro da linha `series` (`dailyGraceDays: 2`), em commit próprio; nenhuma outra chave é tocada |
| `agenda/definicoes.ts`, `agenda/catalogo.ts` e os quatro testes da agenda | E16 parte 2 (`soma_do_mapa`, `podas`), E10 (`tamanho_do_banco`) | **só a Tarefa 11**: uma constante `DEFINICAO_MARCAS_DE_IDADE`, a entrada em `TODAS_AS_DEFINICOES`, uma importação e uma entrada no `CATALOGO`. Os testes que dizem "cinco" passam a contar a lista (ou a dizer seis). Uma etapa por vez, na ordem que o controlador der. **(emenda 1: s:I2) Ninguém "encaixa número" depois: a ordem desta tarefa é 5.5 e não muda**, chegue ela antes ou depois de `soma_do_mapa` (3), `tamanho_do_banco` (4) e `podas` (5); os testes afirmam a posição por relação ("depois de toda leve do spec que já estiver no catálogo, antes das pesadas"), nunca por índice |
| `competitor-tiers.ts` e o teste dele | E2 (em produção), E9 | **só a Tarefa 12**, uma expressão. Conferido em 13/10: os dois arquivos são iguais aos de `origin/staging` e não têm mudança pendente na árvore de trabalho. **(reconciliação 13/10, emenda 1: D-C1) Isso prova que o commit aplica limpo sobre o remoto, e só isso: o envio segue o "Envio" da Tarefa 12** |
| `lib/conferencias.ts`, o teste e o espelho | todas | um bloco por etapa (`E4_DEPLOY` e `conferenciasE4`), **só a Tarefa 18**; a Tarefa 12 escreve só uma linha no espelho (o `.ts` local difere do remoto em 84 linhas de outros lotes e não pode ir no envio antecipado) |
| `competitor-health.ts` | E14, E15, E10 | **este plano não toca** (a função ausente é o `schema_ausente` do próprio resultado: F9) |
| `observatorio/load.ts`, `load-channel.ts`, `load-page.ts`, `pack.ts`, `types.ts`, `series.ts`, `channels.ts`, `multiplier.ts`, `effect.ts` | E2 Lote 2, A3, A4, E5, E9 | **este plano não toca**; importa `median` de `stats.ts`, `RULES` de `rules.ts`, `DAY`/`H`/`spDateOf` de `time.ts` |
| `observatorio/proprio/edicao.ts` | A4 | **não edita**; a Tarefa 15 importa |
| `test/helpers/fake-supabase.ts`, `fake-postgrest.ts`, `db-seed.ts`, `db-skip.ts` | A4, E1/E2, todas | **não toca**: os testes daqui montam o próprio falso em `TM/medidas-fixture.ts` |
| `supabase/migrations/…`: `competitor_channel_removal_impact` | MG9 (vigente), MG6 | **este plano não recria** (desvio 16) |
| `types/database.types.ts` | todas | **não toca** |
| `consumidores-semanal.test.ts` | E2, E5 | **não toca** (as medidas não leem os campos que ele guarda) |

**Restrições globais.** TypeScript estrito, sem `any`, sem `as unknown as` novo (`bash scripts/check-type-debt.sh`). Arquivos em kebab-case. Os módulos `M/*.ts` puros não importam `server-only`, banco nem rede; os três de servidor começam com `import 'server-only'`. Nenhum texto de exceção vai para coluna, motivo ou resumo: código de catálogo fechado; ao Sentry vão só o nome da classe e o SQLSTATE. Testes de servidor com `// @vitest-environment node`. Datas de teste relativas a um `AGORA` fixo do passado declarado no arquivo, ou com relógio falso; nenhuma data futura escrita. Todo padrão de variável tem teste que **apaga** a variável. Integração gated em `HAS_LOCAL_DB`, contra o `bythiago_int` (`HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres`), sem paralelismo entre arquivos; cada teste cria o **seu** site, canal e vídeos e nunca conta "o banco inteiro" (as três funções da MG4 são do banco inteiro: os testes afirmam sobre os ids que criaram, filtrando o retorno). Nunca chamar função como `anon` ou `authenticated` nesse Postgres (derruba o servidor): privilégio se prova por `has_function_privilege`. Cada tarefa termina com `npm run typecheck -w apps/web` limpo, os testes dos seus arquivos verdes e commit local por lista explícita de arquivos, sem push. Regras do implementador: `.superpowers/sdd/a5-e1-e2/regras-implementador.md`.

---

## 10. As tarefas

Em toda tarefa: **os testes são escritos antes e têm de falhar primeiro** (o vermelho vai no relatório `.superpowers/sdd/a5-e4/task-<N>-report.md`).

### Tarefa 1: regras, tipos e a regra de contagem

**Objetivo.** Um lugar só para os números, a forma do resultado e o corte de 24/08/2026.
**Contrato.**
- `M/regras.ts` (não importa nada): `export const MEASURE_RULES = { ruleVersion: 1, ages: [1, 7, 30], maxGapHours: 36, maxGapHoursDay1: 8, weeklyGapHours: 192, lateReadingHours: 1, batch: 1500, discoveredLateHours: 24, equalPct: 0.10, channelWindowDays: 90, curve: { ages: [1, 2, 3, 5, 7, 14, 21, 30, 60, 90], windowDays: 180, weeklyFromAge: 60 }, direction: { windowDays: 28, staleDays: 1 }, decline: { windows: 3 }, hit: { minAgeDays: 7, miss: 0.5, pctFromN: 10 }, rise: { factor: 2, minGain: 1000, days: 7, lookbackDays: 14 }, rhythm: { weeks: 13, gapWeeks: 26, minPosts: 4 }, engagement: { minViews: 100, todayMaxAgeDays: 90 }, stalled: { floorDays: 28, factor: 4 }, tail: { minAgeDays: 90, stillDays: 28 }, peak: { minV30: 1000, tailShare: 0.5, stillMax: 0.02, reactionShare: 0.5 }, comments: { minVideos: 5, pctFromN: 10, minVideoLikes: 100, windowDays: 90 }, lost: { alarmAges: [7, 30], weeklyTier30Counts: true }, countChange: '2026-08-24' } as const`. **(emenda 2: s:n1, d:m-3) `lost`** é a regra do aviso `marcas_perdidas`: `alarmAges` são as idades cuja perda deixa o disparo vermelho (a idade 1 fica fora até a `e4-d7`: C-8), e `weeklyTier30Counts` só passa a `false` se a pergunta 1 for respondida "não". **(emenda 1: s:m7(iv), d:m-1, s:I3) Três mudanças na lista:** `settleMinutes` saiu (nenhum código o lia; os 30 minutos de espera depois do fecho da idade moram só no SQL de `competitor_marks_pending`, e a Tarefa 9 os prova no banco); `dailyGraceDays` saiu daqui e foi para `RULES.series` (Tarefa 12); entrou `lateReadingHours: 1`, que `decidirMarca` lê e que é o mesmo `interval '1 hour'` de `competitor_marks_apply` (a Tarefa 9 prova a igualdade na borda).
- `rules.ts`: `import { MEASURE_RULES } from './medidas/regras'` e, dentro de `RULES`, `measures: MEASURE_RULES,` com o comentário "New (A5, E4)". Os limiares que já existem (`outlierMin`, `weakBase`, `medianMinN`, `habit.weeks`, `series.weeklyMaxGapDays`) **não são duplicados**: as medidas os leem de `RULES`.
- `M/tipos.ts`: `Medida<T>`, `Janela`, `Nota` (seção 4.5); `MotivoNaoMedido = 'leitura_comecou_depois' | 'descoberto_tarde' | 'leitura_parou_antes' | 'leituras_distantes' | 'sem_leitura' | 'views_ocultas' | 'fecha_em' | 'aguardando_calculo' | 'poucos_videos' | 'poucas_publicacoes' | 'ritmo_parcial' | 'sem_publicacao' | 'sem_registro_recente' | 'sem_registro_na_borda' | 'pouco_registro' | 'janela_cruza_mudanca_de_contagem' | 'contagem_recuou' | 'base_zero' | 'poucas_views' | 'poucas_curtidas' | 'sem_v30' | 'idade_menor_que_90' | 'ao_vivo_ou_estreia' | 'formato_nao_confirmado' | 'sem_reacao_publica' | 'curtidas_ocultas' | 'retrato_ausente' | 'sem_multiplo' | 'serie_nao_pedida' | 'serie_diaria_incompleta' | 'arquivado' | 'sem_permissao' | 'leitura_falhou' | 'calculo_falhou'` **(reconciliação 13/10: R3: mais `'coleta_pausada'`, 35 códigos; 0.1, dependência 3)** (emenda 1: s:m7(v): `calculo_falhou` é o que o montador devolve quando uma medida lança); `MOTIVOS_NAO_MEDIDO` (a lista, para teste e para a E5); `FaltaDeMarca` (os seis códigos da tabela de 4.2) e `FALTAS_DE_MARCA`; `Formato = 'long' | 'short'`; construtores `medido(valor, n, janela, notas?)` e `naoMedido(motivo, extra?)`. `medido` **lança** se `valor` for número não finito ou se algum número dentro dele for (é a última barreira contra `NaN` e `Infinity`).
- `M/contagem.ts`: `countRuleOf(dia: string): 'ate_2026-08-23' | 'desde_2026-08-24'` (dia de São Paulo `AAAA-MM-DD`; lança com data malformada) e `cruzaMudancaDeContagem(de: string, ate: string): boolean` (verdadeiro quando `de < '2026-08-24' <= ate`).
**Testes** (`medidas-regras.test.ts`).

| Nome | Entrada | Esperado |
|---|---|---|
| `RULES.measures é o MEASURE_RULES, valor por valor` | o objeto | cada número da lista acima |
| `os seis códigos de falta, na ordem da tabela de 4.2` | `FALTAS_DE_MARCA` | a lista escrita por extenso no teste (a igualdade com o `check` do banco é provada na Tarefa 9) |
| `a hora de folga do motivo é 1` (emenda 1; substitui `a espera é de 30 minutos`) | `lateReadingHours` | 1 (a igualdade com o SQL é provada na Tarefa 9, pelo teste `gravar: motivo antes de alvo + limite + 1 hora é recusado`) |
| `MEASURE_RULES não tem settleMinutes nem dailyGraceDays` | as chaves | ausentes (a folga da faixa é `RULES.series.dailyGraceDays`) |
| `o aviso de marca perdida vale para as idades 7 e 30, e a faixa semanal conta` (emenda 2: s:n1, d:m-3) | `lost` | `alarmAges` igual a `[7, 30]`; `weeklyTier30Counts` verdadeiro |
| `medido lança com NaN, Infinity e −Infinity, no topo e dentro do valor` | `medido(NaN, …)`, `medido({ variacao: Infinity, … }, …)` | lança |
| `naoMedido nunca tem valor` | `naoMedido('base_zero')` | sem a chave `valor` |
| `a regra de contagem: 23/08 é a antiga, 24/08 é a nova` | `'2026-08-23'`, `'2026-08-24'` | os dois nomes |
| `a janela cruza a mudança só quando começa antes e termina no dia ou depois` | (22/08, 23/08), (23/08, 24/08), (24/08, 30/09), (24/08, 24/08) | falso, verdadeiro, falso, falso |
| `data malformada lança` | `'24/08/2026'`, `''` | lança |
**Armadilha.** `rules.ts` importa `./medidas/regras`; por isso `regras.ts` não pode importar `rules.ts` (ciclo). Rodar depois os testes que comparam `RULES` por igualdade (`test/youtube/agenda/catalogo.test.ts`, `competitor-tiers.test.ts`, `comentarios-regras.test.ts`): nenhum pode mudar de expectativa.
**Pronto quando:** testes verdes; `grep -rn "measures" src/lib/youtube/observatorio/rules.ts` acha uma linha.

### Tarefa 2: M1 (a conta, a decisão, o vídeo e o canal)

**Arquivo.** `M/m1.ts` (puro).
**Contrato.**
- `interface Leitura { t: number; views: number; likes: number | null; comments: number | null }`.
- `baseDaIdade(v: { publishedAt: string | null; liveActualStartAt: string | null }): number | null` = o maior dos dois instantes; `null` sem `publishedAt`.
- `viewsNaIdade(leituras, baseMs, idadeDias, o: { maxGapHoras: number }): { medido: { views: number; likes: number | null; comments: number | null; antes: number; depois: number; gapHoras: number } } | { falta: 'sem_vizinha_antes' | 'sem_vizinha_depois' | 'distantes' }`. Ordena por `t`; ignora leitura com `t` ou `views` não finito; duas leituras no mesmo `t` valem uma (a de maior `views`); `views` = `Math.round` da interpolação; `likes` e `comments` interpolados **e arredondados com `Math.round`** (emenda 1: s:m3: as colunas são `bigint` e `jsonb_to_recordset` lança com 73,47, derrubando o lote inteiro em todo disparo) só quando as duas vizinhas têm o número, senão `null`.
- `interface PendenteDeMarca { videoId: string; siteId: string; idadeDias: 1 | 7 | 30; baseAt: number; baseAtIso: string; seriesTier: 'diaria' | 'semanal' | null; motivoAnterior: FaltaDeMarca | null; alvoAt: number; discoveredAt: number | null; missingSince: number | null; viewsHidden: boolean | null; likesHidden: boolean | null; commentsDisabled: boolean | null; primeiraLeituraAt: number | null; ultimaLeituraAt: number | null; leituras: Leitura[] }`. (reconciliação 13/10, emenda 2: S2-I2, D2-m4) **Mais um campo, obrigatório na forma: `cruzouPausa: boolean`**, que é `gap_crossed_pause` de `competitor_marks_pending` (Tarefa 8b, item 3). Ausente ou não booleano na resposta: `resposta_invalida`. (emenda 2: d:m-2, d:m-3, d:m-8) `baseAtIso` é o texto de `base_at` como veio do banco, guardado sem conversão; `seriesTier` e `motivoAnterior` são `series_tier` e `prev_reason` de `pending`.
- `decidirMarca(p: PendenteDeMarca, agoraMs: number): { tipo: 'marca'; linha: MarcaParaGravar } | { tipo: 'falta'; reason: FaltaDeMarca; sinceAt: number | null } | { tipo: 'aguardar' }`. `MarcaParaGravar = { video_id, age_days, base_at, views, likes, comments, likes_hidden, comments_disabled, read_before_at, read_after_at }` (ISO; emenda 2: d:m-2: `base_at` é `p.baseAtIso`, letra por letra, e o motivo mandado em `p_misses` leva o mesmo campo). `likes_hidden`: `false` com `likes` medido; `true` com `likes` nulo, `p.likesHidden === true` e `agoraMs − p.alvoAt <= 72 h`; senão `null`. O mesmo para `comments_disabled`. O limite é `maxGapHoursDay1` na idade 1 e `maxGapHours` nas outras. A ordem dos motivos é a da tabela de 4.2. **(emenda 1: d:m-1)** `falta` só sai com `agoraMs >= p.alvoAt + (limite + lateReadingHours) h`; antes disso, sem a vizinha de depois, é `aguardar`; **(emenda 2: d:m-9) e também é `aguardar` quando a vizinha de depois existe e as duas estão além do limite** (antes do prazo o resultado só pode ser `marca` ou `aguardar`). **(emenda 1: d:I-3)** `export function marcaPerdida(p: PendenteDeMarca, reason: FaltaDeMarca): boolean` = `reason` é `leituras_distantes` ou `leitura_parou_antes`, `p.primeiraLeituraAt !== null && p.primeiraLeituraAt < p.alvoAt` e `p.missingSince === null` (a série existia e o vídeo está no ar: foi a coleta que falhou). **(emenda 2: s:n3, d:m-8)** E `p.motivoAnterior` não é um desses dois códigos: perda que já estava registrada com a mesma base não é perda nova. **(emenda 2: s:n1, d:m-3)** (reconciliação 13/10, emenda 2: S2-I2, D2-m4) **`marcaPerdida` devolve falso quando `p.cruzouPausa` é verdadeiro**: buraco aberto por pausa feita de propósito não é perda da coleta. O motivo é gravado do mesmo jeito (`leituras_distantes` ou `leitura_parou_antes`); o que muda é a contagem (`pausadas` em vez de `perdidas`, Tarefa 10). Dois testes com estes nomes entram nos da Tarefa 2: `buraco que cruzou pausa não é marca perdida`; `buraco fora de pausa continua perdida`. `export function perdaAvisa(p: PendenteDeMarca): boolean` diz se a perda deixa o disparo vermelho: `MEASURE_RULES.lost.alarmAges` contém `p.idadeDias`, e não é o caso `p.idadeDias === 30 && p.seriesTier === 'semanal' && !MEASURE_RULES.lost.weeklyTier30Counts`.
- `m1DoVideo(e: { idadeDias: 1 | 7 | 30; baseMs: number | null; agendadoOuNoAr: boolean; agoraMs: number; marca: MarcaLida | null; falta: FaltaLida | null; leituras?: Leitura[] }): Medida<{ views: number; gapHoras: number; fonte: 'marca' | 'serie' }>`: `baseMs` nulo: `sem_publicacao`. **(emenda 1: d:C-1)** `agendadoOuNoAr`: `fecha_em` sem `fechaEm` (a idade não começou). Marca ou motivo cuja base gravada (`ageBaseAt`) é diferente de `baseMs` **não vale** (é tratado como ausente: a tarefa vai refazê-lo). Depois: marca gravada vence; depois o motivo gravado; depois `fecha_em` (idade não fechou; `fechaEm` = dia de São Paulo do alvo); depois, com `leituras`, a conta na hora (`fonte: 'serie'`) **se as duas vizinhas existem dentro do limite; se não existem, `aguardando_calculo`** (emenda 1: s:m7(ii): o leitor nunca devolve um dos seis motivos por conta própria); sem `leituras`, `aguardando_calculo`.
- `m1DoCanal(videos: VideoComM1[], o: { formato: Formato; idadeDias: 1 | 7 | 30; agoraMs: number }): Medida<number>`: mediana das views medidas dos vídeos do formato publicados nos últimos 90 dias; fora `was_live === true` (nota `ao_vivo_fora`), fora formato nulo (nota), dentro o vídeo com `missingSince` (nota `fora_do_ar_dentro`), dentro `was_live` nulo (nota `ao_vivo_nao_se_sabe`); menos de `RULES.weakBase` medidos: `poucos_videos` com `n` e `minimo`.
**Testes** (`medidas-m1.test.ts`).

| Nome | Entrada | Esperado |
|---|---|---|
| `interpola entre as duas vizinhas` | 700 em alvo − 6 h 50 min, 800 em alvo + 17 h 10 min | 728 (700 + 100 × 410 ÷ 1.440 = 728,47), `gapHoras` 24 |
| `leitura exatamente no instante alvo` | leitura em `alvo` com 512 | 512, `gapHoras` 0, `antes === depois` |
| `exatamente 36 horas mede; 36 horas e 1 ms não` | vizinhas a 36 h e a 36 h + 1 ms | medido; `distantes` |
| `idade 1: exatamente 8 horas mede; 8 horas e 1 ms não` | idem com 8 h | medido; `distantes` |
| `lista vazia` | `[]` | `sem_vizinha_antes` |
| `só leituras depois do alvo` / `só antes` | | `sem_vizinha_antes` / `sem_vizinha_depois` |
| `não existe ponto de zero na publicação` | uma leitura em alvo + 1 h, nada antes | falta (nunca interpola a partir de 0) |
| `leitura com views NaN, nulo ou texto é ignorada, nunca vale 0` | uma vizinha inválida no meio | usa a vizinha válida seguinte, ou falta |
| `fora de ordem e repetida no mesmo instante` | lista embaralhada, duas no mesmo `t` | o mesmo resultado da lista ordenada |
| `views que caem entre as leituras` | 800 e 700 | interpola (750 no meio), não lança |
| `curtidas: as duas medidas interpola; uma nula dá nulo` | | número; `null` |
| `curtidas e comentários interpolados são inteiros` (emenda 1: s:m3) | curtidas 70 e 80, comentários 3 e 4, alvo a 410 de 1.440 minutos | `Number.isInteger` nos dois (73 e 3), nunca 72,85 |
| `base: estreia posterior à publicação` | `publishedAt` 01/11, `liveActualStartAt` 03/11 | 03/11; sem `publishedAt`: `null` |
| `decidir: marca assim que a vizinha de depois existe, mesmo antes do limite` | alvo há 2 h, `b` há 1 h | `marca` |
| `decidir: sem a vizinha de depois e alvo há 35 horas: aguardar` | | `aguardar` |
| `decidir: sem a vizinha de depois e alvo há 36 horas e 59 minutos: aguardar; há 37 horas exatas: motivo` (emenda 1: d:m-1; era "36 horas e 1 minuto") | | `aguardar`; `falta`, `leitura_parou_antes` ou `leituras_distantes` conforme `ultimaLeituraAt` |
| `decidir, idade 1: 8 horas e 59 minutos aguarda; 9 horas decide` (emenda 1) | | `aguardar`; `falta` |
| `decidir: com a vizinha de depois além do limite e antes do prazo: aguardar; no prazo: leituras_distantes` (emenda 2: d:m-9) | idade 7, `a` 30 h antes do alvo e `b` 10 h depois (40 h); `agoraMs` = alvo + 36 h 59 min e alvo + 37 h | `aguardar`; `falta`, `leituras_distantes` |
| `a marca e o motivo levam a base como veio do banco` (emenda 2: d:m-2) | `baseAtIso` com microssegundos (`2026-11-01T10:00:00.123456+00:00`) | `linha.base_at` é o mesmo texto, letra por letra |
| `marca perdida: motivo anterior igual não conta de novo` (emenda 2: s:n3, d:m-8) | `motivoAnterior` `leituras_distantes`, `leitura_parou_antes`, `leitura_comecou_depois` e nulo | falso, falso, verdadeiro, verdadeiro |
| `a perda avisa nas idades 7 e 30 e não na 1` (emenda 2: s:n1) | um par de cada idade; idade 30 com `seriesTier` `'semanal'` | falso, verdadeiro, verdadeiro; `'semanal'` continua verdadeiro com `weeklyTier30Counts` verdadeiro |
| `idade 1 só com série diária é marca perdida e não avisa` (emenda 2: s:n1) | leituras diárias às 12 h de dois dias seguidos, alvo às 08:00 do segundo, decisão no prazo | `falta`, `leituras_distantes`; `marcaPerdida` verdadeiro; `perdaAvisa` falso |
| `marca perdida: série que existia antes do alvo, vídeo no ar, motivo distantes ou parou_antes` (emenda 1: d:I-3) | os quatro cruzamentos, mais vídeo com `missingSince`, mais `leitura_comecou_depois` | verdadeiro só no primeiro caso |
| `decidir: a ordem dos seis motivos` | um caso por linha da tabela de 4.2, e os casos de empate (sem leitura e `views_hidden` verdadeiro; primeira leitura depois do alvo com e sem `discoveredAt`; `discoveredAt` a exatamente 24 h da base) | o código de cada linha; a exatamente 24 h é `leitura_comecou_depois` |
| `decidir: likes_hidden verdadeiro só com o sinalizador e até 72 horas do alvo` | `likes` nulo com sinalizador verdadeiro a 71 h e a 73 h; sinalizador nulo | `true`; `null`; `null` |
| `vídeo: a marca gravada vence a série` | marca 500 e série que daria 520 | 500, `fonte: 'marca'` |
| `vídeo: idade não fechada diz a data` | base há 6 dias, idade 7 | `fecha_em`, `fechaEm` = amanhã |
| `vídeo: fechada, sem marca, sem motivo, sem série` | | `aguardando_calculo` |
| `vídeo: fechada, com a série e sem a vizinha de depois: aguardando_calculo, nunca um dos seis motivos` (emenda 1: s:m7(ii)) | | `aguardando_calculo` |
| `vídeo agendado ou no ar: fecha_em sem data` (emenda 1: d:C-1) | `agendadoOuNoAr` verdadeiro, base há 40 dias | `fecha_em`, sem `fechaEm` |
| `vídeo: marca com a base antiga não vale` (emenda 1: d:C-1) | marca com `ageBaseAt` 2 dias antes de `baseMs`, sem série | `aguardando_calculo` (nunca o número da marca) |
| `canal: 3 medidos mede, 2 não` (limiar) | | mediana, `n: 3`; `poucos_videos`, `n: 2`, `minimo: 3` |
| `canal: ao vivo fica fora e é contado` (item 31) | 4 vídeos, 1 com `wasLive` | `n: 3`, nota `ao_vivo_fora` com 1 |
| `canal misto: longos e Shorts nunca na mesma mediana` (item 32) | 3 longos de 1.000 e 3 Shorts de 100.000 | formato longo: 1.000; Shorts: 100.000 |
| `canal: formato não confirmado fica fora e é contado` | | nota com o número |
| `canal: vídeo fora do ar continua e é contado` | | dentro; nota `fora_do_ar_dentro` |
| `canal sem vídeo` | `[]` | `poucos_videos`, `n: 0` |
**Pronto quando:** testes verdes; `grep -n "viewsAtAge\|pointViews" M/` vazio.

### Tarefa 3: M2 (curva por idade) e M9 (cauda)

**Arquivos.** `M/curva.ts`, `M/cauda.ts` (puros).
**Contrato.**
- `curvaDoCanal(videos: VideoComSerie[], o: { formato; agoraMs }): Medida<PontoDaCurva[]>`, `PontoDaCurva = { idadeDias: number; ponto: Medida<number>; relativoAV30: Medida<number> }`. Vídeos do formato publicados nos últimos 180 dias. Nas idades 1, 7 e 30 usa `m1DoVideo` (marca primeiro); nas outras, `viewsNaIdade` sobre a série com 36 h, e com 192 h nas idades de 60 em diante (nota `serie_semanal` quando a distância usada passou de 36 h). Cada ponto tem o seu `n`; ponto com menos de 3: `poucos_videos`. `relativoAV30` = mediana, entre os vídeos que têm as duas, de `views na idade ÷ V30`; V30 igual a 0: o vídeo sai dessa razão (`base_zero` se não sobrar 3). A medida de fora é `medido` se algum ponto mediu; senão `poucos_videos`. Sem a série pedida: `serie_nao_pedida` nos pontos que dependem dela, e os de 1, 7 e 30 seguem pelas marcas.
- `caudaDoVideo(e: { v30: Medida<…>; viewsHoje: number | null; idadeDias: number; leituras?: Leitura[]; agoraMs }): { cauda: Medida<number>; aindaRende: Medida<number> }`. `cauda = (viewsHoje − V30) ÷ viewsHoje`. Não medido: idade menor que 90 (`idade_menor_que_90`), V30 não medido (`sem_v30`), `viewsHoje` nulo (`sem_leitura`), `viewsHoje` 0 (`base_zero`). `viewsHoje < V30` (contagem recuou): `contagem_recuou`. `aindaRende = (views agora − views 28 dias atrás) ÷ V30`, com as duas pontas por `viewsNaIdade` a 192 h; ponta sem vizinhas: `serie_diaria_incompleta`; V30 igual a 0: `base_zero`; sem `leituras`: `serie_nao_pedida`.
**Testes** (`medidas-curva-cauda.test.ts`): `ponto com 3 vídeos mede e com 2 não, e cada ponto escreve o seu n`; `ao vivo e formato não confirmado fora, contados`; `idade 60 aceita vizinhas a 8 dias e leva a nota; idade 14 não aceita`; `relativo a V30: V30 zero sai da razão e nunca dá Infinity`; `sem a série: 1, 7 e 30 pelas marcas, as outras serie_nao_pedida`; `nenhum vídeo: poucos_videos em todos os pontos`; `cauda: idade 89 não mede, 90 mede`; `cauda sem V30`; `cauda com views de hoje zero, nulo, e menor que V30`; `cauda: conta à mão` (hoje 10.000, V30 4.000: 0,6); `ainda rende: conta à mão e V30 zero`; `ainda rende com buraco de 9 dias na ponta: serie_diaria_incompleta`.
**Pronto quando:** testes verdes.

### Tarefa 4: M3 (direção) e M8 (estado do canal)

**Arquivos.** `M/direcao.ts`, `M/estado-canal.ts` (puros).
**Contrato.**
- `interface RetratoDoCanal { dia: string; views: number | null }` (dia de São Paulo; `views` nulo = sem registro).
- `direcaoDe(variacao: number): 'subindo' | 'igual' | 'descendo'`: `>= +0,10` sobe, `<= −0,10` desce.
- `direcaoDoCanalInteiro(retratos, hojeSP): Medida<{ variacao; direcao; ganhoRecente; ganhoAnterior }>` (M3 a). `D` = o retrato mais recente com views; se for anterior a ontem: `sem_registro_recente`. Precisa de views em `D`, `D − 28` e `D − 56` exatos; faltou um: `sem_registro_na_borda` com `desde` = o dia que faltou; série com menos de 56 dias: `pouco_registro`. Algum ganho negativo: `contagem_recuou`. Ganho anterior 0: `base_zero`. `variacao = ganhoRecente ÷ ganhoAnterior − 1`. Nota `mudanca_de_contagem` quando `cruzaMudancaDeContagem(D − 56, D)`.
- `direcaoDosVideosNovos(videos, o: { agoraMs; base: 'views_de_hoje' | 'v30' }): Medida<…>` (M3 b e c): mediana dos longos de até 90 dias ÷ a dos de 91 a 180 dias, menos 1. Menos de 3 em algum período: `poucos_videos` (com `n` do menor). Mediana anterior 0: `base_zero`. Só longos de formato confirmado; `views_hidden` e views nulas ficam fora. **(emenda 2: d:m-7)** Vídeo agendado ou no ar (`agendadoOuNoAr`, do `live_broadcast_content` que o leitor da Tarefa 13 já traz) fica fora dos dois períodos, com a nota `agendado_fora` e o número.
- `estadoDoCanal(e: { missingSince: string | null; ultimaPublicacaoMs: number | null; intervaloMedianoDias: number | null; retratos; hojeSP; agoraMs; collectionPausedAt: string | null }): { estado: 'fora_do_ar' | 'pausado' | 'parado' | 'em_queda' | 'ativo'; parado: Medida<{ dias: number; limite: number }>; queda: Medida<{ janelas: number[] }> }`. ~~Precedência: fora do ar, parado, em queda, ativo.~~ (reconciliação 13/10, emenda 2: S2-m4: a precedência que vale é a do fim deste item, com `pausado` em segundo) **(reconciliação 13/10: R3) Canal com a coleta pausada (`collectionPausedAt` preenchido) não é `parado` nem `ativo`: ver 0.1, dependência 3.** Parado: `dias > max(28, 4 × intervalo)`; intervalo nulo usa só 28. Sem publicação: `parado` não medido (`sem_publicacao`). Queda: M3(a) calculada em `D`, `D − 28` e `D − 56` (cinco bordas, 112 dias), as três `<= −0,10`; não medida se faltar borda, e `janela_cruza_mudanca_de_contagem` se `cruzaMudancaDeContagem(D − 112, D)`. **Queda não medida não é "ativo por falta":** o estado é `ativo` e `queda.estado` diz `nao_medido`; a E5 mostra os dois. **(reconciliação 13/10, emenda 1: S-I2) O literal é `'pausado'` e a precedência passa a ser: fora do ar, pausado, parado, em queda, ativo. Com `collectionPausedAt` preenchido, `parado` e `queda` saem `nao_medido` com o motivo `coleta_pausada`. Testes com estes nomes: `canal pausado: estado é pausado, nunca parado nem ativo`; `canal pausado e fora do ar: fora_do_ar vence`; `canal pausado: parado e queda saem nao_medido com coleta_pausada`; `canal despausado: volta à precedência normal`.**
**Testes** (`medidas-direcao-estado.test.ts`): `exatamente +10% sobe; +9,99% é igual; exatamente −10% desce; −9,99% é igual`; `conta à mão com três retratos` (1.000.000, 1.100.000, 1.230.000: ganhos 100.000 e 130.000, variação +0,30); `falta o dia da borda: sem_registro_na_borda com a data`; `views nulo na borda é sem registro, nunca zero` (o caso do F6: não pode sair −100%); `só 55 dias de série`; `ganho anterior zero: base_zero, nunca Infinity`; `ganho negativo: contagem_recuou`; `último retrato de anteontem: sem_registro_recente; de ontem mede`; `janela de 01/08 a 26/09 leva a nota de mudança de contagem; de 24/08 a 19/10 não leva`; `lista vazia`; `vídeos novos: 3 e 3 medem, 2 e 5 não`; `vídeos novos com V30: sem marcas é poucos_videos`; `Shorts e formato não confirmado nunca entram`; `mediana anterior zero`; `parado: exatamente 28 dias não é, 29 é (sem intervalo)`; `parado: intervalo de 10 dias dá limite 40; 40 não é, 41 é`; `fora do ar vence parado`; `queda: três janelas em −10% exato é queda; uma em −9,99% não é`; `queda: 111 dias de registro não mede`; `queda antes de 14/12/2026 cruza a mudança` (com `hojeSP` = 13/12/2026 e 14/12/2026: não medida, medida); `queda não medida deixa o estado ativo e diz que a queda não foi medida`; `vídeos novos: o agendado e o que está no ar ficam fora e são contados` (emenda 2: d:m-7; 3 e 3 medem, mais um `'upcoming'` com 0 views no período recente: a mediana não muda e a nota diz 1).
**Pronto quando:** testes verdes.

### Tarefa 5: M4 (acerto), M6 (ritmo), M7 (engajamento)

**Arquivos.** `M/acerto.ts`, `M/ritmo.ts`, `M/engajamento.ts` (puros).
**Contrato.**
- `taxaDeAcerto(videos: Array<{ formato: Formato | null; idadeDias: number; multiplo: number | null; baseFraca: boolean }>, o: { formato }): Medida<{ acertos; fracassos; total; pctAcerto: number | null; pctFracasso: number | null }>`. Entram os do formato, de 7 a 90 dias, com `multiplo` não nulo e base não fraca. Menos de `RULES.medianMinN` (5): `poucos_videos`. Acerto: `>= RULES.outlierMin`; fracasso: `<= 0,5`. Percentual só com `total >= 10`, senão `null` (a tela escreve "3 de 12"). **O múltiplo vem do motor** (`multiplierAt`), calculado por quem chama; a função não o recalcula. Lista sem nenhum múltiplo: `sem_multiplo`.
- `ritmo(publicacoesMs: number[], o: { agoraMs; parcial: boolean }): Medida<{ porSemana: number; intervaloMedianoDias: number; semanasComPublicacao: number; semanas: 13; maiorBuracoDias: number }>`. Janela de 13 semanas para as três primeiras; 26 para o buraco (maior distância entre publicações seguidas dentro das 26 semanas, e entre a última e agora). Menos de 4 publicações nas 13 semanas: `poucas_publicacoes`. `parcial` (canal ainda buscando vídeos): `ritmo_parcial`. Chamada por formato.
- `engajamentoDoVideo(e: { views30; likes30; comments30; temMarca30: boolean; viewsHoje; likesHoje; commentsHoje; likesHidden: boolean | null; commentsDisabled: boolean | null; idadeDias }): Medida<{ taxa: number; curtidasPorView: number | null; comentariosPorView: number | null; base: 'idade_30' | 'total_de_hoje' }>`. Com a marca de 30 dias usa os três números dela; sem, e com até 90 dias de idade, os de hoje (nota `total_de_hoje`). Views abaixo de 100: `poucas_views`. Curtidas e comentários nulos: `sem_reacao_publica`. Só um nulo: mede com o outro e a nota `so_curtidas` ou `so_comentarios`. **Zero com sinalizador nulo vale como nulo** (C-7). (emenda 1: d:m-5) O parâmetro `relidoDepoisDaE1` saiu: ninguém dizia de onde ele vinha e não há no código o instante do envio da E1. O sinal é o próprio sinalizador: a E1 grava `likes_hidden` e `comments_disabled` como booleano em toda leitura em que a parte de estatísticas veio (`competitor-capture.ts:159`), então nulo quer dizer "ainda não relido depois da E1" e `false` quer dizer "relido, e o zero é zero medido". Sem marca e com mais de 90 dias: `sem_v30`.
- `engajamentoDoCanal(videos, o: { formato }): Medida<number>`: mediana das taxas medidas **da mesma base e do mesmo componente**; fora ao vivo e formato não confirmado, contados; menos de 3: `poucos_videos`.
- **(emenda 2: d:m-7, que fecha a dívida 8) Vídeo agendado ou no ar fica fora das medidas de hoje.** `engajamentoDoCanal` e `taxaDeAcerto` recebem `agendadoOuNoAr` em cada vídeo e o deixam de fora, com a nota `agendado_fora` e o número; `engajamentoDoVideo` de um vídeo assim responde `fecha_em` sem data (a idade não começou). Para `ritmo` (M6) e para a última publicação de M8, quem monta a lista (Tarefa 14) deixa de fora o vídeo `'upcoming'`: transmissão marcada para a semana que vem não é publicação. **Diferença em relação ao pedido do parecer, que tirava também o `'live'` de M6 e M8:** o vídeo que está no ar agora começou, e conta como publicação no instante em que começou (`baseDaIdade`); tirá-lo faria um canal que está transmitindo neste momento aparecer como parado.
**Testes** (`medidas-acerto-ritmo-engajamento.test.ts`): `acerto: múltiplo exatamente 2 conta; 1,99 não; fracasso exatamente 0,5 conta; 0,51 não`; `5 vídeos mede, 4 não`; `percentual com 10, sem percentual com 9`; `vídeo de 6 dias fica fora, de 7 entra; de 91 fica fora`; `base fraca e múltiplo nulo ficam fora`; `nenhum múltiplo: sem_multiplo`; `ritmo: 4 publicações mede, 3 não`; `ritmo: conta à mão` (publicações a cada 7 dias: intervalo 7, 13 de 13, buraco 7); `maior buraco inclui o trecho da última publicação até agora`; `ritmo parcial`; `lista vazia`; `engajamento: usa a marca de 30 quando existe`; `sem marca e 90 dias: total de hoje com a nota; 91 dias: sem_v30`; `99 views não mede, 100 mede`; `só curtidas, só comentários, nenhum`; `zero com sinalizador nulo é nulo; zero com sinalizador falso é zero medido` (emenda 1: d:m-5); `views zero: poucas_views, nunca divisão`; `canal: não mistura base de 30 dias com total de hoje`; `canal: ao vivo fora e contado` (item 31); (emenda 2: d:m-7) `acerto: vídeo agendado ou no ar fica fora e é contado`; `engajamento do canal: vídeo agendado com zero views não entra na mediana e é contado`; `engajamento do vídeo agendado: fecha_em sem data`.
**Pronto quando:** testes verdes.

### Tarefa 6: M5(ii), a subida e o que mudou antes

**Arquivo.** `M/subida.ts` (puro). M5(i) é o `effectAt` que já existe: **não é reescrito nem embrulhado**.
**Contrato.**
- `subidasDoVideo(pontos: Array<{ dia: string; t: number; views: number }>, mudancas: Array<{ campo: CampoDeMudanca; em: number }>): Medida<Subida[]>`, `Subida = { dia: string; ganho7: number; ganho7Antes: number; fator: number | null; mudancasAntes: Array<{ campo; em }> }`, `CampoDeMudanca = 'titulo' | 'miniatura' | 'descricao' | 'tags' | 'categoria' | 'duracao' | 'idioma' | 'capitulos'`.
- Regra: para cada dia `d` com ponto em `d − 7`, `d` e `d + 7` **e os 15 dias de `d − 7` a `d + 7` presentes**: `ganho7 = views(d + 7) − views(d)`, `ganho7Antes = views(d) − views(d − 7)`. É subida quando `ganho7 >= 1.000` e `ganho7 >= 2 × ganho7Antes`. Vale só o **primeiro** dia de cada sequência (dias seguidos que cumprem a regra são uma subida). `fator = ganho7 ÷ ganho7Antes`; com `ganho7Antes <= 0` o fator é `null` (nunca `Infinity`). `mudancasAntes` = as de `[d − 14 dias, d)`.
- Nenhum trecho de 15 dias completos na série: `serie_diaria_incompleta` (é o estado do vídeo em faixa semanal). Série vazia: `sem_leitura`. Com trecho completo e nenhuma subida: `medido`, lista vazia.
- `capitulosDe(texto: string | null): string[] | null`: as linhas que começam com `m:ss` ou `h:mm:ss`; `null` sem texto. Duas descrições com listas diferentes = mudança `capitulos`; texto ausente em uma delas = não se afirma (a mudança não é listada).
**Testes** (`medidas-subida.test.ts`): `ganho exatamente 1.000 e exatamente 2 vezes é subida; 999 não; 1,99 vezes não`; `ganho anterior zero: é subida com fator nulo`; `ganho anterior negativo: fator nulo`; `falta um dos 15 dias: aquele dia não é avaliado`; `só pontos semanais: serie_diaria_incompleta`; `série vazia`; `três dias seguidos cumprindo: uma subida, no primeiro`; `duas subidas separadas`; `mudança exatamente 14 dias antes entra; 14 dias e 1 ms não; no próprio dia não`; `trecho completo sem subida: medido com lista vazia`; `capítulos: extrai, ignora linha comum, texto nulo dá nulo`.
**Pronto quando:** testes verdes.

### Tarefa 7: M10 (pico sem cauda)

**Arquivo.** `M/pico.ts` (puro).
**Contrato.**
- `TEXTO_OBRIGATORIO_M10` (a frase do spec, 04, logo abaixo da tabela, letra por letra) e `NOME_INTERNO_M10 = 'pico_sem_cauda'`.
- `picoSemCauda(e: { wasLive: boolean | null; idadeDias; v30: number | null; cauda: number | null; aindaRende: number | null; reacao: { taxa: number; componente: 'os_dois' | 'so_curtidas' | 'so_comentarios' } | null; canal: { nElegiveis: number; medianaV30: number | null; medianaCauda: number | null; medianaReacao: number | null } }): Medida<{ leitura: 'pico_sem_cauda' | 'nao_e_o_caso'; condicoes: { muitasViewsCedo: boolean; quaseNadaDepois: boolean; poucaReacao: boolean }; numeros: {…os seis números usados…} }>`.
- Não medido, nesta ordem: `ao_vivo_ou_estreia` (`wasLive === true`); `idade_menor_que_90`; `sem_v30`; `poucas_views` (V30 < 1.000); `poucos_videos` (canal com menos de `RULES.medianMinN` vídeos do formato com V30 e 90 dias); `sem_reacao_publica` (`reacao` nula); `base_zero` (alguma mediana 0 ou nula); `serie_diaria_incompleta` (cauda ou "ainda rende" nulos).
- Condições: (i) `v30 >= RULES.outlierMin × medianaV30`; (ii) `cauda <= 0,5 × medianaCauda` **e** `aindaRende <= 0,02`; (iii) `reacao.taxa <= 0,5 × medianaReacao` (a mediana do mesmo componente: desvio 12). As três: `pico_sem_cauda`. Qualquer outra combinação: `nao_e_o_caso`. **Nunca nota, nunca percentual.**
**Testes** (`medidas-pico.test.ts`, item 55): `V30 exatamente 2 vezes a mediana cumpre; 1,99 não`; `cauda exatamente metade cumpre; um pouco acima não`; `ainda rende exatamente 2% cumpre; 2,01% não`; `reação exatamente metade cumpre`; `duas de três condições é nao_e_o_caso` (os três pares); `as três: pico_sem_cauda`; `curtidas ocultas e comentários desligados: sem_reacao_publica, mesmo com as outras duas cumpridas`; `canal com 4 elegíveis não mede, com 5 mede`; `ao vivo e estreia ficam fora`; `V30 de 999 não mede, de 1.000 mede`; `idade 89 não mede`; `mediana zero: base_zero`; `o texto obrigatório é o do spec e não tem a palavra "retenção"`; `o resultado não tem campo de nota nem de percentual` (as chaves do `valor` são exatamente `leitura`, `condicoes`, `numeros`).
**Pronto quando:** testes verdes.

### Tarefa 8: M11 e M12

**Arquivo.** `M/comentarios.ts` (puro).
**Contrato.**
- `criadorResponde(videos: Array<{ formato: Formato | null; idadeDias: number; retrato30: 'ok' | 'sem_comentarios' | 'desligados' | 'erro' | null; algumComRespostaDoCriador: boolean }>, o: { formato; coletaDesdeMs: number | null; agoraMs }): Medida<{ com: number; total: number; pct: number | null }>`. Entram os do formato, de até 90 dias, com `retrato30 === 'ok'`. Menos de 5: `poucos_videos`; coleta começou há menos de 30 dias (ou `coletaDesdeMs` nulo): `fecha_em` com a data (ou `retrato_ausente`). Percentual só com 10 ou mais. **O nome do campo é `com`, nunca "sem": o que a medida não viu não é afirmado** (item 124; a frase "não vimos resposta" é da E5).
- `pesoDoComentarioDeTopo(e: { marco: 7 | 30; retrato: status | null; maiorCurtidasDeComentario: number | null; curtidasDoVideoNaMarca: number | null; likesHiddenNaMarca: boolean | null }): Medida<number>`. Recebe também `marca: 'gravada' | 'aguardando' | FaltaDeMarca`. Não medido, nesta ordem: `retrato_ausente` (retrato nulo ou diferente de `ok`, ou `maiorCurtidasDeComentario` nulo); o próprio código de falta quando a marca do vídeo tem motivo registrado; `aguardando_calculo` quando a marca ainda não foi decidida; `curtidas_ocultas` (`curtidasDoVideoNaMarca` nulo com `likesHiddenNaMarca` verdadeiro); `sem_reacao_publica` (curtidas nulas sem o sinalizador: não se sabe); `poucas_curtidas` (menos de 100 curtidas no vídeo, o que também cobre o divisor zero). Valor = `maior ÷ curtidasDoVideo`.
- `pesoDoComentarioDeTopoDoCanal(valores: Medida<number>[]): Medida<number>`: mediana dos medidos; menos de 3: `poucos_videos`.
**Testes** (`medidas-comentarios.test.ts`, item 124): `4 vídeos com retrato ok não mede, 5 mede`; `exatamente 10 vídeos tem percentual; 9 não`; `retrato desligados, sem_comentarios e erro ficam fora da base`; `coleta há 29 dias: fecha_em com a data; há 30: mede`; `nenhum vídeo`; `o valor não tem nenhum campo que afirme "não respondeu"` (as chaves são `com`, `total`, `pct`); `M12: 99 curtidas no vídeo não mede, 100 mede`; `curtidas do vídeo ocultas`; `curtidas nulas sem o sinalizador: sem_reacao_publica`; `retrato desligados`; `marca ainda não decidida: aguardando_calculo`; `marca com motivo registrado devolve o motivo`; `zero curtidas no vídeo nunca divide`; `conta à mão` (300 ÷ 1.200 = 0,25); `canal: 3 mede, 2 não`; `longos e Shorts separados`.
**Pronto quando:** testes verdes.

### Tarefa 8b: a pausa de coleta no SQL da MG4 (reconciliação 13/10, emenda 1: D-I1, S-I2)

**Bloqueia a Tarefa 9.** A R3 da reconciliação (seção 0.1, dependência 3) mudou o SQL da MG4 e o Apêndice A não a tem. Esta tarefa escreve, roda e leva aos dois especialistas; sem o acordo deles a Tarefa 9 não cria o arquivo.
**Depende de:** o SQL da MG6 (Apêndice A do plano da E10, na forma final da Tarefa 1 de lá) aplicado no `bythiago_int` antes, pelo controlador. Sem `competitor_channels.collection_paused_at` e sem `competitor_collection_pauses` não há o que rodar.
**Arquivos.** O Apêndice A, o Apêndice B (roteiro) e o Apêndice C (saída) deste plano; `.superpowers/sdd/a5-e4/sql/` (ensaio e saída).
**O que entra no Apêndice A, e só isto.**
1. **Guarda, primeira instrução do arquivo:** se `competitor_channels.collection_paused_at` não existe, `raise exception 'MG4 depende da MG6'`. A migration não se aplica pela metade.
2. **`competitor_marks_pending`:** deixa de fora o vídeo cujo canal tem `collection_paused_at` preenchido. O par não ganha marca nem motivo enquanto a pausa durar.
3. **~~A prova (a função que devolve `total_pendentes`, `atrasadas` e `perdidas`)~~ (reconciliação 13/10, emenda 2: S2-I2, D2-m4) Não existe função com essas três chaves, e o item como estava não se implementava: `total_pendentes` sai de `competitor_marks_pending`, `atrasadas` de `competitor_marks_health`, e `perdidas` é contada no TypeScript (`marcaPerdida`, Tarefa 2; contrato da Tarefa 10). O item passa a ser, função por função:**
   - **`competitor_marks_pending`:** devolve `pares_em_pausa` ao lado de `total_pendentes` (os pares que o item 2 deixou de fora; nunca somados a `total_pendentes`), e, **em cada item**, o booleano `gap_crossed_pause`: verdadeiro quando existe linha de `competitor_collection_pauses` do canal do vídeo com `paused_at` anterior ao fim do intervalo sem leitura e `coalesce(resumed_at, p_now)` posterior ao começo dele. O intervalo vai da última leitura antes do alvo (ou do alvo, se não houver) até a primeira depois dele (ou `p_now`). (reconciliação 13/10, emenda 3: n2) **A interseção sozinha absolve demais: uma pausa de 20 minutos dentro de um buraco de 4 dias de coleta falhando tiraria o par de `perdidas`, e o alarme deixaria de tocar por uma perda que a pausa não causou. A definição passa a ser: `gap_crossed_pause` é verdadeiro quando a duração do intervalo sem leitura, MENOS a soma das interseções dele com as pausas do canal (pausas sobrepostas contadas uma vez), cabe no limite do par (`p_gap_hours_day1` na idade 1, `p_gap_hours` nas outras: os dois parâmetros que a função já recebe). Isto é, a pausa só explica o buraco se o tempo NÃO pausado dele coubesse no limite. Sem pausa que toque o intervalo: falso, como antes. Desenho do parecer de dados da rodada 3; não rodado; vai aos dois especialistas nesta tarefa, junto com o resto do item.**
   - **`competitor_marks_health`:** tira de `atrasadas` o par de canal com `collection_paused_at` preenchido. A saída dela continua com as seis chaves de hoje.
   - **O escritor (Tarefas 2 e 10), em TypeScript:** `PendenteDeMarca` ganha `cruzouPausa`; `marcaPerdida` devolve falso com ele verdadeiro; `numeros.pausadas` conta os motivos mandados nesta execução que seriam perda sem a pausa (motivo `leituras_distantes` ou `leitura_parou_antes`, série antes do alvo, vídeo no ar, `cruzouPausa` verdadeiro) e `numeros.pares_em_pausa` repete o número do banco. Nenhum dos dois entra no veredito.
   - **O `check` de `reason` de `competitor_video_mark_misses` fica com os seis valores (decisão desta emenda, a confirmar pelos dois especialistas nesta tarefa).** O motivo gravado é o que aconteceu com as leituras; a causa "pausa" não é copiada para a linha porque já está em `competitor_collection_pauses`, que guarda `paused_at` e `resumed_at` e não é apagada no despausar, e o leitor que precisar dela usa o mesmo predicado de interseção. Um sétimo valor mudaria `FaltaDeMarca`, os seis contadores `faltas_*` e a regra de `motivoAnterior` da reabertura, três contratos já fechados com teste. Se os especialistas preferirem o sétimo valor, as Tarefas 2 e 10 mudam junto, antes da Tarefa 9.
   - As duas chaves entram no detalhe da execução e na seção 6.1. **Nada disto foi rodado; `gap_crossed_pause` é desenho do parecer de software da rodada 2 e vai aos dois especialistas aqui.**
4. Nenhuma outra função muda; `obs_archive_registry()` não é recriada aqui (R1).

**Testes, escritos antes do SQL** (entram no arquivo de teste da Tarefa 9, com estes nomes): `MG4 sem a coluna collection_paused_at recusa com "MG4 depende da MG6" e não cria nada`; `canal pausado: competitor_marks_pending não devolve par dele`; `canal pausado: a prova conta o par em pares_em_pausa, e não em total_pendentes nem em atrasadas`; `despausado: par cujo buraco cruza uma pausa registrada conta em pausadas e não em perdidas, e não deixa marcas_perdidas vermelho`; `despausado: par com buraco fora de qualquer pausa continua em perdidas` (o caso que impede a pausa de esconder perda de verdade); `canal nunca pausado: a saída é a do Apêndice C de antes, mais pares_em_pausa 0 e pausadas 0`. (reconciliação 13/10, emenda 2: S2-I2, D2-m4) **Onde estes nomes dizem "a prova", leia-se a função do item 3:** `pares_em_pausa` é de `competitor_marks_pending`, `atrasadas` é de `competitor_marks_health`. O quarto e o quinto testes desta lista não se provam só no SQL (o banco não devolve `perdidas` nem `pausadas`): no arquivo de SQL eles afirmam `gap_crossed_pause` verdadeiro e falso no item devolvido, e a metade "conta em pausadas e não deixa vermelho" é dos testes das Tarefas 2 e 10. Mais um, de SQL: `cada item de competitor_marks_pending traz gap_crossed_pause booleano, nunca nulo`. (reconciliação 13/10, emenda 3: n2) **E mais um, com este nome: `despausado: pausa curta dentro de buraco longo continua em perdidas`** (no SQL: buraco de 4 dias com uma pausa de 20 minutos dentro devolve `gap_crossed_pause` falso; nas Tarefas 2 e 10: o par conta em `perdidas` e deixa `marcas_perdidas` vermelho). O quarto teste da lista ("buraco cruza uma pausa registrada") passa a usar pausa que cobre o buraco menos o limite, ou mais. No último, `pausadas 0` é do escritor, não do banco.
**Pronto quando:** o roteiro rodou duas vezes no `bythiago_int` com a MG6 aplicada, as duas saídas iguais; os Apêndices A, B e C deste plano trazem o texto rodado; os dois especialistas concordaram por escrito. **Não provado até aqui:** nada disto foi rodado na reconciliação.

### Tarefa 9: migration MG4 e a prova no banco (só na vez do lote)

**(reconciliação 13/10: R6, R10, R14) No mesmo commit do arquivo, e antes do `db:new`.** (a) `competitor_marks_apply` tem `delete from` em `competitor_video_marks` e em `competitor_video_mark_misses`: os dois pares entram em `observatorio-a5-e10-lista-fechada.test.ts` (E10, Tarefa 10) e o nome da função no conjunto de `saiu-varredura.test.ts` (E9, Tarefa 11), se esses testes já existirem; senão, linha em `.superpowers/sdd/a5/fila-do-db-push.md`, seção "pares e classificações pendentes" (reconciliação 13/10, emenda 1: S-m3, D-m8). (b) As duas tabelas são lidas por `can_view_site`: são classificadas nas listas de `observatorio-a5-e17-p0-doze.test.ts` e `-reporter-banco.test.ts` (passo 0 da E17), se existirem. (c) A fila do `db push` (`.superpowers/sdd/a5/fila-do-db-push.md`; reconciliação 13/10, emenda 1: S-m3) não pode ter linha de "db push bloqueado" (arquivo armado da MG15, da MG16 ou da MG17). (reconciliação 13/10, emenda 4: p8, n5) **Arquivo ausente ou ilegível: parar e perguntar ao controlador; nunca tratar como fila vazia.** (d) Janela comum do `db:push:prod`: fora de 11:30 a 13:00 UTC e dos minutos 00, 20 e 40. (e) A V5 passa a esperar `{}`; `mg6_ausente` deixou de ser resposta aceita (R3: a MG6 vem antes).

**(reconciliação 13/10, emenda 1: D-I1, S-I2) A pausa de coleta (R3) entra nesta tarefa pela Tarefa 8b.** O arquivo é o Apêndice A **depois da 8b**: a guarda "MG4 depende da MG6" é a primeira instrução, `competitor_marks_pending` e `atrasadas` deixam de fora o canal pausado, e ~~a prova devolve `pares_em_pausa` e `pausadas`~~ (reconciliação 13/10, emenda 3: m2) `competitor_marks_pending` devolve `pares_em_pausa` e, por item, `gap_crossed_pause`; `pausadas` é contada pelo escritor, não pelo banco (Tarefa 8b, item 3). Os seis testes nomeados na 8b entram no arquivo de teste desta tarefa. Colar o Apêndice A de antes da 8b é erro: o `diff` vazio do passo 1 só vale contra o texto que a 8b deixou.

**Objetivo.** O arquivo da migration, igual ao Apêndice A **depois da Tarefa 8b**, e os testes que provam as três funções nos dois sentidos.
**Não começa antes de o controlador avisar.** Se a MG6 for no mesmo lote, o arquivo dela tem de existir antes. **(emenda 2: d:I-R2-1) Antes do passo 1, conferir o registro do export:** `grep -ln "obs_archive_registry" supabase/migrations/*.sql` e, no arquivo achado, `grep -n "competitor_video_mark_misses"`. Três respostas: (a) não existe arquivo com o registro (a MG6 ainda não foi criada): ~~seguir, e anotar no ledger que a entrada é pendência do plano da E10~~ **(reconciliação 13/10: R1 e R3) parar e esperar: a MG6 vem antes, porque `competitor_marks_pending` lê uma coluna dela**; (b) existe e tem a entrada: seguir; (c) existe e **não** tem a entrada: parar e avisar o controlador. Se a MG6 ainda não foi aplicada em produção, o conserto é no arquivo dela, pelo dono daquela etapa; se já foi, vale a saída de reserva de 0.1 ~~(a MG4 recria `obs_archive_registry()` no fim do arquivo, a partir do corpo do arquivo da MG6, e esse acréscimo é rodado no `bythiago_int` com a MG6 aplicada antes de ir ao dono)~~ **(reconciliação 13/10, emenda 1: S-m2) na forma que 0.1 passou a ter: a MG4 não recria o registro; a entrada vai numa migration corretiva única, a partir de `pg_get_functiondef` do que está instalado.**
**Passos, nesta ordem.**
1. `npm run db:new observatorio_a5_e4_marcas_de_idade`; conferir que o carimbo é posterior ao de todo arquivo de `supabase/migrations/`; colar o Apêndice A (reconciliação 13/10, emenda 1: S-I2: o texto que a Tarefa 8b deixou, com a pausa); `diff` entre o arquivo e o bloco do apêndice: vazio.
2. Salvar o roteiro do Apêndice B como `.superpowers/sdd/a5-e4/prova-mg4.sql`, trocando `\i mg4.sql` pelo caminho do arquivo novo, e rodá-lo **duas vezes** contra `postgresql://postgres:postgres@127.0.0.1:54422/postgres`. As duas saídas têm de ser iguais entre si e iguais ao Apêndice C. Diferença: parar e avisar.
3. O controlador aplica a migration no `bythiago_int` (nunca `db:reset`). Rodar os dois testes de integração.
**Contrato (funções; `execute` só `service_role`; `search_path = ''`).**

| Função | Assinatura | Devolve |
|---|---|---|
| `competitor_marks_pending` | `(p_now timestamptz, p_rule_version integer, p_limit integer, p_gap_hours_day1 numeric, p_gap_hours numeric)`; `p_limit` entre 1 e 2.000 (padrão 500) | `{ total_pendentes, itens: [{ video_id, site_id, age_days, base_at, target_at, discovered_at, views_hidden, likes_hidden, comments_disabled, missing_since, series_tier, prev_reason (emenda 2: os dois), first_reading_at, last_reading_at, readings: [{ t, views, likes, comments }] }] }`; do mais recente para o mais antigo; `p_now` nulo devolve zero itens. (emenda 1) Fora o vídeo agendado ou no ar; par com marca ou motivo de base antiga volta como pendente |
| `competitor_marks_apply` | `(p_marks jsonb, p_misses jsonb, p_rule_version integer, p_now timestamptz, p_gap_hours_day1 numeric, p_gap_hours numeric)`; lança com lista nula; (emenda 2: d:m-2) cada item das duas listas leva `base_at`, e o que não bate com a base atual do vídeo, ou vem sem ele, é recusado | `{ marcas, marcas_recusadas, faltas, faltas_limpas, faltas_recusadas, refeitas_por_base, saude }` (emenda 1: os dois campos novos) |
| `competitor_marks_health` | `(p_now timestamptz, p_gap_hours_day1 numeric, p_gap_hours numeric)`; lança com parâmetro nulo ou limite não positivo | `{ atrasadas, em_duas_tabelas, site_divergente, base_divergente, marcas, faltas }` (emenda 1: `base_divergente`) |

**Testes de `observatorio-a5-e4-migration.test.ts`** (cada um cria o seu site, canal e vídeos, e filtra o retorno pelos ids criados; os cenários S0 a S12 já foram rodados em SQL: seção 11).

| Nome | Entrada | Esperado |
|---|---|---|
| `aplicada: V1 e V2` | o banco | V1 = 2, 2, 2, 3, 0; V2 = falso, verdadeiro, falso, falso |
| `pendentes: só idade fechada há 30 minutos` | vídeo com base há 7 dias menos 29 min, e há 7 dias mais 31 min | o primeiro não tem o par 7; o segundo tem |
| `pendentes: vídeo sem data não aparece` | `published_at` nulo | nenhum par |
| `pendentes: a base é a estreia quando ela é posterior` | `live_actual_start_at` 2 dias depois | `base_at` = a estreia; o par de 1 dia fecha 2 dias depois |
| `pendentes: as leituras são as da vizinhança, das duas tabelas, em ordem` | diária a cada dia, primeiras horas a +2, +8, +14, +20, +26 h | idade 7: três leituras diárias; idade 1: duas das primeiras horas e uma diária |
| `pendentes: primeira e última leitura do vídeo` | série que começa depois do alvo | `first_reading_at` = a primeira; `readings` vazio |
| `pendentes: vídeo sem leitura nenhuma` | | `first_reading_at` e `last_reading_at` nulos |
| `pendentes: limite e total` | 9 pares, limite 2 | 2 itens, `total_pendentes` 9 |
| `pendentes: o site é o do canal` (mutação) | vídeos em dois sites | cada item traz o `site_id` do seu canal |
| `gravar: a marca entra com site, base e distância do banco` | marca com as vizinhas certas | linha com `site_id` do canal, `age_base_at`, `gap_hours` 24.000 |
| `gravar: o chamador não escolhe o site` (mutação) | vídeo do site B, chamado junto de itens do site A | a linha nasce com o site B; `site_divergente` 0 |
| `gravar: marca cujas leituras não cercam o alvo é recusada` | `read_before_at` posterior ao alvo | `marcas_recusadas` 1; nenhuma linha |
| `gravar: marca com distância acima do limite é recusada` | 48 h na idade 7; 9 h na idade 1 | recusadas |
| `gravar: exatamente no limite entra` | 36 h; 8 h | gravadas |
| `gravar: a mesma marca de novo, com outro número, não regrava` | 731 e depois 999 | `marcas` 0; continua 731 |
| `gravar: motivo de par que já tem marca não entra` | | `faltas` 0 |
| `gravar: motivo e depois a marca do mesmo par: o motivo sai` | | `faltas_limpas` 1; o par só na tabela de marcas |
| `gravar: motivo da mesma versão não troca; de versão maior troca` | | `leitura_comecou_depois` fica; com versão 2 vira o novo, `rule_version` 2 |
| `gravar: versão maior reabre os motivos como pendentes; as marcas não` | `pending` com versão 2 | os pares com motivo voltam; os com marca não |
| `gravar: motivo fora do catálogo e idade fora de 1, 7 e 30 lançam, e nada é gravado` | `'palpite'`; idade 14 | exceção; contagens iguais às de antes |
| `o check de motivo aceita exatamente os seis códigos de FALTAS_DE_MARCA` | `pg_get_constraintdef` do `check` de `reason` | os mesmos seis, nenhum a mais |
| `gravar: lista nula lança` | `p_marks` nulo | exceção |
| `gravar: vídeo que não existe é contado como recusado, sem lançar` | uuid inventado | `marcas_recusadas` 1 |
| `prova: tabelas vazias não é verde` | vídeo com idade fechada há 10 dias, nada gravado | `atrasadas` conta o par |
| `prova: não sobe antes do prazo, sobe no prazo` | par de 7 dias: alvo + 36 h + 48 h menos 1 min, e no minuto exato | 0; 1 |
| `prova: não sobe por par com marca nem por par com motivo` | | 0 |
| `prova: não sobe por vídeo sem data` | | 0 |
| `prova: par nas duas tabelas` (plantado por `insert` direto) | | `em_duas_tabelas` 1 |
| `prova: site divergente` (plantado por `update`) | | `site_divergente` 1 |
| `prova: parâmetro nulo ou limite zero lança` | | exceção nas três |
| `cascata: apagar o vídeo leva marcas e motivos; apagar o canal também` | | 0 linhas dos ids do teste |
| `agendado: vídeo upcoming com data há 8 dias não é pendente nem atrasado` (emenda 1: d:C-1) | `live_broadcast_content = 'upcoming'`, `published_at` há 8 dias; depois `'live'` | nenhum par em `pending`; `atrasadas` não conta; o mesmo com `'live'` |
| `agendado: gravar recusa marca e motivo de vídeo upcoming` (emenda 1: d:C-1) | uma marca e um motivo | `marcas_recusadas` 1, `faltas_recusadas` 1, nenhuma linha |
| `agendado: live_broadcast_content nulo conta como nem agendado nem no ar` (emenda 1) | vídeo com o campo nulo e idade fechada | aparece em `pending` |
| `a transmissão começou: o par aparece com a base nova` (emenda 1: d:C-1) | o mesmo vídeo, `live_actual_start_at` há 2 dias e `'none'` | só o par de 1 dia, `base_at` = o começo |
| `base que anda: a prova conta, o par volta, gravar apaga a linha velha` (emenda 1: d:C-1, s:m5) | marca e motivo gravados; depois `live_actual_start_at` 1 dia depois de `published_at` | `base_divergente` 2; os dois pares em `pending` com a base nova; `apply` com listas vazias: `refeitas_por_base` 2 e `base_divergente` 0 |
| `base que anda: a marca nova entra na mesma chamada que apaga a velha` (emenda 1) | `apply` com a marca calculada na base nova | `marcas` 1, `refeitas_por_base` 1, a linha com `age_base_at` novo |
| `base igual: gravar de novo não apaga nada` (emenda 1; o sentido contrário) | marca gravada, base sem mudar | `refeitas_por_base` 0; a linha e o `computed_at` iguais |
| `gravar: motivo antes de alvo + limite + 1 hora é recusado; no minuto exato entra` (emenda 1: d:m-1, s:m4) | par de 7 dias com `p_now` = alvo + 36 h 59 min e alvo + 37 h; par de 1 dia com 8 h 59 min e 9 h | `faltas_recusadas` 1 e nenhuma linha; `faltas` 1 |
| `gravar: a borda do banco é a mesma de decidirMarca` (emenda 1) | os mesmos quatro instantes passados a `decidirMarca` com `MEASURE_RULES` | `aguardar` onde o banco recusa, `falta` onde o banco aceita |
| `gravar: motivo de idade que ainda não fechou é recusado` (emenda 1: s:m4) | vídeo de 3 dias, motivo da idade 7 | `faltas_recusadas` 1 |
| `gravar: marca calculada para a base velha é recusada mesmo com as leituras cercando o alvo novo` (emenda 2: d:m-2) | `pending` devolve a base; `live_actual_start_at` anda 2 horas; marca com o `base_at` antigo e leituras que cercam os dois alvos; depois a mesma com o `base_at` novo | `marcas_recusadas` 1 e nenhuma linha; depois `marcas` 1, com `age_base_at` novo |
| `gravar: motivo calculado para a base velha é recusado` (emenda 2: d:m-2) | o mesmo, com um motivo | `faltas_recusadas` 1 e nenhuma linha |
| `gravar: item sem base_at é recusado` (emenda 2: d:m-2) | uma marca e um motivo sem o campo | `marcas_recusadas` 1, `faltas_recusadas` 1 |
| `gravar: base_at com microssegundos, devolvido como veio, entra` (emenda 2: d:m-2) | vídeo com `published_at` `…10:00:00.123456+00`; o `base_at` de `pending` mandado de volta sem mexer | `marcas` 1 |
| `agendado depois da decisão: gravar apaga a linha` (emenda 2: d:m-6) | marca e motivo gravados com `live_broadcast_content` nulo; depois `'upcoming'`; `apply` com listas vazias | `refeitas_por_base` 2; zero linhas do vídeo; o mesmo com `'live'` |
| `não agendado: gravar não apaga nada` (emenda 2: d:m-6; o sentido contrário) | o mesmo vídeo com `'none'` e com nulo | `refeitas_por_base` 0; as linhas iguais |
| `prova: vídeo que perdeu a data não conta em base_divergente` (emenda 2: d:m-5) | motivo gravado; depois `published_at` nulo por `update` | `base_divergente` 0; `apply` não apaga a linha |
| `pendentes: devolvem o motivo anterior do par e a faixa do vídeo` (emenda 2: d:m-8, d:m-3) | motivo `leituras_distantes` da versão 1 e `pending` com a versão 2; par sem motivo; par com motivo de base antiga; vídeo com `series_tier` `'semanal'` | `prev_reason` `leituras_distantes`; nulo; nulo; `series_tier` `'semanal'` |
| `com a MG6 no banco, o registro do export cobre as duas tabelas da MG4` (emenda 2: d:I-R2-1; pula, dizendo por quê, se `to_regprocedure('public.obs_archive_uncovered()')` for nulo) | o banco com as duas migrations; um canal com uma marca e um motivo | `obs_archive_uncovered()` vazio; `obs_archive_channel_counts` do canal devolve a linha de `competitor_video_marks` e a de `competitor_video_mark_misses` |

O teste `aplica duas vezes` fica no roteiro psql (passo 2).

**Testes de `observatorio-a5-e4-rls.test.ts`.** `usuário sem vínculo com o site não lê nenhuma das duas tabelas, mesmo forjando o GUC app.site_id` (usuário criado no teste, sem `super_admin`; **se este teste falhar porque `can_view_site` confia no GUC, parar e avisar o controlador**: a correção é trocar a policy, não o teste; emenda 1: o parecer de dados leu a função, `20260507000001_schema.sql`, e ela decide por super admin, admin da organização ou vínculo com o site, sem ler o GUC; o teste fica como guarda); `membro do site lê`; `membro de outro site, com o GUC forjado para este, não lê`; `anon não tem select; authenticated não tem insert, update nem delete` (por `has_table_privilege` e por tentativa, que tem de dar "permission denied"); `as três funções: has_function_privilege falso para anon e authenticated, verdadeiro para service_role`.
**Pronto quando:** `diff` do passo 1 vazio; o roteiro deu o Apêndice C (o da emenda 2, com o S11 e o S12), duas vezes; os dois arquivos de teste passam contra `bythiago_int`.

### Tarefa 10: o escritor das marcas

**Arquivo.** `M/fechar-marcas.ts` (`import 'server-only'`).
**Contrato.** `runFecharMarcas(o: { sb: SupabaseClient; now: () => number }): Promise<{ status: 'ok' | 'parcial' | 'erro'; feitos: number; ficaram: number | null; motivo?: MotivoDasMarcas; numeros: Record<string, number> }>`. `MOTIVOS_DAS_MARCAS = ['schema_ausente', 'banco_nao_respondeu', 'leitura_falhou', 'gravacao_falhou', 'resposta_invalida', 'marca_recusada', 'prova_inconsistente', 'marcas_perdidas', 'marcas_atrasadas', 'sobrou'] as const` (emenda 1: d:I-3: `marcas_perdidas`). Passos: (1) `sb.rpc('competitor_marks_pending', { p_now, p_rule_version, p_limit: batch, p_gap_hours_day1, p_gap_hours }).abortSignal(AbortSignal.timeout(BANCO_MS))`; (2) valida a forma de cada item (campo fora da forma: `resposta_invalida`, nada gravado); (3) `decidirMarca` em cada um; (4) `sb.rpc('competitor_marks_apply', …)` com o mesmo `p_now`; (5) o veredito, pela tabela de 6.1. `feitos` = marcas mais motivos gravados; `ficaram` = `total_pendentes − feitos − aguardando`; `numeros` = `{ pendentes, marcas, faltas, aguardando, recusadas, faltas_recusadas, refeitas_por_base, leituras_ignoradas, atrasadas, em_duas_tabelas, site_divergente, base_divergente, perdidas, faltas_sem_leitura, faltas_views_ocultas, faltas_comecou_depois, faltas_descoberto_tarde, faltas_parou_antes, faltas_distantes }` (emenda 1: d:I-3, s:m8: os seis `faltas_*` contam os motivos que esta execução mandou, por código, e vão para `competitor_agenda_runs.detail`; `perdidas` = quantos deles passam em `marcaPerdida`, Tarefa 2; d:C-1: `refeitas_por_base` e `base_divergente` vêm do banco). (reconciliação 13/10, emenda 2: S2-I2, D2-m4) **`numeros` ganha `pares_em_pausa` (lido de `competitor_marks_pending`) e `pausadas` (contado aqui, como `perdidas`: motivos desta execução que `marcaPerdida` recusou só por `cruzouPausa`).** O passo (2) passa a exigir `gap_crossed_pause` booleano em cada item e `pares_em_pausa` numérico na resposta. **(emenda 2: s:n1, d:m-3, s:n3, d:m-8) `numeros` ganha cinco chaves:** `perdidas_1`, `perdidas_7` e `perdidas_30` (as perdas por idade; a soma das três é `perdidas`), `perdidas_ja_avisadas` (motivo `leituras_distantes` ou `leitura_parou_antes` de par que já tinha um dos dois com a mesma base: fica fora de `perdidas`) e `perdidas_30_semanal` (a parte de `perdidas_30` que `perdaAvisa` deixou de fora; zero enquanto `weeklyTier30Counts` for verdadeiro). O veredito segue a tabela e a precedência de 6.1: **com alguma perda que avisa** (`marcaPerdida` e `perdaAvisa` verdadeiros: hoje, `perdidas_7 + perdidas_30 − perdidas_30_semanal > 0`) a execução devolve `status: 'erro'`, `motivo: 'marcas_perdidas'`, **depois de gravar** (os motivos entram; o vermelho é o aviso, uma vez). Só com `perdidas_1`: verde, com o número no detalhe. Cada item de `p_marks` e de `p_misses` leva `base_at` = `baseAtIso` do pendente (d:m-2). **Nunca lança** e nunca devolve texto de erro: só código. (emenda 1: s:m2) O `sb` falso dos testes é local, escrito no próprio arquivo de teste: só precisa responder a `rpc(nome, args).abortSignal(…)` para as duas funções; não usa `TM/medidas-fixture.ts` nem os falsos de `test/helpers/`.
**Testes** (`medidas-fechar-marcas.test.ts`, com um `sb` falso que responde às duas funções): uma linha de 6.1 por teste, com estes nomes: `função ausente (PGRST202, 42883, 42P01): schema_ausente, e a segunda ida não acontece`; `prazo estourado na primeira ida: banco_nao_respondeu, nada gravado`; `erro com código na primeira ida: leitura_falhou; na segunda: gravacao_falhou`; `resposta que não é objeto, itens que não é lista, total que não é número: resposta_invalida, nada gravado`; `zero pendentes: grava listas vazias, lê a prova e é ok`; `par com vizinhas: vai em p_marks com as duas leituras certas`; `par sem vizinhas e alvo antigo: vai em p_misses com o código`; `par ainda dentro do limite: não vai em lista nenhuma e conta em aguardando`; `sobrou: parcial com o número`; `marcas_recusadas maior que zero: erro marca_recusada`; `em_duas_tabelas ou site_divergente: erro prova_inconsistente`; `atrasadas com nada sobrando: erro marcas_atrasadas; com sobra: parcial`; `base_divergente maior que zero depois de gravar: erro prova_inconsistente` (emenda 1); `faltas_recusadas maior que zero: erro marca_recusada` (emenda 1); **`carga inicial só com leitura_comecou_depois: não avisa marcas_perdidas`** e **`um par de idade 7 (emenda 2: s:n1) com série antes do alvo e buraco: erro marcas_perdidas com perdidas 1, e os motivos foram mandados ao banco assim mesmo`** e `vídeo fora do ar com leitura_parou_antes: não avisa` (emenda 1: d:I-3, os dois sentidos); `os seis faltas_* somam o tamanho de p_misses` (emenda 1); (emenda 2) `perdidas_1 + perdidas_7 + perdidas_30 é igual a perdidas`; `só idade 1 perdida: ok, com perdidas_1 no detalhe` e `uma idade 7 perdida junto de dez da idade 1: erro marcas_perdidas, com perdidas_7 1 e perdidas_1 10` (s:n1, os dois sentidos); `reabertura por versão: par que já tinha leituras_distantes não avisa e conta em perdidas_ja_avisadas; par que tinha leitura_comecou_depois e agora é leituras_distantes avisa` (s:n3, d:m-8); `com weeklyTier30Counts falso, idade 30 de vídeo semanal não avisa e conta em perdidas_30_semanal; de vídeo diário avisa` (d:m-3; o teste troca a regra por injeção, não edita a constante); `todo item de p_marks e de p_misses leva o base_at que pending devolveu, letra por letra` (d:m-2); `item sem series_tier ou sem prev_reason na resposta: resposta_invalida` (os dois campos são obrigatórios na forma, nulos ou texto); `precedência: recusada vence prova, que vence perdidas, que vence atrasadas, que vence sobrou` (emenda 1); `item sem missing_since na resposta: resposta_invalida` (emenda 1: o campo é obrigatório na forma, nulo ou data); `leitura com views inválida é ignorada e contada`; `a exceção do cliente não vaza texto: o retorno só tem códigos e números` (o falso lança com uma frase sentinela; a sentinela não aparece em lugar nenhum do retorno); `os parâmetros mandados são os de MEASURE_RULES` (versão, lote, 8 e 36); `o p_now das duas idas é o mesmo instante`. **(reconciliação 13/10, emenda 1: S-I2) Mais dois: `pares_em_pausa e pausadas vão em numeros e não mudam o veredito` (com `perdidas` 0 e `pausadas` maior que zero o resultado é `ok`); `resposta da prova sem pares_em_pausa ou sem pausadas: resposta_invalida`.** **(reconciliação 13/10, emenda 2: S2-I2) Os dois testes acima partiam de `pausadas` entregue pronto pelo `sb` falso e passariam com o defeito em produção. Ficam assim: `um pendente com gap_crossed_pause verdadeiro, série antes do alvo e buraco: o motivo é mandado, conta em pausadas, perdidas fica 0 e o resultado é ok` (o falso devolve o **pendente**, não o número); `o mesmo pendente com gap_crossed_pause falso: erro marcas_perdidas`; `item sem gap_crossed_pause, ou resposta sem pares_em_pausa: resposta_invalida`; `pares_em_pausa vai em numeros e não muda o veredito`. `pausadas` não vem do banco: o segundo teste da emenda 1 sai.**
**Pronto quando:** testes verdes.

### Tarefa 11: integração na agenda (a única que toca arquivo da agenda)

**Arquivos.** Os sete da tabela da seção 9.
**Contrato.**
- `definicoes.ts`: `export const DEFINICAO_MARCAS_DE_IDADE: Definicao = { nome: 'marcas_de_idade', rotulo: 'marcas de idade', ordem: 5.5, peso: 'leve', periodo: 'dia', aPartirDaHoraSP: 4, tetoTentativas: 12, toleranciaVigiaH: 36, naoTerminouVermelhoEm: null, comecaAteMs: LEVE_COMECA_ATE_MS, fimAteMs: 85_000, motivos: { banco_nao_respondeu: 'o banco não respondeu a tempo', leitura_falhou: 'não foi possível ler os vídeos com idade fechada', gravacao_falhou: 'não foi possível gravar as marcas', resposta_invalida: 'o banco devolveu uma resposta fora da forma esperada', marca_recusada: 'o banco recusou marcas ou motivos calculados (vídeo apagado ou base alterada no meio; se repetir, é defeito de código)', prova_inconsistente: 'há marca e motivo para o mesmo vídeo, marca com o site errado ou marca com a base da idade antiga', marcas_perdidas: 'marcas não puderam ser medidas: faltou leitura ao redor da idade', marcas_atrasadas: 'há vídeos com idade fechada há mais de 3 dias sem marca nem motivo', sobrou: 'ficaram vídeos para o próximo disparo', inesperado: 'a gravação das marcas falhou com erro inesperado (ver Sentry)' } }` e a entrada dela em `TODAS_AS_DEFINICOES`. `schema_ausente` é dos motivos comuns e não se repete. **(emenda 1)** `ordem: 5.5` (s:I2), `naoTerminouVermelhoEm: null` (d:I-2, s:I1), o motivo `marcas_perdidas` (d:I-3) e `fraseDe` (o tipo `Tarefa.fraseDe` já existe e só recebe números; para os outros códigos vale a frase fixa). **(emenda 2: s:n1)** A frase de `marcas_perdidas` diz as idades que avisam: com `n = d.perdidas_7 + d.perdidas_30 − d.perdidas_30_semanal` maior que zero, devolve `n + ' marcas não puderam ser medidas (7 dias: ' + d.perdidas_7 + '; 30 dias: ' + (d.perdidas_30 − d.perdidas_30_semanal) + '): faltou leitura ao redor da idade'`; sem os números, `undefined` (frase fixa). A frase deixou de dizer "a coleta teve um buraco": para o V30 de vídeo que saiu da faixa diária não houve buraco, houve uma leitura que a regra das faixas não pedia (4.4).
- `agenda/tarefas/marcas-de-idade.ts`: `export const marcasDeIdade: Tarefa = { ...DEFINICAO_MARCAS_DE_IDADE, rodar }`, no molde de `anular-identidade.ts`: chama `runFecharMarcas({ sb: c.sb, now: c.agora })`, devolve `{ estado, feitas, deixadas, motivo?, detalhe: numeros }`; o que lançar vira `inesperado`. Sem `devidaPeloDado`, sem `nuncaDesliga`.
- `catalogo.ts`: uma importação e uma entrada, na ordem; re-exporta a definição.
**Testes.**
- `tarefas.test.ts`, bloco novo `E4: marcas_de_idade`: `catálogo: a tarefa existe, com cada campo da tabela`; `OBS_AGENDA_TASKS_OFF ausente (variável apagada): ligada` (item 245); `OBS_AGENDA_TASKS_OFF=marcas_de_idade: não roda e aparece desligada, nunca ok` (item 245, com o despachante real e `rodar` espionado); `o adaptador devolve só código e número`; `tarefa que lança com texto sentinela: motivo inesperado, e a sentinela não aparece em fechar, problemas, resumo nem Sentry`; `todo item de MOTIVOS_DAS_MARCAS é chave dos motivos da tarefa ou de MOTIVOS_COMUNS`; `comecaAteMs + 2 × BANCO_MS <= fimAteMs <= LEVE_FIM_MS`.
- `catalogo.test.ts`, `saude.test.ts`, `despachante.test.ts`: os testes que contam as tarefas passam a contar uma a mais (seis, se nenhuma outra etapa chegou antes). **(emenda 1: s:I2)** A posição é afirmada por relação, nunca por índice: `marcas_de_idade` vem depois de toda tarefa `leve` de ordem menor que 5.5 e antes de toda `pesada`; a lista de ordens esperada ganha o 5.5 (hoje `[1, 2, 5.5, 6, 7, 8]`; **reconciliação 13/10: R13: a ordem recomendada põe a Tarefa 9 do plano da E10 antes desta, e então a lista é `[1, 2, 4, 5.5, 6, 7, 8]`, com sete tarefas**). `catalogoCompleto()` de `despachante.test.ts` ganha `tarefa('marcas_de_idade', 5.5, { aPartirDaHoraSP: 4 })` (nove tarefas) e o teste do pior disparo (item 215) continua dentro de `LIMITE_FUNCAO_MS`, com uma só pesada. **Nenhuma outra expectativa muda**; cada linha alterada vai no relatório com o motivo.
- **(emenda 1: d:I-2, s:I1) Drenagem, com o despachante real e `rodar` falso que devolve `parcial` enquanto houver pares:** `carga de 4.167 pares drena em 3 execuções e nenhuma põe problema na lista`; `carga de 9.001 pares drena em 7 execuções no mesmo dia, sem problema e sem gastar tentativa` (cada retomada tem `done_n > 0`); `reabertura completa (4.000 motivos de versão menor) drena sem problema`; `parcial sem nada feito gasta tentativa e na 12ª vira esgotada, vermelha` (o sentido contrário: a fila travada aparece).
- `marcas_perdidas: a frase do disparo tem o número` e `marcas_perdidas sem o número no detalhe cai na frase fixa` (emenda 1: d:I-3). (emenda 2: s:n1) `marcas_perdidas: a frase diz os números de 7 e de 30 dias e não fala da idade 1` (detalhe com `perdidas_1` 12, `perdidas_7` 2, `perdidas_30` 3: a frase tem "5 marcas", "7 dias: 2" e "30 dias: 3").
**Armadilha.** `definicoes.ts` é o módulo leve que o vigia importa: não pode importar `M/fechar-marcas.ts` nem `tarefas/*` (os códigos de motivo são escritos por extenso aqui, e o teste acima confere que batem com `MOTIVOS_DAS_MARCAS`).
**Pronto quando:** os quatro arquivos de teste da agenda verdes; `npm run typecheck -w apps/web` limpo.

### Tarefa 12: a folga de 2 dias na faixa diária

**(emenda 1: d:I-1, s:I3) Esta tarefa é um envio próprio, com data limite: em produção até 30/10/2026.** **(emenda 2: d:m-4) O prazo certo é "o quanto antes"; 30/10 é só o teto para os vídeos de 03/10 em diante.** Pelos desvios 6 e 7, a marca é medida sempre que há leituras reais dos dois lados: um vídeo publicado em 14/09, fora dos N mais recentes, tem leitura diária desde 03/10, saiu da faixa diária em 14/10 e só lhe falta a leitura do dia seguinte. Cada dia sem esta tarefa em produção perde o V30 dos vídeos que fazem 30 dias naquele dia nos canais da C-14 (a C-16 mede quantos são; a suposição de que a série diária de antes de 13/10 cobria todo vídeo guardado não foi conferida). Não depende da Tarefa 1, da MG4, da agenda, do Lote B nem do acordo sobre o resto do plano; depende da resposta à pergunta 1 (padrão: fazer) e da C-14 (que diz se o prazo aperta: seção 3.2).
**Arquivos.** `competitor-tiers.ts`, `test/youtube/competitor-tiers.test.ts`, `observatorio/rules.ts` (uma chave) e uma linha no espelho `.superpowers/sdd/a5/conferencias-com-data.md`.
**Contrato.** Em `rules.ts`, a linha `series` ganha a chave `dailyGraceDays: 2` (`series: { dailyAgeDays: 30, dailyGraceDays: 2, weeklyEveryDays: 7, … }`), com o comentário "New (A5, E4): folga para existir a leitura do dia seguinte ao 30º". Em `classifyTiers`, a condição de `'idade'` passa a `o.nowMs - v.publishedAt <= (RULES.series.dailyAgeDays + RULES.series.dailyGraceDays) * DAY`. Mais nada.
**Por que aplica limpo sobre o remoto (conferido em 13/10).** `competitor-tiers.ts` e o teste dele são iguais aos de `origin/staging` e não têm mudança pendente. `rules.ts` difere do remoto em 8 linhas (a importação de `COMMENT_RULES` no topo e as chaves `hourly` e `comments` depois de `promotion`), todas a mais de 3 linhas da linha `series`: a mudança de uma linha tem o mesmo contexto nos dois lados. O controlador confere de novo na hora, só leitura: `git diff origin/staging HEAD --stat -- apps/web/src/lib/youtube/competitor-tiers.ts apps/web/test/youtube/competitor-tiers.test.ts` (esperado: vazio antes do commit desta tarefa) e `git diff origin/staging HEAD -- apps/web/src/lib/youtube/observatorio/rules.ts` (esperado: nenhuma linha mudada a menos de 3 linhas de `series:`). Se alguma das duas não der o esperado, a constante vira `const DAILY_GRACE_DAYS = 2` exportada de `competitor-tiers.ts` e `rules.ts` sai da lista; o plano não muda em mais nada.
**Testes** (antes do código): `idade: com exatamente 32 dias é diária; com 32 dias e 1 ms é semanal` (substitui a expectativa do teste da linha 67, que hoje usa `dailyAgeDays` sozinho: é a única mudança de expectativa, e vai no relatório); `a folga é RULES.series.dailyGraceDays (2) e a fronteira é dailyAgeDays mais a folga` (a fronteira do teste é calculada das duas constantes, não escrita como 32); `com 30 dias e 1 ms o vídeo fora dos N continua diário` (o caso que hoje é semanal: é a leitura que faltava); `o teto de 200 continua tirando primeiro os mais antigos da regra de idade` (o teste do item 18 continua verde sem mudança).
**Conferência com data (03/11/2026), só leitura.** A linha entra já no espelho `.superpowers/sdd/a5/conferencias-com-data.md` e no ledger; entra em `lib/conferencias.ts` como `e4-dia31` na Tarefa 18, se o lote da E4 subir antes de 03/11 (o arquivo `.ts` local tem 84 linhas de outros lotes e não pode ir neste envio; **fraqueza dita:** se o lote não subir até lá, quem lembra da conferência é o ledger e o controlador, não o código). Esperado: as duas contagens iguais em todo canal.
```sql
select c.channel_name, count(*) as videos_30_a_32_dias, count(d.video_id) as com_ponto_hoje from public.competitor_videos v join public.competitor_channels c on c.id = v.competitor_channel_id left join public.competitor_video_daily d on d.video_id = v.id and d.snap_date = (now() at time zone 'America/Sao_Paulo')::date where v.published_at between now() - interval '32 days' and now() - interval '30 days' and v.missing_since is null and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live') group by 1 order by 1;
```
(emenda 2: d:m-9) A consulta deixa de fora o vídeo que saiu do YouTube e o agendado ou no ar: nenhum dos dois tem ponto diário a esperar, e contados dariam diferença falsa. Rodar depois das 13 h de São Paulo (a leitura diária começa às 12 h). Contagens diferentes num canal: ou o teto de 200 diários cortou os da folga (olhar `cut` da sincronização), ou a tarefa não está em produção.
**Envio.** Commit próprio, só com os três arquivos de código e teste; o controlador o envia sozinho sobre `origin/staging` (é o único commit da E4 que não espera o Lote B), confere o CI e promove fora de 11:55 a 12:15 UTC. **(reconciliação 13/10, emenda 1: D-C1, S-I1) Como o commit chega a produção sem os outros 321. ~~O `staging` local é linear e~~ (reconciliação 13/10, emenda 3: n5: riscado, é falso; correção (1) no fim do parágrafo) O `staging` local está 321 commits à frente de `origin/staging` (`63db57ba`); um `git push` dele leva o coletor novo do diário (`6d600b29`), a retenção (`3f3d42d1`) e as dimensões (`2418d51f`), que param o cron do canal próprio sem MG14, MG5 e MG7. Dois caminhos, e o controlador escolhe pelo resultado da C-14 e da C-16. ~~(a) Padrão, se a C-16 der zero linhas: a tarefa é commitada no `staging` local e vai no push único do passo 2 da reconciliação (seção 3), desde que esse push chegue a `main` até 27/10/2026; o controlador confere a data em 23/10 e, se o lote C1 ainda não estiver aplicado nesse dia, passa para (b).~~ (reconciliação 13/10, emenda 3: n5: riscado; **(a) e a condição de (b) são as das correções (2) e (3) no fim do parágrafo, e só elas**) (b) ~~Se a C-16 der linha (a perda já corre) ou a data de (a) não fechar:~~ o commit nasce sobre `origin/staging`, fora da árvore de trabalho dos agentes (árvore separada criada de `origin/staging`, ou `commit-tree`), e sobe por refspec, `bash -c 'git push origin <sha>:refs/heads/staging'`; CI; promoção. ~~Antes, no dia: `git diff origin/staging staging -- <os três arquivos>` vazio (a conferência de 13/10 repetida).~~ (reconciliação 13/10, emenda 3: n5: riscado; a conferência do dia é a da correção (4)) Depois: no `staging` local o controlador faz `git merge origin/staging` (commit de junção, nunca rebase), com nenhum agente commitando, antes do push seguinte; até lá todo push do `staging` local é recusado por não ser avanço rápido, que é a falha segura. Em (b) a tarefa não é commitada também no `staging` local: ela chega pela junção. (b) cria divergência entre a árvore local e o remoto e ~~por isso pede o aval do dono~~.** **(reconciliação 13/10, emenda 2: S2-I1, D2-m5, S2-C1) Quatro correções ao trecho acima. (1) O `staging` local não é linear (tem 4 commits de junção com `origin/staging`) e (b) não é exceção: é o modo de envio deste programa, por árvore de lote sobre `origin/staging`, e a decisão é do controlador. (2) **Quem escolhe é a C-14, não a C-16.** A C-16 é retrato do dia; zero hoje não é zero amanhã. **(b) vale sempre que a C-14 der uma linha ou mais, ou um canal a menos de 5 do `video_limit`, ou a C-16 der linha: a árvore de lote desta tarefa (os três arquivos) sai logo depois das duas conferências.** (a) fica só para C-14 zero, nenhum canal perto do limite e C-16 zero; nesse caso a tarefa vai na primeira árvore de lote que sair (a do lote B, passo 1a da reconciliação) (reconciliação 13/10, emenda 3: m3: a árvore nomeada no passo 1a, `14eb9bca`, foi testada SEM esta tarefa; com ela dentro é árvore nova, e o typecheck e a suíte rodam de novo nela antes do push), e a C-16 e a segunda consulta da C-14 rodam de novo a cada dois dias enquanto ela não estiver em produção. (3) Em 23/10 a pergunta não é "o lote C1 está aplicado?", é "o envio que leva esta tarefa tem data até 27/10?"; sem data, (b). (4) **A conferência do dia não é "`git diff` vazio"**, que hoje é falso (`rules.ts` tem 8 linhas a mais no local): é a do parágrafo "Por que aplica limpo" acima, com o esperado de lá: `competitor-tiers.ts` e o teste iguais nos dois lados; `rules.ts` sem linha mudada a menos de 3 linhas de `series:`; senão, a constante em `competitor-tiers.ts`.** **(reconciliação 13/10, emenda 3: m3) Em (b), o envio desta tarefa deixa as quatro `refs/remontagem/*` 1 commit atrás de `origin/staging`: a árvore do passo 1a é remontada depois dele, com certeza, e não "se o remoto tiver andado".** Volta: reverter o commit; os vídeos de 30 a 32 dias voltam à faixa semanal na sincronização seguinte.
**Pronto quando:** `competitor-tiers.test.ts` e `competitor-sync-a5.test.ts` verdes; o commit em produção o quanto antes e no máximo até 30/10/2026, com a data anotada no ledger.

### Tarefa 13: leitores de servidor

**Arquivo.** `M/ler.ts` (`import 'server-only'`). Recebem o cliente por parâmetro (quem chama é a página, depois da guarda dela; nenhum leitor cria cliente de serviço).
**Contrato.** Todos devolvem `Parte<T> = { lido: true; dados: T } | { lido: false; causa: 'schema_ausente' | 'erro_do_banco' | 'cortado' | 'canal_de_outro_site' }` e nunca lançam. (emenda 1: s:m7(i)) `sem_permissao` não é causa destes leitores; é só de `ParteDeComentarios` (Tarefa 15). (emenda 1: s:m2) O falso de PostgREST dos testes mora em `TM/medidas-fixture.ts`, **criado nesta tarefa** (tabelas em memória, `select`, `eq`, `in`, `gte`, `range`, contador de consultas e registro das colunas pedidas); a Tarefa 14 acrescenta a fixture cheia ao mesmo arquivo e a 15 usa o mesmo falso.
- `lerCanal(sb, { siteId, channelId })`: `competitor_channels` com `.eq('id', channelId).eq('site_id', siteId)`; zero linhas: `canal_de_outro_site`. **(reconciliação 13/10, emenda 1: D-I1, S-I2) Pede e devolve `collection_paused_at` como `collectionPausedAt: string | null`; coluna ausente (MG6 não aplicada) é `schema_ausente`, nunca nulo calado. Teste: `lerCanal devolve collectionPausedAt e o montador o entrega a estadoDoCanal`.** **Todo leitor abaixo chama este primeiro** e para se ele falhar.
- `lerVideosDoCanal(sb, { siteId, channelId })`: `id, video_id, published_at, live_actual_start_at, live_broadcast_content (emenda 1: d:C-1, para `agendadoOuNoAr`), was_live, is_short, duration_seconds, view_count, like_count, comment_count, likes_hidden, comments_disabled, views_hidden, discovered_at, missing_since, series_tier, last_checked_at`, por `.eq('competitor_channel_id', channelId)`, paginado.
- `lerMarcasDoCanal(sb, { siteId, channelId, videoIds })`: as duas tabelas, com `.eq('site_id', siteId).in('video_id', bloco)`; devolve `{ marcas: Map<videoId, Partial<Record<1 | 7 | 30, MarcaLida>>>, faltas: Map<…> }`. `MarcaLida` e `FaltaLida` trazem `ageBaseAt` (emenda 1: d:C-1: `m1DoVideo` ignora a linha de base antiga).
- `lerRetratosDoCanal(sb, { siteId, channelId, desde })`: `snapshot_date, view_count` (nulo fica nulo), 120 dias por padrão.
- `lerSeriesDoCanal(sb, { siteId, channelId, videoIds, desde })`: `competitor_video_daily` (`video_id, snap_date, taken_at, views, likes, comments`) e `competitor_video_early`, por blocos; devolve `Map<videoId, Leitura[]>`. **(emenda 1: s:m6)** As duas tabelas não têm como ser filtradas pelo canal: o leitor lê antes os `id` dos vídeos do canal (`competitor_videos`, `.eq('competitor_channel_id', channelId)`, paginado), descarta de `videoIds` o que não é do canal e devolve também `foraDoCanal: number` (quantos descartou).
- `lerMudancasDoCanal(sb, { siteId, channelId, videoIds, desde })`: `competitor_video_versions` (`field`, `first_seen_at`, `precision`, `value_text` só de descrição, para os capítulos) e `competitor_field_versions` (`field in ('tags', 'category_id', 'duration_seconds', 'default_language')`, com `.eq('site_id', siteId)`), **excluindo `precision = 'first'`** (primeira leitura não é mudança). **(emenda 1: s:m6)** O mesmo cruzamento dos ids com os vídeos do canal (`competitor_video_versions` não tem `site_id`).
**Testes** (`medidas-ler.test.ts`, com um falso de PostgREST do próprio arquivo de fixture).
- Dado ausente: `tabela ausente (42P01, PGRST205): schema_ausente, nunca lista vazia`; `erro do banco: erro_do_banco`; `consulta que lança: erro_do_banco, sem vazar a mensagem`; `página cheia de 1.000 sem a seguinte pedida é cortado` e `duas páginas são lidas inteiras`; `canal sem vídeo: lido, lista vazia`; `view_count nulo no retrato continua nulo`; `mais de 150 vídeos: o in() é partido em blocos`.
- **Provas por mutação** (cada uma é um teste que falha se o filtro for removido; o relatório da tarefa mostra o vermelho obtido ao remover o filtro à mão e o verde ao devolvê-lo): `lerCanal sem o filtro de site devolveria o canal de outro site` (falso com o mesmo `id` em dois sites); `lerVideosDoCanal filtra pelo canal` (vídeos de dois canais na tabela); `lerMarcasDoCanal filtra pelo site E pelos vídeos` (marca do mesmo vídeo com outro `site_id` plantada; marca de vídeo de outro canal); `lerRetratosDoCanal filtra pelo canal`; `lerSeriesDoCanal só devolve os vídeos pedidos`; `lerMudancasDoCanal filtra o histórico de campo pelo site`; **`lerSeriesDoCanal: vídeo de outro canal pedido por id não volta`** e **`lerMudancasDoCanal: versão de vídeo de outro canal pedido por id não volta`** (emenda 1: s:m6; série e versão do vídeo alheio plantadas no falso; o teste falha se o cruzamento com os vídeos do canal for removido); `todo leitor para quando lerCanal responde canal_de_outro_site, sem fazer a segunda consulta` (o falso conta as consultas).
**Pronto quando:** testes verdes; o relatório traz as nove mutações (sete mais as duas da emenda 1).

### Tarefa 14: o montador e o teste do banco vazio

**Arquivos.** `M/do-canal.ts` (puro), `TM/medidas-do-canal.test.ts`, `TM/medidas-fixture.ts`.
**Contrato.**
- `interface Insumos { canal: Parte<CanalLido>; videos: Parte<VideoLido[]>; marcas: Parte<…>; retratos: Parte<RetratoDoCanal[]>; series: Parte<Map<…>> | 'nao_pedida'; mudancas: Parte<…> | 'nao_pedida'; multiplos: Map<string, { valor: number | null; baseFraca: boolean }> | 'nao_pedido'; comentarios: ParteDeComentarios | 'nao_pedido' }`.
- `medidasDoCanal(i: Insumos, o: { agoraMs: number }): { porFormato: Record<Formato, { m1: Record<1 | 7 | 30, Medida<number>>; m2; m3b; m3c; m4; m6; m7; m11; m12 }>; m3a; m8; porVideo: Map<string, { m1: Record<1 | 7 | 30, …>; m5; m7; m9; m10; m12 }> }`. Parte não lida: as medidas que dependem dela saem `leitura_falhou`; `'nao_pedida'`: `serie_nao_pedida` ou `sem_multiplo`. Canal não lido: tudo `leitura_falhou`. **(emenda 2: d:m-7)** O montador calcula `agendadoOuNoAr` de cada vídeo (`live_broadcast_content` `'upcoming'` ou `'live'`; nulo é falso) e o passa às medidas; monta as publicações de M6 e a última de M8 com `baseDaIdade` dos vídeos que não são `'upcoming'`. **(emenda 1: s:m7(v))** Cada medida é calculada dentro de um `try`: a que lançar (o `medido` da Tarefa 1 lança com número não finito) vira `nao_medido`, motivo `calculo_falhou`, e as outras seguem; o resultado ganha `falhas: Array<{ medida: string; classe: string }>` (só o nome da medida e o nome da classe do erro, nunca a mensagem). O montador é puro e não importa o Sentry: quem chama (a E5) relata `falhas`. Não uso `leitura_falhou` para isso, como o parecer sugeriu, porque não foi a leitura que falhou e a frase da tela seria falsa.
**Testes.**
- **`banco sem nenhuma linha nova: toda medida devolve nao_medido com motivo` (item 28).** O teste parte de uma fixture cheia (todas as medidas medidas) e **apaga** os dados por etapas, sem substituí-los: (a) sem marcas e sem motivos; (b) sem primeiras horas; (c) sem série; (d) sem retratos; (e) sem vídeos; (f) tudo vazio. Em (f) afirma, para cada folha do resultado, `estado === 'nao_medido'` e `motivo` dentro de `MOTIVOS_NAO_MEDIDO`.
- `nenhuma folha é nula, indefinida, NaN ou Infinity, e nenhuma é zero por falta` (varredura recursiva do resultado nos seis estágios acima).
- `parte não lida vira leitura_falhou só nas medidas que dependem dela` (uma parte por vez; as outras continuam medidas).
- `série não pedida: 1, 7 e 30 pelas marcas; M2 nas outras idades, M5 e "ainda rende" dizem serie_nao_pedida`.
- `múltiplos não pedidos: M4 diz sem_multiplo`.
- `uma medida que lança não derruba as outras` (emenda 1: s:m7(v)): fixture com um retrato de `views` = `Infinity` plantado; M3(a) sai `calculo_falhou`, `falhas` tem a entrada dela com o nome da classe e sem a mensagem (o teste planta uma frase sentinela no erro e ela não aparece), e as medidas que não leem retratos continuam medidas.
- `vídeo agendado: m1 diz fecha_em sem data e o vídeo não entra na mediana de M1` (emenda 1: d:C-1).
- `vídeo agendado ou no ar fica fora de M3(b), M3(c), M4 e M7, contado; o agendado não é publicação de M6 nem a última de M8; o que está no ar é` (emenda 2: d:m-7): fixture cheia mais um vídeo `'upcoming'` com data de hoje e 0 views e um `'live'` que começou ontem; as medianas não mudam, as quatro medidas levam a nota `agendado_fora` com 2, o ritmo conta uma publicação a mais (a do `'live'`, no instante em que começou) e M8 não usa a data do `'upcoming'`.
- `canal misto: nenhum número de longo entra em Shorts` (item 32, de ponta a ponta).
- `os números da fixture conferem à mão` (três valores escritos no teste: uma M1, uma M3(a), uma M7).
**Pronto quando:** testes verdes.

### Tarefa 15: leitor dos insumos de comentários (espera a A4 em `staging`)

**Arquivo.** `M/ler-comentarios.ts` (`import 'server-only'`).
**Contrato.** `lerInsumosDeComentarios(sb, edicao: EdicaoDoSite, { channelId, videoIds }): Promise<ParteDeComentarios>`. Recusa (`sem_permissao`) se `edicaoValida(edicao)` for falso; o site é o de **dentro do token** (`edicao.siteId`), nunca um parâmetro. Lê `competitor_video_comment_snaps` (`video_id, mark, status, taken_at`), `competitor_video_comments` (`id, video_id, parent_id, creator_replied`: **nenhuma coluna de texto, nenhum nome**) e `competitor_video_comment_marks` (`comment_id, mark, likes`), todas com `.eq('site_id', edicao.siteId)`. **(emenda 1: d:m-6)** Só o filtro de site faria cada canal aberto paginar as leituras de comentário do site inteiro, sem teto: as duas primeiras levam também `.in('video_id', bloco)` (blocos de 150 dos `videoIds` pedidos, depois de `lerCanal` e do cruzamento com os vídeos do canal, como na Tarefa 13), e `competitor_video_comment_marks`, que não tem `video_id` (MG8, linha 114), leva `.in('comment_id', bloco)` com os `id` dos comentários que a segunda consulta devolveu. Devolve por vídeo: `retrato7`, `retrato30`, `algumComRespostaDoCriador`, `maiorCurtidas7`, `maiorCurtidas30`, e `coletaDesdeMs` (o `taken_at` mais antigo do canal).
**Testes** (`medidas-ler-comentarios.test.ts`): `sem o token: sem_permissao, e nenhuma consulta é feita`; `objeto forjado com siteId não passa`; `o select não pede body nem coluna de autor` (o falso registra as colunas pedidas); **mutação:** `as três consultas filtram pelo site do token` (linhas de outro site plantadas com os mesmos vídeos); **mutação (emenda 1: d:m-6):** `as leituras de comentário de outro vídeo do mesmo site não são lidas` (o falso conta as linhas devolvidas: com 2 vídeos pedidos e 50 no site, só as dos 2) e `mais de 150 comentários: o in() de comment_id é partido em blocos`; `tabelas vazias: lido, nenhum vídeo, coletaDesdeMs nulo`; `tabela ausente: schema_ausente`; `erro numa das três: a parte inteira é não lida` (não se monta M11 com metade).
**Pronto quando:** testes verdes. Se a A4 ainda não estiver em `staging` na hora do envio, esta tarefa fica para o lote seguinte e o ledger diz.

### Tarefa 16: testes de ponta contra o banco

**Arquivos.** Os dois de `test/integration/`.
**`observatorio-a5-e4-marcas.test.ts`** (o escritor de verdade, com o cliente de serviço local):
- `a marca gravada é igual ao cálculo sobre a série` (item 54): semeia 6 vídeos com série completa, roda `runFecharMarcas`, e para cada marca gravada afirma `marks.views === viewsNaIdade(série lida do banco).views`, e o mesmo para curtidas, e `gap_hours` igual.
- `com as vizinhas além do limite, nenhuma linha é gravada na tabela de marcas e a medida responde o motivo` (item 54): vídeo com um dia faltando ao redor do alvo; depois de `agora >= alvo + 37 h` (emenda 1: d:m-1): zero linhas em `competitor_video_marks`, uma em `…_misses`, e `m1DoVideo` devolve `leituras_distantes`.
- `rodar duas vezes não muda nada` (contagens e `computed_at` iguais).
- `banco sem nenhuma série: só motivos, e a prova fica limpa`.
- `site: a marca de um vídeo do site B nunca aparece na leitura do site A` (ponta a ponta com `lerMarcasDoCanal`).
- `apagar o vídeo e depois rodar: nada volta`.
- `buraco na coleta: a execução que grava o motivo devolve marcas_perdidas, e a seguinte devolve ok` (emenda 1: d:I-3, de ponta a ponta; emenda 2: s:n1: o buraco é ao redor do 7º dia, e um segundo vídeo só com série diária ao redor do 1º dia grava `leituras_distantes` na idade 1 sem deixar vermelho).
- `a base com microssegundos faz a volta inteira pelo cliente` (emenda 2: d:m-2): vídeo com `published_at` `…10:00:00.123456+00`; `runFecharMarcas` com o cliente de serviço de verdade grava a marca dele (`marcas_recusadas` 0). É a guarda do risco 20.
- `a transmissão agendada não ganha marca; começou, ganha a marca na base nova` (emenda 1: d:C-1): vídeo `upcoming` com série desde a criação; `runFecharMarcas` não grava nada dele; depois de `live_actual_start_at` e `'none'`, grava a marca de 1 dia com `age_base_at` = o começo.
- `curtidas interpoladas chegam inteiras ao banco` (emenda 1: s:m3): série com curtidas 70 e 80; a marca gravada tem 73 e a função não lança.
- `tempo: 1.500 vídeos com 49 dias de série, três execuções, cada uma abaixo de 5 s` (o número medido vai no relatório).
**`observatorio-a5-e4-medidas.test.ts`** (os leitores e o montador contra o banco): `banco só com o canal: toda medida nao_medido` (item 28, agora no banco: o teste **apaga** as linhas que semeou e roda de novo); `M3(a) confere com uma consulta direta aos retratos` (o mesmo cálculo em SQL, escrito no teste); `canal de outro site: canal_de_outro_site`.
**Pronto quando:** os dois passam contra `bythiago_int`, sem deixar linha (cada teste apaga o site que criou).

### Tarefa 17: conferências com dado real (itens 29 e 30)

**Quem roda:** o controlador (leitura de produção). O agente prepara e anota.
1. **C-1 a C-17** da seção 3.2, a C-14 e a C-16 primeiro: resultado no ledger; o que mudar de número entra na seção 5 (a C-3 preenche as execuções da carga em 5.2).
2. **Item 29.** Com os três vídeos escolhidos da segunda consulta da C-3 (série completa, 9 dias ou mais), o controlador lê as duas leituras vizinhas de `publicação + 7 dias`:
```sql
select d.taken_at, d.views from public.competitor_video_daily d where d.video_id = '<uuid>' and d.taken_at between timestamptz '<alvo>' - interval '37 hours' and timestamptz '<alvo>' + interval '37 hours' order by 1;
```
O agente faz a conta à mão (`a + (b − a) × (alvo − ta) ÷ (tb − ta)`, arredondada), escreve as três contas **neste plano**, na seção 11, e acrescenta as três como casos de `medidas-m1.test.ts` (`item 29: vídeo real 1`, `2`, `3`, com os números lidos). Depois do D0, compara com `competitor_video_marks.views` dos mesmos três: têm de ser iguais.
3. **Item 30.** Para os 15 canais:
```sql
with b as (select competitor_channel_id as c, max(snapshot_date) filter (where view_count is not null) as d from public.competitor_channel_snapshots group by 1) select ch.channel_name, b.d, s0.view_count as v0, s1.view_count as v28, s2.view_count as v56, case when s0.view_count is null or s1.view_count is null or s2.view_count is null or s1.view_count - s2.view_count <= 0 or s0.view_count - s1.view_count < 0 then null else round(((s0.view_count - s1.view_count)::numeric / (s1.view_count - s2.view_count)) - 1, 4) end as variacao from b join public.competitor_channels ch on ch.id = b.c left join public.competitor_channel_snapshots s0 on s0.competitor_channel_id = b.c and s0.snapshot_date = b.d left join public.competitor_channel_snapshots s1 on s1.competitor_channel_id = b.c and s1.snapshot_date = b.d - 28 left join public.competitor_channel_snapshots s2 on s2.competitor_channel_id = b.c and s2.snapshot_date = b.d - 56 order by 1;
```
O agente guarda o resultado como fixture (`TM/medidas-fixture.ts`, bloco `retratosReais`, só datas e contagens) e acrescenta, em `TM/medidas-direcao-estado.test.ts` (emenda 1: s:m2: o arquivo não estava dito), o teste `item 30: M3(a) dos 15 canais confere com a consulta direta` e `a janela que cruza 24/08 sai marcada` (com a data de hoje, toda janela de 56 dias cruza até 18/10 e nenhuma cruza de 19/10 em diante).
**Pronto quando:** as três contas e a tabela dos 15 canais estão na seção 11; os dois testes verdes.

### Tarefa 18: envio e conferências

**Antes (o que tem de estar em produção).** A MG4 aplicada pelo dono e V1 a V5 conferidas (emenda 2: d:I-R2-1); o Lote B (agenda) em produção; a Tarefa 12, que foi antes (até 30/10/2026). **(emenda 1: s:I4) Sem o Lote B em produção o lote da E4 não vai.** A frase anterior ("pode ir assim mesmo sem a Tarefa 11") estava errada: `fechar-marcas.ts` importa `agenda/relogio.ts` e o commit de `rules.ts` da Tarefa 1 está em cima de linhas do Lote B; sem ele o typecheck do CI quebra ou o envio vira resolução de conflito à mão.
**No commit do envio.** `conferencias.ts`: `export const E4_DEPLOY: string | null = '<dia de São Paulo da promoção>'` e `conferenciasE4(deploy)`, no molde de `conferenciasE1E2` (nula = nenhuma entrada; malformada = uma entrada de 1970, vermelha), espalhada em `CONFERENCIAS`; o espelho em `.superpowers/sdd/a5/conferencias-com-data.md`. Entradas (todas `etapa: 'E4'`, responsável `agente`):

| id | Data | O que conferir e o esperado |
|---|---|---|
| `e4-d0` | D0 | depois de `teto(pares ÷ 1.500)` disparos (3 com o número do spec): `select public.competitor_marks_health(now(), 8, 36)`: `atrasadas` 0, `em_duas_tabelas` 0, `site_divergente` 0, `base_divergente` 0 (lida solta pode vir maior que 0 se uma sincronização mudou a base de algum vídeo desde a última execução; some na seguinte), `marcas + faltas` perto de 3 × vídeos com data menos os pares ainda não fechados e menos os agendados ou no ar (C-15); **(emenda 1: d:m-4)** a agenda tem **uma linha por tarefa e dia**, e as levas do D0 são a mesma linha: `select status, runs, attempts, unfinished_n, done_n, left_n, reason, duration_ms, detail from competitor_agenda_runs where task = 'marcas_de_idade' order by started_at desc limit 1`: `status` `ok`, `runs` = o número de levas, `attempts` 1 (retomada com progresso não gasta; 2 se houve um vermelho `marcas_perdidas` no meio), `duration_ms` da última abaixo de 5.000; `select reason, count(*) from competitor_video_mark_misses group by 1`: quase tudo `leitura_comecou_depois`. **(emenda 2: d:m-1, s:n2) O `detail` dessa linha é só o da última execução do dia** (`competitor_agenda_finish` grava `detail = p_detail` a cada fecho: MG10, linha 95): a leva que voltou a verde escreve `perdidas: 0` por cima da que saiu vermelha, e quem lesse o número ali anotaria "sem perda". **O número das perdas se lê na tabela que fica, pela consulta das perdas logo abaixo desta tabela**, e se anota por idade: idade 1 é o esperado por desenho (comparar com a C-17), idade 7 é perda de V7 por leitura faltando, idade 30 é o V30 dos vídeos de setembro fora da faixa diária (comparar com a C-16). **(emenda 2: s:n5)** Olhar também `reason` e `attempts`: `passou_do_tempo`, ou `attempts` acima do que os vermelhos esperados explicam, quer dizer que a tarefa começou tarde no disparo e as duas idas não couberam até `fimAteMs`; repetido, o remédio é baixar `MEASURE_RULES.batch` (um número) |
| `e4-d1` | D+1 | a execução das 4 h: `ok`; marcas de 7 dias novas para os vídeos publicados há 8 ou 9 dias (emenda 1: d:m-8: os de 7 dias ainda aguardam a leitura diária das 12 h); `select age_days, count(*), min(gap_hours), max(gap_hours) from competitor_video_marks group by 1`: `max(gap_hours) <= 36` (e `<= 8` na idade 1); (emenda 2: s:n5) na linha do dia em `competitor_agenda_runs`, `reason` diferente de `passou_do_tempo` e `attempts` 1; (emenda 2: d:m-1) a consulta das perdas, comparada com a do D0 |
| `e4-d7` | D+7 | `select age_days, (select count(*) from competitor_video_marks m where m.age_days = a) as marcas, (select count(*) from competitor_video_mark_misses x where x.age_days = a and x.reason = 'leituras_distantes') as distantes from unnest(array[1, 7, 30]) a`: `distantes ÷ (marcas + distantes)` abaixo de 10% na idade 7 (acima: pergunta 2, propor 48 horas); item 29: as três marcas iguais às contas da seção 11. **(emenda 2: d:m-3, s:n1) A mesma conta na idade 1, só com os pares decididos depois de o Lote B estar em produção** (`decided_at` e `computed_at` posteriores a essa data): abaixo de 10%, propor ao dono pôr o 1 em `MEASURE_RULES.lost.alarmAges`; acima, a idade 1 continua fora do vermelho e o número vai para o ledger |
| `e4-v30` | 05/11/2026 | as primeiras marcas de 30 dias (vídeos de 03/10): existem, `gap_hours <= 36`; contar `leituras_distantes` na idade 30 por canal: tem de ser zero nos canais da C-14 se a Tarefa 12 estava em produção até 30/10 |
| `e4-dia31` (emenda 1: d:I-1, s:I3) | 03/11/2026 | a consulta da Tarefa 12 (vídeos de 30 a 32 dias com ponto diário hoje), depois das 13 h de São Paulo: as duas contagens iguais em todo canal. Só entra aqui se o lote subir antes de 03/11; a linha já está no espelho desde a Tarefa 12 |
| `e4-queda` | 14/12/2026 | M8 "queda" passa a ser medida: rodar `estadoDoCanal` (script de leitura no scratch) nos 15 canais; nenhuma `janela_cruza_mudanca_de_contagem` |
| `e4-limiares` | 01/02/2027 | pergunta 3: há 20 vídeos com V30 e 90 dias? (`select count(*) from competitor_video_marks m join competitor_videos v on v.id = m.video_id where m.age_days = 30 and v.published_at <= now() - interval '90 days'`). Com 20 ou mais: conferir os limiares de M10 contra eles e levar ao dono; com menos: reagendar para 01/04/2027, no mesmo commit que preenche `feitaEm` |

**Consulta das perdas (emenda 2: d:m-1, s:n2), só leitura; vale em qualquer dia, porque lê a tabela que fica e não o detalhe da agenda.** Os dois códigos só existem quando a série do vídeo já tinha leitura antes do alvo (4.2), e o vídeo que saiu do YouTube fica fora, como em `marcaPerdida`:
```sql
select x.age_days, x.reason, count(*) as pares, min(x.decided_at) as primeira, max(x.decided_at) as ultima from public.competitor_video_mark_misses x join public.competitor_videos v on v.id = x.video_id where x.reason in ('leituras_distantes', 'leitura_parou_antes') and v.missing_since is null group by 1, 2 order by 1, 2;
```

Datas absolutas: D0, D+1 e D+7 saem de `E4_DEPLOY`; as outras quatro são fixas (emenda 1: com a `e4-dia31` são sete entradas). Testes em `conferencias.test.ts`: `sem a data não há entradas de E4`; `com a data, as três relativas nas datas certas e as quatro fixas`; `data malformada vira uma entrada vermelha`; `a constante publicada é nula ou uma data real`.
**Lista de arquivos do lote** (envio por lista explícita de commits; há outros lotes locais): os de `M/`, os de `TM/medidas-*`, os dois (ou três) de `test/integration/observatorio-a5-e4-*`, `rules.ts` (o commit da Tarefa 1; o da Tarefa 12 já foi), os sete da agenda, `conferencias.ts`, o teste e o espelho, e o arquivo da migration.
**Ordem que não pode inverter.** (1) acordo dos dois especialistas; (2) arquivo da MG4 criado na vez do lote; (3) `db:push:prod` pelo dono; (4) V1 a V5 (emenda 2: d:I-R2-1: a V5 com nome de tabela na resposta para tudo; com `mg6_ausente`, ela é repetida logo depois que a MG6 for aplicada); (5) push em `staging`, CI verde; (6) promoção a `main`, fora de 11:55 a 12:15 UTC; (7) `e4-d0`. **Se inverter (3) e (5) a (6):** a tarefa fica vermelha com `migration não aplicada` até a migration entrar; nada é gravado e nada se perde; os leitores respondem `leitura_falhou`. Não há variável a ligar depois: o padrão é ligado.
**Volta.** `OBS_AGENDA_TASKS_OFF=marcas_de_idade` na Vercel **e um redeploy de produção** (reconciliação 13/10: R4: variável da Vercel só vale para deploy novo, como a emenda I7 do plano da E11 e o plano da E10 já dizem; custa um build) (a agenda mostra "desligada"); ou reverter o commit da Tarefa 11. As duas tabelas ficam, sem uso. Religada, a tarefa recupera o atraso sozinha enquanto a série estiver online. A Tarefa 12 volta revertendo o commit dela: os vídeos de 30 a 32 dias voltam à faixa semanal na sincronização seguinte. **O que não se desfaz:** (emenda 1: d:I-1) a leitura diária que deixou de ser feita enquanto a Tarefa 12 esteve fora, e com ela o V30 daqueles vídeos; fora isso, nada; marca gravada com regra errada se corrige apagando as linhas daquela `rule_version` (comando do dono, fora deste plano) e deixando a tarefa regravar.
**"Os números não mudam" (item 247).** Este plano não toca nenhum arquivo que calcula número de tela, salvo a Tarefa 12 (enviada antes, em commit próprio), que muda **coleta** (mais pontos diários), não conta. A prova é a suíte de paridade existente (`channels-parity`, `effect-parity`, `forja-parity`, `consumidores-semanal`) verde sem mudança de expectativa, mais `git diff --stat` do lote sem nenhum arquivo de `observatorio/` fora de `medidas/` e `rules.ts`. A chave nova de `RULES.series` (Tarefa 12) só é lida por `competitor-tiers.ts`. O retrato de produção antes e depois não se aplica (nenhuma tela lê o que este lote grava).
**Pronto quando:** `e4-d0` feita e anotada; `feitaEm` preenchido.

---

## 11. Consultas de conferência e o que foi rodado

**Rodado em 13/10/2026, no banco local `bythiago_int`** (`postgresql://postgres:postgres@127.0.0.1:54422/postgres`, com MG1, MG2 e MG8), sempre dentro de `begin; … rollback;`. **(emenda 1) Tudo abaixo foi rodado de novo com o SQL emendado do Apêndice A** (extraído deste arquivo, não de uma cópia), no mesmo dia: o roteiro duas vezes, com saídas iguais, e o roteiro de volume uma vez. Depois de cada execução: `to_regclass('public.competitor_video_marks')` nulo e nenhum vídeo de prova no banco. **(emenda 2) E de novo com o SQL da emenda 2**, extraído deste arquivo, no mesmo dia: o roteiro (com `base_at` em todo item gravado e o cenário S12) duas vezes, com saídas iguais, e o roteiro de volume uma vez (com `base_at` copiado de `pending` em cada motivo); depois, a mesma conferência de limpeza.

1. **A migration aplicada duas vezes seguidas na mesma transação:** sem erro (só os avisos de "já existe").
2. **O roteiro do Apêndice B, duas vezes:** as duas saídas iguais (`diff` vazio). A saída é o Apêndice C. O que ele prova, cenário por cenário:

| Cenário | O que mostra |
|---|---|
| S0 | prova com as tabelas vazias: `atrasadas` 9, não 0 (tabela vazia não é verde) |
| S1 | pendentes: 9 pares; o vídeo sem data não aparece; idade 30 do vídeo de 19 dias não aparece; leituras das duas tabelas na vizinhança (3 e 3); primeira e última leitura; a base da estreia; o site do canal; o limite e o total; `p_now` nulo devolve vazio |
| S2 | gravar: 1 marca, 3 recusadas (alvo fora das leituras; 48 h de distância; vídeo sem data), 4 motivos; o motivo de par que acabou de ganhar marca não entra; o `site_id` do vídeo D é o do canal dele, não o do chamador; `gap_hours` 24.000 calculado pelo banco |
| S3 | a mesma marca de novo com outro número: `marcas` 0, continua 731 |
| S4 | motivo e depois a marca do mesmo par: `faltas_limpas` 1, zero motivos do vídeo |
| S5 | motivo da mesma versão não troca; versão 2 reabre 7 pares e troca o motivo |
| S6 | pendentes depois: só os três pares que ninguém decidiu |
| S7 | prova: `atrasadas` 3; e o limiar de tempo (2 um minuto antes do prazo, 3 no prazo) |
| S8 | defeitos plantados: `em_duas_tabelas` 1, `site_divergente` 1 |
| S9 | cascata: apagar os vídeos zera as duas tabelas |
| S10 | privilégios e RLS: falso, falso, verdadeiro; `anon` sem `select`; `authenticated` com `select` e sem `insert`; 2 tabelas com RLS; as duas policies por `can_view_site(site_id)` |
| S0 a S8, de novo (emenda 1) | o vídeo F (transmissão agendada, criada há 12 dias, `'upcoming'`) está no banco desde o começo do roteiro e **não muda nenhum número**: `atrasadas` continua 9 e os pares pendentes continuam 9 (sem a exclusão seriam 11). As saídas de S0 a S8 só ganharam as chaves novas (`base_divergente`, `missing_since`, `faltas_recusadas`, `refeitas_por_base`) |
| S11 (emenda 1; roda antes do S9) | agendado: 0 pares pendentes do F; marca e motivo mandados para ele são recusados (1 e 1; o `faltas_limpas` 1 dessa linha é a limpeza do par duplicado que o S8 plantou, não é do F). A transmissão começa: só o par de 1 dia do F aparece, com a base 16/11. Motivo cedo demais: recusado às 22:59 de 13/11 e aceito às 23:00 (alvo + 36 h + 1 h). A base do vídeo A anda 1 dia: a prova conta `base_divergente` 2; os pares 1 e 7 do A voltam com a base nova; gravar devolve `refeitas_por_base` 2 e aceita a marca de 7 dias na base nova (929); a prova volta a 0 |
| S9, de novo | antes de apagar: 1 marca e 5 motivos (eram 2 e 5: as duas marcas de base antiga do A saíram e entrou a nova; o motivo duplicado do S8 saiu e entrou o do E/7) |
| S0 a S11, de novo (emenda 2) | com `base_at` em todo item mandado a `apply`, nenhuma contagem mudou: as linhas da saída até `S11 depois` são as da emenda 1, e só `S1 A/7` ganhou as chaves `prev_reason` e `series_tier` |
| S12 (emenda 2; roda antes do S9) | a base do A anda 2 horas entre as duas idas: a marca de 1 dia calculada para a base velha é **recusada** embora as leituras (06:00 e 13:00) cerquem o alvo novo, e a mesma marca com a base nova entra (`1:160@…12:00`); a limpeza dessa chamada levou a marca de 7 dias do S11, que era da base de antes (`refeitas_por_base` 1). Marca e motivo sem `base_at`: recusados (1 e 1). Pendentes da versão 2: cada par traz o motivo que já tinha (`b/1` e `b/30` `leitura_comecou_depois`, `d/1` `sem_leitura`, `e/7` `leituras_distantes`) e traço onde não havia; todos os itens têm a chave `series_tier`. O E passa a agendado: gravar apaga o motivo dele (`refeitas_por_base` 1; 0 motivos do E). O B perde a data: a prova não conta (`base_divergente` 0), gravar não apaga (`refeitas_por_base` 0) e os 3 motivos dele ficam |
| S9, mais uma vez (emenda 2) | antes de apagar: 1 marca (a de 1 dia do A, na base nova) e 4 motivos (os 3 do B e o do D; o do E saiu no S12) |

3. **Volume** (roteiro à parte, mesma transação revertida): 1.500 vídeos e 73.500 linhas diárias semeados; `competitor_marks_pending` com 4.363 pares pendentes: 48 ms (limite 500, 296 KB), 104 ms (limite 1.500, 756 KB) e 124 ms (limite 2.000, 972 KB); `competitor_marks_health`: 3 ms; `competitor_marks_apply` com 500 motivos: 23 ms, dos quais 483 gravados e 17 recusados por serem de pares fechados há menos que o limite mais 1 hora (o roteiro manda motivo para tudo; é a recusa nova funcionando). (emenda 1: números do SQL emendado; com o de antes eram 41 ms, 94 ms, 2 ms e 20 ms.) **(emenda 2: com o SQL da emenda 2, uma execução:** 52 ms (limite 500, 310 KB), 96 ms (limite 1.500, 799 KB) e 127 ms (limite 2.000, 1.031 KB); `health` 3 ms; `apply` de 500 motivos 28 ms, com os mesmos 483 gravados e 17 recusados por prazo, nenhum por base.)

**Não rodado:** nenhuma consulta em produção (seção 3.2); nenhum teste de RLS com usuário real (Tarefa 9); o tempo com o tamanho real da série de produção. (emenda 1) Também não rodado: nenhum teste de TypeScript das mudanças da emenda (são contrato, a escrever); e o que o YouTube devolve em `publishedAt`, `viewCount` e `liveBroadcastContent` para uma transmissão agendada de verdade (não há fixture real; a C-15 mede quantas existem). (emenda 2) Também não rodado: a saída de reserva de 0.1 (a MG4 recriando `obs_archive_registry()`), porque o corpo da MG6 não existe como arquivo; a V5 contra um banco com a MG6 (o `bythiago_int` não a tem); e nenhum teste de TypeScript das mudanças desta emenda.

**Item 29 (contas à mão) e item 30 (os 15 canais):** a preencher pela Tarefa 17, aqui, com os números lidos.

---

## 12. Onde está cada item de aceite

| Item | O que pede | Onde |
|---|---|---|
| 27 | função pura com teste de borda para M1 a M9 (±10%, 3 vídeos, 2 vezes, 1.000 views, amostra abaixo do mínimo, divisor zero) | Tarefas 2 a 6 (os testes de limiar nomeados em cada uma); `medido` que lança com não finito (Tarefa 1); varredura do montador (Tarefa 14) |
| 28 | banco sem linha nova: toda medida `nao_medido` com motivo, em teste que apaga os dados | Tarefa 14 (em memória, seis estágios) e Tarefa 16 (no banco) |
| 29 | M1 de três vídeos reais conferida à mão, conta anotada no plano | Tarefa 17, seção 11; conferida de novo em `e4-d7` |
| 30 | M3(a) dos 15 canais confere com consulta direta; janela que cruza 24/08 marcada | Tarefa 17; Tarefa 4 (`janela … leva a nota`); Tarefa 16 (a mesma conta em SQL) |
| 31 | ao vivo fora das medianas de M1, M2 e M7, e o resultado diz quantos | Tarefas 2, 3 e 5 (nota `ao_vivo_fora`) |
| 32 | longos e Shorts nunca na mesma mediana (canal misto) | Tarefa 2 (teste do canal misto), Tarefa 14 (de ponta a ponta) |
| 54 | marca gravada = cálculo; vizinhas além do limite: nenhuma linha e a medida responde o motivo | Tarefa 16 (os dois primeiros testes); Tarefa 9 (`gravar: marca com distância acima do limite é recusada`) |
| 55 | M10: bordas das três condições, duas de três, sem reação pública, canal com 4, ao vivo fora | Tarefa 7 |
| 124 | M11 e M12: bordas; "não vimos resposta" | Tarefa 8 (a parte de dados: nenhum campo afirma "não respondeu"); **a frase em tela é da E5** |
| 245 | interruptor: variável apagada = padrão; desligado nunca é "ok" | Tarefa 11 (dois testes) |
| 246 | conferências com data | Tarefa 18 (sete entradas, com a `e4-dia31` da emenda 1) |
| 247 | os números não mudam, sobre base congelada | Tarefa 18 ("Os números não mudam"): suíte de paridade sem mudança e nenhum arquivo de conta tocado |
| 77 (E10) | o export recusa sem marca nem motivo | **fora**: é do plano da E10. Aqui: a definição que ela consulta (4.6) e as duas tabelas |
| 56 (E5) | M10 no corpo da tela, sem a palavra "retenção" | **fora**: tela. Aqui: `TEXTO_OBRIGATORIO_M10` e o teste de que ele não tem a palavra (Tarefa 7) |
| 241, 242 (E5) | cor de direção | **fora**: tela. Aqui: `direcao` e o estado de M8 como dado (Tarefa 4) |
| Regras comuns (a) a (h) da seção 5 do spec | | (a) Tarefa 1; (b) Tarefas 2, 3, 5; (c) cada medida; (d) Tarefa 4; (e) é texto de tela, E5; (f) Tarefas 1 e 4; (g) Tarefa 2 (`fora_do_ar_dentro`); (h) o motivo `arquivado` existe no catálogo e **nenhuma função daqui o devolve ainda**: quem o produz é a E10, quando houver arquivo (seção 13, dívida 3) |

Nenhum item da E4 fica sem tarefa. Os que ficam fora estão ditos com o dono.

---

## 13. Riscos que ficam, sem suavizar

1. **A marca de 1 dia quase não vai existir até a leitura horária entrar.** Com uma leitura a cada 6 horas e limite de 8, qualquer sincronização atrasada em mais de 2 horas perde a marca; e só vale para vídeo descoberto até 24 horas depois de publicado. A C-8 mede. O plano não afrouxa o limite: é o do spec, e 8 horas de interpolação no primeiro dia já é muito. **(emenda 2: s:n1, d:m-3) Por isso a perda de V1 não deixa o disparo vermelho:** fica em `perdidas_1`, no detalhe da última execução do dia, e na tabela de motivos, e só aparece para quem rodar a consulta das perdas (`e4-d0`, `e4-d1`, `e4-d7`). É uma perda sem aviso, escolhida de propósito para o aviso das outras idades continuar sendo lido; a `e4-d7` decide se a idade 1 entra.
2. **A marca de 30 dias depende de uma leitura que só passa a existir com a Tarefa 12 em produção antes de 02/11/2026** (para vídeos fora dos N mais recentes). Se ela atrasar além disso, os vídeos de 03/10 desses canais ficam `leituras_distantes` para sempre: a leitura do dia 31 não se refaz. **(emenda 1: d:I-1, s:I3) Agora tem dono e data:** a Tarefa 12 é envio próprio, até 30/10/2026, e a C-14 (a primeira a rodar) diz se algum canal está nesse caso hoje. O que continua em aberto: se a C-14 não for rodada e a tarefa não subir, a perda acontece calada até a `e4-v30`.
3. **Com a agenda desligada, a tarefa não roda e ninguém avisa.** O vigia cobra a tarefa pelo catálogo, mas `OBS_AGENDA=off` tira o catálogo do ar. Não há perda enquanto a série estiver online; passa a haver quando a E10 começar a arquivar: a recusa do item 77 é a proteção, e é dela.
4. **`likes_hidden` e `comments_disabled` "na marca" são os do vídeo na hora da gravação**, e só são gravados como verdadeiros até 72 horas depois do alvo. Na carga inicial e em qualquer recuperação de atraso ficam nulos ("não se sabe") mesmo quando o canal tinha ocultado.
5. **A série diária não tem coluna de ocultação:** curtidas nulas numa leitura podem ser "oculto" ou "a API não mandou". A marca guarda nulo nos dois casos.
6. **Estreia e transmissão não se distinguem** (risco 7 do spec): as duas saem das medianas juntas, e a base da idade muda para as duas.
7. **A interpolação subestima a subida inicial** (risco 6): a distância fica gravada (`gap_hours`) e as duas leituras também.
8. **M3(b) compara vídeos de idades diferentes e "descer pode ser só idade"**; o catálogo guardado é parte do canal (1.389 de 6.089 vídeos, segundo o spec), e em muitos canais a janela de 91 a 180 dias terá menos de 3 longos (C-6).
9. **Os limiares de M10 são palpite** (risco 11) e não há vídeo para conferi-los antes de janeiro de 2027. A função existe e responde "não medido" até lá.
10. **M12 é o exemplo que a política do YouTube dá do que não fazer** (III.E.4.h). Risco aceito pelo dono em 11.1 do spec; cortar é uma chave.
11. **`can_view_site` é a policy das duas tabelas, como nas irmãs.** (emenda 1: o parecer de dados leu a função, `20260507000001_schema.sql`: ela decide por super admin, admin da organização ou vínculo com o site e **não lê o GUC**; o risco não se confirma para estas tabelas, e o teste fica como guarda.) Se ela confiar no GUC `app.site_id` (o padrão de falha registrado na memória do projeto), um usuário autenticado de outro site poderia ler contagens públicas de concorrentes deste. O teste de RLS da Tarefa 9 forja o GUC; se falhar, o conserto é das tabelas `competitor_*` inteiras, não só destas duas.

12. **(emenda 1: d:C-1) Uma marca de base antiga sai da tabela "que fica para sempre".** Quando a base de um vídeo anda, a marca velha é apagada e o par é refeito pela série; se a base nova não puder ser medida, fica um motivo no lugar do número. Só o total aparece (`refeitas_por_base`, no detalhe da execução), não o número apagado. E a regra supõe a série no banco: ver a dívida 3.
13. **(emenda 1: d:C-1) Vídeo ainda não relido depois da E1 tem `live_broadcast_content` nulo**, e nulo conta como "nem agendado nem no ar". Uma transmissão agendada antiga e ainda não relida no D0 pode ganhar motivo com a base da publicação; quando for relida e começar, a base anda e o par é refeito. Até lá o motivo está errado sem aviso (a C-15, coluna `estado_ainda_nulo`, mede quantos podem estar nesse caso; a partir de 20/10 deve ser perto de zero). (emenda 2: d:m-6) Se a releitura mostrar que o vídeo está agendado ou no ar, a linha errada é apagada na execução seguinte; não fica mais para sempre quando a transmissão nunca começa.
14. **(emenda 1: d:I-3) `marcas_perdidas` avisa uma vez, na execução que grava.** Se o dono não ler o resumo daquele disparo, a perda fica **só na tabela de motivos** (emenda 2: d:m-1, s:n2: a frase anterior contava também com `competitor_agenda_runs.detail`, mas a agenda tem uma linha por tarefa e dia e o detalhe guarda só a última execução: a que volta a verde 20 minutos depois escreve `perdidas: 0` por cima; `cron_health.last_error` guarda a frase até a falha seguinte do mesmo cron). Quem quiser o número roda a consulta das perdas da Tarefa 18. Não há aviso recorrente (seria alarme eterno para uma perda que não se desfaz).
15. **(emenda 1: s:m1) No D0 o vigia manda um aviso de tarefa atrasada** até o primeiro `ok` (cerca de 1 hora). É ruído esperado, avisado antes.
16. **(emenda 1: s:I2) A ordem 5.5 é um desvio do spec**, que só tem as ordens 1 a 8. Os planos da E16 parte 2 e da E10 não precisam mudar nada por causa dela (o da E10 já usa `ordem: 4`), mas quem escrever o da E16 parte 2 deve saber que o catálogo terá nove tarefas.

17. **(emenda 2: d:I-R2-1) O export da E10 depende de uma entrada que este plano não escreve.** A entrada de `competitor_video_mark_misses` no registro é pedido ao controlador para o plano da E10. Se ela não entrar e as duas migrations forem aplicadas, o export e a remoção de canal arquivado recusam até outra migration. O que segura: a V5 (que manda parar) e o teste da Tarefa 9, que só roda de verdade num banco com a MG6.
18. **(emenda 2: s:n1, d:m-4) O D0 provavelmente tem um vermelho `marcas_perdidas`**, pelo V30 dos vídeos de setembro que saíram da faixa diária sem a leitura do dia seguinte. É perda real e sem volta, não ruído; a C-16 diz o tamanho antes, e cada dia sem a Tarefa 12 em produção aumenta o número.
19. **(emenda 2: s:n5) Por ser a última das leves, a tarefa pode começar perto dos 75 s e não caber até os 85 s** (duas idas de até 5 s cada, mais a decisão de 1.500 pares). O despachante fecha `erro`, `passou_do_tempo`, e gasta uma das 12 tentativas; a gravação abandonada é idempotente e não deixa dano. Com nove tarefas no catálogo isso deixa de ser raro. O desenho não muda; a `e4-d0` e a `e4-d1` olham, e o remédio é baixar `batch`.
20. **(emenda 2: d:m-2) O `base_at` é comparado por igualdade exata.** Se algum cliente no caminho reformatar o instante e perder precisão (o contrato manda devolver o texto como veio), todo item daquele vídeo é recusado e o disparo fica vermelho com `marca_recusada` a cada execução: falha barulhenta, não calada. O teste com microssegundos (Tarefas 2 e 9) é a guarda.

### O que nenhum teste vai provar

- Que 36 horas é o limite certo para o ritmo real da coleta (só a C-2 e a `e4-d7`).
- O tempo das duas funções com a série de produção (só a `e4-d0`).
- Que a leitura do dia 31 passa a existir em produção depois da Tarefa 12 (só a `e4-v30`).
- Que os limiares de subida e de M10 separam o que o dono chamaria de "subiu" e de "estourou e parou".
- Que a base da estreia é a certa quando o YouTube devolve `actualStartTime` de uma estreia agendada (não há fixture real de estreia).
- Que a E5 mostra `queda não medida` em vez de "ativo" calado: aqui só se entrega o dado para isso.
- Que a prova pega um defeito que ninguém imaginou: ela conta quatro coisas (atraso, par duplicado, site errado e, com a emenda 1, base antiga) e mais nada.
- (emenda 1) Que o filtro de `'upcoming'` e `'live'` cobre o que o YouTube devolve de verdade para estreia e transmissão agendadas (só há o que a MG8 já supõe, e nenhuma fixture real).

### Dívida registrada

1. **A remoção de canal não mostra a contagem de marcas.** A próxima migration que recriar `competitor_channel_removal_impact` (a MG6, se recriar) parte do corpo da MG9 e acrescenta `'marks'` e `'mark_misses'`.
2. **`countRuleOf` nasce aqui e o spec a quer única:** a E5 e a E9, quando marcarem o corte nas séries longas, importam de `medidas/contagem.ts`.
3. **O motivo `arquivado`** só passa a ser devolvido quando a E10 existir; o montador ganha a entrada "arquivado desde" nessa hora. **(emenda 1: d:m-7, d:C-1) Duas condições para o plano que arquivar série (o da manutenção, depois da E10):** na mesma migration, `competitor_marks_pending` e as duas limpezas por base de `competitor_marks_apply` passam a deixar de fora o vídeo com a série arquivada. Sem isso, (a) uma troca de `ruleVersion` depois do arquivo trocaria o motivo verdadeiro (`leituras_distantes`) por `sem_leitura`, e (b) uma mudança de base apagaria uma marca que não pode mais ser recalculada. Hoje nada é arquivado, e nenhum dos dois acontece.
4. **A série completa por canal é cara de ler** (5.3): guardar M2 e M5 em pacote é decisão da E5.
5. **Vídeo com estreia mais de 2 dias depois da publicação e fora dos N mais recentes** não tem V30 (4.4): contar na C-4 e decidir depois.
6. **(emenda 1: s:m8, parte recusada)** O rótulo `leitura_parou_antes` continua valendo para todo par cuja última leitura do vídeo, na hora da decisão, é anterior ao alvo, saiu o vídeo do YouTube ou não. O parecer de software sugeriu reservar o rótulo ao vídeo com `missing_since`; não mudei: o motivo é decidido pelos fatos da hora da decisão e `since_at` guarda a última leitura. Quem separa "saiu do YouTube" de "buraco na coleta" é `marcaPerdida`, pelo `missing_since`. Se a E5 quiser duas frases, lê `competitor_videos.missing_since` junto.
7. **(emenda 1: s:m4, parte não feita)** `marcas_recusadas` não separa no banco "vídeo inexistente" de "leituras não cercam o alvo"; a frase do motivo diz as três causas e que só a repetição é defeito.
8. **(emenda 1, achado ao reler; emenda 2: d:m-7: FECHADA)** O parecer de dados da rodada 2 decidiu por tirar: vídeo agendado ou no ar fica fora de M3(b), M3(c), M4 e M7, contado na nota `agendado_fora`, e o agendado não é publicação de M6 nem de M8 (Tarefas 4, 5 e 14; desvio 22). Não trava o envio: nenhuma tela lê isso antes da E5.

---

## 14. Apêndices

- **Apêndice A:** o SQL final da MG4, como foi rodado.
- **Apêndice B:** o roteiro de prova (psql), como foi rodado.
- **Apêndice C:** a saída do roteiro (igual nas duas execuções).

### Apêndice A: MG4

**(noite de 14/10, Tarefa 8b) Este é o texto da MG4 COM a pausa de coleta (R3), rodado duas vezes no `bythiago_int` dentro de transação desfeita, com a MG6 (ensaio da E10) aplicada antes na mesma transação.** Mudanças em relação ao texto da emenda 2: (1) guarda `MG4 depende da MG6` como primeira instrução; (2) `competitor_marks_pending` deixa de fora o vídeo de canal com `collection_paused_at`, devolve `pares_em_pausa` ao lado de `total_pendentes` e `gap_crossed_pause` em cada item (verdadeiro quando o tempo NÃO pausado do buraco cabe no limite do par; pausas sobrepostas contadas uma vez, por `range_agg`); (3) `competitor_marks_health` tira de `atrasadas` o par de canal pausado. O `check` de `reason` fica com os seis valores (decisão da 8b, a confirmar por Phil e Yannis). A cópia versionada é `apps/web/test/fixtures/sql/a5-e4-mg4.sql` (idêntica); o `db:new` da Tarefa 9 cola este bloco. **Pendente: o acordo dos dois especialistas (portão da Tarefa 9).**

```sql
-- A5, E4 (MG4): marcas de views nas idades 1, 7 e 30 dias dos vídeos de concorrentes, e o registro do que não pôde ser medido.
-- Aditiva: duas tabelas novas (vazias) e três funções novas. Nenhuma tabela existente é alterada; o código que está em
-- produção não lê nem grava nada daqui. Idempotente (pode ser aplicada duas vezes).
-- A idade conta de greatest(published_at, live_actual_start_at), a mesma base dos retratos de comentários (MG8).
-- A conta (interpolação e limites) é do código (função pura de M1); o banco só entrega as leituras vizinhas e guarda o resultado.
-- (emenda 1: C-1) Vídeo agendado ou no ar (live_broadcast_content 'upcoming' ou 'live') não tem idade: fica fora das três
-- funções, como na MG8. Marca ou motivo decidido com uma base que depois mudou é apagado e o par é refeito pela série.
-- (emenda 2) Quem grava devolve a base que recebeu (base_at) e o banco confere; linha de vídeo que passou a agendado ou
-- no ar é apagada; a prova não conta vídeo sem data; os pendentes trazem a faixa do vídeo e o motivo anterior do par.

-- (R3, tarefa 8b) Canal com a coleta pausada (MG6) não tem par pendente nem atrasado; cada item de competitor_marks_pending diz
-- se o buraco entre as leituras vizinhas cruza uma pausa registrada (gap_crossed_pause) e a função devolve pares_em_pausa.

-- (R3, tarefa 8b) A pausa de coleta mora na MG6 (competitor_channels.collection_paused_at e competitor_collection_pauses): a MG4 não
-- se aplica pela metade. Guarda: primeira instrução do arquivo.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'competitor_channels' and column_name = 'collection_paused_at')
     or to_regclass('public.competitor_collection_pauses') is null then
    raise exception 'MG4 depende da MG6';
  end if;
end $$;

set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. A marca: uma linha por vídeo e idade, gravada UMA vez. Sem linha = não medido (o motivo fica na tabela 2).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_marks (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  age_days smallint not null check (age_days in (1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  views bigint not null check (views >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  likes_hidden boolean,
  comments_disabled boolean,
  rule_version smallint not null default 1,
  gap_hours numeric not null check (gap_hours >= 0),
  computed_at timestamptz not null default now(),
  age_base_at timestamptz not null,
  read_before_at timestamptz not null,
  read_after_at timestamptz not null,
  primary key (video_id, age_days),
  constraint competitor_video_marks_reads_check check (read_before_at <= read_after_at)
);
create index if not exists idx_cvm_site on public.competitor_video_marks (site_id);
comment on table public.competitor_video_marks is 'A5 E4: views (e curtidas e comentários) de um vídeo de concorrente na idade de 1, 7 ou 30 dias, por interpolação linear entre as duas leituras vizinhas. Gravada uma vez, quando a idade fecha; nunca regravada, salvo quando a base da idade do vídeo mudou depois (age_base_at diferente da base atual: a linha é apagada e o par é refeito). Sem linha = não medido (o motivo está em competitor_video_mark_misses).';
comment on column public.competitor_video_marks.likes is 'Nulo = oculto pelo canal ou não medido (ver likes_hidden). Nunca zero por falta.';
comment on column public.competitor_video_marks.comments is 'Nulo = desligado ou não medido (ver comments_disabled). Nunca zero por falta.';
comment on column public.competitor_video_marks.likes_hidden is 'O estado NA MARCA. false = curtidas medidas; true = ocultas pelo canal; nulo com likes nulo = não medido (não se sabe).';
comment on column public.competitor_video_marks.comments_disabled is 'O estado NA MARCA. false = comentários medidos; true = desligados; nulo com comments nulo = não medido (não se sabe).';
comment on column public.competitor_video_marks.rule_version is 'Versão da regra de M1 (interpolação e limites de distância) com que a marca foi gravada.';
comment on column public.competitor_video_marks.gap_hours is 'Distância, em horas, entre as duas leituras usadas (read_after_at menos read_before_at). Calculada pelo banco.';
comment on column public.competitor_video_marks.age_base_at is 'O instante zero da idade usado: o maior entre published_at e live_actual_start_at, lido do vídeo na hora da gravação.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. O que não pôde ser medido, com o motivo (catálogo fechado). É o "motivo registrado" que o export (E10) confere.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.competitor_video_mark_misses (
  video_id uuid not null references public.competitor_videos(id) on delete cascade,
  age_days smallint not null check (age_days in (1, 7, 30)),
  site_id uuid not null references public.sites(id) on delete cascade,
  reason text not null check (reason in ('sem_leitura', 'views_ocultas', 'leitura_comecou_depois', 'descoberto_tarde', 'leitura_parou_antes', 'leituras_distantes')),
  since_at timestamptz,
  rule_version smallint not null,
  age_base_at timestamptz not null,
  decided_at timestamptz not null default now(),
  primary key (video_id, age_days)
);
create index if not exists idx_cvmm_site on public.competitor_video_mark_misses (site_id);
comment on table public.competitor_video_mark_misses is 'A5 E4: a idade fechou e a marca NÃO foi gravada, com o motivo (código de catálogo fechado; a frase que o dono lê sai do código). Um par (vídeo, idade) está em competitor_video_marks OU aqui, nunca nos dois. Regra nova (rule_version maior) reavalia a linha enquanto a série existir.';
comment on column public.competitor_video_mark_misses.since_at is 'leitura_comecou_depois e descoberto_tarde: a primeira leitura do vídeo. leitura_parou_antes: a última. Nulo nos demais.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS. Dado público do YouTube: leitura por can_view_site, como as outras competitor_*. Nenhuma policy de escrita.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.competitor_video_marks enable row level security;
alter table public.competitor_video_mark_misses enable row level security;
drop policy if exists "competitor_video_marks_select" on public.competitor_video_marks;
create policy "competitor_video_marks_select" on public.competitor_video_marks
  for select using (public.can_view_site(site_id));
drop policy if exists "competitor_video_mark_misses_select" on public.competitor_video_mark_misses;
create policy "competitor_video_mark_misses_select" on public.competitor_video_mark_misses
  for select using (public.can_view_site(site_id));
revoke all on public.competitor_video_marks, public.competitor_video_mark_misses from anon;
revoke insert, update, delete, truncate, references, trigger on public.competitor_video_marks, public.competitor_video_mark_misses from authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Os pares (vídeo, idade) cuja idade fechou e que ainda não têm marca nem motivo desta versão da regra, com as
--    leituras vizinhas do instante alvo. Só lê. O mais recente primeiro.
--    (emenda 1: C-1) Fora o vídeo agendado ou no ar; marca ou motivo com a base antiga não conta como decisão.
--    (emenda 1: I-3) Devolve missing_since, para o código separar "o vídeo saiu do YouTube" de "a coleta teve buraco".
--    (emenda 2: m-3 e m-8 de dados, n3 de software) Devolve series_tier (a faixa do vídeo na hora) e prev_reason (o motivo
--    que o par já tinha com ESTA base, nulo se não havia), para o aviso de marca perdida não repetir perda já avisada.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_marks_pending(
  p_now timestamptz, p_rule_version integer, p_limit integer, p_gap_hours_day1 numeric, p_gap_hours numeric
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with a(age_days, gap) as (
    values (1, make_interval(secs => (p_gap_hours_day1 * 3600)::double precision)),
           (7, make_interval(secs => (p_gap_hours * 3600)::double precision)),
           (30, make_interval(secs => (p_gap_hours * 3600)::double precision))
  ), cand as (
    select v.id as video_id, c.id as channel_id, c.site_id, c.collection_paused_at, v.discovered_at, v.views_hidden, v.likes_hidden,
           v.comments_disabled, v.missing_since, v.series_tier, a.age_days, a.gap, b.t0, b.t0 + make_interval(days => a.age_days) as t_alvo
      from public.competitor_videos v
      join public.competitor_channels c on c.id = v.competitor_channel_id
      cross join lateral (select greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0) b
      cross join a
     where v.published_at is not null
       and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
       and p_now is not null and p_rule_version is not null and p_gap_hours_day1 > 0 and p_gap_hours > 0
       and b.t0 + make_interval(days => a.age_days) <= p_now - interval '30 minutes'
       and not exists (select 1 from public.competitor_video_marks m
                        where m.video_id = v.id and m.age_days = a.age_days and m.age_base_at = b.t0)
       and not exists (select 1 from public.competitor_video_mark_misses x
                        where x.video_id = v.id and x.age_days = a.age_days and x.rule_version >= p_rule_version and x.age_base_at = b.t0)
  ), todos as (
    select * from cand where collection_paused_at is null
  ), pend as (
    select * from todos order by t0 desc, video_id, age_days
     limit greatest(least(coalesce(p_limit, 500), 2000), 1)
  ), lim as (
    -- o intervalo sem leitura em volta do alvo: da última leitura até o alvo (ou o próprio alvo) à primeira depois dele (ou p_now)
    select p.video_id, p.age_days,
           coalesce((select max(x.taken_at) from (
                       select e.taken_at from public.competitor_video_early e where e.video_id = p.video_id and e.taken_at <= p.t_alvo
                       union all
                       select d.taken_at from public.competitor_video_daily d where d.video_id = p.video_id and d.taken_at <= p.t_alvo) x), p.t_alvo) as ini,
           coalesce((select min(x.taken_at) from (
                       select e.taken_at from public.competitor_video_early e where e.video_id = p.video_id and e.taken_at >= p.t_alvo
                       union all
                       select d.taken_at from public.competitor_video_daily d where d.video_id = p.video_id and d.taken_at >= p.t_alvo) x), p_now) as fim
      from pend p
  ), pausas as (
    -- as interseções do intervalo com as pausas do canal, unidas (pausas sobrepostas contam uma vez)
    select l.video_id, l.age_days, l.ini, l.fim, count(cp.id) as n_pausas,
           range_agg(tstzrange(greatest(cp.paused_at, l.ini), least(coalesce(cp.resumed_at, p_now), l.fim))) filter (where cp.id is not null) as mr
      from lim l
      join pend p on p.video_id = l.video_id and p.age_days = l.age_days
      left join public.competitor_collection_pauses cp
        on cp.competitor_channel_id = p.channel_id
       and cp.paused_at < l.fim and coalesce(cp.resumed_at, p_now) > l.ini
     group by l.video_id, l.age_days, l.ini, l.fim
  ), cruz as (
    -- a pausa só explica o buraco se o tempo NÃO pausado dele coubesse no limite do par
    select q.video_id, q.age_days,
           (q.n_pausas > 0
            and (q.fim - q.ini) - coalesce((select sum(upper(r) - lower(r)) from unnest(q.mr) r), interval '0') <= p.gap) as gap_crossed_pause
      from pausas q
      join pend p on p.video_id = q.video_id and p.age_days = q.age_days
  )
  select jsonb_build_object(
    'total_pendentes', (select count(*) from todos),
    'pares_em_pausa', (select count(*) from cand where collection_paused_at is not null),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'video_id', p.video_id, 'site_id', p.site_id, 'age_days', p.age_days, 'base_at', p.t0, 'target_at', p.t_alvo,
        'discovered_at', p.discovered_at, 'views_hidden', p.views_hidden, 'likes_hidden', p.likes_hidden, 'comments_disabled', p.comments_disabled,
        'missing_since', p.missing_since, 'series_tier', p.series_tier,
        'gap_crossed_pause', coalesce(z.gap_crossed_pause, false),
        'prev_reason', (select x.reason from public.competitor_video_mark_misses x
                         where x.video_id = p.video_id and x.age_days = p.age_days and x.age_base_at = p.t0),
        'first_reading_at', least(
          (select min(e.taken_at) from public.competitor_video_early e where e.video_id = p.video_id),
          (select d.taken_at from public.competitor_video_daily d where d.video_id = p.video_id order by d.snap_date asc limit 1)),
        'last_reading_at', greatest(
          (select max(e.taken_at) from public.competitor_video_early e where e.video_id = p.video_id),
          (select d.taken_at from public.competitor_video_daily d where d.video_id = p.video_id order by d.snap_date desc limit 1)),
        'readings', coalesce((
          select jsonb_agg(jsonb_build_object('t', r.taken_at, 'views', r.views, 'likes', r.likes, 'comments', r.comments) order by r.taken_at)
            from (
              select e.taken_at, e.views, e.likes, e.comments
                from public.competitor_video_early e
               where e.video_id = p.video_id
                 and e.taken_at between p.t_alvo - p.gap - interval '1 hour' and p.t_alvo + p.gap + interval '1 hour'
              union all
              select d.taken_at, d.views, d.likes, d.comments
                from public.competitor_video_daily d
               where d.video_id = p.video_id
                 and d.snap_date between ((p.t_alvo - p.gap) at time zone 'UTC')::date - 2 and ((p.t_alvo + p.gap) at time zone 'UTC')::date + 2
                 and d.taken_at between p.t_alvo - p.gap - interval '1 hour' and p.t_alvo + p.gap + interval '1 hour'
            ) r), '[]'::jsonb)
      ) order by p.t0 desc, p.video_id, p.age_days)
      from pend p
      left join cruz z on z.video_id = p.video_id and z.age_days = p.age_days), '[]'::jsonb)
  );
$$;
revoke all on function public.competitor_marks_pending(timestamptz, integer, integer, numeric, numeric) from public, anon, authenticated;
grant execute on function public.competitor_marks_pending(timestamptz, integer, integer, numeric, numeric) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. A prova (o alarme). Só lê.
--    atrasadas: pares cuja idade fechou há mais que o limite de distância + 48 h e que não têm marca nem motivo.
--    (R3, tarefa 8b) atrasadas não conta o par de canal com a coleta pausada (collection_paused_at preenchido).
--    em_duas_tabelas: par com marca E motivo (não pode existir).
--    site_divergente: marca ou motivo cujo site_id não é o do canal do vídeo (não pode existir).
--    base_divergente (emenda 1: C-1): marca ou motivo cuja base gravada não é a base atual do vídeo. Lida logo depois de
--    gravar tem de ser 0 (o gravar apaga essas linhas); lida solta, entre duas execuções, pode ser maior que 0 por um dia.
--    (emenda 2: m-5 de dados) Vídeo sem data não conta: o gravar não apaga a linha dele, e a prova ficaria vermelha para sempre.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_marks_health(p_now timestamptz, p_gap_hours_day1 numeric, p_gap_hours numeric)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_now is null or p_gap_hours_day1 is null or p_gap_hours is null or p_gap_hours_day1 <= 0 or p_gap_hours <= 0 then
    raise exception 'competitor_marks_health: p_now, p_gap_hours_day1 e p_gap_hours são obrigatórios e os limites têm de ser positivos';
  end if;
  return (
    with a(age_days, gap) as (
      values (1, make_interval(secs => (p_gap_hours_day1 * 3600)::double precision)),
             (7, make_interval(secs => (p_gap_hours * 3600)::double precision)),
             (30, make_interval(secs => (p_gap_hours * 3600)::double precision))
    )
    select jsonb_build_object(
      'atrasadas', (
        select count(*)
          from public.competitor_videos v
          join public.competitor_channels ch on ch.id = v.competitor_channel_id and ch.collection_paused_at is null
          cross join a
         where v.published_at is not null
           and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
           and greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) + make_interval(days => a.age_days) + a.gap + interval '48 hours' <= p_now
           and not exists (select 1 from public.competitor_video_marks m where m.video_id = v.id and m.age_days = a.age_days)
           and not exists (select 1 from public.competitor_video_mark_misses x where x.video_id = v.id and x.age_days = a.age_days)),
      'em_duas_tabelas', (
        select count(*) from public.competitor_video_marks m
          join public.competitor_video_mark_misses x on x.video_id = m.video_id and x.age_days = m.age_days),
      'site_divergente', (
        select count(*) from (
          select m.video_id, m.site_id from public.competitor_video_marks m
          union all
          select x.video_id, x.site_id from public.competitor_video_mark_misses x) t
          join public.competitor_videos v on v.id = t.video_id
          join public.competitor_channels c on c.id = v.competitor_channel_id
         where c.site_id <> t.site_id),
      'base_divergente', (
        select count(*) from (
          select m.video_id, m.age_base_at from public.competitor_video_marks m
          union all
          select x.video_id, x.age_base_at from public.competitor_video_mark_misses x) t
          join public.competitor_videos v on v.id = t.video_id
         where v.published_at is not null
           and t.age_base_at is distinct from greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at))),
      'marcas', (select count(*) from public.competitor_video_marks),
      'faltas', (select count(*) from public.competitor_video_mark_misses)
    )
  );
end $$;
revoke all on function public.competitor_marks_health(timestamptz, numeric, numeric) from public, anon, authenticated;
grant execute on function public.competitor_marks_health(timestamptz, numeric, numeric) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Gravar. A marca entra uma vez (on conflict do nothing) e só se o instante alvo está entre as duas leituras;
--    site_id, a base da idade e a distância são do BANCO, nunca de quem chama. O motivo entra se não há marca, e
--    uma versão de regra maior substitui o motivo antigo. Devolve as contagens e a prova lida depois de gravar.
--    (emenda 1: C-1) Antes de tudo apaga marcas e motivos cuja base gravada não é mais a do vídeo (refeitas_por_base);
--    vídeo agendado ou no ar não recebe marca nem motivo.
--    (emenda 1: m-1 de dados, m4 de software) O motivo só entra quando alvo + limite + 1 hora já passou (a leitura das
--    primeiras horas pode ser copiada até 1 hora depois do instante que carrega); o que não passa conta em faltas_recusadas.
--    (emenda 2: m-2 de dados) Cada item traz base_at, a base que competitor_marks_pending devolveu, sem mexer no texto. Se a
--    base do vídeo andou entre a leitura e a gravação (ou base_at não veio), o item é recusado: a conta foi feita para outro alvo.
--    (emenda 2: m-6 de dados) A limpeza do começo apaga também a linha de vídeo que hoje está agendado ou no ar.
--      p_marks:  [{"video_id", "age_days", "base_at", "views", "likes", "comments", "likes_hidden", "comments_disabled", "read_before_at", "read_after_at"}]
--      p_misses: [{"video_id", "age_days", "base_at", "reason", "since_at"}]
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.competitor_marks_apply(
  p_marks jsonb, p_misses jsonb, p_rule_version integer, p_now timestamptz, p_gap_hours_day1 numeric, p_gap_hours numeric
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_marks integer := 0;
  v_recusadas integer := 0;
  v_limpas integer := 0;
  v_faltas integer := 0;
  v_faltas_recusadas integer := 0;
  v_refeitas integer := 0;
  v_n integer := 0;
begin
  if p_marks is null or jsonb_typeof(p_marks) <> 'array' or p_misses is null or jsonb_typeof(p_misses) <> 'array' or p_rule_version is null then
    raise exception 'competitor_marks_apply: p_marks e p_misses têm de ser listas e p_rule_version é obrigatório';
  end if;

  -- (emenda 1: C-1) a base da idade andou depois da decisão (a transmissão começou, ou a releitura trouxe a estreia):
  -- a linha sai e o par volta a ser pendente. Vídeo sem data não é tocado (não teria como ser refeito).
  -- (emenda 2: m-6 de dados) Sai também a linha de vídeo que HOJE está agendado ou no ar (decidida quando o estado ainda era
  -- nulo): ele não tem idade, e se a transmissão nunca começar a base nunca anda e a linha ficaria para sempre.
  delete from public.competitor_video_marks m
   using public.competitor_videos v
   where v.id = m.video_id
     and ((v.published_at is not null and m.age_base_at <> greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)))
          or coalesce(v.live_broadcast_content, 'none') in ('upcoming', 'live'));
  get diagnostics v_n = row_count;
  v_refeitas := v_n;
  delete from public.competitor_video_mark_misses x
   using public.competitor_videos v
   where v.id = x.video_id
     and ((v.published_at is not null and x.age_base_at <> greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)))
          or coalesce(v.live_broadcast_content, 'none') in ('upcoming', 'live'));
  get diagnostics v_n = row_count;
  v_refeitas := v_refeitas + v_n;

  with src as (
    select x.* from jsonb_to_recordset(p_marks) as x(
      video_id uuid, age_days smallint, base_at timestamptz, views bigint, likes bigint, comments bigint, likes_hidden boolean,
      comments_disabled boolean, read_before_at timestamptz, read_after_at timestamptz)
  ), ok as (
    select s.*, c.site_id, b.t0
      from src s
      join public.competitor_videos v on v.id = s.video_id
      join public.competitor_channels c on c.id = v.competitor_channel_id
      cross join lateral (select greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0) b
     where v.published_at is not null
       and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
       and s.base_at = b.t0
       and s.read_before_at <= b.t0 + make_interval(days => s.age_days::integer)
       and s.read_after_at >= b.t0 + make_interval(days => s.age_days::integer)
       and s.read_after_at - s.read_before_at <= make_interval(secs => ((case when s.age_days = 1 then p_gap_hours_day1 else p_gap_hours end) * 3600)::double precision)
  ), ins as (
    insert into public.competitor_video_marks
      (video_id, age_days, site_id, views, likes, comments, likes_hidden, comments_disabled, rule_version, gap_hours, age_base_at, read_before_at, read_after_at)
    select o.video_id, o.age_days, o.site_id, o.views, o.likes, o.comments, o.likes_hidden, o.comments_disabled, p_rule_version,
           round((extract(epoch from (o.read_after_at - o.read_before_at)) / 3600)::numeric, 3), o.t0, o.read_before_at, o.read_after_at
      from ok o
    on conflict (video_id, age_days) do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from src) - (select count(*) from ok) into v_marks, v_recusadas;

  delete from public.competitor_video_mark_misses x
   using public.competitor_video_marks m
   where m.video_id = x.video_id and m.age_days = x.age_days;
  get diagnostics v_limpas = row_count;

  with src as (
    select x.* from jsonb_to_recordset(p_misses) as x(video_id uuid, age_days smallint, base_at timestamptz, reason text, since_at timestamptz)
  ), ok as (
    select s.*, c.site_id, b.t0
      from src s
      join public.competitor_videos v on v.id = s.video_id
      join public.competitor_channels c on c.id = v.competitor_channel_id
      cross join lateral (select greatest(v.published_at, coalesce(v.live_actual_start_at, v.published_at)) as t0) b
     where v.published_at is not null
       and coalesce(v.live_broadcast_content, 'none') not in ('upcoming', 'live')
       and s.base_at = b.t0
       and b.t0 + make_interval(days => s.age_days::integer)
           + make_interval(secs => ((case when s.age_days = 1 then p_gap_hours_day1 else p_gap_hours end) * 3600)::double precision)
           + interval '1 hour' <= p_now
  ), up as (
    insert into public.competitor_video_mark_misses (video_id, age_days, site_id, reason, since_at, rule_version, age_base_at)
    select o.video_id, o.age_days, o.site_id, o.reason, o.since_at, p_rule_version, o.t0 from ok o
     where not exists (select 1 from public.competitor_video_marks m where m.video_id = o.video_id and m.age_days = o.age_days)
    on conflict (video_id, age_days) do update
      set reason = excluded.reason, since_at = excluded.since_at, rule_version = excluded.rule_version,
          age_base_at = excluded.age_base_at, site_id = excluded.site_id, decided_at = now()
      where public.competitor_video_mark_misses.rule_version < excluded.rule_version
    returning 1
  )
  select (select count(*) from up), (select count(*) from src) - (select count(*) from ok) into v_faltas, v_faltas_recusadas;

  return jsonb_build_object(
    'marcas', v_marks, 'marcas_recusadas', v_recusadas, 'faltas', v_faltas, 'faltas_limpas', v_limpas,
    'faltas_recusadas', v_faltas_recusadas, 'refeitas_por_base', v_refeitas,
    'saude', public.competitor_marks_health(p_now, p_gap_hours_day1, p_gap_hours));
end $$;
revoke all on function public.competitor_marks_apply(jsonb, jsonb, integer, timestamptz, numeric, numeric) from public, anon, authenticated;
grant execute on function public.competitor_marks_apply(jsonb, jsonb, integer, timestamptz, numeric, numeric) to service_role;
```

### Apêndice B: roteiro de prova

**(noite de 14/10, Tarefa 8b)** Rodar com `psql "postgresql://postgres:postgres@127.0.0.1:54422/postgres" -q -f prova-mg4.sql`, da pasta onde estão `mg4.sql` (o Apêndice A) e `mg6.sql` (o ensaio da MG6 da E10, `apps/web/test/fixtures/sql/a5-e10-mg6.sql`), ou trocando as três linhas `\i`. Os dois ids fixos (o canal `11b31fc3-…` e o site `2e3f0d9c-…`) já existem no `bythiago_int`. Tudo acontece dentro de uma transação revertida (a MG6 e a MG4 também). O cenário S13 (pausa de coleta) roda entre o S12 e o S9. Cópias: `.superpowers/sdd/a5-e4/sql/`.

```sql
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
begin;
-- (R3, 8b) a MG6 (pausa de coleta) vem antes, aplicada aqui dentro da transação (ensaio; o controlador a aplica de vez)
\i mg6.sql
\i mg4.sql
\i mg4.sql
-- tira do caminho os vídeos que já existem no banco (só dentro da transação)
create temp table antes as select id from public.competitor_videos;
update public.competitor_videos set published_at = null where id in (select id from antes);
\set agora '''2026-11-20 12:00:00+00'''
\set ca '''11b31fc3-f199-4ab0-9fb0-d3829c6372a7'''
insert into public.competitor_videos (id, competitor_channel_id, video_id, published_at, discovered_at) values
 ('00000000-0000-4000-8000-00000000000a', :ca, 'e4provaA', '2026-11-01 10:00+00', '2026-11-01 11:00+00'),
 ('00000000-0000-4000-8000-00000000000b', :ca, 'e4provaB', '2025-01-01 10:00+00', null),
 ('00000000-0000-4000-8000-00000000000c', :ca, 'e4provaC', null, null),
 ('00000000-0000-4000-8000-00000000000e', :ca, 'e4provaE', '2026-11-05 10:00+00', '2026-11-05 11:00+00');
-- (emenda 1: C-1) F: transmissão agendada, criada há 12 dias e ainda não começada. Não pode aparecer em S0 a S8.
insert into public.competitor_videos (id, competitor_channel_id, video_id, published_at, discovered_at, live_broadcast_content)
 values ('00000000-0000-4000-8000-00000000000f', :ca, 'e4provaF', '2026-11-08 10:00+00', '2026-11-08 11:00+00', 'upcoming');
insert into public.competitor_videos (id, competitor_channel_id, video_id, published_at, live_actual_start_at)
 select '00000000-0000-4000-8000-00000000000d', c.id, 'e4provaD', '2026-11-01 10:00+00', '2026-11-03 10:00+00'
   from public.competitor_channels c where c.site_id <> '2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c' limit 1;
insert into public.competitor_video_daily (video_id, snap_date, views, likes, comments, taken_at)
 select v, d::date, 100 * (d::date - date '2026-10-31'), 10 * (d::date - date '2026-10-31'), null, d + interval '3 hours 10 minutes'
   from (values ('00000000-0000-4000-8000-00000000000a'::uuid), ('00000000-0000-4000-8000-00000000000b'::uuid)) x(v),
        generate_series(timestamptz '2026-11-01 00:00+00', timestamptz '2026-11-20 00:00+00', interval '1 day') d;
insert into public.competitor_video_early (video_id, taken_at, site_id, views, likes, comments)
 select '00000000-0000-4000-8000-00000000000a', timestamptz '2026-11-01 10:00+00' + make_interval(hours => h), '2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', h * 5, h, null
   from unnest(array[2, 8, 14, 20, 26]) h;
select 'S0 saude, tabelas vazias', public.competitor_marks_health(:agora, 8, 36);
select 'S1 pendentes: total', (public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'total_pendentes';
select 'S1 pares', string_agg(right(i->>'video_id', 1) || '/' || (i->>'age_days') || ':' || jsonb_array_length(i->'readings'), ' ' order by i->>'video_id', (i->>'age_days')::int)
  from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i;
select 'S1 A/7', i - 'video_id' from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%a' and i->>'age_days' = '7';
select 'S1 B/7 primeira e ultima', i->'first_reading_at', i->'last_reading_at', i->'readings' from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%b' and i->>'age_days' = '7';
select 'S1 D base (estreia) e site', i->'base_at', i->>'site_id' <> '2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c' from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%d' and i->>'age_days' = '1';
select 'S1 limite 2', jsonb_array_length((public.competitor_marks_pending(:agora, 1, 2, 8, 36))->'itens'), (public.competitor_marks_pending(:agora, 1, 2, 8, 36))->'total_pendentes';
select 'S1 agora nulo', public.competitor_marks_pending(null, 1, 500, 8, 36);
select 'S2 aplicar', public.competitor_marks_apply(
  '[{"video_id":"00000000-0000-4000-8000-00000000000a","age_days":7,"base_at":"2026-11-01T10:00:00Z","views":731,"likes":73,"comments":null,"likes_hidden":false,"comments_disabled":null,"read_before_at":"2026-11-08T03:10:00Z","read_after_at":"2026-11-09T03:10:00Z"},
    {"video_id":"00000000-0000-4000-8000-00000000000a","age_days":1,"base_at":"2026-11-01T10:00:00Z","views":5,"likes":null,"comments":null,"likes_hidden":null,"comments_disabled":null,"read_before_at":"2026-11-03T03:10:00Z","read_after_at":"2026-11-03T09:10:00Z"},
    {"video_id":"00000000-0000-4000-8000-00000000000e","age_days":7,"base_at":"2026-11-05T10:00:00Z","views":5,"likes":null,"comments":null,"likes_hidden":null,"comments_disabled":null,"read_before_at":"2026-11-11T03:10:00Z","read_after_at":"2026-11-13T03:10:00Z"},
    {"video_id":"00000000-0000-4000-8000-00000000000c","age_days":7,"base_at":"2026-11-01T10:00:00Z","views":5,"likes":null,"comments":null,"likes_hidden":null,"comments_disabled":null,"read_before_at":"2026-11-08T03:10:00Z","read_after_at":"2026-11-09T03:10:00Z"}]'::jsonb,
  '[{"video_id":"00000000-0000-4000-8000-00000000000b","age_days":1,"base_at":"2025-01-01T10:00:00Z","reason":"leitura_comecou_depois","since_at":"2026-11-01T03:10:00Z"},
    {"video_id":"00000000-0000-4000-8000-00000000000b","age_days":7,"base_at":"2025-01-01T10:00:00Z","reason":"leitura_comecou_depois","since_at":"2026-11-01T03:10:00Z"},
    {"video_id":"00000000-0000-4000-8000-00000000000b","age_days":30,"base_at":"2025-01-01T10:00:00Z","reason":"leitura_comecou_depois","since_at":"2026-11-01T03:10:00Z"},
    {"video_id":"00000000-0000-4000-8000-00000000000a","age_days":7,"base_at":"2026-11-01T10:00:00Z","reason":"leituras_distantes","since_at":null},
    {"video_id":"00000000-0000-4000-8000-00000000000d","age_days":1,"base_at":"2026-11-03T10:00:00Z","reason":"sem_leitura","since_at":null}]'::jsonb, 1, :agora, 8, 36);
select 'S2 marca gravada', video_id, age_days, site_id, views, likes, likes_hidden, rule_version, gap_hours, age_base_at, read_before_at, read_after_at from public.competitor_video_marks;
select 'S2 faltas', right(video_id::text, 1), age_days, reason, rule_version, site_id = '2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c' as site_do_teste from public.competitor_video_mark_misses order by 2, 3;
select 'S3 a mesma marca de novo, com outro numero', (public.competitor_marks_apply('[{"video_id":"00000000-0000-4000-8000-00000000000a","age_days":7,"base_at":"2026-11-01T10:00:00Z","views":999,"likes":1,"comments":null,"likes_hidden":false,"comments_disabled":null,"read_before_at":"2026-11-08T03:10:00Z","read_after_at":"2026-11-09T03:10:00Z"}]'::jsonb, '[]'::jsonb, 1, :agora, 8, 36)) - 'saude', (select views from public.competitor_video_marks where age_days = 7);
select 'S4 motivo e depois a marca do mesmo par', (public.competitor_marks_apply('[]'::jsonb, '[{"video_id":"00000000-0000-4000-8000-00000000000a","age_days":1,"base_at":"2026-11-01T10:00:00Z","reason":"leituras_distantes","since_at":null}]'::jsonb, 1, :agora, 8, 36)) - 'saude';
select 'S4 marca chega', (public.competitor_marks_apply('[{"video_id":"00000000-0000-4000-8000-00000000000a","age_days":1,"base_at":"2026-11-01T10:00:00Z","views":118,"likes":23,"comments":null,"likes_hidden":false,"comments_disabled":null,"read_before_at":"2026-11-02T06:00:00Z","read_after_at":"2026-11-02T12:00:00Z"}]'::jsonb, '[]'::jsonb, 1, :agora, 8, 36)) - 'saude';
select 'S4 motivos que sobraram do video A', count(*) from public.competitor_video_mark_misses where video_id::text like '%a';
select 'S5 motivo: mesma versao nao troca', (public.competitor_marks_apply('[]'::jsonb, '[{"video_id":"00000000-0000-4000-8000-00000000000b","age_days":7,"base_at":"2025-01-01T10:00:00Z","reason":"sem_leitura","since_at":null}]'::jsonb, 1, :agora, 8, 36))->'faltas';
select 'S5 continua', reason || '/' || rule_version from public.competitor_video_mark_misses where video_id::text like '%b' and age_days = 7;
select 'S5 versao maior troca e reabre a pendencia', (public.competitor_marks_pending(:agora, 2, 500, 8, 36))->'total_pendentes', (public.competitor_marks_apply('[]'::jsonb, '[{"video_id":"00000000-0000-4000-8000-00000000000b","age_days":7,"base_at":"2025-01-01T10:00:00Z","reason":"sem_leitura","since_at":null}]'::jsonb, 2, :agora, 8, 36))->'faltas';
select 'S5 trocou', reason || '/' || rule_version from public.competitor_video_mark_misses where video_id::text like '%b' and age_days = 7;
select 'S6 pendentes depois (versao 1)', string_agg(right(i->>'video_id', 1) || '/' || (i->>'age_days'), ' ' order by i->>'video_id', (i->>'age_days')::int) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i;
select 'S7 saude', public.competitor_marks_health(:agora, 8, 36);
select 'S7 saude antes do prazo (E/7 fecha 12/11 10:00; +36h+48h = 15/11 22:00)', (public.competitor_marks_health('2026-11-15 21:59+00', 8, 36))->'atrasadas', (public.competitor_marks_health('2026-11-15 22:00+00', 8, 36))->'atrasadas';
insert into public.competitor_video_mark_misses (video_id, age_days, site_id, reason, rule_version, age_base_at) select video_id, age_days, site_id, 'sem_leitura', 1, age_base_at from public.competitor_video_marks where age_days = 7;
update public.competitor_video_marks set site_id = (select site_id from public.competitor_channels where site_id <> '2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c' limit 1) where age_days = 1;
select 'S8 saude com defeito plantado', (public.competitor_marks_health(:agora, 8, 36)) - 'atrasadas';
-- (emenda 1: C-1, m-1 de dados) S11: agendado, base que anda, motivo cedo demais. Fica antes do S9, que apaga os vídeos.
select 'S11 agendado: pares pendentes do F', count(*) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%f';
select 'S11 agendado: marca e motivo recusados', (public.competitor_marks_apply('[{"video_id":"00000000-0000-4000-8000-00000000000f","age_days":1,"base_at":"2026-11-08T10:00:00Z","views":5,"likes":null,"comments":null,"likes_hidden":null,"comments_disabled":null,"read_before_at":"2026-11-09T09:00:00Z","read_after_at":"2026-11-09T11:00:00Z"}]'::jsonb, '[{"video_id":"00000000-0000-4000-8000-00000000000f","age_days":7,"base_at":"2026-11-08T10:00:00Z","reason":"sem_leitura","since_at":null}]'::jsonb, 1, :agora, 8, 36)) - 'saude';
update public.competitor_videos set live_broadcast_content = 'none', live_actual_start_at = '2026-11-16 10:00+00' where video_id = 'e4provaF';
select 'S11 a transmissao comecou: F com a base nova', string_agg((i->>'age_days') || '@' || (i->>'base_at'), ' ' order by (i->>'age_days')::int) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%f';
select 'S11 motivo cedo demais (E/7: alvo 12/11 10:00 + 36 h + 1 h = 13/11 23:00)', (public.competitor_marks_apply('[]'::jsonb, '[{"video_id":"00000000-0000-4000-8000-00000000000e","age_days":7,"base_at":"2026-11-05T10:00:00Z","reason":"leituras_distantes","since_at":null}]'::jsonb, 1, '2026-11-13 22:59+00', 8, 36)) - 'saude';
select 'S11 motivo no minuto exato', (public.competitor_marks_apply('[]'::jsonb, '[{"video_id":"00000000-0000-4000-8000-00000000000e","age_days":7,"base_at":"2026-11-05T10:00:00Z","reason":"leituras_distantes","since_at":null}]'::jsonb, 1, '2026-11-13 23:00+00', 8, 36)) - 'saude';
update public.competitor_videos set live_actual_start_at = '2026-11-02 10:00+00' where video_id = 'e4provaA';
select 'S11 a base do A andou: a prova ve', (public.competitor_marks_health(:agora, 8, 36))->'base_divergente';
select 'S11 a base do A andou: pares do A pendentes de novo', string_agg((i->>'age_days') || '@' || (i->>'base_at'), ' ' order by (i->>'age_days')::int) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%a';
select 'S11 gravar apaga as linhas da base velha e aceita a marca na base nova', (public.competitor_marks_apply('[{"video_id":"00000000-0000-4000-8000-00000000000a","age_days":7,"base_at":"2026-11-02T10:00:00Z","views":929,"likes":93,"comments":null,"likes_hidden":false,"comments_disabled":null,"read_before_at":"2026-11-09T03:10:00Z","read_after_at":"2026-11-10T03:10:00Z"}]'::jsonb, '[]'::jsonb, 1, :agora, 8, 36)) - 'saude';
select 'S11 depois', (public.competitor_marks_health(:agora, 8, 36))->'base_divergente', (select string_agg(age_days || ':' || views || '@' || age_base_at, ' ' order by age_days) from public.competitor_video_marks where video_id::text like '%a');
-- (emenda 2) S12: base que anda pouco entre as duas idas (m-2), motivo anterior e faixa nos pendentes (m-8, m-3),
-- vídeo que passa a agendado depois da decisão (m-6), vídeo que perde a data (m-5). Fica antes do S9.
update public.competitor_videos set live_actual_start_at = '2026-11-02 12:00+00' where video_id = 'e4provaA';
select 'S12 base andou 2 h no meio: a marca calculada para a base velha e recusada, mesmo com as leituras cercando o alvo novo', (public.competitor_marks_apply('[{"video_id":"00000000-0000-4000-8000-00000000000a","age_days":1,"base_at":"2026-11-02T10:00:00Z","views":150,"likes":null,"comments":null,"likes_hidden":null,"comments_disabled":null,"read_before_at":"2026-11-03T06:00:00Z","read_after_at":"2026-11-03T13:00:00Z"}]'::jsonb, '[]'::jsonb, 1, :agora, 8, 36)) - 'saude';
select 'S12 a mesma marca com a base nova entra', (public.competitor_marks_apply('[{"video_id":"00000000-0000-4000-8000-00000000000a","age_days":1,"base_at":"2026-11-02T12:00:00Z","views":160,"likes":null,"comments":null,"likes_hidden":null,"comments_disabled":null,"read_before_at":"2026-11-03T06:00:00Z","read_after_at":"2026-11-03T13:00:00Z"}]'::jsonb, '[]'::jsonb, 1, :agora, 8, 36)) - 'saude';
select 'S12 marcas do A depois', (select string_agg(age_days || ':' || views || '@' || age_base_at, ' ' order by age_days) from public.competitor_video_marks where video_id::text like '%a');
select 'S12 item sem base_at e recusado (marca e motivo)', (public.competitor_marks_apply('[{"video_id":"00000000-0000-4000-8000-00000000000a","age_days":7,"views":1,"likes":null,"comments":null,"likes_hidden":null,"comments_disabled":null,"read_before_at":"2026-11-09T03:10:00Z","read_after_at":"2026-11-10T03:10:00Z"}]'::jsonb, '[{"video_id":"00000000-0000-4000-8000-00000000000d","age_days":7,"reason":"sem_leitura","since_at":null}]'::jsonb, 1, :agora, 8, 36)) - 'saude';
select 'S12 pendentes da versao 2: motivo anterior do par e a chave da faixa', string_agg(right(i->>'video_id', 1) || '/' || (i->>'age_days') || ':' || coalesce(i->>'prev_reason', '-'), ' ' order by i->>'video_id', (i->>'age_days')::int), bool_and(i ? 'series_tier') from jsonb_array_elements((public.competitor_marks_pending(:agora, 2, 500, 8, 36))->'itens') i;
update public.competitor_videos set live_broadcast_content = 'upcoming' where video_id = 'e4provaE';
select 'S12 o E passou a agendado depois da decisao: gravar apaga o motivo dele', (public.competitor_marks_apply('[]'::jsonb, '[]'::jsonb, 1, :agora, 8, 36)) - 'saude';
select 'S12 motivos do E depois', count(*) from public.competitor_video_mark_misses where video_id::text like '%e';
update public.competitor_videos set published_at = null where video_id = 'e4provaB';
select 'S12 o B perdeu a data: a prova nao conta, gravar nao apaga', (public.competitor_marks_health(:agora, 8, 36))->'base_divergente', (public.competitor_marks_apply('[]'::jsonb, '[]'::jsonb, 1, :agora, 8, 36))->'refeitas_por_base';
select 'S12 motivos do B depois', count(*) from public.competitor_video_mark_misses where video_id::text like '%b';
-- (R3, tarefa 8b) S13: a pausa de coleta. Fica antes do S9, que apaga os vídeos e_prova.
insert into public.competitor_videos (id, competitor_channel_id, video_id, published_at, discovered_at)
 values ('00000000-0000-4000-8000-000000000010', :ca, 'e4provaG', '2026-11-10 10:00+00', '2026-11-10 11:00+00');
insert into public.competitor_video_daily (video_id, snap_date, views, likes, comments, taken_at) values
 ('00000000-0000-4000-8000-000000000010', date '2026-11-10', 100, 10, null, timestamptz '2026-11-10 03:10+00'),
 ('00000000-0000-4000-8000-000000000010', date '2026-11-15', 500, 50, null, timestamptz '2026-11-15 03:10+00');
select 'S13 sem pausa: gap_crossed_pause dos pares do G', string_agg((i->>'age_days') || '=' || (i->>'gap_crossed_pause'), ' ' order by (i->>'age_days')::int) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%10';
select 'S13 todo item traz gap_crossed_pause booleano, nunca nulo', bool_and(jsonb_typeof(i->'gap_crossed_pause') = 'boolean'), count(*) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i;
insert into public.competitor_collection_pauses (site_id, competitor_channel_id, paused_at, paused_by, resumed_at)
 values ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', :ca, '2026-11-10 04:00+00', gen_random_uuid(), '2026-11-14 20:00+00');
select 'S13 pausa cobre o buraco menos o limite (G/1: 120 h, pausado 112 h, sobram 8 h = limite): cruza; G/7 nao toca a pausa', string_agg((i->>'age_days') || '=' || (i->>'gap_crossed_pause'), ' ' order by (i->>'age_days')::int) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%10';
update public.competitor_collection_pauses set paused_at = '2026-11-10 04:01+00' where competitor_channel_id = :ca;
select 'S13 um minuto a menos de pausa (sobram 8 h 01 min): nao cruza', string_agg((i->>'age_days') || '=' || (i->>'gap_crossed_pause'), ' ' order by (i->>'age_days')::int) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%10';
delete from public.competitor_collection_pauses where competitor_channel_id = :ca;
insert into public.competitor_collection_pauses (site_id, competitor_channel_id, paused_at, paused_by, resumed_at)
 values ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', :ca, '2026-11-12 10:00+00', gen_random_uuid(), '2026-11-12 10:20+00');
select 'S13 pausa curta (20 min) dentro de buraco longo: nao cruza', string_agg((i->>'age_days') || '=' || (i->>'gap_crossed_pause'), ' ' order by (i->>'age_days')::int) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%10';
delete from public.competitor_collection_pauses where competitor_channel_id = :ca;
insert into public.competitor_collection_pauses (site_id, competitor_channel_id, paused_at, paused_by, resumed_at) values
 ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', :ca, '2026-11-10 04:00+00', gen_random_uuid(), '2026-11-14 12:00+00'),
 ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', :ca, '2026-11-12 00:00+00', gen_random_uuid(), '2026-11-14 12:00+00');
select 'S13 pausas sobrepostas contam uma vez (uniao 104 h, sobram 16 h > 8): nao cruza', string_agg((i->>'age_days') || '=' || (i->>'gap_crossed_pause'), ' ' order by (i->>'age_days')::int) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%10';
delete from public.competitor_collection_pauses where competitor_channel_id = :ca;
-- canal pausado agora: os pares dele saem de pendentes e de atrasadas, e entram em pares_em_pausa
insert into public.competitor_channels (id, site_id, channel_id, channel_name)
 values ('00000000-0000-4000-8000-0000000000c1', '2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', 'UCe4provaPausa', 'e4 canal pausado');
insert into public.competitor_videos (id, competitor_channel_id, video_id, published_at, discovered_at)
 values ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000c1', 'e4provaH', '2026-11-01 10:00+00', '2026-11-01 11:00+00');
select 'S13 antes de pausar: pendentes, pares em pausa, atrasadas', (p->>'total_pendentes')::int, (p->>'pares_em_pausa')::int, (public.competitor_marks_health(:agora, 8, 36))->'atrasadas'
  from (select public.competitor_marks_pending(:agora, 1, 500, 8, 36) p) x;
update public.competitor_channels set collection_paused_at = '2026-11-19 10:00+00' where id = '00000000-0000-4000-8000-0000000000c1';
insert into public.competitor_collection_pauses (site_id, competitor_channel_id, paused_at, paused_by)
 values ('2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c', '00000000-0000-4000-8000-0000000000c1', '2026-11-19 10:00+00', gen_random_uuid());
select 'S13 canal pausado: pendentes, pares em pausa, atrasadas', (p->>'total_pendentes')::int, (p->>'pares_em_pausa')::int, (public.competitor_marks_health(:agora, 8, 36))->'atrasadas'
  from (select public.competitor_marks_pending(:agora, 1, 500, 8, 36) p) x;
select 'S13 canal pausado: nenhum item dele em pendentes', count(*) from jsonb_array_elements((public.competitor_marks_pending(:agora, 1, 500, 8, 36))->'itens') i where i->>'video_id' like '%11';
select 'S13 a saude do canal pausado continua com as seis chaves', (select count(*) from jsonb_object_keys(public.competitor_marks_health(:agora, 8, 36)));
update public.competitor_channels set collection_paused_at = null where id = '00000000-0000-4000-8000-0000000000c1';
update public.competitor_collection_pauses set resumed_at = '2026-11-19 12:00+00' where competitor_channel_id = '00000000-0000-4000-8000-0000000000c1';
select 'S13 despausado: pendentes, pares em pausa, atrasadas; H/1 cruza a pausa de 2 h?', (p->>'total_pendentes')::int, (p->>'pares_em_pausa')::int, (public.competitor_marks_health(:agora, 8, 36))->'atrasadas',
       (select string_agg((i->>'age_days') || '=' || (i->>'gap_crossed_pause'), ' ' order by (i->>'age_days')::int) from jsonb_array_elements(p->'itens') i where i->>'video_id' like '%11')
  from (select public.competitor_marks_pending(:agora, 1, 500, 8, 36) p) x;
select 'S9 cascata', (select count(*) from public.competitor_video_marks), (select count(*) from public.competitor_video_mark_misses);
delete from public.competitor_videos where video_id like 'e4prova%';
select 'S9 depois de apagar os videos', (select count(*) from public.competitor_video_marks), (select count(*) from public.competitor_video_mark_misses);
select 'S10 privilegios', has_function_privilege('anon', 'public.competitor_marks_apply(jsonb, jsonb, integer, timestamptz, numeric, numeric)', 'execute'), has_function_privilege('authenticated', 'public.competitor_marks_pending(timestamptz, integer, integer, numeric, numeric)', 'execute'), has_function_privilege('service_role', 'public.competitor_marks_health(timestamptz, numeric, numeric)', 'execute'), has_table_privilege('anon', 'public.competitor_video_marks', 'select'), has_table_privilege('authenticated', 'public.competitor_video_marks', 'select'), has_table_privilege('authenticated', 'public.competitor_video_mark_misses', 'insert');
select 'S10 rls e policies', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity and c.relname in ('competitor_video_marks', 'competitor_video_mark_misses')), (select string_agg(tablename || '=' || qual, ' ; ' order by tablename) from pg_policies where tablename in ('competitor_video_marks', 'competitor_video_mark_misses'));
rollback;
select 'depois do rollback', to_regclass('public.competitor_video_marks'), (select count(*) from public.competitor_videos where video_id like 'e4prova%');
```

### Apêndice C: saída do roteiro (noite de 14/10, Tarefa 8b: as duas execuções deram este texto, fora os avisos de "já existe"; é a saída do Apêndice B com a pausa. Em relação à da emenda 2, mudam `S1 A/7` (a chave `gap_crossed_pause`), `S1 agora nulo` (a chave `pares_em_pausa`) e entram as linhas `S13`)

```text
S0 saude, tabelas vazias|{"faltas": 0, "marcas": 0, "atrasadas": 9, "base_divergente": 0, "em_duas_tabelas": 0, "site_divergente": 0}
S1 pendentes: total|9
S1 pares|a/1:3 a/7:3 b/1:0 b/7:0 b/30:0 d/1:0 d/7:0 e/1:0 e/7:0
S1 A/7|{"base_at": "2026-11-01T10:00:00+00:00", "site_id": "2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c", "age_days": 7, "readings": [{"t": "2026-11-07T03:10:00+00:00", "likes": 70, "views": 700, "comments": null}, {"t": "2026-11-08T03:10:00+00:00", "likes": 80, "views": 800, "comments": null}, {"t": "2026-11-09T03:10:00+00:00", "likes": 90, "views": 900, "comments": null}], "target_at": "2026-11-08T10:00:00+00:00", "prev_reason": null, "series_tier": null, "likes_hidden": null, "views_hidden": null, "discovered_at": "2026-11-01T11:00:00+00:00", "missing_since": null, "last_reading_at": "2026-11-20T03:10:00+00:00", "first_reading_at": "2026-11-01T03:10:00+00:00", "comments_disabled": null, "gap_crossed_pause": false}
S1 B/7 primeira e ultima|"2026-11-01T03:10:00+00:00"|"2026-11-20T03:10:00+00:00"|[]
S1 D base (estreia) e site|"2026-11-03T10:00:00+00:00"|t
S1 limite 2|2|9
S1 agora nulo|{"itens": [], "pares_em_pausa": 0, "total_pendentes": 0}
S2 aplicar|{"saude": {"faltas": 4, "marcas": 1, "atrasadas": 4, "base_divergente": 0, "em_duas_tabelas": 0, "site_divergente": 0}, "faltas": 4, "marcas": 1, "faltas_limpas": 0, "faltas_recusadas": 0, "marcas_recusadas": 3, "refeitas_por_base": 0}
S2 marca gravada|00000000-0000-4000-8000-00000000000a|7|2e3f0d9c-a148-48fe-8f53-95a07a8f5f7c|731|73|f|1|24.000|2026-11-01 10:00:00+00|2026-11-08 03:10:00+00|2026-11-09 03:10:00+00
S2 faltas|b|1|leitura_comecou_depois|1|t
S2 faltas|b|7|leitura_comecou_depois|1|t
S2 faltas|b|30|leitura_comecou_depois|1|t
S2 faltas|d|1|sem_leitura|1|f
S3 a mesma marca de novo, com outro numero|{"faltas": 0, "marcas": 0, "faltas_limpas": 0, "faltas_recusadas": 0, "marcas_recusadas": 0, "refeitas_por_base": 0}|731
S4 motivo e depois a marca do mesmo par|{"faltas": 1, "marcas": 0, "faltas_limpas": 0, "faltas_recusadas": 0, "marcas_recusadas": 0, "refeitas_por_base": 0}
S4 marca chega|{"faltas": 0, "marcas": 1, "faltas_limpas": 1, "faltas_recusadas": 0, "marcas_recusadas": 0, "refeitas_por_base": 0}
S4 motivos que sobraram do video A|0
S5 motivo: mesma versao nao troca|0
S5 continua|leitura_comecou_depois/1
S5 versao maior troca e reabre a pendencia|7|1
S5 trocou|sem_leitura/2
S6 pendentes depois (versao 1)|d/7 e/1 e/7
S7 saude|{"faltas": 4, "marcas": 2, "atrasadas": 3, "base_divergente": 0, "em_duas_tabelas": 0, "site_divergente": 0}
S7 saude antes do prazo (E/7 fecha 12/11 10:00; +36h+48h = 15/11 22:00)|2|3
S8 saude com defeito plantado|{"faltas": 5, "marcas": 2, "base_divergente": 0, "em_duas_tabelas": 1, "site_divergente": 1}
S11 agendado: pares pendentes do F|0
S11 agendado: marca e motivo recusados|{"faltas": 0, "marcas": 0, "faltas_limpas": 1, "faltas_recusadas": 1, "marcas_recusadas": 1, "refeitas_por_base": 0}
S11 a transmissao comecou: F com a base nova|1@2026-11-16T10:00:00+00:00
S11 motivo cedo demais (E/7: alvo 12/11 10:00 + 36 h + 1 h = 13/11 23:00)|{"faltas": 0, "marcas": 0, "faltas_limpas": 0, "faltas_recusadas": 1, "marcas_recusadas": 0, "refeitas_por_base": 0}
S11 motivo no minuto exato|{"faltas": 1, "marcas": 0, "faltas_limpas": 0, "faltas_recusadas": 0, "marcas_recusadas": 0, "refeitas_por_base": 0}
S11 a base do A andou: a prova ve|2
S11 a base do A andou: pares do A pendentes de novo|1@2026-11-02T10:00:00+00:00 7@2026-11-02T10:00:00+00:00
S11 gravar apaga as linhas da base velha e aceita a marca na base nova|{"faltas": 0, "marcas": 1, "faltas_limpas": 0, "faltas_recusadas": 0, "marcas_recusadas": 0, "refeitas_por_base": 2}
S11 depois|0|7:929@2026-11-02 10:00:00+00
S12 base andou 2 h no meio: a marca calculada para a base velha e recusada, mesmo com as leituras cercando o alvo novo|{"faltas": 0, "marcas": 0, "faltas_limpas": 0, "faltas_recusadas": 0, "marcas_recusadas": 1, "refeitas_por_base": 1}
S12 a mesma marca com a base nova entra|{"faltas": 0, "marcas": 1, "faltas_limpas": 0, "faltas_recusadas": 0, "marcas_recusadas": 0, "refeitas_por_base": 0}
S12 marcas do A depois|1:160@2026-11-02 12:00:00+00
S12 item sem base_at e recusado (marca e motivo)|{"faltas": 0, "marcas": 0, "faltas_limpas": 0, "faltas_recusadas": 1, "marcas_recusadas": 1, "refeitas_por_base": 0}
S12 pendentes da versao 2: motivo anterior do par e a chave da faixa|a/7:- b/1:leitura_comecou_depois b/30:leitura_comecou_depois d/1:sem_leitura d/7:- e/1:- e/7:leituras_distantes f/1:-|t
S12 o E passou a agendado depois da decisao: gravar apaga o motivo dele|{"faltas": 0, "marcas": 0, "faltas_limpas": 0, "faltas_recusadas": 0, "marcas_recusadas": 0, "refeitas_por_base": 1}
S12 motivos do E depois|0
S12 o B perdeu a data: a prova nao conta, gravar nao apaga|0|0
S12 motivos do B depois|3
S13 sem pausa: gap_crossed_pause dos pares do G|1=false 7=false
S13 todo item traz gap_crossed_pause booleano, nunca nulo|t|5
S13 pausa cobre o buraco menos o limite (G/1: 120 h, pausado 112 h, sobram 8 h = limite): cruza; G/7 nao toca a pausa|1=true 7=false
S13 um minuto a menos de pausa (sobram 8 h 01 min): nao cruza|1=false 7=false
S13 pausa curta (20 min) dentro de buraco longo: nao cruza|1=false 7=false
S13 pausas sobrepostas contam uma vez (uniao 104 h, sobram 16 h > 8): nao cruza|1=false 7=false
S13 antes de pausar: pendentes, pares em pausa, atrasadas|7|0|6
S13 canal pausado: pendentes, pares em pausa, atrasadas|5|2|4
S13 canal pausado: nenhum item dele em pendentes|0
S13 a saude do canal pausado continua com as seis chaves|6
S13 despausado: pendentes, pares em pausa, atrasadas; H/1 cruza a pausa de 2 h?|7|0|6|1=false 7=false
S9 cascata|1|4
S9 depois de apagar os videos|0|0
S10 privilegios|f|f|t|f|t|f
S10 rls e policies|2|competitor_video_mark_misses=can_view_site(site_id) ; competitor_video_marks=can_view_site(site_id)
depois do rollback||0
```
